import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTransactions, useCategories, useBudgets } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { getMonthlyTrends, getCategoryBreakdown, getDailySpending, formatCurrency } from '@/utils/analytics';
import { fetchSpendingInsights } from '@/services/gas';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { Sparkles, TrendingUp, PieChart as PieIcon, BarChart3, Loader2 } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#0ea5e9', '#a855f7', '#ec4899', '#64748b'];

export const Analytics: React.FC = () => {
  const { currentMonth } = useAppStore();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { budgets } = useBudgets();

  const [insightText, setInsightText] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // 1. 月趨勢
  const monthlyData = getMonthlyTrends(transactions, 6);

  // 2. 分類佔比
  const expenseBreakdown = getCategoryBreakdown(transactions, categories, 'expense', currentMonth);

  // 3. 每日花費
  const { dailyData, totalExpense, avgDaily } = getDailySpending(transactions, currentMonth);

  // AI 洞察分析請求
  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    try {
      const summaryPayload = {
        month: currentMonth,
        totalExpense,
        avgDaily,
        topCategories: expenseBreakdown.items.slice(0, 3).map((c) => ({ name: c.name, amount: c.amount })),
        monthlyTrend: monthlyData
      };
      const text = await fetchSpendingInsights(summaryPayload);
      setInsightText(text);
    } catch (err: any) {
      setInsightText('目前無法取得 AI 分析報告，請稍後再試。');
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* 頂部標題與 AI 分析觸發按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
            財務圖表與花費分析
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            多維度洞察您的金錢流向與儲蓄狀況
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleGenerateInsights}
          loading={loadingInsights}
          icon={<Sparkles size={16} />}
        >
          產出 AI 財務健檢
        </Button>
      </div>

      {/* AI 財務健檢建議卡片 */}
      {insightText && (
        <Card glass padding="lg" style={{ border: '1px solid var(--purple)', backgroundColor: 'rgba(168, 85, 247, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--purple)', fontWeight: 800, fontSize: '15px' }}>
            <Sparkles size={18} /> Gemini 3.7 Flash 財務洞察報告
          </div>
          <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
            {insightText}
          </div>
        </Card>
      )}

      {/* 1. 近半年收支趨勢圖 */}
      <Card glass padding="lg">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={18} color="var(--primary-light)" /> 近半年收支趨勢折線圖
        </h3>
        <div style={{ width: '100%', height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--income)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--income)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--expense)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--expense)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: '8px' }}
                formatter={(value: any) => formatCurrency(Number(value) || 0)}
              />
              <Legend />
              <Area type="monotone" dataKey="income" name="收入" stroke="var(--income)" fillOpacity={1} fill="url(#incomeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="支出" stroke="var(--expense)" fillOpacity={1} fill="url(#expenseGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 2. 本月分類佔比圓餅圖 + 排行榜 (雙欄 Grid) */}
      <div className="grid-2">
        {/* 圓餅圖 */}
        <Card glass padding="lg">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={18} color="var(--purple)" /> 本月支出分類佔比
          </h3>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseBreakdown.items}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {expenseBreakdown.items.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  formatter={(val: any) => formatCurrency(Number(val) || 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 排行榜 */}
        <Card glass padding="lg">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            🏆 支出排行榜 TOP 5
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expenseBreakdown.items.slice(0, 5).map((item, index) => (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ fontWeight: 600 }}>
                    {index + 1}. {item.name}
                  </span>
                  <span className="font-mono" style={{ fontWeight: 700 }}>
                    {formatCurrency(item.amount)} ({item.percentage}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.percentage}%`,
                      height: '100%',
                      backgroundColor: COLORS[index % COLORS.length],
                      borderRadius: 'var(--radius-full)'
                    }}
                  />
                </div>
              </div>
            ))}

            {expenseBreakdown.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                本月尚無任何支出記錄
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* 3. 本月每日花費柱狀圖 */}
      <Card glass padding="lg">
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} color="var(--info)" /> 本月每日花費分佈
        </h3>
        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} interval={2} />
              <YAxis stroke="var(--text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: '8px' }}
                formatter={(val: any) => formatCurrency(Number(val) || 0)}
              />
              <Bar dataKey="amount" name="花費" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
