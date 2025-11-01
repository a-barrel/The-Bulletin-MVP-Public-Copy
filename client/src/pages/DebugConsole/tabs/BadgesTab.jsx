import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
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
import { useBadgeSound } from '../../../contexts/BadgeSoundContext';
import { playBadgeSound } from '../../../utils/badgeSound';
import DebugPanel from '../components/DebugPanel';
import useBadgeManager from '../hooks/useBadgeManager';

function BadgesTab() {
  const { announceBadgeEarned } = useBadgeSound();
  const [currentUser] = useAuthState(auth);
  const [userIdInput, setUserIdInput] = useState('');

  const {
    badgeStatus,
    status,
    setStatus,
    mutatingBadgeId,
    isLoading,
    isResetting,
    autoUserId,
    loadBadges,
    grantBadge,
    revokeBadge,
    resetBadges
  } = useBadgeManager({ currentUser });

  useEffect(() => {
    if (!userIdInput && autoUserId) {
      setUserIdInput(autoUserId);
    }
  }, [autoUserId, userIdInput]);

  useEffect(() => {
    const derivedId = badgeStatus?.user?._id;
    if (derivedId) {
      setUserIdInput((prev) => (prev.trim() ? prev : derivedId));
    }
  }, [badgeStatus]);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    const targetId = userIdInput.trim() || autoUserId;
    loadBadges(targetId).catch(() => {});
  };

  const handleUseMyId = () => {
    if (!autoUserId) {
      return;
    }
    setUserIdInput(autoUserId);
    loadBadges(autoUserId).catch(() => {});
  };

  const handleGrant = async (badgeId) => {
    if (!badgeId || !effectiveUserId) {
      if (!effectiveUserId) {
        setStatus({ type: 'error', message: 'Load a user before granting badges.' });
      }
      return;
    }
    try {
      const data = await grantBadge(effectiveUserId, badgeId);
      const badgeMeta = data?.badges?.find((badge) => badge.id === badgeId);
      if (badgeMeta?.earned) {
        playBadgeSound();
        announceBadgeEarned(badgeMeta?.id ?? badgeId);
      }
    } catch (error) {
      console.error('Failed to grant badge:', error);
    }
  };

  const handleRevoke = async (badgeId) => {
    if (!badgeId || !effectiveUserId) {
      if (!effectiveUserId) {
        setStatus({ type: 'error', message: 'Load a user before removing badges.' });
      }
      return;
    }
    try {
      await revokeBadge(effectiveUserId, badgeId);
    } catch (error) {
      console.error('Failed to remove badge:', error);
    }
  };

  const handleReset = async () => {
    if (!effectiveUserId) {
      setStatus({ type: 'error', message: 'Load a user before resetting badges.' });
      return;
    }
    try {
      await resetBadges(effectiveUserId);
    } catch (error) {
      console.error('Failed to reset badges:', error);
    }
  };

  const isMutating = Boolean(mutatingBadgeId) || isResetting;
  const badges = badgeStatus?.badges ?? [];

  const alerts = status
    ? [
        {
          key: 'status',
          severity: status.type,
          content: status.message,
          onClose: () => setStatus(null)
        }
      ]
    : [];

  return (
    <Stack spacing={2}>
      <DebugPanel
        component="form"
        onSubmit={handleSubmit}
        title="Badge management"
        description="Enter a MongoDB user ID to review or edit badges. Leave blank to manage your own badges."
        alerts={alerts}
      >
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
              onClick={handleUseMyId}
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
      </DebugPanel>

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
