import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ToastContainer } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useAppStore } from '@/stores/appStore';
import { useBudgets, useTransactions, useCategories, useSubscriptionAutoProcessor, useGlobalDataSync } from '@/hooks/useFirestore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { calculateBudgetStatuses } from '@/utils/budget';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { App as CapApp } from '@capacitor/app';
import { CURRENT_VERSION, checkRemoteVersion, useVersionStore, applyAppUpdate } from '@/hooks/useVersionUpdater';
import { Menu, Sparkles, RefreshCw, Sun, Moon } from 'lucide-react';
import { hapticLight } from '@/utils/haptics';

export const AppShell: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const isLoadingAuth = useAppStore((s) => s.isLoadingAuth);
  const isTransactionModalOpen = useAppStore((s) => s.isTransactionModalOpen);
  const setTransactionModalOpen = useAppStore((s) => s.setTransactionModalOpen);
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen);
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen);
  const currentMonth = useAppStore((s) => s.currentMonth);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const addToast = useAppStore((s) => s.addToast);
  const isSidebarCollapsed = useAppStore((s) => s.isSidebarCollapsed);

  const isCheckingVersion = useVersionStore((s) => s.isChecking);
  const hasUpdate = useVersionStore((s) => s.hasUpdate);
  const latestVersion = useVersionStore((s) => s.latestVersion);

  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // 原生 Android 實體返回鍵處理：抽屜或 Modal 開啟時優先關閉，否則返回上一頁或最小化
  React.useEffect(() => {
    let removeHandler: (() => void) | undefined;

    CapApp.addListener('backButton', ({ canGoBack }) => {
      const state = useAppStore.getState();
      if (state.isMobileMenuOpen) {
        state.setMobileMenuOpen(false);
        return;
      }
      if (state.isTransactionModalOpen) {
        state.setTransactionModalOpen(false);
        return;
      }
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.minimizeApp();
      }
    })
      .then((listener) => {
        removeHandler = () => listener.remove();
      })
      .catch(() => {
        // 瀏覽器環境無原生返回鍵事件，靜默略過
      });

    return () => {
      removeHandler?.();
    };
  }, []);

  // 全域資料即時監聽同步 (統一 1 組 onSnapshot)
  useGlobalDataSync();

  // 背景自動排程：檢查並執行到期的信用卡定期訂閱扣款
  useSubscriptionAutoProcessor();

  const { budgets } = useBudgets();
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  // 檢查當前是否有超支的預算（只在總覽與預算頁提醒，避免打擾其他操作）
  const shouldShowAlert =
    !isAlertDismissed && (location.pathname === '/' || location.pathname === '/budget');
  const budgetStatuses = shouldShowAlert
    ? calculateBudgetStatuses(budgets, transactions, categories, currentMonth)
    : [];
  const overBudgetAlerts = budgetStatuses.filter((s) => s.isOverBudget);

  // 行動端頂部一鍵檢查更新或套用更新
  const handleQuickUpdateCheck = async () => {
    hapticLight();
    if (hasUpdate) {
      await applyAppUpdate();
      return;
    }
    const found = await checkRemoteVersion(true);
    if (found) {
      await applyAppUpdate();
    } else {
      addToast({
        type: 'success',
        message: `目前已是最新版本 (v${CURRENT_VERSION})！`
      });
    }
  };

  if (isLoadingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%'
          }}
        />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      {/* 桌面端固定顯示左側完整功能欄 Sidebar (預留對應寬度，Sidebar 本體採用 position: fixed 鎖定視窗) */}
      {isDesktop ? (
        <div
          className="sidebar-desktop-wrapper"
          style={{
            width: isSidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
            flexShrink: 0,
            transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <Sidebar />
        </div>
      ) : null}

      {/* 行動端滑出式完整功能側邊欄抽屜 (Slide-over Full Sidebar Drawer) */}
      {!isDesktop && isMobileMenuOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex'
          }}
        >
          {/* 半透明模糊背景遮罩 */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)'
            }}
          />
          <Sidebar isMobileDrawer onCloseMobile={() => setMobileMenuOpen(false)} />
        </div>
      ) : null}

      {/* 主內容展示區域 */}
      <div className="main-content">
        {/* 行動端專屬頂部導覽列：單行俐落排版、不換行、唯一選單入口 */}
        {!isDesktop ? (
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 45,
              paddingTop: 'var(--safe-top, max(env(safe-area-inset-top, 0px), 52px))',
              backgroundColor: 'var(--bg-glass-heavy)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '52px',
                padding: '0 14px',
                gap: '8px'
              }}
            >
              {/* 左側：側邊欄選單按鈕 + 品牌標題與版本號 (強制單行不折行) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <button
                  onClick={() => {
                    hapticLight();
                    setMobileMenuOpen(true);
                  }}
                  aria-label="開啟功能選單"
                  title="開啟完整功能選單"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-focus)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    touchAction: 'manipulation'
                  }}
                >
                  <Menu size={19} color="var(--primary)" />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)'
                    }}
                  >
                    <Sparkles size={15} />
                  </div>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    智慧記帳
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    v{CURRENT_VERSION}
                  </span>
                </div>
              </div>

              {/* 右側：精簡圖示按鈕（檢查更新、深淺主題切換） */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleQuickUpdateCheck}
                  aria-label="檢查版本更新"
                  title={hasUpdate ? `立即更新至 v${latestVersion}` : '檢查版本更新'}
                  style={{
                    height: '36px',
                    padding: hasUpdate ? '0 10px' : '0 9px',
                    background: hasUpdate ? 'var(--primary)' : 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: hasUpdate ? '#ffffff' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  <RefreshCw size={15} className={isCheckingVersion ? 'animate-spin' : ''} />
                  {hasUpdate ? <span>更新 v{latestVersion}</span> : null}
                </button>

                <button
                  onClick={toggleTheme}
                  aria-label="切換深淺主題"
                  title="切換深淺主題"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            </div>
          </header>
        ) : null}

        {/* 超支提醒橫幅 (可手動關閉，且只在首頁/預算頁) */}
        {overBudgetAlerts.length > 0 && (
          <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
            <AlertBanner
              type="error"
              title="⚠️ 預算超支警示"
              message={`本月共有 ${overBudgetAlerts.length} 項預算已超出上限（包含：${overBudgetAlerts.map((a) => a.category?.name || '總預算').join('、')}）`}
              onClose={() => setIsAlertDismissed(true)}
            />
          </div>
        )}

        <Outlet />
      </div>

      {/* 行動端底部對稱 5 欄導覽列 */}
      {!isDesktop ? (
        <div className="bottom-nav-mobile-wrapper">
          <BottomNav />
        </div>
      ) : null}

      {/* 全域 Toast 訊息通知 */}
      <ToastContainer />

      {/* 全域快速新增記帳 Modal */}
      <Modal
        isOpen={isTransactionModalOpen}
        onClose={() => setTransactionModalOpen(false)}
        title="📝 快速記一筆"
      >
        <TransactionForm
          onSuccess={() => setTransactionModalOpen(false)}
          onCancel={() => setTransactionModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
