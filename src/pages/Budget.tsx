import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { BudgetCard } from '@/components/budget/BudgetCard';
import { BudgetForm } from '@/components/budget/BudgetForm';
import { useBudgets, useTransactions, useCategories } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { Budget } from '@/types';
import { calculateBudgetStatuses, getDailyAllowance, isInvestmentTransaction } from '@/utils/budget';
import { formatCurrency } from '@/utils/analytics';
import { Plus, AlertTriangle } from 'lucide-react';

export const BudgetPage: React.FC = () => {
  const { currentMonth } = useAppStore();
  const { budgets } = useBudgets();
  const { transactions } = useTransactions({ month: currentMonth });
  const { categories } = useCategories();

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>(undefined);

  const budgetStatuses = calculateBudgetStatuses(budgets, transactions, categories, currentMonth);

  const totalBudgetAmount = budgets
    .filter((b) => !b.categoryId)
    .reduce((sum, b) => sum + b.amount, 0) ||
    budgets.reduce((sum, b) => sum + b.amount, 0);

  const totalSpent = transactions
    .filter((t) => t.type === 'expense' && !isInvestmentTransaction(t, categories))
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
          <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            預算管理
          </h1>
          <p className="font-mono" style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {currentMonth} 每月消費額度監控
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleCreate} icon={<Plus size={16} strokeWidth={1.5} />}>
          設定新預算
        </Button>
      </div>

      {/* 預算總體健康指標 */}
      <div className="grid-3">
        <Card padding="md">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
              當月總預算與已支出
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
              不含投資
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 500, marginTop: '8px', color: 'var(--text-primary)' }}>
            {formatCurrency(totalSpent)} <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>/ {formatCurrency(totalBudgetAmount)}</span>
          </div>
          <div className="font-mono" style={{ fontSize: '12px', color: totalSpent > totalBudgetAmount ? 'var(--expense)' : 'var(--income)', marginTop: '8px', fontWeight: 500 }}>
            {totalSpent > totalBudgetAmount
              ? `已超支 ${formatCurrency(totalSpent - totalBudgetAmount)}`
              : `剩餘可用 ${formatCurrency(remainingBudget || 0)}`}
          </div>
        </Card>

        <Card padding="md">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            每日建議可花費上限
          </span>
          <div className="font-mono" style={{ fontSize: '24px', fontWeight: 500, marginTop: '8px', color: 'var(--accent-text)' }}>
            {formatCurrency(dailyAllowance)} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ 天</span>
          </div>
          <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            本月尚餘 {remainingDays} 天
          </div>
        </Card>

        <Card padding="md">
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
            預算警示狀態
          </span>
          <div className="font-mono" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: overCount > 0 ? 'var(--expense)' : 'var(--text-muted)', fontWeight: 500, fontSize: '16px' }}>
              <AlertTriangle size={16} strokeWidth={1.5} /> {overCount} 項超支
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: warningCount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: 500, fontSize: '16px' }}>
              <AlertTriangle size={16} strokeWidth={1.5} /> {warningCount} 項預警
            </div>
          </div>
        </Card>
      </div>

      {/* 預算項目卡片列表 */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 500, marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
          預算清單明細
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
          <Card style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
            尚未設定任何預算，點擊右上角「設定新預算」開始規劃
          </Card>
        )}
      </div>

      {/* 預算 Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBudget ? '編輯預算' : '設定每月預算'}
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
