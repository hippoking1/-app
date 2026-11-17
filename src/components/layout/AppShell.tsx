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
import { Menu, RefreshCw, Sun, Moon } from 'lucide-react';
import { hapticLight } from '@/utils/haptics';
import { BrandMark } from '@/components/common/BrandMark';

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
        message: `目前已是最新版本 (v${CURRENT_VERSION})`
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
            width: '28px',
            height: '28px',
            border: '2px solid var(--border)',
            borderTopColor: 'var(--accent)',
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
      {/* 桌面端固定顯示左側完整功能欄 Sidebar */}
      {isDesktop ? (
        <div
          className="sidebar-desktop-wrapper"
          style={{
            width: isSidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
            flexShrink: 0,
            transition: 'width 0.25s var(--ease-out)'
          }}
        >
          <Sidebar />
        </div>
      ) : null}

      {/* 行動端滑出式完整功能側邊欄抽屜 */}
      {!isDesktop && isMobileMenuOpen ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex'
          }}
        >
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'var(--bg-overlay)'
            }}
          />
          <Sidebar isMobileDrawer onCloseMobile={() => setMobileMenuOpen(false)} />
        </div>
      ) : null}

      {/* 主內容展示區域 */}
      <div className="main-content">
        {/* 行動端頂部導覽列 */}
        {!isDesktop ? (
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 45,
              paddingTop: 'var(--safe-top, max(env(safe-area-inset-top, 0px), 52px))',
              backgroundColor: 'var(--bg-deepest)',
              borderBottom: '1px solid var(--border)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '56px',
                padding: '0 16px',
                gap: '8px'
              }}
            >
              {/* 左側：選單按鈕 + 品牌標誌 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <button
                  onClick={() => {
                    hapticLight();
                    setMobileMenuOpen(true);
                  }}
                  aria-label="開啟功能選單"
                  title="開啟功能選單"
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    touchAction: 'manipulation'
                  }}
                >
                  <Menu size={18} strokeWidth={1.5} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                  <BrandMark size={24} />
                  <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                    智慧記帳
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    v{CURRENT_VERSION}
                  </span>
                </div>
              </div>

              {/* 右側：檢查更新、主題切換 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleQuickUpdateCheck}
                  aria-label="檢查版本更新"
                  title={hasUpdate ? `立即更新至 v${latestVersion}` : '檢查版本更新'}
                  style={{
                    height: '36px',
                    padding: hasUpdate ? '0 12px' : '0 10px',
                    backgroundColor: hasUpdate ? 'var(--accent)' : 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: hasUpdate ? 'var(--on-accent)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  <RefreshCw size={16} strokeWidth={1.5} className={isCheckingVersion ? 'animate-spin' : ''} />
                  {hasUpdate ? <span>更新 v{latestVersion}</span> : null}
                </button>

                <button
                  onClick={toggleTheme}
                  aria-label="切換深淺主題"
                  title="切換深淺主題"
                  style={{
                    width: '36px',
                    height: '36px',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
                </button>
              </div>
            </div>
          </header>
        ) : null}

        {/* 超支提醒橫幅 */}
        {overBudgetAlerts.length > 0 && (
          <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
            <AlertBanner
              type="error"
              title="預算超支提醒"
              message={`本月共有 ${overBudgetAlerts.length} 項預算超出上限（${overBudgetAlerts.map((a) => a.category?.name || '總預算').join('、')}）`}
              onClose={() => setIsAlertDismissed(true)}
            />
          </div>
        )}

        <Outlet />
      </div>

      {/* 行動端底部 5 欄導覽列 */}
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
        title="快速記一筆"
      >
        <TransactionForm
          onSuccess={() => setTransactionModalOpen(false)}
          onCancel={() => setTransactionModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
