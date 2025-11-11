import Avatar from '@mui/material/Avatar';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ProfileSection from './ProfileSection';

function ProfileMutualFriends({
  mutualFriendCount,
  mutualFriendPreview,
  onSelectFriend,
  resolveAvatarUrl
}) {
  if (mutualFriendCount === null || mutualFriendCount === undefined) {
    return null;
  }

  return (
    <ProfileSection title="Mutual friends">
      {mutualFriendCount > 0 ? (
        <Stack direction="row" spacing={2} flexWrap="wrap" rowGap={2}>
          {mutualFriendPreview.map((friend) => {
            const friendId = friend?._id || friend?.id || friend?.userId;
            const friendName = friend?.displayName || friend?.username || friend?.email || 'Friend';
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
                  {friendName?.charAt(0)?.toUpperCase() || 'F'}
                </Avatar>
                <Typography variant="caption" noWrap>
                  {friendName}
                </Typography>
              </ButtonBase>
            );
          })}
          {mutualFriendCount > mutualFriendPreview.length ? (
            <Chip
              label={`+${mutualFriendCount - mutualFriendPreview.length} more`}
              variant="outlined"
              sx={{ alignSelf: 'center' }}
            />
          ) : null}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          You have no mutual friends yet. Start connecting!
        </Typography>
      )}
    </ProfileSection>
  );
}

export default ProfileMutualFriends;
