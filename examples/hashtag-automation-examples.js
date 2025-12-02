/**
 * Example Usage of Hashtag Automation Module
 * 
 * This file demonstrates how to use the hashtag automation system
 * with the instagram-private-api library.
 */

const { IgApiClient } = require('instagram-private-api');
const {
  HashtagService,
  InstagramHashtagService,
  InstagramHashtagAutomation,
} = require('./services/hashtag-automation.service');

/**
 * Example 1: Basic Hashtag Management
 * Add, retrieve, and remove hashtags
 */
async function exampleHashtagManagement() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Example 1: Hashtag Management');
  console.log('═══════════════════════════════════════════════════\n');

  const hashtagService = new HashtagService();

  try {
    // Add some hashtags (with or without #)
    await hashtagService.addHashtag('تهران'); // Persian: Tehran
    await hashtagService.addHashtag('#ماشین'); // Persian: Car (with #)
    await hashtagService.addHashtag('technology');
    await hashtagService.addHashtag('#travel');

    // Get all hashtags
    const hashtags = await hashtagService.getHashtags();
    console.log('📝 Stored hashtags:', hashtags);

    // Remove a hashtag
    await hashtagService.removeHashtag('travel');
    console.log('✅ Removed hashtag: travel');

    const updatedHashtags = await hashtagService.getHashtags();
    console.log('📝 Updated hashtags:', updatedHashtags);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Example 2: Fetch Hashtag Posts
 * Get posts for a specific hashtag
 */
async function exampleFetchHashtagPosts(ig, hashtag = 'travel') {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Example 2: Fetch Hashtag Posts');
  console.log('═══════════════════════════════════════════════════\n');

  const instagramHashtagService = new InstagramHashtagService(ig);

  try {
    // Fetch recent posts
    console.log(`\n🔍 Fetching recent posts for #${hashtag}:`);
    const recentPosts = await instagramHashtagService.getHashtagPosts(hashtag, 'recent');
    console.log(`✅ Found ${recentPosts.length} recent posts`);

    // Fetch top posts
    console.log(`\n🔍 Fetching top posts for #${hashtag}:`);
    const topPosts = await instagramHashtagService.getHashtagPosts(hashtag, 'top');
    console.log(`✅ Found ${topPosts.length} top posts`);

    // Get details from first post
    if (topPosts.length > 0) {
      const firstPost = topPosts[0];
      console.log(`\n📸 First post details:`);
      console.log(`   - Posted by: @${firstPost.user?.username || 'unknown'}`);
      console.log(`   - Likes: ${firstPost.like_count || 0}`);
      console.log(`   - Caption: ${(firstPost.caption?.text || 'No caption').substring(0, 100)}...`);
      console.log(`   - Media ID: ${firstPost.id}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Example 3: Like Comments on a Post
 * Fetch and like all comments from a post
 */
async function exampleLikeComments(ig, mediaId) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Example 3: Like Comments on a Post');
  console.log('═══════════════════════════════════════════════════\n');

  const instagramHashtagService = new InstagramHashtagService(ig);

  try {
    const commentsLiked = await instagramHashtagService.likeComments(mediaId);
    console.log(`✅ Successfully liked ${commentsLiked} comments`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Example 4: Full Automation Workflow
 * Run complete hashtag automation with realistic delays
 */
async function exampleFullAutomation(ig) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Example 4: Full Hashtag Automation Workflow');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Create automation instance
    const automation = new InstagramHashtagAutomation(ig, 3); // Process top 3 posts

    // First, add some hashtags to process
    const hashtagService = new HashtagService();
    await hashtagService.addHashtag('تهران');
    await hashtagService.addHashtag('technology');
    await hashtagService.addHashtag('travel');

    // Run the automation
    const results = await automation.run({
      likeComments: true, // Like comments on posts
      verbose: true, // Detailed logging
    });

    // Results will include:
    // - Total posts fetched
    // - Total comments liked
    // - Errors encountered
    // - Duration of execution
    console.log('\n📊 Results Summary:');
    console.log(`   - Duration: ${Math.round(results.duration / 1000)}s`);
    console.log(`   - Posts Fetched: ${results.totalPostsFetched}`);
    console.log(`   - Comments Liked: ${results.totalCommentsLiked}`);
    console.log(`   - Errors: ${results.errors.length}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Example 5: Working with Persian Hashtags
 * Demonstrates Unicode normalization and Persian support
 */
async function examplePersianHashtags() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('Example 5: Persian Hashtags Support');
  console.log('═══════════════════════════════════════════════════\n');

  const hashtagService = new HashtagService();

  try {
    // Add Persian hashtags (various formats)
    const persianHashtags = [
      'تهران', // Persian: Tehran
      '#ماشین', // Persian: Car (with #)
      '#تحریر', // Persian: Liberation
      'فناوری', // Persian: Technology
      '#ایران', // Persian: Iran (with #)
    ];

    console.log('📝 Adding Persian hashtags...');
    for (const hashtag of persianHashtags) {
      await hashtagService.addHashtag(hashtag);
      console.log(`   ✅ Added: ${hashtag}`);
    }

    const stored = await hashtagService.getHashtags();
    console.log('\n✅ Stored Persian hashtags:');
    stored.forEach(tag => console.log(`   - ${tag}`));

    // Demonstrate Unicode normalization
    console.log('\n🔤 Unicode Normalization (NFC):');
    const original = 'آزادی'; // Persian word for freedom
    const normalized = original.normalize('NFC');
    console.log(`   Original: ${original}`);
    console.log(`   Normalized: ${normalized}`);
    console.log(`   Equal: ${original === normalized}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Main entry point
 * Uncomment examples to run them
 */
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   Instagram Hashtag Automation Examples           ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  // Example 1: Hashtag Management (No Instagram login required)
  await exampleHashtagManagement();

  // Example 5: Persian Hashtags (No Instagram login required)
  await examplePersianHashtags();

  // ⚠️ The following examples require Instagram login
  // Uncomment and provide a logged-in IgApiClient instance

  /*
  // Initialize Instagram API
  const ig = new IgApiClient();
  
  // Login
  try {
    console.log('\n🔐 Logging into Instagram...');
    // await ig.account.login(username, password);
    // or load session from storage
    // const session = fs.readFileSync('session.json');
    // ig.state.deserialize(session);
    
    console.log('✅ Logged in successfully\n');

    // Run examples
    await exampleFetchHashtagPosts(ig, 'تهران'); // Persian hashtag
    await exampleFetchHashtagPosts(ig, 'travel');
    
    // Get a media ID from one of the posts above
    // await exampleLikeComments(ig, 'mediaId_here');
    
    // Run full automation (be careful with this - it will like comments!)
    // await exampleFullAutomation(ig);
  } catch (error) {
    console.error('❌ Login error:', error.message);
  }
  */
}

// Run examples
if (require.main === module) {
  main().catch(error => console.error('❌ Fatal error:', error));
}

module.exports = {
  exampleHashtagManagement,
  exampleFetchHashtagPosts,
  exampleLikeComments,
  exampleFullAutomation,
  examplePersianHashtags,
};
