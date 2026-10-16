import React from 'react';
import { useVersionUpdater } from '@/hooks/useVersionUpdater';
import { useSingleInstanceGuard } from '@/hooks/useSingleInstanceGuard';
import { Sparkles, RefreshCw, Layers, X, MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * 全域執行期守護元件：
 * 1. 負責啟動時與切回前景時自動偵測最新版本並智慧無感更新
 * 2. 負責攔截並防止同一瀏覽器同時開啟多個分頁操作
 */
export const AppRuntimeGuard: React.FC = () => {
  const {
    currentVersion,
    latestVersion,
    hasUpdate,
    isUpdating,
    isDismissed,
    setDismissed,
    applyUpdate
  } = useVersionUpdater();

  const { isDuplicateTab, takeOverHere } = useSingleInstanceGuard();

  // 1. 若偵測到重複開啟的多餘瀏覽器分頁，顯示單一實例保護畫面
  if (isDuplicateTab) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(11, 15, 25, 0.92)',
          backdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-focus)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Layers size={28} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
            「智慧記帳」已在另一個視窗開啟中
          </h2>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            為避免同時開啟多個分頁造成記帳資料不同步，系統已自動暫停此分頁。
            <br />
            建議至「系統設定」安裝<strong>電腦版 (.exe)</strong> 或<strong>手機版獨立 App</strong>，即可永遠以單一獨立視窗運行！
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '4px' }}>
            <Button
              variant="primary"
              fullWidth
              onClick={takeOverHere}
              icon={<MonitorSmartphone size={16} />}
            >
              切換至此視窗繼續使用（接管主視窗）
            </Button>

            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                window.close();
              }}
            >
              關閉此多餘分頁
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 正在執行智慧無感自動更新時的過渡畫面
  if (isUpdating) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          backgroundColor: 'rgba(11, 15, 25, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-focus)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)'
          }}
        >
          <RefreshCw size={24} color="var(--primary)" className="animate-spin" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
              正在自動更新至最新版本 (v{latestVersion || currentVersion})...
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              正在同步最新程式碼與清理舊快取，請稍候
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. 若在使用者操作過程中偵測到新版本，顯示不打斷輸入的懸浮更新橫幅
  if (hasUpdate && !isDismissed) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-top, 52px) + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9990,
          width: 'calc(100% - 32px)',
          maxWidth: '520px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%)',
          border: '1px solid var(--primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '12px 16px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backdropFilter: 'blur(12px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.2)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Sparkles size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
              發現新版本 v{latestVersion || currentVersion}
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
              點擊「立即更新」即可套用最新功能，不影響您的帳務資料
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <Button
            variant="primary"
            size="sm"
            onClick={applyUpdate}
            icon={<RefreshCw size={14} />}
          >
            立即更新
          </Button>
          <button
            onClick={() => setDismissed(true)}
            title="稍後更新"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
