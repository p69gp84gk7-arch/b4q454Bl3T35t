/* Les Aventures de Pépin : le moteur du jeu de plateforme.
   Le monde est une grille de tuiles de 16 × 16 pixels, 15 rangées de haut (240 pixels) ; l'écran montre 240 pixels de haut
   et autant de largeur que l'écran du téléphone le permet. Tout se calcule 60 fois par seconde, en pixels par image. */
(() => {
'use strict';
const SP = window.PEPIN_SPRITES, NIVEAUX = window.PEPIN_NIVEAUX;
const $ = id => document.getElementById(id);
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const T = 16, ROWS = 15, HAUT = ROWS * T;

/* ---------- Les tuiles ---------- */
const TL = { VIDE:0, SOLH:1, SOL:2, BRIQUE:3, MYST:4, USE:5, DUR:6, TG:7, TD:8, CG:9, CD:10, NUAGE:11, PONT:12, LAVE:13, EAU:14, SAPG:15, SAPM:16, SAPD:17,
  TRONC:18, GLACE:19, MAT:20, MATH:21, PIECE:22, CACHE:23, CORAIL:24, CANON:25, CANONP:26, PIERRE:27, CHAINE:28, ALGUE:29 };
const SOLIDES = new Set([TL.SOLH, TL.SOL, TL.BRIQUE, TL.MYST, TL.USE, TL.DUR, TL.TG, TL.TD, TL.CG, TL.CD, TL.NUAGE, TL.PONT, TL.SAPG, TL.SAPM, TL.SAPD, TL.GLACE, TL.CORAIL, TL.CANON, TL.CANONP, TL.PIERRE]);
// Les caractères des motifs de blocs dans les niveaux
const MOTIFS = { b:[TL.BRIQUE], p:[TL.BRIQUE, 'pieces'], e:[TL.BRIQUE, 'etoile'], c:[TL.BRIQUE, 'pouvoir'], V:[TL.BRIQUE, 'vie'], '?':[TL.MYST, 'piece'], '!':[TL.MYST, 'pouvoir'], '*':[TL.MYST, 'etoile'],
  v:[TL.CACHE, 'vie'], h:[TL.CACHE, 'piece'], d:[TL.DUR], o:[TL.PIECE], u:[TL.USE], n:[TL.NUAGE], g:[TL.GLACE], P:[TL.PIERRE], w:[TL.CORAIL], l:[TL.LAVE], s:[TL.SOL], S:[TL.SOLH] };

/* ---------- La construction d'une zone (le niveau, ou une salle bonus) ---------- */
function construireZone(nom, opts, fn){
  const Z = { nom, theme:opts.theme || 'plaine', eau:!!opts.eau, W:opts.largeur || 220, tiles:null, contenu:new Map(), spawns:[], plateformes:[], entrees:new Map(),
    decors:[], depart:{ x:2, y:12 }, drapeau:null, boss:null, mi:null, fin:null, auto:opts.decors !== false, ciel:opts.ciel || null, textes:[] };
  Z.tiles = new Uint8Array(Z.W * ROWS);
  const set = (x, y, t) => { if(x >= 0 && x < Z.W && y >= 0 && y < ROWS) Z.tiles[y * Z.W + x] = t; };
  const B = {
    get W(){ return Z.W; },
    sol(x0, x1, h = 2, haut = true){ for(let x = x0; x <= x1; x++) for(let y = ROWS - h; y < ROWS; y++) set(x, y, y === ROWS - h && haut ? TL.SOLH : TL.SOL); },
    plafond(x0, x1, h = 1){ for(let x = x0; x <= x1; x++) for(let y = 0; y < h; y++) set(x, y, TL.BRIQUE); },
    bloc(x, y, c){ const m = MOTIFS[c]; if(!m) return; set(x, y, m[0]); if(m[1]) Z.contenu.set(y * Z.W + x, m[1]); else Z.contenu.delete(y * Z.W + x); },
    ligne(x, y, motif){ [...motif].forEach((c, i) => B.bloc(x + i, y, c)); },
    rect(x, y, w, h, c){ for(let j = 0; j < h; j++) for(let i = 0; i < w; i++) B.bloc(x + i, y + j, c); },
    escalier(x, n, sens = 1, c = 'd', bas = ROWS - 3){ for(let i = 0; i < n; i++){ const col = sens > 0 ? x + i : x + n - 1 - i; for(let k = 0; k <= i; k++) B.bloc(col, bas - k, c); } },
    tuyau(x, h, o = {}){
      const bas = o.bas ?? ROWS - 3, haut = bas - h + 1;
      set(x, haut, TL.TG); set(x + 1, haut, TL.TD);
      for(let y = haut + 1; y <= bas; y++){ set(x, y, TL.CG); set(x + 1, y, TL.CD); }
      if(o.chardon) Z.spawns.push({ type:'chardon', x:x * T + 8, y:haut * T });
      if(o.vers){ Z.entrees.set(haut * Z.W + x, o.vers); Z.entrees.set(haut * Z.W + x + 1, o.vers); }
      if(o.cote){ for(let y = haut; y <= bas; y++) Z.entrees.set(y * Z.W + x, { ...o.cote, cote:true }); }
    },
    pieces(x, y, n = 1){ for(let i = 0; i < n; i++) set(x + i, y, TL.PIECE); },
    ennemi(type, x, y = null, o = {}){ Z.spawns.push({ type, x:x * T, y:y == null ? null : y * T, ...o }); },
    sapin(x, y, w){ set(x, y, TL.SAPG); for(let i = 1; i < w - 1; i++) set(x + i, y, TL.SAPM); set(x + w - 1, y, TL.SAPD); const c = x + Math.floor(w / 2); for(let j = y + 1; j < ROWS; j++) if(!Z.tiles[j * Z.W + c]) set(c, j, TL.TRONC); },
    nuage(x, y, w){ for(let i = 0; i < w; i++) set(x + i, y, TL.NUAGE); },
    pont(x0, x1, y){ for(let x = x0; x <= x1; x++) set(x, y, TL.PONT); },
    lave(x0, x1, h = 1){ for(let x = x0; x <= x1; x++) for(let y = ROWS - h; y < ROWS; y++) set(x, y, TL.LAVE); },
    eau(x0, x1, y){ for(let x = x0; x <= x1; x++) set(x, y, TL.EAU); },
    algue(x, y){ set(x, y, TL.ALGUE); },
    plateforme(x, y, o = {}){ Z.plateformes.push({ x:x * T, y:y * T, w:(o.w || 3) * T, type:o.type || 'h', amp:(o.amp ?? 3) * T, vit:o.vit || 1, phase:o.phase ?? (o.type === 'cable' ? -Math.PI / 2 / (.006 * (o.vit || 1)) : 0), cabine:!!o.cabine }); },
    barreFeu(x, y, n = 6, sens = 1){ set(x, y, TL.USE); Z.spawns.push({ type:'barreFeu', x:x * T, y:y * T, n, sens }); },
    lavaSaut(x){ Z.spawns.push({ type:'lavaSaut', x:x * T, y:ROWS * T }); },
    canon(x, h = 1, bas = ROWS - 3){ set(x, bas - h + 1, TL.CANON); for(let y = bas - h + 2; y <= bas; y++) set(x, y, TL.CANONP); Z.spawns.push({ type:'canon', x:x * T, y:(bas - h + 1) * T }); },
    truites(x0, x1){ Z.spawns.push({ type:'truites', x:x0 * T, x1:x1 * T }); },
    drapeau(x){ for(let y = 3; y <= ROWS - 4; y++) set(x, y, TL.MAT); set(x, 2, TL.MATH); B.bloc(x, ROWS - 3, 'd'); Z.drapeau = x; Z.decors.push({ type:'refuge', x:x + 5 }); },
    boss(x0, x1, pv = 5){ B.pont(x0, x1, ROWS - 6); for(let x = x0; x <= x1; x++){ set(x, ROWS - 1, TL.LAVE); set(x, ROWS - 2, TL.LAVE); } set(x1 + 1, ROWS - 7, TL.CHAINE);
      Z.boss = { x0, x1, levier:x1 + 2 }; Z.spawns.push({ type:'yeti', x:(x1 - 4) * T, y:(ROWS - 8) * T, x0:x0 * T, x1:x1 * T, pv }); },
    fin(x, texte){ Z.fin = { x, texte }; },
    mi(x){ Z.mi = x; },
    depart(x, y = ROWS - 3){ Z.depart = { x, y }; },
    decor(type, x, y = 0, n = 1){ Z.decors.push({ type, x, y, n }); },
    texte(x, y, txt){ Z.textes.push({ x, y, txt }); },
  };
  fn(B);
  Z.spawns.sort((a, b) => a.x - b.x);
  if(Z.auto) decorsAuto(Z);
  return Z;
}
// Les décors du fond : collines, buissons, nuages, montagnes au loin (toujours les mêmes pour un niveau)
function decorsAuto(Z){
  const th = Z.theme;
  if(!['plaine', 'neige', 'nuit', 'ciel'].includes(th)) return;
  let s = Z.W * 7 + th.length * 13; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for(let x = 0; x < Z.W; x += 48){
    if(th !== 'ciel'){ Z.decors.push({ type:'colline', x:x, n:2 }, { type:'colline', x:x + 16 + Math.floor(rnd() * 4), n:1 }); }
    Z.decors.push({ type:'nuageD', x:x + 8 + Math.floor(rnd() * 3), y:2 + Math.floor(rnd() * 2), n:1 }, { type:'nuageD', x:x + 19, y:1 + Math.floor(rnd() * 2), n:3 },
      { type:'nuageD', x:x + 28 + Math.floor(rnd() * 3), y:2, n:2 }, { type:'nuageD', x:x + 37, y:1 + Math.floor(rnd() * 2), n:1 });
    if(th !== 'ciel') Z.decors.push({ type:'buisson', x:x + 11, n:3 }, { type:'buisson', x:x + 23 + Math.floor(rnd() * 3), n:1 }, { type:'buisson', x:x + 41, n:2 });
    if(th === 'neige' || th === 'plaine') Z.decors.push({ type:'sapinD', x:x + 31 + Math.floor(rnd() * 4) });
  }
}

/* ---------- La partie ---------- */
const PROG = Object.assign({ debloque:0, meilleur:0, faits:{} }, lire('pepin-progres', {}));
const sauver = () => ecrire('pepin-progres', PROG);
const etat = { mode:'titre', niv:0, vies:3, pieces:0, score:0, temps:400, tAcc:0, mi:false, minuteur:0, texte:'' };
let ZONES = null, Z = null, J = null, E = [], PARTS = [], PLATS = [], camX = 0, VW = 256, frame = 0, bumps = [];
const PH = { accMarche:.055, accCourse:.085, maxMarche:1.45, maxAuto:2.1, maxCourse:2.55, frein:.075, freinGlace:.012, derape:.17, saut:4.85, gMonte:.165, gChute:.48, maxChute:4.6 };

function preparerNiveau(i){
  const d = NIVEAUX[i];
  ZONES = { principal:construireZone('principal', { theme:d.theme, eau:d.eau, largeur:d.largeur, ciel:d.ciel }, d.construire) };
  for(const [nom, z] of Object.entries(d.zones || {})) ZONES[nom] = construireZone(nom, { theme:z.theme, eau:z.eau, largeur:z.largeur, decors:z.decors, ciel:z.ciel }, z.construire);
}
function lancerNiveau(i, garderTaille = false){
  etat.niv = i; const d = NIVEAUX[i];
  const taille = garderTaille && J ? J.taille : 0;
  preparerNiveau(i);
  etat.temps = d.temps || 400; etat.tAcc = 0;
  J = nouveauJoueur(taille);
  entrerZone('principal', etat.mi && ZONES.principal.mi ? { x:ZONES.principal.mi, y:ROWS - 3 } : null);
  etat.mode = 'intro'; etat.minuteur = 150;
  musique(null);
}
function nouveauJoueur(taille){ return { x:0, y:0, w:12, h:taille ? 28 : 15, vx:0, vy:0, dir:1, taille, sol:false, inv:0, etoile:0, anim:0, accroupi:false, combo:0, boules:0, derape:false, plat:null, grandit:0 }; }
function entrerZone(nom, pos, sortieTuyau = false){
  Z = ZONES[nom]; E = []; PARTS = []; bumps = [];
  PLATS = Z.plateformes.map(p => ({ ...p, x0:p.x, y0:p.y, dx:0, dy:0, t:p.phase, tombe:0 }));
  const p = pos || Z.depart;
  J.x = p.x * T + 2; J.y = (p.y + 1) * T - J.h; J.vx = 0; J.vy = 0; J.plat = null;
  if(sortieTuyau){ J.sortie = 32; J.y += 32; }
  camX = clamp(J.x - VW * .35, 0, Math.max(0, Z.W * T - VW));
  Z.prochain = 0;
  while(Z.prochain < Z.spawns.length && Z.spawns[Z.prochain].x < camX - 32){ Z.spawns[Z.prochain].fait = true; Z.prochain++; }
  musique(musiqueZone());
}
const musiqueZone = () => Z.eau ? 'eau' : { plaine:'plaine', ciel:'plaine', nuit:'nuit', neige:'neige', souterrain:'souterrain', glace:'souterrain', lave:'chateau', chateau:'chateau', eau:'eau' }[Z.theme] || 'plaine';

/* ---------- Les tuiles du monde ---------- */
const tuile = (x, y) => x < 0 || x >= Z.W || y < 0 || y >= ROWS ? (x < 0 || x >= Z.W ? (y >= 0 ? TL.DUR : 0) : 0) : Z.tiles[y * Z.W + x];
const solide = (x, y) => { if(y < 0) return x < 0 || x >= Z.W; if(y >= ROWS) return false; return SOLIDES.has(tuile(x, y)); };
// les nuages, les ponts et les cimes des sapins : on les traverse par en dessous et sur le côté, on se pose dessus
const UN_SENS = new Set([TL.NUAGE, TL.PONT, TL.SAPG, TL.SAPM, TL.SAPD]);
const plein = (x, y) => solide(x, y) && !UN_SENS.has(tuile(x, y));
const setT = (x, y, t) => { if(x >= 0 && x < Z.W && y >= 0 && y < ROWS) Z.tiles[y * Z.W + x] = t; };
// Déplacer un objet (joueur, ennemi, objet) dans la grille : d'abord en x, puis en y. Renvoie ce qu'il a touché.
function deplacer(o, joueur = false){
  const r = { sol:false, mur:0, plafond:null };
  o.x += o.vx;
  let y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 1) / T);
  if(o.vx > 0){ const tx = Math.floor((o.x + o.w - 1) / T); for(let ty = y0; ty <= y1; ty++) if(plein(tx, ty)){ o.x = tx * T - o.w; r.mur = 1; break; } }
  else if(o.vx < 0){ const tx = Math.floor(o.x / T); for(let ty = y0; ty <= y1; ty++) if(plein(tx, ty)){ o.x = (tx + 1) * T; r.mur = -1; break; } }
  const yAvant = o.y;
  o.y += o.vy;
  const x0 = Math.floor((o.x + 1) / T), x1 = Math.floor((o.x + o.w - 2) / T);
  if(o.vy > 0){
    const ty = Math.floor((o.y + o.h - .01) / T);
    for(let tx = x0; tx <= x1; tx++) if(solide(tx, ty) && yAvant + o.h - 1 < ty * T + 6){ o.y = ty * T - o.h; r.sol = true; o.vy = 0; break; }
  } else if(o.vy < 0){
    const ty = Math.floor(o.y / T); let best = null, bd = 99;
    for(let tx = x0; tx <= x1; tx++){
      const t = tuile(tx, ty);
      if(plein(tx, ty) || (joueur && t === TL.CACHE && yAvant >= (ty + 1) * T - 1)){ const d = Math.abs(tx * T + 8 - (o.x + o.w / 2)); if(d < bd){ bd = d; best = tx; } }
    }
    if(best != null){ o.y = (ty + 1) * T; o.vy = 0; r.plafond = { tx:best, ty }; }
  }
  return r;
}
const chevauche = (a, b, m = 0) => a.x + m < b.x + b.w && a.x + a.w - m > b.x && a.y + m < b.y + b.h && a.y + a.h - m > b.y;

/* ---------- Les entrées (manette et clavier) ---------- */
const K = { gauche:false, droite:false, bas:false, saut:false, course:false }, KA = { saut:false, course:false };
let sautPresse = false, coursePresse = false;
const clavier = { ArrowLeft:'gauche', KeyA:'gauche', ArrowRight:'droite', KeyD:'droite', ArrowDown:'bas', KeyS:'bas', Space:'saut', KeyX:'saut', ArrowUp:'saut', KeyW:'saut', KeyZ:'course', ShiftLeft:'course', ShiftRight:'course', KeyC:'course' };
const touchesClavier = new Set(), doigts = new Map();
function majEntrees(){
  for(const k of Object.keys(K)) K[k] = false;
  for(const c of touchesClavier) K[clavier[c]] = true;
  for(const t of doigts.values()) K[t] = true;
  document.querySelectorAll('#manette [data-t]').forEach(b => b.classList.toggle('on', [...doigts.values()].includes(b.dataset.t)));
}
addEventListener('keydown', e => {
  if(e.code === 'Escape' || e.code === 'KeyP'){ if(etat.mode === 'jeu') pause(); else if(!$('ePause').hidden) reprendre(); return; }
  if(clavier[e.code]){ e.preventDefault(); touchesClavier.add(e.code); majEntrees(); }
});
addEventListener('keyup', e => { if(clavier[e.code]){ touchesClavier.delete(e.code); majEntrees(); } });
const manette = $('manette');
const boutonSous = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest && el.closest('#manette [data-t]'); };
manette.addEventListener('pointerdown', e => { const b = e.target.closest('[data-t]'); if(!b) return; e.preventDefault(); doigts.set(e.pointerId, b.dataset.t); majEntrees(); audio(); });
manette.addEventListener('pointermove', e => {
  if(!doigts.has(e.pointerId)) return;
  const avant = doigts.get(e.pointerId), b = boutonSous(e.clientX, e.clientY);
  // le pouce glisse d'une flèche à l'autre (pas vers les boutons A et B, ni l'inverse)
  if(b && b.dataset.t !== avant && ['gauche', 'droite', 'bas'].includes(avant) === ['gauche', 'droite', 'bas'].includes(b.dataset.t)){ doigts.set(e.pointerId, b.dataset.t); majEntrees(); }
});
const lacher = e => { if(doigts.delete(e.pointerId)) majEntrees(); };
manette.addEventListener('pointerup', lacher); manette.addEventListener('pointercancel', lacher);
manette.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- Le son : petits bruits façon console 8 bits, et des musiques originales ---------- */
let son = lire('pepin-son', true), musOn = lire('pepin-musique', true), AC = null, MAITRE = null;
function audio(){
  if(!son && !musOn) return null;
  try{ if(!AC){ AC = new (window.AudioContext || window.webkitAudioContext)(); MAITRE = AC.createGain(); MAITRE.gain.value = .5; MAITRE.connect(AC.destination); }
    if(AC.state === 'suspended') AC.resume(); return AC; }catch(e){ return null; }
}
function note(f, d, { type = 'square', vol = .06, glisse = 0, delai = 0, dest = null } = {}){
  const ac = audio(); if(!ac) return;
  const t = ac.currentTime + delai, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + glisse), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(dest || MAITRE); o.start(t); o.stop(t + d + .02);
}
function bruit(d, vol = .1){
  const ac = audio(); if(!ac) return;
  const n = Math.floor(ac.sampleRate * d), buf = ac.createBuffer(1, n, ac.sampleRate), x = buf.getChannelData(0);
  for(let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(MAITRE); s.start();
}
const SON = {
  saut:() => son && note(320, .18, { glisse:420, vol:.05 }), petitSaut:() => son && note(400, .14, { glisse:300, vol:.045 }),
  piece:() => son && (note(988, .07, { vol:.05 }), note(1319, .25, { vol:.05, delai:.07 })),
  bump:() => son && note(110, .1, { type:'triangle', vol:.15, glisse:-40 }), casse:() => son && (bruit(.18, .14), note(150, .12, { type:'triangle', vol:.1, glisse:-90 })),
  ecrase:() => son && note(260, .1, { glisse:-180, vol:.06 }), coup:() => son && (note(180, .08, { vol:.06 }), note(120, .1, { vol:.06, delai:.06 })),
  pouvoir:() => son && [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => note(f, .07, { vol:.045, delai:i * .045 })),
  apparait:() => son && [392, 494, 587, 784].forEach((f, i) => note(f, .06, { vol:.04, delai:i * .05, type:'triangle' })),
  retrecit:() => son && [784, 587, 494, 392, 294].forEach((f, i) => note(f, .07, { vol:.045, delai:i * .06 })),
  vie:() => son && [659, 784, 1319, 1047, 1175, 1568].forEach((f, i) => note(f, .09, { vol:.05, delai:i * .08 })),
  feu:() => son && note(700, .06, { glisse:-400, vol:.04 }), tuyau:() => son && [0, 1, 2].forEach(i => note(220, .1, { glisse:-120, vol:.06, delai:i * .12 })),
  mort:() => son && [494, 698, 698, 698, 659, 587, 523, 330, 262].forEach((f, i) => note(f, .12, { vol:.05, delai:.35 + i * .13 })),
  drapeau:() => son && note(1200, .9, { glisse:-900, vol:.04 }), nage:() => son && note(500, .08, { glisse:200, vol:.03, type:'triangle' }),
  fin:() => son && [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => note(f, .14, { vol:.05, delai:i * .13 })),
  tic:() => son && note(1500, .04, { vol:.03 }), boss:() => son && (note(90, .3, { type:'sawtooth', vol:.08, glisse:-40 })),
};
// La musique : quelques mesures originales par décor, jouées en boucle (mélodie et basse)
const MUSIQUES = {
  plaine:{ tempo:150, m:[76, 79, 81, 79, 76, 72, 74, 76, 79, 0, 77, 76, 74, 0, 0, 0, 72, 74, 76, 77, 79, 81, 79, 77, 76, 74, 72, 74, 72, 0, 0, 0], b:[48, 0, 55, 0, 48, 0, 55, 0, 53, 0, 60, 0, 55, 0, 59, 0, 48, 0, 55, 0, 53, 0, 57, 0, 55, 0, 50, 0, 48, 0, 43, 0] },
  souterrain:{ tempo:118, m:[57, 0, 60, 0, 64, 0, 62, 60, 57, 0, 55, 0, 57, 0, 0, 0, 60, 0, 64, 0, 67, 0, 65, 64, 62, 0, 60, 0, 59, 0, 0, 0], b:[33, 0, 40, 0, 33, 0, 40, 0, 31, 0, 38, 0, 33, 0, 40, 0, 36, 0, 43, 0, 34, 0, 41, 0, 35, 0, 40, 0, 33, 0, 0, 0] },
  chateau:{ tempo:112, m:[62, 63, 62, 0, 65, 64, 62, 0, 61, 62, 61, 0, 58, 0, 0, 0, 62, 63, 66, 0, 65, 64, 61, 0, 62, 0, 57, 0, 58, 0, 0, 0], b:[38, 38, 0, 38, 38, 0, 37, 0, 38, 38, 0, 38, 34, 0, 33, 0] },
  eau:{ tempo:132, m:[72, 0, 76, 79, 0, 76, 77, 0, 74, 72, 0, 0, 69, 0, 72, 76, 0, 72, 74, 0, 71, 72, 0, 0], b:[48, 0, 55, 48, 0, 55, 43, 0, 50, 48, 0, 55, 45, 0, 52, 48, 0, 52, 43, 0, 50, 48, 0, 0] },
  neige:{ tempo:140, m:[84, 79, 76, 79, 84, 86, 84, 79, 81, 77, 72, 77, 81, 83, 81, 77, 79, 76, 72, 76, 79, 81, 79, 76, 74, 79, 77, 74, 72, 0, 0, 0], b:[48, 0, 52, 0, 55, 0, 52, 0, 53, 0, 57, 0, 60, 0, 57, 0, 52, 0, 55, 0, 48, 0, 55, 0, 43, 0, 50, 0, 48, 0, 0, 0] },
  nuit:{ tempo:126, m:[69, 72, 76, 74, 72, 69, 71, 72, 74, 0, 72, 71, 69, 0, 0, 0, 67, 69, 72, 71, 69, 67, 64, 67, 69, 0, 0, 0, 0, 0, 0, 0], b:[45, 0, 52, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0, 45, 0, 52, 0, 41, 0, 48, 0, 40, 0, 47, 0, 45, 0, 0, 0] },
  etoile:{ tempo:200, m:[72, 72, 72, 0, 72, 0, 74, 72, 74, 74, 74, 0, 74, 0, 76, 74], b:[48, 0, 55, 0, 48, 0, 55, 0, 50, 0, 57, 0, 50, 0, 57, 0] },
};
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
let musCourante = null, musPas = 0, musT = 0, musMinuteur = 0, musGain = null;
function musique(nom){
  musCourante = nom; musPas = 0;
  if(!nom || !musOn) return;
  const ac = audio(); if(!ac) return;
  if(!musGain){ musGain = ac.createGain(); musGain.gain.value = .5; musGain.connect(MAITRE); }
  musT = ac.currentTime + .05;
  clearInterval(musMinuteur); musMinuteur = setInterval(planifier, 90);
}
function planifier(){
  if(!musCourante || !musOn || !AC || etat.mode === 'pause') return;
  const M = MUSIQUES[musCourante], croche = 60 / M.tempo / 2;
  while(musT < AC.currentTime + .3){
    const m = M.m[musPas % M.m.length], b = M.b[musPas % M.b.length], d = musT - AC.currentTime;
    if(m) note(hz(m), croche * .9, { vol:.035, delai:d, dest:musGain });
    if(b) note(hz(b), croche * .9, { vol:.05, delai:d, type:'triangle', dest:musGain });
    musPas++; musT += croche;
  }
}

/* ---------- Le joueur ---------- */
function setTaille(n){ const h = n ? 28 : 15; J.y += J.h - h; J.h = h; J.taille = n; }
function grandir(type){
  if(type === 'cepe'){ if(J.taille === 0){ setTaille(1); J.grandit = 50; SON.pouvoir(); } else SON.pouvoir(); points(1000, J.x, J.y); }
  else if(type === 'piment'){ if(J.taille === 0){ setTaille(1); } J.taille = 2; J.grandit = 50; SON.pouvoir(); points(1000, J.x, J.y); }
  else if(type === 'etoile'){ J.etoile = 600; SON.pouvoir(); points(1000, J.x, J.y); musique('etoile'); }
  else if(type === 'coeur'){ etat.vies++; SON.vie(); texte('1 VIE', J.x, J.y); }
}
function blesser(){
  if(J.inv > 0 || J.etoile > 0 || etat.mode !== 'jeu') return;
  if(J.taille > 0){ setTaille(0); J.inv = 130; J.grandit = -40; SON.retrecit(); }
  else mourir();
}
function mourir(){
  if(etat.mode === 'mort') return;
  etat.mode = 'mort'; etat.minuteur = 190; J.vx = 0; J.vy = -5; J.mortT = 0; setTaille(0); J.etoile = 0;
  musique(null); SON.mort();
}
function majJoueur(){
  const eau = Z.eau;
  if(J.grandit){ J.grandit += J.grandit > 0 ? -1 : 1; return; }   // le temps s'arrête pendant qu'il grandit ou rapetisse
  if(J.sortie > 0){ J.sortie--; J.y -= 1; return; }
  if(J.inv > 0) J.inv--;
  if(J.etoile > 0){ J.etoile--; if(J.etoile === 0) musique(musiqueZone()); }
  // s'accroupir (grand) ; se relever s'il y a la place
  const voulu = J.taille > 0 && K.bas && J.sol && !eau;
  if(voulu && !J.accroupi){ J.accroupi = true; J.y += J.h - 15; J.h = 15; }
  else if(!voulu && J.accroupi){ const libre = !plein(Math.floor((J.x + 1) / T), Math.floor((J.y - 13) / T)) && !plein(Math.floor((J.x + J.w - 2) / T), Math.floor((J.y - 13) / T)); if(libre){ J.accroupi = false; J.y -= 28 - J.h; J.h = 28; } }
  // marcher, courir, déraper ; sur la glace, on glisse
  const dessous = tuile(Math.floor((J.x + J.w / 2) / T), Math.floor((J.y + J.h + 1) / T)), glace = J.sol && dessous === TL.GLACE;
  let dir = (K.droite ? 1 : 0) - (K.gauche ? 1 : 0); if(J.accroupi) dir = 0;
  // la course se fait toute seule : en gardant le doigt sur la flèche, Pépin prend de l'élan (B le fait courir encore plus vite)
  if(!dir || (J.sol && Math.sign(J.vx) === -dir)) J.elan = 0; else if(J.sol) J.elan = Math.min(60, (J.elan || 0) + 1);
  const auto = J.elan > 30;
  const max = eau ? 1.1 : K.course ? PH.maxCourse : auto ? PH.maxAuto : PH.maxMarche, acc = (eau ? .04 : K.course || auto ? PH.accCourse : PH.accMarche) * (glace ? .4 : 1);
  J.derape = false;
  if(dir){
    if(Math.sign(J.vx) === -dir && J.sol && !eau){ J.vx += dir * PH.derape * (glace ? .2 : 1); J.derape = Math.abs(J.vx) > .4; }
    else { const avant = Math.abs(J.vx); J.vx += dir * acc; if(Math.abs(J.vx) > max) J.vx = Math.sign(J.vx) * Math.max(max, Math.min(Math.abs(J.vx), avant - .06)); }
    if(J.sol || eau || Math.abs(J.vx) < .2) J.dir = dir;
    if(Math.abs(J.vx) > max) J.vx = Math.sign(J.vx) * Math.max(max, Math.abs(J.vx) - .06);
  } else if(J.sol){ const f = glace ? PH.freinGlace : J.accroupi ? .1 : PH.frein; J.vx = Math.abs(J.vx) <= f ? 0 : J.vx - Math.sign(J.vx) * f; }
  // sauter (ou nager)
  if(eau){
    if(sautPresse){ J.vy = -2.1; SON.nage(); }
    J.vy = Math.min(J.vy + .07, 1.5); if(J.y < 2 * T && J.vy < 0) J.vy = .5;
  } else {
    // un saut demandé juste avant de toucher le sol, ou juste après avoir quitté un bord, compte quand même
    J.tampon = sautPresse ? 7 : Math.max(0, (J.tampon || 0) - 1); J.coyote = J.sol ? 6 : Math.max(0, (J.coyote || 0) - 1);
    if(J.tampon && (J.sol || J.coyote) && J.vy >= 0){ J.vy = -(PH.saut + Math.abs(J.vx) * .15); J.sol = false; J.plat = null; J.tampon = 0; J.coyote = 0; J.taille ? SON.saut() : SON.petitSaut(); }
    J.vy = Math.min(J.vy + (J.vy < 0 && K.saut ? PH.gMonte : PH.gChute), PH.maxChute);
  }
  // boules de feu (avec le piment)
  if(coursePresse && J.taille === 2 && !J.accroupi && E.filter(e => e.type === 'boule').length < 2){
    E.push({ type:'boule', x:J.x + (J.dir > 0 ? J.w : -8), y:J.y + 8, w:8, h:8, vx:J.dir * 4, vy:2.5, t:0 }); SON.feu(); J.lance = 8;
  }
  if(J.lance) J.lance--;
  // se déplacer, dans la grille et sur les plateformes
  const r = deplacer(J, true);
  J.sol = r.sol;
  if(r.plafond){ frapperBloc(r.plafond.tx, r.plafond.ty); J.vy = 1; }
  surPlateformes();
  if(J.sol){ J.combo = 0; }
  // le joueur ne revient pas en arrière (la caméra avance seulement)
  if(J.x < camX){ J.x = camX; if(J.vx < 0) J.vx = 0; }
  // les pièces dans le niveau
  for(let ty = Math.floor(J.y / T); ty <= Math.floor((J.y + J.h - 1) / T); ty++) for(let tx = Math.floor(J.x / T); tx <= Math.floor((J.x + J.w - 1) / T); tx++){
    const t = tuile(tx, ty);
    if(t === TL.PIECE){ setT(tx, ty, TL.VIDE); piece(); points(200, null); }
    if(t === TL.LAVE && J.y + J.h > ty * T + 6) mourir();
  }
  if(J.y > HAUT + 16) mourir();
  // entrer dans un tuyau (vers le bas, ou sur le côté)
  if(K.bas && J.sol){
    const tx = Math.floor((J.x + J.w / 2) / T), ty = Math.floor((J.y + J.h + 2) / T), v = Z.entrees.get(ty * Z.W + tx);
    const bord = (J.x + J.w / 2) - tx * T, gauche = tuile(tx, ty) === TL.TG;
    if(v && !v.cote && (gauche ? bord > 4 : bord < 12)) return entrerTuyau(v, 'bas');
  }
  if(r.mur === 1 && K.droite && (J.sol || Z.eau)){
    const tx = Math.floor((J.x + J.w + 1) / T), ty = Math.floor((J.y + J.h - 2) / T), v = Z.entrees.get(ty * Z.W + tx);
    if(v && v.cote) return entrerTuyau(v, 'cote');
  }
  // le drapeau, le levier du château, la fin d'une zone
  if(Z.drapeau != null && J.x + J.w > Z.drapeau * T + 7 && etat.mode === 'jeu') return debutDrapeau();
  if(Z.boss && J.x + J.w > Z.boss.levier * T + 2) return debutLevier();
  if(Z.fin && J.x > Z.fin.x * T) return niveauFini(Z.fin.texte);
  if(Z.mi != null && J.x > Z.mi * T) etat.mi = true;
  // l'animation
  J.anim += Math.abs(J.vx) * .14 + (eau ? .08 : 0);
}
// Les plateformes mobiles : on monte dessus, on bouge avec elles
function surPlateformes(){
  J.plat = null;
  if(J.vy < 0) return;
  for(const p of PLATS){
    const pied = J.y + J.h;
    if(J.x + J.w > p.x + 1 && J.x < p.x + p.w - 1 && pied >= p.y - 1 && pied <= p.y + 6 + Math.max(0, p.dy) + J.vy){
      J.y = p.y - J.h; J.vy = 0; J.sol = true; J.plat = p;
      if(p.type === 'chute') p.tombe = 1;
      return;
    }
  }
}
function majPlateformes(){
  for(const p of PLATS){
    const ax = p.x, ay = p.y; p.t += 1;
    const v = p.vit;
    if(p.type === 'h') p.x = p.x0 + Math.sin(p.t * .015 * v) * p.amp;
    else if(p.type === 'v') p.y = p.y0 + Math.sin(p.t * .015 * v) * p.amp;
    else if(p.type === 'monte'){ p.y -= .9 * v; if(p.y < -16) p.y = HAUT + 8; }
    else if(p.type === 'descend'){ p.y += .9 * v; if(p.y > HAUT + 8) p.y = -16; }
    else if(p.type === 'chute' && p.tombe){ p.tombe += 1; if(p.tombe > 20) p.y += Math.min(4, (p.tombe - 20) * .15); }
    else if(p.type === 'cable'){ const u = (Math.sin(p.t * .006 * v) + 1) / 2; p.x = p.x0 + u * p.amp; p.y = p.y0 - u * p.amp * .35; }
    p.dx = p.x - ax; p.dy = p.y - ay;
    if(J.plat === p){ J.x += p.dx; J.y = p.y - J.h; }
  }
}

/* ---------- Les blocs ---------- */
function frapperBloc(tx, ty){
  const t = tuile(tx, ty), cle = ty * Z.W + tx, c = Z.contenu.get(cle);
  if(![TL.BRIQUE, TL.MYST, TL.CACHE].includes(t)){ SON.bump(); return; }
  bumps.push({ tx, ty, t:0 });
  // les ennemis posés sur le bloc tombent
  for(const e of E) if(e.ennemi && !e.mort && e.y + e.h >= ty * T - 2 && e.y + e.h <= ty * T + 2 && e.x + e.w > tx * T && e.x < tx * T + T) renverser(e, 100);
  for(const e of E) if((e.type === 'cepe' || e.type === 'coeur' || e.type === 'etoile') && !e.emerge && e.y + e.h >= ty * T - 2 && e.y + e.h <= ty * T + 2 && e.x + e.w > tx * T && e.x < tx * T + T){ e.vy = -3.5; e.vx = (e.x + e.w / 2 < tx * T + 8 ? -1 : 1) * Math.abs(e.vx || 1); }
  if(t === TL.BRIQUE && !c){
    if(J.taille > 0){ setT(tx, ty, TL.VIDE); bumps.pop(); casser(tx, ty); points(50, null); SON.casse(); }
    else SON.bump();
    return;
  }
  if(t === TL.BRIQUE && c === 'pieces'){
    Z.multi = Z.multi || {}; const m = Z.multi[cle] = Z.multi[cle] || { n:0, t0:frame };
    m.n++; pieceVolante(tx, ty);
    if(m.n >= 10 || frame - m.t0 > 300){ setT(tx, ty, TL.USE); Z.contenu.delete(cle); }
    return;
  }
  setT(tx, ty, TL.USE); Z.contenu.delete(cle);
  if(!c || c === 'piece') pieceVolante(tx, ty);
  else objet(c === 'pouvoir' ? (J.taille === 0 ? 'cepe' : 'piment') : c === 'vie' ? 'coeur' : c, tx, ty);
}
function casser(tx, ty){
  const th = tuilesDe(Z.theme), c1 = SP.THEMES[Z.theme].brique[0], c2 = SP.THEMES[Z.theme].brique[1];
  for(const [dx, dy, vx, vy] of [[0, 0, -1.2, -5], [8, 0, 1.2, -5], [0, 8, -1, -3.5], [8, 8, 1, -3.5]]) PARTS.push({ type:'debris', x:tx * T + dx, y:ty * T + dy, vx, vy, img:SP.objets.morceau(c1, c2), vie:90 });
}
function pieceVolante(tx, ty){ PARTS.push({ type:'pieceVol', x:tx * T, y:ty * T - 16, vy:-5, vie:32 }); piece(); points(200, null); }
function piece(){ etat.pieces++; SON.piece(); if(etat.pieces >= 100){ etat.pieces -= 100; etat.vies++; SON.vie(); texte('1 VIE', J.x, J.y - 10); } }
function objet(type, tx, ty){ E.push({ type, x:tx * T, y:ty * T, w:16, h:16, vx:0, vy:0, emerge:16, objet:true }); SON.apparait(); }
const COMBO = [100, 200, 400, 500, 800, 1000, 2000, 4000, 5000, 8000];
function points(n, x, y){ etat.score += n; if(x != null) texte(String(n), x, y); }
function texte(t, x, y){ PARTS.push({ type:'texte', txt:t, x, y, vie:45 }); }

/* ---------- Les ennemis et les objets ---------- */
function creer(s){
  const sol = s.y == null;
  const base = { ...s, x:s.x, y:sol ? (ROWS - 3) * T : s.y, w:14, h:16, vx:0, vy:0, t:0, dir:-1, ennemi:true };
  switch(s.type){
    case 'marmotton': case 'herisson': case 'herissonRouge': case 'scarabee': base.y = sol ? (ROWS - 3) * T : s.y; base.vx = -.5; base.x += 1; break;
    case 'choucas': base.base = base.y; base.vx = -.75; base.vol = true; break;
    case 'chardon': base.y = s.y; base.cache = 24; base.phase = 0; base.x = s.x - 7; base.y0 = s.y; base.h = 24; base.w = 14; break;
    case 'bouleNeige': base.vol = true; break;
    case 'canon': case 'truites': base.ennemi = false; base.ctrl = true; base.t = 60; break;
    case 'barreFeu': base.ennemi = false; base.feu = true; base.ang = 0; break;
    case 'lavaSaut': base.ennemi = false; base.feu = true; base.w = 14; base.h = 14; base.y = HAUT + 10; base.t = Math.floor(Math.random() * 120); break;
    case 'truite': base.vol = true; break;
    case 'yeti': base.w = 28; base.h = 30; base.vx = -.5; base.pv = s.pv || 5; base.boss = true; base.y = s.y; break;
  }
  return base;
}
function renverser(e, n = 100){ if(e.mort) return; e.mort = 'renverse'; e.vy = -3; e.vx = (e.x < J.x ? -1 : 1) * .8; points(n, e.x, e.y); SON.coup(); }
function ecraser(e){
  J.combo++; const n = COMBO[Math.min(J.combo - 1, COMBO.length - 1)]; points(n, e.x, e.y - 4);
  J.vy = K.saut ? -5.2 : -3.4; SON.ecrase();
  if(e.type === 'herisson' || e.type === 'herissonRouge' || e.type === 'scarabee'){ e.boule = true; e.vx = 0; e.reveil = 420; e.h = 14; e.y += 2; return; }
  if(e.type === 'marmotton'){ e.mort = 'plat'; e.t = 0; e.vx = 0; return; }
  e.mort = 'renverse'; e.vy = 0; e.vx = 0;
}
function majEntites(){
  // apparition des ennemis quand l'écran arrive
  while(Z.prochain < Z.spawns.length && Z.spawns[Z.prochain].x < camX + VW + 24){ const s = Z.spawns[Z.prochain++]; if(!s.fait){ s.fait = true; E.push(creer(s)); } }
  for(const e of E){
    if(e.retire) continue;
    e.t++;
    if(e.mort === 'renverse'){ e.vy += .3; e.y += e.vy; e.x += e.vx; if(e.y > HAUT + 32) e.retire = true; continue; }
    if(e.mort === 'plat'){ if(e.t > 30) e.retire = true; continue; }
    if(e.x < camX - 64 && !e.ctrl && !e.feu && e.type !== 'chardon') { e.retire = true; continue; }
    if(e.x > camX + VW + 64 && e.ennemi && !e.boss) continue;     // en attente, hors de l'écran
    COMP[e.type] ? COMP[e.type](e) : null;
    if(e.retire || e.mort) continue;
    // contact avec le joueur
    if(etat.mode !== 'jeu' || J.grandit) continue;
    if(e.feu){ if(toucheFeu(e)) blesser(); continue; }
    if(e.objet){ if(!e.emerge && chevauche(J, e)){ e.retire = true; grandir(e.type); } continue; }
    if(!e.ennemi || e.cache >= 20) continue;
    if(!chevauche(J, e, 2)) continue;
    if(J.etoile > 0){ renverser(e, 200); continue; }
    if(e.boule && e.vx === 0){ e.vx = (J.x + J.w / 2 < e.x + e.w / 2 ? 1 : -1) * 3.2; e.x += e.vx * 3; e.lance = 12; points(400, e.x, e.y); SON.coup(); continue; }
    const tombe = J.vy > 0 && J.y + J.h - e.y < 10;
    if(tombe && !e.pique && e.type !== 'chardon' && !e.boss && e.type !== 'lavaSaut'){ if(e.boule){ e.vx = 0; e.reveil = 420; J.vy = -3.4; SON.ecrase(); } else ecraser(e); continue; }
    if(e.boule && e.lance > 0) continue;
    blesser();
  }
  // la boule (hérisson, carapace) lancée renverse les autres ennemis
  for(const b of E) if(b.boule && b.vx && !b.mort) for(const e of E) if(e !== b && e.ennemi && !e.mort && !e.boss && chevauche(b, e)){ renverser(e, 500); }
  // les boules de feu
  for(const f of E) if(f.type === 'boule' && !f.retire) for(const e of E) if(e.ennemi && !e.mort && !e.retire && chevauche(f, e) && !(e.cache >= 20)){
    if(e.type === 'scarabee' || e.type === 'lavaSaut'){ f.retire = true; explosion(f); break; }
    if(e.boss){ e.pv--; e.touche = 20; f.retire = true; explosion(f); SON.boss(); if(e.pv <= 0){ renverser(e, 5000); } break; }
    renverser(e, 200); f.retire = true; explosion(f); break;
  }
  E = E.filter(e => !e.retire);
}
const explosion = f => PARTS.push({ type:'explosion', x:f.x - 4, y:f.y - 4, vie:12 });
function toucheFeu(e){
  if(e.type === 'barreFeu'){ for(const [x, y] of boulesBarre(e)) if(Math.abs(J.x + J.w / 2 - x) < J.w / 2 + 3 && Math.abs(J.y + J.h / 2 - y) < J.h / 2 + 3) return true; return false; }
  return chevauche(J, e, 2);
}
const boulesBarre = e => Array.from({ length:e.n }, (_, i) => [e.x + 8 + Math.cos(e.ang) * i * 8, e.y + 8 + Math.sin(e.ang) * i * 8]);
// marcher (tourner contre un mur ; le hérisson rouge fait demi-tour au bord du vide)
function marcheur(e){
  if(e.boule){
    if(e.vx === 0){ if(--e.reveil <= 0){ e.boule = false; e.h = 16; e.y -= 2; e.vx = e.dir * .5; } }
    if(e.lance > 0) e.lance--;
  } else e.vx = Math.sign(e.vx || e.dir) * .5;
  e.vy = Math.min(e.vy + .3, 4);
  const r = deplacer(e);
  if(r.mur){ e.vx = -e.vx; e.dir = Math.sign(e.vx) || e.dir; if(e.boule && e.vx && e.x > camX - 16 && e.x < camX + VW) SON.bump(); }
  if(e.type === 'herissonRouge' && r.sol && !e.boule){ const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1; if(!solide(Math.floor(fx / T), Math.floor((e.y + e.h + 2) / T))){ e.vx = -e.vx; } }
  if(e.vx) e.dir = Math.sign(e.vx);
  if(e.y > HAUT + 16) e.retire = true;
}
const COMP = {
  marmotton:marcheur, herisson:marcheur, herissonRouge:marcheur, scarabee:marcheur,
  choucas(e){ e.x += e.vx; e.y = e.base + Math.sin(e.t * .05) * 22; },
  bouleNeige(e){ e.x += e.vx; if(e.x < camX - 40 || e.x > camX + VW + 40) e.retire = true; },
  truite(e){ if(Z.eau){ e.x += e.vx; e.y = e.base + Math.sin(e.t * .04) * 10; } else { e.vy += .12; e.x += e.vx; e.y += e.vy; if(e.y > HAUT + 20) e.retire = true; } },
  chardon(e){
    // il sort du tuyau, attend, rentre ; il ne sort pas si Pépin est tout près ou sur le tuyau
    const c = 220, ph = e.t % c, pres = Math.abs(J.x + J.w / 2 - (e.x + 7)) < 30;
    if(ph < 40) e.cache = Math.max(0, 24 - ph * .6); else if(ph < 110) e.cache = 0; else if(ph < 150) e.cache = Math.min(24, (ph - 110) * .6); else { e.cache = 24; if(pres) e.t -= 1; }
    e.y = e.y0 - 24 + e.cache; e.h = 24 - e.cache;
  },
  canon(e){ if(--e.t > 0) return; e.t = 180 + Math.floor(Math.random() * 120); const dx = J.x - e.x; if(Math.abs(dx) < 40 || e.x < camX - 16 || e.x > camX + VW + 16) return;
    const d = Math.sign(dx); E.push({ type:'bouleNeige', x:e.x + (d > 0 ? 16 : -16), y:e.y + 1, w:14, h:14, vx:d * 1.3, vy:0, t:0, dir:d, ennemi:true, vol:true }); SON.bump(); },
  truites(e){ if(J.x < e.x - 40 || J.x > e.x1) return; if(--e.t > 0) return; e.t = 70 + Math.floor(Math.random() * 60);
    E.push({ type:'truite', x:camX + VW * (.5 + Math.random() * .5), y:HAUT, w:14, h:12, vx:-(.8 + Math.random() * .6), vy:-(6.2 + Math.random() * 1.2), t:0, dir:-1, ennemi:true, vol:true }); },
  barreFeu(e){ e.ang += .03 * (e.sens || 1); },
  lavaSaut(e){ if(e.y >= HAUT + 10){ e.vy = 0; if(--e.t <= 0){ e.vy = -6.4; e.t = 120 + Math.floor(Math.random() * 90); } } else { e.vy += .14; } e.y = Math.min(HAUT + 10, e.y + e.vy); },
  yeti(e){
    if(e.touche) e.touche--;
    e.vy = Math.min(e.vy + .3, 4);
    if(e.t % 140 === 0 && Math.abs(J.x - e.x) < VW){ const d = J.x < e.x ? -1 : 1; E.push({ type:'bouleNeige', x:e.x + (d > 0 ? 28 : -14), y:e.y + 8, w:14, h:14, vx:d * 1.6, vy:0, t:0, dir:d, ennemi:true, vol:true }); }
    if(e.t % 200 === 100 && e.sol) e.vy = -4.5;
    if(e.x < e.x0 + 16) e.vx = .5; if(e.x > e.x1 - 32) e.vx = -.5;
    const r = deplacer(e); e.sol = r.sol; if(r.mur) e.vx = -e.vx;
    e.dir = J.x < e.x ? -1 : 1;
    if(e.y > HAUT + 20) e.retire = true;
  },
  boule(e){ e.vy = Math.min(e.vy + .35, 4); const r = deplacer(e); if(r.sol) e.vy = -2.8; if(r.mur){ e.retire = true; explosion(e); } if(e.x < camX - 16 || e.x > camX + VW + 16 || e.y > HAUT) e.retire = true; },
  cepe:objetMarche, coeur:objetMarche, piment(e){ if(e.emerge){ e.emerge--; e.y -= 1; } },
  etoile(e){ if(e.emerge){ e.emerge--; e.y -= 1; if(!e.emerge){ e.vx = 1.1; e.vy = -3; } return; } e.vy = Math.min(e.vy + .2, 4); const r = deplacer(e); if(r.sol) e.vy = -4; if(r.mur) e.vx = -e.vx; if(e.y > HAUT) e.retire = true; },
};
function objetMarche(e){
  if(e.emerge){ e.emerge--; e.y -= 1; if(!e.emerge) e.vx = 1; return; }
  e.vy = Math.min(e.vy + .3, 4); const r = deplacer(e); if(r.mur) e.vx = -e.vx; if(e.y > HAUT) e.retire = true;
}
function majParticules(){
  for(const p of PARTS){
    p.vie--;
    if(p.type === 'debris'){ p.vy += .3; p.x += p.vx; p.y += p.vy; }
    if(p.type === 'pieceVol'){ p.vy += .35; p.y += p.vy; if(p.vie === 1) texte('200', p.x, p.y); }
    if(p.type === 'texte'){ p.y -= .6; }
  }
  PARTS = PARTS.filter(p => p.vie > 0);
  for(const b of bumps) b.t++;
  bumps = bumps.filter(b => b.t < 10);
}

/* ---------- Les tuyaux, le drapeau, le château ---------- */
function entrerTuyau(v, sens){
  etat.mode = 'tuyau'; etat.minuteur = 50; etat.tuyau = { v, sens }; J.vx = 0; SON.tuyau();
}
function finTuyau(){
  const { v } = etat.tuyau;
  if(v.fin){ return niveauFini(); }
  entrerZone(v.zone, { x:v.x, y:v.y }, !!v.monte);
  etat.mode = 'jeu';
}
function debutDrapeau(){
  etat.mode = 'drapeau'; etat.drapeau = { phase:0, hauteur:J.y, flagY:3 * T + 2 };
  J.x = Z.drapeau * T + 8 - J.w; J.vx = 0; J.vy = 0; musique(null); SON.drapeau();
  const h = (ROWS - 3) * T - (J.y + J.h);
  points(h > 150 ? 5000 : h > 110 ? 2000 : h > 70 ? 800 : h > 30 ? 400 : 100, J.x - 10, J.y);
}
function majDrapeau(){
  const d = etat.drapeau, bas = (ROWS - 3) * T;
  if(d.phase === 0){
    if(J.y + J.h < bas){ J.y = Math.min(bas - J.h, J.y + 2.2); }
    if(d.flagY < bas - 16) d.flagY += 2.2;
    if(J.y + J.h >= bas && d.flagY >= bas - 16){ d.phase = 1; d.t = 20; J.x += 12; J.dir = -1; }
  } else if(d.phase === 1){ if(--d.t <= 0){ d.phase = 2; J.dir = 1; SON.fin(); } }
  else if(d.phase === 2){
    J.vx = 1.2; J.vy = Math.min(J.vy + .4, 4); const r = deplacer(J); J.sol = r.sol; J.anim += .17;
    const porte = (Z.drapeau + 7) * T + 4;
    if(J.x >= porte){ d.phase = 3; J.cache = true; }
  } else if(d.phase === 3){
    // le temps restant devient des points
    if(etat.temps > 0){ const n = Math.min(etat.temps, 3); etat.temps -= n; etat.score += n * 50; if(frame % 3 === 0) SON.tic(); }
    else { d.phase = 4; d.t = 70; }
  } else if(d.phase === 4){ if(--d.t <= 0) niveauFini(); }
}
function debutLevier(){
  etat.mode = 'levier'; etat.levier = { t:0, x:Z.boss.x1 }; musique(null); J.vx = 0;
  for(const e of E) if(e.type === 'bouleNeige') e.retire = true;
}
function majLevier(){
  const L = etat.levier; L.t++;
  // le pont s'effondre, du levier vers le Yéti
  if(L.t % 4 === 0 && L.x >= Z.boss.x0){ setT(L.x, ROWS - 6, TL.VIDE); L.x--; SON.bump(); }
  for(const e of E) if(e.boss && !e.mort){ e.vy = Math.min(e.vy + .3, 4); deplacer(e); if(e.y > HAUT) { e.retire = true; points(5000, e.x, HAUT - 40); } }
  if(L.x < Z.boss.x0 && L.t > 60){ etat.mode = 'chateauFin'; etat.minuteur = 0; SON.fin(); setT(Z.boss.x1 + 1, ROWS - 7, TL.VIDE); }
}
function majChateauFin(){
  etat.minuteur++;
  if(etat.minuteur < 200){ J.vx = 1; J.vy = Math.min(J.vy + .4, 4); const r = deplacer(J); J.sol = r.sol; J.anim += .14; if(J.x > camX + VW * .6) camX = Math.min(camX + 1, Z.W * T - VW); }
  else if(etat.temps > 0){ const n = Math.min(etat.temps, 3); etat.temps -= n; etat.score += n * 50; if(frame % 3 === 0) SON.tic(); }
  else if(etat.minuteur > 260) niveauFini();
}
function niveauFini(){
  const i = etat.niv;
  PROG.faits[NIVEAUX[i].id] = true;
  PROG.debloque = Math.max(PROG.debloque, Math.min(NIVEAUX.length - 1, i + 1));
  PROG.meilleur = Math.max(PROG.meilleur, etat.score); sauver();
  etat.mi = false;
  if(i >= NIVEAUX.length - 1){ etat.mode = 'victoire'; musique(null); return finEcran('BRAVO PÉPIN !', `Tu as libéré toute la vallée ! Score : ${etat.score} points.`, 'Rejouer depuis le début', () => commencer(0)); }
  const fini = NIVEAUX[i];
  if(fini.id.endsWith('-4')) return finEcran(`MONDE ${fini.id[0]} TERMINÉ`, NIVEAUX[i].merci || 'Merci Pépin ! Mais le Yéti a filé vers le monde suivant…', 'Monde suivant ▶', () => lancerNiveau(i + 1, true));
  lancerNiveau(i + 1, true);
}

/* ---------- La boucle ---------- */
function maj(){
  frame++;
  sautPresse = K.saut && !KA.saut; coursePresse = K.course && !KA.course; KA.saut = K.saut; KA.course = K.course;
  if(etat.mode === 'intro'){ if(--etat.minuteur <= 0){ etat.mode = 'jeu'; musique(musiqueZone()); } return; }
  if(etat.mode === 'mort'){
    J.mortT++; if(J.mortT > 30){ J.vy += .25; J.y += J.vy; }
    if(--etat.minuteur <= 0){ etat.vies--; if(etat.vies <= 0) return finEcran('PARTIE TERMINÉE', `Score : ${etat.score} points.`, 'Recommencer ce niveau', () => commencer(etat.niv)); lancerNiveau(etat.niv); }
    return;
  }
  if(etat.mode === 'tuyau'){
    const { sens } = etat.tuyau;
    if(sens === 'bas') J.y += .65; else J.x += .5;
    if(--etat.minuteur <= 0) finTuyau();
    return;
  }
  if(etat.mode === 'drapeau'){ majDrapeau(); majParticules(); return; }
  if(etat.mode === 'levier'){ majLevier(); majParticules(); return; }
  if(etat.mode === 'chateauFin'){ majChateauFin(); return; }
  if(etat.mode !== 'jeu') return;
  majPlateformes();
  majJoueur();
  if(etat.mode !== 'jeu') return;
  if(!J.grandit){ majEntites(); majParticules(); }
  // la caméra : elle suit Pépin vers la droite, sans revenir en arrière
  const cible = J.x - VW * .42;
  camX = clamp(Math.max(camX, cible), 0, Math.max(0, Z.W * T - VW));
  // le temps
  if(++etat.tAcc >= 24){ etat.tAcc = 0; etat.temps--; if(etat.temps === 100) SON.vie(); if(etat.temps <= 0){ etat.temps = 0; mourir(); } }
}

/* ---------- Le dessin ---------- */
const cv = $('cv'), g = cv.getContext('2d');
const cacheTuiles = {};
const tuilesDe = th => cacheTuiles[th] || (cacheTuiles[th] = SP.tuilesTheme(SP.THEMES[th] || SP.THEMES.plaine));
const SANS_HERBE = new Set(['souterrain', 'glace', 'chateau', 'lave']);
function dessinerTuile(t, x, y, th){
  const TT = tuilesDe(th), A = SP.autres, f8 = Math.floor(frame / 8);
  let img = null;
  switch(t){
    case TL.SOLH: img = SANS_HERBE.has(th) ? (th === 'chateau' ? A.pierre : TT.brique) : TT.solHaut; break;
    case TL.SOL: img = th === 'chateau' ? A.pierre : SANS_HERBE.has(th) ? TT.brique : TT.sol; break;
    case TL.BRIQUE: img = TT.brique; break;
    case TL.MYST: img = SP.blocMystere[[0, 0, 1, 2, 1, 0][Math.floor(frame / 9) % 6]]; break;
    case TL.USE: img = TT.vide; break;
    case TL.DUR: img = TT.dur; break;
    case TL.TG: img = SP.tuyau.hautG; break; case TL.TD: img = SP.tuyau.hautD; break; case TL.CG: img = SP.tuyau.corpsG; break; case TL.CD: img = SP.tuyau.corpsD; break;
    case TL.NUAGE: img = A.nuage; break; case TL.PONT: img = A.pont; break; case TL.LAVE: img = A.lave[Math.floor(frame / 20) % 2]; break;
    case TL.EAU: img = A.eauHaut[Math.floor(frame / 24) % 2]; break;
    case TL.SAPG: img = A.sapinG; break; case TL.SAPM: img = A.sapinM; break; case TL.SAPD: img = A.sapinD; break; case TL.TRONC: img = A.tronc; break;
    case TL.GLACE: img = A.glace; break; case TL.MAT: img = A.mat; break; case TL.MATH: img = A.matHaut; break;
    case TL.PIECE: img = SP.objets.piece[[0, 0, 1, 2, 1, 0, 0, 0][Math.floor(frame / 8) % 8]]; break;
    case TL.CORAIL: img = A.corail; break; case TL.CANON: img = A.canon; break; case TL.CANONP: img = A.canonPied; break; case TL.PIERRE: img = A.pierre; break;
    case TL.CHAINE: img = A.levier[0]; break; case TL.ALGUE: img = A.algue[f8 % 2]; break;
  }
  if(img) g.drawImage(img, x, y);
}
function dessinerDecor(d, th){
  const C = SP.THEMES[th] || SP.THEMES.plaine, sol = (ROWS - 2) * T;
  if(d.type === 'colline'){
    const x = d.x * T - camX, w = d.n > 1 ? 80 : 48, h = d.n > 1 ? 36 : 20;
    if(x > VW || x + w < 0) return;
    g.fillStyle = C.colline[1]; g.beginPath(); g.moveTo(x, sol); g.quadraticCurveTo(x + w / 2, sol - h * 2, x + w, sol); g.closePath(); g.fill();
    g.fillStyle = C.colline[0]; g.beginPath(); g.moveTo(x + 2, sol); g.quadraticCurveTo(x + w / 2, sol - h * 2 + 4, x + w - 2, sol); g.closePath(); g.fill();
    g.fillStyle = C.colline[1]; for(const [a, b] of [[.35, .45], [.55, .3], [.5, .65], [.68, .55]]) g.fillRect(Math.round(x + w * a), Math.round(sol - h * b), 3, 6);
  } else if(d.type === 'nuageD' || d.type === 'buisson'){
    const x = d.x * T - camX, w = (d.n + 1) * 16, y = d.type === 'buisson' ? sol - 16 : d.y * T;
    if(x > VW || x + w < 0) return;
    const c1 = d.type === 'buisson' ? C.buisson[0] : C.nuages, c2 = d.type === 'buisson' ? C.buisson[1] : (th === 'nuit' ? '#262C60' : '#BFE2FF');
    g.fillStyle = c2; nuageForme(x, y + 2, d.n); g.fillStyle = c1; nuageForme(x, y, d.n);
  } else if(d.type === 'sapinD'){
    const x = d.x * T - camX; if(x > VW || x < -32) return;
    g.fillStyle = th === 'neige' ? '#3E7A5A' : '#2E7A3A'; for(let k = 0; k < 3; k++){ g.beginPath(); g.moveTo(x + 16, sol - 46 + k * 10); g.lineTo(x + 2 + k * 2 - 2, sol - 22 + k * 8); g.lineTo(x + 30 - k * 2 + 2, sol - 22 + k * 8); g.fill(); }
    if(th === 'neige'){ g.fillStyle = '#F4F8FF'; g.fillRect(x + 13, sol - 44, 6, 3); }
    g.fillStyle = '#6A3E1A'; g.fillRect(x + 14, sol - 8, 4, 8);
  } else if(d.type === 'refuge'){
    const x = d.x * T - camX, y = (ROWS - 2) * T; if(x > VW + 10 || x < -100) return;
    const TT = tuilesDe(th === 'nuit' || th === 'neige' ? th : 'plaine');
    for(let j = 1; j <= 5; j++) for(let i = 0; i < 5; i++) if(j <= 2 || (i >= 1 && i <= 3)) g.drawImage(TT.brique, x + i * 16, y - j * 16);
    for(let i = 0; i < 5; i += 2) g.drawImage(TT.brique, x + i * 16, y - 6 * 16 + 8, 16, 8);
    g.fillStyle = '#000'; g.fillRect(x + 32, y - 28, 16, 28); g.beginPath(); g.arc(x + 40, y - 28, 8, Math.PI, 0); g.fill();
    g.fillRect(x + 22, y - 62, 6, 10); g.fillRect(x + 52, y - 62, 6, 10);
    g.fillStyle = '#D8282B'; g.fillRect(x + 38, y - 112, 2, 16); g.fillRect(x + 40, y - 112, 10, 6);
  }
}
function nuageForme(x, y, n){
  g.beginPath(); g.arc(x + 8, y + 16, 8, Math.PI * .5, Math.PI * 1.5);
  for(let i = 0; i < n; i++) g.arc(x + 16 + i * 16, y + 9, 10, Math.PI, 0);
  g.arc(x + 8 + n * 16 + 8, y + 16, 8, Math.PI * 1.5, Math.PI * .5); g.closePath(); g.fill();
}
function dessinerFond(th){
  const C = SP.THEMES[th] || SP.THEMES.plaine;
  g.fillStyle = Z.eau ? '#1E5AB8' : (Z.ciel || C.ciel); g.fillRect(0, 0, VW, HAUT);
  if(Z.eau){ g.fillStyle = 'rgba(255,255,255,.25)'; for(let k = 0; k < 14; k++){ const x = ((k * 97 + frame * .3) % (VW + 40)) - 20, y = HAUT - ((frame * .5 + k * 53) % HAUT); g.beginPath(); g.arc(x, y, 2, 0, 6.29); g.fill(); } }
  if(C.etoiles){ g.fillStyle = '#FFFFFF'; for(let k = 0; k < 40; k++){ const x = ((k * 131 - camX * .1) % VW + VW) % VW, y = (k * 47) % 140 + 10; g.fillRect(x, y, 1, 1); } }
  // les montagnes au loin (elles défilent lentement)
  if(C.loin && !Z.eau){
    g.fillStyle = C.loin; const dec = camX * .25;
    for(let k = -1; k < VW / 120 + 2; k++){ const x = k * 120 - (dec % 120); g.beginPath(); g.moveTo(x - 30, 200); g.lineTo(x + 40, 120 + (k & 1) * 20); g.lineTo(x + 110, 200); g.fill();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(x + 40, 120 + (k & 1) * 20); g.lineTo(x + 30, 132 + (k & 1) * 20); g.lineTo(x + 52, 132 + (k & 1) * 20); g.fill(); g.fillStyle = C.loin; }
  }
}
function dessinerJoueur(){
  if(J.cache) return;
  if(J.inv > 0 && Math.floor(J.inv / 3) % 2) return;
  if(J.grandit && Math.floor(J.grandit / 4) % 2){ return dessinerPepin(J.grandit > 0 ? 0 : 1); }
  dessinerPepin(J.taille > 0 ? 1 : 0);
}
function dessinerPepin(grand){
  const pal = J.etoile > 0 ? (Math.floor(frame / 3) % 2 ? 'etoile1' : 'etoile2') : J.taille === 2 ? 'feu' : 'normal';
  const S = SP.pepin[pal][grand ? 'grand' : 'petit'];
  let f;
  if(etat.mode === 'mort') f = SP.pepin.normal.petit.mort;
  else if(J.accroupi && grand) f = S.accroupi;
  else if(etat.mode === 'drapeau' && etat.drapeau.phase < 2) f = S.debout;
  else if(!J.sol && etat.mode === 'jeu' && !Z.eau) f = S.saut;
  else if(Z.eau && !J.sol) f = S[['marche1', 'saut'][Math.floor(J.anim) % 2]];
  else if(J.derape) f = S.derape;
  else if(Math.abs(J.vx) > .1 || etat.mode === 'chateauFin' || (etat.mode === 'drapeau' && etat.drapeau.phase === 2)) f = S[['marche1', 'marche2', 'marche3'][Math.floor(J.anim) % 3]];
  else f = S.debout;
  const img = f.d ? (J.dir > 0 ? f.d : f.g) : f;
  const h = img.height, x = Math.round(J.x + J.w / 2 - 8 - camX), y = Math.round(J.y + J.h - h);
  g.drawImage(img, x, y);
}
function dessinerEntite(e){
  const x = Math.round(e.x - camX), y = Math.round(e.y), EN = SP.ennemis, O = SP.objets, f2 = Math.floor(e.t / 10) % 2;
  if(x < -40 || x > VW + 40) return;
  const renv = e.mort === 'renverse';
  const img = (k, gauche) => { const tab = gauche ? EN[k + 'G'] : EN[k]; return Array.isArray(tab) ? tab[f2] : tab; };
  const dessin = (im, dx = 0, dy = 0) => { if(renv){ g.save(); g.translate(x + dx + im.width / 2, y + dy + im.height / 2); g.scale(1, -1); g.drawImage(im, -im.width / 2, -im.height / 2); g.restore(); } else g.drawImage(im, x + dx, y + dy); };
  switch(e.type){
    case 'marmotton': dessin(e.mort === 'plat' ? EN.marmottonPlat : img('marmotton', e.vx > 0 ? false : true), -1, 0); break;
    case 'herisson': case 'herissonRouge': { const r = e.type === 'herissonRouge'; dessin(e.boule ? (r ? EN.bouleRouge : EN.boule) : img(r ? 'herissonRouge' : 'herisson', e.vx < 0), -1, e.boule ? -2 : 0); break; }
    case 'scarabee': dessin(e.boule ? EN.carapace : img('scarabee', e.vx < 0), -1, e.boule ? -2 : 0); break;
    case 'choucas': dessin(img('choucas', e.vx < 0), -1, 0); break;
    case 'bouleNeige': dessin(EN.bouleNeige, -1, -1); break;
    case 'truite': dessin(img('truite', e.vx < 0), -1, -2); break;
    case 'chardon': { if(e.cache >= 24) break; g.save(); g.beginPath(); g.rect(x - 2, e.y0 - 24, 20, 24); g.clip(); g.drawImage(EN.chardon[Math.floor(e.t / 12) % 2], x - 1, Math.round(e.y0 - 24 + e.cache)); g.restore(); break; }
    case 'yeti': { if(e.touche && e.touche % 4 < 2) break; const im = (e.dir < 0 ? EN.yeti : EN.yetiG)[Math.floor(e.t / 16) % 2]; dessin(im, -2, -2); break; }
    case 'barreFeu': for(const [bx, by] of boulesBarre(e)) g.drawImage(O.boule[Math.floor(frame / 4) % 4], Math.round(bx - 4 - camX), Math.round(by - 4)); break;
    case 'lavaSaut': if(e.y < HAUT){ const im = O.boule[Math.floor(frame / 4) % 4]; g.save(); g.translate(x + 7, y + 7); g.scale(2, e.vy > 0 ? -2 : 2); g.drawImage(im, -4, -4); g.restore(); } break;
    case 'boule': g.drawImage(O.boule[Math.floor(frame / 4) % 4], x, y); break;
    case 'cepe': g.drawImage(O.cepe, x, y); break;
    case 'coeur': g.drawImage(O.coeur, x, y); break;
    case 'piment': g.drawImage(O.piment[Math.floor(frame / 8) % 2], x, y); break;
    case 'etoile': g.drawImage(O.etoile[Math.floor(frame / 4) % 3], x, y); break;
  }
}
function dessinerHUD(){
  g.font = '8px "Press Start 2P", monospace'; g.textBaseline = 'top';
  const ombre = (t, x, y, c = '#fff') => { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(t, x + 1, y + 1); g.fillStyle = c; g.fillText(t, x, y); };
  const n = NIVEAUX[etat.niv], c1 = 12, c2 = Math.round(VW * .3), c3 = Math.round(VW * .55), c4 = Math.round(VW * .77);
  ombre('PÉPIN', c1, 10); ombre(String(etat.score).padStart(6, '0'), c1, 20);
  g.drawImage(SP.objets.piece[0], c2 - 3, 15, 12, 12); ombre('×' + String(etat.pieces).padStart(2, '0'), c2 + 9, 18);
  ombre('MONDE', c3, 10); ombre(' ' + n.id, c3, 20);
  ombre('TEMPS', c4, 10); ombre(etat.mode === 'intro' ? '' : ' ' + String(Math.max(0, etat.temps)).padStart(3, '0'), c4, 20, etat.temps < 100 && frame % 30 < 15 ? '#FFB0A8' : '#fff');
}
function dessinerIntro(){
  g.fillStyle = '#000'; g.fillRect(0, 0, VW, HAUT);
  const n = NIVEAUX[etat.niv];
  g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.textBaseline = 'top';
  g.fillText(`MONDE ${n.id}`, VW / 2, 80); g.fillStyle = '#FFD23A'; g.fillText(n.nom.toUpperCase(), VW / 2, 96);
  g.drawImage(SP.pepin.normal.petit.debout.d, VW / 2 - 28, 118); g.fillStyle = '#fff'; g.fillText(`×  ${etat.vies}`, VW / 2 + 10, 124);
  g.textAlign = 'left';
}
function dessiner(){
  g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false;
  if(!Z){ g.fillStyle = '#6CB4FF'; g.fillRect(0, 0, VW, HAUT); return; }
  if(etat.mode === 'intro'){ dessinerIntro(); dessinerHUD(); return; }
  const th = Z.theme;
  dessinerFond(th);
  for(const d of Z.decors) dessinerDecor(d, th);
  // les objets qui sortent d'un bloc passent derrière lui
  for(const e of E) if(e.emerge) dessinerEntite(e);
  const x0 = Math.max(0, Math.floor(camX / T)), x1 = Math.min(Z.W - 1, Math.floor((camX + VW) / T) + 1), cx = Math.round(camX);
  for(let ty = 0; ty < ROWS; ty++) for(let tx = x0; tx <= x1; tx++){
    const t = Z.tiles[ty * Z.W + tx]; if(!t || t === TL.CACHE) continue;
    const b = bumps.find(b => b.tx === tx && b.ty === ty), dy = b ? -Math.round(Math.sin(b.t / 10 * Math.PI) * 5) : 0;
    dessinerTuile(t, tx * T - cx, ty * T + dy, th);
  }
  // le drapeau qui descend le long du mât
  if(Z.drapeau != null){ const fy = etat.mode === 'drapeau' ? etat.drapeau.flagY : 3 * T + 2; g.drawImage(SP.autres.drapeau, Z.drapeau * T - 8 - cx, Math.round(fy)); }
  if(Z.boss && etat.mode !== 'chateauFin') g.drawImage(SP.autres.levier[etat.mode === 'levier' ? 1 : 0], Z.boss.levier * T - cx, (ROWS - 7) * T);
  for(const p of PLATS){ if(p.cabine){ g.strokeStyle = '#3A3A3A'; g.lineWidth = 1; g.beginPath(); g.moveTo(p.x + p.w / 2 - cx, p.y - 2); g.lineTo(p.x + p.w / 2 - cx, p.y - 40); g.stroke(); g.drawImage(SP.autres.cabine, Math.round(p.x - cx), Math.round(p.y - 12), p.w, 16); }
    else for(let k = 0; k < p.w; k += 16) g.drawImage(SP.autres.plateforme, Math.round(p.x + k - cx), Math.round(p.y)); }
  for(const e of E) if(!e.emerge) dessinerEntite(e);
  dessinerJoueur();
  for(const p of PARTS){
    if(p.type === 'debris') g.drawImage(p.img, Math.round(p.x - cx), Math.round(p.y));
    else if(p.type === 'pieceVol') g.drawImage(SP.objets.piece[Math.floor(p.vie / 3) % 4], Math.round(p.x - cx), Math.round(p.y));
    else if(p.type === 'explosion'){ g.fillStyle = p.vie % 4 < 2 ? '#FFE14A' : '#FF8A1E'; g.beginPath(); g.arc(p.x + 8 - cx, p.y + 8, 8 - p.vie / 2, 0, 6.29); g.fill(); }
    else if(p.type === 'texte'){ g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#fff'; g.textBaseline = 'top'; g.fillText(p.txt, Math.round((p.x ?? J.x) - cx), Math.round(p.y ?? J.y)); }
  }
  for(const tx of Z.textes){ g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#fff'; g.textBaseline = 'top'; g.fillText(tx.txt, tx.x * T - cx, tx.y * T); }
  if(etat.mode === 'chateauFin' && etat.minuteur > 120){
    g.font = '8px "Press Start 2P", monospace'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'top';
    const lignes = (NIVEAUX[etat.niv].merci || 'Merci Pépin ! Mais le Yéti a filé vers le monde suivant…').toUpperCase().match(/.{1,26}(\s|$)/g) || [];
    lignes.forEach((l, i) => g.fillText(l.trim(), VW / 2, 60 + i * 14)); g.textAlign = 'left';
  }
  dessinerHUD();
}

/* ---------- La taille de l'écran : 240 pixels de haut ; en portrait, le jeu en haut et la manette dessous ---------- */
function taille(){
  const Wd = innerWidth, Hd = innerHeight, mh = parseFloat(getComputedStyle(document.querySelector('.barre-statut')).height) || 0;
  const portrait = Hd > Wd;
  let echelle;
  if(portrait){ echelle = Math.min(Wd / 256, (Hd - mh - 220) / HAUT); VW = Math.ceil(Wd / echelle); }
  else { echelle = (Hd - mh) / HAUT; VW = Math.ceil(Wd / echelle); }
  cv.width = VW; cv.height = HAUT;
  cv.style.width = Math.ceil(VW * echelle) + 'px'; cv.style.height = Math.ceil(HAUT * echelle) + 'px';
  // en portrait, le jeu se place au milieu de la place laissée au-dessus de la manette
  cv.style.top = (portrait ? mh + Math.max(0, Math.floor((Hd - mh - 210 - HAUT * echelle) / 2)) : mh) + 'px';
}
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille);

let avant = performance.now(), reste = 0;
function boucle(now){
  requestAnimationFrame(boucle);
  reste += Math.min(100, now - avant); avant = now;
  let n = 0;
  while(reste >= 1000 / 60 && n < 4){ if(etat.mode !== 'pause' && etat.mode !== 'titre') maj(); else frame++; reste -= 1000 / 60; n++; }
  dessiner();
}

/* ---------- Les menus ---------- */
const ECRANS = ['eTitre', 'ePause', 'eAide', 'eFin'];
function ecran(id){ ECRANS.forEach(e => $(e).hidden = e !== id); const jeu = !id; $('manette').hidden = !jeu; $('bPause').hidden = !jeu; }
function titre(){
  etat.mode = 'titre'; musique(null);
  // en fond, le début du monde 1-1
  preparerNiveau(0); J = nouveauJoueur(0); entrerZone('principal'); musique(null);
  $('tRecord').textContent = PROG.meilleur ? `MEILLEUR SCORE ${PROG.meilleur}` : '';
  $('lMondes').innerHTML = [0, 1, 2, 3].map(m => `<div class="monde"><h3>MONDE ${m + 1} · ${NOMS_MONDES[m]}</h3><div class="niveaux">${NIVEAUX.map((n, i) => [n, i]).filter(([n]) => n.id[0] === String(m + 1)).map(([n, i]) =>
    `<button class="niv${PROG.faits[n.id] ? ' fait' : ''}" data-i="${i}" ${i > PROG.debloque ? 'disabled' : ''}>${n.id}<small>${i > PROG.debloque ? '🔒' : n.nom}</small></button>`).join('')}</div></div>`).join('');
  $('bJouer').textContent = PROG.debloque > 0 ? `▶ CONTINUER ${NIVEAUX[PROG.debloque].id}` : '▶ JOUER';
  $('bSon').textContent = son ? '🔊' : '🔇'; $('bMusique').style.opacity = musOn ? 1 : .4;
  ecran('eTitre');
}
const NOMS_MONDES = ['Les Alpages', 'Le Lac', 'Les Neiges', 'Le Volcan'];
function commencer(i){ etat.vies = 5; etat.pieces = 0; etat.score = 0; etat.mi = false; J = null; ecran(null); audio(); lancerNiveau(i); }
function finEcran(t, txt, bouton, action){ etat.mode = 'fin'; musique(null); $('fTitre').textContent = t; $('fTexte').textContent = txt; $('fBouton').textContent = bouton; $('fBouton').onclick = () => { ecran(null); action(); }; ecran('eFin'); }
function pause(){ if(etat.mode !== 'jeu') return; etat.avantPause = etat.mode; etat.mode = 'pause'; ecran('ePause'); }
function reprendre(){ if(etat.mode !== 'pause') return; etat.mode = etat.avantPause || 'jeu'; ecran(null); if(AC) musT = AC.currentTime + .05; }
$('bJouer').onclick = () => commencer(PROG.debloque);
$('lMondes').onclick = e => { const b = e.target.closest('[data-i]'); if(b && !b.disabled) commencer(+b.dataset.i); };
$('bPause').onclick = pause; $('bReprendre').onclick = reprendre;
$('bRecommencer').onclick = () => { ecran(null); lancerNiveau(etat.niv); };
$('bQuitter').onclick = titre; $('fMenu').onclick = titre;
$('bAide').onclick = () => ecran('eAide'); $('bAideRetour').onclick = () => ecran('eTitre');
const basculerSon = () => { son = !son; ecrire('pepin-son', son); $('bSon').textContent = son ? '🔊' : '🔇'; $('bSon2').textContent = (son ? '🔊' : '🔇') + ' Son'; };
const basculerMusique = () => { musOn = !musOn; ecrire('pepin-musique', musOn); $('bMusique').style.opacity = musOn ? 1 : .4; $('bMusique2').style.opacity = musOn ? 1 : .5; if(musOn && etat.mode !== 'titre') musique(musiqueZone()); };
$('bSon').onclick = basculerSon; $('bSon2').onclick = basculerSon; $('bMusique').onclick = basculerMusique; $('bMusique2').onclick = basculerMusique;
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
// la légende des objets dans l'aide
$('aLegende').innerHTML = [['cepe', 'Le cèpe : Pépin grandit (il peut casser les briques, et encaisse un coup).'], ['piment', 'Le piment : Pépin lance des boules de feu avec B.'], ['etoile', 'L\'étoile des neiges : invincible un moment !'], ['coeur', 'Le cœur vert : une vie en plus.']]
  .map(([k]) => `<canvas data-o="${k}" width="16" height="16"></canvas><span></span>`).join('');
[...$('aLegende').querySelectorAll('canvas')].forEach((c, i) => { const o = SP.objets[c.dataset.o]; c.getContext('2d').drawImage(Array.isArray(o) ? o[0] : o, 0, 0); c.nextElementSibling.textContent = [['cepe', 'Le cèpe : Pépin grandit (il peut casser les briques, et encaisse un coup).'], ['piment', 'Le piment : Pépin lance des boules de feu avec B.'], ['etoile', 'L\'étoile des neiges : invincible un moment !'], ['coeur', 'Le cœur vert : une vie en plus.']][i][1]; });

// Pour les tests automatiques : photographier l'état de la partie, et y revenir
function instantane(){
  const zones = {};
  for(const [k, z] of Object.entries(ZONES)) zones[k] = { tiles:z.tiles.slice(), contenu:new Map(z.contenu), prochain:z.prochain, fait:z.spawns.map(s => !!s.fait), multi:z.multi ? JSON.parse(JSON.stringify(z.multi)) : null };
  return { zones, z:Z.nom, d:structuredClone({ J, E, PLATS, etat, camX, KA, bumps, frame }) };
}
function restaurer(s){
  for(const [k, z] of Object.entries(ZONES)){ const v = s.zones[k]; z.tiles.set(v.tiles); z.contenu = new Map(v.contenu); z.prochain = v.prochain; z.spawns.forEach((sp, i) => sp.fait = v.fait[i]); z.multi = v.multi ? JSON.parse(JSON.stringify(v.multi)) : undefined; }
  Z = ZONES[s.z]; const d = structuredClone(s.d);
  J = d.J; E = d.E; PLATS = d.PLATS; camX = d.camX; bumps = d.bumps; frame = d.frame; PARTS = []; Object.assign(etat, d.etat); Object.assign(KA, d.KA);
}

taille(); titre(); requestAnimationFrame(boucle);
window.Pepin = { etat, get J(){ return J; }, get Z(){ return Z; }, get E(){ return E; }, NIVEAUX, commencer, lancerNiveau, K, majEntrees, tuile, TL, get camX(){ return camX; }, PROG, entrerZone, maj, get PLATS(){ return PLATS; }, get VW(){ return VW; }, instantane, restaurer };

if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
