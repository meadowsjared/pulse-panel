'use strict'

const fs = require('fs')
const { join } = require('path')
const nconf = require('nconf').file({
  file: getConfigurationFilePath(),
})
const robot = require('@jitsi/robotjs')
const { BrowserWindow } = require('electron')
const { qKeys, qHotkeys } = require('qhotkeys')
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

module.exports = {
  saveSetting,
  readSetting,
  deleteSetting,
  sendKey,
  registerHotkeys,
  unregisterHotkeys,
  stop,
}
