/* NOTE: Context exports helper utilities alongside the provider. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import runtimeConfig from '../config/runtime';

const LocationContext = createContext(null);

const STORAGE_KEY = 'pinpoint:lastLocation';

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const coordsAreEqual = (a, b) => {
  if (!a || !b) {
    return false;
  }

  const latEqual = Math.abs(a.latitude - b.latitude) < 1e-9;
  const lonEqual = Math.abs(a.longitude - b.longitude) < 1e-9;
  const accuracyEqual =
    (a.accuracy === undefined && b.accuracy === undefined) ||
    Math.abs((a.accuracy ?? 0) - (b.accuracy ?? 0)) < 1e-6;

  return latEqual && lonEqual && accuracyEqual;
};

const sanitizeLocation = (input = {}, { source } = {}) => {
  if (!input) {
    return null;
  }

  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return null;
  }

  const payload = {
    latitude,
    longitude
  };

  if (input.accuracy !== undefined && input.accuracy !== null && isFiniteNumber(input.accuracy)) {
    payload.accuracy = Number(input.accuracy);
  }

  if (input.altitudeMeters !== undefined && isFiniteNumber(input.altitudeMeters)) {
    payload.altitudeMeters = Number(input.altitudeMeters);
  }

  if (input.headingDegrees !== undefined && isFiniteNumber(input.headingDegrees)) {
    payload.headingDegrees = Number(input.headingDegrees);
  }

  if (input.speedMetersPerSecond !== undefined && isFiniteNumber(input.speedMetersPerSecond)) {
    payload.speedMetersPerSecond = Number(input.speedMetersPerSecond);
  }

  const resolvedSource =
    source || input.source || (typeof window !== 'undefined' ? 'client-runtime' : 'server');

  payload.source = resolvedSource;
  if (typeof input.updatedAt === 'string' && input.updatedAt.trim()) {
    payload.updatedAt = input.updatedAt.trim();
  }

  return payload;
};

const resolveOfflineFallbackLocation = () => {
  if (!runtimeConfig.isOffline) {
    return null;
  }

  const fallback = sanitizeLocation(
    {
      latitude: import.meta.env.VITE_OFFLINE_FALLBACK_LATITUDE ?? 33.7838,
      longitude: import.meta.env.VITE_OFFLINE_FALLBACK_LONGITUDE ?? -118.1136
    },
    { source: 'offline-fallback' }
  );

  if (!fallback) {
    return null;
  }

  return {
    ...fallback,
    source: 'offline-fallback',
    updatedAt: new Date().toISOString()
  };
};

const OFFLINE_FALLBACK_LOCATION = resolveOfflineFallbackLocation();

export function LocationProvider({ children }) {
  const [location, setLocationState] = useState(() => {
    const fallbackLocation = OFFLINE_FALLBACK_LOCATION;

    if (typeof window === 'undefined') {
      return fallbackLocation;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return fallbackLocation;
      }
      const parsed = JSON.parse(raw);
      const sanitized = sanitizeLocation(parsed, { source: parsed?.source || 'storage' });
      if (!sanitized) {
        return fallbackLocation;
      }

      if (typeof parsed?.updatedAt === 'string' && parsed.updatedAt.trim()) {
        return { ...sanitized, updatedAt: parsed.updatedAt };
      }
      return { ...sanitized, updatedAt: new Date().toISOString() };
    } catch {
      return fallbackLocation;
    }
  });

  const setLocation = useCallback((nextLocation, options = {}) => {
    const sanitized = sanitizeLocation(nextLocation, options);
    let appliedValue = sanitized;

    setLocationState((previous) => {
      if (!sanitized && !previous) {
        appliedValue = null;
        return previous;
      }

      if (!sanitized) {
        appliedValue = null;
        return null;
      }

      if (previous && coordsAreEqual(previous, sanitized)) {
        appliedValue = previous;
        return previous;
      }

      const result = {
        ...sanitized,
        source: options.source || nextLocation?.source || sanitized.source || 'client-runtime',
        updatedAt: new Date().toISOString()
      };

      appliedValue = result;
      return result;
    });

    if (typeof window !== 'undefined') {
      try {
        if (appliedValue) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appliedValue));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // ignore storage failures
      }
    }
    return appliedValue;
  }, []);

  const clearLocation = useCallback(() => {
    setLocationState(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore storage failures
      }
    }
  }, []);

  useEffect(() => {
    // keep storage in sync if state changes through other means (e.g., dev tools)
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (location) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage failures
    }
  }, [location]);

  const value = useMemo(
    () => ({
      location,
      setLocation,
      clearLocation
    }),
    [location, setLocation, clearLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
