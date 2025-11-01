import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import JsonPreview from '../components/JsonPreview';
import DebugPanel from '../components/DebugPanel';
import useChatTools from '../hooks/useChatTools';

function ChatTab() {
  const {
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
  } = useChatTools();

  const roomAlerts = roomStatus
    ? [
        {
          key: 'room-status',
          severity: roomStatus.type,
          content: roomStatus.message,
          onClose: () => setRoomStatus(null)
        }
      ]
    : [];

  const messageAlerts = messageStatus
    ? [
        {
          key: 'message-status',
          severity: messageStatus.type,
          content: messageStatus.message,
          onClose: () => setMessageStatus(null)
        }
      ]
    : [];

  const presenceAlerts = presenceStatus
    ? [
        {
          key: 'presence-status',
          severity: presenceStatus.type,
          content: presenceStatus.message,
          onClose: () => setPresenceStatus(null)
        }
      ]
    : [];

  const roomsAlerts = roomsStatus
    ? [
        {
          key: 'rooms-status',
          severity: roomsStatus.type,
          content: roomsStatus.message,
          onClose: () => setRoomsStatus(null)
        }
      ]
    : [];

  const messagesAlerts = messagesStatus
    ? [
        {
          key: 'messages-status',
          severity: messagesStatus.type,
          content: messagesStatus.message,
          onClose: () => setMessagesStatus(null)
        }
      ]
    : [];

  const presenceLogAlerts = presenceLogStatus
    ? [
        {
          key: 'presence-log-status',
          severity: presenceLogStatus.type,
          content: presenceLogStatus.message,
          onClose: () => setPresenceLogStatus(null)
        }
      ]
    : [];

  return (
    <Stack spacing={2}>
      <DebugPanel
        component="form"
        onSubmit={handleCreateRoom}
        title="Create proximity chat room"
        description="Define a new geofenced chat hub linked to a pin or free-floating area."
        alerts={roomAlerts}
      >
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
            <Button type="button" variant="text" onClick={resetRoomForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={roomResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleCreateMessage}
        title="Create chat message"
        description="Seed conversations in a proximity chat room."
        alerts={messageAlerts}
      >
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
            minRows={3}
            required
            fullWidth
          />
          <TextField
            label="Pin ID"
            value={messageForm.pinId}
            onChange={(event) => setMessageForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Reply to message ID"
            value={messageForm.replyToMessageId}
            onChange={(event) =>
              setMessageForm((prev) => ({ ...prev, replyToMessageId: event.target.value }))
            }
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
            <Button type="button" variant="text" onClick={resetMessageForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={messageResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleCreatePresence}
        title="Record presence"
        description="Log when a user enters or leaves a chat room."
        alerts={presenceAlerts}
      >
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
              {isCreatingPresence ? 'Logging...' : 'Record presence'}
            </Button>
            <Button type="button" variant="text" onClick={resetPresenceForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={presenceResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchRooms}
        title="List chat rooms"
        description="Query chat rooms by owner or linked pin."
        alerts={roomsAlerts}
      >
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
            {isFetchingRooms ? 'Loading…' : 'Fetch rooms'}
          </Button>
        </Stack>
        <JsonPreview data={roomsResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchMessages}
        title="Fetch chat messages"
        description="Load messages for a chat room to verify order and metadata."
        alerts={messagesAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Room ID"
            value={messagesRoomId}
            onChange={(event) => setMessagesRoomId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingMessages}>
            {isFetchingMessages ? 'Loading…' : 'Fetch messages'}
          </Button>
        </Stack>
        <JsonPreview data={messagesResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchPresenceLog}
        title="Fetch presence log"
        description="Inspect historical presence entries for a given chat room."
        alerts={presenceLogAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Room ID"
            value={presenceRoomId}
            onChange={(event) => setPresenceRoomId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingPresence}>
            {isFetchingPresence ? 'Loading…' : 'Fetch presence'}
          </Button>
        </Stack>
        <JsonPreview data={presenceLogResult} />
      </DebugPanel>
    </Stack>
  );
}

export default ChatTab;
