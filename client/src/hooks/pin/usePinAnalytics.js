import { useEffect, useRef, useState } from 'react';
import { fetchPinAnalytics } from '../../api';
import { resolveAnalyticsErrorMessage } from '../../utils/pinAnalytics';

export default function usePinAnalytics({ pinId, pin, showAnalytics, isHostLike, isOffline }) {
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsInFlightRef = useRef(false);
  const suppressedAnalyticsRef = useRef(new Set());

  useEffect(() => {
    if (!showAnalytics || !pinId || !isHostLike || !pin?._id) {
      setAnalytics(null);
      setAnalyticsError(null);
      setAnalyticsLoading(false);
      return;
    }
    if (analyticsInFlightRef.current) {
      return;
    }
    if (suppressedAnalyticsRef.current.has(pinId)) {
      setAnalyticsError('Analytics unavailable for this pin.');
      setAnalyticsLoading(false);
      return;
    }
    if (isOffline) {
      setAnalyticsError('Reconnect to view attendance analytics.');
      setAnalyticsLoading(false);
      return;
    }
    let ignore = false;
    analyticsInFlightRef.current = true;
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    fetchPinAnalytics(pinId, { enabled: isHostLike, suppressLogStatuses: [401, 403] })
      .then((payload) => {
        if (!ignore) {
          setAnalytics(payload);
        }
      })
      .catch((fetchError) => {
        if (ignore) return;
        const status = fetchError?.status;
        const isAuthFailure = status === 401 || status === 403;
        if (isAuthFailure) {
          suppressedAnalyticsRef.current.add(pinId);
          setAnalyticsError('Analytics unavailable for this pin.');
        } else {
          setAnalyticsError(resolveAnalyticsErrorMessage(fetchError));
        }
        setAnalytics(null);
      })
      .finally(() => {
        if (!ignore) {
          setAnalyticsLoading(false);
        }
        analyticsInFlightRef.current = false;
      });

    return () => {
      ignore = true;
      analyticsInFlightRef.current = false;
      setAnalyticsLoading(false);
    };
  }, [showAnalytics, pinId, pin, isOffline, isHostLike]);

  return {
    analytics,
    analyticsError,
    analyticsLoading
  };
}
