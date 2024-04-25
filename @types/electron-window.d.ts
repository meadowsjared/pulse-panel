export interface Versions {
  versions: {
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
  toggleDarkMode: (value: boolean) => void
  onDarkModeToggle: (callback: (value: boolean) => void) => void
}

declare global {
  interface Window {
    electron?: Settings & Versions
  }
}
