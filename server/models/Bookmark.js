const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pinId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pin', required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookmarkCollection' },
    notes: String,
    reminderAt: Date,
    tagIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    audit: {
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  { timestamps: true }
);

bookmarkSchema.index({ userId: 1, pinId: 1 }, { unique: true });

const bookmarkCollectionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: String,
    bookmarkIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    followerIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }
  },
  { timestamps: true }
);

module.exports = {
  Bookmark: mongoose.model('Bookmark', bookmarkSchema),
  BookmarkCollection: mongoose.model('BookmarkCollection', bookmarkCollectionSchema)
};
