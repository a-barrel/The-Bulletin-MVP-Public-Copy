import L from 'leaflet';

const MARKER_BASE_URL =
  'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x';
export const MAP_MARKER_SHADOW_URL =
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

const readThemeColor = (name, fallback) => {
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const value = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (value) return value;
  }
  return fallback;
};

const createPinIconUrl = (fill, stroke = readThemeColor('--accent-strong', 'var(--accent-strong)')) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><path d="M18 2c-5.523 0-10 4.477-10 10 0 6.852 8.275 16.782 9.242 17.868a1 1 0 0 0 1.516 0C19.7 28.782 28 18.852 28 12c0-5.523-4.477-10-10-10z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="18" cy="12" r="5" fill="rgba(255,255,255,0.55)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const createCircleIconUrl = (fill, stroke = readThemeColor('--accent-strong', 'var(--accent-strong)')) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="rgba(255,255,255,0.6)"/></svg>`;
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

const markerColors = {
  defaultFill: readThemeColor('--marker-default-fill', 'var(--color-success)'),
  defaultStroke: readThemeColor('--marker-default-stroke', 'var(--color-success)'),
  discussionFill: readThemeColor('--marker-discussion-fill', 'var(--accent-primary)'),
  discussionStroke: readThemeColor('--marker-discussion-stroke', 'var(--accent-strong)'),
  eventFill: readThemeColor('--marker-event-fill', 'var(--accent-primary)'),
  eventStroke: readThemeColor('--marker-event-stroke', 'var(--accent-strong)'),
  personalFill: readThemeColor('--marker-personal-fill', 'var(--accent-warn)'),
  personalStroke: readThemeColor('--marker-personal-stroke', 'var(--accent-warn)'),
  fullFill: readThemeColor('--marker-full-fill', 'var(--color-danger)'),
  friendFill: readThemeColor('--marker-friend-fill', 'var(--color-success)'),
  soonFill: readThemeColor('--marker-soon-fill', 'var(--accent-warn)'),
  soonStroke: readThemeColor('--marker-soon-stroke', 'var(--accent-warn)'),
  popularFill: readThemeColor('--marker-popular-fill', 'var(--accent-pink)'),
  popularStroke: readThemeColor('--marker-popular-stroke', 'var(--accent-strong)'),
  openFill: readThemeColor('--marker-open-fill', 'var(--accent-warn)'),
  openStroke: readThemeColor('--marker-open-stroke', 'var(--accent-warn)'),
  featuredFill: readThemeColor('--marker-featured-fill', 'var(--accent-primary)'),
  featuredStroke: readThemeColor('--marker-featured-stroke', 'var(--accent-strong)'),
  bookmarkedFill: readThemeColor('--marker-bookmarked-fill', 'var(--accent-strong)'),
  bookmarkedStroke: readThemeColor('--marker-bookmarked-stroke', 'var(--accent-strong)'),
  chatMineFill: readThemeColor('--marker-chat-mine-fill', 'var(--accent-primary)'),
  chatMineStroke: readThemeColor('--marker-chat-mine-stroke', 'var(--accent-strong)'),
  chatAdminFill: readThemeColor('--marker-chat-admin-fill', 'var(--accent-primary)'),
  chatAdminStroke: readThemeColor('--marker-chat-admin-stroke', 'var(--accent-strong)'),
  teleportFill: readThemeColor('--marker-teleport-fill', 'var(--color-text-strong)'),
  teleportStroke: readThemeColor('--marker-teleport-stroke', 'var(--color-surface)'),
  clusterFill: readThemeColor('--marker-cluster-fill', 'var(--accent-strong)'),
  clusterStroke: readThemeColor('--marker-cluster-stroke', 'var(--accent-strong)'),
  ringStrokeOff: readThemeColor('--marker-ring-stroke', 'var(--accent-primary)')
};

export const MAP_MARKER_ICON_URLS = {
  default: createPinIconUrl(markerColors.defaultFill, markerColors.defaultStroke),
  discussion: createPinIconUrl(markerColors.discussionFill, markerColors.discussionStroke),
  event: createPinIconUrl(markerColors.eventFill, markerColors.eventStroke),
  personal: createPinIconUrl(markerColors.personalFill, markerColors.personalStroke),
  nearby: `${MARKER_BASE_URL}-red.png`,
  full: createPinIconUrl(markerColors.fullFill, markerColors.fullFill),
  friend: createPinIconUrl(markerColors.friendFill, markerColors.friendFill),
  discussionSoon: createPinIconUrl(
    readThemeColor('--color-text-on-accent', 'var(--color-text-on-accent)'),
    markerColors.eventStroke
  ),
  eventSoon: createPinIconUrl(markerColors.soonFill, markerColors.soonStroke),
  popular: createPinIconUrl(markerColors.popularFill, markerColors.popularStroke),
  open: createPinIconUrl(markerColors.openFill, markerColors.openStroke),
  featured: createPinIconUrl(markerColors.featuredFill, markerColors.featuredStroke),
  bookmarked: createPinIconUrl(markerColors.bookmarkedFill, markerColors.bookmarkedStroke),
  chatMine: createPinIconUrl(markerColors.chatMineFill, markerColors.chatMineStroke),
  chatAdmin: createPinIconUrl(markerColors.chatAdminFill, markerColors.chatAdminStroke),
  teleport: createPinIconUrl(markerColors.teleportFill, markerColors.teleportStroke),
  clusterToggle: createCircleIconUrl(markerColors.clusterFill, markerColors.clusterStroke),
  interactionRadiusOff: createRingIconUrl({
    stroke: 'color-mix(in srgb, var(--accent-blue) 75%, transparent)',
    glow: 'color-mix(in srgb, var(--accent-blue) 35%, transparent)',
    glowOpacity: 0.4,
    glowWidth: 5,
    strokeWidth: 3
  }),
  interactionRadiusOn: createRingIconUrl({
    stroke: markerColors.ringStrokeOff,
    glow: 'color-mix(in srgb, var(--accent-blue) 65%, transparent)',
    glowOpacity: 0.85,
    glowWidth: 7,
    strokeWidth: 3.8
  })
};

export const MAP_FILTERS = [
  { key: 'event', label: 'Events', iconClassName: 'event', ariaLabel: 'Toggle event pins' },
  {
    key: 'discussion',
    label: 'Discussions',
    iconClassName: 'discussion',
    ariaLabel: 'Toggle discussion pins'
  },
  {
    key: 'personal',
    label: 'Personal pins',
    iconClassName: 'personal',
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
