import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DebugPanel from '../components/DebugPanel';
import useDirectMessagesTools from '../hooks/useDirectMessagesTools';
import { formatReadableTimestamp } from '../utils';

const DirectMessagesTab = () => {
  const {
    threads,
    threadsStatus,
    isLoadingThreads,
    refreshThreads,
    selectedThreadId,
    handleSelectThread,
    threadDetail,
    threadStatus,
    isLoadingThread,
    refreshThreadDetail,
    composerText,
    updateComposer,
    sendMessage,
    composerStatus,
    isSendingMessage,
    newThreadForm,
    updateNewThreadForm,
    addParticipantId,
    removeParticipantId,
    commitParticipantInput,
    createThread,
    newThreadStatus,
    isCreatingThread,
    searchTerm,
    setSearchTerm,
    handleSearch,
    searchResults,
    isSearching,
    searchStatus,
    setComposerStatus,
    setNewThreadStatus
  } = useDirectMessagesTools();

  const threadListAlerts = [];
  if (threadsStatus) {
    threadListAlerts.push({
      severity: threadsStatus.type,
      content: threadsStatus.message
    });
  }

  const threadAlerts = [];
  if (threadStatus) {
    threadAlerts.push({
      severity: threadStatus.type,
      content: threadStatus.message
    });
  }
  if (composerStatus) {
    threadAlerts.push({
      severity: composerStatus.type,
      content: composerStatus.message,
      onClose: () => setComposerStatus(null)
    });
  }

  const createAlerts = [];
  if (newThreadStatus) {
    createAlerts.push({
      severity: newThreadStatus.type,
      content: newThreadStatus.message,
      onClose: () => setNewThreadStatus(null)
    });
  }
  if (searchStatus) {
    createAlerts.push({
      severity: searchStatus.type,
      content: searchStatus.message
    });
  }

  return (
    <Stack spacing={3}>
      <DebugPanel
        title="Direct Message Threads"
        description="Inspect personal and group conversations backed by the Mongo sample dataset."
        alerts={threadListAlerts}
        actions={
          <Button variant="outlined" onClick={refreshThreads} disabled={isLoadingThreads}>
            {isLoadingThreads ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      >
        {threads.length ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {threads.map((thread) => (
              <Chip
                key={thread.id}
                label={`${thread.topic || 'Untitled'} · ${thread.participantCount} participant${
                  thread.participantCount === 1 ? '' : 's'
                }`}
                color={selectedThreadId === thread.id ? 'primary' : 'default'}
                onClick={() => handleSelectThread(thread.id)}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No direct message threads found yet.
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Active Thread"
        description="Send new messages or review the latest conversation context."
        alerts={threadAlerts}
        actions={
          selectedThreadId ? (
            <Button variant="outlined" onClick={() => refreshThreadDetail(selectedThreadId)} disabled={isLoadingThread}>
              {isLoadingThread ? 'Refreshing…' : 'Reload Thread'}
            </Button>
          ) : null
        }
      >
        {selectedThreadId && threadDetail ? (
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">{threadDetail.topic || 'Untitled thread'}</Typography>
              <Typography variant="body2" color="text.secondary">
                Participants:{' '}
                {threadDetail.participants
                  .map((participant) => participant.displayName || participant.username || participant.id)
                  .join(', ')}
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1.5} sx={{ maxHeight: 320, overflowY: 'auto', pr: 1 }}>
              {threadDetail.messages?.length ? (
                threadDetail.messages.map((message) => (
                  <Stack key={message.id} spacing={0.25}>
                    <Typography variant="subtitle2">
                      {message.sender?.displayName || message.sender?.username || message.sender?.id}{' '}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {formatReadableTimestamp(message.createdAt) || '—'}
                      </Typography>
                    </Typography>
                    <Typography variant="body2">{message.body}</Typography>
                  </Stack>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No messages delivered yet.
                </Typography>
              )}
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <TextField
                label="Message"
                multiline
                minRows={2}
                value={composerText}
                onChange={(event) => updateComposer(event.target.value)}
                placeholder="Craft a message to send"
              />
              <Button variant="contained" onClick={() => sendMessage()} disabled={isSendingMessage}>
                {isSendingMessage ? 'Sending…' : 'Send'}
              </Button>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a thread to inspect or update the conversation.
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Start New Thread"
        description="Spin up private or group chats to exercise the moderation dashboard."
        alerts={createAlerts}
        actions={
          <Button variant="contained" disabled={isCreatingThread} onClick={() => createThread()}>
            {isCreatingThread ? 'Creating…' : 'Create Thread'}
          </Button>
        }
      >
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Add participants (comma separated ids)"
                value={newThreadForm.participantInput}
                onChange={(event) => updateNewThreadForm('participantInput', event.target.value)}
                helperText="Press Add to move ids into the participant list."
              />
            </Grid>
            <Grid item xs={12} md={6} display="flex" alignItems="center">
              <Button variant="outlined" onClick={commitParticipantInput}>
                Add Participant Ids
              </Button>
            </Grid>
          </Grid>

          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Selected participants
            </Typography>
            {newThreadForm.participantIds.length ? (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {newThreadForm.participantIds.map((participantId) => (
                  <Chip
                    key={participantId}
                    label={participantId}
                    color="primary"
                    onDelete={() => removeParticipantId(participantId)}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Add one or more participant ids.
              </Typography>
            )}
          </Stack>

          <Divider />

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Participant search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Find users to add"
              fullWidth
            />
            <Button variant="outlined" onClick={() => handleSearch()} disabled={isSearching}>
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
          </Stack>

          {searchResults.length ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Search results
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {searchResults.map((user) => {
                  const id = user._id || user.id;
                  const label = user.displayName || user.username || id;
                  return (
                    <Chip key={id} label={label} onClick={() => addParticipantId(id)} variant="outlined" />
                  );
                })}
              </Stack>
            </Stack>
          ) : null}

          <TextField
            label="Topic (optional)"
            value={newThreadForm.topic}
            onChange={(event) => updateNewThreadForm('topic', event.target.value)}
            placeholder="Group chat topic or label"
          />

          <TextField
            label="Initial message (optional)"
            value={newThreadForm.initialMessage}
            onChange={(event) => updateNewThreadForm('initialMessage', event.target.value)}
            multiline
            minRows={2}
            placeholder="Kick off the conversation with a starter message"
          />
        </Stack>
      </DebugPanel>
    </Stack>
  );
};

export default DirectMessagesTab;
