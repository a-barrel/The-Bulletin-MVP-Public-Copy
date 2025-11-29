import { memo } from 'react';

function ListLocationNotice({
  message,
  locationRequired,
  hasLocation,
  onRequestLocation,
  retryLabel,
  errorMessage
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="location-notice">
      <p>{message}</p>
      {locationRequired && !hasLocation ? (
        <button type="button" className="retry-location-button" onClick={onRequestLocation}>
          {retryLabel}
        </button>
      ) : null}
      {errorMessage ? (
        <p role="status" className="location-notice-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export default memo(ListLocationNotice);
