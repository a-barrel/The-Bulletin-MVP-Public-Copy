import { useCallback, useState } from 'react';
import { submitAnonymousFeedback } from '../../api';

export default function useFeedbackForm() {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackError, setFeedbackError] = useState(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null);

  const handleFeedbackMessageChange = useCallback((event) => {
    setFeedbackMessage(event.target.value);
  }, []);

  const handleFeedbackContactChange = useCallback((event) => {
    setFeedbackContact(event.target.value);
  }, []);

  const handleClearFeedbackError = useCallback(() => setFeedbackError(null), []);

  const handleOpenFeedbackDialog = useCallback(() => {
    setFeedbackDialogOpen(true);
    setFeedbackMessage('');
    setFeedbackContact('');
    setFeedbackError(null);
  }, []);

  const handleCloseFeedbackDialog = useCallback(() => {
    if (isSubmittingFeedback) {
      return;
    }
    setFeedbackDialogOpen(false);
    setFeedbackMessage('');
    setFeedbackContact('');
    setFeedbackError(null);
  }, [isSubmittingFeedback]);

  const handleSubmitFeedback = useCallback(async () => {
    const trimmedMessage = feedbackMessage.trim();
    if (trimmedMessage.length < 10) {
      setFeedbackError('Please share at least 10 characters.');
      return;
    }
    if (isSubmittingFeedback) {
      return;
    }
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await submitAnonymousFeedback({
        message: trimmedMessage,
        contact: feedbackContact.trim() || undefined,
        category: 'settings-feedback'
      });
      setFeedbackStatus({
        type: 'success',
        message: 'Thanks for the feedback! We received it safely.'
      });
      setFeedbackDialogOpen(false);
      setFeedbackMessage('');
      setFeedbackContact('');
    } catch (error) {
      setFeedbackError(error?.message || 'Failed to send feedback. Please try again later.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }, [feedbackContact, feedbackMessage, isSubmittingFeedback]);

  const handleFeedbackStatusClose = useCallback(() => {
    setFeedbackStatus(null);
  }, []);

  return {
    feedbackDialogOpen,
    feedbackMessage,
    feedbackContact,
    feedbackError,
    isSubmittingFeedback,
    feedbackStatus,
    handleFeedbackMessageChange,
    handleFeedbackContactChange,
    handleClearFeedbackError,
    handleOpenFeedbackDialog,
    handleCloseFeedbackDialog,
    handleSubmitFeedback,
    handleFeedbackStatusClose,
    setFeedbackStatus
  };
}
