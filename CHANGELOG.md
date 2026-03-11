# Changelog

本文件依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 格式。

---

## [Unreleased] — 2026-03-11 (d)

### 修正 (Fixes)

- **Timeslot 及統計報表任務下拉選單 WBS 編號錯誤**
  - 原 `computeTaskWbsNumbers` 以線性掃描陣列計算 WBS，假設父任務必在子任務之前；經 reorder（上移/下移）操作後，子任務可能排在父任務前方，導致 WBS 計數器被重置、編號錯亂
  - 改為遞迴建構（`computeTaskWbsMap`）：以 `parentId` 分群，從根任務遞迴編號，同時回傳按階層排序的任務清單
  - 下拉選單 `options` 改用階層排序清單（`sortedTasks`），確保任務順序與 WBS 編號一致
  - 孤兒任務（parent 已封存）接續根任務編號，不再重置為 1
  - 影響範圍：TimeTracker（Timeslot 編輯/快速新增）、Stats（任務節點篩選）

---

## [Unreleased] — 2026-03-11 (c)

### 改善 (Improvements)

- **週報：AsciiDoc 進度表新增狀態顏色標記**
  - 匯出的 AsciiDoc 進度追蹤表中，依狀態套用 `[color]#text#` inline 顏色標記
    - 暫停 → 紅色（含標題欄與狀態欄）
    - 完成 → 綠色
    - 進行中 → 藍色
    - SPI < 1.0（落後 / 嚴重落後）→ SPI 整段文字紅色
  - 修正多行 SPI 文字（含 AsciiDoc 換行 `+`）需逐行套用顏色的問題
  - 將顏色 helper（`adocColor`、`fmtStatusCell`、`fmtSpiCell`、`fmtTitleCell`）提取為元件層級共用函式，同時套用至 `progressWithAsciiDoc`、`progressWithoutAsciiDoc`、`progressAsciiDoc` 三處

---

## [Unreleased] — 2026-03-11 (b)

### 新功能 (Features)

- **週報頁：甘特圖時間刻度與縮放設定**
  - 新增「時間刻度」ToggleButton：每日 / 每週 / 每月（對應 PlantUML `printscale daily/weekly/monthly`）
  - 新增「縮放」調整按鈕（＋ / －），僅允許正整數；各刻度預設值：每日=1、每週=2、每月=4
  - 切換報告類型時自動套用建議設定（半年報 → 每週 zoom 2，其他 → 每日 zoom 1）
  - 選擇半年報時顯示「建議使用每週或每月」提示文字
  - 匯出 AsciiDoc 時 PlantUML 原始碼同步反映所選刻度與縮放值

---

## [Unreleased] — 2026-03-11

### 新功能 (Features)

- **統計報表：任務節點篩選**
  - 統計頁（`/reports`）新增「篩選任務節點」Autocomplete 選擇器
  - 選定任務節點後，圓餅圖與總工時自動縮小為**該節點及所有子孫任務**關連的 timeslot
  - 下拉選單顯示 WBS 編號（`1.2.3`）並依層級縮排，支援文字搜尋
  - 選定時右側顯示提示；清除後恢復全部統計
  - 新增 `getAllDescendantIds`（BFS 廣度優先子樹收集）純函式

- **Timeslot 編輯／新增：關聯任務改為 WBS Autocomplete**
  - 「編輯時間紀錄」與「快速新增時間紀錄」的關聯任務欄位，由 Select 下拉改為 Autocomplete
  - 顯示格式與統計頁相同：WBS 編號（等寬字型）+ 任務名稱，依層級縮排，支援文字搜尋
  - 新增共用工具 `src/utils/wbs.ts`，內含 `computeTaskWbsNumbers`（依 tasks 陣列順序計算 WBS 編號），供 Stats 與 TimeTracker 共用

---

## [Unreleased] — 2026-03-10 (m)

### 新功能 (Features)

- **排程視圖 ICS 匯入/匯出**
  - 新增 `src/utils/ics.ts` 工具模組：`toICSDate`、`fromICSDate`、`timeslotToVEVENT`、`exportTimeslotsToICS`、`unfoldICS`、`parseICS`
  - 支援標準 ICS 格式（RFC 5545）：UTC 時間（`Z` 結尾）、本地時間（無 `Z`）、全天格式（`YYYYMMDD`）、Line folding 還原
  - 自訂欄位：`X-TT-SUBCATEGORY`（匯入時還原時間分類）、`X-TT-TASKID`（識別關聯任務）
  - **單筆匯出**：編輯時間紀錄 Dialog 新增「匯出 .ics」按鈕，下載單筆 timeslot 的 `.ics` 檔案
  - **批次匯出**：工具列新增「批次匯出」按鈕，開啟 Dialog 選擇起迄日期，預覽範圍內筆數，下載含所有 VEVENT 的 `.ics` 檔案
  - **ICS 匯入**：工具列新增「匯入 .ics」按鈕，解析後建立 Timeslot（不自動連結 Task），支援 `X-TT-SUBCATEGORY` 還原時間分類

---

## [Unreleased] — 2026-03-10 (l)

### 新功能 (Features)

- **人員名單管理**
  - 新增 `Member` 型別（`id`、`name`、`isSelf?`），儲存於 Zustand store 並持久化至 localStorage
  - 系統設定新增「人員名單」Section（假日設定之後）
    - 「我的名字」欄位：設定自己名字，新建任務時自動預填為負責人
    - 成員清單：以 Chip 列表呈現，支援新增（Enter 或點擊按鈕）、刪除（Chip × 按鈕）
  - Store 新增 `addMember`、`updateMember`、`deleteMember` actions（isSelf 者不可刪除）

- **TaskForm 負責人/指派人改為 Autocomplete**
  - `assignee`、`reporter` 欄位由純文字 TextField 改為 `freeSolo` Autocomplete
  - 下拉選單顯示人員名單，仍可自由輸入非名單中的名字
  - 新建任務（含子任務）自動預填自己名字至負責人欄位

- **設定備份與還原**
  - 系統設定頁新增「設定備份與還原」Paper（完整備份之後）
  - 匯出設定（JSON）：包含 `mainCategories`、`subCategories`、`outputTypes`、`holidays`、`members`，不含任務與時間紀錄資料
  - 匯入設定：驗證 JSON 含至少一個設定 key，`window.confirm` 確認後呼叫 `importSettings`（不影響 tasks/timeslots）
  - 移除分類管理區塊的「僅匯出分類」與「僅匯入分類」兩個舊按鈕（功能已被設定備份涵蓋）

---

## [Unreleased] — 2026-03-08 (k)

### 新功能 (Features)

- **ENH-011：WorkOutput 快速複製下期（方向 A — TaskForm）**
  - 每筆工作產出的操作列新增「複製為下期」圖示按鈕（📋）
  - 點擊後自動 clone 產出，`effectiveDate` +7 天，完成度歸零，weeklySnapshots 清空
  - 新產出插入原產出正下方，方便連續填寫多期
  - 若原產出有 `effectiveDate`，Tooltip 顯示「複製為下期（MM/DD 起）」；無日期則顯示通用提示

- **ENH-011：WorkOutput 快速新增本期產出（方向 B — 週報進度表）**
  - 有進展/無進展兩張表的**每個任務列**名稱欄右側加入綠色「⊕」按鈕
  - Tooltip 顯示「新增本期產出（MM/DD）」（進度表所用 progressPeriod 的起始日）
  - 點擊開啟小 Dialog，含三個欄位：產出名稱（必填）、產出類型（Select）、完成度（%）
  - 按「新增產出」後直接寫入 store，`effectiveDate` 自動帶入 progressPeriod 起始日
  - 新增後進度表即時反映新產出子列

- **時間分類預設值更新**
  - 改為：固定會議、臨時會議、議題討論、思考規劃、閱讀學習、文件撰寫、程式開發、程式碼審查、Debug/問題排查

---

## [Unreleased] — 2026-03-07 (j)

### 新功能 (Features)

- **`trackCompleteness` 旗標：無完成度追蹤需求的任務**
  - `Task` 型別新增 `trackCompleteness?: boolean`（預設 `true`）
  - **TaskForm**：新增「追蹤完成度 %」核取方塊（預設勾選）
    - 取消勾選後：整體完成度 % 輸入欄隱藏，「完成度歷史快照」區塊（含 Inline 折線圖）一併隱藏
  - **Store**：`updateTask` 在 `trackCompleteness === false` 時跳過自動建立 WeeklySnapshot
  - **週報進度表**：`trackCompleteness === false` 的任務前期%/本期%欄顯示「—」、ΔSprint 及 SPI 欄留空、不顯示趨勢圖按鈕

- **「無進展」判斷邏輯強化**
  - 新增 `hasActivity(task)` 活動偵測：任意 timeslot 與 progressPeriod 有時間交集，或任意週期型產出（有 effectiveDate）落於本期 → 視為有活動
  - **`trackCompleteness === false` 任務**：僅以 `hasActivity` 判斷有無進展（不參考完成度 delta）
  - **一般任務**：完成度 delta ≠ 0 **或** `hasActivity` 任一成立 → 歸入有進展表
  - **DONE 任務**：一律歸入有進展表（不論完成度）
  - PAUSED 仍強制歸入無進展表

---

## [Unreleased] — 2026-03-07 (i)

### 新功能 (Features)

- **完成度趨勢折線圖（Recharts LineChart）**
  - **TaskForm**：展開「完成度歷史快照」區塊後，底部自動顯示 inline 折線圖（高 200px）。任務整體為藍色實線，各工作產出為不同顏色線條，隨快照新增/刪除即時更新。
  - **週報進度表**：任務列名稱欄右側出現 📈 圖示按鈕（僅在有快照時顯示），點擊開啟 Dialog 顯示完整折線圖（高 340px），同樣支援任務 + 產出多條線。
  - X 軸：週次（`MM-DD`）；Y 軸：0–100%；Tooltip hover 顯示百分比；`connectNulls` 連接非連續快照。

- **週報進度表拆分：有進展 / 無進展兩張表**
  - 任務按本期進度拆分：完成度有正/負變動 → 進度追蹤表；完成度無變動或 PAUSED → 本期無進展任務表
  - 無進展表欄位：任務名稱、預期完成日、前期%、本期%、狀態、**原因**
  - PAUSED 任務的「原因」欄顯示 `pauseReason`；無進展非暫停任務原因欄顯示「—」（保留欄位供未來行內編輯）
  - 無進展表同樣支援工作產出子列與趨勢圖按鈕

### 修正 (Bug Fixes)

- **TaskForm：暫停狀態必須填寫暫停原因**
  - 狀態選為 PAUSED 時，「暫停原因」欄位變為必填（`*`）
  - 按「儲存任務」時若原因欄為空，顯示紅色錯誤文字並阻止儲存
  - 使用者開始填寫後錯誤狀態即時清除

---

## [Unreleased] — 2026-03-07 (h)

### 新功能 (Features)

- **ENH-010：雙月盤點 / 半年報差異化內容**
  - **雙月盤點：雙時間軸設計**
    - `ganttPeriod`（計畫展望）：本雙月對（整月邊界），WBS / Gantt 使用此區間，呈現**未來計畫**
    - `progressPeriod`（工作成果）：前一個雙月對，進度表使用此區間，呈現**過去成果**
    - 信息列同時顯示兩個區間，WBS 與進度表區塊各有標題條說明所用區間
  - **半年報：週期修正為 12-5 月 / 6-11 月**
    - 1-5 月錨點 → Dec(year-1) 1 ～ May(year) 31
    - 6-11 月錨點 → Jun(year) 1 ～ Nov(year) 30
    - 12 月錨點 → Dec(year) 1 ～ May(year+1) 31
    - WBS / Gantt / 進度表使用同一半年區間
  - **`progressTasks` 獨立計算**：不再依賴 `activeTasks`（ganttPeriod），從 `progressPeriod` 獨立篩選，確保雙月盤點的進度表正確呈現過去成果
  - **新增「期間工作成果彙總」Section**（雙月 / 半年報 專用，進度表下方）：
    1. **任務狀態統計**：DONE / IN_PROGRESS / PAUSED / CANCELLED / TODO / BACKLOG 各計數
    2. **期間實際工時彙總**：依 timeslot 計算各 mainCategory 工時（小時 + 佔比）
    3. **工作產出清單**：effectiveDate 落在 progressPeriod 內的所有產出（任務、產出名稱、類型、完成度、日期），依 effectiveDate 排序

---

## [Unreleased] — 2026-03-07 (g)

### 修正 (Bug Fixes)

- **週報進度表：設有 effectiveDate 的工作產出在切換期間後消失**
  - **根因**：進度追蹤表的任務來源（`activeTasks`）只依據任務的估計日期與 timeslot 篩選。若任務在目標期間無 timeslot 或估計日期，整個任務列（含其產出）都不會出現，即使某個產出的 `effectiveDate` 恰好落在該期間內。
  - **修正**：新增 `progressTasks` useMemo，在 `activeTasks` 基礎上，額外納入「有 output.effectiveDate 落在 reportPeriod 內」的任務。WBS / Gantt 仍使用原有的 `activeTasks`（行為不變）。
  - 進度追蹤表主表格與 AsciiDoc 輸出均改為使用 `progressTasks`。

---

## [Unreleased] — 2026-03-07 (f)

### 新功能 (Features)

- **ENH-012：WeeklySnapshot 歷史補填 UI**
  - **任務完成度歷史快照**（任務編輯 Dialog，僅編輯模式顯示）
    - 新增可摺疊區塊「完成度歷史快照（N 筆）」，列出所有快照，最新在上
    - 每列顯示週次（weekStart，`yyyy-MM-dd`）+ 可直接修改的完成度 % 輸入欄 + 刪除按鈕
    - 修改與刪除**立即寫入 store**（含 undo 支援），不須等待「儲存任務」
    - 新增快照：DatePicker 選任意日期（自動對齊至該週週日）+ 完成度 % → 按「新增」
    - 同週已有快照時自動覆蓋（upsert 語意）
  - **工作產出完成度快照**（各產出卡片底部）
    - 新增可摺疊區塊「完成度快照（N 筆）」
    - 快照列表可逐筆修改完成度 % 或刪除
    - 新增快照：DatePicker + % → 按 + 按鈕
    - 快照變更為 **local state**，隨「儲存任務」一起寫入（與其他產出欄位一致）
  - Store 新增 `updateTaskSnapshots(id, snapshots)` action（僅更新 weeklySnapshots，不觸發 auto-upsert）

---

## [Unreleased] — 2026-03-07 (e)

### 新功能 (Features)

- **週報頁：報告類型泛化（週報 / 雙月盤點 / 半年報）**
  - 新增「報告類型」切換器（選項面板內）：週報 / 雙月盤點 / 半年報
  - 切換後 `reportPeriod`（當期範圍）和 `prevPeriod`（前一期）自動重算
    - 週報：以週日為起始的 7 天期間
    - 雙月盤點：Jan-Feb / Mar-Apr / May-Jun / Jul-Aug / Sep-Oct / Nov-Dec
    - 半年報：Jan-Jun / Jul-Dec
  - 進度追蹤表導覽列統一控制（`< 前期 / 後期 >`），非當期顯示「目前」快速回跳按鈕
  - 快照查詢升級：
    - `getSnapshotAtOrBefore(snapshots, dateStr)` — 取上一期結束前最近一筆快照
    - `getSnapshotInPeriod(snapshots, startStr, endStr)` — 取本期內最新一筆快照
  - 表格欄位標題隨報告類型動態切換（上週% / 本週% / 週間△ ↔ 前期% / 本期% / 期間△）
  - WBS 與 Gantt 的任務過濾範圍改為跟隨 `reportPeriod`
  - 甘特圖：非週報模式直接使用 `reportPeriod` 為時軸範圍；週模式保留既有 `ganttMode` 切換
  - 頂部資訊欄顯示目前統計範圍與報告類型名稱
  - AsciiDoc 輸出標題與欄位名稱同步反映報告類型

- **工作產出：歸屬期間 (`effectiveDate`)**
  - `WorkOutput` 新增 `effectiveDate?: string`（'yyyy-MM-dd'）
  - TaskForm 工作產出區塊新增「歸屬期間」DatePicker（選填）
    - 週期型產出（如每週會議報告）填入歸屬日期
    - 持續型產出（如長期文件）留空
  - 週報進度追蹤表依 `effectiveDate` 篩選產出：
    - 無 `effectiveDate` → 持續型，永遠顯示
    - `effectiveDate` 在 `reportPeriod` 內 → 顯示
    - `effectiveDate` 不在 `reportPeriod` 內 → 隱藏（避免跨期雜訊）
  - 產出列顯示 `effectiveDate` 標籤（灰色小字），方便辨識歸屬期

---

## [Unreleased] — 2026-03-07 (d)

### 新功能 (Features)

- **進度追蹤表：預期完成日與時程績效指數 (SPI)**
  - 新增「預期完成日」欄（取自 `estimatedEndDate`，格式 `MM/dd`）
  - 新增「時程績效 SPI」欄，自動計算並顯示進度落後狀態
    - SPI = 實際完成度 % ÷ 計畫進度 %（依 estimatedStartDate→estimatedEndDate 線性估算）
    - ≥ 1.0：綠色「正常/超前」；0.8–1.0：橘色「落後」；< 0.8：紅色「嚴重落後」
    - 欄位同時顯示計畫進度 %（例：「計畫進度 87%」）
    - 無 `estimatedEndDate` 時顯示「—」
  - SPI 欄位僅顯示於任務列，工作產出列留空
  - AsciiDoc 輸出同步更新至 7 欄（`[cols="3,1.2,0.8,0.8,1,1.8,1"]`），SPI 以純文字格式輸出

- **任務「顯示於週報進度表」設定 (`showInReport`)**
  - `Task` 新增 `showInReport?: boolean` 欄位（預設 `true`，向下相容）
  - TaskForm 新增「顯示於週報進度表」Checkbox（與 WBS / 甘特圖 Checkbox 並排）
  - 固定會議等不需出現在進度追蹤表的任務，可取消勾選
  - 週報進度追蹤表與 AsciiDoc 輸出均會過濾掉 `showInReport === false` 的任務

---

## [Unreleased] — 2026-03-07 (c)

### 新功能 (Features)

- **週報頁：進度追蹤表**
  - 新增「進度追蹤表」區塊（位於 WBS → 甘特圖之後，頁面最底部）
  - 以週為單位，對比上週 vs 本週的任務完成度與工作產出完成度
  - 週次導覽列：`< 上一週 / 下一週 >` 按鈕 + 非當週時顯示「回到本週」按鈕
  - 表格結構：任務列（粗體 + 分類）+ 縮排的產出子列（含產出類型 Chip）
  - 「本週完成度」欄：有快照時顯示快照值；無快照時 fallback 至當前值並標示 `(目前)`
  - 「週間變化」欄：`↑ +N%`（綠）/ `→ 持平`（灰）/ `↓ -N%`（紅）彩色 Chip
  - **「複製 AsciiDoc」按鈕**：生成標準 AsciiDoc 5 欄表格（`[cols="3,1,1,1,1"]`），可直接貼入週報文件
    - 任務列以 `*粗體*` + 分類顯示，產出列以不斷行空白縮排（`↳`）
    - 完成度值、delta 符號、狀態文字均以純文字呈現，相容所有 AsciiDoc 環境
  - 套用與 WBS/Gantt 相同的「排除任務分類」篩選

---

## [Unreleased] — 2026-03-07 (b)

### 新功能 (Features)

- **週完成度快照（WeeklySnapshot）**
  - 新增 `WeeklySnapshot` 型別：`{ weekStart: string; completeness: number; note?: string }`（`weekStart` 格式為 `yyyy-MM-dd`，週日為起始）
  - `Task` 加入 `weeklySnapshots?: WeeklySnapshot[]` 欄位
  - `WorkOutput` 加入 `weeklySnapshots?: WeeklySnapshot[]` 欄位
  - Store 新增 `upsertSnapshot` 工具函式：同一週內重複更新時以最新值覆蓋（upsert 語意）
  - `updateTask` 在 `completeness` 有變動時，自動對當週進行快照
  - `updateWorkOutput` 在 `completeness` 有變動時，自動對當週進行快照
  - 無需額外 UI 操作，現有的完成度填寫流程自動累積歷史記錄，供後續週報差異計算使用

---

## [Unreleased] — 2026-03-07

### 新功能 (Features)

- **甘特圖模式切換（週報模式 / 工作盤點模式）**
  - 週報頁新增 ToggleButtonGroup，可切換兩種甘特圖顯示區間，預設為「週報模式」
  - **週報模式**：以今日為中心，前後各一個月
  - **工作盤點模式**：每兩個月規劃一次；以當前或最近一個奇數月（1/3/5/7/9/11 月）的 1 日為錨點，往前 15 天、往後 2 個月
  - 模式選擇 UI 旁顯示對應的日期區間供確認

- **假日 / 個人休息日管理**
  - `Task` Store 新增 `holidays: string[]` 狀態（`yyyy-MM-dd` 格式），提供 `addHoliday` / `deleteHoliday` action
  - 系統設定頁（CategoryManager）新增「假日 / 個人休息日」管理區塊：日期選擇器 + 新增按鈕 + 列表與刪除
  - 完整備份（匯出 / 還原）同步支援 `holidays` 欄位
  - 甘特圖：區間內的假日以 `lightblue` 標示（與週六日相同）

### 問題修正 (Bug Fixes)

- **甘特圖 DONE 任務無 timeslot 時不顯示**
  - 根因：`DONE` / `CANCELLED` 任務若無任何 timeslot，`actualStart` / `actualEnd` 均為 `undefined`，導致甘特列被略過不渲染
  - 修正：當 `DONE` / `CANCELLED` 任務缺少 actual 日期時，改 fallback 至 `estimatedStartDate` / `estimatedEndDate`，確保任務仍可在甘特圖上顯示
  - 同樣邏輯適用於 `IN_PROGRESS` / `PAUSED` 任務（actual start 有值但 actual end 尚未確定時，fallback 至估計結束日）

- **甘特圖今日標記被週末/假日顏色覆蓋**
  - 根因：PlantUML Gantt 中同一天的顏色以「最先宣告者」為準；今日標記原位於週末/假日規則之後，導致顏色被蓋掉
  - 修正：將今日標記行移到 `Project starts` 之後、週六日規則之前，確保今日橘色永遠優先顯示

### UX / 調整

- **甘特圖配色更新**
  - `IN_PROGRESS` 任務顏色：`DodgerBlue` → `deepskyblue`（更醒目）
  - 週六與週日統一標示為 `lightblue`（原本均無特別標示）

- **週報頁 WBS 區間 vs 甘特圖區間分離**
  - WBS 活躍任務篩選繼續使用固定的「今日前後各一個月」範圍
  - 甘特圖改依 `ganttMode` 選擇的 `ganttRange` 獨立計算

- **工作產出追蹤頁週起始統一為週日**
  - `OutputReportPage` 的「前一週 / 後一週」按鈕、日期區間預設值改用 `weekStartsOn: 0`（週日），與統計報表頁一致

---

## [Unreleased] — 2026-03-06 (c)

### 新功能 (Features)

- **任務排序操作（TaskList）**
  - 每列任務操作欄新增 4 個排序按鈕（帶 Tooltip）：
    - `↑` 向上：與上一個同層任務互換順序
    - `↓` 向下：與下一個同層任務互換順序
    - `←` 向前：提升層級（脫離父任務，成為父任務的同層）
    - `→` 向後：降低層級（成為上一個同層任務的子任務）
  - 不可用時自動 disable（已是第一個、已是根層、無上一同層任務等）
  - Store 新增 `reorderTask(id, direction)` action，支援 undo

- **WBS / 甘特圖顯示設定拆分**
  - `Task` 型別原有 `showInGantt` 拆為 `showInWbs` 與 `showInGantt` 兩個獨立欄位
  - TaskForm 改為兩個並排勾選框：「顯示於 WBS」與「顯示於甘特圖」
  - WeeklyReportPage：WBS 圖依 `showInWbs` 篩選；甘特圖依 `showInGantt` 篩選
  - 日期必填驗證維持僅綁定「顯示於甘特圖」

### 問題修正 / UX 調整

- **WBS 圖顯示修正**
  - 移除 `skinparam monochrome true`，節點顏色可正常顯示
  - 節點顏色改用 PlantUML 顏色名稱（`#lightblue`、`#pink` 等），取代 hex 色碼以確保渲染相容性

---

## [Unreleased] — 2026-03-06 (b)

### 新功能 (Features)

- **WBS 節點依任務狀態自動著色**
  - BACKLOG / TODO → `#lightblue`（淺藍）
  - IN_PROGRESS → 無色（預設白色）
  - PAUSED → `#pink`（粉紅）
  - DONE → `#lightgreen`（淺綠）
  - CANCELLED → `#yellow`（黃色）
  - 語法採用 PlantUML 顏色名稱（如 `***[#lightblue] 任務名稱`），不使用 hex 色碼以確保渲染相容性；有顏色時色碼緊貼星號，無色（進行中）則省略色碼區塊

- **任務暫停原因（Pause Reason）欄位**
  - `Task` 型別新增 `pauseReason?: string`
  - TaskForm 中，當狀態切換為「已暫停 (Paused)」時動態顯示多行文字欄位「暫停原因」
  - 儲存時寫入 `task.pauseReason`；切換為其他狀態時自動清除該欄位

### UX / 調整

- **WBS 區塊標題**：`WBS 階層圖 (生產性產出)` → `WBS 階層圖`（移除括號說明文字）
- **甘特圖今日標記**：顏色由 `LightCyan`（淡藍）改為 `Orange`（橘色），Switch 說明文字同步更新

---

## [Unreleased] — 2026-03-06

### UX / 更名

- **應用程式更名為 WorkScope Planner**
  - AppBar 標題、瀏覽器分頁標題（`index.html`）均由 `Task Time Tracker` 改為 `WorkScope Planner`
  - 反映應用核心已從「時間計時」轉向「任務規劃 + 工作產出連動」

- **「儀表板」更名為「排程視圖」**
  - 導覽列按鈕文字：`儀表板` → `排程視圖`
  - 排程視圖頁面標題：`Dashboard` → `排程視圖`

- **導覽列順序調整**
  - 新順序：任務管理 / 工作產出 / 排程視圖 / 統計報表 / 週報生成 / 封存庫 / 系統設定
  - 將核心工作流程（任務管理、工作產出）置前，時間輔助功能（排程視圖、統計）置後

---

## [Unreleased] — 2026-03-05

### 新功能 (Features)

- **工作產出類型管理（OutputType）**
  - 新增 `OutputType { id, name, isTangible }` 實體，預設提供五種類型：實體產出（有形）、決策、知識/研究、流程/規範、其他（後四者為無形）
  - `WorkOutput` 新增 `outputTypeId?`（關聯類型）與 `summary?`（無形產出摘要）欄位
  - **TaskForm 工作產出編輯器** 重新設計：
    - 第一列：名稱、類型下拉選單、完成度、刪除按鈕
    - 第二列（依類型切換）：有形產出 → 連結輸入欄；無形產出 → 摘要多行文字欄
  - **工作產出追蹤頁面（OutputReportPage）**：以 Chip 顯示產出類型（有形藍色、無形紫色）；無形產出顯示摘要文字，有形產出顯示可點擊連結
  - **系統設定頁（CategoryManager）** 新增「工作產出類型」區塊：可新增、編輯（名稱 + 有形/無形）、刪除
  - Store 新增 `outputTypes` 狀態與 `addOutputType`、`updateOutputType`、`deleteOutputType` 三個 action
  - `importFullData` 支援匯入 `outputTypes`（無此欄位時以預設值填補），`handleFullExport` 同時匯出 `outputTypes`
  - 修改範圍：`types/index.ts`、`useTaskStore.ts`、`TaskForm.tsx`、`CategoryManager.tsx`、`OutputReportPage.tsx`

---

## [Unreleased] — 2026-03-04 (b)

### 新功能 (Features)

- **甘特圖今日標記開關**
  - 週報頁篩選面板新增「甘特圖選項」區塊
  - Switch 開關「顯示今日標記」（預設開啟）
  - 啟用時在 PlantUML Gantt 原始碼末尾插入 `YYYY-MM-DD is colored in LightCyan`，將今日欄位以淡藍色 highlight
  - 關閉時省略該行，輸出乾淨無標記的甘特圖

---

## [Unreleased] — 2026-03-04

### 新功能 (Features)

- **Timeslot 獨立說明（note）欄位**
  - `Timeslot.note` 欄位已存在，現在在 UI 完整開放讀寫：
    - **快速新增 Dialog**：新增「說明（可選）」多行文字欄位
    - **編輯時間紀錄 Dialog**：新增「說明（此 timeslot 的備註）」多行文字欄位
  - Dashboard 時間方塊 **Tooltip 改為顯示 timeslot 自己的 note**（原本顯示任務詳細說明），空白時顯示「（無說明）」
  - 解決同一任務下不同 timeslot 記錄不同工作內容的需求

- **TaskForm 甘特圖必填日期驗證**
  - 當「顯示於週報與甘特圖」勾選時，**預估開始日期**與**預估完成日期**強制為必填
  - 欄位標題加上「\*」提示；若未填即儲存，欄位顯示紅框與錯誤提示文字「顯示於甘特圖時為必填」
  - 填入日期後錯誤狀態自動清除

---

## [Unreleased] — 2026-03-03 (b)

### 新功能 (Features)

- **任務狀態擴充：BACKLOG / CANCELLED**
  - `TaskStatus` 新增 `BACKLOG`（待規劃，屬 todo 類別）與 `CANCELLED`（已取消，屬 done 類別）
  - `CANCELLED` 任務與 `DONE` 一樣可透過封存按鈕移至封存庫；「封存所有已完成」按鈕同時封存 `CANCELLED` 任務
  - 狀態 Chip 顏色：`BACKLOG` → default；`CANCELLED` → error（紅色）
  - `isOverdue` 判斷：`CANCELLED` 與 `DONE` 同視為「已結束」，不標記為逾期
  - WeeklyReport Gantt：`CANCELLED` 任務以灰色（Silver）呈現；`DONE`/`CANCELLED` 預設完成度 100%

- **任務整體完成度 (Task Completeness)**
  - `Task` 型別新增 `completeness?: number`（0–100）
  - TaskForm 新增「整體完成度 (%)」輸入欄位（步進 5）
  - TaskList 狀態欄旁以 caption 顯示完成度（若已設定）
  - WeeklyReport Gantt：優先使用 `task.completeness`，未設定時依狀態預設（DONE/CANCELLED → 100%，其他 → 0%）

### 問題修正 / UX 調整

- **Dashboard 快速新增 Timeslot 預設結束時間**：由 +1 小時改為 +30 分鐘

- **TaskForm 版面調整**
  - 「預估開始日期」與「預估完成日期」並排於同一列
  - 「任務負責人」與「任務指派人」並排於同一列
  - 「任務狀態」移至「任務分類」右側同列

---

## [Unreleased] — 2026-03-03

### 架構重構 (Refactoring)

- **Timeslot 抽離為頂層獨立實體**
  - `Timeslot` 介面新增為頂層型別，`subCategory` 從 `Task` 移至 `Timeslot`
  - `Task` 移除 `timeLogs`、`totalTimeSpent`、`subCategory` 三個欄位
  - Store 新增 `timeslots: Timeslot[]` 狀態，並加入 `addTimeslot`、`updateTimeslot`、`deleteTimeslot`、`getTaskTotalTime` 四個 action
  - 移除 `startTimer`、`stopTimer`、`manualAddTimeLog`、`updateTimeLog`、`deleteTimeLog` 等 timer 相關 action
  - `updateSubCategory` 改為更新 `timeslots[].subCategory`（而非 `tasks[].subCategory`）
  - `_history` 型別由 `Task[][]` 改為 `{ tasks; timeslots }[]`，undo 同時還原兩者
  - `persist` partialize 新增 `timeslots` 欄位
  - 支援建立「無連結任務」的 timeslot，統計中以「未分類」呈現
  - Dashboard 快速新增 timeslot：任務改為**可選**，新增 subCategory 下拉選單
  - 編輯時間紀錄 Dialog：新增 subCategory 與關聯任務選單（可重新指定或解除）
  - TaskList：累計工時改從 timeslots 計算，移除播放/暫停計時按鈕，移除 subCategory 篩選
  - TaskForm：移除 subCategory 欄位
  - Stats、WeeklyReportPage、OutputReportPage、ArchivePage 全部改從 timeslots 計算
  - 週報頁移除「排除時間分類」篩選 UI（任務不再有 subCategory）
  - 新增遷移腳本 `scripts/migrate-to-independent-timeslots.html`（瀏覽器端 localStorage 資料遷移工具）
  - 修改範圍：`types/index.ts`、`useTaskStore.ts`、`TimeTracker.tsx`、`TaskList.tsx`、`TaskForm.tsx`、`Stats.tsx`、`WeeklyReportPage.tsx`、`OutputReportPage.tsx`、`ArchivePage.tsx`

---

## [Unreleased] — 2026-02-26

### 新功能 (Features)

- **任務封存庫（Archive）**
  - `Task` 型別新增 `archived?: boolean`、`archivedAt?: number` 欄位
  - **封存操作**：已完成任務行出現「封存」按鈕，封存後帶 6 秒 Undo Snackbar
  - **批次封存**：工具列新增「封存所有已完成」按鈕（一鍵封存全部 DONE 任務及其後代）
  - **封存庫橫幅**：任務管理頁有封存任務時顯示數量提示與「前往封存庫」連結
  - **封存庫頁面**（`/archive`）：搜尋、分類篩選、依封存時間排序、顯示父任務脈絡、還原（帶 Undo）、永久刪除（含確認 Dialog）
  - 導覽列新增「封存庫」入口
  - Store 新增 `archiveTask`、`unarchiveTask`、`archiveAllDone` 三個 action
  - 封存任務 timeLogs 仍計入統計報表，資料完整保留
  - 修改範圍：`types/index.ts`、`useTaskStore.ts`、`TaskList.tsx`、`Layout.tsx`、`App.tsx`、新增 `ArchivePage.tsx`

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

- **日曆空白格點擊快速新增時間紀錄（Quick Add Time Log）**
  - 點擊 Dashboard 任意空白時間格，彈出「新增時間紀錄」Dialog
  - 自動預填日期與開始時間（依點擊位置計算，對齊至 15 分鐘），結束時間預設 +1 小時
  - 下拉選擇現有任務，或點選「建立新任務」按鈕開啟 TaskForm
  - 空白格 hover 顯示淡背景 + `cell` cursor，提示可點擊
  - Timeslot block 點擊加入 `stopPropagation`，避免誤觸空白格邏輯
  - 修改範圍：`TimeTracker.tsx`（新增 `quickAdd*` 狀態、`handleHourCellClick`、`handleQuickAddSave`、快速新增 Dialog）

- **日曆 Timeslot 雙擊開啟任務編輯（Double-click to Edit Task）**
  - Dashboard 時間方塊現在支援兩種點擊行為：
    - **單擊**：開啟時間紀錄編輯 Dialog（原有行為不變）
    - **雙擊**：直接開啟該任務的完整 TaskForm 編輯表單
  - 透過 250ms click timer 精確區分單擊與雙擊，兩者互不干擾
  - 修改範圍：`TimeTracker.tsx`（新增 `clickTimerRef`、`handleSlotDoubleClick`、引入 `TaskForm`）

### 問題修正 (Bug Fixes)

- **Dashboard 日期標頭捲動時消失**
  - 根因：日期標頭使用 `position: sticky; top: 0`，在 nested flex container 中瀏覽器實作不穩定，捲動後標頭隨內容滾出畫面
  - 修正：將日期標頭列移出 scroll 容器，改為 Paper 上方獨立固定列（`flexShrink: 0`），捲動時永遠保持可見
  - 同時移除 slot top offset 與現在時間紅線的 `HEADER_HEIGHT` 偏移（因 header 已在 scroll 區域外）
  - 精簡（60px/hr）與詳細（120px/hr）模式均已修正

- **Dashboard 時間範圍擴展為完整 24hr**
  - `START_HOUR` 從 7 改為 0，`END_HOUR` 從 22 改為 23，顯示 00:00–23:00
  - 預設捲動位置維持 7:00（有 timeslot 時捲到最早紀錄前一小時）

- **Quick Add timeslot：點「建立新任務」後時間資訊消失**
  - 根因：「建立新任務」按鈕直接關閉 Quick Add Dialog，TaskForm 關閉後不會重新開啟
  - 修正：以 `pendingQuickAdd` ref 記錄流程，TaskForm 關閉後自動重開 Quick Add Dialog，並透過 `useTaskStore.getState()` 即時偵測新建任務，自動預選至下拉選單

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
