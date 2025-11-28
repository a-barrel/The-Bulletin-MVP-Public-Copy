import { useEffect, useState } from 'react';

import { fetchPinAttendees } from '../api/mongoDataApi';
import toIdString from '../utils/ids';
import { normalizeAttendeeRecord } from '../utils/feed';

const attendeeCache = new Map();
const attendeeFetchLocks = new Map();
const ATTENDEE_CACHE_TTL_MS = 60_000;

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
  attendeeSignature,
  cacheKey
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
    // Trace attendee fetch behavior to verify lazy loading on list feed.
    // Logs are intentionally verbose for performance investigation.
    // eslint-disable-next-line no-console
    console.log('[attendees] fetch start', {
      pinId: normalizedPinId,
      expectedCount: participantCount ?? null,
      signature: attendeeSignature || null
    });

    const expectedCount = Number.isFinite(participantCount) ? participantCount : null;
    const expectedSignature = attendeeSignature || null;

    const now = Date.now();
    const cachedEntry = attendeeCache.get(normalizedPinId);
    if (cachedEntry) {
      const isFresh = now - cachedEntry.updatedAt < ATTENDEE_CACHE_TTL_MS;
      setAttendees(Array.isArray(cachedEntry.items) ? cachedEntry.items : []);
      const matchesCount = expectedCount === null || cachedEntry.count === expectedCount;
      const matchesSignature =
        expectedSignature === null || cachedEntry.signature === expectedSignature;
      if (matchesCount && matchesSignature && isFresh) {
        setError(null);
        return;
      }
    }

    const lockKey = normalizedPinId;
    if (attendeeFetchLocks.get(lockKey)) {
      return;
    }
    attendeeFetchLocks.set(lockKey, true);

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

        if (!cancelled) {
          setAttendees(mapped);
          // eslint-disable-next-line no-console
          console.log('[attendees] fetch success', {
            pinId: normalizedPinId,
            count: mapped.length,
            signature
          });
          setError(null);
        }
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
        if (!cancelled) {
          setAttendees([]);
          setError(fetchError?.message || 'Failed to load attendees.');
          // eslint-disable-next-line no-console
          console.log('[attendees] fetch error', {
            pinId: normalizedPinId,
            error: fetchError?.message || 'unknown error'
          });
        }
      })
      .finally(() => {
        attendeeFetchLocks.delete(lockKey);
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pinId, enabled, participantCount, attendeeSignature, cacheKey]);

  return {
    attendees,
    isLoading,
    error,
    hasAttendees: attendees.length > 0
  };
}
