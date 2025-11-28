import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Tabs,
  Tab
} from '@mui/material';
import GroupIcon from '@mui/icons-material/Group';
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import ChatRoomList from './ChatRoomList';
import DirectThreadList from './DirectThreadList';

function ChatChannelDialog({
  open,
  onClose,
  channelDialogTab,
  onTabChange,
  rooms,
  selectedRoomId,
  isLoadingRooms,
  roomsError,
  onRefreshRooms,
  onSelectRoom,
  dmThreads,
  selectedDirectThreadId,
  onSelectDirectThreadId,
  dmThreadsStatus,
  isLoadingDmThreads,
  refreshDmThreads,
  directMessagesHasAccess,
  directViewerId,
  dmViewer
}) {
  return (
    <Dialog
      className="channel-switch-overlay"
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      TransitionProps={{ timeout: { enter: 0, exit: 0 } }}
    >
      <Box className="channel-switch-header">
        <DialogTitle className="channel-switch-title">Choose a conversation</DialogTitle>

        <Button className="close-channel-switch-btn" onClick={onClose} disableRipple>
          <CloseIcon className="close-channel-switch-icon" />
        </Button>
      </Box>

      <DialogContent dividers sx={{ p: 0 }}>
        <Tabs
          className="channel-switch-tabs-background"
          value={channelDialogTab}
          onChange={onTabChange}
          variant="fullWidth"
          slotProps={{
            indicator: {
              className: 'channel-switch-tab-indicator'
            }
          }}
        >
          <Tab
            className="channel-switch-rooms-tab"
            value="rooms"
            disableRipple
            icon={<GroupIcon fontSize="small" />}
            iconPosition="start"
            label="Rooms"
          />

          <Tab
            className="channel-switch-dm-tab"
            value="direct"
            disableRipple
            icon={<MarkUnreadChatAltIcon fontSize="small" />}
            iconPosition="start"
            disabled={directMessagesHasAccess === false}
            label="Messages"
          />
        </Tabs>
        <Box sx={{ maxHeight: 420, display: 'flex', flexDirection: 'column' }}>
          {channelDialogTab === 'direct' ? (
            <DirectThreadList
              threads={dmThreads}
              selectedThreadId={selectedDirectThreadId}
              onSelectThread={onSelectDirectThreadId}
              status={dmThreadsStatus}
              isLoading={isLoadingDmThreads}
              onRefresh={refreshDmThreads}
              canAccess={directMessagesHasAccess !== false}
              viewerId={directViewerId}
              viewerUsername={dmViewer?.username || null}
              viewerDisplayName={dmViewer?.displayName || null}
            />
          ) : (
            <ChatRoomList
              rooms={rooms}
              selectedRoomId={selectedRoomId}
              isRefreshing={isLoadingRooms}
              error={roomsError}
              onRefresh={onRefreshRooms}
              onSelectRoom={onSelectRoom}
            />
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

ChatChannelDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  channelDialogTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  rooms: PropTypes.array.isRequired,
  selectedRoomId: PropTypes.string,
  isLoadingRooms: PropTypes.bool,
  roomsError: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onRefreshRooms: PropTypes.func.isRequired,
  onSelectRoom: PropTypes.func.isRequired,
  dmThreads: PropTypes.array.isRequired,
  selectedDirectThreadId: PropTypes.string,
  onSelectDirectThreadId: PropTypes.func.isRequired,
  dmThreadsStatus: PropTypes.object,
  isLoadingDmThreads: PropTypes.bool,
  refreshDmThreads: PropTypes.func.isRequired,
  directMessagesHasAccess: PropTypes.bool,
  directViewerId: PropTypes.string,
  dmViewer: PropTypes.shape({
    username: PropTypes.string,
    displayName: PropTypes.string
  })
};

ChatChannelDialog.defaultProps = {
  selectedRoomId: null,
  isLoadingRooms: false,
  roomsError: null,
  selectedDirectThreadId: null,
  dmThreadsStatus: null,
  isLoadingDmThreads: false,
  directMessagesHasAccess: true,
  directViewerId: null,
  dmViewer: null
};

export default ChatChannelDialog;
