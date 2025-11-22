import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import ProfileSection from './ProfileSection';

function ProfileBio({ bioText }) {
  const { t } = useTranslation();
  return (
    <ProfileSection title={t('profile.bio.title')}>
      {bioText ? (
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {bioText}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('profile.bio.empty')}
        </Typography>
      )}
    </ProfileSection>
  );
}

export default ProfileBio;
