import { create } from 'zustand';
import { AuthUser } from '@/services/auth';
import {
  AIConfigStorage,
  EMPTY_AI_CONFIG,
  loadUserAIConfig,
  saveUserAIConfig,
  clearUserAIConfig
} from '@/services/ai';
import { format } from 'date-fns';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface AppState {
  // 認證狀態
  user: AuthUser | null;
  isLoadingAuth: boolean;
  setUser: (user: AuthUser | null) => void;
  setIsLoadingAuth: (loading: boolean) => void;

  // 使用者自備 AI API Key 與模型選擇狀態 (BYOK，系統無預設金鑰)
  aiConfig: AIConfigStorage;
  setAIConfig: (updates: Partial<AIConfigStorage>) => void;
  clearAIConfig: () => void;

  // 主題 (預設 dark)
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  // 側邊欄展開
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // 篩選狀態
  selectedAccountId: string; // 'all' 代表全部帳戶
  setSelectedAccountId: (id: string) => void;
  currentMonth: string; // YYYY-MM
  setCurrentMonth: (month: string) => void;

  // Toast 訊息隊列
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  // 快速 Modal 與行動端完整選單抽屜開關
  isTransactionModalOpen: boolean;
  setTransactionModalOpen: (open: boolean) => void;
  isStockModalOpen: boolean;
  setStockModalOpen: (open: boolean) => void;
  isMobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isLoadingAuth: true,
  setUser: (newUser) =>
    set((state) => {
      if (state.user?.uid === newUser?.uid && state.user?.email === newUser?.email) {
        return state; // 相同使用者不更新 state 引用，防止元件樹重新執行 useEffect
      }
      const nextAIConfig = newUser ? loadUserAIConfig(newUser.uid) : { ...EMPTY_AI_CONFIG };
      return { user: newUser, aiConfig: nextAIConfig };
    }),
  setIsLoadingAuth: (isLoadingAuth) => set({ isLoadingAuth }),

  aiConfig: loadUserAIConfig(),
  setAIConfig: (updates) =>
    set((state) => {
      const merged: AIConfigStorage = {
        ...state.aiConfig,
        ...updates
      };
      saveUserAIConfig(merged, state.user?.uid);
      return { aiConfig: merged };
    }),
  clearAIConfig: () =>
    set((state) => {
      clearUserAIConfig(state.user?.uid);
      return { aiConfig: { ...EMPTY_AI_CONFIG, provider: state.aiConfig.provider } };
    }),

  theme: (localStorage.getItem('smart_theme') as 'dark' | 'light') || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('smart_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },

  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (isSidebarCollapsed) => set({ isSidebarCollapsed }),

  selectedAccountId: 'all',
  setSelectedAccountId: (selectedAccountId) => set({ selectedAccountId }),

  currentMonth: format(new Date(), 'yyyy-MM'),
  setCurrentMonth: (currentMonth) => set({ currentMonth }),

  toasts: [],
  addToast: (toast) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const newToast: ToastMessage = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    const duration = toast.duration || 3500;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  isTransactionModalOpen: false,
  setTransactionModalOpen: (isTransactionModalOpen) => set({ isTransactionModalOpen }),

  isStockModalOpen: false,
  setStockModalOpen: (isStockModalOpen) => set({ isStockModalOpen }),

  isMobileMenuOpen: false,
  setMobileMenuOpen: (isMobileMenuOpen) => set({ isMobileMenuOpen })
}));
