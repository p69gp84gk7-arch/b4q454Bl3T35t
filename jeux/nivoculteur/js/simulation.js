'use strict';
/* Nivoculteur 2D · la simulation (logique pure : jamais de dessin ici)
   Réseau (regards, tranchées), pression, température, vent, production de la nuit, tas de neige, bilan.
   Testable sans navigateur : concaténer config.js, domaine.js et simulation.js puis appeler testsSimulation() avec Node. */

/* ---------- Le réseau ---------- */
function creerReseau(dom){
  return {
    version:2, taille:dom.taille, graine:dom.graine,
    noeuds:[{ id:'pompage', type:'pompage', x:dom.salle.x + (dom.retenue.x > dom.salle.x ? 10 : -10), y:dom.salle.y - dom.salle.h / 2 - 2 },
      ...dom.departs.map(d => ({ id:d.id, type:'elec', x:d.x, y:d.y, nom:d.nom }))],
    tranchees:[], budget:dom.budget, nuit:0, numero:0,
    neigePiste:0, neigeTotale:0, parPiste:{}, tas:[], bilans:[],
    retenue:{ volume:dom.retenue.max, remplissage:CONFIG.retenue.remplissageJour },
    fini:false
  };
}
const noeud = (res, id) => res.noeuds.find(n => n.id === id);
const cleTranchee = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
const trancheeEntre = (res, a, b) => res.tranchees.find(t => cleTranchee(t.a, t.b) === cleTranchee(a, b));
const longueur = (res, a, b) => { const A = noeud(res, a), B = noeud(res, b); return Math.hypot(A.x - B.x, A.y - B.y); };
// Les nœuds alimentés en eau (depuis la salle) ou en électricité (depuis un départ)
function alimentes(res, quoi){
  // l'eau part de la salle ; le câble part de la salle (elle a son départ électrique) ou d'un départ électrique
  const vus = new Set(res.noeuds.filter(n => n.id === 'pompage' || (quoi === 'cable' && n.type === 'elec')).map(n => n.id)), file = [...vus];
  while(file.length){
    const id = file.shift();
    for(const t of res.tranchees){ if(!t[quoi]) continue; const autre = t.a === id ? t.b : t.b === id ? t.a : null; if(autre && !vus.has(autre)){ vus.add(autre); file.push(autre); } }
  }
  return vus;
}
// Longueur de conduite d'eau entre la salle et chaque nœud (le plus court chemin)
function longueursEau(res){
  const d = new Map([['pompage', 0]]), file = ['pompage'];
  while(file.length){
    file.sort((a, b) => d.get(a) - d.get(b));
    const id = file.shift();
    for(const t of res.tranchees){
      if(!t.eau) continue; const autre = t.a === id ? t.b : t.b === id ? t.a : null; if(!autre) continue;
      const nd = d.get(id) + longueur(res, t.a, t.b);
      if(!d.has(autre) || nd < d.get(autre) - 1e-6){ d.set(autre, nd); file.push(autre); }
    }
  }
  return d;
}
// Ce que reçoit un regard : eau, électricité
function etatRegard(res, id){
  const eau = alimentes(res, 'eau').has(id), elec = alimentes(res, 'cable').has(id);
  return { eau, elec, pret:eau && elec, manque:[!eau && 'l\'eau', !elec && 'l\'électricité'].filter(Boolean) };
}
function prixEnneigeur(modele, support){ return CATALOGUE[modele].prix + SUPPORTS[support || 'trepied'].prix; }
function disponible(res, modele){ return res.neigePiste >= CATALOGUE[modele].debloque; }
// Peut-on poser un regard ici ?
function refusRegard(dom, res, x, y){
  if(x < 4 || y < 4 || x > dom.W - 4 || y > dom.H - 4) return 'En dehors du domaine.';
  if(Math.hypot(x - dom.retenue.x, y - dom.retenue.y) < dom.retenue.r + 4) return 'Pas dans la retenue.';
  const s = dom.salle; if(x > s.x - s.w / 2 - 4 && x < s.x + s.w / 2 + 4 && y > s.y - s.h / 2 - 4 && y < s.y + s.h / 2 + 4) return 'Pas sur la salle des machines.';
  const proche = res.noeuds.find(n => Math.hypot(n.x - x, n.y - y) < CONFIG.construction.ecartRegards);
  if(proche) return `Trop près ${proche.type === 'regard' ? 'd\'un autre regard' : proche.type === 'elec' ? 'd\'un départ électrique' : 'de la salle'} (${CONFIG.construction.ecartRegards} m au moins).`;
  return null;
}
function prochainNom(res){ return 'R' + (res.noeuds.filter(n => n.type === 'regard').reduce((m, n) => Math.max(m, +n.id.slice(1) || 0), 0) + 1); }
function poserRegard(dom, res, x, y, modele = 'v8', support = 'trepied'){
  const id = prochainNom(res);
  const n = { id, type:'regard', x, y, canon:{ modele, support, dir:directionVersPiste(dom, x, y), mode:'auto' } };
  res.noeuds.push(n); res.budget -= CONFIG.couts.regard + prixEnneigeur(modele, support);
  return n;
}
// La tranchée ne traverse pas la retenue
function traverseRetenue(dom, A, B){ return distanceSegment(dom.retenue.x, dom.retenue.y, [A.x, A.y], [B.x, B.y]) < dom.retenue.r + 2; }
// Devis d'une tranchée entre deux nœuds (ou un nœud et un nouveau regard) pour l'eau et/ou le câble
function devisTranchee(dom, res, A, B, quoi){
  const l = Math.hypot(A.x - B.x, A.y - B.y), c = CONFIG.couts, ex = A.id && B.id ? trancheeEntre(res, A.id, B.id) : null;
  if(traverseRetenue(dom, A, B)) return { refus:'La tranchée ne peut pas traverser la retenue.' };
  if(A.id && A.id === B.id) return { refus:'Choisissez un autre point d\'arrivée.' };
  let prix, detail;
  const eau = quoi.eau && !(ex && ex.eau), cable = quoi.cable && !(ex && ex.cable);
  if(!eau && !cable) return { refus:'Ce réseau est déjà posé entre ces deux points.' };
  if(ex){ prix = l * ((eau ? c.ajout.eau : 0) + (cable ? c.ajout.cable : 0)); detail = 'dans la tranchée déjà creusée'; }
  else if(eau && cable){ prix = l * c.trancheeCommune; detail = `tranchée commune eau + câble, ${c.trancheeCommune} €/m`; }
  else if(eau){ prix = l * c.trancheeEau; detail = `conduite d'eau, ${c.trancheeEau} €/m`; }
  else { prix = l * c.trancheeCable; detail = `câble, ${c.trancheeCable} €/m`; }
  return { longueur:Math.round(l), prix:Math.round(prix), detail, eau, cable };
}
function ajouterTranchee(res, a, b, quoi){
  let t = trancheeEntre(res, a, b);
  if(!t){ t = { a, b, eau:false, cable:false }; res.tranchees.push(t); }
  if(quoi.eau) t.eau = true; if(quoi.cable) t.cable = true;
  return t;
}
// Démonter un regard (et son enneigeur) : les tranchées qui y arrivent sont retirées ; on récupère une part du prix
function devisDemontage(res, id){
  const n = noeud(res, id), c = CONFIG.couts;
  const tr = res.tranchees.filter(t => t.a === id || t.b === id);
  const rendu = (c.regard + prixEnneigeur(n.canon.modele, n.canon.support)) * c.revente + tr.reduce((s, t) => s + prixTranchee(res, t) * c.repriseTranchee, 0);
  return { rendu:Math.round(rendu), tranchees:tr.length };
}
function prixTranchee(res, t){ const l = longueur(res, t.a, t.b), c = CONFIG.couts; return l * (t.eau && t.cable ? c.trancheeCommune : t.eau ? c.trancheeEau : c.trancheeCable); }
function demonter(res, id){
  const d = devisDemontage(res, id);
  res.tranchees = res.tranchees.filter(t => t.a !== id && t.b !== id);
  res.noeuds = res.noeuds.filter(n => n.id !== id);
  res.budget += d.rendu;
  return d;
}
function retirerTranchee(res, t){
  const rendu = Math.round(prixTranchee(res, t) * CONFIG.couts.repriseTranchee);
  res.tranchees = res.tranchees.filter(x => x !== t); res.budget += rendu; return rendu;
}
function devisChangement(res, id, modele, support){
  const n = noeud(res, id), ancien = prixEnneigeur(n.canon.modele, n.canon.support), nouveau = prixEnneigeur(modele, support);
  return { prix:nouveau - Math.round(ancien * CONFIG.couts.reprise), reprise:Math.round(ancien * CONFIG.couts.reprise) };
}
function changerEnneigeur(res, id, modele, support){
  const d = devisChangement(res, id, modele, support), n = noeud(res, id);
  n.canon.modele = modele; n.canon.support = support; res.budget -= d.prix;
}

/* ---------- La météo de chaque nuit (tirée au sort, toujours la même pour une même nuit) ---------- */
function meteoNuit(dom, numero){
  const R = alea(dom.graine * 7919 + numero * 104729), ct = CONFIG.temperature, cv = CONFIG.vent;
  const soir = entre(R, ct.soir), min = entre(R, ct.minimum);
  const redoux = R() < ct.redoux ? { t:.3 + R() * .45, force:entre(R, ct.forceRedoux) } : null;
  const sautes = [{ t:0, force:Math.round(R() * cv.forceMax * .8), dir:R() * 6.28 }];
  const nb = Math.round(entre(R, cv.changements));
  for(let k = 0; k < nb; k++){
    const prec = sautes[sautes.length - 1];
    sautes.push({ t:(k + 1) / (nb + 1) + (R() - .5) * .1, force:Math.round(borne(prec.force + (R() - .5) * 22, 0, cv.forceMax)), dir:prec.dir + (R() * 2 - 1) * cv.rotationMax * Math.PI / 180 });
  }
  return { soir:Math.round(soir * 10) / 10, min:Math.round(min * 10) / 10, redoux, sautes };
}
// Température humide en bas du domaine à l'instant u (0 = 18 h, 1 = 6 h)
function temperature(meteo, u){
  const { soir, min, redoux } = meteo;
  let T = u < .72 ? soir + (min - soir) * lisse(u / .72) : min + (soir - min) * .3 * lisse((u - .72) / .28);
  if(redoux) T += redoux.force * Math.exp(-(((u - redoux.t) / .07) ** 2));
  return T;
}
// Température à un endroit : plus haut, plus froid
const temperatureA = (dom, T, x, y) => T - CONFIG.temperature.gradient * (dom.alt(x, y) - dom.altBas) / 100;
// Part de la production complète selon la température humide (0 au-dessus de −2 °C, 1 à −7 °C et plus froid)
function facteurTemperature(T, ct = CONFIG.temperature){
  if(T >= ct.debut) return 0;
  if(T >= ct.moitie) return .5 * (ct.debut - T) / (ct.debut - ct.moitie);
  if(T >= ct.pleine) return .5 + .5 * (ct.moitie - T) / (ct.moitie - ct.pleine);
  return 1;
}
// Vent à l'instant u : il passe d'une saute à l'autre en un quart d'heure environ
function ventA(meteo, u){
  const s = meteo.sautes; let i = 0; while(i + 1 < s.length && s[i + 1].t <= u) i++;
  const a = s[i], b = s[i + 1];
  if(!b) return { force:a.force, dir:a.dir };
  const f = lisse((u - b.t + .03) / .03);
  return { force:a.force + (b.force - a.force) * f, dir:a.dir + (b.dir - a.dir) * f };
}
const ROSE = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
// Le vent « vient de » : la direction dir est celle vers laquelle il souffle ; le haut de la carte est le nord
function nomVent(dir){ const a = Math.atan2(-Math.sin(dir), Math.cos(dir)) * 180 / Math.PI; return ROSE[Math.round(((a + 360) % 360) / 45) % 8]; }

/* ---------- La pression et la production ---------- */
function pressionPompes(debit, pompes, cp = CONFIG.pompage){
  if(!pompes) return 0;
  const q = debit / pompes / cp.debitNominal;
  return cp.pressionVanneFermee - (cp.pressionVanneFermee - cp.pressionNominale) * q * q;
}
function zonePression(p, m, cfg = CONFIG.pression){
  if(p > cfg.zones.surpression) return 'surpression';
  if(p < m.pressionMin) return 'arret';
  if(p < m.pressionPleine) return 'faible';
  if(p > cfg.zones.correcte) return 'haute';
  return 'correcte';
}
function facteurPression(p, m, cfg = CONFIG.pression){
  if(p > cfg.zones.surpression || p < m.pressionMin) return 0;
  return borne(cfg.production + (1 - cfg.production) * (p - m.pressionMin) / (m.pressionPleine - m.pressionMin), 0, 1);
}
// Où tombe la neige d'un canon : direction × portée + dérive du vent (plus le jet est haut, plus il dérive)
function pointChute(c, vent){
  const m = CATALOGUE[c.modele], s = SUPPORTS[c.support || 'trepied'], cv = CONFIG.vent;
  const portee = m.portee * s.portee, hauteur = s.hauteur + 2;
  const derive = vent.force / 3.6 * (hauteur / cv.vitesseChute) * cv.entrainement;
  return { x:c.x + Math.sin(c.dir) * portee + Math.sin(vent.dir) * derive, y:c.y + Math.cos(c.dir) * portee + Math.cos(vent.dir) * derive, rayon:5 + portee * .25, derive };
}
// Part (0 à 1) de la zone enneigée qui tombe sur une piste, et sur laquelle
function partSurPiste(dom, x, y, rayon){
  let dessus = 0, total = 0; const par = {};
  for(const [nb, f] of [[1, 0], [6, .5], [12, 1]]) for(let i = 0; i < nb; i++){
    const a = i / nb * Math.PI * 2 + f, p = pisteSous(dom, x + Math.cos(a) * rayon * f, y + Math.sin(a) * rayon * f);
    total++; if(p){ dessus++; par[p.nom] = (par[p.nom] || 0) + 1; }
  }
  for(const k in par) par[k] /= total;
  return { part:dessus / total, par };
}
// Fonctionnement de tous les canons à l'instant u de la nuit (u = null : le jour, pour prévoir les pressions)
// Les pompes sont en automatique : juste assez de pompes, et la pression de départ ne dépasse pas 52 bar.
// Tant qu'un canon ouvert manque de pression, on ferme le plus défavorisé et on recalcule.
function regime(dom, res, meteo, u){
  const cp = CONFIG.pompage, eau = alimentes(res, 'eau'), elec = alimentes(res, 'cable'), L = longueursEau(res);
  const pomp = noeud(res, 'pompage'), altSalle = dom.alt(pomp.x, pomp.y);
  const jour = u === null, T = jour ? null : temperature(meteo, u), vent = jour ? { force:0, dir:0 } : ventA(meteo, u);
  const sec = res.retenue.volume <= 0;
  const canons = res.noeuds.filter(n => n.type === 'regard').map(n => {
    const c = n.canon, pret = eau.has(n.id) && elec.has(n.id);
    const Tc = jour ? null : temperatureA(dom, T, n.x, n.y), fT = jour ? 1 : facteurTemperature(Tc);
    const veut = c.mode === 'marche' || (c.mode === 'auto' && (jour || fT > 0));
    const chute = pointChute({ ...c, x:n.x, y:n.y }, vent), sp = partSurPiste(dom, chute.x, chute.y, chute.rayon);
    return { id:n.id, n, modele:c.modele, mode:c.mode, pret, T:Tc, fT, ouvert:pret && veut && !sec, voulu:pret && veut,
      longueur:L.get(n.id) || 0, denivele:dom.alt(n.x, n.y) - altSalle, chute, part:sp.part, par:sp.par,
      pression:0, zone:'arret', fP:0, debit:0, production:0, etat:'' };
  });
  let pompes = 0, pDepart = 0, demande = 0;
  for(let k = 0; k <= canons.length; k++){
    demande = canons.reduce((s, c) => s + (c.ouvert ? CATALOGUE[c.modele].debit : 0), 0);
    pompes = Math.min(cp.pompes, Math.ceil(demande / cp.debitNominal));
    pDepart = pompes ? Math.min(pressionPompes(demande, pompes), cp.pressionNominale) : 0;
    for(const c of canons){
      const m = CATALOGUE[c.modele];
      c.pression = pompes ? Math.max(0, pDepart - c.longueur / 100 * CONFIG.pression.perteLongueur - c.denivele / 10 * CONFIG.pression.perteDenivele - demande * CONFIG.pression.perteDebit) : 0;
      c.zone = zonePression(c.pression, m);
      c.fP = c.ouvert ? facteurPression(c.pression, m) : 0;
    }
    const enDefaut = canons.filter(c => c.ouvert && c.fP === 0);
    if(!enDefaut.length) break;
    enDefaut.sort((a, b) => a.pression - b.pression)[0].ouvert = false;
  }
  for(const c of canons){
    const m = CATALOGUE[c.modele];
    c.debit = c.ouvert ? m.debit : 0;
    c.production = c.ouvert ? m.neige * c.fP * c.fT : 0;
    // ce qu'on affiche : vert en marche, rouge à l'arrêt, jaune en défaut
    c.etat = !c.pret ? 'defaut' : sec && c.voulu ? 'defaut' : c.ouvert ? (c.production > 0 || jour ? 'marche' : 'chaud') : c.voulu ? 'defaut' : 'arret';
    c.raison = !c.pret ? `Il manque ${etatRegard(res, c.id).manque.join(' et ')}` : sec && c.voulu ? 'Retenue vide' :
      c.voulu && !c.ouvert ? (c.zone === 'surpression' ? 'Surpression : mis en sécurité' : 'Pas assez de pression') :
      c.ouvert && !jour && c.fT === 0 ? 'Trop chaud : il fait de l\'eau, pas de neige' :
      c.mode === 'auto' && !jour && c.fT === 0 ? 'En attente du froid (auto)' : c.mode === 'arret' ? 'Arrêté' : '';
  }
  const debit = canons.reduce((s, c) => s + c.debit, 0);
  return { u, T, vent, canons, debit, demande, pompes, pDepart, capacite:pompes * cp.debitNominal, sec,
    production:canons.reduce((s, c) => s + c.production, 0) };
}

/* ---------- La nuit ---------- */
function debutNuit(dom, res){
  res.numero = res.nuit + 1;
  res.enCours = { t:0, neige:0, piste:0, hors:0, eau:0, kwh:0, parPiste:{}, chaud:0 };
  return meteoNuit(dom, res.numero);
}
// Avance la nuit de dt secondes de jeu avec le régime en cours
function avancerNuit(dom, res, reg, dt){
  const N = res.enCours, h = dt / CONFIG.nuit.duree * 12;    // heures écoulées
  N.t += dt;
  const eau = Math.min(res.retenue.volume, reg.debit * h);
  res.retenue.volume -= eau; N.eau += eau;
  N.kwh += reg.pompes * CONFIG.pompage.puissance * h;
  for(const c of reg.canons){
    if(!c.ouvert) continue;
    if(c.production <= 0){ N.chaud += c.debit * h; continue; }
    const v = c.production * h;
    N.neige += v; N.piste += v * c.part; N.hors += v * (1 - c.part);
    for(const k in c.par) N.parPiste[k] = (N.parPiste[k] || 0) + v * c.par[k];
    deposer(res, c.chute.x, c.chute.y, c.chute.rayon, v);
  }
}
// Les tas de neige : on regroupe ce qui tombe au même endroit
function deposer(res, x, y, r, v){
  let t = res.tas.find(q => Math.hypot(q.x - x, q.y - y) < 3);
  if(!t){ t = { x, y, r, v:0 }; res.tas.push(t); }
  const tot = t.v + v; t.x = (t.x * t.v + x * v) / tot; t.y = (t.y * t.v + y * v) / tot; t.r = Math.max(t.r, r); t.v = tot;
}
function finNuit(dom, res){
  const N = res.enCours, c = CONFIG;
  const gain = Math.round(N.piste * c.gains.parM3Piste), elec = Math.round(N.kwh * c.electricite.prixKwh);
  // la retenue se remplit pendant la journée (payant)
  const remplir = Math.max(0, Math.min(res.retenue.remplissage, dom.retenue.max - res.retenue.volume));
  const prixEau = Math.round(remplir * c.retenue.prixM3);
  res.retenue.volume += remplir;
  const avant = res.neigePiste;
  res.neigePiste += N.piste; res.neigeTotale += N.neige;
  for(const k in N.parPiste) res.parPiste[k] = (res.parPiste[k] || 0) + N.parPiste[k];
  res.budget += gain - elec - prixEau;
  res.nuit = res.numero;
  const debloques = Object.keys(CATALOGUE).filter(k => CATALOGUE[k].debloque > avant && CATALOGUE[k].debloque <= res.neigePiste);
  const b = { nuit:res.nuit, neige:Math.round(N.neige), piste:Math.round(N.piste), hors:Math.round(N.hors), parPiste:{ ...N.parPiste },
    gain, elec, eau:prixEau, remplissage:Math.round(remplir), chaud:Math.round(N.chaud), debloques, net:gain - elec - prixEau };
  for(const k in b.parPiste) b.parPiste[k] = Math.round(b.parPiste[k]);
  res.bilans.push(b);
  delete res.enCours;
  if(res.nuit >= dom.nuits) res.fini = true;
  return b;
}
function etoiles(dom, res){ const f = res.neigePiste / dom.objectif; return CONFIG.etoiles.filter(s => f >= s).length; }

/* ---------- Vérifications (index.html?test, ou Node) ---------- */
function testsSimulation(){
  const ok = [], ko = [];
  const verif = (nom, cond) => (cond ? ok : ko).push(nom);
  for(const t of Object.keys(CONFIG.domaines)){
    const d1 = creerDomaine(t, 1234), d2 = creerDomaine(t, 1234);
    verif(`${t} : même graine = même domaine`, d1.nom === d2.nom && d1.pistes.length === d2.pistes.length && Math.abs(d1.alt(50, 60) - d2.alt(50, 60)) < 1e-9);
    verif(`${t} : des pistes`, d1.pistes.length >= 1 && d1.pistes.every(p => p.points.length > 10));
    verif(`${t} : le haut est plus haut que le bas`, d1.alt(d1.W / 2, 30) > d1.alt(d1.W / 2, d1.front) + 25);
    verif(`${t} : la salle n'est pas sur la retenue`, Math.hypot(d1.salle.x - d1.retenue.x, d1.salle.y - d1.retenue.y) > d1.retenue.r + 10);
  }
  const dom = creerDomaine('marmottes', 42), res = creerReseau(dom);
  const p = dom.pistes[0], q = p.points[Math.floor(p.points.length * .6)];
  const x = q[0] + p.largeur / 2 + 6, y = q[1];
  verif('regard posable au bord de la piste', !refusRegard(dom, res, x, y));
  const n = poserRegard(dom, res, x, y);
  verif('regard payé', res.budget === dom.budget - 5000 - 10000);
  verif('canon tourné vers la piste', Math.abs(n.canon.dir) <= Math.PI);
  verif('trop près refusé', !!refusRegard(dom, res, x + 3, y));
  const dv = devisTranchee(dom, res, noeud(res, 'pompage'), n, { eau:true, cable:true });
  verif('devis tranchée commune', dv.prix === Math.round(dv.longueur ? Math.hypot(noeud(res, 'pompage').x - x, noeud(res, 'pompage').y - y) * CONFIG.couts.trancheeCommune : 0));
  ajouterTranchee(res, 'pompage', n.id, { eau:true, cable:false });
  verif('sans câble : pas prêt', !etatRegard(res, n.id).pret);
  ajouterTranchee(res, 'pompage', n.id, { eau:false, cable:true });
  verif('eau + câble : prêt', etatRegard(res, n.id).pret);
  const meteo = { soir:-3, min:-9, redoux:null, sautes:[{ t:0, force:0, dir:0 }] };
  const r1 = regime(dom, res, meteo, .6), c1 = r1.canons[0];
  verif('produit par grand froid', c1.production > 0 && r1.pompes === 1);
  verif('la pression baisse en montant', c1.pression < CONFIG.pompage.pressionNominale);
  const chaud = { soir:3, min:2, redoux:null, sautes:[{ t:0, force:0, dir:0 }] };
  verif('auto : rien au-dessus de −2 °C', regime(dom, res, chaud, .5).canons[0].ouvert === false);
  n.canon.mode = 'marche';
  const r2 = regime(dom, res, chaud, .5);
  verif('marche forcée au chaud : de l\'eau, pas de neige', r2.canons[0].ouvert && r2.canons[0].production === 0 && r2.canons[0].etat === 'chaud');
  n.canon.mode = 'arret'; verif('arrêté : fermé', !regime(dom, res, meteo, .5).canons[0].ouvert);
  n.canon.mode = 'auto';
  verif('température : 0 à −2 °C, 0,5 à −4 °C, 1 à −7 °C', facteurTemperature(-2) === 0 && Math.abs(facteurTemperature(-4) - .5) < 1e-9 && facteurTemperature(-8) === 1);
  verif('plus haut = plus froid', temperatureA(dom, -3, 100, 20) < temperatureA(dom, -3, 100, dom.front));
  const m1 = meteoNuit(dom, 3), m2 = meteoNuit(dom, 3);
  verif('même nuit = même météo', JSON.stringify(m1) === JSON.stringify(m2));
  verif('nuit froide au milieu', temperature(m1, .7) < temperature(m1, 0) || m1.redoux);
  const vent = { force:30, dir:Math.PI / 2 };
  verif('le vent déporte la neige', pointChute({ ...n.canon, x, y }, vent).x > pointChute({ ...n.canon, x, y }, { force:0, dir:0 }).x + 5);
  // une nuit complète
  debutNuit(dom, res);
  for(let t = 0; t < CONFIG.nuit.duree; t += .5) avancerNuit(dom, res, regime(dom, res, meteo, t / CONFIG.nuit.duree), .5);
  const b = finNuit(dom, res);
  verif('une nuit produit de la neige', b.neige > 100 && b.piste > 0 && res.tas.length > 0);
  verif('la neige sur piste rapporte', b.gain === Math.round(b.piste * 20) || Math.abs(b.gain - b.piste * 20) <= 20);
  verif('la retenue a servi puis s\'est remplie', res.retenue.volume <= dom.retenue.max);
  const d = demonter(res, n.id);
  verif('démonter rend de l\'argent et retire les tranchées', d.rendu > 0 && !res.tranchees.some(t => t.a === n.id || t.b === n.id));
  return { ok, ko };
}
if(typeof module !== 'undefined') module.exports = { testsSimulation };
