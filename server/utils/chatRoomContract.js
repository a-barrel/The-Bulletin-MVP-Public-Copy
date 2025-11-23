function buildPinRoomName(pinId, pinType, pinTitle) {
  const normalizedTitle =
    typeof pinTitle === 'string' && pinTitle.trim() ? pinTitle.trim() : 'Unknown Pin';
  const normalizedType = typeof pinType === 'string' ? pinType.toLowerCase() : '';
  const typeLabel = normalizedType === 'event' ? 'Event' : normalizedType === 'discussion' ? 'Discussion' : 'Pin';
  return `[${typeLabel}]: ${normalizedTitle}`;
}

function buildPinRoomPayload({ pinId, pinType, pinTitle, latitude, longitude, radiusMeters = 500 }) {
  if (!pinId) {
    return null;
  }
  return {
    pinId,
    name: buildPinRoomName(pinId, pinType, pinTitle),
    presetKey: 'pin-room',
    isGlobal: false,
    latitude,
    longitude,
    radiusMeters
  };
}

module.exports = {
  buildPinRoomName,
  buildPinRoomPayload
};
