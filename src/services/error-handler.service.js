/**
 * Error Handler Service
 * تبدیل خطاهای Instagram API به پیام‌های قابل فهم برای کاربر
 */

class ErrorHandlerService {
  /**
   * تحلیل خطای لاگین و تبدیل به پیام فارسی
   */
  static analyzeLoginError(error) {
    const errorObj = {
      type: 'UNKNOWN_ERROR',
      message: 'خطای نامشخص رخ داد',
      severity: 'error',
      suggestion: 'لطفا بعدا دوباره تلاش کنید'
    };

    if (!error) {
      return errorObj;
    }

    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    const responseStatus = error.response?.status;
    const responseBody = error.response?.body || {};
    const errorType = responseBody.error_type || '';

    // Challenge Required / Two Factor Auth
    if (responseStatus === 400 && 
        (errorType === 'checkpoint_logged_out' ||
         errorType === 'checkpoint_challenge_required' ||
         responseBody.two_factor_required === true ||
         errorMessage.includes('challenge_required'))) {
      return {
        type: 'CHALLENGE_REQUIRED',
        message: '🔐 تأیید دو مرحله‌ای مورد نیاز است',
        severity: 'warning',
        suggestion: 'اپ Instagram را باز کنید و درخواست تأیید را تأیید کنید. سپس دوباره تلاش کنید.',
        retryable: true
      };
    }

    // Invalid Credentials
    if (errorType === 'invalid_user' ||
        responseStatus === 400 ||
        errorMessage.includes('The username you entered') ||
        errorMessage.includes('incorrect')) {
      return {
        type: 'INVALID_CREDENTIALS',
        message: '❌ نام کاربری یا رمز عبور اشتباه است',
        severity: 'error',
        suggestion: 'لطفا نام کاربری و رمز عبور را بررسی کنید',
        retryable: true
      };
    }

    // Rate Limit / Too Many Attempts
    if (responseStatus === 429 ||
        errorMessage.includes('too many') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('Please wait')) {
      return {
        type: 'RATE_LIMITED',
        message: '⏳ تعداد تلاش‌های ورود بسیار زیاد است',
        severity: 'warning',
        suggestion: 'لطفا 15-30 دقیقه صبر کنید و دوباره تلاش کنید',
        retryable: false
      };
    }

    // Account Disabled / Blocked
    if (errorType === 'inactive_user' ||
        errorType === 'account_disabled' ||
        errorMessage.includes('disabled') ||
        errorMessage.includes('blocked') ||
        errorMessage.includes('not eligible') ||
        responseStatus === 403) {
      return {
        type: 'ACCOUNT_DISABLED',
        message: '🚫 این حساب غیرفعال یا مسدود شده است',
        severity: 'error',
        suggestion: 'لطفا از وب‌سایت Instagram برای اطلاعات بیشتر تماس بگیرید',
        retryable: false
      };
    }

    // Connection / Network Error
    if (errorCode === 'ECONNREFUSED' ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'ENOTFOUND' ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('connect')) {
      return {
        type: 'CONNECTION_ERROR',
        message: '🌐 خطا در اتصال به Instagram',
        severity: 'error',
        suggestion: 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید',
        retryable: true
      };
    }

    // Server Error
    if (responseStatus >= 500) {
      return {
        type: 'SERVER_ERROR',
        message: '⚠️ سرور Instagram مشکل دارد',
        severity: 'warning',
        suggestion: 'لطفا بعدا دوباره تلاش کنید',
        retryable: true
      };
    }

    // Unknown Instagram API Error
    if (error.response && error.response.status) {
      return {
        type: 'API_ERROR',
        message: `❌ خطای Instagram (${error.response.status})`,
        severity: 'error',
        suggestion: 'لطفا دوباره تلاش کنید',
        retryable: true
      };
    }

    // Fallback
    if (errorMessage) {
      return {
        type: 'UNKNOWN_ERROR',
        message: `❌ ${errorMessage}`,
        severity: 'error',
        suggestion: 'لطفا بعدا دوباره تلاش کنید',
        retryable: true
      };
    }

    return errorObj;
  }

  /**
   * Format error for display to user
   */
  static formatErrorForDisplay(error) {
    const analysis = this.analyzeLoginError(error);
    return `${analysis.message}\n\n💡 ${analysis.suggestion}`;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error) {
    return this.analyzeLoginError(error).retryable !== false;
  }

  /**
   * Log error with details
   */
  static logError(context, error) {
    const analysis = this.analyzeLoginError(error);
    
    console.error('\n' + '='.repeat(50));
    console.error(`❌ خطا در ${context}`);
    console.error('='.repeat(50));
    console.error(`📌 نوع: ${analysis.type}`);
    console.error(`📝 پیام: ${analysis.message}`);
    console.error(`🔧 سفارش: ${analysis.suggestion}`);
    
    if (error.response) {
      console.error(`📊 HTTP Status: ${error.response.status}`);
      if (error.response.body) {
        console.error(`📋 Response Body:`, error.response.body);
      }
    }
    
    console.error('='.repeat(50) + '\n');
  }
}

module.exports = ErrorHandlerService;
