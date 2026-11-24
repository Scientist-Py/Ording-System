const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/database');
const { requireAdmin, sanitizeText } = require('../middleware/security');
const { broadcastToKitchen, broadcastOrderUpdate } = require('../services/websocket');

// Helper to format WhatsApp message according to exact Chapter One Cafe specification
function generateWhatsAppMessage({ orderNumber, tableNumber, customerName, customerPhone, items, specialInstructions, total, orderTime, cafeSettings }) {
  const cafeName = (cafeSettings.cafe_name || 'CHAPTER ONE CAFE').toUpperCase();
  const currency = cafeSettings.currency_symbol || '₹';

  let msg = `${cafeName}\n`;
  msg += `NEW ORDER\n\n`;
  msg += `Order No: #${orderNumber}\n`;
  msg += `Table: ${tableNumber}\n\n`;
  msg += `Customer: ${customerName}\n`;
  msg += `Phone: ${customerPhone}\n\n`;
  msg += `ORDER:\n\n`;

  items.forEach((it, idx) => {
    let customText = '';
    if (it.customizationsSelected && it.customizationsSelected.length > 0) {
      const opts = it.customizationsSelected.map(c => c.optionName).join(', ');
      customText = ` (${opts})`;
    }
    msg += `${idx + 1}. ${it.name}${customText} × ${it.quantity} — ${currency}${it.subtotal}\n`;
  });

  if (specialInstructions && specialInstructions.trim()) {
    msg += `\nSpecial Instructions:\n${specialInstructions.trim()}\n`;
  }

  msg += `\nTOTAL: ${currency}${total}\n\n`;
  msg += `Order Time: ${orderTime}\n`;

  return msg;
}

// Helper to format Indian 12-hour time (e.g. 10:42 AM)
function formatTime12h(isoDateStr) {
  const d = new Date(isoDateStr);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// 1. PLACE ORDER (Server-Authoritative, Idempotent, Realtime)
router.post('/', (req, res) => {
  try {
    const {
      qrToken,
      customerId,
      customerName,
      customerPhone,
      items,
      specialInstructions,
      idempotencyKey
    } = req.body;

    // Idempotency check: if already processed, return existing order
    if (idempotencyKey) {
      const existingOrder = db.prepare('SELECT * FROM orders WHERE idempotency_key = ?').get(idempotencyKey);
      if (existingOrder) {
        const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existingOrder.id);
        const table = db.prepare('SELECT table_number FROM tables WHERE id = ?').get(existingOrder.table_id);
        const settings = db.prepare('SELECT key, value FROM settings').all().reduce((acc, row) => {
          acc[row.key] = row.value;
          return acc;
        }, {});

        const orderTime = formatTime12h(existingOrder.created_at);
        const formattedItems = orderItems.map(oi => ({
          name: oi.item_name,
          quantity: oi.quantity,
          subtotal: oi.item_subtotal,
          customizationsSelected: JSON.parse(oi.customizations_selected || '[]')
        }));

        const waMsg = generateWhatsAppMessage({
          orderNumber: existingOrder.order_number,
          tableNumber: table ? table.table_number : 'Table',
          customerName: existingOrder.customer_name,
          customerPhone: existingOrder.customer_phone,
          items: formattedItems,
          specialInstructions: existingOrder.special_instructions,
          total: existingOrder.total,
          orderTime,
          cafeSettings: settings
        });

        const waNumber = (settings.whatsapp_number || '919876543210').replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;

        return res.json({
          success: true,
          isDuplicate: true,
          order: {
            ...existingOrder,
            table_number: table ? table.table_number : 'Table',
            items: orderItems.map(oi => ({
              ...oi,
              customizations_selected: JSON.parse(oi.customizations_selected || '[]')
            }))
          },
          whatsappMessage: waMsg,
          whatsappUrl: waUrl
        });
      }
    }

    // A. Validate Table by QR Token (Never trust table number submitted by browser)
    if (!qrToken || typeof qrToken !== 'string') {
      return res.status(400).json({ error: 'Valid Table QR Token is required.' });
    }

    const table = db.prepare(`
      SELECT id, table_number, status, is_revoked
      FROM tables
      WHERE qr_token = ?
    `).get(qrToken);

    if (!table) {
      return res.status(404).json({ error: 'Unrecognized table QR code. Please scan a valid cafe table code.' });
    }

    if (table.is_revoked) {
      return res.status(403).json({ error: 'This table QR code has been revoked or expired.' });
    }

    // B. Validate Customer Details
    const cleanCustomerName = sanitizeText(customerName);
    const cleanCustomerPhone = (customerPhone || '').replace(/[^0-9+]/g, '').trim();

    if (!cleanCustomerName || cleanCustomerPhone.length < 10) {
      return res.status(400).json({ error: 'Please provide customer name and a valid 10-digit mobile number.' });
    }

    // C. Validate Menu Items & Calculate Prices Strictly Server-Side
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty. Please add items to place an order.' });
    }

    const validatedOrderItems = [];
    let calculatedSubtotal = 0;

    for (const clientItem of items) {
      const { menuItemId, quantity, customizations } = clientItem;
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Invalid item quantity.' });
      }

      // Query database for authoritative item details
      const dbItem = db.prepare(`
        SELECT id, name, price, offer_price, is_available, customizations
        FROM menu_items
        WHERE id = ?
      `).get(menuItemId);

      if (!dbItem) {
        return res.status(400).json({ error: `Menu item not found: ${menuItemId}` });
      }

      if (!dbItem.is_available) {
        return res.status(400).json({
          error: `Sorry, "${dbItem.name}" is currently sold out and cannot be ordered.`
        });
      }

      // Base unit price: offer price if valid, else standard price
      let unitPrice = dbItem.offer_price != null ? dbItem.offer_price : dbItem.price;

      // Validate customizations against database definition
      const availableCustomizations = JSON.parse(dbItem.customizations || '[]');
      const validatedCustomizations = [];
      let customizationExtraCost = 0;

      if (Array.isArray(customizations)) {
        for (const selected of customizations) {
          // Find matching group
          const group = availableCustomizations.find(g => g.name === selected.groupName);
          if (group && Array.isArray(group.options)) {
            const opt = group.options.find(o => o.name === selected.optionName);
            if (opt) {
              const extra = parseFloat(opt.price) || 0;
              customizationExtraCost += extra;
              validatedCustomizations.push({
                groupName: group.name,
                optionName: opt.name,
                extraPrice: extra
              });
            }
          }
        }
      }

      const singleItemPrice = unitPrice + customizationExtraCost;
      const itemSubtotal = singleItemPrice * qty;
      calculatedSubtotal += itemSubtotal;

      validatedOrderItems.push({
        menuItemId: dbItem.id,
        name: dbItem.name,
        price: singleItemPrice,
        quantity: qty,
        customizations: validatedCustomizations,
        subtotal: itemSubtotal
      });
    }

    const total = calculatedSubtotal; // discounts can be calculated here if coupon applied
    const now = new Date().toISOString();

    // D. Active Session Management
    let session = db.prepare(`
      SELECT id, session_code, running_total FROM table_sessions
      WHERE table_id = ? AND status = 'ACTIVE'
      ORDER BY started_at DESC LIMIT 1
    `).get(table.id);

    if (!session) {
      const sessionId = crypto.randomUUID();
      const sessionCode = `SESS-${Date.now().toString().slice(-4)}`;
      db.prepare(`
        INSERT INTO table_sessions (id, table_id, session_code, status, running_total, started_at)
        VALUES (?, ?, ?, 'ACTIVE', 0, ?)
      `).run(sessionId, table.id, sessionCode, now);
      session = { id: sessionId, session_code: sessionCode, running_total: 0 };
    }

    // E. Generate sequential Order Number (e.g. 1001, 1002...)
    const lastOrder = db.prepare('SELECT MAX(order_number) as max_num FROM orders').get();
    const nextOrderNumber = (lastOrder && lastOrder.max_num) ? lastOrder.max_num + 1 : 1001;

    // F. Database Transaction: Save Order + Order Items + Update Sessions + Customer Profile
    const orderId = crypto.randomUUID();
    const cleanInstructions = sanitizeText(specialInstructions || '');

    const placeOrderTx = db.transaction(() => {
      // 1. Insert Order
      db.prepare(`
        INSERT INTO orders (
          id, order_number, table_id, table_session_id, customer_id,
          customer_name, customer_phone, subtotal, discount, total,
          status, special_instructions, idempotency_key, whatsapp_opened, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, 0, ?, ?)
      `).run(
        orderId,
        nextOrderNumber,
        table.id,
        session.id,
        customerId || null,
        cleanCustomerName,
        cleanCustomerPhone,
        calculatedSubtotal,
        0,
        total,
        cleanInstructions,
        idempotencyKey || crypto.randomUUID(),
        now,
        now
      );

      // 2. Insert Order Items
      const insertOrderItem = db.prepare(`
        INSERT INTO order_items (id, order_id, menu_item_id, item_name, item_price, quantity, customizations_selected, item_subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      validatedOrderItems.forEach(vi => {
        insertOrderItem.run(
          crypto.randomUUID(),
          orderId,
          vi.menuItemId,
          vi.name,
          vi.price,
          vi.quantity,
          JSON.stringify(vi.customizations),
          vi.subtotal
        );
      });

      // 3. Update Table Session running total and Table status
      db.prepare(`
        UPDATE table_sessions SET running_total = running_total + ? WHERE id = ?
      `).run(total, session.id);

      db.prepare(`
        UPDATE tables SET status = 'OCCUPIED', updated_at = ? WHERE id = ?
      `).run(now, table.id);

      // 4. Update Customer stats if customer exists
      if (customerId) {
        db.prepare(`
          UPDATE customers SET
            total_orders = total_orders + 1,
            total_spent = total_spent + ?,
            loyalty_points = loyalty_points + ?,
            last_visit_at = ?
          WHERE id = ?
        `).run(total, Math.floor(total / 20), now, customerId);
      }
    });

    placeOrderTx();

    // G. Generate WhatsApp Message & Link
    const settings = db.prepare('SELECT key, value FROM settings').all().reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    const orderTime = formatTime12h(now);
    const formattedItems = validatedOrderItems.map(it => ({
      name: it.name,
      quantity: it.quantity,
      subtotal: it.subtotal,
      customizationsSelected: it.customizations
    }));

    const waMsg = generateWhatsAppMessage({
      orderNumber: nextOrderNumber,
      tableNumber: table.table_number,
      customerName: cleanCustomerName,
      customerPhone: cleanCustomerPhone,
      items: formattedItems,
      specialInstructions: cleanInstructions,
      total,
      orderTime,
      cafeSettings: settings
    });

    const waNumber = (settings.whatsapp_number || '919876543210').replace(/[^0-9]/g, '');
    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;

    const fullOrderPayload = {
      id: orderId,
      order_number: nextOrderNumber,
      table_id: table.id,
      table_number: table.table_number,
      table_session_id: session.id,
      customer_id: customerId,
      customer_name: cleanCustomerName,
      customer_phone: cleanCustomerPhone,
      subtotal: calculatedSubtotal,
      total,
      status: 'NEW',
      special_instructions: cleanInstructions,
      created_at: now,
      items: validatedOrderItems
    };

    // H. Realtime Alert to Cafe PC Dashboard (Fullscreen and Sound Trigger)
    broadcastToKitchen('NEW_ORDER', fullOrderPayload);

    return res.status(201).json({
      success: true,
      order: fullOrderPayload,
      whatsappMessage: waMsg,
      whatsappUrl: waUrl
    });
  } catch (err) {
    console.error('[Orders] Place order error:', err);
    res.status(500).json({ error: 'Failed to place order. Please try again.' });
  }
});

// 2. Customer Order Tracking Endpoint (Public, safe, scoped strictly to order number)
router.get('/track/:orderNumber', (req, res) => {
  try {
    const { orderNumber } = req.params;
    const num = parseInt(orderNumber, 10);
    if (isNaN(num)) {
      return res.status(400).json({ error: 'Invalid order number' });
    }

    const order = db.prepare(`
      SELECT o.id, o.order_number, o.status, o.rejection_reason, o.subtotal, o.total,
             o.special_instructions, o.created_at, o.updated_at,
             t.table_number, t.id as table_id, t.qr_token
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      WHERE o.order_number = ?
    `).get(num);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = db.prepare(`
      SELECT id, item_name, item_price, quantity, customizations_selected, item_subtotal
      FROM order_items
      WHERE order_id = ?
    `).all(order.id);

    const parsedItems = items.map(it => ({
      ...it,
      customizations_selected: JSON.parse(it.customizations_selected || '[]')
    }));

    res.json({
      order: {
        ...order,
        items: parsedItems
      }
    });
  } catch (err) {
    console.error('[Orders] Track order error:', err);
    res.status(500).json({ error: 'Failed to fetch order tracking info' });
  }
});

// 3. PC Receiver & Admin: Get Active Orders (For Missed Order Recovery & Initial Load)
router.get('/active', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.id, o.order_number, o.table_id, t.table_number, o.table_session_id,
             o.customer_name, o.customer_phone, o.subtotal, o.total, o.status,
             o.rejection_reason, o.special_instructions, o.created_at, o.updated_at
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      WHERE o.status NOT IN ('COMPLETED', 'REJECTED')
      ORDER BY o.created_at DESC
    `).all();

    const ordersWithItems = orders.map(ord => {
      const items = db.prepare(`
        SELECT id, item_name, item_price, quantity, customizations_selected, item_subtotal
        FROM order_items
        WHERE order_id = ?
      `).all(ord.id);

      return {
        ...ord,
        items: items.map(i => ({
          ...i,
          customizations_selected: JSON.parse(i.customizations_selected || '[]')
        }))
      };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error('[Orders] Active orders error:', err);
    res.status(500).json({ error: 'Failed to fetch active orders' });
  }
});

// 3b. Dashboard: Get Completed Orders
router.get('/completed', (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.id, o.order_number, o.table_id, t.table_number, o.table_session_id,
             o.customer_name, o.customer_phone, o.subtotal, o.total, o.status,
             o.rejection_reason, o.special_instructions, o.created_at, o.updated_at
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      WHERE o.status = 'COMPLETED'
      ORDER BY o.updated_at DESC
      LIMIT 100
    `).all();

    const ordersWithItems = orders.map(ord => {
      const items = db.prepare(`
        SELECT id, item_name, item_price, quantity, customizations_selected, item_subtotal
        FROM order_items
        WHERE order_id = ?
      `).all(ord.id);

      return {
        ...ord,
        items: items.map(i => ({
          ...i,
          customizations_selected: JSON.parse(i.customizations_selected || '[]')
        }))
      };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error('[Orders] Completed orders error:', err);
    res.status(500).json({ error: 'Failed to fetch completed orders' });
  }
});

// 4. Update Order Status (NEW -> ACCEPTED -> PREPARING -> READY -> SERVED -> COMPLETED / REJECTED)
router.patch('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const validStatuses = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid order status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const now = new Date().toISOString();
    const cleanReason = rejectionReason ? sanitizeText(rejectionReason) : null;

    db.prepare(`
      UPDATE orders SET status = ?, rejection_reason = ?, updated_at = ? WHERE id = ?
    `).run(status, cleanReason, now, id);

    const updatedOrder = db.prepare(`
      SELECT o.*, t.table_number
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      WHERE o.id = ?
    `).get(id);

    // Broadcast status change to kitchen, admin, and customer tracker
    broadcastOrderUpdate(updatedOrder);

    res.json({
      success: true,
      order: updatedOrder,
      message: `Order #${updatedOrder.order_number} marked as ${status}`
    });
  } catch (err) {
    console.error('[Orders] Update status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// 5. Track WhatsApp Click
router.post('/:id/whatsapp-opened', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('UPDATE orders SET whatsapp_opened = 1 WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record WhatsApp click' });
  }
});

// 6. Admin: List All Orders with Filters
router.get('/', requireAdmin, (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.id, o.order_number, o.table_id, t.table_number, o.table_session_id,
             o.customer_name, o.customer_phone, o.subtotal, o.total, o.status,
             o.rejection_reason, o.special_instructions, o.created_at, o.updated_at
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      ORDER BY o.created_at DESC
      LIMIT 100
    `).all();

    const ordersWithItems = orders.map(ord => {
      const items = db.prepare(`
        SELECT id, item_name, item_price, quantity, customizations_selected, item_subtotal
        FROM order_items
        WHERE order_id = ?
      `).all(ord.id);

      return {
        ...ord,
        items: items.map(i => ({
          ...i,
          customizations_selected: JSON.parse(i.customizations_selected || '[]')
        }))
      };
    });

    res.json(ordersWithItems);
  } catch (err) {
    console.error('[Orders] List orders error:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
