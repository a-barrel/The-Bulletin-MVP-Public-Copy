import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LaunchIcon from '@mui/icons-material/Launch';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

function BookmarksGroups({ groups, onViewPin, onRemove, removingPinId, formatSavedDate, isOffline }) {
  if (!groups.length) {
    return null;
  }

  return (
    <List disablePadding className="bookmarks-classic-list">
      {groups.map(({ name, items }) => (
        <Box key={name}>
          <ListSubheader
            component="div"
            sx={{
              backgroundColor: 'background.paper',
              px: 3,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              {name}
            </Typography>
            <Chip label={items.length} size="small" variant="outlined" />
          </ListSubheader>
          <Divider />
          {items.map((bookmark) => {
            const pin = bookmark.pin;
            const pinId = bookmark.pinId || pin?._id;
            const pinTitle = pin?.title ?? 'Untitled Pin';
            const pinType = pin?.type ?? 'pin';
            const tagLabel =
              pinType === 'event' ? 'Event' : pinType === 'discussion' ? 'Discussion' : 'Pin';
            const savedAt = formatSavedDate(bookmark.createdAt);
            const isRemoving = removingPinId === pinId;

            return (
              <ListItemButton
                key={bookmark._id || pinId}
                alignItems="flex-start"
                onClick={() => onViewPin(pinId)}
                sx={{ py: 2, px: { xs: 2, md: 3 }, gap: 1.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="subtitle1" fontWeight={600}>
                        {pinTitle}
                      </Typography>
                      <Chip label={tagLabel} size="small" color="secondary" variant="outlined" />
                    </Stack>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      Saved on {savedAt}
                    </Typography>
                  }
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LaunchIcon fontSize="small" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewPin(pinId);
                  }}
                >
                  View
                </Button>
                <Button
                  size="small"
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutlineIcon fontSize="small" />}
                  disabled={isOffline || isRemoving}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(bookmark);
                  }}
                  title={isOffline ? 'Reconnect to remove bookmarks' : undefined}
                >
                  {isRemoving ? 'Removing...' : 'Remove'}
                </Button>
              </ListItemButton>
            );
          })}
          <Divider />
        </Box>
      ))}
    </List>
  );
}

export default BookmarksGroups;
