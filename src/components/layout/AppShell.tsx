import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ToastContainer } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useAppStore } from '@/stores/appStore';
import { useBudgets, useTransactions, useCategories } from '@/hooks/useFirestore';
import { calculateBudgetStatuses } from '@/utils/budget';
import { AlertBanner } from '@/components/ui/AlertBanner';

export const AppShell: React.FC = () => {
  const { user, isLoadingAuth, isTransactionModalOpen, setTransactionModalOpen, currentMonth } =
    useAppStore();

  const { budgets } = useBudgets();
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  // 檢查當前是否有超支或預警的預算
  const budgetStatuses = calculateBudgetStatuses(budgets, transactions, categories, currentMonth);
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
        <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      {/* 桌面與平板側邊欄 (大於 768px 顯示) */}
      <div className="sidebar-desktop-wrapper" style={{ display: 'none' }}>
        <Sidebar />
      </div>

      <style>{`
        @media (min-width: 768px) {
          .sidebar-desktop-wrapper { display: block !important; }
          .bottom-nav-mobile-wrapper { display: none !important; }
        }
      `}</style>

      {/* 主內容展示區域 */}
      <div className="main-content">
        {/* 全域超支提醒橫幅 (若有超支) */}
        {overBudgetAlerts.length > 0 && (
          <div style={{ padding: 'var(--space-4) var(--space-4) 0' }}>
            <AlertBanner
              type="error"
              title="⚠️ 預算超支警示"
              message={`本月共有 ${overBudgetAlerts.length} 項預算已超出上限（包含：${overBudgetAlerts.map(a => a.category?.name || '總預算').join('、')}）`}
            />
          </div>
        )}

        <Outlet />
      </div>

      {/* 手機底部導航列 (小於 768px 顯示) */}
      <div className="bottom-nav-mobile-wrapper">
        <BottomNav />
      </div>

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
