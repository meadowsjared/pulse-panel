declare global {
  interface Window {
    electron: {
      versions: {
        chrome: string;
        electron: string;
        node: string;
        platform: string;
        vue: string;
        pinia: string;
      };
    };
  }
}

export {}; // This line makes sure the file is treated as a module.
