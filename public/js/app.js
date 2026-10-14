/**
 * 形色 XINGSE 前端主控制逻辑 (V0.62.7 摄影导演完整架构版)
 */

// 全局应用状态
const state = {
  groups: [],
  fieldsMap: {},
  allFields: [],
  selections: {},
  locks: {},
  settings: {},
  promptLanguage: localStorage.getItem('xingse_prompt_lang') || 'zh', // 'zh' | 'en'
  currentTab: 'prompt', // prompt | canvas
  history: [],
  filmstrip: [],
  selectedFilmstripItem: null,
  isGeneratingLlm: false,
  isGeneratingImage: false,
  activeGroup: 'all',
  galleryFilterAlbum: 'all',
  gallerySort: 'time-desc',
  gallerySearchQuery: '',
  favorites: JSON.parse(localStorage.getItem('xingse_favorites') || '[]')
};

// 常见 LLM 预设供应商
const LLM_PRESETS = {
  dashscope: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    name: '阿里云百炼 (通义千问 Qwen)',
    models: [
      { id: 'qwen-plus', name: 'qwen-plus (官方推荐·高智商文学润色)' },
      { id: 'qwen-max', name: 'qwen-max (千问旗舰满血·超强感知)' },
      { id: 'qwen-turbo', name: 'qwen-turbo (极速响应·高性价比)' },
      { id: 'qwen-flash', name: 'qwen-flash (轻量微型)' }
    ]
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    name: 'DeepSeek (深度求索)',
    models: [
      { id: 'deepseek-chat', name: 'deepseek-chat (V3 通用大模型)' },
      { id: 'deepseek-reasoner', name: 'deepseek-reasoner (R1 深度思考)' }
    ]
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    name: '硅基流动 (SiliconFlow)',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen2.5-72B-Instruct' }
    ]
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    name: 'OpenAI (GPT-4o)',
    models: [
      { id: 'gpt-4o', name: 'gpt-4o (全能旗舰)' },
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini (轻巧极速)' }
    ]
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    name: 'Kimi (月之暗面)',
    models: [
      { id: 'moonshot-v1-8k', name: 'moonshot-v1-8k' },
      { id: 'moonshot-v1-32k', name: 'moonshot-v1-32k' }
    ]
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    name: '智谱 AI (GLM-4)',
    models: [
      { id: 'glm-4-flash', name: 'glm-4-flash (极速免费/超低价)' },
      { id: 'glm-4-plus', name: 'glm-4-plus (高智旗舰)' }
    ]
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    name: 'Ollama 本地大模型',
    models: [
      { id: 'qwen2.5:7b', name: 'qwen2.5:7b' },
      { id: 'deepseek-r1:8b', name: 'deepseek-r1:8b' }
    ]
  },
  custom: {
    baseUrl: '',
    model: '',
    name: '自定义兼容接口',
    models: []
  }
};

// 常见生图平台预设
const IMAGE_PRESETS = {
  dashscope: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'qwen-image-3.0',
    name: '阿里云百炼 (Qwen-Image / 千问生图)',
    models: [
      { id: 'qwen-image-3.0', name: 'Qwen-Image-3.0 (千问生图 3.0 标准版·推荐)' },
      { id: 'qwen-image-3.0-pro', name: 'Qwen-Image-3.0-pro (千问生图 3.0 旗舰版)' },
      { id: 'wanx2.1-t2i-turbo', name: 'wanx2.1-t2i-turbo (通义万相 2.1 极速版)' },
      { id: 'wanx2.1-t2i-plus', name: 'wanx2.1-t2i-plus (通义万相 2.1 旗舰版)' },
      { id: 'wanx-v1', name: 'wanx-v1 (通义万相 1.0 经典版)' }
    ]
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'black-forest-labs/FLUX.1-schnell',
    name: '硅基流动 (FLUX / SD)',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1-schnell (极速·高性价比)' },
      { id: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1-dev (顶级画质旗舰)' },
      { id: 'stabilityai/stable-diffusion-3-5-large', name: 'SD 3.5 Large (光影细节)' }
    ]
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'cogview-3-plus',
    name: '智谱 AI (CogView)',
    models: [
      { id: 'cogview-3-plus', name: 'cogview-3-plus (高清写实写真旗舰)' },
      { id: 'cogview-3-flash', name: 'cogview-3-flash (超低成本出图)' }
    ]
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'dall-e-3',
    name: 'OpenAI (DALL-E 3)',
    models: [
      { id: 'dall-e-3', name: 'dall-e-3 (官方精细构图)' },
      { id: 'dall-e-2', name: 'dall-e-2 (经典标准)' }
    ]
  },
  custom: {
    baseUrl: 'https://api.gemai.cc/v1',
    model: 'gpt-image-2.5-low',
    name: '哈基米 / GemAI (gpt-image / Midjourney)',
    models: [
      { id: 'gpt-image-2.5-low', name: 'gpt-image-2.5-low (哈基米极速出图)' },
      { id: 'midjourney', name: 'midjourney (中转代理出图)' }
    ]
  }
};

// HTML 转义安全工具函数
function escapeHtml(str) {
  if (typeof str !== 'string') return str == null ? '' : String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Toast 提示工具
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// 检查字段当前是否在生效的服装分区中
function isFieldPartitionActive(fieldId) {
  const outfitMode = state.selections['outfit_mode'] || '上下装';
  if (fieldId.startsWith('upper_') || fieldId.startsWith('lower_')) {
    return outfitMode === '上下装' || outfitMode === '成套装';
  }
  if (fieldId.startsWith('onepiece_')) {
    return outfitMode === '连衣裙' || outfitMode === '连体装';
  }
  if (fieldId.startsWith('outerwear_')) {
    const ow = state.selections['outerwear'];
    return !!(ow && ow !== '无外搭');
  }
  return true;
}

// 初始化应用
async function initApp() {
  // 0. 优先绑定全局 DOM 事件与模态框监听，确保任何情况下所有按钮可点击
  bindGlobalEvents();
  initTheme();
  initPromptLanguage();

  try {
    // 1. 读取设置 (服务端 JSON + 浏览器 localStorage 双重保全)
    try {
      state.settings = await ApiService.getSettings();
    } catch (e) {
      console.warn('Fetch server settings failed:', e);
    }

    const localSaved = localStorage.getItem('xingse_settings');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (!state.settings || Object.keys(state.settings).length === 0) {
          state.settings = parsed;
        } else {
          if (!state.settings.llm?.apiKey && parsed.llm?.apiKey) state.settings.llm = parsed.llm;
          if (!state.settings.imageGen?.apiKey && parsed.imageGen?.apiKey) state.settings.imageGen = parsed.imageGen;
        }
      } catch (err) {}
    }

    populateSettingsForm();

    // 2. 读取完整选项 (带内置离线数据库兜底)
    const data = await ApiService.fetchOptions();
    state.groups = data.groups || [];

    // 扁平化字段字典
    state.groups.forEach(g => {
      g.fields.forEach(f => {
        state.fieldsMap[f.id] = f;
        state.allFields.push(f);
      });
    });

    // 3. 读取本地存储的锁和已选项（首次打开默认全空，不自动锁任何条件）
    const savedSelections = localStorage.getItem('xingse_selections');
    const savedLocks = localStorage.getItem('xingse_locks');
    if (savedSelections) {
      try { state.selections = JSON.parse(savedSelections); } catch (e) { state.selections = {}; }
    } else {
      state.selections = {};
    }

    if (savedLocks) {
      try { state.locks = JSON.parse(savedLocks); } catch (e) { state.locks = {}; }
    } else {
      state.locks = {};
    }

    // 4. 渲染界面
    renderSidebar();
    renderConsole();
    state.allFields.forEach(f => {
      refreshFieldCardChips(f.id);
      refreshFieldCardLockState(f.id);
    });
    updateActiveConditionals();
    renderLockPool();
    updateAspectRatioDisplay();
    updatePromptBoxStatus();
    updateStatusSummary();

    // 5. 加载历史画廊
    loadGallery();

    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;

    showToast('形色 XINGSE 控制台已就绪', 'success');
  } catch (err) {
    console.error('Init Error:', err);
    showToast(`初始化失败: ${err.message}`, 'error');
  }
}

// 保存选择与锁
function saveSelectionsToLocal() {
  localStorage.setItem('xingse_selections', JSON.stringify(state.selections));
  localStorage.setItem('xingse_locks', JSON.stringify(state.locks));
}

// 侧边栏导航渲染
function renderSidebar() {
  const listEl = document.getElementById('sidebar-nav-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!state.activeGroup) {
    state.activeGroup = 'all';
  }

  // 1. 全景总览
  const allItem = document.createElement('div');
  allItem.className = `nav-item ${state.activeGroup === 'all' ? 'active' : ''}`;
  allItem.dataset.groupId = 'all';
  const totalSelected = Object.keys(state.selections).length;
  allItem.innerHTML = `
    <span>🌟 全景总览</span>
    <span class="nav-item-badge" id="badge-all">${totalSelected}/${state.allFields.length}</span>
  `;
  allItem.addEventListener('click', () => {
    switchActiveGroup('all');
  });
  listEl.appendChild(allItem);

  // 2. 7个具体核心大类
  const groupIcons = {
    overview: '🎨',
    identity: '👤',
    body: '💃',
    outfit: '👗',
    pose: '🧘',
    space: '🌆',
    camera: '📷'
  };

  state.groups.forEach(group => {
    const item = document.createElement('div');
    item.className = `nav-item ${state.activeGroup === group.id ? 'active' : ''}`;
    item.dataset.groupId = group.id;

    let selectedCount = 0;
    group.fields.forEach(f => {
      if (state.selections[f.id]) selectedCount++;
    });

    const icon = groupIcons[group.id] || '📌';
    item.innerHTML = `
      <span>${icon} ${group.name}</span>
      <span class="nav-item-badge" id="badge-${group.id}">${selectedCount}/${group.fields.length}</span>
    `;

    item.addEventListener('click', () => {
      switchActiveGroup(group.id);
    });

    listEl.appendChild(item);
  });
}

// 切换当前激活的大类
function switchActiveGroup(groupId) {
  state.activeGroup = groupId;

  window.scrollTo(0, 0);
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.groupId === groupId);
  });

  state.groups.forEach(g => {
    const sec = document.getElementById(`section-${g.id}`);
    if (sec) {
      if (groupId === 'all' || groupId === g.id) {
        sec.style.display = 'flex';
      } else {
        sec.style.display = 'none';
      }
    }
  });

  const container = document.getElementById('console-main-container');
  if (container) container.scrollTop = 0;
}

// 切换到上一组/下一组
function navigateGroup(offset) {
  const currentIdx = state.groups.findIndex(g => g.id === state.activeGroup);
  if (currentIdx === -1) {
    if (state.groups.length > 0) switchActiveGroup(state.groups[0].id);
    return;
  }
  let nextIdx = currentIdx + offset;
  if (nextIdx < 0) nextIdx = state.groups.length - 1;
  if (nextIdx >= state.groups.length) nextIdx = 0;
  switchActiveGroup(state.groups[nextIdx].id);
}

// 更新侧边栏小徽章
function updateSidebarBadges() {
  const totalSelected = Object.keys(state.selections).length;
  const badgeAll = document.getElementById('badge-all');
  if (badgeAll) badgeAll.textContent = `${totalSelected}/${state.allFields.length}`;

  state.groups.forEach(group => {
    const badge = document.getElementById(`badge-${group.id}`);
    if (badge) {
      let selectedCount = 0;
      group.fields.forEach(f => {
        if (state.selections[f.id]) selectedCount++;
      });
      badge.textContent = `${selectedCount}/${group.fields.length}`;
    }
  });
}

// 当前展开的选项浮层
let currentActivePopover = null;

function closeActivePopover() {
  if (currentActivePopover) {
    if (currentActivePopover.parentElement) {
      currentActivePopover.parentElement.classList.remove('has-open-popover');
    }
    document.querySelectorAll('.has-open-popover-group').forEach(el => el.classList.remove('has-open-popover-group'));
    document.querySelectorAll('.has-open-popover').forEach(el => el.classList.remove('has-open-popover'));
    currentActivePopover.remove();
    currentActivePopover = null;
  }
}

// 创建紧凑网格内的子区域分割线
function createSubDivider(id, icon, title, badgeText) {
  const div = document.createElement('div');
  div.className = `dense-grid-subdivider subdivider-${id}`;
  div.id = `subdivider-${id}`;
  div.innerHTML = `
    <div class="subdivider-title">
      <span>${icon}</span>
      <span>${title}</span>
    </div>
    ${badgeText ? `<span class="subdivider-badge">${badgeText}</span>` : ''}
  `;
  return div;
}

// 控制台全量字段渲染 (超紧凑 3~4 列多列网格矩阵)
function renderConsole() {
  const container = document.getElementById('console-cards-container') || document.getElementById('console-main-container');
  if (!container) return;
  container.innerHTML = '';

  state.groups.forEach(group => {
    const section = document.createElement('div');
    section.className = 'group-section';
    section.id = `section-${group.id}`;

    if (state.activeGroup && state.activeGroup !== 'all' && state.activeGroup !== group.id) {
      section.style.display = 'none';
    }

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <div class="group-title-wrap">
        <h2 class="group-title">
          <span>${group.name}</span>
          <span class="brand-badge">${group.fields.length} 维度</span>
        </h2>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-nav-prev" title="上一组">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          上一组
        </button>
        <button class="btn btn-secondary btn-nav-next" title="下一组">
          下一组
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="btn btn-secondary btn-reset-group" data-group-id="${group.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
          重置本组
        </button>
      </div>
    `;
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'fields-dense-grid';

    group.fields.forEach(field => {
      // 插入子区域分割条，提升可读性与模块感
      if (group.id === 'overview') {
        if (field.id === 'theme') {
          grid.appendChild(createSubDivider('overview-style', '🎨', '摄影基调与风格主题', '12大核心拍摄企划'));
        } else if (field.id === 'aspect_ratio') {
          grid.appendChild(createSubDivider('overview-framing', '📐', '画幅比例与景别构图', '光学画面结构'));
        }
      } else if (group.id === 'identity') {
        if (field.id === 'age') {
          grid.appendChild(createSubDivider('identity-features', '👤', '五官骨相与原生微观皮肤', '毛孔肌理·次表面散射·血色感'));
        } else if (field.id === 'hair') {
          grid.appendChild(createSubDivider('identity-styling', '💇‍♀️', '发型发色与妆造配饰', '造型细节搭配'));
        }
      } else if (group.id === 'outfit') {
        if (field.id === 'outfit_mode') {
          grid.appendChild(createSubDivider('outfit-mode', '🎛️', '穿搭组合形态', '双模自适应切换'));
        } else if (field.id === 'upper_kind') {
          grid.appendChild(createSubDivider('upper', '👚', '上装设计剪裁 (Upper Tops)', '分体生效'));
        } else if (field.id === 'lower_kind') {
          grid.appendChild(createSubDivider('lower', '👖', '下装设计剪裁 (Bottoms)', '分体生效'));
        } else if (field.id === 'onepiece_kind') {
          grid.appendChild(createSubDivider('onepiece', '👗', '一体连身裙装 (One-Piece & Dresses)', '连身生效'));
        } else if (field.id === 'outerwear') {
          grid.appendChild(createSubDivider('outerwear', '🧥', '外搭与叠穿艺术 (Outerwear & Layering)', '高视觉权重'));
        } else if (field.id === 'socks') {
          grid.appendChild(createSubDivider('accessories', '👠', '下身袜履搭配 (Footwear & Socks)', '下盘穿搭'));
        }
      }

      const tile = renderFieldCapsuleTile(field);
      grid.appendChild(tile);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// 单个紧凑胶囊磁贴渲染
function renderFieldCapsuleTile(field) {
  const isLocked = !!(state.locks[field.id] && state.selections[field.id]);
  const currentVal = state.selections[field.id] || '';

  const tile = document.createElement('div');
  tile.className = `field-capsule-tile ${isLocked ? 'is-locked' : ''}`;
  tile.id = `field-card-${field.id}`;
  if (field.activeWhen) {
    tile.dataset.activeWhen = JSON.stringify(field.activeWhen);
  }

  tile.innerHTML = `
    <div class="capsule-label-wrap" title="${field.note ? field.note + ' · ' : ''}${field.name} (${field.id})">
      <span class="capsule-field-name">${field.name}</span>
      <span class="capsule-field-id">${field.id}</span>
    </div>
    <div class="capsule-value-badge" id="capsule-val-btn-${field.id}" title="点击打开顺滑滚动选项选择器">
      <span class="capsule-val-text ${currentVal ? '' : 'is-empty'}">${currentVal || '留白搭配'}</span>
      <span class="capsule-val-arrow">▾</span>
    </div>
    <button class="capsule-lock-btn ${isLocked ? 'is-locked' : ''}" data-field-id="${field.id}" title="${isLocked ? '已锁定为硬性要求（点击解锁）' : '未锁定（留白给AI导演自由搭配，点击加锁）'}">
      ${isLocked ? '🔒' : '🔓'}
    </button>
  `;

  // 点击数值区弹出类似模型切换的顺滑滚轮/下拉抽屉
  const valBadge = tile.querySelector('.capsule-value-badge');
  valBadge.addEventListener('click', (e) => {
    e.stopPropagation();
    openDensePickerPopover(field, tile);
  });

  // 点击锁图标直接切换锁定
  const lockBtn = tile.querySelector('.capsule-lock-btn');
  lockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFieldLock(field.id);
  });

  return tile;
}

// 刷新单个胶囊磁贴 (在添加或删除自建选项后即时替换更新)
function refreshFieldTile(fieldId) {
  const field = state.fieldsMap[fieldId];
  if (!field) return;
  const oldTile = document.getElementById(`field-card-${fieldId}`);
  if (oldTile && oldTile.parentNode) {
    const newTile = renderFieldCapsuleTile(field);
    oldTile.parentNode.replaceChild(newTile, oldTile);
  }
}

// 打开类似模型切换的顺滑滚动选项选择器 (Picker Popover)
function openDensePickerPopover(field, tileEl) {
  if (currentActivePopover && currentActivePopover.dataset.fieldId === field.id) {
    closeActivePopover();
    return;
  }
  closeActivePopover();

  const popover = document.createElement('div');
  popover.className = 'dense-picker-popover';
  popover.dataset.fieldId = field.id;

  const currentVal = state.selections[field.id] || '';
  const allOptions = [...(field.options || []), ...(field.customOptions || [])];

  popover.innerHTML = `
    <div class="popover-search-wrap">
      <input type="text" class="popover-search-input" placeholder="🔍 快速检索 ${field.name}..." />
    </div>
    <div class="popover-list-scroll"></div>
    <div class="popover-footer-add">
      <button class="popover-add-btn">+ 自建选项</button>
    </div>
  `;

  const listScroll = popover.querySelector('.popover-list-scroll');

  function renderPopoverList(filterText = '') {
    listScroll.innerHTML = '';

    // 1. 留白搭配 (清空选择)
    const emptyItem = document.createElement('div');
    emptyItem.className = `popover-item is-empty-opt ${!currentVal ? 'selected' : ''}`;
    emptyItem.innerHTML = `
      <span>留白待定 (交由 AI 自由搭配)</span>
      ${!currentVal ? '<span style="color:var(--accent-gold); font-weight:bold;">✓</span>' : ''}
    `;
    emptyItem.addEventListener('click', () => {
      clearField(field.id);
      closeActivePopover();
    });
    listScroll.appendChild(emptyItem);

    // 2. 字段选项列表
    allOptions.forEach(opt => {
      if (filterText && !opt.toLowerCase().includes(filterText.toLowerCase())) return;
      const isSelected = isOptionSelected(field.id, opt, field.type);
      const isCustom = (field.customOptions || []).includes(opt);
      const conflict = XingSeDirector.checkOptionConflict ? XingSeDirector.checkOptionConflict(field.id, opt, state.selections) : null;

      const item = document.createElement('div');
      item.className = `popover-item ${isSelected ? 'selected' : ''} ${conflict ? 'is-conflict-disabled' : ''}`;
      if (conflict) {
        item.title = `⚠️ 相悖选项：${conflict.reason}`;
      }
      item.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${opt}${isCustom ? ' (自建)' : ''}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          ${conflict ? `<span class="conflict-badge" title="${escapeHtml(conflict.reason)}">⚠️ 相悖</span>` : ''}
          ${isSelected ? '<span style="color:var(--accent-gold); font-weight:bold;">✓</span>' : ''}
          ${isCustom ? `<span class="popover-del-opt" title="删除自建选项" style="color:var(--text-muted); cursor:pointer; font-size:0.8rem; padding:0 3px;">×</span>` : ''}
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('popover-del-opt')) {
          e.stopPropagation();
          handleDeleteCustomOption(field.id, opt);
          closeActivePopover();
          return;
        }
        if (conflict) {
          e.stopPropagation();
          showToast(`⚠️ 选项相悖无法选择：${conflict.reason}`, 'warning');
          return;
        }
        toggleOptionSelect(field, opt);
        closeActivePopover();
      });

      listScroll.appendChild(item);
    });
  }

  renderPopoverList();

  // 搜索框过滤事件
  const searchInput = popover.querySelector('.popover-search-input');
  searchInput.addEventListener('input', (e) => {
    renderPopoverList(e.target.value.trim());
  });
  searchInput.addEventListener('click', (e) => e.stopPropagation());

  // + 自建选项
  const addBtn = popover.querySelector('.popover-add-btn');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeActivePopover();
    openAddCustomOptionModal(field.id, field.name);
  });

  // 智能朝向判定：若磁贴下方可用视口空间不足 270px，或位于卡片中下排，则自动向上浮现（显示在上方）！
  const rect = tileEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  if (spaceBelow < 270 || (spaceAbove > 270 && rect.top > window.innerHeight * 0.42)) {
    popover.classList.add('popover-upward');
  }

  const groupSection = tileEl.closest('.group-section');
  if (groupSection) {
    groupSection.classList.add('has-open-popover-group');
  }

  tileEl.classList.add('has-open-popover');
  tileEl.appendChild(popover);
  currentActivePopover = popover;
  setTimeout(() => searchInput.focus(), 60);
}

// 检查是否选中
function isOptionSelected(fieldId, optName, type) {
  const current = state.selections[fieldId];
  if (!current) return false;
  if (type === 'multi') {
    const arr = current.split('/');
    return arr.includes(optName);
  }
  return current === optName;
}

// 用户主动选择选项 (选即加入锁定池机制)
function toggleOptionSelect(field, optName) {
  if (field.type === 'single') {
    if (state.selections[field.id] === optName) {
      delete state.selections[field.id]; // 再次点击取消选中
      delete state.locks[field.id];      // 移出核心锁定池
    } else {
      state.selections[field.id] = optName;
      state.locks[field.id] = true;      // 用户主动选择，进入核心锁定池
    }
  } else if (field.type === 'multi') {
    let arr = state.selections[field.id] ? state.selections[field.id].split('/') : [];
    if (arr.includes(optName)) {
      arr = arr.filter(x => x !== optName);
    } else {
      arr.push(optName);
    }
    if (arr.length > 0) {
      state.selections[field.id] = arr.join('/');
      state.locks[field.id] = true;
    } else {
      delete state.selections[field.id];
      delete state.locks[field.id];
    }
  }

  refreshFieldCardChips(field.id);
  refreshFieldCardLockState(field.id);
  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  checkPromptOutdated();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
}

// 刷新指定胶囊磁贴内文字
function refreshFieldCardChips(fieldId) {
  const card = document.getElementById(`field-card-${fieldId}`);
  if (!card) return;
  const valText = card.querySelector('.capsule-val-text');
  if (valText) {
    const val = state.selections[fieldId];
    if (val) {
      valText.textContent = val;
      valText.classList.remove('is-empty');
    } else {
      valText.textContent = '留白搭配';
      valText.classList.add('is-empty');
    }
  }
}

// 刷新指定磁贴锁状态样式与图标
function refreshFieldCardLockState(fieldId) {
  const card = document.getElementById(`field-card-${fieldId}`);
  if (!card) return;
  const isLocked = !!(state.locks[fieldId] && state.selections[fieldId]);
  card.classList.toggle('is-locked', isLocked);
  const btn = card.querySelector('.capsule-lock-btn');
  if (btn) {
    btn.classList.toggle('is-locked', isLocked);
    btn.textContent = isLocked ? '🔒' : '🔓';
    btn.title = isLocked ? '已锁定为硬性要求（点击解锁）' : '未锁定（留白给AI导演自由发挥搭配，点击加锁）';
  }
}

// 手动切换锁定/解锁字段
function toggleFieldLock(fieldId) {
  if (state.selections[fieldId]) {
    state.locks[fieldId] = !state.locks[fieldId];
  } else {
    // 若未选值，提示先选择具体项
    showToast('请先选择该维度的具体选项后再锁定', 'info');
    return;
  }
  refreshFieldCardLockState(fieldId);
  renderLockPool();
  checkPromptOutdated();
  updateStatusSummary();
  saveSelectionsToLocal();
}

// 单项随机抽取 (抽中后不自动锁定！保持已有锁逻辑)
function randomizeField(fieldId) {
  const field = state.fieldsMap[fieldId];
  if (!field) return;
  const allOptions = [...(field.options || []), ...(field.customOptions || [])];
  if (allOptions.length === 0) return;

  const rand = allOptions[Math.floor(Math.random() * allOptions.length)];
  state.selections[fieldId] = rand;
  // 严格要求：随机抽取的结果不自动加入锁定池
  refreshFieldCardChips(fieldId);
  refreshFieldCardLockState(fieldId);
  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  checkPromptOutdated();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
}

// 清空单项 (同时移出锁定池)
function clearField(fieldId) {
  delete state.selections[fieldId];
  delete state.locks[fieldId];
  refreshFieldCardChips(fieldId);
  refreshFieldCardLockState(fieldId);
  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  checkPromptOutdated();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
}

// 联动激活逻辑：上下装 vs 一体装
function updateActiveConditionals() {
  const outfitMode = state.selections['outfit_mode'] || '上下装';
  const isSplit = (outfitMode === '上下装' || outfitMode === '成套装');
  const isOnePiece = (outfitMode === '连衣裙' || outfitMode === '连体装');

  // 控制服装子分区分割条显隐
  const subUpper = document.getElementById('subdivider-upper');
  const subLower = document.getElementById('subdivider-lower');
  const subOnepiece = document.getElementById('subdivider-onepiece');
  if (subUpper) subUpper.style.display = isSplit ? 'flex' : 'none';
  if (subLower) subLower.style.display = isSplit ? 'flex' : 'none';
  if (subOnepiece) subOnepiece.style.display = isOnePiece ? 'flex' : 'none';

  state.allFields.forEach(field => {
    const card = document.getElementById(`field-card-${field.id}`);
    if (!card) return;

    // 外搭专属子字段动态判定：只要 outerwear 不是「无外搭」且非空（支持自建睡衣、浴袍等），子字段全量显示！
    if (field.id.startsWith('outerwear_')) {
      const ow = state.selections['outerwear'];
      const isOwActive = !!(ow && ow !== '无外搭');
      if (isOwActive) {
        card.classList.remove('is-disabled');
        card.style.display = '';
      } else {
        card.classList.add('is-disabled');
        card.style.display = 'none';
      }
      return;
    }

    let isActive = isFieldPartitionActive(field.id);

    if (isActive && field.activeWhen) {
      for (const [depField, allowedValues] of Object.entries(field.activeWhen)) {
        const currentDepVal = state.selections[depField];
        if (!currentDepVal || !allowedValues.includes(currentDepVal)) {
          isActive = false;
          break;
        }
      }
    }

    if (isActive) {
      card.classList.remove('is-disabled');
      card.style.display = '';
    } else {
      card.classList.add('is-disabled');
      // 如果属于当前停用的服装分区，直接完全收起隐藏，彻底告别冗长置灰占位
      if (field.id.startsWith('upper_') || field.id.startsWith('lower_') || field.id.startsWith('onepiece_')) {
        card.style.display = 'none';
      }
    }
  });

  renderLockPool();
}

// 独立“锁定池”渲染
function renderLockPool() {
  const chipsContainer = document.getElementById('lock-pool-chips');
  const countBadge = document.getElementById('lock-pool-count-badge');
  if (!chipsContainer) return;

  const lockedKeys = Object.keys(state.locks).filter(k => state.locks[k] && state.selections[k]);
  let activeLockedCount = 0;

  if (lockedKeys.length === 0) {
    chipsContainer.innerHTML = `
      <div class="lock-pool-empty" id="lock-pool-empty">
        当前锁定池为空（未锁定任何条件。首次打开默认全空。点击下方具体选项或自建选项即入锁）
      </div>
    `;
    if (countBadge) countBadge.textContent = '0 项已锁';
    return;
  }

  chipsContainer.innerHTML = '';
  lockedKeys.forEach(fieldId => {
    const field = state.fieldsMap[fieldId];
    if (!field) return;

    let groupName = '参数';
    for (const g of state.groups) {
      if (g.fields.some(f => f.id === fieldId)) {
        groupName = g.name;
        break;
      }
    }

    const val = state.selections[fieldId];
    const isActive = isFieldPartitionActive(fieldId);
    if (isActive) activeLockedCount++;

    const chip = document.createElement('div');
    chip.className = `lock-chip ${isActive ? '' : 'inactive'}`;
    chip.dataset.fieldId = fieldId;

    chip.innerHTML = `
      <span>${groupName}·${field.name}＝${val}</span>
      ${isActive ? '' : '<span class="lock-chip-tag-inactive">当前不生效</span>'}
      <span class="lock-chip-del" title="取消锁定">✕</span>
    `;

    chip.querySelector('.lock-chip-del').addEventListener('click', (e) => {
      e.stopPropagation();
      delete state.locks[fieldId];
      refreshFieldCardLockState(fieldId);
      renderLockPool();
      checkPromptOutdated();
      updateStatusSummary();
      saveSelectionsToLocal();
      showToast(`已解除「${groupName}·${field.name}」的锁定`, 'info');
    });

    chipsContainer.appendChild(chip);
  });

  if (countBadge) {
    countBadge.textContent = `${lockedKeys.length} 项已锁 (${activeLockedCount} 项生效)`;
  }
}

// 动态根据选中的画幅更新提交尺寸显示
function updateAspectRatioDisplay() {
  const ar = state.selections['aspect_ratio'] || '1:1';
  const info = XingSeDirector.getActualSubmitSizeInfo(ar);
  const badge = document.getElementById('ar-badge');
  const res = document.getElementById('ar-res');
  if (badge) badge.textContent = `画幅 ${ar}`;
  if (res) res.textContent = `实际提交: ${info.label}`;
}

// 条件变更检查（提示词已存在时展示警告条，不自动覆盖）
function checkPromptOutdated() {
  const mainPromptBox = document.getElementById('main-prompt-box');
  const warningBanner = document.getElementById('prompt-outdated-warning');
  if (mainPromptBox && mainPromptBox.value.trim().length > 0 && warningBanner) {
    warningBanner.style.display = 'flex';
  }
}

// 更新提示词文本框字数与生图按钮可点击状态
function updatePromptBoxStatus() {
  const mainPromptBox = document.getElementById('main-prompt-box');
  const genBtn = document.getElementById('btn-generate-image');
  const charCount = document.getElementById('prompt-char-count');
  if (!mainPromptBox) return;

  const text = mainPromptBox.value.trim();
  if (charCount) charCount.textContent = `${text.length} 字`;

  if (genBtn) {
    if (text.length > 0 && !state.isGeneratingImage && !state.isGeneratingLlm) {
      genBtn.disabled = false;
    } else {
      genBtn.disabled = true;
    }
  }
}

// 更新顶部监控状态条与锁定总览
function updateStatusSummary() {
  const lockedKeys = Object.keys(state.locks).filter(k => state.locks[k] && state.selections[k] && isFieldPartitionActive(k));
  
  // 1. 同步新版极简状态带
  const lockTextEl = document.getElementById('header-lock-text');
  if (lockTextEl) {
    lockTextEl.textContent = `已锁定 ${lockedKeys.length} 项核心`;
  }

  const ar = state.selections['aspect_ratio'] || '1:1';
  const info = XingSeDirector.getActualSubmitSizeInfo(ar);
  const aspectTextEl = document.getElementById('header-aspect-text');
  if (aspectTextEl) {
    aspectTextEl.textContent = `${ar} · ${info.label}`;
  }

  // 2. 兼容旧版摘要徽章
  const summaryEl = document.getElementById('header-summary-badge');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span class="status-dot" style="background:${lockedKeys.length > 0 ? '#10b981' : '#f59e0b'}; box-shadow:0 0 8px ${lockedKeys.length > 0 ? '#10b981' : '#f59e0b'};"></span>
      <span>锁定池 ${lockedKeys.length} 项生效 · 其余AI导演搭配</span>
    `;
  }
}

// 主题切换管理 (黑金 obsidian / 冷瓷 ceramic / 绯红 crimson)
function initTheme() {
  const savedTheme = localStorage.getItem('xingse_theme') || 'obsidian';
  setTheme(savedTheme);
}

function setTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem('xingse_theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

// 提示词输出语种管理 (中文 zh / English en - 原生摄影导演撰写，非机翻)
function initPromptLanguage() {
  const saved = localStorage.getItem('xingse_prompt_lang') || 'zh';
  setPromptLanguage(saved);
}

function setPromptLanguage(lang, syncBox = false) {
  state.promptLanguage = lang || 'zh';
  localStorage.setItem('xingse_prompt_lang', state.promptLanguage);
  document.getElementById('lang-btn-zh')?.classList.toggle('active', state.promptLanguage === 'zh');
  document.getElementById('lang-btn-en')?.classList.toggle('active', state.promptLanguage === 'en');
  if (syncBox) {
    updatePromptBoxFromCurrentSelections();
  }
}

// 基于当前控制台各项设置，立即重新组装对应语种的提示词并填入框中（消除延迟，告别二次点击）
function updatePromptBoxFromCurrentSelections() {
  const mainPromptBox = document.getElementById('main-prompt-box');
  const titleInput = document.getElementById('project-title');
  if (!mainPromptBox) return;

  const lang = state.promptLanguage || 'zh';
  let prompt = '';
  if (lang === 'en') {
    prompt = XingSeDirector.assembleEnglishPrompt(state.selections);
    if (titleInput && (!titleInput.value || /[\u4e00-\u9fa5]/.test(titleInput.value))) {
      titleInput.value = `Cinematic Portrait ${Date.now().toString().slice(-4)}`;
    }
  } else {
    prompt = XingSeDirector.assembleChinesePrompt(state.selections, state.fieldsMap);
    if (titleInput && (!titleInput.value || !/[\u4e00-\u9fa5]/.test(titleInput.value))) {
      titleInput.value = generateCreativeTitle(state.selections, '');
    }
  }

  mainPromptBox.value = prompt;
  updatePromptBoxStatus();
}

// 顶栏全部解锁 (清空锁定池)
function unlockAllFields() {
  state.locks = {};
  state.allFields.forEach(f => refreshFieldCardLockState(f.id));
  renderLockPool();
  checkPromptOutdated();
  updateStatusSummary();
  saveSelectionsToLocal();
  showToast('已清空全部锁定，当前所有维度均可由 AI 自由搭配', 'info');
}

// 顶栏重置控制台 (清空所有选项与锁定)
function resetConsole() {
  state.selections = {};
  state.locks = {};
  state.allFields.forEach(f => {
    refreshFieldCardChips(f.id);
    refreshFieldCardLockState(f.id);
  });
  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
  showToast('控制台已重置清空', 'warning');
}

// 重置单组
function resetGroup(groupId) {
  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;

  group.fields.forEach(f => {
    delete state.selections[f.id];
    delete state.locks[f.id];
    refreshFieldCardChips(f.id);
    refreshFieldCardLockState(f.id);
  });

  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  checkPromptOutdated();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
  showToast(`已重置「${group.name}」`, 'info');
}

// 库内随机采样（保留用户锁定项，重抽生效未锁定项，抽中结果绝不加锁）
function runRandomSample() {
  state.selections = XingSeDirector.sampleOptionsRandomly(
    state.allFields,
    state.selections,
    state.locks,
    isFieldPartitionActive
  );

  state.allFields.forEach(f => {
    refreshFieldCardChips(f.id);
    refreshFieldCardLockState(f.id);
  });
  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  checkPromptOutdated();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
  showToast('已重抽未锁定的生效维度（用户锁定项完好保留，抽取结果未加入锁定池）', 'success');
}

// 折叠 / 展开控制台
function toggleConsoleCollapse() {
  const consoleEl = document.getElementById('console-main-container');
  const btnText = document.getElementById('btn-toggle-console-text');
  if (!consoleEl) return;

  const isCollapsed = consoleEl.classList.toggle('is-collapsed');
  if (btnText) {
    btnText.textContent = isCollapsed ? '展开控制台' : '收起控制台';
  }
  showToast(isCollapsed ? '已收起控制台，提示词审阅区已最大化' : '已展开控制台', 'info');
}

// 自定义选项弹窗
let currentAddCustomFieldId = null;
function openAddCustomOptionModal(fieldId, fieldName) {
  currentAddCustomFieldId = fieldId;
  const modal = document.getElementById('add-custom-modal');
  const title = document.getElementById('custom-modal-title');
  const input = document.getElementById('custom-option-input');
  if (title) title.textContent = `为「${fieldName}」添加自定义选项`;
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 100);
  }
  if (modal) modal.classList.add('active');
}

async function handleAddCustomOptionSubmit() {
  const input = document.getElementById('custom-option-input');
  const val = input ? input.value.trim() : '';
  if (!val || !currentAddCustomFieldId) return;

  try {
    const res = await ApiService.addCustomOption(currentAddCustomFieldId, val);
    const field = state.fieldsMap[currentAddCustomFieldId];
    if (field) {
      field.customOptions = res.customOptions || [val];

      // 立即刷新磁贴抽屉选项列表
      refreshFieldTile(currentAddCustomFieldId);

      // 自动选中并加入锁定池
      toggleOptionSelect(field, val);
      saveSelectionsToLocal();
    }

    closeModal('add-custom-modal');
    showToast(`已成功添加「${val}」并扩充到软件选项库！`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteCustomOption(fieldId, optName) {
  if (!confirm(`确定要从预设库中删除「${optName}」吗？`)) return;

  try {
    const res = await ApiService.deleteCustomOption(fieldId, optName);
    const field = state.fieldsMap[fieldId];
    if (field) {
      field.customOptions = res.customOptions || [];
      if (state.selections[fieldId] === optName) {
        delete state.selections[fieldId];
        delete state.locks[fieldId];
      }
      refreshFieldTile(fieldId);
      updateActiveConditionals();
      renderLockPool();
      updateStatusSummary();
      saveSelectionsToLocal();
    }
    showToast(`已删除自定义选项「${optName}」`, 'info');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 平台配置多用户记忆与平滑初始化
function ensureProviderSettings() {
  if (!state.settings) state.settings = {};
  if (!state.settings.llm) state.settings.llm = {};
  if (!state.settings.llm.providers) state.settings.llm.providers = {};
  if (!state.settings.imageGen) state.settings.imageGen = {};
  if (!state.settings.imageGen.providers) state.settings.imageGen.providers = {};

  const curLlmP = state.settings.llm.provider || 'deepseek';
  if (!state.settings.llm.providers[curLlmP]) {
    state.settings.llm.providers[curLlmP] = {
      baseUrl: state.settings.llm.baseUrl || LLM_PRESETS[curLlmP]?.baseUrl || '',
      apiKey: state.settings.llm.apiKey || '',
      model: state.settings.llm.model || LLM_PRESETS[curLlmP]?.model || 'deepseek-chat'
    };
  }

  const curImgP = state.settings.imageGen.provider || 'dashscope';
  if (!state.settings.imageGen.providers[curImgP]) {
    state.settings.imageGen.providers[curImgP] = {
      baseUrl: state.settings.imageGen.baseUrl || IMAGE_PRESETS[curImgP]?.baseUrl || '',
      apiKey: state.settings.imageGen.apiKey || '',
      model: state.settings.imageGen.model || IMAGE_PRESETS[curImgP]?.model || 'qwen-image-3.0'
    };
  } else {
    if (!state.settings.imageGen.providers[curImgP].apiKey && state.settings.imageGen.apiKey) {
      state.settings.imageGen.providers[curImgP].apiKey = state.settings.imageGen.apiKey;
    }
  }
}

// 检查某个生图平台是否已被用户配置（拥有有效 API Key 或本地有效服务）
function isImageProviderConfigured(providerKey) {
  if (!providerKey) return false;
  ensureProviderSettings();
  const prof = state.settings?.imageGen?.providers?.[providerKey];
  const activeP = state.settings?.imageGen?.provider;
  const activeKey = state.settings?.imageGen?.apiKey;

  if (providerKey === activeP && activeKey && activeKey.trim() !== '') {
    return true;
  }
  if (prof && prof.apiKey && prof.apiKey.trim() !== '') {
    return true;
  }
  if (providerKey === 'ollama' && ((prof && prof.baseUrl) || (providerKey === activeP && state.settings?.imageGen?.baseUrl))) {
    return true;
  }
  return false;
}

// 刷新大模型下拉推荐列表
function updateLlmModelSelect(provider, selectedModel) {
  const selectEl = document.getElementById('llm-model-select');
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const preset = LLM_PRESETS[provider];
  const list = preset?.models || [];
  if (list.length === 0) {
    selectEl.style.display = 'none';
    return;
  }
  selectEl.style.display = 'block';

  let hasMatch = false;
  list.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    if (m.id === selectedModel) {
      opt.selected = true;
      hasMatch = true;
    }
    selectEl.appendChild(opt);
  });

  if (!hasMatch && selectedModel) {
    const customOpt = document.createElement('option');
    customOpt.value = selectedModel;
    customOpt.textContent = `当前: ${selectedModel}`;
    customOpt.selected = true;
    selectEl.appendChild(customOpt);
  }
}

// 刷新生图模型下拉推荐列表
function updateImageModelSelect(provider, selectedModel) {
  const selectEl = document.getElementById('image-model-select');
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const preset = IMAGE_PRESETS[provider];
  const list = preset?.models || [];
  if (list.length === 0) {
    selectEl.style.display = 'none';
    return;
  }
  selectEl.style.display = 'block';

  let hasMatch = false;
  list.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    if (m.id === selectedModel) {
      opt.selected = true;
      hasMatch = true;
    }
    selectEl.appendChild(opt);
  });

  if (!hasMatch && selectedModel) {
    const customOpt = document.createElement('option');
    customOpt.value = selectedModel;
    customOpt.textContent = `当前: ${selectedModel}`;
    customOpt.selected = true;
    selectEl.appendChild(customOpt);
  }
}

let activeLlmProviderInForm = 'deepseek';
let activeImgProviderInForm = 'dashscope';

// API 设置表单数据填充
function populateSettingsForm() {
  ensureProviderSettings();
  const s = state.settings;

  const curLlmP = s.llm?.provider || 'deepseek';
  activeLlmProviderInForm = curLlmP;
  setVal('llm-provider', curLlmP);

  const llmProf = s.llm.providers[curLlmP] || {};
  setVal('llm-base-url', llmProf.baseUrl || s.llm.baseUrl || LLM_PRESETS[curLlmP]?.baseUrl || '');
  setVal('llm-api-key', llmProf.apiKey || s.llm.apiKey || '');
  const llmModel = llmProf.model || s.llm.model || LLM_PRESETS[curLlmP]?.model || 'deepseek-chat';
  setVal('llm-model', llmModel);
  setVal('llm-temperature', s.llm.temperature ?? 0.7);
  updateLlmModelSelect(curLlmP, llmModel);

  const curImgP = s.imageGen?.provider || 'dashscope';
  activeImgProviderInForm = curImgP;
  setVal('image-provider', curImgP);

  const imgProf = s.imageGen.providers[curImgP] || {};
  setVal('image-base-url', imgProf.baseUrl || s.imageGen.baseUrl || IMAGE_PRESETS[curImgP]?.baseUrl || '');
  setVal('image-api-key', imgProf.apiKey || s.imageGen.apiKey || '');
  const imgModel = imgProf.model || s.imageGen.model || IMAGE_PRESETS[curImgP]?.model || 'qwen-image-3.0';
  setVal('image-model', imgModel);
  updateImageModelSelect(curImgP, imgModel);

  setVal('settings-save-path', s.savePath || './outputs');
  updateApiStatusBadge();
  updateQuickModelSelect();
}

// 主界面快速模型切换下拉列表渲染（只展示用户已配置有效 Key / 本地服务的模型）
function updateQuickModelSelect() {
  const selectEl = document.getElementById('quick-model-select');
  if (!selectEl) return;
  ensureProviderSettings();

  selectEl.innerHTML = '';

  const activeProvider = state.settings?.imageGen?.provider || 'dashscope';
  const activeModel = state.settings?.imageGen?.model || 'qwen-image-3.0';

  // 常见生图平台预设可选模型字典（按平台归类）
  const presetModelMap = {
    dashscope: [
      { id: 'qwen-image-3.0', name: '阿里云百炼 · Qwen-Image-3.0 (官方推荐)' },
      { id: 'qwen-image-3.0-pro', name: '阿里云百炼 · Qwen-Image-3.0-pro 旗舰' },
      { id: 'wanx2.1-t2i-turbo', name: '阿里云百炼 · 万相 2.1 极速版' },
      { id: 'wanx2.1-t2i-plus', name: '阿里云百炼 · 万相 2.1 旗舰版' }
    ],
    siliconflow: [
      { id: 'black-forest-labs/FLUX.1-schnell', name: '硅基流动 · FLUX.1-schnell 极速' },
      { id: 'black-forest-labs/FLUX.1-dev', name: '硅基流动 · FLUX.1-dev 画质旗舰' },
      { id: 'stabilityai/stable-diffusion-3-5-large', name: '硅基流动 · SD 3.5 Large' }
    ],
    zhipu: [
      { id: 'cogview-3-plus', name: '智谱 AI · CogView-3-Plus 旗舰' },
      { id: 'cogview-3-flash', name: '智谱 AI · CogView-3-Flash 极速' }
    ],
    openai: [
      { id: 'dall-e-3', name: 'OpenAI · DALL-E 3 官方' }
    ],
    custom: [
      { id: 'gpt-image-2.5-low', name: '哈基米 · gpt-image-2.5-low (常用)' },
      { id: 'midjourney', name: '哈基米 · midjourney' }
    ]
  };

  // 1. 严格过滤：只保留用户已配置 API Key 的平台，绝不展示未配置或待配Key的死选项
  const allKnownProviders = ['dashscope', 'siliconflow', 'zhipu', 'openai', 'custom'];
  const configuredProviders = allKnownProviders.filter(p => isImageProviderConfigured(p));

  // 检查是否还有自定义已配置的平台
  if (state.settings?.imageGen?.providers) {
    Object.keys(state.settings.imageGen.providers).forEach(p => {
      if (!allKnownProviders.includes(p) && isImageProviderConfigured(p)) {
        configuredProviders.push(p);
      }
    });
  }

  const availableOptions = [];
  let foundCurrent = false;

  configuredProviders.forEach(p => {
    const prof = state.settings?.imageGen?.providers?.[p] || {};
    const pName = IMAGE_PRESETS[p]?.name?.split(' ')?.[0] || p;
    const models = presetModelMap[p] ? [...presetModelMap[p]] : [];

    // 若用户自定义了模型且不在预设中，加入到该平台模型列表首位
    if (prof.model && !models.some(m => m.id === prof.model)) {
      models.unshift({
        id: prof.model,
        name: `${pName} · ${prof.model}`
      });
    }

    models.forEach(m => {
      const isSelected = (p === activeProvider && m.id === activeModel);
      if (isSelected) foundCurrent = true;
      availableOptions.push({
        value: `${p}:${m.id}`,
        label: m.name,
        selected: isSelected
      });
    });
  });

  // 如果当前激活的模型未匹配上任何项但当前平台已配置，补齐当前激活项
  if (!foundCurrent && isImageProviderConfigured(activeProvider)) {
    const pName = IMAGE_PRESETS[activeProvider]?.name?.split(' ')?.[0] || activeProvider;
    availableOptions.unshift({
      value: `${activeProvider}:${activeModel}`,
      label: `${pName} · ${activeModel}`,
      selected: true
    });
    foundCurrent = true;
  }

  // 2. 渲染已配置模型列表
  if (availableOptions.length === 0) {
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '__open_settings__';
    emptyOpt.textContent = '⚠️ 暂未配置生图模型 (点击去配置)';
    selectEl.appendChild(emptyOpt);
  } else {
    availableOptions.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.value;
      opt.textContent = item.label;
      if (item.selected) opt.selected = true;
      selectEl.appendChild(opt);
    });
  }

  // 3. 在末尾追加配置新平台入口，体验顺畅自然
  const manageOpt = document.createElement('option');
  manageOpt.value = '__open_settings__';
  manageOpt.textContent = '⚙️ + 配置更多生图平台...';
  selectEl.appendChild(manageOpt);
}

// 顶部栏 API 就绪状态徽章
function updateApiStatusBadge() {
  const badgeEl = document.getElementById('api-status-badge');
  if (!badgeEl) return;

  const hasLlm = !!(state.settings?.llm?.apiKey);
  const hasImg = !!(state.settings?.imageGen?.apiKey);

  const imgP = state.settings?.imageGen?.provider || 'dashscope';
  const imgPName = IMAGE_PRESETS[imgP]?.name?.split(' ')?.[0] || '生图';
  const llmP = state.settings?.llm?.provider || 'dashscope';
  const llmPName = LLM_PRESETS[llmP]?.name?.split(' ')?.[0] || 'LLM';

  if (hasLlm && hasImg) {
    badgeEl.className = 'status-badge ready';
    badgeEl.innerHTML = `
      <span class="status-dot"></span>
      <span>API 就绪: ${llmPName} · ${imgPName}(${state.settings.imageGen.model || '万相'})</span>
    `;
  } else if (hasLlm) {
    badgeEl.className = 'status-badge partial';
    badgeEl.innerHTML = `
      <span class="status-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span>
      <span>${llmPName} 就绪 (待配生图 Key)</span>
    `;
  } else if (hasImg) {
    badgeEl.className = 'status-badge partial';
    badgeEl.innerHTML = `
      <span class="status-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span>
      <span>${imgPName} 就绪 (待配提示词大模型 Key)</span>
    `;
  } else {
    badgeEl.className = 'status-badge unconfigured';
    badgeEl.innerHTML = `
      <span class="status-dot inactive"></span>
      <span>点击配置 API Key (支持阿里云百炼/硅基流动等)</span>
    `;
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// 保存 API 设置
async function handleSaveSettings() {
  ensureProviderSettings();

  const curLlmP = getVal('llm-provider') || 'dashscope';
  const curImgP = getVal('image-provider') || 'dashscope';

  // 1. 同步当前输入到各平台独立持久化档案库
  state.settings.llm.providers[curLlmP] = {
    baseUrl: getVal('llm-base-url'),
    apiKey: getVal('llm-api-key'),
    model: getVal('llm-model')
  };

  state.settings.imageGen.providers[curImgP] = {
    baseUrl: getVal('image-base-url'),
    apiKey: getVal('image-api-key'),
    model: getVal('image-model')
  };

  // 2. 组装整体设置对象
  const newSettings = {
    llm: {
      provider: curLlmP,
      baseUrl: getVal('llm-base-url'),
      apiKey: getVal('llm-api-key'),
      model: getVal('llm-model'),
      temperature: parseFloat(getVal('llm-temperature')) || 0.7,
      maxTokens: 2000,
      providers: state.settings.llm.providers
    },
    imageGen: {
      provider: curImgP,
      baseUrl: getVal('image-base-url'),
      apiKey: getVal('image-api-key'),
      model: getVal('image-model'),
      providers: state.settings.imageGen.providers
    },
    savePath: getVal('settings-save-path') || './outputs'
  };

  try {
    localStorage.setItem('xingse_settings', JSON.stringify(newSettings));
    state.settings = newSettings;
    await ApiService.saveSettings(newSettings);

    updateApiStatusBadge();
    updateQuickModelSelect();
    closeModal('settings-modal');
    showToast('各大模型平台配置已持久化保存！可在不同模型间随心切换', 'success');
  } catch (err) {
    showToast(`保存警告: ${err.message}`, 'warning');
    updateApiStatusBadge();
    updateQuickModelSelect();
    closeModal('settings-modal');
  }
}

// 测试 LLM 连通性
async function handleTestLlm() {
  const statusEl = document.getElementById('llm-test-status');
  if (statusEl) {
    statusEl.textContent = '正在测试连接...';
    statusEl.style.color = '#f59e0b';
  }

  try {
    const curLlmP = getVal('llm-provider') || state.settings?.llm?.provider || 'deepseek';
    const config = {
      provider: curLlmP,
      baseUrl: getVal('llm-base-url'),
      apiKey: getVal('llm-api-key'),
      model: getVal('llm-model')
    };
    const res = await ApiService.testLlm(config);
    if (statusEl) {
      statusEl.textContent = `✓ 连接成功 (耗时: ${res.elapsedMs}ms, 模型: ${res.model})`;
      statusEl.style.color = '#10b981';
    }
    showToast('LLM 提示词模型连接测试成功！', 'success');
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `✕ 失败: ${err.message}`;
      statusEl.style.color = '#ef4444';
    }
    showToast(`LLM 测试失败: ${err.message}`, 'error');
  }
}

// 测试图片生成模型连通性 (零费用 / 真实测试区分)
async function handleTestImageGen() {
  const statusEl = document.getElementById('image-test-status');
  if (statusEl) {
    statusEl.textContent = '正在测试生图连接...';
    statusEl.style.color = '#f59e0b';
  }

  const modeRadio = document.querySelector('input[name="image-test-mode"]:checked');
  const mode = modeRadio ? modeRadio.value : 'zero_cost';
  const curImgP = getVal('image-provider') || state.settings?.imageGen?.provider || 'dashscope';

  try {
    const config = {
      provider: curImgP,
      baseUrl: getVal('image-base-url'),
      apiKey: getVal('image-api-key'),
      model: getVal('image-model'),
      mode: mode
    };
    const res = await ApiService.testImageGen(config);
    if (res.success) {
      if (statusEl) {
        statusEl.textContent = `✓ ${res.message} (耗时: ${res.elapsedMs}ms)`;
        statusEl.style.color = '#10b981';
      }
      showToast(res.message, 'success');
    } else {
      if (statusEl) {
        statusEl.textContent = `ℹ ${res.message || res.error}`;
        statusEl.style.color = '#f59e0b';
      }
      showToast(res.message || '检测未通', 'warning');
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = `✕ 失败: ${err.message}`;
      statusEl.style.color = '#ef4444';
    }
    showToast(`生图测试失败: ${err.message}`, 'error');
  }
}

// 智能诗意标题生成器（确保重新搭配时永不重名且契合画面调性）
function generateCreativeTitle(selections, oldTitle) {
  const hairs = (selections && selections['hair_color']) || '';
  const fabric = (selections && (selections['integrated_fabric'] || selections['bottom_material'])) || '';
  const mood = (selections && selections['emotion']) || '';

  const prefixes = [hairs, fabric, mood, '微光', '暮色', '浮光', '暗香', '素影', '赤霞', '流金', '月影', '冷雾', '朱弦', '清澜', '回眸', '私语', '微澜', '薄暮'].filter(Boolean);
  const suffixes = ['之诗', '肖像', '晨曦', '晚风', '私语', '留白', '独白', '微澜', '浮影', '幽光', '秘境', '凝眸', '序章', '沉醉', '薄雾', '流韵'].filter(Boolean);

  let newTitle = '';
  for (let i = 0; i < 30; i++) {
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const candidate = `${p}与${s}`;
    if (candidate !== oldTitle && candidate.length <= 10) {
      newTitle = candidate;
      break;
    }
  }
  return newTitle || `光影写真·${Date.now().toString().slice(-4)}`;
}

// 🎬 搭配：以当前生效的锁定池为硬性条件协调设计未锁定内容，生成完整提示词写入主提示词框
async function handleAiDirectorMatch() {
  if (state.isGeneratingLlm) return;
  const mainPromptBox = document.getElementById('main-prompt-box');
  const titleInput = document.getElementById('project-title');
  const matchBtnStudio = document.getElementById('btn-director-match-studio');
  const matchBtnTop = document.getElementById('btn-director-match');
  const warningBanner = document.getElementById('prompt-outdated-warning');

  state.isGeneratingLlm = true;
  if (matchBtnStudio) {
    matchBtnStudio.disabled = true;
    matchBtnStudio.innerHTML = '<span>🎬 搭配中...</span>';
  }
  if (matchBtnTop) {
    matchBtnTop.disabled = true;
    matchBtnTop.innerHTML = '<span>🎬 搭配中...</span>';
  }

  // 1. 严格整理仅当前生效的锁定池条件 (带 [分组名·字段名]＝值)
  const lockedItems = [];
  state.allFields.forEach(f => {
    const val = state.selections[f.id];
    if (val && state.locks[f.id] && isFieldPartitionActive(f.id)) {
      let gName = '参数';
      for (const g of state.groups) {
        if (g.fields.some(field => field.id === f.id)) {
          gName = g.name;
          break;
        }
      }
      lockedItems.push(`- 【${gName}·${f.name}】＝ ${val}`);
    }
  });

  const currentTitle = titleInput ? titleInput.value.trim() : '';

  // 2. 收集最近10次方案的摘要信息用于七维去重
  const recentSignatures = (state.history || []).slice(0, 10).map((h, idx) => {
    return `#${idx + 1} 《${h.title || '摄影方案'}》: ${(h.actualPrompt || '').slice(0, 80)}...`;
  });

  const lang = state.promptLanguage || 'zh';
  let promptText = '';

  if (lang === 'en') {
    if (lockedItems.length > 0) {
      promptText = `[User Mandatory Locked Anchors (Absolute constraints - you must 100% strictly preserve, incorporate and highlight in the scene)]:\n${lockedItems.join('\n')}\n\n`;
    } else {
      promptText = `No specific attributes are currently locked. As an internationally acclaimed fashion photography director, freely curate an aesthetically sophisticated, deeply atmospheric, and masterfully lit adult female portrait photography proposal.\n\n`;
    }

    if (currentTitle) {
      promptText += `[Perspective & Title Variation Directive]:\nThe previous collection title was "${currentTitle}". In this new rendition, please compose fresh lighting atmospheres and spatial depth while strictly adhering to all locked anchors, and invent an original, poetic, non-repetitive English collection title (DO NOT reuse "${currentTitle}")!\n\n`;
    }

    if (recentSignatures.length > 0) {
      promptText += `[Recent Photography Records for 7-Dimensional Divergence]:\n${recentSignatures.join('\n')}\n\n`;
    }

    promptText += `Please synthesize all unlocked spatial and stylistic dimensions, and produce the comprehensive photography project title and standalone English prompt.`;
  } else {
    if (lockedItems.length > 0) {
      promptText = `【用户指定的硬性核心要求（已锁定锚点，你必须100%严格保留贯彻并在画面中重点呈现）】：\n${lockedItems.join('\n')}\n\n`;
    } else {
      promptText = `用户当前未锁定任何具体维度，请你作为国际顶级时尚摄影导演，自由搭配一套极具美感张力、摄影光影极佳的成片方案。\n\n`;
    }

    if (currentTitle) {
      promptText += `【重新搭配命名与视角指令】：\n当前画面的旧片名为《${currentTitle}》。本次点击「重新搭配」，请在保留所有锁定条件的前提下，设计不同的光影空间与视觉意境，并且必须重新拟定一个意境高雅、绝不重复的全新作品片名（严禁再次命名为《${currentTitle}》）！\n\n`;
    }

    if (recentSignatures.length > 0) {
      promptText += `【最近生成的作品参考（请执行七维去重，在人物骨相五官、服装搭配、支撑支点、构图空间、机位焦段、光影调性、情绪张力中至少有4个可变维度明显不同，拒绝同脸模板与同质化穿搭）】：\n${recentSignatures.join('\n')}\n\n`;
    }

    promptText += `请协调所有未锁定的留白维度，输出完整的作品企划标题与摄影提示词方案。`;
  }

  try {
    let generatedPrompt = '';
    let generatedTitle = '';

    // 若配置了有效的 LLM API，调用大模型生成 (支持中英文原生构思)
    if (state.settings?.llm?.apiKey) {
      const res = await ApiService.generateLlmPrompt(promptText, state.settings?.llm, lang);
      if (res && (res.content || res.prompt)) {
        const content = (res.content || res.prompt).trim();
        const hasEnHeader = content.includes('[Photography Prompt]') || content.includes('Photography Prompt:');
        const hasZhHeader = content.includes('【摄影提示词】');

        if (hasZhHeader || hasEnHeader) {
          const splitToken = hasZhHeader ? '【摄影提示词】' : (content.includes('[Photography Prompt]') ? '[Photography Prompt]' : 'Photography Prompt:');
          const parts = content.split(splitToken);
          generatedTitle = parts[0].replace(/【(?:作品企划标题|企划标题|标题)】|\[(?:Project Title|Title)\]|Project Title:|Title:/gi, '').replace(/^[《"'\s：:]+|[》"'\s：:]+$/g, '').trim().split('\n')[0].trim();
          generatedPrompt = parts[1].replace(/^[：:\n\r]+/, '').trim();
        } else if (content.includes('【作品企划标题】') || content.includes('[Project Title]')) {
          const splitToken = content.includes('【作品企划标题】') ? '【作品企划标题】' : '[Project Title]';
          const parts = content.split(splitToken);
          generatedTitle = parts[1].trim().split('\n')[0].replace(/^[《"'\s：:]+|[》"'\s：:]+$/g, '').trim();
          generatedPrompt = content.replace(/(?:【作品企划标题】|\[Project Title\])[\s\S]*?\n/, '').trim();
        } else {
          generatedPrompt = content.trim();
        }

        if (!generatedPrompt && content) {
          generatedPrompt = content.replace(/^#+ [^\n]+\n/g, '').replace(/【作品企划标题】[^\n]*\n?/g, '').replace(/\[Project Title\][^\n]*\n?/g, '').trim();
        }
      }

      // 健壮性兜底：若大模型因极端超限导致返回空串，自动无缝切换到本地导演保全方案，绝不留空！
      if (!generatedPrompt) {
        const coordinated = XingSeDirector.directorCoordinateMatch(state.allFields, state.selections, state.locks, isFieldPartitionActive);
        if (lang === 'en') {
          generatedPrompt = XingSeDirector.assembleEnglishPrompt(coordinated);
        } else {
          generatedPrompt = XingSeDirector.assembleChinesePrompt(coordinated, state.fieldsMap);
        }
        showToast('大模型思维链暂未返回正文，已自动无缝为您调用本地高保真导演方案', 'warning');
      }
    } else {
      // 离线/未配置 LLM 时的本地导演拼接备用逻辑
      const coordinated = XingSeDirector.directorCoordinateMatch(state.allFields, state.selections, state.locks, isFieldPartitionActive);
      if (lang === 'en') {
        generatedPrompt = XingSeDirector.assembleEnglishPrompt(coordinated);
        generatedTitle = `Cinematic Portrait ${Date.now().toString().slice(-4)}`;
      } else {
        generatedPrompt = XingSeDirector.assembleChinesePrompt(coordinated, state.fieldsMap);
        generatedTitle = generateCreativeTitle(state.selections, currentTitle);
      }
    }

    if (!generatedTitle || generatedTitle === currentTitle) {
      generatedTitle = (lang === 'en') ? `Cinematic Portrait ${Date.now().toString().slice(-4)}` : generateCreativeTitle(state.selections, currentTitle);
    }

    if (generatedTitle && titleInput) {
      titleInput.value = generatedTitle;
    }
    if (mainPromptBox && generatedPrompt) {
      mainPromptBox.value = generatedPrompt;
    }

    if (warningBanner) warningBanner.style.display = 'none';
    updatePromptBoxStatus();
    switchWorkspaceTab('prompt');

    showToast(`✓ AI摄影导演已基于您的 ${lockedItems.length} 项生效锁定完成搭配 (${lang === 'en' ? 'English 原生英文' : '原生中文'})！已写入提示词框，可直接审阅或编辑`, 'success');
  } catch (err) {
    showToast(`搭配请求失败: ${err.message}`, 'error');
  } finally {
    state.isGeneratingLlm = false;
    if (matchBtnStudio) {
      matchBtnStudio.disabled = false;
      matchBtnStudio.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>🎬 搭配</span>
      `;
    }
    if (matchBtnTop) {
      matchBtnTop.disabled = false;
      matchBtnTop.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>🎬 搭配</span>
      `;
    }
    updatePromptBoxStatus();
  }
}

// ✨ 优化提示词：在现有方案上进行质感与细节优化，严格保留身份、锁定条件与主要设计 (支持中/英文)
async function handleAiOptimizePrompt() {
  const mainPromptBox = document.getElementById('main-prompt-box');
  const currentText = mainPromptBox ? mainPromptBox.value.trim() : '';
  if (!currentText) {
    showToast('提示词框为空，请先点击「搭配」或输入提示词后再进行优化', 'warning');
    return;
  }

  const optBtn = document.getElementById('btn-ai-optimize-prompt');
  if (optBtn) {
    optBtn.disabled = true;
    optBtn.innerHTML = '<span>✨ 优化中...</span>';
  }

  const lockedItems = [];
  state.allFields.forEach(f => {
    const val = state.selections[f.id];
    if (val && state.locks[f.id] && isFieldPartitionActive(f.id)) {
      lockedItems.push(`- 【${f.name}】＝ ${val}`);
    }
  });

  const lang = state.promptLanguage || 'zh';
  let promptText = '';

  if (lang === 'en') {
    promptText = `Here is the user's current photography prompt proposal:\n${currentText}\n\nMandatory locked conditions (must be strictly preserved):\n${lockedItems.join('\n') || 'None'}\n\nPlease strictly preserve all locked constraints, core character identity, and composition framework, while elevating the professional photography details, optical surface scattering, tactile textile weaves, authentic gravity balance, and prime lens chiaroscuro. Output only the refined, complete standalone English photography prompt.`;
  } else {
    promptText = `这是用户当前的摄影提示词方案：\n${currentText}\n\n当前锁定的硬性条件（必须严格保留，不得更改）：\n${lockedItems.join('\n') || '无明确锁定项'}\n\n请在严格保留该方案的主角身份设定、所有锁定条件与核心画面构架的前提下，对该提示词进行专业摄影细节与画面质感润色（增强物理真实感、微观材质纹理反光、受力重力平衡、景深透光与胶片色温层级，消除生硬词汇堆砌）。请只输出优化后的完整摄影提示词正文。`;
  }

  try {
    const res = await ApiService.generateLlmPrompt(promptText, state.settings?.llm, lang);
    if (res && (res.content || res.prompt)) {
      let polished = res.content || res.prompt;
      if (polished.includes('【摄影提示词】')) {
        polished = polished.split('【摄影提示词】')[1].replace(/^[：:\n\r]+/, '').trim();
      } else if (polished.includes('[Photography Prompt]')) {
        polished = polished.split('[Photography Prompt]')[1].replace(/^[：:\n\r]+/, '').trim();
      }
      mainPromptBox.value = polished;
      updatePromptBoxStatus();
      showToast('✓ 提示词已优化完成（保留了所有锁定项与身份骨架）', 'success');
    }
  } catch (err) {
    showToast(`优化失败: ${err.message}`, 'error');
  } finally {
    if (optBtn) {
      optBtn.disabled = false;
      optBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="m19.07 4.93-1.41 1.41M4.93 19.07l1.41-1.41M2 12h2M20 12h2M12 2v2M12 20v2M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41"/></svg>
        <span>✨ 优化提示词</span>
      `;
    }
  }
}

// 🚀 生图：直接读取并提交框内当前完整文字
async function handleGenerateImage() {
  if (state.isGeneratingImage) return;

  const mainPromptBox = document.getElementById('main-prompt-box');
  const prompt = mainPromptBox ? mainPromptBox.value.trim() : '';

  if (!prompt) {
    showToast('提交生图的提示词不能为空，请先搭配或在框内输入提示词', 'warning');
    return;
  }

  const titleInput = document.getElementById('project-title');
  const projectTitle = titleInput?.value.trim() || '形色摄影作品';

  switchWorkspaceTab('canvas');

  const canvasLoading = document.getElementById('canvas-loading');
  const canvasEmpty = document.getElementById('canvas-empty');
  const canvasImg = document.getElementById('canvas-image');
  const footerBar = document.getElementById('canvas-footer-bar');
  const fileNameEl = document.getElementById('canvas-file-name');
  const filePathEl = document.getElementById('canvas-file-path');
  const genBtn = document.getElementById('btn-generate-image');
  const timeEl = document.getElementById('canvas-time');

  state.isGeneratingImage = true;
  if (canvasLoading) canvasLoading.style.display = 'flex';
  if (canvasEmpty) canvasEmpty.style.display = 'none';
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.innerHTML = '<span>🚀 渲染生成中...</span>';
  }

  let startTime = Date.now();
  let timerInterval = setInterval(() => {
    if (timeEl) timeEl.textContent = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
  }, 100);

  try {
    const ar = state.selections['aspect_ratio'] || '1:1';
    const size = XingSeDirector.getActualSubmitSize(ar);

    // 直接读取并提交框内当前文字
    const res = await ApiService.generateImage(prompt, size, projectTitle, state.settings?.imageGen);

    clearInterval(timerInterval);
    updateCanvasDisplay(res.localUrl || res.imageUrl, res.title || projectTitle, res.savedFile, res.savedPath, ar);

    if (res.savedSuccess) {
      if (fileNameEl) fileNameEl.textContent = `已保存: ${res.savedFile}`;
      if (filePathEl) filePathEl.textContent = res.savedPath;
      showToast(`生图成功！图片已自动归档保存，耗时: ${(res.elapsedMs / 1000).toFixed(1)}s`, 'success');
    } else {
      if (fileNameEl) fileNameEl.innerHTML = `<span style="color:#f87171;">生成成功，但本地保存失败 (${res.savedError || '写入异常'})</span>`;
      if (filePathEl) filePathEl.innerHTML = `<button class="btn btn-secondary btn-sm" id="btn-retry-save-image">🔄 重试保存到本地</button>`;
      document.getElementById('btn-retry-save-image')?.addEventListener('click', async () => {
        try {
          const saveRes = await ApiService.saveLocalImage(res.imageUrl, projectTitle);
          if (fileNameEl) fileNameEl.textContent = `已补存: ${saveRes.savedFile}`;
          if (filePathEl) filePathEl.textContent = saveRes.savedPath;
          showToast('本地保存成功！', 'success');
        } catch (saveErr) {
          showToast(`保存失败: ${saveErr.message}`, 'error');
        }
      });
      showToast('图片生成成功，但写入本地磁盘失败', 'warning');
    }

    // 保存到历史记录中（包含实际提交正文）
    const historyItem = {
      id: 'hist_' + Date.now(),
      timestamp: new Date().toISOString(),
      title: res.title || projectTitle,
      actualPrompt: prompt,
      promptZh: prompt,
      promptEn: '',
      displayUrl: res.localUrl || res.imageUrl,
      imageUrl: res.imageUrl,
      savedSuccess: res.savedSuccess,
      savedFile: res.savedFile,
      savedPath: res.savedPath,
      model: res.model,
      size: size,
      aspectRatio: ar,
      provider: res.provider || 'custom',
      selections: { ...state.selections },
      locks: { ...state.locks }
    };

    // 内存同步立即生效，确保画廊与胶卷底片轴即时渲染且无延迟
    state.history.unshift(historyItem);
    if (state.history.length > 100) state.history.pop();

    await ApiService.saveHistory(historyItem);

    // 胶卷底片轴同步新增
    const filmstripItem = {
      id: Date.now(),
      displayUrl: res.localUrl || res.imageUrl,
      imageUrl: res.imageUrl,
      title: res.title || projectTitle,
      savedFile: res.savedFile || '',
      savedPath: res.savedPath || '',
      actualPrompt: prompt,
      selections: { ...state.selections },
      locks: { ...state.locks }
    };
    state.filmstrip.unshift(filmstripItem);
    if (state.filmstrip.length > 12) state.filmstrip.pop();
    state.selectedFilmstripItem = filmstripItem;
    renderFilmstrip();

    loadGallery();
  } catch (err) {
    clearInterval(timerInterval);
    showToast(err.message, 'error');
    if (canvasEmpty) canvasEmpty.style.display = 'flex';
    if (canvasImg) canvasImg.style.display = 'none';
    if (footerBar) footerBar.style.display = 'none';
  } finally {
    state.isGeneratingImage = false;
    if (canvasLoading) canvasLoading.style.display = 'none';
    if (genBtn) {
      genBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        <span id="btn-generate-image-text">🚀 生图</span>
      `;
    }
    updatePromptBoxStatus();
  }
}

// 画布自适应展示系统 (智能画幅适配 + 微光漫反射氛围底层 + 比例徽章)
function updateCanvasDisplay(src, title, file, path, arOrSize) {
  const canvasImg = document.getElementById('canvas-image');
  const canvasEmpty = document.getElementById('canvas-empty');
  const footerBar = document.getElementById('canvas-footer-bar');
  const fileNameEl = document.getElementById('canvas-file-name');
  const filePathEl = document.getElementById('canvas-file-path');
  const ambientBackdrop = document.getElementById('canvas-ambient-backdrop');
  const aspectBadge = document.getElementById('canvas-aspect-badge');
  const canvasWrapper = document.getElementById('image-canvas-wrapper');

  if (!canvasImg || !src) return;

  canvasImg.onload = () => {
    const w = canvasImg.naturalWidth;
    const h = canvasImg.naturalHeight;
    let ratioLabel = arOrSize || '';
    if (!ratioLabel && w && h) {
      const ratio = w / h;
      if (Math.abs(ratio - 9/16) < 0.08) ratioLabel = '9:16 黄金人像';
      else if (Math.abs(ratio - 16/9) < 0.08) ratioLabel = '16:9 宽画幅';
      else if (Math.abs(ratio - 3/4) < 0.08) ratioLabel = '3:4 经典人像';
      else if (Math.abs(ratio - 4/3) < 0.08) ratioLabel = '4:3 典雅画幅';
      else if (Math.abs(ratio - 1) < 0.08) ratioLabel = '1:1 方画幅';
      else ratioLabel = `${w}×${h}`;
    }
    if (aspectBadge) {
      aspectBadge.textContent = ratioLabel.includes('📐') ? ratioLabel : `📐 ${ratioLabel}`;
      aspectBadge.style.display = 'block';
    }
    if (ambientBackdrop) {
      ambientBackdrop.style.backgroundImage = `url("${src}")`;
      ambientBackdrop.classList.add('active');
    }
    if (canvasWrapper) {
      if (h > w) {
        canvasWrapper.classList.add('portrait-mode');
      } else {
        canvasWrapper.classList.remove('portrait-mode');
      }
    }
  };

  canvasImg.src = src;
  canvasImg.style.display = 'block';
  canvasImg.dataset.title = title || '';
  canvasImg.dataset.file = file || '';
  canvasImg.dataset.path = path || '';

  if (canvasEmpty) canvasEmpty.style.display = 'none';
  if (footerBar) footerBar.style.display = 'flex';
  if (fileNameEl && file) fileNameEl.textContent = `当前作品: ${file}`;
  if (filePathEl && path) filePathEl.textContent = path;
}

// 渲染底片胶卷轴 (Filmstrip Ribbon)
function renderFilmstrip() {
  const scrollEl = document.getElementById('filmstrip-scroll');
  const countEl = document.getElementById('filmstrip-count');
  const quickBar = document.getElementById('quick-iteration-bar');
  if (!scrollEl) return;

  if (countEl) countEl.textContent = `${state.filmstrip.length} 张底片`;

  if (state.filmstrip.length === 0) {
    scrollEl.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding:6px 0;">出图后将在此生成胶卷序列...</div>';
    if (quickBar) quickBar.style.display = 'none';
    return;
  }

  scrollEl.innerHTML = '';
  state.filmstrip.forEach(item => {
    const thumb = document.createElement('div');
    const isActive = state.selectedFilmstripItem?.id === item.id;
    thumb.className = `filmstrip-thumb ${isActive ? 'active' : ''}`;
    const itemTitle = item.title || '摄影作品';
    const safeTitle = escapeHtml(itemTitle);
    const safeImgSrc = escapeHtml(item.displayUrl || item.imageUrl || '');
    thumb.title = `《${safeTitle}》· 点击切换对比并支持快捷微调`;
    thumb.innerHTML = `
      <img src="${safeImgSrc}" alt="${safeTitle}" />
      <button class="filmstrip-del-btn" title="从胶卷与历史中移除此作品" data-id="${item.id}">✕</button>
    `;

    // 点击缩略图切换
    thumb.addEventListener('click', () => {
      state.selectedFilmstripItem = item;
      document.querySelectorAll('.filmstrip-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      if (quickBar) quickBar.style.display = 'flex';

      // 画布上同步自适应预览此张底片
      updateCanvasDisplay(item.displayUrl || item.imageUrl, item.title, item.savedFile, item.savedPath, item.aspectRatio || item.size);
    });

    // 点击右上角 ✕ 删除
    thumb.querySelector('.filmstrip-del-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteHistoryItem(item.id, itemTitle);
    });

    scrollEl.appendChild(thumb);
  });
}

// 统一删除作品记录（同步胶卷、画廊与持久化存储）
async function deleteHistoryItem(id, title) {
  if (!id) return;

  // 1. 从胶卷数组中剔除
  state.filmstrip = state.filmstrip.filter(f => String(f.id) !== String(id));
  if (state.selectedFilmstripItem && String(state.selectedFilmstripItem.id) === String(id)) {
    state.selectedFilmstripItem = state.filmstrip[0] || null;
    if (state.selectedFilmstripItem) {
      updateCanvasDisplay(
        state.selectedFilmstripItem.displayUrl || state.selectedFilmstripItem.imageUrl,
        state.selectedFilmstripItem.title,
        state.selectedFilmstripItem.savedFile,
        state.selectedFilmstripItem.savedPath,
        state.selectedFilmstripItem.aspectRatio || state.selectedFilmstripItem.size
      );
    } else {
      updateCanvasDisplay('', '', '', '', '');
      const quickBar = document.getElementById('quick-iteration-bar');
      if (quickBar) quickBar.style.display = 'none';
    }
  }

  // 2. 从历史数组中剔除
  state.history = state.history.filter(h => String(h.id) !== String(id));
  // 3. 从精选收藏中剔除
  state.favorites = state.favorites.filter(favId => String(favId) !== String(id));
  localStorage.setItem('xingse_favorites', JSON.stringify(state.favorites));

  // 4. 调用后端与本地持久化删除
  try {
    await ApiService.deleteHistory(id);
  } catch (err) {
    console.warn('Delete history item error:', err);
  }

  // 5. 同步重绘胶卷、画廊与影集徽章 (即时生效，无须刷新页面！)
  updateHeaderGalleryCount();
  renderFilmstrip();
  renderGalleryAlbums();
  renderGallery();
  showToast(`已删除作品《${title || '未命名'}》`, 'info');
}

// 一键清空画廊全部历史作品
async function clearAllGalleryHistory() {
  if (state.history.length === 0 && state.filmstrip.length === 0) {
    showToast('当前画廊已是空的', 'info');
    return;
  }
  if (!confirm('确定清空全部历史生图作品记录吗？此操作不可撤销。')) {
    return;
  }

  state.history = [];
  state.filmstrip = [];
  state.favorites = [];
  localStorage.removeItem('xingse_favorites');
  state.selectedFilmstripItem = null;
  updateCanvasDisplay('', '', '', '', '');
  const quickBar = document.getElementById('quick-iteration-bar');
  if (quickBar) quickBar.style.display = 'none';

  try {
    await ApiService.clearHistory();
  } catch (err) {
    console.warn('Clear history error:', err);
  }

  updateHeaderGalleryCount();
  renderFilmstrip();
  renderGalleryAlbums();
  renderGallery();
  showToast('历史画廊已全部清空', 'success');
}

// 全屏大图灯箱控制器
const lightboxState = {
  scale: 1,
  posX: 0,
  posY: 0,
  isDragging: false,
  startX: 0,
  startY: 0
};

function updateLightboxTransform() {
  const img = document.getElementById('lightbox-img');
  const scaleText = document.getElementById('lightbox-scale-text');
  if (!img) return;
  img.style.transform = `translate(${lightboxState.posX}px, ${lightboxState.posY}px) scale(${lightboxState.scale})`;
  if (scaleText) scaleText.textContent = `${Math.round(lightboxState.scale * 100)}%`;
}

function openLightbox(imageUrl, title, meta) {
  const box = document.getElementById('image-lightbox');
  const img = document.getElementById('lightbox-img');
  const titleEl = document.getElementById('lightbox-title');
  const metaEl = document.getElementById('lightbox-meta');
  if (!box || !img) return;

  img.src = imageUrl;
  if (titleEl) titleEl.textContent = title || '摄影作品大图预览';
  if (metaEl) metaEl.textContent = meta || '';

  lightboxState.scale = 1;
  lightboxState.posX = 0;
  lightboxState.posY = 0;
  updateLightboxTransform();

  box.style.display = 'flex';
}

function closeLightbox() {
  const box = document.getElementById('image-lightbox');
  if (box) box.style.display = 'none';
}

function zoomLightbox(delta) {
  lightboxState.scale = Math.min(Math.max(lightboxState.scale + delta, 0.2), 4);
  updateLightboxTransform();
}

function resetLightboxZoom() {
  lightboxState.scale = 1;
  lightboxState.posX = 0;
  lightboxState.posY = 0;
  updateLightboxTransform();
}

function downloadImage(url, filename) {
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `形色作品_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 更新顶栏画廊数量角标
function updateHeaderGalleryCount() {
  const badge = document.getElementById('header-gallery-count');
  if (badge) badge.textContent = state.history.length;
  const sub = document.getElementById('exhibition-count-subtitle');
  if (sub) sub.textContent = `共 ${state.history.length} 张作品`;
}

// 打开独立全屏摄影展厅
function openGalleryExhibition() {
  const overlay = document.getElementById('gallery-exhibition-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  renderGalleryAlbums();
  renderGallery();
}

// 关闭全屏摄影展厅
function closeGalleryExhibition() {
  const overlay = document.getElementById('gallery-exhibition-overlay');
  if (overlay) overlay.style.display = 'none';
}

// 智能聚合影集分类 (按风格主题与精选自动分类)
function extractSmartAlbums() {
  const albums = [
    { id: 'all', name: '全部作品', icon: '🌟', count: state.history.length },
    { id: 'favorites', name: '精选收藏', icon: '⭐', count: state.favorites.length }
  ];

  const themeCounts = {};
  state.history.forEach(item => {
    const theme = item.selections?.theme || item.theme;
    if (theme) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  });

  const themeIcons = {
    '日系清透写真': '🌸',
    '韩系极简氛围': '🫧',
    '法式慵懒随性': '☕',
    '港风复古胶片': '🎞️',
    '欧美高定时装': '✨',
    '新中式清冷雅韵': '🎋',
    '纯欲私房漫度': '🕯️',
    '海边度假旅拍': '🏖️',
    '街头潮流抓拍': '🛹',
    '电影叙事大片': '🎬',
    '复古柯达胶片': '📷',
    '原生日常纪实': '🍃'
  };

  Object.entries(themeCounts).forEach(([theme, count]) => {
    albums.push({
      id: `theme:${theme}`,
      name: theme,
      icon: themeIcons[theme] || '🎨',
      count
    });
  });

  return albums;
}

// 渲染智能影集横向导航栏
function renderGalleryAlbums() {
  const bar = document.getElementById('exhibition-albums-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const albums = extractSmartAlbums();
  albums.forEach(album => {
    const pill = document.createElement('div');
    const isActive = state.galleryFilterAlbum === album.id;
    pill.className = `album-pill ${isActive ? 'active' : ''}`;
    pill.innerHTML = `
      <span>${album.icon} ${album.name}</span>
      <span class="album-count-badge">${album.count}</span>
    `;
    pill.addEventListener('click', () => {
      state.galleryFilterAlbum = album.id;
      renderGalleryAlbums();
      renderGallery();
    });
    bar.appendChild(pill);
  });
}

// 渲染画廊作品卡片列表 (含排序与筛选)
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  grid.innerHTML = '';

  updateHeaderGalleryCount();

  // 1. 筛选 (影集与搜索)
  let list = [...state.history];

  if (state.galleryFilterAlbum === 'favorites') {
    list = list.filter(item => state.favorites.includes(String(item.id)));
  } else if (state.galleryFilterAlbum.startsWith('theme:')) {
    const targetTheme = state.galleryFilterAlbum.replace('theme:', '');
    list = list.filter(item => (item.selections?.theme === targetTheme) || (item.theme === targetTheme) || (item.actualPrompt && item.actualPrompt.includes(targetTheme)));
  }

  if (state.gallerySearchQuery) {
    const q = state.gallerySearchQuery.toLowerCase();
    list = list.filter(item => {
      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const promptMatch = (item.actualPrompt || item.promptZh || item.promptEn || '').toLowerCase().includes(q);
      const modelMatch = (item.model || '').toLowerCase().includes(q);
      const fileMatch = (item.savedFile || '').toLowerCase().includes(q);
      return titleMatch || promptMatch || modelMatch || fileMatch;
    });
  }

  // 2. 排序
  list.sort((a, b) => {
    const timeA = Number(a.timestamp) || (typeof a.id === 'string' && a.id.startsWith('hist_') ? Number(a.id.replace('hist_', '')) : 0);
    const timeB = Number(b.timestamp) || (typeof b.id === 'string' && b.id.startsWith('hist_') ? Number(b.id.replace('hist_', '')) : 0);

    switch (state.gallerySort) {
      case 'time-asc':
        return timeA - timeB;
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'ar':
        return (a.aspectRatio || a.size || '').localeCompare(b.aspectRatio || b.size || '');
      case 'theme':
        return (a.selections?.theme || '').localeCompare(b.selections?.theme || '');
      case 'time-desc':
      default:
        return timeB - timeA;
    }
  });

  // 3. 空状态展示
  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: var(--text-muted);">
        <div style="font-size: 2.4rem; margin-bottom: 12px; opacity: 0.6;">🖼️</div>
        <div style="font-size: 0.95rem; font-weight: 500; margin-bottom: 6px; color: var(--text-secondary);">
          ${state.gallerySearchQuery ? '未找到符合检索条件的作品' : (state.galleryFilterAlbum === 'favorites' ? '当前还没有收藏任何作品，点击卡片右上角星标即可收藏' : '此影集中暂无作品')}
        </div>
        <div style="font-size: 0.78rem; opacity: 0.7;">可在创作控制台生成新图片，自动收录至对应影集</div>
      </div>
    `;
    return;
  }

  // 4. 渲染卡片
  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.id = item.id;
    const itemTitle = item.title || '摄影作品';
    let displayImg = item.displayUrl || item.imageUrl || '';
    if (!displayImg && item.savedPath && window.__TAURI__?.core?.convertFileSrc) {
      try {
        displayImg = window.__TAURI__.core.convertFileSrc(item.savedPath);
      } catch (e) {}
    }

    const safeTitle = escapeHtml(itemTitle);
    const safeImgSrc = escapeHtml(displayImg);
    const isFav = state.favorites.includes(String(item.id));
    const arText = item.aspectRatio || (item.size ? item.size.replace('*', '×') : '');
    const themeTag = item.selections?.theme || item.theme || '';
    const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

    card.innerHTML = `
      <div class="gallery-card-img-wrap">
        <img src="${safeImgSrc}" alt="${safeTitle}" loading="lazy" />
        ${arText ? `<span class="gallery-card-badge">${arText}</span>` : ''}
        
        <!-- 浮动操作按钮条 -->
        <div class="gallery-card-top-actions">
          <button class="gallery-action-btn ${isFav ? 'is-fav' : ''}" title="${isFav ? '取消收藏' : '加入精选收藏'}" data-action="fav">
            ${isFav ? '⭐' : '☆'}
          </button>
          <button class="gallery-action-btn" title="全屏大图预览 (灯箱)" data-action="zoom">
            🔍
          </button>
          <button class="gallery-action-btn" title="下载原图" data-action="download">
            ⬇️
          </button>
          <button class="gallery-action-btn btn-del-action" title="删除作品" data-action="del">
            ✕
          </button>
        </div>
      </div>

      <div class="gallery-card-footer">
        <div class="gallery-card-title-row">
          <span class="gallery-card-title-text" title="${safeTitle}">${safeTitle}</span>
          <button class="gallery-card-restore-btn" title="将当时的提示词、85个选项与锁定池完全装载回控制台，并返回创作" data-action="restore">
            🎨 装填创作
          </button>
        </div>
        <div class="gallery-card-meta-row">
          <span>${themeTag ? '🏷️ ' + themeTag : (item.model || 'AI')}</span>
          <span>${dateStr}</span>
        </div>
      </div>
    `;

    // 图片加载失败降级
    const gImg = card.querySelector('img');
    if (gImg) {
      gImg.onerror = () => {
        if (item.imageUrl && gImg.src !== item.imageUrl) {
          gImg.src = item.imageUrl;
        } else if (item.savedPath && window.__TAURI__?.core?.convertFileSrc) {
          try {
            gImg.src = window.__TAURI__.core.convertFileSrc(item.savedPath);
          } catch (e) {}
        }
      };
    }

    // 点击大图
    card.querySelector('.gallery-card-img-wrap')?.addEventListener('click', (e) => {
      if (e.target.closest('.gallery-card-top-actions')) return;
      openLightbox(displayImg || item.imageUrl, itemTitle, `${item.model || 'AI'} · ${arText} · ${item.savedFile || ''}`);
    });

    // 按钮事件派发
    card.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      if (!action) return;
      e.stopPropagation();

      if (action === 'zoom') {
        openLightbox(displayImg || item.imageUrl, itemTitle, `${item.model || 'AI'} · ${arText} · ${item.savedFile || ''}`);
      } else if (action === 'download') {
        downloadImage(displayImg || item.imageUrl, `${itemTitle}.png`);
        showToast(`已开始下载《${itemTitle}》`, 'success');
      } else if (action === 'fav') {
        const idStr = String(item.id);
        if (state.favorites.includes(idStr)) {
          state.favorites = state.favorites.filter(x => x !== idStr);
          btn.innerHTML = '☆';
          btn.classList.remove('is-fav');
          btn.title = '加入精选收藏';
          showToast(`已取消收藏《${itemTitle}》`, 'info');
        } else {
          state.favorites.push(idStr);
          btn.innerHTML = '⭐';
          btn.classList.add('is-fav');
          btn.title = '取消收藏';
          showToast(`已将《${itemTitle}》加入精选收藏！`, 'success');
        }
        localStorage.setItem('xingse_favorites', JSON.stringify(state.favorites));
        renderGalleryAlbums();
      } else if (action === 'del') {
        if (confirm(`确定从画廊与历史记录中删除作品《${itemTitle}》吗？`)) {
          // 即时动画淡出，无需刷新！
          card.style.transition = 'all 0.25s ease';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.85)';
          setTimeout(async () => {
            await deleteHistoryItem(item.id, itemTitle);
          }, 200);
        }
      } else if (action === 'restore') {
        restoreItemToConsole(item);
      }
    });

    grid.appendChild(card);
  });
}

// 装填历史作品到控制台
function restoreItemToConsole(item) {
  const itemTitle = item.title || '摄影作品';
  const mainPromptBox = document.getElementById('main-prompt-box');
  const titleInput = document.getElementById('project-title');
  const warningBanner = document.getElementById('prompt-outdated-warning');

  if (mainPromptBox) {
    mainPromptBox.value = item.actualPrompt || item.promptZh || item.promptEn || '';
  }
  if (titleInput) {
    titleInput.value = item.title || itemTitle;
  }

  state.selections = item.selections ? { ...item.selections } : {};
  state.locks = item.locks ? { ...item.locks } : {};

  state.allFields.forEach(f => {
    refreshFieldCardChips(f.id);
    refreshFieldCardLockState(f.id);
  });
  updateActiveConditionals();
  renderLockPool();
  updateAspectRatioDisplay();
  updateStatusSummary();
  updateSidebarBadges();
  saveSelectionsToLocal();
  if (warningBanner) warningBanner.style.display = 'none';
  updatePromptBoxStatus();

  closeGalleryExhibition();
  switchWorkspaceTab('prompt');
  showToast(`已将《${itemTitle}》的全部选项、锁定池与实际提示词装填回控制台，可进行二次创作与微调！`, 'success');
}

// 加载历史画廊
async function loadGallery() {
  try {
    const history = await ApiService.getHistory();
    if (Array.isArray(history)) {
      state.history = history;
    }

    // 初始底片胶卷填充
    if (state.history.length > 0 && state.filmstrip.length === 0) {
      state.filmstrip = state.history.slice(0, 10).map(h => ({
        id: h.timestamp || h.id || Date.now() + Math.random(),
        displayUrl: h.displayUrl || h.localUrl || h.imageUrl || '',
        imageUrl: h.imageUrl || '',
        title: h.title || '摄影作品',
        savedFile: h.savedFile || '',
        savedPath: h.savedPath || '',
        actualPrompt: h.actualPrompt || h.promptZh || '',
        selections: h.selections || {},
        locks: h.locks || {}
      }));
      state.selectedFilmstripItem = state.filmstrip[0];
      renderFilmstrip();
    }

    updateHeaderGalleryCount();
    renderGallery();
  } catch (err) {
    console.error('Load Gallery Error:', err);
  }
}

// 工作舱 Tab 切换 (提示词 Studio / 生图画布)
function switchWorkspaceTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.ws-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  const promptPanel = document.getElementById('panel-prompt');
  const canvasPanel = document.getElementById('panel-canvas');

  if (promptPanel) promptPanel.style.display = tab === 'prompt' ? 'flex' : 'none';
  if (canvasPanel) canvasPanel.style.display = tab === 'canvas' ? 'flex' : 'none';
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// 绑定全局事件
function bindGlobalEvents() {
  // 顶栏快捷操作
  document.getElementById('btn-toggle-console')?.addEventListener('click', toggleConsoleCollapse);
  document.getElementById('btn-random-sample')?.addEventListener('click', runRandomSample);
  document.getElementById('btn-director-match')?.addEventListener('click', handleAiDirectorMatch);
  document.getElementById('btn-unlock-all')?.addEventListener('click', unlockAllFields);
  document.getElementById('btn-reset-all')?.addEventListener('click', () => {
    if (confirm('确定要清空当前所有选中的参数和锁定吗？')) resetConsole();
  });

  // 锁定池工具条解锁全部
  document.getElementById('btn-lock-pool-unlock-all')?.addEventListener('click', unlockAllFields);

  // 画廊一键清空全部
  document.getElementById('btn-clear-gallery')?.addEventListener('click', clearAllGalleryHistory);

  // 提示词输出语种切换 (中文 / English) - 立即无延迟换算并更新框内提示词
  document.getElementById('lang-btn-zh')?.addEventListener('click', () => {
    setPromptLanguage('zh', true);
    showToast('已切换至：中文原生摄影导演方案模式', 'info');
  });
  document.getElementById('lang-btn-en')?.addEventListener('click', () => {
    setPromptLanguage('en', true);
    showToast('Switched to English Photography Director mode (native cinematic prompts)', 'info');
  });

  // 提示词工作区正下方操作按钮群
  document.getElementById('btn-director-match-studio')?.addEventListener('click', handleAiDirectorMatch);
  document.getElementById('btn-generate-image')?.addEventListener('click', handleGenerateImage);
  document.getElementById('btn-ai-optimize-prompt')?.addEventListener('click', handleAiOptimizePrompt);
  document.getElementById('btn-random-sample-studio')?.addEventListener('click', runRandomSample);

  document.getElementById('btn-copy-prompt')?.addEventListener('click', () => {
    const text = document.getElementById('main-prompt-box')?.value;
    if (text) {
      navigator.clipboard.writeText(text);
      showToast('提示词已复制到剪贴板', 'success');
    }
  });

  document.getElementById('btn-clear-prompt')?.addEventListener('click', () => {
    const box = document.getElementById('main-prompt-box');
    if (box) {
      box.value = '';
      updatePromptBoxStatus();
      const warningBanner = document.getElementById('prompt-outdated-warning');
      if (warningBanner) warningBanner.style.display = 'none';
      showToast('提示词已清空', 'info');
    }
  });

  // 监听提示词框输入，实时同步字数与生图按钮禁用状态
  const mainPromptBox = document.getElementById('main-prompt-box');
  mainPromptBox?.addEventListener('input', () => {
    updatePromptBoxStatus();
    const warningBanner = document.getElementById('prompt-outdated-warning');
    if (warningBanner) warningBanner.style.display = 'none';
  });

  // API 设置按钮
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    populateSettingsForm();
    openModal('settings-modal');
  });
  document.getElementById('btn-close-settings')?.addEventListener('click', () => closeModal('settings-modal'));
  document.getElementById('btn-save-settings')?.addEventListener('click', handleSaveSettings);
  document.getElementById('btn-test-llm')?.addEventListener('click', handleTestLlm);
  document.getElementById('btn-test-image')?.addEventListener('click', handleTestImageGen);

  // 自建选项弹窗按钮
  document.getElementById('btn-close-custom-modal')?.addEventListener('click', () => closeModal('add-custom-modal'));
  document.getElementById('btn-submit-custom-option')?.addEventListener('click', handleAddCustomOptionSubmit);
  document.getElementById('custom-option-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddCustomOptionSubmit();
  });

  // 工作舱 Tab 切换
  document.querySelectorAll('.ws-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => switchWorkspaceTab(tabBtn.dataset.tab));
  });

  // 动态事件委托：组重置、字段锁定、字段随机、字段清空
  document.getElementById('console-main-container')?.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    if (target.classList.contains('btn-reset-group')) {
      const gId = target.dataset.groupId;
      if (confirm(`确定重置该组全部选项吗？`)) resetGroup(gId);
    } else if (target.classList.contains('btn-nav-prev')) {
      navigateGroup(-1);
    } else if (target.classList.contains('btn-nav-next')) {
      navigateGroup(1);
    } else if (target.classList.contains('btn-lock')) {
      const fId = target.dataset.fieldId;
      toggleFieldLock(fId);
    } else if (target.classList.contains('btn-random-field')) {
      const fId = target.dataset.fieldId;
      randomizeField(fId);
    } else if (target.classList.contains('btn-clear-field')) {
      const fId = target.dataset.fieldId;
      clearField(fId);
    }
  });

  // 供应商下拉联动与多档案平滑切换
  document.getElementById('llm-provider')?.addEventListener('change', (e) => {
    ensureProviderSettings();
    const newProvider = e.target.value;

    // 1. 暂存老平台的配置
    if (activeLlmProviderInForm) {
      if (!state.settings.llm.providers[activeLlmProviderInForm]) {
        state.settings.llm.providers[activeLlmProviderInForm] = {};
      }
      state.settings.llm.providers[activeLlmProviderInForm].baseUrl = getVal('llm-base-url');
      state.settings.llm.providers[activeLlmProviderInForm].apiKey = getVal('llm-api-key');
      state.settings.llm.providers[activeLlmProviderInForm].model = getVal('llm-model');
    }

    activeLlmProviderInForm = newProvider;
    const prof = state.settings.llm.providers[newProvider] || {};
    const preset = LLM_PRESETS[newProvider] || {};

    setVal('llm-base-url', prof.baseUrl || preset.baseUrl || '');
    setVal('llm-api-key', prof.apiKey || '');
    const targetModel = prof.model || preset.model || 'qwen-plus';
    setVal('llm-model', targetModel);
    updateLlmModelSelect(newProvider, targetModel);

    const statusEl = document.getElementById('llm-test-status');
    if (statusEl) statusEl.textContent = '';
  });

  document.getElementById('llm-model-select')?.addEventListener('change', (e) => {
    setVal('llm-model', e.target.value);
  });

  document.getElementById('image-provider')?.addEventListener('change', (e) => {
    ensureProviderSettings();
    const newProvider = e.target.value;

    // 1. 暂存老平台的配置
    if (activeImgProviderInForm) {
      if (!state.settings.imageGen.providers[activeImgProviderInForm]) {
        state.settings.imageGen.providers[activeImgProviderInForm] = {};
      }
      state.settings.imageGen.providers[activeImgProviderInForm].baseUrl = getVal('image-base-url');
      state.settings.imageGen.providers[activeImgProviderInForm].apiKey = getVal('image-api-key');
      state.settings.imageGen.providers[activeImgProviderInForm].model = getVal('image-model');
    }

    activeImgProviderInForm = newProvider;
    const prof = state.settings.imageGen.providers[newProvider] || {};
    const preset = IMAGE_PRESETS[newProvider] || {};

    setVal('image-base-url', prof.baseUrl || preset.baseUrl || '');
    setVal('image-api-key', prof.apiKey || '');
    const targetModel = prof.model || preset.model || 'wanx2.1-t2i-turbo';
    setVal('image-model', targetModel);
    updateImageModelSelect(newProvider, targetModel);

    const statusEl = document.getElementById('image-test-status');
    if (statusEl) statusEl.textContent = '';
  });

  document.getElementById('image-model-select')?.addEventListener('change', (e) => {
    setVal('image-model', e.target.value);
  });

  // 主工作舱快捷生图模型切换
  document.getElementById('quick-model-select')?.addEventListener('change', async (e) => {
    const raw = e.target.value;
    if (!raw) return;

    if (raw === '__open_settings__') {
      populateSettingsForm();
      openModal('settings-modal');
      updateQuickModelSelect();
      return;
    }

    const parts = raw.split(':');
    const targetProvider = parts[0];
    const targetModel = parts.slice(1).join(':');

    ensureProviderSettings();
    const prof = state.settings.imageGen.providers[targetProvider] || {};
    const apiKey = prof.apiKey || (targetProvider === state.settings.imageGen.provider ? state.settings.imageGen.apiKey : '');

    if (!apiKey && targetProvider !== 'ollama') {
      showToast(`提示：${IMAGE_PRESETS[targetProvider]?.name || targetProvider} 尚未配置 API Key，正在为您打开配置窗口`, 'warning');
      populateSettingsForm();
      const pSelect = document.getElementById('image-provider');
      if (pSelect) {
        pSelect.value = targetProvider;
        pSelect.dispatchEvent(new Event('change'));
      }
      openModal('settings-modal');
      updateQuickModelSelect();
      return;
    }

    // 立即激活并同步
    state.settings.imageGen.provider = targetProvider;
    state.settings.imageGen.model = targetModel;
    state.settings.imageGen.baseUrl = prof.baseUrl || IMAGE_PRESETS[targetProvider]?.baseUrl || '';
    state.settings.imageGen.apiKey = apiKey;

    try {
      localStorage.setItem('xingse_settings', JSON.stringify(state.settings));
      await ApiService.saveSettings(state.settings);
    } catch (err) {}

    updateApiStatusBadge();
    updateQuickModelSelect();
    showToast(`已快速切换至：${IMAGE_PRESETS[targetProvider]?.name || targetProvider} (${targetModel})`, 'success');
  });

  document.getElementById('btn-quick-config-api')?.addEventListener('click', () => {
    populateSettingsForm();
    openModal('settings-modal');
  });

  // 标题输入框修改后标记为用户自定义
  document.getElementById('project-title')?.addEventListener('input', (e) => {
    e.target.dataset.autoGenerated = 'false';
  });

  // 画布工具条与打开文件夹
  document.getElementById('btn-open-folder')?.addEventListener('click', async () => {
    try {
      const savePath = state.settings?.savePath || './outputs';
      await ApiService.openFolder(savePath);
      showToast('已在文件管理器中打开图片保存目录', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // 设置弹窗：浏览选择本地保存目录
  document.getElementById('btn-browse-save-dir')?.addEventListener('click', async () => {
    try {
      const currentPath = document.getElementById('settings-save-path')?.value.trim() || state.settings?.savePath || '';
      showToast('正在打开系统文件夹选择窗口...', 'info');
      const res = await ApiService.selectFolder(currentPath);
      if (res && res.path) {
        setVal('settings-save-path', res.path);
        showToast(`已选择保存目录: ${res.path}`, 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // 设置弹窗：直接打开输入的保存目录
  document.getElementById('btn-open-save-dir')?.addEventListener('click', async () => {
    try {
      const currentPath = document.getElementById('settings-save-path')?.value.trim() || state.settings?.savePath || './outputs';
      await ApiService.openFolder(currentPath);
      showToast(`已打开保存目录: ${currentPath}`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });

  // 画布点击放大与另存为
  const canvasImgEl = document.getElementById('canvas-image');
  canvasImgEl?.addEventListener('click', () => {
    if (canvasImgEl.src) {
      openLightbox(canvasImgEl.src, canvasImgEl.dataset.title, canvasImgEl.dataset.file);
    }
  });

  document.getElementById('btn-preview-lightbox')?.addEventListener('click', () => {
    if (canvasImgEl && canvasImgEl.src) {
      openLightbox(canvasImgEl.src, canvasImgEl.dataset.title, canvasImgEl.dataset.file);
    }
  });

  document.getElementById('btn-download-canvas-img')?.addEventListener('click', () => {
    if (canvasImgEl && canvasImgEl.src) {
      downloadImage(canvasImgEl.src, canvasImgEl.dataset.file);
      showToast('原图已开始下载', 'success');
    }
  });

  // 灯箱内控制按钮
  document.getElementById('btn-lightbox-close')?.addEventListener('click', closeLightbox);
  document.getElementById('btn-lightbox-zoom-in')?.addEventListener('click', () => zoomLightbox(0.25));
  document.getElementById('btn-lightbox-zoom-out')?.addEventListener('click', () => zoomLightbox(-0.25));
  document.getElementById('btn-lightbox-reset')?.addEventListener('click', resetLightboxZoom);
  document.getElementById('btn-lightbox-download')?.addEventListener('click', () => {
    const lImg = document.getElementById('lightbox-img');
    const title = document.getElementById('lightbox-title')?.textContent || '摄影作品';
    if (lImg && lImg.src) {
      downloadImage(lImg.src, `${title}.png`);
      showToast('大图下载已开始', 'success');
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
  document.getElementById('btn-lightbox-open-folder')?.addEventListener('click', async () => {
    try {
      const savePath = state.settings?.savePath || './outputs';
      await ApiService.openFolder(savePath);
      showToast('已在文件管理器中打开图片保存目录', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  });
  document.getElementById('btn-lightbox-download')?.addEventListener('click', () => {
    const lImg = document.getElementById('lightbox-img');
    const title = document.getElementById('lightbox-title')?.textContent || '摄影作品';
    if (lImg && lImg.src) {
      downloadImage(lImg.src, `${title}.png`);
      showToast('原图已开始下载', 'success');
    }
  });

  // 灯箱滚轮缩放与鼠标拖拽平移
  const lightboxBody = document.getElementById('lightbox-body');
  if (lightboxBody) {
    lightboxBody.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      zoomLightbox(delta);
    }, { passive: false });

    lightboxBody.addEventListener('mousedown', (e) => {
      if (e.target.id === 'btn-lightbox-close' || e.target.closest('button')) return;
      lightboxState.isDragging = true;
      lightboxState.startX = e.clientX - lightboxState.posX;
      lightboxState.startY = e.clientY - lightboxState.posY;
      lightboxBody.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!lightboxState.isDragging) return;
      lightboxState.posX = e.clientX - lightboxState.startX;
      lightboxState.posY = e.clientY - lightboxState.startY;
      updateLightboxTransform();
    });

    window.addEventListener('mouseup', () => {
      if (lightboxState.isDragging) {
        lightboxState.isDragging = false;
        lightboxBody.classList.remove('is-dragging');
      }
    });

    lightboxBody.addEventListener('dblclick', () => {
      resetLightboxZoom();
    });
  }

  // 顶栏主题配色切换
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
      showToast(`已切换至「${btn.title.split(' ')[0]}」主题`, 'info');
    });
  });

  // 底片胶卷轴快速微调
  document.getElementById('btn-quick-rematch')?.addEventListener('click', () => {
    if (!state.selectedFilmstripItem) return;
    const item = state.selectedFilmstripItem;
    state.selections = { ...(item.selections || {}) };
    state.locks = { ...(item.locks || {}) };
    state.allFields.forEach(f => {
      refreshFieldCardChips(f.id);
      refreshFieldCardLockState(f.id);
    });
    updateActiveConditionals();
    renderLockPool();
    updateAspectRatioDisplay();
    updateStatusSummary();
    updateSidebarBadges();
    saveSelectionsToLocal();
    switchWorkspaceTab('prompt');
    handleAiDirectorMatch();
  });

  document.getElementById('btn-quick-regenerate')?.addEventListener('click', () => {
    if (!state.selectedFilmstripItem) return;
    const item = state.selectedFilmstripItem;
    const mainPromptBox = document.getElementById('main-prompt-box');
    const titleInput = document.getElementById('project-title');
    if (mainPromptBox) mainPromptBox.value = item.actualPrompt || '';
    if (titleInput) titleInput.value = item.title || '形色摄影作品';
    updatePromptBoxStatus();
    handleGenerateImage();
  });

  // 顶部导航栏作品展厅独立入口与关闭
  document.getElementById('btn-open-gallery-modal')?.addEventListener('click', openGalleryExhibition);
  document.getElementById('btn-close-gallery-exhibition')?.addEventListener('click', closeGalleryExhibition);

  // 展厅排序切换
  const sortSelect = document.getElementById('gallery-sort-select');
  sortSelect?.addEventListener('change', (e) => {
    state.gallerySort = e.target.value;
    renderGallery();
  });

  // 展厅检索过滤
  const searchInput = document.getElementById('gallery-search-input');
  const searchClearBtn = document.getElementById('btn-gallery-search-clear');
  searchInput?.addEventListener('input', (e) => {
    state.gallerySearchQuery = e.target.value.trim();
    if (searchClearBtn) searchClearBtn.style.display = state.gallerySearchQuery ? 'block' : 'none';
    renderGallery();
  });
  searchClearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    state.gallerySearchQuery = '';
    searchClearBtn.style.display = 'none';
    renderGallery();
  });

  // 工作舱 Tab 切换 (提示词 Studio / 生图画布)
  document.querySelectorAll('.ws-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchWorkspaceTab(tab.dataset.tab);
    });
  });

  // 点击外部自动收起顺滑选项抽屉
  document.addEventListener('click', (e) => {
    if (currentActivePopover && !e.target.closest('.dense-picker-popover') && !e.target.closest('.capsule-value-badge')) {
      closeActivePopover();
    }
  });

  // 键盘快捷键监听 (Esc 关闭展厅、灯箱、抽屉与模态框)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeActivePopover();
      closeLightbox();
      closeGalleryExhibition();
      closeModal('settings-modal');
      closeModal('add-custom-modal');
    }
  });
}

// 页面加载完成后启动
window.addEventListener('DOMContentLoaded', initApp);
