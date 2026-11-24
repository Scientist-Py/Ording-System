const { WebSocketServer } = require('ws');

let wss = null;
const clients = new Map(); // ws -> { role, tableId, orderNumber, connectedAt }

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[WS] Port already in use, reusing existing WebSocket.');
    } else {
      console.error('[WS Error]', err);
    }
  });

  wss.on('connection', (ws, req) => {
    const clientInfo = {
      role: 'guest',
      tableId: null,
      orderNumber: null,
      connectedAt: new Date().toISOString()
    };
    clients.set(ws, clientInfo);

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(ws, data);
      } catch (err) {
        console.error('[WS] Invalid JSON received:', err.message);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client socket error:', err.message);
      clients.delete(ws);
    });

    // Send connection greeting
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      serverTime: new Date().toISOString()
    }));
  });

  // Heartbeat interval to clean up stale connections
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 20000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WS] WebSocket server initialized on /ws');
}

function handleClientMessage(ws, data) {
  const info = clients.get(ws);
  if (!info) return;

  switch (data.action) {
    case 'REGISTER_ROLE':
      info.role = data.role || 'guest';
      if (data.tableId) info.tableId = data.tableId;
      if (data.orderNumber) info.orderNumber = data.orderNumber;
      clients.set(ws, info);
      ws.send(JSON.stringify({
        type: 'ROLE_REGISTERED',
        role: info.role,
        registeredAt: new Date().toISOString()
      }));
      break;

    case 'SUBSCRIBE_ORDER':
      info.orderNumber = data.orderNumber;
      clients.set(ws, info);
      break;

    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      break;

    default:
      break;
  }
}

// Broadcast helper for kitchen/admin and all listeners (Zero delay broadcast)
function broadcastToKitchen(type, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  console.log(`[WS Broadcast] ${type} sent to ${wss.clients.size} connected client(s)`);
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

// Broadcast order updates to all listeners (Zero delay broadcast)
function broadcastOrderUpdate(order) {
  if (!wss) return;
  const message = JSON.stringify({
    type: 'ORDER_STATUS_CHANGED',
    payload: order,
    timestamp: new Date().toISOString()
  });
  console.log(`[WS Broadcast] ORDER_STATUS_CHANGED (#${order.order_number} -> ${order.status}) sent to ${wss.clients.size} client(s)`);
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

// Broadcast general events to all active connections
function broadcastToAll(type, payload) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  for (const ws of clients.keys()) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

module.exports = {
  initWebSocket,
  broadcastToKitchen,
  broadcastOrderUpdate,
  broadcastToAll
};
