import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';

import JsonPreview from '../components/JsonPreview';
import DebugPanel from '../components/DebugPanel';
import useUpdatesTools, { INITIAL_UPDATE_FORM } from '../hooks/useUpdatesTools';
import { UPDATE_TYPE_OPTIONS } from '../constants';

function UpdatesTab() {
  const {
    updateForm,
    setUpdateForm,
    updateStatus,
    setUpdateStatus,
    updateResult,
    isCreatingUpdate,
    handleCreateUpdate,
    updatesQuery,
    setUpdatesQuery,
    updatesStatus,
    setUpdatesStatus,
    updatesResult,
    isFetchingUpdates,
    handleFetchUpdates,
    currentUserId,
    sendDummyBadgeUpdate,
    sendDummyEventUpdate,
    sendDummyDiscussionUpdate,
    reloadCurrentProfile,
    isSendingDummy,
    dummyStatus,
    setDummyStatus
  } = useUpdatesTools();

  const quickActionsAlerts = [
    dummyStatus
      ? {
          key: 'quick-action-status',
          severity: dummyStatus.type,
          content: dummyStatus.message,
          onClose: () => setDummyStatus(null)
        }
      : null
  ].filter(Boolean);

  const createAlerts = [
    updateStatus
      ? {
          key: 'create-update-status',
          severity: updateStatus.type,
          content: updateStatus.message,
          onClose: () => setUpdateStatus(null)
        }
      : null
  ].filter(Boolean);

  const fetchAlerts = [
    updatesStatus && updatesResult
      ? {
          key: 'fetch-updates-status',
          severity: updatesStatus.type,
          content: updatesStatus.message,
          onClose: () => setUpdatesStatus(null)
        }
      : null
  ].filter(Boolean);

  return (
    <Stack spacing={2}>
      <DebugPanel
        title="Quick actions"
        description="Drop canned notifications for whichever account you're logged in with."
        actions={[
          <Button
            key="badge"
            variant="contained"
            disabled={!currentUserId || isSendingDummy}
            onClick={sendDummyBadgeUpdate}
          >
            {isSendingDummy ? 'Sending...' : 'Send dummy badge update'}
          </Button>,
          <Button
            key="event"
            variant="contained"
            disabled={!currentUserId || isSendingDummy}
            onClick={sendDummyEventUpdate}
          >
            {isSendingDummy ? 'Sending...' : 'Send dummy event update'}
          </Button>,
          <Button
            key="discussion"
            variant="contained"
            disabled={!currentUserId || isSendingDummy}
            onClick={sendDummyDiscussionUpdate}
          >
            {isSendingDummy ? 'Sending...' : 'Send dummy discussion update'}
          </Button>,
          <Button key="reload" variant="outlined" onClick={reloadCurrentProfile}>
            Use my profile id
          </Button>
        ]}
        alerts={quickActionsAlerts}
      />

      <DebugPanel
        component="form"
        onSubmit={handleCreateUpdate}
        title="Create user update"
        description="Generate feed notifications for a user to exercise the updates API."
        alerts={createAlerts}
      >
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
            <Button type="button" variant="text" onClick={() => setUpdateForm(INITIAL_UPDATE_FORM)}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={updateResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchUpdates}
        title="Fetch updates"
        description="Inspect the notification queue for a given user."
        alerts={fetchAlerts}
      >
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
      </DebugPanel>
    </Stack>
  );
}

export default UpdatesTab;
