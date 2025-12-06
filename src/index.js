require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const expressLayouts = require('express-ejs-layouts');

const { instagramService } = require('./services/instagram.service');
const Logger = require('./services/logger.service');
const botManager = require('./services/bot-manager.service');
const routes = require('./routes/index');

// Initialize Express and HTTP Server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket client connected');

  // ارسال وضعیت اولیه
  const botStatus = botManager.getBotStatus();
  const statusData = {
    status: botStatus ? 'running' : 'idle',
    message: botStatus ? `ربات در حال اجرا برای ${botStatus.username}` : 'ربات آماده است',
    ...botStatus
  };

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(statusData));
  }

  // پردازش پیام‌های دریافتی از کلاینت
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 WebSocket message received:', data);

      if (data.type === 'status_request') {
        const botStatus = botManager.getBotStatus();
        ws.send(JSON.stringify({
          status: botStatus ? 'running' : 'idle',
          message: botStatus ? `ربات در حال اجرا برای ${botStatus.username}` : 'ربات آماده است',
          ...botStatus
        }));
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔗 WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// تعریف broadcast function
function broadcast(data) {
  console.log('📢 Broadcasting to', wss.clients.size, 'clients:', data);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(data));
      } catch (error) {
        console.error('❌ Error broadcasting to client:', error);
      }
    }
  });
}

// وصل کردن broadcast به botManager
botManager.setBroadcastFunction(broadcast);

// Configure View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Asset version used to bust cache after server restarts (development)
app.locals.assetVersion = Date.now();

// Middleware - Static Files with No-Cache headers for CSS
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: 0,
  setHeaders: (res, path) => {
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
    }
  }
}));

// Middleware - Logger
app.use(Logger.middleware());

// Middleware - Body Parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware - Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-change-this',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware - WebSocket
app.use((req, res, next) => {
  req.wss = wss;
  req.broadcast = broadcast;
  next();
});

// Routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).render('error', {
    error: 'خطای سرور',
    message: err.message || 'خطای نامشخص رخ داده است'
  });
});

// Start Server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Instagram Bot');
  console.log('='.repeat(60));
  console.log(`✓ Server running at: http://localhost:${port}`);
  console.log(`✓ WebSocket available at: ws://localhost:${port}`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Server shutting down...');

  // Stop all running bots
  await botManager.stopAllBots();

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});