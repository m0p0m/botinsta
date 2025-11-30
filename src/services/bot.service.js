const { instagramService } = require('./instagram.service');
const { IgActionSpamError } = require('instagram-private-api');

class BotService {
  constructor() {
    this.jobs = {};
  }

  /**
   * Starts a new bot job for a given user.
   * @param {string} username - The Instagram username.
   * @param {string} type - The type of job ('hashtag' or 'explore').
   * @param {string} target - The hashtag to target (if type is 'hashtag').
   * @param {function} onUpdate - Callback function to send status updates.
   * @param {object} options - Configuration options for the bot.
   * @param {string} startTime - Optional time to schedule the bot start (HH:MM).
   */
  start(username, type, target, onUpdate, options = {}, startTime = null) {
    if (this.jobs[username]) {
      this.stop(username);
    }

    const total_likes_target = options.total_likes_target;
    const time_period_hours = options.time_period_hours;
    // allow explicit override, otherwise compute if both values provided, otherwise default to 2500ms
    const delay_between_likes_ms = options.delay_between_likes_ms ||
      (total_likes_target && time_period_hours ? (time_period_hours * 60 * 60 * 1000) / total_likes_target : 2500);

    const job = {
      username,
      type,
      target,
      onUpdate,
      status: 'running',
      likes: 0,
      stop: false,
      rate_limit_pause: options.rate_limit_pause || 4 * 60 * 60 * 1000,
      polling_delay: options.polling_delay || 3 * 1000,
      delay_between_likes_ms,
      sortType: options.sortType || 'recent', // 'recent' or 'top'
    };

    this.jobs[username] = job;

    if (startTime) {
      const [hours, minutes] = startTime.split(':');
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

      if (startDate < now) {
        startDate.setDate(startDate.getDate() + 1);
      }

      const delay = startDate.getTime() - now.getTime();
      job.onUpdate('scheduled', `⏰ Bot scheduled to start at ${startDate.toLocaleTimeString()}`);

      setTimeout(() => {
        job.onUpdate('running', `🚀 Bot started for @${username}.`);
        this.run(username);
      }, delay);
    } else {
      const sortTypeText = job.sortType === 'top' ? 'برترین' : 'جدیدترین';
      job.onUpdate('running', `🚀 ربات شروع شد! در حال جستجوی ${sortTypeText} پست‌های #${job.target}...`);
      this.run(username);
    }
  }

  /**
   * Stops a running bot job.
   * @param {string} username - The Instagram username.
   */
  stop(username) {
    if (this.jobs[username]) {
      this.jobs[username].stop = true;
      this.jobs[username].onUpdate('idle', `Bot stopping for ${username}.`);
    }
  }

  /**
   * The main run loop for a bot job.
   * @param {string} username - The Instagram username.
   */
  async run(username) {
    const job = this.jobs[username];
    if (!job || job.stop) {
      delete this.jobs[username];
      if (job) job.onUpdate('idle', '⏹️ ربات متوقف شد.');
      return;
    }

    try {
      if (job.status === 'running') {
        if (job.type === 'hashtag') {
          await this.likeCommentsByHashtag(job);
        } else if (job.type === 'explore') {
          await this.likeCommentsFromExplore(job);
        }
      }
    } catch (error) {
      console.error(`[${job.username}] Error in bot run:`, error);
      job.onUpdate('error', `❌ خطا در اجرای ربات: ${error.message}`);
    }

    if (!job.stop) {
      if (job.status === 'running') {
        const waitSeconds = Math.round(job.polling_delay / 1000);
        job.onUpdate('idle', `⏳ منتظر ${waitSeconds} ثانیه قبل از بررسی پست‌های جدید...`);
        setTimeout(() => this.run(username), job.polling_delay);
      }
    } else {
      delete this.jobs[username];
      job.onUpdate('idle', '⏹️ ربات متوقف شد.');
    }
  }

  async likeCommentsByHashtag(job) {
    const sortTypeText = job.sortType === 'top' ? 'برترین' : 'جدیدترین';
    job.onUpdate('running', `🏷️ در حال دریافت ${sortTypeText} پست‌های هشتگ: #${job.target}`);
    const feed = await instagramService.getHashtagFeed(job.username, job.target, job.sortType);

    // fetch first page of items then iterate; some feeds return isMoreAvailable() === false initially
    let items;
    try {
      items = await feed.items();
    } catch (e) {
      console.error(`[${job.username}] Error fetching items from hashtag feed #${job.target}:`, e.message || e);
      job.onUpdate('error', `خطا در گرفتن پست‌ها برای هشتگ #${job.target}: ${e.message || e}`);
      return;
    }
    console.log(`[${job.username}] fetched ${items?.length || 0} items from hashtag #${job.target} (${job.sortType})`);
    if (!items || items.length === 0) {
      job.onUpdate('idle', `هیچ پستی برای هشتگ #${job.target} یافت نشد.`);
      return;
    }
    
    job.onUpdate('running', `✅ ${items.length} پست ${sortTypeText} پیدا شد. شروع به پردازش...`);

    for (const item of items) {
      if (job.stop || job.status !== 'running') break;
      await this.processPost(job, item);
    }

    while (feed.isMoreAvailable()) {
      try {
        items = await feed.items();
      } catch (e) {
        console.error(`[${job.username}] Error fetching next page of hashtag feed #${job.target}:`, e.message || e);
        break;
      }
      console.log(`[${job.username}] fetched ${items?.length || 0} items from next page of #${job.target}`);
      if (!items || items.length === 0) break;
      for (const item of items) {
        if (job.stop || job.status !== 'running') break;
        await this.processPost(job, item);
      }
      if (job.stop || job.status !== 'running') break;
    }
  }

  async likeCommentsFromExplore(job) {
    job.onUpdate('running', `🔍 Fetching posts from explore feed.`);
    const feed = await instagramService.getExploreFeed(job.username);

    let items;
    try {
      items = await feed.items();
    } catch (e) {
      console.error(`[${job.username}] Error fetching explore feed items:`, e.message || e);
      job.onUpdate('error', `خطا در گرفتن پست‌ها از اکسپلور: ${e.message || e}`);
      return;
    }
    console.log(`[${job.username}] fetched ${items?.length || 0} items from explore feed`);
    if (!items || items.length === 0) {
      job.onUpdate('idle', 'هیچ پستی در فید اکسپلور یافت نشد.');
      return;
    }

    for (const item of items) {
      if (job.stop || job.status !== 'running') break;
      await this.processPost(job, item);
    }

    while (feed.isMoreAvailable()) {
      try {
        items = await feed.items();
      } catch (e) {
        console.error(`[${job.username}] Error fetching next page of explore feed:`, e.message || e);
        break;
      }
      console.log(`[${job.username}] fetched ${items?.length || 0} items from next page of explore feed`);
      if (!items || items.length === 0) break;
      for (const item of items) {
        if (job.stop || job.status !== 'running') break;
        await this.processPost(job, item);
      }
      if (job.stop || job.status !== 'running') break;
    }
  }

  async processPost(job, item) {
    const postId = item.pk;
    const posterUsername = item.user?.username || 'Unknown';
    // try to use shortcode/code if present to build public URL
    const shortcode = item.code || item.code_with_id || item.shortcode || null;
    const postLink = shortcode ? `https://www.instagram.com/p/${shortcode}/` : (postId ? `https://www.instagram.com/p/${postId}/` : null);

    job.onUpdate('processing', `📄 در حال پردازش پست از @${posterUsername}...`, { postLink });

    let comments = [];
    try {
      const commentsFeed = await instagramService.getPostComments(job.username, postId);
      comments = await commentsFeed.items();
    } catch (e) {
      console.error(`[${job.username}] Error fetching comments for post ${postId}:`, e.message || e);
      job.onUpdate('error', `❌ خطا در گرفتن کامنت‌های پست: ${e.message || e}`, { postLink });
      return;
    }

    console.log(`[${job.username}] post ${postId} has ${comments?.length || 0} comments`);

    if (!comments || comments.length === 0) {
      job.onUpdate('idle', `⚠️ این پست کامنتی ندارد`, { postLink });
      return;
    }

    job.onUpdate('processing', `💬 پیدا شد ${comments.length} کامنت. شروع به لایک...`, { postLink });

    let commentLikesCount = 0;
    for (const comment of comments) {
      if (job.stop || job.status !== 'running') break;
      commentLikesCount += await this.likeComment(job, comment, postId, postLink);
    }

    if (commentLikesCount > 0) {
      job.onUpdate('post_completed', `✅ پست از @${posterUsername}: ${commentLikesCount} کامنت لایک شد | مجموع: ${job.likes} لایک`, { postLink, likes: job.likes });
    } else {
      job.onUpdate('idle', `⚠️ پست پردازش شد اما کامنتی لایک نشد`, { postLink });
    }
  }

  async likeComment(job, comment, postId, postLink = null) {
    try {
      const commentUsername = comment.user?.username || 'ناشناس';
      console.log(`[${job.username}] attempting to like comment ${comment.pk} by @${commentUsername} on post ${postId}`);
      
      await instagramService.likeComment(job.username, comment.pk);
      job.likes++;
      console.log(`[${job.username}] liked comment ${comment.pk} (total likes: ${job.likes})`);
      
      job.onUpdate('liked', `❤️ کامنت از @${commentUsername} لایک شد | مجموع: ${job.likes} لایک`, { postLink, likes: job.likes });
      
      await new Promise(resolve => setTimeout(resolve, job.delay_between_likes_ms));
      return 1;
    } catch (error) {
      if (error instanceof IgActionSpamError) {
        job.status = 'paused';
        const pauseMinutes = Math.round(job.rate_limit_pause / (60 * 1000));
        job.onUpdate('paused', `⏸️ محدودیت نرخ! ربات برای ${pauseMinutes} دقیقه متوقف می‌شود.`);
        setTimeout(() => this.testLike(job), job.rate_limit_pause);
      } else {
        console.error(`[${job.username}] Error liking comment:`, error.message);
        job.onUpdate('error', `❌ خطا در لایک کامنت: ${error.message}`, { postLink });
      }
      return 0;
    }
  }

  async testLike(job) {
    job.onUpdate('running', 'Attempting a test like...');
    try {
      const exploreFeed = await instagramService.getExploreFeed(job.username);
      const items = await exploreFeed.items();
      if (items.length > 0) {
        const commentsFeed = await instagramService.getPostComments(job.username, items[0].pk);
        const comments = await commentsFeed.items();
        if (comments.length > 0) {
          await instagramService.likeComment(job.username, comments[0].pk);
          job.onUpdate('running', 'Test like successful. Resuming bot.');
          job.status = 'running';
          this.run(job.username);
        } else {
          throw new Error('No comments found to test like.');
        }
      } else {
        throw new Error('No posts found in explore feed to test like.');
      }
    } catch (error) {
      job.onUpdate('paused', `Test like failed. Pausing again. ${error.message}`);
      setTimeout(() => this.testLike(job), job.rate_limit_pause);
    }
  }
}

module.exports = { BotService, botService: new BotService() };
