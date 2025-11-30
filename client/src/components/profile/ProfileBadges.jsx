import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import runtimeConfig from '../../config/runtime';
import { BADGE_METADATA } from '../../utils/badges';
import ProfileSection from './ProfileSection';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const resolveBadgeImageUrl = (value) => {
  if (!value) {
    return null;
  }
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) {
    return null;
  }
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return base ? `${base}${normalized}` : normalized;
};

function ProfileBadges({ badgeList }) {
  const { t } = useTranslation();
  const safeBadgeList = Array.isArray(badgeList) ? badgeList : [];
  const [failedBadges, setFailedBadges] = useState({});

  const handleBadgeError = (badgeId) => () => {
    setFailedBadges((prev) => {
      if (prev[badgeId]) return prev;
      return { ...prev, [badgeId]: true };
    });
  };

  return (
    <ProfileSection title={t('profile.badges.title')}>
      {safeBadgeList.length ? (
        <Stack direction="row" flexWrap="wrap" gap={1.5}>
          {safeBadgeList.map((badgeId) => {
            const badgeInfo =
              BADGE_METADATA[badgeId] ?? {
                label: badgeId,
                description: t('profile.badges.defaultDescription'),
                image: undefined
              };
            const badgeImageUrl = resolveBadgeImageUrl(badgeInfo.image);
            const avatarSrc = failedBadges[badgeId] ? undefined : badgeImageUrl;
            return (
              <Tooltip key={badgeId} title={badgeInfo.description} arrow enterTouchDelay={0}>
                <Box
                  sx={{
                    borderRadius: 3,
                    p: 1.5,
                    minWidth: 140,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    textAlign: 'center',
                    boxShadow: 2
                  }}
                >
                  <Avatar
                    src={avatarSrc}
                    alt={`${badgeInfo.label} badge`}
                    sx={{ width: 72, height: 72 }}
                    imgProps={{
                      onError: handleBadgeError(badgeId)
                    }}
                  >
                    {badgeInfo.label?.charAt(0) ?? '?'}
                  </Avatar>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {badgeInfo.label}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {t('profile.badges.empty')}
        </Typography>
      )}
    </ProfileSection>
  );
}

export default ProfileBadges;
