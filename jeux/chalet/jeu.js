/* Chalet Crush : l'interface — la carte des 60 niveaux, le plateau (dessiné sur un canevas), les animations, les sons, les aides et la sauvegarde.
   La logique du jeu est dans moteur.js ; ici on rejoue simplement les « étapes » que le moteur renvoie pour chaque coup. */
(() => {
'use strict';
const M = CHALET_MOTEUR, NV = CHALET_NIVEAUX, D = CHALET_DESSIN;
const $ = id => document.getElementById(id);
const lire = (k, v) => { try{ const s = localStorage.getItem(k); return s == null ? v : JSON.parse(s); }catch(e){ return v; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const attendre = ms => tw(ms, () => {});

/* ---------- La progression (sauvegardée) ---------- */
const PR0 = { etoiles:{}, scores:{}, maxNiveau:1, aides:{ marteau:3, eclair:2, melange:2, jetons:2 }, son:true, parties:0, victoires:0, combosMax:0, gourmandises:0, coups:0 };
const PR = Object.assign({}, PR0, lire('chalet-progres', {})); PR.aides = Object.assign({}, PR0.aides, PR.aides || {});
const sauver = () => ecrire('chalet-progres', PR);
const totalEtoiles = () => Object.values(PR.etoiles).reduce((a, b) => a + b, 0);

/* ---------- Les sons (fabriqués à la volée) ---------- */
let AC = null;
function audio(){ if(!AC){ try{ AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){} } if(AC && AC.state === 'suspended') AC.resume(); }
function bip(f, d, type = 'sine', vol = .12, glisse = 0, delai = 0){
  if(!PR.son || !AC) return; const t = AC.currentTime + delai, o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if(glisse) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + glisse), t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + .03);
}
function bruit(d = .35, vol = .16){
  if(!PR.son || !AC) return; const n = Math.floor(AC.sampleRate * d), b = AC.createBuffer(1, n, AC.sampleRate), c = b.getChannelData(0); for(let i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol; s.buffer = b; s.connect(f); f.connect(g); g.connect(AC.destination); s.start();
}
const GAMME = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const SON = {
  pop:k => { const n = GAMME[Math.min(k, GAMME.length - 1)]; bip(440 * Math.pow(2, n / 12), .16, 'triangle', .14, 80); bip(660 * Math.pow(2, n / 12), .1, 'sine', .05, 0, .03); },
  swap:() => bip(330, .08, 'sine', .08, 140), refus:() => bip(180, .2, 'square', .05, -70),
  special:() => [0, 1, 2, 3].forEach(i => bip(520 * Math.pow(2, [0, 4, 7, 12][i] / 12), .22, 'sine', .1, 0, i * .05)),
  boom:() => { bruit(.4, .2); bip(110, .35, 'sawtooth', .09, -60); }, eclair:() => { bruit(.3, .12); bip(1200, .25, 'sawtooth', .06, -900); },
  gagne:() => [0, 4, 7, 12, 16, 19].forEach((n, i) => bip(523 * Math.pow(2, n / 12), .35, 'triangle', .13, 0, i * .11)),
  perdu:() => [7, 5, 2, 0].forEach((n, i) => bip(330 * Math.pow(2, n / 12), .3, 'triangle', .1, 0, i * .16)),
  etoile:i => bip(700 * Math.pow(2, i * 4 / 12), .4, 'sine', .14), clic:() => bip(600, .06, 'sine', .08),
};

/* ---------- Le fond : de la neige qui tombe ---------- */
const cnv = $('neige'), cg = cnv.getContext('2d'); let flocons = [];
function tailleFond(){ cnv.width = innerWidth; cnv.height = innerHeight; flocons = Array.from({ length:Math.min(70, Math.floor(innerWidth / 14)) }, () => ({ x:Math.random() * innerWidth, y:Math.random() * innerHeight, r:1 + Math.random() * 2.6, v:12 + Math.random() * 28, d:Math.random() * 6.28 })); }
function neige(dt){ cg.clearRect(0, 0, cnv.width, cnv.height); cg.fillStyle = 'rgba(255,255,255,.75)'; for(const f of flocons){ f.y += f.v * dt / 1000; f.d += dt / 900; f.x += Math.sin(f.d) * .3; if(f.y > cnv.height + 4){ f.y = -4; f.x = Math.random() * cnv.width; } cg.beginPath(); cg.arc(f.x, f.y, f.r, 0, 6.28); cg.fill(); } }

/* ---------- Le plateau : l'état visuel ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let G = null, niveauNum = 1, spr = new Map(), vis = [], glaceVis = [], aff = null, occupe = false, pausee = false, mode = null, sel = null, glisse = null, indice = null, dernierGeste = 0;
let horloge = 0, anims = [], parts = [], flot = [], effets = [], curseur = [4, 4], kb = false;
const V = { cs:40, ox:0, oy:0, w:0, h:0, dpr:1, S:null, px:0 };
const ease = { io:u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2, out:u => 1 - Math.pow(1 - u, 3), lin:u => u, rebond:u => { const n1 = 7.5625, d1 = 2.75; if(u < 1 / d1) return n1 * u * u; if(u < 2 / d1) return n1 * (u -= 1.5 / d1) * u + .75; if(u < 2.5 / d1) return n1 * (u -= 2.25 / d1) * u + .9375; return n1 * (u -= 2.625 / d1) * u + .984375; }, pop:u => { const c = 1.9; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); } };
function tw(d, f, e = ease.io){ return new Promise(res => anims.push({ t:0, d:Math.max(1, d / (window.CHALET_VITESSE || 1)), f, e, res })); }
function cadrer(){
  const r = cv.parentElement.getBoundingClientRect(); V.dpr = Math.min(2, window.devicePixelRatio || 1); V.w = r.width; V.h = r.height;
  cv.width = Math.round(r.width * V.dpr); cv.height = Math.round(r.height * V.dpr);
  if(!G) return;
  const marge = 4; V.cs = Math.floor(Math.min((r.width - marge * 2) / G.W, (r.height - marge * 2) / G.H));
  V.ox = Math.round((r.width - V.cs * G.W) / 2); V.oy = Math.round((r.height - V.cs * G.H) / 2);
  const px = Math.round(V.cs * V.dpr); if(!V.S || V.px !== px){ V.px = px; V.S = D.creerSprites(px); }
}
const centre = (x, y) => [V.ox + (x + .5) * V.cs, V.oy + (y + .5) * V.cs];
function creerSprite(p, x, y){ const s = { id:p.id, p, x, y, sx:1, sy:1, a:1, rot:0, pv:p.pv, brille:0 }; spr.set(p.id, s); if(y >= 0 && y < G.H && x >= 0 && x < G.W) vis[y][x] = s; return s; }
function reconstruire(){
  spr = new Map(); vis = Array.from({ length:G.H }, () => Array(G.W).fill(null)); glaceVis = G.glace.map(l => l.slice());
  for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(G.p[y][x]) creerSprite(G.p[y][x], x, y);
}
// vérifie que ce qu'on voit correspond à la logique (sinon on redessine tout : sécurité)
function verifier(){
  let ok = true;
  for(let y = 0; y < G.H && ok; y++) for(let x = 0; x < G.W; x++){ const p = G.p[y][x], s = vis[y][x]; if((p && (!s || s.id !== p.id)) || (!p && s)){ ok = false; break; } }
  if(!ok) reconstruire(); else for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){ const s = vis[y][x]; if(s){ s.x = x; s.y = y; s.sx = s.sy = 1; s.a = 1; s.rot = 0; if(s.p.k === 'neige') s.pv = s.p.pv; } }
  glaceVis = G.glace.map(l => l.slice());
}

/* ---------- Dessin de chaque image ---------- */
function imageDe(s){
  const p = s.p, S = V.S;
  if(p.k === 'p') return p.s === 'rh' ? S.rh[p.c] : p.s === 'rv' ? S.rv[p.c] : p.s === 'bo' ? S.bo[p.c] : S.piece[p.c];
  if(p.k === 'su') return S.su[Math.floor(horloge / 110) % 8];
  if(p.k === 'cerise') return S.cerise;
  return S.neige[clamp(s.pv || 1, 1, 3)];
}
function dessiner(){
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); ctx.clearRect(0, 0, V.w, V.h);
  if(!G || !V.S) return;
  const cs = V.cs;
  // le plateau : un panneau clair
  ctx.fillStyle = 'rgba(255,255,255,.42)'; rrect(ctx, V.ox - 6, V.oy - 6, cs * G.W + 12, cs * G.H + 12, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.stroke();
  for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(G.vide[y][x]) ctx.drawImage(V.S.fond[(x + y) % 2], V.ox + x * cs, V.oy + y * cs, cs, cs);
  for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){ const g = glaceVis[y][x]; if(g > 0) ctx.drawImage(V.S.glace[g], V.ox + x * cs, V.oy + y * cs, cs, cs); }
  // la case choisie, le curseur du clavier, l'indice
  if(sel){ const [cx, cy] = centre(sel[0], sel[1]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.shadowColor = '#FF4F87'; ctx.shadowBlur = 10; rrect(ctx, cx - cs / 2 + 2, cy - cs / 2 + 2, cs - 4, cs - 4, 12); ctx.stroke(); ctx.shadowBlur = 0; }
  if(kb && !occupe){ const [cx, cy] = centre(curseur[0], curseur[1]); ctx.strokeStyle = 'rgba(43,27,61,.8)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2.5; rrect(ctx, cx - cs / 2 + 1, cy - cs / 2 + 1, cs - 2, cs - 2, 12); ctx.stroke(); ctx.setLineDash([]); }
  // les pièces (celles qui tombent passent par-dessus)
  const liste = [...spr.values()].sort((a, b) => a.y - b.y);
  for(const s of liste){
    if(s.a <= 0.01) continue; const [cx, cy] = centre(s.x, s.y), im = imageDe(s); let sx = s.sx, sy = s.sy;
    if(indice && indice.t > 0 && ((s.x === indice.a[0] && s.y === indice.a[1]) || (s.x === indice.b[0] && s.y === indice.b[1]))){ const k = 1 + Math.sin(horloge / 140) * .09; sx *= k; sy *= k; }
    if(s.p.k === 'p' && s.p.s === 'bo'){ const k = 1 + Math.sin(horloge / 220) * .05; sx *= k; sy *= k; ctx.globalAlpha = .35 * s.a; ctx.fillStyle = '#FFE066'; ctx.beginPath(); ctx.arc(cx, cy, cs * .5 * k, 0, 6.28); ctx.fill(); }
    ctx.globalAlpha = s.a; ctx.save(); ctx.translate(cx, cy); if(s.rot) ctx.rotate(s.rot); ctx.scale(sx, sy); const t = cs * .98; ctx.drawImage(im, -t / 2, -t / 2, t, t); ctx.restore(); ctx.globalAlpha = 1;
  }
  dessinerEffets();
}
const rrect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
function dessinerEffets(){
  const cs = V.cs;
  for(const e of effets){
    if(e.t < 0) continue;                            // un effet qui démarre un peu plus tard
    const u = e.t / e.d; ctx.globalAlpha = clamp(1 - u, 0, 1);
    if(e.type === 'ligne'){ const [cx, cy] = centre(e.x, e.y); const g = ctx.createLinearGradient(0, cy - cs, 0, cy + cs); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(V.ox, cy - cs * .5, cs * G.W, cs); }
    if(e.type === 'colonne'){ const [cx, cy] = centre(e.x, e.y); const g = ctx.createLinearGradient(cx - cs, 0, cx + cs, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(cx - cs * .5, V.oy, cs, cs * G.H); }
    if(e.type === 'onde'){ const [cx, cy] = centre(e.x, e.y); ctx.strokeStyle = e.coul || '#FFE066'; ctx.lineWidth = 8 * (1 - u) + 2; ctx.beginPath(); ctx.arc(cx, cy, cs * (.3 + u * e.r), 0, 6.28); ctx.stroke(); }
    if(e.type === 'eclair'){ ctx.strokeStyle = '#fff'; ctx.shadowColor = '#9BE7FF'; ctx.shadowBlur = 12; ctx.lineWidth = 3; for(const [x0, y0, x1, y1] of e.segs){ ctx.beginPath(); ctx.moveTo(x0, y0); const n = 5; for(let i = 1; i < n; i++){ const k = i / n; ctx.lineTo(x0 + (x1 - x0) * k + (Math.sin(i * 7 + e.t / 30 + x1) * 7), y0 + (y1 - y0) * k + Math.cos(i * 5 + e.t / 25 + y1) * 7); } ctx.lineTo(x1, y1); ctx.stroke(); } ctx.shadowBlur = 0; }
    ctx.globalAlpha = 1;
  }
  for(const p of parts){ const u = p.vie / p.max; ctx.globalAlpha = clamp(u * 1.6, 0, 1); ctx.fillStyle = p.coul; if(p.type === 'etoile'){ etoile(ctx, p.x, p.y, p.r * (.5 + u * .8)); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.4 + u * .7), 0, 6.28); ctx.fill(); } }
  ctx.globalAlpha = 1;
  for(const f of flot){ const u = f.vie / f.max; ctx.globalAlpha = clamp(u * 2, 0, 1); ctx.font = `800 ${Math.round(V.cs * .42 * (f.grand ? 1.5 : 1))}px "Bebas Neue", "Bricolage Grotesque", sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(120,10,60,.85)'; ctx.fillStyle = f.coul || '#fff'; ctx.strokeText(f.txt, f.x, f.y); ctx.fillText(f.txt, f.x, f.y); }
  ctx.globalAlpha = 1;
}
function etoile(g, x, y, r){ g.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill(); }
function eclats(x, y, coul, n = 7, vit = 2.4, type = 'rond'){ const [cx, cy] = centre(x, y); for(let i = 0; i < n; i++){ const a = Math.random() * 6.28, v = (.4 + Math.random()) * vit * V.cs / 40; parts.push({ x:cx, y:cy, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 1, vie:480 + Math.random() * 300, max:780, coul, r:2 + Math.random() * 4 * V.cs / 40, type }); } }
function flottant(x, y, txt, coul, grand){ const [cx, cy] = centre(x, y); flot.push({ x:cx, y:cy, txt, vie:900, max:900, coul, grand }); }
function mettreAJour(dt){
  for(const a of anims){ a.t += dt; const u = Math.min(1, a.t / a.d); a.f(a.e(u)); if(u >= 1) a.fini = true; }
  const finis = anims.filter(a => a.fini); anims = anims.filter(a => !a.fini); for(const a of finis) a.res();
  for(const p of parts){ p.vie -= dt; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += .09 * dt / 16; } parts = parts.filter(p => p.vie > 0);
  for(const f of flot){ f.vie -= dt; f.y -= .05 * dt; } flot = flot.filter(f => f.vie > 0);
  for(const e of effets) e.t += dt; effets = effets.filter(e => e.t < e.d);
  if(indice && indice.t >= 0) indice.t += dt;
}
let dernier = performance.now();
function boucle(now){
  requestAnimationFrame(boucle);
  const dt = Math.min(50, now - dernier); dernier = now; neige(dt);
  if(!pausee){ horloge += dt; mettreAJour(dt); idle(); }
  if(!$('eJeu').hidden) dessiner();
}

/* ---------- Rejouer les étapes d'un coup ---------- */
const MOTS = [null, null, null, 'Savoureux !', 'Délicieux !', 'Divin !', 'Sensationnel !', 'Incroyable !'];
const COMBOS = { croix:'Double rayure !', large:'Rayure géante !', grosse:'Explosion géante !', supercouleur:'Flocon !', superbonus:'Super combo !', supersuper:'TOUT DISPARAÎT !' };
function mot(t){ const m = $('mot'); m.textContent = t; m.classList.remove('va'); void m.offsetWidth; m.classList.add('va'); }
function bandeau(t, ms = 2200){ const b = $('bandeau'); if(!t){ b.hidden = true; return; } b.textContent = t; b.hidden = false; clearTimeout(bandeau.t); if(ms) bandeau.t = setTimeout(() => b.hidden = true, ms); }
async function jouerEtapes(etapes){
  for(const e of etapes){
    if(e.t === 'echange') await animEchange(e.a, e.b);
    else if(e.t === 'refus') await animRefus(e.a, e.b);
    else if(e.t === 'combo'){ SON.special(); mot(COMBOS[e.nom] || 'Combo !'); await attendre(150); }
    else if(e.t === 'eclat') await animEclat(e);
    else if(e.t === 'chute') await animChute(e);
    else if(e.t === 'cerises') await animCerises(e);
    else if(e.t === 'melange'){ bandeau('Plus de coups possibles : on mélange !', 1800); await animMelange(e); }
  }
}
async function animEchange(a, b){
  const sa = vis[a[1]][a[0]], sb = vis[b[1]][b[0]]; SON.swap(); if(!sa || !sb) return;
  vis[a[1]][a[0]] = sb; vis[b[1]][b[0]] = sa;
  await tw(170, u => { sa.x = a[0] + (b[0] - a[0]) * u; sa.y = a[1] + (b[1] - a[1]) * u; sb.x = b[0] + (a[0] - b[0]) * u; sb.y = b[1] + (a[1] - b[1]) * u; });
}
async function animRefus(a, b){
  const sa = vis[a[1]][a[0]], sb = vis[b[1]][b[0]]; SON.refus(); if(!sa || !sb) return;
  await tw(240, u => { const k = Math.sin(u * Math.PI) * .45; sa.x = a[0] + (b[0] - a[0]) * k; sa.y = a[1] + (b[1] - a[1]) * k; sb.x = b[0] + (a[0] - b[0]) * k; sb.y = b[1] + (a[1] - b[1]) * k; });
  sa.x = a[0]; sa.y = a[1]; sb.x = b[0]; sb.y = b[1];
}
const COUL_PART = D.COUL.map(c => c.h);
async function animEclat(e){
  const prom = [], dec = e.declenches;
  SON.pop(e.cascade - 1); if(e.cascade >= 3 && MOTS[Math.min(e.cascade, 7)]) mot(MOTS[Math.min(e.cascade, 7)]);
  if(dec.length){
    for(const d of dec){
      if(d.s === 'rh'){ effets.push({ type:'ligne', x:d.x, y:d.y, t:0, d:420 }); SON.boom(); }
      else if(d.s === 'rv'){ effets.push({ type:'colonne', x:d.x, y:d.y, t:0, d:420 }); SON.boom(); }
      else if(d.s === 'bo'){ effets.push({ type:'onde', x:d.x, y:d.y, t:0, d:480, r:3.2 }, { type:'onde', x:d.x, y:d.y, t:-120, d:480, r:2, coul:'#fff' }); SON.boom(); eclats(d.x, d.y, '#FFE066', 16, 4.5, 'etoile'); }
      else if(d.s === 'su'){ const [x0, y0] = centre(d.x, d.y); const segs = e.touches.filter(t => t.k === 'p').slice(0, 40).map(t => { const [x1, y1] = centre(t.x, t.y); return [x0, y0, x1, y1]; }); effets.push({ type:'eclair', segs, t:0, d:520 }); SON.eclair(); }
    }
  }
  // les pièces qui disparaissent (plus tard quand elles sont loin d'un bonus qui explose)
  e.touches.forEach((t, i) => {
    const s = spr.get(t.id); if(!s) return;
    const delai = dec.length ? Math.min(...dec.map(d => Math.hypot(d.x - t.x, d.y - t.y))) * 28 : i * 6;
    prom.push((async () => { await attendre(delai);
      if(t.neigeFin){ eclats(t.x, t.y, '#EAF4FF', 12, 3.4); } else eclats(t.x, t.y, t.k === 'p' ? COUL_PART[t.c] : '#fff', 7);
      await tw(t.fusion ? 220 : 260, u => { s.sx = s.sy = t.fusion ? 1 - u * .4 : (u < .3 ? 1 + u * .9 : Math.max(0, 1.27 * (1 - (u - .3) / .7))); s.a = 1 - u * u; }, ease.lin);
      s.a = 0; if(vis[t.y][t.x] === s) vis[t.y][t.x] = null; spr.delete(t.id); })());
    // les compteurs
    if(t.k === 'p'){ if(aff.collecte && String(t.c) in aff.collecte) aff.collecte[t.c] = Math.max(0, aff.collecte[t.c] - 1); PR.gourmandises++; }
    if(t.neigeFin) aff.neige = Math.max(0, aff.neige - 1);
  });
  for(const n of e.neige) if(n.reste > 0){ const s = spr.get(n.id); if(s){ s.pv = n.reste; eclats(n.x, n.y, '#DCEBFF', 5, 2); prom.push(tw(260, u => { s.rot = Math.sin(u * 14) * .12 * (1 - u); }, ease.lin)); } }
  for(const g of e.glace){ glaceVis[g.y][g.x] = g.reste; eclats(g.x, g.y, '#BEE8FF', 8, 3.2, 'etoile'); if(g.reste === 0) aff.glace = Math.max(0, aff.glace - 1); }
  aff.score += e.gain; majObjs(); majScore();
  if(e.gain){ let sx = 0, sy = 0; for(const t of e.touches){ sx += t.x; sy += t.y; } const n = Math.max(1, e.touches.length); flottant(sx / n, sy / n, '+' + e.gain, '#FFF3B0', e.cascade >= 3); }
  if(e.creations.length){
    await attendre(190); SON.special();
    for(const c of e.creations){ const s = creerSprite(c.piece, c.x, c.y); s.sx = s.sy = 0; eclats(c.x, c.y, '#fff', 10, 3, 'etoile'); effets.push({ type:'onde', x:c.x, y:c.y, t:0, d:380, r:1.4, coul:'#fff' }); prom.push(tw(320, u => { s.sx = s.sy = Math.max(0, ease.pop(u)); }, ease.lin)); }
  }
  await Promise.all(prom); await attendre(60);
}
async function animChute(e){
  const prom = [];
  const colonnes = new Map(); for(const s of e.spawns){ if(!colonnes.has(s.tx)) colonnes.set(s.tx, []); colonnes.get(s.tx).push(s); }
  for(const m of e.moves){ const s = spr.get(m.id); if(!s) continue; if(vis[m.fy][m.fx] === s) vis[m.fy][m.fx] = null; }
  for(const m of e.moves){ const s = spr.get(m.id); if(!s) continue; vis[m.ty][m.tx] = s; const d = Math.hypot(m.tx - m.fx, m.ty - m.fy), x0 = s.x, y0 = s.y; prom.push(tw(150 + 95 * Math.sqrt(d), u => { s.x = x0 + (m.tx - x0) * u; s.y = y0 + (m.ty - y0) * u; }, ease.rebond)); }
  for(const [col, liste] of colonnes){
    liste.sort((a, b) => b.ty - a.ty);
    liste.forEach((sp, i) => { const s = creerSprite(sp.piece, sp.tx, sp.ty), y0 = -1 - i; s.y = y0; s.x = sp.tx; const d = sp.ty - y0; prom.push(attendre(i * 35).then(() => tw(170 + 90 * Math.sqrt(d), u => { s.y = y0 + (sp.ty - y0) * u; }, ease.rebond))); });
  }
  await Promise.all(prom);
}
async function animCerises(e){
  const prom = [];
  for(const c of e.sorties){ const s = spr.get(c.id); if(!s) continue; if(vis[c.y][c.x] === s) vis[c.y][c.x] = null; aff.cerises = Math.max(0, aff.cerises - 1); aff.score += 250; SON.etoile(1); eclats(c.x, c.y, '#FF5A72', 14, 3.4, 'etoile'); flottant(c.x, c.y, '+250', '#FFE066', true); const y0 = s.y; prom.push(tw(520, u => { s.y = y0 + u * .5; s.sx = s.sy = 1 + u * .3; s.a = 1 - u; }, ease.out).then(() => spr.delete(c.id))); }
  majObjs(); majScore(); await Promise.all(prom);
}
async function animMelange(e){
  const prom = []; SON.special();
  for(const m of e.moves){ const s = spr.get(m.id); if(!s) continue; if(vis[m.fy][m.fx] === s) vis[m.fy][m.fx] = null; }
  for(const m of e.moves){ const s = spr.get(m.id); if(!s) continue; vis[m.ty][m.tx] = s; const x0 = s.x, y0 = s.y; prom.push(tw(520, u => { s.x = x0 + (m.tx - x0) * u; s.y = y0 + (m.ty - y0) * u - Math.sin(u * Math.PI) * .6; s.rot = Math.sin(u * Math.PI * 2) * .25; })); }
  await Promise.all(prom); for(const s of spr.values()) s.rot = 0;
}

/* ---------- L'en-tête : coups, objectifs, score et étoiles ---------- */
function construireObjs(){
  const co = G.niv.objectifs, box = $('objs'); box.innerHTML = ''; aff.chips = [];
  const puce = (kind, k, id) => { const d = document.createElement('div'); d.className = 'obj'; d.dataset.id = id; d.appendChild(D.icone(kind, k)); const b = document.createElement('b'); d.appendChild(b); box.appendChild(d); return { d, b, id }; };
  if(co.score) aff.chips.push(puce('score', 0, 'score'));
  for(const c of Object.keys(co.collecte || {})) aff.chips.push(puce('p', +c, 'c' + c));
  if(co.glace) aff.chips.push(puce('glace', 0, 'glace'));
  if(co.neige) aff.chips.push(puce('neige', 0, 'neige'));
  if(co.cerises) aff.chips.push(puce('cerise', 0, 'cerises'));
}
function majObjs(){
  const co = G.niv.objectifs;
  for(const ch of aff.chips){
    let v = 0;
    if(ch.id === 'score') v = Math.max(0, co.score - aff.score); else if(ch.id[0] === 'c' && ch.id !== 'cerises') v = aff.collecte[ch.id.slice(1)]; else if(ch.id === 'glace') v = aff.glace; else if(ch.id === 'neige') v = aff.neige; else if(ch.id === 'cerises') v = aff.cerises;
    const avant = ch.b.textContent; ch.b.textContent = v; ch.d.classList.toggle('fait', v <= 0);
    if(avant !== String(v) && avant !== ''){ ch.d.classList.add('saute'); setTimeout(() => ch.d.classList.remove('saute'), 160); }
  }
}
function majScore(){
  const e = G.niv.etoiles, max = e[2] || 1; $('pts').textContent = Math.round(aff.score).toLocaleString('fr-FR');
  $('jaugeI').style.width = clamp(aff.score / max * 100, 0, 100) + '%';
  const pos = [e[0] ? e[0] / max : .25, e[1] / max, 1]; ['e1', 'e2', 'e3'].forEach((id, i) => { const s = $(id); s.style.left = clamp(pos[i] * 100, 6, 96) + '%'; s.classList.toggle('ok', aff.score >= (i === 0 ? (e[0] || e[1] * .3) : e[i])); });
}
function majCoups(){ $('nCoups').textContent = aff.coups; $('jCoups').classList.toggle('peu', aff.coups <= 5); }
function majAides(){
  $('nMarteau').textContent = PR.aides.marteau; $('nEclair').textContent = PR.aides.eclair; $('nMelange').textContent = PR.aides.melange;
  $('aMarteau').disabled = !PR.aides.marteau; $('aEclair').disabled = !PR.aides.eclair; $('aMelange').disabled = !PR.aides.melange;
  $('aMarteau').classList.toggle('actif', mode === 'marteau'); $('aEclair').classList.toggle('actif', mode === 'eclair');
  $('reserve').textContent = `🔨 ${PR.aides.marteau}  ⚡ ${PR.aides.eclair}  🔀 ${PR.aides.melange}  🎟️ ${PR.aides.jetons}`;
}
function synchroHud(){
  const r = M.restant(G); aff.score = G.score; aff.coups = G.coups; aff.glace = r.glace || 0; aff.neige = r.neige || 0; aff.cerises = r.cerises || 0; aff.collecte = Object.assign({}, r.collecte || {});
  majObjs(); majScore(); majCoups();
}

/* ---------- Jouer un coup ---------- */
const voisines = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
async function tenter(a, b){
  if(occupe || !G || G.fini || pausee) return; occupe = true; sel = null; indice = null; dernierGeste = horloge;
  const r = M.echanger(G, a, b);
  if(!r.valide){ if(r.etapes) await jouerEtapes(r.etapes); occupe = false; return; }
  PR.coups++; aff.coups = G.coups; majCoups();
  await jouerEtapes(r.etapes);
  await apresCoup();
}
async function apresCoup(){
  verifier(); synchroHud(); mode = null; majAides(); occupe = false; dernierGeste = horloge; sauver();
  if(G.fini) await terminer();
}
async function utiliserAide(c){
  if(occupe || !G || G.fini) return; const nom = mode; mode = null; majAides(); bandeau(null);
  let r; if(nom === 'marteau') r = M.marteau(G, c[0], c[1]); else if(nom === 'eclair') r = M.eclair(G, c[0], c[1], true);
  if(!r || !r.valide){ bandeau('Choisis une autre case', 1400); return; }
  PR.aides[nom]--; occupe = true; sauver(); majAides(); effets.push({ type:'onde', x:c[0], y:c[1], t:0, d:360, r:1.8 }); SON.boom();
  if(nom === 'eclair') effets.push({ type:'ligne', x:c[0], y:c[1], t:0, d:420 });
  await jouerEtapes(r.etapes); await apresCoup();
}
async function melangerAide(){
  if(occupe || !G || G.fini || !PR.aides.melange) return; PR.aides.melange--; sauver(); majAides(); occupe = true; const r = M.melanger(G); await jouerEtapes(r.etapes); await apresCoup();
}

/* ---------- Les gestes ---------- */
function cellule(e){ const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left - V.ox) / V.cs), y = Math.floor((e.clientY - r.top - V.oy) / V.cs); return M.dedans(G, x, y) ? [x, y] : null; }
cv.addEventListener('pointerdown', e => {
  audio(); dernierGeste = horloge; indice = null; if(!G || occupe || G.fini || pausee) return; const c = cellule(e); if(!c) return;
  if(mode){ utiliserAide(c); return; }
  if(sel && voisines(sel, c)){ const a = sel; sel = null; tenter(a, c); return; }
  if(sel && sel[0] === c[0] && sel[1] === c[1]){ sel = null; return; }
  if(M.mobile(G.p[c[1]][c[0]])){ sel = c; SON.clic(); glisse = { c, x:e.clientX, y:e.clientY }; try{ cv.setPointerCapture(e.pointerId); }catch(x){} }
});
cv.addEventListener('pointermove', e => {
  if(!glisse || occupe || pausee) return; const dx = e.clientX - glisse.x, dy = e.clientY - glisse.y;
  if(Math.hypot(dx, dy) > V.cs * .38){ const d = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)], a = glisse.c, b = [a[0] + d[0], a[1] + d[1]]; glisse = null; sel = null; tenter(a, b); }
});
const finGeste = () => { glisse = null; }; cv.addEventListener('pointerup', finGeste); cv.addEventListener('pointercancel', finGeste);
addEventListener('keydown', e => {
  if($('eJeu').hidden) return; kb = true;
  if(pausee){ if(e.key === 'Escape') reprendre(); return; }
  if(!G) return;
  const fl = { ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1] }[e.key];
  if(fl){ e.preventDefault(); if(occupe) return; if(sel){ const a = sel, b = [a[0] + fl[0], a[1] + fl[1]]; sel = null; tenter(a, b); } else { curseur = [clamp(curseur[0] + fl[0], 0, G.W - 1), clamp(curseur[1] + fl[1], 0, G.H - 1)]; } }
  else if(e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); if(occupe) return; if(mode){ utiliserAide(curseur); return; } if(sel){ sel = null; } else if(M.mobile(G.p[curseur[1]][curseur[0]])){ sel = curseur.slice(); SON.clic(); } }
  else if(e.key === '1') $('aMarteau').click(); else if(e.key === '2') $('aEclair').click(); else if(e.key === '3') $('aMelange').click();
  else if(e.key === 'Escape'){ if(sel || mode){ sel = null; mode = null; bandeau(null); majAides(); } else pause(); }
});
addEventListener('pointerdown', () => { kb = false; }, true);
function idle(){
  if(!G || G.fini || occupe || mode || $('eJeu').hidden) return;
  if(!indice && horloge - dernierGeste > 7000){ const c = M.coupsPossibles(G); if(c.length){ const [a, b] = c[Math.floor(Math.random() * c.length)]; indice = { a, b, t:0 }; } }
}
$('aMarteau').onclick = () => { audio(); if(occupe || !PR.aides.marteau) return; mode = mode === 'marteau' ? null : 'marteau'; majAides(); bandeau(mode ? '🔨 Touche la pièce à casser' : null, 0); };
$('aEclair').onclick = () => { audio(); if(occupe || !PR.aides.eclair) return; mode = mode === 'eclair' ? null : 'eclair'; majAides(); bandeau(mode ? '⚡ Touche une pièce : toute sa ligne disparaît' : null, 0); };
$('aMelange').onclick = () => { audio(); melangerAide(); };

/* ---------- Début et fin de niveau ---------- */
function lancer(n){
  audio(); niveauNum = n; const niv = NV.NIVEAUX[n - 1];
  G = M.creer(niv, 1 + Math.floor(Math.random() * 1e6)); aff = { chips:[] }; synchroHud();
  const mo = NV.MONDES[niv.monde]; $('fond').style.background = `linear-gradient(180deg, ${mo.ciel[0]}, ${mo.ciel[1]})`;
  $('jMonde').textContent = mo.nom; $('jNiveau').textContent = 'Niveau ' + n; construireObjs(); synchroHud(); majAides();
  $('eCarte').hidden = true; $('eJeu').hidden = false; ['vIntro', 'vFin', 'vPause'].forEach(i => $(i).hidden = true);
  mode = null; sel = null; indice = null; pausee = false; occupe = true; bandeau(null); PR.parties++; sauver();
  cadrer(); reconstruire();
  // les pièces tombent d'en haut
  const prom = []; for(const s of spr.values()){ const y1 = s.y, d = y1 + 4 + Math.random() * 2; s.y = -d; prom.push(attendre(s.x * 24 + (G.H - y1) * 20).then(() => tw(420 + y1 * 40, u => { s.y = -d + (y1 + d) * u; }, ease.rebond))); }
  Promise.all(prom).then(() => { occupe = false; dernierGeste = horloge; });
}
function objectifsTexte(niv){
  const co = niv.objectifs, l = [], puce = (kind, k, txt) => { const d = document.createElement('div'); d.className = 'obj'; d.appendChild(D.icone(kind, k)); const b = document.createElement('b'); b.textContent = txt; d.appendChild(b); return d; };
  const out = []; if(co.score) out.push(puce('score', 0, co.score.toLocaleString('fr-FR')));
  for(const [c, n] of Object.entries(co.collecte || {})) out.push(puce('p', +c, n));
  if(co.glace) out.push(puce('glace', 0, '×' + niv.forme.join('').split('').filter(ch => ch === 'g' || ch === 'G').length));
  if(co.neige) out.push(puce('neige', 0, '×' + niv.forme.join('').split('').filter(ch => 'nNM'.includes(ch)).length));
  if(co.cerises) out.push(puce('cerise', 0, co.cerises));
  return out;
}
function ouvrirIntro(n){
  audio(); const niv = NV.NIVEAUX[n - 1], mo = NV.MONDES[niv.monde], f = $('fIntro'), st = PR.etoiles[n] || 0;
  f.innerHTML = `<h3>${mo.ico} ${mo.nom}</h3><h2>Niveau ${n}</h2><p>${niv.coups} coups pour réussir :</p><div class="liste" id="iObjs"></div>${niv.aide ? `<div class="astuce">💡 ${niv.aide}</div>` : ''}<div class="etoilesFin" style="font-size:1.6rem;height:auto">${[1, 2, 3].map(i => `<i class="${i <= st ? 'ok' : ''}" style="transform:none">⭐</i>`).join('')}</div><button class="gros" id="bJouerN">Jouer</button><button class="gros gris" id="bFermerN">Retour à la carte</button>`;
  objectifsTexte(niv).forEach(d => $('iObjs').appendChild(d));
  $('vIntro').hidden = false; $('bJouerN').onclick = () => lancer(n); $('bFermerN').onclick = () => $('vIntro').hidden = true;
}
async function terminer(){
  await attendre(450); const gagne = G.fini === 'gagne', f = $('fFin');
  if(!gagne){
    SON.perdu(); const r = M.restant(G);
    f.innerHTML = `<h3>Niveau ${niveauNum}</h3><h2>Plus de coups !</h2><p>Il te manquait encore un peu pour réussir.</p><div class="liste" id="fObjs"></div>${PR.aides.jetons ? `<button class="gros or" id="bPlus">🎟️ +5 coups (${PR.aides.jetons} jeton${PR.aides.jetons > 1 ? 's' : ''})</button>` : ''}<button class="gros rose" id="bRejouer">Réessayer</button><button class="gros gris" id="bCarte">Carte</button>`;
    const l = $('fObjs');
    const puce = (kind, k, txt) => { const d = document.createElement('div'); d.className = 'obj'; d.appendChild(D.icone(kind, k)); const b = document.createElement('b'); b.textContent = txt; d.appendChild(b); l.appendChild(d); };
    if(r.score) puce('score', 0, r.score.toLocaleString('fr-FR')); for(const [c, n] of Object.entries(r.collecte || {})) if(n) puce('p', +c, n); if(r.glace) puce('glace', 0, r.glace); if(r.neige) puce('neige', 0, r.neige); if(r.cerises) puce('cerise', 0, r.cerises);
    $('vFin').hidden = false;
    const plus = $('bPlus'); if(plus) plus.onclick = () => { PR.aides.jetons--; sauver(); M.cinqCoups(G); synchroHud(); majAides(); $('vFin').hidden = true; occupe = false; bandeau('+5 coups !', 1500); };
    $('bRejouer').onclick = () => lancer(niveauNum); $('bCarte').onclick = () => ouvrirCarte();
    return;
  }
  SON.gagne();
  const etoiles = M.etoiles(G), bonus = G.coups * 250, total = G.score + bonus, premiere = !(niveauNum in PR.etoiles), avant = PR.etoiles[niveauNum] || 0;
  PR.victoires++; PR.etoiles[niveauNum] = Math.max(avant, etoiles); PR.scores[niveauNum] = Math.max(PR.scores[niveauNum] || 0, total); PR.maxNiveau = Math.max(PR.maxNiveau, Math.min(NV.NIVEAUX.length, niveauNum + 1)); PR.combosMax = Math.max(PR.combosMax, G.combosMax);
  let cadeau = '';
  if(premiere){ const k = ['marteau', 'eclair', 'melange'][niveauNum % 3]; PR.aides[k]++; cadeau = `🎁 Cadeau : +1 ${k === 'marteau' ? '🔨 marteau' : k === 'eclair' ? '⚡ éclair' : '🔀 mélange'}`; }
  if(etoiles === 3 && avant < 3){ PR.aides.jetons++; cadeau += `${cadeau ? '<br>' : ''}🎟️ 3 étoiles : +1 jeton (+5 coups)`; }
  sauver(); majAides();
  const suivant = niveauNum < NV.NIVEAUX.length;
  f.innerHTML = `<h3>Niveau ${niveauNum}</h3><h2>Bravo !</h2><div class="etoilesFin" id="fEtoiles"><i>⭐</i><i>⭐</i><i>⭐</i></div><div class="grandScore" id="fScore">0</div><p style="margin:2px 0">${bonus ? `dont <b>${bonus.toLocaleString('fr-FR')}</b> pts de bonus pour les ${G.coups} coups restants` : ''}</p>${cadeau ? `<div class="astuce">${cadeau}</div>` : ''}${suivant ? '<button class="gros" id="bSuivant">Niveau suivant</button>' : '<div class="astuce">🏆 Tu as terminé les 60 niveaux !</div>'}<button class="gros rose" id="bRejouer">Rejouer</button><button class="gros gris" id="bCarte">Carte</button>`;
  $('vFin').hidden = false;
  const el = [...$('fEtoiles').children]; el.forEach((s, i) => { if(i < etoiles) setTimeout(() => { s.classList.add('ok'); SON.etoile(i); }, 350 + i * 420); });
  const sc = $('fScore'); tw(900, u => { sc.textContent = Math.round(total * u).toLocaleString('fr-FR'); }, ease.out);
  if($('bSuivant')) $('bSuivant').onclick = () => { $('vFin').hidden = true; ouvrirCarte(); ouvrirIntro(niveauNum + 1); };
  $('bRejouer').onclick = () => lancer(niveauNum); $('bCarte').onclick = () => ouvrirCarte();
}

/* ---------- Pause, règles, son ---------- */
function pause(){
  if(!G || $('eJeu').hidden || pausee || G.fini) return; pausee = true;
  $('fPause').innerHTML = `<h2>Pause</h2><p>Niveau ${niveauNum}</p><button class="gros" id="bRepr">Reprendre</button><button class="gros rose" id="bRecom">Recommencer</button><button class="gros gris" id="bSon">${PR.son ? '🔊 Son activé' : '🔇 Son coupé'}</button><button class="gros gris" id="bQuit">Carte</button>`;
  $('vPause').hidden = false; $('bRepr').onclick = reprendre; $('bRecom').onclick = () => { $('vPause').hidden = true; pausee = false; lancer(niveauNum); };
  $('bSon').onclick = () => { basculerSon(); $('bSon').textContent = PR.son ? '🔊 Son activé' : '🔇 Son coupé'; }; $('bQuit').onclick = () => { pausee = false; ouvrirCarte(); };
}
function reprendre(){ pausee = false; $('vPause').hidden = true; dernierGeste = horloge; }
function basculerSon(){ PR.son = !PR.son; sauver(); $('bSonCarte').textContent = PR.son ? '🔊' : '🔇'; if(PR.son) audio(); }
$('bPause').onclick = () => { audio(); pause(); }; $('bSonCarte').onclick = basculerSon;
$('bAideCarte').onclick = () => $('vRegles').hidden = false; $('bRegleOk').onclick = () => { $('vRegles').hidden = true; ecrire('chalet-regles', true); };
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
addEventListener('resize', () => { cadrer(); tailleFond(); });

/* ---------- La carte des niveaux ---------- */
function ouvrirCarte(){
  G = null; ['vIntro', 'vFin', 'vPause'].forEach(i => $(i).hidden = true); $('eJeu').hidden = true; $('eCarte').hidden = false; pausee = false; occupe = false;
  const cur = Math.min(NV.NIVEAUX.length, PR.maxNiveau); $('sousTitre').textContent = `Niveau ${cur} · ⭐ ${totalEtoiles()} / ${NV.NIVEAUX.length * 3}`; majAides();
  const mo = NV.MONDES[Math.floor((cur - 1) / 10)]; $('fond').style.background = `linear-gradient(180deg, ${mo.ciel[0]}, ${mo.ciel[1]})`;
  construireCarte(cur);
}
function construireCarte(cur){
  const box = $('defile'); box.innerHTML = ''; let courant = null;
  const DECO = [['🌲', '⛄', '🏡', '❄️'], ['🌲', '🌲', '🦌', '❄️'], ['🏠', '🔥', '🧀', '☕'], ['⛷️', '🎿', '🚡', '🌨️'], ['🏔️', '🧗', '🦅', '❄️'], ['💎', '🔮', '🧊', '✨']];
  for(let w = 5; w >= 0; w--){
    const mo = NV.MONDES[w], sec = document.createElement('div'); sec.className = 'monde'; sec.style.background = `linear-gradient(180deg, ${mo.ciel[0]}, ${mo.ciel[1]})`;
    const h = document.createElement('h2'); h.textContent = `${mo.ico} ${mo.nom}`; sec.appendChild(h);
    const pts = []; for(let i = 0; i < 10; i++){ const n = w * 10 + i + 1; pts.push({ n, x:50 + Math.sin(i * .95 + w * 1.3) * 28, y:960 - 70 - i * 84 }); }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'chemin'); svg.setAttribute('viewBox', '0 0 100 960'); svg.setAttribute('preserveAspectRatio', 'none');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'path'); poly.setAttribute('d', pts.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ')); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'rgba(255,255,255,.85)'); poly.setAttribute('stroke-width', '2.4'); poly.setAttribute('stroke-dasharray', '1.5 3'); poly.setAttribute('stroke-linecap', 'round'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); poly.style.strokeWidth = '6px'; svg.appendChild(poly); sec.appendChild(svg);
    for(let k = 0; k < 8; k++){ const d = document.createElement('div'); d.className = 'deco'; d.textContent = DECO[w][k % 4]; d.style.left = (k % 2 ? 4 + (k * 7) % 14 : 80 + (k * 5) % 14) + '%'; d.style.top = (70 + k * 105) + 'px'; d.style.fontSize = (1.6 + (k % 3) * .5) + 'rem'; sec.appendChild(d); }
    for(const p of pts){
      const b = document.createElement('button'), st = PR.etoiles[p.n] || 0, clos = p.n > PR.maxNiveau;
      b.className = 'noeud ' + (clos ? 'clos' : p.n === cur && !(p.n in PR.etoiles) ? 'ici' : p.n in PR.etoiles ? 'fait' : 'ici'); b.style.left = p.x + '%'; b.style.top = p.y + 'px'; b.textContent = clos ? '🔒' : p.n;
      if(!clos && p.n in PR.etoiles){ const e = document.createElement('span'); e.className = 'etoiles'; e.textContent = '⭐'.repeat(st) + '☆'.repeat(3 - st); b.appendChild(e); }
      if(!clos) b.onclick = () => { audio(); SON.clic(); ouvrirIntro(p.n); }; else b.onclick = () => toast('Termine les niveaux d\'avant pour débloquer celui-ci');
      if(p.n === cur) courant = b; sec.appendChild(b);
    }
    box.appendChild(sec);
  }
  requestAnimationFrame(() => { if(courant) box.scrollTop = Math.max(0, courant.offsetTop + courant.parentElement.offsetTop - box.clientHeight / 2); });
}
function toast(t){ const d = document.createElement('div'); d.className = 'bandeau'; d.style.position = 'fixed'; d.style.top = 'calc(var(--barre-statut) + 70px)'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 1800); }

/* ---------- Démarrage ---------- */
tailleFond(); requestAnimationFrame(boucle); $('bSonCarte').textContent = PR.son ? '🔊' : '🔇';
ouvrirCarte(); if(!lire('chalet-regles', false)) setTimeout(() => { $('vRegles').hidden = false; }, 400);
window.Chalet = { get G(){ return G; }, M, NV, PR, lancer, tenter, ouvrirCarte, pause, reprendre, jouerEtapes, get spr(){ return spr; }, get vis(){ return vis; }, get aff(){ return aff; }, attendreCalme:() => new Promise(r => { const t = setInterval(() => { if(!occupe){ clearInterval(t); r(); } }, 30); }), get occupe(){ return occupe; } };
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
