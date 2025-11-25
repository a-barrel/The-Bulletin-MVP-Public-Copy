import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GlobalNavMenu from '../GlobalNavMenu';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';

function ChatThreadHeader({
  pageTitle,
  channelLabel,
  isChannelDialogOpen,
  onOpenChannelDialog,
  notificationsLabel,
  onNotifications,
  isOffline,
  notificationBadge,
  updatesIconSrc,
  checkInBanner
}) {
  return (
    <header className="chat-header-bar">
      <GlobalNavMenu className="chat-header-menu-nav" />
      {pageTitle ? (
        <Typography variant="h6" component="h2" className="chat-header-title">
          {pageTitle}
        </Typography>
      ) : null}
      <div className="chat-header-actions">
        <Button
          className={`switch-chat-btn ${isChannelDialogOpen ? 'open' : ''}`}
          onClick={onOpenChannelDialog}
          endIcon={<ArrowDownwardIcon className="switch-chat-arrow" />}
        >
          {channelLabel}
        </Button>
        {checkInBanner}
      </div>
      <button
        className="updates-icon-btn"
        type="button"
        aria-label={notificationsLabel}
        onClick={onNotifications}
        disabled={isOffline}
        title={isOffline ? 'Reconnect to view updates' : undefined}
      >
        <img src={updatesIconSrc} alt="" className="updates-icon" aria-hidden="true" />
        {notificationBadge ? (
          <span className="updates-icon-badge" aria-hidden="true">
            {notificationBadge}
          </span>
        ) : null}
      </button>
    </header>
  );
}

ChatThreadHeader.propTypes = {
  pageTitle: PropTypes.node,
  channelLabel: PropTypes.string.isRequired,
  isChannelDialogOpen: PropTypes.bool,
  onOpenChannelDialog: PropTypes.func.isRequired,
  notificationsLabel: PropTypes.string.isRequired,
  onNotifications: PropTypes.func.isRequired,
  isOffline: PropTypes.bool,
  notificationBadge: PropTypes.string,
  updatesIconSrc: PropTypes.string.isRequired,
  checkInBanner: PropTypes.node
};

ChatThreadHeader.defaultProps = {
  pageTitle: null,
  isChannelDialogOpen: false,
  isOffline: false,
  notificationBadge: null,
  checkInBanner: null
};

export default ChatThreadHeader;
