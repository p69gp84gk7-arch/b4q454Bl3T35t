/* Arpenteur : le jeu. La carte (Leaflet + OpenStreetMap), la position GPS, les sorties (distance, durée, points),
   le ramassage des pièces et des objets, les lieux Wikipédia (fiches, visites, carnet), la vue AR (caméra + boussole),
   l'album, le journal des sorties, et le mode essai (on se déplace avec des flèches, rien n'est gardé).
   Les objets et les points sont dans arpenteur/objets.js. */
(() => {
'use strict';
const O = window.ARPENTEUR_OBJETS, L = window.L;
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
const nouvelle = () => ({ v:1, points:0, metres:0, reste:0, pieces:0, objets:{}, lieux:{}, sorties:[], ramasses:{ jour:'', ids:[] }, enCours:null, dernierePos:null });
let S = lire('arpenteur-partie', null) || nouvelle(), essai = false;
function sauver(){
  if(essai) return;
  ecrire('arpenteur-partie', S);
  ecrire('arpenteur-records', { points:S.points, km:Math.round(S.metres / 100) / 10, niveau:O.niveauDe(S.points), objets:Object.keys(S.objets).length, lieux:Object.keys(S.lieux).length,
    sorties:S.sorties.length, pieces:S.pieces, meilleureSortie:S.sorties.reduce((m, s) => Math.max(m, s.metres), 0), dernier:Date.now() });
}
setInterval(() => { if(!essai && (sortie || pos)) sauver(); }, 15000);
addEventListener('visibilitychange', () => { if(document.hidden) sauver(); else if(sortie) garderEcran(); });
addEventListener('pagehide', sauver);
function jourCourant(){ const j = O.jourDe(); if(S.ramasses.jour !== j) S.ramasses = { jour:j, ids:[] }; return j; }
const estRamasse = id => S.ramasses.ids.includes(id);

/* ---------- La carte ---------- */
const depart = S.dernierePos || { lat:46.6, lon:2.4 };
const carte = L.map('carte', { zoomControl:false, attributionControl:true, zoomSnap:.5 }).setView([depart.lat, depart.lon], S.dernierePos ? 16 : 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · Wikipédia' }).addTo(carte);
let suivre = true;
carte.on('dragstart', () => { suivre = false; $('bCentre').classList.remove('actif'); });
$('bCentre').onclick = () => { suivre = true; $('bCentre').classList.add('actif'); if(pos) carte.setView([pos.lat, pos.lon], Math.max(carte.getZoom(), 16)); };
$('bPlus').onclick = () => carte.zoomIn(); $('bMoins').onclick = () => carte.zoomOut();
const icone = (html, cls, taille) => L.divIcon({ className:'', html:`<div class="mk ${cls}">${html}</div>`, iconSize:[taille, taille], iconAnchor:[taille / 2, taille / 2] });
const moi = L.marker([depart.lat, depart.lon], { icon:L.divIcon({ className:'', html:'<div class="moi"><i id="moiCap"></i></div>', iconSize:[22, 22], iconAnchor:[11, 11] }), interactive:false, zIndexOffset:1000 });
const precision = L.circle([depart.lat, depart.lon], { radius:20, color:'#2F80C8', weight:1, fillOpacity:.08, interactive:false });
const trace = L.polyline([], { color:'#F28C28', weight:5, opacity:.85 });

/* ---------- La position (GPS, ou le mode essai) ---------- */
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
  // la distance : seulement pendant une sortie, avec un GPS assez précis, et pas en voiture
  trop = false;
  if(sortie && acc <= 40){
    if(!dernier) dernier = { lat, lon, t };
    else {
      const d = O.distance(dernier.lat, dernier.lon, lat, lon), dt = Math.max(.5, (t - dernier.t) / 1000);
      if(d >= Math.max(4, acc * .4)){
        capMarche = O.cap(dernier.lat, dernier.lon, lat, lon);
        if(d / dt <= VITESSE_MAX){
          sortie.metres += d; S.metres += d; S.reste += d;
          sortie.trace.push([+lat.toFixed(6), +lon.toFixed(6)]); trace.addLatLng([lat, lon]);
          const n = Math.floor(S.reste / 10); if(n > 0){ S.reste -= n * 10; gagner(n, null); }
        } else trop = true;
        dernier = { lat, lon, t };
      }
    }
  }
  etatGps(acc > 40 ? `📡 GPS imprécis (±${Math.round(acc)} m)` : trop ? '🚗 Trop rapide : ça ne compte pas' : `📡 GPS ±${Math.round(acc)} m`, acc > 40 || trop ? 'mal' : 'bon');
  majCap();
  semer(); ramasserAutour(); chercherLieux();
  majSortie();
}
// la direction du joueur : la boussole si on l'a, sinon le sens de la marche
function majCap(){ const c = capBoussole ?? capMarche, e = document.getElementById('moiCap'); if(e){ e.style.display = c == null ? 'none' : ''; if(c != null) e.style.transform = `rotate(${c}deg)`; } }

// le mode essai : on marche (5 m/s) dans une direction, ou vers un point touché sur la carte
let essaiDir = null, essaiCible = null, essaiTimer = null;
function demarrerEssai(){
  const p = S.dernierePos || DEPART_ESSAI;
  essai = true; S = nouvelle(); S.dernierePos = p;
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
  if(ou){ const p = carte.latLngToContainerPoint(ou), e = document.createElement('div'); e.className = 'gain'; e.textContent = `+${n}${txt ? ' ' + txt : ''}`; e.style.left = `${p.x - 20}px`; e.style.top = `${p.y - 30}px`; document.body.append(e); setTimeout(() => e.remove(), 1200); }
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
  if(!force && dernierSemis && O.distance(dernierSemis.lat, dernierSemis.lon, pos.lat, pos.lon) < 60 && dernierSemis.jour === O.jourDe()) return;
  dernierSemis = { lat:pos.lat, lon:pos.lon, jour:O.jourDe() };
  const l = itemsAutour(), vus = new Set();
  for(const it of l){
    vus.add(it.id);
    if(marqueurs.has(it.id)) continue;
    const o = it.objet && O.TOUS[it.objet];
    const m = L.marker([it.lat, it.lon], { icon:it.type === 'piece' ? icone('🪙', 'piece', 24) : L.divIcon({ className:'', html:`<div class="mk objet" style="--c:${O.RARETES[o.rar].coul}">${o.ico}</div>`, iconSize:[34, 34], iconAnchor:[17, 17] }), zIndexOffset:it.type === 'objet' ? 500 : 0 });
    m.on('click', e => { L.DomEvent.preventDefault(e.originalEvent); ramasser(it); });
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
  if(it.type === 'piece'){ S.pieces++; if(sortie) sortie.pieces++; gagner(O.PTS.piece, [it.lat, it.lon]); }
  else {
    const o = O.TOUS[it.objet], neuf = !S.objets[o.id], pts = O.RARETES[o.rar].pts + (neuf ? O.PTS.nouveau : 0);
    S.objets[o.id] = (S.objets[o.id] || 0) + 1; if(sortie) sortie.objets.push(o.id);
    gagner(pts, [it.lat, it.lon]);
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
      const vu = !!S.lieux[l.pageid], m = L.marker([l.lat, l.lon], { icon:L.divIcon({ className:'', html:`<div class="mk lieu${vu ? ' vu' : ''}"><span>${vu ? '✓' : '🏛️'}</span></div>`, iconSize:[30, 30], iconAnchor:[15, 30] }), zIndexOffset:300, title:l.titre });
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
  gagner(O.PTS.visite, [l.lat, l.lon]);
  toast(`📸 ${l.titre} : visité ! Carte postale ajoutée à ton carnet. +${O.PTS.visite}`, 'or', 4500);
  const m = marqueursLieux.get(l.pageid); if(m) m.setIcon(L.divIcon({ className:'', html:'<div class="mk lieu vu"><span>✓</span></div>', iconSize:[30, 30], iconAnchor:[15, 30] }));
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
let panneau = null, sousOnglet = { album:'nature', lieux:'autour' };
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
async function ecouterBoussole(){
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
  $('eAccueil').hidden = true;
  for(const id of ['hud', 'xp', 'sortie', 'cotes', 'barre']) $(id).hidden = false;
  carte.invalidateSize(); majHud();
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
window.Arpenteur = { O, carte, get S(){ return S; }, get pos(){ return pos; }, get lieux(){ return lieux; }, get sortie(){ return sortie; }, nouvellePosition, ramasser, marqueurs, ficheLieu, visiter, lancerSortie, finirSortie, ouvrirAr, fermerAr, set cap(c){ capManuel = c; } };
})();
