import React, { memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FriendRequestIcon from '@mui/icons-material/PersonAddRounded';
import MessageFriendIcon from '@mui/icons-material/ChatBubbleRounded';
import RemoveFriendIcon from '@mui/icons-material/PersonRemoveRounded';
import ReportFriendIcon from '@mui/icons-material/FlagRounded';
import SearchIcon from '@mui/icons-material/Search';

import { resolveAvatarSrc } from '../../utils/chatParticipants';

const FriendRow = memo(function FriendRow({
  friend,
  displayName,
  secondaryLabel,
  blockedStatusLabel,
  blockedTooltip,
  listItemDisabled,
  disableMessageAction,
  disableFriendActions,
  onOpenProfile,
  onMessageFriend,
  onRemoveFriend,
  onReportFriend
}) {
  const handleMessage = useCallback(() => {
    if (!disableMessageAction && !listItemDisabled) {
      onMessageFriend?.(friend);
    }
  }, [disableMessageAction, friend, listItemDisabled, onMessageFriend]);

  const handleRemove = useCallback(() => {
    if (!disableFriendActions) {
      onRemoveFriend?.(friend);
    }
  }, [disableFriendActions, friend, onRemoveFriend]);

  return (
    <ListItem
      className="friend-card"
      key={friend.id}
      sx={{
        py: 1.5,
        px: { xs: 1, sm: 0 },
        gap: { xs: 1.5, sm: 2 },
        transition: 'background-color 0.2s ease',
        opacity: listItemDisabled ? 0.6 : 1,
        '&:hover': {
          backgroundColor: (theme) => theme.palette.action.hover,
          '& .friend-actions': {
            opacity: 1,
            visibility: 'visible'
          }
        }
      }}
      aria-disabled={listItemDisabled ? 'true' : undefined}
      title={blockedTooltip || undefined}
    >
      <ListItemAvatar>
        <button
          type="button"
          className="friends-profile-trigger friends-profile-trigger--avatar"
          onClick={() => onOpenProfile(friend)}
          aria-label={`Open ${displayName}'s profile`}
          disabled={listItemDisabled}
        >
          <Avatar
            className="friends-list-friend-avatar"
            src={resolveAvatarSrc(friend)}
            alt={displayName}
            imgProps={{ referrerPolicy: 'no-referrer' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
        </button>
      </ListItemAvatar>

      <ListItemText
        className="friends-list-name-container"
        primary={
          <button
            type="button"
            className="friends-profile-trigger friends-profile-trigger--name"
            onClick={() => onOpenProfile(friend)}
            disabled={listItemDisabled}
          >
            <Box className="friends-list-name-wrapper">
              <Typography className="friends-list-display-name">{blockedStatusLabel}</Typography>
              {secondaryLabel ? (
                <Typography className="friends-list-user-name">{secondaryLabel}</Typography>
              ) : null}
            </Box>
          </button>
        }
      />

      <Box className="friend-actions-container">
        <Box className="message-friend-container">
          <button
            type="button"
            className={`friend-action-btn message-friend-btn${listItemDisabled ? ' disabled' : ''}`}
            onClick={handleMessage}
            aria-label={blockedTooltip || `Message ${displayName}`}
            disabled={disableMessageAction || listItemDisabled}
            title={blockedTooltip || `Message ${displayName}`}
          >
            <MessageFriendIcon className="message-friend-icon" aria-hidden="true" focusable="false" />
          </button>
        </Box>
        <Box className="remove-friend-container">
          <button
            type="button"
            className="friend-action-btn remove-friend-btn"
            onClick={handleRemove}
            aria-label={`Remove ${displayName}`}
            disabled={disableFriendActions}
            title={`Remove ${displayName}`}
          >
            <RemoveFriendIcon className="remove-friend-icon" aria-hidden="true" focusable="false" />
          </button>
        </Box>
        <Box className="report-friend-container">
          <button
            type="button"
            className="friend-action-btn report-friend-btn"
            onClick={() => onReportFriend?.(friend)}
            aria-label={`Report ${displayName}`}
            title={`Report ${displayName}`}
          >
            <ReportFriendIcon className="report-friend-icon" aria-hidden="true" focusable="false" />
          </button>
        </Box>
      </Box>
    </ListItem>
  );
});

function FriendsListPanel({
  friends,
  filteredFriends,
  searchQuery,
  onSearchChange,
  isLoading,
  friendStatus,
  hasAccess,
  onBack,
  notificationsLabel,
  requestBadge,
  onOpenFriendRequests,
  onMessageFriend,
  onRemoveFriend,
  onReportFriend,
  disableMessageAction,
  disableFriendActions
}) {
  const handleOpenProfile = useCallback((friend) => {
    if (!friend) {
      return;
    }
    if (typeof friend.onProfileClick === 'function') {
      friend.onProfileClick(friend);
      return;
    }
    const friendId = friend?.id || friend?._id;
    if (!friendId) {
      return;
    }
    window.location.assign(`/profile/${friendId}`);
  }, []);

  if (hasAccess === false) {
    return (
      <Box className="friends-page-text-container">
        <Typography className="friends-page-title-text" variant="h6">
          Friend access required
        </Typography>
        <Typography className="friends-page-body-text" variant="body2">
          You need additional privileges to view or manage friends.
        </Typography>
      </Box>
    );
  }

  const showInitialLoader = isLoading && friends.length === 0;

  return (
    <Box className="friends-list" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
      <Box className="friends-list-header" sx={{ px: 2, py: 1.5 }}>
        <IconButton onClick={onBack} className="friends-list-back-btn" aria-label="Go back" disableRipple>
          <ArrowBackIcon className="friend-header-back-icon" />
        </IconButton>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography className="friends-list-title">Friends — {friends.length}</Typography>
        </Stack>

        <Button
          className="friend-request-btn"
          type="button"
          aria-label={notificationsLabel}
          onClick={onOpenFriendRequests}
          disabled={disableFriendActions || isLoading}
          disableRipple
        >
          <FriendRequestIcon className="friend-request-icon" aria-hidden="true" />
          {requestBadge ? (
            <span className="friend-request-icon-badge" aria-hidden="true">
              {requestBadge}
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
          onChange={(event) => onSearchChange?.(event.target.value)}
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

      {showInitialLoader ? (
        <Box className="friends-page-text-container">
          <CircularProgress className="loading-friends-circle" />
          <Typography className="friends-page-body-text" variant="body2">
            Loading friends…
          </Typography>
        </Box>
      ) : null}

      {!isLoading && friends.length === 0 ? (
        <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ flexGrow: 1, py: 6 }}>
          <Typography variant="h6" sx={{ color: '#111' }}>
            No friends yet
          </Typography>
          <Typography variant="body2" align="center" sx={{ color: '#555' }}>
            Add some friends to start direct conversations and plan meetups.
          </Typography>
        </Stack>
      ) : null}

      {!isLoading && friends.length > 0 && filteredFriends.length === 0 ? (
        <Typography className="friends-search-none-text">No friends match your search.</Typography>
      ) : null}

      {filteredFriends.length ? (
        <Box component="div" role="list" sx={{ flexGrow: 1, overflowY: 'auto', px: { xs: 1, sm: 2 } }}>
          {filteredFriends.map((friend) => {
            const displayName = friend.displayName || friend.username || 'Friend';
            const secondaryLabel = friend.username ? `@${friend.username}` : '';
            const blockedByViewer = Boolean(friend?.isBlockedByViewer);
            const blockingViewer = Boolean(friend?.isBlockingViewer);
            const blockedStatusLabel = blockedByViewer
              ? `${displayName} (Blocked)`
              : blockingViewer
              ? `${displayName} (Blocked you)`
              : displayName;
            const blockedTooltip = blockedByViewer
              ? 'You blocked this friend. Unblock them from Settings to reconnect.'
              : blockingViewer
              ? 'This friend blocked you. Messaging is disabled.'
              : null;
            const listItemDisabled = Boolean(blockedTooltip);

            return (
              <FriendRow
                key={friend.id}
                friend={friend}
                displayName={displayName}
                secondaryLabel={secondaryLabel}
                blockedStatusLabel={blockedStatusLabel}
                blockedTooltip={blockedTooltip}
                listItemDisabled={listItemDisabled}
                disableMessageAction={disableMessageAction}
                disableFriendActions={disableFriendActions}
                onOpenProfile={handleOpenProfile}
                onMessageFriend={onMessageFriend}
                onRemoveFriend={onRemoveFriend}
                onReportFriend={onReportFriend}
              />
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

FriendsListPanel.propTypes = {
  friends: PropTypes.arrayOf(PropTypes.object).isRequired,
  filteredFriends: PropTypes.arrayOf(PropTypes.object).isRequired,
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  friendStatus: PropTypes.shape({
    message: PropTypes.string,
    type: PropTypes.string
  }),
  hasAccess: PropTypes.bool,
  onBack: PropTypes.func,
  notificationsLabel: PropTypes.string.isRequired,
  requestBadge: PropTypes.string,
  onOpenFriendRequests: PropTypes.func.isRequired,
  onMessageFriend: PropTypes.func.isRequired,
  onRemoveFriend: PropTypes.func.isRequired,
  onReportFriend: PropTypes.func.isRequired,
  disableMessageAction: PropTypes.bool,
  disableFriendActions: PropTypes.bool
};

FriendsListPanel.defaultProps = {
  friendStatus: null,
  hasAccess: true,
  onBack: undefined,
  requestBadge: null,
  disableMessageAction: false,
  disableFriendActions: false
};

export default FriendsListPanel;
