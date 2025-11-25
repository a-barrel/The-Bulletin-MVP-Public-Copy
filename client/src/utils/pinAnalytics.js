export const resolveAnalyticsErrorMessage = (error) => {
  const status = error?.status;
  if (status === 403) {
    return 'You do not have permission to view attendance analytics.';
  }
  if (status === 'timeout' || error?.isTimeout || error?.name === 'AbortError') {
    return 'Loading attendance analytics timed out. Please try again.';
  }
  if (error?.isAuthError) {
    return error.message || 'Reconnect to view attendance analytics.';
  }
  return error?.message || 'Failed to load analytics';
};

export default resolveAnalyticsErrorMessage;
