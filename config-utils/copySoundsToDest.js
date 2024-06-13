/**
 * Copy the sounds from the source object to the destination object.
 * @param {string} sourcePath - The path to the source object.
 * @param {string} destinationPath - The path to the destination object.
 * @returns {void}
 * @example
 * copySourceSoundsToDestination('src/data/sounds.json', 'c:/Users/meado/AppData/Roaming/pulse-panel/pulse-panel.json')
 * @example
 * copySourceSoundsToDestination('c:/Users/meado/AppData/Roaming/pulse-panel/pulse-panel.json', 'src/data/sounds.json')
 **/
function copySourceSoundsToDestination(sourcePath, destinationPath) {
  const fs = require('fs')
  // get the json contents of the file
  const destinationObject = JSON.parse(fs.readFileSync(destinationPath, 'utf8'))
  /**
   * Parsed sounds from the source object.
   * @type {Array<Sound>}
   */
  const destinationSounds = JSON.parse(destinationObject.sounds)

  const sourceObject = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))

  /**
   * @typedef {Object} Sound
   * @property {string} id
   * @property {string | undefined} title
   * @property {boolean | undefined} hideTitle
   * @property {string[] | undefined} tags
   * @property {string[] | undefined} hotkey
   * @property {string | undefined} audioUrl
   * @property {string | undefined} audioKey
   * @property {string | undefined} imageUrl
   * @property {string | undefined} imageKey
   * @property {number | undefined} volume
   * @property {boolean | undefined} isPreview
   */

  /**
   * Parsed sounds from the source object.
   * @type {Array<Sound>}
   */
  const sourceSounds = JSON.parse(sourceObject.sounds)
  // console.log('sourceObject', sourceSounds[sourceSounds.length - 1])

  const fieldsToCopy = ['id', 'hideTitle', 'hotkey', 'isPreview', 'tags', 'volume']

  let changedSounds = 0
  destinationSounds.forEach((sound, index) => {
    // find the sound in the source object where the name matches
    if (
      sourceSounds[index] &&
      destinationSounds[index] &&
      destinationSounds[index].title === sourceSounds[index].title
    ) {
      console.log('checked', sourceSounds[index].id)
      // if the sound exists in the source object, update it
      let changed = false
      fieldsToCopy.forEach(key => {
        if (
          sourceSounds[index][key] !== undefined &&
          JSON.stringify(sourceSounds[index][key]) !== JSON.stringify(destinationSounds[index][key])
        ) {
          changed = true
          console.log('copying', key, sourceSounds[index][key])
          destinationSounds[index][key] = sourceSounds[index][key]
        }
      })
      if (changed) {
        changedSounds++
      }
    } else {
      console.log('sound not found', sound.title)
    }
  })
  console.log('changedSounds:', changedSounds)

  destinationObject.sounds = JSON.stringify(destinationSounds)
  fs.writeFileSync(`${destinationPath}`, JSON.stringify(destinationObject, null, 2))
}

module.exports = { copySourceSoundsToDestination }
