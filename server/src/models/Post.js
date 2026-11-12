/**
 * A community wall post: text, photos, or both, under the owner's own name.
 * `pet` is only set on older posts that were written "as" a pet.
 * Likes and comments are embedded: a post is always read together with them.
 */
const mongoose = require('mongoose');
const { IMAGE_PATH } = require('../config/constants');

const MAX_PHOTOS = 4;

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: [true, 'Write a comment first.'], trim: true, maxlength: [500, 'Comments are limited to 500 characters.'] },
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', index: true },
    text: { type: String, trim: true, default: '', maxlength: [1000, 'Posts are limited to 1000 characters.'] },
    // `photo` is the single photo of posts made before albums; new posts use `photos`.
    photo: { type: String, match: [IMAGE_PATH, 'Upload the photo again.'] },
    photos: {
      type: [{ type: String, match: [IMAGE_PATH, 'Upload the photo again.'] }],
      validate: [(v) => v.length <= MAX_PHOTOS, `A post can have up to ${MAX_PHOTOS} photos.`],
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: { type: [commentSchema], validate: [(v) => v.length <= 300, 'This post has too many comments.'] },
  },
  { timestamps: true }
);

// A post needs words, a photo, or both.
postSchema.pre('validate', function requireContent(next) {
  if (!this.text && !this.photo && !this.photos?.length) this.invalidate('text', 'Write something or add a photo.');
  next();
});

postSchema.index({ createdAt: -1 });
postSchema.statics.MAX_PHOTOS = MAX_PHOTOS;

module.exports = mongoose.model('Post', postSchema);
