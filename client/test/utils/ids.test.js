import toIdString from '../../src/utils/ids';

describe('utils/ids', () => {
  test('returns trimmed string values', () => {
    expect(toIdString('  abc123  ')).toBe('abc123');
  });

  test('converts numbers to strings', () => {
    expect(toIdString(42)).toBe('42');
  });

  test('extracts from object identifiers', () => {
    expect(toIdString({ _id: '507f1f77bcf86cd799439011' })).toBe('507f1f77bcf86cd799439011');
    expect(toIdString({ $oid: '64a51b9b2f1a4c0012b3c456' })).toBe('64a51b9b2f1a4c0012b3c456');
  });

  test('returns null when identifier missing', () => {
    expect(toIdString({ notId: 123 })).toBeNull();
  });
});
