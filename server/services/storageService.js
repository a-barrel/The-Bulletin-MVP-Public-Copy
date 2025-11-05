const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const runtime = require('../config/runtime');
const { logIntegration } = require('../utils/devLogger');

const fsPromises = fs.promises;

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const encodeStoragePath = (value) =>
  value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const resolveBucket = () => {
  try {
    const configured =
      runtime.firebase.storageBucket ||
      (admin.app().options && admin.app().options.storageBucket);
    if (!configured) {
      return null;
    }
    return admin.storage().bucket(configured);
  } catch (error) {
    console.error('Failed to resolve Firebase Storage bucket:', error);
    logIntegration('firebase-storage:resolve-bucket', error);
    return null;
  }
};

async function ensureObjectIsAccessible(file, { skipMakePublic = false } = {}) {
  if (!skipMakePublic) {
    try {
      await file.makePublic();
      return file.publicUrl();
    } catch (error) {
      console.warn(
        `Failed to make storage object ${file.name} public (${error.message}). Falling back to signed URL.`
      );
    }
  }

  // Either making the object public was skipped or it failed. Fall back to a long-lived signed URL.
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + ONE_YEAR_MS
  });
  return signedUrl;
}

async function saveBinary({
  buffer,
  fileName,
  contentType,
  size,
  offlineDir,
  offlinePublicPath,
  objectPrefixSegments,
  makePublic = true
}) {
  if (!buffer) {
    throw new Error('Buffer is required to save a storage object.');
  }
  if (!fileName) {
    throw new Error('fileName is required to save a storage object.');
  }

  const objectPath = path.posix.join(...objectPrefixSegments, fileName);

  if (runtime.isOffline) {
    if (!offlineDir) {
      throw new Error('Local storage directory is not configured.');
    }

    await fsPromises.mkdir(offlineDir, { recursive: true });
    const destinationPath = path.join(offlineDir, fileName);
    await fsPromises.writeFile(destinationPath, buffer);

    return {
      storagePath: objectPath,
      relativeUrl: `${offlinePublicPath.replace(/\/+$/, '')}/${encodeURIComponent(fileName)}`,
      publicUrl: null,
      size: size ?? buffer.length,
      bucketName: null
    };
  }

  const bucket = resolveBucket();
  if (!bucket) {
    throw new Error(
      'Firebase Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET in the server environment.'
    );
  }

  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=86400'
    }
  });

  const publicUrl = await ensureObjectIsAccessible(file, {
    skipMakePublic: makePublic === false || process.env.PINPOINT_FIREBASE_SKIP_PUBLIC === 'true'
  });

  return {
    storagePath: objectPath,
    relativeUrl: `/${encodeStoragePath(objectPath)}`,
    publicUrl,
    size: size ?? buffer.length,
    bucketName: bucket.name
  };
}

async function saveImageAsset(options) {
  return saveBinary({
    ...options,
    contentType: options.contentType || 'image/jpeg',
    objectPrefixSegments: ['uploads', 'images'],
    offlineDir: options.offlineDir,
    offlinePublicPath: options.offlinePublicPath || '/images'
  });
}

module.exports = {
  saveImageAsset
};
