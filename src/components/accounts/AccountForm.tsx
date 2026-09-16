import React, { useState, useMemo } from 'react';
import { Account, AccountType } from '@/types';
import { useAppStore } from '@/stores/appStore';
import { useTransactions } from '@/hooks/useFirestore';
import { calculateCashWalletUsage, calculateCreditCardUsage } from '@/utils/accountCalculations';
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
  const { transactions } = useTransactions();

  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState<AccountType>(initialData?.type || 'bank');
  // 信用卡餘額若為負數轉為正數展示方便使用者理解，現金與銀行正常展示
  const [balance, setBalance] = useState<string>(
    initialData
      ? String(initialData.type === 'credit_card' ? Math.abs(initialData.balance) : initialData.balance)
      : '0'
  );
  const [creditLimit, setCreditLimit] = useState<string>(
    initialData?.creditLimit ? String(initialData.creditLimit) : '50000'
  );
  const [billingCycleDay, setBillingCycleDay] = useState<number>(
    initialData?.billingCycleDay || 10
  );
  const [color, setColor] = useState(initialData?.color || PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  // 現金錢包即時統計本月已使用額度
  const cashUsage = useMemo(() => {
    if (type !== 'cash' || !initialData) return null;
    return calculateCashWalletUsage(initialData, transactions);
  }, [type, initialData, transactions]);

  // 信用卡即時結帳週期推算
  const cardCycleInfo = useMemo(() => {
    if (type !== 'credit_card') return null;
    const tempAcc: Account = {
      id: initialData?.id || 'temp',
      userId: user?.uid || '',
      name,
      type: 'credit_card',
      icon: 'CreditCard',
      color,
      balance: parseFloat(balance) || 0,
      creditLimit: parseFloat(creditLimit) || 50000,
      billingCycleDay,
      currency: 'TWD',
      isArchived: false,
      sortOrder: 0,
      createdAt: '',
      updatedAt: ''
    };
    return calculateCreditCardUsage(tempAcc, transactions);
  }, [type, initialData, user, name, color, balance, creditLimit, billingCycleDay, transactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      addToast({ type: 'error', message: '請輸入帳戶名稱' });
      return;
    }

    const rawNumBalance = parseFloat(balance) || 0;
    // 信用卡在內部記錄為負債（若非 0 則保持負值），若為 0 則為 0
    const numBalance = type === 'credit_card'
      ? (rawNumBalance === 0 ? 0 : -Math.abs(rawNumBalance))
      : rawNumBalance;
    const numCreditLimit = type === 'credit_card' ? parseFloat(creditLimit) || 0 : undefined;
    const numBillingDay = type === 'credit_card' ? Number(billingCycleDay) || 10 : undefined;
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
        creditLimit: numCreditLimit,
        billingCycleDay: numBillingDay,
        usedAmountThisMonth: type === 'cash' ? (cashUsage?.currentMonthSpent || 0) : undefined,
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

  const parsedBalance = parseFloat(balance) || 0;

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
        onChange={(e) => {
          const newType = e.target.value as AccountType;
          setType(newType);
          if (newType === 'cash' && parsedBalance < 0) {
            setBalance('0');
          }
        }}
        options={ACCOUNT_TYPES}
      />

      {/* 現金錢包專屬區塊：已使用額度與 0 餘額模式 */}
      {type === 'cash' && (
        <div
          style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--income)' }}>
              💵 本月已使用額度
            </span>
            <span className="font-mono" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              ${cashUsage ? cashUsage.currentMonthSpent.toLocaleString() : '0'}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            🗓️ 系統將在<strong>每月 1 號自動歸零重新計算</strong>本月現金已用額度。
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px dashed rgba(16, 185, 129, 0.2)', paddingTop: '6px' }}>
            💡 <strong>純已用額度模式：</strong>當「目前帳戶餘額」設為 <strong>0</strong> 時，系統預設<strong>不扣減餘額</strong>，只記錄每月已使用額度（適合日常只記現金花費、不記錄領錢收入的使用者）。
          </div>
        </div>
      )}

      {/* 餘額輸入 */}
      <div>
        <Input
          label={
            type === 'credit_card'
              ? '目前已刷卡未出帳金額 / 應繳金額 (NT$)'
              : type === 'cash' && parsedBalance === 0
              ? '目前帳戶餘額 (NT$) - 已啟用純已用額度模式'
              : '目前帳戶餘額 (NT$)'
          }
          type="number"
          step="any"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          required
        />

        {/* 若為現金錢包且餘額小於 0 (例如 -7,130)，提供一鍵重置為 0 */}
        {type === 'cash' && parsedBalance < 0 && (
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px'
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--expense)' }}>
              目前餘額為負數 (${parsedBalance.toLocaleString()})
            </span>
            <button
              type="button"
              onClick={() => setBalance('0')}
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: 'var(--expense)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              設為 0 (啟用純額度模式)
            </button>
          </div>
        )}
      </div>

      {/* 信用卡專屬：帳單結帳日與總額度 */}
      {type === 'credit_card' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              帳單結帳日（每月幾號）
            </label>
            <select
              value={billingCycleDay}
              onChange={(e) => setBillingCycleDay(Number(e.target.value))}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none'
              }}
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  每月 {day} 號結帳
                </option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              🗓️ 系統預設在<strong>結帳日後自動將已用額度歸零重新計算</strong>下一期。
              {cardCycleInfo && (
                <div style={{ color: 'var(--primary-light)', marginTop: '2px', fontWeight: 600 }}>
                  當前帳單週期：{cardCycleInfo.cycleStartDate} ~ {cardCycleInfo.cycleEndDate}
                  {cardCycleInfo.daysRemaining === 0 ? '（今日結帳）' : `（剩 ${cardCycleInfo.daysRemaining} 天結帳）`}
                </div>
              )}
            </div>
          </div>

          <Input
            label="信用卡信用總額度 (NT$)"
            type="number"
            step="any"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="例如：50000、180000"
            required
          />
        </>
      )}

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
