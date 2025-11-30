/**
 * Bot Manager Service
 * مدیریت اجرای ربات در background و ذخیره state
 */

const fs = require('fs').promises;
const path = require('path');
const { botService } = require('./bot.service');

const stateFile = path.join(__dirname, '..', '..', 'data', 'bot-state.json');

class BotManagerService {
  constructor() {
    this.activeBots = {};
    this.wss = null;
    this.loadState();
  }

  setWss(wss) {
    this.wss = wss;
  }

  /**
   * شروع ربات و ذخیره state
   */
  async startBot(username, type, target, startTime = null) {
    try {
      // ذخیره state
      await this.saveState(username, {
        username,
        type,
        target,
        startTime,
        status: 'running',
        startedAt: new Date().toISOString()
      });

      // شروع ربات
      botService.start(username, type, target, (status, message, meta) => {
        this.updateBotStatus(username, status, message, meta);
      }, {}, startTime);

      console.log(`✅ ربات برای ${username} شروع شد`);
      return true;
    } catch (error) {
      console.error('❌ خطا در شروع ربات:', error.message);
      throw error;
    }
  }

  /**
   * توقف ربات و پاک کردن state
   */
  async stopBot(username) {
    try {
      botService.stop(username);

      // حذف state
      await this.deleteState(username);

      console.log(`✅ ربات برای ${username} متوقف شد`);
      return true;
    } catch (error) {
      console.error('❌ خطا در توقف ربات:', error.message);
      throw error;
    }
  }

  /**
   * ذخیره state ربات
   */
  async saveState(username, botState) {
    try {
      const stateDir = path.dirname(stateFile);
      await fs.mkdir(stateDir, { recursive: true });

      let states = [];
      try {
        const content = await fs.readFile(stateFile, 'utf8');
        states = JSON.parse(content);
      } catch (e) {
        states = [];
      }

      // حذف state قدیمی
      states = states.filter(s => s.username !== username);

      // اضافه کردن state جدید
      states.push(botState);

      await fs.writeFile(stateFile, JSON.stringify(states, null, 2));
      console.log(`💾 state برای ${username} ذخیره شد`);
    } catch (error) {
      console.error('❌ خطا در ذخیره state:', error.message);
    }
  }

  /**
   * حذف state ربات
   */
  async deleteState(username) {
    try {
      let states = [];
      try {
        const content = await fs.readFile(stateFile, 'utf8');
        states = JSON.parse(content);
      } catch (e) {
        return;
      }

      states = states.filter(s => s.username !== username);
      await fs.writeFile(stateFile, JSON.stringify(states, null, 2));
    } catch (error) {
      console.error('❌ خطا در حذف state:', error.message);
    }
  }

  /**
   * بارگیری state‌های ذخیره شده و شروع ربات‌ها
   */
  async loadState() {
    try {
      const content = await fs.readFile(stateFile, 'utf8');
      const states = JSON.parse(content);

      console.log(`\n📂 درحال بارگیری ${states.length} ربات از state...`);

      for (const state of states) {
        if (state.status === 'running') {
          console.log(`🚀 شروع ربات برای ${state.username}...`);
          botService.start(state.username, state.type, state.target, (status, message, meta) => {
            this.updateBotStatus(state.username, status, message, meta);
          }, {}, state.startTime);
        }
      }

      console.log(`✅ ${states.length} ربات بارگیری شد\n`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('⚠️ خطا در بارگیری state:', error.message);
      }
    }
  }

  /**
   * به‌روزرسانی status ربات
   */
  updateBotStatus(username, status, message, meta = {}) {
    const payload = Object.assign({ username, status, message }, meta);
    console.log(`[${username}] ${status}: ${message}`);

    // broadcast to all connected websocket clients if available
    try {
      if (this.wss && this.wss.clients) {
        this.wss.clients.forEach(client => {
          if (client.readyState === 1) {
            try {
              client.send(JSON.stringify(payload));
            } catch (e) {
              // ignore send errors for individual clients
            }
          }
        });
      }
    } catch (e) {
      console.error('⚠️ Error broadcasting bot status via WebSocket:', e.message);
    }
  }

  /**
   * دریافت وضعیت ربات
   */
  getBotStatus(username) {
    return botService.jobs[username] || null;
  }

  /**
   * دریافت تمام ربات‌های فعال
   */
  getActiveBots() {
    return Object.keys(botService.jobs);
  }
}

module.exports = new BotManagerService();
