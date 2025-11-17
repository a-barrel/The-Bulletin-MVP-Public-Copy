import { useCallback, useEffect, useState } from 'react';
import { createContentReport } from '../api/mongoDataApi';

export default function useProfileReporting({
  targetProfileId,
  displayName,
  isViewingSelf,
  isOffline
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedOffenses, setSelectedOffenses] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openDialog = useCallback(() => {
    if (!targetProfileId || isViewingSelf || isOffline) {
      return;
    }
    setReason('');
    setSelectedOffenses([]);
    setError(null);
    setDialogOpen(true);
  }, [isOffline, isViewingSelf, targetProfileId]);

  const closeDialog = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setDialogOpen(false);
    setReason('');
    setSelectedOffenses([]);
    setError(null);
  }, [isSubmitting]);

  const toggleOffense = useCallback((offense, checked) => {
    if (typeof offense !== 'string') {
      return;
    }
    setSelectedOffenses((prev) => {
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
    if (!targetProfileId || isViewingSelf || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createContentReport({
        contentType: 'user',
        contentId: targetProfileId,
        reason,
        context: displayName ? `Profile: ${displayName}` : 'Profile report',
        offenses: selectedOffenses
      });
      setDialogOpen(false);
      setReason('');
      setSelectedOffenses([]);
      setStatus({
        type: 'success',
        message: 'Thanks — your report was submitted.'
      });
    } catch (err) {
      setError(err?.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  }, [displayName, isSubmitting, isViewingSelf, reason, selectedOffenses, targetProfileId]);

  const dismissStatus = useCallback(() => {
    setStatus(null);
  }, []);

  useEffect(() => {
    if (!status || typeof window === 'undefined') {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      setStatus(null);
    }, 5000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  return {
    dialogOpen,
    openDialog,
    closeDialog,
    reason,
    setReason,
    selectedOffenses,
    toggleOffense,
    submitReport,
    isSubmitting,
    error,
    setError,
    status,
    dismissStatus
  };
}
