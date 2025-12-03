const fs = require('fs').promises;
const path = require('path');

const dataFilePath = path.join(__dirname, '..', '..', 'data', 'hashtags.json');

/**
 * HashtagService: مدیریت ذخیره و بازیابی هشتگ‌ها فقط (بدون تعامل با اینستاگرام)
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

  async addHashtag(hashtag) {
    if (!hashtag || typeof hashtag !== 'string') return;
    const clean = hashtag.replace(/^#/, '').trim().normalize('NFC');
    if (!clean) return;
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
}

module.exports = { HashtagService, hashtagService: new HashtagService() };
