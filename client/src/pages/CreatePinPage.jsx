/* NOTE: Page exports configuration alongside the component. */
import { useCallback, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import MapIcon from '@mui/icons-material/Map';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import '../styles/leaflet.css';

import { routes } from '../routes';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useNavOverlay } from '../contexts/NavOverlayContext';
import useCreatePinForm from '../hooks/useCreatePinForm';
import normalizeObjectId from '../utils/normalizeObjectId';
import './CreatePinPage.css';

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

const FIGMA_TEMPLATE = {
  header: {
    title: 'Event',
    time: '9:41',
    cta: 'Post'
  },
  fields: {
    titlePlaceholder: '[Empty] Event Title',
    descriptionPlaceholder: "[Empty] Event dets - what's cooking?",
    modeLabel: 'Event',
    locationPrompt: 'Tap where the event will take place.'
  }
};

const PIN_TYPE_LABELS = {
  event: 'Event',
  discussion: 'Discussion'
};

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      if (!onSelect) {
        return;
      }
      const { lat, lng } = event.latlng;
      onSelect({ lat, lng });
    }
  });
  return null;
}

function MapCenterUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
      map.setView([position.lat, position.lng]);
    }
  }, [map, position]);
  return null;
}

function SelectableLocationMap({ value, onChange, anchor }) {
  const center = value ?? anchor ?? DEFAULT_MAP_CENTER;
  const trackingPosition = value ?? anchor ?? null;

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onSelect={onChange} />
      <MapCenterUpdater position={trackingPosition} />
      {value ? <Marker position={[value.lat, value.lng]} /> : null}
    </MapContainer>
  );
}

function CreatePinPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: viewerLocation } = useLocationContext();
  const { announceBadgeEarned } = useBadgeSound();
  const { handleBack: overlayBack, previousNavPath, previousNavPage } = useNavOverlay();

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
  const headerTitle = PIN_TYPE_LABELS[pinType] ?? FIGMA_TEMPLATE.header.title;

  return (
    <div className="create-pin-page">
      <div className={`create-pin ${pinType === 'event' ? 'bg-event' : 'bg-discussion'}`}>
        <div
          className="header"
          style={{
            background: activeTheme.headerBackground,
            color: activeTheme.headerTextColor
          }}
        >
          <div className="header-row">
            <button
              type="button"
              className="btn-back"
              onClick={handleHeaderBack}
              aria-label={backButtonLabel}
            >
              <ArrowBackIosNewIcon className="back-arrow" aria-hidden="true" />
            </button>

            <div className="header-content">
              <h1>{headerTitle}</h1>
            </div>

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
          </div>

          <p className="header-subtitle">{eventHeaderSubtitle}</p>
        </div>
        <div className="body">
        {isOffline && (
          <div className="alert alert-warning static-alert">
            You are offline. Drafts save locally, but publishing and uploads need a connection.
          </div>
        )}

        {status && (
          <div className={`alert alert-${status.type}`}>
            <span>{status.message}</span>
            <button type="button" onClick={clearStatus} className="alert-close">
              x
            </button>
          </div>
        )}

        {draftStatus && (
          <div className={`alert alert-${draftStatus.type}`}>
            <span>{draftStatus.message}</span>
            <button type="button" onClick={clearDraftStatus} className="alert-close">
              x
            </button>
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
          <p>Add up to 10 images to showcase your pin.</p>

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

          {locationStatus && (
            <div className={`alert alert-${locationStatus.type}`}>
              {locationStatus.message}
              <button type="button" onClick={clearLocationStatus} className="alert-close">
                x
              </button>
            </div>
          )}

          <div className="map-container">
            <SelectableLocationMap
              value={selectedCoordinates}
              onChange={handleMapLocationSelect}
              anchor={viewerMapAnchor}
            />
          </div>

          {isReverseGeocoding && <p className="loading-text">Looking up address details...</p>}

          <p className="note-text">
            Click or tap the map to set coordinates. We will auto-fill the address when possible.
          </p>

          <div className="map-coords">
            <label htmlFor={`create-pin-latitude-${latitudeInputId}`}>Latitude</label>
            <input
              type="text"
              id={`create-pin-latitude-${latitudeInputId}`}
              value={formState.latitude}
              onChange={handleFieldChange('latitude')}
              required
              placeholder="33.783800"
            />

            <label htmlFor={`create-pin-longitude-${longitudeInputId}`}>Longitude</label>
            <input
              type="text"
              id={`create-pin-longitude-${longitudeInputId}`}
              value={formState.longitude}
              onChange={handleFieldChange('longitude')}
              required
              placeholder="-118.113600"
            />

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
