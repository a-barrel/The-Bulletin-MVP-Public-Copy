import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function ProfileHero({ avatarSrc, bannerSrc, displayName, joinedDisplay, showEmptyState }) {
  return (
    <Stack spacing={1} alignItems="center" textAlign="center" sx={{ width: '100%' }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          borderRadius: 3,
          backgroundColor: 'grey.800',
          overflow: 'visible',
          minHeight: { xs: 160, sm: 200 },
          maxWidth: 800,
          aspectRatio: { xs: '16 / 7', sm: '16 / 5' }
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            overflow: 'hidden'
          }}
        >
          {bannerSrc ? (
            <Box
              component="img"
              src={bannerSrc}
              alt="Profile banner"
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              aria-hidden="true"
              sx={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #4B3F72 0%, #2E2157 100%)'
              }}
            />
          )}
        </Box>
        <Avatar
          src={avatarSrc ?? undefined}
          alt={`${displayName} avatar`}
          sx={{
            width: 112,
            height: 112,
            position: 'absolute',
            left: '50%',
            bottom: -56,
            transform: 'translateX(-50%)',
            border: '4px solid',
            borderColor: 'background.paper',
            bgcolor: 'secondary.main',
            boxShadow: 3,
            zIndex: 1
          }}
        >
          {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
        </Avatar>
      </Box>
      <Box sx={{ height: 48 }} aria-hidden="true" />
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', fontSize: '2rem' }}>
          {displayName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Joined: {joinedDisplay}
        </Typography>
      </Box>
      {showEmptyState ? (
        <Typography variant="body2" color="text.secondary">
          This user hasn't filled out their profile yet.
        </Typography>
      ) : null}
    </Stack>
  );
}

export default ProfileHero;
