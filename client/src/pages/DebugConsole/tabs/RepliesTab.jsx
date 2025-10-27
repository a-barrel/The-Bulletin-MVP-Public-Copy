import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { createReply, fetchReplies } from '../../../api/mongoDataApi';
import JsonPreview from '../components/JsonPreview';
import { parseCommaSeparated } from '../utils';

function RepliesTab() {
  const [replyForm, setReplyForm] = useState({
    pinId: '',
    authorId: '',
    message: '',
    parentReplyId: '',
    mentionedUserIds: ''
  });
  const [replyStatus, setReplyStatus] = useState(null);
  const [replyResult, setReplyResult] = useState(null);
  const [isCreatingReply, setIsCreatingReply] = useState(false);

  const [repliesPinId, setRepliesPinId] = useState('');
  const [repliesStatus, setRepliesStatus] = useState(null);
  const [repliesResult, setRepliesResult] = useState(null);
  const [isFetchingReplies, setIsFetchingReplies] = useState(false);

  const handleCreateReply = async (event) => {
    event.preventDefault();
    setReplyStatus(null);

    try {
      const pinId = replyForm.pinId.trim();
      const authorId = replyForm.authorId.trim();
      const message = replyForm.message.trim();
      if (!pinId || !authorId || !message) {
        throw new Error('Pin ID, author ID, and message are required.');
      }

      const payload = {
        pinId,
        authorId,
        message
      };

      const parentReplyId = replyForm.parentReplyId.trim();
      if (parentReplyId) {
        payload.parentReplyId = parentReplyId;
      }

      const mentionedUserIds = parseCommaSeparated(replyForm.mentionedUserIds);
      if (mentionedUserIds.length) {
        payload.mentionedUserIds = mentionedUserIds;
      }

      setIsCreatingReply(true);
      const result = await createReply(payload);
      setReplyResult(result);
      setReplyStatus({ type: 'success', message: 'Reply created.' });
    } catch (error) {
      setReplyStatus({ type: 'error', message: error.message || 'Failed to create reply.' });
    } finally {
      setIsCreatingReply(false);
    }
  };

  const handleFetchReplies = async (event) => {
    event.preventDefault();
    setRepliesStatus(null);
    const pinId = repliesPinId.trim();
    if (!pinId) {
      setRepliesStatus({ type: 'error', message: 'Pin ID is required.' });
      return;
    }

    try {
      setIsFetchingReplies(true);
      const replies = await fetchReplies(pinId);
      setRepliesResult(replies);
      setRepliesStatus({
        type: 'success',
        message: `Loaded ${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}.`
      });
    } catch (error) {
      setRepliesStatus({ type: 'error', message: error.message || 'Failed to load replies.' });
    } finally {
      setIsFetchingReplies(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreateReply}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create reply</Typography>
        <Typography variant="body2" color="text.secondary">
          Seed conversations on a pin.
        </Typography>
        {replyStatus && (
          <Alert severity={replyStatus.type} onClose={() => setReplyStatus(null)}>
            {replyStatus.message}
          </Alert>
        )}
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
            onChange={(event) => setReplyForm((prev) => ({ ...prev, parentReplyId: event.target.value }))}
            fullWidth
          />
          <TextField
            label="Mentioned user IDs (comma separated)"
            value={replyForm.mentionedUserIds}
            onChange={(event) => setReplyForm((prev) => ({ ...prev, mentionedUserIds: event.target.value }))}
            fullWidth
          />
          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreatingReply}>
              {isCreatingReply ? 'Creating...' : 'Create reply'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setReplyForm({
                  pinId: '',
                  authorId: '',
                  message: '',
                  parentReplyId: '',
                  mentionedUserIds: ''
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={replyResult} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchReplies}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch replies</Typography>
        <Typography variant="body2" color="text.secondary">
          Retrieve threaded discussions for a pin.
        </Typography>
        {repliesStatus && (
          <Alert severity={repliesStatus.type} onClose={() => setRepliesStatus(null)}>
            {repliesStatus.message}
          </Alert>
        )}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Pin ID"
            value={repliesPinId}
            onChange={(event) => setRepliesPinId(event.target.value)}
            required
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={isFetchingReplies}>
            {isFetchingReplies ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={repliesResult} />
      </Paper>
    </Stack>
  );
}

export default RepliesTab;
