import PropTypes from 'prop-types';
import { memo } from 'react';
import MapFilterPanel from './MapFilterPanel';

function MapFiltersSection({ filterGroups, collapsed, onToggleCollapse }) {
  return (
    <aside className="map-filters">
      <MapFilterPanel
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        filterGroups={filterGroups}
      />
    </aside>
  );
}

MapFiltersSection.propTypes = {
  filterGroups: PropTypes.array.isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired
};

export default memo(MapFiltersSection);
