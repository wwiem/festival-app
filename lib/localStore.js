// lib/localStore.js — mode de secours : stockage dans un fichier JSON local.
// Utilisé automatiquement quand aucune variable d'environnement MONGODB_URI
// n'est définie (typiquement : développement sur ta machine, sans compte
// cloud à configurer). Mêmes fonctions que mongoStore.js, pour que
// server.js n'ait jamais besoin de savoir lequel des deux est actif.

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

function read() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function write(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function getEvents() {
  return read().events;
}

async function reserveEvent(eventId, quantity) {
  const data = read();
  const event = data.events.find(e => e.id === eventId);
  if (!event) return { ok: false, status: 404, error: "Événement introuvable." };
  if (quantity < 1 || quantity > 8) return { ok: false, status: 400, error: "Quantité invalide (1 à 8 places)." };
  if (event.seatsLeft < quantity) return { ok: false, status: 409, error: "Plus assez de places disponibles." };

  event.seatsLeft -= quantity;
  const ticketCode = `SOLSTICE-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const reservation = {
    id: data.reservations.length + 1,
    eventId, eventTitle: event.title, quantity,
    total: quantity * event.price, ticketCode,
    createdAt: new Date().toISOString()
  };
  data.reservations.push(reservation);
  write(data);
  return { ok: true, reservation };
}

async function getReviews() {
  const data = read();
  return [...data.reviews].reverse();
}

async function addReview({ name, rating, event, text }) {
  const data = read();
  const review = {
    id: data.reviews.length + 1,
    name: (name && name.trim()) || 'Anonyme',
    rating,
    event: (event && event.trim()) || 'Avis général',
    text: text.trim()
  };
  data.reviews.push(review);
  write(data);
  return review;
}

async function getNotifications() {
  const data = read();
  return [...data.notifications].reverse();
}

async function addNotification({ type, title, message }) {
  const data = read();
  const notification = {
    id: data.notifications.length + 1,
    type, title: title.trim(), message: message.trim(),
    createdAt: new Date().toISOString()
  };
  data.notifications.push(notification);
  write(data);
  return notification;
}

async function getPlaces() {
  return read().places;
}

async function getPlanning(userId) {
  const data = read();
  return data.plannings[userId] || [];
}

async function updatePlanning(userId, eventId, action) {
  const data = read();
  if (!data.plannings[userId]) data.plannings[userId] = [];
  const list = data.plannings[userId];
  if (action === 'remove') {
    data.plannings[userId] = list.filter(x => x !== eventId);
  } else if (!list.includes(eventId)) {
    list.push(eventId);
  }
  write(data);
  return data.plannings[userId];
}

async function getPhotos() {
  return read().photos;
}

async function addPhoto({ user, image }) {
  const data = read();
  const photo = { id: data.photos.length + 1, user, image, likes: 0, liked: false };
  data.photos.push(photo);
  write(data);
  return photo;
}

async function toggleLike(photoId) {
  const data = read();
  const photo = data.photos.find(p => p.id === photoId);
  if (!photo) return null;
  photo.liked = !photo.liked;
  photo.likes += photo.liked ? 1 : -1;
  write(data);
  return photo;
}

module.exports = {
  mode: 'JSON local (data.json)',
  getEvents, reserveEvent,
  getReviews, addReview,
  getNotifications, addNotification,
  getPlaces,
  getPlanning, updatePlanning,
  getPhotos, addPhoto, toggleLike
};
