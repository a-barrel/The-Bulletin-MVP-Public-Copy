import { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  replace = true,
  scope = 'extended',
  ...buttonProps
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lastMainPath, lastCorePath } = useMainNavigationContext();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const fallbackTarget = useMemo(() => {
    if (typeof fallbackPath === 'string' && fallbackPath.startsWith('/')) {
      return fallbackPath;
    }
    return routes.map.base;
  }, [fallbackPath]);

  const trackedTarget = useMemo(() => {
    // Scope chooses whether we look at core nav (map/chat/list) or extended (includes bookmarks/updates).
    const trackedPath = scope === 'core' ? lastCorePath : lastMainPath;
    if (typeof trackedPath === 'string' && trackedPath.startsWith('/')) {
      return trackedPath;
    }
    return fallbackTarget;
  }, [fallbackTarget, lastCorePath, lastMainPath, scope]);

  const targetPath = useMemo(() => {
    // Never navigate to the same URL; if the tracked target matches, fall back to the backup path (default map).
    if (trackedTarget === currentPath) {
      return fallbackTarget === currentPath ? routes.map.base : fallbackTarget;
    }
    return trackedTarget;
  }, [currentPath, fallbackTarget, trackedTarget]);

  const handleClick = useCallback(() => {
    if (onNavigate) {
      onNavigate(targetPath);
      return;
    }
    navigate(targetPath, { replace });
  }, [navigate, onNavigate, replace, targetPath]);

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
