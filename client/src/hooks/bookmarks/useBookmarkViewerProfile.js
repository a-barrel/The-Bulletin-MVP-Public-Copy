import { useEffect, useState } from 'react';

import { fetchCurrentUserProfile } from '../../api/mongoDataApi';
import toIdString from '../../utils/ids';

export default function useBookmarkViewerProfile({ authUser, isOffline }) {
  const [viewerProfile, setViewerProfile] = useState(null);

  useEffect(() => {
    if (!authUser || isOffline) {
      setViewerProfile(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!cancelled) {
          setViewerProfile(profile ?? null);
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
