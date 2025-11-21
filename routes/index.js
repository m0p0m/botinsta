const express = require('express');
const router = express.Router();
const { instagramService } = require('../services/instagram.service');
const { botService } = require('../services/bot');

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
  const { username, type, target } = req.body;
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

module.exports = router;
