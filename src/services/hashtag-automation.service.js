const fs = require('fs').promises;
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

const dataFilePath = path.join(__dirname, '../../data/hashtags.json');

/**
 * HashtagService - Manages hashtag storage and retrieval
 * Features:
 * - Saves hashtags to /data/hashtags.json
 * - Automatically normalizes Persian/Arabic Unicode (NFC)
 * - Stores hashtags without "#"
 */
class HashtagService {
  /**
   * Retrieves the list of hashtags from the JSON file
   * @returns {Promise<string[]>} Array of hashtags
   */
  async getHashtags() {
    try {
      const data = await fs.readFile(dataFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []; // Return empty array if file doesn't exist
      }
      throw error;
    }
  }

  /**
   * Adds a new hashtag to the list if it doesn't already exist
   * Normalizes Persian/Arabic Unicode and removes leading "#"
   * @param {string} hashtag - The hashtag to add
   */
  async addHashtag(hashtag) {
    if (!hashtag || typeof hashtag !== 'string') return;

    // Normalize: remove leading #, trim and NFC normalize for Unicode/Persian
    const clean = hashtag.replace(/^#/, '').trim().normalize('NFC');
    if (!clean) return;

    const hashtags = await this.getHashtags();
    if (!hashtags.includes(clean)) {
      hashtags.push(clean);
      await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
    }
  }

  /**
   * Removes a hashtag from the list
   * @param {string} hashtag - The hashtag to remove
   */
  async removeHashtag(hashtag) {
    let hashtags = await this.getHashtags();
    hashtags = hashtags.filter(h => h !== hashtag);
    await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
  }
}

/**
 * InstagramHashtagService - Handles Instagram hashtag operations
 * Features:
 * - Fetch posts by hashtag
 * - Like comments on posts
 * - Work with Persian hashtags
 */
class InstagramHashtagService {
  /**
   * Creates an instance of InstagramHashtagService
   * @param {IgApiClient} ig - Instagram API client instance
   */
  constructor(ig) {
    if (!ig || !(ig instanceof IgApiClient)) {
      throw new Error('Invalid Instagram API client instance');
    }
    this.ig = ig;
  }

  /**
   * Validates sortType parameter
   * @param {string} sortType - The sort type to validate
   * @returns {string} Validated sort type
   * @throws {Error} If sortType is invalid
   */
  _validateSortType(sortType) {
    if (!['recent', 'top'].includes(sortType)) {
      throw new Error("sortType must be 'recent' or 'top'");
    }
    return sortType;
  }

  /**
   * Utility function to add realistic delays
   * @param {number} min - Minimum delay in milliseconds
   * @param {number} max - Maximum delay in milliseconds
   * @returns {Promise<void>}
   */
  async _delay(min = 1000, max = 3000) {
    const delay = Math.random() * (max - min) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Fetches posts for a given hashtag
   * Works with both English and Persian hashtags
   * @param {string} hashtag - The hashtag to search (without "#")
   * @param {string} sortType - Sort type: 'recent' or 'top'
   * @returns {Promise<Object[]>} Array of posts/media items
   * @throws {Error} If hashtag is invalid, sortType is invalid, or API errors
   */
  async getHashtagPosts(hashtag, sortType = 'top') {
    try {
      if (!hashtag || typeof hashtag !== 'string') {
        throw new Error('Invalid hashtag provided');
      }

      // Validate and normalize sortType
      this._validateSortType(sortType);

      // Normalize hashtag (remove #, trim, normalize Unicode for Persian)
      const cleanHashtag = hashtag.replace(/^#/, '').trim().normalize('NFC');

      if (!cleanHashtag) {
        throw new Error('Hashtag cannot be empty');
      }

      console.log(`🔍 Fetching ${sortType} posts for hashtag: #${cleanHashtag}...`);

      // Create tag feed using ig.feed.tags()
      const feed = this.ig.feed.tags(cleanHashtag, sortType);

      if (!feed) {
        throw new Error('Failed to create tag feed');
      }

      // Fetch posts
      const items = await feed.items();

      if (!items || items.length === 0) {
        console.warn(`⚠️ No posts found for hashtag: #${cleanHashtag}`);
        return [];
      }

      console.log(`✅ Found ${items.length} posts for #${cleanHashtag}`);
      return items;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limited by Instagram. Please wait before trying again.');
      }
      console.error(`❌ Error fetching hashtag posts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetches comments for a given media/post
   * @param {string} mediaId - The media ID to fetch comments from
   * @returns {Promise<Object[]>} Array of comments
   * @throws {Error} If mediaId is invalid or API errors
   */
  async fetchComments(mediaId) {
    try {
      if (!mediaId) {
        throw new Error('Invalid media ID provided');
      }

      console.log(`📝 Fetching comments for media: ${mediaId}...`);

      const commentsFeed = await this.ig.media.commentsFeed(mediaId);

      if (!commentsFeed) {
        throw new Error('Failed to create comments feed');
      }

      const comments = await commentsFeed.items();

      if (!comments) {
        return [];
      }

      console.log(`✅ Found ${comments.length} comments`);
      return comments;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limited by Instagram. Please wait before trying again.');
      }
      console.error(`❌ Error fetching comments: ${error.message}`);
      throw error;
    }
  }

  /**
   * Likes a specific comment
   * @param {string} commentId - The comment ID to like
   * @returns {Promise<boolean>} True if liked successfully
   * @throws {Error} If commentId is invalid or API errors
   */
  async likeComment(commentId) {
    try {
      if (!commentId) {
        throw new Error('Invalid comment ID provided');
      }

      await this.ig.media.likeComment(commentId);
      console.log(`❤️ Liked comment: ${commentId}`);
      return true;
    } catch (error) {
      if (error.response?.status === 429) {
        throw new Error('Rate limited by Instagram. Please wait before trying again.');
      }
      console.error(`❌ Error liking comment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Likes all comments on a media post
   * @param {string} mediaId - The media ID to like comments from
   * @returns {Promise<number>} Number of comments liked
   * @throws {Error} If mediaId is invalid or API errors
   */
  async likeComments(mediaId) {
    try {
      if (!mediaId) {
        throw new Error('Invalid media ID provided');
      }

      console.log(`\n💬 Starting to like comments for media: ${mediaId}...`);

      const comments = await this.fetchComments(mediaId);

      if (comments.length === 0) {
        console.log('⚠️ No comments found for this post');
        return 0;
      }

      let likedCount = 0;

      for (const comment of comments) {
        try {
          // Add realistic delay between liking comments
          await this._delay(800, 1500);
          await this.likeComment(comment.id);
          likedCount++;
        } catch (error) {
          console.warn(`⚠️ Could not like comment ${comment.id}: ${error.message}`);
          // Continue with next comment even if one fails
        }
      }

      console.log(`✅ Successfully liked ${likedCount} out of ${comments.length} comments`);
      return likedCount;
    } catch (error) {
      console.error(`❌ Error liking comments: ${error.message}`);
      throw error;
    }
  }
}

/**
 * InstagramHashtagAutomation - Main automation class
 * Features:
 * - Loads hashtags from storage
 * - Fetches posts for each hashtag
 * - Likes comments from top posts
 * - Uses realistic delays (3-7 seconds between hashtags)
 * - Comprehensive error handling
 */
class InstagramHashtagAutomation {
  /**
   * Creates an instance of InstagramHashtagAutomation
   * @param {IgApiClient} ig - Instagram API client instance
   * @param {number} topPostsCount - Number of top posts to process (default: 3)
   */
  constructor(ig, topPostsCount = 3) {
    if (!ig || !(ig instanceof IgApiClient)) {
      throw new Error('Invalid Instagram API client instance');
    }

    this.ig = ig;
    this.hashtagService = new HashtagService();
    this.instagramHashtagService = new InstagramHashtagService(ig);
    this.topPostsCount = Math.max(1, topPostsCount); // Ensure at least 1
  }

  /**
   * Utility function to add realistic delays
   * Random delay between 3-7 seconds as specified
   * @returns {Promise<void>}
   */
  async _delay() {
    const delayMs = Math.random() * 4000 + 3000; // 3-7 seconds
    console.log(`⏳ Waiting ${Math.round(delayMs / 1000)} seconds before next action...`);
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }

  /**
   * Runs the hashtag automation workflow
   * @param {Object} options - Configuration options
   * @param {boolean} options.likeComments - Whether to like comments (default: true)
   * @param {boolean} options.verbose - Enable verbose logging (default: false)
   * @returns {Promise<Object>} Results of the automation run
   * @throws {Error} If session is missing or other critical errors occur
   */
  async run(options = {}) {
    const { likeComments = true, verbose = false } = options;

    if (!this.ig) {
      throw new Error('Instagram session is not initialized');
    }

    console.log('\n🤖 Starting Hashtag Automation Workflow...\n');

    const results = {
      startTime: new Date(),
      hashtags: [],
      totalPostsFetched: 0,
      totalCommentsLiked: 0,
      errors: [],
    };

    try {
      // Load hashtags from storage
      console.log('📚 Loading hashtags from storage...');
      const hashtags = await this.hashtagService.getHashtags();

      if (hashtags.length === 0) {
        console.warn('⚠️ No hashtags found in storage');
        results.endTime = new Date();
        results.duration = results.endTime - results.startTime;
        return results;
      }

      console.log(`✅ Loaded ${hashtags.length} hashtags\n`);

      // Process each hashtag
      for (const hashtag of hashtags) {
        const hashtagResult = {
          hashtag,
          posts: 0,
          commentsLiked: 0,
          error: null,
        };

        try {
          console.log(`\n${'='.repeat(60)}`);
          console.log(`Processing hashtag: #${hashtag}`);
          console.log(`${'='.repeat(60)}`);

          // Fetch posts for this hashtag
          let posts = [];
          try {
            posts = await this.instagramHashtagService.getHashtagPosts(hashtag, 'top');
          } catch (error) {
            if (error.message.includes('Rate limited')) {
              hashtagResult.error = 'Rate limited - skipping this hashtag';
              console.error(`❌ ${hashtagResult.error}`);
              results.errors.push(`${hashtag}: Rate limited`);
            } else {
              hashtagResult.error = error.message;
              console.error(`❌ Failed to fetch posts: ${error.message}`);
              results.errors.push(`${hashtag}: ${error.message}`);
            }
          }

          if (posts.length === 0) {
            hashtagResult.posts = 0;
            results.hashtags.push(hashtagResult);
            continue;
          }

          hashtagResult.posts = posts.length;
          results.totalPostsFetched += posts.length;

          // Process top N posts
          const postsToProcess = posts.slice(0, this.topPostsCount);
          console.log(`\n📊 Processing top ${postsToProcess.length} posts out of ${posts.length}`);

          if (likeComments) {
            for (let index = 0; index < postsToProcess.length; index++) {
              const post = postsToProcess[index];

              try {
                console.log(`\n[${index + 1}/${postsToProcess.length}] Processing post by @${post.user?.username || 'unknown'}`);

                const commentsLiked = await this.instagramHashtagService.likeComments(post.id);
                hashtagResult.commentsLiked += commentsLiked;
                results.totalCommentsLiked += commentsLiked;

                // Add realistic delay between posts
                if (index < postsToProcess.length - 1) {
                  await this._delay();
                }
              } catch (error) {
                console.error(`❌ Error processing post: ${error.message}`);
                results.errors.push(`${hashtag} - Post ${post.id}: ${error.message}`);
                // Continue with next post
              }
            }
          } else {
            console.log(`⏭️ Comment liking disabled for this run`);
          }

          results.hashtags.push(hashtagResult);

          // Add delay before next hashtag
          if (hashtags.indexOf(hashtag) < hashtags.length - 1) {
            console.log('\n⏳ Preparing for next hashtag...');
            await this._delay();
          }
        } catch (error) {
          hashtagResult.error = error.message;
          console.error(`❌ Unexpected error processing hashtag: ${error.message}`);
          results.errors.push(`${hashtag}: ${error.message}`);
          results.hashtags.push(hashtagResult);
        }
      }
    } catch (error) {
      console.error(`❌ Critical error in automation: ${error.message}`);
      results.errors.push(`Critical: ${error.message}`);
    }

    results.endTime = new Date();
    results.duration = results.endTime - results.startTime;

    // Print summary
    this._printSummary(results);

    return results;
  }

  /**
   * Prints a summary of the automation run
   * @param {Object} results - The results object from run()
   * @private
   */
  _printSummary(results) {
    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 AUTOMATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`📅 Start Time: ${results.startTime.toLocaleString()}`);
    console.log(`📅 End Time: ${results.endTime.toLocaleString()}`);
    console.log(`⏱️ Duration: ${Math.round(results.duration / 1000)} seconds`);
    console.log(`\n📊 Statistics:`);
    console.log(`   - Hashtags Processed: ${results.hashtags.length}`);
    console.log(`   - Total Posts Fetched: ${results.totalPostsFetched}`);
    console.log(`   - Total Comments Liked: ${results.totalCommentsLiked}`);
    console.log(`   - Errors: ${results.errors.length}`);

    if (results.hashtags.length > 0) {
      console.log(`\n📈 Per-Hashtag Results:`);
      for (const hr of results.hashtags) {
        const status = hr.error ? '❌' : '✅';
        console.log(`   ${status} #${hr.hashtag}: ${hr.posts} posts, ${hr.commentsLiked} comments liked`);
        if (hr.error) {
          console.log(`      └─ Error: ${hr.error}`);
        }
      }
    }

    if (results.errors.length > 0) {
      console.log(`\n⚠️ Errors Encountered:`);
      for (const error of results.errors) {
        console.log(`   - ${error}`);
      }
    }

    console.log('='.repeat(60) + '\n');
  }
}

module.exports = {
  HashtagService,
  hashtagService: new HashtagService(),
  InstagramHashtagService,
  InstagramHashtagAutomation,
};
