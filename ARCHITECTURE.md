# 網球雙打賽事系統 - 系統架構

## 系統架構圖

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Application (App.tsx)                  │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  賽事    │  │  選手    │  │  比賽    │  │  即時    │       │
│  │  設定    │  │  管理    │  │  記錄    │  │  排名    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │             │             │               │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Components Layer                          │
│                                                                   │
│  ┌───────────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ PlayerManagement  │  │  MatchList   │  │    Standings     │ │
│  │   - 新增選手      │  │  - 比賽列表  │  │  - 隊伍排名      │ │
│  │   - 編輯選手      │  │  - 輪次分組  │  │  - 選手統計      │ │
│  │   - 刪除選手      │  │  - 狀態篩選  │  │  - 進度追蹤      │ │
│  └───────────────────┘  └──────┬───────┘  └──────────────────┘ │
│                                 │                                 │
│                          ┌──────▼─────────┐                      │
│                          │ ScoreRecorder  │                      │
│                          │  - 開始比賽    │                      │
│                          │  - 記錄比分    │                      │
│                          │  - Tie-break   │                      │
│                          │  - 自動判定    │                      │
│                          └────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Utils Layer                               │
│                                                                   │
│  ┌──────────────────────┐          ┌────────────────────────┐   │
│  │ scheduleGenerator.ts │          │     demoData.ts        │   │
│  │  - 生成配對          │          │  - 生成示範選手        │   │
│  │  - 驗證規則          │          │  - 40名選手資料        │   │
│  │  - 生成完整賽程      │          └────────────────────────┘   │
│  └──────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Types Layer                               │
│                                                                   │
│  Player │ TeamName │ Gender │ Pair │ Match │ Round              │
│  PointType │ TeamStats │ Tournament │ TournamentConfig          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Data Persistence Layer                         │
│                                                                   │
│                      localStorage                                 │
│         ┌──────────────┬─────────────────┬──────────────┐       │
│         │tennisPlayers │ tennisMatches   │tournamentS.. │       │
│         └──────────────┴─────────────────┴──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## 資料流程圖

```
                    ┌─────────────────┐
                    │  使用者操作     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   React State   │
                    │  - players[]    │
                    │  - matches[]    │
                    │  - tournament   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   useEffect     │
                    │  自動監聽變化   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  localStorage   │
                    │   自動儲存      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  頁面重新載入   │
                    │   自動恢復      │
                    └─────────────────┘
```

## 功能模組詳細架構

### 1. 選手管理模組

```
PlayerManagement Component
│
├── State Management
│   ├── name (選手姓名)
│   ├── age (選手年齡)
│   ├── gender (選手性別)
│   ├── team (所屬隊伍)
│   └── editingId (編輯中的ID)
│
├── Functions
│   ├── handleSubmit() - 新增/更新選手
│   ├── handleEdit() - 編輯選手
│   ├── handleCancelEdit() - 取消編輯
│   └── getTeamCount() - 取得隊伍人數
│
└── UI Elements
    ├── 表單區 (Form)
    │   ├── 姓名輸入框
    │   ├── 年齡輸入框
    │   ├── 性別選擇器
    │   └── 隊伍選擇器
    │
    └── 選手列表 (Table)
        ├── 甲隊選手表格
        ├── 乙隊選手表格
        ├── 丙隊選手表格
        └── 丁隊選手表格
```

### 2. 賽程生成模組

```
scheduleGenerator.ts
│
├── generatePairs() - 生成所有可能配對
│   ├── 輸入: Player[]
│   └── 輸出: Pair[]
│
├── isValidPoint5Pair() - 驗證第5點配對
│   ├── 檢查混雙規則
│   └── 檢查女雙規則
│
├── findPairForPoint() - 為指定點數找配對
│   ├── 檢查選手出賽次數
│   ├── 確保年齡遞增
│   └── 避免重複配對
│
├── generateRound() - 生成一輪比賽
│   ├── 生成對戰組合
│   ├── 為每組生成5點
│   └── 記錄已使用配對
│
├── generateFullSchedule() - 生成完整賽程
│   ├── 計算所需輪數
│   ├── 生成每一輪
│   └── 更新出賽次數
│
└── validateSchedule() - 驗證賽程
    ├── 檢查出賽次數
    ├── 檢查年齡規則
    └── 檢查混雙規則
```

### 3. 計分系統模組

```
ScoreRecorder Component
│
├── State Management
│   └── showTiebreak (是否顯示Tie-break)
│
├── Functions
│   ├── addGame() - 增加局數
│   │   ├── 檢查4:4條件
│   │   ├── 檢查獲勝條件
│   │   └── 更新比賽狀態
│   │
│   ├── removeGame() - 減少局數
│   │   └── 處理回退邏輯
│   │
│   ├── updateTiebreak() - 更新Tie-break分數
│   │   ├── 檢查獲勝條件(7分+領先2分)
│   │   └── 自動完成比賽
│   │
│   └── startMatch() - 開始比賽
│
└── UI States
    ├── scheduled (未開始)
    │   └── 顯示開始按鈕
    │
    ├── in-progress (進行中)
    │   ├── 顯示計分器
    │   ├── +1局 / -1局 按鈕
    │   └── Tie-break區域
    │
    └── completed (已完成)
        ├── 顯示最終比分
        └── 標示獲勝隊伍
```

### 4. 排名系統模組

```
Standings Component
│
├── calculateTeamStats() - 計算隊伍統計
│   ├── 遍歷所有比賽
│   ├── 累計勝負場數
│   ├── 累計局數
│   ├── 計算積分
│   └── 多層排序
│
├── getPlayerStats() - 計算選手統計
│   ├── 遍歷選手的比賽
│   ├── 累計勝負
│   ├── 累計局數
│   └── 排序選手
│
└── UI Display
    ├── 進度條
    │   ├── 已完成場次
    │   └── 完成百分比
    │
    ├── 隊伍排名表
    │   ├── 排名
    │   ├── 積分
    │   ├── 勝負場
    │   └── 淨勝局
    │
    └── 選手表現表
        ├── 按隊伍分組
        ├── 出賽次數
        ├── 勝負統計
        └── 局數統計
```

## 資料模型關係圖

```
Tournament (賽事)
│
├── config: TournamentConfig
│   ├── totalPlayers: 40
│   ├── playersPerTeam: 10
│   ├── matchesPerPlayer: 3
│   ├── pointsPerRound: 5
│   ├── gamesPerMatch: 5
│   ├── noAd: true
│   └── tiebreakAt44: true
│
├── teams: { [TeamName]: Player[] }
│   ├── 甲隊: Player[] (10人)
│   ├── 乙隊: Player[] (10人)
│   ├── 丙隊: Player[] (10人)
│   └── 丁隊: Player[] (10人)
│
├── rounds: Round[]
│   └── Round
│       ├── roundNumber: number
│       ├── matches: Match[]
│       └── completed: boolean
│
└── teamStats: TeamStats[]
    └── TeamStats
        ├── teamName: TeamName
        ├── matchesWon: number
        ├── matchesLost: number
        ├── gamesWon: number
        ├── gamesLost: number
        └── points: number


Player (選手)
├── id: string
├── name: string
├── age: number
├── gender: Gender ('男' | '女')
├── team: TeamName
└── matchesPlayed: number (0-3)


Match (比賽)
├── id: string
├── roundNumber: number
├── pointNumber: PointType (1-5)
├── team1: TeamName
├── team2: TeamName
├── pair1: Pair
│   ├── player1: Player
│   ├── player2: Player
│   └── totalAge: number
├── pair2: Pair
├── team1Games: number (0-5)
├── team2Games: number (0-5)
├── team1TiebreakScore?: number
├── team2TiebreakScore?: number
├── status: 'scheduled' | 'in-progress' | 'completed'
└── winner?: TeamName
```

## 技術棧層次

```
┌─────────────────────────────────────┐
│         User Interface Layer         │
│              (UI/UX)                 │
│    React Components + CSS3           │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│      Business Logic Layer            │
│   React Hooks + TypeScript           │
│   - State Management                 │
│   - Event Handlers                   │
│   - Data Processing                  │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│       Utility Functions Layer        │
│   - Schedule Generation              │
│   - Validation Logic                 │
│   - Demo Data Generation             │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│         Type System Layer            │
│      TypeScript Interfaces           │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│      Data Persistence Layer          │
│         localStorage API             │
└─────────────────────────────────────┘
```

## 核心演算法流程

### 賽程生成演算法

```
開始
│
├─ 步驟1: 初始化
│  ├─ 設定總輪數 = 4
│  └─ 創建空賽程列表
│
├─ 步驟2: 對每一輪
│  │
│  ├─ 2.1: 生成對戰組合
│  │  └─ (甲-乙, 甲-丙, 甲-丁, 乙-丙, 乙-丁, 丙-丁)
│  │
│  ├─ 2.2: 對每個對戰組合
│  │  │
│  │  ├─ 2.2.1: 生成第1-4點 (年齡遞增)
│  │  │  ├─ 找到最小年齡配對作為第1點
│  │  │  ├─ 找到次小年齡配對作為第2點
│  │  │  ├─ 找到第三小年齡配對作為第3點
│  │  │  └─ 找到第四小年齡配對作為第4點
│  │  │
│  │  └─ 2.2.2: 生成第5點 (混雙/女雙)
│  │     ├─ 篩選混雙配對
│  │     ├─ 篩選女雙配對
│  │     └─ 選擇符合條件的配對
│  │
│  └─ 2.3: 更新選手出賽次數
│
├─ 步驟3: 驗證賽程
│  ├─ 檢查每位選手是否出賽3場
│  ├─ 檢查年齡遞增規則
│  └─ 檢查混雙/女雙規則
│
└─ 結束：返回完整賽程
```

### 計分系統流程

```
比賽狀態機
│
├─ 狀態: scheduled (未開始)
│  │
│  └─ 動作: 點擊「開始比賽」
│     └─ 轉換到 → in-progress
│
├─ 狀態: in-progress (進行中)
│  │
│  ├─ 動作: 點擊「+1局」
│  │  ├─ 更新局數
│  │  ├─ 檢查是否 4:4
│  │  │  ├─ 是 → 啟動 Tie-break
│  │  │  └─ 否 → 檢查是否有隊伍達5局
│  │  │     ├─ 是 → 轉換到 completed
│  │  │     └─ 否 → 繼續比賽
│  │  └─ 更新顯示
│  │
│  ├─ 動作: 點擊「-1局」
│  │  ├─ 減少局數
│  │  ├─ 檢查是否需要取消 Tie-break
│  │  └─ 更新顯示
│  │
│  └─ Tie-break模式
│     ├─ 動作: 點擊「+1」
│     ├─ 更新 Tie-break 分數
│     ├─ 檢查獲勝條件 (≥7 且 領先≥2)
│     │  ├─ 是 → 判定獲勝，轉換到 completed
│     │  └─ 否 → 繼續 Tie-break
│     └─ 更新顯示
│
└─ 狀態: completed (已完成)
   ├─ 標示獲勝隊伍
   ├─ 顯示最終比分
   ├─ 更新選手出賽次數
   └─ 更新隊伍統計
```

## 性能優化策略

```
1. React 優化
   ├─ 使用 React.memo() 避免不必要的重渲染
   ├─ 合理拆分組件
   └─ 使用 useCallback 和 useMemo

2. localStorage 優化
   ├─ 僅在資料變更時才儲存
   ├─ 使用 useEffect 監聽特定依賴
   └─ 避免過度頻繁的讀寫

3. 演算法優化
   ├─ 使用 Map/Set 提高查找效率
   ├─ 避免巢狀迴圈
   └─ 提前終止無效搜尋

4. UI 優化
   ├─ CSS 使用 transform 代替 position
   ├─ 適當使用 transition
   └─ 響應式設計使用 Grid/Flexbox
```

---

這個系統架構確保了：
- ✅ 清晰的職責分離
- ✅ 易於維護和擴展
- ✅ 良好的使用者體驗
- ✅ 可靠的資料持久化
- ✅ 高效的性能表現
