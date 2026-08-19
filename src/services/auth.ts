import {
  signInAnonymously as fbSignInAnonymously,
  signInWithPopup,
  linkWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';

export interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
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

  return onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
    if (fbUser) {
      const authUser: AuthUser = {
        uid: fbUser.uid,
        isAnonymous: fbUser.isAnonymous,
        displayName: fbUser.displayName || (fbUser.isAnonymous ? '訪客使用者' : '使用者'),
        email: fbUser.email,
        photoURL: fbUser.photoURL
      };
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
  const fbUser = credential.user;
  return {
    uid: fbUser.uid,
    isAnonymous: true,
    displayName: '訪客使用者',
    email: null,
    photoURL: null
  };
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

  const credential = await signInWithPopup(auth, googleProvider);
  const fbUser = credential.user;
  return {
    uid: fbUser.uid,
    isAnonymous: false,
    displayName: fbUser.displayName,
    email: fbUser.email,
    photoURL: fbUser.photoURL
  };
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

  const credential = await linkWithPopup(auth.currentUser, googleProvider);
  const fbUser = credential.user;
  return {
    uid: fbUser.uid,
    isAnonymous: false,
    displayName: fbUser.displayName,
    email: fbUser.email,
    photoURL: fbUser.photoURL
  };
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
