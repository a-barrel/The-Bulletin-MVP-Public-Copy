import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import {
  fetchCurrentUserProfile,
  fetchUserProfile,
  updateCurrentUserProfile,
  uploadImage
} from '../api/mongoDataApi';
import runtimeConfig from '../config/runtime';
import { normalizeProfileImagePath, DEFAULT_PROFILE_IMAGE_REGEX } from '../utils/media';
import { routes } from '../routes';
import './ProfilePage.css';
import ProfileActionRow from '../components/profile/ProfileActionRow';
import ProfileBlockDialog from '../components/profile/ProfileBlockDialog';
import ProfileBadges from '../components/profile/ProfileBadges';
import ProfileBio from '../components/profile/ProfileBio';
import ProfileEditForm from '../components/profile/ProfileEditForm';
import ProfileHero from '../components/profile/ProfileHero';
import ProfileMutualFriends from '../components/profile/ProfileMutualFriends';
import ProfileStatsSummary from '../components/profile/ProfileStatsSummary';
import useProfileBadges from '../hooks/useProfileBadges';
import useProfileMutualFriends from '../hooks/useProfileMutualFriends';
import useProfileStats from '../hooks/useProfileStats';
import useProfileInteractions from '../hooks/useProfileInteractions';

/*
 * NOTE:
 * - This layout intentionally hides richer debug surfaces that still exist behind the scenes:
 *   • Moderation quick actions + trust-and-safety tooling
 *   • Raw profile JSON inspector + account timeline metadata
 *   • Preferences/notification summaries and provisioning audit trails
 *   • DM/report entry points with auto-logging hooks
 * - All underlying fetch/update logic (editing flows, block/unblock, moderation requests, etc.) still lives in useProfileDetail/useProfileInteractions.
 */

export const pageConfig = {
  id: 'profile',
  label: 'Profile',
  icon: AccountCircleIcon,
  path: `${routes.profile.base}/:userId`,
  order: 91,
  showInNav: true,
  protected: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    const profileBase = routes.profile.base.replace(/^\/+/, '');
    const profilePattern = profileBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const profileMe = routes.profile.me;
    if (!runtimeConfig.isOffline) {
      return profileMe;
    }

    if (typeof window === 'undefined') {
      return profileMe;
    }

    const input = window.prompt(
      'Enter a profile ID (leave blank for your profile, type "me" or cancel to stay put):'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'me') {
      return profileMe;
    }
    const sanitized = trimmed.replace(/^\/+/, '');
    if (new RegExp(`^${profilePattern}/.+`, 'i').test(sanitized)) {
      return `/${sanitized}`;
    }
    if (new RegExp(`^/${profilePattern}/.+`, 'i').test(trimmed)) {
      return trimmed;
    }
    return `${routes.profile.base}/${sanitized}`;
  }
};

const FALLBACK_AVATAR = '/images/profile/profile-01.jpg';
const TF2_AVATAR_MAP = {
  'tf2_scout': '/images/emulation/avatars/Scoutava.jpg',
  'tf2_soldier': '/images/emulation/avatars/Soldierava.jpg',
  'tf2_pyro': '/images/emulation/avatars/Pyroava.jpg',
  'tf2_demoman': '/images/emulation/avatars/Demomanava.jpg',
  'tf2_heavy': '/images/emulation/avatars/Heavyava.jpg',
  'tf2_engineer': '/images/emulation/avatars/Engineerava.jpg',
  'tf2_medic': '/images/emulation/avatars/Medicava.jpg',
  'tf2_sniper': '/images/emulation/avatars/Sniperava.jpg',
  'tf2_spy': '/images/emulation/avatars/Spyava.jpg'
};
const FALLBACK_BANNER = null;

const resolveAvatarUrl = (avatar) => {
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const toAbsolute = (value) => {
    if (!value) {
      return null;
    }
    const trimmed = normalizeProfileImagePath(value.trim());
    if (!trimmed) {
      return null;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      if (runtimeConfig.isOffline) {
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
          const url = new URL(trimmed, origin);
          const offlineHosts = new Set(['localhost:5000', '127.0.0.1:5000', 'localhost:8000', '127.0.0.1:8000']);
          if (offlineHosts.has(url.host) && url.pathname.startsWith('/images/')) {
            const relative = normalizeProfileImagePath(url.pathname);
            return base ? `${base}${relative}` : relative;
          }
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    const normalized = normalizeProfileImagePath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
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

const resolveBannerUrl = (banner) => {
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');

  const toAbsolute = (value) => {
    if (!value) {
      return null;
    }
    const trimmed = normalizeProfileImagePath(value.trim());
    if (!trimmed) {
      return null;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      if (runtimeConfig.isOffline) {
        try {
          const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
          const url = new URL(trimmed, origin);
          const offlineHosts = new Set(['localhost:5000', '127.0.0.1:5000', 'localhost:8000', '127.0.0.1:8000']);
          if (offlineHosts.has(url.host) && url.pathname.startsWith('/images/')) {
            const normalizedPath = normalizeProfileImagePath(url.pathname);
            return base ? `${base}${normalizedPath}` : normalizedPath;
          }
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }
    const normalized = normalizeProfileImagePath(trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
    return base ? `${base}${normalized}` : normalized;
  };

  if (!banner) {
    return FALLBACK_BANNER ? toAbsolute(FALLBACK_BANNER) ?? FALLBACK_BANNER : null;
  }

  if (typeof banner === 'string') {
    return toAbsolute(banner) ?? (FALLBACK_BANNER ? toAbsolute(FALLBACK_BANNER) ?? FALLBACK_BANNER : null);
  }

  if (typeof banner === 'object') {
    const source = banner.url ?? banner.thumbnailUrl ?? banner.path;
    const resolved = typeof source === 'string' ? toAbsolute(source) : null;
    if (resolved) {
      return resolved;
    }
  }

  return FALLBACK_BANNER ? toAbsolute(FALLBACK_BANNER) ?? FALLBACK_BANNER : null;
};

const formatDateTime = (value) => {
  if (!value) {
    return 'N/A';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};


function ProfilePage() {

  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  const shouldLoadCurrentUser =
    normalizedUserId.length === 0 || normalizedUserId === 'me' || normalizedUserId === ':userId';
  const targetUserId = shouldLoadCurrentUser ? null : normalizedUserId;
  const userFromState = location.state?.user;
  const originPath = typeof location.state?.from === 'string' ? location.state.from : null;
  const [fetchedUser, setFetchedUser] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [viewerProfile, setViewerProfile] = useState(null);
  const [formState, setFormState] = useState({
    displayName: '',
    bio: '',
    locationSharingEnabled: false,
    theme: 'system',
    avatarFile: null,
    avatarPreviewUrl: null,
    avatarCleared: true,
    bannerFile: null,
    bannerPreviewUrl: null,
    bannerCleared: true
  });
  const avatarPreviewUrlRef = useRef(null);
  const bannerPreviewUrlRef = useRef(null);

  const clearAvatarPreviewUrl = useCallback(() => {
    if (avatarPreviewUrlRef.current && avatarPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
    }
    avatarPreviewUrlRef.current = null;
  }, []);
  const clearBannerPreviewUrl = useCallback(() => {
    if (bannerPreviewUrlRef.current && bannerPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current);
    }
    bannerPreviewUrlRef.current = null;
  }, []);

  useEffect(() => {
    let ignore = false;

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
  }, []);

  const initializeFormState = useCallback(
    (profile) => ({
      displayName: profile?.displayName ?? '',
      bio: profile?.bio ?? '',
      locationSharingEnabled: Boolean(profile?.locationSharingEnabled),
      theme: profile?.preferences?.theme ?? 'system',
      avatarFile: null,
      avatarPreviewUrl: profile?.avatar ? resolveAvatarUrl(profile.avatar) : null,
      avatarCleared: !profile?.avatar,
      bannerFile: null,
      bannerPreviewUrl: profile?.banner ? resolveBannerUrl(profile.banner) : null,
      bannerCleared: !profile?.banner
    }),
    []
  );

  useEffect(
    () => () => {
      clearAvatarPreviewUrl();
      clearBannerPreviewUrl();
    },
    [clearAvatarPreviewUrl, clearBannerPreviewUrl]
  );

  useEffect(() => {
    let ignore = false;

    if (userFromState) {
      setFetchedUser(userFromState);
      setFetchError(null);
    }

    const shouldFetchProfile = shouldLoadCurrentUser || Boolean(targetUserId);

    if (!shouldFetchProfile) {
      if (!userFromState) {
        setFetchedUser(null);
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
  }, [targetUserId, shouldLoadCurrentUser, userFromState]);

  const effectiveUser = userFromState ?? fetchedUser ?? null;

  useEffect(() => {
    if (shouldLoadCurrentUser && effectiveUser) {
      setViewerProfile(effectiveUser);
    }
  }, [effectiveUser, shouldLoadCurrentUser]);

  const displayName = useMemo(() => {
    if (effectiveUser) {
      return (
        effectiveUser.displayName ||
        effectiveUser.username ||
        effectiveUser.fullName ||
        effectiveUser.email ||
        userId ||
        'Unknown User'
      );
    }
    return userId || 'Unknown User';
  }, [effectiveUser, userId]);

  const avatarUrl = useMemo(() => {
    const primary = resolveAvatarUrl(effectiveUser?.avatar);
    const usernameKey =
      typeof effectiveUser?.username === 'string'
        ? effectiveUser.username.trim().toLowerCase()
        : null;
    if (primary && DEFAULT_PROFILE_IMAGE_REGEX.test(primary) && usernameKey) {
      const fallbackPath = TF2_AVATAR_MAP[usernameKey];
      if (fallbackPath) {
        return resolveAvatarUrl(fallbackPath);
      }
    }
    if ((!primary || DEFAULT_PROFILE_IMAGE_REGEX.test(primary)) && usernameKey) {
      const fallbackPath = TF2_AVATAR_MAP[usernameKey];
      if (fallbackPath) {
        return resolveAvatarUrl(fallbackPath);
      }
    }
    return primary;
  }, [effectiveUser]);
  const bannerUrl = useMemo(() => resolveBannerUrl(effectiveUser?.banner), [effectiveUser]);
  const editingAvatarSrc = formState.avatarCleared ? null : formState.avatarPreviewUrl ?? avatarUrl;
  const editingBannerSrc = formState.bannerCleared ? null : formState.bannerPreviewUrl ?? bannerUrl;
  const avatarDisplaySrc = isEditing ? editingAvatarSrc ?? undefined : avatarUrl;
  const bannerDisplaySrc = isEditing ? editingBannerSrc : bannerUrl;

  const {
    isViewingSelf,
    isBlocked,
    isFriend,
    canEditProfile,
    canManageBlock,
    canSendFriendRequest,
    blockDialogMode,
    isProcessingBlockAction,
    relationshipStatus,
    setRelationshipStatus,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    hasPendingFriendRequest,
    isSendingFriendRequest,
    handleSendFriendRequest
  } = useProfileInteractions({
    viewerProfile,
    effectiveUser,
    targetUserId,
    shouldLoadCurrentUser,
    userFromState,
    setViewerProfile,
    setFetchedUser,
    displayName
  });
  const { mutualFriendCount, mutualFriendPreview } = useProfileMutualFriends(effectiveUser);

  useEffect(() => {
    if (!isEditing && effectiveUser) {
      setFormState(initializeFormState(effectiveUser));
    }
  }, [effectiveUser, initializeFormState, isEditing]);

  const handleBeginEditing = useCallback(() => {
    if (!effectiveUser) {
      return;
    }
    clearAvatarPreviewUrl();
    clearBannerPreviewUrl();
    setFormState(initializeFormState(effectiveUser));
    setUpdateStatus(null);
    setIsEditing(true);
  }, [clearAvatarPreviewUrl, clearBannerPreviewUrl, effectiveUser, initializeFormState]);

  const handleCancelEditing = useCallback(() => {
    clearAvatarPreviewUrl();
    clearBannerPreviewUrl();
    setFormState(initializeFormState(effectiveUser));
    setIsEditing(false);
  }, [clearAvatarPreviewUrl, clearBannerPreviewUrl, effectiveUser, initializeFormState]);

  const handleOpenMutualFriend = useCallback(
    (friendId) => {
      if (!friendId) {
        return;
      }
      const sanitized = String(friendId).trim();
      if (!sanitized) {
        return;
      }
      navigate(`${routes.profile.base}/${sanitized}`, { state: { from: location.pathname } });
    },
    [navigate, location.pathname]
  );

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

  const handleBannerFileChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      if (bannerPreviewUrlRef.current && bannerPreviewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(bannerPreviewUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      bannerPreviewUrlRef.current = previewUrl;
      setFormState((prev) => ({
        ...prev,
        bannerFile: file,
        bannerPreviewUrl: previewUrl,
        bannerCleared: false
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

  const handleClearBanner = useCallback(() => {
    clearBannerPreviewUrl();
    setFormState((prev) => ({
      ...prev,
      bannerFile: null,
      bannerPreviewUrl: null,
      bannerCleared: true
    }));
  }, [clearBannerPreviewUrl]);

  const handleFieldChange = useCallback((field) => {
    return (event) => {
      const value = typeof event?.target?.value === 'string' ? event.target.value : '';
      setFormState((prev) => ({
        ...prev,
        [field]: value
      }));
    };
  }, []);

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

      if (formState.avatarCleared && (effectiveUser?.avatar || formState.avatarFile)) {
        payload.avatar = null;
      } else if (formState.avatarFile) {
        let uploaded;
        try {
          setIsSavingProfile(true);
          uploaded = await uploadImage(formState.avatarFile);
        } catch (error) {
          setIsSavingProfile(false);
          setUpdateStatus({ type: 'error', message: error?.message || 'Failed to upload avatar.' });
          return;
        }

        payload.avatar = Object.fromEntries(
          Object.entries({
            url: uploaded?.url,
            thumbnailUrl: uploaded?.thumbnailUrl,
            width: uploaded?.width,
            height: uploaded?.height,
            mimeType: uploaded?.mimeType,
            description: uploaded?.description,
            uploadedAt: uploaded?.uploadedAt,
            uploadedBy: effectiveUser?._id
          }).filter(([, value]) => value !== undefined && value !== null && value !== '')
        );
      }

      if (formState.bannerCleared && (effectiveUser?.banner || formState.bannerFile)) {
        payload.banner = null;
      } else if (formState.bannerFile) {
        let uploadedBanner;
        try {
          setIsSavingProfile(true);
          uploadedBanner = await uploadImage(formState.bannerFile);
        } catch (error) {
          setIsSavingProfile(false);
          setUpdateStatus({ type: 'error', message: error?.message || 'Failed to upload banner.' });
          return;
        }

        payload.banner = Object.fromEntries(
          Object.entries({
            url: uploadedBanner?.url,
            thumbnailUrl: uploadedBanner?.thumbnailUrl,
            width: uploadedBanner?.width,
            height: uploadedBanner?.height,
            mimeType: uploadedBanner?.mimeType,
            description: uploadedBanner?.description,
            uploadedAt: uploadedBanner?.uploadedAt,
            uploadedBy: effectiveUser?._id
          }).filter(([, value]) => value !== undefined && value !== null && value !== '')
        );
      }

      const preferencesPayload = {};
      const currentTheme = effectiveUser?.preferences?.theme ?? 'system';
      if (formState.theme !== currentTheme) {
        preferencesPayload.theme = formState.theme;
      }

      if (Object.keys(preferencesPayload).length > 0) {
        payload.preferences = preferencesPayload;
      }

      if (Object.keys(payload).length === 0) {
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
        clearBannerPreviewUrl();
        setFormState(initializeFormState(updatedProfile));
      } catch (error) {
        setUpdateStatus({ type: 'error', message: error?.message || 'Failed to update profile.' });
      } finally {
        setIsSavingProfile(false);
      }
    },
    [
      clearAvatarPreviewUrl,
      clearBannerPreviewUrl,
      effectiveUser,
      formState.avatarCleared,
      formState.avatarFile,
      formState.bio,
      formState.displayName,
      formState.locationSharingEnabled,
      formState.bannerCleared,
      formState.bannerFile,
      formState.theme,
      initializeFormState
    ]
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
  const { statsVisible, postCount, eventsHosted, eventsAttended } = useProfileStats(effectiveUser);
  const badgeList = useProfileBadges(effectiveUser);

  const accountTimeline = useMemo(() => {
    if (!effectiveUser) {
      return null;
    }
    return {
      createdAt: formatDateTime(effectiveUser?.createdAt),
      updatedAt: formatDateTime(effectiveUser?.updatedAt),
      status: effectiveUser.accountStatus ?? 'unknown',
      email: effectiveUser.email ?? 'â€”',
      userId: effectiveUser._id ?? targetUserId ?? 'â€”'
    };
  }, [effectiveUser, targetUserId]);

  const joinedDisplay = accountTimeline?.createdAt ?? 'N/A';
  const handleBack = useCallback(() => {
    if (originPath) {
      navigate(originPath);
      return;
    }
    navigate(-1);
  }, [navigate, originPath]);



  return (
    <div className="profile-page-container">
      <div className="back-nav-bar profile-back-nav">
        <button
          type="button"
          className="back-button"
          aria-label="Go back to previous page"
          onClick={handleBack}
        >
          <ArrowBackIcon className="back-button__icon" />
        </button>
        {canEditProfile && !isEditing && (
          <Button
            variant="contained"
            onClick={handleBeginEditing}
            disabled={!effectiveUser || isFetchingProfile}
            className="profile-edit-button"
            sx={{ marginLeft: 'auto' }}
          >
            Edit profile
          </Button>
        )}
      </div>

      <div className="profile-page-frame">
        <Stack spacing={3}>
          {isFetchingProfile ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2" color="text.secondary">
                Loading profile data...
              </Typography>
            </Stack>
          ) : null}

          {fetchError ? (
            <Alert severity="warning" variant="outlined">
              {fetchError}
            </Alert>
          ) : null}

          {relationshipStatus ? (
            <Alert severity={relationshipStatus.type} onClose={() => setRelationshipStatus(null)}>
              {relationshipStatus.message}
            </Alert>
          ) : null}

          <ProfileHero
            avatarSrc={avatarDisplaySrc ?? undefined}
            bannerSrc={bannerDisplaySrc}
            displayName={displayName}
            joinedDisplay={joinedDisplay}
            showEmptyState={!hasProfile && !isFetchingProfile && !fetchError}
          />

          {canEditProfile && isEditing ? (
            <ProfileEditForm
              displayName={displayName}
              formState={formState}
              isSaving={isSavingProfile}
              editingAvatarSrc={editingAvatarSrc || avatarUrl}
              editingBannerSrc={editingBannerSrc}
              updateStatus={updateStatus}
              onDismissUpdateStatus={() => setUpdateStatus(null)}
              onSubmit={handleSaveProfile}
              onCancel={handleCancelEditing}
              onAvatarFileChange={handleAvatarFileChange}
              onBannerFileChange={handleBannerFileChange}
              onClearAvatar={handleClearAvatar}
              onClearBanner={handleClearBanner}
              onFieldChange={handleFieldChange}
              onThemeChange={handleThemeChange}
              onToggleLocationSharing={handleToggleLocationSharing}
            />
          ) : null}

          {hasProfile ? (
            <>
              <Divider />
              <ProfileStatsSummary
                statsVisible={statsVisible}
                postCount={postCount}
                eventsHosted={eventsHosted}
                eventsAttended={eventsAttended}
              />
              {!isViewingSelf ? (
                <ProfileMutualFriends
                  mutualFriendCount={mutualFriendCount}
                  mutualFriendPreview={mutualFriendPreview}
                  onSelectFriend={handleOpenMutualFriend}
                  resolveAvatarUrl={resolveAvatarUrl}
                />
              ) : null}
              <Stack spacing={3}>
                <ProfileBio bioText={bioText} />
                <ProfileBadges badgeList={badgeList} />
                <ProfileActionRow
                  canManageBlock={canManageBlock}
                  isBlocked={isBlocked}
                  isProcessingBlockAction={isProcessingBlockAction}
                  isFetchingProfile={isFetchingProfile}
                  onRequestBlock={handleRequestBlock}
                  onRequestUnblock={handleRequestUnblock}
                  showFriendAction={!isViewingSelf}
                  canSendFriendRequest={canSendFriendRequest}
                  isFriend={isFriend}
                  hasPendingFriendRequest={hasPendingFriendRequest}
                  isSendingFriendRequest={isSendingFriendRequest}
                  onSendFriendRequest={handleSendFriendRequest}
                />
              </Stack>
            </>
          ) : null}
        </Stack>

      </div>

      <ProfileBlockDialog
        mode={blockDialogMode}
        onClose={handleCloseBlockDialog}
        onConfirm={handleConfirmBlockDialog}
        isProcessing={isProcessingBlockAction}
      />
    </div>
  );
}

export default ProfilePage;
