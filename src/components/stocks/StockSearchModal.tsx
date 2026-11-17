import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useStockSearch } from '@/hooks/useStockPrice';
import { StockSearchResult } from '@/types';
import { Search, PlusCircle, Loader2, ArrowRight } from 'lucide-react';
import { formatStockPrice } from '@/utils/analytics';

interface StockSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock: (stock: StockSearchResult) => void;
}

export const StockSearchModal: React.FC<StockSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectStock
}) => {
  const { keyword, setKeyword, results, loading } = useStockSearch();

  const handleSelect = (item: StockSearchResult) => {
    onSelectStock(item);
    onClose();
  };

  const trimmed = keyword.trim();
  const isNumericCode = /^\d+$/.test(trimmed);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="搜尋股票行情 (台股 / 興櫃 / 美股)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Input
          placeholder="輸入代碼或名稱，例如 2330、台積電、AAPL"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          icon={<Search size={16} strokeWidth={1.5} />}
          autoFocus
        />

        {/* 只要有輸入代碼，始終提供「以代碼建立持倉」快捷列 */}
        {trimmed && (
          <button
            type="button"
            onClick={() =>
              handleSelect({
                symbol: isNumericCode ? `${trimmed}.TW` : trimmed.toUpperCase(),
                code: trimmed.toUpperCase(),
                name: trimmed.toUpperCase(),
                market: isNumericCode ? 'TW' : 'US',
                currency: isNumericCode ? 'TWD' : 'USD',
                price: 0
              })
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              backgroundColor: 'var(--accent-subtle)',
              border: '1px solid var(--border-focus)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={16} strokeWidth={1.5} color="var(--accent-text)" />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                直接以「{trimmed}」建立興櫃 / 自訂持倉
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--accent-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              建倉 <ArrowRight size={14} strokeWidth={1.5} />
            </span>
          </button>
        )}

        {/* 搜尋中狀態 */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '8px', color: 'var(--text-muted)' }}>
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
            <span>查詢行情中</span>
          </div>
        )}

        {/* 搜尋結果列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
          {results.map((item) => (
            <button
              key={item.symbol}
              onClick={() => handleSelect(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s var(--ease-out)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-focus)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: item.market === 'TW' ? 'var(--accent-text)' : 'var(--text-secondary)'
                  }}
                >
                  {item.stockType || item.market}
                </span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>
                    {item.code} {item.name}
                  </div>
                  <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {item.symbol}
                  </div>
                </div>
              </div>

              {item.price > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <div className="font-mono" style={{ fontSize: '14px', fontWeight: 500 }}>
                    {item.currency === 'USD' ? 'US$' : '$'}
                    {formatStockPrice(item.price, item.currency)}
                  </div>
                  {item.change !== undefined && item.change !== 0 && (
                    <div className="font-mono" style={{ fontSize: '12px', color: item.change > 0 ? 'var(--gain)' : 'var(--loss)' }}>
                      {item.change > 0 ? '+' : ''}{item.change}
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};
