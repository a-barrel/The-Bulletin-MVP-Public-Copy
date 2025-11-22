import { Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

const FILTERS = ['all', 'event', 'discussion'];

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
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={0} alignItems="center" className="bookmarks-main-toolbar">
      <Stack direction="row" spacing={1} flexWrap="wrap" className="bookmarks-type-filters">
        {FILTERS.map((filter) => (
          <button
            type="button"
            key={filter}
            className={`bookmark-type-chip${activeType === filter ? ' is-active' : ''}`}
            onClick={() => onActiveTypeChange(filter)}
          >
            {t(`debugBookmarks.filters.${filter}`)}
          </button>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" className="bookmarks-toolbar-actions">
        <span className="bookmarks-count">{t('debugBookmarks.countLabel', { count: totalCount })}</span>
        <Button
          type="button"
          variant="outlined"
          size="small"
          onClick={onRefresh}
          disabled={refreshDisabled}
        >
          {isLoading ? t('bookmarks.refreshing') : t('bookmarks.refresh')}
        </Button>
        <Button
          type="button"
          variant="contained"
          size="small"
          onClick={onExport}
          disabled={exportDisabled}
        >
          {isExporting ? t('bookmarks.exporting') : t('bookmarks.export')}
        </Button>
      </Stack>
    </Stack>
  );
}

export default BookmarksDebugFilters;
