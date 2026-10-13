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
  currentTab: 'prompt', // prompt | canvas | gallery
  history: [],
  isGeneratingLlm: false,
  isGeneratingImage: false,
  activeGroup: 'all'
};

// 常见 LLM 预设供应商
const LLM_PRESETS = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    name: 'DeepSeek (深度求索)'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    name: 'OpenAI (GPT-4o)'
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    name: 'Kimi (月之暗面)'
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-V3',
    name: '硅基流动 (SiliconFlow)'
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'qwen2.5:7b',
    name: 'Ollama 本地大模型'
  }
};

// 常见生图模型预设
const IMAGE_PRESETS = {
  custom: {
    baseUrl: 'https://api.gemai.cc/v1',
    model: 'gpt-image-2.5-low',
    name: '通用兼容生图接口 (gpt-image / 中转站)'
  },
  siliconflow: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'black-forest-labs/FLUX.1-schnell',
    name: '硅基流动 (FLUX.1-schnell 高速生图)'
  },
  siliconflow_dev: {
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'black-forest-labs/FLUX.1-dev',
    name: '硅基流动 (FLUX.1-dev 高画质)'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'dall-e-3',
    name: 'OpenAI (DALL-E 3)'
  }
};

// Toast 提示工具
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
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
  return true;
}

// 初始化应用
async function initApp() {
  // 0. 优先绑定全局 DOM 事件与模态框监听，确保任何情况下所有按钮可点击
  bindGlobalEvents();

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

  // 2. 11个具体大类
  state.groups.forEach(group => {
    const item = document.createElement('div');
    item.className = `nav-item ${state.activeGroup === group.id ? 'active' : ''}`;
    item.dataset.groupId = group.id;

    let selectedCount = 0;
    group.fields.forEach(f => {
      if (state.selections[f.id]) selectedCount++;
    });

    item.innerHTML = `
      <span>${group.name}</span>
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

// 控制台全部字段卡片渲染
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
          <span class="brand-badge">${group.fields.length} 字段</span>
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
    grid.className = 'fields-grid';

    group.fields.forEach(field => {
      const card = renderFieldCard(field);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// 单个字段卡片渲染
function renderFieldCard(field) {
  const card = document.createElement('div');
  card.className = `field-card ${state.locks[field.id] ? 'is-locked' : ''}`;
  card.id = `field-card-${field.id}`;
  if (field.activeWhen) {
    card.dataset.activeWhen = JSON.stringify(field.activeWhen);
  }

  const isLocked = !!state.locks[field.id];
  const selectedVal = state.selections[field.id] || '';

  const fieldHeader = document.createElement('div');
  fieldHeader.className = 'field-header';
  fieldHeader.innerHTML = `
    <div class="field-title-wrap">
      <span class="field-name">${field.name}</span>
      <span class="field-id-tag">${field.id}</span>
      ${field.note ? `<span class="field-note-icon" title="${field.note}">ℹ</span>` : ''}
    </div>
    <div class="field-actions">
      <button class="btn-lock ${isLocked ? 'locked' : ''}" data-field-id="${field.id}" title="${isLocked ? '已锁定（点击解锁）' : '未锁定（留白给AI导演搭配）'}">
        <span>${isLocked ? '🔒 核心锁定' : '🔓 自由待定'}</span>
      </button>
      <button class="btn btn-icon-only btn-random-field" data-field-id="${field.id}" title="仅随机抽取此项（不自动加锁）">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="8" cy="8" r="1.5"/><circle cx="16" cy="16" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg>
      </button>
      <button class="btn btn-icon-only btn-clear-field" data-field-id="${field.id}" title="清空此项选择并解锁">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
  card.appendChild(fieldHeader);

  const optionsWrap = document.createElement('div');
  optionsWrap.className = 'options-wrap';
  optionsWrap.id = `options-wrap-${field.id}`;

  (field.options || []).forEach(opt => {
    optionsWrap.appendChild(createOptionChip(field, opt, false));
  });

  (field.customOptions || []).forEach(opt => {
    optionsWrap.appendChild(createOptionChip(field, opt, true));
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add-option';
  addBtn.innerHTML = `<span>+ 自建选项</span>`;
  addBtn.addEventListener('click', () => openAddCustomOptionModal(field.id, field.name));
  optionsWrap.appendChild(addBtn);

  card.appendChild(optionsWrap);
  return card;
}

// 创建单个选项按钮 (Chip)
function createOptionChip(field, optName, isCustom = false) {
  const chip = document.createElement('div');
  chip.className = `option-chip ${isCustom ? 'custom' : ''}`;
  chip.dataset.fieldId = field.id;
  chip.dataset.optName = optName;

  let html = `<span>${optName}</span>`;
  if (isCustom) {
    html += `<span class="chip-remove-btn" title="删除自建选项">×</span>`;
  }
  chip.innerHTML = html;

  chip.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-remove-btn')) {
      e.stopPropagation();
      handleDeleteCustomOption(field.id, optName);
      return;
    }
    toggleOptionSelect(field, optName);
  });

  return chip;
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

// 刷新指定卡片内 chips 选中样式
function refreshFieldCardChips(fieldId) {
  const wrap = document.getElementById(`options-wrap-${fieldId}`);
  if (!wrap) return;
  const field = state.fieldsMap[fieldId];
  if (!field) return;

  const chips = wrap.querySelectorAll('.option-chip');
  chips.forEach(chip => {
    const optName = chip.dataset.optName;
    if (isOptionSelected(fieldId, optName, field.type)) {
      chip.classList.add('selected');
    } else {
      chip.classList.remove('selected');
    }
  });
}

// 刷新指定卡片的锁状态样式与徽章
function refreshFieldCardLockState(fieldId) {
  const card = document.getElementById(`field-card-${fieldId}`);
  if (!card) return;
  const isLocked = !!(state.locks[fieldId] && state.selections[fieldId]);
  card.classList.toggle('is-locked', isLocked);
  const btn = card.querySelector('.btn-lock');
  if (btn) {
    btn.classList.toggle('locked', isLocked);
    btn.innerHTML = `<span>${isLocked ? '🔒 核心锁定' : '🔓 自由待定'}</span>`;
    btn.title = isLocked ? '已锁定为硬性要求（AI搭配时必保留）' : '未锁定（留白给AI导演自由发挥搭配）';
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
  state.allFields.forEach(field => {
    const card = document.getElementById(`field-card-${field.id}`);
    if (!card) return;

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
    } else {
      card.classList.add('is-disabled');
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

// 更新状态总览数字
function updateStatusSummary() {
  const lockedKeys = Object.keys(state.locks).filter(k => state.locks[k] && state.selections[k] && isFieldPartitionActive(k));
  const summaryEl = document.getElementById('header-summary-badge');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span class="status-dot" style="background:${lockedKeys.length > 0 ? '#10b981' : '#f59e0b'}; box-shadow:0 0 8px ${lockedKeys.length > 0 ? '#10b981' : '#f59e0b'};"></span>
      <span>锁定池 ${lockedKeys.length} 项生效 · 其余AI导演搭配</span>
    `;
  }
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
      field.customOptions = res.customOptions;

      const wrap = document.getElementById(`options-wrap-${currentAddCustomFieldId}`);
      if (wrap) {
        const addBtn = wrap.querySelector('.btn-add-option');
        const newChip = createOptionChip(field, val, true);
        wrap.insertBefore(newChip, addBtn);
      }

      // 自动选中并锁定此项
      toggleOptionSelect(field, val);
    }

    closeModal('add-custom-modal');
    showToast(`已成功添加「${val}」并加入锁定池`, 'success');
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
      field.customOptions = res.customOptions;
      if (state.selections[fieldId] === optName) {
        delete state.selections[fieldId];
        delete state.locks[fieldId];
      }
      const wrap = document.getElementById(`options-wrap-${fieldId}`);
      if (wrap) {
        wrap.innerHTML = '';
        field.options.forEach(opt => wrap.appendChild(createOptionChip(field, opt, false)));
        (field.customOptions || []).forEach(opt => wrap.appendChild(createOptionChip(field, opt, true)));
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add-option';
        addBtn.innerHTML = `<span>+ 自建选项</span>`;
        addBtn.addEventListener('click', () => openAddCustomOptionModal(field.id, field.name));
        wrap.appendChild(addBtn);
      }
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

// API 设置表单数据填充
function populateSettingsForm() {
  const s = state.settings;
  if (!s) return;

  if (s.llm) {
    setVal('llm-provider', s.llm.provider || 'deepseek');
    setVal('llm-base-url', s.llm.baseUrl || 'https://api.deepseek.com');
    setVal('llm-api-key', s.llm.apiKey || '');
    setVal('llm-model', s.llm.model || 'deepseek-chat');
    setVal('llm-temperature', s.llm.temperature ?? 0.7);
  }

  if (s.imageGen) {
    setVal('image-provider', s.imageGen.provider || 'custom');
    setVal('image-base-url', s.imageGen.baseUrl || 'https://api.gemai.cc/v1');
    setVal('image-api-key', s.imageGen.apiKey || '');
    setVal('image-model', s.imageGen.model || 'gpt-image-2.5-low');
  }

  setVal('settings-save-path', s.savePath || './outputs');
  updateApiStatusBadge();
}

// 顶部栏 API 就绪状态徽章
function updateApiStatusBadge() {
  const badgeEl = document.getElementById('api-status-badge');
  if (!badgeEl) return;

  const hasLlm = !!(state.settings?.llm?.apiKey);
  const hasImg = !!(state.settings?.imageGen?.apiKey);

  if (hasLlm && hasImg) {
    badgeEl.className = 'status-badge ready';
    badgeEl.innerHTML = `
      <span class="status-dot"></span>
      <span>API 就绪: ${state.settings.llm.model || 'LLM'} · ${state.settings.imageGen.model || '生图'}</span>
    `;
  } else if (hasLlm) {
    badgeEl.className = 'status-badge partial';
    badgeEl.innerHTML = `
      <span class="status-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span>
      <span>LLM 就绪 (待配生图)</span>
    `;
  } else if (hasImg) {
    badgeEl.className = 'status-badge partial';
    badgeEl.innerHTML = `
      <span class="status-dot" style="background:#f59e0b;box-shadow:0 0 8px #f59e0b;"></span>
      <span>生图 就绪 (待配LLM)</span>
    `;
  } else {
    badgeEl.className = 'status-badge unconfigured';
    badgeEl.innerHTML = `
      <span class="status-dot inactive"></span>
      <span>未配置 API Key</span>
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
  const newSettings = {
    llm: {
      provider: getVal('llm-provider'),
      baseUrl: getVal('llm-base-url'),
      apiKey: getVal('llm-api-key'),
      model: getVal('llm-model'),
      temperature: parseFloat(getVal('llm-temperature')) || 0.7,
      maxTokens: 2000
    },
    imageGen: {
      provider: getVal('image-provider'),
      baseUrl: getVal('image-base-url'),
      apiKey: getVal('image-api-key'),
      model: getVal('image-model')
    },
    savePath: getVal('settings-save-path') || './outputs'
  };

  try {
    localStorage.setItem('xingse_settings', JSON.stringify(newSettings));
    state.settings = newSettings;
    await ApiService.saveSettings(newSettings);

    updateApiStatusBadge();
    closeModal('settings-modal');
    showToast('API 与保存路径设置已永久保存！', 'success');
  } catch (err) {
    showToast(`保存警告: ${err.message}`, 'warning');
    updateApiStatusBadge();
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
    const config = {
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

  try {
    const config = {
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

  // 2. 收集最近10次方案的摘要信息用于七维去重
  const recentSignatures = (state.history || []).slice(0, 10).map((h, idx) => {
    return `#${idx + 1} 《${h.title || '摄影方案'}》: ${(h.actualPrompt || '').slice(0, 80)}...`;
  });

  let promptText = '';
  if (lockedItems.length > 0) {
    promptText = `【用户指定的硬性核心要求（已锁定锚点，你必须100%严格保留贯彻并在画面中重点呈现）】：\n${lockedItems.join('\n')}\n\n`;
  } else {
    promptText = `用户当前未锁定任何具体维度，请你作为国际顶级时尚摄影导演，自由搭配一套极具美感张力、摄影光影极佳的成片方案。\n\n`;
  }

  if (recentSignatures.length > 0) {
    promptText += `【最近生成的作品参考（请执行七维去重，在人物骨相五官、服装搭配、支撑支点、构图空间、机位焦段、光影调性、情绪张力中至少有4个可变维度明显不同，拒绝同脸模板与同质化穿搭）】：\n${recentSignatures.join('\n')}\n\n`;
  }

  promptText += `请协调所有未锁定的留白维度，输出完整的作品企划标题与摄影提示词方案。`;

  try {
    let generatedPrompt = '';
    let generatedTitle = '';

    // 若配置了有效的 LLM API，调用大模型生成
    if (state.settings?.llm?.apiKey) {
      const res = await ApiService.generateLlmPrompt(promptText, state.settings?.llm);
      if (res && (res.content || res.prompt)) {
        const content = res.content || res.prompt;
        if (content.includes('【作品企划标题】') && content.includes('【摄影提示词】')) {
          const parts = content.split('【摄影提示词】');
          generatedTitle = parts[0].replace('【作品企划标题】', '').replace(/^[《"'\s]+|[》"'\s]+$/g, '').trim().split('\n')[0].trim();
          generatedPrompt = parts[1].replace(/^[：:\n\r]+/, '').trim();
        } else if (content.includes('【摄影提示词】')) {
          generatedPrompt = content.split('【摄影提示词】')[1].replace(/^[：:\n\r]+/, '').trim();
        } else {
          generatedPrompt = content.trim();
        }
      }
    } else {
      // 离线/未配置 LLM 时的本地导演拼接备用逻辑
      const coordinated = XingSeDirector.directorCoordinateMatch(state.allFields, state.selections, state.locks, isFieldPartitionActive);
      generatedPrompt = XingSeDirector.assembleChinesePrompt(coordinated, state.fieldsMap);
      generatedTitle = `${coordinated['theme'] || '时尚写真'}·${coordinated['tension'] || '光影肖像'}`;
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

    showToast(`✓ AI摄影导演已基于您的 ${lockedItems.length} 项生效锁定完成搭配！已写入提示词框，可直接审阅或编辑`, 'success');
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

// ✨ 优化提示词：在现有方案上进行质感与细节优化，严格保留身份、锁定条件与主要设计
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

  const promptText = `这是用户当前的摄影提示词方案：\n${currentText}\n\n当前锁定的硬性条件（必须严格保留，不得更改）：\n${lockedItems.join('\n') || '无明确锁定项'}\n\n请在严格保留该方案的主角身份设定、所有锁定条件与核心画面构架的前提下，对该提示词进行专业摄影细节与画面质感润色（增强物理真实感、微观材质纹理反光、受力重力平衡、景深透光与胶片色温层级，消除生硬词汇堆砌）。请只输出优化后的完整摄影提示词正文。`;

  try {
    const res = await ApiService.generateLlmPrompt(promptText, state.settings?.llm);
    if (res && (res.content || res.prompt)) {
      let polished = res.content || res.prompt;
      if (polished.includes('【摄影提示词】')) {
        polished = polished.split('【摄影提示词】')[1].replace(/^[：:\n\r]+/, '').trim();
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
    if (canvasImg) {
      canvasImg.onerror = () => {
        if (res.imageUrl && canvasImg.src !== res.imageUrl) {
          canvasImg.src = res.imageUrl;
        }
      };
      canvasImg.src = res.localUrl || res.imageUrl;
      canvasImg.style.display = 'block';
      canvasImg.dataset.title = res.title || projectTitle;
      canvasImg.dataset.file = res.savedFile || '';
      canvasImg.dataset.path = res.savedPath || '';
      canvasImg.dataset.imageUrl = res.imageUrl || '';
    }

    if (footerBar) footerBar.style.display = 'flex';

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
    await ApiService.saveHistory({
      title: res.title || projectTitle,
      actualPrompt: prompt,
      promptZh: prompt,
      promptEn: '',
      imageUrl: res.imageUrl,
      savedSuccess: res.savedSuccess,
      savedFile: res.savedFile,
      savedPath: res.savedPath,
      model: res.model,
      size: size,
      aspectRatio: ar,
      provider: res.provider || 'custom',
      selections: state.selections,
      locks: state.locks
    });

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

// 加载历史画廊
async function loadGallery() {
  try {
    const history = await ApiService.getHistory();
    state.history = history;
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (history.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-muted);font-size:0.85rem;grid-column:1/-1;text-align:center;padding:30px 0;">暂无生图历史</div>';
      return;
    }

    history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      const itemTitle = item.title || '摄影作品';
      const displayImg = item.displayUrl || item.localUrl || item.imageUrl || '';

      card.innerHTML = `
        <img src="${displayImg}" alt="${itemTitle}" loading="lazy" />
        <div class="gallery-card-footer">
          <span style="font-weight:600; color:var(--accent-gold-light); max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemTitle}">${itemTitle}</span>
          <span class="btn-restore-hint" style="color:var(--text-muted); font-size:0.7rem;">复原作品</span>
        </div>
      `;

      const gImg = card.querySelector('img');
      if (gImg && item.imageUrl) {
        gImg.onerror = () => {
          if (gImg.src !== item.imageUrl) gImg.src = item.imageUrl;
        };
      }

      card.querySelector('img')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openLightbox(displayImg, itemTitle, `${item.model || 'AI'} · ${item.savedFile || ''}`);
      });

      // 点击“复原作品”：必须将当时实际提交的完整提示词恢复回主提示词框，并恢复选项与锁定
      card.querySelector('.gallery-card-footer')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`是否复原「${itemTitle}」当时的原始方案？\n（将把当时的实际提交提示词放回输入框，并恢复所有锁定与选项）`)) {
          const mainPromptBox = document.getElementById('main-prompt-box');
          const titleInput = document.getElementById('project-title');
          const warningBanner = document.getElementById('prompt-outdated-warning');

          if (mainPromptBox) {
            mainPromptBox.value = item.actualPrompt || item.promptZh || item.promptEn || '';
          }
          if (titleInput) {
            titleInput.value = item.title || itemTitle;
          }

          state.selections = item.selections || {};
          state.locks = item.locks || {};

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
          switchWorkspaceTab('prompt');
          showToast(`已复原「${itemTitle}」的实际提交提示词与全部锁定参数！`, 'success');
        }
      });

      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Load Gallery Error:', err);
  }
}

// 工作舱 Tab 切换
function switchWorkspaceTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.ws-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  const promptPanel = document.getElementById('panel-prompt');
  const canvasPanel = document.getElementById('panel-canvas');
  const galleryPanel = document.getElementById('panel-gallery');

  if (promptPanel) promptPanel.style.display = tab === 'prompt' ? 'flex' : 'none';
  if (canvasPanel) canvasPanel.style.display = tab === 'canvas' ? 'flex' : 'none';
  if (galleryPanel) galleryPanel.style.display = tab === 'gallery' ? 'flex' : 'none';
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

  // 供应商下拉联动
  document.getElementById('llm-provider')?.addEventListener('change', (e) => {
    const p = LLM_PRESETS[e.target.value];
    if (p) {
      setVal('llm-base-url', p.baseUrl);
      setVal('llm-model', p.model);
    }
  });

  document.getElementById('image-provider')?.addEventListener('change', (e) => {
    const p = IMAGE_PRESETS[e.target.value];
    if (p) {
      setVal('image-base-url', p.baseUrl);
      setVal('image-model', p.model);
    }
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

  // 键盘快捷键监听 (Esc 关闭灯箱与模态框)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeModal('settings-modal');
      closeModal('add-custom-modal');
    }
  });
}

// 页面加载完成后启动
window.addEventListener('DOMContentLoaded', initApp);
