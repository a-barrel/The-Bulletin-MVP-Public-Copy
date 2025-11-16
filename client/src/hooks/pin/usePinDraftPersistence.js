import { useCallback, useEffect, useRef, useState } from 'react';
import reportClientError from '../../utils/reportClientError';

const DRAFT_STORAGE_KEY = 'pinpoint:createPinDraft';
const AUTOSAVE_DELAY_MS = 1500;

export default function usePinDraftPersistence({
  pinType,
  setPinType,
  autoDelete,
  setAutoDelete,
  formState,
  setFormState,
  photoAssets,
  coverPhotoId,
  hydrateMedia
}) {
  const [draftStatus, setDraftStatus] = useState(null);
  const draftInitializedRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const autosaveTimeoutRef = useRef(null);

  const writeDraft = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const draftPayload = {
      version: 1,
      pinType,
      autoDelete,
      formState,
      photoAssets,
      coverPhotoId,
      timestamp: Date.now()
    };

    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftPayload));
      return true;
    } catch (error) {
      reportClientError(error, 'Failed to save pin draft', {
        source: 'usePinDraftPersistence.saveDraft'
      });
      return false;
    }
  }, [autoDelete, coverPhotoId, formState, photoAssets, pinType]);

  const clearDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (error) {
        console.warn('Failed to clear saved pin draft', error);
      }
    }
    skipNextAutosaveRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      draftInitializedRef.current = true;
      skipNextAutosaveRef.current = true;
      return;
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.pinType === 'event' || data.pinType === 'discussion') {
          setPinType(data.pinType);
        }
        if (typeof data.autoDelete === 'boolean') {
          setAutoDelete(data.autoDelete);
        }
        if (data.formState && typeof data.formState === 'object') {
          setFormState((prev) => ({
            ...prev,
            ...data.formState
          }));
        }
        if (Array.isArray(data.photoAssets)) {
          hydrateMedia(data.photoAssets, data.coverPhotoId);
        }
        setDraftStatus({
          type: 'info',
          message: 'Draft restored from your last session.'
        });
      }
    } catch (error) {
      console.warn('Failed to load saved pin draft', error);
    } finally {
      draftInitializedRef.current = true;
      skipNextAutosaveRef.current = true;
    }
  }, [hydrateMedia, setAutoDelete, setFormState, setPinType]);

  useEffect(() => {
    if (!draftInitializedRef.current) {
      return;
    }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      const success = writeDraft();
      if (success) {
        setDraftStatus({
          type: 'info',
          message: `Draft saved at ${new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit'
          })}.`
        });
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimeoutRef.current) {
        window.clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [autoDelete, coverPhotoId, formState, photoAssets, pinType, writeDraft]);

  useEffect(() => {
    if (!draftStatus || typeof window === 'undefined') {
      return;
    }
    const timeoutId = window.setTimeout(
      () => setDraftStatus(null),
      draftStatus.type === 'error' ? 8000 : 4000
    );
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftStatus]);

  const handleSaveDraft = useCallback(() => {
    const success = writeDraft();
    setDraftStatus({
      type: success ? 'success' : 'error',
      message: success ? 'Draft saved.' : 'Unable to save draft locally.'
    });
  }, [writeDraft]);

  const clearDraftStatus = useCallback(() => setDraftStatus(null), []);

  return {
    draftStatus,
    handleSaveDraft,
    clearDraft,
    clearDraftStatus,
    setDraftStatus
  };
}
