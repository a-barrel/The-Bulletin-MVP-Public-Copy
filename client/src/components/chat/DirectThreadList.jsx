import PropTypes from 'prop-types';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

import {
  getParticipantDisplayName,
  getParticipantId,
  resolveAvatarSrc,
  resolveThreadParticipants
} from '../../utils/chatParticipants';
import normalizeObjectId from '../../utils/normalizeObjectId';
import { formatFriendlyTimestamp, formatRelativeTime } from '../../utils/dates';

function DirectThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  status,
  isLoading,
  onRefresh,
  canAccess,
  viewerId
}) {
  if (canAccess === false) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Direct messages are disabled for your account.
        </Typography>
      </Box>
    );
  }

  const safeThreads = Array.isArray(threads) ? threads : [];
  const threadCount = safeThreads.length;

  return (
    <>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1" fontWeight={700}>
            Direct messages
          </Typography>
          <Chip label={threadCount} size="small" color="secondary" variant="outlined" />
        </Stack>
        {typeof onRefresh === 'function' ? (
          <Tooltip title="Refresh conversations">
            <span>
              <IconButton onClick={onRefresh} disabled={isLoading}>
                {isLoading ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Box>

      {status && status.message ? (
        <Box sx={{ p: 2 }}>
          <Alert severity={status.type}>{status.message}</Alert>
        </Box>
      ) : null}

      {threadCount === 0 && !isLoading ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            You have no conversations yet. Start one from a profile page.
          </Typography>
        </Box>
      ) : null}

      <List dense sx={{ overflowY: 'auto', flexGrow: 1 }}>
        {safeThreads.map((thread) => {
          const isActive = thread.id === selectedThreadId;
          const participantsArray = Array.isArray(thread.participants) ? thread.participants : [];
          const otherParticipants = participantsArray.filter((participant) => {
            const id = getParticipantId(participant);
            if (!id) {
              return false;
            }
            if (!viewerId) {
              return true;
            }
            return id !== normalizeObjectId(viewerId);
          });
          const participantNames = otherParticipants.length
            ? otherParticipants
                .map((participant) => getParticipantDisplayName(participant) || 'Unknown user')
                .filter(Boolean)
            : resolveThreadParticipants(thread, viewerId);
          const displayName = participantNames.length ? participantNames.join(', ') : 'Direct message';
          const avatarParticipant = otherParticipants[0];
          const avatarSrc = resolveAvatarSrc(avatarParticipant);
          return (
            <ListItemButton
              key={thread.id}
              selected={isActive}
              onClick={() => onSelectThread(thread.id)}
              sx={{ alignItems: 'flex-start', py: 1.5 }}
            >
              <ListItemAvatar>
                <Avatar src={avatarSrc} alt={displayName} imgProps={{ referrerPolicy: 'no-referrer' }}>
                  {displayName.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="subtitle1" fontWeight={600}>
                    {displayName}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary">
                    {thread.lastMessageAt
                      ? formatFriendlyTimestamp(thread.lastMessageAt) ||
                        formatRelativeTime(thread.lastMessageAt) ||
                        ''
                      : `${thread.messageCount ?? 0} messages`}
                  </Typography>
                }
              />
            </ListItemButton>
          );
        })}
      </List>
    </>
  );
}

DirectThreadList.propTypes = {
  threads: PropTypes.arrayOf(PropTypes.object),
  selectedThreadId: PropTypes.string,
  onSelectThread: PropTypes.func.isRequired,
  status: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  isLoading: PropTypes.bool,
  onRefresh: PropTypes.func,
  canAccess: PropTypes.bool,
  viewerId: PropTypes.string
};

DirectThreadList.defaultProps = {
  threads: [],
  selectedThreadId: null,
  status: null,
  isLoading: false,
  onRefresh: undefined,
  canAccess: true,
  viewerId: null
};

export default DirectThreadList;
