import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import LeafletMap from '../../components/Map';

function MapSection({
  coordinates,
  mapPins,
  pinId,
  creatorAvatarUrl,
  creatorDisplayName,
  coordinateLabel,
  coverImageUrl
}) {
  const stablePins = useMemo(() => (Array.isArray(mapPins) ? mapPins : []), [mapPins]);
  const stableCoords = useMemo(() => coordinates, [coordinates]);

  if (coordinates) {
    return (
      <div className="map-section">
        <div className="map-wrapper">
          <LeafletMap
            userLocation={stableCoords}
            pins={stablePins}
            selectedPinId={stablePins[0]?._id ?? pinId}
            centerOverride={stableCoords}
            hostPinId={pinId}
            currentUserAvatar={creatorAvatarUrl}
            currentUserDisplayName={creatorDisplayName}
            showRecenterControl
            scrollWheelZoom={false}
          />
          {coordinateLabel ? <span className="coordinate-label">Coords: {coordinateLabel}</span> : null}
        </div>
      </div>
    );
  }

  if (coverImageUrl) {
    return (
      <div className="map-section">
        <img src={coverImageUrl} alt="Pin cover" className="cover-photo" />
      </div>
    );
  }

  return (
    <div className="map-section">
      <div className="map-placeholder muted">No location data available for this pin.</div>
    </div>
  );
}

MapSection.propTypes = {
  coordinates: PropTypes.array,
  mapPins: PropTypes.array,
  pinId: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  creatorAvatarUrl: PropTypes.string,
  creatorDisplayName: PropTypes.string,
  coordinateLabel: PropTypes.string,
  coverImageUrl: PropTypes.string
};

MapSection.defaultProps = {
  coordinates: null,
  mapPins: [],
  pinId: null,
  creatorAvatarUrl: undefined,
  creatorDisplayName: undefined,
  coordinateLabel: undefined,
  coverImageUrl: undefined
};

export default memo(MapSection);
