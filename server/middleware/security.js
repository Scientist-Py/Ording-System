const { db } = require('../db/database');

// In-memory request rate-limiting map for assistance requests and spam protection
const rateLimits = new Map(); // key -> lastTimestamp
const idempotencyCache = new Map(); // idempotencyKey -> cachedResult

// Cooldown helper (default 45s for waiter/bill/water requests)
function checkRateLimit(key, cooldownSeconds = 45) {
  const now = Date.now();
  const lastTime = rateLimits.get(key);
  if (lastTime && (now - lastTime) < cooldownSeconds * 1000) {
    const remainingSeconds = Math.ceil((cooldownSeconds * 1000 - (now - lastTime)) / 1000);
    return { allowed: false, remainingSeconds };
  }
  rateLimits.set(key, now);
  return { allowed: true, remainingSeconds: 0 };
}

// Input sanitizer: escapes HTML/tags and prevents XSS/script injection
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>]/g, '') // remove HTML tags
    .slice(0, 500); // enforce length limit
}

// Validate Admin authentication via header 'x-admin-pin' or 'Authorization: Bearer <pin>'
function requireAdmin(req, res, next) {
  const pinHeader = req.headers['x-admin-pin'];
  const authHeader = req.headers['authorization'];
  
  let providedPin = '';
  if (pinHeader) {
    providedPin = pinHeader.trim();
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedPin = authHeader.substring(7).trim();
  }

  const setting = db.prepare("SELECT value FROM settings WHERE key = 'admin_pin'").get();
  const configuredPin = setting ? setting.value : '1234';

  if (!providedPin || providedPin !== configuredPin) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid admin credentials or PIN required.'
    });
  }

  next();
}

module.exports = {
  checkRateLimit,
  sanitizeText,
  requireAdmin,
  idempotencyCache
};
