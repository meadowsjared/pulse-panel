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

export interface Settings {
  readSetting: (key: string) => Promise<string | boolean | number | string[] | undefined>
  saveSetting: (key: string, value: string | boolean | number | string[]) => Promise<boolean>
  deleteSetting: (key: string) => Promise<boolean>
  sendKey: (key: string[], down: boolean) => Promise<void>
  toggleDarkMode: (value: boolean) => void
  onDarkModeToggle: (callback: (value: boolean) => void) => void
  addHotkeys: (hotkeys: string[][]) => void
  registerHotkeys: (hotkeys: string[]) => void
  unregisterHotkeys: (hotkeys: string[]) => void
  onKeyPressed: (callback: (key: string[]) => void) => void
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeRestoreWindow: () => void
  onWindowResized: (callback: (windowIsMaximized: boolean) => void) => void
  requestMainWindowSized: () => void
  openExternalLink: (url: string) => void
  downloadVBCable: (appName: string) => Promise<vbCableResult>
}

declare global {
  interface Window {
    electron?: Settings & Versions
  }
}
