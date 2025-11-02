import { useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DebugPanel from '../components/DebugPanel';
import useModerationTools from '../hooks/useModerationTools';
import { formatReadableTimestamp } from '../utils';

const ACTION_OPTIONS = [
  { value: 'warn', label: 'Warn user' },
  { value: 'report', label: 'Report user (5s rate limit)' },
  { value: 'mute', label: 'Mute user' },
  { value: 'unmute', label: 'Unmute user' },
  { value: 'block', label: 'Block user' },
  { value: 'unblock', label: 'Unblock user' },
  { value: 'ban', label: 'Ban (set suspended)' },
  { value: 'unban', label: 'Unban (set active)' }
];

const ModerationTab = () => {
  const {
    overview,
    overviewStatus,
    flaggedUsers,
    selectedUserId,
    handleSelectUser,
    history,
    historyStatus,
    isLoadingHistory,
    actionForm,
    updateActionField,
    submitAction,
    isSubmitting,
    actionStatus,
    searchTerm,
    setSearchTerm,
    runSearch,
    searchResults,
    isSearching,
    searchStatus
  } = useModerationTools();

  const selectedUser = useMemo(() => {
    if (!selectedUserId || !overview) {
      return null;
    }

    const pools = [
      overview.viewer,
      ...(overview.blockedUsers || []),
      ...(overview.mutedUsers || []),
      ...flaggedUsers.map((entry) => entry.user).filter(Boolean),
      ...searchResults
    ].filter(Boolean);

    return pools.find((user) => user.id === selectedUserId) || { id: selectedUserId };
  }, [selectedUserId, overview, flaggedUsers, searchResults]);

  const resolvedDurationDisabled = actionForm.type !== 'mute';
  const searchAlerts = [];
  if (searchStatus) {
    searchAlerts.push({
      severity: searchStatus.type,
      content: searchStatus.message
    });
  }

  const actionAlerts = [];
  if (actionStatus) {
    actionAlerts.push({
      severity: actionStatus.type,
      content: actionStatus.message
    });
  }

  const overviewAlerts = [];
  if (overviewStatus) {
    overviewAlerts.push({
      severity: overviewStatus.type,
      content: overviewStatus.message
    });
  }

  const historyAlerts = [];
  if (historyStatus) {
    historyAlerts.push({
      severity: historyStatus.type,
      content: historyStatus.message
    });
  }

  return (
    <Stack spacing={3}>
      <DebugPanel
        title="Moderation Overview"
        description="Live snapshot of blocked, muted, and heavily moderated users."
        alerts={overviewAlerts}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Blocked Users
            </Typography>
            <Stack spacing={1}>
              {overview?.blockedUsers?.length ? (
                overview.blockedUsers.map((user) => (
                  <Button
                    key={user.id}
                    variant={selectedUserId === user.id ? 'contained' : 'outlined'}
                    onClick={() => handleSelectUser(user.id)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {user.displayName || user.username || user.id}
                  </Button>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No blocked users.
                </Typography>
              )}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" gutterBottom>
              Muted Users
            </Typography>
            <Stack spacing={1}>
              {overview?.mutedUsers?.length ? (
                overview.mutedUsers.map((user) => (
                  <Button
                    key={user.id}
                    variant={selectedUserId === user.id ? 'contained' : 'outlined'}
                    onClick={() => handleSelectUser(user.id)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {user.displayName || user.username || user.id}
                  </Button>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No muted users.
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" gutterBottom>
          Frequent Moderation Targets
        </Typography>
        {flaggedUsers.length ? (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {flaggedUsers.map((entry) => (
              <Chip
                key={entry?.user?.id ?? entry.count}
                label={`${entry?.user?.displayName || entry?.user?.username || entry?.user?.id || 'Unknown'} · ${
                  entry.count
                } actions`}
                color={selectedUserId === entry?.user?.id ? 'primary' : 'default'}
                onClick={() => entry?.user?.id && handleSelectUser(entry.user.id)}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No recent moderation activity.
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="Moderation Search & Actions"
        description="Locate a user by id or display name, then perform moderation actions."
        alerts={actionAlerts}
        actions={
          <Button
            variant="contained"
            disabled={isSubmitting || !actionForm.userId}
            onClick={() => submitAction()}
          >
            {isSubmitting ? 'Submitting…' : 'Apply Action'}
          </Button>
        }
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Search users"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              fullWidth
              placeholder="Enter name, email, or id"
            />
            <Button variant="outlined" onClick={() => runSearch()} disabled={isSearching}>
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
          </Stack>

          {searchAlerts.length ? (
            searchAlerts.map((alert, index) => (
              <Alert key={index} severity={alert.severity}>
                {alert.content}
              </Alert>
            ))
          ) : null}

          {searchResults.length ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Search results
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {searchResults.map((user) => (
                  <Chip
                    key={user._id || user.id}
                    label={`${user.displayName || user.username || user._id}${
                      user.roles?.length ? ` (${user.roles.join(', ')})` : ''
                    }`}
                    color={selectedUserId === (user._id || user.id) ? 'primary' : 'default'}
                    onClick={() => handleSelectUser(user._id || user.id)}
                  />
                ))}
              </Stack>
            </Stack>
          ) : null}

          <Divider />

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Target user id"
                value={actionForm.userId}
                onChange={(event) => updateActionField('userId', event.target.value)}
                fullWidth
                helperText={
                  selectedUser
                    ? `Selected: ${selectedUser.displayName || selectedUser.username || selectedUser.id}`
                    : 'Paste a user id to moderate.'
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Action"
                select
                fullWidth
                value={actionForm.type}
                onChange={(event) => updateActionField('type', event.target.value)}
              >
                {ACTION_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <TextField
            label="Reason / Notes"
            value={actionForm.reason}
            onChange={(event) => updateActionField('reason', event.target.value)}
            multiline
            minRows={2}
            fullWidth
            placeholder="Provide context for this action"
          />

          <TextField
            label="Duration (minutes, mute only)"
            value={actionForm.durationMinutes}
            onChange={(event) => updateActionField('durationMinutes', event.target.value)}
            type="number"
            disabled={resolvedDurationDisabled}
            inputProps={{ min: 1, step: 1 }}
            helperText={resolvedDurationDisabled ? 'Only used when muting a user.' : undefined}
            sx={{ maxWidth: 240 }}
          />
        </Stack>
      </DebugPanel>

      <DebugPanel
        title="Recent Moderation Activity"
        description="Review the last 25 actions across the network."
        sx={{ overflowX: 'auto' }}
      >
        {overview?.recentActions?.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Moderator</TableCell>
                <TableCell>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overview.recentActions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell>{formatReadableTimestamp(action.createdAt) || '—'}</TableCell>
                  <TableCell>{action.type}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => action.subject?.id && handleSelectUser(action.subject.id)}
                    >
                      {action.subject?.displayName || action.subject?.username || action.subject?.id}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {action.moderator?.displayName || action.moderator?.username || action.moderator?.id}
                  </TableCell>
                  <TableCell>{action.reason || <em>No reason provided</em>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No moderation actions recorded yet.
          </Typography>
        )}
      </DebugPanel>

      <DebugPanel
        title="User Moderation History"
        description="Inspect the audit log for the selected user."
        alerts={historyAlerts}
        sx={{ overflowX: 'auto' }}
      >
        {isLoadingHistory ? (
          <Typography variant="body2" color="text.secondary">
            Loading history…
          </Typography>
        ) : history?.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Moderator</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Expires</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((action) => (
                <TableRow key={action.id}>
                  <TableCell>{action.type}</TableCell>
                  <TableCell>
                    {action.moderator?.displayName || action.moderator?.username || action.moderator?.id}
                  </TableCell>
                  <TableCell>{action.reason || <em>No reason</em>}</TableCell>
                  <TableCell>{action.expiresAt ? formatReadableTimestamp(action.expiresAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : selectedUserId ? (
          <Typography variant="body2" color="text.secondary">
            No moderation history recorded for {selectedUser?.displayName || selectedUser?.username || selectedUserId}.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Select a user to load their moderation history.
          </Typography>
        )}
      </DebugPanel>
    </Stack>
  );
};

export default ModerationTab;
