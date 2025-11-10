// This is a profile page that follows the proposed design guidelines.
// If you plan to add more features, please do so in ProfilePage_debug.jsx (they still get displayed here)
// This will help keep the main profile design consistent and give them time to add the features
// officially later on in a mannor that follows the design guidelines.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import FlagIcon from '@mui/icons-material/Flag';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import MessageIcon from '@mui/icons-material/Message';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import {
  blockUser,
  createDirectMessageThread,
  fetchCurrentUserProfile,
  fetchUserProfile,
  submitModerationAction,
  unblockUser,
  updateCurrentUserProfile,
  uploadImage
} from '../api/mongoDataApi';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import runtimeConfig from '../config/runtime';
import { BADGE_METADATA } from '../utils/badges';
import { normalizeProfileImagePath, DEFAULT_PROFILE_IMAGE_REGEX } from '../utils/media';
import { routes } from '../routes';
import './ProfilePage.css';
import ProfilePageAdditionalDetail from './ProfilePage_debug.jsx';

const ACTION_CARD_SX = {
  flex: 1,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 1
};

/*
 * NOTE:
 * - This layout intentionally hides several richer views and power tools that still exist in the data layer:
 *   • Preferences & notifications summary
 *   • Account timeline / provisioning metadata
 *   • Raw profile JSON inspector
 *   • Moderation & trust-and-safety controls (reporting, quick actions)
 *   • Messaging/report initiation handlers (UI placeholders remain)
 * - All underlying fetch/update logic (editing flows, block/unblock, moderation requests, etc.) continues to live in useProfileDetail.
 * - ProfilePage_debug.jsx still surfaces every control if the full debug experience is needed.
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
        } catch (error) {
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


const Section = ({ title, description, children }) => (
  <Stack spacing={1.5}>
    <Box>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description ? (
        <div className="description-box">
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </div>
      ) : null}
    </Box>
    <Box
      className="section-content-box"
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 2, md: 3 }
      }}
    >
      {children}
    </Box>
  </Stack>
);

function ProfilePage() {
  const muiTheme = useTheme();
  const legacyProfileTheme = useMemo(
    () =>
      createTheme(muiTheme, {
        palette: {
          mode: 'light',
          background: {
            ...muiTheme.palette.background,
            default: '#f5f5f5',
            paper: '#ffffff'
          },
          text: {
            ...muiTheme.palette.text,
            primary: '#1f1f1f',
            secondary: '#475467'
          }
        }
      }),
    [muiTheme]
  );

  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { isOffline } = useNetworkStatusContext();
  const socialNotifications = useSocialNotificationsContext();
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
  const [isDmDialogOpen, setIsDmDialogOpen] = useState(false);
  const [dmMessage, setDmMessage] = useState('');
  const [isCreatingDm, setIsCreatingDm] = useState(false);
  const [dmStatus, setDmStatus] = useState(null);
  const [dmSnackbar, setDmSnackbar] = useState(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [reportSnackbar, setReportSnackbar] = useState(null);
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
  const canEditProfile = Boolean(isViewingSelf && !userFromState);
  const canManageBlock = Boolean(!isViewingSelf && viewerProfile && normalizedTargetId);
  const canMessageUser = Boolean(!isViewingSelf && normalizedTargetId);
  const canReportUser = Boolean(!isViewingSelf && normalizedTargetId);
  const blockCardDisabled = Boolean(isProcessingBlockAction || isFetchingProfile);

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
      initializeFormState,
      updateCurrentUserProfile,
      uploadImage
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

  const statValues = useMemo(
    () =>
      statsEntries.reduce((accumulator, { key, value }) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          accumulator[key] = value;
        } else if (value !== undefined && value !== null) {
          const parsed = Number(value);
          accumulator[key] = Number.isFinite(parsed) ? parsed : 0;
        } else {
          accumulator[key] = 0;
        }
        return accumulator;
      }, {}),
    [statsEntries]
  );

  const postCount = statValues.posts ?? 0;
  const eventsHosted = statValues.eventsHosted ?? 0;
  const eventsAttended = statValues.eventsAttended ?? 0;

  const badgeList = effectiveUser?.badges ?? [];

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

  const handleOpenDmDialog = useCallback(() => {
    setDmMessage('');
    setDmStatus(null);
    setIsDmDialogOpen(true);
  }, []);

  const handleMessageKeyDown = useCallback(
    (event) => {
      if (!canMessageUser) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpenDmDialog();
      }
    },
    [canMessageUser, handleOpenDmDialog]
  );

  const handleCloseDmDialog = useCallback(() => {
    if (isCreatingDm) {
      return;
    }
    setIsDmDialogOpen(false);
    setDmStatus(null);
  }, [isCreatingDm]);

  const handleSubmitDirectMessage = useCallback(async () => {
    if (!normalizedTargetId || isViewingSelf) {
      setDmStatus({
        type: 'error',
        message: 'Select another user before starting a conversation.'
      });
      return;
    }

    if (isOffline) {
      setDmStatus({
        type: 'error',
        message: 'Reconnect to the network to send a message.'
      });
      return;
    }

    const trimmed = dmMessage.trim();
    setIsCreatingDm(true);
    setDmStatus(null);
    try {
      const response = await createDirectMessageThread({
        participantIds: [normalizedTargetId],
        initialMessage: trimmed ? trimmed : undefined
      });
      if (typeof socialNotifications?.refreshAll === 'function') {
        await socialNotifications.refreshAll().catch(() => {});
      }
      setIsDmDialogOpen(false);
      setDmSnackbar('Direct message thread created.');
      setDmMessage('');
      if (response?.thread?.id) {
        navigate(routes.directMessages.thread(response.thread.id));
      } else {
        navigate(routes.directMessages.base);
      }
    } catch (error) {
      setDmStatus({
        type: 'error',
        message: error?.message || 'Failed to start a direct message with this user.'
      });
    } finally {
      setIsCreatingDm(false);
    }
  }, [
    dmMessage,
    isOffline,
    isViewingSelf,
    navigate,
    normalizedTargetId,
    socialNotifications
  ]);

  const handleDmSnackbarClose = useCallback(() => {
    setDmSnackbar(null);
  }, []);

  const handleOpenReportDialog = useCallback(() => {
    setReportReason('');
    setReportStatus(null);
    setIsReportDialogOpen(true);
  }, []);

  const handleReportKeyDown = useCallback(
    (event) => {
      if (!canReportUser) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpenReportDialog();
      }
    },
    [canReportUser, handleOpenReportDialog]
  );

  const handleCloseReportDialog = useCallback(() => {
    if (isSubmittingReport) {
      return;
    }
    setIsReportDialogOpen(false);
    setReportStatus(null);
  }, [isSubmittingReport]);

  const handleSubmitReport = useCallback(async () => {
    if (!normalizedTargetId || isViewingSelf) {
      setReportStatus({
        type: 'error',
        message: 'Select another user before submitting a report.'
      });
      return;
    }

    if (isOffline) {
      setReportStatus({
        type: 'error',
        message: 'Reconnect to the network to submit a report.'
      });
      return;
    }

    setIsSubmittingReport(true);
    setReportStatus(null);
    try {
      await submitModerationAction({
        userId: normalizedTargetId,
        type: 'report',
        reason: reportReason.trim() || undefined
      });
      setIsReportDialogOpen(false);
      setReportSnackbar('Report submitted. Our moderators will review it shortly.');
      setReportReason('');
    } catch (error) {
      setReportStatus({
        type: 'error',
        message: error?.message || 'Failed to submit report.'
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }, [isOffline, isViewingSelf, normalizedTargetId, reportReason]);

  const handleReportSnackbarClose = useCallback(() => {
    setReportSnackbar(null);
  }, []);

  const buildActionCardProps = useCallback(
    (canInteract, onActivate, onKeyDownHandler) => ({
      role: 'button',
      tabIndex: canInteract ? 0 : -1,
      'aria-disabled': canInteract ? 'false' : 'true',
      className: 'section-content-box action-card',
      onClick: canInteract ? onActivate : undefined,
      onKeyDown: onKeyDownHandler,
      sx: {
        ...ACTION_CARD_SX,
        cursor: canInteract ? 'pointer' : 'not-allowed',
        opacity: canInteract ? 1 : 0.6
      }
    }),
    []
  );

  const handleBlockCardKeyDown = useCallback(
    (event) => {
      if (!canManageBlock || blockCardDisabled) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (isBlocked) {
          handleRequestUnblock();
        } else {
          handleRequestBlock();
        }
      }
    },
    [blockCardDisabled, canManageBlock, handleRequestBlock, handleRequestUnblock, isBlocked]
  );

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

          <Stack spacing={2} alignItems="center" textAlign="center" sx={{ width: '100%', pt: 1 }}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  borderRadius: 3,
                  backgroundColor: 'grey.800',
                  overflow: 'visible',
                  minHeight: { xs: 160, sm: 200 },
                  maxWidth: 800,
                  aspectRatio: { xs: '16 / 7', sm: '16 / 5' }
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    overflow: 'hidden'
                  }}
                >
                  {bannerDisplaySrc ? (
                    <Box
                      component="img"
                      src={bannerDisplaySrc}
                      alt="Profile banner"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: '100%',
                        height: '100%',
                        background: 'linear-gradient(135deg, #4B3F72 0%, #2E2157 100%)'
                      }}
                    />
                  )}
                </Box>
                <Avatar
                  src={avatarDisplaySrc ?? undefined}
                  alt={`${displayName} avatar`}
                  sx={{
                    width: 112,
                    height: 112,
                    position: 'absolute',
                    left: '50%',
                    bottom: -56,
                    transform: 'translateX(-50%)',
                    border: '4px solid',
                    borderColor: 'background.paper',
                    bgcolor: 'secondary.main',
                    boxShadow: 3,
                    zIndex: 1
                  }}
                >
                  {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
                </Avatar>
              </Box>
              <Box sx={{ height: 72 }} aria-hidden="true" />
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', fontSize: '2rem' }}>
                  {displayName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Joined: {joinedDisplay}
                </Typography>
              </Box>
              {!hasProfile && !isFetchingProfile && !fetchError ? (
                <Typography variant="body2" color="text.secondary">
                  This user hasn't filled out their profile yet.
                </Typography>
              ) : null}
          </Stack>

          {canEditProfile ? (
            <Stack spacing={2} sx={{ alignSelf: 'stretch', maxWidth: 720, width: '100%', margin: '1.5rem auto 0' }}>
              {updateStatus ? (
                <Alert
                  severity={updateStatus.type}
                  onClose={() => setUpdateStatus(null)}
                  sx={{
                    backgroundColor:
                      updateStatus.type === 'success'
                        ? 'rgba(76, 175, 80, 0.15)'
                        : updateStatus.type === 'error'
                          ? 'rgba(244, 67, 54, 0.15)'
                          : updateStatus.type === 'warning'
                            ? 'rgba(255, 193, 7, 0.15)'
                            : 'rgba(33, 150, 243, 0.15)',
                    color: 'text.primary',
                    '& .MuiAlert-icon': {
                      color:
                        updateStatus.type === 'success'
                          ? 'success.main'
                          : updateStatus.type === 'error'
                            ? 'error.main'
                            : updateStatus.type === 'warning'
                              ? 'warning.main'
                              : 'info.main'
                    }
                  }}
                >
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
                    borderColor: '#000',
                    backgroundColor: '#f2f2f2'
                  }}
                >
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Profile banner
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        minHeight: 140,
                        borderRadius: 2,
                        overflow: 'hidden',
                        backgroundColor: 'grey.800',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {editingBannerSrc ? (
                        <Box
                          component="img"
                          src={editingBannerSrc}
                          alt="Profile banner preview"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No banner selected.
                        </Typography>
                      )}
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button component="label" variant="outlined" size="small" disabled={isSavingProfile}>
                        Upload banner
                        <input type="file" hidden accept="image/*" onChange={handleBannerFileChange} />
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        color="warning"
                        size="small"
                        onClick={handleClearBanner}
                        disabled={
                          isSavingProfile ||
                          (formState.bannerCleared && !formState.bannerFile && !effectiveUser?.banner)
                        }
                      >
                        Remove banner
                      </Button>
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Avatar
                      src={editingAvatarSrc || avatarUrl}
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
              ) : null}
            </Stack>
          ) : null}

          {hasProfile ? (
            <>
              <Divider />
              {statsVisible ? (
                <>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    spacing={1}
                    sx={{ px: 0.5 }}
                  >
                    <Box className="summary-box" sx={{ flex: '0 0 auto' }}>
                      <Typography variant="body2">Post count: {postCount}</Typography>
                    </Box>
                    <Box className="summary-box" sx={{ flex: '0 0 auto', textAlign: 'right' }}>
                      <Typography variant="body2">Events hosted: {eventsHosted}</Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" sx={{ px: 0.5 }}>
                    <Box className="summary-box" sx={{ flex: '0 0 auto' }}>
                      <Typography variant="body2">Events attended: {eventsAttended}</Typography>
                    </Box>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                  This user keeps their stats private.
                </Typography>
              )}
              <Stack spacing={3}>
                <Section
                  title="Bio"
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
                      No badges yet. They will appear here once this user starts collecting achievements.
                    </Typography>
                  )}
                </Section>

                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: 2,
                    width: '100%'
                  }}
                >
                  <Box {...buildActionCardProps(canMessageUser, handleOpenDmDialog, handleMessageKeyDown)}>
                    <MessageIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Message
                    </Typography>
                  </Box>

                  <Box {...buildActionCardProps(canReportUser, handleOpenReportDialog, handleReportKeyDown)}>
                    <FlagIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Report
                    </Typography>
                  </Box>

                  {canManageBlock ? (
                    <Box
                      {...buildActionCardProps(
                        !blockCardDisabled,
                        isBlocked ? handleRequestUnblock : handleRequestBlock,
                        handleBlockCardKeyDown
                      )}
                    >
                      {isBlocked ? (
                        <HowToRegIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                      ) : (
                        <BlockIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {isBlocked ? 'Unblock' : 'Block'}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>
                <ThemeProvider theme={legacyProfileTheme}>
                  <Accordion
                    disableGutters
                    sx={(theme) => ({
                      borderRadius: 2,
                      boxShadow: 'none',
                      border: '1px solid',
                      borderColor: theme.palette.divider,
                      mt: 3,
                      backgroundColor: theme.palette.background.paper,
                      color: theme.palette.text.primary
                    })}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls="additional-content-panel"
                      id="additional-content-header"
                      sx={(theme) => ({
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        px: 2,
                        '& .MuiAccordionSummary-expandIconWrapper svg': {
                          color: theme.palette.text.secondary
                        },
                        '& .MuiTypography-root': {
                          color: theme.palette.text.primary,
                          fontWeight: 600
                        }
                      })}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Additional Content
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={(theme) => ({
                        px: { xs: 1, sm: 2 },
                        py: 2,
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        borderTop: '1px solid',
                        borderColor: theme.palette.divider
                      })}
                    >
                      <Box
                        sx={(theme) => ({
                          width: '100%',
                          color: theme.palette.text.primary,
                          backgroundColor: theme.palette.background.paper
                        })}
                      >
                        <ProfilePageAdditionalDetail />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </ThemeProvider>

              </Stack>
            </>
          ) : null}
        </Stack>

      </div>

      <Dialog
        open={isDmDialogOpen}
        onClose={handleCloseDmDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Message {displayName}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {dmStatus ? <Alert severity={dmStatus.type}>{dmStatus.message}</Alert> : null}
            <TextField
              label="Message"
              value={dmMessage}
              onChange={(event) => setDmMessage(event.target.value)}
              placeholder="Say hello or share a quick update."
              multiline
              minRows={3}
              disabled={isCreatingDm || isOffline}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDmDialog} disabled={isCreatingDm}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitDirectMessage}
            variant="contained"
            color="secondary"
            disabled={isCreatingDm || isOffline || !canMessageUser}
          >
            {isCreatingDm ? 'Sending…' : 'Send message'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isReportDialogOpen}
        onClose={handleCloseReportDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Report {displayName}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            {reportStatus ? <Alert severity={reportStatus.type}>{reportStatus.message}</Alert> : null}
            <TextField
              label="Reason"
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value)}
              placeholder="Let moderators know what happened (optional)."
              multiline
              minRows={3}
              disabled={isSubmittingReport || isOffline}
            />
            <Typography variant="caption" color="text.secondary">
              Reports notify moderators. Misuse may result in account action.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseReportDialog} disabled={isSubmittingReport}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitReport}
            variant="contained"
            color="error"
            disabled={isSubmittingReport || isOffline || !canReportUser}
          >
            {isSubmittingReport ? 'Submitting…' : 'Submit report'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(dmSnackbar)}
        autoHideDuration={4000}
        onClose={handleDmSnackbarClose}
        message={dmSnackbar ?? ''}
      />

      <Snackbar
        open={Boolean(reportSnackbar)}
        autoHideDuration={4000}
        onClose={handleReportSnackbarClose}
        message={reportSnackbar ?? ''}
      />

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
    </div>
  );
}

export default ProfilePage;






