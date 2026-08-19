import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { useTransactions, useCategories, useAccounts } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { formatCurrency } from '@/utils/analytics';
import { TransactionType } from '@/types';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { Search, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export const Transactions: React.FC = () => {
  const { currentMonth, setCurrentMonth, setTransactionModalOpen } = useAppStore();
  const { transactions } = useTransactions({ month: currentMonth });
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  // 月份導航
  const handlePrevMonth = () => {
    const prev = subMonths(parseISO(`${currentMonth}-01`), 1);
    setCurrentMonth(format(prev, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const next = addMonths(parseISO(`${currentMonth}-01`), 1);
    setCurrentMonth(format(next, 'yyyy-MM'));
  };

  // 過濾邏輯
  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId && t.transferToAccountId !== selectedAccountId) return false;
    if (selectedCategoryId !== 'all' && t.categoryId !== selectedCategoryId) return false;
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      const matchNote = t.note?.toLowerCase().includes(kw);
      const matchTag = t.tags?.some((tag) => tag.toLowerCase().includes(kw));
      if (!matchNote && !matchTag) return false;
    }
    return true;
  });

  // 按日期分組
  const dateGroups = new Map<string, typeof filtered>();
  filtered.forEach((tx) => {
    const list = dateGroups.get(tx.date) || [];
    list.push(tx);
    dateGroups.set(tx.date, list);
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // 本月過濾後的收支統計
  const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* 頂部月份控制與新增按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handlePrevMonth}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <span style={{ fontSize: '18px', fontWeight: 800, minWidth: '90px', textAlign: 'center' }}>
            {currentMonth}
          </span>
          <button
            onClick={handleNextMonth}
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setTransactionModalOpen(true)}
          icon={<Plus size={16} />}
        >
          新增交易
        </Button>
      </div>

      {/* 月度收支摘要卡片 */}
      <div className="grid-2">
        <Card padding="sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>本期總支出</span>
          <span className="font-mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--expense)' }}>
            -{formatCurrency(totalExpense)}
          </span>
        </Card>
        <Card padding="sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>本期總收入</span>
          <span className="font-mono" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--income)' }}>
            +{formatCurrency(totalIncome)}
          </span>
        </Card>
      </div>

      {/* 搜尋與過濾條件工具列 */}
      <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Input
          placeholder="搜尋備註關鍵字、標籤 (例如：全聯、聚餐、車資)..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          icon={<Search size={16} />}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            options={[
              { value: 'all', label: '全部類型' },
              { value: 'expense', label: '僅支出' },
              { value: 'income', label: '僅收入' },
              { value: 'transfer', label: '僅轉帳' }
            ]}
          />

          <Select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={[
              { value: 'all', label: '全部帳戶' },
              ...accounts.map((a) => ({ value: a.id, label: a.name }))
            ]}
          />

          <Select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            options={[
              { value: 'all', label: '全部分類' },
              ...categories.map((c) => ({ value: c.id, label: c.name }))
            ]}
          />
        </div>
      </Card>

      {/* 按日期分組的交易清單 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {Array.from(dateGroups.entries()).map(([dateStr, items]) => {
          const dayExpense = items.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          const dayIncome = items.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

          return (
            <div key={dateStr} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* 日期小計列 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-muted)'
                }}
              >
                <span>{dateStr}</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {dayExpense > 0 && <span style={{ color: 'var(--expense)' }}>支 {formatCurrency(dayExpense)}</span>}
                  {dayIncome > 0 && <span style={{ color: 'var(--income)' }}>收 {formatCurrency(dayIncome)}</span>}
                </div>
              </div>

              {/* 當日明細項目 */}
              {items.map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  category={categoryMap.get(tx.categoryId)}
                  account={accountMap.get(tx.accountId)}
                  targetAccount={tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) : undefined}
                />
              ))}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            查無符合條件的收支明細
          </Card>
        )}
      </div>
    </div>
  );
};
