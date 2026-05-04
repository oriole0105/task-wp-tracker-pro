# Task Time Tracker — REST API 使用手冊

> 適用對象：透過 curl / Bruno / script / 自訂工具直接呼叫 REST API 的使用者。

---

## 目錄

1. [快速開始](#1-快速開始)
2. [認證](#2-認證)
3. [回應格式](#3-回應格式)
4. [任務 API（/tasks）](#4-任務-apitasks)
5. [時間紀錄 API（/timeslots）](#5-時間紀錄-apitimeslots)
6. [待辦事項 API（/todos）](#6-待辦事項-apitodos)
7. [設定 API（/settings, /categories, /output-types, /holidays, /members）](#7-設定-api)
8. [報告 API（/reports）](#8-報告-apireports)
9. [資料管理 API（/data）](#9-資料管理-apidata)
10. [系統 API（/system）](#10-系統-apisystem)
11. [SSE 即時事件](#11-sse-即時事件)
12. [常用情境範例](#12-常用情境範例)
13. [任務狀態與欄位參考](#13-任務狀態與欄位參考)

---

## 1. 快速開始

### 啟動 Server

```bash
# 在 task-time-tracker/ 目錄下執行
npm run dev
```

啟動後 API server 監聽在 **`http://127.0.0.1:5174`**。

### 取得 Token

Token 存放於 `~/.task-time-tracker/token`：

```bash
export TOKEN=$(cat ~/.task-time-tracker/token)
```

### 測試連線

```bash
curl http://127.0.0.1:5174/system/health
# {"ok":true,"data":{"status":"ok","schemaVersion":3,"bootstrapRequired":false}}
```

### 第一支 API 呼叫

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks
```

---

## 2. 認證

所有 `/api/v1/*` 路徑都需要帶 **Bearer Token**：

```
Authorization: Bearer <token>
```

`/system/*` 路徑（health、handshake、import-localstorage、events）**不需要** Token。

Token 位置：

```
~/.task-time-tracker/token
```

**建議做法**：將 Token 存入環境變數，避免每次手動複製。

```bash
# 加入 ~/.zshrc 或 ~/.bashrc
export TT_TOKEN=$(cat ~/.task-time-tracker/token)

# 使用
curl -H "Authorization: Bearer $TT_TOKEN" http://127.0.0.1:5174/api/v1/tasks
```

---

## 3. 回應格式

### 成功

```json
{ "ok": true, "data": <實際資料> }
```

### 失敗

```json
{ "ok": false, "error": { "code": "錯誤代碼", "message": "說明文字" } }
```

常見錯誤代碼：

| 代碼 | HTTP 狀態 | 說明 |
|---|---|---|
| `NOT_FOUND` | 404 | 找不到指定資源 |
| `VALIDATION_ERROR` | 400 | 請求參數不合法 |
| `ALREADY_BOOTSTRAPPED` | 409 | 資料已存在，無法再次初始化 |

---

## 4. 任務 API（/tasks）

Base path：`/api/v1/tasks`

### 4.1 列出任務

```
GET /api/v1/tasks
```

| Query 參數 | 說明 |
|---|---|
| `archived=true\|false` | 篩選已封存或未封存任務（省略則回傳全部） |
| `parentId=<id>` | 只回傳指定父任務的直屬子任務（`parentId=` 可篩出頂層任務） |

```bash
# 列出所有未封存任務
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/tasks?archived=false"

# 列出頂層任務（無父任務）
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/tasks?parentId="

# 列出某任務的子任務（等同 /tasks/:id/subtasks）
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/tasks?parentId=abc-123"
```

### 4.2 取得單一任務

```
GET /api/v1/tasks/:id
```

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123
```

### 4.3 取得子任務列表

```
GET /api/v1/tasks/:id/subtasks
```

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/subtasks
```

### 4.4 取得任務累積工時

```
GET /api/v1/tasks/:id/total-time
```

回傳 `{ ms: <毫秒數> }`（含所有子任務的工時總和）。

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/total-time
# {"ok":true,"data":{"ms":7200000}}  => 2 小時
```

### 4.5 新增任務

```
POST /api/v1/tasks
Content-Type: application/json
```

**必填欄位**：`title`（字串）  
**選填欄位**：見 [§13 欄位參考](#13-任務狀態與欄位參考)

```bash
# 新增頂層任務
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "新專案", "status": "TODO"}' \
  http://127.0.0.1:5174/api/v1/tasks

# 新增子任務
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "子任務A", "status": "TODO", "parentId": "abc-123"}' \
  http://127.0.0.1:5174/api/v1/tasks
```

**回應**（HTTP 201）：

```json
{
  "ok": true,
  "data": {
    "id": "新產生的UUID",
    "title": "新專案",
    "status": "TODO",
    "parentId": null,
    "createdAt": "2026-05-02T10:00:00.000Z",
    ...
  }
}
```

### 4.6 更新任務

```
PATCH /api/v1/tasks/:id
Content-Type: application/json
```

只傳入要修改的欄位，其餘保持不變。

```bash
# 修改標題與狀態
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "改名後的任務", "status": "IN_PROGRESS"}' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123

# 設定完成日期
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "DONE", "doneDate": "2026-05-02"}' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123
```

### 4.7 刪除任務

```
DELETE /api/v1/tasks/:id
```

**注意**：刪除父任務會連同所有子任務一起刪除。

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123
# {"ok":true,"data":{"deletedIds":["abc-123","子任務id-1","子任務id-2"]}}
```

### 4.8 複製任務（單一）

```
POST /api/v1/tasks/:id/duplicate
```

複製單一任務（不含子任務），標題加上「- 副本」。

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/duplicate
```

### 4.9 複製整棵子樹

```
POST /api/v1/tasks/:id/duplicate-subtree
Content-Type: application/json
```

| 參數 | 型別 | 說明 |
|---|---|---|
| `prefix` | 字串（可空） | 在每個任務標題前加上的文字 |
| `postfix` | 字串（可空） | 在每個任務標題後加上的文字 |
| `search` | 字串（選填） | 標題中要被取代的文字 |
| `replace` | 字串（選填） | 取代後的文字 |

```bash
# 複製整個專案樹，標題加上「[複製]」前綴
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prefix": "[複製] ", "postfix": ""}' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/duplicate-subtree
```

### 4.10 調整任務順序

```
POST /api/v1/tasks/:id/reorder
Content-Type: application/json
```

| `direction` 值 | 說明 |
|---|---|
| `up` | 在同層中向上移動一格 |
| `down` | 在同層中向下移動一格 |
| `promote` | 提升一層（父任務變為同層前輩） |
| `demote` | 降一層（成為上一個同層任務的子任務） |

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"direction": "up"}' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/reorder
```

### 4.11 封存任務

```
POST /api/v1/tasks/:id/archive
```

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/archive
```

### 4.12 取消封存任務

```
POST /api/v1/tasks/:id/unarchive
```

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/unarchive
```

### 4.13 一鍵封存所有已完成任務

```
POST /api/v1/tasks/archive-all-done
```

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/tasks/archive-all-done
# {"ok":true,"data":{"archived":5}}  => 封存了 5 個任務
```

### 4.14 更新週報快照

```
PATCH /api/v1/tasks/:id/snapshots
Content-Type: application/json
```

傳入完整的 `WeeklySnapshot[]` 陣列（覆蓋既有快照）。

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"weekStart":"2026-04-28","progress":60,"note":"進行中"}]' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/snapshots
```

### 4.15 更新週記

```
PATCH /api/v1/tasks/:id/weekly-note
Content-Type: application/json
```

| 參數 | 型別 | 說明 |
|---|---|---|
| `weekStart` | 字串 `YYYY-MM-DD` | 該週的週一日期 |
| `note` | 字串 | 週記內容 |

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"weekStart":"2026-04-28","note":"本週完成API串接"}' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/weekly-note
```

### 4.16 更新產出

```
PATCH /api/v1/tasks/:taskId/outputs/:outputId
Content-Type: application/json
```

更新任務的某筆產出記錄（`WorkOutput`）。

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"修訂後的文件URL"}' \
  http://127.0.0.1:5174/api/v1/tasks/abc-123/outputs/output-456
```

### 4.17 批次匯入任務（JSON 格式）

```
POST /api/v1/tasks/import
Content-Type: application/json
```

| 參數 | 型別 | 說明 |
|---|---|---|
| `tasks` | 陣列 | 要匯入的任務（`JsonImportTask[]`） |
| `parentId` | 字串（選填） | 匯入後全部掛在此父任務下 |

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tasks":[{"title":"匯入任務A"},{"title":"匯入任務B"}]}' \
  http://127.0.0.1:5174/api/v1/tasks/import
```

---

## 5. 時間紀錄 API（/timeslots）

Base path：`/api/v1/timeslots`

### 5.1 列出時間紀錄

```
GET /api/v1/timeslots
```

| Query 參數 | 說明 |
|---|---|
| `taskId=<id>` | 篩選指定任務的紀錄 |
| `from=<Unix毫秒>` | 開始時間下限 |
| `to=<Unix毫秒>` | 開始時間上限 |

```bash
# 列出某任務的所有時間紀錄
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/timeslots?taskId=abc-123"

# 列出 2026-05-01 以後的紀錄
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/timeslots?from=1746057600000"
```

### 5.2 取得單筆時間紀錄

```
GET /api/v1/timeslots/:id
```

### 5.3 新增時間紀錄

```
POST /api/v1/timeslots
Content-Type: application/json
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `taskId` | 字串 | 關聯的任務 ID |
| `startTime` | 數字 | 開始時間（Unix 毫秒） |
| `endTime` | 數字 | 結束時間（Unix 毫秒） |
| `note` | 字串（選填） | 備註 |

```bash
# 記錄今天 9:00–11:00 的工作時間（手動計算 Unix 毫秒）
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "abc-123",
    "startTime": 1746144000000,
    "endTime": 1746151200000,
    "note": "完成 API 文件撰寫"
  }' \
  http://127.0.0.1:5174/api/v1/timeslots
```

**取得目前時間的 Unix 毫秒**：

```bash
date +%s%3N   # 例如：1746144000000
```

### 5.4 更新時間紀錄

```
PATCH /api/v1/timeslots/:id
Content-Type: application/json
```

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endTime": 1746154800000, "note": "修正結束時間"}' \
  http://127.0.0.1:5174/api/v1/timeslots/ts-456
```

### 5.5 刪除時間紀錄

```
DELETE /api/v1/timeslots/:id
```

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/timeslots/ts-456
```

---

## 6. 待辦事項 API（/todos）

Base path：`/api/v1/todos`

### 6.1 列出所有待辦

```
GET /api/v1/todos
```

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/todos
```

### 6.2 新增待辦

```
POST /api/v1/todos
Content-Type: application/json
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `description` | 字串（必填） | 待辦事項內容 |

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "整理本週工作紀錄"}' \
  http://127.0.0.1:5174/api/v1/todos
```

### 6.3 更新待辦

```
PATCH /api/v1/todos/:id
Content-Type: application/json
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `description` | 字串（選填） | 修改內容 |
| `startDate` | 字串 `YYYY-MM-DD`（選填） | 開始日期 |
| `doneDate` | 字串 `YYYY-MM-DD`（選填） | 完成日期 |

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"description": "整理本週工作紀錄（含附件）", "startDate": "2026-05-02"}' \
  http://127.0.0.1:5174/api/v1/todos/todo-789
```

### 6.4 切換完成狀態

```
POST /api/v1/todos/:id/toggle
```

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/todos/todo-789/toggle
```

### 6.5 刪除待辦

```
DELETE /api/v1/todos/:id
```

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/todos/todo-789
```

### 6.6 清除所有已完成待辦

```
POST /api/v1/todos/clear-done
```

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/todos/clear-done
# {"ok":true,"data":{"cleared":3}}
```

### 6.7 批次匯入待辦

```
POST /api/v1/todos/import
Content-Type: application/json
```

傳入 `TodoItem[]` 陣列，已存在的 ID 會略過（不覆蓋）。

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"id":"todo-001","description":"待辦A","done":false},{"id":"todo-002","description":"待辦B","done":true}]' \
  http://127.0.0.1:5174/api/v1/todos/import
# {"ok":true,"data":{"added":2,"skipped":0}}
```

---

## 7. 設定 API

### 7.1 全域設定

#### 讀取設定

```
GET /api/v1/settings
```

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/settings
```

#### 更新設定

```
PATCH /api/v1/settings
Content-Type: application/json
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `darkMode` | 布林（選填） | 深色主題 |
| `preventDuplicateTaskNames` | 布林（選填） | 防止重複任務名稱 |
| `quickAddAction` | 字串（選填） | 快速新增動作設定 |

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"darkMode": true}' \
  http://127.0.0.1:5174/api/v1/settings
```

### 7.2 主分類

```
GET    /api/v1/categories/main              # 列出
POST   /api/v1/categories/main              # 新增 {"name":"分類名稱"}
PATCH  /api/v1/categories/main/:name        # 改名 {"name":"新名稱"}
DELETE /api/v1/categories/main/:name        # 刪除
```

```bash
# 新增主分類
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "研發"}' \
  http://127.0.0.1:5174/api/v1/categories/main

# 刪除主分類
curl -X DELETE \
  -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/categories/main/研發"
```

### 7.3 子分類

```
GET    /api/v1/categories/sub
POST   /api/v1/categories/sub              # {"name":"子分類名"}
PATCH  /api/v1/categories/sub/:name        # {"name":"新名稱"}
DELETE /api/v1/categories/sub/:name
```

### 7.4 產出類型

```
GET    /api/v1/output-types
POST   /api/v1/output-types                # {"name":"類型名","color":"#hex"}
PATCH  /api/v1/output-types/:id            # {"name":"新名稱","color":"#hex"}
DELETE /api/v1/output-types/:id
```

```bash
# 新增產出類型
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "技術文件", "color": "#1976d2"}' \
  http://127.0.0.1:5174/api/v1/output-types
```

### 7.5 假日

```
GET    /api/v1/holidays
POST   /api/v1/holidays                    # {"date":"YYYY-MM-DD"}
DELETE /api/v1/holidays/:date              # date = YYYY-MM-DD
```

```bash
# 新增假日
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-06-19"}' \
  http://127.0.0.1:5174/api/v1/holidays

# 刪除假日
curl -X DELETE \
  -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/holidays/2026-06-19
```

### 7.6 成員

```
GET    /api/v1/members
POST   /api/v1/members                     # {"name":"姓名"}
PATCH  /api/v1/members/:id                 # {"name":"新姓名"}
DELETE /api/v1/members/:id
```

```bash
# 新增成員
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "王小明"}' \
  http://127.0.0.1:5174/api/v1/members
```

---

## 8. 報告 API（/reports）

**注意**：報告 API 不需要 Token（`/api/v1/reports/...` 仍需 Token）。

### 8.1 週報

```
GET /api/v1/reports/weekly
```

| Query 參數 | 說明 | 預設值 |
|---|---|---|
| `anchorDate` | 參考日期 `YYYY-MM-DD`（用以決定報告週次） | 今天 |
| `format` | `adoc`（AsciiDoc 文字）或 `json`（結構化資料） | `adoc` |
| `levels` | 顯示的 WBS 層級，逗號分隔 | `1,2,3,4,5` |
| `excluded` | 排除的主分類，逗號分隔 | 空 |
| `ganttMode` | `weekly` 或 `workReview` | `weekly` |
| `ganttScale` | `daily` / `weekly` / `monthly` | `daily` |
| `ganttZoom` | 甘特圖縮放倍率 | `1` |
| `showTodayMark` | 是否顯示今日標記 | `true` |
| `groupByCategory` | 是否依分類分組 | `false` |

```bash
# 取得本週 AsciiDoc 週報
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/weekly?anchorDate=2026-05-02&format=adoc"

# 只顯示前兩層，排除「管理」分類
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/weekly?levels=1,2&excluded=管理"

# 儲存週報到檔案
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/weekly?format=adoc" \
  -o weekly_report_2026-05-02.adoc
```

### 8.2 雙月報

```
GET /api/v1/reports/bi-monthly
```

Query 參數與週報相同（不含 `ganttMode`）：

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/bi-monthly?anchorDate=2026-05-01&format=adoc" \
  -o bi_monthly_report.adoc
```

### 8.3 半年報

```
GET /api/v1/reports/half-year
```

```bash
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/half-year?anchorDate=2026-05-01&format=adoc" \
  -o half_year_report.adoc
```

### 8.4 行事曆匯出（ICS）

```
GET /api/v1/reports/calendar.ics
```

| Query 參數 | 說明 |
|---|---|
| `from` | 開始日期 `YYYY-MM-DD`（選填） |
| `to` | 結束日期 `YYYY-MM-DD`（選填） |

```bash
# 匯出 2026 年 Q2 的行事曆
curl -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/calendar.ics?from=2026-04-01&to=2026-06-30" \
  -o calendar_2026Q2.ics
```

---

## 9. 資料管理 API（/data）

### 9.1 匯出全部資料

```
GET /api/v1/data/export
```

回傳包含所有任務、時間紀錄、待辦、設定的完整 JSON。

```bash
# 匯出並儲存備份
curl -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/data/export \
  -o backup_$(date +%Y%m%d).json
```

### 9.2 完整匯入（取代現有資料）

```
POST /api/v1/data/import
Content-Type: application/json
```

**警告**：此操作會**完全取代**現有資料，不可恢復。建議先執行 9.1 備份。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `tasks` | 陣列（選填） | 任務列表 |
| `timeslots` | 陣列（選填） | 時間紀錄 |
| `mainCategories` | 字串陣列（選填） | 主分類 |
| `subCategories` | 字串陣列（選填） | 子分類 |
| `outputTypes` | 陣列（選填） | 產出類型 |
| `holidays` | 字串陣列（選填） | 假日列表 |
| `members` | 陣列（選填） | 成員列表 |

```bash
# 匯入備份檔案（需先用 jq 取出 data 欄位）
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(cat backup_20260502.json | jq '.data')" \
  http://127.0.0.1:5174/api/v1/data/import
```

### 9.3 智慧合併

```
POST /api/v1/data/merge
Content-Type: application/json
```

依 `id` 比對，用 `updatedAt` 決定保留新或舊版本，不會無謂覆蓋。

| 欄位 | 型別 | 說明 |
|---|---|---|
| `tasks` | 陣列（選填） | 要合併的任務 |
| `timeslots` | 陣列（選填） | 要合併的時間紀錄 |

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tasks":[{"id":"abc","title":"合併來的任務","updatedAt":"2026-05-02T10:00:00Z",...}]}' \
  http://127.0.0.1:5174/api/v1/data/merge
```

### 9.4 僅匯入設定

```
POST /api/v1/data/import-settings
Content-Type: application/json
```

只更新分類、產出類型、假日、成員，不動任務與時間紀錄。

```bash
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mainCategories":["研發","管理","營運"],"holidays":["2026-06-19"]}' \
  http://127.0.0.1:5174/api/v1/data/import-settings
```

---

## 10. 系統 API（/system）

**這些端點不需要 Token。**

### 10.1 健康檢查

```
GET /system/health
```

```bash
curl http://127.0.0.1:5174/system/health
# {"ok":true,"data":{"status":"ok","schemaVersion":3,"bootstrapRequired":false}}
```

`bootstrapRequired: true` 表示尚未初始化（`data.json` 不存在）。

### 10.2 取得 Token

```
GET /system/handshake
```

僅供本機 web UI 在首次載入時取得 Token，外部工具請直接讀取 `~/.task-time-tracker/token`。

```bash
curl http://127.0.0.1:5174/system/handshake
# {"ok":true,"data":{"token":"abc123..."}}
```

### 10.3 首次初始化匯入

```
POST /system/import-localstorage
Content-Type: application/json
```

用於將舊版 localStorage 資料匯入。若 `data.json` 已存在則回傳 HTTP 409。

---

## 11. SSE 即時事件

```
GET /system/events?token=<TOKEN>
```

Server-Sent Events 串流，每當資料被修改時 server 會推送事件。

```bash
# 監聽所有事件
curl -N "http://127.0.0.1:5174/system/events?token=$TT_TOKEN"
```

事件格式：

```
event: task.updated
data: {"type":"task.updated","id":"abc-123","ts":1746144000000}

event: timeslot.created
data: {"type":"timeslot.created","id":"ts-456","ts":1746144001000}
```

常見事件類型：

| 事件 | 觸發時機 |
|---|---|
| `connected` | 連線成功（初始 ping） |
| `task.created` | 新增任務 |
| `task.updated` | 更新任務（含封存/週報） |
| `task.deleted` | 刪除任務 |
| `tasks.updated` | 批次操作（重排序、封存全部等） |
| `timeslot.created` | 新增時間紀錄 |
| `timeslot.updated` | 更新時間紀錄 |
| `timeslot.deleted` | 刪除時間紀錄 |
| `todo.created` | 新增待辦 |
| `todo.updated` | 更新待辦 |
| `todo.deleted` | 刪除待辦 |
| `todos.updated` | 批次待辦操作 |
| `settings.updated` | 更新設定/分類/成員 |
| `data.imported` | 完整資料匯入 |
| `data.merged` | 資料合併 |

---

## 12. 常用情境範例

### 12.1 每日開工流程

```bash
export TT_TOKEN=$(cat ~/.task-time-tracker/token)
BASE=http://127.0.0.1:5174/api/v1

# 1. 確認 server 正常
curl http://127.0.0.1:5174/system/health | jq .

# 2. 查看今日待辦
curl -s -H "Authorization: Bearer $TT_TOKEN" $BASE/todos | \
  jq '[.data[] | select(.done == false) | {id, description}]'

# 3. 查看進行中任務
curl -s -H "Authorization: Bearer $TT_TOKEN" "$BASE/tasks?archived=false" | \
  jq '[.data[] | select(.status == "IN_PROGRESS") | {id, title}]'

# 4. 開始記錄工作時間（取目前時間毫秒）
START_MS=$(date +%s%3N)
TASK_ID="your-task-id"
# ... 工作中 ...

# 5. 工作結束，記錄時間
END_MS=$(date +%s%3N)
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"taskId\":\"$TASK_ID\",\"startTime\":$START_MS,\"endTime\":$END_MS,\"note\":\"完成功能實作\"}" \
  $BASE/timeslots
```

### 12.2 新增專案並建立子任務

```bash
export TT_TOKEN=$(cat ~/.task-time-tracker/token)
BASE=http://127.0.0.1:5174/api/v1

# 新增父任務（專案）
PARENT=$(curl -s -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"新專案2026","status":"TODO","mainCategory":"研發"}' \
  $BASE/tasks)

PARENT_ID=$(echo $PARENT | jq -r '.data.id')
echo "父任務 ID：$PARENT_ID"

# 新增子任務
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"需求分析\",\"status\":\"TODO\",\"parentId\":\"$PARENT_ID\"}" \
  $BASE/tasks

curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"系統設計\",\"status\":\"TODO\",\"parentId\":\"$PARENT_ID\"}" \
  $BASE/tasks

curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"開發實作\",\"status\":\"TODO\",\"parentId\":\"$PARENT_ID\"}" \
  $BASE/tasks
```

### 12.3 產生並儲存週報

```bash
export TT_TOKEN=$(cat ~/.task-time-tracker/token)
TODAY=$(date +%Y-%m-%d)

# 產生 AsciiDoc 週報
curl -s -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/reports/weekly?anchorDate=$TODAY&format=adoc" \
  -o "weekly_$TODAY.adoc"

echo "週報已儲存到 weekly_$TODAY.adoc"

# 用 asciidoctor 轉 HTML（若有安裝）
# asciidoctor "weekly_$TODAY.adoc"
```

### 12.4 定期備份資料

```bash
#!/bin/bash
# 建議存為 ~/scripts/tt-backup.sh，加入 crontab

export TT_TOKEN=$(cat ~/.task-time-tracker/token)
BACKUP_DIR=~/Documents/tt-backups
mkdir -p $BACKUP_DIR

DATE=$(date +%Y%m%d_%H%M%S)
curl -s -H "Authorization: Bearer $TT_TOKEN" \
  http://127.0.0.1:5174/api/v1/data/export \
  -o "$BACKUP_DIR/tt_backup_$DATE.json"

echo "備份完成：$BACKUP_DIR/tt_backup_$DATE.json"
```

### 12.5 查詢任務總工時

```bash
export TT_TOKEN=$(cat ~/.task-time-tracker/token)
TASK_ID="abc-123"

RESULT=$(curl -s -H "Authorization: Bearer $TT_TOKEN" \
  "http://127.0.0.1:5174/api/v1/tasks/$TASK_ID/total-time")

MS=$(echo $RESULT | jq '.data.ms')
HOURS=$(echo "scale=2; $MS / 3600000" | bc)
echo "任務 $TASK_ID 累積工時：${HOURS} 小時"
```

### 12.6 完成任務並封存

```bash
export TT_TOKEN=$(cat ~/.task-time-tracker/token)
BASE=http://127.0.0.1:5174/api/v1
TASK_ID="abc-123"
TODAY=$(date +%Y-%m-%d)

# 設為完成
curl -X PATCH \
  -H "Authorization: Bearer $TT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"DONE\",\"doneDate\":\"$TODAY\"}" \
  $BASE/tasks/$TASK_ID

# 封存
curl -X POST \
  -H "Authorization: Bearer $TT_TOKEN" \
  $BASE/tasks/$TASK_ID/archive

echo "任務已完成並封存"
```

---

## 13. 任務狀態與欄位參考

### 任務狀態（status）

| 值 | 說明 |
|---|---|
| `TODO` | 待辦 |
| `IN_PROGRESS` | 進行中 |
| `DONE` | 完成 |
| `ON_HOLD` | 暫停 |
| `CANCELLED` | 取消 |

### 任務主要欄位（Task）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID 字串 | 唯一識別碼（系統產生） |
| `title` | 字串 | 任務標題（必填） |
| `status` | 字串 | 狀態（見上表） |
| `parentId` | 字串或 null | 父任務 ID |
| `description` | 字串 | 詳細描述 |
| `mainCategory` | 字串 | 主分類 |
| `subCategory` | 字串 | 子分類 |
| `startDate` | 字串 `YYYY-MM-DD` | 預計開始日 |
| `dueDate` | 字串 `YYYY-MM-DD` | 預計完成日 |
| `doneDate` | 字串 `YYYY-MM-DD` | 實際完成日 |
| `estimatedHours` | 數字 | 預估工時（小時） |
| `archived` | 布林 | 是否已封存 |
| `priority` | `high` / `medium` / `low` | 優先順序 |
| `assignee` | 字串 | 負責人 |
| `createdAt` | ISO 時間字串 | 建立時間 |
| `updatedAt` | ISO 時間字串 | 最後更新時間 |

### 時間紀錄欄位（Timeslot）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID 字串 | 唯一識別碼 |
| `taskId` | 字串 | 關聯任務 ID |
| `startTime` | 數字 | 開始時間（Unix 毫秒） |
| `endTime` | 數字 | 結束時間（Unix 毫秒） |
| `note` | 字串 | 備註 |

### 待辦欄位（TodoItem）

| 欄位 | 型別 | 說明 |
|---|---|---|
| `id` | UUID 字串 | 唯一識別碼 |
| `description` | 字串 | 待辦內容 |
| `done` | 布林 | 是否已完成 |
| `startDate` | 字串 `YYYY-MM-DD` | 開始日期 |
| `doneDate` | 字串 `YYYY-MM-DD` | 完成日期 |
| `createdAt` | ISO 時間字串 | 建立時間 |

---

## 附錄：快速參考表

| 操作 | 方法 | 路徑 |
|---|---|---|
| 健康檢查 | GET | `/system/health` |
| 取得 Token | GET | `/system/handshake` |
| **任務** | | |
| 列出任務 | GET | `/api/v1/tasks` |
| 取得任務 | GET | `/api/v1/tasks/:id` |
| 新增任務 | POST | `/api/v1/tasks` |
| 更新任務 | PATCH | `/api/v1/tasks/:id` |
| 刪除任務 | DELETE | `/api/v1/tasks/:id` |
| 複製任務 | POST | `/api/v1/tasks/:id/duplicate` |
| 複製子樹 | POST | `/api/v1/tasks/:id/duplicate-subtree` |
| 調整順序 | POST | `/api/v1/tasks/:id/reorder` |
| 封存任務 | POST | `/api/v1/tasks/:id/archive` |
| 取消封存 | POST | `/api/v1/tasks/:id/unarchive` |
| 封存所有完成 | POST | `/api/v1/tasks/archive-all-done` |
| 累積工時 | GET | `/api/v1/tasks/:id/total-time` |
| **時間紀錄** | | |
| 列出 | GET | `/api/v1/timeslots` |
| 新增 | POST | `/api/v1/timeslots` |
| 更新 | PATCH | `/api/v1/timeslots/:id` |
| 刪除 | DELETE | `/api/v1/timeslots/:id` |
| **待辦** | | |
| 列出 | GET | `/api/v1/todos` |
| 新增 | POST | `/api/v1/todos` |
| 更新 | PATCH | `/api/v1/todos/:id` |
| 切換完成 | POST | `/api/v1/todos/:id/toggle` |
| 刪除 | DELETE | `/api/v1/todos/:id` |
| 清除已完成 | POST | `/api/v1/todos/clear-done` |
| **設定** | | |
| 讀取/更新設定 | GET/PATCH | `/api/v1/settings` |
| 主分類 CRUD | GET/POST/PATCH/DELETE | `/api/v1/categories/main[/:name]` |
| 子分類 CRUD | GET/POST/PATCH/DELETE | `/api/v1/categories/sub[/:name]` |
| 產出類型 CRUD | GET/POST/PATCH/DELETE | `/api/v1/output-types[/:id]` |
| 假日 CRUD | GET/POST/DELETE | `/api/v1/holidays[/:date]` |
| 成員 CRUD | GET/POST/PATCH/DELETE | `/api/v1/members[/:id]` |
| **報告** | | |
| 週報 | GET | `/api/v1/reports/weekly` |
| 雙月報 | GET | `/api/v1/reports/bi-monthly` |
| 半年報 | GET | `/api/v1/reports/half-year` |
| 行事曆 ICS | GET | `/api/v1/reports/calendar.ics` |
| **資料管理** | | |
| 完整匯出 | GET | `/api/v1/data/export` |
| 完整匯入（取代） | POST | `/api/v1/data/import` |
| 智慧合併 | POST | `/api/v1/data/merge` |
| 僅匯入設定 | POST | `/api/v1/data/import-settings` |
| **即時事件** | | |
| SSE 事件串流 | GET | `/system/events?token=<TOKEN>` |
