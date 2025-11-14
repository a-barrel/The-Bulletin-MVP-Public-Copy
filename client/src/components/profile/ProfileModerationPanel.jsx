import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import ProfileSection from './ProfileSection';
import useModerationTools from '../../hooks/useModerationTools';
import { formatFriendlyTimestamp } from '../../utils/dates';

const QUICK_ACTIONS = [
  {
    key: 'warn',
    label: 'Warn',
    type: 'warn',
    color: 'warning',
    helper: 'Send a gentle warning and log it.'
  },
  {
    key: 'mute15',
    label: 'Mute 15 min',
    type: 'mute',
    durationMinutes: 15,
    color: 'secondary',
    helper: 'Temporarily mute (15 minutes).'
  },
  {
    key: 'mute60',
    label: 'Mute 1 hr',
    type: 'mute',
    durationMinutes: 60,
    color: 'secondary',
    helper: 'Temporarily mute (60 minutes).'
  },
  {
    key: 'ban',
    label: 'Suspend',
    type: 'ban',
    color: 'error',
    helper: 'Suspend the user (sets status to suspended).'
  },
  {
    key: 'unban',
    label: 'Reinstate',
    type: 'unban',
    color: 'success',
    helper: 'Restore a previously suspended account.'
  }
];

const STATUS_COLOR = {
  suspended: 'error',
  banned: 'error',
  active: 'success'
};

function ProfileModerationPanel({ targetUserId, displayName, accountStatus, isViewingSelf }) {
  const [notes, setNotes] = useState('');
  const {
    hasAccess,
    isLoadingOverview,
    recordAction,
    isSubmitting,
    actionStatus,
    resetActionStatus,
    history,
    isLoadingHistory,
    selectUser
  } = useModerationTools();

  useEffect(() => {
    if (!targetUserId || isViewingSelf) {
      return;
    }
    selectUser(targetUserId);
  }, [isViewingSelf, selectUser, targetUserId]);

  useEffect(() => {
    if (!actionStatus) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      resetActionStatus();
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [actionStatus, resetActionStatus]);

  const accountChip = useMemo(() => {
    const normalized = typeof accountStatus === 'string' ? accountStatus.toLowerCase() : 'unknown';
    const chipColor = STATUS_COLOR[normalized] || 'default';
    return {
      label: `Status: ${normalized}`,
      color: chipColor
    };
  }, [accountStatus]);

  if (!targetUserId || isViewingSelf) {
    return null;
  }

  const disableActions =
    !hasAccess || isSubmitting || isLoadingOverview || hasAccess === false || !targetUserId;

  const handleQuickAction = async (preset) => {
    if (!targetUserId || disableActions) {
      return;
    }

    try {
      await recordAction({
        userId: targetUserId,
        type: preset.type,
        reason: notes.trim(),
        durationMinutes: preset.durationMinutes
      });
      setNotes('');
    } catch (error) {
      // handled via actionStatus inside useModerationTools
    }
  };

  const renderHistory = () => {
    if (isLoadingHistory) {
      return (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={16} thickness={5} />
          <Typography variant="body2" color="text.secondary">
            Loading history…
          </Typography>
        </Stack>
      );
    }

    const preview = Array.isArray(history) ? history.slice(0, 3) : [];
    if (!preview.length) {
      return (
        <Typography variant="body2" color="text.secondary">
          No prior moderation actions logged for this user.
        </Typography>
      );
    }

    return (
      <Stack spacing={1} className="profile-moderation-history">
        {preview.map((entry) => (
          <Box key={entry.id} className="profile-moderation-history__row">
            <Typography variant="subtitle2" className="profile-moderation-history__type">
              {entry.type}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {entry.reason ? entry.reason : <em>No reason provided.</em>}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFriendlyTimestamp(entry.createdAt, { fallback: 'Unknown time' })}
            </Typography>
          </Box>
        ))}
      </Stack>
    );
  };

  return (
    <ProfileSection
      title="Moderator tools"
      description="Only visible to staff/offline builds. Use responsibly—actions are logged."
    >
      <Stack spacing={2} className="profile-moderation-panel">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            label={accountChip.label}
            color={accountChip.color}
            size="small"
            className="profile-moderation-status-chip"
          />
          <Chip label={`User ID: ${targetUserId}`} size="small" variant="outlined" />
          {isLoadingOverview ? <CircularProgress size={16} thickness={5} /> : null}
        </Stack>

        {hasAccess === false ? (
          <Alert severity="info">
            Moderator privileges required. If you should have access, refresh after updating roles.
          </Alert>
        ) : (
          <>
            {actionStatus ? (
              <Alert severity={actionStatus.type || 'info'}>{actionStatus.message}</Alert>
            ) : null}

            <TextField
              label="Moderator notes (optional)"
              placeholder={`Add context for ${displayName}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              multiline
              minRows={2}
              size="small"
              className="profile-moderation-notes"
              fullWidth
            />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              className="profile-moderation-actions"
            >
              {QUICK_ACTIONS.map((action) => {
                const isBanDisabled = action.type === 'ban' && accountStatus === 'suspended';
                const isUnbanDisabled = action.type === 'unban' && accountStatus !== 'suspended';
                const disabled = disableActions || isBanDisabled || isUnbanDisabled;
                return (
                  <Tooltip key={action.key} title={action.helper} arrow>
                    <span>
                      <Button
                        variant="contained"
                        color={action.color}
                        disabled={disabled}
                        onClick={() => handleQuickAction(action)}
                      >
                        {action.label}
                      </Button>
                    </span>
                  </Tooltip>
                );
              })}
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="subtitle2">Recent moderation</Typography>
              {renderHistory()}
            </Stack>
          </>
        )}
      </Stack>
    </ProfileSection>
  );
}

ProfileModerationPanel.propTypes = {
  targetUserId: PropTypes.string,
  displayName: PropTypes.string,
  accountStatus: PropTypes.string,
  isViewingSelf: PropTypes.bool
};

export default ProfileModerationPanel;
