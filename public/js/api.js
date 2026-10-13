/**
 * 形色 XINGSE 前后端 API 通信层 (双模自适应版: 兼容 Node.js 本地服务 与 Tauri 纯桌面离线环境)
 */

const ApiService = {
  // 1. 获取完整选项 (支持服务端 + 内置离线数据库双重保全)
  async fetchOptions() {
    try {
      const res = await fetch('/api/options');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Network /api/options unavailable, using built-in offline options:', e);
    }

    // 内置离线完整选项库
    if (window.DEFAULT_OPTIONS_DATA) {
      const base = JSON.parse(JSON.stringify(window.DEFAULT_OPTIONS_DATA));
      // 合并本地自建选项
      try {
        const localCustom = JSON.parse(localStorage.getItem('xingse_custom_options') || '{}');
        Object.keys(localCustom).forEach(fieldId => {
          const customArr = localCustom[fieldId] || [];
          base.groups.forEach(g => {
            const field = g.fields.find(f => f.id === fieldId);
            if (field) {
              customArr.forEach(cOpt => {
                if (!field.options.find(o => o.name === cOpt.name)) {
                  field.options.push(cOpt);
                }
              });
            }
          });
        });
      } catch (err) {}
      return base;
    }
    throw new Error('未检测到选项库数据');
  },

  // 2. 自建选项
  async addCustomOption(fieldId, optionName) {
    try {
      const res = await fetch('/api/custom-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId, optionName })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 本地存储兜底
    try {
      const localCustom = JSON.parse(localStorage.getItem('xingse_custom_options') || '{}');
      if (!localCustom[fieldId]) localCustom[fieldId] = [];
      const newOpt = { id: `custom_${Date.now()}`, name: optionName, desc: '自建创意选项', isCustom: true };
      localCustom[fieldId].push(newOpt);
      localStorage.setItem('xingse_custom_options', JSON.stringify(localCustom));
      return { success: true, option: newOpt };
    } catch (err) {
      throw new Error('保存自建选项失败');
    }
  },

  async deleteCustomOption(fieldId, optionName) {
    try {
      const res = await fetch('/api/custom-options', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId, optionName })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    try {
      const localCustom = JSON.parse(localStorage.getItem('xingse_custom_options') || '{}');
      if (localCustom[fieldId]) {
        localCustom[fieldId] = localCustom[fieldId].filter(o => o.name !== optionName);
        localStorage.setItem('xingse_custom_options', JSON.stringify(localCustom));
      }
      return { success: true };
    } catch (err) {
      throw new Error('删除自建选项失败');
    }
  },

  // 3. API 配置读取与保存
  async getSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) return await res.json();
    } catch (e) {}

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

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    return { success: true };
  },

  // 4. LLM 测试与调用
  async testLlm(config) {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.llm || (typeof state !== 'undefined' ? state.settings?.llm : null) || {};
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 本地直连测试
    const baseUrl = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'deepseek-chat';
    if (!apiKey) throw new Error('未配置 LLM API Key，请先点击右上角设置');
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

  async generateLlmPrompt(prompt, config) {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.llm || (typeof state !== 'undefined' ? state.settings?.llm : null) || {};
    try {
      const res = await fetch('/api/llm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, config: cfg })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 本地直连调用
    const baseUrl = (cfg.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'deepseek-chat';
    const temp = typeof cfg.temperature === 'number' ? cfg.temperature : 1;
    const maxTokens = cfg.maxTokens || 2000;
    if (!apiKey) throw new Error('未配置 LLM API Key，请在右上角「API 接口设置」中填写');

    const systemPrompt = `你是一位享誉国际的专业时尚与女性写真摄影导演，拥有敏锐的光影审美、空间构图感知力与镜头语言表现力。
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
    try {
      const res = await fetch('/api/image/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const baseUrl = (cfg.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'gpt-image-2.5-low';
    if (!apiKey) throw new Error('未配置生图 API Key，请先点击右上角设置');
    const r = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        prompt: 'test',
        size: '1024x1024',
        n: 1
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`生图接口测试失败 (${r.status}): ${t}`);
    }
    return { success: true };
  },

  async generateImage(prompt, size, title, config) {
    const settings = await ApiService.getSettings();
    const cfg = config || settings?.imageGen || (typeof state !== 'undefined' ? state.settings?.imageGen : null) || {};
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size, title, config: cfg })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const baseUrl = (cfg.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'gpt-image-2.5-low';
    if (!apiKey) throw new Error('未配置生图 API Key，请在右上角「API 接口设置」中填写');
    const r = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        size: size || '1440x900',
        n: 1
      })
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`生图接口调用失败 (${r.status}): ${t}`);
    }
    const data = await r.json();
    const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : '');
    if (!url) throw new Error('未获取到生成的图片地址');
    return {
      success: true,
      imageUrl: url,
      localPath: url,
      title: title || '摄影作品',
      prompt: prompt
    };
  },

  // 5.2 单独重试保存图片到本地
  async saveLocalImage(imageUrl, title) {
    try {
      const res = await fetch('/api/image/save-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, title })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true, localPath: imageUrl };
  },

  // 5.5 打开本地文件夹
  async openFolder(folder) {
    try {
      const res = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: folder || '' })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true };
  },

  // 5.6 弹窗选择本地文件夹
  async selectFolder(initialPath) {
    try {
      const res = await fetch('/api/select-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialPath: initialPath || '' })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { path: initialPath || './outputs' };
  },

  // 6. 历史记录
  async getHistory() {
    try {
      const res = await fetch('/api/history');
      if (res.ok) return await res.json();
    } catch (e) {}
    try {
      return JSON.parse(localStorage.getItem('xingse_history') || '[]');
    } catch (e) {
      return [];
    }
  },

  async saveHistory(record) {
    try {
      const list = JSON.parse(localStorage.getItem('xingse_history') || '[]');
      list.unshift(record);
      if (list.length > 50) list.length = 50;
      localStorage.setItem('xingse_history', JSON.stringify(list));
    } catch (e) {}

    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true };
  },

  // 7. 预设
  async getPresets() {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) return await res.json();
    } catch (e) {}
    if (window.DEFAULT_PRESETS_DATA) {
      return JSON.parse(JSON.stringify(window.DEFAULT_PRESETS_DATA));
    }
    return [];
  },

  async savePreset(name, selections, locks) {
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, selections, locks })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true };
  },

  async deletePreset(id) {
    try {
      const res = await fetch('/api/presets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: true };
  }
};

window.ApiService = ApiService;
