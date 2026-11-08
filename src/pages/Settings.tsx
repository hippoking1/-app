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
  Sparkles,
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
  Lock
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, setUser, aiConfig, setAIConfig, clearAIConfig, theme, toggleTheme, addToast } = useAppStore();
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
        message: `✅ 金鑰驗證成功！已載入 ${AI_PROVIDERS[res.provider].shortName} 共 ${res.models.length} 個可用模型`
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
    addToast({ type: 'info', message: '🔒 已從本機清除您的 API Key 與模型設定' });
  };

  // 一鍵安裝獨立視窗 App
  const handleInstallApp = async () => {
    const installed = await promptInstall();
    if (installed) {
      addToast({ type: 'success', message: '🎉 已成功安裝獨立應用程式！之後可由桌面圖示直接開啟' });
    }
  };

  // 手動檢查版本更新
  const handleCheckUpdate = async () => {
    const found = await triggerManualCheck();
    if (found) {
      addToast({ type: 'info', message: `發現新版本 v${latestVersion || currentVersion}，正在準備更新！` });
    } else {
      addToast({ type: 'success', message: `目前已是最新版本 (v${currentVersion})！` });
    }
  };

  const runtimeLabelMap = {
    electron: '💻 Windows 電腦獨立安裝版 (.exe 單一視窗鎖定)',
    capacitor: '📱 Android 手機原生安裝版 (.apk 單一視窗鎖定)',
    'pwa-standalone': '✨ 獨立應用程式視窗模式 (單一視窗防多分頁)',
    browser: '🌐 瀏覽器分頁模式（建議安裝獨立 App 免開瀏覽器分頁）'
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
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '800px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' }}>
          系統與偏好設定
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          個人 AI 金鑰與自由模型選擇 (BYOK)、獨立安裝包、帳戶管理與連線診斷
        </p>
      </div>

      {/* 0. 電腦與手機獨立安裝檔 & 版本自動更新中心 */}
      <Card
        glass
        padding="lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: '1px solid var(--border-focus)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MonitorSmartphone size={18} color="var(--primary)" /> 獨立應用程式安裝 & 自動版本更新
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              免開瀏覽器分頁、強制單一視窗運行，並於每次啟動時自動偵測且同步最新版本
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasUpdate ? (
              <Button
                variant="primary"
                size="sm"
                onClick={applyUpdate}
                loading={isUpdating}
                icon={<Sparkles size={15} />}
              >
                立即更新至 v{latestVersion}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCheckUpdate}
                loading={isChecking}
                icon={<RefreshCw size={15} />}
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
            gap: '10px',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px'
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>目前版本 / 建置編號</div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>v{currentVersion}</span>
              <code className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ({currentBuildId})
              </code>
              {!hasUpdate && (
                <span style={{ color: 'var(--income)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <CheckCircle2 size={13} /> 最新版
                </span>
              )}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>目前運行模式</div>
            <div style={{ fontWeight: 700, color: isStandaloneApp ? 'var(--income)' : 'var(--warning)' }}>
              {runtimeLabelMap[runtimeMode]}
            </div>
          </div>
        </div>

        {/* 安裝檔下載與一鍵桌面安裝區 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {canPromptInstall && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleInstallApp}
              icon={<MonitorSmartphone size={16} />}
            >
              ⚡ 一鍵直接安裝為獨立視窗 App
            </Button>
          )}

          <a
            href={windowsExeUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="secondary" size="sm" icon={<Laptop size={16} />}>
              下載電腦版安裝檔 (.exe)
            </Button>
          </a>

          <a
            href={androidApkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="secondary" size="sm" icon={<Smartphone size={16} />}>
              下載手機版安裝檔 (.apk)
            </Button>
          </a>

          {lastCheckedAt && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              上次檢查：{new Date(lastCheckedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </Card>

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
              onClick={() => {
                clearAIConfig();
                logout();
              }}
              icon={<LogOut size={16} />}
            >
              登出
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. AI API Key 與自由模型選擇設定 (BYOK) */}
      <Card
        glass
        padding="lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          border: aiConfig.isKeyValid ? '1px solid var(--income)' : '1px solid var(--warning)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <KeyRound size={18} color="var(--purple)" /> 個人 AI 金鑰與模型自由選擇 (BYOK)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.5 }}>
              為保障資安與防止盜用額度，系統<strong>絕不預設任何 API Key</strong>。請輸入您自己的 API Key，驗證成功後即可自由選擇該模型商提供的任何模型。
            </p>
          </div>

          <a
            href={currentProviderMeta.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: 'var(--primary-light)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            取得 {currentProviderMeta.shortName} 金鑰 <ExternalLink size={13} />
          </a>
        </div>

        {/* 步驟 1：選擇模型供應商 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            1. 選擇模型供應商 (支援貼上金鑰自動識別)
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
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
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
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              2. 輸入您的 {currentProviderMeta.shortName} API Key
            </label>
            <span style={{ fontSize: '11px', color: aiConfig.isKeyValid ? 'var(--income)' : 'var(--warning)', fontWeight: 700 }}>
              {aiConfig.isKeyValid
                ? `✅ 已驗證生效 (${aiConfig.availableModels.length} 個可用模型)`
                : '⚠️ 尚未設定有效金鑰'}
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
                  padding: '10px 38px 10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontFamily: 'monospace',
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
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={handleValidateAndLoadModels}
              loading={validatingKey}
              disabled={!apiKeyInput.trim()}
              icon={<Sparkles size={15} />}
            >
              驗證金鑰並載入模型
            </Button>

            {(apiKeyInput || aiConfig.apiKey) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearApiKey}
                icon={<Trash2 size={15} />}
              >
                清除金鑰
              </Button>
            )}
          </div>

          {keyError && (
            <div
              style={{
                marginTop: '4px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--expense)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertCircle size={15} />
              <span>{keyError}</span>
            </div>
          )}
        </div>

        {/* 步驟 3：自由選擇模型商提供的任何模型 */}
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
            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="var(--purple)" />
              3. 自由選擇 AI 模型
            </label>

            {aiConfig.isKeyValid && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setUseCustomModel((prev) => !prev)}
                  style={{
                    fontSize: '11px',
                    color: 'var(--primary-light)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {useCustomModel ? '返回下拉選單列表' : '手動輸入自訂模型代碼'}
                </button>
              </div>
            )}
          </div>

          {aiConfig.isKeyValid && aiConfig.availableModels.length > 0 ? (
            <>
              {!useCustomModel ? (
                <>
                  {/* 模型關鍵字搜尋框（當模型數量較多時方便快速過濾） */}
                  {aiConfig.availableModels.length > 6 && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <Search
                        size={14}
                        style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }}
                      />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder={`在 ${aiConfig.availableModels.length} 個模型中搜尋 (例如：2.5、flash、pro、claude、gpt)...`}
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

                  {/* 模型選擇下拉選單 */}
                  <select
                    value={aiConfig.selectedModel}
                    onChange={(e) => {
                      const nextModel = e.target.value;
                      setAIConfig({ selectedModel: nextModel });
                      addToast({ type: 'success', message: `🤖 已切換模型為：${nextModel}` });
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--purple)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 700,
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
                      找不到符合「{modelSearch}」的模型，請清除搜尋關鍵字或切換為手動輸入模式。
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="輸入模型商提供的任意模型 ID (例如 gemini-2.5-pro)..."
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                  <Button
                    variant="primary"
                    size="sm"
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
                      addToast({ type: 'success', message: `🤖 已套用自訂模型：${id}` });
                    }}
                  >
                    套用模型
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
                  paddingTop: '4px',
                  borderTop: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span>
                    目前啟用模型：<strong className="font-mono" style={{ color: 'var(--purple)' }}>{aiConfig.selectedModel}</strong>
                  </span>
                  {selectedModelMeta?.inputTokenLimit && (
                    <span className="font-mono" style={{ fontSize: '11px' }}>
                      Context 上限: {selectedModelMeta.inputTokenLimit.toLocaleString()} tokens
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px', padding: '6px 0' }}>
              <Lock size={15} />
              <span>請先輸入有效的 API Key 並點擊「驗證金鑰並載入模型」，即可解鎖並自由選擇該模型商旗下的所有模型。</span>
            </div>
          )}
        </div>
      </Card>

      {/* 3. 後端 GAS 股市代理 & 個人 AI 連線診斷中心 */}
      <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-glass)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--purple)" /> 後端 GAS 股市 & 個人 AI 連線診斷
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              一鍵即時檢測 Yahoo Finance 股市報價代理與您個人設定的 AI 金鑰及模型解析狀態
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
                <Server size={16} /> GAS 股市報價代理 (doPost)
              </span>
              <span style={{ color: diagResult.gasConnected ? 'var(--income)' : 'var(--expense)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {diagResult.gasConnected ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {diagResult.gasConnected ? `已連線 (${diagResult.latencyMs}ms)` : '連線異常'}
              </span>
            </div>

            {/* 2. 個人 AI API Key 與選擇模型 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Cpu size={16} /> 個人 AI 金鑰與模型 ({diagResult.aiProviderName})
              </span>
              <span style={{ color: diagResult.hasGeminiKey ? 'var(--income)' : 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                {diagResult.hasGeminiKey ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {diagResult.hasGeminiKey
                  ? `個人金鑰已生效 (${diagResult.geminiModel})`
                  : '未設定個人 API Key (系統無預設金鑰)'}
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
                  🤖 {diagResult.geminiModel} 測試語句「麥當勞吃了 180 元」真實解析結果：
                </div>
                <div className="font-mono" style={{ fontSize: '12px', color: 'var(--purple)', backgroundColor: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                  分類: {diagResult.testAIResult[0].categoryName} | 金額: ${diagResult.testAIResult[0].amount} | 備註: {diagResult.testAIResult[0].note}
                </div>
              </div>
            )}

            {/* AI 診斷錯誤 */}
            {diagResult.aiError && (
              <div style={{ marginTop: '6px', color: 'var(--expense)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', lineHeight: 1.6 }}>
                ⚠️ <strong>AI 解析診斷提示</strong>：{diagResult.aiError}
              </div>
            )}

            {/* GAS 錯誤說明與解決步驟 */}
            {diagResult.error && (
              <div style={{ marginTop: '6px', color: 'var(--expense)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: 'var(--radius-sm)', lineHeight: 1.6 }}>
                ⚠️ <strong>GAS 診斷提示</strong>：{diagResult.error}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            目前 GAS URL：<code className="font-mono" style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{GAS_URL ? GAS_URL.slice(0, 45) + '...' : '尚未設定'}</code>
          </div>
        )}
      </Card>

      {/* 4. 主題與介面偏好 */}
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

      {/* 5. 資料備份與安全性 */}
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
