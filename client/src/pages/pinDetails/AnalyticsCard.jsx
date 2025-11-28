import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { ANALYTICS_SPARKLINE_HEIGHT, ANALYTICS_SPARKLINE_WIDTH, formatAnalyticsTimestamp } from './utils';

function AnalyticsCard({
  showAnalytics,
  analytics,
  analyticsLoading,
  analyticsError,
  analyticsTotals,
  analyticsMilestones,
  analyticsSparklinePoints,
  analyticsBuckets,
  maxAnalyticsBucketTotal
}) {
  if (!showAnalytics) {
    return null;
  }

  return (
    <div className="pin-analytics-card">
      <div className="pin-analytics-header">
        <div>
          <h3>Attendance Insights</h3>
          <p className="pin-analytics-subtitle">Host-only view of joins and leaves.</p>
        </div>
        <span className="pin-analytics-pill">{analyticsLoading ? 'Loading…' : 'Private'}</span>
      </div>
      {analyticsError ? (
        <div className="error-text">{analyticsError}</div>
      ) : analyticsLoading && !analytics ? (
        <div className="muted">Loading attendance data…</div>
      ) : !analytics ? (
        <div className="muted">No attendance activity yet.</div>
      ) : (
        <>
          <div className="pin-analytics-metrics">
            <div className="pin-analytics-metric">
              <span className="label">Current</span>
              <strong className="value">{analyticsTotals.current ?? '—'}</strong>
            </div>
            <div className="pin-analytics-metric">
              <span className="label">Joins</span>
              <strong className="value success">{analyticsTotals.joins ?? 0}</strong>
            </div>
            <div className="pin-analytics-metric">
              <span className="label">Leaves</span>
              <strong className="value muted-text">{analyticsTotals.leaves ?? 0}</strong>
            </div>
            <div className="pin-analytics-metric">
              <span className="label">Net</span>
              <strong className="value">{analyticsTotals.net ?? 0}</strong>
            </div>
            <div className="pin-analytics-metric">
              <span className="label">Limit</span>
              <strong className="value">{analyticsMilestones.participantLimit ?? '—'}</strong>
            </div>
            <div className="pin-analytics-metric">
              <span className="label">Last join</span>
              <span className="value tiny">{formatAnalyticsTimestamp(analyticsMilestones.lastJoinAt)}</span>
            </div>
          </div>
          {analyticsSparklinePoints ? (
            <div className="pin-analytics-sparkline-wrapper" aria-label="Attendance trend">
              <svg
                className="pin-analytics-sparkline"
                viewBox={`0 0 ${ANALYTICS_SPARKLINE_WIDTH} ${ANALYTICS_SPARKLINE_HEIGHT}`}
                role="img"
                aria-hidden="true"
              >
                <polyline points={analyticsSparklinePoints} />
              </svg>
              <div className="pin-analytics-axis">
                <span>First join</span>
                <span>Latest</span>
              </div>
            </div>
          ) : null}
          {analyticsBuckets.length ? (
            <div className="pin-analytics-buckets">
              {analyticsBuckets.map((bucket) => {
                const total = (bucket.join ?? 0) + (bucket.leave ?? 0);
                const height = maxAnalyticsBucketTotal > 0 ? Math.max(6, (total / maxAnalyticsBucketTotal) * 100) : 0;
                const label = new Date(`${bucket.bucket}:00`).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric'
                });
                return (
                  <div className="pin-analytics-bar" key={bucket.bucket}>
                    <div
                      className="pin-analytics-bar-fill"
                      style={{ height: `${height}%` }}
                      title={`${label}: +${bucket.join ?? 0} / -${bucket.leave ?? 0}`}
                    />
                    <span className="pin-analytics-bar-label">{bucket.join ?? 0}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

AnalyticsCard.propTypes = {
  showAnalytics: PropTypes.bool,
  analytics: PropTypes.object,
  analyticsLoading: PropTypes.bool,
  analyticsError: PropTypes.string,
  analyticsTotals: PropTypes.object,
  analyticsMilestones: PropTypes.object,
  analyticsSparklinePoints: PropTypes.string,
  analyticsBuckets: PropTypes.arrayOf(PropTypes.object),
  maxAnalyticsBucketTotal: PropTypes.number
};

AnalyticsCard.defaultProps = {
  showAnalytics: false,
  analytics: null,
  analyticsLoading: false,
  analyticsError: null,
  analyticsTotals: {},
  analyticsMilestones: {},
  analyticsSparklinePoints: null,
  analyticsBuckets: [],
  maxAnalyticsBucketTotal: 0
};

export default memo(AnalyticsCard);
