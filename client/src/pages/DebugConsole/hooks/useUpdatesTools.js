import { useCallback, useEffect, useState } from 'react';

import {
  createUpdate,
  fetchCurrentUserProfile,
  fetchUpdates
} from '../../../api';
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

const createObjectId = () => {
  const length = 12;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Array.from({ length }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
};

const ensureObjectId = (value) => {
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
    return value;
  }
  return createObjectId();
};

const normalizeRelatedEntities = (input) => {
  if (!Array.isArray(input)) {
    return undefined;
  }
  return input.map((entity) => {
    if (!entity || typeof entity !== 'object') {
      return entity;
    }
    const rawId = entity.id ?? entity._id ?? entity?.id?.$oid ?? entity?.id?.toString?.();
    const normalizedId =
      typeof rawId === 'string' && rawId.trim()
        ? rawId.trim()
        : typeof rawId === 'object' && rawId !== null && typeof rawId.$oid === 'string'
        ? rawId.$oid
        : entity.id != null
        ? String(entity.id)
        : ensureObjectId();
    return {
      ...entity,
      id: normalizedId
    };
  });
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
  const [dummyStatus, setDummyStatus] = useState(null);

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

        const relatedEntities = normalizeRelatedEntities(
          parseJsonField(updateForm.relatedEntities, 'related entities')
        );
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

  const runDummyUpdate = useCallback(
    async ({ payload, successMessage }) => {
      setDummyStatus(null);
      if (!currentUserId) {
        setDummyStatus({ type: 'error', message: 'Load your profile first.' });
        return;
      }

      try {
        setIsSendingDummy(true);
        const normalizedPayload = {
          ...payload,
          relatedEntities:
            payload && Array.isArray(payload.relatedEntities)
              ? normalizeRelatedEntities(payload.relatedEntities)
              : payload?.relatedEntities
        };
        await createUpdate({
          userId: currentUserId,
          payload: normalizedPayload
        });

        const limitValue = parseOptionalNumber(updatesQuery.limit, 'Limit');
        await refreshUpdates(currentUserId, limitValue);

        setDummyStatus({
          type: 'success',
          message: successMessage || 'Dummy update queued for your account.'
        });
      } catch (error) {
        setDummyStatus({
          type: 'error',
          message: error?.message || 'Failed to send dummy update.'
        });
      } finally {
        setIsSendingDummy(false);
      }
    },
    [currentUserId, refreshUpdates, updatesQuery.limit]
  );

  const sendDummyBadgeUpdate = useCallback(() => {
    const now = new Date();
    const title = 'Debug badge unlocked';
    const body = `You earned a tester badge at ${now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })}.`;
    const badgeId = '656565656565656565656565';
    return runDummyUpdate({
      payload: {
        type: 'badge-earned',
        title,
        body,
        metadata: {
          badgeId,
          badgeLabel: 'Debugger',
          issuedAt: now.toISOString()
        },
        relatedEntities: [{ id: currentUserId, type: 'user', label: 'You' }]
      },
      successMessage: 'Badge update queued for your account.'
    });
  }, [currentUserId, runDummyUpdate]);

  const sendDummyEventUpdate = useCallback(() => {
    const now = new Date();
    const title = 'Event reminder: Debug Expo';
    const body = `Debug Expo starts in 30 minutes (${now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })}).`;
    const eventId = createObjectId();
    return runDummyUpdate({
      payload: {
        type: 'event-reminder',
        title,
        body,
        metadata: {
          startsAt: now.toISOString(),
          proximityMeters: 500
        },
        relatedEntities: [
          { id: eventId, type: 'pin', label: 'Debug Expo' },
          { id: currentUserId, type: 'user', label: 'You' }
        ]
      },
      successMessage: 'Event update queued for your account.'
    });
  }, [currentUserId, runDummyUpdate]);

  const sendDummyDiscussionUpdate = useCallback(() => {
    const now = new Date();
    const title = 'New reply in Debug Support';
    const body = `A teammate replied to your thread at ${now.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })}.`;
    const threadId = ensureObjectId();
    const replyId = ensureObjectId();
    return runDummyUpdate({
      payload: {
        type: 'chat-message',
        title,
        body,
        metadata: {
          threadId,
          replyId,
          replySnippet: 'Appreciate the quick fix!'
        },
        relatedEntities: [
          { id: threadId, type: 'chat-room', label: 'Debug Support' },
          { id: currentUserId, type: 'user', label: 'You' }
        ]
      },
      successMessage: 'Discussion update queued for your account.'
    });
  }, [currentUserId, runDummyUpdate]);

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
    sendDummyBadgeUpdate,
    sendDummyEventUpdate,
    sendDummyDiscussionUpdate,
    reloadCurrentProfile,
    isSendingDummy,
    dummyStatus,
    setDummyStatus
  };
};

export { INITIAL_UPDATE_FORM };
export default useUpdatesTools;
