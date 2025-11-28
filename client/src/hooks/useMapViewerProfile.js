import { useEffect, useState } from 'react';
import { fetchCurrentUserProfile } from '../api';
import { resolvePinFetchLimit } from '../utils/pinDensity';
import reportClientError from '../utils/reportClientError';

export default function useMapViewerProfile({ authUser, isOffline }) {
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
        const profile = await fetchCurrentUserProfile();
        if (isMounted) {
          setCurrentProfileId(profile?._id ? String(profile._id) : null);
          setViewerProfile(profile ?? null);
          setPinFetchLimit(resolvePinFetchLimit(profile));
        }
      } catch (fetchError) {
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
