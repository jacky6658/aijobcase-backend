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
  port: process.env.DB_PORT || process.env.POSTGRES_PORT || 5432,
  database: process.env.DB_NAME || process.env.POSTGRES_DATABASE,
  user: process.env.DB_USER || process.env.POSTGRES_USER,
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// 測試資料庫連接
pool.on('connect', () => {
  console.log('✅ 已連接到 PostgreSQL 資料庫');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 連接錯誤:', err);
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
        createdAt: row.created_at
      };
    });
    res.json(users);
  } catch (error) {
    console.error('獲取使用者失敗:', error);
    res.status(500).json({ error: '獲取使用者失敗' });
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
    const leads = result.rows.map(row => ({
      id: row.id,
      platform: row.platform,
      platform_id: row.platform_id,
      need: row.need,
      budget_text: row.budget_text,
      posted_at: row.posted_at,
      phone: row.phone,
      email: row.email,
      location: row.location,
      note: row.note,
      internal_remarks: row.internal_remarks,
      remarks_author: row.remarks_author,
      status: row.status,
      decision: row.decision,
      decision_by: row.decision_by,
      reject_reason: row.reject_reason,
      review_note: row.review_note,
      assigned_to: row.assigned_to,
      assigned_to_name: row.assigned_to_name,
      priority: row.priority,
      created_by: row.created_by,
      created_by_name: row.created_by_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_action_by: row.last_action_by,
      progress_updates: row.progress_updates ? JSON.parse(row.progress_updates) : [],
      change_history: row.change_history ? JSON.parse(row.change_history) : [],
      links: [] // 如果需要，可以從其他表讀取
    }));
    res.json(leads);
  } catch (error) {
    console.error('獲取案件失敗:', error);
    res.status(500).json({ error: '獲取案件失敗' });
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

// 健康檢查
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 後端 API 服務運行在 http://localhost:${port}`);
  console.log(`📊 資料庫: ${process.env.DB_NAME || process.env.POSTGRES_DATABASE || '未設置'}`);
});
