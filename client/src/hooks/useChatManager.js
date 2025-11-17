import { useCallback, useEffect } from 'react';
import useChatRoomsData from './chat/useChatRoomsData';
import useChatRealtime from './chat/useChatRealtime';
import useChatGifPreview from './chat/useChatGifPreview';

export function useChatManager({
  authUser,
  authLoading,
  viewerLatitude,
  viewerLongitude,
  isOffline,
  refreshUnreadCount,
  announceBadgeEarned
}) {
  const {
    debugMode,
    setDebugMode,
    rooms,
    roomsError,
    isLoadingRooms,
    loadRooms,
    selectedRoomId,
    setSelectedRoomId,
    handleSelectRoom,
    isCreateDialogOpen,
    handleOpenCreateDialog,
    handleCloseCreateDialog,
    handleCreateRoom,
    isCreatingRoom,
    createForm,
    setCreateForm,
    createError,
    locationParams
  } = useChatRoomsData({
    authUser,
    authLoading,
    isOffline,
    viewerLatitude,
    viewerLongitude
  });

  const {
    messages,
    messagesError,
    uniqueMessages,
    presenceError,
    activeUserCount,
    isLoadingMessages,
    messageDraft,
    setMessageDraft,
    sendMessage,
    isSendingMessage,
    handleRefreshCurrentRoom
  } = useChatRealtime({
    authUser,
    isOffline,
    selectedRoomId,
    locationParams,
    announceBadgeEarned
  });

  const {
    gifPreview,
    gifPreviewError,
    isGifPreviewLoading,
    requestGifPreview,
    handleGifPreviewConfirm,
    handleGifPreviewCancel,
    handleGifPreviewShuffle,
    composerGifPreview,
    getGifCommandQuery
  } = useChatGifPreview({ authUser, messageDraft, setMessageDraft });

  useEffect(() => {
    if (typeof refreshUnreadCount === 'function' && !isOffline) {
      refreshUnreadCount({ silent: true });
    }
  }, [isOffline, refreshUnreadCount]);

  const handleSendMessage = useCallback(
    async (event, options = {}) => {
      event?.preventDefault();
      if (!selectedRoomId || !authUser || isSendingMessage) {
        return false;
      }

      const trimmed = messageDraft.trim();
      const attachments = Array.isArray(options.attachments) ? options.attachments : [];
      const hasMessage = trimmed.length > 0;
      const hasAttachments = attachments.length > 0;

      if (!hasMessage && !hasAttachments) {
        return false;
      }

      const pendingGifQuery = getGifCommandQuery(messageDraft);
      if (pendingGifQuery && !gifPreview) {
        requestGifPreview(pendingGifQuery);
        return false;
      }

      const messageToSend = hasMessage ? messageDraft : options.messageOverride || 'Attachment';
      return sendMessage({ message: messageToSend, attachments });
    },
    [authUser, getGifCommandQuery, gifPreview, isSendingMessage, messageDraft, requestGifPreview, selectedRoomId, sendMessage]
  );

  const handleMessageInputKeyDown = useCallback(
    (event, options) => {
      if (!event) {
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const result = handleSendMessage(event, options);
        if (result?.then) {
          result.catch(() => {});
        }
        return result;
      }
      return null;
    },
    [handleSendMessage]
  );

  const handleGifConfirm = useCallback(() => {
    const attachment = handleGifPreviewConfirm();
    if (!attachment) {
      return;
    }
    return sendMessage({ message: `GIF: ${gifPreview?.query || 'GIF'}`, attachments: [attachment] });
  }, [gifPreview?.query, handleGifPreviewConfirm, sendMessage]);

  return {
    debugMode,
    setDebugMode,
    authUser,
    rooms,
    roomsError,
    isLoadingRooms,
    loadRooms,
    selectedRoomId,
    selectedRoom: rooms.find((room) => room._id === selectedRoomId) ?? null,
    handleSelectRoom,
    messages,
    uniqueMessages,
    messagesError,
    isLoadingMessages,
    handleRefreshCurrentRoom,
    presenceError,
    activeUserCount,
    messageDraft,
    setMessageDraft,
    handleSendMessage,
    handleMessageInputKeyDown,
    isSendingMessage,
    gifPreview,
    gifPreviewError,
    isGifPreviewLoading,
    handleGifPreviewConfirm: handleGifConfirm,
    handleGifPreviewCancel,
    handleGifPreviewShuffle,
    composerGifPreview,
    handleOpenCreateDialog,
    handleCloseCreateDialog,
    handleCreateRoom,
    isCreateDialogOpen,
    createForm,
    setCreateForm,
    isCreatingRoom,
    createError
  };
}

export default useChatManager;
