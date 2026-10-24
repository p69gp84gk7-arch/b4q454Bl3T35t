/* Paddock : la course en direct, sur les circuits de Draw Race (cadre de 1000 × 600).
   Chaque voiture avance le long de la trajectoire idéale du circuit, à la vitesse du circuit multipliée par son « rythme »
   (voiture, pilote, pneus, consigne, pluie). Une voiture rattrapée reste derrière, sauf si elle réussit un dépassement
   dans une ligne droite. Les temps affichés sont multipliés par K pour ressembler à de vrais temps de Formule 1. */
window.PaddockCourse = (() => {
  const P = window.Piste;
  const PI = Math.PI;
  const K = 8.5;                                   // 1 seconde de jeu = 8,5 secondes « réelles » affichées
  const NC = 24;                                   // points de chronométrage par tour (pour les écarts)
  const ECART_MIN = 21;                            // distance minimale derrière une voiture (unités)
  const hasard = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  /* ---------- Les pneus ---------- */
  const PNEUS = {
    S:{ nom:'Tendres', court:'T', col:'#E8343A', rythme:.009, usure:.088, sec:true },
    M:{ nom:'Mediums', court:'M', col:'#F5C518', rythme:.0045, usure:.058, sec:true },
    H:{ nom:'Durs', court:'D', col:'#F4F4F4', rythme:0, usure:.04, sec:true },
    I:{ nom:'Intermédiaires', court:'I', col:'#2DB34A', rythme:0, usure:.045, sec:false },
    P:{ nom:'Pluie', court:'P', col:'#2F6FE0', rythme:0, usure:.04, sec:false },
  };
  const MODES = { eco:{ nom:'Économie', ico:'🐢', rythme:-.006, usure:.7, risque:.6 }, normal:{ nom:'Normal', ico:'🏁', rythme:0, usure:1, risque:1 }, attaque:{ nom:'Attaque', ico:'🔥', rythme:.006, usure:1.4, risque:1.7 } };
  // la perte de rythme avec l'usure (0 = neuf, 1 = fini)
  const perteUsure = u => u < .45 ? u * .006 : .0027 + (u - .45) ** 2 * .09 + (u > 1 ? .05 : 0);
  // pneus et piste mouillée (w de 0 à 1)
  function rythmeMeteo(type, w){
    if(type === 'I') return -Math.abs(w - .45) * .06 - (w < .2 ? (.2 - w) * .2 : 0);
    if(type === 'P') return -Math.abs(w - .8) * .04 - (w < .45 ? (.45 - w) * .16 : 0);
    return -Math.pow(w, .8) * .14;
  }
  const usureMeteo = (type, w) => type === 'I' ? (w < .2 ? 3 : 1) : type === 'P' ? (w < .35 ? 3 : 1) : 1 + w * .5;

  /* ---------- Le circuit prêt pour la course ---------- */
  const CACHE = {};
  const LARG = 54;                                 // largeur de la piste dans Paddock (plus étroite que dans Draw Race)
  const RETREC = .66;                              // la trajectoire idéale de Draw Race, rapprochée du centre d'autant
  const ENTREE = .055, SORTIE = .05;               // la voie des stands : sur les derniers et les premiers mètres du tour
  const lisse = t => t * t * (3 - 2 * t);
  function circuitCourse(c){
    if(CACHE[c.id]) return CACHE[c.id];
    const piste = P.construire(c), dr = P.trajectoireIdeale(piste), C = piste.pts;
    const ideale = C.map((p, i) => [p[0] + (dr[i][0] - p[0]) * RETREC, p[1] + (dr[i][1] - p[1]) * RETREC]);
    const pts = P.resample(ideale, P.STEP, true), n = pts.length;
    const { v } = P.vitesses(pts, new Array(n).fill(P.VMAX));
    const cap = pts.map((p, i) => { const q = pts[(i + 1) % n]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    const kappa = P.courbure(C), virage = kappa.reduce((s, k) => s + k, 0) / kappa.length;
    return CACHE[c.id] = { c, piste, kappa, pts, v, cap, n, L:n * P.STEP, tempsTour:P.tempsTour(v), abrasion:clamp(.85 + virage * 60, .85, 1.2), stands:voieStands(piste) };
  }
  // la voie des stands : parallèle à la ligne droite des stands, avec une entrée et une sortie en douceur,
  // du côté où il y a le plus de place (sans toucher une autre partie du circuit)
  function voieStands(piste){
    const C = piste.pts, n = C.length;
    // des normales lissées (pas de pointes dans les virages)
    const nor = C.map((_, i) => { let x = 0, y = 0; for(let d = -6; d <= 6; d++){ const a = piste.cap[(i + d + n) % n]; x += -Math.sin(a); y += Math.cos(a); } const l = Math.hypot(x, y) || 1; return [x / l, y / l]; });
    const nE = Math.round(n * ENTREE), nS = Math.round(n * SORTIE), tot = nE + nS;
    const essai = (cote, plein) => {
      const pts = [], offs = [];
      let mauvais = 0;
      for(let k = -nE; k <= nS; k++){
        const i = (k + n) % n, t = (k + nE) / tot;
        const o = plein * (t < .3 ? lisse(t / .3) : t > .7 ? lisse((1 - t) / .3) : 1);
        const q = [C[i][0] + nor[i][0] * cote * o, C[i][1] + nor[i][1] * cote * o];
        pts.push(q); offs.push(o);
        if(q[0] < 6 || q[0] > P.W - 6 || q[1] < 6 || q[1] > P.H - 6) mauvais += .3;
        for(let m = 0; m < n; m += 2){
          const dk = Math.min(Math.abs(m - i), n - Math.abs(m - i)); if(dk < 30) continue;
          if(Math.hypot(C[m][0] - q[0], C[m][1] - q[1]) < LARG / 2 + 30 + o * .2){ mauvais++; break; }
        }
      }
      // on préfère l'extérieur du circuit (plus de place pour les garages)
      const dehors = pts.reduce((t, q, j) => { const i = ((j - nE) + n) % n; return t + Math.hypot(q[0] - cx, q[1] - cy) - Math.hypot(C[i][0] - cx, C[i][1] - cy); }, 0) / pts.length;
      return { cote, plein, pts, offs, mauvais, dehors };
    };
    const cx = C.reduce((t, p) => t + p[0], 0) / n, cy = C.reduce((t, p) => t + p[1], 0) / n;
    let best = null;
    for(const plein of [LARG / 2 + 24, LARG / 2 + 17]) for(const cote of [1, -1]){ const e = essai(cote, plein);
      if(!best || e.mauvais < best.mauvais - .01 || (Math.abs(e.mauvais - best.mauvais) <= .01 && e.plein === best.plein && e.dehors > best.dehors)) best = e; }
    return { ...best, nE, nS, tot, nor };
  }
  // le point de la voie des stands à l'indice k (de -nE à nS), interpolé
  function pointStand(S, k){
    const j = clamp(k + S.nE, 0, S.tot), a = Math.floor(j), b = Math.min(S.tot, a + 1), f = j - a;
    const p = S.pts[a], q = S.pts[b];
    return { x:p[0] + (q[0] - p[0]) * f, y:p[1] + (q[1] - p[1]) * f, a:Math.atan2(q[1] - p[1], q[0] - p[0]) || 0 };
  }
  // où en est une voiture sur la voie des stands (en indices de la ligne centrale)
  function kStand(T, v){ const L = T.L, f = (((v.s % L) + L) % L) / L; return (f > .5 ? f - 1 : f) * T.piste.pts.length; }
  const boxDe = (T, v) => { const S = T.stands; return -S.nE + S.tot * (.3 + .4 * (v.box ?? 0) / 9); };

  /* ---------- Préparer une course ---------- */
  // voitures : [{ id, nom, court, ecurie, c1, c2, joueur, base, regularite, pneus, depassement, pluie, fiabilite, mecanos, ingenieur }]
  function preparer({ circuit, voitures, tours, meteo }){
    const T = circuitCourse(circuit);
    const R = { T, tours, meteo, t:0, phase:'grille', feux:0, voitures:voitures.map(v => ({ ...v, s:0, vit:0, etat:'grille', pneu:'M', usure:0, mode:'normal', utilises:new Set(),
      tour:0, dernierPassage:0, meilleurTour:null, tempsTours:[], arrets:0, demande:null, auto:!v.joueur, lat:0, latCible:0, depasse:null, bruit:0, retard:0,
      ecart:0, penalite:0, fin:null, abandon:null, degats:0, cp:0, aspi:0, grille:0 })),
      passages:new Map(), evenements:[], sc:null, drapeau:false, meilleurTour:null, arrives:0, alertes:{} };
    R.wetMax = 0;
    const equipes = [...new Set(voitures.map(v => v.ecurie))];
    R.equipes = equipes;
    R.couleursEquipes = Object.fromEntries(voitures.map(v => [v.ecurie, [v.c1, v.c2]]));
    for(const v of R.voitures) v.box = equipes.indexOf(v.ecurie);
    return R;
  }
  const mouille = (R, t = R.t) => {
    const m = R.meteo; if(!m || !m.pluie) return 0;
    const tourT = R.T.tempsTour * 1.08, x = t / tourT;           // en tours
    const d = m.debut, f = m.debut + m.duree;
    if(x < d - 1) return 0;
    if(x < d + .8) return clamp((x - d + 1) / 1.8, 0, 1) * m.force;
    if(x < f) return m.force;
    return clamp(m.force * (1 - (x - f) / 2.2), 0, 1);
  };

  /* ---------- Les qualifications : un tour lancé, deux essais ---------- */
  // choix : { idPilote: 'prudent' | 'risque' }
  function qualifier(R, choix = {}){
    const w = mouille(R, 0), res = [];
    for(const v of R.voitures){
      const pneu = w > .65 ? 'P' : w > .25 ? 'I' : 'S';
      let best = Infinity, erreur = false;
      for(let essai = 0; essai < 2; essai++){
        const risque = (choix[v.id] || (v.joueur ? 'prudent' : Math.random() < .3 ? 'risque' : 'prudent')) === 'risque';
        let f = rythmeBase(R, v, pneu, 0, w) + (risque ? .0035 : 0) + gauss() * (100 - v.regularite) * .0001;
        let t = R.T.tempsTour / f;
        if(Math.random() < (risque ? .14 : .04) * (1 + w * 2)){ t *= hasard(1.006, 1.03); erreur = true; }
        best = Math.min(best, t);
      }
      res.push({ id:v.id, temps:best, erreur });
    }
    res.sort((a, b) => a.temps - b.temps);
    res.forEach((r, i) => { const v = R.voitures.find(x => x.id === r.id); v.grille = i + 1; });
    R.qualifs = res;
    placerGrille(R);
    return res.map((r, i) => ({ ...r, place:i + 1, ecart:i ? (r.temps - res[0].temps) * K : 0, affiche:chrono(r.temps * K) }));
  }
  function placerGrille(R){
    for(const v of R.voitures){ v.s = -(v.grille - 1) * 26 - 12; v.lat = v.grille % 2 ? -11 : 11; v.latCible = 0; }
    R.voitures.sort((a, b) => a.grille - b.grille);
  }
  // le rythme d'une voiture (1 = vitesse du circuit) hors usure
  function rythmeBase(R, v, pneu, usure, w){
    let f = v.base + PNEUS[pneu].rythme + rythmeMeteo(pneu, w) - perteUsure(usure);
    if(w > .2) f += (v.pluie - 86) * .0007 * w;
    return f;
  }

  /* ---------- Les stratégies ---------- */
  function choisirPneusDepart(R, v){
    const w = mouille(R, 0);
    if(w > .65) return 'P'; if(w > .25) return 'I';
    if(v.joueur && v.pneuDepart) return v.pneuDepart;
    return v.grille <= 10 ? (Math.random() < .55 ? 'M' : 'S') : (Math.random() < .5 ? 'H' : 'M');
  }
  const toursRestants = (R, v) => R.tours - v.tour;
  const usureParTour = (R, v, pneu) => PNEUS[pneu].usure * (17 / R.tours) * R.T.abrasion * (1.25 - v.pneus / 400) * MODES[v.mode].usure;
  // la stratégie automatique (adversaires, et nos pilotes en mode auto) : quand rentrer et quels pneus
  function strategieAuto(R, v){
    if(v.demande || v.etat !== 'course') return;
    const w = mouille(R), reste = toursRestants(R, v);
    v.seuilPluie = v.seuilPluie ?? hasard(.25, .4); v.seuilSec = v.seuilSec ?? hasard(.12, .22);
    // la pluie
    if(PNEUS[v.pneu].sec && w > v.seuilPluie && reste > 1){ v.demande = w > .7 ? 'P' : 'I'; return; }
    if(v.pneu === 'I' && w > .78 && reste > 2){ v.demande = 'P'; return; }
    if(v.pneu === 'P' && w < .5 && reste > 2){ v.demande = 'I'; return; }
    if(!PNEUS[v.pneu].sec && w < v.seuilSec && reste > 1){ v.demande = choixSec(R, v, reste); return; }
    // l'usure
    const seuil = v.seuilUsure ?? (v.seuilUsure = hasard(.66, .8));
    if(v.usure > seuil && reste > 2) v.demande = choixSec(R, v, reste);
    // un seul type de pneus secs utilisé : il faudra en changer avant la fin
    else if(PNEUS[v.pneu].sec && R.wetMax < .3 && reste === 2 && secsUtilises(v) < 2) v.demande = v.pneu === 'S' ? 'M' : 'S';
  }
  const secsUtilises = v => [...v.utilises].filter(p => PNEUS[p].sec).length;
  function choixSec(R, v, reste){
    if(mouille(R) > .25) return 'I';
    const options = ['S', 'M', 'H'].filter(p => usureParTour(R, v, p) * reste < .9);
    let choix = options.length ? options[0] : 'H';
    // changer de type si un seul a servi
    if(secsUtilises(v) < 2 && choix === v.pneu && R.wetMax < .3) choix = options.find(p => p !== v.pneu) || (v.pneu === 'H' ? 'M' : 'H');
    return choix;
  }
  // les conseils de l'ingénieur pour nos pilotes (sans les obliger)
  function conseil(R, v){
    if(v.auto || v.demande || v.etat !== 'course') return null;
    const w = mouille(R), reste = toursRestants(R, v), prevu = mouille(R, R.t + R.T.tempsTour * (1 + v.ingenieur * .6));
    if(PNEUS[v.pneu].sec && w > .3) return 'La piste est mouillée : rentre pour des intermédiaires !';
    if(!PNEUS[v.pneu].sec && w < .15 && reste > 1) return 'La piste sèche : rentre pour des pneus secs !';
    if(PNEUS[v.pneu].sec && prevu > .3 && w < .1) return 'L\'ingénieur voit la pluie arriver d\'ici peu.';
    if(v.usure > .8 && reste > 1) return 'Pneus très usés : il faut rentrer au stand !';
    if(v.usure > .65 && reste > 3) return 'Pneus usés : pense à l\'arrêt au stand.';
    if(PNEUS[v.pneu].sec && R.wetMax < .3 && secsUtilises(v) < 2 && reste <= 4) return 'Règle : il faut utiliser deux types de pneus secs. Prévois un arrêt !';
    return null;
  }

  /* ---------- Un pas de course ---------- */
  function pas(R, dt){
    R.t += dt;
    const T = R.T, w = mouille(R);
    R.wetMax = Math.max(R.wetMax, w);
    if(R.phase === 'grille'){
      R.feux += dt;
      if(R.feux >= 3.2){ R.phase = 'course'; R.t = 0; for(const v of R.voitures){ v.etat = 'course'; v.pneu = choisirPneusDepart(R, v); v.utilises.add(v.pneu); v.retard = hasard(0, .35) * (1.1 - v.regularite / 100) * 3; v.dernierPassage = 0; } evenement(R, 'Départ !'); }
      else return;
    }
    // la voiture de sécurité
    const leader = R.voitures.filter(v => v.etat === 'course' || v.etat === 'stand').sort((a, b) => b.s - a.s)[0];
    if(R.sc && leader && leader.tour >= R.sc.fin){ R.sc = null; evenement(R, 'La voiture de sécurité rentre : la course reprend !'); }
    // la vitesse voulue de chaque voiture
    for(const v of R.voitures){
      if(v.etat === 'abandon') continue;
      if(v.etat === 'fini'){ v.vit = Math.max(60, v.vit - 80 * dt); v.s += v.vit * dt; continue; }
      if(v.retard > 0){ v.retard -= dt; v.cible = 0; continue; }
      const pos = ((v.s % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n;
      v.i = i;
      let f = rythmeBase(R, v, v.pneu, v.usure, w) + MODES[v.mode].rythme + v.bruit;
      let cible = T.v[i] * f;
      if(R.sc) cible = Math.min(cible, T.v[i] * .62);
      if(v.etat === 'stand') cible = v.arret.phase === 'arret' ? 0 : Math.min(cible, P.VMAX * .3);
      v.cible = cible;
    }
    // l'ordre sur la piste, et les voitures qui se suivent
    const enPiste = R.voitures.filter(v => v.etat === 'course').sort((a, b) => b.s - a.s);
    for(let k = 1; k < enPiste.length; k++){
      const v = enPiste[k], devant = enPiste[k - 1], d = devant.s - v.s;
      if(v.depasse && v.depasse.cible === devant.id){
        v.depasse.t += dt;
        if(v.depasse.t > 2.6){ v.depasse = null; v.latCible = 0; }
        else { v.cible *= 1.01; continue; }
      }
      const droite = T.v[v.i ?? 0] > P.VMAX * .86;
      // l'aspiration et le DRS dans les lignes droites, à moins d'une seconde
      if(!R.sc && droite && d < 70 && v.tour >= 1) v.cible *= 1.013;
      if(d < ECART_MIN + 18){
        const plusVite = v.cible > devant.cible * 1.004;
        if(!R.sc && droite && plusVite && d < ECART_MIN + 14){
          const chance = clamp((v.cible / devant.cible - 1) * 90 * (v.depassement / devant.depassement) ** 2, 0, 4) * dt;
          if(Math.random() < chance){ v.depasse = { cible:devant.id, t:0 }; v.latCible = Math.random() < .5 ? -16 : 16; if(v.joueur || devant.joueur || k <= 3) evenement(R, `${v.court} dépasse ${devant.court}`, v.joueur ? 'bon' : devant.joueur ? 'mal' : ''); continue; }
        }
        if(d < ECART_MIN) v.cible = Math.min(v.cible, devant.vit * (d < ECART_MIN - 6 ? .9 : 1));
      }
    }
    // avancer
    for(const v of R.voitures){
      if(v.etat !== 'course' && v.etat !== 'stand') continue;
      const acc = v.vit < v.cible ? 230 : -650;
      v.vit = v.vit < v.cible ? Math.min(v.cible, v.vit + acc * dt) : Math.max(v.cible, v.vit + acc * dt);
      const avant = v.s; v.s += v.vit * dt;
      v.lat += (v.latCible - v.lat) * Math.min(1, dt * 3);
      if(!v.depasse && v.etat === 'course') v.latCible = 0;
      chronometrer(R, v, avant);
      if(v.etat === 'course') usure(R, v, dt, w);
      if(v.etat === 'stand') stand(R, v, dt);
      else entreeStand(R, v, avant);
    }
    // la fin de la course : tout le monde a passé la ligne après le vainqueur
    if(R.drapeau && R.voitures.every(v => v.etat === 'fini' || v.etat === 'abandon')) R.phase = 'fin';
  }
  function chronometrer(R, v, avant){
    const T = R.T, L = T.L;
    if(v.s < 0) return;
    // les points de chronométrage (pour les écarts)
    const cp0 = Math.floor(Math.max(0, avant) / (L / NC)), cp1 = Math.floor(v.s / (L / NC));
    for(let c = cp0 + 1; c <= cp1; c++){
      if(!R.passages.has(c)) R.passages.set(c, R.t);
      v.ecart = R.t - R.passages.get(c); v.cp = c;
    }
    // un tour de plus
    const t0 = Math.floor(Math.max(0, avant) / L), t1 = Math.floor(v.s / L);
    if(t1 > t0 && avant >= 0){
      v.tour = t1;
      const temps = R.t - v.dernierPassage; v.dernierPassage = R.t;
      v.tempsTours.push(temps);
      if(v.tour > 1 && (!v.meilleurTour || temps < v.meilleurTour)) v.meilleurTour = temps;
      if(v.tour > 1 && (!R.meilleurTour || temps < R.meilleurTour.temps)) R.meilleurTour = { id:v.id, temps };
      // un peu de hasard pour ce tour (selon la régularité du pilote)
      v.bruit = gauss() * (100 - v.regularite) * .00012;
      // fin de course
      if(!R.drapeau && v.tour >= R.tours){ R.drapeau = true; evenement(R, `🏁 ${v.nom} gagne la course !`, v.joueur ? 'bon' : ''); }
      if(R.drapeau && v.etat === 'course'){ v.etat = 'fini'; v.fin = R.t; R.arrives++; v.place = R.arrives; return; }
      incidents(R, v);
      if(v.auto) strategieAuto(R, v);
      if(v.joueur){ const c = conseil(R, v); if(c && R.alertes[v.id] !== c){ R.alertes[v.id] = c; evenement(R, `🎧 ${v.court} : ${c}`, 'conseil'); } }
    }
  }
  function usure(R, v, dt, w){
    const parSeconde = usureParTour(R, v, v.pneu) * usureMeteo(v.pneu, w) / (R.T.tempsTour * 1.05);
    v.usure += parSeconde * dt * (R.sc ? .3 : 1);
    if(v.usure > 1.05 && Math.random() < dt * .25){
      // crevaison : il faut rentrer
      if(!v.crevaison){ v.crevaison = true; v.demande = v.demande || choixSec(R, v, toursRestants(R, v)); v.usure = 1.6; v.degats += .2; evenement(R, `💥 Crevaison pour ${v.nom} !`, v.joueur ? 'mal' : ''); }
    }
  }
  // abandons : panne (fiabilité) ou sortie de piste (régularité, pluie, mauvais pneus, mode attaque)
  function incidents(R, v){
    if(v.etat !== 'course') return;
    const w = mouille(R), mauvais = PNEUS[v.pneu].sec ? w : (v.pneu === 'I' ? Math.max(0, .15 - w) * 4 : Math.max(0, .4 - w) * 3);
    const panne = (100 - v.fiabilite) / 100 * .009 * (1.2 - v.mecanos * .06);
    const sortie = (100 - v.regularite) / 100 * .008 * (1 + mauvais * 10 + w * 2) * MODES[v.mode].risque * (17 / R.tours);
    if(Math.random() < panne){ abandon(R, v, choix(['Moteur cassé', 'Boîte de vitesses', 'Problème hydraulique', 'Freins', 'Électronique'])); }
    else if(Math.random() < sortie){
      if(Math.random() < .55){ abandon(R, v, 'Sortie de piste, voiture dans le mur'); v.degats += 1.5; if(!R.sc && toursRestants(R, v) > 2){ R.sc = { fin:v.tour + 2 }; evenement(R, '🚨 Voiture de sécurité ! Bonne occasion pour s\'arrêter au stand.', 'sc'); } }
      else { v.retard = hasard(1.2, 2.5); v.usure += .08; evenement(R, `${v.court} part en tête-à-queue et repart`, v.joueur ? 'mal' : ''); }
    }
  }
  const choix = t => t[Math.floor(Math.random() * t.length)];
  function abandon(R, v, raison){
    v.etat = 'abandon'; v.abandon = raison; v.vit = 0; v.latCible = -(LARG / 2 + 14); v.lat = v.latCible;
    evenement(R, `❌ Abandon de ${v.nom} : ${raison}`, v.joueur ? 'mal' : '');
  }
  function entreeStand(R, v, avant){
    if(!v.demande || v.etat !== 'course' || R.drapeau) return;
    const L = R.T.L, a = ((avant % L) + L) % L, b = ((v.s % L) + L) % L, seuil = L * (1 - ENTREE);
    if(a < seuil && b >= seuil && v.s > L * .5){
      v.etat = 'stand'; v.arret = { phase:'voie', t:0 }; v.latCible = 0; v.depasse = null;
    }
  }
  function stand(R, v, dt){
    const T = R.T, a = v.arret, k = kStand(T, v);
    if(a.phase === 'voie' && k >= boxDe(T, v) && k < T.stands.nS){
      // devant son garage : on change les pneus
      const ratage = Math.random() < .09 - v.mecanos * .015;
      a.phase = 'arret'; a.t = 0; a.duree = (hasard(2.1, 2.7) - v.mecanos * .12 + (ratage ? hasard(2, 5) : 0)) / K;
      v.vit = 0;
      if(ratage) evenement(R, `🔧 Arrêt raté pour ${v.court} : un écrou bloqué !`, v.joueur ? 'mal' : '');
    } else if(a.phase === 'arret'){
      a.t += dt;
      if(a.t >= a.duree){
        const ancien = v.pneu;
        v.pneu = v.demande; v.utilises.add(v.pneu); v.usure = 0; v.crevaison = false; v.demande = null; v.arrets++; v.seuilUsure = null;
        a.phase = 'sortie';
        if(v.joueur || R.voitures.indexOf(v) < 3) evenement(R, `${v.court} : arrêt en ${(a.duree * K).toFixed(1).replace('.', ',')} s, ${PNEUS[ancien].nom.toLowerCase()} → ${PNEUS[v.pneu].nom.toLowerCase()}`, v.joueur ? 'stand' : '');
      }
    } else if(a.phase !== 'arret' && k >= T.stands.nS - 1 && k < T.stands.nS + 40){
      v.etat = 'course'; v.arret = null; v.latCible = 0; v.lat = 0;
    }
  }
  function evenement(R, txt, type = ''){
    const leader = R.voitures.reduce((m, v) => Math.max(m, v.tour), 0);
    R.evenements.unshift({ txt, type, tour:Math.min(R.tours, leader + 1), t:R.t }); R.evenements = R.evenements.slice(0, 60);
  }

  /* ---------- Le classement en direct ---------- */
  function ordre(R){
    const liste = R.voitures.slice();
    liste.sort((a, b) => {
      const ra = a.etat === 'abandon' ? 1 : 0, rb = b.etat === 'abandon' ? 1 : 0;
      if(ra !== rb) return ra - rb;
      if(a.etat === 'fini' && b.etat === 'fini') return a.place - b.place;
      if(a.etat === 'fini') return a.tour >= b.tour ? -1 : 1;
      if(b.etat === 'fini') return b.tour >= a.tour ? 1 : -1;
      if(R.phase === 'grille') return a.grille - b.grille;
      return b.s - a.s;
    });
    const tete = liste[0];
    return liste.map((v, i) => {
      let ecart = '';
      if(v.etat === 'abandon') ecart = 'ABANDON';
      else if(i === 0) ecart = R.phase === 'grille' ? 'POLE' : `Tour ${Math.min(R.tours, Math.max(1, v.tour + (v.etat === 'fini' ? 0 : 1)))}`;
      else {
        const tours = Math.floor((tete.s - v.s) / R.T.L);
        ecart = tours >= 1 && v.etat !== 'fini' ? `+${tours} T` : `+${(Math.max(0, v.ecart) * K).toFixed(1).replace('.', ',')}`;
        if(v.etat === 'fini' && tete.etat === 'fini') ecart = v.tour < tete.tour ? `+${tete.tour - v.tour} T` : `+${((v.fin - tete.fin) * K).toFixed(1).replace('.', ',')}`;
      }
      return { v, place:i + 1, ecart };
    });
  }
  // le résultat final : temps, pénalités (un seul type de pneus secs), abandons
  function resultat(R){
    const pen = R.wetMax < .3;
    const fini = R.voitures.filter(v => v.etat === 'fini');
    for(const v of fini) if(pen && secsUtilises(v) < 2){ v.penalite = 30 / K; v.notePen = '+30 s (un seul type de pneus)'; }
    fini.sort((a, b) => b.tour - a.tour || (a.fin + a.penalite) - (b.fin + b.penalite));
    const ab = R.voitures.filter(v => v.etat === 'abandon').sort((a, b) => b.s - a.s);
    const liste = [...fini, ...ab];
    const tete = fini[0];
    return liste.map((v, i) => ({ pilote:v.id, nom:v.nom, ecurie:v.ecurie, place:i + 1, abandon:v.etat === 'abandon' ? v.abandon : null, arrets:v.arrets, degats:v.degats,
      meilleurTour:v.meilleurTour ? v.meilleurTour * K : null, penalite:v.notePen || null, grille:v.grille,
      ecart:v.etat === 'abandon' ? v.abandon : i === 0 ? chrono(v.fin * K) : v.tour < tete.tour ? `+${tete.tour - v.tour} tour${tete.tour - v.tour > 1 ? 's' : ''}` : `+${(((v.fin + v.penalite) - (tete.fin + tete.penalite)) * K).toFixed(1).replace('.', ',')} s` }));
  }
  function chrono(s){ const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(3).padStart(6, '0').replace('.', ',')}`; }
  // aller directement à l'arrivée
  function simulerFin(R){ let n = 0; while(R.phase !== 'fin' && n < 200000){ pas(R, 1 / 30); n++; } }

  /* ---------- Le dessin ---------- */
  const SOLS = { parc:'#DCE9C4', campagne:'#DDE8B8', collines:'#E4E3B6', foret:'#CBE0B2', sapins:'#C9DDB8', desert:'#EAD8AA', dunes:'#EFE3BE', ville:'#D9D3C8', nuit:'#27304A',
    japon:'#DDEBC8', fleuve:'#D6E8C0', lac:'#D9EBC4', mer:'#E6DECB', montagne:'#D3DFC4', prairie:'#E6DFB2', neige:'#F4F7FB', savane:'#E2C48A' };
  // hasard reproductible (le même décor à chaque course sur un circuit)
  function hasardDe(txt){ let h = 2166136261; for(const ch of txt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function fond(R, largeur, hauteur, dpr){
    const T = R.T, c = T.c, C = T.piste.pts, n = C.length, S = T.stands, off = document.createElement('canvas');
    off.width = Math.round(largeur * dpr); off.height = Math.round(hauteur * dpr);
    const o = off.getContext('2d'), e = Math.min(largeur / P.W, hauteur / P.H), rnd = hasardDe(c.id);
    o.setTransform(e * dpr, 0, 0, e * dpr, (largeur - P.W * e) / 2 * dpr, (hauteur - P.H * e) / 2 * dpr);
    const nuit = c.decor === 'nuit', sol = SOLS[c.decor] || '#DCE9C4';
    o.fillStyle = sol; o.fillRect(-400, -400, P.W + 800, P.H + 800);
    // l'herbe tondue en bandes, et quelques taches
    o.fillStyle = nuit ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.025)';
    for(let x = -400; x < P.W + 400; x += 60) o.fillRect(x, -400, 30, P.H + 800);
    const chemin = (pts, ferme = true) => { o.beginPath(); pts.forEach((p, i) => i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1])); if(ferme) o.closePath(); };
    const morceaux = (seuil, marge) => {
      // les portions de circuit où ça tourne (pour les vibreurs et les bacs à gravier)
      const res = []; let cur = null;
      for(let i = 0; i <= n; i++){ const k = T.kappa[i % n], dans = k > seuil;
        if(dans && !cur) cur = [i]; else if(!dans && cur){ res.push([cur[0] - marge, i + marge]); cur = null; } }
      if(cur) res.push([cur[0] - marge, n + marge]);
      return res.map(([a, b]) => { const l = []; for(let i = a; i <= b; i++) l.push(C[((i % n) + n) % n]); return l; });
    };
    o.lineJoin = 'round'; o.lineCap = 'round';
    // les dégagements en herbe claire, puis les bacs à gravier à l'extérieur des virages
    chemin(C); o.strokeStyle = nuit ? '#2E3854' : 'rgba(255,255,255,.22)'; o.lineWidth = LARG + 70; o.stroke();
    for(const m of morceaux(.0075, 6)){ chemin(m, false); o.strokeStyle = nuit ? '#4A4636' : '#E3D3A4'; o.lineWidth = LARG + 56; o.stroke(); }
    // la voie des stands : la route, ses bords, le muret entre la piste et la voie
    const voie = S.pts, nor = S.nor, cote = S.cote;
    chemin(voie, false); o.strokeStyle = '#1F1F1F'; o.lineWidth = 22; o.stroke();
    chemin(voie, false); o.strokeStyle = nuit ? '#77736C' : '#9C988F'; o.lineWidth = 18; o.stroke();
    // les garages, un par écurie, dans la partie droite de la voie
    const eq = R.equipes || [];
    const plein = [];
    for(let k = -S.nE; k <= S.nS; k++){ const j = k + S.nE; if(S.offs[j] > S.plein * .98) plein.push(k); }
    if(plein.length > 4){
      const kA = plein[0], kB = plein[plein.length - 1];
      // le bâtiment des stands, derrière les garages
      const bande = (d1, d2, ka, kb) => { const pts = []; for(let k = ka; k <= kb; k++){ const i = (k + n) % n; pts.push([C[i][0] + nor[i][0] * cote * d1, C[i][1] + nor[i][1] * cote * d1]); }
        for(let k = kb; k >= ka; k--){ const i = (k + n) % n; pts.push([C[i][0] + nor[i][0] * cote * d2, C[i][1] + nor[i][1] * cote * d2]); } return pts; };
      chemin(bande(S.plein + 10, S.plein + 32, kA, kB)); o.fillStyle = nuit ? '#3B4150' : '#C9CDD3'; o.fill(); o.strokeStyle = '#555B66'; o.lineWidth = 1.2; o.stroke();
      chemin(bande(S.plein + 26, S.plein + 32, kA, kB)); o.fillStyle = nuit ? '#262A35' : '#8D939C'; o.fill();
      // un garage coloré par écurie
      const nb = Math.max(1, eq.length);
      for(let g = 0; g < nb; g++){
        const ka = kA + (kB - kA) * (g + .08) / nb, kb = kA + (kB - kA) * (g + .92) / nb;
        const coul = R.couleursEquipes && R.couleursEquipes[eq[g]] ? R.couleursEquipes[eq[g]] : ['#888', '#ccc'];
        chemin(bande(S.plein + 11, S.plein + 25, Math.round(ka), Math.round(kb))); o.fillStyle = coul[0]; o.fill();
        chemin(bande(S.plein + 11, S.plein + 14, Math.round(ka), Math.round(kb))); o.fillStyle = coul[1]; o.fill();
        // l'emplacement d'arrêt devant le garage
        const kbox = -S.nE + S.tot * (.3 + .4 * g / 9), q = pointStand(S, kbox);
        o.save(); o.translate(q.x, q.y); o.rotate(q.a); o.strokeStyle = coul[0]; o.lineWidth = 1.6; o.strokeRect(-9, -6, 18, 12); o.restore();
      }
      // le muret des stands
      chemin(bande(LARG / 2 + 5, LARG / 2 + 8, kA - 6, kB + 6)); o.fillStyle = '#EDEDED'; o.fill(); o.strokeStyle = '#6A6A6A'; o.lineWidth = .8; o.stroke();
    }
    chemin(voie, false); o.strokeStyle = 'rgba(255,255,255,.75)'; o.lineWidth = 1; o.setLineDash([5, 5]); o.stroke(); o.setLineDash([]);
    // la piste : le bord sombre, les vibreurs (une bande continue des deux côtés), puis le bitume par-dessus
    chemin(C); o.strokeStyle = '#1F1F1F'; o.lineWidth = LARG + 14; o.stroke();
    for(const m of morceaux(.0075, 3)){
      chemin(m, false); o.lineCap = 'butt'; o.strokeStyle = '#FFFFFF'; o.lineWidth = LARG + 10; o.stroke();
      o.setLineDash([7, 7]); o.strokeStyle = '#D7263D'; o.stroke(); o.setLineDash([]); o.lineCap = 'round';
    }
    chemin(C); o.strokeStyle = nuit ? '#8E8A83' : '#A7A39A'; o.lineWidth = LARG; o.stroke();
    // les lignes blanches au bord de la piste
    chemin(C); o.strokeStyle = 'rgba(255,255,255,.55)'; o.lineWidth = LARG - 3; o.stroke();
    chemin(C); o.strokeStyle = nuit ? '#8E8A83' : '#A7A39A'; o.lineWidth = LARG - 5.5; o.stroke();
    // un peu de gomme sur la trajectoire
    chemin(T.pts); o.strokeStyle = 'rgba(40,40,40,.12)'; o.lineWidth = 9; o.stroke();
    // la grille de départ (20 emplacements) et la ligne en damier
    for(let g = 0; g < 20; g++){
      const sDist = -g * 26 - 12, pos = ((sDist % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n, a = T.cap[i], lat = g % 2 ? 11 : -11;
      const x = T.pts[i][0] - Math.sin(a) * lat, y = T.pts[i][1] + Math.cos(a) * lat;
      o.save(); o.translate(x, y); o.rotate(a); o.strokeStyle = 'rgba(255,255,255,.85)'; o.lineWidth = 1.2;
      o.beginPath(); o.moveTo(9, -6); o.lineTo(11, -6); o.lineTo(11, 6); o.lineTo(9, 6); o.stroke(); o.restore();
    }
    const p0 = C[0], a0 = T.piste.cap[0];
    o.save(); o.translate(p0[0], p0[1]); o.rotate(a0);
    for(let j = -Math.ceil(LARG / 12); j < Math.ceil(LARG / 12); j++) for(let k = 0; k < 2; k++){ if(Math.abs(j * 6 + 3) > LARG / 2) continue; o.fillStyle = (j + k) % 2 ? '#111' : '#fff'; o.fillRect(k * 4 - 4, j * 6, 4, 6); }
    o.restore();
    // la tribune principale, face aux stands : des gradins colorés et un toit
    {
      const ka = -Math.round(S.nE * .45), kb = Math.round(S.nS * .45);
      const ligne = d => { const pts = []; for(let k = ka; k <= kb; k++){ const i = (k + n) % n; pts.push([C[i][0] - S.nor[i][0] * S.cote * d, C[i][1] - S.nor[i][1] * S.cote * d]); } return pts; };
      const mil = ligne(LARG / 2 + 30);
      const libre = mil.every(q => { if(q[0] < 0 || q[0] > P.W || q[1] < 0 || q[1] > P.H) return false; for(let m = 0; m < n; m += 3){ const dk = Math.min(m, n - m); if(dk < S.nE + 12) continue; if(Math.hypot(C[m][0] - q[0], C[m][1] - q[1]) < LARG / 2 + 26) return false; } return true; });
      if(libre && mil.length > 6){
        o.lineCap = 'butt';
        chemin(mil, false); o.strokeStyle = '#4F5A6A'; o.lineWidth = 20; o.stroke();
        [['#E63946', 23], ['#F4F4F4', 27.5], ['#2D7FD3', 32]].forEach(([col, d]) => { chemin(ligne(LARG / 2 + d), false); o.strokeStyle = col; o.lineWidth = 3; o.setLineDash([1.6, 1.2]); o.stroke(); o.setLineDash([]); });
        chemin(ligne(LARG / 2 + 38), false); o.strokeStyle = '#D9DDE3'; o.lineWidth = 4; o.stroke();
        o.lineCap = 'round';
      }
    }
    // des arbres, loin de la piste et des stands
    const proche = (x, y, d) => { for(let m = 0; m < n; m += 3) if(Math.hypot(C[m][0] - x, C[m][1] - y) < d) return true; for(const q of voie) if(Math.hypot(q[0] - x, q[1] - y) < d + 30) return true; return false; };
    let nbArbres = { desert:14, dunes:18, ville:20, nuit:16, neige:60, foret:110, sapins:100, montagne:80 }[c.decor] ?? 70;
    for(let t = 0, essais = nbArbres * 3; t < essais && t < 400; t++){
      const x = rnd() * (P.W + 60) - 30, y = rnd() * (P.H + 60) - 30, r = 7 + rnd() * 9;
      if(proche(x, y, LARG / 2 + 40 + r)) continue;
      if(--nbArbres < 0) break;
      o.fillStyle = 'rgba(0,0,0,.18)'; o.beginPath(); o.arc(x + r * .4, y + r * .4, r, 0, 7); o.fill();
      const sapin = ['sapins', 'montagne', 'neige'].includes(c.decor), palmier = ['desert', 'dunes', 'mer'].includes(c.decor);
      o.fillStyle = sapin ? '#2F5E3A' : palmier ? '#5E8C3A' : nuit ? '#1F3A2E' : '#3E7D45'; o.beginPath(); o.arc(x, y, r, 0, 7); o.fill();
      o.fillStyle = sapin ? '#3E7A4C' : palmier ? '#79A84A' : nuit ? '#2A4C3B' : '#56A15C'; o.beginPath(); o.arc(x - r * .25, y - r * .25, r * .6, 0, 7); o.fill();
    }
    return off;
  }
  // une Formule 1 vue du dessus (longueur 26 unités, l'avant vers +x)
  function voiture(g, x, y, a, c1, c2, k = 1){
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    g.lineJoin = 'round';
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(1.5, 1.8, 13.5, 7, 0, 0, 7); g.fill();
    const rect = (x0, y0, w, h, c, r = .8) => { g.beginPath(); g.roundRect ? g.roundRect(x0, y0, w, h, r) : g.rect(x0, y0, w, h); g.fillStyle = c; g.fill(); };
    // les roues (arrière plus larges), avec les jantes
    for(const [cx, cy, l, w] of [[-8.5, -6.8, 5.6, 3.4], [-8.5, 6.8, 5.6, 3.4], [7.6, -6.3, 4.6, 2.8], [7.6, 6.3, 4.6, 2.8]]){
      rect(cx - l / 2, cy - w / 2, l, w, '#141414', 1.2); g.fillStyle = '#8A8A8A'; g.fillRect(cx - l / 2 + 1, cy - .35, l - 2, .7);
    }
    // les bras de suspension
    g.strokeStyle = '#2A2A2A'; g.lineWidth = .7;
    g.beginPath(); g.moveTo(-8.5, -5); g.lineTo(-5, -2); g.moveTo(-8.5, 5); g.lineTo(-5, 2); g.moveTo(7.6, -5); g.lineTo(4, -1.4); g.moveTo(7.6, 5); g.lineTo(4, 1.4); g.stroke();
    // le fond plat
    g.fillStyle = '#262626'; g.beginPath(); g.moveTo(-11, -4.6); g.lineTo(-3, -5.6); g.lineTo(4, -3.4); g.lineTo(4, 3.4); g.lineTo(-3, 5.6); g.lineTo(-11, 4.6); g.closePath(); g.fill();
    // l'aileron arrière (les dérives à la couleur secondaire)
    rect(-13.5, -5.8, 3, 11.6, c1, .6); rect(-13.6, -6.2, 3.2, 1.2, c2, .3); rect(-13.6, 5, 3.2, 1.2, c2, .3);
    // les pontons et la coque
    g.fillStyle = c1; g.beginPath(); g.moveTo(-10.5, -2.2); g.lineTo(-6, -4.6); g.lineTo(-1, -4.6); g.lineTo(2, -2.2); g.lineTo(10.5, -1.1); g.lineTo(12, 0); g.lineTo(10.5, 1.1); g.lineTo(2, 2.2); g.lineTo(-1, 4.6); g.lineTo(-6, 4.6); g.lineTo(-10.5, 2.2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = .5; g.stroke();
    // les bandes de couleur secondaire
    g.fillStyle = c2; g.fillRect(-6, -4.5, 4.5, 1.1); g.fillRect(-6, 3.4, 4.5, 1.1); g.fillRect(2, -.45, 8.5, .9);
    // le capot moteur et l'arceau
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(-6, 0, 4.2, 1.6, 0, 0, 7); g.fill();
    // le cockpit, le casque et le halo
    g.fillStyle = '#121212'; g.beginPath(); g.ellipse(-.6, 0, 2.6, 1.7, 0, 0, 7); g.fill();
    g.fillStyle = c2; g.beginPath(); g.arc(-.9, 0, 1.15, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(-.3, -.35, .5, .7);
    g.strokeStyle = '#3A3A3A'; g.lineWidth = .8; g.beginPath(); g.ellipse(0, 0, 2.9, 2, 0, -1.8, 1.8); g.stroke();
    // l'aileron avant
    rect(11.2, -6.6, 2.4, 13.2, c2, .6); rect(11.4, -6.8, 2.2, 1.4, c1, .3); rect(11.4, 5.4, 2.2, 1.4, c1, .3);
    g.restore();
  }
  // dessiner la course dans un rectangle (cadre 1000 × 600 ajusté), avec le fond déjà préparé
  function dessiner(R, g, largeur, hauteur, dpr, fondImg, options = {}){
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(fondImg, 0, 0, largeur, hauteur);
    const e = Math.min(largeur / P.W, hauteur / P.H), ox = (largeur - P.W * e) / 2, oy = (hauteur - P.H * e) / 2;
    g.setTransform(e * dpr, 0, 0, e * dpr, ox * dpr, oy * dpr);
    const T = R.T, w = mouille(R);
    const ordreVoitures = R.voitures.slice().sort((a, b) => (a.joueur ? 1 : 0) - (b.joueur ? 1 : 0));
    for(const v of ordreVoitures){
      const pos = ((v.s % T.L) + T.L) % T.L, i = Math.floor(pos / P.STEP) % T.n, f = (pos / P.STEP) % 1;
      const p = T.pts[i], q = T.pts[(i + 1) % T.n];
      let a = T.cap[i];
      const lat = v.lat;
      let x = p[0] + (q[0] - p[0]) * f - Math.sin(a) * lat, y = p[1] + (q[1] - p[1]) * f + Math.cos(a) * lat;
      if(v.etat === 'stand'){
        // sur la voie des stands : on glisse de la trajectoire vers la voie, puis on la suit
        const S = T.stands, k = kStand(T, v), j = clamp(k + S.nE, 0, S.tot), m = pointStand(S, k);
        const b = clamp(Math.min(j, S.tot - j) / (S.tot * .12), 0, 1);
        x = x + (m.x - x) * b; y = y + (m.y - y) * b;
        let da = m.a - a; while(da > PI) da -= 2 * PI; while(da < -PI) da += 2 * PI; a += da * b;
      }
      v.x = x; v.y = y;
      if(v.joueur){ g.strokeStyle = '#FFD23F'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 15, 0, 7); g.stroke(); }
      g.globalAlpha = v.etat === 'abandon' ? .55 : 1;
      voiture(g, x, y, a, v.c1, v.c2, .92);
      g.globalAlpha = 1;
    }
    // les noms courts
    if(options.noms !== false){
      g.font = '800 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
      for(const v of R.voitures){
        if(v.etat === 'abandon' && !v.joueur) continue;
        if(!v.joueur && !options.tousNoms) continue;
        const txt = v.joueur && v.logo ? v.logo + ' ' + v.court : v.court, tw = g.measureText(txt).width + 8;
        g.fillStyle = v.joueur ? '#FFD23F' : 'rgba(20,20,20,.75)'; g.fillRect(v.x - tw / 2, v.y - 31, tw, 14);
        g.fillStyle = v.joueur ? '#1A1A1A' : '#fff'; g.fillText(txt, v.x, v.y - 18.5);
      }
    }
    // la pluie
    if(w > .05){
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = `rgba(30,50,80,${w * .22})`; g.fillRect(0, 0, largeur, hauteur);
      g.strokeStyle = 'rgba(200,220,255,.55)'; g.lineWidth = 1;
      const nb = Math.round(140 * w);
      for(let k = 0; k < nb; k++){ const x = ((k * 97.3 + R.t * 40) % (largeur + 40)) - 20, y = ((k * 61.7 + R.t * 520) % (hauteur + 40)) - 20; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 11); g.stroke(); }
    }
  }

  return { K, PNEUS, MODES, preparer, qualifier, pas, ordre, resultat, simulerFin, mouille, dessiner, fond, chrono, circuitCourse, usureParTour, voiture, secsUtilises };
})();
