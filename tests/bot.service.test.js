const { BotService } = require('../services/bot');
const { instagramService } = require('../services/instagram.service');

jest.mock('../services/instagram.service', () => ({
  instagramService: {
    getHashtagFeed: jest.fn(),
    getExploreFeed: jest.fn(),
    getPostComments: jest.fn(),
    likeComment: jest.fn(),
  },
}));

describe('BotService', () => {
  let botService;
  let onUpdate;

  beforeEach(() => {
    jest.useFakeTimers();
    botService = new BotService();
    onUpdate = jest.fn();
    instagramService.getHashtagFeed.mockClear();
    instagramService.getExploreFeed.mockClear();
    instagramService.getPostComments.mockClear();
    instagramService.likeComment.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(botService).toBeDefined();
  });

});
