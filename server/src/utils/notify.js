/**
 * Creates wall notifications. Failures are logged and swallowed: a missed
 * notification must never break liking, commenting or deleting.
 */
const Notification = require('../models/Notification');
const { publicName } = require('./validate');

const short = (s = '', n = 120) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const id = (x) => String(x?._id || x);

async function safe(fn) {
  try { await fn(); } catch (err) { console.error(`[notify] ${err.message}`); }
}

/** Someone liked a post: one notification per person per post. */
exports.liked = (post, actor) => safe(async () => {
  if (id(post.author) === id(actor)) return;
  await Notification.findOneAndUpdate(
    { user: post.author, type: 'like', post: post._id, actor: actor._id },
    { $set: { actorName: publicName(actor.name), snippet: short(post.text || 'your photo'), read: false, createdAt: new Date(), updatedAt: new Date() } },
    { upsert: true, timestamps: false }
  );
});

/** The like was taken back: drop the notification if it was not read yet. */
exports.unliked = (post, actor) => safe(() => Notification.deleteOne({ user: post.author, type: 'like', post: post._id, actor: actor._id, read: false }));

/** New comment: tell the post's author, and everyone else who commented on the post. */
exports.commented = (post, actor, text) => safe(async () => {
  const name = actor.role === 'admin' ? 'PVO staff' : publicName(actor.name);
  const snippet = short(text);
  const docs = [];
  if (id(post.author) !== id(actor)) docs.push({ user: post.author, type: 'comment', actor: actor._id, actorName: name, post: post._id, snippet });
  const others = new Set(post.comments.map((c) => id(c.user)));
  others.delete(id(actor));
  others.delete(id(post.author));
  for (const u of others) docs.push({ user: u, type: 'reply', actor: actor._id, actorName: name, post: post._id, snippet });
  if (docs.length) await Notification.insertMany(docs, { ordered: false });
});

/** PVO staff removed someone's post or comment. */
exports.removed = (userId, what, text) => safe(() => Notification.create({ user: userId, type: 'removed', actorName: 'PVO staff', snippet: short(`${what}: ${text || 'photo'}`) }));

/** The shop changed the status of an order, or wrote to the buyer. */
exports.order = (order, text) => safe(() => Notification.create({
  user: order.buyer?._id || order.buyer, type: 'order', actorName: 'Alaga Shop', order: order._id, snippet: short(`${order.reference}: ${text}`),
}));

/** Something happened in the user's own shop (a new order, a cancelled order, a removed listing). */
exports.shop = (sellerId, text, orderId) => safe(() => Notification.create({
  user: sellerId, type: 'shop', actorName: 'Alaga Shop', order: orderId, snippet: short(text),
}));

/** A post was deleted: its notifications point nowhere now. */
exports.postGone = (postId) => safe(() => Notification.deleteMany({ post: postId, type: { $ne: 'removed' } }));
