import { resolveAnalyticsErrorMessage } from '../../src/utils/pinAnalytics';

describe('resolveAnalyticsErrorMessage', () => {
  it('returns permission message for 403', () => {
    expect(resolveAnalyticsErrorMessage({ status: 403 })).toBe(
      'You do not have permission to view attendance analytics.'
    );
  });

  it('returns reconnect guidance for auth errors', () => {
    expect(resolveAnalyticsErrorMessage({ isAuthError: true, message: 'Session expired' })).toBe(
      'Session expired'
    );
  });

  it('returns timeout guidance for aborted requests', () => {
    expect(resolveAnalyticsErrorMessage({ status: 'timeout', isTimeout: true })).toBe(
      'Loading attendance analytics timed out. Please try again.'
    );
  });

  it('falls back to generic message', () => {
    expect(resolveAnalyticsErrorMessage({})).toBe('Failed to load analytics');
  });
});
