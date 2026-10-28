import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  powerMonitor,
  type IpcMainInvokeEvent,
} from 'electron';
import { join } from 'node:path';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { DocumentError, LegacyGenerationError } from '@newpm/core';
import { DataStore, LegacyImportError, StorageError } from './storage';
import { DesktopService, ServiceError } from './service';
import { OwnedClipboard } from './clipboard';
import type { Result } from '../shared/api';
import { trustedSender } from './ipc-security';
import { configureStoragePaths } from './paths';

// Store normal data beside the packaged EXE; test profiles remain isolated.
const testProfile = app.commandLine.getSwitchValue('newpm-test-profile');
try {
  configureStoragePaths(app, testProfile);
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) app.quit();
  else
    void app
      .whenReady()
      .then(start)
      .catch(() => {
        dialog.showErrorBox(
          '起動に失敗しました',
          'アプリを終了してから再起動してください。',
        );
        app.exit(1);
      });
} catch {
  dialog.showErrorBox(
    '起動に失敗しました',
    '保存先の作成またはテスト用プロファイルの指定を確認してください。',
  );
  app.exit(1);
}

async function start(): Promise<void> {
  const store = new DataStore(app.getPath('userData'));
  const owned = new OwnedClipboard(clipboard);
  const service = new DesktopService(store, owned);
  await service.reload();
  const window = new BrowserWindow({
    icon: app.isPackaged
      ? join(process.resourcesPath, 'icon.ico')
      : join(app.getAppPath(), 'resources/icon.ico'),
    title: testProfile
      ? 'New Password Manager（テスト用）'
      : 'New Password Manager',
    width: 900,
    height: 620,
    minWidth: 540,
    minHeight: 420,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  window.removeMenu();
  window.on('page-title-updated', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  const file = join(__dirname, '../renderer/index.html');
  const expectedUrl =
    !app.isPackaged && process.env.ELECTRON_RENDERER_URL
      ? new URL(process.env.ELECTRON_RENDERER_URL).href
      : pathToFileURL(file).href;
  let closing = false;

  function trusted(event: IpcMainInvokeEvent): boolean {
    return (
      !closing &&
      !window.isDestroyed() &&
      trustedSender(event, window.webContents, expectedUrl)
    );
  }
  function handle<T>(
    name: string,
    operation: (...args: unknown[]) => Promise<T> | T,
  ): void {
    ipcMain.handle(
      `newpm:${name}`,
      async (event, ...args): Promise<Result<T>> => {
        if (!trusted(event)) return { ok: false, error: 'forbidden' };
        try {
          return { ok: true, value: await operation(...args) };
        } catch (error) {
          if (error instanceof LegacyImportError)
            return {
              ok: false,
              error: error.code,
              diagnostics: error.diagnostics,
            };
          if (
            error instanceof StorageError ||
            error instanceof ServiceError ||
            error instanceof DocumentError ||
            error instanceof LegacyGenerationError
          )
            return { ok: false, error: error.code };
          return { ok: false, error: 'operation-failed' };
        }
      },
    );
  }

  handle('loadState', () => service.state());
  handle('reload', () => service.reload());
  handle('generate', (serviceId, saltId, master) =>
    service.generate(serviceId, saltId, master),
  );
  handle('register', async (input) => {
    const state = await service.register(input);
    await dialog
      .showMessageBox(window, {
        type: 'info',
        message: 'サービスを登録しました。',
      })
      .catch(() => {});
    return state;
  });
  let changingSalt = false;
  handle('appendSalt', async (id) => {
    if (typeof id !== 'string') throw new ServiceError('invalid-selection');
    if (changingSalt) throw new ServiceError('operation-in-progress');
    changingSalt = true;
    try {
      const answer = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['キャンセル', '履歴を追加'],
        defaultId: 0,
        cancelId: 0,
        message: '新しいパスワード用の履歴を追加します。',
        detail:
          'サービス側のパスワードは変更されません。以前の履歴は残ります。',
      });
      return answer.response === 1
        ? await service.appendSalt(id)
        : service.state();
    } finally {
      changingSalt = false;
    }
  });
  handle('previewLegacyImport', async () => {
    const selection = await dialog.showOpenDialog(window, {
      title: '旧PC版のdata.txtを選択',
      properties: ['openFile'],
      filters: [{ name: '旧PC設定ファイル', extensions: ['txt'] }],
    });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const handle = await open(selection.filePaths[0], 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024)
        throw new ServiceError('file-too-large');
      const bytes = await handle.readFile();
      if (bytes.length > 10 * 1024 * 1024)
        throw new ServiceError('file-too-large');
      return service.prepareImport(bytes);
    } finally {
      await handle.close();
    }
  });
  handle('commitImport', (token) => service.commitImport(token));
  const timer = setInterval(() => {
    void owned.expire();
  }, 1000);
  powerMonitor.on('resume', () => {
    void owned.expire();
  });
  app.on('second-instance', () => {
    if (!window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  let mayQuit = false;
  app.on('before-quit', (event) => {
    if (mayQuit) return;
    event.preventDefault();
    if (closing) return;
    closing = true;
    clearInterval(timer);
    void service
      .shutdown()
      .then(async () => {
        if (owned.snapshot().state === 'failed')
          await dialog.showMessageBox({
            type: 'error',
            message: 'クリップボードの消去に失敗しました。',
            detail: '必要に応じてOS側でクリップボードを消去してください。',
          });
      })
      .catch(() => {})
      .finally(() => {
        mayQuit = true;
        app.quit();
      });
  });
  app.on('window-all-closed', () => app.quit());
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL)
    await window.loadURL(expectedUrl);
  else await window.loadFile(file);
}
