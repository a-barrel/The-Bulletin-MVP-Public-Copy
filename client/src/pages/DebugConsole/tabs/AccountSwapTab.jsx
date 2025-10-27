import { useCallback, useEffect, useState } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';

import { auth } from '../../../firebase';
import {
  fetchDebugAuthAccounts,
  requestAccountSwap
} from '../../../api/mongoDataApi';
import { applyAuthPersistence, AUTH_PERSISTENCE } from '../../../utils/authPersistence';
import { deriveInitials, formatReadableTimestamp } from '../utils';

function AccountSwapTab() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [fetchError, setFetchError] = useState(null);
  const [swapStatus, setSwapStatus] = useState(null);
  const [pendingUid, setPendingUid] = useState(null);
  const [currentUser] = useAuthState(auth);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const list = await fetchDebugAuthAccounts();
      setAccounts(list);
    } catch (error) {
      setFetchError(error.message || 'Failed to load Firebase accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDebugAuthAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleSwap = useCallback(
    async (account) => {
      setSwapStatus(null);
      setPendingUid(account.uid);
      try {
        const token = await requestAccountSwap(account.uid);
        await applyAuthPersistence(auth, AUTH_PERSISTENCE.LOCAL);
        await signInWithCustomToken(auth, token);
        setSwapStatus({
          type: 'success',
          message: `Now signed in as ${account.displayName || account.email || account.uid}.`
        });
        await loadAccounts();
      } catch (error) {
        setSwapStatus({
          type: 'error',
          message: error.message || 'Failed to swap accounts.'
        });
      } finally {
        setPendingUid(null);
      }
    },
    [loadAccounts, requestAccountSwap, signInWithCustomToken, auth]
  );

  const currentUserLabel =
    currentUser?.displayName || currentUser?.email || currentUser?.uid || 'Unknown user';

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Account Swap
          </Typography>
          <Button
            type="button"
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={loadAccounts}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Swap between Firebase Auth emulator accounts for offline testing without leaving the app.
        </Typography>

        {currentUser && (
          <Alert severity="info">
            Current Firebase user: <strong>{currentUserLabel}</strong>
          </Alert>
        )}

        {swapStatus && (
          <Alert severity={swapStatus.type} onClose={() => setSwapStatus(null)}>
            {swapStatus.message}
          </Alert>
        )}

        {fetchError && (
          <Alert severity="error" onClose={() => setFetchError(null)}>
            {fetchError}
          </Alert>
        )}

        {isLoading && accounts.length === 0 ? (
          <Stack alignItems="center" py={3}>
            <CircularProgress size={32} />
          </Stack>
        ) : accounts.length === 0 ? (
          <Alert severity="warning">No Firebase accounts were found in the emulator export.</Alert>
        ) : (
          <List disablePadding>
            {accounts.map((account, index) => {
              const label = account.displayName || account.email || account.uid;
              const initials = deriveInitials(label);
              const isCurrent = currentUser?.uid === account.uid;
              const isPending = pendingUid === account.uid;
              const actionDisabled = isCurrent || isPending || Boolean(account.disabled);
              const lastSignIn = formatReadableTimestamp(account.lastLoginAt);

              return (
                <ListItem
                  key={account.uid}
                  alignItems="flex-start"
                  divider={index !== accounts.length - 1}
                  secondaryAction={
                    <Stack direction="row" spacing={1} alignItems="center">
                      {isCurrent && <Chip label="Current" color="success" size="small" />}
                      <Button
                        type="button"
                        size="small"
                        variant="contained"
                        onClick={() => handleSwap(account)}
                        disabled={actionDisabled}
                      >
                        {isPending ? 'Switching...' : 'Swap to'}
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={account.photoUrl || undefined} alt={label}>
                      {initials}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Typography variant="subtitle1">{label}</Typography>
                        {account.disabled && <Chip label="Disabled" color="warning" size="small" />}
                      </Stack>
                    }
                    primaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        {account.email && (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {account.email}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" component="span">
                          UID: {account.uid}
                        </Typography>
                        {account.providerIds?.length ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            {account.providerIds.map((providerId) => (
                              <Chip key={providerId} label={providerId} size="small" variant="outlined" />
                            ))}
                          </Stack>
                        ) : null}
                        {lastSignIn && (
                          <Typography variant="caption" color="text.secondary" component="span">
                            Last sign-in: {lastSignIn}
                          </Typography>
                        )}
                      </Stack>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Paper>
    </Stack>
  );
}

export default AccountSwapTab;
