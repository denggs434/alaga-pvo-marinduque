/**
 * Community wall: posts (text, photos or both) under the owner's own name,
 * with likes and comments. (Older posts may still reference a pet.) Anyone can read the wall; posts from private pets
 * are hidden from everyone except the owner and the PVO. Owners post; any
 * logged-in account can like and comment.
 *
 * Feed order: "latest" (newest first) or "discover", a shuffled order that is
 * stable for one `seed`, so paging never repeats or skips a post.
 */
const Post = require('../models/Post');
const Pet = require('../models/Pet');
const HttpError = require('../utils/httpError');
const notify = require('../utils/notify');
const asyncHandler = require('../utils/asyncHandler');
const { str, paging, requireId, publicName } = require('../utils/validate');

const POPULATE = [
  { path: 'pet', select: 'name species breed photos municipality isPublic owner status' },
  { path: 'author', select: 'name municipality' },
  { path: 'comments.user', select: 'name role' },
];

const isAdmin = (u) => u?.role === 'admin';
const same = (a, b) => !!a && !!b && String(a._id || a) === String(b._id || b);

/** Shape a post for a viewer: counts instead of raw like lists, permission flags. */
function serializePost(post, viewer) {
  const pet = post.pet;
  const photos = post.photos?.length ? post.photos : post.photo ? [post.photo] : [];
  return {
    _id: post._id,
    text: post.text || '',
    photos,
    photo: photos[0], // older clients read a single photo
    createdAt: post.createdAt,
    pet: pet ? { _id: pet._id, name: pet.name, species: pet.species, breed: pet.breed, photo: pet.photos?.[0], municipality: pet.municipality, status: pet.status } : null,
    author: { name: publicName(post.author?.name || 'Former member'), municipality: post.author?.municipality },
    likeCount: post.likes.length,
    liked: !!viewer && post.likes.some((id) => same(id, viewer)),
    comments: post.comments.map((c) => ({
      _id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      user: { name: c.user ? publicName(c.user.name) : 'Former member', staff: c.user?.role === 'admin' },
      canDelete: same(c.user, viewer) || same(post.author, viewer) || isAdmin(viewer),
    })),
    canDelete: same(post.author, viewer) || isAdmin(viewer),
  };
}

async function loadPost(id) {
  const post = await Post.findById(requireId(id, 'Post'));
  if (!post) throw new HttpError(404, 'This post was removed.');
  return post;
}

async function respond(res, post, viewer, status = 200) {
  await post.populate(POPULATE);
  res.status(status).json(serializePost(post, viewer));
}

/** Seeded shuffle key: ((ms since epoch mod P) * seed) mod P, P prime. Same seed, same order. */
const P = 1000003;
const shuffleKey = (seed) => ({ $mod: [{ $multiply: [{ $mod: [{ $toLong: '$createdAt' }, P] }, seed] }, P] });

// GET /api/posts?pet=&page=&limit=&order=latest|discover&seed=
exports.listPosts = asyncHandler(async (req, res) => {
  const filter = {};
  const petId = str(req.query.pet);
  if (petId) {
    const pet = await Pet.findById(requireId(petId, 'Pet')).select('owner isPublic').lean();
    const allowed = pet && (pet.isPublic || same(pet.owner, req.user) || isAdmin(req.user));
    if (!allowed) throw new HttpError(404, 'This pet profile does not exist or is private.');
    filter.pet = pet._id;
  } else if (!isAdmin(req.user)) {
    // Hide posts of private pets from the shared wall.
    const hidden = await Pet.distinct('_id', { isPublic: false });
    if (hidden.length) filter.pet = { $nin: hidden };
  }

  const { limit, page, skip } = paging(req.query, { limit: 8, max: 30 });
  const discover = str(req.query.order) === 'discover' && !petId; // a pet's own page is always newest first
  const seed = Math.min(Math.max(parseInt(req.query.seed, 10) || 1, 1), P - 1);
  let ids;
  if (discover) {
    // Posts from the last day stay on top so new activity is seen first; older ones are mixed.
    const dayAgo = new Date(Date.now() - 24 * 3600e3);
    const rows = await Post.aggregate([
      { $match: filter },
      { $addFields: { fresh: { $cond: [{ $gte: ['$createdAt', dayAgo] }, 1, 0] }, mix: shuffleKey(seed) } },
      { $sort: { fresh: -1, mix: 1, _id: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _id: 1 } },
    ]);
    ids = rows.map((r) => r._id);
  }
  const [found, total] = await Promise.all([
    discover
      ? Post.find({ _id: { $in: ids } }).populate(POPULATE).lean()
      : Post.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
    Post.countDocuments(filter),
  ]);
  const posts = discover ? ids.map((id) => found.find((p) => String(p._id) === String(id))).filter(Boolean) : found;
  res.json({
    // A post whose pet was removed comes back with pet: null; posts made without a pet have no pet at all.
    items: posts.filter((p) => p.pet !== null).map((p) => serializePost(p, req.user)),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

// POST /api/posts  { text?, photos?: [] }  (owner; posts are under the owner's name, never a pet's)
exports.createPost = asyncHandler(async (req, res) => {
  const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
  let photos = req.body.photos ?? (req.body.photo ? [req.body.photo] : []);
  if (!Array.isArray(photos) || photos.some((p) => typeof p !== 'string')) throw new HttpError(400, 'Upload the photos again.');
  photos = [...new Set(photos)];
  if (photos.length > Post.MAX_PHOTOS) throw new HttpError(400, `A post can have up to ${Post.MAX_PHOTOS} photos.`);
  if (!text && !photos.length) throw new HttpError(400, 'Write something or add a photo.', { text: 'Write something or add a photo.' });

  const post = await Post.create({ author: req.user._id, text, photos });
  await respond(res, post, req.user, 201);
});

// GET /api/posts/:id  (one post, e.g. opened from a notification)
exports.getPost = asyncHandler(async (req, res) => {
  const post = await Post.findById(requireId(req.params.id, 'Post')).populate(POPULATE).lean();
  if (!post || post.pet === null) throw new HttpError(404, 'This post was removed.');
  const hidden = post.pet && post.pet.isPublic === false && !same(post.author, req.user) && !same(post.pet.owner, req.user) && !isAdmin(req.user);
  if (hidden) throw new HttpError(404, 'This post was removed.');
  res.json(serializePost(post, req.user));
});

// DELETE /api/posts/:id  (author or admin)
exports.deletePost = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  if (!same(post.author, req.user) && !isAdmin(req.user)) throw new HttpError(403, 'You can only delete your own posts.');
  await post.deleteOne();
  await notify.postGone(post._id); // finish the cleanup before answering, so no stale notification points at it
  if (!same(post.author, req.user)) notify.removed(post.author, 'Your post was removed by the PVO', post.text);
  res.json({ message: 'Post deleted.' });
});

// POST /api/posts/:id/like  (toggle; any logged-in account)
// Each branch is a single conditional update, so double taps cannot double-count.
exports.toggleLike = asyncHandler(async (req, res) => {
  const id = requireId(req.params.id, 'Post');
  const uid = req.user._id;
  let post = await Post.findOneAndUpdate({ _id: id, likes: { $ne: uid } }, { $addToSet: { likes: uid } }, { new: true });
  let liked = true;
  if (!post) {
    post = await Post.findOneAndUpdate({ _id: id }, { $pull: { likes: uid } }, { new: true });
    if (!post) throw new HttpError(404, 'This post was removed.');
    liked = false;
  }
  if (liked) notify.liked(post, req.user);
  else notify.unliked(post, req.user);
  res.json({ liked, likeCount: post.likes.length });
});

// POST /api/posts/:id/comments  { text }  (any logged-in account)
exports.addComment = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  post.comments.push({ user: req.user._id, text: req.body.text });
  await post.save();
  notify.commented(post, req.user, post.comments[post.comments.length - 1].text);
  await respond(res, post, req.user, 201);
});

// DELETE /api/posts/:id/comments/:cid  (comment author, post author, or admin)
exports.deleteComment = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  const c = post.comments.id(requireId(req.params.cid, 'Comment'));
  if (!c) throw new HttpError(404, 'Comment not found.');
  if (!same(c.user, req.user) && !same(post.author, req.user) && !isAdmin(req.user)) {
    throw new HttpError(403, 'You can only delete your own comments.');
  }
  const removedByStaff = isAdmin(req.user) && !same(c.user, req.user);
  const commentAuthor = c.user;
  const commentText = c.text;
  c.deleteOne();
  await post.save();
  if (removedByStaff) notify.removed(commentAuthor, 'Your comment was removed by the PVO', commentText);
  await respond(res, post, req.user);
});
