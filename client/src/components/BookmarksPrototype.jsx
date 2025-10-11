import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import FigmaMobileShell from './FigmaMobileShell';
import figmaBookmarks from '../data/figmaBookmarks.json';

const BookmarkCard = ({
  title,
  description,
  backgroundColor,
  accentColor,
  bookmarkColor,
  viewButtonColor,
  attendingCount,
  viewLabel,
  imageCount
}) => (
  <Paper
    elevation={0}
    sx={{
      backgroundColor,
      borderRadius: 3,
      px: 2,
      py: 1.5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      border: '1px solid rgba(93, 56, 137, 0.08)'
    }}
  >
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: `3px solid ${accentColor || 'rgba(93,56,137,0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <BookmarkRoundedIcon sx={{ color: accentColor || 'rgba(93,56,137,0.6)' }} />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Stack>

      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {description}
        </Typography>
      ) : null}

      {imageCount ? (
        <Stack direction="row" spacing={1}>
          {Array.from({ length: imageCount }).map((_, index) => (
            <Box
              key={index}
              sx={{
                flex: 1,
                minWidth: 70,
                height: 70,
                borderRadius: 2,
                backgroundColor: 'rgba(93, 56, 137, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(93, 56, 137, 0.45)'
              }}
            >
              <ImageRoundedIcon fontSize="small" />
            </Box>
          ))}
        </Stack>
      ) : null}

      {(attendingCount !== null && attendingCount !== undefined) || viewLabel ? (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          {attendingCount !== null && attendingCount !== undefined ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <PeopleAltRoundedIcon sx={{ color: accentColor || 'rgba(93, 56, 137, 0.8)' }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {attendingCount} attending
              </Typography>
            </Stack>
          ) : (
            <Box />
          )}

          <Stack direction="row" spacing={1}>
            {viewLabel ? (
              <Button
                variant="contained"
                disableElevation
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2,
                  backgroundColor: viewButtonColor || 'rgba(93, 56, 137, 0.15)',
                  color: 'rgba(0,0,0,0.85)',
                  '&:hover': {
                    backgroundColor: viewButtonColor || 'rgba(93, 56, 137, 0.25)'
                  }
                }}
              >
                {viewLabel}
              </Button>
            ) : null}
            <IconButton
              size="small"
              sx={{
                color: bookmarkColor || accentColor || 'rgba(93, 56, 137, 0.7)',
                border: `1px solid ${bookmarkColor || accentColor || 'rgba(93, 56, 137, 0.4)'}`,
                '&:hover': {
                  backgroundColor: 'rgba(93, 56, 137, 0.08)'
                }
              }}
            >
              <BookmarkRoundedIcon />
            </IconButton>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  </Paper>
);

const BookmarksPrototype = () => {
  const { header, cards } = figmaBookmarks;

  return (
    <FigmaMobileShell time={header.time} title={header.title} contentSpacing={2.5}>
      <Divider sx={{ borderColor: 'rgba(93, 56, 137, 0.12)' }} />
      <Stack spacing={1.5}>
        {cards.map((card) => (
          <BookmarkCard key={card.id} {...card} />
        ))}
      </Stack>
    </FigmaMobileShell>
  );
};

export default BookmarksPrototype;
