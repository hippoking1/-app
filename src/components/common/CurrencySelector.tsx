import React, { useState, useMemo } from 'react';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  getUserPinnedCurrencies,
  addPinnedCurrency,
  removePinnedCurrency,
  setUserPinnedCurrencies,
  DEFAULT_PINNED_CURRENCIES
} from '@/services/exchangeRate';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Plus, X, Search, Check, Settings2, RotateCcw } from 'lucide-react';
import { hapticLight } from '@/utils/haptics';

interface CurrencySelectorProps {
  selectedCurrency: string;
  onSelectCurrency: (code: string) => void;
  includeTWD?: boolean;
  label?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  selectedCurrency,
  onSelectCurrency,
  includeTWD = false,
  label
}) => {
  const [pinnedCurrencies, setPinnedCurrencies] = useState<string[]>(() =>
    getUserPinnedCurrencies(includeTWD)
  );
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [searchKw, setSearchKw] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);

  // 確保選中的幣別如果在 pinnedCurrencies 以外，也臨時展示在按鈕列中
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

  // 過濾搜尋所有支援的貨幣
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {label}
          </span>
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
            <span>{isEditMode ? '完成管理' : '增刪管理'}</span>
          </button>
        </div>
      )}

      {/* 快捷幣別按鈕列 */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                  padding: isEditMode && !isTwd ? '4px 22px 4px 8px' : '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-tertiary)',
                  color: isSelected ? 'var(--primary-light)' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: isSelected ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  userSelect: 'none'
                }}
              >
                <span>{info.flag}</span>
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
                    right: '3px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
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
          title="新增更多國家貨幣..."
          style={{
            padding: '4px 9px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px dashed var(--border-focus)',
            color: 'var(--primary-light)',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Plus size={13} />
          <span>新增貨幣</span>
        </button>

        {!label && (
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            title={isEditMode ? '完成編輯' : '增刪自訂貨幣'}
            style={{
              padding: '4px 6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              border: 'none',
              color: isEditMode ? 'var(--primary-light)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Settings2 size={13} />
          </button>
        )}
      </div>

      {/* 自由增刪各國貨幣 Modal */}
      <Modal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        title="🌐 自由新增各國貨幣"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 搜尋框 */}
          <Input
            placeholder="搜尋國家名稱、幣別代碼 (例如：泰國、THB、歐元、CHF)..."
            value={searchKw}
            onChange={(e) => setSearchKw(e.target.value)}
            icon={<Search size={16} />}
            autoFocus
          />

          {/* 目前已加入提示與重設按鈕 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>已加入常用：{displayCurrencies.join('、')}</span>
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
                gap: '2px',
                fontSize: '11px'
              }}
            >
              <RotateCcw size={11} />
              <span>恢復預設</span>
            </button>
          </div>

          {/* 全球貨幣列表 */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
              gap: '8px',
              paddingRight: '2px'
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
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected
                      ? 'rgba(99, 102, 241, 0.15)'
                      : isPinned
                      ? 'var(--bg-tertiary)'
                      : 'var(--bg-secondary)',
                    border: isSelected
                      ? '1px solid var(--primary)'
                      : isPinned
                      ? '1px solid var(--border-focus)'
                      : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{c.flag}</span>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.code}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {c.name}
                      </div>
                    </div>
                  </div>

                  {isPinned ? (
                    <span style={{ color: 'var(--income)', fontSize: '11px', display: 'flex', alignItems: 'center' }}>
                      <Check size={14} />
                    </span>
                  ) : (
                    <span style={{ color: 'var(--primary-light)', fontSize: '11px', fontWeight: 600 }}>
                      +加入
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
            <Button variant="secondary" size="sm" onClick={() => setIsManageModalOpen(false)}>
              關閉
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
