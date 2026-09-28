'use strict'

const fs = require('fs')
const { join } = require('path')
const crypto = require('crypto')
const settings = require('../settings')

/**
 * Sanitizes a string to be a safe Windows filename without extension.
 * @param {string} name
 * @returns {string}
 */
function sanitizeBaseName(name) {
  if (!name || typeof name !== 'string') return 'sound'
  // Strip existing file extension if included
  let clean = name.replace(/\.[a-zA-Z0-9]{2,5}$/, '')
  // Replace illegal Windows filename characters \ / : * ? " < > | with _
  clean = clean.replace(/[/\\?%*:|"<>]/g, '_')
  // Collapse whitespace and trim
  clean = clean.trim().replace(/\s+/g, ' ')
  // Windows filenames cannot end in a dot or space
  clean = clean.replace(/[. ]+$/, '')
  // Reserved device names in Windows
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  if (reserved.test(clean)) clean = `${clean}_file`
  return clean || 'sound'
}

/**
 * Returns the centralized media root directory: %APPDATA%/pulse-panel/media
 * Shared across both production and development environments.
 * @returns {string}
 */
function getMediaDirectory() {
  const userHome = settings.getUserHome()
  const mediaDir = join(userHome, 'pulse-panel', 'media')
  settings.ensureDirectoryExistence(mediaDir)
  return mediaDir
}

let hasCheckedLooseMedia = false
/**
 * Migrates loose files directly under %APPDATA%/pulse-panel/media into %APPDATA%/pulse-panel/media/soundboard
 * @param {string} mediaDir
 * @param {string} soundboardDir
 */
function migrateLooseMediaToSoundboard(mediaDir, soundboardDir) {
  if (hasCheckedLooseMedia) return
  hasCheckedLooseMedia = true
  try {
    const entries = fs.readdirSync(mediaDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        const src = join(mediaDir, entry.name)
        const dest = join(soundboardDir, entry.name)
        if (!fs.existsSync(dest)) {
          fs.renameSync(src, dest)
        } else {
          try { fs.unlinkSync(src) } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn('[mediaManager] Error migrating loose media to soundboard:', err)
  }
}

/**
 * Returns the soundboard media directory: %APPDATA%/pulse-panel/media/soundboard
 * Automatically migrates existing media files from media/ to media/soundboard/ on first access.
 * @returns {string}
 */
function getSoundboardDirectory() {
  const mediaDir = getMediaDirectory()
  const soundboardDir = join(mediaDir, 'soundboard')
  settings.ensureDirectoryExistence(soundboardDir)
  migrateLooseMediaToSoundboard(mediaDir, soundboardDir)
  return soundboardDir
}

/**
 * Returns the clips directory: %APPDATA%/pulse-panel/media/clips
 * @returns {string}
 */
function getClipsDirectory() {
  const mediaDir = getMediaDirectory()
  const clipsDir = join(mediaDir, 'clips')
  settings.ensureDirectoryExistence(clipsDir)
  // Check if legacy %APPDATA%/pulse-panel/clips exists and migrate any files
  try {
    const legacyClipsDir = join(settings.getUserHome(), 'pulse-panel', 'clips')
    if (fs.existsSync(legacyClipsDir) && legacyClipsDir !== clipsDir) {
      const entries = fs.readdirSync(legacyClipsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          const src = join(legacyClipsDir, entry.name)
          const dest = join(clipsDir, entry.name)
          if (!fs.existsSync(dest)) {
            fs.renameSync(src, dest)
          }
        }
      }
    }
  } catch (_) {}
  return clipsDir
}

/**
 * Computes SHA-256 hash of a buffer
 * @param {Buffer} buffer
 * @returns {string}
 */
function computeBufferHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Saves a media file with friendly naming and smart collision detection.
 * If file with same content exists, reuses it.
 * If duplicate name with different content, appends _1, _2, etc.
 *
 * @param {Object} options
 * @param {string} options.preferredName - e.g. "seinfeld theme" or original filename
 * @param {string} [options.extension] - e.g. ".mp3", ".png"
 * @param {Buffer|ArrayBuffer} options.buffer - file binary content
 * @returns {Promise<{ fileName: string, filePath: string, relativeUrl: string }>}
 */
async function saveMediaFile({ preferredName, extension, buffer }) {
  const soundboardDir = getSoundboardDirectory()
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const contentHash = computeBufferHash(buf)

  let ext = (extension || '').toLowerCase().trim()
  if (ext && !ext.startsWith('.')) ext = `.${ext}`
  if (!ext) ext = '.mp3'
  // Auto-detect SVG content even if caller defaulted extension to .png
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const head = buf.slice(0, 100).toString('utf8').trim()
    if (head.startsWith('<svg') || head.startsWith('<?xml')) {
      ext = '.svg'
    }
  }

  const baseName = sanitizeBaseName(preferredName)
  let candidateName = `${baseName}${ext}`
  let candidatePath = join(soundboardDir, candidateName)

  // 1. If candidate does not exist, save directly!
  if (!fs.existsSync(candidatePath)) {
    await fs.promises.writeFile(candidatePath, buf)
    return {
      fileName: candidateName,
      filePath: candidatePath,
      relativeUrl: `pulse-media://soundboard/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
    }
  }

  // 2. Candidate exists. Check if content hash matches (exact duplicate content)
  try {
    const existingContent = await fs.promises.readFile(candidatePath)
    if (computeBufferHash(existingContent) === contentHash) {
      return {
        fileName: candidateName,
        filePath: candidatePath,
        relativeUrl: `pulse-media://soundboard/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
      }
    }
  } catch (err) {
    // continue to collision check on read error
  }

  // 3. Collision with different content: append _1, _2, etc.
  let index = 1
  while (true) {
    candidateName = `${baseName}_${index}${ext}`
    candidatePath = join(soundboardDir, candidateName)

    if (!fs.existsSync(candidatePath)) {
      await fs.promises.writeFile(candidatePath, buf)
      return {
        fileName: candidateName,
        filePath: candidatePath,
        relativeUrl: `pulse-media://soundboard/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
      }
    }

    try {
      const existingContent = await fs.promises.readFile(candidatePath)
      if (computeBufferHash(existingContent) === contentHash) {
        return {
          fileName: candidateName,
          filePath: candidatePath,
          relativeUrl: `pulse-media://soundboard/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
        }
      }
    } catch {
      // ignore
    }

    index++
  }
}

/**
 * Reads a media file from disk by fileName
 * @param {string} fileName
 * @returns {Promise<Buffer|null>}
 */
async function readMediaFile(fileName) {
  if (!fileName) return null
  const soundboardDir = getSoundboardDirectory()
  let filePath = join(soundboardDir, fileName)
  if (!fs.existsSync(filePath)) {
    filePath = join(getMediaDirectory(), fileName)
  }
  if (!fs.existsSync(filePath)) return null
  try {
    return await fs.promises.readFile(filePath)
  } catch (err) {
    console.warn(`[mediaManager] Failed to read ${fileName}:`, err)
    return null
  }
}

/**
 * Deletes a media file from disk
 * @param {string} fileName
 * @returns {Promise<boolean>}
 */
async function deleteMediaFile(fileName) {
  if (!fileName) return false
  const soundboardDir = getSoundboardDirectory()
  let filePath = join(soundboardDir, fileName)
  if (!fs.existsSync(filePath)) {
    filePath = join(getMediaDirectory(), fileName)
  }
  if (!fs.existsSync(filePath)) return false
  try {
    await fs.promises.unlink(filePath)
    return true
  } catch (err) {
    console.warn(`[mediaManager] Failed to delete ${fileName}:`, err)
    return false
  }
}

/**
 * Checks if a media file exists
 * @param {string} fileName
 * @returns {boolean}
 */
function mediaFileExists(fileName) {
  if (!fileName) return false
  const soundboardDir = getSoundboardDirectory()
  if (fs.existsSync(join(soundboardDir, fileName))) return true
  return fs.existsSync(join(getMediaDirectory(), fileName))
}

/**
 * Saves a clip file to %APPDATA%/pulse-panel/media/clips/
 * @param {Object} options
 * @param {string} options.preferredName - e.g. "Clip -30s" or clip title
 * @param {string} [options.extension] - default ".wav"
 * @param {Buffer|ArrayBuffer} options.buffer
 * @returns {Promise<{ fileName: string, filePath: string, relativeUrl: string }>}
 */
async function saveClipFile({ preferredName, extension, buffer }) {
  const clipsDir = getClipsDirectory()
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)

  let ext = (extension || '').toLowerCase().trim()
  if (ext && !ext.startsWith('.')) ext = `.${ext}`
  if (!ext) ext = '.wav'

  const baseName = sanitizeBaseName(preferredName)
  let candidateName = `${baseName}${ext}`
  let candidatePath = join(clipsDir, candidateName)

  if (!fs.existsSync(candidatePath)) {
    await fs.promises.writeFile(candidatePath, buf)
    return {
      fileName: candidateName,
      filePath: candidatePath,
      relativeUrl: `pulse-media://clips/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
    }
  }

  // If duplicate name with same content, reuse it
  try {
    const existingContent = await fs.promises.readFile(candidatePath)
    if (computeBufferHash(existingContent) === computeBufferHash(buf)) {
      return {
        fileName: candidateName,
        filePath: candidatePath,
        relativeUrl: `pulse-media://clips/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
      }
    }
  } catch {}

  let index = 1
  while (true) {
    candidateName = `${baseName}_${index}${ext}`
    candidatePath = join(clipsDir, candidateName)
    if (!fs.existsSync(candidatePath)) {
      await fs.promises.writeFile(candidatePath, buf)
      return {
        fileName: candidateName,
        filePath: candidatePath,
        relativeUrl: `pulse-media://clips/${encodeURIComponent(candidateName).replace(/'/g, '%27')}`,
      }
    }
    index++
  }
}

/**
 * Reads a clip file from disk
 * @param {string} fileName
 * @returns {Promise<Buffer|null>}
 */
async function readClipFile(fileName) {
  if (!fileName) return null
  const clipsDir = getClipsDirectory()
  const filePath = join(clipsDir, fileName)
  if (!fs.existsSync(filePath)) return null
  try {
    return await fs.promises.readFile(filePath)
  } catch (err) {
    console.warn(`[mediaManager] Failed to read clip ${fileName}:`, err)
    return null
  }
}

/**
 * Deletes a clip file from disk
 * @param {string} fileName
 * @returns {Promise<boolean>}
 */
async function deleteClipFile(fileName) {
  if (!fileName) return false
  const clipsDir = getClipsDirectory()
  const filePath = join(clipsDir, fileName)
  if (!fs.existsSync(filePath)) return false
  try {
    await fs.promises.unlink(filePath)
    return true
  } catch (err) {
    console.warn(`[mediaManager] Failed to delete clip ${fileName}:`, err)
    return false
  }
}

/**
 * Checks if a clip file exists
 * @param {string} fileName
 * @returns {boolean}
 */
function clipFileExists(fileName) {
  if (!fileName) return false
  const clipsDir = getClipsDirectory()
  return fs.existsSync(join(clipsDir, fileName))
}

module.exports = {
  getMediaDirectory,
  getSoundboardDirectory,
  getClipsDirectory,
  sanitizeBaseName,
  computeBufferHash,
  saveMediaFile,
  readMediaFile,
  deleteMediaFile,
  mediaFileExists,
  saveClipFile,
  readClipFile,
  deleteClipFile,
  clipFileExists,
}

