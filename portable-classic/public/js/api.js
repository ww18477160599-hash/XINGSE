/**
 * 形色 XINGSE 前后端 API 通信层
 */

const ApiService = {
  // 1. 获取完整选项
  async fetchOptions() {
    const res = await fetch('/api/options');
    if (!res.ok) throw new Error('获取选项库失败');
    return await res.json();
  },

  // 2. 自建选项
  async addCustomOption(fieldId, optionName) {
    const res = await fetch('/api/custom-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldId, optionName })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '添加自定义选项失败');
    }
    return await res.json();
  },

  async deleteCustomOption(fieldId, optionName) {
    const res = await fetch('/api/custom-options', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldId, optionName })
    });
    if (!res.ok) throw new Error('删除自定义选项失败');
    return await res.json();
  },

  // 3. API 配置
  async getSettings() {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('读取设置失败');
    return await res.json();
  },

  async saveSettings(settings) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('保存设置失败');
    return await res.json();
  },

  // 4. LLM 测试与调用
  async testLlm(config) {
    const res = await fetch('/api/llm/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '测试连接失败');
    return data;
  },

  async generateLlmPrompt(prompt, config) {
    const res = await fetch('/api/llm/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, config })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '大模型生成失败');
    return data;
  },

  // 5. 生图测试与调用
  async testImageGen(config) {
    const res = await fetch('/api/image/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '生图接口测试失败');
    return data;
  },

  async generateImage(prompt, size, title, config) {
    const res = await fetch('/api/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size, title, config })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '生图接口调用失败');
    return data;
  },

  // 5.2 单独重试保存图片到本地
  async saveLocalImage(imageUrl, title) {
    const res = await fetch('/api/image/save-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, title })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '保存到本地失败');
    return data;
  },

  // 5.5 打开本地文件夹
  async openFolder(folder) {
    const res = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: folder || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '打开本地输出文件夹失败');
    return data;
  },

  // 5.6 弹窗选择本地文件夹
  async selectFolder(initialPath) {
    const res = await fetch('/api/select-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialPath: initialPath || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '选择本地文件夹失败');
    return data;
  },

  // 6. 历史记录
  async getHistory() {
    const res = await fetch('/api/history');
    return await res.json();
  },

  async saveHistory(record) {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    return await res.json();
  },

  // 7. 预设
  async getPresets() {
    const res = await fetch('/api/presets');
    return await res.json();
  },

  async savePreset(name, selections, locks) {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, selections, locks })
    });
    return await res.json();
  },

  async deletePreset(id) {
    const res = await fetch('/api/presets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    return await res.json();
  }
};

window.ApiService = ApiService;
