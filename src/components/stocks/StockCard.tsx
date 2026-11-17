import React from 'react';
import { StockHolding } from '@/types';
import { Card } from '@/components/ui/Card';
import { calculateHoldingProfitLoss } from '@/utils/stockCalculations';
import { formatStockPrice } from '@/utils/analytics';
import { deleteStockHolding } from '@/services/firestore';
import { useAppStore } from '@/stores/appStore';
import { TrendingUp, TrendingDown, Trash2, PlusCircle } from 'lucide-react';

interface StockCardProps {
  holding: StockHolding;
  onTrade?: (holding: StockHolding) => void;
}

export const StockCard: React.FC<StockCardProps> = ({ holding, onTrade }) => {
  const { addToast } = useAppStore();
  const pl = calculateHoldingProfitLoss(holding);
  const isUp = pl.profitLoss >= 0;
  const currPrefix = holding.market === 'US' ? 'US$' : '$';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`確定要將「${holding.name} (${holding.symbol})」從持倉移除嗎？`)) {
      try {
        await deleteStockHolding(holding.userId, holding.id);
        addToast({ type: 'info', message: '已移除股票持倉' });
      } catch (err: any) {
        addToast({ type: 'error', message: '移除失敗: ' + err.message });
      }
    }
  };

  return (
    <Card
      interactive
      onClick={() => onTrade && onTrade(holding)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: onTrade ? 'pointer' : 'default'
      }}
    >
      {/* 頂部股票代碼與現價 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: holding.market === 'TW' ? 'var(--accent-text)' : 'var(--text-secondary)'
              }}
            >
              {holding.market}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
              {holding.name}
            </span>
          </div>
          <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {holding.symbol} · {holding.shares.toLocaleString()} 股
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="font-mono" style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {currPrefix}{formatStockPrice(holding.currentPrice || holding.avgCost, holding.currency)}
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: isUp ? 'var(--gain)' : 'var(--loss)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '4px',
              marginTop: '2px'
            }}
          >
            {isUp ? <TrendingUp size={12} strokeWidth={1.5} /> : <TrendingDown size={12} strokeWidth={1.5} />}
            <span>{isUp ? '+' : ''}{pl.returnRate}%</span>
          </div>
        </div>
      </div>

      {/* 損益與市值數據 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: 'var(--bg-tertiary)',
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          gap: '8px',
          fontSize: '12px'
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>持有總市值</span>
          <div className="font-mono" style={{ fontSize: '14px', fontWeight: 500, marginTop: '2px', color: 'var(--text-primary)' }}>
            {currPrefix}{Math.round(pl.marketValue).toLocaleString()}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ color: 'var(--text-muted)' }}>未實現損益</span>
          <div
            className="font-mono"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              marginTop: '2px',
              color: isUp ? 'var(--gain)' : 'var(--loss)'
            }}
          >
            {isUp ? '+' : ''}{currPrefix}{Math.round(pl.profitLoss).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 年化與季化報酬率分析列 */}
      <div
        className="font-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          padding: '6px 10px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          flexWrap: 'wrap',
          gap: '4px'
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          持有 {pl.daysHeld} 天
        </span>

        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ color: pl.annualizedReturnRate >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 500 }}>
            年化 {pl.annualizedReturnRate >= 0 ? '+' : ''}{pl.annualizedReturnRate}%
          </span>
          <span style={{ color: pl.quarterlyReturnRate >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 500 }}>
            季化 {pl.quarterlyReturnRate >= 0 ? '+' : ''}{pl.quarterlyReturnRate}%
          </span>
        </div>
      </div>

      {/* 底部操作按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
        <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          均價 {currPrefix}{formatStockPrice(holding.avgCost, holding.currency)}
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onTrade) onTrade(holding);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 500
            }}
          >
            <PlusCircle size={14} strokeWidth={1.5} /> 交易 / 除權息
          </button>

          <button
            onClick={handleDelete}
            aria-label="移除股票持倉"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-disabled)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </Card>
  );
};
