# SOLSTICE — Festival des arts vivants

Application web complète (front-end + back-end) pour un festival culturel :
programme filtrable, réservation de places, avis avec notation, et galerie
photo communautaire.

## 🧱 Stack

| Partie    | Techno                                   |
|-----------|-------------------------------------------|
| Front-end | HTML / CSS / JavaScript natif (aucun framework, aucune étape de build) |
| Back-end  | Node.js + Express + Socket.io (temps réel) |
| Données   | `data.json` en local, ou **MongoDB Atlas** (gratuit) une fois en ligne |
| Photos    | Dossier `uploads/` en local, ou **Cloudinary** (gratuit) une fois en ligne |
| Carte     | Leaflet.js + fonds de carte OpenStreetMap (gratuit, sans clé API) |

Le projet bascule **automatiquement** entre stockage local et stockage cloud
persistant selon les variables d'environnement présentes — voir la section
"Mettre le site en ligne" plus bas.

## 📁 Structure du projet

```
festival-app/
├── server.js              → serveur Express + Socket.io + toutes les routes API
├── data.json               → données de départ (+ stockage si mode local)
├── .env.example             → modèle des variables d'environnement (à copier en .env)
├── package.json
├── lib/
│   ├── store.js             → choisit automatiquement localStore ou mongoStore
│   ├── localStore.js        → stockage dans data.json (mode local, développement)
│   ├── mongoStore.js        → stockage dans MongoDB Atlas (mode production)
│   └── photoStore.js        → choisit automatiquement disque local ou Cloudinary
└── public/                 → tout le front-end, servi tel quel par Express
    ├── index.html
    ├── admin.html            → page organisateur (publier des annonces en direct)
    ├── styles.css
    └── app.js                → appelle l'API avec fetch(), gère la carte et le temps réel
```

## ✅ Étape 1 — Installer Node.js (si ce n'est pas déjà fait)

Va sur https://nodejs.org et installe la version **LTS** (18 ou plus récent).
Vérifie ensuite dans un terminal :

```bash
node -v
npm -v
```

Les deux commandes doivent afficher un numéro de version.

## ✅ Étape 2 — Installer les dépendances du projet

Ouvre un terminal, place-toi dans le dossier `festival-app`, puis :

```bash
cd festival-app
npm install
```

Cela télécharge Express (le seul package utilisé) dans un dossier
`node_modules`.

## ✅ Étape 3 — Lancer le serveur

```bash
npm start
```

Tu dois voir s'afficher :

```
✔ Festival Solstice — serveur lancé sur http://localhost:3000
```

## ✅ Étape 4 — Ouvrir le site

Ouvre ton navigateur à l'adresse :

```
http://localhost:3000
```

Le site est entièrement fonctionnel :
- **Programme** : filtre par jour/discipline, données chargées depuis l'API
- **Réserver** : décrémente réellement les places disponibles dans `data.json`
- **Avis** : les avis publiés sont sauvegardés et réapparaissent après un rafraîchissement de page
- **Galerie photo** : les likes sont persistés côté serveur

## 🔁 Pour redémarrer après une modification du code

Arrête le serveur avec `Ctrl + C` dans le terminal, puis relance `npm start`.

Si tu modifies souvent le code, utilise plutôt le mode développement
(redémarre automatiquement le serveur à chaque sauvegarde) :

```bash
npm run dev
```

## 📸 Où sont stockées les photos partagées par les utilisateurs ?

Quand quelqu'un clique sur "Ajoute ta photo" et choisit un fichier :

1. Le navigateur envoie le fichier réel au serveur (`POST /api/photos`, en `multipart/form-data`).
2. Le serveur (via `multer`, dans `server.js`) écrit ce fichier tel quel sur le disque,
   dans le dossier **`festival-app/uploads/`** (créé automatiquement au premier lancement).
   Chaque fichier reçoit un nom unique du type `1785226127638-710518025.png` pour éviter
   les collisions entre deux photos envoyées au même moment.
3. Seul le **chemin** de l'image (`/uploads/1785226127638-710518025.png`) est enregistré
   dans `data.json`, pas l'image elle-même — `data.json` reste un petit fichier texte.

**Pour retrouver les photos :**
- Directement sur ton disque, dans `festival-app/uploads/`.
- Depuis un navigateur, à l'adresse `http://localhost:3000/uploads/<nom-du-fichier>.png`
  (le nom exact est dans le champ `"image"` de chaque photo, visible via `GET /api/photos`).

**Limites actuelles** (à garder en tête, volontairement simple pour tourner en local) :
- Aucune miniature n'est générée : le fichier original est servi tel quel.
- Aucune limite de nombre de photos, seulement une limite de poids (8 Mo/photo, modifiable
  dans `server.js` via `limits: { fileSize }`).
- Le dossier `uploads/` grandit indéfiniment — pour un vrai déploiement public, il faudrait
  plutôt stocker les photos sur un service comme AWS S3 ou Cloudinary, et ajouter une
  modération avant publication.

## 🆕 Nouvelles fonctionnalités

### 🔔 Notifications en temps réel (WebSockets)
- Page organisateur : `http://localhost:3000/admin.html`
- Ce qui y est publié apparaît **instantanément** (sans recharger la page) chez tous les
  visiteurs qui ont le site ouvert, via WebSocket (Socket.io) — sous forme de toast qui
  apparaît en haut à droite, plus dans le panneau accessible via la cloche 🔔 en haut du site.
- Tout est aussi sauvegardé dans `data.json` → historique consultable via `GET /api/notifications`,
  donc un visiteur qui arrive après coup ne rate rien.

### 🗺️ Carte interactive + géolocalisation
- Basée sur **Leaflet.js** et les fonds de carte gratuits **OpenStreetMap** (aucune clé API,
  aucun compte à créer).
- Bouton "Me localiser" → utilise `navigator.geolocation` du navigateur (fonctionne
  réellement sur mobile ; sur un PC de bureau sans GPS, la précision dépend du wifi/réseau).
- Clique sur "Itinéraire" dans une bulle de lieu → trace une ligne entre ta position et ce lieu.
  C'est un tracé à vol d'oiseau (pas un vrai calcul de chemin piéton) — suffisant pour un plan
  de festival, mais dis-le-moi si tu veux un vrai calcul d'itinéraire (ça demande un service
  de routing, ex. OSRM).
- Les lieux (scènes, stands, toilettes, secours, sortie) viennent de `data.json` → `places`.

### 📅 Planning personnel synchronisé
- Chaque navigateur génère un identifiant anonyme (stocké dans le `localStorage` du
  navigateur, aucune inscription requise) et l'envoie au serveur.
- Le planning (bouton "+ Planning") est maintenant sauvegardé dans `data.json` → `plannings`,
  donc il **survit à un rechargement de page** — ce qui n'était pas le cas avant.

## 🧭 Nouvelles routes API

| Méthode | Route                          | Description                                    |
|---------|----------------------------------|------------------------------------------------|
| GET     | `/api/notifications`             | Historique des annonces publiées                |
| POST    | `/api/notifications`             | Publie une annonce (diffusée en direct)         |
| GET     | `/api/places`                    | Liste des lieux affichés sur la carte           |
| GET     | `/api/planning/:userId`          | Planning personnel d'un visiteur                |
| POST    | `/api/planning/:userId`          | Ajoute/retire un événement du planning          |

## 🌍 Mettre le site en ligne, gratuitement, sans perte de données

L'app fonctionne maintenant dans **deux modes**, choisis automatiquement selon ce qui est
configuré :

| | Mode local (par défaut) | Mode cloud (production) |
|---|---|---|
| Données (avis, réservations...) | `data.json` | MongoDB Atlas (gratuit) |
| Photos partagées | dossier `uploads/` | Cloudinary (gratuit) |
| Activé quand... | rien de spécial à faire | les variables d'environnement ci-dessous sont définies |
| Persistant après un redémarrage serveur ? | ❌ Non | ✅ Oui |

Tu n'as **rien à changer dans le code** : il suffit de renseigner des variables
d'environnement pour basculer d'un mode à l'autre.

### Étape A — Créer une base de données gratuite (MongoDB Atlas)

1. Va sur https://www.mongodb.com/cloud/atlas/register et crée un compte gratuit.
2. Crée un cluster **gratuit** (offre "M0", 512 Mo, bien assez pour ce projet).
3. Dans **Database Access**, crée un utilisateur de base de données (nom + mot de passe —
   note-les, tu en auras besoin).
4. Dans **Network Access**, ajoute l'adresse IP `0.0.0.0/0` ("autoriser depuis n'importe où")
   — plus simple pour un hébergeur comme Render qui change d'IP.
5. Clique sur **Connect** → **Drivers**, copie l'URI de connexion. Elle ressemble à :
   ```
   mongodb+srv://tonUtilisateur:tonMotDePasse@cluster0.xxxxx.mongodb.net/
   ```
   Remplace `tonUtilisateur` et `tonMotDePasse` par les tiens.

### Étape B — Créer un hébergement de photos gratuit (Cloudinary)

1. Va sur https://cloudinary.com/users/register/free et crée un compte gratuit.
2. Sur le tableau de bord (Dashboard), tu verras directement :
   - **Cloud name**
   - **API Key**
   - **API Secret** (clique sur l'œil 👁 pour l'afficher)

### Étape C — Tester le mode cloud en local (optionnel mais recommandé)

Copie `.env.example` en `.env` :

```bash
cp .env.example .env
```

Ouvre `.env` et remplis les valeurs récupérées aux étapes A et B :

```
MONGODB_URI=mongodb+srv://tonUtilisateur:tonMotDePasse@cluster0.xxxxx.mongodb.net/
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx
```

Relance `npm start`. Le terminal doit maintenant afficher :

```
↳ Données   : MongoDB Atlas
↳ Photos    : Cloudinary
```

Teste une réservation, un avis, un upload de photo — puis regarde dans Atlas (onglet
"Browse Collections") et Cloudinary (onglet "Media Library") : tes données doivent y
apparaître réellement.

### Étape D — Mettre le code sur GitHub

1. Crée un compte sur https://github.com si tu n'en as pas.
2. Crée un nouveau dépôt (bouton **New**), vide, sans README (on a déjà le nôtre).
3. Dans le dossier `festival-app` :
   ```bash
   git init
   git add .
   git commit -m "Premier envoi"
   git branch -M main
   git remote add origin https://github.com/TonPseudo/festival-app.git
   git push -u origin main
   ```
   (`.env` ne sera **pas** envoyé — il est dans `.gitignore`, c'est voulu : tes secrets ne
   doivent jamais être publiés sur GitHub.)

### Étape E — Déployer sur Render (gratuit)

1. Va sur https://render.com et crée un compte (tu peux te connecter directement avec GitHub).
2. Clique sur **New** → **Web Service**.
3. Sélectionne ton dépôt `festival-app`.
4. Configure :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free
5. Dans l'onglet **Environment**, ajoute tes variables (les mêmes que dans ton `.env`) :
   `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
6. Clique sur **Create Web Service**. Après quelques minutes, Render te donne une adresse
   publique du type `https://festival-app-xxxx.onrender.com` — **c'est ton site, en ligne,
   accessible par n'importe qui, gratuitement.**

### ⚠️ À savoir sur l'offre gratuite de Render

- Le serveur "s'endort" après 15 minutes sans visite, et met ~30 secondes à se réveiller au
  visiteur suivant (normal sur le tier gratuit). Grâce à MongoDB/Cloudinary, **aucune donnée
  n'est perdue** pendant ce sommeil — seul le temps de réveil est à prévoir.
- Pour un site qui ne s'endort jamais, il existe des offres payantes chez Render (à partir
  de quelques dollars/mois), ou d'autres hébergeurs gratuits avec d'autres compromis
  (Railway, Fly.io) — dis-moi si tu veux que je détaille une alternative.

## 🔌 Détail des routes API (utile si tu veux brancher autre chose dessus)

| Méthode | Route                              | Description                          |
|---------|-------------------------------------|--------------------------------------|
| GET     | `/api/events`                       | Liste tous les événements            |
| POST    | `/api/events/:id/reservations`      | Réserve N places (`{ "quantity": 2 }`) |
| GET     | `/api/reviews`                      | Liste tous les avis (récents d'abord) |
| POST    | `/api/reviews`                      | Ajoute un avis (`{ "name", "rating", "event", "text" }`) |
| GET     | `/api/photos`                       | Liste les photos de la galerie       |
| POST    | `/api/photos`                       | Envoie une vraie photo (`multipart/form-data` : champs `photo` (fichier) + `user`) |
| GET     | `/uploads/:nomDeFichier`            | Sert l'image telle qu'elle a été stockée sur le disque |
| POST    | `/api/photos/:id/like`              | Bascule le like sur une photo        |

## 🧯 Problèmes fréquents

- **"port 3000 already in use"** → un autre programme utilise déjà ce port.
  Lance le serveur sur un autre port : `PORT=3001 npm start`, puis ouvre
  `http://localhost:3001`.
- **"npm: command not found"** → Node.js n'est pas installé ou pas dans le
  PATH ; réinstalle-le depuis nodejs.org et redémarre le terminal.
- **Les données ne se sauvegardent pas** → vérifie que le fichier
  `data.json` n'est pas en lecture seule et que le serveur a le droit
  d'écrire dans le dossier du projet.

## 🚀 Pour aller plus loin

- Remplacer le stockage JSON par une vraie base de données (PostgreSQL avec
  Prisma, par exemple) pour supporter plusieurs utilisateurs en simultané.
- Ajouter une vraie authentification (comptes festivaliers).
- Ajouter un vrai upload d'image pour la galerie photo (actuellement, seul
  le pseudo est enregistré — les couleurs sont générées aléatoirement).
- Déployer le tout sur un hébergeur comme Render, Railway ou Fly.io.
