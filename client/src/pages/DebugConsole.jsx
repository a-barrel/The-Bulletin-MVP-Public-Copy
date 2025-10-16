import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import ForumIcon from '@mui/icons-material/Forum';
import MapIcon from '@mui/icons-material/Map';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  createPin,
  fetchPinById,
  fetchPinsNearby,
  listPins,
  insertLocationUpdate,
  fetchNearbyUsers,
  fetchLocationHistory,
  createUserProfile,
  fetchUsers,
  fetchUserProfile,
  updateUserProfile,
  createBookmark,
  fetchBookmarks,
  createBookmarkCollection,
  fetchBookmarkCollections,
  createProximityChatRoom,
  fetchChatRooms,
  createProximityChatMessage,
  fetchChatMessages,
  createProximityChatPresence,
  fetchChatPresence,
  createUpdate,
  fetchUpdates,
  createReply,
  fetchReplies
} from '../api/mongoDataApi';
import LeafletMap from '../components/Map';
import runtimeConfig from '../config/runtime';
``
//protected: true, //Firebase protection, requires login to see page
export const pageConfig = {
  id: 'debug-console',
  label: 'DEBUG_CONSOLE',
  icon: AddLocationAltIcon,
  path: '/debug-console',
  order: 2,
  protected: true,
  showInNav: true
};

const EXPERIMENT_SCREENS = [];
const EXPERIMENT_ENABLED = runtimeConfig.troyExperimentEnabled && EXPERIMENT_SCREENS.length > 0;
const EXPERIMENT_TAB_ID = 'troy-experiment';
const EXPERIMENT_TITLE = "Troy's Dumb Experiment";

const DEFAULT_AVATAR_PATH = '/images/profile/profile-01.jpg';
const DEFAULT_BANNER_PATH = '/images/background/background-01.jpg';
const resolveMediaUrl = (value) => {
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const target = value && value.trim().length > 0 ? value.trim() : DEFAULT_AVATAR_PATH;
  if (/^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('data:')) {
    return target;
  }
  const normalized = target.startsWith('/') ? target : `/${target}`;
  return base ? `${base}${normalized}` : normalized;
};

const INITIAL_COORDINATES = {
  latitude: '33.7838',
  longitude: '-118.1136'
};

const formatDateTimeLocal = (date) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
};

const METERS_PER_MILE = 1609.34;
const TAB_OPTIONS = [
  { id: 'pin', label: 'Pins & Events' },
  { id: 'profile', label: 'Profiles' },
  { id: 'locations', label: 'Locations' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'chat', label: 'Chat' },
  { id: 'updates', label: 'Updates' },
  { id: 'replies', label: 'Replies' },
  ...(EXPERIMENT_ENABLED ? [{ id: EXPERIMENT_TAB_ID, label: EXPERIMENT_TITLE }] : [])
];
const EXPERIMENT_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === EXPERIMENT_TAB_ID);

const ACCOUNT_STATUS_OPTIONS = ['active', 'inactive', 'suspended', 'deleted'];
const UPDATE_TYPE_OPTIONS = [
  'new-pin',
  'pin-update',
  'event-starting-soon',
  'popular-pin',
  'bookmark-update',
  'system',
  'chat-message',
  'friend-request'
];
const LOCATION_SOURCE_OPTIONS = ['web', 'ios', 'android', 'background'];

const JSON_PREVIEW_SX = { mt: 2, backgroundColor: 'grey.900', p: 2, borderRadius: 2, overflowX: 'auto' };

const parseCommaSeparated = (value) =>
  `${value ?? ''}`
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const parseRequiredNumber = (value, label) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
};

const parseOptionalNumber = (value, label) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return parsed;
};

const parseOptionalDate = (value, label) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = `${value}`.trim();
  if (!trimmed) {
    return undefined;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date/time.`);
  }
  return date.toISOString();
};

const parseJsonField = (value, label) => {
  const trimmed = `${value ?? ''}`.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Invalid ${label} JSON: ${error.message}`);
  }
};

const extractPinLocation = (pin) => {
  const coordinates = pin?.coordinates?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};

function JsonPreview({ data }) {
  if (data === null || data === undefined) {
    return null;
  }

  return (
    <Box component="pre" sx={JSON_PREVIEW_SX}>
      {JSON.stringify(data, null, 2)}
    </Box>
  );
}

function DebugConsolePage() {
  const [activeTab, setActiveTab] = useState(0);
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
  const [status, setStatus] = useState(null);
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
  const [expiringPins, setExpiringPins] = useState([]);
  const [isFetchingExpiringPins, setIsFetchingExpiringPins] = useState(false);
  const [expiringDays, setExpiringDays] = useState('3');
  const [selectedPinId, setSelectedPinId] = useState(null);
  const [mapFocusLocation, setMapFocusLocation] = useState(null);

  const searchCenterLocation = useMemo(() => {
    const latitude = Number.parseFloat(formState.latitude);
    const longitude = Number.parseFloat(formState.longitude);
    if (!Number.isNaN(latitude) && !Number.isNaN(longitude) && Number.isFinite(latitude) && Number.isFinite(longitude)) {
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
    return Array.from(seen.values());
  }, [createdPin, nearbyPins, allPins, expiringPins]);

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

  const handleTabChange = (_event, newValue) => {
    setActiveTab(newValue);
  };

  const handlePinTypeChange = (_event, value) => {
    if (value) {
      setPinType(value);
      setStatus(null);
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
    setStatus(null);
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
    setStatus(null);
    const miles = Number.parseFloat(distanceMiles);
    if (Number.isNaN(miles) || miles <= 0) {
      setStatus({ type: 'error', message: 'Provide a distance in miles greater than 0.' });
      return;
    }

    let latitude;
    let longitude;
    try {
      latitude = parseCoordinate(formState.latitude, 'Latitude');
      longitude = parseCoordinate(formState.longitude, 'Longitude');
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
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
    setStatus({
      type: 'success',
      message: pins.length
        ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} within ${miles} miles.`
        : `No pins found within ${miles} miles.`
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to fetch nearby pins.' });
    } finally {
      setIsFetchingNearby(false);
    }
  };

  const handleAllPinsLimitChange = (event) => {
    setAllPinsLimit(event.target.value);
  };

  const handleFetchAllPins = async () => {
    setStatus(null);
    let limitValue;
    try {
      limitValue = parseOptionalNumber(allPinsLimit, 'Limit');
      if (limitValue === undefined) {
        limitValue = 20;
      }
      if (!Number.isFinite(limitValue) || limitValue <= 0) {
        throw new Error('Limit must be greater than 0.');
      }
      if (limitValue > 50) {
        throw new Error('Limit cannot exceed 50.');
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingAllPins(true);
      const pins = await listPins({ limit: limitValue });
      setAllPins(pins);
      if (pins.length > 0) {
        const focus = extractPinLocation(pins[0]);
        if (focus) {
          setMapFocusLocation(focus);
        }
        if (pins[0]?._id) {
          setSelectedPinId(pins[0]._id);
          setPinIdInput(pins[0]._id);
        }
      }
      setStatus({
        type: pins.length ? 'success' : 'info',
        message: pins.length
          ? `Loaded ${pins.length} pin${pins.length === 1 ? '' : 's'} (latest first).`
          : 'No pins found.'
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to load pins.' });
    } finally {
      setIsFetchingAllPins(false);
    }
  };

  const handleExpiringDaysChange = (event) => {
    setExpiringDays(event.target.value);
  };

  const handleFetchExpiringPins = async () => {
    setStatus(null);
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
      setStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingExpiringPins(true);
      const pins = await listPins({ limit: 50 });
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
      if (filtered.length > 0) {
        const focus = extractPinLocation(filtered[0]);
        if (focus) {
          setMapFocusLocation(focus);
        }
        if (filtered[0]?._id) {
          setSelectedPinId(filtered[0]._id);
          setPinIdInput(filtered[0]._id);
        }
      }
      setStatus({
        type: filtered.length ? 'success' : 'info',
        message: filtered.length
          ? `Found ${filtered.length} pin${filtered.length === 1 ? '' : 's'} expiring in the next ${daysValue} day${daysValue === 1 ? '' : 's'}.`
          : `No pins expire within the next ${daysValue} day${daysValue === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to load expiring pins.' });
    } finally {
      setIsFetchingExpiringPins(false);
    }
  };

  const formatDistanceMiles = (meters) => {
    if (meters === undefined || meters === null) {
      return null;
    }
    return (meters / METERS_PER_MILE).toFixed(1);
  };

  const parseCoordinate = (value, label) => {
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) {
      throw new Error(`${label} must be a valid number`);
    }
    return numeric;
  };

const parseDate = (value, label) => {
  if (!value) {
    throw new Error(`${label} is required`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return parsed.toISOString();
};

const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);

    let payload;
    try {
      const latitude = parseCoordinate(formState.latitude, 'Latitude');
      const longitude = parseCoordinate(formState.longitude, 'Longitude');
      const proximityRadius = formState.proximityRadiusMiles
        ? Number.parseFloat(formState.proximityRadiusMiles)
        : undefined;

      if (proximityRadius !== undefined && Number.isNaN(proximityRadius)) {
        throw new Error('Proximity radius must be a valid number');
      }
      if (proximityRadius !== undefined && proximityRadius <= 0) {
        throw new Error('Proximity radius must be greater than 0 miles');
      }

      payload = {
        type: pinType,
        title: formState.title.trim(),
        description: formState.description.trim(),
        coordinates: {
          latitude,
          longitude
        },
        proximityRadiusMeters: proximityRadius !== undefined ? Math.round(proximityRadius * METERS_PER_MILE) : undefined
      };

      if (!payload.title) {
        throw new Error('Title is required');
      }
      if (!payload.description) {
        throw new Error('Description is required');
      }

      if (isEvent) {
        const startDateIso = parseDate(formState.startDate, 'Start date');
        const endDateIso = parseDate(formState.endDate, 'End date');
        payload.startDate = startDateIso;
        payload.endDate = endDateIso;

        if (formState.addressPrecise.trim()) {
          payload.address = {
            precise: formState.addressPrecise.trim(),
            components: {
              line1: formState.addressPrecise.trim(),
              city: formState.addressCity.trim() || undefined,
              state: formState.addressState.trim() || undefined,
              postalCode: formState.addressPostalCode.trim() || undefined,
              country: formState.addressCountry.trim() || undefined
            }
          };
        }
      } else {
        payload.expiresAt = parseDate(formState.expiresAt, 'Expires at');
        const approx = {
          city: formState.approximateCity.trim() || undefined,
          state: formState.approximateState.trim() || undefined,
          country: formState.approximateCountry.trim() || undefined,
          formatted: formState.approximateFormatted.trim() || undefined
        };
        if (Object.values(approx).some((value) => Boolean(value))) {
          payload.approximateAddress = approx;
        }
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsSubmitting(true);
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
          statusMessage = 'Pin created and loaded from MongoDB.';
        } catch (reloadError) {
          console.warn('Failed to reload pin after creation', reloadError);
          statusMessage = 'Pin created successfully. Reloading from MongoDB failed.';
        }
      }

      setStatus({ type: 'success', message: statusMessage });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to create pin.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchPin = async () => {
    const pinId = pinIdInput.trim();
    if (!pinId) {
      setStatus({ type: 'error', message: 'Provide a Pin ID to fetch.' });
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
      setStatus({ type: 'success', message: 'Pin loaded from MongoDB.' });
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Failed to fetch pin.' });
    } finally {
      setIsFetchingPin(false);
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 }
      }}
    >
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 960 }}>
        <Typography variant="h4" component="h1">
          DEBUG_CONSOLE
        </Typography>

        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="Debug console sections"
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          allowScrollButtonsMobile
        >
          {TAB_OPTIONS.map((tab, index) => (
            <Tab
              key={tab.id}
              label={tab.label}
              value={index}
              id={`debug-tab-${tab.id}`}
              aria-controls={`debug-tabpanel-${tab.id}`}
            />
          ))}
        </Tabs>

        <Box
          role="tabpanel"
          hidden={activeTab !== 0}
          id="debug-tabpanel-pin"
          aria-labelledby="debug-tab-pin"
          sx={{ display: activeTab === 0 ? 'contents' : 'none' }}
        >
          {status && (
            <Alert severity={status.type} onClose={() => setStatus(null)}>
              {status.message}
            </Alert>
          )}

          <Paper
            component="form"
            onSubmit={handleSubmit}
            sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}
          >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Pin Details
            </Typography>
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
          </Stack>

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
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Test saved pin</Typography>
            <Typography variant="body2" color="text.secondary">
              Use this section to fetch the pin you just created directly from MongoDB via the API.
            </Typography>

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
                          const key = photo.url || displayUrl || `photo-${index}`;
                          return (
                            <Box
                              key={key}
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
                <Box component="pre" sx={JSON_PREVIEW_SX}>
                  {JSON.stringify(createdPin, null, 2)}
                </Box>
              </Stack>
            )}
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Find nearby pins</Typography>
            <Typography variant="body2" color="text.secondary">
              Search for pins near the coordinates above to verify radius queries.
            </Typography>

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
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Load recent pins</Typography>
            <Typography variant="body2" color="text.secondary">
              Fetch the most recently updated pins regardless of distance.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <TextField
                label="Limit (max 50)"
                value={allPinsLimit}
                onChange={handleAllPinsLimitChange}
                InputProps={{ inputMode: 'numeric' }}
                sx={{ width: { xs: '100%', sm: 200 } }}
              />
              <Button
                type="button"
                variant="outlined"
                startIcon={<MapIcon />}
                onClick={handleFetchAllPins}
                disabled={isFetchingAllPins}
              >
                {isFetchingAllPins ? 'Loading...' : 'Fetch recent pins'}
              </Button>
            </Stack>

            {allPins.length > 0 ? (
              <Stack spacing={1}>
                {allPins.map((pin) => (
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
                      <Typography variant="body2" color="text.secondary">
                        {pin._id}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {isFetchingAllPins ? 'Loading...' : 'Results will appear here after fetching.'}
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Pins expiring soon</Typography>
            <Typography variant="body2" color="text.secondary">
              Filter pins whose <em>expiresAt</em> (discussions) or end date (events) falls within the next N days.
            </Typography>

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
                {expiringPins.map((pin) => (
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
                      <Typography variant="body2" color="text.secondary">
                        Expires{' '}
                        {(() => {
                          const iso = pin?.expiresAt ?? pin?.endDate ?? null;
                          if (!iso) {
                            return 'Unknown';
                          }
                          const parsed = new Date(iso);
                          if (Number.isNaN(parsed.getTime())) {
                            return 'Unknown';
                          }
                          return parsed.toLocaleString();
                        })()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {pin._id}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {isFetchingExpiringPins ? 'Scanning...' : 'Results will appear here after fetching.'}
              </Typography>
            )}
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">Map preview</Typography>
            <Typography variant="body2" color="text.secondary">
              Markers reflect the pins returned above. Click a marker to populate its ID for quick lookups.
            </Typography>
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
          </Paper>
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== 1}
          id="debug-tabpanel-profile"
          aria-labelledby="debug-tab-profile"
          sx={{ display: activeTab === 1 ? 'block' : 'none' }}
        >
          <ProfilesTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== 2}
          id="debug-tabpanel-locations"
          aria-labelledby="debug-tab-locations"
          sx={{ display: activeTab === 2 ? 'block' : 'none' }}
        >
          <LocationsTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== 3}
          id="debug-tabpanel-bookmarks"
          aria-labelledby="debug-tab-bookmarks"
          sx={{ display: activeTab === 3 ? 'block' : 'none' }}
        >
          <BookmarksTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== 4}
          id="debug-tabpanel-chat"
          aria-labelledby="debug-tab-chat"
          sx={{ display: activeTab === 4 ? 'block' : 'none' }}
        >
          <ChatTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== 5}
          id="debug-tabpanel-updates"
          aria-labelledby="debug-tab-updates"
          sx={{ display: activeTab === 5 ? 'block' : 'none' }}
        >
          <UpdatesTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== 6}
          id="debug-tabpanel-replies"
          aria-labelledby="debug-tab-replies"
          sx={{ display: activeTab === 6 ? 'block' : 'none' }}
        >
          <RepliesTab />
        </Box>
        {EXPERIMENT_ENABLED && (
          <Box
            role="tabpanel"
            hidden={activeTab !== EXPERIMENT_TAB_INDEX}
            id={`debug-tabpanel-${EXPERIMENT_TAB_ID}`}
            aria-labelledby={`debug-tab-${EXPERIMENT_TAB_ID}`}
            sx={{ display: activeTab === EXPERIMENT_TAB_INDEX ? 'block' : 'none' }}
          >
            <ExperimentTab />
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function ExperimentTab() {
  const defaultScreenId = EXPERIMENT_SCREENS[0]?.id ?? null;
  const [selectedScreen, setSelectedScreen] = useState(defaultScreenId);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const activeScreen = useMemo(() => {
    if (!selectedScreen) {
      return null;
    }
    return EXPERIMENT_SCREENS.find((screen) => screen.id === selectedScreen) ?? null;
  }, [selectedScreen]);

  const ScreenComponent = activeScreen?.Component ?? null;

  const handleSelectionChange = (_event, value) => {
    if (value) {
      setSelectedScreen(value);
    }
  };

  const handleOpenPreview = () => setIsPreviewOpen(true);
  const handleClosePreview = () => setIsPreviewOpen(false);

  return (
    <>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">{EXPERIMENT_TITLE}</Typography>
        <Typography variant="body2" color="text.secondary">
          Private sandbox for Troy. Keep this local and off the main repo.
        </Typography>

        <Alert severity="warning" sx={{ alignItems: 'flex-start' }}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2">Heads up</Typography>
            <Typography variant="body2">
              This is a contingency experiment. Do not ship, demo, or commit it upstream.
            </Typography>
          </Stack>
        </Alert>

        <Typography variant="subtitle2">Pick a screen:</Typography>
        <ToggleButtonGroup
          value={selectedScreen}
          exclusive
          onChange={handleSelectionChange}
          color="primary"
          orientation="horizontal"
          sx={{ flexWrap: 'wrap', gap: 1, '& .MuiToggleButton-root': { flexGrow: 1 } }}
        >
          {EXPERIMENT_SCREENS.length > 0 ? (
            EXPERIMENT_SCREENS.map((screen) => (
              <ToggleButton key={screen.id} value={screen.id} aria-label={screen.label}>
                {screen.label}
              </ToggleButton>
            ))
          ) : (
            <ToggleButton value="placeholder" disabled>
              Screens archived locally
            </ToggleButton>
          )}
        </ToggleButtonGroup>

        <Button
          type="button"
          variant="contained"
          onClick={handleOpenPreview}
          disabled={!ScreenComponent}
        >
          Open Preview
        </Button>
      </Paper>

      <Dialog
        open={isPreviewOpen}
        onClose={handleClosePreview}
        fullWidth
        maxWidth="md"
        aria-labelledby={`${EXPERIMENT_TAB_ID}-dialog-title`}
      >
        <DialogTitle id={`${EXPERIMENT_TAB_ID}-dialog-title`}>
          {EXPERIMENT_TITLE} — {activeScreen?.label}
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              backgroundColor: 'grey.900',
              borderRadius: 2,
              p: { xs: 2, sm: 3 }
            }}
          >
            <Box
              sx={{
                width: { xs: '100%', sm: 360 },
                transform: { xs: 'scale(0.9)', sm: 'none' },
                transformOrigin: 'top center'
              }}
            >
              {ScreenComponent ? <ScreenComponent /> : null}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
function ProfilesTab() {
  const [createForm, setCreateForm] = useState({
    username: '',
    displayName: '',
    email: '',
    bio: '',
    accountStatus: ACCOUNT_STATUS_OPTIONS[0],
    roles: '',
    locationSharingEnabled: false
  });
  const [createStatus, setCreateStatus] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);

  const [fetchUserId, setFetchUserId] = useState('');
  const [fetchStatus, setFetchStatus] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchLimit, setSearchLimit] = useState('10');
  const [searchStatus, setSearchStatus] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [allProfiles, setAllProfiles] = useState(null);
  const [allProfilesStatus, setAllProfilesStatus] = useState(null);
  const [isFetchingAllProfiles, setIsFetchingAllProfiles] = useState(false);
  const [allProfilesLimit, setAllProfilesLimit] = useState('20');

  const buildEditForm = (profile) => ({
    username: profile?.username ?? '',
    displayName: profile?.displayName ?? '',
    email: profile?.email ?? '',
    bio: profile?.bio ?? '',
    accountStatus: profile?.accountStatus ?? ACCOUNT_STATUS_OPTIONS[0],
    locationSharingEnabled: Boolean(profile?.locationSharingEnabled)
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreateStatus(null);

    try {
      const username = createForm.username.trim();
      const displayName = createForm.displayName.trim();
      if (!username || !displayName) {
        throw new Error('Username and display name are required.');
      }

      const payload = {
        username,
        displayName,
        accountStatus: createForm.accountStatus,
        locationSharingEnabled: createForm.locationSharingEnabled
      };

      const email = createForm.email.trim();
      if (email) {
        payload.email = email;
      }

      const bio = createForm.bio.trim();
      if (bio) {
        payload.bio = bio;
      }

      const roles = parseCommaSeparated(createForm.roles);
      if (roles.length) {
        payload.roles = roles;
      }

      setIsCreating(true);
      const result = await createUserProfile(payload);
      setCreatedProfile(result);
      setCreateStatus({ type: 'success', message: 'User profile created.' });
      if (result?._id) {
        setFetchUserId(result._id);
      }
    } catch (error) {
      setCreateStatus({ type: 'error', message: error.message || 'Failed to create user.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleFetchProfile = async (event) => {
    event.preventDefault();
    setFetchStatus(null);
    setUpdateStatus(null);
    const userId = fetchUserId.trim();
    if (!userId) {
      setFetchStatus({ type: 'error', message: 'Provide a user ID to fetch.' });
      return;
    }

    try {
      setIsFetching(true);
      const profile = await fetchUserProfile(userId);
      setFetchedProfile(profile);
       setEditForm(buildEditForm(profile));
      setFetchStatus({ type: 'success', message: 'Profile loaded.' });
    } catch (error) {
      setFetchStatus({ type: 'error', message: error.message || 'Failed to fetch profile.' });
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    setUpdateStatus(null);

    if (!fetchedProfile?._id) {
      setUpdateStatus({ type: 'error', message: 'Fetch a profile before saving changes.' });
      return;
    }

    if (!editForm) {
      setUpdateStatus({ type: 'error', message: 'Load a profile before updating.' });
      return;
    }

    try {
      const username = (editForm.username ?? '').trim();
      const displayName = (editForm.displayName ?? '').trim();
      if (!username || !displayName) {
        throw new Error('Username and display name are required.');
      }

      const payload = {
        username,
        displayName,
        accountStatus: editForm.accountStatus,
        locationSharingEnabled: Boolean(editForm.locationSharingEnabled)
      };

      const email = (editForm.email ?? '').trim();
      payload.email = email ? email : null;

      const bio = (editForm.bio ?? '').trim();
      payload.bio = bio ? bio : null;

      setIsUpdating(true);
      const updatedProfile = await updateUserProfile(fetchedProfile._id, payload);
      setFetchedProfile(updatedProfile);
      setEditForm(buildEditForm(updatedProfile));
      setUpdateStatus({ type: 'success', message: 'Profile updated.' });
    } catch (error) {
      setUpdateStatus({ type: 'error', message: error.message || 'Failed to update profile.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSearchUsers = async (event) => {
    event.preventDefault();
    setSearchStatus(null);

    try {
      const query = {};
      const term = searchTerm.trim();
      if (term) {
        query.search = term;
      }
      const limitValue = parseOptionalNumber(searchLimit, 'Limit');
      if (limitValue !== undefined) {
        if (limitValue <= 0) {
          throw new Error('Limit must be greater than 0.');
        }
        query.limit = limitValue;
      }

      setIsSearching(true);
      const users = await fetchUsers(query);
      setSearchResults(users);
      setSearchStatus({
        type: 'success',
        message: `Found ${users.length} user${users.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setSearchStatus({ type: 'error', message: error.message || 'Failed to search users.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchAllProfiles = async () => {
    setAllProfilesStatus(null);
    let limitValue;
    try {
      limitValue = parseOptionalNumber(allProfilesLimit, 'Limit');
      if (limitValue === undefined) {
        limitValue = 20;
      }
      if (!Number.isFinite(limitValue) || limitValue <= 0) {
        throw new Error('Limit must be greater than 0.');
      }
      if (limitValue > 50) {
        throw new Error('Limit cannot exceed 50.');
      }
    } catch (error) {
      setAllProfilesStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingAllProfiles(true);
      const users = await fetchUsers({ limit: limitValue });
      setAllProfiles(users);
      setAllProfilesStatus({
        type: users.length ? 'success' : 'info',
        message: users.length
          ? `Loaded ${users.length} profile${users.length === 1 ? '' : 's'}.`
          : 'No profiles were returned.'
      });
    } catch (error) {
      setAllProfilesStatus({ type: 'error', message: error.message || 'Failed to load profiles.' });
    } finally {
      setIsFetchingAllProfiles(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreate}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create user profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Provision a debug identity record for manual testing.
        </Typography>
        {createStatus && (
          <Alert severity={createStatus.type} onClose={() => setCreateStatus(null)}>
            {createStatus.message}
          </Alert>
        )}

        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Username"
              value={createForm.username}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Display name"
              value={createForm.displayName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              required
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Account status"
              value={createForm.accountStatus}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, accountStatus: event.target.value }))}
              select
              sx={{ minWidth: 200 }}
            >
              {ACCOUNT_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <TextField
            label="Bio"
            value={createForm.bio}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, bio: event.target.value }))}
            multiline
            minRows={3}
            fullWidth
          />

          <TextField
            label="Roles (comma separated)"
            value={createForm.roles}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, roles: event.target.value }))}
            fullWidth
          />

          <FormControlLabel
            control={
              <Switch
                checked={createForm.locationSharingEnabled}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, locationSharingEnabled: event.target.checked }))
                }
              />
            }
            label="Location sharing enabled"
          />

          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create user'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setCreateForm({
                  username: '',
                  displayName: '',
                  email: '',
                  bio: '',
                  accountStatus: ACCOUNT_STATUS_OPTIONS[0],
                  roles: '',
                  locationSharingEnabled: false
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={createdProfile} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchProfile}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Load the latest profile snapshot from MongoDB.
        </Typography>
        {fetchStatus && (
          <Alert severity={fetchStatus.type} onClose={() => setFetchStatus(null)}>
            {fetchStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={fetchUserId}
            onChange={(event) => setFetchUserId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetching}>
            {isFetching ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        {(fetchedProfile?.avatar?.url || fetchedProfile) && (
          <Stack
            spacing={2}
            alignItems="center"
            sx={{
              p: 2,
              borderRadius: 2,
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 60%, rgba(255,255,255,0.06) 100%)`,
              border: (theme) => `1px solid ${theme.palette.divider}`
            }}
          >
            <Box
              component="img"
              src={resolveMediaUrl(fetchedProfile?.banner?.url ?? DEFAULT_BANNER_PATH)}
              alt="User banner"
              sx={{
                width: '100%',
                maxWidth: 480,
                height: 120,
                borderRadius: 2,
                objectFit: 'fill',
                border: (theme) => `1px solid ${theme.palette.divider}`
              }}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = resolveMediaUrl(DEFAULT_BANNER_PATH);
              }}
            />
            <Box
              component="img"
              src={resolveMediaUrl(fetchedProfile?.avatar?.url ?? '')}
              alt={fetchedProfile?.displayName ? `${fetchedProfile.displayName} avatar` : 'User avatar'}
              sx={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
                border: (theme) => `1px solid ${theme.palette.divider}`
              }}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = resolveMediaUrl('');
              }}
            />
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">
                {fetchedProfile?.displayName ?? 'Unknown user'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fetchedProfile?.username ? `@${fetchedProfile.username}` : 'No username'}
              </Typography>
            </Stack>
          </Stack>
        )}
        <JsonPreview data={fetchedProfile} />
      </Paper>

      {fetchedProfile && editForm && (
        <Paper
          component="form"
          onSubmit={handleUpdateProfile}
          sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Typography variant="h6">Edit profile</Typography>
          <Typography variant="body2" color="text.secondary">
            Make changes to the fetched profile and persist them to MongoDB.
          </Typography>
          {updateStatus && (
            <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
              {updateStatus.message}
            </Alert>
          )}

          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Username"
                value={editForm.username}
                onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Display name"
                value={editForm.displayName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
                required
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Account status"
                value={editForm.accountStatus}
                onChange={(event) => setEditForm((prev) => ({ ...prev, accountStatus: event.target.value }))}
                select
                sx={{ minWidth: 200 }}
              >
                {ACCOUNT_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Bio"
              value={editForm.bio}
              onChange={(event) => setEditForm((prev) => ({ ...prev, bio: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={editForm.locationSharingEnabled}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, locationSharingEnabled: event.target.checked }))
                  }
                />
              }
              label="Location sharing enabled"
            />

            <Stack direction="row" spacing={2}>
              <Button type="submit" variant="contained" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="text"
                disabled={isUpdating}
                onClick={() => setEditForm(buildEditForm(fetchedProfile))}
              >
                Reset to fetched profile
              </Button>
            </Stack>
          </Stack>
      </Paper>
    )}

    <Paper
      sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Typography variant="h6">Fetch profiles</Typography>
      <Typography variant="body2" color="text.secondary">
        Load the most recent user profiles without filtering.
      </Typography>
      {allProfilesStatus && (
        <Alert severity={allProfilesStatus.type} onClose={() => setAllProfilesStatus(null)}>
          {allProfilesStatus.message}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Limit"
          value={allProfilesLimit}
          onChange={(event) => setAllProfilesLimit(event.target.value)}
          InputProps={{ inputMode: 'numeric' }}
          sx={{ width: { xs: '100%', sm: 120 } }}
        />
        <Button
          type="button"
          variant="outlined"
          disabled={isFetchingAllProfiles}
          onClick={handleFetchAllProfiles}
        >
          {isFetchingAllProfiles ? 'Loading...' : 'Fetch'}
        </Button>
      </Stack>
      <JsonPreview data={allProfiles} />
    </Paper>

    <Paper
      component="form"
      onSubmit={handleSearchUsers}
      sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
        <Typography variant="h6">Search users</Typography>
        <Typography variant="body2" color="text.secondary">
          Explore existing users and copy their IDs quickly.
        </Typography>
        {searchStatus && (
          <Alert severity={searchStatus.type} onClose={() => setSearchStatus(null)}>
            {searchStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search term"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            fullWidth
          />
          <TextField
            label="Limit"
            value={searchLimit}
            onChange={(event) => setSearchLimit(event.target.value)}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Button type="submit" variant="outlined" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </Stack>
        <JsonPreview data={searchResults} />
      </Paper>
    </Stack>
  );
}

function LocationsTab() {
  const [locationForm, setLocationForm] = useState({
    userId: '',
    latitude: '',
    longitude: '',
    accuracy: '',
    source: LOCATION_SOURCE_OPTIONS[0],
    sessionId: '',
    deviceId: '',
    linkedPinIds: '',
    createdAt: '',
    lastSeenAt: '',
    expiresAt: '',
    isPublic: true
  });
  const [locationStatus, setLocationStatus] = useState(null);
  const [locationResult, setLocationResult] = useState(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const [nearbyForm, setNearbyForm] = useState({ latitude: '', longitude: '', maxDistance: '1609' });
  const [nearbyStatus, setNearbyStatus] = useState(null);
  const [nearbyResults, setNearbyResults] = useState(null);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);

  const [historyUserId, setHistoryUserId] = useState('');
  const [historyStatus, setHistoryStatus] = useState(null);
  const [historyResults, setHistoryResults] = useState(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  const handleLocationFieldChange = (field) => (event) => {
    setLocationForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSaveLocation = async (event) => {
    event.preventDefault();
    setLocationStatus(null);

    try {
      const userId = locationForm.userId.trim();
      if (!userId) {
        throw new Error('User ID is required.');
      }

      const latitude = parseRequiredNumber(locationForm.latitude, 'Latitude');
      const longitude = parseRequiredNumber(locationForm.longitude, 'Longitude');

      const payload = {
        userId,
        coordinates: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        isPublic: locationForm.isPublic,
        source: locationForm.source
      };

      const accuracy = parseOptionalNumber(locationForm.accuracy, 'Accuracy');
      if (accuracy !== undefined) {
        payload.accuracy = accuracy;
        payload.coordinates.accuracy = accuracy;
      }

      const sessionId = locationForm.sessionId.trim();
      if (sessionId) {
        payload.sessionId = sessionId;
      }

      const deviceId = locationForm.deviceId.trim();
      if (deviceId) {
        payload.deviceId = deviceId;
      }

      const linkedPinIds = parseCommaSeparated(locationForm.linkedPinIds);
      if (linkedPinIds.length) {
        payload.linkedPinIds = linkedPinIds;
      }

      const createdAt = parseOptionalDate(locationForm.createdAt, 'Created at');
      if (createdAt) {
        payload.createdAt = createdAt;
      }

      const lastSeenAt = parseOptionalDate(locationForm.lastSeenAt, 'Last seen at');
      if (lastSeenAt) {
        payload.lastSeenAt = lastSeenAt;
      }

      const expiresAt = parseOptionalDate(locationForm.expiresAt, 'Expires at');
      if (expiresAt) {
        payload.expiresAt = expiresAt;
      }

      setIsSavingLocation(true);
      const result = await insertLocationUpdate(payload);
      setLocationResult(result);
      setLocationStatus({ type: 'success', message: 'Location update saved.' });
    } catch (error) {
      setLocationStatus({ type: 'error', message: error.message || 'Failed to save location update.' });
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleFetchNearby = async (event) => {
    event.preventDefault();
    setNearbyStatus(null);

    try {
      const latitude = parseRequiredNumber(nearbyForm.latitude, 'Latitude');
      const longitude = parseRequiredNumber(nearbyForm.longitude, 'Longitude');
      const query = { latitude, longitude };
      const maxDistance = parseOptionalNumber(nearbyForm.maxDistance, 'Max distance');
      if (maxDistance !== undefined) {
        query.maxDistance = maxDistance;
      }

      setIsFetchingNearby(true);
      const results = await fetchNearbyUsers(query);
      setNearbyResults(results);
      setNearbyStatus({
        type: 'success',
        message: `Loaded ${results.length} nearby user${results.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setNearbyStatus({ type: 'error', message: error.message || 'Failed to load nearby users.' });
    } finally {
      setIsFetchingNearby(false);
    }
  };

  const handleFetchHistory = async (event) => {
    event.preventDefault();
    setHistoryStatus(null);
    const userId = historyUserId.trim();
    if (!userId) {
      setHistoryStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      setIsFetchingHistory(true);
      const results = await fetchLocationHistory(userId);
      setHistoryResults(results);
      setHistoryStatus({
        type: 'success',
        message: `Loaded ${results.length} location record${results.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setHistoryStatus({ type: 'error', message: error.message || 'Failed to load location history.' });
    } finally {
      setIsFetchingHistory(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleSaveLocation}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Insert location update</Typography>
        <Typography variant="body2" color="text.secondary">
          Record or refresh a user's proximity anchor.
        </Typography>
        {locationStatus && (
          <Alert severity={locationStatus.type} onClose={() => setLocationStatus(null)}>
            {locationStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={locationForm.userId}
              onChange={handleLocationFieldChange('userId')}
              required
              fullWidth
            />
            <TextField
              label="Source"
              value={locationForm.source}
              onChange={handleLocationFieldChange('source')}
              select
              sx={{ minWidth: 180 }}
            >
              {LOCATION_SOURCE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={locationForm.latitude}
              onChange={handleLocationFieldChange('latitude')}
              required
            />
            <TextField
              label="Longitude"
              value={locationForm.longitude}
              onChange={handleLocationFieldChange('longitude')}
              required
            />
            <TextField
              label="Accuracy (meters)"
              value={locationForm.accuracy}
              onChange={handleLocationFieldChange('accuracy')}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Session ID"
              value={locationForm.sessionId}
              onChange={handleLocationFieldChange('sessionId')}
              fullWidth
            />
            <TextField
              label="Device ID"
              value={locationForm.deviceId}
              onChange={handleLocationFieldChange('deviceId')}
              fullWidth
            />
          </Stack>
          <TextField
            label="Linked pin IDs (comma separated)"
            value={locationForm.linkedPinIds}
            onChange={handleLocationFieldChange('linkedPinIds')}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Created at"
              type="datetime-local"
              value={locationForm.createdAt}
              onChange={handleLocationFieldChange('createdAt')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Last seen at"
              type="datetime-local"
              value={locationForm.lastSeenAt}
              onChange={handleLocationFieldChange('lastSeenAt')}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Expires at"
              type="datetime-local"
              value={locationForm.expiresAt}
              onChange={handleLocationFieldChange('expiresAt')}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={locationForm.isPublic}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, isPublic: event.target.checked }))}
              />
            }
            label="Allow public proximity lookups"
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isSavingLocation}>
              {isSavingLocation ? 'Saving...' : 'Save location'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setLocationForm({
                  userId: '',
                  latitude: '',
                  longitude: '',
                  accuracy: '',
                  source: LOCATION_SOURCE_OPTIONS[0],
                  sessionId: '',
                  deviceId: '',
                  linkedPinIds: '',
                  createdAt: '',
                  lastSeenAt: '',
                  expiresAt: '',
                  isPublic: true
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={locationResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchNearby}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch nearby users</Typography>
        <Typography variant="body2" color="text.secondary">
          Inspect who is within range of a coordinate.
        </Typography>
        {nearbyStatus && (
          <Alert severity={nearbyStatus.type} onClose={() => setNearbyStatus(null)}>
            {nearbyStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Latitude"
            value={nearbyForm.latitude}
            onChange={(event) => setNearbyForm((prev) => ({ ...prev, latitude: event.target.value }))}
            required
          />
          <TextField
            label="Longitude"
            value={nearbyForm.longitude}
            onChange={(event) => setNearbyForm((prev) => ({ ...prev, longitude: event.target.value }))}
            required
          />
          <TextField
            label="Max distance (meters)"
            value={nearbyForm.maxDistance}
            onChange={(event) => setNearbyForm((prev) => ({ ...prev, maxDistance: event.target.value }))}
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <Button type="submit" variant="outlined" disabled={isFetchingNearby}>
            {isFetchingNearby ? 'Searching...' : 'Search'}
          </Button>
          <Button type="button" variant="text" onClick={() => setNearbyForm({ latitude: '', longitude: '', maxDistance: '1609' })}>
            Reset
          </Button>
        </Stack>
        <JsonPreview data={nearbyResults} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchHistory}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch location history</Typography>
        <Typography variant="body2" color="text.secondary">
          Review the historical samples associated with a user.
        </Typography>
        {historyStatus && (
          <Alert severity={historyStatus.type} onClose={() => setHistoryStatus(null)}>
            {historyStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={historyUserId}
            onChange={(event) => setHistoryUserId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingHistory}>
            {isFetchingHistory ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={historyResults} />
      </Paper>
    </Stack>
  );
}

function BookmarksTab() {
  const [bookmarkForm, setBookmarkForm] = useState({
    userId: '',
    pinId: '',
    collectionId: '',
    notes: '',
    reminderAt: '',
    tagIds: ''
  });
  const [bookmarkStatus, setBookmarkStatus] = useState(null);
  const [bookmarkResult, setBookmarkResult] = useState(null);
  const [isCreatingBookmark, setIsCreatingBookmark] = useState(false);

  const [collectionForm, setCollectionForm] = useState({
    userId: '',
    name: '',
    description: '',
    bookmarkIds: ''
  });
  const [collectionStatus, setCollectionStatus] = useState(null);
  const [collectionResult, setCollectionResult] = useState(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const [bookmarksQuery, setBookmarksQuery] = useState({ userId: '', limit: '20' });
  const [bookmarksStatus, setBookmarksStatus] = useState(null);
  const [bookmarksResult, setBookmarksResult] = useState(null);
  const [isFetchingBookmarks, setIsFetchingBookmarks] = useState(false);

  const [collectionsUserId, setCollectionsUserId] = useState('');
  const [collectionsStatus, setCollectionsStatus] = useState(null);
  const [collectionsResult, setCollectionsResult] = useState(null);
  const [isFetchingCollections, setIsFetchingCollections] = useState(false);

  const handleCreateBookmark = async (event) => {
    event.preventDefault();
    setBookmarkStatus(null);

    try {
      const userId = bookmarkForm.userId.trim();
      const pinId = bookmarkForm.pinId.trim();
      if (!userId || !pinId) {
        throw new Error('User ID and pin ID are required.');
      }

      const payload = {
        userId,
        pinId
      };

      const collectionId = bookmarkForm.collectionId.trim();
      if (collectionId) {
        payload.collectionId = collectionId;
      }

      const notes = bookmarkForm.notes.trim();
      if (notes) {
        payload.notes = notes;
      }

      const reminderAt = parseOptionalDate(bookmarkForm.reminderAt, 'Reminder at');
      if (reminderAt) {
        payload.reminderAt = reminderAt;
      }

      const tagIds = parseCommaSeparated(bookmarkForm.tagIds);
      if (tagIds.length) {
        payload.tagIds = tagIds;
      }

      setIsCreatingBookmark(true);
      const result = await createBookmark(payload);
      setBookmarkResult(result);
      setBookmarkStatus({ type: 'success', message: 'Bookmark created.' });
    } catch (error) {
      setBookmarkStatus({ type: 'error', message: error.message || 'Failed to create bookmark.' });
    } finally {
      setIsCreatingBookmark(false);
    }
  };

  const handleCreateCollection = async (event) => {
    event.preventDefault();
    setCollectionStatus(null);

    try {
      const userId = collectionForm.userId.trim();
      const name = collectionForm.name.trim();
      if (!userId || !name) {
        throw new Error('User ID and collection name are required.');
      }

      const payload = {
        userId,
        name
      };

      const description = collectionForm.description.trim();
      if (description) {
        payload.description = description;
      }

      const bookmarkIds = parseCommaSeparated(collectionForm.bookmarkIds);
      if (bookmarkIds.length) {
        payload.bookmarkIds = bookmarkIds;
      }

      setIsCreatingCollection(true);
      const result = await createBookmarkCollection(payload);
      setCollectionResult(result);
      setCollectionStatus({ type: 'success', message: 'Bookmark collection created.' });
    } catch (error) {
      setCollectionStatus({ type: 'error', message: error.message || 'Failed to create collection.' });
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleFetchBookmarks = async (event) => {
    event.preventDefault();
    setBookmarksStatus(null);

    const userId = bookmarksQuery.userId.trim();
    if (!userId) {
      setBookmarksStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      const query = { userId };
      const limitValue = parseOptionalNumber(bookmarksQuery.limit, 'Limit');
      if (limitValue !== undefined) {
        if (limitValue <= 0) {
          throw new Error('Limit must be greater than 0.');
        }
        query.limit = limitValue;
      }

      setIsFetchingBookmarks(true);
      const bookmarks = await fetchBookmarks(query);
      setBookmarksResult(bookmarks);
      setBookmarksStatus({
        type: 'success',
        message: `Loaded ${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setBookmarksStatus({ type: 'error', message: error.message || 'Failed to load bookmarks.' });
    } finally {
      setIsFetchingBookmarks(false);
    }
  };

  const handleFetchCollections = async (event) => {
    event.preventDefault();
    setCollectionsStatus(null);
    const userId = collectionsUserId.trim();
    if (!userId) {
      setCollectionsStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      setIsFetchingCollections(true);
      const collections = await fetchBookmarkCollections(userId);
      setCollectionsResult(collections);
      setCollectionsStatus({
        type: 'success',
        message: `Loaded ${collections.length} collection${collections.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setCollectionsStatus({ type: 'error', message: error.message || 'Failed to load collections.' });
    } finally {
      setIsFetchingCollections(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateBookmark}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create bookmark</Typography>
        <Typography variant="body2" color="text.secondary">
          Store a pin in a user's saved list or collection.
        </Typography>
        {bookmarkStatus && (
          <Alert severity={bookmarkStatus.type} onClose={() => setBookmarkStatus(null)}>
            {bookmarkStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={bookmarkForm.userId}
              onChange={(event) => setBookmarkForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Pin ID"
              value={bookmarkForm.pinId}
              onChange={(event) => setBookmarkForm((prev) => ({ ...prev, pinId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Collection ID (optional)"
            value={bookmarkForm.collectionId}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, collectionId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Notes"
            value={bookmarkForm.notes}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, notes: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Reminder at"
            type="datetime-local"
            value={bookmarkForm.reminderAt}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, reminderAt: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Tag IDs (comma separated)"
            value={bookmarkForm.tagIds}
            onChange={(event) => setBookmarkForm((prev) => ({ ...prev, tagIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingBookmark}>
              {isCreatingBookmark ? 'Creating...' : 'Create bookmark'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setBookmarkForm({
                  userId: '',
                  pinId: '',
                  collectionId: '',
                  notes: '',
                  reminderAt: '',
                  tagIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={bookmarkResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreateCollection}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create bookmark collection</Typography>
        <Typography variant="body2" color="text.secondary">
          Group multiple bookmarks together for quick access.
        </Typography>
        {collectionStatus && (
          <Alert severity={collectionStatus.type} onClose={() => setCollectionStatus(null)}>
            {collectionStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="User ID"
              value={collectionForm.userId}
              onChange={(event) => setCollectionForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Name"
              value={collectionForm.name}
              onChange={(event) => setCollectionForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Description"
            value={collectionForm.description}
            onChange={(event) => setCollectionForm((prev) => ({ ...prev, description: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Bookmark IDs (comma separated)"
            value={collectionForm.bookmarkIds}
            onChange={(event) => setCollectionForm((prev) => ({ ...prev, bookmarkIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingCollection}>
              {isCreatingCollection ? 'Creating...' : 'Create collection'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setCollectionForm({
                  userId: '',
                  name: '',
                  description: '',
                  bookmarkIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={collectionResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchBookmarks}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch bookmarks</Typography>
        <Typography variant="body2" color="text.secondary">
          List saved pins for a given user.
        </Typography>
        {bookmarksStatus && (
          <Alert severity={bookmarksStatus.type} onClose={() => setBookmarksStatus(null)}>
            {bookmarksStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={bookmarksQuery.userId}
            onChange={(event) => setBookmarksQuery((prev) => ({ ...prev, userId: event.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Limit"
            value={bookmarksQuery.limit}
            onChange={(event) => setBookmarksQuery((prev) => ({ ...prev, limit: event.target.value }))}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Button type="submit" variant="outlined" disabled={isFetchingBookmarks}>
            {isFetchingBookmarks ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={bookmarksResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchCollections}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch collections</Typography>
        <Typography variant="body2" color="text.secondary">
          Retrieve bookmark collections owned by a user.
        </Typography>
        {collectionsStatus && (
          <Alert severity={collectionsStatus.type} onClose={() => setCollectionsStatus(null)}>
            {collectionsStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={collectionsUserId}
            onChange={(event) => setCollectionsUserId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingCollections}>
            {isFetchingCollections ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={collectionsResult} />
      </Paper>
    </Stack>
  );
}

function ChatTab() {
  const [roomForm, setRoomForm] = useState({
    ownerId: '',
    name: '',
    description: '',
    latitude: '',
    longitude: '',
    radiusMeters: '',
    accuracy: '',
    pinId: '',
    participantIds: '',
    moderatorIds: ''
  });
  const [roomStatus, setRoomStatus] = useState(null);
  const [roomResult, setRoomResult] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [messageForm, setMessageForm] = useState({
    roomId: '',
    authorId: '',
    message: '',
    pinId: '',
    replyToMessageId: '',
    latitude: '',
    longitude: '',
    accuracy: ''
  });
  const [messageStatus, setMessageStatus] = useState(null);
  const [messageResult, setMessageResult] = useState(null);
  const [isCreatingMessage, setIsCreatingMessage] = useState(false);

  const [presenceForm, setPresenceForm] = useState({
    roomId: '',
    userId: '',
    sessionId: '',
    joinedAt: '',
    lastActiveAt: ''
  });
  const [presenceStatus, setPresenceStatus] = useState(null);
  const [presenceResult, setPresenceResult] = useState(null);
  const [isCreatingPresence, setIsCreatingPresence] = useState(false);

  const [roomsQuery, setRoomsQuery] = useState({ pinId: '', ownerId: '' });
  const [roomsStatus, setRoomsStatus] = useState(null);
  const [roomsResult, setRoomsResult] = useState(null);
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);

  const [messagesRoomId, setMessagesRoomId] = useState('');
  const [messagesStatus, setMessagesStatus] = useState(null);
  const [messagesResult, setMessagesResult] = useState(null);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);

  const [presenceRoomId, setPresenceRoomId] = useState('');
  const [presenceLogStatus, setPresenceLogStatus] = useState(null);
  const [presenceLogResult, setPresenceLogResult] = useState(null);
  const [isFetchingPresence, setIsFetchingPresence] = useState(false);

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    setRoomStatus(null);

    try {
      const ownerId = roomForm.ownerId.trim();
      const name = roomForm.name.trim();
      if (!ownerId || !name) {
        throw new Error('Owner ID and room name are required.');
      }

      const latitude = parseRequiredNumber(roomForm.latitude, 'Latitude');
      const longitude = parseRequiredNumber(roomForm.longitude, 'Longitude');
      const radiusMeters = parseRequiredNumber(roomForm.radiusMeters, 'Radius (meters)');

      const payload = {
        ownerId,
        name,
        latitude,
        longitude,
        radiusMeters
      };

      const description = roomForm.description.trim();
      if (description) {
        payload.description = description;
      }

      const accuracy = parseOptionalNumber(roomForm.accuracy, 'Accuracy');
      if (accuracy !== undefined) {
        payload.accuracy = accuracy;
      }

      const pinId = roomForm.pinId.trim();
      if (pinId) {
        payload.pinId = pinId;
      }

      const participantIds = parseCommaSeparated(roomForm.participantIds);
      if (participantIds.length) {
        payload.participantIds = participantIds;
      }

      const moderatorIds = parseCommaSeparated(roomForm.moderatorIds);
      if (moderatorIds.length) {
        payload.moderatorIds = moderatorIds;
      }

      setIsCreatingRoom(true);
      const result = await createProximityChatRoom(payload);
      setRoomResult(result);
      setRoomStatus({ type: 'success', message: 'Chat room created.' });
    } catch (error) {
      setRoomStatus({ type: 'error', message: error.message || 'Failed to create chat room.' });
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCreateMessage = async (event) => {
    event.preventDefault();
    setMessageStatus(null);

    try {
      const roomId = messageForm.roomId.trim();
      const authorId = messageForm.authorId.trim();
      const content = messageForm.message.trim();
      if (!roomId || !authorId || !content) {
        throw new Error('Room ID, author ID, and message are required.');
      }

      const payload = {
        roomId,
        authorId,
        message: content
      };

      const pinId = messageForm.pinId.trim();
      if (pinId) {
        payload.pinId = pinId;
      }

      const replyToMessageId = messageForm.replyToMessageId.trim();
      if (replyToMessageId) {
        payload.replyToMessageId = replyToMessageId;
      }

      const latitudeRaw = messageForm.latitude.trim();
      const longitudeRaw = messageForm.longitude.trim();
      if (latitudeRaw || longitudeRaw) {
        payload.latitude = parseRequiredNumber(latitudeRaw, 'Latitude');
        payload.longitude = parseRequiredNumber(longitudeRaw, 'Longitude');
        const accuracy = parseOptionalNumber(messageForm.accuracy, 'Accuracy');
        if (accuracy !== undefined) {
          payload.accuracy = accuracy;
        }
      }

      setIsCreatingMessage(true);
      const result = await createProximityChatMessage(payload);
      setMessageResult(result);
      setMessageStatus({ type: 'success', message: 'Chat message created.' });
    } catch (error) {
      setMessageStatus({ type: 'error', message: error.message || 'Failed to create chat message.' });
    } finally {
      setIsCreatingMessage(false);
    }
  };

  const handleCreatePresence = async (event) => {
    event.preventDefault();
    setPresenceStatus(null);

    try {
      const roomId = presenceForm.roomId.trim();
      const userId = presenceForm.userId.trim();
      if (!roomId || !userId) {
        throw new Error('Room ID and user ID are required.');
      }

      const payload = {
        roomId,
        userId
      };

      const sessionId = presenceForm.sessionId.trim();
      if (sessionId) {
        payload.sessionId = sessionId;
      }

      const joinedAt = parseOptionalDate(presenceForm.joinedAt, 'Joined at');
      if (joinedAt) {
        payload.joinedAt = joinedAt;
      }

      const lastActiveAt = parseOptionalDate(presenceForm.lastActiveAt, 'Last active at');
      if (lastActiveAt) {
        payload.lastActiveAt = lastActiveAt;
      }

      setIsCreatingPresence(true);
      const result = await createProximityChatPresence(payload);
      setPresenceResult(result);
      setPresenceStatus({ type: 'success', message: 'Presence recorded.' });
    } catch (error) {
      setPresenceStatus({ type: 'error', message: error.message || 'Failed to record presence.' });
    } finally {
      setIsCreatingPresence(false);
    }
  };

  const handleFetchRooms = async (event) => {
    event.preventDefault();
    setRoomsStatus(null);

    try {
      const query = {};
      const pinId = roomsQuery.pinId.trim();
      if (pinId) {
        query.pinId = pinId;
      }
      const ownerId = roomsQuery.ownerId.trim();
      if (ownerId) {
        query.ownerId = ownerId;
      }

      setIsFetchingRooms(true);
      const rooms = await fetchChatRooms(query);
      setRoomsResult(rooms);
      setRoomsStatus({
        type: 'success',
        message: `Loaded ${rooms.length} room${rooms.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setRoomsStatus({ type: 'error', message: error.message || 'Failed to load chat rooms.' });
    } finally {
      setIsFetchingRooms(false);
    }
  };

  const handleFetchMessages = async (event) => {
    event.preventDefault();
    setMessagesStatus(null);
    const roomId = messagesRoomId.trim();
    if (!roomId) {
      setMessagesStatus({ type: 'error', message: 'Room ID is required.' });
      return;
    }

    try {
      setIsFetchingMessages(true);
      const messages = await fetchChatMessages(roomId);
      setMessagesResult(messages);
      setMessagesStatus({
        type: 'success',
        message: `Loaded ${messages.length} message${messages.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setMessagesStatus({ type: 'error', message: error.message || 'Failed to load chat messages.' });
    } finally {
      setIsFetchingMessages(false);
    }
  };

  const handleFetchPresenceLog = async (event) => {
    event.preventDefault();
    setPresenceLogStatus(null);
    const roomId = presenceRoomId.trim();
    if (!roomId) {
      setPresenceLogStatus({ type: 'error', message: 'Room ID is required.' });
      return;
    }

    try {
      setIsFetchingPresence(true);
      const entries = await fetchChatPresence(roomId);
      setPresenceLogResult(entries);
      setPresenceLogStatus({
        type: 'success',
        message: `Loaded ${entries.length} presence entr${entries.length === 1 ? 'y' : 'ies'}.`
      });
    } catch (error) {
      setPresenceLogStatus({ type: 'error', message: error.message || 'Failed to load presence log.' });
    } finally {
      setIsFetchingPresence(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateRoom}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create proximity chat room</Typography>
        <Typography variant="body2" color="text.secondary">
          Define a new geofenced chat hub linked to a pin or free-floating area.
        </Typography>
        {roomStatus && (
          <Alert severity={roomStatus.type} onClose={() => setRoomStatus(null)}>
            {roomStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Owner ID"
              value={roomForm.ownerId}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, ownerId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Name"
              value={roomForm.name}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Description"
            value={roomForm.description}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, description: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={roomForm.latitude}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, latitude: event.target.value }))}
              required
            />
            <TextField
              label="Longitude"
              value={roomForm.longitude}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, longitude: event.target.value }))}
              required
            />
            <TextField
              label="Radius (meters)"
              value={roomForm.radiusMeters}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, radiusMeters: event.target.value }))}
              required
            />
            <TextField
              label="Accuracy"
              value={roomForm.accuracy}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, accuracy: event.target.value }))}
            />
          </Stack>
          <TextField
            label="Pin ID (optional)"
            value={roomForm.pinId}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Participant IDs (comma separated)"
            value={roomForm.participantIds}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, participantIds: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Moderator IDs (comma separated)"
            value={roomForm.moderatorIds}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, moderatorIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingRoom}>
              {isCreatingRoom ? 'Creating...' : 'Create room'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setRoomForm({
                  ownerId: '',
                  name: '',
                  description: '',
                  latitude: '',
                  longitude: '',
                  radiusMeters: '',
                  accuracy: '',
                  pinId: '',
                  participantIds: '',
                  moderatorIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={roomResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreateMessage}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create chat message</Typography>
        <Typography variant="body2" color="text.secondary">
          Inject a test message into a room timeline.
        </Typography>
        {messageStatus && (
          <Alert severity={messageStatus.type} onClose={() => setMessageStatus(null)}>
            {messageStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Room ID"
              value={messageForm.roomId}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, roomId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Author ID"
              value={messageForm.authorId}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, authorId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Message"
            value={messageForm.message}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, message: event.target.value }))}
            multiline
            minRows={2}
            required
            fullWidth
          />
          <TextField
            label="Pin ID (optional)"
            value={messageForm.pinId}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Reply to message ID"
            value={messageForm.replyToMessageId}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, replyToMessageId: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={messageForm.latitude}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, latitude: event.target.value }))}
            />
            <TextField
              label="Longitude"
              value={messageForm.longitude}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, longitude: event.target.value }))}
            />
            <TextField
              label="Accuracy"
              value={messageForm.accuracy}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, accuracy: event.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingMessage}>
              {isCreatingMessage ? 'Creating...' : 'Create message'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setMessageForm({
                  roomId: '',
                  authorId: '',
                  message: '',
                  pinId: '',
                  replyToMessageId: '',
                  latitude: '',
                  longitude: '',
                  accuracy: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={messageResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreatePresence}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Record presence</Typography>
        <Typography variant="body2" color="text.secondary">
          Emulate a user joining or updating active status in a room.
        </Typography>
        {presenceStatus && (
          <Alert severity={presenceStatus.type} onClose={() => setPresenceStatus(null)}>
            {presenceStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Room ID"
              value={presenceForm.roomId}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, roomId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="User ID"
              value={presenceForm.userId}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Session ID"
            value={presenceForm.sessionId}
            onChange={(event) => setPresenceForm((prev) => ({ ...prev, sessionId: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Joined at"
              type="datetime-local"
              value={presenceForm.joinedAt}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, joinedAt: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Last active at"
              type="datetime-local"
              value={presenceForm.lastActiveAt}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, lastActiveAt: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingPresence}>
              {isCreatingPresence ? 'Recording...' : 'Record presence'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setPresenceForm({
                  roomId: '',
                  userId: '',
                  sessionId: '',
                  joinedAt: '',
                  lastActiveAt: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={presenceResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchRooms}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">List chat rooms</Typography>
        <Typography variant="body2" color="text.secondary">
          Filter rooms by linked pin or owner.
        </Typography>
        {roomsStatus && (
          <Alert severity={roomsStatus.type} onClose={() => setRoomsStatus(null)}>
            {roomsStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Pin ID"
            value={roomsQuery.pinId}
            onChange={(event) => setRoomsQuery((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Owner ID"
            value={roomsQuery.ownerId}
            onChange={(event) => setRoomsQuery((prev) => ({ ...prev, ownerId: event.target.value }))}
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingRooms}>
            {isFetchingRooms ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={roomsResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchMessages}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch chat messages</Typography>
        <Typography variant="body2" color="text.secondary">
          Load the current timeline for a room.
        </Typography>
        {messagesStatus && (
          <Alert severity={messagesStatus.type} onClose={() => setMessagesStatus(null)}>
            {messagesStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Room ID"
            value={messagesRoomId}
            onChange={(event) => setMessagesRoomId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingMessages}>
            {isFetchingMessages ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={messagesResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchPresenceLog}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch presence log</Typography>
        <Typography variant="body2" color="text.secondary">
          Inspect join/leave history for a room session.
        </Typography>
        {presenceLogStatus && (
          <Alert severity={presenceLogStatus.type} onClose={() => setPresenceLogStatus(null)}>
            {presenceLogStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Room ID"
            value={presenceRoomId}
            onChange={(event) => setPresenceRoomId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingPresence}>
            {isFetchingPresence ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={presenceLogResult} />
      </Paper>
    </Stack>
  );
}

function UpdatesTab() {
  const [updateForm, setUpdateForm] = useState({
    userId: '',
    sourceUserId: '',
    targetUserIds: '',
    type: UPDATE_TYPE_OPTIONS[0],
    title: '',
    body: '',
    metadata: '',
    relatedEntities: '',
    pinId: '',
    pinPreview: ''
  });
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateResult, setUpdateResult] = useState(null);
  const [isCreatingUpdate, setIsCreatingUpdate] = useState(false);

  const [updatesQuery, setUpdatesQuery] = useState({ userId: '', limit: '20' });
  const [updatesStatus, setUpdatesStatus] = useState(null);
  const [updatesResult, setUpdatesResult] = useState(null);
  const [isFetchingUpdates, setIsFetchingUpdates] = useState(false);

  const handleCreateUpdate = async (event) => {
    event.preventDefault();
    setUpdateStatus(null);

    try {
      const userId = updateForm.userId.trim();
      const title = updateForm.title.trim();
      if (!userId || !title) {
        throw new Error('Target user ID and title are required.');
      }

      const payload = {
        userId,
        payload: {
          type: updateForm.type,
          title
        }
      };

      const sourceUserId = updateForm.sourceUserId.trim();
      if (sourceUserId) {
        payload.sourceUserId = sourceUserId;
      }

      const targetUserIds = parseCommaSeparated(updateForm.targetUserIds);
      if (targetUserIds.length) {
        payload.targetUserIds = targetUserIds;
      }

      const body = updateForm.body.trim();
      if (body) {
        payload.payload.body = body;
      }

      const metadata = parseJsonField(updateForm.metadata, 'metadata');
      if (metadata !== undefined) {
        payload.payload.metadata = metadata;
      }

      const relatedEntities = parseJsonField(updateForm.relatedEntities, 'related entities');
      if (relatedEntities !== undefined) {
        payload.payload.relatedEntities = relatedEntities;
      }

      const pinId = updateForm.pinId.trim();
      if (pinId) {
        payload.payload.pinId = pinId;
      }

      const pinPreview = parseJsonField(updateForm.pinPreview, 'pin preview');
      if (pinPreview !== undefined) {
        payload.payload.pinPreview = pinPreview;
      }

      setIsCreatingUpdate(true);
      const result = await createUpdate(payload);
      setUpdateResult(result);
      setUpdateStatus({ type: 'success', message: 'Update created.' });
    } catch (error) {
      setUpdateStatus({ type: 'error', message: error.message || 'Failed to create update.' });
    } finally {
      setIsCreatingUpdate(false);
    }
  };

  const handleFetchUpdates = async (event) => {
    event.preventDefault();
    setUpdatesStatus(null);

    const userId = updatesQuery.userId.trim();
    if (!userId) {
      setUpdatesStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      const query = { userId };
      const limitValue = parseOptionalNumber(updatesQuery.limit, 'Limit');
      if (limitValue !== undefined) {
        if (limitValue <= 0) {
          throw new Error('Limit must be greater than 0.');
        }
        query.limit = limitValue;
      }

      setIsFetchingUpdates(true);
      const updates = await fetchUpdates(query);
      setUpdatesResult(updates);
      setUpdatesStatus({
        type: 'success',
        message: `Loaded ${updates.length} update${updates.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setUpdatesStatus({ type: 'error', message: error.message || 'Failed to load updates.' });
    } finally {
      setIsFetchingUpdates(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateUpdate}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create user update</Typography>
        <Typography variant="body2" color="text.secondary">
          Generate feed notifications for a user to exercise the updates API.
        </Typography>
        {updateStatus && (
          <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
            {updateStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Target user ID"
              value={updateForm.userId}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Source user ID"
              value={updateForm.sourceUserId}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, sourceUserId: event.target.value }))}
              fullWidth
            />
          </Stack>
          <TextField
            label="Additional target user IDs (comma separated)"
            value={updateForm.targetUserIds}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, targetUserIds: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Type"
              value={updateForm.type}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, type: event.target.value }))}
              select
              sx={{ minWidth: 220 }}
            >
              {UPDATE_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={updateForm.title}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, title: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Body"
            value={updateForm.body}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, body: event.target.value }))}
            multiline
            minRows={3}
            fullWidth
          />
          <TextField
            label="Metadata JSON"
            value={updateForm.metadata}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, metadata: event.target.value }))}
            multiline
            minRows={3}
            placeholder='e.g. { "cta": "View pin" }'
            fullWidth
          />
          <TextField
            label="Related entities JSON"
            value={updateForm.relatedEntities}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, relatedEntities: event.target.value }))}
            multiline
            minRows={3}
            placeholder='e.g. [{ "id": "...", "type": "pin", "label": "Community Cleanup" }]'
            fullWidth
          />
          <TextField
            label="Pin ID (auto-populate preview)"
            value={updateForm.pinId}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Pin preview JSON"
            value={updateForm.pinPreview}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, pinPreview: event.target.value }))}
            multiline
            minRows={3}
            placeholder='{ "_id": "...", "type": "event", "creatorId": "...", "title": "...", "latitude": 33.77, "longitude": -118.19 }'
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingUpdate}>
              {isCreatingUpdate ? 'Creating...' : 'Create update'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setUpdateForm({
                  userId: '',
                  sourceUserId: '',
                  targetUserIds: '',
                  type: UPDATE_TYPE_OPTIONS[0],
                  title: '',
                  body: '',
                  metadata: '',
                  relatedEntities: '',
                  pinId: '',
                  pinPreview: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={updateResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchUpdates}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch updates</Typography>
        <Typography variant="body2" color="text.secondary">
          Inspect the notification queue for a given user.
        </Typography>
        {updatesStatus && (
          <Alert severity={updatesStatus.type} onClose={() => setUpdatesStatus(null)}>
            {updatesStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={updatesQuery.userId}
            onChange={(event) => setUpdatesQuery((prev) => ({ ...prev, userId: event.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Limit"
            value={updatesQuery.limit}
            onChange={(event) => setUpdatesQuery((prev) => ({ ...prev, limit: event.target.value }))}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Button type="submit" variant="outlined" disabled={isFetchingUpdates}>
            {isFetchingUpdates ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={updatesResult} />
      </Paper>
    </Stack>
  );
}

function RepliesTab() {
  const [replyForm, setReplyForm] = useState({
    pinId: '',
    authorId: '',
    message: '',
    parentReplyId: '',
    mentionedUserIds: ''
  });
  const [replyStatus, setReplyStatus] = useState(null);
  const [replyResult, setReplyResult] = useState(null);
  const [isCreatingReply, setIsCreatingReply] = useState(false);

  const [repliesPinId, setRepliesPinId] = useState('');
  const [repliesStatus, setRepliesStatus] = useState(null);
  const [repliesResult, setRepliesResult] = useState(null);
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);

  const handleCreateReply = async (event) => {
    event.preventDefault();
    setReplyStatus(null);

    try {
      const pinId = replyForm.pinId.trim();
      const authorId = replyForm.authorId.trim();
      const message = replyForm.message.trim();
      if (!pinId || !authorId || !message) {
        throw new Error('Pin ID, author ID, and message are required.');
      }

      const payload = {
        pinId,
        authorId,
        message
      };

      const parentReplyId = replyForm.parentReplyId.trim();
      if (parentReplyId) {
        payload.parentReplyId = parentReplyId;
      }

      const mentionedUserIds = parseCommaSeparated(replyForm.mentionedUserIds);
      if (mentionedUserIds.length) {
        payload.mentionedUserIds = mentionedUserIds;
      }

      setIsCreatingReply(true);
      const result = await createReply(payload);
      setReplyResult(result);
      setReplyStatus({ type: 'success', message: 'Reply created.' });
    } catch (error) {
      setReplyStatus({ type: 'error', message: error.message || 'Failed to create reply.' });
    } finally {
      setIsCreatingReply(false);
    }
  };

  const handleFetchReplies = async (event) => {
    event.preventDefault();
    setRepliesStatus(null);
    const pinId = repliesPinId.trim();
    if (!pinId) {
      setRepliesStatus({ type: 'error', message: 'Pin ID is required.' });
      return;
    }

    try {
      setIsFetchingReplies(true);
      const replies = await fetchReplies(pinId);
      setRepliesResult(replies);
      setRepliesStatus({
        type: 'success',
        message: `Loaded ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}.`
      });
    } catch (error) {
      setRepliesStatus({ type: 'error', message: error.message || 'Failed to load replies.' });
    } finally {
      setIsFetchingReplies(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateReply}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create reply</Typography>
        <Typography variant="body2" color="text.secondary">
          Seed conversations on a pin.
        </Typography>
        {replyStatus && (
          <Alert severity={replyStatus.type} onClose={() => setReplyStatus(null)}>
            {replyStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Pin ID"
              value={replyForm.pinId}
              onChange={(event) => setReplyForm((prev) => ({ ...prev, pinId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Author ID"
              value={replyForm.authorId}
              onChange={(event) => setReplyForm((prev) => ({ ...prev, authorId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Message"
            value={replyForm.message}
            onChange={(event) => setReplyForm((prev) => ({ ...prev, message: event.target.value }))}
            multiline
            minRows={3}
            required
            fullWidth
          />
          <TextField
            label="Parent reply ID"
            value={replyForm.parentReplyId}
            onChange={(event) => setReplyForm((prev) => ({ ...prev, parentReplyId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Mentioned user IDs (comma separated)"
            value={replyForm.mentionedUserIds}
            onChange={(event) => setReplyForm((prev) => ({ ...prev, mentionedUserIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingReply}>
              {isCreatingReply ? 'Creating...' : 'Create reply'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setReplyForm({
                  pinId: '',
                  authorId: '',
                  message: '',
                  parentReplyId: '',
                  mentionedUserIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={replyResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchReplies}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch replies</Typography>
        <Typography variant="body2" color="text.secondary">
          Retrieve threaded discussions for a pin.
        </Typography>
        {repliesStatus && (
          <Alert severity={repliesStatus.type} onClose={() => setRepliesStatus(null)}>
            {repliesStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Pin ID"
            value={repliesPinId}
            onChange={(event) => setRepliesPinId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingReplies}>
            {isFetchingReplies ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={repliesResult} />
      </Paper>
    </Stack>
  );
}

export default DebugConsolePage;
