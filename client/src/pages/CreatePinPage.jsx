import { playBadgeSound } from '../utils/badgeSound';
import { useBadgeSound } from '../contexts/BadgeSoundContext';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../routes';
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

const DRAFT_STORAGE_KEY = 'pinpoint:createPinDraft';
const AUTOSAVE_DELAY_MS = 1500;

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
  const navigate = useNavigate();
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
    [announceBadgeEarned, autoDelete, clearDraft, coverPhotoId, formState, navigate, photoAssets, pinType]
  );

  const resultJson = useMemo(() => {
    if (!createdPin) {
      return null;
    }
    return JSON.stringify(createdPin, null, 2);
  }, [createdPin]);

  return (
    <Container
      component="main"
      maxWidth="md"
      sx={{
        py: { xs: 3, md: 6 },
        display: 'flex',
        flexDirection: 'column',
        gap: 3
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={6}
        sx={{
          p: 0,
          overflow: 'hidden',
          borderRadius: 4,
          background: (theme) =>
            `linear-gradient(180deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`
        }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 4 },
            py: { xs: 2, sm: 3 },
            background: activeTheme.headerBackground,
            color: activeTheme.headerTextColor,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {canNavigateBack && (
            <Button
              onClick={overlayBack}
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{
                alignSelf: 'flex-start',
                color: activeTheme.headerTextColor,
                fontWeight: 600,
                px: 1,
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.08)'
                }
              }}
            >
              {backButtonLabel}
            </Button>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
                {pinType === 'event' ? 'Event' : 'Discussion'}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: activeTheme.headerSubtitleColor,
                  fontWeight: 500
                }}
              >
                {pinType === 'event'
                  ? eventHeaderSubtitle
                  : "Share what's happening around campus"}
              </Typography>
            </Box>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              sx={{
                minWidth: 96,
                fontWeight: 600,
                backgroundColor: activeTheme.ctaBackground,
                color: activeTheme.ctaTextColor,
                '&:hover': {
                  backgroundColor: activeTheme.ctaHoverBackground
                }
              }}
            >
              {isSubmitting ? 'Posting...' : FIGMA_TEMPLATE.header.cta}
            </Button>
          </Box>
        </Box>

        <Box sx={{ px: { xs: 2, sm: 4 }, py: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Pin type
            </Typography>
            <ToggleButtonGroup
              value={pinType}
              exclusive
              onChange={handleTypeChange}
              fullWidth
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  py: 1.25,
                  fontWeight: 600,
                  borderRadius: 3,
                  border: 'none',
                  '&.Mui-selected': {
                    boxShadow: (theme) => `0 10px 30px ${theme.palette.primary.main}44`
                  }
                },
                '& .MuiToggleButtonGroup-grouped': {
                  mx: 1
                }
              }}
            >
              <ToggleButton value="discussion">
                <MapIcon fontSize="small" sx={{ mr: 1 }} />
                Discussion
              </ToggleButton>
          <ToggleButton value="event">
            <EventNoteIcon fontSize="small" sx={{ mr: 1 }} />
            Event
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {status && (
        <Alert severity={status.type} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}

      {draftStatus && (
        <Alert severity={draftStatus.type} onClose={() => setDraftStatus(null)}>
          {draftStatus.message}
        </Alert>
      )}

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              backgroundColor: 'rgba(255, 255, 255, 0.02)'
            }}
          >
            <Stack spacing={2}>
              <TextField
                label="Title"
                placeholder={
                  pinType === 'event'
                    ? FIGMA_TEMPLATE.fields.titlePlaceholder
                    : "What's the discussion about?"
                }
                value={formState.title}
                onChange={handleFieldChange('title')}
                required
                fullWidth
              />
              <TextField
                label="Description"
                placeholder={
                  pinType === 'event'
                    ? FIGMA_TEMPLATE.fields.descriptionPlaceholder
                    : 'Give everyone the context and what to expect.'
                }
                value={formState.description}
                onChange={handleFieldChange('description')}
                required
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 3,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  backgroundColor: 'rgba(255,255,255,0.02)'
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Location
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {FIGMA_TEMPLATE.fields.locationPrompt}
                </Typography>
                {locationStatus && (
                  <Alert severity={locationStatus.type} onClose={() => setLocationStatus(null)}>
                    {locationStatus.message}
                  </Alert>
                )}
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    height: { xs: 220, sm: 260 },
                    backgroundColor: 'rgba(255,255,255,0.04)'
                  }}
                >
                  <SelectableLocationMap
                    value={selectedCoordinates}
                    onChange={handleMapLocationSelect}
                  />
                </Box>
                {isReverseGeocoding && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Looking up address details...
                    </Typography>
                  </Stack>
                )}
                <Typography variant="caption" color="text.secondary">
                  Click or tap the map to set coordinates. We will auto-fill the address when possible.
                </Typography>
                <TextField
                  label="Latitude"
                  value={formState.latitude}
                  onChange={handleFieldChange('latitude')}
                  required
                  fullWidth
                  placeholder="33.7838"
                />
                <TextField
                  label="Longitude"
                  value={formState.longitude}
                  onChange={handleFieldChange('longitude')}
                  required
                  fullWidth
                  placeholder="-118.1136"
                />
                <TextField
                  label="Proximity radius (miles)"
                  value={formState.proximityRadiusMiles}
                  onChange={handleFieldChange('proximityRadiusMiles')}
                  fullWidth
                  helperText="Optional. Defaults to 1 mile."
                />
              </Paper>
            </Grid>

            <Grid item xs={12} md={8}>
              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  backgroundColor: 'rgba(255,255,255,0.02)'
                }}
              >
                {pinType === 'event' ? (
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Event details
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Let everyone know when and where to show up.
                      </Typography>
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="Start date"
                          type="datetime-local"
                          value={formState.startDate}
                          onChange={handleFieldChange('startDate')}
                          required
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          label="End date"
                          type="datetime-local"
                          value={formState.endDate}
                          onChange={handleFieldChange('endDate')}
                          required
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>

                    <Divider />

                    <Stack spacing={2}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Venue
                      </Typography>
                      <TextField
                        label="Precise address"
                        value={formState.addressPrecise}
                        onChange={handleFieldChange('addressPrecise')}
                        placeholder="University Student Union, Long Beach, CA"
                        fullWidth
                      />
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="City"
                            value={formState.addressCity}
                            onChange={handleFieldChange('addressCity')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="State"
                            value={formState.addressState}
                            onChange={handleFieldChange('addressState')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Postal code"
                            value={formState.addressPostalCode}
                            onChange={handleFieldChange('addressPostalCode')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Country"
                            value={formState.addressCountry}
                            onChange={handleFieldChange('addressCountry')}
                            fullWidth
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Stack>
                ) : (
                  <Stack spacing={3}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Discussion details
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Set how long this discussion should stay active.
                      </Typography>
                    </Box>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={7}>
                        <TextField
                          label="Expires at"
                          type="datetime-local"
                          value={formState.expiresAt}
                          onChange={handleFieldChange('expiresAt')}
                          required
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={5}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={autoDelete}
                              onChange={(event) => setAutoDelete(event.target.checked)}
                            />
                          }
                          label="Auto delete"
                        />
                      </Grid>
                    </Grid>

                    <Divider />

                    <Stack spacing={2}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Approximate address
                      </Typography>
                      <TextField
                        label="Formatted"
                        value={formState.approxFormatted}
                        onChange={handleFieldChange('approxFormatted')}
                        placeholder="Long Beach, CA"
                        fullWidth
                      />
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="City"
                            value={formState.approxCity}
                            onChange={handleFieldChange('approxCity')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="State"
                            value={formState.approxState}
                            onChange={handleFieldChange('approxState')}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            label="Country"
                            value={formState.approxCountry}
                            onChange={handleFieldChange('approxCountry')}
                            fullWidth
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.02)'
            }}
          >
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Images
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Upload up to 10 square images. The highlighted one becomes the cover photo.
                </Typography>
              </Box>

              {uploadStatus && (
                <Alert severity={uploadStatus.type} onClose={() => setUploadStatus(null)}>
                  {uploadStatus.message}
                </Alert>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <Button
                  component="label"
                  variant="outlined"
                  disabled={isUploading || photoAssets.length >= 10}
                  sx={{ minWidth: 180 }}
                >
                  {isUploading ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CircularProgress size={18} />
                      <span>Uploading...</span>
                    </Stack>
                  ) : (
                    'Upload images'
                  )}
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*"
                    onChange={handleImageSelection}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {photoAssets.length}/10 images attached.
                </Typography>
              </Stack>

              {photoAssets.length > 0 && (
                <Grid container spacing={2}>
                  {photoAssets.map((photo) => {
                    const isCover = coverPhotoId === photo.id;
                    return (
                      <Grid item xs={12} sm={6} md={4} key={photo.id}>
                        <Stack spacing={1.5}>
                          <Box
                            sx={{
                              position: 'relative',
                              borderRadius: 2,
                              overflow: 'hidden',
                              border: isCover
                                ? '2px solid #F15BB5'
                                : '1px solid rgba(255,255,255,0.08)',
                              aspectRatio: '1 / 1',
                              backgroundColor: 'rgba(255,255,255,0.04)'
                            }}
                          >
                            <img
                              src={photo.asset.url}
                              alt={photo.asset.description || 'Pin image'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            {isCover && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  left: 8,
                                  px: 1,
                                  py: 0.25,
                                  borderRadius: 999,
                                  backgroundColor: 'rgba(0,0,0,0.65)',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}
                              >
                                Cover photo
                              </Box>
                            )}
                          </Box>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant={isCover ? 'contained' : 'outlined'}
                              onClick={() => handleSetCoverPhoto(photo.id)}
                              disabled={isCover}
                            >
                              {isCover ? 'Selected' : 'Set as cover'}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => handleRemovePhoto(photo.id)}
                            >
                              Remove
                            </Button>
                          </Stack>
                        </Stack>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Stack>
          </Paper>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button type="button" variant="outlined" onClick={resetForm}>
                Reset form
              </Button>
              <Button type="button" variant="outlined" onClick={handleSaveDraft} disabled={isSubmitting}>
                Save draft
              </Button>
            </Stack>
            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Pin'}
            </Button>
          </Stack>

          {resultJson && (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                backgroundColor: 'rgba(15,18,28,0.9)',
                p: 2,
                maxHeight: 280,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.85rem'
              }}
            >
              <pre style={{ margin: 0 }}>{resultJson}</pre>
            </Paper>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default CreatePinPage;
