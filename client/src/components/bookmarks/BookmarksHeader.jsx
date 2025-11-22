import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import MainNavBackButton from '../../components/MainNavBackButton';
import GlobalNavMenu from '../../components/GlobalNavMenu';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const safeTotal = Number.isFinite(totalCount) ? totalCount : 0;
  const disableActions = isOffline || authLoading || !hasAuth;
  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <MainNavBackButton
          className="bookmarks-back-button"
          iconClassName="bookmarks-back-button__icon"
          ariaLabel={t('bookmarks.backAria')}
          scope="core"
        >
          {t('bookmarks.back')}
        </MainNavBackButton>
        <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
      </Stack>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <BookmarkIcon color="primary" />
        <Typography variant="h4" component="h1">
          {t('bookmarks.title')}
        </Typography>
        <Chip label={t('bookmarks.saved', { count: safeTotal })} size="small" color="primary" variant="outlined" />
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
      >
        <Typography variant="body2" sx={{ flexGrow: 1, color: '#111' }}>
          {t('bookmarks.subtitle')}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-end' } }}>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={onRefresh}
            disabled={disableActions || isLoading}
            title={isOffline ? t('bookmarks.offlineRefresh') : undefined}
          >
            {isLoading ? t('bookmarks.refreshing') : t('bookmarks.refresh')}
          </Button>
          <Button
            type="button"
            variant="contained"
            size="small"
            onClick={onExport}
            disabled={disableActions || isExporting}
            title={isOffline ? t('bookmarks.offlineExport') : undefined}
          >
            {isExporting ? t('bookmarks.exporting') : t('bookmarks.export')}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

export default BookmarksHeader;
