/**
 * Lappy AI — Renderer (works in both browser dev + Electron)
 * Providers: OpenRouter (Gemma 4 primary · Nemotron VL fallback)
 */

import './style.css';
import {
  HARDCODED_OPENROUTER_KEY,
  FREE_MODE_ENABLED,
  APP_SITE_URL,
  APP_SITE_NAME,
  OPENROUTER_MODELS,
  GROK_MODELS,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_GROK_MODEL,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
} from './config.js';

// Is this running inside Electron?
const IS_ELECTRON = !!(window.lappyAPI?.isElectron);
const COMPACT_WINDOW = { width: 180, height: 64 };
const TOOLS_WINDOW = { width: 380, height: 130 };
const EXPANDED_WINDOW = { width: 460, height: 760 };
const SETTINGS_WINDOW = { width: 460, height: 700 };

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  apiKey:          '',
  provider:        'openrouter',
  model:           DEFAULT_OPENROUTER_MODEL,
  isSetupComplete: false,
  isSidebarOpen:   false,
  isSidebarMin:    false,
  messages:        [],
  isTyping:        false,
  freeMode:        false,
  pendingImage:    null,   // base64 image waiting to be sent with next message
  wasSidebarOpenBeforeSettings: false,
};

// ── Element refs ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  setupScreen:       $('setup-screen'),
  workspace:         $('workspace'),
  providerGrid:      $('provider-grid'),
  apiKeyInput:       $('api-key-input'),
  apiToggleBtn:      $('api-toggle-btn'),
  modelSelect:       $('model-select'),
  setupCta:          $('setup-cta'),
  freeModeBtn:       $('free-mode-btn'),
  freeModeNote:      $('free-mode-note'),
  keySection:        $('key-section'),
  lappyTrigger:      $('lappy-trigger'),
  islandTools:       $('island-tools'),
  lappyClose:        $('lappy-close'),
  islandInputCtn:    $('island-input-container'),
  islandInput:       $('island-quick-input'),
  islandSend:        $('island-send-btn'),
  sidebar:           $('lappy-sidebar'),
  sidebarMessages:   $('sidebar-messages'),
  sidebarInput:      $('sidebar-input'),
  sidebarSendBtn:    $('sidebar-send-btn'),
  sidebarMinimize:   $('sidebar-minimize'),
  sidebarClose:      $('sidebar-close'),
  sidebarDragHandle: $('sidebar-drag-handle'),
  contextBar:        $('sidebar-context-bar'),
  contextLabel:      $('context-label'),
  sidebarTyping:     $('sidebar-typing'),
  currentModelLabel: $('current-model-label'),
  freeBadge:         $('free-badge'),
  imagePreviewBar:   $('image-preview-bar'),
  imagePreview:      $('image-preview'),
  imageClearBtn:     $('image-clear-btn'),
  settingsModal:     $('settings-modal'),
  settingsBackdrop:  $('settings-backdrop'),
  settingsCloseBtn:  $('settings-close-btn'),
  settingsSaveBtn:   $('settings-save-btn'),
  settingsResetBtn:  $('settings-reset-btn'),
  settingsApiKey:    $('settings-api-key'),
  settingsToggleBtn: $('settings-toggle-btn'),
  settingsModel:     $('settings-model'),
  settingsProvGrid:  $('settings-provider-grid'),
  wsSettingsBtn:     $('ws-settings-btn'),
};

// ── Storage ────────────────────────────────────────────────────────────────
const Storage = {
  save() {
    try {
      localStorage.setItem('lappy_v3', JSON.stringify({
        apiKey:   state.apiKey,
        provider: state.provider,
        model:    state.model,
        setup:    state.isSetupComplete,
        freeMode: state.freeMode,
      }));
    } catch (_) {}
  },
  load() {
    try {
      const raw = localStorage.getItem('lappy_v3');
      if (!raw) return false;
      const c = JSON.parse(raw);
      state.apiKey          = c.apiKey   ?? '';
      state.provider        = c.provider ?? 'openrouter';
      state.model           = c.model    ?? DEFAULT_OPENROUTER_MODEL;
      state.isSetupComplete = c.setup    ?? false;
      state.freeMode        = c.freeMode ?? false;
      return state.isSetupComplete;
    } catch { return false; }
  },
  clear() {
    localStorage.removeItem('lappy_v3');
    // Clear old versions too
    localStorage.removeItem('lappy_v2');
    localStorage.removeItem('lappy_config');
  },
};

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'default', ms = 3500) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  const icons = {
    success: '<polyline points="20 6 9 17 4 12"/>',
    error:   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    default: '<circle cx="12" cy="12" r="10"/>',
  };
  el.className = `toast ${type}`;
  el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[type] ?? icons.default}</svg>${msg}`;
  clearTimeout(toastTimer);
  requestAnimationFrame(() => {
    el.classList.add('visible');
    toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  });
}

// ── Model helpers ──────────────────────────────────────────────────────────
function getModelsForProvider(prov) {
  return prov === 'grok' ? GROK_MODELS : OPENROUTER_MODELS;
}

function populateModelSelect(selectEl, prov, selected = null) {
  const all   = getModelsForProvider(prov);
  const free  = all.filter((m) => m.isFree);
  const paid  = all.filter((m) => !m.isFree);
  selectEl.innerHTML = '';
  const addGroup = (label, models) => {
    if (!models.length) return;
    const grp = document.createElement('optgroup');
    grp.label = label;
    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value       = m.id;
      opt.textContent = `${m.label} · ${m.desc}`;
      grp.appendChild(opt);
    });
    selectEl.appendChild(grp);
  };
  addGroup('⭐ Free — No credits needed', free);
  addGroup('💰 Paid — Requires credits', paid);
  const target = selected ?? (prov === 'grok' ? DEFAULT_GROK_MODEL : DEFAULT_OPENROUTER_MODEL);
  if (selectEl.querySelector(`option[value="${target}"]`)) selectEl.value = target;
  state.model = selectEl.value;
}

function getModelLabel(id) {
  return [...OPENROUTER_MODELS, ...GROK_MODELS].find((m) => m.id === id)?.label ?? id;
}
function isModelFree(id) {
  return OPENROUTER_MODELS.find((m) => m.id === id)?.isFree ?? false;
}
function isVisionModel(id) {
  // Models confirmed to support image input
  const visionIds = [
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3.5-haiku',
    'anthropic/claude-sonnet-4-5',
    'google/gemini-2.5-flash-preview',
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free',
  ];
  return visionIds.includes(id);
}

// ── Provider grid ──────────────────────────────────────────────────────────
function initProviderGrid(gridEl, modelEl, onChange) {
  gridEl.querySelectorAll('.provider-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      gridEl.querySelectorAll('.provider-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.provider = btn.dataset.provider;
      if (modelEl) populateModelSelect(modelEl, state.provider);
      onChange?.(state.provider);
    });
  });
}

// ── Setup screen ───────────────────────────────────────────────────────────
function initSetupScreen() {
  els.setupScreen.classList.remove('hidden');
  populateModelSelect(els.modelSelect, 'openrouter', DEFAULT_OPENROUTER_MODEL);

  initProviderGrid(els.providerGrid, els.modelSelect, (prov) => {
    els.apiKeyInput.placeholder = prov === 'grok' ? 'xai-...' : 'sk-or-v1-...';
    if (els.freeModeBtn)  els.freeModeBtn.style.display  = prov === 'grok' ? 'none' : '';
    if (els.freeModeNote) els.freeModeNote.style.display = prov === 'grok' ? 'none' : '';
  });

  els.apiToggleBtn.addEventListener('click', () => toggleKeyVisible(els.apiKeyInput, els.apiToggleBtn));

  els.apiKeyInput.addEventListener('input', () => {
    els.setupCta.disabled = els.apiKeyInput.value.trim().length < 10;
  });
  els.modelSelect.addEventListener('change', () => { state.model = els.modelSelect.value; });

  els.setupCta.addEventListener('click', () => {
    const k = els.apiKeyInput.value.trim();
    if (!k || k.length < 10) return;
    launch(k, false);
  });

  if (els.freeModeBtn) {
    const hasKey = HARDCODED_OPENROUTER_KEY.startsWith('sk-or');
    if (!FREE_MODE_ENABLED || !hasKey) {
      els.freeModeBtn.style.display = 'none';
    } else {
      els.freeModeBtn.addEventListener('click', () => {
        if (!isModelFree(els.modelSelect.value)) {
          const first = OPENROUTER_MODELS.find((m) => m.isFree);
          if (first) { els.modelSelect.value = first.id; state.model = first.id; }
        }
        launch(HARDCODED_OPENROUTER_KEY, true);
      });
    }
  }
}

function launch(apiKey, freeMode) {
  state.apiKey          = apiKey;
  state.freeMode        = freeMode;
  state.model           = els.modelSelect?.value ?? DEFAULT_OPENROUTER_MODEL;
  state.isSetupComplete = true;
  Storage.save();
  els.setupScreen.style.transition = 'opacity .4s ease, transform .4s ease';
  els.setupScreen.style.opacity    = '0';
  els.setupScreen.style.transform  = 'scale(1.02)';
  setTimeout(() => { els.setupScreen.classList.add('hidden'); showWorkspace(); }, 400);
}

function toggleKeyVisible(inputEl, btnEl) {
  const show = inputEl.type === 'password';
  inputEl.type = show ? 'text' : 'password';
  btnEl.innerHTML = show
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

// ── Workspace ──────────────────────────────────────────────────────────────
function showWorkspace() {
  if (els.workspace) els.workspace.classList.remove('hidden');
  els.lappyTrigger.classList.remove('hidden');
  requestWindowSize(COMPACT_WINDOW);
  syncModelUI();
}

function requestWindowSize(size) {
  if (!IS_ELECTRON || !window.lappyAPI?.resizeWindow) return;
  window.lappyAPI.resizeWindow(size);
}

function syncModelUI() {
  const label = getModelLabel(state.model);
  if (els.currentModelLabel) els.currentModelLabel.textContent = label;
  const isFree = isModelFree(state.model) || state.freeMode;
  if (els.freeBadge) els.freeBadge.style.display = isFree ? 'inline-flex' : 'none';
}

// ── Floating trigger (Dynamic Island) ──────────────────────────────────────
function initTrigger() {
  const trigger = els.lappyTrigger;
  let holdTimer = null;
  const HOLD_MS = 450;
  let startX = 0;
  let startY = 0;
  let hasMoved = false;

  // In Electron, use native window dragging via CSS app-region for smoothness.
  // Here we only detect hold vs move to decide whether to reveal tools.
  trigger.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.island-tools') || e.target.closest('.lappy-close')) return;
    startX = e.clientX;
    startY = e.clientY;
    hasMoved = false;
    trigger.classList.add('holding');
    holdTimer = setTimeout(() => {
      trigger.classList.remove('holding');
      if (!hasMoved) showIslandTools();
    }, HOLD_MS);
  });

  trigger.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
      hasMoved = true;
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
        trigger.classList.remove('holding');
      }
    }
  });

  const endDrag = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    trigger.classList.remove('holding', 'dragging');
  };

  trigger.addEventListener('pointerup', endDrag);
  trigger.addEventListener('pointercancel', endDrag);

  // Close App
  if (els.lappyClose) {
    els.lappyClose.addEventListener('click', () => {
      if (IS_ELECTRON && window.lappyAPI?.closeApp) { window.lappyAPI.closeApp(); } 
      else { window.close(); }
    });
  }

  // Island Tools
  if (els.islandTools) {
    els.islandTools.querySelectorAll('.action-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        hideIslandTools();
        handleQuickAction(item.dataset.action);
      });
    });
  }

  // Double click opens the assistant in larger chat mode
  trigger.addEventListener('dblclick', (e) => {
    if (e.target.closest('.island-tools') || e.target.closest('.lappy-close')) return;
    hideIslandTools();
    hideIslandInput();
    openSidebar();
  });
}

function showIslandTools() {
  if (els.lappyTrigger.classList.contains('input-mode')) return; // Do not show tools if input is active
  requestWindowSize(TOOLS_WINDOW);
  els.lappyTrigger.classList.add('expanded');
  
  const outsideClick = (e) => {
    if (!els.lappyTrigger.contains(e.target)) {
      hideIslandTools();
      document.removeEventListener('click', outsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClick), 0);
}

function hideIslandTools() {
  // If not in input mode, un-expand
  if (!els.lappyTrigger.classList.contains('input-mode')) {
    els.lappyTrigger.classList.remove('expanded');
    if (!state.isSidebarOpen) requestWindowSize(COMPACT_WINDOW);
  }
}

function showIslandInput() {
  requestWindowSize(TOOLS_WINDOW);
  els.lappyTrigger.classList.add('expanded', 'input-mode');
  setTimeout(() => { if (els.islandInput) els.islandInput.focus(); }, 300);
}

function hideIslandInput() {
  els.lappyTrigger.classList.remove('expanded', 'input-mode');
  if (els.islandInput) els.islandInput.value = '';
}

// ── Quick actions ──────────────────────────────────────────────────────────
const QUICK_PROMPTS = {
  chat:       { ctx: 'Chat mode', prompt: null },
  settings:   { ctx: null, prompt: null },
  screenshot: { ctx: null, prompt: null },
  lasso:      { ctx: null, prompt: null },
};

function handleQuickAction(action) {
  if (action === 'screenshot') { doScreenshot(); return; }
  if (action === 'lasso')      { doLasso();      return; }
  if (action === 'settings')   { openSettings(); return; }

  const meta = QUICK_PROMPTS[action] ?? QUICK_PROMPTS.chat;
  // Always open sidebar for chat
  openSidebar();
  if (meta.ctx) setContextPill(meta.ctx);
  if (meta.prompt) {
    setTimeout(() => { addUserMsg(meta.prompt); getAIResponse(meta.prompt); }, 250);
  }
}

// Wire up Island Input
if (els.islandSend && els.islandInput) {
  const submitIslandInput = () => {
    const val = els.islandInput.value.trim();
    if (!val) return;
    hideIslandInput();
    openSidebar();
    addUserMsg(val, state.pendingImage);
    getAIResponse(val);
  };
  els.islandSend.addEventListener('click', submitIslandInput);
  els.islandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitIslandInput(); }
  });
}

// ── Screenshot ─────────────────────────────────────────────────────────────
async function doScreenshot() {
  if (!IS_ELECTRON) {
    toast('Screenshot requires the desktop app', 'error'); return;
  }
  setContextPill('Taking screenshot…');
  try {
    const dataUrl = await window.lappyAPI.captureScreen();
    if (!dataUrl) throw new Error('No screen data');
    openSidebar();
    const autoPrompt = 'Explain what is on this screenshot and help me with the next action.';
    addUserMsg(autoPrompt, dataUrl);
    getAIResponse(autoPrompt, dataUrl);
    toast('Screenshot captured!', 'success');
  } catch (e) {
    toast('Screenshot failed: ' + e.message, 'error');
  }
}

// ── Lasso select ───────────────────────────────────────────────────────────
function doLasso() {
  if (!IS_ELECTRON) {
    // Browser fallback: use getDisplayMedia
    doLassoBrowser();
    return;
  }
  // In Electron: delegate to main process (grabs full-screen overlay)
  window.lappyAPI.startLasso();
  setContextPill('Draw around the area…');
}

// Browser fallback lasso using getDisplayMedia + canvas overlay
async function doLassoBrowser() {
  setContextPill('Requesting screen access…');
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: false });
    const video  = document.createElement('video');
    video.srcObject = stream;
    await new Promise((res) => { video.onloadedmetadata = res; });
    video.play();

    // Draw one frame to an off-screen canvas
    const snap   = document.createElement('canvas');
    snap.width   = video.videoWidth;
    snap.height  = video.videoHeight;
    snap.getContext('2d').drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());

    const dataUrl = snap.toDataURL('image/png');
    showLassoOverlay(dataUrl);
  } catch (e) {
    toast('Screen access denied: ' + e.message, 'error');
    if (els.contextBar) els.contextBar.classList.add('hidden');
  }
}

// Fullscreen lasso overlay (browser version)
let lassoOverlay = null;

function showLassoOverlay(screenDataUrl) {
  if (lassoOverlay) lassoOverlay.remove();

  lassoOverlay = document.createElement('div');
  lassoOverlay.id        = 'lasso-overlay';
  lassoOverlay.innerHTML = `
    <canvas id="lasso-bg"></canvas>
    <canvas id="lasso-cv"></canvas>
    <div id="lasso-hint">Draw around the area to capture — release to confirm</div>
    <button id="lasso-cancel">✕ Cancel</button>
  `;
  document.body.appendChild(lassoOverlay);

  const W = window.screen.width;
  const H = window.screen.height;
  const bg = document.getElementById('lasso-bg');
  const cv = document.getElementById('lasso-cv');
  bg.width = cv.width = lassoOverlay.offsetWidth;
  bg.height= cv.height= lassoOverlay.offsetHeight;

  const bgCtx = bg.getContext('2d');
  const ctx   = cv.getContext('2d');
  const img   = new Image();
  img.onload  = () => {
    bgCtx.drawImage(img, 0, 0, bg.width, bg.height);
    bgCtx.fillStyle = 'rgba(0,0,0,0.35)';
    bgCtx.fillRect(0, 0, bg.width, bg.height);
  };
  img.src = screenDataUrl;

  let drawing = false;
  let points  = [];

  cv.addEventListener('mousedown', (e) => {
    drawing = true;
    points  = [{ x: e.offsetX, y: e.offsetY }];
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });

  cv.addEventListener('mousemove', (e) => {
    if (!drawing) return;
    points.push({ x: e.offsetX, y: e.offsetY });
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.fillStyle = 'rgba(139,92,246,0.1)';
    ctx.fill();
  });

  cv.addEventListener('mouseup', () => {
    if (!drawing || points.length < 8) { drawing = false; return; }
    drawing = false;
    ctx.closePath();

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x1 = Math.max(0, Math.min(...xs) - 4);
    const y1 = Math.max(0, Math.min(...ys) - 4);
    const cw = Math.min(cv.width,  Math.max(...xs) + 4) - x1;
    const ch = Math.min(cv.height, Math.max(...ys) + 4) - y1;

    const crop = document.createElement('canvas');
    crop.width  = cw;
    crop.height = ch;
    crop.getContext('2d').drawImage(img, x1, y1, cw, ch, 0, 0, cw, ch);

    closeLassoOverlay();
    setAttachedImage(crop.toDataURL('image/png'));
    showIslandInput();
    toast('Area captured!', 'success');
  });

  document.getElementById('lasso-cancel').addEventListener('click', closeLassoOverlay);
}

function closeLassoOverlay() {
  lassoOverlay?.remove();
  lassoOverlay = null;
}

// ── Image attachment ───────────────────────────────────────────────────────
function setAttachedImage(dataUrl) {
  state.pendingImage = dataUrl;
  if (els.imagePreviewBar) {
    els.imagePreviewBar.classList.remove('hidden');
    els.imagePreview.src = dataUrl;
  }
}

function clearAttachedImage() {
  state.pendingImage = null;
  if (els.imagePreviewBar) els.imagePreviewBar.classList.add('hidden');
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function toggleSidebar() { state.isSidebarOpen ? closeSidebar() : openSidebar(); }

function openSidebar() {
  if (state.isSidebarOpen) return;
  state.isSidebarOpen = true;
  state.isSidebarMin  = false;
  els.sidebar.classList.remove('hidden');
  els.contextBar.classList.add('hidden');
  requestWindowSize(EXPANDED_WINDOW);
  resetSidebarPos();
}

function closeSidebar() {
  state.isSidebarOpen = false;
  els.sidebar.style.cssText += ';transition:opacity .3s,transform .3s;opacity:0;transform:translateX(30px) scale(.95)';
  setTimeout(() => {
    els.sidebar.classList.add('hidden');
    els.sidebar.style.cssText = '';
    requestWindowSize(COMPACT_WINDOW);
  }, 300);
}

function resetSidebarPos() {
  els.sidebar.style.right  = '20px';
  els.sidebar.style.top    = '80px';
  els.sidebar.style.left   = '';
  els.sidebar.style.bottom = '';
}

function setContextPill(label) {
  els.contextLabel.textContent = label;
  els.contextBar.classList.remove('hidden');
}

// ── Messages ───────────────────────────────────────────────────────────────
function addUserMsg(text, imageDataUrl = null) {
  state.messages.push({ role: 'user', content: text, image: imageDataUrl });
  const group  = document.createElement('div');
  group.className = 'message-group user-message';
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'Y';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  if (imageDataUrl) {
    bubble.innerHTML = `<img class="msg-image" src="${imageDataUrl}" alt="Attached image"/>`;
    if (text) bubble.innerHTML += `<p>${fmt(text)}</p>`;
  } else {
    bubble.innerHTML = fmt(text);
  }
  group.appendChild(avatar);
  group.appendChild(bubble);
  els.sidebarMessages.appendChild(group);
  scrollBottom();
}

function addLappyMsg(text) {
  state.messages.push({ role: 'assistant', content: text });
  const group  = document.createElement('div');
  group.className = 'message-group lappy-message';
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'L';
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.innerHTML  = fmt(text);
  group.appendChild(avatar);
  group.appendChild(bubble);
  els.sidebarMessages.appendChild(group);
  scrollBottom();
}

function fmt(t) {
  return (t || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`{3}([\s\S]*?)`{3}/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^•\s(.+)/gm, '<li>$1</li>')
    .replace(/^-\s(.+)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

function scrollBottom() {
  setTimeout(() => { els.sidebarMessages.scrollTop = els.sidebarMessages.scrollHeight; }, 50);
}

function showTyping() { state.isTyping = true;  els.sidebarTyping.classList.add('visible');    scrollBottom(); }
function hideTyping() { state.isTyping = false; els.sidebarTyping.classList.remove('visible'); }

// ── AI dispatcher ──────────────────────────────────────────────────────────
async function getAIResponse(userMsg, imageDataUrl = null) {
  if (!state.apiKey) {
    addLappyMsg('❌ **No API key** — go to Settings and add your OpenRouter key.');
    return;
  }
  showTyping();
  try {
    const reply = await callAI(userMsg, imageDataUrl);
    hideTyping();
    addLappyMsg(reply);
    els.contextBar.classList.add('hidden');
  } catch (err) {
    hideTyping();
    console.error('[Lappy] AI error:', err);
    addLappyMsg(classifyError(err));
    toast('AI error — see chat', 'error');
  }
}

const SYSTEM_PROMPT = `You are Lappy, a concise and brilliant AI assistant floating in the user's workspace. Be sharp, warm, and efficient. Bold key terms. Use bullet points for lists. Never pad answers. If shown an image, analyze it carefully and answer the user's question about it.`;

async function callAI(userMsg, imageDataUrl = null) {
  const history = state.messages.slice(-10);

  if (state.provider === 'grok') return callGrok(history, userMsg);
  return callOpenRouter(history, userMsg, imageDataUrl);
}

// ── OpenRouter with auto-fallback ─────────────────────────────────────────
async function callOpenRouter(history, userMsg, imageDataUrl = null) {
  // If image is attached, must use a vision model
  const modelToUse = (imageDataUrl && !isVisionModel(state.model))
    ? FALLBACK_MODEL   // Nemotron VL supports vision
    : state.model;

  if (imageDataUrl && !isVisionModel(state.model)) {
    toast('Image detected — switching to Nemotron VL (vision model)', 'default', 2800);
  }

  try {
    return await fetchOpenRouter(modelToUse, history, userMsg, imageDataUrl);
  } catch (err) {
    // Auto-fallback: primary → FALLBACK_MODEL
    if (modelToUse === PRIMARY_MODEL && FALLBACK_MODEL && FALLBACK_MODEL !== modelToUse) {
      console.warn('[Lappy] Primary failed, trying fallback:', err.message);
      toast('Switching to fallback model…', 'default', 2000);
      return await fetchOpenRouter(FALLBACK_MODEL, history, userMsg, imageDataUrl);
    }
    throw err;
  }
}

async function fetchOpenRouter(modelId, history, userMsg, imageDataUrl = null) {
  // Build message content — multimodal if image present
  const userContent = imageDataUrl
    ? [
        { type: 'text',      text: userMsg || 'Describe what you see in this image.' },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ]
    : userMsg;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    // Previous turns (text only — vision only in latest message)
    ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization':      `Bearer ${state.apiKey}`,
      'Content-Type':       'application/json',
      'HTTP-Referer':       APP_SITE_URL,
      'X-OpenRouter-Title': APP_SITE_NAME,
    },
    body: JSON.stringify({
      model:       modelId,
      messages,
      max_tokens:  1500,
      temperature: 0.7,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (data.error) throw new Error(data.error.message ?? 'Unknown provider error');

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from model');
  return content;
}

// ── Grok ──────────────────────────────────────────────────────────────────
async function callGrok(history, userMsg) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMsg },
  ];
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: state.model, messages, max_tokens: 1500, temperature: 0.7 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response');
  return content;
}

function classifyError(err) {
  const m = (err?.message ?? '').toLowerCase();
  if (m.includes('401') || m.includes('unauthorized') || m.includes('invalid key')) {
    return `❌ **Invalid API Key** — Check your key in ⚙️ Settings.`;
  }
  if (m.includes('429') || m.includes('rate limit')) {
    return `⏳ **Rate limited** — Too many requests. Please wait a moment.`;
  }
  if (m.includes('402') || m.includes('credits') || m.includes('insufficient')) {
    return `💳 **Out of credits** — Top up at openrouter.ai or switch to a free model.`;
  }
  if (m.includes('model') && (m.includes('not found') || m.includes('unavailable'))) {
    return `🔍 **Model unavailable** — Try a different model in Settings.`;
  }
  return `⚠️ **Error** — ${err?.message ?? 'Unknown error'}`;
}

// ── Sidebar input ─────────────────────────────────────────────────────────
function initSidebarInput() {
  els.sidebarInput.addEventListener('input', () => {
    els.sidebarInput.style.height = 'auto';
    els.sidebarInput.style.height = Math.min(els.sidebarInput.scrollHeight, 120) + 'px';
  });
  els.sidebarInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  els.sidebarSendBtn.addEventListener('click', handleSend);

  els.sidebarMinimize.addEventListener('click', () => {
    state.isSidebarMin = !state.isSidebarMin;
    const body   = els.sidebar.querySelector('.sidebar-messages');
    const footer = els.sidebar.querySelector('.sidebar-footer');
    if (state.isSidebarMin) {
      [body, footer, els.contextBar, els.imagePreviewBar].forEach((el) => el && (el.style.display = 'none'));
      els.sidebar.style.height = 'auto';
    } else {
      [body, footer, els.contextBar, els.imagePreviewBar].forEach((el) => el && (el.style.display = ''));
      els.sidebar.style.height = '';
    }
  });
  els.sidebarClose.addEventListener('click', closeSidebar);

  // Image clear button
  if (els.imageClearBtn) {
    els.imageClearBtn.addEventListener('click', clearAttachedImage);
  }
}

function handleSend() {
  const text  = els.sidebarInput.value.trim();
  const image = state.pendingImage;
  if ((!text && !image) || state.isTyping) return;
  els.sidebarInput.value = '';
  els.sidebarInput.style.height = 'auto';
  clearAttachedImage();
  addUserMsg(text, image);
  getAIResponse(text, image);
}

// ── Draggable sidebar ─────────────────────────────────────────────────────
function initDraggable() {
  if (IS_ELECTRON) return;
  const handle  = els.sidebarDragHandle;
  const sidebar = els.sidebar;
  let sx, sy, sl, st;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const r = sidebar.getBoundingClientRect();
    sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top;
    sidebar.classList.add('dragging');
    sidebar.style.left = sl + 'px'; sidebar.style.right  = 'auto';
    sidebar.style.top  = st + 'px'; sidebar.style.bottom = 'auto';
  });
  handle.addEventListener('pointermove', (e) => {
    if (!sidebar.classList.contains('dragging')) return;
    sidebar.style.left = Math.max(0, Math.min(window.innerWidth  - sidebar.offsetWidth,  sl + e.clientX - sx)) + 'px';
    sidebar.style.top  = Math.max(0, Math.min(window.innerHeight - 80, st + e.clientY - sy)) + 'px';
  });
  handle.addEventListener('pointerup',           () => sidebar.classList.remove('dragging'));
  handle.addEventListener('lostpointercapture',  () => sidebar.classList.remove('dragging'));
}

// ── Settings ──────────────────────────────────────────────────────────────
function initSettings() {
  if (els.wsSettingsBtn) els.wsSettingsBtn.addEventListener('click', openSettings);
  if (els.settingsCloseBtn) els.settingsCloseBtn.addEventListener('click', closeSettings);
  if (els.settingsBackdrop) els.settingsBackdrop.addEventListener('click', closeSettings);
  if (els.settingsToggleBtn && els.settingsApiKey) {
    els.settingsToggleBtn.addEventListener('click', () => toggleKeyVisible(els.settingsApiKey, els.settingsToggleBtn));
  }

  if (els.settingsProvGrid && els.settingsModel) {
    initProviderGrid(els.settingsProvGrid, els.settingsModel, (prov) => {
      populateModelSelect(els.settingsModel, prov, state.model);
    });
  }

  if (els.settingsSaveBtn) els.settingsSaveBtn.addEventListener('click', () => {
    const k = els.settingsApiKey.value.trim();
    if (k.length >= 10) state.apiKey = k;
    state.model    = els.settingsModel.value;
    state.freeMode = false;
    Storage.save();
    syncModelUI();
    closeSettings();
    toast('Settings saved!', 'success');
  });

  if (els.settingsResetBtn) els.settingsResetBtn.addEventListener('click', () => {
    Storage.clear();
    Object.assign(state, { apiKey: '', provider: 'openrouter', model: DEFAULT_OPENROUTER_MODEL, isSetupComplete: false, freeMode: false });
    closeSettings(); closeSidebar();
    setTimeout(() => {
      els.workspace.classList.add('hidden');
      els.lappyTrigger.classList.add('hidden');
      els.setupScreen.style.cssText = '';
      els.setupScreen.classList.remove('hidden');
      initSetupScreen();
    }, 400);
    toast('Reset — please re-configure', 'default');
  });
}

function openSettings() {
  if (!els.settingsModal) return;
  state.wasSidebarOpenBeforeSettings = state.isSidebarOpen;
  requestWindowSize(SETTINGS_WINDOW);
  els.settingsApiKey.value = state.apiKey;
  els.settingsProvGrid.querySelectorAll('.provider-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.provider === state.provider)
  );
  populateModelSelect(els.settingsModel, state.provider, state.model);
  els.settingsModal.classList.remove('hidden');
}
function closeSettings() {
  if (!els.settingsModal) return;
  els.settingsModal.classList.add('hidden');
  if (state.isSidebarOpen || state.wasSidebarOpenBeforeSettings) requestWindowSize(EXPANDED_WINDOW);
  else requestWindowSize(COMPACT_WINDOW);
}

// ── Electron IPC listeners ─────────────────────────────────────────────────
function initElectron() {
  if (!IS_ELECTRON) return;
  // Receive lasso result from main process (Electron version)
  window.lappyAPI.onLassoResult((croppedDataUrl) => {
    openSidebar();
    setAttachedImage(croppedDataUrl);
    setContextPill('Area captured — ask your question below');
    toast('Area captured!', 'success');
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────
function boot() {
  const saved = Storage.load();

  if (IS_ELECTRON) {
    showWorkspace();
    if (!state.apiKey && !state.freeMode) {
      toast('Add API key from Settings to enable AI replies', 'default', 4500);
    }
  } else if (saved && (state.apiKey || state.freeMode)) {
    showWorkspace();
  } else if (FREE_MODE_ENABLED && HARDCODED_OPENROUTER_KEY.startsWith('sk-or')) {
    // Auto-launch with hardcoded key
    state.apiKey          = HARDCODED_OPENROUTER_KEY;
    state.provider        = 'openrouter';
    state.model           = PRIMARY_MODEL;
    state.freeMode        = true;
    state.isSetupComplete = true;
    Storage.save();
    showWorkspace();
  } else {
    initSetupScreen();
  }

  initTrigger();
  initSidebarInput();
  initDraggable();
  initSettings();
  initElectron();
}

boot();
