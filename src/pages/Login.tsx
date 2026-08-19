import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { loginAnonymously, loginWithGoogle } from '@/services/auth';
import { useAppStore } from '@/stores/appStore';
import { Sparkles, ShieldCheck, Zap, LineChart, Target, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, addToast } = useAppStore();
  const [loadingType, setLoadingType] = useState<'anonymous' | 'google' | null>(null);

  const handleAnonymousLogin = async () => {
    setLoadingType('anonymous');
    try {
      const user = await loginAnonymously();
      setUser(user);
      addToast({ type: 'success', message: '歡迎使用！已進入訪客體驗模式' });
      navigate('/');
    } catch (err: any) {
      addToast({ type: 'error', message: '登入失敗: ' + err.message });
    } finally {
      setLoadingType(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingType('google');
    try {
      const user = await loginWithGoogle();
      setUser(user);
      addToast({ type: 'success', message: '登入成功！' });
      navigate('/');
    } catch (err: any) {
      addToast({ type: 'error', message: 'Google 登入失敗: ' + err.message });
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        backgroundColor: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(ellipse at 50% 10%, rgba(99, 102, 241, 0.15), transparent 60%)'
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* LOGO 區塊 */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-xl)',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Sparkles size={32} />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px' }}>
            智慧記帳 <span className="text-gradient">AI & 理財</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
            結合 Gemini 3.7 Flash 智能語意記帳與台美股投資追蹤
          </p>
        </div>

        {/* 登入卡片 */}
        <Card glass padding="lg" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleAnonymousLogin}
            loading={loadingType === 'anonymous'}
            icon={<Zap size={18} />}
          >
            立即免登入快速體驗
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            <span>或使用永久雲端備份帳號</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          </div>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={handleGoogleLogin}
            loading={loadingType === 'google'}
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.2C.6 9.2 0 11.5 0 14s.6 4.8 1.6 6.8l3.7-2.9c0-.4-.1-.8-.1-1.2z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.1L1.6 16.1C3.5 19.9 7.4 23 12 23z"
                />
              </svg>
            }
          >
            使用 Google 帳號登入
          </Button>
        </Card>

        {/* 特色亮點一覽 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
              <Sparkles size={16} /> AI 自然語言
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              直接說「今天午餐150」自動解析分類與帳戶
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--income)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
              <LineChart size={16} /> 股票資產追蹤
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              整合台股盤後與美股即時報價及損益試算
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
