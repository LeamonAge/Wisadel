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
    workspaceContext: (workspacePath: string) => Promise<{ root: string; tree: Array<{ path: string; kind: 'file' | 'directory' }>; project: { languages: string[]; suggestedCommands: string[] }; git: { branch: string; status: string } }>;
    agentReadFile: (workspacePath: string, relativePath: string) => Promise<string>;
    agentListFiles: (workspacePath: string, relativePath: string, depth: number) => Promise<string>;
    agentSearchFiles: (workspacePath: string, query: string, relativePath: string) => Promise<string>;
    agentWriteFile: (workspacePath: string, relativePath: string, content: string) => Promise<{ path: string; bytes: number }>;
    agentRunCommand: (workspacePath: string, program: string, args: string[]) => Promise<{ code: number; output: string }>;
    setTheme: (theme: 'dark' | 'light', chromeColor?: string) => Promise<void>;
    setProviderSecret: (providerId: string, secret: string) => Promise<void>;
  };
}
