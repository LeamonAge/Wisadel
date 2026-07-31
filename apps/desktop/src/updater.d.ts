interface Window {
  wisadelUpdater?: {
    download: () => Promise<void>;
    install: () => Promise<void>;
    onEvent: (callback: (event: { type: string; version?: string; notes?: string; percent?: number; message?: string }) => void) => () => void;
  };
  wisadelDesktop?: {
    windowControl: (action: 'minimize' | 'maximize' | 'close') => Promise<boolean>;
    openImageStudio: () => Promise<void>;
    captureScreen: () => Promise<string>;
    chooseWorkspace: () => Promise<string | null>;
    setTheme: (theme: 'dark' | 'light', chromeColor?: string) => Promise<void>;
    setProviderSecret: (providerId: string, secret: string) => Promise<void>;
  };
}
