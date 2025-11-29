import PropTypes from 'prop-types';
import React, { Suspense, lazy } from 'react';

const ChatSharePinModal = lazy(() => import('./ChatSharePinModal'));
const ChatModerationDialog = lazy(() => import('./ChatModerationDialog'));
const ReportContentDialog = lazy(() => import('../ReportContentDialog'));
const FriendRequestsDialog = lazy(() => import('../friends/FriendRequestsDialog'));

function ChatDialogs({
  shareModalContext,
  shareableBookmarks,
  onCloseSharePin,
  onSelectSharePin,
  reportDialogOpen,
  onCloseReportDialog,
  onSubmitReport,
  reportReason,
  onReportReasonChange,
  isSubmittingReport,
  reportError,
  reportTarget,
  reportSelectedOffenses,
  onToggleReportOffense,
  isFriendDialogOpen,
  onCloseFriendDialog,
  incomingRequests,
  friendActionStatus,
  respondingRequestId,
  onRespondFriendRequest,
  moderationContext,
  moderationHasAccess,
  moderationActionStatus,
  moderationForm,
  onCloseModerationDialog,
  onSubmitModeration,
  onModerationFieldChange,
  onSelectModerationQuickAction,
  disableModerationSubmit,
  isRecordingModerationAction
}) {
  return (
    <>
      {shareModalContext ? (
        <Suspense fallback={null}>
          <ChatSharePinModal
            open
            bookmarks={shareableBookmarks}
            onClose={onCloseSharePin}
            onSelect={onSelectSharePin}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        <ReportContentDialog
          open={reportDialogOpen}
          onClose={onCloseReportDialog}
          onSubmit={onSubmitReport}
          reason={reportReason}
          onReasonChange={onReportReasonChange}
          submitting={isSubmittingReport}
          error={reportError}
          contentSummary={reportTarget?.summary || ''}
          context={reportTarget?.context || ''}
          selectedReasons={reportSelectedOffenses}
          onToggleReason={onToggleReportOffense}
        />
      </Suspense>

      <Suspense fallback={null}>
        <FriendRequestsDialog
          open={isFriendDialogOpen}
          onClose={onCloseFriendDialog}
          requests={incomingRequests}
          actionStatus={friendActionStatus}
          respondingRequestId={respondingRequestId}
          onRespond={onRespondFriendRequest}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ChatModerationDialog
          open={Boolean(moderationContext)}
          context={moderationContext}
          hasAccess={moderationHasAccess}
          actionStatus={moderationActionStatus}
          form={moderationForm}
          onClose={onCloseModerationDialog}
          onSubmit={onSubmitModeration}
          onFieldChange={onModerationFieldChange}
          onSelectQuickAction={onSelectModerationQuickAction}
          disableSubmit={disableModerationSubmit}
          isSubmitting={isRecordingModerationAction}
        />
      </Suspense>
    </>
  );
}

ChatDialogs.propTypes = {
  shareModalContext: PropTypes.string,
  shareableBookmarks: PropTypes.array,
  onCloseSharePin: PropTypes.func.isRequired,
  onSelectSharePin: PropTypes.func.isRequired,
  reportDialogOpen: PropTypes.bool.isRequired,
  onCloseReportDialog: PropTypes.func.isRequired,
  onSubmitReport: PropTypes.func.isRequired,
  reportReason: PropTypes.string.isRequired,
  onReportReasonChange: PropTypes.func.isRequired,
  isSubmittingReport: PropTypes.bool.isRequired,
  reportError: PropTypes.string,
  reportTarget: PropTypes.object,
  reportSelectedOffenses: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleReportOffense: PropTypes.func.isRequired,
  isFriendDialogOpen: PropTypes.bool.isRequired,
  onCloseFriendDialog: PropTypes.func.isRequired,
  incomingRequests: PropTypes.array.isRequired,
  friendActionStatus: PropTypes.object,
  respondingRequestId: PropTypes.string,
  onRespondFriendRequest: PropTypes.func.isRequired,
  moderationContext: PropTypes.object,
  moderationHasAccess: PropTypes.bool,
  moderationActionStatus: PropTypes.object,
  moderationForm: PropTypes.object.isRequired,
  onCloseModerationDialog: PropTypes.func.isRequired,
  onSubmitModeration: PropTypes.func.isRequired,
  onModerationFieldChange: PropTypes.func.isRequired,
  onSelectModerationQuickAction: PropTypes.func.isRequired,
  disableModerationSubmit: PropTypes.bool.isRequired,
  isRecordingModerationAction: PropTypes.bool.isRequired
};

ChatDialogs.defaultProps = {
  shareModalContext: null,
  shareableBookmarks: [],
  reportError: null,
  reportTarget: null,
  friendActionStatus: null,
  respondingRequestId: null,
  moderationContext: null,
  moderationHasAccess: true,
  moderationActionStatus: null
};

export default ChatDialogs;
