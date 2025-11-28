import { useCallback, useMemo, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';

import {
  createUserProfile,
  fetchCurrentUserProfile,
  fetchUserProfile,
  fetchUsers,
  updateUserProfile
} from '../../../api';
import { auth } from '../../../firebase';
import { ACCOUNT_STATUS_OPTIONS } from '../constants';
import { parseCommaSeparated, parseOptionalNumber } from '../utils';

export const INITIAL_CREATE_PROFILE_FORM = {
  username: '',
  displayName: '',
  email: '',
  bio: '',
  accountStatus: ACCOUNT_STATUS_OPTIONS[0],
  roles: ''
};

const buildEditForm = (profile) => ({
  username: profile?.username ?? '',
  displayName: profile?.displayName ?? '',
  email: profile?.email ?? '',
  bio: profile?.bio ?? '',
  accountStatus: profile?.accountStatus ?? ACCOUNT_STATUS_OPTIONS[0]
});

const useProfilesTools = () => {
  const [currentUser] = useAuthState(auth);

  const [createForm, setCreateForm] = useState(INITIAL_CREATE_PROFILE_FORM);
  const [createStatus, setCreateStatus] = useState(null);
  const [createdProfile, setCreatedProfile] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

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

  const handleCreate = useCallback(
    async (event) => {
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
          accountStatus: createForm.accountStatus
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
    },
    [createForm]
  );

  const handleFetchProfile = useCallback(
    async (event) => {
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
    },
    [fetchUserId, currentUser]
  );

  const handleUpdateProfile = useCallback(
    async (event) => {
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
          accountStatus: editForm.accountStatus
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
    },
    [fetchedProfile, editForm]
  );

  const handleSearchUsers = useCallback(
    async (event) => {
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
    },
    [searchTerm, searchLimit]
  );

  const handleFetchAllProfiles = useCallback(async () => {
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
  }, [allProfilesLimit]);

  const resetCreateForm = useCallback(() => {
    setCreateForm(INITIAL_CREATE_PROFILE_FORM);
    setCreateStatus(null);
  }, []);

  const resetEditForm = useCallback(() => {
    if (fetchedProfile) {
      setEditForm(buildEditForm(fetchedProfile));
    } else {
      setEditForm(null);
    }
    setUpdateStatus(null);
  }, [fetchedProfile]);

  const resolvedAccountStatusOptions = useMemo(() => ACCOUNT_STATUS_OPTIONS, []);

  return {
    currentUser,
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
  };
};

export default useProfilesTools;
