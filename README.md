# 數碼怪獸對打機

個人、非商業用途的 Digital Monster（數碼寶貝對打機）育成模擬。角色採用官方繁體中文（台灣）與英文名稱，進化路線依原機 Ver.1–Ver.5 及 20th Anniversary 究極體資料編寫。圖像為自行繪製的彩色像素風格，不是官方點陣圖檔。

在支援的瀏覽器中可安裝成「像 App 一樣」的漸進式網頁應用（PWA），離線也能玩。

## 本機預覽

此資料夾就是可部署的完整網站（相對路徑）。因為相機掃描 QR 與服務工作執行緒需要安全來源，請用本機網頁伺服器開啟，不要直接雙擊 `index.html`。

```bash
cd digivice
python3 -m http.server 8080
```

瀏覽器開啟 <http://localhost:8080/>。

進化路線自動化測試：

```bash
node tests/evolution.test.js
```

精靈聯絡表（審查用）在 `sprites-sheet.png`，進化圖表在 `evolution-chart.md`。

## 用 GitHub Pages 免費託管

1. 在 GitHub 建立一個新的公開（或私人，需 GitHub 付費方案才能用 Pages）儲存庫，例如 `digivice`。
2. 把**本資料夾裡的檔案**放到儲存庫**根目錄**（`index.html`、`manifest.json`、`sw.js`、`css/`、`js/`、`icons/`、`vendor/` 與 `.nojekyll` 都要在根目錄，不要再包一層 `digivice/` 資料夾）。  
   可用 GitHub 網頁的「Upload files」，或：

   ```bash
   git init
   git add .
   git commit -m "Add digivice PWA"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/<儲存庫>.git
   git push -u origin main
   ```

3. 打開儲存庫 **Settings → Pages**。
4. **Build and deployment → Source** 選 **Deploy from a branch**。
5. Branch 選 `main`，資料夾選 `/ (root)`，儲存。
6. 等一兩分鐘，網站會出現在：

   `https://<你的帳號>.github.io/<儲存庫>/`

GitHub Pages 會自動提供 HTTPS。PWA 安裝、離線快取與相機掃描 QR 都需要 HTTPS（本機 `localhost` 也可以）。

專案裡的路徑都是相對路徑（`./js/...`、`start_url: "./index.html"`），所以也可以把整個資料夾放在子路徑，只要使用者從該資料夾的 `index.html` 進入即可。

若 GitHub 把網站當成 Jekyll 網站處理而出錯，根目錄的 `.nojekyll` 會關閉 Jekyll。

更新遊戲後，請把 `sw.js` 最上方的 `CACHE = 'digivice-v1'` 改成新的版本名稱（例如 `digivice-v2`），再推送，使用者才會拿到新快取。

## 安裝到主畫面

遊戲內「設定 → 安裝到主畫面」也有同樣說明。

**iPhone / iPad（必須用 Safari）**

1. 用 Safari 開啟網站。
2. 點底端「分享」（方塊向上箭頭）。
3. 選擇「加入主畫面」，再點「加入」。

**Android（Chrome）**

1. 用 Chrome 開啟網站。
2. 點右上角「⋮」選單。
3. 選擇「安裝應用程式」或「加入主畫面」。

**電腦（Chrome / Edge）**

網址列右側的安裝圖示，或瀏覽器選單裡的「安裝數碼怪獸對打機」。

安裝後圖示是自行繪製的掌機風格像素圖，可全螢幕／獨立視窗、橫向遊玩，並在離線時從快取載入。

## 遊玩說明（摘要）

- 開始時選擇 Ver.1–5 數碼蛋或隨機；亦可選 20th 動畫限定蛋（戰鬥暴龍獸／鋼鐵加魯魯獸路線）。官方 Ver.1 究極體是電光暴龍獸，不是戰鬥暴龍獸。
- 餵食、訓練、清掃、關燈、治療，與原機類似：20 分鐘未回應的呼叫會記一次育成失誤；飢餓與體力同時未照顧只記一次。
- 成熟期進化成完全體：本階段對戰 15 場以上且勝率 80% 以上（CPU 與 PvP 都算）。進化時階段對戰紀錄會重置；狀態畫面同時顯示生涯累計。
- 完全體再依 20th 條件（究極體階段育成失誤 0–2 次等）進化成究極體。部分完全體沒有究極體。
- 可合體的究極體可進行標籤對戰，滿 5 勝後合體。
- 設定可匯出／匯入壓縮存檔碼（含檢查碼）與 QR；匯入前若已有進度會先確認。相機無法使用時可改為貼上存檔碼。
- 預設時間速度 60 倍，可改為 1 倍以接近原機節奏。

## 授權與來源

本作為粉絲向個人專案，與萬代（Bandai）或官方遊戲無關。數碼寶貝及其角色為權利人所有。請勿用於商業用途。
