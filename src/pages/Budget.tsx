import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { BudgetCard } from '@/components/budget/BudgetCard';
import { BudgetForm } from '@/components/budget/BudgetForm';
import { useBudgets, useTransactions, useCategories } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { Budget } from '@/types';
import { calculateBudgetStatuses, getDailyAllowance } from '@/utils/budget';
import { formatCurrency } from '@/utils/analytics';
import { Target, Plus, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';

export const BudgetPage: React.FC = () => {
  const { currentMonth } = useAppStore();
  const { budgets } = useBudgets();
  const { transactions } = useTransactions({ month: currentMonth });
  const { categories } = useCategories();

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);

  const budgetStatuses = calculateBudgetStatuses(budgets, transactions, categories, currentMonth);

  // 總預算與總支出
  const totalBudgetAmount = budgets
    .filter((b) => !b.categoryId)
    .reduce((sum, b) => sum + b.amount, 0) ||
    budgets.reduce((sum, b) => sum + b.amount, 0);

  const totalSpent = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const { dailyAllowance, remainingDays, remainingBudget } = getDailyAllowance(
    totalBudgetAmount,
    totalSpent,
    currentMonth
  );

  const overCount = budgetStatuses.filter((s) => s.isOverBudget).length;
  const warningCount = budgetStatuses.filter((s) => s.isWarning).length;

  const handleEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingBudget(undefined);
    setModalOpen(true);
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部標題與新增按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
            預算管理與超支提醒
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {currentMonth} 監控每月消費額度，防止非必要支出
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleCreate} icon={<Plus size={16} />}>
          設定新預算
        </Button>
      </div>

      {/* 預算總體健康指標 */}
      <div className="grid-3">
        <Card glass padding="md">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            當月總預算 vs 已支出
          </span>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 900, marginTop: '4px' }}>
            {formatCurrency(totalSpent)} / <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>{formatCurrency(totalBudgetAmount)}</span>
          </div>
          <div style={{ fontSize: '12px', color: totalSpent > totalBudgetAmount ? 'var(--expense)' : 'var(--income)', marginTop: '8px', fontWeight: 600 }}>
              {totalSpent > totalBudgetAmount
                ? `⚠️ 已超支 ${formatCurrency(totalSpent - totalBudgetAmount)}`
                : `剩餘可用 ${formatCurrency(remainingBudget || 0)}`}
          </div>
        </Card>

        <Card glass padding="md">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            每日建議可花費上限
          </span>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 900, marginTop: '4px', color: 'var(--primary-light)' }}>
            {formatCurrency(dailyAllowance)} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/天</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            本月尚餘 {remainingDays} 天
          </div>
        </Card>

        <Card glass padding="md">
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
            預算警示狀態
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: overCount > 0 ? 'var(--expense)' : 'var(--text-muted)', fontWeight: 700, fontSize: '16px' }}>
              <AlertTriangle size={18} /> {overCount} 項超支
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: warningCount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 700, fontSize: '16px' }}>
              <AlertTriangle size={18} /> {warningCount} 項預警
            </div>
          </div>
        </Card>
      </div>

      {/* 預算項目卡片列表 */}
      <div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
          📋 預算清單明細
        </h3>

        <div className="grid-2">
          {budgetStatuses.map((status) => (
            <BudgetCard
              key={status.budget.id}
              status={status}
              onEdit={() => handleEdit(status.budget)}
            />
          ))}
        </div>

        {budgetStatuses.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            尚未設定任何預算。點擊右上角「設定新預算」開始規劃！
          </Card>
        )}
      </div>

      {/* 預算 Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBudget ? '✏️ 編輯預算' : '🎯 設定每月預算'}
      >
        <BudgetForm
          initialData={editingBudget}
          onSuccess={() => setModalOpen(false)}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
};
