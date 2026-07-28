// lib/mongoStore.js — mode persistant : stockage dans MongoDB Atlas.
// Utilisé automatiquement dès qu'une variable d'environnement MONGODB_URI
// est définie. Mêmes fonctions exactes que localStore.js, pour que
// server.js n'ait jamais besoin de savoir lequel des deux est actif.

const { MongoClient } = require('mongodb');
const seed = require('../data.json'); // sert uniquement à peupler la base au tout premier lancement

let db;

async function connect() {
  if (db) return db;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db('festival_solstice');
  await seedIfEmpty();
  return db;
}

// Au tout premier démarrage (base vide), on copie les données de départ
// de data.json dans MongoDB, pour ne pas repartir d'une app vide.
async function seedIfEmpty() {
  const eventsCount = await db.collection('events').countDocuments();
  if (eventsCount === 0) {
    await db.collection('events').insertMany(seed.events);
  }
  const reviewsCount = await db.collection('reviews').countDocuments();
  if (reviewsCount === 0) {
    await db.collection('reviews').insertMany(seed.reviews);
  }
  const photosCount = await db.collection('photos').countDocuments();
  if (photosCount === 0) {
    await db.collection('photos').insertMany(seed.photos);
  }
  const notifCount = await db.collection('notifications').countDocuments();
  if (notifCount === 0) {
    await db.collection('notifications').insertMany(seed.notifications);
  }
  const placesCount = await db.collection('places').countDocuments();
  if (placesCount === 0) {
    await db.collection('places').insertMany(seed.places);
  }
}

async function nextId(collectionName) {
  // Émule un identifiant auto-incrémenté simple (suffisant pour ce projet).
  const last = await db.collection(collectionName).find().sort({ id: -1 }).limit(1).toArray();
  return (last[0]?.id || 0) + 1;
}

async function getEvents() {
  await connect();
  return db.collection('events').find({}, { projection: { _id: 0 } }).toArray();
}

async function reserveEvent(eventId, quantity) {
  await connect();
  if (quantity < 1 || quantity > 8) return { ok: false, status: 400, error: "Quantité invalide (1 à 8 places)." };

  // Décrémente les places de façon atomique : ne réussit que s'il reste assez de places,
  // ce qui évite les problèmes si deux personnes réservent en même temps.
  const event = await db.collection('events').findOneAndUpdate(
    { id: eventId, seatsLeft: { $gte: quantity } },
    { $inc: { seatsLeft: -quantity } },
    { returnDocument: 'after' }
  );

  if (!event) {
    const exists = await db.collection('events').findOne({ id: eventId });
    if (!exists) return { ok: false, status: 404, error: "Événement introuvable." };
    return { ok: false, status: 409, error: "Plus assez de places disponibles." };
  }

  const ticketCode = `SOLSTICE-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const reservation = {
    id: await nextId('reservations'),
    eventId, eventTitle: event.title, quantity,
    total: quantity * event.price, ticketCode,
    createdAt: new Date().toISOString()
  };
  await db.collection('reservations').insertOne(reservation);
  return { ok: true, reservation };
}

async function getReviews() {
  await connect();
  return db.collection('reviews').find({}, { projection: { _id: 0 } }).sort({ id: -1 }).toArray();
}

async function addReview({ name, rating, event, text }) {
  await connect();
  const review = {
    id: await nextId('reviews'),
    name: (name && name.trim()) || 'Anonyme',
    rating,
    event: (event && event.trim()) || 'Avis général',
    text: text.trim()
  };
  await db.collection('reviews').insertOne(review);
  delete review._id;
  return review;
}

async function getNotifications() {
  await connect();
  return db.collection('notifications').find({}, { projection: { _id: 0 } }).sort({ id: -1 }).toArray();
}

async function addNotification({ type, title, message }) {
  await connect();
  const notification = {
    id: await nextId('notifications'),
    type, title: title.trim(), message: message.trim(),
    createdAt: new Date().toISOString()
  };
  await db.collection('notifications').insertOne(notification);
  delete notification._id;
  return notification;
}

async function getPlaces() {
  await connect();
  return db.collection('places').find({}, { projection: { _id: 0 } }).toArray();
}

async function getPlanning(userId) {
  await connect();
  const doc = await db.collection('plannings').findOne({ userId });
  return doc?.eventIds || [];
}

async function updatePlanning(userId, eventId, action) {
  await connect();
  if (action === 'remove') {
    await db.collection('plannings').updateOne(
      { userId }, { $pull: { eventIds: eventId } }, { upsert: true }
    );
  } else {
    await db.collection('plannings').updateOne(
      { userId }, { $addToSet: { eventIds: eventId } }, { upsert: true }
    );
  }
  const doc = await db.collection('plannings').findOne({ userId });
  return doc?.eventIds || [];
}

async function getPhotos() {
  await connect();
  return db.collection('photos').find({}, { projection: { _id: 0 } }).toArray();
}

async function addPhoto({ user, image }) {
  await connect();
  const photo = { id: await nextId('photos'), user, image, likes: 0, liked: false };
  await db.collection('photos').insertOne(photo);
  delete photo._id;
  return photo;
}

async function toggleLike(photoId) {
  await connect();
  const photo = await db.collection('photos').findOne({ id: photoId });
  if (!photo) return null;
  const liked = !photo.liked;
  const likes = photo.likes + (liked ? 1 : -1);
  await db.collection('photos').updateOne({ id: photoId }, { $set: { liked, likes } });
  return { ...photo, liked, likes, _id: undefined };
}

module.exports = {
  mode: 'MongoDB Atlas',
  getEvents, reserveEvent,
  getReviews, addReview,
  getNotifications, addNotification,
  getPlaces,
  getPlanning, updatePlanning,
  getPhotos, addPhoto, toggleLike
};
