import { haversineDistanceMeters } from './geo';

const EVENT_OR_DISCUSSION_PREFIX = /^\[(event|discussion)\]:/i;

const buildLastRoomStorageKey = (userId) => `chat:last-room:${userId || 'anon'}`;

export const isEventOrDiscussionRoom = (room) => {
  const name = typeof room?.name === 'string' ? room.name.trim() : '';
  if (!name || name[0] !== '[') {
    return false;
  }
  return EVENT_OR_DISCUSSION_PREFIX.test(name);
};

export const isEligibleRoom = (room) => Boolean(room) && !isEventOrDiscussionRoom(room);

export const getRoomCoordinates = (room) => {
  const coordinates = room?.coordinates?.coordinates || room?.location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};

export const pickNearestEligibleRoom = (rooms, location) => {
  if (
    !Array.isArray(rooms) ||
    !rooms.length ||
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }

  const distances = rooms
    .filter((room) => isEligibleRoom(room))
    .map((room) => {
      const coords = getRoomCoordinates(room);
      if (!coords) {
        return null;
      }
      return {
        room,
        distance: haversineDistanceMeters(location, coords)
      };
    })
    .filter(Boolean);

  if (!distances.length) {
    return null;
  }

  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]?.room || null;
};

export const loadStoredLastRoomId = (userId) => {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const value = localStorage.getItem(buildLastRoomStorageKey(userId));
    return value || null;
  } catch (error) {
    return null;
  }
};

export const storeLastRoomId = (userId, roomId) => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    const key = buildLastRoomStorageKey(userId);
    if (roomId) {
      localStorage.setItem(key, String(roomId));
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {
    // ignore storage failures
  }
};
