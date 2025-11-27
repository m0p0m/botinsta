const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const expressLayouts = require('express-ejs-layouts');

const { instagramService } = require('./services/instagram.service');
const Logger = require('./services/logger.service');
const routes = require('./routes/index');

// Initialize Express and HTTP Server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware - Static Files
app.use(express.static(path.join(__dirname, 'public')));

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
  console.log('🤖 ربات اینستاگرام');
  console.log('='.repeat(60));
  console.log(`✓ سرور در حال اجرا است: http://localhost:${port}`);
  console.log('📱 آپ Instagram را باز کنید و آماده‌ی تأیید دو مرحله‌ای باشید');
  console.log('='.repeat(60) + '\n');
});
