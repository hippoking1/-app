import {
  signInAnonymously as fbSignInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';

export interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

function toAuthUser(fbUser: FirebaseUser): AuthUser {
  return {
    uid: fbUser.uid,
    isAnonymous: fbUser.isAnonymous,
    displayName: fbUser.displayName || (fbUser.isAnonymous ? '訪客使用者' : '使用者'),
    email: fbUser.email,
    photoURL: fbUser.photoURL
  };
}

/**
 * 包裝 Popup 登入流程：
 * - 若 onAuthStateChanged 已偵測到 Google 登入成功，立即 resolve（不卡死等待 popup window 關閉信號）
 * - 若使用者於 Android 內建彈窗點擊「取消返回」(觸發 oauth-popup-closed)，於 1.2 秒後自動解除 loading 狀態
 */
async function runPopupWithNativeGuard(
  popupAction: () => Promise<UserCredential>
): Promise<AuthUser> {
  return new Promise<AuthUser>((resolve, reject) => {
    let settled = false;
    let closeTimer: number | undefined;

    const cleanup = () => {
      if (closeTimer) window.clearTimeout(closeTimer);
      window.removeEventListener('oauth-popup-closed', handleNativePopupClosed);
      unsubscribeAuth();
    };

    const finishResolve = (user: AuthUser) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(user);
    };

    const finishReject = (err: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    // 監聽 Firebase Auth 狀態變更：一旦取得正式 Google 帳號即刻完成登入
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && !fbUser.isAnonymous) {
        const authUser = toAuthUser(fbUser);
        localStorage.setItem('smart_auth_user_cache', JSON.stringify(authUser));
        finishResolve(authUser);
      }
    });

    // 監聽 Android MainActivity 內建 OAuth Dialog 關閉事件
    const handleNativePopupClosed = () => {
      closeTimer = window.setTimeout(() => {
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          finishResolve(toAuthUser(auth.currentUser));
        } else {
          finishReject(new Error('已取消 Google 登入'));
        }
      }, 1200);
    };

    window.addEventListener('oauth-popup-closed', handleNativePopupClosed);

    popupAction()
      .then((credential) => {
        const authUser = toAuthUser(credential.user);
        localStorage.setItem('smart_auth_user_cache', JSON.stringify(authUser));
        finishResolve(authUser);
      })
      .catch(async (err) => {
        // 若環境阻擋 Popup，自動切換為 Redirect 模式
        if (
          err?.code === 'auth/popup-blocked' ||
          err?.code === 'auth/operation-not-supported-in-this-environment'
        ) {
          try {
            await signInWithRedirect(auth, googleProvider);
            return;
          } catch (redirectErr) {
            finishReject(redirectErr);
            return;
          }
        }
        if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
          finishReject(new Error('已取消 Google 登入'));
          return;
        }
        finishReject(err);
      });
  });
}

/**
 * 監聽登入狀態改變
 */
export function subscribeAuthState(callback: (user: AuthUser | null) => void): () => void {
  if (!isFirebaseConfigured) {
    // Demo 模式使用 localStorage
    const saved = localStorage.getItem('smart_expense_demo_user');
    if (saved) {
      callback(JSON.parse(saved));
    } else {
      callback(null);
    }
    return () => {};
  }

  // 1. 優先使用本地快取的穩定登入狀態，徹底防止網絡抖動造成未授權轉跳
  const cachedUserStr = localStorage.getItem('smart_auth_user_cache');
  if (cachedUserStr) {
    try {
      callback(JSON.parse(cachedUserStr));
    } catch (e) {}
  }

  // 處理 Redirect 登入回跳結果（若有）
  getRedirectResult(auth)
    .then((result) => {
      if (result?.user) {
        const authUser = toAuthUser(result.user);
        localStorage.setItem('smart_auth_user_cache', JSON.stringify(authUser));
        callback(authUser);
      }
    })
    .catch(() => {});

  return onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      const authUser = toAuthUser(fbUser);
      localStorage.setItem('smart_auth_user_cache', JSON.stringify(authUser));
      callback(authUser);
    } else {
      localStorage.removeItem('smart_auth_user_cache');
      callback(null);
    }
  });
}

/**
 * 匿名登入 (快速體驗)
 */
export async function loginAnonymously(): Promise<AuthUser> {
  if (!isFirebaseConfigured) {
    const demoUser: AuthUser = {
      uid: 'demo_guest_' + Date.now().toString(36),
      isAnonymous: true,
      displayName: '訪客體驗帳號',
      email: null,
      photoURL: null
    };
    localStorage.setItem('smart_expense_demo_user', JSON.stringify(demoUser));
    return demoUser;
  }

  const credential = await fbSignInAnonymously(auth);
  return toAuthUser(credential.user);
}

/**
 * Google 帳戶登入
 */
export async function loginWithGoogle(): Promise<AuthUser> {
  if (!isFirebaseConfigured) {
    const demoUser: AuthUser = {
      uid: 'demo_google_user',
      isAnonymous: false,
      displayName: 'Demo Google 帳號',
      email: 'demo@example.com',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    };
    localStorage.setItem('smart_expense_demo_user', JSON.stringify(demoUser));
    return demoUser;
  }

  return runPopupWithNativeGuard(() => signInWithPopup(auth, googleProvider));
}

/**
 * 將訪客匿名帳號升級綁定為永久 Google 帳號 (保留所有資料)
 */
export async function upgradeAnonymousWithGoogle(): Promise<AuthUser> {
  if (!isFirebaseConfigured) {
    const currentUser = localStorage.getItem('smart_expense_demo_user');
    const prev = currentUser ? JSON.parse(currentUser) : {};
    const upgraded: AuthUser = {
      uid: prev.uid || 'demo_google_user',
      isAnonymous: false,
      displayName: '已升級 Google 帳號',
      email: 'user@gmail.com',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    };
    localStorage.setItem('smart_expense_demo_user', JSON.stringify(upgraded));
    return upgraded;
  }

  if (!auth.currentUser) {
    throw new Error('目前無登入的使用者');
  }

  const currentUser = auth.currentUser;
  return runPopupWithNativeGuard(async () => {
    try {
      return await linkWithPopup(currentUser, googleProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        await linkWithRedirect(currentUser, googleProvider);
      }
      throw err;
    }
  });
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  localStorage.removeItem('smart_auth_user_cache');
  if (!isFirebaseConfigured) {
    localStorage.removeItem('smart_expense_demo_user');
    return;
  }
  await fbSignOut(auth);
}
