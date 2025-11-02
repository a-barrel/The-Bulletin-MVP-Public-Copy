import { useCallback, useRef, useState } from 'react';

import {
  createProximityChatMessage,
  createProximityChatPresence,
  createProximityChatRoom,
  fetchChatMessages,
  fetchChatPresence,
  fetchChatRooms
} from '../../../api/mongoDataApi';
import {
  parseCommaSeparated,
  parseOptionalDate,
  parseOptionalNumber,
  parseRequiredNumber
} from '../utils';

const INITIAL_ROOM_FORM = {
  ownerId: '',
  name: '',
  description: '',
  presetKey: '',
  latitude: '',
  longitude: '',
  radiusMeters: '',
  accuracy: '',
  pinId: '',
  participantIds: '',
  moderatorIds: ''
};

const INITIAL_MESSAGE_FORM = {
  roomId: '',
  authorId: '',
  message: '',
  pinId: '',
  replyToMessageId: '',
  latitude: '',
  longitude: '',
  accuracy: ''
};

const INITIAL_PRESENCE_FORM = {
  roomId: '',
  userId: '',
  sessionId: '',
  joinedAt: '',
  lastActiveAt: ''
};

const INITIAL_ROOMS_QUERY = { pinId: '', ownerId: '' };

const useThrottleFlag = () => {
  const flagRef = useRef(false);

  const start = () => {
    flagRef.current = true;
  };

  const stop = () => {
    flagRef.current = false;
  };

  const isActive = () => flagRef.current;

  return { start, stop, isActive };
};

const useChatTools = () => {
  const [roomForm, setRoomForm] = useState(INITIAL_ROOM_FORM);
  const [roomStatus, setRoomStatus] = useState(null);
  const [roomResult, setRoomResult] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [messageForm, setMessageForm] = useState(INITIAL_MESSAGE_FORM);
  const [messageStatus, setMessageStatus] = useState(null);
  const [messageResult, setMessageResult] = useState(null);
  const [isCreatingMessage, setIsCreatingMessage] = useState(false);

  const [presenceForm, setPresenceForm] = useState(INITIAL_PRESENCE_FORM);
  const [presenceStatus, setPresenceStatus] = useState(null);
  const [presenceResult, setPresenceResult] = useState(null);
  const [isCreatingPresence, setIsCreatingPresence] = useState(false);

  const [roomsQuery, setRoomsQuery] = useState(INITIAL_ROOMS_QUERY);
  const [roomsStatus, setRoomsStatus] = useState(null);
  const [roomsResult, setRoomsResult] = useState(null);
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);

  const [messagesRoomId, setMessagesRoomId] = useState('');
  const [messagesStatus, setMessagesStatus] = useState(null);
  const [messagesResult, setMessagesResult] = useState(null);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);

  const [presenceRoomId, setPresenceRoomId] = useState('');
  const [presenceLogStatus, setPresenceLogStatus] = useState(null);
  const [presenceLogResult, setPresenceLogResult] = useState(null);
  const [isFetchingPresence, setIsFetchingPresence] = useState(false);

  const fetchRoomsThrottle = useThrottleFlag();
  const fetchMessagesThrottle = useThrottleFlag();
  const fetchPresenceThrottle = useThrottleFlag();

  const handleCreateRoom = useCallback(
    async (event) => {
      event.preventDefault();
      setRoomStatus(null);

      try {
        const ownerId = roomForm.ownerId.trim();
        const name = roomForm.name.trim();
        if (!ownerId || !name) {
          throw new Error('Owner ID and room name are required.');
        }

        const latitude = parseRequiredNumber(roomForm.latitude, 'Latitude');
        const longitude = parseRequiredNumber(roomForm.longitude, 'Longitude');
        const radiusMeters = parseRequiredNumber(roomForm.radiusMeters, 'Radius (meters)');

        const payload = {
          ownerId,
          name,
          latitude,
          longitude,
          radiusMeters
        };

        const description = roomForm.description.trim();
        if (description) {
          payload.description = description;
        }

        const presetKey = roomForm.presetKey.trim();
        if (presetKey) {
          payload.presetKey = presetKey;
        }

        const accuracy = parseOptionalNumber(roomForm.accuracy, 'Accuracy');
        if (accuracy !== undefined) {
          payload.accuracy = accuracy;
        }

        const pinId = roomForm.pinId.trim();
        if (pinId) {
          payload.pinId = pinId;
        }

        const participantIds = parseCommaSeparated(roomForm.participantIds);
        if (participantIds.length) {
          payload.participantIds = participantIds;
        }

        const moderatorIds = parseCommaSeparated(roomForm.moderatorIds);
        if (moderatorIds.length) {
          payload.moderatorIds = moderatorIds;
        }

        setIsCreatingRoom(true);
        const result = await createProximityChatRoom(payload);
        setRoomResult(result);
        setRoomStatus({ type: 'success', message: 'Chat room created.' });
      } catch (error) {
        setRoomStatus({ type: 'error', message: error.message || 'Failed to create chat room.' });
      } finally {
        setIsCreatingRoom(false);
      }
    },
    [roomForm]
  );

  const handleCreateMessage = useCallback(
    async (event) => {
      event.preventDefault();
      setMessageStatus(null);

      try {
        const roomId = messageForm.roomId.trim();
        const authorId = messageForm.authorId.trim();
        const content = messageForm.message.trim();
        if (!roomId || !authorId || !content) {
          throw new Error('Room ID, author ID, and message are required.');
        }

        const payload = {
          roomId,
          authorId,
          message: content
        };

        const pinId = messageForm.pinId.trim();
        if (pinId) {
          payload.pinId = pinId;
        }

        const replyToMessageId = messageForm.replyToMessageId.trim();
        if (replyToMessageId) {
          payload.replyToMessageId = replyToMessageId;
        }

        const latitudeRaw = messageForm.latitude.trim();
        const longitudeRaw = messageForm.longitude.trim();
        if (latitudeRaw || longitudeRaw) {
          payload.latitude = parseRequiredNumber(latitudeRaw, 'Latitude');
          payload.longitude = parseRequiredNumber(longitudeRaw, 'Longitude');
          const accuracy = parseOptionalNumber(messageForm.accuracy, 'Accuracy');
          if (accuracy !== undefined) {
            payload.accuracy = accuracy;
          }
        }

        setIsCreatingMessage(true);
        const result = await createProximityChatMessage(payload);
        setMessageResult(result);
        setMessageStatus({ type: 'success', message: 'Chat message created.' });
      } catch (error) {
        setMessageStatus({ type: 'error', message: error.message || 'Failed to create chat message.' });
      } finally {
        setIsCreatingMessage(false);
      }
    },
    [messageForm]
  );

  const handleCreatePresence = useCallback(
    async (event) => {
      event.preventDefault();
      setPresenceStatus(null);

      try {
        const roomId = presenceForm.roomId.trim();
        const userId = presenceForm.userId.trim();
        if (!roomId || !userId) {
          throw new Error('Room ID and user ID are required.');
        }

        const payload = {
          roomId,
          userId
        };

        const sessionId = presenceForm.sessionId.trim();
        if (sessionId) {
          payload.sessionId = sessionId;
        }

        const joinedAt = parseOptionalDate(presenceForm.joinedAt, 'Joined at');
        if (joinedAt) {
          payload.joinedAt = joinedAt;
        }

        const lastActiveAt = parseOptionalDate(presenceForm.lastActiveAt, 'Last active at');
        if (lastActiveAt) {
          payload.lastActiveAt = lastActiveAt;
        }

        setIsCreatingPresence(true);
        const result = await createProximityChatPresence(payload);
        setPresenceResult(result);
        setPresenceStatus({ type: 'success', message: 'Presence recorded.' });
      } catch (error) {
        setPresenceStatus({ type: 'error', message: error.message || 'Failed to record presence.' });
      } finally {
        setIsCreatingPresence(false);
      }
    },
    [presenceForm]
  );

  const handleFetchRooms = useCallback(
    async (event) => {
      event.preventDefault();
      if (fetchRoomsThrottle.isActive()) {
        return;
      }
      fetchRoomsThrottle.start();
      setRoomsStatus(null);

      try {
        const query = {};
        const pinId = roomsQuery.pinId.trim();
        if (pinId) {
          query.pinId = pinId;
        }
        const ownerId = roomsQuery.ownerId.trim();
        if (ownerId) {
          query.ownerId = ownerId;
        }

        setIsFetchingRooms(true);
        const rooms = await fetchChatRooms(query);
        setRoomsResult(rooms);
        setRoomsStatus({
          type: 'success',
          message: `Loaded ${rooms.length} room${rooms.length === 1 ? '' : 's'}.`
        });
      } catch (error) {
        setRoomsStatus({ type: 'error', message: error.message || 'Failed to load chat rooms.' });
      } finally {
        setIsFetchingRooms(false);
        fetchRoomsThrottle.stop();
      }
    },
    [roomsQuery, fetchRoomsThrottle]
  );

  const handleFetchMessages = useCallback(
    async (event) => {
      event.preventDefault();
      if (fetchMessagesThrottle.isActive()) {
        return;
      }
      fetchMessagesThrottle.start();
      setMessagesStatus(null);
      const roomId = messagesRoomId.trim();
      if (!roomId) {
        setMessagesStatus({ type: 'error', message: 'Room ID is required.' });
        fetchMessagesThrottle.stop();
        return;
      }

      try {
        setIsFetchingMessages(true);
        const messages = await fetchChatMessages(roomId);
        setMessagesResult(messages);
        setMessagesStatus({
          type: 'success',
          message: `Loaded ${messages.length} message${messages.length === 1 ? '' : 's'}.`
        });
      } catch (error) {
        setMessagesStatus({ type: 'error', message: error.message || 'Failed to load chat messages.' });
      } finally {
        setIsFetchingMessages(false);
        fetchMessagesThrottle.stop();
      }
    },
    [messagesRoomId, fetchMessagesThrottle]
  );

  const handleFetchPresenceLog = useCallback(
    async (event) => {
      event.preventDefault();
      if (fetchPresenceThrottle.isActive()) {
        return;
      }
      fetchPresenceThrottle.start();
      setPresenceLogStatus(null);
      const roomId = presenceRoomId.trim();
      if (!roomId) {
        setPresenceLogStatus({ type: 'error', message: 'Room ID is required.' });
        fetchPresenceThrottle.stop();
        return;
      }

      try {
        setIsFetchingPresence(true);
        const entries = await fetchChatPresence(roomId);
        setPresenceLogResult(entries);
        setPresenceLogStatus({
          type: 'success',
          message: `Loaded ${entries.length} presence entr${entries.length === 1 ? 'y' : 'ies'}.`
        });
      } catch (error) {
        setPresenceLogStatus({ type: 'error', message: error.message || 'Failed to load presence log.' });
      } finally {
        setIsFetchingPresence(false);
        fetchPresenceThrottle.stop();
      }
    },
    [presenceRoomId, fetchPresenceThrottle]
  );

  const resetRoomForm = useCallback(() => {
    setRoomForm(INITIAL_ROOM_FORM);
    setRoomStatus(null);
    setRoomResult(null);
  }, []);

  const resetMessageForm = useCallback(() => {
    setMessageForm(INITIAL_MESSAGE_FORM);
    setMessageStatus(null);
    setMessageResult(null);
  }, []);

  const resetPresenceForm = useCallback(() => {
    setPresenceForm(INITIAL_PRESENCE_FORM);
    setPresenceStatus(null);
    setPresenceResult(null);
  }, []);

  return {
    roomForm,
    setRoomForm,
    roomStatus,
    setRoomStatus,
    roomResult,
    isCreatingRoom,
    handleCreateRoom,
    resetRoomForm,
    messageForm,
    setMessageForm,
    messageStatus,
    setMessageStatus,
    messageResult,
    isCreatingMessage,
    handleCreateMessage,
    resetMessageForm,
    presenceForm,
    setPresenceForm,
    presenceStatus,
    setPresenceStatus,
    presenceResult,
    isCreatingPresence,
    handleCreatePresence,
    resetPresenceForm,
    roomsQuery,
    setRoomsQuery,
    roomsStatus,
    setRoomsStatus,
    roomsResult,
    isFetchingRooms,
    handleFetchRooms,
    messagesRoomId,
    setMessagesRoomId,
    messagesStatus,
    setMessagesStatus,
    messagesResult,
    isFetchingMessages,
    handleFetchMessages,
    presenceRoomId,
    setPresenceRoomId,
    presenceLogStatus,
    setPresenceLogStatus,
    presenceLogResult,
    isFetchingPresence,
    handleFetchPresenceLog
  };
};

export default useChatTools;
