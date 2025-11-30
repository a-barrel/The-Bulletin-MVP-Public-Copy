import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GlobalNavMenu from '../GlobalNavMenu';
import MainNavBackButton from '../MainNavBackButton';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownwardRounded';
import HeaderActionButtons from '../HeaderActionButtons';

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
  onCreatePin,
  isOffline,
  unreadCount,
  checkInBanner
}) {
  const safeUnread = Number.isFinite(unreadCount) ? unreadCount : 0;

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
      <HeaderActionButtons
        isOffline={isOffline}
        unreadCount={safeUnread}
        onCreatePin={onCreatePin}
        onOpenUpdates={onNotifications}
        notificationsLabel={notificationsLabel}
      />
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
  onCreatePin: PropTypes.func.isRequired,
  isOffline: PropTypes.bool,
  unreadCount: PropTypes.number,
  checkInBanner: PropTypes.node
};

ChatThreadHeader.defaultProps = {
  pageTitle: null,
  backAriaLabel: 'Back',
  backScope: 'core',
  onBack: undefined,
  isChannelDialogOpen: false,
  isOffline: false,
  unreadCount: 0,
  checkInBanner: null
};

export default ChatThreadHeader;
