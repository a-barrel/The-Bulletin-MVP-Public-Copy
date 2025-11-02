/* NOTE: Page exports configuration alongside the component. */
import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import './PinDetails.css';
import PlaceIcon from '@mui/icons-material/Place'; // used only for pageConfig
import LeafletMap from '../components/Map';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import usePinDetails from '../hooks/usePinDetails';

const EXPIRED_PIN_ID = '68e061721329566a22d47fff';
const SAMPLE_PIN_IDS = [
  '68e061721329566a22d474aa',
  '68e061721329566a22d474ab',
  '68e061721329566a22d474ac'
];
const FAR_PIN_ID = SAMPLE_PIN_IDS[0] ?? '68e061721329566a22d474aa';

export const pageConfig = {
  id: 'pin-details',
  label: 'Pin Details',
  icon: PlaceIcon,
  path: '/pin/:pinId',
  order: 3,
  showInNav: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    const input = window.prompt(
      'Enter a pin ID to view (type "expired" for an expired preview, type "far" to preview a pin outside your interaction radius, leave blank for a random sample, cancel to stay put):'
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
    if (!trimmed) {
      const randomId =
        SAMPLE_PIN_IDS[Math.floor(Math.random() * SAMPLE_PIN_IDS.length)] ?? '68e061721329566a22d474aa';
      return routes.pin.byId(randomId);
    }
    return routes.pin.byId(trimmed);
  }
};

function PinDetails() {
  const { pinId } = useParams();
  const location = useLocation();
  const { isOffline } = useNetworkStatusContext();

  const {
    pin,
    isEventPin,
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
    attendeeItems,
    attendeeOverlayOpen,
    openAttendeeOverlay,
    closeAttendeeOverlay,
    isLoadingAttendees,
    attendeesError
  } = usePinDetails({ pinId, location, isOffline });

  const themeClass = isEventPin ? 'event-mode' : 'discussion-mode';

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
        <Link to={routes.list.base} className="back-button">
          <img
            src="https://www.svgrepo.com/show/326886/arrow-back-sharp.svg"
            className="back-arrow"
            alt="Back"
          />
        </Link>

        <h2>{pinTypeHeading}</h2>

        <div className="bookmark-button-wrapper">
          <button
            className="bookmark-button"
            onClick={handleToggleBookmark}
            disabled={isOffline || isUpdatingBookmark || !pin || isInteractionLocked}
            aria-pressed={bookmarked ? 'true' : 'false'}
            aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
            aria-busy={isUpdatingBookmark ? 'true' : 'false'}
            title={isOffline ? 'Reconnect to manage bookmarks' : undefined}
          >
            <img
              src={
                bookmarked
                  ? 'https://www.svgrepo.com/show/347684/bookmark-fill.svg'
                  : 'https://www.svgrepo.com/show/357397/bookmark-full.svg'
              }
              className="bookmark"
              alt={bookmarked ? 'Bookmarked' : 'Bookmark icon'}
            />
          </button>
          {bookmarkError ? <span className="error-text bookmark-error">{bookmarkError}</span> : null}
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

      <div className="status-container">
        {isLoading ? <div className="status-message">Loading pin details...</div> : null}
        {error ? <div className="status-message error">{error}</div> : null}
        {!pin && !isLoading && !error && pinId ? (
          <div className="status-message">No pin found for ID &ldquo;{pinId}&rdquo;.</div>
        ) : null}
      </div>

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
                    />
                    {photo.label ? <figcaption>{photo.label}</figcaption> : null}
                  </figure>
                ))}
              </div>
            ) : (
              <div className="muted">No photos uploaded for this pin.</div>
            )}
          </div>

          <div className="post-info">
            <div className="post-location">
              <svg className="pin-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a7 7 0 0 0-7 7c0 4.63 5.48 11.05 6.27 11.93a1 1 0 0 0 1.46 0C13.52 20.05 19 13.63 19 9a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                />
              </svg>
              <span className="location-text">
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
              <img
                src="https://www.svgrepo.com/show/533378/calendar.svg"
                className="calendar-icon"
                alt="Calendar icon"
              />
              <span className="occurance-text">
                {isEventPin ? 'Occurs:' : 'Expires:'}
                <br />
                {isEventPin
                  ? eventDateRange || 'No schedule provided.'
                  : expirationLabel || 'No expiration set.'}
              </span>
            </div>

            <div className="post-attendance">
              <img
                src="https://www.svgrepo.com/show/511192/user-check.svg"
                className="attendance-icon"
                alt="Attendance icon"
              />
              <span className="attendance-text">
                Bookmarks: {pin.bookmarkCount ?? 0}
                {isEventPin ? (
                  <>
                    <br />
                    Attending: {pin.participantCount ?? 0}
                    {pin.participantLimit ? ` / ${pin.participantLimit}` : ''}
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

          <div className="comments-header">
            <img
              src="https://www.svgrepo.com/show/361088/comment-discussion.svg"
              className="comment-icon"
              alt="Comments icon"
            />
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
              const { _id, authorName, message, createdLabel, profileLink, avatarUrl } = reply;
              const content = (
                <>
                  <img src={avatarUrl || undefined} className="commenter-pfp" alt={`${authorName} avatar`} />
                  <span className="commenter-info">
                    <strong>{authorName}</strong>
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
            <img
              src="https://www.svgrepo.com/show/489238/add-comment.svg"
              className="create-comment-button"
              alt="Create comment button"
            />
          </button>
        </>
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
    </div>
  );
}

export default PinDetails;
