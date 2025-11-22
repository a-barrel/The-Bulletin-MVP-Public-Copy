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
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { REPORT_OFFENSE_OPTIONS } from '../constants/reportOffenseOptions';
import './ReportContentDialog.css';
import { useTranslation } from 'react-i18next';

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
  context = '',
  selectedReasons = [],
  onToggleReason
}) {
  const { t } = useTranslation();
  const helperText = useMemo(() => {
    if (context) {
      return truncateSummary(context);
    }
    if (contentSummary) {
      return truncateSummary(contentSummary);
    }
    return '';
  }, [contentSummary, context]);

  const offenseOptions = useMemo(() => REPORT_OFFENSE_OPTIONS, []);

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth className="report-dialog">
      <DialogTitle className="report-title">{t('report.title')}</DialogTitle>

      <DialogContent dividers className="report-content">
        <Stack spacing={2} className="report-stack">
          {contentSummary ? (
            <Typography variant="body2" className="report-summary" component="div">
              <strong>{t('report.messageLabel')}</strong>
              <span className="report-summary-text">{truncateSummary(contentSummary)}</span>
            </Typography>
          ) : null}

          <div className="report-offense-section">
            <Typography variant="subtitle2" className="report-offense-title">
              {t('report.commonIssues')}
            </Typography>
            <FormGroup className="report-offense-group">
              {offenseOptions.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox
                      checked={selectedReasons.includes(option.value)}
                      onChange={(event) => onToggleReason?.(option.value, event.target.checked)}
                      disabled={submitting}
                    />
                  }
                  label={t(`report.offenses.${option.value}`, { defaultValue: option.label })}
                  className="report-offense-option"
                />
              ))}
            </FormGroup>
          </div>

          <TextField
            multiline
            minRows={3}
            maxRows={6}
            label={t('report.detailsLabel')}
            value={reason}
            onChange={(event) => onReasonChange?.(event.target.value)}
            disabled={submitting}
            placeholder={t('report.detailsPlaceholder')}
            helperText={helperText || t('report.helperDefault')}
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
          {t('report.cancel')}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          variant="contained"
          color="error"
          className="report-submit"
        >
          {submitting ? t('report.submitting') : t('report.submit')}
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
  context: PropTypes.string,
  selectedReasons: PropTypes.arrayOf(PropTypes.string),
  onToggleReason: PropTypes.func
};

export default ReportContentDialog;
