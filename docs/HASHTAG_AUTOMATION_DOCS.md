# Hashtag Automation Module Documentation

**Version**: 1.0.0  
**Language**: ES6 JavaScript (Node.js)  
**Dependencies**: `instagram-private-api` v1.46.1+

## Overview

The Hashtag Automation Module provides a complete solution for automating hashtag-based Instagram engagement:

- 📝 **Persistent Storage**: Save and manage hashtags in `/data/hashtags.json`
- 🌍 **Unicode Support**: Full Persian/Arabic Unicode normalization (NFC)
- 📸 **Post Fetching**: Retrieve posts by hashtag with sorting options
- ❤️ **Comment Automation**: Like comments on posts automatically
- 🤖 **Full Automation**: Complete workflow with realistic delays
- 🛡️ **Error Handling**: Comprehensive error management including rate limiting

---

## Module Structure

### Files

```
src/services/
├── hashtag.service.js              # Basic hashtag storage (updated)
└── hashtag-automation.service.js   # Complete automation module (new)

examples/
└── hashtag-automation-examples.js  # Usage examples

data/
└── hashtags.json                   # Stored hashtags (auto-created)
```

---

## Classes

### 1. HashtagService

Basic hashtag storage and retrieval with Unicode normalization.

#### Constructor
```javascript
const { HashtagService } = require('./src/services/hashtag-automation.service');
const service = new HashtagService();
```

#### Methods

##### `getHashtags(): Promise<string[]>`
Retrieves all stored hashtags.

```javascript
const hashtags = await service.getHashtags();
console.log(hashtags);
// Output: ['تهران', 'ماشین', 'technology', 'travel']
```

##### `addHashtag(hashtag: string): Promise<void>`
Adds a hashtag with automatic normalization. Removes leading `#` and normalizes Unicode.

```javascript
// All of these add the same hashtag
await service.addHashtag('تهران');
await service.addHashtag('#تهران');
await service.addHashtag('  #تهران  ');
```

**Features:**
- Removes leading `#`
- Trims whitespace
- Normalizes Unicode to NFC form (Persian/Arabic support)
- Prevents duplicates

##### `removeHashtag(hashtag: string): Promise<void>`
Removes a hashtag from storage.

```javascript
await service.removeHashtag('تهران');
```

---

### 2. InstagramHashtagService

Handles all Instagram-specific hashtag operations.

#### Constructor
```javascript
const { IgApiClient } = require('instagram-private-api');
const { InstagramHashtagService } = require('./src/services/hashtag-automation.service');

const ig = new IgApiClient();
// ... login to Instagram ...

const instagramService = new InstagramHashtagService(ig);
```

**Parameters:**
- `ig` (IgApiClient): A logged-in Instagram API client instance

#### Methods

##### `getHashtagPosts(hashtag: string, sortType: string): Promise<Object[]>`

Fetches posts for a given hashtag. **Uses `ig.feed.tags()` method** (not `ig.feed.tag()`).

**Parameters:**
- `hashtag` (string): Hashtag without `#` (e.g., `'تهران'`, `'travel'`)
- `sortType` (string): Either `'recent'` or `'top'`

**Returns:**
- Array of media objects with post details

```javascript
// Fetch top posts
const topPosts = await instagramService.getHashtagPosts('تهران', 'top');
console.log(`Found ${topPosts.length} posts`);

// Fetch recent posts
const recentPosts = await instagramService.getHashtagPosts('travel', 'recent');

// Post object structure
if (topPosts.length > 0) {
  const post = topPosts[0];
  console.log(post.id);                    // Media ID
  console.log(post.user.username);         // Username
  console.log(post.like_count);            // Like count
  console.log(post.caption?.text);         // Caption
}
```

**Errors Handled:**
- Invalid hashtag (empty or null)
- Invalid sortType (must be 'recent' or 'top')
- Empty feed
- Rate limiting (429 error)
- Network errors

##### `fetchComments(mediaId: string): Promise<Object[]>`

Fetches comments from a post.

```javascript
const comments = await instagramService.fetchComments('1234567890');
console.log(`Found ${comments.length} comments`);

// Comment object structure
if (comments.length > 0) {
  const comment = comments[0];
  console.log(comment.id);           // Comment ID
  console.log(comment.user.username); // Comment author
  console.log(comment.text);          // Comment text
}
```

##### `likeComment(commentId: string): Promise<boolean>`

Likes a single comment. Returns `true` if successful.

```javascript
const success = await instagramService.likeComment('commentId123');
if (success) {
  console.log('Comment liked!');
}
```

##### `likeComments(mediaId: string): Promise<number>`

Likes all comments on a post. Includes realistic delays (0.8-1.5s between likes).

```javascript
const likedCount = await instagramService.likeComments('mediaId123');
console.log(`Liked ${likedCount} comments`);
```

**Features:**
- Fetches all comments
- Likes each one with realistic delays
- Returns count of successfully liked comments
- Continues even if individual likes fail
- Comprehensive error handling

---

### 3. InstagramHashtagAutomation

Main orchestration class that combines hashtag storage, post fetching, and comment automation.

#### Constructor
```javascript
const { InstagramHashtagAutomation } = require('./src/services/hashtag-automation.service');

const automation = new InstagramHashtagAutomation(ig, 3);
// ig: logged-in Instagram API client
// 3: number of top posts to process per hashtag (default: 3)
```

#### Methods

##### `run(options?: Object): Promise<Object>`

Runs the complete automation workflow.

**Parameters:**
- `options.likeComments` (boolean): Whether to like comments (default: `true`)
- `options.verbose` (boolean): Enable detailed logging (default: `false`)

**Workflow:**
1. Loads hashtags from storage
2. For each hashtag:
   - Fetches top posts
   - For each of top N posts:
     - Fetches all comments
     - Likes all comments (with delays)
     - Waits 3-7 seconds before next post
3. Waits 3-7 seconds before next hashtag

```javascript
const results = await automation.run({
  likeComments: true,
  verbose: true
});

console.log(results);
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
//     },
//     ...
//   ],
//   totalPostsFetched: 45,
//   totalCommentsLiked: 128,
//   errors: []
// }
```

**Return Object:**
```javascript
{
  startTime: Date,           // When automation started
  endTime: Date,             // When automation finished
  duration: number,          // Duration in milliseconds
  hashtags: [                // Per-hashtag results
    {
      hashtag: string,
      posts: number,         // Posts fetched
      commentsLiked: number,
      error: string | null
    }
  ],
  totalPostsFetched: number,
  totalCommentsLiked: number,
  errors: string[]           // All errors encountered
}
```

---

## Usage Examples

### Example 1: Basic Hashtag Management

```javascript
const { HashtagService } = require('./src/services/hashtag-automation.service');

const service = new HashtagService();

// Add hashtags
await service.addHashtag('travel');
await service.addHashtag('#photography');
await service.addHashtag('تهران');

// Get all
const hashtags = await service.getHashtags();
console.log(hashtags);

// Remove
await service.removeHashtag('travel');
```

### Example 2: Fetch Hashtag Posts

```javascript
const { IgApiClient } = require('instagram-private-api');
const { InstagramHashtagService } = require('./src/services/hashtag-automation.service');

const ig = new IgApiClient();
await ig.account.login(username, password);

const service = new InstagramHashtagService(ig);

// Fetch posts
const posts = await service.getHashtagPosts('تهران', 'top');
console.log(`Found ${posts.length} posts`);

// Get first post details
if (posts.length > 0) {
  const post = posts[0];
  console.log(`By: @${post.user.username}`);
  console.log(`Likes: ${post.like_count}`);
  console.log(`Caption: ${post.caption?.text}`);
}
```

### Example 3: Like Comments on a Post

```javascript
const service = new InstagramHashtagService(ig);

// Like all comments on a post
const mediaId = '1234567890';
const likedCount = await service.likeComments(mediaId);
console.log(`Liked ${likedCount} comments`);
```

### Example 4: Full Automation Workflow

```javascript
const { InstagramHashtagAutomation, HashtagService } = require('./src/services/hashtag-automation.service');

// Setup
const automation = new InstagramHashtagAutomation(ig, 3); // top 3 posts
const hashtags = new HashtagService();

// Add some hashtags to process
await hashtags.addHashtag('تهران');
await hashtags.addHashtag('travel');
await hashtags.addHashtag('technology');

// Run automation
const results = await automation.run({
  likeComments: true,
  verbose: true
});

console.log(`Liked ${results.totalCommentsLiked} comments total`);
console.log(`Processed ${results.hashtags.length} hashtags`);
console.log(`Took ${Math.round(results.duration / 1000)} seconds`);
```

### Example 5: Persian Hashtags

```javascript
const service = new HashtagService();

// Add various Persian hashtags
await service.addHashtag('تهران');      // Tehran
await service.addHashtag('#ماشین');     // Car
await service.addHashtag('فناوری');     // Technology
await service.addHashtag('#آزادی');     // Freedom

const persianHashtags = await service.getHashtags();
console.log(persianHashtags);

// Fetch posts for Persian hashtag
const instagram = new InstagramHashtagService(ig);
const posts = await instagram.getHashtagPosts('تهران', 'top');
console.log(`Found ${posts.length} posts for #تهران`);
```

---

## Features in Detail

### Unicode Normalization (NFC)

All hashtags are automatically normalized to NFC form for consistency:

```javascript
const original = 'آزادی';           // Persian: Freedom
const normalized = original.normalize('NFC');

// These are now equivalent for storage:
await service.addHashtag(original);
await service.addHashtag(normalized);

const stored = await service.getHashtags();
console.log(stored.length); // 1 (not 2, due to deduplication)
```

### Realistic Delays

The automation includes realistic random delays to avoid detection:

- **Between comments**: 0.8-1.5 seconds
- **Between posts**: 3-7 seconds
- **Between hashtags**: 3-7 seconds

### Error Handling

Comprehensive error handling for:

| Error | Handling |
|-------|----------|
| Rate Limiting (429) | Throws informative error, skips current item |
| Invalid Credentials | Throws error immediately |
| Network Errors | Retryable with error message |
| Empty Feed | Returns empty array, logs warning |
| Invalid Parameters | Validates and throws specific error |
| Session Expired | Throws "session not initialized" error |

### Persian/Arabic Support

- ✅ Stores Persian hashtags natively
- ✅ Supports both normalized and denormalized forms
- ✅ Removes `#` automatically
- ✅ Works with `ig.feed.tags()` API

---

## Data Storage

### File Structure

```json
// /data/hashtags.json
[
  "تهران",
  "ماشین",
  "technology",
  "travel",
  "فناوری"
]
```

The file is automatically created if it doesn't exist.

---

## API Reference

### instagram-private-api Methods Used

This module uses these exact methods from `instagram-private-api`:

```javascript
// Fetch hashtag posts (MUST use .tags() not .tag())
ig.feed.tags(hashtag, sortType)      // Returns feed object
feed.items()                          // Gets posts from feed

// Comments
ig.media.commentsFeed(mediaId)        // Gets comments feed
commentsFeed.items()                  // Gets comments

// Like comments
ig.media.likeComment(commentId)       // Likes a comment
```

For full documentation, see: https://github.com/dilame/instagram-private-api/tree/master/docs

---

## Best Practices

### Do's ✅
- Use realistic delays between actions
- Catch and handle errors properly
- Monitor rate limiting responses
- Store sessions between runs
- Use Persian hashtags for Persian content
- Test with `verbose: true` first

### Don'ts ❌
- Don't remove delays to speed up automation
- Don't ignore rate limiting errors
- Don't run multiple automations simultaneously
- Don't automate too frequently (once per day recommended)
- Don't like/comment on spam content
- Don't use without proper Instagram login

### Rate Limiting Guidelines

Instagram applies rate limits:
- **Comments**: ~1000 per day
- **Hashtag fetches**: ~200 per day
- **General actions**: Varies

**Recommendation**: Run automation 1-2 times per day maximum.

---

## Testing

Run examples:

```bash
# Basic hashtag management and Persian support (no login needed)
node examples/hashtag-automation-examples.js

# Run specific example by uncommenting in the file
# Examples require Instagram login credentials
```

---

## Troubleshooting

### Issue: "instagram-private-api not found"
```bash
npm install instagram-private-api@1.46.1
```

### Issue: "Rate limited by Instagram"
- Reduce automation frequency
- Add longer delays
- Use different accounts
- Wait before retrying

### Issue: "sortType must be 'recent' or 'top'"
```javascript
// Correct
await service.getHashtagPosts(hashtag, 'top');
await service.getHashtagPosts(hashtag, 'recent');

// Incorrect
await service.getHashtagPosts(hashtag, 'trending');  // ❌
```

### Issue: Persian hashtags not working
```javascript
// Make sure hashtags are normalized
const hashtag = 'تهران'.normalize('NFC');  // ✅
const posts = await service.getHashtagPosts(hashtag, 'top');
```

### Issue: No comments found
```javascript
// Some posts may have comments disabled
// Try a different post
const comments = await service.fetchComments(mediaId);
if (comments.length === 0) {
  console.log('No comments available');
}
```

---

## License

ISC License (same as project)

---

## Support

For issues with `instagram-private-api`:
- https://github.com/dilame/instagram-private-api/issues

For module issues:
- Check examples/hashtag-automation-examples.js
- Review error messages and logs
- Verify Instagram credentials are correct
