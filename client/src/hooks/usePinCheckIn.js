import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPinCheckIns, updatePinCheckIn } from '../api/mongoDataApi';

const EMPTY_STATE = {
  pinId: null,
  checkedInUserIds: [],
  checkedInCount: 0,
  attendingCount: 0,
  remainingUserIds: [],
  viewerCheckedIn: false,
  windowOpen: false,
  windowOpensAt: null,
  startDate: null
};

export default function usePinCheckIn({ pinId, isOffline, viewerIsAttending }) {
  const [data, setData] = useState(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!pinId) {
      setData(EMPTY_STATE);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = await getPinCheckIns(pinId);
      setData(payload);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [pinId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCheckIn = useCallback(
    async (nextCheckedIn) => {
      if (!pinId || isOffline) {
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const payload = await updatePinCheckIn(pinId, { checkedIn: nextCheckedIn });
        setData(payload);
      } catch (err) {
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [isOffline, pinId]
  );

  const computed = useMemo(() => {
    const canCheckIn = Boolean(data.windowOpen) && (viewerIsAttending !== false);
    const ready = Boolean(data.pinId || pinId);
    return {
      ...data,
      canCheckIn,
      ready
    };
  }, [data, pinId, viewerIsAttending]);

  return {
    data: computed,
    isLoading,
    error,
    refresh: load,
    toggleCheckIn
  };
}
