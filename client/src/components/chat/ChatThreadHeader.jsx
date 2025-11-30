import PropTypes from 'prop-types';
import Typography from '@mui/material/Typography';
import GlobalNavMenu from '../GlobalNavMenu';
import MainNavBackButton from '../MainNavBackButton';
import HeaderActionButtons from '../HeaderActionButtons';

function ChatThreadHeader({
  pageTitle,
  backAriaLabel,
  backScope,
  onBack,
  isOffline,
  unreadCount,
  onCreatePin,
  onNotifications,
  notificationsLabel
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
      <div className="chat-header-right">
        <HeaderActionButtons
          isOffline={isOffline}
          unreadCount={safeUnread}
          onCreatePin={onCreatePin}
          onOpenUpdates={onNotifications}
          notificationsLabel={notificationsLabel}
        />
      </div>
    </header>
  );
}

ChatThreadHeader.propTypes = {
  pageTitle: PropTypes.node,
  backAriaLabel: PropTypes.string,
  backScope: PropTypes.string,
  onBack: PropTypes.func,
  isOffline: PropTypes.bool,
  unreadCount: PropTypes.number,
  onCreatePin: PropTypes.func.isRequired,
  onNotifications: PropTypes.func.isRequired,
  notificationsLabel: PropTypes.string
};

ChatThreadHeader.defaultProps = {
  pageTitle: null,
  backAriaLabel: 'Back',
  backScope: 'core',
  onBack: undefined,
  isOffline: false,
  unreadCount: 0,
  notificationsLabel: 'View updates'
};

export default ChatThreadHeader;
