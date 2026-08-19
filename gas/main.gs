/**
 * 智慧記帳 Web App - Google Apps Script 後端主進入點
 * 部署說明：發布為 Web 應用程式 (Execute as: Me, Who has access: Anyone)
 */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'healthCheck';
  
  try {
    switch (action) {
      case 'healthCheck':
        return jsonResponse({
          status: 'ok',
          message: 'Smart Expense Tracker GAS API is running healthy',
          timestamp: new Date().toISOString()
        });
        
      case 'getTWStockAll':
        return handleGetTWStockAll();
        
      default:
        return jsonResponse({ error: '無效的 GET 動作: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack }, 500);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ error: '缺少請求主體內容 (postData)' }, 400);
    }

    const request = JSON.parse(e.postData.contents);
    const { action, payload } = request;

    switch (action) {
      case 'parseExpense':
        return handleParseExpense(payload);

      case 'getStockQuote':
        return handleGetStockQuote(payload);

      case 'searchStock':
        return handleSearchStock(payload);

      case 'getBatchQuotes':
        return handleBatchQuotes(payload);

      case 'getSpendingInsights':
        return handleSpendingInsights(payload);

      default:
        return jsonResponse({ error: '無效的 POST 動作: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.toString(), stack: err.stack }, 500);
  }
}

/**
 * 統一回應 JSON 格式，設定適當的 MIME 類型
 */
function jsonResponse(data, statusCode) {
  statusCode = statusCode || 200;
  const output = JSON.stringify({
    success: statusCode >= 200 && statusCode < 300,
    statusCode: statusCode,
    data: data
  });
  
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
