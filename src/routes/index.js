const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');
const botManager = require('../services/bot-manager.service');
const { botService } = require('../services/bot.service');
const { hashtagService } = require('../services/hashtag.service');
const ErrorHandler = require('../services/error-handler.service');

// App-level authentication: protect routes behind a simple session-based login
const APP_USER = process.env.BASIC_AUTH_USER || 'admin';
const APP_PASS = process.env.BASIC_AUTH_PASSWORD || '';

// Public paths that do not require app auth
const PUBLIC_PATHS = [
  '/app-login',
  '/app-logout',
  '/favicon.ico',
  '/css',
  '/js',
  '/static',
  '/login',
  '/sw.js',
  '/debug-css'
];

router.use((req, res, next) => {
  // allow public assets and login page
  const p = req.path;
  // expose current path to views for active nav highlighting
  res.locals.currentPath = p;
  const isPublic = PUBLIC_PATHS.some(pp => p === pp || p.startsWith(pp));
  if (isPublic) return next();
  if (req.session && req.session.isAuthenticated) return next();
  return res.redirect('/app-login');
});

/**
 * Renders the main dashboard page.
 * Fetches all necessary data like accounts, profile, and hashtags.
 * @route GET /
 */
router.get('/', async (req, res) => {
  const accounts = await instagramService.getAccounts();
  const hashtags = await hashtagService.getHashtags();
  res.render('dashboard', {
    accounts,
    hashtags,
    selectedAccount: req.session.selectedUsername || null,
    error: req.query.error
  });
});

router.get('/accounts', async (req, res) => {
  const accounts = await instagramService.getAccounts();
  res.render('accounts', {
    accounts,
    selectedAccount: req.session.selectedUsername || null,
    error: req.query.error
  });
});
router.get('/hashtags', async (req, res) => {
  const hashtags = await hashtagService.getHashtags();
  res.render('hashtags', { hashtags, error: req.query.error });
});
router.get('/bot', async (req, res) => {
  const hashtags = await hashtagService.getHashtags();
  const accounts = await instagramService.getAccounts();
  res.render('bot', {
    selectedAccount: req.session.selectedUsername || null,
    hashtags: hashtags || [],
    accounts: accounts || [],
    error: req.query.error
  });
});

/**
 * Renders the login page.
 * @route GET /login
 */
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// App-level login page
router.get('/app-login', (req, res) => {
  res.render('app-login', { error: null, username: APP_USER });
});

router.post('/app-login', (req, res) => {
  const { username, password } = req.body;
  const user = username && username.trim() ? username.trim() : APP_USER;
  if (!password) {
    return res.render('app-login', { error: 'Password is required', username: user });
  }

  if (user === APP_USER && password === APP_PASS) {
    req.session.isAuthenticated = true;
    return res.redirect('/');
  }

  return res.render('app-login', { error: 'Invalid credentials', username: user });
});

router.post('/app-logout', (req, res) => {
  req.session.isAuthenticated = false;
  res.redirect('/app-login');
});

/**
 * Handles the addition of a new Instagram account.
 * Logs the user in and saves the session with comprehensive error handling.
 * @route POST /add-account
 */
router.post('/add-account', async (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.render('login', {
      error: '❌ نام کاربری و رمز عبور الزامی است'
    });
  }

  if (username.length < 3) {
    return res.render('login', {
      error: '❌ نام کاربری باید حداقل 3 کاراکتر باشد'
    });
  }

  if (password.length < 6) {
    return res.render('login', {
      error: '❌ رمز عبور باید حداقل 6 کاراکتر باشد'
    });
  }

  try {
    console.log(`[LOGIN] Login request for: ${username}`);
    const loggedInUser = await instagramService.login(username, password);

    req.session.selectedUsername = username;
    console.log(`[SUCCESS] Login successful, session saved\n`);

    return res.redirect('/?success=حساب با موفقیت اضافه شد');

  } catch (error) {
    ErrorHandler.logError('ورود حساب Instagram', error);

    const userFriendlyError = ErrorHandler.formatErrorForDisplay(error);
    return res.render('login', { error: userFriendlyError });
  }
});

/**
 * Switches the currently active Instagram account.
 * @route POST /switch-account
 */
router.post('/switch-account', (req, res) => {
  req.session.selectedUsername = req.body.username;
  res.redirect('/');
});

/**
 * Removes an Instagram account.
 * @route POST /remove-account
 */
router.post('/remove-account', async (req, res) => {
  const { username } = req.body;
  try {
    await instagramService.removeAccount(username);
    if (req.session.selectedUsername === username) {
      req.session.selectedUsername = null;
    }
    res.redirect('/');
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Adds a new hashtag to the list.
 * @route POST /add-hashtag
 */
router.post('/add-hashtag', async (req, res) => {
  const { hashtag } = req.body;
  try {
    await hashtagService.addHashtag(hashtag);
    res.redirect('/');
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Removes a hashtag from the list.
 * @route POST /remove-hashtag
 */
router.post('/remove-hashtag', async (req, res) => {
  const { hashtag } = req.body;
  try {
    await hashtagService.removeHashtag(hashtag);
    res.redirect('/');
  } catch (error) {
    res.redirect(`/?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Starts the Instagram bot.
 * @route POST /start
 */
router.use((req, res, next) => {
  // Attach WebSocket broadcast function
  if (req.wss) {
    req.broadcast = (data) => {
      req.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    };
  }
  next();
});

// در روت /start:
router.post('/start', async (req, res) => {
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    req.headers.accept?.includes('application/json');

  console.log('[DEBUG] POST /start - Body:', req.body);

  const username = req.body.username;
  const type = req.body.type;
  const target = req.body.target || '';
  const startTime = req.body.startTime || '';
  const sortType = req.body.sortType || 'recent';

  const selectedUsername = username || req.session?.selectedUsername;

  if (!selectedUsername) {
    const errorMsg = 'هیچ اکانتی انتخاب نشده است. لطفا ابتدا یک اکانت انتخاب کنید.';
    if (isAjax) {
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
    return res.redirect('/?error=' + encodeURIComponent(errorMsg));
  }

  if (!type || type.trim() === '') {
    const errorMsg = 'نوع عملیات را انتخاب کنید.';
    if (isAjax) {
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
    return res.redirect('/?error=' + encodeURIComponent(errorMsg));
  }

  if (type === 'hashtag' && !target) {
    const errorMsg = 'لطفا یک هشتگ انتخاب کنید.';
    if (isAjax) {
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
    return res.redirect('/?error=' + encodeURIComponent(errorMsg));
  }

  try {
    // شروع ربات
    await botManager.startBot(selectedUsername, type, target, startTime, sortType);

    if (isAjax) {
      return res.json({
        success: true,
        message: 'ربات با موفقیت شروع شد',
        username: selectedUsername,
        target,
        sortType
      });
    }

    res.redirect('/');
  } catch (error) {
    console.error(`[ERROR] Failed to start bot:`, error);
    const errorMsg = error.message || 'خطای نامشخص در شروع ربات';

    if (isAjax) {
      return res.status(500).json({
        success: false,
        error: errorMsg
      });
    }

    res.redirect(`/?error=${encodeURIComponent(errorMsg)}`);
  }
});

// در روت /stop:
router.post('/stop', async (req, res) => {
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    req.headers.accept?.includes('application/json');

  const username = req.body.username || req.session?.selectedUsername;

  if (!username) {
    const errorMsg = 'هیچ اکانتی انتخاب نشده است.';
    if (isAjax) {
      return res.status(400).json({
        success: false,
        error: errorMsg
      });
    }
    return res.redirect('/?error=' + encodeURIComponent(errorMsg));
  }

  try {
    await botManager.stopBot(username);

    if (isAjax) {
      return res.json({
        success: true,
        message: 'ربات با موفقیت متوقف شد'
      });
    }

    res.redirect('/');
  } catch (error) {
    console.error(`[ERROR] Failed to stop bot:`, error);
    const errorMsg = error.message || 'خطا در توقف ربات';

    if (isAjax) {
      return res.status(500).json({
        success: false,
        error: errorMsg
      });
    }

    res.redirect(`/?error=${encodeURIComponent(errorMsg)}`);
  }
});

/**
 * Stops the Instagram bot.
 * @route POST /stop
 */
router.post('/stop', async (req, res) => {
  const { username } = req.body;

  // Check if it's an AJAX request
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json');

  if (username) {
    try {
      await botManager.stopBot(username);

      // ارسال update برای تمام connected clients
      if (req.wss) {
        req.wss.clients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({ status: 'stopped', message: `ربات برای ${username} متوقف شد` }));
          }
        });
      }

      if (isAjax) {
        return res.json({ success: true, message: 'ربات با موفقیت متوقف شد' });
      }
    } catch (error) {
      console.error(`[ERROR] Failed to stop bot:`, error);
      if (isAjax) {
        return res.status(500).json({ error: error.message });
      }
    }
  }

  if (!isAjax) {
    res.redirect('/');
  } else {
    res.json({ success: true });
  }
});

module.exports = router;
