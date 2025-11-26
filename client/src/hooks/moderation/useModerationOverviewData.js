import { useCallback, useEffect } from 'react';
import { fetchModerationOverview } from '../../api/mongoDataApi';
import reportClientError from '../../utils/reportClientError';

export default function useModerationOverviewData({ dispatch, autoLoad = true }) {
  const loadOverview = useCallback(async () => {
    dispatch({ type: 'overview/pending' });
    try {
      const payload = await fetchModerationOverview();
      dispatch({ type: 'overview/success', payload });
      return payload;
    } catch (error) {
      if (error?.status === 403) {
        dispatch({
          type: 'overview/error',
          error: 'Moderator privileges required.',
          status: 403
        });
        return null;
      }
      dispatch({
        type: 'overview/error',
        error:
          error?.status === 403
            ? 'Moderator privileges required.'
            : error?.message || 'Failed to load moderation overview.',
        status: error?.status ?? null
      });
      reportClientError(error, 'Failed to load moderation overview.', {
        hook: 'useModerationTools',
        step: 'loadOverview'
      });
      throw error;
    }
  }, [dispatch]);

  useEffect(() => {
    if (autoLoad) {
      loadOverview().catch(() => {});
    }
  }, [autoLoad, loadOverview]);

  return { loadOverview };
}
