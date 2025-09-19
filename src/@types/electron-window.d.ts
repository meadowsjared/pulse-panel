import { Sound, SoundForLoading, SoundForSaving, LabelActive } from './sound'
export interface Versions {
  versions: {
    app: string
    chrome: string
    electron: string
    node: string
    platform: string
    vue: string
    pinia: string
  }
}

interface vbCableResult {
  vbCableAlreadyInstalled?: boolean
  vbCableInstallerRan?: boolean
  messages?: string[]
  errors?: Error[]
}

export type SettingValue = string | boolean | number | string[] | LabelActive[]

export interface Settings {
  _readSetting: (key: string) => Promise<SettingValue | undefined | Sound[]>
  sendKey: (key: string[], down: boolean) => Promise<void>
  toggleDarkMode: (value: boolean) => void
  onDarkModeToggle: (callback: (value: boolean) => void) => void
  registerHotkeys: (hotkeys: string[][]) => void
  addHotkeys: (hotkeys: string[][]) => void
  unregisterHotkeys: (hotkeys: string[][]) => void
  onKeyPressed: (callback: (key: string[]) => void) => void
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeRestoreWindow: () => void
  onWindowResized: (callback: (windowIsMaximized: boolean) => void) => void
  requestMainWindowSized: () => void
  openExternalLink: (url: string) => void
  downloadVBCable: (appName: string) => Promise<vbCableResult>
  // Database related functions
  readAllDBSettings: () => Promise<{ [settingName: string]: string }[]>
  saveDBSetting: (settingName: string, settingValue: SettingValue) => Promise<boolean>
  readDBSetting: (settingName: string) => Promise<SettingValue | null>
  deleteDBSetting: (settingName: string) => Promise<void>
  readAllDBSounds: () => Promise<SoundForLoading[]>
  saveSound: (sound: SoundForSaving, orderIndex?: number) => Promise<void>
  saveSoundProperty: (sound: Sound, propertyName: string) => Promise<void>
  reorderSound: (soundId: Sound, newIndex: number) => Promise<void>
  deleteSoundProperty: (sound: Sound, propertyName: string) => Promise<void>
  deleteSound: (sound: SoundForSaving) => Promise<void>
  saveSoundsArray: (sounds: SoundForSaving[] | Sound[]) => Promise<void>
  saveVisibility: (visibilityChanges: { isVisible: boolean; soundId: string }[]) => Promise<void>
}

declare global {
  interface Window {
    electron?: Settings & Versions
  }
}
