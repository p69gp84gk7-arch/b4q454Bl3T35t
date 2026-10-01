'use strict';
/* Nivoculteur · simulation — logique pure, sans Three.js
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   3. SIMULATION — logique pure, sans Three.js
   Tout ce qui est ici doit pouvoir fonctionner seul (même sans affichage 3D).
   ===================================================================================== */

const borne = (v, a, b) => Math.max(a, Math.min(b, v));
const lisse = t => { t = borne(t, 0, 1); return t * t * (3 - 2 * t); };

// --- Hasard reproductible : la même graine donne toujours la même suite de nombres ---
function alea(graine){
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Petites bosses régulières (bruit) entre −1 et 1
function hachage(i, j, g){
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(g, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function bruit(x, z, g){
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hachage(i, j, g), b = hachage(i + 1, j, g), c = hachage(i, j + 1, g), d = hachage(i + 1, j + 1, g);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}

// --- Terrain ---
function dansZoneJeu(t, x, z){ return Math.abs(x) <= t.largeur / 2 && Math.abs(z) <= t.longueur / 2; }
// Distance (m) entre un point et la zone de jeu (0 si on est dedans)
function distanceZoneJeu(t, x, z){
  return Math.hypot(Math.max(0, Math.abs(x) - t.largeur / 2), Math.max(0, Math.abs(z) - t.longueur / 2));
}

// Forme naturelle de la montagne, sans les replats ni les petites bosses
// Station (mode Exploitation) : front de neige plat en bas, deux vallons qui y retombent, séparés par une crête.
// Chaque vallon a son profil de pentes (en %, par tronçons, en remontant depuis le front de neige).
function profilVallon(tr, s){
  let h = 0, d = 0;
  for(const [longueur, pente] of tr){
    const l = Math.min(longueur, Math.max(0, s - d));
    h += l * pente / 100; d += longueur;
    if(s <= d) return h;
  }
  return h + (s - d) * tr[tr.length - 1][1] / 100;   // au-delà : la dernière pente continue
}
function altitudeStation(t, x, z){
  const S = t.station, s = S.front - z;                            // s : m en remontant depuis le bord du front de neige
  if(s <= 0) return t.altBas + S.penteFront / 100 * (t.longueur / 2 - z);   // front de neige : presque plat
  const hf = t.altBas + S.penteFront / 100 * (t.longueur / 2 - S.front);
  // les deux vallons se rejoignent au milieu ; on passe de l'un à l'autre en douceur
  const [V1, V2] = S.vallons, xm = (V1.x + V2.x) / 2, pa = profilVallon(V1.profil, s), pb = profilVallon(V2.profil, s);
  const w = lisse((x - xm) / S.demiLargeur * 0.8 + 0.5);
  let h = hf + (1 - w) * pa + w * pb;
  // crête entre les vallons : toujours plus haute que les deux (elle naît peu à peu au-dessus du front de neige)
  const naissance = lisse(s / S.naissance), milieu = lisse(1 - Math.abs(x - xm) / (S.demiLargeur * 0.75));
  h += milieu * (Math.abs(pb - pa) / 2 * (1 - Math.abs(2 * w - 1)) + S.crete * naissance);
  // les bords extérieurs remontent aussi
  const dehors = Math.max(0, Math.max(V1.x - x, x - V2.x)) / S.demiLargeur;
  h += S.crete * naissance * Math.min(1.4, dehors * dehors);
  // relief chaotique : bosses, croupes et ressauts, plus marqués en montant
  const c = S.chaos * lisse((s - 40) / 160);
  h += c * (0.7 * bruit(x / 70, z / 70, t.graine + 30) + 0.3 * bruit(x / 26, z / 26, t.graine + 31));
  return h;
}
function altitudeNaturelle(t, x, z){
  const u = borne((t.longueur / 2 - z) / t.longueur, -0.9, 1.8);   // 0 en bas de la pente, 1 en haut
  let k = 1;                                                        // versants du grand domaine : pente plus douce ou plus raide
  if(t.versants){ const v = t.versants; k = 1 + ((x < 0 ? v.gauche : v.droite) - 1) * lisse((Math.abs(x) - v.debut) / v.transition); }
  let h = t.station ? altitudeStation(t, x, z) : t.altBas + t.denivele * k * (0.85 * u + 0.15 * u * u);
  const bx = borne(x / (t.largeur / 2), -1.7, 1.7);
  h += t.bords * bx * bx;                                           // les côtés remontent
  for(const b of t.bosses) h += b.h * Math.exp(-((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r));
  // Montagnes du décor : elles montent dès qu'on sort de la zone de jeu (moins vers la vallée, en bas)
  const m = t.montagnes;
  if(m){
    const d = distanceZoneJeu(t, x, z) - m.recul;
    if(d > 0){
      const vallee = lisse((z - t.longueur / 2) / 300) * lisse(1 - (Math.abs(x) - t.largeur / 2) / 450);
      const crete = 1 - Math.abs(bruit(x / 240, z / 240, t.graine + 20));
      const pics = 0.5 + 0.5 * bruit(x / 130, z / 130, t.graine + 21);
      const f = 1 - Math.exp(-d / m.distance);
      h += m.hauteur * f * (0.35 + 0.45 * crete + 0.3 * pics) * (1 - 0.8 * vallee);
      h += Math.min(1, d / 120) * 9 * bruit(x / 45, z / 45, t.graine + 22);   // rochers et ravines
    }
  }
  return h;
}

// Hauteur d'un replat : celle du terrain naturel en son centre (mémorisée)
const _cotesReplats = new WeakMap();
function coteReplat(t, r){
  if(!_cotesReplats.has(r)) _cotesReplats.set(r, altitudeNaturelle(t, r.x, r.z) + (r.surelever || 0));
  return _cotesReplats.get(r);
}

// Altitude réelle (m) en un point (x, z). Si on donne les pistes, la neige y est damée (presque plus de bosses).
// Point le plus proche sur l'axe d'une piste : distance et coordonnées
function projectionPiste(piste, x, z){
  const c = courbePiste(piste);
  let best = { d: Infinity, x: c[0][0], z: c[0][1] };
  for(let i = 1; i < c.length; i++){
    const a = c[i - 1], b = c[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    const f = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
    const px = a[0] + f * dx, pz = a[1] + f * dz, d = Math.hypot(x - px, z - pz);
    if(d < best.d) best = { d, x: px, z: pz };
  }
  return best;
}
// Le haut et le bas d'une piste (le joueur peut la tracer dans les deux sens)
function extremitesPiste(t, piste){
  const c = courbePiste(piste), a = c[0], b = c[c.length - 1];
  return altitudeNaturelle(t, a[0], a[1]) >= altitudeNaturelle(t, b[0], b[1]) ? { haut: a, bas: b, inverse: false } : { haut: b, bas: a, inverse: true };
}
function altitude(t, x, z, pistes = null){
  let h = altitudeNaturelle(t, x, z);
  // Pistes tracées par le joueur : terrassées, le dévers est corrigé (le terrain est mis à niveau en travers de la piste)
  if(pistes){
    const T = CONFIG.terrassement;
    let w = 0, cible = h;
    for(const p of pistes){
      if(!p.terrasse) continue;
      const pr = projectionPiste(p, x, z), demi = p.largeur / 2;
      if(pr.d > demi + T.talus) continue;
      const wp = (pr.d <= demi ? 1 : 1 - lisse((pr.d - demi) / T.talus)) * T.force;
      if(wp > w){ w = wp; cible = altitudeNaturelle(t, pr.x, pr.z); }
    }
    h += (cible - h) * w;
  }
  let rug = t.rugosite;
  if(pistes){ const pp = pistePlusProche(pistes, x, z); if(pp) rug *= Math.min(1, 0.15 + pp.auBord / 10); }
  // Replats : terrain aplani (bâtiments, gares, retenue), raccordé par un talus
  let plat = 0;
  for(const r of t.replats || []){
    const d = Math.hypot(x - r.x, z - r.z);
    const w = d <= r.rayon ? 1 : 1 - lisse((d - r.rayon) / r.talus);
    if(w <= 0) continue;
    h += (coteReplat(t, r) - h) * w;
    plat = Math.max(plat, w);
    const c = r.cuvette;
    if(c && d < c.rayon) h -= c.profondeur * (1 - (d / c.rayon) ** 2);                          // le lac
    else if(c && d < r.rayon) h += c.digue * Math.sin(Math.PI * (d - c.rayon) / (r.rayon - c.rayon));   // la digue
  }
  rug *= (1 - plat) * (1 - lisse((distanceZoneJeu(t, x, z) - 30) / 25));   // plus de petites bosses hors du domaine
  return h + rug * (bruit(x / 22, z / 22, t.graine) + 0.5 * bruit(x / 9, z / 9, t.graine + 1));
}

// Eau de la retenue selon son remplissage f (0 à 1) : altitude de la surface et rayon du lac
function eauRetenue(t, retenue, f){
  const c = retenue.cuvette, plein = coteReplat(t, retenue);
  f = borne(f, 0, 1);
  return { cote: plein - c.profondeur * (1 - f), rayon: c.rayon * Math.sqrt(f) };
}

// --- Lignes et pistes ---
// Courbe douce qui passe par tous les points (Catmull-Rom), avec un point tous les « pas » mètres environ
function courbe(points, pas){
  const out = [], n = points.length;
  for(let i = 0; i < n - 1; i++){
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n - 1, i + 2)];
    const k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / pas));
    for(let s = 0; s < k; s++){
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(c => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(points[n - 1].slice());
  return out;
}
function longueurLigne(pts){
  let l = 0;
  for(let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
function distanceSegment(x, z, a, b){
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
const _courbesPistes = new WeakMap();
function courbePiste(piste){
  if(!_courbesPistes.has(piste)) _courbesPistes.set(piste, courbe(piste.points, 4));
  return _courbesPistes.get(piste);
}
function distancePiste(piste, x, z){
  const c = courbePiste(piste);
  let d = Infinity;
  for(let i = 1; i < c.length; i++) d = Math.min(d, distanceSegment(x, z, c[i - 1], c[i]));
  return d;
}
function surPiste(piste, x, z){ return distancePiste(piste, x, z) <= piste.largeur / 2; }
// La piste la plus proche d'un point, et la distance au bord (0 si on est dessus)
function pistePlusProche(pistes, x, z){
  let meilleure = null, dMin = Infinity;
  for(const p of pistes){ const d = distancePiste(p, x, z); if(d < dMin){ dMin = d; meilleure = p; } }
  return meilleure && { piste: meilleure, dessus: dMin <= meilleure.largeur / 2, auBord: Math.max(0, dMin - meilleure.largeur / 2) };
}

// --- Remontées mécaniques ---
function longueurTelesiege(ts){ return Math.hypot(ts.amont.x - ts.aval.x, ts.amont.z - ts.aval.z); }
// Pylônes répartis régulièrement entre les deux gares
function pylonesTelesiege(ts){
  const out = [];
  for(let i = 1; i <= ts.pylones; i++){
    const f = i / (ts.pylones + 1);
    out.push({ x: ts.aval.x + (ts.amont.x - ts.aval.x) * f, z: ts.aval.z + (ts.amont.z - ts.aval.z) * f });
  }
  return out;
}
function distanceTelesiege(ts, x, z){ return distanceSegment(x, z, [ts.aval.x, ts.aval.z], [ts.amont.x, ts.amont.z]); }

// --- Pression d'eau au regard (bar) ---
// longueur : m de conduite depuis le pompage · denivele : m de montée (négatif si le regard est plus bas)
// debit : m³/h demandés par l'ensemble des canons ouverts
function pressionRegard({ pPompes, longueur, denivele, debit }, cfg = CONFIG.pression){
  return pPompes - longueur / 100 * cfg.perteLongueur - denivele / 10 * cfg.perteDenivele - debit * cfg.perteDebit;
}
// Zone de fonctionnement d'un enneigeur selon la pression à son regard :
// 'arret' (pas assez de pression), 'faible' (production réduite), 'correcte', 'haute' (à surveiller), 'surpression' (mise en sécurité)
function zonePression(p, modele = CATALOGUE.v8, cfg = CONFIG.pression){
  if(p > cfg.zones.surpression) return 'surpression';
  if(p < modele.pressionMin) return 'arret';
  if(p < modele.pressionPleine) return 'faible';
  if(p > cfg.zones.correcte) return 'haute';
  return 'correcte';
}
// Part de la production complète (0 à 1) : 35 % à la pression minimale, 100 % à la pression de pleine production
function facteurProduction(p, modele, cfg = CONFIG.pression){
  if(p > cfg.zones.surpression || p < modele.pressionMin) return 0;
  return borne(0.35 + 0.65 * (p - modele.pressionMin) / (modele.pressionPleine - modele.pressionMin), 0, 1);
}

// --- Enneigeurs (catalogue) ---
function prixEnneigeur(modele, support){
  const m = CATALOGUE[modele];
  return m.prix + (m.type === 'ventilateur' ? SUPPORTS[support || 'trepied'].prix : 0);
}
function nomEnneigeur(modele, support){
  const m = CATALOGUE[modele];
  return m.type === 'ventilateur' ? `${m.nom} sur ${SUPPORTS[support || 'trepied'].nom.toLowerCase()}` : m.nom;
}
// Un enneigeur est-il disponible ? (niveau atteint, et neige déjà faite sur les pistes)
function disponible(niveau, res, modele){
  const d = CATALOGUE[modele].debloque;
  if(niveau.bac || niveau.exploitation) return { ok: true };   // bac à sable et exploitation : tout est débloqué
  if(niveau.enneigeurs) return niveau.enneigeurs.includes(modele) ? { ok: true } : { ok: false, raison: 'plus tard dans la carrière' };
  if(niveau.numero < d.niveau) return { ok: false, raison: d.niveau === 3 ? 'au niveau 3 (air comprimé)' : `au niveau ${d.niveau}` };
  if(res.neigePiste < d.m3) return { ok: false, raison: `après ${d.m3.toLocaleString('fr-FR')} m³ de neige sur les pistes` };
  return { ok: true };
}

// Un support de ventilateur est-il disponible ? (carrière : débloqué au fil des étapes)
function supportDisponible(niveau, support){
  if(!support || !niveau.supports || niveau.supports.includes(support)) return { ok: true };
  return { ok: false, raison: `${SUPPORTS[support].nom} : disponible plus tard dans la carrière.` };
}

// --- Coûts ---
// Prix d'une tranchée de « longueur » mètres, selon ce qu'on y met (eau, câble, ou les deux : tranchée commune)
function coutTranchee(longueur, { eau = false, cable = false } = {}, cfg = CONFIG.couts){
  const parMetre = eau && cable ? cfg.trancheeCommune : eau ? cfg.trancheeEau : cable ? cfg.trancheeCable : 0;
  return Math.round(longueur * parMetre);
}
function gainNeige(m3SurPiste, cfg = CONFIG.gains){ return Math.round(m3SurPiste * cfg.parM3Piste); }

// --- Réseau construit par le joueur ---
// Nœuds : la salle de pompage (source d'eau), les départs électriques (sources d'électricité) et les regards.
// Tranchées : entre deux nœuds, avec de l'eau, un câble, ou les deux (tranchée commune).
function creerReseau(niveau){
  const p = niveau.pompage;
  const r = {
    budget: niveau.budget,
    noeuds: [
      { id: 'pompage', type: 'pompage', nom: p.nom, x: p.sortie.x, z: p.sortie.z },
      ...niveau.departsElec.map((d, i) => ({ id: `elec${i + 1}`, type: 'elec', nom: d.nom, x: d.x, z: d.z })),
      ...(niveau.compresseur ? [{ id: 'compresseur', type: 'compresseur', nom: niveau.compresseur.nom, x: niveau.compresseur.sortie.x, z: niveau.compresseur.sortie.z }] : [])
    ],
    tranchees: [],          // { a, b, eau, cable, air, longueur }
    compresseur: niveau.compresseur ? { marche: false, pression: 0 } : null,   // marche : commande manuelle ; pression du réservoir (bar)
    historique: [],         // pour annuler : une entrée par achat, regroupées par « lot » (une action du joueur)
    numero: 0,              // numéro du dernier regard posé
    lot: 0,
    nuit: 1,                // numéro de la prochaine nuit
    neigePiste: 0,          // m³ tombés sur les pistes depuis le début (compte pour l'objectif et les déblocages)
    neigeTotale: 0,
    tas: [],                // tas de neige { x, z, volume }
    pompage: niveau.programme ? { mode: 'manuel', marche: [false, false, false], ouverture: 0 }   // niveau 1 : tout à la main
                              : { mode: 'auto', marche: [true, true, true], ouverture: 1 },     // commandes du poste de travail
    retenue: niveau.retenue ? { volume: volumeRetenue(niveau.retenue) * (niveau.retenueDepart ?? niveau.retenue.niveau) ** 2,
                                remplissage: CONFIG.retenue.remplissageJour } : null,   // m³ commandés pour chaque journée (payants)
    coups: 0,               // coups de bélier depuis le début du niveau
    options: niveau.bac ? optionsBac() : null,   // bac à sable : tout se règle (voir optionsBac)
    pannes: [],             // pannes en cours (niveau 4) : { id, type, cible, nuit, t, etat: 'active' | 'reparation', fin }
    numeroPanne: 0,
    dameuse: { modele: 'dm400' },   // dameuse rangée au garage
    remonteesEnMarche: []           // noms des remontées activées
  };
  if(niveau.exploitation) creerExploitation(niveau, r);
  return r;
}
// Volume d'eau de la retenue pleine (m³) et hauteur d'eau (0 à 1) pour un volume donné (cuvette en forme de bol)
function volumeRetenue(R){ return Math.PI * R.cuvette.rayon ** 2 * R.cuvette.profondeur / 2; }
function hauteurRetenue(R, volume){ return Math.sqrt(borne(volume / volumeRetenue(R), 0, 1)); }
const cleTranchee = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
function noeudReseau(res, id){ return res.noeuds.find(n => n.id === id); }
function trancheeEntre(res, a, b){ const k = cleTranchee(a, b); return res.tranchees.find(tr => cleTranchee(tr.a, tr.b) === k); }

// Longueur d'une tranchée en ligne droite, en suivant le relief (m)
function longueurTranchee(t, a, b){
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
  let l = 0, prec = null;
  for(let i = 0; i <= n; i++){
    const x = a.x + (b.x - a.x) * i / n, z = a.z + (b.z - a.z) * i / n, y = altitude(t, x, z);
    if(prec) l += Math.hypot(x - prec[0], y - prec[1], z - prec[2]);
    prec = [x, y, z];
  }
  return l;
}
// Chaque réseau part de sa source : salle de pompage (eau), départs électriques (câble), compresseur (air)
const SOURCES = { eau: 'pompage', cable: 'elec', air: 'compresseur' };
const NOMS_RESEAUX = { eau: 'l\'eau', cable: 'l\'électricité', air: 'l\'air comprimé' };
// Nœuds alimentés : reliés à la source du réseau
// coupees : sources hors service (disjoncteur déclenché)
function alimentes(res, quoi, coupees = null){
  const ok = new Set(res.noeuds.filter(n => n.type === SOURCES[quoi] && !(coupees && coupees.has(n.id))).map(n => n.id));
  const pile = [...ok];
  while(pile.length){
    const id = pile.pop();
    for(const tr of res.tranchees){
      if(!tr[quoi]) continue;
      const autre = tr.a === id ? tr.b : tr.b === id ? tr.a : null;
      if(autre && !ok.has(autre)){ ok.add(autre); pile.push(autre); }
    }
  }
  return ok;
}
// Longueur de conduite depuis la salle de pompage (par le chemin le plus court) pour chaque nœud alimenté en eau
function longueursEau(res){ return longueursReseau(res, 'eau'); }
// Longueur de conduite depuis la source (par le chemin le plus court) pour chaque nœud alimenté
function longueursReseau(res, quoi){
  const dist = new Map(res.noeuds.filter(n => n.type === SOURCES[quoi]).map(n => [n.id, 0])), faits = new Set();
  for(;;){
    let id = null, d = Infinity;
    for(const [k, v] of dist) if(!faits.has(k) && v < d){ id = k; d = v; }
    if(id === null) return dist;
    faits.add(id);
    for(const tr of res.tranchees){
      if(!tr[quoi]) continue;
      const autre = tr.a === id ? tr.b : tr.b === id ? tr.a : null;
      if(autre && d + tr.longueur < (dist.has(autre) ? dist.get(autre) : Infinity)) dist.set(autre, d + tr.longueur);
    }
  }
}
// État d'un regard : eau, électricité, pression prévue (pompes en marche, aucun canon ouvert)
function etatRegard(niveau, res, id){
  const n = noeudReseau(res, id), t = niveau.terrain, pomp = noeudReseau(res, 'pompage');
  const eau = alimentes(res, 'eau').has(id), elec = alimentes(res, 'cable').has(id);
  const besoinAir = CATALOGUE[n.modele].type === 'perche', air = alimentes(res, 'air').has(id);
  let pression = null, zone = null;
  if(eau){
    pression = pressionRegard({ pPompes: CONFIG.pression.pompes, longueur: longueursEau(res).get(id),
      denivele: altitude(t, n.x, n.z) - altitude(t, pomp.x, pomp.z), debit: 0 });
    zone = zonePression(pression, CATALOGUE[n.modele]);
  }
  const manques = [!eau && NOMS_RESEAUX.eau, !elec && NOMS_RESEAUX.cable, besoinAir && !air && NOMS_RESEAUX.air].filter(Boolean);
  const manque = manques.length ? manques.length === 1 ? manques[0] : `${manques.slice(0, -1).join(', ')} et ${manques[manques.length - 1]}` : null;
  return { eau, elec, air, besoinAir, pression, zone, manque, pret: !manques.length };
}
// Peut-on poser un regard ici ? (null = oui, sinon la raison)
function refusRegard(niveau, res, x, z){
  const t = niveau.terrain, ecart = CONFIG.construction.ecartRegards, R = niveau.retenue;
  if(!dansZoneJeu(t, x, z)) return 'Ce point est en dehors du domaine skiable.';
  if(R && Math.hypot(x - R.x, z - R.z) < R.cuvette.rayon + 4) return 'Impossible de poser un regard dans la retenue.';
  for(const r of t.replats || []) if(r !== R && Math.hypot(x - r.x, z - r.z) < r.rayon) return 'Trop près d\'un bâtiment.';
  for(const ts of niveau.remontees || []) if(distanceTelesiege(ts, x, z) < 4) return 'Trop près de la ligne du télésiège.';
  for(const n of res.noeuds){
    const d = Math.hypot(x - n.x, z - n.z);
    if(n.type === 'regard' && d < ecart) return `Trop près d'un autre regard (il faut au moins ${ecart} m).`;
    if(n.type !== 'regard' && d < 6) return 'Trop près d\'une installation.';
  }
  return null;
}
function poserRegard(niveau, res, x, z, choix = {}, lot = ++res.lot, impose = false){
  const modele = choix.modele || 'v8', support = CATALOGUE[modele].type === 'ventilateur' ? (choix.support || 'trepied') : null;
  const refus = refusRegard(niveau, res, x, z);
  if(refus) return { ok: false, raison: refus };
  const dispo = disponible(niveau, res, modele);
  if(!dispo.ok && !impose) return { ok: false, raison: `${CATALOGUE[modele].nom} : disponible ${dispo.raison}.` };
  const sup = supportDisponible(niveau, support);
  if(!sup.ok && !impose) return { ok: false, raison: sup.raison };
  const cout = CONFIG.couts.regard + prixEnneigeur(modele, support);
  if(res.budget < cout) return { ok: false, raison: 'Budget insuffisant.' };
  const id = `R${++res.numero}`;
  res.noeuds.push({ id, type: 'regard', nom: `Regard ${res.numero}`, x, z, modele, support,
    direction: directionVersPiste(niveau.pistes, x, z), inclinaison: 20 });
  res.budget -= cout;
  res.historique.push({ lot, type: 'regard', id, cout });
  return { ok: true, id, cout };
}
// Remplacer l'enneigeur d'un regard : on paie le nouveau, l'ancien est repris en partie
function devisEnneigeur(niveau, res, id, modele, support){
  const n = noeudReseau(res, id), m = CATALOGUE[modele];
  support = m.type === 'ventilateur' ? (support || 'trepied') : null;
  if(n.modele === modele && n.support === support) return { ok: false, raison: 'C\'est déjà cet enneigeur.', cout: 0 };
  const dispo = disponible(niveau, res, modele);
  if(!dispo.ok) return { ok: false, raison: `${m.nom} : disponible ${dispo.raison}.`, cout: 0 };
  const sup = supportDisponible(niveau, support);
  if(!sup.ok) return { ok: false, raison: sup.raison, cout: 0 };
  const reprise = Math.round(prixEnneigeur(n.modele, n.support) * CONFIG.couts.reprise);
  const cout = prixEnneigeur(modele, support) - reprise, assez = res.budget >= cout;
  return { ok: assez, raison: assez ? null : 'Budget insuffisant.', cout, reprise, support };
}
function changerEnneigeur(niveau, res, id, modele, support, lot = ++res.lot){
  const d = devisEnneigeur(niveau, res, id, modele, support);
  if(!d.ok) return d;
  const n = noeudReseau(res, id);
  res.historique.push({ lot, type: 'enneigeur', id, avant: { modele: n.modele, support: n.support }, cout: d.cout });
  n.modele = modele; n.support = d.support;
  res.budget -= d.cout;
  if(res.pannes) res.pannes = res.pannes.filter(p => !((p.type === 'moteur' || p.type === 'gel') && p.cible === id));   // enneigeur neuf
  return d;
}
// Orientation d'un canon (gratuite) : direction en degrés (0 = vers le bas de la pente), inclinaison de 0 à 35°
function orienterRegard(res, id, direction, inclinaison){
  const n = noeudReseau(res, id);
  n.direction = ((Math.round(direction) % 360) + 540) % 360 - 180;
  n.inclinaison = borne(Math.round(inclinaison), 0, 35);
}
// Devis d'une tranchée de A vers B, pour l'eau ('eau') ou l'électricité ('cable')
function devisTranchee(niveau, res, idA, idB, quoi){
  const A = noeudReseau(res, idA), B = noeudReseau(res, idB), c = CONFIG.couts, R = niveau.retenue;
  const refus = raison => ({ ok: false, raison });
  const departs = { eau: 'L\'eau part de la salle de pompage ou d\'un regard.', cable: 'Le câble part d\'un départ électrique ou d\'un regard.', air: 'L\'air part du compresseur ou d\'un regard.' };
  if(quoi === 'air' && !niveau.compresseur) return refus('Pas d\'air comprimé dans ce niveau.');
  if(!A || !B || idA === idB) return refus('Choisissez deux points différents.');
  if(B.type !== 'regard') return refus('L\'arrivée doit être un regard.');
  if(A.type !== 'regard' && A.type !== SOURCES[quoi]) return refus(departs[quoi]);
  if(!alimentes(res, quoi).has(idA)) return refus(`${A.nom} n'est pas encore alimenté en ${{ eau: 'eau', cable: 'électricité', air: 'air' }[quoi]}.`);
  if(R && distanceSegment(R.x, R.z, [A.x, A.z], [B.x, B.z]) < R.cuvette.rayon + 2) return refus('La tranchée ne peut pas traverser la retenue.');
  const existe = trancheeEntre(res, idA, idB);
  if(existe && existe[quoi]) return refus(`Ces deux points sont déjà reliés pour ${NOMS_RESEAUX[quoi]}.`);
  const longueur = existe ? existe.longueur : longueurTranchee(niveau.terrain, A, B);
  const commune = !!(existe && (existe.eau || existe.cable || existe.air));
  // Tranchée commune : la tranchée est déjà creusée, on ne paie que la pose du nouveau réseau
  const parMetre = commune ? c.ajout[quoi] : { eau: c.trancheeEau, cable: c.trancheeCable, air: c.trancheeAir }[quoi];
  const cout = Math.round(longueur * parMetre);
  const assez = res.budget >= cout;
  return { ok: assez, raison: assez ? null : 'Budget insuffisant.', longueur, cout, commune, parMetre };
}
function ajouterTranchee(niveau, res, idA, idB, quoi, lot = ++res.lot){
  const d = devisTranchee(niveau, res, idA, idB, quoi);
  if(!d.ok) return d;
  let tr = trancheeEntre(res, idA, idB);
  const nouvelle = !tr;
  if(nouvelle){ tr = { a: idA, b: idB, eau: false, cable: false, air: false, longueur: d.longueur }; res.tranchees.push(tr); }
  tr[quoi] = true;
  res.budget -= d.cout;
  res.historique.push({ lot, type: 'tranchee', cle: cleTranchee(idA, idB), quoi, nouvelle, cout: d.cout });
  return d;
}
// Annule la dernière action du joueur : tout ce qu'elle a acheté est remboursé
// --- Modifier l'installation : démonter, retirer un réseau, déplacer un regard, ajouter un départ électrique ---
// Prix au mètre de ce que contient une tranchée (comme si on la refaisait)
function prixMetreTranchee(tr, c = CONFIG.couts){
  const base = tr.eau && tr.cable ? c.trancheeCommune : tr.eau ? c.trancheeEau : tr.cable ? c.trancheeCable : 0;
  return base + (tr.air ? (tr.eau || tr.cable ? c.ajout.air : c.trancheeAir) : 0);
}
const PRIX_SEUL = { eau: 'trancheeEau', cable: 'trancheeCable', air: 'trancheeAir' };
// Regards qui perdraient un réseau si l'on retirait ces tranchées (ou ce nœud)
function regardsCoupes(res, apres){
  const coupes = [];
  for(const q of ['eau', 'cable', 'air']){
    const avant = alimentes(res, q), reste = alimentes(apres, q);
    for(const id of avant) if(!reste.has(id) && noeudReseau(apres, id) && noeudReseau(apres, id).type === 'regard') coupes.push({ id, quoi: q });
  }
  return coupes;
}
// Démonter un regard (et son enneigeur) ou un départ électrique ajouté : on récupère une part du prix
function devisDemontage(niveau, res, id){
  const n = noeudReseau(res, id), c = CONFIG.couts;
  if(!n) return { ok: false, raison: 'Rien à démonter ici.' };
  if(n.type !== 'regard' && !n.ajoute) return { ok: false, raison: `${n.nom} fait partie de la station : on ne peut pas le démonter.` };
  const liees = res.tranchees.filter(tr => tr.a === id || tr.b === id);
  const materiel = n.type === 'regard' ? Math.round((c.regard + prixEnneigeur(n.modele, n.support)) * c.revente) : Math.round(c.departElec * c.revente);
  const tranchees = liees.reduce((s, tr) => s + Math.round(tr.longueur * prixMetreTranchee(tr) * c.repriseTranchee), 0);
  const apres = { ...res, noeuds: res.noeuds.filter(q => q.id !== id), tranchees: res.tranchees.filter(tr => !liees.includes(tr)) };
  return { ok: true, materiel, tranchees, rembourse: materiel + tranchees, nbTranchees: liees.length, coupes: regardsCoupes(res, apres) };
}
function demonter(niveau, res, id, lot = ++res.lot){
  const d = devisDemontage(niveau, res, id);
  if(!d.ok) return d;
  const n = noeudReseau(res, id), liees = res.tranchees.filter(tr => tr.a === id || tr.b === id), cles = new Set(liees.map(tr => cleTranchee(tr.a, tr.b)));
  const pannes = (res.pannes || []).filter(p => p.cible === id || cles.has(p.cible));
  res.noeuds = res.noeuds.filter(q => q !== n);
  res.tranchees = res.tranchees.filter(tr => !liees.includes(tr));
  if(pannes.length) res.pannes = res.pannes.filter(p => !pannes.includes(p));
  res.budget += d.rembourse;
  res.historique.push({ lot, type: 'demontage', noeud: { ...n }, tranchees: liees.map(tr => ({ ...tr })), pannes, cout: -d.rembourse });
  return d;
}
// Retirer un réseau (eau, câble ou air) d'une tranchée ; la tranchée vide disparaît
function devisRetrait(niveau, res, cle, quoi){
  const tr = trancheeParCle(res, cle);
  if(!tr || !tr[quoi]) return { ok: false, raison: 'Rien à retirer ici.' };
  const rembourse = Math.round(tr.longueur * CONFIG.couts[PRIX_SEUL[quoi]] * CONFIG.couts.repriseTranchee);
  const apres = { ...res, tranchees: res.tranchees.map(x => x === tr ? { ...x, [quoi]: false } : x) };
  return { ok: true, rembourse, longueur: tr.longueur, coupes: regardsCoupes(res, apres) };
}
function retirerReseau(niveau, res, cle, quoi, lot = ++res.lot){
  const d = devisRetrait(niveau, res, cle, quoi);
  if(!d.ok) return d;
  const tr = trancheeParCle(res, cle), avant = { ...tr };
  tr[quoi] = false;
  const videe = !tr.eau && !tr.cable && !tr.air;
  if(videe) res.tranchees = res.tranchees.filter(x => x !== tr);
  if(quoi === 'eau' && res.pannes) res.pannes = res.pannes.filter(p => !(p.type === 'fuite' && p.cible === cle));
  res.budget += d.rembourse;
  res.historique.push({ lot, type: 'retrait', cle, quoi, tranchee: avant, videe, cout: -d.rembourse });
  return d;
}
// Déplacer un regard : les tranchées qui y arrivent suivent ; on paie le déplacement et les mètres en plus
function devisDeplacement(niveau, res, id, x, z){
  const n = noeudReseau(res, id), c = CONFIG.couts, R = niveau.retenue;
  if(!n || n.type !== 'regard') return { ok: false, raison: 'Seul un regard peut être déplacé.' };
  const autres = { ...res, noeuds: res.noeuds.filter(q => q !== n) }, refus = refusRegard(niveau, autres, x, z);
  if(refus) return { ok: false, raison: refus };
  const nouveau = { ...n, x, z };
  let rallonge = 0, cout = c.deplacement;
  const longueurs = [];
  for(const tr of res.tranchees.filter(tr => tr.a === id || tr.b === id)){
    const autre = noeudReseau(res, tr.a === id ? tr.b : tr.a);
    if(R && distanceSegment(R.x, R.z, [autre.x, autre.z], [x, z]) < R.cuvette.rayon + 2) return { ok: false, raison: 'Une tranchée traverserait la retenue.' };
    const L = longueurTranchee(niveau.terrain, autre, nouveau);
    longueurs.push({ cle: cleTranchee(tr.a, tr.b), avant: tr.longueur, apres: L });
    if(L > tr.longueur){ rallonge += L - tr.longueur; cout += Math.round((L - tr.longueur) * prixMetreTranchee(tr)); }
  }
  return { ok: res.budget >= cout, raison: res.budget >= cout ? null : 'Budget insuffisant.', cout, rallonge, longueurs, distance: Math.hypot(x - n.x, z - n.z) };
}
function deplacerRegard(niveau, res, id, x, z, lot = ++res.lot){
  const d = devisDeplacement(niveau, res, id, x, z);
  if(!d.ok) return d;
  const n = noeudReseau(res, id), avant = { x: n.x, z: n.z };
  n.x = x; n.z = z;
  for(const l of d.longueurs) trancheeParCle(res, l.cle).longueur = l.apres;
  res.budget -= d.cout;
  res.historique.push({ lot, type: 'deplacement', id, avant, longueurs: d.longueurs, cout: d.cout });
  return d;
}
// Nouveau départ électrique (armoire raccordée au réseau électrique), où l'on veut dans le domaine
function devisDepart(niveau, res, x, z){
  const t = niveau.terrain, R = niveau.retenue, cout = CONFIG.couts.departElec;
  if(!dansZoneJeu(t, x, z)) return { ok: false, raison: 'Ce point est en dehors du domaine skiable.' };
  if(R && Math.hypot(x - R.x, z - R.z) < R.rayon) return { ok: false, raison: 'Impossible de poser une armoire dans la retenue.' };
  for(const n of res.noeuds) if(Math.hypot(x - n.x, z - n.z) < 8) return { ok: false, raison: 'Trop près d\'une installation.' };
  return { ok: res.budget >= cout, raison: res.budget >= cout ? null : 'Budget insuffisant.', cout };
}
function ajouterDepartElec(niveau, res, x, z, lot = ++res.lot){
  const d = devisDepart(niveau, res, x, z);
  if(!d.ok) return d;
  res.numeroDepart = (res.numeroDepart || 0) + 1;
  const id = `elecP${res.numeroDepart}`;
  res.noeuds.push({ id, type: 'elec', nom: `Départ élec ${res.numeroDepart}`, x, z, ajoute: true });
  res.budget -= d.cout;
  res.historique.push({ lot, type: 'depart', id, cout: d.cout });
  return { ...d, id };
}

function annulerAction(res){
  if(!res.historique.length) return { ok: false, rembourse: 0 };
  const lot = res.historique[res.historique.length - 1].lot;
  let rembourse = 0;
  while(res.historique.length && res.historique[res.historique.length - 1].lot === lot){
    const h = res.historique.pop();
    rembourse += h.cout;
    if(h.type === 'regard'){
      res.noeuds = res.noeuds.filter(n => n.id !== h.id);
      if(h.id === `R${res.numero}`) res.numero--;
    } else if(h.type === 'enneigeur'){
      Object.assign(noeudReseau(res, h.id), h.avant);
    } else if(h.type === 'demontage'){
      res.noeuds.push(h.noeud); res.tranchees.push(...h.tranchees);
      if(h.pannes.length) res.pannes = [...(res.pannes || []), ...h.pannes];
    } else if(h.type === 'retrait'){
      if(h.videe) res.tranchees.push(h.tranchee); else trancheeParCle(res, h.cle)[h.quoi] = true;
    } else if(h.type === 'deplacement'){
      Object.assign(noeudReseau(res, h.id), h.avant);
      for(const l of h.longueurs) trancheeParCle(res, l.cle).longueur = l.avant;
    } else if(h.type === 'dameuse'){
      res.dameuse.modele = h.avant;
    } else if(h.type === 'depart'){
      res.noeuds = res.noeuds.filter(n => n.id !== h.id);
      res.numeroDepart--;
    } else {
      const tr = res.tranchees.find(x => cleTranchee(x.a, x.b) === h.cle);
      if(h.nouvelle) res.tranchees = res.tranchees.filter(x => x !== tr); else tr[h.quoi] = false;
    }
  }
  res.budget += rembourse;
  return { ok: true, rembourse };
}
// Direction (degrés) qui fait souffler un canon vers la piste la plus proche ; vers le bas de la pente s'il est dessus
function directionVersPiste(pistes, x, z){
  let best = null, d = Infinity;
  for(const p of pistes) for(const q of courbePiste(p)){ const e = Math.hypot(q[0] - x, q[1] - z); if(e < d){ d = e; best = q; } }
  if(!best || d < 8) return 0;
  return Math.round(Math.atan2(best[0] - x, best[1] - z) * 180 / Math.PI);
}

// --- Les nuits : vent, production, tas de neige, retenue ---
// Vent de la nuit n° numero (tiré au sort, toujours le même pour une même nuit) : force en km/h, direction vers laquelle il souffle
function ventDeLaNuit(niveau, numero){
  const r = alea(niveau.terrain.graine * 7919 + numero * 104729), mini = niveau.ventFort ? 20 : 0;   // ventFort : au moins 20 km/h
  return { force: Math.round(mini + r() * (CONFIG.vent.forceMax - mini)), direction: Math.round(r() * 360 - 180) };
}
// Options du bac à sable : tout est réglable par le joueur
function optionsBac(){
  return {
    budget: null,                 // null = argent illimité, sinon le budget de départ choisi (€)
    vent: null,                   // null = tiré au sort chaque nuit, sinon { force, direction } imposé
    pannes: false,                // pannes oui / non
    frequence: 'normale',         // rare, normale, forte (CONFIG.pannes.frequences)
    typesPannes: Object.fromEntries(Object.keys(CONFIG.pannes.types).map(k => [k, true])),
    eauPayante: true,             // remplissage de la retenue payant
    electricitePayante: true      // électricité payante
  };
}
// --- Bac à sable : pistes tracées et remontées posées par le joueur (reseau.pistesBac, reseau.remonteesBac) ---
function longueurPolyligne(points){ let l = 0; for(let i = 1; i < points.length; i++) l += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); return l; }
function distancePolyligne(points, x, z){ let d = Infinity; for(let i = 1; i < points.length; i++) d = Math.min(d, distanceSegment(x, z, points[i - 1], points[i])); return d; }
// Une piste tracée : dans le domaine, assez longue, sans passer sur la retenue ni sur la salle de pompage
// Pente la plus forte d'un tracé (en %, sur 30 m) et la couleur qui va avec
function penteMaxi(t, points){
  const c = courbe(points, 4);
  let maxi = 0;
  for(let i = 0; i < c.length - 1; i++){
    let j = i, l = 0;
    while(j < c.length - 1 && l < 30){ l += Math.hypot(c[j + 1][0] - c[j][0], c[j + 1][1] - c[j][1]); j++; }
    if(l < 15) break;
    maxi = Math.max(maxi, Math.abs(altitudeNaturelle(t, c[i][0], c[i][1]) - altitudeNaturelle(t, c[j][0], c[j][1])) / l * 100);
  }
  return maxi;
}
function couleurPente(pente, s = CONFIG.couleursPistes){ return pente <= s.verte ? 'verte' : pente <= s.bleue ? 'bleue' : pente <= s.rouge ? 'rouge' : 'noire'; }
function validerPiste(niveau, points, largeur){
  const t = niveau.terrain, R = niveau.retenue, P = niveau.pompage, G = niveau.garage;
  if(points.length < 2) return { ok: false, raison: 'Touchez au moins deux points pour tracer la piste.' };
  if(points.some(([x, z]) => !dansZoneJeu(t, x, z))) return { ok: false, raison: 'La piste doit rester dans le domaine skiable.' };
  const longueur = longueurPolyligne(points);
  if(longueur < CONFIG.bac.pisteMin) return { ok: false, raison: `Une piste fait au moins ${CONFIG.bac.pisteMin} m (ici ${Math.round(longueur)} m).` };
  if(R && distancePolyligne(points, R.x, R.z) < R.cuvette.rayon + largeur / 2 + 3) return { ok: false, raison: 'La piste ne peut pas passer sur la retenue.' };
  if(P && distancePolyligne(points, P.x, P.z) < P.rayon + largeur / 2) return { ok: false, raison: 'La piste ne peut pas passer sur la salle de pompage.' };
  if(G && distancePolyligne(points, G.x, G.z) < G.rayon + largeur / 2) return { ok: false, raison: 'La piste ne peut pas passer sur le garage.' };
  if((niveau.commerces || []).some(c => distancePolyligne(points, c.x, c.z) < rayonCommerce(c) + largeur / 2)) return { ok: false, raison: 'La piste ne peut pas passer sur un commerce.' };
  const pente = penteMaxi(t, points);
  return { ok: true, longueur, pente, couleur: couleurPente(pente), cout: Math.round(longueur * CONFIG.bac.prixPiste) };
}
// Une remontée (télésiège ou téléski) : gare aval plus bas que la gare amont, longueur raisonnable, sans passer sur la retenue,
// la salle de pompage, le garage ni les commerces ; un téléski ne doit pas être trop raide (on se fait tirer sur la neige)
function validerRemontee(niveau, aval, amont, type = 'telesiege'){
  const t = niveau.terrain, R = niveau.retenue, P = niveau.pompage, T = TYPES_REMONTEES[type], [mini, maxi] = T.longueur, le = type === 'teleski' ? 'Le téléski' : 'Le télésiège';
  if(![aval, amont].every(g => dansZoneJeu(t, g.x, g.z))) return { ok: false, raison: 'Les deux gares doivent être dans le domaine skiable.' };
  const longueur = Math.hypot(amont.x - aval.x, amont.z - aval.z);
  if(longueur < mini || longueur > maxi) return { ok: false, raison: `${type === 'teleski' ? 'Un téléski' : 'Un télésiège'} fait entre ${mini} et ${maxi} m (ici ${Math.round(longueur)} m).` };
  const denivele = altitude(t, amont.x, amont.z) - altitude(t, aval.x, aval.z), pente = denivele / longueur * 100;
  if(denivele < (type === 'teleski' ? 8 : 15)) return { ok: false, raison: 'La gare d\'arrivée doit être plus haut que la gare de départ (touchez d\'abord le bas).' };
  if(T.penteMax && pente > T.penteMax) return { ok: false, raison: `Trop raide pour un téléski : ${Math.round(pente)} % de pente moyenne (${T.penteMax} % au plus). Prenez un télésiège.` };
  const ligne = [[aval.x, aval.z], [amont.x, amont.z]];
  if(R && distancePolyligne(ligne, R.x, R.z) < R.rayon + 4) return { ok: false, raison: `${le} ne peut pas passer au-dessus de la retenue.` };
  if(P && distancePolyligne(ligne, P.x, P.z) < P.rayon + 4) return { ok: false, raison: `${le} ne peut pas passer sur la salle de pompage.` };
  if(niveau.garage && distancePolyligne(ligne, niveau.garage.x, niveau.garage.z) < niveau.garage.rayon + 4) return { ok: false, raison: `${le} ne peut pas passer sur le garage.` };
  if((niveau.commerces || []).some(c => distancePolyligne(ligne, c.x, c.z) < rayonCommerce(c) + 3)) return { ok: false, raison: `${le} ne peut pas passer sur un commerce.` };
  return { ok: true, longueur, pente, type, cout: Math.round(longueur * T.prixMetre) };
}
const NOMS_COULEURS = { verte: 'verte', bleue: 'bleue', rouge: 'rouge', noire: 'noire' };
function ajouterPisteBac(niveau, res, points, largeur){
  const v = validerPiste(niveau, points, largeur);
  if(!v.ok) return v;
  if(res.budget < v.cout) return { ok: false, raison: 'Budget insuffisant.' };
  res.pistesBac = res.pistesBac || [];
  const nom = `Piste ${res.pistesBac.length + 1}`;
  res.pistesBac.push({ nom, couleur: v.couleur, largeur, pente: Math.round(v.pente), terrasse: true, points: points.map(([x, z]) => [Math.round(x), Math.round(z)]) });
  res.budget -= v.cout;
  return { ...v, nom };
}
function ajouterRemonteeBac(niveau, res, aval, amont, type = 'telesiege'){
  const v = validerRemontee(niveau, aval, amont, type);
  if(!v.ok) return v;
  if(res.budget < v.cout) return { ok: false, raison: 'Budget insuffisant.' };
  res.remonteesBac = res.remonteesBac || [];
  const T = TYPES_REMONTEES[type], dejaPris = new Set((niveau.remontees || []).concat(res.remonteesBac).map(q => q.nom));
  let k = res.remonteesBac.filter(q => (q.type || 'telesiege') === type).length + 1;
  while(dejaPris.has(`${T.nom} ${k}`)) k++;
  const nom = `${T.nom} ${k}`, gares = { aval: { x: Math.round(aval.x), z: Math.round(aval.z) }, amont: { x: Math.round(amont.x), z: Math.round(amont.z) } };
  res.remonteesBac.push(type === 'teleski'
    ? { nom, type, ...gares, pylones: Math.max(1, Math.round(v.longueur / 70)), hauteur: 7, ecart: 2.6, espacementSieges: 14 }
    : { nom, type, ...gares, pylones: Math.max(2, Math.round(v.longueur / 55)), hauteur: 10, ecart: 5, espacementSieges: 22 });
  res.budget -= v.cout;
  return { ...v, nom };
}

// Vent prévu pour la prochaine nuit : celui choisi dans le bac à sable, sinon celui tiré au sort
function ventPrevu(niveau, res){ return (res.options && res.options.vent) || ventDeLaNuit(niveau, res.nuit); }
// Où tombe la neige d'un enneigeur : centre de la zone enneigée (déportée par le vent) et son rayon
function pointChute(n, vent){
  const m = CATALOGUE[n.modele], cv = CONFIG.vent, rad = Math.PI / 180;
  let portee, hauteurJet;
  if(m.type === 'ventilateur'){
    const s = SUPPORTS[n.support || 'trepied'], incl = borne(n.inclinaison, 0, 35);
    portee = m.portee * s.portee * (0.7 + 0.3 * incl / 35);
    hauteurJet = s.pivot + 1 + portee * Math.tan(incl * rad) * 0.25;
  } else {
    portee = m.portee;
    hauteurJet = PERCHE.support + m.longueur * Math.cos(PERCHE.penche * rad);   // tête de la perche, en haut du support
  }
  const derive = vent.force / 3.6 * (hauteurJet / cv.vitesseChute) * cv.entrainement;
  const d = n.direction * rad, w = vent.direction * rad;
  return { x: n.x + Math.sin(d) * portee + Math.sin(w) * derive, z: n.z + Math.cos(d) * portee + Math.cos(w) * derive,
    rayon: 5 + portee * 0.25, portee, hauteurJet, derive };
}
// Part (0 à 1) de la zone enneigée qui tombe sur une piste (on regarde 19 points dans le cercle)
function partSurPiste(pistes, x, z, rayon){
  let dessus = 0, total = 0;
  for(const [nb, f] of [[1, 0], [6, 0.5], [12, 1]]) for(let i = 0; i < nb; i++){
    const a = i / nb * Math.PI * 2 + f, px = x + Math.cos(a) * rayon * f, pz = z + Math.sin(a) * rayon * f;
    total++;
    if(pistes.some(p => surPiste(p, px, pz))) dessus++;
  }
  return dessus / total;
}
// Fonctionnement de tous les canons prêts pendant une nuit. Plus on ouvre de canons, plus la pression baisse :
// tant qu'un canon manque de pression, on ferme le plus défavorisé et on recalcule.
function regimeNuit(niveau, res, vent){
  const t = niveau.terrain, pomp = noeudReseau(res, 'pompage'), cp = CONFIG.pompage;
  const cmd = res.pompage || { mode: 'auto', marche: [true, true, true], ouverture: 1 };
  const P = effetsPannes(niveau, res), installees = niveau.pompes || cp.pompes;   // carrière : pompes installées
  const eau = alimentes(P.resEau, 'eau'), elec = alimentes(res, 'cable', P.coupees), longueurs = longueursEau(P.resEau);
  const air = alimentes(res, 'air'), longueursAir = longueursReseau(res, 'air'), ca = CONFIG.air;
  const sec = !!(res.retenue && res.retenue.volume <= 0);
  const perche = n => CATALOGUE[n.modele].type === 'perche';
  const canons = res.noeuds.filter(n => n.type === 'regard' && eau.has(n.id) && elec.has(n.id) && (!perche(n) || air.has(n.id))).map(n => {
    const chute = pointChute(n, vent), panne = P.canons.get(n.id) || null;
    // Air à la perche : pression du réservoir moins les pertes dans la conduite d'air
    const pressionAir = perche(n) && res.compresseur ? Math.max(0, res.compresseur.pression - longueursAir.get(n.id) / 100 * ca.perteLongueur) : null;
    return { id: n.id, modele: n.modele, longueur: longueurs.get(n.id), denivele: altitude(t, n.x, n.z) - altitude(t, pomp.x, pomp.z), pressionAir,
      chute, part: partSurPiste(niveau.pistes, chute.x, chute.z, chute.rayon), arrete: !!n.arret, ouvert: !sec && !n.arret && panne !== 'moteur',
      panne, perteFuite: P.aval.get(n.id) || 0, pression: 0, zone: 'arret', facteur: 0, debit: 0, production: 0 };
  });
  // Pompes : en automatique, juste assez de pompes pour la demande, et la vanne se règle seule pour ne pas dépasser
  // la pression nominale ; en manuel, ce sont les pompes démarrées et la vanne réglées par le joueur.
  let pompes = 0, capacite = 0, pDepart = 0;
  for(let k = 0; k <= canons.length; k++){
    const demande = canons.reduce((s, c) => s + (c.ouvert ? CATALOGUE[c.modele].debit : 0), 0) + P.debitFuites;   // m³/h, fuites comprises
    pompes = cmd.mode === 'auto' ? Math.min(installees - P.pompes.size, Math.max(demande > 0 ? 1 : 0, Math.ceil(demande / cp.debitNominal)))
                                 : cmd.marche.filter((m, i) => m && i < installees && !P.pompes.has(i)).length;
    capacite = pompes * cp.debitNominal;
    const ouverture = borne(cmd.ouverture, 0, 1);
    const eau = !sec && pompes > 0 && ouverture > 0;
    pDepart = 0;
    if(eau){
      pDepart = pressionPompes(demande, pompes) - perteVanne(demande, ouverture);
      if(cmd.mode === 'auto') pDepart = Math.min(pDepart, CONFIG.pression.pompes);      // régulation automatique
    }
    for(const c of canons){
      const m = CATALOGUE[c.modele];
      c.pression = !eau ? 0 : Math.max(0, pressionRegard({ pPompes: pDepart, longueur: c.longueur, denivele: c.denivele, debit: demande }) - c.perteFuite);
      c.zone = zonePression(c.pression, m);
      c.facteur = c.ouvert ? facteurProduction(c.pression, m) : 0;
      if(c.pressionAir !== null) c.facteur = Math.min(c.facteur, facteurAir(c.pressionAir));   // pas assez d'air : pas de neige
      if(c.panne === 'gel') c.facteur *= CONFIG.pannes.types.gel.facteur;                      // buse gelée : moins de neige
    }
    const enDefaut = canons.filter(c => c.ouvert && c.facteur === 0);
    if(!enDefaut.length) break;
    enDefaut.sort((a, b) => a.pression - b.pression)[0].ouvert = false;
  }
  for(const c of canons){ const m = CATALOGUE[c.modele]; c.debit = c.ouvert ? m.debit : 0; c.production = c.facteur * m.neige; }
  // Exploitation : chaque nivoculteur fait tourner un nombre de canons ; au-delà, la production baisse
  if(res.personnel){
    const nb = canons.filter(c => c.production > 0).length, cap = res.personnel.nivoculteur * CONFIG.exploitation.nivoculteurCanons;
    if(nb > cap) for(const c of canons) c.production *= cap / nb;
  }
  const fuite = !sec && pompes > 0 && cmd.ouverture > 0 ? P.debitFuites : 0;     // l'eau perdue par les fuites sort aussi de la retenue
  const debit = canons.reduce((s, c) => s + c.debit, 0) + fuite;
  // Compresseur : en automatique, il tourne dès qu'une perche prête attend de l'air ; en manuel, selon la commande
  let regimeAir = null;
  if(res.compresseur){
    const attente = canons.some(c => c.pressionAir !== null && !c.arrete);
    regimeAir = { marche: cmd.mode === 'auto' ? attente : !!res.compresseur.marche, capacite: ca.capacite,
      demande: canons.reduce((s, c) => s + (c.ouvert && c.pressionAir !== null ? CATALOGUE[c.modele].air : 0), 0), pression: res.compresseur.pression };
  }
  return { vent, canons, debit, sec, pompes, capacite, surcharge: debit > capacite && pompes > 0,
    pressionDepart: Math.max(0, pDepart), air: regimeAir, fuite, pompesEnPanne: [...P.pompes], pompesInstallees: installees };
}
// Part de la production (0 à 1) selon la pression d'air à la perche
function facteurAir(p, ca = CONFIG.air){
  if(p < ca.pressionMin) return 0;
  return borne(0.35 + 0.65 * (p - ca.pressionMin) / (ca.pressionPleine - ca.pressionMin), 0, 1);
}
// Pression des pompes en marche selon le débit demandé (m³/h) : courbe d'une pompe centrifuge
function pressionPompes(debit, pompes, cp = CONFIG.pompage){
  if(!pompes) return 0;
  const q = debit / pompes / cp.debitNominal;
  return cp.pressionVanneFermee - (cp.pressionVanneFermee - CONFIG.pression.pompes) * q * q;
}
// Perte dans la vanne principale mi-fermée (bar)
function perteVanne(debit, ouverture){
  return debit * CONFIG.pression.perteDebit * (1 / (ouverture * ouverture) - 1);
}
// --- Pannes (niveau 4) ---
// Ce que les pannes en cours changent au réseau. Une fuite active perd de l'eau et fait chuter la pression en aval ;
// pendant sa réparation, la conduite est isolée (plus d'eau en aval). Un disjoncteur coupe son départ électrique.
function effetsPannes(niveau, res){
  const E = { resEau: res, coupees: new Set(), canons: new Map(), pompes: new Set(), aval: new Map(), debitFuites: 0 };
  const pannes = res.pannes || [];
  if(!pannes.length) return E;
  const sansEau = (r, cles) => ({ ...r, tranchees: r.tranchees.map(tr => cles.has(cleTranchee(tr.a, tr.b)) ? { ...tr, eau: false } : tr) });
  const isolees = new Set(pannes.filter(p => p.type === 'fuite' && p.etat === 'reparation').map(p => p.cible));
  if(isolees.size) E.resEau = sansEau(res, isolees);
  const eau = alimentes(E.resEau, 'eau'), tf = CONFIG.pannes.types.fuite;
  for(const p of pannes){
    if(p.type === 'disjoncteur') E.coupees.add(p.cible);
    else if(p.type === 'moteur' || p.type === 'gel') E.canons.set(p.cible, p.type);
    else if(p.type === 'pompe') E.pompes.add(+p.cible);
    else if(p.type === 'fuite' && p.etat === 'active' && trancheeParCle(res, p.cible)){
      E.debitFuites += tf.debit;
      const reste = alimentes(sansEau(E.resEau, new Set([p.cible])), 'eau');
      for(const id of eau) if(!reste.has(id)) E.aval.set(id, (E.aval.get(id) || 0) + tf.perte);
    }
  }
  return E;
}
function trancheeParCle(res, cle){ return res.tranchees.find(tr => cleTranchee(tr.a, tr.b) === cle); }
// Ce qui peut tomber en panne : seulement ce qui fonctionne à cet instant (canons qui produisent, pompes en marche,
// conduites où l'eau circule vers un canon, départs électriques qui alimentent un canon), jamais deux fois la même chose.
function ciblesPannes(niveau, res, regime){
  const deja = new Set((res.pannes || []).map(p => p.type + p.cible));
  const actifs = regime.canons.filter(c => c.production > 0 && !c.panne), ids = new Set(actifs.map(c => c.id));
  const type = id => CATALOGUE[noeudReseau(res, id).modele].type;
  const coupe = perdus => [...perdus].some(id => ids.has(id));
  const eau = alimentes(res, 'eau'), elec = alimentes(res, 'cable');
  const c = {
    fuite: res.tranchees.filter(tr => tr.eau && regime.pompes > 0).map(tr => cleTranchee(tr.a, tr.b)).filter(cle => {
      const reste = alimentes({ ...res, tranchees: res.tranchees.map(tr => cleTranchee(tr.a, tr.b) === cle ? { ...tr, eau: false } : tr) }, 'eau');
      return coupe([...eau].filter(id => !reste.has(id)));
    }),
    moteur: actifs.filter(q => type(q.id) === 'ventilateur').map(q => q.id),
    gel: actifs.filter(q => type(q.id) === 'perche').map(q => q.id),
    disjoncteur: res.noeuds.filter(n => n.type === 'elec').map(n => n.id).filter(src => {
      const reste = alimentes(res, 'cable', new Set([src]));
      return coupe([...elec].filter(id => !reste.has(id)));
    }),
    pompe: (res.pannes || []).some(p => p.type === 'pompe') ? [] : pompesEnMarche(res, regime).map(String)   // une pompe en défaut à la fois
  };
  for(const k in c) c[k] = c[k].filter(x => !deja.has(k + x));
  return c;
}
// Indices des pompes qui tournent (en automatique : les premières pompes qui ne sont pas en panne)
function pompesEnMarche(res, regime){
  const cmd = res.pompage, hs = regime.pompesEnPanne || [], n = regime.pompesInstallees || 3;
  if(cmd.mode !== 'auto') return [0, 1, 2].filter(i => i < n && cmd.marche[i] && !hs.includes(i));
  return [0, 1, 2].filter(i => i < n && !hs.includes(i)).slice(0, regime.pompes);
}
// Pannes de la nuit, tirées au sort au début de la nuit (toujours les mêmes pour une même nuit) : on tire les
// instants et les dés ; ce qui casse est choisi au moment de la panne, parmi ce qui fonctionne à cet instant.
function planifierPannes(niveau, res){
  res.pannesPrevues = [];
  if(!(niveau.pannes || (res.options && res.options.pannes))) return [];
  const cp = CONFIG.pannes, r = alea(niveau.terrain.graine * 4513 + res.nuit * 92821 + 7);
  const o = res.options, freq = o && o.pannes ? o.frequence : niveau.frequencePannes;
  const [mini, maxi] = cp.frequences[freq] || cp.parNuit;
  const nb = mini + Math.floor(r() * (maxi - mini + 1));
  for(let k = 0; k < nb; k++) res.pannesPrevues.push({ t: cp.moment[0] + r() * (cp.moment[1] - cp.moment[0]), de1: r(), de2: r() });
  res.pannesPrevues.sort((a, b) => a.t - b.t);
  return res.pannesPrevues;
}
function declencherPanne(res, type, cible, t = 0){
  res.pannes = res.pannes || [];
  const p = { id: `P${res.numeroPanne = (res.numeroPanne || 0) + 1}`, type, cible, nuit: res.nuit, t, etat: 'active', fin: null };
  res.pannes.push(p);
  res.pannesNuit = (res.pannesNuit || 0) + 1;
  return p;
}
// Les pannes qui arrivent entre deux instants de la nuit (regime : le fonctionnement à cet instant)
function evenementsPannes(niveau, res, tAvant, tApres, regime){
  const dues = (res.pannesPrevues || []).filter(e => e.t > tAvant && e.t <= tApres);
  if(!dues.length) return [];
  res.pannesPrevues = res.pannesPrevues.filter(e => !dues.includes(e));
  const cp = CONFIG.pannes, nouvelles = [];
  for(const e of dues){
    // Types possibles : ceux cochés dans le bac à sable, ceux de l'étape de carrière, sinon tous
    const permis = res.options && res.options.pannes ? res.options.typesPannes || {}
      : Array.isArray(niveau.pannes) ? Object.fromEntries(Object.keys(cp.types).map(k => [k, niveau.pannes.includes(k)])) : null;
    const cibles = ciblesPannes(niveau, res, regime), types = Object.keys(cp.types).filter(ty => (cibles[ty] || []).length && (!permis || permis[ty] !== false));
    if(!types.length) continue;                    // rien ne tourne : pas de panne
    let x = e.de1 * types.reduce((s, ty) => s + cp.types[ty].poids, 0), type = types[0];
    for(const ty of types){ x -= cp.types[ty].poids; if(x < 0){ type = ty; break; } }
    const liste = cibles[type];
    nouvelles.push(declencherPanne(res, type, liste[Math.floor(e.de2 * liste.length)], e.t));
    regime = regimeNuit(niveau, res, regime.vent);  // la suivante tient compte de celle-ci
  }
  return nouvelles;
}
// Envoyer l'équipe : on paie tout de suite ; la nuit, la réparation prend du temps, le jour elle est immédiate
function reparerPanne(niveau, res, id, enNuit = false, t = 0){
  const p = (res.pannes || []).find(q => q.id === id);
  if(!p) return { ok: false, raison: 'Cette panne est déjà réparée.' };
  if(p.etat === 'reparation') return { ok: false, raison: 'L\'équipe est déjà sur place.' };
  const ty = CONFIG.pannes.types[p.type];
  if(res.budget < ty.cout) return { ok: false, raison: `Budget insuffisant : il faut ${ty.cout.toLocaleString('fr-FR')} €.` };
  res.budget -= ty.cout;
  res.reparationsNuit = (res.reparationsNuit || 0) + ty.cout;
  if(!enNuit){ res.pannes = res.pannes.filter(q => q !== p); return { ok: true, cout: ty.cout, finie: true }; }
  // Exploitation : les techniciens de maintenance réparent plus vite (2 fois plus lentement sans technicien)
  const duree = res.personnel ? Math.round(ty.duree * 2 / (1 + res.personnel.technicien) * 10) / 10 : ty.duree;
  p.etat = 'reparation'; p.fin = t + duree;
  return { ok: true, cout: ty.cout, finie: false, duree };
}
// Les réparations terminées à l'instant t
function avancerPannes(res, t){
  const finies = (res.pannes || []).filter(p => p.etat === 'reparation' && p.fin <= t);
  if(finies.length) res.pannes = res.pannes.filter(p => !finies.includes(p));
  return finies;
}
// Nom lisible de ce qui est en panne, et où c'est
function libellePanne(res, p){
  const nom = id => (noeudReseau(res, id) || { nom: id }).nom;
  if(p.type === 'fuite'){ const [a, b] = p.cible.split('|'); return `conduite ${nom(a)} – ${nom(b)}`; }
  if(p.type === 'pompe') return `pompe ${+p.cible + 1}`;
  if(p.type === 'remontee') return p.cible;
  return nom(p.cible);
}
function positionPanne(res, p){
  if(p.x !== undefined) return { x: p.x, z: p.z };
  if(p.type === 'fuite'){
    const [a, b] = p.cible.split('|').map(id => noeudReseau(res, id));
    return a && b ? { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 } : null;
  }
  const n = noeudReseau(res, p.type === 'pompe' ? 'pompage' : p.cible);
  return n ? { x: n.x, z: n.z } : null;
}

function debutNuit(niveau, res){
  res.historique = [];                       // on ne peut plus annuler ce qui a été construit avant la nuit
  res.neigeNuit = 0; res.pisteNuit = 0; res.argentNuit = 0; res.potentielNuit = 0; res.coupsNuit = 0; res.kwhNuit = 0;
  res.pannesNuit = 0; res.reparationsNuit = 0;
  planifierPannes(niveau, res);
  res.dispoAvant = Object.keys(CATALOGUE).filter(k => disponible(niveau, res, k).ok);
  if(niveau.programme){
    // Démarrage « à froid » : pompes arrêtées, vanne fermée, canons fermés en attendant le programme de la nuit
    res.pompage = { mode: 'manuel', marche: [false, false, false], ouverture: 0, histo: [] };
    for(const n of res.noeuds) if(n.type === 'regard') n.arret = true;
  }
  return regimeNuit(niveau, res, ventPrevu(niveau, res));
}
// Programme de la nuit (niveau 1) : les canons que le chef d'équipe ouvre ou ferme entre deux instants
function evenementsProgramme(niveau, res, tAvant, tApres){
  const ev = [];
  for(const e of niveau.programme || []){
    if(!(tAvant < 0 ? e.t >= 0 && e.t <= tApres : e.t > tAvant && e.t <= tApres)) continue;   // tAvant < 0 : début de la nuit
    for(const id of e.ouvrir || []) if(noeudReseau(res, id)){ noeudReseau(res, id).arret = false; ev.push({ id, ouvert: true, texte: e.texte }); }
    for(const id of e.fermer || []) if(noeudReseau(res, id)){ noeudReseau(res, id).arret = true; ev.push({ id, ouvert: false, texte: e.texte }); }
  }
  return ev;
}
// Fait avancer la nuit de dt secondes de jeu : la neige s'ajoute aux tas, l'eau sort de la retenue
function avancerNuit(niveau, res, regime, dt){
  const heures = CONFIG.nuit.echelle / 3600 * dt;                          // heures réelles écoulées
  for(const c of regime.canons){
    if(!c.arrete) res.potentielNuit += CATALOGUE[c.modele].neige * heures;  // ce qu'on aurait pu faire avec une bonne pression
    if(!c.production) continue;
    const v = c.production * heures, vPiste = v * c.part;                   // production en m³/h
    res.neigeTotale += v; res.neigeNuit += v;
    res.pisteNuit += vPiste;                                                // tombé sur la piste : la dameuse l'étalera le matin
    if(!c.tas){
      c.tas = res.tas.find(q => Math.hypot(q.x - c.chute.x, q.z - c.chute.z) < 6);
      if(!c.tas){ c.tas = { x: c.chute.x, z: c.chute.z, volume: 0, aDamer: 0 }; res.tas.push(c.tas); }
    }
    c.tas.volume += v;
    c.tas.aDamer = (c.tas.aDamer || 0) + vPiste;
  }
  // Réservoir d'air : monte vers la pression nominale quand le compresseur tourne (moins s'il est surchargé), baisse sinon
  if(res.compresseur && regime.air){
    const a = regime.air, ca = CONFIG.air, c = res.compresseur;
    const cible = a.marche ? ca.pressionNominale * Math.min(1, a.capacite / Math.max(1, a.demande)) : 0;
    c.pression += (cible - c.pression) * Math.min(1, (a.marche ? ca.montee : ca.fuite) * dt);
    if(a.marche) res.kwhNuit = (res.kwhNuit || 0) + ca.puissance * heures;
  }
  res.kwhNuit = (res.kwhNuit || 0) + regime.pompes * CONFIG.pompage.puissance * heures;   // pompes
  let vide = false;
  if(res.retenue && regime.debit > 0){
    res.retenue.volume -= regime.debit * CONFIG.nuit.echelle / 3600 * dt;      // m³/h × heures réelles écoulées
    if(res.retenue.volume <= 0){ res.retenue.volume = 0; vide = true; }
  }
  return { vide };
}

// --- Commandes du poste de travail ---
function commanderPompes(res, mode, marche){ res.pompage.mode = mode; if(marche) res.pompage.marche = marche.slice(); }
function commanderCanon(res, id, enMarche){ noeudReseau(res, id).arret = !enMarche; }
function commanderCompresseur(res, enMarche){ if(res.compresseur) res.compresseur.marche = enMarche; }
// Coup de bélier : compté, réparation payée dans les niveaux avec budget
function coupDeBelier(niveau, res, raison){
  res.coups = (res.coups || 0) + 1;
  res.coupsNuit = (res.coupsNuit || 0) + 1;
  if(niveau.construction !== false) res.budget -= CONFIG.belier.reparation;
  return { coup: true, raison };
}
// Vanne principale manœuvrée à l'instant t (secondes) : trop vite, avec de l'eau qui circule, c'est un coup de bélier.
// (en automatique, l'automate manœuvre lui-même en douceur)
function commanderVanne(res, ouverture, t = 0, niveau = null, eauCircule = false){
  const p = res.pompage, b = CONFIG.belier;
  ouverture = borne(Math.round(ouverture * 100) / 100, 0, 1);
  p.histo = (p.histo || []).filter(h => t - h.t < b.fenetre);
  p.histo.push({ t, o: p.ouverture });
  const reference = p.histo[0].o;
  p.ouverture = ouverture;
  if(niveau && eauCircule && p.mode === 'manuel' && Math.abs(ouverture - reference) > b.variationMax + 1e-6){
    p.histo = [];
    return coupDeBelier(niveau, res, ouverture > reference ? 'vanne ouverte trop vite' : 'vanne fermée trop vite');
  }
  return { coup: false };
}
// Démarrer ou arrêter une pompe en manuel : la première pompe se démarre (et la dernière s'arrête) vanne presque fermée
function commanderPompe(niveau, res, i, enMarche, enProduction = true){
  const p = res.pompage, avant = p.marche.filter(Boolean).length;
  const m = p.marche.slice(); m[i] = enMarche; p.marche = m;
  const apres = m.filter(Boolean).length;
  if(enProduction && p.ouverture > CONFIG.belier.ouvertureDemarrage && ((avant === 0 && apres === 1) || (avant === 1 && apres === 0)))
    return coupDeBelier(niveau, res, enMarche ? 'pompe démarrée vanne ouverte' : 'dernière pompe arrêtée vanne ouverte');
  return { coup: false };
}

// Fin de nuit : l'argent gagné s'ajoute au budget, la retenue se remplit un peu pendant la journée
function finNuit(niveau, res){
  const gratuite = res.options && res.options.electricitePayante === false;
  const damage = damerNeige(niveau, res);                         // le matin, la dameuse étale les tas : c'est cette neige qui se vend
  const kwhRemontees = Math.round(kwhRemonteesJour(niveau, res));
  const gain = niveau.exploitation ? 0 : Math.round(damage.m3 * CONFIG.gains.parM3Piste), kwh = Math.round(res.kwhNuit || 0) + kwhRemontees;
  const electricite = gratuite ? 0 : Math.round(kwh * CONFIG.electricite.prixKwh);
  res.budget += gain - electricite;
  const bilan = { nuit: res.nuit, neige: res.neigeNuit || 0, piste: res.pisteNuit || 0, dame: damage.m3, aDamer: damage.reste, tasDames: damage.tas, capacite: damage.capacite,
    gain, kwh, kwhRemontees, electricite, coups: res.coupsNuit || 0,
    rendement: res.potentielNuit > 0 ? res.neigeNuit / res.potentielNuit : null,
    pannes: res.pannesNuit || 0, reparations: res.reparationsNuit || 0,
    nouveaux: Object.keys(CATALOGUE).filter(k => disponible(niveau, res, k).ok && !(res.dispoAvant || []).includes(k)) };
  res.nuit++;
  res.argentNuit = 0;
  if(res.compresseur) res.compresseur.pression = 0;           // le réservoir se vide pendant la journée
  if(res.pannes) res.pannes = res.pannes.filter(p => p.etat !== 'reparation');   // l'équipe finit son travail ; les autres pannes restent
  res.pannesPrevues = [];
  bilan.remplissage = remplirRetenue(niveau, res);
  bilan.damage = damage;
  if(niveau.exploitation) bilan.neigeNaturelle = neigeNaturelle(niveau, res);
  bilan.net = gain - electricite - bilan.remplissage.cout;
  res.recettes = (res.recettes || 0) + bilan.net;                 // recettes nettes depuis le début (carrière)
  Object.assign(bilan, resultatNiveau(niveau, res));
  return bilan;
}
// --- Dameuse ---
// Neige tombée sur les pistes qui attend la dameuse (m³)
function neigeADamer(res){ return res.tas.reduce((s, q) => s + (q.aDamer || 0), 0); }
// Le matin, la dameuse étale les tas sur la piste, jusqu'à sa capacité du jour (les plus gros tas d'abord).
// Ce qui est étalé compte pour les pistes et se vend ; le reste attend le lendemain.
function damerNeige(niveau, res){
  const m = DAMEUSES[(res.dameuse && res.dameuse.modele) || 'dm400'];
  let capacite = m.capacite, surface = m.surface, litres = 0, travail = 1;
  // Exploitation : il faut un conducteur (un 2e allonge le travail) et du gazole
  if(niveau.exploitation && res.personnel){
    const c = res.personnel.conducteur;
    travail = c <= 0 ? 0 : c >= 2 ? 1.6 : 1;
    travail = Math.min(travail, res.carburant.stock / m.conso);          // pas assez de gazole : elle s'arrête plus tôt
    capacite *= travail; surface *= travail;
  }
  let reste = capacite, total = 0;
  const tas = [];
  for(const q of [...res.tas].filter(q => q.aDamer > 0.01).sort((a, b) => b.aDamer - a.aDamer)){
    if(reste <= 0) break;
    const v = Math.min(reste, q.aDamer);
    q.aDamer -= v; q.volume = Math.max(0, q.volume - v); reste -= v; total += v;
    if(q.aDamer < 0.01){ q.aDamer = 0; q.dame = true; }
    tas.push({ x: q.x, z: q.z });
    // Exploitation : la neige étalée épaissit la piste où elle est tombée
    if(niveau.exploitation && res.enneigement){
      const pp = pistePlusProche(niveau.pistes, q.x, q.z);
      if(pp) res.enneigement[pp.piste.nom] = (res.enneigement[pp.piste.nom] || 0) + v / surfacePiste(pp.piste) * 100;
    }
  }
  res.neigePiste += total;
  let qualite = null;
  if(niveau.exploitation && res.personnel){
    // Elle dame aussi toutes les pistes ouvrables : qualité = part de la surface qu'elle a pu damer
    const aDamer = niveau.pistes.filter(p => (res.enneigement[p.nom] || 0) >= CONFIG.exploitation.ouverture).reduce((t, p) => t + surfacePiste(p), 0);
    qualite = aDamer ? Math.min(1, surface / aDamer) : 1;
    const charge = travail > 0 ? Math.max(total / m.capacite, aDamer ? Math.min(aDamer, surface) / m.surface : 0, total > 0 || aDamer ? 0.25 : 0) : 0;
    litres = Math.min(res.carburant.stock, Math.round(m.conso * charge));
    res.carburant.stock -= litres;
    res.damageQualite = qualite;
  }
  return { m3: total, reste: neigeADamer(res), capacite, tas, qualite, litres, sansConducteur: !!(res.personnel && res.personnel.conducteur <= 0) };
}
// Changer de dameuse (l'ancienne est reprise) : on paie la différence
function devisDameuse(res, modele){
  const actuel = (res.dameuse && res.dameuse.modele) || 'dm400', m = DAMEUSES[modele];
  if(!m) return { ok: false, raison: 'Ce modèle n\'existe pas.' };
  if(actuel === modele) return { ok: false, raison: 'C\'est déjà cette dameuse.' };
  const reprise = Math.round(DAMEUSES[actuel].prix * CONFIG.dameuse.reprise), cout = m.prix - reprise;
  return { ok: res.budget >= cout, raison: res.budget >= cout ? null : 'Budget insuffisant.', cout, reprise };
}
function changerDameuse(res, modele, lot = ++res.lot){
  const d = devisDameuse(res, modele);
  if(!d.ok) return d;
  res.historique.push({ lot, type: 'dameuse', avant: res.dameuse.modele, cout: d.cout });
  res.dameuse.modele = modele;
  res.budget -= d.cout;
  return d;
}

// --- Remontées mécaniques ---
function longueurRemontee(ts){ return Math.hypot(ts.amont.x - ts.aval.x, ts.amont.z - ts.aval.z); }
function puissanceRemontee(ts){ return Math.round(longueurRemontee(ts) * typeRemontee(ts).kwParMetre); }
function remonteeEnMarche(res, ts){ return (res.remonteesEnMarche || []).includes(ts.nom); }
function basculerRemontee(res, nom, enMarche){
  const l = new Set(res.remonteesEnMarche || []);
  if(enMarche) l.add(nom); else l.delete(nom);
  res.remonteesEnMarche = [...l];
}
// Électricité des remontées qui tournent pendant la journée (kWh)
function kwhRemonteesJour(niveau, res){
  return (niveau.remontees || []).filter(ts => remonteeEnMarche(res, ts)).reduce((s, ts) => s + puissanceRemontee(ts) * CONFIG.remontees.heuresJour, 0);
}

// Remplissage de la retenue pendant la journée : le volume commandé (sans dépasser la place libre ni le budget), payé au m³
function remplirRetenue(niveau, res){
  const R = res.retenue;
  if(!R) return { m3: 0, cout: 0 };
  const prix = res.options && res.options.eauPayante === false ? 0 : niveau.prixEau ?? CONFIG.retenue.prixM3, voulu = R.remplissage ?? CONFIG.retenue.remplissageJour;
  const m3 = Math.max(0, Math.floor(Math.min(voulu, volumeRetenue(niveau.retenue) - R.volume, prix > 0 ? Math.max(0, res.budget) / prix : Infinity)));
  const cout = Math.round(m3 * prix);
  R.volume += m3; res.budget -= cout;
  return { m3, cout };
}
// Où en est le niveau ? reussi / rate (avec la raison) / en cours
function resultatNiveau(niveau, res){
  const o = niveau.objectif, coups = res.coups || 0;
  if(o.type === 'libre' || o.type === 'exploitation') return { reussi: false, rate: null };     // bac à sable : pas d'objectif
  if(o.type === 'carriere'){
    const e = avancementEtape(res);
    if(e.neige >= o.m3 && e.recette >= o.recette) return { reussi: true, rate: null };
    if(e.nuits >= o.nuits) return { reussi: false, rate: `Les ${o.nuits} nuits de l'étape sont passées : ${e.neige < o.m3 ? 'pas assez de neige sur les pistes' : 'pas assez de recettes'}.` };
    return { reussi: false, rate: null };
  }
  if(o.coupsMax !== undefined && coups > o.coupsMax) return { reussi: false, rate: `${coups} coups de bélier : une conduite a cassé.` };
  const fait = o.type === 'production' ? res.neigeTotale >= o.m3 : res.neigePiste >= o.m3;
  if(fait) return { reussi: true, rate: null };
  if(o.nuits && res.nuit > o.nuits) return { reussi: false, rate: `Les ${o.nuits} nuits sont passées sans atteindre l'objectif.` };
  return { reussi: false, rate: null };
}
// --- Exploitation ---
function surfacePiste(p){ return longueurLigne(courbePiste(p)) * p.largeur; }
function creerExploitation(niveau, res){
  const E = CONFIG.exploitation;
  res.exploitation = { saison: 1, jour: 1, phase: 'soir', reputation: E.reputationDepart, jours: [], saisons: [], debutBudget: res.budget };
  res.personnel = Object.fromEntries(Object.entries(METIERS).map(([k, m]) => [k, m.depart]));
  res.prixForfait = E.prixDepart;
  res.carburant = { stock: E.carburant.depart };
  res.enneigement = Object.fromEntries(niveau.pistes.map(p => [p.nom, E.enneigementDepart]));
  res.remonteesEnMarche = (niveau.remontees || []).map(ts => ts.nom);
  res.commerces = [];
  return res;
}
const idealSaison = res => CONFIG.exploitation.ideal + 5 * (res.exploitation.saison - 1);
// Neige naturelle tombée pendant la nuit (au hasard, toujours la même pour une même nuit)
function neigeNaturelle(niveau, res){
  const N = CONFIG.exploitation.neigeNaturelle, r = alea(niveau.terrain.graine * 613 + res.nuit * 7703 + res.exploitation.saison * 31);
  if(r() > N.chance) return 0;
  const cm = Math.round(N.min + r() * (N.max - N.min));
  for(const p of niveau.pistes) res.enneigement[p.nom] = (res.enneigement[p.nom] || 0) + cm;
  return cm;
}
function enPanne(res, nom){ return (res.pannes || []).some(p => p.type === 'remontee' && p.cible === nom); }
// Remontées qui peuvent ouvrir : en marche, avec assez d'agents (dans l'ordre), pas en panne
function remonteesEnService(niveau, res){
  const E = CONFIG.exploitation;
  let agents = res.personnel ? res.personnel.agent : Infinity;
  return (niveau.remontees || []).filter(ts => {
    const besoin = typeRemontee(ts).agents;
    if(!remonteeEnMarche(res, ts) || agents < besoin) return false;
    agents -= besoin;
    return true;
  });
}
// Une piste est desservie si son départ est près de l'arrivée d'une remontée
function remonteesDePiste(niveau, piste, remontees){
  const h = extremitesPiste(niveau.terrain, piste).haut;
  return remontees.filter(ts => Math.hypot(ts.amont.x - h[0], ts.amont.z - h[1]) < CONFIG.exploitation.desserte);
}
function pistesOuvertes(niveau, res, remontees = remonteesEnService(niveau, res).filter(ts => !enPanne(res, ts.nom))){
  return niveau.pistes.filter(p => (res.enneigement[p.nom] || 0) >= CONFIG.exploitation.ouverture && remonteesDePiste(niveau, p, remontees).length);
}
// Clients attendus pour la journée selon les pistes ouvertes, leur enneigement, le prix, la réputation et le calendrier
function clientsAttendus(niveau, res, pistes = pistesOuvertes(niveau, res)){
  const E = CONFIG.exploitation, ex = res.exploitation;
  if(!pistes.length) return 0;
  const ideal = idealSaison(res), qualiteNeige = pistes.reduce((s, p) => s + Math.min(1, res.enneigement[p.nom] / ideal), 0) / pistes.length;
  const attrait = Math.min(1.5, 0.35 + 0.33 * pistes.length) * (0.5 + 0.5 * qualiteNeige);
  const prixF = borne((E.prixReference / res.prixForfait) ** 1.3, 0.3, 1.8);
  const cal = E.calendrier[(ex.jour - 1) % E.calendrier.length];
  return Math.round(E.clientsBase * E.croissance ** (ex.saison - 1) * cal * attrait * prixF * (0.4 + 0.75 * ex.reputation) * effetCommerces(res, 'clients', 1));
}
// Début de la journée : combien de clients viennent (enneigement, pistes ouvertes, prix, réputation, calendrier)
function debutJournee(niveau, res){
  const E = CONFIG.exploitation, ex = res.exploitation, rem = remonteesEnService(niveau, res).filter(ts => !enPanne(res, ts.nom));
  const pistes = pistesOuvertes(niveau, res, rem);
  const jour = { jour: ex.jour, saison: ex.saison, temps: 0, attenteSomme: 0, duree: 0, attente: 0, pannesPrevues: [],
    remontees: rem.map(ts => ts.nom), pistes: pistes.map(p => p.nom), clients: 0, ferme: !pistes.length };
  ex.phase = 'jour';
  if(jour.ferme) return jour;
  jour.clients = clientsAttendus(niveau, res, pistes);
  // Pannes des remontées pendant la journée (au hasard)
  const r = alea(niveau.terrain.graine * 977 + res.nuit * 131 + ex.saison * 17);
  for(const ts of rem) if(r() < E.panneRemontee) jour.pannesPrevues.push({ t: E.dureeJour * (0.15 + 0.65 * r()), nom: ts.nom });
  jour.secours = planifierSecours(niveau, res, pistes, jour.clients);
  return jour;
}
// --- Commerces du front de neige ---
const rayonCommerce = c => Math.hypot(...COMMERCES[c.type].taille) / 2;
// Un commerce se débloque à un jour de la 1re saison (ou à une saison) ; il reste débloqué ensuite
function commerceDisponible(res, type){
  const C = COMMERCES[type], ex = res.exploitation, s = C.saison || 1;
  return ex.saison > s || (ex.saison === s && ex.jour >= (C.jour || 1));
}
const commerceConstruit = (res, type) => (res.commerces || []).some(c => c.type === type);
// Où poser un commerce : sur le front de neige (plat), pas sur une piste, une remontée, un bâtiment ou un autre commerce
function validerCommerce(niveau, res, type, x, z){
  const C = COMMERCES[type], t = niveau.terrain, r = Math.hypot(...C.taille) / 2;
  if(!C) return { ok: false, raison: 'Commerce inconnu.' };
  if(commerceConstruit(res, type)) return { ok: false, raison: `${C.nom} : la station en a déjà un.` };
  if(!commerceDisponible(res, type)) return { ok: false, raison: `${C.nom} : pas encore disponible.` };
  if(!dansZoneJeu(t, x - Math.sign(x) * r, z - Math.sign(z) * r) || !dansZoneJeu(t, x, z)) return { ok: false, raison: 'Le commerce doit être dans la station.' };
  const hs = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => altitudeNaturelle(t, x + dx, z + dz));
  if(Math.max(...hs) - Math.min(...hs) > 2.5 || (t.station && z < t.station.front - 5)) return { ok: false, raison: 'Les commerces se posent sur le front de neige, là où c\'est plat (en bas des pistes).' };
  for(const p of niveau.pistes) if(distancePiste(p, x, z) < p.largeur / 2 + r + 2) return { ok: false, raison: `Trop près de la piste ${p.nom} : les skieurs arrivent par là.` };
  for(const ts of niveau.remontees || []){
    if(distanceTelesiege(ts, x, z) < r + 5 || Math.hypot(ts.aval.x - x, ts.aval.z - z) < r + 30) return { ok: false, raison: `Trop près du ${ts.nom} (sa ligne ou la file d'attente).` };
  }
  const batiments = [niveau.retenue && { ...niveau.retenue, r: niveau.retenue.rayon }, niveau.pompage && { ...niveau.pompage, r: niveau.pompage.rayon }, niveau.garage && { ...niveau.garage, r: niveau.garage.rayon }]
    .filter(Boolean).concat((niveau.departsElec || []).map(d => ({ ...d, r: 3 })), (res.commerces || []).map(c => ({ x: c.x, z: c.z, r: rayonCommerce(c) + 3 })));
  if(batiments.some(b => Math.hypot(b.x - x, b.z - z) < b.r + r + 2)) return { ok: false, raison: 'Trop près d\'un autre bâtiment.' };
  if((res.noeuds || []).some(n => n.type === 'regard' && Math.hypot(n.x - x, n.z - z) < r + 3)) return { ok: false, raison: 'Trop près d\'un regard.' };
  return { ok: true, cout: C.prix, rayon: r };
}
function ajouterCommerce(niveau, res, type, x, z){
  const v = validerCommerce(niveau, res, type, x, z);
  if(!v.ok) return v;
  if(res.budget < v.cout) return { ok: false, raison: 'Budget insuffisant.' };
  res.commerces = res.commerces || [];
  const id = Math.max(0, ...res.commerces.map(c => c.id)) + 1;
  res.commerces.push({ id, type, x: Math.round(x), z: Math.round(z), saison: res.exploitation.saison, jour: res.exploitation.jour });
  res.budget -= v.cout;
  return { ...v, id, nom: COMMERCES[type].nom };
}
// Vendre un commerce : on récupère la moitié de son prix
function vendreCommerce(res, id){
  const c = (res.commerces || []).find(q => q.id === id);
  if(!c) return { ok: false, raison: 'Commerce introuvable.' };
  const rendu = Math.round(COMMERCES[c.type].prix * CONFIG.couts.revente);
  res.commerces.splice(res.commerces.indexOf(c), 1);
  res.budget += rendu;
  return { ok: true, rendu, nom: COMMERCES[c.type].nom };
}
// Effets des commerces construits (part de skieurs en plus, blessés en plus sur les pistes faciles)
function effetCommerces(res, cle, base = 0){
  return (res.commerces || []).reduce((s, c) => s + ((COMMERCES[c.type].effets || {})[cle] || 0), base);
}
// Hôtel : chambres remplies selon la réputation (moitié moins les jours où la station est fermée)
function occupationHotel(res, ferme){ return borne(0.25 + 0.6 * res.exploitation.reputation, 0.2, 0.95) * (ferme ? 0.5 : 1); }
// Recettes et charges de chaque commerce pour la journée
function recettesCommerces(niveau, res, jour, sat){
  const pistes = niveau.pistes.filter(p => (jour.pistes || []).includes(p.nom)), parPiste = repartitionClients(pistes, jour.clients);
  const debutants = pistes.reduce((s, p, i) => s + (p.couleur === 'verte' || p.couleur === 'bleue' ? parPiste[i] : 0), 0);
  const detail = (res.commerces || []).map(c => {
    const C = COMMERCES[c.type];
    let recette = 0;
    if(C.chambres) recette = C.chambres * C.prixChambre * occupationHotel(res, jour.ferme);
    else if(!jour.ferme) recette = (C.debutants ? debutants : jour.clients) * C.clientele * C.panier * (0.6 + 0.4 * sat);
    return { id: c.id, type: c.type, nom: C.nom, recette: Math.round(recette), charges: C.charges };
  });
  const recette = detail.reduce((s, d) => s + d.recette, 0), charges = detail.reduce((s, d) => s + d.charges, 0);
  return { detail, recette, charges, net: recette - charges };
}

// --- Secours sur piste ---
// Point au hasard sur une piste (f de 0 à 1 le long du tracé, d de −1 à 1 en travers)
function pointSurPiste(piste, f, d){
  const c = courbePiste(piste);
  let reste = f * longueurLigne(c);
  for(let i = 1; i < c.length; i++){
    const a = c[i - 1], b = c[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if(reste <= l || i === c.length - 1){
      const k = l ? Math.min(1, reste / l) : 0, nx = l ? -(b[1] - a[1]) / l : 0, nz = l ? (b[0] - a[0]) / l : 0, w = d * piste.largeur * 0.35;
      return { x: a[0] + k * (b[0] - a[0]) + nx * w, z: a[1] + k * (b[1] - a[1]) + nz * w };
    }
    reste -= l;
  }
  return { x: c[0][0], z: c[0][1] };
}
// Skieurs de chaque piste ouverte : les pistes faciles attirent plus de monde (les débutants)
function repartitionClients(pistes, clients){
  const S = CONFIG.exploitation.secours, poids = pistes.map(p => S.part[p.couleur] || 1), tot = poids.reduce((s, x) => s + x, 0) || 1;
  return pistes.map((p, i) => clients * poids[i] / tot);
}
// Blessés de la journée (au hasard, toujours les mêmes pour une même journée) : plus nombreux sur les pistes faciles
function planifierSecours(niveau, res, pistes, clients){
  const S = CONFIG.exploitation.secours, E = CONFIG.exploitation, ex = res.exploitation;
  const r = alea(niveau.terrain.graine * 389 + res.nuit * 2731 + ex.saison * 53), liste = [];
  const parPiste = repartitionClients(pistes, clients);
  pistes.forEach((p, i) => {
    const facile = p.couleur === 'verte' || p.couleur === 'bleue';
    const attendu = parPiste[i] / 1000 * (S.taux[p.couleur] || 4) * (facile ? Math.max(1, (res.commerces || []).reduce((f, c) => f * ((COMMERCES[c.type].effets || {}).blesses || 1), 1)) : 1);
    const n = Math.floor(attendu) + (r() < attendu % 1 ? 1 : 0);
    for(let k = 0; k < n; k++){
      const pt = pointSurPiste(p, 0.08 + 0.84 * r(), r() * 2 - 1);
      liste.push({ id: 0, t: E.dureeJour * (0.04 + 0.86 * r()), piste: p.nom, couleur: p.couleur, x: pt.x, z: pt.z,
        prix: S.prix[p.couleur] || 300, duree: S.duree[p.couleur] || 25, etat: 'prevu', debut: null, fin: null });
    }
  });
  liste.sort((a, b) => a.t - b.t).forEach((s, i) => s.id = i + 1);
  return liste;
}
// Les blessés apparaissent ; un pisteur libre part secourir le plus ancien ; le secours est facturé à la fin
function avancerSecours(res, jour){
  const blesses = [], secourus = [], liste = jour.secours || [];
  for(const s of liste) if(s.etat === 'prevu' && s.t <= jour.temps){ s.etat = 'attente'; blesses.push(s); }
  for(const s of liste) if(s.etat === 'encours' && s.fin <= jour.temps){ s.etat = 'fini'; secourus.push(s); }
  let libres = (res.personnel ? res.personnel.pisteur : 0) - liste.filter(s => s.etat === 'encours').length;
  for(const s of liste){
    if(libres <= 0) break;
    if(s.etat !== 'attente') continue;
    s.etat = 'encours'; s.debut = jour.temps; s.fin = jour.temps + s.duree; libres--;
  }
  return { blesses, secourus };
}
// Résumé des secours d'une journée (à la fermeture, les secours en cours se terminent ; les blessés oubliés partent en hélicoptère, non facturés)
function bilanSecours(jour){
  const S = CONFIG.exploitation.secours, liste = (jour.secours || []).filter(s => s.etat !== 'prevu');
  const faits = liste.filter(s => s.etat === 'fini' || s.etat === 'encours');
  const rapides = faits.filter(s => s.debut - s.t <= S.attenteMax).length;
  const parCouleur = {};
  for(const s of faits){ const c = parCouleur[s.couleur] || (parCouleur[s.couleur] = { nombre: 0, recette: 0 }); c.nombre++; c.recette += s.prix; }
  return { blesses: liste.length, secourus: faits.length, recette: faits.reduce((t, s) => t + s.prix, 0), rapides,
    helico: liste.length - faits.length, parCouleur };
}
// La journée avance : attente aux remontées selon les clients et les remontées qui tournent ; pannes
function avancerJournee(niveau, res, jour, dt){
  const E = CONFIG.exploitation, tAvant = jour.temps;
  jour.temps = Math.min(E.dureeJour, jour.temps + dt);
  const nouvelles = [];
  for(const e of jour.pannesPrevues.filter(e => e.t > tAvant && e.t <= jour.temps)){
    if(enPanne(res, e.nom)) continue;
    const ts = niveau.remontees.find(q => q.nom === e.nom), p = declencherPanne(res, 'remontee', e.nom, e.t);
    p.x = (ts.aval.x + ts.amont.x) / 2; p.z = (ts.aval.z + ts.amont.z) / 2;
    nouvelles.push(p);
  }
  const finies = avancerPannes(res, jour.temps);
  const sec = avancerSecours(res, jour);
  const actives = jour.remontees.filter(nom => !enPanne(res, nom));
  const debit = actives.reduce((s, nom) => s + typeRemontee(niveau.remontees.find(q => q.nom === nom)).debit, 0);
  const ratio = jour.clients * E.tours / E.heuresOuverture / Math.max(1, debit);
  jour.attente = actives.length ? 3 + Math.max(0, ratio - 0.6) * 35 : 60;
  jour.attenteSomme += jour.attente * (jour.temps - tAvant); jour.duree += jour.temps - tAvant;
  jour.remonteesActives = actives;
  return { nouvelles, finies, blesses: sec.blesses, secourus: sec.secourus, fini: jour.temps >= E.dureeJour };
}
// Fin de journée : satisfaction, recettes, salaires, usure des pistes, réputation ; fin de saison au dernier jour
function finJournee(niveau, res, jour){
  const E = CONFIG.exploitation, ex = res.exploitation, P = res.personnel, ideal = idealSaison(res);
  const pistes = niveau.pistes.filter(p => jour.pistes.includes(p.nom)), n = pistes.length;
  const attente = jour.duree ? jour.attenteSomme / jour.duree : jour.attente;
  const d = { neige: 0, damage: 0, choix: 0, attente: 0, prix: 0, securite: 0, accueil: 0 };
  let sat = 0;
  const sec = bilanSecours(jour);
  if(n){
    d.neige = pistes.reduce((s, p) => s + Math.min(1, res.enneigement[p.nom] / ideal), 0) / n;
    d.damage = res.damageQualite ?? 1;
    d.choix = 0.6 * Math.min(1, n / 4) + 0.4 * Math.min(1, new Set(pistes.map(p => p.couleur)).size / 3);
    d.attente = borne(1 - (attente - 4) / 30, 0, 1);
    d.prix = borne(1 - (res.prixForfait - 0.8 * E.prixReference) / (0.9 * E.prixReference), 0, 1);
    d.securite = 0.4 * Math.min(1, P.pisteur / n) + 0.6 * (sec.blesses ? sec.rapides / sec.blesses : 1);
    const services = (res.commerces || []).filter(c => !COMMERCES[c.type].chambres).length;
    d.accueil = 0.5 * Math.min(1, P.caissier * E.clientsParCaissier / Math.max(1, jour.clients)) + 0.5 * Math.min(1, services / COMMERCES_SERVICES);
    sat = 0.25 * d.neige + 0.15 * d.damage + 0.15 * d.choix + 0.2 * d.attente + 0.15 * d.prix + 0.05 * d.securite + 0.05 * d.accueil;
  }
  const forfaits = Math.round(jour.clients * res.prixForfait), com = recettesCommerces(niveau, res, jour, sat);
  const salaires = Object.entries(P).reduce((s, [k, nb]) => s + nb * METIERS[k].salaire, 0);
  const net = forfaits + com.net + sec.recette - salaires;
  res.budget += net;
  for(const p of pistes) res.enneigement[p.nom] = Math.max(0, res.enneigement[p.nom] - E.usure - E.usureClients * jour.clients / 1000 / n);
  ex.reputation = n ? 0.75 * ex.reputation + 0.25 * Math.min(1.2, sat * 1.2) : ex.reputation * 0.95;
  if(res.pannes) res.pannes = res.pannes.filter(p => p.etat !== 'reparation');      // les réparations commencées se terminent
  const bilan = { jour: ex.jour, saison: ex.saison, clients: jour.clients, satisfaction: sat, details: d, attente, pistes: n, totalPistes: niveau.pistes.length,
    forfaits, commerces: com, secours: sec, salaires, net, ferme: jour.ferme };
  ex.jours.push({ clients: jour.clients, satisfaction: sat, net: bilan.net, ferme: jour.ferme, secours: sec.recette, blesses: sec.blesses, commerces: com.net });
  ex.dernier = bilan;
  ex.jour++;
  ex.phase = 'soir';
  if(ex.jour > E.joursSaison) bilan.saison = finSaison(niveau, res);
  return bilan;
}
// Satisfaction de la saison : moyenne des journées, pondérée par le nombre de clients (les jours fermés comptent pour 0)
function satisfactionSaison(res){
  const j = res.exploitation.jours;
  if(!j.length) return null;
  const clients = j.reduce((s, x) => s + x.clients, 0), fermes = j.filter(x => x.ferme).length;
  const moy = clients ? j.reduce((s, x) => s + x.satisfaction * x.clients, 0) / clients : 0;
  return moy * (1 - fermes / j.length * 0.5);
}
function finSaison(niveau, res){
  const ex = res.exploitation, E = CONFIG.exploitation;
  const s = { saison: ex.saison, satisfaction: satisfactionSaison(res), clients: ex.jours.reduce((t, x) => t + x.clients, 0),
    resultat: Math.round(res.budget - ex.debutBudget), joursFermes: ex.jours.filter(x => x.ferme).length };
  ex.saisons.push(s);
  // L'été passe : la neige fond, la retenue se remplit ; la saison suivante, plus de clients, plus exigeants
  ex.saison++; ex.jour = 1; ex.jours = []; ex.debutBudget = res.budget;
  res.tas = [];
  for(const p of niveau.pistes) res.enneigement[p.nom] = E.enneigementDepart;
  if(res.retenue) res.retenue.volume = volumeRetenue(niveau.retenue);
  return s;
}
// Administration
function changerPersonnel(res, metier, delta){ res.personnel[metier] = Math.max(0, Math.min(30, res.personnel[metier] + delta)); return res.personnel[metier]; }
function fixerPrix(res, prix){ const E = CONFIG.exploitation; res.prixForfait = Math.round(borne(prix, E.prixMin, E.prixMax)); return res.prixForfait; }
function acheterCarburant(res, litres){
  const C = CONFIG.exploitation.carburant, place = C.cuve - res.carburant.stock;
  const l = Math.max(0, Math.min(litres, place, Math.floor(res.budget / C.prix)));
  if(!l) return { ok: false, raison: place <= 0 ? 'La cuve est pleine.' : 'Budget insuffisant.' };
  res.carburant.stock += l; res.budget -= Math.round(l * C.prix);
  return { ok: true, litres: l, cout: Math.round(l * C.prix) };
}
// Personnel conseillé pour la station telle qu'elle est
function besoinsPersonnel(niveau, res){
  const E = CONFIG.exploitation, ts = (niveau.remontees || []).filter(q => remonteeEnMarche(res, q)).reduce((s, q) => s + typeRemontee(q).agents, 0);
  const canons = res.noeuds.filter(n => n.type === 'regard').length, pistes = niveau.pistes.length;
  return { nivoculteur: Math.max(1, Math.ceil(canons / E.nivoculteurCanons)), conducteur: 1, agent: ts,
    pisteur: pistes + 1, technicien: 1, caissier: 2 };
}

// --- Carrière ---
// Où en est l'étape : neige sur les pistes, recettes nettes et nuits jouées depuis son début
function avancementEtape(res){
  const c = res.carriere || { debutNeige: 0, debutRecettes: 0, debutNuit: 1 };
  return { neige: res.neigePiste - c.debutNeige, recette: (res.recettes || 0) - c.debutRecettes, nuits: res.nuit - c.debutNuit };
}
// Ajoute au réseau ce que l'étape a débloqué (départs électriques, compresseur), sans rien enlever
function etendreReseau(niveau, res){
  niveau.departsElec.forEach((d, i) => {
    if(!noeudReseau(res, `elec${i + 1}`)) res.noeuds.push({ id: `elec${i + 1}`, type: 'elec', nom: d.nom, x: d.x, z: d.z });
  });
  if(niveau.compresseur && !noeudReseau(res, 'compresseur')){
    res.noeuds.push({ id: 'compresseur', type: 'compresseur', nom: niveau.compresseur.nom, x: niveau.compresseur.sortie.x, z: niveau.compresseur.sortie.z });
    res.compresseur = { marche: false, pression: 0 };
  }
  res.pannes = res.pannes || [];
  return res;
}
// Début d'une étape : on note d'où l'on part (pour compter l'objectif et pouvoir recommencer l'étape)
function commencerEtape(niveau, res, etape){
  etendreReseau(niveau, res);
  if(niveau.prime) res.budget += niveau.prime;
  if(niveau.retenueDebut !== null && niveau.retenueDebut !== undefined && res.retenue)
    res.retenue.volume = volumeRetenue(niveau.retenue) * niveau.retenueDebut ** 2;
  if(res.retenue && niveau.remplissageMax) res.retenue.remplissage = Math.min(res.retenue.remplissage ?? CONFIG.retenue.remplissageJour, niveau.remplissageMax);
  res.historique = [];
  res.carriere = { etape, debutNeige: res.neigePiste, debutRecettes: res.recettes || 0, debutNuit: res.nuit, depart: null };
  const copie = JSON.parse(JSON.stringify(res));
  res.carriere.depart = copie;
  return res;
}
// Recommencer l'étape : le réseau, l'argent et la neige reviennent comme au début de l'étape
function recommencerEtape(res){
  const depart = res.carriere && res.carriere.depart;
  if(!depart) return res;
  const r = JSON.parse(JSON.stringify(depart));
  r.carriere.depart = depart;
  return r;
}

// Réseau déjà construit (niveau 1) : regards, conduites et câbles posés d'avance, gratuitement
function construireReseauFixe(niveau, res){
  const f = niveau.reseauFixe;
  if(!f) return res;
  const budget = res.budget;
  res.budget = Infinity;
  const ids = f.regards.map(r => {
    const p = poserRegard(niveau, res, r.x, r.z, { modele: r.modele, support: r.support }, 0, true);
    if(!p.ok) throw new Error(`Réseau fixe : ${p.raison}`);
    return p.id;
  });
  // Liaisons : pour chaque réseau, des chaînes « source → regard → regard… » (Rn = n-ième regard de la liste).
  // Sans liaisons : eau depuis la salle de pompage et câble depuis le 1er départ électrique, dans l'ordre des regards.
  const liaisons = f.liaisons || { eau: [['pompage', ...ids]], cable: [['elec1', ...ids]] };
  for(const [quoi, chaines] of Object.entries(liaisons)) for(const ch of chaines)
    for(let i = 1; i < ch.length; i++){
      const d = ajouterTranchee(niveau, res, ch[i - 1], ch[i], quoi, 0);
      if(!d.ok) throw new Error(`Réseau fixe (${quoi} ${ch[i - 1]} → ${ch[i]}) : ${d.raison}`);
    }
  res.budget = budget;
  res.historique = [];
  return res;
}

// --- Vérifications de la simulation (mode test : index.html?test) ---
function testsSimulation(){
  const res = [];
  const verifier = (nom, ok, detail = '') => res.push({ nom, ok: !!ok, detail });
  const proche = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
  const m = v => `${Math.round(v)} m`;
  const cfgP = { pompes: 60, perteLongueur: 0.6, perteDenivele: 1.2, perteDebit: 0.05, zones: { correcte: 50, surpression: 55 } };

  const p1 = pressionRegard({ pPompes: 60, longueur: 500, denivele: 100, debit: 40 }, cfgP);
  verifier('Pression : 60 bar, 500 m de conduite, 100 m de montée, 40 m³/h → 43 bar', proche(p1, 43), `obtenu ${p1.toFixed(2)} bar`);
  const haut = pressionRegard({ pPompes: 60, longueur: 300, denivele: 120, debit: 0 }, cfgP);
  const bas = pressionRegard({ pPompes: 60, longueur: 300, denivele: 40, debit: 0 }, cfgP);
  verifier('Pression : un regard plus haut a moins de pression', haut < bas, `${haut.toFixed(1)} bar en haut, ${bas.toFixed(1)} bar plus bas`);
  const loin = pressionRegard({ pPompes: 60, longueur: 900, denivele: 50, debit: 0 }, cfgP);
  const pres = pressionRegard({ pPompes: 60, longueur: 200, denivele: 50, debit: 0 }, cfgP);
  verifier('Pression : un regard plus loin a moins de pression', loin < pres, `${loin.toFixed(1)} bar loin, ${pres.toFixed(1)} bar près`);
  const descente = pressionRegard({ pPompes: 60, longueur: 200, denivele: -30, debit: 0 }, cfgP);
  verifier('Pression : un regard plus bas que le pompage gagne de la pression', descente > 60, `${descente.toFixed(1)} bar`);
  const peu = pressionRegard({ pPompes: 60, longueur: 300, denivele: 50, debit: 10 }, cfgP);
  const beaucoup = pressionRegard({ pPompes: 60, longueur: 300, denivele: 50, debit: 120 }, cfgP);
  verifier('Pression : plus de canons ouverts = moins de pression', beaucoup < peu, `${beaucoup.toFixed(1)} bar contre ${peu.toFixed(1)} bar`);

  const V8 = CATALOGUE.v8, P6 = CATALOGUE.p6;
  const zones = [[5, 'arret'], [12, 'faible'], [30, 'correcte'], [52, 'haute'], [60, 'surpression']];
  verifier('Ventilateur V8 : 5 bar arrêt, 12 faible, 30 correcte, 52 haute, 60 surpression',
    zones.every(([p, z]) => zonePression(p, V8) === z), zones.map(([p]) => `${p} → ${zonePression(p, V8)}`).join(', '));
  verifier('À 15 bar, un ventilateur produit mais une perche (18 bar minimum) non', zonePression(15, V8) === 'faible' && zonePression(15, P6) === 'arret');
  verifier('Production : 100 % à bonne pression, 35 % à la pression minimale, 0 en dessous ou en surpression',
    facteurProduction(30, V8) === 1 && proche(facteurProduction(8, V8), 0.35) && facteurProduction(7, V8) === 0 && facteurProduction(60, V8) === 0);
  verifier('Prix : V8 sur trépied 10 000 €, V10 sur tour haute 35 000 €', prixEnneigeur('v8', 'trepied') === 10000 && prixEnneigeur('v10', 'tourHaute') === 35000);
  const cfgC = { trancheeEau: 750, trancheeCable: 550, trancheeCommune: 900 };
  const eau = coutTranchee(100, { eau: true }, cfgC), cable = coutTranchee(100, { cable: true }, cfgC), commune = coutTranchee(100, { eau: true, cable: true }, cfgC);
  verifier('Tranchée de 100 m : eau 75 000 €, câble 55 000 €, commune 90 000 €', eau === 75000 && cable === 55000 && commune === 90000, `${eau} / ${cable} / ${commune}`);
  verifier('La tranchée commune coûte moins cher que deux tranchées séparées', commune < eau + cable, `${commune} € contre ${eau + cable} €`);
  verifier('Gain : 150 m³ sur la piste → 3 000 €', gainNeige(150, { parM3Piste: 20 }) === 3000);

  const t = TERRAIN_COMBE;
  const aBas = altitude(t, 0, t.longueur / 2), aHaut = altitude(t, 0, -t.longueur / 2);
  verifier('Terrain : le haut de la pente est plus haut que le bas', aHaut > aBas, `bas ${m(aBas)}, haut ${m(aHaut)}`);
  verifier('Terrain : environ 150 m de dénivelé', Math.abs(aHaut - aBas - t.denivele) < 15, m(aHaut - aBas));
  verifier('Terrain : la même position donne toujours la même altitude', altitude(t, 37.5, -12) === altitude(t, 37.5, -12));
  const cote = altitude(t, 140, 0), montagne = altitude(t, 700, 0);
  verifier('Décor : les montagnes montent autour de la zone de jeu', montagne > cote + 150, `bord ${m(cote)}, montagne ${m(montagne)}`);
  const vallee = altitude(t, 0, 750), flanc = altitude(t, 750, 750);
  verifier('Décor : en bas, la vallée reste dégagée', vallee < flanc - 150, `vallée ${m(vallee)}, flanc ${m(flanc)}`);

  const p = POMPAGE_COMBE, a1 = altitude(t, p.x - 6, p.z + 3), a2 = altitude(t, p.x + 6, p.z - 4);
  verifier('Replat : le sol est plat sous la salle de pompage', Math.abs(a1 - a2) < 0.05, `écart ${Math.abs(a1 - a2).toFixed(3)} m`);
  const R = RETENUE_COMBE, fond = altitude(t, R.x, R.z), bord = altitude(t, R.x + R.cuvette.rayon, R.z);
  verifier('Retenue : le fond du lac est plus bas que le bord', bord - fond > R.cuvette.profondeur * 0.9, `${(bord - fond).toFixed(1)} m de profondeur`);
  const plein = eauRetenue(t, R, 1), quart = eauRetenue(t, R, 0.25);
  verifier('Retenue : au quart, l\'eau est 75 % plus bas et le lac deux fois plus petit',
    proche(quart.rayon, R.cuvette.rayon / 2) && proche(plein.cote - quart.cote, R.cuvette.profondeur * 0.75), `rayon ${quart.rayon} m`);

  const piste = PISTE_CLARINES, [x0, z0] = piste.points[3];
  verifier('Piste : un point de la ligne du milieu est sur la piste', surPiste(piste, x0, z0));
  verifier('Piste : un point à 100 m est hors piste', !surPiste(piste, x0 + 100, z0));
  const lPiste = longueurLigne(courbePiste(piste));
  verifier('Piste : longueur raisonnable (entre 500 et 700 m)', lPiste > 500 && lPiste < 700, m(lPiste));
  verifier('Longueur d\'une ligne : 3-4-5 → 5 m', proche(longueurLigne([[0, 0], [3, 4]]), 5));

  const ts = TELESIEGE_CLARINES, pyl = pylonesTelesiege(ts), lt = longueurTelesiege(ts);
  const premier = Math.hypot(pyl[0].x - ts.aval.x, pyl[0].z - ts.aval.z);
  verifier('Télésiège : 8 pylônes régulièrement espacés', pyl.length === 8 && proche(premier, lt / 9, 1e-6), `${m(lt)} de ligne, un pylône tous les ${m(premier)}`);
  verifier('Télésiège : à l\'écart de la piste', pyl.every(q => !surPiste(piste, q.x, q.z)));

  // Construction du réseau
  const niv = LEVELS[1], rs = creerReseau(niv), pomp = noeudReseau(rs, 'pompage');
  rs.budget = 2000000;                                 // budget large pour tester tout le réseau
  const b0 = rs.budget;
  const g1 = poserRegard(niv, rs, -40, 120), g2 = poserRegard(niv, rs, -30, 60);
  verifier('Construction : deux regards avec un V8 sur trépied coûtent 2 × 15 000 €', g1.ok && g2.ok && b0 - rs.budget === 30000, `budget ${rs.budget} €`);
  verifier('Construction : refus d\'un regard trop près d\'un autre', !poserRegard(niv, rs, -35, 117).ok);
  verifier('Construction : refus d\'un regard dans la retenue', !poserRegard(niv, rs, RETENUE_COMBE.x, RETENUE_COMBE.z).ok);
  verifier('Eau : impossible de partir d\'un regard pas encore alimenté', !devisTranchee(niv, rs, g2.id, g1.id, 'eau').ok);
  verifier('Eau : impossible de partir d\'un départ électrique', !devisTranchee(niv, rs, 'elec1', g1.id, 'eau').ok);
  const e1 = ajouterTranchee(niv, rs, 'pompage', g1.id, 'eau');
  verifier('Eau : la salle de pompage alimente le regard 1, au prix de la tranchée eau seule',
    e1.ok && alimentes(rs, 'eau').has(g1.id) && e1.cout === Math.round(e1.longueur * 750), `${m(e1.longueur)}, ${e1.cout} €`);
  ajouterTranchee(niv, rs, g1.id, g2.id, 'eau');
  const s2 = etatRegard(niv, rs, g2.id);
  verifier('Regard 2 : de l\'eau mais pas d\'électricité → « il manque l\'électricité »', s2.eau && !s2.elec && s2.manque === 'l\'électricité');
  verifier('Électricité : impossible de partir d\'un regard pas encore alimenté', !devisTranchee(niv, rs, g1.id, g2.id, 'cable').ok);
  ajouterTranchee(niv, rs, 'elec1', g1.id, 'cable');
  const c2 = ajouterTranchee(niv, rs, g1.id, g2.id, 'cable');
  verifier('Tranchée commune : le câble dans une tranchée déjà creusée ne coûte que la différence (900 − 750 = 150 €/m)',
    c2.ok && c2.commune && c2.parMetre === 150 && c2.cout === Math.round(c2.longueur * 150), `${c2.cout} €`);
  const s2b = etatRegard(niv, rs, g2.id), L2 = longueursEau(rs).get(g2.id);
  verifier('Regard 2 prêt : eau et électricité raccordées', s2b.pret);
  verifier('Pression au regard 2 : formule avec la longueur de conduite depuis le pompage', proche(s2b.pression,
    pressionRegard({ pPompes: CONFIG.pression.pompes, longueur: L2, denivele: altitude(t, -30, 60) - altitude(t, pomp.x, pomp.z), debit: 0 })), `${s2b.pression.toFixed(1)} bar, ${m(L2)} de conduite`);
  const g3 = poserRegard(niv, rs, -130, 95);
  verifier('Tranchée : impossible de traverser la retenue', g3.ok && !devisTranchee(niv, rs, 'pompage', g3.id, 'eau').ok);
  while(annulerAction(rs).ok);
  verifier('Annuler : tout est remboursé et le réseau revient à zéro', rs.budget === b0 && rs.noeuds.length === 1 + niv.departsElec.length && !rs.tranchees.length, `budget ${rs.budget} €`);
  // Catalogue : déblocages et remplacement
  verifier('Catalogue : le V9 n\'est pas encore disponible, les perches attendent le niveau 3',
    !disponible(niv, rs, 'v9').ok && !disponible(niv, rs, 'p6').ok && disponible(niv, rs, 'v8').ok);
  rs.neigePiste = 5000;
  verifier('Catalogue : le V9 se débloque après 5 000 m³ sur les pistes', disponible(niv, rs, 'v9').ok && !disponible(niv, rs, 'v10').ok);
  rs.neigePiste = 0;
  const rg = poserRegard(niv, rs, 40, -100), bAvant = rs.budget, ch = changerEnneigeur(niv, rs, rg.id, 'v8', 'tour');
  verifier('Remplacer un V8 sur trépied par un V8 sur tour : 14 000 € moins la reprise de 5 000 €', ch.ok && bAvant - rs.budget === 9000, `${bAvant - rs.budget} €`);
  annulerAction(rs);
  verifier('Annuler le remplacement : le trépied revient et l\'argent aussi', noeudReseau(rs, rg.id).support === 'trepied' && rs.budget === bAvant);
  while(annulerAction(rs).ok);

  // Vent et point de chute
  const nc = { x: 0, z: 0, modele: 'v8', support: 'trepied', direction: 0, inclinaison: 20 };
  const calme = pointChute(nc, { force: 0, direction: 0 }), venteux = pointChute(nc, { force: 30, direction: 90 });
  verifier('Sans vent, la neige tombe droit devant le canon', proche(calme.x, 0) && calme.z > 15, `${calme.z.toFixed(1)} m devant`);
  verifier('Un vent de 30 km/h vers la droite déporte la neige vers la droite', venteux.x > 5, `déportée de ${venteux.x.toFixed(1)} m`);
  const tourH = pointChute({ ...nc, support: 'tourHaute' }, { force: 30, direction: 90 });
  verifier('Sur une tour haute, la neige va plus loin mais le vent la déporte davantage', tourH.z > venteux.z && tourH.x > venteux.x, `${tourH.x.toFixed(1)} m contre ${venteux.x.toFixed(1)} m`);
  verifier('Neige sur la piste : 100 % au milieu de la piste, 0 % loin de la piste',
    partSurPiste(niv.pistes, x0, z0, 6) === 1 && partSurPiste(niv.pistes, x0 + 120, z0, 6) === 0);

  // Une nuit avec deux canons
  const rn = creerReseau(niv);
  rn.budget = 2000000;
  const n1 = poserRegard(niv, rn, -20, 150), n2 = poserRegard(niv, rn, -30, 90);
  for(const [a, b2] of [['pompage', n1.id], [n1.id, n2.id]]) ajouterTranchee(niv, rn, a, b2, 'eau');
  for(const [a, b2] of [['elec1', n1.id], [n1.id, n2.id]]) ajouterTranchee(niv, rn, a, b2, 'cable');
  const regime = debutNuit(niv, rn), unSeul = regimeNuit(niv, { ...rn, noeuds: rn.noeuds.filter(n => n.id !== n2.id) }, regime.vent);
  verifier('Nuit : les deux canons prêts produisent', regime.canons.length === 2 && regime.canons.every(c => c.production > 0),
    regime.canons.map(c => `${c.id} ${c.pression.toFixed(1)} bar`).join(', '));
  verifier('Plus de canons ouverts = moins de pression au regard 1',
    regime.canons.find(c => c.id === n1.id).pression < unSeul.canons.find(c => c.id === n1.id).pression);
  const budgetAvant = rn.budget, eauAvant = rn.retenue.volume;
  for(let k = 0; k < CONFIG.nuit.duree; k++) avancerNuit(niv, rn, regime, 1);
  const attendu = regime.canons.reduce((s, c) => s + c.production * 12, 0);           // m³/h × 12 h
  verifier(`Nuit de ${CONFIG.nuit.duree} s = 12 h : la neige produite correspond aux débits, en tas`, proche(rn.neigeTotale, attendu, 1e-6) && rn.tas.length >= 1, `${Math.round(rn.neigeTotale)} m³`);
  verifier('La retenue se vide pendant la nuit', rn.retenue.volume < eauAvant, `${Math.round(eauAvant - rn.retenue.volume)} m³ d'eau utilisés`);
  const bilan = finNuit(niv, rn);
  verifier('Fin de nuit : 20 € par m³ tombé sur la piste, moins l\'électricité des pompes et l\'eau de la journée',
    rn.budget - budgetAvant === Math.round(rn.neigePiste * 20) - bilan.electricite - bilan.remplissage.cout && bilan.electricite > 0 && rn.nuit === 2,
    `+${bilan.gain} €, électricité ${bilan.kwh} kWh = ${bilan.electricite} €`);
  verifier('Remplissage de la journée payé au m³', bilan.remplissage.m3 > 0 && bilan.remplissage.cout === Math.round(bilan.remplissage.m3 * CONFIG.retenue.prixM3),
    `${bilan.remplissage.m3} m³ pour ${bilan.remplissage.cout} €`);
  const vAvantArret = rn.retenue.volume, bAvantArret = rn.budget;
  rn.retenue.remplissage = 0;
  verifier('Remplissage arrêté : rien n\'est ajouté ni payé', !remplirRetenue(niv, rn).m3 && rn.retenue.volume === vAvantArret && rn.budget === bAvantArret);
  rn.retenue.remplissage = CONFIG.retenue.remplissageJour;
  rn.retenue.volume = 1;
  const r2n = debutNuit(niv, rn), fin = avancerNuit(niv, rn, r2n, 1), apres = regimeNuit(niv, rn, r2n.vent);
  verifier('Retenue vide : les pompes sont à sec, plus aucun canon ne produit', fin.vide && apres.sec && apres.canons.every(c => !c.production));

  // Poste de travail : pompes, vanne principale, arrêt d'un canon
  const rp = creerReseau(niv);
  rp.budget = 2000000;
  rp.neigePiste = 20000;                               // V10 débloqué
  const prets = [[-20, 150], [-30, 100], [-35, 50]].map(([x, z]) => poserRegard(niv, rp, x, z, { modele: 'v10', support: 'trepied' }).id);
  let precedent = 'pompage';
  for(const id of prets){ ajouterTranchee(niv, rp, precedent, id, 'eau'); precedent = id; }
  precedent = 'elec1';
  for(const id of prets){ ajouterTranchee(niv, rp, precedent, id, 'cable'); precedent = id; }
  const vCalme = { force: 0, direction: 0 }, auto = regimeNuit(niv, rp, vCalme);
  verifier('Pompes en automatique : 3 V10 (162 m³/h) font tourner 1 pompe', auto.pompes === 1 && auto.canons.every(c => c.production > 0), `${auto.pompes} pompe(s), ${auto.debit} m³/h`);
  commanderPompes(rp, 'manuel', [false, false, false]);
  verifier('Pompes en manuel, toutes arrêtées : aucun canon ne produit', regimeNuit(niv, rp, vCalme).canons.every(c => !c.production));
  commanderPompes(rp, 'auto');
  commanderVanne(rp, 0);
  verifier('Vanne principale fermée : plus d\'eau sur le réseau', regimeNuit(niv, rp, vCalme).canons.every(c => !c.production));
  commanderVanne(rp, 0.5);
  const mi = regimeNuit(niv, rp, vCalme);
  commanderVanne(rp, 1);
  verifier('Vanne principale à moitié : moins de pression au départ', mi.pressionDepart < auto.pressionDepart, `${mi.pressionDepart.toFixed(1)} bar contre ${auto.pressionDepart.toFixed(1)} bar`);
  commanderCanon(rp, prets[0], false);
  const sansUn = regimeNuit(niv, rp, vCalme);
  verifier('Arrêter un canon au poste de travail : il ne produit plus et les autres gagnent de la pression',
    !sansUn.canons.find(c => c.id === prets[0]).production && sansUn.canons.find(c => c.id === prets[1]).pression > auto.canons.find(c => c.id === prets[1]).pression);
  commanderCanon(rp, prets[0], true);
  commanderPompes(rp, 'manuel', [true, false, false]);
  for(const [x, z] of [[-10, 0], [-20, -50], [0, -100], [10, -150]]){ const id = poserRegard(niv, rp, x, z, { modele: 'v10' }).id; ajouterTranchee(niv, rp, precedent, id, 'eau'); ajouterTranchee(niv, rp, precedent, id, 'cable'); precedent = id; }
  const charge = regimeNuit(niv, rp, vCalme);
  verifier('Une seule pompe pour 7 V10 : surcharge, la pression chute', charge.surcharge && charge.pressionDepart < CONFIG.pression.pompes - 5, `${charge.pressionDepart.toFixed(1)} bar au départ`);

  // Niveau 1 : la salle de pompage
  const niv1 = LEVELS[0], r1n = construireReseauFixe(niv1, creerReseau(niv1)), regards1 = r1n.noeuds.filter(n => n.type === 'regard');
  verifier('Niveau 1 : six V10 déjà raccordés, rien à payer, rien à annuler',
    regards1.length === 6 && regards1.every(n => etatRegard(niv1, r1n, n.id).pret) && r1n.budget === 0 && !r1n.historique.length);
  verifier('Courbe de pompe : 62 bar sans débit, 52 bar au débit nominal (180 m³/h)', proche(pressionPompes(0, 1), 62) && proche(pressionPompes(180, 1), 52));
  const g0 = debutNuit(niv1, r1n);
  verifier('Niveau 1 : la nuit démarre pompes arrêtées, vanne fermée, canons fermés', !r1n.pompage.marche.some(Boolean) && r1n.pompage.ouverture === 0 && g0.canons.every(c => c.arrete));
  const ev = evenementsProgramme(niv1, r1n, -1, 40);
  verifier('Programme : entre 0 et 40 s, le chef d\'équipe ouvre les regards 1 à 4', ev.length === 4 && ev.every(e => e.ouvert));
  evenementsProgramme(niv1, r1n, 40, 75);
  const vc = { force: 0, direction: 0 };
  verifier('Coup de bélier : démarrer la première pompe vanne grande ouverte', (r1n.pompage.ouverture = 1, commanderPompe(niv1, r1n, 0, true)).coup);
  commanderPompe(niv1, r1n, 0, false, false); r1n.pompage.ouverture = 0; r1n.coups = 0;
  verifier('Démarrer la pompe vanne fermée : pas de coup de bélier', !commanderPompe(niv1, r1n, 0, true).coup);
  verifier('Coup de bélier : ouvrir la vanne de 0 à 100 % d\'un coup', commanderVanne(r1n, 1, 10, niv1, true).coup);
  r1n.pompage.ouverture = 0; r1n.pompage.histo = [];
  let doux = false;
  for(let k = 1; k <= 10; k++) doux = doux || commanderVanne(r1n, k / 10, 20 + k * 0.5, niv1, true).coup;
  verifier('Ouvrir la vanne doucement (10 % toutes les demi-secondes) : pas de coup de bélier', !doux);
  r1n.pompage.marche = [true, true, true];
  for(const n of regards1) n.arret = !['R1', 'R2'].includes(n.id);
  const surp = regimeNuit(niv1, r1n, vc);
  verifier('Trois pompes et vanne grande ouverte pour 2 canons : surpression, les canons se mettent en sécurité',
    surp.pressionDepart > 55 && surp.canons.filter(c => !c.arrete).every(c => !c.production), `${surp.pressionDepart.toFixed(1)} bar au départ`);
  r1n.pompage.marche = [true, false, false]; r1n.pompage.ouverture = 0.6;
  const regle = regimeNuit(niv1, r1n, vc);
  verifier('Une pompe et la vanne à 60 % : pression dans le vert, les 2 canons produisent',
    regle.pressionDepart >= CONFIG.pompage.zoneVerte[0] && regle.pressionDepart <= CONFIG.pompage.zoneVerte[1] && regle.canons.filter(c => !c.arrete).every(c => c.production > 0), `${regle.pressionDepart.toFixed(1)} bar`);
  for(const n of regards1) n.arret = false;
  r1n.pompage.ouverture = 1;
  const une = regimeNuit(niv1, r1n, vc);
  r1n.pompage.marche = [true, true, false];
  const deux = regimeNuit(niv1, r1n, vc);
  verifier('Six V10 (324 m³/h) : avec une pompe, des canons s\'arrêtent ; avec deux, tous produisent et le départ est dans le vert',
    une.canons.some(c => !c.production) && deux.canons.every(c => c.production > 0)
      && deux.pressionDepart >= CONFIG.pompage.zoneVerte[0] && deux.pressionDepart <= CONFIG.pompage.zoneVerte[1],
    `${une.canons.filter(c => c.production).length} canons avec une pompe, ${deux.pressionDepart.toFixed(1)} bar avec deux`);
  r1n.coups = 3;
  verifier('Niveau 1 : au 3e coup de bélier, la conduite casse et le niveau est raté', !!resultatNiveau(niv1, r1n).rate);
  r1n.coups = 0; r1n.neigeTotale = 6000;
  verifier('Niveau 1 : 6 000 m³ produits sans casse = niveau réussi', resultatNiveau(niv1, r1n).reussi);

  // Niveau 3 : perches et air comprimé
  const niv3 = LEVELS[2], r3 = creerReseau(niv3);
  r3.budget = 2000000;
  r3.neigePiste = 10000;                               // perche nouvelle génération débloquée
  const pa = poserRegard(niv3, r3, -40, 110, { modele: 'p10' }), pb = poserRegard(niv3, r3, -70, 60, { modele: 'p10n' });
  verifier('Niveau 3 : les perches se posent', pa.ok && pb.ok, pa.raison || pb.raison || '');
  for(const [q, src] of [['eau', 'pompage'], ['cable', 'elec4']]){ ajouterTranchee(niv3, r3, src, pa.id, q); ajouterTranchee(niv3, r3, pa.id, pb.id, q); }
  const sansAir = etatRegard(niv3, r3, pa.id);
  verifier('Une perche avec eau et électricité mais sans air : « il manque l\'air comprimé »', !sansAir.pret && sansAir.manque === 'l\'air comprimé');
  verifier('Impossible de tirer l\'air depuis la salle de pompage', !devisTranchee(niv3, r3, 'pompage', pa.id, 'air').ok);
  const aSeul = devisTranchee(niv3, r3, 'compresseur', pa.id, 'air');
  ajouterTranchee(niv3, r3, 'compresseur', pa.id, 'air');
  const aCommun = devisTranchee(niv3, r3, pa.id, pb.id, 'air');
  verifier('Air : 650 €/m en tranchée seule, 200 €/m dans une tranchée déjà creusée', aSeul.parMetre === 650 && !aSeul.commune && aCommun.commune && aCommun.parMetre === 200, (aSeul.raison || '') + (aCommun.raison || ''));
  ajouterTranchee(niv3, r3, pa.id, pb.id, 'air');
  verifier('Avec l\'air, les deux perches sont prêtes', etatRegard(niv3, r3, pa.id).pret && etatRegard(niv3, r3, pb.id).pret);
  const n3g = debutNuit(niv3, r3);
  verifier('Compresseur arrêté au début de la nuit : réservoir vide, les perches ne produisent pas encore', n3g.air.marche && n3g.canons.every(c => !c.production), `réservoir ${r3.compresseur.pression} bar`);
  let gr = n3g;
  for(let k = 0; k < 40; k++){ avancerNuit(niv3, r3, gr, 0.25); gr = regimeNuit(niv3, r3, gr.vent); }
  verifier('Après le démarrage, la pression d\'air monte et les perches produisent', r3.compresseur.pression > CONFIG.air.pressionPleine && gr.canons.every(c => c.production > 0),
    `réservoir ${r3.compresseur.pression.toFixed(1)} bar`);
  verifier('La perche nouvelle génération consomme moins d\'air', CATALOGUE.p10n.air < CATALOGUE.p10.air && gr.air.demande === CATALOGUE.p10.air + CATALOGUE.p10n.air, `${gr.air.demande} Nm³/h`);
  verifier('Le compresseur consomme de l\'électricité', r3.kwhNuit > CONFIG.pompage.puissance * CONFIG.nuit.echelle / 3600 * 10 * 0.9, `${Math.round(r3.kwhNuit)} kWh en 10 s de jeu`);
  commanderPompes(r3, 'manuel', [true, false, false]); commanderCompresseur(r3, false);
  for(let k = 0; k < 40; k++){ gr = regimeNuit(niv3, r3, gr.vent); avancerNuit(niv3, r3, gr, 0.25); }
  verifier('En manuel, compresseur arrêté : la pression d\'air retombe et les perches s\'arrêtent',
    r3.compresseur.pression < CONFIG.air.pressionMin && regimeNuit(niv3, r3, gr.vent).canons.every(c => !c.production), `${r3.compresseur.pression.toFixed(1)} bar`);

  // Niveau 4 : pannes et réparations
  const niv4 = LEVELS.find(l => l.id === 'pannes'), r4 = construireReseauFixe(niv4, creerReseau(niv4));
  const regards4 = r4.noeuds.filter(n => n.type === 'regard');
  verifier('Niveau 4 : réseau déjà construit, 6 V10 et 4 perches prêts', regards4.length === 10 && regards4.every(n => etatRegard(niv4, r4, n.id).pret));
  debutNuit(niv4, r4);
  const prevues = r4.pannesPrevues.map(p => `${p.t.toFixed(2)}/${p.de1.toFixed(3)}`).join();
  r4.compresseur.pression = CONFIG.air.pressionNominale;
  const v4 = { force: 0, direction: 0 }, base4 = regimeNuit(niv4, r4, v4);
  verifier('Pannes : 1 à 3 par nuit, toujours les mêmes pour une même nuit',
    r4.pannesPrevues.length >= 1 && r4.pannesPrevues.length <= 3 && planifierPannes(niv4, r4).map(p => `${p.t.toFixed(2)}/${p.de1.toFixed(3)}`).join() === prevues, prevues);
  verifier('Sans panne, les 10 canons produisent', base4.canons.length === 10 && base4.canons.every(c => c.production > 0));
  const nbPrevues = r4.pannesPrevues.length, ev4 = evenementsPannes(niv4, r4, -1, CONFIG.nuit.duree, base4);
  verifier('Les pannes prévues arrivent pendant la nuit', ev4.length === nbPrevues && r4.pannes.length === nbPrevues && !r4.pannesPrevues.length,
    ev4.map(p => `${p.type} ${p.cible}`).join(', '));
  // Seul R1 tourne (les autres canons sont arrêtés au poste) : les pannes ne touchent que lui, ce qui l'alimente, ou une pompe en marche
  r4.pannes = [];
  for(const n of regards4) n.arret = n.id !== 'R1';
  const seulR1 = regimeNuit(niv4, r4, v4), permis = new Set(['moteur R1', `fuite ${cleTranchee('pompage', 'R1')}`, 'disjoncteur elec1',
    ...pompesEnMarche(r4, seulR1).map(i => `pompe ${i}`)]);
  r4.pannesPrevues = [0.05, 0.3, 0.55, 0.8, 0.99].map((d, k) => ({ t: 5 + k, de1: d, de2: 1 - d }));
  const evR1 = evenementsPannes(niv4, r4, 0, 20, seulR1);
  verifier('Une panne ne touche que ce qui fonctionne', evR1.length && evR1.every(p => permis.has(`${p.type} ${p.cible}`)), evR1.map(p => `${p.type} ${p.cible}`).join(', '));
  r4.pannesPrevues = [{ t: 30, de1: 0.5, de2: 0.5 }];
  for(const n of regards4) n.arret = true;
  verifier('Si rien ne tourne, pas de panne', !evenementsPannes(niv4, r4, 25, 35, regimeNuit(niv4, r4, v4)).length);
  for(const n of regards4) n.arret = false;
  r4.pannes = [];
  const mot = declencherPanne(r4, 'moteur', 'R2'), gMot = regimeNuit(niv4, r4, v4);
  verifier('Moteur grillé : ce canon ne produit plus, les autres oui', !gMot.canons.find(c => c.id === 'R2').production && gMot.canons.filter(c => c.id !== 'R2').every(c => c.production > 0));
  const b4 = r4.budget, rep4 = reparerPanne(niv4, r4, mot.id, true, 10);
  verifier('Réparation la nuit : payée tout de suite, l\'équipe met du temps', rep4.ok && r4.budget === b4 - CONFIG.pannes.types.moteur.cout && !avancerPannes(r4, 12).length && avancerPannes(r4, 10 + CONFIG.pannes.types.moteur.duree).length === 1 && !r4.pannes.length);
  declencherPanne(r4, 'gel', 'R8');
  const gGel = regimeNuit(niv4, r4, v4), p8 = c => c.canons.find(q => q.id === 'R8').production;
  verifier('Buse gelée : la perche fait moins de neige', proche(p8(gGel), p8(base4) * CONFIG.pannes.types.gel.facteur));
  r4.pannes = [];
  declencherPanne(r4, 'disjoncteur', 'elec4');
  const gDis = regimeNuit(niv4, r4, v4);
  verifier('Disjoncteur des Gentianes : les perches n\'ont plus de courant, les Clarines tournent',
    gDis.canons.length === 6 && gDis.canons.every(c => CATALOGUE[c.modele].type === 'ventilateur'));
  r4.pannes = [];
  const fuite = declencherPanne(r4, 'fuite', cleTranchee('R3', 'R4')), gFuite = regimeNuit(niv4, r4, v4);
  const pr = (g, id) => g.canons.find(c => c.id === id).pression;
  verifier('Fuite : de l\'eau perdue, la pression chute en aval (R4) bien plus qu\'en amont (R2)',
    gFuite.fuite === CONFIG.pannes.types.fuite.debit && pr(base4, 'R4') - pr(gFuite, 'R4') > pr(base4, 'R2') - pr(gFuite, 'R2') + 5,
    `R4 ${pr(base4, 'R4').toFixed(1)} → ${pr(gFuite, 'R4').toFixed(1)} bar, R2 ${pr(base4, 'R2').toFixed(1)} → ${pr(gFuite, 'R2').toFixed(1)} bar`);
  reparerPanne(niv4, r4, fuite.id, true, 0);
  const gIso = regimeNuit(niv4, r4, v4);
  verifier('Pendant la réparation de la fuite, la conduite est isolée : plus d\'eau en aval', !gIso.fuite && !gIso.canons.some(c => c.id === 'R4') && gIso.canons.some(c => c.id === 'R2'));
  r4.pannes = [];
  declencherPanne(r4, 'pompe', '0'); declencherPanne(r4, 'pompe', '1');
  const gPom = regimeNuit(niv4, r4, v4);
  verifier('Deux pompes en défaut : il n\'en reste qu\'une', gPom.pompes === 1 && gPom.pompesEnPanne.length === 2);
  const rj = reparerPanne(niv4, r4, r4.pannes[0].id, false);
  verifier('Le jour, la réparation est immédiate', rj.ok && rj.finie && r4.pannes.length === 1);
  r4.budget = 100;
  verifier('Sans assez d\'argent, pas de réparation', !reparerPanne(niv4, r4, r4.pannes[0].id, false).ok);

  const dir = directionVersPiste(niv.pistes, 70, 0);
  verifier('Un canon à droite de la piste souffle vers la gauche (vers la piste)', dir < -45 && dir > -135, `${dir}°`);

  // Modifier l'installation
  const nm = LEVELS.find(l => l.id === 'reseau'), rm = creerReseau(nm);
  const m1 = poserRegard(nm, rm, -20, 205, { modele: 'v8' }), m2 = poserRegard(nm, rm, -25, 170, { modele: 'v8' });
  for(const [q, src] of [['eau', 'pompage'], ['cable', 'elec1']]){ ajouterTranchee(nm, rm, src, m1.id, q); ajouterTranchee(nm, rm, m1.id, m2.id, q); }
  const bm = rm.budget, dm = devisDemontage(nm, rm, m1.id);
  verifier('Démonter un regard : la moitié du matériel rendue, et on prévient que le regard suivant perd l\'eau et le courant',
    dm.materiel === Math.round((CONFIG.couts.regard + CATALOGUE.v8.prix) * 0.5) && dm.coupes.some(c => c.id === m2.id && c.quoi === 'eau') && dm.coupes.some(c => c.id === m2.id && c.quoi === 'cable'));
  demonter(nm, rm, m1.id);
  verifier('Démonter : le regard et ses tranchées disparaissent, le budget remonte', !noeudReseau(rm, m1.id) && !rm.tranchees.some(tr => tr.a === m1.id || tr.b === m1.id) && rm.budget === bm + dm.rembourse);
  annulerAction(rm);
  verifier('Annuler un démontage remet tout et reprend l\'argent', !!noeudReseau(rm, m1.id) && etatRegard(nm, rm, m2.id).pret && rm.budget === bm);
  const cleM = cleTranchee(m1.id, m2.id), dr = retirerReseau(nm, rm, cleM, 'cable');
  verifier('Retirer le câble d\'une tranchée commune : l\'eau reste, le câble part, un quart rendu',
    dr.ok && trancheeParCle(rm, cleM).eau && !trancheeParCle(rm, cleM).cable && !etatRegard(nm, rm, m2.id).elec && dr.rembourse === Math.round(trancheeParCle(rm, cleM).longueur * CONFIG.couts.trancheeCable * 0.25));
  retirerReseau(nm, rm, cleM, 'eau');
  verifier('Tranchée vidée : elle disparaît', !trancheeParCle(rm, cleM));
  annulerAction(rm); annulerAction(rm);
  verifier('Annuler deux retraits remet la tranchée commune', trancheeParCle(rm, cleM).eau && trancheeParCle(rm, cleM).cable);
  const lAvant = trancheeParCle(rm, cleM).longueur, dd = deplacerRegard(nm, rm, m2.id, -25, 150);
  verifier('Déplacer un regard plus loin : les tranchées suivent et on paie les mètres en plus',
    dd.ok && noeudReseau(rm, m2.id).z === 150 && trancheeParCle(rm, cleM).longueur > lAvant && dd.cout > CONFIG.couts.deplacement && etatRegard(nm, rm, m2.id).pret);
  verifier('On ne déplace pas un regard dans la retenue', !devisDeplacement(nm, rm, m2.id, -112, 146).ok);
  annulerAction(rm);
  verifier('Annuler le déplacement remet le regard à sa place', noeudReseau(rm, m2.id).z === 170 && trancheeParCle(rm, cleM).longueur === lAvant);
  const dep = ajouterDepartElec(nm, rm, 60, 100), m3 = poserRegard(nm, rm, 60, 80, { modele: 'v8' });
  verifier('Nouveau départ électrique : il alimente un regard voisin', dep.ok && ajouterTranchee(nm, rm, dep.id, m3.id, 'cable').ok && etatRegard(nm, rm, m3.id).elec);
  verifier('On ne démonte pas un départ de la station, mais bien un départ ajouté', !devisDemontage(nm, rm, 'elec1').ok && devisDemontage(nm, rm, dep.id).ok);

  // Carrière
  const c0 = niveauCarriere(0), rc = commencerEtape(c0, creerReseau(c0), 0);
  verifier('Carrière, étape 1 : 150 000 €, une pompe, V8 sur trépied seulement',
    rc.budget === CARRIERE.budgetDepart && disponible(c0, rc, 'v8').ok && !disponible(c0, rc, 'v9').ok && !poserRegard(c0, rc, -20, 205, { modele: 'v8', support: 'tour' }).ok);
  const rc1 = poserRegard(c0, rc, -20, 205, { modele: 'v8', support: 'trepied' }), rc2 = poserRegard(c0, rc, -25, 175, { modele: 'v8', support: 'trepied' });
  for(const [q, src] of [['eau', 'pompage'], ['cable', 'elec1']]){ ajouterTranchee(c0, rc, src, rc1.id, q); ajouterTranchee(c0, rc, rc1.id, rc2.id, q); }
  rc.pompage.mode = 'manuel'; rc.pompage.marche = [true, true, true];
  verifier('Carrière : seules les pompes installées tournent', regimeNuit(c0, rc, { force: 0, direction: 0 }).pompes === 1);
  rc.pompage.mode = 'auto';
  const c7 = niveauCarriere(7);
  verifier('Carrière : le matériel débloqué s\'ajoute au fil des étapes',
    c7.pompes === 3 && c7.enneigeurs.includes('v10') && c7.enneigeurs.includes('p6') && !!c7.compresseur && c7.pistes.length === 2 && c7.departsElec.length === 4);
  rc.neigePiste += c0.objectif.m3; rc.recettes = c0.objectif.recette;
  verifier('Carrière : étape réussie quand la neige ET les recettes sont atteintes', resultatNiveau(c0, rc).reussi);
  rc.recettes = 0; rc.nuit += c0.objectif.nuits;
  verifier('Carrière : étape ratée si les nuits passent sans les recettes', !resultatNiveau(c0, rc).reussi && !!resultatNiveau(c0, rc).rate);
  const repris = recommencerEtape(rc);
  verifier('Carrière : recommencer l\'étape remet le réseau, l\'argent et la neige du début', repris.budget === CARRIERE.budgetDepart && repris.neigePiste === 0 && repris.nuit === 1 && !!repris.carriere.depart);
  const budgetAvant7 = rc.budget;
  commencerEtape(c7, rc, 7);
  verifier('Carrière : une nouvelle étape ajoute départs électriques, compresseur et prime',
    !!noeudReseau(rc, 'elec4') && !!noeudReseau(rc, 'compresseur') && !!rc.compresseur && rc.budget === budgetAvant7 + c7.prime && avancementEtape(rc).nuits === 0);

  // Bac à sable
  const bac = LEVELS.find(l => l.bac), rb = creerReseau(bac);
  const pisteOk = ajouterPisteBac(bac, rb, [[120, -200], [110, -100], [120, 0]], 30);
  verifier('Bac à sable : on trace une piste dans le domaine', pisteOk.ok && rb.pistesBac.length === 1, pisteOk.raison || `${Math.round(pisteOk.longueur)} m`);
  verifier('Bac à sable : une piste ne passe pas sur la retenue', !validerPiste(bac, [[-140, 100], [-112, 146], [-80, 200]], 30).ok);
  verifier('Bac à sable : une piste fait une longueur minimale', !validerPiste(bac, [[0, 0], [0, 30]], 30).ok);
  const tsOk = ajouterRemonteeBac(bac, rb, { x: 130, z: 100 }, { x: 125, z: -150 });
  verifier('Bac à sable : on pose un télésiège du bas vers le haut', tsOk.ok && rb.remonteesBac.length === 1, tsOk.raison || '');
  verifier('Bac à sable : un télésiège ne se pose pas à l\'envers', !validerRemontee(bac, { x: 125, z: -150 }, { x: 130, z: 100 }).ok);
  const nivAmenage = amenagerBac({ ...bac }, rb);
  verifier('Bac à sable : la piste tracée compte pour la neige, le télésiège a ses gares aplanies',
    nivAmenage.pistes.length === bac.pistes.length + 1 && partSurPiste(nivAmenage.pistes, 115, -100, 5) > 0.9 && partSurPiste(bac.pistes, 115, -100, 5) === 0
    && nivAmenage.terrain.replats.length === (bac._base || bac).terrain.replats.length + 2 && nivAmenage.remontees.length === 2);
  const pTr = rb.pistesBac[0], prj = projectionPiste(pTr, 113, -100), hBord = (s) => altitude(bac.terrain, prj.x + s * 10, prj.z, [pTr]) - altitude(bac.terrain, prj.x + s * 10, prj.z);
  const ecartNat = Math.abs(altitude(bac.terrain, prj.x + 10, prj.z) - altitude(bac.terrain, prj.x - 10, prj.z)), ecartTer = Math.abs(altitude(bac.terrain, prj.x + 10, prj.z, [pTr]) - altitude(bac.terrain, prj.x - 10, prj.z, [pTr]));
  verifier('Piste tracée : le terrain est terrassé (moins de dévers en travers)', pTr.terrasse && ecartTer < ecartNat, `dévers ${ecartNat.toFixed(1)} m → ${ecartTer.toFixed(1)} m sur 20 m`);
  const nd = LEVELS.find(l => l.bac), td = nd.terrain;
  const pDouce = penteMaxi(td, [[-250, -200], [-250, 200]]), pRaide = penteMaxi(td, [[260, -200], [260, 200]]);
  verifier('Grand domaine : versant doux à gauche, raide à droite ; couleurs selon la pente',
    td.largeur > 2 * TERRAIN_COMBE.largeur * 0.9 && pDouce < pRaide && couleurPente(pDouce) !== 'noire' && ['rouge', 'noire'].includes(couleurPente(pRaide))
    && couleurPente(penteMaxi(TERRAIN_COMBE, PISTE_CLARINES.points)) === 'bleue' && couleurPente(penteMaxi(TERRAIN_COMBE, PISTE_GENTIANES.points)) === 'rouge',
    `gauche ${Math.round(pDouce)} % (${couleurPente(pDouce)}), droite ${Math.round(pRaide)} % (${couleurPente(pRaide)})`);
  verifier('Bac à sable : tout est débloqué, pas d\'objectif', Object.keys(CATALOGUE).every(k => disponible(bac, rb, k).ok) && !resultatNiveau(bac, rb).reussi && !resultatNiveau(bac, rb).rate);
  rb.options.vent = { force: 12, direction: 45 };
  verifier('Bac à sable : le vent choisi est celui de la nuit', debutNuit(bac, rb).vent.force === 12 && !rb.pannesPrevues.length);
  rb.options.pannes = true; rb.nuit++;
  verifier('Bac à sable : on peut activer les pannes', debutNuit(bac, rb) && rb.pannesPrevues.length >= 1);
  rb.options.frequence = 'forte'; rb.nuit++;
  verifier('Bac à sable : beaucoup de pannes si on le demande', debutNuit(bac, rb) && rb.pannesPrevues.length >= 3, `${rb.pannesPrevues.length} pannes`);
  rb.options.eauPayante = false; rb.options.electricitePayante = false; rb.retenue.volume = 0; rb.kwhNuit = 500;
  const bb = finNuit(bac, rb);
  verifier('Bac à sable : eau et électricité gratuites si on le choisit', bb.remplissage.m3 > 0 && !bb.remplissage.cout && bb.kwh === 500 && !bb.electricite);

  // Exploitation : la station des Deux Vallons
  const nx = LEVELS.find(l => l.exploitation), rx = creerReseau(nx), tx = nx.terrain;
  const [pMarm, pVallon, pCouloir] = nx.pistes, tsV = nx.remontees[0], tsM = nx.remontees[1];
  verifier('Exploitation : 1,5 M€, personnel, forfait, gazole, 20 cm de neige naturelle, télésiège et téléski en marche',
    rx.budget === CONFIG.exploitation.budgetDepart && rx.personnel.conducteur === 1 && rx.prixForfait === CONFIG.exploitation.prixDepart && rx.carburant.stock > 0
    && Object.values(rx.enneigement).every(v => v === 20) && rx.remonteesEnMarche.length === 2 && remonteesEnService(nx, rx).length === 2);
  const hFront = [[-100, 220], [0, 230], [120, 215], [180, 240]].map(([x, z]) => altitudeNaturelle(tx, x, z));
  verifier('Station : front de neige presque plat en bas', Math.max(...hFront) - Math.min(...hFront) < 8, hFront.map(h => Math.round(h)).join(' / '));
  const hCrete = altitudeNaturelle(tx, 0, -150), hG = altitudeNaturelle(tx, -150, -150), hD = altitudeNaturelle(tx, 150, -150);
  verifier('Station : deux vallons séparés par une crête', hCrete > hG + 15 && hCrete > hD + 10, `crête ${Math.round(hCrete)} m, vallons ${Math.round(hG)} / ${Math.round(hD)} m`);
  verifier('Station : une verte en bas du vallon doux, une bleue, et une noire dans le vallon raide (pentes mesurées)',
    nx.pistes.every(p => couleurPente(penteMaxi(tx, p.points)) === p.couleur), nx.pistes.map(p => `${p.nom} ${Math.round(penteMaxi(tx, p.points))} %`).join(', '));
  verifier('Station : chaque piste est desservie par une remontée', nx.pistes.every(p => remonteesDePiste(nx, p, nx.remontees).length));
  // Téléskis
  const TS = TYPES_REMONTEES;
  verifier('Téléski : moins cher, moins de débit, un seul agent, moins d\'électricité qu\'un télésiège',
    TS.teleski.prixMetre < TS.telesiege.prixMetre && TS.teleski.debit < TS.telesiege.debit && TS.teleski.agents === 1 && puissanceRemontee(tsM) < puissanceRemontee({ ...tsM, type: 'telesiege' }));
  const vTk = validerRemontee(nx, { x: -60, z: 175 }, { x: -80, z: 60 }, 'teleski'), vTkRaide = validerRemontee(nx, { x: 150, z: 20 }, { x: 160, z: -160 }, 'teleski');
  verifier('Téléski : se pose sur une pente douce, refusé sur le mur du vallon raide', vTk.ok && !vTkRaide.ok && /raide/.test(vTkRaide.raison), (vTk.raison || '') + ' / ' + vTkRaide.raison);
  const rTk = creerReseau(nx), aTk = ajouterRemonteeBac(nx, rTk, { x: -60, z: 175 }, { x: -80, z: 60 }, 'teleski');
  verifier('Téléski : ajouté avec son nom et ses perches', aTk.ok && rTk.remonteesBac[0].type === 'teleski' && aTk.nom === 'Téléski 1' && rTk.budget === CONFIG.exploitation.budgetDepart - aTk.cout);
  rx.personnel.agent = 2;
  verifier('Avec 2 agents : le télésiège ouvre (2), plus personne pour le téléski', remonteesEnService(nx, rx).map(q => q.nom).join() === tsV.nom);
  rx.personnel.agent = 3;
  const jFerme = debutJournee(nx, rx);
  verifier('Pas assez de neige (20 cm < 30) : les pistes sont fermées, aucun client', jFerme.ferme && !jFerme.clients);
  finJournee(nx, rx, jFerme);
  for(const p of nx.pistes) rx.enneigement[p.nom] = 50;
  const j1 = debutJournee(nx, rx);
  for(let k = 0; k < 30; k++) avancerJournee(nx, rx, j1, CONFIG.exploitation.dureeJour / 30);
  const bx0 = rx.budget, bj = finJournee(nx, rx, j1);
  verifier('Avec 50 cm, les trois pistes ouvrent : clients, forfaits, satisfaction', !j1.ferme && j1.pistes.length === 3 && bj.clients > 200 && bj.forfaits === bj.clients * rx.prixForfait && bj.satisfaction > 0.4 && rx.budget === bx0 + bj.net,
    `${bj.clients} clients, satisfaction ${Math.round(bj.satisfaction * 100)} %, attente ${bj.attente.toFixed(0)} min`);
  verifier('Les pistes s\'usent avec les skieurs', rx.enneigement[pVallon.nom] < 50);
  const SC = CONFIG.exploitation.secours;
  verifier('Secours : la journée a eu des blessés, tous secourus par les pisteurs et facturés', bj.secours.blesses > 0 && bj.secours.secourus === bj.secours.blesses && !bj.secours.helico
    && bj.secours.recette === j1.secours.reduce((t, x) => t + x.prix, 0) && bj.net === bj.forfaits + bj.commerces.net + bj.secours.recette - bj.salaires,
    `${bj.secours.blesses} blessés, ${bj.secours.recette} €`);
  const verteTest = { ...pMarm, nom: 'Test verte' }, rougeTest = { ...pCouloir, nom: 'Test rouge', couleur: 'rouge' };
  const repT = repartitionClients([verteTest, rougeTest], 10000), secT = planifierSecours(nx, rx, [verteTest, rougeTest], 10000);
  const nbV = secT.filter(x => x.couleur === 'verte').length, nbR = secT.filter(x => x.couleur === 'rouge').length;
  verifier('Secours : plus de skieurs et plus de blessés sur la verte (débutants), mais un secours y rapporte moins que sur la rouge',
    repT[0] > repT[1] && nbV > 2 * nbR && SC.prix.verte < SC.prix.bleue && SC.prix.bleue < SC.prix.rouge && SC.prix.rouge < SC.prix.noire
    && secT.every(x => surPiste(x.couleur === 'verte' ? verteTest : rougeTest, x.x, x.z)), `${nbV} blessés sur la verte, ${nbR} sur la rouge`);
  const jsT = { temps: 0, secours: [1, 2, 3].map(i => ({ id: i, t: 1, piste: 'Test verte', couleur: 'verte', prix: 220, duree: 20, etat: 'prevu' })) };
  const pisteursAvant = rx.personnel.pisteur; rx.personnel.pisteur = 1;
  jsT.temps = 2; const evT = avancerSecours(rx, jsT);
  verifier('Secours : un pisteur ne fait qu\'un secours à la fois, les autres blessés attendent', evT.blesses.length === 3 && jsT.secours.filter(x => x.etat === 'encours').length === 1 && jsT.secours.filter(x => x.etat === 'attente').length === 2);
  jsT.temps = 23; const ev2T = avancerSecours(rx, jsT);
  verifier('Secours : fini, le pisteur repart vers le blessé suivant', ev2T.secourus.length === 1 && jsT.secours.filter(x => x.etat === 'encours').length === 1);
  const bsT = bilanSecours(jsT);
  verifier('Secours : à la fermeture, les blessés oubliés partent en hélicoptère (pas facturés), les longues attentes comptent', bsT.secourus === 2 && bsT.helico === 1 && bsT.recette === 440 && bsT.rapides === 2);
  rx.personnel.pisteur = pisteursAvant;
  // Commerces
  verifier('Commerces : location et restaurant dès le 1er jour, école plus tard, hôtel à la 2e saison',
    commerceDisponible(rx, 'location') && commerceDisponible(rx, 'restaurant') && !commerceDisponible(rx, 'ecole') && !commerceDisponible(rx, 'hotel'));
  const vPente = validerCommerce(nx, rx, 'restaurant', -150, -100), vPiste = validerCommerce(nx, rx, 'restaurant', pVallon.points[6][0], pVallon.points[6][1]);
  verifier('Commerces : pas dans la pente, pas sur une piste', !vPente.ok && !vPiste.ok, `${vPente.raison} / ${vPiste.raison}`);
  const budC = rx.budget, aRest = ajouterCommerce(nx, rx, 'restaurant', 140, 225), aLoc = ajouterCommerce(nx, rx, 'location', -40, 232);
  verifier('Commerces : un restaurant et une location posés sur le front de neige, payés', aRest.ok && aLoc.ok && rx.budget === budC - COMMERCES.restaurant.prix - COMMERCES.location.prix && rx.commerces.length === 2,
    `${aRest.raison || ''} ${aLoc.raison || ''}`);
  verifier('Commerces : pas deux restaurants, pas l\'un sur l\'autre', !ajouterCommerce(nx, rx, 'restaurant', 200, 240).ok && !validerCommerce(nx, rx, 'bar', 142, 226).ok);
  const j2 = debutJournee(nx, rx);
  verifier('Avec des commerces, autant de clients (pas d\'effet sur la fréquentation pour ces deux-là)', j2.clients > 0);
  for(let k = 0; k < 30; k++) avancerJournee(nx, rx, j2, CONFIG.exploitation.dureeJour / 30);
  const bj2 = finJournee(nx, rx, j2), dLoc = bj2.commerces.detail.find(d => d.type === 'location'), dRest = bj2.commerces.detail.find(d => d.type === 'restaurant');
  verifier('Commerces : chacun a ses recettes et ses charges, comptées dans le résultat du jour', dLoc.recette > dLoc.charges && dRest.recette > dRest.charges
    && bj2.net === bj2.forfaits + bj2.commerces.recette - bj2.commerces.charges + bj2.secours.recette - bj2.salaires && bj2.details.accueil > bj.details.accueil,
    `location ${dLoc.recette} €, restaurant ${dRest.recette} € ; accueil ${Math.round(bj.details.accueil * 100)} → ${Math.round(bj2.details.accueil * 100)} %`);
  const debutantsSeuls = recettesCommerces({ ...nx, pistes: [pCouloir] }, rx, { pistes: [pCouloir.nom], clients: 1000, ferme: false }, 1).detail.find(d => d.type === 'location');
  const avecVerte = recettesCommerces({ ...nx, pistes: [pMarm, pCouloir] }, rx, { pistes: [pMarm.nom, pCouloir.nom], clients: 1000, ferme: false }, 1).detail.find(d => d.type === 'location');
  verifier('Location de skis : rien sans piste facile, beaucoup avec une verte (débutants)', debutantsSeuls.recette === 0 && avecVerte.recette > 5000, `${avecVerte.recette} €`);
  rx.exploitation.jour = COMMERCES.ecole.jour;
  const cl0 = clientsAttendus(nx, rx), aEc = ajouterCommerce(nx, rx, 'ecole', 90, 238), cl1 = clientsAttendus(nx, rx);
  verifier('École de ski : débloquée au jour 4, elle fait venir plus de skieurs', aEc.ok && cl1 > cl0, `${cl0} → ${cl1} ${aEc.raison || ''}`);
  const vente = vendreCommerce(rx, aEc.id);
  verifier('Vendre un commerce rend la moitié de son prix', vente.ok && vente.rendu === COMMERCES.ecole.prix / 2 && !commerceConstruit(rx, 'ecole'));
  rx.exploitation.jour = 3;
  rx.prixForfait = 75;
  const jCher = debutJournee(nx, rx); rx.prixForfait = 30; const jBon = debutJournee(nx, rx); rx.prixForfait = 42;
  verifier('Forfait cher : moins de clients ; forfait bon marché : plus de clients', jCher.clients < jBon.clients, `${jCher.clients} à 75 €, ${jBon.clients} à 30 €`);
  rx.personnel.agent = 1;
  verifier('Avec un seul agent, seul le téléski ouvre (et sa verte)', remonteesEnService(nx, rx).map(q => q.nom).join() === tsM.nom && pistesOuvertes(nx, rx).map(p => p.nom).join() === pMarm.nom);
  rx.personnel.agent = 0;
  verifier('Sans agent, aucune remontée, donc aucune piste', !remonteesEnService(nx, rx).length && !pistesOuvertes(nx, rx).length);
  rx.personnel.agent = 3;
  const jpx = debutJournee(nx, rx); jpx.pannesPrevues = [{ t: 5, nom: tsV.nom }];
  avancerJournee(nx, rx, jpx, 10);
  verifier('Panne du télésiège : il s\'arrête, l\'attente monte (seul le téléski tourne)', enPanne(rx, tsV.nom) && jpx.remonteesActives.join() === tsM.nom && jpx.attente > 10, `${Math.round(jpx.attente)} min`);
  const prx = rx.pannes.find(p => p.type === 'remontee'), dRep = reparerPanne(nx, rx, prx.id, true, jpx.temps);
  verifier('Avec 1 technicien, la réparation dure le temps normal', dRep.ok && dRep.duree === CONFIG.pannes.types.remontee.duree);
  finJournee(nx, rx, jpx);
  const ptx = pointSurPiste(pVallon, 0.8, 0);
  rx.tas = [{ x: ptx.x, z: ptx.z, volume: 2000, aDamer: 2000 }];
  const epx0 = rx.enneigement[pVallon.nom], stx0 = rx.carburant.stock, bnx = finNuit(nx, rx);
  verifier('Exploitation : la neige damée épaissit la piste (pas d\'argent au m³) et la dameuse consomme du gazole',
    rx.enneigement[pVallon.nom] > epx0 + 3 && bnx.gain === 0 && rx.carburant.stock < stx0, `+${(rx.enneigement[pVallon.nom] - epx0).toFixed(1)} cm, ${stx0 - rx.carburant.stock} L`);
  rx.personnel.conducteur = 0; rx.tas = [{ x: ptx.x, z: ptx.z, volume: 500, aDamer: 500 }];
  verifier('Sans conducteur, la dameuse ne sort pas', finNuit(nx, rx).dame === 0);
  rx.personnel.conducteur = 1; rx.carburant.stock = 0;
  verifier('Sans gazole non plus', finNuit(nx, rx).dame === 0 && acheterCarburant(rx, 1000).ok && rx.carburant.stock === 1000);
  rx.exploitation.jour = CONFIG.exploitation.joursSaison;
  const jfx = finJournee(nx, rx, debutJournee(nx, rx));
  verifier('Dernier jour : bilan de saison, la saison suivante commence', !!jfx.saison && rx.exploitation.saison === 2 && rx.exploitation.jour === 1);
  const aHot = ajouterCommerce(nx, rx, 'hotel', 200, 190);
  verifier('Saison 2 : l\'hôtel se débloque ; il rapporte même station fermée (moitié moins)', commerceDisponible(rx, 'hotel') && aHot.ok
    && occupationHotel(rx, true) < occupationHotel(rx, false), aHot.raison || '');

  // Dameuse et remontées
  const nd2 = LEVELS.find(l => l.id === 'reseau'), rd = creerReseau(nd2);
  rd.tas = [{ x: 0, z: 0, volume: 3000, aDamer: 2500 }, { x: 50, z: 0, volume: 2000, aDamer: 1800 }];
  const bilanD = finNuit(nd2, rd);
  verifier('Dameuse DM 400 : 3 500 m³ étalés par jour, payés 20 €/m³, le reste attend', bilanD.dame === 3500 && Math.round(bilanD.aDamer) === 800 && rd.neigePiste === 3500 && bilanD.gain === 70000,
    `${bilanD.dame} m³ damés, ${Math.round(bilanD.aDamer)} m³ en attente`);
  const chD = changerDameuse(rd, 'dm600');
  verifier('Passer à la DM 600 : très cher, l\'ancienne est reprise', chD.ok && chD.cout === DAMEUSES.dm600.prix - DAMEUSES.dm400.prix * CONFIG.dameuse.reprise && DAMEUSES.dm600.capacite > DAMEUSES.dm400.capacite);
  annulerAction(rd);
  verifier('Annuler le changement de dameuse', rd.dameuse.modele === 'dm400');
  basculerRemontee(rd, TELESIEGE_CLARINES.nom, true);
  verifier('Télésiège en marche : il consomme de l\'électricité la journée', kwhRemonteesJour(nd2, rd) === puissanceRemontee(TELESIEGE_CLARINES) * CONFIG.remontees.heuresJour && finNuit(nd2, rd).kwhRemontees > 0);
  basculerRemontee(rd, TELESIEGE_CLARINES.nom, false);
  verifier('Télésiège arrêté : rien à payer', kwhRemonteesJour(nd2, rd) === 0);

  const r1 = alea(42), r2 = alea(42);
  verifier('Hasard : la même graine redonne les mêmes nombres', [1, 2, 3].every(() => r1() === r2()));

  return res;
}
