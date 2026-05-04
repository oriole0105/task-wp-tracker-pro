# WorkScope Planner — AI MCP 使用手冊

## 前置條件

使用前必須確認以下兩件事：

1. **Server 正在運作**（在 `task-time-tracker/` 目錄執行）：
   ```bash
   npm run dev
   ```

2. **MCP 已註冊到 Claude**（一次性設定）：
   ```bash
   npm -w packages/mcp run print-config
   # 將輸出的 JSON 貼入 Claude Desktop 的 claude_desktop_config.json
   ```
   或執行 `claude mcp list` 確認 `task-time-tracker: ✓ Connected`。

---

## 任務狀態說明

| 值 | 中文 | 說明 |
|---|---|---|
| `BACKLOG` | 待規劃 | 尚未排進計畫 |
| `TODO` | 待處理 | 已排程，等待開始 |
| `IN_PROGRESS` | 進行中 | 正在執行 |
| `PAUSED` | 已暫停 | 暫時停止 |
| `DONE` | 已完成 | 完成 |
| `CANCELLED` | 已取消 | 取消不做 |

---

## 任務工具（task_*）

### `task_list` — 列出任務

| 參數 | 類型 | 說明 |
|---|---|---|
| `archived` | boolean（選填） | `true`=只看封存；`false`=只看未封存（預設）；不傳=全部 |
| `parentId` | string（選填） | 只回傳此父任務的直接子任務 |

**範例自然語言：**
- 「列出所有任務」
- 「列出封存的任務」
- 「列出任務 abc123 的子任務」（用 task_get_subtasks 更明確）

---

### `task_get` — 取得單一任務

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（必填） | 任務 ID |

回傳完整任務資料，包含 outputs、weeklySnapshots、估計日期等。

---

### `task_get_subtasks` — 取得子任務

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（必填） | 父任務 ID |

---

### `task_get_total_time` — 取得任務總工時

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（必填） | 任務 ID |

回傳該任務及所有子孫任務的累計工時（小時）。

---

### `task_create` — 建立任務

| 參數 | 類型 | 說明 |
|---|---|---|
| `title` | string（**必填**） | 任務標題 |
| `description` | string（選填） | 詳細說明 |
| `mainCategory` | string（選填） | 主分類，需與系統中現有分類一致 |
| `status` | enum（選填） | 初始狀態（預設 `TODO`） |
| `parentId` | string（選填） | 父任務 ID（建立子任務時填入） |
| `estimatedStartDate` | string（選填） | 預計開始 `YYYY-MM-DD` |
| `estimatedEndDate` | string（選填） | 預計完成 `YYYY-MM-DD` |
| `completeness` | number 0-100（選填） | 初始完成度 |

**範例自然語言：**
- 「新增一個任務叫『撰寫技術文件』，分類 Development，預計 5/10 到 5/20」
- 「在任務 abc123 下建立子任務『後端 API 設計』」

---

### `task_update` — 更新任務

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 任務 ID |
| `title` | string（選填） | 新標題 |
| `description` | string（選填） | 新說明 |
| `mainCategory` | string（選填） | 主分類 |
| `status` | enum（選填） | 新狀態 |
| `estimatedStartDate` | string（選填） | `YYYY-MM-DD` |
| `estimatedEndDate` | string（選填） | `YYYY-MM-DD` |
| `completeness` | number 0-100（選填） | 完成度 |
| `pauseReason` | string（選填） | 暫停原因（status=PAUSED 時填） |

**範例自然語言：**
- 「把任務 abc123 的狀態改為 DONE」
- 「把任務 abc123 的完成度更新為 75」
- 「任務 abc123 改名為『重構認證模組』」

---

### `task_delete` — 刪除任務

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 任務 ID |

> ⚠️ 刪除後連同所有子任務一起移除，**不可逆**。

---

### `task_archive` / `task_unarchive` — 封存/取消封存

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 任務 ID |

封存會從主視圖隱藏但保留資料，可隨時取消封存。

---

### `task_archive_all_done` — 批次封存已完成任務

無參數。將所有狀態為 `DONE` 或 `CANCELLED` 的任務一次封存。

---

### `task_update_snapshot` — 更新週進度快照

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 任務 ID |
| `weekStart` | string（**必填**） | 該週週日日期 `YYYY-MM-DD` |
| `completeness` | number 0-100（**必填**） | 本週完成度 |
| `note` | string（選填） | 本週進度說明 |

用於記錄每週的完成度快照，供週報使用。

---

## 時間紀錄工具（timeslot_*）

### `timeslot_list` — 列出時間紀錄

| 參數 | 類型 | 說明 |
|---|---|---|
| `taskId` | string（選填） | 只看此任務的紀錄 |
| `from` | string（選填） | 起始時間（`YYYY-MM-DD` 或 epoch ms） |
| `to` | string（選填） | 結束時間（`YYYY-MM-DD` 或 epoch ms） |

**範例自然語言：**
- 「列出今天的時間紀錄」→ from/to 填今天日期
- 「列出任務 abc123 所有的時間紀錄」

---

### `timeslot_clock_in` — 開始計時

| 參數 | 類型 | 說明 |
|---|---|---|
| `taskId` | string（選填） | 要計時的任務 ID |
| `subCategory` | string（選填） | 子分類（如：程式開發、會議） |
| `note` | string（選填） | 備注 |

建立一筆 startTime=現在、無 endTime 的紀錄。

**範例：** 「開始計時，任務 abc123，子分類程式開發」

---

### `timeslot_clock_out` — 結束計時

| 參數 | 類型 | 說明 |
|---|---|---|
| `taskId` | string（選填） | 指定任務（不填則結束最近一筆） |

找到最近一筆無 endTime 的紀錄，設定 endTime=現在，並回傳時長。

**範例：** 「結束計時」

---

### `timeslot_create` — 手動新增時間紀錄

| 參數 | 類型 | 說明 |
|---|---|---|
| `taskId` | string（選填） | 關聯任務 ID |
| `startTime` | string（**必填**） | 開始時間（`YYYY-MM-DDTHH:MM:SS` 或 epoch ms） |
| `endTime` | string（選填） | 結束時間（不填=進行中） |
| `subCategory` | string（選填） | 子分類 |
| `note` | string（選填） | 備注 |

**範例：** 「新增一筆時間紀錄，昨天 14:00-16:30，任務 abc123，子分類會議」

---

### `timeslot_update` — 更新時間紀錄

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 時間紀錄 ID |
| `taskId` | string（選填） | 重新關聯任務 |
| `startTime` | string（選填） | 新開始時間 |
| `endTime` | string（選填） | 新結束時間 |
| `subCategory` | string（選填） | 子分類 |
| `note` | string（選填） | 備注 |

---

### `timeslot_delete` — 刪除時間紀錄

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 時間紀錄 ID |

---

## 待辦事項工具（todo_*）

### `todo_list` — 列出待辦事項

無參數。回傳所有待辦（含已完成）。

---

### `todo_create` — 建立待辦事項

| 參數 | 類型 | 說明 |
|---|---|---|
| `description` | string（**必填**） | 待辦內容 |

---

### `todo_toggle` — 切換完成狀態

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 待辦事項 ID |

---

### `todo_update` — 更新待辦事項

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 待辦事項 ID |
| `description` | string（選填） | 新內容 |
| `startDate` | string（選填） | 開始日期 `YYYY-MM-DD` |
| `doneDate` | string（選填） | 完成日期 `YYYY-MM-DD` |

> 切換完成/未完成狀態請用 `todo_toggle`，不要用此工具。

---

### `todo_delete` — 刪除待辦事項

| 參數 | 類型 | 說明 |
|---|---|---|
| `id` | string（**必填**） | 待辦事項 ID |

---

### `todo_clear_done` — 清除所有已完成待辦

無參數。刪除所有 `done: true` 的待辦事項。

---

## 報告工具（report_*）

### `report_weekly` — 產生週報

| 參數 | 類型 | 說明 |
|---|---|---|
| `anchorDate` | string（選填） | 報告所在週的任意日期 `YYYY-MM-DD`（預設今日） |
| `format` | `adoc` / `json`（選填） | 輸出格式（預設 `adoc`） |
| `levels` | string（選填） | 顯示 WBS 階層，逗號分隔，如 `"1,2,3"` |
| `excluded` | string（選填） | 排除主分類，逗號分隔，如 `"Meeting,General"` |
| `showTodayMark` | boolean（選填） | 甘特圖顯示今日線（預設 `true`） |
| `groupByCategory` | boolean（選填） | 甘特圖依分類分組（預設 `false`） |

`adoc` 格式回傳完整 AsciiDoc 週報文字，可直接複製貼到文件。
`json` 格式回傳結構化摘要，方便程式處理。

**範例自然語言：**
- 「產生本週週報」
- 「產生 2026-04-28 那週的週報，排除 Meeting 分類」

---

### `report_bi_monthly` — 產生雙月盤點報告

| 參數 | 類型 | 說明 |
|---|---|---|
| `anchorDate` | string（選填） | 報告所在雙月期的任意日期（預設今日） |
| `format` | `adoc` / `json`（選填） | 輸出格式（預設 `adoc`） |
| `levels` | string（選填） | WBS 階層 |
| `excluded` | string（選填） | 排除主分類 |

---

### `report_half_year` — 產生半年報

| 參數 | 類型 | 說明 |
|---|---|---|
| `anchorDate` | string（選填） | 報告所在半年期的任意日期（預設今日） |
| `format` | `adoc` / `json`（選填） | 輸出格式（預設 `adoc`） |
| `levels` | string（選填） | WBS 階層 |
| `excluded` | string（選填） | 排除主分類 |
| `ganttScale` | `daily`/`weekly`/`monthly`（選填） | 甘特圖刻度（預設 `weekly`） |

---

### `report_calendar_ics` — 匯出日曆

| 參數 | 類型 | 說明 |
|---|---|---|
| `from` | string（選填） | 起始日期 `YYYY-MM-DD` |
| `to` | string（選填） | 結束日期 `YYYY-MM-DD` |

回傳 ICS 格式文字，可存成 `.ics` 匯入 Apple Calendar / Google Calendar。

---

## 資料與設定工具（data_* / settings_*）

### `data_export` — 匯出完整資料

無參數。回傳所有任務、時間紀錄、待辦、分類、設定的完整 JSON。

### `data_summary` — 資料摘要

無參數。回傳簡短的數量統計（任務 N 筆、時間紀錄 N 筆等）。

### `settings_get` — 取得系統設定

無參數。回傳設定、所有主分類、子分類、產出類型、成員清單。

### `settings_update` — 更新設定

| 參數 | 類型 | 說明 |
|---|---|---|
| `darkMode` | boolean（選填） | 深色模式 |
| `preventDuplicateTaskNames` | boolean（選填） | 防止重複任務名稱 |
| `quickAddAction` | string（選填） | 快速新增預設動作 |

### `category_add` — 新增主分類

| 參數 | 類型 | 說明 |
|---|---|---|
| `name` | string（**必填**） | 分類名稱 |

### `output_type_list` — 列出產出類型

無參數。

### `members_list` — 列出成員

無參數。

### `holidays_list` — 列出假日

無參數。

### `holidays_add` — 新增假日

| 參數 | 類型 | 說明 |
|---|---|---|
| `date` | string（**必填**） | 假日日期 `YYYY-MM-DD` |

---

## 常見工作流程

### 記錄今天的工作

```
1. 開始計時：「開始計時，任務 XXX，子分類程式開發」
   → timeslot_clock_in

2. 結束計時：「結束計時」
   → timeslot_clock_out（自動計算時長）

3. 更新進度：「把任務 XXX 完成度更新為 60%」
   → task_update { completeness: 60 }
```

### 週報生成流程

```
1. 更新各任務本週快照：
   「任務 XXX 本週快照：完成度 80，說明：完成 API 設計」
   → task_update_snapshot

2. 產生週報：「產生本週週報」
   → report_weekly（回傳 AsciiDoc 文字）

3. 複製報告文字貼到文件
```

### 新專案建立

```
1. 建立父任務：「新增任務『2026 Q2 專案』，分類 Development」
   → task_create

2. 建立子任務（用上一步回傳的 ID 當 parentId）：
   「在任務 {id} 下建立子任務『需求分析』」
   → task_create { parentId: "..." }

3. 設定日期與狀態：
   「更新任務 {id} 預計 5/1-5/10，狀態 IN_PROGRESS」
   → task_update
```

---

## 注意事項

- **所有操作需要 server 在線**：如果 server 沒跑，工具呼叫會失敗
- **MCP session 問題**：若新增 MCP 後舊對話的工具找不到，請開新對話
- **ID 取得方式**：先用 `task_list` 列出任務，從回傳的 JSON 取得 `id` 欄位
- **刪除不可逆**：`task_delete` 會連同子任務一起刪除，建議用 `task_archive` 代替
