import PropTypes from 'prop-types';
import useFriendBadge from '../hooks/useFriendBadge';
import { useFriendBadgePreference } from '../contexts/FriendBadgePreferenceContext';
import './FriendBadge.css';

function FriendBadge({ userId, label = 'Friend', size = '1.1em', className = '' }) {
  const { isFriend } = useFriendBadge(userId);
  const { enabled } = useFriendBadgePreference();

  if (!isFriend || enabled === false) {
    return null;
  }

  return (
    <span
      className={`friend-badge ${className}`.trim()}
      role="img"
      aria-label={label}
      title={label}
      style={{ fontSize: size }}
    >
      <svg
        width="1em"
        height="1em"
        viewBox="0 0 24 24"
        focusable="false"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="11" className="friend-badge__halo" />
        <circle cx="12" cy="12" r="9.5" className="friend-badge__face" />
        <circle cx="9" cy="10" r="1.5" className="friend-badge__eye" />
        <circle cx="15" cy="10" r="1.5" className="friend-badge__eye" />
        <path
          d="M8 14.75c1.35 2 2.95 3 4 3s2.65-1 4-3"
          className="friend-badge__smile"
        />
      </svg>
    </span>
  );
}

FriendBadge.propTypes = {
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  label: PropTypes.string,
  size: PropTypes.string,
  className: PropTypes.string
};

FriendBadge.defaultProps = {
  userId: null,
  label: 'Friend',
  size: '1.1em',
  className: ''
};

export default FriendBadge;
