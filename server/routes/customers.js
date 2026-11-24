const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/database');
const { requireAdmin, sanitizeText } = require('../middleware/security');

// Customer Identify / Recognize endpoint
router.post('/identify', (req, res) => {
  try {
    const { deviceToken, name, phone, consentSaved } = req.body;
    const userAgent = req.headers['user-agent'] || '';
    const now = new Date().toISOString();

    // 1. If deviceToken provided, attempt recognition
    if (deviceToken && typeof deviceToken === 'string') {
      const device = db.prepare(`
        SELECT cd.id as device_id, cd.customer_id, cd.is_revoked,
               c.name, c.phone, c.consent_saved, c.total_visits, c.total_orders, c.total_spent, c.loyalty_points
        FROM customer_devices cd
        JOIN customers c ON c.id = cd.customer_id
        WHERE cd.device_token = ?
      `).get(deviceToken);

      if (device && !device.is_revoked) {
        // Update last seen
        db.prepare('UPDATE customer_devices SET last_seen_at = ? WHERE id = ?').run(now, device.device_id);

        return res.json({
          recognized: true,
          deviceToken,
          customer: {
            id: device.customer_id,
            name: device.name,
            phone: device.phone,
            totalVisits: device.total_visits,
            totalOrders: device.total_orders,
            loyaltyPoints: device.loyalty_points
          }
        });
      }
    }

    // 2. Not recognized via device token: if name & phone provided, find or create
    if (name && phone) {
      const cleanName = sanitizeText(name);
      const cleanPhone = phone.replace(/[^0-9+]/g, '').trim();

      if (!cleanName || cleanPhone.length < 10) {
        return res.status(400).json({ error: 'Please enter a valid name and 10-digit phone number' });
      }

      // Check if existing customer with same phone number
      let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone);

      let customerId;
      if (customer) {
        customerId = customer.id;
        // Update name and last visit
        db.prepare(`
          UPDATE customers SET name = ?, total_visits = total_visits + 1, last_visit_at = ? WHERE id = ?
        `).run(cleanName, now, customerId);
      } else {
        customerId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO customers (id, name, phone, consent_saved, total_visits, total_orders, total_spent, loyalty_points, first_visit_at, last_visit_at)
          VALUES (?, ?, ?, ?, 1, 0, 0, 10, ?, ?)
        `).run(customerId, cleanName, cleanPhone, consentSaved ? 1 : 0, now, now);
      }

      // Generate new device token
      const newDeviceToken = crypto.randomBytes(24).toString('hex');
      const deviceId = crypto.randomUUID();

      db.prepare(`
        INSERT INTO customer_devices (id, customer_id, device_token, user_agent, created_at, last_seen_at, is_revoked)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(deviceId, customerId, newDeviceToken, userAgent.slice(0, 255), now, now);

      return res.json({
        recognized: false,
        deviceToken: newDeviceToken,
        customer: {
          id: customerId,
          name: cleanName,
          phone: cleanPhone,
          totalVisits: customer ? customer.total_visits + 1 : 1,
          totalOrders: customer ? customer.total_orders : 0,
          loyaltyPoints: customer ? customer.loyalty_points : 10
        }
      });
    }

    // Device token was invalid/absent and no details submitted
    return res.json({
      recognized: false,
      deviceToken: null,
      customer: null
    });
  } catch (err) {
    console.error('[Customer] Identify error:', err);
    res.status(500).json({ error: 'Identification failed' });
  }
});

// Forget Device endpoint (privacy-friendly profile disconnection)
router.post('/forget', (req, res) => {
  try {
    const { deviceToken } = req.body;
    if (deviceToken) {
      db.prepare('UPDATE customer_devices SET is_revoked = 1 WHERE device_token = ?').run(deviceToken);
    }
    res.json({ success: true, message: 'Saved device profile forgotten.' });
  } catch (err) {
    console.error('[Customer] Forget error:', err);
    res.status(500).json({ error: 'Forget failed' });
  }
});

// Admin: List all customers
router.get('/', requireAdmin, (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT id, name, phone, total_visits, total_orders, total_spent, loyalty_points, first_visit_at, last_visit_at
      FROM customers
      ORDER BY last_visit_at DESC
    `).all();

    res.json(customers);
  } catch (err) {
    console.error('[Customer] List error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Admin: Delete customer profile
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM customer_devices WHERE customer_id = ?').run(id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true, message: 'Customer profile deleted' });
  } catch (err) {
    console.error('[Customer] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
