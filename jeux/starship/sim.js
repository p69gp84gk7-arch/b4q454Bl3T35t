/* Starship : le programme. La logique du jeu, sans dessin (ce fichier tourne aussi avec Node pour les essais) :
   - la gestion : budget, équipes, cinq domaines à améliorer, prototypes, événements, niveaux à franchir ;
   - le vol : un petit simulateur en deux dimensions (poussée, gravité, air, vent, chaleur, rentrée en « ventre à terre »,
     retournement, atterrissage ou rattrapage par la tour).
   Inspiré de l'histoire publique du programme Starship (sauts, haute altitude, vol orbital, rattrapage du booster…).
   Les dessins, les chiffres et le jeu sont originaux : ce n'est pas un jeu officiel. */
window.STARSHIP_SIM = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), RAD = Math.PI / 180;
  const G0 = 9.81;

  /* ---------- Les niveaux (d'après l'histoire du programme, en plus simple) ---------- */
  // equipe : les niveaux de technologie du vaisseau pour ce niveau (fixes : on ne les achète pas) ; etoiles : les objectifs en temps et en carburant ; vol : ce qu'il faut réussir
  const E0 = { moteurs:0, structure:0, bouclier:0, logiciel:0, atterrisseur:0 };
  const NIVEAUX = [
    { id:'saut', court:'Saut', nom:'Le premier saut', ico:'🐸', equipe:E0, etoiles:{ temps:60, carb:.35 }, chapitre:'Les débuts',
      histoire:"Au début du programme, un petit prototype trapu, posé sur trois jambes, ne fait que de petits sauts. Chaque hop vérifie qu'un moteur sait décoller, rester stable… et se reposer.",
      txt:'Un petit prototype décolle, monte à 150 m, puis se pose sur l\'autre plateforme, à 70 m de là.',
      vol:{ type:'saut', kind:'hop', cible:150, pad:{ x:70, tol:28 }, depart:{ phase:'vol' }, vent:.3, titre:'Saut à 150 m' } },
    { id:'precision', court:'Précision', nom:'Saut de précision', ico:'🎯', equipe:{ ...E0, moteurs:1, logiciel:1, atterrisseur:1 }, etoiles:{ temps:70, carb:.3 }, chapitre:'Les débuts',
      histoire:"Après le premier saut, les ingénieurs veulent savoir se poser exactement où il faut : la plateforme est plus loin et plus petite, et il y a un peu de vent.",
      txt:'Monte à 150 m, puis glisse jusqu\'à la petite plateforme, 120 m plus loin, et pose-toi dessus.',
      vol:{ type:'saut', kind:'hop', cible:150, pad:{ x:120, tol:20 }, depart:{ phase:'vol' }, vent:.6, titre:'Saut de précision' } },
    { id:'altitude', court:'5 km', nom:'Haute altitude', ico:'🛰️', equipe:{ ...E0, moteurs:1, logiciel:2, atterrisseur:2 }, etoiles:{ temps:130, carb:.08 }, chapitre:'Les débuts',
      histoire:'Ensuite viennent les vols plus hauts, avec la figure de style de Starship : couper les moteurs, descendre à plat comme une feuille, se retourner au dernier moment et se poser.',
      txt:'Monter à 5 km, couper les moteurs, descendre « à plat » comme une feuille, se retourner au dernier moment et se poser.',
      vol:{ type:'altitude', kind:'starship', cible:5000, pad:{ x:0, tol:36 }, belly:true, depart:{ phase:'vol' }, vent:.8, titre:'Vol à 5 km' } },
    { id:'haute8', court:'8 km', nom:'Plus haut : 8 km', ico:'☁️', equipe:{ ...E0, moteurs:4, structure:3, bouclier:2, logiciel:3, atterrisseur:3 }, etoiles:{ temps:140, carb:.05 }, chapitre:'Les débuts',
      histoire:"Les vols suivants montent encore plus haut : plus d'air mince à traverser, une chute plus longue et plus rapide. Le ventre à terre chauffe davantage.",
      txt:'Monter à 8 km, couper les moteurs, descendre à plat en gardant le bouclier au frais, se retourner à temps et se poser.',
      vol:{ type:'altitude', kind:'starship', cible:8000, pad:{ x:0, tol:34 }, belly:true, depart:{ phase:'vol' }, vent:.9, titre:'Vol à 8 km' } },
    { id:'falcon', court:'Falcon 9', nom:'Falcon 9 : un satellite en orbite', ico:'🛰️', equipe:{ ...E0, moteurs:2, structure:2, logiciel:2 }, etoiles:{ temps:120, carb:.3 }, chapitre:'Falcon 9 et Dragon',
      histoire:"La fusée à deux étages qui a rendu le lancement presque routinier : le premier étage pousse fort jusqu'à la séparation, puis le second étage place le satellite en orbite.",
      txt:'Décoller, suivre la trajectoire (relâche la poussée au passage de la pression maximale), séparer les deux étages au bon moment et mettre le satellite en orbite.',
      vol:{ type:'falcon', kind:'falconPile', kindHaut:'falcon2', decor:'terre', pad:{ x:0, tol:30 }, depart:{ phase:'programme' }, programme:{ duree:62, etageA:.4 }, finOrbite:true, vent:.8, titre:'Falcon 9 : lancement' } },
    { id:'barge', court:'Barge', nom:'Falcon 9 : la barge en mer', ico:'🚢', equipe:{ ...E0, moteurs:2, logiciel:3, atterrisseur:3 }, etoiles:{ temps:70, carb:.45 }, chapitre:'Falcon 9 et Dragon',
      histoire:"Le premier étage ne finit pas à la mer : il revient se poser, debout, sur une barge qui l'attend au large. Ses ailettes de guidage le dirigent, puis un seul moteur le freine au dernier moment.",
      txt:'Le premier étage redescend : guide-le avec les ailettes (◀ ▶), allume au bon moment et pose-toi debout sur la barge.',
      vol:{ type:'barge', kind:'falcon9', decor:'mer', pad:{ x:0, tol:24 }, depart:{ phase:'vol', x:120, y:3500, vy:-150, vx:-5, carb:.6, th:1 }, vent:.9, titre:'Atterrissage sur la barge' } },
    { id:'bargeVent', court:'Barge (vent)', nom:'Falcon 9 : la barge par grand vent', ico:'🌬️', equipe:{ ...E0, moteurs:2, logiciel:3, atterrisseur:4 }, etoiles:{ temps:75, carb:.4 }, chapitre:'Falcon 9 et Dragon',
      histoire:"En mer, le vent ne prévient pas. Le premier étage doit corriger plus souvent sa trajectoire pour rester au-dessus de la barge, qui bouge un peu.",
      txt:'Même atterrissage que sur la barge, mais avec un vent bien plus fort et un départ plus décalé : corrige tôt avec les ailettes.',
      vol:{ type:'barge', kind:'falcon9', decor:'mer', pad:{ x:0, tol:22 }, depart:{ phase:'vol', x:210, y:3500, vy:-150, vx:-8, carb:.6, th:1 }, vent:1.7, titre:'Barge par grand vent' } },
    { id:'dragon', court:'Dragon', nom:'Dragon : retour sous parachutes', ico:'🛟', equipe:{ ...E0, structure:1, bouclier:3, logiciel:2, atterrisseur:2 }, etoiles:{ temps:200, vimp:10 }, chapitre:'Falcon 9 et Dragon',
      histoire:"La capsule Dragon revient de l'orbite : le bouclier thermique encaisse la rentrée, puis des parachutes la ralentissent jusqu'à la mer. Les ouvrir trop tôt, à pleine vitesse, les déchirerait.",
      txt:'Descendre sans bouffer le bouclier, puis ouvrir les parachutes quand la capsule est assez lente et pas trop haute, pour amerrir doucement.',
      vol:{ type:'dragon', kind:'dragon', decor:'mer', pad:{ x:0, tol:300 }, depart:{ phase:'capsule', x:-200, y:5500, vx:30, vy:-300, th:0 }, vent:.6, titre:'Retour de Dragon' } },
    { id:'ecole', court:'Rentrée', nom:'École de rentrée', ico:'🔥', equipe:{ moteurs:3, structure:3, bouclier:3, logiciel:3, atterrisseur:3 }, etoiles:{ temps:190, carb:.25 }, chapitre:'Starship',
      histoire:"Avant d'aller en orbite, un entraînement : le vaisseau est déjà là-haut, à vitesse orbitale, et ne pense qu'à rentrer. L'angle d'attaque décide de tout : brûler, rebondir, ou arriver en douceur.",
      txt:'Le vaisseau commence au sommet de la rentrée. Garde le bon angle d\'attaque (losange bleu), puis chute à plat, retourne-toi et pose-toi sur la plateforme.',
      vol:{ type:'rentree', kind:'starship', decor:'terre', pad:{ x:0, tol:42 }, belly:true, depart:{ phase:'rentree' }, rentree:{ y:9000, vy:-420, vx:30, x:-250, carb:.7, orb:{ y:100000, vx:7400, vy:-110 }, dist:3.97e6 }, vent:.9, titre:'École de rentrée' } },
    { id:'boosterPose', court:'SH (sol)', nom:'Super Heavy : posé sur la plateforme', ico:'🛬', equipe:{ moteurs:3, structure:2, bouclier:2, logiciel:4, atterrisseur:5 }, etoiles:{ temps:60, carb:.5 }, chapitre:'Starship',
      histoire:"Avant d'oser l'attraper en vol, on apprend au propulseur à se poser doucement, debout, sur sa plateforme : c'est la première étape du retour.",
      txt:'Le propulseur redescend tout seul, droit. Guide-le avec les ailettes, allume au bon moment et pose-le doucement sur la plateforme.',
      vol:{ type:'booster', kind:'superheavy', decor:'terre', pad:{ x:0, tol:30 }, depart:{ phase:'vol', x:190, y:3800, vy:-150, vx:-6, carb:.7, th:2 }, vent:.8, titre:'Super Heavy : pose' } },
    { id:'orbite', court:'Orbite', nom:'Starship : premier vol orbital', ico:'🌍', equipe:{ moteurs:3, structure:3, bouclier:3, logiciel:3, atterrisseur:2 }, etoiles:{ temps:290, carb:.2 }, chapitre:'Starship',
      histoire:"Le vrai défi : un vaisseau et son propulseur géant partent vers l'orbite. Le passage de la pression maximale est le moment le plus délicat de la montée.",
      txt:'Monter jusqu\'en orbite en suivant la trajectoire, se séparer du propulseur au bon moment, puis revenir : rentrée à plat, retournement, atterrissage.',
      vol:{ type:'orbite', kind:'shPile', kindHaut:'starship', decor:'terre', pad:{ x:0, tol:42 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:78, etageA:.42 },
        rentree:{ y:9000, vy:-420, vx:30, x:-250, carb:.7, orb:{ y:100000, vx:7400, vy:-110 }, dist:3.97e6 }, vent:.9, titre:'Vol orbital' } },
    { id:'booster', court:'Super Heavy', nom:'Super Heavy : rattrapé par la tour', ico:'🦾', equipe:{ moteurs:3, structure:2, bouclier:2, logiciel:5, atterrisseur:6 }, etoiles:{ temps:60, carb:.5 }, chapitre:'Starship',
      histoire:"Idée audacieuse : au lieu de poser le propulseur sur des jambes, la tour de lancement l'attrape en vol avec deux grands bras. Il faut arriver presque à l'arrêt, au bon endroit.",
      txt:'Le propulseur redescend tout seul, droit, et doit être attrapé en vol par les bras de la tour : arrive presque à l\'arrêt, à la hauteur des bras.',
      vol:{ type:'booster', kind:'superheavy', decor:'terre', pad:{ x:0, tol:26 }, tour:{ x:0, y:75, tol:17, v:12, ang:14 }, depart:{ phase:'vol', x:170, y:3800, vy:-150, vx:-6, carb:.7, th:2 }, vent:.9, titre:'Rattrapage du booster' } },
    { id:'vaisseau', court:'Vaisseau', nom:'Starship : rattrapé par la tour', ico:'🚀', equipe:{ moteurs:4, structure:4, bouclier:5, logiciel:5, atterrisseur:5 }, etoiles:{ temps:300, carb:.2 }, chapitre:'Starship',
      histoire:"Le grand pari de la réutilisation : rattraper aussi le vaisseau au retour de l'orbite, pour pouvoir le relancer très vite.",
      txt:'Revenir de l\'orbite, descendre à plat, se retourner et se faire attraper par la tour.',
      vol:{ type:'vaisseau', kind:'shPile', kindHaut:'starship', decor:'terre', pad:{ x:0, tol:20 }, tour:{ x:0, y:75, tol:16, v:11, ang:13 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:84, etageA:.42 },
        rentree:{ y:9000, vy:-430, vx:30, x:-260, carb:.7, orb:{ y:100000, vx:7400, vy:-110 }, dist:3.97e6 }, vent:1, titre:'Retour du vaisseau' } },
    { id:'mission', court:'Mission', nom:'Mission complète : booster + Starship', ico:'🛰️', equipe:{ moteurs:5, structure:5, bouclier:5, logiciel:5, atterrisseur:5 }, etoiles:{ temps:380, carb:.1 }, chapitre:'Starship',
      histoire:"Tout le programme d'un seul coup, comme un vrai vol : décollage de la pile, séparation, retour du propulseur vers la tour, puis le vaisseau file en orbite, redescend à vitesse orbitale et revient lui aussi se poser dans les bras de la tour.",
      txt:'Monter, se séparer, ramener le propulseur dans les bras de la tour, puis mettre le vaisseau en orbite, gérer l\'angle d\'attaque de la rentrée, retourner à plat et se faire rattraper à son tour.',
      vol:{ type:'mission', kind:'shPile', kindHaut:'starship', decor:'terre', pad:{ x:0, tol:20 }, tour:{ x:0, y:75, tol:16, v:11, ang:13 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:84, etageA:.42 },
        retour:{ x:420, y:5200, vx:-40, vy:-210, carb:.7, th:0 }, rentree:{ y:9000, vy:-430, vx:30, x:-260, carb:.7, orb:{ y:100000, vx:7400, vy:-110 }, dist:3.97e6 }, vent:1, titre:'Mission complète' } },
    { id:'lune', court:'Lune', nom:'Starship HLS : la Lune', ico:'🌕', equipe:{ moteurs:4, structure:3, bouclier:0, logiciel:3, atterrisseur:4 }, etoiles:{ temps:90, carb:.35 }, chapitre:'Au-delà',
      histoire:"Starship doit aussi servir d'atterrisseur lunaire. Sans air, pas de ventre à terre : on descend debout, droit sur les moteurs, avec une pesanteur six fois plus faible.",
      txt:'Descendre debout vers la Lune : pas d\'air, donc pas d\'ailettes ; tout se joue au moteur et à l\'inclinaison. Pose-toi sur la plateforme.',
      vol:{ type:'lune', kind:'starship', decor:'lune', g:1.62, rho:0, pmax:.3, pad:{ x:0, tol:45 }, depart:{ phase:'vol', x:-60, y:2000, vy:-50, vx:0, carb:.55, th:0 }, vent:0, titre:'Alunissage' } },
    { id:'lune2', court:'Lune (bis)', nom:'Starship HLS : plateforme décalée', ico:'🌖', equipe:{ moteurs:4, structure:3, bouclier:0, logiciel:3, atterrisseur:5 }, etoiles:{ temps:100, carb:.3 }, chapitre:'Au-delà',
      histoire:"Sur la Lune, il n'y a pas de piste : le site d'alunissage est choisi à l'avance, et le vaisseau arrive toujours un peu à côté. Il faut le rattraper avant de toucher.",
      txt:'Même alunissage, mais le vaisseau arrive de plus loin avec une vitesse latérale : corrige-la tôt et pose-toi sur la plateforme.',
      vol:{ type:'lune', kind:'starship', decor:'lune', g:1.62, rho:0, pmax:.3, pad:{ x:0, tol:38 }, depart:{ phase:'vol', x:-220, y:2400, vy:-55, vx:9, carb:.55, th:0 }, vent:0, titre:'Alunissage décalé' } },
    { id:'mars', court:'Mars', nom:'Cap sur Mars', ico:'🔴', equipe:{ moteurs:6, structure:6, bouclier:6, logiciel:6, atterrisseur:6 }, etoiles:{ temps:190, carb:.2 }, chapitre:'Au-delà',
      histoire:"Le but final : se poser sur une autre planète. L'air y est presque absent, donc il faut se retourner et allumer beaucoup plus tôt.",
      txt:'Atterrir sur Mars : un air presque absent (le vaisseau freine mal), une pesanteur plus faible, et pas de tour pour vous attraper. Il faut allumer tôt.',
      vol:{ type:'mars', kind:'shPile', kindHaut:'starship', decor:'mars', pad:{ x:0, tol:48 }, belly:true, g:3.71, rho:.025, depart:{ phase:'programme' }, programme:{ duree:90, etageA:.42 },
        rentree:{ y:11000, vy:-380, vx:30, x:-300, carb:.8 }, vent:.4, titre:'Atterrissage sur Mars' } },
  ];

  /* ---------- Le vol ---------- */
  // ce que valent les niveaux pendant le vol
  function params(niv){
    const m = niv.moteurs, s = niv.structure, b = niv.bouclier, l = niv.logiciel, a = niv.atterrisseur;
    return { twr:1.85 + m * .07, autonomie:42 + m * 1.6 + s * 1.2, autonomieProg:60 + m * 3.2 + s * 2.2, resChaleur:55 + b * 9, resStructure:60 + s * 9, assist:l / 10,
      vAtterr:9 + a * .7, angAtterr:15 + a * 1.2, tolCoef:1 + a * .06 };
  }
  const KD_V = .0003, KD_B = .00056;
  const rhoDe = (v, y) => (v.spec.rho ?? 1) * Math.exp(-Math.max(0, y) / 8000);
  const gDe = v => v.spec.g || G0;

  function nouveauVol(spec, niv, opts = {}){
    const p = params(niv), d = spec.depart || {}, v = { spec, p, niv, t:0, phase:d.phase || 'vol', x:d.x || 0, y:d.y || 0, vx:d.vx || 0, vy:d.vy || 0, th:d.th || 0, om:0, gaz:0,
      carb:d.carb ?? 1, chaleur:0, contrainte:0, attaque:.4, jauge:0, etage:1, enVol:(d.y || 0) > 5, atteint:false, apogee:0, manque:false, fini:null, cause:'', msgs:[], flipT:0, tempsAuto:0,
      vent:(spec.vent ?? .5) * (opts.vent || 1), phi:(opts.phi ?? Math.random() * 6), action:false, gaz0:0, att:0, conso:0, budget:p.autonomie + (d.phase === 'programme' ? p.autonomieProg : 0), ecart:null, vImpact:null, angFinal:null };
    if(v.phase === 'programme'){ v.carb = 1; v.y = 0; v.enVol = false; v.th = 0; }
    if(v.phase === 'rentree') debutRentree(v);
    return v;
  }
  const msg = (v, t, cls) => { v.msgs.push({ t, cls:cls || '', at:v.t }); };
  function fin(v, issue, cause){
    if(v.fini) return;
    // mission complète : la fin du retour du booster (rattrapé ou perdu) rend la main au vaisseau
    if(v.segment === 'booster'){      // le retour du propulseur est fini : on le montre 2,6 s (rattrapé ou écrasé), puis on reprend le vaisseau
      v.boosterOk = issue === 'succes'; v.segment = 'retourFin'; v.transT = 2.6; v.causeB = cause; v.gaz = 0; v.vx = 0; v.vy = 0; v.xB = v.x; v.yB = Math.max(0, v.y); if(!v.boosterOk) v.y = 0;
      (v.fx = v.fx || []).push({ k:v.boosterOk ? 'prise' : 'boum', x:v.xB, y:v.yB }); msg(v, v.boosterOk ? 'Propulseur rattrapé par les bras de la tour !' : 'Le propulseur s\'est écrasé…', v.boosterOk ? 'bon' : 'mal'); return;
    }
    if(issue === 'succes' && v.spec.retour && !v.boosterOk){ issue = 'partiel'; cause = 'Vaisseau rattrapé, mais le propulseur a été perdu : la mission n\'est pas complète.'; }
    v.fini = issue; v.cause = cause || '';
  }
  // l'explosion : « démontage rapide non planifié »
  const rud = (v, cause) => { v.gaz = 0; fin(v, 'echec', cause); };

  const vent = (v, y, t) => { const f = Math.sqrt(Math.exp(-Math.max(0, y) / 8000)) * clamp(.35 + y / 4000, .35, 1.1); return v.vent * f * (Math.sin(t * .6 + v.phi) + .6 * Math.sin(t * 1.7 + v.phi * 2)) * (1 - .65 * v.p.assist); };

  // un pas de simulation : e = { gauche, droite, gaz (bouton tenu), action (appuyé à l'instant) }
  function pas(v, e, dt){
    if(v.fini) return;
    v.t += dt;
    if(v.segment === 'retourFin'){ v.transT -= dt; v.gaz = 0; if(v.transT <= 0){ v.segment = 'nave'; reprendreNave(v, v.boosterOk, v.causeB); } return; }
    const p = v.p, g = gDe(v), dir = e.dir != null ? clamp(e.dir, -1, 1) : (e.droite ? 1 : 0) - (e.gauche ? 1 : 0);
    // la poussée : avec un curseur (e.cible, de 0 à 1), le moteur suit le curseur ; avec un bouton, on monte en le tenant et on redescend en le relâchant
    if(v.carb > 0){ v.gaz = e.cible != null ? clamp(v.gaz + clamp(e.cible - v.gaz, -3 * dt, 2.4 * dt), 0, 1) : clamp(v.gaz + (e.gaz ? 2.2 : -3) * dt, 0, 1); } else v.gaz = 0;
    // le plasma de la rentrée : il suit le flux de chaleur du moment (pas la chaleur accumulée) et s'éteint quand l'air s'allège ; la chaleur, elle, refroidit hors rentrée
    v.plasma = Math.max(0, (v.plasma || 0) - 3.5 * dt);
    if(v.phase === 'flip' || v.phase === 'vol') v.chaleur = Math.max(0, v.chaleur - 8 * dt);
    if(v.phase === 'programme') return pasProgramme(v, e, dt, dir);
    if(v.phase === 'capsule') return pasCapsule(v, e, dt, dir);
    if(v.phase === 'rentree') return pasRentree(v, e, dt, dir);
    if(v.phase === 'plat' || v.phase === 'flip') return pasChute(v, e, dt, dir);
    return pasVertical(v, e, dt, dir);
  }

  const angleMax = p => 16 + 8 * p.assist;       // l'angle (°) que le curseur de direction commande à fond
  // la poussée consomme du carburant
  function brule(v, dt, autonomie){ v.carb = Math.max(0, v.carb - v.gaz * dt / autonomie); v.conso += v.gaz * dt; }

  function pasVertical(v, e, dt, dir){
    const p = v.p, g = gDe(v), at = v.gaz * (p.twr / (1 - .4 * (1 - Math.min(1, v.carb)))) * G0 * (v.spec.pmax ?? 1), th = v.th * RAD, rho = rhoDe(v, v.y);
    brule(v, dt, p.autonomie);
    if(!v.enVol){ // au sol, tant que la poussée ne dépasse pas le poids
      if(at <= g){ v.y = 0; v.vy = 0; v.vx = 0; v.th = 0; v.om = 0; return; }
      v.enVol = true; msg(v, 'Décollage !', 'bon');
    }
    // la direction commande un ANGLE : le curseur à fond penche de ±(16 à 24)°, le logiciel de vol tient cet angle tout seul (et revient à la verticale quand on lâche)
    const kp = (16 + 14 * p.assist) * (.5 + .5 * Math.min(1, v.gaz * 1.5 + .3)), kd = 1.7 * Math.sqrt(kp);
    v.om += ((dir * angleMax(p) - v.th) * kp - v.om * kd) * dt;
    v.om += (Math.sin(v.t * 2.3 + v.phi) * .9) * (1 - .8 * p.assist) * dt * v.vent * Math.min(1, rho * 3);
    v.th += v.om * dt;
    if(Math.abs(v.th) > 72){ return rud(v, 'Le vaisseau a perdu le contrôle et a basculé.'); }
    const sp = Math.hypot(v.vx, v.vy), ailettes = dir * 2.6 * clamp(rho * sp * sp / 3000, 0, 1) * (1 - v.gaz * .6), ax = at * Math.sin(th) - KD_V * rho * sp * v.vx + vent(v, v.y, v.t) + ailettes, ay = at * Math.cos(th) - g - KD_V * rho * sp * v.vy;
    const vyAvant = v.vy, yAvant = v.y;
    v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
    v.apogee = Math.max(v.apogee, v.y);
    const sp2 = v.spec;
    if(sp2.type === 'saut' && !v.atteint && v.y >= sp2.cible){ v.atteint = true; msg(v, `${sp2.cible} m atteints : posez-vous sur l'autre plateforme !`, 'bon'); }
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
    if(sp.type === 'saut' && !v.atteint) return fin(v, 'partiel', `Posé en douceur, mais il n'est pas monté jusqu'à ${sp.cible} m.`);
    if(sp.type === 'altitude' && !v.atteint) return fin(v, 'partiel', `Posé en douceur, mais sans avoir atteint ${Math.round(sp.cible / 1000)} km.`);
    fin(v, 'succes', 'Posé en douceur sur la plateforme !');
  }

  // la chute « à plat » (le ventre vers le bas) et le retournement
  function pasChute(v, e, dt, dir){
    const p = v.p, g = gDe(v), rho = rhoDe(v, v.y), sp = Math.hypot(v.vx, v.vy);
    if(v.phase === 'plat'){
      v.th = Math.min(90, v.th + 45 * dt);
      v.attaque = e.cible != null ? clamp(v.attaque + clamp(e.cible - v.attaque, -.6 * dt, .6 * dt), 0, 1) : clamp(v.attaque + (e.gaz ? .55 : -.45) * dt, 0, 1);
      v.gaz = 0;
      if(e.action && v.th > 80){ v.phase = 'flip'; msg(v, 'Retournement !', ''); }
      const auto = altitudeRetournement(v) * (.5 + .55 * p.assist);
      if(v.phase === 'plat' && v.y < auto){ v.phase = 'flip'; msg(v, 'Retournement automatique (logiciel)', ''); }
    }
    let kd = KD_B * (.4 + v.attaque), at = 0, th = v.th * RAD;
    if(v.phase === 'flip'){
      v.th = Math.max(0, v.th - (30 + 20 * p.assist) * dt); th = v.th * RAD; kd = KD_V + (KD_B * (.4 + v.attaque) - KD_V) * (v.th / 90);
      at = v.gaz * (p.twr / (1 - .4 * (1 - Math.min(1, v.carb)))) * G0 * (v.spec.pmax ?? 1); brule(v, dt, p.autonomie);
      if(v.th <= 0){ v.th = 0; v.phase = 'vol'; v.om = 0; msg(v, 'Debout ! Allumez les moteurs au bon moment.', 'bon'); }
    }
    const auth = clamp(rho * sp * sp / 2500, .12, 1) * (1 - .5 * v.attaque), ctrl = v.phase === 'plat' ? dir * 6 * auth * (1 + p.assist * .3) : 0;
    const ax = at * Math.sin(th) - kd * rho * sp * v.vx + ctrl + vent(v, v.y, v.t) * Math.sqrt(Math.min(1, rho * 4)), ay = at * Math.cos(th) - g - kd * rho * sp * v.vy;
    v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
    // la chaleur : l'air épais et la vitesse ; le bouclier la supporte jusqu'à une limite
    const flux = rho * sp * sp * sp * 4.2e-7 * (1.25 - .45 * v.attaque); v.plasma = Math.max(v.plasma || 0, Math.min(1, flux / 9));
    v.chaleur = Math.max(0, v.chaleur + (flux - 1.1) * dt);
    if(v.chaleur > v.p.resChaleur) return rud(v, 'Le bouclier thermique a lâché pendant la rentrée : le vaisseau a brûlé.');
    if(v.y <= 0 && v.vy < 0){ v.y = 0; return rud(v, 'Le vaisseau s\'est écrasé à plat, sans avoir eu le temps de se retourner.'); }
  }

  // la capsule Dragon : bouclier thermique vers le bas, puis parachutes
  const KD_CAPSULE = .0009, KD_CHUTE = .13;
  function pasCapsule(v, e, dt, dir){
    const p = v.p, g = gDe(v), rho = rhoDe(v, v.y), sp = Math.hypot(v.vx, v.vy);
    v.gaz = 0; v.th = 0;
    if(!v.chute && (e.action || (p.assist > .25 && v.y < 1100 && sp < 190))){
      if(sp > 230) return rud(v, `Les parachutes se sont déchirés : ouverts à ${sp.toFixed(0)} m/s (au plus 230).`);
      v.chute = true; msg(v, 'Parachutes ouverts !', 'bon');
    }
    if(v.chute) v.chuteK = Math.min(1, (v.chuteK || 0) + dt / 2.5);
    const k = v.chute ? KD_CAPSULE + (KD_CHUTE - KD_CAPSULE) * v.chuteK : KD_CAPSULE;
    const auth = clamp(rho * sp * sp / 2500, .1, 1), ctrl = dir * (v.chute ? 1.6 : 4) * auth;
    const ax = -k * rho * sp * v.vx + ctrl + vent(v, v.y, v.t) * Math.sqrt(Math.min(1, rho * 4)), ay = -g - k * rho * sp * v.vy;
    v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
    const fluxC = rho * sp * sp * sp * 3e-7; v.plasma = Math.max(v.plasma || 0, Math.min(1, fluxC / 5));
    v.chaleur = Math.max(0, v.chaleur + (fluxC - 1.1) * dt);
    if(v.chaleur > p.resChaleur) return rud(v, 'Le bouclier thermique de la capsule a lâché pendant la rentrée.');
    if(v.y <= 0 && v.vy < 0){
      v.y = 0; const vit = Math.abs(v.vy), ecart = Math.abs(v.x - v.spec.pad.x); v.ecart = ecart; v.vImpact = vit; v.angFinal = 0;
      if(!v.chute) return rud(v, 'La capsule est arrivée sans parachutes.');
      if(vit > 16) return rud(v, `Amerrissage trop brutal : ${vit.toFixed(1)} m/s (au plus 16).`);
      v.vy = 0; v.vx = 0;
      if(ecart > v.spec.pad.tol) return fin(v, 'partiel', 'Amerri en douceur, mais trop loin du bateau de récupération.');
      fin(v, 'succes', 'Amerri en douceur, près du bateau de récupération !');
    }
  }

  // la montée programmée (vol orbital) : suivre la trajectoire, passer la pression maximale en douceur, se séparer du booster
  const pitchCible = j => 82 * Math.pow(clamp(j, 0, 1), 1.25);
  function pasProgramme(v, e, dt, dir){
    const p = v.p, P = v.spec.programme;
    if(!v.enVol){ if(v.gaz < .05){ v.th = 0; return; } v.enVol = true; msg(v, 'Décollage !', 'bon'); }
    v.th = clamp(v.th + ((pitchCible(v.jauge) + dir * 22) - v.th) * Math.min(1, dt * (2.2 + 1.5 * p.assist)), -10, 90);       // le logiciel suit la trajectoire idéale ; le curseur la décale de ±22°
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
      if(e.action && v.fenetre){ const d = Math.abs(v.jauge - P.etageA); v.etage = 2; v.sepPrecis = d; if(d > .04){ v.contrainte += 30; msg(v, 'Séparation un peu à côté : secousse !', 'mal'); } else msg(v, 'Séparation parfaite !', 'bon'); demarrerRetour(v); }
      if(v.jauge > P.etageA + .06){ v.etage = 2; v.contrainte += 55; msg(v, 'Séparation tardive : forte secousse !', 'mal'); demarrerRetour(v); }
    }
    if(v.carb <= 0 && v.jauge < 1) return rud(v, 'Panne sèche avant d\'atteindre l\'orbite.');
    if(v.jauge >= 1 && v.spec.finOrbite){ v.gaz = 0; v.y = 120000; return fin(v, 'succes', 'Satellite en orbite !'); }
    if(v.jauge >= 1 && v.spec.rentree.orb){ debutRentree(v); msg(v, 'En orbite ! Freinage de rentrée : garde le bon angle d\'attaque.', 'bon'); return; }
    if(v.jauge >= 1){
      const r = v.spec.rentree; v.phase = 'plat'; v.x = r.x; v.y = r.y; v.vx = r.vx; v.vy = r.vy; v.th = 90; v.carb = r.carb; v.gaz = 0; v.attaque = .4; v.chaleur = 0; v.contrainte = 0; v.atteint = true; v.enVol = true;
      msg(v, 'En orbite ! Rentrée dans l\'atmosphère…', 'bon');
    }
  }


  // la rentrée atmosphérique (vitesse orbitale) : le curseur de direction commande l'ANGLE D'ATTAQUE (l'angle entre le vaisseau et son vent relatif).
  // Trop incliné vers l'avant (angle faible) : le vaisseau plonge et brûle ; trop à plat (angle fort) : il freine très fort (surcharge) ou rebondit sur l'air.
  const R_T = 6371e3, ACCEL = 8;              // rayon de la Terre ; le temps de la rentrée est accéléré (×8) pour que ça reste jouable
  const aoaDe = dir => clamp(62 - dir * 28, 30, 86);       // curseur à droite = le nez penche vers l'avant (angle d'attaque plus faible), comme pour les autres phases
  const gamma = v => Math.atan2(v.vy, v.vx) / RAD;                                    // la pente de la trajectoire (négative en descente)
  // l'angle de la mire : le guidage idéal (chaleur, charge, ricochet)
  function aoaGuide(v){
    const fl = v.flux || 0, gl = v.gload || 0;
    let a = 60 + clamp((fl - .6) * 45, -4, 22);
    if(gl > 3.2) a -= (gl - 3.2) * 10;
    if(v.vy > 0 && v.y > 55000) a -= 16;                                             // ça remonte : on plonge
    if(v.y < 45000) a += clamp((45000 - v.y) / 25000, 0, 1) * 24;                    // plus bas : on se met à plat pour le freinage final
    return clamp(a, 24, 84);
  }
  function debutRentree(v){
    const r = v.spec.rentree; v.phase = 'rentree'; v.x = 0; v.y = r.orb.y; v.vx = r.orb.vx; v.vy = r.orb.vy; v.carb = r.carb; v.gaz = 0; v.aoa = 62; v.chaleur = 0; v.contrainte = 0; v.atteint = true; v.enVol = true; v.entre = false; v.flux = 0; v.gload = 0; v.th = 35;
  }
  function pasRentree(v, e, dt, dir){
    v.gaz = 0;
    const cmd = aoaDe(dir);
    for(let i = 0; i < ACCEL && !v.fini && v.phase === 'rentree'; i++) sousPasRentree(v, cmd, dt);
    if(!v.fini && v.phase === 'rentree') v.th = clamp(90 - v.aoa - gamma(v), -10, 95);
  }
  function sousPasRentree(v, cmd, dt){
    const p = v.p, R = v.spec.rentree, a0 = v.aoa;
    v.aoa += clamp(cmd - v.aoa, -38 * dt, 38 * dt);
    const a = v.aoa * RAD, sp = Math.max(1, Math.hypot(v.vx, v.vy)), r = R_T + v.y, g = G0 * Math.pow(R_T / r, 2), rho = 1.225 * rhoDe(v, v.y);
    const drag = .5 * rho * sp * sp * (60 + 410 * Math.pow(Math.sin(a), 2)) / 216e3, lift = drag * .6 * Math.sin(2 * a);
    const ax = (-drag * v.vx - lift * v.vy) / sp, ay = -g + v.vx * v.vx / r + (-drag * v.vy + lift * v.vx) / sp;
    v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
    v.gload = Math.hypot(drag, lift) / G0;
    v.flux = 2.7e-4 * Math.sqrt(rho / 1.2) * sp * sp * sp * (.25 + 2.6 * Math.pow(Math.cos(a), 2)) / 1.6e6;
    v.plasma = Math.max(v.plasma || 0, clamp(v.flux * 1.1, 0, 1));
    v.chaleur = Math.max(0, v.chaleur + (v.flux > .72 ? (v.flux - .72) * 24 : -5) * dt);
    if(v.gload > 3.6) v.contrainte += (v.gload - 3.6) * 38 * dt; else v.contrainte = Math.max(0, v.contrainte - 6 * dt);
    if(v.y < 80000) v.entre = true;
    if(v.chaleur > p.resChaleur) return rud(v, 'Le bouclier thermique a lâché : angle d\'entrée trop plongeant, le vaisseau a brûlé.');
    if(v.contrainte > p.resStructure) return rud(v, `Surcharge : le freinage était trop brutal (${v.gload.toFixed(1)} g), la structure a cédé.`);
    if(v.entre && v.y > 112000 && v.vy > 0) return rud(v, 'Ricochet sur l\'atmosphère : le vaisseau a rebondi et repart dans l\'espace.');
    if(v.y <= 0) return rud(v, 'Le vaisseau a atteint le sol en pleine rentrée.');
    // sous la vitesse du son et plus bas : on passe à la chute à plat
    if(v.y < R.y + 600 && sp < 1100){
      v.xRent = v.x; v.phase = 'plat'; v.vx = clamp(v.vx, -120, 120); v.y = Math.min(v.y, R.y + 600); v.th = clamp(90 - v.aoa - gamma(v), 0, 90); v.attaque = .4; v.chaleur *= .45; v.contrainte = 0; v.atteint = true;
      v.x = R.x + clamp((v.x - R.dist) / 1000 * .15, -150, 150);
      msg(v, 'Sous le mur du son : place à la chute à plat, puis au retournement.', 'bon');
    }
  }


  // la mission complète : après la séparation, on pilote le propulseur jusqu'aux bras de la tour, puis on reprend le vaisseau
  function demarrerRetour(v){
    const R = v.spec.retour; if(!R || v.segment) return;
    v.nave = { jauge:v.jauge, carb:v.carb, th:v.th, contrainte:v.contrainte, y:v.y }; v.segment = 'booster';
    v.phase = 'vol'; v.x = R.x; v.y = R.y; v.vx = R.vx; v.vy = R.vy; v.th = R.th || 0; v.om = 0; v.carb = R.carb; v.gaz = 0; v.enVol = true; v.atteint = false; v.manque = false; v.fenetre = false; v.plasma = 0;
    v.budget += v.p.autonomie * .5;
    (v.fx = v.fx || []).push({ k:'sep', x:0, y:0 });
    msg(v, 'Le propulseur se retourne et redescend : guide-le vers la tour !', 'bon');
  }
  function reprendreNave(v, ok, cause){
    const n = v.nave; v.phase = 'programme'; v.jauge = n.jauge; v.carb = n.carb; v.th = n.th; v.contrainte = n.contrainte; v.x = 0; v.vx = 0; v.vy = 0; v.y = n.y; v.gaz = 0; v.om = 0; v.manque = false; v.enVol = true; v.atteint = false; v.plasma = 0;
    msg(v, ok ? 'Propulseur rattrapé ! On reprend le vaisseau : cap sur l\'orbite.' : `Propulseur perdu (${(cause || '').replace(/\.$/, '')}). Le vaisseau continue vers l'orbite.`, ok ? 'bon' : 'mal');
  }

  // l'altitude à laquelle il faut se retourner : le temps du retournement, puis la distance de freinage
  function altitudeRetournement(v){
    const g = gDe(v), aNet = Math.max(2, v.p.twr / (1 - .4 * (1 - Math.min(1, v.carb))) * G0 * (v.spec.pmax ?? 1) - g), vv = Math.abs(Math.min(0, v.vy));
    return vv * 3.2 + vv * vv / (2 * aNet) + (v.spec.tour ? v.spec.tour.y : 0);
  }
  // le calcul du point d'allumage conseillé : la hauteur à laquelle il faut pleine poussée pour s'arrêter
  function hauteurAllumage(v){
    const g = gDe(v), at = v.p.twr / (1 - .4 * (1 - Math.min(1, v.carb))) * G0 * (v.spec.pmax ?? 1) - g, vv = Math.abs(Math.min(0, v.vy));
    const cible = v.spec.tour ? v.spec.tour.y : 0;
    return at > 0 ? cible + vv * vv / (2 * at) : Infinity;
  }
  const apogeePrevu = v => v.y + (v.vy > 0 ? v.vy * v.vy / (2 * gDe(v)) : 0);

  /* ---------- Les résultats d'un vol : des étoiles, sans pénalité ---------- */
  // ★ réussi ; ★ dans le temps (large) ; ★ assez de carburant restant (large). Les autres mesures (précision, vitesse d'impact…) ne servent qu'à l'information.
  function notation(v, J){
    const restant = clamp(1 - v.conso / v.budget, 0, 1), r = { issue:v.fini, cause:v.cause, temps:v.t, restant, conso:v.conso, ecart:v.ecart, vImpact:v.vImpact, angle:v.angFinal, etoiles:0, criteres:[] };
    const okTemps = v.t <= J.etoiles.temps, okCarb = J.etoiles.vimp ? v.vImpact != null && v.vImpact <= J.etoiles.vimp : restant >= J.etoiles.carb;
    r.criteres = [{ txt:'Réussir le vol', ok:v.fini === 'succes' }, { txt:`Terminer en moins de ${J.etoiles.temps} s`, ok:v.fini === 'succes' && okTemps }, { txt:J.etoiles.vimp ? `Arriver à moins de ${J.etoiles.vimp} m/s` : `Garder au moins ${Math.round(J.etoiles.carb * 100)} % de carburant`, ok:v.fini === 'succes' && okCarb }];
    r.etoiles = r.criteres.filter(c => c.ok).length;
    return r;
  }

  /* ---------- Un pilote automatique (pour les essais seulement) ---------- */
  function pilote(v, qualite = 1){
    const e = { gauche:false, droite:false, gaz:false, action:false }, sp = v.spec, th = v.th;
    const bouge = (cible) => { e.dir = clamp(cible / angleMax(v.p), -1, 1); };
    if(v.phase === 'programme'){
      e.dir = clamp((pitchCible(v.jauge) - th) / 22, -1, 1);
      const maxQ = v.jauge > .17 && v.jauge < .31;
      e.gaz = v.gaz < (maxQ ? .62 : 1);
      if(v.fenetre && v.etage === 1 && v.jauge >= sp.programme.etageA) e.action = true;
      return e;
    }
    if(v.phase === 'capsule'){
      const axD = .05 * (sp.pad.x - v.x) - .6 * v.vx; if(axD > .5) e.droite = true; else if(axD < -.5) e.gauche = true;
      if(!v.chute && v.y < 1300 && Math.hypot(v.vx, v.vy) < 190) e.action = true;
      return e;
    }
    if(v.phase === 'rentree'){ e.dir = clamp((62 - aoaGuide(v)) / 28, -1, 1); return e; }
    if(v.phase === 'plat'){
      const tx = sp.tour ? sp.tour.x : (sp.pad ? sp.pad.x : 0), axD = .05 * (tx - v.x) - .55 * v.vx;
      if(axD > .5) e.droite = true; else if(axD < -.5) e.gauche = true;
      e.gaz = v.attaque < (v.chaleur > 25 || Math.abs(v.vy) > 160 ? .8 : .45);
      if(v.y < altitudeRetournement(v) * 1.05 * qualite && v.th > 80) e.action = true;
      return e;
    }
    if(v.phase === 'flip'){ e.gaz = v.y < hauteurAllumage(v) * 1.1; return e; }
    // vol vertical : montée, translation (le saut), puis atterrissage en suivant une courbe de freinage
    const tx = sp.tour ? sp.tour.x : sp.pad.x, g = gDe(v), aNet = v.p.twr / (1 - .4 * (1 - Math.min(1, v.carb))) * G0 * (v.spec.pmax ?? 1) - g;
    if(!v.atteint && (sp.type === 'saut' || sp.type === 'altitude')){
      e.gaz = sp.type === 'saut' ? (v.y < 100 ? v.vy < 30 : v.vy < 6 + (150 - v.y) * .2) : true; bouge(0, 2, 3.5); return e;
    }
    const dx = tx - v.x, yc = sp.tour ? sp.tour.y : 0;
    if(sp.type === 'saut' && (Math.abs(dx) > 6 || Math.abs(v.vx) > 1.5) && v.y > 30){
      const axD = .045 * dx - .42 * v.vx, thT = clamp(axD * 5.84, -10, 10); bouge(thT, 2.2, 3.5);
      e.gaz = v.vy < (100 - v.y) * .15; return e;
    }
    const axD = (v.y > yc + 250 ? .06 * dx - .5 * v.vx : .02 * dx - .32 * v.vx), thT = clamp(axD * 5.84, -9, 9);
    if(v.y > yc + 120 && (sp.type === 'booster' || sp.type === 'barge' || v.segment === 'booster')){ if(axD > .35) e.droite = true; else if(axD < -.35) e.gauche = true; }
    else bouge(v.y < yc + 6 ? 0 : thT, 2.4, 3.8);
    const vDes = -Math.max(sp.tour ? 1.2 : 1.6, Math.sqrt(2 * .6 * Math.max(.1, aNet) * Math.max(0, v.y - yc - .5 * Math.abs(Math.min(0, v.vy)))));
    e.gaz = v.vy < vDes + .5;
    if(v.y > yc + 3 && v.vy > vDes && v.gaz < .05) e.gaz = false;
    return e;
  }
  // l'angle à suivre (la mire du pilote) : même calcul que le pilote automatique ; null quand l'angle ne se pilote pas
  function angleCible(v){
    if(v.fini) return null; const sp = v.spec;
    if(v.phase === 'programme') return { th:pitchCible(v.jauge), tol:6 };
    if(v.phase === 'rentree') return { th:clamp(90 - aoaGuide(v) - gamma(v), -10, 95), tol:5 };
    if(v.phase !== 'vol') return null;
    if(!v.enVol && v.t < 60) return { th:0, tol:6 };
    const tx = sp.tour ? sp.tour.x : (sp.pad ? sp.pad.x : 0), yc = sp.tour ? sp.tour.y : 0, dx = tx - v.x;
    if(!v.atteint && (sp.type === 'saut' || sp.type === 'altitude')) return { th:0, tol:6 };
    if(sp.type === 'saut' && (Math.abs(dx) > 6 || Math.abs(v.vx) > 1.5) && v.y > 30) return { th:clamp((.045 * dx - .42 * v.vx) * 5.84, -10, 10), tol:4 };
    if(v.y > yc + 120 && (sp.type === 'booster' || sp.type === 'barge' || v.segment === 'booster')) return { th:0, tol:8 };      // là-haut, ce sont les ailettes qui guident
    const axD = (v.y > yc + 250 ? .06 * dx - .5 * v.vx : .02 * dx - .32 * v.vx);
    return { th:v.y < yc + 6 ? 0 : clamp(axD * 5.84, -9, 9), tol:v.y < yc + 300 ? Math.min(8, v.p.angAtterr) : 6 };
  }
  // un vol entier avec le pilote automatique (pour mesurer la difficulté)
  function simuler(spec, niv, qualite = 1, opts = {}){
    const v = nouveauVol(spec, niv, { vent:opts.vent || 1, phi:opts.phi ?? 1 }); let n = 0;
    while(!v.fini && n++ < 60 * 400){ const e = pilote(v, qualite); pas(v, e, 1 / 60); }
    return v;
  }

  function tests(){
    const r = [], ok = (c, t) => r.push((c ? '✅ ' : '❌ ') + t);
    for(const J of NIVEAUX){
      let g = 0, e3 = 0; const tt = [], rr = [];
      for(let i = 0; i < 6; i++){ const v = simuler(J.vol, J.equipe, 1, { phi:i }); if(v.fini === 'succes'){ g++; const n = notation(v, J); if(n.etoiles === 3) e3++; tt.push(v.t); rr.push(n.restant); } }
      ok(g >= 4, `${J.nom} : ${g}/6 réussis par le pilote automatique (3 étoiles : ${e3}/6 ; temps ${tt.length ? Math.round(Math.max(...tt)) : '–'} s au plus ; carburant restant ${rr.length ? Math.round(Math.min(...rr) * 100) : '–'} % au moins)`);
    }
    // la rentrée : un angle d'attaque fixe trop faible brûle, trop fort écrase ; le milieu passe
    const J = NIVEAUX.find(n => n.id === 'vaisseau'), essai = aoa => { const v = nouveauVol(J.vol, J.equipe, { vent:1, phi:1 }); let n = 0; while(!v.fini && n++ < 60 * 400){ const e = pilote(v, 1); if(v.phase === 'rentree') e.dir = (62 - aoa) / 28; pas(v, e, 1 / 60); } return v; };
    ok(/brûlé/.test(essai(40).cause), 'Rentrée : trop plongeant (40°) → le bouclier brûle');
    ok(/Surcharge/.test(essai(86).cause), 'Rentrée : trop à plat (86°) → surcharge de freinage');
    ok(essai(66).fini === 'succes', 'Rentrée : angle d\'attaque raisonnable (66°) → la mission continue jusqu\'à la tour');
    // la mission complète : propulseur perdu = mission incomplète
    const M = NIVEAUX.find(n => n.id === 'mission'), vm = nouveauVol(M.vol, M.equipe, { vent:1, phi:1 }); let nn = 0, perdu = false;
    while(!vm.fini && nn++ < 60 * 500){ const e = pilote(vm, 1); if(vm.segment === 'booster' && vm.y < 600){ e.gaz = false; perdu = true; } pas(vm, e, 1 / 60); }
    ok(perdu && vm.boosterOk === false && vm.fini === 'partiel', 'Mission complète : propulseur raté → le vaisseau continue, mais la mission est incomplète');
    return r;
  }

  return { NIVEAUX, params, nouveauVol, pas, hauteurAllumage, altitudeRetournement, apogeePrevu, pitchCible, angleCible, aoaGuide, notation, pilote, simuler, tests, gDe, rhoDe };
})();
