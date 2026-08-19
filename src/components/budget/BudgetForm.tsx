import React, { useState } from 'react';
import { Budget } from '@/types';
import { useCategories } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { saveBudget } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { v4 as uuidv4 } from 'uuid';

interface BudgetFormProps {
  initialData?: Budget;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const BudgetForm: React.FC<BudgetFormProps> = ({
  initialData,
  onSuccess,
  onCancel
}) => {
  const { user, addToast } = useAppStore();
  const { categories } = useCategories('expense');

  const [categoryId, setCategoryId] = useState<string>(initialData?.categoryId || 'all');
  const [amount, setAmount] = useState<string>(
    initialData?.amount ? String(initialData.amount) : ''
  );
  const [alertEnabled, setAlertEnabled] = useState<boolean>(
    initialData ? initialData.alertEnabled : true
  );
  const [alertThreshold, setAlertThreshold] = useState<string>(
    initialData ? String(Math.round((initialData.alertThreshold || 0.8) * 100)) : '80'
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      addToast({ type: 'error', message: '請輸入有效的預算金額' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const budget: Budget = {
        id: initialData?.id || 'bg_' + uuidv4().slice(0, 8),
        userId: user.uid,
        categoryId: categoryId === 'all' ? null : categoryId,
        amount: numAmount,
        period: 'monthly',
        alertEnabled,
        alertThreshold: (parseFloat(alertThreshold) || 80) / 100,
        createdAt: initialData?.createdAt || now,
        updatedAt: now
      };

      await saveBudget(budget);
      addToast({ type: 'success', message: '預算設定已儲存！' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Select
        label="預算目標"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        options={[
          { value: 'all', label: '📊 全月總預算 (全部支出)' },
          ...categories.map((c) => ({
            value: c.id,
            label: `📁 ${c.name}`
          }))
        ]}
      />

      <Input
        label="每月預算金額 (NT$)"
        type="number"
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="例如：25000"
        required
        autoFocus
      />

      <div
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              啟用超支與預警提醒
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              當花費接近或超出上限時發出提醒
            </div>
          </div>
          <input
            type="checkbox"
            checked={alertEnabled}
            onChange={(e) => setAlertEnabled(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        {alertEnabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>警戒通知閾值：</span>
            <input
              type="number"
              min="50"
              max="99"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              style={{
                width: '60px',
                padding: '4px 8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                textAlign: 'center'
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>%</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-2)' }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
          確認設定
        </Button>
      </div>
    </form>
  );
};
