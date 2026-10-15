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
  const settings = readJson(SETTINGS_FILE, {});
  const section = settings[type];

  // 1. 若明确指定了 provider 且在该 provider 下配置了独立的真实 Key，绝对优先使用该渠道自身的有效 Key
  if (provider && section?.providers?.[provider]?.apiKey && !isMaskedKey(section.providers[provider].apiKey)) {
    const providerKey = section.providers[provider].apiKey.trim();
    if (!inputKey || isMaskedKey(inputKey) || inputKey === section?.apiKey) {
      return providerKey;
    }
  }

  // 2. 若用户直接传入了有效的非脱敏明文 Key
  if (inputKey && !isMaskedKey(inputKey)) {
    return inputKey.trim();
  }
  if (!section) return '';

  // 3. 从该类型顶层全局配置提取有效 Key
  if (section.apiKey && !isMaskedKey(section.apiKey)) {
    return section.apiKey.trim();
  }

  // 4. 兜底轮询各 providers 中的首个可用有效 Key
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

// 本地图片落盘保存工具函数 (合并 Base64 与 URL 抓取下载)
async function saveImageFileToDisk(imageUrl, localFilePath) {
  if (imageUrl.startsWith('data:image/')) {
    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(localFilePath, Buffer.from(base64Data, 'base64'));
  } else if (imageUrl.startsWith('http')) {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`下载远程图片失败 (HTTP ${imgRes.status})`);
    const arrayBuffer = await imgRes.arrayBuffer();
    fs.writeFileSync(localFilePath, Buffer.from(arrayBuffer));
  } else {
    throw new Error('不支持的图片数据格式');
  }
  if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size === 0) {
    throw new Error('写入文件失败：文件不存在或大小为0');
  }
  return true;
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

  // 3. OpenAI DALL-E 与 GPT-Image 系列标准画幅适配 (1:1 -> 1024x1024, 9:16/竖版 -> 1024x1792, 16:9/横版 -> 1792x1024)
  const isGptOrDallE = provider === 'openai' ||
    (model && (model.toLowerCase().includes('dall-e') || model.toLowerCase().includes('gpt-image')));
  if (isGptOrDallE) {
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
        const body = await parseRequestBody(req).catch(() => ({}));
        const fieldId = body.fieldId || reqUrl.searchParams.get('fieldId');
        const optionName = body.optionName || reqUrl.searchParams.get('optionName');
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

        // 识别目标生图模型的类型规范 (Engine Profiler: 适配 GPT-Image / 千问 / FLUX / SD / MJ)
        const targetModel = (body.targetModel || cfg.targetModel || readJson(SETTINGS_FILE, {}).imageGen?.model || '').toLowerCase();
        const targetProvider = (body.targetProvider || cfg.targetProvider || readJson(SETTINGS_FILE, {}).imageGen?.provider || '').toLowerCase();

        let engineType = 'gpt_image';
        if (targetModel.includes('qwen-image') || targetModel.startsWith('wanx') || targetProvider === 'dashscope') {
          engineType = 'dashscope_qwen';
        } else if (targetModel.includes('flux') || targetModel.includes('sd') || targetModel.includes('stable-diffusion') || targetProvider === 'siliconflow') {
          engineType = 'flux_sd';
        }

        const isEnglish = (lang === 'en');
        const systemPrompt = isEnglish
          ? `You are an expert visual photography director specializing in adult female portraiture and boudoir/glamour aesthetics, operating exclusively to serve downstream image generation models (specifically GPT-Image, DALL-E 3, Midjourney, FLUX, and Qwen-Image).
Your sole objective is to convert user locks and style preferences into a single, cohesive, highly visual English photography prompt that image models can directly parse and render into stunning pictures.

[CORE SERVING PRINCIPLES - NO SELF-INDULGENCE, ZERO CHECKLIST DUMPING]:
1. Strictly Serve the Image Model:
   - Your prompt is fed DIRECTLY to an image diffusion/autoregressive model. It is NOT an essay, NOT a memo, and NOT a critique for human readers.
   - NEVER output numbered lists (like 1., 2., 3. or ①, ②, ③). NEVER divide into section headings (like [Facial Features], [Body Anatomy], [Lighting]).
   - NEVER output meta-commentary, analytical jargon, or director monologues (e.g. "We have designed...", "The anatomical stress analysis reveals...", "In this project...").
   - Output ONE single, continuous, highly immersive photography scene description (200-350 words).

2. Capture Feminine Allure, Sexual Tension & Sensual Elegance:
   - Modern attractive female portrait (20-25yo), refined facial bone structure, delicate jawline, captivating storytelling gaze looking into the camera, parted lips, effortless hair falling softly over bare shoulders and collarbones.
   - High-tension, chic styling: champagne silk slip dress with delicate lace trim, oversized boyfriend shirt slipped off one shoulder, knit robe loosely draped, deep neckline accentuating graceful collarbones and neck, fitted waist-to-hip feminine silhouette.
   - Relaxed, intimate posture: lounging naturally against a velvet sofa armrest, leaning by a sunlit window, or sitting softly on a plush carpet, relaxed curves, grounded contact points.
   - Masterful lighting & optics: warm golden hour sidelight, gentle rim light illuminating hair strands and bare skin, 85mm f/1.4 prime lens, shallow depth of field, creamy background blur, natural pores and dewy skin glow (no plastic airbrushing), authentic film grain, photorealistic 8k masterpiece.

3. Inviolable Locked Anchors:
   - Any attribute marked [Group · Field = Value] is mandatory. You must strictly incorporate and highlight it in the scene. All unlocked dimensions are harmonized with your photography mastery.

[REQUIRED OUTPUT FORMAT] (Only output these two sections, no other text):
【作品企划标题】
(A concise, evocative 3-6 word English title)

【摄影提示词】
(A single, continuous, highly visual English paragraph ready for direct image generation)`
          : `你是专为下游生图模型（特别是 GPT-Image / DALL-E 3、通义千问 Qwen-Image、FLUX、Midjourney）服务的视觉人像摄影提示词大师。
你的唯一任务是：深刻理解用户的锁定条件与风格诉求，为生图模型量身定制一段能直接出图、画面极具视觉吸引力与性张力的纯正摄影提示词！

【核心工作铁律：一切为生图模型服务，坚决杜绝文字自嗨】：
1. 你的产物是直接喂给生图模型的渲染指令，绝不是写给人类看的大纲或理论论文！
   - 严禁输出编号清单（如①②③④、1. 2. 3.、一二三四）！
   - 严禁拆分小标题（如【骨相五官】、【身材形体】、【服饰剪裁】、【受力分析】、【镜头光学】）！生图模型看到这些小标题会当作无意义文字或产生混乱噪点！
   - 严禁自嗨式理论分析与空泛文学评论（严禁写“我们精心构思了一幅...”、“解剖学走势分析”、“物理受力支点计算”、“展现出极致的肉体张力”等抽象大话）！
   - 必须融合成一段行云流水、自然连贯、画面感扑面而来的独立纯正摄影描述（通常200-350字），每一句话都是在具体描摹镜头中看得见的光影、人像、衣料、曲线与姿态！

2. 紧扣女性写真核心灵魂：现代时尚、纯欲微醺与高级性张力：
   - 【神态与面容】：以现代年轻女性写真为主（20-25岁），五官立体清秀，眼神慵懒迷离带有微妙撩人的情绪张力，直视镜头，自然微翘的饱满唇峰，发丝轻柔散落在白皙肩颈与精致锁骨之间。
   - 【撩人穿搭与身体曲线（性张力拉满且100%安全出图）】：
     生图模型（特别是 GPT-Image）对粗暴违禁词（如“肉体”、“私密”、“底裤”、“湿身半透”）有机器误判拦截；
     真正高级的性张力是视觉上的留白与质感诱惑——使用生图模型极度擅长呈现的高级时装语言：如香槟金色真丝细吊带短裙、微敞滑落至单肩的软糯针织开衫、领口自然的微露与锁骨起伏、轻薄微透的蕾丝滚边、勾勒出腰臀起伏的修身剪裁，曼妙起伏的女性曲线呼之欲出。
   - 【松弛慵懒的私房与现代写真姿态】：
     慵懒斜倚在复古绒布沙发扶手、侧坐于落地窗前阳光地毯、轻靠床沿单手挽起耳边碎发；肢体自然舒展，与沙发垫形成柔和贴合的依靠感，体态曼妙。
   - 【大师级镜头与原生肤质】：
     暖调午后侧逆光、发丝与肩颈边缘勾勒出温润轮廓光，空气中微尘光晕；哈苏85mm f/1.4人像定焦镜头大光圈，极浅景深，背景优雅奶油般虚化；皮肤通透水润富有呼吸感与真实微毛孔光泽，绝不塑料磨皮，电影级杰作。

3. 绝对尊重锁定条件：
   - 凡带有「【分组·字段】＝ 值」的条件为最高硬性要求，必须100%在画面主体中体现并融合。未锁定的维度自由搭配出最具视觉吸引力的画面。

请严格仅按以下两段格式输出，不要有任何多余的客套寒暄：
【作品企划标题】
(拟定4-8字富有艺术美感或引人入胜的摄影片名，如《真丝与午后私语》、《微醺暖阳》、《慵懒随想》)

【摄影提示词】
(单段自然连贯、极富视觉画面感与性张力的纯正摄影描述段落，直接提交给生图模型出图)`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时，充裕支持大模型深度构思
        try {
          const llmRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'Accept-Encoding': 'identity'
            },
            body: JSON.stringify({
              model,
              temperature: temp,
              max_tokens: maxTokens,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
              ]
            }),
            signal: controller.signal
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
          const isTimeout = err.name === 'AbortError' || (err.message && err.message.includes('aborted'));
          res.writeHead(isTimeout ? 504 : 500);
          res.end(JSON.stringify({ error: isTimeout ? '大模型请求超时 (120秒未响应)' : `大模型连接异常: ${err.message}` }));
          return;
        } finally {
          clearTimeout(timeoutId);
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
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒测试握手

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

          let response = await fetch(targetUrl, {
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
            res.end(JSON.stringify({
              error: `生图 API 请求失败 (${response.status}): ${errText}`,
              model,
              elapsedMs
            }));
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
          await saveImageFileToDisk(imageUrl, localFilePath);
          savedSuccess = true;
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
          await saveImageFileToDisk(imageUrl, localFilePath);
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            savedFile: fileName,
            savedPath: localFilePath,
            localUrl: `/api/image-file?path=${encodeURIComponent(localFilePath)}`
          }));
          return;
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
