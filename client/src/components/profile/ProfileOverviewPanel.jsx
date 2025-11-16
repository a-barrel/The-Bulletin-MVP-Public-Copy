import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import ProfileStatsSummary from './ProfileStatsSummary';
import ProfileMutualFriends from './ProfileMutualFriends';
import ProfileBio from './ProfileBio';
import ProfileBadges from './ProfileBadges';
import ProfileActionRow from './ProfileActionRow';
import { resolveProfileAvatarUrl } from '../../utils/profileAssets';

function ProfileOverviewPanel({
  statsVisible,
  postCount,
  eventsHosted,
  eventsAttended,
  showMutualFriends,
  mutualFriendCount,
  mutualFriendPreview,
  onSelectFriend,
  bioText,
  badgeList,
  actionRowProps
}) {
  return (
    <>
      <Divider />
      <ProfileStatsSummary
        statsVisible={statsVisible}
        postCount={postCount}
        eventsHosted={eventsHosted}
        eventsAttended={eventsAttended}
      />
      {showMutualFriends ? (
        <ProfileMutualFriends
          mutualFriendCount={mutualFriendCount}
          mutualFriendPreview={mutualFriendPreview}
          onSelectFriend={onSelectFriend}
          resolveAvatarUrl={resolveProfileAvatarUrl}
        />
      ) : null}
      <Stack spacing={3}>
        <ProfileBio bioText={bioText} />
        <ProfileBadges badgeList={badgeList} />
        <ProfileActionRow {...actionRowProps} />
      </Stack>
    </>
  );
}

export default ProfileOverviewPanel;
