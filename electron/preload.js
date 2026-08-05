const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  setupAI: () => ipcRenderer.invoke('setup-ai'),
  onSetupProgress: (callback) => {
    ipcRenderer.on('setup-progress', (_, msg) => callback(msg));
  },
  getBotUsername: () => ipcRenderer.invoke('get-bot-username'),
  onBotUsername: (callback) => {
    ipcRenderer.on('bot-username', (_, username) => callback(username));
  },
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (_, info) => callback(info));
  },
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (_, info) => callback(info));
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
});
