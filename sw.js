/* DesDés : fonctionnement hors ligne.
   Changer VERSION à chaque mise à jour des fichiers pour forcer le rafraîchissement. */
const VERSION = 'desdes-v27';
const FONTS = 'desdes-fonts';
const SHELL = [
  './',
  'index.html',
  'jeux/10000.html',
  'jeux/yams.html',
  'jeux/plateau.js',
  'jeux/geo.html',
  'jeux/geo/monde.js',
  'jeux/drawrace.html',
  'jeux/drawrace/circuits.js',
  'jeux/drawrace/piste.js',
  'jeux/nivoculteur/index.html',
  'jeux/nivoculteur/three.min.js',
  'jeux/nivoculteur/js/config.js',
  'jeux/nivoculteur/js/niveaux.js',
  'jeux/nivoculteur/js/simulation.js',
  'jeux/nivoculteur/js/modeles.js',
  'jeux/nivoculteur/js/effets.js',
  'jeux/nivoculteur/js/interface.js',
  'jeux/nivoculteur/js/jeu.js',
  'jeux/nivoculteur/js/vitrine.js',
  'jeux/nivoculteur/js/demarrage.js',
  'logo.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : cache d'abord, réseau ensuite
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if(hit) return hit;
      const res = await fetch(req);
      if(res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if(url.origin !== location.origin) return;

  // Pages : réseau d'abord (pour avoir la dernière version), cache si hors ligne
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch:true }).then(r => r || caches.match('./')))
    );
    return;
  }

  // Le reste : cache d'abord
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
