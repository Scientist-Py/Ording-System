const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db/database');
const { requireAdmin, sanitizeText } = require('../middleware/security');

// Public: Get complete digital menu with categories
router.get('/', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT id, name, slug, sort_order
      FROM menu_categories
      WHERE is_active = 1
      ORDER BY sort_order ASC
    `).all();

    const items = db.prepare(`
      SELECT id, category_id, name, description, price, offer_price, image_url,
             is_veg, is_available, is_popular, customizations, sort_order
      FROM menu_items
      ORDER BY sort_order ASC, name ASC
    `).all();

    // Parse customizations JSON safely
    const parsedItems = items.map(item => ({
      ...item,
      is_veg: Boolean(item.is_veg),
      is_available: Boolean(item.is_available),
      is_popular: Boolean(item.is_popular),
      customizations: JSON.parse(item.customizations || '[]')
    }));

    // Group items by category
    const menuByCategory = categories.map(cat => ({
      ...cat,
      items: parsedItems.filter(item => item.category_id === cat.id)
    }));

    res.json({
      categories,
      items: parsedItems,
      menuByCategory
    });
  } catch (err) {
    console.error('[Menu] Fetch menu error:', err);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Admin: Add new menu item
router.post('/items', requireAdmin, (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      offerPrice,
      imageUrl,
      isVeg,
      isAvailable,
      isPopular,
      customizations
    } = req.body;

    if (!name || !price || !categoryId) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO menu_items (
        id, category_id, name, description, price, offer_price, image_url,
        is_veg, is_available, is_popular, customizations, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      categoryId,
      sanitizeText(name),
      sanitizeText(description || ''),
      parseFloat(price),
      offerPrice ? parseFloat(offerPrice) : null,
      imageUrl ? imageUrl.trim() : null,
      isVeg ? 1 : 0,
      isAvailable !== false ? 1 : 0,
      isPopular ? 1 : 0,
      JSON.stringify(customizations || []),
      0,
      now,
      now
    );

    res.status(201).json({ success: true, itemId: id });
  } catch (err) {
    console.error('[Menu] Create item error:', err);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// Admin: Update menu item
router.put('/items/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      name,
      description,
      price,
      offerPrice,
      imageUrl,
      isVeg,
      isAvailable,
      isPopular,
      customizations
    } = req.body;

    const existing = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE menu_items SET
        category_id = ?,
        name = ?,
        description = ?,
        price = ?,
        offer_price = ?,
        image_url = ?,
        is_veg = ?,
        is_available = ?,
        is_popular = ?,
        customizations = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      categoryId,
      sanitizeText(name),
      sanitizeText(description || ''),
      parseFloat(price),
      offerPrice ? parseFloat(offerPrice) : null,
      imageUrl ? imageUrl.trim() : null,
      isVeg ? 1 : 0,
      isAvailable ? 1 : 0,
      isPopular ? 1 : 0,
      JSON.stringify(customizations || []),
      now,
      id
    );

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (err) {
    console.error('[Menu] Update item error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Admin: Quick toggle availability (sold out / in stock)
router.patch('/items/:id/availability', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    const item = db.prepare('SELECT id, name FROM menu_items WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const val = isAvailable ? 1 : 0;
    db.prepare('UPDATE menu_items SET is_available = ?, updated_at = ? WHERE id = ?')
      .run(val, new Date().toISOString(), id);

    res.json({
      success: true,
      isAvailable: Boolean(val),
      message: `${item.name} is now ${val ? 'Available' : 'Sold Out'}`
    });
  } catch (err) {
    console.error('[Menu] Toggle availability error:', err);
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
});

// Admin: Delete item
router.delete('/items/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
    res.json({ success: true, message: 'Item deleted' });
  } catch (err) {
    console.error('[Menu] Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Admin: Add Category
router.post('/categories', requireAdmin, (req, res) => {
  try {
    const name = sanitizeText(req.body.name);
    if (!name) return res.status(400).json({ error: 'Category name required' });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO menu_categories (id, name, slug, sort_order, is_active)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM menu_categories), 1)
    `).run(id, name, slug);

    res.status(201).json({ success: true, category: { id, name, slug } });
  } catch (err) {
    console.error('[Menu] Add category error:', err);
    res.status(500).json({ error: 'Failed to add category' });
  }
});

module.exports = router;
