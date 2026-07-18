interface Window {
  wisadelUpdater?: {
    download: () => Promise<void>;
    install: () => Promise<void>;
    onEvent: (callback: (event: { type: string; version?: string; notes?: string; percent?: number; message?: string }) => void) => () => void;
  };
  wisadelDesktop?: {
    openImageStudio: () => Promise<void>;
  };
}
