const mockIgApiClient = jest.fn(() => ({
  state: {
    generateDevice: jest.fn(),
    serialize: jest.fn().mockResolvedValue({ cookie: 'testcookie' }),
    deserialize: jest.fn(),
  },
  simulate: {
    preLoginFlow: jest.fn(),
  },
  account: {
    login: jest.fn().mockResolvedValue({ username: 'testuser', pk: 123 }),
  },
  user: {
    info: jest.fn().mockResolvedValue({
      follower_count: 100,
      following_count: 200,
      media_count: 50,
      profile_pic_url: 'test_url',
      full_name: 'Test User',
      biography: 'Test bio',
      external_url: 'test_external_url',
    }),
    getIdByUsername: jest.fn().mockResolvedValue(123),
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
    likeComment: jest.fn(),
  },
}));

module.exports = {
  IgApiClient: mockIgApiClient,
};
