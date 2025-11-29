import { useEffect, useState } from 'react';

import { fetchCurrentUserProfile } from '../../api';
import toIdString from '../../utils/ids';
import { useUserCache } from '../../contexts/UserCacheContext';

export default function useBookmarkViewerProfile({ authUser, isOffline }) {
  const userCache = useUserCache();
  const [viewerProfile, setViewerProfile] = useState(null);

  useEffect(() => {
    if (!authUser || isOffline) {
      setViewerProfile(null);
      return;
    }

    let cancelled = false;
    (async () => {
      const cached = userCache.getMe();
      if (cached) {
        setViewerProfile(cached);
        return;
      }

      try {
        const profile = await fetchCurrentUserProfile();
        if (!cancelled) {
          setViewerProfile(profile ?? null);
          if (profile) {
            userCache.setMe(profile);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load viewer profile for bookmarks filters:', error);
          setViewerProfile(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, isOffline]);

  const viewerMongoId = viewerProfile?._id ? toIdString(viewerProfile._id) : null;

  return {
    viewerProfile,
    viewerMongoId
  };
}
