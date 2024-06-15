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

  let count = {
    found: 0,
    notFound: 0,
    changed: 0,
  }
  /** keeps track of whether all the sounds match, and are in the same order */
  let allMatch = true
  destinationSounds.forEach((destinationSound, index) => {
    // find the sound in the source object where the name matches
    /**
     * @type {Sound}
     */
    const sourceSound = sourceSounds.find(sound => sound.title === destinationSound.title)
    if (
      destinationSounds[index] &&
      destinationSounds.filter(sound => sound.title === sourceSounds[index].title).length === 1
    ) {
      count.found++
      // if the sound exists in the source object, update it
      let changed = false
      fieldsToCopy.forEach(key => {
        if (
          sourceSound[key] !== undefined &&
          JSON.stringify(sourceSound[key]) !== JSON.stringify(destinationSounds[index][key])
        ) {
          changed = true
          console.log('copying', `'${sourceSound.title}'`, key, sourceSound[key])
          destinationSounds[index][key] = sourceSound[key]
        } else if (sourceSound[key] === undefined && destinationSounds[index][key] !== undefined) {
          console.log('deleting', `'${sourceSound.title}'`, key, destinationSounds[index][key])
          changed = true
          delete destinationSounds[index][key]
        }
      })
      if (changed) {
        count.changed++
      }
    } else {
      allMatch = false
      count.notFound++
      console.log('sound not found', destinationSound.title, destinationSound.id)
    }
  })
  sourceSounds.forEach((_, index) => {
    if (destinationSounds[index].title !== sourceSounds[index].title) {
      console.log(`${sourceSounds[index].title} not in correct location`)
      allMatch = false
    }
  })

  console.log('results:', count)
  if (count.notFound > 0) {
    console.log(`WARNING! ${count.notFound} sounds not found`)
  }
  // only write the file if there were changes
  if (count.changed > 0) {
    destinationObject.sounds = JSON.stringify(destinationSounds)
    fs.writeFileSync(`${destinationPath}`, JSON.stringify(destinationObject, null, 2))
  }
  if (allMatch) {
    console.log('All sounds match!')
  } else {
    console.log('WARNING! Sounds do not match')
  }
}

module.exports = { copySourceSoundsToDestination }
