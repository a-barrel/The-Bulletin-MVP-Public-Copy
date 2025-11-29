import { useEffect, useState } from 'react';
import { fetchCurrentUserProfile } from '../api';
import { resolvePinFetchLimit } from '../utils/pinDensity';
import reportClientError from '../utils/reportClientError';
import { useUserCache } from '../contexts/UserCacheContext';

export default function useMapViewerProfile({ authUser, isOffline }) {
  const userCache = useUserCache();
  const [viewerProfile, setViewerProfile] = useState(null);
  const [currentProfileId, setCurrentProfileId] = useState(null);
  const [pinFetchLimit, setPinFetchLimit] = useState(resolvePinFetchLimit());

  useEffect(() => {
    let isMounted = true;

    const resolveProfile = async () => {
      if (!authUser || isOffline) {
        if (isMounted) {
          setCurrentProfileId(null);
          setViewerProfile(null);
          setPinFetchLimit(resolvePinFetchLimit());
        }
        return;
      }

      try {
        const cached = userCache.getMe();
        if (cached) {
          if (isMounted) {
            setCurrentProfileId(cached?._id ? String(cached._id) : null);
            setViewerProfile(cached);
            setPinFetchLimit(resolvePinFetchLimit(cached));
          }
          return;
        }

        const profile = await fetchCurrentUserProfile();
        if (isMounted) {
          setCurrentProfileId(profile?._id ? String(profile._id) : null);
          setViewerProfile(profile ?? null);
          setPinFetchLimit(resolvePinFetchLimit(profile));
          if (profile) {
            userCache.setMe(profile);
          }
        }
      } catch (fetchError) {
        if (fetchError?.name === 'AbortError') {
          return;
        }
        reportClientError(fetchError, 'Failed to load current user profile on MapPage:', {
          source: 'useMapViewerProfile'
        });
        if (isMounted) {
          setCurrentProfileId(null);
          setViewerProfile(null);
          setPinFetchLimit(resolvePinFetchLimit());
        }
      }
    };

    resolveProfile();
    return () => {
      isMounted = false;
    };
  }, [authUser, isOffline]);

  return {
    viewerProfile,
    currentProfileId,
    pinFetchLimit
  };
}
