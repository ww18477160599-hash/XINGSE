/**
 * 形色 XINGSE 前后端 API 通信层 (双模自适应版: 兼容 Node.js 本地服务 与 Tauri 纯桌面离线环境)
 */

const ApiService = {
  // 环境检测: 判定是否处于原生 Tauri 桌面环境 (tauri.localhost / tauri: 协议)
  isTauri() {
    return typeof window !== 'undefined' && (
      !!window.__TAURI__ ||
      window.location.protocol === 'tauri:' ||
      window.location.hostname === 'tauri.localhost' ||
      window.location.origin.includes('tauri.localhost')
    );
  },

  // 1. 获取完整选项 (支持服务端 + 内置离线数据库双重保全)
  async fetchOptions() {
    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/options');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          return await res.json();
        }
      } catch (e) {
        console.warn('Network /api/options unavailable, using built-in offline options:', e);
      }
    }

    // 内置离线完整选项库
    if (window.DEFAULT_OPTIONS_DATA) {
      const base = JSON.parse(JSON.stringify(window.DEFAULT_OPTIONS_DATA));
      // 合并本地自建选项至各字段的 customOptions 中 (永久保存)
      try {
        const localCustom = JSON.parse(localStorage.getItem('xingse_custom_options') || '{}');
        base.groups.forEach(g => {
          g.fields.forEach(field => {
            const rawArr = localCustom[field.id] || [];
            const cleanCustoms = rawArr.map(item => (typeof item === 'string' ? item : item.name || '')).filter(Boolean);
            field.customOptions = Array.from(new Set([...(field.customOptions || []), ...cleanCustoms]));
          });
        });
      } catch (err) {
        console.warn('Merge local custom options error:', err);
      }
      return base;
    }
    throw new Error('未检测到选项库数据');
  },

  // 2. 自建选项 (持久化扩充到软件库)
  async addCustomOption(fieldId, optionName) {
    const cleanOpt = (optionName || '').trim();
    if (!cleanOpt) throw new Error('选项名称不能为空');

    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/custom-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldId, optionName: cleanOpt })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data && data.customOptions) return data;
        }
      } catch (e) {}
    }

    // 本地持久化储存
    try {
      const localCustom = JSON.parse(localStorage.getItem('xingse_custom_options') || '{}');
      if (!Array.isArray(localCustom[fieldId])) localCustom[fieldId] = [];
      const currentArr = localCustom[fieldId].map(o => (typeof o === 'string' ? o : o.name || '')).filter(Boolean);
      if (!currentArr.includes(cleanOpt)) {
        currentArr.push(cleanOpt);
      }
      localCustom[fieldId] = currentArr;
      localStorage.setItem('xingse_custom_options', JSON.stringify(localCustom));
      return { success: true, option: cleanOpt, customOptions: currentArr };
    } catch (err) {
      throw new Error('保存自建选项失败: ' + err.message);
    }
  },

  async deleteCustomOption(fieldId, optionName) {
    const cleanOpt = (optionName || '').trim();
    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/custom-options', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldId, optionName: cleanOpt })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data && data.customOptions) return data;
        }
      } catch (e) {}
    }

    try {
      const localCustom = JSON.parse(localStorage.getItem('xingse_custom_options') || '{}');
      let currentArr = (localCustom[fieldId] || []).map(o => (typeof o === 'string' ? o : o.name || '')).filter(Boolean);
      currentArr = currentArr.filter(o => o !== cleanOpt);
      localCustom[fieldId] = currentArr;
      localStorage.setItem('xingse_custom_options', JSON.stringify(localCustom));
      return { success: true, customOptions: currentArr };
    } catch (err) {
      throw new Error('删除自建选项失败: ' + err.message);
    }
  },

  // 3. API 配置读取与保存
  async getSettings() {
    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/settings');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const data = await res.json();
          if (data && (data.llm || data.imageGen)) return data;
        }
      } catch (e) {}
    }

    try {
      return JSON.parse(localStorage.getItem('xingse_settings') || '{}');
    } catch (e) {
      return {};
    }
  },

  async saveSettings(settings) {
    try {
      localStorage.setItem('xingse_settings', JSON.stringify(settings));
    } catch (e) {}

    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
      } catch (e) {}
    }

    return { success: true };
  },

  // 4. LLM 测试与调用
  async testLlm(config) {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.llm || (typeof state !== 'undefined' ? state.settings?.llm : null) || {};
    if (!ApiService.isTauri()) {
      try {
        const res = await fetch('/api/llm/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg)
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
        let errMsg = `LLM 测试接口失败 (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
      } catch (e) {
        const msg = e.message || '';
        if (!msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Unexpected token') && !msg.includes('is not valid JSON')) {
          throw e;
        }
      }
    }

    // 本地直连测试
    const baseUrl = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'deepseek-chat';
    if (!apiKey || apiKey.includes('•') || apiKey.includes('\u2022')) throw new Error('未配置有效 LLM API Key (当前凭证脱敏中)，请在右上角设置中填写或启动后台服务');
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`连接失败 (${r.status}): ${t}`);
    }
    return { success: true };
  },

  async generateLlmPrompt(prompt, config, lang = 'zh', targetModel = '', targetProvider = '') {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.llm || (typeof state !== 'undefined' ? state.settings?.llm : null) || {};
    const tm = targetModel || (typeof state !== 'undefined' ? state.settings?.imageGen?.model : '') || settings?.imageGen?.model || '';
    const tp = targetProvider || (typeof state !== 'undefined' ? state.settings?.imageGen?.provider : '') || settings?.imageGen?.provider || '';
    
    if (!ApiService.isTauri()) {
      try {
        const res = await fetch('/api/llm/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, config: cfg, lang, targetModel: tm, targetProvider: tp })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
        let errMsg = `LLM 生成提示词失败 (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
      } catch (e) {
        const msg = e.message || '';
        if (!msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Unexpected token') && !msg.includes('is not valid JSON')) {
          throw e;
        }
      }
    }

    // 本地直连调用
    const baseUrl = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'deepseek-chat';
    const temp = typeof cfg.temperature === 'number' ? cfg.temperature : 1;
    const maxTokens = cfg.maxTokens || 2000;
    if (!apiKey || apiKey.includes('•') || apiKey.includes('\u2022')) throw new Error('未配置有效 LLM API Key (当前凭证脱敏中)，请在右上角「API 接口设置」中填写');

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

请严格按以下两段格式输出，不要输出任何多余的客套前言寒暄：
【作品企划标题】
(必填！拟定4-8字简洁利落、具有高级光影意境的摄影片名，如《晨光与真丝》、《微澜暮色》、《影落朱弦》，严禁省略，严禁复用旧片名)

【摄影提示词】
(300-500字独立完整的专业级摄影提示词，细节详实生动，语言流畅，可供生图模型直接出图)`;

    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        temperature: temp,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`大模型生成失败 (${r.status}): ${t}`);
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '';
    return { success: true, content, prompt: content };
  },

  // 5. 生图测试与调用
  async testImageGen(config) {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.imageGen || (typeof state !== 'undefined' ? state.settings?.imageGen : null) || {};
    if (!ApiService.isTauri()) {
      try {
        const res = await fetch('/api/image/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cfg)
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
        let errMsg = `生图测试接口失败 (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
      } catch (e) {
        const msg = e.message || '';
        if (!msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Unexpected token') && !msg.includes('is not valid JSON')) {
          throw e;
        }
      }
    }

    // 本地直连检测兜底
    const baseUrl = (cfg.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'gpt-image-2.5-low';
    const provider = cfg.provider || (baseUrl.includes('dashscope') || (model && model.startsWith('wanx')) ? 'dashscope' : (baseUrl.includes('siliconflow') ? 'siliconflow' : 'custom'));
    if (!apiKey || apiKey.includes('•') || apiKey.includes('\u2022')) throw new Error('未配置有效生图 API Key (当前凭证脱敏中)，请先在右上角设置中填写或启动后台服务');

    if (provider === 'dashscope' || baseUrl.includes('dashscope')) {
      const testUrl = 'https://dashscope.aliyuncs.com/api/v1/tasks?page_no=1&page_size=1';
      const r = await fetch(testUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`百炼 API Key 验证失败 (${r.status}): ${t}`);
      }
      return { success: true, zeroCost: true, message: '阿里云百炼 (DashScope) 连接测试成功！' };
    }

    const r = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!r.ok && r.status !== 404 && r.status !== 405) {
      const t = await r.text();
      throw new Error(`生图接口握手失败 (${r.status}): ${t}`);
    }
    return { success: true, zeroCost: true, message: '生图接口连接握手成功！' };
  },

  async generateImage(prompt, size, title, config) {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.imageGen || (typeof state !== 'undefined' ? state.settings?.imageGen : null) || {};
    if (!ApiService.isTauri()) {
      try {
        const res = await fetch('/api/image/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, size, title, config: cfg })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
        let errMsg = `服务端生图异常 (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {
          const errText = await res.text();
          if (errText) errMsg = `${errMsg}: ${errText}`;
        }
        throw new Error(errMsg);
      } catch (e) {
        // 若服务端返回了业务错误或明确抛错，直接向外抛出，绝不静默重试防二次扣费
        const msg = e.message || '';
        if (!msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Unexpected token') && !msg.includes('is not valid JSON')) {
          throw e;
        }
        console.warn('后端服务不可达，尝试前端直连兜底:', e.message);
      }
    }

    const baseUrl = (cfg.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'gpt-image-2.5-low';
    const provider = cfg.provider || (baseUrl.includes('dashscope') || (model && model.startsWith('wanx')) ? 'dashscope' : (baseUrl.includes('siliconflow') ? 'siliconflow' : 'custom'));
    if (!apiKey || apiKey.includes('•') || apiKey.includes('\u2022')) throw new Error('未配置有效生图 API Key (当前凭证脱敏中)，请在右上角「API 接口设置」中填写');

    let url = '';

    // DashScope 百炼千问与万相生图分流
    if (provider === 'dashscope' || baseUrl.includes('dashscope') || (model && (model.startsWith('wanx') || model.includes('qwen-image')))) {
      if (model && model.toLowerCase().includes('qwen-image')) {
        // Qwen-Image 官方标准走百炼多模态生成通道
        const cleanSize = (size || '1024x1024').toLowerCase().replace('x', '*');
        const r = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'qwen-image-3.0',
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
        if (!r.ok) {
          const t = await r.text();
          throw new Error(`百炼千问生图调用失败 (${r.status}): ${t}`);
        }
        const data = await r.json();
        url = data.output?.choices?.[0]?.message?.content?.[0]?.image || data.data?.[0]?.url || '';
      } else {
        // 通义万相原生异步任务模式
        const cleanSize = (size || '1024x1024').toLowerCase().replace('x', '*');
        const submitRes = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable'
          },
          body: JSON.stringify({
            model: model || 'wanx2.1-t2i-turbo',
            input: { prompt },
            parameters: { size: cleanSize, n: 1 }
          })
        });
        if (!submitRes.ok) {
          const t = await submitRes.text();
          throw new Error(`百炼万相生图提交失败 (${submitRes.status}): ${t}`);
        }
        const sData = await submitRes.json();
        const taskId = sData.output?.task_id;
        if (!taskId) throw new Error('百炼未返回任务 ID');

        const maxWait = 120000;
        const start = Date.now();
        while (Date.now() - start < maxWait) {
          await new Promise(res => setTimeout(res, 1500));
          const pollRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (pollRes.ok) {
            const pData = await pollRes.json();
            if (pData.output?.task_status === 'SUCCEEDED') {
              url = pData.output?.results?.[0]?.url;
              break;
            } else if (pData.output?.task_status === 'FAILED') {
              throw new Error(`百炼万相生图任务失败: ${pData.output?.message || '未知错误'}`);
            }
          }
        }
        if (!url) throw new Error('百炼万相生图超时或未获取到图片');
      }
    } else {
      const r = await fetch(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          size: size || '1024x1024',
          n: 1
        })
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`生图接口调用失败 (${r.status}): ${t}`);
      }
      const data = await r.json();
      url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
    }
    if (!url) throw new Error('未获取到生成的图片地址');
    let localPath = url;
    let savedSuccess = false;
    let savedPath = '';
    let savedFile = '';
    let savedError = '';
    try {
      const saveRes = await ApiService.saveLocalImage(url, title);
      if (saveRes && saveRes.success && saveRes.savedPath) {
        savedSuccess = true;
        savedPath = saveRes.savedPath;
        savedFile = saveRes.filename || '';
        localPath = savedPath;
      } else {
        savedSuccess = false;
        savedError = saveRes?.error || '未能写入本地磁盘';
      }
    } catch (e) {
      savedSuccess = false;
      savedError = e.message;
      console.warn('Auto save local image failed:', e);
    }

    return {
      success: true,
      imageUrl: url,
      localPath: localPath,
      savedSuccess: savedSuccess,
      savedPath: savedPath,
      savedFile: savedFile,
      savedError: savedError,
      title: title || '摄影作品',
      prompt: prompt
    };
  },

  // 5.2 保存图片到本地 (Tauri 原生 Rust 直写 + 服务端兜底 + 浏览器自动下载兜底)
  async saveLocalImage(imageUrl, title) {
    const settings = await ApiService.getSettings();
    const saveDir = (settings.savePath || 'D:\\xingsepic').trim();
    const cleanTitle = (title || '摄影作品').replace(/[\\/:*?"<>|]/g, '_').trim();
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const filename = `${cleanTitle}_${dateStr}.png`;

    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;

    // 1. 优先尝试使用 Tauri 原生保存
    if (typeof invokeFn === 'function') {
      try {
        let bytes = null;
        if (imageUrl.startsWith('data:image/')) {
          const b64 = imageUrl.replace(/^data:image\/\w+;base64,/, '');
          const binStr = atob(b64);
          const len = binStr.length;
          bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
          }
        } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          try {
            const resp = await fetch(imageUrl);
            if (resp.ok) {
              const buf = await resp.arrayBuffer();
              bytes = new Uint8Array(buf);
            }
          } catch (fetchErr) {
            console.warn('Frontend fetch image blob failed, fallback to curl:', fetchErr);
          }
        }

        let savedPath = null;
        // 优先通过字节流直接落盘 (无任何进程与命令行参数限制)
        if (bytes && bytes.length > 0) {
          try {
            savedPath = await invokeFn('save_image_bytes', {
              bytes: Array.from(bytes),
              saveDir: saveDir,
              filename: filename
            });
          } catch (byteErr) {
            console.warn('save_image_bytes failed, fallback to save_image_to_disk:', byteErr);
          }
        }

        if (!savedPath) {
          savedPath = await invokeFn('save_image_to_disk', {
            imageDataOrUrl: imageUrl,
            saveDir: saveDir,
            filename: filename
          });
        }

        if (savedPath) {
          return { success: true, savedPath, filename };
        }
      } catch (err) {
        console.warn('Tauri save image failed:', err);
      }
    }

    // 2. 尝试 Node 服务端落盘兜底
    try {
      const res = await fetch('/api/image/save-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, title, savePath: saveDir })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.savedPath || data.localUrl)) {
          return {
            success: true,
            savedPath: data.savedPath || data.localUrl,
            filename: data.savedFile || filename
          };
        }
      }
    } catch (e) {}

    // 3. 兜底保护：自动触发浏览器端下载，确保图片 100% 留存在电脑中
    try {
      const a = document.createElement('a');
      a.href = imageUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return {
        success: true,
        savedPath: `已触发下载至本地下载目录: ${filename}`,
        filename: filename,
        isBrowserDownload: true
      };
    } catch (dlErr) {
      console.warn('Browser trigger download failed:', dlErr);
    }

    return { success: false, error: '未能写入本地磁盘' };
  },

  // 5.5 打开本地文件夹 (Tauri 原生 Explorer + 服务端兜底)
  async openFolder(folder) {
    const settings = await ApiService.getSettings();
    const targetFolder = (folder || settings.savePath || 'D:\\xingsepic').trim();

    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof invokeFn === 'function') {
      try {
        await invokeFn('open_folder', { path: targetFolder });
        return { success: true };
      } catch (err) {
        console.warn('Tauri invoke open_folder failed:', err);
      }
    }

    try {
      const res = await fetch('/api/system/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: targetFolder })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    throw new Error(`请在资源管理器中直接访问: ${targetFolder}`);
  },

  // 5.6 弹窗选择本地文件夹 (Tauri 原生 FolderDialog + 服务端兜底)
  async selectFolder(initialPath) {
    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof invokeFn === 'function') {
      try {
        const selected = await invokeFn('select_folder', {
          initialPath: initialPath || ''
        });
        if (selected) return { path: selected };
      } catch (err) {
        console.warn('Tauri invoke select_folder failed:', err);
      }
    }

    try {
      const res = await fetch('/api/system/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPath: initialPath || '' })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const manual = prompt('请输入本地图片保存目录的绝对路径（如 D:\\xingsepic）:', initialPath || 'D:\\xingsepic');
    if (manual) return { path: manual.trim() };
    return { path: initialPath || 'D:\\xingsepic' };
  },

  // 6. 历史记录
  async getHistory() {
    // 1. 优先尝试使用 Tauri 原生读取 (直通本地磁盘，不受浏览器配额限制)
    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof invokeFn === 'function') {
      try {
        const raw = await invokeFn('get_history_records');
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) return list;
        }
      } catch (e) {
        console.warn('Tauri get_history_records failed:', e);
      }
    }

    // 2. 尝试从 Node 后端接口读取
    try {
      const res = await fetch('/api/history');
      if (res.ok) return await res.json();
    } catch (e) {}

    // 3. 兜底从 localStorage 读取
    try {
      return JSON.parse(localStorage.getItem('xingse_history') || '[]');
    } catch (e) {
      return [];
    }
  },

  async saveHistory(record) {
    // 1. 优先尝试使用 Tauri 原生写入 (直写文件系统，容纳数百张作品完整提示词与图源)
    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof invokeFn === 'function') {
      try {
        const ok = await invokeFn('save_history_record', {
          recordJson: JSON.stringify(record)
        });
        if (ok) return { success: true };
      } catch (e) {
        console.warn('Tauri save_history_record failed:', e);
      }
    }

    // 2. 尝试保存至 Node 后端
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 3. 兜底写入 localStorage：先脱敏大体积 Base64，彻底杜绝 QuotaExceededError 导致整个历史丢失
    try {
      const safeRec = { ...record };
      if (safeRec.imageUrl && safeRec.imageUrl.startsWith('data:image/') && safeRec.imageUrl.length > 50000) {
        safeRec.imageUrl = safeRec.savedPath || safeRec.savedFile || '';
      }
      const list = JSON.parse(localStorage.getItem('xingse_history') || '[]');
      list.unshift(safeRec);
      if (list.length > 50) list.length = 50;
      localStorage.setItem('xingse_history', JSON.stringify(list));
    } catch (e) {
      console.warn('localStorage saveHistory failed:', e);
    }
    return { success: true };
  },

  async deleteHistory(id) {
    if (!id) return { success: false };

    // 1. 优先尝试使用 Tauri 原生删除
    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof invokeFn === 'function') {
      try {
        await invokeFn('delete_history_record', { id });
      } catch (e) {
        console.warn('Tauri delete_history_record failed:', e);
      }
    }

    // 2. 尝试从 Node 后端接口删除
    try {
      await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
    } catch (e) {}

    // 3. 兜底更新 localStorage
    try {
      const list = JSON.parse(localStorage.getItem('xingse_history') || '[]');
      const filtered = list.filter(item => item.id !== id);
      localStorage.setItem('xingse_history', JSON.stringify(filtered));
    } catch (e) {}

    return { success: true };
  },

  async clearHistory() {
    // 1. Tauri
    const invokeFn = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
    if (typeof invokeFn === 'function') {
      try {
        await invokeFn('clear_history_records');
      } catch (e) {}
    }

    // 2. Node
    try {
      await fetch('/api/history?all=true', { method: 'DELETE' });
    } catch (e) {}

    // 3. localStorage
    try {
      localStorage.setItem('xingse_history', '[]');
    } catch (e) {}

    return { success: true };
  },

  // 7. 预设
  async getPresets() {
    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/presets');
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
      } catch (e) {}
    }
    if (window.DEFAULT_PRESETS_DATA) {
      return JSON.parse(JSON.stringify(window.DEFAULT_PRESETS_DATA));
    }
    return [];
  },

  async savePreset(name, selections, locks) {
    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, selections, locks })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
      } catch (e) {}
    }
    return { success: true };
  },

  async deletePreset(id) {
    if (!this.isTauri()) {
      try {
        const res = await fetch('/api/presets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
      } catch (e) {}
    }
    return { success: true };
  }
};

window.ApiService = ApiService;
