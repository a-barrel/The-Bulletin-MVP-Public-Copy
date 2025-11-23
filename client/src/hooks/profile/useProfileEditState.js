import { useCallback, useMemo, useRef, useState } from 'react';
import { updateCurrentUserProfile, uploadImage } from '../../api/mongoDataApi';
import { resolveProfileAvatarUrl, resolveProfileBannerUrl } from '../../utils/profileAssets';

const buildMediaAssetPayload = (uploaded, uploadedBy) =>
  Object.fromEntries(
    Object.entries({
      url: uploaded?.url,
      thumbnailUrl: uploaded?.thumbnailUrl,
      width: uploaded?.width,
      height: uploaded?.height,
      mimeType: uploaded?.mimeType,
      description: uploaded?.description,
      uploadedAt: uploaded?.uploadedAt,
      uploadedBy: uploadedBy ?? undefined
    }).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

const initializeFormState = (profile) => ({
  displayName: profile?.displayName ?? '',
  bio: profile?.bio ?? '',
  theme: profile?.preferences?.theme ?? 'system',
  avatarFile: null,
  avatarPreviewUrl: profile?.avatar ? resolveProfileAvatarUrl(profile.avatar) : null,
  avatarCleared: !profile?.avatar,
  bannerFile: null,
  bannerPreviewUrl: profile?.banner ? resolveProfileBannerUrl(profile.banner) : null,
  bannerCleared: !profile?.banner
});

export default function useProfileEditState({ effectiveUser, setFetchedUser, isOffline }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [formState, setFormState] = useState(() => initializeFormState(effectiveUser));

  const avatarPreviewUrlRef = useRef(null);
  const bannerPreviewUrlRef = useRef(null);

  const clearAvatarPreviewUrl = useCallback(() => {
    if (avatarPreviewUrlRef.current && avatarPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
    }
    avatarPreviewUrlRef.current = null;
  }, []);

  const clearBannerPreviewUrl = useCallback(() => {
    if (bannerPreviewUrlRef.current && bannerPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current);
    }
    bannerPreviewUrlRef.current = null;
  }, []);

  const resetFormState = useCallback(() => {
    setFormState(initializeFormState(effectiveUser));
  }, [effectiveUser]);

  const handleBeginEditing = useCallback(() => {
    if (isOffline) {
      setUpdateStatus({ type: 'warning', message: 'Reconnect to edit your profile.' });
      return;
    }
    if (!effectiveUser) {
      return;
    }
    clearAvatarPreviewUrl();
    clearBannerPreviewUrl();
    setFormState(initializeFormState(effectiveUser));
    setUpdateStatus(null);
    setIsEditing(true);
  }, [clearAvatarPreviewUrl, clearBannerPreviewUrl, effectiveUser, isOffline]);

  const handleCancelEditing = useCallback(() => {
    clearAvatarPreviewUrl();
    clearBannerPreviewUrl();
    resetFormState();
    setIsEditing(false);
  }, [clearAvatarPreviewUrl, clearBannerPreviewUrl, resetFormState]);

  const handleAvatarFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (avatarPreviewUrlRef.current && avatarPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    avatarPreviewUrlRef.current = previewUrl;
    setFormState((prev) => ({
      ...prev,
      avatarFile: file,
      avatarPreviewUrl: previewUrl,
      avatarCleared: false
    }));
    event.target.value = '';
  }, []);

  const handleBannerFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (bannerPreviewUrlRef.current && bannerPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current);
    }
    const previewUrl = URL.createObjectURL(file);
    bannerPreviewUrlRef.current = previewUrl;
    setFormState((prev) => ({
      ...prev,
      bannerFile: file,
      bannerPreviewUrl: previewUrl,
      bannerCleared: false
    }));
    event.target.value = '';
  }, []);

  const handleClearAvatar = useCallback(() => {
    clearAvatarPreviewUrl();
    setFormState((prev) => ({
      ...prev,
      avatarFile: null,
      avatarPreviewUrl: null,
      avatarCleared: true
    }));
  }, [clearAvatarPreviewUrl]);

  const handleClearBanner = useCallback(() => {
    clearBannerPreviewUrl();
    setFormState((prev) => ({
      ...prev,
      bannerFile: null,
      bannerPreviewUrl: null,
      bannerCleared: true
    }));
  }, [clearBannerPreviewUrl]);

  const handleFieldChange = useCallback((field) => (event) => {
    const value = typeof event?.target?.value === 'string' ? event.target.value : '';
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleThemeChange = useCallback((event) => {
    const value = typeof event?.target?.value === 'string' ? event.target.value : 'system';
    setFormState((prev) => ({
      ...prev,
      theme: value
    }));
  }, []);

  const handleSaveProfile = useCallback(
    async (event) => {
      event.preventDefault();
      if (isOffline) {
        setUpdateStatus({ type: 'warning', message: 'You are offline. Connect to save your profile.' });
        return;
      }
      if (!effectiveUser) {
        setUpdateStatus({
          type: 'error',
          message: 'No profile data is loaded.'
        });
        return;
      }

      const trimmedDisplayName = formState.displayName.trim();
      if (!trimmedDisplayName) {
        setUpdateStatus({ type: 'error', message: 'Display name cannot be empty.' });
        return;
      }

      const payload = {};
      const preferencesPayload = {};

      if (trimmedDisplayName !== (effectiveUser.displayName ?? '')) {
        payload.displayName = trimmedDisplayName;
      }

      const normalizedBio = formState.bio.trim();
      const existingBio = effectiveUser?.bio ?? '';
      if (normalizedBio !== existingBio) {
        payload.bio = normalizedBio.length > 0 ? normalizedBio : null;
      }

      if (formState.theme !== (effectiveUser?.preferences?.theme ?? 'system')) {
        preferencesPayload.theme = formState.theme;
      }

      let uploadedAvatar = null;
      let uploadedBanner = null;

      if (formState.avatarCleared && (effectiveUser?.avatar || formState.avatarFile)) {
        payload.avatar = null;
      } else if (formState.avatarFile) {
        try {
          setIsSavingProfile(true);
          uploadedAvatar = await uploadImage(formState.avatarFile);
          payload.avatar = buildMediaAssetPayload(uploadedAvatar, effectiveUser?._id);
        } catch (error) {
          setIsSavingProfile(false);
          setUpdateStatus({ type: 'error', message: error?.message || 'Failed to upload avatar.' });
          return;
        }
      }

      if (formState.bannerCleared && (effectiveUser?.banner || formState.bannerFile)) {
        payload.banner = null;
      } else if (formState.bannerFile) {
        try {
          setIsSavingProfile(true);
          uploadedBanner = await uploadImage(formState.bannerFile);
          payload.banner = buildMediaAssetPayload(uploadedBanner, effectiveUser?._id);
        } catch (error) {
          setIsSavingProfile(false);
          setUpdateStatus({ type: 'error', message: error?.message || 'Failed to upload banner.' });
          return;
        }
      }

      if (Object.keys(preferencesPayload).length > 0) {
        payload.preferences = preferencesPayload;
      }

      if (!Object.keys(payload).length) {
        setUpdateStatus({ type: 'info', message: 'No changes to save.' });
        return;
      }

      try {
        setIsSavingProfile(true);
        const updatedProfile = await updateCurrentUserProfile(payload);
        setFetchedUser(updatedProfile);
        setUpdateStatus({ type: 'success', message: 'Profile updated successfully.' });
        setIsEditing(false);
        clearAvatarPreviewUrl();
        clearBannerPreviewUrl();
        setFormState(initializeFormState(updatedProfile));
      } catch (error) {
        setUpdateStatus({ type: 'error', message: error?.message || 'Failed to update profile.' });
      } finally {
        setIsSavingProfile(false);
      }
    },
    [
      clearAvatarPreviewUrl,
      clearBannerPreviewUrl,
      effectiveUser,
      formState.avatarCleared,
      formState.avatarFile,
      formState.bannerCleared,
      formState.bannerFile,
      formState.bio,
      formState.displayName,
      formState.theme,
      isOffline,
      setFetchedUser
    ]
  );

  const editingAvatarSrc = useMemo(
    () => (formState.avatarCleared ? null : formState.avatarPreviewUrl ?? resolveProfileAvatarUrl(effectiveUser?.avatar)),
    [effectiveUser?.avatar, formState.avatarCleared, formState.avatarPreviewUrl]
  );
  const editingBannerSrc = useMemo(
    () => (formState.bannerCleared ? null : formState.bannerPreviewUrl ?? resolveProfileBannerUrl(effectiveUser?.banner)),
    [effectiveUser?.banner, formState.bannerCleared, formState.bannerPreviewUrl]
  );

  return {
    formState,
    setFormState,
    isEditing,
    isSavingProfile,
    updateStatus,
    setUpdateStatus,
    handleBeginEditing,
    handleCancelEditing,
    handleAvatarFileChange,
    handleBannerFileChange,
    handleClearAvatar,
    handleClearBanner,
    handleFieldChange,
    handleThemeChange,
    handleSaveProfile,
    editingAvatarSrc,
    editingBannerSrc,
    clearAvatarPreviewUrl,
    clearBannerPreviewUrl
  };
}
