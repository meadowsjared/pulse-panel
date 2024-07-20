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

function saveSetting(settingKey, settingValue) {
  nconf.set(settingKey, settingValue)
  nconf.save()
}

function readSetting(settingKey) {
  nconf.load()
  return nconf.get(settingKey)
}

function deleteSetting(settingKey) {
  nconf.load()
  nconf.clear(settingKey)
  nconf.save()
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
  keys.forEach(key => {
    robot.keyToggle(hotkeyToRobotjs(key), down ? 'down' : 'up')
  })
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
 * @param { string[] } hotkeys
 */
function registerHotkeys(hotkeys) {
  stop()
  globalHotkeys.register(hotkeys.map(hotkeyToQHotkeyEnum), () => {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('on-key-pressed', hotkeys)
    })
  })
  globalHotkeys.run()
}

/**
 * Unregisters an array of hotkeys
 * @param {string[]} hotkeys
 */
function unregisterHotkeys(hotkeys) {
  globalHotkeys.unregister(hotkeys.map(hotkeyToQHotkeyEnum))
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
  saveSetting,
  readSetting,
  deleteSetting,
  sendKey,
  registerHotkeys,
  unregisterHotkeys,
  stop,
  downloadVBCable,
}
