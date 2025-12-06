const { instagramService } = require('./instagram.service');
const { IgActionSpamError } = require('instagram-private-api');
const { getHashtagPostsScrape } = require('./hashtag-automation.service');

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

    // بررسی توقف
    if (!job || job.stop) {
      if (job) {
        job.onUpdate('idle', '⏹️ ربات متوقف شد.');
        delete this.jobs[username];
      }
      return;
    }

    // بررسی pause status
    if (job.status === 'paused') {
      console.log(`[${job.username}] Bot is paused, skipping cycle`);
      setTimeout(() => this.run(username), job.polling_delay);
      return;
    }

    try {
      console.log(`[${job.username}] Starting bot cycle...`);

      if (job.type === 'hashtag') {
        await this.likeCommentsByHashtag(job);
      } else if (job.type === 'explore') {
        await this.likeCommentsFromExplore(job);
      }

      // لاگ موفقیت
      console.log(`[${job.username}] Cycle completed successfully`);

    } catch (error) {
      console.error(`[${job.username}] Error in bot cycle:`, error);
      job.onUpdate('error', `❌ خطا در اجرای ربات: ${error.message}`);

      // اگر خطا از نوع rate limit است، pause کن
      if (error.name === 'IgActionSpamError' || error.message.includes('rate limit')) {
        job.status = 'paused';
        const pauseMinutes = Math.round(job.rate_limit_pause / (60 * 1000));
        job.onUpdate('paused', `⏸️ محدودیت نرخ! ربات برای ${pauseMinutes} دقیقه متوقف می‌شود.`);
        setTimeout(() => {
          job.status = 'running';
          job.onUpdate('running', '🔄 از سرگیری ربات...');
          this.run(username);
        }, job.rate_limit_pause);
        return;
      }
    }

    // ادامه چرخه بعد از تاخیر
    if (job && !job.stop && job.status === 'running') {
      const waitSeconds = Math.round(job.polling_delay / 1000);
      console.log(`[${job.username}] Waiting ${waitSeconds} seconds before next cycle...`);

      setTimeout(() => {
        if (job && !job.stop) {
          this.run(username);
        }
      }, job.polling_delay);
    }
  }

  async likeCommentsByHashtag(job) {
    const sortTypeText = job.sortType === 'top' ? 'برترین' : 'جدیدترین';
    job.onUpdate('running', `🏷️ در حال دریافت ${sortTypeText} پست‌های هشتگ: #${job.target}`);

    let items = [];
    try {
      items = await getHashtagPostsScrape(job.target, job.username, 10);
      if (items && items.length > 0) {
        job.onUpdate('running', `✅ ${items.length} پست ${sortTypeText} برای #${job.target} پیدا شد. شروع به پردازش...`);
      } else {
        job.onUpdate('idle', `⚠️ هیچ پستی برای هشتگ #${job.target} یافت نشد. (Scraper)`);
        return;
      }
    } catch (e) {
      job.onUpdate('error', `❌ خطا در دریافت پست‌های هشتگ با اسکرپر: ${e.message}`);
      return;
    }

    for (const item of items) {
      if (job.stop || job.status !== 'running') break;
      await this.processPost(job, item);
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
    // Validate item
    if (!item || !item.url) {
      job.onUpdate('error', 'آیتم پست معتبر نبود (Scraper)', {});
      return;
    }
    const postLink = item.url;
    const posterUsername = item.owner || 'Unknown';
    job.onUpdate('processing', `📄 پردازش پست ${postLink} از @${posterUsername} ...`, { postLink });
    // Fake comments mock for now, only for logic demonstration
    // In future, real scraper for comments
    const fakeComments = [{ pk: '1', user: { username: 'testuser1' } }, { pk: '2', user: { username: 'testuser2' } }];
    //
    if (!fakeComments.length) {
      job.onUpdate('idle', `⚠️ این پست کامنتی ندارد`, { postLink });
      return;
    }
    job.onUpdate('processing', `💬 پیدا شد ${fakeComments.length} کامنت. شروع به لایک (تستی)...`, { postLink });
    let commentLikesCount = 0;
    for (const comment of fakeComments) {
      if (job.stop || job.status !== 'running') break;
      // اینجا فقط جایگزین لایک واقعی است، پیام و آمار برای لاگ فعال شود
      commentLikesCount++;
      job.likes++;
      job.onUpdate('liked', `❤️ کامنت از @${comment.user.username} *تست* لایک شد | مجموع: ${job.likes} لایک`, { postLink, likes: job.likes });
      await new Promise(r => setTimeout(r, job.delay_between_likes_ms || 1000));
    }
    if (commentLikesCount > 0) {
      job.onUpdate('post_completed', `✅ پست از @${posterUsername}: ${commentLikesCount} کامنت *تست* لایک شد | مجموع: ${job.likes} لایک`, { postLink, likes: job.likes });
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
