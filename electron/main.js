const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  nativeImage,
  shell,
} = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

let mainWindow   = null;
let overlayWin   = null;

function clampToVisibleBounds(x, y, width, height) {
  const { bounds } = screen.getPrimaryDisplay();
  const margin = 8;
  const minX = bounds.x + margin;
  const minY = bounds.y + margin;
  const maxX = bounds.x + bounds.width - width - margin;
  const maxY = bounds.y + bounds.height - height - margin;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

// ── Main floating window ───────────────────────────────────────────────────
function createMainWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  const compactWidth = 180;
  const compactHeight = 64;

  mainWindow = new BrowserWindow({
    width:       compactWidth,
    height:      compactHeight,
    x:           bounds.width - compactWidth - 20,
    y:           24,
    frame:       false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable:   false,
    hasShadow:   false,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  // In dev load Vite dev server; in prod load built index.html
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
}

// ── Lasso / Screenshot overlay window ─────────────────────────────────────
async function createOverlay(captureDataUrl) {
  if (overlayWin) { overlayWin.close(); overlayWin = null; }

  const { bounds } = screen.getPrimaryDisplay();

  overlayWin = new BrowserWindow({
    x:           bounds.x,
    y:           bounds.y,
    width:       bounds.width,
    height:      bounds.height,
    frame:       false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable:   false,
    focusable:   true,
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  });

  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true);

  // Load inline HTML for the overlay
  const html = buildOverlayHTML(captureDataUrl, bounds.width, bounds.height);
  overlayWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  overlayWin.focus();
}

function buildOverlayHTML(imgDataUrl, w, h) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${w}px; height:${h}px; overflow:hidden; cursor:crosshair; background:transparent; }
  canvas { position:absolute; top:0; left:0; }
  #hint {
    position:absolute; top:20px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,0.7); color:#fff; padding:8px 18px;
    border-radius:20px; font-family:system-ui; font-size:13px;
    pointer-events:none; z-index:10;
  }
  #btn-cancel {
    position:absolute; bottom:24px; left:50%; transform:translateX(-50%);
    background:rgba(239,68,68,0.9); color:#fff; border:none; border-radius:10px;
    padding:10px 28px; font-size:14px; font-family:system-ui; cursor:pointer;
    z-index:10; font-weight:600;
  }
  #btn-cancel:hover { background:rgba(239,68,68,1); }
</style>
</head>
<body>
<div id="hint">Draw around the area you want to capture — release to confirm</div>
<canvas id="bg"></canvas>
<canvas id="lasso"></canvas>
<button id="btn-cancel">✕ Cancel</button>
<script>
  const W = ${w}, H = ${h};
  const IMG = new Image();
  IMG.src = ${JSON.stringify(imgDataUrl)};

  const bg    = document.getElementById('bg');
  const cv    = document.getElementById('lasso');
  bg.width    = cv.width  = W;
  bg.height   = cv.height = H;
  const bgCtx = bg.getContext('2d');
  const ctx   = cv.getContext('2d');

  IMG.onload = () => {
    bgCtx.drawImage(IMG, 0, 0, W, H);
    // Dark overlay
    bgCtx.fillStyle = 'rgba(0,0,0,0.35)';
    bgCtx.fillRect(0, 0, W, H);
  };

  let drawing = false;
  let points  = [];

  cv.addEventListener('mousedown', e => {
    drawing = true;
    points  = [{ x: e.clientX, y: e.clientY }];
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.moveTo(e.clientX, e.clientY);
  });

  cv.addEventListener('mousemove', e => {
    if (!drawing) return;
    points.push({ x: e.clientX, y: e.clientY });
    ctx.lineTo(e.clientX, e.clientY);
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    // Fill as user draws
    ctx.fillStyle = 'rgba(139,92,246,0.12)';
    ctx.fill();
  });

  cv.addEventListener('mouseup', () => {
    if (!drawing || points.length < 8) { drawing = false; return; }
    drawing = false;
    ctx.closePath();

    // Compute bounding box of lasso
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const x1 = Math.max(0, Math.min(...xs) - 4);
    const y1 = Math.max(0, Math.min(...ys) - 4);
    const x2 = Math.min(W, Math.max(...xs) + 4);
    const y2 = Math.min(H, Math.max(...ys) + 4);
    const cw = x2 - x1;
    const ch = y2 - y1;

    // Crop from the background image
    const crop = document.createElement('canvas');
    crop.width  = cw;
    crop.height = ch;
    const cropCtx = crop.getContext('2d');
    cropCtx.drawImage(IMG, x1, y1, cw, ch, 0, 0, cw, ch);

    const cropped = crop.toDataURL('image/png');
    window.lappyAPI.lassoComplete(cropped);
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    window.lappyAPI.lassoCancel();
  });
</script>
</body>
</html>`;
}

// ── IPC Handlers ───────────────────────────────────────────────────────────

// Capture the full screen → return as base64 data URL
ipcMain.handle('capture-screen', async () => {
  try {
    const { bounds } = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types:         ['screen'],
      thumbnailSize: { width: bounds.width, height: bounds.height },
    });
    return sources[0]?.thumbnail?.toDataURL() ?? null;
  } catch (err) {
    // If permission not granted or out of memory
    return null;
  }
});

// Start lasso overlay
ipcMain.handle('start-lasso', async () => {
  try {
    const { bounds } = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types:         ['screen'],
      thumbnailSize: { width: bounds.width, height: bounds.height },
    });
    const dataUrl = sources[0]?.thumbnail?.toDataURL() ?? null;
    if (!dataUrl) return;
    // Hide main window while selecting
    mainWindow?.hide();
    await createOverlay(dataUrl);
  } catch (err) {
    return null;
  }
});

// Lasso done → forward cropped image to main renderer
ipcMain.handle('lasso-complete', (_e, croppedDataUrl) => {
  overlayWin?.close();
  overlayWin = null;
  mainWindow?.show();
  mainWindow?.webContents.send('lasso-result', croppedDataUrl);
});

// User cancelled
ipcMain.handle('lasso-cancel', () => {
  overlayWin?.close();
  overlayWin = null;
  mainWindow?.show();
});

// Window resize (sidebar open/minimized)
ipcMain.handle('resize-window', (_e, { width, height }) => {
  if (!mainWindow) return;
  const [currW, currH] = mainWindow.getSize();
  const [currX, currY] = mainWindow.getPosition();
  const nextW = Math.max(120, Math.floor(width));
  const nextH = Math.max(56, Math.floor(height));
  const next = clampToVisibleBounds(currX, currY, nextW, nextH);
  mainWindow.setBounds({ x: next.x, y: next.y, width: nextW, height: nextH }, true);
});

ipcMain.handle('move-window-by', (_e, { dx, dy }) => {
  if (!mainWindow) return;
  const [w, h] = mainWindow.getSize();
  const [x, y] = mainWindow.getPosition();
  const next = clampToVisibleBounds(x + Math.floor(dx), y + Math.floor(dy), w, h);
  mainWindow.setPosition(next.x, next.y, true);
});

// Open external links in default browser
ipcMain.handle('open-external', (_e, url) => { shell.openExternal(url); });

// ── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
