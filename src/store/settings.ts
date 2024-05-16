import { defineStore } from 'pinia'
import { Settings } from '../../@types/electron-window'
import { Sound } from '@/@types/sound'
import { openDB } from 'idb'
import { File } from '@/@types/file'
import { v4 } from 'uuid'
import { useSoundStore } from './sound'

interface State {
  outputDevices: string[]
  darkMode: boolean
  allowOverlappingSound: boolean
  sounds: Sound[]
  displayMode: DisplayMode
  currentEditingSound: Sound | null
  muted: boolean
  ptt_hotkey: string | null
}

interface SoundWithHotkey extends Sound {
  hotkey: string
}

type BooleanSettings = 'darkMode' | 'allowOverlappingSound'
type ArraySoundSettings = 'sounds'
type ArraySettings = 'outputDevices'
type StringSettings = 'ptt_hotkey'
export type DisplayMode = 'edit' | 'play'
const isProduction = process.env.NODE_ENV === 'production'
const dbName = isProduction ? 'pulse-panel' : 'pulse-panel-dev'
const dbStoreName = isProduction ? 'sounds' : 'sounds-dev'

export interface SettingsStore extends ReturnType<typeof useSettingsStore> {}

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    outputDevices: [],
    darkMode: true,
    allowOverlappingSound: false,
    sounds: [],
    displayMode: 'play',
    currentEditingSound: null,
    muted: false,
    ptt_hotkey: null,
  }),
  actions: {
    async toggleMute(): Promise<void> {
      this.muted = !this.muted
      if (this.muted) {
        const soundStore = useSoundStore()
        soundStore.stopAllSounds()
      }
      // save the mute setting to the idb store
      const electron = window.electron
      await electron?.saveSetting?.('muted', this.muted)
    },
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
    async getOutputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audiooutput')
    },
    async toggleDisplayMode(): Promise<void> {
      this.displayMode = this.displayMode === 'play' ? 'edit' : 'play'
    },
    /**
     * Save a string setting to the store
     * @param key the key it's saved under
     * @param value the value to save
     */
    async saveString(key: StringSettings, value: string | null): Promise<void> {
      const electron: Settings | undefined = window.electron
      if (value === null) {
        await this._deleteSetting(key)
      } else {
        await electron?.saveSetting?.(key, value)
      }
      this[key] = value
    },
    /**
     * Fetch a string setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to ''
     * @returns the value of the setting
     */
    async fetchString(key: StringSettings, defaultValue: string | null = null): Promise<string | null> {
      const electron: Settings | undefined = window.electron
      const returnedString = await electron?.readSetting?.(key)
      if (returnedString === undefined || typeof returnedString !== 'string') {
        if (defaultValue === null) {
          await this._deleteSetting(key)
          this[key] = null
        } else {
          await electron?.saveSetting?.(key, defaultValue)
          this[key] = defaultValue
        }
      } else {
        this[key] = returnedString
      }
      return this[key]
    },
    /**
     * Delete a string setting from the store
     * @param key the key it's saved under
     */
    async _deleteSetting(key: StringSettings | BooleanSettings): Promise<void> {
      const electron = window.electron
      await electron?.deleteSetting?.(key)
      // if key is a member of BooleanSettings, set it to false
      if (isBooleanSettings(key)) {
        this[key] = false
      } else {
        this[key] = null
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
      await electron?.saveSetting?.(key, JSON.stringify(value))
      this[key] = value
      return true
    },
    /**
     * Fetch an array setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to []
     * @returns the value of the setting
     */
    async fetchStringArray(key: ArraySettings, defaultValue?: string[]): Promise<string[]> {
      const soundStore = useSoundStore()
      const electron = window.electron
      const returnedArray = await electron?.readSetting?.(key)
      if (returnedArray === undefined) {
        if (key === 'outputDevices') {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput')
          defaultValue = [audioOutputDevices.length > 0 ? audioOutputDevices[0].deviceId : 'default']
        }
        await electron?.saveSetting?.(key, JSON.stringify(defaultValue))
        this[key] = defaultValue ?? []
      } else if (typeof returnedArray === 'string') {
        this[key] = JSON.parse(returnedArray)
      }
      if (key === 'outputDevices') {
        soundStore.populatePlayingAudio(this[key].length)
      }

      return this[key]
    },
    async saveSoundArray(key: ArraySoundSettings, value: Sound[]): Promise<boolean> {
      const electron = window.electron
      await electron?.saveSetting?.(key, JSON.stringify(value))
      this[key] = value
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
      if (returnedArray === undefined || typeof returnedArray !== 'string') {
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
        return this._getImageUrls(key, sounds)
      }
    },
    /**
     * Register the hotkeys for the sounds when the app loads
     */
    async registerHotkeys(): Promise<void> {
      const soundStore = useSoundStore()
      const electron = window.electron
      const startingObject: string[] = []
      const hotkeys = this.sounds
        .filter(sound => sound.hotkey !== undefined)
        .reduce((array, sound) => {
          if (sound.hotkey && !array.includes(sound.hotkey)) {
            array.push(sound.hotkey)
          }
          return array
        }, startingObject)

      electron?.registerHotkeys(hotkeys)
      electron?.onKeyPressed(key => {
        this.sounds
          .filter(sound => sound.hotkey === key)
          .forEach(sound => {
            soundStore.playSound(sound)
          })
      })
    },
    /**
     * Remove a hotkey from the store
     * @param soundId the key to remove
     */
    removeHotkey(pSound: Sound, key: string) {
      const electron = window.electron
      // get a the previous array of hotkeys that were registered
      const prevHotkeys = this.sounds.filter((sound): sound is SoundWithHotkey => sound.hotkey !== undefined)
      // find out if any other hotkeys are using the key
      const hotkeyAlreadyUsed = prevHotkeys.some(s => s.id !== pSound.id && s.hotkey === key)
      if (hotkeyAlreadyUsed) {
        // hotkey already used, no need to unregister it
        return
      }
      electron?.unregisterHotkeys([key])
    },
    /**
     * Add a hotkey to the store
     * @param key the key to add
     * @param sound the sound to play
     */
    addHotkey(sound: Sound, key: string | undefined) {
      const electron = window.electron
      if (key === undefined) return
      // get a the previous array of hotkeys that were registered
      const prevHotkeys = this.sounds.filter((sound): sound is SoundWithHotkey => sound.hotkey !== undefined)
      // check if any other hotkeys are using the key
      const otherHotkeyAlreadyUsed = prevHotkeys.some(s => s.id !== sound.id && s.hotkey === key)
      if (otherHotkeyAlreadyUsed) {
        // hotkey already used, no need to re-add it
        return
      }
      electron?.registerHotkeys([key])
    },
    /**
     * Get the image URLs for the sounds.
     * @param sounds the array of sounds
     * @returns the array of sounds with image URLs
     */
    async _getImageUrls(key: ArraySoundSettings, sounds: Sound[]) {
      if (key === 'sounds') {
        for (const sound of sounds) {
          if (sound.imageUrl === undefined && sound.imageKey !== undefined) {
            const imageUrl = await this.getFile(sound.imageKey)
            if (imageUrl) {
              sound.imageUrl = imageUrl
            }
          }
        }
      }
      return sounds
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
