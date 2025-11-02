import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  blockUser,
  fetchCurrentUserProfile,
  fetchUserProfile,
  unblockUser,
  updateCurrentUserProfile,
  uploadImage
} from '../api/mongoDataApi';
import formatDateTime from '../utils/dates';
import runtimeConfig from '../config/runtime';
import { metersToMiles } from '../utils/geo';

const FALLBACK_AVATAR = '/images/profile/profile-01.jpg';

const TF2_AVATAR_MAP = {
  tf2_scout: '/images/emulation/avatars/Scoutava.jpg',
  tf2_soldier: '/images/emulation/avatars/Soldierava.jpg',
  tf2_pyro: '/images/emulation/avatars/Pyroava.jpg',
  tf2_demoman: '/images/emulation/avatars/Demomanava.jpg',
  tf2_heavy: '/images/emulation/avatars/Heavyava.jpg',
  tf2_engineer: '/images/emulation/avatars/Engineerava.jpg',
  tf2_medic: '/images/emulation/avatars/Medicava.jpg',
  tf2_sniper: '/images/emulation/avatars/Sniperava.jpg',
  tf2_spy: '/images/emulation/avatars/Spyava.jpg'
};

const resolveAvatarUrl = (avatar) => {
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const toAbsolute = (value) => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      return trimmed;
    }
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return base ? `${base}${normalized}` : normalized;
  };

  if (!avatar) {
    return toAbsolute(FALLBACK_AVATAR) ?? FALLBACK_AVATAR;
  }

  if (typeof avatar === 'string') {
    return toAbsolute(avatar) ?? toAbsolute(FALLBACK_AVATAR) ?? FALLBACK_AVATAR;
  }

  if (typeof avatar === 'object') {
    const source = avatar.url ?? avatar.thumbnailUrl ?? avatar.path;
    const resolved = typeof source === 'string' ? toAbsolute(source) : null;
    if (resolved) {
      return resolved;
    }
  }

  return toAbsolute(FALLBACK_AVATAR) ?? FALLBACK_AVATAR;
};

const formatDisplayDateTime = (value) =>
  formatDateTime(value, {
    fallback: 'N/A'
  });

export default function useProfileDetail({ userIdParam, locationState, isOffline }) {
  const normalizedUserId = typeof userIdParam === 'string' ? userIdParam.trim() : '';
  const shouldLoadCurrentUser =
    normalizedUserId.length === 0 || normalizedUserId === 'me' || normalizedUserId === ':userId';
  const targetUserId = shouldLoadCurrentUser ? null : normalizedUserId;
  const userFromState = locationState?.user;
  const originPath = typeof locationState?.from === 'string' ? locationState.from : null;

  const [fetchedUser, setFetchedUser] = useState(userFromState ?? null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [viewerProfile, setViewerProfile] = useState(null);
  const [relationshipStatus, setRelationshipStatus] = useState(null);
  const [blockDialogMode, setBlockDialogMode] = useState(null);
  const [isProcessingBlockAction, setIsProcessingBlockAction] = useState(false);
  const [showRawData, setShowRawData] = useState(false);

  const avatarPreviewUrlRef = useRef(null);

  const clearAvatarPreviewUrl = useCallback(() => {
    if (avatarPreviewUrlRef.current && avatarPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
    }
    avatarPreviewUrlRef.current = null;
  }, []);

  const initializeFormState = useCallback((profile) => ({
    displayName: profile?.displayName ?? '',
    bio: profile?.bio ?? '',
    locationSharingEnabled: Boolean(profile?.locationSharingEnabled),
    theme: profile?.preferences?.theme ?? 'system',
    avatarFile: null,
    avatarPreviewUrl: profile?.avatar ? resolveAvatarUrl(profile.avatar) : null,
    avatarCleared: !profile?.avatar
  }), []);

  const [formState, setFormState] = useState(() => initializeFormState(userFromState ?? null));

  useEffect(
    () => () => {
      clearAvatarPreviewUrl();
    },
    [clearAvatarPreviewUrl]
  );

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
          setViewerProfile(profile);
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
        setFetchedUser(profile);
      } catch (error) {
        if (ignore) {
          return;
        }
        console.error('Failed to load user profile:', error);
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

  const effectiveUser = userFromState ?? fetchedUser ?? null;

  useEffect(() => {
    if (shouldLoadCurrentUser && effectiveUser) {
      setViewerProfile(effectiveUser);
    }
  }, [effectiveUser, shouldLoadCurrentUser]);

  useEffect(() => {
    if (!isEditing && effectiveUser) {
      setFormState(initializeFormState(effectiveUser));
    }
  }, [effectiveUser, initializeFormState, isEditing]);

  const displayName = useMemo(() => {
    if (effectiveUser) {
      return (
        effectiveUser.displayName ||
        effectiveUser.username ||
        effectiveUser.fullName ||
        effectiveUser.email ||
        userIdParam ||
        'Unknown User'
      );
    }
    return userIdParam || 'Unknown User';
  }, [effectiveUser, userIdParam]);

  const avatarUrl = useMemo(() => {
    const primary = resolveAvatarUrl(effectiveUser?.avatar);
    const usernameKey =
      typeof effectiveUser?.username === 'string'
        ? effectiveUser.username.trim().toLowerCase()
        : null;
    if (primary && /\/images\/profile\/profile-\d+\.jpg$/i.test(primary) && usernameKey) {
      const fallbackPath = TF2_AVATAR_MAP[usernameKey];
      if (fallbackPath) {
        return resolveAvatarUrl(fallbackPath);
      }
    }
    if ((!primary || /\/images\/profile\/profile-\d+\.jpg$/i.test(primary)) && usernameKey) {
      const fallbackPath = TF2_AVATAR_MAP[usernameKey];
      if (fallbackPath) {
        return resolveAvatarUrl(fallbackPath);
      }
    }
    return primary;
  }, [effectiveUser]);

  const canEditProfile =
    !userFromState &&
    (shouldLoadCurrentUser ||
      (effectiveUser && targetUserId && effectiveUser._id && effectiveUser._id === targetUserId));

  const editingAvatarSrc = formState.avatarCleared ? null : formState.avatarPreviewUrl ?? avatarUrl;

  const viewerId = viewerProfile?._id ? String(viewerProfile._id) : null;
  const normalizedTargetId = effectiveUser?._id
    ? String(effectiveUser._id)
    : targetUserId && targetUserId !== 'me'
    ? targetUserId
    : null;
  const normalizedBlockedIds = Array.isArray(viewerProfile?.relationships?.blockedUserIds)
    ? viewerProfile.relationships.blockedUserIds.map((id) => String(id))
    : [];
  const isViewingSelf =
    shouldLoadCurrentUser ||
    Boolean(viewerId && normalizedTargetId && viewerId === normalizedTargetId);
  const isBlocked = Boolean(
    normalizedTargetId && normalizedBlockedIds.includes(String(normalizedTargetId))
  );
  const canManageBlock = Boolean(!isViewingSelf && viewerProfile && normalizedTargetId);

  const handleBeginEditing = useCallback(() => {
    if (isOffline) {
      setUpdateStatus({ type: 'warning', message: 'Reconnect to edit your profile.' });
      return;
    }
    if (!effectiveUser) {
      return;
    }
    clearAvatarPreviewUrl();
    setFormState(initializeFormState(effectiveUser));
    setUpdateStatus(null);
    setIsEditing(true);
  }, [clearAvatarPreviewUrl, effectiveUser, initializeFormState, isOffline]);

  const handleCancelEditing = useCallback(() => {
    clearAvatarPreviewUrl();
    setFormState(initializeFormState(effectiveUser));
    setIsEditing(false);
  }, [clearAvatarPreviewUrl, effectiveUser, initializeFormState]);

  const handleAvatarFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      if (avatarPreviewUrlRef.current && avatarPreviewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      avatarPreviewUrlRef.current = previewUrl;
      setFormState((prev) => ({
        ...prev,
        avatarFile: file,
        avatarPreviewUrl: previewUrl,
        avatarCleared: false
      }));
      event.target.value = '';
    },
    []
  );

  const handleClearAvatar = useCallback(() => {
    clearAvatarPreviewUrl();
    setFormState((prev) => ({
      ...prev,
      avatarFile: null,
      avatarPreviewUrl: null,
      avatarCleared: true
    }));
  }, [clearAvatarPreviewUrl]);

  const handleFieldChange = useCallback(
    (field) => (event) => {
      const value = typeof event?.target?.value === 'string' ? event.target.value : '';
      setFormState((prev) => ({
        ...prev,
        [field]: value
      }));
    },
    []
  );

  const handleThemeChange = useCallback((event) => {
    const value = typeof event?.target?.value === 'string' ? event.target.value : 'system';
    setFormState((prev) => ({
      ...prev,
      theme: value
    }));
  }, []);

  const handleToggleLocationSharing = useCallback((event) => {
    setFormState((prev) => ({
      ...prev,
      locationSharingEnabled: Boolean(event?.target?.checked)
    }));
  }, []);

  const handleSaveProfile = useCallback(
    async (event) => {
      event.preventDefault();
      if (isOffline) {
        setUpdateStatus({ type: 'warning', message: 'You are offline. Connect to save your profile.' });
        return;
      }
      if (!effectiveUser) {
        setUpdateStatus({
          type: 'error',
          message: 'No profile data is loaded.'
        });
        return;
      }

      const trimmedDisplayName = formState.displayName.trim();
      if (!trimmedDisplayName) {
        setUpdateStatus({ type: 'error', message: 'Display name cannot be empty.' });
        return;
      }

      const payload = {};

      if (trimmedDisplayName !== (effectiveUser.displayName ?? '')) {
        payload.displayName = trimmedDisplayName;
      }

      const normalizedBio = formState.bio.trim();
      const existingBio = effectiveUser?.bio ?? '';
      if (normalizedBio !== existingBio) {
        payload.bio = normalizedBio.length > 0 ? normalizedBio : null;
      }

      if (formState.locationSharingEnabled !== Boolean(effectiveUser?.locationSharingEnabled)) {
        payload.locationSharingEnabled = formState.locationSharingEnabled;
      }

      let uploadedAvatarPayload = null;

      if (formState.avatarCleared && (effectiveUser?.avatar || formState.avatarFile)) {
        payload.avatar = null;
      } else if (formState.avatarFile) {
        try {
          setIsSavingProfile(true);
          uploadedAvatarPayload = await uploadImage(formState.avatarFile);
          payload.avatar = uploadedAvatarPayload?.path ?? null;
        } catch (error) {
          setIsSavingProfile(false);
          setUpdateStatus({ type: 'error', message: error?.message || 'Failed to upload avatar.' });
          return;
        }
      }

      if (!Object.keys(payload).length) {
        setUpdateStatus({ type: 'info', message: 'No changes to save.' });
        return;
      }

      try {
        setIsSavingProfile(true);
        const updatedProfile = await updateCurrentUserProfile(payload);
        setFetchedUser(updatedProfile);
        setUpdateStatus({ type: 'success', message: 'Profile updated successfully.' });
        setIsEditing(false);
        clearAvatarPreviewUrl();
        setFormState(initializeFormState(updatedProfile));
      } catch (error) {
        setUpdateStatus({ type: 'error', message: error?.message || 'Failed to update profile.' });
      } finally {
        if (uploadedAvatarPayload?.previewUrl && uploadedAvatarPayload.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(uploadedAvatarPayload.previewUrl);
        }
        setIsSavingProfile(false);
      }
    },
    [clearAvatarPreviewUrl, effectiveUser, formState, initializeFormState, isOffline]
  );

  const detailEntries = useMemo(() => {
    if (!effectiveUser || typeof effectiveUser !== 'object') {
      return [];
    }

    return Object.entries(effectiveUser)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        value,
        isObject: typeof value === 'object' && value !== null
      }));
  }, [effectiveUser]);

  const hasProfile = Boolean(effectiveUser);

  const bioText = useMemo(() => {
    const rawBio = effectiveUser?.bio;
    if (typeof rawBio !== 'string') {
      return null;
    }
    const trimmed = rawBio.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [effectiveUser?.bio]);

  const statsVisible = effectiveUser?.preferences?.statsPublic !== false;

  const statsEntries = useMemo(() => {
    const stats = effectiveUser?.stats;
    if (!stats) {
      return [];
    }
    return [
      { key: 'eventsHosted', label: 'Events hosted', value: stats.eventsHosted ?? 0 },
      { key: 'eventsAttended', label: 'Events attended', value: stats.eventsAttended ?? 0 },
      { key: 'posts', label: 'Posts', value: stats.posts ?? 0 },
      { key: 'bookmarks', label: 'Bookmarks', value: stats.bookmarks ?? 0 },
      { key: 'followers', label: 'Followers', value: stats.followers ?? 0 },
      { key: 'following', label: 'Following', value: stats.following ?? 0 },
      { key: 'cussCount', label: 'Times cussed', value: stats.cussCount ?? 0 }
    ];
  }, [effectiveUser]);

  const badgeList = effectiveUser?.badges ?? [];

  const activityEntries = useMemo(() => {
    if (!effectiveUser) {
      return [];
    }
    return [
      {
        key: 'pinnedPinIds',
        label: 'Pinned pins',
        value: effectiveUser.pinnedPinIds?.length ?? 0
      },
      {
        key: 'ownedPinIds',
        label: 'Pins created',
        value: effectiveUser.ownedPinIds?.length ?? 0
      },
      {
        key: 'bookmarkCollectionIds',
        label: 'Bookmark collections',
        value: effectiveUser.bookmarkCollectionIds?.length ?? 0
      },
      {
        key: 'proximityChatRoomIds',
        label: 'Chat rooms joined',
        value: effectiveUser.proximityChatRoomIds?.length ?? 0
      },
      {
        key: 'recentLocationIds',
        label: 'Recent locations',
        value: effectiveUser.recentLocationIds?.length ?? 0
      }
    ];
  }, [effectiveUser]);

  const preferenceSummary = useMemo(() => {
    const preferences = effectiveUser?.preferences ?? {};
    const theme = preferences.theme ?? 'system';
    const radiusMeters = preferences.radiusPreferenceMeters;
    let radiusMiles = null;
    if (typeof radiusMeters === 'number') {
      const miles = metersToMiles(radiusMeters);
      if (miles !== null) {
        radiusMiles = Math.round(miles * 100) / 100;
      }
    }
    return {
      theme,
      radiusMiles,
      locationSharing: Boolean(effectiveUser?.locationSharingEnabled)
    };
  }, [effectiveUser]);

  const notificationPreferences = useMemo(() => {
    const notifications = effectiveUser?.preferences?.notifications ?? {};
    return [
      {
        key: 'proximity',
        label: 'Nearby activity alerts',
        enabled: notifications.proximity !== false
      },
      {
        key: 'updates',
        label: 'Pin & chat updates',
        enabled: notifications.updates !== false
      },
      {
        key: 'chatTransitions',
        label: 'Chat room movement alerts',
        enabled: notifications.chatTransitions !== false
      },
      {
        key: 'marketing',
        label: 'Tips & marketing',
        enabled: notifications.marketing === true
      }
    ];
  }, [effectiveUser]);

  const accountTimeline = useMemo(() => {
    if (!effectiveUser) {
      return null;
    }
    return {
      createdAt: formatDisplayDateTime(effectiveUser.createdAt),
      updatedAt: formatDisplayDateTime(effectiveUser.updatedAt),
      status: effectiveUser.accountStatus ?? 'unknown',
      email: effectiveUser.email ?? '—',
      userId: effectiveUser._id ?? targetUserId ?? '—'
    };
  }, [effectiveUser, targetUserId]);

  const rawDataAvailable = detailEntries.length > 0;

  const handleRequestBlock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    if (isOffline) {
      setRelationshipStatus({ type: 'warning', message: 'Reconnect to block users.' });
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('block');
  }, [canManageBlock, isOffline]);

  const handleRequestUnblock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    if (isOffline) {
      setRelationshipStatus({ type: 'warning', message: 'Reconnect to unblock users.' });
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('unblock');
  }, [canManageBlock, isOffline]);

  const handleCloseBlockDialog = useCallback(() => {
    if (isProcessingBlockAction) {
      return;
    }
    setBlockDialogMode(null);
  }, [isProcessingBlockAction]);

  const handleConfirmBlockDialog = useCallback(async () => {
    if (!blockDialogMode) {
      return;
    }

    const targetId = effectiveUser?._id ? String(effectiveUser._id) : normalizedTargetId;
    if (!targetId) {
      return;
    }

    if (isOffline) {
      setRelationshipStatus({
        type: 'warning',
        message: 'Reconnect to change block status.'
      });
      setBlockDialogMode(null);
      return;
    }

    setIsProcessingBlockAction(true);
    setRelationshipStatus(null);
    try {
      const response =
        blockDialogMode === 'block' ? await blockUser(targetId) : await unblockUser(targetId);

      setViewerProfile((prev) => {
        if (!prev) {
          return prev;
        }

        if (response?.updatedRelationships) {
          return {
            ...prev,
            relationships: response.updatedRelationships
          };
        }

        const currentRelationships = prev.relationships ?? {};
        const currentBlockedIds = Array.isArray(currentRelationships.blockedUserIds)
          ? currentRelationships.blockedUserIds.map((id) => String(id))
          : [];
        const blockedSet = new Set(currentBlockedIds);
        if (blockDialogMode === 'block') {
          blockedSet.add(targetId);
        } else {
          blockedSet.delete(targetId);
        }
        return {
          ...prev,
          relationships: {
            ...currentRelationships,
            blockedUserIds: Array.from(blockedSet)
          }
        };
      });

      setRelationshipStatus({
        type: 'success',
        message:
          blockDialogMode === 'block'
            ? `${displayName} has been blocked.`
            : `${displayName} has been unblocked.`
      });
      setBlockDialogMode(null);
    } catch (error) {
      setRelationshipStatus({
        type: 'error',
        message: error?.message || 'Failed to update block status.'
      });
    } finally {
      setIsProcessingBlockAction(false);
    }
  }, [blockDialogMode, displayName, effectiveUser, isOffline, normalizedTargetId]);

  useEffect(() => {
    if (!relationshipStatus) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setRelationshipStatus(null);
    }, 5000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [relationshipStatus]);

  return {
    originPath,
    targetUserId,
    effectiveUser,
    displayName,
    avatarUrl,
    hasProfile,
    bioText,
    badgeList,
    statsVisible,
    statsEntries,
    activityEntries,
    preferenceSummary,
    notificationPreferences,
    accountTimeline,
    detailEntries,
    rawDataAvailable,
    showRawData,
    setShowRawData,
    isFetchingProfile,
    fetchError,
    relationshipStatus,
    setRelationshipStatus,
    isEditing,
    formState,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleClearAvatar,
    handleFieldChange,
    handleThemeChange,
    handleToggleLocationSharing,
    handleSaveProfile,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    editingAvatarSrc,
    canEditProfile,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    blockDialogMode,
    isProcessingBlockAction,
    canManageBlock,
    isBlocked
  };
}
