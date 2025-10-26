import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import './BackButton.css';

export default function BackButton({
  className = '',
  buttonClassName = 'back-button',
  ariaLabel = 'Go back',
  children = 'Back',
  iconClassName = 'back-button__icon',
  onClick,
  fallbackPath = null
}) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get origin path from navigation state
  const originPath = typeof location.state?.from === 'string' ? location.state.from : null;

  const handleBack = useCallback(() => {
    // If custom onClick is provided, use it
    if (onClick) {
      onClick();
      return;
    }

    // Use origin path if available, otherwise fallback path, otherwise browser back
    if (originPath) {
      navigate(originPath);
    } else if (fallbackPath) {
      navigate(fallbackPath);
    } else {
      navigate(-1);
    }
  }, [navigate, originPath, fallbackPath, onClick]);

  return (
    <div className={`back-nav-bar ${className}`}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        onClick={handleBack}
      >
        <ArrowBackIcon className={iconClassName} />
        <span className="back-button__text">{children}</span>
      </button>
    </div>
  );
}
