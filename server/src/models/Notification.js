/**
 * A notification for one user about activity on the community wall:
 *  - like:    someone liked your post (one per person per post; removed on unlike)
 *  - comment: someone commented on your post
 *  - reply:   someone commented on a post you also commented on
 *  - removed: PVO staff removed your post or comment
 *  - order:   a seller updated one of your orders
 *  - shop:    news for your own shop (new or cancelled order, listing removed)
 * Old notifications expire after 90 days.
 */
const mongoose = require('mongoose');

const TYPES = ['like', 'comment', 'reply', 'removed', 'order', 'shop'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true, maxlength: 80 },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    snippet: { type: String, trim: true, maxlength: 140 }, // the comment, or the start of the post
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.TYPES = TYPES;
