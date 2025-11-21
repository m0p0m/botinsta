const { instagramService } = require('./instagram.service');
const { IgActionSpamError } = require('instagram-private-api');

class BotService {
  constructor() {
    this.jobs = {};
  }

  start(username, type, target, onUpdate, options = {}) {
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
    job.onUpdate('running', `Bot started for ${username}.`);
    this.run(username);
  }

  stop(username) {
    if (this.jobs[username]) {
      this.jobs[username].stop = true;
      this.jobs[username].onUpdate('idle', `Bot stopping for ${username}.`);
    }
  }

  async run(username) {
    const job = this.jobs[username];
    if (!job || job.stop) {
      delete this.jobs[username];
      if (job) job.onUpdate('idle', 'Bot stopped.');
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
        job.onUpdate('idle', `Waiting for ${job.polling_delay / 1000} seconds before checking for new posts.`);
        setTimeout(() => this.run(username), job.polling_delay);
      }
    } else {
      delete this.jobs[username];
      job.onUpdate('idle', 'Bot stopped.');
    }
  }

  async likeCommentsByHashtag(job) {
    job.onUpdate('running', `Fetching posts with hashtag: ${job.target}`);
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
    job.onUpdate('running', 'Fetching posts from explore feed.');
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
      job.onUpdate('liking', `Liking comment by ${comment.user.username}`);
      await instagramService.likeComment(job.username, comment.pk);
      job.likes++;
      job.onUpdate('liked', `Liked comment by ${comment.user.username}. Total likes: ${job.likes}`);
      await new Promise(resolve => setTimeout(resolve, job.delay_between_likes_ms));
    } catch (error) {
      if (error instanceof IgActionSpamError) {
        job.status = 'paused';
        job.onUpdate('paused', `Rate limited. Pausing for ${job.rate_limit_pause / (60 * 1000)} minutes.`);
        setTimeout(() => this.testLike(job), job.rate_limit_pause);
      } else {
        job.onUpdate('error', `Failed to like comment: ${error.message}`);
      }
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
