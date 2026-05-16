# task-time-tracker — Claude 行為準則

## 專案說明

這是一個結合 WBS 任務管理、時間軸工時記錄的本機應用。
- **Web UI**：React 19 + Vite，`http://localhost:5173`
- **API server**：Hono，`http://localhost:5174`（需先 `npm run dev`）
- **MCP server**：透過 stdio 連接，工具名稱見 `docs/MCP_MANUAL.md`
- **資料**：`~/.task-time-tracker/data.json`

## 指令

在 `task-time-tracker/` 目錄下執行：

```bash
npm run dev      # 同時啟動 Web UI（5173）與 API server（5174）
npm run build    # 確認 TypeScript + Vite build 通過
npm run lint     # ESLint
```

**任何程式碼改動後，必須先跑 `npm run build` 並修正所有錯誤。**

## 任務管理 AI 行為（永遠生效）

使用者在這個 project 下的對話，可能包含**任務管理操作**（新增任務、補登時間、查看進度、產生週報等）。
遇到這類需求時，不需要等使用者啟動任何 skill，直接依下列原則處理：

### 核心互動原則

1. **先問後動**：必要參數不足時，一次詢問所有缺少的資訊，再執行 MCP 工具
2. **ID 不讓使用者猜**：需要任務 ID 時，先 `task_search` 或 `task_list` 找到，不要叫使用者提供 ID
3. **破壞性操作必須確認**：`task_delete`、`task_archive`、`data_import` 前先向使用者確認
4. **分類不確定時先查**：先 `settings_get` 列出可用的主分類或子分類，讓使用者選
5. **簡潔回應**：操作成功後一句話說明結果，不貼出完整 JSON

### 任務狀態對照

| 使用者說的 | status 值 |
|---|---|
| 還沒想好 | `BACKLOG` |
| 待處理 / 還沒開始 | `TODO` |
| 進行中 | `IN_PROGRESS` |
| 暫停（需附原因）| `PAUSED` |
| 完成 | `DONE` |
| 取消 | `CANCELLED` |

### 時間記錄

補登時間需要：`startTime`、`endTime`（格式 `YYYY-MM-DDTHH:MM:SS`）、任務（可選）、`subCategory`（可選）。
使用者說「今天上午 9 點到 11 點半」，自動換算為今天日期的對應 ISO 時間。

## 可用 Skill

| 指令 | 用途 |
|---|---|
| `/task-tracker` | 完整操作模式，含所有工具的詳細劇本 |
| `/今日` | 早上開工：顯示今日任務、待辦、已記錄工時 |
| `/收工` | 下班前：引導補齊時間記錄、更新任務進度 |

完整 MCP 工具參考：`docs/MCP_MANUAL.md`  
人類使用者指南：`docs/HUMAN_GUIDE.md`

## 架構說明

- **Monorepo**：npm workspaces，子套件：`packages/web`、`packages/server`、`packages/mcp`、`packages/shared`
- **共用型別**：`packages/shared/src/types/index.ts`
- **WBS 工具**：`packages/shared/src/utils/wbs.ts`
- **報告邏輯**：`packages/shared/src/reports/`
