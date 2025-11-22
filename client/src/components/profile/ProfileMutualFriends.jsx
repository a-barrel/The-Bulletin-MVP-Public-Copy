import Avatar from '@mui/material/Avatar';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import ProfileSection from './ProfileSection';
import FriendBadge from '../FriendBadge';

function ProfileMutualFriends({
  mutualFriendCount,
  mutualFriendPreview,
  onSelectFriend,
  resolveAvatarUrl
}) {
  const { t } = useTranslation();

  if (mutualFriendCount === null || mutualFriendCount === undefined) {
    return null;
  }

  return (
    <ProfileSection title={t('profile.mutual.title')}>
      {mutualFriendCount > 0 ? (
        <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={2}>
          {mutualFriendPreview.map((friend) => {
            const friendId = friend?._id || friend?.id || friend?.userId;
            const friendName = friend?.displayName || friend?.username || friend?.email || t('profile.mutual.friendFallback');
            return (
              <ButtonBase
                key={friendId || friendName}
                onClick={() => onSelectFriend(friendId)}
                sx={{
                  textAlign: 'center',
                  borderRadius: 3,
                  p: 1,
                  width: 96,
                  flexDirection: 'column'
                }}
              >
                <Avatar
                  src={resolveAvatarUrl(friend?.avatar) ?? undefined}
                  alt={friendName}
                  sx={{ width: 56, height: 56, mb: 0.5 }}
                >
                  {friendName?.charAt(0)?.toUpperCase() || t('profile.mutual.friendInitial')}
                </Avatar>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                >
                  {friendName}
                  <FriendBadge userId={friendId} size="0.75em" />
                </Typography>
              </ButtonBase>
            );
          })}
          {mutualFriendCount > mutualFriendPreview.length ? (
            <Chip
              label={t('profile.mutual.more', { count: mutualFriendCount - mutualFriendPreview.length })}
              variant="outlined"
              sx={{ alignSelf: 'center' }}
            />
          ) : null}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('profile.mutual.empty')}
        </Typography>
      )}
    </ProfileSection>
  );
}

export default ProfileMutualFriends;
