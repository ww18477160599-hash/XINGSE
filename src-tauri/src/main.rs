// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use base64::prelude::*;

#[tauri::command]
fn save_image_bytes(bytes: Vec<u8>, save_dir: String, filename: String) -> Result<String, String> {
    let dir = PathBuf::from(&save_dir);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let target_path = dir.join(&filename);
    fs::write(&target_path, &bytes).map_err(|e| format!("写入图片文件失败: {}", e))?;
    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
fn save_image_to_disk(image_data_or_url: String, save_dir: String, filename: String) -> Result<String, String> {
    let dir = PathBuf::from(&save_dir);
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    let target_path = dir.join(&filename);
    let target_str = target_path.to_string_lossy().to_string();

    if image_data_or_url.starts_with("http://") || image_data_or_url.starts_with("https://") {
        // 使用 Windows 自带 curl 高速无损下载保存
        let status = Command::new("curl.exe")
            .arg("-s")
            .arg("-L")
            .arg("-o")
            .arg(&target_str)
            .arg(&image_data_or_url)
            .status()
            .map_err(|e| format!("启动curl下载程序失败: {}", e))?;
        if status.success() && target_path.exists() && fs::metadata(&target_path).map(|m| m.len()).unwrap_or(0) > 0 {
            Ok(target_str)
        } else {
            Err("下载图片并保存失败".into())
        }
    } else {
        // Base64 原生直接解码并写入，无需外部进程，彻底消除命令行溢出错误
        let clean_b64 = if let Some(idx) = image_data_or_url.find(",") {
            &image_data_or_url[idx + 1..]
        } else {
            &image_data_or_url
        };
        let clean_b64: String = clean_b64.chars().filter(|c| !c.is_whitespace()).collect();
        let bytes = BASE64_STANDARD.decode(clean_b64.as_bytes()).map_err(|e| format!("Base64解码失败: {}", e))?;
        fs::write(&target_path, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;
        Ok(target_str)
    }
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    let dir = PathBuf::from(&path);
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    let _ = Command::new("explorer").arg(&path).spawn();
    Ok(())
}

#[tauri::command]
fn select_folder(initial_path: Option<String>) -> Result<String, String> {
    let norm = initial_path.unwrap_or_default();
    let ps_script = format!(
        "Add-Type -AssemblyName System.Windows.Forms;\
         $d = New-Object System.Windows.Forms.FolderBrowserDialog;\
         $d.Description = '形色 - 请选择图片保存目录';\
         $d.ShowNewFolderButton = $true;\
         if ('{}') {{ $d.SelectedPath = '{}' }};\
         $top = New-Object System.Windows.Forms.Form;\
         $top.TopMost = $true;\
         if ($d.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) {{ Write-Output $d.SelectedPath }}",
        norm.replace("'", "''"), norm.replace("'", "''")
    );
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(&ps_script)
        .output()
        .map_err(|e| e.to_string())?;
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(path)
}

fn get_history_file() -> PathBuf {
    // 1. 若当前工作目录下存在 data 文件夹
    let cur_data = PathBuf::from("data");
    if cur_data.exists() {
        return cur_data.join("history.json");
    }
    // 2. 检查程序所在目录的同级 data 文件夹
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let p_data = parent.join("data");
            if p_data.exists() {
                return p_data.join("history.json");
            }
        }
    }
    // 3. 兜底使用系统 AppData 目录
    if let Some(app_data) = std::env::var_os("APPDATA") {
        let dir = PathBuf::from(app_data).join("xingse");
        let _ = fs::create_dir_all(&dir);
        return dir.join("history.json");
    }
    PathBuf::from("history.json")
}

#[tauri::command]
fn get_history_records() -> Result<String, String> {
    let file = get_history_file();
    if file.exists() {
        fs::read_to_string(&file).map_err(|e| format!("读取历史失败: {}", e))
    } else {
        Ok("[]".to_string())
    }
}

#[tauri::command]
fn save_history_record(record_json: String) -> Result<bool, String> {
    let file = get_history_file();
    if let Some(parent) = file.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let mut list: Vec<serde_json::Value> = if file.exists() {
        let content = fs::read_to_string(&file).unwrap_or_else(|_| "[]".to_string());
        serde_json::from_str(&content).unwrap_or_else(|_| vec![])
    } else {
        vec![]
    };

    if let Ok(new_rec) = serde_json::from_str::<serde_json::Value>(&record_json) {
        list.insert(0, new_rec);
        if list.len() > 100 {
            list.truncate(100);
        }
        let serialized = serde_json::to_string_pretty(&list)
            .map_err(|e| format!("序列化失败: {}", e))?;
        fs::write(&file, serialized).map_err(|e| format!("写入历史文件失败: {}", e))?;
        Ok(true)
    } else {
        Err("解析记录JSON失败".into())
    }
}

#[tauri::command]
fn delete_history_record(id: String) -> Result<bool, String> {
    let file = get_history_file();
    if !file.exists() {
        return Ok(true);
    }
    let content = fs::read_to_string(&file).unwrap_or_else(|_| "[]".to_string());
    let mut list: Vec<serde_json::Value> = serde_json::from_str(&content).unwrap_or_else(|_| vec![]);
    list.retain(|item| {
        item.get("id").and_then(|v| v.as_str()) != Some(&id)
    });
    let serialized = serde_json::to_string_pretty(&list)
        .map_err(|e| format!("序列化失败: {}", e))?;
    fs::write(&file, serialized).map_err(|e| format!("写入历史文件失败: {}", e))?;
    Ok(true)
}

#[tauri::command]
fn clear_history_records() -> Result<bool, String> {
    let file = get_history_file();
    fs::write(&file, "[]").map_err(|e| format!("清空历史文件失败: {}", e))?;
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_image_to_disk,
            save_image_bytes,
            open_folder,
            select_folder,
            get_history_records,
            save_history_record,
            delete_history_record,
            clear_history_records
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
