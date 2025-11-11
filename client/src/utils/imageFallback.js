import resolveAssetUrl from './media';

const FALLBACK_TEXTURE_PATH = '/images/UNKNOWN_TEXTURE.jpg';

export const ensureImageSrc = (src) => {
  if (typeof src === 'string' && src.trim().length > 0) {
    return src;
  }
  return resolveAssetUrl(FALLBACK_TEXTURE_PATH, FALLBACK_TEXTURE_PATH);
};

export const withFallbackOnError = (event) => {
  const img = event?.currentTarget;
  if (!img || img.dataset.fallbackApplied) {
    return;
  }
  img.dataset.fallbackApplied = 'true';
  const fallbackSrc = resolveAssetUrl(FALLBACK_TEXTURE_PATH, FALLBACK_TEXTURE_PATH);
  img.src = fallbackSrc;
};
