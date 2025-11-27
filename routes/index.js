const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');
const { botService } = require('../services/bot.service');
const { hashtagService } = require('../services/hashtag.service');
const ErrorHandler = require('../services/error-handler.service');

router.get('/', async (req, res) => {
  const accounts = await instagramService.getAccounts();
  if (accounts.length === 0) {
    res.render('login');
  } else {
    const selectedAccount = accounts.find(acc => acc.username === req.session.selectedUsername) || accounts[0];
    const profile = await instagramService.getProfileData(selectedAccount.username);
    res.render('dashboard', { accounts, selectedAccount, profile });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    await instagramService.login(username, password);
    req.session.selectedUsername = username;
    res.redirect('/');
  } catch (error) {
    res.status(400).send(error.message);
  }
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
    res.status(400).send(error.message);
    ErrorHandler.logError('ورود حساب Instagram', error);
    
    const userFriendlyError = ErrorHandler.formatErrorForDisplay(error);
    return res.render('login', { error: userFriendlyError });
  }
});

router.post('/switch-account', (req, res) => {
  req.session.selectedUsername = req.body.username;
  res.redirect('/');
});

router.post('/start', (req, res) => {
  const { username, hashtag } = req.body;
  instagramService.likeCommentsByHashtag(username, hashtag, (status, message) => {
    req.wss.clients.forEach(client => {
      client.send(JSON.stringify({ status, message }));
    });
  });
  res.redirect('/');
});

module.exports = router;
