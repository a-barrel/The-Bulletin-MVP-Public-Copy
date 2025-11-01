import { useEffect, useState } from 'react';

import { fetchPinAttendees } from '../api/mongoDataApi';
import toIdString from '../utils/ids';
import { normalizeAttendeeRecord } from '../utils/feed';

const attendeeCache = new Map();

export const clearPinAttendeesCache = () => attendeeCache.clear();

const resolveExpectedSignature = (attendeeIds, fallbackSignature) => {
  if (attendeeIds.length > 0) {
    return attendeeIds.join('|');
  }
  return fallbackSignature ?? null;
};

export default function usePinAttendees({
  pinId,
  enabled = true,
  participantCount,
  attendeeSignature
}) {
  const [attendees, setAttendees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const normalizedPinId = toIdString(pinId);
    if (!enabled || !normalizedPinId) {
      setAttendees([]);
      return;
    }

    const expectedCount = Number.isFinite(participantCount) ? participantCount : null;
    const expectedSignature = attendeeSignature || null;

    const cachedEntry = attendeeCache.get(normalizedPinId);
    if (cachedEntry) {
      setAttendees(Array.isArray(cachedEntry.items) ? cachedEntry.items : []);
      const matchesCount = expectedCount === null || cachedEntry.count === expectedCount;
      const matchesSignature =
        expectedSignature === null || cachedEntry.signature === expectedSignature;
      if (matchesCount && matchesSignature) {
        setError(null);
        return;
      }
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchPinAttendees(normalizedPinId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const normalizedIds = [];
        const mapped = Array.isArray(payload)
          ? payload.map((record, idx) => {
              const normalized = normalizeAttendeeRecord(record, idx);
              if (normalized.userId && !normalizedIds.includes(normalized.userId)) {
                normalizedIds.push(normalized.userId);
              }
              return normalized;
            })
          : [];

        const signature = resolveExpectedSignature(normalizedIds, expectedSignature);

        attendeeCache.set(normalizedPinId, {
          items: mapped,
          count: mapped.length,
          signature,
          updatedAt: Date.now()
        });

        setAttendees(mapped);
        setError(null);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        attendeeCache.set(normalizedPinId, {
          items: [],
          count: 0,
          signature: expectedSignature,
          updatedAt: Date.now()
        });
        setAttendees([]);
        setError(fetchError?.message || 'Failed to load attendees.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pinId, enabled, participantCount, attendeeSignature]);

  return {
    attendees,
    isLoading,
    error,
    hasAttendees: attendees.length > 0
  };
}
