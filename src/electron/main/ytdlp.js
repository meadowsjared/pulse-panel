'use strict'

const fs = require('fs')
const os = require('os')
const { join } = require('path')
const { spawn } = require('child_process')

function getYtDlpExecutablePath(configDirectory) {
  const ext = process.platform === 'win32' ? '.exe' : ''
  const filename = `yt-dlp${ext}`

  // 1. Updated version in user configDirectory/bin (e.g. after a self-update)
  const userConfigPath = join(configDirectory, 'bin', filename)
  if (fs.existsSync(userConfigPath)) {
    return userConfigPath
  }

  // 2. Bundled resource in packaged app (process.resourcesPath/bin/yt-dlp.exe)
  if (process.resourcesPath) {
    const packagedPath = join(process.resourcesPath, 'bin', filename)
    if (fs.existsSync(packagedPath)) {
      return packagedPath
    }
  }

  // 3. Local development repo path (pulse-panel/bin/yt-dlp.exe)
  const devPath = join(__dirname, '../../../bin', filename)
  if (fs.existsSync(devPath)) {
    return devPath
  }

  return userConfigPath
}

/**
 * Checks if yt-dlp is available in the app config directory, bundled resources, or on system PATH
 */
async function checkYtDlpStatus(configDirectory) {
  const localPath = getYtDlpExecutablePath(configDirectory)
  if (fs.existsSync(localPath)) {
    return { installed: true, path: localPath, isLocal: true }
  }

  // Check system PATH
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  return new Promise(resolve => {
    const proc = spawn(cmd, ['yt-dlp'], { windowsHide: true })
    let output = ''
    proc.stdout.on('data', d => {
      output += d.toString()
    })
    proc.on('close', code => {
      if (code === 0 && output.trim()) {
        const firstLine = output.trim().split(/\r?\n/)[0]
        resolve({ installed: true, path: firstLine, isLocal: false })
      } else {
        resolve({ installed: false, path: null, isLocal: false })
      }
    })
    proc.on('error', () => {
      resolve({ installed: false, path: null, isLocal: false })
    })
  })
}

function isDirectMediaUrl(url) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    const pathname = parsed.pathname.toLowerCase()
    return /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|weba|wma|aiff|aif|mp4)$/i.test(pathname)
  } catch {
    return false
  }
}

function getExtensionFromUrl(url) {
  try {
    const parsed = new URL(url)
    const ext = parsed.pathname.split('.').pop()
    return ext ? ext.toLowerCase() : 'mp3'
  } catch {
    return 'mp3'
  }
}

/**
 * Fast metadata fetch using YouTube oEmbed and URL parsing
 */
async function fetchVideoQuickInfo(videoUrl) {
  try {
    let videoId = null
    const urlObj = new URL(videoUrl)
    const isShort = urlObj.pathname.includes('/shorts/')
    if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1).split('?')[0]
    } else if (urlObj.searchParams.has('v')) {
      videoId = urlObj.searchParams.get('v')
    } else if (isShort) {
      videoId = urlObj.pathname.split('/shorts/')[1].split('/')[0].split('?')[0]
    } else if (isDirectMediaUrl(videoUrl)) {
      const filename = urlObj.pathname.split('/').filter(Boolean).pop() || ''
      const nameWithoutExt = filename.replace(/\.[a-zA-Z0-9]+$/, '')
      const title = decodeURIComponent(nameWithoutExt).replace(/[-_]+/g, ' ').trim() || decodeURIComponent(filename)
      return {
        success: true,
        videoId: videoUrl,
        title,
        author: urlObj.hostname,
        thumbnailUrl: '',
        isShort: false,
      }
    }

    // Try oEmbed for clean title and author
    let title = ''
    let author = ''
    let thumbnailUrl = ''
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) })
      if (res.ok) {
        const data = await res.json()
        title = data.title || ''
        author = data.author_name || ''
        thumbnailUrl = data.thumbnail_url || ''
      }
    } catch (_) {}

    if (videoId) {
      // For standard 16:9 videos, check if maxresdefault exists (1280x720, crystal clear without letterboxing)
      if (!isShort) {
        try {
          const maxresUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
          const headRes = await fetch(maxresUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) })
          if (headRes.ok) {
            thumbnailUrl = maxresUrl
          }
        } catch (_) {}
      }

      if (!thumbnailUrl || thumbnailUrl.includes('hqdefault')) {
        thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }
    }

    return {
      success: true,
      videoId,
      title,
      author,
      thumbnailUrl,
      isShort,
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
    }
  }
}

/**
 * Downloads audio clip using yt-dlp
 * @param {string} configDirectory
 * @param {{ url: string, startTime?: number, endTime?: number }} options
 * @param {(progress: { percent: number, text: string }) => void} [onProgress]
 */
let activeDownloadProc = null

async function downloadAudioClip(configDirectory, options, onProgress) {
  const hasSection =
    typeof options.startTime === 'number' && typeof options.endTime === 'number' && options.endTime > options.startTime

  // Fast path for direct audio files if full download without section trimming
  if (isDirectMediaUrl(options.url) && !hasSection) {
    try {
      if (onProgress) {
        onProgress({ percent: 15, text: 'Downloading audio file...' })
      }
      const res = await fetch(options.url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const arrayBuf = await res.arrayBuffer()
      const ext = getExtensionFromUrl(options.url)
      if (onProgress) {
        onProgress({ percent: 100, text: 'Download complete' })
      }
      return {
        success: true,
        buffer: Buffer.from(arrayBuf),
        extension: ext,
        mimeType:
          ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mp4',
      }
    } catch (directErr) {
      console.warn('Direct fetch failed, falling back to yt-dlp:', directErr.message)
    }
  }

  const status = await checkYtDlpStatus(configDirectory)
  const ytDlpPath = status.path
  if (!status.installed || !ytDlpPath) {
    throw new Error('yt-dlp executable was not found. Please ensure it is bundled or installed.')
  }

  // Cancel any running download process so newer preloads take priority
  if (activeDownloadProc) {
    try {
      activeDownloadProc.kill()
    } catch (_) {}
    activeDownloadProc = null
  }

  const tempId = `pulse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const outputTemplate = join(os.tmpdir(), `${tempId}.%(ext)s`)

  const args = ['--no-playlist', '--no-warnings', '-f', 'ba[ext=m4a]/ba[ext=mp3]/ba', '-o', outputTemplate]

  if (hasSection) {
    args.push('--download-sections', `*${options.startTime}-${options.endTime}`)
    // If ffmpeg is missing, yt-dlp might fail section download. We attempt section first, then fallback.
    args.push('--force-keyframes-at-cuts')
  }

  args.push(options.url)

  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath, args, { windowsHide: true })
    activeDownloadProc = proc
    let stderr = ''
    let stdout = ''

    proc.stdout.on('data', data => {
      const text = data.toString()
      stdout += text
      const match = text.match(/(\d+(?:\.\d+)?)%/)
      if (match && onProgress) {
        const percentVal = parseFloat(match[1])
        onProgress({
          percent: Math.min(99, Math.round(percentVal)),
          text: `Downloading audio: ${percentVal.toFixed(0)}%`,
        })
      }
    })

    proc.stderr.on('data', data => {
      stderr += data.toString()
    })

    proc.on('close', async code => {
      if (activeDownloadProc === proc) {
        activeDownloadProc = null
      }

      if (code !== 0) {
        // If section download failed because ffmpeg is missing, retry downloading the full audio
        if (hasSection && (stderr.includes('ffmpeg') || stdout.includes('ffmpeg'))) {
          try {
            const fallbackOptions = { ...options, startTime: undefined, endTime: undefined }
            const result = await downloadAudioClip(configDirectory, fallbackOptions, onProgress)
            return resolve(result)
          } catch (retryErr) {
            return reject(new Error(`yt-dlp failed: ${stderr || stdout || retryErr.message}`))
          }
        }
        return reject(new Error(`yt-dlp exited with code ${code}: ${stderr || stdout}`))
      }

      // Locate the generated file
      try {
        const tmpFiles = fs.readdirSync(os.tmpdir())
        const matchedFile = tmpFiles.find(f => f.startsWith(tempId))
        if (!matchedFile) {
          return reject(new Error('Audio file was not found after download'))
        }

        const fullPath = join(os.tmpdir(), matchedFile)
        const audioBuffer = fs.readFileSync(fullPath)
        const ext = matchedFile.split('.').pop() || 'm4a'

        // Clean up temp file
        try {
          fs.unlinkSync(fullPath)
        } catch (_) {}

        resolve({
          success: true,
          buffer: audioBuffer,
          extension: ext,
          mimeType: ext === 'mp3' ? 'audio/mpeg' : ext === 'webm' ? 'audio/webm' : 'audio/mp4',
        })
      } catch (err) {
        reject(err)
      }
    })

    proc.on('error', err => {
      reject(err)
    })
  })
}

/**
 * Fetches an image buffer from a URL
 */
async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const arrayBuf = await res.arrayBuffer()
    return Buffer.from(arrayBuf)
  } catch {
    return null
  }
}

module.exports = {
  checkYtDlpStatus,
  fetchVideoQuickInfo,
  downloadAudioClip,
  fetchImageBuffer,
  isDirectMediaUrl,
}
