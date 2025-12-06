// در فایل src/services/hashtag.service.js
const fs = require('fs').promises;
const path = require('path');

// ابتدا مطمئن شوید پوشه data وجود دارد
const dataDir = path.join(__dirname, '../../data');
const dataFilePath = path.join(dataDir, 'hashtags.json');

// تابع برای ایجاد پوشه اگر وجود ندارد
async function ensureDataDir() {
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

class HashtagService {
  async getHashtags() {
    try {
      await ensureDataDir();
      const data = await fs.readFile(dataFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // فایل وجود ندارد، فایل خالی ایجاد کن
        await fs.writeFile(dataFilePath, JSON.stringify([], null, 2));
        return [];
      }
      console.error('Error reading hashtags:', error);
      return [];
    }
  }

  async addHashtag(hashtag) {
    try {
      if (!hashtag || typeof hashtag !== 'string') {
        throw new Error('هشتگ معتبر نیست');
      }
      
      const cleanHashtag = hashtag.replace(/^#/, '').trim().toLowerCase();
      if (!cleanHashtag) {
        throw new Error('هشتگ نمی‌تواند خالی باشد');
      }
      
      await ensureDataDir();
      const hashtags = await this.getHashtags();
      
      // جلوگیری از تکرار
      if (!hashtags.includes(cleanHashtag)) {
        hashtags.push(cleanHashtag);
        await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2), 'utf8');
        return cleanHashtag;
      }
      
      return null;
    } catch (error) {
      console.error('Error adding hashtag:', error);
      throw error;
    }
  }

  async removeHashtag(hashtag) {
    try {
      const cleanHashtag = hashtag.replace(/^#/, '').trim().toLowerCase();
      await ensureDataDir();
      let hashtags = await this.getHashtags();
      hashtags = hashtags.filter(h => h !== cleanHashtag);
      await fs.writeFile(dataFilePath, JSON.stringify(hashtags, null, 2), 'utf8');
    } catch (error) {
      console.error('Error removing hashtag:', error);
      throw error;
    }
  }
}

module.exports = { HashtagService, hashtagService: new HashtagService() };