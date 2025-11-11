import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

function ProfileEditForm({
  displayName,
  formState,
  isSaving,
  editingAvatarSrc,
  editingBannerSrc,
  updateStatus,
  onDismissUpdateStatus,
  onSubmit,
  onCancel,
  onAvatarFileChange,
  onBannerFileChange,
  onClearAvatar,
  onClearBanner,
  onFieldChange,
  onThemeChange,
  onToggleLocationSharing
}) {
  return (
    <Stack
      spacing={2}
      sx={{
        alignSelf: 'center',
        maxWidth: 720,
        width: '100%',
        margin: '1.5rem auto 0',
        backgroundColor: '#ECF8FE',
        borderRadius: 3,
        boxShadow: '0 18px 40px rgba(93, 56, 137, 0.15)',
        p: { xs: 2, md: 3 }
      }}
    >
      {updateStatus ? (
        <Alert severity={updateStatus.type} onClose={onDismissUpdateStatus} sx={{
          backgroundColor:
            updateStatus.type === 'success'
              ? 'rgba(76, 175, 80, 0.15)'
              : updateStatus.type === 'error'
                ? 'rgba(244, 67, 54, 0.15)'
                : updateStatus.type === 'warning'
                  ? 'rgba(255, 193, 7, 0.15)'
                  : 'rgba(33, 150, 243, 0.15)',
          color: 'text.primary',
          '& .MuiAlert-icon': {
            color:
              updateStatus.type === 'success'
                ? 'success.main'
                : updateStatus.type === 'error'
                  ? 'error.main'
                  : updateStatus.type === 'warning'
                    ? 'warning.main'
                    : 'info.main'
          }
        }}>
          {updateStatus.message}
        </Alert>
      ) : null}

      <Stack
        component="form"
        spacing={2}
        onSubmit={onSubmit}
        sx={{
          p: 2,
          borderRadius: 2,
          backgroundColor: '#ECF8FE',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)'
        }}
      >
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Profile banner
          </Typography>
          <Box
            sx={{
              width: '100%',
              minHeight: 140,
              borderRadius: 2,
              overflow: 'hidden',
              backgroundColor: 'grey.800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {editingBannerSrc ? (
              <Box
                component="img"
                src={editingBannerSrc}
                alt="Profile banner preview"
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No banner selected.
              </Typography>
            )}
          </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            component="label"
            variant="outlined"
            size="small"
            disabled={isSaving}
            sx={{ borderWidth: 2, borderColor: '#000', color: '#000' }}
          >
            Upload banner
            <input type="file" hidden accept="image/*" onChange={onBannerFileChange} />
          </Button>
          <Button
            type="button"
            variant="text"
            color="warning"
            size="small"
            onClick={onClearBanner}
            disabled={
              isSaving || (formState.bannerCleared && !formState.bannerFile && !editingBannerSrc)
            }
            sx={{ color: '#5D3889' }}
          >
            Remove banner
          </Button>
        </Stack>
      </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <Avatar
            src={editingAvatarSrc || undefined}
            alt="Profile avatar preview"
            sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
          >
            {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
          </Avatar>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              component="label"
              variant="outlined"
              size="small"
              disabled={isSaving}
              sx={{ borderWidth: 2, borderColor: '#000', color: '#000' }}
            >
              Upload avatar
              <input type="file" hidden accept="image/*" onChange={onAvatarFileChange} />
            </Button>
            <Button
              type="button"
              variant="text"
              color="warning"
              size="small"
              onClick={onClearAvatar}
              disabled={
                isSaving || (formState.avatarCleared && !formState.avatarFile && !editingAvatarSrc)
              }
              sx={{ color: '#5D3889' }}
            >
              Remove avatar
            </Button>
          </Stack>
        </Stack>

        <TextField
          label="Display name"
          value={formState.displayName}
          onChange={onFieldChange('displayName')}
          required
          disabled={isSaving}
          fullWidth
          InputProps={{ sx: { '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: '#000' } } }}
          InputLabelProps={{ sx: { color: '#1f1336' } }}
        />

        <TextField
          label="Bio"
          value={formState.bio}
          onChange={onFieldChange('bio')}
          multiline
          minRows={3}
          helperText="Share something about yourself (500 characters max)."
          disabled={isSaving}
          inputProps={{ maxLength: 500 }}
          fullWidth
          InputProps={{ sx: { '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: '#000' } } }}
          InputLabelProps={{ sx: { color: '#1f1336' } }}
        />

        <TextField
          label="Theme preference"
          value={formState.theme}
          onChange={onThemeChange}
          select
          disabled={isSaving}
          fullWidth
          InputProps={{ sx: { '& .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: '#000' } } }}
          InputLabelProps={{ sx: { color: '#1f1336' } }}
        >
          <MenuItem value="system">System default</MenuItem>
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="dark">Dark</MenuItem>
        </TextField>

        <FormControlLabel
          control={
            <Switch
              checked={formState.locationSharingEnabled}
              onChange={onToggleLocationSharing}
              color="primary"
              disabled={isSaving}
            />
          }
          label="Share location with nearby features"
          sx={{ color: '#1f1336' }}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
          <Button type="button" variant="outlined" color="inherit" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

export default ProfileEditForm;
