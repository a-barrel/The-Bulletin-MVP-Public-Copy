import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Button,
  FormControlLabel,
  Switch
} from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';

export default function PinEditDialog({
  open,
  onClose,
  onSubmit,
  onDelete,
  editForm,
  onChange,
  editError,
  editDialogBusy
}) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={editDialogBusy ? undefined : onClose}
      aria-labelledby="edit-pin-dialog-title"
      PaperProps={{ className: 'edit-pin-dialog' }}
    >
      <form onSubmit={onSubmit} className="edit-pin-dialog__form">
        <DialogTitle id="edit-pin-dialog-title" className="edit-pin-dialog__title">
          Edit pin
        </DialogTitle>
        <DialogContent dividers className="edit-pin-dialog__content">
          {editError ? (
            <Alert severity="error" className="edit-pin-dialog__alert">
              {editError}
            </Alert>
          ) : null}
          <TextField
            label="Title"
            fullWidth
            margin="dense"
            value={editForm?.title ?? ''}
            onChange={(event) => onChange({ ...editForm, title: event.target.value })}
            disabled={editDialogBusy}
            className="edit-pin-dialog__field"
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            margin="dense"
            value={editForm?.description ?? ''}
            onChange={(event) => onChange({ ...editForm, description: event.target.value })}
            disabled={editDialogBusy}
            className="edit-pin-dialog__field"
          />
          <TextField
            label="Interaction radius (meters)"
            fullWidth
            margin="dense"
            type="number"
            value={editForm?.proximityRadiusMeters ?? ''}
            onChange={(event) => onChange({ ...editForm, proximityRadiusMeters: event.target.value })}
            disabled={editDialogBusy}
            className="edit-pin-dialog__field"
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Start date (optional)"
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={editForm?.startDate ?? ''}
              onChange={(event) => onChange({ ...editForm, startDate: event.target.value })}
              disabled={editDialogBusy}
              className="edit-pin-dialog__field"
            />
            <TextField
              label="End date (optional)"
              type="datetime-local"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={editForm?.endDate ?? ''}
              onChange={(event) => onChange({ ...editForm, endDate: event.target.value })}
              disabled={editDialogBusy}
              className="edit-pin-dialog__field"
            />
          </Stack>
          <TextField
            label="Expiration (optional)"
            type="datetime-local"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={editForm?.expiresAt ?? ''}
            onChange={(event) => onChange({ ...editForm, expiresAt: event.target.value })}
            disabled={editDialogBusy}
            className="edit-pin-dialog__field"
            helperText="Pin is auto-removed at expiration"
          />
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(editForm?.autoDelete)}
                onChange={(event) => onChange({ ...editForm, autoDelete: event.target.checked })}
                disabled={editDialogBusy}
                color="primary"
              />
            }
            label="Auto-delete at expiration"
            className="edit-pin-dialog__toggle"
          />
        </DialogContent>
        <DialogActions className="edit-pin-dialog__actions">
          <Button
            startIcon={<DeleteIcon />}
            onClick={onDelete}
            disabled={editDialogBusy}
            className="edit-pin-dialog__button edit-pin-dialog__button--destructive"
          >
            Delete pin
          </Button>
          <Button
            startIcon={<RestartAltIcon />}
            onClick={onClose}
            disabled={editDialogBusy}
            className="edit-pin-dialog__button edit-pin-dialog__button--secondary"
          >
            Cancel
          </Button>
          <Button
            startIcon={<SaveIcon />}
            type="submit"
            disabled={editDialogBusy}
            className="edit-pin-dialog__button edit-pin-dialog__button--primary"
          >
            Save changes
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
