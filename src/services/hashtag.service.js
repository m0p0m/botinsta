const fs = require('fs').promises;
const path = require('path');

const dataFilePath = path.join(__dirname, '..', '..', 'data', 'hashtags.json');

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
   * @param {string} hashtag - The hashtag to add.
   */
  async addHashtag(hashtag) {
    const hashtags = await this.getHashtags();
    if (!hashtags.includes(hashtag)) {
      hashtags.push(hashtag);
      await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
    }
  }

  /**
   * Removes a hashtag from the list.
   * @param {string} hashtag - The hashtag to remove.
   */
  async removeHashtag(hashtag) {
    let hashtags = await this.getHashtags();
    hashtags = hashtags.filter(h => h !== hashtag);
    await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2));
  }
}

module.exports = { HashtagService, hashtagService: new HashtagService() };
