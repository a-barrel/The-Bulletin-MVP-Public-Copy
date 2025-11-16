import { useEffect, useMemo, useState } from 'react';
import { fetchCurrentUserProfile, fetchUserProfile } from '../../api/mongoDataApi';
import reportClientError from '../../utils/reportClientError';

export default function useProfileViewerData({ userIdParam, locationState = {}, isOffline }) {
  const normalizedUserId = typeof userIdParam === 'string' ? userIdParam.trim() : '';
  const shouldLoadCurrentUser =
    normalizedUserId.length === 0 || normalizedUserId === 'me' || normalizedUserId === ':userId';
  const targetUserId = shouldLoadCurrentUser ? null : normalizedUserId;
  const userFromState = locationState?.user;
  const originPath = typeof locationState?.from === 'string' ? locationState.from : null;

  const [viewerProfile, setViewerProfile] = useState(null);
  const [fetchedUser, setFetchedUser] = useState(userFromState ?? null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let ignore = false;

    if (isOffline) {
      setViewerProfile(null);
      return () => {
        ignore = true;
      };
    }

    async function loadViewerProfile() {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!ignore) {
          setViewerProfile(profile ?? null);
        }
      } catch (error) {
        if (!ignore) {
          console.warn('Failed to load viewer profile for relationship management', error);
          setViewerProfile(null);
        }
      }
    }

    loadViewerProfile();

    return () => {
      ignore = true;
    };
  }, [isOffline]);

  useEffect(() => {
    let ignore = false;

    if (userFromState) {
      setFetchedUser(userFromState);
      setFetchError(null);
    }

    const shouldFetchProfile = (shouldLoadCurrentUser || Boolean(targetUserId)) && !isOffline;

    if (!shouldFetchProfile) {
      if (!userFromState && !shouldLoadCurrentUser && !targetUserId) {
        setFetchedUser(null);
      }
      if (isOffline) {
        setFetchError((prev) => prev ?? 'You are offline. Connect to refresh this profile.');
      }
      setIsFetchingProfile(false);
      return () => {
        ignore = true;
      };
    }

    setIsFetchingProfile(true);
    setFetchError(null);

    async function loadProfile() {
      try {
        const profile = shouldLoadCurrentUser
          ? await fetchCurrentUserProfile()
          : await fetchUserProfile(targetUserId);
        if (ignore) {
          return;
        }
        setFetchedUser(profile ?? null);
      } catch (error) {
        if (ignore) {
          return;
        }
        reportClientError(error, 'Failed to load user profile:', {
          source: 'useProfileViewerData.loadProfile',
          targetUserId,
          currentViewer: shouldLoadCurrentUser
        });
        setFetchError(error?.message || 'Failed to load user profile.');
        if (!userFromState) {
          setFetchedUser(null);
        }
      } finally {
        if (!ignore) {
          setIsFetchingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [isOffline, shouldLoadCurrentUser, targetUserId, userFromState]);

  const effectiveUser = useMemo(() => userFromState ?? fetchedUser ?? null, [fetchedUser, userFromState]);

  useEffect(() => {
    if (shouldLoadCurrentUser && effectiveUser) {
      setViewerProfile(effectiveUser);
    }
  }, [effectiveUser, shouldLoadCurrentUser]);

  return {
    originPath,
    userFromState,
    targetUserId,
    shouldLoadCurrentUser,
    viewerProfile,
    setViewerProfile,
    fetchedUser,
    setFetchedUser,
    effectiveUser,
    isFetchingProfile,
    fetchError
  };
}
