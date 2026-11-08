/**
 * BYOK (使用者自備金鑰與自選模型) AI 服務模組
 * 資安規範：伺服器不儲存亦不讀取任何預設 GEMINI_API_KEY，必須由使用者在前端傳入自己的 apiKey 與 model
 */

function handleParseExpense(payload) {
  const apiKey = (payload.apiKey || '').trim();
  const model = (payload.model || '').trim();
  if (!apiKey) {
    return jsonResponse({ error: '拒絕存取：系統不提供預設 API Key，請於前端輸入您個人的 API Key' }, 401);
  }
  if (!model) {
    return jsonResponse({ error: '請指定要使用的 AI 模型名稱 (model)' }, 400);
  }

  const userText = payload.text || '';
  const categories = payload.categories || [];
  const accounts = payload.accounts || [];
  const today = payload.userDate || new Date().toISOString().split('T')[0];

  if (!userText.trim()) {
    return jsonResponse({ error: '請提供要解析的文字內容' }, 400);
  }

  const categoryNames = categories.map(c => c.name).join(', ') || '餐飲, 交通, 購物, 娛樂, 居家, 醫療, 投資, 薪資, 其他';
  const accountNames = accounts.map(a => a.name).join(', ') || '現金, 信用卡, 銀行帳戶';

  const systemPrompt = `你是一個專業的財務記帳 AI 助手。你的任務是將使用者提供的日常自然語言文字，精確解析為一筆或多筆結構化交易資料。
今天的日期為：${today}。

【解析規則】：
1. 幣別固定為 TWD（新台幣）。金額必須為正整數數字。
2. 判斷交易類型 (type)："expense" (支出), "income" (收入), 或 "transfer" (轉帳)。若未特別說明，預設通常為 "expense"。
3. 最佳匹配分類 (categoryName)：請盡量優先從可選分類列表選擇：[${categoryNames}]。若無法匹配，填寫最合理的繁體中文類別。
4. 帳戶名稱 (accountName)：若使用者有提及支付方式（如刷卡、悠遊卡、現金、中信等），比對可用帳戶：[${accountNames}]。若未提及則預設為第一個或「現金」。
5. 日期 (date)：若提及「昨天」、「前天」、「大前天」、「上週五」等，請以今天的基準日期 (${today}) 推算正確的 YYYY-MM-DD 格式；未提及則為今日 ${today}。
6. 備註 (note)：清楚簡潔的項目摘要（例如：「全聯買菜與牛奶」、「麥當勞大麥克套餐」）。
7. 標籤 (tags)：1~3 個繁體中文標籤陣列（例如：["午餐", "速食"]）。
8. 信心度 (confidence)：0.0 ~ 1.0 的解析信心水準。

【回傳格式】：
必須嚴格遵守以下 JSON 陣列格式，不得輸出任何額外 Markdown 標記或解釋文字：
[
  {
    "type": "expense" | "income" | "transfer",
    "amount": number,
    "categoryName": string,
    "accountName": string,
    "note": string,
    "date": "YYYY-MM-DD",
    "tags": string[],
    "confidence": number
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }]
      }
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  if (responseCode !== 200) {
    return jsonResponse({ error: 'AI API 請求失敗 (' + responseCode + '): ' + responseText }, 502);
  }

  const result = JSON.parse(responseText);
  try {
    const rawContent = result.candidates[0].content.parts[0].text;
    const parsedTransactions = JSON.parse(rawContent);
    return jsonResponse(parsedTransactions);
  } catch (parseErr) {
    return jsonResponse({ error: '解析 AI 輸出結構失敗: ' + parseErr.message, raw: responseText }, 500);
  }
}

function handleSpendingInsights(payload) {
  const apiKey = (payload.apiKey || '').trim();
  const model = (payload.model || '').trim();
  if (!apiKey) {
    return jsonResponse({ error: '拒絕存取：系統不提供預設 API Key，請於前端輸入您個人的 API Key' }, 401);
  }
  if (!model) {
    return jsonResponse({ error: '請指定要使用的 AI 模型名稱 (model)' }, 400);
  }

  const prompt = `你是一位資深個人財務理財顧問。請根據以下使用者的財務數據摘要，提供 3 到 4 點精闢、實用且具建設性的繁體中文財務洞察與改善建議（包含亮點、潛在風險、超支警示與節省建議）：

【財務數據摘要】：
${JSON.stringify(payload.summaryData || payload, null, 2)}

請以結構化、親切專業的語氣輸出，格式包含：
1. 💡 本期財務健康度簡評
2. ⚠️ 需關注的花費項目或超支風險
3. 🎯 具體的省錢/資產配置建議`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  const result = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 200) {
    return jsonResponse({ error: 'AI 洞察生成失敗' }, 502);
  }

  const replyText = result.candidates[0].content.parts[0].text;
  return jsonResponse({ insights: replyText });
}
