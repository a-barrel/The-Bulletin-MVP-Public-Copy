import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FigmaMobileShell from './FigmaMobileShell';
import figmaEvent from '../data/figmaEvent.json';

const EventComment = ({ comment }) => (
  <Paper
    elevation={0}
    sx={{
      borderRadius: 3,
      border: '1px solid rgba(93, 56, 137, 0.12)',
      px: 2,
      py: 1.5,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {comment.author}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {comment.timestamp}
      </Typography>
    </Stack>
    <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
      {comment.body}
    </Typography>
    {comment.imageCount ? (
      <Stack direction="row" spacing={1}>
        {Array.from({ length: comment.imageCount }).map((_, index) => (
          <Box
            key={index}
            sx={{
              flex: 1,
              minWidth: 60,
              height: 70,
              borderRadius: 2,
              backgroundColor: 'rgba(93, 56, 137, 0.08)'
            }}
          />
        ))}
      </Stack>
    ) : null}
  </Paper>
);

const EventPrototype = () => {
  const { header, event, comments, commentCountLabel } = figmaEvent;

  return (
    <FigmaMobileShell
      time={header.time}
      title={header.title}
      contentSpacing={2.5}
      rightSlot={<BookmarkBorderRoundedIcon sx={{ color: '#5d3889' }} />}
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          px: 3,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#ffffff',
          border: '1px solid rgba(93, 56, 137, 0.12)'
        }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {event.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Hosted by {event.host}
          </Typography>
        </Stack>

        <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
          {event.description}
        </Typography>

        <Stack spacing={1.5}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {event.location}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {event.occurs}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <EventAvailableRoundedIcon fontSize="small" sx={{ color: '#5d3889' }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {event.attendingLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ({event.attendeeCount} avatars)
            </Typography>
          </Stack>
        </Stack>

        <ButtonLike>{event.attendCta}</ButtonLike>
      </Paper>

      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ChatBubbleOutlineRoundedIcon fontSize="small" sx={{ color: '#5d3889' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {commentCountLabel}
          </Typography>
        </Stack>

        <Stack spacing={1.5}>
          {comments.map((comment) => (
            <EventComment key={`${comment.author}-${comment.timestamp}`} comment={comment} />
          ))}
        </Stack>
      </Stack>
    </FigmaMobileShell>
  );
};

function ButtonLike({ children }) {
  return (
    <Box
      sx={{
        alignSelf: 'flex-start',
        px: 3,
        py: 1,
        borderRadius: 999,
        backgroundColor: '#f15bb5',
        color: '#000',
        fontWeight: 600,
        fontSize: '0.95rem'
      }}
    >
      {children}
    </Box>
  );
}

export default EventPrototype;
