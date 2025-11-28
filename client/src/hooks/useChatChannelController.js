import { useCallback, useState } from 'react';
import normalizeObjectId from '../utils/normalizeObjectId';

export default function useChatChannelController({
  channelTab,
  setChannelTab,
  setChannelDialogTab,
  lastConversationTab,
  directMessagesHasAccess,
  selectDirectThread,
  handleSelectRoom,
  refreshDmThreads
}) {
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);

  const handleSelectDirectThreadId = useCallback(
    (threadId) => {
      selectDirectThread(threadId);
      handleSelectRoom(null);
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);
    },
    [handleSelectRoom, selectDirectThread, setChannelDialogTab, setChannelTab]
  );

  const handleActivateFriendsView = useCallback(() => {
    if (channelTab === 'friends') {
      let targetTab = lastConversationTab;
      if (targetTab === 'direct' && directMessagesHasAccess === false) {
        targetTab = 'rooms';
      }
      setChannelTab(targetTab);
      setChannelDialogTab(
        targetTab === 'direct' && directMessagesHasAccess !== false ? 'direct' : 'rooms'
      );
      setIsChannelDialogOpen(false);
      return;
    }
    setChannelTab('friends');
    setChannelDialogTab('friends');
    setIsChannelDialogOpen(false);
  }, [channelTab, directMessagesHasAccess, lastConversationTab, setChannelDialogTab, setChannelTab]);

  const handleOpenChannelDialog = useCallback(() => {
    if (channelTab === 'direct') {
      setChannelDialogTab(directMessagesHasAccess !== false ? 'direct' : 'rooms');
    } else if (channelTab === 'friends') {
      setChannelDialogTab('friends');
    } else {
      setChannelDialogTab('rooms');
    }
    setIsChannelDialogOpen(true);
  }, [channelTab, directMessagesHasAccess, setChannelDialogTab]);

  const handleChannelDialogTabChange = useCallback(
    (event, value) => {
      if (value === 'direct' && directMessagesHasAccess === false) {
        return;
      }
      setChannelDialogTab(value);
    },
    [directMessagesHasAccess, setChannelDialogTab]
  );

  const handleSelectDirectFromProfile = useCallback(
    async ({ targetUserId, displayName, findDirectThreadForUser, createDirectThread }) => {
      const normalizedTargetId = normalizeObjectId(targetUserId);
      if (!normalizedTargetId) {
        return null;
      }
      setChannelTab('direct');
      setChannelDialogTab('direct');
      setIsChannelDialogOpen(false);

      const existingThread = findDirectThreadForUser(normalizedTargetId);
      if (existingThread?.id) {
        handleSelectDirectThreadId(existingThread.id);
        return existingThread.id;
      }

      try {
        const result = await createDirectThread({
          participantIds: [normalizedTargetId]
        });
        let newThreadId = result?.thread?.id || '';
        if (!newThreadId) {
          const refreshed = await refreshDmThreads().catch(() => null);
          if (refreshed?.threads) {
            const fallback = refreshed.threads.find((thread) => {
              const participants = Array.isArray(thread.participants) ? thread.participants : [];
              return participants.some(
                (participant) => normalizeObjectId(participant?.id || participant?._id || participant) === normalizedTargetId
              );
            });
            if (fallback?.id) {
              newThreadId = fallback.id;
            }
          }
        }
        if (newThreadId) {
          handleSelectDirectThreadId(newThreadId);
        }
        return newThreadId;
      } catch {
        return null;
      }
    },
    [handleSelectDirectThreadId, refreshDmThreads, setChannelDialogTab, setChannelTab]
  );

  return {
    isChannelDialogOpen,
    setIsChannelDialogOpen,
    handleSelectDirectThreadId,
    handleActivateFriendsView,
    handleOpenChannelDialog,
    handleChannelDialogTabChange,
    handleSelectDirectFromProfile
  };
}
