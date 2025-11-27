const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');

const { instagramService } = require('./services/instagram.service');
const Logger = require('./services/logger.service');
const routes = require('./routes/index');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));


// Middleware - Logger
app.use(Logger.middleware());

// Middleware - Body Parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.use((req, res, next) => {
  req.wss = wss;
  next();
});

app.use('/', routes);

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 ربات اینستاگرام');
  console.log('='.repeat(60));
  console.log(`✓ سرور در حال اجرا است: http://localhost:${port}`);
  console.log('📱 آپ Instagram را باز کنید و آماده‌ی تأیید دو مرحله‌ای باشید');
  console.log('='.repeat(60) + '\n');
});
