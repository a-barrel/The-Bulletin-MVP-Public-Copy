import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SmsIcon from '@mui/icons-material/Sms';

export const pageConfig = {
  id: 'chat-todo',
  label: 'Chat TODO',
  icon: SmsIcon,
  path: '/chat-todo',
  order: 90,
  showInNav: true,
  protected: true
};

function ChatTodoPage() {
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
          borderColor: 'primary.main',
          backgroundColor: 'background.paper',
          p: 4,
          textAlign: 'center'
        }}
      >
        <SmsIcon fontSize="large" color="primary" />
        <Typography variant="h5">Chat TODO</Typography>
        <Typography variant="body1" color="text.secondary">
          Placeholder for the upcoming chat experience. Wire up real content here when ready.
        </Typography>
      </Stack>
    </Box>
  );
}

export default ChatTodoPage;
