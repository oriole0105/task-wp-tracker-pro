# Changelog

本文件依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 格式。

---

## [Unreleased] — 2026-02-25

### 新功能 (Features)

- **深色模式 (Dark Mode)**
  - 全域 MUI `ThemeProvider` 整合，支援 light / dark 雙主題
  - 導覽列右上角新增切換按鈕（🌙 / ☀️），設定持久化於 `localStorage`
  - `App.tsx` 包入 `ThemeProvider` + `CssBaseline`

- **任務搜尋 (Task Search)**
  - 任務管理頁面篩選列新增即時搜尋欄
  - 比對範圍：任務名稱、別名（Alias）、詳細說明
  - 與現有的狀態 / 分類 / 標籤 / 日期篩選同時作用

- **刪除任務確認對話框 (Delete Confirmation Dialog)**
  - 點擊刪除按鈕改為先彈出確認 Dialog，避免誤刪
  - 若任務下有子任務，額外顯示紅色警告（「底下子任務將一併刪除」）

- **過期任務警示 (Overdue Task Warning)**
  - 若 `estimatedEndDate` 已過且狀態非「已完成」，觸發雙重視覺提示：
    - 預估日期欄「末」日期以紅色文字顯示
    - 狀態 Chip 旁出現 ⚠️ 圖示，hover 顯示詳細過期日

- **復原機制 (Undo)**
  - Store 層加入 `_history: Task[][]`（環形快照，最多 20 步，不持久化）
  - 以下操作會自動推送快照：`addTask`、`updateTask`、`deleteTask`、`manualAddTimeLog`、`updateTimeLog`、`deleteTimeLog`
  - 刪除任務後底部出現 Snackbar（6 秒），內含「復原」按鈕
  - 導覽列新增全域 Undo 按鈕，有歷史時才啟用

- **日曆 Timeslot 雙擊開啟任務編輯（Double-click to Edit Task）**
  - Dashboard 時間方塊現在支援兩種點擊行為：
    - **單擊**：開啟時間紀錄編輯 Dialog（原有行為不變）
    - **雙擊**：直接開啟該任務的完整 TaskForm 編輯表單
  - 透過 250ms click timer 精確區分單擊與雙擊，兩者互不干擾
  - 修改範圍：`TimeTracker.tsx`（新增 `clickTimerRef`、`handleSlotDoubleClick`、引入 `TaskForm`）

### 問題修正 (Bug Fixes)

- **深色模式：Dashboard 時間軸與日期標頭不可見**
  - 根因：`bgcolor: '#fafafa'`（時間欄）與 `bgcolor: '#f5f5f5'`（日期標頭）在 dark mode 下造成淺背景配白色文字
  - 修正：換為 MUI theme token (`background.paper`, `action.hover`, `rgba(25,118,210,0.18)`)

- **深色模式：工作產出頁面表格欄位文字不可見**
  - 根因：`TableHead` 的 `bgcolor: '#f5f5f5'` 強制淺色背景
  - 修正：改為 `bgcolor: 'action.hover'`

- **深色模式：週報生成頁面統計資訊與 PlantUML 區塊不可見**
  - 根因：`bgcolor: '#f0f7ff'`（統計範圍 Paper）、`bgcolor: '#f8f9fa'`（原始碼區塊）
  - 修正：分別改為 `action.selected`、`action.hover`

- **深色模式：其他全域顏色問題**
  - `TaskForm.tsx`：產出項目卡片 `#fafafa` → `action.hover`
  - `CategoryManager.tsx`：備份區塊 `#fcfcfc` → `background.paper`；警告提示 `#fff3e0` → `warning.dark`
  - `Stats.tsx`：總工時卡片 `#f0f7ff` → `action.selected`
  - `TimeTracker.tsx`：所有格線邊框硬碼色（`#ddd`, `#eee`, `#ccc`）→ `borderColor: 'divider'`

---

## [0.3.0] — 2026-02-12

### 新功能 (Features)

- **週報素材生成頁面 (WeeklyReportPage)**
  - PlantUML WBS 階層圖自動生成
  - PlantUML 甘特圖自動生成（依任務狀態自動著色：完成綠、進行中藍、暫停橘）
  - 複製原始碼 / 開新分頁另存 SVG 按鈕
  - 統計範圍固定為前後各一個月

- **階層篩選 (Hierarchy Level Filter)**
  - 週報頁面支援 Level 1–5 獨立勾選，控制哪些層級的任務顯示於圖表

- **進階分類排除 (Category Blacklist)**
  - 週報頁面可排除特定任務分類或時間分類（預設排除含「會議、討論、行政」關鍵字的分類）

- **任務清單折疊 (Task List Folding)**
  - WBS 任務表中每個父任務節點可獨立展開 / 收合
  - 新增「全部展開」與「全部縮合」快捷按鈕

---

## [0.2.0] — 2026-02-11

### 新功能 (Features)

- **Traditional Chinese UI**：全介面改為繁體中文

- **別名 (Alias Title)**
  - 每個任務可設定最多 10 字的別名
  - 時間軸日曆優先顯示別名

- **標籤 (Labels)**
  - 任務可設定最多 3 個自由標籤
  - 任務列表支援標籤篩選

- **任務重新歸類 (Task Reparenting)**
  - 編輯任務時可變更上層任務（防止循環參照）

- **工作產出追蹤頁面 (OutputReportPage)**
  - 週期區間篩選（前後週切換）
  - 三種聚合模式：按任務 / 按任務分類 / 按時間分類
  - 完成度 (%) 可直接在表格內編輯

- **統計報表 (Stats)**
  - 雙圓餅圖：分別依「任務分類」與「時間分類」統計
  - 日 / 週模式快速導航

---

## [0.1.0] — 2026-02-08

### 初始版本 (Initial Release)

- **任務管理 (Tasks)**
  - CRUD（建立 / 編輯 / 刪除）
  - WBS 5 層父子結構（`parentId` 關聯）
  - 任務狀態：待處理 / 進行中 / 已暫停 / 已完成
  - 預估開始 / 完成日期，實際日期自動計算（來自時間紀錄）
  - 任務分類（mainCategory）與時間分類（subCategory）

- **計時器 (Time Tracking)**
  - 一次只能一個任務進行中，切換時自動停止前一個
  - 手動新增 / 編輯 / 刪除時間紀錄

- **Dashboard（時間軸）**
  - Outlook 式垂直時間軸
  - 日 / 週 5 天 / 週 7 天 三種檢視
  - 顏色依任務分類或時間分類切換
  - 精簡（60px/hr）/ 詳細（120px/hr）縮放
  - Tooltip 顯示任務說明
  - 點擊時間方塊可編輯 / 刪除紀錄

- **系統設定 (Settings)**
  - 任務分類與時間分類 CRUD
  - 分類資料匯入 / 匯出（JSON）
  - 完整資料備份與還原（JSON）

- **資料持久化**
  - 全部存於 `localStorage`（Zustand `persist` 中介層）
  - 無後端依賴
