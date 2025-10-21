import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import UpdateIcon from '@mui/icons-material/Update';

export const pageConfig = {
  id: 'update-todo',
  label: 'Update TODO',
  icon: UpdateIcon,
  path: '/update-todo',
  order: 93,
  showInNav: true,
  protected: true
};

function UpdateTodoPage() {
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
          borderColor: 'success.main',
          backgroundColor: 'background.paper',
          p: 4,
          textAlign: 'center'
        }}
      >
        <UpdateIcon fontSize="large" color="success" />
        <Typography variant="h5">Update TODO</Typography>
        <Typography variant="body1" color="text.secondary">
          Placeholder screen to hook up future update flows and notifications.
        </Typography>
      </Stack>
    </Box>
  );
}

export default UpdateTodoPage;
