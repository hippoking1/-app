package com.smartexpense.app;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (this.bridge == null || this.bridge.getWebView() == null) {
            return;
        }

        final WebView mainWebView = this.bridge.getWebView();
        final WebSettings settings = mainWebView.getSettings();

        // 1. 清除啟動時舊有 HTTP 靜態快取（保留 IndexedDB 與 LocalStorage 登入狀態）
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        mainWebView.clearCache(false);

        // 2. 移除 Android WebView 預設的 "; wv" 與 "Version/X.X" 標記
        // 避免 Google OAuth 攔截報錯 disallowed_useragent，並允許於 App 內部完成 Google 登入
        String rawUserAgent = settings.getUserAgentString();
        final String cleanUserAgent = rawUserAgent
            .replace("; wv)", ")")
            .replace("; wv", "")
            .replaceAll("Version/\\d+\\.\\d+\\s*", "");
        settings.setUserAgentString(cleanUserAgent);

        // 3. 啟用多視窗與第三方 Cookie，讓 Firebase signInWithPopup 在 App 內建彈窗完成並回傳憑證
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);

        final CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(mainWebView, true);

        // 4. 攔截 window.open (Firebase Google OAuth Popup)，於 App 內部全螢幕 Dialog 處理，不跳出外部瀏覽器
        try {
            mainWebView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    return createInAppOAuthDialog(mainWebView, cleanUserAgent, resultMsg);
                }
            });
        } catch (Exception e) {
            mainWebView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                    return createInAppOAuthDialog(mainWebView, cleanUserAgent, resultMsg);
                }
            });
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private boolean createInAppOAuthDialog(final WebView mainWebView, final String cleanUserAgent, final Message resultMsg) {
        if (isFinishing() || resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
            return false;
        }

        final Dialog oauthDialog = new Dialog(MainActivity.this, android.R.style.Theme_DeviceDefault_NoActionBar);
        Window dialogWindow = oauthDialog.getWindow();
        if (dialogWindow != null) {
            dialogWindow.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
            dialogWindow.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        }

        // 建立外層容器
        LinearLayout container = new LinearLayout(MainActivity.this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setBackgroundColor(Color.parseColor("#0b0f19"));
        container.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));

        // 頂部導覽列（提供返回關閉按鈕與標題）
        int dp12 = dpToPx(12);
        int dp16 = dpToPx(16);
        LinearLayout header = new LinearLayout(MainActivity.this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setBackgroundColor(Color.parseColor("#0f172a"));
        header.setPadding(dp16, dp12, dp16, dp12);

        TextView titleView = new TextView(MainActivity.this);
        titleView.setText("Google 帳號安全登入");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        header.addView(titleView, titleParams);

        TextView closeBtn = new TextView(MainActivity.this);
        closeBtn.setText("✕ 取消返回");
        closeBtn.setTextColor(Color.parseColor("#94a3b8"));
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        closeBtn.setPadding(dp12, dpToPx(4), dpToPx(4), dpToPx(4));
        closeBtn.setOnClickListener(v -> oauthDialog.dismiss());
        header.addView(closeBtn);

        container.addView(header, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        // 建立內嵌的子 WebView 承接 Firebase OAuth window.open
        final WebView popupWebView = new WebView(MainActivity.this);
        WebSettings popupSettings = popupWebView.getSettings();
        popupSettings.setJavaScriptEnabled(true);
        popupSettings.setDomStorageEnabled(true);
        popupSettings.setDatabaseEnabled(true);
        popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        popupSettings.setSupportMultipleWindows(true);
        popupSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        popupSettings.setUserAgentString(cleanUserAgent);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(popupWebView, true);

        // 強制所有 http / https OAuth 轉址皆留在 App 內嵌視窗，絕不跳出外部瀏覽器
        popupWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                    return false;
                }
                return true;
            }

            @SuppressWarnings("deprecation")
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    return false;
                }
                return true;
            }
        });

        // 當 Firebase 完成驗證並執行 window.close() 時，自動關閉 Dialog 並回到主畫面
        popupWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onCloseWindow(WebView window) {
                CookieManager.getInstance().flush();
                if (oauthDialog.isShowing()) {
                    oauthDialog.dismiss();
                }
            }
        });

        container.addView(popupWebView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));

        oauthDialog.setContentView(container);

        oauthDialog.setOnDismissListener(dialog -> {
            CookieManager.getInstance().flush();
            mainWebView.evaluateJavascript("window.dispatchEvent(new CustomEvent('oauth-popup-closed'));", null);
            try {
                popupWebView.stopLoading();
                if (popupWebView.getParent() instanceof ViewGroup) {
                    ((ViewGroup) popupWebView.getParent()).removeView(popupWebView);
                }
                popupWebView.destroy();
            } catch (Exception ignored) {}
        });

        oauthDialog.show();

        WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
        transport.setWebView(popupWebView);
        resultMsg.sendToTarget();
        return true;
    }

    private int dpToPx(int dp) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            getResources().getDisplayMetrics()
        );
    }
}
