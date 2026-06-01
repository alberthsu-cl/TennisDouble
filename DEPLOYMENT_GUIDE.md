# 部署指南 (Deployment Guide)

## 如何將網球賽事系統部署到網路主機

### 方法一：GitHub Pages (推薦，免費)

您的專案已經設定好 GitHub Pages 部署！

1. **推送到 GitHub**
   ```bash
   git add .
   git commit -m "Add PWA support"
   git push origin main
   ```

2. **啟用 GitHub Pages**
   - 前往 GitHub 儲存庫設定
   - 找到 "Pages" 選項
   - 在 "Source" 選擇 "Deploy from a branch"
   - 選擇 `main` 分支和 `/docs` 資料夾
   - 點擊 "Save"
   - 您的網站將在 `https://[您的用戶名].github.io/TennisDouble/` 上線

3. **存取網站**
   - 等待 2-5 分鐘讓 GitHub 部署
   - 前往 `https://[您的用戶名].github.io/TennisDouble/`

### 方法二：Netlify (免費，更多功能)

1. **建立帳號**
   - 前往 [netlify.com](https://www.netlify.com)
   - 使用 GitHub 帳號登入

2. **部署專案**
   - 點擊 "Add new site" → "Import an existing project"
   - 選擇 GitHub 並授權
   - 選擇您的儲存庫
   - 設定如下：
     - Build command: `npm run build`
     - Publish directory: `docs`
   - 點擊 "Deploy site"

3. **自訂網域（可選）**
   - 在 Netlify 儀表板點擊 "Domain settings"
   - 可以使用免費的 `.netlify.app` 網域
   - 或連接您自己的網域

### 方法三：Vercel (免費，針對 React 優化)

1. **建立帳號**
   - 前往 [vercel.com](https://vercel.com)
   - 使用 GitHub 帳號登入

2. **部署專案**
   - 點擊 "Add New Project"
   - 選擇您的儲存庫
   - Vercel 會自動偵測 Vite 設定
   - 更新設定：
     - Output Directory: `docs`
   - 點擊 "Deploy"

### 方法四：其他虛擬主機

如果您想使用其他虛擬主機（如 Hostinger, GoDaddy 等）：

1. **建置專案**
   ```bash
   npm run build
   ```

2. **上傳檔案**
   - 將 `docs` 資料夾中的所有檔案上傳到主機的 `public_html` 或 `www` 資料夾
   - 確保上傳所有檔案，包括 `.nojekyll`

3. **設定路徑**
   - 如果放在網域根目錄，需要修改 `vite.config.ts`：
     ```typescript
     base: '/',  // 改為根目錄
     ```
   - 重新建置並上傳

---

## 如何加入手機主畫面

### iPhone (Safari)

1. 在 Safari 開啟網站
2. 點擊下方分享按鈕 (↑)
3. 向下滑動，點選「加入主畫面」
4. 編輯名稱（預設為「網球賽事」）
5. 點擊「加入」
6. 完成！圖示會出現在主畫面

### Android

1. 在 Chrome 開啟網站
2. 點擊右上角選單 (⋮)
3. 點選「新增至主畫面」或「安裝應用程式」
4. 編輯名稱
5. 點擊「新增」或「安裝」
6. 完成！圖示會出現在主畫面

---

## 產生 APP 圖示

目前專案需要 PNG 格式的應用程式圖示。您需要建立以下尺寸的圖示：

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

### 建立圖示的方式：

1. **使用線上工具**
   - [favicon.io](https://favicon.io/) - 可上傳圖片或產生文字圖示
   - [RealFaviconGenerator](https://realfavicongenerator.net/) - 自動產生各種尺寸
   - [PWA Builder](https://www.pwabuilder.com/imageGenerator) - 專為 PWA 設計

2. **設計建議**
   - 使用網球相關圖示（網球、球拍等）
   - 背景色：白色或淺綠色（#84cc16）
   - 確保在小尺寸下清晰可見
   - 使用簡單的設計，避免過多細節

3. **放置位置**
   - 將所有圖示放在 `public/` 資料夾
   - 重新建置專案以包含新圖示

---

## 測試 PWA 功能

1. **在本機測試**
   ```bash
   npm run build
   npm run preview
   ```

2. **開啟瀏覽器開發者工具**
   - Chrome: F12 → Application → Manifest
   - 檢查 manifest.json 是否正確載入
   - 檢查 Service Worker 是否註冊成功

3. **在手機測試**
   - 使用實際裝置開啟網站
   - 測試「加入主畫面」功能
   - 確認圖示和名稱顯示正確

---

## 疑難排解

### 問題：無法顯示「加入主畫面」選項

**解決方法：**
- 確保網站使用 HTTPS（GitHub Pages 和 Netlify 預設支援）
- 確認 manifest.json 正確載入
- iOS Safari：必須在 Safari 瀏覽器中操作，Chrome 不支援
- Android：確保使用 Chrome 瀏覽器

### 問題：圖示無法顯示

**解決方法：**
- 確認所有圖示檔案已放在 `public/` 資料夾
- 檢查 manifest.json 中的路徑是否正確
- 清除瀏覽器快取並重新測試

### 問題：安裝後無法離線使用

**解決方法：**
- 檢查 Service Worker 是否成功註冊
- 開啟開發者工具確認快取策略
- 可能需要第二次訪問才能完全快取

---

## 更新應用程式

當您更新程式碼後：

1. 修改 `public/sw.js` 中的 `CACHE_NAME` 版本號
   ```javascript
   const CACHE_NAME = 'tennis-contest-v2';  // 增加版本號
   ```

2. 重新建置並部署
   ```bash
   npm run build
   git add .
   git commit -m "Update app"
   git push
   ```

3. 使用者重新開啟應用程式時會自動更新

---

## 進階功能（可選）

### 離線資料儲存
- 使用 IndexedDB 或 localStorage 儲存比賽資料
- 即使離線也能繼續使用

### 推送通知
- 設定 Firebase Cloud Messaging
- 發送比賽提醒通知

### 分析追蹤
- 整合 Google Analytics
- 追蹤使用者行為和應用程式效能

---

需要協助？檢查 [PWA 文件](https://web.dev/progressive-web-apps/) 或查看專案的 GitHub Issues。
