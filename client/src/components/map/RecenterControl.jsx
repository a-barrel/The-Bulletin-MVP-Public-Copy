import { useCallback, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import './RecenterControl.css';

function RecenterControl({
  onRecenter,
  position,
  ariaLabel = 'Recenter map',
  tooltip,
  className = '',
  children,
  disabled = false
}) {
  const map = useMap();
  const label = ariaLabel || 'Recenter map';
  const tooltipContent = tooltip ?? label;

  const style = useMemo(() => {
    const defaults = { top: 'clamp(16px, 15vh, 120px)', left: '14px' };
    if (!position || typeof position !== 'object') {
      return defaults;
    }
    const { top, right, bottom, left } = position;
    return {
      top: top ?? defaults.top,
      right: right ?? undefined,
      bottom: bottom ?? undefined,
      left: left ?? (right ? undefined : defaults.left)
    };
  }, [position]);

  const handleClick = useCallback(() => {
    if (typeof onRecenter === 'function' && map) {
      onRecenter(map);
    }
  }, [map, onRecenter]);

  return (
    <button
      type="button"
      className={['map-recenter-control', className].filter(Boolean).join(' ')}
      style={style}
      aria-label={label}
      title={tooltipContent}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="map-recenter-control__icon">{children ?? '⊕'}</span>
      {tooltipContent ? (
        <span className="map-recenter-control__tooltip" role="tooltip">
          {tooltipContent}
        </span>
      ) : null}
    </button>
  );
}

export default RecenterControl;
