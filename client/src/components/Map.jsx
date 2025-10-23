import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const nearbyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const selectedPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map center updates
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

const formatDistanceMiles = (meters) => {
  if (typeof meters !== 'number' || Number.isNaN(meters)) {
    return null;
  }
  return (meters / 1609.34).toFixed(1);
};

const calculateDistanceMeters = (pointA, pointB) => {
  if (!Array.isArray(pointA) || !Array.isArray(pointB)) {
    return null;
  }

  const [lat1, lon1] = pointA;
  const [lat2, lon2] = pointB;

  if (![lat1, lon1, lat2, lon2].every((value) => Number.isFinite(value))) {
    return null;
  }

  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatExpiration = (pin) => {
  const expirationSource = pin?.expiresAt ?? pin?.endDate;
  const expiresAt = parseDate(expirationSource);
  if (!expiresAt) {
    return null;
  }

  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) {
    return 'Expired';
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0 && hours > 0) {
    return `Expires in ${days}d ${hours}h`;
  }

  if (days > 0) {
    return `Expires in ${days}d`;
  }

  if (hours > 0) {
    return `Expires in ${hours}h`;
  }

  return 'Expires in <1h';
};

const toLatLng = (location) => {
  if (!location) {
    return null;
  }
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return [latitude, longitude];
};

const Map = ({
  userLocation,
  nearbyUsers = [],
  pins = [],
  onPinSelect,
  selectedPinId,
  centerOverride,
  userRadiusMeters
}) => {
  const resolvedCenter = toLatLng(centerOverride) ?? toLatLng(userLocation) ?? [0, 0];
  const userMarkerPosition = toLatLng(userLocation);
  const resolvedPins = Array.isArray(pins) ? pins : [];

  return (
    <MapContainer
      center={resolvedCenter}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {userMarkerPosition && (
        <Marker
          position={userMarkerPosition}
          icon={userIcon}
        >
          <Popup>
            <h3>You are here</h3>
          </Popup>
        </Marker>
      )}
      {userMarkerPosition && Number.isFinite(userRadiusMeters) && userRadiusMeters > 0 && (
        <Circle
          center={userMarkerPosition}
          radius={userRadiusMeters}
          pathOptions={{ color: '#2196f3', fillColor: '#2196f3', fillOpacity: 0.15, weight: 1.5 }}
        />
      )}

      {nearbyUsers.map((user, index) => (
        <Marker
          key={index}
          position={[
            user.coordinates.coordinates[1],
            user.coordinates.coordinates[0]
          ]}
          icon={nearbyIcon}
        >
          <Popup>
            <h3>User {user.userId}</h3>
          </Popup>
        </Marker>
      ))}

      {resolvedPins.map((pin, index) => {
        const coordinates = pin?.coordinates?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) {
          return null;
        }

        const [longitude, latitude] = coordinates;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const markerIcon = pin._id && pin._id === selectedPinId ? selectedPinIcon : pinIcon;
        const providedDistance = typeof pin.distanceMeters === 'number' ? pin.distanceMeters : null;
        const computedDistance = providedDistance ?? calculateDistanceMeters(userMarkerPosition, [latitude, longitude]);
        const distanceLabel = formatDistanceMiles(computedDistance);
        const expirationLabel = formatExpiration(pin);

        return (
          <Marker
            key={pin._id ?? `pin-${index}-${latitude}-${longitude}`}
            position={[latitude, longitude]}
            icon={markerIcon}
            eventHandlers={
              onPinSelect
                ? {
                    click: () => onPinSelect(pin)
                  }
                : undefined
            }
          >
            <Popup>
              <div>
                <strong>{pin.title ?? 'Untitled pin'}</strong>
                {pin.type ? <div>Type: {pin.type}</div> : null}
                {pin._id ? <div>ID: {pin._id}</div> : null}
                {distanceLabel ? <div>Distance: {distanceLabel} mi</div> : null}
                {expirationLabel ? <div>{expirationLabel}</div> : null}
              </div>
            </Popup>
          </Marker>
        );
      })}

      <MapUpdater center={resolvedCenter} />
    </MapContainer>
  );
};

export default Map;
