import React, { useState } from 'react';
import { Account, AccountType } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { saveAccount } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { v4 as uuidv4 } from 'uuid';

interface AccountFormProps {
  initialData?: Account;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cash', label: '現金錢包' },
  { value: 'bank', label: '銀行帳戶' },
  { value: 'credit_card', label: '信用卡' },
  { value: 'e_wallet', label: '電子支付 / 悠遊卡' },
  { value: 'investment', label: '證券投資戶' }
];

const PRESET_COLORS = [
  '#10b981', '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#64748b'
];

export const AccountForm: React.FC<AccountFormProps> = ({
  initialData,
  onSuccess,
  onCancel
}) => {
  const { user, addToast } = useAppStore();

  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<AccountType>(initialData?.type || 'bank');
  const [balance, setBalance] = useState<string>(
    initialData ? String(initialData.balance) : '0'
  );
  const [color, setColor] = useState(initialData?.color || PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      addToast({ type: 'error', message: '請輸入帳戶名稱' });
      return;
    }

    const numBalance = parseFloat(balance) || 0;
    setLoading(true);

    try {
      const now = new Date().toISOString();
      const account: Account = {
        id: initialData?.id || 'acc_' + uuidv4().slice(0, 8),
        userId: user.uid,
        name: name.trim(),
        type,
        icon: type === 'cash' ? 'Wallet' : type === 'credit_card' ? 'CreditCard' : 'Building2',
        color,
        balance: numBalance,
        currency: 'TWD',
        isArchived: initialData?.isArchived || false,
        sortOrder: initialData?.sortOrder || Date.now(),
        createdAt: initialData?.createdAt || now,
        updatedAt: now
      };

      await saveAccount(account);
      addToast({ type: 'success', message: initialData ? '帳戶已更新' : '帳戶建立成功！' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Input
        label="帳戶名稱"
        placeholder="例如：玉山銀行、中信 LINE Pay 卡、日常現金"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />

      <Select
        label="帳戶類型"
        value={type}
        onChange={(e) => setType(e.target.value as AccountType)}
        options={ACCOUNT_TYPES}
      />

      <Input
        label="目前帳戶餘額 (NT$)"
        type="number"
        step="any"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        required
      />

      {/* 色彩選擇 */}
      <div>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
          標籤色彩
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: c,
                border: color === c ? '3px solid #ffffff' : 'none',
                cursor: 'pointer',
                boxShadow: color === c ? '0 0 10px ' + c : 'none',
                transition: 'transform 0.15s'
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-2)' }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
          {initialData ? '儲存變更' : '建立帳戶'}
        </Button>
      </div>
    </form>
  );
};
