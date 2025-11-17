import React from 'react';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';

function BookmarkButton({
  bookmarked,
  locked = false,
  pending = false,
  disabled = false,
  ownsPin = false,
  attending = false,
  autoLockOwner = true,
  autoLockAttending = true,
  ownerLockLabel = 'Creators keep their pins bookmarked automatically.',
  attendeeLockLabel = 'Attendees keep these pins bookmarked automatically.',
  lockedLabel = 'This pin stays bookmarked for its creator',
  addLabel = 'Save bookmark',
  removeLabel = 'Remove bookmark',
  disabledLabel,
  tooltip,
  onToggle,
  className = '',
  variant = 'default',
  stopPropagation = false,
  type = 'button',
  ...rest
}) {
  const ownerLocked = autoLockOwner && ownsPin;
  const attendeeLocked = autoLockAttending && attending;
  const autoLocked = ownerLocked || attendeeLocked;
  const displayBookmarked = Boolean(bookmarked || autoLocked);
  const isLocked = Boolean(locked || autoLocked);
  const isDisabled = Boolean(disabled || pending || isLocked);

  const baseClassNames = ['bookmark-button'];
  if (isLocked) {
    baseClassNames.push('bookmark-button--locked');
  }
  if (ownerLocked) {
    baseClassNames.push('bookmark-button--owner');
  } else if (attendeeLocked) {
    baseClassNames.push('bookmark-button--attending');
  }
  if (displayBookmarked && !isLocked) {
    baseClassNames.push('bookmark-button--active');
  }
  if (variant && variant !== 'default') {
    baseClassNames.push(`bookmark-button--${variant}`);
  }
  if (className) {
    baseClassNames.push(className);
  }
  const buttonClassName = baseClassNames.join(' ');

  let lockMessage = lockedLabel;
  if (ownerLocked) {
    lockMessage = ownerLockLabel;
  } else if (attendeeLocked) {
    lockMessage = attendeeLockLabel;
  }

  const baseLabel = isLocked ? lockMessage : displayBookmarked ? removeLabel : addLabel;
  const computedLabel =
    tooltip || (!isLocked && isDisabled && disabledLabel ? disabledLabel : baseLabel);

  const handleClick = (event) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    if (isDisabled) {
      return;
    }
    if (typeof onToggle === 'function') {
      onToggle(event);
    }
  };

  return (
    <button
      type={type}
      className={buttonClassName}
      aria-pressed={displayBookmarked ? 'true' : 'false'}
      aria-busy={pending ? 'true' : undefined}
      aria-label={computedLabel}
      title={computedLabel}
      disabled={isDisabled}
      onClick={handleClick}
      {...rest}
    >
      {displayBookmarked ? (
        <BookmarkIcon
          className={`bookmark-icon${isLocked ? ' bookmark-icon--locked' : ''}`}
        />
      ) : (
        <BookmarkBorderIcon className="bookmark-icon" />
      )}
    </button>
  );
}

export default BookmarkButton;
