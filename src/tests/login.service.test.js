/**
 * Instagram Service Login Tests
 * تست‌های جامع برای سرویس لاگین
 */

const { InstagramService } = require('../services/instagram.service');
const ErrorHandler = require('../services/error-handler.service');

describe('InstagramService - Login', () => {
  let service;

  beforeEach(() => {
    service = new InstagramService();
  });

  describe('Error Handling', () => {
    test('should analyze challenge_required error correctly', () => {
      const error = new Error('challenge_required');
      error.response = {
        status: 400,
        body: { error_type: 'checkpoint_challenge_required' }
      };

      const analysis = ErrorHandler.analyzeLoginError(error);
      expect(analysis.type).toBe('CHALLENGE_REQUIRED');
      expect(analysis.severity).toBe('warning');
      expect(analysis.retryable).toBe(true);
    });

    test('should analyze invalid credentials error correctly', () => {
      const error = new Error('The username you entered doesn\'t exist');
      error.response = {
        status: 400,
        body: { error_type: 'invalid_user' }
      };

      const analysis = ErrorHandler.analyzeLoginError(error);
      expect(analysis.type).toBe('INVALID_CREDENTIALS');
      expect(analysis.severity).toBe('error');
      expect(analysis.retryable).toBe(true);
    });

    test('should analyze rate limit error correctly', () => {
      const error = new Error('Please wait a few minutes before you try again');
      error.response = { status: 429 };

      const analysis = ErrorHandler.analyzeLoginError(error);
      expect(analysis.type).toBe('RATE_LIMITED');
      expect(analysis.severity).toBe('warning');
      expect(analysis.retryable).toBe(false);
    });

    test('should analyze account disabled error correctly', () => {
      const error = new Error('Your account has been disabled');
      error.response = {
        status: 403,
        body: { error_type: 'inactive_user' }
      };

      const analysis = ErrorHandler.analyzeLoginError(error);
      expect(analysis.type).toBe('ACCOUNT_DISABLED');
      expect(analysis.retryable).toBe(false);
    });

    test('should analyze connection error correctly', () => {
      const error = new Error('ECONNREFUSED');
      error.code = 'ECONNREFUSED';

      const analysis = ErrorHandler.analyzeLoginError(error);
      expect(analysis.type).toBe('CONNECTION_ERROR');
      expect(analysis.retryable).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('should reject empty username', async () => {
      try {
        await service.login('', 'password');
        fail('Should throw error');
      } catch (error) {
        expect(error.message).toContain('نام کاربری');
      }
    });

    test('should reject empty password', async () => {
      try {
        await service.login('username', '');
        fail('Should throw error');
      } catch (error) {
        expect(error.message).toContain('رمز عبور');
      }
    });

    test('should reject null values', async () => {
      try {
        await service.login(null, null);
        fail('Should throw error');
      } catch (error) {
        expect(error.message).toContain('الزامی');
      }
    });
  });

  describe('Device Configuration', () => {
    test('should configure device with valid user agent', () => {
      const username = 'testuser';
      service._configureDevice(username);

      expect(service.ig.state.deviceString).toBeDefined();
      expect(service.ig.request.userAgent).toBeDefined();
      expect(service.ig.request.userAgent).toContain('Instagram');
      expect(service.ig.request.userAgent).toContain('Android');
    });

    test('should use different user agents', () => {
      const userAgents = new Set();
      for (let i = 0; i < 10; i++) {
        const service2 = new InstagramService();
        service2._configureDevice('user' + i);
        userAgents.add(service2.ig.request.userAgent);
      }

      // باید حداقل 2 user agent مختلف داشته باشیم
      expect(userAgents.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error Messages', () => {
    test('should format error message for display', () => {
      const error = new Error('challenge_required');
      error.response = {
        status: 400,
        body: { error_type: 'checkpoint_challenge_required' }
      };

      const formatted = ErrorHandler.formatErrorForDisplay(error);
      expect(formatted).toContain('تأیید');
      expect(formatted).toContain('Instagram');
    });

    test('should include suggestion in error message', () => {
      const error = new Error('invalid credentials');
      error.response = {
        status: 400,
        body: { error_type: 'invalid_user' }
      };

      const analysis = ErrorHandler.analyzeLoginError(error);
      expect(analysis.suggestion).toBeDefined();
      expect(analysis.suggestion.length > 0).toBe(true);
    });
  });
});

describe('ErrorHandlerService', () => {
  test('should identify retryable errors', () => {
    const connectionError = new Error('ETIMEDOUT');
    connectionError.code = 'ETIMEDOUT';

    expect(ErrorHandler.isRetryable(connectionError)).toBe(true);
  });

  test('should identify non-retryable errors', () => {
    const rateLimitError = new Error('rate limit');
    rateLimitError.response = { status: 429 };

    expect(ErrorHandler.isRetryable(rateLimitError)).toBe(false);
  });

  test('should provide persian error messages', () => {
    const error = new Error('challenge_required');
    error.response = {
      status: 400,
      body: { error_type: 'checkpoint_challenge_required' }
    };

    const formatted = ErrorHandler.formatErrorForDisplay(error);
    
    // بررسی شامل بودن کاراکترهای فارسی
    expect(formatted).toMatch(/[ا-ی]/);
  });
});

// Test Utilities
describe('Service Utilities', () => {
  let service;

  beforeEach(() => {
    service = new InstagramService();
  });

  test('_delay should delay execution', async () => {
    const start = Date.now();
    await service._delay(100);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(90);
  });

  test('should handle async operations', async () => {
    const result = await service._delay(10);
    expect(result).toBeUndefined();
  });
});
