import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { fetchUserProfile } from '../api/mongoDataApi';

export const pageConfig = {
  id: 'profile',
  label: 'Profile',
  icon: AccountCircleIcon,
  path: '/profile/:userId',
  order: 91,
  showInNav: true,
  protected: true,
  resolveNavTarget: () => {
    const input = window.prompt('Enter a user ID to view in Profile:');
    if (typeof input !== 'string') {
      return null;
    }
    const trimmed = input.trim();
    return trimmed.length > 0 ? `/profile/${trimmed}` : null;
  }
};

const FALLBACK_AVATAR = '/images/profile/profile-01.jpg';

const resolveAvatarUrl = (avatar) => {
  if (!avatar) {
    return FALLBACK_AVATAR;
  }

  if (typeof avatar === 'string') {
    const trimmed = avatar.trim();
    return trimmed ? trimmed : FALLBACK_AVATAR;
  }

  if (typeof avatar === 'object') {
    const source = avatar.url ?? avatar.thumbnailUrl ?? avatar.path;
    if (typeof source === 'string') {
      const trimmedSource = source.trim();
      if (trimmedSource) {
        return trimmedSource;
      }
    }
  }

  return FALLBACK_AVATAR;
};

const formatEntryValue = (value) => {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return '[unserializable object]';
    }
  }
  return String(value);
};

function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const userFromState = location.state?.user;
  const originPath = typeof location.state?.from === 'string' ? location.state.from : null;
  const [fetchedUser, setFetchedUser] = useState(null);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!userId || userFromState) {
      setFetchedUser(null);
      setFetchError(null);
      setIsFetchingProfile(false);
      return;
    }

    let ignore = false;

    async function loadProfile() {
      setIsFetchingProfile(true);
      setFetchError(null);

      try {
        const profile = await fetchUserProfile(userId);
        if (ignore) {
          return;
        }
        setFetchedUser(profile);
      } catch (error) {
        if (ignore) {
          return;
        }
        console.error('Failed to load user profile:', error);
        setFetchError(error?.message || 'Failed to load user profile.');
        setFetchedUser(null);
      } finally {
        if (!ignore) {
          setIsFetchingProfile(false);
        }
      }
    }

    loadProfile();

    return () => {
      ignore = true;
    };
  }, [userId, userFromState]);

  const effectiveUser = userFromState ?? fetchedUser ?? null;

  const displayName = useMemo(() => {
    if (effectiveUser) {
      return (
        effectiveUser.displayName ||
        effectiveUser.username ||
        effectiveUser.fullName ||
        effectiveUser.email ||
        userId ||
        'Unknown User'
      );
    }
    return userId || 'Unknown User';
  }, [effectiveUser, userId]);

  const avatarUrl = resolveAvatarUrl(effectiveUser?.avatar);

  const detailEntries = useMemo(() => {
    if (!effectiveUser || typeof effectiveUser !== 'object') {
      return [];
    }

    return Object.entries(effectiveUser)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => ({
        key,
        value,
        isObject: typeof value === 'object' && value !== null
      }));
  }, [effectiveUser]);

  const hasUserData = detailEntries.length > 0;
  const handleBack = () => {
    if (originPath) {
      navigate(originPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 }
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          backgroundColor: 'background.paper'
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              size="small"
              color="primary"
              sx={{ alignSelf: 'flex-start' }}
          >
            Back
          </Button>
        </Box>

          {isFetchingProfile ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2" color="text.secondary">
                Loading profile data...
              </Typography>
            </Stack>
          ) : null}

          {fetchError ? (
            <Alert severity="warning" variant="outlined">
              {fetchError}
            </Alert>
          ) : null}

          <Stack spacing={2} alignItems="center" textAlign="center">
            <Avatar
              src={avatarUrl}
              alt={`${displayName} avatar`}
              sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
            >
              {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1">
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                User ID: {userId || 'N/A'}
              </Typography>
            </Box>
            {!hasUserData && !isFetchingProfile && !fetchError ? (
              <Typography variant="body2" color="text.secondary">
                No additional user context was provided. Use a pin, reply, or enter a valid user ID
                to preview available data.
              </Typography>
            ) : null}
          </Stack>

          {hasUserData ? (
            <>
              <Divider />
              <Stack spacing={2}>
                <Typography variant="subtitle1" color="text.secondary">
                  Raw user data (placeholder view)
                </Typography>
                <Stack spacing={1.5}>
                  {detailEntries.map(({ key, value, isObject }) => (
                    <Box
                      key={key}
                      sx={{
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.default',
                        p: 2
                      }}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          fontWeight: 600
                        }}
                      >
                        {key}
                      </Typography>
                      {isObject ? (
                        <Box
                          component="pre"
                          sx={{
                            mt: 1,
                            mb: 0,
                            fontSize: '0.85rem',
                            lineHeight: 1.5,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}
                        >
                          {formatEntryValue(value)}
                        </Box>
                      ) : (
                        <Typography variant="body1" sx={{ mt: 0.5 }}>
                          {formatEntryValue(value)}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}

export default ProfilePage;
