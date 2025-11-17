const { InstagramService } = require('../services/instagram.service');
const { IgApiClient } = require('instagram-private-api');
const fs = require('fs').promises;

jest.mock('instagram-private-api');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('InstagramService', () => {
  let service;
  let mockIgApiClient;

  beforeEach(() => {
    const mockLogin = jest.fn().mockResolvedValue({ username: 'testuser', pk: 123 });
    const mockSerialize = jest.fn().mockResolvedValue({ cookie: 'testcookie' });
    const mockInfo = jest.fn().mockResolvedValue({
      follower_count: 100,
      following_count: 200,
      media_count: 50,
      profile_pic_url: 'test_url',
      full_name: 'Test User',
      biography: 'Test bio',
      external_url: 'test_external_url',
    });
    const mockGetIdByUsername = jest.fn().mockResolvedValue(123);

    mockIgApiClient = {
      state: {
        generateDevice: jest.fn(),
        serialize: mockSerialize,
        deserialize: jest.fn(),
      },
      simulate: {
        preLoginFlow: jest.fn(),
      },
      account: {
        login: mockLogin,
      },
      user: {
        info: mockInfo,
        getIdByUsername: mockGetIdByUsername,
      },
    };

    IgApiClient.mockImplementation(() => mockIgApiClient);
    service = new InstagramService();

    fs.readFile.mockClear();
    fs.writeFile.mockClear();
  });

  it('should login and save account data', async () => {
    fs.readFile.mockResolvedValue('[]');
    await service.login('testuser', 'testpassword');
    expect(mockIgApiClient.account.login).toHaveBeenCalledWith('testuser', 'testpassword');
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify([{ username: 'testuser', pk: 123, session: { cookie: 'testcookie' } }], null, 2)
    );
  });

  it('should get profile data', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify([{ username: 'testuser', session: {} }]));
    const profileData = await service.getProfileData('testuser');
    expect(mockIgApiClient.user.getIdByUsername).toHaveBeenCalledWith('testuser');
    expect(mockIgApiClient.user.info).toHaveBeenCalledWith(123);
    expect(profileData).toEqual({
      followers: 100,
      following: 200,
      posts: 50,
      profile_pic_url: 'test_url',
      full_name: 'Test User',
      biography: 'Test bio',
      external_url: 'test_external_url',
    });
  });
});
