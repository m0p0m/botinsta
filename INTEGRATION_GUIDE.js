/**
 * Quick Integration Guide: Hashtag Automation Module
 * 
 * This file shows how to integrate the hashtag automation module
 * into your existing Instagram bot application.
 */

const { IgApiClient } = require('instagram-private-api');
const {
  HashtagService,
  InstagramHashtagAutomation,
} = require('./src/services/hashtag-automation.service');

// ═════════════════════════════════════════════════════════════════
// OPTION 1: Use in Express Route Handler
// ═════════════════════════════════════════════════════════════════

const express = require('express');
const app = express();

/**
 * Route: POST /api/automation/run
 * Starts hashtag automation for a specific account
 */
app.post('/api/automation/run', async (req, res) => {
  try {
    const { username } = req.body;

    // Get the logged-in Instagram client for this account
    // (Assuming you store active sessions in memory or database)
    const ig = getInstagramClient(username); // Your method

    if (!ig) {
      return res.status(401).json({ error: 'Account not logged in' });
    }

    // Create automation instance
    const automation = new InstagramHashtagAutomation(ig, 3);

    // Run in background (don't wait for completion)
    automation.run({
      likeComments: true,
      verbose: true,
    })
      .then(results => {
        console.log('✅ Automation completed:', results);
        // Store results in database if needed
      })
      .catch(error => {
        console.error('❌ Automation failed:', error);
      });

    // Return immediately
    res.json({
      status: 'started',
      message: 'Hashtag automation started in background',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═════════════════════════════════════════════════════════════════
// OPTION 2: Use in Scheduled Task (Every Hour)
// ═════════════════════════════════════════════════════════════════

const cron = require('node-cron');

/**
 * Run automation every hour
 * Cron pattern: '0 * * * *' = every hour
 */
cron.schedule('0 * * * *', async () => {
  console.log('\n🕐 Starting hourly hashtag automation...\n');

  try {
    // Get all active account sessions
    const accounts = getActiveAccounts(); // Your method

    for (const account of accounts) {
      try {
        console.log(`\n📱 Processing account: @${account.username}`);

        const automation = new InstagramHashtagAutomation(
          account.igClient,
          3 // top 3 posts
        );

        const results = await automation.run({
          likeComments: true,
          verbose: false,
        });

        console.log(`✅ Account ${account.username}: ${results.totalCommentsLiked} comments liked`);
      } catch (error) {
        console.error(`❌ Error for ${account.username}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Hourly automation error:', error);
  }
});

// ═════════════════════════════════════════════════════════════════
// OPTION 3: Hashtag Management Routes
// ═════════════════════════════════════════════════════════════════

/**
 * GET /api/hashtags
 * Get all stored hashtags
 */
app.get('/api/hashtags', async (req, res) => {
  try {
    const hashtagService = new HashtagService();
    const hashtags = await hashtagService.getHashtags();
    res.json({ hashtags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/hashtags
 * Add a new hashtag
 * Body: { hashtag: 'travel' }
 */
app.post('/api/hashtags', async (req, res) => {
  try {
    const { hashtag } = req.body;

    if (!hashtag) {
      return res.status(400).json({ error: 'Hashtag is required' });
    }

    const hashtagService = new HashtagService();
    await hashtagService.addHashtag(hashtag);

    res.json({
      status: 'added',
      hashtag: hashtag.replace(/^#/, '').trim(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/hashtags/:hashtag
 * Remove a hashtag
 */
app.delete('/api/hashtags/:hashtag', async (req, res) => {
  try {
    const { hashtag } = req.params;

    const hashtagService = new HashtagService();
    await hashtagService.removeHashtag(hashtag);

    res.json({
      status: 'removed',
      hashtag,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═════════════════════════════════════════════════════════════════
// OPTION 4: Command Line Interface (CLI)
// ═════════════════════════════════════════════════════════════════

/**
 * Usage:
 * node cli.js add تهران
 * node cli.js remove travel
 * node cli.js list
 * node cli.js run
 */

const args = process.argv.slice(2);
const command = args[0];

async function runCLI() {
  const hashtagService = new HashtagService();

  switch (command) {
    case 'add': {
      const hashtag = args[1];
      if (!hashtag) {
        console.error('Usage: node cli.js add <hashtag>');
        process.exit(1);
      }
      await hashtagService.addHashtag(hashtag);
      console.log(`✅ Added hashtag: ${hashtag}`);
      break;
    }

    case 'remove': {
      const hashtag = args[1];
      if (!hashtag) {
        console.error('Usage: node cli.js remove <hashtag>');
        process.exit(1);
      }
      await hashtagService.removeHashtag(hashtag);
      console.log(`✅ Removed hashtag: ${hashtag}`);
      break;
    }

    case 'list': {
      const hashtags = await hashtagService.getHashtags();
      console.log('📝 Stored hashtags:');
      hashtags.forEach(tag => console.log(`   - ${tag}`));
      break;
    }

    case 'run': {
      const username = args[1];
      if (!username) {
        console.error('Usage: node cli.js run <username>');
        process.exit(1);
      }
      const ig = getInstagramClient(username);
      if (!ig) {
        console.error('❌ Account not logged in');
        process.exit(1);
      }
      const automation = new InstagramHashtagAutomation(ig, 3);
      await automation.run({ likeComments: true, verbose: true });
      break;
    }

    default:
      console.log(`
Usage:
  node cli.js add <hashtag>     - Add a hashtag
  node cli.js remove <hashtag>  - Remove a hashtag
  node cli.js list              - List all hashtags
  node cli.js run <username>    - Run automation for account
      `);
  }
}

// Run CLI if this is the main module
if (require.main === module) {
  if (command) {
    runCLI().catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
  }
}

// ═════════════════════════════════════════════════════════════════
// OPTION 5: Class-Based Controller (Best Practices)
// ═════════════════════════════════════════════════════════════════

class AutomationController {
  constructor() {
    this.hashtagService = new HashtagService();
  }

  /**
   * Get all hashtags
   */
  async getHashtags(req, res) {
    try {
      const hashtags = await this.hashtagService.getHashtags();
      return res.json({ hashtags });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Add a hashtag
   */
  async addHashtag(req, res) {
    try {
      const { hashtag } = req.body;

      if (!hashtag) {
        return res.status(400).json({ error: 'Hashtag required' });
      }

      await this.hashtagService.addHashtag(hashtag);

      return res.status(201).json({
        status: 'added',
        hashtag: hashtag.replace(/^#/, '').trim(),
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Remove a hashtag
   */
  async removeHashtag(req, res) {
    try {
      const { hashtag } = req.params;
      await this.hashtagService.removeHashtag(hashtag);
      return res.json({ status: 'removed', hashtag });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * Start automation for an account
   */
  async startAutomation(req, res) {
    try {
      const { username } = req.body;

      const ig = getInstagramClient(username);
      if (!ig) {
        return res.status(401).json({ error: 'Account not logged in' });
      }

      const automation = new InstagramHashtagAutomation(ig, 3);

      // Run in background
      automation.run({
        likeComments: true,
        verbose: true,
      })
        .then(results => {
          console.log('✅ Automation completed');
          // Store results in database
        })
        .catch(error => {
          console.error('❌ Automation error:', error);
        });

      return res.json({
        status: 'started',
        message: 'Automation started',
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}

// Register routes with controller
const controller = new AutomationController();

app.get('/api/hashtags', (req, res) => controller.getHashtags(req, res));
app.post('/api/hashtags', (req, res) => controller.addHashtag(req, res));
app.delete('/api/hashtags/:hashtag', (req, res) => controller.removeHashtag(req, res));
app.post('/api/automation/start', (req, res) => controller.startAutomation(req, res));

// ═════════════════════════════════════════════════════════════════
// Helper Functions
// ═════════════════════════════════════════════════════════════════

/**
 * Get Instagram client for an account
 * Implement based on your session storage
 */
function getInstagramClient(username) {
  // TODO: Implement based on your storage
  // - Database: fetch session from DB
  // - Memory: fetch from cache
  // - File: load from file
  // - etc.
  
  // Example:
  // const sessionData = db.getSession(username);
  // const ig = new IgApiClient();
  // ig.state.deserialize(sessionData);
  // return ig;
  
  return null; // Placeholder
}

/**
 * Get all active account sessions
 */
function getActiveAccounts() {
  // TODO: Implement based on your storage
  // Return array of { username, igClient }
  return [];
}

// ═════════════════════════════════════════════════════════════════

module.exports = {
  AutomationController,
  app,
};
