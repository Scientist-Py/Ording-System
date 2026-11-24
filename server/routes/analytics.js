const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/security');

router.get('/reports', requireAdmin, (req, res) => {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Total & Today's Orders & Revenue
    const todayStats = db.prepare(`
      SELECT COUNT(*) as today_orders, COALESCE(SUM(total), 0) as today_revenue
      FROM orders
      WHERE created_at LIKE ? AND status != 'REJECTED'
    `).get(`${todayStr}%`);

    const allTimeStats = db.prepare(`
      SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue
      FROM orders
      WHERE status != 'REJECTED'
    `).get();

    const aov = todayStats.today_orders > 0
      ? (todayStats.today_revenue / todayStats.today_orders).toFixed(2)
      : (allTimeStats.total_orders > 0 ? (allTimeStats.total_revenue / allTimeStats.total_orders).toFixed(2) : 0);

    // 2. Most Popular Items
    const popularItems = db.prepare(`
      SELECT item_name, SUM(quantity) as total_sold, SUM(item_subtotal) as total_earned
      FROM order_items
      GROUP BY item_name
      ORDER BY total_sold DESC
      LIMIT 5
    `).all();

    // 3. Least Popular Items
    const leastPopularItems = db.prepare(`
      SELECT mi.name as item_name, COALESCE(SUM(oi.quantity), 0) as total_sold
      FROM menu_items mi
      LEFT JOIN order_items oi ON oi.menu_item_id = mi.id
      GROUP BY mi.id, mi.name
      ORDER BY total_sold ASC
      LIMIT 5
    `).all();

    // 4. Orders by Table
    const ordersByTable = db.prepare(`
      SELECT t.table_number, COUNT(o.id) as order_count, COALESCE(SUM(o.total), 0) as revenue
      FROM tables t
      LEFT JOIN orders o ON o.table_id = t.id AND o.status != 'REJECTED'
      GROUP BY t.id, t.table_number
      ORDER BY order_count DESC
    `).all();

    // 5. New vs Returning Customers
    const customerStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN total_visits = 1 THEN 1 END) as new_customers,
        COUNT(CASE WHEN total_visits > 1 THEN 1 END) as returning_customers,
        COUNT(*) as total_customers
      FROM customers
    `).get();

    // 6. Recent 10 Orders
    const recentOrders = db.prepare(`
      SELECT o.id, o.order_number, t.table_number, o.customer_name, o.total, o.status, o.created_at
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      ORDER BY o.created_at DESC
      LIMIT 10
    `).all();

    res.json({
      todayOrders: todayStats.today_orders,
      todayRevenue: todayStats.today_revenue,
      totalOrders: allTimeStats.total_orders,
      totalRevenue: allTimeStats.total_revenue,
      averageOrderValue: aov,
      popularItems,
      leastPopularItems,
      ordersByTable,
      customers: customerStats,
      recentOrders
    });
  } catch (err) {
    console.error('[Analytics] Error:', err);
    res.status(500).json({ error: 'Failed to generate analytics' });
  }
});

module.exports = router;
