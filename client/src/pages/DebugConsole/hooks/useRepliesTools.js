import { useCallback, useState } from 'react';

import { createReply, fetchReplies } from '../../../api';
import { parseCommaSeparated } from '../utils';

const INITIAL_REPLY_FORM = {
  pinId: '',
  authorId: '',
  message: '',
  parentReplyId: '',
  mentionedUserIds: ''
};

const useRepliesTools = () => {
  const [replyForm, setReplyForm] = useState(INITIAL_REPLY_FORM);
  const [replyStatus, setReplyStatus] = useState(null);
  const [replyResult, setReplyResult] = useState(null);
  const [isCreatingReply, setIsCreatingReply] = useState(false);

  const [repliesPinId, setRepliesPinId] = useState('');
  const [repliesStatus, setRepliesStatus] = useState(null);
  const [repliesResult, setRepliesResult] = useState(null);
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);

  const handleCreateReply = useCallback(
    async (event) => {
      event.preventDefault();
      setReplyStatus(null);

      try {
        const pinId = replyForm.pinId.trim();
        const authorId = replyForm.authorId.trim();
        const message = replyForm.message.trim();
        if (!pinId || !authorId || !message) {
          throw new Error('Pin ID, author ID, and message are required.');
        }

        const payload = {
          pinId,
          authorId,
          message
        };

        const parentReplyId = replyForm.parentReplyId.trim();
        if (parentReplyId) {
          payload.parentReplyId = parentReplyId;
        }

        const mentionedUserIds = parseCommaSeparated(replyForm.mentionedUserIds);
        if (mentionedUserIds.length) {
          payload.mentionedUserIds = mentionedUserIds;
        }

        setIsCreatingReply(true);
        const result = await createReply(payload);
        setReplyResult(result);
        setReplyStatus({ type: 'success', message: 'Reply created.' });
      } catch (error) {
        setReplyStatus({ type: 'error', message: error.message || 'Failed to create reply.' });
      } finally {
        setIsCreatingReply(false);
      }
    },
    [replyForm]
  );

  const handleFetchReplies = useCallback(
    async (event) => {
      event.preventDefault();
      setRepliesStatus(null);
      const pinId = repliesPinId.trim();
      if (!pinId) {
        setRepliesStatus({ type: 'error', message: 'Pin ID is required.' });
        return;
      }

      try {
        setIsFetchingReplies(true);
        const replies = await fetchReplies(pinId);
        setRepliesResult(replies);
        setRepliesStatus({
          type: 'success',
          message: `Loaded ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}.`
        });
      } catch (error) {
        setRepliesStatus({ type: 'error', message: error.message || 'Failed to load replies.' });
      } finally {
        setIsFetchingReplies(false);
      }
    },
    [repliesPinId]
  );

  const resetReplyForm = useCallback(() => {
    setReplyForm(INITIAL_REPLY_FORM);
    setReplyStatus(null);
    setReplyResult(null);
  }, []);

  return {
    replyForm,
    setReplyForm,
    replyStatus,
    setReplyStatus,
    replyResult,
    isCreatingReply,
    handleCreateReply,
    resetReplyForm,
    repliesPinId,
    setRepliesPinId,
    repliesStatus,
    setRepliesStatus,
    repliesResult,
    isFetchingReplies,
    handleFetchReplies
  };
};

export default useRepliesTools;
