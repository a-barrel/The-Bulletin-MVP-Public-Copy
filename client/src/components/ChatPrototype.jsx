import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import FigmaMobileShell from './FigmaMobileShell';
import figmaChat from '../data/figmaChat.json';

const ChatMessage = ({ message }) => {
  const isOwn = message.username.toLowerCase() === 'me';
  return (
    <Stack
      spacing={0.5}
      sx={{
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '85%'
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {message.username}
      </Typography>
      <Paper
        elevation={0}
        sx={{
          backgroundColor: message.backgroundColor || 'rgba(245, 239, 253, 0.8)',
          borderRadius: 3,
          px: 2,
          py: 1.5,
          border: '1px solid rgba(93, 56, 137, 0.12)'
        }}
      >
        <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
          {message.body}
        </Typography>
        {message.hasImage ? (
          <Box
            sx={{
              mt: 1,
              borderRadius: 2,
              backgroundColor: 'rgba(93, 56, 137, 0.08)',
              height: 120
            }}
          />
        ) : null}
      </Paper>
      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: isOwn ? 'flex-end' : 'flex-start' }}>
        {message.timestamp}
      </Typography>
    </Stack>
  );
};

const ChatPrototype = () => {
  const { header, composerPlaceholder, messages, navItems } = figmaChat;

  return (
    <FigmaMobileShell
      time={header.time}
      title={header.title}
      contentSpacing={2.5}
      leftSlot={
        <IconButton size="small">
          <MenuRoundedIcon fontSize="inherit" />
        </IconButton>
      }
      rightSlot={
        <Box
          sx={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <IconButton size="small">
            <NotificationsNoneRoundedIcon />
          </IconButton>
          {header.notificationCount ? (
            <Box
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                backgroundColor: '#ef5350',
                color: '#fff',
                borderRadius: '50%',
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 600
              }}
            >
              {header.notificationCount}
            </Box>
          ) : null}
        </Box>
      }
    >
      <Stack spacing={2} sx={{ minHeight: 280 }}>
        {messages.map((message) => (
          <ChatMessage key={`${message.username}-${message.timestamp}`} message={message} />
        ))}
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(93, 56, 137, 0.15)',
          px: 1.5,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backgroundColor: '#fff'
        }}
      >
        <IconButton size="small">
          <AddPhotoAlternateRoundedIcon fontSize="inherit" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          {composerPlaceholder}
        </Typography>
        <IconButton size="small">
          <SendRoundedIcon fontSize="inherit" />
        </IconButton>
      </Paper>

      <Box>
        <Divider sx={{ borderColor: 'rgba(93, 56, 137, 0.12)', mb: 1 }} />
        <Stack direction="row" justifyContent="space-around" alignItems="center">
          {navItems.map((item) => (
            <Typography key={item.label} variant="caption" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
          ))}
        </Stack>
      </Box>
    </FigmaMobileShell>
  );
};

export default ChatPrototype;
