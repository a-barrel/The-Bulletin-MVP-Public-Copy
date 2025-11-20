import { useEffect, useRef, useState } from 'react';

function MapFilterPanel({
  collapsed,
  onToggleCollapse,
  filterGroups = []
}) {
  const groups =
    Array.isArray(filterGroups) && filterGroups.length > 0
      ? filterGroups
      : [
          {
            key: 'default',
            filters:
              Array.isArray(filterGroups) && filterGroups.length
                ? filterGroups.flatMap((group) => group.filters || [])
                : []
          }
        ];

  const scrollerRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef({ startY: 0, scrollTop: 0 });

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) {
      return undefined;
    }
    const updateHints = () => {
      const { scrollTop, scrollHeight, clientHeight } = node;
      setCanScrollUp(scrollTop > 4);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 4);
    };
    updateHints();
    node.addEventListener('scroll', updateHints);
    window.addEventListener('resize', updateHints);
    return () => {
      node.removeEventListener('scroll', updateHints);
      window.removeEventListener('resize', updateHints);
    };
  }, [filterGroups, collapsed]);

  useEffect(() => {
    if (!isDragging) {
      const node = scrollerRef.current;
      node?.classList.remove('dragging');
      return undefined;
    }
    const node = scrollerRef.current;
    if (!node) {
      setIsDragging(false);
      return undefined;
    }
    node.classList.add('dragging');
    const handleMouseMove = (event) => {
      const { startY, scrollTop } = dragStateRef.current;
      const delta = event.clientY - startY;
      node.scrollTop = scrollTop - delta;
    };
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleDragStart = (event) => {
    if (event.button !== 0 || collapsed) {
      return;
    }
    const node = scrollerRef.current;
    if (!node) {
      return;
    }
    dragStateRef.current = {
      startY: event.clientY,
      scrollTop: node.scrollTop
    };
    setIsDragging(true);
    event.preventDefault();
  };

  return (
    <div
      className={`map-filter-panel ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
      role="group"
      aria-label="Pin visibility filters"
    >
      <div className="map-filter-header">
        <span className="map-filter-title">Map filters</span>
        <div className="map-filter-header-actions">
          <button
            type="button"
            className="map-filter-collapse"
            aria-label={collapsed ? 'Expand filter panel' : 'Collapse filter panel'}
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
      </div>
      <div className={`map-filter-scroller-wrapper${collapsed ? ' is-collapsed' : ''}`}>
        <div
          className={`map-filter-scroller${collapsed ? ' is-collapsed' : ''}`}
          ref={scrollerRef}
          onMouseDown={handleDragStart}
        >
          {groups.map((group) => (
            <div className="map-filter-group" key={group.key}>
              {group.title ? <p className="map-filter-group-title">{group.title}</p> : null}
              {Array.isArray(group.filters)
                ? group.filters.map((filter) => (
                  <label className="map-filter-toggle" key={filter.key}>
                    <img
                      src={filter.iconUrl}
                      alt=""
                      className={`map-filter-icon ${filter.iconClassName || ''}`.trim()}
                      aria-hidden="true"
                    />
                      <span className="map-filter-label">{filter.label}</span>
                      <input
                        type="checkbox"
                        checked={filter.checked}
                        onChange={filter.onChange}
                        aria-label={filter.ariaLabel}
                        disabled={filter.disabled}
                      />
                      <span className="map-filter-slider" aria-hidden="true" />
                    </label>
                  ))
                : null}
            </div>
          ))}
        </div>
        {!collapsed && canScrollUp ? (
          <div className="map-filter-scroll-hint map-filter-scroll-hint--top">^^^</div>
        ) : null}
        {!collapsed && canScrollDown ? (
          <div className="map-filter-scroll-hint map-filter-scroll-hint--bottom">vvv</div>
        ) : null}
      </div>
    </div>
  );
}

export default MapFilterPanel;
