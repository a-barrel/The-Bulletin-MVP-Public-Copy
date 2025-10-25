import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  createProximityChatMessage,
  createProximityChatPresence,
  createProximityChatRoom,
  fetchChatMessages,
  fetchChatPresence,
  fetchChatRooms
} from '../../../api/mongoDataApi';
import JsonPreview from '../components/JsonPreview';
import {
  parseCommaSeparated,
  parseOptionalDate,
  parseOptionalNumber,
  parseRequiredNumber
} from '../utils';

function ChatTab() {
  const [roomForm, setRoomForm] = useState({
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
  });
  const [roomStatus, setRoomStatus] = useState(null);
  const [roomResult, setRoomResult] = useState(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [messageForm, setMessageForm] = useState({
    roomId: '',
    authorId: '',
    message: '',
    pinId: '',
    replyToMessageId: '',
    latitude: '',
    longitude: '',
    accuracy: ''
  });
  const [messageStatus, setMessageStatus] = useState(null);
  const [messageResult, setMessageResult] = useState(null);
  const [isCreatingMessage, setIsCreatingMessage] = useState(false);

  const [presenceForm, setPresenceForm] = useState({
    roomId: '',
    userId: '',
    sessionId: '',
    joinedAt: '',
    lastActiveAt: ''
  });
  const [presenceStatus, setPresenceStatus] = useState(null);
  const [presenceResult, setPresenceResult] = useState(null);
  const [isCreatingPresence, setIsCreatingPresence] = useState(false);

  const [roomsQuery, setRoomsQuery] = useState({ pinId: '', ownerId: '' });
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

  const handleCreateRoom = async (event) => {
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
  };

  const handleCreateMessage = async (event) => {
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
  };

  const handleCreatePresence = async (event) => {
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
  };

  const handleFetchRooms = async (event) => {
    event.preventDefault();
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
    }
  };

  const handleFetchMessages = async (event) => {
    event.preventDefault();
    setMessagesStatus(null);
    const roomId = messagesRoomId.trim();
    if (!roomId) {
      setMessagesStatus({ type: 'error', message: 'Room ID is required.' });
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
    }
  };

  const handleFetchPresenceLog = async (event) => {
    event.preventDefault();
    setPresenceLogStatus(null);
    const roomId = presenceRoomId.trim();
    if (!roomId) {
      setPresenceLogStatus({ type: 'error', message: 'Room ID is required.' });
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
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateRoom}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create proximity chat room</Typography>
        <Typography variant="body2" color="text.secondary">
          Define a new geofenced chat hub linked to a pin or free-floating area.
        </Typography>
        {roomStatus && (
          <Alert severity={roomStatus.type} onClose={() => setRoomStatus(null)}>
            {roomStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Owner ID"
              value={roomForm.ownerId}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, ownerId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Name"
              value={roomForm.name}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Description"
            value={roomForm.description}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, description: event.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Preset key (optional)"
            value={roomForm.presetKey}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, presetKey: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={roomForm.latitude}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, latitude: event.target.value }))}
              required
            />
            <TextField
              label="Longitude"
              value={roomForm.longitude}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, longitude: event.target.value }))}
              required
            />
            <TextField
              label="Radius (meters)"
              value={roomForm.radiusMeters}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, radiusMeters: event.target.value }))}
              required
            />
            <TextField
              label="Accuracy"
              value={roomForm.accuracy}
              onChange={(event) => setRoomForm((prev) => ({ ...prev, accuracy: event.target.value }))}
            />
          </Stack>
          <TextField
            label="Pin ID (optional)"
            value={roomForm.pinId}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Participant IDs (comma separated)"
            value={roomForm.participantIds}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, participantIds: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Moderator IDs (comma separated)"
            value={roomForm.moderatorIds}
            onChange={(event) => setRoomForm((prev) => ({ ...prev, moderatorIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingRoom}>
              {isCreatingRoom ? 'Creating...' : 'Create room'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setRoomForm({
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
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={roomResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreateMessage}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create chat message</Typography>
        <Typography variant="body2" color="text.secondary">
          Inject a test message into a room timeline.
        </Typography>
        {messageStatus && (
          <Alert severity={messageStatus.type} onClose={() => setMessageStatus(null)}>
            {messageStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Room ID"
              value={messageForm.roomId}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, roomId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Author ID"
              value={messageForm.authorId}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, authorId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Message"
            value={messageForm.message}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, message: event.target.value }))}
            multiline
            minRows={2}
            required
            fullWidth
          />
          <TextField
            label="Pin ID (optional)"
            value={messageForm.pinId}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Reply to message ID"
            value={messageForm.replyToMessageId}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, replyToMessageId: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Latitude"
              value={messageForm.latitude}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, latitude: event.target.value }))}
            />
            <TextField
              label="Longitude"
              value={messageForm.longitude}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, longitude: event.target.value }))}
            />
            <TextField
              label="Accuracy"
              value={messageForm.accuracy}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, accuracy: event.target.value }))}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingMessage}>
              {isCreatingMessage ? 'Creating...' : 'Create message'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setMessageForm({
                  roomId: '',
                  authorId: '',
                  message: '',
                  pinId: '',
                  replyToMessageId: '',
                  latitude: '',
                  longitude: '',
                  accuracy: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={messageResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreatePresence}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Record presence</Typography>
        <Typography variant="body2" color="text.secondary">
          Emulate a user joining or updating active status in a room.
        </Typography>
        {presenceStatus && (
          <Alert severity={presenceStatus.type} onClose={() => setPresenceStatus(null)}>
            {presenceStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Room ID"
              value={presenceForm.roomId}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, roomId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="User ID"
              value={presenceForm.userId}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Session ID"
            value={presenceForm.sessionId}
            onChange={(event) => setPresenceForm((prev) => ({ ...prev, sessionId: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Joined at"
              type="datetime-local"
              value={presenceForm.joinedAt}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, joinedAt: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Last active at"
              type="datetime-local"
              value={presenceForm.lastActiveAt}
              onChange={(event) => setPresenceForm((prev) => ({ ...prev, lastActiveAt: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingPresence}>
              {isCreatingPresence ? 'Recording...' : 'Record presence'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setPresenceForm({
                  roomId: '',
                  userId: '',
                  sessionId: '',
                  joinedAt: '',
                  lastActiveAt: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={presenceResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchRooms}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">List chat rooms</Typography>
        <Typography variant="body2" color="text.secondary">
          Filter rooms by linked pin or owner.
        </Typography>
        {roomsStatus && (
          <Alert severity={roomsStatus.type} onClose={() => setRoomsStatus(null)}>
            {roomsStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Pin ID"
            value={roomsQuery.pinId}
            onChange={(event) => setRoomsQuery((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Owner ID"
            value={roomsQuery.ownerId}
            onChange={(event) => setRoomsQuery((prev) => ({ ...prev, ownerId: event.target.value }))}
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingRooms}>
            {isFetchingRooms ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={roomsResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchMessages}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch chat messages</Typography>
        <Typography variant="body2" color="text.secondary">
          Load the current timeline for a room.
        </Typography>
        {messagesStatus && (
          <Alert severity={messagesStatus.type} onClose={() => setMessagesStatus(null)}>
            {messagesStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Room ID"
            value={messagesRoomId}
            onChange={(event) => setMessagesRoomId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingMessages}>
            {isFetchingMessages ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={messagesResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchPresenceLog}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch presence log</Typography>
        <Typography variant="body2" color="text.secondary">
          Inspect join/leave history for a room session.
        </Typography>
        {presenceLogStatus && (
          <Alert severity={presenceLogStatus.type} onClose={() => setPresenceLogStatus(null)}>
            {presenceLogStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Room ID"
            value={presenceRoomId}
            onChange={(event) => setPresenceRoomId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingPresence}>
            {isFetchingPresence ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={presenceLogResult} />
      </Paper>
    </Stack>
  );
}

export default ChatTab;
