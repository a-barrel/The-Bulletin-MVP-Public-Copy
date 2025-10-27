import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
import { useLocationContext } from '../contexts/LocationContext';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import MapIcon from '@mui/icons-material/Map';
import EventNoteIcon from '@mui/icons-material/EventNote';
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
const MAX_PIN_DISTANCE_MILES = 50;
const MAX_PIN_DISTANCE_METERS = MAX_PIN_DISTANCE_MILES * METERS_PER_MILE;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const EVENT_MAX_LEAD_TIME_DAYS = 14;
const DISCUSSION_MAX_DURATION_DAYS = 3;
const EVENT_MAX_LEAD_TIME_MS = EVENT_MAX_LEAD_TIME_DAYS * MILLISECONDS_PER_DAY;
const DISCUSSION_MAX_DURATION_MS = DISCUSSION_MAX_DURATION_DAYS * MILLISECONDS_PER_DAY;
const FUTURE_TOLERANCE_MS = 60 * 1000;
const DRAFT_STORAGE_KEY = 'pinpoint:createPinDraft';
const AUTOSAVE_DELAY_MS = 1500;

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

const haversineDistanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) {
    return Number.NaN;
  }
  const { latitude: lat1, longitude: lon1 } = pointA;
  const { latitude: lat2, longitude: lon2 } = pointB;
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Number.NaN;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
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
    locationPrompt: 'Tap where the event will take place.'
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

function formatDateTimeLocalInput(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (input) => String(input).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateForMessage(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'the specified date';
  }
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function sanitizeDateField(value, label, options = {}) {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }

  const {
    allowPast = false,
    min,
    max,
    minMessage,
    maxMessage,
    toleranceMs = FUTURE_TOLERANCE_MS
  } = options;

  if (!allowPast) {
    const now = Date.now();
    if (date.getTime() < now - toleranceMs) {
      throw new Error(`${label} cannot be in the past.`);
    }
  }

  if (min) {
    const minDate = min instanceof Date ? min : new Date(min);
    if (Number.isNaN(minDate.getTime())) {
      throw new Error(`${label} has an invalid minimum date.`);
    }
    if (date.getTime() < minDate.getTime()) {
      throw new Error(minMessage ?? `${label} must be on or after ${formatDateForMessage(minDate)}.`);
    }
  }

  if (max) {
    const maxDate = max instanceof Date ? max : new Date(max);
    if (Number.isNaN(maxDate.getTime())) {
      throw new Error(`${label} has an invalid maximum date.`);
    }
    if (date.getTime() > maxDate.getTime()) {
      throw new Error(maxMessage ?? `${label} must be on or before ${formatDateForMessage(maxDate)}.`);
    }
  }

  return date;
}

function CreatePinPage() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatusContext();
  const { location: viewerLocation } = useLocationContext();
  const { announceBadgeEarned } = useBadgeSound();
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
  const [draftStatus, setDraftStatus] = useState(null);
  const autosaveTimeoutRef = useRef(null);
  const draftInitializedRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const lastReverseGeocodeRef = useRef(null);

  const writeDraft = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const draftPayload = {
      version: 1,
      pinType,
      autoDelete,
      formState,
      photoAssets,
      coverPhotoId,
      timestamp: Date.now()
    };

    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      return true;
    } catch (error) {
      console.error('Failed to save pin draft', error);
      return false;
    }
  }, [autoDelete, coverPhotoId, formState, photoAssets, pinType]);

  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear saved pin draft', error);
    }
    skipNextAutosaveRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      draftInitializedRef.current = true;
      skipNextAutosaveRef.current = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.pinType === 'event' || data.pinType === 'discussion') {
          setPinType(data.pinType);
        }
        if (typeof data.autoDelete === 'boolean') {
          setAutoDelete(data.autoDelete);
        }
        if (data.formState && typeof data.formState === 'object') {
          setFormState((prev) => ({
            ...prev,
            ...data.formState
          }));
        }
        if (Array.isArray(data.photoAssets)) {
          setPhotoAssets(data.photoAssets);
        }
        if (typeof data.coverPhotoId === 'string' && data.coverPhotoId.trim()) {
          setCoverPhotoId(data.coverPhotoId);
        }

        setDraftStatus({
          type: 'info',
          message: 'Draft restored from your last session.'
        });
      }
    } catch (error) {
      console.warn('Failed to load saved pin draft', error);
    } finally {
      draftInitializedRef.current = true;
      skipNextAutosaveRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!draftInitializedRef.current) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = window.setTimeout(() => {
      const success = writeDraft();
      if (success) {
        setDraftStatus({
          type: 'info',
          message: `Draft saved at ${new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}.`
        });
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [autoDelete, coverPhotoId, formState, photoAssets, pinType, writeDraft]);

  useEffect(() => {
    if (!draftStatus) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const timeoutId = window.setTimeout(
      () => setDraftStatus(null),
      draftStatus.type === 'error' ? 8000 : 4000
    );
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftStatus]);

  const activeTheme = useMemo(() => PIN_TYPE_THEMES[pinType], [pinType]);
  const { handleBack: overlayBack, previousNavPath, previousNavPage } = useNavOverlay();
  const canNavigateBack = Boolean(previousNavPath);
  const backButtonLabel = previousNavPage?.label ? `Back to ${previousNavPage.label}` : 'Back';
  const startDateValue = formState.startDate;
  const endDateValue = formState.endDate;

  const eventHeaderSubtitle = useMemo(() => {
    if (pinType !== 'event') {
      return 'Share what is happening and invite others to join.';
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
      return `${startLabel} - ${timeFormatter.format(end)}`;
    }

    const endLabel = dateFormatter.format(end);
    return `${startLabel} - ${endLabel}`;
  }, [pinType, startDateValue, endDateValue]);

  const selectedCoordinates = useMemo(() => {
    const latitude = Number.parseFloat(formState.latitude);
    const longitude = Number.parseFloat(formState.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { lat: latitude, lng: longitude };
    }
    return null;
  }, [formState.latitude, formState.longitude]);

  const viewerCoordinates = useMemo(() => {
    const latitude = Number.parseFloat(viewerLocation?.latitude);
    const longitude = Number.parseFloat(viewerLocation?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }, [viewerLocation]);

  const viewerMapAnchor = useMemo(() => {
    if (!viewerCoordinates) {
      return null;
    }
    return { lat: viewerCoordinates.latitude, lng: viewerCoordinates.longitude };
  }, [viewerCoordinates]);

  const nowReference = useMemo(() => new Date(), []);
  const eventMaxDateRef = useMemo(
    () => new Date(nowReference.getTime() + EVENT_MAX_LEAD_TIME_MS),
    [nowReference]
  );
  const discussionMaxDateRef = useMemo(
    () => new Date(nowReference.getTime() + DISCUSSION_MAX_DURATION_MS),
    [nowReference]
  );
  const eventStartMinInput = useMemo(
    () => formatDateTimeLocalInput(nowReference),
    [nowReference]
  );
  const eventStartMaxInput = useMemo(
    () => formatDateTimeLocalInput(eventMaxDateRef),
    [eventMaxDateRef]
  );
  const eventEndMinDate = useMemo(() => {
    if (!formState.startDate) {
      return nowReference;
    }
    const parsed = new Date(formState.startDate);
    if (Number.isNaN(parsed.getTime())) {
      return nowReference;
    }
    return parsed;
  }, [formState.startDate, nowReference]);
  const eventEndMinInput = useMemo(
    () => formatDateTimeLocalInput(eventEndMinDate),
    [eventEndMinDate]
  );
  const discussionMinInput = eventStartMinInput;
  const discussionMaxInput = useMemo(
    () => formatDateTimeLocalInput(discussionMaxDateRef),
    [discussionMaxDateRef]
  );

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
      if (!viewerCoordinates) {
        setLocationStatus({
          type: 'warning',
          message: 'We need your current location to place an event. Enable location sharing and try again.'
        });
        return;
      }
      const distanceMeters = haversineDistanceMeters(viewerCoordinates, {
        latitude: lat,
        longitude: lng
      });
      if (!Number.isFinite(distanceMeters)) {
        setLocationStatus({
          type: 'error',
          message: 'Unable to validate the selected spot. Please try a different location.'
        });
        return;
      }
      if (distanceMeters > MAX_PIN_DISTANCE_METERS) {
        const miles = distanceMeters / METERS_PER_MILE;
        setLocationStatus({
          type: 'error',
          message: `Pins must be within ${MAX_PIN_DISTANCE_MILES} miles of you. This spot is about ${miles.toFixed(1)} miles away.`
        });
        return;
      }

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
    [reverseGeocodeCoordinates, viewerCoordinates]
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
    clearDraft();
    setPinType('discussion');
    setFormState(INITIAL_FORM_STATE);
    setAutoDelete(true);
    setStatus(null);
    setDraftStatus(null);
    setCreatedPin(null);
    setPhotoAssets([]);
    setCoverPhotoId(null);
    setUploadStatus(null);
    setLocationStatus(null);
    setIsReverseGeocoding(false);
    setIsUploading(false);
  }, [clearDraft]);

  const handleSaveDraft = useCallback(() => {
    const success = writeDraft();
    setDraftStatus({
      type: success ? 'success' : 'error',
      message: success ? 'Draft saved.' : 'Unable to save draft locally.'
    });
  }, [writeDraft]);

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

      if (isOffline) {
        setUploadStatus({ type: 'warning', message: 'You are offline. Connect to upload images.' });
        event.target.value = '';
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
    [isOffline, photoAssets.length, uploadPinImage]
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

      if (isOffline) {
        setStatus({ type: 'warning', message: 'You are offline. Connect to publish a pin.' });
        return;
      }

      try {
        const latitude = sanitizeNumberField(formState.latitude);
        const longitude = sanitizeNumberField(formState.longitude);

        if (latitude === null || latitude < -90 || latitude > 90) {
          throw new Error('Latitude must be between -90 and 90.');
        }
        if (longitude === null || longitude < -180 || longitude > 180) {
          throw new Error('Longitude must be between -180 and 180.');
        }

        if (!viewerCoordinates) {
          throw new Error('We need your current location to confirm this pin. Enable location sharing and try again.');
        }
        const distanceMeters = haversineDistanceMeters(viewerCoordinates, {
          latitude,
          longitude
        });
        if (!Number.isFinite(distanceMeters)) {
          throw new Error('Unable to validate the selected location. Please try again.');
        }
        if (distanceMeters > MAX_PIN_DISTANCE_METERS) {
          const miles = distanceMeters / METERS_PER_MILE;
          throw new Error(
            `Pins must be within ${MAX_PIN_DISTANCE_MILES} miles of you. This spot is about ${miles.toFixed(1)} miles away.`
          );
        }

        const title = formState.title.trim();
        const description = formState.description.trim();
        if (!title) {
          throw new Error('Title is required.');
        }
        if (!description) {
          throw new Error('Description is required.');
        }

        const proximityMiles = sanitizeNumberField(formState.proximityRadiusMiles);
        if (proximityMiles !== null && proximityMiles <= 0) {
          throw new Error('Proximity radius must be greater than zero.');
        }

        const submissionNow = new Date();
        const eventMaxDate = new Date(submissionNow.getTime() + EVENT_MAX_LEAD_TIME_MS);
        const discussionMaxDate = new Date(submissionNow.getTime() + DISCUSSION_MAX_DURATION_MS);

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
          const startDate = sanitizeDateField(formState.startDate, 'Start date', {
            max: eventMaxDate,
            maxMessage: 'Events can only be scheduled up to 14 days in advance.'
          });
          const endDate = sanitizeDateField(formState.endDate, 'End date', {
            min: startDate,
            minMessage: 'End date must be on or after the start date.',
            max: eventMaxDate,
            maxMessage: 'Events can only be scheduled up to 14 days in advance.'
          });

          payload.startDate = startDate.toISOString();
          payload.endDate = endDate.toISOString();

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
          const expiresAt = sanitizeDateField(formState.expiresAt, 'Expiration date', {
            max: discussionMaxDate,
            maxMessage: 'Discussions can only stay active for up to 3 days.'
          });
          payload.expiresAt = expiresAt.toISOString();
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
        if (result?._badgeEarnedId) {
          playBadgeSound();
          announceBadgeEarned(result._badgeEarnedId);
        }
        setStatus({
          type: 'success',
          message: result?._id
            ? `Pin created successfully (ID: ${result._id}).`
            : 'Pin created successfully.'
        });
        clearDraft();
        setDraftStatus(null);
        if (result?._id) {
          navigate(routes.pin.byId(result._id));
        }
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
    [
      announceBadgeEarned,
      autoDelete,
      clearDraft,
      coverPhotoId,
      formState,
      isOffline,
      navigate,
      photoAssets,
      pinType,
      viewerCoordinates
    ]
  );

  const resultJson = useMemo(() => {
    if (!createdPin) {
      return null;
    }
    return JSON.stringify(createdPin, null, 2);
  }, [createdPin]);

  return (
    <div className={`create-pin ${pinType === 'event' ? 'bg-event' : 'bg-discussion'}`}>
      <div
        className="header"
        style={{ background: activeTheme.headerBackground, color: activeTheme.headerTextColor }}
      >
        {canNavigateBack && (
          <button
            type="button"
            className="btn-back"
            onClick={overlayBack}
            title={backButtonLabel}
          >
            <img
              src="https://www.svgrepo.com/show/326886/arrow-back-sharp.svg"
              className="back-arrow"
              alt={backButtonLabel}
            />
          </button>
        )}

        <div className="header-info">
          <h1 className="form-title">{pinType === 'event' ? 'Event' : 'Discussion'}</h1>
          <p
            className="form-subtitle"
            style={{ color: activeTheme.headerSubtitleColor }}
          >
            {pinType === 'event'
              ? eventHeaderSubtitle
              : "Share what's happening around campus."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
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

      <div className="body">
        {isOffline && (
          <div className="alert alert-warning static-alert">
            You are offline. Drafts save locally, but publishing and uploads need a connection.
          </div>
        )}

        {status && (
          <div className={`alert alert-${status.type}`}>
            <span>{status.message}</span>
            <button type="button" onClick={() => setStatus(null)} className="alert-close">
              x
            </button>
          </div>
        )}

        {draftStatus && (
          <div className={`alert alert-${draftStatus.type}`}>
            <span>{draftStatus.message}</span>
            <button type="button" onClick={() => setDraftStatus(null)} className="alert-close">
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
            <label>Title</label>
            <input
              type="text"
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
            <label>Description</label>
            <textarea
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
                    <label>Start date</label>
                    <input
                      type="datetime-local"
                      value={formState.startDate}
                      onChange={handleFieldChange('startDate')}
                      required
                      min={eventStartMinInput}
                      max={eventStartMaxInput}
                    />
                    <small className="field-hint">Must be within the next 14 days.</small>
                  </div>
                  <div>
                    <label>End date</label>
                    <input
                      type="datetime-local"
                      value={formState.endDate}
                      onChange={handleFieldChange('endDate')}
                      required
                      min={eventEndMinInput}
                      max={eventStartMaxInput}
                    />
                    <small className="field-hint">Must be on or after the start date.</small>
                  </div>
                </div>

                <h3>Venue</h3>
                <div className="two-col">
                  <input
                    type="text"
                    placeholder="Precise address"
                    value={formState.addressPrecise}
                    onChange={handleFieldChange('addressPrecise')}
                  />
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

                <div className="form-section">
                  <h2>Images</h2>
                  <p>Upload up to 10 square images. Select the cover photo.</p>

                  {uploadStatus && (
                    <div className={`alert alert-${uploadStatus.type}`}>
                      {uploadStatus.message}
                      <button
                        type="button"
                        onClick={() => setUploadStatus(null)}
                        className="alert-close"
                      >
                        x
                      </button>
                    </div>
                  )}

                  <div className="upload-row">
                    <label
                      className={`btn-outline upload-btn${
                        isOffline || isUploading || photoAssets.length >= 10 ? ' disabled' : ''
                      }`}
                      title={isOffline ? 'Reconnect to upload images' : undefined}
                    >
                      {isUploading ? 'Uploading...' : 'Upload images'}
                      <input
                        type="file"
                        hidden
                        multiple
                        accept="image/*"
                        onChange={handleImageSelection}
                        disabled={isOffline || isUploading || photoAssets.length >= 10}
                      />
                    </label>
                    <span>{photoAssets.length}/10 Images attached</span>
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
              </>
            ) : (
              <>
                <div className="details-info">
                  <h2>Discussion Details</h2>
                  <p>Set how long this discussion should stay active.</p>
                </div>

                <div className="two-col">
                  <div>
                    <label>Expires at</label>
                    <input
                      type="datetime-local"
                      value={formState.expiresAt}
                      onChange={handleFieldChange('expiresAt')}
                      required
                      min={discussionMinInput}
                      max={discussionMaxInput}
                    />
                    <small className="field-hint">Must be within the next 3 days.</small>
                  </div>
                  <div className="switch-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={autoDelete}
                        onChange={(event) => setAutoDelete(event.target.checked)}
                      /> Auto delete
                    </label>
                  </div>
                </div>

                <h3>Approximate Address</h3>
                <div className="two-col">
                  <input
                    type="text"
                    placeholder="Formatted"
                    value={formState.approxFormatted}
                    onChange={handleFieldChange('approxFormatted')}
                  />
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
              <button
                type="button"
                onClick={() => setLocationStatus(null)}
                className="alert-close"
              >
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

          {isReverseGeocoding && (
            <p className="loading-text">Looking up address details...</p>
          )}

          <p className="note-text">
            Click or tap the map to set coordinates. We will auto-fill the address when possible.
          </p>

          <div className="map-coords">
            <label>Latitude</label>
            <input
              type="text"
              value={formState.latitude}
              onChange={handleFieldChange('latitude')}
              required
              placeholder="33.783800"
            />

            <label>Longitude</label>
            <input
              type="text"
              value={formState.longitude}
              onChange={handleFieldChange('longitude')}
              required
              placeholder="-118.113600"
            />

            <label>Proximity Radius (miles)</label>
            <input
              type="text"
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
            Save draft
          </button>
        </div>

        {resultJson && <pre className="result-json">{resultJson}</pre>}
      </div>
    </div>
  );
}

export default CreatePinPage;
