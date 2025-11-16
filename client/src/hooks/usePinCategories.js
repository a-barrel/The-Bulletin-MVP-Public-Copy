import { useCallback, useState } from 'react';
import { fetchPinCategories } from '../api/mongoDataApi';

export default function usePinCategories({ isOffline } = {}) {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (isOffline) {
      setError('Reconnect to refresh categories.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchPinCategories();
      setCategories(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || 'Failed to load categories.');
    } finally {
      setIsLoading(false);
    }
  }, [isOffline]);

  return {
    categories,
    isLoading,
    error,
    refresh
  };
}
