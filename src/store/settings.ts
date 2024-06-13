import { defineStore } from 'pinia'
import { Sound } from '@/@types/sound'
import { openDB } from 'idb'
import { File } from '@/@types/file'
import { v4 } from 'uuid'
import { useSoundStore } from './sound'

interface State {
  appName: string
  defaultVolume: number
  windowIsMaximized: boolean
  outputDevices: string[]
  allOutputDevices: MediaDeviceInfo[]
  darkMode: boolean
  allowOverlappingSound: boolean
  sounds: Sound[]
  displayMode: DisplayMode
  currentEditingSound: Sound | null
  muted: boolean
  recordingHotkey: boolean
  ptt_hotkey: string[]
  searchText: string
}

interface SoundWithHotkey extends Sound {
  hotkey: string[]
}

type BooleanSettings = 'darkMode' | 'allowOverlappingSound'
type ArraySoundSettings = 'sounds'
type ArraySettings = 'outputDevices' | 'ptt_hotkey'
// type StringSettings = 'ptt_hotkey'
export type DisplayMode = 'edit' | 'play'
const isProduction = process.env.NODE_ENV === 'production'
const dbName = isProduction ? 'pulse-panel' : 'pulse-panel-dev'
const dbStoreName = isProduction ? 'sounds' : 'sounds-dev'

export interface SettingsStore extends ReturnType<typeof useSettingsStore> {}

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    appName: 'Pulse Panel',
    defaultVolume: NaN,
    windowIsMaximized: false,
    outputDevices: [],
    allOutputDevices: [],
    darkMode: true,
    allowOverlappingSound: false,
    sounds: [],
    displayMode: 'play',
    currentEditingSound: null,
    muted: false,
    recordingHotkey: false,
    ptt_hotkey: [],
    searchText: '',
  }),
  getters: {
    soundsFiltered(): Sound[] {
      return this.sounds.filter(
        (sound, index) =>
          sound.title?.toLowerCase().includes(this.searchText.toLowerCase()) ||
          sound.tags?.some(tag => tag.toLowerCase().includes(this.searchText.toLowerCase())) ||
          index > this.sounds.length - 2
      )
    },
  },
  actions: {
    /**
     * Fetch the default volume from the store
     * @returns the default volume
     */
    async fetchDefaultVolume(): Promise<number> {
      const electron = window.electron
      const volume = await electron?.readSetting?.('defaultVolume')
      if (volume === undefined) {
        await electron?.saveSetting?.('defaultVolume', 1)
        this.defaultVolume = 1
      } else if (typeof volume === 'number') {
        this.defaultVolume = volume
      }
      return this.defaultVolume
    },
    /**
     * Set the default volume
     * @param volume the volume to set
     * @returns void
     */
    async saveDefaultVolume(volume: number): Promise<void> {
      this.defaultVolume = volume
      const electron = window.electron
      await electron?.saveSetting?.('defaultVolume', volume)
    },
    /**
     * Toggle the mute state
     * @returns void
     */
    async toggleMute(): Promise<void> {
      this.muted = !this.muted
      const soundStore = useSoundStore()
      if (this.muted) {
        soundStore.muteAllSounds()
      } else {
        soundStore.unmuteAllSounds()
      }
      // save the mute setting to the idb store
      const electron = window.electron
      await electron?.saveSetting?.('muted', this.muted)
    },
    /**
     * Fetch the mute state from the store
     * @returns the current mute state
     */
    async fetchMute(): Promise<boolean> {
      const electron = window.electron
      const mute = await electron?.readSetting?.('muted')
      if (mute === undefined) {
        await electron?.saveSetting?.('muted', false)
        this.muted = false
      } else {
        this.muted = !!mute
      }
      return this.muted
    },
    async fetchAllOutputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const devicesFiltered = devices.filter(device => device.kind === 'audiooutput')
      this.allOutputDevices = devicesFiltered
      return devicesFiltered
    },
    async toggleDisplayMode(): Promise<void> {
      this.displayMode = this.displayMode === 'play' ? 'edit' : 'play'
    },
    // /**
    //  * Save a string setting to the store
    //  * @param key the key it's saved under
    //  * @param value the value to save
    //  */
    // async saveString(key: StringSettings, value: string | null): Promise<void> {
    //   const electron: Settings | undefined = window.electron
    //   if (value === null) {
    //     await this._deleteSetting(key)
    //   } else {
    //     await electron?.saveSetting?.(key, value)
    //   }
    //   this[key] = value
    // },
    // /**
    //  * Fetch a string setting from the store
    //  * @param key the key it's saved under
    //  * @param defaultValue the default value if it's not set, default to ''
    //  * @returns the value of the setting
    //  */
    // async fetchString(key: StringSettings, defaultValue: string | null = null): Promise<string | null> {
    //   const electron: Settings | undefined = window.electron
    //   const returnedString = await electron?.readSetting?.(key)
    //   if (returnedString === undefined || typeof returnedString !== 'string') {
    //     if (defaultValue === null) {
    //       await this._deleteSetting(key)
    //       this[key] = null
    //     } else {
    //       await electron?.saveSetting?.(key, defaultValue)
    //       this[key] = defaultValue
    //     }
    //   } else {
    //     this[key] = returnedString
    //   }
    //   return this[key]
    // },
    /**
     * Delete a string setting from the store
     * @param key the key it's saved under
     */
    async _deleteSetting(key: BooleanSettings): Promise<void> {
      const electron = window.electron
      await electron?.deleteSetting?.(key)
      // if key is a member of BooleanSettings, set it to false
      if (isBooleanSettings(key)) {
        this[key] = false
      }
    },
    /**
     * Save an array setting to the store
     * @param key the key it's saved under
     * @param value the value to save
     * @returns true if saved successfully
     */
    async saveStringArray(key: ArraySettings, value: string[]): Promise<boolean> {
      const electron = window.electron
      await electron?.saveSetting?.(key, value)
      this[key] = value
      return true
    },
    /**
     * Fetch an array setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to []
     * @returns the value of the setting
     */
    async fetchStringArray(key: ArraySettings, defaultValue: string[] = []): Promise<string[]> {
      const soundStore = useSoundStore()
      const electron = window.electron
      const returnedArray = await electron?.readSetting?.(key)
      if (returnedArray === undefined || !Array.isArray(returnedArray)) {
        if (key === 'outputDevices') {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput')
          defaultValue = [audioOutputDevices.length > 0 ? audioOutputDevices[0].deviceId : 'default']
        }
        await electron?.saveSetting?.(key, defaultValue)
        this[key] = defaultValue ?? []
      } else {
        this[key] = returnedArray
      }
      if (key === 'outputDevices') {
        soundStore.populatePlayingAudio(this[key].length)
      }
      return this[key]
    },
    async saveSoundArray(key: ArraySoundSettings, value: Sound[]): Promise<boolean> {
      const electron = window.electron
      await electron?.saveSetting?.(key, JSON.stringify(value))
      return true
    },
    /**
     * Fetch an array setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to [{ id: v4() }]
     * @returns the value of the setting
     */
    async fetchSoundSetting(key: ArraySoundSettings, defaultValue: Sound[] = [{ id: v4() }]): Promise<Sound[]> {
      const electron = window.electron
      const returnedArray = await electron?.readSetting?.(key)
      if (
        returnedArray === undefined ||
        typeof returnedArray !== 'string' ||
        (Array.isArray(returnedArray) && returnedArray.length === 0)
      ) {
        await electron?.saveSetting?.(key, JSON.stringify(defaultValue))
        this[key] = defaultValue
        return this[key]
      } else {
        const sounds = JSON.parse(returnedArray)
        if (sounds.length < 1 || sounds[sounds.length - 1].name !== undefined) {
          sounds.push({ id: v4() }) // add a new sound button if there isn't one
        }
        this.sounds = sounds
        this.registerHotkeys()
        this.registerWindowResize()
        this._getImageUrls(this.sounds)
        return this.sounds
      }
    },
    /**
     * Lazily get the image URLs for the sounds.
     * @param sounds[] the array of sounds
     * @returns void
     */
    _getImageUrls(sounds: Sound[]) {
      sounds.forEach(sound => {
        if (sound.imageUrl === undefined && sound.imageKey !== undefined) {
          this.getFile(sound.imageKey).then(imageUrl => {
            if (imageUrl) {
              sound.imageUrl = imageUrl
            }
          })
        }
      })
    },
    /**
     * This function listens for windowResize events and sets the windowIsMaximized state
     * @param isMaximized the state of the window
     * @returns void
     */
    registerWindowResize(): void {
      const electron = window.electron
      electron?.onWindowResized(isMaximized => {
        this.windowIsMaximized = isMaximized
      })
      electron?.requestMainWindowSized() // request the current to initialize the windowIsMaximized state
    },
    /**
     * Register the hotkeys for the sounds when the app loads
     */
    async registerHotkeys(): Promise<void> {
      const soundStore = useSoundStore()
      const electron = window.electron
      const startingObject: string[][] = []
      const hotkeys = this.sounds
        .filter(sound => sound.hotkey !== undefined)
        .reduce((array, sound) => {
          if (sound.hotkey && !array.some(keys => arraysAreEqual(sound.hotkey, keys))) {
            array.push(sound.hotkey)
          }
          return array
        }, startingObject)

      hotkeys.forEach(keys => {
        electron?.registerHotkeys([...keys])
      })
      electron?.onKeyPressed(key => {
        this.sounds
          .filter(sound => arraysAreEqual(sound.hotkey, key))
          .forEach(sound => soundStore.playSound(sound, null, null, undefined, true))
      })
    },
    /**
     * Remove a hotkey from the store
     * @param soundId the key to remove
     */
    removeHotkey(pSound: Sound, keys: string[]) {
      const electron = window.electron
      // get a the previous array of hotkeys that were registered
      const prevHotkeys = this.sounds.filter((sound): sound is SoundWithHotkey => sound.hotkey !== undefined)
      // find out if any other hotkeys are using the key
      const hotkeyAlreadyUsed = prevHotkeys.some(s => s.id !== pSound.id && arraysAreEqual(s.hotkey, keys))
      if (hotkeyAlreadyUsed) {
        // hotkey already used, no need to unregister it
        return
      }
      if (keys.length === 0) return
      electron?.unregisterHotkeys([...keys])
    },
    /**
     * Add a hotkey to the store
     * @param keys the key to add
     * @param sound the sound to play
     */
    addHotkey(sound: Sound, keys: string[] | undefined) {
      const electron = window.electron
      if (keys === undefined) return
      // get a the previous array of hotkeys that were registered
      const prevHotkeys = this.sounds.filter((sound): sound is SoundWithHotkey => sound.hotkey !== undefined)
      // check if any other hotkeys are using the key
      const otherHotkeyAlreadyUsed = prevHotkeys.some(s => s.id !== sound.id && arraysAreEqual(s.hotkey, keys))
      if (otherHotkeyAlreadyUsed) {
        // hotkey already used, no need to re-add it
        return
      }
      electron?.registerHotkeys([...keys])
    },
    /**
     * Save a sound to the store
     * @param file the sound to save
     */
    async saveFile(file: File) {
      // Open (or create) the database
      const db = await openDB(dbName, 1, {
        upgrade(db) {
          db.createObjectStore(dbStoreName)
        },
      })

      // Store the file in the database so it can be accessed later
      const key = v4()
      await db.put(dbStoreName, file, key)

      // Create a blob URL that points to the file data
      return { fileUrl: URL.createObjectURL(file), fileKey: key }
    },
    /**
     * Fetch a sound from the store
     * @param path the key it's saved under
     * @returns the value of the URL to the file
     */
    async getFile(key: string): Promise<string | null> {
      // open the database
      const db = await openDB(dbName, 1, {
        upgrade(db) {
          db.createObjectStore(dbStoreName)
        },
      })

      // get the file from the database
      try {
        const file = await db.get(dbStoreName, key)

        if (file) {
          // Create a blob URL that points to the file data
          return URL.createObjectURL(file)
        }
      } catch (error) {
        console.warn(error)
        // do nothing, we return null if the file doesn't exist
      }
      return null
    },
    /**
     * Delete a sound from the store
     * @param path the key it's saved under
     */
    async deleteFile(path: string | undefined): Promise<void> {
      if (path === undefined) return
      // open the database
      const db = await openDB(dbName, 1)

      // delete the file from the database
      await db.delete(dbStoreName, path)
    },
    async replaceFile(oldPath: string | undefined, newFile: File): Promise<{ fileUrl: string; fileKey: string }> {
      if (oldPath) {
        await this.deleteFile(oldPath)
      }
      return this.saveFile(newFile)
    },
    /**
     * Fetch a boolean setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to false
     * @returns the value of the setting
     */
    async fetchBooleanSetting(key: BooleanSettings, defaultValue: boolean = false): Promise<boolean> {
      const electron = window.electron
      const returnedBoolean = await electron?.readSetting?.(key)
      if (returnedBoolean === undefined) {
        await electron?.saveSetting?.(key, defaultValue)
        this[key] = defaultValue
      } else {
        this[key] = !!returnedBoolean // default to true
      }

      return this[key]
    },
    /**
     * Save a boolean setting to the store
     * @param key the key it's saved under
     * @param value the value to save
     * @returns true if saved successfully
     */
    async saveBoolean(key: BooleanSettings, value: boolean): Promise<boolean> {
      const electron = window.electron
      await electron?.saveSetting(key, value)
      this[key] = value
      if (key === 'darkMode') {
        // notify the main process to toggle dark mode
        window.electron?.toggleDarkMode(value)
      }
      return true // saved successfully
    },
  },
})

function isBooleanSettings(key: string): key is BooleanSettings {
  if (key === 'darkMode' || key === 'allowOverlappingSound') {
    return true
  }
  return false
}

/**
 * Check if two arrays are equal
 * note: this function does not care if they are in the same order
 * @param arr1 array 1
 * @param arr2 array 2
 * @returns true if the arrays are equal
 */
function arraysAreEqual(arr1: string[] | undefined, arr2: string[] | undefined): boolean {
  if (arr1 === undefined || arr2 === undefined) return false
  if (arr1.length !== arr2.length) return false
  return arr1.every(value => arr2.includes(value)) && arr2.every(value => arr1.includes(value))
}
