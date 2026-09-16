import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType } from '@/types';
import { useAccounts, useCategories, useTransactions } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { addTransaction } from '@/services/firestore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CategoryPicker } from './CategoryPicker';
import { getUniqueMerchants, getMerchantPattern, MerchantPattern } from '@/utils/merchantPatterns';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { MapPin, Sparkles } from 'lucide-react';

interface TransactionFormProps {
  initialData?: Partial<Transaction>;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  initialData,
  onSuccess,
  onCancel
}) => {
  const { user, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { transactions } = useTransactions();

  const [type, setType] = useState<TransactionType>(() => {
    return initialData?.type || (sessionStorage.getItem('draft_tx_type') as TransactionType) || 'expense';
  });
  const [amount, setAmount] = useState<string>(() => {
    return initialData?.amount ? String(initialData.amount) : sessionStorage.getItem('draft_tx_amount') || '';
  });
  const [merchant, setMerchant] = useState<string>(() => {
    return initialData?.merchant || sessionStorage.getItem('draft_tx_merchant') || '';
  });
  const [appliedPattern, setAppliedPattern] = useState<MerchantPattern | null>(null);
  const [accountId, setAccountId] = useState<string>(initialData?.accountId || accounts[0]?.id || '');
  const [transferToAccountId, setTransferToAccountId] = useState<string>(initialData?.transferToAccountId || '');
  const [categoryId, setCategoryId] = useState<string>(initialData?.categoryId || '');
  const [date, setDate] = useState<string>(initialData?.date || format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState<string>(() => {
    return initialData?.note || sessionStorage.getItem('draft_tx_note') || '';
  });
  const [tagInput, setTagInput] = useState<string>(initialData?.tags ? initialData.tags.join(', ') : '');
  const [loading, setLoading] = useState(false);

  // 取得歷史常去商家清單
  const uniqueMerchants = useMemo(() => getUniqueMerchants(transactions), [transactions]);

  // 地點或商家輸入連動：自動推算並套用最常使用的消費模式
  const handleMerchantChange = (val: string) => {
    setMerchant(val);
    sessionStorage.setItem('draft_tx_merchant', val);

    if (val.trim().length >= 1) {
      const pattern = getMerchantPattern(val, transactions, categories, accounts);
      if (pattern) {
        if (pattern.type && pattern.type !== type) {
          setType(pattern.type);
        }
        if (pattern.categoryId) {
          setCategoryId(pattern.categoryId);
        }
        if (pattern.accountId) {
          setAccountId(pattern.accountId);
        }
        if (pattern.commonTag && !tagInput) {
          setTagInput(pattern.commonTag);
        }
        setAppliedPattern(pattern);
      } else {
        setAppliedPattern(null);
      }
    } else {
      setAppliedPattern(null);
    }
  };

  // 自動同步草稿至 sessionStorage
  const handleAmountChange = (val: string) => {
    setAmount(val);
    sessionStorage.setItem('draft_tx_amount', val);
  };

  const handleNoteChange = (val: string) => {
    setNote(val);
    sessionStorage.setItem('draft_tx_note', val);
  };

  const clearDraft = () => {
    sessionStorage.removeItem('draft_tx_amount');
    sessionStorage.removeItem('draft_tx_note');
    sessionStorage.removeItem('draft_tx_type');
    sessionStorage.removeItem('draft_tx_merchant');
  };

  // 根據收支類型過濾分類
  const filteredCategories = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));

  // 若尚未選取分類，預設選取第一項
  React.useEffect(() => {
    if (!categoryId && filteredCategories.length > 0) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [categoryId, filteredCategories]);

  // 若尚未選取帳戶，預設選取第一項
  React.useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast({ type: 'error', message: '請輸入有效的金額' });
      return;
    }

    if (!accountId) {
      addToast({ type: 'error', message: '請選擇付款/收款帳戶' });
      return;
    }

    if (type === 'transfer' && (!transferToAccountId || transferToAccountId === accountId)) {
      addToast({ type: 'error', message: '轉帳目標帳戶不能與轉出帳戶相同' });
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
      const transaction: Transaction = {
        id: initialData?.id || 'tx_' + uuidv4().slice(0, 10),
        userId: user.uid,
        accountId,
        categoryId: type === 'transfer' ? '' : categoryId,
        type,
        amount: parsedAmount,
        merchant: merchant.trim() || undefined,
        note: note.trim(),
        tags: tags.length > 0 ? tags : [],
        date,
        createdAt: initialData?.createdAt || now,
        updatedAt: now
      };

      if (type === 'transfer' && transferToAccountId) {
        transaction.transferToAccountId = transferToAccountId;
      }

      await addTransaction(transaction);
      clearDraft();
      addToast({ type: 'success', message: '記帳已儲存！' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {/* 交易類型切換 Tab */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
        {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => {
          const isActive = type === t;
          const label = t === 'expense' ? '支出' : t === 'income' ? '收入' : '轉帳';
          const activeColor = t === 'expense' ? 'var(--expense)' : t === 'income' ? 'var(--income)' : 'var(--info)';

          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setCategoryId('');
              }}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? activeColor : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 金額輸入 */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          金額 (NT$)
        </label>
        <div style={{ position: 'relative', marginTop: '4px' }}>
          <span
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '22px',
              fontWeight: 800,
              color: type === 'expense' ? 'var(--expense)' : type === 'income' ? 'var(--income)' : 'var(--info)'
            }}
          >
            $
          </span>
          <input
            type="number"
            step="any"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '12px 14px 12px 36px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '24px',
              fontWeight: 800,
              outline: 'none',
              fontFamily: 'var(--font-mono)'
            }}
          />
        </div>
      </div>

      {/* 地點或商家 (輸入時自動套用最常使用之消費模式) */}
      <div>
        <Input
          label="地點或商家"
          placeholder="例如：麥當勞、7-ELEVEN、全聯、星巴克"
          value={merchant}
          onChange={(e) => handleMerchantChange(e.target.value)}
          list="merchant-suggestions"
          icon={<MapPin size={16} />}
        />
        <datalist id="merchant-suggestions">
          {uniqueMerchants.map((m) => (
            <option key={m.name} value={m.name} />
          ))}
        </datalist>

        {/* 自動套用模式提示 */}
        {appliedPattern && (
          <div
            style={{
              marginTop: '6px',
              padding: '6px 10px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={14} />
            <span>
              已自動套用<strong>「{appliedPattern.merchant}」</strong>常用模式：
              {appliedPattern.categoryName && (
                <span style={{ color: appliedPattern.categoryColor || 'inherit', fontWeight: 700 }}>
                  {appliedPattern.categoryName}
                </span>
              )}
              {appliedPattern.categoryName && appliedPattern.accountName && ' • '}
              {appliedPattern.accountName && <span style={{ fontWeight: 600 }}>{appliedPattern.accountName}</span>}
            </span>
          </div>
        )}

        {/* 歷史常去商家快捷標籤 */}
        {!merchant && uniqueMerchants.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>常去：</span>
            {uniqueMerchants.slice(0, 5).map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => handleMerchantChange(m.name)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 帳戶選擇 */}
      <div style={{ display: 'grid', gridTemplateColumns: type === 'transfer' ? '1fr 1fr' : '1fr', gap: '10px' }}>
        <Select
          label={type === 'transfer' ? '轉出帳戶' : '帳戶'}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${a.name} ($${Math.round(a.balance).toLocaleString()})`
          }))}
        />

        {type === 'transfer' && (
          <Select
            label="轉入目標帳戶"
            value={transferToAccountId}
            onChange={(e) => setTransferToAccountId(e.target.value)}
            options={[
              { value: '', label: '請選擇目標帳戶' },
              ...accounts
                .filter((a) => a.id !== accountId)
                .map((a) => ({
                  value: a.id,
                  label: `${a.name} ($${Math.round(a.balance).toLocaleString()})`
                }))
            ]}
          />
        )}
      </div>

      {/* 分類選擇 (非轉帳時顯示) */}
      {type !== 'transfer' && (
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
            分類選擇
          </label>
          <CategoryPicker
            categories={filteredCategories}
            selectedId={categoryId}
            onSelect={(id) => setCategoryId(id)}
          />
        </div>
      )}

      {/* 日期與備註 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input
          type="date"
          label="日期"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <Input
          label="備註說明"
          placeholder="例如：午餐拉麵、搭計程車"
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
        />
      </div>

      {/* 標籤 (選填) */}
      <Input
        label="標籤 (以逗號分隔)"
        placeholder="例如：外食, 朋友聚餐, 報帳"
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
      />

      {/* 按鈕列 */}
      <div style={{ display: 'flex', gap: '10px', marginTop: 'var(--space-2)' }}>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} style={{ flex: 1 }}>
            取消
          </Button>
        )}
        <Button type="submit" variant="primary" loading={loading} style={{ flex: 1 }}>
          確認儲存
        </Button>
      </div>
    </form>
  );
};
