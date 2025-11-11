import { useMemo } from 'react';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';

const normalizeId = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'object') {
    if (value.$oid) {
      return normalizeId(value.$oid);
    }
    if (value.id) {
      return normalizeId(value.id);
    }
    if (value._id) {
      return normalizeId(value._id);
    }
  }
  return String(value);
};

export default function useFriendBadge(userIdOrObject) {
  const { friendData } = useSocialNotificationsContext();
  const normalizedUserId = normalizeId(
    userIdOrObject?._id ?? userIdOrObject?.id ?? userIdOrObject
  );

  const friendLookup = useMemo(() => {
    const entries = Array.isArray(friendData?.friends) ? friendData.friends : [];
    const lookup = new Set();
    entries.forEach((friend) => {
      const id = normalizeId(friend?.id ?? friend?._id);
      if (id) {
        lookup.add(id);
      }
    });
    return lookup;
  }, [friendData?.friends]);

  const viewerId = useMemo(
    () => normalizeId(friendData?.viewer?.id ?? friendData?.viewer?._id),
    [friendData?.viewer]
  );

  const isFriend = Boolean(normalizedUserId && friendLookup.has(normalizedUserId));

  return {
    isFriend,
    viewerId,
    hasFriendGraph: Boolean(friendData),
    normalizedUserId
  };
}
