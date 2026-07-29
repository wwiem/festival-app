require('dotenv').config();

const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const store = require('./lib/store');
const photoStore = require('./lib/photoStore');

const app = express();
const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);
const io = new Server(httpServer);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// En mode "disque local" uniquement : les photos uploadées sont servies
// depuis /uploads. En mode Cloudinary, ce n'est pas nécessaire (les photos
// sont hébergées directement chez Cloudinary, via une URL externe).
if (photoStore.usesLocalDisk) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// ---------- TEMPS RÉEL (Socket.io) ----------
io.on('connection', async (socket) => {
  try {
    const notifications = await store.getNotifications();
    socket.emit('notification:history', notifications);
  } catch (err) {
    console.error('Erreur envoi historique notifications :', err.message);
  }
});

// ---------- DIAGNOSTIC TEMPORAIRE ----------
// Route de dépannage : ne révèle aucun secret, juste si les variables
// sont détectées et quel mode de stockage est actif. À supprimer une
// fois que tout fonctionne, si tu veux.
app.get('/api/debug', (req, res) => {
  res.json({
    storeMode: store.mode,
    photoMode: photoStore.mode,
    hasMongoUri: !!process.env.MONGODB_URI,
    mongoUriLength: process.env.MONGODB_URI ? process.env.MONGODB_URI.length : 0,
    hasCloudinaryCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
    hasCloudinaryApiKey: !!process.env.CLOUDINARY_API_KEY,
    hasCloudinaryApiSecret: !!process.env.CLOUDINARY_API_SECRET
  });
});

// ---------- ÉVÉNEMENTS ----------

app.get('/api/events', async (req, res) => {
  try {
    res.json(await store.getEvents());
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

app.post('/api/events/:id/reservations', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const quantity = parseInt(req.body.quantity, 10) || 1;
    const result = await store.reserveEvent(eventId, quantity);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.reservation);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

// ---------- AVIS ----------

app.get('/api/reviews', async (req, res) => {
  try {
    res.json(await store.getReviews());
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { name, rating, event, text } = req.body;
    const ratingNum = parseInt(rating, 10);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "La note doit être comprise entre 1 et 5." });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Le commentaire ne peut pas être vide." });
    }
    const review = await store.addReview({ name, rating: ratingNum, event, text });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

// ---------- NOTIFICATIONS ----------

app.get('/api/notifications', async (req, res) => {
  try {
    res.json(await store.getNotifications());
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const { type, title, message } = req.body;
    const allowedTypes = ['info', 'warning', 'danger'];
    if (!title || !title.trim() || !message || !message.trim()) {
      return res.status(400).json({ error: "Titre et message sont obligatoires." });
    }
    const notification = await store.addNotification({
      type: allowedTypes.includes(type) ? type : 'info', title, message
    });
    io.emit('notification:new', notification);
    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

// ---------- CARTE / LIEUX ----------

app.get('/api/places', async (req, res) => {
  try {
    res.json(await store.getPlaces());
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

// ---------- PLANNING PERSONNEL ----------

app.get('/api/planning/:userId', async (req, res) => {
  try {
    res.json(await store.getPlanning(req.params.userId));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

app.post('/api/planning/:userId', async (req, res) => {
  try {
    const eventId = parseInt(req.body.eventId, 10);
    const list = await store.updatePlanning(req.params.userId, eventId, req.body.action);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

// ---------- GALERIE PHOTO ----------

app.get('/api/photos', async (req, res) => {
  try {
    res.json(await store.getPhotos());
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

app.post('/api/photos/:id/like', async (req, res) => {
  try {
    const photo = await store.toggleLike(parseInt(req.params.id, 10));
    if (!photo) return res.status(404).json({ error: "Photo introuvable." });
    res.json(photo);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur : " + err.message });
  }
});

// Partager une nouvelle photo : le fichier est envoyé vers Cloudinary ou
// le disque local selon la configuration (voir lib/photoStore.js), et
// seule son URL publique est enregistrée en base.
app.post('/api/photos', (req, res) => {
  photoStore.uploadMiddleware(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Fichier invalide." });
    }
    try {
      const image = await photoStore.uploadToStorage(req);
      const photo = await store.addPhoto({ user: (req.body.user || '@invité').trim(), image });
      res.status(201).json(photo);
    } catch (uploadErr) {
      if (uploadErr.message === 'NO_FILE') {
        return res.status(400).json({ error: "Aucune image reçue (formats acceptés : jpg, png, webp, gif — 8 Mo max)." });
      }
      res.status(500).json({ error: "Échec de l'envoi de la photo : " + uploadErr.message });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`✔ Festival Solstice — serveur lancé sur http://localhost:${PORT}`);
  console.log(`  ↳ Données   : ${store.mode}`);
  console.log(`  ↳ Photos    : ${photoStore.mode}`);
});
