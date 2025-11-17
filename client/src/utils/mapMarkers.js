import L from 'leaflet';

const MARKER_BASE_URL =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x';
export const MAP_MARKER_SHADOW_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

export const MAP_MARKER_ICON_URLS = {
  default: `${MARKER_BASE_URL}-green.png`,
  discussion: `${MARKER_BASE_URL}-blue.png`,
  event: `${MARKER_BASE_URL}-violet.png`,
  personal: `${MARKER_BASE_URL}-orange.png`,
  nearby: `${MARKER_BASE_URL}-red.png`
};

export const MAP_FILTERS = [
  { key: 'event', label: 'Events', iconUrl: MAP_MARKER_ICON_URLS.event, ariaLabel: 'Toggle event pins' },
  {
    key: 'discussion',
    label: 'Discussions',
    iconUrl: MAP_MARKER_ICON_URLS.discussion,
    ariaLabel: 'Toggle discussion pins'
  },
  {
    key: 'personal',
    label: 'Personal pins',
    iconUrl: MAP_MARKER_ICON_URLS.personal,
    ariaLabel: 'Toggle your pins'
  }
];

export const DEFAULT_MAP_CENTER = { lat: 33.7838, lng: -118.1136 };

export const calculateInitials = (value) => {
  if (!value || typeof value !== 'string') {
    return 'YOU';
  }
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) {
    return 'YOU';
  }
  return parts
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
    .slice(0, 3);
};

export const createAvatarMarkerIcon = (avatarUrl, viewerName) =>
  L.divIcon({
    className: 'create-pin-avatar-marker',
    html: `
      <div class="create-pin-avatar-marker__outer">
        <div class="create-pin-avatar-marker__ring"></div>
        <div class="create-pin-avatar-marker__avatar">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="" />` : `<span>${calculateInitials(viewerName)}</span>`}
        </div>
      </div>
    `,
    iconSize: [56, 56],
    iconAnchor: [28, 48],
    popupAnchor: [0, -32]
  });

export default MAP_MARKER_ICON_URLS;
