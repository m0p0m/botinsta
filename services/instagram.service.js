const { IgApiClient } = require('instagram-private-api');
const fs = require('fs').promises;
const path = require('path');
const Config = require('../config');

const accountsFilePath = path.join(__dirname, '../data/accounts.json');

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
    this.setupProxyRules();
  }

  // تنظیم Proxy Rules برای درخواست‌های واقعی‌تر
  setupProxyRules() {
    this.ig.request.end$.subscribe({
      next: (response) => {
        console.log(`📤 Request: ${response.request.method} ${response.request.url}`);
      },
      error: (error) => {
        console.error(`❌ Request Error:`, error.message);
      }
    });
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

      console.log(`🔐 در حال ورود به حساب: ${username}...`);

      // کانفیگ Device
      this._configureDevice(username);

      // Pre-login Flow - شبیه‌سازی دستگاه واقعی
      console.log('📱 در حال اجرای Pre-Login Flow...');
      await this.ig.simulate.preLoginFlow();

      // تأخیر کوچک برای شبیه‌سازی رفتار انسانی
      await this._delay(Config.INSTAGRAM.PRE_LOGIN_DELAY + Math.random() * 400);

      // Login
      console.log('🔓 در حال ارسال اطلاعات ورود...');
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
          
          console.warn('⚠️ تأیید دو مرحله‌ای مورد نیاز است');
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

      console.log(`✅ ورود موفق: ${loggedInUser.username} (ID: ${loggedInUser.pk})`);

      // Post-Login Flow
      console.log('📲 در حال اجرای Post-Login Flow...');
      await this.ig.simulate.postLoginFlow();

      // تأخیر بعد از لاگین
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
        console.log(`🔄 Session برای ${username} به‌روزرسانی شد`);
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
        console.log('📁 فایل accounts.json ایجاد می‌شود...');
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
      
      console.log(`✅ API Client برای ${username} آماده شد`);
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

      console.log(`📊 در حال دریافت اطلاعات پروفایل ${username}...`);
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

      console.log(`✅ اطلاعات پروفایل دریافت شد`);
      return profileData;
    } catch (error) {
      console.error('❌ خطا در دریافت اطلاعات پروفایل:', error.message);
      throw error;
    }
  }

  async getHashtagFeed(username, hashtag) {
    try {
      if (!hashtag) {
        throw new Error('هشتگ الزامی است');
      }

      console.log(`🏷️ در حال دریافت فید هشتگ #${hashtag}...`);
      const ig = await this.getApiClient(username);
      const feed = ig.feed.tag(hashtag);
      
      console.log(`✅ فید هشتگ آماده شد`);
      return feed;
    } catch (error) {
      console.error('❌ خطا در دریافت فید هشتگ:', error.message);
      throw error;
    }
  }

  async getExploreFeed(username) {
    try {
      console.log(`🔍 در حال دریافت فید کاوش...`);
      const ig = await this.getApiClient(username);
      const feed = ig.feed.discover();
      
      console.log(`✅ فید کاوش آماده شد`);
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

      console.log(`💬 در حال دریافت کامنت‌های پست...`);
      const ig = await this.getApiClient(username);
      const feed = await ig.media.commentsFeed(mediaId);
      
      console.log(`✅ کامنت‌های پست دریافت شد`);
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

      console.log(`❤️ در حال لایک کردن کامنت...`);
      const ig = await this.getApiClient(username);
      const result = await ig.media.likeComment(commentId);
      
      console.log(`✅ کامنت لایک شد`);
      return result;
    } catch (error) {
      console.error('❌ خطا در لایک کردن کامنت:', error.message);
      throw error;
    }
  }

  async likeCommentsByHashtag(username, hashtag, onUpdate) {
    const feed = await this.getHashtagFeed(username, hashtag);
    const items = await feed.items();

    for (const item of items) {
      const commentsFeed = await this.getPostComments(username, item.pk);
      const comments = await commentsFeed.items();

      for (const comment of comments) {
        try {
          onUpdate('liking', `Liking comment by ${comment.user.username} on post ${item.pk}`);
          await this.likeComment(username, comment.pk);
          onUpdate('liked', `Liked comment by ${comment.user.username}`);

          const delay = Math.floor(Math.random() * 5000) + 1000; // Random delay between 1-6 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error) {
          onUpdate('error', `Failed to like comment: ${error.message}`);
        }
      }
    }
    onUpdate('idle', 'Finished liking comments.');
  }
}

module.exports = { InstagramService, instagramService: new InstagramService() };
