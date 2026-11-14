/* Arpenteur : le jeu. La carte (Leaflet + OpenStreetMap), la position GPS, les sorties (distance, durée, points),
   le ramassage des pièces et des objets, les lieux Wikipédia (fiches, visites, carnet), la vue AR (caméra + boussole),
   l'album, le journal des sorties, et le mode essai (on se déplace avec des flèches, rien n'est gardé).
   Les objets et les points sont dans arpenteur/objets.js. */
(() => {
'use strict';
const O = window.ARPENTEUR_OBJETS, QU = window.ARPENTEUR_QUETES, L = window.L;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const km = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits:m < 10000 ? 2 : 1 })} km`;
const duree = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), mn = Math.floor(s / 60) % 60; return h ? `${h} h ${String(mn).padStart(2, '0')}` : `${mn} min ${String(s % 60).padStart(2, '0')}`; };
const dateFr = t => new Date(t).toLocaleDateString('fr-FR', { day:'numeric', month:'short', year:'numeric' });

const RAYON = 25;                  // on ramasse à moins de 25 m (plus un peu de la précision du GPS)
const RAYON_VISITE = 80;           // on visite un lieu à moins de 80 m
const VITESSE_MAX = 8.5;           // au-delà (≈ 30 km/h), on pense que c'est une voiture : la distance ne compte pas
const ZONE = 600;                  // on sème les objets dans 600 m autour de soi
const DEPART_ESSAI = { lat:45.9237, lon:6.8694 };   // le mode essai commence à Chamonix (beaucoup de lieux Wikipédia)

/* ---------- La progression ---------- */
const nouvelle = () => ({ v:1, points:0, metres:0, reste:0, pieces:0, objets:{}, lieux:{}, sorties:[], ramasses:{ jour:'', ids:[] }, enCours:null, dernierePos:null, q:QU.nouvelle() });
let S = lire('arpenteur-partie', null) || nouvelle(), essai = false;
if(!S.q) S.q = QU.nouvelle();
let cases = new Set(S.q.cases);          // les cases de la carte déjà découvertes (voir « La carte à découvrir »)
function sauver(){
  if(essai) return;
  S.q.cases = [...cases];
  ecrire('arpenteur-partie', S);
  ecrire('arpenteur-records', { points:S.points, km:Math.round(S.metres / 100) / 10, niveau:O.niveauDe(S.points), objets:Object.keys(S.objets).length, lieux:Object.keys(S.lieux).length,
    sorties:S.sorties.length, pieces:S.pieces, quetes:S.q.faites, coffres:S.q.coffres, medailles:new Set(S.q.medailles.map(m => m.id)).size, cases:cases.size, meilleureSortie:S.sorties.reduce((m, s) => Math.max(m, s.metres), 0), dernier:Date.now() });
}
setInterval(() => { if(!essai && (sortie || pos)) sauver(); }, 15000);
addEventListener('visibilitychange', () => { if(document.hidden) sauver(); else if(sortie) garderEcran(); });
addEventListener('pagehide', sauver);
function jourCourant(){ const j = O.jourDe(); if(S.ramasses.jour !== j) S.ramasses = { jour:j, ids:[] }; return j; }
const estRamasse = id => S.ramasses.ids.includes(id);

/* ---------- La carte ---------- */
const depart = S.dernierePos || { lat:46.6, lon:2.4 };
/* La carte peut tourner avec le téléphone (ta direction vers le haut). Leaflet ne sait pas tourner : la carte est un carré
   aussi grand que la diagonale de l'écran, centré, qu'on fait tourner en CSS ; les icônes tournent dans l'autre sens pour
   rester droites, et les touchers sont « détournés » avant que Leaflet les lise. Pendant la rotation, la carte suit le joueur
   (on ne la fait pas glisser au doigt) et le zoom se fait autour du centre. */
let cote = 0, relevement = 0, orienter = !!lire('arpenteur-reglages', {}).orienter;
function tailleCarte(){
  cote = Math.ceil(Math.hypot(innerWidth, innerHeight)) + 4;
  const c = $('carte'); c.style.width = c.style.height = `${cote}px`; c.style.left = `${(innerWidth - cote) / 2}px`; c.style.top = `${(innerHeight - cote) / 2}px`;
}
tailleCarte();
L.Map.include({ mouseEventToContainerPoint(e){
  const r = this._container.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), a = relevement * Math.PI / 180;
  return L.point(cote / 2 + dx * Math.cos(a) - dy * Math.sin(a), cote / 2 + dx * Math.sin(a) + dy * Math.cos(a));
} });
const carte = L.map('carte', { zoomControl:false, attributionControl:false, zoomSnap:.5 }).setView([depart.lat, depart.lon], S.dernierePos ? 16 : 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(carte);
addEventListener('resize', () => { tailleCarte(); carte.invalidateSize(); });
// d'un point de la carte à un point de l'écran (la carte peut être tournée)
function versEcran(ll){
  const p = carte.latLngToContainerPoint(ll), dx = p.x - cote / 2, dy = p.y - cote / 2, a = -relevement * Math.PI / 180;
  return { x:innerWidth / 2 + dx * Math.cos(a) - dy * Math.sin(a), y:innerHeight / 2 + dx * Math.sin(a) + dy * Math.cos(a) };
}
let suivre = true;
carte.on('dragstart', () => { suivre = false; $('bCentre').classList.remove('actif'); });
$('bCentre').onclick = () => { suivre = true; $('bCentre').classList.add('actif'); if(pos) carte.setView([pos.lat, pos.lon], Math.max(carte.getZoom(), 16)); };
// le bouton boussole : carte orientée vers le nord, ou qui suit ta direction
function appliquerOrientation(){
  $('bOrient').classList.toggle('actif', orienter);
  carte.options.touchZoom = carte.options.scrollWheelZoom = orienter ? 'center' : true;
  if(orienter){ carte.dragging.disable(); suivre = true; $('bCentre').classList.add('actif'); if(pos) carte.setView([pos.lat, pos.lon], carte.getZoom(), { animate:false }); }
  else carte.dragging.enable();
}
$('bOrient').onclick = () => {
  orienter = !orienter; ecrire('arpenteur-reglages', { ...lire('arpenteur-reglages', {}), orienter });
  if(orienter){ ecouterBoussole(); toast(capActuel() == null ? '🧭 La carte tournera dans ton sens de marche (ou avec la boussole du téléphone).' : '🧭 La carte suit ta direction.', '', 3000); }
  else toast('🧭 Carte orientée vers le nord.', '', 2000);
  appliquerOrientation();
};
// la rotation suit le cap doucement (et revient vers le nord quand on la coupe)
function boucleOrientation(){
  requestAnimationFrame(boucleOrientation);
  const c = capActuel(), cible = orienter && c != null ? c : orienter ? relevement : 0;
  const d = ((cible - relevement + 540) % 360) - 180;
  if(Math.abs(d) < .05 && Math.abs(relevement - cible) < .05) return;
  relevement = (relevement + d * .12 + 360) % 360; if(Math.abs(d) < .3) relevement = cible;
  const el = $('carte'); el.style.transform = relevement ? `rotate(${-relevement}deg)` : ''; el.style.setProperty('--contre', `${relevement}deg`);
  $('nord').style.transform = `rotate(${-relevement}deg)`;
  majCap();
}
requestAnimationFrame(boucleOrientation);
$('bPlus').onclick = () => carte.zoomIn(); $('bMoins').onclick = () => carte.zoomOut();
const icone = (html, cls, taille) => L.divIcon({ className:'', html:`<div class="mk ${cls}">${html}</div>`, iconSize:[taille, taille], iconAnchor:[taille / 2, taille / 2] });
const moi = L.marker([depart.lat, depart.lon], { icon:L.divIcon({ className:'', html:'<div class="moi"><i id="moiCap"></i></div>', iconSize:[22, 22], iconAnchor:[11, 11] }), interactive:false, zIndexOffset:1000 });
const precision = L.circle([depart.lat, depart.lon], { radius:20, color:'#2F80C8', weight:1, fillOpacity:.08, interactive:false });
const trace = L.polyline([], { color:'#F28C28', weight:5, opacity:.85 });

/* ---------- La position (GPS, ou le mode essai) ---------- */
let dernierRoutes = null, dernierSens = null;
let pos = null, dernier = null, montre = null, capBoussole = null, capMarche = null, trop = false;
function demarrerGps(){
  if(!navigator.geolocation){ etatGps('📡 Pas de GPS sur cet appareil', 'mal'); return; }
  etatGps('📡 Recherche du GPS…');
  montre = navigator.geolocation.watchPosition(p => nouvellePosition(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp),
    e => { etatGps(e.code === 1 ? '📡 GPS refusé' : '📡 GPS introuvable', 'mal'); if(e.code === 1) toast('Autorise la localisation pour ce site dans les réglages du téléphone (ou essaie le mode essai).', 'mal', 6000); },
    { enableHighAccuracy:true, maximumAge:2000, timeout:25000 });
}
function etatGps(txt, cls = ''){ const e = $('sGps'); e.textContent = txt; e.className = 'gps ' + cls; }
function nouvellePosition(lat, lon, acc, t){
  const premier = !pos;
  pos = { lat, lon, acc, t }; S.dernierePos = { lat, lon };
  moi.setLatLng([lat, lon]); precision.setLatLng([lat, lon]).setRadius(acc);
  if(premier){ moi.addTo(carte); precision.addTo(carte); carte.setView([lat, lon], 17); }
  else if(suivre) carte.panTo([lat, lon], { animate:true, duration:.5 });
  // le sens de la marche (pour la flèche et la carte orientée, quand le téléphone n'a pas de boussole)
  if(acc <= 40){ if(!dernierSens) dernierSens = { lat, lon }; else if(O.distance(dernierSens.lat, dernierSens.lon, lat, lon) >= Math.max(6, acc * .5)){ capMarche = O.cap(dernierSens.lat, dernierSens.lon, lat, lon); dernierSens = { lat, lon }; } }
  // la distance : seulement pendant une sortie, avec un GPS assez précis, et pas en voiture
  trop = false;
  if(sortie && acc <= 40){
    if(!dernier) dernier = { lat, lon, t };
    else {
      const d = O.distance(dernier.lat, dernier.lon, lat, lon), dt = Math.max(.5, (t - dernier.t) / 1000);
      if(d >= Math.max(4, acc * .4)){
        if(d / dt <= VITESSE_MAX){
          sortie.metres += d; S.metres += d; S.reste += d; evt('metres', d);
          sortie.trace.push([+lat.toFixed(6), +lon.toFixed(6)]); trace.addLatLng([lat, lon]);
          const n = Math.floor(S.reste / 10); if(n > 0){ S.reste -= n * 10; gagner(n, null); }
        } else trop = true;
        dernier = { lat, lon, t };
      }
    }
  }
  etatGps(acc > 40 ? `📡 GPS imprécis (±${Math.round(acc)} m)` : trop ? '🚗 Trop rapide : ça ne compte pas' : `📡 GPS ±${Math.round(acc)} m`, acc > 40 || trop ? 'mal' : 'bon');
  majCap();
  if(!dernierRoutes || O.distance(dernierRoutes.lat, dernierRoutes.lon, lat, lon) > 400){ dernierRoutes = { lat, lon }; chargerRoutes(); }
  semer(); ramasserAutour(); chercherLieux();
  decouvrirAutour(); majTresor(); chargerCommune();
  majSortie();
}
// la direction du joueur : la boussole si on l'a, sinon le sens de la marche
const capActuel = () => capBoussole != null && performance.now() - dernierCapping < 3000 ? capBoussole : capMarche;
function majCap(){ const c = capActuel(), e = document.getElementById('moiCap'); if(e){ e.style.display = c == null ? 'none' : ''; if(c != null) e.style.transform = `rotate(${c}deg)`; } }   // la flèche est dans la carte, qui tourne déjà de −relèvement

// le mode essai : on marche (5 m/s) dans une direction, ou vers un point touché sur la carte
let essaiDir = null, essaiCible = null, essaiTimer = null;
function demarrerEssai(){
  const p = S.dernierePos || DEPART_ESSAI;
  essai = true; S = nouvelle(); S.dernierePos = p; cases = new Set(); derniereDecouverte = null; communeCourante = null;
  $('essai').hidden = false;
  nouvellePosition(p.lat, p.lon, 5, Date.now());
  essaiTimer = setInterval(() => {
    if(!pos) return;
    let c = essaiDir;
    if(essaiCible){ if(O.distance(pos.lat, pos.lon, essaiCible.lat, essaiCible.lon) < 3){ essaiCible = null; } else c = O.cap(pos.lat, pos.lon, essaiCible.lat, essaiCible.lon); }
    if(c == null) return;
    const step = essaiCible ? Math.min(2.5, O.distance(pos.lat, pos.lon, essaiCible.lat, essaiCible.lon)) : 2.5, q = O.deplacer(pos.lat, pos.lon, c, step);
    nouvellePosition(q.lat, q.lon, 5, Date.now());
  }, 500);
  $('essai').onclick = e => { const b = e.target.closest('button'); if(!b) return; essaiCible = null; essaiDir = b.dataset.dir === 'stop' ? null : +b.dataset.dir; };
  carte.on('click', e => { if(essai && !e.originalEvent.defaultPrevented){ essaiCible = { lat:e.latlng.lat, lon:e.latlng.lng }; essaiDir = null; } });
}

/* ---------- Les points ---------- */
function gagner(n, ou, txt){
  if(n <= 0) return;
  const niv0 = O.niveauDe(S.points);
  S.points += n; if(sortie) sortie.points += n;
  if(ou){ const p = versEcran(ou), e = document.createElement('div'); e.className = 'gain'; e.textContent = `+${n}${txt ? ' ' + txt : ''}`; e.style.left = `${p.x - 20}px`; e.style.top = `${p.y - 30}px`; document.body.append(e); setTimeout(() => e.remove(), 1200); }
  const niv1 = O.niveauDe(S.points);
  if(niv1 > niv0) toast(`⭐ Niveau ${niv1} : ${O.titre(niv1)} !`, 'or', 5000);
  majHud();
}
function majHud(){
  const n = O.niveauDe(S.points), a = O.seuilNiveau(n), b = O.seuilNiveau(n + 1);
  $('hTitre').textContent = `Niveau ${n} · ${O.titre(n)}${essai ? ' (essai)' : ''}`;
  $('hSous').textContent = `${Object.keys(S.objets).length}/${O.NB_OBJETS} objets · ${Object.keys(S.lieux).length} lieu${Object.keys(S.lieux).length > 1 ? 'x' : ''}`;
  $('hPts').textContent = fmt(S.points); $('hKm').textContent = `${km(S.metres)} au total`;
  $('xpBarre').style.width = `${clamp((S.points - a) / (b - a), 0, 1) * 100}%`;
}

/* ---------- Les routes et les chemins (OpenStreetMap, par l'API Overpass) : les objets y sont posés ---------- */
// Sans ça, une pièce pourrait tomber sur un toit ou dans un jardin privé. Les routes sont chargées par tuiles de 0,02°
// (environ 2 km) ; chaque objet glisse vers le chemin le plus proche (à 150 m au plus ; sinon, en pleine nature, il reste où il est).
// Les chemins pour piétons et vélos sont préférés aux petites rues ; les grandes routes, les autoroutes, les tunnels et
// les voies privées sont exclus.
const TUILE_R = .02, GR = .004, AIMANT_MAX = 150;
const PIETONS = ['footway', 'path', 'pedestrian', 'cycleway', 'track', 'steps', 'bridleway', 'living_street'];
const RUES = ['residential', 'service', 'unclassified', 'tertiary'];
const tuilesRoutes = new Map();      // clé → { etat:'charge'|'ok'|'erreur', t }
const segments = new Map();          // case de la grille (0,004°) → [[lat1, lon1, lat2, lon2, piéton ?]]
const cleTuile = (lat, lon) => `${Math.floor(lat / TUILE_R)}:${Math.floor(lon / TUILE_R)}`;
const etatRoutes = (lat, lon) => (tuilesRoutes.get(cleTuile(lat, lon)) || {}).etat;
function ajouterSegment(a, b, pieton){
  const s = [a.lat, a.lon, b.lat, b.lon, pieton];
  for(let gy = Math.floor(Math.min(a.lat, b.lat) / GR); gy <= Math.floor(Math.max(a.lat, b.lat) / GR); gy++)
    for(let gx = Math.floor(Math.min(a.lon, b.lon) / GR); gx <= Math.floor(Math.max(a.lon, b.lon) / GR); gx++){
      const k = gy + ':' + gx; if(!segments.has(k)) segments.set(k, []); segments.get(k).push(s);
    }
}
// une seule demande à la fois (le service Overpass limite le nombre de demandes simultanées), la plus proche d'abord
const fileRoutes = []; let routesEnCours = false;
async function suivanteTuile(){
  if(routesEnCours || !fileRoutes.length) return;
  if(pos) fileRoutes.sort((a, b) => Math.hypot(a[0] + .5 - pos.lat / TUILE_R, a[1] + .5 - pos.lon / TUILE_R) - Math.hypot(b[0] + .5 - pos.lat / TUILE_R, b[1] + .5 - pos.lon / TUILE_R));
  routesEnCours = true; const [ty, tx] = fileRoutes.shift();
  await chargerTuile(ty, tx);
  routesEnCours = false; suivanteTuile();
}
function demanderTuile(ty, tx){
  const cle = ty + ':' + tx, e = tuilesRoutes.get(cle);
  if(e && (e.etat !== 'erreur' || Date.now() - e.t < 60000)) return;
  if(fileRoutes.some(f => f[0] === ty && f[1] === tx)) return;
  if(!e) tuilesRoutes.set(cle, { etat:'charge', t:Date.now() });
  fileRoutes.push([ty, tx]); suivanteTuile();
}
async function chargerTuile(ty, tx){
  const cle = ty + ':' + tx;
  tuilesRoutes.set(cle, { etat:'charge', t:Date.now() });
  const s = ty * TUILE_R, w = tx * TUILE_R, n = s + TUILE_R, est = w + TUILE_R;
  const q = `[out:json][timeout:25];way["highway"~"^(${[...PIETONS, ...RUES].join('|')})$"]["access"!~"^(private|no)$"]["tunnel"!~"^(yes|building_passage)$"](${s},${w},${n},${est});out geom;`;
  try{
    const r = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q));
    if(!r.ok) throw new Error('overpass ' + r.status);
    const j = await r.json();
    for(const el of j.elements || []){
      if(!el.geometry) continue;
      const pieton = PIETONS.includes(el.tags && el.tags.highway);
      for(let i = 1; i < el.geometry.length; i++) ajouterSegment(el.geometry[i - 1], el.geometry[i], pieton);
    }
    tuilesRoutes.set(cle, { etat:'ok', t:Date.now() });
  }catch(err){ tuilesRoutes.set(cle, { etat:'erreur', t:Date.now() }); setTimeout(chargerRoutes, 65000); }
  semer(true);
}
// les tuiles autour du joueur (dans 1 km)
function chargerRoutes(){
  if(!pos) return;
  const d = .01, ty0 = Math.floor((pos.lat - d) / TUILE_R), ty1 = Math.floor((pos.lat + d) / TUILE_R), dl = d / Math.cos(pos.lat * Math.PI / 180), tx0 = Math.floor((pos.lon - dl) / TUILE_R), tx1 = Math.floor((pos.lon + dl) / TUILE_R);
  for(let ty = ty0; ty <= ty1; ty++) for(let tx = tx0; tx <= tx1; tx++) demanderTuile(ty, tx);
}
// le point le plus proche sur un chemin (les petites rues comptent 12 m de plus : on préfère les chemins)
function aimanter(lat, lon, graine){
  const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540, gy = Math.floor(lat / GR), gx = Math.floor(lon / GR), vus = new Set();
  let best = null, bd = Infinity;
  for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++) for(const s of segments.get((gy + dy) + ':' + (gx + dx)) || []){
    if(vus.has(s)) continue; vus.add(s);
    const ax = (s[1] - lon) * kx, ay = (s[0] - lat) * ky, bx = (s[3] - lon) * kx, by = (s[2] - lat) * ky, vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    const t = l2 ? clamp(-(ax * vx + ay * vy) / l2, 0, 1) : 0, px = ax + t * vx, py = ay + t * vy, d = Math.hypot(px, py) + (s[4] ? 0 : 12);
    if(d < bd){ bd = d; best = { s, t, l:Math.sqrt(l2) }; }
  }
  if(!best || bd > AIMANT_MAX + 12) return null;
  // un petit décalage le long du chemin (toujours le même pour un objet), pour que deux objets voisins ne se superposent pas
  const { s, l } = best, dec = l > 1 ? ((O.hache(graine) % 21) - 10) / l : 0, t = clamp(best.t + dec, 0, 1);
  return { lat:s[0] + (s[2] - s[0]) * t, lon:s[1] + (s[3] - s[1]) * t };
}
// poser un objet sur un chemin, si les routes de sa tuile sont chargées
function poser(it){
  if(it.pose) return false;
  if(etatRoutes(it.lat, it.lon) !== 'ok') return false;        // pas encore chargé (ou pas de réseau) : il reste où il est pour l'instant
  const q = aimanter(it.lat, it.lon, it.id); it.pose = q ? 'chemin' : 'libre';
  if(q){ it.lat = q.lat; it.lon = q.lon; }
  return !!q;
}

/* ---------- Les pièces et les objets autour de soi ---------- */
const marqueurs = new Map();    // id → { it, m }
let dernierSemis = null;
function itemsAutour(){
  const jour = jourCourant(), l = O.autour(pos.lat, pos.lon, ZONE, jour);
  for(const lieu of lieux) if(O.distance(pos.lat, pos.lon, lieu.lat, lieu.lon) < ZONE) l.push(O.tresorLieu(lieu, jour));
  return l.filter(it => !estRamasse(it.id));
}
function semer(force){
  if(!pos) return;
  // au début, on attend (6 s au plus) les chemins autour de soi, pour ne pas voir les objets sauter des toits vers les rues
  const e = etatRoutes(pos.lat, pos.lon), t = (tuilesRoutes.get(cleTuile(pos.lat, pos.lon)) || {}).t || 0;
  if((!e || e === 'charge') && Date.now() - t < 6000){ if(!e) chargerRoutes(); setTimeout(() => semer(true), 1500); return; }
  if(!force && dernierSemis && O.distance(dernierSemis.lat, dernierSemis.lon, pos.lat, pos.lon) < 60 && dernierSemis.jour === O.jourDe()) return;
  dernierSemis = { lat:pos.lat, lon:pos.lon, jour:O.jourDe() };
  const l = itemsAutour(), vus = new Set();
  for(const it of l){
    vus.add(it.id);
    const x = marqueurs.has(it.id) && marqueurs.get(it.id);
    if(x){ if(poser(x.it)) x.m.setLatLng([x.it.lat, x.it.lon]); continue; }
    poser(it);
    const o = it.objet && O.TOUS[it.objet];
    const m = L.marker([it.lat, it.lon], { icon:it.type === 'piece' ? icone('🪙', 'piece', 24) : L.divIcon({ className:'', html:`<div class="mk objet" style="--c:${O.RARETES[o.rar].coul}">${o.ico}</div>`, iconSize:[34, 34], iconAnchor:[17, 17] }), zIndexOffset:it.type === 'objet' ? 500 : 0 });
    m.on('click', ev => { L.DomEvent.preventDefault(ev.originalEvent); ramasser(it); });
    m.addTo(carte); marqueurs.set(it.id, { it, m });
  }
  for(const [id, x] of marqueurs) if(!vus.has(id)){ carte.removeLayer(x.m); marqueurs.delete(id); }
}
const portee = () => RAYON + Math.min(pos ? pos.acc : 0, 20);
// les pièces se ramassent toutes seules quand on passe à côté
function ramasserAutour(){ if(!pos) return; for(const [, x] of marqueurs) if(x.it.type === 'piece' && O.distance(pos.lat, pos.lon, x.it.lat, x.it.lon) <= portee()) ramasser(x.it, true); }
function ramasser(it, auto){
  if(!pos || estRamasse(it.id)) return false;
  const d = O.distance(pos.lat, pos.lon, it.lat, it.lon);
  if(d > portee()){
    if(!auto){ const o = it.objet && O.TOUS[it.objet]; toast(`${o ? `${o.ico} ${O.RARETES[o.rar].nom} à` : '🪙 Pièce à'} ${Math.round(d)} m : approche-toi encore de ${Math.round(d - portee() + 1)} m.`, '', 2600); }
    return false;
  }
  S.ramasses.ids.push(it.id);
  const x = marqueurs.get(it.id); if(x){ carte.removeLayer(x.m); marqueurs.delete(it.id); }
  if(it.type === 'piece'){ S.pieces++; if(sortie) sortie.pieces++; gagner(O.PTS.piece, [it.lat, it.lon]); evt('piece'); }
  else {
    const o = O.TOUS[it.objet], neuf = !S.objets[o.id], pts = O.RARETES[o.rar].pts + (neuf ? O.PTS.nouveau : 0);
    S.objets[o.id] = (S.objets[o.id] || 0) + 1; if(sortie) sortie.objets.push(o.id);
    gagner(pts, [it.lat, it.lon]); evt('objet', 1, { rar:o.rar, album:o.album });
    toast(`${o.ico} ${o.nom} (${O.RARETES[o.rar].nom.toLowerCase()})${neuf ? ' : nouveau dans ton album !' : ''} +${pts}`, o.rar === 'commun' ? 'or' : 'rare', 4000);
    ficheObjet(o.id, true);
  }
  majSortie(); sauver();
  return true;
}

/* ---------- Les lieux Wikipédia ---------- */
let lieux = [], centreLieux = null, chargeLieux = false;
const marqueursLieux = new Map();
async function chercherLieux(force){
  if(!pos || chargeLieux) return;
  if(!force && centreLieux && O.distance(centreLieux.lat, centreLieux.lon, pos.lat, pos.lon) < 2500) return;
  chargeLieux = true;
  try{
    const u = `https://fr.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${pos.lat.toFixed(5)}%7C${pos.lon.toFixed(5)}&gsradius=10000&gslimit=80&format=json&origin=*`;
    const j = await (await fetch(u)).json();
    centreLieux = { lat:pos.lat, lon:pos.lon };
    const neufs = (j.query && j.query.geosearch || []).map(g => ({ pageid:g.pageid, titre:g.title, lat:g.lat, lon:g.lon }));
    for(const l of neufs) if(!lieux.some(x => x.pageid === l.pageid)) lieux.push(l);
    for(const l of lieux){
      if(marqueursLieux.has(l.pageid)) continue;
      const vu = !!S.lieux[l.pageid], m = L.marker([l.lat, l.lon], { icon:L.divIcon({ className:'', html:`<div class="mk lieu${vu ? ' vu' : ''}"><span>${vu ? '✓' : '🏛️'}</span></div>`, iconSize:[30, 30], iconAnchor:[15, 15] }), zIndexOffset:300, title:l.titre });
      m.on('click', e => { L.DomEvent.preventDefault(e.originalEvent); ficheLieu(l); });
      m.addTo(carte); marqueursLieux.set(l.pageid, m);
    }
    semer(true);
  }catch(e){ centreLieux = null; toast('📶 Pas de réseau : les lieux Wikipédia ne sont pas chargés.', 'mal', 3500); setTimeout(() => chercherLieux(), 30000); }
  chargeLieux = false;
}
const resumes = new Map();
async function resume(titre){
  if(resumes.has(titre)) return resumes.get(titre);
  const r = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titre.replace(/ /g, '_'))}`);
  if(!r.ok) throw new Error('wiki');
  const j = await r.json(), res = { extrait:j.extract || '', image:j.thumbnail && j.thumbnail.source, lien:(j.content_urls && j.content_urls.mobile && j.content_urls.mobile.page) || `https://fr.wikipedia.org/wiki/${encodeURIComponent(titre)}`, desc:j.description || '' };
  resumes.set(titre, res); return res;
}
async function ficheLieu(l){
  const d = pos ? O.distance(pos.lat, pos.lon, l.lat, l.lon) : null, vu = S.lieux[l.pageid];
  ouvrirFiche(`🏛️ ${l.titre}`, `<div class="bloc wiki" id="wk"><p class="leg">Chargement de la fiche Wikipédia…</p></div><div class="bloc" id="wkVis"></div>`);
  const majVisite = () => {
    const e = $('wkVis'); if(!e) return;
    const d2 = pos ? O.distance(pos.lat, pos.lon, l.lat, l.lon) : null, v = S.lieux[l.pageid];
    e.innerHTML = v ? `<p class="leg">✅ Visité le ${dateFr(v.date)}. Sa carte postale est dans ton carnet (🏛️ Lieux).</p>`
      : `<p class="leg">${d2 == null ? 'Position inconnue.' : `📍 À ${km(d2)} de toi.`} Rends-toi sur place (à moins de ${RAYON_VISITE} m) pour le visiter : +${O.PTS.visite} points et une carte postale.</p><button class="btn prim" id="wkBtn" ${d2 == null || d2 > RAYON_VISITE + Math.min(pos.acc, 30) ? 'disabled' : ''}>📸 Visiter ce lieu</button>`;
    if($('wkBtn')) $('wkBtn').onclick = () => visiter(l);
  };
  majVisite(); ficheLieuOuverte = { l, majVisite };
  try{
    const r = await resume(l.titre), e = $('wk'); if(!e) return;
    e.innerHTML = `${r.image ? `<img src="${esc(r.image)}" alt="">` : ''}${r.desc ? `<p class="leg"><b>${esc(r.desc)}</b></p>` : ''}<p>${esc(r.extrait)}</p><p class="leg">Source : Wikipédia (texte sous licence CC BY-SA) · <a href="${esc(r.lien)}" target="_blank" rel="noopener">Lire la page entière ↗</a></p>`;
  }catch(err){ const e = $('wk'); if(e) e.innerHTML = '<p class="leg mal">Impossible de charger la fiche (pas de réseau ?).</p>'; }
}
let ficheLieuOuverte = null;
async function visiter(l){
  if(S.lieux[l.pageid] || !pos) return;
  const d = O.distance(pos.lat, pos.lon, l.lat, l.lon); if(d > RAYON_VISITE + Math.min(pos.acc, 30)) return;
  let r = null; try{ r = await resume(l.titre); }catch(e){}
  S.lieux[l.pageid] = { titre:l.titre, date:Date.now(), lat:l.lat, lon:l.lon, image:r && r.image || null, desc:r && r.desc || '' };
  if(sortie) sortie.lieux.push(l.titre);
  gagner(O.PTS.visite, [l.lat, l.lon]); evt('lieu');
  toast(`📸 ${l.titre} : visité ! Carte postale ajoutée à ton carnet. +${O.PTS.visite}`, 'or', 4500);
  const m = marqueursLieux.get(l.pageid); if(m) m.setIcon(L.divIcon({ className:'', html:'<div class="mk lieu vu"><span>✓</span></div>', iconSize:[30, 30], iconAnchor:[15, 15] }));
  if(ficheLieuOuverte && ficheLieuOuverte.l === l) ficheLieuOuverte.majVisite();
  sauver();
}

/* ---------- Les sorties ---------- */
let sortie = null, tSortie = null, verrou = null;
function lancerSortie(){
  sortie = { debut:Date.now(), metres:0, points:0, pieces:0, objets:[], lieux:[], trace:pos ? [[pos.lat, pos.lon]] : [] };
  S.enCours = sortie; dernier = pos ? { lat:pos.lat, lon:pos.lon, t:pos.t } : null;
  trace.setLatLngs(sortie.trace).addTo(carte);
  $('bSortie').className = 'stop'; $('bSortie').innerHTML = '⏹<small>Terminer</small>';
  toast('▶️ C\'est parti ! Chaque 10 m parcourus rapporte 1 point.', 'or');
  garderEcran(); majSortie(); sauver();
}
function finirSortie(){
  if(!sortie) return;
  const s = { ...sortie, fin:Date.now() }; delete s.trace;
  s.trace = simplifier(sortie.trace);
  if(s.metres > 20 || s.points > 0) S.sorties.unshift(s);
  S.sorties.length = Math.min(S.sorties.length, 100);
  sortie = null; S.enCours = null; dernier = null; trace.remove();
  $('bSortie').className = 'go'; $('bSortie').innerHTML = '▶️<small>Sortie</small>';
  if(verrou){ verrou.release().catch(() => {}); verrou = null; }
  if(s.metres >= 500) evt('sortie');
  majSortie(); sauver();
  ouvrirFiche('🏁 Sortie terminée', bilanSortie(s, true));
}
// garder au plus 300 points de la trace (pour le journal)
function simplifier(t){ if(t.length <= 300) return t; const k = t.length / 300, r = []; for(let i = 0; i < 300; i++) r.push(t[Math.floor(i * k)]); r.push(t[t.length - 1]); return r; }
async function garderEcran(){ try{ if('wakeLock' in navigator && sortie && !verrou){ verrou = await navigator.wakeLock.request('screen'); verrou.addEventListener('release', () => { verrou = null; }); } }catch(e){} }
function majSortie(){
  const on = !!sortie;
  for(const id of ['sTemps', 'sDist', 'sPieces']) $(id).hidden = !on;
  if(on){ $('sTemps').textContent = `⏱ ${duree(Date.now() - sortie.debut)}`; $('sDist').textContent = `📏 ${km(sortie.metres)}`; $('sPieces').textContent = `⭐ +${fmt(sortie.points)}`; }
}
setInterval(() => { if(sortie) majSortie(); }, 1000);
function bilanSortie(s, fin){
  const t = (s.fin || Date.now()) - s.debut, v = t > 0 ? s.metres / (t / 3600000) / 1000 : 0, objs = s.objets.map(id => O.TOUS[id]);
  return `<div class="bloc"><div class="stats"><div><b>${km(s.metres)}</b>parcourus</div><div><b>${duree(t)}</b>durée</div><div><b>${v.toLocaleString('fr-FR', { maximumFractionDigits:1 })}</b>km/h en moyenne</div>
    <div><b>+${fmt(s.points)}</b>points</div><div><b>${s.pieces}</b>pièces</div><div><b>${s.objets.length}</b>objets</div></div>
    ${objs.length ? `<p class="leg">Trouvailles : ${objs.map(o => `${o.ico} ${esc(o.nom)}`).join(', ')}.</p>` : ''}${s.lieux.length ? `<p class="leg">Lieux visités : ${s.lieux.map(esc).join(', ')}.</p>` : ''}
    ${fin ? `<p class="leg">${essai ? 'Mode essai : cette sortie n\'est pas gardée.' : 'La sortie est rangée dans ton journal (📒 Sorties).'}</p>` : ''}</div>`;
}
$('bSortie').onclick = () => { if(sortie){ if(confirm('Terminer la sortie ?')) finirSortie(); } else lancerSortie(); };

/* ---------- La fiche et les panneaux ---------- */
function ouvrirFiche(titre, html){ $('fTitre').textContent = titre; $('fCorps').innerHTML = html; $('fiche').hidden = false; $('fCorps').scrollTop = 0; }
function fermerFiche(){ $('fiche').hidden = true; ficheLieuOuverte = null; }
$('fFermer').onclick = fermerFiche;
function ficheObjet(id, trouve){
  const o = O.TOUS[id], R = O.RARETES[o.rar], n = S.objets[id] || 0;
  ouvrirFiche(trouve ? '✨ Trouvé !' : O.ALBUMS[o.album].nom, `<div class="bloc"><div class="grand" style="--c:${R.coul}"><span class="ico">${n ? o.ico : '❔'}</span><div><b>${n ? esc(o.nom) : 'Pas encore trouvé'}</b><span class="rar" style="--c:${R.coul}">${R.nom} · ${R.pts} points</span><br><small class="leg">${O.ALBUMS[o.album].ico} ${O.ALBUMS[o.album].nom}${n ? ` · trouvé ${n} fois` : ''}</small></div></div>
    ${n ? `<p>${esc(o.desc)}</p>` : `<p class="leg">Continue à explorer : cet objet ${R.nom.toLowerCase() === 'commun' ? 'se trouve souvent' : 'est ' + R.nom.toLowerCase()}${o.album === 'patrimoine' ? ', et les lieux Wikipédia cachent des trésors du patrimoine' : ''}.</p>`}</div>`);
}
let panneau = null, sousOnglet = { album:'nature', lieux:'autour', quetes:'jour' };
function ouvrirPanneau(p){ panneau = p; $('panneau').hidden = false; fermerFiche(); rafraichir(); }
function fermerPanneau(){ panneau = null; $('panneau').hidden = true; }
$('pFermer').onclick = fermerPanneau;
$('bAlbum').onclick = () => panneau === 'album' ? fermerPanneau() : ouvrirPanneau('album');
$('bLieux').onclick = () => panneau === 'lieux' ? fermerPanneau() : ouvrirPanneau('lieux');
$('bJournal').onclick = () => panneau === 'journal' ? fermerPanneau() : ouvrirPanneau('journal');
const onglets = (cle, l) => `<div class="sousOng">${l.map(([k, n]) => `<button data-so="${k}" class="${sousOnglet[cle] === k ? 'actif' : ''}">${n}</button>`).join('')}</div>`;
function rafraichir(){
  const box = $('pCorps');
  if(panneau === 'album'){
    $('pTitre').textContent = '📖 Album';
    const A = O.ALBUMS[sousOnglet.album], n = A.objets.filter(o => S.objets[o.id]).length;
    box.innerHTML = onglets('album', Object.entries(O.ALBUMS).map(([k, a]) => [k, `${a.ico} ${a.nom} (${a.objets.filter(o => S.objets[o.id]).length}/${a.objets.length})`]))
      + `<div class="bloc"><h3>${A.ico} ${A.nom} · ${n}/${A.objets.length}</h3><div class="album">${A.objets.map(o => { const c = S.objets[o.id] || 0; return `<button data-obj="${o.id}" class="${c ? '' : 'manque'}" style="--c:${O.RARETES[o.rar].coul}"><span>${o.ico}</span>${c ? esc(o.nom) : '???'}<i>${O.RARETES[o.rar].nom}${c > 1 ? ` · ×${c}` : ''}</i></button>`; }).join('')}</div>
      <p class="leg">${n === A.objets.length ? '🏆 Album complet, bravo !' : 'Touche un objet pour lire sa fiche. Les objets les plus rares (épiques et légendaires) sont aussi les plus précieux.'}</p></div>`;
    box.querySelectorAll('[data-obj]').forEach(b => b.onclick = () => ficheObjet(b.dataset.obj));
  } else if(panneau === 'lieux'){
    $('pTitre').textContent = '🏛️ Lieux';
    let h = onglets('lieux', [['autour', '📍 Autour de toi'], ['carnet', `📮 Mon carnet (${Object.keys(S.lieux).length})`]]);
    if(sousOnglet.lieux === 'autour'){
      const l = pos ? lieux.map(x => ({ ...x, d:O.distance(pos.lat, pos.lon, x.lat, x.lon) })).sort((a, b) => a.d - b.d).slice(0, 40) : [];
      h += `<div class="bloc"><h3>Les lieux Wikipédia les plus proches</h3>${l.length ? l.map(x => `<div class="item" data-lieu="${x.pageid}"><span class="ico">${S.lieux[x.pageid] ? '✅' : '🏛️'}</span><div><b>${esc(x.titre)}</b><small>à ${km(x.d)}</small></div></div>`).join('') : `<p class="leg">${pos ? 'Recherche des lieux autour de toi… (il faut du réseau)' : 'Il faut d\'abord ta position.'}</p>`}</div>`;
    } else {
      const v = Object.entries(S.lieux).sort((a, b) => b[1].date - a[1].date);
      h += `<div class="bloc"><h3>Mes cartes postales</h3>${v.length ? v.map(([id, x]) => `<div class="item" data-carnet="${id}"><span class="ico">${x.image ? `<img src="${esc(x.image)}" alt="">` : '📮'}</span><div><b>${esc(x.titre)}</b><small>${x.desc ? esc(x.desc) + ' · ' : ''}visité le ${dateFr(x.date)}</small></div></div>`).join('') : '<p class="leg">Aucun lieu visité pour l\'instant. Rends-toi près d\'une épingle bleue et appuie sur « Visiter ».</p>'}</div>`;
    }
    box.innerHTML = h;
    box.querySelectorAll('[data-lieu]').forEach(e => e.onclick = () => { const l = lieux.find(x => x.pageid === +e.dataset.lieu); fermerPanneau(); suivre = false; $('bCentre').classList.remove('actif'); carte.setView([l.lat, l.lon], 17); ficheLieu(l); });
    box.querySelectorAll('[data-carnet]').forEach(e => e.onclick = () => { const x = S.lieux[e.dataset.carnet]; ficheLieu({ pageid:+e.dataset.carnet, titre:x.titre, lat:x.lat, lon:x.lon }); });
  } else if(panneau === 'quetes'){
    panneauQuetes(box);
  } else if(panneau === 'journal'){
    $('pTitre').textContent = '📒 Mes sorties';
    const tot = S.sorties.reduce((a, s) => ({ m:a.m + s.metres, t:a.t + (s.fin - s.debut) }), { m:0, t:0 });
    box.innerHTML = `<div class="bloc"><div class="stats"><div><b>${fmt(S.points)}</b>points</div><div><b>${km(S.metres)}</b>au total</div><div><b>${S.sorties.length}</b>sorties</div><div><b>${fmt(S.pieces)}</b>pièces</div><div><b>${Object.keys(S.objets).length}/${O.NB_OBJETS}</b>objets</div><div><b>${Object.keys(S.lieux).length}</b>lieux visités</div></div>
      ${S.sorties.length ? `<p class="leg">Temps total en sortie : ${duree(tot.t)}. Plus longue sortie : ${km(Math.max(...S.sorties.map(s => s.metres)))}.</p>` : ''}</div>`
      + (sortie ? `<div class="bloc"><h3>Sortie en cours</h3>${bilanSortie(sortie, false)}</div>` : '')
      + `<div class="bloc"><h3>Les sorties</h3>${S.sorties.length ? S.sorties.map((s, i) => `<div class="item" data-sortie="${i}"><span class="ico">🥾</span><div><b>${km(s.metres)} · +${fmt(s.points)} points</b><small>${dateFr(s.debut)} · ${duree(s.fin - s.debut)} · ${s.pieces} pièces · ${s.objets.length} objets</small></div></div>`).join('') : '<p class="leg">Aucune sortie terminée. Appuie sur ▶️ pour en lancer une.</p>'}</div>`;
    box.querySelectorAll('[data-sortie]').forEach(e => e.onclick = () => { const s = S.sorties[+e.dataset.sortie]; montrerTrace(s); ouvrirFiche(`🥾 Sortie du ${dateFr(s.debut)}`, bilanSortie(s, false)); });
  }
  box.querySelectorAll('[data-so]').forEach(b => b.onclick = () => { sousOnglet[panneau] = b.dataset.so; rafraichir(); });
}
// montrer la trace d'une ancienne sortie sur la carte
let traceAncienne = null;
function montrerTrace(s){
  if(traceAncienne) traceAncienne.remove();
  if(!s.trace || s.trace.length < 2) return;
  fermerPanneau(); suivre = false; $('bCentre').classList.remove('actif');
  traceAncienne = L.polyline(s.trace, { color:'#8E4FD8', weight:4, opacity:.8, dashArray:'6 6' }).addTo(carte);
  carte.fitBounds(traceAncienne.getBounds(), { padding:[40, 40] });
}

/* ---------- Les quêtes, la chasse au trésor et la carte à découvrir ---------- */
// un fait du jeu (une pièce, un objet, des mètres…) : il fait avancer les missions et la quête de la semaine
function evt(type, n = 1, info = null){
  const fini = QU.evenement(S.q, type, n, info);
  for(const f of fini){ gagner(f.pts, null); toast(`${f.ico} ${f.titre} : +${f.pts} points !`, 'or', 5200); }
  if(fini.length) pastilleQ();
  if(fini.length && panneau === 'quetes') rafraichir();
}
function pastilleQ(){ const Q = QU.actualiser(S.q); $('pastQ').hidden = Q.vu === Q.jour; }
setInterval(() => { if(panneau === 'quetes' && sousOnglet.quetes !== 'carte') rafraichir(); }, 2500);

// --- la chasse au trésor : un coffre caché, la température et la distance
let dernierD = null, tendCourante = 0, dernierNiveauChaleur = 0;
function emplacementCoffre(n, graine){
  const c = QU.placerCoffre(pos.lat, pos.lon, n, graine), q = etatRoutes(c.lat, c.lon) === 'ok' ? aimanter(c.lat, c.lon, 'coffre' + graine + n) : null;
  return q || c;
}
function lancerChasse(n = 0, graine = String(Date.now())){
  if(!pos) return toast('Il faut d\'abord ta position GPS.', 'mal');
  const c = emplacementCoffre(n, graine);
  S.q.tresor = { lat:c.lat, lon:c.lon, n, graine }; dernierD = null; tendCourante = 0; dernierNiveauChaleur = 0;
  sauver(); majTresor(); if(panneau === 'quetes') rafraichir();
}
function majTresor(){
  const t = S.q.tresor, chip = $('chipTresor');
  if(!t || !pos){ chip.hidden = true; return; }
  const d = O.distance(pos.lat, pos.lon, t.lat, t.lon);
  if(d <= portee()) return ouvrirCoffre();
  if(dernierD == null) dernierD = d; else if(Math.abs(d - dernierD) >= 4){ tendCourante = QU.tendance(dernierD, d); dernierD = d; }
  const ch = QU.chaleur(d);
  chip.hidden = false; chip.textContent = `${ch.ico} ${ch.nom} · ${km(d)}${tendCourante > 0 ? ' ▲' : tendCourante < 0 ? ' ▼' : ''}`;
  if(ch.n === 5 && dernierNiveauChaleur < 5 && navigator.vibrate) try{ navigator.vibrate(120); }catch(e){}
  dernierNiveauChaleur = ch.n;
  if(panneau === 'quetes' && sousOnglet.quetes === 'tresor') rafraichir();
}
function ouvrirCoffre(){
  const t = S.q.tresor; if(!t) return;
  const b = QU.butin(t.n, t.graine), o = O.TOUS[b.objet], neuf = !S.objets[o.id], ptsO = O.RARETES[o.rar].pts + (neuf ? O.PTS.nouveau : 0), R = O.RARETES[o.rar];
  S.q.tresor = null; S.q.coffres++;
  S.pieces += b.pieces; if(sortie) sortie.pieces += b.pieces;
  S.objets[o.id] = (S.objets[o.id] || 0) + 1; if(sortie) sortie.objets.push(o.id);
  const total = b.pts + ptsO + b.pieces * O.PTS.piece;
  gagner(total, [t.lat, t.lon]);
  evt('tresor'); evt('objet', 1, { rar:o.rar, album:o.album });
  ouvrirFiche('🧰 Coffre trouvé !', `<div class="bloc"><div class="grand" style="--c:${R.coul}"><span class="ico">${o.ico}</span><div><b>${esc(o.nom)}</b><span class="rar" style="--c:${R.coul}">${R.nom}</span></div></div>
    <p>${neuf ? '✨ Nouveau dans ton album ! ' : ''}Le coffre contenait aussi <b>${b.pieces} pièces</b> et un trésor : <b>+${fmt(total)} points</b> en tout.</p>
    <p class="leg">Coffre n° ${t.n + 1} de cette chasse. Un autre coffre vient d'être caché, un peu plus loin : la boussole chaud / froid est dans 🎯 Quêtes › Trésor (et la pastille en bas à gauche).</p></div>`);
  lancerChasse(t.n + 1, t.graine);
  sauver();
}

// --- la carte à découvrir : le brouillard et la commune
let brouillardActif = lire('arpenteur-reglages', {}).brouillard !== false, derniereDecouverte = null, communeCourante = null, chargeCommune = false, dernierAppelCommune = 0;
const calqueB = document.createElement('canvas'); calqueB.className = 'canvas-brouillard';
carte.createPane('brouillard'); { const p = carte.getPane('brouillard'); p.style.zIndex = 350; p.style.pointerEvents = 'none'; p.appendChild(calqueB); }
let prB = false;
function redessinerBrouillard(){ if(prB) return; prB = true; requestAnimationFrame(() => { prB = false; dessinerBrouillard(); }); }
function dessinerBrouillard(){
  const z = carte.getZoom();
  if(!brouillardActif || z < 13){ calqueB.style.display = 'none'; return; }
  const t = carte.getSize(), W = Math.ceil(t.x * 1.6), H = Math.ceil(t.y * 1.6), ox = (W - t.x) / 2, oy = (H - t.y) / 2;
  if(calqueB.width !== W || calqueB.height !== H){ calqueB.width = W; calqueB.height = H; }
  calqueB.style.display = ''; calqueB.style.opacity = 1;
  L.DomUtil.setPosition(calqueB, carte.containerPointToLayerPoint([-ox, -oy]));
  const g = calqueB.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(22,40,32,.62)'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  const nw = carte.containerPointToLatLng([-ox, -oy]), se = carte.containerPointToLatLng([t.x + ox, t.y + oy]);
  const gy0 = Math.floor(se.lat / QU.PAS_Y) - 1, gy1 = Math.floor(nw.lat / QU.PAS_Y) + 1, gx0 = Math.floor(nw.lng / QU.PAS_X) - 1, gx1 = Math.floor(se.lng / QU.PAS_X) + 1;
  for(const k of cases){
    const { gy, gx } = QU.deCle(k); if(gy < gy0 || gy > gy1 || gx < gx0 || gx > gx1) continue;
    const a = carte.latLngToContainerPoint([(gy + 1) * QU.PAS_Y, gx * QU.PAS_X]), b = carte.latLngToContainerPoint([gy * QU.PAS_Y, (gx + 1) * QU.PAS_X]), x = a.x + ox, y = a.y + oy, w = b.x - a.x, h = b.y - a.y;
    g.globalAlpha = .3; g.fillRect(x - 6, y - 6, w + 12, h + 12); g.globalAlpha = 1; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  }
}
carte.on('zoomstart', () => { calqueB.style.opacity = 0; });
carte.on('moveend zoomend resize', redessinerBrouillard);
$('bBrouillard').classList.toggle('actif', brouillardActif);
$('bBrouillard').onclick = () => {
  brouillardActif = !brouillardActif; $('bBrouillard').classList.toggle('actif', brouillardActif);
  const r = lire('arpenteur-reglages', {}); r.brouillard = brouillardActif; ecrire('arpenteur-reglages', r);
  dessinerBrouillard(); toast(brouillardActif ? '🌫️ Brouillard affiché' : '🌫️ Brouillard caché');
};
function decouvrirAutour(){
  if(!pos || pos.acc > 40) return;
  const neuves = QU.decouvrir(cases, pos.lat, pos.lon, derniereDecouverte); derniereDecouverte = { lat:pos.lat, lon:pos.lon };
  if(!neuves.length) return;
  neuves.forEach(k => QU.ajouterCase(S.q.communes, k));
  gagner(neuves.length * QU.PTS_CASE, null);
  evt('case', neuves.length); redessinerBrouillard();
  if(panneau === 'quetes' && sousOnglet.quetes === 'carte') rafraichir();
}
// le contour de la commune où l'on est (Nominatim, d'après OpenStreetMap), pour le pourcentage découvert
async function chargerCommune(){
  if(!pos || chargeCommune) return;
  if(communeCourante && QU.dansBbox(pos.lat, pos.lon, communeCourante.bbox) && QU.dedans(pos.lat, pos.lon, communeCourante.anneaux)) return;
  const connue = Object.values(S.q.communes).find(c => QU.dansBbox(pos.lat, pos.lon, c.bbox) && QU.dedans(pos.lat, pos.lon, c.anneaux));
  if(connue){ communeCourante = connue; return; }
  if(Date.now() - dernierAppelCommune < 30000) return;
  chargeCommune = true; dernierAppelCommune = Date.now();
  try{
    const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.lat.toFixed(5)}&lon=${pos.lon.toFixed(5)}&zoom=10&polygon_geojson=1&polygon_threshold=0.0005&accept-language=fr`)).json();
    const g = j.geojson; if(!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) throw new Error('pas de contour');
    const nom = j.name || (j.address && (j.address.village || j.address.town || j.address.city)) || 'Commune', c = QU.compter(QU.communeDe(nom, g), cases);
    S.q.communes[nom] = c; communeCourante = c;
    const noms = Object.keys(S.q.communes); if(noms.length > 12){ const sortir = noms.filter(x => x !== nom).sort((a, b) => S.q.communes[a].vues - S.q.communes[b].vues)[0]; delete S.q.communes[sortir]; }
    sauver(); if(panneau === 'quetes' && sousOnglet.quetes === 'carte') rafraichir();
  }catch(e){ setTimeout(chargerCommune, 60000); }
  chargeCommune = false;
}

// --- la fiche « Quêtes »
const quantite = (ev, n) => ev === 'metres' ? km(n) : String(Math.floor(n));
const barreQ = (prog, cible) => `<div class="barreQ"><i style="width:${Math.round(100 * Math.min(1, prog / cible))}%"></i></div>`;
function panneauQuetes(box){
  $('pTitre').textContent = '🎯 Quêtes';
  const Q = QU.actualiser(S.q); Q.vu = Q.jour; pastilleQ();
  let h = onglets('quetes', [['jour', '📅 Jour'], ['semaine', '🏆 Semaine'], ['tresor', '🧭 Trésor'], ['carte', '🌫️ Carte']]);
  const so = sousOnglet.quetes;
  if(so === 'jour'){
    const faites = Q.missions.filter(m => m.fait).length, serie = QU.serieActuelle(Q);
    h += `<div class="bloc"><h3>Missions du jour · ${faites}/${Q.missions.length}</h3>` + Q.missions.map((m, i) => { const d = QU.PAR_ID[m.id];
      return `<div class="mission ${m.fait ? 'fait' : ''}"><span class="ico">${m.fait ? '✅' : d.ico}</span><div><b>${esc(d.txt(m.cible))}</b>${barreQ(m.prog, m.cible)}<small>${m.fait ? 'Réussie !' : `${quantite(d.ev, m.prog)} / ${quantite(d.ev, m.cible)}`}</small>${!m.fait && !Q.remplace ? ` <button class="btn" style="padding:2px 8px;font-size:.72rem" data-remp="${i}">↻ Changer</button>` : ''}</div><span class="pts">+${m.pts}</span></div>`; }).join('')
      + `<p class="leg">${faites === Q.missions.length ? '🌟 Les 3 missions sont réussies, bravo ! Reviens demain pour de nouvelles missions.' : `Réussis les trois : <b>+${QU.BONUS_JOUR} points</b> de bonus. ${Q.remplace ? 'Tu as déjà changé une mission aujourd\'hui.' : 'Une mission impossible aujourd\'hui ? Tu peux en changer une (une seule fois par jour).'}`}</p>
      <p class="leg">🔥 Série : <b>${serie}</b> jour${serie > 1 ? 's' : ''} de suite${serie ? ' (+20 points de bonus par jour de série, jusqu\'à +100)' : ' : réussis les 3 missions aujourd\'hui pour la lancer'}.</p></div>`;
  } else if(so === 'semaine'){
    const H2 = Q.hebdo, d = QU.HEBDO_PAR_ID[H2.id];
    h += `<div class="bloc"><h3>La grande quête de la semaine</h3><div class="mission ${H2.fait ? 'fait' : ''}"><span class="ico">${H2.fait ? '🏅' : d.ico}</span><div><b>${esc(d.nom)}</b><small>${esc(d.txt)}</small></div><span class="pts">+${d.pts}</span></div>`
      + H2.buts.map((b, i) => `<div class="mission ${b.prog >= b.cible ? 'fait' : ''}" style="padding:4px 2px"><div><b style="font-weight:700">${b.prog >= b.cible ? '✅ ' : ''}${esc(d.buts[i][2])}</b>${barreQ(b.prog, b.cible)}<small>${quantite(b.ev, b.prog)} / ${quantite(b.ev, b.cible)}</small></div></div>`).join('')
      + `<p class="leg">${H2.fait ? '🏅 Réussie ! La médaille « ' + esc(d.medaille) + ' » est dans ta collection. Une nouvelle quête arrive lundi.' : 'Les deux buts se font au fil de la semaine, quand tu veux. À la clé : des points et la médaille « ' + esc(d.medaille) + ' ». Une nouvelle quête arrive lundi.'}</p></div>`
      + `<div class="bloc"><h3>Ma collection de médailles · ${new Set(Q.medailles.map(m => m.id)).size}/${QU.HEBDOS.length}</h3><div class="medailles">${QU.HEBDOS.map(x => { const n = Q.medailles.filter(m => m.id === x.id).length; return `<div class="${n ? 'gagnee' : ''}"><b>${x.ico}</b>${esc(x.medaille)}${n > 1 ? ' ×' + n : ''}</div>`; }).join('')}</div></div>`;
  } else if(so === 'tresor'){
    const t = Q.tresor;
    if(!t) h += `<div class="bloc"><h3>Chasse au trésor</h3><p>Un <b>coffre est caché</b> près de toi (à 200–300 m), <b>sans point sur la carte</b>. Marche et fie-toi à la boussole <b>chaud / froid</b> : l'indicateur te dit si tu t'approches, et la distance qui reste. À moins de ${QU.PORTEE_COFFRE} m, il s'ouvre : des points, des pièces et un objet au moins rare. Ensuite, un autre coffre se cache un peu plus loin.</p><button class="btn prim" id="bChasse">🧭 Lancer la chasse</button><p class="leg">${Q.coffres} coffre${Q.coffres > 1 ? 's' : ''} trouvé${Q.coffres > 1 ? 's' : ''} en tout.</p></div>`;
    else {
      const d = pos ? O.distance(pos.lat, pos.lon, t.lat, t.lon) : null, ch = d == null ? null : QU.chaleur(d);
      h += `<div class="bloc therm"><h3>Chasse au trésor · coffre n° ${t.n + 1}</h3>${ch ? `<span class="emo">${ch.ico}</span><span class="nom">${ch.nom}</span><span class="dist">à ${km(d)}</span><div class="thermo" role="img" aria-label="${ch.nom}"><i style="left:${Math.round(ch.pc * 100)}%"></i></div>
        <p class="leg">${tendCourante > 0 ? '▲ Tu te rapproches, continue !' : tendCourante < 0 ? '▼ Tu t\'éloignes… essaie une autre direction.' : 'Avance un peu : je te dirai si tu te rapproches ou si tu t\'éloignes.'}</p>` : '<p class="leg">En attente de ta position GPS…</p>'}
        <p class="leg">Le coffre n'est pas sur la carte : c'est toi qui le cherches. Pas de flèche non plus : un seul indice, la température.</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center"><button class="btn" id="bChange">↻ Changer de coffre</button><button class="btn" id="bAbandon">✕ Arrêter la chasse</button></div></div>`;
    }
  } else {
    const c = communeCourante, nb = cases.size, ha = QU.hectares(cases), pc = c ? QU.pourcent(c) : 0, R = 48, C = 2 * Math.PI * R;
    h += `<div class="bloc"><h3>Carte découverte</h3>${c ? `<svg class="anneau" width="130" height="130" viewBox="0 0 130 130" role="img" aria-label="${pc.toFixed(1)} % de ${esc(c.nom)}"><circle class="fond" cx="65" cy="65" r="${R}"/><circle class="val" cx="65" cy="65" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, pc / 100))}" transform="rotate(-90 65 65)"/><text x="65" y="74" text-anchor="middle">${pc < 10 ? pc.toLocaleString('fr-FR', { maximumFractionDigits:1, minimumFractionDigits:1 }) : Math.round(pc)} %</text></svg>
      <p style="text-align:center;margin:0"><b>${esc(c.nom)}</b> : ${fmt(c.vues)} cases sur ${fmt(c.total)} découvertes</p>` : `<p class="leg">${pos ? '📡 Le contour de ta commune n\'est pas encore chargé (il faut du réseau).' : 'En attente de ta position GPS…'}</p>`}
      <div class="stats"><div><b>${fmt(nb)}</b>cases levées</div><div><b>${fmt(ha)}</b>hectares</div><div><b>${Object.keys(S.q.communes).length}</b>commune${Object.keys(S.q.communes).length > 1 ? 's' : ''}</div></div>
      <p class="leg">Le brouillard se lève là où tu passes (une case = environ 100 m sur 100 m, +1 point la première fois). Le bouton 🌫️ sur la carte le cache ou le montre.</p></div>`;
    const autres = Object.values(S.q.communes).filter(x => x !== c).sort((a, b) => QU.pourcent(b) - QU.pourcent(a));
    if(autres.length) h += `<div class="bloc"><h3>Mes autres communes</h3>${autres.map(x => `<div class="item"><span class="ico">🗺️</span><div><b>${esc(x.nom)}</b><small>${QU.pourcent(x).toLocaleString('fr-FR', { maximumFractionDigits:1 })} % · ${fmt(x.vues)} cases</small></div></div>`).join('')}</div>`;
  }
  box.innerHTML = h;
  box.querySelectorAll('[data-remp]').forEach(b => b.onclick = () => { if(QU.remplacer(S.q, +b.dataset.remp)){ sauver(); rafraichir(); } });
  if($('bChasse')) $('bChasse').onclick = () => lancerChasse();
  if($('bChange')) $('bChange').onclick = () => { if(confirm('Cacher le coffre ailleurs ?')) lancerChasse(S.q.tresor.n, String(Date.now())); };
  if($('bAbandon')) $('bAbandon').onclick = () => { if(confirm('Arrêter la chasse ? Le coffre disparaît.')){ S.q.tresor = null; sauver(); majTresor(); rafraichir(); } };
}
$('bQuetes').onclick = () => panneau === 'quetes' ? fermerPanneau() : ouvrirPanneau('quetes');
$('chipTresor').onclick = () => { sousOnglet.quetes = 'tresor'; ouvrirPanneau('quetes'); };

/* ---------- Les messages ---------- */
function toast(txt, type = '', ms = 3200){
  const box = $('toasts'), d = document.createElement('div'); d.className = 'toast ' + type; d.textContent = txt; box.prepend(d);
  setTimeout(() => d.remove(), ms); while(box.children.length > 3) box.lastChild.remove();
}

/* ---------- La vue AR : la caméra, la boussole, les objets dans leur direction ---------- */
let arOuverte = false, flux = null, inclinaison = 90, capManuel = 0, dernierCapping = 0;
const elemsAr = new Map();
function surOrientation(e){
  let c = null;
  if(typeof e.webkitCompassHeading === 'number') c = e.webkitCompassHeading;
  else if(e.absolute && e.alpha != null) c = 360 - e.alpha;
  if(c != null){
    c = (c + (screen.orientation ? screen.orientation.angle : (window.orientation || 0)) + 360) % 360;
    // lisser la boussole (en faisant attention au passage par le nord)
    if(capBoussole == null) capBoussole = c; else { let d = ((c - capBoussole + 540) % 360) - 180; capBoussole = (capBoussole + d * .2 + 360) % 360; }
    dernierCapping = performance.now();
  }
  if(e.beta != null) inclinaison = e.beta;
  if(!arOuverte) majCap();
}
let ecoute = false;
async function ecouterBoussole(){
  if(ecoute) return; ecoute = true;
  try{ if(typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) await DeviceOrientationEvent.requestPermission(); }catch(e){}
  if('ondeviceorientationabsolute' in window) addEventListener('deviceorientationabsolute', surOrientation);
  else addEventListener('deviceorientation', surOrientation);
}
async function ouvrirAr(){
  const perm = ecouterBoussole();                     // à demander tout de suite (iPhone : dans le geste de l'utilisateur)
  arOuverte = true; $('ar').hidden = false; fermerPanneau(); document.body.classList.add('enAr');
  await perm;
  try{
    flux = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    $('arVideo').srcObject = flux; $('arVideo').play().catch(() => {});
  }catch(e){ $('arAide').textContent = 'Caméra indisponible : les objets s\'affichent sur un fond de paysage. Tourne-toi (ou glisse le doigt) pour les trouver.'; }
  requestAnimationFrame(boucleAr);
}
function fermerAr(){
  arOuverte = false; $('ar').hidden = true; document.body.classList.remove('enAr');
  if(flux){ flux.getTracks().forEach(t => t.stop()); flux = null; }
  for(const [, e] of elemsAr) e.remove(); elemsAr.clear();
  majCap();
}
$('bAr').onclick = () => { if(!pos) return toast('Il faut d\'abord ta position GPS.', 'mal'); ouvrirAr(); };
$('arFermer').onclick = fermerAr;
// sans boussole (ordinateur), on tourne en glissant le doigt
{ let x0 = null; const c = $('arCalque');
  c.addEventListener('pointerdown', e => { x0 = e.clientX; });
  c.addEventListener('pointermove', e => { if(x0 == null || performance.now() - dernierCapping < 2000) return; capManuel = (capManuel - (e.clientX - x0) * .25 + 360) % 360; x0 = e.clientX; });
  addEventListener('pointerup', () => { x0 = null; }); }
const POINTS_CARDINAUX = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
function boucleAr(){
  if(!arOuverte) return;
  requestAnimationFrame(boucleAr);
  const W = innerWidth, H = innerHeight, aBoussole = performance.now() - dernierCapping < 2000;
  const cap = aBoussole ? capBoussole : capManuel, hfov = W < H ? 52 : 72, vfov = hfov * H / W;
  const horizon = H * .5 + clamp((inclinaison - 90) * H / vfov, -H * .6, H * .6) * (aBoussole ? 1 : 0);
  $('arCap').textContent = `${POINTS_CARDINAUX[Math.round(cap / 45) % 8]} · ${Math.round(cap)}°${aBoussole ? '' : ' (glisse pour tourner)'}`;
  const vus = new Set(), radar = $('arRadar');
  const liste = [...marqueurs.values()].map(x => x.it).map(it => ({ it, d:O.distance(pos.lat, pos.lon, it.lat, it.lon) })).filter(x => x.d < 160);
  const proches = lieux.map(l => ({ l, d:O.distance(pos.lat, pos.lon, l.lat, l.lon) })).filter(x => x.d < 1500).sort((a, b) => a.d - b.d).slice(0, 8);
  const placer = (id, b, d, faire) => {
    const rel = ((b - cap + 540) % 360) - 180, visible = Math.abs(rel) < hfov / 2 + 8;
    let e = elemsAr.get(id);
    if(!visible){ if(e) e.style.display = 'none'; return; }
    if(!e){ e = faire(); $('arCalque').append(e); elemsAr.set(id, e); }
    e.style.display = ''; e.style.left = `${W / 2 + rel / (hfov / 2) * W / 2}px`; vus.add(id);
    return e;
  };
  for(const { it, d } of liste){
    const o = it.objet && O.TOUS[it.objet], e = placer(it.id, O.cap(pos.lat, pos.lon, it.lat, it.lon), d, () => {
      const el = document.createElement('div'); el.className = 'arObj'; el.innerHTML = `<span class="e">${o ? o.ico : '🪙'}</span><small></small>`;
      el.onclick = () => { if(ramasser(it)){ el.remove(); elemsAr.delete(it.id); } }; return el;
    });
    if(!e) continue;
    const taille = clamp(1500 / Math.max(d, 8), 26, 130);
    e.querySelector('.e').style.fontSize = `${taille}px`; e.style.top = `${horizon + clamp(2200 / Math.max(d, 6), 12, H * .32)}px`; e.style.zIndex = String(1000 - Math.round(d));
    e.classList.toggle('proche', d <= portee());
    e.querySelector('small').textContent = d <= portee() ? (o ? 'Touche pour ramasser !' : 'Touche-la !') : `${o ? O.RARETES[o.rar].nom + ' · ' : ''}${Math.round(d)} m`;
  }
  proches.forEach(({ l, d }, i) => {
    const e = placer('L' + l.pageid, O.cap(pos.lat, pos.lon, l.lat, l.lon), d, () => { const el = document.createElement('div'); el.className = 'arObj lieu'; el.innerHTML = '<span class="e" style="font-size:30px">🏛️</span><small></small>'; el.onclick = () => ficheLieu(l); return el; });
    if(!e) return;
    e.style.left = `${clamp(parseFloat(e.style.left), 90, W - 90)}px`; e.style.top = `${horizon - 70 - (i % 3) * 46}px`; e.querySelector('small').textContent = `${S.lieux[l.pageid] ? '✅ ' : ''}${l.titre} · ${km(d)}`;
  });
  for(const [id, e] of elemsAr) if(!vus.has(id)) e.style.display = 'none';
  // le radar : ce qui est dans les 160 m, le haut du radar est la direction regardée
  radar.querySelectorAll('i').forEach(x => x.remove());
  for(const { it, d } of liste){
    const a = (O.cap(pos.lat, pos.lon, it.lat, it.lon) - cap) * Math.PI / 180, r = d / 160 * 56, i = document.createElement('i');
    i.style.left = `${60 + Math.sin(a) * r}px`; i.style.top = `${60 - Math.cos(a) * r}px`; i.style.background = it.objet ? O.RARETES[O.TOUS[it.objet].rar].coul : '#F2B705';
    radar.append(i);
  }
}

/* ---------- L'accueil ---------- */
function accueil(){
  const n = O.niveauDe(S.points);
  $('aStats').innerHTML = `<h2>${S.points ? `Niveau ${n} · ${O.titre(n)}` : 'Ta carte d\'explorateur'}</h2><div class="stats"><div><b>${fmt(S.points)}</b>points</div><div><b>${km(S.metres)}</b>parcourus</div><div><b>${S.sorties.length}</b>sorties</div><div><b>${fmt(S.pieces)}</b>pièces</div><div><b>${Object.keys(S.objets).length}/${O.NB_OBJETS}</b>objets</div><div><b>${Object.keys(S.lieux).length}</b>lieux</div></div>`;
  $('bPartir').textContent = S.enCours ? '🧭 Reprendre la sortie en cours' : '🧭 Partir explorer';
}
function entrer(){
  appliquerOrientation(); if(orienter) ecouterBoussole();
  $('eAccueil').hidden = true;
  for(const id of ['hud', 'xp', 'sortie', 'cotes', 'barre']) $(id).hidden = false;
  carte.invalidateSize(); majHud(); pastilleQ(); redessinerBrouillard();
}
$('bPartir').onclick = () => {
  entrer(); demarrerGps();
  // une sortie restée ouverte (page rechargée) : on la reprend si elle a moins de 6 h
  if(S.enCours){
    if(Date.now() - S.enCours.debut < 6 * 3600000){ sortie = S.enCours; trace.setLatLngs(sortie.trace).addTo(carte); $('bSortie').className = 'stop'; $('bSortie').innerHTML = '⏹<small>Terminer</small>'; garderEcran(); toast('▶️ Sortie reprise.', 'or'); }
    else { sortie = S.enCours; finirSortie(); }
  }
  majSortie();
};
$('bEssai').onclick = () => { entrer(); demarrerEssai(); toast('🧪 Mode essai : déplace-toi avec les flèches ou touche la carte. Rien n\'est gardé.', 'or', 5000); };
$('bAccueil').onclick = () => {
  if(essai){ if(!confirm('Quitter le mode essai ?')) return; location.reload(); return; }
  sauver(); accueil(); $('eAccueil').hidden = false;
};
$('bAide').onclick = () => { $('eAide').hidden = false; };
$('bAideRetour').onclick = () => { $('eAide').hidden = true; };
accueil();
if(new URLSearchParams(location.search).has('essai')) $('bEssai').click();

// pour les essais automatiques
window.Arpenteur = { O, carte, versEcran, get relevement(){ return relevement; }, get essaiCible(){ return essaiCible; }, segments, tuilesRoutes, aimanter, get S(){ return S; }, get pos(){ return pos; }, get lieux(){ return lieux; }, get sortie(){ return sortie; }, nouvellePosition, ramasser, marqueurs, ficheLieu, visiter, lancerSortie, finirSortie, ouvrirAr, fermerAr, set cap(c){ capManuel = c; } };
})();
