export interface Versions {
  versions: {
    chrome: string;
    electron: string;
    node: string;
    platform: string;
    vue: string;
    pinia: string;
  };
}

declare global {
  interface Window {
    electron: Versions;
  }
}
