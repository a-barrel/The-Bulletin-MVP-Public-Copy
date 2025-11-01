const { toIsoDateString } = require('../../utils/dates');

describe('server/utils/dates', () => {
  test('converts valid dates to ISO strings', () => {
    const value = new Date('2024-01-15T10:20:30Z');
    expect(toIsoDateString(value)).toBe('2024-01-15T10:20:30.000Z');
  });

  test('handles ISO-like strings', () => {
    expect(toIsoDateString('2024-05-25T12:34:56Z')).toBe('2024-05-25T12:34:56.000Z');
  });

  test('returns undefined for invalid inputs', () => {
    expect(toIsoDateString('invalid-date')).toBeUndefined();
    expect(toIsoDateString(undefined)).toBeUndefined();
  });
});
