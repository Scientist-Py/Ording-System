const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const { db, generateSecureToken } = require('../db/database');
const { requireAdmin, sanitizeText } = require('../middleware/security');
const { broadcastToKitchen } = require('../services/websocket');

// Public endpoint: Validate QR token for customer ordering
router.get('/validate-qr/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: 'Invalid QR token provided.' });
    }

    const table = db.prepare(`
      SELECT id, table_number, qr_token, status, is_revoked, token_created_at
      FROM tables
      WHERE qr_token = ?
    `).get(token);

    if (!table) {
      return res.status(404).json({
        valid: false,
        error: 'TABLE_NOT_FOUND',
        message: 'This QR code is not recognized. Please scan the QR code placed on your table or contact cafe staff.'
      });
    }

    if (table.is_revoked) {
      return res.status(403).json({
        valid: false,
        error: 'QR_REVOKED',
        message: 'This QR code has been revoked or expired. Please ask the cafe staff for an active QR code.'
      });
    }

    // Find or create active session
    let session = db.prepare(`
      SELECT id, session_code, status, running_total, started_at
      FROM table_sessions
      WHERE table_id = ? AND status = 'ACTIVE'
      ORDER BY started_at DESC
      LIMIT 1
    `).get(table.id);

    if (!session) {
      const sessionId = crypto.randomUUID();
      const sessionCode = `SESS-${Date.now().toString().slice(-4)}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO table_sessions (id, table_id, session_code, status, running_total, started_at)
        VALUES (?, ?, ?, 'ACTIVE', 0, ?)
      `).run(sessionId, table.id, sessionCode, now);

      session = {
        id: sessionId,
        session_code: sessionCode,
        status: 'ACTIVE',
        running_total: 0,
        started_at: now
      };
    }

    // Return strictly server-authoritative table info
    return res.json({
      valid: true,
      table: {
        id: table.id,
        tableNumber: table.table_number,
        status: table.status,
        qrToken: table.qr_token
      },
      session: {
        id: session.id,
        sessionCode: session.session_code,
        runningTotal: session.running_total,
        startedAt: session.started_at
      }
    });
  } catch (err) {
    console.error('[Tables] Validate QR error:', err);
    res.status(500).json({ valid: false, error: 'Internal server error' });
  }
});

// Admin: List all tables with active session info & generated QR data URLs
router.get('/', requireAdmin, async (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT t.id, t.table_number, t.qr_token, t.status, t.is_revoked, t.token_created_at, t.created_at,
             ts.id as active_session_id, ts.session_code, ts.running_total, ts.started_at as session_started_at,
             (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND o.table_session_id = ts.id) as session_order_count
      FROM tables t
      LEFT JOIN table_sessions ts ON ts.table_id = t.id AND ts.status = 'ACTIVE'
      ORDER BY t.created_at ASC
    `).all();

    // Attach QR code image data URL for printing/scanning directly from admin dashboard
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    const tablesWithQr = await Promise.all(tables.map(async (tbl) => {
      const qrUrl = `${baseUrl}/table/${tbl.qr_token}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#2f1e19',
          light: '#ffffff'
        }
      });

      return {
        ...tbl,
        qrUrl,
        qrDataUrl
      };
    }));

    res.json(tablesWithQr);
  } catch (err) {
    console.error('[Tables] List tables error:', err);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
});

// Admin: Add new table
router.post('/', requireAdmin, (req, res) => {
  try {
    const tableNumber = sanitizeText(req.body.tableNumber);
    if (!tableNumber) {
      return res.status(400).json({ error: 'Table number/name is required' });
    }

    const existing = db.prepare('SELECT id FROM tables WHERE table_number = ?').get(tableNumber);
    if (existing) {
      return res.status(400).json({ error: 'A table with this name already exists' });
    }

    const now = new Date().toISOString();
    const tableId = crypto.randomUUID();
    const qrToken = generateSecureToken();

    db.prepare(`
      INSERT INTO tables (id, table_number, qr_token, status, is_revoked, token_created_at, created_at, updated_at)
      VALUES (?, ?, ?, 'AVAILABLE', 0, ?, ?, ?)
    `).run(tableId, tableNumber, qrToken, now, now, now);

    const sessionId = crypto.randomUUID();
    const sessionCode = `SESS-${Date.now().toString().slice(-4)}`;
    db.prepare(`
      INSERT INTO table_sessions (id, table_id, session_code, status, running_total, started_at)
      VALUES (?, ?, ?, 'ACTIVE', 0, ?)
    `).run(sessionId, tableId, sessionCode, now);

    res.status(201).json({
      success: true,
      table: {
        id: tableId,
        table_number: tableNumber,
        qr_token: qrToken,
        status: 'AVAILABLE'
      }
    });
  } catch (err) {
    console.error('[Tables] Add table error:', err);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// Admin: Regenerate QR Token (cryptographic re-issuance, revokes previous token)
router.post('/:id/regenerate-qr', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const table = db.prepare('SELECT id, table_number FROM tables WHERE id = ?').get(id);
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const newToken = generateSecureToken();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE tables
      SET qr_token = ?, is_revoked = 0, token_created_at = ?, updated_at = ?
      WHERE id = ?
    `).run(newToken, now, now, id);

    res.json({
      success: true,
      tableNumber: table.table_number,
      newToken,
      message: `New secure QR token generated for ${table.table_number}. Previous QR code is immediately invalid.`
    });
  } catch (err) {
    console.error('[Tables] Regenerate QR error:', err);
    res.status(500).json({ error: 'Failed to regenerate QR token' });
  }
});

// Admin: Revoke QR Code
router.post('/:id/revoke-qr', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const table = db.prepare('SELECT id, table_number FROM tables WHERE id = ?').get(id);
    if (!table) return res.status(404).json({ error: 'Table not found' });

    db.prepare(`
      UPDATE tables SET is_revoked = 1, updated_at = ? WHERE id = ?
    `).run(new Date().toISOString(), id);

    res.json({
      success: true,
      message: `QR code for ${table.table_number} has been revoked. Customers scanning it will be blocked.`
    });
  } catch (err) {
    console.error('[Tables] Revoke QR error:', err);
    res.status(500).json({ error: 'Failed to revoke QR code' });
  }
});

// Admin: Close active table session and reset table
router.post('/:id/close-session', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const table = db.prepare('SELECT id, table_number FROM tables WHERE id = ?').get(id);
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const activeSession = db.prepare(`
      SELECT id, session_code, running_total FROM table_sessions WHERE table_id = ? AND status = 'ACTIVE'
    `).get(id);

    const now = new Date().toISOString();

    if (activeSession) {
      db.prepare(`
        UPDATE table_sessions
        SET status = 'CLOSED', closed_at = ?
        WHERE id = ?
      `).run(now, activeSession.id);
    }

    // Start fresh new session
    const newSessionId = crypto.randomUUID();
    const newSessionCode = `SESS-${Date.now().toString().slice(-4)}`;
    db.prepare(`
      INSERT INTO table_sessions (id, table_id, session_code, status, running_total, started_at)
      VALUES (?, ?, ?, 'ACTIVE', 0, ?)
    `).run(newSessionId, id, newSessionCode, now);

    // Reset table status to AVAILABLE
    db.prepare(`
      UPDATE tables SET status = 'AVAILABLE', updated_at = ? WHERE id = ?
    `).run(now, id);

    broadcastToKitchen('TABLE_SESSION_RESET', { tableId: id, tableNumber: table.table_number });

    res.json({
      success: true,
      closedSessionCode: activeSession ? activeSession.session_code : null,
      newSessionCode,
      message: `Session closed for ${table.table_number}. Table is now reset and available.`
    });
  } catch (err) {
    console.error('[Tables] Close session error:', err);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

module.exports = router;
