import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TransactionItem } from '@/components/transactions/TransactionItem';
import { TransactionForm } from '@/components/transactions/TransactionForm';
import { useTrips, useTransactions, useCategories, useAccounts } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { TravelTrip, Transaction } from '@/types';
import { saveTrip, deleteTrip, setActiveTrip } from '@/services/firestore';
import {
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  getExchangeRateForCurrency,
  convertForeignToTWD,
  fetchLiveExchangeRates,
  formatForeignCurrency,
  formatExchangeRate
} from '@/services/exchangeRate';
import { formatCurrency } from '@/utils/analytics';
import { CurrencySelector } from '@/components/common/CurrencySelector';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  Plane,
  Calculator,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  CreditCard,
  Banknote,
  CheckCircle2,
  Calendar,
  ArrowRight,
  TrendingDown,
  Globe
} from 'lucide-react';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

export const Travel: React.FC = () => {
  const { user, addToast, setTransactionModalOpen } = useAppStore();
  const { trips, activeTrip, loading: loadingTrips } = useTrips();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useAccounts();

  // 選中檢視的旅程 (預設為 activeTrip，若無則為第一個 trip)
  const [selectedTripId, setSelectedTripId] = useState<string>(() => {
    return activeTrip?.id || (trips.length > 0 ? trips[0].id : '');
  });

  // 當 trips 載入完畢且尚未設定 selectedTripId 時自動選擇
  React.useEffect(() => {
    if (!selectedTripId && trips.length > 0) {
      setSelectedTripId(activeTrip?.id || trips[0].id);
    }
  }, [trips, activeTrip, selectedTripId]);

  const currentTrip = useMemo(() => {
    return trips.find((t) => t.id === selectedTripId) || activeTrip || trips[0] || null;
  }, [trips, selectedTripId, activeTrip]);

  // 1. 隨身即時匯率計算機狀態
  const [calcCurrency, setCalcCurrency] = useState<string>(() => currentTrip?.currency || 'JPY');
  const [calcAmount, setCalcAmount] = useState<string>('1000');
  const [calcRate, setCalcRate] = useState<number>(() => {
    return currentTrip?.customExchangeRate && currentTrip.currency === (currentTrip?.currency || 'JPY')
      ? currentTrip.customExchangeRate
      : getExchangeRateForCurrency(currentTrip?.currency || 'JPY');
  });
  const [isCalcCardFee, setIsCalcCardFee] = useState<boolean>(true);
  const [isUpdatingCalcRate, setIsUpdatingCalcRate] = useState<boolean>(false);
  const [isCustomCalcRate, setIsCustomCalcRate] = useState<boolean>(false);

  // 當 currentTrip 改變時同步更新計算機幣別
  React.useEffect(() => {
    if (currentTrip?.currency && currentTrip.currency !== calcCurrency) {
      setCalcCurrency(currentTrip.currency);
      const rate = currentTrip.customExchangeRate || getExchangeRateForCurrency(currentTrip.currency);
      setCalcRate(rate);
    }
  }, [currentTrip]);

  // 計算機切換幣別
  const handleCalcCurrencyChange = (newCode: string) => {
    setCalcCurrency(newCode);
    const upper = newCode.toUpperCase();
    if (upper === currentTrip?.currency && currentTrip?.customExchangeRate) {
      setCalcRate(currentTrip.customExchangeRate);
    } else {
      setCalcRate(getExchangeRateForCurrency(upper));
    }
    setIsCustomCalcRate(false);
  };

  // 計算機更新即時匯率
  const handleRefreshCalcRate = async () => {
    if (calcCurrency === 'TWD') return;
    setIsUpdatingCalcRate(true);
    try {
      const live = await fetchLiveExchangeRates(true);
      const r = live[calcCurrency] || getExchangeRateForCurrency(calcCurrency);
      setCalcRate(r);
      setIsCustomCalcRate(false);
      addToast({
        type: 'success',
        message: `已更新 ${calcCurrency} 最新即時匯率：1 ${calcCurrency} = ${formatExchangeRate(r)} NT$`
      });
    } catch {
      addToast({ type: 'warning', message: '匯率更新失敗，已維持快取匯率' });
    } finally {
      setIsUpdatingCalcRate(false);
    }
  };

  const parsedCalcAmount = parseFloat(calcAmount) || 0;
  const calcConversion = useMemo(() => {
    if (calcCurrency === 'TWD') {
      return { baseTWD: parsedCalcAmount, feeTWD: 0, totalTWD: parsedCalcAmount };
    }
    const feeRate = isCalcCardFee ? 1.5 : 0;
    return convertForeignToTWD(parsedCalcAmount, calcRate, feeRate);
  }, [calcCurrency, parsedCalcAmount, calcRate, isCalcCardFee]);

  const calcCurrencyInfo = useMemo(() => getCurrencyInfo(calcCurrency), [calcCurrency]);

  // 2. 旅程專案 Modal 狀態 (新增/編輯)
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Partial<TravelTrip> | null>(null);
  const [tripFormName, setTripFormName] = useState('');
  const [tripFormDestination, setTripFormDestination] = useState('');
  const [tripFormCurrency, setTripFormCurrency] = useState('JPY');
  const [tripFormBudget, setTripFormBudget] = useState('');
  const [tripFormCustomRate, setTripFormCustomRate] = useState('');
  const [tripFormStart, setTripFormStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tripFormEnd, setTripFormEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tripFormExcludeBudget, setTripFormExcludeBudget] = useState(true);
  const [tripFormIsActive, setTripFormIsActive] = useState(false);
  const [savingTrip, setSavingTrip] = useState(false);

  // 3. 編輯交易明細 Modal
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // 開啟建立旅程 Modal
  const handleOpenNewTripModal = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setEditingTrip(null);
    setTripFormName('');
    setTripFormDestination('');
    setTripFormCurrency('JPY');
    setTripFormBudget('50000');
    setTripFormCustomRate('');
    setTripFormStart(todayStr);
    setTripFormEnd(todayStr);
    setTripFormExcludeBudget(true);
    setTripFormIsActive(trips.length === 0);
    setIsTripModalOpen(true);
  };

  // 開啟編輯旅程 Modal
  const handleOpenEditTripModal = (trip: TravelTrip) => {
    setEditingTrip(trip);
    setTripFormName(trip.name);
    setTripFormDestination(trip.destination);
    setTripFormCurrency(trip.currency);
    setTripFormBudget(trip.budgetTWD ? String(trip.budgetTWD) : '');
    setTripFormCustomRate(trip.customExchangeRate ? String(trip.customExchangeRate) : '');
    setTripFormStart(trip.startDate);
    setTripFormEnd(trip.endDate);
    setTripFormExcludeBudget(trip.excludeFromMonthlyBudget ?? true);
    setTripFormIsActive(trip.isActive);
    setIsTripModalOpen(true);
  };

  // 儲存旅程
  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!tripFormName.trim()) {
      addToast({ type: 'error', message: '請輸入旅程名稱' });
      return;
    }

    setSavingTrip(true);
    try {
      const now = new Date().toISOString();
      const tripId = editingTrip?.id || 'trip_' + uuidv4().slice(0, 8);
      const parsedBudget = parseFloat(tripFormBudget) || 0;
      const parsedCustomRate = parseFloat(tripFormCustomRate) || undefined;

      const tripData: TravelTrip = {
        id: tripId,
        userId: user.uid,
        name: tripFormName.trim(),
        destination: tripFormDestination.trim() || '國外自由行',
        currency: tripFormCurrency.toUpperCase(),
        budgetTWD: parsedBudget > 0 ? parsedBudget : undefined,
        customExchangeRate: parsedCustomRate && parsedCustomRate > 0 ? parsedCustomRate : undefined,
        startDate: tripFormStart,
        endDate: tripFormEnd,
        isActive: tripFormIsActive,
        excludeFromMonthlyBudget: tripFormExcludeBudget,
        createdAt: editingTrip?.createdAt || now,
        updatedAt: now
      };

      await saveTrip(tripData);

      // 若設為啟用中旅程，確保其他旅程關閉 active
      if (tripFormIsActive) {
        await setActiveTrip(user.uid, tripId);
      }

      addToast({ type: 'success', message: `旅程「${tripData.name}」已成功儲存！` });
      setSelectedTripId(tripId);
      setIsTripModalOpen(false);
      hapticSuccess();
    } catch (err: any) {
      addToast({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setSavingTrip(false);
    }
  };

  // 刪除旅程
  const handleDeleteTrip = async (trip: TravelTrip) => {
    if (!user) return;
    if (window.confirm(`確定要刪除旅程「${trip.name}」嗎？\n(注意：該旅程下的記帳明細仍會保留，但會解除旅程關聯)`)) {
      try {
        await deleteTrip(user.uid, trip.id);
        addToast({ type: 'info', message: `已刪除旅程「${trip.name}」` });
        if (selectedTripId === trip.id) {
          const remaining = trips.filter((t) => t.id !== trip.id);
          setSelectedTripId(remaining[0]?.id || '');
        }
      } catch (err: any) {
        addToast({ type: 'error', message: '刪除失敗: ' + err.message });
      }
    }
  };

  // 一鍵切換「旅途中模式」
  const handleToggleActiveTrip = async (trip: TravelTrip) => {
    if (!user) return;
    const nextStatus = !trip.isActive;
    try {
      await setActiveTrip(user.uid, nextStatus ? trip.id : null);
      addToast({
        type: 'success',
        message: nextStatus
          ? `已啟動「${trip.name}」旅途中模式，記帳將自動套用 ${trip.currency}`
          : '已關閉旅途中模式'
      });
      hapticLight();
    } catch (err: any) {
      addToast({ type: 'error', message: '切換失敗: ' + err.message });
    }
  };

  // 計算機一鍵帶入記帳
  const handleUseCalcForTransaction = () => {
    sessionStorage.setItem('draft_tx_amount', String(parsedCalcAmount));
    sessionStorage.setItem('draft_tx_merchant', currentTrip?.name ? `${currentTrip.name}消費` : '國外旅行消費');
    setTransactionModalOpen(true);
  };

  // 3. 該趟旅程之財務數據統計
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const tripTransactions = useMemo(() => {
    if (!currentTrip) return [];
    return transactions.filter((t) => {
      if (t.tripId === currentTrip.id) return true;
      // 若該筆交易無 tripId 但在旅程起訖日之間且為該幣別外幣
      if (!t.tripId && t.originalCurrency === currentTrip.currency && t.date >= currentTrip.startDate && t.date <= currentTrip.endDate) {
        return true;
      }
      return false;
    });
  }, [transactions, currentTrip]);

  // 總花費 (台幣與外幣)
  const tripTotalTWD = tripTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const tripTotalForeign = tripTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.originalAmount || 0), 0);

  // 現鈔 vs 信用卡拆解
  const cashExpenses = tripTransactions.filter((t) => {
    if (t.type !== 'expense') return false;
    const acc = accountMap.get(t.accountId);
    return acc?.type === 'cash';
  });

  const cardExpenses = tripTransactions.filter((t) => {
    if (t.type !== 'expense') return false;
    const acc = accountMap.get(t.accountId);
    return acc?.type === 'credit_card';
  });

  const cashTotalTWD = cashExpenses.reduce((sum, t) => sum + t.amount, 0);
  const cashTotalForeign = cashExpenses.reduce((sum, t) => sum + (t.originalAmount || 0), 0);

  const cardTotalTWD = cardExpenses.reduce((sum, t) => sum + t.amount, 0);
  const cardTotalForeign = cardExpenses.reduce((sum, t) => sum + (t.originalAmount || 0), 0);
  const cardFeesTWD = cardExpenses.reduce((sum, t) => sum + (t.foreignFeeTWD || 0), 0);

  // 旅遊預算進度
  const budgetTWD = currentTrip?.budgetTWD || 0;
  const budgetRatio = budgetTWD > 0 ? (tripTotalTWD / budgetTWD) * 100 : 0;
  const budgetRemaining = budgetTWD - tripTotalTWD;

  const currentCurrencyInfo = currentTrip ? getCurrencyInfo(currentTrip.currency) : SUPPORTED_CURRENCIES[1];

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '1040px' }}>
      {/* 頂部標題與快速操作 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            旅行記帳與匯率
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            外幣即時換算、海外刷卡手續費試算、現金與信用卡拆解
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button variant="primary" size="sm" onClick={handleOpenNewTripModal} icon={<Plus size={16} strokeWidth={1.5} />}>
            建立新旅程
          </Button>
        </div>
      </div>

      {/* 1. 逛街隨身即時匯率換算機 */}
      <Card
        padding="lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* 卡片標題與最新匯率更新按鈕 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Calculator size={16} strokeWidth={1.5} />
            </div>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
                隨身即時匯率計算機
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                即時雙幣換算與刷卡手續費試算
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleRefreshCalcRate}
            disabled={isUpdatingCalcRate}
            icon={<RefreshCw size={14} strokeWidth={1.5} className={isUpdatingCalcRate ? 'animate-spin' : ''} />}
          >
            更新匯率
          </Button>
        </div>

        {/* 雙幣轉換卡片 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 上卡：當地外幣輸入卡 */}
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
                當地標價（外幣支付）
              </span>
              <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {calcCurrencyInfo.name} ({calcCurrencyInfo.symbol})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  flexShrink: 0
                }}
              >
                <span className="font-mono" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent-text)' }}>
                  {calcCurrencyInfo.symbol}
                </span>
                <span className="font-mono" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {calcCurrencyInfo.code}
                </span>
              </div>

              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={calcAmount}
                onChange={(e) => setCalcAmount(e.target.value)}
                placeholder="輸入金額"
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '26px',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text-primary)',
                  textAlign: 'right',
                  padding: 0
                }}
              />
            </div>
          </div>

          {/* 中繼：匯率指示與微調列 */}
          <div
            className="font-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '2px 8px',
              fontSize: '12px',
              color: 'var(--text-secondary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>參考匯率</span>
              <span>1 {calcCurrency} ≈</span>
              {isCustomCalcRate ? (
                <input
                  type="number"
                  step="any"
                  value={calcRate}
                  onChange={(e) => setCalcRate(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '76px',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-focus)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                  autoFocus
                />
              ) : (
                <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500 }}>
                  {formatExchangeRate(calcRate)}
                </span>
              )}
              <span>NT$</span>
            </div>

            <button
              type="button"
              onClick={() => setIsCustomCalcRate(!isCustomCalcRate)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-text)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {isCustomCalcRate ? '完成微調' : '微調匯率'}
            </button>
          </div>

          {/* 下卡：折合台幣結果卡 */}
          <div
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-focus)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
                即時折合台幣（實付成本）
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                新台幣 TWD
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-subtle)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-focus)',
                  flexShrink: 0
                }}
              >
                <span className="font-mono" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent-text)' }}>
                  NT$
                </span>
                <span className="font-mono" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  TWD
                </span>
              </div>

              <div
                className="font-mono"
                style={{
                  fontSize: '28px',
                  fontWeight: 500,
                  color: 'var(--accent-text)',
                  textAlign: 'right'
                }}
              >
                NT$ {calcConversion.totalTWD.toLocaleString()}
              </div>
            </div>

            {/* 海外刷卡 1.5% 手續費 Toggle */}
            <div
              onClick={() => setIsCalcCardFee(!isCalcCardFee)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                cursor: 'pointer',
                userSelect: 'none',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <CreditCard size={14} strokeWidth={1.5} color="var(--text-secondary)" />
                <span>加計海外刷卡 1.5% 手續費</span>
                {isCalcCardFee && calcConversion.feeTWD > 0 && (
                  <span className="font-mono" style={{ color: 'var(--expense)', fontWeight: 500 }}>
                    (+NT$ {calcConversion.feeTWD.toLocaleString()})
                  </span>
                )}
              </div>
              <input
                type="checkbox"
                checked={isCalcCardFee}
                onChange={(e) => setIsCalcCardFee(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
                style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: '15px', height: '15px' }}
              />
            </div>
          </div>
        </div>

        {/* 常用貨幣快捷列 */}
        <div>
          <CurrencySelector
            selectedCurrency={calcCurrency}
            onSelectCurrency={handleCalcCurrencyChange}
            includeTWD={false}
            label="常用貨幣快速切換"
          />
        </div>

        {/* 快速帶入記帳按鈕 */}
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleUseCalcForTransaction}
          icon={<Plus size={16} strokeWidth={1.5} />}
        >
          將此金額帶入記帳
        </Button>
      </Card>

      {/* 2. 旅程選擇切換標籤與「旅途中模式」開關 */}
      {trips.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {trips.map((trip) => {
                const isSelected = currentTrip?.id === trip.id;
                return (
                  <button
                    key={trip.id}
                    onClick={() => setSelectedTripId(trip.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 500 : 400,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'background-color 0.15s var(--ease-out), border-color 0.15s var(--ease-out)'
                    }}
                  >
                    <Plane size={14} strokeWidth={1.5} color={isSelected ? 'var(--accent-text)' : 'var(--text-muted)'} />
                    <span>{trip.name}</span>
                    <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({trip.currency})</span>
                    {trip.isActive && (
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--income)'
                        }}
                        title="目前進行中旅程"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {currentTrip && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Button
                  variant={currentTrip.isActive ? 'accent' : 'outline'}
                  size="sm"
                  onClick={() => handleToggleActiveTrip(currentTrip)}
                  icon={<CheckCircle2 size={14} strokeWidth={1.5} />}
                >
                  {currentTrip.isActive ? '旅途中模式（啟動中）' : '開啟旅途中模式'}
                </Button>
                <button
                  onClick={() => handleOpenEditTripModal(currentTrip)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="編輯旅程"
                  aria-label="編輯旅程"
                >
                  <Edit2 size={15} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => handleDeleteTrip(currentTrip)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--expense)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="刪除旅程"
                  aria-label="刪除旅程"
                >
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>

          {/* 3. 該旅程財務儀表板 (KPI 卡片) */}
          {currentTrip && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="grid-3">
                {/* 1. 旅程總花費 (雙幣) */}
                <Card padding="md">
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {currentTrip.name} · 總花費
                  </div>
                  <div className="font-mono" style={{ fontSize: '24px', fontWeight: 500, color: 'var(--expense)', marginTop: '6px' }}>
                    NT$ {tripTotalTWD.toLocaleString()}
                  </div>
                  <div className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 }}>
                    {currentCurrencyInfo.symbol} {tripTotalForeign.toLocaleString()} {currentCurrencyInfo.code}
                  </div>
                </Card>

                {/* 2. 現鈔 vs 信用卡拆解 */}
                <Card padding="md" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    支付方式拆解
                  </div>
                  <div className="font-mono" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Banknote size={14} strokeWidth={1.5} /> 外幣現鈔
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        NT$ {cashTotalTWD.toLocaleString()} ({currentCurrencyInfo.symbol}{cashTotalForeign.toLocaleString()})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <CreditCard size={14} strokeWidth={1.5} /> 信用卡
                      </span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        NT$ {cardTotalTWD.toLocaleString()} ({currentCurrencyInfo.symbol}{cardTotalForeign.toLocaleString()})
                      </span>
                    </div>
                  </div>
                  {cardFeesTWD > 0 && (
                    <div className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                      含海外手續費 NT$ {cardFeesTWD.toLocaleString()}
                    </div>
                  )}
                </Card>

                {/* 3. 旅遊預算與進度 */}
                <Card padding="md">
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 400 }}>
                    旅遊預算 (NT$)
                  </div>
                  {budgetTWD > 0 ? (
                    <>
                      <div className="font-mono" style={{ fontSize: '22px', fontWeight: 500, color: budgetRemaining >= 0 ? 'var(--income)' : 'var(--expense)', marginTop: '6px' }}>
                        {budgetRemaining >= 0 ? '剩餘 NT$ ' + budgetRemaining.toLocaleString() : '超支 NT$ ' + Math.abs(budgetRemaining).toLocaleString()}
                      </div>
                      <div style={{ marginTop: '8px' }}>
                        <ProgressBar value={Math.min(100, budgetRatio)} max={100} height={8} />
                      </div>
                      <div className="font-mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        <span>已用 {budgetRatio.toFixed(1)}%</span>
                        <span>預算 NT$ {budgetTWD.toLocaleString()}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                      尚未設定本趟旅遊預算
                    </div>
                  )}
                </Card>
              </div>

              {/* 該旅程明細列表 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    「{currentTrip.name}」消費明細 ({tripTransactions.length} 筆)
                  </h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      sessionStorage.setItem('draft_tx_merchant', `${currentTrip.name}消費`);
                      setTransactionModalOpen(true);
                    }}
                    icon={<Plus size={14} strokeWidth={1.5} />}
                  >
                    記一筆旅行花費
                  </Button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tripTransactions.map((tx) => (
                    <TransactionItem
                      key={tx.id}
                      transaction={tx}
                      category={categoryMap.get(tx.categoryId)}
                      account={accountMap.get(tx.accountId)}
                      targetAccount={tx.transferToAccountId ? accountMap.get(tx.transferToAccountId) : undefined}
                      onEdit={(item) => setEditingTx(item)}
                    />
                  ))}

                  {tripTransactions.length === 0 && (
                    <Card style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      本趟旅程尚無記帳記錄
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 尚未建立任何旅程時之引導卡片 */
        <Card padding="lg" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--accent-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <Plane size={22} strokeWidth={1.5} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }}>
            尚未建立旅行專案
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', margin: '8px auto 20px', lineHeight: 1.6 }}>
            建立旅程專案（如「東京 5 日遊」）並開啟旅途中模式，即可自動套用當地幣別並獨立統計旅遊預算。
          </p>
          <Button variant="primary" onClick={handleOpenNewTripModal} icon={<Plus size={16} strokeWidth={1.5} />}>
            建立旅程專案
          </Button>
        </Card>
      )}

      {/* 建立 / 編輯旅程 Modal */}
      <Modal
        isOpen={isTripModalOpen}
        onClose={() => setIsTripModalOpen(false)}
        title={editingTrip ? '編輯旅程專案' : '建立旅行專案'}
      >
        <form onSubmit={handleSaveTrip} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input
            label="旅程名稱"
            placeholder="例如：2026 東京賞櫻行"
            value={tripFormName}
            onChange={(e) => setTripFormName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="目的地"
            placeholder="例如：日本 東京"
            value={tripFormDestination}
            onChange={(e) => setTripFormDestination(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Select
              label="當地主要貨幣"
              value={tripFormCurrency}
              onChange={(e) => setTripFormCurrency(e.target.value)}
              options={SUPPORTED_CURRENCIES.filter((c) => c.code !== 'TWD').map((c) => ({
                value: c.code,
                label: `${c.code} (${c.name})`
              }))}
            />

            <Input
              type="number"
              label="鎖定固定匯率 (選填)"
              placeholder="留空使用即時匯率"
              value={tripFormCustomRate}
              onChange={(e) => setTripFormCustomRate(e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input
              type="date"
              label="開始日期"
              value={tripFormStart}
              onChange={(e) => setTripFormStart(e.target.value)}
              required
            />
            <Input
              type="date"
              label="結束日期"
              value={tripFormEnd}
              onChange={(e) => setTripFormEnd(e.target.value)}
              required
            />
          </div>

          <Input
            type="number"
            label="本趟旅遊總預算 (台幣 NT$)"
            placeholder="例如：50000"
            value={tripFormBudget}
            onChange={(e) => setTripFormBudget(e.target.value)}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px'
            }}
          >
            <input
              type="checkbox"
              id="tripFormExcludeBudget"
              checked={tripFormExcludeBudget}
              onChange={(e) => setTripFormExcludeBudget(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <label htmlFor="tripFormExcludeBudget" style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
              排除於日常每月生活預算（防止機票與旅遊花費影響日常預算統計）
            </label>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px'
            }}
          >
            <input
              type="checkbox"
              id="tripFormIsActive"
              checked={tripFormIsActive}
              onChange={(e) => setTripFormIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <label htmlFor="tripFormIsActive" style={{ cursor: 'pointer', color: 'var(--text-primary)' }}>
              設為當前進行中旅程（快速記帳自動預設此旅程與當地幣別）
            </label>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsTripModalOpen(false)} style={{ flex: 1 }}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={savingTrip} style={{ flex: 1 }}>
              確認儲存
            </Button>
          </div>
        </form>
      </Modal>

      {/* 編輯交易明細 Modal */}
      <Modal
        isOpen={Boolean(editingTx)}
        onClose={() => setEditingTx(null)}
        title="編輯交易明細"
      >
        {editingTx && (
          <TransactionForm
            initialData={editingTx}
            onSuccess={() => setEditingTx(null)}
            onCancel={() => setEditingTx(null)}
          />
        )}
      </Modal>
    </div>
  );
};
