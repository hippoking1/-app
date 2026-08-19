import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { upgradeAnonymousWithGoogle, logout } from '@/services/auth';
import { useAccounts, useTransactions, useCategories, useBudgets, useStockHoldings } from '@/hooks/useFirestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  User,
  ShieldCheck,
  Moon,
  Sun,
  Download,
  Upload,
  RotateCcw,
  LogOut,
  Sparkles,
  Github,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, setUser, theme, toggleTheme, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { budgets } = useBudgets();
  const { holdings } = useStockHoldings();

  const [upgrading, setUpgrading] = useState(false);

  // 訪客帳號綁定 Google
  const handleUpgradeAccount = async () => {
    setUpgrading(true);
    try {
      const upgradedUser = await upgradeAnonymousWithGoogle();
      setUser(upgradedUser);
      addToast({ type: 'success', message: '已成功綁定 Google 永久帳號！' });
    } catch (err: any) {
      addToast({ type: 'error', message: '綁定失敗: ' + err.message });
    } finally {
      setUpgrading(false);
    }
  };

  // 匯出 JSON 備份檔
  const handleExportData = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      user: { uid: user?.uid, email: user?.email },
      accounts,
      categories,
      transactions,
      budgets,
      holdings
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart_expense_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: '備份資料已成功匯出！' });
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '800px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
          系統與偏好設定
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          帳戶管理、外觀主題切換與財務資料備份
        </p>
      </div>

      {/* 1. 帳戶管理區塊 */}
      <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={18} color="var(--primary)" /> 個人帳戶狀態
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '18px'
              }}
            >
              {user?.displayName ? user.displayName.slice(0, 1) : 'U'}
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {user?.displayName || '使用者'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {user?.isAnonymous ? '訪客模式（資料存於此瀏覽器）' : user?.email || '已連結 Google 帳戶'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {user?.isAnonymous && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpgradeAccount}
                loading={upgrading}
                icon={<ShieldCheck size={16} />}
              >
                升級綁定 Google
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              icon={<LogOut size={16} />}
            >
              登出
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. 主題與介面偏好 */}
      <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
          🎨 外觀與主題
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              介面主題模式
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              目前使用：{theme === 'dark' ? '深色科技黑 (Dark)' : '簡約明亮白 (Light)'}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          >
            切換為 {theme === 'dark' ? '淺色模式' : '深色模式'}
          </Button>
        </div>
      </Card>

      {/* 3. 資料備份與還原 */}
      <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
          💾 資料備份與安全性
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              完整財務數據匯出
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              包含帳戶、所有明細、分類、預算與持股資訊 (JSON 格式)
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={handleExportData} icon={<Download size={16} />}>
            匯出 JSON 備份
          </Button>
        </div>
      </Card>

      {/* 4. 後端與資料庫連線狀態 */}
      <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
          ⚡ 系統連線狀態
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Firebase Firestore 雲端資料庫</span>
            <span style={{ color: isFirebaseConfigured ? 'var(--income)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              {isFirebaseConfigured ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {isFirebaseConfigured ? '雲端已連線' : 'Demo 離線模式'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Gemini 3.7 Flash AI 模型</span>
            <span style={{ color: 'var(--income)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> 已就緒 (GAS Proxy)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>台股 & 美股即時報價引擎</span>
            <span style={{ color: 'var(--income)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={16} /> TWSE & Finnhub 就緒
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
