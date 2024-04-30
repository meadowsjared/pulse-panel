import { defineStore } from 'pinia'
import { Settings } from '../../@types/electron-window'
import { Sound } from '@/@types/sound'
import { openDB } from 'idb'
import { File } from '@/@types/file'
import { v4 } from 'uuid'

interface State {
  outputDeviceId: string | null
  darkMode: boolean
  allowOverlappingSound: boolean
  sounds: Sound[]
}

type BooleanSettings = 'darkMode' | 'allowOverlappingSound'
type StringSettings = 'outputDeviceId'
type ArraySettings = 'sounds'

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    outputDeviceId: null,
    darkMode: true,
    allowOverlappingSound: false,
    sounds: [],
  }),
  actions: {
    async getOutputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audiooutput')
    },
    /**
     * Fetch a string setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to ''
     * @returns the value of the setting
     */
    async fetchStringSetting(key: StringSettings, defaultValue: string = ''): Promise<string> {
      const electron: Settings | undefined = window.electron
      const returnedString = await electron?.readSetting?.(key)
      if (returnedString === undefined || typeof returnedString !== 'string') {
        // automagically set the defaultValue if key is 'outputDeviceId'
        if (key === 'outputDeviceId') {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput')
          defaultValue = audioOutputDevices.length > 0 ? audioOutputDevices[0].deviceId : 'default'
        }
        await electron?.saveSetting?.(key, defaultValue)
        this[key] = defaultValue
      } else {
        this[key] = returnedString
      }

      return this[key] || ''
    },
    /**
     * Save a string setting to the store
     * and validate the value if key is outputDeviceId
     * @param key the key it's saved under
     * @param value the value to save
     * @returns true if saved successfully
     */
    async saveString(key: StringSettings, value: string): Promise<boolean> {
      const electron: Settings | undefined = window.electron
      if (key === 'outputDeviceId') {
        // Check if the device exists
        const devices = await navigator.mediaDevices.enumerateDevices()
        const device = devices.find(device => device.deviceId === value)
        if (!device) {
          console.error('Device not found')
          return false // failed to save
        }
      }
      await electron?.saveSetting?.(key, value)
      this[key] = value
      return true // saved successfully
    },
    /**
     * Save an array setting to the store
     * @param key the key it's saved under
     * @param value the value to save
     * @returns true if saved successfully
     */
    async saveArray(key: ArraySettings, value: (Object | null)[]): Promise<boolean> {
      const electron: Settings | undefined = window.electron
      await electron?.saveSetting?.(key, JSON.stringify(value))
      this[key] = value as Sound[]
      return true
    },
    /**
     * Fetch an array setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to [{ id: v4() }]
     * @returns the value of the setting
     */
    async fetchArraySetting(key: ArraySettings, defaultValue: Sound[] = [{ id: v4() }]): Promise<Sound[]> {
      const electron: Settings | undefined = window.electron
      const returnedArray = await electron?.readSetting?.(key)
      if (returnedArray === undefined || typeof returnedArray !== 'string') {
        await electron?.saveSetting?.(key, JSON.stringify(defaultValue))
        this[key] = defaultValue
      } else {
        this[key] = JSON.parse(returnedArray)
      }

      return this[key]
    },
    /**
     * Save a sound to the store
     * @param file the sound to save
     */
    async saveFile(file: File) {
      // Open (or create) the database
      const db = await openDB('pulse-panel', 1, {
        upgrade(db) {
          db.createObjectStore('sounds')
        },
      })

      // Store the file in the database so it can be accessed later
      await db.put('sounds', file, file.path)

      // Create a blob URL that points to the file data
      return URL.createObjectURL(file)
    },
    /**
     * Fetch a sound from the store
     * @param path the key it's saved under
     * @returns the value of the URL to the file
     */
    async getFile(path: string): Promise<string | null> {
      // open the database
      const db = await openDB('pulse-panel', 1)

      // get the file from the database
      const file = await db.get('sounds', path)

      if (file) {
        // Create a blob URL that points to the file data
        return URL.createObjectURL(file)
      }
      return null
    },
    /**
     * Delete a sound from the store
     * @param path the key it's saved under
     */
    async deleteFile(path: string): Promise<void> {
      // open the database
      const db = await openDB('pulse-panel', 1)

      // delete the file from the database
      await db.delete('sounds', path)
    },
    async replaceFile(oldPath: string | undefined, newFile: File): Promise<void> {
      if (oldPath) {
        await this.deleteFile(oldPath)
      }
      await this.saveFile(newFile)
    },
    /**
     * Fetch a boolean setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to false
     * @returns the value of the setting
     */
    async fetchBooleanSetting(key: BooleanSettings, defaultValue: boolean = false): Promise<boolean> {
      const electron: Settings | undefined = window.electron
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
      const electron: Settings | undefined = window.electron
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
