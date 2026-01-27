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
// 增加請求體大小限制到 50MB（用於遷移大量資料，包含 base64 圖片）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// PostgreSQL 連接池配置函數
const getDbConfig = () => {
  // 嘗試多種可能的環境變數名稱格式（Zeabur 可能使用不同的變數名）
  const host = process.env.POSTGRES_HOST || 
               process.env.DB_HOST || 
               process.env.DATABASE_HOST ||
               process.env.POSTGRESQL_HOST;
  
  const port = parseInt(
    process.env.POSTGRES_PORT || 
    process.env.DB_PORT || 
    process.env.DATABASE_PORT ||
    process.env.POSTGRESQL_PORT ||
    '5432'
  );
  
  const database = process.env.POSTGRES_DATABASE || 
                   process.env.DB_NAME || 
                   process.env.DATABASE_NAME ||
                   process.env.POSTGRESQL_DATABASE ||
                   process.env.POSTGRES_DB;
  
  const user = process.env.POSTGRES_USER || 
               process.env.DB_USER || 
               process.env.DATABASE_USER ||
               process.env.POSTGRESQL_USER ||
               process.env.POSTGRES_USERNAME;
  
  const password = process.env.POSTGRES_PASSWORD || 
                   process.env.DB_PASSWORD || 
                   process.env.DATABASE_PASSWORD ||
                   process.env.POSTGRESQL_PASSWORD;
  
  // 檢查是否所有必要的配置都存在
  if (!host || !database || !user || !password) {
    console.error('❌ 資料庫配置不完整:');
    console.error('  Host:', host || '未設置');
    console.error('  Database:', database || '未設置');
    console.error('  User:', user || '未設置');
    console.error('  Password:', password ? '***已設置***' : '未設置');
    console.error('\n可用的環境變數:');
    const dbEnvVars = Object.keys(process.env).filter(k => 
      k.includes('POSTGRES') || k.includes('DB') || k.includes('DATABASE')
    );
    if (dbEnvVars.length > 0) {
      console.error(dbEnvVars.join(', '));
    } else {
      console.error('(沒有找到資料庫相關的環境變數)');
    }
  }
  
  return {
    host,
    port,
    database,
    user,
    password,
    ssl: process.env.POSTGRES_SSL === 'true' || 
         process.env.DB_SSL === 'true' || 
         process.env.DATABASE_SSL === 'true' ||
         process.env.POSTGRESQL_SSL === 'true'
      ? { rejectUnauthorized: false } 
      : false,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10
  };
};

// PostgreSQL 連接池
const dbConfig = getDbConfig();
const pool = new Pool(dbConfig);

// 測試資料庫連接
pool.on('connect', () => {
  console.log('✅ 已連接到 PostgreSQL 資料庫');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL 連接錯誤:', err);
});

// 啟動時測試連接
setTimeout(() => {
  pool.query('SELECT NOW()')
    .then(() => {
      console.log('✅ PostgreSQL 連接測試成功');
      console.log('📊 資料庫連接資訊:', {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user,
        port: dbConfig.port,
        hasPassword: !!dbConfig.password,
        ssl: dbConfig.ssl ? '啟用' : '停用'
      });
    })
    .catch((err) => {
      console.error('❌ PostgreSQL 連接測試失敗:', err.message);
      console.error('📊 當前連接配置:', {
        host: dbConfig.host || '❌ 未設置',
        database: dbConfig.database || '❌ 未設置',
        user: dbConfig.user || '❌ 未設置',
        port: dbConfig.port,
        hasPassword: dbConfig.password ? '✅ 已設置' : '❌ 未設置',
        ssl: dbConfig.ssl ? '啟用' : '停用'
      });
      console.error('\n💡 請在 Zeabur 後端服務的環境變數中設置:');
      console.error('   POSTGRES_HOST, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD');
    });
}, 2000); // 延遲 2 秒，確保環境變數已載入

// ==================== 使用者 API ====================

// 獲取所有使用者
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    const users = {};
    result.rows.forEach(row => {
      // 安全地獲取 is_online 和 last_seen（如果字段不存在則為 undefined）
      const isOnline = row.hasOwnProperty('is_online') ? (row.is_online || false) : false;
      const lastSeen = row.hasOwnProperty('last_seen') && row.last_seen 
        ? new Date(row.last_seen).toISOString() 
        : null;
      
      users[row.id] = {
        uid: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        avatar: row.avatar,
        status: row.status,
        createdAt: row.created_at,
        isActive: row.is_active !== false, // 預設為啟用
        isOnline: isOnline, // 在線狀態
        lastSeen: lastSeen // 最後上線時間
      };
    });
    
    const onlineCount = Object.values(users).filter(u => u.isOnline).length;
    console.log(`📊 獲取用戶列表: 總共 ${result.rows.length} 個用戶，${onlineCount} 個在線`);
    
    // 調試：檢查每個用戶的資料（包括資料庫原始值）
    result.rows.forEach(row => {
      const user = users[row.id];
      console.log(`  - ${user.displayName}: 在線=${user.isOnline} (資料庫: ${row.is_online}), 頭貼=${user.avatar ? `有(${Math.round(user.avatar.length / 1024)}KB)` : '無'}, 狀態=${user.status || '無'}, last_seen=${row.last_seen || 'null'}`);
    });
    
    res.json(users);
  } catch (error) {
    console.error('獲取使用者失敗:', error);
    console.error('錯誤詳情:', error.message, error.stack);
    
    // 如果錯誤是因為字段不存在，提供明確的提示
    if (error.message && error.message.includes('is_online')) {
      res.status(500).json({ 
        error: '資料庫字段缺失',
        details: '請執行資料庫遷移腳本添加 is_online 和 last_seen 字段',
        hint: '執行 scripts/add-online-status-columns.sql'
      });
    } else {
      res.status(500).json({ 
        error: '獲取使用者失敗',
        details: error.message,
        hint: '請檢查資料庫連接和表結構'
      });
    }
  }
});

// 創建使用者
app.post('/api/users', async (req, res) => {
  try {
    const { uid, email, displayName, role, avatar, status, password } = req.body;
    
    if (!uid || !email || !displayName) {
      return res.status(400).json({ error: '缺少必要欄位：uid, email, displayName' });
    }

    const now = new Date().toISOString();
    const result = await pool.query(
      `INSERT INTO users (id, email, display_name, role, avatar, status, created_at, is_active, is_online)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         role = EXCLUDED.role,
         avatar = EXCLUDED.avatar,
         status = EXCLUDED.status
       RETURNING *`,
      [
        uid,
        email,
        displayName,
        role || 'REVIEWER',
        avatar || null,
        status || null,
        now,
        true, // is_active
        false // is_online
      ]
    );

    const row = result.rows[0];
    res.json({
      uid: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      avatar: row.avatar,
      status: row.status,
      createdAt: row.created_at,
      isActive: row.is_active !== false,
      isOnline: row.is_online || false,
      lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null
    });
  } catch (error) {
    console.error('創建使用者失敗:', error);
    res.status(500).json({ error: '創建使用者失敗', details: error.message });
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
      createdAt: row.created_at,
      isActive: row.is_active !== false,
      isOnline: row.is_online || false,
      lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null
    });
  } catch (error) {
    console.error('獲取使用者失敗:', error);
    res.status(500).json({ error: '獲取使用者失敗' });
  }
});

// 更新使用者資料
app.put('/api/users/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;
    
    console.log(`🔄 更新用戶資料: ${uid}`, {
      displayName: updates.displayName !== undefined,
      avatar: updates.avatar !== undefined ? (updates.avatar ? '有值' : '空') : '未提供',
      status: updates.status !== undefined ? (updates.status || '空') : '未提供',
      isOnline: updates.isOnline !== undefined ? (updates.isOnline ? '在線' : '離線') : '未提供',
      lastSeen: updates.lastSeen !== undefined ? (updates.lastSeen || 'null') : '未提供'
    });
    
    // 構建更新語句
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.displayName !== undefined) {
      updateFields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.role !== undefined) {
      updateFields.push(`role = $${paramIndex++}`);
      values.push(updates.role);
    }
    // avatar 和 status 需要明確處理，包括空字符串和 null
    if (updates.avatar !== undefined) {
      updateFields.push(`avatar = $${paramIndex++}`);
      // 空字符串或 null 都設置為 null
      values.push(updates.avatar && updates.avatar.trim() ? updates.avatar : null);
    }
    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      // 空字符串或 null 都設置為 null
      values.push(updates.status && updates.status.trim() ? updates.status : null);
    }
    if (updates.isActive !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }
    if (updates.isOnline !== undefined) {
      updateFields.push(`is_online = $${paramIndex++}`);
      values.push(updates.isOnline);
    }
    if (updates.lastSeen !== undefined) {
      updateFields.push(`last_seen = $${paramIndex++}`);
      // 如果 lastSeen 為 null 或 undefined，設置為 null（清除時間戳）
      values.push(updates.lastSeen ? new Date(updates.lastSeen) : null);
    }
    
    // 如果設置為在線，清除 last_seen（設為 null）
    if (updates.isOnline === true && updates.lastSeen === undefined) {
      // 檢查是否已經有 last_seen 字段的更新
      const hasLastSeenUpdate = updateFields.some(f => f.includes('last_seen'));
      if (!hasLastSeenUpdate) {
        updateFields.push(`last_seen = $${paramIndex++}`);
        values.push(null);
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: '沒有提供更新字段' });
    }
    
    values.push(uid);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    console.log(`📝 執行 SQL: UPDATE users SET ... WHERE id = ${uid}`);
    console.log(`📊 更新欄位:`, updateFields);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '使用者不存在' });
    }
    
    const row = result.rows[0];
    console.log(`✅ 使用者 ${uid} 更新成功:`, {
      displayName: row.display_name,
      isOnline: row.is_online,
      lastSeen: row.last_seen,
      avatar: row.avatar ? '有頭貼' : '無頭貼',
      status: row.status || '無狀態'
    });
    
    res.json({
      uid: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      avatar: row.avatar,
      status: row.status,
      createdAt: row.created_at,
      isActive: row.is_active !== false,
      isOnline: row.is_online || false,
      lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null
    });
  } catch (error) {
    console.error('更新使用者失敗:', error);
    res.status(500).json({ error: '更新使用者失敗', details: error.message });
  }
});

// ==================== 案件 API ====================

// 獲取所有案件
app.get('/api/leads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    console.log(`📊 /api/leads: 資料庫查詢結果，共 ${result.rows.length} 筆案件`);
    const leads = result.rows.map(row => {
      // 處理 JSONB 欄位
      let progress_updates = [];
      let change_history = [];
      
      try {
        if (row.progress_updates) {
          progress_updates = typeof row.progress_updates === 'string' 
            ? JSON.parse(row.progress_updates) 
            : row.progress_updates;
          // 確保 progress_updates 是陣列
          if (!Array.isArray(progress_updates)) {
            console.warn('progress_updates 不是陣列，轉換為陣列');
            progress_updates = [];
          }
          console.log(`📊 案件 ${row.id} 的進度更新: ${progress_updates.length} 筆`);
        } else {
          progress_updates = [];
        }
      } catch (e) {
        console.warn('解析 progress_updates 失敗:', e);
        progress_updates = [];
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
        case_code: row.case_code || null,
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
        id, case_code, platform, platform_id, need, budget_text, posted_at,
        phone, email, location, note, internal_remarks, remarks_author,
        status, decision, priority, created_by, created_by_name,
        created_at, updated_at, progress_updates, change_history
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      lead.id,
      lead.case_code || null,
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
    const { id } = req.params;
    const updates = req.body;
    const now = new Date().toISOString();
    
    console.log(`📥 更新案件: ${id}`, Object.keys(updates));
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    // 欄位名稱映射（前端 camelCase -> 資料庫 snake_case）
    const fieldMapping = {
      case_code: 'case_code',
      platform_id: 'platform_id',
      budget_text: 'budget_text',
      posted_at: 'posted_at',
      internal_remarks: 'internal_remarks',
      remarks_author: 'remarks_author',
      decision_by: 'decision_by',
      reject_reason: 'reject_reason',
      review_note: 'review_note',
      assigned_to: 'assigned_to',
      assigned_to_name: 'assigned_to_name',
      created_by: 'created_by',
      created_by_name: 'created_by_name',
      last_action_by: 'last_action_by',
      contact_status: 'contact_status'
    };
    
    // 處理每個更新欄位
    for (const key in updates) {
      // 跳過這些欄位，不允許更新或會手動處理
      if (key === 'id' || 
          key === 'created_at' || 
          key === 'created_by' || 
          key === 'created_by_name' ||
          key === 'updated_at') {  // 跳過 updated_at，我們會手動設定
        continue;
      }
      
      let dbFieldName = fieldMapping[key] || key;
      let value = updates[key];
      
      // 特殊處理 JSONB 欄位
      if (key === 'progress_updates' || key === 'change_history' || key === 'links') {
        updateFields.push(`${dbFieldName} = $${paramIndex}`);
        values.push(value ? JSON.stringify(value) : null);
        paramIndex++;
        continue;
      }
      
      // 特殊處理日期欄位（posted_at）
      if (key === 'posted_at') {
        updateFields.push(`${dbFieldName} = $${paramIndex}`);
        values.push(value ? new Date(value) : null);
        paramIndex++;
        continue;
      }
      
      // 一般欄位
      updateFields.push(`${dbFieldName} = $${paramIndex}`);
      values.push(value !== undefined && value !== null ? value : null);
      paramIndex++;
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: '沒有要更新的欄位' });
    }
    
    // 注意：不手動設定 updated_at，讓資料庫觸發器自動處理
    // 資料庫有 BEFORE UPDATE 觸發器會自動更新 updated_at
    
    // 添加 WHERE 條件的 ID
    values.push(id);
    
    const query = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    
    console.log(`📝 執行 SQL:`, query.substring(0, 100) + '...');
    console.log(`📊 參數數量: ${values.length - 1} 個欄位 + 1 個 ID`);
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '案件不存在' });
    }
    
    console.log(`✅ 案件更新成功: ${id}`);
    res.json({ success: true, id: result.rows[0].id });
  } catch (error) {
    console.error('❌ 更新案件失敗:', error);
    console.error('錯誤詳情:', error.message);
    console.error('錯誤堆疊:', error.stack);
    res.status(500).json({ 
      error: '更新案件失敗', 
      details: error.message,
      hint: '請檢查資料庫欄位名稱和資料類型是否正確'
    });
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
    
    console.log(`📥 獲取審計日誌: ${leadId ? `leadId=${leadId}` : '全部'}`);
    
    const result = await pool.query(query, params);
    
    const logs = result.rows.map(row => {
      // 安全地解析 JSONB 欄位
      let before = null;
      let after = null;
      
      try {
        // 如果已經是對象，直接使用；如果是字符串，則解析
        if (row.before) {
          before = typeof row.before === 'string' ? JSON.parse(row.before) : row.before;
        }
        if (row.after) {
          after = typeof row.after === 'string' ? JSON.parse(row.after) : row.after;
        }
      } catch (parseError) {
        console.warn('解析審計日誌 JSON 失敗:', parseError);
        // 如果解析失敗，保持為 null
      }
      
      return {
        id: row.id,
        lead_id: row.lead_id,
        actor_uid: row.actor_uid,
        actor_name: row.actor_name,
        action: row.action,
        before: before,
        after: after,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null
      };
    });
    
    console.log(`✅ 獲取審計日誌成功: ${logs.length} 筆`);
    res.json(logs);
  } catch (error) {
    console.error('❌ 獲取審計日誌失敗:', error);
    console.error('錯誤詳情:', error.message);
    console.error('錯誤堆疊:', error.stack);
    res.status(500).json({ 
      error: '獲取審計日誌失敗', 
      details: error.message,
      hint: '請檢查資料庫連接和 audit_logs 表結構'
    });
  }
});

// 根路徑 - API 資訊
app.get('/', (req, res) => {
  res.json({
    name: 'AI案件管理系統 API',
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

// 自動遷移端點 - 從前端接收 localStorage 資料並自動插入
app.post('/api/migrate', async (req, res) => {
  try {
    const { users, leads, auditLogs } = req.body;
    
    if (!users && !leads && !auditLogs) {
      return res.status(400).json({ error: '請提供要遷移的資料' });
    }

    const results = {
      users: { inserted: 0, errors: [] },
      leads: { inserted: 0, errors: [] },
      auditLogs: { inserted: 0, errors: [] }
    };

    // 遷移使用者
    if (users && Object.keys(users).length > 0) {
      const userList = Object.values(users);
      for (const user of userList) {
        try {
          // 使用 ON CONFLICT DO UPDATE 來更新現有用戶的資料（包括頭貼和狀態）
          await pool.query(
            `INSERT INTO users (id, email, display_name, role, avatar, status, created_at, is_active, is_online)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO UPDATE SET
               email = EXCLUDED.email,
               display_name = EXCLUDED.display_name,
               role = EXCLUDED.role,
               avatar = COALESCE(EXCLUDED.avatar, users.avatar),  -- 如果新值為空，保留舊值
               status = COALESCE(EXCLUDED.status, users.status),  -- 如果新值為空，保留舊值
               is_active = COALESCE(EXCLUDED.is_active, users.is_active, true)`,
            [
              user.uid || user.id,
              user.email || '',
              user.displayName || user.display_name || '',
              user.role || 'REVIEWER',
              user.avatar || null,
              user.status || null,
              user.createdAt || user.created_at || new Date().toISOString(),
              user.isActive !== false, // is_active
              false // is_online，遷移時設為離線
            ]
          );
          results.users.inserted++;
        } catch (err) {
          results.users.errors.push({ user: user.uid || user.id, error: err.message });
        }
      }
    }

    // 遷移案件
    if (leads && Array.isArray(leads) && leads.length > 0) {
      for (const lead of leads) {
        try {
          await pool.query(
            `INSERT INTO leads (
              id, case_code, platform, platform_id, need, budget_text, posted_at,
              phone, email, location, note, internal_remarks, remarks_author,
              status, decision, decision_by, reject_reason, review_note,
              assigned_to, assigned_to_name, priority, created_by, created_by_name,
              created_at, updated_at, last_action_by, progress_updates, change_history
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
            ) ON CONFLICT (id) DO NOTHING`,
            [
              lead.id,
              lead.case_code || null,
              lead.platform || 'FB',
              lead.platform_id || null,
              lead.need || '',
              lead.budget_text || null,
              lead.posted_at ? new Date(lead.posted_at) : null,
              lead.phone || null,
              lead.email || null,
              lead.location || null,
              lead.note || null,
              lead.internal_remarks || null,
              lead.remarks_author || null,
              lead.status || '待篩選',
              lead.decision || 'pending',
              lead.decision_by || null,
              lead.reject_reason || null,
              lead.review_note || null,
              lead.assigned_to || null,
              lead.assigned_to_name || null,
              lead.priority || 3,
              lead.created_by || null,
              lead.created_by_name || '',
              lead.created_at ? new Date(lead.created_at) : new Date(),
              lead.updated_at ? new Date(lead.updated_at) : new Date(),
              lead.last_action_by || null,
              lead.progress_updates ? JSON.stringify(lead.progress_updates) : null,
              lead.change_history ? JSON.stringify(lead.change_history) : null
            ]
          );
          results.leads.inserted++;
        } catch (err) {
          results.leads.errors.push({ lead: lead.id, error: err.message });
        }
      }
    }

    // 遷移審計日誌
    if (auditLogs && Array.isArray(auditLogs) && auditLogs.length > 0) {
      for (const log of auditLogs) {
        try {
          await pool.query(
            `INSERT INTO audit_logs (id, lead_id, actor_uid, actor_name, action, before, after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [
              log.id,
              log.lead_id || null,
              log.actor_uid || null,
              log.actor_name || '',
              log.action || '',
              log.before ? JSON.stringify(log.before) : null,
              log.after ? JSON.stringify(log.after) : null,
              log.created_at ? new Date(log.created_at) : new Date()
            ]
          );
          results.auditLogs.inserted++;
        } catch (err) {
          results.auditLogs.errors.push({ log: log.id, error: err.message });
        }
      }
    }

    console.log(`✅ 自動遷移完成:`, {
      users: `${results.users.inserted} 個`,
      leads: `${results.leads.inserted} 筆`,
      auditLogs: `${results.auditLogs.inserted} 筆`
    });

    res.json({
      success: true,
      message: `成功遷移：${results.users.inserted} 個使用者、${results.leads.inserted} 筆案件、${results.auditLogs.inserted} 筆審計日誌`,
      results
    });
  } catch (error) {
    console.error('自動遷移失敗:', error);
    res.status(500).json({
      success: false,
      error: '自動遷移失敗',
      details: error.message
    });
  }
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
    
    // 檢查在線狀態功能
    diagnostics.onlineStatus = {
      hasColumns: false,
      isOnlineColumn: false,
      lastSeenColumn: false,
      onlineUsersCount: 0,
      error: null
    };
    
    try {
      // 檢查是否有 is_online 和 last_seen 字段
      const columnsCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
          AND column_name IN ('is_online', 'last_seen')
      `);
      
      const columnNames = columnsCheck.rows.map(r => r.column_name);
      diagnostics.onlineStatus.isOnlineColumn = columnNames.includes('is_online');
      diagnostics.onlineStatus.lastSeenColumn = columnNames.includes('last_seen');
      diagnostics.onlineStatus.hasColumns = diagnostics.onlineStatus.isOnlineColumn && diagnostics.onlineStatus.lastSeenColumn;
      
      // 如果字段存在，統計在線用戶
      if (diagnostics.onlineStatus.hasColumns) {
        const onlineCheck = await pool.query(`
          SELECT COUNT(*) as count 
          FROM users 
          WHERE is_online = true
        `);
        diagnostics.onlineStatus.onlineUsersCount = parseInt(onlineCheck.rows[0].count);
      } else {
        diagnostics.onlineStatus.error = '缺少 is_online 或 last_seen 字段，請執行資料庫遷移腳本';
      }
    } catch (err) {
      diagnostics.onlineStatus.error = err.message;
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
