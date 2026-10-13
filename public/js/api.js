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
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 本地直连测试
    const baseUrl = (config.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const apiKey = config.apiKey || '';
    const model = config.model || 'deepseek-chat';
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
    try {
      const res = await fetch('/api/llm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, config })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    // 本地直连调用
    const baseUrl = (config.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
    const apiKey = config.apiKey || '';
    const model = config.model || 'deepseek-chat';
    const temp = typeof config.temperature === 'number' ? config.temperature : 1;
    const maxTokens = config.maxTokens || 2000;
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
          { role: 'system', content: '你是专业的顶级商业摄影总监与提示词专家。' },
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
    return { prompt: content };
  },

  // 5. 生图测试与调用
  async testImageGen(config) {
    try {
      const res = await fetch('/api/image/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const baseUrl = (config.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
    const apiKey = config.apiKey || '';
    const model = config.model || 'gpt-image-2.5-low';
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
    try {
      const res = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size, title, config })
      });
      if (res.ok) return await res.json();
    } catch (e) {}

    const baseUrl = (config.baseUrl || 'https://api.gemai.cc/v1').replace(/\/+$/, '');
    const apiKey = config.apiKey || '';
    const model = config.model || 'gpt-image-2.5-low';
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
