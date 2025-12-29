# 🎾 網球雙打賽事系統 (Tennis Doubles Tournament System)

A comprehensive and fully configurable web application for managing tennis doubles tournaments with Chinese rule support.

## ⭐ 最新更新 (Latest Updates)

### 🎯 完全可配置系統 (v2.0 - 2025-12-29)
- ✅ **動態賽事設定**: 可自由調整參賽人數、比賽點數、總輪數
- ✅ **智能範本管理**: 儲存/載入/匯出/匯入配對設定
- ✅ **零硬編碼約束**: 所有限制都根據設定動態調整
- ✅ **靈活賽制**: 支援4-80人（每隊4-20人）的各種規模賽事

## 功能特點 (Features)

### 🔧 1. 可配置賽事設定 (Configurable Tournament Settings)
- ✅ **每隊人數**: 4-20人（預設10人）
- ✅ **每輪點數**: 3-10點（預設5點）
- ✅ **總輪數**: 1-5輪（預設3輪）
- ✅ **自動計算**: 最少出賽場次動態計算
- ✅ **即時更新**: 設定變更時UI即時同步
- ✅ **持久化**: 設定自動儲存到 localStorage

### 👥 2. 選手管理 (Player Management)
- ✅ 新增/編輯/刪除選手
- ✅ 動態團隊人數限制（根據設定調整）
- ✅ 4隊分組（甲乙丙丁）
- ✅ 候補選手系統
- ✅ 記錄姓名、年齡、性別
- ✅ 示範資料生成（自動根據設定產生）

### 🤖 3. 自動賽程生成 (Automatic Schedule Generation)
- ✅ 第1至倒數第2點：年齡遞增規則
- ✅ 最後一點：強制混雙或女雙
- ✅ 智能配對演算法
- ✅ 保證每位選手達到最少出賽次數
- ✅ 支援動態點數和輪數

### ✋ 4. 手動配對設定 (Manual Match Setup)
- ✅ 完全自訂配對
- ✅ 範本管理（儲存/載入/刪除）
- ✅ 匯出配對設定（JSON格式）
- ✅ 匯入配對設定（智能選手匹配）
- ✅ 配對驗證（年齡規則、性別規則）
- ✅ 視覺化配對介面

### 📊 5. 即時計分 (Live Scoring)
- ✅ NO-AD制計分
- ✅ 先達5局獲勝
- ✅ 4:4時Tie-break搶7
- ✅ 即時更新比分

### 🏆 6. 即時排名 (Live Standings)
- ✅ 隊伍積分排名
- ✅ 勝場/局數統計
- ✅ 選手個人表現
- ✅ 賽事進度追蹤

## 賽事規則 (Tournament Rules)

### 基本規則（可配置）
- **參賽人數**: 可設定每隊4-20人（總16-80人）
- **比賽形式**: 可設定每輪3-10點雙打
  - 第1點至倒數第2點：兩人歲數遞增
  - 最後一點：必須安排混雙或女雙出賽，歲數沒有限制
- **出賽場次**: 根據設定自動計算每人最少出賽場次
- **賽制**: 比賽採5局NO-AD制，先達5局獲勝
- **Tie-break**: 4:4時Tie-break搶7決勝

### 積分規則
- 勝場得3分
- 排名依據：積分 > 勝場 > 淨勝局 > 總勝局

## 技術架構 (Tech Stack)

- **前端框架**: React 18 + TypeScript
- **建置工具**: Vite 7.3
- **狀態管理**: React Hooks (useState, useEffect)
- **資料持久化**: localStorage (設定、選手、範本)
- **檔案處理**: File API, Blob API, JSON
- **樣式**: CSS3 (Responsive Design)
- **型別安全**: 100% TypeScript覆蓋率

## 快速開始 (Quick Start)

### 安裝依賴
```bash
npm install
```

### 開發模式
```bash
npm run dev
```
訪問 http://localhost:5174

### 打包生產版本
```bash
npm run build
```

### 預覽生產版本
```bash
npm run preview
```

## 使用流程 (User Flow)

### 1. 配置賽事
1. 進入「賽事設定」頁面
2. 調整「每隊人數」、「每輪點數」、「總輪數」
3. 觀察「每人最少出賽」自動計算
4. 點擊「載入示範資料」快速開始（可選）

### 2. 管理選手
1. 進入「選手管理」頁面
2. 新增40名選手（每隊10人）
3. 填寫姓名、年齡、性別、隊伍
4. 返回「賽事設定」
5. 點擊「開始賽事」生成賽程

### 2. 比賽記錄
1. 進入「比賽記錄」頁面
2. 選擇要記錄的比賽
3. 點擊「開始比賽」
4. 使用 +1局 / -1局 按鈕記錄比分
5. 4:4時自動進入Tie-break模式
6. 比賽自動完成並更新排名

### 3. 查看排名
1. 進入「即時排名」頁面
2. 查看隊伍排名
3. 查看選手個人表現
4. 追蹤賽事進度

## 專案結構 (Project Structure)

```
Contest/
├── src/
│   ├── components/          # React組件
│   │   ├── PlayerManagement.tsx   # 選手管理
│   │   ├── MatchList.tsx          # 比賽列表
│   │   ├── ScoreRecorder.tsx      # 計分器
│   │   └── Standings.tsx          # 排名顯示
│   ├── utils/              # 工具函數
│   │   └── scheduleGenerator.ts   # 賽程生成器
│   ├── types/              # TypeScript類型定義
│   │   └── index.ts
│   ├── App.tsx             # 主應用
│   ├── App.css             # 樣式
│   └── main.tsx            # 入口文件
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 核心演算法 (Core Algorithms)

### 賽程生成演算法
- 智能配對：確保年齡遞增規則
- 出賽平衡：確保每位選手出賽3場
- 規則驗證：自動檢查混雙/女雙規則

### 計分系統
- NO-AD制：無Deuce計分
- Tie-break：先達7分且領先2分獲勝
- 自動判定：自動判斷比賽結束

### 排名計算
- 多層排序：積分 > 勝場 > 淨勝局
- 即時更新：比分變化即時反映

## 資料持久化 (Data Persistence)

- 使用 localStorage 儲存：
  - 選手資料 (`tennisPlayers`)
  - 比賽資料 (`tennisMatches`)
  - 賽事狀態 (`tournamentStarted`)
- 自動載入：頁面刷新後自動恢復資料
- 重置功能：可完全清除資料重新開始

## 響應式設計 (Responsive Design)

- 支援桌面、平板、手機
- 自適應佈局
- 觸控友好的按鈕設計

---

## React + TypeScript + Vite Template

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
