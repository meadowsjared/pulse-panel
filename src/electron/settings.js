'use strict'

const fs = require('fs')
const { join } = require('path')
const nconf = require('nconf').file({
  file: getConfigurationFilePath(),
})
const robot = require('@jitsi/robotjs')

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
 * Send a key to the active window
 * @param {string} key
 * @param {boolean} down
 */
function sendKey(key, down) {
  if (key.startsWith('Arrow')) {
    key = key.replace('Arrow', '')
  }
  if (key.startsWith('Numpad')) {
    key = key.replace('Numpad', 'numpad_')
  }
  if (key.startsWith('Key')) {
    key = key.replace('Key', '')
  }
  if (key.startsWith('ShiftRight')) {
    // this one needs the shift to be moved to the right
    key = key.replace('ShiftRight', 'right_shift')
  }
  if (key.startsWith('ShiftLeft')) {
    // this one needs the shift to be moved to the left
    key = key.replace('ShiftLeft', 'left_shift')
  }
  if (key.startsWith('Digit')) {
    key = key.replace('Digit', '')
  }
  key = key.toLowerCase()
  robot.keyToggle(key, down ? 'down' : 'up')
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
}
