# Cloudflare 部署指南

本專案支援同時以兩種模式執行：

| 模式 | 說明 | 資料儲存 |
|---|---|---|
| **本機模式**（預設） | Node.js，`npm run dev` | `~/.task-time-tracker/data.json` |
| **雲端模式** | Cloudflare Workers + Pages | Cloudflare D1（SQLite） |

兩種模式共用同一份程式碼，切換只需改部署方式。

---

## 前置要求

- Node.js v20 以上
- Cloudflare 帳號（免費即可）
- `wrangler` CLI

```bash
npm install -g wrangler
wrangler login   # 開啟瀏覽器完成登入
```

---

## 部署 API Server（Cloudflare Workers）

### 步驟 1：建立 D1 資料庫

```bash
cd packages/server
wrangler d1 create task-time-tracker
```

執行後會輸出類似：

```
✅ Successfully created DB 'task-time-tracker'
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "task-time-tracker",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
    }
  ]
}
```

將 `database_id` 填入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "task-time-tracker"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← 填入這裡
```

### 步驟 2：建立資料表

```bash
wrangler d1 execute task-time-tracker --file=migrations/0001_init.sql
```

驗證：

```bash
wrangler d1 execute task-time-tracker --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 步驟 3：設定存取 Token

Token 是用來保護你的 API，只有持有 token 的人才能讀寫你的資料。

```bash
wrangler secret put TT_TOKEN
# 提示輸入 token，自行設定一組不易猜測的字串，例如：
# my-secret-token-2026
```

> **注意**：Token 不會寫入任何檔案，只存在 Cloudflare 的加密環境變數中。

### 步驟 4：部署 Workers

```bash
wrangler deploy
```

部署成功後會顯示 Worker URL，類似：

```
https://task-time-tracker.your-name.workers.dev
```

### 步驟 5：驗證部署

```bash
curl https://task-time-tracker.your-name.workers.dev/system/health
# 應回傳：{"ok":true,"data":{"status":"ok","schemaVersion":3,"bootstrapRequired":true}}
```

---

## 部署 Web UI（Cloudflare Pages）

Web UI 是純靜態檔案，部署到 Cloudflare Pages。

### 方法 A：透過 GitHub（推薦）

1. 將專案 push 到 GitHub
2. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Create
3. 選擇 **Pages** → Connect to Git → 選擇你的 repo
4. 設定 Build：

   | 欄位 | 值 |
   |---|---|
   | Framework preset | `Vite` |
   | Build command | `npm run build -w packages/web` |
   | Build output directory | `packages/web/dist` |
   | Root directory | `/` |

5. 加入環境變數：

   | 變數 | 值 |
   |---|---|
   | `VITE_API_BASE` | `https://task-time-tracker.your-name.workers.dev` |

   > **重要**：Web UI 和 API Worker 是分開的服務，需要告訴 Web UI 去哪個 URL 呼叫 API。

6. 儲存並部署

### 方法 B：手動部署

```bash
# 在專案根目錄
npm run build

cd packages/web
wrangler pages deploy dist --project-name=task-time-tracker-web
```

---

## 跨域設定（CORS）

Web UI 和 API Worker 是不同網域，需確認 CORS 已正確設定。

目前 `packages/server/src/middleware/cors.ts` 已允許所有來源（`*`）。若要限制只允許你的 Pages 網域：

```typescript
// packages/server/src/middleware/cors.ts
allowOrigin: 'https://task-time-tracker-web.pages.dev',
```

修改後重新 `wrangler deploy`。

---

## 首次開啟 Web UI（雲端模式）

1. 開啟你的 Pages 網址
2. 系統偵測到是雲端模式（無法自動取得 token），會彈出 **Token 輸入 Dialog**
3. 輸入你在步驟 3 設定的 `TT_TOKEN`
4. 按確認，token 會存入瀏覽器 `localStorage`，之後不需要再輸入

> **忘記 token？** 需要在 Cloudflare Dashboard 重設 secret 或用 `wrangler secret put TT_TOKEN` 更新。

---

## MCP Server（AI 操作）

MCP server 維持在本機執行，只需改兩個環境變數指向雲端 API：

找到你的 Claude MCP 設定檔（`~/.claude/settings.json` 或 `~/.config/claude/settings.json`）：

```json
{
  "mcpServers": {
    "task-time-tracker": {
      "command": "node",
      "args": ["/path/to/task-time-tracker/packages/mcp/dist/index.js"],
      "env": {
        "TT_API_URL": "https://task-time-tracker.your-name.workers.dev",
        "TT_TOKEN": "your-token-here"
      }
    }
  }
}
```

重啟 Claude，MCP 工具即可操作雲端資料。

---

## 資料從本機搬到雲端

若你已有本機資料，可以用以下方式搬移：

```bash
# 1. 匯出本機資料
npm -w packages/server run tt -- export > my-data.json

# 2. 透過 API 匯入到雲端（server 已部署且有 token）
curl -X POST https://task-time-tracker.your-name.workers.dev/api/v1/data/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token-here" \
  -d @my-data.json
```

或在 Web UI 的「設定」頁面使用「匯入資料」功能。

---

## 費用說明

使用以下 Cloudflare 免費方案即可，**不需要信用卡**：

| 服務 | 免費額度 | 備註 |
|---|---|---|
| Workers | 10 萬 req/天 | 單人使用遠低於此 |
| D1 | 500 萬 row 讀/天、5GB | 綽綽有餘 |
| Pages | 無限頻寬、500 builds/月 | 完全免費 |

---

## 本機模式切換回來

本機部署完全不受影響，直接執行：

```bash
npm run dev
```

Web UI 會自動偵測本機 server（handshake 成功），不會顯示 Token Dialog。
