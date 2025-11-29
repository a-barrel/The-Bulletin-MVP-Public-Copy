/* NOTE: Page exports configuration alongside the component. */
import { useCallback, useId, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import MapIcon from '@mui/icons-material/Map';
import EventNoteIcon from '@mui/icons-material/EventNote';

import { routes } from '../routes';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useNavOverlay } from '../contexts/NavOverlayContext';
import useCreatePinForm from '../hooks/useCreatePinForm';
import normalizeObjectId from '../utils/normalizeObjectId';
import './CreatePinPage.css';
import PageNavHeader from '../components/PageNavHeader';
import resolveAssetUrl from '../utils/media';
import { haversineDistanceMeters, formatDistanceMiles, formatDistanceMetersLabel } from '../utils/geo';
import SelectableLocationMap from '../components/create-pin/SelectableLocationMap';
import useViewerProfile from '../hooks/useViewerProfile';
import PinPreviewCard from '../components/PinPreviewCard';
import CREATE_PIN_TEMPLATE from '../constants/createPinTemplate';

export const pageConfig = {
  id: 'create-pin',
  label: 'Create Pin',
  icon: AddLocationAltIcon,
  path: '/create-pin',
  order: 5,
  protected: true,
  showInNav: true
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const DEFAULT_MAP_CENTER = {
  lat: 33.7838,
  lng: -118.1136
};

const DEFAULT_AVATAR_PATH = '/images/profile/profile-01.jpg';

const FIGMA_TEMPLATE = CREATE_PIN_TEMPLATE;

const PIN_TYPE_LABELS = {
  event: 'Event',
  discussion: 'Discussion'
};

const EVENT_ATTENDEE_LIMITS = {
  min: 5,
  max: 100,
  defaultValue: 30
};

const DISCUSSION_REPLY_LIMIT_OPTIONS = [50, 75, 100, 150, 200];

function CreatePinPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: viewerLocation } = useLocationContext();
  const { announceBadgeEarned } = useBadgeSound();
  const { handleBack: overlayBack, previousNavPath, previousNavPage } = useNavOverlay();
  const { viewer: viewerProfile } = useViewerProfile({ enabled: !isOffline, skip: isOffline });

  const viewerDisplayName = useMemo(() => {
    if (viewerProfile?.displayName) {
      return viewerProfile.displayName;
    }
    if (viewerProfile?.username) {
      return viewerProfile.username;
    }
    return 'You';
  }, [viewerProfile]);

  const viewerAvatarUrl = useMemo(() => {
    if (!viewerProfile) {
      return DEFAULT_AVATAR_PATH;
    }
    const avatarSource = viewerProfile.avatar || viewerProfile.profile?.avatar;
    const resolved = resolveAssetUrl(avatarSource, { fallback: DEFAULT_AVATAR_PATH });
    return resolved || DEFAULT_AVATAR_PATH;
  }, [viewerProfile]);

  const handlePinCreated = useCallback(
    (pin) => {
      const candidate = pin?._id ?? pin?.id ?? pin;
      const resolvedId = normalizeObjectId(candidate);
      if (resolvedId) {
        navigate(routes.pin.byId(resolvedId), { state: { pin } });
      }
    },
    [navigate]
  );

  const {
    pinType,
    activeTheme,
    eventHeaderSubtitle,
    formState,
    autoDelete,
    setAutoDelete,
    isSubmitting,
    status,
    clearStatus,
    draftStatus,
    clearDraftStatus,
    resultJson,
    photoAssets,
    coverPhotoId,
    isUploading,
    uploadStatus,
    clearUploadStatus,
    isReverseGeocoding,
    locationStatus,
    clearLocationStatus,
    selectedCoordinates,
    viewerMapAnchor,
    eventStartMinInput,
    eventStartMaxInput,
    eventEndMinInput,
    discussionMinInput,
    discussionMaxInput,
    handleTypeChange,
    handleFieldChange,
    handleMapLocationSelect,
    handleImageSelection,
    handleRemovePhoto,
    handleSetCoverPhoto,
    handleSaveDraft,
    resetForm,
    handleSubmit
  } = useCreatePinForm({
    isOffline,
    viewerLocation,
    announceBadgeEarned,
    onPinCreated: handlePinCreated
  });

  const pinDistanceMeters = useMemo(() => {
    if (!viewerMapAnchor || !selectedCoordinates) {
      return null;
    }
    return haversineDistanceMeters(
      {
        latitude: viewerMapAnchor.lat,
        longitude: viewerMapAnchor.lng
      },
      {
        latitude: selectedCoordinates.lat,
        longitude: selectedCoordinates.lng
      }
    );
  }, [selectedCoordinates, viewerMapAnchor]);

  const pinDistanceLabel = useMemo(() => {
    if (!Number.isFinite(pinDistanceMeters) || pinDistanceMeters === null) {
      return null;
    }
    const milesLabel = formatDistanceMiles(pinDistanceMeters, { decimals: 2 });
    const metersLabel = formatDistanceMetersLabel(pinDistanceMeters);
    if (milesLabel && metersLabel) {
      return `${milesLabel} mi (${metersLabel})`;
    }
    return milesLabel || metersLabel || null;
  }, [pinDistanceMeters]);

  const backButtonLabel = previousNavPage?.label ? `Back to ${previousNavPage.label}` : 'Back';
  const handleHeaderBack = useCallback(() => {
    if (previousNavPath) {
      overlayBack();
      return;
    }
    navigate(-1);
  }, [navigate, overlayBack, previousNavPath]);

  const titleInputId = useId();
  const descriptionInputId = useId();
  const startDateInputId = useId();
  const endDateInputId = useId();
  const expiresAtInputId = useId();
  const latitudeInputId = useId();
  const longitudeInputId = useId();
  const radiusInputId = useId();
  const participantLimitInputId = useId();
  const addressPreciseInputId = useId();
  const addressCityInputId = useId();
  const addressStateInputId = useId();
  const addressPostalInputId = useId();
  const addressCountryInputId = useId();
  const approxFormattedInputId = useId();
  const approxCityInputId = useId();
  const approxStateInputId = useId();
  const approxCountryInputId = useId();
  const autoDeleteInputId = useId();
  const replyLimitInputId = useId();
  const headerTitle = PIN_TYPE_LABELS[pinType] ?? FIGMA_TEMPLATE.header.title;

  return (
    <div className="create-pin-page">
      <div className={`create-pin ${pinType === 'event' ? 'bg-event' : 'bg-discussion'}`}>
        <PageNavHeader
          title={headerTitle}
          backAriaLabel={backButtonLabel}
          onBack={handleHeaderBack}
          rightSlot={
            <form id="create-pin-submit-form" className="cta-form" onSubmit={handleSubmit}>
              <button
                type="submit"
                className="btn-submit"
                disabled={isOffline || isSubmitting}
                title={isOffline ? 'Reconnect to publish a pin' : undefined}
                style={{
                  backgroundColor: activeTheme.ctaBackground,
                  color: activeTheme.ctaTextColor
                }}
              >
                {isSubmitting ? 'Posting...' : FIGMA_TEMPLATE.header.cta}
              </button>
            </form>
          }
        />
        <p className="header-subtitle">{eventHeaderSubtitle}</p>
        <div className="body">
        {isOffline && (
          <div className="alert alert-warning static-alert">
            You are offline. Drafts save locally, but publishing and uploads need a connection.
          </div>
        )}

        {/* Pin type toggle */}
        <div className="field-group">
          <div className="toggle-group">
            <button
              type="button"
              className={`toggle-btn ${pinType === 'discussion' ? 'selected' : ''}`}
              onClick={() => handleTypeChange(null, 'discussion')}
            >
              <MapIcon fontSize="small" /> Discussion
            </button>
            <button
              type="button"
              className={`toggle-btn ${pinType === 'event' ? 'selected' : ''}`}
              onClick={() => handleTypeChange(null, 'event')}
            >
              <EventNoteIcon fontSize="small" /> Event
            </button>
          </div>
        </div>

        {/* Title + Description */}
        <div className="form-section">
          <div className="input-group">
            <label htmlFor={`create-pin-title-${titleInputId}`}>Title</label>
            <input
              type="text"
              id={`create-pin-title-${titleInputId}`}
              value={formState.title}
              onChange={handleFieldChange('title')}
              placeholder={
                pinType === 'event'
                  ? FIGMA_TEMPLATE.fields.titlePlaceholder
                  : "What's the discussion about?"
              }
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor={`create-pin-description-${descriptionInputId}`}>Description</label>
            <textarea
              id={`create-pin-description-${descriptionInputId}`}
              value={formState.description}
              onChange={handleFieldChange('description')}
              placeholder={
                pinType === 'event'
                  ? FIGMA_TEMPLATE.fields.descriptionPlaceholder
                  : "[Empty] Discussion dets - what's being talked about?"
              }
              required
            ></textarea>
          </div>
        </div>

        {/* Event or Discussion Details */}
        <div className="grid-item">
          <div className="form-section">
            {pinType === 'event' ? (
              <>
                <div className="details-info">
                  <h2>Event Details</h2>
                  <p>Let everyone know when and where to show up.</p>
                </div>

                <div className="input-group">
                  <label htmlFor={`create-pin-participant-limit-${participantLimitInputId}`}>
                    Attendee limit
                  </label>
                  <input
                    type="number"
                    id={`create-pin-participant-limit-${participantLimitInputId}`}
                    min={EVENT_ATTENDEE_LIMITS.min}
                    max={EVENT_ATTENDEE_LIMITS.max}
                    value={formState.participantLimit}
                    onChange={handleFieldChange('participantLimit')}
                    required
                  />
                  <small className="field-hint">
                    Between {EVENT_ATTENDEE_LIMITS.min} and {EVENT_ATTENDEE_LIMITS.max} attendees (default{' '}
                    {EVENT_ATTENDEE_LIMITS.defaultValue}).
                  </small>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-start-date-${startDateInputId}`}>Start date</label>
                    <input
                      type="datetime-local"
                      id={`create-pin-start-date-${startDateInputId}`}
                      value={formState.startDate}
                      onChange={handleFieldChange('startDate')}
                      required
                      min={eventStartMinInput}
                      max={eventStartMaxInput}
                    />
                    <small className="field-hint">Must be within the next 14 days.</small>
                  </div>
                  <div>
                    <label htmlFor={`create-pin-end-date-${endDateInputId}`}>End date</label>
                    <input
                      type="datetime-local"
                      id={`create-pin-end-date-${endDateInputId}`}
                      value={formState.endDate}
                      onChange={handleFieldChange('endDate')}
                      required
                      min={eventEndMinInput}
                      max={eventStartMaxInput}
                    />
                    <small className="field-hint">Must be on or after the start date.</small>
                  </div>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-address-${addressPreciseInputId}`}>Precise address</label>
                    <input
                      type="text"
                      id={`create-pin-address-${addressPreciseInputId}`}
                      value={formState.addressPrecise}
                      onChange={handleFieldChange('addressPrecise')}
                      placeholder="123 Ocean Blvd"
                    />
                  </div>
                  <div>
                    <label htmlFor={`create-pin-city-${addressCityInputId}`}>City</label>
                    <input
                      type="text"
                      id={`create-pin-city-${addressCityInputId}`}
                      value={formState.addressCity}
                      onChange={handleFieldChange('addressCity')}
                      placeholder="Long Beach"
                    />
                  </div>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-state-${addressStateInputId}`}>State</label>
                    <input
                      type="text"
                      id={`create-pin-state-${addressStateInputId}`}
                      value={formState.addressState}
                      onChange={handleFieldChange('addressState')}
                      placeholder="CA"
                    />
                  </div>
                  <div>
                    <label htmlFor={`create-pin-postal-${addressPostalInputId}`}>Postal code</label>
                    <input
                      type="text"
                      id={`create-pin-postal-${addressPostalInputId}`}
                      value={formState.addressPostalCode}
                      onChange={handleFieldChange('addressPostalCode')}
                      placeholder="90802"
                    />
                  </div>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-country-${addressCountryInputId}`}>Country</label>
                    <input
                      type="text"
                      id={`create-pin-country-${addressCountryInputId}`}
                      value={formState.addressCountry}
                      onChange={handleFieldChange('addressCountry')}
                      placeholder="USA"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="details-info">
                  <h2>Discussion Details</h2>
                  <p>Share when the topic wraps up and where it mainly takes place.</p>
                </div>

                <div className="input-group">
                  <label htmlFor={`create-pin-reply-limit-${replyLimitInputId}`}>Reply limit</label>
                  <select
                    id={`create-pin-reply-limit-${replyLimitInputId}`}
                    value={formState.replyLimit}
                    onChange={handleFieldChange('replyLimit')}
                  >
                    {DISCUSSION_REPLY_LIMIT_OPTIONS.map((limit) => (
                      <option key={limit} value={limit}>
                        {limit} replies
                      </option>
                    ))}
                  </select>
                  <small className="field-hint">
                    Choose how many replies this discussion allows before it closes (default 100).
                  </small>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-expires-${expiresAtInputId}`}>Expires at</label>
                    <input
                      type="datetime-local"
                      id={`create-pin-expires-${expiresAtInputId}`}
                      value={formState.expiresAt}
                      onChange={handleFieldChange('expiresAt')}
                      required
                      min={discussionMinInput}
                      max={discussionMaxInput}
                    />
                    <small className="field-hint">Discussions expire within 3 days.</small>
                  </div>
                  <div className="toggle-inline">
                    <label htmlFor={`create-pin-auto-delete-${autoDeleteInputId}`}>Auto delete when expired?</label>
                    <input
                      type="checkbox"
                      id={`create-pin-auto-delete-${autoDeleteInputId}`}
                      checked={autoDelete}
                      onChange={(event) => setAutoDelete(event.target.checked)}
                    />
                  </div>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-approx-${approxFormattedInputId}`}>Approximate area</label>
                    <input
                      type="text"
                      id={`create-pin-approx-${approxFormattedInputId}`}
                      value={formState.approxFormatted}
                      onChange={handleFieldChange('approxFormatted')}
                      placeholder="Downtown Long Beach"
                    />
                  </div>
                  <div>
                    <label htmlFor={`create-pin-approx-city-${approxCityInputId}`}>City</label>
                    <input
                      type="text"
                      id={`create-pin-approx-city-${approxCityInputId}`}
                      value={formState.approxCity}
                      onChange={handleFieldChange('approxCity')}
                      placeholder="Long Beach"
                    />
                  </div>
                </div>

                <div className="two-col">
                  <div>
                    <label htmlFor={`create-pin-approx-state-${approxStateInputId}`}>State</label>
                    <input
                      type="text"
                      id={`create-pin-approx-state-${approxStateInputId}`}
                      value={formState.approxState}
                      onChange={handleFieldChange('approxState')}
                      placeholder="CA"
                    />
                  </div>
                  <div>
                    <label htmlFor={`create-pin-approx-country-${approxCountryInputId}`}>Country</label>
                    <input
                      type="text"
                      id={`create-pin-approx-country-${approxCountryInputId}`}
                      value={formState.approxCountry}
                      onChange={handleFieldChange('approxCountry')}
                      placeholder="USA"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Uploads */}
        <div className="form-section">
          <h2>Photos</h2>
          <p>Add up to 3 images to showcase your pin.</p>

          {uploadStatus && (
            <div className={`alert alert-${uploadStatus.type}`}>
              <span>{uploadStatus.message}</span>
              <button type="button" onClick={clearUploadStatus} className="alert-close">
                x
              </button>
            </div>
          )}

          <label className="upload-btn">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelection}
              disabled={isUploading}
            />
            {isUploading ? 'Uploading…' : 'Upload images'}
          </label>

          {photoAssets.length > 0 && (
            <div className="photo-grid">
              {photoAssets.map((photo) => {
                const isCover = coverPhotoId === photo.id;
                return (
                  <div className="photo-card" key={photo.id}>
                    <img src={photo.asset.url} alt={photo.asset.description || 'Pin image'} />
                    {isCover && <div className="cover-label">Cover photo</div>}
                    <div className="photo-actions">
                      <button
                        type="button"
                        className={isCover ? 'btn-selected' : 'btn-outline'}
                        onClick={() => handleSetCoverPhoto(photo.id)}
                        disabled={isCover}
                      >
                        {isCover ? 'Selected' : 'Set as cover'}
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleRemovePhoto(photo.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOCATION SECTION */}
        <div className="form-section">
          <h2>Location</h2>
          <p>
            {pinType === 'event'
              ? FIGMA_TEMPLATE.fields.locationPrompt
              : 'Tap where the approximate location of the discussion is at.'}
          </p>

          <div className="map-container">
            <SelectableLocationMap
              value={selectedCoordinates}
              onChange={handleMapLocationSelect}
              anchor={viewerMapAnchor}
              avatarUrl={viewerAvatarUrl}
              viewerName={viewerDisplayName}
              previewPin={{
                _id: 'draft',
                title: formState.title || 'Draft pin',
                type: pinType,
                description: formState.description,
                viewerOwnsPin: true,
                viewerHasBookmarked: false,
                participantCount: undefined,
                participantLimit: undefined,
                bookmarkCount: undefined,
                replyCount: undefined,
                tags: Array.isArray(formState.tags) ? formState.tags : undefined,
                addressPrecise: formState.addressPrecise,
                addressCity: formState.addressCity,
                addressState: formState.addressState,
                addressCountry: formState.addressCountry,
                approxFormatted: formState.approxFormatted,
                approxCity: formState.approxCity,
                approxState: formState.approxState,
                approxCountry: formState.approxCountry,
                startDate: formState.startDate,
                endDate: formState.endDate,
                expiresAt: formState.expiresAt,
                latitude: formState.latitude,
                longitude: formState.longitude,
                proximityRadiusMeters: formState.proximityRadiusMiles
                  ? Number(formState.proximityRadiusMiles) * 1609.34
                  : undefined,
                coverPhoto: Array.isArray(photoAssets) && photoAssets[0]
                  ? { url: photoAssets[0].asset?.url || photoAssets[0].asset?.path }
                  : undefined,
                photos: Array.isArray(photoAssets)
                  ? photoAssets
                      .map((photo) => ({
                        url: photo?.asset?.url || photo?.asset?.path
                      }))
                      .filter((photo) => !!photo.url)
                      .slice(0, 3)
                  : undefined,
                distanceMiles: undefined,
                coordinateLabel: undefined
              }}
            />
          </div>
          {pinDistanceLabel ? (
            <p className="distance-indicator">
              Distance from you: <strong>{pinDistanceLabel}</strong>
            </p>
          ) : viewerMapAnchor ? (
            <p className="distance-indicator hint">
              Tap the map to see how far the new pin is from your location.
            </p>
          ) : null}

          {isReverseGeocoding && <p className="loading-text">Looking up address details...</p>}

          <p className="note-text">
            Click or tap the map to set coordinates. We will auto-fill the address when possible.
          </p>

          <div className="map-coords">
            <div className="coord-field">
              <label htmlFor={`create-pin-latitude-${latitudeInputId}`}>Latitude</label>
              <input
                type="text"
                id={`create-pin-latitude-${latitudeInputId}`}
                value={formState.latitude}
                onChange={handleFieldChange('latitude')}
                required
                placeholder="33.783800"
              />
            </div>

            <div className="coord-field">
              <label htmlFor={`create-pin-longitude-${longitudeInputId}`}>Longitude</label>
              <input
                type="text"
                id={`create-pin-longitude-${longitudeInputId}`}
                value={formState.longitude}
                onChange={handleFieldChange('longitude')}
                required
                placeholder="-118.113600"
              />
            </div>

            <div className="coord-field">
              <label htmlFor={`create-pin-radius-${radiusInputId}`}>Proximity Radius (miles)</label>
              <input
                type="text"
                id={`create-pin-radius-${radiusInputId}`}
                value={formState.proximityRadiusMiles}
                onChange={handleFieldChange('proximityRadiusMiles')}
                placeholder="Optional. Defaults to 1 mile."
              />
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="footer-actions">
          <button type="button" className="btn-outline btn-reset" onClick={resetForm}>
            Reset form
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
          >
            Save Draft
          </button>
          <button
            type="submit"
            form="create-pin-submit-form"
            className="btn-submit"
            disabled={isOffline || isSubmitting}
            title={isOffline ? 'Reconnect to publish a pin' : undefined}
            style={{
              backgroundColor: activeTheme.ctaBackground,
              color: activeTheme.ctaTextColor
            }}
          >
            {isSubmitting ? 'Posting...' : FIGMA_TEMPLATE.header.cta}
          </button>
        </div>

        {resultJson && <pre className="result-json">{resultJson}</pre>}
        </div>
      </div>
    </div>
  );
}

export default CreatePinPage;
