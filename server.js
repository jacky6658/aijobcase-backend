/**
 * 簡單的後端 API 服務
 * 連接 PostgreSQL 並提供 REST API
 * 
 * 部署到 Zeabur 時，Zeabur 會自動提供資料庫連接環境變數
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// 中間件
app.use(cors());
app.use(express.json());

// PostgreSQL 連接池
const pool = new Pool({
  host: process.env.DB_HOST || process.env.POSTGRES_HOST,
  port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
  database: process.env.DB_NAME || process.env.POSTGRES_DATABASE,
  user: process.env.DB_USER || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
  ssl: process.env.DB_SSL === 'true' || process.env.POSTGRES_SSL === 'true' 
    ? { rejectUnauthorized: false } 
    : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

// 測試資料庫連接
pool.on('connect', () => {
  console.log('✅ 已連接到 PostgreSQL 資料庫');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 連接錯誤:', err);
});

// 啟動時測試連接
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ PostgreSQL 連接測試成功');
  })
  .catch((err) => {
    console.error('❌ PostgreSQL 連接測試失敗:', err.message);
    console.error('連接資訊:', {
      host: process.env.DB_HOST || process.env.POSTGRES_HOST || '未設置',
      database: process.env.DB_NAME || process.env.POSTGRES_DATABASE || '未設置',
      user: process.env.DB_USER || process.env.POSTGRES_USER || '未設置',
      hasPassword: !!(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD)
    });
  });

// ==================== 使用者 API ====================

// 獲取所有使用者
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const users = {};
    result.rows.forEach(row => {
      users[row.id] = {
        uid: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        avatar: row.avatar,
        status: row.status,
        createdAt: row.created_at,
        isActive: true // 預設為啟用
      };
    });
    res.json(users);
  } catch (error) {
    console.error('獲取使用者失敗:', error);
    console.error('錯誤詳情:', error.message, error.stack);
    res.status(500).json({ 
      error: '獲取使用者失敗',
      details: error.message,
      hint: '請檢查資料庫連接和表結構'
    });
  }
});

// 獲取單個使用者
app.get('/api/users/:uid', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.uid]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '使用者不存在' });
    }
    const row = result.rows[0];
    res.json({
      uid: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      avatar: row.avatar,
      status: row.status,
      createdAt: row.created_at
    });
  } catch (error) {
    console.error('獲取使用者失敗:', error);
    res.status(500).json({ error: '獲取使用者失敗' });
  }
});

// ==================== 案件 API ====================

// 獲取所有案件
app.get('/api/leads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    const leads = result.rows.map(row => {
      // 處理 JSONB 欄位
      let progress_updates = [];
      let change_history = [];
      
      try {
        if (row.progress_updates) {
          progress_updates = typeof row.progress_updates === 'string' 
            ? JSON.parse(row.progress_updates) 
            : row.progress_updates;
        }
      } catch (e) {
        console.warn('解析 progress_updates 失敗:', e);
      }
      
      try {
        if (row.change_history) {
          change_history = typeof row.change_history === 'string'
            ? JSON.parse(row.change_history)
            : row.change_history;
        }
      } catch (e) {
        console.warn('解析 change_history 失敗:', e);
      }

      return {
        id: row.id,
        platform: row.platform,
        platform_id: row.platform_id || '',
        need: row.need || '',
        budget_text: row.budget_text || null,
        posted_at: row.posted_at ? new Date(row.posted_at).toISOString() : null,
        phone: row.phone || null,
        email: row.email || null,
        location: row.location || null,
        note: row.note || null,
        internal_remarks: row.internal_remarks || null,
        remarks_author: row.remarks_author || null,
        status: row.status || '待篩選',
        decision: row.decision || 'pending',
        decision_by: row.decision_by || null,
        reject_reason: row.reject_reason || null,
        review_note: row.review_note || null,
        assigned_to: row.assigned_to || null,
        assigned_to_name: row.assigned_to_name || null,
        priority: row.priority || 3,
        created_by: row.created_by || null,
        created_by_name: row.created_by_name || '',
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
        last_action_by: row.last_action_by || null,
        progress_updates: progress_updates,
        change_history: change_history,
        links: [], // 如果需要，可以從其他表讀取
        contact_status: '未回覆' // 預設值
      };
    });
    res.json(leads);
  } catch (error) {
    console.error('獲取案件失敗:', error);
    console.error('錯誤詳情:', error.message, error.stack);
    res.status(500).json({ 
      error: '獲取案件失敗',
      details: error.message,
      hint: '請檢查資料庫連接和表結構'
    });
  }
});

// 創建案件
app.post('/api/leads', async (req, res) => {
  try {
    const lead = req.body;
    const now = new Date().toISOString();
    
    const result = await pool.query(`
      INSERT INTO leads (
        id, platform, platform_id, need, budget_text, posted_at,
        phone, email, location, note, internal_remarks, remarks_author,
        status, decision, priority, created_by, created_by_name,
        created_at, updated_at, progress_updates, change_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [
      lead.id,
      lead.platform || 'FB',
      lead.platform_id || '',
      lead.need || '',
      lead.budget_text || null,
      lead.posted_at || null,
      lead.phone || null,
      lead.email || null,
      lead.location || null,
      lead.note || null,
      lead.internal_remarks || null,
      lead.remarks_author || null,
      lead.status || '待篩選',
      lead.decision || 'pending',
      lead.priority || 3,
      lead.created_by || null,
      lead.created_by_name || '',
      lead.created_at || now,
      lead.updated_at || now,
      lead.progress_updates ? JSON.stringify(lead.progress_updates) : null,
      lead.change_history ? JSON.stringify(lead.change_history) : null
    ]);
    
    res.json({ id: result.rows[0].id });
  } catch (error) {
    console.error('創建案件失敗:', error);
    res.status(500).json({ error: '創建案件失敗' });
  }
});

// 更新案件
app.put('/api/leads/:id', async (req, res) => {
  try {
    const updates = req.body;
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      if (key === 'progress_updates' || key === 'change_history') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key] ? JSON.stringify(updates[key]) : null);
      } else if (key !== 'id') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
      }
      paramIndex++;
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: '沒有要更新的欄位' });
    }
    
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE leads SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新案件失敗:', error);
    res.status(500).json({ error: '更新案件失敗' });
  }
});

// 刪除案件
app.delete('/api/leads/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('刪除案件失敗:', error);
    res.status(500).json({ error: '刪除案件失敗' });
  }
});

// ==================== 審計日誌 API ====================

// 獲取審計日誌
app.get('/api/audit-logs', async (req, res) => {
  try {
    const leadId = req.query.leadId;
    let query = 'SELECT * FROM audit_logs';
    let params = [];
    
    if (leadId) {
      query += ' WHERE lead_id = $1';
      params.push(leadId);
    }
    
    query += ' ORDER BY created_at DESC LIMIT 500';
    
    const result = await pool.query(query, params);
    const logs = result.rows.map(row => ({
      id: row.id,
      lead_id: row.lead_id,
      actor_uid: row.actor_uid,
      actor_name: row.actor_name,
      action: row.action,
      before: row.before ? JSON.parse(row.before) : null,
      after: row.after ? JSON.parse(row.after) : null,
      created_at: row.created_at
    }));
    
    res.json(logs);
  } catch (error) {
    console.error('獲取審計日誌失敗:', error);
    res.status(500).json({ error: '獲取審計日誌失敗' });
  }
});

// 根路徑 - API 資訊
app.get('/', (req, res) => {
  res.json({
    name: 'CaseFlow CRM API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      users: {
        getAll: 'GET /api/users',
        getOne: 'GET /api/users/:uid'
      },
      leads: {
        getAll: 'GET /api/leads',
        create: 'POST /api/leads',
        update: 'PUT /api/leads/:id',
        delete: 'DELETE /api/leads/:id'
      },
      auditLogs: {
        getAll: 'GET /api/audit-logs',
        getByLead: 'GET /api/audit-logs?leadId=xxx'
      }
    },
    database: {
      host: process.env.DB_HOST || process.env.POSTGRES_HOST || '未設置',
      database: process.env.DB_NAME || process.env.POSTGRES_DATABASE || '未設置',
      connected: '檢查 /health 端點'
    }
  });
});

// 診斷端點 - 檢查資料庫狀態
app.get('/api/diagnose', async (req, res) => {
  const diagnostics = {
    database: {
      connected: false,
      error: null,
      config: {
        host: process.env.DB_HOST || process.env.POSTGRES_HOST || '未設置',
        database: process.env.DB_NAME || process.env.POSTGRES_DATABASE || '未設置',
        user: process.env.DB_USER || process.env.POSTGRES_USER || '未設置',
        hasPassword: !!(process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD)
      }
    },
    tables: {
      users: { exists: false, count: 0, error: null },
      leads: { exists: false, count: 0, error: null },
      audit_logs: { exists: false, count: 0, error: null }
    },
    timestamp: new Date().toISOString()
  };

  try {
    // 測試連接
    await pool.query('SELECT 1');
    diagnostics.database.connected = true;

    // 檢查表是否存在並統計資料
    const tables = ['users', 'leads', 'audit_logs'];
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        diagnostics.tables[table] = {
          exists: true,
          count: parseInt(result.rows[0].count),
          error: null
        };
      } catch (err) {
        diagnostics.tables[table] = {
          exists: false,
          count: 0,
          error: err.message
        };
      }
    }
  } catch (error) {
    diagnostics.database.connected = false;
    diagnostics.database.error = error.message;
  }

  res.json(diagnostics);
});

// 健康檢查
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    
    // 檢查表是否存在
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'leads', 'audit_logs')
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    
    res.json({ 
      status: 'ok', 
      database: 'connected',
      tables: {
        users: existingTables.includes('users'),
        leads: existingTables.includes('leads'),
        audit_logs: existingTables.includes('audit_logs')
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 後端 API 服務運行在 http://localhost:${port}`);
  console.log(`📊 資料庫: ${process.env.DB_NAME || process.env.POSTGRES_DATABASE || '未設置'}`);
  console.log(`📡 API 文檔: http://localhost:${port}/`);
  console.log(`❤️  健康檢查: http://localhost:${port}/health`);
});
