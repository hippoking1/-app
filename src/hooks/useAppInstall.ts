import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type RuntimeMode = 'electron' | 'capacitor' | 'pwa-standalone' | 'browser';

export interface AppInstallState {
  runtimeMode: RuntimeMode;
  isStandaloneApp: boolean;
  canPromptInstall: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWindows: boolean;
  promptInstall: () => Promise<boolean>;
  windowsExeUrl: string;
  androidApkUrl: string;
}

// 全域緩存攔截到的安裝事件，避免路由切換後遺失
let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });

  window.addEventListener('appinstalled', () => {
    deferredPromptGlobal = null;
    listeners.forEach((fn) => fn());
  });
}

function detectRuntimeMode(): RuntimeMode {
  if (typeof window === 'undefined') return 'browser';
  if (window.electronAPI?.isElectron) return 'electron';
  if (Capacitor.isNativePlatform()) return 'capacitor';

  const isStandaloneDisplay =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as any).standalone === true;

  if (isStandaloneDisplay) return 'pwa-standalone';
  return 'browser';
}

export function useAppInstall(): AppInstallState {
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(() => detectRuntimeMode());
  const [canPromptInstall, setCanPromptInstall] = useState<boolean>(() => !!deferredPromptGlobal);

  useEffect(() => {
    const updateState = () => {
      setRuntimeMode(detectRuntimeMode());
      setCanPromptInstall(!!deferredPromptGlobal);
    };

    listeners.add(updateState);
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener?.('change', updateState);

    return () => {
      listeners.delete(updateState);
      mediaQuery.removeEventListener?.('change', updateState);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPromptGlobal) return false;
    try {
      await deferredPromptGlobal.prompt();
      const choiceResult = await deferredPromptGlobal.userChoice;
      if (choiceResult.outcome === 'accepted') {
        deferredPromptGlobal = null;
        setCanPromptInstall(false);
        return true;
      }
    } catch {
      // 忽略使用者取消
    }
    return false;
  }, []);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isWindows = /Win/i.test(ua);

  return {
    runtimeMode,
    isStandaloneApp: runtimeMode !== 'browser',
    canPromptInstall,
    isIOS,
    isAndroid,
    isWindows,
    promptInstall,
    windowsExeUrl: 'https://github.com/hippoking1/-app/releases/latest/download/SmartExpenseTracker-Windows-Setup.exe',
    androidApkUrl: 'https://github.com/hippoking1/-app/releases/latest/download/SmartExpenseTracker-Android.apk'
  };
}
