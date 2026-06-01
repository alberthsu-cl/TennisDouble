# 🚀 快速開始：部署 PWA 並加入手機主畫面

## 第一步：產生 APP 圖示

### 選項 A：使用內建圖示產生器（推薦）

1. **開啟圖示產生器**
   - 直接在瀏覽器開啟：`public/icon-generator.html`
   - 或在本地執行：`npm run dev` 然後訪問 `http://localhost:5173/icon-generator.html`

2. **自訂圖示**
   - 修改文字（如「網球」、「比賽」）
   - 選擇顏色主題
   - 選擇圖示樣式（網球、球拍、純文字）

3. **下載所有尺寸**
   - 點擊「⬇️ 下載所有尺寸」按鈕
   - 會自動下載 8 個不同尺寸的 PNG 檔案
   - 將所有檔案放到 `public/` 資料夾

### 選項 B：使用線上工具

1. **前往** [favicon.io](https://favicon.io/favicon-converter/) 或 [RealFaviconGenerator](https://realfavicongenerator.net/)
2. **上傳您的圖片** 或使用提供的 SVG 範本 (`public/icon-template.svg`)
3. **下載生成的圖示**
4. **重新命名**為以下檔名：
   - icon-72x72.png
   - icon-96x96.png
   - icon-128x128.png
   - icon-144x144.png
   - icon-152x152.png
   - icon-192x192.png
   - icon-384x384.png
   - icon-512x512.png
5. **將檔案放到** `public/` 資料夾

### 選項 C：使用現有圖片

如果您已經有一張正方形的圖片：

```bash
# 使用 ImageMagick（需先安裝）
convert your-image.png -resize 72x72 public/icon-72x72.png
convert your-image.png -resize 96x96 public/icon-96x96.png
convert your-image.png -resize 128x128 public/icon-128x128.png
convert your-image.png -resize 144x144 public/icon-144x144.png
convert your-image.png -resize 152x152 public/icon-152x152.png
convert your-image.png -resize 192x192 public/icon-192x192.png
convert your-image.png -resize 384x384 public/icon-384x384.png
convert your-image.png -resize 512x512 public/icon-512x512.png
```

---

## 第二步：建置專案

```bash
# 安裝依賴（如果還沒安裝）
npm install

# 建置專案
npm run build
```

建置完成後，所有檔案會在 `docs/` 資料夾中。

---

## 第三步：部署到網路主機

### 🎯 方法一：GitHub Pages（最簡單，推薦）

1. **建立 GitHub 儲存庫**（如果還沒有）
   ```bash
   git init
   git add .
   git commit -m "Add PWA support"
   git branch -M main
   git remote add origin https://github.com/你的用戶名/你的儲存庫名.git
   git push -u origin main
   ```

2. **啟用 GitHub Pages**
   - 前往 GitHub 儲存庫 → Settings → Pages
   - Source: 選擇 "Deploy from a branch"
   - Branch: 選擇 `main` 和 `/docs` 資料夾
   - 點擊 Save

3. **取得網址**
   - 等待 2-5 分鐘
   - 網址會是：`https://你的用戶名.github.io/TennisDouble/`

### 🚀 方法二：Netlify（功能最強）

1. **前往** [netlify.com](https://www.netlify.com) 並登入
2. **點擊** "Add new site" → "Import an existing project"
3. **選擇** GitHub 並授權
4. **設定**：
   - Build command: `npm run build`
   - Publish directory: `docs`
5. **部署**！

### ⚡ 方法三：Vercel（速度最快）

1. **前往** [vercel.com](https://vercel.com) 並登入
2. **點擊** "Add New Project"
3. **選擇**您的 GitHub 儲存庫
4. **設定**：
   - Framework Preset: Vite
   - Output Directory: `docs`
5. **部署**！

### 🏠 方法四：自己的虛擬主機

1. **上傳** `docs/` 資料夾中的所有檔案到主機
2. **放置位置**：通常是 `public_html/` 或 `www/`
3. **重要**：如果放在根目錄，需要修改 `vite.config.ts`：
   ```typescript
   base: '/',  // 改為根目錄
   ```
   然後重新建置

---

## 第四步：測試 PWA 功能

### 在電腦測試

1. **開啟瀏覽器開發者工具**（F12）
2. **前往 Application 標籤**
3. **檢查**：
   - Manifest：確認 manifest.json 載入成功
   - Service Workers：確認 SW 註冊成功

### 在手機測試

1. **用手機瀏覽器開啟網站**
2. **測試「加入主畫面」功能**（步驟見下方）

---

## 第五步：加入手機主畫面

### 📱 iPhone (Safari)

1. **開啟 Safari** 瀏覽器
2. **前往您的網站**
3. **點擊下方分享按鈕** (↑)
4. **向下滑動**，找到「加入主畫面」
5. **編輯名稱**（可選）
6. **點擊「加入」**
7. **完成**！圖示會出現在主畫面

⚠️ **重要**：必須使用 Safari，Chrome 不支援此功能

### 🤖 Android (Chrome)

1. **開啟 Chrome** 瀏覽器
2. **前往您的網站**
3. **點擊右上角選單** (⋮)
4. **點選「新增至主畫面」** 或 「安裝應用程式」
5. **編輯名稱**（可選）
6. **點擊「新增」**
7. **完成**！圖示會出現在主畫面

---

## 🎉 完成！

您的網球賽事系統現在：
- ✅ 已部署到網路上
- ✅ 可以加入手機主畫面
- ✅ 像 APP 一樣使用
- ✅ 支援離線功能

---

## 📊 檢查清單

在完成部署後，確認以下項目：

- [ ] 所有圖示檔案都在 `public/` 資料夾
- [ ] `npm run build` 成功執行
- [ ] 網站可以在瀏覽器中正常開啟
- [ ] manifest.json 在開發者工具中正確顯示
- [ ] Service Worker 成功註冊
- [ ] 在 iPhone Safari 可以看到「加入主畫面」選項
- [ ] 在 Android Chrome 可以看到「安裝」提示
- [ ] 安裝後的 APP 可以正常開啟
- [ ] APP 圖示正確顯示

---

## 🆘 疑難排解

### 問題：看不到「加入主畫面」選項

**iPhone:**
- 確認使用 Safari 瀏覽器（不是 Chrome）
- 確認網站使用 HTTPS
- 確認不是在 LINE 內建瀏覽器中開啟

**Android:**
- 確認使用 Chrome 瀏覽器
- 確認網站使用 HTTPS
- 嘗試在網址列右側尋找「安裝」圖示

### 問題：圖示顯示不正確

- 確認所有圖示檔案都已放在 `public/` 資料夾
- 清除瀏覽器快取
- 重新建置專案：`npm run build`
- 重新部署

### 問題：無法離線使用

- Service Worker 需要第二次訪問才會完全生效
- 檢查 Service Worker 是否在開發者工具中顯示為「已啟用」
- 確認網站使用 HTTPS（localhost 除外）

### 問題：更新後沒有變化

- 修改 `public/sw.js` 中的 `CACHE_NAME` 版本號
- 清除瀏覽器快取
- 在開發者工具中手動 Unregister Service Worker

---

## 📚 更多資源

- [PWA 官方文件](https://web.dev/progressive-web-apps/)
- [部署詳細指南](DEPLOYMENT_GUIDE.md)
- [加入主畫面教學](ADD_TO_HOME_SCREEN.md)
- [專案功能說明](README.md)

---

## 💡 進階功能

想要更多功能？可以考慮：

- **自訂網域**：在 Netlify/Vercel 設定
- **推送通知**：整合 Firebase Cloud Messaging
- **Google Analytics**：追蹤使用者行為
- **更好的離線體驗**：擴充 Service Worker 快取策略
- **自動更新**：實作更新提示機制

---

需要協助？歡迎查看文件或提出 Issue！
