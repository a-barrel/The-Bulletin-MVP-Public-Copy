import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export const pageConfig = {
  id: 'profile-todo',
  label: 'Profile TODO',
  icon: AccountCircleIcon,
  path: '/profile-todo',
  order: 91,
  showInNav: true,
  protected: true
};

function ProfileTodoPage() {
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
          borderColor: 'secondary.main',
          backgroundColor: 'background.paper',
          p: 4,
          textAlign: 'center'
        }}
      >
        <AccountCircleIcon fontSize="large" color="secondary" />
        <Typography variant="h5">Profile TODO</Typography>
        <Typography variant="body1" color="text.secondary">
          Placeholder for the future profile view. Replace with profile layout when available.
        </Typography>
      </Stack>
    </Box>
  );
}

export default ProfileTodoPage;
