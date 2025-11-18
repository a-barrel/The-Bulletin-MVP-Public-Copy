import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCommentIcon from '@mui/icons-material/AddComment';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import RoomIcon from '@mui/icons-material/Room';
import PublicIcon from '@mui/icons-material/Public';

import './ChatRoomList.css'

function ChatRoomList({
  rooms,
  selectedRoomId,
  isRefreshing,
  error,
  onRefresh,
  onCreateRoom,
  onSelectRoom
}) {
  return (
    <Box className="room-list-container">
      <Box className="room-list-header">
        <Typography className="room-list-title">Select a room below</Typography>

        <Box className="room-list-header-action-btns">
          <IconButton
            onClick={onRefresh}
            disabled={isRefreshing}
            className="room-refresh-btn"
            aria-label="Refresh rooms"
          >
            {isRefreshing ? (
              <CircularProgress size={18} />
            ) : (
              <RefreshIcon sx={{ fontSize: 18, color: '#5C48A8' }} />
            )}
          </IconButton>

          <IconButton
            onClick={onCreateRoom}
            className="room-create-btn"
            aria-label="Create room"
          >
            <AddCommentIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {error ? (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : rooms.length === 0 ? (
        <Stack
          sx={{ flexGrow: 1, py: 6, alignItems: 'center', justifyContent: 'center' }}
          spacing={1}
        >
          <Typography variant="body2" color="text.secondary">
            {isRefreshing ? 'Loading rooms...' : 'No rooms yet. Create one to get started!'}
          </Typography>
        </Stack>
      ) : (
        <List className="room-list">
          {rooms.map((room) => {
            const isActive = room._id === selectedRoomId;
            const participantLabel = room.participantCount
              ? `${room.participantCount} members`
              : 'No members yet';

            return (
              <ListItemButton
                className="room-card"
                key={room._id}
                onClick={() => onSelectRoom(room._id)}
                selected={isActive}
                sx={{
                  transition: 'background-color 0.2s ease',
                  backgroundColor: isActive ? '#d9f2ffff !important' : 'white'
                }}
              >
                <ListItemText
                  primary={
                    <Box className="room-card-header">
                      <Box className="room-card-header-left">
                        <Typography className="room-card-room-title" variant="subtitle2">
                          {room.name}
                        </Typography>

                        <Chip
                          className="room-card-globality-chip"
                          label={room.isGlobal ? 'Global' : 'Local'}
                          size="small"
                        />
                      </Box>

                      <IconButton className="room-card-pin-icon" edge="end" size="small">
                        {room.isGlobal ? (
                          <PublicIcon sx={{ fontSize: 18 }} />
                        ) : (
                          <RoomIcon sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </Box>
                  }
                  secondary={
                    <span className="room-card-bottom">
                      <Typography
                        component="span"
                        className="room-card-member-count"
                        variant="caption"
                      >
                        {participantLabel}
                      </Typography>
                      {isActive && (
                        <Typography
                          component="span"
                          className="room-card-joined-label"
                          variant="caption"
                        >
                          Joined
                        </Typography>
                      )}
                    </span>
                  }
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}

ChatRoomList.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.object),
  selectedRoomId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isRefreshing: PropTypes.bool,
  error: PropTypes.string,
  onRefresh: PropTypes.func,
  onCreateRoom: PropTypes.func,
  onSelectRoom: PropTypes.func
};

ChatRoomList.defaultProps = {
  rooms: [],
  selectedRoomId: null,
  isRefreshing: false,
  error: null,
  onRefresh: undefined,
  onCreateRoom: undefined,
  onSelectRoom: undefined
};

export default ChatRoomList;
