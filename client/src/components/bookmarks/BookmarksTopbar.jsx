import { Alert, Box, Button, Chip, Stack } from '@mui/material';

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
  onClearPreferenceError
}) {
  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <h1 className="bookmarks-title">Bookmarks</h1>
          <p className="bookmarks-subtitle">
            {totalCount} saved pin{totalCount === 1 ? '' : 's'}
          </p>
        </Box>
        <Box className="bookmarks-actions">
          <button type="button" className="bookmarks-action" onClick={onRefresh} disabled={isLoading}>
            Refresh
          </button>
          <button type="button" className="bookmarks-action" onClick={onExport} disabled={isExporting}>
            Export
          </button>
        </Box>
      </Stack>
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
