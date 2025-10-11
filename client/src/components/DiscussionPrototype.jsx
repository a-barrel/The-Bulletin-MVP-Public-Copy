import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FigmaMobileShell from './FigmaMobileShell';
import figmaDiscussion from '../data/figmaDiscussion.json';

const DiscussionComment = ({ comment }) => (
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
    {comment.hasImage ? (
      <Box
        sx={{
          borderRadius: 2,
          backgroundColor: 'rgba(93, 56, 137, 0.08)',
          height: 120
        }}
      />
    ) : null}
  </Paper>
);

const DiscussionPrototype = () => {
  const { header, post, comments, commentCountLabel } = figmaDiscussion;

  return (
    <FigmaMobileShell
      time={header.time}
      title={header.title}
      contentSpacing={2.5}
      rightSlot={
        <BookmarkBorderRoundedIcon sx={{ color: '#5d3889' }} />
      }
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
            {post.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {post.author}
          </Typography>
        </Stack>

        <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
          {post.body}
        </Typography>

        <Box
          sx={{
            borderRadius: 3,
            backgroundColor: 'rgba(93, 56, 137, 0.08)',
            height: 160
          }}
        />

        <Stack spacing={1}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {post.location}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {post.expires}
          </Typography>
        </Stack>
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
            <DiscussionComment key={`${comment.author}-${comment.timestamp}`} comment={comment} />
          ))}
        </Stack>
      </Stack>
    </FigmaMobileShell>
  );
};

export default DiscussionPrototype;
