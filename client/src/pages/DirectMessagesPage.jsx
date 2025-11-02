import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';

import useDirectMessages from '../hooks/useDirectMessages';
import { formatFriendlyTimestamp, formatRelativeTime } from '../utils/dates';
import { routes } from '../routes';

export const pageConfig = {
  id: 'direct-messages',
  label: 'Direct Messages',
  icon: MarkUnreadChatAltIcon,
  path: '/direct-messages',
  aliases: ['/direct-messages/:threadId'],
  order: 94,
  showInNav: true,
  protected: true
};

const resolveParticipantNames = (thread, viewerId) => {
  const peers = (thread.participants || []).filter((participant) => {
    const id = participant?.id || participant?._id;
    return !viewerId || (id && id !== viewerId);
  });

  if (!peers.length) {
    return ['You'];
  }
  return peers.map(
    (participant) =>
      participant?.displayName || participant?.username || participant?.id || 'Unknown user'
  );
};

function DirectMessagesPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const {
    viewer,
    threads,
    refreshThreads,
    isLoadingThreads,
    threadsStatus,
    hasAccess,
    selectThread,
    selectedThreadId,
    threadDetail,
    isLoadingThread,
    threadStatus,
    sendMessage,
    isSending,
    sendStatus,
    resetSendStatus
  } = useDirectMessages();

  const [messageDraft, setMessageDraft] = useState('');

  const viewerId = useMemo(() => {
    if (!viewer) {
      return null;
    }
    return viewer._id || viewer.id || null;
  }, [viewer]);

  useEffect(() => {
    if (!hasAccess) {
      return;
    }
    if (threadId) {
      selectThread(threadId);
    } else if (!selectedThreadId && threads.length) {
      selectThread(threads[0].id);
    }
  }, [hasAccess, threadId, threads, selectedThreadId, selectThread]);

  useEffect(() => {
    if (!selectedThreadId) {
      if (!threadId) {
        return;
      }
      navigate(routes.directMessages.base, { replace: true });
      return;
    }
    if (threadId !== selectedThreadId) {
      navigate(routes.directMessages.thread(selectedThreadId), { replace: true });
    }
  }, [navigate, selectedThreadId, threadId]);

  useEffect(() => {
    if (!sendStatus) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      resetSendStatus();
    }, 4000);
    return () => window.clearTimeout(timeoutId);
  }, [resetSendStatus, sendStatus]);

  const handleSendMessage = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedThreadId) {
        return;
      }
      const trimmed = messageDraft.trim();
      if (!trimmed) {
        return;
      }
      try {
        await sendMessage({ threadId: selectedThreadId, body: trimmed, attachments: [] });
        setMessageDraft('');
      } catch {
        // Errors surface via sendStatus.
      }
    },
    [messageDraft, selectedThreadId, sendMessage]
  );

  const handleRefreshThreads = useCallback(() => {
    refreshThreads().catch(() => {});
  }, [refreshThreads]);

  const selectedThread = useMemo(() => {
    if (!selectedThreadId) {
      return null;
    }
    return threads.find((thread) => thread.id === selectedThreadId) || null;
  }, [threads, selectedThreadId]);

  const selectedThreadNames = useMemo(
    () => (selectedThread ? resolveParticipantNames(selectedThread, viewerId) : []),
    [selectedThread, viewerId]
  );

  if (hasAccess === false) {
    return (
      <Box
        sx={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          p: 4
        }}
      >
        <Paper elevation={3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, maxWidth: 480 }}>
          <Typography variant="h6" gutterBottom>
            Direct messages are restricted
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ask an administrator to grant you messaging privileges before using this workspace.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        p: { xs: 2, md: 4 },
        backgroundColor: 'background.default',
        boxSizing: 'border-box'
      }}
    >
      <Paper
        elevation={4}
        sx={{
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '70vh',
          maxWidth: 1100,
          margin: '0 auto'
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
          sx={{ p: { xs: 2, md: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="h5" component="h1">
            Direct messages
          </Typography>
          <IconButton onClick={handleRefreshThreads} disabled={isLoadingThreads}>
            {isLoadingThreads ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Stack>

        {threadsStatus && threadsStatus.message ? (
          <Box sx={{ px: { xs: 2, md: 3 }, pt: 2 }}>
            <Alert severity={threadsStatus.type}>{threadsStatus.message}</Alert>
          </Box>
        ) : null}

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={0}
          sx={{ flex: 1, minHeight: 0, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Box
            sx={{
              width: { xs: '100%', md: 320 },
              borderRight: { xs: 'none', md: '1px solid' },
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: { xs: 280, md: '100%' }
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="text.secondary">
                Conversations
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {threads.length === 0 && !isLoadingThreads ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    You don’t have any conversations yet. Start one from a profile page.
                  </Typography>
                </Box>
              ) : (
                threads.map((thread) => {
                  const isActive = thread.id === selectedThreadId;
                  const names = resolveParticipantNames(thread, viewerId);
                  return (
                    <Button
                      key={thread.id}
                      onClick={() => selectThread(thread.id)}
                      fullWidth
                      variant={isActive ? 'contained' : 'text'}
                      color={isActive ? 'secondary' : 'inherit'}
                      sx={{
                        borderRadius: 0,
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        px: 2,
                        py: 1.5
                      }}
                    >
                      <Stack spacing={0.5} alignItems="flex-start">
                        <Typography variant="subtitle2">{names.join(', ')}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {thread.lastMessageAt
                            ? formatRelativeTime(thread.lastMessageAt)
                            : `${thread.messageCount} messages`}
                        </Typography>
                      </Stack>
                    </Button>
                  );
                })
              )}
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: { xs: 320, md: '100%' }
            }}
          >
            <Box
              sx={{
                px: { xs: 2, md: 3 },
                py: 2,
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              {selectedThread ? (
                <Stack spacing={0.5}>
                  <Typography variant="h6">{selectedThreadNames.join(', ')}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={`${selectedThread.messageCount} message${
                        selectedThread.messageCount === 1 ? '' : 's'
                      }`}
                      size="small"
                      variant="outlined"
                    />
                    {selectedThread.lastMessageAt ? (
                      <Chip
                        label={`Updated ${formatFriendlyTimestamp(selectedThread.lastMessageAt)}`}
                        size="small"
                        variant="outlined"
                      />
                    ) : null}
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="subtitle1" color="text.secondary">
                  Select a conversation to begin.
                </Typography>
              )}
            </Box>

            {threadStatus && threadStatus.message ? (
              <Box sx={{ px: { xs: 2, md: 3 }, pt: 2 }}>
                <Alert severity={threadStatus.type}>{threadStatus.message}</Alert>
              </Box>
            ) : null}

            <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 3 }, py: 2 }}>
              {isLoadingThread ? (
                <Stack
                  spacing={2}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ minHeight: 240, textAlign: 'center' }}
                >
                  <CircularProgress />
                  <Typography variant="body2" color="text.secondary">
                    Loading messages…
                  </Typography>
                </Stack>
              ) : threadDetail && threadDetail.messages?.length ? (
                threadDetail.messages.map((message) => {
                  const senderName =
                    message.sender?.displayName ||
                    message.sender?.username ||
                    message.sender?.id ||
                    'Unknown user';
                  const senderId = message.sender?.id || message.sender?._id || null;
                  const createdAtLabel =
                    message.createdAt &&
                    (formatFriendlyTimestamp(message.createdAt) ||
                      formatRelativeTime(message.createdAt));
                  return (
                    <Paper
                      key={message.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        mb: 2,
                        borderRadius: 3,
                        backgroundColor:
                          senderId && viewerId && senderId === viewerId
                            ? 'background.paper'
                            : 'background.default'
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2">{senderName}</Typography>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                          {message.body}
                        </Typography>
                        {createdAtLabel ? (
                          <Typography variant="caption" color="text.secondary">
                            {createdAtLabel}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Paper>
                  );
                })
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No messages yet. Start the conversation below.
                </Typography>
              )}
            </Box>

            <Divider />

            <Box
              component="form"
              onSubmit={handleSendMessage}
              sx={{ px: { xs: 2, md: 3 }, py: 2, borderTop: '1px solid', borderColor: 'divider' }}
            >
              {sendStatus ? (
                <Alert severity={sendStatus.type} sx={{ mb: 2 }}>
                  {sendStatus.message}
                </Alert>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
                <TextField
                  label="Message"
                  placeholder="Write your reply…"
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  disabled={!selectedThreadId || isSending}
                />
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SendIcon />}
                  disabled={!selectedThreadId || isSending || !messageDraft.trim()}
                >
                  {isSending ? 'Sending…' : 'Send'}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

export default DirectMessagesPage;
