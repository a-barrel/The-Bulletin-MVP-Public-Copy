const express = require('express');
const { randomUUID, randomBytes } = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const storageService = require('../services/storageService');
const runtime = require('../config/runtime');

const router = express.Router();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB upper bound for debug uploads
const TARGET_DIMENSION = 512;

const resolveRequestBaseUrl = (req) => {
  const forwardedProtoHeader = req.headers['x-forwarded-proto'];
  const forwardedHostHeader = req.headers['x-forwarded-host'];

  const protocol =
    (forwardedProtoHeader ? forwardedProtoHeader.split(',')[0].trim() : undefined) ||
    req.protocol ||
    'http';

  const host =
    (forwardedHostHeader ? forwardedHostHeader.split(',')[0].trim() : undefined) || req.get('host');

  return `${protocol}://${host}`;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES
  },
  fileFilter: (_req, file, cb) => {
    if (!file?.mimetype?.startsWith('image/')) {
      cb(new Error('Only image files are supported.'));
      return;
    }
    cb(null, true);
  }
});

const processSingleImage = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image exceeds the 10MB upload limit.' });
      }
      return res.status(400).json({ message: error.message || 'Invalid image upload.' });
    }

    return res.status(400).json({ message: error.message || 'Invalid image upload.' });
  });
};

router.post('/images', processSingleImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required.' });
    }

    const identifier = randomUUID ? randomUUID() : randomBytes(16).toString('hex');
    const fileName = `${Date.now()}-${identifier}.jpg`;
    const processed = sharp(req.file.buffer).resize(TARGET_DIMENSION, TARGET_DIMENSION, {
      fit: 'cover',
      position: 'centre'
    });
    const { data, info } = await processed.jpeg({ quality: 82 }).toBuffer({ resolveWithObject: true });

    const storageResult = await storageService.saveImageAsset({
      buffer: data,
      fileName,
      size: info?.size,
      offlineDir: req.app.get('imagesDir'),
      offlinePublicPath: '/images',
      makePublic: runtime.isOnline
    });

    if (runtime.isOffline && !storageResult.relativeUrl) {
      return res
        .status(500)
        .json({ message: 'Image storage directory is not configured for offline mode.' });
    }

    const imageUrl =
      storageResult.publicUrl ?? `${resolveRequestBaseUrl(req)}${storageResult.relativeUrl}`;

    res.status(201).json({
      url: imageUrl,
      width: info?.width ?? TARGET_DIMENSION,
      height: info?.height ?? TARGET_DIMENSION,
      mimeType: 'image/jpeg',
      fileName,
      size: storageResult.size ?? info?.size ?? data.length,
      uploadedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to process image upload:', error);
    res.status(500).json({ message: 'Failed to process image upload.' });
  }
});

module.exports = router;
