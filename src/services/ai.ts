import { ParsedTransaction } from '@/types';
import { getExchangeRateForCurrency } from './exchangeRate';

export type AIProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'deepseek'
  | 'xai';

export interface AIProviderMeta {
  id: AIProviderId;
  name: string;
  shortName: string;
  keyPlaceholder: string;
  keyPrefixHint: string;
  docsUrl: string;
  baseUrl: string;
  preferredModels: string[];
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProviderId;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export interface AIConfigStorage {
  provider: AIProviderId;
  apiKey: string;
  selectedModel: string;
  availableModels: AIModelOption[];
  isKeyValid: boolean;
  validatedAt?: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderMeta> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini (Google AI Studio)',
    shortName: 'Google Gemini',
    keyPlaceholder: '請輸入 AIzaSy 開頭的 Gemini API Key...',
    keyPrefixHint: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    preferredModels: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT 系列)',
    shortName: 'OpenAI',
    keyPlaceholder: '請輸入 sk- 開頭的 OpenAI API Key...',
    keyPrefixHint: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    baseUrl: 'https://api.openai.com/v1',
    preferredModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o3-mini']
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude 系列)',
    shortName: 'Anthropic Claude',
    keyPlaceholder: '請輸入 sk-ant- 開頭的 Anthropic API Key...',
    keyPrefixHint: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    baseUrl: 'https://api.anthropic.com/v1',
    preferredModels: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest']
  },
  groq: {
    id: 'groq',
    name: 'Groq (LPU 極速推論)',
    shortName: 'Groq',
    keyPlaceholder: '請輸入 gsk_ 開頭的 Groq API Key...',
    keyPrefixHint: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1',
    preferredModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b']
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter (聚合所有模型商)',
    shortName: 'OpenRouter',
    keyPlaceholder: '請輸入 sk-or- 開頭的 OpenRouter API Key...',
    keyPrefixHint: 'sk-or-...',
    docsUrl: 'https://openrouter.ai/keys',
    baseUrl: 'https://openrouter.ai/api/v1',
    preferredModels: ['google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet']
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek (深度求索)',
    shortName: 'DeepSeek',
    keyPlaceholder: '請輸入 DeepSeek API Key (sk-...)...',
    keyPrefixHint: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    baseUrl: 'https://api.deepseek.com',
    preferredModels: ['deepseek-chat', 'deepseek-reasoner']
  },
  xai: {
    id: 'xai',
    name: 'xAI (Grok 系列)',
    shortName: 'xAI Grok',
    keyPlaceholder: '請輸入 xai- 開頭的 xAI API Key...',
    keyPrefixHint: 'xai-...',
    docsUrl: 'https://console.x.ai/',
    baseUrl: 'https://api.x.ai/v1',
    preferredModels: ['grok-3-mini', 'grok-3', 'grok-2-latest']
  }
};

export const AI_PROVIDER_LIST: AIProviderMeta[] = Object.values(AI_PROVIDERS);

const STORAGE_KEY_PREFIX = 'smart_expense_user_ai_config_v2';
const memoryStorageFallback = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {}
  return memoryStorageFallback.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {}
  memoryStorageFallback.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
      localStorage.removeItem(key);
    }
  } catch {}
  memoryStorageFallback.delete(key);
}

/**
 * 取得目前登入使用者的專屬 Storage Key（隔離不同帳號，且絕不預設任何系統金鑰）
 */
function getStorageKey(uid?: string | null): string {
  const currentUid = uid || getActiveUidFromCache();
  return `${STORAGE_KEY_PREFIX}_${currentUid || 'session'}`;
}

function getActiveUidFromCache(): string | null {
  try {
    const cachedAuth = getStorageItem('smart_auth_user_cache');
    if (cachedAuth) {
      const parsed = JSON.parse(cachedAuth);
      if (parsed?.uid) return parsed.uid;
    }
    const demoAuth = getStorageItem('smart_expense_demo_user');
    if (demoAuth) {
      const parsed = JSON.parse(demoAuth);
      if (parsed?.uid) return parsed.uid;
    }
  } catch {}
  return null;
}

export const EMPTY_AI_CONFIG: AIConfigStorage = {
  provider: 'gemini',
  apiKey: '',
  selectedModel: '',
  availableModels: [],
  isKeyValid: false
};

/**
 * 讀取使用者自行設定的 AI 金鑰與模型設定（無任何系統預設金鑰）
 */
export function loadUserAIConfig(uid?: string | null): AIConfigStorage {
  try {
    const raw = getStorageItem(getStorageKey(uid));
    if (!raw) return { ...EMPTY_AI_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AIConfigStorage>;
    const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
    if (!apiKey) {
      return {
        ...EMPTY_AI_CONFIG,
        provider: parsed.provider && AI_PROVIDERS[parsed.provider] ? parsed.provider : 'gemini'
      };
    }
    const availableModels = Array.isArray(parsed.availableModels) ? parsed.availableModels : [];
    const selectedModel =
      typeof parsed.selectedModel === 'string' && parsed.selectedModel
        ? parsed.selectedModel
        : availableModels[0]?.id || '';
    return {
      provider: parsed.provider && AI_PROVIDERS[parsed.provider] ? parsed.provider : 'gemini',
      apiKey,
      selectedModel,
      availableModels,
      isKeyValid: Boolean(parsed.isKeyValid && apiKey && selectedModel),
      validatedAt: parsed.validatedAt
    };
  } catch {
    return { ...EMPTY_AI_CONFIG };
  }
}

/**
 * 儲存使用者自行設定的 AI 金鑰與模型設定
 */
export function saveUserAIConfig(config: AIConfigStorage, uid?: string | null): void {
  try {
    const key = getStorageKey(uid);
    if (!config.apiKey.trim()) {
      removeStorageItem(key);
      return;
    }
    setStorageItem(key, JSON.stringify(config));
  } catch {}
}

/**
 * 清除目前使用者的 AI 金鑰與模型設定（登出或手動清除時呼叫）
 */
export function clearUserAIConfig(uid?: string | null): void {
  try {
    removeStorageItem(getStorageKey(uid));
    removeStorageItem(`${STORAGE_KEY_PREFIX}_session`);
  } catch {}
}

/**
 * 根據 API Key 字首智慧識別模型商
 */
export function detectProviderFromKey(apiKey: string, currentProvider?: AIProviderId): AIProviderId {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith('AIza')) return 'gemini';
  if (trimmed.startsWith('gsk_')) return 'groq';
  if (trimmed.startsWith('sk-or-')) return 'openrouter';
  if (trimmed.startsWith('sk-ant-')) return 'anthropic';
  if (trimmed.startsWith('xai-')) return 'xai';
  if (trimmed.startsWith('sk-')) {
    if (currentProvider === 'deepseek') return 'deepseek';
    return 'openai';
  }
  return currentProvider || 'gemini';
}

/**
 * 根據偏好清單與名稱排序模型列表（將常用/最新生成式模型排在前面，同時完整保留模型商提供的所有模型）
 */
function sortModelsByPreference(models: AIModelOption[], preferredIds: string[]): AIModelOption[] {
  return [...models].sort((a, b) => {
    const idxA = preferredIds.findIndex((p) => a.id === p || a.id.startsWith(p));
    const idxB = preferredIds.findIndex((p) => b.id === p || b.id.startsWith(p));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    // Gemini 模型優先於其他實驗模型
    const isGeminiA = a.id.includes('gemini');
    const isGeminiB = b.id.includes('gemini');
    if (isGeminiA && !isGeminiB) return -1;
    if (!isGeminiA && isGeminiB) return 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * 驗證使用者輸入的 API Key 並從模型商官方 API 動態拉取所有可用模型
 */
export async function validateKeyAndFetchModels(
  rawApiKey: string,
  providerInput?: AIProviderId
): Promise<{
  provider: AIProviderId;
  models: AIModelOption[];
  recommendedModel: string;
}> {
  const apiKey = rawApiKey.trim();
  if (!apiKey) {
    throw new Error('請先輸入您的 API Key');
  }

  const provider = providerInput || detectProviderFromKey(apiKey);
  const meta = AI_PROVIDERS[provider];

  if (provider === 'gemini') {
    const allRawModels: any[] = [];
    let pageToken = '';

    for (let page = 0; page < 3; page++) {
      const url = `${meta.baseUrl}/models?key=${encodeURIComponent(apiKey)}&pageSize=100${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
      }`;
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errJson = await res.json();
          detail = errJson?.error?.message || '';
        } catch {}
        throw new Error(
          res.status === 400 || res.status === 403
            ? `Gemini API Key 驗證失敗：金鑰無效或無權限 ${detail ? `(${detail})` : ''}`
            : `無法連線至 Google Gemini 伺服器 (HTTP ${res.status})`
        );
      }

      const data = await res.json();
      if (Array.isArray(data?.models)) {
        allRawModels.push(...data.models);
      }
      if (data?.nextPageToken) {
        pageToken = data.nextPageToken;
      } else {
        break;
      }
    }

    // 過濾出支援對話/文字生成 (generateContent) 的模型，排除純向量 embedding 或 aqa 模型
    const generativeModels = allRawModels.filter((m: any) => {
      const methods: string[] = m.supportedGenerationMethods || [];
      const id = String(m.name || '').replace(/^models\//, '');
      if (id.startsWith('embedding-') || id.startsWith('text-embedding') || id === 'aqa') {
        return false;
      }
      return methods.length === 0 || methods.includes('generateContent');
    });

    if (generativeModels.length === 0) {
      throw new Error('此 API Key 驗證通過，但未查詢到任何支援內容生成 (generateContent) 的模型');
    }

    const mappedModels: AIModelOption[] = generativeModels.map((m: any) => {
      const id = String(m.name || '').replace(/^models\//, '');
      const displayName = m.displayName || id;
      return {
        id,
        name: displayName.toLowerCase() === id.toLowerCase() ? id : `${displayName} (${id})`,
        provider: 'gemini',
        description: m.description,
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit
      };
    });

    const sorted = sortModelsByPreference(mappedModels, meta.preferredModels);
    return {
      provider: 'gemini',
      models: sorted,
      recommendedModel: sorted[0].id
    };
  }

  if (provider === 'anthropic') {
    const res = await fetch(`${meta.baseUrl}/models?limit=100`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || '';
      } catch {}
      throw new Error(`Anthropic API Key 驗證失敗 (HTTP ${res.status})${detail ? `：${detail}` : ''}`);
    }

    const data = await res.json();
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    if (list.length === 0) {
      throw new Error('未從 Anthropic 取得任何可用模型');
    }

    const mapped: AIModelOption[] = list.map((m: any) => ({
      id: m.id,
      name: m.display_name ? `${m.display_name} (${m.id})` : m.id,
      provider: 'anthropic'
    }));

    const sorted = sortModelsByPreference(mapped, meta.preferredModels);
    return {
      provider: 'anthropic',
      models: sorted,
      recommendedModel: sorted[0].id
    };
  }

  // OpenAI 相容端點 (OpenAI / Groq / OpenRouter / DeepSeek / xAI)
  const res = await fetch(`${meta.baseUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || '';
    } catch {}
    throw new Error(`${meta.shortName} API Key 驗證失敗 (HTTP ${res.status})${detail ? `：${detail}` : ''}`);
  }

  const data = await res.json();
  const rawList: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];

  // 過濾掉非對話模型 (如 whisper, tts, dall-e, text-embedding, moderation)
  const filteredList = rawList.filter((m: any) => {
    const id = String(m.id || '').toLowerCase();
    if (!id) return false;
    if (
      id.includes('embedding') ||
      id.includes('whisper') ||
      id.includes('tts') ||
      id.includes('dall-e') ||
      id.includes('moderation') ||
      id.includes('audio') ||
      id.includes('realtime')
    ) {
      return false;
    }
    return true;
  });

  const finalList = filteredList.length > 0 ? filteredList : rawList;
  if (finalList.length === 0) {
    throw new Error(`未從 ${meta.shortName} 取得任何可用模型`);
  }

  const mapped: AIModelOption[] = finalList.map((m: any) => {
    const id = String(m.id);
    const displayName = m.name && m.name !== id ? `${m.name} (${id})` : id;
    return {
      id,
      name: displayName,
      provider,
      description: m.description,
      inputTokenLimit: m.context_length
    };
  });

  const sorted = sortModelsByPreference(mapped, meta.preferredModels);
  return {
    provider,
    models: sorted,
    recommendedModel: sorted[0].id
  };
}

/**
 * 從 AI 回傳字串中安全擷取 JSON 結構（支援自動剝除 Markdown ```json 標記與推理標籤）
 */
export function extractJsonFromAIOutput<T>(rawText: string): T {
  // 移除 <think>...</think> 推理區塊（例如 DeepSeek R1 或 Qwen QwQ）
  const withoutThink = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 移除 ```json ... ```
  const fencedMatch = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : withoutThink;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // 嘗試尋找第一個 [ ... ] 或 { ... }
    const arrayStart = candidate.indexOf('[');
    const arrayEnd = candidate.lastIndexOf(']');
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(candidate.slice(arrayStart, arrayEnd + 1)) as T;
    }
    const objStart = candidate.indexOf('{');
    const objEnd = candidate.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      return JSON.parse(candidate.slice(objStart, objEnd + 1)) as T;
    }
    throw new Error('模型回傳內容非有效的 JSON 格式');
  }
}

export interface GenerateCompletionOptions {
  userPrompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  temperature?: number;
  overrideConfig?: Partial<AIConfigStorage>;
}

/**
 * 通用 AI 對話生成核心（嚴格檢查使用者自備 API Key，絕不提供任何預設金鑰）
 */
export async function generateAICompletion(options: GenerateCompletionOptions): Promise<string> {
  const stored = loadUserAIConfig();
  const provider = options.overrideConfig?.provider || stored.provider;
  const apiKey = (options.overrideConfig?.apiKey ?? stored.apiKey).trim();
  const model = (options.overrideConfig?.selectedModel ?? stored.selectedModel).trim();

  if (!apiKey) {
    throw new Error('尚未設定 API Key！系統不預設任何金鑰，請先至「系統設定」輸入您個人的 API Key。');
  }

  if (!model) {
    throw new Error('尚未選擇 AI 模型！請先至「系統設定」驗證 API Key 並選擇要使用的模型。');
  }

  const meta = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini;
  const temperature = options.temperature ?? 0.1;

  if (provider === 'gemini') {
    const url = `${meta.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const primaryBody: Record<string, any> = {
      contents: [{ role: 'user', parts: [{ text: options.userPrompt }] }],
      generationConfig: {
        temperature
      }
    };

    if (options.systemPrompt) {
      primaryBody.systemInstruction = {
        parts: [{ text: options.systemPrompt }]
      };
    }

    if (options.jsonMode) {
      primaryBody.generationConfig.responseMimeType = 'application/json';
    }

    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(primaryBody),
      signal: AbortSignal.timeout(30000)
    });

    // 若部分模型（如 Gemma 或實驗模型）不支援 systemInstruction 或 responseMimeType，自動退回相容格式重試一次
    if (res.status === 400 && (options.systemPrompt || options.jsonMode)) {
      const combinedPrompt = options.systemPrompt
        ? `${options.systemPrompt}\n\n【使用者輸入】：\n${options.userPrompt}`
        : options.userPrompt;
      const fallbackBody = {
        contents: [{ role: 'user', parts: [{ text: combinedPrompt }] }],
        generationConfig: { temperature }
      };
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fallbackBody),
        signal: AbortSignal.timeout(30000)
      });
    }

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || '';
      } catch {}
      throw new Error(`Gemini (${model}) 呼叫失敗 (HTTP ${res.status})${detail ? `：${detail}` : ''}`);
    }

    const result = await res.json();
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => typeof p.text === 'string' && !p.thought) || parts[0];
    if (!textPart?.text) {
      throw new Error(`模型 ${model} 未回傳有效文字內容`);
    }
    return textPart.text;
  }

  if (provider === 'anthropic') {
    const res = await fetch(`${meta.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature,
        ...(options.systemPrompt ? { system: options.systemPrompt } : {}),
        messages: [{ role: 'user', content: options.userPrompt }]
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message || '';
      } catch {}
      throw new Error(`Claude (${model}) 呼叫失敗 (HTTP ${res.status})${detail ? `：${detail}` : ''}`);
    }

    const result = await res.json();
    const textBlock = (result?.content || []).find((c: any) => c.type === 'text');
    if (!textBlock?.text) {
      throw new Error(`模型 ${model} 未回傳有效文字內容`);
    }
    return textBlock.text;
  }

  // OpenAI 相容格式 (OpenAI / Groq / OpenRouter / DeepSeek / xAI)
  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.userPrompt });

  const res = await fetch(`${meta.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || '';
    } catch {}
    throw new Error(`${meta.shortName} (${model}) 呼叫失敗 (HTTP ${res.status})${detail ? `：${detail}` : ''}`);
  }

  const result = await res.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`模型 ${model} 未回傳有效文字內容`);
  }
  return content;
}

/**
 * 使用使用者自選模型解析自然語言記帳文字
 */
export async function parseExpenseWithUserAI(
  text: string,
  categories: Array<{ id: string; name: string }>,
  accounts: Array<{ id: string; name: string }>,
  userDate?: string
): Promise<ParsedTransaction[]> {
  const today = userDate || new Date().toISOString().split('T')[0];
  const categoryNames =
    categories.map((c) => c.name).join(', ') || '餐飲美食, 交通運輸, 日常購物, 休閒娛樂, 居家生活, 醫療保健, 投資理財, 薪資收入, 其他';
  const accountNames = accounts.map((a) => a.name).join(', ') || '現金錢包, 信用卡, 銀行帳戶';

  const systemPrompt = `你是一個專業的財務記帳 AI 助手。你的任務是將使用者提供的日常自然語言文字，精確解析為一筆或多筆結構化交易資料。
今天的基準日期為：${today}。

【解析規則】：
1. 幣別與金額：預設為 TWD（新台幣），金額必須為正整數數字。若使用者提及外幣（如「日幣/日圓/円/JPY」、「美金/美元/USD」、「韓元/韓幣/KRW」、「泰銖/THB」、「歐元/EUR」等），請同時輸出 originalCurrency（標準貨幣代碼）與 originalAmount（原幣金額），並以參考匯率（JPY≈0.215, USD≈32.5, KRW≈0.024, EUR≈35.2, THB≈0.95）折算為台幣整數填入 amount。
2. 判斷交易類型 (type)："expense" (支出), "income" (收入), 或 "transfer" (轉帳)。
3. 最佳匹配分類 (categoryName)：請優先從可選分類列表選擇：[${categoryNames}]。
4. 帳戶名稱 (accountName)：若提及支付方式（如刷卡、悠遊卡、現金、中信等），比對可用帳戶：[${accountNames}]。未提及預設為第一個或「現金錢包」。
5. 日期 (date)：若提及「昨天」、「前天」、「上週五」等，以基準日 (${today}) 推算正確 YYYY-MM-DD；未提及則為今日 ${today}。
6. 備註 (note)：清楚簡潔的項目摘要。
7. 標籤 (tags)：1~3 個繁體中文標籤陣列。
8. 信心度 (confidence)：0.0 ~ 1.0。

【回傳格式】：
必須嚴格只輸出 JSON 陣列格式，不得包含任何額外說明文字：
[
  {
    "type": "expense",
    "amount": 180,
    "categoryName": "餐飲美食",
    "accountName": "信用卡",
    "note": "麥當勞午餐",
    "date": "${today}",
    "tags": ["午餐", "速食"],
    "confidence": 0.95
  }
]`;

  const rawOutput = await generateAICompletion({
    userPrompt: text,
    systemPrompt,
    jsonMode: true,
    temperature: 0.1
  });

  const parsed = extractJsonFromAIOutput<ParsedTransaction[] | { transactions?: ParsedTransaction[] }>(rawOutput);
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.transactions) ? parsed.transactions : [];

  return list.map((item) => {
    const rawOriginalCurrency = item.originalCurrency?.toUpperCase();
    const hasForeign =
      rawOriginalCurrency &&
      rawOriginalCurrency !== 'TWD' &&
      typeof item.originalAmount === 'number' &&
      item.originalAmount > 0;
    const rate = hasForeign ? item.exchangeRate || getExchangeRateForCurrency(rawOriginalCurrency) : undefined;
    const amount =
      typeof item.amount === 'number' && item.amount > 0
        ? Math.round(item.amount)
        : hasForeign && rate
          ? Math.round(item.originalAmount! * rate)
          : 0;

    return {
      type: item.type === 'income' || item.type === 'transfer' ? item.type : 'expense',
      amount,
      originalCurrency: hasForeign ? rawOriginalCurrency : undefined,
      originalAmount: hasForeign ? item.originalAmount : undefined,
      exchangeRate: hasForeign ? rate : undefined,
      categoryName: item.categoryName || '其他',
      accountName: item.accountName || accounts[0]?.name || '現金錢包',
      merchant: item.merchant,
      note: item.note || text,
      date: item.date || today,
      tags: Array.isArray(item.tags) ? item.tags : ['AI智能記帳'],
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.9
    };
  });
}

/**
 * 使用使用者自選模型生成財務分析洞察
 */
export async function generateSpendingInsightsWithUserAI(summaryData: Record<string, unknown>): Promise<string> {
  const prompt = `你是一位資深個人財務顧問。請根據以下使用者的月度財務數據摘要，提供 3 到 4 點精闢、實用且具建設性的繁體中文財務洞察與改善建議：

【財務數據摘要】：
${JSON.stringify(summaryData, null, 2)}

請以結構化、親切專業的格式輸出：
1. 💡 本期財務健康度簡評
2. ⚠️ 需關注的花費項目或超支風險
3. 🎯 具體的省錢/資產配置建議`;

  return generateAICompletion({
    userPrompt: prompt,
    temperature: 0.3
  });
}
