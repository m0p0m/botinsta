/**
 * Configuration for Instagram Service
 * تنظیمات و ثابت‌های برنامه
 */

module.exports = {
  // Timeouts (milliseconds)
  TIMEOUT: {
    LOGIN: 30000,
    API_REQUEST: 15000,
    DELAY_MIN: 800,
    DELAY_MAX: 1200,
  },

  // Retry Configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1000,
    BACKOFF_MULTIPLIER: 2,
  },

  // Session Configuration
  SESSION: {
    SECRET: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // Instagram API Configuration
  INSTAGRAM: {
    API_TIMEOUT: 15000,
    RATE_LIMIT_DELAY: 500, // between requests
    
    // Device simulation
    MIN_ANDROID_VERSION: 28,
    MAX_ANDROID_VERSION: 33,
    
    // Pre/Post Login delays
    PRE_LOGIN_DELAY: 1000,
    POST_LOGIN_DELAY: 1500,
  },

  // Error Messages - Farsi
  ERRORS: {
    INVALID_CREDENTIALS: '❌ نام کاربری یا رمز عبور اشتباه است',
    CHALLENGE_REQUIRED: '🔐 تأیید دو مرحله‌ای مورد نیاز است',
    RATE_LIMITED: '⏳ تعداد تلاش‌های ورود بسیار زیاد است',
    ACCOUNT_DISABLED: '🚫 این حساب غیرفعال یا مسدود شده است',
    CONNECTION_ERROR: '🌐 خطا در اتصال به Instagram',
    UNKNOWN_ERROR: '❌ خطای نامشخص رخ داد',
    REQUIRED_FIELDS: '❌ نام کاربری و رمز عبور الزامی است',
    ACCOUNT_NOT_FOUND: '❌ این حساب ثبت نشده است',
  },

  // Logging
  LOGGING: {
    ENABLED: true,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
    LOG_REQUESTS: true,
    LOG_ERRORS: true,
  },

  // Server Configuration
  SERVER: {
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || 'localhost',
    NODE_ENV: process.env.NODE_ENV || 'development',
  },

  // Data Paths
  PATHS: {
    ACCOUNTS: './data/accounts.json',
    HASHTAGS: './data/hashtags.json',
    LOGS: './logs',
  },

  // Validation Rules
  VALIDATION: {
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 30,
    PASSWORD_MIN_LENGTH: 6,
    PASSWORD_MAX_LENGTH: 100,
  },
};
