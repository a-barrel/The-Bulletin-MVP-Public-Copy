import { BADGE_METADATA, getBadgeMetadata, getBadgeLabel } from '../../src/utils/badges';

describe('badge utilities', () => {
  it('exposes immutable badge metadata', () => {
    expect(Object.keys(BADGE_METADATA)).toContain('chat-first-message');
    expect(getBadgeMetadata('chat-first-message')).toMatchObject({
      label: 'Conversation Starter'
    });
  });

  it('returns fallback labels when metadata is missing', () => {
    expect(getBadgeLabel('custom_badge')).toBe('Custom Badge');
    expect(getBadgeLabel('how-badge')).toBe('HOW?!');
    expect(getBadgeLabel()).toBe('Badge');
  });
});
