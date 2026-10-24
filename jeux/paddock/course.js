/* Paddock : la course en direct, sur les circuits de Draw Race (cadre de 1000 × 600).
   Chaque voiture avance le long de la trajectoire idéale du circuit, à la vitesse du circuit multipliée par son « rythme »
   (voiture, pilote, pneus, consigne, pluie). Une voiture rattrapée reste derrière, sauf si elle réussit un dépassement
   dans une ligne droite. Les temps affichés sont multipliés par K pour ressembler à de vrais temps de Formule 1. */
window.PaddockCourse = (() => {
  const P = window.Piste;
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
  function circuitCourse(c){
    if(CACHE[c.id]) return CACHE[c.id];
    const piste = P.construire(c), ideale = P.trajectoireIdeale(piste);
    const pts = P.resample(ideale, P.STEP, true), n = pts.length;
    const { v } = P.vitesses(pts, new Array(n).fill(P.VMAX));
    const cap = pts.map((p, i) => { const q = pts[(i + 1) % n]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    // la ligne centrale (pour la voie des stands et le dessin) et la normale de la trajectoire
    const kappa = P.courbure(piste.pts), virage = kappa.reduce((s, k) => s + k, 0) / kappa.length;
    return CACHE[c.id] = { c, piste, pts, v, cap, n, L:n * P.STEP, tempsTour:P.tempsTour(v), abrasion:clamp(.85 + virage * 60, .85, 1.2) };
  }

  /* ---------- Préparer une course ---------- */
  // voitures : [{ id, nom, court, ecurie, c1, c2, joueur, base, regularite, pneus, depassement, pluie, fiabilite, mecanos, ingenieur }]
  function preparer({ circuit, voitures, tours, meteo }){
    const T = circuitCourse(circuit);
    const R = { T, tours, meteo, t:0, phase:'grille', feux:0, voitures:voitures.map(v => ({ ...v, s:0, vit:0, etat:'grille', pneu:'M', usure:0, mode:'normal', utilises:new Set(),
      tour:0, dernierPassage:0, meilleurTour:null, tempsTours:[], arrets:0, demande:null, auto:!v.joueur, lat:0, latCible:0, depasse:null, bruit:0, retard:0,
      ecart:0, penalite:0, fin:null, abandon:null, degats:0, cp:0, aspi:0, grille:0 })),
      passages:new Map(), evenements:[], sc:null, drapeau:false, meilleurTour:null, arrives:0, alertes:{} };
    R.wetMax = 0;
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
    v.etat = 'abandon'; v.abandon = raison; v.vit = 0; v.latCible = -54; v.lat = -54;
    evenement(R, `❌ Abandon de ${v.nom} : ${raison}`, v.joueur ? 'mal' : '');
  }
  // la voie des stands : sur les derniers et les premiers mètres du tour
  const ENTREE = .055, SORTIE = .05;
  function entreeStand(R, v, avant){
    if(!v.demande || v.etat !== 'course' || R.drapeau) return;
    const L = R.T.L, a = ((avant % L) + L) % L, b = ((v.s % L) + L) % L, seuil = L * (1 - ENTREE);
    if(a < seuil && b >= seuil && v.s > L * .5){
      v.etat = 'stand'; v.arret = { phase:'voie', t:0 }; v.latCible = 46; v.depasse = null;
    }
  }
  function stand(R, v, dt){
    const L = R.T.L, pos = ((v.s % L) + L) % L, a = v.arret;
    if(a.phase === 'voie' && pos < L * .5){
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
    } else if(a.phase === 'sortie' && pos > L * SORTIE && pos < L * .5){
      v.etat = 'course'; v.arret = null; v.latCible = 0;
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
  function fond(R, largeur, hauteur, dpr){
    const T = R.T, c = T.c, off = document.createElement('canvas');
    off.width = Math.round(largeur * dpr); off.height = Math.round(hauteur * dpr);
    const o = off.getContext('2d'), e = Math.min(largeur / P.W, hauteur / P.H);
    o.setTransform(e * dpr, 0, 0, e * dpr, (largeur - P.W * e) / 2 * dpr, (hauteur - P.H * e) / 2 * dpr);
    o.fillStyle = SOLS[c.decor] || '#DCE9C4'; o.fillRect(-200, -200, P.W + 400, P.H + 400);
    // des taches d'herbe
    o.fillStyle = 'rgba(0,0,0,.035)'; for(let i = 0; i < 70; i++){ o.beginPath(); o.arc((i * 137) % P.W, (i * 251) % P.H, 10 + (i * 7) % 30, 0, 7); o.fill(); }
    const chemin = () => { o.beginPath(); T.piste.pts.forEach((p, i) => i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1])); o.closePath(); };
    o.lineJoin = 'round'; o.lineCap = 'round';
    // la voie des stands : sur le côté, avant et après la ligne
    const n = T.n, voie = [];
    for(let k = -Math.round(n * ENTREE); k <= Math.round(n * SORTIE); k++){ const i = (k + n) % n, a = T.cap[i]; voie.push([T.pts[i][0] - Math.sin(a) * 46, T.pts[i][1] + Math.cos(a) * 46]); }
    o.strokeStyle = '#8D8A84'; o.lineWidth = 20; o.beginPath(); voie.forEach((p, i) => i ? o.lineTo(p[0], p[1]) : o.moveTo(p[0], p[1])); o.stroke();
    o.strokeStyle = 'rgba(255,255,255,.6)'; o.lineWidth = 1.2; o.setLineDash([6, 6]); o.stroke(); o.setLineDash([]);
    // les garages
    for(let k = -6; k <= 6; k++){ const i = (k * 3 + n) % n, a = T.cap[i]; o.fillStyle = k % 2 ? '#5D6670' : '#6B747E'; o.save(); o.translate(T.pts[i][0] - Math.sin(a) * 62, T.pts[i][1] + Math.cos(a) * 62); o.rotate(a); o.fillRect(-6, -6, 12, 12); o.restore(); }
    // la piste
    chemin(); o.strokeStyle = '#1F1F1F'; o.lineWidth = P.LARGEUR + 10; o.stroke();
    chemin(); o.strokeStyle = c.decor === 'nuit' ? '#8E8A83' : '#A7A39A'; o.lineWidth = P.LARGEUR; o.stroke();
    // les vibreurs dans les virages
    const kap = P.courbure(T.piste.pts), m = T.piste.pts.length;
    for(let i = 0; i < m; i += 2){
      if(kap[i] < .006) continue;
      const p = T.piste.pts[i], a = T.piste.cap[i];
      for(const cote of [-1, 1]){ o.fillStyle = (Math.floor(i / 4) % 2) ? '#D7263D' : '#FFFFFF'; o.save(); o.translate(p[0] - Math.sin(a) * cote * (P.LARGEUR / 2 + 1), p[1] + Math.cos(a) * cote * (P.LARGEUR / 2 + 1)); o.rotate(a); o.fillRect(-4, -3, 8, 6); o.restore(); }
    }
    // la ligne de départ en damier
    const p0 = T.piste.pts[0], a0 = T.piste.cap[0];
    o.save(); o.translate(p0[0], p0[1]); o.rotate(a0);
    for(let j = -5; j < 5; j++) for(let k = 0; k < 2; k++){ o.fillStyle = (j + k) % 2 ? '#111' : '#fff'; o.fillRect(k * 4 - 4, j * 8, 4, 8); }
    o.restore();
    return off;
  }
  function voiture(g, x, y, a, c1, c2, k = 1){
    g.save(); g.translate(x, y); g.rotate(a); g.scale(k, k);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(1, 1.5, 12, 6.5, 0, 0, 7); g.fill();
    g.fillStyle = '#151515';
    g.fillRect(-9, -7, 5, 3.2); g.fillRect(-9, 3.8, 5, 3.2); g.fillRect(5, -6.5, 4.2, 2.8); g.fillRect(5, 3.7, 4.2, 2.8);
    g.fillStyle = c1; g.beginPath(); g.moveTo(-10, -3.4); g.lineTo(3, -3.4); g.lineTo(11, -1.4); g.lineTo(11, 1.4); g.lineTo(3, 3.4); g.lineTo(-10, 3.4); g.closePath(); g.fill();
    g.fillStyle = c2; g.fillRect(-11.5, -5.5, 2.6, 11); g.fillRect(10.4, -5, 2.2, 10); g.fillRect(-6, -1, 12, 2);
    g.fillStyle = '#1A1A1A'; g.beginPath(); g.ellipse(-1, 0, 2.6, 1.8, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .7; g.strokeRect(-10, -3.4, 21, 6.8);
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
      const p = T.pts[i], q = T.pts[(i + 1) % T.n], a = T.cap[i];
      const lat = v.etat === 'abandon' ? -54 : v.lat;
      const x = p[0] + (q[0] - p[0]) * f - Math.sin(a) * lat, y = p[1] + (q[1] - p[1]) * f + Math.cos(a) * lat;
      v.x = x; v.y = y;
      if(v.joueur){ g.strokeStyle = '#FFD23F'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 15, 0, 7); g.stroke(); }
      g.globalAlpha = v.etat === 'abandon' ? .55 : 1;
      voiture(g, x, y, a, v.c1, v.c2, .95);
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
