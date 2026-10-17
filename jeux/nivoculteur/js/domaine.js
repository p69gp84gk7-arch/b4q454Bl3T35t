'use strict';
/* Nivoculteur 2D · les domaines tirés au sort (logique pure, sans dessin)
   Un domaine se reconstruit toujours à l'identique à partir de sa taille et de sa graine :
   on ne sauvegarde que ces deux valeurs.
   Coordonnées en mètres : x de gauche à droite, y du haut du domaine (le sommet) vers le bas (le front de neige). */

const borne = (v, a, b) => Math.max(a, Math.min(b, v));
const lisse = t => { t = borne(t, 0, 1); return t * t * (3 - 2 * t); };
const entre = (R, [a, b]) => a + R() * (b - a);
function alea(graine){
  let s = graine | 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const COULEURS_PISTES = { verte: '#2E9E5B', bleue: '#2C6FD6', rouge: '#D63A2F', noire: '#1B1E24' };
// Couleur d'une piste selon sa pente moyenne (%)
const couleurPente = p => p <= 24 ? 'verte' : p <= 31 ? 'bleue' : p <= 38 ? 'rouge' : 'noire';

function distanceSegment(x, y, a, b){
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, u = l ? borne(((x - a[0]) * dx + (y - a[1]) * dy) / l, 0, 1) : 0;
  return Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy);
}
function distancePolyligne(pts, x, y){ let d = Infinity; for(let i = 1; i < pts.length; i++) d = Math.min(d, distanceSegment(x, y, pts[i - 1], pts[i])); return d; }

// Un domaine = une piste de Superbagnères à enneiger (la forme varie d'une partie à l'autre selon la graine)
function creerDomaine(taille, graine){
  const D = CONFIG.domaines[taille] || CONFIG.domaines.renard, R = alea(graine);
  const FRONT = 95;   // m : le front de neige, presque plat, en bas du domaine
  const W = Math.round(D.largeur + 230), H = Math.round(D.longueur * .86 + FRONT + 40);
  const den = Math.round(entre(R, D.denivele)), altBas = 1440 + Math.round(R() * 120);   // Superbagnères : 1 440 m au plus bas
  const ph = Array.from({ length:6 }, () => R() * 6.28);
  // Relief : pente générale vers le bas, ondulations, et un front de neige presque plat
  const relief = (x, y) => {
    const u = borne(y / (H - FRONT), 0, 1);
    const base = den * (1 - u) + (y > H - FRONT ? -(y - (H - FRONT)) * 0.04 : 0);
    const ond = 7 * Math.sin(x / 75 + ph[0]) * Math.cos(y / 95 + ph[1]) + 3 * Math.sin(x / 27 + y / 33 + ph[2]);
    return altBas + base + ond * (1 - lisse((y - (H - FRONT - 30)) / 40));
  };
  const nom = D.nom;
  // La piste : du haut vers le front de neige, en serpentant
  const larg = D.largeur, cx = W / 2, amp = 22 + R() * 30, a1 = R() * 6.28, a2 = R() * 6.28, l1 = 55 + R() * 70, l2 = 24 + R() * 20;
  const yHaut = 26, yBas = H - FRONT + 30, pts = [];
  for(let y = yHaut; y <= yBas + .1; y += 8){
    const f = lisse((y - yHaut) / 40) * (1 - lisse((y - (yBas - 60)) / 60) * .7);
    pts.push([borne(cx + f * (amp * Math.sin(y / l1 + a1) + amp * .35 * Math.sin(y / l2 + a2)), larg / 2 + 8, W - larg / 2 - 8), y]);
  }
  let l = 0; for(let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const dz = relief(pts[0][0], pts[0][1]) - relief(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  const pistes = [{ nom:D.nom, points:pts, largeur:larg, longueur:Math.round(l), pente:Math.round(dz / l * 100), couleur:D.couleur }];
  const n = 1;
  // Salle des machines et retenue sur le front de neige
  const xs = W * (.3 + R() * .4), salle = { x:xs, y:H - 42, w:20, h:13 };
  const rayonRetenue = Math.round(Math.sqrt(D.retenue / (Math.PI * 3.5))), cote = xs > W / 2 ? -1 : 1;
  const retenue = { x:borne(xs + cote * (rayonRetenue + 26), rayonRetenue + 6, W - rayonRetenue - 6), y:H - 46, r:rayonRetenue, max:D.retenue };
  // Départs électriques : la salle a le sien (on peut tirer eau + câble depuis la salle) ; d'autres à mi-hauteur
  const departs = [];
  const nd = D.longueur > 450 ? 2 : 1;
  for(let k = 0; k < nd; k++){
    const y = H * (.3 + .38 * (k / Math.max(1, nd - 1 || 1)) + (R() - .5) * .08);
    let x = 0, essais = 0;
    do { x = 20 + R() * (W - 40); essais++; } while(essais < 40 && pistes.some(p => distancePolyligne(p.points, x, y) < p.largeur / 2 + 10));
    departs.push({ id:'elec' + (k + 1), nom:`Départ électrique n° ${k + 1}`, x, y });
  }
  // Forêt : des sapins partout sauf sur les pistes, le front de neige et autour des bâtiments
  const sapins = [];
  for(let y = 6; y < H - FRONT - 8; y += 7) for(let x = 4; x < W - 4; x += 7){
    const px = x + (R() - .5) * 6, py = y + (R() - .5) * 6;
    if(R() < .38) continue;
    if(pistes.some(p => distancePolyligne(p.points, px, py) < p.largeur / 2 + 4)) continue;
    if(departs.some(d => Math.hypot(d.x - px, d.y - py) < 10)) continue;
    sapins.push([px, py, 1.6 + R() * 1.4]);
  }
  const dom = { taille, graine, nom, W, H, den, altBas, front:H - FRONT, pistes, salle, retenue, departs, sapins, relief,
    objectif:D.objectif, nuits:D.nuits, budget:D.budget };
  dom.alt = (x, y) => relief(x, y);
  return dom;
}
// La piste sous un point (ou null)
function pisteSous(dom, x, y){
  for(const p of dom.pistes) if(distancePolyligne(p.points, x, y) <= p.largeur / 2) return p;
  return null;
}
// Direction (radians, 0 = vers le bas de l'écran) vers le point de piste le plus proche
function directionVersPiste(dom, x, y){
  let best = null, d = Infinity;
  for(const p of dom.pistes) for(const q of p.points){ const e = Math.hypot(q[0] - x, q[1] - y); if(e < d){ d = e; best = q; } }
  if(!best || d < 6) return 0;
  return Math.atan2(best[0] - x, best[1] - y);
}
