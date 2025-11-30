import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Pagination from '@mui/material/Pagination';
import PaginationItem from '@mui/material/PaginationItem';
import SortToggle from '../SortToggle';
import settingsIcon from '../../assets/GearIcon.svg';
import addIcon from '../../assets/AddIcon.svg';

export default function ListTopbar({
  hasActiveFilters,
  filtersDialogOpen,
  onOpenFilters,
  sortByExpiration,
  onToggleSort,
  hideOwnPins,
  onToggleHideOwnPins,
  hideFullEvents,
  onToggleHideFullEvents,
  isSavingHideFullPreference,
  hideFullPreferenceError,
  totalResults,
  totalPages,
  currentPage,
  onPageChange,
  pageSize,
  paginationSx,
  isOffline
}) {
  const showTopPagination = totalResults > pageSize;

  return (
    <div className="topbar">
      <button
        className={`icon-btn ${hasActiveFilters ? 'active' : ''} ${filtersDialogOpen ? 'open' : ''}`.trim()}
        type="button"
        aria-label="Filter pins"
        aria-pressed={filtersDialogOpen}
        onClick={onOpenFilters}
        title={hasActiveFilters ? 'Filters applied. Click to adjust filters.' : 'Filter pins'}
      >
        <img src={settingsIcon} alt="Filters" />
      </button>

      <SortToggle sortByExpiration={sortByExpiration} onToggle={onToggleSort} />

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            color="secondary"
            checked={hideOwnPins}
            onChange={(event) => onToggleHideOwnPins(event.target.checked)}
            disableRipple
            sx={{
              color: 'var(--color-text-secondary)',
              '& .MuiSvgIcon-root': {
                stroke: 'var(--color-text-secondary)',
                strokeWidth: 1.4,
                borderRadius: '4px'
              },
              '&.Mui-checked': {
                color: 'var(--accent-strong)'
              }
            }}
          />
        }
        label="Hide my pins"
        className="topbar-hide-own"
      />
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            color="secondary"
            checked={hideFullEvents}
            onChange={(event) => onToggleHideFullEvents(event.target.checked)}
            disabled={isSavingHideFullPreference}
            disableRipple
            sx={{
              color: 'var(--color-text-secondary)',
              '& .MuiSvgIcon-root': {
                stroke: 'var(--color-text-secondary)',
                strokeWidth: 1.4,
                borderRadius: '4px'
              },
              '&.Mui-checked': {
                color: 'var(--accent-strong)'
              }
            }}
          />
        }
        label="Hide full events"
        className="topbar-hide-own"
        title={hideFullPreferenceError || undefined}
      />
      {showTopPagination ? (
        <div className="top-pagination">
          <Pagination
            count={totalPages}
            page={currentPage}
            size="small"
            shape="rounded"
            onChange={onPageChange}
            renderItem={(item) => <PaginationItem disableRipple {...item} />}
            sx={paginationSx}
          />
        </div>
      ) : null}
    </div>
  );
}
