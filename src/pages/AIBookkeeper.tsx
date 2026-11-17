import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChatBubble } from '@/components/ai/ChatBubble';
import { ParsedTransactionCard } from '@/components/ai/ParsedTransactionCard';
import { useAccounts, useCategories } from '@/hooks/useFirestore';
import { useAppStore } from '@/stores/appStore';
import { parseExpenseTextWithGemini } from '@/services/gas';
import { AI_PROVIDERS } from '@/services/ai';
import { addTransaction } from '@/services/firestore';
import { ParsedTransaction, Transaction } from '@/types';
import { Bot, Send, Loader2, KeyRound, Cpu } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  parsedTransactions?: ParsedTransaction[];
}

const QUICK_PROMPTS = [
  '今天午餐吃了拉麵 240 元，現金支付',
  '搭計程車去高鐵站 350 元，刷信用卡',
  '全聯買生活用品與鮮奶共 680 元',
  '早餐 60, 午餐 130, 晚餐 200, 飲料 50'
];

export const AIBookkeeper: React.FC = () => {
  const navigate = useNavigate();
  const { user, aiConfig, setAIConfig, addToast } = useAppStore();
  const { accounts } = useAccounts();
  const { categories } = useCategories();

  const hasValidKey = Boolean(aiConfig.apiKey.trim() && aiConfig.isKeyValid && aiConfig.selectedModel);
  const providerMeta = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.gemini;
  const activeModelName = hasValidKey ? aiConfig.selectedModel : 'AI 語意記帳';

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `請輸入日常花費描述，系統將自動辨識金額、分類與帳戶：\n• 「今天在全聯買菜 580 元，刷中信卡」\n• 「早餐 60、午餐 120、晚餐 200」\n• 「昨天搭捷運 45 元，悠遊卡付款」`
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || !user || loading) return;

    if (!hasValidKey) {
      addToast({
        type: 'warning',
        message: '請先至「系統設定」輸入個人 API Key 並選擇模型'
      });
      navigate('/settings');
      return;
    }

    const userMsgId = 'msg_' + Date.now();
    const newMessages: Message[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: text }
    ];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const parsedList = await parseExpenseTextWithGemini(
        text,
        categories.map((c) => ({ id: c.id, name: c.name })),
        accounts.map((a) => ({ id: a.id, name: a.name })),
        todayStr
      );

      const aiMsgId = 'msg_ai_' + Date.now();
      setMessages([
        ...newMessages,
        {
          id: aiMsgId,
          role: 'assistant',
          content: `已透過 ${aiConfig.selectedModel} 解析出 ${parsedList.length} 筆交易，請核對以下明細並確認寫入：`,
          parsedTransactions: parsedList
        }
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `解析失敗：${err.message || '無法連線至 AI 服務'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSingle = async (msgId: string, txIndex: number, finalTx: Transaction) => {
    if (!user) return;
    try {
      finalTx.userId = user.uid;
      await addTransaction(finalTx);
      addToast({ type: 'success', message: `已寫入：${finalTx.note} ($${finalTx.amount})` });

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === msgId && msg.parsedTransactions) {
            const updated = [...msg.parsedTransactions];
            updated.splice(txIndex, 1);
            return { ...msg, parsedTransactions: updated };
          }
          return msg;
        })
      );
    } catch (err: any) {
      addToast({ type: 'error', message: '寫入失敗: ' + err.message });
    }
  };

  const handleRemoveSingle = (msgId: string, txIndex: number) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === msgId && msg.parsedTransactions) {
          const updated = [...msg.parsedTransactions];
          updated.splice(txIndex, 1);
          return { ...msg, parsedTransactions: updated };
        }
        return msg;
      })
    );
  };

  return (
    <div className="page-wrapper" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: '520px', gap: 'var(--space-4)' }}>
      {/* 頂部標題與模型快速切換器 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bot size={22} strokeWidth={1.5} color="var(--accent-text)" /> {activeModelName}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            輸入日常文字，自動完成分類、帳戶與日期比對
          </p>
        </div>

        {hasValidKey && aiConfig.availableModels.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Cpu size={14} strokeWidth={1.5} color="var(--text-secondary)" />
              {providerMeta.shortName}
            </span>
            <select
              value={aiConfig.selectedModel}
              onChange={(e) => {
                const next = e.target.value;
                setAIConfig({ selectedModel: next });
                addToast({ type: 'info', message: `已切換模型為：${next}` });
              }}
              className="font-mono"
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-focus)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontWeight: 500,
                maxWidth: '240px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {aiConfig.availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 尚未設定個人 API Key 時的提示橫幅 */}
      {!hasValidKey && (
        <Card
          padding="md"
          style={{
            borderColor: 'rgba(245, 158, 11, 0.35)',
            backgroundColor: 'var(--warning-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <KeyRound size={18} strokeWidth={1.5} color="var(--warning)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                尚未設定個人 API Key（系統不提供預設金鑰）
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                請先至「系統設定」輸入 API Key 並選擇模型，即可啟用 AI 語意記帳。
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/settings')}
            icon={<KeyRound size={14} strokeWidth={1.5} />}
          >
            前往設定
          </Button>
        </Card>
      )}

      {/* 聊天訊息捲動區 */}
      <Card
        padding="md"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          overflowY: 'auto'
        }}
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} role={msg.role} content={msg.content}>
            {msg.parsedTransactions && msg.parsedTransactions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {msg.parsedTransactions.map((item, idx) => (
                  <ParsedTransactionCard
                    key={idx}
                    transaction={item}
                    accounts={accounts}
                    categories={categories}
                    onConfirm={(tx) => handleConfirmSingle(msg.id, idx, tx)}
                    onRemove={() => handleRemoveSingle(msg.id, idx)}
                  />
                ))}
              </div>
            )}
          </ChatBubble>
        ))}

        {loading && (
          <ChatBubble role="assistant">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              <span>{aiConfig.selectedModel} 解析帳目中</span>
            </div>
          </ChatBubble>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* 快捷常用範例按鈕 */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            disabled={!hasValidKey || loading}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 400,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              cursor: hasValidKey ? 'pointer' : 'not-allowed',
              opacity: hasValidKey ? 1 : 0.5
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 底部輸入框 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        style={{ display: 'flex', gap: '8px' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            hasValidKey
              ? '輸入花費內容，例如：全聯買菜 580 元'
              : '請先至「系統設定」設定 API Key'
          }
          disabled={loading || !hasValidKey}
          style={{
            flex: 1,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '14px',
            color: 'var(--text-primary)',
            outline: 'none'
          }}
        />

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!input.trim() || loading || !hasValidKey}
          icon={<Send size={16} strokeWidth={1.5} />}
        >
          發送
        </Button>
      </form>
    </div>
  );
};
