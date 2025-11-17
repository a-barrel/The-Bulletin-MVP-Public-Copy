import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import MainNavBackButton from '../../components/MainNavBackButton';
import GlobalNavMenu from '../../components/GlobalNavMenu';

function BookmarksHeader({
  totalCount,
  onRefresh,
  onExport,
  isOffline,
  isLoading,
  isExporting,
  authLoading,
  hasAuth
}) {
  const disableActions = isOffline || authLoading || !hasAuth;
  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <MainNavBackButton
          className="bookmarks-back-button"
          iconClassName="bookmarks-back-button__icon"
          ariaLabel="Back to main view"
          scope="core"
        >
          Back
        </MainNavBackButton>
        <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <BookmarkIcon color="primary" />
        <Typography variant="h4" component="h1">
          Bookmarks
        </Typography>
        <Chip label={`${totalCount} saved`} size="small" color="primary" variant="outlined" />
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="body2" sx={{ flexGrow: 1, color: '#111' }}>
          Quickly revisit saved pins. Bookmarks are grouped by collection and can be removed at any
          time.
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' } }}>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={onRefresh}
            disabled={disableActions || isLoading}
            title={isOffline ? 'Reconnect to refresh bookmarks' : undefined}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button
            type="button"
            variant="contained"
            size="small"
            onClick={onExport}
            disabled={disableActions || isExporting}
            title={isOffline ? 'Reconnect to export bookmarks' : undefined}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

export default BookmarksHeader;
