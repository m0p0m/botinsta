const mockIgApiClient = {
  state: {
    generateDevice: jest.fn(),
    serialize: jest.fn().mockResolvedValue({}),
    deserialize: jest.fn().mockResolvedValue({}),
  },
  simulate: {
    preLoginFlow: jest.fn().mockResolvedValue({}),
    postLoginFlow: jest.fn().mockResolvedValue({}),
  },
  account: {
    login: jest.fn().mockResolvedValue({
      pk: 123,
      username: 'testuser',
    }),
  },
  user: {
    getIdByUsername: jest.fn().mockResolvedValue(123),
    info: jest.fn().mockResolvedValue({
      follower_count: 100,
      following_count: 200,
      media_count: 50,
      profile_pic_url: 'test_url',
      full_name: 'Test User',
      biography: 'Test bio',
      external_url: 'test_external_url',
      is_verified: false,
      is_private: false,
    }),
  },
  feed: {
    tag: jest.fn(() => ({
      items: jest.fn().mockResolvedValue([]),
    })),
    discover: jest.fn(() => ({
      items: jest.fn().mockResolvedValue([]),
    })),
  },
  media: {
    commentsFeed: jest.fn(() => ({
      items: jest.fn().mockResolvedValue([]),
    })),
    info: jest.fn().mockResolvedValue({ items: [{}] }),
    likeComment: jest.fn().mockResolvedValue({}),
  },
  hashtag: {
    info: jest.fn().mockResolvedValue({}),
  },
  request: {},
};

class IgApiClient {
  constructor() {
    this.state = mockIgApiClient.state;
    this.simulate = mockIgApiClient.simulate;
    this.account = mockIgApiClient.account;
    this.user = mockIgApiClient.user;
    this.feed = mockIgApiClient.feed;
    this.media = mockIgApiClient.media;
    this.hashtag = mockIgApiClient.hashtag;
    this.request = mockIgApiClient.request;
  }
}

module.exports = {
  IgApiClient,
};
