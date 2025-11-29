import { Alert, Box, Button, Chip, Stack } from '@mui/material';
import PropTypes from 'prop-types';

export default function BookmarksTopbar({
  totalCount,
  activeTab,
  onTabChange,
  onRefresh,
  onExport,
  isLoading,
  isExporting,
  isOffline,
  viewHistoryLength,
  onClearHistory,
  isClearingHistory,
  hideFullPreferenceError,
  onClearPreferenceError,
  expandAll,
  onToggleExpandAll
}) {
  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Chip
          label={`Bookmarks (${totalCount})`}
          variant={activeTab === 'bookmarks' ? 'filled' : 'outlined'}
          onClick={() => onTabChange('bookmarks')}
          disableRipple
          sx={{
            fontWeight: 600,
            backgroundColor: activeTab === 'bookmarks' ? '#5D3889' : 'rgba(93,56,137,0.1)',
            color: activeTab === 'bookmarks' ? '#fff' : '#5D3889',
            borderColor: '#5D3889'
          }}
        />
        <Chip
          label={`History (${viewHistoryLength})`}
          variant={activeTab === 'history' ? 'filled' : 'outlined'}
          onClick={() => onTabChange('history')}
          disableRipple
          sx={{
            fontWeight: 600,
            backgroundColor: activeTab === 'history' ? '#5D3889' : 'rgba(93,56,137,0.1)',
            color: activeTab === 'history' ? '#fff' : '#5D3889',
            borderColor: '#5D3889'
          }}
        />
        {activeTab === 'history' ? (
          <Button
            variant="text"
            color="secondary"
            onClick={onClearHistory}
            disabled={isClearingHistory || viewHistoryLength === 0 || isOffline}
            disableRipple
            sx={{ fontFamily: '"Urbanist", sans-serif' }}
          >
            {isClearingHistory ? 'Clearing…' : 'Clear history'}
          </Button>
        ) : null}
        {activeTab === 'bookmarks' ? (
          <Button
            variant="outlined"
            size="small"
            onClick={onToggleExpandAll}
            disableRipple
            sx={{ fontWeight: 700, textTransform: 'none', fontFamily: '"Urbanist", sans-serif' }}
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </Button>
        ) : null}
        <Box sx={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
          <button type="button" className="bookmarks-action" onClick={onRefresh} disabled={isLoading}>
            Refresh
          </button>
          <button type="button" className="bookmarks-action" onClick={onExport} disabled={isExporting}>
            Export
          </button>
        </Box>
      </Stack>

      {isOffline ? (
        <Alert severity="warning" sx={{ fontFamily: '"Urbanist", sans-serif' }}>
          You are offline. You can browse existing bookmarks, but refresh, removal, and export actions require a connection.
        </Alert>
      ) : null}

      {hideFullPreferenceError ? (
        <Alert severity="error" onClose={onClearPreferenceError} sx={{ fontFamily: '"Urbanist", sans-serif' }}>
          {hideFullPreferenceError}
        </Alert>
      ) : null}
    </Stack>
  );
}

BookmarksTopbar.propTypes = {
  totalCount: PropTypes.number.isRequired,
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  isExporting: PropTypes.bool,
  isOffline: PropTypes.bool,
  viewHistoryLength: PropTypes.number.isRequired,
  onClearHistory: PropTypes.func.isRequired,
  isClearingHistory: PropTypes.bool,
  hideFullPreferenceError: PropTypes.string,
  onClearPreferenceError: PropTypes.func,
  expandAll: PropTypes.bool,
  onToggleExpandAll: PropTypes.func.isRequired
};

BookmarksTopbar.defaultProps = {
  isLoading: false,
  isExporting: false,
  isOffline: false,
  isClearingHistory: false,
  hideFullPreferenceError: null,
  onClearPreferenceError: undefined,
  expandAll: false
};
