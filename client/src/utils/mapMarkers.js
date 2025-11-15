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

export default MAP_MARKER_ICON_URLS;
