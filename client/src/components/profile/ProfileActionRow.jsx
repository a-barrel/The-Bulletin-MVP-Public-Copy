import BlockIcon from '@mui/icons-material/Block';
import FlagIcon from '@mui/icons-material/Flag';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import MessageIcon from '@mui/icons-material/Message';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

function ProfileActionRow({
  canManageBlock,
  isBlocked,
  isProcessingBlockAction,
  isFetchingProfile,
  onRequestBlock,
  onRequestUnblock,
  friendState = 'idle',
  showFriendAction,
  onFriendAction,
  friendActionDisabled = false,
  friendActionBusy = false,
  onMessage,
  messageDisabled = false,
  messageTooltip,
  onReport,
  reportDisabled = false,
  reportTooltip,
  isReporting = false
}) {
  const blockDisabled = isProcessingBlockAction || isFetchingProfile;
  const blockCursor = blockDisabled ? 'not-allowed' : 'pointer';

  const friendCursor = friendActionDisabled ? 'not-allowed' : 'pointer';

  let friendLabel = 'Add friend';
  let friendHelper = 'Send a friend request';
  let friendIconColor = 'text.secondary';
  let friendIconNode = (
    <PersonAddIcon sx={{ fontSize: 32, color: friendIconColor }} />
  );
  if (friendState === 'pending') {
    friendLabel = 'Cancel request';
    friendHelper = 'Request sent (tap to cancel)';
    friendIconColor = 'warning.main';
    friendIconNode = <PersonAddIcon sx={{ fontSize: 32, color: friendIconColor }} />;
  } else if (friendState === 'friends') {
    friendLabel = 'Remove friend';
    friendHelper = 'Already friends';
    friendIconColor = 'error.main';
    friendIconNode = (
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          border: '2px solid',
          borderColor: 'error.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <PersonIcon sx={{ fontSize: 26, color: 'success.main' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        gap: 2,
        width: '100%'
      }}
    >
      <Box
        className="section-content-box"
        onClick={messageDisabled ? undefined : onMessage}
        sx={{
          flex: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          cursor: messageDisabled ? 'not-allowed' : 'pointer',
          opacity: messageDisabled ? 0.6 : 1
        }}
        role="button"
        aria-disabled={messageDisabled ? 'true' : 'false'}
        title={messageTooltip}
      >
        <MessageIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          Message
        </Typography>
      </Box>

      <Box
        className="section-content-box"
        onClick={reportDisabled ? undefined : onReport}
        sx={{
          flex: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          cursor: reportDisabled ? 'not-allowed' : 'pointer',
          opacity: reportDisabled ? 0.6 : 1
        }}
        role="button"
        aria-disabled={reportDisabled ? 'true' : 'false'}
        title={reportTooltip}
      >
        {isReporting ? (
          <CircularProgress size={28} thickness={5} />
        ) : (
          <FlagIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
        )}
        <Typography variant="body2" color="text.secondary">
          Report
        </Typography>
      </Box>

      {canManageBlock ? (
        <Box
          className="section-content-box"
          onClick={isBlocked ? onRequestUnblock : onRequestBlock}
          sx={{
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            cursor: blockCursor,
            opacity: blockDisabled ? 0.6 : 1,
            pointerEvents: blockDisabled ? 'none' : undefined
          }}
        >
          {isBlocked ? (
            <HowToRegIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
          ) : (
            <BlockIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
          )}
          <Typography variant="body2" color="text.secondary">
            {isBlocked ? 'Unblock' : 'Block'}
          </Typography>
        </Box>
      ) : null}

      {showFriendAction ? (
        <Box
          className="section-content-box"
          onClick={friendActionDisabled ? undefined : onFriendAction}
          sx={{
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            cursor: friendCursor,
            opacity: friendActionDisabled ? 0.6 : 1,
            pointerEvents: friendActionDisabled ? 'none' : undefined
          }}
        >
          {friendActionBusy ? <CircularProgress size={28} thickness={5} /> : friendIconNode}
          <Typography variant="body2" color="text.secondary">
            {friendLabel}
          </Typography>
          <Typography variant="caption" color={friendState === 'friends' ? 'success.main' : friendState === 'pending' ? 'warning.main' : 'text.secondary'}>
            {friendHelper}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

export default ProfileActionRow;
