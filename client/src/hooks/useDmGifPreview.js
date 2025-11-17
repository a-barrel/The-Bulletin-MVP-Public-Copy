import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewChatGif } from '../api/mongoDataApi';
import { getGifCommandQuery } from '../utils/chatGifCommands';

export default function useDmGifPreview({
  authUser,
  messageDraft,
  setMessageDraft,
  selectedThreadId,
  sendDirectMessage,
  resetAttachments,
  setAttachmentStatus,
  focusComposerInput
}) {
  const requestRef = useRef(null);
  const [gifPreview, setGifPreview] = useState(null);
  const [gifPreviewError, setGifPreviewError] = useState(null);
  const [isGifPreviewLoading, setIsGifPreviewLoading] = useState(false);

  const cancelGifPreview = useCallback(() => {
    requestRef.current = null;
    setGifPreview(null);
    setGifPreviewError(null);
    setIsGifPreviewLoading(false);
  }, []);

  useEffect(() => {
    const gifQuery = getGifCommandQuery(messageDraft);
    if (!gifQuery) {
      if (gifPreview || gifPreviewError || isGifPreviewLoading) {
        cancelGifPreview();
      }
      return;
    }

    if (gifPreview && gifPreview.query !== gifQuery && !isGifPreviewLoading) {
      requestRef.current = null;
      setGifPreview(null);
      setGifPreviewError(null);
    }
  }, [cancelGifPreview, gifPreview, gifPreviewError, isGifPreviewLoading, messageDraft]);

  useEffect(() => {
    cancelGifPreview();
  }, [cancelGifPreview, selectedThreadId]);

  const handleRequestPreview = useCallback(
    async (rawQuery) => {
      if (!authUser) {
        return;
      }
      const trimmed = typeof rawQuery === 'string' ? rawQuery.trim() : '';
      if (!trimmed) {
        return;
      }
      const requestId = Symbol('dm-gif-preview');
      requestRef.current = requestId;
      setGifPreview({ query: trimmed, options: [], selectedIndex: null });
      setIsGifPreviewLoading(true);
      setGifPreviewError(null);

      try {
        const payload = await previewChatGif(trimmed, { limit: 12 });
        if (requestRef.current !== requestId) {
          return;
        }
        const options = Array.isArray(payload?.results) ? payload.results : [];
        if (!options.length) {
          setGifPreview({ query: trimmed, options: [], selectedIndex: null });
          setGifPreviewError(`No GIFs found for "${trimmed}". Try another search.`);
          return;
        }
        setGifPreview({ query: trimmed, options, selectedIndex: 0 });
      } catch (error) {
        if (requestRef.current !== requestId) {
          return;
        }
        setGifPreviewError(error?.message || 'Failed to load GIF preview.');
      } finally {
        if (requestRef.current === requestId) {
          setIsGifPreviewLoading(false);
        }
      }
    },
    [authUser]
  );

  const ensureGifPreviewForMessage = useCallback(
    (draft) => {
      const query = getGifCommandQuery(draft);
      if (!query) {
        return false;
      }
      if (!gifPreview) {
        setGifPreviewError(null);
        handleRequestPreview(query);
        return true;
      }
      return false;
    },
    [gifPreview, handleRequestPreview]
  );

  const shuffleGifPreview = useCallback(() => {
    if (isGifPreviewLoading) {
      return;
    }
    if (!gifPreview) {
      const query = getGifCommandQuery(messageDraft);
      if (query) {
        setGifPreviewError(null);
        handleRequestPreview(query);
      }
      return;
    }
    setGifPreviewError(null);
    const options = Array.isArray(gifPreview.options) ? gifPreview.options : [];
    if (options.length > 1) {
      setGifPreview((prev) => {
        if (!prev) {
          return prev;
        }
        const opts = Array.isArray(prev.options) ? prev.options : [];
        if (opts.length < 2) {
          return prev;
        }
        const nextIndex =
          typeof prev.selectedIndex === 'number' ? (prev.selectedIndex + 1) % opts.length : 0;
        return { ...prev, selectedIndex: nextIndex };
      });
    } else if (gifPreview.query) {
      handleRequestPreview(gifPreview.query);
    }
  }, [gifPreview, handleRequestPreview, isGifPreviewLoading, messageDraft]);

  const confirmGifPreview = useCallback(async () => {
    if (
      isGifPreviewLoading ||
      !gifPreview ||
      typeof gifPreview.selectedIndex !== 'number'
    ) {
      return false;
    }
    const options = Array.isArray(gifPreview.options) ? gifPreview.options : [];
    const selected = options[gifPreview.selectedIndex];
    if (!selected?.attachment || !selectedThreadId) {
      return false;
    }
    try {
      await sendDirectMessage({
        threadId: selectedThreadId,
        body: `GIF: ${gifPreview.query}`,
        attachments: [selected.attachment]
      });
      setMessageDraft('');
      resetAttachments();
      setAttachmentStatus?.(null);
      cancelGifPreview();
      if (typeof focusComposerInput === 'function') {
        focusComposerInput();
      }
      return true;
    } catch {
      return false;
    }
  }, [
    cancelGifPreview,
    focusComposerInput,
    gifPreview,
    isGifPreviewLoading,
    resetAttachments,
    selectedThreadId,
    sendDirectMessage,
    setAttachmentStatus,
    setMessageDraft
  ]);

  const selectedGifOption = useMemo(() => {
    if (!gifPreview || typeof gifPreview.selectedIndex !== 'number') {
      return null;
    }
    return gifPreview.options?.[gifPreview.selectedIndex] ?? null;
  }, [gifPreview]);

  const composerGifPreview = useMemo(
    () =>
      gifPreview
        ? {
            query: gifPreview.query,
            attachment: selectedGifOption?.attachment || null,
            sourceUrl: selectedGifOption?.sourceUrl,
            optionsCount: Array.isArray(gifPreview.options) ? gifPreview.options.length : 0
          }
        : null,
    [gifPreview, selectedGifOption]
  );

  return {
    gifPreview,
    gifPreviewError,
    isGifPreviewLoading,
    composerGifPreview,
    ensureGifPreviewForMessage,
    confirmGifPreview,
    cancelGifPreview,
    shuffleGifPreview,
    setGifPreviewError
  };
}
