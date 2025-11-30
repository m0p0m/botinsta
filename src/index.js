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

// expose wss to bot manager for broadcasting background updates
const botManagerInstance = require('./services/bot-manager.service');
if (botManagerInstance && typeof botManagerInstance.setWss === 'function') {
  botManagerInstance.setWss(wss);
}

// Configure View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Asset version used to bust cache after server restarts (development)
app.locals.assetVersion = Date.now();

// Middleware - Static Files with No-Cache headers for CSS
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: 0, // No cache for static files during development
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

// Middleware - Session
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Middleware - WebSocket
app.use((req, res, next) => {
  req.wss = wss;
  next();
});

// Routes
app.use('/', routes);

// Static Middleware for CSS DEBUG
app.get('/debug-css', (req, res) => {
  const pathDebug = require('path');
  const cssPath = pathDebug.join(__dirname, 'public', 'css', 'style.css');
  try {
    res.sendFile(cssPath, (err) => {
      if (err) {
        console.error('Sending /css/style.css failed:', err);
        res.status(500).send('ERROR sending CSS file');
      }
    });
  } catch (e) {
    console.error('Exception in /debug-css:', e);
    res.status(500).send('Exception occurred');
  }
});

// Start Server
const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Instagram Bot');
  console.log('='.repeat(60));
  console.log(`✓ Server running at: http://localhost:${port}`);
  console.log('📱 Open Instagram app and be ready for 2FA verification');
  console.log('='.repeat(60) + '\n');

  // Load persisted state and resume background bots
  botManager.loadState();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Server shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

