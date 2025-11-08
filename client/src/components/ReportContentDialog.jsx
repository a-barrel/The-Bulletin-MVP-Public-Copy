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
import './ReportContentDialog.css';

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
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth className="report-dialog">
      <DialogTitle className="report-title">Report Content</DialogTitle>

      <DialogContent dividers className="report-content">
        <Stack spacing={2} className="report-stack">
          {contentSummary ? (
            <Typography variant="body2" className="report-summary">
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
            className="report-textfield"
          />

          {error ? (
            <Alert severity="error" variant="outlined" className="report-error">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions className="report-actions">
        <Button onClick={onClose} disabled={submitting} className="report-cancel">
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          variant="contained"
          color="error"
          className="report-submit"
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
