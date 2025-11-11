import { useMemo } from 'react';

export default function useProfileMutualFriends(effectiveUser) {
  const mutualFriends = useMemo(() => {
    if (!Array.isArray(effectiveUser?.mutualFriends)) {
      return [];
    }
    return effectiveUser.mutualFriends;
  }, [effectiveUser?.mutualFriends]);

  const mutualFriendCount = useMemo(() => {
    if (typeof effectiveUser?.mutualFriendCount === 'number') {
      return effectiveUser.mutualFriendCount;
    }
    return mutualFriends.length;
  }, [effectiveUser?.mutualFriendCount, mutualFriends.length]);

  const MUTUAL_FRIEND_PREVIEW_LIMIT = 6;
  const mutualFriendPreview = useMemo(
    () => mutualFriends.slice(0, MUTUAL_FRIEND_PREVIEW_LIMIT),
    [mutualFriends]
  );

  return {
    mutualFriends,
    mutualFriendCount,
    mutualFriendPreview
  };
}
