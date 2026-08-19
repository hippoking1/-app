import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { upgradeAnonymousWithGoogle, logout } from '@/services/auth';
import { useAccounts, useTransactions, useCategories, useBudgets, useStockHoldings } from '@/hooks/useFirestore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { runSystemDiagnostics, DiagnosticResult, GAS_URL } from '@/services/gas';
import {
  User,
  ShieldCheck,
  Moon,
  Sun,
  Download,
  LogOut,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Activity,
  Loader2,
  TrendingUp,
  Cpu,
  Server
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, setUser, theme, toggleTheme, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { budgets } = useBudgets();
  const { holdings } = useStockHoldings();

  const [upgrading, setUpgrading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null);

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

  // 執行系統連線與 AI 診斷
  const handleRunDiagnostics = async () => {
    setDiagnosing(true);
    try {
      const res = await runSystemDiagnostics();
      setDiagResult(res);
      if (res.gasConnected && res.hasGeminiKey) {
        addToast({ type: 'success', message: '診斷完成：GAS 與 Gemini 3.7 Flash 連線完全正常！' });
      } else {
        addToast({ type: 'warning', message: '診斷完成：檢測到後端需要設定或重新部署。' });
      }
    } catch (err: any) {
      addToast({ type: 'error', message: '診斷失敗: ' + err.message });
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '800px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
          系統與偏好設定
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          帳戶管理、外觀主題切換、資料備份與 GAS & Gemini 後端連線診斷
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

      {/* 2. 後端 GAS & Gemini 3.7 Flash 診斷中心 */}
      <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--purple)" /> 後端 GAS & Gemini 3.7 Flash 連線診斷
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              一鍵即時檢測 Google Apps Script 代理、LLM 記帳分析與 Yahoo Finance 報價
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunDiagnostics}
            loading={diagnosing}
            icon={<Sparkles size={16} />}
          >
            ⚡ 立即進行完整診斷
          </Button>
        </div>

        {/* 診斷報告詳細卡片 */}
        {diagResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
            {/* 1. GAS 伺服器連線 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Server size={16} /> GAS 後端伺服器 (doPost)
              </span>
              <span style={{ color: diagResult.gasConnected ? 'var(--income)' : 'var(--expense)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {diagResult.gasConnected ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {diagResult.gasConnected ? `已連線 (${diagResult.latencyMs}ms)` : '連線異常'}
              </span>
            </div>

            {/* 2. Gemini 3.7 Flash API Key */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Cpu size={16} /> Gemini 3.7 Flash 金鑰設定
              </span>
              <span style={{ color: diagResult.hasGeminiKey ? 'var(--income)' : 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {diagResult.hasGeminiKey ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {diagResult.hasGeminiKey ? 'GEMINI_API_KEY 已生效' : '未設定 GEMINI_API_KEY'}
              </span>
            </div>

            {/* 3. 股票即時報價測試 (2880 華南金) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <TrendingUp size={16} /> 台股 2880 (華南金) Yahoo 報價測試
              </span>
              <span style={{ color: diagResult.testStock2880 && diagResult.testStock2880.currentPrice > 0 ? 'var(--income)' : 'var(--text-muted)', fontWeight: 700 }}>
                {diagResult.testStock2880 && diagResult.testStock2880.currentPrice > 0
                  ? `最新價 $${diagResult.testStock2880.currentPrice} (${diagResult.testStock2880.name})`
                  : '尚未取得報價'}
              </span>
            </div>

            {/* 4. LLM 記帳解析回傳範例 */}
            {diagResult.testAIResult && diagResult.testAIResult.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  🤖 Gemini 3.7 Flash 測試語句「麥當勞吃了 180 元」真實解析結果：
                </div>
                <div className="font-mono" style={{ fontSize: '12px', color: 'var(--purple)', backgroundColor: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  分類: {diagResult.testAIResult[0].categoryName} | 金額: ${diagResult.testAIResult[0].amount} | 備註: {diagResult.testAIResult[0].note}
                </div>
              </div>
            )}

            {/* 錯誤說明與解決步驟 */}
            {diagResult.error && (
              <div style={{ marginTop: '6px', color: 'var(--expense)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', lineHeight: 1.6 }}>
                ⚠️ <strong>診斷提示</strong>：{diagResult.error}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            目前 GAS URL：<code className="font-mono" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{GAS_URL ? GAS_URL.slice(0, 45) + '...' : '尚未設定'}</code>
          </div>
        )}
      </Card>

      {/* 3. 主題與介面偏好 */}
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

      {/* 4. 資料備份與安全性 */}
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
    </div>
  );
};
