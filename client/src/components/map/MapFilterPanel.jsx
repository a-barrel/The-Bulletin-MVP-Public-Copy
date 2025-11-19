function MapFilterPanel({ open, onClose, filters }) {
  return (
    <div className={`map-filter-panel ${open ? 'is-open' : ''}`} role="group" aria-label="Pin visibility filters">
      <button type="button" className="map-filter-close" aria-label="Close filters" onClick={onClose}>
        Close ✕
      </button>
      {filters.map((filter) => (
        <label className="map-filter-toggle" key={filter.key}>
          <img src={filter.iconUrl} alt="" className="map-filter-icon" aria-hidden="true" />
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
      ))}
    </div>
  );
}

export default MapFilterPanel;
