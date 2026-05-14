# WorkScope Planner — MCP 指令使用手冊

> 版本 2.1.0 · 透過 AI 對話（Claude Desktop / Claude Code）操控任務系統

## 前置條件

1. **Server 在線**（在專案根目錄執行）：
   ```bash
   npm run dev
   ```
2. **MCP 已註冊**（一次性設定）：
   ```bash
   npm -w packages/mcp run print-config
   # 將輸出的 JSON 貼入 Claude Desktop 的 claude_desktop_config.json
   ```

---

# Part 1 — 速查表

## 任務管理

| 指令 | 用途 | 主要參數（* = 必填） |
|---|---|---|
| `task_list` | 列出任務清單（附 WBS 編號） | `archived`, `parentId` |
| `task_search` | 依關鍵字搜尋任務標題 | `q`* |
| `task_find_by_wbs` | 依 WBS 編號查找任務 | `wbs`* |
| `task_get` | 取得單一任務完整資料 | `id`* |
| `task_get_subtasks` | 取得直接子任務 | `id`* |
| `task_get_total_time` | 取得任務含子孫的累計工時 | `id`* |
| `task_create` | 建立新任務 | `title`* · `description` · `mainCategory` · `status` · `parentId` · `estimatedStartDate` · `estimatedEndDate` · `completeness` |
| `task_update` | 更新任務欄位 | `id`* · `title` · `status` · `completeness` · `pauseReason` · 日期等 |
| `task_delete` | 刪除任務（含所有子任務） | `id`* |
| `task_archive` | 封存任務 | `id`* |
| `task_unarchive` | 取消封存 | `id`* |
| `task_archive_all_done` | 批次封存所有已完成任務 | — |
| `task_batch_import` | 批次匯入任務（支援巢狀） | `tasks`* · `parentId` |
| `task_duplicate` | 複製任務 | `id`* |
| `task_reorder` | 調整任務位置或層級 | `id`* · `direction`* |
| `task_update_snapshot` | 新增／更新週進度快照 | `id`* · `weekStart`* · `completeness`* · `note` |

## 里程碑

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `task_milestone_list` | 列出任務里程碑 | `id`* |
| `task_milestone_upsert` | 新增或更新里程碑 | `taskId`* · `title`* · `date`* · `milestoneId` · `showInGantt` · `color` · `note` |
| `task_milestone_delete` | 刪除里程碑 | `taskId`* · `milestoneId`* |

## 工作產出

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `output_type_list` | 列出所有產出類型（取得 outputTypeId） | — |
| `task_output_list` | 列出任務的工作產出 | `taskId`* |
| `task_output_add` | 新增工作產出 | `taskId`* · `name`* · `outputTypeId` · `completeness` · `effectiveDate` · `link` · `summary` |
| `task_output_update` | 更新工作產出欄位 | `taskId`* · `outputId`* · 其餘選填 |
| `task_output_delete` | 刪除工作產出 | `taskId`* · `outputId`* |

## 時間紀錄

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `timeslot_list` | 列出時間紀錄 | `taskId` · `from` · `to` |
| `timeslot_clock_in` | 開始計時（startTime = 現在） | `taskId` · `subCategory` · `note` |
| `timeslot_clock_out` | 結束計時（endTime = 現在） | `taskId` |
| `timeslot_create` | 手動新增時間紀錄 | `startTime`* · `taskId` · `endTime` · `subCategory` · `note` |
| `timeslot_update` | 更新時間紀錄 | `id`* · `startTime` · `endTime` · `taskId` · `subCategory` · `note` |
| `timeslot_delete` | 刪除時間紀錄 | `id`* |

## 待辦事項

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `todo_list` | 列出所有待辦 | — |
| `todo_create` | 建立待辦事項 | `description`* |
| `todo_toggle` | 切換完成狀態 | `id`* |
| `todo_update` | 更新內容或日期 | `id`* · `description` · `startDate` · `doneDate` |
| `todo_delete` | 刪除待辦 | `id`* |
| `todo_clear_done` | 清除所有已完成待辦 | — |

## 報告

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `report_weekly` | 產生週報（adoc / json） | `anchorDate` · `format` · `levels` · `excluded` · `showTodayMark` · `groupByCategory` |
| `report_bi_monthly` | 產生雙月盤點報告 | `anchorDate` · `format` · `levels` · `excluded` |
| `report_half_year` | 產生半年報 | `anchorDate` · `format` · `levels` · `excluded` · `ganttScale` |
| `report_calendar_ics` | 匯出時間紀錄為 ICS 日曆 | `from` · `to` |

## 資料管理

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `data_summary` | 顯示資料數量摘要 | — |
| `data_export` | 匯出完整 JSON 備份 | — |
| `data_import` | 完整資料匯入（覆蓋） | `tasks` · `timeslots` · `mainCategories` · `subCategories` |
| `data_merge` | 智慧合併匯入（依 updatedAt 取較新） | `tasks` · `timeslots` |

## 系統設定

| 指令 | 用途 | 主要參數 |
|---|---|---|
| `settings_get` | 取得設定與所有分類清單 | — |
| `settings_update` | 更新設定 | `darkMode` · `preventDuplicateTaskNames` · `quickAddAction` |
| `category_add` | 新增主分類 | `name`* |
| `category_update_main` | 修改主分類名稱 | `oldName`* · `newName`* |
| `category_delete_main` | 刪除主分類 | `name`* |
| `category_add_sub` | 新增子分類（時間分類） | `name`* |
| `category_update_sub` | 修改子分類名稱 | `oldName`* · `newName`* |
| `category_delete_sub` | 刪除子分類 | `name`* |
| `output_type_add` | 新增工作產出類型 | `name`* · `isTangible`* |
| `output_type_update` | 更新產出類型 | `id`* · `name` · `isTangible` |
| `output_type_delete` | 刪除產出類型 | `id`* |
| `members_list` | 列出成員 | — |
| `member_add` | 新增成員 | `name`* |
| `member_update` | 修改成員姓名 | `id`* · `name`* |
| `member_delete` | 刪除成員 | `id`* |
| `holidays_list` | 列出假日 | — |
| `holidays_add` | 新增假日 | `date`* |
| `holiday_delete` | 刪除假日 | `date`* |

---

## 任務狀態值

| 值 | 中文 |
|---|---|
| `BACKLOG` | 待規劃 |
| `TODO` | 待處理 |
| `IN_PROGRESS` | 進行中 |
| `PAUSED` | 已暫停（需填 `pauseReason`） |
| `DONE` | 已完成 |
| `CANCELLED` | 已取消 |

---

# Part 2 — 使用說明

---

## 任務管理

### `task_list` — 列出任務清單

列出所有未封存任務，每筆附帶 `wbsNumber`（如 `1.2.3`）並依 WBS 階層排序。指定 `parentId` 時只回傳該任務的直接子任務。

| 參數 | 必填 | 說明 |
|---|---|---|
| `archived` | 否 | `true` = 只看封存；省略 = 只看未封存（附 WBS） |
| `parentId` | 否 | 只回傳此父任務的直接子任務 |

**範例**
```
使用者：「列出所有任務」
使用者：「列出封存的任務」
使用者：「列出任務 abc123 的子任務」
```

---

### `task_search` — 依關鍵字搜尋任務

對 `title` 和 `aliasTitle` 做 case-insensitive 部分比對，結果附帶 `wbsNumber`。比 `task_list` 更快定位指定任務。

| 參數 | 必填 | 說明 |
|---|---|---|
| `q` | 是 | 搜尋關鍵字 |
| `archived` | 否 | `true` = 搜尋封存任務；省略 = 只搜尋未封存 |

**範例**
```
使用者：「找找有沒有叫 API 相關的任務」
→ task_search { q: "API" }

使用者：「搜尋已封存的設計任務」
→ task_search { q: "設計", archived: true }
```

---

### `task_find_by_wbs` — 依 WBS 編號查找任務

WBS 編號可從 `task_list` 的 `wbsNumber` 欄位取得，格式如 `"1"`、`"2.3"`、`"1.4.2"`。

| 參數 | 必填 | 說明 |
|---|---|---|
| `wbs` | 是 | WBS 編號，如 `"1.2.3"` |

**範例**
```
使用者：「取得 WBS 2.3 的任務」
→ task_find_by_wbs { wbs: "2.3" }
```

---

### `task_get` — 取得單一任務完整資料

回傳任務的所有欄位，包含 `outputs`（工作產出）、`milestones`（里程碑）、`weeklySnapshots`（週快照）、估計日期等。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |

**範例**
```
使用者：「查看任務 abc123 的詳細資料」
→ task_get { id: "abc123" }
```

---

### `task_get_subtasks` — 取得直接子任務

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 父任務 ID |

**範例**
```
使用者：「列出『API 改版』任務的所有子任務」
→ task_search → 取得 id → task_get_subtasks { id: "..." }
```

---

### `task_get_total_time` — 取得任務累計工時

回傳該任務與所有後代子任務的總工時（小時）。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |

**範例**
```
使用者：「API 改版這個任務總共花了多少時間？」
→ task_get_total_time { id: "..." }
```

---

### `task_create` — 建立新任務

| 參數 | 必填 | 說明 |
|---|---|---|
| `title` | 是 | 任務標題 |
| `description` | 否 | 詳細說明 |
| `mainCategory` | 否 | 主分類（需與系統中已有的分類一致，可先 `settings_get` 查詢） |
| `status` | 否 | 初始狀態（預設 `TODO`） |
| `parentId` | 否 | 父任務 ID，建立子任務時填入 |
| `estimatedStartDate` | 否 | 預計開始日期 `YYYY-MM-DD` |
| `estimatedEndDate` | 否 | 預計完成日期 `YYYY-MM-DD` |
| `completeness` | 否 | 初始完成度 0–100 |

**範例**
```
使用者：「新增一個任務叫『撰寫技術文件』，分類 Development，預計 5/10 到 5/20」
→ task_create {
     title: "撰寫技術文件",
     mainCategory: "Development",
     estimatedStartDate: "2026-05-10",
     estimatedEndDate: "2026-05-20"
   }

使用者：「在 WBS 2 的任務下建立子任務『後端 API 設計』」
→ task_find_by_wbs { wbs: "2" } → 取得 id
→ task_create { title: "後端 API 設計", parentId: "..." }
```

---

### `task_update` — 更新任務欄位

只傳入要修改的欄位，其他欄位保持不變。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |
| `title` | 否 | 新標題 |
| `description` | 否 | 新說明 |
| `mainCategory` | 否 | 主分類 |
| `status` | 否 | 新狀態（見狀態值表） |
| `estimatedStartDate` | 否 | `YYYY-MM-DD` |
| `estimatedEndDate` | 否 | `YYYY-MM-DD` |
| `completeness` | 否 | 完成度 0–100 |
| `completenessType` | 否 | `real`（真實百分比）或 `confidence`（信心百分比） |
| `pauseReason` | 否 | 暫停原因（status = PAUSED 時需填） |

**範例**
```
使用者：「把『撰寫技術文件』任務狀態改為完成」
→ task_search { q: "撰寫技術文件" } → 取得 id
→ task_update { id: "...", status: "DONE" }

使用者：「任務 abc123 完成度更新為 75，類型為真實百分比」
→ task_update { id: "abc123", completeness: 75, completenessType: "real" }

使用者：「暫停任務 abc123，原因：等待需求確認」
→ task_update { id: "abc123", status: "PAUSED", pauseReason: "等待需求確認" }
```

---

### `task_delete` — 刪除任務

> ⚠️ 刪除後連同所有子任務一起移除，**不可逆**。建議改用 `task_archive`。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |

---

### `task_archive` / `task_unarchive` — 封存與取消封存

封存會從主視圖隱藏任務但保留所有資料，可隨時取消封存。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |

**範例**
```
使用者：「封存所有已完成的任務」
→ task_archive_all_done

使用者：「把任務 abc123 封存」
→ task_archive { id: "abc123" }
```

---

### `task_batch_import` — 批次匯入任務

支援多層巢狀結構，每筆任務可用 `children` 欄位定義子任務。

| 參數 | 必填 | 說明 |
|---|---|---|
| `tasks` | 是 | 任務陣列，每筆需有 `title`，可含 `description`、`mainCategory`、`status`、`estimatedStartDate`、`estimatedEndDate`、`children` |
| `parentId` | 否 | 掛載的父任務 ID（留空則加入頂層） |

**範例**
```
使用者：「幫我批次匯入以下三個任務：需求分析、系統設計、實作開發，都掛在任務 abc123 下」
→ task_batch_import {
     tasks: [
       { title: "需求分析" },
       { title: "系統設計" },
       { title: "實作開發" }
     ],
     parentId: "abc123"
   }
```

---

### `task_duplicate` — 複製任務

複製任務的基本欄位（標題、分類、說明等），**不複製**子任務、里程碑、完成度、工時紀錄。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 要複製的任務 ID |

---

### `task_reorder` — 調整任務排序與層級

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |
| `direction` | 是 | `up` 上移、`down` 下移、`promote` 提升層級（脫離父任務）、`demote` 降低層級（成為上一個同層任務的子任務） |

**範例**
```
使用者：「把任務 abc123 往上移一格」
→ task_reorder { id: "abc123", direction: "up" }

使用者：「把任務 abc123 提升為上層任務」
→ task_reorder { id: "abc123", direction: "promote" }
```

---

### `task_update_snapshot` — 更新週進度快照

記錄任務在特定週的完成度，供週報使用。同一週重複更新時會覆蓋（upsert 語意）。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |
| `weekStart` | 是 | 該週起始日 `YYYY-MM-DD`（建議填週一） |
| `completeness` | 是 | 本週完成度 0–100 |
| `note` | 否 | 本週進度說明 |

**範例**
```
使用者：「任務 abc123 本週（5/11）快照：完成度 80，說明：完成後端 API 設計」
→ task_update_snapshot {
     id: "abc123",
     weekStart: "2026-05-11",
     completeness: 80,
     note: "完成後端 API 設計"
   }
```

---

## 里程碑

### `task_milestone_list` — 列出任務里程碑

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 任務 ID |

---

### `task_milestone_upsert` — 新增或更新里程碑

傳入 `milestoneId` 時更新現有里程碑，否則新增。

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 是 | 任務 ID |
| `title` | 是 | 里程碑名稱 |
| `date` | 是 | 日期 `YYYY-MM-DD` |
| `milestoneId` | 否 | 要更新的里程碑 ID（留空 = 新增） |
| `showInGantt` | 否 | 顯示於甘特圖（預設 `true`） |
| `color` | 否 | PlantUML 顏色名稱，如 `Red`、`Gold`、`Blue`、`Green`、`Purple` |
| `note` | 否 | 備注 |

**範例**
```
使用者：「幫任務 abc123 新增一個里程碑『Alpha 上線』，日期 2026-05-30，顏色 Red」
→ task_milestone_upsert {
     taskId: "abc123",
     title: "Alpha 上線",
     date: "2026-05-30",
     color: "Red"
   }
```

---

### `task_milestone_delete` — 刪除里程碑

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 是 | 任務 ID |
| `milestoneId` | 是 | 里程碑 ID（從 `task_milestone_list` 取得） |

---

## 工作產出

### `output_type_list` — 列出工作產出類型

回傳所有產出類型，含 `id`、`name`、`isTangible`（有形/無形）。新增產出前先呼叫此工具取得 `outputTypeId`。

**範例**
```
使用者：「列出所有工作產出類型」
→ output_type_list
回傳例：[{ id: "xxx", name: "文件", isTangible: true }, ...]
```

---

### `task_output_list` — 列出任務工作產出

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 是 | 任務 ID |

---

### `task_output_add` — 新增工作產出

有形產出填 `link`（文件連結），無形產出填 `summary`（摘要說明）。`effectiveDate` 用於週期型產出（如週報告），持續型產出留空。

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 是 | 任務 ID |
| `name` | 是 | 產出名稱 |
| `outputTypeId` | 否 | 產出類型 ID（從 `output_type_list` 取得） |
| `completeness` | 否 | 完成度，如 `"80%"` |
| `effectiveDate` | 否 | 歸屬期間 `YYYY-MM-DD`（週期型填入，持續型留空） |
| `link` | 否 | 有形產出的連結 URL |
| `summary` | 否 | 無形產出的摘要說明 |

**範例**
```
使用者：「幫任務 abc123 新增一個產出『系統設計文件 v2』，
         連結 https://docs.google.com/...，完成度 100%」

→ output_type_list → 找到文件類型 id = "doc-id"
→ task_output_add {
     taskId: "abc123",
     name: "系統設計文件 v2",
     outputTypeId: "doc-id",
     link: "https://docs.google.com/...",
     completeness: "100%"
   }

使用者：「記錄本週（5/11）會議摘要產出到任務 abc123」
→ task_output_add {
     taskId: "abc123",
     name: "本週會議摘要",
     effectiveDate: "2026-05-11",
     summary: "討論了 API 設計方向，確認 3 個核心端點"
   }
```

---

### `task_output_update` — 更新工作產出

只傳入要修改的欄位。

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 是 | 任務 ID |
| `outputId` | 是 | 產出 ID（從 `task_output_list` 取得） |
| `name` | 否 | 新名稱 |
| `outputTypeId` | 否 | 新產出類型 |
| `completeness` | 否 | 新完成度 |
| `effectiveDate` | 否 | 新歸屬日期 |
| `link` | 否 | 新連結 |
| `summary` | 否 | 新摘要 |

**範例**
```
使用者：「把任務 abc123 的產出 out-456 完成度更新為 90%」
→ task_output_update { taskId: "abc123", outputId: "out-456", completeness: "90%" }
```

---

### `task_output_delete` — 刪除工作產出

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 是 | 任務 ID |
| `outputId` | 是 | 產出 ID |

---

## 時間紀錄

### `timeslot_list` — 列出時間紀錄

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 否 | 只看此任務的紀錄 |
| `from` | 否 | 起始時間（`YYYY-MM-DD` 或 epoch ms） |
| `to` | 否 | 結束時間 |

**範例**
```
使用者：「列出今天所有的時間紀錄」
→ timeslot_list { from: "2026-05-14", to: "2026-05-14" }

使用者：「列出任務 abc123 本週的時間紀錄」
→ timeslot_list { taskId: "abc123", from: "2026-05-11", to: "2026-05-15" }
```

---

### `timeslot_clock_in` — 開始計時

建立一筆 startTime = 現在、無 endTime 的時間紀錄。

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 否 | 要計時的任務 ID |
| `subCategory` | 否 | 時間分類，如 `程式開發`、`文件撰寫` |
| `note` | 否 | 備注 |

**範例**
```
使用者：「開始計時，任務 abc123，子分類程式開發」
→ timeslot_clock_in { taskId: "abc123", subCategory: "程式開發" }
```

---

### `timeslot_clock_out` — 結束計時

找到最近一筆無 endTime 的紀錄，設定 endTime = 現在，回傳時長。

| 參數 | 必填 | 說明 |
|---|---|---|
| `taskId` | 否 | 指定任務（不填則結束最近一筆） |

**範例**
```
使用者：「結束計時」
→ timeslot_clock_out
回傳：計時結束。時長：47.3 分鐘
```

---

### `timeslot_create` — 手動新增時間紀錄

補登過去的工作時段。

| 參數 | 必填 | 說明 |
|---|---|---|
| `startTime` | 是 | 開始時間（`YYYY-MM-DDTHH:MM:SS` 或 epoch ms） |
| `taskId` | 否 | 關聯任務 ID |
| `endTime` | 否 | 結束時間（不填 = 進行中） |
| `subCategory` | 否 | 時間分類 |
| `note` | 否 | 備注 |

**範例**
```
使用者：「補登一筆時間，昨天下午 2:00-4:30，任務 abc123，子分類文件撰寫」
→ timeslot_create {
     taskId: "abc123",
     startTime: "2026-05-13T14:00:00",
     endTime: "2026-05-13T16:30:00",
     subCategory: "文件撰寫"
   }
```

---

### `timeslot_update` — 更新時間紀錄

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 時間紀錄 ID |
| `startTime` | 否 | 新開始時間 |
| `endTime` | 否 | 新結束時間 |
| `taskId` | 否 | 重新關聯任務 |
| `subCategory` | 否 | 時間分類 |
| `note` | 否 | 備注 |

---

### `timeslot_delete` — 刪除時間紀錄

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 時間紀錄 ID |

---

## 待辦事項

### `todo_list` — 列出所有待辦

無參數。回傳所有待辦事項（含已完成）。

### `todo_create` — 建立待辦事項

| 參數 | 必填 | 說明 |
|---|---|---|
| `description` | 是 | 待辦內容 |

**範例**
```
使用者：「新增一個待辦：確認 DB schema 是否需要 migration」
→ todo_create { description: "確認 DB schema 是否需要 migration" }
```

---

### `todo_toggle` — 切換完成狀態

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 待辦事項 ID |

**範例**
```
使用者：「把待辦 xyz789 標為完成」
→ todo_toggle { id: "xyz789" }
```

---

### `todo_update` — 更新待辦內容或日期

> 切換完成狀態請用 `todo_toggle`，不要用此工具。

| 參數 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 待辦事項 ID |
| `description` | 否 | 新內容 |
| `startDate` | 否 | 開始日期 `YYYY-MM-DD` |
| `doneDate` | 否 | 完成日期 `YYYY-MM-DD` |

---

### `todo_delete` / `todo_clear_done`

```
todo_delete { id: "..." }        ← 刪除單筆
todo_clear_done                  ← 清除所有已完成
```

---

## 報告

### `report_weekly` — 產生週報

傳入週五作為 `anchorDate` 可精確指定週次，報告範圍為該週週一至週五。

| 參數 | 必填 | 說明 |
|---|---|---|
| `anchorDate` | 否 | 報告所在週的任意日期 `YYYY-MM-DD`（預設今日） |
| `format` | 否 | `adoc`（預設，回傳 AsciiDoc 文字）或 `json`（回傳結構化摘要） |
| `levels` | 否 | 顯示 WBS 階層，逗號分隔，如 `"1,2,3"`（預設 1–5） |
| `excluded` | 否 | 排除的主分類，逗號分隔，如 `"固定會議,行政"` |
| `showTodayMark` | 否 | 甘特圖顯示今日標記（預設 `true`） |
| `groupByCategory` | 否 | 甘特圖依主分類分組（預設 `false`） |

**範例**
```
使用者：「產生本週週報」
→ report_weekly

使用者：「產生 2026-05-09（週五）那週的週報，排除固定會議分類，只顯示到第三階」
→ report_weekly {
     anchorDate: "2026-05-09",
     excluded: "固定會議",
     levels: "1,2,3"
   }
```

---

### `report_bi_monthly` — 產生雙月盤點報告

雙月期：Jan-Feb / Mar-Apr / May-Jun / Jul-Aug / Sep-Oct / Nov-Dec。進度表呈現「前一個雙月」的工作成果。

| 參數 | 必填 | 說明 |
|---|---|---|
| `anchorDate` | 否 | 報告所在雙月期的任意日期（預設今日） |
| `format` | 否 | `adoc` 或 `json` |
| `levels` | 否 | WBS 階層 |
| `excluded` | 否 | 排除主分類 |

**範例**
```
使用者：「產生雙月盤點報告」
→ report_bi_monthly
```

---

### `report_half_year` — 產生半年報

上半年：12月～5月 / 下半年：6月～11月。

| 參數 | 必填 | 說明 |
|---|---|---|
| `anchorDate` | 否 | 報告所在半年期的任意日期（預設今日） |
| `format` | 否 | `adoc` 或 `json` |
| `levels` | 否 | WBS 階層 |
| `excluded` | 否 | 排除主分類 |
| `ganttScale` | 否 | 甘特圖刻度：`daily` / `weekly`（預設）/ `monthly` |

---

### `report_calendar_ics` — 匯出日曆 ICS

匯出指定時間範圍的時間紀錄為 ICS 格式，可匯入 Apple Calendar / Google Calendar。

| 參數 | 必填 | 說明 |
|---|---|---|
| `from` | 否 | 起始日期 `YYYY-MM-DD` |
| `to` | 否 | 結束日期 `YYYY-MM-DD` |

**範例**
```
使用者：「匯出本月的時間紀錄為 ICS 格式」
→ report_calendar_ics { from: "2026-05-01", to: "2026-05-31" }
```

---

## 資料管理

### `data_summary` — 資料數量摘要

無參數。快速確認目前資料狀態。

```
使用者：「目前有多少任務和時間紀錄？」
→ data_summary
回傳：任務：47 筆 / 時間紀錄：312 筆 / 待辦：8 筆 ...
```

### `data_export` — 完整資料匯出

無參數。匯出所有資料的完整 JSON，用於備份或遷移。

### `data_import` — 完整資料匯入

**覆蓋**現有所有資料，適用從備份還原。格式與 `data_export` 相同。

| 參數 | 必填 | 說明 |
|---|---|---|
| `tasks` | 否 | 任務陣列 |
| `timeslots` | 否 | 時間紀錄陣列 |
| `mainCategories` | 否 | 主分類清單 |
| `subCategories` | 否 | 子分類清單 |

### `data_merge` — 智慧合併匯入

依 `id` 比對 `updatedAt`，較新的版本會覆蓋，不包含的資料保持不變。適用跨裝置同步。

| 參數 | 必填 | 說明 |
|---|---|---|
| `tasks` | 否 | 要合併的任務陣列 |
| `timeslots` | 否 | 要合併的時間紀錄陣列 |

---

## 系統設定

### `settings_get` — 取得設定與分類清單

無參數。一次回傳系統設定、主分類、子分類、產出類型、成員清單。

```
使用者：「列出所有主分類」
→ settings_get → 從 mainCats 欄位取得
```

### `settings_update` — 更新系統設定

| 參數 | 必填 | 說明 |
|---|---|---|
| `darkMode` | 否 | 深色模式開關 |
| `preventDuplicateTaskNames` | 否 | 防止任務名稱重複 |
| `quickAddAction` | 否 | 快速新增預設動作（`timeslot` 或 `task`） |

---

### 分類管理

```
category_add        { name: "新分類" }
category_update_main { oldName: "舊名", newName: "新名" }
category_delete_main { name: "要刪除的分類" }

category_add_sub        { name: "新時間分類" }
category_update_sub     { oldName: "舊名", newName: "新名" }
category_delete_sub     { name: "要刪除的時間分類" }
```

> 主分類（mainCategory）用於分類任務；子分類（subCategory）用於標記時間紀錄的工作性質（如會議、程式開發）。

---

### 產出類型管理

```
output_type_list                              ← 查詢所有類型
output_type_add    { name: "報告", isTangible: false }
output_type_update { id: "xxx", name: "新名稱" }
output_type_delete { id: "xxx" }
```

---

### 成員管理

```
members_list
member_add    { name: "王小明" }
member_update { id: "xxx", name: "新姓名" }
member_delete { id: "xxx" }   ← 自己（isSelf）無法刪除
```

---

### 假日管理

```
holidays_list
holidays_add   { date: "2026-06-12" }
holiday_delete { date: "2026-06-12" }
```

---

## 常見工作流程

### 1. 當日工作記錄

```
① 「開始計時，任務 abc123，子分類程式開發」
   → timeslot_clock_in

② 做完後：「結束計時」
   → timeslot_clock_out（自動回傳時長）

③ 「把任務 abc123 完成度更新為 60%」
   → task_update { completeness: 60 }
```

### 2. 週報生成

```
① 確認本週各任務進度（可選）：
   「任務 abc123 本週快照 80%，說明：完成後端設計」
   → task_update_snapshot

② 「產生本週週報」
   → report_weekly（本週五為今日）
   或 report_weekly { anchorDate: "2026-05-16" }

③ 複製回傳的 AsciiDoc 文字貼入週報文件
```

### 3. 新增任務及工作產出

```
① 「新增任務『API 文件』，分類 Development，預計 5/14-5/20」
   → task_create

② 「列出工作產出類型」（取得 outputTypeId）
   → output_type_list

③ 「幫剛建的任務新增產出『Swagger 文件』，類型選文件類，連結 https://...」
   → task_output_add
```

### 4. 查找並操作特定任務

```
① 已知任務名稱：
   「找任務名稱含 API 的任務」
   → task_search { q: "API" }

② 已知 WBS 編號：
   「取得 WBS 2.3 的任務」
   → task_find_by_wbs { wbs: "2.3" }

③ 已知 ID：
   → task_get { id: "..." }
```

---

## 注意事項

- **Server 必須在線**：`npm run dev` 啟動後才能使用 MCP 工具
- **ID 查詢**：不知道 ID 時先用 `task_search` 或 `task_list`，從 `id` 欄位取得
- **刪除不可逆**：`task_delete` 會連同子任務一起刪除，建議優先用 `task_archive`
- **分類需先存在**：`task_create` 的 `mainCategory` 必須與系統設定中的主分類一致，可先 `settings_get` 查詢
- **週報錨點**：`anchorDate` 傳同週任意日期都可以，傳週五最直覺（Mon–Fri 範圍）
