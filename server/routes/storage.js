const express = require('express');
const admin = require('firebase-admin');

const runtime = require('../config/runtime');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

router.use(verifyToken);

const DEFAULT_PREFIX = 'debug/';
const MAX_RESULTS = 100;
const SIGNED_URL_TTL_MS = 5 * 60 * 1000;

const normalizePrefix = (raw) => {
  if (!raw) {
    return DEFAULT_PREFIX;
  }
  let value = raw.trim();
  if (!value) {
    return '';
  }
  value = value.replace(/^\/+/, '');
  return value;
};

const resolveBucket = () => {
  const bucketName =
    runtime.firebase.storageBucket || (admin.app().options && admin.app().options.storageBucket);
  if (!bucketName) {
    return null;
  }
  return admin.storage().bucket(bucketName);
};

router.get('/objects', async (req, res) => {
  if (runtime.isOffline) {
    return res.status(503).json({
      message: 'Firebase Storage is only available when running in online mode.'
    });
  }

  const bucket = resolveBucket();
  if (!bucket) {
    return res.status(503).json({
      message:
        'Firebase Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET in the server environment.'
    });
  }

  const prefix = normalizePrefix(req.query.prefix);
  const limitParam = Number.parseInt(req.query.limit, 10);
  const maxResults =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(limitParam, MAX_RESULTS)
      : MAX_RESULTS;

  try {
    const [files] = await bucket.getFiles({
      prefix,
      maxResults
    });

    const items = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        let downloadUrl = metadata.mediaLink ?? null;

        try {
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + SIGNED_URL_TTL_MS
          });
          downloadUrl = signedUrl;
        } catch (error) {
          console.warn(`Failed to generate signed URL for ${file.name}:`, error.message);
        }

        return {
          name: file.name,
          bucket: file.bucket.name,
          contentType: metadata.contentType ?? null,
          size: Number(metadata.size ?? 0),
          updatedAt: metadata.updated ?? metadata.timeCreated ?? null,
          etag: metadata.etag ?? null,
          generation: metadata.generation ?? null,
          md5Hash: metadata.md5Hash ?? null,
          downloadUrl
        };
      })
    );

    res.json({
      prefix,
      count: items.length,
      files: items
    });
  } catch (error) {
    console.error('Failed to list Firebase Storage objects:', error);
    res.status(500).json({ message: 'Failed to list Firebase Storage objects.' });
  }
});

module.exports = router;
