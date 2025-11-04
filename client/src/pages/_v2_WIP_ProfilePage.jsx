// This is a profile page that follows the proposed design guidelines.
// If you plan to add more features, please do so in ProfilePageAdditionalDetail.jsx (they still get displayed here)
// This will help keep the main profile design consistent and give them time to add the features
// officially later on in a mannor that follows the design guidelines.

import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import FlagIcon from '@mui/icons-material/Flag';
import MessageIcon from '@mui/icons-material/Message';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import runtimeConfig from '../config/runtime.js';
import { routes } from '../routes.js';
import { BADGE_METADATA } from '../utils/badges.js';
import { useNetworkStatusContext } from '../contexts/NetworkStatusContext.jsx';
import useProfileDetail from '../hooks/useProfileDetail.js';
import '../components/BackButton.css';
import './_v2_WIP_ProfilePage.css';
import ProfilePageAdditionalDetail from './ProfilePage.jsx';

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
        <div className="description-box">
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </div>
      ) : null}
    </Box>
    <Box
      className="section-content-box"
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        p: { xs: 2, md: 3 }
      }}
    >
      {children}
    </Box>
  </Stack>
);

function ProfilePage() {
  const muiTheme = useTheme();
  const legacyProfileTheme = useMemo(
    () =>
      createTheme(muiTheme, {
        palette: {
          mode: 'light',
          background: {
            ...muiTheme.palette.background,
            default: '#f5f5f5',
            paper: '#ffffff'
          },
          text: {
            ...muiTheme.palette.text,
            primary: '#1f1f1f',
            secondary: '#475467'
          }
        }
      }),
    [muiTheme]
  );

  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();
  const { isOffline } = useNetworkStatusContext();

  const {
    originPath,
    effectiveUser,
    displayName,
    avatarUrl,
    hasProfile,
    bioText,
    badgeList,
    statsVisible,
    statsEntries,
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

  const headerImageUrl = (() => {
    const base = (runtimeConfig.apiBaseUrl ?? '').replace(/\/$/, '');
    const path = '/images/background/background-01.jpg';
    return base ? `${base}${path}` : path;
  })();

  const statValues = useMemo(() => {
    const result = {};
    statsEntries.forEach(({ key, value }) => {
      result[key] = typeof value === 'number' ? value : value ?? 0;
    });
    return result;
  }, [statsEntries]);

  const postCount = statValues.posts ?? 0;
  const eventsHosted = statValues.eventsHosted ?? 0;
  const eventsAttended = statValues.eventsAttended ?? 0;

  const handleBack = useCallback(() => {
    if (originPath) {
      navigate(originPath);
    } else {
      navigate(-1);
    }
  }, [navigate, originPath]);

  const joinedDisplay = accountTimeline?.createdAt ?? 'N/A';

  return (
    <div className="profile-page-container">
      <div className="back-nav-bar profile-back-nav">
        <button
          type="button"
          className="back-button"
          aria-label="Go back to previous page"
          onClick={handleBack}
        >
          <ArrowBackIcon className="back-button__icon" />
          <span className="back-button__text">Profile</span>
        </button>
        {canEditProfile && !isEditing && (
          <Button
            variant="contained"
            onClick={handleBeginEditing}
            disabled={!effectiveUser || isFetchingProfile}
            sx={{ ml: 'auto' }}
          >
            Edit profile
          </Button>
        )}
      </div>
      <div className="profile-page-frame">
        <Box
          component="img"
          src={headerImageUrl}
          alt="Profile header"
          sx={{
            width: { xs: 'calc(100% + 1rem)', sm: 'calc(100% + 2rem)' },
            height: '100px',
            objectFit: 'fill',
            display: 'block',
            marginTop: { xs: '-56px', sm: '-60px' },
            marginLeft: { xs: '-0.5rem', sm: '-1rem' },
            marginRight: { xs: '-0.5rem', sm: '-1rem' }
          }}
        />
        <Stack spacing={3}>
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

          {relationshipStatus ? (
            <Alert severity={relationshipStatus.type} onClose={() => setRelationshipStatus(null)}>
              {relationshipStatus.message}
            </Alert>
          ) : null}

          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ py: 4 }}
          >
            <Avatar
              src={avatarUrl}
              alt={`${displayName} avatar`}
              sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
            >
              {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
            </Avatar>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{ fontWeight: 'bold', fontSize: '2rem' }}
              >
                {displayName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Joined: {joinedDisplay}
              </Typography>
            </Box>
          </Stack>

          {canEditProfile ? (
            <Stack spacing={2} sx={{ alignSelf: 'stretch' }}>
              {updateStatus ? (
                <Alert
                  severity={updateStatus.type}
                  onClose={() => setUpdateStatus(null)}
                  sx={{
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
                  }}
                >
                  {updateStatus.message}
                </Alert>
              ) : null}

              {isEditing ? (
                <Stack
                  component="form"
                  spacing={2}
                  onSubmit={handleSaveProfile}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: '#000',
                    backgroundColor: '#f2f2f2'
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                    <Avatar
                      src={editingAvatarSrc || avatarUrl}
                      alt="Profile avatar preview"
                      sx={{ width: 96, height: 96, bgcolor: 'secondary.main' }}
                    >
                      {displayName?.charAt(0)?.toUpperCase() ?? 'U'}
                    </Avatar>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button component="label" variant="outlined" size="small" disabled={isSavingProfile}>
                        Upload avatar
                        <input type="file" hidden accept="image/*" onChange={handleAvatarFileChange} />
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        color="warning"
                        size="small"
                        onClick={handleClearAvatar}
                        disabled={
                          isSavingProfile ||
                          (formState.avatarCleared && !formState.avatarFile && !effectiveUser?.avatar)
                        }
                      >
                        Remove avatar
                      </Button>
                    </Stack>
                  </Stack>

                  <TextField
                    label="Display name"
                    value={formState.displayName}
                    onChange={handleFieldChange('displayName')}
                    required
                    disabled={isSavingProfile}
                    fullWidth
                  />

                  <TextField
                    label="Bio"
                    value={formState.bio}
                    onChange={handleFieldChange('bio')}
                    multiline
                    minRows={3}
                    helperText="Share something about yourself (500 characters max)."
                    disabled={isSavingProfile}
                    inputProps={{ maxLength: 500 }}
                    fullWidth
                  />

                  <TextField
                    label="Theme preference"
                    value={formState.theme}
                    onChange={handleThemeChange}
                    select
                    disabled={isSavingProfile}
                    fullWidth
                  >
                    <MenuItem value="system">System default</MenuItem>
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                  </TextField>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.locationSharingEnabled}
                        onChange={handleToggleLocationSharing}
                        color="primary"
                        disabled={isSavingProfile}
                      />
                    }
                    label="Share location with nearby features"
                  />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                    <Button
                      type="button"
                      variant="outlined"
                      color="inherit"
                      onClick={handleCancelEditing}
                      disabled={isSavingProfile}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" variant="contained" disabled={isSavingProfile}>
                      {isSavingProfile ? 'Saving...' : 'Save changes'}
                    </Button>
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          ) : null}

          {hasProfile ? (
            <>
              <Divider />

              {statsVisible ? (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.5 }}>
                    <Box className="summary-box" sx={{ flex: '0 0 auto' }}>
                      <Typography variant="body2">Post count: {postCount}</Typography>
                    </Box>
                    <Box className="summary-box" sx={{ flex: '0 0 auto', textAlign: 'right' }}>
                      <Typography variant="body2">Events hosted: {eventsHosted}</Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" sx={{ px: 0.5 }}>
                    <Box className="summary-box" sx={{ flex: '0 0 auto' }}>
                      <Typography variant="body2">Events attended: {eventsAttended}</Typography>
                    </Box>
                  </Stack>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                  This user keeps their stats private.
                </Typography>
              )}

              <Stack spacing={3}>
                <Section title="Bio">
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

                <Section title="Badges & achievements">
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
                      No badges yet. They will appear here once this user starts collecting achievements.
                    </Typography>
                  )}
                </Section>

                <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2, width: '100%' }}>
                  <Box
                    className="section-content-box"
                    sx={{
                      flex: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer'
                    }}
                  >
                    <MessageIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Message
                    </Typography>
                  </Box>

                  <Box
                    className="section-content-box"
                    sx={{
                      flex: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer'
                    }}
                  >
                    <FlagIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Report
                    </Typography>
                  </Box>

                  {canManageBlock ? (
                    <Box
                      className="section-content-box"
                      onClick={isBlocked ? handleRequestUnblock : handleRequestBlock}
                      sx={{
                        flex: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1,
                        cursor: isProcessingBlockAction || isFetchingProfile ? 'not-allowed' : 'pointer',
                        opacity: isProcessingBlockAction || isFetchingProfile ? 0.6 : 1
                      }}
                    >
                      {isBlocked ? (
                        <HowToRegIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                      ) : (
                        <BlockIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                      )}
                      <Typography variant="body2" color="text.secondary">
                        {isBlocked ? 'Unblock' : 'Block'}
                      </Typography>
                    </Box>
                  ) : null}
                </Box>

                  
                {/* Commented out debug info, it is in the additional details section now
                {preferenceSummary ? (
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
                            {preferenceSummary.theme.charAt(0).toUpperCase() + preferenceSummary.theme.slice(1)}
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
                ) : null}

                <Section title="Account timeline" description="Provisioning details captured when this account was created.">
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
                      We'll surface account timestamps once this profile finishes loading.
                    </Typography>
                  )}
                </Section>

          */}

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

                <ThemeProvider theme={legacyProfileTheme}>
                  <Accordion
                    disableGutters
                    sx={(theme) => ({
                      borderRadius: 2,
                      boxShadow: 'none',
                      border: '1px solid',
                      borderColor: theme.palette.divider,
                      mt: 3,
                      backgroundColor: theme.palette.background.paper,
                      color: theme.palette.text.primary
                    })}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      aria-controls="additional-content-panel"
                      id="additional-content-header"
                      sx={(theme) => ({
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        px: 2,
                        '& .MuiAccordionSummary-expandIconWrapper svg': {
                          color: theme.palette.text.secondary
                        },
                        '& .MuiTypography-root': {
                          color: theme.palette.text.primary,
                          fontWeight: 600
                        }
                      })}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Additional Content
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={(theme) => ({
                        px: { xs: 1, sm: 2 },
                        py: 2,
                        backgroundColor: theme.palette.background.paper,
                        color: theme.palette.text.primary,
                        borderTop: '1px solid',
                        borderColor: theme.palette.divider
                      })}
                    >
                      <Box
                        sx={(theme) => ({
                          width: '100%',
                          color: theme.palette.text.primary,
                          backgroundColor: theme.palette.background.paper
                        })}
                      >
                        <ProfilePageAdditionalDetail />
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                </ThemeProvider>
              </Stack>
            </>
          ) : null}
        </Stack>
      </div>
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
    </div>
  );
}

export default ProfilePage;
