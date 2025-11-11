import PropTypes from 'prop-types';
import {
  Alert,
  Avatar,
  AvatarGroup,
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
  resolveAvatarSrc
} from '../../utils/chatParticipants';
import normalizeObjectId from '../../utils/normalizeObjectId';
import { formatFriendlyTimestamp, formatRelativeTime } from '../../utils/dates';
import FriendBadge from '../FriendBadge';

function DirectThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  status,
  isLoading,
  onRefresh,
  canAccess,
  viewerId,
  viewerUsername,
  viewerDisplayName
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
  const normalizedViewerId = normalizeObjectId(viewerId);
  const normalizedViewerUsername =
    typeof viewerUsername === 'string' && viewerUsername.trim()
      ? viewerUsername.trim().toLowerCase()
      : null;
  const normalizedViewerDisplayName =
    typeof viewerDisplayName === 'string' && viewerDisplayName.trim()
      ? viewerDisplayName.trim().toLowerCase()
      : null;

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

          const collectParticipantEntries = (sourceParticipants) => {
            const entries = [];
            const seen = new Set();

            sourceParticipants.forEach((participant) => {
              const id = getParticipantId(participant) || normalizeObjectId(participant);
              if (id && normalizedViewerId && id === normalizedViewerId) {
                return;
              }
              const name = getParticipantDisplayName(participant) || 'Unknown user';
              const normalizedName = name.trim().toLowerCase();
              if (normalizedViewerId && id && normalizedViewerId === id) {
                return;
              }
              if (!normalizedViewerId && normalizedViewerUsername && normalizedName === normalizedViewerUsername) {
                return;
              }
              if (!normalizedViewerId && normalizedViewerDisplayName && normalizedName === normalizedViewerDisplayName) {
                return;
              }
              const dedupeKey = id || normalizedName || name;
              if (dedupeKey && seen.has(dedupeKey)) {
                return;
              }
              if (dedupeKey) {
                seen.add(dedupeKey);
              }
              entries.push({ participant, id, name });
            });

            return entries;
          };

          let otherParticipantEntries = collectParticipantEntries(participantsArray);

          if (!otherParticipantEntries.length && participantsArray.length) {
            otherParticipantEntries = collectParticipantEntries(
              participantsArray.filter(Boolean)
            );
          }

          const displayNames = otherParticipantEntries.map((entry) => entry.name).filter(Boolean);
          const isGroupChat = otherParticipantEntries.length > 1;
          const displayName = displayNames.length
            ? isGroupChat
              ? `${displayNames.join(', ')} [Group Chat]`
              : displayNames[0]
            : 'Direct message';
          const avatarParticipants = isGroupChat
            ? otherParticipantEntries.map((entry) => entry.participant)
            : [otherParticipantEntries[0]?.participant];
          let avatarElements = avatarParticipants
            .map((participant, index) => {
              const src = resolveAvatarSrc(participant);
              const name = otherParticipantEntries[index]?.name || 'Participant';
              return (
                <Avatar
                  key={index === 0 ? otherParticipantEntries[index]?.id || index : `${index}-${otherParticipantEntries[index]?.id || index}`}
                  src={src}
                  alt={name}
                  imgProps={{ referrerPolicy: 'no-referrer' }}
                >
                  {name.charAt(0).toUpperCase()}
                </Avatar>
              );
            })
            .slice(0, Math.max(avatarParticipants.length, 1));

          if (!avatarElements.length) {
            avatarElements = [
              <Avatar key="placeholder" imgProps={{ referrerPolicy: 'no-referrer' }}>
                {displayName.charAt(0).toUpperCase()}
              </Avatar>
            ];
          }
          return (
            <ListItemButton
              key={thread.id}
              selected={isActive}
              onClick={() => onSelectThread(thread.id)}
              sx={{ alignItems: 'flex-start', py: 1.5 }}
            >
              <ListItemAvatar>
                {isGroupChat ? (
                  <AvatarGroup max={3} sx={{ justifyContent: 'flex-start' }}>
                    {avatarElements}
                  </AvatarGroup>
                ) : (
                  avatarElements[0]
                )}
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="subtitle1" fontWeight={600}>
                    {displayName}
                    {!isGroupChat && otherParticipantEntries[0]?.id ? (
                      <FriendBadge userId={otherParticipantEntries[0].id} size="0.85em" />
                    ) : null}
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
  viewerId: PropTypes.string,
  viewerUsername: PropTypes.string,
  viewerDisplayName: PropTypes.string
};

DirectThreadList.defaultProps = {
  threads: [],
  selectedThreadId: null,
  status: null,
  isLoading: false,
  onRefresh: undefined,
  canAccess: true,
  viewerId: null,
  viewerUsername: null,
  viewerDisplayName: null
};

export default DirectThreadList;
