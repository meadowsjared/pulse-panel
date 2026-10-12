const { join, normalize } = require('path')
const fs = require('fs')
const os = require('os')
const {
  app, BrowserWindow, ipcMain, shell, Tray, Menu, dialog, clipboard, ClipboardItem, nativeImage, protocol, session,
} = require('electron')
const settings = require('../settings')
const updater = require('./updater')
const ytdlp = require('./ytdlp')
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
    } catch (_) { }
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
        } catch (_) { }
      })

      nodeStream.on('error', err => {
        if (isClosed) return
        isClosed = true
        try {
          controller.error(err)
        } catch (_) { }
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
        } catch (_) { }

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
    if (isDev) {
      settings.saveDBSetting('startWithWindows', !!openAtLogin)
      return
    }
    const args = []
    if (!app.isPackaged) {
      args.push(app.getAppPath())
    }
    if (openAtLogin) {
      args.push('--minimized')
    }
    app.setLoginItemSettings({
      openAtLogin: !!openAtLogin,
      path: process.execPath,
      args,
    })
  })
  ipcMain.handle('get-open-at-login', () => {
    if (isDev) {
      return !!settings.readDBSetting('startWithWindows')
    }
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
  ipcMain.handle('show-item-in-folder', (_, fullPath) => {
    if (fullPath) {
      try {
        const normalized = normalize(fullPath)
        shell.showItemInFolder(normalized)
        return true
      } catch (err) {
        console.error('Failed to show item in folder:', err)
        return false
      }
    }
    return false
  })
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
    return result.filePath
  })
  ipcMain.handle('download-and-install-update', async (_, downloadUrl) => {
    return updater.downloadAndInstallUpdate(downloadUrl, progress => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progress)
      }
    })
  })
  ipcMain.handle('write-image-to-clipboard', async (_, { buffer, dataUrl, imageKey, imageUrl }) => {
    try {
      let pngBuffer = null
      if (buffer) {
        pngBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
      } else if (dataUrl) {
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
        pngBuffer = Buffer.from(base64, 'base64')
      }

      const htmlContent =
        `<meta name="pulse-panel-image-key" content="${imageKey || ''}">` +
        `<meta name="pulse-panel-image-url" content="${imageUrl || ''}">`

      // Modern Electron (44+) ClipboardItem API
      if (typeof ClipboardItem !== 'undefined' && typeof clipboard.write === 'function') {
        const itemFormats = {
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
        }
        if (pngBuffer && pngBuffer.length > 0) {
          itemFormats['image/png'] = new Blob([pngBuffer], { type: 'image/png' })
        }
        await clipboard.write([new ClipboardItem(itemFormats)])
        return true
      }

      // Legacy Electron fallback
      let img = null
      if (dataUrl) {
        img = nativeImage.createFromDataURL(dataUrl)
      }
      if ((!img || img.isEmpty()) && pngBuffer) {
        img = nativeImage.createFromBuffer(pngBuffer)
      }
      if (!img || img.isEmpty()) {
        console.warn('[Pulse Panel] nativeImage could not be created from provided data')
        return false
      }
      clipboard.write({
        image: img,
        html: htmlContent,
      })
      return true
    } catch (err) {
      console.warn('Error writing image to clipboard:', err)
      return false
    }
  })
  ipcMain.handle('read-image-from-clipboard', async () => {
    try {
      // Modern Electron (44+) ClipboardItem API
      if (typeof clipboard.read === 'function') {
        const items = await clipboard.read()
        let html = ''
        let imageBlob = null
        for (const item of items) {
          if (!html && item.types && item.types.includes('text/html')) {
            const b = await item.getType('text/html')
            html = await b.text()
          }
          if (!imageBlob && item.types) {
            for (const t of item.types) {
              if (t.startsWith('image/')) {
                imageBlob = await item.getType(t)
                break
              }
            }
          }
        }

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

        if (imageKey) {
          return { imageKey, imageUrl }
        }

        if (imageBlob) {
          const arrayBuf = await imageBlob.arrayBuffer()
          const buf = Buffer.from(arrayBuf)
          return {
            imageKey: null,
            buffer: buf,
            dataUrl: `data:${imageBlob.type || 'image/png'};base64,${buf.toString('base64')}`,
          }
        }

        return null
      }

      // Legacy Electron fallback
      const html = clipboard.readHTML ? clipboard.readHTML() : null
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
        if (clipboard.readBuffer) {
          const pngBuf = clipboard.readBuffer('PNG')
          if (pngBuf && pngBuf.length > 0) {
            const nativeFromPng = nativeImage.createFromBuffer(pngBuf)
            if (nativeFromPng && !nativeFromPng.isEmpty()) {
              img = nativeFromPng
            }
          }
        }
      } catch {
        // fallback
      }

      if (!img && clipboard.readImage) {
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
  ipcMain.handle('has-image-in-clipboard', async () => {
    try {
      // Modern Electron (44+) ClipboardItem API
      if (typeof clipboard.read === 'function') {
        const items = await clipboard.read()
        for (const item of items) {
          if (item.types && item.types.includes('text/html')) {
            const b = await item.getType('text/html')
            const text = await b.text()
            if (text && text.includes('pulse-panel-image-key')) {
              return true
            }
          }
          if (item.types) {
            for (const t of item.types) {
              if (t.startsWith('image/')) return true
            }
          }
        }
        return false
      }

      // Legacy Electron fallback
      const html = clipboard.readHTML ? clipboard.readHTML() : null
      if (html && html.includes('pulse-panel-image-key')) {
        return true
      }
      try {
        if (clipboard.readBuffer) {
          const pngBuf = clipboard.readBuffer('PNG')
          if (pngBuf && pngBuf.length > 0) return true
        }
      } catch {
        // ignore
      }
      if (clipboard.readImage) {
        const img = clipboard.readImage()
        return !img.isEmpty()
      }
      return false
    } catch {
      return false
    }
  })

  // yt-dlp / YouTube integration
  ipcMain.handle('yt-check-status', () => {
    return ytdlp.checkYtDlpStatus(settings.getConfigDirectoryAndAppName().configDirectory)
  })
  ipcMain.handle('yt-fetch-info', (_, url) => ytdlp.fetchVideoQuickInfo(url))
  ipcMain.handle('yt-download-clip', async (_, options) => {
    return ytdlp.downloadAudioClip(
      settings.getConfigDirectoryAndAppName().configDirectory,
      options,
      progress => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('yt-download-progress', progress)
        }
      }
    )
  })
  ipcMain.handle('yt-fetch-image', (_, url) => ytdlp.fetchImageBuffer(url))

  app.on('web-contents-created', (_, contents) => {
    if (contents.getType() === 'webview') {
      contents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown') {
          const isCtrlOrMeta = !!(input.control || input.meta)
          const isF = (input.key && input.key.toLowerCase() === 'f') || input.code === 'KeyF'
          const isR = (input.key && input.key.toLowerCase() === 'r') || input.code === 'KeyR'
          const isF5 = (input.key && input.key.toLowerCase() === 'f5') || input.code === 'F5'
          if (isCtrlOrMeta && isF) {
            event.preventDefault()
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('trigger-find-in-page')
            }
          } else if (input.key === 'Escape' || input.code === 'Escape') {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-escape-pressed')
            }
          } else if ((isCtrlOrMeta && isR) || isF5) {
            event.preventDefault()
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-reload-pressed')
            }
          }
        }
      })

      contents.on('will-navigate', (event, navUrl) => {
        if (ytdlp.isDirectMediaUrl(navUrl)) {
          event.preventDefault()
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-direct-audio-clicked', {
              url: navUrl,
            })
          }
        }
      })

      contents.setWindowOpenHandler(({ url }) => {
        if (ytdlp.isDirectMediaUrl(url)) {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('webview-direct-audio-clicked', {
              url,
            })
          }
          return { action: 'deny' }
        }
        return { action: 'allow' }
      })
    }
  })

  // Intercept direct media downloads in webview session (e.g. MyInstants, FreeSound)
  const youtubeSession = session.fromPartition('persist:youtube')
  youtubeSession.on('will-download', (event, item) => {
    const url = item.getURL()
    const mime = item.getMimeType() || ''
    if (ytdlp.isDirectMediaUrl(url) || mime.startsWith('audio/')) {
      item.cancel()
      const filename = item.getFilename()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-direct-audio-clicked', {
          url,
          filename,
        })
      }
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
  const startHidden = process.argv.includes('--minimized')
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
      webviewTag: true,
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
