import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';

export const pageConfig = {
  id: 'bookmarks-todo',
  label: 'Bookmarks TODO',
  icon: BookmarkBorderIcon,
  path: '/bookmarks-todo',
  order: 94,
  showInNav: true,
  protected: true
};

function BookmarksTodoPage() {
  return (
    <Box
      component="section"
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3
      }}
    >
      <Stack
        spacing={2}
        sx={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'warning.main',
          backgroundColor: 'background.paper',
          p: 4,
          textAlign: 'center'
        }}
      >
        <BookmarkBorderIcon fontSize="large" color="warning" />
        <Typography variant="h5">Bookmarks TODO</Typography>
        <Typography variant="body1" color="text.secondary">
          Stub view for bookmarked pins and collections. Replace with the real experience.
        </Typography>
      </Stack>
    </Box>
  );
}

export default BookmarksTodoPage;
