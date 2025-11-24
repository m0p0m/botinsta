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

  it('should start and stop the bot', () => {
    const username = 'testuser';
    botService.start(username, 'hashtag', 'test', onUpdate);
    expect(botService.jobs[username]).toBeDefined();
    expect(botService.jobs[username].status).toBe('running');
    expect(onUpdate).toHaveBeenCalledWith('در حال اجرا', `ربات برای ${username} شروع به کار کرد.`);

    botService.stop(username);
    expect(botService.jobs[username].stop).toBe(true);
    expect(onUpdate).toHaveBeenCalledWith('بیکار', `ربات برای ${username} در حال توقف است.`);
  });

  it('should calculate the delay between likes correctly', () => {
    const username = 'testuser';
    const options = { total_likes_target: 700, time_period_hours: 12 };
    const expectedDelay = (12 * 60 * 60 * 1000) / 700;

    botService.start(username, 'hashtag', 'test', onUpdate, options);
    expect(botService.jobs[username].delay_between_likes_ms).toBe(expectedDelay);
  });
});
