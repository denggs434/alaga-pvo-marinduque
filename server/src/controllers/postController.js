/**
 * Community wall: posts written as a pet, with likes and comments.
 * Anyone can read the wall; posts from private pets are hidden from everyone
 * except the owner and the PVO. Owners post; any logged-in account can like/comment.
 */
const Post = require('../models/Post');
const Pet = require('../models/Pet');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { str, paging, requireId, publicName } = require('../utils/validate');

const POPULATE = [
  { path: 'pet', select: 'name species breed photos municipality isPublic owner status' },
  { path: 'author', select: 'name' },
  { path: 'comments.user', select: 'name role' },
];

const isAdmin = (u) => u?.role === 'admin';
const same = (a, b) => !!a && !!b && String(a._id || a) === String(b._id || b);

/** Shape a post for a viewer: counts instead of raw like lists, permission flags. */
function serializePost(post, viewer) {
  const pet = post.pet || {};
  return {
    _id: post._id,
    text: post.text,
    photo: post.photo,
    createdAt: post.createdAt,
    pet: { _id: pet._id, name: pet.name, species: pet.species, breed: pet.breed, photo: pet.photos?.[0], municipality: pet.municipality, status: pet.status },
    author: { name: publicName(post.author?.name || 'Former member') },
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

// GET /api/posts?pet=&page=&limit=
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
  const [posts, total] = await Promise.all([
    Post.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
    Post.countDocuments(filter),
  ]);
  res.json({
    items: posts.filter((p) => p.pet).map((p) => serializePost(p, req.user)),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

// POST /api/posts  { pet, text, photo? }  (owner; the pet must be theirs)
exports.createPost = asyncHandler(async (req, res) => {
  const { pet: petId, text, photo } = req.body;
  if (!petId) throw new HttpError(400, 'Choose which pet is posting.', { pet: 'Choose which pet is posting.' });
  const pet = await Pet.findOne({ _id: requireId(String(petId), 'Pet'), owner: req.user._id }).select('_id');
  if (!pet) throw new HttpError(403, 'You can only post as one of your own pets.');
  const post = await Post.create({ author: req.user._id, pet: pet._id, text, photo: photo || undefined });
  await respond(res, post, req.user, 201);
});

// DELETE /api/posts/:id  (author or admin)
exports.deletePost = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  if (!same(post.author, req.user) && !isAdmin(req.user)) throw new HttpError(403, 'You can only delete your own posts.');
  await post.deleteOne();
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
  res.json({ liked, likeCount: post.likes.length });
});

// POST /api/posts/:id/comments  { text }  (any logged-in account)
exports.addComment = asyncHandler(async (req, res) => {
  const post = await loadPost(req.params.id);
  post.comments.push({ user: req.user._id, text: req.body.text });
  await post.save();
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
  c.deleteOne();
  await post.save();
  await respond(res, post, req.user);
});
