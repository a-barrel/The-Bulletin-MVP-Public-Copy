import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import '../../styles/leaflet.css';
import { createAvatarMarkerIcon, DEFAULT_MAP_CENTER } from '../../utils/mapMarkers';
import RecenterControl from '../map/RecenterControl';

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      if (!onSelect) {
        return;
      }
      const { lat, lng } = event.latlng;
      onSelect({ lat, lng });
    }
  });
  return null;
}

function MapCenterUpdater({ position }) {
  const map = useMap();
  useMemo(() => {
    if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
      map.setView([position.lat, position.lng]);
    }
  }, [map, position]);
  return null;
}

function SelectableLocationMap({ value, onChange, anchor, avatarUrl, viewerName }) {
  const center = value ?? anchor ?? DEFAULT_MAP_CENTER;
  const trackingPosition = value ?? anchor ?? null;
  const userLatLng =
    anchor && Number.isFinite(anchor.lat) && Number.isFinite(anchor.lng)
      ? [anchor.lat, anchor.lng]
      : null;
  const draftLatLng =
    value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
      ? [value.lat, value.lng]
      : null;
  const userMarkerIcon = useMemo(
    () => createAvatarMarkerIcon(avatarUrl, viewerName),
    [avatarUrl, viewerName]
  );

  return (
    <MapContainer center={[center.lat, center.lng]} zoom={14} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onSelect={onChange} />
      <MapCenterUpdater position={trackingPosition} />
      {userLatLng ? (
        <>
          <Marker position={userLatLng} icon={userMarkerIcon} />
          {draftLatLng ? (
            <Polyline
              positions={[userLatLng, draftLatLng]}
              pathOptions={{ color: '#5d3889', weight: 2, dashArray: '6 8', opacity: 0.85 }}
            />
          ) : null}
        </>
      ) : null}
      {draftLatLng ? <Marker position={draftLatLng} /> : null}
      <RecenterControl
        onRecenter={(mapInstance) => {
          if (trackingPosition && Number.isFinite(trackingPosition.lat) && Number.isFinite(trackingPosition.lng)) {
            mapInstance.setView([trackingPosition.lat, trackingPosition.lng], mapInstance.getZoom(), { animate: true });
          } else if (DEFAULT_MAP_CENTER) {
            mapInstance.setView([DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng], mapInstance.getZoom(), { animate: true });
          }
        }}
      />
    </MapContainer>
  );
}

export default SelectableLocationMap;
