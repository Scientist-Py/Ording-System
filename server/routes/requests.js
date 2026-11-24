const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/database');
const { checkRateLimit } = require('../middleware/security');
const { broadcastToKitchen } = require('../services/websocket');

// Customer Request Assistance (Waiter, Bill, Water)
router.post('/', (req, res) => {
  try {
    const { qrToken, requestType } = req.body;

    const validTypes = ['WAITER', 'BILL', 'WATER'];
    if (!requestType || !validTypes.includes(requestType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid request type. Must be WAITER, BILL, or WATER.' });
    }

    if (!qrToken || typeof qrToken !== 'string') {
      return res.status(400).json({ error: 'Valid Table QR Token required.' });
    }

    const table = db.prepare(`
      SELECT id, table_number, is_revoked FROM tables WHERE qr_token = ?
    `).get(qrToken);

    if (!table || table.is_revoked) {
      return res.status(403).json({ error: 'Invalid or expired table QR code.' });
    }

    // Rate limit cooldown (45 seconds per table per request type)
    const rateLimitKey = `req_${table.id}_${requestType.toUpperCase()}`;
    const limitCheck = checkRateLimit(rateLimitKey, 45);
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: `Please wait ${limitCheck.remainingSeconds}s before requesting ${requestType.toLowerCase()} again.`
      });
    }

    // Active session
    const session = db.prepare(`
      SELECT id FROM table_sessions WHERE table_id = ? AND status = 'ACTIVE' LIMIT 1
    `).get(table.id);

    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();
    const cleanType = requestType.toUpperCase();

    db.prepare(`
      INSERT INTO customer_requests (id, table_id, table_session_id, request_type, status, created_at)
      VALUES (?, ?, ?, ?, 'PENDING', ?)
    `).run(requestId, table.id, session ? session.id : null, cleanType, now);

    const alertPayload = {
      id: requestId,
      table_id: table.id,
      table_number: table.table_number,
      request_type: cleanType,
      status: 'PENDING',
      created_at: now
    };

    // Broadcast instant alert to Kitchen PC
    broadcastToKitchen('CUSTOMER_REQUEST', alertPayload);

    let displayMessage = '';
    if (cleanType === 'WAITER') displayMessage = 'Staff has been notified. A waiter is on the way to your table.';
    else if (cleanType === 'BILL') displayMessage = 'Bill requested. Staff is preparing your bill.';
    else if (cleanType === 'WATER') displayMessage = 'Water requested. Staff will serve you shortly.';

    res.status(201).json({
      success: true,
      requestId,
      message: displayMessage
    });
  } catch (err) {
    console.error('[Requests] Assistance error:', err);
    res.status(500).json({ error: 'Failed to submit assistance request' });
  }
});

// PC & Admin: Get Pending Requests
router.get('/pending', (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT r.id, r.table_id, t.table_number, r.request_type, r.status, r.created_at
      FROM customer_requests r
      JOIN tables t ON t.id = r.table_id
      WHERE r.status = 'PENDING'
      ORDER BY r.created_at DESC
    `).all();

    res.json(requests);
  } catch (err) {
    console.error('[Requests] Pending error:', err);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Acknowledge Request
router.patch('/:id/acknowledge', (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE customer_requests SET status = 'ACKNOWLEDGED', acknowledged_at = ? WHERE id = ?
    `).run(now, id);

    broadcastToKitchen('REQUEST_ACKNOWLEDGED', { id });

    res.json({ success: true, message: 'Request acknowledged' });
  } catch (err) {
    console.error('[Requests] Acknowledge error:', err);
    res.status(500).json({ error: 'Failed to acknowledge request' });
  }
});

module.exports = router;
