/* NOTE: Page exports configuration alongside the component. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import './PinDetails.css';
import {
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Button,
  FormControlLabel,
  Switch,
  Box
} from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place'; // used only for pageConfig
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import ForumIcon from '@mui/icons-material/Forum';
import AddCommentIcon from '@mui/icons-material/AddComment';
import LeafletMap from '../components/Map';
import FriendBadge from '../components/FriendBadge';
import BookmarkButton from '../components/BookmarkButton';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import usePinDetails from '../hooks/usePinDetails';
import ReportContentDialog from '../components/ReportContentDialog';
import { createContentReport, deletePin, updatePin } from '../api/mongoDataApi';
import ImageOverlay from '../components/ImageOverlay.jsx'

const EXPIRED_PIN_ID = '68e061721329566a22d47fff';
const SAMPLE_PIN_IDS = [
  '68e061721329566a22d474aa',
  '68e061721329566a22d474ab',
  '68e061721329566a22d474ac',
  '68e061721329566a22d47a00'
];
const FAR_PIN_ID = SAMPLE_PIN_IDS[0] ?? '68e061721329566a22d474aa';
const MAX_PHOTO_PIN_ID = '68e061721329566a22d47a00';
const BROKEN_TEXTURE_PIN_ID = '68e061721329566a22d47a01';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    const input = window.prompt(
      'Enter a pin ID to view. Shortcuts: "expired" loads an expired pin, "far" loads a distant pin, "3" loads the max-photo sample, "broken" loads the UNKNOWN_TEXTURE tester. Leave blank for a random sample or cancel to stay put.'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (trimmed.toLowerCase() === 'expired') {
      return routes.pin.byId(EXPIRED_PIN_ID);
    }
    if (trimmed.toLowerCase() === 'far') {
      const farId = FAR_PIN_ID;
      return `${routes.pin.byId(farId)}?preview=far`;
    }
    if (trimmed === '3' || trimmed === 'max') {
      return routes.pin.byId(MAX_PHOTO_PIN_ID);
    }
    if (trimmed === 'broken') {
      return routes.pin.byId(BROKEN_TEXTURE_PIN_ID);
    }
    if (!trimmed) {
      const randomId =
        SAMPLE_PIN_IDS[Math.floor(Math.random() * SAMPLE_PIN_IDS.length)] ?? '68e061721329566a22d474aa';
      return routes.pin.byId(randomId);
    }
    return routes.pin.byId(trimmed);
  }
};

const formatDateTimeLocal = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (input) => String(input).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseDateInput = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeMediaAssetForUpdate = (asset) => {
  if (!asset || typeof asset !== 'object') {
    return null;
  }
  const sourceUrl =
    typeof asset.url === 'string' && asset.url.trim()
      ? asset.url.trim()
      : typeof asset.path === 'string' && asset.path.trim()
      ? asset.path.trim()
      : null;

  if (!sourceUrl) {
    return null;
  }

  const normalized = { url: sourceUrl };

  if (Number.isFinite(asset.width)) {
    normalized.width = asset.width;
  }
  if (Number.isFinite(asset.height)) {
    normalized.height = asset.height;
  }
  if (typeof asset.mimeType === 'string' && asset.mimeType.trim()) {
    normalized.mimeType = asset.mimeType.trim();
  }
  if (typeof asset.description === 'string' && asset.description.trim()) {
    normalized.description = asset.description.trim();
  }

  return normalized;
};

const buildInitialEditForm = (pin) => {
  if (!pin || typeof pin !== 'object') {
    return {
      title: '',
      description: '',
      proximityRadiusMeters: '',
      startDate: '',
      endDate: '',
      expiresAt: '',
      autoDelete: true
    };
  }

  const normalizedType = typeof pin.type === 'string' ? pin.type.toLowerCase() : '';
  const radius = Number.isFinite(pin.proximityRadiusMeters)
    ? pin.proximityRadiusMeters
    : typeof pin.proximityRadiusMeters === 'number'
    ? pin.proximityRadiusMeters
    : 1609;

  const base = {
    title: pin.title ?? '',
    description: pin.description ?? '',
    proximityRadiusMeters: radius ? String(Math.max(1, Math.round(radius))) : '',
    startDate: '',
    endDate: '',
    expiresAt: '',
    autoDelete: pin.autoDelete ?? true
  };

  if (normalizedType === 'event') {
    base.startDate = formatDateTimeLocal(pin.startDate ?? null);
    base.endDate = formatDateTimeLocal(pin.endDate ?? null);
  } else {
    const expiresSource = pin.expiresAt ?? pin.endDate ?? null;
    base.expiresAt = formatDateTimeLocal(expiresSource);
    base.autoDelete = pin.autoDelete ?? true;
  }

  return base;
};

const resolveUserId = (user) => {
  if (!user) {
    return null;
  }
  if (typeof user === 'string') {
    const trimmed = user.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof user === 'object') {
    if (user.$oid) {
      return resolveUserId(user.$oid);
    }
    if (user._id) {
      return resolveUserId(user._id);
    }
    if (user.id) {
      return resolveUserId(user.id);
    }
    if (user.userId) {
      return resolveUserId(user.userId);
    }
    if (user.uid) {
      return resolveUserId(user.uid);
    }
    if (user.email) {
      return resolveUserId(user.email);
    }
    if (user.username) {
      return resolveUserId(user.username);
    }
  }
  return String(user);
};

function PinDetails() {
  const { pinId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();

  const {
    pin,
    isEventPin,
    isOwnPin,
    isInteractionLocked,
    pinTypeHeading,
    interactionOverlay,
    viewerDistanceLabel,
    mapPins,
    coordinates,
    coordinateLabel,
    coverImageUrl,
    photoItems,
    proximityRadius,
    addressLabel,
    approximateAddressLabel,
    eventDateRange,
    expirationLabel,
    createdAtLabel,
    updatedAtLabel,
    creatorProfileLink,
    creatorAvatarUrl,
    isLoading,
    error,
    bookmarked,
    isUpdatingBookmark,
    bookmarkError,
    handleToggleBookmark,
    attending,
    isUpdatingAttendance,
    attendanceError,
    handleToggleAttendance,
    replyItems,
    replyCount,
    isLoadingReplies,
    repliesError,
    replyComposerOpen,
    openReplyComposer,
    closeReplyComposer,
    replyMessage,
    setReplyMessage,
    isSubmittingReply,
    submitReplyError,
    handleSubmitReply,
    shareStatus,
    setShareStatus,
    handleSharePin,
    reloadPin,
    isSharing,
    attendeeItems,
    attendeeOverlayOpen,
    openAttendeeOverlay,
    closeAttendeeOverlay,
    isLoadingAttendees,
    attendeesError
  } = usePinDetails({ pinId, location, isOffline });
  const socialNotifications = useSocialNotificationsContext();

  const friendLookup = useMemo(() => {
    const entries = Array.isArray(socialNotifications.friendData?.friends)
      ? socialNotifications.friendData.friends
      : [];
    const lookup = new Set();
    entries.forEach((friend) => {
      const id = resolveUserId(friend?.id ?? friend?._id ?? friend);
      if (id) {
        lookup.add(id);
      }
    });
    return lookup;
  }, [socialNotifications.friendData?.friends]);

  const attendingFriendItems = useMemo(() => {
    if (!friendLookup.size || !Array.isArray(attendeeItems)) {
      return [];
    }
    return attendeeItems.filter((attendee) => {
      const userId =
        resolveUserId(attendee?._id) ||
        resolveUserId(attendee?.id) ||
        resolveUserId(attendee?.userId) ||
        resolveUserId(attendee?.uid) ||
        resolveUserId(attendee?.username) ||
        resolveUserId(attendee?.email);
      return Boolean(userId && friendLookup.has(userId));
    });
  }, [attendeeItems, friendLookup]);

  const attendingFriendPreview = useMemo(
    () => attendingFriendItems.slice(0, 6),
    [attendingFriendItems]
  );
  const extraFriendCount = Math.max(0, attendingFriendItems.length - attendingFriendPreview.length);

  const originEntry = location.state?.from;
  const resolvedOriginPath = useMemo(() => {
    if (!originEntry) {
      return null;
    }
    if (typeof originEntry === 'string') {
      return originEntry;
    }
    if (typeof originEntry === 'object' && originEntry !== null) {
      const pathname = originEntry.pathname ?? '';
      if (!pathname) {
        return null;
      }
      const search = originEntry.search ?? '';
      const hash = originEntry.hash ?? '';
      return `${pathname}${search}${hash}`;
    }
    return null;
  }, [originEntry]);

  const handleBackNavigation = useCallback(() => {
    if (resolvedOriginPath) {
      navigate(resolvedOriginPath);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(routes.list.base);
  }, [navigate, resolvedOriginPath]);

  const themeClass = isEventPin ? 'event-mode' : 'discussion-mode';
  const pinErrorMessage = typeof error === 'string' ? error : error?.message;
  const pinErrorSeverity = error?.isAuthError ? 'warning' : 'error';
  const shouldShowStatusMessages =
    isLoading || Boolean(pinErrorMessage) || (!pin && !isLoading && pinId);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => buildInitialEditForm(pin));
  const [editError, setEditError] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState(null);
  const [isDeletingPin, setIsDeletingPin] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (pin && !isEditDialogOpen) {
      setEditForm(buildInitialEditForm(pin));
    }
  }, [pin, isEditDialogOpen]);

  const handleOpenEditDialog = useCallback(() => {
    if (!pin) {
      return;
    }
    setEditForm(buildInitialEditForm(pin));
    setEditError(null);
    setIsEditDialogOpen(true);
  }, [pin]);

  const handleCloseEditDialog = useCallback(() => {
    if (isSubmittingEdit || isDeletingPin) {
      return;
    }
    setIsEditDialogOpen(false);
    setEditError(null);
  }, [isDeletingPin, isSubmittingEdit]);

  const handleEditFieldChange = useCallback(
    (field) => (event) => {
      const value = event?.target?.value ?? '';
      setEditForm((prev) => ({
        ...(prev || {}),
        [field]: value
      }));
    },
    []
  );

  const handleToggleAutoDelete = useCallback((event) => {
    const checked = Boolean(event?.target?.checked);
    setEditForm((prev) => ({
      ...(prev || {}),
      autoDelete: checked
    }));
  }, []);

  const handleEditStatusClose = useCallback(() => {
    setEditStatus(null);
  }, []);

  const handleSubmitEdit = useCallback(
    async (event) => {
      event.preventDefault();
      if (isDeletingPin) {
        return;
      }
      if (!pin || !editForm) {
        return;
      }
      if (isOffline) {
        setEditError('Reconnect to edit this pin.');
        return;
      }

      setEditError(null);

      const title = typeof editForm.title === 'string' ? editForm.title.trim() : '';
      if (!title) {
        setEditError('Title is required.');
        return;
      }

      const description = typeof editForm.description === 'string' ? editForm.description.trim() : '';
      if (!description) {
        setEditError('Description is required.');
        return;
      }

      const coordinatesArray = Array.isArray(pin?.coordinates?.coordinates)
        ? pin.coordinates.coordinates
        : [];
      const [longitudeRaw, latitudeRaw] = coordinatesArray;
      const latitude = Number(latitudeRaw);
      const longitude = Number(longitudeRaw);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setEditError('Pin coordinates are missing and cannot be updated.');
        return;
      }

      const radiusMeters = Number(editForm.proximityRadiusMeters);
      if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
        setEditError('Proximity radius must be a positive number.');
        return;
      }

      const payload = {
        type: pin.type,
        title,
        description,
        coordinates: {
          latitude,
          longitude
        },
        proximityRadiusMeters: Math.round(radiusMeters)
      };

      const rawCreatorId =
        typeof pin?.creatorId === 'string'
          ? pin.creatorId
          : typeof pin?.creatorId?._id === 'string'
          ? pin.creatorId._id
          : typeof pin?.creator?._id === 'string'
          ? pin.creator._id
          : null;
      if (rawCreatorId) {
        payload.creatorId = String(rawCreatorId);
      }

      const normalizedPhotos = Array.isArray(pin?.photos)
        ? pin.photos.map((asset) => normalizeMediaAssetForUpdate(asset)).filter(Boolean)
        : undefined;
      if (normalizedPhotos) {
        payload.photos = normalizedPhotos;
      }

      const normalizedCoverPhoto = normalizeMediaAssetForUpdate(pin?.coverPhoto);
      if (normalizedCoverPhoto) {
        payload.coverPhoto = normalizedCoverPhoto;
      }

      const normalizedType = typeof pin?.type === 'string' ? pin.type.toLowerCase() : '';

      if (normalizedType === 'event') {
        const startDate = parseDateInput(editForm.startDate);
        const endDate = parseDateInput(editForm.endDate);
        if (!startDate || !endDate) {
          setEditError('Start and end times are required for events.');
          return;
        }
        if (endDate <= startDate) {
          setEditError('End time must be after the start time.');
          return;
        }
        payload.startDate = startDate.toISOString();
        payload.endDate = endDate.toISOString();
        if (pin.address && typeof pin.address === 'object') {
          payload.address = {
            precise: pin.address.precise ?? undefined,
            components: pin.address.components ?? undefined
          };
        }
      } else {
        const expiresAt = parseDateInput(editForm.expiresAt);
        if (!expiresAt) {
          setEditError('Expiration time is required for discussions.');
          return;
        }
        payload.expiresAt = expiresAt.toISOString();
        payload.autoDelete = Boolean(editForm.autoDelete);
        if (pin.approximateAddress && typeof pin.approximateAddress === 'object') {
          payload.approximateAddress = { ...pin.approximateAddress };
        }
      }

      setIsSubmittingEdit(true);
      try {
        await updatePin(pin._id, payload);
        await reloadPin({ silent: true });
        setEditStatus({ type: 'success', message: 'Pin updated successfully.' });
        setIsEditDialogOpen(false);
      } catch (error) {
        setEditError(error?.message || 'Failed to update pin.');
      } finally {
        setIsSubmittingEdit(false);
      }
    },
    [editForm, isDeletingPin, isOffline, pin, reloadPin]
  );

  const handleDeletePin = useCallback(async () => {
    if (!pin?._id || !isOwnPin) {
      return;
    }
    if (isOffline) {
      setEditError('Reconnect to delete this pin.');
      return;
    }
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm('Delete this pin? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setIsDeletingPin(true);
    setEditError(null);
    try {
      await deletePin(pin._id);
      setIsEditDialogOpen(false);
      navigate(routes.list.base, { replace: true });
    } catch (error) {
      setEditError(error?.message || 'Failed to delete pin.');
    } finally {
      setIsDeletingPin(false);
    }
  }, [isOffline, isOwnPin, navigate, pin]);

  const handleOpenReportReply = useCallback((reply) => {
    if (!reply || !reply._id) {
      setReportStatus({ type: 'error', message: 'Unable to report this reply.' });
      return;
    }
    const summarySource = typeof reply.message === 'string' ? reply.message.trim() : '';
    const summary = summarySource.length > 140 ? `${summarySource.slice(0, 137).trimEnd()}…` : summarySource || 'Reply';
    const contextLabel = pin?.title ? `Pin: ${pin.title}` : 'Pin discussion';
    setReportTarget({
      contentType: 'reply',
      contentId: reply._id,
      summary,
      context: contextLabel
    });
    setReportReason('');
    setReportError(null);
    setReportDialogOpen(true);
  }, [pin]);

  const handleCloseReportDialog = useCallback(() => {
    if (isSubmittingReport) {
      return;
    }
    setReportDialogOpen(false);
    setReportTarget(null);
    setReportReason('');
    setReportError(null);
  }, [isSubmittingReport]);

  const handleSubmitReport = useCallback(async () => {
    if (!reportTarget?.contentType || !reportTarget?.contentId) {
      setReportError('Unable to submit this report.');
      return;
    }
    if (isSubmittingReport) {
      return;
    }
    setIsSubmittingReport(true);
    setReportError(null);
    try {
      await createContentReport({
        contentType: reportTarget.contentType,
        contentId: reportTarget.contentId,
        reason: reportReason.trim(),
        context: reportTarget.context || ''
      });
      setReportDialogOpen(false);
      setReportTarget(null);
      setReportReason('');
      setReportStatus({
        type: 'success',
        message: 'Thanks for the report. Our moderators will review it shortly.'
      });
    } catch (error) {
      setReportError(error?.message || 'Failed to submit report. Please try again later.');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [reportReason, reportTarget, isSubmittingReport]);

  const handleReportStatusClose = useCallback(() => {
    setReportStatus(null);
  }, []);

  const editDialogBusy = isSubmittingEdit || isDeletingPin;

  return (
    <div className={`pin-details ${themeClass}`}>
      {interactionOverlay ? (
        <div className="pin-expired-overlay" role="dialog" aria-modal="true">
          <div className="pin-expired-modal">
            <h3>{interactionOverlay.title}</h3>
            <p>{interactionOverlay.message}</p>
            <div className="expired-actions">
              <Link to={routes.list.base} className="expired-return-button">
                Return to List
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <header className="header">
        <button
          type="button"
          className="back-button"
          aria-label="Go back"
          onClick={handleBackNavigation}
        >
          <ArrowBackIosNewIcon className="back-arrow" aria-hidden="true" />
        </button>

        <h2>{pinTypeHeading}</h2>

        <div className="header-actions">
          {isOwnPin ? (
            <div className="edit-button-wrapper">
              <button
                className="edit-pin-button"
                type="button"
                onClick={handleOpenEditDialog}
                disabled={isOffline || !pin || isLoading || isSubmittingEdit || isDeletingPin}
                title={isOffline ? 'Reconnect to edit your pin' : 'Edit this pin'}
              >
                Edit
              </button>
            </div>
          ) : null}
          <div className="share-button-wrapper">
            <button
              className="share-button"
              type="button"
              onClick={() => handleSharePin()}
              disabled={isOffline || isSharing || !pin}
              aria-label="Share this pin"
              aria-busy={isSharing ? 'true' : 'false'}
              title={isOffline ? 'Reconnect to share pins' : 'Share pin link'}
            >
              <ShareOutlinedIcon fontSize="small" />
            </button>
          </div>
          <div className="bookmark-button-wrapper">
            <BookmarkButton
              bookmarked={bookmarked}
              pending={isUpdatingBookmark}
              disabled={isOffline || !pin || isInteractionLocked}
              ownsPin={isOwnPin}
              attending={attending}
              onToggle={handleToggleBookmark}
              disabledLabel={isOffline ? 'Reconnect to manage bookmarks' : undefined}
            />
            {bookmarkError ? <span className="error-text bookmark-error">{bookmarkError}</span> : null}
          </div>
        </div>
      </header>

      <div className="name">
        <h2>{pin ? pin.title || 'Untitled pin' : 'Loading pin...'}</h2>
        {pin?._id ? <span className="pin-id">ID: {pin._id}</span> : null}
        {proximityRadius ? <span className="pin-radius">Proximity radius: {proximityRadius}</span> : null}
        {viewerDistanceLabel ? (
          <span className="pin-radius">Approximate distance: {viewerDistanceLabel}</span>
        ) : null}
        {createdAtLabel || updatedAtLabel ? (
          <span className="pin-timestamps">
            {createdAtLabel ? `Created ${createdAtLabel}` : null}
            {createdAtLabel && updatedAtLabel ? ' | ' : null}
            {updatedAtLabel ? `Updated ${updatedAtLabel}` : null}
          </span>
        ) : null}
      </div>

      {pinErrorMessage ? (
        <div className="pin-error-banner">
          <Alert severity={pinErrorSeverity} variant="outlined">
            {pinErrorMessage}
          </Alert>
        </div>
      ) : null}

      {pin ? (
        <>
          <div className="map-section">
            {coordinates ? (
              <div className="map-wrapper">
                <LeafletMap
                  userLocation={coordinates}
                  pins={mapPins}
                  selectedPinId={mapPins[0]?._id ?? pin._id}
                  centerOverride={coordinates}
                />
                {coordinateLabel ? (
                  <span className="coordinate-label">Coords: {coordinateLabel}</span>
                ) : null}
              </div>
            ) : coverImageUrl ? (
              <img src={coverImageUrl} alt={`${pin.title ?? 'Pin'} cover`} className="cover-photo" />
            ) : (
              <div className="map-placeholder muted">No location data available for this pin.</div>
            )}
          </div>

          {creatorProfileLink ? (
            <Link
              to={creatorProfileLink.pathname}
              state={creatorProfileLink.state}
              className="post-creator user-link"
            >
              <img
                src={creatorAvatarUrl}
                className="profile-icon"
                alt={`${pin.creator?.displayName ?? 'Creator'} avatar`}
              />
              <div className="post-creator-details">
                <span className="creator-name">
                  {pin.creator?.displayName || pin.creator?.username || 'Unknown creator'}
                </span>
                {pin.creator?.username ? (
                  <span className="creator-username">@{pin.creator.username}</span>
                ) : null}
              </div>
            </Link>
          ) : (
            <div className="post-creator">
              <img
                src={creatorAvatarUrl}
                className="profile-icon"
                alt={`${pin.creator?.displayName ?? 'Creator'} avatar`}
              />
              <div className="post-creator-details">
                <span className="creator-name">
                  {pin.creator?.displayName || pin.creator?.username || 'Unknown creator'}
                </span>
                {pin.creator?.username ? (
                  <span className="creator-username">@{pin.creator.username}</span>
                ) : null}
              </div>
            </div>
          )}

          <div className="post-description">
            {pin.description ? pin.description : <span className="muted">No description provided.</span>}
          </div>

          <div className="post-images">
            {photoItems.length > 0 ? (
              <div className="photo-grid">
                {photoItems.map((photo, index) => (
                  <figure className="pin-photo-item" key={`${photo.url}-${index}`}>
                    <img
                      src={photo.url}
                      alt={photo.label ? `${photo.label}` : `Pin photo ${index + 1}`}
                      className="pin-photo"
                      loading="lazy"
                      onClick={() => setSelectedImage(photo.url)}
                      style={{ cursor: 'pointer' }}
                    />
                  </figure>
                ))}
              </div>
            ) : (
              <div className="muted">No photos uploaded for this pin.</div>
            )}
          </div>

          <ImageOverlay
            open={Boolean(selectedImage)}
            onClose={() => setSelectedImage(null)}
            imageSrc={selectedImage}
          />

          <div className="post-info">
            <div className="post-location">
              <svg className={`pin-icon ${isEventPin ? 'event-icon' : 'discussion-icon'}`} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 4.63 5.48 11.05 6.27 11.93a1 1 0 0 0 1.46 0C13.52 20.05 19 13.63 19 9a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                />
              </svg>
              <span className={`location-text ${isEventPin ? 'event-text' : 'discussion-text'}`}>
                Location:
                <br />
                {addressLabel || approximateAddressLabel || 'No address information available.'}
                {coordinateLabel ? (
                  <>
                    <br />
                    Coordinates: {coordinateLabel}
                  </>
                ) : null}
              </span>
            </div>

            <div className="post-occurance">
              <CalendarMonthIcon
                className={`calendar-icon ${isEventPin ? 'event-icon' : 'discussion-icon'}`}
                aria-hidden="true"
              />
              <span className={`occurance-text ${isEventPin ? 'event-text' : 'discussion-text'}`}>
                {isEventPin ? 'Occurs:' : 'Expires:'}
                <br />
                {isEventPin
                  ? eventDateRange || 'No schedule provided.'
                  : expirationLabel || 'No expiration set.'}
              </span>
            </div>

            <div className="post-attendance">
              <HowToRegIcon
                className={`attendance-icon ${isEventPin ? 'event-icon' : 'discussion-icon'}`}
                aria-hidden="true"
              />
              <span className={`attendance-text ${isEventPin ? 'event-text' : 'discussion-text'}`}>
                Bookmarks: {pin.bookmarkCount ?? 0}
                {isEventPin ? (
                  <>
                    <br />
                    Attending: {pin.participantCount ?? 0}
                    {pin.participantLimit ? ` / ${pin.participantLimit}` : ''}
                  </>
                ) : null}
              </span>
              {isEventPin && attendingFriendPreview.length > 0 ? (
                <div className="attending-friends-inline" aria-label="Friends attending this event">
                  {attendingFriendPreview.map((friend) => (
                    <AttendingFriendAvatar key={friend.key} attendee={friend} />
                  ))}
                  {extraFriendCount > 0 ? (
                    <span className="attending-friends-more" aria-label={`${extraFriendCount} more friends`}>
                      +{extraFriendCount}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {isEventPin ? (
                <button
                  type="button"
                  className="view-attendees-button"
                  onClick={openAttendeeOverlay}
                  disabled={isOffline || isInteractionLocked || (isLoadingAttendees && attendeeOverlayOpen)}
                  title={isOffline ? 'Reconnect to view attendees' : undefined}
                >
                  {isLoadingAttendees && attendeeOverlayOpen ? 'Loading attendees...' : 'View Attendees'}
                </button>
              ) : null}
            </div>
          </div>

          {isEventPin ? (
            <div className="attendance">
              <button
                className={`attend-button ${attending ? 'attending' : ''}`}
                onClick={handleToggleAttendance}
                disabled={isOffline || isUpdatingAttendance || !pin || isInteractionLocked}
                aria-busy={isUpdatingAttendance ? 'true' : 'false'}
                title={isOffline ? 'Reconnect to update attendance' : undefined}
              >
                {isUpdatingAttendance ? 'Updating...' : attending ? 'Attending!' : 'Attend'}
              </button>
              {attendanceError ? (
                <div className="error-text attendance-error">{attendanceError}</div>
              ) : null}
            </div>
          ) : null}

          <div className="comments-header">
            <ForumIcon className="comment-icon" aria-hidden="true" />
            <p>
              Comments (
              {isLoadingReplies ? '...' : replyCount}
              )
            </p>
          </div>

          <div className="comments-section">
            {isLoadingReplies ? <div className="muted">Loading replies...</div> : null}
            {repliesError ? <div className="error-text">{repliesError}</div> : null}
            {!isLoadingReplies && !repliesError && replyCount === 0 ? (
              <div className="muted">No replies yet.</div>
            ) : null}

            {replyItems.map((reply) => {
              const { _id, authorName, message, createdLabel, profileLink, avatarUrl, author } = reply;
              const authorUserId =
                resolveUserId(author?._id) ||
                resolveUserId(author?.id) ||
                resolveUserId(author?.userId) ||
                resolveUserId(author?.uid) ||
                resolveUserId(author?.username) ||
                resolveUserId(author?.email);
              const content = (
                <>
                  <img src={avatarUrl || undefined} className="commenter-pfp" alt={`${authorName} avatar`} />
                  <span className="commenter-info">
                    <strong>
                      {authorName}
                      <FriendBadge
                        userId={authorUserId}
                        size="0.9em"
                        className="comment-friend-badge"
                      />
                    </strong>
                    {createdLabel ? <span className="comment-timestamp">{createdLabel}</span> : null}
                  </span>
                </>
              );
              return (
                <div className="comment" key={_id}>
                  {profileLink ? (
                    <Link
                      to={profileLink.pathname}
                      state={profileLink.state}
                      className="comment-header user-link"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="comment-header">{content}</div>
                  )}
                  <div className="comment-body">
                    <p>{message}</p>
                    <button
                      type="button"
                      className="comment-report-btn"
                      onClick={() => handleOpenReportReply(reply)}
                      disabled={isOffline}
                      aria-label="Report this reply"
                      title={isOffline ? 'Reconnect to submit a report' : 'Report this reply'}
                    >
                      Report
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="create-comment"
            disabled={isOffline || isInteractionLocked}
            onClick={openReplyComposer}
            aria-label="Create reply"
            title={isOffline ? 'Reconnect to add a reply' : undefined}
          >
            <AddCommentIcon className="create-comment-button" aria-hidden="true" />
          </button>
        </>
      ) : null}

      {shouldShowStatusMessages ? (
        <div className="status-container status-container--footer">
          {isLoading ? <div className="status-message">Loading pin details...</div> : null}
          {pinErrorMessage ? <div className="status-message error">{pinErrorMessage}</div> : null}
          {!pin && !isLoading && !pinErrorMessage && pinId ? (
            <div className="status-message">No pin found for ID &ldquo;{pinId}&rdquo;.</div>
          ) : null}
        </div>
      ) : null}

      {replyComposerOpen ? (
        <div className="reply-overlay">
          <div className="reply-overlay-backdrop" onClick={closeReplyComposer} aria-hidden="true" />
          <div className="reply-overlay-content" role="dialog" aria-modal="true" aria-label="Create reply">
            <div className="reply-overlay-header">
              <h3>Add a Reply</h3>
              <button
                type="button"
                className="reply-overlay-close"
                onClick={closeReplyComposer}
                disabled={isSubmittingReply || isInteractionLocked}
              >
                Cancel
              </button>
            </div>
            <div className="reply-overlay-body">
              <label htmlFor="reply-message" className="reply-overlay-label">
                Share your thoughts
              </label>
              <textarea
                id="reply-message"
                className="reply-overlay-textarea"
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                placeholder="Type your reply here..."
                maxLength={4000}
                disabled={isOffline || isSubmittingReply || isInteractionLocked}
              />
              <div className="reply-overlay-footer">
                <span className="reply-overlay-count">{replyMessage.length}/4000</span>
                <button
                  type="button"
                  className="reply-overlay-submit"
                  onClick={handleSubmitReply}
                  disabled={isOffline || isSubmittingReply || isInteractionLocked}
                  title={isOffline ? 'Reconnect to post a reply' : undefined}
                >
                  {isSubmittingReply ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
              {submitReplyError ? <div className="error-text">{submitReplyError}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {attendeeOverlayOpen ? (
        <div className="attendee-overlay">
          <div className="attendee-overlay-backdrop" onClick={closeAttendeeOverlay} aria-hidden="true" />
          <div className="attendee-overlay-content" role="dialog" aria-modal="true" aria-label="Event attendees">
            <div className="attendee-overlay-header">
              <h3>Event Attendees</h3>
              <button type="button" className="attendee-overlay-close" onClick={closeAttendeeOverlay}>
                Close
              </button>
            </div>
            <div className="attendee-overlay-body">
              {isLoadingAttendees ? (
                <div className="muted">Loading attendees...</div>
              ) : attendeesError ? (
                <div className="error-text">{attendeesError}</div>
              ) : attendeeItems.length === 0 ? (
                <div className="muted">No attendees yet.</div>
              ) : (
                <ul className="attendee-list">
                  {attendeeItems.map((attendee) => {
                    const { key, name, avatar, link } = attendee;
                    const content = (
                      <>
                        <img src={avatar || undefined} alt={`${name} avatar`} className="attendee-avatar" />
                        <span className="attendee-name">{name}</span>
                      </>
                    );
                    return (
                      <li key={key}>
                        {link ? (
                          <Link
                            to={link.pathname}
                            state={link.state}
                            className="attendee-list-item user-link"
                            onClick={closeAttendeeOverlay}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className="attendee-list-item">{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={isEditDialogOpen}
        onClose={handleCloseEditDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby="edit-pin-dialog-title"
      >
        <form onSubmit={handleSubmitEdit}>
          <DialogTitle id="edit-pin-dialog-title">Edit {pinTypeHeading}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {editError ? <Alert severity="error">{editError}</Alert> : null}
              <TextField
                label="Title"
                value={editForm?.title ?? ''}
                onChange={handleEditFieldChange('title')}
                required
                disabled={editDialogBusy}
              />
              <TextField
                label="Description"
                value={editForm?.description ?? ''}
                onChange={handleEditFieldChange('description')}
                required
                multiline
                minRows={3}
                disabled={editDialogBusy}
              />
              <TextField
                label="Proximity radius (meters)"
                type="number"
                value={editForm?.proximityRadiusMeters ?? ''}
                onChange={handleEditFieldChange('proximityRadiusMeters')}
                inputProps={{ min: 1, step: 1 }}
                required
                disabled={editDialogBusy}
              />
              {isEventPin ? (
                <>
                  <TextField
                    label="Start time"
                    type="datetime-local"
                    value={editForm?.startDate ?? ''}
                    onChange={handleEditFieldChange('startDate')}
                    InputLabelProps={{ shrink: true }}
                    required
                    disabled={editDialogBusy}
                  />
                  <TextField
                    label="End time"
                    type="datetime-local"
                    value={editForm?.endDate ?? ''}
                    onChange={handleEditFieldChange('endDate')}
                    InputLabelProps={{ shrink: true }}
                    required
                    disabled={editDialogBusy}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="Expires at"
                    type="datetime-local"
                    value={editForm?.expiresAt ?? ''}
                    onChange={handleEditFieldChange('expiresAt')}
                    InputLabelProps={{ shrink: true }}
                    required
                    disabled={editDialogBusy}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(editForm?.autoDelete)}
                        onChange={handleToggleAutoDelete}
                        disabled={editDialogBusy}
                      />
                    }
                    label="Automatically remove when expired"
                  />
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            {isOwnPin ? (
              <>
                <Button color="error" onClick={handleDeletePin} disabled={editDialogBusy}>
                  {isDeletingPin ? 'Deleting…' : 'Delete pin'}
                </Button>
                <Box sx={{ flexGrow: 1 }} />
              </>
            ) : null}
            <Button onClick={handleCloseEditDialog} disabled={editDialogBusy}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={editDialogBusy}>
              {isSubmittingEdit ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <ReportContentDialog
        open={reportDialogOpen}
        onClose={handleCloseReportDialog}
        onSubmit={handleSubmitReport}
        reason={reportReason}
        onReasonChange={setReportReason}
        submitting={isSubmittingReport}
        error={reportError}
        contentSummary={reportTarget?.summary || ''}
        context={reportTarget?.context || ''}
      />

      <Snackbar
        open={Boolean(editStatus)}
        autoHideDuration={3500}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          handleEditStatusClose();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {editStatus ? (
          <Alert
            elevation={6}
            variant="filled"
            severity={editStatus.type || 'success'}
            onClose={handleEditStatusClose}
          >
            {editStatus.message}
          </Alert>
        ) : null}
      </Snackbar>

      <Snackbar
        open={Boolean(reportStatus)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          handleReportStatusClose();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {reportStatus ? (
          <Alert
            elevation={6}
            variant="filled"
            severity={reportStatus.type}
            onClose={handleReportStatusClose}
          >
            {reportStatus.message}
          </Alert>
        ) : null}
      </Snackbar>

      <Snackbar
        open={Boolean(shareStatus)}
        autoHideDuration={3000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setShareStatus(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {shareStatus ? (
          <Alert
            elevation={6}
            variant="filled"
            severity={shareStatus.type || 'info'}
            onClose={() => setShareStatus(null)}
          >
            {shareStatus.message}
          </Alert>
        ) : null}
      </Snackbar>
    </div>
  );
}

function AttendingFriendAvatar({ attendee }) {
  const userId =
    resolveUserId(attendee?._id) ||
    resolveUserId(attendee?.id) ||
    resolveUserId(attendee?.userId) ||
    resolveUserId(attendee?.uid) ||
    resolveUserId(attendee?.username) ||
    resolveUserId(attendee?.email);

  if (!userId) {
    return null;
  }

  const avatarNode = (
    <div className="attending-friend-avatar" title={`${attendee.name || 'Friend'} is attending`}>
      <img src={attendee.avatar || undefined} alt={`${attendee.name || 'Friend'} avatar`} />
      <FriendBadge userId={userId} size="0.75em" className="attending-friend-avatar__badge" />
    </div>
  );

  if (attendee.link) {
    return (
      <Link
        to={attendee.link.pathname}
        state={attendee.link.state}
        className="attending-friend-link"
      >
        {avatarNode}
      </Link>
    );
  }

  return (
    <div className="attending-friend-link">
      {avatarNode}
    </div>
  );
}

export default PinDetails;
