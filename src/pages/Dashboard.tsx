import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { useAccounts, useTransactions, useCategories, useBudgets, useStockHoldings, useTotalNetWorth } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { formatCurrency } from '@/utils/analytics';
import { calculateBudgetStatuses, getDailyAllowance } from '@/utils/budget';
import { calculatePortfolioSummary } from '@/utils/stockCalculations';
import {
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Target,
  ChevronRight,
  WalletCards
} from 'lucide-react';
import * as Icons from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentMonth, setTransactionModalOpen } = useAppStore();

  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { transactions } = useTransactions({ month: currentMonth });
  const { budgets } = useBudgets();
  const { holdings } = useStockHoldings();
  const { totalNetWorth, cashTotal, stockTotalTWD } = useTotalNetWorth();

  // 本月收支計算
  const monthIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  // 預算狀態
  const budgetStatuses = calculateBudgetStatuses(budgets, transactions, categories, currentMonth);
  const globalBudget = budgetStatuses.find((b) => !b.budget.categoryId) || budgetStatuses[0];
  const { dailyAllowance, remainingDays } = getDailyAllowance(
    globalBudget ? globalBudget.budget.amount : 0,
    monthExpense,
    currentMonth
  );

  // 股票投資組合摘要
  const portfolioSummary = calculatePortfolioSummary(holdings);

  // 最近 5 筆交易
  const recentTransactions = transactions.slice(0, 5);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部總覽區塊 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
            財務總覽
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {currentMonth} 月度財務健康報表
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/ai')}
            icon={<Sparkles size={16} color="var(--purple)" />}
          >
            AI 記帳
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setTransactionModalOpen(true)}
            icon={<Plus size={16} />}
          >
            記一筆
          </Button>
        </div>
      </div>

      {/* KPI 卡片 Grid (3 欄) */}
      <div className="grid-3">
        {/* 1. 總資產卡片 */}
        <Card glass interactive style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              淨資產估計 (現金 + 股票)
            </div>
            <div className="font-mono" style={{ fontSize: '28px', fontWeight: 900, marginTop: '6px', color: 'var(--text-primary)' }}>
              {formatCurrency(totalNetWorth)}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>現金: <strong>{formatCurrency(cashTotal)}</strong></span>
            <span style={{ color: 'var(--text-secondary)' }}>股票: <strong>{formatCurrency(stockTotalTWD)}</strong></span>
          </div>
        </Card>

        {/* 2. 本月收支卡片 */}
        <Card glass interactive style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              本月結餘 (收入 - 支出)
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: '28px',
                fontWeight: 900,
                marginTop: '6px',
                color: monthBalance >= 0 ? 'var(--income)' : 'var(--expense)'
              }}
            >
              {monthBalance >= 0 ? '+' : ''}{formatCurrency(monthBalance)}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--income)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <ArrowDownLeft size={14} /> 收入 {formatCurrency(monthIncome)}
            </span>
            <span style={{ color: 'var(--expense)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={14} /> 支出 {formatCurrency(monthExpense)}
            </span>
          </div>
        </Card>

        {/* 3. 股票投資收益 */}
        <Card glass interactive onClick={() => navigate('/stocks')} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                股票投資組合損益
              </div>
              <div
                className="font-mono"
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  marginTop: '6px',
                  color: portfolioSummary.totalProfitLossTWD >= 0 ? 'var(--income)' : 'var(--expense)'
                }}
              >
                {portfolioSummary.totalProfitLossTWD >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.totalProfitLossTWD)}
              </div>
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: portfolioSummary.totalReturnRate >= 0 ? 'var(--income)' : 'var(--expense)',
                backgroundColor: portfolioSummary.totalReturnRate >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-full)'
              }}
            >
              {portfolioSummary.totalReturnRate >= 0 ? '+' : ''}{portfolioSummary.totalReturnRate}%
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>總市值: {formatCurrency(portfolioSummary.totalMarketValueTWD)}</span>
            <span style={{ color: 'var(--purple)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
              查看持倉 <ChevronRight size={14} />
            </span>
          </div>
        </Card>
      </div>

      {/* 預算進度條區塊 */}
      {globalBudget && (
        <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '6px', backgroundColor: 'var(--primary-glow)', borderRadius: 'var(--radius-sm)', color: 'var(--primary)' }}>
                <Target size={18} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  本月總預算執行進度
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  已支出 {formatCurrency(globalBudget.spent)} / 預算 {formatCurrency(globalBudget.budget.amount)}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>每日建議花費上限</span>
              <div className="font-mono" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatCurrency(dailyAllowance)} /天 (剩 {remainingDays} 天)
              </div>
            </div>
          </div>

          <ProgressBar value={globalBudget.usageRatio * 100} max={100} height={12} showLabel />
        </Card>
      )}

      {/* 帳戶餘額清單 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <WalletCards size={18} color="var(--primary-light)" /> 帳戶資產分佈
          </h3>
          <button
            onClick={() => navigate('/accounts')}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary-light)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            管理帳戶 <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid-3">
          {accounts.map((acc) => {
            const IconComponent = (Icons as any)[acc.icon] || Icons.Building2;
            return (
              <Card key={acc.id} interactive padding="md" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: `${acc.color}25`,
                    color: acc.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <IconComponent size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {acc.name}
                  </div>
                  <div className="font-mono" style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px', color: acc.balance < 0 ? 'var(--expense)' : 'var(--text-primary)' }}>
                    {formatCurrency(acc.balance)}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 最近交易列表 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
            🕒 最近交易記錄
          </h3>
          <button
            onClick={() => navigate('/transactions')}
            style={{ background: 'transparent', border: 'none', color: 'var(--primary-light)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
          >
            查看全部明細 <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {recentTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              category={categoryMap.get(tx.categoryId)}
              account={accountMap.get(tx.accountId)}
              targetAccount={tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) : undefined}
            />
          ))}

          {recentTransactions.length === 0 && (
            <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '14px' }}>
              本月尚無任何交易記錄，點擊上方按鈕立即開始記帳！
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
