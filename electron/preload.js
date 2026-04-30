const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lappyAPI', {
  // Screen capture
  captureScreen:  ()  => ipcRenderer.invoke('capture-screen'),

  // Lasso
  startLasso:     ()  => ipcRenderer.invoke('start-lasso'),
  lassoComplete:  (d) => ipcRenderer.invoke('lasso-complete', d),
  lassoCancel:    ()  => ipcRenderer.invoke('lasso-cancel'),

  // Listen for lasso result in main renderer
  onLassoResult: (cb) => ipcRenderer.on('lasso-result', (_e, data) => cb(data)),

  // Window
  resizeWindow:   (o) => ipcRenderer.invoke('resize-window', o),
  moveWindowBy:   (o) => ipcRenderer.invoke('move-window-by', o),
  openExternal:   (u) => ipcRenderer.invoke('open-external', u),

  // Is running inside Electron?
  isElectron: true,
});
