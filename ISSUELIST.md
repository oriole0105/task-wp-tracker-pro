# Issue List

紀錄已知問題、功能缺陷與改善需求的追蹤清單。

狀態說明：
- ✅ **已解決** — 問題已修正並驗證
- 🔧 **進行中** — 正在修復中
- 📋 **待處理** — 確認問題，尚未開始
- 💡 **建議** — 功能改善建議，非緊急

---

## 已解決 (Resolved)

### BUG-001 — 深色模式：Dashboard 時間軸不可見
- **狀態**：✅ 已解決（2026-02-24）
- **嚴重度**：高
- **描述**：切換深色模式後，Dashboard 左側時間欄（07:00–22:00）與上方日期標頭文字消失，無法辨識目前時間位置。
- **根因**：`TimeTracker.tsx` 中時間欄使用 `bgcolor: '#fafafa'`、日期標頭使用 `bgcolor: '#f5f5f5'`，在 dark mode 下形成淺色背景加白色文字的組合。
- **修正**：
  - 時間欄背景改為 `background.paper`
  - 非今日標頭改為 `action.hover`
  - 今日標頭改為 `rgba(25,118,210,0.18)`（透明藍，兩個模式均可見）
  - 所有格線邊框（`#ddd`/`#eee`/`#ccc`）改為 `borderColor: 'divider'`

---

### BUG-002 — 深色模式：工作產出頁面表格欄位文字不可見
- **狀態**：✅ 已解決（2026-02-24）
- **嚴重度**：高
- **描述**：切換深色模式後，「工作產出追蹤」頁面的表格欄位標題（任務名稱、累計工時、工作產出名稱、完成度）消失不可見。
- **根因**：`OutputReportPage.tsx` 的 `TableHead` 使用 `bgcolor: '#f5f5f5'`，強制淺色背景，dark mode 文字色為白色導致不可見。
- **修正**：改為 `bgcolor: 'action.hover'`（自動適應主題）

---

### BUG-003 — 深色模式：週報生成頁面內容不可見
- **狀態**：✅ 已解決（2026-02-24）
- **嚴重度**：高
- **描述**：切換深色模式後，「週報素材生成」頁面出現兩個問題：
  1. 頂部「統計範圍」資訊區塊文字消失
  2. WBS 與甘特圖兩個區塊的 PlantUML 原始碼框內文字消失
- **根因**：
  - 統計範圍 Paper：`bgcolor: '#f0f7ff'`（淺藍色）
  - 原始碼框：`bgcolor: '#f8f9fa'`（近白色）
- **修正**：
  - 統計範圍 Paper → `action.selected`
  - 原始碼框 → `action.hover`
  - 篩選區框線 → `border: '1px dashed', borderColor: 'divider'`
  - 圖片容器框線 → `borderColor: 'divider'`，背景 → `background.paper`

---

### BUG-004 — 深色模式：其他頁面零星顏色問題
- **狀態**：✅ 已解決（2026-02-24）
- **嚴重度**：中
- **描述**：深色模式下，多個元件仍有硬碼淺色背景：
  - 統計報表：總工時卡片（`#f0f7ff`）背景與文字衝突
  - 任務表單：「工作產出」卡片（`#fafafa`）
  - 系統設定：備份區塊（`#fcfcfc`）、警告提示（`#fff3e0`）
- **修正**：統一替換為 MUI theme token（`action.selected`、`action.hover`、`background.paper`、`warning.dark`）

---

### BUG-005 — 刪除任務無確認機制，子任務連帶刪除無警示
- **狀態**：✅ 已解決（2026-02-24）
- **嚴重度**：中
- **描述**：點擊任務列表的刪除按鈕，任務（包含所有子任務）立即刪除，無確認步驟，無法復原。
- **修正**：
  - 加入確認 Dialog，顯示任務名稱
  - 若有子任務，額外顯示紅色警告文字
  - 搭配 Undo 機制，刪除後 6 秒內可透過 Snackbar 復原

---

### BUG-006 — Dashboard 日期標頭捲動時消失
- **狀態**：✅ 已解決（2026-02-26）
- **嚴重度**：高
- **描述**：Dashboard 在精簡與詳細兩種模式下，捲動 Y 軸 scrollbar 時，上方日期標頭（週一、週二...等）會隨內容滾出畫面消失。
- **根因**：日期標頭設定 `position: sticky; top: 0`，但在 nested flex container（scroll container → dates container → date column → header）中，瀏覽器（特別是 webkit）無法正確識別捲動祖先，導致 sticky 失效。
- **修正**：將日期標頭列移出 scroll 容器，改為 Paper 上方獨立固定 flex row（`flexShrink: 0`），與 scroll 容器並列於 column 方向；同步移除 slot top offset 與現在時間紅線的 `HEADER_HEIGHT` 偏移。

---

### BUG-007 — Quick Add Timeslot：點「建立新任務」後時間資訊消失
- **狀態**：✅ 已解決（2026-02-26）
- **嚴重度**：中
- **描述**：在 Dashboard 空白格點擊開啟「新增時間紀錄」Dialog 後，若點「建立新任務」按鈕，Quick Add Dialog 關閉且預填的日期/時間資訊遺失；TaskForm 關閉後無法繼續完成時間紀錄新增。
- **根因**：「建立新任務」按鈕直接呼叫 `setQuickAddOpen(false)`，TaskForm 的 `onClose` 只還原 TaskForm 狀態，不重新開啟 Quick Add。
- **修正**：新增 `pendingQuickAdd` ref 與 `prevTaskIdsRef` 追蹤流程；TaskForm 關閉時若 `pendingQuickAdd` 為 true，使用 `useTaskStore.getState()` 取得最新任務陣列，偵測新建任務並自動預選，再重新開啟 Quick Add Dialog。

---

## 已解決 (Resolved - Features)

### ENH-009 — 任務封存機制（Archive）
- **狀態**：✅ 已解決（2026-02-26）
- **優先度**：高
- **描述**：已完成任務累積後主列表過長，加入封存機制讓使用者保留歷史資料的同時，主列表只顯示活動任務。
- **實作**：`archived` flag + 封存庫頁面（`/archive`）+ 批次封存按鈕 + 封存庫橫幅

---

## 待處理 / 建議 (Open / Suggestions)

### ENH-002 — 在日曆空白處點擊建立時間紀錄
- **狀態**：✅ 已解決（2026-02-26）
- **優先度**：中
- **描述**：點擊 Dashboard 空白時間格，彈出快速新增 Dialog，自動預填時間並選擇任務後直接建立手動時間紀錄。
- **影響範圍**：`TimeTracker.tsx`

---

### ENH-003 — 估計工時欄位（計畫 vs 實際對比）
- **狀態**：❌ 取消（2026-03-17）
- **原因**：逐任務管理估計工時成本太高，對使用者造成不必要的管理負擔

---

### ENH-006 — CSV 匯出
- **狀態**：✅ 已解決（2026-03-17）
- **優先度**：低
- **描述**：將任務清單匯出為 CSV 格式，可開啟 Excel/Numbers 做進一步統計分析。
- **欄位**：WBS 編號、任務名稱、別名、狀態、主分類、完成度(%)、負責人、預估開始、預估結束、實際開始、實際結束、說明
- **影響範圍**：`CategoryManager.tsx`（系統資料備份與還原區塊新增「匯出任務清單 CSV」按鈕）

---

### ENH-007 — Markdown 格式週報生成
- **狀態**：❌ 取消（2026-03-15）
- **原因**：已有 AsciiDoc 格式報告，無需額外 Markdown 格式

---

### ENH-008 — 任務完成率統計
- **狀態**：✅ 已解決（2026-03-16）
- **優先度**：低
- **描述**：在統計報表中顯示 `DONE / 有效任務` 的完成率百分比，含環形圖、摘要卡片、進度條。
- **影響範圍**：`Stats.tsx`

---

### TECH-001 — chunk 過大警告
- **狀態**：✅ 已解決（2026-03-18）
- **優先度**：低
- **描述**：`vite.config.ts` 加入 `manualChunks`，將單一 1,789 KB chunk 拆為 10 個（最大 367 KB），消除 build 警告並改善瀏覽器快取效益。
- **分割策略**：vendor-react / vendor-mui / vendor-mui-icons / vendor-mui-pickers / vendor-charts / vendor-plantuml / vendor-markdown / vendor-misc

---

### ENH-010 — 雙月盤點 / 半年報差異化內容區塊
- **狀態**：✅ 已解決（2026-03-07）
- **優先度**：中
- **描述**：目前雙月盤點與半年報使用與週報相同的 WBS + Gantt + 進度表結構，尚無針對這兩種報告類型的專屬區塊。建議新增：
  - **期間任務統計**：DONE / CANCELLED / IN_PROGRESS 任務數量彙總
  - **期間實際工時彙總**：依 timeslot 計算各 mainCategory 工時（可複用 Stats 邏輯）
  - **完成的工作產出清單**：`effectiveDate` 落在該期間內的所有已完成產出
- **影響範圍**：`WeeklyReportPage.tsx`（依 `reportType` 條件渲染額外區塊）

---

### ENH-011 — WorkOutput effectiveDate 批次快速建立
- **狀態**：✅ 已解決（2026-03-08）
- **優先度**：低
- **描述**：週期型任務（如每週固定會議）需為每一期建立一筆 WorkOutput 並設定 `effectiveDate`，目前只能在 TaskForm 內逐一新增，操作繁瑣。建議提供批次建立入口：
  - 「為本期新增一筆產出」快速按鈕（自動預填 `effectiveDate` 為 reportPeriod 的起始日）
  - 或在 TaskForm 的工作產出區塊顯示「複製上週」按鈕，自動 clone 並更新 effectiveDate
- **實作**：
  - **方向 A（TaskForm）**：每筆 WorkOutput 新增「複製為下期」圖示按鈕（📋）；自動 clone 並將 effectiveDate +7 天，完成度歸零，插入於原產出之後；Tooltip 顯示下期日期。
  - **方向 B（週報進度表）**：有進展/無進展兩張表的任務列各加綠色「⊕」按鈕；點擊開啟小 Dialog，填寫產出名稱、類型、完成度後按「新增產出」；effectiveDate 自動設為 progressPeriod 起始日。
- **影響範圍**：`TaskForm.tsx`、`WeeklyReportPage.tsx`

---

### ENH-012 — WeeklySnapshot 歷史補填 UI
- **狀態**：✅ 已解決（2026-03-07）
- **優先度**：低
- **描述**：目前快照（`weeklySnapshots`）僅在使用者修改完成度時自動建立當週記錄，無法補填或修改過去某週的快照。若使用者忘記更新或需修正歷史進度，進度追蹤表前期欄位將顯示「—」。建議新增：
  - TaskForm 任務完成度欄旁加入「歷史快照」展開區塊，列出各週快照並允許修改
  - 或在週報進度追蹤表中，點擊「上期%」欄位可直接編輯補填該任務的快照值
- **影響範圍**：`TaskForm.tsx`（任務編輯 Dialog）或 `WeeklyReportPage.tsx`（表格行內編輯）

---

### ENH-013 — 人員名單管理 + 設定備份
- **狀態**：✅ 已解決（2026-03-10）
- **優先度**：中
- **描述**：
  - Task 的 assignee/reporter 為純文字，無法從固定名單選取
  - 缺少「只備份設定（不含任務資料）」的功能
- **實作**：
  - 新增 `Member` 型別，store 新增 `members` 狀態與 CRUD actions
  - 系統設定新增「人員名單」Section：設定自己名字（預填負責人用）、管理成員 Chip 清單
  - TaskForm 的 assignee/reporter 改為 `freeSolo` Autocomplete，新建任務自動預填自己名字
  - 系統設定新增「設定備份與還原」：匯出/匯入 mainCategories、subCategories、outputTypes、holidays、members（不含 tasks/timeslots）
  - 移除分類管理區的「僅匯出/匯入分類」舊按鈕
- **影響範圍**：`types/index.ts`、`store/useTaskStore.ts`、`CategoryManager.tsx`、`TaskForm.tsx`

---

### ENH-014 — 排程視圖 ICS 匯入/匯出
- **狀態**：✅ 已解決（2026-03-10）
- **優先度**：中
- **描述**：排程視圖缺少與外部行事曆（Google Calendar、Apple Calendar、Outlook）相容的 .ics 格式支援
- **實作**：
  - 新增 `src/utils/ics.ts`：`toICSDate`/`fromICSDate` 日期轉換、`timeslotToVEVENT` VEVENT 生成、`exportTimeslotsToICS` 下載觸發、`unfoldICS` Line folding 還原、`parseICS` 解析
  - 單筆匯出：編輯時間紀錄 Dialog 新增「匯出 .ics」按鈕
  - 批次匯出：工具列新增「批次匯出」按鈕，選起迄日期後下載含多個 VEVENT 的 .ics
  - ICS 匯入：工具列新增「匯入 .ics」按鈕，解析後批次建立 Timeslot（不連結 Task）
- **影響範圍**：`src/utils/ics.ts`（新增）、`src/components/TimeTracker.tsx`

---

### ENH-015 — 任務里程碑 (Milestones)
- **狀態**：✅ 已解決（2026-03-14）
- **優先度**：中
- **描述**：每個任務可設定多個里程碑，支援在甘特圖中顯示
- **實作**：
  - `src/types/index.ts`：新增 `Milestone` interface（id/title/date/showInGantt/color?/note?）；`Task` 加入 `milestones?: Milestone[]`
  - `src/components/TaskForm.tsx`：新增「里程碑」section，支援新增/編輯/刪除，含日期選擇器、8 色選單、顯示於甘特圖勾選框
  - `src/pages/WeeklyReportPage.tsx`：`ganttSource` 渲染 `[title] happens date` 及顏色標記，過濾 `showInGantt=true` 且在 `ganttRange` 內的里程碑
  - `src/store/useTaskStore.ts`：`duplicateTask` 加入 `milestones: []`

### ENH-016 — 手機底部導航列（響應式導航）
- **狀態**：✅ 已解決（2026-03-15）
- **優先度**：高
- **描述**：螢幕 < 600px 時切換為底部導航列 + 精簡頂部列 + FAB 快速新增按鈕
- **實作**：
  - `src/components/MobileBottomNav.tsx`：新建元件，BottomNavigation + FAB + Drawer
  - `src/components/Layout.tsx`：useMediaQuery 條件渲染桌面/手機版導航
  - `src/store/useTaskStore.ts`：新增 `quickAddAction` 供跨頁面觸發表單
  - `src/components/TimeTracker.tsx`、`src/components/TaskList.tsx`：監聽 quickAddAction

### ENH-017 — 跨裝置資料同步（智慧合併）
- **狀態**：✅ 已解決（2026-03-15）
- **優先度**：高
- **描述**：手機端差異匯出 + 電腦端智慧合併匯入，支援 Task/Timeslot 的 createdAt/updatedAt 時間戳比對
- **實作**：
  - `src/types/index.ts`：Task、Timeslot、WorkOutput 新增 `createdAt`/`updatedAt`
  - `src/store/useTaskStore.ts`：所有 add/update 動作自動填入時間戳；新增 `mergeImport` 合併邏輯
  - `src/components/CategoryManager.tsx`：新增「跨裝置資料同步」UI 區塊（差異匯出 + 合併匯入）

---

## 統計

| 類別 | 數量 |
|---|---|
| ✅ 已解決 BUG | 7 |
| ✅ 已解決功能 | 11 |
| 📋 待處理功能 | 0 |
| 💡 建議功能 | 0 |
| 📋 技術債 | 0 |
| **合計** | **18** |
