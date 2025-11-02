const express = require('express');
const { z, ZodError } = require('zod');

const verifyToken = require('../middleware/verifyToken');
const User = require('../models/User');
const Feedback = require('../models/Feedback');

const router = express.Router();

const FeedbackInputSchema = z.object({
  message: z.string().trim().min(10, 'Please provide at least 10 characters.').max(2000),
  contact: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional()
});

const resolveViewerUser = async (req) => {
  if (!req?.user?.uid) {
    return null;
  }

  try {
    const viewer = await User.findOne({ firebaseUid: req.user.uid }).select({ _id: 1 });
    return viewer;
  } catch (error) {
    console.error('Failed to resolve viewer user for feedback route:', error);
    return null;
  }
};

router.post('/', verifyToken, async (req, res) => {
  try {
    const input = FeedbackInputSchema.parse(req.body);
    const viewer = await resolveViewerUser(req);

    const feedback = await Feedback.create({
      message: input.message.trim(),
      contact: input.contact?.trim() || '',
      category: input.category?.trim() || '',
      submittedById: viewer?._id || undefined
    });

    res.status(201).json({
      id: feedback._id.toString(),
      createdAt: feedback.createdAt.toISOString()
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid feedback submission.', issues: error.errors });
    }
    console.error('Failed to record anonymous feedback:', error);
    res.status(500).json({ message: 'Failed to send feedback. Please try again later.' });
  }
});

module.exports = router;
