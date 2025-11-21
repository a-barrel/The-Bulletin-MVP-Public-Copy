import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import resolveProfileNavTarget from '../utils/profileNav';
import { routes } from '../routes';
import './ProfilePage.css';
import ProfileBlockDialog from '../components/profile/ProfileBlockDialog';
import ProfileEditForm from '../components/profile/ProfileEditForm';
import ProfileHero from '../components/profile/ProfileHero';
import ReportContentDialog from '../components/ReportContentDialog';
import GlobalNavMenu from '../components/GlobalNavMenu';
import useProfileDetail from '../hooks/useProfileDetail';
import useProfileFriendActions from '../hooks/useProfileFriendActions';
import useProfileReporting from '../hooks/useProfileReporting';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext';
const ProfileOverviewPanel = lazy(() => import('../components/profile/ProfileOverviewPanel'));
const ProfileModerationPanel = lazy(() => import('../components/profile/ProfileModerationPanel'));

/*
 * NOTE:
 * - This layout intentionally hides richer debug surfaces that still exist behind the scenes:
 *   • Moderation quick actions + trust-and-safety tooling
 *   • Raw profile JSON inspector + account timeline metadata
 *   • Preferences/notification summaries and provisioning audit trails
 *   • DM/report entry points with auto-logging hooks
 * - All underlying fetch/update logic (editing flows, block/unblock, moderation requests, etc.) lives in the profile hooks.
 */

export const pageConfig = {
  id: 'profile',
  label: 'Profile',
  icon: AccountCircleIcon,
  path: `${routes.profile.base}/:userId`,
  order: 91,
  showInNav: true,
  protected: true,
  resolveNavTarget: resolveProfileNavTarget
};

function PanelFallback({ label }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
      <CircularProgress size={18} thickness={5} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { isOffline } = useNetworkStatusContext();

  const {
    originPath,
    effectiveUser,
    displayName,
    avatarUrl,
    bannerUrl,
    hasProfile,
    bioText,
    badgeList,
    mutualFriendCount,
    mutualFriendPreview,
    statsVisible,
    statsEntries,
    accountTimeline,
    isFetchingProfile,
    fetchError,
    relationshipStatus,
    setRelationshipStatus,
    isEditing,
    formState,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleBannerFileChange,
    handleClearAvatar,
    handleClearBanner,
    handleFieldChange,
    handleThemeChange,
    handleSaveProfile,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    editingAvatarSrc,
    editingBannerSrc,
    canEditProfile,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    blockDialogMode,
    isProcessingBlockAction,
    canManageBlock,
    isBlocked,
    isViewingSelf,
    targetProfileId,
    viewerProfile,
    setViewerProfile,
    setFetchedUser
  } = useProfileDetail({
    userIdParam: userId,
    locationState: location.state ?? {},
    isOffline
  });

  const {
    isFriend,
    canSendFriendRequest,
    friendState,
    friendActionBusy,
    handleFriendAction
  } = useProfileFriendActions({
    viewerProfile,
    setViewerProfile,
    effectiveUser,
    setFetchedUser,
    targetProfileId,
    isViewingSelf
  });

  const {
    dialogOpen: reportDialogOpen,
    openDialog: handleOpenReportProfile,
    closeDialog: handleCloseReportDialog,
    reason: reportReason,
    setReason: setReportReason,
    selectedOffenses: reportSelectedOffenses,
    toggleOffense: handleToggleReportOffense,
    submitReport: handleSubmitProfileReport,
    isSubmitting: isSubmittingReport,
    error: reportError,
    status: reportStatus,
    dismissStatus: handleReportStatusClose
  } = useProfileReporting({
    targetProfileId,
    displayName,
    isViewingSelf,
    isOffline
  });

  const statsLookup = useMemo(() => {
    const snapshot = new Map();
    (statsEntries || []).forEach(({ key, value }) => {
      const numericValue = typeof value === 'number' ? value : Number(value);
      snapshot.set(key, Number.isFinite(numericValue) ? numericValue : 0);
    });
    return snapshot;
  }, [statsEntries]);

  const postCount = statsLookup.get('posts') ?? 0;
  const eventsHosted = statsLookup.get('eventsHosted') ?? 0;
  const eventsAttended = statsLookup.get('eventsAttended') ?? 0;

  const joinedDisplay = accountTimeline?.createdAt ?? 'N/A';
  const avatarDisplaySrc = isEditing ? editingAvatarSrc ?? undefined : avatarUrl;
  const bannerDisplaySrc = isEditing ? editingBannerSrc : bannerUrl;

  const fetchErrorMessage =
    typeof fetchError === 'string' ? fetchError : fetchError?.message;
  const fetchErrorSeverity =
    fetchError?.severity || (fetchError?.isAuthError ? 'error' : 'warning');

  const handleBack = useCallback(() => {
    if (originPath) {
      navigate(originPath);
      return;
    }
    navigate(-1);
  }, [navigate, originPath]);

  const handleOpenMutualFriend = useCallback(
    (friendId) => {
      if (!friendId) {
        return;
      }
      const sanitized = String(friendId).trim();
      if (!sanitized) {
        return;
      }
      navigate(`${routes.profile.base}/${sanitized}`, { state: { from: location.pathname } });
    },
    [navigate, location.pathname]
  );

  const targetDmPermission =
    typeof effectiveUser?.preferences?.dmPermission === 'string'
      ? effectiveUser.preferences.dmPermission
      : 'everyone';
  const dmPermissionBlocked = !isViewingSelf
    ? targetDmPermission === 'nobody'
      ? 'This user is not accepting direct messages right now.'
      : targetDmPermission === 'friends' && !isFriend
      ? 'Only friends can send messages to this user.'
      : null
    : null;

  const handleMessageUser = useCallback(() => {
    if (!targetProfileId || isViewingSelf || isOffline || dmPermissionBlocked) {
      return;
    }
    navigate(routes.directMessages.base, {
      state: {
        fromProfile: true,
        targetUserId: targetProfileId,
        displayName
      }
    });
  }, [displayName, dmPermissionBlocked, isOffline, isViewingSelf, navigate, targetProfileId]);

  const canInteractWithProfile = Boolean(targetProfileId && !isViewingSelf);
  const messageDisabled = !canInteractWithProfile || isOffline || Boolean(dmPermissionBlocked);
  const reportDisabled = !canInteractWithProfile || isOffline || isSubmittingReport;

  const messageTooltip = messageDisabled
    ? dmPermissionBlocked
      ? dmPermissionBlocked
      : isViewingSelf
      ? 'You cannot message yourself.'
      : isOffline
      ? 'Reconnect to send messages.'
      : !targetProfileId
      ? 'User unavailable.'
      : undefined
    : undefined;

  const reportTooltip = reportDisabled
    ? isViewingSelf
      ? 'You cannot report your own profile.'
      : isOffline
      ? 'Reconnect to submit reports.'
      : !targetProfileId
      ? 'User unavailable.'
      : isSubmittingReport
      ? 'Submitting report...'
      : undefined
    : undefined;

  const friendActionDisabled =
    isViewingSelf ||
    isOffline ||
    !targetProfileId ||
    isFetchingProfile ||
    (friendState === 'idle' && !canSendFriendRequest);

  const actionRowProps = useMemo(
    () => ({
      canManageBlock,
      isBlocked,
      isProcessingBlockAction,
      isFetchingProfile,
      onRequestBlock: handleRequestBlock,
      onRequestUnblock: handleRequestUnblock,
      showFriendAction: !isViewingSelf,
      friendState,
      onFriendAction: handleFriendAction,
      friendActionDisabled,
      friendActionBusy,
      onMessage: handleMessageUser,
      messageDisabled,
      messageTooltip,
      onReport: handleOpenReportProfile,
      reportDisabled,
      reportTooltip,
      isReporting: isSubmittingReport
    }),
    [
      canManageBlock,
      handleOpenReportProfile,
      handleMessageUser,
      handleRequestBlock,
      handleRequestUnblock,
      friendActionBusy,
      friendActionDisabled,
      handleFriendAction,
      friendState,
      isBlocked,
      isFetchingProfile,
      isProcessingBlockAction,
      isSubmittingReport,
      isViewingSelf,
      dmPermissionBlocked,
      messageDisabled,
      messageTooltip,
      reportDisabled,
      reportTooltip
    ]
  );

  return (
    <div className="profile-page-container">
      <div className="back-nav-bar profile-back-nav">
        <button
          type="button"
          className="back-button"
          aria-label="Go back to previous page"
          onClick={handleBack}
        >
          <ArrowBackIcon className="back-button__icon" />
        </button>
        <div className="profile-nav-menu">
          <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
        </div>
        {canEditProfile && !isEditing ? (
          <Button
            variant="contained"
            onClick={handleBeginEditing}
            disabled={!effectiveUser || isFetchingProfile}
            className="profile-edit-button"
            sx={{ marginLeft: 'auto' }}
          >
            Edit profile
          </Button>
        ) : null}
      </div>

      <div className="profile-page-frame">
        <Stack spacing={3}>
          {isFetchingProfile ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2" color="text.secondary">
                Loading profile data...
              </Typography>
            </Stack>
          ) : null}

          {fetchErrorMessage ? (
            <Alert severity={fetchErrorSeverity} variant="outlined">
              {fetchErrorMessage}
            </Alert>
          ) : null}

          {relationshipStatus ? (
            <Alert severity={relationshipStatus.type} onClose={() => setRelationshipStatus(null)}>
              {relationshipStatus.message}
            </Alert>
          ) : null}
          {reportStatus ? (
            <Alert severity={reportStatus.type} onClose={handleReportStatusClose}>
              {reportStatus.message}
            </Alert>
          ) : null}

          <ProfileHero
            avatarSrc={avatarDisplaySrc ?? undefined}
            bannerSrc={bannerDisplaySrc}
            displayName={displayName}
            joinedDisplay={joinedDisplay}
            showEmptyState={!hasProfile && !isFetchingProfile && !fetchError}
            userId={effectiveUser?._id ?? effectiveUser?.id ?? null}
          />

          {canEditProfile && isEditing ? (
            <ProfileEditForm
              displayName={displayName}
              formState={formState}
              isSaving={isSavingProfile}
              editingAvatarSrc={editingAvatarSrc || avatarUrl}
              editingBannerSrc={editingBannerSrc}
              updateStatus={updateStatus}
              onDismissUpdateStatus={() => setUpdateStatus(null)}
              onSubmit={handleSaveProfile}
              onCancel={handleCancelEditing}
              onAvatarFileChange={handleAvatarFileChange}
              onBannerFileChange={handleBannerFileChange}
              onClearAvatar={handleClearAvatar}
              onClearBanner={handleClearBanner}
              onFieldChange={handleFieldChange}
              onThemeChange={handleThemeChange}
            />
          ) : null}

          {hasProfile ? (
            <>
              <Suspense fallback={<PanelFallback label="Loading profile details..." />}>
                <ProfileOverviewPanel
                  statsVisible={statsVisible}
                  postCount={postCount}
                  eventsHosted={eventsHosted}
                  eventsAttended={eventsAttended}
                  showMutualFriends={!isViewingSelf}
                  mutualFriendCount={mutualFriendCount}
                  mutualFriendPreview={mutualFriendPreview}
                  onSelectFriend={handleOpenMutualFriend}
                  bioText={bioText}
                  badgeList={badgeList}
                  actionRowProps={actionRowProps}
                />
              </Suspense>
              <Suspense fallback={<PanelFallback label="Loading moderation tools..." />}>
                <ProfileModerationPanel
                  targetUserId={targetProfileId}
                  displayName={displayName}
                  accountStatus={effectiveUser?.accountStatus}
                  isViewingSelf={isViewingSelf}
                />
              </Suspense>
            </>
          ) : null}
        </Stack>
      </div>

      <ProfileBlockDialog
        mode={blockDialogMode}
        onClose={handleCloseBlockDialog}
        onConfirm={handleConfirmBlockDialog}
        isProcessing={isProcessingBlockAction}
      />

      <ReportContentDialog
        open={reportDialogOpen}
        onClose={handleCloseReportDialog}
        onSubmit={handleSubmitProfileReport}
        reason={reportReason}
        onReasonChange={setReportReason}
        submitting={isSubmittingReport}
        error={reportError || undefined}
        context={displayName ? `Profile: ${displayName}` : ''}
        selectedReasons={reportSelectedOffenses}
        onToggleReason={handleToggleReportOffense}
      />
    </div>
  );
}

export default ProfilePage;
