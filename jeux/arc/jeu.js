/* Flèche d'or : le jeu de tir à l'arc (règles, commandes, vol des flèches, points, menus).
   La scène 3D est dans arc/scene.js (window.ARC_3D). Le dessin 2D par-dessus (#cv) montre l'arc, le viseur, le vent et les textes.
   Repère : l'archer en (0, sol, 0), il tire vers -Z ; x vers la droite, y vers le haut. Un vent positif pousse vers la droite. */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const virg = (n, k = 1) => n.toFixed(k).replace('.', ',');
const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const jour = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const gauss = () => { let u = 0, v = 0; while(!u) u = Math.random(); while(!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const S3 = window.ARC_3D, G = 9.81;

/* ---------- Les arcs, les concours, les parcours ---------- */
// v : vitesse de la flèche (m/s), trem : tremblement, prec : dispersion (rad), zoom : grossissement du viseur, etoiles : pour le débloquer
const ARCS = {
  droit:{ n:'Arc droit', ico:'🪵', v:48, trem:1.35, prec:.0011, zoom:1, etoiles:0, c:'#9A6232', c2:'#5E3A1C', d:'En bois : des flèches lentes, il tremble un peu.' },
  classique:{ n:'Arc classique', ico:'🏹', v:62, trem:1, prec:.0007, zoom:1.25, etoiles:5, c:'#1F5FAE', c2:'#1B2A40', d:'Stabilisateur et viseur : plus rapide, plus stable.' },
  poulies:{ n:'Arc à poulies', ico:'🎯', v:88, trem:.62, prec:.0004, zoom:1.6, etoiles:12, c:'#4A505C', c2:'#1B1E24', d:'Le plus précis : flèches très rapides, viseur à loupe.' },
};
// le concours : 3 volées de 3 flèches ; D : diamètre de la face (m) ; vent : de … à … m/s
const CONCOURS = [
  { d:18, D:.4, vent:[0, 1.5] }, { d:30, D:.8, vent:[.3, 3] }, { d:50, D:1.22, vent:[1, 4.5] }, { d:70, D:1.22, vent:[2, 6] },
];
const SEUILS = [55, 72, 84];
const PARCOURS = [
  { id:'marmottes', n:'Le Bois des Marmottes', ico:'🐿️', c:'#5E9A44', d:'8 animaux de 10 à 28 m, sur un terrain doux', postes:8, dmin:10, dmax:28, pente:.12, vent:[0, 1.5], seed:11,
    animaux:['marmotte', 'lapin', 'renard', 'chamois', 'sanglier', 'renard', 'marmotte', 'chamois'] },
  { id:'chamois', n:'La Crête des Chamois', ico:'🐐', c:'#8D7D68', d:'10 animaux de 18 à 48 m, en montée et en descente', postes:10, dmin:18, dmax:48, pente:.38, vent:[.5, 3.5], seed:23,
    animaux:['chamois', 'bouquetin', 'cerf', 'ours', 'sanglier', 'renard', 'marmotte', 'bouquetin', 'cerf', 'chamois'] },
];
const MOBILES = { duree:60, seuils:[150, 300, 450] };
const nbEtoiles = (v, s) => v >= s[2] ? 3 : v >= s[1] ? 2 : v >= s[0] ? 1 : 0;
function defiDuJour(){
  const d = new Date(), seed = d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5), R = alea(seed * 7 + 1);
  const choix = [20, 25, 30, 35, 40, 45, 50, 55, 60], dist = [];
  while(dist.length < 3){ const x = choix[Math.floor(R() * choix.length)]; if(!dist.includes(x)) dist.push(x); }
  dist.sort((a, b) => a - b);
  return { id:'defi-' + jour(), n:'Défi du jour', date:d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }),
    volees:dist.map(x => ({ d:x, D:x < 30 ? .6 : x < 50 ? .8 : 1.22, vent:(R() < .5 ? -1 : 1) * Math.round(R() * 45) / 10 })) };
}

/* ---------- Les records ---------- */
let rec = lire('arc-records', {});
const normRec = () => { rec.concours = rec.concours || {}; rec.parcours = rec.parcours || {}; rec.mobiles = rec.mobiles || { score:0, etoiles:0, parties:0 }; rec.parties = rec.parties || 0; rec.fleches = rec.fleches || 0; rec.dix = rec.dix || 0; rec.x = rec.x || 0; };
normRec();
const etoilesTot = () => Object.values(rec.concours).reduce((s, r) => s + (r.etoiles || 0), 0) + Object.values(rec.parcours).reduce((s, r) => s + (r.etoiles || 0), 0) + (rec.mobiles.etoiles || 0);
let arcId = ARCS[rec.arc] && etoilesTot() >= ARCS[rec.arc].etoiles ? rec.arc : 'droit';

/* ---------- Le son ---------- */
let AC = null, son = lire('arc-son', true);
function audio(){ if(AC || !son) return; try{ try{ if(navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){} AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ AC = null; } }
function bruit(duree, type, f, vol, q = 1, glisse = 0){
  if(!AC || !son) return;
  const t = AC.currentTime, n = Math.ceil(AC.sampleRate * duree), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = AC.createBufferSource(); s.buffer = b; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if(glisse) fl.frequency.exponentialRampToValueAtTime(f * glisse, t + duree);
  const g = AC.createGain(); g.gain.value = vol; s.connect(fl); fl.connect(g); g.connect(AC.destination); s.start(t);
}
function ton(f, duree, vol, type = 'sine', f2 = 0, debut = 0){
  if(!AC || !son) return;
  const t = AC.currentTime + debut, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + duree);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + duree);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + duree + .05);
}
const sons = {
  corde:() => { ton(118, .32, .3, 'triangle', 70); ton(236, .12, .08, 'sawtooth', 120); bruit(.08, 'bandpass', 1800, .25, 2); },
  sifflet:() => bruit(.5, 'bandpass', 900, .1, 3, 2.2),
  cible:() => { ton(95, .18, .5, 'sine', 55); bruit(.12, 'lowpass', 700, .45); },
  sol:() => { ton(70, .15, .3, 'sine', 45); bruit(.15, 'lowpass', 400, .3); },
  ballon:() => bruit(.12, 'highpass', 1500, .5),
  plateau:() => { bruit(.25, 'bandpass', 3200, .4, 1.5); ton(1700, .08, .05, 'square'); },
  dix:() => { ton(880, .25, .12, 'sine', 0); ton(1320, .35, .1, 'sine', 0, .08); },
  pret:() => ton(640, .06, .05, 'sine'),
};
function dire(txt){ if(!son || !window.speechSynthesis) return; try{ const u = new SpeechSynthesisUtterance(txt); u.lang = 'fr-FR'; u.rate = 1.1; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){} }

/* ---------- La partie ---------- */
let P = null, raf = 0, dernierLancement = null, annonceT = 0;
const elev = (d, v) => .5 * Math.asin(clamp(G * d / (v * v), 0, 1));       // l'angle pour toucher à d mètres (même hauteur)
function annoncer(txt, sous = '', duree = 1.4){ $('annonce').innerHTML = esc(txt) + (sous ? `<small>${esc(sous)}</small>` : ''); $('annonce').style.opacity = 1; annonceT = duree; }
const texte = (txt, c = '#1D2A20', gros = false) => P.textes.push({ txt, c, gros, vie:1.4 });
const tirerVent = ([a, b]) => (Math.random() < .5 ? -1 : 1) * Math.round((a + Math.random() * (b - a)) * 10) / 10;

function lancer(mode, cfg){
  dernierLancement = [mode, cfg];
  const A = ARCS[arcId];
  P = { mode, cfg, A, arc:arcId, score:0, phase:'pret', t:0, yaw:0, pitch:0, tension:0, plein:false, tPlein:0, vols:[], fleche:0, volee:0, scores:[], textes:[],
    fin:false, pause:false, dernier:performance.now(), tirs:0, dix:0, nx:0, serie:0, combo:1, ph:[0, 1, 2, 3, 4].map(() => Math.random() * 6.28), aide:true };
  ['eMenu', 'eAide', 'eFin', 'ePause', 'eVolee'].forEach(id => $(id).hidden = true);
  $('hud').hidden = false;
  audio(); if(AC && AC.state === 'suspended') AC.resume();
  if(!S3 || !S3.init($('cv3d'))){ alert('La 3D ne marche pas sur cet appareil : le tir à l\'arc ne peut pas s\'afficher.'); quitter(); return; }
  S3.taille(W, Hh);
  if(mode === 'concours'){ P.nV = 3; P.nF = 3; nouvelleVolee(); annoncer(`Concours ${cfg.d} m`, '3 volées de 3 flèches', 1.8); }
  else if(mode === 'defi'){ P.nV = 3; P.nF = 3; nouvelleVolee(); annoncer('Défi du jour', cfg.volees.map(v => v.d + ' m').join(' · '), 1.8); }
  else if(mode === 'parcours'){ P.postes = postesParcours(cfg); P.nV = P.postes.length; P.nF = 2; nouveauPoste(); annoncer(cfg.n, `${cfg.postes} animaux, distances inconnues`, 1.8); }
  else { P.temps = MOBILES.duree; P.mob = []; P.tMob = 0; P.prochainPlateau = 2.5; P.nV = 1; const i = S3.stand(); P.oeil = i.oeil; P.vent = tirerVent([0, 2]); P.glissante = { g:S3.mobile('glissante'), type:'glissante' }; P.mob.push(P.glissante); viserVers(0, P.oeil, -20); annoncer('Cibles mobiles', '60 secondes !', 1.6); }
  majHud();
  cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
}
// la direction de visée vers un point ; « a peu près » : l'arc se lève un peu à côté, il faut ramener le viseur sur la cible
function viserVers(x, y, z, apeupres = 0){
  const hd = Math.hypot(x, z), a = Math.random() * 6.283, r = apeupres * (.6 + Math.random() * .4) / hd;
  P.yaw = Math.atan2(x, -z) + Math.cos(a) * r; P.pitch = Math.atan2(y - P.oeil, hd) + Math.sin(a) * r;
}
const leverArc = () => P.mode === 'parcours' ? viserVers(P.animal.x, P.animal.by, P.animal.z, P.animal.A.L * 1.3) : P.mode !== 'mobiles' && viserVers(P.cible.x, P.cible.y, P.cible.z, P.cible.D);
function nouvelleVolee(){
  const V = P.mode === 'defi' ? P.cfg.volees[P.volee] : P.cfg;
  if(P.mode === 'defi' || P.volee === 0){ const i = S3.pasDeTir(V.d, V.D); P.cible = i.cible; P.oeil = i.oeil; }
  S3.effacerFleches(); P.vols = [];
  P.dist = V.d; P.D = V.D; P.fleche = 0; P.impacts = [];
  P.vent = P.mode === 'defi' ? V.vent : tirerVent(V.vent);
  leverArc();
  P.phase = 'pret';
  if(P.volee) annoncer(`Volée ${P.volee + 1}`, `${P.dist} m · vent ${virg(Math.abs(P.vent))} m/s`, 1.4);
}
// les postes d'un parcours : distance, pente, animal, côté, vent (toujours les mêmes pour un parcours)
function postesParcours(def){
  const R = alea(def.seed), l = [];
  for(let k = 0; k < def.postes; k++) l.push({ d:Math.round(def.dmin + R() * (def.dmax - def.dmin)), pente:(R() * 2 - 1) * def.pente, animal:def.animaux[k % def.animaux.length], dx:Math.round((R() - .5) * 80) / 10, sens:R() < .5 ? -1 : 1,
    vent:(R() < .5 ? -1 : 1) * Math.round((def.vent[0] + R() * (def.vent[1] - def.vent[0])) * 10) / 10, seed:def.seed * 100 + k });
  return l;
}
function nouveauPoste(){
  const c = P.postes[P.volee], i = S3.poste(c); P.vols = [];
  P.animal = i.animal; P.oeil = i.oeil; P.vent = c.vent; P.fleche = 0; P.posteScore = 0; P.dist = c.d;
  leverArc();
  P.phase = 'pret';
  if(P.volee) annoncer(`Poste ${P.volee + 1}`, `${P.animal.n} · distance ?`, 1.4);
}
// le viseur est réglé pour cette distance (concours) ou pour 20 m (parcours et cibles mobiles, avec des repères)
const reglage = () => P.mode === 'concours' || P.mode === 'defi' ? P.dist : 20;

/* ---------- Bander, viser, tirer ---------- */
let doigt = null;
function commencer(x, y, id){
  if(!P || P.pause || P.fin || P.phase !== 'pret') return false;
  doigt = { id, x0:x, y0:y, x, y }; P.phase = 'bande'; P.tension = 0; P.plein = false; P.tPlein = 0; P.aide = false;
  return true;
}
const TIRAGE = () => Math.max(60, Hh * .1);     // tirer le doigt de 10 % de l'écran vers le bas bande l'arc
function bouger(x, y){
  if(!doigt || !P || P.phase !== 'bande') return;
  const dx = x - doigt.x, dy = y - doigt.y; doigt.x = x; doigt.y = y;
  // le doigt vise tout de suite de gauche à droite (une hauteur d'écran = tout le champ de vue) ;
  // vers le bas, il bande d'abord l'arc, puis, une fois bandé, il vise aussi en hauteur
  const k = (cam.fov * Math.PI / 180) / Hh * .9;
  P.yaw += dx * k;
  if(!P.plein){
    P.tension = clamp(Math.max(P.tension, (y - doigt.y0) / TIRAGE()), 0, 1);
    if(P.tension >= 1){ P.plein = true; P.tPlein = 0; sons.pret(); if(navigator.vibrate) navigator.vibrate(12); }
  } else P.pitch = clamp(P.pitch - dy * k, -.6, .8);
}
function lacher(){
  if(!P || P.phase !== 'bande'){ doigt = null; return; }
  doigt = null;
  if(P.tension < .2){ P.phase = 'pret'; P.tension = 0; return; }       // pas assez bandé : on rabaisse l'arc
  tirer();
}
// le tremblement : de petites oscillations, la respiration, et la fatigue au-delà de 4 s bandé
function tremble(){
  if(!P || P.phase !== 'bande') return [0, 0];
  const t = P.t, ph = P.ph, a = .0011 * P.A.trem * (P.plein ? 1 + Math.max(0, P.tPlein - 4) * .45 : .5);
  return [a * (Math.sin(t * 1.9 + ph[0]) * .55 + Math.sin(t * 3.7 + ph[1]) * .3 + Math.sin(t * 8.3 + ph[2]) * .15),
          a * (Math.sin(t * 1.3 + ph[3]) * .5 + Math.sin(t * 4.1 + ph[4]) * .3 + Math.sin(t * .45) * .6)];
}
function tirer(){
  const [wx, wy] = tremble(), A = P.A, fort = P.plein ? 1 : .35 + .65 * P.tension;
  const yaw = P.yaw + wx + gauss() * A.prec, pitch = P.pitch + wy + gauss() * A.prec + elev(reglage(), A.v);
  const v = A.v * fort, dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const vol = { p:[dir[0] * .3, P.oeil - .05 + dir[1] * .3, dir[2] * .3], v:dir.map(c => c * v), t:0, mesh:S3.fleche(P.mode === 'parcours' ? 0x2E8B57 : 0xFF6A2B) };
  S3.placer(vol.mesh, vol.p, dir);
  P.vols.push(vol); P.tirs++;
  P.tension = 0; P.plein = false;
  sons.corde(); setTimeout(sons.sifflet, 60);
  if(P.mode === 'mobiles') P.phase = 'pret';                 // on peut déjà bander la suivante
  else { P.phase = 'vol'; P.ralenti = false; }
}

/* ---------- Le vol des flèches ---------- */
function volerFleches(dt){
  for(const f of P.vols){
    if(f.fini) continue;
    const pas = 1 / 240;
    for(let s = dt; s > 1e-6 && !f.fini; s -= pas){
      const h = Math.min(pas, s), a = f.p.slice();
      f.v[0] += .12 * (P.vent - f.v[0]) * h; f.v[1] -= G * h;
      f.p[0] += f.v[0] * h; f.p[1] += f.v[1] * h; f.p[2] += f.v[2] * h; f.t += h;
      const r = toucher(f, a, f.p);
      if(r){ f.fini = true; f.res = r; arrivee(f, r); break; }
      if(f.p[1] < S3.sol(f.p[0], f.p[2])){ f.fini = true; f.res = { type:'sol', pt:f.p.slice() }; arrivee(f, f.res); break; }
      if(f.t > 6 || f.p[2] < -600){ f.fini = true; f.res = { type:'perdu' }; arrivee(f, f.res); break; }
    }
    if(!f.fini || (f.res && f.res.type !== 'perdu')){ const l = Math.hypot(...f.v); S3.placer(f.mesh, f.res && f.res.pt ? f.res.pt : f.p, f.v.map(c => c / l)); }
  }
  // (cibles mobiles : une flèche arrivée disparaît après un moment)
  if(P.mode === 'mobiles') P.vols = P.vols.filter(f => { if(!f.fini) return true; f.vie = (f.vie ?? 1.2) - dt; if(f.vie > 0) return true; S3.retirer(f.mesh); return false; });
}
// le segment a → b de la flèche touche-t-il quelque chose ?
function toucher(f, a, b){
  const plan = z => a[2] > z && b[2] <= z ? (a[2] - z) / (a[2] - b[2]) : -1;
  const lerp = u => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  if(P.mode === 'concours' || P.mode === 'defi'){
    const c = P.cible, u = plan(c.z); if(u < 0) return null;
    const pt = lerp(u), dx = pt[0] - c.x, dy = pt[1] - c.y, B = Math.max(1.3, c.D + .3);
    if(Math.abs(dx) > B / 2 || Math.abs(dy) > B / 2) return null;
    const r = Math.max(0, Math.hypot(dx, dy) - .003), anneau = r <= c.D / 2 ? 10 - Math.floor(r / (c.D / 20)) : 0;
    return { type:'cible', pt, pts:Math.max(0, anneau), x:r <= c.D / 40, dx, dy };
  }
  if(P.mode === 'parcours'){
    const an = P.animal, u = plan(an.z); if(u < 0) return null;
    const pt = lerp(u), V = an.vital, rv = Math.hypot(pt[0] - V.x, pt[1] - V.y), C = an.corps, T = an.tete;
    let zone = 0;
    if(rv <= V.r10) zone = 10; else if(rv <= V.r8) zone = 8;
    else if(((pt[0] - C.x) / C.rx) ** 2 + ((pt[1] - C.y) / C.ry) ** 2 <= 1 || Math.hypot(pt[0] - T.x, pt[1] - T.y) <= T.r) zone = 5;
    if(!zone) return null;
    return { type:'animal', pt, zone };
  }
  // cibles mobiles : les boules (ballons, plateaux), puis la cible qui glisse
  for(const m of P.mob){
    if(m.touche) continue;
    const o = m.g.position;
    if(m.type === 'glissante'){
      const u = plan(o.z + .101); if(u < 0) continue;
      const pt = lerp(u), dx = pt[0] - o.x, dy = pt[1] - o.y;
      if(Math.abs(dx) > .375 || Math.abs(dy) > .375) continue;
      const r = Math.hypot(dx, dy), anneau = r <= .3 ? 10 - Math.floor(r / .03) : 0;
      return { type:'mobile', m, pt, pts:anneau * 2, anneau };
    }
    const R = m.type === 'ballon' ? .34 : .17;
    // la distance du centre au segment
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ao = [o.x - a[0], o.y - a[1], o.z - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const u = clamp((ao[0] * ab[0] + ao[1] * ab[1] + ao[2] * ab[2]) / l2, 0, 1), q = [a[0] + ab[0] * u, a[1] + ab[1] * u, a[2] + ab[2] * u];
    if(Math.hypot(q[0] - o.x, q[1] - o.y, q[2] - o.z) < R) return { type:'mobile', m, pt:q, pts:m.type === 'ballon' ? 10 : 30 };
  }
  return null;
}
// la flèche est arrivée : les points, le son, la vue de l'impact
function arrivee(f, r){
  if(P.mode === 'mobiles'){
    if(r.type === 'mobile' && (r.pts > 0)){
      P.serie++; P.combo = Math.min(3, 1 + .5 * (P.serie - 1));
      const pts = Math.round(r.pts * P.combo); P.score += pts;
      texte(`+${pts}${P.combo > 1 ? ' ×' + virg(P.combo, 1).replace(',0', '') : ''}`, '#B9780A', true);
      if(r.m.type === 'glissante'){ sons.cible(); if(r.anneau === 10){ sons.dix(); P.dix++; } f.colle = r.m; f.dx = r.pt[0] - r.m.g.position.x; f.dy = r.pt[1] - r.m.g.position.y; }
      else { r.m.touche = true; (r.m.type === 'ballon' ? sons.ballon : sons.plateau)(); S3.retirer(r.m.g); S3.retirer(f.mesh); }
    } else { P.serie = 0; P.combo = 1; if(r.type === 'sol') sons.sol(); if(r.type === 'mobile') sons.cible(); }
    majHud(); return;
  }
  P.impact = { r, t:0, f };
  P.phase = 'impact';
  if(r.type === 'cible'){
    sons.cible();
    const nom = r.pts ? (r.x ? 'X !' : r.pts + ' !') : 'Butte';
    P.impacts.push(r); P.score += r.pts; P.scores.push(r.pts);
    if(r.pts === 10){ P.dix++; if(r.x) P.nx++; setTimeout(sons.dix, 120); dire(r.x ? 'Dix, en plein centre !' : 'Dix !'); }
    texte(nom, r.pts >= 9 ? '#B9780A' : r.pts ? '#1D2A20' : '#E23B3B', true);
  } else if(r.type === 'animal'){
    sons.cible();
    const pts = P.fleche === 0 ? r.zone : { 10:7, 8:5, 5:3 }[r.zone];
    P.posteScore = pts; P.score += pts; P.touche = true;
    if(r.zone === 10){ P.dix++; setTimeout(sons.dix, 120); dire('Dix !'); }
    texte(r.zone === 10 ? 'Zone vitale ! +' + pts : r.zone === 8 ? 'Dans le cercle ! +' + pts : 'Touché ! +' + pts, r.zone >= 8 ? '#B9780A' : '#1D2A20', true);
  } else {
    if(r.type === 'sol') sons.sol();
    if(P.mode !== 'parcours'){ P.scores.push(0); P.impacts.push({ type:'rate' }); }
    texte('Raté', '#E23B3B', true);
  }
  majHud();
}
// après l'impact : la flèche suivante, le bilan de la volée ou du poste, ou la fin
function suite(){
  const r = P.impact.r;
  P.impact = null;
  if(P.mode === 'parcours'){
    if(r.type === 'animal' || P.fleche >= 1){ bilanPoste(); return; }
    P.fleche++; P.phase = 'pret'; leverArc(); majHud(); return;
  }
  P.fleche++;
  if(P.fleche < P.nF){ P.phase = 'pret'; leverArc(); majHud(); return; }
  bilanVolee();
}
function bilanVolee(){
  P.phase = 'bilan';
  const pts = P.scores.slice(-P.nF), tot = pts.reduce((s, v) => s + v, 0), der = P.volee >= P.nV - 1;
  $('vTitre').textContent = `Volée ${P.volee + 1} : ${tot} points`;
  $('vPts').innerHTML = pts.map(v => `<span style="background:${couleurPts(v)};color:${v >= 3 && v <= 4 ? '#fff' : '#1D2A20'}">${v || 'M'}</span>`).join('');
  $('vTxt').textContent = `${P.dist} m · total ${P.score} points${der ? '' : ` · volée suivante : ${P.mode === 'defi' ? P.cfg.volees[P.volee + 1].d : P.dist} m`}`;
  $('vSuite').textContent = der ? 'Voir le résultat ▶' : 'Volée suivante ▶';
  dessinerMiniCible();
  $('eVolee').hidden = false;
}
function bilanPoste(){
  P.phase = 'bilan';
  const c = P.postes[P.volee], der = P.volee >= P.nV - 1;
  P.scores.push(P.posteScore);
  $('vTitre').textContent = `Poste ${P.volee + 1} : ${P.posteScore ? P.posteScore + ' points' : 'raté'}`;
  $('vPts').innerHTML = `<span style="background:#FFF6DC">${S3.ANIMAUX[c.animal].n}</span><span>${c.d} m</span>`;
  $('vTxt').textContent = `${c.pente > .08 ? 'En montée' : c.pente < -.08 ? 'En descente' : 'À plat'}, l'animal était à ${c.d} m. Total : ${P.score} points.`;
  $('vSuite').textContent = der ? 'Voir le résultat ▶' : 'Poste suivant ▶';
  const x = $('cvVolee').getContext('2d'); x.clearRect(0, 0, 240, 240); x.font = '120px sans-serif'; x.textAlign = 'center'; x.fillText({ marmotte:'🐿️', lapin:'🐇', renard:'🦊', chamois:'🐐', sanglier:'🐗', bouquetin:'🐐', cerf:'🦌', ours:'🐻' }[c.animal] || '🎯', 120, 165);
  $('eVolee').hidden = false;
}
$('vSuite').onclick = () => {
  if(!P) return;
  $('eVolee').hidden = true;
  if(P.volee >= P.nV - 1){ finir(); return; }
  P.volee++;
  if(P.mode === 'parcours') nouveauPoste(); else nouvelleVolee();
  majHud();
};
const couleurPts = v => v >= 9 ? '#FFD534' : v >= 7 ? '#F06A66' : v >= 5 ? '#6FB6EC' : v >= 3 ? '#3A3A40' : v >= 1 ? '#FFFFFF' : '#EDEDED';
function dessinerMiniCible(){
  const x = $('cvVolee').getContext('2d'), r = 112, c = 120;
  x.clearRect(0, 0, 240, 240);
  const coul = ['#FFFFFF', '#FFFFFF', '#1C1C20', '#1C1C20', '#2A9BE0', '#2A9BE0', '#E8322F', '#E8322F', '#FFD534', '#FFD534'];
  for(let k = 0; k < 10; k++){ x.beginPath(); x.arc(c, c, r * (10 - k) / 10, 0, 7); x.fillStyle = coul[k]; x.fill(); x.lineWidth = 1; x.strokeStyle = k === 2 || k === 3 ? '#fff' : '#1C1C20'; x.stroke(); }
  P.impacts.forEach((im, i) => {
    if(im.type === 'rate') return;
    const px = c + im.dx / (P.cible.D / 2) * r, py = c - im.dy / (P.cible.D / 2) * r;
    x.beginPath(); x.arc(clamp(px, 4, 236), clamp(py, 4, 236), 7, 0, 7); x.fillStyle = '#2ECC71'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#13233A'; x.stroke();
    x.fillStyle = '#13233A'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.fillText(i + 1, clamp(px, 4, 236), clamp(py, 4, 236) + 4);
  });
}

/* ---------- Les cibles mobiles ---------- */
const COULEURS_BALLONS = [0xE23B3B, 0x2A7BD6, 0xFFC93C, 0x2E9E5B, 0x8E44AD, 0xFF6A2B];
function majMobiles(dt){
  P.tMob += dt; P.temps -= dt;
  if(P.temps <= 0){ P.temps = 0; finir(); return; }
  const t = P.tMob;
  // la cible glisse, de plus en plus vite
  const gl = P.glissante.g, vitesse = .55 + t * .008;
  P.glissante.ph = (P.glissante.ph || 0) + dt * vitesse;
  gl.position.set(Math.sin(P.glissante.ph) * 9, S3.sol(0, -18) + 1.25, -18);
  for(const f of P.vols) if(f.colle && f.colle === P.glissante){ const l = Math.hypot(...f.v); S3.placer(f.mesh, [gl.position.x + f.dx, gl.position.y + f.dy, gl.position.z + .101], f.v.map(c => c / l)); }
  // des ballons qui montent (trois au plus)
  const ballons = P.mob.filter(m => m.type === 'ballon' && !m.touche);
  if(ballons.length < 3 && Math.random() < dt * 1.2){
    const b = { type:'ballon', g:S3.mobile('ballon', COULEURS_BALLONS[Math.floor(Math.random() * 6)]), x:(Math.random() - .5) * 14, z:-19 - Math.random() * 7, y:0, ph:Math.random() * 6 };
    b.y = S3.sol(b.x, b.z) + .3; P.mob.push(b);
  }
  for(const b of ballons){
    b.y += dt * (.6 + t * .004); b.ph += dt;
    b.g.position.set(b.x + Math.sin(b.ph * 1.3) * .4, b.y, b.z);
    if(b.y > S3.sol(b.x, b.z) + 11){ b.touche = true; S3.retirer(b.g); }
  }
  // des plateaux qui traversent
  P.prochainPlateau -= dt;
  if(P.prochainPlateau <= 0){
    P.prochainPlateau = 3 + Math.random() * 2.5 - Math.min(1.5, t * .02);
    const s = Math.random() < .5 ? -1 : 1, z = -22 - Math.random() * 6;
    P.mob.push({ type:'plateau', g:S3.mobile('plateau'), s, z, u:0, duree:3.4 - Math.min(1, t * .012), haut:4 + Math.random() * 3, base:S3.sol(0, z) + 1 });
  }
  for(const p of P.mob.filter(m => m.type === 'plateau' && !m.touche)){
    p.u += dt / p.duree;
    if(p.u >= 1){ p.touche = true; S3.retirer(p.g); continue; }
    p.g.position.set(-p.s * 16 + p.s * 32 * p.u, p.base + p.haut * 4 * p.u * (1 - p.u), p.z);
    p.g.rotation.y += dt * 12;
  }
  P.mob = P.mob.filter(m => !m.touche || m.type === 'glissante');
}

/* ---------- Chaque image ---------- */
function boucle(now){
  if(!P) return;
  const dt = Math.min(.05, (now - P.dernier) / 1000); P.dernier = now;
  if(!P.pause && !P.fin) maj(dt);
  dessiner(dt);
  raf = requestAnimationFrame(boucle);
}
const cam = { fov:50 };
function maj(dt){
  P.t += dt;
  if(P.phase === 'bande'){
    if(clavier.espace && !P.plein){ P.tension = Math.min(1, P.tension + dt / .7); if(P.tension >= 1){ P.plein = true; P.tPlein = 0; sons.pret(); } }
    if(P.plein){
      P.tPlein += dt;
      const k = (cam.fov * Math.PI / 180) * .35 * dt;
      if(clavier.gauche) P.yaw -= k; if(clavier.droite) P.yaw += k; if(clavier.haut) P.pitch += k; if(clavier.bas) P.pitch -= k;
    }
  }
  // le vol : au ralenti en approchant de la cible
  if(P.vols.length){
    let v = dt;
    if(P.phase === 'vol'){
      const f = P.vols[P.vols.length - 1], zc = P.mode === 'parcours' ? P.animal.z : P.cible.z;
      v = dt * (f.p[2] - zc < 7 ? .3 : .8);
      if(P.passer){ v = 3; P.passer = false; }
    }
    volerFleches(v);
  }
  if(P.phase === 'impact'){ P.impact.t += dt; if(P.impact.t > (P.impact.r.type === 'perdu' ? .6 : 1.6)) suite(); }
  if(P.mode === 'mobiles' && !P.fin) majMobiles(dt);
  P.textes = P.textes.filter(e => (e.vie -= dt) > 0);
  if(annonceT > 0){ annonceT -= dt; if(annonceT <= 0) $('annonce').style.opacity = 0; }
  if(P.mode === 'mobiles'){ P.hudT = (P.hudT || 0) - dt; if(P.hudT <= 0){ P.hudT = .2; majHud(); } }
}
// la caméra : l'œil de l'archer (zoom quand l'arc est bandé), la flèche en vol, ou l'impact
function fovVisee(){
  const z = P.A.zoom;
  let hf;
  if(P.mode === 'concours' || P.mode === 'defi') hf = 2 * Math.atan(P.cible.D / (.42 * z) / 2 / P.dist);
  else if(P.mode === 'parcours') hf = 2 * Math.atan(.1 / z);
  else hf = 2 * Math.atan(.16 / z);
  return 2 * Math.atan(Math.tan(hf / 2) * Hh / W) * 180 / Math.PI;
}
function camera(){
  if(P.phase === 'vol'){
    const f = P.vols[P.vols.length - 1], l = Math.hypot(...f.v), d = f.v.map(c => c / l);
    S3.regarder([f.p[0] - d[0] * 1.5, f.p[1] - d[1] * 1.5 + .3, f.p[2] - d[2] * 1.5], [f.p[0] + d[0] * 4, f.p[1] + d[1] * 4, f.p[2] + d[2] * 4], cam.fov = 45);
    return;
  }
  if(P.phase === 'impact' && P.impact.r.type !== 'perdu'){
    const r = P.impact.r, pt = r.pt || P.impact.f.p;
    if(r.type === 'cible'){ const c = P.cible, k = Math.max(1.4, c.D * 2.6); S3.regarder([c.x + .25 * k / 1.4, c.y + .15, c.z + k], [c.x, c.y, c.z], cam.fov = 40); }
    else if(r.type === 'animal'){ const a = P.animal, k = 2.2 + a.A.L * 1.6; S3.regarder([a.x + .6, a.by + .5, a.z + k], [a.x, a.by, a.z], cam.fov = 40); }
    else S3.regarder([pt[0] + 1.4, pt[1] + 1.3, pt[2] + 2.6], pt, cam.fov = 45);
    return;
  }
  const [wx, wy] = tremble(), yaw = P.yaw + wx, pitch = P.pitch + wy;
  const zoom = P.phase === 'bande' ? Math.min(1, P.tension * 1.15) : 0, e = zoom * zoom * (3 - 2 * zoom);
  cam.fov = 50 + (fovVisee() - 50) * e;
  const o = [0, P.oeil, 0];
  S3.regarder(o, [Math.sin(yaw) * Math.cos(pitch) * 100, P.oeil + Math.sin(pitch) * 100, -Math.cos(yaw) * Math.cos(pitch) * 100], cam.fov);
}

/* ---------- Le dessin par-dessus : l'arc, le viseur, le vent, les textes ---------- */
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, Hh = 0, DPR = 1;
let hautStatut = 0;
function taille(){ hautStatut = (document.querySelector('.barre-statut') || {}).offsetHeight || 0; DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || innerWidth; Hh = cv.clientHeight || innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); if(S3 && S3.ok) S3.taille(W, Hh); }
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille); taille();
if(!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h){ this.rect(x, y, w, h); };
function dessiner(dt){
  camera();
  S3.rendu(dt, P.vent);
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, Hh);
  const visee = P.phase === 'pret' || P.phase === 'bande';
  if(visee) dessinerArc();
  dessinerVent();
  // les textes au milieu de l'écran
  g.textAlign = 'center'; g.lineJoin = 'round';
  P.textes.forEach((e, i) => {
    const y = Hh * .36 - (1.4 - e.vie) * 30 - (P.textes.length - 1 - i) * 40;
    g.globalAlpha = Math.min(1, e.vie * 2); g.font = `400 ${e.gros ? 54 : 30}px "Bebas Neue", sans-serif`;
    g.lineWidth = 7; g.strokeStyle = '#fff'; g.strokeText(e.txt, W / 2, y); g.fillStyle = e.c; g.fillText(e.txt, W / 2, y);
  });
  g.globalAlpha = 1;
  if(P.phase === 'vol'){ g.font = '700 13px "Bricolage Grotesque", sans-serif'; g.fillStyle = 'rgba(29,42,32,.7)'; g.fillText('touche l\'écran pour passer', W / 2, Hh - 40); }
}
function dessinerArc(){
  const A = P.A, cx = W / 2, cy = Hh / 2, t = P.phase === 'bande' ? P.tension : 0, m = Math.min(W, Hh);
  // le viseur : un point (arc droit), un anneau et sa fibre (classique), une loupe (à poulies)
  g.save(); g.lineCap = 'round';
  if(arcId === 'poulies'){
    const r = m * .17;
    g.strokeStyle = 'rgba(20,24,30,.85)'; g.lineWidth = 9; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r - 6, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(20,24,30,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - r + 6, cy); g.lineTo(cx - 10, cy); g.moveTo(cx + 10, cy); g.lineTo(cx + r - 6, cy); g.moveTo(cx, cy - r + 6); g.lineTo(cx, cy - 10); g.moveTo(cx, cy + 10); g.lineTo(cx, cy + r - 6); g.stroke();
    g.fillStyle = '#FF2D2D'; g.beginPath(); g.arc(cx, cy, 3.2, 0, 7); g.fill();
  } else if(arcId === 'classique'){
    g.strokeStyle = 'rgba(20,24,30,.85)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.stroke();
    if(t < .7){ g.strokeStyle = 'rgba(20,24,30,.85)'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 15, cy); g.lineTo(cx - W * .2, cy + 4); g.stroke(); }
    g.fillStyle = '#7CFF4F'; g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill(); g.strokeStyle = '#13233A'; g.lineWidth = 1; g.stroke();
  } else {
    g.strokeStyle = 'rgba(20,24,30,.8)'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx - 20, cy); g.lineTo(cx - 12, cy); g.moveTo(cx + 12, cy); g.lineTo(cx + 20, cy); g.moveTo(cx, cy - 20); g.lineTo(cx, cy - 12); g.moveTo(cx, cy + 12); g.lineTo(cx, cy + 20); g.stroke();
    g.fillStyle = '#FFD534'; g.beginPath(); g.arc(cx, cy, 2.5, 0, 7); g.fill();
  }
  // les repères de distance (parcours et cibles mobiles : le viseur est réglé à 20 m)
  if((P.mode === 'parcours' || P.mode === 'mobiles') && P.phase === 'bande' && P.tension > .85){
    const f = Math.tan(cam.fov * Math.PI / 360), e0 = elev(20, A.v);
    g.font = '700 11px "Bricolage Grotesque", sans-serif'; g.textAlign = 'left';
    for(let d = 10; d <= 50; d += 5){
      if(d === 20) continue;
      const y = cy + Math.tan(elev(d, A.v) - e0) / f * Hh / 2; if(Math.abs(y - cy) > Hh * .42) continue;
      const l = d % 10 ? 7 : 12;
      g.strokeStyle = 'rgba(20,24,30,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - l, y); g.lineTo(cx + l, y); g.stroke();
      g.fillStyle = d % 10 ? '#FFFFFF' : '#FFD534'; g.beginPath(); g.arc(cx, y, 2, 0, 7); g.fill();
      if(!(d % 10) || P.mode === 'parcours'){ g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText(d + ' m', cx + l + 4, y + 4); g.fillStyle = '#13233A'; g.fillText(d + ' m', cx + l + 4, y + 4); }
    }
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)'; g.strokeText('20 m', cx + 24, cy - 6); g.fillStyle = '#13233A'; g.fillText('20 m', cx + 24, cy - 6);
  }
  // l'arc : la poignée à gauche du viseur, les branches qui partent hors de l'écran, la corde tirée vers soi ;
  // en le bandant, on le lève devant soi : il sort de l'écran et il ne reste que le viseur
  const sortie = t * t * (3 - 2 * t);
  g.translate(-sortie * W * .75, sortie * Hh * .55);
  const bx = cx - W * .2, hb = Hh * .62, tir = t * W * .32;
  const haut = [bx - W * .07 + t * W * .02, cy - hb], bas = [bx - W * .07 + t * W * .02, cy + hb];
  g.lineWidth = 15; g.strokeStyle = A.c2; g.beginPath(); g.moveTo(...haut); g.quadraticCurveTo(bx + W * .06 - t * W * .03, cy - hb * .45, bx, cy - 40); g.moveTo(...bas); g.quadraticCurveTo(bx + W * .06 - t * W * .03, cy + hb * .45, bx, cy + 40); g.stroke();
  g.lineWidth = 10; g.strokeStyle = A.c; g.stroke();
  if(arcId === 'poulies') for(const p of [haut, bas]){ g.fillStyle = '#1B1E24'; g.beginPath(); g.arc(p[0] + 8, p[1] + (p === haut ? 30 : -30), 14, 0, 7); g.fill(); g.fillStyle = '#9AA2AE'; g.beginPath(); g.arc(p[0] + 8, p[1] + (p === haut ? 30 : -30), 6, 0, 7); g.fill(); }
  g.fillStyle = A.c2; g.beginPath(); g.roundRect(bx - 11, cy - 48, 22, 96, 9); g.fill();
  if(arcId !== 'droit'){ g.strokeStyle = A.c2; g.lineWidth = 6; g.beginPath(); g.moveTo(bx, cy + 30); g.lineTo(bx + W * .05, cy + Hh * .2); g.stroke(); }
  // la corde et la flèche
  const n = [bx + 6 + tir, cy + t * Hh * .04];
  g.strokeStyle = 'rgba(245,240,225,.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(...haut); g.lineTo(...n); g.lineTo(...bas); g.stroke();
  if(t > .02){
    const pointe = [bx - 10, cy - 2];
    g.strokeStyle = '#2A2E36'; g.lineWidth = 5; g.beginPath(); g.moveTo(...n); g.lineTo(...pointe); g.stroke();
    g.fillStyle = '#C9CFD8'; g.beginPath(); g.moveTo(pointe[0] - 12, pointe[1]); g.lineTo(pointe[0] + 2, pointe[1] - 5); g.lineTo(pointe[0] + 2, pointe[1] + 5); g.fill();
    g.fillStyle = '#FF6A2B'; g.beginPath(); g.moveTo(n[0], n[1]); g.lineTo(n[0] - 26, n[1] - 9); g.lineTo(n[0] - 18, n[1]); g.lineTo(n[0] - 26, n[1] + 9); g.fill();
  }
  g.restore();
  // la jauge pour bander, ou l'aide
  if(P.phase === 'bande' && !P.plein && doigt){
    const L = TIRAGE();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(doigt.x0, doigt.y0); g.lineTo(doigt.x0, doigt.y0 + L); g.stroke();
    g.strokeStyle = '#E8A817'; g.lineWidth = 6; g.beginPath(); g.moveTo(doigt.x0, doigt.y0); g.lineTo(doigt.x0, doigt.y0 + L * P.tension); g.stroke();
    g.font = '700 14px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#fff'; g.strokeText('tire vers le bas', doigt.x0, doigt.y0 - 14); g.fillStyle = '#1D2A20'; g.fillText('tire vers le bas', doigt.x0, doigt.y0 - 14);
  }
  g.textAlign = 'center'; g.font = '800 15px "Bricolage Grotesque", sans-serif';
  const msg = P.phase === 'pret' ? (P.aide ? 'Pose le doigt et tire vers le bas pour bander l\'arc' : '') : P.plein ? (P.tPlein > 4 ? 'Tu fatigues… lâche !' : P.tPlein < 2.5 ? 'Glisse le doigt pour viser, lève-le pour tirer' : '') : '';
  if(msg){ const w = g.measureText(msg).width + 24; g.fillStyle = P.tPlein > 4 && P.plein ? 'rgba(226,59,59,.92)' : 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect(W / 2 - w / 2, Hh - 92, w, 32, 16); g.fill(); g.fillStyle = P.tPlein > 4 && P.plein ? '#fff' : '#1D2A20'; g.fillText(msg, W / 2, Hh - 71); }
}
// le vent, en haut : sa force et son sens (et la distance quand elle est connue)
function dessinerVent(){
  const v = P.vent, y = 74 + hautStatut;
  const txt = `${P.mode === 'parcours' ? '? m · ' : P.mode === 'mobiles' ? '' : P.dist + ' m · '}vent ${virg(Math.abs(v))} m/s`;
  g.font = '800 14px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center';
  const w = g.measureText(txt).width + 70;
  g.fillStyle = 'rgba(255,255,255,.88)'; g.beginPath(); g.roundRect(W / 2 - w / 2, y, w, 30, 15); g.fill();
  g.fillStyle = '#1D2A20'; g.fillText(txt, W / 2 + 14, y + 20);
  // la flèche du vent : sa longueur suit la force
  const l = 6 + Math.min(1, Math.abs(v) / 6) * 16, x0 = W / 2 - w / 2 + 22, s = Math.sign(v) || 1;
  g.strokeStyle = '#2A7BD6'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 - s * l / 2, y + 15); g.lineTo(x0 + s * l / 2, y + 15); g.lineTo(x0 + s * l / 2 - s * 5, y + 10); g.moveTo(x0 + s * l / 2, y + 15); g.lineTo(x0 + s * l / 2 - s * 5, y + 20); g.stroke();
}
function majHud(){
  if(!P) return;
  $('hScore').textContent = P.score;
  if(P.mode === 'mobiles'){ $('hInfoN').textContent = 'Temps'; $('hInfo').textContent = Math.ceil(P.temps) + ' s'; $('hDistN').textContent = 'Combo'; $('hDist').textContent = '×' + virg(P.combo, 1).replace(',0', ''); return; }
  $('hInfoN').textContent = P.mode === 'parcours' ? 'Poste' : 'Volée'; $('hInfo').textContent = `${P.volee + 1}/${P.nV}`;
  $('hDistN').textContent = 'Flèche'; $('hDist').textContent = `${Math.min(P.fleche + 1, P.nF)}/${P.nF}`;
}

/* ---------- La fin, les records ---------- */
function finir(){
  if(!P || P.fin) return;
  P.fin = true; P.phase = 'fin'; doigt = null;
  const avant = etoilesTot();
  let titre = '', etoiles = -1, recTxt = '', lignes = [];
  const commun = [['Flèches tirées', P.tirs], ['Dans le 10', P.dix]];
  if(P.mode === 'concours' || P.mode === 'defi'){
    etoiles = nbEtoiles(P.score, SEUILS);
    for(let v = 0; v < P.nV; v++){ const s = P.scores.slice(v * 3, v * 3 + 3); lignes.push([`Volée ${v + 1}${P.mode === 'defi' ? ` (${P.cfg.volees[v].d} m)` : ''}`, `${s.map(x => x || 'M').join(' · ')} = ${s.reduce((a, b) => a + b, 0)}`]); }
    lignes.push(['X (en plein centre)', P.nx]);
    if(P.mode === 'concours'){
      const k = String(P.cfg.d), r = rec.concours[k] || { score:0, etoiles:0, parties:0 }, nv = P.score > r.score;
      r.parties++; if(nv) r.score = P.score; r.etoiles = Math.max(r.etoiles, etoiles); rec.concours[k] = r;
      titre = `Concours ${P.cfg.d} m · ${ARCS[P.arc].n}`; recTxt = nv && r.parties > 1 ? '🏆 Nouveau record !' : r.parties > 1 ? `Record : ${r.score} points` : '';
      rec.dernier = { mode:'concours', n:`Concours ${P.cfg.d} m`, score:P.score, etoiles };
    } else {
      const r = rec.defi && rec.defi.jour === jour() ? rec.defi : { jour:jour(), score:0, etoiles:0 }, nv = P.score > r.score;
      if(nv) r.score = P.score; r.etoiles = Math.max(r.etoiles, etoiles); rec.defi = r; rec.defiMeilleur = Math.max(rec.defiMeilleur || 0, P.score);
      titre = `Défi du jour · ${P.cfg.date}`; recTxt = nv ? '🏆 Meilleur score du jour !' : `Meilleur du jour : ${r.score} points`;
      rec.dernier = { mode:'defi', n:'Défi du jour', score:P.score, etoiles };
    }
  } else if(P.mode === 'parcours'){
    const max = P.nV * 10; etoiles = nbEtoiles(P.score / max, [.5, .7, .85]);
    P.postes.forEach((c, i) => lignes.push([`${i + 1}. ${S3.ANIMAUX[c.animal].n} à ${c.d} m`, P.scores[i] != null ? (P.scores[i] ? P.scores[i] + ' pts' : 'raté') : '—']));
    const r = rec.parcours[P.cfg.id] || { score:0, etoiles:0, parties:0 }, nv = P.score > r.score;
    r.parties++; if(nv) r.score = P.score; r.etoiles = Math.max(r.etoiles, etoiles); r.n = P.cfg.n; rec.parcours[P.cfg.id] = r;
    titre = `${P.cfg.n} · ${ARCS[P.arc].n}`; recTxt = nv && r.parties > 1 ? '🏆 Nouveau record !' : r.parties > 1 ? `Record : ${r.score} points` : '';
    rec.dernier = { mode:'parcours', n:P.cfg.n, score:P.score, etoiles };
    lignes.push(['Sur ' + max + ' points', '']);
  } else {
    etoiles = nbEtoiles(P.score, MOBILES.seuils);
    const r = rec.mobiles, nv = P.score > r.score;
    r.parties++; if(nv) r.score = P.score; r.etoiles = Math.max(r.etoiles, etoiles);
    titre = `Cibles mobiles · ${ARCS[P.arc].n}`; recTxt = nv && r.parties > 1 ? '🏆 Nouveau record !' : r.parties > 1 ? `Record : ${r.score} points` : '';
    rec.dernier = { mode:'mobiles', n:'Cibles mobiles', score:P.score, etoiles };
    lignes.push(['Étoiles à', MOBILES.seuils.join(', ') + ' points']);
  }
  rec.parties++; rec.fleches += P.tirs; rec.dix += P.dix; rec.x += P.nx; rec.dernier.arc = P.arc;
  const apres = etoilesTot();
  for(const [id, A] of Object.entries(ARCS)) if(A.etoiles > avant && A.etoiles <= apres) recTxt += (recTxt ? ' · ' : '') + `🔓 Nouvel arc : ${A.n} !`;
  ecrire('arc-records', rec);
  $('fTitre').textContent = titre;
  $('fEtoiles').textContent = etoiles < 0 ? '' : '★'.repeat(etoiles) + '☆'.repeat(3 - etoiles);
  $('fScore').innerHTML = `${P.score}<small>points</small>`;
  $('fRecord').textContent = recTxt;
  $('fDetail').innerHTML = [...lignes, ...commun].map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
  $('hud').hidden = true; $('eVolee').hidden = true; $('annonce').style.opacity = 0;
  setTimeout(() => { if(P && P.fin) $('eFin').hidden = false; }, P.mode === 'mobiles' ? 300 : 100);
}
function quitter(){
  P = null; cancelAnimationFrame(raf); doigt = null;
  $('hud').hidden = true; $('eVolee').hidden = true; $('annonce').style.opacity = 0;
  ['ePause', 'eFin'].forEach(id => $(id).hidden = true);
  menu();
}
function pause(){ if(!P || P.fin) return; P.pause = true; doigt = null; if(P.phase === 'bande'){ P.phase = 'pret'; P.tension = 0; P.plein = false; } $('ePause').hidden = false; }
function reprendre(){ if(!P) return; P.pause = false; P.dernier = performance.now(); $('ePause').hidden = true; }

/* ---------- Le menu ---------- */
const etoilesTxt = n => `<span class="et">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
function menu(){
  normRec();
  const tot = etoilesTot();
  if(etoilesTot() < ARCS[arcId].etoiles) arcId = 'droit';
  $('totEt').textContent = `★ ${tot}`;
  $('arcs').innerHTML = Object.entries(ARCS).map(([id, A]) => `<button data-arc="${id}" class="${id === arcId ? 'actif' : ''}" ${tot < A.etoiles ? 'disabled' : ''}>${A.ico} ${A.n}<small>${tot < A.etoiles ? `🔒 ${A.etoiles} ★` : `${A.v} m/s`}</small></button>`).join('');
  $('arcTxt').textContent = ARCS[arcId].d;
  const d = defiDuJour(), rd = rec.defi && rec.defi.jour === jour() ? rec.defi : null;
  $('lDefi').innerHTML = `<button class="ligne vedette" data-defi="1"><span class="ico" style="background:#FFF0C2">📅</span><span><b>${esc(d.date)}</b><small>${d.volees.map(v => v.d + ' m').join(' · ')} · 3 volées de 3 flèches</small></span><span class="rec">${rd ? etoilesTxt(rd.etoiles) + `<small>${rd.score} pts</small>` : '<small>à faire</small>'}</span></button>`;
  $('lConcours').innerHTML = CONCOURS.map((c, i) => {
    const r = rec.concours[c.d], ouvert = i === 0 || (rec.concours[CONCOURS[i - 1].d] || {}).etoiles > 0;
    return `<button class="ligne" data-concours="${i}" ${ouvert ? '' : 'disabled'}><span class="ico" style="background:#FFF0C2">🎯</span><span><b>${c.d} mètres</b><small>${ouvert ? `Cible de ${Math.round(c.D * 100)} cm · vent jusqu'à ${c.vent[1]} m/s` : `🔒 1 étoile à ${CONCOURS[i - 1].d} m pour ouvrir`}</small></span><span class="rec">${r ? etoilesTxt(r.etoiles) + `<small>${r.score} / 90</small>` : '<small>à faire</small>'}</span></button>`;
  }).join('');
  $('lParcours').innerHTML = PARCOURS.map((p, i) => {
    const r = rec.parcours[p.id], ouvert = i === 0 || (rec.parcours[PARCOURS[i - 1].id] || {}).etoiles > 0;
    return `<button class="ligne" data-parcours="${i}" ${ouvert ? '' : 'disabled'}><span class="ico" style="background:${p.c}22">${p.ico}</span><span><b>${esc(p.n)}</b><small>${ouvert ? esc(p.d) : `🔒 1 étoile au ${esc(PARCOURS[i - 1].n)} pour ouvrir`}</small></span><span class="rec">${r ? etoilesTxt(r.etoiles) + `<small>${r.score} / ${p.postes * 10}</small>` : '<small>à faire</small>'}</span></button>`;
  }).join('');
  const rm = rec.mobiles;
  $('lMobiles').innerHTML = `<button class="ligne" data-mobiles="1"><span class="ico" style="background:#FDE3E3">🎈</span><span><b>60 secondes</b><small>Ballons, plateaux et cible qui glisse · combo jusqu'à ×3</small></span><span class="rec">${rm.parties ? etoilesTxt(rm.etoiles) + `<small>${rm.score} pts</small>` : '<small>à faire</small>'}</span></button>`;
  $('bSon').textContent = son ? '🔊' : '🔇';
  $('eMenu').hidden = false;
  dessinerFondMenu();
}
$('eMenu').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b || b.disabled) return;
  if(b.dataset.arc){ arcId = b.dataset.arc; rec.arc = arcId; ecrire('arc-records', rec); menu(); return; }
  if(b.dataset.defi) lancer('defi', defiDuJour());
  else if(b.dataset.concours) lancer('concours', CONCOURS[+b.dataset.concours]);
  else if(b.dataset.parcours) lancer('parcours', PARCOURS[+b.dataset.parcours]);
  else if(b.dataset.mobiles) lancer('mobiles', MOBILES);
});
$('bSon').onclick = () => { son = !son; ecrire('arc-son', son); $('bSon').textContent = son ? '🔊' : '🔇'; if(son) audio(); };
$('bAide').onclick = () => { $('eMenu').hidden = true; $('eAide').hidden = false; };
$('bAideRetour').onclick = () => { $('eAide').hidden = true; $('eMenu').hidden = false; };
$('bPause').onclick = pause; $('bReprendre').onclick = reprendre; $('bQuitter').onclick = quitter;
$('bRecommencer').onclick = () => { $('ePause').hidden = true; if(dernierLancement) lancer(dernierLancement[0], dernierLancement[0] === 'defi' ? defiDuJour() : dernierLancement[1]); };
$('bRejouer').onclick = () => { $('eFin').hidden = true; if(dernierLancement) lancer(dernierLancement[0], dernierLancement[0] === 'defi' ? defiDuJour() : dernierLancement[1]); };
$('bMenu').onclick = quitter;
// le fond du menu : le pas de tir à 30 m
function dessinerFondMenu(){
  if(!S3 || !S3.init($('cv3d'))) return;
  S3.taille(W, Hh); S3.pasDeTir(30, .8);
  const o = 1.62 + S3.sol(0, 0);
  S3.regarder([2.5, o + .6, 6], [0, o, -30], 50); S3.rendu(0, 2);
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, Hh);
}

/* ---------- Les commandes ---------- */
cv.addEventListener('pointerdown', e => {
  if(!P) return;
  if(P.phase === 'vol'){ P.passer = true; return; }
  if(doigt) return;
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  if(commencer(e.clientX, e.clientY, e.pointerId)) audio();
});
cv.addEventListener('pointermove', e => { if(doigt && e.pointerId === doigt.id) bouger(e.clientX, e.clientY); });
const fin = e => { if(doigt && e.pointerId === doigt.id) lacher(); };
cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', e => { if(doigt && e.pointerId === doigt.id){ doigt = null; if(P && P.phase === 'bande'){ P.phase = 'pret'; P.tension = 0; P.plein = false; } } });
cv.addEventListener('contextmenu', e => e.preventDefault());
const clavier = { espace:false, gauche:false, droite:false, haut:false, bas:false };
addEventListener('keydown', e => {
  if(!P) return;
  const k = { ArrowLeft:'gauche', ArrowRight:'droite', ArrowUp:'haut', ArrowDown:'bas' }[e.code];
  if(k){ clavier[k] = true; e.preventDefault(); }
  if(e.code === 'Space'){ e.preventDefault(); if(e.repeat) return; if(P.phase === 'vol'){ P.passer = true; return; } if(P.phase === 'pret' && !doigt){ P.phase = 'bande'; P.tension = 0; P.plein = false; P.tPlein = 0; P.aide = false; clavier.espace = true; audio(); } }
  if(e.code === 'Escape' || e.code === 'KeyP'){ if(!P.pause) pause(); else reprendre(); }
});
addEventListener('keyup', e => {
  const k = { ArrowLeft:'gauche', ArrowRight:'droite', ArrowUp:'haut', ArrowDown:'bas' }[e.code]; if(k) clavier[k] = false;
  if(e.code === 'Space' && clavier.espace){ clavier.espace = false; if(P && P.phase === 'bande'){ if(P.tension < .2){ P.phase = 'pret'; P.tension = 0; } else tirer(); } }
});
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });

menu();
window.FlecheOr = { lancer, ARCS, CONCOURS, PARCOURS, MOBILES, defiDuJour, get partie(){ return P; }, finir, tirer, elev, get rec(){ return rec; }, menu };
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
