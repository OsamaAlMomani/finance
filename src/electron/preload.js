import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require('electron');

const MUTATION_CHANNEL_RE = /^db-(add|update|delete|save|create|set|pay|finalize|reopen|reset|restore|replace|revoke|complete|mark|refresh|optimize)-/i;
let financeDataChangeTimer = null;

const scheduleFinanceDataChanged = (channel) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  if (financeDataChangeTimer) {
    clearTimeout(financeDataChangeTimer);
  }
  financeDataChangeTimer = setTimeout(() => {
    financeDataChangeTimer = null;
    window.dispatchEvent(new CustomEvent('finance:data-changed', {
      detail: {
        channel,
        at: new Date().toISOString()
      }
    }));
  }, 250);
};

const invoke = async (channel, ...args) => {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (MUTATION_CHANNEL_RE.test(String(channel || ''))) {
    scheduleFinanceDataChanged(channel);
  }
  return result;
};

contextBridge.exposeInMainWorld('electron', {
  invoke,
  on: (channel, func) => {
    const subscription = (_event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  off: (channel, func) => ipcRenderer.removeListener(channel, func),
  windowControl: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  }
});
