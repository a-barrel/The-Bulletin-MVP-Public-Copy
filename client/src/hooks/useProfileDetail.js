import { useCallback, useMemo, useState } from 'react';

import formatDateTime from '../utils/dates';
import { metersToMiles } from '../utils/geo';
import { DEFAULT_PROFILE_IMAGE_REGEX } from '../utils/media';
import {
  resolveProfileAvatarUrl,
  resolveProfileBannerUrl,
  TF2_AVATAR_MAP
} from '../utils/profileAssets';
import useProfileViewerData from './profile/useProfileViewerData';
import useProfileEditState from './profile/useProfileEditState';
import useProfileModerationState from './profile/useProfileModerationState';

const formatDisplayDateTime = (value) =>
  formatDateTime(value, {
    fallback: 'N/A'
  });

export default function useProfileDetail({ userIdParam, locationState, isOffline }) {
  const {
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
  } = useProfileViewerData({ userIdParam, locationState, isOffline });
  const [showRawData, setShowRawData] = useState(false);

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

  const {
    formState,
    setFormState,
    isEditing,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleBannerFileChange,
    handleClearAvatar,
    handleClearBanner,
    handleFieldChange,
    handleThemeChange,
    handleToggleLocationSharing,
    handleSaveProfile,
    editingAvatarSrc,
    editingBannerSrc,
    clearAvatarPreviewUrl,
    clearBannerPreviewUrl
  } = useProfileEditState({ effectiveUser, setFetchedUser, isOffline });

  const viewerId = viewerProfile?._id ? String(viewerProfile._id) : null;
  const effectiveUserId = effectiveUser?._id ? String(effectiveUser._id) : null;
  const canEditProfile =
    !userFromState &&
    (shouldLoadCurrentUser || (viewerId && effectiveUserId && viewerId === effectiveUserId));
  const targetProfileId = effectiveUserId
    ? effectiveUserId
    : targetUserId && targetUserId !== 'me'
    ? targetUserId
    : null;

  const {
    relationshipStatus,
    setRelationshipStatus,
    blockDialogMode,
    isProcessingBlockAction,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    isBlocked,
    canManageBlock,
    isViewingSelf
  } = useProfileModerationState({
    viewerProfile,
    setViewerProfile,
    effectiveUser,
    targetUserId: targetProfileId,
    isOffline,
    displayName
  });

  const avatarUrl = useMemo(() => {
    const primary = resolveProfileAvatarUrl(effectiveUser?.avatar);
    const usernameKey =
      typeof effectiveUser?.username === 'string'
        ? effectiveUser.username.trim().toLowerCase()
        : null;
    if (primary && DEFAULT_PROFILE_IMAGE_REGEX.test(primary) && usernameKey) {
      const fallbackPath = TF2_AVATAR_MAP[usernameKey];
      if (fallbackPath) {
        return resolveProfileAvatarUrl(fallbackPath);
      }
    }
    if ((!primary || DEFAULT_PROFILE_IMAGE_REGEX.test(primary)) && usernameKey) {
      const fallbackPath = TF2_AVATAR_MAP[usernameKey];
      if (fallbackPath) {
        return resolveProfileAvatarUrl(fallbackPath);
      }
    }
    return primary;
  }, [effectiveUser]);
  const bannerUrl = useMemo(
    () => resolveProfileBannerUrl(effectiveUser?.banner),
    [effectiveUser]
  );

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

  const handleOpenMutualFriend = useCallback(
    (friendId, navigate, locationPathname) => {
      if (!friendId) {
        return;
      }
      const sanitized = String(friendId).trim();
      if (!sanitized) {
        return;
      }
      navigate(`/profile/${sanitized}`, { state: { from: locationPathname } });
    },
    []
  );

  return {
    originPath,
    targetUserId,
    targetProfileId,
    shouldLoadCurrentUser,
    userFromState,
    effectiveUser,
    displayName,
    avatarUrl,
    bannerUrl,
    hasProfile,
    bioText,
    statsVisible,
    accountTimeline,
    detailEntries,
    isFetchingProfile,
    fetchError,
    formState,
    setFormState,
    isEditing,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleBannerFileChange,
    handleClearAvatar,
    handleClearBanner,
    handleFieldChange,
    handleThemeChange,
    handleToggleLocationSharing,
    handleSaveProfile,
    editingAvatarSrc,
    editingBannerSrc,
    clearAvatarPreviewUrl,
    clearBannerPreviewUrl,
    relationshipStatus,
    setRelationshipStatus,
    blockDialogMode,
    isProcessingBlockAction,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    isBlocked,
    canManageBlock,
    isViewingSelf,
    handleOpenMutualFriend,
    viewerProfile,
    setViewerProfile,
    fetchedUser,
    setFetchedUser,
    showRawData,
    setShowRawData
  };
}
