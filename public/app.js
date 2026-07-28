// app.js — logique front-end : récupère les données depuis l'API
// et gère toutes les interactions (filtres, réservation, avis, likes,
// planning synchronisé, carte, notifications temps réel).

// Identifiant anonyme stable par navigateur, pour associer un planning
// personnel sans système de comptes. Stocké une fois puis réutilisé.
function getUserId() {
  let id = localStorage.getItem('solstice_user_id');
  if (!id) {
    id = 'visiteur-' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('solstice_user_id', id);
  }
  return id;
}
const userId = getUserId();

let events = [];
let currentCat = 'all';
let currentDay = '1';
let plannedIds = new Set();

// ---------- PROGRAMME ----------

async function loadEvents() {
  const [eventsRes, planningRes] = await Promise.all([
    fetch('/api/events'),
    fetch(`/api/planning/${userId}`)
  ]);
  events = await eventsRes.json();
  const planning = await planningRes.json();
  plannedIds = new Set(planning);
  renderEvents();
}

function renderEvents() {
  const grid = document.getElementById('ticketGrid');
  const visible = events.filter(e =>
    String(e.day) === currentDay && (currentCat === 'all' || e.cat === currentCat)
  );

  if (visible.length === 0) {
    grid.innerHTML = '<p class="empty-msg">Aucun événement pour ce filtre.</p>';
    return;
  }

  const catLabels = { musique: 'Musique', danse: 'Danse', arts: 'Arts visuels', gastro: 'Gastronomie' };
  const rotations = [-1.5, 1.2, -0.8, 1.8, -1.2, 0.6, -1.6, 1.4];

  grid.innerHTML = visible.map((e, i) => `
    <div class="ticket" style="--rot:${rotations[i % rotations.length]}deg;">
      <div class="ticket-top">
        <span class="ticket-time">${e.time}</span>
        <span class="ticket-cat cat-${e.cat}">${catLabels[e.cat] || e.cat}</span>
      </div>
      <h3>${e.title}</h3>
      <div class="ticket-loc">${e.loc}</div>
      <div class="ticket-seats">${e.seatsLeft} places restantes · ${e.price} DT</div>
      <div class="ticket-divider"></div>
      <div class="ticket-actions">
        <button class="btn-reserve" ${e.seatsLeft < 1 ? 'disabled' : ''} onclick="openModal(${e.id})">
          ${e.seatsLeft < 1 ? 'Complet' : 'Réserver'}
        </button>
        <button class="btn-plan ${plannedIds.has(e.id) ? 'added' : ''}" onclick="togglePlan(${e.id}, this)">
          ${plannedIds.has(e.id) ? '✓ Ajouté' : '+ Planning'}
        </button>
      </div>
    </div>
  `).join('');
}

async function togglePlan(id, btn) {
  const adding = !plannedIds.has(id);
  // Mise à jour optimiste de l'interface, puis confirmation serveur
  if (adding) {
    plannedIds.add(id);
    btn.classList.add('added');
    btn.textContent = '✓ Ajouté';
  } else {
    plannedIds.delete(id);
    btn.classList.remove('added');
    btn.textContent = '+ Planning';
  }

  await fetch(`/api/planning/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: id, action: adding ? 'add' : 'remove' })
  });
}

document.getElementById('catFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCat = btn.dataset.cat;
  renderEvents();
});

document.getElementById('dayTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.day-tab');
  if (!tab) return;
  document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentDay = tab.dataset.day;
  renderEvents();
});

// ---------- MODAL RÉSERVATION ----------

let activeEventId = null;
let qty = 1;

function openModal(eventId) {
  activeEventId = eventId;
  qty = 1;
  const event = events.find(e => e.id === eventId);
  document.getElementById('modalTitle').textContent = event.title;
  document.getElementById('modalInfo').textContent = `${event.time} · ${event.loc}`;
  document.getElementById('qtyVal').textContent = qty;
  document.getElementById('modalTotal').textContent = `${event.price * qty} DT`;
  document.getElementById('modalError').style.display = 'none';
  document.getElementById('modalBooking').style.display = 'block';
  document.getElementById('modalSuccess').classList.remove('show');
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function changeQty(delta) {
  const event = events.find(e => e.id === activeEventId);
  qty = Math.max(1, Math.min(8, qty + delta));
  document.getElementById('qtyVal').textContent = qty;
  document.getElementById('modalTotal').textContent = `${event.price * qty} DT`;
}

async function confirmBooking() {
  const errorEl = document.getElementById('modalError');
  errorEl.style.display = 'none';
  try {
    const res = await fetch(`/api/events/${activeEventId}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty })
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || "Une erreur est survenue.";
      errorEl.style.display = 'block';
      return;
    }
    document.getElementById('modalBooking').style.display = 'none';
    document.getElementById('ticketCode').textContent = data.ticketCode;
    document.getElementById('modalSuccess').classList.add('show');
    await loadEvents(); // rafraîchit le nombre de places restantes
  } catch (err) {
    errorEl.textContent = "Impossible de contacter le serveur.";
    errorEl.style.display = 'block';
  }
}

document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

// ---------- AVIS ----------

let ratingValue = 0;
const stars = document.querySelectorAll('#starPicker span');
stars.forEach(s => {
  s.addEventListener('click', () => {
    ratingValue = parseInt(s.dataset.v, 10);
    stars.forEach(st => st.classList.toggle('active', parseInt(st.dataset.v, 10) <= ratingValue));
  });
});

async function loadReviews() {
  const res = await fetch('/api/reviews');
  const reviews = await res.json();
  renderReviews(reviews);
  renderReviewStats(reviews);
}

function renderReviews(reviews) {
  const container = document.getElementById('reviewCards');
  if (reviews.length === 0) {
    container.innerHTML = '<p class="empty-msg">Aucun avis pour le moment.</p>';
    return;
  }
  const palette = ['#7C5CFF', '#FF5A3C', '#1C9C8D', '#D4FF3D'];
  container.innerHTML = reviews.map((r, i) => `
    <div class="review-card">
      <div class="avatar" style="background:${palette[i % palette.length]};">${r.name.charAt(0).toUpperCase()}</div>
      <div>
        <div class="review-head">
          <span class="review-name">${r.name}</span>
          <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
        </div>
        <div class="review-event">${r.event}</div>
        <p class="review-text">${r.text}</p>
      </div>
    </div>
  `).join('');
}

function renderReviewStats(reviews) {
  const count = reviews.length;
  const avg = count ? (reviews.reduce((sum, r) => sum + r.rating, 0) / count) : 0;
  document.getElementById('avgScore').textContent = count ? avg.toFixed(1) : '—';
  document.getElementById('avgStars').textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
  document.getElementById('avgCount').textContent = `${count} avis cette édition`;
}

async function submitReview() {
  const errorEl = document.getElementById('reviewError');
  errorEl.style.display = 'none';

  const name = document.getElementById('reviewName').value;
  const event = document.getElementById('reviewEvent').value;
  const text = document.getElementById('reviewText').value;

  if (ratingValue === 0) {
    errorEl.textContent = "Choisis une note avant de publier.";
    errorEl.style.display = 'block';
    return;
  }

  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, rating: ratingValue, event, text })
  });
  const data = await res.json();

  if (!res.ok) {
    errorEl.textContent = data.error || "Une erreur est survenue.";
    errorEl.style.display = 'block';
    return;
  }

  document.getElementById('reviewName').value = '';
  document.getElementById('reviewEvent').value = '';
  document.getElementById('reviewText').value = '';
  stars.forEach(st => st.classList.remove('active'));
  ratingValue = 0;

  await loadReviews();
}

// ---------- GALERIE PHOTO ----------

async function loadPhotos() {
  const res = await fetch('/api/photos');
  const photos = await res.json();
  renderPhotos(photos);
}

function renderPhotos(photos) {
  const grid = document.getElementById('masonry');
  const cards = photos.map(p => {
    // Une vraie photo uploadée a un champ "image" (URL /uploads/...).
    // Les photos de démonstration initiales n'en ont pas : on affiche
    // alors un dégradé de couleur à la place.
    const media = p.image
      ? `<img class="photo-fill" src="${p.image}" alt="Photo partagée par ${p.user}" loading="lazy">`
      : `<div class="photo-fill" style="height:${p.height}px; background:linear-gradient(160deg,${p.colorA},${p.colorB});"></div>`;

    return `
      <div class="photo-card" data-id="${p.id}">
        ${media}
        <div class="photo-overlay">
          <span class="photo-user">${p.user}</span>
          <button class="like-btn ${p.liked ? 'liked' : ''}" onclick="toggleLike(${p.id}, event)">
            <span class="heart">${p.liked ? '♥' : '♡'}</span> ${p.likes}
          </button>
        </div>
      </div>
    `;
  }).join('');

  const uploadCard = `
    <div class="upload-card" onclick="shareNewPhoto()">
      <span class="plus">+</span>
      <p>Ajoute<br>ta photo</p>
    </div>
  `;

  grid.innerHTML = cards + uploadCard;
}

async function toggleLike(id, event) {
  event.stopPropagation();
  const res = await fetch(`/api/photos/${id}/like`, { method: 'POST' });
  const photo = await res.json();
  const btn = event.currentTarget;
  btn.classList.toggle('liked', photo.liked);
  btn.innerHTML = `<span class="heart">${photo.liked ? '♥' : '♡'}</span> ${photo.likes}`;
}

const photoInput = document.getElementById('photoInput');

function shareNewPhoto() {
  // Ouvre le sélecteur de fichiers natif du système (photos du téléphone/PC)
  photoInput.value = '';
  photoInput.click();
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  const errorEl = document.getElementById('uploadError');
  errorEl.style.display = 'none';

  const user = prompt("Ton pseudo pour partager cette photo :", "@invité") || '@invité';

  const formData = new FormData();
  formData.append('photo', file);   // le fichier réel, envoyé en multipart/form-data
  formData.append('user', user);

  try {
    const res = await fetch('/api/photos', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || "Impossible d'envoyer cette photo.";
      errorEl.style.display = 'block';
      return;
    }
    await loadPhotos();
  } catch (err) {
    errorEl.textContent = "Impossible de contacter le serveur.";
    errorEl.style.display = 'block';
  }
});

// ---------- INITIALISATION ----------

loadEvents();
loadReviews();
loadPhotos();
initMap();
initNotifications();

// ---------- CARTE INTERACTIVE ----------

let map, userMarker, routeLine, places = [];
const placeIcons = { scene: '🎤', food: '🍽️', wc: '🚻', secours: '⛑️', sortie: '🚪' };
const placeColors = { scene: '#7C5CFF', food: '#B5860F', wc: '#1C9C8D', secours: '#FF5A3C', sortie: '#ECE7D6' };

async function initMap() {
  // Centre approximatif du site du festival (Cité de la Culture, Tunis)
  map = L.map('map', { zoomControl: true }).setView([36.8065, 10.1820], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  const res = await fetch('/api/places');
  places = await res.json();

  places.forEach(p => {
    const icon = L.divIcon({
      className: 'place-marker',
      html: `<div style="background:${placeColors[p.type] || '#ECE7D6'}; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:15px; border:2px solid #14151F;">${placeIcons[p.type] || '📍'}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    L.marker([p.lat, p.lng], { icon })
      .addTo(map)
      .bindPopup(`<strong>${p.name}</strong><br><button class="route-btn" onclick="routeTo(${p.lat}, ${p.lng})">Itinéraire</button>`);
  });
}

function locateMe() {
  const errorEl = document.getElementById('mapError');
  errorEl.style.display = 'none';

  if (!navigator.geolocation) {
    errorEl.textContent = "La géolocalisation n'est pas disponible sur ce navigateur.";
    errorEl.style.display = 'block';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([latitude, longitude], {
        radius: 9, color: '#D4FF3D', fillColor: '#D4FF3D', fillOpacity: 1, weight: 3
      }).addTo(map).bindPopup('Toi').openPopup();
      map.setView([latitude, longitude], 18);
    },
    () => {
      errorEl.textContent = "Impossible de récupérer ta position (autorisation refusée ou indisponible). Sur un site réel en plein air, ça marche depuis ton téléphone.";
      errorEl.style.display = 'block';
    }
  );
}

function routeTo(lat, lng) {
  const errorEl = document.getElementById('mapError');
  if (!userMarker) {
    errorEl.textContent = "Clique d'abord sur \"Me localiser\" pour tracer un itinéraire.";
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';
  if (routeLine) map.removeLayer(routeLine);
  const from = userMarker.getLatLng();
  routeLine = L.polyline([[from.lat, from.lng], [lat, lng]], {
    color: '#7C5CFF', weight: 4, dashArray: '8 8'
  }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
}

// ---------- NOTIFICATIONS TEMPS RÉEL ----------

let notifications = [];
let unseenCount = 0;

function initNotifications() {
  loadNotificationHistory();

  // Connexion WebSocket : reçoit les annonces publiées en direct
  // depuis la page /admin.html, sans recharger la page.
  const socket = io();
  socket.on('notification:new', (notif) => {
    notifications.unshift(notif);
    unseenCount++;
    renderNotifPanel();
    updateBellDot();
    showToast(notif);
  });
}

async function loadNotificationHistory() {
  const res = await fetch('/api/notifications');
  notifications = await res.json();
  renderNotifPanel();
}

function renderNotifPanel() {
  const list = document.getElementById('notifList');
  if (notifications.length === 0) {
    list.innerHTML = '<p class="empty-msg">Aucune notification pour le moment.</p>';
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.type}">
      <div class="notif-title">${n.title}</div>
      <div class="notif-msg">${n.message}</div>
      <div class="notif-time">${new Date(n.createdAt).toLocaleString('fr-FR')}</div>
    </div>
  `).join('');
}

function updateBellDot() {
  document.getElementById('bellDot').style.display = unseenCount > 0 ? 'block' : 'none';
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) {
    unseenCount = 0;
    updateBellDot();
  }
}

function showToast(notif) {
  const stack = document.getElementById('toastStack');
  const toast = document.createElement('div');
  toast.className = `toast ${notif.type}`;
  toast.innerHTML = `<strong>${notif.title}</strong><p>${notif.message}</p>`;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}
