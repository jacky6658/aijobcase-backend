# CaseFlow 後端 API 服務

AI 案件管理系統的後端 API，連接 PostgreSQL 資料庫。

## 🚀 快速開始

### Zeabur 部署（推薦）

1. 在 Zeabur 創建新的 Node.js 服務
2. 連接 GitHub repo：`jacky6658/aijobcase-backend`
3. 連接 PostgreSQL 資料庫（Zeabur 會自動提供環境變數）
4. 部署完成！

**線上 API：** https://aijobcasebackend.zeabur.app

### 本地開發

```bash
cd aijobcase-backend
npm install
npm run dev  # 開發模式（自動重啟）
```

環境變數（`.env`）：
```env
POSTGRES_HOST=your-host
POSTGRES_DATABASE=your-db
POSTGRES_USER=your-user
POSTGRES_PASSWORD=your-password
PORT=3001
```

---

## 🤖 AI 助理專用 API

這些 API 專為 AI 助理（YuQi）設計，支援用 `case_code` 識別案件。

### 1. 匯入案件
```http
POST /api/ai/import
Content-Type: application/json

{
  "platform": "PRO360",
  "platform_id": "客戶名稱",
  "need": "案件需求描述",
  "email": "client@email.com",
  "location": "台北市",
  "budget_text": "5萬-10萬",
  "contact_method": "電話或網路",
  "note": "備註內容"
}
```

**回應：**
```json
{
  "message": "成功匯入 1 筆案件",
  "imported": 1,
  "results": {
    "success": [{ "id": "xxx", "case_code": "aijob-001", "need": "..." }]
  }
}
```

### 2. 查詢案件
```http
GET /api/ai/leads?status=待匯入&limit=20
```

### 3. 修改案件
```http
PUT /api/ai/update
Content-Type: application/json

{
  "case_code": "aijob-001",
  "updates": {
    "status": "已接洽",
    "note": "新備註",
    "budget_text": "確認 5 萬"
  }
}
```

### 4. 刪除案件
```http
DELETE /api/ai/delete
Content-Type: application/json

{
  "case_code": "aijob-001"
}
```

### 5. 新增進度更新
```http
POST /api/ai/progress
Content-Type: application/json

{
  "case_code": "aijob-001",
  "content": "進度內容...\n可以多行"
}
```

### 6. 匯入成本
```http
POST /api/ai/cost
Content-Type: application/json

{
  "case_code": "aijob-001",
  "item_name": "Pro360 索取個資成本",
  "amount": 322,
  "note": "備註（可選）"
}
```

### 7. 匯入利潤
```http
POST /api/ai/profit
Content-Type: application/json

{
  "case_code": "aijob-001",
  "item_name": "專案收入",
  "amount": 50000,
  "note": "第一期款"
}
```

### 8. 上傳附件
```http
POST /api/ai/attachment
Content-Type: application/json

{
  "case_code": "aijob-001",
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "filename": "screenshot.jpg"
}
```

---

## 📋 AI 助理工作流程

當 Jacky 傳 Pro360 截圖時，AI 助理應執行：

1. **識別截圖內容** → 提取客戶資訊
2. **匯入案件** → `POST /api/ai/import`
3. **匯入成本** → `POST /api/ai/cost`（Pro360 索取個資成本 = 聯繫費用）
4. **新增進度** → `POST /api/ai/progress`（如果有備註）
5. **上傳附件** → `POST /api/ai/attachment`（可選）

**範例：**
```
Jacky: [Pro360 截圖] + "備註：客戶想要 AI 導入..."

AI 助理執行：
1. POST /api/ai/import → aijob-023
2. POST /api/ai/cost → Pro360 索取個資成本 322元
3. POST /api/ai/progress → 備註內容
```

---

## 📡 其他 API 端點

### 使用者
- `GET /api/users` - 獲取所有使用者
- `GET /api/users/:uid` - 獲取單個使用者
- `POST /api/users` - 創建使用者
- `PUT /api/users/:uid` - 更新使用者

### 案件（前端用）
- `GET /api/leads` - 獲取所有案件
- `POST /api/leads` - 創建案件
- `PUT /api/leads/:id` - 更新案件
- `DELETE /api/leads/:id` - 刪除案件

### 審計日誌
- `GET /api/audit-logs` - 獲取審計日誌
- `GET /api/audit-logs?leadId=xxx` - 獲取特定案件日誌

### 系統
- `GET /` - API 資訊
- `GET /health` - 健康檢查
- `POST /api/migrate` - 資料遷移

---

## 🔧 技術棧

- Node.js + Express
- PostgreSQL（Zeabur 託管）
- CORS 支援所有來源

## 📂 相關專案

- **前端**：https://github.com/jacky6658/aijobcaseflaw
- **後端**：https://github.com/jacky6658/aijobcase-backend

---

*Last updated: 2026-02-10 by AI 助理 (YuQi) 🦞*
