import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchLocationHistory } from '../../../api/mongoDataApi';
import { useLocationContext } from '../../../contexts/LocationContext';
import { DEFAULT_LOCATION_COORDINATES } from '../constants';
import { coordinatesEqual, mongooseObjectIdLike } from '../utils';
import reportClientError from '../../../utils/reportClientError';

function useViewerLocation({
  currentProfileId,
  selectedRoomKeyRef,
  ensurePresetRoomsRef,
  setLocationStatus
}) {
  const { location: sharedLocation, setLocation: setSharedLocation } = useLocationContext();
  const defaultLocation = useMemo(
    () => ({
      latitude: DEFAULT_LOCATION_COORDINATES.latitude,
      longitude: DEFAULT_LOCATION_COORDINATES.longitude
    }),
    []
  );
  const [location, setLocationState] = useState(() => sharedLocation ?? defaultLocation);

  useEffect(() => {
    if (!sharedLocation) {
      setLocationState((previous) =>
        coordinatesEqual(previous, defaultLocation) ? previous : defaultLocation
      );
      return;
    }
    setLocationState((previous) =>
      coordinatesEqual(previous, sharedLocation) ? previous : sharedLocation
    );
  }, [sharedLocation, defaultLocation]);

  const applyLocation = useCallback(
    (nextLocation) => {
      const applied = setSharedLocation(nextLocation, { source: 'debug-console' });
      const effectiveLocation = applied ?? defaultLocation;
      setLocationState((previous) =>
        coordinatesEqual(previous, effectiveLocation) ? previous : effectiveLocation
      );
      return applied ?? null;
    },
    [setSharedLocation, defaultLocation]
  );

  const refresh = useCallback(async () => {
    if (!currentProfileId || !mongooseObjectIdLike(currentProfileId)) {
      return;
    }

    try {
      const history = await fetchLocationHistory(currentProfileId);
      const latest = Array.isArray(history) && history.length > 0 ? history[0] : null;
      const coords = latest?.coordinates?.coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const [longitude, latitude] = coords;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const nextLocation = {
            latitude,
            longitude,
            accuracy: latest?.coordinates?.accuracy ?? latest?.accuracy
          };

          applyLocation(nextLocation);
          if (ensurePresetRoomsRef?.current && selectedRoomKeyRef) {
            ensurePresetRoomsRef.current(selectedRoomKeyRef.current);
          }
        }
      }
    } catch (error) {
      reportClientError(error, 'Failed to refresh viewer location:', {
        source: 'useViewerLocation.refresh',
        currentProfileId
      });
      setLocationStatus?.((prev) =>
        prev ?? { type: 'error', message: 'Failed to refresh viewer location.' }
      );
    }
  }, [currentProfileId, selectedRoomKeyRef, ensurePresetRoomsRef, setLocationStatus, applyLocation]);

  return { location, setLocation: applyLocation, refresh };
}

export default useViewerLocation;
