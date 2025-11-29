import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { previewChatGif } from '../../api';

const getGifCommandQuery = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith('/gif')) {
    return null;
  }
  const query = trimmed.slice(4).trim();
  return query.length ? query : null;
};

export default function useChatGifPreview({ authUser, messageDraft, setMessageDraft }) {
  const [gifPreview, setGifPreview] = useState(null);
  const [isGifPreviewLoading, setIsGifPreviewLoading] = useState(false);
  const [gifPreviewError, setGifPreviewError] = useState(null);
  const gifPreviewRequestRef = useRef(null);

  const requestGifPreview = useCallback(
    async (query) => {
      if (!authUser) {
        return;
      }
      const trimmedQuery = typeof query === 'string' ? query.trim() : '';
      if (!trimmedQuery) {
        return;
      }

      const requestId = Symbol('gif-preview');
      gifPreviewRequestRef.current = requestId;
      setGifPreview({ query: trimmedQuery, options: [], selectedIndex: null });
      setIsGifPreviewLoading(true);
      setGifPreviewError(null);

      try {
        const payload = await previewChatGif(trimmedQuery, { limit: 12 });
        if (gifPreviewRequestRef.current !== requestId) {
          return;
        }
        const options = Array.isArray(payload?.results) ? payload.results : [];
        if (!options.length) {
          setGifPreview({ query: trimmedQuery, options: [], selectedIndex: null });
          setGifPreviewError(`No GIFs found for "${trimmedQuery}". Try another search.`);
          return;
        }
        setGifPreview({ query: trimmedQuery, options, selectedIndex: 0 });
      } catch (error) {
        if (gifPreviewRequestRef.current !== requestId) {
          return;
        }
        setGifPreviewError(error?.message || 'Failed to load GIF preview.');
      } finally {
        if (gifPreviewRequestRef.current === requestId) {
          setIsGifPreviewLoading(false);
        }
      }
    },
    [authUser]
  );

  useEffect(() => {
    const gifQuery = getGifCommandQuery(messageDraft);
    if (!gifQuery) {
      if (gifPreview || gifPreviewError || isGifPreviewLoading) {
        gifPreviewRequestRef.current = null;
        setGifPreview(null);
        setGifPreviewError(null);
        setIsGifPreviewLoading(false);
      }
      return;
    }

    if (gifPreview && gifPreview.query !== gifQuery && !isGifPreviewLoading) {
      gifPreviewRequestRef.current = null;
      setGifPreview(null);
      setGifPreviewError(null);
    }
  }, [gifPreview, gifPreviewError, isGifPreviewLoading, messageDraft]);

  const handleGifPreviewConfirm = useCallback(() => {
    if (
      isGifPreviewLoading ||
      !gifPreview ||
      typeof gifPreview.selectedIndex !== 'number'
    ) {
      return;
    }
    const options = Array.isArray(gifPreview.options) ? gifPreview.options : [];
    const selected = options[gifPreview.selectedIndex];
    if (!selected?.attachment) {
      return;
    }
    setMessageDraft((prev) => prev.replace(/\/gif[^\n]*/i, '').trim());
    return selected.attachment;
  }, [gifPreview, isGifPreviewLoading, setMessageDraft]);

  const handleGifPreviewCancel = useCallback(() => {
    gifPreviewRequestRef.current = null;
    setGifPreview(null);
    setGifPreviewError(null);
    setIsGifPreviewLoading(false);
  }, []);

  const handleGifPreviewShuffle = useCallback(() => {
    setGifPreview((prev) => {
      if (!prev || !Array.isArray(prev.options) || prev.options.length === 0) {
        return prev;
      }
      const nextIndex = typeof prev.selectedIndex === 'number'
        ? (prev.selectedIndex + 1) % prev.options.length
        : 0;
      return {
        ...prev,
        selectedIndex: nextIndex
      };
    });
  }, []);

  const selectedGifOption = useMemo(() => {
    if (
      !gifPreview ||
      !Array.isArray(gifPreview.options) ||
      typeof gifPreview.selectedIndex !== 'number'
    ) {
      return null;
    }
    return gifPreview.options[gifPreview.selectedIndex] ?? null;
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
    requestGifPreview,
    handleGifPreviewConfirm,
    handleGifPreviewCancel,
    handleGifPreviewShuffle,
    composerGifPreview,
    getGifCommandQuery
  };
}
