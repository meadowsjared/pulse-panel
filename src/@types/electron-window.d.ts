import { Sound, SoundForLoading, SoundForSaving, LabelActive, OutputDeviceSetting } from './sound'
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

export type SettingValue =
  | string
  | boolean
  | number
  | string[]
  | number[]
  | LabelActive[]
  | OutputDeviceSetting[]

export interface UpdateDownloadProgress {
  receivedBytes: number
  totalBytes: number
  percent: number
}

export interface Settings {
  _readSetting: (key: string) => Promise<SettingValue | undefined | Sound[]>
  sendKey: (key: string[], down: boolean) => Promise<void>
  toggleDarkMode: (value: boolean) => void
  onDarkModeToggle: (callback: (value: boolean) => void) => void
  registerHotkeys: (hotkeys: string[][]) => void
  addHotkeys: (hotkeys: string[][]) => void
  unregisterHotkeys: (hotkeys: string[][]) => void
  onKeyPressed: (callback: (key: string[]) => void) => void
  setCloseToTray: (value: boolean) => void
  onCloseToTrayChanged: (callback: (value: boolean) => void) => void
  setOpenAtLogin: (openAtLogin: boolean) => Promise<void>
  getOpenAtLogin: () => Promise<boolean>
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeRestoreWindow: () => void
  onWindowResized: (callback: (windowIsMaximized: boolean, width: number, height: number) => void) => void
  requestMainWindowSized: () => void
  expandWindow: (widthChange: number, heightChange: number) => Promise<void>
  openExternalLink: (url: string) => void
  downloadVBCable: (appName: string) => Promise<vbCableResult>
  checkVirtualCableInstalled: () => Promise<boolean>
  downloadAndInstallUpdate: (downloadUrl: string) => Promise<void>
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => void
  saveFileDialog?: (
    defaultName: string,
    buffer: ArrayBuffer,
    filters?: Array<{ name: string; extensions: string[] }>
  ) => Promise<boolean>
  // Database related functions
  readAllDBSettings: () => Promise<{ [settingName: string]: string }[]>
  saveDBSetting: (settingName: string, settingValue: SettingValue) => Promise<boolean>
  readDBSetting: (settingName: string) => Promise<SettingValue | null>
  deleteDBSetting: (settingName: string) => Promise<void>
  readAllDBSounds: () => Promise<SoundForLoading[]>
  saveSound: (sound: SoundForSaving, orderIndex?: number) => Promise<void>
  saveSoundProperty: (sound: Sound, propertyName: string) => Promise<void>
  insertSounds: (beforeIndex: number, ...newSounds: SoundForSaving[]) => Promise<void>
  moveSound: (prevIndex: number, newIndex: number) => Promise<void>
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
