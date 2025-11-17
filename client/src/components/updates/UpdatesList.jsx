import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import UpdateCard from './UpdateCard';

function UpdatesList({
  updates,
  expandedUpdateId,
  onToggleExpand,
  pendingUpdateIds,
  deletingUpdateIds,
  onMarkRead,
  onDeleteUpdate,
  pullDistance,
  isPullRefreshing,
  resolveBadgeImageUrl
}) {
  return (
    <Box className="updates-list">
      <Box
        className="pull-refresh-indicator"
        style={{
          height: Math.max(isPullRefreshing ? 48 : 0, pullDistance),
          opacity: pullDistance > 0 || isPullRefreshing ? 1 : 0
        }}
      >
        {isPullRefreshing ? (
          <CircularProgress className="pull-refresh-loading-circle" size={28} />
        ) : (
          <>
            <span
              className={`pull-refresh-arrow-wrapper${
                pullDistance > 36 ? ' pull-refresh-arrow-wrapper--flipped' : ''
              }`}
            >
              <ArrowUpwardRoundedIcon className="pull-refresh-prompt-arrow" />
            </span>
            <Typography className="pull-refresh-label" variant="body2">
              {pullDistance > 36 ? 'Release to refresh' : 'Pull to refresh'}
            </Typography>
          </>
        )}
      </Box>
      {updates.map((update) => {
        const pending = pendingUpdateIds.includes(update._id);
        const isDeleting = deletingUpdateIds.includes(update._id);
        return (
          <UpdateCard
            key={update._id}
            update={update}
            expanded={expandedUpdateId === update._id}
            onToggleExpand={onToggleExpand}
            onMarkRead={onMarkRead}
            onDeleteUpdate={onDeleteUpdate}
            pending={pending}
            isDeleting={isDeleting}
            resolveBadgeImageUrl={resolveBadgeImageUrl}
          />
        );
      })}
    </Box>
  );
}

export default UpdatesList;
