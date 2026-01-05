// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { join } = require('path')
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
  _readSetting: key => ipcRenderer.invoke('_read-setting', key),
  sendKey: (keys, down) => ipcRenderer.invoke('send-key', keys, down),
  registerHotkeys: hotkeys => ipcRenderer.invoke('register-hotkeys', hotkeys),
  addHotkeys: hotkeys => ipcRenderer.invoke('add-hotkeys', hotkeys),
  unregisterHotkeys: hotkeys => ipcRenderer.invoke('unregister-hotkeys', hotkeys),
  onKeyPressed: callback => {
    ipcRenderer.on('on-key-pressed', (_, key) => callback(key))
  },
  setCloseToTray: value => ipcRenderer.invoke('set-close-to-tray', value),
  toggleDarkMode: value => {
    ipcRenderer.send('toggle-dark-mode', value)
  },
  onDarkModeToggle: callback => {
    ipcRenderer.on('dark-mode-updated', (_, value) => callback(value))
  },
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeRestoreWindow: () => ipcRenderer.invoke('maximize-restore-window'),
  onWindowResized: callback => {
    ipcRenderer.on('main-window-resized', (_, isMaximized) => callback(isMaximized))
  },
  requestMainWindowSized: () => ipcRenderer.invoke('request-main-window-sized'),
  expandWindow: (widthChange, heightChange) => ipcRenderer.invoke('expand-window', widthChange, heightChange),
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  setWindowSize: (width, height) => ipcRenderer.invoke('set-window-size', width, height),
  openExternalLink: url => ipcRenderer.invoke('open-external-link', url),
  downloadVBCable: appName => ipcRenderer.invoke('download-vb-cable', appName),
  // Database related
  readAllDBSettings: () => ipcRenderer.invoke('read-all-db-settings'),
  saveDBSetting: (settingName, settingValue) => ipcRenderer.invoke('save-db-setting', settingName, settingValue),
  readDBSetting: settingName => ipcRenderer.invoke('read-db-setting', settingName),
  deleteDBSetting: settingName => ipcRenderer.invoke('delete-db-setting', settingName),
  readAllDBSounds: () => ipcRenderer.invoke('read-all-db-sounds'),
  saveSound: (sound, orderIndex) => ipcRenderer.invoke('save-sound', sound, orderIndex),
  saveSoundProperty: (sound, propertyName) => ipcRenderer.invoke('save-sound-property', sound, propertyName),
  insertSounds: (beforeIndex, ...newSounds) => ipcRenderer.invoke('insert-sounds', beforeIndex, ...newSounds),
  moveSound: (prevIndex, newIndex) => ipcRenderer.invoke('move-sound', prevIndex, newIndex),
  reorderSound: (soundId, newIndex) => ipcRenderer.invoke('reorder-sound', soundId, newIndex),
  deleteSoundProperty: (sound, propertyName) => ipcRenderer.invoke('delete-sound-property', sound, propertyName),
  deleteSound: sound => ipcRenderer.invoke('delete-sound', sound),
  saveSoundsArray: sounds => ipcRenderer.invoke('save-sounds-array', sounds),
  saveVisibility: visibilityChanges => ipcRenderer.invoke('save-visibility', visibilityChanges),
  versions: {
    app: require(join(__dirname, '../../../package.json')).version,
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    platform: require('os').platform(),
    vue: require(join(__dirname, '../../../node_modules/vue/package.json')).version,
    pinia: require(join(__dirname, '../../../node_modules/pinia/package.json')).version,
  },
})
