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

  // CORS 支持
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

      // 3. API 设置配置
      if (pathname === '/api/settings' && req.method === 'GET') {
        const settings = readJson(SETTINGS_FILE, {});
        if (!settings.savePath) {
          settings.savePath = path.join(__dirname, 'outputs');
        }
        res.writeHead(200);
        res.end(JSON.stringify(settings));
        return;
      }

      if (pathname === '/api/settings' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        if (body.savePath) {
          try {
            const dir = path.isAbsolute(body.savePath) ? body.savePath : path.resolve(__dirname, body.savePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          } catch (e) {
            console.warn('Create savePath failed:', e.message);
          }
        }
        writeJson(SETTINGS_FILE, body);
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
        const record = {
          id: body.id || ('hist_' + Date.now()),
          timestamp: body.timestamp || new Date().toISOString(),
          title: rawTitle,
          actualPrompt: body.actualPrompt || body.prompt || body.promptZh || body.promptEn || '',
          promptZh: body.promptZh || '',
          promptEn: body.promptEn || '',
          imageUrl: body.imageUrl || '',
          savedSuccess: !!body.savedSuccess,
          savedFile: body.savedFile || '',
          savedPath: body.savedPath || '',
          localUrl: body.savedPath ? `/api/image-file?path=${encodeURIComponent(body.savedPath)}` : (body.savedFile ? `/outputs/${encodeURIComponent(body.savedFile)}` : ''),
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

      // 6. LLM API 测试连接
      if (pathname === '/api/llm/test' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { baseUrl, apiKey, model } = body;
        const targetUrl = `${(baseUrl || '').replace(/\/+$/, '')}/chat/completions`;

        const startTime = Date.now();
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            messages: [{ role: 'user', content: 'Say "OK" in 1 word.' }],
            max_tokens: 10
          })
        });

        const elapsedMs = Date.now() - startTime;
        if (!response.ok) {
          const errText = await response.text();
          res.writeHead(response.status);
          res.end(JSON.stringify({ error: `HTTP ${response.status}: ${errText}`, elapsedMs }));
          return;
        }

        const data = await response.json();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          elapsedMs,
          model,
          reply: data.choices?.[0]?.message?.content || 'OK'
        }));
        return;
      }

      // 7. LLM 提示词生成 / 搭配 / 润色
      if (pathname === '/api/llm/generate' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const settings = readJson(SETTINGS_FILE, {});
        const llmConfig = body.config || settings.llm || {};

        const baseUrl = (llmConfig.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
        const targetUrl = `${baseUrl}/chat/completions`;
        const apiKey = llmConfig.apiKey;
        const model = llmConfig.model || 'deepseek-chat';
        const userPrompt = body.prompt;
        const systemPrompt = body.systemPrompt || `你是一位享誉国际的专业时尚与女性写真摄影导演，拥有敏锐的光影审美、空间构图感知力与镜头语言表现力。
你的任务是根据用户提供的摄影需求和条件，设计独立完整的中文成年女性专业摄影提示词。

【形色摄影导演核心工作铁律】：
1. 锁定条件保留（绝对硬性约束）：
   用户指定的所有锁定条件（格式如「分组·字段名＝值」）为铁律，你必须100%严格保留、贯彻并在画面中重点呈现，绝对不得擅自篡改、削弱或丢弃。
2. 留白美学协调：
   未锁定的维度交由你作为摄影导演自由搭配，协调人物骨相五官、肌肤原生纹理（真实微光与光学质感，告别塑料磨皮假感）、动作主辅支点受力与重心平衡、空间纵深、现场照明光位色温及镜头视角焦段。
3. 服装分区严谨：
   严格根据服装形式（上下装 vs 一体装）协调各层衣片、面料织物纤维质感、剪裁褶皱与垂坠感，停用分区的字段绝对不混入画面。
4. 物理承重与空间接触：
   模特姿态必须明确主辅支点（椅背、桌沿、地面等），身体与物体接触有真实物理受力形变，严禁悬空穿模。
5. 七维近期去重：
   若用户附带了近期方案特征，请确保本次方案在「人物身份、服装搭配、动作支撑、构图关系、机位焦段、光影调性、情绪张力」中至少有4个可变维度产生显著新颖变化，拒绝同脸模板与同质化套路。

请严格按以下格式输出，不要输出任何多余的客套前言寒暄：
【作品企划标题】
(可选，拟定4-8字简洁利落的摄影片名，如《晨光与真丝》、《灰度空间》)

【摄影提示词】
(300-500字独立完整的专业级摄影提示词，细节详实生动，语言流畅，可供生图模型直接出图)`;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: llmConfig.temperature || 0.7,
            max_tokens: llmConfig.maxTokens || 2000
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          res.writeHead(response.status);
          res.end(JSON.stringify({ error: `LLM API Error (${response.status}): ${errText}` }));
          return;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, content, usage: data.usage }));
        return;
      }

      // 7.5 生图 API 连通性测试 (优先零费用 /models 检测)
      if (pathname === '/api/image/test' && req.method === 'POST') {
        const body = await parseRequestBody(req);
        const { baseUrl, apiKey, model, mode } = body;
        const cleanBaseUrl = (baseUrl || '').replace(/\/+$/, '');

        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '请填写 API Key' }));
          return;
        }

        const startTime = Date.now();

        // 默认优先使用零费用无出图检测 (GET /models 或 GET /v1/models)
        if (mode !== 'real_generate') {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);
            
            // 尝试标准的 /models 路径
            let testUrl = `${cleanBaseUrl}/models`;
            if (cleanBaseUrl.endsWith('/v1')) {
              testUrl = `${cleanBaseUrl}/models`;
            }

            const response = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`
              },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            const elapsedMs = Date.now() - startTime;
            if (response.ok) {
              const data = await response.json();
              res.writeHead(200);
              res.end(JSON.stringify({
                success: true,
                zeroCost: true,
                elapsedMs,
                model,
                message: '生图接口握手成功！(通过 /models 完成无出图零费用检测，未产生计费)'
              }));
              return;
            } else if (response.status === 404 || response.status === 405) {
              // 中转站可能未开放 models 查询接口，提示用户可按需选择真实生图测试
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
            // 网络超时或失败
            res.writeHead(200);
            res.end(JSON.stringify({
              success: false,
              needRealTest: true,
              error: err.message,
              message: `零费用检测未通 (${err.message})。若该网关只支持出图端点，可勾选「真实生图测试」重试。`
            }));
            return;
          }
        }

        // 真实生图测试 (会产生费用)
        try {
          const testPayload = {
            model: model || 'gpt-image-2.5-low',
            prompt: 'a minimalist photographic still life of a white ceramic vase, 8k resolution',
            size: '1024x1024',
            n: 1
          };

          const response = await fetch(`${cleanBaseUrl}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(testPayload)
          });

          const elapsedMs = Date.now() - startTime;
          if (!response.ok) {
            const errText = await response.text();
            res.writeHead(response.status);
            res.end(JSON.stringify({ error: `真实出图测试失败 (HTTP ${response.status}): ${errText}`, elapsedMs }));
            return;
          }

          const data = await response.json();
          let hasImage = false;
          if ((data.data && data.data.length > 0) || (data.images && data.images.length > 0)) {
            hasImage = true;
          }

          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            zeroCost: false,
            elapsedMs,
            model,
            hasImage,
            message: '真实生图测试成功！已生成测试图片(已产生调用费用)'
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
        const apiKey = imgConfig.apiKey;
        const model = imgConfig.model || 'gpt-image-2.5-low';
        const prompt = body.prompt;
        const size = body.size || '1024x1024';

        if (!apiKey) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: '请在 API 配置面板中填写图片生成模型的 API Key' }));
          return;
        }

        const targetUrl = `${baseUrl}/images/generations`;

        // 构建标准兼容 Payload
        const requestPayload = {
          model: model,
          prompt: prompt,
          n: 1
        };

        if (provider === 'siliconflow') {
          requestPayload.image_size = size;
        } else {
          requestPayload.size = size;
        }

        const startTime = Date.now();
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestPayload)
        });

        const elapsedMs = Date.now() - startTime;
        if (!response.ok) {
          const errText = await response.text();
          res.writeHead(response.status);
          res.end(JSON.stringify({ error: `生图 API 请求失败 (${response.status}): ${errText}`, elapsedMs }));
          return;
        }

        const data = await response.json();
        let imageUrl = '';
        if (data.data && data.data.length > 0) {
          const item = data.data[0];
          imageUrl = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
        } else if (data.images && data.images.length > 0) {
          const item = data.images[0];
          imageUrl = item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : '');
        }

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

      // 8.8 本地图片文件流服务 (支持输出目录及自定义绝对路径)
      if (pathname === '/api/image-file' && req.method === 'GET') {
        const filePath = reqUrl.searchParams.get('path');
        if (!filePath) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'path is required' }));
          return;
        }

        try {
          let targetPath = path.normalize(filePath);
          if (!fs.existsSync(targetPath)) {
            // 尝试在 outputs 相对目录下查找
            const fallbackPath = path.join(__dirname, 'outputs', path.basename(filePath));
            if (fs.existsSync(fallbackPath)) {
              targetPath = fallbackPath;
            }
          }

          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            const ext = path.extname(targetPath).toLowerCase();
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
          res.writeHead(500);
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
      }

      // 9. 打开本地输出文件夹（调用 openFolderInWindows，彻底解决中文路径不响应问题）
      if (pathname === '/api/open-folder' && req.method === 'POST') {
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

      // 9.5 弹窗选择本地保存目录
      if (pathname === '/api/select-folder' && req.method === 'POST') {
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
      res.writeHead(500);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`形色 XINGSE 控制台服务已就绪: http://127.0.0.1:${PORT}`);
});
