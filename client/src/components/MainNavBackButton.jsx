import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { routes } from '../routes';
import { useMainNavigationContext } from '../contexts/MainNavigationContext';

export default function MainNavBackButton({
  className = 'back-button',
  iconClassName = 'back-arrow',
  ariaLabel = 'Go back',
  fallbackPath = routes.map.base,
  children,
  type = 'button',
  disabled = false,
  onNavigate,
  ...buttonProps
}) {
  const navigate = useNavigate();
  const { lastMainPath } = useMainNavigationContext();

  const targetPath = useMemo(() => {
    if (typeof lastMainPath === 'string' && lastMainPath.startsWith('/')) {
      return lastMainPath;
    }
    if (typeof fallbackPath === 'string' && fallbackPath.startsWith('/')) {
      return fallbackPath;
    }
    return routes.map.base;
  }, [fallbackPath, lastMainPath]);

  const handleClick = useCallback(() => {
    if (onNavigate) {
      onNavigate(targetPath);
    } else {
      navigate(targetPath);
    }
  }, [navigate, onNavigate, targetPath]);

  return (
    <button
      type={type}
      className={className}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      {...buttonProps}
    >
      <ArrowBackIosNewIcon className={iconClassName} aria-hidden="true" />
      {children}
    </button>
  );
}
