import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import JsonPreview from '../components/JsonPreview';
import DebugPanel from '../components/DebugPanel';
import useRepliesTools from '../hooks/useRepliesTools';

function RepliesTab() {
  const {
    replyForm,
    setReplyForm,
    replyStatus,
    setReplyStatus,
    replyResult,
    isCreatingReply,
    handleCreateReply,
    resetReplyForm,
    repliesPinId,
    setRepliesPinId,
    repliesStatus,
    setRepliesStatus,
    repliesResult,
    isFetchingReplies,
    handleFetchReplies
  } = useRepliesTools();

  const createAlerts = replyStatus
    ? [
        {
          key: 'reply-status',
          severity: replyStatus.type,
          content: replyStatus.message,
          onClose: () => setReplyStatus(null)
        }
      ]
    : [];

  const fetchAlerts = repliesStatus
    ? [
        {
          key: 'replies-status',
          severity: repliesStatus.type,
          content: repliesStatus.message,
          onClose: () => setRepliesStatus(null)
        }
      ]
    : [];

  return (
    <Stack spacing={2}>
      <DebugPanel
        component="form"
        onSubmit={handleCreateReply}
        title="Create reply"
        description="Seed conversations on a pin."
        alerts={createAlerts}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Pin ID"
              value={replyForm.pinId}
              onChange={(event) => setReplyForm((prev) => ({ ...prev, pinId: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Author ID"
              value={replyForm.authorId}
              onChange={(event) => setReplyForm((prev) => ({ ...prev, authorId: event.target.value }))}
              required
              fullWidth
            />
          </Stack>
          <TextField
            label="Message"
            value={replyForm.message}
            onChange={(event) => setReplyForm((prev) => ({ ...prev, message: event.target.value }))}
            multiline
            minRows={3}
            required
            fullWidth
          />
          <TextField
            label="Parent reply ID"
            value={replyForm.parentReplyId}
            onChange={(event) =>
              setReplyForm((prev) => ({ ...prev, parentReplyId: event.target.value }))
            }
            fullWidth
          />
          <TextField
            label="Mentioned user IDs (comma separated)"
            value={replyForm.mentionedUserIds}
            onChange={(event) =>
              setReplyForm((prev) => ({ ...prev, mentionedUserIds: event.target.value }))
            }
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingReply}>
              {isCreatingReply ? 'Creating…' : 'Create reply'}
            </Button>
            <Button type="button" variant="text" onClick={resetReplyForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={replyResult} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchReplies}
        title="Fetch replies"
        description="Retrieve threaded discussions for a pin."
        alerts={fetchAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Pin ID"
            value={repliesPinId}
            onChange={(event) => setRepliesPinId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingReplies}>
            {isFetchingReplies ? 'Loading…' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={repliesResult} />
      </DebugPanel>
    </Stack>
  );
}

export default RepliesTab;
