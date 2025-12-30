# 範本管理與匯入匯出功能 - 實作說明

## 功能概述

為手動配對系統新增了範本管理和匯入匯出功能，讓使用者可以：
1. **儲存配對範本** - 將當前配對儲存為可重複使用的範本
2. **載入範本** - 快速套用先前儲存的配對模式
3. **匯出設定** - 將配對設定匯出為 JSON 檔案
4. **匯入設定** - 從 JSON 檔案匯入配對設定

## 新增功能

### 1. 儲存範本 💾

**功能說明：**
- 將當前的配對設定儲存為範本
- 範本包含所有輪次的所有配對
- 儲存時記錄賽事設定（人數/點數/輪數）
- 儲存到瀏覽器 localStorage

**使用流程：**
1. 完成配對設定（可以是部分或全部）
2. 點擊「💾 儲存範本」按鈕
3. 輸入範本名稱
4. 確認儲存

**資料結構：**
```typescript
interface SavedTemplate {
  name: string;              // 範本名稱
  date: string;              // 儲存時間 (ISO格式)
  settings: TournamentSettings;  // 賽事設定
  assignments: Array<{
    id: string;
    roundNumber: number;
    pointNumber: number;
    team1: TeamName;
    team2: TeamName;
    pair1PlayerIds: [string | null, string | null];
    pair2PlayerIds: [string | null, string | null];
  }>;
}
```

### 2. 載入範本 📂

**功能說明：**
- 顯示所有已儲存的範本列表
- 每個範本顯示名稱、日期、設定資訊
- 可選擇載入或刪除範本
- 載入時自動匹配選手ID

**使用流程：**
1. 點擊「📂 載入範本」按鈕
2. 查看範本列表
3. 選擇要載入的範本
4. 確認載入（會覆蓋當前配對）

**智能匹配：**
- 根據選手ID匹配選手
- 若ID不存在，嘗試根據姓名匹配
- 找不到匹配則該位置顯示為空

**設定檢查：**
- 檢查範本設定與當前設定是否相符
- 若不相符顯示警告訊息
- 使用者可決定是否繼續載入

### 3. 匯出設定 📤

**功能說明：**
- 將當前配對匯出為 JSON 檔案
- 包含完整的選手資訊（ID、姓名、年齡、性別）
- 可用於備份或分享

**使用流程：**
1. 點擊「📤 匯出設定」按鈕
2. 系統自動下載 JSON 檔案
3. 檔名格式：`配對設定_2025-12-29.json`

**匯出資料結構：**
```json
{
  "name": "配對設定",
  "date": "2025-12-29T10:30:00.000Z",
  "settings": {
    "playersPerTeam": 10,
    "pointsPerRound": 5,
    "totalRounds": 3,
    "minMatchesPerPlayer": 2
  },
  "assignments": [
    {
      "id": "R1-甲隊-乙隊-P1",
      "roundNumber": 1,
      "pointNumber": 1,
      "team1": "甲隊",
      "team2": "乙隊",
      "pair1": {
        "player1": { "id": "xxx", "name": "王小明", "age": 35, "gender": "男" },
        "player2": { "id": "yyy", "name": "李大華", "age": 32, "gender": "男" }
      },
      "pair2": { ... }
    },
    ...
  ]
}
```

### 4. 匯入設定 📥

**功能說明：**
- 從 JSON 檔案匯入配對設定
- 自動匹配選手資訊
- 支援從其他賽事複製配對

**使用流程：**
1. 點擊「📥 匯入設定」按鈕
2. 選擇 JSON 檔案
3. 系統自動解析並匹配
4. 顯示匯入結果

**智能匹配邏輯：**
```typescript
const findPlayer = (playerData: any) => {
  if (!playerData?.id) return null;
  // 優先根據ID匹配
  let player = players.find(p => p.id === playerData.id);
  // 若ID不存在，根據姓名匹配
  if (!player) {
    player = players.find(p => p.name === playerData.name);
  }
  return player || null;
};
```

## UI 設計

### 頂部工具列

位於手動配對頁面頂部，包含四個按鈕：

```
[💾 儲存範本] [📂 載入範本] [📤 匯出設定] [📥 匯入設定]
```

**按鈕樣式：**
- 半透明白色背景
- 白色邊框
- 滑鼠懸停時提升效果
- 毛玻璃效果（backdrop-filter）

### 儲存範本對話框

**元素：**
- 標題：「儲存配對範本」
- 輸入框：範本名稱
- 按鈕：「確定儲存」、「取消」

**特性：**
- 按 Enter 快速儲存
- 點擊背景關閉
- 必須輸入名稱才能儲存

### 載入範本對話框

**元素：**
- 標題：「載入配對範本」
- 範本列表（滾動）
- 每個範本項目顯示：
  - 範本名稱（粗體）
  - 儲存時間
  - 設定資訊（人數/點數/輪數）
  - 「載入」按鈕
  - 「刪除」按鈕

**特性：**
- 滑鼠懸停時高亮顯示
- 空狀態提示：「尚無儲存的範本」
- 最大高度 400px，超出滾動

## 實作細節

### 檔案修改

**ManualMatchSetup.tsx：**
1. 新增狀態：
   - `savedTemplates` - 範本列表
   - `templateName` - 範本名稱輸入
   - `showSaveDialog` - 顯示儲存對話框
   - `showLoadDialog` - 顯示載入對話框

2. 新增函數：
   - `handleSaveTemplate()` - 儲存範本
   - `handleLoadTemplate()` - 載入範本
   - `handleDeleteTemplate()` - 刪除範本
   - `handleExport()` - 匯出設定
   - `handleImport()` - 匯入設定
   - `saveTemplatesToStorage()` - 儲存到 localStorage

3. 新增 UI：
   - 工具列按鈕組
   - 儲存對話框
   - 載入對話框

**App.css：**
1. 新增樣式：
   - `.header-actions` - 工具列容器
   - `.btn-template` - 工具按鈕
   - `.template-dialog` - 對話框
   - `.template-list` - 範本列表
   - `.template-item` - 範本項目
   - `.btn-load` / `.btn-delete` - 操作按鈕

2. 響應式設計：
   - 手機版自動換行
   - 對話框寬度調整
   - 按鈕大小優化

### 資料持久化

**localStorage 鍵值：**
```javascript
localStorage.setItem('matchTemplates', JSON.stringify(templates));
```

**資料格式：**
- 陣列形式儲存多個範本
- 每個範本包含完整配對資訊
- 儲存選手ID而非完整選手物件
- 載入時重新匹配選手資料

### 錯誤處理

1. **儲存時：**
   - 檢查範本名稱是否為空
   - 防止重複名稱（可改進）

2. **載入時：**
   - 檢查設定是否相符
   - 找不到選手時顯示為空
   - 使用者確認才覆蓋

3. **匯入時：**
   - try-catch 捕獲解析錯誤
   - 格式錯誤顯示提示
   - 選手匹配失敗標記為空

## 使用場景

### 場景 1：年度賽事
某網球俱樂部每年舉辦相同規則的賽事：
1. 第一年完成配對後儲存為「標準配對2025」
2. 次年新增選手後載入範本
3. 系統自動填入去年的配對模式
4. 只需調整新加入的選手

**優點：**
- 節省大量時間
- 保持配對一致性
- 累積最佳實踐

### 場景 2：多地賽事
在不同城市舉辦相同規則的賽事：
1. 在總部完成標準配對設定
2. 匯出為 JSON 檔案
3. 發送給各地賽事管理員
4. 各地匯入後根據當地選手調整

**優點：**
- 保持賽事規則統一
- 減少重複工作
- 易於分享經驗

### 場景 3：AB 方案對比
想測試不同配對策略的效果：
1. 設定方案A並儲存為範本
2. 嘗試方案B的配對
3. 隨時載入方案A比較
4. 選擇最佳方案使用

**優點：**
- 快速切換方案
- 不怕遺失設定
- 便於決策比較

### 場景 4：臨時備份
擔心瀏覽器資料遺失：
1. 完成配對後立即匯出
2. 儲存到雲端硬碟或電腦
3. 需要時隨時匯入恢復
4. 防止意外損失

**優點：**
- 資料安全可靠
- 跨裝置使用
- 長期保存

## 技術亮點

### 1. 智能選手匹配
```typescript
// 優先ID匹配，其次名稱匹配
const player = players.find(p => p.id === savedId) 
            || players.find(p => p.name === savedName);
```

### 2. 設定相容性檢查
```typescript
if (template.settings.playersPerTeam !== settings.playersPerTeam) {
  alert('警告：範本設定與當前設定不符！');
}
```

### 3. 檔案下載實作
```typescript
const blob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = `配對設定_${date}.json`;
link.click();
URL.revokeObjectURL(url);
```

### 4. 檔案上傳處理
```typescript
const reader = new FileReader();
reader.onload = (e) => {
  const data = JSON.parse(e.target?.result as string);
  // 處理資料...
};
reader.readAsText(file);
```

## 未來改進方向

### 功能改進
1. **範本分類** - 支援標籤或分類管理
2. **範本搜尋** - 根據名稱或設定搜尋
3. **範本編輯** - 修改範本名稱和說明
4. **匯出選項** - 選擇匯出特定輪次
5. **雲端同步** - 將範本同步到雲端

### UI 改進
1. **拖放上傳** - 支援拖放 JSON 檔案匯入
2. **範本預覽** - 載入前預覽配對內容
3. **批次操作** - 批次刪除範本
4. **排序選項** - 按日期或名稱排序
5. **匯出格式** - 支援 CSV、Excel 格式

### 體驗改進
1. **進度提示** - 匯入大檔案時顯示進度
2. **衝突解決** - 選手匹配衝突時提供選項
3. **範本比較** - 比較兩個範本的差異
4. **快速操作** - 鍵盤快捷鍵支援
5. **操作記錄** - 記錄範本操作歷史

## 測試建議

### 功能測試
- [x] 儲存範本成功
- [x] 載入範本正確匹配
- [x] 刪除範本生效
- [x] 匯出檔案格式正確
- [x] 匯入檔案解析成功
- [x] 空狀態顯示正確
- [x] 錯誤處理完善

### 相容性測試
- [ ] 不同設定的範本載入
- [ ] 選手變更後的匹配
- [ ] 跨瀏覽器 localStorage
- [ ] 大型檔案匯入性能
- [ ] 特殊字元處理

### UI 測試
- [x] 按鈕響應正常
- [x] 對話框開關流暢
- [x] 列表滾動順暢
- [x] 手機版顯示正確
- [x] 動畫效果自然

## 總結

本次更新為手動配對系統新增了強大的範本管理和匯入匯出功能，大幅提升了系統的實用性和靈活性。使用者現在可以：

✅ **節省時間** - 重複使用成功的配對模式
✅ **避免錯誤** - 載入經過驗證的配對範本
✅ **輕鬆備份** - 匯出配對防止資料遺失
✅ **便於分享** - 與其他管理員共享配對設定

這些功能使得大型賽事的配對管理變得更加高效和可靠！

---

**實作完成日期：** 2025-12-29
**開發伺服器：** http://localhost:5174/
**狀態：** ✅ 完成並可用
