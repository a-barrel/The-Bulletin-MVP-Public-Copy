import { useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert
} from '@mui/material';

const truncateSummary = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }
  return `${trimmed.slice(0, 117).trimEnd()}…`;
};

function ReportContentDialog({
  open,
  onClose,
  onSubmit,
  reason,
  onReasonChange,
  submitting = false,
  error = null,
  contentSummary = '',
  context = ''
}) {
  const helperText = useMemo(() => {
    if (context) {
      return truncateSummary(context);
    }
    if (contentSummary) {
      return truncateSummary(contentSummary);
    }
    return '';
  }, [contentSummary, context]);

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Report Content</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {contentSummary ? (
            <Typography variant="body2" color="text.secondary">
              {truncateSummary(contentSummary)}
            </Typography>
          ) : null}
          <TextField
            multiline
            minRows={3}
            maxRows={6}
            label="Tell us what happened"
            value={reason}
            onChange={(event) => onReasonChange?.(event.target.value)}
            disabled={submitting}
            placeholder="Optional: share additional details for moderators."
            helperText={helperText || 'Reports are anonymous. Our moderators review every submission.'}
          />
          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          variant="contained"
          color="error"
        >
          {submitting ? 'Sending…' : 'Submit report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

ReportContentDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onSubmit: PropTypes.func,
  reason: PropTypes.string,
  onReasonChange: PropTypes.func,
  submitting: PropTypes.bool,
  error: PropTypes.string,
  contentSummary: PropTypes.string,
  context: PropTypes.string
};

export default ReportContentDialog;
