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

export interface Settings {
  readSetting: (key: string) => Promise<string | boolean | number | undefined>
  saveSetting: (key: string, value: string | boolean | number) => Promise<boolean>
  deleteSetting: (key: string) => Promise<boolean>
  sendKey: (key: string[], down: boolean) => Promise<void>
  toggleDarkMode: (value: boolean) => void
  onDarkModeToggle: (callback: (value: boolean) => void) => void
  registerHotkeys: (hotkeys: string[]) => void
  unregisterHotkeys: (hotkeys: string[]) => void
  onKeyPressed: (callback: (key: string[]) => void) => void
  closeWindow: () => void
  minimizeWindow: () => void
  maximizeRestoreWindow: () => void
  onWindowResized: (callback: (windowIsMaximized: boolean) => void) => void
  requestMainWindowSized: () => void
}

declare global {
  interface Window {
    electron?: Settings & Versions
  }
}
