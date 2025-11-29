import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { fetchCurrentUserProfile } from '../../api';
import { auth } from '../../firebase';
import { useUserCache } from '../../contexts/UserCacheContext';

export default function useUpdatesProfile() {
  const userCache = useUserCache();
  const [firebaseUser, firebaseLoading] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    if (firebaseLoading) {
      return;
    }
    if (!firebaseUser) {
      setProfile(null);
      setProfileError('Sign in to view your updates.');
      setIsProfileLoading(false);
      return;
    }

    let isCancelled = false;
    async function loadProfile() {
      setIsProfileLoading(true);
      setProfileError(null);

      const cached = userCache.getMe();
      if (cached) {
        setProfile(cached);
        setIsProfileLoading(false);
        return;
      }

      try {
        const result = await fetchCurrentUserProfile();
        if (!isCancelled) {
          setProfile(result);
          if (result) {
            userCache.setMe(result);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          setProfile(null);
          setProfileError(error?.message || 'Failed to load profile information.');
        }
      } finally {
        if (!isCancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, [firebaseLoading, firebaseUser]);

  return {
    profile,
    profileError,
    isProfileLoading
  };
}
