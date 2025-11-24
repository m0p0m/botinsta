const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');
const { botService } = require('../services/bot');
const { IgLoginTwoFactorRequiredError, IgLoginBadPasswordError } = require('instagram-private-api');

router.get('/', async (req, res) => {
  const accounts = await instagramService.getAccounts();
  const hashtags = await instagramService.getHashtags();
  let selectedAccount = null;
  let profile = null;

  if (accounts.length > 0) {
    selectedAccount = accounts.find(acc => acc.username === req.session.selectedUsername) || accounts[0];
    profile = await instagramService.getProfileData(selectedAccount.username);
  }

  res.render('dashboard', { accounts, selectedAccount, profile, hashtags });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    await instagramService.login(username, password);
    req.session.selectedUsername = username;
    res.redirect('/');
  } catch (error) {
    if (error instanceof IgLoginTwoFactorRequiredError || error.message.includes('challenge_required')) {
      const accounts = await instagramService.getAccounts();
      const hashtags = await instagramService.getHashtags();
      res.render('dashboard', { accounts, selectedAccount: null, profile: null, hashtags, error: 'Challenge required. Please log in to your Instagram account on your phone to complete the security check.' });
    } else if (error instanceof IgLoginBadPasswordError) {
      const accounts = await instagramService.getAccounts();
      const hashtags = await instagramService.getHashtags();
      res.render('dashboard', { accounts, selectedAccount: null, profile: null, hashtags, error: 'Incorrect password.' });
    } else {
      res.status(400).send(error.message);
    }
  }
});

router.post('/add-account', async (req, res) => {
  const { username, password } = req.body;
  try {
    await instagramService.login(username, password);
    req.session.selectedUsername = username;
    res.redirect('/');
  } catch (error) {
    if (error instanceof IgLoginTwoFactorRequiredError || error.message.includes('challenge_required')) {
      const accounts = await instagramService.getAccounts();
      const hashtags = await instagramService.getHashtags();
      res.render('dashboard', { accounts, selectedAccount: null, profile: null, hashtags, error: 'Challenge required. Please log in to your Instagram account on your phone to complete the security check.' });
    } else if (error instanceof IgLoginBadPasswordError) {
      const accounts = await instagramService.getAccounts();
      const hashtags = await instagramService.getHashtags();
      res.render('dashboard', { accounts, selectedAccount: null, profile: null, hashtags, error: 'Incorrect password.' });
    } else {
      res.status(400).send(error.message);
    }
  }
});

router.post('/switch-account', (req, res) => {
  req.session.selectedUsername = req.body.username;
  res.redirect('/');
});

router.post('/start', (req, res) => {
  const { username, type, target, startTime } = req.body;
  botService.start(username, type, target, (status, message) => {
    req.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ status, message }));
      }
    });
  });
  res.redirect('/');
});

router.post('/stop', (req, res) => {
  const { username } = req.body;
  botService.stop(username);
  res.redirect('/');
});

router.post('/add-hashtag', async (req, res) => {
  const { hashtag } = req.body;
  await instagramService.addHashtag(hashtag);
  res.redirect('/');
});

router.post('/remove-hashtag', async (req, res) => {
  const { hashtag } = req.body;
  await instagramService.removeHashtag(hashtag);
  res.redirect('/');
});

module.exports = router;
