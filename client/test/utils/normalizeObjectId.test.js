import normalizeObjectId from '../../src/utils/normalizeObjectId';

describe('normalizeObjectId', () => {
  it('returns null for falsy values', () => {
    expect(normalizeObjectId(undefined)).toBeNull();
    expect(normalizeObjectId('')).toBeNull();
  });

  it('returns string values untouched', () => {
    expect(normalizeObjectId('abc123')).toBe('abc123');
  });

  it('extracts identifiers from object shapes', () => {
    expect(normalizeObjectId({ $oid: 'oid-value' })).toBe('oid-value');
    expect(normalizeObjectId({ id: 'id-value' })).toBe('id-value');

    const hexProvider = {
      toHexString: () => 'hex-string'
    };
    expect(normalizeObjectId(hexProvider)).toBe('hex-string');

    const custom = {
      toString: () => 'custom-string'
    };
    expect(normalizeObjectId(custom)).toBe('custom-string');
  });

  it('ignores objects without recognizable identifiers', () => {
    expect(normalizeObjectId({ foo: 'bar' })).toBeNull();
  });
});
