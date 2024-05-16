const { join } = require('path')
const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const settings = require('../settings')

const isDev = process.env.npm_lifecycle_event === 'app:dev'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
let settingsWindow = null

app.whenReady().then(() => {
  const template = [
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Settings',
          click: openSettingsWindow,
        },
      ],
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggledevtools' }],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://electronjs.org')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  // Expose a method to read and save settings
  ipcMain.handle('read-setting', (_, settingKey) => settings.readSetting(settingKey))
  ipcMain.handle('save-setting', (_, settingKey, settingValue) => settings.saveSetting(settingKey, settingValue))
  ipcMain.handle('delete-setting', (_, settingKey) => settings.deleteSetting(settingKey))
  ipcMain.handle('send-key', (_, key, down) => settings.sendKey(key, down))
  ipcMain.on('toggle-dark-mode', (_, value) => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('dark-mode-updated', value)
    })
  })
  ipcMain.handle('register-hotkeys', (_, hotkeys) => settings.registerHotkeys(hotkeys))
  ipcMain.handle('unregister-hotkeys', (_, hotkeys) => settings.unregisterHotkeys(hotkeys))
})

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
    },
  })

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

  // make it so if the main window closes, the settings window will close as well
  mainWindow.on('closed', function () {
    if (settingsWindow) {
      settingsWindow.close()
    }
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
  if (settingsWindow) {
    settingsWindow.close()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    frame: false,
    height: 230,
    resizable: false,
    width: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
    },
  })

  settingsWindow.loadURL('http://localhost:3000/settings')
  settingsWindow.webContents.openDevTools()

  settingsWindow.on('closed', function () {
    console.log('Settings window closed')
    settingsWindow = null
  })
}

app.on('will-quit', () => {
  settings.stop()
})
