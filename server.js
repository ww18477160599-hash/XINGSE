const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3721;
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_OPTIONS_FILE = path.join(DATA_DIR, 'options_default.json');
const CUSTOM_OPTIONS_FILE = path.join(DATA_DIR, 'custom_options.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');

// 初始化自定义数据文件
function initJsonFile(file, defaultContent) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultContent, null, 2), 'utf8');
  }
}

initJsonFile(CUSTOM_OPTIONS_FILE, {});
initJsonFile(SETTINGS_FILE, {
  llm: {
    enabled: true,
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2000
  },
  imageGen: {
    enabled: true,
    provider: 'siliconflow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    model: 'black-forest-labs/FLUX.1-schnell',
    width: 1024,
    height: 1024,
    batchSize: 1
  }
});
initJsonFile(HISTORY_FILE, []);
initJsonFile(PRESETS_FILE, []);

function readJson(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error(`Read JSON error for ${file}:`, err.message);
  }
  return fallback;
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Write JSON error for ${file}:`, err.message);
    return false;
  }
}

// 判断 API Key 是否为前端脱敏占位符 (防止 ByteString 8226 字符报错及空值传递)
function isMaskedKey(key) {
  if (!key || typeof key !== 'string') return true;
  const trimmed = key.trim();
  if (!trimmed) return true;
  if (trimmed.includes('\u2022') || trimmed.includes('•')) return true;
  if (trimmed.includes('••••') || trimmed.includes('....') || trimmed.includes('****') || trimmed.includes('????')) return true;
  if (/^[•\.\*\?]{3,}/.test(trimmed)) return true;
  return false;
}

// 自动还原真实 API Key: 若传入的是脱敏掩码，则从服务端持久化存储 settings.json 中安全提取真实 Key
function resolveRealApiKey(inputKey, type, provider) {
  if (inputKey && !isMaskedKey(inputKey)) {
    return inputKey.trim();
  }
  const settings = readJson(SETTINGS_FILE, {});
  const section = settings[type];
  if (!section) return '';

  // 1. 优先从特定平台的存档获取
  if (provider && section.providers?.[provider]?.apiKey && !isMaskedKey(section.providers[provider].apiKey)) {
    return section.providers[provider].apiKey.trim();
  }
  // 2. 从该类型顶层获取
  if (section.apiKey && !isMaskedKey(section.apiKey)) {
    return section.apiKey.trim();
  }
  // 3. 兜底轮询各 providers 中的可用 Key
  if (section.providers) {
    for (const p in section.providers) {
      const k = section.providers[p]?.apiKey;
      if (k && !isMaskedKey(k)) {
        return k.trim();
      }
    }
  }
  return '';
}

// 帮助读取 POST 请求的 JSON Body
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) { // 20MB 限制
        req.destroy();
        reject(new Error('Request payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Windows 下安全打开文件夹（采用 UTF-16LE Base64 EncodedCommand，彻底解决路径中含中文、空格等字符集乱码导致不响应的问题）
function openFolderInWindows(folderPath) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const norm = path.normalize(folderPath);
    const psScript = `Invoke-Item -LiteralPath '${norm.replace(/'/g, "''")}'`;
    const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell.exe -NoProfile -EncodedCommand ${b64}`, (err) => {
      if (err) {
        exec(`cmd.exe /c start "" "${norm}"`, (err2) => {
          if (err2) exec(`explorer.exe "${norm}"`, () => resolve(true));
          else resolve(true);
        });
      } else {
        resolve(true);
      }
    });
  });
}

// Windows 原生文件夹选择弹窗
function selectFolderInWindows(initialPath = '') {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    const norm = initialPath ? path.normalize(initialPath) : '';
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = '形色 - 请选择图片保存目录'
$dialog.ShowNewFolderButton = $true
if ('${norm.replace(/'/g, "''")}') {
    $dialog.SelectedPath = '${norm.replace(/'/g, "''")}'
}
$topForm = New-Object System.Windows.Forms.Form
$topForm.TopMost = $true
$res = $dialog.ShowDialog($topForm)
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
}
`;
    const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell.exe -NoProfile -EncodedCommand ${b64}`, (err, stdout) => {
      if (err) {
        resolve('');
      } else {
        resolve((stdout || '').trim());
      }
    });
  });
}

// MIME 映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const reqHost = req.headers.host || `127.0.0.1:${PORT}`;
  const reqUrl = new URL(req.url, `http://${reqHost}`);
  const pathname = reqUrl.pathname;

  // 安全 CORS 支持 (仅允许本地域、127.0.0.1、localhost 及 Tauri 原生协议)
  const origin = req.headers.origin;
  if (!origin || origin.includes('127.0.0.1') || origin.includes('localhost') || origin.startsWith('tauri://')) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else {
    // 拦截未经授权的非本地外部网页跨域探测
    if (req.method === 'OPTIONS') {
      res.writeHead(403);
      res.end();
      return;
    }
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 路由分发
  if (pathname.startsWith('/api/')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      // 1. 获取完整选项数据（合并预设与自定义）
      if (pathname === '/api/options' && req.method === 'GET') {
        const defaultData = readJson(DEFAULT_OPTIONS_FILE, { groups: [] });
        const customData = readJson(CUSTOM_OPTIONS_FILE, {});

        // 把 customOptions 合并进每个 field
        const mergedGroups = defaultData.groups.map(group => {
          return {
            ...group,
            fields: group.fields.map(field => {
              const customList = customData[field.id] || [];
              return {
                ...field,
                customOptions: customList
              };
            })
          };
        });

        res.writeHead(200);
        res.end(JSON.stringify({
          version: defaultData.version || '0.62.7',
          groups: mergedGroups,
          customOptionsMap: customData
        }));
        return;
      }

      // 2. 自定义选项操作 (添加/删除)
      if (pathname === '/api/custom-options' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { fieldId, optionName } = body;
        if (!fieldId || !optionName || !optionName.trim()) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'fieldId and optionName are required' }));
          return;
        }

        const customData = readJson(CUSTOM_OPTIONS_FILE, {});
        if (!customData[fieldId]) customData[fieldId] = [];
        
        const cleanName = optionName.trim();
        if (!customData[fieldId].includes(cleanName)) {
          customData[fieldId].push(cleanName);
          writeJson(CUSTOM_OPTIONS_FILE, customData);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, customOptions: customData[fieldId] }));
        return;
      }

      if (pathname === '/api/custom-options' && req.method === 'DELETE') {
        const body = await parseRequestBody(req);
        const { fieldId, optionName } = body;
        if (!fieldId || !optionName) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'fieldId and optionName are required' }));
          return;
        }

        const customData = readJson(CUSTOM_OPTIONS_FILE, {});
        if (customData[fieldId]) {
          customData[fieldId] = customData[fieldId].filter(item => item !== optionName);
          writeJson(CUSTOM_OPTIONS_FILE, customData);
        }

        res.writeHead(200);
        res.end(JSON.stringify({ success: true, customOptions: customData[fieldId] || [] }));
        return;
      }

      // 3. API 设置配置 (安全脱敏输出 & 深度合并存盘)
      if (pathname === '/api/settings' && req.method === 'GET') {
        const settings = readJson(SETTINGS_FILE, {});
        if (!settings.savePath) {
          settings.savePath = path.join(__dirname, 'outputs');
        }

        const sanitized = JSON.parse(JSON.stringify(settings));
        function maskKey(k) {
          if (!k || typeof k !== 'string') return '';
          if (k.length <= 6) return '••••••';
          return '••••••••' + k.slice(-4);
        }

        if (sanitized.llm) {
          sanitized.llm.hasApiKey = !!sanitized.llm.apiKey;
          sanitized.llm.apiKey = maskKey(sanitized.llm.apiKey);
          if (sanitized.llm.providers) {
            for (const p in sanitized.llm.providers) {
              if (sanitized.llm.providers[p]) {
                sanitized.llm.providers[p].hasApiKey = !!sanitized.llm.providers[p].apiKey;
                sanitized.llm.providers[p].apiKey = maskKey(sanitized.llm.providers[p].apiKey);
              }
            }
          }
        }

        if (sanitized.imageGen) {
          sanitized.imageGen.hasApiKey = !!sanitized.imageGen.apiKey;
          sanitized.imageGen.apiKey = maskKey(sanitized.imageGen.apiKey);
          if (sanitized.imageGen.providers) {
            for (const p in sanitized.imageGen.providers) {
              if (sanitized.imageGen.providers[p]) {
                sanitized.imageGen.providers[p].hasApiKey = !!sanitized.imageGen.providers[p].apiKey;
                sanitized.imageGen.providers[p].apiKey = maskKey(sanitized.imageGen.providers[p].apiKey);
              }
            }
          }
        }

        res.writeHead(200);
        res.end(JSON.stringify(sanitized));
        return;
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const currentSettings = readJson(SETTINGS_FILE, {});

        function unmaskKey(newVal, oldVal) {
          if (!newVal || typeof newVal !== 'string') return oldVal || '';
          if (isMaskedKey(newVal)) return oldVal || '';
          return newVal.trim();
        }

        // 深度合并设置，保护已有凭证不被漏发字段或脱敏占位符抹除
        const merged = {
          ...currentSettings,
          ...body,
          llm: {
            ...(currentSettings.llm || {}),
            ...(body.llm || {}),
            apiKey: unmaskKey(body.llm?.apiKey, currentSettings.llm?.apiKey),
            providers: {
              ...(currentSettings.llm?.providers || {})
            }
          },
          imageGen: {
            ...(currentSettings.imageGen || {}),
            ...(body.imageGen || {}),
            apiKey: unmaskKey(body.imageGen?.apiKey, currentSettings.imageGen?.apiKey),
            providers: {
              ...(currentSettings.imageGen?.providers || {})
            }
          }
        };

        // 合并 providers 里的各平台 API Key
        if (body.llm?.providers) {
          for (const p in body.llm.providers) {
            const oldP = currentSettings.llm?.providers?.[p] || {};
            const newP = body.llm.providers[p] || {};
            merged.llm.providers[p] = {
              ...oldP,
              ...newP,
              apiKey: unmaskKey(newP.apiKey, oldP.apiKey)
            };
          }
        }

        if (body.imageGen?.providers) {
          for (const p in body.imageGen.providers) {
            const oldP = currentSettings.imageGen?.providers?.[p] || {};
            const newP = body.imageGen.providers[p] || {};
            merged.imageGen.providers[p] = {
              ...oldP,
              ...newP,
              apiKey: unmaskKey(newP.apiKey, oldP.apiKey)
            };
          }
        }

        if (merged.savePath) {
          try {
            const dir = path.isAbsolute(merged.savePath) ? merged.savePath : path.resolve(__dirname, merged.savePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          } catch (e) {
            console.warn('Create savePath failed:', e.message);
          }
        }

        writeJson(SETTINGS_FILE, merged);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Settings saved' }));
        return;
      }

      // 4. 预设方案管理
      if (pathname === '/api/presets' && req.method === 'GET') {
        const presets = readJson(PRESETS_FILE, []);
        res.writeHead(200);
        res.end(JSON.stringify(presets));
        return;
      }

      if (pathname === '/api/presets' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const presets = readJson(PRESETS_FILE, []);
        const newPreset = {
          id: 'preset_' + Date.now(),
          name: body.name || '未命名预设',
          createdAt: new Date().toISOString(),
          selections: body.selections || {},
          locks: body.locks || {}
        };
        presets.unshift(newPreset);
        writeJson(PRESETS_FILE, presets);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, preset: newPreset }));
        return;
      }

      if (pathname === '/api/presets' && req.method === 'DELETE') {
        const body = await parseRequestBody(req);
        let presets = readJson(PRESETS_FILE, []);
        presets = presets.filter(p => p.id !== body.id);
        writeJson(PRESETS_FILE, presets);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // 5. 历史记录管理
      if (pathname === '/api/history' && req.method === 'GET') {
        const history = readJson(HISTORY_FILE, []);
        // 自动补充与校验证本地图片可用性
        const enriched = history.map(item => {
          let hasLocal = false;
          let localUrl = '';
          if (item.savedPath && fs.existsSync(item.savedPath)) {
            hasLocal = true;
            localUrl = `/api/image-file?path=${encodeURIComponent(item.savedPath)}`;
          } else if (item.savedFile) {
            const defaultPath = path.join(__dirname, 'outputs', item.savedFile);
            if (fs.existsSync(defaultPath)) {
              hasLocal = true;
              localUrl = `/outputs/${encodeURIComponent(item.savedFile)}`;
            }
          }
          return {
            ...item,
            hasLocalFile: hasLocal,
            localUrl: localUrl || item.localUrl || '',
            // 优先使用本地文件链接，防止远程图床失效
            displayUrl: (hasLocal && localUrl) ? localUrl : (item.imageUrl || '')
          };
        });
        res.writeHead(200);
        res.end(JSON.stringify(enriched));
        return;
      }

      if (pathname === '/api/history' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const history = readJson(HISTORY_FILE, []);
        const rawTitle = (body.title || '摄影作品').replace(/[\\/:*?"<>|]/g, '_').trim();
        
        let imgUrl = body.imageUrl || '';
        const localUrl = body.savedPath ? `/api/image-file?path=${encodeURIComponent(body.savedPath)}` : (body.savedFile ? `/outputs/${encodeURIComponent(body.savedFile)}` : '');
        // 关键防护：如果已本地存盘且是 Base64 数据，强制使用本地 URL 替换，绝不把数兆 Base64 塞进 history.json 引起爆仓
        if (imgUrl.startsWith('data:image/') && localUrl) {
          imgUrl = localUrl;
        }

        const record = {
          id: body.id || ('hist_' + Date.now()),
          timestamp: body.timestamp || new Date().toISOString(),
          title: rawTitle,
          actualPrompt: body.actualPrompt || body.prompt || body.promptZh || body.promptEn || '',
          promptZh: body.promptZh || '',
          promptEn: body.promptEn || '',
          imageUrl: imgUrl,
          savedSuccess: !!body.savedSuccess,
          savedFile: body.savedFile || '',
          savedPath: body.savedPath || '',
          localUrl: localUrl,
          provider: body.provider || 'custom',
          model: body.model || '',
          size: body.size || '1024x1024',
          aspectRatio: body.aspectRatio || '',
          selections: body.selections || {},
          locks: body.locks || {}
        };
        history.unshift(record);
        if (history.length > 100) history.pop(); // 保持最近100条
        writeJson(HISTORY_FILE, history);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, record }));
        return;
      }

      if (pathname === '/api/history' && req.method === 'DELETE') {
        const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
        const idToDelete = urlObj.searchParams.get('id');
        const clearAll = urlObj.searchParams.get('all') === 'true';

        let history = readJson(HISTORY_FILE, []);
        if (clearAll) {
          history = [];
        } else if (idToDelete) {
          history = history.filter(item => String(item.id) !== String(idToDelete));
        } else {
          try {
            const body = await parseRequestBody(req);
            if (body.all) {
              history = [];
            } else if (body.id) {
              history = history.filter(item => String(item.id) !== String(body.id));
            }
          } catch (e) {}
        }

        writeJson(HISTORY_FILE, history);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, count: history.length }));
        return;
      }

// 尺寸格式化器：根据不同生图平台规范化宽高格式
function formatImageResolution(sizeStr, provider, model) {
  const norm = (sizeStr || '1024x1024').toLowerCase().replace('*', 'x');
  const [wStr, hStr] = norm.split('x');
  const w = parseInt(wStr, 10) || 1024;
  const h = parseInt(hStr, 10) || 1024;
  const ratio = w / h;

  // 1. 阿里云百炼 (通义千问生图 Qwen-Image 与 万相 Wanx 系列)
  const isDashScope = provider === 'dashscope' ||
    (model && (model.toLowerCase().includes('qwen-image') || model.toLowerCase().startsWith('wanx')));
  if (isDashScope) {
    if (ratio >= 1.6) return '1280*720';        // 16:9
    if (ratio >= 1.4) return '1248*832';        // 3:2
    if (ratio >= 1.2) return '1280*960';        // 4:3
    if (ratio <= 0.6) return '720*1280';        // 9:16
    if (ratio <= 0.7) return '832*1248';        // 2:3
    if (ratio <= 0.85) return '960*1280';       // 3:4
    return '1024*1024';                         // 1:1
  }

  // 2. 智谱 AI (CogView 系列)
  if (provider === 'zhipu' || (model && model.toLowerCase().startsWith('cogview'))) {
    if (ratio >= 1.6) return '1344x768';
    if (ratio >= 1.2) return '1152x864';
    if (ratio <= 0.6) return '768x1344';
    if (ratio <= 0.85) return '864x1152';
    return '1024x1024';
  }

  // 3. OpenAI DALL-E 3
  if (model && model.toLowerCase().includes('dall-e-3')) {
    if (ratio >= 1.3) return '1792x1024';
    if (ratio <= 0.77) return '1024x1792';
    return '1024x1024';
  }

  // 4. 硅基流动或其他标准 OpenAI 兼容
  return norm;
}

// 阿里云百炼 (DashScope) 智能生图分流调度:
// 1. Qwen-Image 系列 (qwen-image-3.0, qwen-image-3.0-pro 等) 走百炼多模态生成通道 /api/v1/services/aigc/multimodal-generation/generation
// 2. 通义万相系列 (wanx2.1-t2i-turbo, wanx2.1-t2i-plus 等) 走百炼原生异步任务服务 /api/v1/services/aigc/text2image/image-synthesis
async function callDashScopeImageTask({ apiKey, model, prompt, size }) {
  const targetModel = model || 'qwen-image-3.0';
  const isQwenImage = targetModel.toLowerCase().includes('qwen-image');

  // A. Qwen-Image 系列模型：百炼官方标准多模态生图接口
  if (isQwenImage) {
    const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
    const cleanSize = formatImageResolution(size, 'dashscope', targetModel);

    const submitRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        input: {
          messages: [
            {
              role: 'user',
              content: [{ text: prompt }]
            }
          ]
        },
        parameters: {
          size: cleanSize,
          n: 1
        }
      })
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`百炼千问生图请求失败 (HTTP ${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json();
    const imgUrl = submitData.output?.choices?.[0]?.message?.content?.[0]?.image || submitData.data?.[0]?.url || '';
    if (!imgUrl) {
      throw new Error(`百炼千问未返回有效图片链接: ${JSON.stringify(submitData)}`);
    }
    return {
      imageUrl: imgUrl,
      raw: submitData
    };
  }

  // B. 通义万相 Wanx 系列模型：原生异步任务队列与轮询
  const formattedSize = formatImageResolution(size, 'dashscope', targetModel);
  const endpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis';

  const bodyPayload = {
    model: targetModel,
    input: {
      prompt: prompt
    },
    parameters: {
      size: formattedSize,
      n: 1
    }
  };

  const submitRes = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-DashScope-Async': 'enable'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`百炼万相生图任务提交失败 (HTTP ${submitRes.status}): ${errText}`);
  }

  const submitData = await submitRes.json();
  const taskId = submitData.output?.task_id;
  if (!taskId) {
    throw new Error(`百炼未返回任务 ID: ${JSON.stringify(submitData)}`);
  }

  // 轮询任务状态 (每 1.5 秒查询一次，最长等待 120 秒)
  const pollUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  const startTime = Date.now();
  const maxWaitMs = 120000;

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 1500));
    const taskRes = await fetch(pollUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!taskRes.ok) {
      const errText = await taskRes.text();
      throw new Error(`百炼查询任务状态失败 (HTTP ${taskRes.status}): ${errText}`);
    }

    const taskData = await taskRes.json();
    const status = taskData.output?.task_status;

    if (status === 'SUCCEEDED') {
      const results = taskData.output?.results || [];
      const imgUrl = results[0]?.url;
      if (!imgUrl) {
        throw new Error('百炼生图任务成功但未包含图片链接');
      }
      return {
        imageUrl: imgUrl,
        raw: taskData
      };
    } else if (status === 'FAILED') {
      const errMsg = taskData.output?.message || taskData.output?.code || '生图任务执行失败';
      throw new Error(`阿里云百炼生图失败: ${errMsg}`);
    } else if (status === 'CANCELED') {
      throw new Error('百炼生图任务已取消');
    }
  }

  throw new Error('阿里云百炼生图任务超时 (已等待120秒)');
}

      // 7.3 LLM 提示词生成服务 (支持中文/英文 原生摄影导演撰写，非机翻)
      if (pathname === '/api/llm/generate' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { prompt, config, lang = 'zh' } = body;
        const cfg = config || readJson(SETTINGS_FILE, {}).llm || {};
        const baseUrl = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
        const provider = cfg.provider || 'deepseek';
        const apiKey = resolveRealApiKey(cfg.apiKey, 'llm', provider);
        const model = cfg.model || 'deepseek-chat';
        const temp = typeof cfg.temperature === 'number' ? cfg.temperature : 1;
        let maxTokens = cfg.maxTokens || 4096;
        if (model.includes('reasoner') || model.includes('r1')) {
          maxTokens = Math.max(maxTokens, 8192);
        } else {
          maxTokens = Math.max(maxTokens, 4096);
        }

        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '未配置 LLM API Key，请在设置中填写' }));
          return;
        }

        // 识别目标生图模型的类型规范 (Engine Profiler: 区分千问、FLUX/SD、GPT/MJ)
        const targetModel = (body.targetModel || cfg.targetModel || readJson(SETTINGS_FILE, {}).imageGen?.model || '').toLowerCase();
        const targetProvider = (body.targetProvider || cfg.targetProvider || readJson(SETTINGS_FILE, {}).imageGen?.provider || '').toLowerCase();

        let engineType = 'gpt_mj';
        if (targetModel.includes('qwen-image') || targetModel.startsWith('wanx') || targetProvider === 'dashscope') {
          engineType = 'dashscope_qwen';
        } else if (targetModel.includes('flux') || targetModel.includes('sd') || targetModel.includes('stable-diffusion') || targetProvider === 'siliconflow') {
          engineType = 'flux_sd';
        }

        const isEnglish = (lang === 'en');
        const systemPrompt = isEnglish
          ? `You are a world-renowned master fashion and fine-art portrait photography director, celebrated for extraordinary command of natural lighting optics, textural realism, tactile spatial depth, and evocative character emotion.
Your mission is to formulate an independent, cohesive, and deeply detailed professional English photography prompt for adult female portraits, optimized directly for modern high-end image diffusion models (such as FLUX, Midjourney v6, SDXL, and Qwen-Image-3.0).

[CORE PHOTOGRAPHIC DIRECTIVES]:
1. Mandatory Adherence to User Locked Anchors:
All user-specified locked attributes (formatted as [Group · Field = Value]) are absolute golden constraints. You must 100% strictly incorporate, preserve, and emphasize them in the scene. Never ignore, modify, or omit any locked item.
2. Harmonic Composition & Negative Space:
For all unlocked dimensions, freely curate and harmonize facial bone structure, weight distribution, authentic points of physical contact, spatial depth, atmospheric lighting temperature, and prime lens optics.
3. Strict Wardrobe Architecture & Fabric Physics:
Faithfully depict garment construction (e.g. separate upper/lower or one-piece), textile weaves (fine-gauge silk, raw linen, ribbed cotton, matte satin, sheer lace), natural gravitational drape, and seam tension.
4. Physical Realism & Anatomical Grounding:
The subject's pose must have credible physical weight and balance against contact surfaces (chair back, table edge, armrest, floor).
5. Absolute Optical Skin Realism (Banish All Plastic/CG/Wax Doll Artifacts):
Direct the visual rendering to achieve the authentic optical fidelity of flagship medium-format cameras (e.g., Hasselblad H6D-100c or Sony A7R V with 85mm f/1.4 prime lens at wide aperture):
- Micro-pore epidermal texture, soft translucent subsurface scattering (SSS) along earlobes, jawline, and collarbones.
- Delicate peach fuzz (vellus hair) glowing softly in backlight/rim light, natural sebaceous sheen without oily plastic sheen, authentic subtle capillaries and natural micro-freckles.
- True-to-life shadows and skin fold contours with natural skin warmth and photographic dynamic range.
6. Unique Naming & Creative Divergence:
If previous titles or styles are mentioned, introduce creative divergence in lighting, mood, and pose, and craft a distinct English title.
7. Engine-Targeted Syntax Profile (${engineType === 'dashscope_qwen' ? 'Qwen-Image / Wanx Concrete Visual Graph' : (engineType === 'flux_sd' ? 'FLUX / SD Factual Parametric Directives' : 'GPT / Midjourney Cinematic Fluid Narrative')}):
${engineType === 'dashscope_qwen' ? '- Target Engine: Qwen-Image / Wanx. Structure the prompt as an orderly, layered visual graph: framing -> explicit facial bone structure & features -> zoned wardrobe textile physics -> mechanical weight bearing -> physical lighting angles and Kelvin temperature. Avoid vague poetic metaphors; specify concrete physical anchors.' : (engineType === 'flux_sd' ? '- Target Engine: FLUX / SD. Emphasize factual photographic parameters, optical primes, textile weaves, and anatomical realism with zero decorative fluff.' : '- Target Engine: GPT / Midjourney. Weave mood, posture, fabric drape, and lighting into a cohesive, fluid cinematic narrative prose.')}

[REQUIRED OUTPUT FORMAT] (Strictly output these two sections with exact headers, no conversational filler):
【作品企划标题】
(A poetic 3 to 7 word photography collection title in English, e.g., "Morning Light on Raw Silk", "Solitude in Amber Hour", "Gilded Shadows", "Symphony of Dusk")

【摄影提示词】
(A cohesive, richly detailed 200-350 word professional English photography prompt composed in native cinematographic and photographic terminology, ready for direct image generation)`
          : `你是一位享誉国际的专业时尚与女性写真摄影导演，拥有敏锐的光影审美、空间构图感知力与镜头语言表现力。
你的任务是根据用户提供的摄影需求和条件，设计独立完整的中文成年女性专业摄影提示词。

【形色摄影导演核心工作铁律】：
1. 锁定条件保留（绝对硬性约束）：
   用户指定的所有锁定条件（格式如「分组·字段名＝值」）为铁律，你必须100%严格保留、贯彻并在画面中重点呈现，绝对不得擅自篡改、削弱或丢弃。
2. 留白美学与空间平衡：
   未锁定的维度交由你作为摄影导演自由搭配，协调人物骨相五官、动作主辅支点受力与重心平衡、空间纵深、现场照明光位色温及镜头视角焦段。
3. 服装分区严谨：
   严格根据服装形式（上下装 vs 一体装）协调各层衣片、面料织物纤维质感、剪裁褶皱与垂坠感，停用分区的字段绝对不混入画面。
4. 物理承重与空间接触：
   模特姿态必须明确主辅支点（椅背、桌沿、地面等），身体与物体接触有真实物理受力形变，严禁悬空穿模。
5. 七维近期去重与全新命名：
   若用户附带了近期方案特征或当前片名，请确保本次方案在「人物骨相五官、服装搭配、动作支撑、构图关系、机位焦段、光影调性、情绪张力」中至少有4个可变维度产生显著新颖变化，且必须赋予一个全新的意境片名，拒绝同脸模板与同质化套路。
6. 极致人物质感与皮肤光学真实度（核心灵魂·彻底告别塑料磨皮假感）：
   画面必须以顶级单反相机（如哈苏中画幅/索尼A7R5 + 85mm f/1.4 原生实拍光圈）的光学质感为准绳，严禁塑料硅胶假人感、千篇一律滤镜脸与廉价CG磨皮：
   提示词中必须重点细腻描绘原生皮肤的真实微观光学特征——逆光侧光下通透细腻的原生微绒、真实皮脂微光漫反射、鼻翼与眼周细微真实的毛细血管与原生肤色起伏、锁骨与肩颈真实自然的骨肉阴影、呼吸起伏的毛孔肌理与微汗光泽，呈现充满生命力的顶级电影胶片与 RAW 格式直出质感。
7. 生图模型靶向语法规范 (${engineType === 'dashscope_qwen' ? '通义千问 / 万相物理具象图谱' : (engineType === 'flux_sd' ? 'FLUX / SD 事实型摄影参数' : 'GPT / Midjourney 电影级流动叙事')}):
${engineType === 'dashscope_qwen' ? '   - 【当前目标：通义千问 / 万相 (Qwen-Image / Wanx)】：该模型对物理具象与结构分层极度敏感，对模糊抽象比喻易钝化退化成均值脸。必须严格采用分层图谱组织：①画幅机位 -> ②人物面部骨骼走向与清晰线条显式锚定（杜绝留白给底模自由发挥成大众脸） -> ③服饰微观织法与垂坠张力（精细分区） -> ④肢体物理承重受力 -> ⑤冷暖光比与光学景深。语言直击物理实体，杜绝空洞抒情。' : (engineType === 'flux_sd' ? '   - 【当前目标：FLUX.1 / SD 3.5】：采用高密度客观参数描述，剔除冗余文学修饰，聚焦骨骼结构走向、面料织物全称、机身焦段光圈参数及自然漫反射。' : '   - 【当前目标：GPT-Image / Midjourney】：采用流动性、画面感极强的专业摄影长叙事体，将人物情绪、骨相气质、服饰褶皱与现场环境光影无缝交织为一段富有张力的大片镜头。')}

请严格按以下两段格式输出，不要输出任何多余的客套前言寒暄：
【作品企划标题】
(必填！拟定4-8字简洁利落、具有高级光影意境的摄影片名，如《晨光与真丝》、《微澜暮色》、《影落朱弦》，严禁省略，严禁复用旧片名)

【摄影提示词】
(300-500字独立完整的专业级摄影提示词，细节详实生动，语言流畅，可供生图模型直接出图)`;

        try {
          const llmRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model,
              temperature: temp,
              max_tokens: maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ]
            })
          });

          if (!llmRes.ok) {
            const errText = await llmRes.text();
            res.writeHead(llmRes.status);
            res.end(JSON.stringify({ error: `大模型请求失败 (${llmRes.status}): ${errText}` }));
            return;
          }

          const data = await llmRes.json();
          const choice = data.choices?.[0];
          const content = choice?.message?.content || '';
          const finishReason = choice?.finish_reason;
          res.writeHead(200);
          res.end(JSON.stringify({ success: true, content, prompt: content, finishReason }));
          return;
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: `大模型连接异常: ${err.message}` }));
          return;
        }
      }

      // 7.4 LLM 连通性测试
      if (pathname === '/api/llm/test' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { baseUrl, apiKey: rawApiKey, model, provider } = body;
        const cleanBaseUrl = (baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
        const apiKey = resolveRealApiKey(rawApiKey, 'llm', provider || 'deepseek');
        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '请填写 LLM API Key' }));
          return;
        }
        try {
          const testRes = await fetch(`${cleanBaseUrl}/models`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (testRes.ok) {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: `LLM 接口握手成功！模型可用: ${model || 'deepseek-chat'}` }));
            return;
          } else {
            // 某些中转不支持 /models，尝试一次极小的 completion
            const chatRes = await fetch(`${cleanBaseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: model || 'deepseek-chat',
                max_tokens: 5,
                messages: [{ role: 'user', content: 'hi' }]
              })
            });
            if (chatRes.ok) {
              res.writeHead(200);
              res.end(JSON.stringify({ success: true, message: `LLM 接口握手成功！模型可用: ${model || 'deepseek-chat'}` }));
              return;
            }
            const errText = await chatRes.text();
            res.writeHead(chatRes.status);
            res.end(JSON.stringify({ error: `LLM 连通测试失败 (${chatRes.status}): ${errText}` }));
            return;
          }
        } catch (e) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: `LLM 连通异常: ${e.message}` }));
          return;
        }
      }

      // 7.5 生图 API 连通性测试 (优先零费用握手检测)
      if (pathname === '/api/image/test' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { baseUrl, apiKey: rawApiKey, model, mode, provider } = body;
        const cleanBaseUrl = (baseUrl || '').replace(/\/+$/, '');
        const isDash = provider === 'dashscope' || cleanBaseUrl.includes('dashscope') || (model && (model.toLowerCase().includes('qwen-image') || model.toLowerCase().startsWith('wanx')));
        const targetProvider = provider || (isDash ? 'dashscope' : (cleanBaseUrl.includes('siliconflow') ? 'siliconflow' : (cleanBaseUrl.includes('bigmodel') ? 'zhipu' : 'custom')));
        const apiKey = resolveRealApiKey(rawApiKey, 'imageGen', targetProvider);

        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '请填写 API Key' }));
          return;
        }

        const startTime = Date.now();

        // 零费用握手检测
        if (mode !== 'real_generate') {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // 1. 阿里云百炼官方端点检测
            if (isDash) {
              let testUrl = 'https://dashscope.aliyuncs.com/api/v1/tasks?page_no=1&page_size=1';
              if (cleanBaseUrl.includes('compatible-mode')) {
                testUrl = `${cleanBaseUrl}/models`;
              }

              const response = await fetch(testUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` },
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              const elapsedMs = Date.now() - startTime;

              if (response.ok) {
                res.writeHead(200);
                res.end(JSON.stringify({
                  success: true,
                  zeroCost: true,
                  elapsedMs,
                  model,
                  message: `阿里云百炼 (${model || 'Qwen-Image-3.0'}) 接口握手成功！(零费用验证 API Key 有效，未产生计费)`
                }));
                return;
              } else {
                const errText = await response.text();
                res.writeHead(response.status);
                res.end(JSON.stringify({ error: `百炼 API Key 验证未通过 (HTTP ${response.status}): ${errText}`, elapsedMs }));
                return;
              }
            }

            // 2. 硅基流动 / 智谱 / OpenAI / 通用兼容端点检测
            let testUrl = `${cleanBaseUrl}/models`;
            const response = await fetch(testUrl, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${apiKey}` },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const elapsedMs = Date.now() - startTime;
            if (response.ok) {
              res.writeHead(200);
              res.end(JSON.stringify({
                success: true,
                zeroCost: true,
                elapsedMs,
                model,
                message: `生图接口握手成功！(通过 /models 端点完成零费用检测，未产生计费)`
              }));
              return;
            } else if (response.status === 404 || response.status === 405) {
              res.writeHead(200);
              res.end(JSON.stringify({
                success: false,
                needRealTest: true,
                status: response.status,
                elapsedMs,
                message: '供应商中转网关未开放 /models 零费用查询端点。如需验证连通性，可勾选下方「真实生图测试(会生成一张测试图并产生费用)」。'
              }));
              return;
            } else {
              const errText = await response.text();
              res.writeHead(response.status);
              res.end(JSON.stringify({ error: `HTTP ${response.status}: ${errText}`, elapsedMs }));
              return;
            }
          } catch (err) {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: false,
              needRealTest: true,
              error: err.message,
              message: `零费用握手未通 (${err.message})。若该网关只支持出图端点，可勾选「真实生图测试」重试。`
            }));
            return;
          }
        }

        // 真实生图测试 (产生费用)
        try {
          const testPrompt = 'a minimalist photographic still life of a white ceramic vase with single branch, cinematic soft morning lighting, 8k resolution';
          let imageUrl = '';

          if (isDash) {
            const dashRes = await callDashScopeImageTask({
              apiKey,
              model: model || 'qwen-image-3.0',
              prompt: testPrompt,
              size: '1024*1024'
            });
            imageUrl = dashRes.imageUrl;
          } else {
            const testPayload = {
              model: model || 'gpt-image-2.5-low',
              prompt: testPrompt,
              n: 1
            };
            if (targetProvider === 'siliconflow' || cleanBaseUrl.includes('siliconflow')) {
              testPayload.image_size = '1024x1024';
            } else {
              testPayload.size = formatImageResolution('1024x1024', targetProvider, model);
            }

            const response = await fetch(`${cleanBaseUrl}/images/generations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify(testPayload)
            });

            if (!response.ok) {
              const errText = await response.text();
              res.writeHead(response.status);
              res.end(JSON.stringify({ error: `真实生图测试失败 (HTTP ${response.status}): ${errText}`, elapsedMs: Date.now() - startTime }));
              return;
            }

            const data = await response.json();
            if (data.data && data.data.length > 0) {
              imageUrl = data.data[0].url || (data.data[0].b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
            } else if (data.images && data.images.length > 0) {
              imageUrl = data.images[0].url || (data.images[0].b64_json ? `data:image/png;base64,${data.images[0].b64_json}` : '');
            }
          }

          const elapsedMs = Date.now() - startTime;
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            zeroCost: false,
            elapsedMs,
            model,
            hasImage: !!imageUrl,
            imageUrl,
            message: `真实生图测试成功！已生成测试图片 (耗时: ${elapsedMs}ms)`
          }));
          return;
        } catch (fetchErr) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: fetchErr.message, elapsedMs: Date.now() - startTime }));
          return;
        }
      }

      // 8. 生图 API 正式生成
      if (pathname === '/api/image/generate' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const settings = readJson(SETTINGS_FILE, {});
        const imgConfig = body.config || settings.imageGen || {};

        const provider = imgConfig.provider || 'custom';
        const baseUrl = (imgConfig.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
        const apiKey = resolveRealApiKey(imgConfig.apiKey, 'imageGen', provider);
        const model = imgConfig.model || 'qwen-image-3.0';
        const prompt = body.prompt;
        const size = body.size || '1024x1024';

        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '请在 API 配置面板中填写图片生成模型的 API Key' }));
          return;
        }

        const startTime = Date.now();
        let elapsedMs = 0;
        let data = null;
        let imageUrl = '';

        const isDash = provider === 'dashscope' || baseUrl.includes('dashscope.aliyuncs.com') || (model && (model.toLowerCase().includes('qwen-image') || model.toLowerCase().startsWith('wanx')));

        if (isDash) {
          // 阿里云百炼千问生图与通义万相异步任务生图
          const dashRes = await callDashScopeImageTask({
            apiKey,
            model: model || 'qwen-image-3.0',
            prompt: prompt,
            size: size
          });
          imageUrl = dashRes.imageUrl;
          data = dashRes.raw;
          elapsedMs = Date.now() - startTime;
        } else {
          // 标准 OpenAI 兼容生图
          const targetUrl = `${baseUrl}/images/generations`;
          const requestPayload = {
            model: model,
            prompt: prompt,
            n: 1
          };

          if (provider === 'siliconflow' || baseUrl.includes('siliconflow')) {
            requestPayload.image_size = formatImageResolution(size, 'siliconflow', model);
          } else {
            requestPayload.size = formatImageResolution(size, provider, model);
          }

          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestPayload)
          });

          elapsedMs = Date.now() - startTime;
          if (!response.ok) {
            const errText = await response.text();
            res.writeHead(response.status);
            res.end(JSON.stringify({ error: `生图 API 请求失败 (${response.status}): ${errText}`, elapsedMs }));
            return;
          }

          data = await response.json();
          if (data.data && data.data.length > 0) {
            const item = data.data[0];
            imageUrl = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
          } else if (data.images && data.images.length > 0) {
            const item = data.images[0];
            imageUrl = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
          }
        }

        elapsedMs = Date.now() - startTime;

        if (!imageUrl) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: '接口未返回有效图片数据', rawResponse: data, elapsedMs }));
          return;
        }

        // 保存到本地磁盘逻辑
        const rawTitle = (body.title || '摄影作品').replace(/[\\/:*?"<>|]/g, '_').trim();
        const rawSavePath = settings.savePath || path.join(__dirname, 'outputs');
        const saveDir = path.isAbsolute(rawSavePath) ? rawSavePath : path.resolve(__dirname, rawSavePath);
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const fileName = `${rawTitle}_${dateStr}.png`;
        const localFilePath = path.join(saveDir, fileName);

        let savedSuccess = false;
        let savedError = null;

        try {
          if (imageUrl.startsWith('data:image/')) {
            const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(localFilePath, Buffer.from(base64Data, 'base64'));
          } else if (imageUrl.startsWith('http')) {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
            } else {
              savedError = `下载远程图片失败 (HTTP ${imgRes.status})`;
            }
          }
          if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
            savedSuccess = true;
          } else if (!savedError) {
            savedError = '写入文件失败：文件不存在或大小为0';
          }
        } catch (saveErr) {
          savedError = saveErr.message;
          console.warn('Auto save local image failed:', saveErr.message);
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          imageUrl,
          elapsedMs,
          model,
          prompt,
          title: rawTitle,
          savedSuccess,
          savedFile: savedSuccess ? fileName : null,
          savedPath: savedSuccess ? localFilePath : null,
          savedError: savedSuccess ? null : savedError,
          localUrl: savedSuccess ? `/api/image-file?path=${encodeURIComponent(localFilePath)}` : null
        }));
        return;
      }

      // 8.5 单独重新保存图片到本地
      if (pathname === '/api/image/save-local' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { imageUrl, title } = body;
        if (!imageUrl) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '缺少 imageUrl' }));
          return;
        }

        const settings = readJson(SETTINGS_FILE, {});
        const rawTitle = (title || '摄影作品').replace(/[\\/:*?"<>|]/g, '_').trim();
        const rawSavePath = settings.savePath || path.join(__dirname, 'outputs');
        const saveDir = path.isAbsolute(rawSavePath) ? rawSavePath : path.resolve(__dirname, rawSavePath);
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const fileName = `${rawTitle}_${dateStr}.png`;
        const localFilePath = path.join(saveDir, fileName);

        try {
          if (imageUrl.startsWith('data:image/')) {
            const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
            fs.writeFileSync(localFilePath, Buffer.from(base64Data, 'base64'));
          } else if (imageUrl.startsWith('http')) {
            const imgRes = await fetch(imageUrl);
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
            } else {
              throw new Error(`下载图片失败 (HTTP ${imgRes.status})`);
            }
          }
          if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).size > 0) {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              savedFile: fileName,
              savedPath: localFilePath,
              localUrl: `/api/image-file?path=${encodeURIComponent(localFilePath)}`
            }));
            return;
          } else {
            throw new Error('写入磁盘后文件校验失败');
          }
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
      }

      // 8.8 本地图片文件流服务 (带安全路径与扩展名白名单校验)
      if (pathname === '/api/image-file' && req.method === 'GET') {
        const filePath = reqUrl.searchParams.get('path');
        if (!filePath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'path is required' }));
          return;
        }

        try {
          const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.svg', '.ico'];
          const ext = path.extname(filePath).toLowerCase();
          if (!allowedExts.includes(ext)) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Forbidden file extension' }));
            return;
          }

          let targetPath = path.resolve(filePath);
          if (!fs.existsSync(targetPath)) {
            // 尝试在 outputs 相对目录下查找
            const fallbackPath = path.resolve(path.join(__dirname, 'outputs', path.basename(filePath)));
            if (fs.existsSync(fallbackPath)) {
              targetPath = fallbackPath;
            }
          }

          // 路径边界安全检查：只允许访问存储目录、outputs 以及 public 目录下的合法图片
          const settings = readJson(SETTINGS_FILE, {});
          const rawSavePath = settings.savePath || path.join(__dirname, 'outputs');
          const saveDirResolved = path.resolve(rawSavePath);
          const outputsResolved = path.resolve(__dirname, 'outputs');
          const publicResolved = path.resolve(PUBLIC_DIR);

          const isInsideAllowed = targetPath.startsWith(saveDirResolved) ||
                                  targetPath.startsWith(outputsResolved) ||
                                  targetPath.startsWith(publicResolved);

          if (!isInsideAllowed) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Access denied: Path outside allowed storage directories' }));
            return;
          }

          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            const mime = MIME_TYPES[ext] || 'image/png';
            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=86400'
            });
            fs.createReadStream(targetPath).pipe(res);
            return;
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Image file not found' }));
            return;
          }
        } catch (err) {
          if (!res.headersSent) res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
      }

      // 9. 打开本地输出文件夹 (支持 /api/open-folder 及 /api/system/open-folder，彻底解决前后端路径不一致与中文不响应)
      if ((pathname === '/api/open-folder' || pathname === '/api/system/open-folder') && req.method === 'POST') {
        const body = await parseRequestBody(req).catch(() => ({}));
        const settings = readJson(SETTINGS_FILE, {});
        const rawSavePath = body.folder || settings.savePath || path.join(__dirname, 'outputs');
        const folder = path.isAbsolute(rawSavePath) ? rawSavePath : path.resolve(__dirname, rawSavePath);
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

        const normFolder = path.normalize(folder);
        await openFolderInWindows(normFolder);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, folder: normFolder }));
        return;
      }

      // 9.5 弹窗选择本地保存目录 (支持 /api/select-folder 及 /api/system/select-folder)
      if ((pathname === '/api/select-folder' || pathname === '/api/system/select-folder') && req.method === 'POST') {
        const body = await parseRequestBody(req).catch(() => ({}));
        const settings = readJson(SETTINGS_FILE, {});
        const initPath = body.initialPath || settings.savePath || path.join(__dirname, 'outputs');
        const chosen = await selectFolderInWindows(initPath);
        res.writeHead(200);
        res.end(JSON.stringify({ success: !!chosen, path: chosen }));
        return;
      }

      // 未知 API
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint not found' }));
      return;
    } catch (err) {
      console.error('Server Internal Error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  // 静态输出目录 /outputs/* 直接服务支持
  if (pathname.startsWith('/outputs/')) {
    const settings = readJson(SETTINGS_FILE, {});
    const rawSavePath = settings.savePath || path.join(__dirname, 'outputs');
    const saveDir = path.isAbsolute(rawSavePath) ? rawSavePath : path.resolve(__dirname, rawSavePath);
    const fileName = path.basename(decodeURIComponent(pathname));
    const targetFile = path.join(saveDir, fileName);

    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const ext = path.extname(targetFile).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'image/png',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(targetFile).pipe(res);
      return;
    }
  }

  // 静态文件服务
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // 降级到 index.html (SPA)
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[XingSe Server] 端口 ${PORT} 已被占用，请先运行「关闭形色.bat」或更换端口`);
  } else {
    console.error('[XingSe Server] 监听异常:', err);
  }
});

process.on('uncaughtException', (err) => {
  console.error('[XingSe Server] 未捕获异常:', err);
});

// 安全绑定本地回路 127.0.0.1，拒绝外部未授权局域网访问
server.listen(PORT, '127.0.0.1', () => {
  console.log(`形色 XINGSE 控制台服务已就绪: http://127.0.0.1:${PORT}`);
});
