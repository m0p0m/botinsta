const { IgApiClient } = require('instagram-private-api');
const fs = require('fs').promises;
const path = require('path');
const Config = require('../config');

const accountsFilePath = path.join(__dirname, '../../data/accounts.json');

// Instagram User-Agent برای تشابه با برنامه اصلی - لیست دستگاه‌های واقعی
const INSTAGRAM_USER_AGENTS = [
  'Instagram 254.0.0.0.0 Android (32/12; 480dpi; 1080x1920; SAMSUNG; SM-G950F; dreamlte; dreamltecs; en_US; 403699470)',
  'Instagram 260.0.0.0.0 Android (33/13; 420dpi; 1080x2220; realme; RMX2117; RMX2117; RMX2117; en_US; 403699470)',
  'Instagram 280.0.0.0.0 Android (31/12; 420dpi; 1080x2340; OnePlus; GM1910; OnePlus7Pro; OnePlus7Pro; en_US; 403699470)',
  'Instagram 265.0.0.0.0 Android (30/11; 480dpi; 1440x2880; samsung; SM-G973F; beyond2; beyond2; en_US; 403699470)',
  'Instagram 275.0.0.0.0 Android (29/10; 420dpi; 1080x2160; Google; Pixel 3 XL; crosshatch; crosshatch; en_US; 403699470)',
  'Instagram 270.0.0.0.0 Android (31/12; 420dpi; 1080x2340; xiaomi; M2007J1SC; lmi; lmi; en_US; 403699470)',
  'Instagram 282.0.0.0.0 Android (32/12; 420dpi; 1080x2400; OPPO; CPH2127; PBKM00; PBKM00; en_US; 403699470)',
];

class InstagramService {
  constructor() {
    this.ig = new IgApiClient();
  }

  // تصحیح Device برای تطابق بیشتر با اپ اصلی Instagram
  _configureDevice(username) {
    const randomUserAgent = INSTAGRAM_USER_AGENTS[Math.floor(Math.random() * INSTAGRAM_USER_AGENTS.length)];
    this.ig.state.generateDevice(username);
    
    // تنظیمات دستی Device
    this.ig.state.deviceString = randomUserAgent;
    this.ig.request.userAgent = randomUserAgent;
    
    return this.ig;
  }

  async login(username, password) {
    try {
      // Validation
      if (!username || !password) {
        throw new Error('نام کاربری و رمز عبور الزامی است');
      }

      if (username.length < Config.VALIDATION.USERNAME_MIN_LENGTH) {
        throw new Error(`نام کاربری باید حداقل ${Config.VALIDATION.USERNAME_MIN_LENGTH} کاراکتر باشد`);
      }

      if (password.length < Config.VALIDATION.PASSWORD_MIN_LENGTH) {
        throw new Error(`رمز عبور باید حداقل ${Config.VALIDATION.PASSWORD_MIN_LENGTH} کاراکتر باشد`);
      }

      console.log(`🔐 Logging in to account: ${username}...`);

      // Configure device
      this._configureDevice(username);

      // Pre-login Flow - simulate real device
      console.log('📱 Running Pre-Login Flow...');
      await this.ig.simulate.preLoginFlow();

      // تأخیر کوچک برای شبیه‌سازی رفتار انسانی
      await this._delay(Config.INSTAGRAM.PRE_LOGIN_DELAY + Math.random() * 400);

      // Login
      console.log('🔑 Sending login credentials...');
      let loggedInUser;
      
      try {
        loggedInUser = await this.ig.account.login(username, password);
      } catch (loginError) {
        // Challenge Required - نیاز به تأیید دو مرحله‌ای
        if (loginError.response?.status === 400 && 
            (loginError.response?.body?.error_type === 'checkpoint_logged_out' ||
             loginError.response?.body?.error_type === 'checkpoint_challenge_required' ||
             loginError.response?.body?.two_factor_required === true ||
             loginError.message?.includes('challenge_required'))) {
          
          console.warn('⚠️ Two-factor authentication required');
          throw new Error('حساب شما نیاز به تأیید دو مرحله‌ای دارد. لطفا اپ Instagram را بررسی کنید.');
        }

        // Invalid Credentials
        if (loginError.response?.body?.error_type === 'invalid_user' ||
            loginError.message?.includes('The username you entered')) {
          throw new Error('نام کاربری یا رمز عبور اشتباه است');
        }

        // Rate Limit
        if (loginError.response?.status === 429 ||
            loginError.message?.includes('Please wait a few minutes before you try again')) {
          throw new Error('تعداد تلاش‌های ورود زیاد است. لطفا بعدا دوباره تلاش کنید');
        }

        // Action Blocked
        if (loginError.response?.body?.error_type === 'inactive_user' ||
            loginError.message?.includes('Your account has been disabled')) {
          throw new Error('حساب شما غیرفعال شده است');
        }

        // Network/Connection Error
        if (loginError.code === 'ECONNREFUSED' || loginError.code === 'ETIMEDOUT') {
          throw new Error('خطا در اتصال به Instagram. اتصال اینترنت را بررسی کنید');
        }

        console.error('❌ خطای لاگین:', loginError);
        throw new Error(`خطای ورود: ${loginError.message || 'خطای نامشخص'}`);
      }

      console.log(`✅ Login successful: ${loggedInUser.username} (ID: ${loggedInUser.pk})`);

      // Post-Login Flow (some Instagram endpoints may return HTML 404; treat certain ones as non-fatal)
      console.log('📲 Running Post-Login Flow...');
      try {
        await this.ig.simulate.postLoginFlow();
      } catch (postErr) {
        const status = postErr?.response?.status;
        const body = postErr?.response?.body || '';
        const msg = postErr?.message || '';

        // If IG returned an HTML 404 (web fallback) for fbsearch suggested_searches, ignore and continue
        if (status === 404 && typeof body === 'string' && body.includes('<!DOCTYPE html>') || msg.includes('/api/v1/fbsearch/suggested_searches')) {
          console.warn('⚠️ Non-fatal post-login request failed (fbsearch 404). Continuing.');
        } else {
          throw postErr;
        }
      }

      // Delay after login
      await this._delay(Config.INSTAGRAM.POST_LOGIN_DELAY);

      // ذخیره Session
      const accounts = await this.getAccounts();
      const existingAccount = accounts.find(acc => acc.username === username);

      const sessionData = {
        username: loggedInUser.username,
        pk: loggedInUser.pk,
        session: await this.ig.state.serialize(),
        loginTime: new Date().toISOString(),
        userAgent: this.ig.request.userAgent,
      };

      if (existingAccount) {
        Object.assign(existingAccount, sessionData);
        console.log(`🔄 Session updated for ${username}`);
      } else {
        accounts.push(sessionData);
        console.log(`➕ حساب جدید ${username} ذخیره شد`);
      }

      await fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2));
      return loggedInUser;

    } catch (error) {
      console.error('❌ خطا در سرویس لاگین:', error.message);
      throw error;
    }
  }

  // تأخیر - برای شبیه‌سازی رفتار انسانی
  async _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getAccounts() {
    try {
      const data = await fs.readFile(accountsFilePath, 'utf8');
      const accounts = JSON.parse(data);
      return Array.isArray(accounts) ? accounts : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📁 Creating accounts.json file...');
        return [];
      }
      console.error('❌ خطا در خواندن accounts.json:', error.message);
      return [];
    }
  }

  async getApiClient(username) {
    try {
      if (!username) {
        throw new Error('نام کاربری الزامی است');
      }

      const accounts = await this.getAccounts();
      const account = accounts.find(acc => acc.username === username);

      if (!account) {
        throw new Error(`حساب "${username}" پیدا نشد`);
      }

      if (!account.session) {
        throw new Error(`Session برای "${username}" موجود نیست. دوباره وارد شوید`);
      }

      const ig = new IgApiClient();
      this._configureDevice(account.username);
      await ig.state.deserialize(account.session);
      
      console.log(`✅ API Client ready for ${username}`);
      return ig;
    } catch (error) {
      console.error('❌ خطا در دریافت API Client:', error.message);
      throw error;
    }
  }

  async getProfileData(username) {
    try {
      if (!username) {
        throw new Error('نام کاربری الزامی است');
      }

      console.log(`📊 Fetching profile data for ${username}...`);
      const ig = await this.getApiClient(username);
      
      const userId = await ig.user.getIdByUsername(username);
      const userInfo = await ig.user.info(userId);

      const profileData = {
        followers: userInfo.follower_count || 0,
        following: userInfo.following_count || 0,
        posts: userInfo.media_count || 0,
        profile_pic_url: userInfo.profile_pic_url || null,
        full_name: userInfo.full_name || '',
        biography: userInfo.biography || '',
        external_url: userInfo.external_url || null,
        is_verified: userInfo.is_verified || false,
        is_private: userInfo.is_private || false,
      };

      console.log(`✅ Profile data fetched`);
      return profileData;
    } catch (error) {
      console.error('❌ خطا در دریافت اطلاعات پروفایل:', error.message);
      throw error;
    }
  }

  async getHashtagFeed(username, hashtag, sortType = 'recent') {
    try {
      if (!hashtag) {
        throw new Error('هشتگ الزامی است');
      }

      // Clean hashtag - remove # if present and trim whitespace
      const cleanHashtag = hashtag.replace(/^#/, '').trim();
      
      if (!cleanHashtag) {
        throw new Error('هشتگ معتبر نیست');
      }

      const sortText = sortType === 'top' ? 'برترین' : 'جدیدترین';
      console.log(`🏷️ Fetching ${sortText} hashtag feed #${cleanHashtag}...`);
      const ig = await this.getApiClient(username);
      
      // First, verify the hashtag exists by getting its info
      let hashtagInfo;
      try {
        hashtagInfo = await ig.hashtag.info(cleanHashtag);
        console.log(`📊 Hashtag info: ${hashtagInfo.media_count || 0} posts, name: ${hashtagInfo.name || cleanHashtag}`);
        
        if (hashtagInfo.media_count === 0) {
          console.warn(`⚠️ هشتگ #${cleanHashtag} هیچ پستی ندارد`);
        }
      } catch (infoError) {
        // If we can't get info, the hashtag might not exist
        console.error(`❌ Could not get hashtag info for #${cleanHashtag}:`, infoError.message);
        throw new Error(`هشتگ #${cleanHashtag} پیدا نشد یا دسترسی به آن ممکن نیست`);
      }
      
      // Get the tag feed
      // Note: instagram-private-api's feed.tag() returns recent posts by default
      // For top posts, we might need to use a different approach, but let's try the regular feed first
      const feed = ig.feed.tag(cleanHashtag);
      
      console.log(`✅ Hashtag feed ready (${sortText})`);
      return feed;
    } catch (error) {
      console.error('❌ خطا در دریافت فید هشتگ:', error.message);
      throw error;
    }
  }

  async getExploreFeed(username) {
    try {
      console.log(`🔍 Fetching explore feed...`);
      const ig = await this.getApiClient(username);
      const feed = ig.feed.discover();
      
      console.log(`✅ Explore feed ready`);
      return feed;
    } catch (error) {
      console.error('❌ خطا در دریافت فید کاوش:', error.message);
      throw error;
    }
  }

  

  async getPostComments(username, mediaId) {
    try {
      if (!mediaId) {
        throw new Error('mediaId الزامی است');
      }

      console.log(`💬 Fetching post comments...`);
      const ig = await this.getApiClient(username);
      const feed = await ig.media.commentsFeed(mediaId);
      
      console.log(`✅ Post comments fetched`);
      return feed;
    } catch (error) {
      console.error('❌ خطا در دریافت کامنت‌های پست:', error.message);
      throw error;
    }
  }

  async likeComment(username, commentId) {
    try {
      if (!commentId) {
        throw new Error('commentId الزامی است');
      }

      console.log(`❤️ Liking comment...`);
      const ig = await this.getApiClient(username);
      const result = await ig.media.likeComment(commentId);
      
      console.log(`✅ Comment liked`);
      return result;
    } catch (error) {
      console.error('❌ خطا در لایک کردن کامنت:', error.message);
      throw error;
    }
  }

  async removeAccount(username) {
    try {
      if (!username) {
        throw new Error('نام کاربری الزامی است');
      }

      const accounts = await this.getAccounts();
      const filteredAccounts = accounts.filter(acc => acc.username !== username);

      if (filteredAccounts.length === accounts.length) {
        throw new Error(`حساب "${username}" پیدا نشد`);
      }

      await fs.writeFile(accountsFilePath, JSON.stringify(filteredAccounts, null, 2), 'utf8');
      console.log(`✅ حساب "${username}" حذف شد`);
    } catch (error) {
      console.error('❌ خطا در حذف حساب:', error.message);
      throw error;
    }
  }
}

module.exports = { InstagramService, instagramService: new InstagramService() };
