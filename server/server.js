require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const { initDb } = require('./db/database');
const { initWebSocket } = require('./services/websocket');

// Route handlers
const tablesRouter = require('./routes/tables');
const menuRouter = require('./routes/menu');
const customersRouter = require('./routes/customers');
const ordersRouter = require('./routes/orders');
const requestsRouter = require('./routes/requests');
const analyticsRouter = require('./routes/analytics');
const settingsRouter = require('./routes/settings');

// Initialize database
initDb();

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
initWebSocket(server);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Chapter One Cafe Standalone Ordering System',
    timestamp: new Date().toISOString()
  });
});

// Network & Customer Access Info
const os = require('os');
app.get('/api/system/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
  }
  const currentPort = process.env.PORT || 4000;
  res.json({
    localIp,
    port: currentPort,
    customerWebUrl: `http://${localIp}:${currentPort}`,
    localhostUrl: `http://localhost:${currentPort}`
  });
});

// Mount Routes
app.use('/api/tables', tablesRouter);
app.use('/api/menu', menuRouter);
app.use('/api/customers', customersRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);

// Serve production static frontend if built
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDistPath));

// Fallback SPA routing handler
app.use((req, res, next) => {
  // If request starts with /api or /ws, ignore
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In dev mode when client isn't built yet, respond with API info
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Chapter One Cafe Server</title></head>
          <body style="font-family:sans-serif; text-align:center; padding: 50px; background:#fbf9f6; color:#2f1e19;">
            <h2>Chapter One Cafe Server is Active</h2>
            <p>API & WebSocket are ready on port ${PORT}.</p>
            <p><a href="/api/health">Check API Health</a></p>
          </body>
        </html>
      `);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[Server] Port ${PORT} is already in use. Reusing existing running server.`);
  } else {
    console.error('[Server Error]', err);
  }
});
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CHAPTER ONE CAFE — STANDALONE SERVER STARTED`);
  console.log(` HTTP & API: http://localhost:${PORT}`);
  console.log(` WebSocket:  ws://localhost:${PORT}/ws`);
  console.log(`====================================================`);
});

module.exports = { app, server };
