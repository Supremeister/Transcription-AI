const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setupAI: () => ipcRenderer.invoke('setup-ai'),
  onSetupProgress: (callback) => {
    ipcRenderer.on('setup-progress', (_, msg) => callback(msg));
  },
  onModelDownloadProgress: (callback) => {
    ipcRenderer.on('model-download-progress', (_, data) => callback(data));
  }
});
