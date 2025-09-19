import { defineStore } from 'pinia'
import { LabelActive, Sound, SoundForSaving, SoundSegment } from '../@types/sound'
import { openDB } from 'idb'
import { File } from '../@types/file'
import { useSoundStore } from './sound'
import { Settings, SettingValue, Versions } from '../@types/electron-window'
import chordAlert from '../assets/wav/new-notification-7-210334.mp3'
import { toRaw } from 'vue'

declare global {
  interface Window {
    electron?: Settings & Versions
  }
}

interface State {
  defaultVolume: number
  outputDevices: string[]
  darkMode: boolean
  allowOverlappingSound: boolean
  sounds: Sound[]
  muted: boolean
  ptt_hotkey: string[]
  quickTagsAr?: LabelActive[]
  invertQuickTags: boolean
  // not saved in the database:
  /**
   * friendly name of the app
   *
   * **VOLATILE**
   */
  appName: string
  /**
   * List of all available output devices
   *
   * **VOLATILE**
   */
  allOutputDevices: MediaDeviceInfo[]
  /**
   * Whether the window is currently maximized
   *
   * **VOLATILE**
   */
  windowIsMaximized: boolean
  /**
   * The current text in the search box
   *
   * **VOLATILE**
   */
  searchText: string
  /**
   * Whether the app is currently recording a hotkey
   *
   * **VOLATILE**
   */
  recordingHotkey: boolean
  /**
   * The current display mode, either 'edit' or 'play'
   *
   * **VOLATILE**
   */
  displayMode: DisplayMode
  /**
   * The sound that is currently being hovered over
   *
   * **VOLATILE**
   */
  hoveredSound: Sound | null
  /**
   * The sound that is currently being edited
   *
   * **VOLATILE**
   */
  currentEditingSound: Sound | null
}

interface SoundWithHotkey extends Sound {
  hotkey: string[]
}

const Boolean_Settings_Keys = ['darkMode', 'allowOverlappingSound', 'invertQuickTags', 'muted'] as const
type BooleanSettings = (typeof Boolean_Settings_Keys)[number]

const Array_String_Settings_Keys = ['outputDevices', 'ptt_hotkey'] as const
type ArrayStringSettings = (typeof Array_String_Settings_Keys)[number]
const Array_Sound_Settings_Keys = ['sounds'] as const
type ArraySoundSettings = (typeof Array_Sound_Settings_Keys)[number]
const Number_Settings_Keys = ['defaultVolume'] as const
type NumberSettings = (typeof Number_Settings_Keys)[number]
const Label_Active_Settings_Keys = ['quickTagsAr'] as const
type LabelActiveSettings = (typeof Label_Active_Settings_Keys)[number]
type SettingsOnlyKeys = BooleanSettings | NumberSettings | ArrayStringSettings | LabelActiveSettings

const All_Settings_Keys = [
  ...Boolean_Settings_Keys,
  ...Array_String_Settings_Keys,
  ...Array_Sound_Settings_Keys,
  ...Number_Settings_Keys,
  ...Label_Active_Settings_Keys,
] as const
type AllSettings = (typeof All_Settings_Keys)[number]

type QuickTagButtonSettings = 'quickTagsAr'
type SliceParams = { start: number; end: number }
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
    hoveredSound: null,
    muted: false,
    recordingHotkey: false,
    ptt_hotkey: [],
    searchText: '',
    quickTagsAr: [],
    invertQuickTags: false,
  }),
  getters: {
    quickTags(): LabelActive[] {
      return this.quickTagsAr ?? []
    },
  },
  actions: {
    soundsFiltered(params?: SliceParams): Sound[] {
      const activeOrNegatedTags = this.quickTagsAr?.filter(tag => tag.active === true || tag.negated === true) ?? []
      const filteredSounds = this.sounds
        .filter(sound => {
          if (activeOrNegatedTags.length === 0) {
            if (this.invertQuickTags) {
              return (
                sound.tags === undefined ||
                sound.tags.length === 0 ||
                !sound.tags.some(tag => this.quickTagsAr?.some(t => t.label === tag))
              )
            } else {
              return true
            }
          }
          const invertedMatch =
            activeOrNegatedTags.length === 0 ||
            activeOrNegatedTags.every(
              anTag =>
                sound.tags === undefined ||
                (anTag.active && sound.tags.includes(anTag.label) === false) ||
                (anTag.negated && sound.tags.includes(anTag.label))
            )
          const normalMatch =
            activeOrNegatedTags.length === 0 ||
            activeOrNegatedTags.every(
              anTag =>
                (anTag.active && sound.tags?.includes(anTag.label) === true) ||
                (anTag.negated && !sound.tags?.includes(anTag.label))
            )
          return this.invertQuickTags ? invertedMatch : normalMatch
        })
        .filter(
          sound =>
            this.searchText.trim() === '' ||
            // compare the words from the title to the words from the search text
            // if either the (titleWord starts with the searchWord), return true
            sound.title
              ?.toLowerCase()
              .split(/[^a-zA-Z0-9_']/)
              .filter(titleWord => titleWord !== '')
              .some(titleWord =>
                this.searchText
                  .toLowerCase()
                  .split(/[^a-zA-Z0-9_']/)
                  .filter(searchWord => searchWord !== '')
                  .some(searchWord => titleWord.toLowerCase().startsWith(searchWord.toLowerCase()))
              ) ||
            // compare the words from the tags to the words from the search text
            // if the tag starts with the searchWord, return true
            sound.tags?.some(tag =>
              this.searchText
                .toLowerCase()
                .split(/[^a-zA-Z0-9_']/)
                .filter(searchWord => searchWord !== '')
                .some(searchWord => tag.toLowerCase().startsWith(searchWord.toLowerCase()))
            )
        )
      if (params !== undefined) {
        return filteredSounds.slice(params.start, params.end)
      }
      return filteredSounds
    },
    _assignValidatedSetting(key: SettingsOnlyKeys, value: SettingValue) {
      if (this._isBooleanSettings(key) && typeof value === 'boolean') return (this[key] = value)
      else if (this._isNumberSettings(key) && typeof value === 'number') return (this[key] = value)
      else if (this._isArrayStringSettings(key) && this._isArrayString(value)) return (this[key] = value)
      else if (this._isArrayLabelActiveSettings(key) && this._isLabelActiveArray(value)) return (this[key] = value)
      return false
    },
    /**
     * Fetch all settings from the database
     * @returns void
     */
    async fetchSettings(): Promise<void> {
      // fetch all the old settings from the old store
      // iterate through all SettingsKeys
      const electron = window.electron
      const AllSettings = [
        ...Boolean_Settings_Keys,
        ...Array_String_Settings_Keys,
        ...Number_Settings_Keys,
        ...Label_Active_Settings_Keys,
      ] as const
      const settings = await electron?.readAllDBSettings()
      // transfer all the properties from settings to the local state
      if (settings) Object.assign(this, toRaw(settings))
      const soundStore = useSoundStore()
      // if no settings were found, try to migrate from the old store
      if (settings === undefined || Object.keys(settings).length === 0) {
        console.log('migrating settings')
        let oldSettingsExist = false
        await Promise.all(
          AllSettings.map(async key => {
            const value = await electron?._readSetting(key)
            if (this._isArraySound(value)) return
            if (value !== undefined) {
              if (this._assignValidatedSetting(key, value)) {
                oldSettingsExist = true
              }
            }
          })
        )
        // if any old settings were found, migrate them to the new store
        if (oldSettingsExist) {
          await Promise.all(
            AllSettings.map(async key => {
              // transfer the setting to the new store
              if (this._isBooleanSettings(key) && typeof this[key] === 'boolean')
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isNumberSettings(key) && typeof this[key] === 'number')
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isArrayStringSettings(key) && this._isArrayString(this[key]))
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isArrayLabelActiveSettings(key) && this._isLabelActiveArray(this[key]))
                await this.saveSetting(key, toRaw(this[key]))
            })
          )
        }
      }
      if (this.outputDevices.length === 0) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput')
        const defaultValue = [audioOutputDevices.length > 0 ? audioOutputDevices[0].deviceId : 'default']
        await electron?.saveDBSetting('outputDevices', defaultValue)
        this.outputDevices = defaultValue
      }
      if (this.outputDevices.length > 0) {
        soundStore.populatePlayingAudio(this.outputDevices.length)
      }
    },
    /**
     * Save an array setting to the store
     * @param key the key it's saved under
     * @param value the value to save
     * @returns true if saved successfully
     */
    async saveSetting(key: AllSettings, value: SettingValue): Promise<boolean> {
      const electron = window.electron
      // if the key is a member of BooleanSettings, ensure the value is a boolean
      await electron?.saveDBSetting(key, value)
      if (this._isBooleanSettings(key)) {
        if (typeof value === 'boolean') {
          this[key] = value
          return true
        }
        return false
      }
      if (this._isNumberSettings(key)) {
        if (typeof value === 'number') {
          this[key] = value
          return true
        }
        return false
      }
      if (this._isArrayStringSettings(key)) {
        if (this._isArrayString(value)) {
          this[key] = value
          return true
        }
        return false
      }
      if (this._isArrayLabelActiveSettings(key)) {
        if (this._isLabelActiveArray(value)) {
          this[key] = value
          return true
        }
        return false
      }
      if (this._isArraySoundSettings(key)) {
        if (this._isArraySound(value)) {
          this[key] = value
          return true
        }
        return false
      }
      return false
    },
    _isBooleanSettings(k: string): k is BooleanSettings {
      return ['muted', 'darkMode', 'allowOverlappingSound', 'invertQuickTags'].includes(k)
    },
    _isNumberSettings(k: string): k is NumberSettings {
      return ['defaultVolume'].includes(k)
    },
    _isArrayStringSettings(k: string): k is ArrayStringSettings {
      return ['outputDevices', 'ptt_hotkey'].includes(k)
    },
    _isArrayString(k: unknown): k is string[] {
      return Array.isArray(k) && (k.length === 0 || typeof k[0] === 'string')
    },
    _isArraySoundSettings(k: string): k is ArraySoundSettings {
      return ['sounds'].includes(k)
    },
    _isArraySound(k: unknown): k is Sound[] {
      return Array.isArray(k) && (k.length === 0 || (typeof k[0] === 'object' && 'id' in k[0]))
    },
    _isArrayLabelActiveSettings(k: string): k is LabelActiveSettings {
      return ['quickTagsAr'].includes(k)
    },
    _isLabelActiveArray(k: unknown): k is LabelActive[] {
      return Array.isArray(k) && (k.length === 0 || (typeof k[0] === 'object' && 'label' in k[0]))
    },
    /**
     * Set the default volume
     * @param volume the volume to set
     * @returns void
     */
    async saveDefaultVolume(volume: number): Promise<void> {
      this.defaultVolume = volume
      const electron = window.electron
      await electron?.saveDBSetting('defaultVolume', volume)
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
      await electron?.saveDBSetting('muted', this.muted)
    },
    /**
     * Fetch all available audio output devices
     * @returns a list of all available audio output devices
     */
    async fetchAllOutputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const devicesFiltered = devices.filter(device => device.kind === 'audiooutput')
      this.allOutputDevices = devicesFiltered
      return devicesFiltered
    },
    async toggleDisplayMode(): Promise<void> {
      this.displayMode = this.displayMode === 'play' ? 'edit' : 'play'
    },
    async setHoveringSound(sound: Sound | null) {
      this.hoveredSound = sound
    },
    async playHoveredSoundSegment(segmentIndex: number) {
      const soundStore = useSoundStore()
      if (this.hoveredSound) {
        const segment = this.hoveredSound.soundSegments?.[segmentIndex] ?? null
        if (segment) {
          soundStore.playSound(this.hoveredSound, null, null, undefined, true, segment)
        } else if (segmentIndex === 0) {
          soundStore.playSound(this.hoveredSound, null, null, undefined, true)
        }
      }
    },
    async saveSoundArray(value: Sound[]): Promise<boolean> {
      const electron = window.electron
      await electron?.saveSoundsArray(_prepareSoundsForStorage(value))
      return true
    },
    async saveSound(sound: Sound): Promise<void> {
      const electron = window.electron
      await electron?.saveSound(_prepareSoundForStorage(sound))
    },
    /**
     * Delete a sound from the database and the local state
     * @param pSound the sound to delete
     */
    async deleteSound(pSound: Sound): Promise<void> {
      this.deleteFile(pSound.audioKey)
      this.deleteFile(pSound.imageKey)
      this.sounds = this.sounds.filter(sound => sound.id !== pSound.id)
      const electron = window.electron
      await electron?.deleteSound(_prepareSoundForStorage(pSound))
    },
    async updateVisibility(visibilityMap: { isVisible: boolean; soundId: string }[]): Promise<void> {
      const electron = window.electron
      await electron?.saveVisibility(visibilityMap)
    },
    /**
     * Fetch an array setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to [{ id: crypto.randomUUID() }]
     * @returns the value of the setting
     */
    async _fetchSoundSetting(
      key: ArraySoundSettings,
      defaultValue: Sound[] = [{ id: crypto.randomUUID() }]
    ): Promise<Sound[]> {
      function isSoundArray(arr: SettingValue | undefined | Sound[]): arr is Sound[] {
        return Array.isArray(arr) && (arr.length === 0 || (typeof arr[0] === 'object' && 'id' in arr[0]))
      }

      const electron = window.electron
      const returnedArray = (await electron?._readSetting?.(key)) ?? null
      if (returnedArray === null || !Array.isArray(returnedArray) || !isSoundArray(returnedArray)) {
        await electron?.saveSoundsArray(toRaw(defaultValue))
        this[key] = defaultValue
        return this[key]
      } else {
        const sounds: Sound[] = returnedArray
        sounds.forEach((sound: Sound) => {
          if (sound.soundSegments !== undefined) {
            sound.soundSegments.forEach(segment => {
              segment.id ??= crypto.randomUUID()
            })
          }
        })
        if (sounds.length < 1 || sounds[sounds.length - 1].title !== undefined) {
          sounds.push({ id: crypto.randomUUID() }) // add a new sound button if there isn't one
        }
        this.sounds = sounds
        this.registerWindowResize()
        this._getImageUrls(this.sounds)
        return this.sounds
      }
    },
    async fetchSounds(): Promise<Sound[]> {
      const electron = window.electron
      const returnedArray = (await electron?.readAllDBSounds()) ?? null
      if (returnedArray === null || returnedArray.length < 1) {
        // try and migrate using the old _fetchSoundSetting
        const migratedSounds = await this._fetchSoundSetting('sounds')
        // if migratedSounds is empty, keep going, otherwise return
        if (migratedSounds.length > 1 || (migratedSounds.length === 1 && migratedSounds[0].title !== undefined)) {
          if (migratedSounds[migratedSounds.length - 1].title !== undefined) {
            migratedSounds.push({ id: crypto.randomUUID() })
          }
          console.log('Migrating sounds')
          await electron?.saveSoundsArray(_prepareSoundsForStorage(migratedSounds))
          this.sounds = migratedSounds
        } else {
          // if there are no sounds, create a new sound button
          const newSounds = [{ id: crypto.randomUUID() }]
          await electron?.saveSoundsArray(_prepareSoundsForStorage(newSounds))
          this.sounds = newSounds
        }
      } else {
        // ensure all segments have an ID
        const processSounds = returnedArray.map<Sound>(sound => ({
          ...sound,
          tags: sound.tags ? JSON.parse(sound.tags as unknown as string) : undefined,
          soundSegments: sound.soundSegments ? JSON.parse(sound.soundSegments) : undefined,
          hotkey: sound.hotkey ? JSON.parse(sound.hotkey) : undefined,
        }))
        // check if the last element has a title, if so add a new sound button
        if (processSounds[processSounds.length - 1].title !== undefined) {
          processSounds.push({ id: crypto.randomUUID() })
        }
        this.sounds = processSounds
      }
      this.sounds.forEach((sound: Sound) => {
        if (sound.soundSegments !== undefined) {
          sound.soundSegments.forEach(segment => {
            segment.id ??= crypto.randomUUID()
          })
        }
      })
      this.registerWindowResize()
      this._getImageUrls(this.sounds)
      return this.sounds
    },
    /** get the duration of an audio file */
    async getAudioDuration(audioUrl: string, audioContext?: AudioContext): Promise<number | undefined> {
      try {
        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()
        let closeAudioContext = false
        if (!audioContext) {
          audioContext = new window.AudioContext()
          closeAudioContext = true
        }
        const duration = (await audioContext.decodeAudioData(arrayBuffer)).duration
        if (closeAudioContext) {
          await audioContext.close()
        }
        return duration
      } catch (error) {
        console.error('Error fetching audio duration:', error)
        return undefined
      }
    },
    /**
     * Lazily get the image URLs  for the visible sounds first, then the hidden sounds.
     * @param sounds[] the array of sounds
     * @returns void
     */
    async _getImageUrls(sounds: Sound[]) {
      const audioContext = new window.AudioContext()
      await this._loadMediaForSounds(
        audioContext,
        sounds.filter(sound => sound.isVisible)
      )
      await this._loadMediaForSounds(
        audioContext,
        sounds.filter(sound => !sound.isVisible)
      )
      await audioContext.close()
    },
    /**
     * Lazily get the image URLs for the given sounds
     * @param sounds[] the array of sounds
     * @param {AudioContext} audioContext - the audio context to use
     * @returns void
     */
    async _loadMediaForSounds(audioContext: AudioContext, sounds: Sound[]) {
      sounds.forEach(async sound => {
        await this._getImageUrl(sound, audioContext)
      })
    },
    async _getImageUrl(sound: Sound, audioContext: AudioContext) {
      if (sound.imageUrl === undefined && sound.imageKey !== undefined) {
        await this.getFile(sound.imageKey).then((imageUrl: string | null) => {
          if (imageUrl) {
            sound.imageUrl = imageUrl
          }
        })
      }
      if (sound?.audioUrl === undefined && sound?.audioKey !== undefined) {
        const audioUrl = await this.getFile(sound.audioKey)
        if (audioUrl) {
          sound.audioUrl = audioUrl
          sound.duration = await this.getAudioDuration(audioUrl, audioContext)
        }
      } else {
        sound.duration = await this.getAudioDuration(sound?.audioUrl ?? chordAlert, audioContext)
      }
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
     * this requires the sounds to be loaded first
     * @returns void
     */
    async registerHotkeys(): Promise<void> {
      const soundStore = useSoundStore()
      const electron = window.electron
      const hotkeys: string[][] = []
      // add hotkeys for digit0 through digit9 and numpad0 through numpad9
      for (let i = 0; i <= 9; i++) {
        if (!hotkeys.some(keys => arraysAreEqual(keys, [`Digit${i}`]))) {
          hotkeys.push([`Digit${i}`])
        }
      }
      for (let i = 0; i <= 9; i++) {
        if (!hotkeys.some(keys => arraysAreEqual(keys, [`Numpad${i}`]))) {
          hotkeys.push([`Numpad${i}`])
        }
      }
      this.sounds
        .filter(sound => sound.hotkey !== undefined)
        .forEach(sound => {
          if (sound.hotkey && !hotkeys.some(keys => arraysAreEqual(sound.hotkey, keys))) {
            hotkeys.push(toRaw(sound.hotkey))
          }
        })

      electron?.registerHotkeys(hotkeys)
      electron?.onKeyPressed(keys => {
        this.sounds
          .filter(sound => arraysAreEqual(sound.hotkey, keys))
          .forEach(sound => soundStore.playSound(sound, null, null, undefined, true))
        if (keys.length === 1 && (keys[0].startsWith('Digit') || keys[0].startsWith('Numpad'))) {
          const soundNumber = parseInt(keys[0].replace('Digit', '').replace('Numpad', ''), 10)
          if (!Number.isNaN(soundNumber)) {
            this.playHoveredSoundSegment(soundNumber === 0 ? 9 : soundNumber - 1)
          }
        }
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
      electron?.unregisterHotkeys([toRaw(keys)])
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
      electron?.addHotkeys([keys])
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
      const key = crypto.randomUUID()
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
     * Fetch the quick tags from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set
     * @returns the value of the setting
     */
    async fetchFilters(key: QuickTagButtonSettings, defaultValue: LabelActive[] = []): Promise<LabelActive[]> {
      function isLabelArray(arr: unknown[]): arr is LabelActive[] {
        return arr.length === 0 || typeof arr[0] === 'object'
      }

      const electron = window.electron
      const returnedArray = await electron?.readDBSetting(key)
      if (returnedArray === undefined || !Array.isArray(returnedArray)) {
        await electron?.saveDBSetting(key, defaultValue)
        this[key] = defaultValue
        return this[key]
      } else if (isLabelArray(returnedArray)) {
        this[key] = returnedArray
        return this[key]
      } else {
        console.error('Invalid array format for key:', key, returnedArray)
        return defaultValue
      }
    },
    /** add quickTags */
    async addQuickTags(tags: string[]): Promise<void> {
      // add the tags to the quickTags array if they don't already exist
      const tagsAr = tags.map(tag => ({ label: tag, active: false }))
      this.quickTagsAr ??= []
      // add all the elements from tags that aren't already in quickTagsAr
      this.quickTagsAr = this.quickTagsAr.concat(
        tagsAr.filter(tag => !this.quickTagsAr?.some(t => t.label === tag.label))
      )
      const electron = window.electron
      await electron?.saveDBSetting(
        'quickTagsAr',
        this.quickTagsAr.map(t => toRaw(t))
      )
    },
    /** remove a quickTag */
    async removeQuickTag(index: number): Promise<void> {
      if (this.quickTagsAr === undefined) return
      this.quickTagsAr.splice(index, 1)
      const electron = window.electron
      await electron?.saveDBSetting(
        'quickTagsAr',
        this.quickTagsAr.map(t => toRaw(t))
      )
    },
    /** set the quickTags */
    async setQuickTags(tags: LabelActive[]): Promise<void> {
      this.quickTagsAr = tags
      const electron = window.electron
      await electron?.saveDBSetting(
        'quickTagsAr',
        this.quickTagsAr.map(t => toRaw(t))
      )
    },
    /** toggle the quickTag */
    async toggleQuickTag(tagLabel: string): Promise<void> {
      if (this.quickTagsAr === undefined) return
      const tag = this.quickTagsAr.find(t => t.label === tagLabel)
      if (tag) {
        tag.active = !tag.active
        if (tag.negated) {
          delete tag.negated
        }
        const electron = window.electron
        await electron?.saveDBSetting(
          'quickTagsAr',
          this.quickTagsAr.map(t => toRaw(t))
        )
      }
    },
    /** toggle the invertQuickTags */
    async toggleInvertQuickTags(): Promise<void> {
      this.invertQuickTags = !this.invertQuickTags
      const electron = window.electron
      await electron?.saveDBSetting('invertQuickTags', this.invertQuickTags)
    },
    async toggleQuickTagNegated(tag: LabelActive): Promise<void> {
      if (this.quickTagsAr === undefined) return
      const existingTag = this.quickTagsAr.find(t => t.label === tag.label)
      if (existingTag) {
        tag.active = false
        if (existingTag.negated) {
          delete existingTag.negated
        } else {
          existingTag.negated = true
        }
        const electron = window.electron
        await electron?.saveDBSetting(
          'quickTagsAr',
          this.quickTagsAr.map(t => toRaw(t))
        )
      }
    },
  },
})

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

/**
 * Prepares sound objects for database storage and IPC transmission.
 *
 * This function:
 * - Removes volatile properties (audioUrl, segment IDs)
 * - Stringifies JSON properties for SQLite storage
 * - Serializes objects to ensure they can be cloned for IPC transmission
 *
 * @param pSounds - Array of sound objects to prepare
 * @returns Array of serialized sound objects ready for database storage
 */
function _prepareSoundsForStorage(pSounds: Sound[]): SoundForSaving[] {
  return pSounds.map<SoundForSaving>((sound: Sound) => _prepareSoundForStorage(sound))
}

/**
 * Prepares a sound object for database storage and IPC transmission.
 * This function:
 * - Removes volatile properties (audioUrl, segment IDs)
 * - Stringifies JSON properties for SQLite storage
 * - Serializes objects to ensure they can be cloned for IPC transmission
 * @param sound the sound to prepare
 * @returns the prepared sound object
 */
function _prepareSoundForStorage(sound: Sound): SoundForSaving {
  return toRaw({
    id: sound.id,
    title: sound.title,
    hideTitle: sound.hideTitle ? JSON.stringify(sound.hideTitle) : undefined,
    tags: sound.tags ? JSON.stringify(sound.tags) : undefined,
    hotkey: sound.hotkey ? JSON.stringify(sound.hotkey) : undefined,
    audioKey: sound.audioKey,
    imageKey: sound.imageKey,
    volume: sound.volume,
    color: sound.color,
    soundSegments: sound.soundSegments ? JSON.stringify(_stripSegmentIds(sound.soundSegments)) : undefined,
    isVisible: sound.isVisible ? JSON.stringify(sound.isVisible) : undefined,
  })
}

function _stripSegmentIds(pSegments: SoundSegment[] | undefined) {
  if (!pSegments) return undefined
  return pSegments?.map(segment => {
    return {
      start: segment.start,
      end: segment.end,
    }
  })
}
