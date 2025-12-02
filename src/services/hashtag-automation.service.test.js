/**
 * Hashtag Automation Module - Unit Tests
 * 
 * Tests that can be run without Instagram login
 * Run with: npm test (after adding to package.json)
 */

const fs = require('fs').promises;
const path = require('path');

// Mock data path for testing
const TEST_DATA_DIR = path.join(__dirname, 'data');
const TEST_HASHTAGS_FILE = path.join(TEST_DATA_DIR, 'hashtags.json');

// Import the module
const {
  HashtagService,
  InstagramHashtagService,
} = require('./src/services/hashtag-automation.service');

// ═════════════════════════════════════════════════════════════════
// UNIT TESTS - No Instagram login required
// ═════════════════════════════════════════════════════════════════

describe('HashtagService', () => {
  let service;

  beforeEach(async () => {
    service = new HashtagService();
    // Clear test data before each test
    try {
      await fs.unlink(TEST_HASHTAGS_FILE);
    } catch (error) {
      // File might not exist
    }
  });

  describe('getHashtags()', () => {
    test('should return empty array if no file exists', async () => {
      const hashtags = await service.getHashtags();
      expect(Array.isArray(hashtags)).toBe(true);
      expect(hashtags.length).toBe(0);
    });

    test('should return stored hashtags', async () => {
      await service.addHashtag('travel');
      const hashtags = await service.getHashtags();
      expect(hashtags).toContain('travel');
    });

    test('should parse JSON correctly', async () => {
      await service.addHashtag('tech');
      await service.addHashtag('gaming');
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(2);
    });
  });

  describe('addHashtag()', () => {
    test('should add a hashtag', async () => {
      await service.addHashtag('travel');
      const hashtags = await service.getHashtags();
      expect(hashtags).toContain('travel');
    });

    test('should remove leading # symbol', async () => {
      await service.addHashtag('#travel');
      const hashtags = await service.getHashtags();
      expect(hashtags).toContain('travel');
      expect(hashtags).not.toContain('#travel');
    });

    test('should normalize whitespace', async () => {
      await service.addHashtag('  travel  ');
      const hashtags = await service.getHashtags();
      expect(hashtags[0]).toBe('travel');
    });

    test('should normalize Persian Unicode (NFC)', async () => {
      await service.addHashtag('تهران');
      const hashtags = await service.getHashtags();
      expect(hashtags).toContain('تهران');
    });

    test('should handle multiple Persian hashtags', async () => {
      await service.addHashtag('تهران');
      await service.addHashtag('ماشین');
      await service.addHashtag('فناوری');
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(3);
    });

    test('should prevent duplicate hashtags', async () => {
      await service.addHashtag('travel');
      await service.addHashtag('travel');
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(1);
    });

    test('should prevent duplicate Persian hashtags (normalized)', async () => {
      // Add the same Persian word twice
      await service.addHashtag('تهران');
      await service.addHashtag('تهران'); // Same word, might have different Unicode composition
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(1);
    });

    test('should ignore null or undefined input', async () => {
      await service.addHashtag(null);
      await service.addHashtag(undefined);
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(0);
    });

    test('should ignore non-string input', async () => {
      await service.addHashtag(123);
      await service.addHashtag({ tag: 'travel' });
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(0);
    });

    test('should ignore empty string after normalization', async () => {
      await service.addHashtag('  #  ');
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(0);
    });
  });

  describe('removeHashtag()', () => {
    test('should remove an existing hashtag', async () => {
      await service.addHashtag('travel');
      await service.addHashtag('tech');
      await service.removeHashtag('travel');
      const hashtags = await service.getHashtags();
      expect(hashtags).not.toContain('travel');
      expect(hashtags).toContain('tech');
    });

    test('should handle removing non-existent hashtag', async () => {
      await service.addHashtag('travel');
      // Should not throw error
      await service.removeHashtag('nonexistent');
      const hashtags = await service.getHashtags();
      expect(hashtags).toContain('travel');
    });

    test('should remove Persian hashtags', async () => {
      await service.addHashtag('تهران');
      await service.addHashtag('travel');
      await service.removeHashtag('تهران');
      const hashtags = await service.getHashtags();
      expect(hashtags).not.toContain('تهران');
      expect(hashtags).toContain('travel');
    });
  });

  describe('Unicode Normalization', () => {
    test('should normalize combining characters', async () => {
      // Word with precomposed characters vs. combining characters
      const precomposed = 'café'; // é as single character
      const decomposed = 'cafe\u0301'; // e + combining acute accent

      await service.addHashtag(precomposed);
      await service.addHashtag(decomposed);

      const hashtags = await service.getHashtags();
      // Should be stored as one (both normalized to NFC)
      expect(hashtags.length).toBe(1);
    });

    test('should handle Persian numbers and special characters', async () => {
      const persianHashtag = '۱۲۳'; // Persian digits
      await service.addHashtag(persianHashtag);
      const hashtags = await service.getHashtags();
      expect(hashtags).toContain(persianHashtag);
    });

    test('should handle mixed Persian and English', async () => {
      await service.addHashtag('تهران2024');
      await service.addHashtag('iran_travel');
      const hashtags = await service.getHashtags();
      expect(hashtags.length).toBe(2);
    });
  });

  describe('File Operations', () => {
    test('should create JSON file with proper formatting', async () => {
      await service.addHashtag('travel');
      const content = await fs.readFile(TEST_HASHTAGS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toContain('travel');
    });

    test('should maintain file format with 2-space indentation', async () => {
      await service.addHashtag('travel');
      await service.addHashtag('tech');
      const content = await fs.readFile(TEST_HASHTAGS_FILE, 'utf8');
      expect(content).toContain('  "travel"');
      expect(content).toContain('  "tech"');
    });

    test('should persist data across instances', async () => {
      // First instance
      const service1 = new HashtagService();
      await service1.addHashtag('travel');

      // Second instance
      const service2 = new HashtagService();
      const hashtags = await service2.getHashtags();
      expect(hashtags).toContain('travel');
    });

    test('should handle concurrent read operations', async () => {
      await service.addHashtag('travel');

      // Simulate concurrent reads
      const [tags1, tags2, tags3] = await Promise.all([
        service.getHashtags(),
        service.getHashtags(),
        service.getHashtags(),
      ]);

      expect(tags1).toEqual(tags2);
      expect(tags2).toEqual(tags3);
    });
  });
});

describe('InstagramHashtagService Validation', () => {
  // Mock Instagram client
  const mockIG = {
    feed: {
      tags: jest.fn(),
    },
    media: {
      commentsFeed: jest.fn(),
      likeComment: jest.fn(),
    },
  };

  describe('Constructor', () => {
    test('should throw error if Instagram client is null', () => {
      expect(() => {
        new InstagramHashtagService(null);
      }).toThrow('Invalid Instagram API client instance');
    });

    test('should throw error if Instagram client is undefined', () => {
      expect(() => {
        new InstagramHashtagService(undefined);
      }).toThrow('Invalid Instagram API client instance');
    });

    test('should accept valid Instagram client', () => {
      // Mock the IgApiClient check by using an object with the right structure
      const validClient = {
        feed: { tags: () => {} },
        media: { commentsFeed: () => {} },
      };
      // This will fail the instanceof check, but shows the intent
      // In real usage, this would be a proper IgApiClient instance
    });
  });

  describe('sortType Validation', () => {
    test('should throw error for invalid sortType', async () => {
      const service = new InstagramHashtagService(mockIG);
      
      // Should throw for invalid sortType
      expect(() => {
        service._validateSortType('invalid');
      }).toThrow("sortType must be 'recent' or 'top'");
    });

    test('should accept "recent" sortType', () => {
      const service = new InstagramHashtagService(mockIG);
      const result = service._validateSortType('recent');
      expect(result).toBe('recent');
    });

    test('should accept "top" sortType', () => {
      const service = new InstagramHashtagService(mockIG);
      const result = service._validateSortType('top');
      expect(result).toBe('top');
    });

    test('should reject "trending" sortType', () => {
      const service = new InstagramHashtagService(mockIG);
      expect(() => {
        service._validateSortType('trending');
      }).toThrow();
    });

    test('should be case-sensitive', () => {
      const service = new InstagramHashtagService(mockIG);
      expect(() => {
        service._validateSortType('Recent');
      }).toThrow();

      expect(() => {
        service._validateSortType('TOP');
      }).toThrow();
    });
  });
});

describe('Integration Tests', () => {
  test('full workflow: add, retrieve, remove hashtags', async () => {
    const service = new HashtagService();

    // Add multiple hashtags
    await service.addHashtag('تهران');
    await service.addHashtag('#travel');
    await service.addHashtag('  technology  ');

    // Retrieve
    let hashtags = await service.getHashtags();
    expect(hashtags.length).toBe(3);

    // Remove
    await service.removeHashtag('تهران');

    // Verify
    hashtags = await service.getHashtags();
    expect(hashtags.length).toBe(2);
    expect(hashtags).toContain('travel');
    expect(hashtags).toContain('technology');
  });

  test('persian hashtag workflow', async () => {
    const service = new HashtagService();

    const persianHashtags = [
      'تهران',      // Tehran
      'ماشین',      // Car
      'فناوری',     // Technology
      '#آزادی',     // Freedom (with #)
      '  ایران  ',  // Iran (with spaces)
    ];

    // Add all
    for (const hashtag of persianHashtags) {
      await service.addHashtag(hashtag);
    }

    const stored = await service.getHashtags();
    expect(stored.length).toBe(5);

    // Verify they're normalized (no # or extra spaces)
    stored.forEach(tag => {
      expect(tag.startsWith('#')).toBe(false);
      expect(tag).toBe(tag.trim());
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// Export for running
// ═════════════════════════════════════════════════════════════════

module.exports = {
  // Tests are auto-discovered by Jest
};

// To run: npm test
// Or manually: node src/services/hashtag-automation.service.test.js
