// app.js — iOS Safari Tester frontend
// Uses window.__TAURI__ injected by Tauri (withGlobalTauri: true)

const { invoke } = window.__TAURI__.core;
const { Store } = window.__TAURI_PLUGIN_STORE__;

// ── Store ──────────────────────────────────────────────────────────────────
let store;
async function initStore() {
  store = await Store.load('prefs.json', { autoSave: true });
}

// ── Device definitions ────────────────────────────────────────────────────
const DEVICES = [
  {
    id: 'se3',
    label: 'iPhone SE (3rd)',
    cssW: 375, cssH: 667,
    physW: 750, physH: 1334,
    dpr: 2,
    safeTop: 20, safeBottom: 0,
    frameStyle: 'se',
    topbarH: 54,   // px in CSS space inside frame
    bottombarH: 56,
  },
  {
    id: '12mini',
    label: 'iPhone 12 mini',
    cssW: 360, cssH: 780,
    physW: 1080, physH: 2340,
    dpr: 3,
    safeTop: 50, safeBottom: 34,
    frameStyle: 'notch',
    topbarH: 66,
    bottombarH: 34,
  },
  {
    id: '14',
    label: 'iPhone 14',
    cssW: 390, cssH: 844,
    physW: 1170, physH: 2532,
    dpr: 3,
    safeTop: 47, safeBottom: 34,
    frameStyle: 'notch',
    topbarH: 66,
    bottombarH: 34,
  },
  {
    id: '14plus',
    label: 'iPhone 14 Plus',
    cssW: 428, cssH: 926,
    physW: 1284, physH: 2778,
    dpr: 3,
    safeTop: 47, safeBottom: 34,
    frameStyle: 'notch',
    topbarH: 66,
    bottombarH: 34,
  },
  {
    id: '16',
    label: 'iPhone 16',
    cssW: 393, cssH: 852,
    physW: 1179, physH: 2556,
    dpr: 3,
    safeTop: 59, safeBottom: 34,
    frameStyle: 'dynamic-island',
    topbarH: 70,
    bottombarH: 34,
  },
  {
    id: '16pro',
    label: 'iPhone 16 Pro',
    cssW: 402, cssH: 874,
    physW: 1206, physH: 2622,
    dpr: 3,
    safeTop: 59, safeBottom: 34,
    frameStyle: 'dynamic-island',
    topbarH: 70,
    bottombarH: 34,
  },
  {
    id: '16promax',
    label: 'iPhone 16 Pro Max',
    cssW: 440, cssH: 956,
    physW: 1320, physH: 2868,
    dpr: 3,
    safeTop: 59, safeBottom: 34,
    frameStyle: 'dynamic-island',
    topbarH: 70,
    bottombarH: 34,
  },
  {
    id: 'air',
    label: 'iPhone Air',
    cssW: 420, cssH: 932,
    physW: 1260, physH: 2796,
    dpr: 3,
    safeTop: 59, safeBottom: 34,
    frameStyle: 'dynamic-island',
    topbarH: 70,
    bottombarH: 34,
  },
];

// ── Bug toggles ────────────────────────────────────────────────────────────
// id, label, and a function (device) => { css?, js? } that returns the injection
const BUG_TOGGLES = [
  {
    id: 'vh-toolbar',
    label: '100vh toolbar',
    inject: () => ({
      css: `:root { --ios-vh-offset: 84px; }
[style*="100vh"], .full-height, main, section, .hero {
  max-height: calc(100vh - var(--ios-vh-offset)) !important;
}`
    }),
  },
  {
    id: 'no-backdrop',
    label: 'No backdrop-filter',
    inject: () => ({
      css: `* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`
    }),
  },
  {
    id: 'no-overscroll',
    label: 'No overscroll',
    inject: () => ({
      css: `* { overscroll-behavior: auto !important; }`
    }),
  },
  {
    id: 'no-gap',
    label: 'No gap (iOS <14)',
    inject: () => ({
      css: `* { gap: 0 !important; column-gap: 0 !important; row-gap: 0 !important; }`
    }),
  },
  {
    id: 'no-sticky',
    label: 'No sticky overflow',
    inject: () => ({
      css: `/* Force sticky → relative inside overflow containers */
*[style*="overflow"], .overflow-auto, .overflow-scroll,
[class*="scroll"], [class*="overflow"] {
  overflow: auto !important;
}
*[style*="overflow"] > [style*="sticky"],
.overflow-auto > [style*="sticky"],
.overflow-scroll > [style*="sticky"],
[class*="scroll"] > [style*="sticky"],
[class*="overflow"] > [style*="sticky"] {
  position: relative !important;
}`
    }),
  },
  {
    id: 'safe-area',
    label: 'Safe area insets',
    // CSS injected dynamically with device values
    inject: (device) => ({
      css: `:root {
  --safe-area-inset-top: ${device.safeTop}px;
  --safe-area-inset-bottom: ${device.safeBottom}px;
  --safe-area-inset-left: 0px;
  --safe-area-inset-right: 0px;
}
/* Override env() fallbacks */
@supports (padding-top: env(safe-area-inset-top)) {
  :root {
    padding-top: env(safe-area-inset-top, ${device.safeTop}px);
    padding-bottom: env(safe-area-inset-bottom, ${device.safeBottom}px);
  }
}`
    }),
  },
  {
    id: 'no-smooth-scroll',
    label: 'No smooth scroll',
    inject: () => ({
      css: `* { scroll-behavior: auto !important; }`
    }),
  },
  {
    id: 'no-hover',
    label: 'Disable hover states',
    inject: () => ({
      css: `@media (hover: none) { *:hover { all: revert; } }`
    }),
  },
];

// ── State ─────────────────────────────────────────────────────────────────
let currentDevice = DEVICES.find(d => d.id === '16') || DEVICES[4];
let activeToggles = new Set();
let hasNavigated = false;

// ── DOM refs ──────────────────────────────────────────────────────────────
const deviceSelect  = document.getElementById('device-select');
const urlInput      = document.getElementById('url-input');
const goBtn         = document.getElementById('go-btn');
const reloadBtn     = document.getElementById('reload-btn');
const togglesGrid   = document.getElementById('toggles-grid');
const phoneFrame    = document.getElementById('phone-frame');
const islandNotch   = document.getElementById('island-notch');
const deviceInfo    = document.getElementById('device-info');
const webviewArea   = document.getElementById('webview-placeholder');

// ── Populate device select ────────────────────────────────────────────────
function buildDeviceSelect() {
  DEVICES.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.label;
    deviceSelect.appendChild(opt);
  });
  deviceSelect.value = currentDevice.id;
}

// ── Populate toggle chips ─────────────────────────────────────────────────
function buildToggles() {
  BUG_TOGGLES.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'toggle-chip';
    chip.dataset.id = t.id;
    chip.innerHTML = `<div class="toggle-dot"></div><span>${t.label}</span>`;
    chip.addEventListener('click', () => handleToggleClick(t.id));
    togglesGrid.appendChild(chip);
  });
}

function handleToggleClick(id) {
  if (activeToggles.has(id)) {
    activeToggles.delete(id);
    if (hasNavigated) removeToggle(id);
  } else {
    activeToggles.add(id);
    if (hasNavigated) applyToggle(id);
  }
  updateToggleUI(id);
  persistPrefs();
}

function updateToggleUI(id) {
  const chip = togglesGrid.querySelector(`[data-id="${id}"]`);
  if (!chip) return;
  chip.classList.toggle('active', activeToggles.has(id));
}

// ── Apply / remove toggle CSS injections ──────────────────────────────────
async function applyToggle(id) {
  const toggle = BUG_TOGGLES.find(t => t.id === id);
  if (!toggle) return;
  const { css, js } = toggle.inject(currentDevice);
  if (css) {
    await invoke('inject_css', { id: `ios-emu-toggle-${id}`, css });
  }
  if (js) {
    await invoke('inject_js', { js });
  }
}

async function removeToggle(id) {
  await invoke('remove_css', { id: `ios-emu-toggle-${id}` });
}

async function applyAllActiveToggles() {
  for (const id of activeToggles) {
    await applyToggle(id);
  }
}

// Reapply safe-area toggle with new device values when device changes
async function reapplySafeAreaIfActive() {
  if (activeToggles.has('safe-area') && hasNavigated) {
    await applyToggle('safe-area');
  }
}

// ── DPR override ──────────────────────────────────────────────────────────
async function injectDprOverride(dpr) {
  const js = `
(function() {
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      get: function() { return ${dpr}; },
      configurable: true,
      enumerable: true
    });
  } catch(e) {}
})();
`;
  await invoke('inject_js', { js });
}

// ── Frame chrome update ───────────────────────────────────────────────────
// Scale factor: we scale the CSS logical size to fit inside the available space
function computeScale() {
  const wrapperH = window.innerHeight
    - parseInt(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-h') || '28')
    - document.getElementById('controls').offsetHeight
    - 24; // wrapper padding

  const wrapperW = window.innerWidth - 24;

  // Frame adds ~8px border each side, plus topbar/bottombar height in the frame
  const frameExtraH = currentDevice.topbarH + currentDevice.bottombarH + 16;
  const frameExtraW = 16;

  const neededH = currentDevice.cssH + frameExtraH;
  const neededW = currentDevice.cssW + frameExtraW;

  const scaleH = wrapperH / neededH;
  const scaleW = wrapperW / neededW;
  return Math.min(1, scaleH, scaleW);
}

function updateFrameChrome() {
  const d = currentDevice;
  const scale = computeScale();

  // Frame outer size
  const frameW = d.cssW + 16; // border + padding
  const frameH = d.cssH + d.topbarH + d.bottombarH + 16;

  phoneFrame.style.width  = `${Math.round(frameW * scale)}px`;
  phoneFrame.style.height = `${Math.round(frameH * scale)}px`;
  phoneFrame.style.fontSize = `${scale}em`; // scale inner text

  // Webview area size
  webviewArea.style.width  = `${Math.round(d.cssW * scale)}px`;
  webviewArea.style.height = `${Math.round(d.cssH * scale)}px`;

  // Topbar / bottombar heights
  const topbar = document.getElementById('phone-topbar');
  const bottombar = document.getElementById('phone-bottombar');
  topbar.style.height = `${Math.round(d.topbarH * scale)}px`;
  bottombar.style.height = `${Math.round(d.bottombarH * scale)}px`;

  // Frame style class
  phoneFrame.className = ''; // reset
  phoneFrame.classList.add(`frame-${d.frameStyle}`);

  // Island / notch
  islandNotch.className = ''; // reset
  switch (d.frameStyle) {
    case 'dynamic-island':
      islandNotch.classList.add('island-notch--dynamic-island');
      islandNotch.style.width  = `${Math.round(120 * scale)}px`;
      islandNotch.style.height = `${Math.round(34 * scale)}px`;
      break;
    case 'notch':
      islandNotch.classList.add('island-notch--notch');
      islandNotch.style.width  = `${Math.round(150 * scale)}px`;
      islandNotch.style.height = `${Math.round(28 * scale)}px`;
      break;
    case 'se':
      islandNotch.classList.add('island-notch--forehead');
      islandNotch.style.width  = '';
      islandNotch.style.height = `${Math.round(14 * scale)}px`;
      break;
  }

  // Phone border radius scales too
  const baseRadius = d.frameStyle === 'se' ? 28 : d.frameStyle === 'notch' ? 44 : 50;
  phoneFrame.style.borderRadius = `${Math.round(baseRadius * scale)}px`;

  // Device info line
  deviceInfo.textContent =
    `${d.cssW} × ${d.cssH}  ·  @${d.dpr}x  ·  ${d.physW} × ${d.physH}px physical`;
}

// ── Navigation ────────────────────────────────────────────────────────────
async function navigate() {
  let url = urlInput.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  urlInput.value = url;
  hasNavigated = true;

  await invoke('navigate', { url });
  await injectDprOverride(currentDevice.dpr);
  await applyAllActiveToggles();
  persistPrefs();
}

async function reload() {
  if (!hasNavigated) return;
  await invoke('inject_js', { js: 'window.location.reload();' });
  // Re-apply after a short delay to let the page load
  setTimeout(async () => {
    await injectDprOverride(currentDevice.dpr);
    await applyAllActiveToggles();
  }, 1200);
}

// ── Device change ─────────────────────────────────────────────────────────
async function handleDeviceChange() {
  currentDevice = DEVICES.find(d => d.id === deviceSelect.value) || DEVICES[4];
  updateFrameChrome();
  await reapplySafeAreaIfActive();
  if (hasNavigated) {
    await injectDprOverride(currentDevice.dpr);
  }
  persistPrefs();
}

// ── Persist prefs via Tauri store ─────────────────────────────────────────
async function persistPrefs() {
  if (!store) return;
  await store.set('lastUrl', urlInput.value);
  await store.set('lastDevice', currentDevice.id);
  await store.set('activeToggles', [...activeToggles]);
}

async function loadPrefs() {
  if (!store) return;
  const lastDevice = await store.get('lastDevice');
  if (lastDevice) {
    const d = DEVICES.find(x => x.id === lastDevice);
    if (d) {
      currentDevice = d;
      deviceSelect.value = lastDevice;
    }
  }
  const lastUrl = await store.get('lastUrl');
  if (lastUrl) urlInput.value = lastUrl;

  const savedToggles = await store.get('activeToggles');
  if (Array.isArray(savedToggles)) {
    savedToggles.forEach(id => {
      if (BUG_TOGGLES.find(t => t.id === id)) {
        activeToggles.add(id);
        updateToggleUI(id);
      }
    });
  }
}

// ── Event wiring ──────────────────────────────────────────────────────────
goBtn.addEventListener('click', navigate);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(); });
reloadBtn.addEventListener('click', reload);
deviceSelect.addEventListener('change', handleDeviceChange);

// ── Boot ──────────────────────────────────────────────────────────────────
(async function init() {
  await initStore();
  buildDeviceSelect();
  buildToggles();
  await loadPrefs();
  updateFrameChrome();
})();
