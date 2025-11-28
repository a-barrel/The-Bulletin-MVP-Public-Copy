import { apiFetch } from '../httpClient';

const uploadImageInternal = (file) => {
  if (!file) throw new Error('Image file is required');
  const formData = new FormData();
  formData.append('image', file);
  return apiFetch('/api/media/images', { method: 'POST', body: formData });
};

export const uploadImage = (file) => uploadImageInternal(file);

export const uploadPinImage = (file) => uploadImageInternal(file);
