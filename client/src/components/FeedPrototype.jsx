import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FigmaMobileShell from './FigmaMobileShell';
import figmaFeed from '../data/figmaFeed.json';

const FeedCard = ({ card }) => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: 3,
      border: '1px solid rgba(93, 56, 137, 0.12)',
      px: 2,
      py: 1.5,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      backgroundColor: '#fff'
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Stack spacing={0.25}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {card.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {card.distance}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {card.daysLeft}
      </Typography>
    </Stack>
    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
      {card.body}
    </Typography>

    <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 0.5 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {card.author}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <BookmarkBorderRoundedIcon fontSize="small" sx={{ color: '#5d3889' }} />
        <Typography variant="caption">{card.attending}</Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <ChatBubbleOutlineRoundedIcon fontSize="small" sx={{ color: '#5d3889' }} />
        <Typography variant="caption">{card.replies}</Typography>
      </Stack>
    </Stack>
  </Paper>
);

const FeedPrototype = () => {
  const { header, sortLabel, cards, navItems, createLabel } = figmaFeed;

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
        <Box sx={{ position: 'relative' }}>
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
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small">
          <TuneRoundedIcon fontSize="inherit" />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {sortLabel}
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        {cards.map((card) => (
          <FeedCard key={card.title} card={card} />
        ))}
      </Stack>

      {createLabel ? (
        <Button
          variant="contained"
          disableElevation
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 3,
            backgroundColor: '#f15bb5',
            color: '#000',
            '&:hover': {
              backgroundColor: '#f15bb5'
            }
          }}
        >
          {createLabel}
        </Button>
      ) : null}

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

export default FeedPrototype;
