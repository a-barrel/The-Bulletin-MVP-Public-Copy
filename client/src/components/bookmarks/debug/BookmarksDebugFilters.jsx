import { Button, Stack } from '@mui/material';

const FILTERS = [
  { label: 'All bookmarks', value: 'all' },
  { label: 'Events', value: 'event' },
  { label: 'Discussions', value: 'discussion' }
];

function BookmarksDebugFilters({
  activeType,
  onActiveTypeChange,
  totalCount,
  onRefresh,
  onExport,
  refreshDisabled,
  exportDisabled,
  isLoading,
  isExporting
}) {
  return (
    <Stack direction="row" spacing={0} alignItems="center" className="bookmarks-main-toolbar">
      <Stack direction="row" spacing={1} flexWrap="wrap" className="bookmarks-type-filters">
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter.value}
            className={`bookmark-type-chip${activeType === filter.value ? ' is-active' : ''}`}
            onClick={() => onActiveTypeChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" className="bookmarks-toolbar-actions">
        <span className="bookmarks-count">Saved pins: {totalCount}</span>
        <Button
          type="button"
          variant="outlined"
          size="small"
          onClick={onRefresh}
          disabled={refreshDisabled}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </Button>
        <Button
          type="button"
          variant="contained"
          size="small"
          onClick={onExport}
          disabled={exportDisabled}
        >
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </Stack>
    </Stack>
  );
}

export default BookmarksDebugFilters;
