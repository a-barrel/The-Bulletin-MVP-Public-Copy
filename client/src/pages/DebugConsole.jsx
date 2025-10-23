import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
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
  fetchCurrentUserProfile,
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
  fetchReplies,
  fetchDebugAuthAccounts,
  requestAccountSwap
} from '../api/mongoDataApi';
import LeafletMap from '../components/Map';
import runtimeConfig from '../config/runtime';
import { auth } from '../firebase';
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
const LIVE_CHAT_TAB_ID = 'live-chat';
const ACCOUNT_SWAP_TAB_ID = 'account-swap';
const CHAT_VIS_TAB_ID = 'chat-visualization';

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

const DEFAULT_LOCATION_COORDINATES = {
  latitude: Number.parseFloat(INITIAL_COORDINATES.latitude) || 33.7838,
  longitude: Number.parseFloat(INITIAL_COORDINATES.longitude) || -118.1136
};

const DEFAULT_LOCATION_TELEPORT_KEY = 'default-location';

const LIVE_CHAT_ROOM_PRESETS = [
  {
    key: 'global-a',
    label: 'Global Room A',
    name: 'Global Debug Lounge A',
    aliases: ['Global Debug Lounge'],
    description: 'Global lounge for debugging (Room A).',
    isGlobal: true,
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    radiusMeters: 40000000
  },
  {
    key: 'global-b',
    label: 'Global Room B',
    name: 'Global Debug Lounge B',
    aliases: ['Global Debug Lounge B'],
    description: 'Second global lounge for debugging (Room B).',
    isGlobal: true,
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    radiusMeters: 40000000
  },
  {
    key: 'long-beach',
    label: 'Long Beach, CA',
    name: 'Long Beach Debug Chat',
    aliases: ['Long Beach,California Chat Room', 'Long Beach Chat Room'],
    description: 'Geofenced chat near Long Beach, CA for proximity testing.',
    latitude: 33.77005,
    longitude: -118.193739,
    accuracy: 10,
    radiusMeters: 3000
  },
  {
    key: 'shoreline-village',
    label: 'Shoreline Village',
    name: 'Long Beach Shoreline Village Chat',
    aliases: ['Shoreline Village Chat', 'Downtown Waterfront Chat'],
    description: 'Waterfront chats along Shoreline Village for debugging short hops between rooms.',
    latitude: 33.7633,
    longitude: -118.1899,
    accuracy: 12,
    radiusMeters: 1200
  },
  {
    key: 'belmont-shore',
    label: 'Belmont Shore',
    name: 'Belmont Shore Meetups',
    aliases: ['Belmont Shore Chat', 'Belmont Shore Debug'],
    description: 'Beachside chat circle for Belmont Shore events and meetups.',
    latitude: 33.7603,
    longitude: -118.1309,
    accuracy: 12,
    radiusMeters: 1400
  },
  {
    key: 'signal-hill',
    label: 'Signal Hill Overlook',
    name: 'Signal Hill Lookout Chat',
    aliases: ['Signal Hill Chat Room'],
    description: 'Hilltop coverage to validate elevation and short-distance transitions.',
    latitude: 33.8044,
    longitude: -118.1678,
    accuracy: 12,
    radiusMeters: 1300
  },
  {
    key: 'csulb',
    label: 'CSULB Campus',
    name: 'CSULB Campus Chat',
    aliases: ['Campus Chat Room', 'Long Beach State Chat'],
    description: 'Geofenced room covering the Cal State Long Beach campus.',
    latitude: 33.7838,
    longitude: -118.1141,
    accuracy: 12,
    radiusMeters: 1600
  }
];

const TELEPORT_PRESETS = [
  {
    key: 'long-beach',
    label: 'Teleport user location to Long Beach, California',
    latitude: 33.77005,
    longitude: -118.193739,
    accuracy: 12,
    statusMessage: 'Location spoofed to Long Beach, CA.'
  },
  {
    key: 'shoreline-village',
    label: 'Teleport to Shoreline Village waterfront',
    latitude: 33.7633,
    longitude: -118.1899,
    accuracy: 12,
    statusMessage: 'Location spoofed to Long Beach Shoreline Village.'
  },
  {
    key: 'belmont-shore',
    label: 'Teleport to Belmont Shore',
    latitude: 33.7603,
    longitude: -118.1309,
    accuracy: 12,
    statusMessage: 'Location spoofed to Belmont Shore.'
  },
  {
    key: 'csulb-campus',
    label: 'Teleport to CSULB campus',
    latitude: 33.7838,
    longitude: -118.1141,
    accuracy: 12,
    statusMessage: 'Location spoofed to the CSULB campus.'
  },
  {
    key: 'signal-hill',
    label: 'Teleport to Signal Hill overlook',
    latitude: 33.8044,
    longitude: -118.1678,
    accuracy: 12,
    statusMessage: 'Location spoofed to Signal Hill.'
  },
  {
    key: DEFAULT_LOCATION_TELEPORT_KEY,
    label: 'Default location sharing',
    latitude: DEFAULT_LOCATION_COORDINATES.latitude,
    longitude: DEFAULT_LOCATION_COORDINATES.longitude,
    accuracy: 15,
    statusMessage: 'Location reset to the default debug coordinates.'
  }
];

const SPOOF_STEP_METERS = 3218; // ~2 miles
const DIRECTION_SUCCESS_MESSAGES = {
  north: 'Moved north by roughly 2 miles.',
  south: 'Moved south by roughly 2 miles.',
  east: 'Moved east by roughly 2 miles.',
  west: 'Moved west by roughly 2 miles.'
};
const EARTH_RADIUS_METERS = 6371000;
const toRadians = (value) => (value * Math.PI) / 180;
const metersToLatitudeDegrees = (meters) => (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);
const metersToLongitudeDegrees = (meters, latitude) => {
  const latitudeRadians = toRadians(latitude);
  const denominator = Math.cos(latitudeRadians);
  if (Math.abs(denominator) < 1e-6) {
    return 0;
  }
  return (meters / (EARTH_RADIUS_METERS * denominator)) * (180 / Math.PI);
};
const clampLatitude = (value) => Math.max(-90, Math.min(90, value));
const normalizeLongitude = (value) => {
  if (!Number.isFinite(value)) {
    return value;
  }
  let normalized = value;
  while (normalized > 180) {
    normalized -= 360;
  }
  while (normalized < -180) {
    normalized += 360;
  }
  return normalized;
};
const haversineDistanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) {
    return Number.NaN;
  }
  const lat1 = toRadians(pointA.latitude);
  const lat2 = toRadians(pointB.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(pointB.longitude - pointA.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const evaluateRoomAccess = (room, location) => {
  if (!room) {
    return { allowed: false, reason: 'Select a chat room to begin.' };
  }

  if (room.isGlobal || (room.radiusMeters && room.radiusMeters >= 40000000)) {
    return { allowed: true };
  }

  const coordinates = room.coordinates?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return { allowed: true };
  }

  if (!location || Number.isNaN(location.latitude) || Number.isNaN(location.longitude)) {
    return {
      allowed: false,
      reason: 'Spoof your location before entering geofenced chat rooms.'
    };
  }

  const [roomLongitude, roomLatitude] = coordinates;
  const distanceMeters = haversineDistanceMeters(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: roomLatitude, longitude: roomLongitude }
  );

  if (!Number.isFinite(distanceMeters)) {
    return { allowed: true };
  }

  if (room.radiusMeters !== undefined && distanceMeters > room.radiusMeters) {
    const withinLabel =
      distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(distanceMeters)} m`;
    const radiusLabel =
      room.radiusMeters >= 1000
        ? `${(room.radiusMeters / 1000).toFixed(1)} km`
        : `${Math.round(room.radiusMeters)} m`;
    return {
      allowed: false,
      reason: `Outside the "${room.name}" radius. You're ${withinLabel} away; move within ${radiusLabel}.`,
      distanceMeters,
      radiusMeters: room.radiusMeters
    };
  }

  return {
    allowed: true,
    distanceMeters,
    radiusMeters: room.radiusMeters
  };
};

const isGlobalChatRoom = (room) =>
  Boolean(room?.isGlobal) ||
  (Number.isFinite(room?.radiusMeters) && room.radiusMeters >= 40000000);

const resolveActiveRoomForLocation = (rooms, location) => {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return null;
  }

  let bestRoom = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const room of rooms) {
    const access = evaluateRoomAccess(room, location);
    if (!access.allowed) {
      continue;
    }

    const isGlobal = isGlobalChatRoom(room);
    const distance = Number.isFinite(access.distanceMeters) ? access.distanceMeters : Number.POSITIVE_INFINITY;
    const score = isGlobal ? distance + 1e6 : distance;

    if (score < bestScore) {
      bestRoom = room;
      bestScore = score;
    }
  }

  return bestRoom;
};

const formatDistanceMetersLabel = (value) => {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} km`;
  }
  return `${Math.round(value)} m`;
};

const shiftLocationByDirection = (source, direction, stepMeters = SPOOF_STEP_METERS) => {
  if (
    !source ||
    !Number.isFinite(source.latitude) ||
    !Number.isFinite(source.longitude) ||
    !direction
  ) {
    return null;
  }

  const latitudeOffset = metersToLatitudeDegrees(stepMeters);
  const longitudeOffset = metersToLongitudeDegrees(stepMeters, source.latitude);
  let nextLatitude = source.latitude;
  let nextLongitude = source.longitude;

  switch (direction) {
    case 'north':
      nextLatitude += latitudeOffset;
      break;
    case 'south':
      nextLatitude -= latitudeOffset;
      break;
    case 'east':
      nextLongitude += longitudeOffset;
      break;
    case 'west':
      nextLongitude -= longitudeOffset;
      break;
    default:
      return null;
  }

  const latitude = clampLatitude(nextLatitude);
  const longitude = normalizeLongitude(nextLongitude);

  if (
    Math.abs(latitude - source.latitude) < 1e-9 &&
    Math.abs(longitude - source.longitude) < 1e-9
  ) {
    return source;
  }

  return {
    latitude,
    longitude,
    accuracy: source.accuracy
  };
};

const formatDateTimeLocal = (date) => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - timezoneOffsetMs);
  return localDate.toISOString().slice(0, 16);
};

const formatReadableTimestamp = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const deriveInitials = (value) => {
  if (!value) {
    return '?';
  }
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
};

const METERS_PER_MILE = 1609.34;
const normalizeRoomName = (value) => `${value ?? ''}`.trim().toLowerCase();
const toIdString = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    if (value._id) {
      return toIdString(value._id);
    }
    if (typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue && stringValue !== '[object Object]') {
        return stringValue;
      }
    }
  }
  return `${value}`;
};
const mongooseObjectIdLike = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
const TAB_OPTIONS = [
  { id: 'pin', label: 'Pins & Events' },
  { id: 'profile', label: 'Profiles' },
  { id: 'locations', label: 'Locations' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'chat', label: 'Chat' },
  { id: LIVE_CHAT_TAB_ID, label: 'Live Chat Test' },
  { id: CHAT_VIS_TAB_ID, label: 'Chat Room Visualization' },
  { id: 'updates', label: 'Updates' },
  { id: 'replies', label: 'Replies' },
  { id: ACCOUNT_SWAP_TAB_ID, label: 'Account Swap' },
  ...(EXPERIMENT_ENABLED ? [{ id: EXPERIMENT_TAB_ID, label: EXPERIMENT_TITLE }] : [])
];
const PIN_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'pin');
const PROFILE_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'profile');
const LOCATIONS_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'locations');
const BOOKMARKS_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'bookmarks');
const CHAT_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'chat');
const LIVE_CHAT_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === LIVE_CHAT_TAB_ID);
const CHAT_VIS_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === CHAT_VIS_TAB_ID);
const UPDATES_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'updates');
const REPLIES_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === 'replies');
const ACCOUNT_SWAP_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === ACCOUNT_SWAP_TAB_ID);
const EXPERIMENT_TAB_INDEX = TAB_OPTIONS.findIndex((tab) => tab.id === EXPERIMENT_TAB_ID);

const ACCOUNT_STATUS_OPTIONS = ['active', 'inactive', 'suspended', 'deleted'];
const UPDATE_TYPE_OPTIONS = [
  'new-pin',
  'pin-update',
  'event-starting-soon',
  'event-reminder',
  'popular-pin',
  'bookmark-update',
  'system',
  'chat-message',
  'friend-request',
  'chat-room-transition'
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

  const theme = useTheme();
  const isCompactTabs = useMediaQuery(theme.breakpoints.down('md'));

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
          orientation={isCompactTabs ? 'vertical' : 'horizontal'}
          variant={isCompactTabs ? 'standard' : 'scrollable'}
          allowScrollButtonsMobile={!isCompactTabs}
          sx={{
            width: '100%',
            ...(isCompactTabs
              ? {
                  alignSelf: 'stretch',
                  '& .MuiTabs-flexContainer': {
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 1
                  },
                  '& .MuiTab-root': {
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    minWidth: 'auto'
                  },
                  '& .MuiTabs-indicator': {
                    left: 0
                  }
                }
              : {
                  '& .MuiTab-root': {
                    minWidth: 'auto'
                  }
                })
          }}
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
          hidden={activeTab !== PIN_TAB_INDEX}
          id="debug-tabpanel-pin"
          aria-labelledby="debug-tab-pin"
          sx={{ display: activeTab === PIN_TAB_INDEX ? 'contents' : 'none' }}
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
          hidden={activeTab !== PROFILE_TAB_INDEX}
          id="debug-tabpanel-profile"
          aria-labelledby="debug-tab-profile"
          sx={{ display: activeTab === PROFILE_TAB_INDEX ? 'block' : 'none' }}
        >
          <ProfilesTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== LOCATIONS_TAB_INDEX}
          id="debug-tabpanel-locations"
          aria-labelledby="debug-tab-locations"
          sx={{ display: activeTab === LOCATIONS_TAB_INDEX ? 'block' : 'none' }}
        >
          <LocationsTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== BOOKMARKS_TAB_INDEX}
          id="debug-tabpanel-bookmarks"
          aria-labelledby="debug-tab-bookmarks"
          sx={{ display: activeTab === BOOKMARKS_TAB_INDEX ? 'block' : 'none' }}
        >
          <BookmarksTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== CHAT_TAB_INDEX}
          id="debug-tabpanel-chat"
          aria-labelledby="debug-tab-chat"
          sx={{ display: activeTab === CHAT_TAB_INDEX ? 'block' : 'none' }}
        >
          <ChatTab />
        </Box>

        {LIVE_CHAT_TAB_INDEX !== -1 && (
          <Box
            role="tabpanel"
            hidden={activeTab !== LIVE_CHAT_TAB_INDEX}
            id="debug-tabpanel-live-chat"
            aria-labelledby="debug-tab-live-chat"
            sx={{ display: activeTab === LIVE_CHAT_TAB_INDEX ? 'block' : 'none' }}
          >
            <LiveChatTestTab />
          </Box>
        )}

        {CHAT_VIS_TAB_INDEX !== -1 && (
          <Box
            role="tabpanel"
            hidden={activeTab !== CHAT_VIS_TAB_INDEX}
            id="debug-tabpanel-chat-visualization"
            aria-labelledby="debug-tab-chat-visualization"
            sx={{ display: activeTab === CHAT_VIS_TAB_INDEX ? 'block' : 'none' }}
          >
            <ChatRoomVisualizationTab />
          </Box>
        )}

        <Box
          role="tabpanel"
          hidden={activeTab !== UPDATES_TAB_INDEX}
          id="debug-tabpanel-updates"
          aria-labelledby="debug-tab-updates"
          sx={{ display: activeTab === UPDATES_TAB_INDEX ? 'block' : 'none' }}
        >
          <UpdatesTab />
        </Box>

        <Box
          role="tabpanel"
          hidden={activeTab !== REPLIES_TAB_INDEX}
          id="debug-tabpanel-replies"
          aria-labelledby="debug-tab-replies"
          sx={{ display: activeTab === REPLIES_TAB_INDEX ? 'block' : 'none' }}
        >
          <RepliesTab />
        </Box>
        {ACCOUNT_SWAP_TAB_INDEX !== -1 && (
          <Box
            role="tabpanel"
            hidden={activeTab !== ACCOUNT_SWAP_TAB_INDEX}
            id="debug-tabpanel-account-swap"
            aria-labelledby="debug-tab-account-swap"
            sx={{ display: activeTab === ACCOUNT_SWAP_TAB_INDEX ? 'block' : 'none' }}
          >
            <AccountSwapTab />
          </Box>
        )}
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

function LiveChatTestTab() {
  const [currentUser] = useAuthState(auth);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [roomsByKey, setRoomsByKey] = useState({});
  const [selectedRoomKey, setSelectedRoomKey] = useState(LIVE_CHAT_ROOM_PRESETS[0].key);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [status, setStatus] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [isEnsuringRooms, setIsEnsuringRooms] = useState(false);
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTeleporting, setIsTeleporting] = useState(false);
  const [activeLocationKey, setActiveLocationKey] = useState(DEFAULT_LOCATION_TELEPORT_KEY);
  const defaultTeleportPreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === DEFAULT_LOCATION_TELEPORT_KEY),
    []
  );
  const resolveAuthorAvatar = useCallback((author) => {
    if (!author) {
      return resolveMediaUrl(DEFAULT_AVATAR_PATH);
    }
    const avatar = author.avatar;
    if (typeof avatar === 'string') {
      return resolveMediaUrl(avatar);
    }
    if (avatar && typeof avatar === 'object') {
      const source = avatar.url || avatar.thumbnailUrl;
      if (typeof source === 'string' && source.trim()) {
        return resolveMediaUrl(source);
      }
    }
    return resolveMediaUrl(DEFAULT_AVATAR_PATH);
  }, []);
  const [lastSpoofedLocation, setLastSpoofedLocation] = useState(() =>
    defaultTeleportPreset
      ? {
          latitude: defaultTeleportPreset.latitude,
          longitude: defaultTeleportPreset.longitude,
          accuracy: defaultTeleportPreset.accuracy
        }
      : null
  );
  const selectedRoomKeyRef = useRef(selectedRoomKey);
  const messagesEndRef = useRef(null);

  const currentProfileId = useMemo(() => toIdString(currentProfile?._id), [currentProfile]);
  const activeRoomRadiusLabel = useMemo(() => {
    if (!activeRoom?.radiusMeters) {
      return null;
    }
    if (activeRoom.radiusMeters >= 1000) {
      return `${(activeRoom.radiusMeters / 1000).toFixed(1)} km radius`;
    }
    return `${Math.round(activeRoom.radiusMeters)} m radius`;
  }, [activeRoom]);
  const activeTeleportPreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === activeLocationKey),
    [activeLocationKey]
  );
  const roomAccess = useMemo(
    () => evaluateRoomAccess(activeRoom, lastSpoofedLocation),
    [activeRoom, lastSpoofedLocation]
  );
  const distanceToRoomLabel = useMemo(() => {
    if (!roomAccess?.allowed || roomAccess.distanceMeters === undefined) {
      return null;
    }
    const distance = roomAccess.distanceMeters;
    if (!Number.isFinite(distance)) {
      return null;
    }
    return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km away` : `${Math.round(distance)} m away`;
  }, [roomAccess]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    selectedRoomKeyRef.current = selectedRoomKey;
  }, [selectedRoomKey]);

  const loadProfile = useCallback(async () => {
    if (!currentUser) {
      setCurrentProfile(null);
      return;
    }
    try {
      const profile = await fetchCurrentUserProfile();
      setCurrentProfile(profile);
    } catch (error) {
      console.error('Failed to load current user profile:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to load current user profile.' });
      setCurrentProfile(null);
    }
  }, [currentUser]);

  const loadMessages = useCallback(async (room) => {
    const roomId = toIdString(room?._id);
    if (!roomId || !mongooseObjectIdLike(roomId)) {
      if (!roomId) {
        setStatus({
          type: 'warning',
          message: 'Select a valid chat room before refreshing messages.'
        });
      } else {
        setStatus({
          type: 'error',
          message: `Selected chat room has an invalid id (${roomId}). Reload the rooms.`
        });
      }
      setMessages([]);
      return;
    }

    setIsRefreshingMessages(true);
    try {
      const list = await fetchChatMessages(roomId);
      setMessages(list);
    } catch (error) {
      console.error('Failed to refresh chat messages:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to refresh messages.' });
    } finally {
      setIsRefreshingMessages(false);
    }
  }, []);

  const ensurePresetRooms = useCallback(
    async (preferredKey) => {
      if (!currentUser) {
        setRoomsByKey({});
        setActiveRoom(null);
        setMessages([]);
        setStatus({ type: 'warning', message: 'Sign in to test the live chat rooms.' });
        return;
      }

      if (!currentProfile?._id) {
        setStatus({
          type: 'warning',
          message: 'Current user profile is unavailable. Swap accounts or refresh the page.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      setIsEnsuringRooms(true);
      try {
        const rooms = await fetchChatRooms();
        const remainingRooms = Array.isArray(rooms) ? [...rooms] : [];
        const nextRoomsByKey = {};

        for (const preset of LIVE_CHAT_ROOM_PRESETS) {
          const targetNames = [preset.name, ...(preset.aliases ?? [])].map(normalizeRoomName);
          const matchIndex = remainingRooms.findIndex((candidate) =>
            targetNames.includes(normalizeRoomName(candidate?.name))
          );

          let resolvedRoom;
          if (matchIndex >= 0) {
            resolvedRoom = remainingRooms.splice(matchIndex, 1)[0];
          } else {
            const created = await createProximityChatRoom({
              ownerId: currentProfileId,
              name: preset.name,
              description: preset.description,
              latitude: preset.latitude,
              longitude: preset.longitude,
              accuracy: preset.accuracy,
              radiusMeters: preset.radiusMeters,
              isGlobal: Boolean(preset.isGlobal),
              participantIds: [currentProfileId],
              moderatorIds: [currentProfileId]
            });
            resolvedRoom = created;
          }

          const normalizedRoom = {
            ...resolvedRoom,
            _id: toIdString(resolvedRoom?._id),
            ownerId: toIdString(resolvedRoom?.ownerId),
            presetKey: preset.key
          };
          nextRoomsByKey[preset.key] = normalizedRoom;
        }

        setRoomsByKey(nextRoomsByKey);

        const resolveNextKey = () => {
          if (preferredKey && nextRoomsByKey[preferredKey]) {
            return preferredKey;
          }

          const accessible = LIVE_CHAT_ROOM_PRESETS.find((preset) => {
            const room = nextRoomsByKey[preset.key];
            if (!room) {
              return false;
            }
            return evaluateRoomAccess(room, lastSpoofedLocation).allowed;
          });
          if (accessible) {
            return accessible.key;
          }

          return LIVE_CHAT_ROOM_PRESETS.find((preset) => nextRoomsByKey[preset.key])?.key;
        };

        const nextKey = resolveNextKey() ?? LIVE_CHAT_ROOM_PRESETS[0].key;

        const nextRoom = nextRoomsByKey[nextKey] ?? null;
        setSelectedRoomKey(nextKey);
        setActiveRoom(nextRoom);
        if (!nextRoom) {
          setMessages([]);
        } else {
          setStatus(null);
        }
      } catch (error) {
        console.error('Failed to ensure chat rooms:', error);
        setRoomsByKey({});
        setActiveRoom(null);
        setMessages([]);
        setStatus({ type: 'error', message: error.message || 'Failed to load chat rooms.' });
      } finally {
        setIsEnsuringRooms(false);
      }
    },
    [currentProfile, currentProfileId, currentUser, lastSpoofedLocation]
  );

  const handleSelectRoom = useCallback(
    (roomKey) => {
      if (!roomKey) {
        return;
      }
      setSelectedRoomKey(roomKey);
      const nextRoom = roomsByKey[roomKey];
      if (nextRoom) {
        setActiveRoom(nextRoom);
      } else {
        ensurePresetRooms(roomKey);
      }
    },
    [ensurePresetRooms, roomsByKey]
  );

  const handleReloadRooms = useCallback(() => {
    ensurePresetRooms(selectedRoomKeyRef.current);
  }, [ensurePresetRooms]);

  const handleRefreshMessages = useCallback(() => {
    if (!activeRoom) {
      setStatus({ type: 'warning', message: 'Select a chat room before refreshing messages.' });
      return;
    }
    if (!roomAccess.allowed) {
      setStatus({ type: 'warning', message: roomAccess.reason });
      return;
    }
    loadMessages(activeRoom);
  }, [activeRoom, loadMessages, roomAccess]);

  const handleTeleport = useCallback(
    async (preset) => {
      if (!currentProfile?._id) {
        setLocationStatus({
          type: 'warning',
          message: 'Current user profile is unavailable. Swap accounts or refresh the page.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setLocationStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      setIsTeleporting(true);
      setLocationStatus(null);

      try {
        await insertLocationUpdate({
          userId: currentProfileId,
          coordinates: {
            type: 'Point',
            coordinates: [preset.longitude, preset.latitude],
            accuracy: preset.accuracy
          },
          isPublic: true,
          source: 'web'
        });

        setActiveLocationKey(preset.key);
        setLastSpoofedLocation({
          latitude: preset.latitude,
          longitude: preset.longitude,
          accuracy: preset.accuracy
        });
        setLocationStatus({
          type: 'success',
          message: preset.statusMessage
        });
      } catch (error) {
        console.error('Failed to spoof location:', error);
        setLocationStatus({ type: 'error', message: error.message || 'Failed to spoof location.' });
      } finally {
        setIsTeleporting(false);
      }
    },
    [currentProfile, currentProfileId]
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!currentUser || !currentProfile?._id) {
      return;
    }
    ensurePresetRooms(selectedRoomKeyRef.current);
  }, [currentUser, currentProfile, ensurePresetRooms]);

  useEffect(() => {
    const roomId = toIdString(activeRoom?._id);
    if (!roomId || !mongooseObjectIdLike(roomId)) {
      if (!activeRoom) {
        setMessages([]);
      }
      return;
    }

    if (!roomAccess.allowed) {
      setMessages([]);
      return;
    }

    setMessages([]);
    loadMessages(activeRoom);

    if (currentProfileId && mongooseObjectIdLike(currentProfileId)) {
      createProximityChatPresence({
        roomId,
        userId: currentProfileId
      }).catch((error) => {
        console.warn('Failed to record chat presence:', error);
      });
    }
  }, [activeRoom, currentProfileId, loadMessages, roomAccess]);

  useEffect(() => {
    const roomId = toIdString(activeRoom?._id);
    if (!roomId || !mongooseObjectIdLike(roomId) || !roomAccess.allowed) {
      return undefined;
    }
    const interval = setInterval(() => {
      loadMessages(activeRoom);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeRoom, loadMessages, roomAccess]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    setStatus(null);

    const roomId = toIdString(activeRoom?._id);
    if (!roomId || !mongooseObjectIdLike(roomId)) {
      setStatus({ type: 'warning', message: 'Select a chat room before sending a message.' });
      return;
    }

    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      setStatus({
        type: 'error',
        message: 'Current user profile is unavailable. Try swapping accounts again.'
      });
      return;
    }

    if (!roomAccess.allowed) {
      setStatus({ type: 'warning', message: roomAccess.reason });
      return;
    }

    const trimmed = messageInput.trim();
    if (!trimmed) {
      setStatus({ type: 'warning', message: 'Enter a message before sending.' });
      return;
    }

    setIsSending(true);
    try {
      const payload = {
        roomId,
        authorId: currentProfileId,
        message: trimmed
      };

      if (lastSpoofedLocation) {
        payload.latitude = lastSpoofedLocation.latitude;
        payload.longitude = lastSpoofedLocation.longitude;
        if (lastSpoofedLocation.accuracy !== undefined) {
          payload.accuracy = lastSpoofedLocation.accuracy;
        }
      }

      const created = await createProximityChatMessage(payload);
      setMessages((prev) => [...prev, created]);
      setMessageInput('');
      try {
        await createProximityChatPresence({
          roomId,
          userId: currentProfileId
        });
      } catch (presenceError) {
        console.warn('Failed to update chat presence after sending message:', presenceError);
      }
    } catch (error) {
      console.error('Failed to send chat message:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to send message.' });
    } finally {
      setIsSending(false);
    }
  };

  const sendingAsLabel = useMemo(() => {
    if (currentProfile) {
      return (
        currentProfile.displayName ||
        currentProfile.username ||
        currentProfile.email ||
        currentProfile._id
      );
    }
    if (currentUser) {
      return currentUser.displayName || currentUser.email || currentUser.uid;
    }
    return 'Unknown user';
  }, [currentProfile, currentUser]);

  const currentAvatar = useMemo(() => resolveAuthorAvatar(currentProfile), [currentProfile, resolveAuthorAvatar]);

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Live Chat Test</Typography>
          <Typography variant="body2" color="text.secondary">
            Swap between preset chat rooms and spoof GPS to validate proximity behavior for live chat.
          </Typography>
        </Stack>

        {status && (
          <Alert severity={status.type} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        )}
        {!roomAccess.allowed && activeRoom && (
          <Alert severity="warning">{roomAccess.reason}</Alert>
        )}

        {!currentUser && (
          <Alert severity="warning">
            Sign in to interact with the live chat rooms.
          </Alert>
        )}

        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Chat room presets</Typography>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <ToggleButtonGroup
                value={selectedRoomKey}
                exclusive
                onChange={(_, value) => value && handleSelectRoom(value)}
                size="small"
                color="primary"
                sx={{ flexWrap: 'wrap' }}
              >
                {LIVE_CHAT_ROOM_PRESETS.map((preset) => (
                  <ToggleButton
                    key={preset.key}
                    value={preset.key}
                    disabled={isEnsuringRooms && !roomsByKey[preset.key]}
                    sx={{ textTransform: 'none', minWidth: 140 }}
                  >
                    {preset.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {isEnsuringRooms && <CircularProgress size={20} />}
            </Stack>
            {activeRoom && (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activeRoom.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {activeRoomRadiusLabel && <Chip size="small" label={activeRoomRadiusLabel} />}
                  {distanceToRoomLabel && <Chip size="small" color="secondary" label={distanceToRoomLabel} />}
                  {activeRoom.description && (
                    <Typography variant="caption" color="text.secondary">
                      {activeRoom.description}
                    </Typography>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">GPS spoofing</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              {TELEPORT_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  size="small"
                  variant={preset.key === activeLocationKey ? 'contained' : 'outlined'}
                  onClick={() => handleTeleport(preset)}
                  disabled={isTeleporting || !currentUser}
                  sx={{ textTransform: 'none', minWidth: 220 }}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>
            {activeTeleportPreset && (
              <Typography variant="caption" color="text.secondary">
                Active GPS preset: {activeTeleportPreset.label} ({activeTeleportPreset.latitude.toFixed(4)}, {activeTeleportPreset.longitude.toFixed(4)})
              </Typography>
            )}
            {locationStatus && (
              <Alert severity={locationStatus.type} onClose={() => setLocationStatus(null)}>
                {locationStatus.message}
              </Alert>
            )}
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar src={currentAvatar} alt={sendingAsLabel} />
            <Stack spacing={0.3}>
              <Typography variant="subtitle2">Sending as</Typography>
              <Typography variant="body2" color="text.secondary">
                {sendingAsLabel}
              </Typography>
            </Stack>
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1}>
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={handleReloadRooms}
              disabled={isEnsuringRooms || !currentUser}
            >
              {isEnsuringRooms ? 'Loading rooms...' : 'Reload rooms'}
            </Button>
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={handleRefreshMessages}
              disabled={isRefreshingMessages || !activeRoom}
            >
              {isRefreshingMessages ? 'Refreshing...' : 'Refresh messages'}
            </Button>
          </Stack>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2 },
            height: 360,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            backgroundColor: 'background.default'
          }}
        >
          {!roomAccess.allowed && activeRoom ? (
            <Typography variant="body2" color="text.secondary">
              {roomAccess.reason}
            </Typography>
          ) : messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {isEnsuringRooms || isRefreshingMessages
                ? 'Loading messages...'
                : 'No messages yet. Send something to get started.'}
            </Typography>
          ) : (
            messages.map((message) => {
              const key = message?._id || `${message?.createdAt}-${message?.authorId || Math.random()}`;
              const authorName =
                message?.author?.displayName ||
                message?.author?.username ||
                message?.authorId ||
                'Unknown user';
              const avatarSrc = resolveAuthorAvatar(message?.author);
              const timestamp = formatReadableTimestamp(message?.createdAt);
              const messageAuthorId = toIdString(message?.authorId);
              const isSelf = currentProfileId && messageAuthorId && messageAuthorId === currentProfileId;

              return (
                <Stack
                  key={key}
                  direction="row"
                  spacing={2}
                  alignItems="flex-start"
                  justifyContent={isSelf ? 'flex-end' : 'flex-start'}
                >
                  {!isSelf && <Avatar src={avatarSrc} alt={authorName} sx={{ width: 36, height: 36 }} />}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      maxWidth: '80%',
                      backgroundColor: isSelf ? 'primary.main' : 'background.paper',
                      color: isSelf ? 'primary.contrastText' : 'text.primary'
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {authorName}
                        </Typography>
                        {timestamp && (
                          <Typography variant="caption" color="text.secondary">
                            {timestamp}
                          </Typography>
                        )}
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message?.message}
                      </Typography>
                    </Stack>
                  </Paper>
                  {isSelf && <Avatar src={avatarSrc} alt={authorName} sx={{ width: 36, height: 36 }} />}
                </Stack>
              );
            })
          )}
          <Box ref={messagesEndRef} />
        </Paper>

        <Box component="form" onSubmit={handleSendMessage}>
          <Stack spacing={2}>
            <TextField
              label="Message"
              multiline
              minRows={2}
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder={`Type a message for ${activeRoom?.name ?? 'the selected chat room'}`}
              disabled={!currentUser || !activeRoom || !roomAccess.allowed}
            />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={!currentUser || !activeRoom || !roomAccess.allowed || isSending}
              >
                {isSending ? 'Sending...' : 'Send message'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}

function AccountSwapTab() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [swapStatus, setSwapStatus] = useState(null);
  const [pendingUid, setPendingUid] = useState(null);
  const [currentUser] = useAuthState(auth);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const list = await fetchDebugAuthAccounts();
      setAccounts(list);
    } catch (error) {
      setFetchError(error.message || 'Failed to load Firebase accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDebugAuthAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSwap = useCallback(
    async (account) => {
      setSwapStatus(null);
      setPendingUid(account.uid);
      try {
        const token = await requestAccountSwap(account.uid);
        await signInWithCustomToken(auth, token);
        setSwapStatus({
          type: 'success',
          message: `Now signed in as ${account.displayName || account.email || account.uid}.`
        });
        await loadAccounts();
      } catch (error) {
        setSwapStatus({
          type: 'error',
          message: error.message || 'Failed to swap accounts.'
        });
      } finally {
        setPendingUid(null);
      }
    },
    [loadAccounts, requestAccountSwap, signInWithCustomToken, auth]
  );

  const currentUserLabel =
    currentUser?.displayName || currentUser?.email || currentUser?.uid || 'Unknown user';

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Account Swap
          </Typography>
          <Button
            type="button"
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={loadAccounts}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Swap between Firebase Auth emulator accounts for offline testing without leaving the app.
        </Typography>

        {currentUser && (
          <Alert severity="info">
            Current Firebase user: <strong>{currentUserLabel}</strong>
          </Alert>
        )}

        {swapStatus && (
          <Alert severity={swapStatus.type} onClose={() => setSwapStatus(null)}>
            {swapStatus.message}
          </Alert>
        )}

        {fetchError && (
          <Alert severity="error" onClose={() => setFetchError(null)}>
            {fetchError}
          </Alert>
        )}

        {isLoading && accounts.length === 0 ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={32} />
          </Stack>
        ) : accounts.length === 0 ? (
          <Alert severity="warning">No Firebase accounts were found in the emulator export.</Alert>
        ) : (
          <List disablePadding>
            {accounts.map((account, index) => {
              const label = account.displayName || account.email || account.uid;
              const initials = deriveInitials(label);
              const isCurrent = currentUser?.uid === account.uid;
              const isPending = pendingUid === account.uid;
              const actionDisabled = isCurrent || isPending || Boolean(account.disabled);
              const lastSignIn = formatReadableTimestamp(account.lastLoginAt);

              return (
                <ListItem
                  key={account.uid}
                  alignItems="flex-start"
                  divider={index !== accounts.length - 1}
                  secondaryAction={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {isCurrent && <Chip label="Current" color="success" size="small" />}
                      <Button
                        type="button"
                        size="small"
                        variant="contained"
                        onClick={() => handleSwap(account)}
                        disabled={actionDisabled}
                      >
                        {isPending ? 'Switching...' : 'Swap to'}
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={account.photoUrl || undefined} alt={label}>
                      {initials}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography variant="subtitle1">{label}</Typography>
                        {account.disabled && <Chip label="Disabled" color="warning" size="small" />}
                      </Stack>
                    }
                    primaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {account.email && (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {account.email}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" component="span">
                          UID: {account.uid}
                        </Typography>
                        {account.providerIds?.length ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {account.providerIds.map((providerId) => (
                              <Chip key={providerId} label={providerId} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        ) : null}
                        {lastSignIn && (
                          <Typography variant="caption" color="text.secondary" component="span">
                            Last sign-in: {lastSignIn}
                          </Typography>
                        )}
                      </Stack>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>
    </Stack>
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
          {EXPERIMENT_TITLE} â€” {activeScreen?.label}
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
    if (!userId && !currentUser) {
      setFetchStatus({ type: 'error', message: 'Sign in to load your profile.' });
      return;
    }

    try {
      setIsFetching(true);
      const profile = userId ? await fetchUserProfile(userId) : await fetchCurrentUserProfile();
      if (!userId && profile?._id) {
        setFetchUserId(profile._id);
      }
      setFetchedProfile(profile);
      setEditForm(buildEditForm(profile));
      setFetchStatus({
        type: 'success',
        message: userId ? 'Profile loaded.' : 'Loaded current user profile.'
      });
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
            fullWidth
            placeholder="Leave blank to load the signed-in user"
            helperText="Optional: provide a MongoDB user id or leave empty to load your own profile."
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

function ChatRoomVisualizationTab() {
  const [currentUser] = useAuthState(auth);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState(null);

  const defaultTeleportPreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === DEFAULT_LOCATION_TELEPORT_KEY),
    []
  );

  const initialSpoofLocation = useMemo(
    () => ({
      latitude: defaultTeleportPreset?.latitude ?? DEFAULT_LOCATION_COORDINATES.latitude,
      longitude: defaultTeleportPreset?.longitude ?? DEFAULT_LOCATION_COORDINATES.longitude,
      accuracy: defaultTeleportPreset?.accuracy
    }),
    [defaultTeleportPreset]
  );

  const [activePresetKey, setActivePresetKey] = useState(
    defaultTeleportPreset?.key ?? DEFAULT_LOCATION_TELEPORT_KEY
  );
  const [lastSpoofedLocation, setLastSpoofedLocation] = useState(initialSpoofLocation);
  const [teleportStatus, setTeleportStatus] = useState(null);
  const [isTeleporting, setIsTeleporting] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [roomsStatus, setRoomsStatus] = useState(null);
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const selectedRoomIdRef = useRef(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const currentRoomRef = useRef(null);
  const lastAnnouncedTransitionRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const hasUserMovedRef = useRef(false);
  const [movementStatus, setMovementStatus] = useState(null);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  const [mapCenterOverride, setMapCenterOverride] = useState(() => ({
    latitude: initialSpoofLocation.latitude,
    longitude: initialSpoofLocation.longitude
  }));

  const currentProfileId = useMemo(() => toIdString(currentProfile?._id), [currentProfile]);

  const loadProfile = useCallback(async () => {
    if (!currentUser) {
      setCurrentProfile(null);
      return;
    }

    setProfileStatus(null);
    try {
      const profile = await fetchCurrentUserProfile();
      setCurrentProfile(profile);
    } catch (error) {
      console.error('Failed to load current user profile for visualization tab:', error);
      setProfileStatus({ type: 'error', message: error.message || 'Failed to load current user profile.' });
      setCurrentProfile(null);
    }
  }, [currentUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const fetchRooms = useCallback(async () => {
    setRoomsStatus(null);
    setIsFetchingRooms(true);
    let createdCount = 0;
    try {
      let results = await fetchChatRooms({});
      if (!Array.isArray(results)) {
        results = [];
      }

      if (currentProfileId && mongooseObjectIdLike(currentProfileId)) {
        const scratch = [...results];

        for (const preset of LIVE_CHAT_ROOM_PRESETS) {
          const targetNames = [preset.name, ...(preset.aliases ?? [])].map(normalizeRoomName);
          const matchIndex = scratch.findIndex((candidate) =>
            targetNames.includes(normalizeRoomName(candidate?.name))
          );

          if (matchIndex >= 0) {
            continue;
          }

          try {
            const created = await createProximityChatRoom({
              ownerId: currentProfileId,
              name: preset.name,
              description: preset.description,
              latitude: preset.latitude,
              longitude: preset.longitude,
              accuracy: preset.accuracy,
              radiusMeters: preset.radiusMeters,
              isGlobal: Boolean(preset.isGlobal),
              participantIds: [currentProfileId],
              moderatorIds: [currentProfileId]
            });
            scratch.push(created);
            createdCount += 1;
          } catch (creationError) {
            console.warn('Failed to ensure preset chat room:', preset, creationError);
          }
        }

        if (createdCount > 0) {
          results = await fetchChatRooms({});
          if (!Array.isArray(results)) {
            results = [];
          }
        }
      }

      setRooms(results);
      setRoomsStatus({
        type: 'success',
        message: `Loaded ${results.length} chat room${results.length === 1 ? '' : 's'}${
          createdCount ? ` (created ${createdCount} preset${createdCount === 1 ? '' : 's'})` : ''
        }.`
      });

      if (!selectedRoomIdRef.current) {
        const focusRoom = results.find((room) => extractPinLocation(room));
        if (focusRoom) {
          const focus = extractPinLocation(focusRoom);
          if (focus) {
            setMapCenterOverride(focus);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load chat rooms for visualization tab:', error);
      setRooms([]);
      setRoomsStatus({ type: 'error', message: error.message || 'Failed to load chat rooms.' });
    } finally {
      setIsFetchingRooms(false);
    }
  }, [currentProfileId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleRefreshRooms = useCallback(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleTeleport = useCallback(
    async (preset) => {
      if (!preset) {
        return;
      }

      if (!currentUser) {
        setTeleportStatus({
          type: 'warning',
          message: 'Sign in to spoof your location.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setTeleportStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      setIsTeleporting(true);
      setTeleportStatus(null);

      try {
        await insertLocationUpdate({
          userId: currentProfileId,
          coordinates: {
            type: 'Point',
            coordinates: [preset.longitude, preset.latitude],
            accuracy: preset.accuracy
          },
          isPublic: true,
          source: 'web'
        });

        setActivePresetKey(preset.key);
        setLastSpoofedLocation({
          latitude: preset.latitude,
          longitude: preset.longitude,
          accuracy: preset.accuracy
        });
        setMapCenterOverride({ latitude: preset.latitude, longitude: preset.longitude });
        setTeleportStatus({
          type: 'success',
          message: preset.statusMessage
        });
        hasUserMovedRef.current = true;
      } catch (error) {
        console.error('Failed to spoof location from visualization tab:', error);
        setTeleportStatus({ type: 'error', message: error.message || 'Failed to spoof location.' });
      } finally {
        setIsTeleporting(false);
      }
    },
    [currentUser, currentProfileId]
  );

  const handleDirectionalSpoof = useCallback(
    async (direction) => {
      if (!direction) {
        return;
      }

      if (!currentUser) {
        setTeleportStatus({
          type: 'warning',
          message: 'Sign in to spoof your location.'
        });
        return;
      }

      if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
        setTeleportStatus({
          type: 'error',
          message: 'Current user profile is missing a valid ObjectId.'
        });
        return;
      }

      const sourceLocation =
        (lastSpoofedLocation &&
          Number.isFinite(lastSpoofedLocation.latitude) &&
          Number.isFinite(lastSpoofedLocation.longitude) &&
          lastSpoofedLocation) ||
        initialSpoofLocation;

      const nextLocation = shiftLocationByDirection(sourceLocation, direction, SPOOF_STEP_METERS);
      if (!nextLocation) {
        setTeleportStatus({
          type: 'error',
          message: 'Unable to adjust location. Teleport to a preset first.'
        });
        return;
      }

      setIsTeleporting(true);
      setTeleportStatus(null);

      try {
        const payload = {
          userId: currentProfileId,
          coordinates: {
            type: 'Point',
            coordinates: [nextLocation.longitude, nextLocation.latitude]
          },
          isPublic: true,
          source: 'web'
        };

        if (Number.isFinite(nextLocation.accuracy)) {
          payload.coordinates.accuracy = nextLocation.accuracy;
        }

        await insertLocationUpdate(payload);

        setActivePresetKey(null);
        setLastSpoofedLocation(nextLocation);
        setMapCenterOverride({ latitude: nextLocation.latitude, longitude: nextLocation.longitude });
        setTeleportStatus({
          type: 'success',
          message: DIRECTION_SUCCESS_MESSAGES[direction] ?? 'Spoofed location updated.'
        });
        hasUserMovedRef.current = true;
      } catch (error) {
        console.error('Failed to adjust spoofed location:', error);
        setTeleportStatus({ type: 'error', message: error.message || 'Failed to adjust location.' });
      } finally {
        setIsTeleporting(false);
      }
    },
    [currentUser, currentProfileId, lastSpoofedLocation, initialSpoofLocation]
  );

  useEffect(() => {
    if (!Array.isArray(rooms) || rooms.length === 0) {
      setCurrentRoomId(null);
      currentRoomRef.current = null;
      return;
    }

    const nextRoom = resolveActiveRoomForLocation(rooms, lastSpoofedLocation);
    const nextRoomId = toIdString(nextRoom?._id) || null;
    setCurrentRoomId(nextRoomId);

    const previousRoom = currentRoomRef.current;
    const previousRoomId = toIdString(previousRoom?._id) || null;

    if (previousRoomId === nextRoomId) {
      return;
    }

    currentRoomRef.current = nextRoom;

    if (!hasUserMovedRef.current) {
      return;
    }

    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      return;
    }

    const transitionKey = `${previousRoomId ?? 'none'}->${nextRoomId ?? 'none'}`;
    if (
      pendingTransitionRef.current === transitionKey ||
      lastAnnouncedTransitionRef.current === transitionKey
    ) {
      return;
    }

    pendingTransitionRef.current = transitionKey;
    let isCancelled = false;

    (async () => {
      try {
        if (nextRoomId) {
          await createProximityChatPresence({
            roomId: nextRoomId,
            userId: currentProfileId
          });
        }

        const fromLabel = previousRoom?.name ?? 'Outside chat rooms';
        const toLabel = nextRoom?.name ?? 'Outside chat rooms';
        const title = nextRoom
          ? previousRoom
            ? `Moved from ${fromLabel} to ${toLabel}`
            : `Entered ${toLabel}`
          : `Left ${fromLabel}`;

        const metadata = {
          fromRoomId: previousRoomId,
          toRoomId: nextRoomId,
          latitude: Number.isFinite(lastSpoofedLocation?.latitude) ? lastSpoofedLocation.latitude : null,
          longitude: Number.isFinite(lastSpoofedLocation?.longitude) ? lastSpoofedLocation.longitude : null
        };

        let distanceLabel = null;
        if (nextRoom && !isGlobalChatRoom(nextRoom)) {
          const nextLocation = extractPinLocation(nextRoom);
          const distanceMeters = nextLocation
            ? haversineDistanceMeters(lastSpoofedLocation, nextLocation)
            : Number.NaN;
          if (Number.isFinite(distanceMeters)) {
            metadata.distanceMeters = Number(distanceMeters.toFixed(2));
            distanceLabel = formatDistanceMetersLabel(distanceMeters);
          }
        }

        const bodyParts = [];
        if (distanceLabel) {
          bodyParts.push(`Now approximately ${distanceLabel} from the ${toLabel} center.`);
        }

        if (lastSpoofedLocation?.accuracy !== undefined) {
          metadata.accuracy = lastSpoofedLocation.accuracy;
        }

        await createUpdate({
          userId: currentProfileId,
          payload: {
            type: 'chat-room-transition',
            title,
            body: bodyParts.length ? bodyParts.join(' ') : undefined,
            metadata
          }
        });

        if (!isCancelled) {
          const severity = nextRoom ? 'success' : 'warning';
          setMovementStatus({ type: severity, message: title });
          lastAnnouncedTransitionRef.current = transitionKey;
        }
      } catch (error) {
        console.warn('Failed to record chat room transition:', error);
        if (!isCancelled) {
          setMovementStatus({
            type: 'error',
            message: error.message || 'Failed to record chat room movement.'
          });
        }
      } finally {
        if (pendingTransitionRef.current === transitionKey) {
          pendingTransitionRef.current = null;
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [rooms, lastSpoofedLocation, currentProfileId]);

  const mapPins = useMemo(
    () =>
      rooms
        .map((room) => {
          const coordinates = room?.coordinates?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) {
            return null;
          }
          const [longitude, latitude] = coordinates;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }

          const pin = {
            _id: toIdString(room?._id),
            title: room?.name ?? 'Untitled chat room',
            type: room?.isGlobal ? 'global-chat-room' : 'chat-room',
            coordinates: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            proximityRadiusMeters: room?.radiusMeters,
            description: room?.description ?? undefined
          };

          if (lastSpoofedLocation) {
            const distance = haversineDistanceMeters(lastSpoofedLocation, {
              latitude,
              longitude
            });
            if (Number.isFinite(distance)) {
              pin.distanceMeters = distance;
            }
          }

          return pin;
        })
        .filter(Boolean),
    [rooms, lastSpoofedLocation]
  );

  const selectedRoom = useMemo(
    () => rooms.find((room) => toIdString(room?._id) === selectedRoomId) ?? null,
    [rooms, selectedRoomId]
  );

  const currentRoom = useMemo(
    () => rooms.find((room) => toIdString(room?._id) === currentRoomId) ?? null,
    [rooms, currentRoomId]
  );

  const selectedRoomDistanceLabel = useMemo(() => {
    if (!selectedRoom || !lastSpoofedLocation) {
      return null;
    }
    const location = extractPinLocation(selectedRoom);
    if (!location) {
      return null;
    }
    const distance = haversineDistanceMeters(lastSpoofedLocation, location);
    if (!Number.isFinite(distance)) {
      return null;
    }
    return distance >= 1000 ? `${(distance / 1000).toFixed(2)} km away` : `${Math.round(distance)} m away`;
  }, [selectedRoom, lastSpoofedLocation]);

  const currentRoomDistanceLabel = useMemo(() => {
    if (!currentRoom || !lastSpoofedLocation) {
      return null;
    }
    const location = extractPinLocation(currentRoom);
    if (!location) {
      return null;
    }
    const distance = haversineDistanceMeters(lastSpoofedLocation, location);
    if (!Number.isFinite(distance)) {
      return null;
    }
    const label = formatDistanceMetersLabel(distance);
    return label ? `${label} from the center` : null;
  }, [currentRoom, lastSpoofedLocation]);

  const handlePinSelect = useCallback((pin) => {
    const id = toIdString(pin?._id);
    setSelectedRoomId(id || null);
    const focus = extractPinLocation(pin);
    if (focus) {
      setMapCenterOverride(focus);
    }
  }, []);

  const handleFocusRoom = useCallback((room) => {
    const id = toIdString(room?._id);
    setSelectedRoomId(id || null);
    const focus = extractPinLocation(room);
    if (focus) {
      setMapCenterOverride(focus);
    }
  }, []);

  const activePreset = useMemo(
    () => TELEPORT_PRESETS.find((preset) => preset.key === activePresetKey) ?? null,
    [activePresetKey]
  );

  const activeRadiusSource = selectedRoom ?? currentRoom;
  const userRadiusMeters = Number.isFinite(activeRadiusSource?.radiusMeters)
    ? activeRadiusSource.radiusMeters
    : undefined;

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Box>
            <Typography variant="h6">Chat room overview</Typography>
            <Typography variant="body2" color="text.secondary">
              Visualize chat room geofences alongside your spoofed location.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefreshRooms}
            disabled={isFetchingRooms}
          >
            {isFetchingRooms ? 'Refreshing...' : 'Refresh rooms'}
          </Button>
        </Stack>
        {roomsStatus && (
          <Alert severity={roomsStatus.type} onClose={() => setRoomsStatus(null)}>
            {roomsStatus.message}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="h6">GPS spoofer</Typography>
          <Typography variant="body2" color="text.secondary">
            Teleport your active debug account to quickly test chat room access.
          </Typography>
          {!currentUser && <Alert severity="warning">Sign in to spoof your location.</Alert>}
          {profileStatus && (
            <Alert severity={profileStatus.type} onClose={() => setProfileStatus(null)}>
              {profileStatus.message}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
            {TELEPORT_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant={preset.key === activePresetKey ? 'contained' : 'outlined'}
                onClick={() => handleTeleport(preset)}
                disabled={isTeleporting}
                sx={{ textTransform: 'none' }}
              >
                {preset.label}
              </Button>
            ))}
            {isTeleporting && <CircularProgress size={20} />}
          </Stack>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="subtitle2">Directional nudge</Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('north')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                North
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('west')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                West
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('east')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                East
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="center">
              <Button
                variant="contained"
                size="small"
                onClick={() => handleDirectionalSpoof('south')}
                disabled={isTeleporting}
                sx={{ minWidth: 96 }}
              >
                South
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" align="center">
              Each press moves the spoofed location by roughly 2 miles.
            </Typography>
          </Stack>
          {activePreset && (
            <Typography variant="caption" color="text.secondary">
              Active GPS preset: {activePreset.label} ({activePreset.latitude.toFixed(4)}, 
              {activePreset.longitude.toFixed(4)})
            </Typography>
          )}
          {teleportStatus && (
            <Alert severity={teleportStatus.type} onClose={() => setTeleportStatus(null)}>
              {teleportStatus.message}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={1}>
          <Typography variant="h6">Map view</Typography>
          <Typography variant="body2" color="text.secondary">
            Click a marker to focus a chat room and compare against your spoofed location.
          </Typography>
        </Stack>
        {movementStatus && (
          <Alert severity={movementStatus.type} onClose={() => setMovementStatus(null)}>
            {movementStatus.message}
          </Alert>
        )}
        {currentRoom ? (
          <Alert severity="info">
            Currently inside <strong>{currentRoom.name ?? 'Untitled chat room'}</strong>
            {currentRoomDistanceLabel ? ` — ${currentRoomDistanceLabel}` : ''}
          </Alert>
        ) : hasUserMovedRef.current ? (
          <Alert severity="warning">
            Not currently inside any geofenced chat room. Move closer to one of the markers to join it.
          </Alert>
        ) : null}
        <Box sx={{ height: 420, borderRadius: 2, overflow: 'hidden' }}>
          <LeafletMap
            userLocation={lastSpoofedLocation ?? undefined}
            userRadiusMeters={userRadiusMeters}
            centerOverride={mapCenterOverride ?? undefined}
            pins={mapPins}
            selectedPinId={selectedRoomId ?? undefined}
            onPinSelect={handlePinSelect}
          />
        </Box>
        {selectedRoom ? (
          <Stack spacing={0.5}>
            <Typography variant="subtitle1">{selectedRoom.name ?? 'Untitled chat room'}</Typography>
            {selectedRoom.description ? (
              <Typography variant="body2" color="text.secondary">
                {selectedRoom.description}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              Radius: {Number.isFinite(selectedRoom.radiusMeters) ? `${selectedRoom.radiusMeters} m` : 'Not set'}
              {selectedRoom.isGlobal ? ' (global room)' : ''}
            </Typography>
            {selectedRoomDistanceLabel && (
              <Typography variant="body2" color="text.secondary">
                Distance from spoofed location: {selectedRoomDistanceLabel}
              </Typography>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a chat room marker or card to see details.
          </Typography>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="h6">Chat rooms</Typography>
        {rooms.length ? (
          <Stack spacing={1}>
            {rooms.map((room, index) => {
              const id = toIdString(room?._id);
              const key = id || `${index}-${room?.name ?? 'room'}`;
              const isSelected = id && id === selectedRoomId;
              const isCurrent = id && id === currentRoomId;
              const location = extractPinLocation(room);
              return (
                <Paper
                  key={key}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderColor: isCurrent ? 'success.main' : isSelected ? 'primary.main' : 'divider',
                    borderWidth: isCurrent || isSelected ? 2 : 1,
                    backgroundColor: isCurrent ? 'success.light' : undefined
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle1">{room?.name ?? 'Untitled chat room'}</Typography>
                        {isCurrent && <Chip label="Current" color="success" size="small" />}
                        {isSelected && !isCurrent && <Chip label="Focused" color="primary" size="small" />}
                        {room?.isGlobal && <Chip label="Global" color="default" size="small" />}
                      </Stack>
                      {room?.description ? (
                        <Typography variant="body2" color="text.secondary">
                          {room.description}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No description provided.
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {location
                          ? `Center: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                          : 'Missing coordinates'}
                        {Number.isFinite(room?.radiusMeters) ? ` | Radius: ${room.radiusMeters} m` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {!isSelected && (
                        <Button size="small" onClick={() => handleFocusRoom(room)}>
                          Focus on map
                        </Button>
                      )}
                      {isSelected && (
                        <Chip label={isCurrent ? 'Current focus' : 'Focused'} color={isCurrent ? 'success' : 'primary'} size="small" />
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {isFetchingRooms ? 'Loading chat rooms...' : 'Chat rooms will appear here once loaded.'}
          </Typography>
        )}
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





