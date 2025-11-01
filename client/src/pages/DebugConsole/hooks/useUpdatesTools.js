import { useCallback, useEffect, useState } from 'react';

import {
  createUpdate,
  fetchCurrentUserProfile,
  fetchUpdates
} from '../../../api/mongoDataApi';
import { UPDATE_TYPE_OPTIONS } from '../constants';
import {
  parseCommaSeparated,
  parseJsonField,
  parseOptionalNumber
} from '../utils';

const INITIAL_UPDATE_FORM = {
  userId: '',
  sourceUserId: '',
  targetUserIds: '',
  type: UPDATE_TYPE_OPTIONS[0],
  title: '',
  body: '',
  metadata: '',
  relatedEntities: '',
  pinId: '',
  pinPreview: ''
};

const useUpdatesTools = () => {
  const [updateForm, setUpdateForm] = useState(INITIAL_UPDATE_FORM);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateResult, setUpdateResult] = useState(null);
  const [isCreatingUpdate, setIsCreatingUpdate] = useState(false);

  const [updatesQuery, setUpdatesQuery] = useState({ userId: '', limit: '20' });
  const [updatesStatus, setUpdatesStatus] = useState(null);
  const [updatesResult, setUpdatesResult] = useState(null);
  const [isFetchingUpdates, setIsFetchingUpdates] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isSendingDummy, setIsSendingDummy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (cancelled) {
          return;
        }
        const resolved = profile?._id || profile?.userId || profile?.id;
        if (resolved) {
          setCurrentUserId(resolved);
          setUpdatesQuery((prev) => ({ ...prev, userId: prev.userId || resolved }));
        }
      } catch (error) {
        console.warn('Failed to auto-load current profile for updates tab', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUpdates = useCallback(
    async (userId, limitValue) => {
      try {
        const query = { userId };
        if (limitValue && limitValue > 0) {
          query.limit = limitValue;
        }
        const refreshed = await fetchUpdates(query);
        setUpdatesResult(refreshed);
      } catch (error) {
        console.warn('Failed to refresh updates', error);
      }
    },
    []
  );

  const handleCreateUpdate = useCallback(
    async (event) => {
      event.preventDefault();
      setUpdateStatus(null);

      try {
        const userId = updateForm.userId.trim();
        const title = updateForm.title.trim();
        if (!userId || !title) {
          throw new Error('Target user ID and title are required.');
        }

        const payload = {
          userId,
          payload: {
            type: updateForm.type,
            title
          }
        };

        const sourceUserId = updateForm.sourceUserId.trim();
        if (sourceUserId) {
          payload.sourceUserId = sourceUserId;
        }

        const targetUserIds = parseCommaSeparated(updateForm.targetUserIds);
        if (targetUserIds.length) {
          payload.targetUserIds = targetUserIds;
        }

        const body = updateForm.body.trim();
        if (body) {
          payload.payload.body = body;
        }

        const metadata = parseJsonField(updateForm.metadata, 'metadata');
        if (metadata !== undefined) {
          payload.payload.metadata = metadata;
        }

        const relatedEntities = parseJsonField(updateForm.relatedEntities, 'related entities');
        if (relatedEntities !== undefined) {
          payload.payload.relatedEntities = relatedEntities;
        }

        const pinId = updateForm.pinId.trim();
        if (pinId) {
          payload.payload.pinId = pinId;
        }

        const pinPreview = parseJsonField(updateForm.pinPreview, 'pin preview');
        if (pinPreview !== undefined) {
          payload.payload.pinPreview = pinPreview;
        }

        setIsCreatingUpdate(true);
        const result = await createUpdate(payload);
        setUpdateResult(result);
        setUpdateStatus({ type: 'success', message: 'Update created.' });
      } catch (error) {
        setUpdateStatus({ type: 'error', message: error.message || 'Failed to create update.' });
      } finally {
        setIsCreatingUpdate(false);
      }
    },
    [updateForm]
  );

  const handleFetchUpdates = useCallback(
    async (event) => {
      event.preventDefault();
      setUpdatesStatus(null);

      const userId = updatesQuery.userId.trim();
      if (!userId) {
        setUpdatesStatus({ type: 'error', message: 'User ID is required.' });
        return;
      }

      try {
        const query = { userId };
        const limitValue = parseOptionalNumber(updatesQuery.limit, 'Limit');
        if (limitValue !== undefined) {
          if (limitValue <= 0) {
            throw new Error('Limit must be greater than 0.');
          }
          query.limit = limitValue;
        }

        setIsFetchingUpdates(true);
        const updates = await fetchUpdates(query);
        setUpdatesResult(updates);
        setUpdatesStatus({
          type: 'success',
          message: `Loaded ${updates.length} update${updates.length === 1 ? '' : 's'}.`
        });
      } catch (error) {
        setUpdatesStatus({ type: 'error', message: error.message || 'Failed to load updates.' });
      } finally {
        setIsFetchingUpdates(false);
      }
    },
    [updatesQuery]
  );

  const sendDummyUpdate = useCallback(async () => {
    setUpdatesStatus(null);
    if (!currentUserId) {
      setUpdatesStatus({ type: 'error', message: 'Load your profile first.' });
      return;
    }

    try {
      setIsSendingDummy(true);
      const now = new Date();
      const title = 'Debug badge unlocked';
      const body = `You earned a tester badge at ${now.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      })}.`;
      await createUpdate({
        userId: currentUserId,
        payload: {
          type: 'badge-earned',
          title,
          body,
          metadata: {
            badgeId: 'debug-dummy',
            badgeLabel: 'Debugger',
            issuedAt: now.toISOString()
          },
          relatedEntities: [{ id: currentUserId, type: 'user', label: 'You' }]
        }
      });

      const limitValue = parseOptionalNumber(updatesQuery.limit, 'Limit');
      await refreshUpdates(currentUserId, limitValue);

      setUpdatesStatus({ type: 'success', message: 'Dummy update queued for your account.' });
    } catch (error) {
      setUpdatesStatus({
        type: 'error',
        message: error?.message || 'Failed to send dummy update.'
      });
    } finally {
      setIsSendingDummy(false);
    }
  }, [currentUserId, refreshUpdates, updatesQuery.limit]);

  const reloadCurrentProfile = useCallback(async () => {
    try {
      const profile = await fetchCurrentUserProfile();
      const resolved = profile?._id || profile?.userId || profile?.id;
      if (resolved) {
        setCurrentUserId(resolved);
        setUpdatesQuery((prev) => ({ ...prev, userId: resolved }));
      } else {
        setUpdatesStatus({ type: 'error', message: 'Current profile id is unavailable.' });
      }
    } catch (error) {
      setUpdatesStatus({
        type: 'error',
        message: error?.message || 'Failed to load current user profile.'
      });
    }
  }, []);

  return {
    updateForm,
    setUpdateForm,
    updateStatus,
    setUpdateStatus,
    updateResult,
    isCreatingUpdate,
    handleCreateUpdate,
    updatesQuery,
    setUpdatesQuery,
    updatesStatus,
    setUpdatesStatus,
    updatesResult,
    isFetchingUpdates,
    handleFetchUpdates,
    currentUserId,
    sendDummyUpdate,
    reloadCurrentProfile,
    isSendingDummy
  };
};

export { INITIAL_UPDATE_FORM };
export default useUpdatesTools;
