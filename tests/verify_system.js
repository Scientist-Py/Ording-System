// Chapter One Cafe - Comprehensive End-to-End Test Suite
// Verifies Security, Validation, Orders, WhatsApp, Sessions, Rate Limiting & Admin

const http = require('http');
const { app, server } = require('../server/server.js');
const { db } = require('../server/db/database');

const BASE_URL = 'http://localhost:4000/api';

const testResults = [];

function recordTest(name, expected, actual, passed, details = '') {
  testResults.push({ name, expected, actual, passed, details });
  const mark = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${mark}: ${name}`);
  if (!passed) console.error(`   Details: ${details} | Expected: ${expected} | Actual: ${actual}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = options.headers || {};
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log(' STARTING CHAPTER ONE CAFE AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Health check
    const health = await request('/health');
    recordTest(
      'Server Health Check',
      200,
      health.status,
      health.status === 200 && health.data.status === 'ONLINE'
    );

    // 2. Fetch active table for testing
    const tableRow = db.prepare('SELECT * FROM tables WHERE is_revoked = 0 LIMIT 1').get();
    const validQrToken = tableRow.qr_token;
    const tableId = tableRow.id;

    // 3. Valid QR Token Validation
    const qrRes = await request(`/tables/validate-qr/${validQrToken}`);
    recordTest(
      'Valid QR Token Validation',
      true,
      qrRes.data.valid,
      qrRes.status === 200 && qrRes.data.valid === true && qrRes.data.table.tableNumber === tableRow.table_number
    );

    // 4. Invalid QR Token Manipulation Defense
    const invalidQrRes = await request('/tables/validate-qr/manipulated_token_xyz999');
    recordTest(
      'Manipulated QR Token Rejection',
      404,
      invalidQrRes.status,
      invalidQrRes.status === 404 && invalidQrRes.data.valid === false
    );

    // 5. Revoked QR Token Defense
    const revokeToken = 'test_revoked_token_123';
    db.prepare(`
      INSERT OR REPLACE INTO tables (id, table_number, qr_token, status, is_revoked, token_created_at, created_at, updated_at)
      VALUES ('test-revoked-id', 'Test Revoked Table', ?, 'AVAILABLE', 1, datetime('now'), datetime('now'), datetime('now'))
    `).run(revokeToken);

    const revokedRes = await request(`/tables/validate-qr/${revokeToken}`);
    recordTest(
      'Revoked QR Code Blocking',
      403,
      revokedRes.status,
      revokedRes.status === 403 && revokedRes.data.valid === false
    );

    // 6. Fetch Menu & Verify Categories
    const menuRes = await request('/menu');
    recordTest(
      'Menu Categories & Items Retrieval',
      true,
      menuRes.data.items && menuRes.data.items.length > 0,
      menuRes.status === 200 && menuRes.data.items.length >= 20
    );

    // 7. Customer Device Recognition
    const customerRes = await request('/customers/identify', {
      method: 'POST',
      body: {
        name: 'Rahul Sharma',
        phone: '9876543210',
        consentSaved: true
      }
    });

    const generatedDeviceToken = customerRes.data.deviceToken;
    recordTest(
      'Customer Device Token Issuance',
      true,
      Boolean(generatedDeviceToken),
      customerRes.status === 200 && Boolean(generatedDeviceToken) && customerRes.data.customer.name === 'Rahul Sharma'
    );

    // 8. Returning Customer Profile Recognition via Device Token
    const returnCustRes = await request('/customers/identify', {
      method: 'POST',
      body: { deviceToken: generatedDeviceToken }
    });
    recordTest(
      'Returning Customer Recognition',
      true,
      returnCustRes.data.recognized,
      returnCustRes.status === 200 && returnCustRes.data.recognized === true && returnCustRes.data.customer.name === 'Rahul Sharma'
    );

    // 9. Server-Side Price & Order Placement
    const firstItem = menuRes.data.items[0]; // e.g. Special Burger
    const testIdempKey = 'idemp_key_test_' + Date.now();
    const orderPayload = {
      qrToken: validQrToken,
      customerId: customerRes.data.customer.id,
      customerName: 'Rahul Sharma',
      customerPhone: '9876543210',
      items: [
        {
          menuItemId: firstItem.id,
          quantity: 2,
          customizations: []
        }
      ],
      specialInstructions: 'No onions, extra napkins',
      idempotencyKey: testIdempKey
    };

    const orderRes = await request('/orders', {
      method: 'POST',
      body: orderPayload
    });

    const createdOrder = orderRes.data.order;
    const expectedItemPrice = firstItem.offer_price !== null ? firstItem.offer_price : firstItem.price;
    const expectedTotal = expectedItemPrice * 2;

    recordTest(
      'Server-Side Price Validation & Order Placement',
      expectedTotal,
      createdOrder ? createdOrder.total : null,
      orderRes.status === 201 && createdOrder && createdOrder.total === expectedTotal
    );

    // 10. WhatsApp Prefilled Message Format Specification
    const waMsg = orderRes.data.whatsappMessage;
    const hasOrderNumber = waMsg && waMsg.includes(`Order No: #${createdOrder.order_number}`);
    const hasTableName = waMsg && waMsg.includes(`Table: ${tableRow.table_number}`);
    const hasInstructions = waMsg && waMsg.includes('No onions, extra napkins');
    const hasWaUrl = orderRes.data.whatsappUrl && orderRes.data.whatsappUrl.startsWith('https://wa.me/');

    recordTest(
      'WhatsApp Prefilled Message Compliance',
      true,
      Boolean(hasOrderNumber && hasTableName && hasInstructions && hasWaUrl),
      Boolean(hasOrderNumber && hasTableName && hasInstructions && hasWaUrl),
      `OrderNo: ${hasOrderNumber}, Table: ${hasTableName}, Instructions: ${hasInstructions}`
    );

    // 11. Idempotency Protection against Double-Click
    const duplicateOrderRes = await request('/orders', {
      method: 'POST',
      body: orderPayload // exact same payload with same idempotencyKey
    });

    recordTest(
      'Idempotency Duplicate Order Defense',
      createdOrder.id,
      duplicateOrderRes.data.order ? duplicateOrderRes.data.order.id : null,
      duplicateOrderRes.status === 200 &&
      duplicateOrderRes.data.isDuplicate === true &&
      duplicateOrderRes.data.order.id === createdOrder.id
    );

    // 12. Sold Out Item Ordering Prevention
    // Mark an item as sold out
    db.prepare('UPDATE menu_items SET is_available = 0 WHERE id = ?').run(firstItem.id);

    const soldOutOrderRes = await request('/orders', {
      method: 'POST',
      body: {
        qrToken: validQrToken,
        customerName: 'Aman',
        customerPhone: '9812345678',
        items: [{ menuItemId: firstItem.id, quantity: 1, customizations: [] }],
        idempotencyKey: 'idemp_key_soldout_test'
      }
    });

    // Restore item availability
    db.prepare('UPDATE menu_items SET is_available = 1 WHERE id = ?').run(firstItem.id);

    recordTest(
      'Sold-Out Item Protection',
      400,
      soldOutOrderRes.status,
      soldOutOrderRes.status === 400 && soldOutOrderRes.data.error.includes('sold out')
    );

    // 13. Customer Assistance Requests (Waiter, Water, Bill)
    const waiterRes = await request('/requests', {
      method: 'POST',
      body: {
        qrToken: validQrToken,
        requestType: 'WAITER'
      }
    });

    recordTest(
      'Customer Assistance Request (Waiter)',
      true,
      waiterRes.data.success,
      waiterRes.status === 201 && waiterRes.data.success === true
    );

    // 14. Assistance Request Rate Limiting / Cooldown
    const spamWaiterRes = await request('/requests', {
      method: 'POST',
      body: {
        qrToken: validQrToken,
        requestType: 'WAITER'
      }
    });

    recordTest(
      'Assistance Button Rate Limiting / Anti-Spam',
      429,
      spamWaiterRes.status,
      spamWaiterRes.status === 429
    );

    // 15. Kitchen Status Progression: NEW -> ACCEPTED -> PREPARING -> READY -> SERVED
    const acceptRes = await request(`/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      body: { status: 'ACCEPTED' }
    });

    const prepRes = await request(`/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      body: { status: 'PREPARING' }
    });

    const readyRes = await request(`/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      body: { status: 'READY' }
    });

    const servedRes = await request(`/orders/${createdOrder.id}/status`, {
      method: 'PATCH',
      body: { status: 'SERVED' }
    });

    recordTest(
      'Kitchen Order Lifecycle Progression',
      'SERVED',
      servedRes.data.order ? servedRes.data.order.status : null,
      acceptRes.status === 200 && prepRes.status === 200 && readyRes.status === 200 && servedRes.data.order.status === 'SERVED'
    );

    // 16. Customer Order Tracking API
    const trackRes = await request(`/orders/track/${createdOrder.order_number}`);
    recordTest(
      'Customer Order Tracking Endpoint',
      'SERVED',
      trackRes.data.order ? trackRes.data.order.status : null,
      trackRes.status === 200 && trackRes.data.order.order_number === createdOrder.order_number
    );

    // 17. Missed Orders Recovery Endpoint for PC Reconnection
    const activeOrdersRes = await request('/orders/active');
    recordTest(
      'PC Reconnection Missed Orders Recovery',
      true,
      Array.isArray(activeOrdersRes.data),
      activeOrdersRes.status === 200 && Array.isArray(activeOrdersRes.data)
    );

    // 18. Admin PIN Authentication Protection
    const unauthorizedTablesRes = await request('/tables', {
      headers: { 'x-admin-pin': 'wrong_pin_9999' }
    });
    recordTest(
      'Admin Endpoint PIN Protection',
      401,
      unauthorizedTablesRes.status,
      unauthorizedTablesRes.status === 401
    );

    const authorizedTablesRes = await request('/tables', {
      headers: { 'x-admin-pin': '1234' }
    });
    recordTest(
      'Admin Authorized Access',
      200,
      authorizedTablesRes.status,
      authorizedTablesRes.status === 200 && Array.isArray(authorizedTablesRes.data)
    );

    // 19. Table QR Token Regeneration
    const regenRes = await request(`/tables/${tableId}/regenerate-qr`, {
      method: 'POST',
      headers: { 'x-admin-pin': '1234' }
    });

    recordTest(
      'Admin Cryptographic QR Regeneration',
      true,
      regenRes.data.success,
      regenRes.status === 200 && Boolean(regenRes.data.newToken) && regenRes.data.newToken !== validQrToken
    );

    // Verify old token is now blocked
    const oldTokenBlockedRes = await request(`/tables/validate-qr/${validQrToken}`);
    recordTest(
      'Invalidation of Pre-Regeneration QR Token',
      404,
      oldTokenBlockedRes.status,
      oldTokenBlockedRes.status === 404
    );

    // 20. Table Session Cumulative Total & Closing
    const closeSessRes = await request(`/tables/${tableId}/close-session`, {
      method: 'POST',
      headers: { 'x-admin-pin': '1234' }
    });

    recordTest(
      'Table Session Closure & Table Reset',
      true,
      closeSessRes.data.success,
      closeSessRes.status === 200 && Boolean(closeSessRes.data.newSessionCode)
    );

    // 21. Analytics Reports Generation
    const reportsRes = await request('/analytics/reports', {
      headers: { 'x-admin-pin': '1234' }
    });

    recordTest(
      'Analytics & Financial Reports Generation',
      true,
      Boolean(reportsRes.data && reportsRes.data.totalOrders >= 1),
      reportsRes.status === 200 && reportsRes.data.totalOrders >= 1
    );

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    console.log('\n======================================================');
    const passedCount = testResults.filter(t => t.passed).length;
    const totalCount = testResults.length;
    console.log(` TEST SUMMARY: ${passedCount}/${totalCount} TESTS PASSED`);
    console.log('======================================================\n');

    server.close();
    process.exit(passedCount === totalCount ? 0 : 1);
  }
}

// Allow server a moment to start
setTimeout(runTests, 500);
