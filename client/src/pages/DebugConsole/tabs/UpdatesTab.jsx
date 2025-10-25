import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  createUpdate,
  fetchCurrentUserProfile,
  fetchUpdates
} from '../../../api/mongoDataApi';
import JsonPreview from '../components/JsonPreview';
import { UPDATE_TYPE_OPTIONS } from '../constants';
import {
  parseCommaSeparated,
  parseJsonField,
  parseOptionalNumber
} from '../utils';

function UpdatesTab() {
  const [updateForm, setUpdateForm] = useState({
    userId: '',
    sourceUserId: '',
    targetUserIds: '',
    type: UPDATE_TYPE_OPTIONS[0],
    title: '',
    body: '',
    metadata: '',
    relatedEntities: '',
    pinId: '',
    pinPreview: ''
  });
  const [updateStatus, setUpdateStatus] = useState(null);
  const [updateResult, setUpdateResult] = useState(null);
  const [isCreatingUpdate, setIsCreatingUpdate] = useState(false);

  const [updatesQuery, setUpdatesQuery] = useState({ userId: '', limit: '20' });
  const [updatesStatus, setUpdatesStatus] = useState(null);
  const [updatesResult, setUpdatesResult] = useState(null);
  const [isFetchingUpdates, setIsFetchingUpdates] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isSendingDummy, setIsSendingDummy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await fetchCurrentUserProfile();
        if (cancelled) {
          return;
        }
        const resolved = profile?._id || profile?.userId || profile?.id;
        if (resolved) {
          setCurrentUserId(resolved);
          setUpdatesQuery((prev) => ({ ...prev, userId: prev.userId || resolved }));
        }
      } catch (error) {
        console.warn('Failed to auto-load current profile for updates tab', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateUpdate = async (event) => {
    event.preventDefault();
    setUpdateStatus(null);

    try {
      const userId = updateForm.userId.trim();
      const title = updateForm.title.trim();
      if (!userId || !title) {
        throw new Error('Target user ID and title are required.');
      }

      const payload = {
        userId,
        payload: {
          type: updateForm.type,
          title
        }
      };

      const sourceUserId = updateForm.sourceUserId.trim();
      if (sourceUserId) {
        payload.sourceUserId = sourceUserId;
      }

      const targetUserIds = parseCommaSeparated(updateForm.targetUserIds);
      if (targetUserIds.length) {
        payload.targetUserIds = targetUserIds;
      }

      const body = updateForm.body.trim();
      if (body) {
        payload.payload.body = body;
      }

      const metadata = parseJsonField(updateForm.metadata, 'metadata');
      if (metadata !== undefined) {
        payload.payload.metadata = metadata;
      }

      const relatedEntities = parseJsonField(updateForm.relatedEntities, 'related entities');
      if (relatedEntities !== undefined) {
        payload.payload.relatedEntities = relatedEntities;
      }

      const pinId = updateForm.pinId.trim();
      if (pinId) {
        payload.payload.pinId = pinId;
      }

      const pinPreview = parseJsonField(updateForm.pinPreview, 'pin preview');
      if (pinPreview !== undefined) {
        payload.payload.pinPreview = pinPreview;
      }

      setIsCreatingUpdate(true);
      const result = await createUpdate(payload);
      setUpdateResult(result);
      setUpdateStatus({ type: 'success', message: 'Update created.' });
    } catch (error) {
      setUpdateStatus({ type: 'error', message: error.message || 'Failed to create update.' });
    } finally {
      setIsCreatingUpdate(false);
    }
  };

  const handleFetchUpdates = async (event) => {
    event.preventDefault();
    setUpdatesStatus(null);

    const userId = updatesQuery.userId.trim();
    if (!userId) {
      setUpdatesStatus({ type: 'error', message: 'User ID is required.' });
      return;
    }

    try {
      const query = { userId };
      const limitValue = parseOptionalNumber(updatesQuery.limit, 'Limit');
      if (limitValue !== undefined) {
        if (limitValue <= 0) {
          throw new Error('Limit must be greater than 0.');
        }
        query.limit = limitValue;
      }

      setIsFetchingUpdates(true);
      const updates = await fetchUpdates(query);
      setUpdatesResult(updates);
      setUpdatesStatus({
        type: 'success',
        message: `Loaded ${updates.length} update${updates.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setUpdatesStatus({ type: 'error', message: error.message || 'Failed to load updates.' });
    } finally {
      setIsFetchingUpdates(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Quick actions</Typography>
        <Typography variant="body2" color="text.secondary">
          Drop a canned notification for whichever account you&apos;re logged in with.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="contained"
            disabled={!currentUserId || isSendingDummy}
            onClick={async () => {
              setUpdatesStatus(null);
            if (!currentUserId) {
                setUpdatesStatus({ type: 'error', message: 'Load your profile first.' });
                return;
              }
              try {
                setIsSendingDummy(true);
                const now = new Date();
                const title = 'Debug badge unlocked';
                const body = `You earned a tester badge at ${now.toLocaleTimeString([], {
                  hour: 'numeric',
                  minute: '2-digit'
                })}.`;
                await createUpdate({
                  userId: currentUserId,
                  payload: {
                    type: 'badge-earned',
                    title,
                    body,
                    metadata: {
                      badgeId: 'debug-dummy',
                      badgeLabel: 'Debugger',
                      issuedAt: now.toISOString()
                    },
                    relatedEntities: [
                      { id: currentUserId, type: 'user', label: 'You' }
                    ]
                  }
                });
                try {
                  const query = { userId: currentUserId };
                  const limitValue = parseOptionalNumber(updatesQuery.limit, 'Limit');
                  if (limitValue && limitValue > 0) {
                    query.limit = limitValue;
                  }
                  const refreshed = await fetchUpdates(query);
                  setUpdatesResult(refreshed);
                } catch (fetchError) {
                  console.warn('Failed to refresh updates after dummy send', fetchError);
                }
                setUpdatesStatus({ type: 'success', message: 'Dummy update queued for your account.' });
              } catch (error) {
                setUpdatesStatus({
                  type: 'error',
                  message: error?.message || 'Failed to send dummy update.'
                });
              } finally {
                setIsSendingDummy(false);
              }
            }}
          >
            {isSendingDummy ? 'Sending...' : 'Send dummy update to me'}
          </Button>
          <Button
            variant="outlined"
            onClick={async () => {
              try {
                const profile = await fetchCurrentUserProfile();
                const resolved = profile?._id || profile?.userId || profile?.id;
                if (resolved) {
                  setCurrentUserId(resolved);
                  setUpdatesQuery((prev) => ({ ...prev, userId: resolved }));
                } else {
                  setUpdatesStatus({ type: 'error', message: 'Current profile id is unavailable.' });
                }
              } catch (error) {
                setUpdatesStatus({
                  type: 'error',
                  message: error?.message || 'Failed to load current user profile.'
                });
              }
            }}
          >
            Use my profile id
          </Button>
        </Stack>
      </Paper>

      <Paper
        component="form"
        onSubmit={handleCreateUpdate}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create user update</Typography>
        <Typography variant="body2" color="text.secondary">
          Generate feed notifications for a user to exercise the updates API.
        </Typography>
        {updateStatus && (
          <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
            {updateStatus.message}
          </Alert>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Target user ID"
              value={updateForm.userId}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, userId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Source user ID"
              value={updateForm.sourceUserId}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, sourceUserId: event.target.value }))}
              fullWidth
            />
          </Stack>
          <TextField
            label="Additional target user IDs (comma separated)"
            value={updateForm.targetUserIds}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, targetUserIds: event.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Type"
              value={updateForm.type}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, type: event.target.value }))}
              select
              sx={{ minWidth: 220 }}
            >
              {UPDATE_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={updateForm.title}
              onChange={(event) => setUpdateForm((prev) => ({ ...prev, title: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Body"
            value={updateForm.body}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, body: event.target.value }))}
            multiline
            minRows={3}
            fullWidth
          />
          <TextField
            label="Metadata JSON"
            value={updateForm.metadata}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, metadata: event.target.value }))}
            multiline
            minRows={3}
            placeholder='e.g. { "cta": "View pin" }'
            fullWidth
          />
          <TextField
            label="Related entities JSON"
            value={updateForm.relatedEntities}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, relatedEntities: event.target.value }))}
            multiline
            minRows={3}
            placeholder='e.g. [{ "id": "...", "type": "pin", "label": "Community Cleanup" }]'
            fullWidth
          />
          <TextField
            label="Pin ID (auto-populate preview)"
            value={updateForm.pinId}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, pinId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Pin preview JSON"
            value={updateForm.pinPreview}
            onChange={(event) => setUpdateForm((prev) => ({ ...prev, pinPreview: event.target.value }))}
            multiline
            minRows={3}
            placeholder='{ "_id": "...", "type": "event", "creatorId": "...", "title": "...", "latitude": 33.77, "longitude": -118.19 }'
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingUpdate}>
              {isCreatingUpdate ? 'Creating...' : 'Create update'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setUpdateForm({
                  userId: '',
                  sourceUserId: '',
                  targetUserIds: '',
                  type: UPDATE_TYPE_OPTIONS[0],
                  title: '',
                  body: '',
                  metadata: '',
                  relatedEntities: '',
                  pinId: '',
                  pinPreview: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={updateResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchUpdates}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch updates</Typography>
        <Typography variant="body2" color="text.secondary">
          Inspect the notification queue for a given user.
        </Typography>
        {updatesStatus && (
          <Alert severity={updatesStatus.type} onClose={() => setUpdatesStatus(null)}>
            {updatesStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={updatesQuery.userId}
            onChange={(event) => setUpdatesQuery((prev) => ({ ...prev, userId: event.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Limit"
            value={updatesQuery.limit}
            onChange={(event) => setUpdatesQuery((prev) => ({ ...prev, limit: event.target.value }))}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Button type="submit" variant="outlined" disabled={isFetchingUpdates}>
            {isFetchingUpdates ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={updatesResult} />
      </Paper>
    </Stack>
  );
}

export default UpdatesTab;
