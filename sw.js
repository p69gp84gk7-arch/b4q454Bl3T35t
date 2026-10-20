/* Altitude Arcade : fonctionnement hors ligne.
   Changer VERSION à chaque mise à jour des fichiers pour forcer le rafraîchissement,
   ainsi que le numéro ?v= des scripts dans les pages (outils/version.sh fait les deux). */
const VERSION = 'desdes-v99';
const FONTS = 'desdes-fonts';
const SHELL = [
  './',
  'index.html',
  'jeux/10000.html',
  'jeux/yams.html',
  'jeux/plateau.js',
  'jeux/sauvegarde.js',
  'jeux/geo.html',
  'jeux/geo/monde.js',
  'jeux/geo/france.js',
  'jeux/geo/usa.js',
  'jeux/drawrace.html',
  'jeux/drawrace/circuits.js',
  'jeux/drawrace/piste.js',
  'jeux/fusee.html',
  'jeux/dameuse.html',
  'jeux/freeride.html',
  'jeux/tour.html',
  'jeux/panier.html',
  'jeux/nivoculteur/index.html',
  'jeux/nivoculteur/js/config.js',
  'jeux/nivoculteur/js/domaine.js',
  'jeux/nivoculteur/js/simulation.js',
  'jeux/nivoculteur/js/carte.js',
  'jeux/nivoculteur/js/jeu.js',
  'logo.svg',
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'icons/altitude-152.png',
  'icons/altitude-167.png',
  'icons/altitude-180.png',
  'icons/altitude-192.png',
  'icons/altitude-512.png',
  'icons/altitude-maskable-512.png'
];

// Drapeaux : la liste est lue dans les données de la carte (codes "c":"xx" des pays et des États)
async function drapeaux(c){
  const liste = [];
  for(const [donnees, dossier] of [['jeux/geo/monde.js', 'drapeaux'], ['jeux/geo/usa.js', 'drapeaux-us']]){
    const r = await c.match(donnees);
    if(!r) continue;
    const texte = await r.text();
    for(const m of texte.matchAll(/"c":"([a-z]{2})"/g)) liste.push(`jeux/geo/${dossier}/${m[1]}.svg`);
  }
  // Un drapeau manquant n'empêche pas l'installation
  await Promise.allSettled(liste.map(u => c.add(u)));
}

self.addEventListener('install', e => {
  // cache:'reload' : on prend les fichiers sur le serveur, pas dans le cache HTTP du navigateur
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache:'reload' }))).then(() => drapeaux(c))).then(() => self.skipWaiting()));
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
  // L'icône de l'écran d'accueil, les icônes et le manifeste : toujours demandés directement au site
  // (le téléphone les lit au moment d'« Ajouter à l'écran d'accueil »)
  if(/apple-touch-icon|\/icons\/|manifest\.webmanifest/.test(url.pathname)) return;

  // Images (drapeaux, icônes) : cache d'abord, elles ne changent pas
  if(/\.(svg|png|jpe?g|webp)$/i.test(url.pathname) && req.mode !== 'navigate'){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Pages et scripts : réseau d'abord, pour que la page et ses scripts soient toujours de la même version.
  // Hors ligne (ou réseau trop lent, plus de 4 s), on prend la copie gardée.
  e.respondWith(new Promise(resolve => {
    let fini = false;
    const secours = () => caches.match(req, { ignoreSearch:true })
      .then(r => r || (req.mode === 'navigate' ? caches.match('./') : null));
    const minuterie = setTimeout(() => secours().then(r => { if(r && !fini){ fini = true; resolve(r); } }), 4000);
    fetch(req.mode === 'navigate' ? req : new Request(req, { cache:'no-cache' })).then(res => {
      clearTimeout(minuterie);
      if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      if(!fini){ fini = true; resolve(res); }
    }).catch(() => {
      clearTimeout(minuterie);
      secours().then(r => { if(!fini){ fini = true; resolve(r || Response.error()); } });
    });
  }));
});
