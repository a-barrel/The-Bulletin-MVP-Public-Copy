import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GlobalNavMenu from '../GlobalNavMenu';
import MainNavBackButton from '../MainNavBackButton';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';

function ChatThreadHeader({
  pageTitle,
  backAriaLabel,
  backScope,
  onBack,
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
      <div className="chat-header-left">
        <MainNavBackButton
          className="chat-header-back"
          iconClassName="chat-header-back-icon"
          ariaLabel={backAriaLabel}
          scope={backScope}
          onNavigate={onBack}
        />
        <GlobalNavMenu
          className="chat-header-menu-nav"
          triggerClassName="gnm-trigger-btn"
          iconClassName="gnm-trigger-btn__icon"
        />
        {pageTitle ? (
          <Typography variant="h6" component="h2" className="chat-header-title">
            {pageTitle}
          </Typography>
        ) : null}
      </div>
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
  backAriaLabel: PropTypes.string,
  backScope: PropTypes.string,
  onBack: PropTypes.func,
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
  backAriaLabel: 'Back',
  backScope: 'core',
  onBack: undefined,
  isChannelDialogOpen: false,
  isOffline: false,
  notificationBadge: null,
  checkInBanner: null
};

export default ChatThreadHeader;
