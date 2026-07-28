// lib/photoStore.js — gère l'endroit où sont physiquement stockées les
// photos envoyées par les visiteurs.
//
//  - Variables CLOUDINARY_* définies dans l'environnement → les photos sont
//    envoyées vers Cloudinary (service gratuit dédié aux images) et seule
//    leur URL est conservée en base. Persistant, recommandé pour la mise en ligne.
//  - sinon → les photos sont écrites sur le disque du serveur, dans /uploads.
//    Pratique en local, mais NON persistant sur la plupart des hébergeurs gratuits.

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MAX_SIZE = 8 * 1024 * 1024; // 8 Mo

let uploadMiddleware;
let uploadToStorage; // (req) => Promise<string> URL publique de l'image

if (useCloudinary) {
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  // Le fichier est gardé en mémoire (pas sur disque) puis transmis directement
  // à Cloudinary — rien n'est jamais écrit sur le disque du serveur.
  uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => cb(null, ALLOWED_EXT.includes(path.extname(file.originalname).toLowerCase()))
  }).single('photo');

  uploadToStorage = (req) => new Promise((resolve, reject) => {
    if (!req.file) return reject(new Error('NO_FILE'));
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'solstice-festival' },
      (err, result) => err ? reject(err) : resolve(result.secure_url)
    );
    stream.end(req.file.buffer);
  });

} else {
  const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

  uploadMiddleware = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
      }
    }),
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => cb(null, ALLOWED_EXT.includes(path.extname(file.originalname).toLowerCase()))
  }).single('photo');

  uploadToStorage = (req) => {
    if (!req.file) return Promise.reject(new Error('NO_FILE'));
    return Promise.resolve(`/uploads/${req.file.filename}`);
  };
}

module.exports = {
  mode: useCloudinary ? 'Cloudinary' : 'Disque local (/uploads)',
  usesLocalDisk: !useCloudinary,
  uploadMiddleware,
  uploadToStorage
};
