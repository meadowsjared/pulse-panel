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
 * Returns the centralized media directory: %APPDATA%/pulse-panel/media
 * Shared across both production and development environments.
 * @returns {string}
 */
function getMediaDirectory() {
  const userHome = settings.getUserHome()
  const mediaDir = join(userHome, 'pulse-panel', 'media')
  settings.ensureDirectoryExistence(mediaDir)
  return mediaDir
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
  const mediaDir = getMediaDirectory()
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const contentHash = computeBufferHash(buf)

  let ext = (extension || '').toLowerCase().trim()
  if (ext && !ext.startsWith('.')) ext = `.${ext}`
  if (!ext) ext = '.mp3'

  const baseName = sanitizeBaseName(preferredName)
  let candidateName = `${baseName}${ext}`
  let candidatePath = join(mediaDir, candidateName)

  // 1. If candidate does not exist, save directly!
  if (!fs.existsSync(candidatePath)) {
    await fs.promises.writeFile(candidatePath, buf)
    return {
      fileName: candidateName,
      filePath: candidatePath,
      relativeUrl: `pulse-media://media/${encodeURIComponent(candidateName)}`,
    }
  }

  // 2. Candidate exists. Check if content hash matches (exact duplicate content)
  try {
    const existingContent = await fs.promises.readFile(candidatePath)
    if (computeBufferHash(existingContent) === contentHash) {
      return {
        fileName: candidateName,
        filePath: candidatePath,
        relativeUrl: `pulse-media://media/${encodeURIComponent(candidateName)}`,
      }
    }
  } catch (err) {
    // continue to collision check on read error
  }

  // 3. Collision with different content: append _1, _2, etc.
  let index = 1
  while (true) {
    candidateName = `${baseName}_${index}${ext}`
    candidatePath = join(mediaDir, candidateName)

    if (!fs.existsSync(candidatePath)) {
      await fs.promises.writeFile(candidatePath, buf)
      return {
        fileName: candidateName,
        filePath: candidatePath,
        relativeUrl: `pulse-media://media/${encodeURIComponent(candidateName)}`,
      }
    }

    try {
      const existingContent = await fs.promises.readFile(candidatePath)
      if (computeBufferHash(existingContent) === contentHash) {
        return {
          fileName: candidateName,
          filePath: candidatePath,
          relativeUrl: `pulse-media://media/${encodeURIComponent(candidateName)}`,
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
  const mediaDir = getMediaDirectory()
  const filePath = join(mediaDir, fileName)
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
  const mediaDir = getMediaDirectory()
  const filePath = join(mediaDir, fileName)
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
  const mediaDir = getMediaDirectory()
  return fs.existsSync(join(mediaDir, fileName))
}

module.exports = {
  getMediaDirectory,
  sanitizeBaseName,
  computeBufferHash,
  saveMediaFile,
  readMediaFile,
  deleteMediaFile,
  mediaFileExists,
}
