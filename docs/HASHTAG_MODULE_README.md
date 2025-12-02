# Instagram Hashtag Automation Module 🤖

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green)
![Instagram API](https://img.shields.io/badge/instagram--private--api-1.46.1%2B-blueviolet)
![License](https://img.shields.io/badge/license-ISC-orange)

A production-ready Node.js module for automating Instagram hashtag engagement with Persian/Arabic Unicode support, realistic delays, and comprehensive error handling.

**[Full Documentation](./HASHTAG_AUTOMATION_DOCS.md)** | **[Integration Guide](./INTEGRATION_GUIDE.js)** | **[Requirements Checklist](./REQUIREMENTS_CHECKLIST.md)**

---

## ✨ Features

- 📝 **Persistent Hashtag Storage** - Save/manage hashtags in JSON
- 🌍 **Unicode Support** - Full Persian/Arabic normalization (NFC)
- 📸 **Post Fetching** - Retrieve posts by hashtag with sort options
- ❤️ **Comment Automation** - Like all comments on posts automatically
- 🤖 **Full Automation** - Complete workflow with realistic delays (3-7s)
- 🛡️ **Error Handling** - Rate limits, missing sessions, network errors
- ⚡ **Performance** - Efficient batch operations and file I/O
- 📊 **Detailed Results** - Comprehensive metrics and logging

---

## 🚀 Quick Start

### Installation

```bash
# Already installed in your project
# Ensure instagram-private-api is installed:
npm install instagram-private-api@1.46.1
```

### Basic Usage

```javascript
const { InstagramHashtagAutomation, HashtagService } = require('./src/services/hashtag-automation.service');
const { IgApiClient } = require('instagram-private-api');

// 1. Login to Instagram
const ig = new IgApiClient();
await ig.account.login('username', 'password');

// 2. Add hashtags
const hashtags = new HashtagService();
await hashtags.addHashtag('تهران');     // Persian: Tehran
await hashtags.addHashtag('travel');
await hashtags.addHashtag('#technology');  // # is optional

// 3. Run automation
const automation = new InstagramHashtagAutomation(ig, 3);  // Process top 3 posts
const results = await automation.run({
  likeComments: true,
  verbose: true,
});

console.log(`✅ Liked ${results.totalCommentsLiked} comments`);
```

---

## 📚 API Reference

### Classes

#### 1. `HashtagService`

Manages hashtag storage with Unicode normalization.

```javascript
const { HashtagService } = require('./src/services/hashtag-automation.service');
const service = new HashtagService();

// Add a hashtag (auto-normalizes, removes #)
await service.addHashtag('travel');
await service.addHashtag('#تهران');
await service.addHashtag('  #ماشین  ');

// Get all hashtags
const hashtags = await service.getHashtags();
// ['travel', 'تهران', 'ماشین']

// Remove a hashtag
await service.removeHashtag('travel');
```

#### 2. `InstagramHashtagService`

Handles Instagram API interactions.

```javascript
const { InstagramHashtagService } = require('./src/services/hashtag-automation.service');
const service = new InstagramHashtagService(ig);

// Fetch posts (uses ig.feed.tags())
const posts = await service.getHashtagPosts('تهران', 'top');
// sortType: 'recent' or 'top'

// Like all comments on a post
const likedCount = await service.likeComments(mediaId);
```

#### 3. `InstagramHashtagAutomation`

Orchestrates the complete automation workflow.

```javascript
const { InstagramHashtagAutomation } = require('./src/services/hashtag-automation.service');
const automation = new InstagramHashtagAutomation(ig, 3);  // top 3 posts

const results = await automation.run({
  likeComments: true,   // Like comments
  verbose: true,        // Detailed logging
});

// Results:
// {
//   startTime: Date,
//   endTime: Date,
//   duration: number,
//   hashtags: [
//     {
//       hashtag: 'تهران',
//       posts: 15,
//       commentsLiked: 42,
//       error: null
//     }
//   ],
//   totalPostsFetched: 45,
//   totalCommentsLiked: 128,
//   errors: []
// }
```

---

## 🔧 Advanced Usage

### Example 1: Express Route Handler

```javascript
const express = require('express');
const app = express();

app.post('/api/automation/start', async (req, res) => {
  try {
    const { username } = req.body;
    const ig = getInstagramClient(username);  // Your method
    
    const automation = new InstagramHashtagAutomation(ig, 3);
    
    // Run in background
    automation.run({ likeComments: true }).then(results => {
      console.log('✅ Automation complete:', results);
    });
    
    res.json({ status: 'started' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Example 2: Scheduled Task (Hourly)

```javascript
const cron = require('node-cron');

cron.schedule('0 * * * *', async () => {
  console.log('🕐 Running hourly automation...');
  
  const accounts = getActiveAccounts();  // Your method
  
  for (const account of accounts) {
    const automation = new InstagramHashtagAutomation(account.ig, 3);
    const results = await automation.run({ likeComments: true });
    console.log(`✅ ${account.username}: ${results.totalCommentsLiked} comments`);
  }
});
```

### Example 3: Managing Hashtags via API

```javascript
app.get('/api/hashtags', async (req, res) => {
  const service = new HashtagService();
  const hashtags = await service.getHashtags();
  res.json({ hashtags });
});

app.post('/api/hashtags', async (req, res) => {
  const { hashtag } = req.body;
  const service = new HashtagService();
  await service.addHashtag(hashtag);
  res.json({ status: 'added', hashtag });
});

app.delete('/api/hashtags/:hashtag', async (req, res) => {
  const { hashtag } = req.params;
  const service = new HashtagService();
  await service.removeHashtag(hashtag);
  res.json({ status: 'removed', hashtag });
});
```

### Example 4: Working with Persian Hashtags

```javascript
const service = new HashtagService();

// Add Persian hashtags
await service.addHashtag('تهران');        // Tehran
await service.addHashtag('ماشین');        // Car
await service.addHashtag('فناوری');       // Technology
await service.addHashtag('#آزادی');       // Freedom

// Fetch posts for Persian hashtag
const instagram = new InstagramHashtagService(ig);
const posts = await instagram.getHashtagPosts('تهران', 'top');

// Like comments
for (const post of posts.slice(0, 3)) {
  await instagram.likeComments(post.id);
}
```

---

## 🌍 Persian/Arabic Support

### Unicode Normalization (NFC)

All hashtags are automatically normalized to NFC form:

```javascript
const service = new HashtagService();

// These all become the same stored value
await service.addHashtag('تهران');     // Direct
await service.addHashtag('تهران');     // Different Unicode form
await service.addHashtag('  تهران  ');  // With spaces
await service.addHashtag('#تهران');    // With #

const hashtags = await service.getHashtags();
console.log(hashtags);  // ['تهران'] - Only one stored
```

### Why NFC?

- Ensures consistent storage regardless of Unicode form
- Prevents duplicate Persian/Arabic text
- Supports `ig.feed.tags()` API with Unicode hashtags
- Compatible with Instagram's hashtag search

---

## ⏱️ Delays & Realistic Behavior

The module includes automatic realistic delays:

| Between | Duration | Purpose |
|---------|----------|---------|
| Comments | 0.8-1.5s | Realistic engagement |
| Posts | 3-7s | Avoid spam detection |
| Hashtags | 3-7s | Rate limit compliance |

These delays are **not configurable** to prevent misuse. If you need different delays:

```javascript
// Modify directly in hashtag-automation.service.js
// Line 100: async _delay(min = 1000, max = 3000)
// Line 314-319: async _delay() in InstagramHashtagAutomation
```

---

## 🛡️ Error Handling

### Handled Errors

| Error | Response |
|-------|----------|
| Rate Limiting (429) | Informative error, automation continues |
| Invalid Session | Throws "session not initialized" |
| Invalid sortType | Throws validation error |
| Empty Feed | Returns empty array, continues |
| Network Timeout | Thrown with context |
| Invalid Hashtag | Validation error |
| Missing Comments | Returns 0 comments, continues |

### Example Error Handling

```javascript
try {
  const automation = new InstagramHashtagAutomation(ig, 3);
  const results = await automation.run();
  
  if (results.errors.length > 0) {
    console.log('⚠️ Errors encountered:');
    results.errors.forEach(err => console.log(`  - ${err}`));
  }
} catch (error) {
  if (error.message.includes('Rate limited')) {
    console.log('❌ Rate limited - wait before retrying');
  } else if (error.message.includes('session')) {
    console.log('❌ Login required');
  }
}
```

---

## 📊 Return Values

### `HashtagService.getHashtags()`

```javascript
// Returns: Promise<string[]>
const hashtags = await service.getHashtags();
// ['تهران', 'travel', 'technology']
```

### `InstagramHashtagService.getHashtagPosts()`

```javascript
// Returns: Promise<Object[]>
const posts = await service.getHashtagPosts('تهران', 'top');
// [{
//   id: 'mediaId',
//   user: { username: 'poster' },
//   like_count: 1234,
//   caption: { text: 'Post caption' },
//   ...
// }]
```

### `InstagramHashtagService.likeComments()`

```javascript
// Returns: Promise<number>
const likedCount = await service.likeComments(mediaId);
// 42  (number of comments liked)
```

### `InstagramHashtagAutomation.run()`

```javascript
// Returns: Promise<Object>
const results = await automation.run();
// {
//   startTime: Date,
//   endTime: Date,
//   duration: 45321,  // milliseconds
//   hashtags: [
//     {
//       hashtag: 'تهران',
//       posts: 15,
//       commentsLiked: 42,
//       error: null
//     }
//   ],
//   totalPostsFetched: 45,
//   totalCommentsLiked: 128,
//   errors: []
// }
```

---

## 💾 Data Storage

### File Structure

```
data/
└── hashtags.json
```

### Example Content

```json
[
  "تهران",
  "ماشین",
  "technology",
  "travel",
  "فناوری"
]
```

**Features:**
- Auto-created if missing
- Pretty-printed with 2-space indentation
- UTF-8 encoding (supports all Unicode)
- Persists across app restarts

---

## 📋 Storage Details

### Instagram API Methods Used

This module uses **exact** Instagram API methods:

```javascript
// CORRECT - Uses this:
ig.feed.tags(hashtag, sortType)      // Returns feed
feed.items()                          // Gets posts

// WRONG - Does NOT use:
ig.feed.tag(hashtag)                 // ❌ Different method

// Comments:
ig.media.commentsFeed(mediaId)        // Gets comments
ig.media.likeComment(commentId)       // Likes comment
```

For full API documentation: https://github.com/dilame/instagram-private-api/tree/master/docs

---

## 🧪 Testing

### Unit Tests (No login required)

```bash
npm test
```

Tests covered:
- ✅ Hashtag addition/removal
- ✅ Unicode normalization (NFC)
- ✅ File persistence
- ✅ Deduplication
- ✅ Persian/Arabic support
- ✅ Error handling
- ✅ Concurrent operations

### Manual Testing

```javascript
// Run examples (no login needed)
node examples/hashtag-automation-examples.js

// Test with login (uncomment in examples file)
```

---

## 🎯 Best Practices

### Do's ✅

```javascript
// Use realistic delays
const automation = new InstagramHashtagAutomation(ig, 3);
await automation.run();  // Includes delays

// Monitor errors
const results = await automation.run();
if (results.errors.length > 0) {
  console.log('Errors:', results.errors);
}

// Test with verbose logging
await automation.run({ verbose: true });

// Store sessions between runs
const session = ig.state.serialize();
fs.writeFileSync('session.json', session);
```

### Don'ts ❌

```javascript
// Don't remove delays
// Don't modify _delay() to be faster

// Don't run too frequently
// Recommended: 1-2 times per day maximum

// Don't ignore rate limiting
// Instagram limits: ~1000 comments/day

// Don't use stolen credentials
// Account will get banned

// Don't run multiple automations simultaneously
// On same account - will trigger Instagram detection
```

---

## ⚠️ Rate Limiting

### Instagram Limits

- **Comments**: ~1000 per day
- **Hashtag fetches**: ~200 per day
- **General actions**: Varies

### Recommended Schedule

```javascript
// Once per day
cron.schedule('0 2 * * *', async () => {  // 2 AM daily
  await automation.run();
});

// Or twice per day
cron.schedule('0 2 * * *', ..);   // 2 AM
cron.schedule('0 14 * * *', ..);  // 2 PM
```

---

## 🚨 Troubleshooting

### "instagram-private-api not found"

```bash
npm install instagram-private-api@1.46.1
```

### "Rate limited by Instagram"

```javascript
// Wait and retry
const results = await automation.run();
if (results.errors.some(e => e.includes('Rate limited'))) {
  console.log('Wait 1 hour before retrying');
}
```

### "No posts found for hashtag"

```javascript
// Try different hashtag or sortType
const posts1 = await service.getHashtagPosts('travel', 'top');
const posts2 = await service.getHashtagPosts('travel', 'recent');
```

### "Persian hashtags not working"

```javascript
// Ensure proper normalization
const hashtag = 'تهران'.normalize('NFC');
await service.addHashtag(hashtag);
```

---

## 📁 File Structure

```
src/services/
├── hashtag.service.js                    # Basic hashtag storage
└── hashtag-automation.service.js         # Complete automation module

examples/
└── hashtag-automation-examples.js        # 5 working examples

tests/
└── hashtag-automation.service.test.js    # Unit tests

docs/
├── HASHTAG_AUTOMATION_DOCS.md            # Full API documentation
├── INTEGRATION_GUIDE.js                  # Integration patterns
└── REQUIREMENTS_CHECKLIST.md             # Requirements verification

data/
└── hashtags.json                         # Stored hashtags (auto-created)
```

---

## 📝 Example Workflows

### Workflow 1: Simple Hashtag Engagement

```javascript
const { HashtagService, InstagramHashtagService } = require('./src/services/hashtag-automation.service');

const service = new HashtagService();
await service.addHashtag('travel');

const instagram = new InstagramHashtagService(ig);
const posts = await instagram.getHashtagPosts('travel', 'top');

for (const post of posts.slice(0, 3)) {
  console.log(`Liking comments on @${post.user.username}'s post...`);
  await instagram.likeComments(post.id);
}
```

### Workflow 2: Multi-Hashtag Automation

```javascript
const { InstagramHashtagAutomation, HashtagService } = require('./src/services/hashtag-automation.service');

const hashtags = new HashtagService();
await hashtags.addHashtag('تهران');
await hashtags.addHashtag('travel');
await hashtags.addHashtag('photography');

const automation = new InstagramHashtagAutomation(ig, 5);  // Top 5 posts
const results = await automation.run({
  likeComments: true,
  verbose: true,
});

console.log(`Completed: ${results.totalCommentsLiked} comments liked`);
```

### Workflow 3: Error Handling

```javascript
try {
  const automation = new InstagramHashtagAutomation(ig, 3);
  const results = await automation.run();
  
  console.log(`✅ Success: ${results.totalCommentsLiked} comments`);
  
  if (results.errors.length > 0) {
    console.log('⚠️ Warnings:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }
} catch (error) {
  console.error('❌ Fatal error:', error.message);
}
```

---

## 🔐 Security

### Best Practices

1. **Store credentials securely** - Use environment variables
   ```javascript
   const username = process.env.IG_USERNAME;
   const password = process.env.IG_PASSWORD;
   ```

2. **Save sessions** - Avoid re-login
   ```javascript
   const session = ig.state.serialize();
   fs.writeFileSync('.session', session);
   ```

3. **Use 2FA** - Enable on Instagram account
4. **Rate limit yourself** - Run once per day maximum
5. **Don't share credentials** - Use separate accounts for testing

---

## 📄 License

ISC License - See LICENSE file

---

## 🙏 Credits

Built with:
- [instagram-private-api](https://github.com/dilame/instagram-private-api)
- Node.js v16+
- Modern JavaScript (ES6)

---

## 📞 Support

### Documentation
- **Full API Docs**: [HASHTAG_AUTOMATION_DOCS.md](./HASHTAG_AUTOMATION_DOCS.md)
- **Integration Guide**: [INTEGRATION_GUIDE.js](./INTEGRATION_GUIDE.js)
- **Requirements**: [REQUIREMENTS_CHECKLIST.md](./REQUIREMENTS_CHECKLIST.md)

### Issues
- Check [instagram-private-api issues](https://github.com/dilame/instagram-private-api/issues)
- Review error messages and logs
- Verify Instagram credentials

### Examples
- See `examples/hashtag-automation-examples.js`
- Run `npm test` for tests
- Check `INTEGRATION_GUIDE.js` for patterns

---

## 🎉 Summary

This module provides a **production-ready solution** for Instagram hashtag automation:

- ✅ Saves hashtags persistently
- ✅ Normalizes Persian/Arabic Unicode
- ✅ Fetches posts using correct API
- ✅ Likes comments automatically
- ✅ Includes realistic delays
- ✅ Comprehensive error handling
- ✅ Full documentation and examples
- ✅ Ready to deploy

**Total Code**: 450 lines  
**Total Documentation**: 1000+ lines  
**Version**: 1.0.0  
**Status**: Production Ready ✅

---

**Last Updated**: December 2, 2025  
**Maintained by**: m0p0m  
**Repository**: github.com/m0p0m/botinsta
