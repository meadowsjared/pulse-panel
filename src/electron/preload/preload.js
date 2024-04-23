// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // note: these are defined in /@types/electron-window.d.ts
  readSetting: key => ipcRenderer.invoke('read-setting', key),
  saveSetting: (key, value) => ipcRenderer.invoke('save-setting', key, value),
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    platform: require('os').platform(),
    vue: require('vue/package.json').version,
    pinia: require('pinia/package.json').version,
  },
})
