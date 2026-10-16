const { app, BrowserWindow, shell, ipcMain, session } = require('electron');
const path = require('path');

const REMOTE_APP_URL = process.env.ELECTRON_START_URL || 'https://hippoking1.github.io/-app/';
let mainWindow = null;

// 1. 強制單一執行個體鎖定 (Single Instance Lock)
// 當使用者重複雙擊桌面圖示或執行檔時，絕不開啟第二個視窗，而是直接喚醒並聚焦既有視窗
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      } else if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 390,
    minHeight: 640,
    title: '智慧記帳 - AI & 投資理財助手',
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/pwa-512x512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  // 移除頂部傳統選單列，提供純粹原生獨立 App 體驗
  mainWindow.setMenuBarVisibility(false);

  // 處理彈出視窗：允許 Firebase Google OAuth 驗證視窗，其餘外部下載連結交由系統開啟
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isAuthPopup =
      url.includes('accounts.google.com') ||
      url.includes('firebaseapp.com') ||
      url.includes('googleapis.com');

    if (isAuthPopup) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 680,
          autoHideMenuBar: true,
          parent: mainWindow,
          modal: false
        }
      };
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 若遠端因離線無法連線，自動切換至封裝於安裝檔內的本地離線包 (dist/index.html)
  let fellBackToLocal = false;
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && !fellBackToLocal && errorCode !== -3) {
      fellBackToLocal = true;
      const localIndex = path.join(__dirname, '../dist/index.html');
      mainWindow.loadFile(localIndex).catch(() => {});
    }
  });

  // 啟動時先清除舊有 HTTP 快取以確保永遠偵測並載入最新線上版本
  session.defaultSession
    .clearCache()
    .catch(() => {})
    .finally(() => {
      if (process.env.ELECTRON_LOCAL_ONLY === 'true') {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      } else {
        mainWindow.loadURL(REMOTE_APP_URL);
      }
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 通道：供前端查詢版本、強制清除快取更新重載、聚焦視窗
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('reload-and-clear-cache', async () => {
  if (!mainWindow) return;
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage']
    });
  } catch {
    // 忽略快取清理錯誤
  }
  mainWindow.webContents.reloadIgnoringCache();
});

ipcMain.handle('focus-main-window', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.handle('open-external-url', async (_event, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
