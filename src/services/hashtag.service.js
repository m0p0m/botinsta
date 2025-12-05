const fs = require('fs').promises;
const path = require('path');
const { instagramService } = require('./instagram.service');

const dataFilePath = path.join(__dirname, '..', '..', 'data', 'hashtags.json');

/**
 * HashtagService: Manages storing and retrieving hashtags.
 */
class HashtagService {
  async getHashtags() {
    try {
      const data = await fs.readFile(dataFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async addHashtag(hashtag, username) {
    if (!hashtag || typeof hashtag !== 'string') return;
    const clean = hashtag.replace(/^#/, '').trim().normalize('NFC');
    if (!clean) return;

    // Validate the hashtag using the Instagram API
    await this.validateHashtag(clean, username);

    const hashtags = await this.getHashtags();
    if (!hashtags.includes(clean)) {
      hashtags.push(clean);
      await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
    }
  }

  async removeHashtag(hashtag) {
    let hashtags = await this.getHashtags();
    hashtags = hashtags.filter(h => h !== hashtag);
    await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
  }

  async validateHashtag(hashtag, username) {
    if (!username) {
      throw new Error('A logged-in user is required to validate hashtags.');
    }
    try {
      const ig = await instagramService.getApiClient(username);
      await ig.hashtag.info(hashtag);
    } catch (error) {
      if (error.message.includes('Not Found')) {
        throw new Error(`Hashtag "#${hashtag}" does not exist or is invalid.`);
      }
      throw error;
    }
  }
}

module.exports = { HashtagService, hashtagService: new HashtagService() };
