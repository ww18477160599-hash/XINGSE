// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;

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
            .status();
        match status {
            Ok(s) if s.success() => Ok(target_str),
            _ => Err("下载图片并保存失败".into()),
        }
    } else {
        // Base64 图片数据落盘
        let clean_b64 = if let Some(idx) = image_data_or_url.find(",") {
            &image_data_or_url[idx + 1..]
        } else {
            &image_data_or_url
        };
        let ps_cmd = format!(
            "[System.IO.File]::WriteAllBytes('{}', [System.Convert]::FromBase64String('{}'))",
            target_str.replace("'", "''"),
            clean_b64
        );
        let status = Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(&ps_cmd)
            .status();
        match status {
            Ok(s) if s.success() => Ok(target_str),
            _ => Err("写入图片数据失败".into()),
        }
    }
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_image_to_disk,
            open_folder,
            select_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
