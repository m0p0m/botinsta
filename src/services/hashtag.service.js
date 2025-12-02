const fs = require('fs').promises;
const path = require('path');

const dataFilePath = path.join(__dirname, '..', '..', 'data', 'hashtags.json');

/**
 * HashtagService - Manages hashtag storage and retrieval
 * Features:
 * - Saves hashtags to /data/hashtags.json
 * - Automatically normalizes Persian/Arabic Unicode (NFC)
 * - Stores hashtags without "#"
 */
class HashtagService {
  /**
   * Retrieves the list of hashtags from the JSON file.
   * @returns {Promise<string[]>} A promise that resolves to an array of hashtags.
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
   * Adds a new hashtag to the list if it doesn't already exist.
   * Normalizes Persian/Arabic Unicode and removes leading "#"
   * @param {string} hashtag - The hashtag to add.
   * @returns {Promise<void>}
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
   * Removes a hashtag from the list.
   * @param {string} hashtag - The hashtag to remove.
   * @returns {Promise<void>}
   */
  async removeHashtag(hashtag) {
    let hashtags = await this.getHashtags();
    hashtags = hashtags.filter(h => h !== hashtag);
    await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
  }
}

module.exports = { HashtagService, hashtagService: new HashtagService() };
