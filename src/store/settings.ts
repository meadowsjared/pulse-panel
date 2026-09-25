import { defineStore } from 'pinia'
import {
  LabelActive,
  OutputDeviceSetting,
  Sound,
  SoundForSaving,
  SoundSegment,
  SoundSegmentForSaving,
} from '../@types/sound'
import { openDB, IDBPDatabase } from 'idb'
import { useSoundStore } from './sound'
import { usePulseBackStore } from './pulseBack'
import { Settings, SettingValue, Versions } from '../@types/electron-window'
import { toRaw } from 'vue'
import { searchSounds } from '../utils/soundSearch'
import { audioMixer } from '../services/audioMixer'
import { pulseBackBuffer } from '../services/pulseBackBuffer'

declare global {
  interface Window {
    electron?: Settings & Versions
  }
}

interface State {
  defaultVolume: number
  outputDevices: OutputDeviceSetting[]
  darkMode: boolean
  closeToTray: boolean
  startWithWindows: boolean
  allowOverlappingSound: boolean
  sounds: Sound[]
  muted: boolean
  ptt_hotkey: string[]
  stop_hotkey: string[]
  quickTagsAr?: LabelActive[]
  invertQuickTags: boolean
  selectedMicrophoneId: string | null
  microphoneVolume: number
  microphoneMuted: boolean
  cableOutputVolume: number
  pulse_back_enabled: boolean
  pulse_back_hotkey: string[]
  pulse_back_default_duration: number
  pulse_back_buffer_length: number
  pulse_back_input_device: string | null
  pulse_back_volume: number
  pulse_back_muted: boolean
  pulse_back_sync_offset_ms: number
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
   * List of all available input devices (microphones)
   *
   * **VOLATILE**
   */
  allInputDevices: MediaDeviceInfo[]
  /**
   * Device ID of the detected virtual cable output
   *
   * **VOLATILE**
   */
  virtualCableDeviceId: string | null
  /**
   * Whether the virtual audio cable driver is installed on the system
   *
   * **VOLATILE**
   */
  virtualCableInstalled: boolean
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
  /**
   * Whether the sound editor is currently opened
   * **VOLATILE**
   */
  soundEditorOpen: boolean
  /**
   * The saved window size [width, height]
   * **VOLATILE**
   */
  windowSize: number[]
  /**
   * Currently copied sound image for reuse across buttons
   * **VOLATILE**
   */
  copiedSoundImage: { imageKey: string; imageUrl?: string } | null
  /**
   * Map of tag names to their assigned image keys
   */
  tagImages: Record<string, string>
  /**
   * Volatile cache of blob URLs for tag images
   * **VOLATILE**
   */
  tagImageUrls: Record<string, string>
}

interface SoundWithHotkey extends Sound {
  hotkey: string[]
}

const Boolean_Settings_Keys = [
  'darkMode',
  'closeToTray',
  'allowOverlappingSound',
  'invertQuickTags',
  'muted',
  'microphoneMuted',
  'startWithWindows',
  'pulse_back_enabled',
  'pulse_back_muted',
] as const
type BooleanSettings = (typeof Boolean_Settings_Keys)[number]

const String_Settings_Keys = ['selectedMicrophoneId', 'pulse_back_input_device'] as const
type StringSettings = (typeof String_Settings_Keys)[number]

const Array_String_Settings_Keys = ['ptt_hotkey', 'stop_hotkey', 'pulse_back_hotkey'] as const
const Array_Number_Settings_Keys = ['windowSize'] as const
const Array_OutputDevice_Settings_Keys = ['outputDevices'] as const
type ArrayOutputDeviceSettings = (typeof Array_OutputDevice_Settings_Keys)[number]
type ArrayNumberSettings = (typeof Array_Number_Settings_Keys)[number]
type ArrayStringSettings = (typeof Array_String_Settings_Keys)[number]
const Array_Sound_Settings_Keys = ['sounds'] as const
type ArraySoundSettings = (typeof Array_Sound_Settings_Keys)[number]
const Number_Settings_Keys = [
  'defaultVolume',
  'microphoneVolume',
  'cableOutputVolume',
  'pulse_back_default_duration',
  'pulse_back_buffer_length',
  'pulse_back_volume',
  'pulse_back_sync_offset_ms',
] as const
type NumberSettings = (typeof Number_Settings_Keys)[number]
const Label_Active_Settings_Keys = ['quickTagsAr'] as const
type LabelActiveSettings = (typeof Label_Active_Settings_Keys)[number]
type SettingsOnlyKeys =
  | BooleanSettings
  | StringSettings
  | NumberSettings
  | ArrayNumberSettings
  | ArrayStringSettings
  | ArrayOutputDeviceSettings
  | LabelActiveSettings

const All_Settings_Keys = [
  ...Boolean_Settings_Keys,
  ...String_Settings_Keys,
  ...Array_String_Settings_Keys,
  ...Array_Number_Settings_Keys,
  ...Array_OutputDevice_Settings_Keys,
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

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(dbStoreName)) {
          db.createObjectStore(dbStoreName)
        }
      },
    })
  }
  return dbPromise
}

const blobUrlCache = new Map<string, string>()

export interface SettingsStore extends ReturnType<typeof useSettingsStore> {}

function isVirtualCableOutput(label: string): boolean {
  const l = label.toLowerCase()
  if (l.includes('voicemeeter')) return false
  if (l.includes('cable output')) return false
  if (l.includes('16ch')) return false
  return l.includes('cable input') || (l.includes('cable') && l.includes('input'))
}

function isVirtualCableInput(label: string): boolean {
  const l = label.toLowerCase()
  if (l.includes('voicemeeter')) return false
  if (l.includes('cable input')) return false
  if (l.includes('16ch')) return false
  return l.includes('cable output') || (l.includes('cable') && l.includes('output'))
}

async function convertBlobOrUrlToPng(
  blob: Blob | null,
  url: string | undefined
): Promise<{ dataUrl: string; buffer: ArrayBuffer } | null> {
  let createdUrl = false
  let src = url
  if (!src && blob) {
    src = URL.createObjectURL(blob)
    createdUrl = true
  }
  if (!src) return null

  return new Promise(resolve => {
    const img = new Image()
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          if (createdUrl && src) URL.revokeObjectURL(src)
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        const dataUrl = canvas.toDataURL('image/png')
        canvas.toBlob(async pngBlob => {
          if (createdUrl && src) URL.revokeObjectURL(src)
          if (!pngBlob) {
            resolve({ dataUrl, buffer: new ArrayBuffer(0) })
            return
          }
          const buffer = await pngBlob.arrayBuffer()
          resolve({ dataUrl, buffer })
        }, 'image/png')
      } catch (err) {
        if (createdUrl && src) URL.revokeObjectURL(src)
        console.warn('[Pulse Panel] Failed canvas PNG conversion:', err)
        resolve(null)
      }
    }
    img.onerror = err => {
      if (createdUrl && src) URL.revokeObjectURL(src)
      console.warn('[Pulse Panel] Failed loading image for canvas conversion:', err)
      resolve(null)
    }
    img.src = src
  })
}

function arePixelDataIdentical(data1: Uint8ClampedArray, data2: Uint8ClampedArray): boolean {
  if (data1.length !== data2.length) return false
  const totalPixels = data1.length / 4
  if (totalPixels === 0) return true

  let totalDiff = 0
  let significantDiffCount = 0

  for (let i = 0; i < data1.length; i += 4) {
    const a1 = data1[i + 3]
    const a2 = data2[i + 3]

    // If both pixels are completely transparent, their RGB values don't matter visually
    if (a1 === 0 && a2 === 0) {
      continue
    }

    const diffA = Math.abs(a1 - a2)
    const diffR = Math.abs(data1[i] - data2[i])
    const diffG = Math.abs(data1[i + 1] - data2[i + 1])
    const diffB = Math.abs(data1[i + 2] - data2[i + 2])

    // Weight RGB difference by alpha (if almost transparent, minor RGB differences are invisible)
    const maxAlpha = Math.max(a1, a2) / 255
    const weightedDiff = (diffR + diffG + diffB) * maxAlpha + diffA

    totalDiff += weightedDiff

    // Significant diff: perceptible color difference (> 12 on visible pixel or > 12 on alpha)
    if (diffA > 12 || (maxAlpha > 0.1 && (diffR > 12 || diffG > 12 || diffB > 12))) {
      significantDiffCount++
    }
  }

  // Average channel diff per pixel (0 - 255)
  const avgDiff = totalDiff / (totalPixels * 4)

  // Two images are identical if:
  // 1. Average difference is very low (<= 4 channel intensity)
  // 2. Significant per-pixel differences account for less than 1.5% of pixels
  return avgDiff <= 4 && significantDiffCount <= totalPixels * 0.015
}

async function getImagePixels(
  source: string | Blob
): Promise<{ width: number; height: number; pixels: Uint8ClampedArray } | null> {
  // Attempt decoding via createImageBitmap first (direct GPU/compositor decode, no CORS issues with blob URLs)
  try {
    let bitmap: ImageBitmap | null = null
    if (source instanceof Blob) {
      bitmap = await createImageBitmap(source)
    } else if (typeof source === 'string') {
      try {
        const res = await fetch(source)
        const blob = await res.blob()
        bitmap = await createImageBitmap(blob)
      } catch {
        // proceed to HTMLImageElement fallback below
      }
    }

    if (bitmap) {
      const width = bitmap.width
      const height = bitmap.height
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        bitmap.close()
        return null
      }
      ctx.drawImage(bitmap, 0, 0)
      const pixels = ctx.getImageData(0, 0, width, height).data
      bitmap.close()
      return { width, height, pixels }
    }
  } catch {
    // proceed to HTMLImageElement fallback
  }

  // Fallback to HTMLImageElement
  return new Promise(resolve => {
    const img = new Image()
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const isCreatedUrl = typeof source !== 'string'

    // Note: Never set crossOrigin for blob: or data: URLs, as it triggers CORS network errors in Chromium
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width
        const height = img.naturalHeight || img.height
        if (!width || !height) {
          if (isCreatedUrl) URL.revokeObjectURL(url)
          resolve(null)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          if (isCreatedUrl) URL.revokeObjectURL(url)
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0)
        const pixels = ctx.getImageData(0, 0, width, height).data
        if (isCreatedUrl) URL.revokeObjectURL(url)
        resolve({ width, height, pixels })
      } catch {
        if (isCreatedUrl) URL.revokeObjectURL(url)
        resolve(null)
      }
    }
    img.onerror = () => {
      if (isCreatedUrl) URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    appName: 'Pulse Panel',
    defaultVolume: NaN,
    windowIsMaximized: false,
    outputDevices: [],
    allOutputDevices: [],
    darkMode: true,
    closeToTray: false,
    startWithWindows: false,
    allowOverlappingSound: false,
    sounds: [],
    displayMode: 'play',
    currentEditingSound: null,
    soundEditorOpen: false,
    hoveredSound: null,
    muted: false,
    recordingHotkey: false,
    ptt_hotkey: [],
    stop_hotkey: ['MediaStop'],
    searchText: '',
    quickTagsAr: [],
    invertQuickTags: false,
    windowSize: [],
    selectedMicrophoneId: null,
    microphoneVolume: 1,
    microphoneMuted: false,
    cableOutputVolume: 1,
    pulse_back_enabled: false,
    pulse_back_hotkey: ['F12'],
    pulse_back_default_duration: 30,
    pulse_back_buffer_length: 120,
    pulse_back_input_device: null,
    pulse_back_volume: 1,
    pulse_back_muted: false,
    pulse_back_sync_offset_ms: 100,
    allInputDevices: [],
    virtualCableDeviceId: null,
    virtualCableInstalled: false,
    copiedSoundImage: null,
    tagImages: {},
    tagImageUrls: {},
  }),
  getters: {
    quickTags(): LabelActive[] {
      return this.quickTagsAr ?? []
    },
    totalSounds(): number {
      return this.sounds.filter(sound => sound && sound.title !== undefined && !sound.isDragPreview).length
    },
  },
  actions: {
    soundsFiltered(params?: SliceParams): Sound[] {
      const activeOrNegatedTags = this.quickTagsAr?.filter(tag => tag.active === true || tag.negated === true) ?? []
      const tagFilteredSounds = this.sounds.filter(sound => {
        if (activeOrNegatedTags.length === 0) {
          if (this.invertQuickTags) {
            return sound.tags === undefined || sound.tags.length === 0
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
              (anTag.negated && sound.tags.includes(anTag.label)),
          )
        const normalMatch =
          activeOrNegatedTags.length === 0 ||
          activeOrNegatedTags.every(
            anTag =>
              (anTag.active && sound.tags?.includes(anTag.label) === true) ||
              (anTag.negated && !sound.tags?.includes(anTag.label)),
          )
        return this.invertQuickTags ? invertedMatch : normalMatch
      })

      const finalFiltered = searchSounds(tagFilteredSounds, this.searchText)

      if (params !== undefined) {
        return finalFiltered.slice(params.start, params.end)
      }
      return finalFiltered
    },
    _assignValidatedSetting(key: SettingsOnlyKeys, value: SettingValue) {
      if (this._isBooleanSettings(key) && typeof value === 'boolean') return (this[key] = value)
      else if (this._isNumberSettings(key) && typeof value === 'number') return (this[key] = value)
      else if (this._isArrayNumberSettings(key) && this._isArrayNumber(value)) return (this[key] = value)
      else if (this._isArrayOutputDeviceSettings(key) && this._isArrayOutputDevice(value)) {
        return (this[key] = value.map(item =>
          typeof item === 'string'
            ? { deviceId: item, volume: 1 }
            : { deviceId: item.deviceId, volume: typeof item.volume === 'number' ? item.volume : 1 }
        ))
      }
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
        ...String_Settings_Keys,
        ...Array_String_Settings_Keys,
        ...Array_Number_Settings_Keys,
        ...Array_OutputDevice_Settings_Keys,
        ...Number_Settings_Keys,
        ...Label_Active_Settings_Keys,
      ] as const
      const settings = await electron?.readAllDBSettings()
      // transfer all the properties from settings to the local state
      if (settings) Object.assign(this, toRaw(settings))
      if (settings?.tagImages && typeof settings.tagImages === 'object') {
        this.tagImages = settings.tagImages as Record<string, string>
      } else {
        const savedTagImages = await electron?.readDBSetting('tagImages')
        if (savedTagImages && typeof savedTagImages === 'object' && !Array.isArray(savedTagImages)) {
          this.tagImages = savedTagImages as Record<string, string>
        }
      }
      this._loadTagImageUrls().catch(() => {})
      if (typeof this.microphoneVolume !== 'number' || Number.isNaN(this.microphoneVolume)) {
        this.microphoneVolume = 1
      }
      if (typeof this.cableOutputVolume !== 'number' || Number.isNaN(this.cableOutputVolume)) {
        this.cableOutputVolume = 1
      }
      this.microphoneMuted = !!this.microphoneMuted
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
          }),
        )
        // if any old settings were found, migrate them to the new store
        if (oldSettingsExist) {
          await Promise.all(
            AllSettings.map(async key => {
              // transfer the setting to the new store
              if (this._isBooleanSettings(key) && typeof this[key] === 'boolean')
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isStringSettings(key) && typeof this[key] === 'string')
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isNumberSettings(key) && typeof this[key] === 'number')
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isArrayNumberSettings(key) && this._isArrayNumber(this[key]))
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isArrayOutputDeviceSettings(key) && this._isArrayOutputDevice(this[key]))
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isArrayStringSettings(key) && this._isArrayString(this[key]))
                await this.saveSetting(key, toRaw(this[key]))
              else if (this._isArrayLabelActiveSettings(key) && this._isLabelActiveArray(this[key]))
                await this.saveSetting(key, toRaw(this[key]))
            }),
          )
        }
      }
      electron?.setCloseToTray(this.closeToTray)
      electron?.onCloseToTrayChanged(value => {
        this.saveSetting('closeToTray', value)
      })
      if (typeof this.startWithWindows === 'boolean') {
        electron?.setOpenAtLogin(this.startWithWindows)?.catch(err => {
          console.warn('Failed to set login item settings:', err)
        })
      }
      const outputDevicesConfigured =
        settings !== undefined &&
        typeof settings === 'object' &&
        'outputDevices' in settings &&
        (settings as Record<string, unknown>).outputDevices !== undefined

      if (!outputDevicesConfigured && this.outputDevices.length === 0) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput')
        const defaultValue: OutputDeviceSetting[] = [
          { deviceId: audioOutputDevices.length > 0 ? audioOutputDevices[0].deviceId : 'default', volume: 1 }
        ]
        await electron?.saveDBSetting('outputDevices', defaultValue)
        this.outputDevices = defaultValue
      } else {
        this.outputDevices = this.outputDevices.map(item =>
          typeof item === 'string'
            ? { deviceId: item, volume: 1 }
            : { deviceId: item.deviceId, volume: typeof item.volume === 'number' ? item.volume : 1 }
        )
      }
      if (this.outputDevices.length > 0) {
        soundStore.populatePlayingAudio(this.outputDevices.length)
      }
      await this.fetchAllOutputDevices()
      await this.fetchAllInputDevices()
      await audioMixer.setup(
        this.selectedMicrophoneId,
        typeof this.microphoneVolume === 'number' ? this.microphoneVolume : 1,
        !!this.microphoneMuted,
        this.virtualCableDeviceId,
        this.muted ? 0 : this.cableOutputVolume
      )
      if (!this.virtualCableDeviceId) {
        await this.fetchAllOutputDevices()
        await this.fetchAllInputDevices()
        if (this.virtualCableDeviceId) {
          await audioMixer.setCableOutput(this.virtualCableDeviceId)
        }
      }
      try {
        const pulseBackStore = usePulseBackStore()
        if (pulseBackStore.isBufferRunning) {
          pulseBackStore.startBuffer(this.selectedMicrophoneId, this.pulse_back_input_device)
        }
      } catch {}
    },
    /**
     * Save an array setting to the store
     * @param key the key it's saved under
     * @param value the value to save
     * @returns true if saved successfully
     */
    async saveSetting(key: AllSettings, value: SettingValue): Promise<boolean> {
      const electron = window.electron
      const cloneableValue = toCloneable(value)
      // if the key is a member of BooleanSettings, ensure the value is a boolean
      await electron?.saveDBSetting(key, cloneableValue)
      if (this._isBooleanSettings(key)) {
        if (typeof value === 'boolean') {
          this[key] = value
          if (key === 'microphoneMuted') {
            audioMixer.setMicrophoneMuted(this.microphoneMuted)
          }
          if (key === 'pulse_back_muted') {
            pulseBackBuffer.setVolume(this.pulse_back_muted ? 0 : (this.pulse_back_volume ?? 1))
          }
          if (key === 'startWithWindows') {
            electron?.setOpenAtLogin(this.startWithWindows)?.catch(err => {
              console.warn('Failed to set login item settings:', err)
            })
          }
          return true
        }
        return false
      }
      if (this._isStringSettings(key)) {
        if (typeof value === 'string' || value === null) {
          (this as any)[key] = value
          if (key === 'selectedMicrophoneId') {
            audioMixer.setMicrophone(this.selectedMicrophoneId)
            try {
              const pulseBackStore = usePulseBackStore()
              if (pulseBackStore.isBufferRunning) {
                pulseBackStore.startBuffer(this.selectedMicrophoneId, this.pulse_back_input_device)
              }
            } catch {}
          } else if (key === 'pulse_back_input_device') {
            try {
              const pulseBackStore = usePulseBackStore()
              if (pulseBackStore.isBufferRunning) {
                pulseBackStore.startBuffer(this.selectedMicrophoneId, this.pulse_back_input_device)
              }
            } catch {}
          }
          return true
        }
        return false
      }
      if (this._isNumberSettings(key)) {
        if (typeof value === 'number') {
          this[key] = value
          if (key === 'microphoneVolume') {
            audioMixer.setMicrophoneVolume(this.microphoneVolume)
            pulseBackBuffer.setMicVolume(this.microphoneVolume ?? 1)
          } else if (key === 'cableOutputVolume') {
            audioMixer.setSoundboardVolume(this.muted ? 0 : this.cableOutputVolume)
          } else if (key === 'pulse_back_volume') {
            pulseBackBuffer.setVolume(this.pulse_back_muted ? 0 : (this.pulse_back_volume ?? 1))
          }
          return true
        }
        return false
      }
      if (this._isArrayNumberSettings(key)) {
        if (this._isArrayNumber(value)) {
          this[key] = value
          return true
        }
        return false
      }
      if (this._isArrayOutputDeviceSettings(key)) {
        if (this._isArrayOutputDevice(value)) {
          this[key] = value.map(item =>
            typeof item === 'string'
              ? { deviceId: item, volume: 1 }
              : { deviceId: item.deviceId, volume: typeof item.volume === 'number' ? item.volume : 1 }
          )
          return true
        }
        return false
      }
      if (this._isArrayStringSettings(key)) {
        if ((key === 'stop_hotkey' || key === 'ptt_hotkey' || key === 'pulse_back_hotkey') && this._isArrayString(value)) {
          if (value.length === 0) {
            const prevHotkey = toRaw(this[key])
            electron?.unregisterHotkeys([prevHotkey])
          } else {
            electron?.addHotkeys([toCloneable(value)])
          }
        }
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
      return (Boolean_Settings_Keys as readonly string[]).includes(k)
    },
    _isStringSettings(k: string): k is StringSettings {
      return (String_Settings_Keys as readonly string[]).includes(k)
    },
    _isNumberSettings(k: string): k is NumberSettings {
      return (Number_Settings_Keys as readonly string[]).includes(k)
    },
    _isArrayStringSettings(k: string): k is ArrayStringSettings {
      return ['ptt_hotkey', 'stop_hotkey', 'pulse_back_hotkey'].includes(k)
    },
    _isArrayNumberSettings(k: string): k is ArrayNumberSettings {
      return ['windowSize'].includes(k)
    },
    _isArrayOutputDeviceSettings(k: string): k is ArrayOutputDeviceSettings {
      return ['outputDevices'].includes(k)
    },
    _isArrayOutputDevice(k: unknown): k is (OutputDeviceSetting | string)[] {
      return (
        Array.isArray(k) &&
        (k.length === 0 ||
          typeof k[0] === 'string' ||
          (typeof k[0] === 'object' && k[0] !== null && 'deviceId' in k[0]))
      )
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
    _isArrayNumber(k: unknown): k is number[] {
      return Array.isArray(k) && (k.length === 0 || typeof k[0] === 'number')
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
     * Get the volume for a specific output device (defaults to 1)
     */
    getDeviceVolume(index: number): number {
      const vol = this.outputDevices[index]?.volume
      if (typeof vol === 'number' && !Number.isNaN(vol)) {
        return vol
      }
      return 1
    },
    /**
     * Update volume live in state and notify sound store
     */
    setDeviceVolumeLive(index: number, volume: number): void {
      if (this.outputDevices[index]) {
        this.outputDevices[index].volume = volume
        const soundStore = useSoundStore()
        soundStore.updateDeviceVolume(index)
      }
    },
    /**
     * Persist outputDevices to the database
     */
    async saveOutputDevices(): Promise<void> {
      const electron = window.electron
      await electron?.saveDBSetting(
        'outputDevices',
        toCloneable(this.outputDevices)
      )
    },
    /**
     * Toggle the mute state
     * @returns void
     */
    async toggleMute(): Promise<void> {
      this.muted = !this.muted
      audioMixer.setSoundboardVolume(this.muted ? 0 : this.cableOutputVolume)
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
     * Fetch all available audio output devices and detect the virtual audio cable
     * @returns a list of available physical audio output devices
     */
    async fetchAllOutputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const allOutputs = devices.filter(device => device.kind === 'audiooutput')

      // Detect virtual cable output endpoint (strictly CABLE Input, excluding Voicemeeter)
      const cableDevice = allOutputs.find(d => isVirtualCableOutput(d.label))
      if (cableDevice) {
        this.virtualCableDeviceId = cableDevice.deviceId
        this.virtualCableInstalled = true
        audioMixer.setCableOutput(this.virtualCableDeviceId)
      } else {
        this.virtualCableDeviceId = null
        const installedViaIPC = await window.electron?.checkVirtualCableInstalled().catch(() => false)
        this.virtualCableInstalled = !!installedViaIPC
      }

      // Filter out only the virtual cable from user-visible playback device list
      // Voicemeeter outputs (e.g. "VoiceMeeter Input") remain visible and usable for monitoring
      const physicalOutputs = allOutputs.filter(device => !isVirtualCableOutput(device.label))
      this.allOutputDevices = physicalOutputs
      return physicalOutputs
    },
    /**
     * Fetch all available microphone input devices
     * @returns a list of available microphone input devices
     */
    async fetchAllInputDevices(): Promise<MediaDeviceInfo[]> {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const allInputs = devices.filter(device => device.kind === 'audioinput')

      // Filter out only the virtual cable output endpoint, preserving Voicemeeter mics
      const physicalInputs = allInputs.filter(device => !isVirtualCableInput(device.label))
      this.allInputDevices = physicalInputs.length > 0 ? physicalInputs : allInputs
      if (!this.selectedMicrophoneId && this.allInputDevices.length > 0) {
        this.selectedMicrophoneId = this.allInputDevices[0].deviceId
        await this.saveSetting('selectedMicrophoneId', this.selectedMicrophoneId)
      }
      return this.allInputDevices
    },
    /**
     * Check if the virtual audio cable driver is installed on the system
     */
    async checkVirtualCableStatus(): Promise<boolean> {
      const installed = await window.electron?.checkVirtualCableInstalled().catch(() => false)
      this.virtualCableInstalled = !!installed
      return this.virtualCableInstalled
    },
    /**
     * Save the selected microphone device ID
     */
    async saveMicrophoneDevice(deviceId: string): Promise<boolean> {
      return this.saveSetting('selectedMicrophoneId', deviceId)
    },
    /**
     * Save the microphone volume (0 to 1)
     */
    async saveMicrophoneVolume(volume: number): Promise<boolean> {
      return this.saveSetting('microphoneVolume', volume)
    },
    /**
     * Save the cable output volume (0 to 1)
     */
    async saveCableOutputVolume(volume: number): Promise<boolean> {
      return this.saveSetting('cableOutputVolume', volume)
    },
    /**
     * Toggle the microphone muted state
     */
    async toggleMicrophoneMute(): Promise<boolean> {
      return this.saveSetting('microphoneMuted', !this.microphoneMuted)
    },
    /**
     * Toggle the Pulse Back muted state
     */
    async togglePulseBackMute(): Promise<boolean> {
      return this.saveSetting('pulse_back_muted', !this.pulse_back_muted)
    },
    /**
     * Save the Pulse Back input device ID
     */
    async savePulseBackInputDevice(deviceId: string | null): Promise<boolean> {
      this.pulse_back_input_device = deviceId
      return this.saveSetting('pulse_back_input_device', deviceId ?? '')
    },
    /**
     * Save the Pulse Back volume (0 to 1)
     */
    async savePulseBackVolume(volume: number): Promise<boolean> {
      this.pulse_back_volume = volume
      return this.saveSetting('pulse_back_volume', volume)
    },
    /**
     * Save the Pulse Back playhead audio sync offset in milliseconds (0 to 500ms)
     */
    async savePulseBackSyncOffset(offsetMs: number): Promise<boolean> {
      const clamped = Math.max(0, Math.min(2500, Math.round(offsetMs)))
      this.pulse_back_sync_offset_ms = clamped
      return this.saveSetting('pulse_back_sync_offset_ms', clamped)
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
    async saveSound(sound: Sound): Promise<void> {
      const electron = window.electron
      await electron?.saveSound(_prepareSoundForStorage(sound))
    },
    /**
     * Insert new sounds into the sound list, and saves them to the database
     * @param beforeIndex the index to insert the sounds before
     * @param newSounds the sounds to insert
     */
    async insertSounds(beforeIndex: number, ...newSounds: Sound[]): Promise<void> {
      this.sounds.splice(this.sounds.length - 1, 0, ...newSounds)
      const electron = window.electron
      await electron?.insertSounds(beforeIndex, ..._prepareSoundsForStorage(newSounds))
    },
    /**
     * Move a sound to a new order_index in the database
     * @param pSound the sound to move
     * @param newIndex the index to move it to
     * note: the highest order_index can be is length - 2, because the last sound is always the "new sound" button
     */
    async moveSound(prevIndex: number, newIndex: number): Promise<void> {
      if (prevIndex === -1 || newIndex < 0 || newIndex > this.sounds.length - 2) {
        console.log('Invalid moveSound indices', prevIndex, newIndex)
        return
      }
      const electron = window.electron
      await electron?.moveSound(prevIndex, newIndex)
    },
    /**
     * Delete a sound from the database and the local state
     * @param pSound the sound to delete
     */
    async deleteSound(pSound: Sound): Promise<void> {
      this.sounds = this.sounds.filter(sound => sound.id !== pSound.id)
      await this.deleteFile(pSound.audioKey, pSound.id)
      await this.deleteFile(pSound.imageKey, pSound.id)
      const electron = window.electron
      await electron?.deleteSound(_prepareSoundForStorage(pSound))
    },
    async updateVisibility(visibilityMap: { isVisible: boolean; soundId: string }[]): Promise<void> {
      const electron = window.electron
      await electron?.saveVisibility(toCloneable(visibilityMap))
    },
    /**
     * Fetch an array setting from the store
     * @param key the key it's saved under
     * @param defaultValue the default value if it's not set, default to [{ id: crypto.randomUUID() }]
     * @returns the value of the setting
     */
    async _fetchSoundSetting(
      key: ArraySoundSettings,
      defaultValue: Sound[] = [{ id: crypto.randomUUID() }],
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
      this._getImageUrls(this.sounds).then(() => {
        this.deduplicateExistingImages().catch(() => {})
      }).catch(() => {})
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
     * Ensure a single sound's image and audio URLs are loaded on demand.
     */
    async ensureSoundLoaded(sound: Sound) {
      if (sound.imageKey && !sound.imageUrl) {
        const imageUrl = await this.getFile(sound.imageKey)
        if (imageUrl) sound.imageUrl = imageUrl
      }
      if (sound.audioKey && !sound.audioUrl) {
        const audioUrl = await this.getFile(sound.audioKey)
        if (audioUrl) {
          sound.audioUrl = audioUrl
          if (sound.duration === undefined) {
            sound.duration = await this.getAudioDuration(audioUrl)
          }
        }
      }
    },
    /**
     * Lazily get the image URLs for all sounds with an imageKey.
     * @param sounds[] the array of sounds
     * @returns void
     */
    async _getImageUrls(sounds: Sound[]) {
      const soundsWithImages = sounds.filter(sound => sound.imageKey && sound.imageUrl === undefined)
      await Promise.all(
        soundsWithImages.map(async sound => {
          if (sound.imageKey) {
            const imageUrl = await this.getFile(sound.imageKey)
            if (imageUrl) {
              sound.imageUrl = imageUrl
            }
          }
        }),
      )
    },
    /**
     * Restore active editing sound if one was open before window reload
     */
    _restoreEditingSoundState(): void {
      try {
        const savedEditingId = sessionStorage.getItem('activeEditingSoundId')
        if (savedEditingId) {
          const foundSound = this.sounds.find(s => s.id === savedEditingId)
          if (foundSound) {
            this.currentEditingSound = foundSound
            this.soundEditorOpen = true
          } else {
            sessionStorage.removeItem('activeEditingSoundId')
          }
        }
      } catch (_) {}
    },
    /**
     * This function listens for windowResize events and sets the windowIsMaximized state
     * @param isMaximized the state of the window
     * @returns void
     */
    registerWindowResize(): void {
      this._restoreEditingSoundState()
      const electron = window.electron
      electron?.onWindowResized((isMaximized, width, height) => {
        this.windowIsMaximized = isMaximized
        this._saveWindowSize(width, height)
      })
      electron?.requestMainWindowSized() // request the current to initialize the windowIsMaximized state
    },
    /**
     * Save the window size to the database, adjusting width if sound editor is open
     * @param width the current window width
     * @param height the current window height
     */
    _saveWindowSize(width: number, height: number): void {
      if (this.soundEditorOpen) {
        width = width - 300 // adjust width to account for sound editor
      }
      if (this.windowSize[0] === width && this.windowSize[1] === height) {
        return // no change
      }
      this.saveSetting('windowSize', [width, height])
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
      // register the stop_hotkey
      if (this.stop_hotkey.length > 0 && !hotkeys.some(keys => arraysAreEqual(this.stop_hotkey, keys))) {
        hotkeys.push(toRaw(this.stop_hotkey))
      }
      // register the pulse_back_hotkey
      if (this.pulse_back_hotkey && this.pulse_back_hotkey.length > 0 && !hotkeys.some(keys => arraysAreEqual(this.pulse_back_hotkey, keys))) {
        hotkeys.push(toRaw(this.pulse_back_hotkey))
      }

      electron?.registerHotkeys(hotkeys)
      electron?.onKeyPressed(keys => {
        this.sounds
          .filter(sound => arraysAreEqual(sound.hotkey, keys))
          .forEach(sound => soundStore.playSound(sound, null, null, undefined, true))
        // check if the stop_hotkey was pressed
        if (arraysAreEqual(this.stop_hotkey, keys)) {
          soundStore.stopAllSounds()
        }
        // check if the pulse_back_hotkey was pressed
        if (this.pulse_back_hotkey && arraysAreEqual(this.pulse_back_hotkey, keys)) {
          const pulseBackStore = usePulseBackStore()
          pulseBackStore.triggerQuickClip(this.pulse_back_default_duration)
        }
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
    removeSoundHotkey(pSound: Sound, keys: string[]) {
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
    addSoundHotkey(sound: Sound, keys: string[] | undefined) {
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
     * Get raw blob from IndexedDB by key
     */
    async getFileBlob(key: string): Promise<Blob | null> {
      if (!key) return null
      try {
        const db = await getDB()
        return (await db.get(dbStoreName, key)) ?? null
      } catch {
        return null
      }
    },
    /**
     * Copy an image to the system clipboard (for Paint.net, Discord, etc.)
     * and store its imageKey/metadata for quick reuse across buttons and tags
     */
    async copySoundImage(imageKey: string, imageUrl?: string): Promise<void> {
      let resolvedUrl = imageUrl
      if (!resolvedUrl) {
        resolvedUrl = (await this.getFile(imageKey)) ?? undefined
      }
      this.copiedSoundImage = { imageKey, imageUrl: resolvedUrl }

      try {
        const electron = window.electron
        if (electron?.writeImageToClipboard) {
          let blob = await this.getFileBlob(imageKey)
          if (!blob && resolvedUrl) {
            try {
              const res = await fetch(resolvedUrl)
              blob = await res.blob()
            } catch (fetchErr) {
              console.warn('[Pulse Panel] Failed to fetch image blob from resolvedUrl:', fetchErr)
            }
          }

          const pngData = await convertBlobOrUrlToPng(blob, resolvedUrl)
          if (pngData) {
            await electron.writeImageToClipboard({
              buffer: pngData.buffer,
              dataUrl: pngData.dataUrl,
              imageKey,
              imageUrl: resolvedUrl,
            })
          } else {
            console.warn('[Pulse Panel] Could not convert image to PNG for clipboard:', imageKey)
          }
        }
      } catch (err) {
        console.warn('Error copying image to OS clipboard:', err)
      }
    },
    /**
     * Checks if there is an image available on the system clipboard or in-memory state
     */
    async hasClipboardImage(): Promise<boolean> {
      try {
        const electron = window.electron
        if (electron?.hasImageInClipboard) {
          const hasImage = await electron.hasImageInClipboard()
          if (!hasImage) {
            // The OS clipboard has no image, so any in-memory copied image is stale!
            this.copiedSoundImage = null
            return false
          }
          return true
        }
      } catch (err) {
        console.warn('Error checking clipboard image:', err)
      }
      return !!this.copiedSoundImage?.imageKey
    },
    /**
     * Reads image from OS clipboard:
     * - If copied within Pulse Panel, restores the exact imageKey and imageUrl without re-encoding
     * - If copied from an external app (Paint.net, browser, screenshot), saves and deduplicates it in DB
     */
    async readClipboardImage(): Promise<{ imageKey: string; imageUrl?: string; isReused: boolean } | null> {
      try {
        const electron = window.electron
        if (electron?.readImageFromClipboard) {
          const res = await electron.readImageFromClipboard()
          if (res) {
            if (res.imageKey) {
              let url = res.imageUrl ?? undefined
              if (!url) {
                url = (await this.getFile(res.imageKey)) ?? undefined
              }
              this.copiedSoundImage = { imageKey: res.imageKey, imageUrl: url }
              // console.log('[Pulse Panel] Pasted image (reused key):', res.imageKey)
              return { imageKey: res.imageKey, imageUrl: url, isReused: true }
            }
            if (res.buffer || res.dataUrl) {
              const blob = res.buffer
                ? new Blob([res.buffer as any], { type: 'image/png' })
                : null
              const blobUrl = blob ? URL.createObjectURL(blob) : null
              const targetSource = blob || res.dataUrl!

              // Check if this clipboard image visually matches any existing image already in use or stored in DB!
              const matchedKey = await this.findMatchingImageKey(targetSource)
              if (matchedKey) {
                if (blobUrl) URL.revokeObjectURL(blobUrl)
                let matchedUrl = (await this.getFile(matchedKey)) ?? undefined
                this.copiedSoundImage = { imageKey: matchedKey, imageUrl: matchedUrl }
                return { imageKey: matchedKey, imageUrl: matchedUrl, isReused: true }
              }

              let file: File
              if (blob) {
                file = new File([blob], 'pasted-image.png', { type: 'image/png' })
              } else {
                const resFetch = await fetch(res.dataUrl!)
                const fetchedBlob = await resFetch.blob()
                file = new File([fetchedBlob], 'pasted-image.png', { type: 'image/png' })
              }
              const saved = await this.saveFile(file)
              if (blobUrl) URL.revokeObjectURL(blobUrl)
              this.copiedSoundImage = { imageKey: saved.fileKey, imageUrl: saved.fileUrl }
              return { imageKey: saved.fileKey, imageUrl: saved.fileUrl, isReused: !saved.isNew }
            }
          }
        }
      } catch (err) {
        console.warn('Error reading from OS clipboard:', err)
      }

      if (this.copiedSoundImage?.imageKey) {
        // console.log('[Pulse Panel] Pasted image (reused in-memory key):', this.copiedSoundImage.imageKey)
        return { ...this.copiedSoundImage, isReused: true }
      }
      return null
    },
    /**
     * Checks if a target image visually matches any existing sound, tag, or stored image
     */
    async findMatchingImageKey(targetSource: string | Blob): Promise<string | null> {
      const target = await getImagePixels(targetSource)
      if (!target) return null

      const uniqueKeys = new Set<string>()
      if (this.copiedSoundImage?.imageKey) {
        uniqueKeys.add(this.copiedSoundImage.imageKey)
      }
      if (this.currentEditingSound?.imageKey) {
        uniqueKeys.add(this.currentEditingSound.imageKey)
      }
      this.sounds.forEach(s => {
        if (s.imageKey) uniqueKeys.add(s.imageKey)
      })
      Object.values(this.tagImages ?? {}).forEach(k => {
        if (k) uniqueKeys.add(k)
      })

      try {
        const db = await getDB()
        const allKeys = await db.getAllKeys(dbStoreName)
        for (const k of allKeys) {
          if (typeof k === 'string' && k.startsWith('img_')) {
            uniqueKeys.add(k)
          }
        }
      } catch {
        // ignore
      }

      for (const key of uniqueKeys) {
        const url = await this.getFile(key)
        if (!url) continue
        const candidate = await getImagePixels(url)
        if (!candidate) continue
        if (candidate.width !== target.width || candidate.height !== target.height) {
          continue
        }
        if (arePixelDataIdentical(target.pixels, candidate.pixels)) {
          // console.log('[Pulse Panel] Visual image match found for key:', key)
          return key
        }
      }
      return null
    },
    /**
     * Check if a file key is still referenced by any sound on the soundboard or tag image
     */
    isFileUsed(key: string | undefined, excludeSoundId?: string): boolean {
      if (!key) return false
      const usedBySound = this.sounds.some(sound => {
        if (excludeSoundId && sound.id === excludeSoundId) return false
        return sound.imageKey === key || sound.audioKey === key
      })
      if (usedBySound) return true
      return Object.values(this.tagImages ?? {}).some(imageKey => imageKey === key)
    },
    /**
     * Get the loaded blob URL for a tag's assigned image
     */
    getTagImageUrl(tag: string | undefined): string | undefined {
      if (!tag) return undefined
      const normTag = tag.trim().toLowerCase()
      return this.tagImageUrls?.[normTag]
    },
    /**
     * Get the stored imageKey for a tag's assigned image
     */
    getTagImageKey(tag: string | undefined): string | undefined {
      if (!tag) return undefined
      const normTag = tag.trim().toLowerCase()
      return this.tagImages?.[normTag]
    },
    /**
     * Get the inherited tag image URL for a sound if any of its tags has an image assigned
     */
    getSoundTagImageUrl(sound: Sound | undefined): string | undefined {
      if (!sound?.tags || sound.tags.length === 0) return undefined
      for (const tag of sound.tags) {
        const url = this.getTagImageUrl(tag)
        if (url) return url
      }
      return undefined
    },
    /**
     * Get the name of the tag providing the fallback image for a sound
     */
    getSoundTagImageTag(sound: Sound | undefined): string | undefined {
      if (!sound?.tags || sound.tags.length === 0) return undefined
      for (const tag of sound.tags) {
        const key = this.getTagImageKey(tag)
        if (key) return tag
      }
      return undefined
    },
    /**
     * Assign an imageKey to a tag
     */
    async setTagImage(tag: string, imageKey: string, imageUrl?: string): Promise<void> {
      if (!tag || !imageKey) return
      const normTag = tag.trim().toLowerCase()
      this.tagImages ??= {}
      this.tagImageUrls ??= {}
      this.tagImages[normTag] = imageKey
      if (imageUrl) {
        this.tagImageUrls[normTag] = imageUrl
      } else {
        const loadedUrl = await this.getFile(imageKey)
        if (loadedUrl) this.tagImageUrls[normTag] = loadedUrl
      }
      await this.saveTagImages()
    },
    /**
     * Remove an image from a tag
     */
    async removeTagImage(tag: string): Promise<void> {
      if (!tag) return
      const normTag = tag.trim().toLowerCase()
      if (!this.tagImages?.[normTag]) return
      const oldKey = this.tagImages[normTag]
      delete this.tagImages[normTag]
      delete this.tagImageUrls[normTag]
      await this.saveTagImages()
      if (oldKey) {
        await this.deleteFile(oldKey)
      }
    },
    async saveTagImages(): Promise<void> {
      const electron = window.electron
      await electron?.saveDBSetting('tagImages', toRaw(this.tagImages))
    },
    async _loadTagImageUrls(): Promise<void> {
      if (!this.tagImages) return
      this.tagImageUrls ??= {}
      const entries = Object.entries(this.tagImages)
      await Promise.all(
        entries.map(async ([tag, imageKey]) => {
          if (imageKey) {
            const url = await this.getFile(imageKey)
            if (url) {
              this.tagImageUrls[tag] = url
            }
          }
        })
      )
    },
    /**
     * Save a sound or image file to the store with content-addressable deduplication.
     * @param file the file to save
     */
    async saveFile(file: File): Promise<{ fileUrl: string; fileKey: string; isNew: boolean }> {
      const db = await getDB()
      let key: string
      let isNew = false
      try {
        const buffer = await file.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        key = `${file.type.startsWith('image/') ? 'img' : 'file'}_${hashHex}`
        const existing = await db.get(dbStoreName, key)
        if (!existing) {
          isNew = true
          await db.put(dbStoreName, file, key)
        }
      } catch {
        key = crypto.randomUUID()
        isNew = true
        await db.put(dbStoreName, file, key)
      }
      let fileUrl = blobUrlCache.get(key)
      if (!fileUrl) {
        fileUrl = URL.createObjectURL(file)
        blobUrlCache.set(key, fileUrl)
      }
      return { fileUrl, fileKey: key, isNew }
    },
    /**
     * Fetch a sound from the store
     * @param key the key it's saved under
     * @returns the value of the URL to the file
     */
    async getFile(key: string): Promise<string | null> {
      if (!key) return null
      if (blobUrlCache.has(key)) {
        return blobUrlCache.get(key)!
      }
      try {
        const db = await getDB()
        const file = await db.get(dbStoreName, key)
        if (file) {
          const fileUrl = URL.createObjectURL(file)
          blobUrlCache.set(key, fileUrl)
          return fileUrl
        }
      } catch (error) {
        console.warn('Error fetching file from IndexedDB:', error)
      }
      return null
    },
    /**
     * Delete a sound or image from the store only if no other sound references it
     * @param path the key it's saved under
     * @param excludeSoundId optional sound ID to exclude from reference check
     */
    async deleteFile(path: string | undefined, excludeSoundId?: string): Promise<void> {
      if (path === undefined) return
      if (this.isFileUsed(path, excludeSoundId)) {
        return
      }
      blobUrlCache.delete(path)
      try {
        const db = await getDB()
        await db.delete(dbStoreName, path)
      } catch (error) {
        console.warn('Error deleting file from IndexedDB:', error)
      }
    },
    async replaceFile(oldPath: string | undefined, newFile: File, excludeSoundId?: string): Promise<{ fileUrl: string; fileKey: string }> {
      if (oldPath) {
        await this.deleteFile(oldPath, excludeSoundId)
      }
      return this.saveFile(newFile)
    },
    /**
     * Retroactively deduplicate existing images stored in IndexedDB.
     * Consolidates redundant copies of the same image to a single key and cleans up orphaned DB records.
     */
    async deduplicateExistingImages(): Promise<number> {
      try {
        const db = await getDB()
        const soundsWithImages = this.sounds.filter(s => !!s.imageKey && !!s.title)
        if (soundsWithImages.length <= 1) return 0

        const hashToCanonical = new Map<string, string>()
        let deduplicatedCount = 0

        for (const sound of soundsWithImages) {
          const currentKey = sound.imageKey!
          const file = await db.get(dbStoreName, currentKey)
          if (!file) continue

          let hashHex: string
          try {
            const buffer = await file.arrayBuffer()
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          } catch {
            continue
          }

          if (!hashToCanonical.has(hashHex)) {
            hashToCanonical.set(hashHex, currentKey)
          } else {
            const canonicalKey = hashToCanonical.get(hashHex)!
            if (canonicalKey !== currentKey) {
              sound.imageKey = canonicalKey
              if (blobUrlCache.has(canonicalKey)) {
                sound.imageUrl = blobUrlCache.get(canonicalKey)
              }
              await this.saveSound(sound)

              // Check if old key is still used by other sounds
              const stillUsed = this.sounds.some(s => s.imageKey === currentKey && s.id !== sound.id)
              if (!stillUsed) {
                blobUrlCache.delete(currentKey)
                await db.delete(dbStoreName, currentKey)
                deduplicatedCount++
              }
            }
          }
        }
        // if (deduplicatedCount > 0) {
        //   console.log(`[Pulse Panel] Successfully deduplicated ${deduplicatedCount} duplicate image(s).`)
        // }
        return deduplicatedCount
      } catch (err) {
        console.warn('Error during image deduplication:', err)
        return 0
      }
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
        await electron?.saveDBSetting(key, toCloneable(defaultValue))
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
        tagsAr.filter(tag => !this.quickTagsAr?.some(t => t.label === tag.label)),
      )
      const electron = window.electron
      await electron?.saveDBSetting(
        'quickTagsAr',
        this.quickTagsAr.map(t => toRaw(t)),
      )
    },
    /** remove a quickTag */
    async removeQuickTag(index: number): Promise<void> {
      if (this.quickTagsAr === undefined) return
      this.quickTagsAr.splice(index, 1)
      const electron = window.electron
      await electron?.saveDBSetting(
        'quickTagsAr',
        this.quickTagsAr.map(t => toRaw(t)),
      )
    },
    /** set the quickTags */
    async setQuickTags(tags: LabelActive[]): Promise<void> {
      this.quickTagsAr = tags
      const electron = window.electron
      await electron?.saveDBSetting(
        'quickTagsAr',
        this.quickTagsAr.map(t => toRaw(t)),
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
          this.quickTagsAr.map(t => toRaw(t)),
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
          this.quickTagsAr.map(t => toRaw(t)),
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
    const result: SoundSegmentForSaving = {
      start: segment.start,
      end: segment.end,
    }
    if (segment.label !== undefined) {
      result.label = segment.label
    }
    return result
  })
}

/**
 * Unwraps Vue reactive proxies and clones objects/arrays to plain JS values for IPC serialization.
 */
function toCloneable<T>(val: T): T {
  if (typeof val === 'object' && val !== null) {
    return JSON.parse(JSON.stringify(toRaw(val)))
  }
  return val
}
