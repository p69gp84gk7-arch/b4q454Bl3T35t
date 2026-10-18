'use strict';
/* Nivoculteur 2D · le dessin de la carte (vue de dessus, à plat)
   Le terrain (relief ombré, courbes de niveau, pistes, forêt, bâtiments) est dessiné une fois dans une image ;
   le réseau, les canons, les tas de neige et la nuit sont dessinés à chaque image. */

const ECH = 2;                         // pixels par mètre dans l'image du terrain
const cv = document.getElementById('carte'), g = cv.getContext('2d');
const cam = { x:0, y:0, z:1 };         // centre de la vue (m) et zoom (pixels écran par mètre)
let LW = 0, LH = 0, DPR = 1, fond = null;
function tailleCarte(){
  DPR = Math.min(2, window.devicePixelRatio || 1); LW = innerWidth; LH = innerHeight;
  cv.width = Math.round(LW * DPR); cv.height = Math.round(LH * DPR);
}
const versEcran = (x, y) => [(x - cam.x) * cam.z + LW / 2, (y - cam.y) * cam.z + LH / 2];
const versMonde = (sx, sy) => [(sx - LW / 2) / cam.z + cam.x, (sy - LH / 2) / cam.z + cam.y];
// Toute la carte dans l'écran (en laissant la place du haut et du bas)
function ajusterVue(dom){
  // la carte entière entre les compteurs (en haut, ~100 px) et les boutons (en bas, ~160 px sur téléphone)
  const haut = (document.getElementById('haut').offsetHeight || 100) + 4, bas = 85;
  cam.z = Math.min(LW / (dom.W + 16), (LH - haut - bas) / (dom.H + 16));
  cam.x = dom.W / 2; cam.y = dom.H / 2 + (bas - haut) / 2 / cam.z;
}

/* ---------- Le terrain : relief ombré, courbes de niveau, forêt, pistes, salle ---------- */
function preparerFond(dom){
  // 1. le relief, à 1 pixel par mètre
  const W = Math.ceil(dom.W), H = Math.ceil(dom.H), base = document.createElement('canvas');
  base.width = W; base.height = H;
  const bx = base.getContext('2d'), id = bx.createImageData(W, H), d = id.data;
  const A = new Float32Array((W + 1) * (H + 1));
  for(let y = 0; y <= H; y++) for(let x = 0; x <= W; x++) A[y * (W + 1) + x] = dom.alt(x, y);
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const k = y * (W + 1) + x, a = A[k], ax = A[k + 1] - a, ay = A[k + W + 1] - a;
    const ombre = (-ax * .9 + ay * .55) * 9;                         // lumière venant du haut à gauche
    const courbe = Math.floor(a / 10) !== Math.floor(A[k + 1] / 10) || Math.floor(a / 10) !== Math.floor(A[k + W + 1] / 10);
    const maitresse = courbe && (Math.floor(a / 50) !== Math.floor(A[k + 1] / 50) || Math.floor(a / 50) !== Math.floor(A[k + W + 1] / 50));
    let r = 226 + ombre, gg = 234 + ombre, b = 246 + ombre * .6;
    if(y > dom.front){ r += 4; gg += 3; }
    if(courbe){ const f = maitresse ? .78 : .88; r *= f; gg *= f; b *= f * 1.02; }
    const p = (y * W + x) * 4; d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = 255;
  }
  bx.putImageData(id, 0, 0);
  // 2. l'image du terrain à ECH pixels par mètre
  fond = document.createElement('canvas'); fond.width = W * ECH; fond.height = H * ECH;
  const f = fond.getContext('2d');
  f.imageSmoothingEnabled = true; f.drawImage(base, 0, 0, fond.width, fond.height);
  f.scale(ECH, ECH);
  // les pistes : bords de leur couleur, neige damée plus blanche
  for(const p of dom.pistes){
    f.lineJoin = f.lineCap = 'round';
    f.strokeStyle = COULEURS_PISTES[p.couleur]; f.globalAlpha = .85; f.lineWidth = p.largeur + 2.4; trace(f, p.points); f.stroke();
    f.globalAlpha = 1; f.strokeStyle = 'rgba(250,252,255,.93)'; f.lineWidth = p.largeur; trace(f, p.points); f.stroke();
    // rayures de damage, en long
    f.strokeStyle = 'rgba(190,205,228,.35)'; f.lineWidth = .5;
    for(const dec of [-p.largeur * .3, 0, p.largeur * .3]){ f.beginPath(); p.points.forEach(([x, y], i) => { const n = normale(p.points, i); i ? f.lineTo(x + n[0] * dec, y + n[1] * dec) : f.moveTo(x + n[0] * dec, y + n[1] * dec); }); f.stroke(); }
  }
  // la forêt
  for(const [x, y, r] of dom.sapins){ f.fillStyle = 'rgba(60,80,110,.18)'; f.beginPath(); f.arc(x + .8, y + .8, r, 0, 6.29); f.fill(); }
  for(const [x, y, r] of dom.sapins){ f.fillStyle = '#2C5C46'; f.beginPath(); f.arc(x, y, r, 0, 6.29); f.fill(); f.fillStyle = '#3B7A5D'; f.beginPath(); f.arc(x - r * .25, y - r * .25, r * .55, 0, 6.29); f.fill(); }
  // le télésiège, à l'arrêt : la saignée dans la forêt, les gares, les pylônes, le câble et les sièges immobiles
  const T = dom.telesiege;
  if(T){
    const ux = (T.haut.x - T.bas.x) / T.longueur, uy = (T.haut.y - T.bas.y) / T.longueur, nx = -uy, ny = ux, e = 2.2;
    f.lineCap = 'butt';
    for(const s of [-e, e]){
      f.strokeStyle = 'rgba(40,55,80,.18)'; f.lineWidth = .35; f.beginPath(); f.moveTo(T.bas.x + nx * s + 1.5, T.bas.y + ny * s + 1.5); f.lineTo(T.haut.x + nx * s + 1.5, T.haut.y + ny * s + 1.5); f.stroke();
    }
    for(const p of T.pylones){ f.fillStyle = 'rgba(40,55,80,.25)'; f.fillRect(p.x + .6, p.y + .6, 1.6, 1.6); f.fillStyle = '#5E6B80'; f.fillRect(p.x - .8, p.y - .8, 1.6, 1.6);
      f.strokeStyle = '#4A566A'; f.lineWidth = .7; f.beginPath(); f.moveTo(p.x - nx * (e + .9), p.y - ny * (e + .9)); f.lineTo(p.x + nx * (e + .9), p.y + ny * (e + .9)); f.stroke(); }
    for(const s of [-e, e]){ f.strokeStyle = '#3E4A5E'; f.lineWidth = .3; f.beginPath(); f.moveTo(T.bas.x + nx * s, T.bas.y + ny * s); f.lineTo(T.haut.x + nx * s, T.haut.y + ny * s); f.stroke(); }
    for(let d = 9, k = 0; d < T.longueur - 9; d += 11, k++){
      const s = k % 2 ? e : -e, x = T.bas.x + ux * d + nx * s, y = T.bas.y + uy * d + ny * s;
      f.fillStyle = 'rgba(40,55,80,.22)'; f.fillRect(x - .2, y + .6, 2.2, 1.1);
      f.fillStyle = k % 3 ? '#C7362B' : '#2F6FD0'; f.save(); f.translate(x, y); f.rotate(Math.atan2(uy, ux) + Math.PI / 2); f.fillRect(-1.1, -.55, 2.2, 1.1); f.restore();
    }
    for(const [G, nom] of [[T.bas, 'GARE AVAL'], [T.haut, 'GARE AMONT']]){
      f.fillStyle = 'rgba(40,55,80,.3)'; f.beginPath(); f.arc(G.x + 1, G.y + 1, 4.4, 0, 6.29); f.fill();
      f.fillStyle = '#8796AD'; f.beginPath(); f.arc(G.x, G.y, 4.4, 0, 6.29); f.fill();
      f.strokeStyle = '#3E4A5E'; f.lineWidth = .5; f.beginPath(); f.arc(G.x, G.y, e, 0, 6.29); f.stroke();
      f.font = '700 3px "Bricolage Grotesque", sans-serif'; f.textAlign = 'center'; f.lineWidth = 1.4; f.strokeStyle = 'rgba(255,255,255,.85)';
      const ty = G === T.haut ? G.y + 8.5 : G.y - 6.5; f.strokeText(nom, G.x, ty); f.fillStyle = '#3E4A5E'; f.fillText(nom, G.x, ty);
    }
    const m = T.pylones[Math.floor(T.pylones.length / 2)] || T.bas;
    f.save(); f.translate(m.x + nx * 7, m.y + ny * 7); f.rotate(Math.atan2(uy, ux) + (uy < 0 ? Math.PI / 2 : -Math.PI / 2));
    f.font = '700 3.4px "Bricolage Grotesque", sans-serif'; f.textAlign = 'center'; f.lineWidth = 1.4; f.strokeStyle = 'rgba(255,255,255,.85)'; f.strokeText('Télésiège (à l\'arrêt)', 0, 0); f.fillStyle = '#3E4A5E'; f.fillText('Télésiège (à l\'arrêt)', 0, 0);
    f.restore();
  }
  // noms des pistes, en haut
  for(const p of dom.pistes){
    const [x, y] = p.points[2];
    f.font = '700 7px "Bricolage Grotesque", sans-serif'; f.textAlign = 'center';
    f.lineWidth = 2.4; f.strokeStyle = 'rgba(255,255,255,.9)'; f.strokeText(p.nom, x, y - 4);
    f.fillStyle = COULEURS_PISTES[p.couleur]; f.fillText(p.nom, x, y - 4);
  }
  // la salle des machines
  const s = dom.salle;
  f.fillStyle = 'rgba(40,55,80,.3)'; f.fillRect(s.x - s.w / 2 + 1.2, s.y - s.h / 2 + 1.2, s.w, s.h);
  f.fillStyle = '#5B6B82'; f.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
  f.fillStyle = '#7A8BA3'; f.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h / 2);
  f.fillStyle = '#EAF2FF'; f.font = '800 4px "Bricolage Grotesque", sans-serif'; f.textAlign = 'center'; f.fillText('SALLE', s.x, s.y + 1.4);
}
function trace(c, pts){ c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); }
function normale(pts, i){ const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; }

/* ---------- Une image ---------- */
const COULEURS_ETAT = { marche:'#38D07A', arret:'#E04A4A', defaut:'#F2C230', chaud:'#F2C230' };
function dessinerCarte(S){
  const { dom, res, reg, nuit, u } = S, t = performance.now() / 1000;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#1A2A44'; g.fillRect(0, 0, LW, LH);
  const [ox, oy] = versEcran(0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(fond, ox, oy, dom.W * cam.z, dom.H * cam.z);
  g.save(); g.translate(ox, oy); g.scale(cam.z, cam.z);
  const px = 1 / cam.z;                        // un pixel écran, en mètres
  // la retenue (son niveau baisse quand elle se vide)
  const R = dom.retenue, f = Math.max(0, res.retenue.volume / R.max);
  g.fillStyle = '#B8C6D8'; g.beginPath(); g.arc(R.x, R.y, R.r + 2.5, 0, 6.29); g.fill();
  g.fillStyle = '#7C8EA6'; g.beginPath(); g.arc(R.x, R.y, R.r, 0, 6.29); g.fill();
  if(f > 0){ const gr = g.createRadialGradient(R.x - R.r * .3, R.y - R.r * .3, 1, R.x, R.y, R.r); gr.addColorStop(0, '#5AA2E6'); gr.addColorStop(1, '#1F5FA8'); g.fillStyle = gr; g.beginPath(); g.arc(R.x, R.y, R.r * (.35 + .65 * Math.sqrt(f)), 0, 6.29); g.fill(); }
  // les tas de neige
  for(const q of res.tas){
    const r = q.r * (.8 + .45 * Math.min(1, Math.sqrt(q.v / 400))), a = Math.min(.95, .25 + q.v / 900);
    const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
    gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.6, `rgba(255,255,255,${a * .6})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, r, 0, 6.29); g.fill();
  }
  // les tranchées : eau en bleu, câble en jaune
  for(const tr of res.tranchees){
    const A = noeud(res, tr.a), B = noeud(res, tr.b);
    g.lineCap = 'round';
    if(tr.eau){ g.strokeStyle = 'rgba(30,60,110,.35)'; g.lineWidth = Math.max(2.2, 5 * px); ligne(A, B); g.strokeStyle = '#3D8BFF'; g.lineWidth = Math.max(1.2, 3 * px); ligne(A, B); }
    if(tr.cable){ g.strokeStyle = '#F2C230'; g.lineWidth = Math.max(.7, 1.6 * px); g.setLineDash(tr.eau ? [3 * px + 1, 3 * px + 1] : []); ligne(A, B); g.setLineDash([]); }
  }
  // aperçu d'une tranchée en cours
  if(S.apercu){
    const { A, B, ok } = S.apercu;
    g.strokeStyle = ok ? 'rgba(233,185,73,.95)' : 'rgba(224,74,74,.95)'; g.lineWidth = Math.max(1.5, 3 * px); g.setLineDash([4 * px + 1, 3 * px + 1]); ligne(A, B); g.setLineDash([]);
    if(!B.id){ g.fillStyle = ok ? 'rgba(233,185,73,.9)' : 'rgba(224,74,74,.9)'; g.fillRect(B.x - 2, B.y - 1.5, 4, 3); }
  }
  // la nuit : tout s'assombrit (les canons et leurs jets restent visibles)
  if(nuit){
    g.fillStyle = 'rgba(4,10,28,.55)'; g.fillRect(-20, -20, dom.W + 40, dom.H + 40);
    // la lumière de la salle
    const gr = g.createRadialGradient(dom.salle.x, dom.salle.y, 2, dom.salle.x, dom.salle.y, 40);
    gr.addColorStop(0, 'rgba(255,220,150,.28)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gr; g.beginPath(); g.arc(dom.salle.x, dom.salle.y, 40, 0, 6.29); g.fill();
  }
  // départs électriques
  for(const n of res.noeuds){
    if(n.type === 'elec'){ g.fillStyle = '#2B2F38'; g.fillRect(n.x - 3, n.y - 3, 6, 6); g.fillStyle = '#F2C230'; g.fillRect(n.x - 2.2, n.y - 2.2, 4.4, 4.4); g.fillStyle = '#2B2F38'; g.font = `800 ${Math.max(4, 9 * px)}px sans-serif`; g.textAlign = 'center'; g.fillText('⚡', n.x, n.y + 1.6); }
    if(n.type === 'pompage'){ g.fillStyle = '#3D8BFF'; g.beginPath(); g.arc(n.x, n.y, 2.6, 0, 6.29); g.fill(); g.strokeStyle = '#F2C230'; g.lineWidth = .8; g.stroke(); }
  }
  // jets de neige la nuit
  const parId = new Map((reg ? reg.canons : []).map(c => [c.id, c]));
  if(nuit && reg) for(const c of reg.canons){
    if(!c.ouvert) continue;
    const n = c.n, ch = c.chute, eau = c.production <= 0;
    const nb = 14, dx = ch.x - n.x, dy = ch.y - n.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    for(let i = 0; i < nb; i++){
      const k = (t * .9 + i / nb + (n.x * .013) % 1) % 1, s = Math.sin(i * 12.9 + n.y) * ch.rayon * .6 * k;
      g.fillStyle = eau ? `rgba(120,180,255,${(1 - k) * .8})` : `rgba(255,255,255,${(1 - k * .7) * .85})`;
      g.beginPath(); g.arc(n.x + dx * k + nx * s, n.y + dy * k + ny * s, Math.max(.5, (eau ? 1.2 : 1.6) * px * 2 + k * 1.2), 0, 6.29); g.fill();
    }
  }
  // regards et canons
  for(const n of res.noeuds){
    if(n.type !== 'regard') continue;
    const c = parId.get(n.id), etat = c ? c.etat : 'arret', choisi = S.selection === n.id;
    const r = Math.max(2.4, 7 * px), m = CATALOGUE[n.canon.modele], sup = SUPPORTS[n.canon.support];
    // la zone où tombe la neige du canon choisi (ou de tous la nuit, en léger)
    if(c && (choisi || (S.zones && c.ouvert))){
      g.strokeStyle = choisi ? 'rgba(233,185,73,.95)' : 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(.6, 1.5 * px); g.setLineDash([2.5 * px + .8, 2 * px + .8]);
      g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(c.chute.x, c.chute.y); g.stroke();
      g.beginPath(); g.arc(c.chute.x, c.chute.y, c.chute.rayon, 0, 6.29); g.stroke(); g.setLineDash([]);
      if(choisi){ g.fillStyle = c.part > .6 ? 'rgba(56,208,122,.18)' : c.part > .25 ? 'rgba(242,194,48,.18)' : 'rgba(224,74,74,.18)'; g.fill(); }
    }
    // le regard (carré gris) et le canon (rond de couleur avec sa direction)
    g.fillStyle = '#4A5568'; g.fillRect(n.x - r * .55, n.y - r * .55, r * 1.1, r * 1.1);
    const lg = r * (1.4 + (m.portee - 22) / 25) * (sup.portee);
    g.strokeStyle = '#1B2230'; g.lineWidth = r * .55; g.lineCap = 'round'; g.beginPath(); g.moveTo(n.x, n.y); g.lineTo(n.x + Math.sin(n.canon.dir) * lg, n.y + Math.cos(n.canon.dir) * lg); g.stroke();
    g.fillStyle = COULEURS_ETAT[etat]; g.beginPath(); g.arc(n.x, n.y, r * .62, 0, 6.29); g.fill();
    g.strokeStyle = choisi ? '#E9B949' : 'rgba(10,20,40,.9)'; g.lineWidth = choisi ? Math.max(.8, 2.5 * px) : Math.max(.4, 1.2 * px); g.stroke();
    if(n.canon.support !== 'trepied'){ g.strokeStyle = '#EAF2FF'; g.lineWidth = Math.max(.3, px); g.beginPath(); g.arc(n.x, n.y, r * .9, 0, 6.29); g.stroke(); }
    if(c && !c.pret){ g.fillStyle = '#F2C230'; g.font = `800 ${r * 1.4}px sans-serif`; g.textAlign = 'center'; g.fillText('!', n.x + r * 1.1, n.y - r * .6); }
    if(cam.z > 1.1 || choisi){ g.font = `700 ${Math.max(3, 11 * px)}px "Saira Condensed", sans-serif`; g.textAlign = 'center'; g.lineWidth = 3 * px; g.strokeStyle = 'rgba(10,20,40,.85)'; g.strokeText(n.id, n.x, n.y - r * 1.3); g.fillStyle = '#fff'; g.fillText(n.id, n.x, n.y - r * 1.3); }
  }
  // la piste découpée en tronçons de 25 m : un repère par tronçon au bord de la piste
  // (vert = assez de neige, jaune = un peu, gris = rien ; cerclé de blanc le jour = un canon y envoie sa neige)
  if(S.troncons){
    const p = dom.pistes[0], n = p.troncons;
    for(let k = 0; k < n; k++){
      const L = (k + .5) / n * p.longueur; let i = 1; while(i < p.cumul.length - 1 && p.cumul[i] < L) i++;
      const [x, y] = p.points[i], nr = normale(p.points, i), q = S.troncons.neige[k] || 0, r = Math.max(1.6, 5 * px);
      const cx = x - nr[0] * (p.largeur / 2 + r + 1.5), cy = y - nr[1] * (p.largeur / 2 + r + 1.5);
      g.fillStyle = q >= 1 ? '#38D07A' : q > .05 ? '#F2C230' : 'rgba(120,135,160,.85)';
      g.beginPath(); g.arc(cx, cy, r, 0, 6.29); g.fill();
      if(S.troncons.equipe){ g.strokeStyle = S.troncons.equipe.has(k) ? '#FFFFFF' : 'rgba(224,74,74,.9)'; g.lineWidth = Math.max(.5, 1.8 * px); g.stroke(); }
    }
  }
  // point de départ choisi pour une tranchée
  if(S.depart){ const n = noeud(res, S.depart); if(n){ g.strokeStyle = '#E9B949'; g.lineWidth = Math.max(.8, 2.5 * px); g.beginPath(); g.arc(n.x, n.y, Math.max(5, 12 * px) + Math.sin(t * 5) * px * 2, 0, 6.29); g.stroke(); } }
  g.restore();
}
function ligne(A, B){ g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); }
