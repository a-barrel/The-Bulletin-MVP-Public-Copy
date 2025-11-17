import { useEffect, useState } from 'react';

import { fetchCurrentUserProfile } from '../../api/mongoDataApi';
import toIdString from '../../utils/ids';

export default function useBookmarkViewerProfile({ authUser, isOffline }) {
  const [viewerMongoId, setViewerMongoId] = useState(null);

  useEffect(() => {
    if (!authUser || isOffline) {
      setViewerMongoId(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!cancelled && profile?._id) {
          setViewerMongoId(toIdString(profile._id));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load viewer profile for bookmarks filters:', error);
          setViewerMongoId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser, isOffline]);

  return viewerMongoId;
}
