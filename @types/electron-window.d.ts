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
  readSetting: (key: string) => Promise<string>
  saveSetting: (key: string, value: string) => Promise<void>
}

declare global {
  interface Window {
    electron: Settings & Versions
  }
}
