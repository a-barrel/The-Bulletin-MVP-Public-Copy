function normalizeCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function normalizeDate(input) {
  if (!input) {
    return null;
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function isSameDay(dateA, dateB = new Date()) {
  if (!dateA || !dateB) {
    return false;
  }
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

export function deriveSummaryAfterResolution(summary, options = {}) {
  if (!summary) {
    return summary;
  }

  const {
    previousStatus,
    nextStatus,
    previousResolvedAt,
    nextResolvedAt,
    now = new Date()
  } = options;

  const nextSummary = {
    pendingCount: normalizeCount(summary.pendingCount),
    resolvedTodayCount: normalizeCount(summary.resolvedTodayCount),
    dismissedCount: normalizeCount(summary.dismissedCount)
  };

  if (previousStatus && previousStatus !== nextStatus) {
    if (previousStatus === 'pending') {
      nextSummary.pendingCount = Math.max(0, nextSummary.pendingCount - 1);
    }
    if (previousStatus === 'dismissed') {
      nextSummary.dismissedCount = Math.max(0, nextSummary.dismissedCount - 1);
    }
    if (previousStatus === 'resolved') {
      const resolvedDate = normalizeDate(previousResolvedAt);
      if (resolvedDate && isSameDay(resolvedDate, now)) {
        nextSummary.resolvedTodayCount = Math.max(0, nextSummary.resolvedTodayCount - 1);
      }
    }
  }

  if (nextStatus === 'pending') {
    nextSummary.pendingCount += 1;
  }
  if (nextStatus === 'dismissed') {
    nextSummary.dismissedCount += 1;
  }
  if (nextStatus === 'resolved') {
    const resolvedDate = normalizeDate(nextResolvedAt);
    if (resolvedDate && isSameDay(resolvedDate, now)) {
      nextSummary.resolvedTodayCount += 1;
    }
  }

  return nextSummary;
}
