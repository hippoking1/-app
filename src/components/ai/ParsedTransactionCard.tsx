import React, { useState } from 'react';
import { ParsedTransaction, Account, Category, Transaction } from '@/types';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/utils/analytics';
import { Check, Trash2, Tag, Calendar, Wallet } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ParsedTransactionCardProps {
  transaction: ParsedTransaction;
  accounts: Account[];
  categories: Category[];
  onConfirm: (tx: Transaction) => void;
  onRemove: () => void;
}

export const ParsedTransactionCard: React.FC<ParsedTransactionCardProps> = ({
  transaction,
  accounts,
  categories,
  onConfirm,
  onRemove
}) => {
  // 自動匹配最佳分類與帳戶
  const matchedCat = categories.find((c) => c.name.includes(transaction.categoryName)) || categories[0];
  const matchedAcc = accounts.find((a) => a.name.includes(transaction.accountName || '')) || accounts[0];

  const [type, setType] = useState(transaction.type || 'expense');
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState(matchedCat?.id || '');
  const [accountId, setAccountId] = useState(matchedAcc?.id || '');
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note);

  const handleConfirm = () => {
    const parsedAmount = parseFloat(amount) || 0;
    if (parsedAmount <= 0) return;

    const now = new Date().toISOString();
    const finalTx: Transaction = {
      id: 'tx_ai_' + uuidv4().slice(0, 8),
      userId: '',
      accountId,
      categoryId,
      type,
      amount: parsedAmount,
      note,
      tags: transaction.tags || ['AI智能記帳'],
      date,
      aiGenerated: note,
      createdAt: now,
      updatedAt: now
    };

    onConfirm(finalTx);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginTop: '8px'
      }}
    >
      {/* 頂部：備註與金額 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="項目備註"
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: '1px dashed var(--border)',
            padding: '2px 0',
            outline: 'none',
            flex: 1
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: type === 'expense' ? 'var(--expense)' : 'var(--income)' }}>
            $
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              width: '90px',
              fontSize: '16px',
              fontWeight: 800,
              color: type === 'expense' ? 'var(--expense)' : 'var(--income)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 6px',
              textAlign: 'right',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 中間：分類與帳戶選擇下拉 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <Select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={categories.map((c) => ({
            value: c.id,
            label: `📁 ${c.name}`
          }))}
          style={{ padding: '6px 10px', fontSize: '12px' }}
        />

        <Select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={accounts.map((a) => ({
            value: a.id,
            label: `💳 ${a.name}`
          }))}
          style={{ padding: '6px 10px', fontSize: '12px' }}
        />
      </div>

      {/* 底部：日期與確認按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '12px',
            outline: 'none'
          }}
        />

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onRemove}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-disabled)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <Trash2 size={15} />
          </button>
          <Button variant="success" size="sm" onClick={handleConfirm} icon={<Check size={14} />}>
            確認寫入
          </Button>
        </div>
      </div>
    </div>
  );
};
