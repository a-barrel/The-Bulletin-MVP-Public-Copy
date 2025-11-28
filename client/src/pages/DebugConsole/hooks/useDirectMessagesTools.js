import { useCallback, useState } from 'react';

import useDirectMessages from '../../../hooks/useDirectMessages';
import { fetchUsers } from '../../../api';
import { parseCommaSeparated } from '../utils';
import { useUserCache } from '../../../contexts/UserCacheContext';

const INITIAL_THREAD_FORM = {
  participantInput: '',
  participantIds: [],
  topic: '',
  initialMessage: ''
};

const useDirectMessagesTools = () => {
  const userCache = useUserCache();
  const {
    viewer,
    threads,
    refreshThreads,
    isLoadingThreads,
    threadsStatus,
    hasAccess,
    selectedThreadId,
    selectThread,
    threadDetail,
    isLoadingThread,
    threadStatus,
    loadThreadDetail,
    isSending,
    sendStatus,
    sendMessage,
    isCreating,
    createStatus,
    createThread,
    resetSendStatus,
    resetCreateStatus
  } = useDirectMessages();

  const [composerText, setComposerText] = useState('');
  const [newThreadForm, setNewThreadForm] = useState(INITIAL_THREAD_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState(null);

  const updateComposer = useCallback((value) => {
    setComposerText(value);
  }, []);

  const sendMessageWithComposer = useCallback(
    async (overrides = {}) => {
      const payload = {
        body: overrides.body ?? composerText,
        attachments: overrides.attachments ?? [],
        sender: viewer
      };
      const threadId = overrides.threadId ?? selectedThreadId;
      const response = await sendMessage({
        threadId,
        body: payload.body,
        attachments: payload.attachments,
        sender: payload.sender
      });
      if (response) {
        setComposerText('');
      }
      return response;
    },
    [composerText, sendMessage, selectedThreadId, viewer]
  );

  const updateNewThreadForm = useCallback((field, value) => {
    setNewThreadForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const addParticipantId = useCallback((participantId) => {
    if (!participantId) {
      return;
    }
    setNewThreadForm((prev) => {
      if (prev.participantIds.includes(participantId)) {
        return prev;
      }
      return {
        ...prev,
        participantIds: [...prev.participantIds, participantId]
      };
    });
  }, []);

  const removeParticipantId = useCallback((participantId) => {
    setNewThreadForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.filter((id) => id !== participantId)
    }));
  }, []);

  const commitParticipantInput = useCallback(() => {
    const parsed = parseCommaSeparated(newThreadForm.participantInput);
    if (!parsed.length) {
      return;
    }
    setNewThreadForm((prev) => ({
      ...prev,
      participantIds: Array.from(new Set([...prev.participantIds, ...parsed])),
      participantInput: ''
    }));
  }, [newThreadForm.participantInput]);

  const createThreadWithForm = useCallback(
    async (overrides = {}) => {
      const payload = {
        ...newThreadForm,
        ...overrides
      };
      const participantIds = Array.from(new Set(payload.participantIds));
      return createThread({
        participantIds,
        topic: payload.topic,
        initialMessage: payload.initialMessage
      });
    },
    [newThreadForm, createThread]
  );

  const handleSearch = useCallback(
    async (term = searchTerm) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setSearchResults([]);
        setSearchStatus(null);
        return;
      }

      setIsSearching(true);
      setSearchStatus(null);
      try {
        const results = await fetchUsers({ search: trimmed, limit: 15 });
        const normalized = Array.isArray(results) ? results : [];
        setSearchResults(normalized);
        userCache.setUsers(normalized);
      } catch (error) {
        setSearchStatus({
          type: 'error',
          message: error?.message || 'Failed to search users.'
        });
      } finally {
        setIsSearching(false);
      }
    },
    [searchTerm]
  );

  return {
    threads,
    threadsStatus,
    isLoadingThreads,
    refreshThreads,
    selectedThreadId,
    selectThread,
    threadDetail,
    isLoadingThread,
    threadStatus,
    loadThreadDetail,
    composerText,
    updateComposer,
    sendMessage: sendMessageWithComposer,
    composerStatus: sendStatus,
    isSendingMessage: isSending,
    newThreadForm,
    updateNewThreadForm,
    addParticipantId,
    removeParticipantId,
    commitParticipantInput,
    createThread: createThreadWithForm,
    newThreadStatus: createStatus,
    isCreatingThread: isCreating,
    searchTerm,
    setSearchTerm,
    handleSearch,
    searchResults,
    isSearching,
    searchStatus,
    setComposerStatus: resetSendStatus,
    setNewThreadStatus: resetCreateStatus,
    hasAccess
  };
};

export default useDirectMessagesTools;
