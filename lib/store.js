// lib/store.js — point d'entrée unique utilisé par server.js.
// Choisit automatiquement le bon mode de stockage :
//  - MONGODB_URI défini dans l'environnement → MongoDB Atlas (persistant, pour la mise en ligne)
//  - sinon → fichier JSON local (pratique pour développer sans compte cloud)
// Aucune autre partie du code n'a besoin de savoir lequel des deux est actif.

const store = process.env.MONGODB_URI
  ? require('./mongoStore')
  : require('./localStore');

module.exports = store;
