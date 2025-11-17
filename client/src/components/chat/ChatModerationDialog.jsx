import PropTypes from 'prop-types';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import { MODERATION_ACTION_OPTIONS, QUICK_MODERATION_ACTIONS } from '../../constants/moderationActions';

function ChatModerationDialog({
  open,
  context,
  hasAccess,
  actionStatus,
  form,
  onClose,
  onSubmit,
  onFieldChange,
  onSelectQuickAction,
  disableSubmit,
  isSubmitting
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={onSubmit}>
        <DialogTitle>Moderate {context?.displayName || 'user'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {context?.messagePreview ? (
              <Alert severity="info" variant="outlined">
                {context.messagePreview}
              </Alert>
            ) : null}

            {hasAccess === false ? (
              <Alert severity="warning">Moderator privileges required to perform actions.</Alert>
            ) : null}

            {actionStatus ? (
              <Alert severity={actionStatus.type}>{actionStatus.message}</Alert>
            ) : null}

            <Stack direction="row" flexWrap="wrap" gap={1}>
              {MODERATION_ACTION_OPTIONS.filter((option) =>
                QUICK_MODERATION_ACTIONS.includes(option.value)
              ).map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  color={form.type === option.value ? 'primary' : 'default'}
                  variant={form.type === option.value ? 'filled' : 'outlined'}
                  onClick={() => onSelectQuickAction(option.value)}
                  role="button"
                  aria-pressed={form.type === option.value}
                />
              ))}
            </Stack>

            <TextField
              select
              label="Moderation action"
              value={form.type}
              onChange={onFieldChange('type')}
              fullWidth
            >
              {MODERATION_ACTION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {form.type === 'mute' ? (
              <TextField
                label="Mute duration (minutes)"
                type="number"
                inputProps={{ min: 1, max: 1440, step: 5 }}
                value={form.durationMinutes}
                onChange={onFieldChange('durationMinutes')}
              />
            ) : null}

            <TextField
              label="Reason (optional)"
              value={form.reason}
              onChange={onFieldChange('reason')}
              multiline
              minRows={2}
              placeholder="Share context for other moderators."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={disableSubmit}>
            {isSubmitting ? 'Applying…' : 'Apply action'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

ChatModerationDialog.propTypes = {
  open: PropTypes.bool,
  context: PropTypes.shape({
    displayName: PropTypes.string,
    messagePreview: PropTypes.string
  }),
  hasAccess: PropTypes.bool,
  actionStatus: PropTypes.shape({
    type: PropTypes.string,
    message: PropTypes.string
  }),
  form: PropTypes.shape({
    type: PropTypes.string,
    reason: PropTypes.string,
    durationMinutes: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onFieldChange: PropTypes.func.isRequired,
  onSelectQuickAction: PropTypes.func.isRequired,
  disableSubmit: PropTypes.bool,
  isSubmitting: PropTypes.bool
};

ChatModerationDialog.defaultProps = {
  open: false,
  context: null,
  hasAccess: true,
  actionStatus: null,
  disableSubmit: false,
  isSubmitting: false
};

export default ChatModerationDialog;
