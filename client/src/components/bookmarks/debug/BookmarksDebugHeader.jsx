import BookmarkIcon from '@mui/icons-material/Bookmark';
import { Stack, Typography } from '@mui/material';
import BackButton from '../../BackButton';
import GlobalNavMenu from '../../GlobalNavMenu';

function BookmarksDebugHeader({ totalCount }) {
  return (
    <>
      <div className="bookmarks-nav">
        <div className="bookmarks-nav-left">
          <BackButton className="bookmarks-back-link" />
          <GlobalNavMenu triggerClassName="gnm-trigger-btn" iconClassName="gnm-trigger-btn__icon" />
        </div>
        <div className="bookmarks-nav-title">
          <BookmarkIcon fontSize="small" />
          <span>Bookmarks</span>
        </div>
        <div className="bookmarks-nav-left" />
      </div>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="center"
        className="bookmarks-nav-summary"
      >
        <Typography variant="body2" color="text.secondary">
          Total saved pins:
        </Typography>
        <Typography variant="subtitle2">{totalCount}</Typography>
      </Stack>
    </>
  );
}

export default BookmarksDebugHeader;
