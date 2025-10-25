import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';

import runtimeConfig from '../../config/runtime';

export const pageConfig = {
  id: 'debug-console',
  label: 'DEBUG_CONSOLE',
  icon: AddLocationAltIcon,
  path: '/debug-console',
  order: 2,
  protected: true,
  showInNav: true
};

export const EXPERIMENT_SCREENS = [];
export const EXPERIMENT_TAB_ID = 'troy-experiment';
export const EXPERIMENT_TITLE = "Troy's Dumb Experiment";
export const LIVE_CHAT_TAB_ID = 'live-chat';
export const ACCOUNT_SWAP_TAB_ID = 'account-swap';
export const CHAT_VIS_TAB_ID = 'chat-visualization';
export const STORAGE_TAB_ID = 'storage';

export const DEFAULT_AVATAR_PATH = '/images/profile/profile-01.jpg';
export const DEFAULT_BANNER_PATH = '/images/background/background-01.jpg';
export const BAD_USERS_FALLBACK_AVATAR = DEFAULT_AVATAR_PATH;

export const INITIAL_COORDINATES = {
  latitude: '33.7838',
  longitude: '-118.1136'
};

export const DEFAULT_LOCATION_COORDINATES = {
  latitude: Number.parseFloat(INITIAL_COORDINATES.latitude) || 33.7838,
  longitude: Number.parseFloat(INITIAL_COORDINATES.longitude) || -118.1136
};

export const DEFAULT_LOCATION_ACCURACY = 10;
export const DEFAULT_LOCATION_TELEPORT_KEY = 'default-location';

export const LOCATION_SOURCE_OPTIONS = ['web', 'ios', 'android', 'background'];

export const ACCOUNT_STATUS_OPTIONS = ['active', 'inactive', 'suspended', 'deleted'];

export const UPDATE_TYPE_OPTIONS = [
  'new-pin',
  'badge-earned',
  'location-update',
  'admin-note',
  'badge-revoked',
  'moderation-warning'
];

export const METERS_PER_MILE = 1609.34;

export const LIVE_CHAT_ROOM_PRESETS = [
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

export const TELEPORT_PRESETS = [
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

export const SPOOF_STEP_METERS = 3218; // ~2 miles
export const DIRECTION_SUCCESS_MESSAGES = {
  north: 'Moved north by roughly 2 miles.',
  south: 'Moved south by roughly 2 miles.',
  east: 'Moved east by roughly 2 miles.',
  west: 'Moved west by roughly 2 miles.'
};

export const JSON_PREVIEW_SX = {
  mt: 2,
  backgroundColor: 'grey.900',
  p: 2,
  borderRadius: 2,
  overflowX: 'auto'
};

export const EXPERIMENT_ENABLED =
  runtimeConfig.troyExperimentEnabled && EXPERIMENT_SCREENS.length > 0;
