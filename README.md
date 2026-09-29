# 翻譯年糕

IG／聊天截圖翻譯 + 回覆翻譯的網頁 App（PWA）。

- 前端：GitHub Pages（`index.html`、`config.js`、`sw.js`、`manifest.webmanifest`、兩個 icon）
- 後端：Cloudflare Worker（`worker/`），保管 Claude API 金鑰、檢查通關密碼、限制每日次數
- 翻譯引擎可選 Claude 或 Gemini（兩把金鑰都設定時，App 底下可以切換比較）
- 朋友不需要任何帳號，費用都算在你的 API 帳戶上

---

## 1. 申請 Claude API 金鑰

1. 到 https://console.anthropic.com 註冊並登入
2. 在 Billing 儲值（先儲一點點就好），並建議設定每月花費上限
3. 在 API Keys 建立一把金鑰，先複製起來（只會顯示一次）

### （選用）申請 Gemini API 金鑰

想用 Gemini 或拿來跟 Claude 比較才需要。

1. 到 https://aistudio.google.com 登入 Google 帳號 → Get API key → 建立金鑰
2. **記得綁定帳單（付費層級）**：免費層級送出的內容可能被 Google 拿去改進模型，朋友的私訊不適合

## 2. 部署 Cloudflare Worker（後端）

需要電腦上有 Node.js。

```bash
cd worker
npx wrangler login                       # 用瀏覽器登入 Cloudflare（免費帳號即可）

# 建立每日次數計數用的 KV，把輸出的 id 貼進 wrangler.toml，並取消那三行的註解
npx wrangler kv namespace create USAGE

# 設定機密（會要你貼上內容，不會存在檔案裡）
npx wrangler secret put ANTHROPIC_API_KEY   # 貼上 Claude API 金鑰
npx wrangler secret put GEMINI_API_KEY      # （選用）貼上 Gemini API 金鑰
npx wrangler secret put PASSCODE            # 自訂一組通關密碼，給朋友用

npx wrangler deploy
```

部署完會顯示網址，例如 `https://translation-gummy.xxxx.workers.dev`。

再打開 `worker/wrangler.toml`，把 `ALLOWED_ORIGINS` 改成你的 GitHub Pages 網域
（例如 `https://hoho.github.io`，**只要網域，不要後面的路徑**），然後再 `npx wrangler deploy` 一次。

## 3. 部署前端到 GitHub Pages

1. 打開 `config.js`，把 `API_URL` 換成上一步的 Worker 網址，結尾加 `/translate`
2. 在 GitHub 建一個新 repo（例如 `translation-gummy`），把 `worker/` 以外的檔案上傳（`worker/` 也上傳沒關係，裡面沒有機密）
3. repo → Settings → Pages → Source 選 `main` 分支、`/ (root)` → Save
4. 等一兩分鐘，打開 `https://你的帳號.github.io/translation-gummy/`

## 4. 給朋友用

把網址和通關密碼傳給朋友。

- **iPhone**：用 Safari 打開 →「分享」→「加入主畫面」。用法是截圖後打開 App 按「上傳截圖」，或在訊息裡複製文字貼上
- **Android**：用 Chrome 打開 → 選單 →「安裝應用程式」。安裝後截圖時按「分享」→ 選「翻譯年糕」就會直接翻譯

**iPhone 快速翻譯**：設定「輕點背面兩下」自動截圖翻譯，步驟在 `docs/iPhone捷徑設定.md`。HoHo 做好捷徑後，用 iCloud 連結分享給朋友即可。

想換密碼（例如有人外流）：`npx wrangler secret put PASSCODE` 重設，大家下次使用時會被要求重新輸入。

## 可調整的設定（`worker/wrangler.toml`）

| 設定 | 說明 |
|---|---|
| `DAILY_LIMIT` | 所有人合計每天可翻譯幾次，預設 300 |
| `MONTHLY_BUDGET_USD` | 每月預算上限（美元），預設 15（約 NT$480）。估算費用到達就暫停，下個月自動恢復；設 `0` 不限制 |
| `TWD_RATE` | 顯示台幣用的匯率，預設 32 |
| `ENGINE` | 預設翻譯引擎：`claude` 或 `gemini` |
| `MODEL` | 使用的 Claude 模型，預設 Haiku 4.5（快又便宜）。想要翻得更細膩可換成 Sonnet，但費用較高 |
| `GEMINI_MODEL` | 使用的 Gemini 模型，預設 `gemini-3.8-flash` |
| `GEMINI_THINKING` | Gemini 思考程度：`low`（最快）、`medium`、`high` |
| `ALLOWED_ORIGINS` | 允許呼叫的網域 |

## 版本號

- 前端版本在 `version.js`，後端版本在 `worker/worker.js` 的 `WORKER_VERSION`
- App 最下面會顯示兩者，方便確認朋友手機上是不是最新版
- 更新前端時記得改 `version.js`，大家的離線快取才會換成新版
- 每次改了什麼記在 `CHANGELOG.md`

## 用量提示與上限

需要綁定 KV（`USAGE`）才會生效。

- App 下方的「共用額度」卡片顯示：今天用了幾次／每日上限、本月估算費用／每月預算
- 每次翻譯完成會顯示「這次約 NT$0.19」
- 用到 80% 時頁面上方出現黃色提醒；到 100% 會暫停翻譯並顯示原因
- 第一次輸入通關密碼時，會先看到費用與敏感資料的提醒
- 費用是依官方價格和實際 token 數估算的，準確的金額以 Anthropic Console／Google 帳單為準
- 單價寫在 `worker.js` 的 `priceFor()`，官方調價時改這裡

建議仍在 Anthropic Console（Billing → Spend limits）另外設定每月上限，當作最後一道保險。

## 比較 Claude 和 Gemini

兩把金鑰都設定好之後，App 最下面有「翻譯引擎」可以選：預設 / Claude / Gemini。
翻譯結果右上角會標示這次是哪個引擎翻的。拿同一張截圖兩邊各翻一次就能比較。
只設定其中一把金鑰的話，不管選哪個都會用有金鑰的那個。

## 隱私

- Worker 不記錄任何訊息內容，只記每天用了幾次
- 訊息會送到 Claude API 或 Gemini API 翻譯。Claude API 的資料預設不會被拿去訓練模型；Gemini 請使用付費層級的金鑰
- 建議跟朋友說一聲：不要拿來翻身分證、密碼、銀行資料這類內容
