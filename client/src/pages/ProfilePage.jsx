import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';

import runtimeConfig from '../config/runtime';
import { BADGE_METADATA } from '../utils/badges';
import { routes } from '../routes';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import useProfileDetail from '../hooks/useProfileDetail';

export const pageConfig = {
  id: 'profile',
  label: 'Profile',
  icon: AccountCircleIcon,
  path: '/profile/:userId',
  order: 91,
  showInNav: true,
  protected: true,
  resolveNavTarget: ({ currentPath } = {}) => {
    if (!runtimeConfig.isOffline) {
      return routes.profile.me;
    }

    if (typeof window === 'undefined') {
      return routes.profile.me;
    }

    const input = window.prompt(
      'Enter a profile ID (leave blank for your profile, type "me" or cancel to stay put):'
    );
    if (input === null) {
      return currentPath ?? null;
    }
    const trimmed = input.trim();
    if (!trimmed || trimmed.toLowerCase() === 'me') {
      return routes.profile.me;
    }
    const sanitized = trimmed.replace(/^\/+/, '');
    if (/^profile\/.+/i.test(sanitized)) {
      return `/${sanitized}`;
    }
    if (/^\/profile\/.+/i.test(trimmed)) {
      return trimmed;
    }
    return routes.profile.byId(sanitized);
  }
};

const resolveBadgeImageUrl = (value) => {
  if (!value) {
    return '—';
  }
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) {
    return '—';
  }
  const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
  const normalized = value.startsWith('/') ? value : `/${value}`;
  return base ? `${base}${normalized}` : normalized;
};

const formatEntryValue = (value) => {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return '[unserializable object]';
    }
  }
  return String(value);
};

const Section = ({ title, description, children }) => (
  <Stack spacing={1.5}>
    <Box>
      <Typography variant="h6" component="h2">
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      ) : null}
    </Box>
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default',
        p: { xs: 2, md: 3 }
      }}
    >
      {children}
    </Box>
  </Stack>
);

function ProfilePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { isOffline } = useNetworkStatusContext();

  const {
    originPath,
    targetUserId,
    effectiveUser,
    displayName,
    avatarUrl,
    hasProfile,
    bioText,
    badgeList,
    statsVisible,
    statsEntries,
    activityEntries,
    preferenceSummary,
    notificationPreferences,
    accountTimeline,
    detailEntries,
    rawDataAvailable,
    showRawData,
    setShowRawData,
    isFetchingProfile,
    fetchError,
    relationshipStatus,
    setRelationshipStatus,
    isEditing,
    formState,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleClearAvatar,
    handleFieldChange,
    handleThemeChange,
    handleToggleLocationSharing,
    handleSaveProfile,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    editingAvatarSrc,
    canEditProfile,
    handleRequestBlock,
    handleRequestUnblock,
    handleCloseBlockDialog,
    handleConfirmBlockDialog,
    blockDialogMode,
    isProcessingBlockAction,
    canManageBlock,
    isBlocked
  } = useProfileDetail({
    userIdParam: userId,
    locationState: location.state,
    isOffline
  });

  const handleBack = () => {
    if (originPath) {
      navigate(originPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <Box
      component="section"
      sx={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 }
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 680,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          backgroundColor: 'background.paper'
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
            <Button
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              size="small"
              color="primary"
              sx={{ alignSelf: 'flex-start' }}
            >
              Back
            </Button>
          </Box>

          {isFetchingProfile ? (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              <CircularProgress size={18} thickness={5} />
              <Typography variant="body2" color="text.secondary">
                Loading profile data...
              </Typography>
            </Stack>
          ) : null}

          {fetchError ? (
            <Alert severity="warning" variant="outlined">
              {fetchError}
            </Alert>
          ) : null}

          {isOffline ? (
            <Alert severity="warning" variant="outlined">
              You are offline. Profile changes and relationship actions are disabled until you reconnect.
            </Alert>
          ) : null}

          {relationshipStatus ? (
            <Alert severity={relationshipStatus.type} onClose={() => setRelationshipStatus(null)}>
              {relationshipStatus.message}
            </Alert>
          ) : null}

          <Stack spacing={2} alignItems="center" textAlign="center">
            <Avatar
              src={avatarUrl}
              alt={`${displayName} avatar`}
              sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
            >
              {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1">
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                User ID: {effectiveUser?._id || targetUserId || 'N/A'}
              </Typography>
            </Box>
            {!hasProfile && !isFetchingProfile && !fetchError ? (
              <Typography variant="body2" color="text.secondary">
                No additional user context was provided. Use a pin, reply, or enter a valid user ID to see
                more detail here.
              </Typography>
            ) : null}
            {canManageBlock ? (
              <Button
                variant="outlined"
                startIcon={isBlocked ? <HowToRegIcon /> : <BlockIcon />}
                color={isBlocked ? 'primary' : 'error'}
                onClick={isBlocked ? handleRequestUnblock : handleRequestBlock}
              >
                {isBlocked ? 'Unblock user' : 'Block user'}
              </Button>
            ) : null}
          </Stack>

          {updateStatus ? (
            <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
              {updateStatus.message}
            </Alert>
          ) : null}

          {canEditProfile ? (
            <Stack spacing={2}>
              {isEditing ? (
                <Box component="form" onSubmit={handleSaveProfile}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Edit profile</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                      <Avatar
                        src={editingAvatarSrc || avatarUrl}
                        alt={`${displayName} avatar`}
                        sx={{ width: 96, height: 96 }}
                      />
                      <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }}>
                        <Button variant="outlined" component="label">
                          Upload avatar
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleAvatarFileChange}
                          />
                        </Button>
                        <Button variant="text" color="secondary" onClick={handleClearAvatar}>
                          Remove avatar
                        </Button>
                      </Stack>
                    </Stack>

                    <TextField
                      label="Display name"
                      value={formState.displayName}
                      onChange={handleFieldChange('displayName')}
                      required
                      fullWidth
                    />

                    <TextField
                      label="Bio"
                      value={formState.bio}
                      onChange={handleFieldChange('bio')}
                      fullWidth
                      multiline
                      minRows={2}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={formState.locationSharingEnabled}
                          onChange={handleToggleLocationSharing}
                        />
                      }
                      label="Share location with friends"
                    />

                    <TextField
                      select
                      label="Interface theme"
                      value={formState.theme}
                      onChange={handleThemeChange}
                    >
                      <MenuItem value="system">Match system</MenuItem>
                      <MenuItem value="light">Light</MenuItem>
                      <MenuItem value="dark">Dark</MenuItem>
                    </TextField>

                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button variant="text" onClick={handleCancelEditing} disabled={isSavingProfile}>
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={isSavingProfile}
                      >
                        {isSavingProfile ? 'Saving…' : 'Save changes'}
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    onClick={handleBeginEditing}
                    disabled={isOffline || !effectiveUser || isFetchingProfile}
                    title={isOffline ? 'Reconnect to edit your profile' : undefined}
                  >
                    Edit profile
                  </Button>
                </Box>
              )}
            </Stack>
          ) : null}

          {hasProfile ? (
            <>
              <Divider />
              <Stack spacing={3}>
                <Section
                  title="Bio"
                  description="Everything they want you to know right now."
                >
                  {bioText ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {bioText}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This user hasn't added a bio yet.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Badges & achievements"
                  description="Recognition earned by this community member."
                >
                  {badgeList.length ? (
                    <Stack direction="row" flexWrap="wrap" gap={1.5}>
                      {badgeList.map((badgeId) => {
                        const badgeInfo =
                          BADGE_METADATA[badgeId] ?? {
                            label: badgeId,
                            description: 'Earn this badge to uncover its story.',
                            image: undefined
                          };
                        const badgeImageUrl = resolveBadgeImageUrl(badgeInfo.image);
                        return (
                          <Tooltip key={badgeId} title={badgeInfo.description} arrow enterTouchDelay={0}>
                            <Chip
                              label={badgeInfo.label}
                              color="primary"
                              variant="outlined"
                              sx={{
                                fontSize: '1rem',
                                px: 1.5,
                                py: 0.75,
                                borderWidth: 2
                              }}
                              avatar={
                                badgeImageUrl ? (
                                  <Avatar
                                    src={badgeImageUrl}
                                    alt={`${badgeInfo.label} badge`}
                                    sx={{ width: 56, height: 56 }}
                                  />
                                ) : undefined
                              }
                            />
                          </Tooltip>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No badges yet — they’ll appear here once this user starts collecting achievements.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Highlights"
                  description="At-a-glance stats across this profile."
                >
                  {statsVisible ? (
                    statsEntries.length ? (
                      <Grid container spacing={2}>
                        {statsEntries.map(({ key, label, value }) => (
                          <Grid item xs={6} sm={4} key={key}>
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle2" color="text.secondary">
                                {label}
                              </Typography>
                              <Typography variant="h5">{value}</Typography>
                            </Stack>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Stats will appear here once this user starts hosting events, posting, or connecting with others.
                      </Typography>
                    )
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      This user keeps their stats private.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Activity & collections"
                  description="Quick counts for pins, bookmarks, rooms, and locations associated with this user."
                >
                  {activityEntries.length ? (
                    <Grid container spacing={2}>
                      {activityEntries.map(({ key, label, value }) => (
                        <Grid item xs={6} sm={4} key={key}>
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2" color="text.secondary">
                              {label}
                            </Typography>
                            <Typography variant="h6">{value}</Typography>
                          </Stack>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Activity counters will populate as soon as this user creates or saves pins, joins chats, or shares check-ins.
                    </Typography>
                  )}
                </Section>

                <Section
                  title="Preferences"
                  description="Theme, privacy, and notification settings currently applied to this profile."
                >
                  <Stack spacing={1.5}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Interface theme
                        </Typography>
                        <Typography variant="body1">
                          {preferenceSummary.theme.charAt(0).toUpperCase() +
                            preferenceSummary.theme.slice(1)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Discovery radius
                        </Typography>
                        <Typography variant="body1">
                          {typeof preferenceSummary.radiusMiles === 'number'
                            ? `${preferenceSummary.radiusMiles} mi`
                            : 'Default'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Location sharing
                        </Typography>
                        <Typography variant="body1">
                          {preferenceSummary.locationSharing ? 'Enabled' : 'Disabled'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          Stats visibility
                        </Typography>
                        <Typography variant="body1">
                          {statsVisible ? 'Shared' : 'Hidden'}
                        </Typography>
                      </Box>
                    </Stack>

                    <Divider flexItem />

                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {notificationPreferences.map(({ key, label, enabled }) => (
                        <Chip
                          key={key}
                          label={`${label}${enabled ? '' : ' (off)'}`}
                          color={enabled ? 'success' : 'default'}
                          variant={enabled ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Stack>
                  </Stack>
                </Section>

                <Section
                  title="Account timeline"
                  description="Provisioning details captured when this account was created."
                >
                  {accountTimeline ? (
                    <Stack spacing={1}>
                      <Typography variant="body2" color="text.secondary">
                        User ID
                      </Typography>
                      <Typography variant="body1">{accountTimeline.userId}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Email
                      </Typography>
                      <Typography variant="body1">{accountTimeline.email}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Account status
                      </Typography>
                      <Typography variant="body1">
                        {accountTimeline.status.charAt(0).toUpperCase() + accountTimeline.status.slice(1)}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Created
                      </Typography>
                      <Typography variant="body1">{accountTimeline.createdAt}</Typography>

                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Last updated
                      </Typography>
                      <Typography variant="body1">{accountTimeline.updatedAt}</Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      We’ll surface account timestamps once this profile finishes loading.
                    </Typography>
                  )}
                </Section>

                {rawDataAvailable ? (
                  <Stack spacing={1}>
                    <Button
                      type="button"
                      variant="text"
                      color="secondary"
                      onClick={() => setShowRawData((prev) => !prev)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      {showRawData ? 'Hide raw profile JSON' : 'Show raw profile JSON'}
                    </Button>
                    <Collapse in={showRawData} unmountOnExit>
                      <Stack spacing={1.5}>
                        {detailEntries.map(({ key, value, isObject }) => (
                          <Box
                            key={key}
                            sx={{
                              borderRadius: 2,
                              border: '1px dashed',
                              borderColor: 'divider',
                              backgroundColor: 'background.default',
                              p: 2
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                textTransform: 'uppercase',
                                letterSpacing: 0.6,
                                fontWeight: 600
                              }}
                            >
                              {key}
                            </Typography>
                            {isObject ? (
                              <Box
                                component="pre"
                                sx={{
                                  mt: 1,
                                  mb: 0,
                                  fontSize: '0.85rem',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {formatEntryValue(value)}
                              </Box>
                            ) : (
                              <Typography variant="body1" sx={{ mt: 0.5 }}>
                                {formatEntryValue(value)}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    </Collapse>
                  </Stack>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Paper>
      <Dialog
        open={Boolean(blockDialogMode)}
        onClose={handleCloseBlockDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{blockDialogMode === 'block' ? 'Block this user?' : 'Unblock this user?'}</DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {blockDialogMode === 'block'
              ? 'Blocked users cannot interact with you and their activity is hidden. You can review blocked users in Settings whenever you change your mind.'
              : 'Unblocking lets this user interact with you again and restores their activity in your feeds.'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseBlockDialog} disabled={isProcessingBlockAction}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmBlockDialog}
            color={blockDialogMode === 'block' ? 'error' : 'primary'}
            variant="contained"
            disabled={isProcessingBlockAction}
          >
            {isProcessingBlockAction
              ? 'Updating...'
              : blockDialogMode === 'block'
              ? 'Block user'
              : 'Unblock user'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ProfilePage;
