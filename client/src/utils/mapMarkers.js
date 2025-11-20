import L from 'leaflet';

const MARKER_BASE_URL =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x';
export const MAP_MARKER_SHADOW_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

const createPinIconUrl = (fill, stroke = '#210A3C') => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2c-5.523 0-10 4.477-10 10 0 6.852 8.275 16.782 9.242 17.868a1 1 0 0 0 1.516 0C19.7 28.782 28 18.852 28 12c0-5.523-4.477-10-10-10z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="18" cy="12" r="5" fill="rgba(255,255,255,0.55)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const createRingIconUrl = ({
  stroke,
  strokeWidth = 3.5,
  glow = 'rgba(62, 184, 240, 0.28)',
  glowOpacity = 0.6,
  glowWidth = 6
}) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" fill="none" stroke="${glow}" stroke-width="${glowWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${glowOpacity}"/><circle cx="18" cy="18" r="11" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const MAP_MARKER_ICON_URLS = {
  default: createPinIconUrl('#6DD17C', '#0F6124'),
  discussion: createPinIconUrl('#4FABFF', '#123B66'),
  event: createPinIconUrl('#815CFF', '#2E1572'),
  personal: createPinIconUrl('#FF7A29', '#6A2A00'),
  nearby: `${MARKER_BASE_URL}-red.png`,
  full: createPinIconUrl('#EB134F'),
  friend: createPinIconUrl('#2EA043'),
  discussionSoon: createPinIconUrl('#FFFFFF', '#5D3889'),
  eventSoon: createPinIconUrl('#F4B400', '#70511C'),
  popular: createPinIconUrl('#FF6AD5', '#4C1D95'),
  open: createPinIconUrl('#FFB347', '#7A3F00'),
  featured: createPinIconUrl('#A855F7', '#4C1D95'),
  chatMine: createPinIconUrl('#3EB8F0', '#0F172A'),
  chatAdmin: createPinIconUrl('#FF7043', '#5D1512'),
  teleport: createPinIconUrl('#0F172A', '#F4F4F5'),
  interactionRadiusOff: createRingIconUrl({
    stroke: 'rgba(42, 154, 244, 0.45)',
    glow: 'rgba(42, 154, 244, 0.15)',
    glowOpacity: 0.4,
    glowWidth: 5,
    strokeWidth: 3
  }),
  interactionRadiusOn: createRingIconUrl({
    stroke: '#2A9AF4',
    glow: 'rgba(42, 154, 244, 0.55)',
    glowOpacity: 0.85,
    glowWidth: 7,
    strokeWidth: 3.8
  })
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
