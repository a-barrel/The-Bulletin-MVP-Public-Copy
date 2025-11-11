import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

function ProfileSection({ title, description, children }) {
  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {description ? (
          <div className="description-box">
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </div>
        ) : null}
      </Box>
      <Box
        className="section-content-box"
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          p: { xs: 2, md: 3 }
        }}
      >
        {children}
      </Box>
    </Stack>
  );
}

export default ProfileSection;
