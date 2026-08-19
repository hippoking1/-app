import React from 'react';
import { Sparkles, User } from 'lucide-react';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content?: string;
  children?: React.ReactNode;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, children }) => {
  const isUser = role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        width: '100%'
      }}
    >
      {/* 頭像 */}
      <div
        style={{
          width: '34px',
          height: '34px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: isUser ? 'var(--primary)' : 'var(--purple)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: isUser ? '0 2px 8px rgba(99, 102, 241, 0.3)' : '0 2px 8px rgba(168, 85, 247, 0.3)'
        }}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      {/* 訊息泡泡本體 */}
      <div
        style={{
          maxWidth: '85%',
          backgroundColor: isUser ? 'var(--primary)' : 'var(--bg-card)',
          backdropFilter: !isUser ? 'blur(16px)' : undefined,
          WebkitBackdropFilter: !isUser ? 'blur(16px)' : undefined,
          border: !isUser ? '1px solid var(--border-glass)' : 'none',
          color: isUser ? '#ffffff' : 'var(--text-primary)',
          borderRadius: 'var(--radius-lg)',
          borderTopRightRadius: isUser ? 'var(--radius-xs)' : 'var(--radius-lg)',
          borderTopLeftRadius: !isUser ? 'var(--radius-xs)' : 'var(--radius-lg)',
          padding: '12px 16px',
          fontSize: '14px',
          lineHeight: 1.6,
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {content && <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>}
        {children}
      </div>
    </div>
  );
};
