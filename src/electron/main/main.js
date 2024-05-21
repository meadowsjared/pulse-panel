const { join } = require('path')
const { app, BrowserWindow, ipcMain } = require('electron')
const settings = require('../settings')

const isDev = process.env.npm_lifecycle_event === 'app:dev'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
/** this is the main window of the app
 * @type {BrowserWindow} */
let mainWindow = null

app.whenReady().then(() => {
  // Expose a method to read and save settings
  ipcMain.handle('read-setting', (_, settingKey) => settings.readSetting(settingKey))
  ipcMain.handle('save-setting', (_, settingKey, settingValue) => settings.saveSetting(settingKey, settingValue))
  ipcMain.handle('delete-setting', (_, settingKey) => settings.deleteSetting(settingKey))
  ipcMain.handle('send-key', (_, keys, down) => settings.sendKey(keys, down))
  ipcMain.on('toggle-dark-mode', (_, value) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('dark-mode-updated', value)
    })
  })
  ipcMain.handle('register-hotkeys', (_, hotkeys) => settings.registerHotkeys(hotkeys))
  ipcMain.handle('unregister-hotkeys', (_, hotkeys) => settings.unregisterHotkeys(hotkeys))
  ipcMain.handle('close-window', () => mainWindow.close())
  ipcMain.handle('minimize-window', () => mainWindow.minimize())
  ipcMain.handle('maximize-restore-window', () =>
    mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize()
  )
  ipcMain.handle('restore-window', () => mainWindow.restore())
  ipcMain.handle('request-main-window-sized', updateMaximizeRestoreMenuItem)
})

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    frame: false,
    width: 1100,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
    },
  })
  mainWindow.on('resize', updateMaximizeRestoreMenuItem)

  // and load the index.html of the app.
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000') // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../../dist/index.html'))
  }
  // mainWindow.loadURL( //this doesn't work on macOS in build and preview mode
  //     isDev ?
  //     'http://localhost:3000' :
  //     join(__dirname, '../../index.html')
  // );
}

function updateMaximizeRestoreMenuItem() {
  const isMaximized = mainWindow.isMaximized()
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
