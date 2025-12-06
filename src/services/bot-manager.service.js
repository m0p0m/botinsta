const { botService } = require('./bot.service');

class BotManager {
  constructor() {
    this.bots = {};
    this.broadcast = null;
  }

  setBroadcastFunction(broadcastFunc) {
    this.broadcast = broadcastFunc;
    console.log('✅ Broadcast function set in BotManager');
  }

  async startBot(username, type, target, startTime, sortType = 'recent') {
    console.log(`[BOT MANAGER] Starting bot for ${username}, type: ${type}, target: ${target}`);
    
    if (this.bots[username]) {
      throw new Error(`ربات برای ${username} در حال اجرا است`);
    }

    // Update callback to send WebSocket messages
    const onUpdate = (status, message, data = {}) => {
      console.log(`[${username}] ${status}: ${message}`);
      
      const updateData = {
        status,
        message,
        username,
        target,
        sortType,
        likes: data.likes || 0,
        ...data
      };

      // Send update via WebSocket if available
      if (this.broadcast && typeof this.broadcast === 'function') {
        this.broadcast(updateData);
      }
    };

    try {
      // Start the bot
      botService.start(
        username,
        type,
        target,
        onUpdate,
        {
          sortType,
          delay_between_likes_ms: 3000,
          polling_delay: 5000
        },
        startTime
      );

      // Store bot reference
      this.bots[username] = {
        username,
        type,
        target,
        sortType,
        startTime: new Date(),
        status: 'running'
      };

      // Broadcast start event
      if (this.broadcast && typeof this.broadcast === 'function') {
        this.broadcast({
          status: 'starting',
          message: `🚀 در حال شروع ربات برای ${username}...`,
          username,
          target,
          sortType
        });
      }
      
    } catch (error) {
      console.error(`[BOT MANAGER] Failed to start bot:`, error);
      throw error;
    }
  }

  async stopBot(username) {
    console.log(`[BOT MANAGER] Stopping bot for ${username}`);
    
    if (this.bots[username]) {
      botService.stop(username);
      delete this.bots[username];
      
      // Broadcast stop event
      if (this.broadcast && typeof this.broadcast === 'function') {
        this.broadcast({
          status: 'stopped',
          message: `⏹️ ربات برای ${username} متوقف شد`,
          username
        });
      }
      
      return true;
    }
    
    return false;
  }

  async stopAllBots() {
    console.log('[BOT MANAGER] Stopping all bots...');
    const usernames = Object.keys(this.bots);
    
    for (const username of usernames) {
      await this.stopBot(username);
    }
  }

  getBotStatus(username = null) {
    if (username) {
      return this.bots[username] || null;
    }
    
    // Return first running bot or null
    const runningBots = Object.values(this.bots).filter(bot => bot.status === 'running');
    return runningBots.length > 0 ? runningBots[0] : null;
  }

  getRunningBots() {
    return Object.keys(this.bots).map(username => ({
      username,
      ...this.bots[username]
    }));
  }
}

module.exports = new BotManager();