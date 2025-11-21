import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';

import DebugPanel from '../components/DebugPanel';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [33.7838, -118.1136];
const HEAT_POINTS = [
  { lat: 33.7842, lng: -118.1135, weight: 0.95, label: 'CSULB Quad' },
  { lat: 33.7835, lng: -118.112, weight: 0.75, label: 'Library' },
  { lat: 33.7825, lng: -118.114, weight: 0.55, label: 'Student Center' },
  { lat: 33.7852, lng: -118.1155, weight: 0.65, label: 'Parking Deck' },
  { lat: 33.786, lng: -118.1115, weight: 0.35, label: 'North Lawn' },
  { lat: 33.782, lng: -118.116, weight: 0.25, label: 'South Field' }
];

// Make hotspots cover larger areas across campus.
const weightToRadius = (w) => 30 + w * 60;
const weightToColor = (w) => {
  // w ∈ [0,1] -> blue (cool) -> green -> yellow -> red (hot)
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const t = clamp(w, 0, 1);
  const r = t < 0.5 ? Math.floor(0 + 2 * t * 255) : 255; // ramp up to red
  const g = t < 0.5 ? Math.floor(2 * t * 255) : Math.floor(255 - (t - 0.5) * 2 * 155); // peak at mid
  const b = t < 0.33 ? Math.floor(255 - t * 3 * 155) : Math.floor(100 - (t - 0.33) * 1.5 * 100); // fade blue
  const alpha = 0.35 + t * 0.5;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
};

function PopularLocationsTab() {
  const heatMarkers = useMemo(
    () =>
      HEAT_POINTS.map((point, index) => ({
        key: `${point.lat}-${point.lng}-${index}`,
        position: [point.lat, point.lng],
        radius: weightToRadius(point.weight),
        color: weightToColor(point.weight),
        label: point.label
      })),
    []
  );

  return (
    <DebugPanel
      title="Popular Locations"
      description="Heatmap-style overlay highlighting hotspots from recent pin activity."
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          This view is read-only and uses sample hotspots. Wire it to real analytics by swapping the
          HEAT_POINTS array with live data.
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {heatMarkers.map((marker) => (
            <Chip key={marker.key} label={marker.label} size="small" color="warning" />
          ))}
        </Stack>

        <Box sx={{ width: '100%', height: 420, borderRadius: 2, overflow: 'hidden' }}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={15}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {heatMarkers.map((marker) => (
              <CircleMarker
                key={marker.key}
                center={marker.position}
                radius={marker.radius}
                pathOptions={{
                  color: 'rgba(255, 99, 71, 0.35)',
                  fillColor: marker.color,
                  fillOpacity: 0.65,
                  weight: 0
                }}
              />
            ))}
          </MapContainer>
        </Box>
      </Stack>
    </DebugPanel>
  );
}

export default PopularLocationsTab;
