const { InstagramService } = require('../services/instagram.service');

describe('InstagramService', () => {
  it('should be defined', () => {
    expect(new InstagramService()).toBeDefined();
  });
});
