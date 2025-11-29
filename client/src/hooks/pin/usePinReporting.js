import { useCallback, useState } from 'react';
import { createContentReport } from '../../api';
import reportClientError from '../../utils/reportClientError';

export default function usePinReporting() {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSelectedOffenses, setReportSelectedOffenses] = useState([]);
  const [reportError, setReportError] = useState(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState(null);

  const openReportDialog = useCallback((target) => {
    if (!target?.contentType || !target?.contentId) {
      setReportStatus({ type: 'error', message: 'Unable to report this content.' });
      return;
    }
    setReportTarget(target);
    setReportReason('');
    setReportSelectedOffenses([]);
    setReportError(null);
    setReportDialogOpen(true);
  }, []);

  const closeReportDialog = useCallback(() => {
    if (isSubmittingReport) {
      return;
    }
    setReportDialogOpen(false);
    setReportTarget(null);
    setReportReason('');
    setReportSelectedOffenses([]);
    setReportError(null);
  }, [isSubmittingReport]);

  const toggleReportOffense = useCallback((offense, checked) => {
    if (typeof offense !== 'string') {
      return;
    }
    setReportSelectedOffenses((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(offense);
      } else {
        next.delete(offense);
      }
      return Array.from(next);
    });
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportTarget?.contentType || !reportTarget?.contentId) {
      setReportError('Unable to submit this report.');
      return;
    }
    if (isSubmittingReport) {
      return;
    }
    setIsSubmittingReport(true);
    setReportError(null);
    try {
      await createContentReport({
        contentType: reportTarget.contentType,
        contentId: reportTarget.contentId,
        reason: reportReason.trim(),
        context: reportTarget.context || '',
        offenses: reportSelectedOffenses
      });
      setReportDialogOpen(false);
      setReportTarget(null);
      setReportReason('');
      setReportSelectedOffenses([]);
      setReportStatus({
        type: 'success',
        message: 'Thanks for the report. Our moderators will review it shortly.'
      });
    } catch (error) {
      setReportError(error?.message || 'Failed to submit report. Please try again later.');
      reportClientError(error, 'Failed to submit content report.', {
        component: 'PinDetails',
        contentType: reportTarget?.contentType,
        contentId: reportTarget?.contentId
      });
    } finally {
      setIsSubmittingReport(false);
    }
  }, [isSubmittingReport, reportReason, reportSelectedOffenses, reportTarget]);

  return {
    reportDialogOpen,
    reportTarget,
    reportReason,
    reportSelectedOffenses,
    reportError,
    isSubmittingReport,
    reportStatus,
    openReportDialog,
    closeReportDialog,
    toggleReportOffense,
    submitReport,
    setReportReason,
    setReportStatus
  };
}
