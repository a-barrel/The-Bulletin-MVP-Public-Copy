import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import JsonPreview from '../components/JsonPreview';
import DebugPanel from '../components/DebugPanel';
import useProfilesTools from '../hooks/useProfilesTools';
import { DEFAULT_BANNER_PATH } from '../constants';
import { resolveMediaUrl } from '../utils';

function ProfilesTab() {
  const {
    createForm,
    setCreateForm,
    createStatus,
    setCreateStatus,
    createdProfile,
    isCreating,
    handleCreate,
    resetCreateForm,
    fetchUserId,
    setFetchUserId,
    fetchStatus,
    setFetchStatus,
    isFetching,
    fetchedProfile,
    editForm,
    setEditForm,
    updateStatus,
    setUpdateStatus,
    isUpdating,
    handleFetchProfile,
    handleUpdateProfile,
    resetEditForm,
    searchTerm,
    setSearchTerm,
    searchLimit,
    setSearchLimit,
    searchStatus,
    setSearchStatus,
    isSearching,
    searchResults,
    handleSearchUsers,
    allProfiles,
    allProfilesStatus,
    setAllProfilesStatus,
    isFetchingAllProfiles,
    allProfilesLimit,
    setAllProfilesLimit,
    handleFetchAllProfiles,
    resolvedAccountStatusOptions
  } = useProfilesTools();

  const createAlerts = createStatus
    ? [
        {
          key: 'create-profile',
          severity: createStatus.type,
          content: createStatus.message,
          onClose: () => setCreateStatus(null)
        }
      ]
    : [];

  const fetchAlerts = fetchStatus
    ? [
        {
          key: 'fetch-profile',
          severity: fetchStatus.type,
          content: fetchStatus.message,
          onClose: () => setFetchStatus(null)
        }
      ]
    : [];

  const updateAlerts = updateStatus
    ? [
        {
          key: 'update-profile',
          severity: updateStatus.type,
          content: updateStatus.message,
          onClose: () => setUpdateStatus(null)
        }
      ]
    : [];

  const allProfilesAlerts = allProfilesStatus
    ? [
        {
          key: 'all-profiles',
          severity: allProfilesStatus.type,
          content: allProfilesStatus.message,
          onClose: () => setAllProfilesStatus(null)
        }
      ]
    : [];

  const searchAlerts = searchStatus
    ? [
        {
          key: 'search-profiles',
          severity: searchStatus.type,
          content: searchStatus.message,
          onClose: () => setSearchStatus(null)
        }
      ]
    : [];

  return (
    <Stack spacing={2}>
      <DebugPanel
        component="form"
        onSubmit={handleCreate}
        title="Create user profile"
        description="Provision a debug identity record for manual testing."
        alerts={createAlerts}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Username"
              value={createForm.username}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Display name"
              value={createForm.displayName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, displayName: event.target.value }))}
              required
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Email"
              value={createForm.email}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Account status"
              value={createForm.accountStatus}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, accountStatus: event.target.value }))}
              select
              sx={{ minWidth: 200 }}
            >
              {resolvedAccountStatusOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <TextField
            label="Bio"
            value={createForm.bio}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, bio: event.target.value }))}
            multiline
            minRows={3}
            fullWidth
          />

        <TextField
          label="Roles (comma separated)"
          value={createForm.roles}
          onChange={(event) => setCreateForm((prev) => ({ ...prev, roles: event.target.value }))}
          fullWidth
        />

          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create user'}
            </Button>
            <Button type="button" variant="text" onClick={resetCreateForm}>
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={createdProfile} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleFetchProfile}
        title="Fetch profile"
        description="Load the latest profile snapshot from MongoDB."
        alerts={fetchAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="User ID"
            value={fetchUserId}
            onChange={(event) => setFetchUserId(event.target.value)}
            fullWidth
            placeholder="Leave blank to load the signed-in user"
            helperText="Optional: provide a MongoDB user id or leave empty to load your own profile."
          />
          <Button type="submit" variant="outlined" disabled={isFetching}>
            {isFetching ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>

        {fetchedProfile && (
          <Stack
            spacing={2}
            alignItems="center"
            sx={{
              p: 2,
              borderRadius: 2,
              background: (theme) =>
                `linear-gradient(135deg, ${theme.palette.background.default} 0%, ${theme.palette.background.paper} 60%, rgba(255,255,255,0.06) 100%)`,
              border: (theme) => `1px solid ${theme.palette.divider}`
            }}
          >
            <Box
              component="img"
              src={resolveMediaUrl(fetchedProfile?.banner?.url ?? DEFAULT_BANNER_PATH)}
              alt="User banner"
              sx={{
                width: '100%',
                maxWidth: 480,
                height: 120,
                borderRadius: 2,
                objectFit: 'fill',
                border: (theme) => `1px solid ${theme.palette.divider}`
              }}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = resolveMediaUrl(DEFAULT_BANNER_PATH);
              }}
            />
            <Box
              component="img"
              src={resolveMediaUrl(fetchedProfile?.avatar?.url ?? '')}
              alt={fetchedProfile?.displayName ? `${fetchedProfile.displayName} avatar` : 'User avatar'}
              sx={{
                width: 96,
                height: 96,
                borderRadius: '50%',
                objectFit: 'cover',
                border: (theme) => `1px solid ${theme.palette.divider}`
              }}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = resolveMediaUrl('');
              }}
            />
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">
                {fetchedProfile?.displayName ?? 'Unknown user'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {fetchedProfile?.username ? `@${fetchedProfile.username}` : 'No username'}
              </Typography>
            </Stack>
          </Stack>
        )}

        <JsonPreview data={fetchedProfile} />
      </DebugPanel>

      {fetchedProfile && editForm ? (
        <DebugPanel
          component="form"
          onSubmit={handleUpdateProfile}
          title="Edit profile"
          description="Make changes to the fetched profile and persist them to MongoDB."
          alerts={updateAlerts}
        >
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Username"
                value={editForm.username}
                onChange={(event) => setEditForm((prev) => ({ ...prev, username: event.target.value }))}
                required
                fullWidth
              />
              <TextField
                label="Display name"
                value={editForm.displayName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, displayName: event.target.value }))}
                required
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Email"
                value={editForm.email}
                onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                fullWidth
              />
              <TextField
                label="Account status"
                value={editForm.accountStatus}
                onChange={(event) => setEditForm((prev) => ({ ...prev, accountStatus: event.target.value }))}
                select
                sx={{ minWidth: 200 }}
              >
                {resolvedAccountStatusOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              label="Bio"
              value={editForm.bio}
              onChange={(event) => setEditForm((prev) => ({ ...prev, bio: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
            />

            <Stack direction="row" spacing={2}>
              <Button type="submit" variant="contained" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save changes'}
              </Button>
              <Button type="button" variant="text" disabled={isUpdating} onClick={resetEditForm}>
                Reset to fetched profile
              </Button>
            </Stack>
          </Stack>
        </DebugPanel>
      ) : null}

      <DebugPanel
        title="Fetch profiles"
        description="Load the most recent user profiles without filtering."
        alerts={allProfilesAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Limit"
            value={allProfilesLimit}
            onChange={(event) => setAllProfilesLimit(event.target.value)}
            InputProps={{ inputMode: 'numeric' }}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Button type="button" variant="outlined" disabled={isFetchingAllProfiles} onClick={handleFetchAllProfiles}>
            {isFetchingAllProfiles ? 'Loading...' : 'Fetch'}
          </Button>
        </Stack>
        <JsonPreview data={allProfiles} />
      </DebugPanel>

      <DebugPanel
        component="form"
        onSubmit={handleSearchUsers}
        title="Search users"
        description="Explore existing users and copy their IDs quickly."
        alerts={searchAlerts}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Search term"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            fullWidth
          />
          <TextField
            label="Limit"
            value={searchLimit}
            onChange={(event) => setSearchLimit(event.target.value)}
            sx={{ width: { xs: '100%', sm: 120 } }}
          />
          <Button type="submit" variant="outlined" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </Stack>
        <JsonPreview data={searchResults} />
      </DebugPanel>
    </Stack>
  );
}

export default ProfilesTab;
