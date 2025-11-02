const { Types } = require('mongoose');
const { toIdString, mapIdList } = require('../../utils/ids');

describe('server/utils/ids', () => {
  test('toIdString handles common inputs', () => {
    expect(toIdString('  abc  ')).toBe('abc');
    expect(toIdString(99)).toBe('99');
    const objectId = new Types.ObjectId('507f1f77bcf86cd799439011');
    expect(toIdString(objectId)).toBe('507f1f77bcf86cd799439011');
    expect(toIdString({ _id: objectId })).toBe('507f1f77bcf86cd799439011');
    expect(toIdString({}, { fallback: 'fallback-id' })).toBe('fallback-id');
  });

  test('mapIdList normalizes arrays', () => {
    const values = ['  a  ', new Types.ObjectId('507f1f77bcf86cd799439012'), null, undefined, 42];
    expect(mapIdList(values)).toEqual(['a', '507f1f77bcf86cd799439012', '42']);
  });
});
