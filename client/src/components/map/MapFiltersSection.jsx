import PropTypes from 'prop-types';
import { memo } from 'react';
import MapFilterPanel from './MapFilterPanel';

function MapFiltersSection({
  filterGroups,
  collapsed,
  onToggleCollapse,
  onResetFilters,
  onToggleAdvanced,
  advancedVisible,
  hasAdvancedFilters
}) {
  return (
    <aside className="map-filters">
      <MapFilterPanel
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        filterGroups={filterGroups}
        onResetFilters={onResetFilters}
        onToggleAdvanced={onToggleAdvanced}
        advancedVisible={advancedVisible}
        hasAdvancedFilters={hasAdvancedFilters}
      />
    </aside>
  );
}

MapFiltersSection.propTypes = {
  filterGroups: PropTypes.array.isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggleCollapse: PropTypes.func.isRequired,
  onResetFilters: PropTypes.func.isRequired,
  onToggleAdvanced: PropTypes.func,
  advancedVisible: PropTypes.bool,
  hasAdvancedFilters: PropTypes.bool
};

MapFiltersSection.defaultProps = {
  onToggleAdvanced: undefined,
  advancedVisible: false,
  hasAdvancedFilters: false
};

export default memo(MapFiltersSection);
