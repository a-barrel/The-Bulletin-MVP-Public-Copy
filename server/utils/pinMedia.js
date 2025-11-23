const { mapMediaAsset, normalizeMediaUrl } = require('./media');

const PLACEHOLDER_IMAGE_PATH = '/images/UNKNOWN_TEXTURE.jpg';

const mapAssetUrl = (asset) => {
  if (!asset) {
    return undefined;
  }
  const mapped = mapMediaAsset(asset, {});
  if (mapped?.url) {
    return mapped.url;
  }
  if (typeof asset === 'string') {
    return normalizeMediaUrl(asset);
  }
  if (asset?.url) {
    return normalizeMediaUrl(asset.url);
  }
  return undefined;
};

function resolvePinPrimaryImageUrl(pinDoc) {
  if (!pinDoc) {
    return normalizeMediaUrl(PLACEHOLDER_IMAGE_PATH);
  }

  const attempts = [
    mapAssetUrl(pinDoc.coverPhoto),
    ...(Array.isArray(pinDoc.mediaAssets)
      ? pinDoc.mediaAssets.map((asset) => mapAssetUrl(asset)).filter(Boolean)
      : []),
    ...(Array.isArray(pinDoc.photos)
      ? pinDoc.photos.map((asset) => mapAssetUrl(asset)).filter(Boolean)
      : []),
    ...(Array.isArray(pinDoc.images)
      ? pinDoc.images.map((asset) => mapAssetUrl(asset)).filter(Boolean)
      : [])
  ];

  const resolved = attempts.find(Boolean);
  return resolved || normalizeMediaUrl(PLACEHOLDER_IMAGE_PATH);
}

module.exports = {
  resolvePinPrimaryImageUrl
};
