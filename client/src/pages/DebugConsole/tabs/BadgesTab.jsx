import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import runtimeConfig from '../../../config/runtime';
import { auth } from '../../../firebase';
import {
  debugGrantBadge,
  debugListBadges,
  debugResetBadges,
  debugRevokeBadge,
  fetchCurrentUserProfile
} from '../../../api/mongoDataApi';
import { useBadgeSound } from '../../../contexts/BadgeSoundContext';

function BadgesTab() {
  const { announceBadgeEarned } = useBadgeSound();
  const [currentUser] = useAuthState(auth);
  const [userIdInput, setUserIdInput] = useState('');
  const [autoUserId, setAutoUserId] = useState('');
  const [badgeStatus, setBadgeStatus] = useState(null);
  const [status,       setStatus] = useState(null);
  const [mutatingBadgeId, setMutatingBadgeId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isMutating = Boolean(mutatingBadgeId) || isResetting;

  const resolveBadgeImageUrl = useCallback((value) => {
    if (!value) {
      return undefined;
    }
    if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) {
      return value;
    }
    const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
    const normalized = value.startsWith('/') ? value : `/${value}`;
    return base ? `${base}${normalized}` : normalized;
  }, []);

  const effectiveUserId = useMemo(() => {
    const trimmedInput = userIdInput.trim();
    if (trimmedInput) {
      return trimmedInput;
    }
    if (badgeStatus?.user?._id) {
      return badgeStatus.user._id;
    }
    return autoUserId;
  }, [userIdInput, badgeStatus, autoUserId]);

  const loadBadges = useCallback(
    async (targetId, { suppressStatus = false } = {}) => {
      const trimmed = targetId ? String(targetId).trim() : '';
      if (!trimmed) {
        if (!suppressStatus) {
                  setStatus({ type: 'error', message: 'Enter a user ID to load badges.' });
        }
        return null;
      }
      if (!suppressStatus) {
              setStatus(null);
      }
      setIsLoading(true);
      try {
        const data = await debugListBadges({ userId: trimmed });
        setBadgeStatus(data);
        setUserIdInput((prev) => (prev.trim() ? prev : data.user?._id ?? trimmed));
        if (!suppressStatus) {
          const displayName = data.user?.displayName || data.user?.username || trimmed;
                  setStatus({ type: 'success', message: `Loaded badges for ${displayName}.` });
        }
        return data;
      } catch (error) {
        console.error('Failed to load badge status:', error);
        if (!suppressStatus) {
                  setStatus({ type: 'error', message: error?.message || 'Failed to load badges.' });
        }
        throw error;
      } finally {
      setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (cancelled || !profile?._id) {
          return;
        }
        setAutoUserId(profile._id);
        setUserIdInput((prev) => (prev.trim() ? prev : profile._id));
        await loadBadges(profile._id, { suppressStatus: true });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load default badge status:', error);
                  setStatus({ type: 'error', message: error?.message || 'Failed to load badges.' });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, loadBadges]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const targetId = userIdInput.trim() || autoUserId;
      try {
        await loadBadges(targetId);
      } catch {
        // status handled within loadBadges
      }
    },
    [userIdInput, autoUserId, loadBadges]
  );

  const handleGrant = useCallback(
    async (badgeId) => {
      if (!badgeId) {
        return;
      }
      if (!effectiveUserId) {
                setStatus({ type: 'error', message: 'Load a user before granting badges.' });
        return;
      }
      setMutatingBadgeId(badgeId);
            setStatus(null);
      try {
        const data = await debugGrantBadge({ userId: effectiveUserId, badgeId });
        setBadgeStatus(data);
        const badgeMeta = data.badges?.find((badge) => badge.id === badgeId);
                setStatus({
          type: 'success',
          message: `Granted "${badgeMeta?.label || badgeId}" badge.`
        });
        if (badgeMeta?.earned) {
          playBadgeSound();
          const earnedBadgeId = badgeMeta?.id ?? badgeId;
          announceBadgeEarned(earnedBadgeId);
        }
      } catch (error) {
        console.error('Failed to grant badge:', error);
                setStatus({ type: 'error', message: error?.message || 'Failed to grant badge.' });
      } finally {
        setMutatingBadgeId(null);
      }
    },
    [effectiveUserId]
  );

  const handleRevoke = useCallback(
    async (badgeId) => {
      if (!badgeId) {
        return;
      }
      if (!effectiveUserId) {
                setStatus({ type: 'error', message: 'Load a user before removing badges.' });
        return;
      }
      setMutatingBadgeId(badgeId);
            setStatus(null);
      try {
        const data = await debugRevokeBadge({ userId: effectiveUserId, badgeId });
        setBadgeStatus(data);
        const badgeMeta = data.badges?.find((badge) => badge.id === badgeId);
                setStatus({
          type: 'success',
          message: `Removed "${badgeMeta?.label || badgeId}" badge.`
        });
      } catch (error) {
        console.error('Failed to remove badge:', error);
                setStatus({ type: 'error', message: error?.message || 'Failed to remove badge.' });
      } finally {
        setMutatingBadgeId(null);
      }
    },
    [effectiveUserId]
  );

    const handleReset = useCallback(async () => {
      if (!effectiveUserId) {
              setStatus({ type: 'error', message: 'Load a user before resetting badges.' });
      return;
    }
    setIsResetting(true);
          setStatus(null);
    try {
      const data = await debugResetBadges({ userId: effectiveUserId });
      setBadgeStatus(data);
              setStatus({ type: 'success', message: 'All badges reset.' });
    } catch (error) {
      console.error('Failed to reset badges:', error);
              setStatus({ type: 'error', message: error?.message || 'Failed to reset badges.' });
    } finally {
      setIsResetting(false);
    }
  }, [effectiveUserId]);

  const badges = badgeStatus?.badges ?? [];

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Badge management</Typography>
        <Typography variant="body2" color="text.secondary">
          Enter a MongoDB user ID to review or edit badges. Leave blank to manage your own badges.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'flex-end' }}
        >
          <TextField
            label="User ID"
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            placeholder={autoUserId || '64...'}
            fullWidth
          />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="outlined" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Load'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() => {
                if (autoUserId) {
                  setUserIdInput(autoUserId);
                  loadBadges(autoUserId).catch(() => {});
                }
              }}
              disabled={isLoading || !autoUserId}
            >
              Use my ID
            </Button>
            <Button
              type="button"
              variant="contained"
              color="error"
              onClick={handleReset}
              disabled={isResetting || !effectiveUserId}
            >
              {isResetting ? 'Resetting...' : 'Reset all'}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {status ? (
        <Alert severity={status.type} onClose={() =>       setStatus(null)}>
          {status.message}
        </Alert>
      ) : null}

      {isLoading ? (
        <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 4 }}>
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">
            Loading badges...
          </Typography>
        </Stack>
      ) : badgeStatus ? (
        <Stack spacing={2}>
          <Typography variant="subtitle1">
            Viewing badges for {badgeStatus.user?.displayName || badgeStatus.user?.username || badgeStatus.user?._id}
          </Typography>
          {badges.map((badge) => {
            const processing = isMutating && mutatingBadgeId === badge.id;
            const badgeImageUrl = resolveBadgeImageUrl(badge.image);
            return (
              <Paper
                key={badge.id}
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 3 },
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                  alignItems: { xs: 'flex-start', sm: 'center' }
                }}
              >
                <Box
                  component="img"
                  src={badgeImageUrl}
                  alt={`${badge.label} badge`}
                  sx={{
                    width: { xs: 96, sm: 120 },
                    height: { xs: 96, sm: 120 },
                    objectFit: 'cover',
                    borderRadius: 2,
                    border: (theme) => `1px solid ${theme.palette.divider}`
                  }}
                />
                <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">{badge.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {badge.description}
                  </Typography>
                </Stack>
                <Stack spacing={1} alignItems="flex-end">
                  <Chip
                    label={badge.earned ? 'Earned' : 'Locked'}
                    color={badge.earned ? 'success' : 'default'}
                    variant={badge.earned ? 'filled' : 'outlined'}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleGrant(badge.id)}
                      disabled={badge.earned || isMutating}
                    >
                      {processing && badge.earned ? 'Updating...' : processing ? 'Granting...' : 'Grant'}
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => handleRevoke(badge.id)}
                      disabled={!badge.earned || isMutating}
                    >
                      {processing && !badge.earned ? 'Updating...' : processing ? 'Removing...' : 'Remove'}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Load a user to view badge progress.
        </Typography>
      )}
    </Stack>
  );
}

export default BadgesTab;
