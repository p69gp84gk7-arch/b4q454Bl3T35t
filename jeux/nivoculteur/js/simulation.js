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
function altitudeNaturelle(t, x, z){
  const u = borne((t.longueur / 2 - z) / t.longueur, -0.9, 1.8);   // 0 en bas de la pente, 1 en haut
  let h = t.altBas + t.denivele * (0.85 * u + 0.15 * u * u);
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
function altitude(t, x, z, pistes = null){
  let h = altitudeNaturelle(t, x, z);
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
  if(niveau.numero < d.niveau) return { ok: false, raison: d.niveau === 3 ? 'au niveau 3 (air comprimé)' : `au niveau ${d.niveau}` };
  if(res.neigePiste < d.m3) return { ok: false, raison: `après ${d.m3.toLocaleString('fr-FR')} m³ de neige sur les pistes` };
  return { ok: true };
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
  return {
    budget: niveau.budget,
    noeuds: [
      { id: 'pompage', type: 'pompage', nom: p.nom, x: p.sortie.x, z: p.sortie.z },
      ...niveau.departsElec.map((d, i) => ({ id: `elec${i + 1}`, type: 'elec', nom: d.nom, x: d.x, z: d.z }))
    ],
    tranchees: [],          // { a, b, eau, cable, longueur }
    historique: [],         // pour annuler : une entrée par achat, regroupées par « lot » (une action du joueur)
    numero: 0,              // numéro du dernier regard posé
    lot: 0,
    nuit: 1,                // numéro de la prochaine nuit
    neigePiste: 0,          // m³ tombés sur les pistes depuis le début (compte pour l'objectif et les déblocages)
    neigeTotale: 0,
    tas: [],                // tas de neige { x, z, volume }
    retenue: niveau.retenue ? { volume: volumeRetenue(niveau.retenue) * niveau.retenue.niveau ** 2 } : null
  };
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
// Nœuds alimentés : reliés à une source (salle de pompage pour 'eau', départs électriques pour 'cable')
function alimentes(res, quoi){
  const ok = new Set(res.noeuds.filter(n => n.type === (quoi === 'eau' ? 'pompage' : 'elec')).map(n => n.id));
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
function longueursEau(res){
  const dist = new Map([['pompage', 0]]), faits = new Set();
  for(;;){
    let id = null, d = Infinity;
    for(const [k, v] of dist) if(!faits.has(k) && v < d){ id = k; d = v; }
    if(id === null) return dist;
    faits.add(id);
    for(const tr of res.tranchees){
      if(!tr.eau) continue;
      const autre = tr.a === id ? tr.b : tr.b === id ? tr.a : null;
      if(autre && d + tr.longueur < (dist.has(autre) ? dist.get(autre) : Infinity)) dist.set(autre, d + tr.longueur);
    }
  }
}
// État d'un regard : eau, électricité, pression prévue (pompes en marche, aucun canon ouvert)
function etatRegard(niveau, res, id){
  const n = noeudReseau(res, id), t = niveau.terrain, pomp = noeudReseau(res, 'pompage');
  const eau = alimentes(res, 'eau').has(id), elec = alimentes(res, 'cable').has(id);
  let pression = null, zone = null;
  if(eau){
    pression = pressionRegard({ pPompes: CONFIG.pression.pompes, longueur: longueursEau(res).get(id),
      denivele: altitude(t, n.x, n.z) - altitude(t, pomp.x, pomp.z), debit: 0 });
    zone = zonePression(pression, CATALOGUE[n.modele]);
  }
  const manque = !eau && !elec ? 'l\'eau et l\'électricité' : !eau ? 'l\'eau' : !elec ? 'l\'électricité' : null;
  return { eau, elec, pression, zone, manque, pret: eau && elec };
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
function poserRegard(niveau, res, x, z, choix = {}, lot = ++res.lot){
  const modele = choix.modele || 'v8', support = CATALOGUE[modele].type === 'ventilateur' ? (choix.support || 'trepied') : null;
  const refus = refusRegard(niveau, res, x, z);
  if(refus) return { ok: false, raison: refus };
  const dispo = disponible(niveau, res, modele);
  if(!dispo.ok) return { ok: false, raison: `${CATALOGUE[modele].nom} : disponible ${dispo.raison}.` };
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
  if(!A || !B || idA === idB) return refus('Choisissez deux points différents.');
  if(B.type !== 'regard') return refus('L\'arrivée doit être un regard.');
  if(quoi === 'eau' && A.type === 'elec') return refus('L\'eau part de la salle de pompage ou d\'un regard.');
  if(quoi === 'cable' && A.type === 'pompage') return refus('Le câble part d\'un départ électrique ou d\'un regard.');
  if(!alimentes(res, quoi).has(idA)) return refus(`${A.nom} n'est pas encore alimenté en ${quoi === 'eau' ? 'eau' : 'électricité'}.`);
  if(R && distanceSegment(R.x, R.z, [A.x, A.z], [B.x, B.z]) < R.cuvette.rayon + 2) return refus('La tranchée ne peut pas traverser la retenue.');
  const existe = trancheeEntre(res, idA, idB);
  if(existe && existe[quoi]) return refus(`Ces deux points sont déjà reliés pour ${quoi === 'eau' ? 'l\'eau' : 'l\'électricité'}.`);
  const longueur = existe ? existe.longueur : longueurTranchee(niveau.terrain, A, B);
  const commune = !!(existe && existe[quoi === 'eau' ? 'cable' : 'eau']);
  // Tranchée commune : la tranchée est déjà creusée, on ne paie que la différence
  const parMetre = commune ? c.trancheeCommune - (quoi === 'eau' ? c.trancheeCable : c.trancheeEau) : (quoi === 'eau' ? c.trancheeEau : c.trancheeCable);
  const cout = Math.round(longueur * parMetre);
  const assez = res.budget >= cout;
  return { ok: assez, raison: assez ? null : 'Budget insuffisant.', longueur, cout, commune, parMetre };
}
function ajouterTranchee(niveau, res, idA, idB, quoi, lot = ++res.lot){
  const d = devisTranchee(niveau, res, idA, idB, quoi);
  if(!d.ok) return d;
  let tr = trancheeEntre(res, idA, idB);
  const nouvelle = !tr;
  if(nouvelle){ tr = { a: idA, b: idB, eau: false, cable: false, longueur: d.longueur }; res.tranchees.push(tr); }
  tr[quoi] = true;
  res.budget -= d.cout;
  res.historique.push({ lot, type: 'tranchee', cle: cleTranchee(idA, idB), quoi, nouvelle, cout: d.cout });
  return d;
}
// Annule la dernière action du joueur : tout ce qu'elle a acheté est remboursé
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
  const r = alea(niveau.terrain.graine * 7919 + numero * 104729);
  return { force: Math.round(r() * CONFIG.vent.forceMax), direction: Math.round(r() * 360 - 180) };
}
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
  const t = niveau.terrain, pomp = noeudReseau(res, 'pompage');
  const eau = alimentes(res, 'eau'), elec = alimentes(res, 'cable'), longueurs = longueursEau(res);
  const sec = !!(res.retenue && res.retenue.volume <= 0);
  const canons = res.noeuds.filter(n => n.type === 'regard' && eau.has(n.id) && elec.has(n.id)).map(n => {
    const chute = pointChute(n, vent);
    return { id: n.id, modele: n.modele, longueur: longueurs.get(n.id), denivele: altitude(t, n.x, n.z) - altitude(t, pomp.x, pomp.z),
      chute, part: partSurPiste(niveau.pistes, chute.x, chute.z, chute.rayon), ouvert: !sec, pression: 0, zone: 'arret', facteur: 0, debit: 0, production: 0 };
  });
  for(let k = 0; k <= canons.length; k++){
    const debitTotal = canons.reduce((s, c) => s + (c.ouvert ? CATALOGUE[c.modele].debit : 0), 0) * 3.6;   // l/s → m³/h
    for(const c of canons){
      const m = CATALOGUE[c.modele];
      c.pression = sec ? 0 : pressionRegard({ pPompes: CONFIG.pression.pompes, longueur: c.longueur, denivele: c.denivele, debit: debitTotal });
      c.zone = zonePression(c.pression, m);
      c.facteur = c.ouvert ? facteurProduction(c.pression, m) : 0;
    }
    const enDefaut = canons.filter(c => c.ouvert && c.facteur === 0);
    if(!enDefaut.length) break;
    enDefaut.sort((a, b) => a.pression - b.pression)[0].ouvert = false;
  }
  for(const c of canons){ const m = CATALOGUE[c.modele]; c.debit = c.ouvert ? m.debit : 0; c.production = c.facteur * m.neige; }
  const debit = canons.reduce((s, c) => s + c.debit, 0);
  return { vent, canons, debit, sec, pressionDepart: sec ? 0 : CONFIG.pression.pompes - debit * 3.6 * CONFIG.pression.perteDebit };
}
function debutNuit(niveau, res){
  res.historique = [];                       // on ne peut plus annuler ce qui a été construit avant la nuit
  res.neigeNuit = 0; res.pisteNuit = 0; res.argentNuit = 0;
  res.dispoAvant = Object.keys(CATALOGUE).filter(k => disponible(niveau, res, k).ok);
  return regimeNuit(niveau, res, ventDeLaNuit(niveau, res.nuit));
}
// Fait avancer la nuit de dt secondes de jeu : la neige s'ajoute aux tas, l'eau sort de la retenue
function avancerNuit(niveau, res, regime, dt){
  for(const c of regime.canons){
    if(!c.production) continue;
    const v = c.production * dt, vPiste = v * c.part;
    res.neigeTotale += v; res.neigeNuit += v;
    res.neigePiste += vPiste; res.pisteNuit += vPiste;
    res.argentNuit += vPiste * CONFIG.gains.parM3Piste;
    if(!c.tas){
      c.tas = res.tas.find(q => Math.hypot(q.x - c.chute.x, q.z - c.chute.z) < 6);
      if(!c.tas){ c.tas = { x: c.chute.x, z: c.chute.z, volume: 0 }; res.tas.push(c.tas); }
    }
    c.tas.volume += v;
  }
  let vide = false;
  if(res.retenue && regime.debit > 0){
    res.retenue.volume -= regime.debit * CONFIG.nuit.echelle / 1000 * dt;
    if(res.retenue.volume <= 0){ res.retenue.volume = 0; vide = true; }
  }
  return { vide };
}
// Fin de nuit : l'argent gagné s'ajoute au budget, la retenue se remplit un peu pendant la journée
function finNuit(niveau, res){
  const gain = Math.round(res.argentNuit);
  res.budget += gain;
  const bilan = { nuit: res.nuit, neige: res.neigeNuit, piste: res.pisteNuit, gain,
    objectif: res.neigePiste >= niveau.objectif.m3,
    nouveaux: Object.keys(CATALOGUE).filter(k => disponible(niveau, res, k).ok && !(res.dispoAvant || []).includes(k)) };
  res.nuit++;
  res.argentNuit = 0;
  if(res.retenue) res.retenue.volume = Math.min(volumeRetenue(niveau.retenue), res.retenue.volume + CONFIG.retenue.remplissageJour);
  return bilan;
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
  for(let k = 0; k < 40; k++) avancerNuit(niv, rn, regime, 1);
  const attendu = regime.canons.reduce((s, c) => s + c.production * 40, 0);
  verifier('Nuit de 40 s : la neige produite correspond aux débits, en tas', proche(rn.neigeTotale, attendu, 1e-6) && rn.tas.length >= 1, `${Math.round(rn.neigeTotale)} m³`);
  verifier('La retenue se vide pendant la nuit', rn.retenue.volume < eauAvant, `${Math.round(eauAvant - rn.retenue.volume)} m³ d'eau utilisés`);
  const bilan = finNuit(niv, rn);
  verifier('Fin de nuit : 20 € par m³ tombé sur la piste s\'ajoutent au budget', rn.budget - budgetAvant === Math.round(rn.neigePiste * 20) && bilan.gain >= 0 && rn.nuit === 2, `+${bilan.gain} €`);
  rn.retenue.volume = 1;
  const r2n = debutNuit(niv, rn), fin = avancerNuit(niv, rn, r2n, 1), apres = regimeNuit(niv, rn, r2n.vent);
  verifier('Retenue vide : les pompes sont à sec, plus aucun canon ne produit', fin.vide && apres.sec && apres.canons.every(c => !c.production));

  const dir = directionVersPiste(niv.pistes, 70, 0);
  verifier('Un canon à droite de la piste souffle vers la gauche (vers la piste)', dir < -45 && dir > -135, `${dir}°`);

  const r1 = alea(42), r2 = alea(42);
  verifier('Hasard : la même graine redonne les mêmes nombres', [1, 2, 3].every(() => r1() === r2()));

  return res;
}
