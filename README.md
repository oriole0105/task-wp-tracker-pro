# Task Time Tracker & WBS Management

這是一款結合了 **WBS 階層式任務管理** 與 **Outlook 風格垂直時間軸** 的高效工作追蹤系統。專為需要精確掌握工時分配與任務進度的專業人士設計。

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Material UI](https://img.shields.io/badge/Material--UI-0081CB?style=for-the-badge&logo=material-ui&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

## 🚀 核心功能

- **Outlook 式垂直時間軸 (Dashboard)**
  - 支援 **Day / Week (5D) / Week (7D)** 三種視圖切換。
  - **垂直縮放**：可在精簡模式 (60px/h) 與詳細模式 (120px/h) 間快速切換。
  - **5 分鐘捕捉**：精確的網格對齊，支援點擊即時編輯時間紀錄。
- **WBS 階層任務管理**
  - **自動編號**：動態產生如 `1.1.2` 的層級代碼，最高支援五階。
  - **分類繼承**：建立子任務時自動填入父項分類，減少重複輸入。
- **工作產出追蹤 (Work Outputs)**
  - 任務可關聯多個文件或產出名稱，並附帶 URL 或檔案路徑連結。
  - **行內進度編輯**：在 Output 頁面直接修改 0-100% 完成度。
- **視覺化分析報表**
  - 使用圓餅圖分析主/次分類的時間分佈。
  - 智慧時間格式化，自動顯示為 `Xd Xh Xm`。
- **本機伺服器 + AI 操作介面**
  - 資料儲存於本機 JSON 檔（`~/.task-time-tracker/data.json`），不依賴瀏覽器 LocalStorage。
  - 提供 **REST API**（Hono server，port 5174）與 **MCP server**，讓 Claude Desktop / Claude Code 不開瀏覽器也能操作任務、時間紀錄、產出與報告。
  - Bearer token 認證，僅 127.0.0.1 可存取，資料不對外暴露。
- **Cloudflare 雲端部署支援**
  - 同一份程式碼支援本機（Node.js）與雲端（Cloudflare Workers + D1）兩種部署模式。
  - 每位使用者自行部署，資料完全隔離，免費額度足夠個人使用。
  - MCP server 維持本機執行，改兩個環境變數即可操作雲端資料。

## 🛠️ 快速啟動

### 前置要求
- [Node.js](https://nodejs.org/) v20 以上版本
- npm

### 安裝步驟
1. 複製此專案到本地
   ```bash
   git clone <your-repository-url>
   cd task-time-tracker
   ```
2. 安裝依賴套件
   ```bash
   npm install
   ```
3. 啟動開發伺服器（同時啟動 Web UI 與 API server）
   ```bash
   npm run dev
   ```
4. 開啟瀏覽器訪問 `http://localhost:5173`（API server 在 port 5174）

## 📖 相關文件

- **使用者手冊**: [USER_GUIDE.adoc](./USER_GUIDE.adoc) - 詳細的功能說明與操作教學。
- **AI 操作指南**: [docs/HUMAN_GUIDE.md](./docs/HUMAN_GUIDE.md) - 如何透過 Claude 以自然語言操作系統。
- **MCP 工具手冊**: [docs/MCP_MANUAL.md](./docs/MCP_MANUAL.md) - 所有 MCP 工具的參數說明與範例。
- **Cloudflare 部署指南**: [docs/CLOUDFLARE_DEPLOY.md](./docs/CLOUDFLARE_DEPLOY.md) - 完整雲端部署步驟。
- **產品介紹簡報**: [PRESENTATION.md](./PRESENTATION.md) - 使用 Marp 撰寫的介紹投影片。

## 📝 技術堆疊

- **Frontend**: React 19 + Vite (rolldown-vite)、TypeScript、Material UI v7、Zustand、Recharts、date-fns
- **Backend**: Hono + Node.js（REST API server）
- **AI 整合**: MCP server（`@modelcontextprotocol/sdk`）
- **Monorepo**: npm workspaces（`packages/web`、`packages/server`、`packages/mcp`、`packages/shared`）

## 📄 授權說明
本專案採用 MIT 授權條款。