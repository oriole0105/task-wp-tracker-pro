---
marp: true
theme: default
paginate: true
backgroundColor: '#ffffff'
style: |
  section {
    font-family: 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif;
    font-size: 22px;
  }
  h1 {
    color: #1565c0;
    border-bottom: 3px solid #1565c0;
    padding-bottom: 8px;
  }
  h2 {
    color: #1976d2;
  }
  h3 {
    color: #2196f3;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
  .highlight {
    background: #e3f2fd;
    border-left: 4px solid #1976d2;
    padding: 8px 16px;
    border-radius: 4px;
    margin: 8px 0;
  }
  .tag {
    display: inline-block;
    background: #1976d2;
    color: white;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.8em;
    margin: 2px;
  }
  .tag-green { background: #388e3c; }
  .tag-orange { background: #f57c00; }
  .tag-purple { background: #7b1fa2; }
  table {
    font-size: 0.85em;
    width: 100%;
  }
  th { background: #1976d2; color: white; }
  td { border: 1px solid #bbdefb; }
---

<!-- _class: lead -->
<!-- _backgroundColor: #1565c0 -->
<!-- _color: white -->

# WorkScope Planner

## 任務規劃 × 時間追蹤 × 週報生成

一站式個人工作管理工具

---

# 為什麼需要 WorkScope Planner？

> 工作繁雜、進度難追蹤、週報耗時手寫……

<div class="columns">
<div>

**傳統痛點**
- 任務散落各處，難以掌握全貌
- 時間花在哪？事後難以回溯
- 週報要手動整理，費時又容易遺漏
- 甘特圖需要另開專業工具

</div>
<div>

**WorkScope Planner 的解法**
- WBS 階層任務管理，一覽無遺
- 時間紀錄自動累計，統計圖表即時呈現
- 一鍵生成 PlantUML 週報素材
- 甘特圖直接在瀏覽器產出

</div>
</div>

---

# 核心功能架構

```
WorkScope Planner
├── 任務管理      — WBS 階層 / 狀態追蹤 / 完成度
├── 排程視圖      — Outlook 式時間軸 / 時間紀錄
├── 工作產出      — 有形 / 無形產出追蹤
├── 統計報表      — 圓餅圖 / 任務節點篩選
├── 週報生成      — PlantUML WBS + 甘特圖 + 進度表
├── 封存庫        — 已完成任務歸檔
└── 系統設定      — 分類 / 人員 / 假日 / 備份
```

<div class="highlight">

**技術棧**：React 19 + TypeScript + MUI v7 + Zustand
**資料儲存**：全 localStorage，無需後端

</div>

---

# 任務管理 — WBS 五層階層

<div class="columns">
<div>

**任務核心欄位**

| 欄位 | 說明 |
|------|------|
| 標題 / 別名 | 別名顯示於時間軸 |
| 狀態 | BACKLOG → DONE |
| 完成度 % | 信心值 / 真實值 |
| 預估日期 | 開始 / 完成日 |
| 負責人 / 指派人 | 從人員名單選取 |
| 里程碑 | 含甘特圖標記 |

</div>
<div>

**任務狀態流程**

```
BACKLOG ──▶ TODO ──▶ IN_PROGRESS
                          │
               ┌──────────┴────────┐
             PAUSED           DONE / CANCELLED
```

**WBS 自動編號**
`1` → `1.1` → `1.1.2` → ...（最深 5 層）

</div>
</div>

---

# 任務管理 — 操作功能

<div class="columns">
<div>

**任務清單操作**
- 🔍 即時搜尋（名稱 / 別名 / 說明）
- 🏷 標籤篩選（最多 3 個自訂標籤）
- 📋 單鍵複製任務
- ↑↓←→ 調整 WBS 順序與層級
- 📦 批次 JSON 匯入（含子任務巢狀）
- ⚠️ 逾期任務紅色警示

</div>
<div>

**設定模式**（直接在表格內編輯）
- WBS 顯示開關
- 甘特圖模式（進度列 / 章節 / 隱藏）
- 預估日期
- 任務分類與狀態
- 完成度 %

**復原（Undo）**
- 最多 20 步環形快照
- 任意操作後皆可還原

</div>
</div>

---

# 排程視圖 — Outlook 式時間軸

<div class="columns">
<div>

**三種檢視模式**
- 📅 單日
- 📅 週 5 天
- 📅 週 7 天

**時間操作**
- 單擊時間方塊 → 編輯時間紀錄
- 雙擊時間方塊 → 開啟任務編輯
- 點擊空白格 → 快速新增時間紀錄

</div>
<div>

**Timeslot 特性**
- 頂層獨立實體（不隸屬於任務）
- 每筆含時間分類 + 自訂說明
- 支援「無連結任務」紀錄
- **時間重疊防護**：新增 / 編輯 / ICS 匯入皆自動阻擋

**ICS 整合**
- 單筆 / 批次匯出 `.ics`
- 匯入外部行事曆事件

</div>
</div>

---

# 統計報表 — 工時可視化

<div class="columns">
<div>

**雙圓餅圖**
- 依**任務分類**統計工時
- 依**時間分類**統計工時

**導覽模式**
- 日 / 週 快速切換
- 前後期導覽

</div>
<div>

**任務節點篩選**
- 選定任務節點後
- 自動收集**所有子孫任務**的 Timeslot
- 圓餅圖與總工時即時縮小範圍

**WBS Autocomplete 選擇器**
- 依層級縮排顯示
- 支援文字關鍵字搜尋

</div>
</div>

---

# 週報生成 — 三種報告類型

<div class="columns">
<div>

**報告類型**

| 類型 | 週期 |
|------|------|
| 週報 | 7 天 |
| 雙月盤點 | 2 個月 |
| 半年報 | 6 個月 |

**自動生成內容**
1. PlantUML **WBS 階層圖**（依狀態著色）
2. PlantUML **甘特圖**（三態顯示模式）
3. **進度追蹤表**（有進展 / 無進展分表）

</div>
<div>

**甘特圖功能**
- 進度列 / 章節標題 / 隱藏 三態模式
- 里程碑（◆ 鑽石標記）
- 今日 / 假日 顏色標記
- 時間刻度：每日 / 每週 / 每月
- 依主類別分組（可選）

**輸出格式**
- 複製 PlantUML 原始碼
- 複製 AsciiDoc 進度表
- 開新分頁另存 SVG

</div>
</div>

---

# 進度追蹤表 — 時程績效指數

每期自動對比**前期 vs 本期**完成度：

| 任務名稱 | 預期完成日 | 前期% | 本期% | 期間△ | 時程績效 SPI | 狀態 |
|---------|-----------|-------|-------|------|-------------|------|
| 功能 A 開發 | 03/31 | 60% | 75% | ↑ +15% | 🟢 正常 1.1 | 進行中 |
| 文件撰寫 | 03/15 | 30% | 30% | → 持平 | 🔴 嚴重落後 0.7 | 進行中 |

<div class="highlight">

**SPI = 實際完成度 ÷ 計畫進度**
- ≥ 1.0 🟢 正常 / 超前　• 0.8–1.0 🟠 落後　• < 0.8 🔴 嚴重落後

**完成度類型**：<span class="tag tag-orange">信 信心值</span> <span class="tag">真 真實值</span>

</div>

---

# 工作產出追蹤

<div class="columns">
<div>

**產出類型**

| 類型 | 性質 |
|------|------|
| 實體產出 | 有形（含連結）|
| 決策 | 無形（含摘要）|
| 知識 / 研究 | 無形 |
| 流程 / 規範 | 無形 |
| 其他 | 無形 |

</div>
<div>

**特色功能**
- `effectiveDate` 歸屬期間：週期型 vs 持續型
- 完成度快照（每週自動紀錄）
- 「複製為下期」一鍵 clone +7 天
- 「新增本期產出」從週報進度表直接添加
- 完成度趨勢折線圖（Recharts）

</div>
</div>

---

# 封存庫 & 系統設定

<div class="columns">
<div>

**封存庫 `/archive`**
- 已完成 / 已取消任務歸檔
- 批次封存（一鍵完成）
- 搜尋 / 分類篩選
- 還原或永久刪除
- 封存後時間統計資料仍保留

</div>
<div>

**系統設定**
- 📂 任務分類 / 時間分類管理
- 📦 工作產出類型管理
- 👥 人員名單（指派 / 負責人預填）
- 🗓 假日 / 個人休息日
- 💾 完整資料備份與還原（JSON）
- ⚙️ 設定備份（不含任務資料）
- 📱 **跨裝置資料同步**（差異匯出 / 合併匯入）
- 🤝 **任務交辦工作流**（交辦匯出 / 交辦匯入）

</div>
</div>

---

# 跨裝置同步 — 手機端使用

<div class="columns">
<div>

**第一次設定手機**

**方法 A：QR Code（推薦）**

1. 電腦端「系統設定」→ **顯示 QR Code**
2. 手機端「系統設定」→ **掃描 / 貼上匯入**
3. 鏡頭對準螢幕 → 自動匯入

**方法 B：複製文字**

1. 電腦端 → **複製 JSON 文字**
2. 透過 LINE / Email 傳到手機
3. 手機端「貼上文字」頁籤 → 貼上 → 匯入

</div>
<div>

**日常同步（手機 → 電腦）**

1. 手機記錄任務 / 時段
2. 「系統設定」→ **差異匯出**
   - 設定近 N 天（預設 7 天）
   - 可指定父節點，縮小匯出範圍
3. 系統呼叫分享選單
   → LINE / Email / AirDrop 傳送
4. 電腦端 → **合併匯入** → 完成

<div class="highlight">

同 ID 資料以較新版本覆蓋，新 ID 資料直接加入，不會產生重複

</div>

</div>
</div>

---

# 任務交辦工作流 — 主管與同仁協作

<div class="columns">
<div>

**協作流程（四步循環）**

```
① 主管建立任務
   ↓ 交辦匯出（JSON，不含時間紀錄）
② 同仁接收 → 交辦匯入
   拆解子任務 / 記錄個人 Timeslot
   ↓ 交辦匯出（含子任務 + 工作產出）
③ 主管收報 → 交辦匯入
   同 ID 自動合併，新子任務直接加入
```

</div>
<div>

**設計重點**

| 特性 | 說明 |
|------|------|
| 保留原始 Task ID | 確保每輪匯入可精確合併 |
| 僅含任務 + 工作產出 | 個人 Timeslot 絕不外流 |
| 無時間範圍限制 | 整棵子樹完整匯出 |
| 雙向皆可執行 | 主管 ↔ 同仁角色可互換 |

<div class="highlight">

**入口**：系統設定 → 任務交辦工作流
選擇根節點 → **交辦匯出** 或 **交辦匯入**

</div>

</div>
</div>

---

# 使用者體驗亮點

<div class="columns">
<div>

**介面設計**
- 🌙 深色 / 亮色主題切換
- 繁體中文全介面
- 響應式 MUI v7 元件
- WBS Autocomplete（含縮排 + 編號）

**資料操作**
- 批次 JSON 匯入任務（巢狀支援）
- ICS 匯入 / 匯出（RFC 5545）
- 完整 Undo（環形 20 步快照）
- 跨裝置同步：差異匯出 + 合併匯入
- 任務交辦：交辦匯出 + 交辦匯入（保留原始 ID、時間紀錄獨立）

</div>
<div>

**自動化邏輯**
- 任務重疊防護
- 父任務甘特列自動 Span 子任務範圍
- 新建任務自動預填負責人
- 完成度變動自動建立週快照
- 週報期間自動計算

**使用者手冊**
- AppBar `?` 按鈕內建 Markdown 手冊
- 主題自動切換，無需維護 HTML

</div>
</div>

---



# 快速上手

```bash
# 開發環境
cd task-time-tracker
npm run dev        # http://localhost:5173

# 生產建置
npm run build
npm run preview
```

**推薦工作流程**

1. **系統設定** → 建立任務分類、輸入人員名單
2. **任務管理** → 建立 WBS 任務樹、設定里程碑
3. **排程視圖** → 每日記錄時間 Timeslot
4. **週報生成** → 每週產出 PlantUML 素材 + 進度表
5. **封存庫** → 定期封存已完成任務

---

<!-- _class: lead -->
<!-- _backgroundColor: #1565c0 -->
<!-- _color: white -->

# WorkScope Planner

任務規劃 × 時間追蹤 × 週報生成

**一站式，不依賴後端，資料完全自主**

---
<!-- _backgroundColor: #1565c0 -->
<!-- _color: white -->

*製作日期：2026-03-15*
*版本：Unreleased（持續開發中）*
