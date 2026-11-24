const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAdmin, sanitizeText } = require('../middleware/security');

// Get Settings (public info filtered, or admin full info)
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = rows.reduce((acc, row) => {
      // Don't leak admin pin to public unless authorized
      if (row.key !== 'admin_pin' || req.headers['x-admin-pin']) {
        acc[row.key] = row.value;
      }
      return acc;
    }, {});

    res.json(settings);
  } catch (err) {
    console.error('[Settings] Get error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update Settings (Admin Only)
router.put('/', requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const allowedKeys = [
      'cafe_name',
      'cafe_tagline',
      'whatsapp_number',
      'currency_symbol',
      'admin_pin',
      'notification_sound',
      'sound_volume',
      'auto_print'
    ];

    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

    const updateTx = db.transaction(() => {
      for (const [k, v] of Object.entries(updates)) {
        if (allowedKeys.includes(k) && v !== undefined && v !== null) {
          updateStmt.run(k, String(v).trim());
        }
      }
    });

    updateTx();

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    console.error('[Settings] Update error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
