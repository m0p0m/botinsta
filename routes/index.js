const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');
const { botService } = require('../services/bot.service');
const { hashtagService } = require('../services/hashtag.service');

/**
 * Renders the main dashboard page.
 * Fetches all necessary data like accounts, profile, and hashtags.
 * @route GET /
 */
router.get('/', async (req, res) => {
  try {
    const accounts = await instagramService.getAccounts();
    const hashtags = await hashtagService.getHashtags();
    let selectedAccount = null;
    let profile = null;

    if (accounts && accounts.length > 0) {
      selectedAccount = accounts.find(acc => acc.username === req.session.selectedUsername) || accounts[0];
      
      try {
        profile = await instagramService.getProfileData(selectedAccount.username);
      } catch (profileError) {
        console.warn('Profile fetch error:', profileError.message);
        profile = {
          followers: 0,
          following: 0,
          posts: 0,
          profile_pic_url: '',
          full_name: selectedAccount.username,
          biography: 'Profile not loaded'
        };
      }
    }

    res.render('dashboard', {
      accounts: accounts || [],
      selectedAccount,
      profile,
      hashtags: hashtags || [],
      error: req.query.error
    });
  } catch (error) {
    console.error('Dashboard route error:', error);
    res.render('dashboard', {
      accounts: [],
      selectedAccount: null,
      profile: null,
      hashtags: [],
      error: 'An error occurred. Please try again.'
    });
  }
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
 * Logs the user in and saves the session.
 * @route POST /add-account
 */
router.post('/add-account', async (req, res) => {
  const { username, password } = req.body;
  try {
    await instagramService.login(username, password);
    req.session.selectedUsername = username;
    res.redirect('/');
  } catch (error) {
    res.render('login', { error: error.message });
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
