import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';

export const pageConfig = {
  id: 'settings-todo',
  label: 'Settings TODO',
  icon: SettingsIcon,
  path: '/settings-todo',
  order: 92,
  showInNav: true,
  protected: true
};

function SettingsTodoPage() {
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
          borderColor: 'info.main',
          backgroundColor: 'background.paper',
          p: 4,
          textAlign: 'center'
        }}
      >
        <SettingsIcon fontSize="large" color="info" />
        <Typography variant="h5">Settings TODO</Typography>
        <Typography variant="body1" color="text.secondary">
          Future settings controls will live here. Stub screen for navigation testing.
        </Typography>
      </Stack>
    </Box>
  );
}

export default SettingsTodoPage;
