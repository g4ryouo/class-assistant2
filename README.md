# 課堂助理

線下外語課使用的單一網頁：即時逐字稿（每句前有時間）、依投影片修正用字、課堂中提問（可附照片）、課後總結。

網址：https://g4ryouo.github.io/class-assistant2/

## 使用

1. 用 Chrome 開啟，允許麥克風。
2. 第一次到「連線設定」填入中繼站網址（見下）。
3. 輸入課程名稱 → 上傳 slide（PDF 或貼文字）→ 開始錄音。

語音辨識使用 Chrome 內建功能（音訊會送到 Google 處理）。

## 為什麼需要中繼站

有些 Anthropic 組織關閉了瀏覽器直連（CORS），網頁直接呼叫 API 會出現
`CORS requests are not allowed for this Organization`。
中繼站（`worker.js`，Cloudflare Worker）替網頁呼叫 Claude，key 只存在 Cloudflare 的加密變數裡，不會進到瀏覽器或這個倉庫。

## 部署中繼站（約 5 分鐘，免費額度足夠）

1. 註冊／登入 [Cloudflare](https://dash.cloudflare.com/)，左側選 **Workers & Pages** → **Create** → **Create Worker**，名稱隨意（例如 `class-assistant-proxy`），按 **Deploy**。
2. 按 **Edit code**，把 `worker.js` 的內容整份貼上取代原有程式，按 **Deploy**。
3. 到該 Worker 的 **Settings → Variables and Secrets**，新增：
   - `ANTHROPIC_API_KEY`（類型 **Secret**）：你的 Claude API key
   - `APP_TOKEN`（類型 **Secret**）：自己想一組密碼，避免別人盜用你的 key
   - `ALLOWED_ORIGIN`（類型 Text）：`https://g4ryouo.github.io`
4. 複製 Worker 網址（`https://xxx.workers.dev`），貼到網頁「連線設定」的「中繼站網址」，並填入 `APP_TOKEN` 的密碼。

## 另一種中繼站：Vercel（網頁和中繼站放在同一個網址）

1. 登入 [Vercel](https://vercel.com)，**Add New → Project**，匯入這個倉庫 `g4ryouo/class-assistant2`（Framework Preset 選 **Other**），先按 Deploy。
2. 到專案 **Settings → Environment Variables**，新增：
   - `ANTHROPIC_API_KEY`：你的 Claude API key
   - `APP_TOKEN`：自己想一組密碼
3. 到 **Deployments**，對最新一次部署選 **Redeploy**，讓變數生效。
4. 打開 Vercel 給的網址（`https://xxx.vercel.app`）。在這個網址上使用時，網頁會自動使用同網址的中繼站，只需要在「連線設定」填入 `APP_TOKEN` 的密碼，中繼站網址不用填。

若你的組織本來就允許瀏覽器直連，也可以不用中繼站，直接在「連線設定」填 API key。
