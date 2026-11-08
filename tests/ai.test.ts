import { describe, it, expect, beforeEach } from 'vitest';
import {
  EMPTY_AI_CONFIG,
  loadUserAIConfig,
  saveUserAIConfig,
  clearUserAIConfig,
  detectProviderFromKey,
  extractJsonFromAIOutput,
  generateAICompletion
} from '../src/services/ai';

describe('BYOK 個人 AI 金鑰資安防護與多模型選擇測試', () => {
  beforeEach(() => {
    clearUserAIConfig('guest_user_1');
    clearUserAIConfig('google_user_1');
    clearUserAIConfig();
  });

  it('系統預設絕不包含任何預設 API Key 或預設啟用狀態', () => {
    expect(EMPTY_AI_CONFIG.apiKey).toBe('');
    expect(EMPTY_AI_CONFIG.selectedModel).toBe('');
    expect(EMPTY_AI_CONFIG.isKeyValid).toBe(false);

    const guestConfig = loadUserAIConfig('guest_user_1');
    expect(guestConfig.apiKey).toBe('');
    expect(guestConfig.isKeyValid).toBe(false);
    expect(guestConfig.availableModels).toEqual([]);
  });

  it('未輸入個人 API Key 時呼叫 AI 必定拒絕存取，絕不 fallback 至任何系統金鑰', async () => {
    await expect(
      generateAICompletion({
        userPrompt: '今天午餐吃了 180 元'
      })
    ).rejects.toThrow(/尚未設定 API Key/);
  });

  it('不同使用者帳號 (例如正式帳號與訪客帳號) 的 AI 金鑰儲存完全隔離', () => {
    saveUserAIConfig(
      {
        provider: 'gemini',
        apiKey: 'AIzaSyTestUserKey123456',
        selectedModel: 'gemini-2.5-pro',
        availableModels: [{ id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' }],
        isKeyValid: true
      },
      'google_user_1'
    );

    // 訪客登入時讀取不到正式帳號的金鑰
    const guestLoaded = loadUserAIConfig('guest_user_1');
    expect(guestLoaded.apiKey).toBe('');
    expect(guestLoaded.isKeyValid).toBe(false);

    // 正式帳號可讀取自己設定的模型與金鑰
    const ownerLoaded = loadUserAIConfig('google_user_1');
    expect(ownerLoaded.apiKey).toBe('AIzaSyTestUserKey123456');
    expect(ownerLoaded.selectedModel).toBe('gemini-2.5-pro');
    expect(ownerLoaded.isKeyValid).toBe(true);
  });

  it('根據 API Key 字首自動識別各模型供應商', () => {
    expect(detectProviderFromKey('AIzaSyB123456789')).toBe('gemini');
    expect(detectProviderFromKey('gsk_abc123456')).toBe('groq');
    expect(detectProviderFromKey('sk-or-v1-abc123')).toBe('openrouter');
    expect(detectProviderFromKey('sk-ant-api03-xyz')).toBe('anthropic');
    expect(detectProviderFromKey('xai-12345678')).toBe('xai');
    expect(detectProviderFromKey('sk-proj-123456')).toBe('openai');
    expect(detectProviderFromKey('sk-deepseek123', 'deepseek')).toBe('deepseek');
  });

  it('安全解析各種模型輸出的 JSON (含 Markdown 區塊與推理標籤)', () => {
    const rawWithThinkAndFence = `<think>使用者在麥當勞花了180元</think>
\`\`\`json
[
  {"type": "expense", "amount": 180, "categoryName": "餐飲美食", "note": "麥當勞"}
]
\`\`\``;
    const parsed = extractJsonFromAIOutput<Array<{ amount: number; note: string }>>(rawWithThinkAndFence);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].amount).toBe(180);
    expect(parsed[0].note).toBe('麥當勞');
  });
});
