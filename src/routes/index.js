const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');
const { botService } = require('../services/bot.service');
const { hashtagService } = require('../services/hashtag.service');
const ErrorHandler = require('../services/error-handler.service');

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
    hashtags,
    accounts,
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
    console.log(`\n🔄 درخواست ورود: ${username}`);
    const loggedInUser = await instagramService.login(username, password);
    
    req.session.selectedUsername = username;
    console.log(`✅ ورود موفق و Session ذخیره شد\n`);
    
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
router.post('/start', (req, res) => {
  const { username, type, target, startTime } = req.body;
  if (!username) {
    return res.redirect('/?error=No account selected.');
  }

  botService.start(username, type, target, (status, message) => {
    req.wss.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify({ status, message }));
      }
    });
  }, {}, startTime);

  res.redirect('/');
});

/**
 * Stops the Instagram bot.
 * @route POST /stop
 */
router.post('/stop', (req, res) => {
  const { username } = req.body;
  if (username) {
    botService.stop(username);
  }
  res.redirect('/');
});

module.exports = router;
