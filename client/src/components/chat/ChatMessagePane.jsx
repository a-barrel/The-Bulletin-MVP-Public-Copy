import PropTypes from 'prop-types';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';
import SmsIcon from '@mui/icons-material/Sms';

function ChatMessagePane({
  mode,
  selectedRoom,
  messagesError,
  isLoadingMessages,
  uniqueMessagesCount,
  displayedRoomMessagesCount,
  roomMessageBubbles,
  onLoadMoreRoomMessages,
  directMessagesHasAccess,
  selectedDirectThreadId,
  dmThreadsCount,
  isLoadingDmThreads,
  directThreadStatus,
  isLoadingDirectThread,
  directMessageItemsCount,
  displayedDirectMessagesCount,
  directMessageBubbles,
  onLoadMoreDirectMessages
}) {
  if (mode === 'rooms') {
    if (!selectedRoom) {
      return (
        <Box className="no-room-selected-container">
          <SmsIcon color="primary" sx={{ fontSize: 48 }} />
          <Typography className="no-room-selected-title" variant="h6">
            Choose a chat room to start talking
          </Typography>
          <Typography className="no-room-selected-body" variant="body2">
            Pick a room from the selector in the header or create a new one.
          </Typography>
        </Box>
      );
    }
    if (messagesError) {
      return (
        <Alert severity="error" sx={{ mx: { xs: 2, md: 4 }, my: 2 }}>
          {messagesError}
        </Alert>
      );
    }
    if (isLoadingMessages && uniqueMessagesCount === 0) {
      return (
        <Box className="loading-msgs-container">
          <CircularProgress className="loading-msgs-circle" />
          <Typography className="loading-msgs-body" variant="body2">
            Loading messages…
          </Typography>
        </Box>
      );
    }
    if (uniqueMessagesCount === 0) {
      return (
        <Box className="empty-msgs-container">
          <Typography className="empty-msgs-title" variant="h6">
            No messages yet
          </Typography>
          <Typography className="empty-msgs-body" variant="body2">
            Start the conversation with everyone in this room.
          </Typography>
        </Box>
      );
    }
    return (
      <>
        {roomMessageBubbles}
        {uniqueMessagesCount > displayedRoomMessagesCount ? (
          <Box className="chat-load-more">
            <Button variant="outlined" size="small" onClick={onLoadMoreRoomMessages} disableRipple>
              Load older messages
            </Button>
          </Box>
        ) : null}
      </>
    );
  }

  // direct messages
  if (directMessagesHasAccess === false) {
    return (
      <Box className="disabled-dms-container">
        <Typography className="disabled-dms-body" variant="body2" color="text.secondary" align="center">
          Direct messages are disabled for your account.
        </Typography>
      </Box>
    );
  }
  if (!selectedDirectThreadId) {
    if (dmThreadsCount === 0 && !isLoadingDmThreads) {
      return (
        <Box className="no-dm-selected-container">
          <Typography className="no-dm-selected-title" variant="h6">
            Start a new conversation
          </Typography>
          <Typography className="no-dm-selected-body" variant="body2" color="text.secondary" align="center">
            Visit a profile and choose “Message user” to invite them to chat.
          </Typography>
        </Box>
      );
    }
    if (isLoadingDmThreads) {
      return (
        <Box className="loading-dms-container">
          <CircularProgress className="loading-dms-circle" />
          <Typography className="loading-dms-body" variant="body2">
            Loading messages…
          </Typography>
        </Box>
      );
    }
    return (
      <Box className="select-dms-container">
        <Typography className="select-dms-title" variant="h6">
          Select a direct message
        </Typography>
        <Typography className="select-dms-body" variant="body2">
          Open the channel picker above and choose a conversation.
        </Typography>
      </Box>
    );
  }
  if (directThreadStatus && directThreadStatus.message) {
    return (
      <Alert severity={directThreadStatus.type} sx={{ mx: { xs: 2, md: 4 }, my: 2 }}>
        {directThreadStatus.message}
      </Alert>
    );
  }
  if (isLoadingDirectThread && directMessageItemsCount === 0) {
    return (
      <Box className="loading-dms-container">
        <CircularProgress className="loading-dms-circle" />
        <Typography className="loading-dms-body" variant="body2">
          Loading messages…
        </Typography>
      </Box>
    );
  }
  if (directMessageItemsCount === 0) {
    return (
      <Box className="empty-dms-container">
        <Typography className="empty-dms-title" variant="h6">
          Start a new conversation
        </Typography>
        <Typography className="empty-dms-body" variant="body2" color="text.secondary" align="center">
          Visit a profile and choose “Message user” to invite them to chat.
        </Typography>
      </Box>
    );
  }
  return (
    <>
      {directMessageBubbles}
      {directMessageItemsCount > displayedDirectMessagesCount ? (
        <Box className="chat-load-more">
          <Button variant="outlined" size="small" onClick={onLoadMoreDirectMessages} disableRipple>
            Load older messages
          </Button>
        </Box>
      ) : null}
    </>
  );
}

ChatMessagePane.propTypes = {
  mode: PropTypes.oneOf(['rooms', 'direct']).isRequired,
  selectedRoom: PropTypes.object,
  messagesError: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  isLoadingMessages: PropTypes.bool,
  uniqueMessagesCount: PropTypes.number,
  displayedRoomMessagesCount: PropTypes.number,
  roomMessageBubbles: PropTypes.node,
  onLoadMoreRoomMessages: PropTypes.func,
  directMessagesHasAccess: PropTypes.bool,
  selectedDirectThreadId: PropTypes.string,
  dmThreadsCount: PropTypes.number,
  isLoadingDmThreads: PropTypes.bool,
  directThreadStatus: PropTypes.object,
  isLoadingDirectThread: PropTypes.bool,
  directMessageItemsCount: PropTypes.number,
  displayedDirectMessagesCount: PropTypes.number,
  directMessageBubbles: PropTypes.node,
  onLoadMoreDirectMessages: PropTypes.func
};

ChatMessagePane.defaultProps = {
  selectedRoom: null,
  messagesError: null,
  isLoadingMessages: false,
  uniqueMessagesCount: 0,
  displayedRoomMessagesCount: 0,
  roomMessageBubbles: null,
  onLoadMoreRoomMessages: undefined,
  directMessagesHasAccess: true,
  selectedDirectThreadId: null,
  dmThreadsCount: 0,
  isLoadingDmThreads: false,
  directThreadStatus: null,
  isLoadingDirectThread: false,
  directMessageItemsCount: 0,
  displayedDirectMessagesCount: 0,
  directMessageBubbles: null,
  onLoadMoreDirectMessages: undefined
};

export default ChatMessagePane;
