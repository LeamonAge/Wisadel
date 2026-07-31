import { app, BrowserWindow, desktopCapturer, dialog, ipcMain, Menu, nativeImage, safeStorage, shell, Tray } from 'electron';
import { autoUpdater } from 'electron-updater';
import { appendFileSync, promises as fs, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

let mainWindow: BrowserWindow | null = null;
let imageStudioWindow: BrowserWindow | null = null;
let lastUpdateEvent: object | null = null;
let tray: Tray | null = null;
let quitting = false;
const hasSingleInstanceLock = app.requestSingleInstanceLock();
const alwaysApproved = new Set<string>();
const LOCAL_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.env']);
const LOCAL_TEXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.cs', '.json', '.md', '.css', '.html', '.yml', '.yaml', '.toml']);
const LOCAL_SECRET = /(^|[\\/])(\.env(?:\..*)?|\.npmrc|\.pypirc|id_rsa|id_ed25519|credentials|secrets?)([\\/]|$)/i;
const LOCAL_PROGRAMS = new Set(['node', 'node.exe', 'npm', 'npm.cmd', 'npx', 'npx.cmd', 'python', 'python.exe', 'pytest', 'git', 'git.exe', 'cargo', 'cargo.exe', 'go', 'go.exe']);

const agentPath = (workspace: string, relativePath: string) => {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error('必须使用工作区相对路径');
  const root = path.resolve(workspace); const target = path.resolve(root, relativePath); const rel = path.relative(root, target);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || LOCAL_SECRET.test(rel)) throw new Error('路径不在工作区内或属于敏感文件');
  return target;
};
const approveLocalAction = async (event: Electron.IpcMainInvokeEvent, workspace: string, scope: 'write' | 'command', title: string, detail: string) => {
  const key = `${path.resolve(workspace).toLowerCase()}|${scope}`;
  if (alwaysApproved.has(key)) return;
  const window = BrowserWindow.fromWebContents(event.sender);
  const options = { type: 'warning' as const, buttons: ['拒绝', '允许一次', '本工作区始终允许'], defaultId: 0, cancelId: 0, title, message: 'Wisadel Agent 请求本机操作', detail };
  const answer = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
  if (answer.response === 2) { alwaysApproved.add(key); return; }
  if (answer.response !== 1) throw new Error('用户拒绝本机 Agent 操作');
};

const localWorkspaceContext = async (input: string) => {
  const root = path.resolve(input);
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error('所选路径不是目录');
  const tree: Array<{ path: string; kind: 'file' | 'directory' }> = [];
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > 3 || tree.length >= 600) return;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (LOCAL_IGNORE.has(entry.name)) continue;
      const full = path.resolve(directory, entry.name);
      const relativePath = path.relative(root, full);
      if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) continue;
      tree.push({ path: relativePath, kind: entry.isDirectory() ? 'directory' : 'file' });
      if (entry.isDirectory()) await walk(full, depth + 1);
      if (tree.length >= 600) return;
    }
  };
  await walk(root, 0);
  const rootEntries = new Set((await fs.readdir(root)).map((name) => name.toLowerCase()));
  const suggestedCommands: string[] = [];
  if (rootEntries.has('package.json')) { try { const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')); suggestedCommands.push(...Object.keys(pkg.scripts ?? {}).slice(0, 12).map((name) => `npm run ${name}`)); } catch { /* malformed manifest */ } }
  if (rootEntries.has('pyproject.toml') || rootEntries.has('pytest.ini')) suggestedCommands.push('pytest');
  if (rootEntries.has('cargo.toml')) suggestedCommands.push('cargo test');
  if (rootEntries.has('go.mod')) suggestedCommands.push('go test ./...');
  const languages = [...new Set(tree.filter((item) => item.kind === 'file').map((item) => path.extname(item.path).slice(1)).filter((item) => LOCAL_TEXT.has(`.${item}`)))].slice(0, 12);
  const git = await new Promise<{ branch: string; status: string }>((resolveResult) => {
    const child = spawn('git', ['status', '--short', '--branch'], { cwd: root, windowsHide: true }); let output = '';
    child.stdout.on('data', (chunk) => output += chunk.toString());
    child.on('close', () => { const lines = output.trim().split(/\r?\n/).filter(Boolean); resolveResult({ branch: lines.shift()?.replace(/^##\s*/, '') ?? 'not-a-git-repository', status: lines.join('\n') }); });
    child.on('error', () => resolveResult({ branch: 'not-a-git-repository', status: '' }));
  });
  return { root, tree, project: { languages, suggestedCommands }, git };
};
const updateWindowChrome = (window: BrowserWindow | null, theme: 'dark' | 'light', chromeColor?: string) => {
  // Window controls are now rendered by React so they inherit the full UI palette.
  void window; void theme; void chromeColor;
};

const showWindow = () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
};

const createTray = () => {
  const icon = nativeImage.createFromPath(path.join(process.resourcesPath, 'Wisadel.ico'));
  tray = new Tray(icon);
  tray.setToolTip('Wisadel');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Wisadel', click: showWindow },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
};

const sendUpdate = (payload: object) => {
  lastUpdateEvent = payload;
  try {
    appendFileSync(path.join(app.getPath('userData'), 'updater.log'), `${new Date().toISOString()} ${JSON.stringify(payload)}\n`);
  } catch {
    // Updating must continue even when the diagnostic log cannot be written.
  }
  mainWindow?.webContents.send('wisadel:update', payload);
};

const clearUpdaterCache = () => {
  const cacheDirectory = path.join(process.env.LOCALAPPDATA ?? app.getPath('appData'), `${app.getName()}-updater`);
  rmSync(cacheDirectory, { recursive: true, force: true, maxRetries: 2 });
};

const configureAutoUpdate = () => {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => sendUpdate({ type: 'available', version: info.version, notes: info.releaseNotes ?? '' }));
  autoUpdater.on('download-progress', (progress) => sendUpdate({ type: 'progress', percent: progress.percent }));
  autoUpdater.on('update-downloaded', (info) => sendUpdate({ type: 'downloaded', version: info.version }));
  autoUpdater.on('error', (error) => sendUpdate({ type: 'error', message: error.message }));
  void autoUpdater.checkForUpdates();
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#120b0b',
    frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.once('did-finish-load', () => {
    if (lastUpdateEvent) setTimeout(() => mainWindow?.webContents.send('wisadel:update', lastUpdateEvent!), 500);
  });
  mainWindow.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  if (!app.isPackaged) void mainWindow.loadURL('http://localhost:5173');
  else void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
};

const openImageStudio = () => {
  if (imageStudioWindow && !imageStudioWindow.isDestroyed()) {
    if (imageStudioWindow.isMinimized()) imageStudioWindow.restore();
    imageStudioWindow.focus();
    return;
  }
  imageStudioWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#120b0b',
    title: 'Stable Diffusion AI · Wisadel',
    frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  imageStudioWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  imageStudioWindow.on('closed', () => { imageStudioWindow = null; });
  if (!app.isPackaged) void imageStudioWindow.loadURL('http://localhost:5173/?workspace=image');
  else void imageStudioWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query: { workspace: 'image' } });
};

if (!hasSingleInstanceLock) {
  app.quit();
} else app.whenReady().then(() => {
  ipcMain.handle('wisadel:window-control', (event, action: 'minimize' | 'maximize' | 'close') => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    if (action === 'minimize') window.minimize();
    if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === 'close') window.close();
    return window.isMaximized();
  });
  ipcMain.handle('wisadel:set-provider-secret', (_event, providerId: string, secret: string) => {
    if (!/^[a-z0-9-]{20,}$/i.test(providerId) || !secret || secret.length > 4096) throw new Error('Invalid provider secret');
    const encrypted = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(secret).toString('base64') : secret;
    writeFileSync(path.join(app.getPath('userData'), `provider-secret-${providerId}.dat`), encrypted, { mode: 0o600 });
  });
  ipcMain.handle('wisadel:set-theme', (_event, theme: 'dark' | 'light', chromeColor?: string) => {
    updateWindowChrome(mainWindow, theme, /^#[0-9a-f]{6}$/i.test(chromeColor ?? '') ? chromeColor : undefined);
    updateWindowChrome(imageStudioWindow, theme, /^#[0-9a-f]{6}$/i.test(chromeColor ?? '') ? chromeColor : undefined);
  });
  ipcMain.handle('wisadel:update:download', async () => {
    try {
      // A failed NSIS download can leave an old installer in this cache and make every retry fail.
      clearUpdaterCache();
      await autoUpdater.downloadUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendUpdate({ type: 'error', message });
      throw error;
    }
  });
  ipcMain.handle('wisadel:update:install', async () => {
    try {
      quitting = true;
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      quitting = false;
      const message = error instanceof Error ? error.message : String(error);
      sendUpdate({ type: 'error', message });
      throw error;
    }
  });
  ipcMain.handle('wisadel:open-image-studio', openImageStudio);
  ipcMain.handle('wisadel:capture-screen', async () => {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    const source = sources[0];
    if (!source || source.thumbnail.isEmpty()) throw new Error('无法获取当前屏幕截图');
    return source.thumbnail.toDataURL();
  });
  ipcMain.handle('wisadel:choose-workspace', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options = { title: '选择本机工程目录', properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('wisadel:workspace-context', (_event, workspacePath: string) => localWorkspaceContext(workspacePath));
  ipcMain.handle('wisadel:agent-read-file', async (_event, workspacePath: string, relativePath: string) => {
    const target = agentPath(workspacePath, relativePath);
    if (!LOCAL_TEXT.has(path.extname(target).toLowerCase()) || (await fs.stat(target)).size > 512_000) throw new Error('仅可读取小于 512KB 的文本/代码文件');
    return fs.readFile(target, 'utf8');
  });
  ipcMain.handle('wisadel:agent-write-file', async (event, workspacePath: string, relativePath: string, content: string) => {
    const target = agentPath(workspacePath, relativePath);
    if (!LOCAL_TEXT.has(path.extname(target).toLowerCase()) || Buffer.byteLength(content, 'utf8') > 512_000) throw new Error('仅可写入小于 512KB 的文本/代码文件');
    await approveLocalAction(event, workspacePath, 'write', '写入本机文件', `${relativePath}\n${Buffer.byteLength(content, 'utf8')} bytes`);
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, 'utf8'); return { path: relativePath, bytes: Buffer.byteLength(content, 'utf8') };
  });
  ipcMain.handle('wisadel:agent-run-command', async (event, workspacePath: string, program: string, args: string[] = []) => {
    if (!LOCAL_PROGRAMS.has(program.toLowerCase()) || args.length > 64 || args.some((arg) => typeof arg !== 'string' || arg.length > 2000)) throw new Error('程序或参数不在允许范围内');
    const root = path.resolve(workspacePath); await approveLocalAction(event, workspacePath, 'command', '运行本机命令', `${program} ${args.join(' ')}`.slice(0, 1600));
    return new Promise<{ code: number; output: string }>((resolveResult, reject) => { const child = spawn(program, args, { cwd: root, windowsHide: true, shell: false, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key))) }); let output = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('命令超过 120 秒，已终止')); }, 120_000); child.stdout.on('data', (chunk) => output = (output + chunk).slice(-40_000)); child.stderr.on('data', (chunk) => output = (output + chunk).slice(-40_000)); child.on('error', (error) => { clearTimeout(timer); reject(error); }); child.on('close', (code) => { clearTimeout(timer); resolveResult({ code: code ?? -1, output }); }); });
  });
  createWindow();
  createTray();
  configureAutoUpdate();
  app.on('activate', showWindow);
});

app.on('second-instance', showWindow);

app.on('window-all-closed', () => {
  // The application remains available from the system tray.
});

app.on('before-quit', () => { quitting = true; });
