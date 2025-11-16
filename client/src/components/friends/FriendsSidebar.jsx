import PropTypes from 'prop-types';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import FriendRequestIcon from '@mui/icons-material/PersonAddRounded';
import SearchIcon from '@mui/icons-material/Search';
import MessageFriendIcon from '@mui/icons-material/ChatBubbleRounded';
import RemoveFriendIcon from '@mui/icons-material/PersonRemoveRounded';
import ReportFriendIcon from '@mui/icons-material/FlagRounded';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { resolveAvatarSrc } from '../../utils/chatParticipants';

function FriendsSidebar({
  friends,
  friendHasAccess,
  isLoading,
  friendStatus,
  searchQuery,
  onSearchChange,
  onNavigateBack,
  notificationsLabel,
  notificationBadge,
  onOpenRequests,
  directMessagesHasAccess,
  isProcessingFriendAction,
  isCreatingDirectThread,
  onMessageFriend,
  onUnfriend,
  onReportFriend,
  isOverlay
}) {
  const displayFriends = Array.isArray(friends) ? friends : [];

  if (friendHasAccess === false) {
    return (
      <Box className="friends-page-text-container" sx={{ color: isOverlay ? 'inherit' : '#111' }}>
        <Typography className="friends-page-title-text" variant="h6">
          Friend access required
        </Typography>
        <Typography className="friends-page-body-text" variant="body2">
          You need additional privileges to view or manage friends.
        </Typography>
      </Box>
    );
  }

  if (isLoading && displayFriends.length === 0) {
    return (
      <Box className="friends-page-text-container" sx={{ color: isOverlay ? 'inherit' : '#111' }}>
        <CircularProgress className="loading-friends-circle" size={32} />
        <Typography className="friends-page-body-text" variant="body2">
          Loading friends…
        </Typography>
      </Box>
    );
  }

  const filteredFriends = displayFriends.filter((friend) => {
    const name = (friend.displayName || friend.username || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  return (
    <Box
      className="friends-list"
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        color: isOverlay ? 'inherit' : '#111'
      }}
    >
      <Box className="friends-list-header" sx={{ px: 2, py: 1.5 }}>
        <IconButton onClick={onNavigateBack} className="friends-list-back-btn">
          <ArrowBackIcon className="friend-header-back-icon" />
        </IconButton>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
          <Typography className="friends-list-title">Friends — {displayFriends.length}</Typography>
        </Stack>
        <Button
          className="friend-request-btn"
          type="button"
          aria-label={notificationsLabel}
          onClick={onOpenRequests}
          disabled={
            isLoading ||
            isProcessingFriendAction ||
            typeof onOpenRequests !== 'function'
          }
        >
          <FriendRequestIcon className="friend-request-icon" aria-hidden="true" />
          {notificationBadge ? (
            <span className="friend-request-icon-badge" aria-hidden="true">
              {notificationBadge}
            </span>
          ) : null}
        </Button>
      </Box>

      <Box className="friends-list-search-bar">
        <TextField
          className="friends-list-search-bar-input-container"
          fullWidth
          size="small"
          placeholder="Search friends..."
          value={searchQuery}
          onChange={(event) => {
            const next = event.target.value;
            if (next.length <= 30 && typeof onSearchChange === 'function') {
              onSearchChange(next);
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className="friends-search-icon" />
              </InputAdornment>
            )
          }}
        />
      </Box>

      {friendStatus && friendStatus.message ? (
        <Box sx={{ px: 2, py: 1.5 }}>
          <Alert severity={friendStatus.type || 'error'}>{friendStatus.message}</Alert>
        </Box>
      ) : null}

      {displayFriends.length === 0 && !isLoading ? (
        <Stack
          spacing={1.5}
          alignItems="center"
          justifyContent="center"
          sx={{ flexGrow: 1, py: 6, color: isOverlay ? 'inherit' : '#111' }}
        >
          <Typography variant="h6">No friends yet</Typography>
          <Typography variant="body2" align="center" sx={{ color: isOverlay ? 'inherit' : '#555' }}>
            Add some friends to start direct conversations and plan meetups.
          </Typography>
        </Stack>
      ) : null}

      {!isLoading && displayFriends.length > 0 && filteredFriends.length === 0 ? (
        <Typography className="friends-search-none-text">No friends match your search.</Typography>
      ) : null}

      {filteredFriends.length ? (
        <List dense sx={{ flexGrow: 1, overflowY: 'auto', px: { xs: 1, sm: 2 } }}>
          {filteredFriends.map((friend) => {
            const displayName = friend.displayName || friend.username || 'Friend';
            const secondaryLabel = friend.username ? `@${friend.username}` : '';
            const avatarSrc = resolveAvatarSrc(friend);
            const handleMessage = () => onMessageFriend?.(friend);
            const handleUnfriend = () => onUnfriend?.(friend);
            const handleReport = () => onReportFriend?.(friend);

            return (
              <ListItem
                className="friend-card"
                key={friend.id}
                sx={{
                  py: 1.5,
                  px: { xs: 1, sm: 0 },
                  gap: { xs: 1.5, sm: 2 },
                  color: isOverlay ? 'inherit' : '#111',
                  transition: 'background-color 0.2s ease',
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette.action.hover,
                    '& .friend-actions': {
                      opacity: 1,
                      visibility: 'visible'
                    }
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar
                    className="friends-list-friend-avatar"
                    src={avatarSrc}
                    alt={displayName}
                    imgProps={{ referrerPolicy: 'no-referrer' }}
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>

                <ListItemText
                  className="friends-list-name-container"
                  primary={
                    <Box className="friends-list-name-wrapper">
                      <Typography className="friends-list-display-name">{displayName}</Typography>
                      {secondaryLabel ? (
                        <Typography className="friends-list-user-name">{secondaryLabel}</Typography>
                      ) : null}
                    </Box>
                  }
                />

                <Box className="friend-actions-container">
                  <Box className="message-friend-container">
                    <IconButton
                      className="message-friend-icon"
                      onClick={handleMessage}
                      disabled={
                        directMessagesHasAccess === false ||
                        isProcessingFriendAction ||
                        isCreatingDirectThread
                      }
                      aria-label="Message friend"
                      size="small"
                    >
                      <MessageFriendIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box className="remove-friend-container">
                    <IconButton
                      className="remove-friend-icon"
                      onClick={handleUnfriend}
                      disabled={isProcessingFriendAction}
                      aria-label="Remove friend"
                      size="small"
                    >
                      <RemoveFriendIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Box className="report-friend-container">
                    <IconButton
                      className="report-friend-icon"
                      onClick={handleReport}
                      aria-label="Report friend"
                      size="small"
                    >
                      <ReportFriendIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </ListItem>
            );
          })}
        </List>
      ) : null}
    </Box>
  );
}

FriendsSidebar.propTypes = {
  friends: PropTypes.arrayOf(PropTypes.object),
  friendHasAccess: PropTypes.bool,
  isLoading: PropTypes.bool,
  friendStatus: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  searchQuery: PropTypes.string,
  onSearchChange: PropTypes.func,
  onNavigateBack: PropTypes.func,
  notificationsLabel: PropTypes.string.isRequired,
  notificationBadge: PropTypes.string,
  onOpenRequests: PropTypes.func,
  directMessagesHasAccess: PropTypes.bool,
  isProcessingFriendAction: PropTypes.bool,
  isCreatingDirectThread: PropTypes.bool,
  onMessageFriend: PropTypes.func,
  onUnfriend: PropTypes.func,
  onReportFriend: PropTypes.func,
  isOverlay: PropTypes.bool
};

FriendsSidebar.defaultProps = {
  friends: [],
  friendHasAccess: true,
  isLoading: false,
  friendStatus: null,
  searchQuery: '',
  onSearchChange: undefined,
  onNavigateBack: undefined,
  notificationBadge: null,
  onOpenRequests: undefined,
  directMessagesHasAccess: true,
  isProcessingFriendAction: false,
  isCreatingDirectThread: false,
  onMessageFriend: undefined,
  onUnfriend: undefined,
  onReportFriend: undefined,
  isOverlay: false
};

export default FriendsSidebar;
