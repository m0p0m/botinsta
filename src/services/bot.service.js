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
      job.onUpdate('running', `🚀 Bot started for @${username}.`);
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
    job.onUpdate('running', `🏷️ Fetching posts with hashtag: #${job.target}`);
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
    job.onUpdate('running', `🔍 Fetching posts from explore feed.`);
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
    const postId = item.pk;
    const posterUsername = item.user?.username || 'Unknown';
    // try to use shortcode/code if present to build public URL
    const shortcode = item.code || item.code_with_id || item.shortcode || null;
    const postLink = shortcode ? `https://www.instagram.com/p/${shortcode}/` : (postId ? `https://www.instagram.com/p/${postId}/` : null);

    job.onUpdate('processing', `Processing post ${postId} by @${posterUsername}`, { postLink });

    const commentsFeed = await instagramService.getPostComments(job.username, postId);
    const comments = await commentsFeed.items();

    let commentLikesCount = 0;
    for (const comment of comments) {
      if (job.stop || job.status !== 'running') break;
      commentLikesCount += await this.likeComment(job, comment, postId, postLink);
    }

    if (commentLikesCount > 0) {
      job.onUpdate('post_completed', `✅ Post ${postId} by @${posterUsername}: Liked ${commentLikesCount} comments`, { postLink, likes: job.likes });
    }
  }

  async likeComment(job, comment, postId, postLink = null) {
    try {
      job.onUpdate('liking', `Liking comment by @${comment.user.username}`, { postLink });
      await instagramService.likeComment(job.username, comment.pk);
      job.likes++;
      job.onUpdate('liked', `❤️ Liked comment by @${comment.user.username} (Post: ${postId}) | Total: ${job.likes}`, { postLink, likes: job.likes });
      await new Promise(resolve => setTimeout(resolve, job.delay_between_likes_ms));
      return 1;
    } catch (error) {
      if (error instanceof IgActionSpamError) {
        job.status = 'paused';
        job.onUpdate('paused', `⏸️ Rate limited. Pausing for ${Math.round(job.rate_limit_pause / (60 * 1000))} minutes.`);
        setTimeout(() => this.testLike(job), job.rate_limit_pause);
      } else {
        job.onUpdate('error', `❌ Failed to like comment: ${error.message}`);
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
