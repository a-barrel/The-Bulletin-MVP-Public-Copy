import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function ProfileStatsSummary({ statsVisible, postCount, eventsHosted, eventsAttended }) {
  if (!statsVisible) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        This user keeps their stats private.
      </Typography>
    );
  }

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ px: 0.5, rowGap: 1 }}>
      <Box className="summary-box" sx={{ flex: '1 0 160px' }}>
        <Typography variant="body2">Post count: {postCount}</Typography>
      </Box>
      <Box className="summary-box" sx={{ flex: '1 0 160px' }}>
        <Typography variant="body2">Events hosted: {eventsHosted}</Typography>
      </Box>
      <Box className="summary-box" sx={{ flex: '1 0 160px' }}>
        <Typography variant="body2">Events attended: {eventsAttended}</Typography>
      </Box>
    </Stack>
  );
}

export default ProfileStatsSummary;
