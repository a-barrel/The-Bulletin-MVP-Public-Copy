import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchChatMessages,
  fetchChatPresence,
  createChatMessage,
  upsertChatPresence,
  updateChatMessageReaction
} from '../../api/mongoDataApi';
import { playBadgeSound } from '../../utils/badgeSound';
import { CHAT_REACTION_OPTIONS } from '../../constants/chatReactions';

const PRESENCE_HEARTBEAT_MS = 30_000;
const MESSAGES_REFRESH_MS = 7_000;
const ALLOWED_REACTION_KEYS = new Set(CHAT_REACTION_OPTIONS.map((option) => option.key));

const toggleReactionLocally = (message, emojiKey) => {
  if (!message) {
    return message;
  }
  const allowedReaction = emojiKey && ALLOWED_REACTION_KEYS.has(emojiKey) ? emojiKey : null;
  const existingReactions = Array.isArray(message?.reactions?.viewerReactions)
    ? message.reactions.viewerReactions
    : message?.reactions?.viewerReaction
      ? [message.reactions.viewerReaction]
      : [];
  const counts = { ...(message?.reactions?.counts || {}) };

  const nextSet = new Set(existingReactions);
  if (allowedReaction) {
    if (nextSet.has(allowedReaction)) {
      counts[allowedReaction] = Math.max(0, Number(counts[allowedReaction] || 0) - 1);
      nextSet.delete(allowedReaction);
    } else {
      counts[allowedReaction] = Math.max(0, Number(counts[allowedReaction] || 0)) + 1;
      nextSet.add(allowedReaction);
    }
  }

  const normalizedCounts = Object.fromEntries(
    Object.entries(counts).filter(([, value]) => Number.isFinite(value) && value > 0)
  );
  const viewerReactions = Array.from(nextSet);

  return {
    ...message,
    reactions: {
      counts: normalizedCounts,
      viewerReaction: viewerReactions[0],
      viewerReactions
    }
  };
};

export default function useChatRealtime({
  authUser,
  selectedRoomId,
  locationParams,
  announceBadgeEarned
}) {
  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [presence, setPresence] = useState([]);
  const [presenceError, setPresenceError] = useState(null);

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');

  const resolveMessageId = useCallback((message) => message?._id || message?.id, []);

  const messageIntervalRef = useRef(null);
  const presenceIntervalRef = useRef(null);

  const locationPayload = useMemo(() => (locationParams ? { ...locationParams } : {}), [locationParams]);

  const loadMessages = useCallback(async (roomId, { silent } = {}) => {
    if (!roomId) return;
    if (!silent) {
      setIsLoadingMessages(true);
    }
    setMessagesError(null);
    try {
      const data = await fetchChatMessages(roomId, locationPayload);
      setMessages(data);
    } catch (error) {
      setMessages([]);
      setMessagesError(error?.message || 'Failed to load messages.');
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  }, [locationPayload]);

  const loadPresence = useCallback(async (roomId) => {
    if (!roomId) return;
    try {
      const data = await fetchChatPresence(roomId, locationPayload);
      setPresence(data);
      setPresenceError(null);
    } catch (error) {
      setPresence([]);
      setPresenceError(error?.message || 'Failed to load room presence.');
    }
  }, [locationPayload]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      setPresence([]);
      return;
    }

    loadMessages(selectedRoomId);
    loadPresence(selectedRoomId);

    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current);
    }
    messageIntervalRef.current = setInterval(() => {
      loadMessages(selectedRoomId, { silent: true });
    }, MESSAGES_REFRESH_MS);

    if (presenceIntervalRef.current) {
      clearInterval(presenceIntervalRef.current);
    }
    presenceIntervalRef.current = setInterval(() => {
      loadPresence(selectedRoomId);
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      if (messageIntervalRef.current) {
        clearInterval(messageIntervalRef.current);
        messageIntervalRef.current = null;
      }
      if (presenceIntervalRef.current) {
        clearInterval(presenceIntervalRef.current);
        presenceIntervalRef.current = null;
      }
    };
  }, [loadMessages, loadPresence, selectedRoomId]);

  useEffect(() => {
    if (!authUser || !selectedRoomId) {
      return;
    }
    const sendHeartbeat = async () => {
      try {
        await upsertChatPresence(selectedRoomId, locationPayload);
      } catch (error) {
        console.warn('Failed to update chat presence', error);
      }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [authUser, locationPayload, selectedRoomId]);

  const handleMessageSent = useCallback((message) => {
    if (!message) return;
    setMessages((prev) => [...prev, message]);
    if (message?.badgeEarnedId) {
      playBadgeSound();
      if (typeof announceBadgeEarned === 'function') {
        announceBadgeEarned(message.badgeEarnedId);
      }
    }
    setMessageDraft('');
  }, [announceBadgeEarned]);

  const toggleReaction = useCallback(
    async (messageId, emojiKey) => {
      if (!selectedRoomId || !authUser || !messageId) {
        return false;
      }

      let rollbackMessage = null;
      setMessages((prev) =>
        prev.map((message) => {
          if (resolveMessageId(message) !== messageId) {
            return message;
          }
          rollbackMessage = message;
          return toggleReactionLocally(message, emojiKey);
        })
      );

      try {
        const payload = await updateChatMessageReaction(
          selectedRoomId,
          messageId,
          emojiKey,
          locationPayload
        );
        setMessages((prev) =>
          prev.map((message) => {
            const currentId = resolveMessageId(message);
            const payloadId = resolveMessageId(payload);
            return currentId && payloadId && currentId === payloadId ? payload : message;
          })
        );
        return true;
      } catch (error) {
        setMessages((prev) =>
          prev.map((message) => {
            if (resolveMessageId(message) !== messageId) {
              return message;
            }
            return rollbackMessage || message;
          })
        );
        setMessagesError(error?.message || 'Failed to update reaction.');
        return false;
      }
    },
    [authUser, locationPayload, resolveMessageId, selectedRoomId]
  );

  const sendMessage = useCallback(async ({ message, attachments = [] }) => {
    if (!selectedRoomId || !authUser) {
      return false;
    }
    setIsSendingMessage(true);
    setMessagesError(null);
    try {
      const payload = await createChatMessage(selectedRoomId, {
        message,
        attachments,
        ...locationPayload
      });
      handleMessageSent(payload);
      return true;
    } catch (error) {
      setMessagesError(error?.message || 'Failed to send message.');
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  }, [authUser, handleMessageSent, locationPayload, selectedRoomId]);

  const handleRefreshCurrentRoom = useCallback(() => {
    if (!selectedRoomId) {
      return;
    }
    loadMessages(selectedRoomId);
    loadPresence(selectedRoomId);
  }, [loadMessages, loadPresence, selectedRoomId]);

  const uniqueMessages = useMemo(() => {
    const seen = new Set();
    return messages.filter((message, index) => {
      const key = message?._id || message?.id || `message-${index}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [messages]);

  const filteredPresence = useMemo(() => {
    const map = new Map();
    presence.forEach((entry) => {
      map.set(entry.userId, entry);
    });
    return Array.from(map.values());
  }, [presence]);

  return {
    messages,
    messagesError,
    uniqueMessages,
    presence,
    presenceError,
    activeUserCount: filteredPresence.length,
    isLoadingMessages,
    messageDraft,
    setMessageDraft,
    sendMessage,
    toggleReaction,
    isSendingMessage,
    handleRefreshCurrentRoom
  };
}
