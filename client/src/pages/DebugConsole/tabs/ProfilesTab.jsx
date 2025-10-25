import { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  createUserProfile,
  fetchCurrentUserProfile,
  fetchUserProfile,
  fetchUsers,
  updateUserProfile
} from '../../../api/mongoDataApi';
import { auth } from '../../../firebase';
import JsonPreview from '../components/JsonPreview';
import { ACCOUNT_STATUS_OPTIONS } from '../constants';
import { parseCommaSeparated, parseOptionalNumber } from '../utils';

function ProfilesTab() {
  const [currentUser] = useAuthState(auth);
  const [createForm, setCreateForm] = useState({
    username: '',
    displayName: '',
    email: '',
    bio: '',
    accountStatus: ACCOUNT_STATUS_OPTIONS[0],
    roles: '',
    locationSharingEnabled: false
  });
  const [createStatus, setCreateStatus] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);

  const [fetchUserId, setFetchUserId] = useState('');
  const [fetchStatus, setFetchStatus] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedProfile, setFetchedProfile] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchLimit, setSearchLimit] = useState('10');
  const [searchStatus, setSearchStatus] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [allProfiles, setAllProfiles] = useState(null);
  const [allProfilesStatus, setAllProfilesStatus] = useState(null);
  const [isFetchingAllProfiles, setIsFetchingAllProfiles] = useState(false);
  const [allProfilesLimit, setAllProfilesLimit] = useState('20');

  const buildEditForm = (profile) => ({
    username: profile?.username ?? '',
    displayName: profile?.displayName ?? '',
    email: profile?.email ?? '',
    bio: profile?.bio ?? '',
    accountStatus: profile?.accountStatus ?? ACCOUNT_STATUS_OPTIONS[0],
    locationSharingEnabled: Boolean(profile?.locationSharingEnabled)
  });

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreateStatus(null);

    try {
      const username = createForm.username.trim();
      const displayName = createForm.displayName.trim();
      if (!username || !displayName) {
        throw new Error('Username and display name are required.');
      }

      const payload = {
        username,
        displayName,
        accountStatus: createForm.accountStatus,
        locationSharingEnabled: createForm.locationSharingEnabled
      };

      const email = createForm.email.trim();
      if (email) {
        payload.email = email;
      }

      const bio = createForm.bio.trim();
      if (bio) {
        payload.bio = bio;
      }

      const roles = parseCommaSeparated(createForm.roles);
      if (roles.length) {
        payload.roles = roles;
      }

      setIsCreating(true);
      const result = await createUserProfile(payload);
      setCreatedProfile(result);
      setCreateStatus({ type: 'success', message: 'User profile created.' });
      if (result?._id) {
        setFetchUserId(result._id);
      }
    } catch (error) {
      setCreateStatus({ type: 'error', message: error.message || 'Failed to create user.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleFetchProfile = async (event) => {
    event.preventDefault();
    setFetchStatus(null);
    setUpdateStatus(null);
    const userId = fetchUserId.trim();
    if (!userId && !currentUser) {
      setFetchStatus({ type: 'error', message: 'Sign in to load your profile.' });
      return;
    }

    try {
      setIsFetching(true);
      const profile = userId ? await fetchUserProfile(userId) : await fetchCurrentUserProfile();
      if (!userId && profile?._id) {
        setFetchUserId(profile._id);
      }
      setFetchedProfile(profile);
      setEditForm(buildEditForm(profile));
      setFetchStatus({
        type: 'success',
        message: userId ? 'Profile loaded.' : 'Loaded current user profile.'
      });
    } catch (error) {
      setFetchStatus({ type: 'error', message: error.message || 'Failed to fetch profile.' });
    } finally {
      setIsFetching(false);
    }
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    setUpdateStatus(null);

    if (!fetchedProfile?._id) {
      setUpdateStatus({ type: 'error', message: 'Fetch a profile before saving changes.' });
      return;
    }

    if (!editForm) {
      setUpdateStatus({ type: 'error', message: 'Load a profile before updating.' });
      return;
    }

    try {
      const username = (editForm.username ?? '').trim();
      const displayName = (editForm.displayName ?? '').trim();
      if (!username || !displayName) {
        throw new Error('Username and display name are required.');
      }

      const payload = {
        username,
        displayName,
        accountStatus: editForm.accountStatus,
        locationSharingEnabled: Boolean(editForm.locationSharingEnabled)
      };

      const email = (editForm.email ?? '').trim();
      payload.email = email ? email : null;

      const bio = (editForm.bio ?? '').trim();
      payload.bio = bio ? bio : null;

      setIsUpdating(true);
      const updatedProfile = await updateUserProfile(fetchedProfile._id, payload);
      setFetchedProfile(updatedProfile);
      setEditForm(buildEditForm(updatedProfile));
      setUpdateStatus({ type: 'success', message: 'Profile updated.' });
    } catch (error) {
      setUpdateStatus({ type: 'error', message: error.message || 'Failed to update profile.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSearchUsers = async (event) => {
    event.preventDefault();
    setSearchStatus(null);

    try {
      const query = {};
      const term = searchTerm.trim();
      if (term) {
        query.search = term;
      }
      const limitValue = parseOptionalNumber(searchLimit, 'Limit');
      if (limitValue !== undefined) {
        if (limitValue <= 0) {
          throw new Error('Limit must be greater than 0.');
        }
        query.limit = limitValue;
      }

      setIsSearching(true);
      const users = await fetchUsers(query);
      setSearchResults(users);
      setSearchStatus({
        type: 'success',
        message: `Found ${users.length} user${users.length === 1 ? '' : 's'}.`
      });
    } catch (error) {
      setSearchStatus({ type: 'error', message: error.message || 'Failed to search users.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchAllProfiles = async () => {
    setAllProfilesStatus(null);
    let limitValue;
    try {
      limitValue = parseOptionalNumber(allProfilesLimit, 'Limit');
      if (limitValue === undefined) {
        limitValue = 20;
      }
      if (!Number.isFinite(limitValue) || limitValue <= 0) {
        throw new Error('Limit must be greater than 0.');
      }
      if (limitValue > 50) {
        throw new Error('Limit cannot exceed 50.');
      }
    } catch (error) {
      setAllProfilesStatus({ type: 'error', message: error.message });
      return;
    }

    try {
      setIsFetchingAllProfiles(true);
      const users = await fetchUsers({ limit: limitValue });
      setAllProfiles(users);
      setAllProfilesStatus({
        type: users.length ? 'success' : 'info',
        message: users.length
          ? `Loaded ${users.length} profile${users.length === 1 ? '' : 's'}.`
          : 'No profiles were returned.'
      });
    } catch (error) {
      setAllProfilesStatus({ type: 'error', message: error.message || 'Failed to load profiles.' });
    } finally {
      setIsFetchingAllProfiles(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        component="form"
        onSubmit={handleCreate}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Create user profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Provision a debug identity record for manual testing.
        </Typography>
        {createStatus && (
          <Alert severity={createStatus.type} onClose={() => setCreateStatus(null)}>
            {createStatus.message}
          </Alert>
        )}

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
              {ACCOUNT_STATUS_OPTIONS.map((option) => (
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

          <FormControlLabel
            control={
              <Switch
                checked={createForm.locationSharingEnabled}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, locationSharingEnabled: event.target.checked }))
                }
              />
            }
            label="Location sharing enabled"
          />

          <Stack direction="row" spacing={2}>
            <Button type="submit" variant="contained" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create user'}
            </Button>
            <Button
              type="button"
              variant="text"
              onClick={() =>
                setCreateForm({
                  username: '',
                  displayName: '',
                  email: '',
                  bio: '',
                  accountStatus: ACCOUNT_STATUS_OPTIONS[0],
                  roles: '',
                  locationSharingEnabled: false
                })
              }
            >
              Reset
            </Button>
          </Stack>
        </Stack>
        <JsonPreview data={createdProfile} />
      </Paper>

      <Paper
        component="form"
        onSubmit={handleFetchProfile}
        sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <Typography variant="h6">Fetch profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Load the latest profile snapshot from MongoDB.
        </Typography>
        {fetchStatus && (
          <Alert severity={fetchStatus.type} onClose={() => setFetchStatus(null)}>
            {fetchStatus.message}
          </Alert>
        )}
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
        {(fetchedProfile?.avatar?.url || fetchedProfile) && (
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
      </Paper>

      {fetchedProfile && editForm && (
        <Paper
          component="form"
          onSubmit={handleUpdateProfile}
          sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
        >
          <Typography variant="h6">Edit profile</Typography>
          <Typography variant="body2" color="text.secondary">
            Make changes to the fetched profile and persist them to MongoDB.
          </Typography>
          {updateStatus && (
            <Alert severity={updateStatus.type} onClose={() => setUpdateStatus(null)}>
              {updateStatus.message}
            </Alert>
          )}

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
                {ACCOUNT_STATUS_OPTIONS.map((option) => (
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

            <FormControlLabel
              control={
                <Switch
                  checked={editForm.locationSharingEnabled}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, locationSharingEnabled: event.target.checked }))
                  }
                />
              }
              label="Location sharing enabled"
            />

            <Stack direction="row" spacing={2}>
              <Button type="submit" variant="contained" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                type="button"
                variant="text"
                disabled={isUpdating}
                onClick={() => setEditForm(buildEditForm(fetchedProfile))}
              >
                Reset to fetched profile
              </Button>
            </Stack>
          </Stack>
      </Paper>
    )}

    <Paper
      sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Typography variant="h6">Fetch profiles</Typography>
      <Typography variant="body2" color="text.secondary">
        Load the most recent user profiles without filtering.
      </Typography>
      {allProfilesStatus && (
        <Alert severity={allProfilesStatus.type} onClose={() => setAllProfilesStatus(null)}>
          {allProfilesStatus.message}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Limit"
          value={allProfilesLimit}
          onChange={(event) => setAllProfilesLimit(event.target.value)}
          InputProps={{ inputMode: 'numeric' }}
          sx={{ width: { xs: '100%', sm: 120 } }}
        />
        <Button
          type="button"
          variant="outlined"
          disabled={isFetchingAllProfiles}
          onClick={handleFetchAllProfiles}
        >
          {isFetchingAllProfiles ? 'Loading...' : 'Fetch'}
        </Button>
      </Stack>
      <JsonPreview data={allProfiles} />
    </Paper>

    <Paper
      component="form"
      onSubmit={handleSearchUsers}
      sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
        <Typography variant="h6">Search users</Typography>
        <Typography variant="body2" color="text.secondary">
          Explore existing users and copy their IDs quickly.
        </Typography>
        {searchStatus && (
          <Alert severity={searchStatus.type} onClose={() => setSearchStatus(null)}>
            {searchStatus.message}
          </Alert>
        )}
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
      </Paper>
    </Stack>
  );
}

export default ProfilesTab;
