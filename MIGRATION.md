# 遷移指南：1.0.0（Netlify）→ 2.0.0（本機）

本文件適用對象：原本使用 Netlify 網址存取 WorkScope Planner 1.0.0，現在想改為在自己電腦上安裝並使用 2.0.0 版的使用者。

---

## 目錄

1. [兩個版本的核心差異](#1-兩個版本的核心差異)
2. [前置需求](#2-前置需求)
3. [步驟一：從 Netlify 匯出你的資料](#3-步驟一從-netlify-匯出你的資料)
4. [步驟二：安裝 Node.js](#4-步驟二安裝-nodejs)
5. [步驟三：下載程式碼](#5-步驟三下載程式碼)
6. [步驟四：安裝依賴套件](#6-步驟四安裝依賴套件)
7. [步驟五：匯入舊資料](#7-步驟五匯入舊資料)
8. [步驟六：啟動與日常使用](#8-步驟六啟動與日常使用)
9. [選用：設定 AI 工具（MCP）](#9-選用設定-ai-工具mcp)
10. [常見問題](#10-常見問題)

---

## 1. 兩個版本的核心差異

| | 1.0.0（Netlify） | 2.0.0（本機） |
|---|---|---|
| 開啟方式 | 直接開網址，隨時可用 | 每次使用前需在電腦上啟動程式 |
| 資料存在哪 | 瀏覽器自己的儲存空間（localStorage） | 本機檔案 `~/.task-time-tracker/data.json` |
| 跨裝置同步 | ❌ 不支援（資料鎖在同一個瀏覽器） | ❌ 不支援（資料在本機） |
| 自動備份 | ❌ 無 | ✅ 每天自動備份，保留 7 份 |
| AI 對話操作 | ❌ 無 | ✅ 支援 Claude Code / Claude Desktop MCP 工具 |
| 安裝需求 | 無需任何安裝 | 需要安裝 Node.js |

**重要提醒**：2.0.0 不再支援 Netlify 雲端部署，必須在自己的電腦上運行。

---

## 2. 前置需求

- 一台 macOS 或 Windows 電腦（Linux 也可）
- 能打開終端機（Terminal / 命令提示字元 / PowerShell）
- 約 500 MB 的可用磁碟空間

---

## 3. 步驟一：從 Netlify 匯出你的資料

> **這個步驟務必先做**，之後 Netlify 網址仍可繼續開啟，所以先匯出不會影響你的使用。

1. 打開原本的 Netlify 網址
2. 點左側導覽列的 **系統設定**（齒輪圖示）
3. 找到「**系統資料備份與還原**」區塊
4. 點擊 **匯出完整資料** 按鈕
5. 瀏覽器會下載一個名稱類似 `task_tracker_backup_2026-05-02.json` 的檔案
6. 記住這個檔案存在哪裡（通常在「下載」資料夾）

---

## 4. 步驟二：安裝 Node.js

### macOS

**推薦使用官網安裝包（最簡單）：**

1. 前往 https://nodejs.org/
2. 點擊 **LTS** 版本的下載按鈕（目前為 v22.x）
3. 執行下載的 `.pkg` 檔案，一路按「繼續」安裝
4. 開啟「終端機」（在 Spotlight 搜尋 `Terminal`），輸入以下指令確認安裝成功：

```bash
node --version
```

若顯示 `v20.x.x` 或更新的版本號即代表成功。

### Windows

1. 前往 https://nodejs.org/
2. 點擊 **LTS** 版本的下載按鈕
3. 執行下載的 `.msi` 安裝程式，一路按「Next」安裝（保持預設選項即可）
4. 安裝完成後開啟「命令提示字元」（在開始選單搜尋 `cmd`），輸入：

```bash
node --version
```

顯示版本號即代表成功。

---

## 5. 步驟三：下載程式碼

### 方式 A：使用 Git（有安裝 Git 的話）

```bash
git clone https://github.com/oriole0105/task-wp-tracker-pro.git
cd task-wp-tracker-pro/task-time-tracker
```

### 方式 B：直接下載 ZIP（不需要 Git）

1. 前往 https://github.com/oriole0105/task-wp-tracker-pro
2. 點擊綠色 **Code** 按鈕 → **Download ZIP**
3. 解壓縮後，進入 `task-wp-tracker-pro-main/task-time-tracker/` 資料夾

---

## 6. 步驟四：安裝依賴套件

在終端機中，確認你在 `task-time-tracker/` 目錄下，然後執行：

```bash
npm install
```

這會下載所有必要的程式庫，約需 1～2 分鐘，出現 `added XXX packages` 字樣即代表完成。

---

## 7. 步驟五：匯入舊資料

有兩種方式，擇一即可。

### 方式 A：指令匯入（推薦，在啟動 server 之前執行）

將以下指令中的路徑替換為你在步驟一下載的 JSON 檔案實際路徑：

**macOS / Linux：**
```bash
npm -w packages/server run tt -- import ~/Downloads/task_tracker_backup_2026-05-02.json
```

**Windows（命令提示字元）：**
```bash
npm -w packages/server run tt -- import C:\Users\你的名字\Downloads\task_tracker_backup_2026-05-02.json
```

看到 `✓ 已匯入資料` 字樣即代表成功。

---

### 方式 B：從網頁介面匯入

1. 先啟動程式（見下方步驟六）
2. 用瀏覽器開啟 `http://localhost:5173`
3. 進入 **系統設定** → **系統資料備份與還原**
4. 點擊 **還原備份資料**，選擇步驟一下載的 JSON 檔案
5. 確認匯入

---

## 8. 步驟六：啟動與日常使用

### 每次使用前，執行這個指令：

```bash
npm run dev
```

終端機會顯示類似以下的訊息，代表啟動成功：

```
[web] Local:   http://localhost:5173/
[api] 🚀 task-time-tracker server running at http://127.0.0.1:5174
```

接著用瀏覽器開啟 **http://localhost:5173** 即可正常使用。

### 停止程式

在終端機視窗按 `Ctrl + C`（macOS / Windows 皆同）。

> **注意**：終端機視窗關閉或電腦關機後，程式會停止。下次使用前需要重新執行 `npm run dev`。

### 確認資料已成功遷移

啟動後，在任務管理頁面確認原本的任務都在。如果一切正常，Netlify 上的舊版本你可以繼續保留，或通知管理員移除。

---

## 9. 選用：設定 AI 工具（MCP）

2.0.0 版本新增了 AI 對話操作功能，讓你可以直接用對話指示 AI 新增任務、查詢進度、產生週報等，不需要打開瀏覽器。支援以下兩種工具：

> **前置條件**：必須先完成前面所有步驟（程式碼已下載、可以正常 `npm run dev` 啟動）。

---

### 選項 A：Claude Code（命令列工具）

**安裝 Claude Code：**

```bash
npm install -g @anthropic-ai/claude-code
```

**註冊 MCP server（只需做一次）：**

在 `task-time-tracker/` 目錄下，先啟動 server（`npm run dev`），再執行：

```bash
npm -w packages/mcp run print-config
```

這會印出一段 JSON 設定和對應的 `claude mcp add` 指令，照著執行即可。

**日常使用：**

1. 執行 `npm run dev` 啟動 server
2. 在任意目錄執行 `claude` 開啟 Claude Code
3. 直接用中文對話，例如：
   - 「列出所有進行中的任務」
   - 「幫我新增一個叫做『準備報告』的任務，分類是會議」
   - 「產生本週週報」

---

### 選項 B：Claude Desktop（桌面應用程式）

適合不想用命令列的使用者。

**安裝 Claude Desktop：**

前往 https://claude.ai/download，下載並安裝桌面應用程式。

**取得 MCP 設定：**

在 `task-time-tracker/` 目錄下，先啟動 server（`npm run dev`），再執行：

```bash
npm -w packages/mcp run print-config
```

會印出類似以下的 JSON：

```json
{
  "mcpServers": {
    "task-time-tracker": {
      "command": "/path/to/tsx",
      "args": ["/path/to/packages/mcp/src/index.ts"],
      "env": {
        "TT_API_URL": "http://127.0.0.1:5174",
        "TT_TOKEN": "你的token"
      }
    }
  }
}
```

**設定 Claude Desktop：**

找到 Claude Desktop 的設定檔並編輯（如果不存在請自行建立）：

- **macOS**：`~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**：`%APPDATA%\Claude\claude_desktop_config.json`

將 `print-config` 輸出的 `mcpServers` 區塊貼入設定檔後儲存。若檔案原本是空的，格式如下：

```json
{
  "mcpServers": {
    "task-time-tracker": {
      ...（貼入 print-config 的內容）
    }
  }
}
```

**啟用：**

完全關閉 Claude Desktop 後重新開啟，在對話視窗左下角出現 🔌 圖示，代表 MCP 已連線。

**日常使用：**

1. 執行 `npm run dev` 啟動 server
2. 打開 Claude Desktop
3. 直接用對話操作，例如：
   - 「幫我看看本週有哪些任務還沒完成」
   - 「把任務『準備報告』狀態改為進行中」
   - 「產生這個月的雙月盤點報告」

---

## 10. 常見問題

**Q：啟動後瀏覽器顯示橘色橫幅「伺服器離線，目前為唯讀模式」**

代表 API server 沒有啟動或啟動失敗。請確認：

1. 在終端機有執行 `npm run dev`（不是只有 `npm run dev:web`）
2. 終端機有出現 `🚀 task-time-tracker server running` 的訊息
3. 沒有其他程式佔用 port 5174

**Q：匯入資料後任務都不見了**

請確認匯入的 JSON 檔案是從 1.0.0 的「**匯出完整資料**」功能產生的（不是 CSV、不是設定匯出）。檔案內容應包含 `tasks`、`timeslots` 等欄位。

可以用以下指令確認目前資料狀態：

```bash
npm -w packages/server run tt -- status
```

**Q：每次都要打 `npm run dev` 很麻煩，可以開機自動啟動嗎？**

可以，但設定較複雜。簡單替代方案是在桌面建立一個捷徑或 shell script，雙擊即可啟動。如有需要可另行查詢說明。

**Q：MCP 工具顯示「找不到 token」**

請先確認 server 至少啟動過一次（`npm run dev`），token 是在第一次啟動時自動產生的。產生後再執行 `npm -w packages/mcp run print-config` 即可取得含正確 token 的設定。

**Q：可以同時在兩台電腦上使用嗎？**

2.0.0 的資料存在本機，不支援跨裝置同步。如需要在多台電腦使用，需手動透過「匯出完整資料」→「匯入」的方式同步，或使用 Dropbox / iCloud 等工具同步 `~/.task-time-tracker/` 資料夾（進階用法，不保證穩定）。

**Q：我不想用 2.0.0，可以繼續用 Netlify 上的 1.0.0 嗎？**

可以，1.0.0 的 Netlify 部署不受影響，你可以繼續使用。只是無法享受 2.0.0 的自動備份與 AI 工具整合功能。
