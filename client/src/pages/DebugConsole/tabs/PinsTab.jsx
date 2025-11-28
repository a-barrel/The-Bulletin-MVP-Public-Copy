import { useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ForumIcon from '@mui/icons-material/Forum';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import MapIcon from '@mui/icons-material/Map';
import NearMeIcon from '@mui/icons-material/NearMe';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RefreshIcon from '@mui/icons-material/Refresh';

import {
  createPin,
  fetchPinById,
  fetchPinsNearby,
  fetchPinsSortedByDistance,
  fetchPinsSortedByExpiration,
  fetchExpiredPins,
  listPins
} from '../../../api';
import LeafletMap from '../../../components/Map';
import JsonPreview from '../components/JsonPreview';
import {
  DEFAULT_LOCATION_COORDINATES,
  INITIAL_COORDINATES
} from '../constants';
import {
  extractPinLocation,
  formatDateTimeLocal,
  formatDistanceMiles,
  parseOptionalNumber,
  parseRequiredNumber,
  resolveMediaUrl
} from '../utils';
import formatDateTime, { formatRelativeTime } from '../../../utils/dates';
import DebugPanel from '../components/DebugPanel';

function PinsTab() {
  const [pinType, setPinType] = useState('event');
  const [formState, setFormState] = useState({
    title: '',
    description: '',
    latitude: INITIAL_COORDINATES.latitude,
    longitude: INITIAL_COORDINATES.longitude,
    proximityRadiusMiles: '1',
    startDate: '',
    endDate: '',
    expiresAt: '',
    addressPrecise: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    addressCountry: '',
    approximateCity: '',
    approximateState: '',
    approximateCountry: '',
    approximateFormatted: ''
  });
  const [pinStatus, setPinStatus] = useState(null);
  const [createdPin, setCreatedPin] = useState(null);
  const [pinIdInput, setPinIdInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPin, setIsFetchingPin] = useState(false);
  const [distanceMiles, setDistanceMiles] = useState('5');
  const [nearbyPins, setNearbyPins] = useState([]);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);
  const [allPins, setAllPins] = useState([]);
  const [isFetchingAllPins, setIsFetchingAllPins] = useState(false);
  const [allPinsLimit, setAllPinsLimit] = useState('20');
  const [distanceSortLatitude, setDistanceSortLatitude] = useState(
    String(DEFAULT_LOCATION_COORDINATES.latitude)
  );
  const [distanceSortLongitude, setDistanceSortLongitude] = useState(
    String(DEFAULT_LOCATION_COORDINATES.longitude)
  );
  const [expiringPins, setExpiringPins] = useState([]);
  const [isFetchingExpiringPins, setIsFetchingExpiringPins] = useState(false);
  const [expiringDays, setExpiringDays] = useState('3');
  const [expiredPins, setExpiredPins] = useState([]);
  const [isFetchingExpiredPins, setIsFetchingExpiredPins] = useState(false);
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [mapFocusLocation, setMapFocusLocation] = useState(null);

  const searchCenterLocation = useMemo(() => {
    const latitude = Number.parseFloat(formState.latitude);
    const longitude = Number.parseFloat(formState.longitude);
    if (
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude) &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return { latitude, longitude };
    }
    return null;
  }, [formState.latitude, formState.longitude]);

  const mapPins = useMemo(() => {
    const seen = new globalThis.Map();
    const append = (pin) => {
      if (!pin) {
        return;
      }
      const coordinates = pin?.coordinates?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return;
      }
      const [longitude, latitude] = coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }
      const key = pin._id ?? `${latitude}-${longitude}`;
      if (!seen.has(key) || (!seen.get(key).distanceMeters && pin.distanceMeters)) {
        seen.set(key, { ...pin });
      }
    };

    append(createdPin);
    (Array.isArray(nearbyPins) ? nearbyPins : []).forEach(append);
    (Array.isArray(allPins) ? allPins : []).forEach(append);
    (Array.isArray(expiringPins) ? expiringPins : []).forEach(append);
    (Array.isArray(expiredPins) ? expiredPins : []).forEach(append);
    return Array.from(seen.values());
  }, [createdPin, nearbyPins, allPins, expiringPins, expiredPins]);

  const latestCreatedPinLocation = useMemo(() => extractPinLocation(createdPin), [createdPin]);

  const createdPinMedia = useMemo(() => {
    if (!createdPin) {
      return { coverPhotoUrl: null, photoAssets: [] };
    }

    const coverPhotoUrl = createdPin.coverPhoto?.url ?? null;
    const photoAssets = Array.isArray(createdPin.photos)
      ? createdPin.photos.filter((photo) => {
          if (!photo || !photo.url) {
            return false;
          }
          if (coverPhotoUrl && photo.url === coverPhotoUrl) {
            return false;
          }
          return true;
        })
      : [];

    return { coverPhotoUrl, photoAssets };
  }, [createdPin]);

  const mapCenterOverride = useMemo(
    () => mapFocusLocation ?? latestCreatedPinLocation ?? searchCenterLocation ?? null,
    [mapFocusLocation, latestCreatedPinLocation, searchCenterLocation]
  );

  const isEvent = useMemo(() => pinType === 'event', [pinType]);

  const handlePinTypeChange = (_event, value) => {
    if (value) {
      setPinType(value);
      setPinStatus(null);
    }
  };

  const handleFieldChange = (field) => (event) => {
    const { value } = event.target;
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const applyPreset = (type, values) => {
    setPinStatus(null);
    setPinType(type);
    setFormState((prev) => ({
      ...prev,
      ...values
    }));
  };

  const handleAutofillEvent = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    applyPreset('event', {
      title: 'Community Beach Cleanup',
      description:
        'Help us tidy the shoreline this weekend. Gloves, bags, and refreshments provided.',
      latitude: '33.7683',
      longitude: '-118.1956',
      proximityRadiusMiles: '0.75',
      startDate: formatDateTimeLocal(start),
      endDate: formatDateTimeLocal(end),
      expiresAt: '',
      addressPrecise: 'Long Beach Shoreline Marina',
      addressCity: 'Long Beach',
      addressState: 'CA',
      addressPostalCode: '90802',
      addressCountry: 'USA',
      approximateCity: '',
      approximateState: '',
      approximateCountry: '',
      approximateFormatted: ''
    });
  };

  const handleAutofillDiscussion = () => {
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    applyPreset('discussion', {
      title: 'Neighborhood Watch Check-in',
      description:
        'Share recent observations around the neighborhood so we can coordinate patrols.',
      latitude: '33.7838',
      longitude: '-118.1136',
      proximityRadiusMiles: '0.5',
      startDate: '',
      endDate: '',
      expiresAt: formatDateTimeLocal(expires),
      addressPrecise: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: '',
      approximateCity: 'Long Beach',
      approximateState: 'CA',
      approximateCountry: 'USA',
      approximateFormatted: 'Long Beach, CA'
    });
  };

  const handleDistanceChange = (event) => {
    setDistanceMiles(event.target.value);
  };

  const handleFetchNearbyPins = async () => {
    setPinStatus(null);
    const miles = Number.parseFloat(distanceMiles);
    if (Number.isNaN(miles) || miles <= 0) {
      setPinStatus({ type: 'error', message: 'Provide a distance in miles greater than 0.' });
      return;
    }

    let latitude;
    let longitude;
    try {
      latitude = parseRequiredNumber(formState.latitude, 'Latitude');
      longitude = parseRequiredNumber(formState.longitude, 'Longitude');
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingNearby(true);
      setNearbyPins([]);
      if (searchCenterLocation) {
        setMapFocusLocation(searchCenterLocation);
      }
      const pins = await fetchPinsNearby({
        latitude,
        longitude,
        distanceMiles: miles
      });
      setNearbyPins(pins);
      if (pins.length > 0) {
        const focus = extractPinLocation(pins[0]);
        if (focus) {
          setMapFocusLocation(focus);
        }
      }
      setPinStatus({
        type: 'success',
        message: pins.length
          ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} within ${miles} miles.`
          : `No pins found within ${miles} miles.`
      });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to fetch nearby pins.' });
    } finally {
      setIsFetchingNearby(false);
    }
  };

  const handleAllPinsLimitChange = (event) => {
    setAllPinsLimit(event.target.value);
  };

  const resolvePinListLimit = () => {
    let limitValue = parseOptionalNumber(allPinsLimit, 'Limit');
    if (limitValue === undefined) {
      limitValue = 20;
    }
    if (!Number.isFinite(limitValue) || limitValue <= 0) {
      throw new Error('Limit must be greater than 0.');
    }
    if (limitValue > 50) {
      throw new Error('Limit cannot exceed 50.');
    }
    return limitValue;
  };

  const focusOnFirstPin = (pins) => {
    if (pins.length === 0) {
      return;
    }
    const focus = extractPinLocation(pins[0]);
    if (focus) {
      setMapFocusLocation(focus);
    }
    if (pins[0]?._id) {
      setSelectedPinId(pins[0]._id);
      setPinIdInput(pins[0]._id);
    }
  };

  const handleFetchAllPins = async () => {
    setPinStatus(null);
    let limitValue;
    try {
      limitValue = resolvePinListLimit();
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingAllPins(true);
      const pins = await listPins({ limit: limitValue });
      setAllPins(pins);
      focusOnFirstPin(pins);
      setPinStatus({
        type: pins.length ? 'success' : 'info',
        message: pins.length
          ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} (latest first).`
          : 'No pins found.'
      });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to load pins.' });
    } finally {
      setIsFetchingAllPins(false);
    }
  };

  const handleDistanceSortLatitudeChange = (event) => {
    setDistanceSortLatitude(event.target.value);
  };

  const handleDistanceSortLongitudeChange = (event) => {
    setDistanceSortLongitude(event.target.value);
  };

  const handleSortPinsByDistance = async () => {
    setPinStatus(null);
    let limitValue;
    try {
      limitValue = resolvePinListLimit();
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    let latitude;
    let longitude;
    try {
      latitude = parseRequiredNumber(distanceSortLatitude, 'Latitude');
      longitude = parseRequiredNumber(distanceSortLongitude, 'Longitude');
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingAllPins(true);
      const pins = await fetchPinsSortedByDistance({
        limit: limitValue,
        latitude,
        longitude
      });
      setAllPins(pins);
      focusOnFirstPin(pins);
      setPinStatus({
        type: pins.length ? 'success' : 'info',
        message: pins.length
          ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} sorted by distance (closest first).`
          : 'No pins found for the provided coordinates.'
      });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to sort pins by distance.' });
    } finally {
      setIsFetchingAllPins(false);
    }
  };

  const handleSortPinsByExpiration = async () => {
    setPinStatus(null);
    let limitValue;
    try {
      limitValue = resolvePinListLimit();
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingAllPins(true);
      const pins = await fetchPinsSortedByExpiration({
        limit: limitValue,
        status: 'active'
      });
      setAllPins(pins);
      focusOnFirstPin(pins);
      setPinStatus({
        type: pins.length ? 'success' : 'info',
        message: pins.length
          ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} sorted by soonest expiration.`
          : 'No pins with upcoming expiration dates were found.'
      });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to sort pins by expiration.' });
    } finally {
      setIsFetchingAllPins(false);
    }
  };

  const handleFetchExpiredPins = async () => {
    setPinStatus(null);
    let limitValue;
    try {
      limitValue = resolvePinListLimit();
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingExpiredPins(true);
      setExpiredPins([]);
      const pins = await fetchExpiredPins({ limit: limitValue });
      setExpiredPins(pins);
      focusOnFirstPin(pins);
      setPinStatus({
        type: pins.length ? 'warning' : 'info',
        message: pins.length
          ? `Loaded ${pins.length} expired pin${pins.length === 1 ? '' : 's'} (oldest first).`
          : 'No expired pins found.'
      });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to load expired pins.' });
    } finally {
      setIsFetchingExpiredPins(false);
    }
  };

  const handleExpiringDaysChange = (event) => {
    setExpiringDays(event.target.value);
  };

  const handleFetchExpiringPins = async () => {
    setPinStatus(null);
    let daysValue;
    try {
      daysValue = parseOptionalNumber(expiringDays, 'Days');
      if (daysValue === undefined) {
        throw new Error('Provide the number of days to use for the expiration window.');
      }
      if (!Number.isFinite(daysValue) || daysValue <= 0) {
        throw new Error('Days must be greater than 0.');
      }
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingExpiringPins(true);
      const pins = await fetchPinsSortedByExpiration({ limit: 50, status: 'active' });
      const now = new Date();
      const cutoff = new Date(now.getTime() + daysValue * 24 * 60 * 60 * 1000);
      const filtered = pins.filter((pin) => {
        const iso = pin?.expiresAt ?? pin?.endDate ?? null;
        if (!iso) {
          return false;
        }
        const expiry = new Date(iso);
        if (Number.isNaN(expiry.getTime())) {
          return false;
        }
        return expiry >= now && expiry <= cutoff;
      });
      setExpiringPins(filtered);
      focusOnFirstPin(filtered);
      setPinStatus({
        type: filtered.length ? 'success' : 'info',
        message: filtered.length
          ? `Found ${filtered.length} pin${filtered.length === 1 ? '' : 's'} expiring in the next ${daysValue} day${daysValue === 1 ? '' : 's'}.`
          : `No pins expire within the next ${daysValue} day${daysValue === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to load expiring pins.' });
    } finally {
      setIsFetchingExpiringPins(false);
    }
  };

  const getPinExpirationInfo = (pin) => {
    const iso = pin?.expiresAt ?? pin?.endDate ?? null;
    if (!iso) {
      return null;
    }

    const target = new Date(iso);
    if (Number.isNaN(target.getTime())) {
      return {
        primary: 'Expiration date unavailable',
        secondary: null
      };
    }

    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const absolute = formatDateTime(target);
    if (diffMs >= 0) {
      const relative = formatRelativeTime(target);
      return {
        primary: `Expires ${absolute}`,
        secondary: relative
      };
    }

    return {
      primary: `Expired ${absolute}`,
      secondary: 'This pin is no longer visible to end users.'
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setPinStatus(null);
    setIsSubmitting(true);

    try {
      const latitude = parseRequiredNumber(formState.latitude, 'Latitude');
      const longitude = parseRequiredNumber(formState.longitude, 'Longitude');
      const proximityRadiusMiles =
        formState.proximityRadiusMiles && formState.proximityRadiusMiles.trim()
          ? parseRequiredNumber(formState.proximityRadiusMiles, 'Proximity radius')
          : 1;

      const payload = {
        type: pinType,
        title: formState.title.trim(),
        description: formState.description.trim(),
        latitude,
        longitude,
        proximityRadiusMiles
      };

      if (pinType === 'event') {
        payload.startDate = formState.startDate;
        payload.endDate = formState.endDate;
      } else {
        payload.expiresAt = formState.expiresAt;
      }

      const address = {
        precise: formState.addressPrecise.trim(),
        city: formState.addressCity.trim(),
        state: formState.addressState.trim(),
        postalCode: formState.addressPostalCode.trim(),
        country: formState.addressCountry.trim()
      };

      if (Object.values(address).some((value) => value)) {
        payload.address = address;
      }

      const approximate = {
        city: formState.approximateCity.trim(),
        state: formState.approximateState.trim(),
        country: formState.approximateCountry.trim(),
        formatted: formState.approximateFormatted.trim()
      };

      if (Object.values(approximate).some((value) => value)) {
        payload.approximateLocation = approximate;
      }

      const result = await createPin(payload);
      setCreatedPin(result);
      setSelectedPinId(result?._id ?? null);

      const resultLocation = extractPinLocation(result);
      if (resultLocation) {
        setMapFocusLocation(resultLocation);
      } else if (searchCenterLocation) {
        setMapFocusLocation(searchCenterLocation);
      }
      setPinIdInput(result?._id ?? '');

      let statusMessage = 'Pin created successfully.';

      if (result?._id) {
        try {
          const persistedPin = await fetchPinById(result._id);
          setCreatedPin(persistedPin);
          setSelectedPinId(persistedPin?._id ?? null);
          const persistedLocation = extractPinLocation(persistedPin);
          if (persistedLocation) {
            setMapFocusLocation(persistedLocation);
          }
          statusMessage = 'Pin created and reloaded from MongoDB.';
        } catch (reloadError) {
          console.warn('Failed to reload pin after creation', reloadError);
          statusMessage = 'Pin created successfully. Reloading from MongoDB failed.';
        }
      }

      setPinStatus({ type: 'success', message: statusMessage });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to create pin.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchPin = async () => {
    const pinId = pinIdInput.trim();
    if (!pinId) {
      setPinStatus({ type: 'error', message: 'Provide a Pin ID to fetch.' });
      return;
    }

    try {
      setIsFetchingPin(true);
      const pin = await fetchPinById(pinId);
      setCreatedPin(pin);
      setSelectedPinId(pin?._id ?? null);
      const pinLocation = extractPinLocation(pin);
      if (pinLocation) {
        setMapFocusLocation(pinLocation);
      }
      setPinStatus({ type: 'success', message: 'Pin loaded from MongoDB.' });
    } catch (error) {
      setPinStatus({ type: 'error', message: error.message || 'Failed to fetch pin.' });
    } finally {
      setIsFetchingPin(false);
    }
  };

  return (
    <Stack spacing={3}>
      {pinStatus && (
        <Alert severity={pinStatus.type} onClose={() => setPinStatus(null)}>
          {pinStatus.message}
        </Alert>
      )}

      <DebugPanel
        component="form"
        onSubmit={handleSubmit}
        title="Pin Details"
        actions={
          <ToggleButtonGroup
            value={pinType}
            exclusive
            color="primary"
            onChange={handlePinTypeChange}
            size="small"
          >
            <ToggleButton value="event" aria-label="Event pin">
              <Stack direction="row" spacing={1} alignItems="center">
                <EventNoteIcon fontSize="small" />
                <span>Event</span>
              </Stack>
            </ToggleButton>
            <ToggleButton value="discussion" aria-label="Discussion pin">
              <Stack direction="row" spacing={1} alignItems="center">
                <ForumIcon fontSize="small" />
                <span>Discussion</span>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>
        }
        sx={{ gap: 3 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="flex-end"
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Button
            type="button"
            variant="outlined"
            size="small"
            startIcon={<EventNoteIcon fontSize="small" />}
            onClick={handleAutofillEvent}
          >
            Autofill Event
          </Button>
          <Button
            type="button"
            variant="outlined"
            size="small"
            startIcon={<ForumIcon fontSize="small" />}
            onClick={handleAutofillDiscussion}
          >
            Autofill Discussion
          </Button>
        </Stack>

        <TextField
          required
          label="Title"
          value={formState.title}
          onChange={handleFieldChange('title')}
          placeholder="Community meetup"
        />

        <TextField
          required
          multiline
          minRows={3}
          label="Description"
          value={formState.description}
          onChange={handleFieldChange('description')}
          placeholder="Share what this pin is about..."
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            required
            label="Latitude"
            value={formState.latitude}
            onChange={handleFieldChange('latitude')}
            InputProps={{ inputMode: 'decimal' }}
          />
          <TextField
            required
            label="Longitude"
            value={formState.longitude}
            onChange={handleFieldChange('longitude')}
            InputProps={{ inputMode: 'decimal' }}
          />
          <TextField
            label="Proximity radius (miles)"
            value={formState.proximityRadiusMiles}
            onChange={handleFieldChange('proximityRadiusMiles')}
            helperText="Defaults to 1 mile if left blank"
            InputProps={{ inputMode: 'decimal' }}
          />
        </Stack>

        {isEvent ? (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                required
                label="Start date"
                type="datetime-local"
                value={formState.startDate}
                onChange={handleFieldChange('startDate')}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                required
                label="End date"
                type="datetime-local"
                value={formState.endDate}
                onChange={handleFieldChange('endDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            <Divider flexItem />

            <Typography variant="subtitle1">Optional event address</Typography>
            <Stack spacing={2}>
              <TextField
                label="Precise address / venue name"
                value={formState.addressPrecise}
                onChange={handleFieldChange('addressPrecise')}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="City"
                  value={formState.addressCity}
                  onChange={handleFieldChange('addressCity')}
                />
                <TextField
                  label="State"
                  value={formState.addressState}
                  onChange={handleFieldChange('addressState')}
                />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Postal code"
                  value={formState.addressPostalCode}
                  onChange={handleFieldChange('addressPostalCode')}
                />
                <TextField
                  label="Country"
                  value={formState.addressCountry}
                  onChange={handleFieldChange('addressCountry')}
                />
              </Stack>
            </Stack>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              required
              label="Expires at"
              type="datetime-local"
              value={formState.expiresAt}
              onChange={handleFieldChange('expiresAt')}
              InputLabelProps={{ shrink: true }}
            />

            <Divider flexItem />

            <Typography variant="subtitle1">Optional approximate address</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="City"
                value={formState.approximateCity}
                onChange={handleFieldChange('approximateCity')}
              />
              <TextField
                label="State"
                value={formState.approximateState}
                onChange={handleFieldChange('approximateState')}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Country"
                value={formState.approximateCountry}
                onChange={handleFieldChange('approximateCountry')}
              />
              <TextField
                label="Formatted location label"
                value={formState.approximateFormatted}
                onChange={handleFieldChange('approximateFormatted')}
              />
            </Stack>
          </Stack>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="flex-end">
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddLocationAltIcon />}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Posting...' : 'Post Pin'}
          </Button>
        </Stack>
      </DebugPanel>

      <DebugPanel
        title="Test saved pin"
        description="Fetch the pin you just created directly from MongoDB."
        sx={{ gap: 2 }}
      >

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="Pin ID"
            value={pinIdInput}
            onChange={(event) => setPinIdInput(event.target.value)}
            placeholder="Paste a pin id"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MapIcon fontSize="small" color="action" />
                </InputAdornment>
              )
            }}
          />
          <Button
            type="button"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleFetchPin}
            disabled={isFetchingPin}
          >
            {isFetchingPin ? 'Loading...' : 'Fetch Pin'}
          </Button>
        </Stack>

        {createdPin && (
          <Stack spacing={2}>
            {(createdPinMedia.coverPhotoUrl || createdPinMedia.photoAssets.length > 0) && (
              <Stack spacing={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Linked media
                </Typography>
                {createdPinMedia.coverPhotoUrl && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Cover photo
                    </Typography>
                    <Box
                      component="img"
                      src={resolveMediaUrl(createdPinMedia.coverPhotoUrl)}
                      alt="Pin cover"
                      sx={{
                        mt: 1,
                        width: '100%',
                        maxHeight: 240,
                        objectFit: 'contain',
                        backgroundColor: 'grey.900',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider'
                      }}
                    />
                  </Box>
                )}
                {createdPinMedia.photoAssets.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {createdPinMedia.photoAssets.map((photo, index) => {
                      const displayUrl = photo.thumbnailUrl || photo.url;
                      return (
                        <Box
                          key={photo.url || displayUrl || `photo-${index}`}
                          component="img"
                          src={resolveMediaUrl(displayUrl)}
                          alt={`Pin photo ${index + 1}`}
                          sx={{
                            width: 120,
                            height: 120,
                            objectFit: 'contain',
                            backgroundColor: 'grey.900',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        />
                      );
                    })}
                  </Box>
                )}
              </Stack>
            )}
            <JsonPreview data={createdPin} />
          </Stack>
        )}
      </DebugPanel>

      <DebugPanel
        title="Find nearby pins"
        description="Search for pins near the coordinates above to verify radius queries."
        sx={{ gap: 2 }}
      >

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="Distance (miles)"
            value={distanceMiles}
            onChange={handleDistanceChange}
            InputProps={{ inputMode: 'decimal' }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <Button
            type="button"
            variant="outlined"
            startIcon={<MapIcon />}
            onClick={handleFetchNearbyPins}
            disabled={isFetchingNearby}
          >
            {isFetchingNearby ? 'Searching...' : 'Fetch nearby pins'}
          </Button>
        </Stack>

        {nearbyPins.length > 0 ? (
          <Stack spacing={1}>
            {nearbyPins.map((pin) => {
              const distanceLabel = formatDistanceMiles(pin.distanceMeters);
              return (
                <Paper key={pin._id} variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">{pin.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {(pin.type === 'event' ? 'Event' : 'Discussion') + ' pin'}
                      {distanceLabel ? ` - ${distanceLabel} mi away` : ''}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {pin._id}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isFetchingNearby
              ? 'Searching for pins...'
              : 'Enter a distance and fetch to list pins near the provided coordinates.'}
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Load and sort pins"
        description="Fetch recent pins or sort them by expiration or distance."
        sx={{ gap: 2 }}
      >

        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <TextField
              label="Limit (max 50)"
              value={allPinsLimit}
              onChange={handleAllPinsLimitChange}
              InputProps={{ inputMode: 'numeric' }}
              sx={{ width: { xs: '100%', md: 200 } }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                type="button"
                variant="outlined"
                startIcon={<MapIcon />}
                onClick={handleFetchAllPins}
                disabled={isFetchingAllPins}
              >
                {isFetchingAllPins ? 'Loading...' : 'Fetch recent pins'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={handleSortPinsByExpiration}
                disabled={isFetchingAllPins}
              >
                {isFetchingAllPins ? 'Sorting...' : 'Sort by expiration'}
              </Button>
            </Stack>
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', md: 'center' }}
          >
            <TextField
              label="Latitude"
              value={distanceSortLatitude}
              onChange={handleDistanceSortLatitudeChange}
              InputProps={{ inputMode: 'decimal' }}
              sx={{ width: { xs: '100%', md: 200 } }}
            />
            <TextField
              label="Longitude"
              value={distanceSortLongitude}
              onChange={handleDistanceSortLongitudeChange}
              InputProps={{ inputMode: 'decimal' }}
              sx={{ width: { xs: '100%', md: 200 } }}
            />
            <Button
              type="button"
              variant="outlined"
              startIcon={<NearMeIcon />}
              onClick={handleSortPinsByDistance}
              disabled={isFetchingAllPins}
            >
              {isFetchingAllPins ? 'Sorting...' : 'Sort by distance'}
            </Button>
          </Stack>
        </Stack>

        {allPins.length > 0 ? (
          <Stack spacing={1}>
            {allPins.map((pin) => {
              const distanceLabel = formatDistanceMiles(pin.distanceMeters);
              const expirationInfo = getPinExpirationInfo(pin);
              return (
                <Paper
                  key={pin._id}
                  variant="outlined"
                  sx={{ p: 2, cursor: 'pointer' }}
                  onClick={() => {
                    if (!pin?._id) {
                      return;
                    }
                    setSelectedPinId(pin._id);
                    setPinIdInput(pin._id);
                    const focus = extractPinLocation(pin);
                    if (focus) {
                      setMapFocusLocation(focus);
                    }
                  }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">{pin.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {(pin.type === 'event' ? 'Event' : 'Discussion') + ' pin'}
                    </Typography>
                    {distanceLabel ? (
                      <Typography variant="body2" color="text.secondary">
                        Distance: {distanceLabel} mi
                      </Typography>
                    ) : null}
                    {expirationInfo ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {expirationInfo.primary}
                        </Typography>
                        {expirationInfo.secondary ? (
                          <Typography variant="body2" color="text.secondary">
                            {expirationInfo.secondary}
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No expiration date on record
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {pin._id}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isFetchingAllPins
              ? 'Loading pins...'
              : 'Results will appear here after fetching or sorting.'}
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Expiring pins"
        description="Identify pins that will expire soon."
        sx={{ gap: 2 }}
      >

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="Days ahead"
            value={expiringDays}
            onChange={handleExpiringDaysChange}
            InputProps={{ inputMode: 'numeric' }}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <Button
            type="button"
            variant="outlined"
            startIcon={<EventNoteIcon />}
            onClick={handleFetchExpiringPins}
            disabled={isFetchingExpiringPins}
          >
            {isFetchingExpiringPins ? 'Scanning...' : 'Fetch expiring pins'}
          </Button>
        </Stack>

        {expiringPins.length > 0 ? (
          <Stack spacing={1}>
            {expiringPins.map((pin) => {
              const expirationInfo = getPinExpirationInfo(pin);
              return (
                <Paper
                  key={pin._id}
                  variant="outlined"
                  sx={{ p: 2, cursor: 'pointer' }}
                  onClick={() => {
                    if (!pin?._id) {
                      return;
                    }
                    setSelectedPinId(pin._id);
                    setPinIdInput(pin._id);
                    const focus = extractPinLocation(pin);
                    if (focus) {
                      setMapFocusLocation(focus);
                    }
                  }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">{pin.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {(pin.type === 'event' ? 'Event' : 'Discussion') + ' pin'}
                    </Typography>
                    {expirationInfo ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {expirationInfo.primary}
                        </Typography>
                        {expirationInfo.secondary ? (
                          <Typography variant="body2" color="text.secondary">
                            {expirationInfo.secondary}
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No expiration date on record
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {pin._id}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isFetchingExpiringPins ? 'Scanning...' : 'Results will appear here after fetching.'}
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Expired pins"
        description="Review pins whose expiration date has passed."
        sx={{ gap: 2 }}
      >

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <Button
            type="button"
            variant="outlined"
            startIcon={<HistoryToggleOffIcon />}
            onClick={handleFetchExpiredPins}
            disabled={isFetchingExpiredPins}
          >
            {isFetchingExpiredPins ? 'Loading...' : 'Fetch expired pins'}
          </Button>
        </Stack>

        {expiredPins.length > 0 ? (
          <Stack spacing={1}>
            {expiredPins.map((pin) => {
              const distanceLabel = formatDistanceMiles(pin.distanceMeters);
              const expirationInfo = getPinExpirationInfo(pin);
              return (
                <Paper
                  key={pin._id}
                  variant="outlined"
                  sx={{ p: 2, cursor: 'pointer' }}
                  onClick={() => {
                    if (!pin?._id) {
                      return;
                    }
                    setSelectedPinId(pin._id);
                    setPinIdInput(pin._id);
                    const focus = extractPinLocation(pin);
                    if (focus) {
                      setMapFocusLocation(focus);
                    }
                  }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">{pin.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {(pin.type === 'event' ? 'Event' : 'Discussion') + ' pin'}
                    </Typography>
                    {expirationInfo ? (
                      <>
                        <Typography variant="body2" color="text.secondary">
                          {expirationInfo.primary}
                        </Typography>
                        {expirationInfo.secondary ? (
                          <Typography variant="body2" color="text.secondary">
                            {expirationInfo.secondary}
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No expiration date on record
                      </Typography>
                    )}
                    {distanceLabel ? (
                      <Typography variant="body2" color="text.secondary">
                        Distance: {distanceLabel} mi
                      </Typography>
                    ) : null}
                    <Typography variant="body2" color="text.secondary">
                      {pin._id}
                    </Typography>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isFetchingExpiredPins
              ? 'Loading expired pins...'
              : 'Expired pins stay hidden until you fetch them here.'}
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Map preview"
        description="Markers reflect the pins returned above. Click a marker to populate its ID for quick lookups."
        sx={{ gap: 2 }}
      >
        <Box sx={{ height: 360, mt: 1, borderRadius: 2, overflow: 'hidden' }}>
          <LeafletMap
            userLocation={searchCenterLocation ?? undefined}
            centerOverride={mapCenterOverride ?? undefined}
            pins={mapPins}
            selectedPinId={selectedPinId ?? undefined}
            onPinSelect={(pin) => {
              if (!pin?._id) {
                return;
              }
              setPinIdInput(pin._id);
              setSelectedPinId(pin._id);
              const focus = extractPinLocation(pin);
              if (focus) {
                setMapFocusLocation(focus);
              }
            }}
          />
        </Box>
      </DebugPanel>
    </Stack>
  );
}

export default PinsTab;
