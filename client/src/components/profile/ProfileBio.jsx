import Typography from '@mui/material/Typography';
import ProfileSection from './ProfileSection';

function ProfileBio({ bioText }) {
  return (
    <ProfileSection title="Bio">
      {bioText ? (
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {bioText}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          This user hasn't added a bio yet.
        </Typography>
      )}
    </ProfileSection>
  );
}

export default ProfileBio;
