const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');

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

router.post('/add-account', async (req, res) => {
  const { username, password } = req.body;
  try {
    await instagramService.login(username, password);
    req.session.selectedUsername = username;
    res.redirect('/');
  } catch (error) {
    res.status(400).send(error.message);
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
