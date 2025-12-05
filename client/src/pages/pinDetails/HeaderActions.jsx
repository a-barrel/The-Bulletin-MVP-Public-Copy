import React, { memo } from 'react';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import PropTypes from 'prop-types';
import BookmarkButton from '../../components/BookmarkButton';
import GlobalNavMenu from '../../components/GlobalNavMenu';
import MainNavBackButton from '../../components/MainNavBackButton';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';

function HeaderActions({
  isOwnPin,
  isOffline,
  pin,
  isLoading,
  editDialogBusy,
  canDeletePin,
  handleOpenEditDialog,
  onDeletePin,
  pinFlagProps,
  onShare,
  onReportPin,
  shareBusy,
  bookmarked,
  bookmarkPending,
  isInteractionLocked,
  attending,
  onToggleBookmark,
  bookmarkError,
  deletePending
}) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="pin-header-nav">
          <MainNavBackButton className="back-button" iconClassName="back-arrow" aria-label="Go back" />
          <div className="pin-nav-menu">
            <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
          </div>
        </div>
      </div>

      <h2 className="header-title">{pinFlagProps?.pinTypeHeading}</h2>

      <div className="header-right">
        <div className="header-actions">
          {isOwnPin ? (
            <div className="edit-button-wrapper">
              <button
                className="edit-pin-button"
                type="button"
                onClick={handleOpenEditDialog}
                disabled={isOffline || !pin || isLoading || editDialogBusy}
                title={isOffline ? 'Reconnect to edit your pin' : 'Edit this pin'}
              >
                Edit
              </button>
            </div>
          ) : null}
          {canDeletePin ? (
            <div className="delete-button-wrapper">
              <button
                className="delete-pin-button"
                type="button"
                onClick={onDeletePin}
                disabled={
                  isOffline ||
                  !pin ||
                  deletePending ||
                  isLoading ||
                  editDialogBusy
                }
                title={isOffline ? 'Reconnect to delete pins' : 'Delete this pin'}
                aria-label="Delete pin"
              >
                {deletePending ? 'Deleting…' : 'DEL'}
              </button>
            </div>
          ) : null}
          {pinFlagProps?.allowFlag && !isOwnPin ? (
            <div className="flag-button-wrapper">
              <button
                className={`flag-pin-button${pinFlagProps.isFlagged ? ' flagged' : ''}`}
                type="button"
                onClick={pinFlagProps.onFlag}
                disabled={pinFlagProps.disabled}
                title={pinFlagProps.title}
              >
                {pinFlagProps.label}
              </button>
            </div>
          ) : null}
          {!isOwnPin ? (
            <div className="flag-button-wrapper">
              <button
                className="flag-pin-button"
                type="button"
                onClick={onReportPin}
                disabled={isOffline || !pin || isInteractionLocked}
                title={isOffline ? 'Reconnect to report this pin' : 'Report pin'}
                aria-label="Report pin"
              >
                <FlagOutlinedIcon fontSize="small" />
              </button>
            </div>
          ) : null}
          <div className="share-button-wrapper">
            <button
              className="share-button"
              type="button"
              onClick={onShare}
              disabled={isOffline || shareBusy || !pin}
              aria-label="Share this pin"
              aria-busy={shareBusy ? 'true' : 'false'}
              title={isOffline ? 'Reconnect to share pins' : 'Share pin link'}
            >
              <ShareOutlinedIcon fontSize="small" />
            </button>
          </div>
          <div className="bookmark-button-wrapper">
            <BookmarkButton
              bookmarked={bookmarked}
              pending={bookmarkPending}
              disabled={isOffline || !pin || isInteractionLocked}
              ownsPin={isOwnPin}
              attending={attending}
              onToggle={onToggleBookmark}
              disabledLabel={isOffline ? 'Reconnect to manage bookmarks' : undefined}
            />
            {bookmarkError ? <span className="error-text bookmark-error">{bookmarkError}</span> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

HeaderActions.propTypes = {
  isOwnPin: PropTypes.bool,
  isOffline: PropTypes.bool,
  pin: PropTypes.object,
  isLoading: PropTypes.bool,
  editDialogBusy: PropTypes.bool,
  canDeletePin: PropTypes.bool,
  handleOpenEditDialog: PropTypes.func.isRequired,
  onDeletePin: PropTypes.func,
  pinFlagProps: PropTypes.shape({
    allowFlag: PropTypes.bool,
    isFlagged: PropTypes.bool,
    onFlag: PropTypes.func,
    disabled: PropTypes.bool,
    title: PropTypes.string,
    label: PropTypes.string,
    pinTypeHeading: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
  }),
  onShare: PropTypes.func.isRequired,
  onReportPin: PropTypes.func,
  shareBusy: PropTypes.bool,
  bookmarked: PropTypes.bool,
  bookmarkPending: PropTypes.bool,
  isInteractionLocked: PropTypes.bool,
  attending: PropTypes.bool,
  onToggleBookmark: PropTypes.func.isRequired,
  bookmarkError: PropTypes.string,
  deletePending: PropTypes.bool
};

HeaderActions.defaultProps = {
  isOwnPin: false,
  isOffline: false,
  pin: null,
  isLoading: false,
  editDialogBusy: false,
  canDeletePin: false,
  pinFlagProps: null,
  onReportPin: undefined,
  shareBusy: false,
  bookmarked: false,
  bookmarkPending: false,
  isInteractionLocked: false,
  attending: false,
  bookmarkError: null,
  onDeletePin: undefined,
  deletePending: false
};

export default memo(HeaderActions);
