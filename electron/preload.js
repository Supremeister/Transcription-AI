const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setupAI: () => ipcRenderer.invoke('setup-ai'),
  onSetupProgress: (callback) => {
    ipcRenderer.on('setup-progress', (_, msg) => callback(msg));
  }
});
