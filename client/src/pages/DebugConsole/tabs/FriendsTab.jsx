import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DebugPanel from '../components/DebugPanel';
import useFriendsTools from '../hooks/useFriendsTools';
import { formatReadableTimestamp } from '../utils';

const FriendsTab = () => {
  const {
    isLoadingOverview,
    overviewStatus,
    refreshOverview,
    friends,
    incomingRequests,
    outgoingRequests,
    searchTerm,
    setSearchTerm,
    handleSearch,
    searchResults,
    isSearching,
    searchStatus,
    requestForm,
    updateRequestForm,
    submitFriendRequest,
    requestStatus,
    isSendingRequest,
    respondToRequestQueue,
    removeFriend,
    queueStatus,
    isUpdatingQueue,
    hasAccess
  } = useFriendsTools();

  const overviewAlerts = [];
  if (overviewStatus) {
    overviewAlerts.push({
      severity: overviewStatus.type,
      content: overviewStatus.message
    });
  }

  const searchAlerts = [];
  if (searchStatus) {
    searchAlerts.push({
      severity: searchStatus.type,
      content: searchStatus.message
    });
  }

  const requestAlerts = [];
  if (requestStatus) {
    requestAlerts.push({
      severity: requestStatus.type,
      content: requestStatus.message
    });
  }

  const queueAlerts = [];
  if (queueStatus) {
    queueAlerts.push({
      severity: queueStatus.type,
      content: queueStatus.message
    });
  }

  if (hasAccess === false) {
    return (
      <Stack spacing={3}>
        <DebugPanel
          title="Friends Admin Tools"
          description="These controls are restricted to friend-management roles when running online."
          alerts={[
            {
              severity: 'warning',
              content:
                'Friend management privileges required. Ask an administrator to grant access or continue using the offline sandbox.'
            }
          ]}
        >
          <Typography variant="body2" color="text.secondary">
            The server rejected the latest request with HTTP 403. Debug friend tooling remains available
            when running locally (offline mode) or once your account is placed on the friend-admin allowlist.
          </Typography>
        </DebugPanel>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <DebugPanel
        title="Friend Overview"
        description="Quick snapshot of relationships. Offline sandbox exposes all admin tools."
        alerts={overviewAlerts}
        actions={
          <Button variant="outlined" onClick={refreshOverview} disabled={isLoadingOverview}>
            {isLoadingOverview ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      >
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Friends
            </Typography>
            <Typography variant="h5">{friends.length}</Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Incoming Requests
            </Typography>
            <Typography variant="h5">{incomingRequests.length}</Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" color="text.secondary">
              Outgoing Requests
            </Typography>
            <Typography variant="h5">{outgoingRequests.length}</Typography>
          </Grid>
        </Grid>
      </DebugPanel>

      <DebugPanel
        title="Send Friend Request"
        description="Search for a user and send a targeted request."
        alerts={[...searchAlerts, ...requestAlerts]}
        actions={
          <Button
            variant="contained"
            disabled={isSendingRequest || !requestForm.targetUserId}
            onClick={() => submitFriendRequest()}
          >
            {isSendingRequest ? 'Sending…' : 'Send Request'}
          </Button>
        }
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              label="Search users"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Name, username, or email"
              fullWidth
            />
            <Button variant="outlined" onClick={() => handleSearch()} disabled={isSearching}>
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
          </Stack>

          {searchResults.length ? (
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Results
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {searchResults.map((user) => {
                  const id = user._id || user.id;
                  const label = user.displayName || user.username || id;
                  return (
                    <Chip
                      key={id}
                      label={label}
                      onClick={() => updateRequestForm('targetUserId', id)}
                      color={requestForm.targetUserId === id ? 'primary' : 'default'}
                    />
                  );
                })}
              </Stack>
            </Stack>
          ) : null}

          <TextField
            label="Target user id"
            value={requestForm.targetUserId}
            onChange={(event) => updateRequestForm('targetUserId', event.target.value)}
            fullWidth
          />

          <TextField
            label="Message (optional)"
            value={requestForm.message}
            onChange={(event) => updateRequestForm('message', event.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Share context for the request"
          />
        </Stack>
      </DebugPanel>

      <DebugPanel
        title="Pending Requests"
        description="Approve or decline inbound requests; track pending outbound invites."
        alerts={queueAlerts}
      >
        <Stack spacing={3}>
          <div>
            <Typography variant="subtitle1" gutterBottom>
              Incoming
            </Typography>
            {incomingRequests.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>From</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Received</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {incomingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {request.requester?.displayName || request.requester?.username || request.requester?.id}
                      </TableCell>
                      <TableCell>{request.message || <em>No message</em>}</TableCell>
                      <TableCell>{formatReadableTimestamp(request.createdAt) || '—'}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            disabled={isUpdatingQueue}
                            onClick={() =>
                              respondToRequestQueue({ requestId: request.id, decision: 'accept' })
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            disabled={isUpdatingQueue}
                            onClick={() =>
                              respondToRequestQueue({ requestId: request.id, decision: 'decline' })
                            }
                          >
                            Decline
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No pending incoming requests.
              </Typography>
            )}
          </div>

          <Divider />

          <div>
            <Typography variant="subtitle1" gutterBottom>
              Outgoing
            </Typography>
            {outgoingRequests.length ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>To</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Sent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outgoingRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {request.recipient?.displayName || request.recipient?.username || request.recipient?.id}
                      </TableCell>
                      <TableCell>{request.message || <em>No message</em>}</TableCell>
                      <TableCell>{formatReadableTimestamp(request.createdAt) || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No outgoing requests waiting on a response.
              </Typography>
            )}
          </div>
        </Stack>
      </DebugPanel>

      <DebugPanel
        title="Friends List"
        description="Remove demo friendships or inspect metadata before rolling into the main app."
      >
        {friends.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Stats</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {friends.map((friend) => (
                <TableRow key={friend.id}>
                  <TableCell>{friend.displayName || friend.username || friend.id}</TableCell>
                  <TableCell>
                    {friend.roles?.length ? friend.roles.join(', ') : <Typography variant="body2">—</Typography>}
                  </TableCell>
                  <TableCell>
                    {friend.stats ? (
                      <Typography variant="body2" color="text.secondary">
                        {`Followers: ${friend.stats.followers ?? 0}, Following: ${friend.stats.following ?? 0}`}
                      </Typography>
                    ) : (
                      <Typography variant="body2">—</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      color="error"
                      disabled={isUpdatingQueue}
                      onClick={() => removeFriend(friend.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No friends linked yet. Use the form above to invite contacts.
          </Typography>
        )}
      </DebugPanel>
    </Stack>
  );
};

export default FriendsTab;
