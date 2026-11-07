import React, { useState, useMemo } from 'react';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  getUserPinnedCurrencies,
  addPinnedCurrency,
  removePinnedCurrency,
  setUserPinnedCurrencies,
  DEFAULT_PINNED_CURRENCIES,
  formatExchangeRate
} from '@/services/exchangeRate';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Plus, X, Search, Check, Settings2, RotateCcw, Globe } from 'lucide-react';
import { hapticLight } from '@/utils/haptics';

interface CurrencySelectorProps {
  selectedCurrency: string;
  onSelectCurrency: (code: string) => void;
  includeTWD?: boolean;
  label?: string;
  showManageTrigger?: boolean;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  selectedCurrency,
  onSelectCurrency,
  includeTWD = false,
  label,
  showManageTrigger = true
}) => {
  const [pinnedCurrencies, setPinnedCurrencies] = useState<string[]>(() =>
    getUserPinnedCurrencies(includeTWD)
  );
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [searchKw, setSearchKw] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // 確保選中的幣別若在 pinned 以外，也能暫時展示在清單中
  const displayCurrencies = useMemo(() => {
    const list = [...pinnedCurrencies];
    if (includeTWD && !list.includes('TWD')) {
      list.unshift('TWD');
    }
    if (selectedCurrency && !list.includes(selectedCurrency)) {
      list.push(selectedCurrency);
    }
    return list;
  }, [pinnedCurrencies, selectedCurrency, includeTWD]);

  // 新增貨幣
  const handleAdd = (code: string) => {
    hapticLight();
    const updated = addPinnedCurrency(code);
    setPinnedCurrencies(includeTWD ? ['TWD', ...updated] : updated);
    onSelectCurrency(code);
    setIsManageModalOpen(false);
  };

  // 移除貨幣
  const handleRemove = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    hapticLight();
    if (code === 'TWD' && includeTWD) return; // TWD 不可移除
    const updated = removePinnedCurrency(code);
    setPinnedCurrencies(includeTWD ? ['TWD', ...updated] : updated);

    // 若被移除的正好是當前選中的幣別，自動切換至第一個
    if (selectedCurrency === code) {
      onSelectCurrency(updated[0] || (includeTWD ? 'TWD' : 'JPY'));
    }
  };

  // 恢復預設貨幣清單
  const handleResetDefaults = () => {
    hapticLight();
    setUserPinnedCurrencies(DEFAULT_PINNED_CURRENCIES);
    const updated = includeTWD ? ['TWD', ...DEFAULT_PINNED_CURRENCIES] : [...DEFAULT_PINNED_CURRENCIES];
    setPinnedCurrencies(updated);
    if (!updated.includes(selectedCurrency)) {
      onSelectCurrency(updated[0]);
    }
  };

  // 過濾搜尋全球所有支援的貨幣
  const filteredAllCurrencies = useMemo(() => {
    const kw = searchKw.trim().toLowerCase();
    return SUPPORTED_CURRENCIES.filter((c) => {
      if (!includeTWD && c.code === 'TWD') return false;
      if (!kw) return true;
      return (
        c.code.toLowerCase().includes(kw) ||
        c.name.toLowerCase().includes(kw) ||
        c.symbol.toLowerCase().includes(kw)
      );
    });
  }, [searchKw, includeTWD]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {label}
          </span>
          {showManageTrigger && (
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isEditMode ? 'var(--primary-light)' : 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              <Settings2 size={12} />
              <span>{isEditMode ? '完成管理' : '增刪自訂'}</span>
            </button>
          )}
        </div>
      )}

      {/* 快捷幣別按鈕列（支援平滑換行與高對比標籤） */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        {displayCurrencies.map((code) => {
          const isSelected = selectedCurrency === code;
          const info = getCurrencyInfo(code);
          const isTwd = code === 'TWD';

          return (
            <div
              key={code}
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onSelectCurrency(code);
                }}
                style={{
                  padding: isEditMode && !isTwd ? '5px 24px 5px 10px' : '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--primary-light)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: isSelected ? 800 : 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.25)' : 'none'
                }}
              >
                <span style={{ fontSize: '14px', lineHeight: 1 }}>{info.flag}</span>
                <span>{info.code}</span>
              </button>

              {/* 編輯刪除模式下的 ✕ 刪除按鈕 */}
              {isEditMode && !isTwd && (
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, code)}
                  aria-label={`移除 ${code}`}
                  title={`移除 ${code}`}
                  style={{
                    position: 'absolute',
                    right: '4px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.25)',
                    color: 'var(--expense)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </div>
          );
        })}

        {/* ➕ 新增各國貨幣按鈕 */}
        <button
          type="button"
          onClick={() => {
            hapticLight();
            setSearchKw('');
            setIsManageModalOpen(true);
          }}
          title="搜尋並新增全球貨幣..."
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px dashed var(--border-focus)',
            color: 'var(--primary-light)',
            fontSize: '12px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>新增貨幣</span>
        </button>

        {showManageTrigger && !label && (
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            title={isEditMode ? '完成編輯' : '增刪自訂貨幣'}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              border: 'none',
              color: isEditMode ? 'var(--primary-light)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Settings2 size={14} />
          </button>
        )}
      </div>

      {/* 自由增刪各國貨幣全域彈窗 Modal (使用 Portal 掛載於 document.body，永不截斷) */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Globe size={18} color="var(--primary)" />
            <span>選擇或新增各國貨幣</span>
          </div>
        }
        maxWidth="560px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 搜尋框 */}
          <Input
            placeholder="搜尋國家名稱、幣別代碼（例如：泰國、日圓、CHF、歐元）..."
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
            icon={<Search size={16} />}
            autoFocus
          />

          {/* 目前常用提示與重設按鈕 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              padding: '0 2px'
            }}
          >
            <span>常用貨幣：{pinnedCurrencies.join(' · ')}</span>
            <button
              type="button"
              onClick={handleResetDefaults}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary-light)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              <RotateCcw size={11} />
              <span>重設回預設</span>
            </button>
          </div>

          {/* 全球貨幣格狀列表 */}
          <div
            style={{
              maxHeight: '380px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '10px',
              paddingRight: '4px',
              paddingBottom: '4px'
            }}
          >
            {filteredAllCurrencies.map((c) => {
              const isPinned = pinnedCurrencies.includes(c.code);
              const isSelected = selectedCurrency === c.code;

              return (
                <div
                  key={c.code}
                  onClick={() => {
                    if (isPinned) {
                      onSelectCurrency(c.code);
                      setIsManageModalOpen(false);
                    } else {
                      handleAdd(c.code);
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: isSelected
                      ? 'rgba(99, 102, 241, 0.18)'
                      : isPinned
                      ? 'var(--bg-tertiary)'
                      : 'var(--bg-secondary)',
                    border: isSelected
                      ? '1.5px solid var(--primary)'
                      : isPinned
                      ? '1px solid var(--border-focus)'
                      : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 10px rgba(99, 102, 241, 0.2)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{c.flag}</span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: isSelected ? 'var(--primary-light)' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {c.code}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {c.name}
                      </div>
                      {c.code !== 'TWD' && (
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          ≈ {formatExchangeRate(c.defaultRateToTWD)} NT$
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    {isPinned ? (
                      <span
                        style={{
                          color: 'var(--income)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 700
                        }}
                      >
                        <Check size={12} style={{ marginRight: '2px' }} />
                        已加
                      </span>
                    ) : (
                      <span
                        style={{
                          color: 'var(--primary-light)',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(99, 102, 241, 0.12)',
                          padding: '3px 6px',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        +加入
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button variant="secondary" size="sm" onClick={() => setIsManageModalOpen(false)}>
              關閉視窗
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
