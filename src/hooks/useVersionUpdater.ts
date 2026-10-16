import { useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';
import { App as CapApp } from '@capacitor/app';
import { useAppStore } from '@/stores/appStore';

export const CURRENT_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.2';
export const CURRENT_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';
export const CURRENT_BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : new Date().toISOString();

const APPLIED_BUILD_STORAGE_KEY = 'smart_expense_applied_build_id';
const JUST_UPDATED_STORAGE_KEY = 'smart_expense_just_updated_to';
const REMOTE_VERSION_FALLBACK_URL = 'https://hippoking1.github.io/-app/version.json';

interface VersionManifest {
  version: string;
  buildId: string;
  buildTime: string;
}

interface VersionState {
  currentVersion: string;
  currentBuildId: string;
  currentBuildTime: string;
  latestVersion: string | null;
  latestBuildId: string | null;
  hasUpdate: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  isDismissed: boolean;
  lastCheckedAt: string | null;
  setUpdateAvailable: (version: string, buildId: string) => void;
  setIsChecking: (checking: boolean) => void;
  setIsUpdating: (updating: boolean) => void;
  setDismissed: (dismissed: boolean) => void;
  setLastCheckedAt: (iso: string) => void;
}

export const useVersionStore = create<VersionState>((set) => ({
  currentVersion: CURRENT_VERSION,
  currentBuildId: CURRENT_BUILD_ID,
  currentBuildTime: CURRENT_BUILD_TIME,
  latestVersion: null,
  latestBuildId: null,
  hasUpdate: false,
  isChecking: false,
  isUpdating: false,
  isDismissed: false,
  lastCheckedAt: null,
  setUpdateAvailable: (latestVersion, latestBuildId) =>
    set({
      latestVersion,
      latestBuildId,
      hasUpdate: true,
      isDismissed: false
    }),
  setIsChecking: (isChecking) => set({ isChecking }),
  setIsUpdating: (isUpdating) => set({ isUpdating }),
  setDismissed: (isDismissed) => set({ isDismissed }),
  setLastCheckedAt: (lastCheckedAt) => set({ lastCheckedAt })
}));

let swUpdateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
let swRegistrationRef: ServiceWorkerRegistration | null = null;
let swInitialized = false;
let lastCheckTimestamp = 0;

/**
 * 檢查使用者當前是否正在輸入表單或開啟記帳彈窗，避免打斷記帳操作
 */
function isUserCurrentlyBusy(): boolean {
  const appState = useAppStore.getState();
  if (appState.isTransactionModalOpen || appState.isStockModalOpen) {
    return true;
  }

  if (typeof document !== 'undefined') {
    const activeEl = document.activeElement;
    if (
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 只要使用者目前沒有正在輸入表單，無論是剛啟動或從背景重開 App，皆立即自動套用更新
 */
function shouldAutoApplySilently(): boolean {
  return !isUserCurrentlyBusy();
}

/**
 * 執行清除快取並強制穿透 WebView 快取無縫重載（免重新下載安裝 APK）
 */
export async function applyAppUpdate(targetBuildId?: string, targetVersion?: string): Promise<void> {
  const store = useVersionStore.getState();
  if (store.isUpdating) return;
  store.setIsUpdating(true);

  const buildToRecord = targetBuildId || store.latestBuildId || `${CURRENT_VERSION}-${Date.now()}`;
  const versionToRecord = targetVersion || store.latestVersion || CURRENT_VERSION;

  try {
    sessionStorage.setItem(APPLIED_BUILD_STORAGE_KEY, buildToRecord);
    localStorage.setItem(JUST_UPDATED_STORAGE_KEY, versionToRecord);
  } catch {
    // 忽略隱私模式儲存限制
  }

  // 短暫顯示更新過渡動畫，讓使用者感知正在套用新版
  await new Promise((r) => setTimeout(r, 550));

  try {
    if (swUpdateFn) {
      await swUpdateFn(false);
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.update().catch(() => {})));
    }
  } catch {
    // 忽略 SW 錯誤
  }

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  } catch {
    // 忽略快取刪除錯誤
  }

  if (window.electronAPI?.reloadAndClearCache) {
    await window.electronAPI.reloadAndClearCache();
    return;
  }

  // 透過在網址附加最新 buildId 參數 (_v)，強制 Android APK WebView 與瀏覽器穿透本地快取抓最新 index.html
  try {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('_v', buildToRecord);
    window.location.replace(nextUrl.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * 比較語意版本號 (若遠端版本較新回傳 1，相同回傳 0，較舊回傳 -1)
 */
function compareSemver(remoteVer: string, localVer: string): number {
  const rParts = remoteVer.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const lParts = localVer.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < len; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return 1;
    if (r < l) return -1;
  }
  return 0;
}

/**
 * 向遠端與 Service Worker 檢查是否有新版本
 */
export async function checkRemoteVersion(forceImmediate = false): Promise<boolean> {
  const store = useVersionStore.getState();
  if (store.isChecking || store.isUpdating) return false;

  const now = Date.now();
  if (!forceImmediate && now - lastCheckTimestamp < 5000) {
    return store.hasUpdate;
  }
  lastCheckTimestamp = now;

  store.setIsChecking(true);

  try {
    // 1. 觸發 Service Worker 檢查更新
    if (swRegistrationRef) {
      swRegistrationRef.update().catch(() => {});
    }

    // 2. 請求遠端 version.json (加上時間戳穿透 CDN/WebView 快取)
    const candidateUrls: string[] = [];
    if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
      const basePath = window.location.pathname.endsWith('/')
        ? window.location.pathname
        : window.location.pathname.replace(/\/[^/]*$/, '/');
      candidateUrls.push(`${window.location.origin}${basePath}version.json?t=${now}`);
    }
    candidateUrls.push(`${REMOTE_VERSION_FALLBACK_URL}?t=${now}`);

    let manifest: VersionManifest | null = null;
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache'
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.version && data.buildId) {
            manifest = data as VersionManifest;
            break;
          }
        }
      } catch {
        // 嘗試下一個候選 URL
      }
    }

    store.setLastCheckedAt(new Date().toISOString());

    if (!manifest) {
      store.setIsChecking(false);
      return store.hasUpdate;
    }

    const alreadyAppliedBuild = sessionStorage.getItem(APPLIED_BUILD_STORAGE_KEY);
    const isDifferentBuild =
      CURRENT_BUILD_ID !== 'dev' &&
      manifest.buildId !== CURRENT_BUILD_ID &&
      manifest.buildId !== alreadyAppliedBuild;
    const isNewerSemver = compareSemver(manifest.version, CURRENT_VERSION) > 0;

    if (isNewerSemver || isDifferentBuild) {
      store.setUpdateAvailable(manifest.version, manifest.buildId);
      store.setIsChecking(false);

      // 若未在輸入表單中，立即自動無縫更新重載（免重新安裝 APK）
      if (shouldAutoApplySilently()) {
        await applyAppUpdate(manifest.buildId, manifest.version);
      }
      return true;
    }

    store.setIsChecking(false);
    return store.hasUpdate;
  } catch {
    store.setIsChecking(false);
    return false;
  }
}

/**
 * 全域版本自動偵測與智慧更新 Hook
 */
export function useVersionUpdater() {
  const state = useVersionStore();

  useEffect(() => {
    // 若剛完成自動更新重載，彈出成功更新提示
    try {
      const justUpdatedVer = localStorage.getItem(JUST_UPDATED_STORAGE_KEY);
      if (justUpdatedVer) {
        localStorage.removeItem(JUST_UPDATED_STORAGE_KEY);
        setTimeout(() => {
          useAppStore.getState().addToast({
            type: 'success',
            message: `🚀 已自動更新至最新版本 v${justUpdatedVer}！`
          });
        }, 600);
      }
    } catch {
      // 忽略
    }

    // 初始化 PWA Service Worker 註冊與監聽
    if (!swInitialized && typeof window !== 'undefined') {
      swInitialized = true;
      try {
        swUpdateFn = registerSW({
          immediate: true,
          onRegisteredSW(_swUrl, registration) {
            if (registration) {
              swRegistrationRef = registration;
              registration.update().catch(() => {});
            }
          },
          onNeedRefresh() {
            const store = useVersionStore.getState();
            const targetVer = store.latestVersion || CURRENT_VERSION;
            const targetBuild = store.latestBuildId || `sw-${Date.now()}`;
            store.setUpdateAvailable(targetVer, targetBuild);

            if (shouldAutoApplySilently()) {
              applyAppUpdate(targetBuild, targetVer);
            }
          }
        });
      } catch {
        // 開發環境或無 SW 環境略過
      }
    }

    // 1. 開啟 App 時立即強制執行版本檢查
    checkRemoteVersion(true);

    // 2. 當視窗或手機 App 從背景重新開啟/切回前景時，立即強制檢查更新
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkRemoteVersion(true);
      }
    };
    const handleWindowFocus = () => {
      checkRemoteVersion(true);
    };
    const handlePageShow = () => {
      checkRemoteVersion(true);
    };
    const handleCordovaResume = () => {
      checkRemoteVersion(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('resume', handleCordovaResume);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handlePageShow);

    // 3. 原生 Capacitor App 切回前景時立即強制檢查更新
    let removeCapListener: (() => void) | undefined;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkRemoteVersion(true);
      }
    })
      .then((listener) => {
        removeCapListener = () => listener.remove();
      })
      .catch(() => {});

    // 4. 每 5 分鐘定時背景巡檢
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkRemoteVersion(false);
      }
    }, 5 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('resume', handleCordovaResume);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handlePageShow);
      removeCapListener?.();
      window.clearInterval(intervalId);
    };
  }, []);

  const triggerManualCheck = useCallback(async () => {
    const found = await checkRemoteVersion(true);
    return found;
  }, []);

  return {
    ...state,
    triggerManualCheck,
    applyUpdate: () => applyAppUpdate()
  };
}
