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
        gap: '12px'
      }}
    >
      {/* 頂部股票代碼與現價 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: holding.market === 'TW' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                color: holding.market === 'TW' ? 'var(--income)' : 'var(--primary-light)'
              }}
            >
              {holding.market}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {holding.name}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {holding.symbol} • 持有 {holding.shares.toLocaleString()} 股
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div className="font-mono" style={{ fontSize: '16px', fontWeight: 800 }}>
            {currPrefix}{formatStockPrice(holding.currentPrice || holding.avgCost, holding.currency)}
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: isUp ? 'var(--income)' : 'var(--expense)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '2px'
            }}
          >
            {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
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
          <div className="font-mono" style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
            {currPrefix}{Math.round(pl.marketValue).toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)' }}>未實現損益</span>
          <div
            className="font-mono"
            style={{
              fontSize: '14px',
              fontWeight: 700,
              marginTop: '2px',
              color: isUp ? 'var(--income)' : 'var(--expense)'
            }}
          >
            {isUp ? '+' : ''}{currPrefix}{Math.round(pl.profitLoss).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 底部操作按鈕 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          均價: {currPrefix}{formatStockPrice(holding.avgCost, holding.currency)}
        </span>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onTrade) onTrade(holding);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary-light)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            <PlusCircle size={14} /> 加碼/調整
          </button>

          <button
            onClick={handleDelete}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-disabled)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </Card>
  );
};
