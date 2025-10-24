import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { playBadgeSound } from '../utils/badgeSound';
import Tooltip from '@mui/material/Tooltip';
import {
  blockUser,
  fetchCurrentUserProfile,
  fetchUserProfile,
  unblockUser,
  updateCurrentUserProfile,
  uploadImage
} from '../api/mongoDataApi';
import runtimeConfig from '../config/runtime';
import { BADGE_METADATA } from '../utils/badges';

export const pageConfig = {
  id: 'profile',
  label: 'Profile',
  icon: AccountCircleIcon,
  path: '/profile/:userId',
  order: 91,
  showInNav: true,
  protected: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    const input = window.prompt(
      'Enter a profile ID (leave blank for your profile, type "me" or cancel to stay put):'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'me') {
      return '/profile/me';
    }
    const sanitized = trimmed.replace(/^\/+/, '');
    if (/^profile\/.+/i.test(sanitized)) {
      return `/${sanitized}`;
    }
    if (/^\/profile\/.+/i.test(trimmed)) {
      return trimmed;
    }
    return `/profile/${sanitized}`;
  }
};

const FALLBACK_AVATAR = '/images/profile/profile-01.jpg';

const resolveBadgeImageUrl = (value) => {
  if (!value) {
    return '—';
  }
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) {
    return '—';
  }
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return base ? `${base}${normalized}` : normalized;
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

const formatEntryValue = (value) => {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return '[unserializable object]';
    }
  }
  return String(value);
};

const METERS_PER_MILE = 1609.34;
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


const Section = ({ title, description, children }) => (
  <Stack spacing={1.5}>
    <Box>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
    </Box>
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default',
        p: { xs: 2, md: 3 }
      }}
    >
      {children}
    </Box>
  </Stack>
);

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
  const [relationshipStatus, setRelationshipStatus] = useState(null);
  const [blockDialogMode, setBlockDialogMode] = useState(null);
  const [isProcessingBlockAction, setIsProcessingBlockAction] = useState(false);
  const [showRawData, setShowRawData] = useState(false);
  const [formState, setFormState] = useState({
    displayName: '',
    bio: '',
    locationSharingEnabled: false,
    theme: 'system',
    avatarFile: null,
    avatarPreviewUrl: null,
    avatarCleared: true
  });
  const avatarPreviewUrlRef = useRef(null);

  const clearAvatarPreviewUrl = useCallback(() => {
    if (avatarPreviewUrlRef.current && avatarPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
    }
    avatarPreviewUrlRef.current = null;
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
      avatarCleared: !profile?.avatar
    }),
    []
  );

  useEffect(
    () => () => {
      clearAvatarPreviewUrl();
    },
    [clearAvatarPreviewUrl]
  );

  useEffect(() => {
    if (userFromState) {
      setFetchedUser(userFromState);
      setFetchError(null);
      setIsFetchingProfile(false);
      return;
    }

    if (!targetUserId && !shouldLoadCurrentUser) {
      setFetchedUser(null);
      setFetchError(null);
      setIsFetchingProfile(false);
      return;
    }

    let ignore = false;

    async function loadProfile() {
      setIsFetchingProfile(true);
      setFetchError(null);

      try {
        const profile = targetUserId ? await fetchUserProfile(targetUserId) : await fetchCurrentUserProfile();
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
        setFetchedUser(null);
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

  const avatarUrl = resolveAvatarUrl(effectiveUser?.avatar);
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
    setFormState(initializeFormState(effectiveUser));
    setUpdateStatus(null);
    setIsEditing(true);
  }, [clearAvatarPreviewUrl, effectiveUser, initializeFormState]);

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
        setFormState(initializeFormState(updatedProfile));
      } catch (error) {
        setUpdateStatus({ type: 'error', message: error?.message || 'Failed to update profile.' });
      } finally {
        setIsSavingProfile(false);
      }
    },
    [
      clearAvatarPreviewUrl,
      effectiveUser,
      formState.avatarCleared,
      formState.avatarFile,
      formState.bio,
      formState.displayName,
      formState.locationSharingEnabled,
      formState.theme,
      initializeFormState,
      updateCurrentUserProfile,
      uploadImage
    ]
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
      { key: 'following', label: 'Following', value: stats.following ?? 0 }
    ];
  }, [effectiveUser]);

  const badgeList = effectiveUser?.badges ?? [];
  const previousBadgeCountRef = useRef(badgeList.length);

  useEffect(() => {
    if (badgeList.length > previousBadgeCountRef.current) {
      playBadgeSound();
    }
    previousBadgeCountRef.current = badgeList.length;
  }, [badgeList.length]);

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
    const radiusMiles =
      typeof radiusMeters === 'number'
        ? Math.round((100 * radiusMeters) / METERS_PER_MILE) / 100
        : null;
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
      createdAt: formatDateTime(effectiveUser.createdAt),
      updatedAt: formatDateTime(effectiveUser.updatedAt),
      status: effectiveUser.accountStatus ?? 'unknown',
      email: effectiveUser.email ?? 'â€”',
      userId: effectiveUser._id ?? targetUserId ?? 'â€”'
    };
  }, [effectiveUser, targetUserId]);

  const rawDataAvailable = detailEntries.length > 0;

  const handleBack = () => {
    if (originPath) {
      navigate(originPath);
    } else {
      navigate(-1);
    }
  };

  const handleRequestBlock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('block');
  }, [canManageBlock]);

  const handleRequestUnblock = useCallback(() => {
    if (!canManageBlock) {
      return;
    }
    setRelationshipStatus(null);
    setBlockDialogMode('unblock');
  }, [canManageBlock]);

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
  }, [blockDialogMode, displayName, effectiveUser, normalizedTargetId]);

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

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 }
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          backgroundColor: 'background.paper'
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              size="small"
              color="primary"
              sx={{ alignSelf: 'flex-start' }}
            >
              Back
            </Button>
          </Box>

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

          <Stack spacing={2} alignItems="center" textAlign="center">
            <Avatar
              src={avatarUrl}
              alt={`${displayName} avatar`}
              sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
            >
              {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1">
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                User ID: {effectiveUser?._id || targetUserId || 'N/A'}
              </Typography>
            </Box>
            {!hasProfile && !isFetchingProfile && !fetchError ? (
              <Typography variant="body2" color="text.secondary">
                No additional user context was provided. Use a pin, reply, or enter a valid user ID
                to preview available data.
              </Typography>
            ) : null}
          </Stack>

          {canManageBlock ? (
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="outlined"
                color={isBlocked ? 'primary' : 'error'}
                startIcon={isBlocked ? <HowToRegIcon /> : <BlockIcon />}
                onClick={isBlocked ? handleRequestUnblock : handleRequestBlock}
                disabled={isProcessingBlockAction || isFetchingProfile}
              >
                {isBlocked ? 'Unblock user' : 'Block user'}
              </Button>
            </Box>
          ) : null}

          {canEditProfile ? (
            <Stack spacing={2} sx={{ alignSelf: 'stretch' }}>
              {updateStatus ? (
                <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
                  {updateStatus.message}
                </Alert>
              ) : null}

              {isEditing ? (
                <Stack
                  component="form"
                  spacing={2}
                  onSubmit={handleSaveProfile}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.default'
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Avatar
                      src={editingAvatarSrc}
                      alt="Profile avatar preview"
                      sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
                    >
                      {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
                    </Avatar>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button component="label" variant="outlined" size="small" disabled={isSavingProfile}>
                        Upload avatar
                        <input type="file" hidden accept="image/*" onChange={handleAvatarFileChange} />
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        color="warning"
                        size="small"
                        onClick={handleClearAvatar}
                        disabled={
                          isSavingProfile ||
                          (formState.avatarCleared && !formState.avatarFile && !effectiveUser?.avatar)
                        }
                      >
                        Remove avatar
                      </Button>
                    </Stack>
                  </Stack>

                  <TextField
                    label="Display name"
                    value={formState.displayName}
                    onChange={handleFieldChange('displayName')}
                    required
                    disabled={isSavingProfile}
                    fullWidth
                  />

                  <TextField
                    label="Bio"
                    value={formState.bio}
                    onChange={handleFieldChange('bio')}
                    multiline
                    minRows={3}
                    helperText="Share something about yourself (500 characters max)."
                    disabled={isSavingProfile}
                    inputProps={{ maxLength: 500 }}
                    fullWidth
                  />

                  <TextField
                    label="Theme preference"
                    value={formState.theme}
                    onChange={handleThemeChange}
                    select
                    disabled={isSavingProfile}
                    fullWidth
                  >
                    <MenuItem value="system">System default</MenuItem>
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                  </TextField>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.locationSharingEnabled}
                        onChange={handleToggleLocationSharing}
                        color="primary"
                        disabled={isSavingProfile}
                      />
                    }
                    label="Share location with nearby features"
                  />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                    <Button
                      type="button"
                      variant="outlined"
                      color="inherit"
                      onClick={handleCancelEditing}
                      disabled={isSavingProfile}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSavingProfile}>
                      {isSavingProfile ? 'Saving...' : 'Save changes'}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={handleBeginEditing}
                    disabled={!effectiveUser || isFetchingProfile}
                  >
                    Edit profile
                  </Button>
                </Box>
              )}
            </Stack>
          ) : null}

          {hasProfile ? (
            <>
              <Divider />
              <Stack spacing={3}>
                <Section
                  title="Bio"
                  description="Everything they want you to know right now."
                >
                  {bioText ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {bioText}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This user hasn't added a bio yet.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Badges & achievements"
                  description="Recognition earned by this community member."
                >
                  {badgeList.length ? (
                    <Stack direction="row" flexWrap="wrap" gap={1.5}>
                      {badgeList.map((badgeId) => {
                        const badgeInfo =
                          BADGE_METADATA[badgeId] ?? {
                            label: badgeId,
                            description: 'Earn this badge to uncover its story.',
                            image: undefined
                          };
                        const badgeImageUrl = resolveBadgeImageUrl(badgeInfo.image);
                        return (
                          <Tooltip key={badgeId} title={badgeInfo.description} arrow enterTouchDelay={0}>
                            <Chip
                              label={badgeInfo.label}
                              color="primary"
                              variant="outlined"
                              sx={{
                                fontSize: '1rem',
                                px: 1.5,
                                py: 0.75,
                                borderWidth: 2
                              }}
                              avatar={
                                badgeImageUrl ? (
                                  <Avatar
                                    src={badgeImageUrl}
                                    alt={`${badgeInfo.label} badge`}
                                    sx={{ width: 56, height: 56 }}
                                  />
                                ) : undefined
                              }
                            />
                          </Tooltip>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No badges yet â€” theyâ€™ll appear here once this user starts collecting achievements.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Highlights"
                  description="At-a-glance stats across this profile."
                >
                  {statsVisible ? (
                    statsEntries.length ? (
                      <Grid container spacing={2}>
                        {statsEntries.map(({ key, label, value }) => (
                          <Grid item xs={6} sm={4} key={key}>
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle2" color="text.secondary">
                                {label}
                              </Typography>
                              <Typography variant="h5">{value}</Typography>
                            </Stack>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Stats will appear here once this user starts hosting events, posting, or connecting with others.
                      </Typography>
                    )
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This user keeps their stats private.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Activity & collections"
                  description="Quick counts for pins, bookmarks, rooms, and locations associated with this user."
                >
                  {activityEntries.length ? (
                    <Grid container spacing={2}>
                      {activityEntries.map(({ key, label, value }) => (
                        <Grid item xs={6} sm={4} key={key}>
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="h6">{value}</Typography>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Activity counters will populate as soon as this user creates or saves pins, joins chats, or shares check-ins.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Preferences"
                  description="Theme, privacy, and notification settings currently applied to this profile."
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Interface theme
                        </Typography>
                        <Typography variant="body1">
                          {preferenceSummary.theme.charAt(0).toUpperCase() + preferenceSummary.theme.slice(1)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Discovery radius
                        </Typography>
                        <Typography variant="body1">
                          {typeof preferenceSummary.radiusMiles === 'number'
                            ? `${preferenceSummary.radiusMiles} mi`
                            : 'Default'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Location sharing
                        </Typography>
                        <Typography variant="body1">
                          {preferenceSummary.locationSharing ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Stats visibility
                        </Typography>
                        <Typography variant="body1">
                          {statsVisible ? 'Shared' : 'Hidden'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Divider flexItem />

                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {notificationPreferences.map(({ key, label, enabled }) => (
                        <Chip
                          key={key}
                          label={`${label}${enabled ? '' : ' (off)'}`}
                          color={enabled ? 'success' : 'default'}
                          variant={enabled ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Section>

                <Section
                  title="Account timeline"
                  description="Provisioning details captured when this account was created."
                >
                  {accountTimeline ? (
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        User ID
                      </Typography>
                      <Typography variant="body1">{accountTimeline.userId}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Email
                      </Typography>
                      <Typography variant="body1">{accountTimeline.email}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Account status
                      </Typography>
                      <Typography variant="body1">
                        {accountTimeline.status.charAt(0).toUpperCase() + accountTimeline.status.slice(1)}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Created
                      </Typography>
                      <Typography variant="body1">{accountTimeline.createdAt}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Last updated
                      </Typography>
                      <Typography variant="body1">{accountTimeline.updatedAt}</Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Weâ€™ll surface account timestamps once this profile finishes loading.
                    </Typography>
                  )}
                </Section>

                {rawDataAvailable ? (
                  <Stack spacing={1}>
                    <Button
                      type="button"
                      variant="text"
                      color="secondary"
                      onClick={() => setShowRawData((prev) => !prev)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {showRawData ? 'Hide raw profile JSON' : 'Show raw profile JSON'}
                    </Button>
                    <Collapse in={showRawData} unmountOnExit>
                      <Stack spacing={1.5}>
                        {detailEntries.map(({ key, value, isObject }) => (
                          <Box
                            key={key}
                            sx={{
                              borderRadius: 2,
                              border: '1px dashed',
                              borderColor: 'divider',
                              backgroundColor: 'background.default',
                              p: 2
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                textTransform: 'uppercase',
                                letterSpacing: 0.6,
                                fontWeight: 600
                              }}
                            >
                              {key}
                            </Typography>
                            {isObject ? (
                              <Box
                                component="pre"
                                sx={{
                                  mt: 1,
                                  mb: 0,
                                  fontSize: '0.85rem',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {formatEntryValue(value)}
                              </Box>
                            ) : (
                              <Typography variant="body1" sx={{ mt: 0.5 }}>
                                {formatEntryValue(value)}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    </Collapse>
                  </Stack>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Paper>
      <Dialog
        open={Boolean(blockDialogMode)}
        onClose={handleCloseBlockDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{blockDialogMode === 'block' ? 'Block this user?' : 'Unblock this user?'}</DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {blockDialogMode === 'block'
              ? 'Blocked users cannot interact with you and their activity is hidden. You can review blocked users in Settings whenever you change your mind.'
              : 'Unblocking lets this user interact with you again and restores their activity in your feeds.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseBlockDialog} disabled={isProcessingBlockAction}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBlockDialog}
            color={blockDialogMode === 'block' ? 'error' : 'primary'}
            variant="contained"
            disabled={isProcessingBlockAction}
          >
            {isProcessingBlockAction
              ? 'Updating...'
              : blockDialogMode === 'block'
              ? 'Block user'
              : 'Unblock user'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProfilePage;






