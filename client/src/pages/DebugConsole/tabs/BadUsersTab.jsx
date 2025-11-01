import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';

import runtimeConfig from '../../../config/runtime';
import { BAD_USERS_FALLBACK_AVATAR } from '../constants';
import DebugPanel from '../components/DebugPanel';
import useBadUsers from '../hooks/useBadUsers';

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
  const {
    users,
    isLoading,
    status,
    setStatus,
    profileError,
    setProfileError,
    currentUserId,
    refresh,
    incrementSelf,
    resetSelf
  } = useBadUsers();

  const alerts = [
    status
      ? {
          key: 'status',
          severity: status.type,
          content: status.message,
          onClose: () => setStatus(null)
        }
      : null,
    !currentUserId && profileError
      ? {
          key: 'profile-error',
          severity: 'warning',
          content: profileError,
          onClose: () => setProfileError(null)
        }
      : null
  ];

  return (
    <DebugPanel
      title="Users with cuss logs"
      description="Preview accounts that triggered the cuss-word filter. Counts reflect total filtered messages."
      actions={[
        <Button key="refresh" onClick={refresh} variant="outlined" disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>,
        <Button
          key="add"
          variant="contained"
          color="warning"
          onClick={incrementSelf}
          disabled={isLoading || !currentUserId}
        >
          😈 +1 Cuss
        </Button>,
        <Button
          key="reset"
          variant="outlined"
          color="success"
          onClick={resetSelf}
          disabled={isLoading || !currentUserId}
        >
          😇 Remove All Cuss
        </Button>
      ]}
      alerts={alerts}
    >
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
    </DebugPanel>
  );
}

export default BadUsersTab;
