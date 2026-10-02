const { join } = require('path')
const fs = require('fs')
const os = require('os')
const {
  app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog, clipboard, nativeImage, protocol,
} = require('electron')
const settings = require('../settings')
const updater = require('./updater')
const mediaManager = require('./mediaManager')

const isDev = process.env.npm_lifecycle_event === 'app:dev'
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pulse-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
])

// Prevent background throttling so mic passthrough and audio processing do not hitch or skip under system load
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')

/** this is the main window of the app
 * @type {BrowserWindow} */
let mainWindow = null
let tray = null
let closedToTray = false
let enableTray = false
let ignoreFirstTrayToggle = false

// Catch uncaught exceptions to prevent crashing or showing error modals on harmless aborted stream races
process.on('uncaughtException', err => {
  if (err?.code === 'ERR_INVALID_STATE' && String(err?.message || '').includes('ReadableStream')) {
    // Suppress known Node/Undici race condition when media requests are aborted mid-playback
    return
  }
  console.error('[Main Process] Uncaught Exception:', err)
})

/**
 * Safely converts a Node.js Readable stream into a WHATWG ReadableStream.
 * Handles renderer client aborts and prevents ERR_INVALID_STATE when streams close asynchronously.
 * @param {import('fs').ReadStream} nodeStream
 * @returns {ReadableStream}
 */
function nodeStreamToWebStream(nodeStream) {
  let isClosed = false

  const cleanup = () => {
    if (isClosed) return
    isClosed = true
    try {
      nodeStream.destroy()
    } catch (_) {}
  }

  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => {
        if (isClosed) return
        try {
          controller.enqueue(chunk)
          if (controller.desiredSize !== null && controller.desiredSize <= 0) {
            nodeStream.pause()
          }
        } catch (_) {
          cleanup()
        }
      })

      nodeStream.on('end', () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch (_) {}
      })

      nodeStream.on('error', err => {
        if (isClosed) return
        isClosed = true
        try {
          controller.error(err)
        } catch (_) {}
      })

      nodeStream.on('close', () => {
        cleanup()
      })
    },
    pull() {
      if (!isClosed && nodeStream.isPaused()) {
        nodeStream.resume()
      }
    },
    cancel() {
      cleanup()
    },
  })
}

app.whenReady().then(() => {
  try {
    protocol.handle('pulse-media', async request => {
      try {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
              'Access-Control-Allow-Headers': '*',
            },
          })
        }
        const url = new URL(request.url)
        let host = url.hostname.toLowerCase()
        let filename = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
        if (!filename && host !== 'soundboard' && host !== 'clips' && host !== 'media') {
          filename = decodeURIComponent(host)
          host = 'soundboard'
        }
        filename = filename.replace(/^\/+/, '')

        const baseDir = host === 'clips' ? mediaManager.getClipsDirectory() : mediaManager.getSoundboardDirectory()
        let filePath = join(baseDir, filename)
        if (!fs.existsSync(filePath)) {
          if (fs.existsSync(join(mediaManager.getMediaDirectory(), filename))) {
            filePath = join(mediaManager.getMediaDirectory(), filename)
          } else if (fs.existsSync(join(mediaManager.getSoundboardDirectory(), filename))) {
            filePath = join(mediaManager.getSoundboardDirectory(), filename)
          } else if (fs.existsSync(join(mediaManager.getClipsDirectory(), filename))) {
            filePath = join(mediaManager.getClipsDirectory(), filename)
          }
        }
        if (!fs.existsSync(filePath)) {
          return new Response('Not Found', {
            status: 404,
            headers: { 'Access-Control-Allow-Origin': '*' },
          })
        }
        const stat = fs.statSync(filePath)
        const fileSize = stat.size

        const ext = (filePath.split('.').pop() || '').toLowerCase()
        const mimeTypes = {
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          wave: 'audio/wav',
          ogg: 'audio/ogg',
          oga: 'audio/ogg',
          m4a: 'audio/mp4',
          aac: 'audio/aac',
          flac: 'audio/flac',
          webm: 'audio/webm',
          weba: 'audio/webm',
          mp4: 'video/mp4',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          svg: 'image/svg+xml',
          ico: 'image/x-icon',
        }
        let contentType = mimeTypes[ext] || 'application/octet-stream'

        // Auto-detect SVGs that may have been saved with raster extensions (.png, .jpg)
        try {
          const headerBuf = Buffer.alloc(100)
          const fd = fs.openSync(filePath, 'r')
          fs.readSync(fd, headerBuf, 0, 100, 0)
          fs.closeSync(fd)
          const headerStr = headerBuf.toString('utf8').trim()
          if (headerStr.startsWith('<svg') || headerStr.startsWith('<?xml')) {
            contentType = 'image/svg+xml'
          }
        } catch (_) {}

        if (request.method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': fileSize.toString(),
              'Accept-Ranges': 'bytes',
              'Access-Control-Allow-Origin': '*',
            },
          })
        }

        const rangeHeader = request.headers.get('range')
        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          const rangeStr = rangeHeader.slice(6).trim()
          let start = 0
          let end = fileSize - 1

          if (rangeStr.startsWith('-')) {
            const suffix = parseInt(rangeStr.slice(1), 10)
            if (!isNaN(suffix)) {
              start = Math.max(0, fileSize - suffix)
            }
          } else {
            const parts = rangeStr.split('-')
            start = parseInt(parts[0], 10)
            if (parts[1]) {
              end = parseInt(parts[1], 10)
            }
          }

          if (isNaN(start) || start >= fileSize) {
            return new Response(null, {
              status: 416,
              statusText: 'Range Not Satisfiable',
              headers: {
                'Content-Range': `bytes */${fileSize}`,
                'Access-Control-Allow-Origin': '*',
              },
            })
          }

          const safeEnd = Math.min(end, fileSize - 1)
          const chunkSize = safeEnd - start + 1
          const nodeStream = fs.createReadStream(filePath, { start, end: safeEnd })
          const headers = new Headers({
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${safeEnd}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Access-Control-Allow-Origin': '*',
          })
          return new Response(nodeStreamToWebStream(nodeStream), {
            status: 206,
            statusText: 'Partial Content',
            headers,
          })
        }

        const nodeStream = fs.createReadStream(filePath)
        const headers = new Headers({
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': fileSize.toString(),
          'Access-Control-Allow-Origin': '*',
        })
        return new Response(nodeStreamToWebStream(nodeStream), {
          status: 200,
          headers,
        })
      } catch (err) {
        console.error('[pulse-media] Error serving file:', err)
        return new Response('Internal error', {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      }
    })
  } catch (err) {
    console.error('[pulse-media] Failed to register protocol handler:', err)
  }

  ipcMain.handle('save-media-file', (_, payload) => mediaManager.saveMediaFile(payload))
  ipcMain.handle('read-media-file', (_, fileName) => mediaManager.readMediaFile(fileName))
  ipcMain.handle('delete-media-file', (_, fileName) => mediaManager.deleteMediaFile(fileName))
  ipcMain.handle('media-file-exists', (_, fileName) => mediaManager.mediaFileExists(fileName))
  ipcMain.handle('get-media-directory', () => mediaManager.getMediaDirectory())
  ipcMain.handle('get-soundboard-directory', () => mediaManager.getSoundboardDirectory())

  ipcMain.handle('save-clip-file', (_, payload) => mediaManager.saveClipFile(payload))
  ipcMain.handle('read-clip-file', (_, fileName) => mediaManager.readClipFile(fileName))
  ipcMain.handle('delete-clip-file', (_, fileName) => mediaManager.deleteClipFile(fileName))
  ipcMain.handle('clip-file-exists', (_, fileName) => mediaManager.clipFileExists(fileName))
  ipcMain.handle('get-clips-directory', () => mediaManager.getClipsDirectory())

  // Expose a method to read and save settings
  ipcMain.handle('_read-setting', (_, settingKey) => settings._readSetting(settingKey))
  ipcMain.handle('send-key', (_, keys, down) => settings.sendKey(keys, down))
  ipcMain.handle('set-close-to-tray', (_, /** @type {boolean} */ value) => {
    if (ignoreFirstTrayToggle === true) {
      // we know the app has started, since it is trying to set this value
      ignoreFirstTrayToggle = false
      // so we can safely tell it to set closeToTray to true
      mainWindow.webContents.send('close-to-tray-changed', true)
      return
    }
    if (value === true) {
      if (tray === null) {
        // Create tray
        createTray()
      }
    } else {
      // Remove tray
      mainWindow.show() // Ensure window is shown again
      tray?.destroy()
      tray = null
      mainWindow.removeAllListeners('close')
      mainWindow.removeAllListeners('minimize')
      mainWindow.removeAllListeners('restore')
      closedToTray = false
    }

    enableTray = value
  })
  ipcMain.handle('set-open-at-login', (_, openAtLogin) => {
    const args = []
    if (!app.isPackaged) {
      args.push(app.getAppPath())
    }
    if (openAtLogin) {
      args.push('--hidden')
    }
    app.setLoginItemSettings({
      openAtLogin: !!openAtLogin,
      path: process.execPath,
      args,
    })
  })
  ipcMain.handle('get-open-at-login', () => {
    const loginSettings = app.getLoginItemSettings(
      app.isPackaged ? undefined : { path: process.execPath, args: [app.getAppPath()] }
    )
    return !!(loginSettings.openAtLogin || loginSettings.executableWillLaunchAtLogin)
  })
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
  ipcMain.handle('maximize-restore-window', () => {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false)
      return
    }
    mainWindow.isMaximized() ? mainWindow.restore() : mainWindow.maximize()
  })
  ipcMain.handle('restore-window', () => mainWindow.restore())
  ipcMain.handle('request-main-window-sized', resizeTriggered)
  ipcMain.handle('expand-window', (_, widthChange, heightChange) => {
    const [currentWidth, currentHeight] = mainWindow.getContentSize()
    mainWindow.setContentSize(currentWidth + widthChange, currentHeight + heightChange)
  })
  ipcMain.handle('open-external-link', (_, url) => shell.openExternal(url))
  ipcMain.handle('download-vb-cable', (_, appName) => settings.downloadVBCable(appName))
  ipcMain.handle('check-virtual-cable-installed', () => settings.checkVirtualCableInstalled())

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
  ipcMain.handle('save-file-dialog', async (_, { defaultName, buffer, filters }) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Audio Clip',
      defaultPath: defaultName,
      filters: filters || [
        { name: 'MP3 Audio (*.mp3)', extensions: ['mp3'] },
        { name: 'OGG Audio (*.ogg)', extensions: ['ogg'] },
        { name: 'WAV Audio (*.wav)', extensions: ['wav'] },
      ],
    })
    if (result.canceled || !result.filePath) {
      return false
    }
    await fs.promises.writeFile(result.filePath, Buffer.from(buffer))
    return true
  })
  ipcMain.handle('download-and-install-update', async (_, downloadUrl) => {
    return updater.downloadAndInstallUpdate(downloadUrl, progress => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progress)
      }
    })
  })
  ipcMain.handle('write-image-to-clipboard', (_, { buffer, dataUrl, imageKey, imageUrl }) => {
    try {
      let img = null
      if (dataUrl) {
        img = nativeImage.createFromDataURL(dataUrl)
      }
      if ((!img || img.isEmpty()) && buffer) {
        const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
        img = nativeImage.createFromBuffer(buf)
      }
      if (!img || img.isEmpty()) {
        console.warn('[Pulse Panel] nativeImage could not be created from provided data')
        return false
      }
      clipboard.write({
        image: img,
        html: `<meta name="pulse-panel-image-key" content="${imageKey || ''
          }"><meta name="pulse-panel-image-url" content="${imageUrl || ''}">`,
      })
      return true
    } catch (err) {
      console.warn('Error writing image to clipboard:', err)
      return false
    }
  })
  ipcMain.handle('read-image-from-clipboard', () => {
    try {
      const html = clipboard.readHTML()
      let imageKey = null
      let imageUrl = null

      if (html) {
        const keyMatch = html.match(/name="pulse-panel-image-key"\s+content="([^"]*)"/)
        if (keyMatch && keyMatch[1]) {
          imageKey = keyMatch[1]
        }
        const urlMatch = html.match(/name="pulse-panel-image-url"\s+content="([^"]*)"/)
        if (urlMatch && urlMatch[1]) {
          imageUrl = urlMatch[1]
        }
      }

      let img = null
      // Check for raw PNG clipboard format first (preserves alpha and lossless fidelity from Paint.net, browsers, etc.)
      try {
        const pngBuf = clipboard.readBuffer('PNG')
        if (pngBuf && pngBuf.length > 0) {
          const nativeFromPng = nativeImage.createFromBuffer(pngBuf)
          if (nativeFromPng && !nativeFromPng.isEmpty()) {
            img = nativeFromPng
          }
        }
      } catch {
        // fallback
      }

      if (!img) {
        img = clipboard.readImage()
      }

      if (!img || img.isEmpty()) {
        if (imageKey) {
          return { imageKey, imageUrl }
        }
        return null
      }

      if (imageKey) {
        return {
          imageKey,
          imageUrl,
        }
      }

      return {
        imageKey: null,
        buffer: img.toPNG(),
        dataUrl: img.toDataURL(),
      }
    } catch (err) {
      console.warn('Error reading image from clipboard:', err)
      return null
    }
  })
  ipcMain.handle('has-image-in-clipboard', () => {
    try {
      const html = clipboard.readHTML()
      if (html && html.includes('pulse-panel-image-key')) {
        return true
      }
      try {
        const pngBuf = clipboard.readBuffer('PNG')
        if (pngBuf && pngBuf.length > 0) return true
      } catch {
        // ignore
      }
      const img = clipboard.readImage()
      return !img.isEmpty()
    } catch {
      return false
    }
  })
  createWindow()
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

function createWindow() {
  // Create the browser window.
  const startHidden = process.argv.includes('--hidden')
  if (startHidden) {
    enableTray = true
    ignoreFirstTrayToggle = true
  }
  const size = settings.readDBSetting('windowSize') ?? [1100, 900]
  const iconPath = join(__dirname, '../../assets/pulse-panel_icon.ico')
  mainWindow = new BrowserWindow({
    frame: false,
    width: size[0],
    height: size[1],
    minWidth: 576,
    minHeight: 341,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: true,
      backgroundThrottling: false,
    },
    icon: iconPath,
  })

  // Elevate process priority on Windows so real-time audio is not starved when games or heavy tasks max out the CPU
  try {
    if (process.platform === 'win32') {
      os.setPriority(process.pid, os.constants.priority.PRIORITY_ABOVE_NORMAL)
    }
  } catch (err) {
    console.warn('[main] Could not set main process priority:', err)
  }

  mainWindow.webContents.on('did-finish-load', () => {
    try {
      if (process.platform === 'win32') {
        const rendererPid = mainWindow?.webContents?.getOSProcessId()
        if (rendererPid) {
          os.setPriority(rendererPid, os.constants.priority.PRIORITY_ABOVE_NORMAL)
        }
      }
    } catch (err) {
      console.warn('[main] Could not set renderer process priority:', err)
    }
  })
  if (startHidden) {
    createTray()
    mainWindow.hide()
    closedToTray = true
  }
  mainWindow.on('resized', resizeTriggered)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // and load the index.html of the app.
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000') // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../../../dist/index.html'))
  }
}

function createTray() {
  mainWindow.on('close', function (event) {
    if (app.isQuitting) {
      return
    }
    event.preventDefault()
    // Hide the window instead
    mainWindow.hide()
    closedToTray = true
    updateTrayMenu()
  })
  mainWindow.on('minimize', function () {
    updateTrayMenu()
  })
  mainWindow.on('restore', function () {
    closedToTray = false
    updateTrayMenu()
  })

  // Use .ico for Windows, .png/.icns for Mac/Linux
  const iconPath = join(__dirname, '../../assets/pulse-panel_icon.ico')
  tray = new Tray(iconPath)

  tray.setToolTip('Pulse Panel')

  // Create a context menu so the user can actually quit the app
  updateTrayMenu()

  // Restore application when clicking the tray icon
  tray.on('click', () => {
    mainWindow.show()
    closedToTray = false
    updateTrayMenu()
  })
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    closedToTray
      ? {
        label: 'Restore App',
        click: function () {
          mainWindow.show()
          closedToTray = false
          updateTrayMenu()
        },
      }
      : {
        label: 'Minimize App',
        click: function () {
          mainWindow.hide()
          closedToTray = true
          updateTrayMenu()
        },
      },
    {
      label: 'Quit',
      click: function () {
        // We need a flag to let the app know it's okay to actually quit now
        // (Only relevant if you are catching the 'close' event too)
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
}

function resizeTriggered() {
  const isMaximized = mainWindow.isMaximized()
  const isFullScreen = mainWindow.isFullScreen()
  const [width, height] = mainWindow.getSize()
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('main-window-resized', isMaximized || isFullScreen, width, height)
  })
}

// // This method will be called when Electron has finished
// // initialization and is ready to create browser windows.
// // Some APIs can only be used after this event occurs.
// app.whenReady().then(() => {
//   createWindow()
//   app.on('activate', function () {
//     // On macOS it's common to re-create a window in the app when the
//     // dock icon is clicked and there are no other windows open.
//     if (BrowserWindow.getAllWindows().length === 0) createWindow()
//   })
// })

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
