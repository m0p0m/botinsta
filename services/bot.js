const { instagramService } = require('./instagram.service');
const { IgActionSpamError } = require('instagram-private-api');

class BotService {
  constructor() {
    this.jobs = {};
  }

  start(username, type, target, onUpdate, options = {}, startTime = null) {
    if (this.jobs[username]) {
      this.stop(username);
    }

    const total_likes_target = options.total_likes_target || 700;
    const time_period_hours = options.time_period_hours || 12;
    const delay_between_likes_ms = (time_period_hours * 60 * 60 * 1000) / total_likes_target;

    const job = {
      username,
      type,
      target,
      onUpdate,
      status: 'running',
      likes: 0,
      stop: false,
      rate_limit_pause: options.rate_limit_pause || 4 * 60 * 60 * 1000,
      polling_delay: options.polling_delay || 1 * 60 * 1000,
      delay_between_likes_ms,
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
      job.onUpdate('زمان‌بندی شده', `ربات برای شروع در ساعت ${startDate.toLocaleTimeString()} زمان‌بندی شد`);

      setTimeout(() => {
        job.onUpdate('در حال اجرا', `ربات برای ${username} شروع به کار کرد.`);
        this.run(username);
      }, delay);
    } else {
      job.onUpdate('در حال اجرا', `ربات برای ${username} شروع به کار کرد.`);
      this.run(username);
    }
  }

  stop(username) {
    if (this.jobs[username]) {
      this.jobs[username].stop = true;
      this.jobs[username].onUpdate('بیکار', `ربات برای ${username} در حال توقف است.`);
    }
  }

  async run(username) {
    const job = this.jobs[username];
    if (!job || job.stop) {
      delete this.jobs[username];
      if (job) job.onUpdate('بیکار', 'ربات متوقف شد.');
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
      job.onUpdate('error', `An error occurred: ${error.message}`);
    }

    if (!job.stop) {
      if (job.status === 'running') {
        job.onUpdate('بیکار', `در حال انتظار برای ${job.polling_delay / 1000} ثانیه قبل از بررسی پست‌های جدید.`);
        setTimeout(() => this.run(username), job.polling_delay);
      }
    } else {
      delete this.jobs[username];
      job.onUpdate('بیکار', 'ربات متوقف شد.');
    }
  }

  async likeCommentsByHashtag(job) {
    job.onUpdate('در حال اجرا', `در حال دریافت پست‌ها با هشتگ: ${job.target}`);
    const feed = await instagramService.getHashtagFeed(job.username, job.target);

    while (feed.isMoreAvailable()) {
      const items = await feed.items();
      for (const item of items) {
        if (job.stop || job.status !== 'running') break;
        await this.processPost(job, item);
      }
      if (job.stop || job.status !== 'running') break;
    }
  }

  async likeCommentsFromExplore(job) {
    job.onUpdate('در حال اجرا', 'در حال دریافت پست‌ها از اکسپلور.');
    const feed = await instagramService.getExploreFeed(job.username);

    while (feed.isMoreAvailable()) {
      const items = await feed.items();
      for (const item of items) {
        if (job.stop || job.status !== 'running') break;
        await this.processPost(job, item);
      }
      if (job.stop || job.status !== 'running') break;
    }
  }

  async processPost(job, item) {
    const commentsFeed = await instagramService.getPostComments(job.username, item.pk);
    const comments = await commentsFeed.items();

    for (const comment of comments) {
      if (job.stop || job.status !== 'running') break;
      await this.likeComment(job, comment);
    }
  }

  async likeComment(job, comment) {
    try {
      job.onUpdate('در حال لایک', `در حال لایک کردن کامنت ${comment.user.username}`);
      await instagramService.likeComment(job.username, comment.pk);
      job.likes++;
      job.onUpdate('لایک شد', `کامنت ${comment.user.username} لایک شد. مجموع لایک‌ها: ${job.likes}`);
      await new Promise(resolve => setTimeout(resolve, job.delay_between_likes_ms));
    } catch (error) {
      if (error instanceof IgActionSpamError) {
        job.status = 'متوقف';
        job.onUpdate('متوقف', `محدودیت اینستاگرام. در حال توقف برای ${job.rate_limit_pause / (60 * 1000)} دقیقه.`);
        setTimeout(() => this.testLike(job), job.rate_limit_pause);
      } else {
        job.onUpdate('خطا', `خطا در لایک کردن کامنت: ${error.message}`);
      }
    }
  }

  async testLike(job) {
    job.onUpdate('در حال اجرا', 'در حال تلاش برای لایک آزمایشی...');
    try {
      const exploreFeed = await instagramService.getExploreFeed(job.username);
      const items = await exploreFeed.items();
      if (items.length > 0) {
        const commentsFeed = await instagramService.getPostComments(job.username, items[0].pk);
        const comments = await commentsFeed.items();
        if (comments.length > 0) {
          await instagramService.likeComment(job.username, comments[0].pk);
          job.onUpdate('در حال اجرا', 'لایک آزمایشی موفق بود. ربات در حال ادامه کار است.');
          job.status = 'running';
          this.run(job.username);
        } else {
          throw new Error('هیچ کامنتی برای لایک آزمایشی پیدا نشد.');
        }
      } else {
        throw new Error('هیچ پستی در اکسپلور برای لایک آزمایشی پیدا نشد.');
      }
    } catch (error) {
      job.onUpdate('متوقف', `لایک آزمایشی ناموفق بود. در حال توقف مجدد. ${error.message}`);
      setTimeout(() => this.testLike(job), job.rate_limit_pause);
    }
  }
}

module.exports = { BotService, botService: new BotService() };
