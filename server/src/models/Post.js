/**
 * A community wall post. Every post is written "as" one of the author's pets.
 * Likes and comments are embedded: a post is always read together with them.
 */
const mongoose = require('mongoose');
const { IMAGE_PATH } = require('../config/constants');

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: [true, 'Write a comment first.'], trim: true, maxlength: [500, 'Comments are limited to 500 characters.'] },
  createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: [true, 'Choose which pet is posting.'], index: true },
    text: { type: String, required: [true, 'Write something to post.'], trim: true, maxlength: [1000, 'Posts are limited to 1000 characters.'] },
    photo: { type: String, match: [IMAGE_PATH, 'Upload the photo again.'] },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: { type: [commentSchema], validate: [(v) => v.length <= 300, 'This post has too many comments.'] },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
