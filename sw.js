/* =========================================================================== */
/* GMAO NEIGE — SERVICE WORKER                                                 */
/*                                                                             */
/* Objectif : que l'application s'ouvre et reste utilisable en haut des pistes,*/
/* sans réseau. Trois caches distincts, avec des durées de vie différentes :    */
/*                                                                             */
/*   • SHELL — index.html, manifeste, icônes. Versionné : chaque nouvelle       */
/*     version de l'app le remplace intégralement.                             */
/*   • LIBS  — Leaflet, Chart.js, JSZip, Font Awesome (CDN). Versionné aussi.   */
/*   • TILES — les tuiles de la carte. VOLONTAIREMENT NON VERSIONNÉ : le        */
/*     domaine skiable téléchargé au chalet représente des dizaines de Mo, il   */
/*     serait absurde de le jeter à chaque mise à jour du code.                 */
/*   • API   — dernière réponse météo, pour garder une prévision affichable.    */
/*                                                                             */
/* Les appels à script.google.com ne sont JAMAIS interceptés : la page gère     */
/* elle-même son hors-ligne (instantané IndexedDB + file d'attente), et un      */
/* cache intermédiaire ne ferait que masquer l'état réel de la synchro.         */
/* =========================================================================== */

const SW_VERSION = '5.9.0';
const SHELL = 'gmao-shell-' + SW_VERSION;
const LIBS  = 'gmao-libs-'  + SW_VERSION;
const TILES = 'gmao-tiles-v1';
const API   = 'gmao-api-v1';

const TILES_MAX = 9000;          // ~9000 tuiles × ~15 ko ≈ 130 Mo au pire
const KEEP = [SHELL, LIBS, TILES, API];

const SHELL_URLS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png',
    // Le plan de circulation fait partie de l'application : mis en cache dès l'installation, il est
    // disponible en montagne sans réseau. Absent de l'hébergement, la mise en cache échoue seule et
    // sans conséquence — chaque ressource est tentée séparément.
    './plan%20de%20circulation.kmz'
];

const LIB_URLS = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/hammerjs@2.0.8',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/togeojson/0.16.0/togeojson.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

const CDN_HOSTS  = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'];

// Reconnaissance par motif plutôt que par liste exacte : les fonds de carte utilisent des
// sous-domaines tournants (a./b./c./d.) que Leaflet tire au sort tuile par tuile.
const TILE_RE = /(^|\.)(arcgisonline\.com|tile\.openstreetmap\.org|basemaps\.cartocdn\.com|tiles\.stadiamaps\.com|data\.geopf\.fr|wxs\.ign\.fr|tile\.opentopomap\.org|maps\.eox\.at|sh\.dataspace\.copernicus\.eu|earthdata\.nasa\.gov)$/;
function isTileRequest(url) {
    if (TILE_RE.test(url.hostname)) return true;
    return /\/\d{1,2}\/\d{1,6}\/\d{1,6}(\.(png|jpe?g|webp))?$/.test(url.pathname);
}

/* --------------------------------------------------------------------------- */
/* Installation : on met en cache le strict nécessaire au démarrage. Chaque      */
/* ressource est tentée séparément — un CDN momentanément injoignable ne doit    */
/* pas faire échouer toute l'installation (addAll est tout-ou-rien).             */
/* --------------------------------------------------------------------------- */
self.addEventListener('install', function(event) {
    event.waitUntil((async function() {
        const shell = await caches.open(SHELL);
        await Promise.all(SHELL_URLS.map(function(u) {
            return shell.add(new Request(u, { cache: 'reload' })).catch(function() {});
        }));
        const libs = await caches.open(LIBS);
        await Promise.all(LIB_URLS.map(function(u) {
            return fetch(u, { mode: 'cors', cache: 'reload' })
                .then(function(r) { if (r && r.ok) return libs.put(u, r); })
                .catch(function() {});
        }));
        self.skipWaiting();
    })());
});

self.addEventListener('activate', function(event) {
    event.waitUntil((async function() {
        const names = await caches.keys();
        await Promise.all(names.map(function(n) {
            if (n.indexOf('gmao-') === 0 && KEEP.indexOf(n) === -1) return caches.delete(n);
        }));
        await self.clients.claim();
    })());
});

/* --------------------------------------------------------------------------- */
/* Aides de stratégie                                                            */
/* --------------------------------------------------------------------------- */
// Renvoie immédiatement la copie en cache et rafraîchit en arrière-plan : au premier
// démarrage on paie le réseau, ensuite l'app s'ouvre instantanément même en 3G faible.
async function staleWhileRevalidate(cacheName, url, request) {
    const cache = await caches.open(cacheName);
    const hit = await cache.match(url);
    const net = fetch(request).then(function(res) {
        if (res && res.ok) { cache.put(url, res.clone()).catch(function() {}); }
        return res;
    }).catch(function() { return null; });
    if (hit) { net.catch(function() {}); return hit; }
    const res = await net;
    if (res) return res;
    return new Response('', { status: 504, statusText: 'Hors réseau' });
}

// Volontairement SANS minuteur. Un délai maximal ici transformerait un réseau simplement lent — la
// 3G d'un télésiège — en panne franche : la requête aboutissait, mais la course était déjà perdue et
// la page recevait un faux « hors réseau ». Constaté en test : la toute première requête suivant le
// réveil du service worker dépassait parfois 8 s alors que le serveur répondait en 0,3 s.
// On ne se rabat sur le cache que si la requête ÉCHOUE réellement.
// Une reprise immédiate avant d'abandonner : la toute première requête suivant l'activation d'un
// service worker échoue parfois sans raison réseau (l'instance précédente est arrêtée en plein vol).
// Constaté en test, de façon reproductible, sur la première interrogation d'Open-Meteo.
async function networkFirst(cacheName, url, request) {
    const cache = await caches.open(cacheName);
    for (let essai = 0; essai < 2; essai++) {
        try {
            const res = await fetch(request);
            if (res && res.ok) { cache.put(url, res.clone()).catch(function() {}); }
            return res;
        } catch (e) {
            if (essai === 0) { await new Promise(function(r) { setTimeout(r, 400); }); continue; }
            const hit = await cache.match(url);
            if (hit) return hit;
            throw e;
        }
    }
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise(function(_, rej) { setTimeout(function() { rej(new Error('timeout')); }, ms); })
    ]);
}

// Les clés d'un Cache sont rendues dans leur ordre d'insertion : supprimer les
// premières revient à évincer les tuiles les plus anciennes.
let tilePutCount = 0;
async function trimTiles() {
    tilePutCount++;
    if (tilePutCount % 200 !== 0) return;
    const cache = await caches.open(TILES);
    const keys = await cache.keys();
    if (keys.length <= TILES_MAX) return;
    const excess = keys.length - TILES_MAX;
    for (let i = 0; i < excess; i++) { await cache.delete(keys[i]); }
}

/* --------------------------------------------------------------------------- */
/* Aiguillage des requêtes                                                       */
/* --------------------------------------------------------------------------- */
self.addEventListener('fetch', function(event) {
    const req = event.request;
    if (req.method !== 'GET') return;

    let url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // Google Apps Script : jamais intercepté (cf. en-tête de fichier).
    if (url.hostname.indexOf('script.google.com') !== -1 ||
        url.hostname.indexOf('googleusercontent.com') !== -1) return;

    // Navigation : on tente le réseau, et à défaut on sert l'app depuis le cache.
    if (req.mode === 'navigate') {
        event.respondWith((async function() {
            try {
                return await withTimeout(fetch(req), 4000);
            } catch (e) {
                const cache = await caches.open(SHELL);
                const hit = await cache.match('./index.html') || await cache.match(url.href);
                if (hit) return hit;
                return new Response('<h1>Hors réseau</h1><p>L\'application n\'a pas encore été mise en cache.</p>',
                    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
        })());
        return;
    }

    // Tuiles de carte : le cache d'abord, sans jamais retourner au réseau si on l'a.
    // Clé volontairement réduite à l'URL (chaîne) : Leaflet demande ses tuiles en
    // no-cors via <img>, le pré-chargement les récupère en cors — deux Request
    // différentes pour une même image, une seule et même clé.
    if (isTileRequest(url)) {
        event.respondWith((async function() {
            const cache = await caches.open(TILES);
            const hit = await cache.match(url.href);
            if (hit) return hit;
            try {
                const res = await fetch(req);
                if (res && (res.ok || res.type === 'opaque')) {
                    try { await cache.put(url.href, res.clone()); trimTiles(); } catch (e) {}
                }
                return res;
            } catch (e) {
                return new Response('', { status: 504, statusText: 'Tuile absente du cache' });
            }
        })());
        return;
    }

    // Bibliothèques CDN.
    if (CDN_HOSTS.indexOf(url.hostname) !== -1) {
        event.respondWith(staleWhileRevalidate(LIBS, url.href, req));
        return;
    }

    // Prévisions météo : la dernière reçue reste consultable hors réseau.
    if (url.hostname.indexOf('open-meteo.com') !== -1) {
        event.respondWith(networkFirst(API, url.href, req).catch(function() {
            return new Response(JSON.stringify({ error: true, reason: 'offline' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } });
        }));
        return;
    }

    // Fichiers de l'application (même origine).
    if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(SHELL, url.href, req));
        return;
    }
});

/* --------------------------------------------------------------------------- */
/* Messages venant de la page                                                    */
/* --------------------------------------------------------------------------- */
self.addEventListener('message', function(event) {
    const msg = event.data || {};
    const src = event.source;

    if (msg.type === 'SKIP_WAITING') { self.skipWaiting(); return; }

    if (msg.type === 'VERSION') {
        if (src) src.postMessage({ type: 'VERSION', version: SW_VERSION });
        return;
    }

    if (msg.type === 'TILES_INFO') {
        event.waitUntil((async function() {
            const cache = await caches.open(TILES);
            const keys = await cache.keys();
            let bytes = 0;
            if (navigator.storage && navigator.storage.estimate) {
                try { const est = await navigator.storage.estimate(); bytes = est.usage || 0; } catch (e) {}
            }
            if (src) src.postMessage({ type: 'TILES_INFO', count: keys.length, usage: bytes });
        })());
        return;
    }

    if (msg.type === 'CLEAR_TILES') {
        event.waitUntil((async function() {
            await caches.delete(TILES);
            if (src) src.postMessage({ type: 'TILES_CLEARED' });
        })());
        return;
    }

    // Pré-chargement du domaine skiable. On avance par vagues de 8 requêtes : plus
    // large, les serveurs de tuiles commencent à refuser ; plus étroit, le
    // téléchargement d'un domaine complet devient interminable.
    if (msg.type === 'PREFETCH_TILES' && Array.isArray(msg.urls)) {
        event.waitUntil((async function() {
            const cache = await caches.open(TILES);
            const urls = msg.urls;
            let done = 0, ok = 0, fail = 0, skipped = 0;
            const BATCH = 8;
            for (let i = 0; i < urls.length; i += BATCH) {
                if (self.__gmaoPrefetchCancel) break;
                const slice = urls.slice(i, i + BATCH);
                await Promise.all(slice.map(async function(u) {
                    try {
                        const already = await cache.match(u);
                        if (already) { skipped++; ok++; return; }
                        const res = await fetch(u, { mode: 'cors' });
                        if (res && res.ok) { await cache.put(u, res.clone()); ok++; }
                        else fail++;
                    } catch (e) { fail++; }
                    finally { done++; }
                }));
                if (src) src.postMessage({ type: 'PREFETCH_PROGRESS', done: done, total: urls.length, ok: ok, fail: fail });
            }
            self.__gmaoPrefetchCancel = false;
            if (src) src.postMessage({ type: 'PREFETCH_DONE', total: urls.length, ok: ok, fail: fail, skipped: skipped });
        })());
        return;
    }

    if (msg.type === 'PREFETCH_CANCEL') { self.__gmaoPrefetchCancel = true; return; }
});
