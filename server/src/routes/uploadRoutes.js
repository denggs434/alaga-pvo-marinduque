/**
 * Image uploads for listings (admin only).
 *
 * POST /api/uploads   multipart/form-data, field "image"
 *   -> 201 { path: "assets/img/uploads/<random>.jpg" }
 *
 * Files are checked by MIME type and by their first bytes (so a renamed .exe
 * is rejected), limited to 5 MB, and saved with a random name the client
 * cannot choose.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const router = require('express').Router();
const multer = require('multer');
const { protect, adminOnly } = require('../middleware/auth');
const HttpError = require('../utils/httpError');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'client', 'assets', 'img', 'uploads');
const MAX_BYTES = 5 * 1024 * 1024;
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

router.post('/', protect, adminOnly, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'That photo is over 5 MB. Export a smaller version and try again.'));
    if (err) return next(err.status ? err : new HttpError(400, 'Upload a JPG, PNG or WebP photo.'));
    if (!req.file) return next(new HttpError(400, 'Choose a photo to upload.'));

    const type = sniff(req.file.buffer);
    if (!type) return next(new HttpError(400, 'That file is not a real JPG, PNG or WebP image.'));

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${TYPES[type]}`;
    fs.writeFile(path.join(UPLOAD_DIR, name), req.file.buffer, (writeErr) => {
      if (writeErr) return next(writeErr);
      res.status(201).json({ path: `assets/img/uploads/${name}` });
    });
  });
});

module.exports = router;
