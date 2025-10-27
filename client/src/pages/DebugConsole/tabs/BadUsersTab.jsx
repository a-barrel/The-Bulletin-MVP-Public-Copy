import { useState, useEffect, useCallback } from 'react';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';

import runtimeConfig from '../../../config/runtime';
import {
  fetchUsersWithCussCount,
  incrementUserCussCount,
  resetUserCussCount,
  fetchCurrentUserProfile
} from '../../../api/mongoDataApi';
import { BAD_USERS_FALLBACK_AVATAR } from '../constants';

function resolveAvatarUrl(avatar) {
  if (!avatar) {
    return BAD_USERS_FALLBACK_AVATAR;
  }

  const toAbsolute = (value) => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      return trimmed;
    }
    const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return base ? `${base}${normalized}` : normalized;
  };

  if (typeof avatar === 'string') {
    return toAbsolute(avatar) || BAD_USERS_FALLBACK_AVATAR;
  }
  if (typeof avatar === 'object' && avatar) {
    const source = avatar.thumbnailUrl || avatar.url || avatar.path;
    return toAbsolute(typeof source === 'string' ? source : null) || BAD_USERS_FALLBACK_AVATAR;
  }
  return BAD_USERS_FALLBACK_AVATAR;
}

const buildSummary = (user) => {
  const parts = [];
  if (user.username) {
    parts.push(`@${user.username}`);
  }
  if (user.accountStatus && user.accountStatus !== 'active') {
    parts.push(`status: ${user.accountStatus}`);
  }
  if (user.createdAt) {
    try {
      parts.push(`joined ${new Date(user.createdAt).toLocaleDateString()}`);
    } catch {
      // ignore parse errors
    }
  }
  return parts.join(' • ');
};

function BadUsersTab() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [profileError, setProfileError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setStatus(null);
    setIsLoading(true);
    try {
      const data = await fetchUsersWithCussCount();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to load cuss stats.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (cancelled) {
          return;
        }
        const id = profile?._id || profile?.userId || profile?.id || '';
        if (id) {
          setCurrentUserId(id);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error?.message || 'Failed to load current user id.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleIncrement = useCallback(async () => {
    if (!currentUserId) {
      setStatus({ type: 'error', message: 'Load your profile id first.' });
      return;
    }
    try {
      setIsLoading(true);
      await incrementUserCussCount(currentUserId);
      await loadUsers();
      setStatus({ type: 'success', message: 'Added 1 cuss to your profile.' });
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to increment.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, loadUsers]);

  const handleReset = useCallback(async () => {
    if (!currentUserId) {
      setStatus({ type: 'error', message: 'Load your profile id first.' });
      return;
    }
    try {
      setIsLoading(true);
      await resetUserCussCount(currentUserId);
      await loadUsers();
      setStatus({ type: 'success', message: 'Cuss count cleared.' });
    } catch (error) {
      setStatus({ type: 'error', message: error?.message || 'Failed to reset.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, loadUsers]);

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="h6">Users with cuss logs</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button onClick={loadUsers} variant="outlined" disabled={isLoading}>
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              variant="contained"
              color="warning"
              onClick={handleIncrement}
              disabled={isLoading || !currentUserId}
            >
              😈 +1 Cuss
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={handleReset}
              disabled={isLoading || !currentUserId}
            >
              😇 Remove All Cuss
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Preview of accounts that triggered the cuss-word filter. Counts reflect total filtered messages.
        </Typography>
        {status ? (
          <Alert severity={status.type} onClose={() => setStatus(null)}>
            {status.message}
          </Alert>
        ) : null}
        {profileError && !currentUserId ? (
          <Alert severity="warning" onClose={() => setProfileError(null)}>
            {profileError}
          </Alert>
        ) : null}
        {isLoading && users.length === 0 ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading…
            </Typography>
          </Stack>
        ) : null}
        {users.length === 0 && !isLoading ? (
          <Typography variant="body2" color="text.secondary">
            No colorful language detected yet. 🌈
          </Typography>
        ) : null}
        {users.length > 0 ? (
          <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2 }}>
            {users.map((user) => {
              const avatarUrl = resolveAvatarUrl(user.avatar);
              const name = user.displayName || user.username || user.id;
              const cussCount = Number(user?.cussCount ?? 0);
              const countLabel = `${cussCount} ${cussCount === 1 ? 'cuss' : 'cusses'}`;
              return (
                <ListItem key={user.id} alignItems="center" sx={{ py: 1 }}>
                  <ListItemAvatar>
                    <Avatar src={avatarUrl} alt={name} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={name}
                    secondary={buildSummary(user)}
                    primaryTypographyProps={{ fontWeight: 600 }}
                  />
                  <Chip label={countLabel} color="warning" size="small" />
                </ListItem>
              );
            })}
          </List>
        ) : null}
      </Paper>
    </Stack>
  );
}

export default BadUsersTab;
