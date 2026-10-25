/* Paddock : la piste en direct (essais libres, qualifications Q1/Q2/Q3, course), sur les 24 circuits de circuits.js.
   Chaque voiture avance le long de la trajectoire idéale, à la vitesse du circuit multipliée par son « rythme »
   (voiture, pilote, réglages, pneus, consignes, batterie, pluie). Une voiture rattrapée reste derrière, sauf si elle réussit
   un dépassement dans une ligne droite. R.K convertit le temps du jeu en vrais temps de Formule 1 (calé sur le temps de la pole). */
window.PaddockCourse = (() => {
  const P = window.Piste;
  const PI = Math.PI;
  const NC = 48;                                   // points de chronométrage par tour (pour les écarts)
  const LONG = 11;                                 // longueur d'une voiture (unités)
  const ECART_MIN = 13;                            // distance minimale derrière une voiture
  const ECHELLE = LONG / 26;                       // le dessin de la voiture fait 26 unités de long
  const LIMITEUR = 81;                             // 80 km/h dans la voie des stands (unités par seconde)
  const hasard = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const choix = t => t[Math.floor(Math.random() * t.length)];
  const virg = (n, d = 1) => n.toFixed(d).replace('.', ',');
  // hasard reproductible (le même décor, le même réglage idéal à chaque fois)
  function hasardDe(txt){ let h = 2166136261; for(const ch of txt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

  /* ---------- Les pneus, le rythme et la batterie ---------- */
  const PNEUS = {
    S:{ nom:'Tendres', court:'T', col:'#E8343A', rythme:.009, usure:.088, sec:true },
    M:{ nom:'Mediums', court:'M', col:'#F5C518', rythme:.0045, usure:.058, sec:true },
    H:{ nom:'Durs', court:'D', col:'#F4F4F4', rythme:0, usure:.04, sec:true },
    I:{ nom:'Intermédiaires', court:'I', col:'#2DB34A', rythme:0, usure:.045, sec:false },
    P:{ nom:'Pluie', court:'P', col:'#2F6FE0', rythme:0, usure:.04, sec:false },
  };
  // les trains de pneus pour le week-end (par pilote)
  const JEUX = { S:6, M:3, H:2, I:4, P:3 };
  const MODES = { eco:{ nom:'Économie', ico:'🐢', rythme:-.006, usure:.7, risque:.6 }, normal:{ nom:'Normal', ico:'🏁', rythme:0, usure:1, risque:1 }, attaque:{ nom:'Attaque', ico:'🔥', rythme:.006, usure:1.4, risque:1.7 } };
  // la batterie : flux = charge gagnée (ou perdue) par tour
  const ERS = { recharge:{ nom:'Recharge', ico:'🔋', rythme:-.004, flux:.45, dep:1 }, normal:{ nom:'Normal', ico:'⚡', rythme:0, flux:0, dep:1 }, boost:{ nom:'Dépassement', ico:'🚀', rythme:.0075, flux:-1.1, dep:1.7 } };
  const perteUsure = u => u < .45 ? u * .006 : .0027 + (u - .45) ** 2 * .09 + (u > 1 ? .05 : 0);
  function rythmeMeteo(type, w){
    if(type === 'I') return -Math.abs(w - .45) * .06 - (w < .2 ? (.2 - w) * .2 : 0);
    if(type === 'P') return -Math.abs(w - .8) * .04 - (w < .45 ? (.45 - w) * .16 : 0);
    return -Math.pow(w, .8) * .14;
  }
  const usureMeteo = (type, w) => type === 'I' ? (w < .2 ? 3 : 1) : type === 'P' ? (w < .35 ? 3 : 1) : 1 + w * .5;
  const pneuPluie = w => w > .65 ? 'P' : w > .25 ? 'I' : null;

  /* ---------- Les réglages de la voiture ---------- */
  const REGLAGES = {
    av:{ nom:'Aileron avant', ico:'🔺', bas:'Peu d\'appui', haut:'Beaucoup d\'appui',
      moins:'L\'avant manque d\'appui : la voiture sous-vire dans les virages.', plus:'Trop d\'appui à l\'avant : l\'arrière devient nerveux.' },
    ar:{ nom:'Aileron arrière', ico:'🔻', bas:'Vitesse de pointe', haut:'Appui',
      moins:'L\'arrière glisse dans les virages rapides.', plus:'Trop d\'appui : on perd de la vitesse dans les lignes droites.' },
    susp:{ nom:'Suspension', ico:'🌀', bas:'Souple', haut:'Rigide',
      moins:'Trop souple : la voiture roule et manque de précision.', plus:'Trop rigide : elle saute sur les bosses et les vibreurs.' },
    haut:{ nom:'Hauteur de caisse', ico:'↕️', bas:'Basse', haut:'Haute',
      moins:'Trop basse : le fond touche la piste.', plus:'Trop haute : on perd l\'appui du fond plat.' },
    carr:{ nom:'Carrossage', ico:'📐', bas:'Faible', haut:'Fort',
      moins:'Pas assez de carrossage : peu d\'adhérence en virage.', plus:'Trop de carrossage : les pneus s\'usent vite.' },
  };
  // le réglage idéal dépend du circuit, et un peu des goûts du pilote
  function reglageIdeal(c, idPilote){
    const T = circuitCourse(c), rc = hasardDe('r' + c.id), rp = hasardDe(c.id + idPilote), dc = () => (rc() - .5), dp = () => (rp() - .5);
    const ar = 78 - T.puissance * 95 + dc() * 16 + dp() * 10;
    return {
      av:clamp(Math.round(ar + dc() * 14 + dp() * 22), 5, 95), ar:clamp(Math.round(ar), 5, 95),
      susp:clamp(Math.round((c.ville ? 32 : 62) + dc() * 26 + dp() * 14), 5, 95),
      haut:clamp(Math.round((c.ville ? 62 : 36) + dc() * 24 + dp() * 12), 5, 95),
      carr:clamp(Math.round(40 + T.abrasion * 14 + dc() * 26 + dp() * 14), 5, 95),
    };
  }
  // la confiance du pilote dans la voiture (0 à 1)
  function confiance(reg, ideal){
    const ks = Object.keys(REGLAGES);
    return ks.reduce((t, k) => t + Math.max(0, 1 - (Math.abs(reg[k] - ideal[k]) / 32) ** 1.5), 0) / ks.length;
  }
  const bonusReglage = conf => (conf - .75) * .014;
  // ce que la voiture ressent quand l'écart au réglage idéal est connu à « largeur » près
  function connaissanceDepart(c, idPilote, largeur){
    const ideal = reglageIdeal(c, idPilote), res = {};
    for(const k of Object.keys(REGLAGES)){ const lo = clamp(Math.round(ideal[k] - Math.random() * largeur), 0, 100 - largeur); res[k] = [lo, lo + largeur]; }
    return res;
  }
  // après une série de tours : l'avis du pilote, et la zone conseillée qui se resserre
  // qualite : de 0 (pilote brouillon, ingénieur débutant) à 1
  function retourPilote(c, idPilote, reg, connu, tours, qualite){
    const ideal = reglageIdeal(c, idPilote), lignes = [], tol = 3 + (1 - qualite) * 7;
    for(const k of Object.keys(REGLAGES)){
      const d = reg[k] - ideal[k], R = REGLAGES[k];
      const [lo, hi] = connu[k], larg = hi - lo;
      const nl = Math.max(4, Math.round(larg * Math.pow(.72 - qualite * .18, Math.min(6, tours))));
      const a = clamp(Math.round(ideal[k] - Math.random() * nl), Math.max(0, lo), Math.min(hi, 100) - nl);
      connu[k] = [clamp(a, 0, 100 - nl), clamp(a, 0, 100 - nl) + nl];
      const ad = Math.abs(d);
      const note = ad <= tol ? 3 : ad <= 10 ? 2 : ad <= 20 ? 1 : 0;
      lignes.push({ k, note, txt:note === 3 ? 'Parfait, je ne toucherais à rien.' : (d < 0 ? R.moins : R.plus) + (note === 2 ? ' (un peu)' : note === 0 ? ' (beaucoup !)' : '') });
    }
    return { lignes, confiance:confiance(reg, ideal) };
  }

  /* ---------- Le circuit prêt pour la course ---------- */
  const CACHE = {};
  const A_LAT = 36, A_FR = 40, A_AC = 11;          // adhérence, freinage et accélération en m/s²
  const ENTREE = .05, SORTIE = .045;               // la voie des stands : sur les derniers et les premiers mètres du tour
  const lisse = t => t * t * (3 - 2 * t);
  // la trajectoire : un ruban tendu entre les bords de la piste
  function ruban(piste, lim, iter){
    const n = piste.pts.length, nor = piste.cap.map(a => [-Math.sin(a), Math.cos(a)]);
    let off = new Array(n).fill(0);
    for(let it = 0; it < iter; it++){
      const pos = piste.pts.map((p, i) => [p[0] + nor[i][0] * off[i], p[1] + nor[i][1] * off[i]]);
      off = off.map((o, i) => {
        const a = pos[(i - 3 + n) % n], b = pos[(i + 3) % n];
        const cible = ((a[0] + b[0]) / 2 - piste.pts[i][0]) * nor[i][0] + ((a[1] + b[1]) / 2 - piste.pts[i][1]) * nor[i][1];
        return clamp(o + (cible - o) * .5, -lim, lim);
      });
    }
    return piste.pts.map((p, i) => [p[0] + nor[i][0] * off[i], p[1] + nor[i][1] * off[i]]);
  }
  function profil(pts, F){
    const n = pts.length, kappa = P.courbure(pts);
    const v = kappa.map(k => Math.min(P.VMAX, Math.sqrt(A_LAT * F / Math.max(k, 1e-6))));
    for(let pass = 0; pass < 2; pass++){
      for(let i = n - 1; i >= 0; i--){ const nx = v[(i + 1) % n]; v[i] = Math.min(v[i], Math.sqrt(nx * nx + 2 * A_FR * F * P.STEP)); }
      for(let i = 0; i < n; i++){ const pr = v[(i - 1 + n) % n]; v[i] = Math.min(v[i], Math.sqrt(pr * pr + 2 * A_AC * F * (1 - .5 * pr / P.VMAX) * P.STEP)); }
    }
    return v;
  }
  function circuitCourse(c){
    if(CACHE[c.id]) return CACHE[c.id];
    const LARG = c.larg || 14, F = 13.66 / c.s;           // F : passer des m/s² aux unités du cadre
    const piste = P.construire(c);
    let best = null;
    for(const [marge, iter] of [[2.5, 300], [3.5, 300]]){
      const pts = P.resample(ruban(piste, LARG / 2 - marge, iter), P.STEP, true), v = profil(pts, F), t = P.tempsTour(v);
      if(!best || t < best.t) best = { pts, v, t };
    }
    const { pts, v } = best, n = pts.length;
    const cap = pts.map((p, i) => { const q = pts[(i + 1) % n]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    const kappa = P.courbure(piste.pts), virage = kappa.reduce((s, k) => s + k, 0) / kappa.length;
    const puissance = v.filter(x => x > P.VMAX * .93).length / n;
    const T = { c, piste, kappa, pts, v, cap, n, L:n * P.STEP, tempsTour:best.t, LARG, F, puissance, abrasion:clamp(.85 + virage * 30, .85, 1.2) };
    // le temps affiché : calé pour que la pole ressemble à la vraie
    T.K = (c.pole || 80) / (T.tempsTour / 1.03);
    T.stands = voieStands(T);
    // le temps perdu par un arrêt (voie des stands au limiteur, moins le même bout de piste à fond), sans l'arrêt lui-même
    const S = T.stands; let tPiste = 0;
    for(let k = -S.nE; k <= S.nS; k++){ const i = Math.floor(((k / piste.pts.length * n) % n + n) % n); tPiste += (T.L / piste.pts.length) / Math.max(30, v[i]); }
    T.pertePit = (S.tot * P.STEP) / LIMITEUR * 1.08 - tPiste;
    return CACHE[c.id] = T;
  }
  // la voie des stands : parallèle à la ligne droite des stands, avec une entrée et une sortie en douceur,
  // du côté où il y a le plus de place (sans toucher une autre partie du circuit)
  function voieStands(T){
    const piste = T.piste, C = piste.pts, n = C.length, LARG = T.LARG;
    const nor = C.map((_, i) => { let x = 0, y = 0; for(let d = -6; d <= 6; d++){ const a = piste.cap[(i + d + n) % n]; x += -Math.sin(a); y += Math.cos(a); } const l = Math.hypot(x, y) || 1; return [x / l, y / l]; });
    const nE = Math.round(n * ENTREE), nS = Math.round(n * SORTIE), tot = nE + nS;
    const cx = C.reduce((t, p) => t + p[0], 0) / n, cy = C.reduce((t, p) => t + p[1], 0) / n;
    const essai = (cote, plein) => {
      const pts = [], offs = []; let mauvais = 0;
      for(let k = -nE; k <= nS; k++){
        const i = (k + n) % n, t = (k + nE) / tot;
        const o = plein * (t < .25 ? lisse(t / .25) : t > .75 ? lisse((1 - t) / .25) : 1);
        const q = [C[i][0] + nor[i][0] * cote * o, C[i][1] + nor[i][1] * cote * o];
        pts.push(q); offs.push(o);
        // la place pour les garages, derrière la voie
        const g = [C[i][0] + nor[i][0] * cote * (o + 12), C[i][1] + nor[i][1] * cote * (o + 12)];
        if(g[0] < 4 || g[0] > P.W - 4 || g[1] < 4 || g[1] > P.H - 4) mauvais += .3;
        for(let m = 0; m < n; m += 2){
          const dk = Math.min(Math.abs(m - i), n - Math.abs(m - i)); if(dk < 12) continue;
          const lim = LARG / 2 + 6;
          if(Math.hypot(C[m][0] - q[0], C[m][1] - q[1]) < lim || (o > plein * .9 && Math.hypot(C[m][0] - g[0], C[m][1] - g[1]) < lim + 2)){ mauvais++; break; }
        }
      }
      const dehors = pts.reduce((t, q, j) => { const i = ((j - nE) + n) % n; return t + Math.hypot(q[0] - cx, q[1] - cy) - Math.hypot(C[i][0] - cx, C[i][1] - cy); }, 0) / pts.length;
      return { cote, plein, pts, offs, mauvais, dehors };
    };
    let best = null;
    const cotes = T.c.standsCote ? [T.c.standsCote] : [1, -1];
    for(const plein of [LARG / 2 + 9, LARG / 2 + 7]) for(const cote of cotes){ const e = essai(cote, plein);
      if(!best || e.mauvais < best.mauvais - .01 || (Math.abs(e.mauvais - best.mauvais) <= .01 && e.plein === best.plein && e.dehors > best.dehors)) best = e; }
    return { ...best, nE, nS, tot, nor };
  }
  function pointStand(S, k){
    const j = clamp(k + S.nE, 0, S.tot), a = Math.floor(j), b = Math.min(S.tot, a + 1), f = j - a;
    const p = S.pts[a], q = S.pts[b];
    return { x:p[0] + (q[0] - p[0]) * f, y:p[1] + (q[1] - p[1]) * f, a:Math.atan2(q[1] - p[1], q[0] - p[0]) || 0 };
  }
  // où en est une voiture sur la voie des stands (en indices de la ligne centrale)
  function kStand(T, v){ const L = T.L, f = (((v.s % L) + L) % L) / L; return (f > .5 ? f - 1 : f) * T.piste.pts.length; }
  const kBox = (T, box) => { const S = T.stands; return -S.nE + S.tot * (.27 + .48 * box / 9); };
  const sDeK = (T, k) => k / T.piste.pts.length * T.L;

  /* ---------- La météo ---------- */
  // meteo : { pluie, debut, duree, force } en tours de course ; meteo.seances : { EL, Q } (piste mouillée de 0 à 1)
  const mouille = (R, t = R.t) => {
    if(R.seance) return R.seance.w;
    const m = R.meteo; if(!m || !m.pluie) return 0;
    const tourT = R.T.tempsTour * 1.08, x = t / tourT;
    const d = m.debut, f = m.debut + m.duree;
    if(x < d - 1) return 0;
    if(x < d + .8) return clamp((x - d + 1) / 1.8, 0, 1) * m.force;
    if(x < f) return m.force;
    return clamp(m.force * (1 - (x - f) / 2.2), 0, 1);
  };

  /* ---------- Préparer une séance ou une course ---------- */
  // voitures : [{ id, nom, court, ecurie, c1, c2, logo, joueur, base, regularite, pneus, depassement, pluie, fiabilite, mecanos, ingenieur, reglage }]
  // seance : null (course) ou { type:'EL' | 'Q1' | 'Q2' | 'Q3', minutes, participants:[ids], w }
  // options : { pannes:1, sc:true }
  function preparer({ circuit, voitures, tours, meteo, seance = null, options = {} }){
    const T = circuitCourse(circuit);
    const R = { T, K:T.K, tours, meteo, seance:null, options:{ pannes:1, sc:true, ...options }, t:0, phase:'grille', feux:0, passages:new Map(), evenements:[], sc:null, drapeau:false,
      meilleurTour:null, meilleursSect:[null, null, null], arrives:0, alertes:{}, wetMax:0 };
    R.voitures = voitures.map((v, i) => ({ ...v, s:0, vit:0, etat:'grille', pneu:'M', usure:0, mode:'normal', ers:'normal', batt:.85, utilises:new Set(), agePneu:0,
      tour:0, dernierPassage:0, meilleurTour:null, tempsTours:[], arrets:0, demande:null, auto:!v.joueur, lat:0, latCible:0, depasse:null, bruit:0, retard:0,
      ecart:0, penalite:0, fin:null, abandon:null, degats:0, cp:0, grille:i + 1, sect:[null, null, null], dernSect:[null, null, null], bestSect:[null, null, null], debutSect:0,
      jeux:v.jeux || Object.entries(JEUX).flatMap(([t, nb]) => Array.from({ length:nb }, () => ({ t, u:0 }))) }));
    const equipes = [...new Set(voitures.map(v => v.ecurie))];
    R.equipes = equipes;
    R.couleursEquipes = Object.fromEntries(voitures.map(v => [v.ecurie, [v.c1, v.c2]]));
    for(const v of R.voitures) v.box = equipes.indexOf(v.ecurie);
    if(seance) demarrerSeance(R, seance);
    return R;
  }
  // le rythme d'une voiture (1 = vitesse du circuit) hors consignes
  function rythmeBase(R, v, pneu, usure, w){
    let f = v.base + bonusReglage(v.reglage ?? .75) + PNEUS[pneu].rythme + rythmeMeteo(pneu, w) - perteUsure(usure) - w * .09;
    if(w > .2) f += (v.pluie - 86) * .0007 * w;
    return f;
  }
  const usureParTour = (R, v, pneu) => PNEUS[pneu].usure * (17 / (R.tours || 17)) * R.T.abrasion * (1.25 - v.pneus / 400) * MODES[v.mode].usure * (1 + Math.max(0, (v.carrossage || 0)) * .25);

  // l'instant exact où la voiture a passé la distance sLigne pendant ce pas (pour des chronos précis)
  const tPassage = (R, v, sLigne) => R.t - Math.max(0, v.s - sLigne) / Math.max(1, v.vit);

  /* ---------- Les séances (essais libres et qualifications) ---------- */
  function demarrerSeance(R, s){
    R.seance = { type:s.type, duree:s.minutes * 60, reste:s.minutes * 60, w:s.w || 0, participants:new Set(s.participants || R.voitures.map(v => v.id)), evolution:0 };
    R.phase = 'seance'; R.t = 0;
    const T = R.T;
    for(const v of R.voitures){
      v.meilleur = null; v.toursSeance = []; v.plan = null; v.toursFaits = 0;
      if(!R.seance.participants.has(v.id)){ v.etat = 'elimine'; continue; }
      v.etat = 'garage'; v.s = sDeK(T, kBox(T, v.box)); v.vit = 0; v.lat = 0;
      // le programme des autres écuries : deux sorties (trois en essais libres)
      const d = R.seance.duree, lt = T.tempsTour * R.K;
      v.prog = s.type === 'EL' ? [d * hasard(.82, .95), d * hasard(.45, .6), d * hasard(.12, .25)]
        : [d * hasard(.62, .9), Math.min(d * hasard(.2, .32), lt * hasard(1.9, 2.6) + 30)];
    }
  }
  const tempsAffiche = (R, t) => t * R.K;
  // sortir une voiture du garage : { pneu, tours (tours rapides), risque }
  function sortir(R, v, { pneu = null, tours = 1, risque = false } = {}){
    if(!R.seance || v.etat !== 'garage' || R.drapeau) return false;
    const w = R.seance.w;
    pneu = pneu || pneuPluie(w) || 'S';
    // le train le moins usé de ce type
    const jeu = v.jeux.filter(j => j.t === pneu).sort((a, b) => a.u - b.u)[0];
    if(!jeu) return false;
    v.jeu = jeu; v.pneu = pneu; v.usure = jeu.u;
    v.plan = { type:'lancement', restants:clamp(tours, 1, 8), risque };
    v.etat = 'sortie'; v.mode = 'normal';
    return true;
  }
  function rentrer(R, v){ if(v.etat === 'piste' && v.plan) { v.plan.type = 'rentree'; return true; } return false; }
  // l'évolution de la piste : elle se gomme et va plus vite au fil de la séance (et du week-end)
  const evolution = R => R.seance ? (1 - R.seance.reste / R.seance.duree) * .0035 + ({ EL:0, Q1:.001, Q2:.0018, Q3:.0025 }[R.seance.type] || 0) : .003;
  function pasSeance(R, dt){
    const S = R.seance, T = R.T, w = S.w;
    R.t += dt;
    if(!R.drapeau){ S.reste -= dt * R.K; if(S.reste <= 0){ S.reste = 0; R.drapeau = true; evenement(R, '🏁 Drapeau à damier : fin de la séance (on finit le tour en cours).'); } }
    // les autres écuries suivent leur programme
    for(const v of R.voitures){
      if(v.etat !== 'garage' || R.drapeau) continue;
      if((!v.joueur || v.auto) && v.prog.length && S.reste <= v.prog[0]){
        v.prog.shift();
        if(S.type !== 'EL' && v.prog.length === 0 && v.meilleur && !v.joueur){
          // sûr de passer ? alors on garde des pneus
          const rang = classementSeance(R).findIndex(x => x.v === v) + 1, lim = S.type === 'Q1' ? 15 : S.type === 'Q2' ? 10 : 99;
          if(rang <= lim - 4 && Math.random() < .5) continue;
        }
        const neufs = v.jeux.filter(j => j.t === 'S' && j.u === 0).length;
        const pneu = pneuPluie(w) || (S.type === 'EL' ? choix(['S', 'M', 'H', 'M']) : neufs ? 'S' : 'S');
        sortir(R, v, { pneu, tours:S.type === 'EL' ? Math.round(hasard(3, 8)) : Math.random() < .3 ? 2 : 1, risque:!v.joueur && Math.random() < .3 });
      }
    }
    // les vitesses voulues
    for(const v of R.voitures){
      if(!['sortie', 'piste', 'stand'].includes(v.etat)) continue;
      const pos = ((v.s % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n; v.i = i;
      let f = rythmeBase(R, v, v.pneu, v.usure, w) + evolution(R);
      if(v.plan){
        if(v.plan.type === 'lancement') f *= .9;
        else if(v.plan.type === 'rentree') f *= .84;
        else f += (v.plan.risque ? .003 : 0) + v.bruit;
      }
      if(v.gene > 0){ v.gene -= dt; f *= .93; }
      v.f = f;
      let cible = T.v[i] * f;
      if(v.etat !== 'piste') cible = Math.min(cible, LIMITEUR);
      if(v.etat === 'stand' && v.arret && v.arret.phase === 'arret') cible = 0;
      v.cible = cible;
    }
    // la circulation : on ne double pas une voiture en tour rapide ; une voiture lente laisse passer (parfois elle gêne)
    const enPiste = R.voitures.filter(v => v.etat === 'piste').sort((a, b) => b.s - a.s);
    for(let k = 0; k < enPiste.length; k++){
      const v = enPiste[k];
      for(let m = 0; m < enPiste.length; m++){
        const dv = enPiste[m]; if(dv === v) continue;
        let d = ((dv.s - v.s) % T.L + T.L) % T.L; if(d > ECART_MIN + 20) continue;
        const rapide = v.plan && v.plan.type === 'rapide', devantRapide = dv.plan && dv.plan.type === 'rapide';
        if(rapide && !devantRapide){
          dv.latCible = dv.lat >= 0 ? T.LARG * .32 : -T.LARG * .32; v.latCible = -dv.latCible * .5;
          const cle = dv.id + '>' + v.id + ':' + v.toursFaits;
          if(!R.alertes[cle]){ R.alertes[cle] = 1; if(Math.random() < .22){ v.gene = hasard(.15, .45); if(v.joueur || dv.joueur) evenement(R, `⚠️ ${v.court} gêné par ${dv.court} dans son tour rapide`, v.joueur ? 'mal' : ''); } }
        } else if(d < ECART_MIN) v.cible = Math.min(v.cible, dv.vit);
      }
    }
    for(const v of R.voitures){
      if(!['sortie', 'piste', 'stand'].includes(v.etat)) continue;
      avancer(R, v, dt);
      if(v.etat === 'piste'){
        if(v.plan && v.plan.type !== 'rentree' || !v.plan) usureSeance(R, v, dt, w);
        v.lat += (v.latCible - v.lat) * Math.min(1, dt * 3); v.latCible *= Math.max(0, 1 - dt * .8);
      }
    }
    if(R.drapeau && R.voitures.every(v => ['garage', 'elimine', 'accident'].includes(v.etat))) R.phase = 'fin';
  }
  function usureSeance(R, v, dt, w){ v.usure += usureParTour(R, v, v.pneu) * usureMeteo(v.pneu, w) / (R.T.tempsTour * 1.05) * dt * (v.plan && v.plan.type === 'lancement' ? .4 : 1); }
  // avancer sur la piste ou dans la voie des stands
  function avancer(R, v, dt){
    const T = R.T, F = T.F;
    // une voiture plus rapide accélère et freine plus fort (le profil de vitesse est multiplié par son rythme)
    const f2 = Math.max(.5, v.f || 1) ** 2;
    const acc = v.vit < v.cible ? A_AC * F * (1 - .5 * v.vit / (P.VMAX * (v.f || 1))) * 1.1 * f2 : -A_FR * F * 1.4 * f2;
    v.vit = v.vit < v.cible ? Math.min(v.cible, v.vit + acc * dt) : Math.max(v.cible, v.vit + acc * dt);
    const avant = v.s; v.s += v.vit * dt;
    if(R.seance){
      if(v.etat === 'sortie' || v.etat === 'stand') standSeance(R, v, dt, avant);
      else { chronoSeance(R, v, avant); entreeSeance(R, v, avant); }
    } else {
      chronometrer(R, v, avant);
      if(v.etat === 'stand') stand(R, v, dt); else entreeStand(R, v, avant);
    }
  }
  function standSeance(R, v, dt, avant){
    const T = R.T, k = kStand(T, v);
    if(v.etat === 'sortie' && k >= T.stands.nS - 1 && k < T.stands.nS + 40){ v.etat = 'piste'; v.lat = 0; v.latCible = 0; v.debutTour = null; }
    if(v.etat === 'stand' && k >= kBox(T, v.box) && k < T.stands.nS){
      // de retour au garage
      v.etat = 'garage'; v.vit = 0; v.s = Math.round(v.s / T.L) * T.L + sDeK(T, kBox(T, v.box));
      if(v.jeu) v.jeu.u = v.usure;
      const run = v.plan && v.plan.run; v.plan = null;
      if(R.onGarage) R.onGarage(v, run);
    }
  }
  function entreeSeance(R, v, avant){
    if(!v.plan || v.plan.type !== 'rentree') return;
    const L = R.T.L, a = ((avant % L) + L) % L, b = ((v.s % L) + L) % L, seuil = L * (1 - ENTREE);
    if(a < seuil && b >= seuil){ v.etat = 'stand'; v.latCible = 0; v.lat = 0; }
  }
  // un passage sur la ligne en séance : début du tour rapide, temps du tour, et la suite du programme
  function chronoSeance(R, v, avant){
    const T = R.T, L = T.L, pl = v.plan; if(!pl) return;
    // les temps intermédiaires
    for(let j = 1; j <= 2; j++){ const sj = L * j / 3, a = ((avant % L) + L) % L, b = ((v.s % L) + L) % L;
      if(a < sj && b >= sj && pl.type === 'rapide' && v.debutTour != null){ const tc = R.t - (b - sj) / Math.max(1, v.vit); v.sect[j - 1] = tc - v.debutSect; v.debutSect = tc; } }
    if(Math.floor(v.s / L) <= Math.floor(avant / L)) return;
    const tl = tPassage(R, v, Math.floor(v.s / L) * L);
    if(pl.type === 'rapide' && v.debutTour != null){
      const t = tl - v.debutTour; v.sect[2] = tl - v.debutSect;
      const valide = !v.horsPiste;
      pl.run = pl.run || { tours:0, temps:[] }; pl.run.tours++; pl.run.temps.push(valide ? t : null);
      v.toursSeance.push({ t, valide, pneu:v.pneu, sect:v.sect.slice() });
      v.toursFaits++; if(v.jeu) v.jeu.tours = (v.jeu.tours || 0) + 1;
      if(valide){
        v.dernSect = v.sect.slice();
        v.sect.forEach((st, j) => { if(st != null){ if(!v.bestSect[j] || st < v.bestSect[j]) v.bestSect[j] = st; if(!R.meilleursSect[j] || st < R.meilleursSect[j]) R.meilleursSect[j] = st; } });
        const record = !v.meilleur || t < v.meilleur;
        if(record) v.meilleur = t;
        if(!R.meilleurTour || t < R.meilleurTour.temps){ R.meilleurTour = { id:v.id, temps:t }; if(R.seance.type !== 'EL') evenement(R, `⏱️ ${v.court} prend la tête : ${chrono(t * R.K)}`, v.joueur ? 'bon' : ''); }
        else if(v.joueur && record) evenement(R, `⏱️ ${v.court} : ${chrono(t * R.K)}, ${placeSeance(R, v)}e`, 'bon');
      } else if(v.joueur) evenement(R, `🚩 ${v.court} : tour annulé (limites de piste)`, 'mal');
      pl.restants--;
    }
    // la suite du programme : on ne peut plus commencer un tour après le drapeau à damier
    if(pl.type === 'lancement') pl.type = 'rapide';
    else if(pl.type === 'rapide' && pl.restants <= 0) pl.type = 'rentree';
    if(pl.type === 'rapide' && R.drapeau) pl.type = 'rentree';
    if(pl.type === 'rapide'){
      v.debutTour = tl; v.debutSect = tl; v.sect = [null, null, null];
      v.bruit = gauss() * (100 - v.regularite) * .00012;
      // une erreur ? (tour annulé ou temps perdu)
      const w = R.seance.w, p = (100 - v.regularite) / 100 * .3 * (pl.risque ? 2.2 : 1) * (1 + w * 1.5);
      v.horsPiste = 0;
      if(Math.random() < p){ if(Math.random() < .55){ v.horsPiste = 1; } else { v.bruit -= hasard(.004, .02); if(v.joueur) evenement(R, `😬 ${v.court} fait une petite erreur dans ce tour`, 'mal'); } }
    }
  }
  function classementSeance(R){
    return R.voitures.filter(v => R.seance.participants.has(v.id))
      .sort((a, b) => (a.meilleur ?? 1e9) - (b.meilleur ?? 1e9) || a.grille - b.grille)
      .map((v, i, l) => ({ v, place:i + 1, temps:v.meilleur, ecart:v.meilleur && l[0].meilleur ? v.meilleur - l[0].meilleur : null }));
  }
  const placeSeance = (R, v) => classementSeance(R).findIndex(x => x.v === v) + 1;
  // terminer la séance d'un coup (les voitures du joueur font leurs sorties automatiquement si besoin)
  function simulerSeance(R, auto = true){
    if(auto) for(const v of R.voitures) if(v.joueur && !v.meilleur && v.prog) v.auto = true;
    let n = 0; while(R.phase !== 'fin' && n < 300000){ pasSeance(R, 1 / 30); n++; }
  }

  /* ---------- La course ---------- */
  function placerGrille(R, ordreIds){
    if(ordreIds) ordreIds.forEach((id, i) => { const v = R.voitures.find(x => x.id === id); if(v) v.grille = i + 1; });
    R.seance = null; R.phase = 'grille'; R.t = 0; R.drapeau = false; R.passages = new Map(); R.meilleurTour = null; R.meilleursSect = [null, null, null]; R.alertes = {};
    for(const v of R.voitures){
      v.etat = 'grille'; v.s = -(v.grille - 1) * 16 - 8; v.lat = v.grille % 2 ? -3.5 : 3.5; v.latCible = 0; v.vit = 0; v.tour = 0; v.plan = null;
      v.sect = [null, null, null]; v.dernSect = [null, null, null]; v.bestSect = [null, null, null]; v.meilleurTour = null; v.tempsTours = [];
    }
    R.voitures.sort((a, b) => a.grille - b.grille);
  }
  // des qualifications rapides (sans les voir) : trois séances simulées
  function qualifRapide(R, choixRisque = {}){
    const w = R.seance ? R.seance.w : mouille(R, 0), res = [];
    for(const v of R.voitures){
      const pneu = pneuPluie(w) || 'S';
      let best = Infinity, erreur = false;
      for(let essai = 0; essai < 3; essai++){
        const risque = (choixRisque[v.id] || (v.joueur ? 'prudent' : Math.random() < .3 ? 'risque' : 'prudent')) === 'risque';
        let f = rythmeBase(R, v, pneu, 0, w) + evolution(R) + essai * .0008 + (risque ? .003 : 0) + gauss() * (100 - v.regularite) * .0001;
        let t = R.T.tempsTour / f;
        if(Math.random() < (risque ? .16 : .06) * (1 + w * 2)){ t *= hasard(1.006, 1.03); erreur = true; }
        best = Math.min(best, t);
      }
      res.push({ id:v.id, temps:best, erreur });
    }
    res.sort((a, b) => a.temps - b.temps);
    return res;
  }
  function choisirPneusDepart(R, v){
    const w = mouille(R, 0), pl = pneuPluie(w);
    if(pl) return pl;
    if(v.joueur && v.pneuDepart) return v.pneuDepart;
    return v.grille <= 10 ? (Math.random() < .55 ? 'M' : 'S') : (Math.random() < .5 ? 'H' : 'M');
  }
  // monter un train de pneus (le moins usé du type demandé)
  function monter(v, type){
    const jeu = v.jeux.filter(j => j.t === type && j !== v.jeu).sort((a, b) => a.u - b.u)[0];
    if(v.jeu) v.jeu.u = Math.max(v.jeu.u, v.usure);
    v.jeu = jeu || { t:type, u:0 }; if(!jeu) v.jeux.push(v.jeu);
    v.pneu = type; v.usure = v.jeu.u; v.agePneu = v.jeu.tours || 0;
  }
  const toursRestants = (R, v) => R.tours - v.tour;
  function strategieAuto(R, v){
    if(v.demande || v.etat !== 'course') return;
    const w = mouille(R), reste = toursRestants(R, v);
    v.seuilPluie = v.seuilPluie ?? hasard(.25, .4); v.seuilSec = v.seuilSec ?? hasard(.12, .22);
    if(PNEUS[v.pneu].sec && w > v.seuilPluie && reste > 1){ v.demande = w > .7 ? 'P' : 'I'; return; }
    if(v.pneu === 'I' && w > .78 && reste > 2){ v.demande = 'P'; return; }
    if(v.pneu === 'P' && w < .5 && reste > 2){ v.demande = 'I'; return; }
    if(!PNEUS[v.pneu].sec && w < v.seuilSec && reste > 1){ v.demande = choixSec(R, v, reste); return; }
    const seuil = v.seuilUsure ?? (v.seuilUsure = hasard(.66, .8));
    if(v.usure > seuil && reste > 2) v.demande = choixSec(R, v, reste);
    else if(PNEUS[v.pneu].sec && R.wetMax < .3 && reste === 2 && secsUtilises(v) < 2) v.demande = v.pneu === 'S' ? 'M' : 'S';
    // la voiture de sécurité : une bonne occasion
    else if(R.sc && v.usure > .4 && reste > 3 && Math.random() < .7) v.demande = choixSec(R, v, reste);
  }
  // la batterie des autres (et des nôtres en mode auto)
  function ersAuto(R, v, devant, derriere){
    const T = R.T, gapD = devant ? (devant.s - v.s) / Math.max(60, v.vit) * R.K : 9, gapA = derriere ? (v.s - derriere.s) / Math.max(60, v.vit) * R.K : 9;
    if(v.batt < .12) v.ers = 'recharge';
    else if((gapD < 1 || gapA < .6) && v.batt > .3 && !R.sc) v.ers = 'boost';
    else if(v.batt < .45 || R.sc) v.ers = 'recharge';
    else v.ers = 'normal';
  }
  const secsUtilises = v => [...v.utilises].filter(p => PNEUS[p].sec).length;
  function choixSec(R, v, reste){
    if(mouille(R) > .25) return 'I';
    const options = ['S', 'M', 'H'].filter(p => usureParTour(R, v, p) * reste < .9);
    let c = options.length ? options[0] : 'H';
    if(secsUtilises(v) < 2 && c === v.pneu && R.wetMax < .3) c = options.find(p => p !== v.pneu) || (v.pneu === 'H' ? 'M' : 'H');
    return c;
  }
  // les conseils de l'ingénieur pour nos pilotes
  function conseil(R, v){
    if(v.auto || v.demande || v.etat !== 'course') return null;
    const w = mouille(R), reste = toursRestants(R, v), prevu = mouille(R, R.t + R.T.tempsTour * (1 + v.ingenieur * .6));
    if(PNEUS[v.pneu].sec && w > .3) return 'La piste est mouillée : rentre pour des intermédiaires !';
    if(!PNEUS[v.pneu].sec && w < .15 && reste > 1) return 'La piste sèche : rentre pour des pneus secs !';
    if(PNEUS[v.pneu].sec && prevu > .3 && w < .1) return 'L\'ingénieur voit la pluie arriver d\'ici peu.';
    if(v.usure > .8 && reste > 1) return 'Pneus très usés : il faut rentrer au stand !';
    if(R.sc && v.usure > .35 && reste > 3) return 'Voiture de sécurité : c\'est le moment de s\'arrêter !';
    if(v.usure > .65 && reste > 3) return 'Pneus usés : pense à l\'arrêt au stand.';
    if(PNEUS[v.pneu].sec && R.wetMax < .3 && secsUtilises(v) < 2 && reste <= 4) return 'Règle : il faut utiliser deux types de pneus secs. Prévois un arrêt !';
    if(v.batt < .1 && v.ers === 'boost') return 'Batterie vide : repasse en mode normal ou recharge.';
    return null;
  }
  function pas(R, dt){
    if(R.seance) return pasSeance(R, dt);
    R.t += dt;
    const T = R.T, w = mouille(R);
    R.wetMax = Math.max(R.wetMax, w);
    if(R.phase === 'grille'){
      R.feux += dt;
      if(R.feux >= 3.2){ R.phase = 'course'; R.t = 0; for(const v of R.voitures){ v.etat = 'course'; monter(v, choisirPneusDepart(R, v)); v.utilises.add(v.pneu); v.retard = hasard(0, .35) * (1.1 - v.regularite / 100) * 3; v.dernierPassage = 0; v.debutSect = 0; } evenement(R, 'Départ !'); }
      else return;
    }
    const leader = R.voitures.filter(v => v.etat === 'course' || v.etat === 'stand').sort((a, b) => b.s - a.s)[0];
    if(R.sc && leader && leader.tour >= R.sc.fin){ R.sc = null; evenement(R, '🟢 La voiture de sécurité rentre : la course reprend !'); }
    for(const v of R.voitures){
      if(v.etat === 'abandon') continue;
      if(v.etat === 'fini'){ v.vit = Math.max(60, v.vit - 80 * dt); v.s += v.vit * dt; continue; }
      if(v.retard > 0){ v.retard -= dt; v.cible = 0; continue; }
      const pos = ((v.s % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n;
      v.i = i;
      // la batterie
      if(v.ers === 'boost' && v.batt <= 0){ v.ers = 'normal'; if(v.joueur) evenement(R, `🔋 ${v.court} : batterie vide`, 'conseil'); }
      const E = ERS[v.ers];
      v.batt = clamp(v.batt + E.flux / (T.tempsTour * 1.05) * dt * (R.sc ? 0 : 1) + (R.sc ? .04 * dt : 0), 0, 1);
      // l'essence : la voiture est plus lourde en début de course
      const essence = .028 * clamp(1 - v.tour / R.tours, 0, 1);
      let f = rythmeBase(R, v, v.pneu, v.usure, w) + MODES[v.mode].rythme + (v.batt > 0 ? E.rythme : 0) + v.bruit + evolution(R) - essence;
      v.f = R.sc ? .62 : f;
      let cible = T.v[i] * f;
      if(R.sc) cible = Math.min(cible, T.v[i] * .62);
      if(v.etat === 'stand') cible = v.arret.phase === 'arret' ? 0 : Math.min(cible, LIMITEUR);
      v.cible = cible;
    }
    // l'ordre sur la piste, et les voitures qui se suivent
    const enPiste = R.voitures.filter(v => v.etat === 'course').sort((a, b) => b.s - a.s);
    for(let k = 0; k < enPiste.length; k++){
      const v = enPiste[k], devant = enPiste[k - 1];
      if(v.auto && v.tour >= 1) ersAuto(R, v, devant, enPiste[k + 1]);
      if(!devant) continue;
      const d = devant.s - v.s;
      if(v.depasse && v.depasse.cible === devant.id){
        v.depasse.t += dt;
        if(v.depasse.t > 2.2){ v.depasse = null; v.latCible = 0; }
        else { v.cible *= 1.01; continue; }
      }
      const droite = T.v[v.i ?? 0] > P.VMAX * .86, uneSeconde = v.vit / R.K;
      // l'aspiration et le DRS dans les lignes droites, à moins d'une seconde
      if(!R.sc && droite && d < uneSeconde && v.tour >= 1) v.cible *= 1.013;
      if(d < ECART_MIN + 14){
        const plusVite = v.cible > devant.cible * 1.004;
        if(!R.sc && droite && plusVite && d < ECART_MIN + 10){
          const chance = clamp((v.cible / devant.cible - 1) * 90 * (v.depassement / devant.depassement) ** 2 * ERS[v.ers].dep / (devant.batt > 0 && devant.ers === 'boost' ? 1.5 : 1), 0, 4) * dt;
          if(Math.random() < chance){ v.depasse = { cible:devant.id, t:0 }; v.latCible = Math.random() < .5 ? -5.5 : 5.5; if(v.joueur || devant.joueur || k <= 3) evenement(R, `${v.court} dépasse ${devant.court}`, v.joueur ? 'bon' : devant.joueur ? 'mal' : ''); continue; }
        }
        if(d < ECART_MIN) v.cible = Math.min(v.cible, devant.vit * (d < ECART_MIN - 4 ? .9 : 1));
      }
    }
    for(const v of R.voitures){
      if(v.etat !== 'course' && v.etat !== 'stand') continue;
      avancer(R, v, dt);
      v.lat += (v.latCible - v.lat) * Math.min(1, dt * 3);
      if(!v.depasse && v.etat === 'course') v.latCible = 0;
      if(v.etat === 'course') usure(R, v, dt, w);
    }
    if(R.drapeau && R.voitures.every(v => v.etat === 'fini' || v.etat === 'abandon')) R.phase = 'fin';
  }
  function chronometrer(R, v, avant){
    const T = R.T, L = T.L;
    if(v.s < 0) return;
    const cp0 = Math.floor(Math.max(0, avant) / (L / NC)), cp1 = Math.floor(v.s / (L / NC));
    for(let c = cp0 + 1; c <= cp1; c++){
      const tc = tPassage(R, v, c * L / NC);
      if(!R.passages.has(c)) R.passages.set(c, tc);
      v.ecart = tc - R.passages.get(c); v.cp = c;
      // les secteurs
      if(c % (NC / 3) === 0 && c % NC !== 0){ const j = (c % NC) / (NC / 3) - 1; v.sect[j] = tc - v.debutSect; v.debutSect = tc; }
    }
    const t0 = Math.floor(Math.max(0, avant) / L), t1 = Math.floor(v.s / L);
    if(t1 > t0 && avant >= 0){
      v.tour = t1; v.agePneu++; if(v.jeu) v.jeu.tours = v.agePneu;
      const tl = tPassage(R, v, t1 * L);
      const temps = tl - v.dernierPassage; v.dernierPassage = tl;
      v.sect[2] = tl - v.debutSect; v.debutSect = tl;
      v.tempsTours.push(temps);
      if(v.tour > 1){
        v.dernSect = v.sect.slice();
        v.sect.forEach((st, j) => { if(st != null){ if(!v.bestSect[j] || st < v.bestSect[j]) v.bestSect[j] = st; if(!R.meilleursSect[j] || st < R.meilleursSect[j]) R.meilleursSect[j] = st; } });
        if(!v.meilleurTour || temps < v.meilleurTour) v.meilleurTour = temps;
        if(!R.meilleurTour || temps < R.meilleurTour.temps) R.meilleurTour = { id:v.id, temps };
      }
      v.sect = [null, null, null];
      v.bruit = gauss() * (100 - v.regularite) * .00012;
      if(!R.drapeau && v.tour >= R.tours){ R.drapeau = true; evenement(R, `🏁 ${v.nom} gagne la course !`, v.joueur ? 'bon' : ''); }
      if(R.drapeau && v.etat === 'course'){ v.etat = 'fini'; v.fin = tl; R.arrives++; v.place = R.arrives; return; }
      incidents(R, v);
      if(v.auto) strategieAuto(R, v);
      if(v.joueur){ const c = conseil(R, v); if(c && R.alertes[v.id] !== c){ R.alertes[v.id] = c; evenement(R, `🎧 ${v.court} : ${c}`, 'conseil'); } }
    }
  }
  function usure(R, v, dt, w){
    const parSeconde = usureParTour(R, v, v.pneu) * usureMeteo(v.pneu, w) / (R.T.tempsTour * 1.05);
    v.usure += parSeconde * dt * (R.sc ? .3 : 1);
    if(v.usure > 1.05 && Math.random() < dt * .25 && !v.crevaison){
      v.crevaison = true; v.demande = v.demande || choixSec(R, v, toursRestants(R, v)); v.usure = 1.6; v.degats += .2; evenement(R, `💥 Crevaison pour ${v.nom} !`, v.joueur ? 'mal' : '');
    }
  }
  function incidents(R, v){
    if(v.etat !== 'course') return;
    const w = mouille(R), mauvais = PNEUS[v.pneu].sec ? w : (v.pneu === 'I' ? Math.max(0, .15 - w) * 4 : Math.max(0, .4 - w) * 3);
    const panne = (100 - v.fiabilite) / 100 * .009 * (1.2 - v.mecanos * .06) * R.options.pannes * (17 / R.tours);
    const sortie = (100 - v.regularite) / 100 * .008 * (1 + mauvais * 10 + w * 2) * MODES[v.mode].risque * (17 / R.tours) * (1.15 - (v.reglage ?? .75) * .2);
    if(Math.random() < panne){ abandon(R, v, choix(['Moteur cassé', 'Boîte de vitesses', 'Problème hydraulique', 'Freins', 'Électronique', 'Batterie hybride'])); }
    else if(Math.random() < sortie){
      if(Math.random() < .55){ abandon(R, v, 'Sortie de piste, voiture dans le mur'); v.degats += 1.5; v.accident = true;
        if(R.options.sc && !R.sc && toursRestants(R, v) > 2){ R.sc = { fin:v.tour + 2 }; evenement(R, '🚨 Voiture de sécurité ! Bonne occasion pour s\'arrêter au stand.', 'sc'); } }
      else { v.retard = hasard(1.2, 2.5); v.usure += .08; evenement(R, `${v.court} part en tête-à-queue et repart`, v.joueur ? 'mal' : ''); }
    }
  }
  function abandon(R, v, raison){
    v.etat = 'abandon'; v.abandon = raison; v.vit = 0; v.latCible = -(R.T.LARG / 2 + 9); v.lat = v.latCible;
    evenement(R, `❌ Abandon de ${v.nom} : ${raison}`, v.joueur ? 'mal' : '');
  }
  function entreeStand(R, v, avant){
    if(!v.demande || v.etat !== 'course' || R.drapeau) return;
    const L = R.T.L, a = ((avant % L) + L) % L, b = ((v.s % L) + L) % L, seuil = L * (1 - ENTREE);
    if(a < seuil && b >= seuil && v.s > L * .5){ v.etat = 'stand'; v.arret = { phase:'voie', t:0 }; v.latCible = 0; v.depasse = null; }
  }
  function stand(R, v, dt){
    const T = R.T, a = v.arret, k = kStand(T, v);
    if(a.phase === 'voie' && k >= kBox(T, v.box) && k < T.stands.nS){
      const ratage = Math.random() < .09 - v.mecanos * .015;
      a.phase = 'arret'; a.t = 0; a.duree = (hasard(2.1, 2.7) - v.mecanos * .12 - (v.standsNiv || 0) * .05 + (ratage ? hasard(2, 5) : 0)) / R.K;
      v.vit = 0;
      if(ratage) evenement(R, `🔧 Arrêt raté pour ${v.court} : un écrou bloqué !`, v.joueur ? 'mal' : '');
    } else if(a.phase === 'arret'){
      a.t += dt;
      if(a.t >= a.duree){
        const ancien = v.pneu;
        monter(v, v.demande); v.utilises.add(v.pneu); v.crevaison = false; v.demande = null; v.arrets++; v.seuilUsure = null;
        a.phase = 'sortie';
        if(v.joueur || R.voitures.indexOf(v) < 3) evenement(R, `${v.court} : arrêt en ${virg(a.duree * R.K)} s, ${PNEUS[ancien].nom.toLowerCase()} → ${PNEUS[v.pneu].nom.toLowerCase()}`, v.joueur ? 'stand' : '');
      }
    } else if(a.phase !== 'arret' && k >= T.stands.nS - 1 && k < T.stands.nS + 40){
      v.etat = 'course'; v.arret = null; v.latCible = 0; v.lat = 0;
    }
  }
  function evenement(R, txt, type = ''){
    const leader = R.voitures.reduce((m, v) => Math.max(m, v.tour), 0);
    R.evenements.unshift({ txt, type, tour:Math.min(R.tours || 0, leader + 1), t:R.t }); R.evenements = R.evenements.slice(0, 60);
  }

  /* ---------- Le classement en direct ---------- */
  function ordre(R){
    if(R.seance) return classementSeance(R).map(o => ({ ...o, ecartTxt:o.temps == null ? '—' : o.place === 1 ? chrono(o.temps * R.K) : '+' + virg(o.ecart * R.K, 3) }));
    const liste = R.voitures.slice();
    liste.sort((a, b) => {
      const ra = a.etat === 'abandon' ? 1 : 0, rb = b.etat === 'abandon' ? 1 : 0;
      if(ra !== rb) return ra - rb;
      if(ra) return b.s - a.s;
      if(a.etat === 'fini' && b.etat === 'fini') return a.place - b.place;
      if(a.etat === 'fini') return a.tour >= b.tour ? -1 : 1;
      if(b.etat === 'fini') return b.tour >= a.tour ? 1 : -1;
      if(R.phase === 'grille') return a.grille - b.grille;
      return b.s - a.s;
    });
    const tete = liste[0];
    return liste.map((v, i) => {
      let ecart = '', inter = '', ecartS = 0;
      if(v.etat === 'abandon'){ ecart = 'ABANDON'; inter = 'AB'; }
      else if(i === 0){ ecart = R.phase === 'grille' ? 'POLE' : `Tour ${Math.min(R.tours, Math.max(1, v.tour + (v.etat === 'fini' ? 0 : 1)))}`; inter = ecart; }
      else {
        const tours = Math.floor((tete.s - v.s) / R.T.L);
        ecartS = Math.max(0, v.ecart);
        ecart = tours >= 1 && v.etat !== 'fini' ? `+${tours} T` : `+${virg(ecartS * R.K)}`;
        if(v.etat === 'fini' && tete.etat === 'fini'){ ecartS = v.fin - tete.fin; ecart = v.tour < tete.tour ? `+${tete.tour - v.tour} T` : `+${virg(ecartS * R.K)}`; }
        const dv = liste[i - 1];
        const di = dv.etat === 'abandon' ? null : (dv.s - v.s) > R.T.L ? null : Math.max(0, v.ecart - dv.ecart);
        inter = R.phase === 'grille' ? '' : di == null ? `+${Math.floor((dv.s - v.s) / R.T.L)} T` : `+${virg(di * R.K)}`;
      }
      return { v, place:i + 1, ecart, inter, ecartS };
    });
  }
  // si la voiture s'arrêtait maintenant : où ressortirait-elle ?
  function prevoirArret(R, v){
    if(R.seance || v.etat !== 'course' || R.phase !== 'course') return null;
    const perte = R.T.pertePit * (R.sc ? .55 : 1) + 2.4 / R.K, moi = v.ecart + perte;
    const autres = R.voitures.filter(x => x !== v && (x.etat === 'course' || x.etat === 'stand'));
    const devant = autres.filter(x => x.ecart < moi), derriere = autres.filter(x => x.ecart >= moi);
    const juste = devant.sort((a, b) => b.ecart - a.ecart)[0], suivant = derriere.sort((a, b) => a.ecart - b.ecart)[0];
    return { place:devant.length + 1, perte:perte * R.K, devant:juste ? juste.court : null, ecartDevant:juste ? (moi - juste.ecart) * R.K : 0,
      derriere:suivant ? suivant.court : null, ecartDerriere:suivant ? (suivant.ecart - moi) * R.K : 0 };
  }
  // le résultat final : temps, pénalités (un seul type de pneus secs), abandons
  function resultat(R){
    const pen = R.wetMax < .3;
    const fini = R.voitures.filter(v => v.etat === 'fini');
    for(const v of fini) if(pen && secsUtilises(v) < 2){ v.penalite = 30 / R.K; v.notePen = '+30 s (un seul type de pneus)'; }
    fini.sort((a, b) => b.tour - a.tour || (a.fin + a.penalite) - (b.fin + b.penalite));
    const ab = R.voitures.filter(v => v.etat === 'abandon').sort((a, b) => b.s - a.s);
    const liste = [...fini, ...ab];
    const tete = fini[0];
    return liste.map((v, i) => ({ pilote:v.id, nom:v.nom, ecurie:v.ecurie, place:i + 1, abandon:v.etat === 'abandon' ? v.abandon : null, accident:!!v.accident, arrets:v.arrets, degats:v.degats,
      meilleurTour:v.meilleurTour ? v.meilleurTour * R.K : null, penalite:v.notePen || null, grille:v.grille,
      ecart:v.etat === 'abandon' ? v.abandon : i === 0 ? chrono(v.fin * R.K) : v.tour < tete.tour ? `+${tete.tour - v.tour} tour${tete.tour - v.tour > 1 ? 's' : ''}` : `+${virg(((v.fin + v.penalite) - (tete.fin + tete.penalite)) * R.K)} s` }));
  }
  function chrono(s){ const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, '0').replace('.', ',')}`; }
  function simulerFin(R){ let n = 0; while(R.phase !== 'fin' && n < 300000){ pas(R, 1 / 30); n++; } }

  /* ---------- Le dessin : un style épuré, sombre, avec quelques détails de chaque circuit ---------- */
  const SOLS = { parc:'#18241C', campagne:'#1A251B', collines:'#1C241A', foret:'#152219', montagne:'#192320', prairie:'#20241A', desert:'#29241A', dunes:'#2A261C', ville:'#1B1E25', mer:'#1A1F25', fleuve:'#18221E' };
  const chemin = (pts, ferme = true) => { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if(ferme) p.closePath(); return p; };
  // les éléments du décor (dans le cadre 1000 × 600) : voir « d » dans circuits.js
  function scene(R){
    const T = R.T; if(T.scene && T.scene.equipes === R.equipes.join()) return T.scene;
    const c = T.c, C = T.piste.pts, n = C.length, S = T.stands, LARG = T.LARG;
    const portion = (a, b) => { const l = []; for(let i = a; i <= b; i++) l.push(C[((i % n) + n) % n]); return l; };
    const morceaux = (seuil, marge) => {
      const res = []; let cur = null;
      for(let i = 0; i <= n; i++){ const k = T.kappa[i % n], dans = k > seuil;
        if(dans && !cur) cur = [i]; else if(!dans && cur){ res.push([cur[0] - marge, i + marge]); cur = null; } }
      if(cur) res.push([cur[0] - marge, n + marge]);
      return res.map(([a, b]) => chemin(portion(a, b), false));
    };
    const sc = { equipes:R.equipes.join(), piste:chemin(C), vibreurs:morceaux(.012, 2), graviers:morceaux(.016, 4), voie:chemin(S.pts, false), garages:[], decor:c.d || [] };
    // les garages, un par écurie, derrière la voie des stands
    const plein = []; for(let k = -S.nE; k <= S.nS; k++){ if(S.offs[k + S.nE] > S.plein * .98) plein.push(k); }
    const bande = (d1, d2, ka, kb) => { const pts = []; for(let k = ka; k <= kb; k++){ const i = (k + n) % n; pts.push([C[i][0] + S.nor[i][0] * S.cote * d1, C[i][1] + S.nor[i][1] * S.cote * d1]); }
      for(let k = kb; k >= ka; k--){ const i = (k + n) % n; pts.push([C[i][0] + S.nor[i][0] * S.cote * d2, C[i][1] + S.nor[i][1] * S.cote * d2]); } return chemin(pts); };
    if(plein.length > 4){
      const k0 = Math.round(kBox(T, -.6)), k1 = Math.round(kBox(T, 9.6));
      sc.batiment = bande(S.plein + 4.5, S.plein + 13, k0, k1);
      sc.muret = bande(LARG / 2 + 2, LARG / 2 + 3.2, k0 - 4, k1 + 4);
      R.equipes.forEach((e, g) => { const ka = Math.round(kBox(T, g - .45)), kb = Math.round(kBox(T, g + .45));
        sc.garages.push({ e, p:bande(S.plein + 5, S.plein + 11, ka, kb), bord:bande(S.plein + 5, S.plein + 6.3, ka, kb) }); });
    }
    // les secteurs : de petits traits de couleur au bord de la piste
    sc.secteurs = [1, 2].map(j => { const i = Math.floor(n * j / 3), a = T.piste.cap[i]; return { x:C[i][0], y:C[i][1], a, col:j === 1 ? '#3FA9F5' : '#FFC93C' }; });
    // le pont (le circuit en huit) et le tunnel : la portion qui passe dessus, redessinée par-dessus
    if(c.pont) sc.pont = chemin(portion(Math.round(c.pont[0] * n), Math.round(c.pont[1] * n)), false);
    if(c.tunnel) sc.tunnel = chemin(portion(Math.round(c.tunnel[0] * n), Math.round(c.tunnel[1] * n)), false);
    return T.scene = sc;
  }
  function dessinerDecor(g, d, nuit, sol){
    for(const el of d){
      const [type, ...a] = el;
      g.save();
      if(type === 'ile'){ g.fillStyle = nuit ? '#0E1B2C' : '#14304A'; g.fillRect(-1000, -1000, P.W + 2000, P.H + 2000); g.fillStyle = sol; g.fill(chemin(a[0])); g.strokeStyle = 'rgba(120,180,230,.3)'; g.lineWidth = 2; g.stroke(chemin(a[0])); }
      else if(type === 'eau'){ g.fillStyle = nuit ? '#0E1B2C' : '#14304A'; g.fill(chemin(a[0])); g.strokeStyle = 'rgba(120,180,230,.25)'; g.lineWidth = 1.5; g.stroke(chemin(a[0])); }
      else if(type === 'riviere'){ g.strokeStyle = nuit ? '#0E1B2C' : '#14304A'; g.lineWidth = a[1] || 8; g.lineJoin = g.lineCap = 'round'; g.stroke(chemin(a[0], false)); }
      else if(type === 'sable'){ g.fillStyle = '#3A3424'; g.fill(chemin(a[0])); }
      else if(type === 'bois'){ g.fillStyle = '#12301E'; for(const [x, y, r] of a[0]){ g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
      else if(type === 'bat'){ g.fillStyle = a[1] || '#2C323D'; g.fill(chemin(a[0])); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.stroke(chemin(a[0])); }
      else if(type === 'piste'){ g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = a[1] || 10; g.lineJoin = g.lineCap = 'round'; g.stroke(chemin(a[0], false)); }
      else if(type === 'roue'){ const [x, y, r] = a; g.strokeStyle = '#C9D3E0'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
        for(let k = 0; k < 12; k++){ const t = k / 12 * 2 * PI; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); g.stroke(); g.fillStyle = choix(['#E63946', '#FFC93C', '#3FA9F5']); g.fillRect(x + Math.cos(t) * r - 1.5, y + Math.sin(t) * r - 1.5, 3, 3); } }
      else if(type === 'sphere'){ const [x, y, r] = a, gr = g.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); gr.addColorStop(0, '#FFE66D'); gr.addColorStop(.5, '#FF6B9A'); gr.addColorStop(1, '#5B2A86'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.shadowColor = '#FF6B9A'; g.shadowBlur = 18; g.fill(); }
      else if(type === 'tour'){ const [x, y, r] = a; g.fillStyle = '#C8102E'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y, r * .55, 0, 7); g.stroke(); }
      else if(type === 'stade'){ const [x, y, rx, ry, rot] = a; g.translate(x, y); g.rotate(rot || 0); g.strokeStyle = '#3C4656'; g.lineWidth = 9; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.stroke();
        g.strokeStyle = '#E63946'; g.lineWidth = 2; g.setLineDash([2, 2]); g.beginPath(); g.ellipse(0, 0, rx + 2, ry + 2, 0, 0, 7); g.stroke(); g.setLineDash([]); g.fillStyle = '#1F5A2E'; g.beginPath(); g.ellipse(0, 0, rx - 5, ry - 5, 0, 0, 7); g.fill(); }
      else if(type === 'remparts'){ g.strokeStyle = '#7A6A4F'; g.lineWidth = 4; g.lineJoin = 'miter'; g.stroke(chemin(a[0], false)); g.strokeStyle = '#5A4C36'; g.lineWidth = 7; g.setLineDash([3, 3]); g.stroke(chemin(a[0], false)); g.setLineDash([]); }
      else if(type === 'yachts'){ g.fillStyle = '#F2F4F8'; for(const [x, y, r] of a[0]){ g.save(); g.translate(x, y); g.rotate(r || 0); g.beginPath(); g.moveTo(-6, -2); g.lineTo(4, -2); g.lineTo(7, 0); g.lineTo(4, 2); g.lineTo(-6, 2); g.closePath(); g.fill(); g.restore(); } }
      else if(type === 'lumieres'){ g.fillStyle = 'rgba(255,230,160,.85)'; g.shadowColor = '#FFD27A'; g.shadowBlur = 6; for(const [x, y] of a[0]){ g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } }
      else if(type === 'neons'){ g.lineCap = 'round'; g.lineWidth = 2.5; g.shadowBlur = 10; for(const [x, y, x2, y2, col] of a[0]){ g.strokeStyle = col; g.shadowColor = col; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); } }
      else if(type === 'texte'){ const [x, y, txt, taille, rot] = a; g.translate(x, y); g.rotate(rot || 0); g.fillStyle = 'rgba(255,255,255,.28)'; g.font = `800 ${taille || 12}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); }
      else if(type === 'hotel'){ const [x, y, w, h, rot] = a; g.translate(x, y); g.rotate(rot || 0); g.fillStyle = 'rgba(40,60,90,.75)'; g.fillRect(-w / 2, -h / 2, w, h);
        g.strokeStyle = '#7FD1FF'; g.lineWidth = 1; g.shadowColor = '#7FD1FF'; g.shadowBlur = 6; g.strokeRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0; g.strokeStyle = 'rgba(127,209,255,.4)'; for(let k = -w / 2 + 4; k < w / 2; k += 4){ g.beginPath(); g.moveTo(k, -h / 2); g.lineTo(k, h / 2); g.stroke(); } }
      else if(type === 'monts'){ for(const [x, y, r] of a[0]){ g.fillStyle = '#26302C'; g.beginPath(); g.moveTo(x - r, y + r * .6); g.lineTo(x, y - r * .7); g.lineTo(x + r, y + r * .6); g.closePath(); g.fill(); g.fillStyle = '#C9D3DA'; g.beginPath(); g.moveTo(x - r * .3, y - r * .3); g.lineTo(x, y - r * .7); g.lineTo(x + r * .3, y - r * .3); g.closePath(); g.fill(); } }
      else if(type === 'avions'){ g.fillStyle = '#AEB7C4'; for(const [x, y, rot] of a[0]){ g.save(); g.translate(x, y); g.rotate(rot); g.fillRect(-7, -1.2, 14, 2.4); g.fillRect(-1.5, -7, 3, 14); g.fillRect(-7, -3, 2, 6); g.restore(); } }
      g.restore();
    }
  }
  // dessiner la piste (et le décor), dans le repère du cadre 1000 × 600
  function dessinerPiste(R, g, e){
    const T = R.T, c = T.c, sc = scene(R), LARG = T.LARG, nuit = c.nuit;
    const sol = SOLS[c.decor] || '#1A1E25';
    g.fillStyle = sol; g.fillRect(-1000, -1000, P.W + 2000, P.H + 2000);
    if(nuit){ g.fillStyle = 'rgba(0,0,10,.35)'; g.fillRect(-1000, -1000, P.W + 2000, P.H + 2000); }
    // une grille discrète
    g.strokeStyle = 'rgba(255,255,255,.025)'; g.lineWidth = 1; g.beginPath(); for(let x = 0; x <= P.W; x += 50){ g.moveTo(x, -500); g.lineTo(x, P.H + 500); } for(let y = 0; y <= P.H; y += 50){ g.moveTo(-500, y); g.lineTo(P.W + 500, y); } g.stroke();
    dessinerDecor(g, sc.decor, nuit, sol);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // les dégagements et les bacs à gravier
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = LARG + 16; g.stroke(sc.piste);
    g.strokeStyle = '#3A3528'; g.lineWidth = LARG + 13; for(const m of sc.graviers) g.stroke(m);
    // la voie des stands, le bâtiment et les garages
    g.strokeStyle = '#2E333C'; g.lineWidth = 7; g.stroke(sc.voie);
    if(sc.batiment){ g.fillStyle = '#323844'; g.fill(sc.batiment);
      for(const ga of sc.garages){ const col = R.couleursEquipes[ga.e] || ['#888', '#ccc']; g.fillStyle = col[0]; g.fill(ga.p); g.fillStyle = col[1]; g.fill(ga.bord); }
      g.fillStyle = '#C9CED6'; g.fill(sc.muret); }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .6; g.setLineDash([3, 3]); g.stroke(sc.voie); g.setLineDash([]);
    // la piste : le bord, les vibreurs, le bitume, les lignes blanches
    g.strokeStyle = '#0F1115'; g.lineWidth = LARG + 4; g.stroke(sc.piste);
    g.lineCap = 'butt';
    for(const m of sc.vibreurs){ g.strokeStyle = '#F2F2F2'; g.lineWidth = LARG + 3.2; g.stroke(m); g.setLineDash([3.5, 3.5]); g.strokeStyle = '#D7263D'; g.stroke(m); g.setLineDash([]); }
    g.lineCap = 'round';
    const bitume = nuit ? '#4A505C' : '#454B56';
    g.strokeStyle = bitume; g.lineWidth = LARG; g.stroke(sc.piste);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = LARG - 1; g.stroke(sc.piste);
    g.strokeStyle = bitume; g.lineWidth = LARG - 2.2; g.stroke(sc.piste);
    // le pont : la portion du dessus, avec ses parapets
    if(sc.pont){ g.lineCap = 'butt'; g.strokeStyle = '#0B0C10'; g.lineWidth = LARG + 8; g.stroke(sc.pont); g.strokeStyle = '#C9CED6'; g.lineWidth = LARG + 5; g.stroke(sc.pont); g.strokeStyle = bitume; g.lineWidth = LARG; g.stroke(sc.pont); g.lineCap = 'round'; }
    // la grille de départ et la ligne en damier
    const C = T.piste.pts;
    for(let gr = 0; gr < 20; gr++){
      const sDist = -gr * 16 - 8, pos = ((sDist % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n, a = T.cap[i], lat = gr % 2 ? 3.5 : -3.5;
      const x = T.pts[i][0] - Math.sin(a) * lat, y = T.pts[i][1] + Math.cos(a) * lat;
      g.save(); g.translate(x, y); g.rotate(a); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .7;
      g.beginPath(); g.moveTo(4.5, -2.6); g.lineTo(5.5, -2.6); g.lineTo(5.5, 2.6); g.lineTo(4.5, 2.6); g.stroke(); g.restore();
    }
    const p0 = C[0], a0 = T.piste.cap[0];
    g.save(); g.translate(p0[0], p0[1]); g.rotate(a0);
    for(let j = -Math.ceil(LARG / 4); j < Math.ceil(LARG / 4); j++) for(let k = 0; k < 2; k++){ if(Math.abs(j * 2 + 1) > LARG / 2) continue; g.fillStyle = (j + k) % 2 ? '#111' : '#fff'; g.fillRect(k * 2 - 2, j * 2, 2, 2); }
    g.restore();
    // les secteurs
    for(const s of sc.secteurs){ g.save(); g.translate(s.x, s.y); g.rotate(s.a); g.fillStyle = s.col; g.fillRect(-1, -LARG / 2 - 6, 2, 4); g.fillRect(-1, LARG / 2 + 2, 2, 4); g.restore(); }
  }
  // une Formule 1 vue du dessus (longueur 26 unités, l'avant vers +x)
  function voiture(g, x, y, a, c1, c2, k = 1){
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(1.5, 1.8, 13.5, 7, 0, 0, 7); g.fill();
    const rect = (x0, y0, w, h, c, r = .8) => { g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, r) : g.rect(x0, y0, w, h); g.fillStyle = c; g.fill(); };
    for(const [cx, cy, l, w] of [[-8.5, -6.8, 5.6, 3.4], [-8.5, 6.8, 5.6, 3.4], [7.6, -6.3, 4.6, 2.8], [7.6, 6.3, 4.6, 2.8]]){
      rect(cx - l / 2, cy - w / 2, l, w, '#141414', 1.2); g.fillStyle = '#8A8A8A'; g.fillRect(cx - l / 2 + 1, cy - .35, l - 2, .7);
    }
    g.strokeStyle = '#2A2A2A'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(-8.5, -5); g.lineTo(-5, -2); g.moveTo(-8.5, 5); g.lineTo(-5, 2); g.moveTo(7.6, -5); g.lineTo(4, -1.4); g.moveTo(7.6, 5); g.lineTo(4, 1.4); g.stroke();
    g.fillStyle = '#262626'; g.beginPath(); g.moveTo(-11, -4.6); g.lineTo(-3, -5.6); g.lineTo(4, -3.4); g.lineTo(4, 3.4); g.lineTo(-3, 5.6); g.lineTo(-11, 4.6); g.closePath(); g.fill();
    rect(-13.5, -5.8, 3, 11.6, c1, .6); rect(-13.6, -6.2, 3.2, 1.2, c2, .3); rect(-13.6, 5, 3.2, 1.2, c2, .3);
    g.fillStyle = c1; g.beginPath(); g.moveTo(-10.5, -2.2); g.lineTo(-6, -4.6); g.lineTo(-1, -4.6); g.lineTo(2, -2.2); g.lineTo(10.5, -1.1); g.lineTo(12, 0); g.lineTo(10.5, 1.1); g.lineTo(2, 2.2); g.lineTo(-1, 4.6); g.lineTo(-6, 4.6); g.lineTo(-10.5, 2.2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = .5; g.stroke();
    g.fillStyle = c2; g.fillRect(-6, -4.5, 4.5, 1.1); g.fillRect(-6, 3.4, 4.5, 1.1); g.fillRect(2, -.45, 8.5, .9);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(-6, 0, 4.2, 1.6, 0, 0, 7); g.fill();
    g.fillStyle = '#121212'; g.beginPath(); g.ellipse(-.6, 0, 2.6, 1.7, 0, 0, 7); g.fill();
    g.fillStyle = c2; g.beginPath(); g.arc(-.9, 0, 1.15, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-.3, -.35, .5, .7);
    g.strokeStyle = '#3A3A3A'; g.lineWidth = .8; g.beginPath(); g.ellipse(0, 0, 2.9, 2, 0, -1.8, 1.8); g.stroke();
    rect(11.2, -6.6, 2.4, 13.2, c2, .6); rect(11.4, -6.8, 2.2, 1.4, c1, .3); rect(11.4, 5.4, 2.2, 1.4, c1, .3);
    g.restore();
  }
  // la position d'une voiture dans le cadre
  function placer(R, v){
    const T = R.T, pos = ((v.s % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n, f = (pos / P.STEP) % 1;
    const p = T.pts[i], q = T.pts[(i + 1) % T.n];
    let a = T.cap[i];
    let x = p[0] + (q[0] - p[0]) * f - Math.sin(a) * v.lat, y = p[1] + (q[1] - p[1]) * f + Math.cos(a) * v.lat;
    if(['stand', 'sortie', 'garage'].includes(v.etat)){
      const S = T.stands, k = kStand(T, v), j = clamp(k + S.nE, 0, S.tot), m = pointStand(S, k);
      const b = v.etat === 'garage' ? 1 : clamp(Math.min(j, S.tot - j) / (S.tot * .12), 0, 1);
      x = x + (m.x - x) * b; y = y + (m.y - y) * b;
      let da = m.a - a; while(da > PI) da -= 2 * PI; while(da < -PI) da += 2 * PI; a += da * b;
      if(v.etat === 'garage'){ const nn = T.piste.pts.length, ii = ((Math.round(k) % nn) + nn) % nn, no = S.nor[ii]; x += no[0] * S.cote * 3; y += no[1] * S.cote * 3; }
    }
    return { x, y, a };
  }
  // la caméra : { zoom, suivi (id d'une voiture ou null) } ; renvoie la transformation utilisée
  function camera(R, largeur, hauteur, cam = {}){
    const e0 = Math.min(largeur / P.W, hauteur / P.H), z = cam.zoom || 1, e = e0 * z;
    let cx = P.W / 2, cy = P.H / 2;
    if(z > 1.01){
      const v = cam.suivi && R.voitures.find(x => x.id === cam.suivi);
      if(v && v.x != null){ cx = v.x; cy = v.y; } else if(cam.cx != null){ cx = cam.cx; cy = cam.cy; }
      // on ne sort pas trop du cadre
      const dx = Math.max(0, (largeur / e - P.W) / 2), dy = Math.max(0, (hauteur / e - P.H) / 2);
      cx = clamp(cx, largeur / e / 2 - 30 - dx, P.W - largeur / e / 2 + 30 + dx); cy = clamp(cy, hauteur / e / 2 - 30 - dy, P.H - hauteur / e / 2 + 30 + dy);
      if(cam.lisse){ cam.lx = cam.lx == null ? cx : cam.lx + (cx - cam.lx) * .15; cam.ly = cam.ly == null ? cy : cam.ly + (cy - cam.ly) * .15; cx = cam.lx; cy = cam.ly; }
    } else { cam.lx = cam.ly = null; }
    return { e, ox:largeur / 2 - cx * e, oy:hauteur / 2 - cy * e };
  }
  function dessiner(R, g, largeur, hauteur, dpr, _fond, options = {}){
    const cam = options.cam || {}, T = R.T, w = mouille(R);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0B0C10'; g.fillRect(0, 0, largeur, hauteur);
    for(const v of R.voitures){ const p = placer(R, v); v.x = p.x; v.y = p.y; v.a = p.a; }
    const { e, ox, oy } = camera(R, largeur, hauteur, cam);
    R.vue = { e, ox, oy };
    g.setTransform(e * dpr, 0, 0, e * dpr, ox * dpr, oy * dpr);
    dessinerPiste(R, g, e);
    const ordreV = R.voitures.filter(v => v.etat !== 'elimine').sort((a, b) => (a.joueur ? 1 : 0) - (b.joueur ? 1 : 0));
    const petit = LONG * e < 13;               // vue d'ensemble : des pastilles, comme sur un écran de télévision
    for(const v of ordreV){
      g.globalAlpha = v.etat === 'abandon' || v.etat === 'accident' ? .5 : 1;
      if(petit){
        const r = 4.2 / e;
        if(v.joueur){ g.strokeStyle = '#FFD23F'; g.lineWidth = 2.4 / e; g.beginPath(); g.arc(v.x, v.y, r + 2.6 / e, 0, 7); g.stroke(); }
        g.fillStyle = v.c1; g.beginPath(); g.arc(v.x, v.y, r, 0, 7); g.fill(); g.strokeStyle = v.c2; g.lineWidth = 1.5 / e; g.stroke();
      } else {
        if(v.joueur){ g.strokeStyle = '#FFD23F'; g.lineWidth = 1.2; g.beginPath(); g.arc(v.x, v.y, LONG * .72, 0, 7); g.stroke(); }
        voiture(g, v.x, v.y, v.a, v.c1, v.c2, ECHELLE);
      }
      g.globalAlpha = 1;
    }
    // le tunnel : les voitures passent dessous
    const sc = scene(R);
    if(sc.tunnel){ g.lineCap = 'butt'; g.strokeStyle = 'rgba(30,34,42,.92)'; g.lineWidth = T.LARG + 6; g.stroke(sc.tunnel); g.strokeStyle = 'rgba(255,210,120,.5)'; g.lineWidth = .8; g.setLineDash([2, 4]); g.stroke(sc.tunnel); g.setLineDash([]); g.lineCap = 'round'; }
    // ce qui passe au-dessus des voitures (l'hôtel d'Abou Dabi)
    if(T.c.dessus){ g.globalAlpha = .82; dessinerDecor(g, T.c.dessus, T.c.nuit, ''); g.globalAlpha = 1; }
    // les noms courts
    if(options.noms !== false){
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = '800 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      for(const v of R.voitures){
        if(['abandon', 'elimine', 'garage'].includes(v.etat) && !(v.joueur && v.etat !== 'elimine')) continue;
        if(!v.joueur && !options.tousNoms && !(cam.suivi === v.id)) continue;
        const sx = ox + v.x * e, sy = oy + v.y * e - Math.max(8, LONG * e * .5);
        const txt = v.joueur && v.logo ? v.logo + ' ' + v.court : v.court, tw = g.measureText(txt).width + 8;
        g.fillStyle = v.joueur ? '#FFD23F' : 'rgba(20,20,20,.8)'; g.fillRect(sx - tw / 2, sy - 14, tw, 14);
        g.fillStyle = v.joueur ? '#1A1A1A' : '#fff'; g.fillText(txt, sx, sy - 1.5);
      }
    }
    if(w > .05){
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = `rgba(30,50,80,${w * .22})`; g.fillRect(0, 0, largeur, hauteur);
      g.strokeStyle = 'rgba(200,220,255,.45)'; g.lineWidth = 1;
      const nb = Math.round(140 * w);
      for(let k = 0; k < nb; k++){ const x = ((k * 97.3 + R.t * 40) % (largeur + 40)) - 20, y = ((k * 61.7 + R.t * 520) % (hauteur + 40)) - 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 11); g.stroke(); }
    }
  }
  // la voiture la plus proche d'un point de l'écran (pour la suivre en la touchant)
  function voitureEn(R, sx, sy){
    if(!R.vue) return null;
    const { e, ox, oy } = R.vue, x = (sx - ox) / e, y = (sy - oy) / e;
    let best = null, bd = 22 / e;
    for(const v of R.voitures){ if(v.x == null || v.etat === 'elimine') continue; const d = Math.hypot(v.x - x, v.y - y); if(d < bd){ bd = d; best = v; } }
    return best;
  }
  // un aperçu du tracé (pour le QG et le calendrier)
  function apercu(cv, c, w, h, fond = '#1A1E25'){
    const d = Math.min(2, devicePixelRatio || 1); cv.width = w * d; cv.height = h * d;
    const g = cv.getContext('2d'); g.scale(d, d); g.fillStyle = fond; g.fillRect(0, 0, w, h);
    const pts = P.construire(c).pts, e = Math.min((w - 10) / P.W, (h - 10) / P.H), ox = (w - P.W * e) / 2, oy = (h - P.H * e) / 2;
    g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(ox + p[0] * e, oy + p[1] * e) : g.moveTo(ox + p[0] * e, oy + p[1] * e)); g.closePath();
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(2.5, 3.2 * w / 150); g.stroke();
    g.strokeStyle = '#E10600'; g.lineWidth = Math.max(1, 1.4 * w / 150); g.stroke();
    g.fillStyle = '#FFC93C'; g.beginPath(); g.arc(ox + pts[0][0] * e, oy + pts[0][1] * e, 3.5, 0, 7); g.fill();
  }

  return { K:8, PNEUS, JEUX, MODES, ERS, REGLAGES, preparer, demarrerSeance, sortir, rentrer, pas, ordre, classementSeance, simulerSeance, qualifRapide, placerGrille, resultat, simulerFin,
    mouille, dessiner, chrono, circuitCourse, usureParTour, voiture, secsUtilises, prevoirArret, reglageIdeal, confiance, bonusReglage, connaissanceDepart, retourPilote, voitureEn, apercu,
    fond:() => null, pneuPluie };
})();
