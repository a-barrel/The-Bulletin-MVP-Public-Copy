import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import DebugPanel from '../components/DebugPanel';
import useLiveChatSimulationTools from '../hooks/useLiveChatSimulationTools';
import { LIVE_CHAT_ROOM_PRESETS, TELEPORT_PRESETS } from '../constants';
import { formatReadableTimestamp, toIdString } from '../utils';

function LiveChatTestTab() {
  const {
    currentUser,
    currentProfile,
    roomsByKey,
    selectedRoomKey,
    activeRoom,
    messages,
    messageInput,
    setMessageInput,
    status,
    setStatus,
    locationStatus,
    setLocationStatus,
    isEnsuringRooms,
    isRefreshingMessages,
    isSending,
    isTeleporting,
    activeLocationKey,
    roomAccess,
    distanceToRoomLabel,
    activeRoomRadiusLabel,
    activeTeleportPreset,
    handleSelectRoom,
    handleReloadRooms,
    handleRefreshMessages,
    handleTeleport,
    handleSendMessage,
    resolveAuthorAvatar,
    messagesEndRef,
    currentAvatar,
    sendingAsLabel
  } = useLiveChatSimulationTools();

  const primaryAlerts = [];
  if (status) {
    primaryAlerts.push({
      key: 'livechat-status',
      severity: status.type,
      content: status.message,
      onClose: () => setStatus(null)
    });
  }
  if (locationStatus) {
    primaryAlerts.push({
      key: 'location-status',
      severity: locationStatus.type,
      content: locationStatus.message,
      onClose: () => setLocationStatus(null)
    });
  }

  const currentProfileId = toIdString(currentProfile?._id);

  return (
    <Stack spacing={3}>
      <DebugPanel
        title="Live Chat Test"
        description="Swap between preset chat rooms and spoof GPS to validate proximity behavior for live chat."
        alerts={primaryAlerts}
        actions={[
          <Button
            key="reload-rooms"
            type="button"
            variant="outlined"
            size="small"
            onClick={handleReloadRooms}
            disabled={isEnsuringRooms || !currentUser}
          >
            {isEnsuringRooms ? 'Loading rooms...' : 'Reload rooms'}
          </Button>,
          <Button
            key="refresh-messages"
            type="button"
            variant="outlined"
            size="small"
            onClick={handleRefreshMessages}
            disabled={isRefreshingMessages || !activeRoom}
          >
            {isRefreshingMessages ? 'Refreshing...' : 'Refresh messages'}
          </Button>
        ]}
      >
        {!roomAccess.allowed && activeRoom ? (
          <Alert severity="warning">{roomAccess.reason}</Alert>
        ) : null}

        {!currentUser ? (
          <Alert severity="warning">Sign in to interact with the live chat rooms.</Alert>
        ) : null}

        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Chat room presets</Typography>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', md: 'center' }}
            >
              <ToggleButtonGroup
                value={selectedRoomKey}
                exclusive
                onChange={(_, value) => value && handleSelectRoom(value)}
                size="small"
                color="primary"
                sx={{ flexWrap: 'wrap' }}
              >
                {LIVE_CHAT_ROOM_PRESETS.map((preset) => (
                  <ToggleButton
                    key={preset.key}
                    value={preset.key}
                    disabled={isEnsuringRooms && !roomsByKey[preset.key]}
                    sx={{ textTransform: 'none', minWidth: 140 }}
                  >
                    {preset.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              {isEnsuringRooms ? <CircularProgress size={20} /> : null}
            </Stack>

            {activeRoom ? (
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {activeRoom.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  {activeRoomRadiusLabel ? <Chip size="small" label={activeRoomRadiusLabel} /> : null}
                  {distanceToRoomLabel ? (
                    <Chip size="small" color="secondary" label={distanceToRoomLabel} />
                  ) : null}
                  {activeRoom.description ? (
                    <Typography variant="caption" color="text.secondary">
                      {activeRoom.description}
                    </Typography>
                  ) : null}
                </Stack>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Choose a preset to load its associated chat room.
              </Typography>
            )}
          </Stack>

          <Stack spacing={1}>
            <Typography variant="subtitle2">GPS spoofing</Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              {TELEPORT_PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  size="small"
                  variant={preset.key === activeLocationKey ? 'contained' : 'outlined'}
                  onClick={() => handleTeleport(preset)}
                  disabled={isTeleporting || !currentUser}
                  sx={{ textTransform: 'none', minWidth: 220 }}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>
            {activeTeleportPreset ? (
              <Typography variant="caption" color="text.secondary">
                Active GPS preset: {activeTeleportPreset.label} (
                {activeTeleportPreset.latitude.toFixed(4)}, {activeTeleportPreset.longitude.toFixed(4)})
              </Typography>
            ) : null}
          </Stack>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar src={currentAvatar} alt={sendingAsLabel} />
          <Stack spacing={0.3}>
            <Typography variant="subtitle2">Sending as</Typography>
            <Typography variant="body2" color="text.secondary">
              {sendingAsLabel}
            </Typography>
          </Stack>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, sm: 2 },
            height: 360,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            backgroundColor: 'background.default'
          }}
        >
          {!roomAccess.allowed && activeRoom ? (
            <Typography variant="body2" color="text.secondary">
              {roomAccess.reason}
            </Typography>
          ) : messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {isEnsuringRooms || isRefreshingMessages
                ? 'Loading messages...'
                : 'No messages yet. Send something to get started.'}
            </Typography>
          ) : (
            messages.map((message) => {
              const key =
                message?._id || `${message?.createdAt}-${message?.authorId || Math.random()}`;
              const authorName =
                message?.author?.displayName ||
                message?.author?.username ||
                message?.authorId ||
                'Unknown user';
              const avatarSrc = resolveAuthorAvatar(message?.author);
              const timestamp = formatReadableTimestamp(message?.createdAt);
              const messageAuthorId = toIdString(message?.authorId);
              const isSelf =
                currentProfileId && messageAuthorId && messageAuthorId === currentProfileId;

              return (
                <Stack
                  key={key}
                  direction="row"
                  spacing={2}
                  alignItems="flex-start"
                  justifyContent={isSelf ? 'flex-end' : 'flex-start'}
                >
                  {!isSelf ? (
                    <Avatar src={avatarSrc} alt={authorName} sx={{ width: 36, height: 36 }} />
                  ) : null}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      maxWidth: '80%',
                      backgroundColor: isSelf ? 'primary.main' : 'background.paper',
                      color: isSelf ? 'primary.contrastText' : 'text.primary'
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {authorName}
                        </Typography>
                        {timestamp ? (
                          <Typography variant="caption" color="text.secondary">
                            {timestamp}
                          </Typography>
                        ) : null}
                      </Stack>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {message?.message}
                      </Typography>
                    </Stack>
                  </Paper>
                  {isSelf ? (
                    <Avatar src={avatarSrc} alt={authorName} sx={{ width: 36, height: 36 }} />
                  ) : null}
                </Stack>
              );
            })
          )}
          <Box ref={messagesEndRef} />
        </Paper>

        <Box component="form" onSubmit={handleSendMessage}>
          <Stack spacing={2}>
            <TextField
              label="Message"
              multiline
              minRows={2}
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder={`Type a message for ${activeRoom?.name ?? 'the selected chat room'}`}
              disabled={!currentUser || !activeRoom || !roomAccess.allowed}
            />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={!currentUser || !activeRoom || !roomAccess.allowed || isSending}
              >
                {isSending ? 'Sending...' : 'Send message'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      </DebugPanel>
    </Stack>
  );
}

export default LiveChatTestTab;
