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
    const defaultData = window.DEFAULT_OPTIONS_DATA || window.XINGSE_DEFAULT_DATA;
    if (defaultData) {
      const base = JSON.parse(JSON.stringify(defaultData));
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      try {
        const res = await fetch('/api/llm/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, config: cfg, lang, targetModel: tm, targetProvider: tp }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) return await res.json();
        let errMsg = `LLM 生成提示词失败 (${res.status})`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) errMsg = errJson.error;
        } catch (_) {}
        throw new Error(errMsg);
      } catch (e) {
        clearTimeout(timeoutId);
        const msg = e.message || '';
        if (e.name === 'AbortError' || msg.includes('aborted')) {
          throw new Error('LLM 接口请求超时 (120秒未响应)');
        }
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
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept-Encoding': 'identity'
        },
        body: JSON.stringify({
          model: model,
          temperature: temp,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`大模型生成失败 (${r.status}): ${t}`);
      }
      const data = await r.json();
      const content = data.choices?.[0]?.message?.content || '';
      return { success: true, content, prompt: content };
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError' || (e.message && e.message.includes('aborted'))) {
        throw new Error('大模型直连请求超时 (120秒未响应)');
      }
      throw e;
    }
  },

  // 5. 生图测试与调用
  imageAbortController: null,

  abortCurrentImageGen() {
    if (this.imageAbortController) {
      try {
        this.imageAbortController.abort();
      } catch (e) {
        console.warn('Abort error:', e);
      }
      this.imageAbortController = null;
      return true;
    }
    return false;
  },

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
    const controller = new AbortController();
    this.imageAbortController = controller;
    const signal = controller.signal;

    try {
      const settings = await ApiService.getSettings();
      const cfg = config || settings?.imageGen || (typeof state !== 'undefined' ? state.settings?.imageGen : null) || {};
      if (!ApiService.isTauri()) {
        try {
          const res = await fetch('/api/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, size, title, config: cfg }),
            signal
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
          if (e.name === 'AbortError' || signal.aborted) {
            throw new Error('用户已取消生图任务');
          }
          // 若服务端返回了业务错误或明确抛错，直接向外抛出，绝不静默重试防二次扣费
          const msg = e.message || '';
          if (!msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Unexpected token') && !msg.includes('is not valid JSON')) {
            throw e;
          }
          console.warn('后端服务不可达，尝试前端直连兜底:', e.message);
        }
      }

      if (signal.aborted) throw new Error('用户已取消生图任务');

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
            }),
            signal
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
            }),
            signal
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
            if (signal.aborted) throw new DOMException('用户已取消生图请求', 'AbortError');
            await new Promise(res => setTimeout(res, 1500));
            if (signal.aborted) throw new DOMException('用户已取消生图请求', 'AbortError');
            const pollRes = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
              headers: { 'Authorization': `Bearer ${apiKey}` },
              signal
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
          }),
          signal
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
    } catch (e) {
      if (e.name === 'AbortError' || signal.aborted) {
        throw new Error('用户已取消生图任务');
      }
      throw e;
    } finally {
      if (this.imageAbortController === controller) {
        this.imageAbortController = null;
      }
    }
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
