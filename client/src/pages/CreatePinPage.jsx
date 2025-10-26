import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import MapIcon from '@mui/icons-material/Map';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createPin, uploadPinImage } from '../api/mongoDataApi';
import { useNavOverlay } from '../contexts/NavOverlayContext';
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

const METERS_PER_MILE = 1609.34;

const INITIAL_FORM_STATE = {
  title: '',
  description: '',
  latitude: '',
  longitude: '',
  proximityRadiusMiles: '1',
  startDate: '',
  endDate: '',
  expiresAt: '',
  addressPrecise: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  addressCountry: '',
  approxFormatted: '',
  approxCity: '',
  approxState: '',
  approxCountry: ''
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

const PIN_TYPE_THEMES = {
  event: {
    headerBackground: 'linear-gradient(135deg, #CDAEF2 0%, #9B5DE5 100%)',
    headerTextColor: '#120A24',
    headerSubtitleColor: 'rgba(18, 10, 36, 0.75)',
    ctaBackground: '#3EB8F0',
    ctaHoverBackground: '#2A97C9',
    ctaTextColor: '#FFFFFF'
  },
  discussion: {
    headerBackground: 'linear-gradient(135deg, #ECF8FE 0%, #3EB8F0 100%)',
    headerTextColor: '#041E33',
    headerSubtitleColor: 'rgba(4, 30, 51, 0.75)',
    ctaBackground: '#F15BB5',
    ctaHoverBackground: '#D9489D',
    ctaTextColor: '#FFFFFF'
  }
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
    locationPrompt: 'Tap where the event will take place'
  }
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

function SelectableLocationMap({ value, onChange }) {
  const center = value ?? DEFAULT_MAP_CENTER;

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
      <MapCenterUpdater position={value} />
      {value ? <Marker position={[value.lat, value.lng]} /> : null}
    </MapContainer>
  );
}

function extractReverseGeocodeFields(payload) {
  if (!payload) {
    return null;
  }

  const address = payload.address ?? {};
  const formatted = payload.display_name ?? null;
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    address.county ||
    null;
  const state = address.state || address.region || address.state_district || null;
  const postalCode = address.postcode || null;
  const country = address.country || null;

  if (!formatted && !city && !state && !country && !postalCode) {
    return null;
  }

  return {
    formatted,
    city,
    state,
    postalCode,
    country
  };
}

function sanitizeNumberField(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = `${value}`.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`"${value}" is not a valid number.`);
  }
  return parsed;
}

function sanitizeDateField(value, label) {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return date.toISOString();
}

function CreatePinPage() {
  const [pinType, setPinType] = useState('discussion');
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [autoDelete, setAutoDelete] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [createdPin, setCreatedPin] = useState(null);
  const [photoAssets, setPhotoAssets] = useState([]);
  const [coverPhotoId, setCoverPhotoId] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null);
  const lastReverseGeocodeRef = useRef(null);
  const activeTheme = useMemo(() => PIN_TYPE_THEMES[pinType], [pinType]);
  const { handleBack: overlayBack, previousNavPath, previousNavPage } = useNavOverlay();
  const canNavigateBack = Boolean(previousNavPath);
  const backButtonLabel = previousNavPage?.label ? `Back to ${previousNavPage.label}` : 'Back';
  const startDateValue = formState.startDate;
  const endDateValue = formState.endDate;
  const eventHeaderSubtitle = useMemo(() => {
    if (pinType !== 'event') {
      return '';
    }

    const fallback = 'Set your event schedule so attendees know when to show up.';
    if (!startDateValue) {
      return fallback;
    }

    const start = new Date(startDateValue);
    if (Number.isNaN(start.getTime())) {
      return fallback;
    }

    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    const startLabel = dateFormatter.format(start);

    if (!endDateValue) {
      return startLabel;
    }

    const end = new Date(endDateValue);
    if (Number.isNaN(end.getTime())) {
      return startLabel;
    }

    const sameDay = start.toDateString() === end.toDateString();
    if (sameDay) {
      const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
      return `${startLabel} – ${timeFormatter.format(end)}`;
    }

    const endLabel = dateFormatter.format(end);
    return `${startLabel} → ${endLabel}`;
  }, [pinType, startDateValue, endDateValue]);
  const selectedCoordinates = useMemo(() => {
    const latitude = Number.parseFloat(formState.latitude);
    const longitude = Number.parseFloat(formState.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { lat: latitude, lng: longitude };
    }
    return null;
  }, [formState.latitude, formState.longitude]);

  const handleTypeChange = useCallback((event, nextType) => {
    if (nextType) {
      setPinType(nextType);
      setStatus(null);
    }
  }, []);

  const handleFieldChange = useCallback((field) => {
    return (event) => {
      const { value } = event.target;
      setFormState((prev) => ({
        ...prev,
        [field]: value
      }));
    };
  }, []);

  const reverseGeocodeCoordinates = useCallback(
    async (latitude, longitude, options = {}) => {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const key = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
      if (!options.force && lastReverseGeocodeRef.current === key) {
        return;
      }

      lastReverseGeocodeRef.current = key;
      setIsReverseGeocoding(true);
      try {
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.searchParams.set('lat', String(latitude));
        url.searchParams.set('lon', String(longitude));
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('zoom', '16');
        url.searchParams.set('addressdetails', '1');

        const response = await fetch(url.toString(), {
          headers: {
            Accept: 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Reverse geocoding failed. Please fill in the address manually.');
        }

        const payload = await response.json();
        const address = extractReverseGeocodeFields(payload);
        if (!address) {
          setLocationStatus({
            type: 'info',
            message: 'Coordinates captured. Address information was not available for this spot.'
          });
          return;
        }

        setFormState((prev) => ({
          ...prev,
          approxFormatted: address.formatted ?? prev.approxFormatted,
          approxCity: address.city ?? prev.approxCity,
          approxState: address.state ?? prev.approxState,
          approxCountry: address.country ?? prev.approxCountry,
          ...(pinType === 'event'
            ? {
                addressPrecise: address.formatted ?? prev.addressPrecise,
                addressCity: address.city ?? prev.addressCity,
                addressState: address.state ?? prev.addressState,
                addressPostalCode: address.postalCode ?? prev.addressPostalCode,
                addressCountry: address.country ?? prev.addressCountry
              }
            : {})
        }));

        setLocationStatus({
          type: 'success',
          message: 'Auto-filled location details from the selected point on the map.'
        });
      } catch (error) {
        setLocationStatus({
          type: 'warning',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to look up the address for these coordinates.'
        });
        lastReverseGeocodeRef.current = null;
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [pinType]
  );

  const handleMapLocationSelect = useCallback(
    ({ lat, lng }) => {
      const formattedLat = lat.toFixed(6);
      const formattedLng = lng.toFixed(6);
      setFormState((prev) => ({
        ...prev,
        latitude: formattedLat,
        longitude: formattedLng
      }));
      setLocationStatus({
        type: 'info',
        message: 'Latitude and longitude updated from map selection.'
      });
      void reverseGeocodeCoordinates(lat, lng, { force: true });
    },
    [reverseGeocodeCoordinates]
  );

  useEffect(() => {
    if (!selectedCoordinates) {
      return;
    }
    if (isReverseGeocoding) {
      return;
    }
    void reverseGeocodeCoordinates(selectedCoordinates.lat, selectedCoordinates.lng);
  }, [isReverseGeocoding, reverseGeocodeCoordinates, selectedCoordinates]);

  const resetForm = useCallback(() => {
    setPinType('discussion');
    setFormState(INITIAL_FORM_STATE);
    setAutoDelete(true);
    setStatus(null);
    setCreatedPin(null);
    setPhotoAssets([]);
    setCoverPhotoId(null);
    setUploadStatus(null);
    setLocationStatus(null);
    setIsReverseGeocoding(false);
    setIsUploading(false);
  }, []);

  useEffect(() => {
    if (!photoAssets.length) {
      if (coverPhotoId !== null) {
        setCoverPhotoId(null);
      }
      return;
    }

    if (!coverPhotoId || !photoAssets.some((photo) => photo.id === coverPhotoId)) {
      setCoverPhotoId(photoAssets[0].id);
    }
  }, [photoAssets, coverPhotoId]);

  const handleImageSelection = useCallback(
    async (event) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        return;
      }

      const remainingSlots = 10 - photoAssets.length;
      if (remainingSlots <= 0) {
        setUploadStatus({ type: 'warning', message: 'You can attach up to 10 images per pin.' });
        event.target.value = '';
        return;
      }

      const filesToUpload = files.slice(0, remainingSlots);
      if (filesToUpload.length < files.length) {
        setUploadStatus({
          type: 'info',
          message: `Only the first ${filesToUpload.length} image${filesToUpload.length === 1 ? '' : 's'} were queued (max 10).`
        });
      }

      setIsUploading(true);
      const successfulUploads = [];
      const failedUploads = [];

      for (const file of filesToUpload) {
        try {
          const uploaded = await uploadPinImage(file);
          successfulUploads.push({
            id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
            asset: {
              url: uploaded.url,
              width: uploaded.width,
              height: uploaded.height,
            mimeType: uploaded.mimeType ?? (file.type || 'image/jpeg'),
            description: uploaded.fileName || file.name || 'Pin image'
            }
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : `Failed to upload ${file.name || 'image'}.`;
          failedUploads.push(message);
        }
      }

      if (successfulUploads.length) {
        setPhotoAssets((prev) => [...prev, ...successfulUploads]);
      }

      if (failedUploads.length && successfulUploads.length) {
        setUploadStatus({
          type: 'warning',
          message: `Uploaded ${successfulUploads.length} image${
            successfulUploads.length === 1 ? '' : 's'
          }, but ${failedUploads.length} failed. ${failedUploads[0]}`
        });
      } else if (failedUploads.length) {
        setUploadStatus({ type: 'error', message: failedUploads[0] });
      } else if (successfulUploads.length) {
        setUploadStatus({
          type: 'success',
          message: `Uploaded ${successfulUploads.length} image${
            successfulUploads.length === 1 ? '' : 's'
          }.`
        });
      }

      setIsUploading(false);
      event.target.value = '';
    },
    [photoAssets.length, uploadPinImage]
  );

  const handleRemovePhoto = useCallback((photoId) => {
    setPhotoAssets((prev) => prev.filter((photo) => photo.id !== photoId));
    setUploadStatus({ type: 'info', message: 'Removed image from pin.' });
  }, []);

  const handleSetCoverPhoto = useCallback((photoId) => {
    setCoverPhotoId(photoId);
    setUploadStatus({ type: 'success', message: 'Cover photo updated.' });
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setStatus(null);

      try {
        const title = formState.title.trim();
        const description = formState.description.trim();
        if (!title) {
          throw new Error('Title is required.');
        }
        if (!description) {
          throw new Error('Description is required.');
        }

        const latitude = sanitizeNumberField(formState.latitude);
        const longitude = sanitizeNumberField(formState.longitude);

        if (latitude === null || latitude < -90 || latitude > 90) {
          throw new Error('Latitude must be between -90 and 90.');
        }
        if (longitude === null || longitude < -180 || longitude > 180) {
          throw new Error('Longitude must be between -180 and 180.');
        }

        const proximityMiles = sanitizeNumberField(formState.proximityRadiusMiles);
        if (proximityMiles !== null && proximityMiles <= 0) {
          throw new Error('Proximity radius must be greater than zero.');
        }

        const payload = {
          type: pinType,
          title,
          description,
          coordinates: {
            latitude,
            longitude
          },
          proximityRadiusMeters:
            proximityMiles !== null ? Math.round(proximityMiles * METERS_PER_MILE) : undefined
        };

        if (pinType === 'event') {
          payload.startDate = sanitizeDateField(formState.startDate, 'Start date');
          payload.endDate = sanitizeDateField(formState.endDate, 'End date');

          const precise = formState.addressPrecise.trim();
          const city = formState.addressCity.trim();
          const state = formState.addressState.trim();
          const postalCode = formState.addressPostalCode.trim();
          const country = formState.addressCountry.trim();

          if (precise) {
            const components = {
              city: city || undefined,
              state: state || undefined,
              postalCode: postalCode || undefined,
              country: country || undefined
            };

            payload.address = {
              precise,
              components: Object.values(components).some(Boolean) ? components : undefined
            };
          }
        } else {
          payload.expiresAt = sanitizeDateField(formState.expiresAt, 'Expiration date');
          payload.autoDelete = autoDelete;

          const approximateAddress = {
            formatted: formState.approxFormatted.trim() || undefined,
            city: formState.approxCity.trim() || undefined,
            state: formState.approxState.trim() || undefined,
            country: formState.approxCountry.trim() || undefined
          };

          if (Object.values(approximateAddress).some(Boolean)) {
            payload.approximateAddress = approximateAddress;
          }
        }

        if (photoAssets.length > 0) {
          payload.photos = photoAssets.map((photo) => ({
            url: photo.asset.url,
            width: photo.asset.width,
            height: photo.asset.height,
            mimeType: photo.asset.mimeType,
            description: photo.asset.description
          }));

          const selectedCover =
            photoAssets.find((photo) => photo.id === coverPhotoId) ?? photoAssets[0];
          if (selectedCover) {
            payload.coverPhoto = {
              url: selectedCover.asset.url,
              width: selectedCover.asset.width,
              height: selectedCover.asset.height,
              mimeType: selectedCover.asset.mimeType,
              description: selectedCover.asset.description
            };
          }
        }

        setIsSubmitting(true);
        const result = await createPin(payload);
        setCreatedPin(result);
        setStatus({
          type: 'success',
          message: result?._id
            ? `Pin created successfully (ID: ${result._id}).`
            : 'Pin created successfully.'
        });
      } catch (error) {
        setStatus({
          type: 'error',
          message: error?.message || 'Failed to create pin.'
        });
        return;
      } finally {
        setIsSubmitting(false);
      }
    },
    [autoDelete, coverPhotoId, formState, photoAssets, pinType]
  );

  const resultJson = useMemo(() => {
    if (!createdPin) {
      return null;
    }
    return JSON.stringify(createdPin, null, 2);
  }, [createdPin]);

  return (
    <div className="create-pin">
      <div className='header' style={{background: activeTheme.headerBackground, color: activeTheme.headerTextColor}}>
        {canNavigateBack && (
          <button
            type="button"
            className="btn-back"
            onClick={overlayBack}
          >
            <img
              src='https://www.svgrepo.com/show/326886/arrow-back-sharp.svg'
              className='back-arrow'
            />
          </button>
        )}

        <div>
          <h1 className="form-title">
            {pinType === 'event' ? 'Event' : 'Discussion'}
          </h1>
        </div>

        <button
          type="submit"
          className="btn-submit"
          disabled={isSubmitting}
          style={{
            backgroundColor: activeTheme.ctaBackground,
            color: activeTheme.ctaTextColor
          }}
        >
          {isSubmitting ? 'Posting...' : FIGMA_TEMPLATE.header.cta}
        </button>
      </div>

      <div className='body'>
        {/* Title + Description */}
        <div className="form-section">
          <div className="input-group">
            <label>Title</label>
            <input
              type="text"
              value={formState.title}
              onChange={handleFieldChange('title')}
              placeholder={
                pinType === 'event'
                  ? FIGMA_TEMPLATE.fields.titlePlaceholder
                  : "[Empty] Discussion Title"
              }
              required
            />
          </div>
          <div className="input-group">
            <label>Description</label>
            <textarea
              value={formState.description}
              onChange={handleFieldChange('description')}
              placeholder={
                pinType === 'event'
                  ? FIGMA_TEMPLATE.fields.descriptionPlaceholder
                  : '[Empty] Discussion dets - what\'s being talked about?'
              }
              required
            ></textarea>
          </div>
        </div>
        
        {/* Pin type toggle */}
        <div className="field-group">
          <label className="label">Pin type</label>
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

        {/* Status Alert */}
        {status && (
          <div className={`alert alert-${status.type}`}>
            <span>{status.message}</span>
            <button type="button" onClick={() => setStatus(null)} className="alert-close">
              ×
            </button>
          </div>
        )}

        {/* Event or Discussion Details */}
        <div className="grid-item">
          <div className="form-section">
            {pinType === 'event' ? (
              <>
                <div className='details-info'>
                  <h2>Event details</h2>
                  <p>Let everyone know when and where to show up.</p>
                </div>
                
                <div className="two-col">
                  <div>
                    <label>Start date </label>
                    <input
                      type="datetime-local"
                      value={formState.startDate}
                      onChange={handleFieldChange('startDate')}
                      required
                    />
                  </div>
                  <div>
                    <label>End date </label>
                    <input
                      type="datetime-local"
                      value={formState.endDate}
                      onChange={handleFieldChange('endDate')}
                      required
                    />
                  </div>
                </div>

                <h2>Venue</h2>
                <label>Precise address</label>
                <input
                  type="text"
                  value={formState.addressPrecise}
                  onChange={handleFieldChange('addressPrecise')}
                  placeholder="University Student Union, Long Beach, CA"
                />

                <div className="two-col">
                  <input
                    type="text"
                    placeholder="City"
                    value={formState.addressCity}
                    onChange={handleFieldChange('addressCity')}
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={formState.addressState}
                    onChange={handleFieldChange('addressState')}
                  />
                  <input
                    type="text"
                    placeholder="Postal code"
                    value={formState.addressPostalCode}
                    onChange={handleFieldChange('addressPostalCode')}
                  />
                  <input
                    type="text"
                    placeholder="Country"
                    value={formState.addressCountry}
                    onChange={handleFieldChange('addressCountry')}
                  />
                </div>
              </>
            ) : (
              <>
                <div className='details-info'>
                  <h2>Discussion details</h2>
                  <p>Set how long this discussion should stay active.</p>
                </div>
                
                <div className="two-col">
                  <div>
                    <label>Expires at </label>
                    <input
                      type="datetime-local"
                      value={formState.expiresAt}
                      onChange={handleFieldChange('expiresAt')}
                      required
                    />
                  </div>
                  <div className="switch-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={autoDelete}
                        onChange={(e) => setAutoDelete(e.target.checked)}
                      /> Auto delete
                    </label>
                  </div>
                </div>

                <h3>Approximate address</h3>
                <input
                  type="text"
                  placeholder="Formatted"
                  value={formState.approxFormatted}
                  onChange={handleFieldChange('approxFormatted')}
                />
                <div className="two-col">
                  <input
                    type="text"
                    placeholder="City"
                    value={formState.approxCity}
                    onChange={handleFieldChange('approxCity')}
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={formState.approxState}
                    onChange={handleFieldChange('approxState')}
                  />
                  <input
                    type="text"
                    placeholder="Country"
                    value={formState.approxCountry}
                    onChange={handleFieldChange('approxCountry')}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Images Section */}
        <div className="form-section">
          <h2>Images</h2>
          <p>Upload up to 10 square images. The highlighted one becomes the cover photo.</p>

          {uploadStatus && (
            <div className={`alert alert-${uploadStatus.type}`}>
              {uploadStatus.message}
              <button type="button" onClick={() => setUploadStatus(null)} className="alert-close">
                ×
              </button>
            </div>
          )}

          <div className="upload-row">
            <label className="btn-outline">
              {isUploading ? 'Uploading...' : 'Upload images'}
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={handleImageSelection}
                disabled={isUploading || photoAssets.length >= 10}
              />
            </label>
            <span>{photoAssets.length}/10 images attached</span>
          </div>

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
          <p>{FIGMA_TEMPLATE.fields.locationPrompt}</p>

          {locationStatus && (
            <div className={`alert alert-${locationStatus.type}`}>
              {locationStatus.message}
              <button
                type="button"
                onClick={() => setLocationStatus(null)}
                className="alert-close"
              >
                ×
              </button>
            </div>
          )}

          <div className="map-container">
            <SelectableLocationMap
              value={selectedCoordinates}
              onChange={handleMapLocationSelect}
            />
          </div>

          {isReverseGeocoding && (
            <p className="loading-text">Looking up address details...</p>
          )}

          <p className="note-text">
            Click or tap the map to set coordinates. We will auto-fill the address
            when possible.
          </p>

          <label>Latitude</label>
          <input
            type="text"
            value={formState.latitude}
            onChange={handleFieldChange("latitude")}
            required
          />

          <label>Longitude</label>
          <input
            type="text"
            value={formState.longitude}
            onChange={handleFieldChange("longitude")}
            required
          />

          <label>Proximity radius (miles)</label>
          <input
            type="text"
            value={formState.proximityRadiusMiles}
            onChange={handleFieldChange("proximityRadiusMiles")}
            placeholder="Optional. Defaults to 1 mile."
          />
        </div>

        

      </div>
    </div>
  );
}

export default CreatePinPage;
