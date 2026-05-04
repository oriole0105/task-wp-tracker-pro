# task-time-tracker 初次部署問題紀錄

日期：2026-05-02

---

## Issue 1：Web 一直顯示「伺服器離線」

**症狀**
開啟 `http://localhost:5173` 後顯示橘色橫幅「伺服器離線，目前為唯讀模式」，即使 server 已正常啟動。

**原因**
`packages/web/vite.config.ts` 完全沒有 proxy 設定。Web 發出的 `/system/health` 和 `/api/v1/*` 請求都打到 Vite dev server 本身（port 5173），沒有轉發到 API server（port 5174），導致全部失敗。

**解法**
在 `vite.config.ts` 加入：

```ts
server: {
  proxy: {
    '/api': 'http://127.0.0.1:5174',
    '/system': 'http://127.0.0.1:5174',
  },
},
```

加完後需重啟 `npm run dev` 才生效。

---

## Issue 2：遷移精靈未出現

**症狀**
Server 已啟動，但 web 沒有跳出遷移精靈（MigrationWizard）。

**原因**
`/system/health` 回傳 `bootstrapRequired: false`，代表 `~/.task-time-tracker/data.json` 已存在。該檔案是早期測試時建立的，內容是空的（0 個任務）。遷移精靈只有在 `bootstrapRequired: true`（檔案不存在）時才出現。

**解法**
刪除空的 data.json：

```bash
rm ~/.task-time-tracker/data.json
```

重新整理瀏覽器後，精靈就會出現。

---

## Issue 3：瀏覽器資料看似消失

**症狀**
重新整理後 web 顯示空白，25 個任務全不見。

**原因**
Stage 5 改版後，web 改從 server 讀取資料，不再讀 localStorage。舊 SPA 的資料（存在 localStorage 的 `task-storage` key）從未進過 server，所以 server 回傳空資料，看起來像消失。

**確認資料還在**
在瀏覽器 Console 執行（需先輸入 `allow pasting` 解鎖）：

```javascript
JSON.parse(localStorage.getItem('task-storage'))?.state?.tasks?.length
// 回傳 25，資料仍在 localStorage
```

**解法**
1. Console 執行：`copy(localStorage.getItem('task-storage'))` 複製資料到剪貼簿
2. 存成 `/tmp/old-data.json`
3. 用 CLI 匯入：

```bash
cd /path/to/task-time-tracker
npm -w packages/server run tt -- import /tmp/old-data.json
```

---

## Issue 4：CLI import 解析 localStorage 格式失敗

**症狀**
`tt import` 執行成功但匯入後 tasks 變 0。

**原因**
Zustand 的 localStorage 格式是 `{ state: { tasks: [...], ... }, version: 2 }`。CLI 的解析邏輯只處理了 server 的 StoredFile 格式（`{ data: {...} }`），遇到 `state` 鍵時直接把整包丟給 API，導致 server 收到空資料。

**解法**
修改 `packages/server/src/cli.ts` 的 `importCmd`，加入對 `state` 鍵的解析：

```ts
const p = parsed as Record<string, unknown>;
const payload =
  p && 'data' in p ? p['data'] :    // server StoredFile format
  p && 'state' in p ? p['state'] :  // Zustand localStorage format
  parsed;                            // bare AppData
```

---

## Issue 5：CLI 指令報錯 `No workspaces found`

**症狀**

```
npm error No workspaces found:
npm error   --workspace=packages/server
```

**原因**
npm workspace 指令需要在 monorepo 根目錄（有 `workspaces` 設定的 `package.json` 所在位置）執行，在其他目錄執行會找不到 workspace。

**解法**

```bash
cd /Users/oriole/Documents/0_AI/20260207_task_system/task-time-tracker
npm -w packages/server run tt -- status
```

---

## Issue 6：MCP 工具在舊 session 無法使用

**症狀**
`claude mcp list` 顯示 `task-time-tracker: ✓ Connected`，但在同一個對話中呼叫 MCP 工具時找不到。

**原因**
MCP 工具是在對話開始後才完成連線/新增的，Claude 在 session 啟動時載入工具清單，之後新增的工具不會自動載入到現有 session。

**解法**
開一個新的 Claude Code 對話，MCP 工具即可正常使用。

---

## 正確的首次啟動流程

1. 在 `task-time-tracker/` 目錄執行 `npm run dev`
2. 確認 terminal 出現兩行（web + api 都啟動）
3. 開啟 `http://localhost:5173`
4. 若看到遷移精靈 → 選「遷移舊資料」
5. 若 `data.json` 已存在但是空的 → 刪除後重新整理
6. 若需要手動匯入 → 從 Console `copy(localStorage.getItem('task-storage'))` 後用 `tt import` 匯入
