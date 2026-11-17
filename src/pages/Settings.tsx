import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/stores/appStore';
import { upgradeAnonymousWithGoogle, logout } from '@/services/auth';
import { useAccounts, useTransactions, useCategories, useBudgets, useStockHoldings } from '@/hooks/useFirestore';
import { runSystemDiagnostics, DiagnosticResult, GAS_URL } from '@/services/gas';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LIST,
  AIProviderId,
  detectProviderFromKey,
  validateKeyAndFetchModels
} from '@/services/ai';
import { useAppInstall } from '@/hooks/useAppInstall';
import { useVersionUpdater } from '@/hooks/useVersionUpdater';
import {
  User,
  ShieldCheck,
  Moon,
  Sun,
  Download,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Activity,
  TrendingUp,
  Cpu,
  Server,
  MonitorSmartphone,
  RefreshCw,
  Laptop,
  Smartphone,
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Search,
  Lock,
  ArrowUpDown
} from 'lucide-react';

export const Settings: React.FC = () => {
  const {
    user,
    setUser,
    aiConfig,
    setAIConfig,
    clearAIConfig,
    theme,
    toggleTheme,
    marketColorScheme,
    setMarketColorScheme,
    addToast
  } = useAppStore();
  const { accounts } = useAccounts();
  const { transactions } = useTransactions();
  const { categories } = useCategories();
  const { budgets } = useBudgets();
  const { holdings } = useStockHoldings();

  const {
    runtimeMode,
    isStandaloneApp,
    canPromptInstall,
    promptInstall,
    windowsExeUrl,
    androidApkUrl
  } = useAppInstall();

  const {
    currentVersion,
    currentBuildId,
    latestVersion,
    hasUpdate,
    isChecking,
    isUpdating,
    lastCheckedAt,
    triggerManualCheck,
    applyUpdate
  } = useVersionUpdater();

  const [upgrading, setUpgrading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null);

  // AI API Key 與模型設定本地表單狀態
  const [providerInput, setProviderInput] = useState<AIProviderId>(aiConfig.provider || 'gemini');
  const [apiKeyInput, setApiKeyInput] = useState<string>(aiConfig.apiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [useCustomModel, setUseCustomModel] = useState(false);

  // 當切換帳號或 store 同步時更新輸入框
  useEffect(() => {
    setProviderInput(aiConfig.provider || 'gemini');
    setApiKeyInput(aiConfig.apiKey || '');
    setKeyError(null);
  }, [aiConfig.provider, aiConfig.apiKey, user?.uid]);

  const currentProviderMeta = AI_PROVIDERS[providerInput] || AI_PROVIDERS.gemini;

  // 篩選可用模型清單
  const filteredModels = useMemo(() => {
    const list = aiConfig.availableModels || [];
    const kw = modelSearch.trim().toLowerCase();
    if (!kw) return list;
    return list.filter(
      (m) =>
        m.id.toLowerCase().includes(kw) ||
        m.name.toLowerCase().includes(kw) ||
        (m.description && m.description.toLowerCase().includes(kw))
    );
  }, [aiConfig.availableModels, modelSearch]);

  const selectedModelMeta = useMemo(() => {
    return aiConfig.availableModels.find((m) => m.id === aiConfig.selectedModel);
  }, [aiConfig.availableModels, aiConfig.selectedModel]);

  // 當使用者輸入 API Key 時自動偵測模型供應商
  const handleApiKeyChange = (val: string) => {
    setApiKeyInput(val);
    setKeyError(null);
    if (val.trim().length > 6) {
      const detected = detectProviderFromKey(val, providerInput);
      if (detected !== providerInput) {
        setProviderInput(detected);
      }
    }
  };

  // 驗證 API Key 並向模型商拉取所有可用模型
  const handleValidateAndLoadModels = async () => {
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setKeyError('請先輸入您的個人 API Key');
      return;
    }

    setValidatingKey(true);
    setKeyError(null);
    try {
      const res = await validateKeyAndFetchModels(cleanKey, providerInput);
      // 若原本已選的模型在清單中則保留，否則使用推薦模型
      const keepExisting = res.models.some((m) => m.id === aiConfig.selectedModel);
      const nextModel = keepExisting ? aiConfig.selectedModel : res.recommendedModel;

      setProviderInput(res.provider);
      setAIConfig({
        provider: res.provider,
        apiKey: cleanKey,
        selectedModel: nextModel,
        availableModels: res.models,
        isKeyValid: true,
        validatedAt: new Date().toISOString()
      });

      addToast({
        type: 'success',
        message: `金鑰驗證成功，已載入 ${AI_PROVIDERS[res.provider].shortName} 共 ${res.models.length} 個可用模型`
      });
    } catch (err: any) {
      const msg = err.message || 'API Key 驗證失敗，請確認金鑰是否正確';
      setKeyError(msg);
      setAIConfig({
        provider: providerInput,
        apiKey: '',
        selectedModel: '',
        availableModels: [],
        isKeyValid: false
      });
      addToast({ type: 'error', message: msg });
    } finally {
      setValidatingKey(false);
    }
  };

  // 清除個人的 API Key
  const handleClearApiKey = () => {
    clearAIConfig();
    setApiKeyInput('');
    setKeyError(null);
    setModelSearch('');
    setDiagResult(null);
    addToast({ type: 'info', message: '已清除本機 API Key 與模型設定' });
  };

  // 一鍵安裝獨立視窗 App
  const handleInstallApp = async () => {
    const installed = await promptInstall();
    if (installed) {
      addToast({ type: 'success', message: '已安裝獨立應用程式，可由桌面圖示開啟' });
    }
  };

  // 手動檢查版本更新
  const handleCheckUpdate = async () => {
    const found = await triggerManualCheck();
    if (found) {
      addToast({ type: 'info', message: `發現新版本 v${latestVersion || currentVersion}，準備更新` });
    } else {
      addToast({ type: 'success', message: `目前已是最新版本 (v${currentVersion})` });
    }
  };

  const runtimeLabelMap = {
    electron: 'Windows 獨立安裝版 (.exe 單一視窗)',
    capacitor: 'Android 原生安裝版 (.apk 單一視窗)',
    'pwa-standalone': '獨立應用程式視窗模式 (單一視窗)',
    browser: '瀏覽器分頁模式（建議安裝獨立 App）'
  };

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
      version: currentVersion,
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
      if (res.gasConnected && res.hasGeminiKey && !res.aiError) {
        addToast({
          type: 'success',
          message: `診斷完成：GAS 股市代理與 ${res.geminiModel} 連線完全正常！`
        });
      } else if (!res.hasGeminiKey) {
        addToast({
          type: 'warning',
          message: '診斷完成：GAS 股市連線正常，但您尚未設定個人 AI API Key。'
        });
      } else {
        addToast({
          type: 'warning',
          message: '診斷完成：請檢查診斷報告中的異常項目。'
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', message: '診斷失敗: ' + err.message });
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '880px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          系統設定
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
          個人 AI 金鑰與模型 (BYOK)、應用程式安裝、外觀慣例與連線診斷
        </p>
      </div>

      {/* 0. 電腦與手機獨立安裝檔 & 版本自動更新中心 */}
      <Card
        padding="lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <MonitorSmartphone size={16} strokeWidth={1.5} color="var(--accent-text)" /> 獨立應用程式與版本更新
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              單一視窗運行，並於啟動時自動檢查同步最新版本
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasUpdate ? (
              <Button
                variant="accent"
                size="sm"
                onClick={applyUpdate}
                loading={isUpdating}
                icon={<RefreshCw size={14} strokeWidth={1.5} />}
              >
                立即更新至 v{latestVersion}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCheckUpdate}
                loading={isChecking}
                icon={<RefreshCw size={14} strokeWidth={1.5} />}
              >
                檢查版本更新
              </Button>
            )}
          </div>
        </div>

        {/* 當前版本與執行模式資訊 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px'
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>目前版本 / 建置編號</div>
            <div className="font-mono" style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>v{currentVersion}</span>
              <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({currentBuildId})
              </code>
              {!hasUpdate && (
                <span style={{ color: 'var(--income)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={12} strokeWidth={1.5} /> 最新版
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>運行模式</div>
            <div style={{ fontWeight: 500, color: isStandaloneApp ? 'var(--income)' : 'var(--text-secondary)' }}>
              {runtimeLabelMap[runtimeMode]}
            </div>
          </div>
        </div>

        {/* 安裝檔下載與一鍵桌面安裝區 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {canPromptInstall && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleInstallApp}
              icon={<MonitorSmartphone size={14} strokeWidth={1.5} />}
            >
              安裝為獨立視窗 App
            </Button>
          )}

          <a
            href={windowsExeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="secondary" size="sm" icon={<Laptop size={14} strokeWidth={1.5} />}>
              下載電腦版 (.exe)
            </Button>
          </a>

          <a
            href={androidApkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="secondary" size="sm" icon={<Smartphone size={14} strokeWidth={1.5} />}>
              下載手機版 (.apk)
            </Button>
          </a>

          {lastCheckedAt && (
            <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              上次檢查 {new Date(lastCheckedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </Card>

      {/* 1. 帳戶管理區塊 */}
      <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <User size={16} strokeWidth={1.5} color="var(--text-secondary)" /> 個人帳戶狀態
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--accent-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '16px'
              }}
            >
              {user?.displayName ? user.displayName.slice(0, 1) : 'U'}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
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
                icon={<ShieldCheck size={14} strokeWidth={1.5} />}
              >
                升級綁定 Google
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAIConfig();
                logout();
              }}
              icon={<LogOut size={14} strokeWidth={1.5} />}
            >
              登出
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. AI API Key 與自由模型選擇設定 (BYOK) */}
      <Card
        padding="lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          borderColor: aiConfig.isKeyValid ? 'rgba(76, 195, 138, 0.3)' : 'rgba(245, 158, 11, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <KeyRound size={16} strokeWidth={1.5} color="var(--accent-text)" /> 個人 AI 金鑰與模型設定 (BYOK)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
              系統不預設任何 API Key。輸入個人 API Key 驗證後即可自由選擇該供應商的所有模型。
            </p>
          </div>

          <a
            href={currentProviderMeta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: 'var(--accent-text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            取得 {currentProviderMeta.shortName} 金鑰 <ExternalLink size={12} strokeWidth={1.5} />
          </a>
        </div>

        {/* 步驟 1：選擇模型供應商 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            1. 選擇模型供應商（貼上金鑰自動識別）
          </label>
          <select
            value={providerInput}
            onChange={(e) => {
              const nextProvider = e.target.value as AIProviderId;
              setProviderInput(nextProvider);
              setKeyError(null);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              outline: 'none'
            }}
          >
            {AI_PROVIDER_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* 步驟 2：輸入 API Key 並驗證 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              2. 輸入 {currentProviderMeta.shortName} API Key
            </label>
            <span className="font-mono" style={{ fontSize: '11px', color: aiConfig.isKeyValid ? 'var(--income)' : 'var(--warning)', fontWeight: 500 }}>
              {aiConfig.isKeyValid
                ? `已驗證 (${aiConfig.availableModels.length} 個模型)`
                : '尚未設定有效金鑰'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', display: 'flex', alignItems: 'center' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={currentProviderMeta.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: '100%',
                  padding: '8px 36px 8px 12px',
                  minHeight: '36px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((prev) => !prev)}
                title={showApiKey ? '隱藏金鑰' : '顯示金鑰'}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showApiKey ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
              </button>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleValidateAndLoadModels}
              loading={validatingKey}
              disabled={!apiKeyInput.trim()}
              icon={<KeyRound size={14} strokeWidth={1.5} />}
            >
              驗證並載入模型
            </Button>

            {(apiKeyInput || aiConfig.apiKey) && (
              <Button
                variant="outline"
                size="md"
                onClick={handleClearApiKey}
                icon={<Trash2 size={14} strokeWidth={1.5} />}
              >
                清除
              </Button>
            )}
          </div>

          {keyError && (
            <div
              style={{
                marginTop: '4px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--expense-subtle)',
                color: 'var(--expense)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertCircle size={15} strokeWidth={1.5} />
              <span>{keyError}</span>
            </div>
          )}
        </div>

        {/* 步驟 3：自由選擇模型 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} strokeWidth={1.5} color="var(--accent-text)" />
              3. 選擇 AI 模型
            </label>

            {aiConfig.isKeyValid && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setUseCustomModel((prev) => !prev)}
                  style={{
                    fontSize: '12px',
                    color: 'var(--accent-text)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {useCustomModel ? '返回列表' : '手動輸入模型代碼'}
                </button>
              </div>
            )}
          </div>

          {aiConfig.isKeyValid && aiConfig.availableModels.length > 0 ? (
            <>
              {!useCustomModel ? (
                <>
                  {aiConfig.availableModels.length > 6 && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search
                        size={14}
                        strokeWidth={1.5}
                        style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }}
                      />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder={`搜尋 ${aiConfig.availableModels.length} 個可用模型`}
                        style={{
                          width: '100%',
                          padding: '8px 10px 8px 32px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  )}

                  <select
                    value={aiConfig.selectedModel}
                    onChange={(e) => {
                      const nextModel = e.target.value;
                      setAIConfig({ selectedModel: nextModel });
                      addToast({ type: 'success', message: `已切換模型為：${nextModel}` });
                    }}
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-focus)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {filteredModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  {filteredModels.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--warning)' }}>
                      找不到符合「{modelSearch}」的模型，請清除關鍵字或改為手動輸入
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="輸入模型 ID，例如 gemini-2.5-pro"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!customModelInput.trim()}
                    onClick={() => {
                      const id = customModelInput.trim();
                      const exists = aiConfig.availableModels.some((m) => m.id === id);
                      const nextModels = exists
                        ? aiConfig.availableModels
                        : [
                            { id, name: `${id} (自訂模型)`, provider: aiConfig.provider },
                            ...aiConfig.availableModels
                          ];
                      setAIConfig({
                        selectedModel: id,
                        availableModels: nextModels
                      });
                      setUseCustomModel(false);
                      setCustomModelInput('');
                      addToast({ type: 'success', message: `已套用自訂模型：${id}` });
                    }}
                  >
                    套用
                  </Button>
                </div>
              )}

              {/* 當前所選模型詳細資訊 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  paddingTop: '6px',
                  borderTop: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span>
                    目前啟用：<span className="font-mono" style={{ color: 'var(--accent-text)', fontWeight: 500 }}>{aiConfig.selectedModel}</span>
                  </span>
                  {selectedModelMeta?.inputTokenLimit && (
                    <span className="font-mono" style={{ fontSize: '11px' }}>
                      Context {selectedModelMeta.inputTokenLimit.toLocaleString()} tokens
                    </span>
                  )}
                </div>
                {selectedModelMeta?.description && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {selectedModelMeta.description}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', padding: '4px 0' }}>
              <Lock size={14} strokeWidth={1.5} />
              <span>驗證有效的 API Key 後即可選擇模型。</span>
            </div>
          )}
        </div>
      </Card>

      {/* 3. 後端 GAS 股市代理 & 個人 AI 連線診斷中心 */}
      <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Activity size={16} strokeWidth={1.5} color="var(--accent-text)" /> 後端 GAS 與 AI 連線診斷
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              即時檢測 Yahoo Finance 報價代理與個人 AI 金鑰解析狀態
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRunDiagnostics}
            loading={diagnosing}
            icon={<Activity size={14} strokeWidth={1.5} />}
          >
            執行完整診斷
          </Button>
        </div>

        {/* 診斷報告詳細卡片 */}
        {diagResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Server size={15} strokeWidth={1.5} /> GAS 股市報價代理
              </span>
              <span className="font-mono" style={{ color: diagResult.gasConnected ? 'var(--income)' : 'var(--expense)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {diagResult.gasConnected ? <CheckCircle2 size={15} strokeWidth={1.5} /> : <AlertCircle size={15} strokeWidth={1.5} />}
                {diagResult.gasConnected ? `已連線 (${diagResult.latencyMs}ms)` : '連線異常'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Cpu size={15} strokeWidth={1.5} /> AI 金鑰與模型 ({diagResult.aiProviderName})
              </span>
              <span className="font-mono" style={{ color: diagResult.hasGeminiKey ? 'var(--income)' : 'var(--warning)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {diagResult.hasGeminiKey ? <CheckCircle2 size={15} strokeWidth={1.5} /> : <AlertCircle size={15} strokeWidth={1.5} />}
                {diagResult.hasGeminiKey
                  ? `生效 (${diagResult.geminiModel})`
                  : '未設定個人 API Key'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <TrendingUp size={15} strokeWidth={1.5} /> 台股 2880 (華南金) Yahoo 報價測試
              </span>
              <span className="font-mono" style={{ color: diagResult.testStock2880 && diagResult.testStock2880.currentPrice > 0 ? 'var(--income)' : 'var(--text-muted)', fontWeight: 500 }}>
                {diagResult.testStock2880 && diagResult.testStock2880.currentPrice > 0
                  ? `$${diagResult.testStock2880.currentPrice} (${diagResult.testStock2880.name})`
                  : '尚未取得報價'}
              </span>
            </div>

            {diagResult.testAIResult && diagResult.testAIResult.length > 0 && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {diagResult.geminiModel} 測試語句「麥當勞吃了 180 元」解析結果：
                </div>
                <div className="font-mono" style={{ fontSize: '12px', color: 'var(--accent-text)', backgroundColor: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  分類: {diagResult.testAIResult[0].categoryName} | 金額: ${diagResult.testAIResult[0].amount} | 備註: {diagResult.testAIResult[0].note}
                </div>
              </div>
            )}

            {diagResult.aiError && (
              <div style={{ marginTop: '6px', color: 'var(--expense)', backgroundColor: 'var(--expense-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)', lineHeight: 1.6 }}>
                <strong>AI 解析診斷提示</strong>：{diagResult.aiError}
              </div>
            )}

            {diagResult.error && (
              <div style={{ marginTop: '6px', color: 'var(--expense)', backgroundColor: 'var(--expense-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)', lineHeight: 1.6 }}>
                <strong>GAS 診斷提示</strong>：{diagResult.error}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            GAS URL：<code className="font-mono" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{GAS_URL ? GAS_URL.slice(0, 45) + '...' : '尚未設定'}</code>
          </div>
        )}
      </Card>

      {/* 4. 外觀、主題與股市漲跌慣例 */}
      <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
          外觀與色彩慣例
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              介面主題模式
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              目前使用：{theme === 'dark' ? '深色石墨 (Dark)' : '暖紙帳冊 (Light)'}
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleTheme}
            icon={theme === 'dark' ? <Sun size={15} strokeWidth={1.5} /> : <Moon size={15} strokeWidth={1.5} />}
          >
            切換為 {theme === 'dark' ? '淺色模式' : '深色模式'}
          </Button>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>股市漲跌與投資損益色彩</span>
              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--gain)', backgroundColor: 'var(--gain-subtle)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                漲/賺
              </span>
              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--loss)', backgroundColor: 'var(--loss-subtle)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                跌/賠
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {marketColorScheme === 'tw' ? '台股慣例：紅漲綠跌（上漲與獲利為紅）' : '國際慣例：綠漲紅跌（上漲與獲利為綠）'}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              gap: '4px'
            }}
          >
            <button
              type="button"
              onClick={() => setMarketColorScheme('intl')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: marketColorScheme === 'intl' ? 'var(--primary)' : 'transparent',
                color: marketColorScheme === 'intl' ? 'var(--on-primary)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              綠漲紅跌
            </button>
            <button
              type="button"
              onClick={() => setMarketColorScheme('tw')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: marketColorScheme === 'tw' ? 'var(--primary)' : 'transparent',
                color: marketColorScheme === 'tw' ? 'var(--on-primary)' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <ArrowUpDown size={12} strokeWidth={1.5} />
              台股紅漲綠跌
            </button>
          </div>
        </div>
      </Card>

      {/* 5. 資料備份與安全性 */}
      <Card padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
          資料備份與匯出
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
              完整財務數據匯出
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              包含帳戶、收支明細、分類、預算與持股資訊 (JSON 格式)
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={handleExportData} icon={<Download size={15} strokeWidth={1.5} />}>
            匯出 JSON 備份
          </Button>
        </div>
      </Card>
    </div>
  );
};
