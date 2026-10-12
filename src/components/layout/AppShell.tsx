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

export const AppShell: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const isLoadingAuth = useAppStore((s) => s.isLoadingAuth);
  const isTransactionModalOpen = useAppStore((s) => s.isTransactionModalOpen);
  const setTransactionModalOpen = useAppStore((s) => s.setTransactionModalOpen);
  const currentMonth = useAppStore((s) => s.currentMonth);

  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);

  // 原生 Android 實體返回鍵處理：Modal 開啟時先關閉 Modal，無 Modal 時依歷史上一頁或最小化
  React.useEffect(() => {
    let removeHandler: (() => void) | undefined;

    CapApp.addListener('backButton', ({ canGoBack }) => {
      const state = useAppStore.getState();
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
      {/* 桌面端才 mount Sidebar，避免手機重複計算與 DOM 負擔 */}
      {isDesktop ? (
        <div className="sidebar-desktop-wrapper">
          <Sidebar />
        </div>
      ) : null}

      {/* 主內容展示區域 */}
      <div className="main-content">
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

      {/* 行動端才 mount BottomNav */}
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

