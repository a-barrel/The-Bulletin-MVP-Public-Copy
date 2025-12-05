import { useEffect, useRef } from 'react';
import { isAnyTeleportLocked } from '../utils/mapTeleportSession';

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0
};

/**
 * Request a one-time geolocation refresh when enabled.
 * Intended for page-mount auto refreshes; does not retry automatically.
 */
export default function useAutoRefreshGeolocation({
  enabled,
  setSharedLocation,
  source = 'auto-geolocation-refresh',
  onError
}) {
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled || requestedRef.current) {
      return;
    }
    if (isAnyTeleportLocked()) {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      requestedRef.current = true;
      if (onError) {
        onError('Geolocation is unavailable in this browser.');
      }
      return;
    }

    requestedRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSharedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source
        });
        if (onError) {
          onError(null);
        }
      },
      (error) => {
        if (onError) {
          onError(error?.message || 'Failed to refresh your location.');
        }
      },
      GEOLOCATION_OPTIONS
    );
  }, [enabled, onError, setSharedLocation, source]);
}
