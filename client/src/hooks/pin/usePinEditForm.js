import { useCallback, useEffect, useState } from 'react';
import { deletePin, updatePin } from '../../api';
import reportClientError from '../../utils/reportClientError';

const parseDateInput = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeMediaAssetForUpdate = (asset) => {
  if (!asset || typeof asset !== 'object') {
    return null;
  }
  const sourceUrl =
    typeof asset.url === 'string' && asset.url.trim()
      ? asset.url.trim()
      : typeof asset.path === 'string' && asset.path.trim()
      ? asset.path.trim()
      : null;

  if (!sourceUrl) {
    return null;
  }

  const normalized = { url: sourceUrl };

  if (Number.isFinite(asset.width)) {
    normalized.width = asset.width;
  }
  if (Number.isFinite(asset.height)) {
    normalized.height = asset.height;
  }
  if (typeof asset.mimeType === 'string' && asset.mimeType.trim()) {
    normalized.mimeType = asset.mimeType.trim();
  }
  if (typeof asset.description === 'string' && asset.description.trim()) {
    normalized.description = asset.description.trim();
  }

  return normalized;
};

const buildInitialEditForm = (pin) => {
  if (!pin || typeof pin !== 'object') {
    return {
      title: '',
      description: '',
      proximityRadiusMeters: '',
      startDate: '',
      endDate: '',
      expiresAt: '',
      autoDelete: true
    };
  }

  const normalizedType = typeof pin.type === 'string' ? pin.type.toLowerCase() : '';
  const radius = Number.isFinite(pin.proximityRadiusMeters)
    ? pin.proximityRadiusMeters
    : typeof pin.proximityRadiusMeters === 'number'
    ? pin.proximityRadiusMeters
    : 1609;

  const base = {
    title: pin.title ?? '',
    description: pin.description ?? '',
    proximityRadiusMeters: radius ? String(Math.max(1, Math.round(radius))) : '',
    startDate: '',
    endDate: '',
    expiresAt: '',
    autoDelete: true
  };

  const startDate = parseDateInput(pin.startDate);
  const endDate = parseDateInput(pin.endDate);
  const expiresAt = parseDateInput(pin.expiresAt);

  if (normalizedType === 'event') {
    return {
      ...base,
      startDate: startDate ? pin.startDate : '',
      endDate: endDate ? pin.endDate : '',
      expiresAt: expiresAt ? pin.expiresAt : '',
      autoDelete: typeof pin.autoDelete === 'boolean' ? pin.autoDelete : true
    };
  }

  return {
    ...base,
    expiresAt: expiresAt ? pin.expiresAt : '',
    autoDelete: typeof pin.autoDelete === 'boolean' ? pin.autoDelete : true
  };
};

export default function usePinEditForm({ pin, pinId, isOffline, reloadPin }) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState(() => buildInitialEditForm(pin));
  const [editError, setEditError] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editStatus, setEditStatus] = useState(null);
  const [isDeletingPin, setIsDeletingPin] = useState(false);

  useEffect(() => {
    if (pin && !isEditDialogOpen) {
      setEditForm(buildInitialEditForm(pin));
    }
  }, [pin, isEditDialogOpen]);

  const handleOpenEditDialog = useCallback(() => {
    if (!pin) {
      return;
    }
    setEditForm(buildInitialEditForm(pin));
    setEditError(null);
    setIsEditDialogOpen(true);
  }, [pin]);

  const handleCloseEditDialog = useCallback(() => {
    if (isSubmittingEdit) {
      return;
    }
    setIsEditDialogOpen(false);
    setEditForm(buildInitialEditForm(pin));
    setEditError(null);
    setEditStatus(null);
  }, [isSubmittingEdit, pin]);

  const handleSubmitEdit = useCallback(
    async (event) => {
      event.preventDefault();
      if (isSubmittingEdit || isDeletingPin) {
        return;
      }
      if (isOffline) {
        setEditError('Reconnect to edit this pin.');
        return;
      }
      if (!pin || !editForm) {
        setEditError('Pin is not available.');
        return;
      }
      const title = typeof editForm.title === 'string' ? editForm.title.trim() : '';
      const description = typeof editForm.description === 'string' ? editForm.description.trim() : '';
      const radiusMeters = Number(editForm.proximityRadiusMeters);
      const normalizedRadius = Number.isFinite(radiusMeters) && radiusMeters > 0 ? Math.round(radiusMeters) : null;
      const payload = {
        title,
        description,
        proximityRadiusMeters: normalizedRadius,
        autoDelete: Boolean(editForm.autoDelete)
      };
      if (pin.type === 'event') {
        const startDate = parseDateInput(editForm.startDate);
        const endDate = parseDateInput(editForm.endDate);
        if (startDate && endDate && startDate > endDate) {
          setEditError('Start date must be before end date.');
          return;
        }
        if (startDate) {
          payload.startDate = startDate.toISOString();
        }
        if (endDate) {
          payload.endDate = endDate.toISOString();
        }
      }
      const expiresAt = parseDateInput(editForm.expiresAt);
      if (expiresAt) {
        payload.expiresAt = expiresAt.toISOString();
      }
      if (Array.isArray(pin.mediaAssets) && pin.mediaAssets.length) {
        payload.mediaAssets = pin.mediaAssets
          .map((asset) => normalizeMediaAssetForUpdate(asset))
          .filter(Boolean);
      }

      setIsSubmittingEdit(true);
      setEditError(null);
      try {
        await updatePin(pin._id || pinId, payload);
        setEditStatus({ type: 'success', message: 'Pin updated successfully.' });
        setIsEditDialogOpen(false);
        reloadPin?.({ silent: true });
      } catch (error) {
        setEditError(error?.message || 'Failed to update pin.');
        reportClientError(error, 'Failed to update pin', { pinId: pin?._id || pinId });
      } finally {
        setIsSubmittingEdit(false);
      }
    },
    [editForm, isDeletingPin, isOffline, isSubmittingEdit, pin, pinId, reloadPin]
  );

  const handleDeletePin = useCallback(
    async () => {
      if (isDeletingPin || !pin || isOffline) {
        if (isOffline) {
          setEditStatus({ type: 'warning', message: 'Reconnect to delete this pin.' });
        }
        return;
      }
      const confirmed =
        typeof window === 'undefined' || typeof window.confirm !== 'function'
          ? true
          : window.confirm('Delete this pin permanently? This cannot be undone.');
      if (!confirmed) {
        return;
      }

      setIsDeletingPin(true);
      setEditError(null);
      try {
        await deletePin(pin._id || pinId);
        setEditStatus({ type: 'success', message: 'Pin deleted.' });
        setIsEditDialogOpen(false);
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      } catch (error) {
        setEditError(error?.message || 'Failed to delete pin.');
        reportClientError(error, 'Failed to delete pin', { pinId: pin?._id || pinId });
      } finally {
        setIsDeletingPin(false);
      }
    },
    [isDeletingPin, isOffline, pin, pinId]
  );

  const editDialogBusy = isSubmittingEdit || isDeletingPin;

  return {
    isEditDialogOpen,
    editForm,
    setEditForm,
    editError,
    editStatus,
    setEditStatus,
    isSubmittingEdit,
    isDeletingPin,
    editDialogBusy,
    handleOpenEditDialog,
    handleCloseEditDialog,
    handleSubmitEdit,
    handleDeletePin
  };
}
