const { IgApiClient } = require('instagram-private-api');
const fs = require('fs').promises;
const path = require('path');

const accountsFilePath = path.join(__dirname, '../data/accounts.json');

class InstagramService {
  constructor() {
    this.ig = new IgApiClient();
  }

  async login(username, password) {
    this.ig.state.generateDevice(username);
    await this.ig.simulate.preLoginFlow();
    const loggedInUser = await this.ig.account.login(username, password);

    const accounts = await this.getAccounts();
    const existingAccount = accounts.find(acc => acc.username === username);

    if (existingAccount) {
      existingAccount.session = await this.ig.state.serialize();
    } else {
      accounts.push({
        username: loggedInUser.username,
        pk: loggedInUser.pk,
        session: await this.ig.state.serialize(),
      });
    }

    await fs.writeFile(accountsFilePath, JSON.stringify(accounts, null, 2));
    return loggedInUser;
  }

  async getAccounts() {
    try {
      const data = await fs.readFile(accountsFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getApiClient(username) {
    const accounts = await this.getAccounts();
    const account = accounts.find(acc => acc.username === username);

    if (!account) {
      throw new Error('Account not found');
    }

    const ig = new IgApiClient();
    ig.state.generateDevice(account.username);
    await ig.state.deserialize(account.session);
    return ig;
  }

  async getProfileData(username) {
    const ig = await this.getApiClient(username);
    const userId = await ig.user.getIdByUsername(username);
    const userInfo = await ig.user.info(userId);

    return {
      followers: userInfo.follower_count,
      following: userInfo.following_count,
      posts: userInfo.media_count,
      profile_pic_url: userInfo.profile_pic_url,
      full_name: userInfo.full_name,
      biography: userInfo.biography,
      external_url: userInfo.external_url,
    };
  }

  async getHashtagFeed(username, hashtag) {
    const ig = await this.getApiClient(username);
    return ig.feed.tag(hashtag);
  }

  async getExploreFeed(username) {
    const ig = await this.getApiClient(username);
    return ig.feed.discover();
  }

  async getPostComments(username, mediaId) {
    const ig = await this.getApiClient(username);
    return ig.media.commentsFeed(mediaId);
  }

  async likeComment(username, commentId) {
    const ig = await this.getApiClient(username);
    return ig.media.likeComment(commentId);
  }
}

module.exports = { InstagramService, instagramService: new InstagramService() };
