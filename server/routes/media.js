const express = require('express');
const path = require('path');
const fs = require('fs');
const { randomUUID, randomBytes } = require('crypto');
const multer = require('multer');
const sharp = require('sharp');

const router = express.Router();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB upper bound for debug uploads
const TARGET_DIMENSION = 512;

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

    const imagesDir = req.app.get('imagesDir');
    if (!imagesDir) {
      return res.status(500).json({ message: 'Image storage directory is not configured.' });
    }

    const identifier = randomUUID ? randomUUID() : randomBytes(16).toString('hex');
    const fileName = `${Date.now()}-${identifier}.jpg`;
    const destinationPath = path.join(imagesDir, fileName);

    await sharp(req.file.buffer)
      .resize(TARGET_DIMENSION, TARGET_DIMENSION, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({ quality: 82 })
      .toFile(destinationPath);

    const { size } = await fs.promises.stat(destinationPath);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/images/${fileName}`;

    res.status(201).json({
      url: publicUrl,
      width: TARGET_DIMENSION,
      height: TARGET_DIMENSION,
      mimeType: 'image/jpeg',
      fileName,
      size,
      uploadedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to process image upload:', error);
    res.status(500).json({ message: 'Failed to process image upload.' });
  }
});

module.exports = router;
