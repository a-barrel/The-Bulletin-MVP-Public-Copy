import { Box, Typography } from '@mui/material';
import { NavLink } from 'react-router-dom';
import AvatarIcon from '../assets/AvatarIcon.svg';
import "./MessageBubble.css";
import formatDate from '../utils/formatDate';



function MessageBubble({ msg, isSelf, authUser }) {
  return (
    <Box className={`chat-message ${isSelf ? 'self' : ''}`}>
      <Box className="chat-avatar">
        <NavLink to="/profile/me" className="nav-item">
          <img src={AvatarIcon} alt="Chat" className="profile-icon" />
        </NavLink>
      </Box>

      <Box className="chat-text-area">
        <div className="chat-text-area-header">
          <Typography className="chat-author">
            {msg.author?.displayName || 'User'}
          </Typography>
          <Typography className="chat-time">
            {formatDate(msg.createdAt)}
          </Typography>
        </div>
        <Typography className="chat-text">{msg.message}</Typography>
        {msg.imageUrl && <img src={msg.imageUrl} alt="attachment" className="chat-image" />}
      </Box>
    </Box>
  );
}

export default MessageBubble;
