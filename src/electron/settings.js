'use strict'

const fs = require('fs')
const { join } = require('path')
const nconf = require('nconf').file({
  file: getConfigurationFilePath(),
})
const robot = require('@jitsi/robotjs')
const { BrowserWindow, net } = require('electron')
const { qKeys, qHotkeys } = require('@meadowsjared/qhotkeys')
const extractZip = require('extract-zip')
const { exec } = require('child_process')
const regedit = require('regedit')
const globalHotkeys = new qHotkeys()

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

function getConfigurationFilePath() {
  const userHome = getUserHome()
  // get the app name from the package.json file:
  const appName = require(join(__dirname, '../../package.json')).name
  const isDev = process.env.npm_lifecycle_event === 'app:dev'
  const configDirectory = isDev ? join(__dirname, '../../') : join(userHome, appName)
  ensureDirectoryExistence(configDirectory) // Make sure the directory exists
  // note: this will store the file here:
  // %LocalAppData%\Programs\pulse-panel\resources\app\pulse-panel.json
  return join(configDirectory, `${appName}.json`)
}

async function downloadVBCable() {
  if (await vbCableIsInstalled()) {
    // VBCable already installed
    cleanUpVBCableInstall()
    return false
  }

  const url = 'https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip'
  const filePath = join(__dirname, 'VBCABLE_Driver_Pack43.zip')
  const extractPath = join(__dirname, 'VBCable')
  const request = net.request(url)

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
          await extractZipFile(filePath, extractPath)
          // remove the zip file, since it's no longer needed
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
          }
          runSetupAndCleanup(extractPath)
          resolve(true)
        } catch (err) {
          console.error('Error extracting zip file', err)
          reject(err)
        }
      })
    })
    request.on('error', error => {
      console.error('Request failed:', error)
      reject(error)
    })
    request.end()
  })
}

/**
 * extracts a zip file to the extractPath
 * @param { string } filePath the zip file which we're extracting
 * @param { string } extractPath the directory that we're extracting to
 */
async function extractZipFile(filePath, extractPath) {
  try {
    await extractZip(filePath, { dir: extractPath })
  } catch (err) {
    console.error('Extraction error', err)
  }
  // Extraction completed
}

function runSetupAndCleanup(extractPath) {
  // if VBCABLE_Setup_x64.exe exists, run it
  const setupPath = join(extractPath, 'VBCABLE_Setup_x64.exe')
  const setupPath32 = join(extractPath, 'VBCABLE_Setup.exe')
  if (fs.existsSync(setupPath)) {
    exec(setupPath, () => {
      removeVBCableInstallDirectory(extractPath)
    })
  } else if (fs.existsSync(setupPath32)) {
    exec(setupPath32, () => {
      removeVBCableInstallDirectory(extractPath)
    })
  } else {
    console.error('VBCABLE_Setup_x64.exe not found')
  }
}

function removeVBCableInstallDirectory(extractPath) {
  const maxRetries = 5
  let attempts = 0

  function attemptRemove() {
    fs.rm(extractPath, { recursive: true }, err => {
      if (err) {
        if (attempts < maxRetries) {
          attempts++
          console.log(`Retry ${attempts}/${maxRetries} failed to remove directory, retrying in 1 second...`)
          setTimeout(attemptRemove, 1000) // Retry after 1 second
        } else {
          console.error('Error cleaning up VBCable install', err)
        }
      } else {
        // Successfully removed VBCable install directory
      }
    })
  }

  if (fs.existsSync(extractPath)) {
    attemptRemove()
  }
}

/**
 * Check if VBCable is installed
 * @returns {Promise<boolean>}
 */
function vbCableIsInstalled() {
  return new Promise(resolve => {
    const registryKeyPath = 'HKLM\\SOFTWARE\\VB-Audio\\Cable'
    regedit.list(registryKeyPath, (err, result) => {
      if (err) {
        console.error('Error reading registry', err)
        resolve(false)
      }
      resolve(result[registryKeyPath] !== undefined)
    })
  })
}

function cleanUpVBCableInstall() {
  const extractPath = join(__dirname, 'VBCable')
  if (fs.existsSync(extractPath)) {
    fs.rm(extractPath, { recursive: true }, err => {
      if (err) {
        console.error('Error cleaning up VBCable install', err)
      }
    })
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
