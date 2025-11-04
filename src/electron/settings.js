'use strict'

const fs = require('fs')
const { join } = require('path')
const nconf = require('nconf').file({
  file: getConfigurationFilePath(),
})
const robot = require('@meadowsjared/robotjs')
const { BrowserWindow, net } = require('electron')
const { qKeys, qHotkeys } = require('qhotkeys')
const extractZip = require('extract-zip')
const regedit = require('regedit')
const globalHotkeys = new qHotkeys()
const sudo = require('@slosk/sudo-prompt')
const Database = require('better-sqlite3')
const db = new Database(getDatabaseFilePath())
let globalHotkeysRunning = false

initializeDatabase()

function _readSetting(settingKey) {
  nconf.load()
  const value = nconf.get(settingKey)
  try {
    return JSON.parse(value)
  } catch (e) {
    return value
  }
}

function initializeDatabase() {
  // Create settings table (for non-sound settings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSON
    )
  `)

  // Create sounds table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sounds (
      id TEXT PRIMARY KEY,
      title TEXT,
      hideTitle JSON DEFAULT false,
      tags JSON,
      hotkey JSON,  
      audioKey TEXT,
      imageKey TEXT,
      volume REAL,
      color TEXT,
      soundSegments JSON,
      isVisible JSON DEFAULT false,
      order_index INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sounds_order ON sounds(order_index);
  `)
}

/**
 * @param {string} settingName the key of the setting to set
 * @param {string | number | boolean | object} settingValue the value to set the field to
 */
function saveDBSetting(settingName, settingValue) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, json(?))')
  stmt.run(settingName, JSON.stringify(settingValue))
}

/**
 * @param {string} settingName the key of the setting to get
 * @returns {string | null} the value of the setting, or null if not found
 */
function readDBSetting(settingName) {
  const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
  const row = stmt.get(settingName)
  if (!row) return null

  try {
    return JSON.parse(row.value)
  } catch (e) {
    console.error(`Error parsing JSON for setting ${settingName}:`, e)
    return row.value // Return as-is if not valid JSON
  }
}

/**
 * read all settings from the database
 * @returns { Object } an object with all settings key/value pairs
 */
function readAllDBSettings() {
  const stmt = db.prepare('SELECT key, value FROM settings')
  const rows = stmt.all()
  return rows.reduce((acc, row) => {
    acc[row.key] = JSON.parse(row.value)
    return acc
  }, {})
}

/**
 * @param {string} settingName the key of the setting to delete
 */
function deleteDBSetting(settingName) {
  const stmt = db.prepare('DELETE FROM settings WHERE key = ?')
  stmt.run(settingName)
}

/**
 * Get all sounds from the database
 * @returns {Sound[]} Array of sound objects
 */
function readAllDBSounds() {
  const stmt = db.prepare('SELECT * FROM sounds ORDER BY order_index ASC')
  const rows = stmt.all()

  return rows.map(({ order_index, ...row }) => {
    const sound = { id: row.id }

    // Only add properties if they have meaningful values
    if (row.title) sound.title = row.title
    if (row.hideTitle === 'true') sound.hideTitle = true
    if (row.tags) sound.tags = row.tags
    if (row.hotkey) sound.hotkey = row.hotkey
    if (row.audioKey) sound.audioKey = row.audioKey
    if (row.imageKey) sound.imageKey = row.imageKey
    if (row.volume !== null) sound.volume = row.volume
    if (row.color) sound.color = row.color
    if (row.isVisible === 'true') sound.isVisible = true
    if (row.soundSegments) sound.soundSegments = row.soundSegments

    return sound
  })
}

/**
 * Save multiple sounds in a transaction (for bulk operations)
 * @param {Array} sounds - Array of sound objects
 */
function saveSoundsArray(sounds) {
  const columns = [
    'id',
    'title',
    'hideTitle',
    'tags',
    'hotkey',
    'audioKey',
    'imageKey',
    'volume',
    'color',
    'soundSegments',
    'isVisible',
    'order_index',
  ]
  const placeholders = new Array(columns.length).fill('?').join(', ')

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO sounds (
      ${columns.join(', ')}
    ) VALUES (${placeholders})
  `)

  const transaction = db.transaction(sounds => {
    // use a for loop, to iterate over sounds, but include the index
    for (const [index, sound] of sounds.entries()) {
      stmt.run(
        sound.id,
        sound.title ?? null,
        sound.hideTitle ?? null,
        sound.tags ?? null,
        sound.hotkey ?? null,
        sound.audioKey ?? null,
        sound.imageKey ?? null,
        sound.volume ?? null,
        sound.color ?? null,
        sound.soundSegments ?? null,
        sound.isVisible ?? null,
        index
      )
    }
  })

  transaction(sounds)
}

/**
 * Save an update to a single sound to the database
 * @param {Sound} sound - The sound object to save
 */
function saveSound(sound, order_index = null) {
  const withOrderIndex = order_index !== null
  const columns = [
    'title',
    'hideTitle',
    'tags',
    'hotkey',
    'audioKey',
    'imageKey',
    'volume',
    'color',
    'soundSegments',
    'isVisible',
  ]
  if (withOrderIndex) {
    columns.push('order_index')
  }

  const setClause = columns.map(col => `${col} = ?`).join(', ')
  const stmt = db.prepare(`UPDATE sounds SET ${setClause} WHERE id = ?`)

  const values = [
    sound.title ?? null,
    sound.hideTitle ?? null,
    sound.tags ?? null,
    sound.hotkey ?? null,
    sound.audioKey ?? null,
    sound.imageKey ?? null,
    sound.volume ?? null,
    sound.color ?? null,
    sound.soundSegments ?? null,
    sound.isVisible ?? null,
  ]
  if (withOrderIndex) {
    values.push(order_index)
  }
  stmt.run(...values, sound.id)
}

/**
 * Update a single property of a sound
 * @param {Sound} sound - The sound object to update
 * @param {string} propertyName - The name of the property to update
 */
function saveSoundProperty(sound, propertyName) {
  // Handle special cases for JSON fields
  const stmt = db.prepare(`
    UPDATE sounds 
    SET ${propertyName} = ?
    WHERE id = ?
  `)
  stmt.run(sound[propertyName], sound.id)
}

/**
 * Insert new sounds into the sounds array
 * @param {number} beforeIndex
 * @param  {...any} newSounds
 */
function insertSounds(beforeIndex, ...newSounds) {
  const transaction = db.transaction(() => {
    // Shift existing sounds at and after beforeIndex up by the number of new sounds
    const shiftStmt = db.prepare('UPDATE sounds SET order_index = order_index + ? WHERE order_index >= ?')
    shiftStmt.run(newSounds.length, beforeIndex)
    // Insert new sounds
    const columns = [
      'id',
      'title',
      'hideTitle',
      'tags',
      'hotkey',
      'audioKey',
      'imageKey',
      'volume',
      'color',
      'soundSegments',
      'isVisible',
      'order_index',
    ]
    const placeholders = new Array(columns.length).fill('?').join(', ')
    const insertStmt = db.prepare(`INSERT INTO sounds (${columns.join(', ')}) VALUES (${placeholders})`)
    newSounds.forEach((sound, insertArrayIndex) => {
      insertStmt.run(
        sound.id,
        sound.title ?? null,
        sound.hideTitle ?? null,
        sound.tags ?? null,
        sound.hotkey ?? null,
        sound.audioKey ?? null,
        sound.imageKey ?? null,
        sound.volume ?? null,
        sound.color ?? null,
        sound.soundSegments ?? null,
        sound.isVisible ?? null,
        beforeIndex + insertArrayIndex
      )
    })
  })
  transaction()
}

/**
 * Move a sound from one index to another
 * @param {number} prevIndex - The current index of the sound
 * @param {number} newIndex - The new index to move the sound to
 * note: the last sound is the "new sound" button, so it cannot be moved to that position
 * it can be moved to the position before it
 */
function moveSound(prevIndex, newIndex) {
  if (prevIndex === newIndex) {
    // No move needed, indices are the same
    return
  }
  const transaction = db.transaction(() => {
    const stmt = db.prepare('SELECT order_index FROM sounds ORDER BY order_index DESC LIMIT 1 OFFSET 1')
    const result = stmt.get()
    const secondHighestIndex = result ? result.order_index : -1

    // Get the ID of the sound we're moving
    const getSoundIdStmt = db.prepare('SELECT id FROM sounds WHERE order_index = ?')
    const soundToMove = getSoundIdStmt.get(prevIndex)

    if (
      !soundToMove ||
      secondHighestIndex === -1 ||
      prevIndex < 0 ||
      prevIndex > secondHighestIndex ||
      newIndex < 0 ||
      newIndex > secondHighestIndex
    ) {
      throw new Error('Invalid indices for moving sound')
    }

    if (prevIndex < newIndex) {
      // Moving down: shift sounds between prevIndex and newIndex up by 1
      const shiftStmt = db.prepare(
        'UPDATE sounds SET order_index = order_index - 1 WHERE order_index > ? AND order_index <= ?'
      )
      shiftStmt.run(prevIndex, newIndex)
    } else {
      // Moving up: shift sounds between newIndex and prevIndex down by 1
      const shiftStmt = db.prepare(
        'UPDATE sounds SET order_index = order_index + 1 WHERE order_index >= ? AND order_index < ?'
      )
      shiftStmt.run(newIndex, prevIndex)
    }

    // Now set the sound to its new position
    const updateStmt = db.prepare('UPDATE sounds SET order_index = ? WHERE id = ?')
    updateStmt.run(newIndex, soundToMove.id)
  })

  transaction()
}

/**
 * remove a single property of a sound
 * @param {Sound} sound - The sound object to update
 * @param {string} propertyName - The name of the property to remove
 */
function deleteSoundProperty(sound, propertyName) {
  const stmt = db.prepare(`
    UPDATE sounds 
    SET ${propertyName} = NULL
    WHERE id = ?
  `)
  stmt.run(sound.id)
}

/**
 * Delete a sound from the database
 * it also shifts down the order_index of all sounds with a higher order_index
 * @param {Sound} sound - The sound object to delete
 */
function deleteSound(sound) {
  const transaction = db.transaction(() => {
    // First get the order_index before deletion
    const getIdStmt = db.prepare('SELECT order_index FROM sounds WHERE id = ?')
    const row = getIdStmt.get(sound.id)

    if (!row) {
      // ✅ Check if the row exists, not the index value
      throw new Error(`Sound with id ${sound.id} not found`)
    }

    const deletedOrderIndex = row.order_index

    // Delete the sound
    const deleteStmt = db.prepare('DELETE FROM sounds WHERE id = ?')
    deleteStmt.run(sound.id)

    // Shift all sounds with a higher order_index down by 1
    const shiftStmt = db.prepare('UPDATE sounds SET order_index = order_index - 1 WHERE order_index > ?')
    shiftStmt.run(deletedOrderIndex)
  })

  transaction()
}

/**
 * Reorder given sound to position {newIndex}
 * @param {Sound} sound - The sound object to reorder
 * @param {number} newIndex - The new position index
 */
function reorderSound(sound, newIndex) {
  // First, get the current position of the sound
  const getCurrentPositionStmt = db.prepare('SELECT order_index FROM sounds WHERE id = ?')
  const currentRow = getCurrentPositionStmt.get(sound.id)

  if (!currentRow) {
    throw new Error(`Sound with id ${sound.id} not found`)
  }

  const currentIndex = currentRow.order_index
  if (newIndex === currentIndex) return

  // If it's already in the right position, do nothing
  if (currentIndex === newIndex) {
    return
  }

  const transaction = db.transaction(() => {
    if (currentIndex < newIndex) {
      // Moving down: shift sounds between current and new position up by 1
      const shiftStmt = db.prepare(`
        UPDATE sounds
        SET order_index = order_index - 1
        WHERE order_index > ? AND order_index <= ? AND id != ?
      `)
      shiftStmt.run(currentIndex, newIndex, sound.id)
    } else {
      // Moving up: shift sounds between new and current position down by 1
      const shiftStmt = db.prepare(`
        UPDATE sounds
        SET order_index = order_index + 1
        WHERE order_index >= ? AND order_index < ? AND id != ?
      `)
      shiftStmt.run(newIndex, currentIndex, sound.id)
    }

    // Now set the sound to its new position
    const updateStmt = db.prepare(`
      UPDATE sounds
      SET order_index = ?
      WHERE id = ?
    `)
    updateStmt.run(newIndex, sound.id)
  })

  transaction()
}

/**
 * Update the visibility of multiple sounds
 * @param {{ isVisible: boolean; soundId: string }[]} visibilityChanges
 */
function saveVisibility(visibilityChanges) {
  const stmt = db.prepare(`
    UPDATE sounds
    SET isVisible = json(?)
    WHERE id = ?
  `)

  const transaction = db.transaction(changes => {
    changes.forEach(({ isVisible, soundId }) => {
      stmt.run(JSON.stringify(isVisible), soundId)
    })
  })

  transaction(visibilityChanges)
}

/**
 * convert a hotkey.code to a robotjs hotkey string
 * @param {string} hotkey
 * @param {string} soundId
 */
function hotkeyToRobotjs(hotkey, soundId) {
  if (hotkey.startsWith('Arrow')) {
    hotkey = hotkey.replace('Arrow', '')
  }
  if (hotkey.startsWith('Numpad')) {
    hotkey = hotkey.replace('Numpad', 'numpad_')
  }
  if (hotkey.startsWith('Key')) {
    hotkey = hotkey.replace('Key', '')
  }
  if (hotkey.startsWith('ShiftRight')) {
    // this one needs the shift to be moved to the right
    hotkey = hotkey.replace('ShiftRight', 'right_shift')
  }
  if (hotkey.startsWith('ShiftLeft')) {
    // this one needs the shift to be moved to the left
    hotkey = hotkey.replace('ShiftLeft', 'left_shift')
  }
  if (hotkey.startsWith('Digit')) {
    hotkey = hotkey.replace('Digit', '')
  }
  return hotkey.toLowerCase()
}

/**
 * Send a key press to the system
 * @param {string[]} keys
 * @param {boolean} down
 */
function sendKey(keys, down) {
  if (globalHotkeysRunning) {
    globalHotkeys.stop()
  }
  keys.forEach(key => {
    robot.keyToggle(hotkeyToRobotjs(key), down ? 'down' : 'up')
  })
  if (globalHotkeysRunning) {
    globalHotkeys.run()
  }
}

/**
 * convert a hotkey.code to a electron global shortcut string
 * https://www.electronjs.org/docs/latest/api/accelerator
 * @param {string} hotkey
 */
function hotkeyToQHotkeyEnum(hotkey) {
  if (hotkey.startsWith('Arrow')) {
    return qKeys[hotkey]
  }
  if (hotkey === 'BracketLeft') {
    return qKeys[hotkey]
  }
  if (hotkey === 'NumpadArrowLeft') {
    return qKeys[hotkey]
  }
  if (hotkey.startsWith('Key')) {
    return qKeys[hotkey.replace('Key', '')]
  }
  if (hotkey.startsWith('Digit')) {
    return qKeys[hotkey.replace('Digit', '')]
  }
  if (hotkey.endsWith('Left')) {
    hotkey = hotkey.replace('Left', '')
  }
  if (hotkey.startsWith('Control')) {
    return qKeys[hotkey.replace('Control', 'Ctrl')]
  }
  if (qKeys.hasOwnProperty(hotkey)) {
    return qKeys[hotkey]
  }
  throw new Error(`Unknown hotkey: ${hotkey}`)
}

/**
 * Registers an array of hotkeys
 * @param { string[][] } hotkeys
 */
function registerHotkeys(hotkeysArray) {
  stop()
  hotkeysArray.forEach(hotkeys => {
    globalHotkeys.register(hotkeys.map(hotkeyToQHotkeyEnum), () => {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('on-key-pressed', hotkeys)
      })
    })
  })
  globalHotkeys.run()
  globalHotkeysRunning = true
}

/**
 * Adds an array of hotkeys
 * @param { string[][] } hotkeysArray
 */
function addHotkeys(hotkeysArray) {
  console.log('Adding hotkeys:', hotkeysArray)
  hotkeysArray.forEach(hotkeys => {
    globalHotkeys.register(hotkeys.map(hotkeyToQHotkeyEnum), () => {
      console.log('Hotkey pressed:', hotkeys)
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('on-key-pressed', hotkeys)
      })
    })
  })
}

/**
 * Un-registers an array of hotkeys
 * @param {string[][]} hotkeysArray
 */
function unregisterHotkeys(hotkeysArray) {
  hotkeysArray.forEach(hotkeys => {
    globalHotkeys.unregister(hotkeys.map(hotkeyToQHotkeyEnum))
  })
}

function stop() {
  globalHotkeys.unregisterAll()
  globalHotkeys.stop()
}

function getUserHome() {
  return process.env[process.platform == 'win32' ? 'AppData' : 'HOME']
}

function ensureDirectoryExistence(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true })
  }
}

function getConfigDirectoryAndAppName() {
  const userHome = getUserHome()
  // get the app name from the package.json file:
  const appName = require(join(__dirname, '../../package.json')).name
  const isDev = process.env.npm_lifecycle_event === 'app:dev'
  const configDirectory = isDev ? join(__dirname, '../../') : join(userHome, appName)
  return { configDirectory, appName }
}

function getDatabaseFilePath() {
  const { configDirectory, appName } = getConfigDirectoryAndAppName()
  ensureDirectoryExistence(configDirectory) // Make sure the directory exists
  // note: this will store the file here:
  // %LocalAppData%\Programs\pulse-panel\resources\app\pulse-panel.db
  return join(configDirectory, `${appName}.db`)
}

function getConfigurationFilePath() {
  const { configDirectory, appName } = getConfigDirectoryAndAppName()
  ensureDirectoryExistence(configDirectory) // Make sure the directory exists
  // note: this will store the file here:
  // %LocalAppData%\Programs\pulse-panel\resources\app\pulse-panel.json
  return join(configDirectory, `${appName}.json`)
}

/**
 *
 * @param { vbCableResult } result
 */
function cleanResult(result) {
  if (result.messages.length === 0) {
    delete result.messages
  }
  if (result.errors.length === 0) {
    delete result.errors
  }
  return result
}

/**
 * extends the properties of sudoExecResult
 * @extends { vbCableResult }
 * @typedef { Object } vbCableResult
 * @property { boolean | undefined } vbCableAlreadyInstalled
 * properties from sudoExecResult:
 * @property { boolean | undefined } vbCableInstallerRan
 * @property { string[] | undefined } messages
 * @property { any[] | undefined } errors
 */

/**
 * @param {string} appName
 * @returns {Promise<vbCableResult>}
 */
async function downloadVBCable(appName) {
  const { configDirectory } = getConfigDirectoryAndAppName()
  const url = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip'
  const filePath = join(configDirectory, 'VBCABLE_Driver_Pack43.zip')
  const extractPath = join(configDirectory, 'VBCable')
  const request = net.request(url)
  /**
   * @type { vbCableResult }
   */
  const mainResponse = { messages: [], errors: [] }

  /**
   * @type { vbCableResult }
   */
  if (await vbCableIsInstalled(mainResponse)) {
    // VBCable already installed
    await removeVBCableInstallDirectory(mainResponse, extractPath)
    mainResponse.vbCableAlreadyInstalled = true
    return cleanResult(mainResponse)
  }

  return await new Promise((resolve, reject) => {
    request.on('response', response => {
      const file = fs.createWriteStream(filePath)
      response.on('data', chunk => {
        file.write(chunk)
      })
      response.on('end', async () => {
        file.end()
        try {
          // Download completed
          await extractZipFile(mainResponse, filePath, extractPath)
          // remove the zip file, since it's no longer needed
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
          const result = await runSetupAndCleanup(mainResponse, appName, extractPath)
          resolve(cleanResult(result))
        } catch (err) {
          console.error('Error extracting zip file', err)
          mainResponse.errors.push(err)
          reject(cleanResult(mainResponse))
        }
      })
    })
    request.on('error', error => {
      console.error('Request failed:', error)
      mainResponse.errors.push(error)
      reject(cleanResult(mainResponse))
    })
    request.end()
  })
}

/**
 * extracts a zip file to the extractPath
 * @param { vbCableResult } response
 * @param { string } filePath the zip file which we're extracting
 * @param { string } extractPath the directory that we're extracting to
 */
async function extractZipFile(response, filePath, extractPath) {
  try {
    await extractZip(filePath, { dir: extractPath })
  } catch (err) {
    response.errors.push(err)
    response.messages.push('Error extracting zip file')
    console.error('Extraction error', err)
  }
  // Extraction completed
}

/**
 * Run the VBCable setup and cleanup
 * @param { vbCableResult } response
 * @param { string } appName the name of the app
 * @param { string } extractPath the path to the extracted VBCable files
 * @returns {Promise<vbCableResult>}
 */
async function runSetupAndCleanup(response, appName, extractPath) {
  // if VBCABLE_Setup_x64.exe exists, run it
  const setupPath = join(extractPath, 'VBCABLE_Setup_x64.exe')
  const setupPath32 = join(extractPath, 'VBCABLE_Setup.exe')
  return new Promise((resolve, reject) => {
    ;(async () => {
      /**
       * @type { sudoExecResult }
       */
      if (fs.existsSync(setupPath)) {
        await sudoExec(response, appName, setupPath)
        await removeVBCableInstallDirectory(response, extractPath)
        // add removeDirResult messages and errors to sudoExecResult
        resolve(response)
      } else if (fs.existsSync(setupPath32)) {
        await sudoExec(response, appName, setupPath32)
        await removeVBCableInstallDirectory(response, extractPath)
        resolve(response)
      } else {
        await removeVBCableInstallDirectory(response, extractPath)
        // removeDirResult.messages.push(...removeDirResult.messages)
        response.messages.push('VBCABLE_Setup_x64.exe not found')
        console.error('VBCABLE_Setup_x64.exe not found')
        reject(response)
      }
    })()
  })
}

/**
 * @typedef {Object} sudoExecResult
 * @property { boolean } vbCableInstallerRan
 * @property { string[] } messages
 * @property { any[] } errors
 */

/**
 * Run a command with sudo
 * @param {sudoExecResult} response
 * @param {string} appName
 * @param {string} command
 * @returns {Promise<sudoExecResult>}
 */
function sudoExec(response, appName, command) {
  return new Promise(resolve => {
    const options = {
      name: appName,
      icns: '/src/assets/pulse-panel_icon.ico', // (optional)
    }
    sudo.exec(command, options, error => {
      if (error) {
        response.messages.push('Error running VBCABLE_Setup')
        response.errors.push(error)
        response.vbCableInstallerRan = false
        resolve(response)
        return
      }
      response.vbCableInstallerRan = true
      resolve(response)
    })
  })
}

/**
 * @typedef {Object} RemoveDirResult
 * @property { string[] } messages
 * @property { any[] } errors
 */

/**
 * @param { RemoveDirResult } response
 * @param { string } extractPath
 * @returns { Promise<RemoveDirResult> }
 */
async function removeVBCableInstallDirectory(response, extractPath) {
  /**
   * @type { RemoveDirResult }
   */
  if (fs.existsSync(extractPath)) {
    try {
      await attemptRemove(response, extractPath)
    } catch (err) {
      // Handle error
      response.messages.push('Error removing VBCable install directory')
      response.errors.push(err)
    }
  } else {
    response.messages.push('VBCable install directory already removed')
  }

  return response
}

/**
 * Attempt to remove the VBCable install directory
 * @param { RemoveDirResult } response
 * @param {string} extractPath
 * @returns { Promise<RemoveDirResult> }
 * @throws {Error} if the directory cannot be removed after 5 retries
 */
function attemptRemove(response, extractPath) {
  const maxRetries = 5
  let attempts = 0
  /**
   *
   * @param {*} err
   * @param { (value: RemoveDirResult | PromiseLike<RemoveDirResult>) => void } resolve
   * @param { (reason?: any) => void } reject
   */
  const removeCallback = (err, resolve, reject) => {
    if (err && attempts < maxRetries) {
      attempts++
      response.messages.push(`Retry ${attempts}/${maxRetries} failed to remove directory, retrying in 1 second...`)

      setTimeout(async () => {
        // Retry after 1 second
        attemptRemove()
          .then(() => resolve(response))
          .catch(errParam => reject(errParam))
      }, 1000)
    } else if (err) {
      response.messages.push(`Error cleaning up VBCable install: ${err}`)
      response.errors.push(err)
      console.error('Error cleaning up VBCable install', err)
      reject(response)
    } else {
      resolve(response)
    }
  }

  return new Promise((resolve, reject) => {
    fs.rm(extractPath, { recursive: true }, err => removeCallback(err, resolve, reject))
  })
}

/**
 * Check if VBCable is installed
 * @param { vbCableResult } response
 * @returns {Promise<boolean>}
 */
async function vbCableIsInstalled(response) {
  const registryKeyPath = 'HKLM\\SOFTWARE\\VB-Audio\\Cable'
  regedit.setExternalVBSLocation('resources/regedit/vbs')
  try {
    const result = await regedit.promisified.list(registryKeyPath)
    return (
      result &&
      result[registryKeyPath] &&
      result[registryKeyPath].exists &&
      fs.existsSync('C:\\Program Files\\VB\\CABLE\\VBCABLE_ControlPanel.exe')
    )
  } catch (err) {
    response.messages.push('Error reading registry')
    response.errors.push(err)
    console.error('Error reading registry', err)
    return false // assume VBCable is not installed
  }
}

module.exports = {
  _readSetting,
  sendKey,
  registerHotkeys,
  addHotkeys,
  unregisterHotkeys,
  stop,
  downloadVBCable,
  readAllDBSettings,
  saveDBSetting,
  readDBSetting,
  deleteDBSetting,
  readAllDBSounds,
  saveSound,
  saveSoundProperty,
  insertSounds,
  moveSound,
  reorderSound,
  deleteSoundProperty,
  deleteSound,
  saveSoundsArray,
  saveVisibility,
}
