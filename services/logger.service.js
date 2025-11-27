/**
 * Logger Middleware
 * ثبت تمام درخواست‌ها و پاسخ‌ها برای debugging
 */

const fs = require('fs').promises;
const path = require('path');

const logsDir = path.join(__dirname, '../logs');

class Logger {
  constructor() {
    this.ensureLogsDir();
  }

  async ensureLogsDir() {
    try {
      await fs.mkdir(logsDir, { recursive: true });
    } catch (error) {
      console.error('Cannot create logs directory:', error);
    }
  }

  /**
   * ایجاد middleware برای ثبت درخواست‌ها
   */
  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      const method = req.method;
      const url = req.originalUrl;
      const ip = req.ip;

      // ثبت درخواست
      console.log(`📨 ${method} ${url} - IP: ${ip}`);

      // intercept response
      const originalSend = res.send;
      res.send = function (data) {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusEmoji = status < 400 ? '✅' : status < 500 ? '⚠️' : '❌';

        console.log(`${statusEmoji} ${method} ${url} - ${status} (${duration}ms)`);

        // ثبت خطاهای ورود
        if (url.includes('add-account') && status !== 302) {
          this.logError({
            timestamp: new Date().toISOString(),
            method,
            url,
            status,
            body: req.body,
            duration
          });
        }

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * ثبت خطاها
   */
  async logError(errorData) {
    try {
      const logFile = path.join(logsDir, `errors-${new Date().toISOString().split('T')[0]}.json`);

      let errors = [];
      try {
        const content = await fs.readFile(logFile, 'utf8');
        errors = JSON.parse(content);
      } catch (e) {
        // فایل اولین بار ایجاد می‌شود
      }

      errors.push(errorData);
      
      // حفظ آخرین 100 خطا
      if (errors.length > 100) {
        errors = errors.slice(-100);
      }

      await fs.writeFile(logFile, JSON.stringify(errors, null, 2));
    } catch (error) {
      console.error('Cannot write error log:', error.message);
    }
  }

  /**
   * ثبت ورود موفق
   */
  async logSuccessfulLogin(username) {
    try {
      const logFile = path.join(logsDir, 'successful-logins.json');

      let logins = [];
      try {
        const content = await fs.readFile(logFile, 'utf8');
        logins = JSON.parse(content);
      } catch (e) {
        // فایل اولین بار ایجاد می‌شود
      }

      logins.push({
        username,
        timestamp: new Date().toISOString()
      });

      // حفظ آخرین 1000 ورود
      if (logins.length > 1000) {
        logins = logins.slice(-1000);
      }

      await fs.writeFile(logFile, JSON.stringify(logins, null, 2));
    } catch (error) {
      console.error('Cannot write login log:', error.message);
    }
  }

  /**
   * دریافت خطاهای اخیر
   */
  async getRecentErrors(limit = 10) {
    try {
      const logFile = path.join(logsDir, `errors-${new Date().toISOString().split('T')[0]}.json`);
      const content = await fs.readFile(logFile, 'utf8');
      const errors = JSON.parse(content);
      return errors.slice(-limit);
    } catch (error) {
      return [];
    }
  }

  /**
   * دریافت آمار ورود‌ها
   */
  async getLoginStats() {
    try {
      const logFile = path.join(logsDir, 'successful-logins.json');
      const content = await fs.readFile(logFile, 'utf8');
      const logins = JSON.parse(content);

      const today = new Date().toISOString().split('T')[0];
      const todayLogins = logins.filter(l => l.timestamp.startsWith(today));

      return {
        total: logins.length,
        today: todayLogins.length,
        uniqueUsers: new Set(logins.map(l => l.username)).size
      };
    } catch (error) {
      return { total: 0, today: 0, uniqueUsers: 0 };
    }
  }
}

module.exports = new Logger();
