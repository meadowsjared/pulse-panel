const { join } = require('path')
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const settings = require('../settings')

const isDev = process.env.npm_lifecycle_event === 'app:dev'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
/** this is the main window of the app
 * @type {BrowserWindow} */
let mainWindow = null

app.whenReady().then(() => {
  // Expose a method to read and save settings
  ipcMain.handle('_read-setting', (_, settingKey) => settings._readSetting(settingKey))
  ipcMain.handle('send-key', (_, keys, down) => settings.sendKey(keys, down))
  ipcMain.on('toggle-dark-mode', (_, value) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('dark-mode-updated', value)
    })
  })
  ipcMain.handle('register-hotkeys', (_, hotkeys) => settings.registerHotkeys(hotkeys))
  ipcMain.handle('add-hotkeys', (_, hotkeys) => settings.addHotkeys(hotkeys))
  ipcMain.handle('unregister-hotkeys', (_, hotkeys) => settings.unregisterHotkeys(hotkeys))
  ipcMain.handle('close-window', () => mainWindow.close())
  ipcMain.handle('minimize-window', () => mainWindow.minimize())
  ipcMain.handle('maximize-restore-window', () =>
    mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize()
  )
  ipcMain.handle('restore-window', () => mainWindow.restore())
  ipcMain.handle('request-main-window-sized', resizeTriggered)
  ipcMain.handle('open-external-link', (_, url) => shell.openExternal(url))
  ipcMain.handle('download-vb-cable', (_, appName) => settings.downloadVBCable(appName))

  ipcMain.handle('read-all-db-settings', () => settings.readAllDBSettings())
  ipcMain.handle('save-db-setting', (_, settingName, settingValue) => settings.saveDBSetting(settingName, settingValue))
  ipcMain.handle('read-db-setting', (_, settingName) => settings.readDBSetting(settingName))
  ipcMain.handle('delete-db-setting', (_, settingName) => settings.deleteDBSetting(settingName))
  ipcMain.handle('read-all-db-sounds', () => settings.readAllDBSounds())
  ipcMain.handle('save-sound', (_, sound, orderIndex) => settings.saveSound(sound, orderIndex))
  ipcMain.handle('save-sound-property', (_, sound, propertyName) => settings.saveSoundProperty(sound, propertyName))
  ipcMain.handle('insert-sounds', (_, beforeIndex, ...newSounds) => settings.insertSounds(beforeIndex, ...newSounds))
  ipcMain.handle('move-sound', (_, prevIndex, newIndex) => settings.moveSound(prevIndex, newIndex))
  ipcMain.handle('reorder-sound', (_, soundId, newIndex) => settings.reorderSound(soundId, newIndex))
  ipcMain.handle('delete-sound-property', (_, sound, propertyName) => settings.deleteSoundProperty(sound, propertyName))
  ipcMain.handle('delete-sound', (_, sound) => settings.deleteSound(sound))
  ipcMain.handle('save-sounds-array', (_, sounds) => settings.saveSoundsArray(sounds))
  ipcMain.handle('save-visibility', (_, visibilityChanges) => settings.saveVisibility(visibilityChanges))
})

function createWindow() {
  // Create the browser window.
  const size = settings.readDBSetting('window-size') || [1100, 900]
  mainWindow = new BrowserWindow({
    frame: false,
    width: size[0],
    height: size[1],
    minWidth: 577,
    minHeight: 341,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
    },
  })
  mainWindow.on('resize', resizeTriggered)

  // and load the index.html of the app.
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000') // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../../dist/index.html'))
  }
}

function resizeTriggered() {
  const isMaximized = mainWindow.isMaximized()
  const size = mainWindow.getSize()
  settings.saveDBSetting('window-size', size)
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('main-window-resized', isMaximized)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  settings.stop()
})

app.on('browser-window-focus', () => {
  mainWindow.setAccentColor('#237b23')
})

app.on('browser-window-blur', () => {
  mainWindow.setAccentColor('#404040')
})
