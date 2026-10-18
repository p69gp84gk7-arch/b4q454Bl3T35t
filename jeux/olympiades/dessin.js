/* Olympiades : le dessin (vue de côté), les athlètes en volume et les décors.
   Scripts classiques qui partagent leurs déclarations : dessin.js, puis epreuves.js, puis la page. */
'use strict';
const $ = id => document.getElementById(id);
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const hasard = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while(!u) u = Math.random(); while(!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const virg = (v, n) => v.toFixed(n).replace('.', ',');
const deg = d => d * Math.PI / 180;
// un nombre « au hasard » mais toujours le même pour la même graine (la foule, les sapins…)
const fixe = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const cv = $('cv');
let g = cv.getContext('2d');
let W = 0, Hh = 0, DPR = 1, TEMPS = 0;

/* ---------- Les couleurs ---------- */
const TEINTES = new Map();
// k > 0 : plus clair (vers le blanc) ; k < 0 : plus sombre
function teinte(hex, k){
  const cle = hex + k; if(TEINTES.has(cle)) return TEINTES.get(cle);
  let h = hex.replace('#', ''); if(h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); let r = n >> 16, v = (n >> 8) & 255, b = n & 255;
  if(k >= 0){ r += (255 - r) * k; v += (255 - v) * k; b += (255 - b) * k; } else { r *= 1 + k; v *= 1 + k; b *= 1 + k; }
  const res = `rgb(${Math.round(r)},${Math.round(v)},${Math.round(b)})`; TEINTES.set(cle, res); return res;
}
const clarte = hex => { const n = parseInt(hex.replace('#', ''), 16); return ((n >> 16) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11) / 255; };

/* ---------- La caméra ----------
   Le monde en mètres (x vers la droite, y vers le haut). Le point (V.cx, V.cy) est à l'écran en (W * ANCRE, SOL()). */
let V = { cx:0, cy:0, s:40 };
let HAUT = 110;                                   // sous le bandeau du haut (mesuré)
const portrait = () => Hh > W;
const ANCRE = () => portrait() ? .34 : .36;
const SOL = () => Math.round(Hh * (portrait() ? .69 : .8));
const X = x => W * ANCRE() + (x - V.cx) * V.s, Y = y => SOL() - (y - V.cy) * V.s;
function camera(cx, cy, s){ V.cx = cx; V.cy = cy; V.s = s; }
// l'échelle (pixels par mètre) : un athlète d'environ 1,8 m bien visible
const echelle = () => clamp(Math.min(W / 6.4, (SOL() - HAUT) / 4.2), 24, 80);
// regarder devant l'athlète : moins loin quand l'écran est étroit
const avance = (k, s) => k * clamp(W / s / 24, .25, 1);

/* ---------- Les athlètes, en volume ----------
   La pose P (angles en radians depuis la verticale, + = vers l'avant) :
   { hanche (hauteur en m), torse, tete, j1:[cuisse, tibia], j2, b1:[bras, avant-bras], b2, rot, miroir }
   j1 / b1 : le côté proche ; j2 / b2 : le côté loin (dessiné plus sombre).
   L'apparence A : { peau, cheveux, coupe, c1, c2, c3, chaussures, modele ('debardeur', 'maillot', 'combi'), coiffe, num } */
const LUMIERE = [-.55, -.83];                      // la lumière vient d'en haut à gauche
function capsule(ax, ay, bx, by, ra, rb, coul){
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6, nx = -dy / L, ny = dx / L;
  g.fillStyle = coul; g.beginPath();
  g.moveTo(ax + nx * ra, ay + ny * ra); g.lineTo(bx + nx * rb, by + ny * rb);
  g.arc(bx, by, rb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  g.lineTo(ax - nx * ra, ay - ny * ra);
  g.arc(ax, ay, ra, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  g.fill();
}
// un membre arrondi : contour sombre, couleur, puis un reflet du côté de la lumière (effet de volume)
function membre(ax, ay, bx, by, ra, rb, coul, sombre = 0){
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6;
  let nx = -dy / L, ny = dx / L; if(nx * LUMIERE[0] + ny * LUMIERE[1] < 0){ nx = -nx; ny = -ny; }
  const o = Math.max(.7, V.s * .018);
  capsule(ax, ay, bx, by, ra + o, rb + o, teinte(coul, -.45 + sombre * .3));
  capsule(ax, ay, bx, by, ra, rb, teinte(coul, -.08 + sombre));
  capsule(ax + nx * ra * .4, ay + ny * ra * .4, bx + nx * rb * .4, by + ny * rb * .4, ra * .38, rb * .38, teinte(coul, .18 + sombre * .5));
}
function boule(x, y, r, coul, sombre = 0){
  g.fillStyle = teinte(coul, -.5 + sombre * .3); g.beginPath(); g.arc(x, y, r + Math.max(.7, V.s * .018), 0, 6.29); g.fill();
  const gr = g.createRadialGradient(x + r * LUMIERE[0] * .45, y + r * LUMIERE[1] * .45, r * .1, x, y, r);
  gr.addColorStop(0, teinte(coul, .3 + sombre * .5)); gr.addColorStop(1, teinte(coul, -.15 + sombre));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
}
const APP_DEFAUT = { peau:'#D9A27A', cheveux:'#3A2A1E', coupe:'court', c1:'#D7263D', c2:'#FFFFFF', c3:'#1C2433', chaussures:'#F2F2F2', modele:'debardeur', coiffe:null, num:1 };
// ombre portée sur le sol (sol : hauteur du sol en m sous l'athlète)
function ombre(x, sol, haut = 0, larg = .8){
  const k = clamp(1 - haut / 4, .25, 1);
  g.fillStyle = `rgba(20,25,35,${.22 * k})`; g.beginPath(); g.ellipse(X(x), Y(sol) + 1, larg * V.s * k * .5, V.s * .07 * k, 0, 0, 6.29); g.fill();
}
// dessine l'athlète ; renvoie la position de la main proche (en pixels, par rapport à la hanche, avant rotation)
function athlete(x, y, P, A = APP_DEFAUT, alpha = 1, taille = 1){
  const s = V.s * taille, hx = X(x), hy = Y(y + P.hanche * taille);
  g.save(); g.globalAlpha = alpha; g.translate(hx, hy); if(P.miroir) g.scale(-1, 1); if(P.rot) g.rotate(P.rot);
  const dir = (a, l) => [Math.sin(a) * l * s, Math.cos(a) * l * s];
  const tr = P.torse || 0, cou = [Math.sin(tr) * .52 * s, -Math.cos(tr) * .52 * s];
  const epaule = [cou[0] * .9 - Math.cos(tr) * .02 * s, cou[1] * .9];
  const combi = A.modele === 'combi', tshirt = A.modele === 'maillot';
  const peauL = A.peau, haut = A.c1, bas = combi ? A.c1 : A.c3;
  const jambe = (ang, sombre) => {
    const k = dir(ang[0], .46), p = [k[0] + Math.sin(ang[1]) * .45 * s, k[1] + Math.cos(ang[1]) * .45 * s];
    const cuisse = combi ? bas : peauL;
    membre(0, 0, k[0], k[1], .105 * s, .075 * s, cuisse, sombre);
    membre(k[0], k[1], p[0], p[1], .072 * s, .045 * s, combi ? bas : peauL, sombre);
    // le short (ou le cuissard) par-dessus la cuisse
    const f = combi ? 0 : tshirt ? .78 : .4;
    if(f) membre(0, 0, k[0] * f, k[1] * f, .118 * s, (.112 - .03 * f) * s, bas, sombre);
    if(combi && A.c2) membre(k[0] * .1, k[1] * .1, k[0] * .9, k[1] * .9, .03 * s, .025 * s, A.c2, sombre);
    // la chaussure : vers l'avant, perpendiculaire au tibia
    const pa = ang[1] + Math.PI / 2, pied = [p[0] + Math.sin(pa) * .2 * s, p[1] + Math.cos(pa) * .2 * s];
    membre(p[0] - Math.sin(pa) * .04 * s, p[1] - Math.cos(pa) * .04 * s, pied[0], pied[1], .05 * s, .036 * s, A.chaussures, sombre);
    // la semelle (claire), sous la chaussure
    const sd = [Math.sin(ang[1]) * .045 * s, Math.cos(ang[1]) * .045 * s];
    g.strokeStyle = teinte(A.chaussures === '#F2F2F2' ? '#9AA3AF' : '#FFFFFF', sombre * .5); g.lineWidth = Math.max(1, .025 * s); g.lineCap = 'round';
    g.beginPath(); g.moveTo(p[0] + sd[0] - Math.sin(pa) * .05 * s, p[1] + sd[1] - Math.cos(pa) * .05 * s); g.lineTo(pied[0] + sd[0], pied[1] + sd[1]); g.stroke();
  };
  const bras = (ang, sombre) => {
    const k = [epaule[0] + Math.sin(ang[0]) * .29 * s, epaule[1] + Math.cos(ang[0]) * .29 * s], m = [k[0] + Math.sin(ang[1]) * .27 * s, k[1] + Math.cos(ang[1]) * .27 * s];
    membre(epaule[0], epaule[1], k[0], k[1], .058 * s, .045 * s, combi ? haut : peauL, sombre);
    membre(k[0], k[1], m[0], m[1], .045 * s, .035 * s, combi ? haut : peauL, sombre);
    if(tshirt) membre(epaule[0], epaule[1], epaule[0] + (k[0] - epaule[0]) * .5, epaule[1] + (k[1] - epaule[1]) * .5, .07 * s, .062 * s, haut, sombre);
    if(combi && A.gants) boule(m[0], m[1], .05 * s, A.gants, sombre); else boule(m[0], m[1], .045 * s, peauL, sombre);
    return m;
  };
  g.lineCap = g.lineJoin = 'round';
  // le côté loin, plus sombre
  bras(P.b2 || [0, 0], -.22); jambe(P.j2 || [0, 0], -.22);
  // le torse (maillot) : plus large à la poitrine, avec une bande de la deuxième couleur
  membre(0, 0, cou[0], cou[1], .15 * s, .165 * s, haut);
  if(A.c2 && A.c2 !== A.c1){ const o = .07 * s; g.save(); g.globalAlpha *= .95;
    membre(Math.cos(tr) * o * -.2, Math.sin(tr) * o * -.2, cou[0] * .9 - Math.cos(tr) * o, cou[1] * .9 - Math.sin(tr) * o, .035 * s, .04 * s, A.c2); g.restore(); }
  // le dossard (l'été)
  if(A.num && !combi){ g.save(); g.translate(cou[0] * .55 + Math.cos(tr) * .08 * s, cou[1] * .55 + Math.sin(tr) * .08 * s); g.rotate(tr);
    g.fillStyle = '#FFFFFF'; g.fillRect(-.065 * s, -.06 * s, .13 * s, .1 * s); g.fillStyle = '#1C2433'; g.font = `800 ${Math.max(6, .075 * s)}px "Bricolage Grotesque", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(A.num, 0, -.01 * s); g.restore(); }
  jambe(P.j1 || [0, 0], 0);
  // le cou et la tête
  const ta = tr + (P.tete || 0), t0 = [cou[0] + Math.sin(ta) * .05 * s, cou[1] - Math.cos(ta) * .05 * s], tc = [cou[0] + Math.sin(ta) * .17 * s, cou[1] - Math.cos(ta) * .17 * s], R = .12 * s;
  membre(cou[0], cou[1], t0[0], t0[1], .05 * s, .048 * s, peauL);
  boule(tc[0], tc[1], R, peauL);
  // le visage, vers l'avant : nez, œil, oreille
  const av = [Math.cos(ta), Math.sin(ta)], ht = [Math.sin(ta), -Math.cos(ta)];
  g.fillStyle = teinte(peauL, -.12); g.beginPath(); g.moveTo(tc[0] + av[0] * R * .92 + ht[0] * R * .1, tc[1] + av[1] * R * .92 + ht[1] * R * .1); g.lineTo(tc[0] + av[0] * R * 1.18 - ht[0] * R * .12, tc[1] + av[1] * R * 1.18 - ht[1] * R * .12); g.lineTo(tc[0] + av[0] * R * .9 - ht[0] * R * .25, tc[1] + av[1] * R * .9 - ht[1] * R * .25); g.fill();
  g.fillStyle = teinte(peauL, -.25); g.beginPath(); g.arc(tc[0] - av[0] * R * .12, tc[1] - av[1] * R * .12, R * .2, 0, 6.29); g.fill();
  const coiffe = A.coiffe;
  if(coiffe === 'casque' || coiffe === 'bonnet' || coiffe === 'bain'){
    const cc = coiffe === 'bain' ? A.c1 : A.c1;
    g.fillStyle = teinte(cc, -.05); g.beginPath(); g.arc(tc[0], tc[1], R * (coiffe === 'casque' ? 1.18 : 1.06), Math.atan2(ht[1], ht[0]) - 2, Math.atan2(ht[1], ht[0]) + 1.75); g.fill();
    g.fillStyle = teinte(cc, .35); g.beginPath(); g.arc(tc[0] - av[0] * R * .2 + ht[0] * R * .35, tc[1] - av[1] * R * .2 + ht[1] * R * .35, R * .35, 0, 6.29); g.fill();
    if(coiffe === 'bonnet'){ boule(tc[0] + ht[0] * R * 1.15 - av[0] * R * .2, tc[1] + ht[1] * R * 1.15 - av[1] * R * .2, R * .28, A.c2 || '#FFFFFF'); }
    if(coiffe === 'casque' || A.lunettes){ g.fillStyle = '#1C2433'; g.beginPath(); g.ellipse(tc[0] + av[0] * R * .62 + ht[0] * R * .22, tc[1] + av[1] * R * .62 + ht[1] * R * .22, R * .42, R * .2, ta, 0, 6.29); g.fill();
      g.fillStyle = 'rgba(140,200,255,.8)'; g.beginPath(); g.ellipse(tc[0] + av[0] * R * .78 + ht[0] * R * .26, tc[1] + av[1] * R * .78 + ht[1] * R * .26, R * .22, R * .1, ta, 0, 6.29); g.fill(); }
    if(coiffe === 'bain'){ g.fillStyle = '#1C2433'; g.beginPath(); g.ellipse(tc[0] + av[0] * R * .8 + ht[0] * R * .12, tc[1] + av[1] * R * .8 + ht[1] * R * .12, R * .2, R * .12, ta, 0, 6.29); g.fill(); }
  } else {
    // l'œil et les cheveux
    g.fillStyle = '#1C2433'; g.beginPath(); g.arc(tc[0] + av[0] * R * .62 + ht[0] * R * .18, tc[1] + av[1] * R * .62 + ht[1] * R * .18, Math.max(1, R * .1), 0, 6.29); g.fill();
    cheveux(tc, R, av, ht, A, ta);
  }
  const main = bras(P.b1 || [0, 0], 0);
  g.restore();
  return P.miroir ? [-main[0], main[1]] : main;
}
function cheveux(tc, R, av, ht, A, ta){
  const c = A.cheveux, base = Math.atan2(ht[1], ht[0]);
  if(A.coupe === 'rase'){ g.fillStyle = teinte(c, 0); g.globalAlpha *= .35; g.beginPath(); g.arc(tc[0], tc[1], R * 1.01, base - 1.9, base + .9); g.fill(); g.globalAlpha /= .35; return; }
  g.fillStyle = teinte(c, -.05); g.beginPath(); g.arc(tc[0], tc[1], R * 1.08, base - 2.05, base + 1.0); g.lineTo(tc[0] + av[0] * R * .1, tc[1] + av[1] * R * .1); g.fill();
  g.fillStyle = teinte(c, .25); g.beginPath(); g.arc(tc[0] + ht[0] * R * .5 - av[0] * R * .2, tc[1] + ht[1] * R * .5 - av[1] * R * .2, R * .3, 0, 6.29); g.fill();
  if(A.coupe === 'queue'){ const bal = Math.sin(TEMPS * 9) * .35, a0 = ta - Math.PI * .55 + bal;
    const d = [tc[0] - av[0] * R * .95 + ht[0] * R * .3, tc[1] - av[1] * R * .95 + ht[1] * R * .3];
    membre(d[0], d[1], d[0] + Math.sin(a0 + Math.PI) * -R * 1.6, d[1] + Math.cos(a0 + Math.PI) * -R * 1.6 + R * .5, R * .22, R * .12, c); }
  if(A.coupe === 'chignon') boule(tc[0] - av[0] * R * .85 + ht[0] * R * .55, tc[1] - av[1] * R * .85 + ht[1] * R * .55, R * .38, c);
  if(A.coupe === 'boucles') for(let k = 0; k < 7; k++){ const a = base - 1.9 + k * .45; boule(tc[0] + Math.cos(a) * R * 1.02, tc[1] + Math.sin(a) * R * 1.02, R * .32, c); }
}
const DEBOUT = { hanche:.95, torse:0, j1:[0, 0], j2:[0, 0], b1:[.1, .25], b2:[-.1, .1] };
// la course : ph = phase de la foulée, v = vitesse (le buste se penche avec la vitesse)
function course(ph, v = 8, extra = {}){
  const L = p => { const c = .78 * Math.sin(p); return [c, c - (.2 + 1.25 * Math.max(0, Math.cos(p + .4)))]; };
  const k = clamp(v / 9, .3, 1.1);
  return { hanche:.92 + .04 * Math.abs(Math.cos(ph)), torse:.1 + v * .013, tete:-.05, j1:L(ph).map(a => a * k), j2:L(ph + Math.PI).map(a => a * k),
    b1:[-.85 * Math.sin(ph) * k, -.85 * Math.sin(ph) * k + 1.55], b2:[.85 * Math.sin(ph) * k, .85 * Math.sin(ph) * k + 1.55], ...extra };
}

/* ---------- Les décors ---------- */
function ciel(haut = '#5D9FDB', bas = '#CFE6F7'){
  const gr = g.createLinearGradient(0, 0, 0, SOL()); gr.addColorStop(0, haut); gr.addColorStop(1, bas); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  // quelques nuages qui passent lentement
  g.fillStyle = 'rgba(255,255,255,.75)';
  for(let k = 0; k < 4; k++){ const l = 160 + fixe(k) * 120, x = ((fixe(k + 9) * (W + 400) - V.cx * V.s * .03 - TEMPS * (4 + k)) % (W + 400) + W + 400) % (W + 400) - 200, y = HAUT + 10 + fixe(k + 3) * (SOL() * .35);
    for(let i = 0; i < 4; i++){ g.beginPath(); g.ellipse(x + i * l * .22, y + Math.sin(i * 2) * 6, l * .2, l * .09, 0, 0, 6.29); g.fill(); } }
}
// La foule : une bande dessinée une fois (pour aller vite), qui défile moins vite que la piste
let FOULE = null;
function tuileFoule(h){
  if(FOULE && Math.abs(FOULE.h - h) < 2) return FOULE;
  const c = document.createElement('canvas'), w = 720; c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
  const q = c.getContext('2d'); q.scale(DPR, DPR);
  const rangs = 7, rh = h / rangs, COUL = ['#E8434F', '#F2C230', '#FFFFFF', '#1F6FE0', '#2E9E5B', '#F28C30', '#8E44AD', '#13233A'];
  const PEAUX = ['#F1C9A5', '#D9A27A', '#B57A4F', '#8A5634', '#5E3A22'];
  for(let r = 0; r < rangs; r++){
    const y = r * rh, k = r / rangs;
    q.fillStyle = r % 2 ? '#4A5366' : '#535D72'; q.fillRect(0, y, w, rh);
    q.fillStyle = 'rgba(0,0,0,.18)'; q.fillRect(0, y + rh * .82, w, rh * .18);
    const pas = Math.max(7, rh * .62);
    for(let x = (r % 2) * pas / 2; x < w; x += pas){
      const n = r * 1000 + Math.round(x), vide = fixe(n * 3) < .06; if(vide) continue;
      const cx = x + (fixe(n) - .5) * pas * .3, corps = COUL[Math.floor(fixe(n + 1) * COUL.length)];
      q.fillStyle = corps; q.beginPath(); q.ellipse(cx, y + rh * .78, pas * .38, rh * .34, 0, Math.PI, 0); q.fill();
      q.fillStyle = PEAUX[Math.floor(fixe(n + 2) * PEAUX.length)]; q.beginPath(); q.arc(cx, y + rh * .36, Math.min(pas, rh) * .2, 0, 6.29); q.fill();
      if(fixe(n + 4) < .12){ q.fillStyle = COUL[Math.floor(fixe(n + 5) * COUL.length)]; q.fillRect(cx + 2, y + rh * .05, pas * .5, rh * .26); }   // des drapeaux et des banderoles
    }
    q.fillStyle = `rgba(20,25,40,${.25 * (1 - k)})`; q.fillRect(0, y, w, rh);   // le haut des gradins est plus loin, plus sombre
  }
  FOULE = { c, h, w };
  return FOULE;
}
function tribunes(){
  const y0 = Y(0) - V.s * 5.2, h = V.s * 3.4;
  if(y0 + h < 0) return;
  // le toit et les projecteurs
  g.fillStyle = '#2B3245'; g.fillRect(0, y0 - V.s * .9, W, V.s * .9);
  g.fillStyle = '#3B4459'; g.fillRect(0, y0 - V.s * .25, W, V.s * .25);
  const dl = -(V.cx * V.s * .3) % 220;
  for(let x = dl - 220; x < W + 220; x += 220){ g.fillStyle = 'rgba(255,248,210,.95)'; g.fillRect(x + 20, y0 - V.s * .75, V.s * .9, V.s * .3); g.fillStyle = 'rgba(255,248,210,.12)'; g.beginPath(); g.moveTo(x + 20, y0 - V.s * .45); g.lineTo(x + 20 + V.s * .9, y0 - V.s * .45); g.lineTo(x + 120, y0 + h); g.lineTo(x - 80, y0 + h); g.fill(); }
  const T = tuileFoule(h), dec = ((-(V.cx * V.s * .35)) % T.w + T.w) % T.w;
  for(let x = dec - T.w; x < W; x += T.w) g.drawImage(T.c, x, y0, T.w, h);
  // la foule qui bouge un peu : des bras levés
  g.strokeStyle = 'rgba(255,230,200,.8)'; g.lineWidth = Math.max(1.5, V.s * .04); g.lineCap = 'round';
  for(let k = 0; k < 14; k++){ const bx = (fixe(k) * W * 1.3 - V.cx * V.s * .35 % W + W * 2) % W, by = y0 + h * (.15 + fixe(k + 5) * .7), lev = Math.max(0, Math.sin(TEMPS * 5 + k * 1.7));
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 3, by - lev * V.s * .25); g.stroke(); }
  // le mur et les panneaux publicitaires
  g.fillStyle = '#232A3A'; g.fillRect(0, y0 + h, W, Y(0) - V.s * 1.7 - (y0 + h));
  const gr = g.createLinearGradient(0, Y(0) - V.s * 1.7, 0, Y(0) - V.s * 1.1); gr.addColorStop(0, '#1F6FE0'); gr.addColorStop(1, '#13233A');
  g.fillStyle = gr; g.fillRect(0, Y(0) - V.s * 1.7, W, V.s * .6);
  g.fillStyle = 'rgba(255,255,255,.88)'; g.font = `800 ${Math.round(V.s * .3)}px "Bricolage Grotesque", sans-serif`; g.textBaseline = 'middle';
  const dp = -(V.cx * V.s) % 300;
  for(let x = dp - 300; x < W + 300; x += 300) g.fillText(x / 300 % 2 ? 'OLYMPIADES' : 'ALTITUDE ARCADE', x + 10, Y(0) - V.s * 1.4);
  g.textBaseline = 'alphabetic';
}
// la piste : l'herbe au fond, les couloirs (plus serrés au fond pour la profondeur), le bord devant
function piste(rouge = '#C8553D', lignes = true){
  const y0 = Y(0);
  g.fillStyle = '#4E8F3E'; g.fillRect(0, y0 - V.s * 1.1, W, V.s * .5);
  g.fillStyle = 'rgba(255,255,255,.06)'; for(let x = (-(V.cx * V.s * .9) % 80) - 80; x < W; x += 80) g.fillRect(x, y0 - V.s * 1.1, 40, V.s * .5);
  const gr = g.createLinearGradient(0, y0 - V.s * .6, 0, y0 + V.s * .9); gr.addColorStop(0, teinte(rouge, -.18)); gr.addColorStop(1, teinte(rouge, .08));
  g.fillStyle = gr; g.fillRect(0, y0 - V.s * .6, W, V.s * 1.5);
  if(lignes){ g.fillStyle = 'rgba(255,255,255,.75)'; for(const k of [-.6, -.42, -.26, -.12, .02, .2, .42, .68]) g.fillRect(0, y0 + V.s * k, W, Math.max(1, V.s * (.012 + (k + .6) * .012))); }
  // le bord de la piste et la pelouse de devant
  g.fillStyle = '#E9E5DA'; g.fillRect(0, y0 + V.s * .9, W, V.s * .08);
  const gp = g.createLinearGradient(0, y0 + V.s, 0, Hh); gp.addColorStop(0, '#5E9E4A'); gp.addColorStop(1, '#3F7533');
  g.fillStyle = gp; g.fillRect(0, y0 + V.s * .98, W, Hh);
}
function reperes(de, a, pas, y = 0, dy = .62){
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `800 ${clamp(V.s * .28, 10, 16)}px "Bricolage Grotesque", sans-serif`; g.textAlign = 'center';
  for(let x = Math.ceil(de / pas) * pas; x <= a; x += pas){ const sx = X(x); if(sx < -40 || sx > W + 40) continue; g.fillRect(sx - 1, Y(y) + V.s * .05, 2, V.s * .3); g.fillText(`${x} m`, sx, Y(y) + V.s * dy); }
  g.textAlign = 'left';
}
// Les montagnes en trois plans (le plus loin bouge le moins), avec leurs neiges
function montagnes(){
  const plans = [[.03, '#A9BCD6', 10, 520], [.07, '#8FA6C4', 7.5, 380], [.14, '#6F8AAD', 5, 300]];
  plans.forEach(([p, coul, hm, larg], i) => {
    const base = SOL() - V.s * (1.2 + i * .2), dec = -(V.cx * V.s * p) % larg;
    for(let x = dec - larg; x < W + larg; x += larg){
      const k = Math.floor((x - dec) / larg) + i * 31, h1 = V.s * hm * (.7 + fixe(k) * .5), h2 = V.s * hm * (.5 + fixe(k + 1) * .45);
      const pts = [[x, base], [x + larg * .28, base - h1], [x + larg * .5, base - h1 * .55], [x + larg * .72, base - h2], [x + larg * 1.02, base]];
      const gr = g.createLinearGradient(0, base - h1, 0, base); gr.addColorStop(0, teinte(coul, .1)); gr.addColorStop(1, teinte(coul, -.08));
      g.fillStyle = gr; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for(const q of pts.slice(1)) g.lineTo(q[0], q[1]); g.fill();
      // la neige des sommets
      g.fillStyle = 'rgba(255,255,255,.92)';
      for(const [j, hh] of [[1, h1], [3, h2]]){ const [sx, sy] = pts[j], d = hh * .28;
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + d * .55, sy + d); g.lineTo(sx + d * .15, sy + d * .8); g.lineTo(sx - d * .1, sy + d * 1.05); g.lineTo(sx - d * .45, sy + d * .85); g.closePath(); g.fill(); }
      // l'ombre du versant
      g.fillStyle = 'rgba(20,40,80,.12)'; g.beginPath(); g.moveTo(pts[1][0], pts[1][1]); g.lineTo(pts[2][0], pts[2][1]); g.lineTo(pts[2][0] + larg * .05, base); g.lineTo(pts[1][0] + larg * .1, base); g.fill();
    }
  });
}
function sapin(x, y, h){
  g.fillStyle = '#5B3A22'; g.fillRect(x - h * .04, y - h * .15, h * .08, h * .15);
  for(let k = 0; k < 3; k++){ const yb = y - h * (.12 + k * .26), l = h * (.42 - k * .1);
    g.fillStyle = k % 2 ? '#2F6B4F' : '#285E46'; g.beginPath(); g.moveTo(x, yb - h * .4); g.lineTo(x + l, yb); g.lineTo(x - l, yb); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(x, yb - h * .4); g.lineTo(x + l * .45, yb - h * .2); g.lineTo(x - l * .3, yb - h * .22); g.fill(); }
}
function sapins(dy = 1.2){
  const dec = -(V.cx * V.s * .25) % 90;
  for(let x = dec - 90; x < W + 90; x += 30){ const n = Math.round((x - dec) / 30) + Math.floor(V.cx * V.s * .25 / 90) * 3; if(fixe(n) < .35) continue; sapin(x + fixe(n + 1) * 20, SOL() - V.s * dy, V.s * (1.4 + fixe(n + 2) * 1.4)); }
}
// la neige : une pente (fonction sol(x)) avec des reflets et des traces
function neige(sol, x0, x1){
  g.beginPath(); g.moveTo(-10, Hh);
  for(let px = -10; px <= W + 10; px += 8){ const x = V.cx + (px - W * ANCRE()) / V.s; g.lineTo(px, Y(sol(x))); }
  g.lineTo(W + 10, Hh); g.closePath();
  const gr = g.createLinearGradient(0, SOL() - V.s, 0, Hh); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#D3E2F2'); g.fillStyle = gr; g.fill();
  g.strokeStyle = 'rgba(120,150,190,.5)'; g.lineWidth = 2; g.beginPath();
  for(let px = -10; px <= W + 10; px += 8){ const x = V.cx + (px - W * ANCRE()) / V.s; g.lineTo(px, Y(sol(x))); } g.stroke();
  g.strokeStyle = 'rgba(120,150,190,.25)'; g.lineWidth = 1.5;
  for(const d of [.25, .6]){ g.beginPath(); for(let px = -10; px <= W + 10; px += 8){ const x = V.cx + (px - W * ANCRE()) / V.s; g.lineTo(px, Y(sol(x)) + V.s * d); } g.stroke(); }
}

/* ---------- Ce qui s'affiche par-dessus la scène ---------- */
// le chrono, la vitesse… en haut à droite, sous le bandeau
function info(lignes){
  g.font = '400 30px "Bebas Neue", sans-serif'; g.textAlign = 'right';
  lignes.forEach((t, i) => { const y = HAUT + 26 + i * 30; g.lineWidth = 4; g.strokeStyle = 'rgba(28,36,51,.6)'; g.strokeText(t, W - 14, y); g.fillStyle = '#fff'; g.fillText(t, W - 14, y); });
  g.textAlign = 'left';
}
// une jauge (avec, si on veut, la zone verte à viser)
function jauge(x, y, w, h, k, coul, zone, etiquette){
  g.fillStyle = 'rgba(28,36,51,.7)'; arrondi(x - 3, y - 3, w + 6, h + 6, (h + 6) / 2); g.fill();
  if(zone){ g.fillStyle = 'rgba(46,190,100,.75)'; g.fillRect(x + w * zone[0], y, w * (zone[1] - zone[0]), h); }
  g.fillStyle = coul; g.fillRect(x, y, Math.max(0, w * clamp(k, 0, 1)), h);
  if(etiquette){ g.fillStyle = '#fff'; g.font = '800 12px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center'; g.fillText(etiquette, x + w / 2, y + h + 16); g.textAlign = 'left'; }
}
function arrondi(x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// l'angle du saut ou du lancer, choisi en maintenant le bouton : l'arc vert est le bon angle
function rapporteur(x, y, ang, ideal){
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(28,36,51,.55)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 66, -Math.PI / 2, 0); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 58, -Math.PI / 2, 0); g.stroke();
  if(ideal !== undefined){ g.strokeStyle = 'rgba(46,200,100,.95)'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 58, -ideal - .13, -ideal + .13); g.stroke(); }
  g.strokeStyle = '#F2C230'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * 64, -Math.sin(ang) * 64); g.stroke();
  g.fillStyle = '#fff'; g.font = '400 26px "Bebas Neue", sans-serif'; g.fillText(Math.round(ang * 180 / Math.PI) + '°', 10, -10);
  g.restore();
}
// un anneau qui se resserre : appuyer quand il touche le cercle (le bon moment)
function cible(x, y, k, ok){
  g.save(); g.lineWidth = 4;
  g.strokeStyle = ok ? 'rgba(46,200,100,.95)' : 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x, y, 18, 0, 6.29); g.stroke();
  g.strokeStyle = ok ? 'rgba(46,200,100,.95)' : 'rgba(242,194,48,.95)'; g.beginPath(); g.arc(x, y, 18 + Math.max(0, k) * 60, 0, 6.29); g.stroke();
  g.restore();
}
let annonceT = 0;
function annoncer(txt, sous = '', duree = 1.2){ $('annonce').innerHTML = esc(txt) + (sous ? `<small>${esc(sous)}</small>` : ''); $('annonce').style.opacity = 1; annonceT = duree; }
