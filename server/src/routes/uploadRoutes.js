/**
 * Photo uploads: pet photos, wall posts, report evidence, announcements.
 * Any logged-in (not banned) account may upload, at most 40 photos per 15 minutes.
 *
 * POST /api/uploads   multipart/form-data, field "image"
 *   -> 201 { path: "assets/img/uploads/<random>.jpg" }                     (local disk)
 *   -> 201 { path: "https://<store>.public.blob.vercel-storage.com/uploads/<random>.jpg" }  (Vercel)
 *
 * Files are checked by MIME type and by their first bytes (so a renamed .exe
 * is rejected), limited to 4 MB (Vercel caps request bodies at 4.5 MB), and
 * saved with a random name the client cannot choose.
 *
 * Storage: Vercel's filesystem is read-only, so when BLOB_READ_WRITE_TOKEN is set
 * (connected Vercel Blob store) photos go to Vercel Blob; otherwise to the client
 * folder on disk for local development.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = require('express').Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const { protect } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const HttpError = require('../utils/httpError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'client', 'assets', 'img', 'uploads');
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Check the file's real format from its first bytes ("magic numbers"). */
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) =>
    TYPES[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Upload a JPG, PNG or WebP photo.')),
});

const uploadLimit = rateLimit({ windowMs: 15 * 60e3, max: 40, message: 'Too many uploads. Wait a few minutes and try again.' });

router.post('/', protect, uploadLimit, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'That photo is over 4 MB. Export a smaller version and try again.'));
    if (err) return next(err.status ? err : new HttpError(400, 'Upload a JPG, PNG or WebP photo.'));
    if (!req.file) return next(new HttpError(400, 'Choose a photo to upload.'));

    const type = sniff(req.file.buffer);
    if (!type) return next(new HttpError(400, 'That file is not a real JPG, PNG or WebP image.'));

    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${TYPES[type]}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      put(`uploads/${name}`, req.file.buffer, { access: 'public', contentType: type, addRandomSuffix: false })
        .then((blob) => res.status(201).json({ path: blob.url }))
        .catch(next);
      return;
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFile(path.join(UPLOAD_DIR, name), req.file.buffer, (writeErr) => {
      if (writeErr) return next(writeErr);
      res.status(201).json({ path: `assets/img/uploads/${name}` });
    });
  });
});

module.exports = router;
