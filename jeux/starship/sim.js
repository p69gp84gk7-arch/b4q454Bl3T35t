/* Starship : le programme. La logique du jeu, sans dessin (ce fichier tourne aussi avec Node pour les essais) :
   - la gestion : budget, équipes, cinq domaines à améliorer, prototypes, événements, jalons à franchir ;
   - le vol : un petit simulateur en deux dimensions (poussée, gravité, air, vent, chaleur, rentrée en « ventre à terre »,
     retournement, atterrissage ou rattrapage par la tour).
   Inspiré de l'histoire publique du programme Starship (sauts, haute altitude, vol orbital, rattrapage du booster…).
   Les dessins, les chiffres et le jeu sont originaux : ce n'est pas un jeu officiel. */
window.STARSHIP_SIM = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), RAD = Math.PI / 180;
  const G0 = 9.81;

  /* ---------- Les domaines à améliorer ---------- */
  const DOMAINES = [
    { id:'moteurs', nom:'Moteurs Raptor', ico:'🔥', txt:'Plus de poussée et plus de carburant utile : on décolle plus fort et on tient plus longtemps.' },
    { id:'structure', nom:'Structure en inox', ico:'🧱', txt:'Le vaisseau résiste mieux aux contraintes (le passage de la pression maximale) et il est plus léger.' },
    { id:'bouclier', nom:'Bouclier thermique', ico:'🛡️', txt:'Les tuiles supportent mieux la chaleur de la rentrée dans l\'atmosphère.' },
    { id:'logiciel', nom:'Logiciel de vol', ico:'💻', txt:'Le vaisseau se stabilise tout seul, subit moins le vent et se retourne au bon moment.' },
    { id:'atterrisseur', nom:'Atterrissage et rattrapage', ico:'🦾', txt:'On peut se poser plus vite et moins droit, et les bras de la tour attrapent plus facilement.' },
  ];
  const MAX_NIV = 10;
  const coutNiveau = n => ({ data:3 + 2 * n, argent:10 + 5 * n });          // pour passer du niveau n au niveau n + 1
  const SALAIRES = niv => Math.round(6 + 0.5 * Object.values(niv).reduce((a, b) => a + b, 0));   // M$ par cycle
  const COUT_PROTO = 28, COUT_ESSAI = 8, COUT_VOL = 12, ACTIONS_PAR_CYCLE = 2;

  /* ---------- Les jalons (d'après l'histoire du programme, en plus simple) ---------- */
  // conseil : les niveaux qui rendent le vol raisonnable ; vol : ce qu'il faut réussir
  const JALONS = [
    { id:'saut', court:'Saut', nom:'Le premier saut', ico:'🐸', recompense:70, conseil:{ moteurs:0 },
      txt:'Un petit prototype décolle, monte à 150 m, puis se pose sur l\'autre plateforme, à 70 m de là. Un seul essai, pas de droit à l\'erreur… ou presque.',
      vol:{ type:'saut', cible:150, pad:{ x:70, tol:18 }, depart:{ phase:'vol' }, vent:.3, titre:'Saut à 150 m' } },
    { id:'altitude', court:'5 km', nom:'Haute altitude', ico:'🛰️', recompense:90, conseil:{ moteurs:1, logiciel:1 },
      txt:'Monter à 5 km, couper les moteurs, descendre « à plat » comme une feuille, se retourner au dernier moment et se poser. C\'est la figure de style du programme.',
      vol:{ type:'altitude', cible:5000, pad:{ x:0, tol:22 }, belly:true, depart:{ phase:'vol' }, vent:.8, titre:'Vol à 5 km' } },
    { id:'orbite', court:'Orbite', nom:'Premier vol orbital', ico:'🌍', recompense:130, conseil:{ moteurs:3, structure:3, bouclier:3, logiciel:2 },
      txt:'Monter jusqu\'en orbite en suivant la trajectoire (attention au passage de la pression maximale), se séparer du booster au bon moment, puis revenir : rentrée à plat, retournement, atterrissage.',
      vol:{ type:'orbite', pad:{ x:0, tol:30 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:78, etageA:.42 },
        rentree:{ y:9000, vy:-420, vx:30, x:-250, carb:.7 }, vent:.9, titre:'Vol orbital' } },
    { id:'booster', court:'Booster', nom:'Rattrapage du booster', ico:'🦾', recompense:160, conseil:{ moteurs:3, logiciel:4, atterrisseur:4 },
      txt:'Le propulseur redescend tout seul, droit, et doit être attrapé en vol par les bras de la tour : il faut arriver presque à l\'arrêt, pile à la hauteur des bras.',
      vol:{ type:'booster', pad:{ x:0, tol:26 }, tour:{ x:0, y:75, tol:4.5, v:4, ang:4 }, depart:{ phase:'vol', x:170, y:3800, vy:-150, vx:-6, carb:.7, th:2 }, vent:.9, titre:'Rattrapage du booster' } },
    { id:'vaisseau', court:'Vaisseau', nom:'Rattrapage du vaisseau', ico:'🚀', recompense:200, conseil:{ moteurs:4, structure:4, bouclier:5, logiciel:5, atterrisseur:6 },
      txt:'Revenir de l\'orbite, descendre à plat, se retourner et se faire attraper par la tour : le but du programme, un vaisseau réutilisable.',
      vol:{ type:'vaisseau', pad:{ x:0, tol:20 }, tour:{ x:0, y:75, tol:4, v:3.4, ang:3.4 }, belly:true, depart:{ phase:'programme' }, programme:{ duree:84, etageA:.42 },
        rentree:{ y:9000, vy:-430, vx:30, x:-260, carb:.7 }, vent:1, titre:'Retour du vaisseau' } },
    { id:'mars', court:'Mars', nom:'Cap sur Mars', ico:'🔴', recompense:300, conseil:{ moteurs:6, structure:6, bouclier:7, logiciel:7, atterrisseur:7 },
      txt:'Atterrir sur Mars : un air presque absent (le vaisseau freine mal), une pesanteur plus faible, et pas de tour pour vous attraper. Il faut allumer tôt.',
      vol:{ type:'mars', pad:{ x:0, tol:30 }, belly:true, g:3.71, rho:.025, depart:{ phase:'programme' }, programme:{ duree:90, etageA:.42 },
        rentree:{ y:11000, vy:-380, vx:30, x:-300, carb:.8 }, vent:.4, titre:'Atterrissage sur Mars' } },
  ];

  /* ---------- Le programme (la gestion) ---------- */
  const nouveau = () => ({ v:1, cycle:1, actions:ACTIONS_PAR_CYCLE, argent:130, data:4, niv:{ moteurs:0, structure:0, bouclier:0, logiciel:0, atterrisseur:0 },
    prototypes:0, jalon:0, vols:0, reussis:0, explosions:0, evt:null, journal:[], fini:null, reussites:[] });

  const EVENEMENTS = [
    { id:'permis', p:.12, txt:'📄 Les autorités tardent à donner l\'autorisation de vol : pas de lancement ce cycle.', bloque:true },
    { id:'tempete', p:.1, txt:'🌪️ Une tempête approche : le vent sera plus fort si vous lancez ce cycle.', vent:1.7 },
    { id:'contrat', p:.1, txt:'💼 Un client signe un contrat : +25 M$.', argent:25 },
    { id:'idee', p:.1, txt:'💡 Une idée d\'ingénieur : +2 points de savoir.', data:2 },
    { id:'fournisseur', p:.08, txt:'📦 Un fournisseur est en retard : les travaux coûtent 30 % de plus ce cycle.', surcout:1.3 },
    { id:'fuite', p:.12, txt:'💥 Une fuite pendant un essai : un prototype a explosé sur le banc d\'essai !', proto:-1, contrainte:true },
  ];
  const journal = (P, t) => { P.journal.unshift(t); if(P.journal.length > 40) P.journal.pop(); };
  const surcout = P => (P.evt && P.evt.surcout) || 1;
  const cout = (P, base) => Math.round(base * surcout(P));

  const peutAmeliorer = (P, d) => P.niv[d] < MAX_NIV && P.actions > 0 && P.argent >= cout(P, coutNiveau(P.niv[d]).argent) && P.data >= coutNiveau(P.niv[d]).data;
  function ameliorer(P, d){
    if(!peutAmeliorer(P, d)) return false;
    const c = coutNiveau(P.niv[d]); P.argent -= cout(P, c.argent); P.data -= c.data; P.niv[d]++; P.actions--;
    journal(P, `${DOMAINES.find(x => x.id === d).ico} ${DOMAINES.find(x => x.id === d).nom} : niveau ${P.niv[d]}`);
    return true;
  }
  const peutConstruire = P => P.actions > 0 && P.argent >= cout(P, COUT_PROTO) && P.prototypes < 3;
  function construire(P){ if(!peutConstruire(P)) return false; P.argent -= cout(P, COUT_PROTO); P.prototypes++; P.actions--; journal(P, '🏗️ Un prototype est prêt'); return true; }
  const peutEssayer = P => P.actions > 0 && P.argent >= cout(P, COUT_ESSAI);
  // un essai au banc : on apprend (un peu) sans risquer un vol
  function essayer(P, rnd = Math.random){ if(!peutEssayer(P)) return false; P.argent -= cout(P, COUT_ESSAI); P.actions--; const d = 2 + (rnd() < .4 ? 1 : 0); P.data += d; journal(P, `🔬 Essai au banc : +${d} savoir`); return true; }
  const peutLancer = P => P.prototypes > 0 && P.jalon < JALONS.length && P.argent >= COUT_VOL && !(P.evt && P.evt.bloque);
  // à la fin d'un cycle : les salaires, l'événement, un peu de savoir ; renvoie false si c'est la faillite
  function finCycle(P, rnd = Math.random){
    P.argent -= SALAIRES(P.niv); P.data += 1; P.cycle++; P.actions = ACTIONS_PAR_CYCLE; P.evt = null;
    const u = rnd(); let s = 0;
    for(const e of EVENEMENTS){ s += e.p; if(u < s){ P.evt = e; break; } }
    if(P.evt){
      if(P.evt.argent) P.argent += P.evt.argent; if(P.evt.data) P.data += P.evt.data;
      if(P.evt.proto && P.prototypes > 0){ P.prototypes--; P.explosions++; } else if(P.evt.proto) P.evt = { id:'fuite0', txt:'💥 Une fuite pendant un essai, mais il n\'y avait aucun prototype sur le banc : rien de perdu.' };
      journal(P, P.evt.txt);
    }
    if(P.argent < 0){ P.fini = 'faillite'; return false; }
    return true;
  }

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
      vent:(spec.vent ?? .5) * (opts.vent || 1), phi:(opts.phi || Math.random() * 6), action:false, gaz0:0, att:0 };
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
  function brule(v, dt, autonomie){ v.carb = Math.max(0, v.carb - v.gaz * dt / autonomie); }

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
      if(ok){ v.gaz = 0; return fin(v, 'succes', 'Rattrapé par les bras de la tour !'); }
      v.manque = true; msg(v, `Raté ! (écart ${Math.abs(v.x - T.x).toFixed(1)} m, vitesse ${Math.abs(v.vy).toFixed(1)} m/s, angle ${Math.abs(v.th).toFixed(1)}°)`, 'mal');
    }
    if(v.y <= 0 && v.vy < 0) contactSol(v);
  }

  function contactSol(v){
    const p = v.p, sp = v.spec, ecart = Math.abs(v.x - (sp.pad ? sp.pad.x : 0)), vit = Math.abs(v.vy), ang = Math.abs(v.th);
    v.y = 0;
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
    const consom = v.gaz * dt / p.autonomieProg; v.carb = Math.max(0, v.carb - consom);
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

  /* ---------- Les résultats d'un vol ---------- */
  // applique l'issue du vol au programme ; renvoie un texte pour l'écran de résultat
  function terminerVol(P, vol){
    P.vols++; P.argent -= COUT_VOL; P.prototypes--; const J = JALONS[P.jalon]; const r = { issue:vol.fini, cause:vol.cause, data:0, argent:0, jalonFranchi:false };
    if(vol.fini === 'succes'){
      P.reussis++; P.prototypes++; r.data = 3 + 2 * P.jalon; r.argent = J.recompense; P.argent += r.argent; P.data += r.data; r.jalonFranchi = true; P.reussites.push(J.id); P.jalon++;
      journal(P, `✅ ${J.nom} : réussi ! +${r.argent} M$`);
      if(P.jalon >= JALONS.length) P.fini = 'victoire';
    } else if(vol.fini === 'partiel'){
      P.prototypes++; r.data = 2; P.data += 2; journal(P, `🟡 ${J.nom} : pas tout à fait (le prototype est intact)`);
    } else {
      P.explosions++; r.data = 4 + P.jalon; P.data += r.data; journal(P, `💥 ${J.nom} : explosion. On apprend : +${r.data} savoir`);
    }
    if(!P.fini && P.argent < 0 && P.prototypes === 0) P.fini = 'faillite';
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
    const niv = (n) => ({ moteurs:n, structure:n, bouclier:n, logiciel:n, atterrisseur:n });
    // le premier saut se réussit avec le pilote automatique, même sans aucune amélioration
    let gagne = 0; for(let i = 0; i < 8; i++) if(simuler(JALONS[0].vol, niv(0), 1, { phi:i }).fini === 'succes') gagne++;
    ok(gagne >= 6, `saut au niveau 0 : ${gagne}/8 réussis par le pilote automatique`);
    for(let k = 1; k < JALONS.length; k++){
      const J = JALONS[k], c = Object.assign({ moteurs:0, structure:0, bouclier:0, logiciel:0, atterrisseur:0 }, J.conseil); let g = 0, g0 = 0;
      for(let i = 0; i < 6; i++){ if(simuler(J.vol, c, 1, { phi:i }).fini === 'succes') g++; if(simuler(J.vol, niv(0), 1, { phi:i }).fini === 'succes') g0++; }
      ok(g >= 3, `${J.nom} avec les niveaux conseillés : ${g}/6 réussis (sans amélioration : ${g0}/6)`);
    }
    const P = nouveau(); ok(P.argent === 130 && ameliorer(P, 'moteurs') && P.niv.moteurs === 1 && P.actions === 1, 'améliorer un domaine coûte des M$, du savoir et une action');
    ok(construire(P) && P.prototypes === 1 && P.actions === 0 && !construire(P), 'construire un prototype demande une action');
    const a = P.argent; finCycle(P, () => .99); ok(P.cycle === 2 && P.argent === a - SALAIRES(P.niv) && P.actions === ACTIONS_PAR_CYCLE, 'fin de cycle : les salaires sont payés');
    const Q = nouveau(); Q.argent = 3; Q.niv.moteurs = 10; ok(finCycle(Q, () => .99) === false && Q.fini === 'faillite', 'faillite quand l\'argent manque');
    return r;
  }

  return { DOMAINES, JALONS, MAX_NIV, COUT_PROTO, COUT_ESSAI, COUT_VOL, ACTIONS_PAR_CYCLE, EVENEMENTS, coutNiveau, SALAIRES, nouveau, ameliorer, peutAmeliorer, construire, peutConstruire, essayer, peutEssayer, peutLancer, finCycle, cout,
    params, nouveauVol, pas, hauteurAllumage, altitudeRetournement, apogeePrevu, pitchCible, terminerVol, pilote, simuler, tests, journal, gDe, rhoDe };
})();
