import {
  formatDateTime,
  formatFriendlyTimestamp,
  formatRelativeTime,
  formatAbsoluteDateTime
} from '../../src/utils/dates';

describe('utils/dates', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('formatDateTime returns localized string', () => {
    const value = new Date('2024-01-15T14:30:00Z');
    const expected = value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    expect(formatDateTime(value)).toBe(expected);
  });

  test('formatDateTime returns fallback when invalid', () => {
    expect(formatDateTime('not-a-date', { fallback: 'n/a' })).toBe('n/a');
  });

  test('formatFriendlyTimestamp handles same day and yesterday', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    const sameDay = new Date('2024-01-15T08:45:00Z');
    const expectedSameDay = sameDay.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(formatFriendlyTimestamp(sameDay)).toBe(expectedSameDay);

    const yesterday = new Date('2024-01-14T21:10:00Z');
    const expectedYesterdayTime = yesterday.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(formatFriendlyTimestamp(yesterday)).toBe(`Yesterday at ${expectedYesterdayTime}`);
  });

  test('formatFriendlyTimestamp falls back to absolute date', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    const earlier = new Date('2023-12-31T23:45:00Z');
    const datePart = earlier.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' });
    const timePart = earlier.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    expect(formatFriendlyTimestamp(earlier)).toBe(`${datePart} at ${timePart}`);
  });

  test('formatRelativeTime produces human readable delta', () => {
    const now = new Date('2024-01-15T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);

    const future = new Date('2024-01-15T12:05:00Z');
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const expected = formatter.format(5, 'minute');
    expect(formatRelativeTime(future)).toBe(expected);
  });

  test('formatAbsoluteDateTime mirrors toLocaleString', () => {
    const value = new Date('2024-05-01T09:15:00Z');
    expect(formatAbsoluteDateTime(value)).toBe(value.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
  });
});
