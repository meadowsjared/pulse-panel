'use strict'

const fs = require('fs')
const path = require('path')
const nconf = require('nconf').file({
  file: getConfigurationFilePath(),
})

function saveSetting(settingKey, settingValue) {
  nconf.set(settingKey, settingValue)
  nconf.save()
}

function readSetting(settingKey) {
  nconf.load()
  return nconf.get(settingKey)
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
  const appName = require('../../package.json').name
  const configDirectory = path.join(userHome, appName)
  ensureDirectoryExistence(configDirectory) // Make sure the directory exists
  return path.join(configDirectory, `${appName}.json`)
}

module.exports = {
  saveSetting,
  readSetting,
}
