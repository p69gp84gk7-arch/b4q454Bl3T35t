/* Starship : le programme. La logique du jeu, sans dessin (ce fichier tourne aussi avec Node pour les essais) :
   - la gestion : budget, équipes, cinq domaines à améliorer, prototypes, événements, jalons à franchir ;
   - le vol : un petit simulateur en deux dimensions (poussée, gravité, air, vent, chaleur, rentrée en « ventre à terre »,
     retournement, atterrissage ou rattrapage par la tour).
   Inspiré de l'histoire publique du programme Starship (sauts, haute altitude, vol orbital, rattrapage du booster…).
   Les dessins, les chiffres et le jeu sont originaux : ce n'est pas un jeu officiel. */
window.STARSHIP_SIM = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), RAD = Math.PI / 180;
  const G0 = 9.81;

  /* ---------- Les jalons (d'après l'histoire du programme, en plus simple) ---------- */
  // equipe : les niveaux de technologie du vaisseau pour ce jalon (fixes : on ne les achète pas) ; etoiles : les objectifs en temps et en carburant ; vol : ce qu'il faut réussir
  const JALONS = [
    { id:'saut', court:'Saut', nom:'Le premier saut', ico:'🐸', equipe:{ moteurs:0, structure:0, bouclier:0, logiciel:0, atterrisseur:0 }, etoiles:{ temps:60, carb:0.35 },
      histoire:"Au début du programme, un petit prototype trapu, posé sur trois jambes, ne fait que de petits sauts. Chaque hop vérifie qu'un moteur sait décoller, rester stable… et se reposer.",
      txt:'Un petit prototype décolle, monte à 150 m, puis se pose sur l\'autre plateforme, à 70 m de là. Un seul essai, pas de droit à l\'erreur… ou presque.',
      vol:{ type:'saut', cible:150, pad:{ x:70, tol:18 }, depart:{ phase:'vol' }, vent:.3, titre:'Saut à 150 m' } },
    { id:'altitude', court:'5 km', nom:'Haute altitude', ico:'🛰️', equipe:{ moteurs:1, structure:0, bouclier:0, logiciel:2, atterrisseur:2 }, etoiles:{ temps:130, carb:0.08 },
      histoire:'Ensuite viennent les vols plus hauts, avec la figure de style du programme : couper les moteurs, descendre à plat comme une feuille, se retourner au dernier moment et se poser.',
      txt:'Monter à 5 km, couper les moteurs, descendre « à plat » comme une feuille, se retourner au dernier moment et se poser. C\'est la figure de style du programme.',
      vol:{ type:'altitude', cible:5000, pad:{ x:0, tol:22 }, belly:true, depart:{ phase:'vol' }, vent:.8, titre:'Vol à 5 km' } },
    { id:'orbite', court:'Orbite', nom:'Premier vol orbital', ico:'🌍', equipe:{ moteurs:3, structure:3, bouclier:3, logiciel:3, atterrisseur:2 }, etoiles:{ temps:190, carb:0.2 },
      histoire:"Le vrai défi : un vaisseau et son propulseur géant partent vers l'orbite. Le passage de la pression maximale est le moment le plus délicat de la montée.",
      txt:'Monter jusqu\'en orbite en suivant la trajectoire (attention au passage de la pression maximale), se séparer du booster au bon moment, puis revenir : rentrée à plat, retournement, atterrissage.',
      vol:{ type:'orbite', pad:{ x:0, tol:30 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:78, etageA:.42 },
        rentree:{ y:9000, vy:-420, vx:30, x:-250, carb:.7 }, vent:.9, titre:'Vol orbital' } },
    { id:'booster', court:'Booster', nom:'Rattrapage du booster', ico:'🦾', equipe:{ moteurs:3, structure:2, bouclier:2, logiciel:5, atterrisseur:6 }, etoiles:{ temps:60, carb:0.5 },
      histoire:"Idée audacieuse : au lieu de poser le propulseur sur des jambes, la tour de lancement l'attrape en vol avec deux grands bras. Il faut arriver presque à l'arrêt, au millimètre.",
      txt:'Le propulseur redescend tout seul, droit, et doit être attrapé en vol par les bras de la tour : il faut arriver presque à l\'arrêt, pile à la hauteur des bras.',
      vol:{ type:'booster', pad:{ x:0, tol:26 }, tour:{ x:0, y:75, tol:6, v:4.5, ang:4.5 }, depart:{ phase:'vol', x:170, y:3800, vy:-150, vx:-6, carb:.7, th:2 }, vent:.9, titre:'Rattrapage du booster' } },
    { id:'vaisseau', court:'Vaisseau', nom:'Rattrapage du vaisseau', ico:'🚀', equipe:{ moteurs:4, structure:4, bouclier:5, logiciel:5, atterrisseur:5 }, etoiles:{ temps:190, carb:0.2 },
      histoire:"Le grand pari de la réutilisation : rattraper aussi le vaisseau au retour de l'orbite, pour pouvoir le relancer très vite.",
      txt:'Revenir de l\'orbite, descendre à plat, se retourner et se faire attraper par la tour : le but du programme, un vaisseau réutilisable.',
      vol:{ type:'vaisseau', pad:{ x:0, tol:20 }, tour:{ x:0, y:75, tol:4, v:3.4, ang:3.4 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:84, etageA:.42 },
        rentree:{ y:9000, vy:-430, vx:30, x:-260, carb:.7 }, vent:1, titre:'Retour du vaisseau' } },
    { id:'mars', court:'Mars', nom:'Cap sur Mars', ico:'🔴', equipe:{ moteurs:6, structure:6, bouclier:6, logiciel:6, atterrisseur:6 }, etoiles:{ temps:190, carb:0.2 },
      histoire:"Le but final : se poser sur une autre planète. L'air y est presque absent, donc il faut se retourner et allumer beaucoup plus tôt.",
      txt:'Atterrir sur Mars : un air presque absent (le vaisseau freine mal), une pesanteur plus faible, et pas de tour pour vous attraper. Il faut allumer tôt.',
      vol:{ type:'mars', pad:{ x:0, tol:30 }, belly:true, g:3.71, rho:.025, depart:{ phase:'programme' }, programme:{ duree:90, etageA:.42 },
        rentree:{ y:11000, vy:-380, vx:30, x:-300, carb:.8 }, vent:.4, titre:'Atterrissage sur Mars' } },
  ];

  /* ---------- Le vol ---------- */
  // ce que valent les niveaux pendant le vol
  function params(niv){
    const m = niv.moteurs, s = niv.structure, b = niv.bouclier, l = niv.logiciel, a = niv.atterrisseur;
    return { twr:1.85 + m * .07, autonomie:42 + m * 1.6 + s * 1.2, autonomieProg:60 + m * 3.2 + s * 2.2, resChaleur:55 + b * 9, resStructure:60 + s * 9, assist:l / 10,
      vAtterr:4.2 + a * .6, angAtterr:6 + a * 1.1, tolCoef:1 + a * .06 };
  }
  const KD_V = .0003, KD_B = .00056;
  const rhoDe = (v, y) => (v.spec.rho ?? 1) * Math.exp(-Math.max(0, y) / 8000);
  const gDe = v => v.spec.g || G0;

  function nouveauVol(spec, niv, opts = {}){
    const p = params(niv), d = spec.depart || {}, v = { spec, p, niv, t:0, phase:d.phase || 'vol', x:d.x || 0, y:d.y || 0, vx:d.vx || 0, vy:d.vy || 0, th:d.th || 0, om:0, gaz:0,
      carb:d.carb ?? 1, chaleur:0, contrainte:0, attaque:.4, jauge:0, etage:1, enVol:(d.y || 0) > 5, atteint:false, apogee:0, manque:false, fini:null, cause:'', msgs:[], flipT:0, tempsAuto:0,
      vent:(spec.vent ?? .5) * (opts.vent || 1), phi:(opts.phi || Math.random() * 6), action:false, gaz0:0, att:0, conso:0, budget:p.autonomie + (d.phase === 'programme' ? p.autonomieProg : 0), ecart:null, vImpact:null, angFinal:null };
    if(v.phase === 'programme'){ v.carb = 1; v.y = 0; v.enVol = false; v.th = 0; }
    return v;
  }
  const msg = (v, t, cls) => { v.msgs.push({ t, cls:cls || '', at:v.t }); };
  function fin(v, issue, cause){ if(v.fini) return; v.fini = issue; v.cause = cause || ''; }
  // l'explosion : « démontage rapide non planifié »
  const rud = (v, cause) => { v.gaz = 0; fin(v, 'echec', cause); };

  const vent = (v, y, t) => { const f = Math.sqrt(Math.exp(-Math.max(0, y) / 8000)) * clamp(.35 + y / 4000, .35, 1.1); return v.vent * f * (Math.sin(t * .6 + v.phi) + .6 * Math.sin(t * 1.7 + v.phi * 2)) * (1 - .65 * v.p.assist); };

  // un pas de simulation : e = { gauche, droite, gaz (bouton tenu), action (appuyé à l'instant) }
  function pas(v, e, dt){
    if(v.fini) return;
    v.t += dt;
    const p = v.p, g = gDe(v), dir = (e.droite ? 1 : 0) - (e.gauche ? 1 : 0);
    // la poussée : on monte en tenant le bouton, on redescend en le relâchant
    if(v.carb > 0){ v.gaz = clamp(v.gaz + (e.gaz ? 1.3 : -1.7) * dt, 0, 1); } else v.gaz = 0;
    if(v.phase === 'programme') return pasProgramme(v, e, dt, dir);
    if(v.phase === 'plat' || v.phase === 'flip') return pasChute(v, e, dt, dir);
    return pasVertical(v, e, dt, dir);
  }

  // la poussée consomme du carburant
  function brule(v, dt, autonomie){ v.carb = Math.max(0, v.carb - v.gaz * dt / autonomie); v.conso += v.gaz * dt; }

  function pasVertical(v, e, dt, dir){
    const p = v.p, g = gDe(v), at = v.gaz * (p.twr / (1 - .4 * (1 - Math.min(1, v.carb)))) * G0, th = v.th * RAD, rho = rhoDe(v, v.y);
    brule(v, dt, p.autonomie);
    if(!v.enVol){ // au sol, tant que la poussée ne dépasse pas le poids
      if(at <= g){ v.y = 0; v.vy = 0; v.vx = 0; v.th = 0; v.om = 0; return; }
      v.enVol = true; msg(v, 'Décollage !', 'bon');
    }
    const alpha = ((30 + 25 * p.assist) * (.25 + .75 * v.gaz)), damp = 1.4 + 2.6 * p.assist;
    v.om += (dir * alpha - v.om * damp) * dt;
    v.om += (Math.sin(v.t * 2.3 + v.phi) * .9) * (1 - .8 * p.assist) * dt * v.vent * Math.min(1, rho * 3);
    v.th += v.om * dt;
    if(Math.abs(v.th) > 72){ return rud(v, 'Le vaisseau a perdu le contrôle et a basculé.'); }
    const sp = Math.hypot(v.vx, v.vy), ailettes = dir * 2.6 * clamp(rho * sp * sp / 3000, 0, 1) * (1 - v.gaz * .6), ax = at * Math.sin(th) - KD_V * rho * sp * v.vx + vent(v, v.y, v.t) + ailettes, ay = at * Math.cos(th) - g - KD_V * rho * sp * v.vy;
    const vyAvant = v.vy, yAvant = v.y;
    v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
    v.apogee = Math.max(v.apogee, v.y);
    const sp2 = v.spec;
    if(sp2.type === 'saut' && !v.atteint && v.y >= sp2.cible){ v.atteint = true; msg(v, '150 m atteints : posez-vous sur l\'autre plateforme !', 'bon'); }
    if((sp2.type === 'altitude') && !v.atteint && v.y + (v.vy > 0 ? v.vy * v.vy / (2 * g) : 0) >= sp2.cible){ v.atteint = true; msg(v, 'Apogée prévu atteint : coupez les moteurs !', 'bon'); }
    // retournement à plat : on le demande au sommet, quand on retombe sans poussée
    if(sp2.belly && v.atteint && !v.retourne && v.vy < -3 && v.gaz < .05){
      v.tempsAuto += dt;
      if(e.action || v.tempsAuto > 2.5 + 2 * (1 - p.assist)){ v.phase = 'plat'; v.retourne = true; v.attaque = .4; msg(v, 'Retournement à plat : on descend comme une feuille', ''); return; }
    }
    // le rattrapage par les bras de la tour
    if(sp2.tour && yAvant > sp2.tour.y && v.y <= sp2.tour.y && v.vy < 0){
      const T = sp2.tour, tol = T.tol * p.tolCoef, ok = Math.abs(v.x - T.x) <= tol && Math.abs(v.vy) <= T.v * p.tolCoef && Math.abs(v.th) <= T.ang * p.tolCoef;
      if(ok){ v.gaz = 0; v.ecart = Math.abs(v.x - T.x); v.vImpact = Math.abs(v.vy); v.angFinal = Math.abs(v.th); return fin(v, 'succes', 'Rattrapé par les bras de la tour !'); }
      v.manque = true; msg(v, `Raté ! (écart ${Math.abs(v.x - T.x).toFixed(1)} m, vitesse ${Math.abs(v.vy).toFixed(1)} m/s, angle ${Math.abs(v.th).toFixed(1)}°)`, 'mal');
    }
    if(v.y <= 0 && v.vy < 0) contactSol(v);
  }

  function contactSol(v){
    const p = v.p, sp = v.spec, ecart = Math.abs(v.x - (sp.pad ? sp.pad.x : 0)), vit = Math.abs(v.vy), ang = Math.abs(v.th);
    v.y = 0; v.ecart = ecart; v.vImpact = vit; v.angFinal = ang;
    if(sp.tour) return rud(v, v.manque ? 'Les bras de la tour ont raté le vaisseau : il s\'est écrasé.' : 'Le vaisseau s\'est écrasé au pied de la tour.');
    if(vit > p.vAtterr) return rud(v, `Atterrissage trop brutal : ${vit.toFixed(1)} m/s (au plus ${p.vAtterr.toFixed(1)}).`);
    if(ang > p.angAtterr) return rud(v, `Atterrissage de travers : ${ang.toFixed(1)}° (au plus ${p.angAtterr.toFixed(1)}°).`);
    if(ecart > sp.pad.tol) return rud(v, `Posé à ${ecart.toFixed(0)} m de la plateforme (au plus ${sp.pad.tol} m) : il s'est renversé.`);
    v.vy = 0; v.vx = 0; v.gaz = 0;
    if(sp.type === 'saut' && !v.atteint) return fin(v, 'partiel', 'Posé en douceur, mais il n\'est pas monté jusqu\'à 150 m.');
    if(sp.type === 'altitude' && !v.atteint) return fin(v, 'partiel', 'Posé en douceur, mais sans avoir atteint 5 km.');
    fin(v, 'succes', 'Posé en douceur sur la plateforme !');
  }

  // la chute « à plat » (le ventre vers le bas) et le retournement
  function pasChute(v, e, dt, dir){
    const p = v.p, g = gDe(v), rho = rhoDe(v, v.y), sp = Math.hypot(v.vx, v.vy);
    if(v.phase === 'plat'){
      v.th = Math.min(90, v.th + 45 * dt);
      v.attaque = clamp(v.attaque + (e.gaz ? .55 : -.45) * dt, 0, 1);
      v.gaz = 0;
      if(e.action && v.th > 80){ v.phase = 'flip'; msg(v, 'Retournement !', ''); }
      const auto = altitudeRetournement(v) * (.5 + .55 * p.assist);
      if(v.phase === 'plat' && v.y < auto){ v.phase = 'flip'; msg(v, 'Retournement automatique (logiciel)', ''); }
    }
    let kd = KD_B * (.4 + v.attaque), at = 0, th = v.th * RAD;
    if(v.phase === 'flip'){
      v.th = Math.max(0, v.th - (30 + 20 * p.assist) * dt); th = v.th * RAD; kd = KD_V + (KD_B * (.4 + v.attaque) - KD_V) * (v.th / 90);
      at = v.gaz * (p.twr / (1 - .4 * (1 - Math.min(1, v.carb)))) * G0; brule(v, dt, p.autonomie);
      if(v.th <= 0){ v.th = 0; v.phase = 'vol'; v.om = 0; msg(v, 'Debout ! Allumez les moteurs au bon moment.', 'bon'); }
    }
    const auth = clamp(rho * sp * sp / 2500, .12, 1) * (1 - .5 * v.attaque), ctrl = v.phase === 'plat' ? dir * 6 * auth * (1 + p.assist * .3) : 0;
    const ax = at * Math.sin(th) - kd * rho * sp * v.vx + ctrl + vent(v, v.y, v.t) * Math.sqrt(Math.min(1, rho * 4)), ay = at * Math.cos(th) - g - kd * rho * sp * v.vy;
    v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
    // la chaleur : l'air épais et la vitesse ; le bouclier la supporte jusqu'à une limite
    v.chaleur = Math.max(0, v.chaleur + (rho * sp * sp * sp * 4.2e-7 * (1.25 - .45 * v.attaque) - 1.1) * dt);
    if(v.chaleur > v.p.resChaleur) return rud(v, 'Le bouclier thermique a lâché pendant la rentrée : le vaisseau a brûlé.');
    if(v.y <= 0 && v.vy < 0){ v.y = 0; return rud(v, 'Le vaisseau s\'est écrasé à plat, sans avoir eu le temps de se retourner.'); }
  }

  // la montée programmée (vol orbital) : suivre la trajectoire, passer la pression maximale en douceur, se séparer du booster
  const pitchCible = j => 82 * Math.pow(clamp(j, 0, 1), 1.25);
  function pasProgramme(v, e, dt, dir){
    const p = v.p, P = v.spec.programme;
    if(!v.enVol){ if(v.gaz < .05){ v.th = 0; return; } v.enVol = true; msg(v, 'Décollage !', 'bon'); }
    v.th = clamp(v.th + dir * (22 + 8 * p.assist) * (.4 + .6 * v.gaz) * dt, -10, 90);
    v.th += Math.sin(v.t * 1.3 + v.phi) * .5 * (1 - .8 * p.assist) * v.vent * dt * 4;
    const cible = pitchCible(v.jauge), err = Math.abs(v.th - cible), eff = 1 - clamp((err - 4) / 26, 0, .85);
    const consom = v.gaz * dt / p.autonomieProg; v.carb = Math.max(0, v.carb - consom); v.conso += v.gaz * dt;
    v.jauge += v.gaz * eff * dt / P.duree * (v.carb > 0 ? 1 : 0) * (v.etage === 1 ? 1 : 1.12);
    v.y = 120000 * Math.pow(clamp(v.jauge, 0, 1), 1.6); v.vy = v.gaz * 90 * eff; v.apogee = v.y;
    // la pression maximale (à peu près entre 18 % et 30 % de la montée)
    const maxQ = v.jauge > .17 && v.jauge < .31;
    if(maxQ && v.gaz > .72) v.contrainte += 26 * (v.gaz - .72) / .28 * dt * 1.6; else v.contrainte = Math.max(0, v.contrainte - 9 * dt);
    if(err > 22) v.contrainte += 9 * dt;
    v.maxQ = maxQ;
    if(v.contrainte > p.resStructure) return rud(v, maxQ ? 'La structure a cédé au passage de la pression maximale.' : 'La structure a cédé : trop loin de la trajectoire.');
    if(Math.abs(v.th - cible) > 38 && v.jauge > .02) return rud(v, 'Trop loin de la trajectoire : le contrôle de vol a déclenché l\'arrêt.');
    // séparation du booster
    if(v.etage === 1){
      if(v.jauge >= P.etageA - .04 && !v.fenetre){ v.fenetre = true; msg(v, 'Séparation du booster : appuyez sur SÉPARER !', 'bon'); }
      if(e.action && v.fenetre){ const d = Math.abs(v.jauge - P.etageA); v.etage = 2; v.sepPrecis = d; if(d > .04){ v.contrainte += 30; msg(v, 'Séparation un peu à côté : secousse !', 'mal'); } else msg(v, 'Séparation parfaite !', 'bon'); }
      if(v.jauge > P.etageA + .06){ v.etage = 2; v.contrainte += 55; msg(v, 'Séparation tardive : forte secousse !', 'mal'); }
    }
    if(v.carb <= 0 && v.jauge < 1) return rud(v, 'Panne sèche avant d\'atteindre l\'orbite.');
    if(v.jauge >= 1){
      const r = v.spec.rentree; v.phase = 'plat'; v.x = r.x; v.y = r.y; v.vx = r.vx; v.vy = r.vy; v.th = 90; v.carb = r.carb; v.gaz = 0; v.attaque = .4; v.chaleur = 0; v.contrainte = 0; v.atteint = true; v.enVol = true;
      msg(v, 'En orbite ! Rentrée dans l\'atmosphère…', 'bon');
    }
  }

  // l'altitude à laquelle il faut se retourner : le temps du retournement, puis la distance de freinage
  function altitudeRetournement(v){
    const g = gDe(v), aNet = Math.max(2, v.p.twr / (1 - .4 * (1 - Math.min(1, v.carb))) * G0 - g), vv = Math.abs(Math.min(0, v.vy));
    return vv * 3.2 + vv * vv / (2 * aNet) + (v.spec.tour ? v.spec.tour.y : 0);
  }
  // le calcul du point d'allumage conseillé : la hauteur à laquelle il faut pleine poussée pour s'arrêter
  function hauteurAllumage(v){
    const g = gDe(v), at = v.p.twr / (1 - .4 * (1 - Math.min(1, v.carb))) * G0 - g, vv = Math.abs(Math.min(0, v.vy));
    const cible = v.spec.tour ? v.spec.tour.y : 0;
    return at > 0 ? cible + vv * vv / (2 * at) : Infinity;
  }
  const apogeePrevu = v => v.y + (v.vy > 0 ? v.vy * v.vy / (2 * gDe(v)) : 0);

  /* ---------- Les résultats d'un vol : des étoiles, sans pénalité ---------- */
  // ★ réussi ; ★ dans le temps (large) ; ★ assez de carburant restant (large). Les autres mesures (précision, vitesse d'impact…) ne servent qu'à l'information.
  function notation(v, J){
    const restant = clamp(1 - v.conso / v.budget, 0, 1), r = { issue:v.fini, cause:v.cause, temps:v.t, restant, conso:v.conso, ecart:v.ecart, vImpact:v.vImpact, angle:v.angFinal, etoiles:0, criteres:[] };
    const okTemps = v.t <= J.etoiles.temps, okCarb = restant >= J.etoiles.carb;
    r.criteres = [{ txt:'Réussir le vol', ok:v.fini === 'succes' }, { txt:`Terminer en moins de ${J.etoiles.temps} s`, ok:v.fini === 'succes' && okTemps }, { txt:`Garder au moins ${Math.round(J.etoiles.carb * 100)} % de carburant`, ok:v.fini === 'succes' && okCarb }];
    r.etoiles = r.criteres.filter(c => c.ok).length;
    return r;
  }

  /* ---------- Un pilote automatique (pour les essais seulement) ---------- */
  function pilote(v, qualite = 1){
    const e = { gauche:false, droite:false, gaz:false, action:false }, sp = v.spec, th = v.th;
    const bouge = (cible, raideur = 1.6, amort = 3.5) => { const c = (cible - th) * raideur - v.om * amort; if(c > .8) e.droite = true; else if(c < -.8) e.gauche = true; };
    if(v.phase === 'programme'){
      bouge(pitchCible(v.jauge), 2, 0);
      const maxQ = v.jauge > .17 && v.jauge < .31;
      e.gaz = v.gaz < (maxQ ? .62 : 1);
      if(v.fenetre && v.etage === 1 && v.jauge >= sp.programme.etageA) e.action = true;
      return e;
    }
    if(v.phase === 'plat'){
      const tx = sp.tour ? sp.tour.x : (sp.pad ? sp.pad.x : 0), axD = .05 * (tx - v.x) - .55 * v.vx;
      if(axD > .5) e.droite = true; else if(axD < -.5) e.gauche = true;
      e.gaz = v.attaque < (v.chaleur > 25 || Math.abs(v.vy) > 160 ? .8 : .45);
      if(v.y < altitudeRetournement(v) * 1.05 * qualite && v.th > 80) e.action = true;
      return e;
    }
    if(v.phase === 'flip'){ e.gaz = v.y < hauteurAllumage(v) * 1.1; return e; }
    // vol vertical : montée, translation (le saut), puis atterrissage en suivant une courbe de freinage
    const tx = sp.tour ? sp.tour.x : sp.pad.x, g = gDe(v), aNet = v.p.twr / (1 - .4 * (1 - Math.min(1, v.carb))) * G0 - g;
    if(!v.atteint && (sp.type === 'saut' || sp.type === 'altitude')){
      e.gaz = sp.type === 'saut' ? (v.y < 100 ? v.vy < 30 : v.vy < 6 + (150 - v.y) * .2) : true; bouge(0, 2, 3.5); return e;
    }
    const dx = tx - v.x, yc = sp.tour ? sp.tour.y : 0;
    if(sp.type === 'saut' && (Math.abs(dx) > 6 || Math.abs(v.vx) > 1.5) && v.y > 30){
      const axD = .045 * dx - .42 * v.vx, thT = clamp(axD * 5.84, -10, 10); bouge(thT, 2.2, 3.5);
      e.gaz = v.vy < (100 - v.y) * .15; return e;
    }
    const axD = (v.y > yc + 250 ? .06 * dx - .5 * v.vx : .02 * dx - .32 * v.vx), thT = clamp(axD * 5.84, -9, 9);
    if(v.y > yc + 120 && sp.type === 'booster'){ if(axD > .35) e.droite = true; else if(axD < -.35) e.gauche = true; }
    else bouge(v.y < yc + 6 ? 0 : thT, 2.4, 3.8);
    const vDes = -Math.max(sp.tour ? 1.2 : 1.6, Math.sqrt(2 * .6 * Math.max(.1, aNet) * Math.max(0, v.y - yc - .5 * Math.abs(Math.min(0, v.vy)))));
    e.gaz = v.vy < vDes + .5;
    if(v.y > yc + 3 && v.vy > vDes && v.gaz < .05) e.gaz = false;
    return e;
  }
  // un vol entier avec le pilote automatique (pour mesurer la difficulté)
  function simuler(spec, niv, qualite = 1, opts = {}){
    const v = nouveauVol(spec, niv, { vent:opts.vent || 1, phi:opts.phi ?? 1 }); let n = 0;
    while(!v.fini && n++ < 60 * 400){ const e = pilote(v, qualite); pas(v, e, 1 / 60); }
    return v;
  }

  function tests(){
    const r = [], ok = (c, t) => r.push((c ? '✅ ' : '❌ ') + t);
    for(const J of JALONS){
      let g = 0, e3 = 0; const tt = [], rr = [];
      for(let i = 0; i < 6; i++){ const v = simuler(J.vol, J.equipe, 1, { phi:i }); if(v.fini === 'succes'){ g++; const n = notation(v, J); if(n.etoiles === 3) e3++; tt.push(v.t); rr.push(n.restant); } }
      ok(g >= 4, `${J.nom} : ${g}/6 réussis par le pilote automatique (3 étoiles : ${e3}/6 ; temps ${tt.length ? Math.round(Math.max(...tt)) : '–'} s au plus ; carburant restant ${rr.length ? Math.round(Math.min(...rr) * 100) : '–'} % au moins)`);
    }
    return r;
  }

  return { JALONS, params, nouveauVol, pas, hauteurAllumage, altitudeRetournement, apogeePrevu, pitchCible, notation, pilote, simuler, tests, gDe, rhoDe };
})();
