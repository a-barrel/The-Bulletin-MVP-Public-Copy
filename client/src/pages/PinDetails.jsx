/* NOTE: Page exports configuration alongside the component. */
import React, { useCallback, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import './PinDetails.css';
import { Alert, Snackbar } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place'; // used only for pageConfig
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AddCommentIcon from '@mui/icons-material/AddComment';
import FriendBadge from '../components/FriendBadge';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import { useSocialNotificationsContext } from '../contexts/SocialNotificationsContext';
import useViewerProfile from '../hooks/useViewerProfile';
import usePinDetails from '../hooks/usePinDetails';
import ReportContentDialog from '../components/ReportContentDialog';
import { flagPinForModeration } from '../api';
import ImageOverlay from '../components/ImageOverlay.jsx';
import canAccessModerationTools from '../utils/accessControl';
import usePinReporting from '../hooks/pin/usePinReporting';
import usePinAnalytics from '../hooks/pin/usePinAnalytics';
import usePinEditForm from '../hooks/pin/usePinEditForm';
import PinEditDialog from '../components/pin/PinEditDialog';
import { usePinCache } from '../contexts/PinCacheContext';
import HeaderActions from './pinDetails/HeaderActions';
import MapSection from './pinDetails/MapSection';
import AnalyticsCard from './pinDetails/AnalyticsCard';
import CommentsSection from './pinDetails/CommentsSection';
import {
  ANALYTICS_SPARKLINE_HEIGHT,
  ANALYTICS_SPARKLINE_WIDTH,
  BROKEN_TEXTURE_PIN_ID,
  EXPIRED_PIN_ID,
  FAR_PIN_ID,
  formatAnalyticsTimestamp,
  MAX_PHOTO_PIN_ID,
  NO_IMAGE_PIN_ID,
  promptNavTarget,
  resolveUserId,
  SAMPLE_PIN_IDS
} from './pinDetails/utils';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: true,
  resolveNavTarget: ({ currentPath } = {}) => promptNavTarget({ currentPath, routes })
};

function PinDetails() {
  const { pinId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { viewer: viewerProfile } = useViewerProfile({ enabled: !isOffline, skip: isOffline });
  const pinCache = usePinCache();

  const {
    pin,
    viewState,
    bookmarkState,
    attendanceState,
    replyState,
    attendeeState,
    shareState,
    status,
    reloadPin
  } = usePinDetails({ pinId, location, isOffline, initialPin: pinCache.getPin(pinId) });
  const {
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
    creatorAvatarUrl
  } = viewState;
  const creatorDisplayName = pin?.creator?.displayName || pin?.creator?.username || 'Creator';
  const {
    bookmarked,
    isUpdating: isUpdatingBookmark,
    error: bookmarkError,
    toggle: handleToggleBookmark
  } = bookmarkState;
  const {
    attending,
    isUpdating: isUpdatingAttendance,
    error: attendanceError,
    toggle: handleToggleAttendance
  } = attendanceState;
  const {
    items: replyItems,
    count: replyCount,
    isLoading: isLoadingReplies,
    error: repliesError,
    composerOpen: replyComposerOpen,
    openComposer: openReplyComposer,
    closeComposer: closeReplyComposer,
    message: replyMessage,
    setMessage: setReplyMessage,
    isSubmitting: isSubmittingReply,
    submitError: submitReplyError,
    submit: handleSubmitReply
  } = replyState;
  const {
    items: attendeeItems,
    overlayOpen: attendeeOverlayOpen,
    openOverlay: openAttendeeOverlay,
    closeOverlay: closeAttendeeOverlay,
    isLoading: isLoadingAttendees,
    error: attendeesError
  } = attendeeState;
  const {
    status: shareStatus,
    setStatus: setShareStatus,
    isSharing,
    share: handleSharePin
  } = shareState;
  const { isLoading, error } = status;
  const socialNotifications = useSocialNotificationsContext();
  const replyLimit = typeof pin?.replyLimit === 'number' ? pin.replyLimit : null;
  const hasReachedReplyLimit =
    replyLimit !== null && !isLoadingReplies && replyCount >= replyLimit;
  const commentsLabel = isLoadingReplies
    ? '...'
    : replyLimit !== null
    ? `${replyCount} / ${replyLimit}`
    : replyCount;

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

  const isHostLike = Boolean(pin?.viewerOwnsPin || pin?.viewerIsCreator || pin?.isSelf);
  const showAnalytics = isEventPin && isHostLike;
  const { analytics, analyticsError, analyticsLoading } = usePinAnalytics({
    pinId,
    pin,
    showAnalytics,
    isHostLike,
    isOffline
  });

  const analyticsSeries = useMemo(() => analytics?.series || [], [analytics]);
  const analyticsTotals = useMemo(() => analytics?.totals || {}, [analytics]);
  const analyticsMilestones = useMemo(() => analytics?.milestones || {}, [analytics]);
  const analyticsBuckets = useMemo(() => analytics?.hourlyBuckets || [], [analytics]);

  const analyticsSparklinePoints = useMemo(() => {
    if (!analyticsSeries.length) {
      return null;
    }
    const minValue = Math.min(0, ...analyticsSeries.map((entry) => entry.cumulative ?? 0));
    const maxValue = Math.max(1, ...analyticsSeries.map((entry) => entry.cumulative ?? 0));
    const range = Math.max(1, maxValue - minValue);
    const lastIndex = Math.max(analyticsSeries.length - 1, 1);
    return analyticsSeries
      .map((entry, index) => {
        const x = (index / lastIndex) * ANALYTICS_SPARKLINE_WIDTH;
        const y =
          ANALYTICS_SPARKLINE_HEIGHT -
          ((Number(entry.cumulative ?? 0) - minValue) / range) * ANALYTICS_SPARKLINE_HEIGHT;
        return `${x},${y}`;
      })
      .join(' ');
  }, [analyticsSeries]);

  const maxAnalyticsBucketTotal = useMemo(() => {
    if (!analyticsBuckets.length) {
      return 0;
    }
    return Math.max(
      ...analyticsBuckets.map((bucket) => (bucket.join ?? 0) + (bucket.leave ?? 0)),
      0
    );
  }, [analyticsBuckets]);

  const themeClass = isEventPin ? 'event-mode' : 'discussion-mode';
  const pinErrorMessage = typeof error === 'string' ? error : error?.message;
  const pinErrorSeverity = error?.isAuthError ? 'warning' : 'error';
  const shouldShowStatusMessages =
    isLoading || Boolean(pinErrorMessage) || (!pin && !isLoading && pinId);
  const isPinFlagged = pin?.moderation?.status === 'flagged';
  const flaggedReason =
    typeof pin?.moderation?.flaggedReason === 'string' && pin.moderation.flaggedReason
      ? pin.moderation.flaggedReason
      : null;
  const {
    reportDialogOpen,
    reportTarget,
    reportReason,
    reportSelectedOffenses,
    reportError,
    isSubmittingReport,
    reportStatus,
    openReportDialog,
    closeReportDialog,
    toggleReportOffense,
    submitReport,
    setReportReason,
    setReportStatus
  } = usePinReporting();
  const {
    isEditDialogOpen,
    editForm,
    setEditForm,
    editError,
    editStatus,
    setEditStatus,
    editDialogBusy,
    handleOpenEditDialog,
    handleCloseEditDialog,
    handleSubmitEdit,
    handleDeletePin
  } = usePinEditForm({ pin, pinId, isOffline, reloadPin });
  const [selectedImage, setSelectedImage] = useState(null);
  const [isFlaggingPin, setIsFlaggingPin] = useState(false);
  const [flagStatus, setFlagStatus] = useState(null);

  const handleEditStatusClose = useCallback(() => {
    setEditStatus(null);
  }, [setEditStatus]);

  const handleFlagPin = useCallback(async () => {
    if (!pin?._id || isFlaggingPin || isPinFlagged) {
      return;
    }
    if (isOffline) {
      setFlagStatus({ type: 'warning', message: 'Reconnect to flag this pin.' });
      return;
    }
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm('Flag this pin for deletion? Moderators will review it shortly.');
    if (!confirmed) {
      return;
    }

    const providedReason =
      typeof window !== 'undefined' && typeof window.prompt === 'function'
        ? window.prompt('Reason for flagging (optional)', flaggedReason || '')
        : '';
    const trimmedReason =
      providedReason && providedReason.trim().length ? providedReason.trim() : undefined;

    setIsFlaggingPin(true);
    setFlagStatus(null);
    try {
      await flagPinForModeration(pin._id, { reason: trimmedReason });
      setFlagStatus({ type: 'success', message: 'Pin flagged for moderator review.' });
      await reloadPin({ silent: true });
    } catch (error) {
      setFlagStatus({
        type: 'error',
        message: error?.message || 'Failed to flag pin.'
      });
    } finally {
      setIsFlaggingPin(false);
    }
  }, [flaggedReason, isFlaggingPin, isOffline, isPinFlagged, pin, reloadPin]);

  const handleOpenReportReply = useCallback((reply) => {
    if (!reply || !reply._id) {
      setReportStatus({ type: 'error', message: 'Unable to report this reply.' });
      return;
    }
    const summarySource = typeof reply.message === 'string' ? reply.message.trim() : '';
    const summary = summarySource.length > 140 ? `${summarySource.slice(0, 137).trimEnd()}…` : summarySource || 'Reply';
    const contextLabel = pin?.title ? `Pin: ${pin.title}` : 'Pin discussion';
    openReportDialog({
      contentType: 'reply',
      contentId: reply._id,
      summary,
      context: contextLabel
    });
  }, [openReportDialog, pin, setReportStatus]);

  const handleCloseReportDialog = useCallback(() => {
    closeReportDialog();
  }, [closeReportDialog]);

  const handleToggleReportOffense = useCallback((offense, checked) => {
    toggleReportOffense(offense, checked);
  }, [toggleReportOffense]);

  const handleSubmitReport = useCallback(async () => {
    await submitReport();
  }, [submitReport]);

  const handleReportStatusClose = useCallback(() => {
    setReportStatus(null);
  }, []);

  const currentUserId = useMemo(
    () =>
      resolveUserId(
        viewerProfile?._id ||
          viewerProfile?.id ||
          viewerProfile?.uid ||
          viewerProfile?.userId ||
          viewerProfile?.email ||
          viewerProfile?.username
      ),
    [viewerProfile]
  );

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

      <HeaderActions
        isOwnPin={isOwnPin}
        isOffline={isOffline}
        pin={pin}
        isLoading={isLoading}
        editDialogBusy={editDialogBusy}
        handleOpenEditDialog={handleOpenEditDialog}
        pinFlagProps={
          pin?.viewerIsModerator && !isOwnPin
            ? {
                allowFlag: true,
                isFlagged: isPinFlagged,
                onFlag: handleFlagPin,
                disabled: isOffline || !pin || isFlaggingPin || isPinFlagged,
                title: isPinFlagged
                  ? flaggedReason
                    ? `Flagged: ${flaggedReason}`
                    : 'This pin has been flagged for removal.'
                  : isOffline
                  ? 'Reconnect to flag pins'
                  : 'Flag this pin for moderator review',
                label: isPinFlagged ? 'Flagged' : isFlaggingPin ? 'Flagging…' : 'Flag',
                pinTypeHeading
              }
            : { pinTypeHeading }
        }
        onShare={handleSharePin}
        onReportPin={() => {
          if (!pin?._id) return;
          openReportDialog({
            contentType: 'pin',
            contentId: pin._id,
            summary: pin.title || 'Pin',
            context: pin.title ? `Pin: ${pin.title}` : 'Pin details'
          });
        }}
        shareBusy={isSharing}
        bookmarked={bookmarked}
        bookmarkPending={isUpdatingBookmark}
        isInteractionLocked={isInteractionLocked}
        attending={attending}
        onToggleBookmark={handleToggleBookmark}
        bookmarkError={bookmarkError}
      />

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
      {isPinFlagged ? (
        <div className="pin-flagged-banner">
          <Alert severity="warning" variant="outlined">
            This pin has been flagged for removal{flaggedReason ? `: ${flaggedReason}` : '.'}
          </Alert>
        </div>
      ) : null}

      {pin ? (
        <>
          <MapSection
            coordinates={coordinates}
            mapPins={mapPins}
            pinId={pin?._id}
            creatorAvatarUrl={creatorAvatarUrl}
            creatorDisplayName={creatorDisplayName}
            coordinateLabel={coordinateLabel}
            coverImageUrl={coverImageUrl}
          />

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

          <AnalyticsCard
            showAnalytics={showAnalytics}
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            analyticsError={analyticsError}
            analyticsTotals={analyticsTotals}
            analyticsMilestones={analyticsMilestones}
            analyticsSparklinePoints={analyticsSparklinePoints}
            analyticsBuckets={analyticsBuckets}
            maxAnalyticsBucketTotal={maxAnalyticsBucketTotal}
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
                    <br />
                    {isEventPin && attendingFriendPreview.length > 0 ? (
                      <div className="attending-friends-container" aria-label="Friends attending this event">
                        <span className="friends-label">Friends:</span>
                        <div className="attending-friends-inline scrollable">
                          {attendingFriendPreview.map((friend) => (
                            <AttendingFriendAvatar key={friend.key} attendee={friend} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </span>
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

          <CommentsSection
            replyItems={replyItems}
            replyCount={replyCount}
            commentsLabel={commentsLabel}
            isLoadingReplies={isLoadingReplies}
            repliesError={repliesError}
            hasReachedReplyLimit={hasReachedReplyLimit}
            isOffline={isOffline}
            currentUserId={currentUserId}
            onOpenReport={handleOpenReportReply}
            onOpenComposer={openReplyComposer}
            isInteractionLocked={isInteractionLocked}
          />

          <button
            className="create-comment"
            disabled={isOffline || isInteractionLocked || hasReachedReplyLimit}
            onClick={openReplyComposer}
            aria-label="Create reply"
            title={
              isOffline
                ? 'Reconnect to add a reply'
                : hasReachedReplyLimit
                ? 'Reply limit reached for this discussion'
                : undefined
            }
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
                        <div className="attendee-avatar-wrapper">
                          <img
                            src={avatar || undefined}
                            alt={`${name} avatar`}
                            className="attendee-avatar"
                          />

                          <FriendBadge
                            userId={attendee.userId || attendee._id || attendee.id}
                            size="0.9em"
                            className="attendee-avatar-badge"
                          />
                        </div>

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

      <PinEditDialog
        open={isEditDialogOpen}
        onClose={handleCloseEditDialog}
        onSubmit={handleSubmitEdit}
        onDelete={handleDeletePin}
        editForm={editForm}
        onChange={setEditForm}
        editError={editError}
        editDialogBusy={editDialogBusy}
      />

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
        selectedReasons={reportSelectedOffenses}
        onToggleReason={handleToggleReportOffense}
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
        open={Boolean(flagStatus)}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setFlagStatus(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {flagStatus ? (
          <Alert
            elevation={6}
            variant="filled"
            severity={flagStatus.type}
            onClose={() => setFlagStatus(null)}
          >
            {flagStatus.message}
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
