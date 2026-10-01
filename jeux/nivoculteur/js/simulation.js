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
    retenue: niveau.retenue ? { volume: volumeRetenue(niveau.retenue) * (niveau.retenueDepart ?? niveau.retenue.niveau) ** 2 } : null,
    coups: 0,               // coups de bélier depuis le début du niveau
    pannes: [],             // pannes en cours (niveau 4) : { id, type, cible, nuit, t, etat: 'active' | 'reparation', fin }
    numeroPanne: 0
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
  const t = niveau.terrain, pomp = noeudReseau(res, 'pompage'), cp = CONFIG.pompage;
  const cmd = res.pompage || { mode: 'auto', marche: [true, true, true], ouverture: 1 };
  const P = effetsPannes(niveau, res);
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
    pompes = cmd.mode === 'auto' ? Math.min(cp.pompes - P.pompes.size, Math.max(demande > 0 ? 1 : 0, Math.ceil(demande / cp.debitNominal)))
                                 : cmd.marche.filter((m, i) => m && !P.pompes.has(i)).length;
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
    pressionDepart: Math.max(0, pDepart), air: regimeAir, fuite, pompesEnPanne: [...P.pompes] };
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
// Ce qui peut tomber en panne (on ne casse pas deux fois la même chose)
function ciblesPannes(niveau, res){
  const prets = res.noeuds.filter(n => n.type === 'regard' && etatRegard(niveau, res, n.id).pret);
  const deja = new Set((res.pannes || []).map(p => p.type + p.cible));
  const c = {
    fuite: res.tranchees.filter(tr => tr.eau).map(tr => cleTranchee(tr.a, tr.b)),
    moteur: prets.filter(n => CATALOGUE[n.modele].type === 'ventilateur').map(n => n.id),
    gel: prets.filter(n => CATALOGUE[n.modele].type === 'perche').map(n => n.id),
    disjoncteur: res.noeuds.filter(n => n.type === 'elec' && res.tranchees.some(tr => tr.cable && (tr.a === n.id || tr.b === n.id))).map(n => n.id),
    pompe: ['0', '1', '2']
  };
  for(const k in c) c[k] = c[k].filter(x => !deja.has(k + x));
  return c;
}
// Pannes de la nuit, tirées au sort au début de la nuit (toujours les mêmes pour une même nuit)
function planifierPannes(niveau, res){
  res.pannesPrevues = [];
  if(!niveau.pannes) return [];
  const cp = CONFIG.pannes, r = alea(niveau.terrain.graine * 4513 + res.nuit * 92821 + 7);
  const nb = cp.parNuit[0] + Math.floor(r() * (cp.parNuit[1] - cp.parNuit[0] + 1)), cibles = ciblesPannes(niveau, res);
  for(let k = 0; k < nb; k++){
    const types = Object.keys(cp.types).filter(ty => cibles[ty].length);
    if(!types.length) break;
    let x = r() * types.reduce((s, ty) => s + cp.types[ty].poids, 0), type = types[0];
    for(const ty of types){ x -= cp.types[ty].poids; if(x < 0){ type = ty; break; } }
    const cible = cibles[type].splice(Math.floor(r() * cibles[type].length), 1)[0];
    res.pannesPrevues.push({ t: cp.moment[0] + r() * (cp.moment[1] - cp.moment[0]), type, cible });
  }
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
// Les pannes qui arrivent entre deux instants de la nuit
function evenementsPannes(niveau, res, tAvant, tApres){
  const dues = (res.pannesPrevues || []).filter(e => e.t > tAvant && e.t <= tApres);
  if(!dues.length) return [];
  res.pannesPrevues = res.pannesPrevues.filter(e => !dues.includes(e));
  return dues.map(e => declencherPanne(res, e.type, e.cible, e.t));
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
  p.etat = 'reparation'; p.fin = t + ty.duree;
  return { ok: true, cout: ty.cout, finie: false, duree: ty.duree };
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
  return nom(p.cible);
}
function positionPanne(res, p){
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
  return regimeNuit(niveau, res, ventDeLaNuit(niveau, res.nuit));
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
    res.neigePiste += vPiste; res.pisteNuit += vPiste;
    res.argentNuit += vPiste * CONFIG.gains.parM3Piste;
    if(!c.tas){
      c.tas = res.tas.find(q => Math.hypot(q.x - c.chute.x, q.z - c.chute.z) < 6);
      if(!c.tas){ c.tas = { x: c.chute.x, z: c.chute.z, volume: 0 }; res.tas.push(c.tas); }
    }
    c.tas.volume += v;
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
  const gain = Math.round(res.argentNuit), kwh = Math.round(res.kwhNuit || 0), electricite = Math.round(kwh * CONFIG.electricite.prixKwh);
  res.budget += gain - electricite;
  const bilan = { nuit: res.nuit, neige: res.neigeNuit, piste: res.pisteNuit, gain, kwh, electricite, coups: res.coupsNuit || 0,
    rendement: res.potentielNuit > 0 ? res.neigeNuit / res.potentielNuit : null,
    pannes: res.pannesNuit || 0, reparations: res.reparationsNuit || 0,
    nouveaux: Object.keys(CATALOGUE).filter(k => disponible(niveau, res, k).ok && !(res.dispoAvant || []).includes(k)) };
  res.nuit++;
  res.argentNuit = 0;
  if(res.compresseur) res.compresseur.pression = 0;           // le réservoir se vide pendant la journée
  if(res.pannes) res.pannes = res.pannes.filter(p => p.etat !== 'reparation');   // l'équipe finit son travail ; les autres pannes restent
  res.pannesPrevues = [];
  if(res.retenue) res.retenue.volume = Math.min(volumeRetenue(niveau.retenue), res.retenue.volume + CONFIG.retenue.remplissageJour);
  Object.assign(bilan, resultatNiveau(niveau, res));
  return bilan;
}
// Où en est le niveau ? reussi / rate (avec la raison) / en cours
function resultatNiveau(niveau, res){
  const o = niveau.objectif, coups = res.coups || 0;
  if(o.coupsMax !== undefined && coups > o.coupsMax) return { reussi: false, rate: `${coups} coups de bélier : une conduite a cassé.` };
  const fait = o.type === 'production' ? res.neigeTotale >= o.m3 : res.neigePiste >= o.m3;
  if(fait) return { reussi: true, rate: null };
  if(o.nuits && res.nuit > o.nuits) return { reussi: false, rate: `Les ${o.nuits} nuits sont passées sans atteindre l'objectif.` };
  return { reussi: false, rate: null };
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
  verifier('Fin de nuit : 20 € par m³ tombé sur la piste, moins l\'électricité des pompes', rn.budget - budgetAvant === Math.round(rn.neigePiste * 20) - bilan.electricite && bilan.electricite > 0 && rn.nuit === 2,
    `+${bilan.gain} €, électricité ${bilan.kwh} kWh = ${bilan.electricite} €`);
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
  const ev = evenementsProgramme(niv1, r1n, -1, 13);
  verifier('Programme : entre 0 et 13 s, le chef d\'équipe ouvre les regards 1 à 4', ev.length === 4 && ev.every(e => e.ouvert));
  evenementsProgramme(niv1, r1n, 13, 25);
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
  const prevues = r4.pannesPrevues.map(p => p.type + p.cible).join();
  r4.compresseur.pression = CONFIG.air.pressionNominale;
  const v4 = { force: 0, direction: 0 }, base4 = regimeNuit(niv4, r4, v4);
  verifier('Pannes : 1 à 3 par nuit, toujours les mêmes pour une même nuit',
    r4.pannesPrevues.length >= 1 && r4.pannesPrevues.length <= 3 && planifierPannes(niv4, r4).map(p => p.type + p.cible).join() === prevues, prevues);
  verifier('Sans panne, les 10 canons produisent', base4.canons.length === 10 && base4.canons.every(c => c.production > 0));
  const ev4 = evenementsPannes(niv4, r4, -1, CONFIG.nuit.duree);
  verifier('Les pannes prévues arrivent pendant la nuit', ev4.length === r4.pannes.length && !r4.pannesPrevues.length);
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

  const r1 = alea(42), r2 = alea(42);
  verifier('Hasard : la même graine redonne les mêmes nombres', [1, 2, 3].every(() => r1() === r2()));

  return res;
}
