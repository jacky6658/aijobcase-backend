# CaseFlow 後端 API 服務

這是連接 PostgreSQL 資料庫的後端 API 服務。

## 🚀 快速開始

### 本地開發

1. **安裝依賴**
```bash
cd backend
npm install
```

2. **設置環境變數**
創建 `.env` 文件：
```env
DB_HOST=tpe1.clusters.zeabur.com
DB_PORT=22704
DB_NAME=zeabur
DB_USER=root
DB_PASSWORD=your-password-here
PORT=3001
```

3. **啟動服務**
```bash
npm start
# 或開發模式（自動重啟）
npm run dev
```

### Zeabur 部署

1. **在 Zeabur 創建新的 Node.js 服務**
2. **連接 PostgreSQL 資料庫**（Zeabur 會自動提供環境變數）
3. **設置環境變數**（如果需要）：
   - `PORT` - 服務端口（Zeabur 會自動設置）
   - 資料庫連接變數（Zeabur 會自動提供）

## 📡 API 端點

### 使用者
- `GET /api/users` - 獲取所有使用者
- `GET /api/users/:uid` - 獲取單個使用者

### 案件
- `GET /api/leads` - 獲取所有案件
- `POST /api/leads` - 創建案件
- `PUT /api/leads/:id` - 更新案件
- `DELETE /api/leads/:id` - 刪除案件

### 審計日誌
- `GET /api/audit-logs` - 獲取審計日誌
- `GET /api/audit-logs?leadId=xxx` - 獲取特定案件的審計日誌

### 健康檢查
- `GET /health` - 檢查服務和資料庫連接狀態

## 🔧 環境變數

Zeabur 會自動提供以下環境變數：
- `POSTGRES_HOST` 或 `DB_HOST`
- `POSTGRES_PORT` 或 `DB_PORT`
- `POSTGRES_DATABASE` 或 `DB_NAME`
- `POSTGRES_USER` 或 `DB_USER`
- `POSTGRES_PASSWORD` 或 `DB_PASSWORD`
- `PORT` - 服務端口

## 📝 注意事項

- 此服務需要與前端應用程式配合使用
- 前端需要修改服務層代碼來調用此 API
- 確保資料庫連接資訊正確設置
