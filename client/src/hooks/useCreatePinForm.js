import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { haversineDistanceMeters, metersToMiles } from '../utils/geo';
import usePinMediaQueue from './pin/usePinMediaQueue';
import usePinDraftPersistence from './pin/usePinDraftPersistence';
import usePinSubmissionWorkflow from './pin/usePinSubmissionWorkflow';
import {
  extractReverseGeocodeFields,
  formatDateTimeLocalInput
} from '../utils/pinFormValidation';
import {
  MAX_PIN_DISTANCE_MILES,
  MAX_PIN_DISTANCE_METERS,
  MILLISECONDS_PER_DAY,
  EVENT_MAX_LEAD_TIME_MS,
  DISCUSSION_MAX_DURATION_MS,
  DEFAULT_APPROX_MESSAGE
} from './pin/pinFormConstants';
const MAX_PHOTO_UPLOADS = 3;

const createInitialFormState = () => ({
  ...INITIAL_FORM_STATE,
  expiresAt: formatDateTimeLocalInput(
    new Date(Date.now() + 3 * MILLISECONDS_PER_DAY)
  )
});

export const INITIAL_FORM_STATE = {
  title: '',
  description: '',
  latitude: '',
  longitude: '',
  proximityRadiusMiles: '1',
  startDate: '',
  endDate: '',
  expiresAt: '',
  participantLimit: '30',
  replyLimit: '100',
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

const noop = () => {};

export default function useCreatePinForm({
  isOffline,
  viewerLocation,
  announceBadgeEarned = noop,
  onPinCreated = noop
} = {}) {
  const [pinType, setPinType] = useState('discussion');
  const [formState, setFormState] = useState(() => createInitialFormState());
  const [autoDelete, setAutoDelete] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [createdPin, setCreatedPin] = useState(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null);

  const {
    photoAssets,
    coverPhotoId,
    isUploading,
    uploadStatus,
    clearUploadStatus,
    handleImageSelection,
    handleRemovePhoto,
    handleSetCoverPhoto,
    hydrateMedia,
    resetMedia
  } = usePinMediaQueue({ isOffline, maxPhotos: MAX_PHOTO_UPLOADS });

  const {
    draftStatus,
    handleSaveDraft,
    clearDraft,
    clearDraftStatus
  } = usePinDraftPersistence({
    pinType,
    setPinType,
    autoDelete,
    setAutoDelete,
    formState,
    setFormState,
    photoAssets,
    coverPhotoId,
    hydrateMedia
  });

  const lastReverseGeocodeRef = useRef(null);

  const viewerCoordinates = useMemo(() => {
    const latitude = Number.parseFloat(viewerLocation?.latitude);
    const longitude = Number.parseFloat(viewerLocation?.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }, [viewerLocation]);

  useEffect(() => {
    if (!viewerCoordinates) {
      return;
    }
    setFormState((prev) => {
      const latEmpty = !prev.latitude;
      const lngEmpty = !prev.longitude;
      const approxEmpty =
        !prev.approxFormatted && !prev.approxCity && !prev.approxState && !prev.approxCountry;
      if (!latEmpty && !lngEmpty && !approxEmpty) {
        return prev;
      }
      const formattedLat = viewerCoordinates.latitude.toFixed(6);
      const formattedLng = viewerCoordinates.longitude.toFixed(6);
      return {
        ...prev,
        latitude: latEmpty ? formattedLat : prev.latitude,
        longitude: lngEmpty ? formattedLng : prev.longitude,
        approxFormatted: approxEmpty ? DEFAULT_APPROX_MESSAGE : prev.approxFormatted
      };
    });
  }, [viewerCoordinates]);

  const activeTheme = useMemo(() => PIN_TYPE_THEMES[pinType], [pinType]);

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
  }, [endDateValue, pinType, startDateValue]);

  const selectedCoordinates = useMemo(() => {
    const latitude = Number.parseFloat(formState.latitude);
    const longitude = Number.parseFloat(formState.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { lat: latitude, lng: longitude };
    }
    return null;
  }, [formState.latitude, formState.longitude]);

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
        const miles = metersToMiles(distanceMeters);
        const milesLabel = miles === null ? 'farther' : `${miles.toFixed(1)} miles`;
        setLocationStatus({
          type: 'error',
          message: `Pins must be within ${MAX_PIN_DISTANCE_MILES} miles of you. This spot is about ${milesLabel} away.`
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
    if (!selectedCoordinates || isReverseGeocoding) {
      return;
    }
    void reverseGeocodeCoordinates(selectedCoordinates.lat, selectedCoordinates.lng);
  }, [isReverseGeocoding, reverseGeocodeCoordinates, selectedCoordinates]);

  const resetForm = useCallback(() => {
    clearDraft();
    setPinType('discussion');
    setFormState(createInitialFormState());
    setAutoDelete(true);
    setStatus(null);
    clearDraftStatus();
    setCreatedPin(null);
    resetMedia();
    clearUploadStatus();
    setLocationStatus(null);
    setIsReverseGeocoding(false);
  }, [clearDraft, clearDraftStatus, clearUploadStatus, resetMedia]);

  const { handleSubmit } = usePinSubmissionWorkflow({
    formState,
    pinType,
    autoDelete,
    viewerCoordinates,
    photoAssets,
    coverPhotoId,
    isOffline,
    announceBadgeEarned,
    clearDraft,
    clearDraftStatus,
    onPinCreated,
    setStatus,
    setIsSubmitting,
    setCreatedPin
  });

  const resultJson = useMemo(() => {
    if (!createdPin) {
      return null;
    }
    return JSON.stringify(createdPin, null, 2);
  }, [createdPin]);

  const clearStatus = useCallback(() => setStatus(null), []);
  const clearLocationStatus = useCallback(() => setLocationStatus(null), []);

  return {
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
    createdPin,
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
    handleSubmit,
    reverseGeocodeCoordinates,
    isOffline
  };
}

export { PIN_TYPE_THEMES, formatDateTimeLocalInput };
export { sanitizeNumberField, sanitizeDateField } from '../utils/pinFormValidation';
