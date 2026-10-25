/* Paddock : le monde du jeu de gestion d'écurie.
   Écuries, pilotes, personnel et sponsors sont inventés (ressemblants, pas de vrais noms ni de vraies marques).
   Tout l'état d'une carrière tient dans un seul objet (C), gardé dans « paddock-carriere ». */
window.PaddockMonde = (() => {
  const hasard = (a, b) => a + Math.random() * (b - a);
  const choisir = t => t[Math.floor(Math.random() * t.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const arrondi = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

  /* ---------- Les 10 écuries (stats de la voiture sur 100, budget en M€ par saison, prestige sur 100) ---------- */
  const ECURIES = [
    { id:'taureau', logo:'🐂', nom:'Taureau Rouge Racing', court:'TAU', c1:'#1B2A5C', c2:'#E4002B', moteur:91, aero:93, chassis:90, fiabilite:88, budget:140, prestige:95, pilotes:['verstapin', 'tsunodo'] },
    { id:'cavallino', logo:'🐎', nom:'Scuderia Cavallino', court:'CAV', c1:'#D40000', c2:'#FFE100', moteur:92, aero:90, chassis:89, fiabilite:84, budget:140, prestige:98, pilotes:['leclaire', 'hamiltown'] },
    { id:'papaye', logo:'🍊', nom:'Papaye Racing', court:'PAP', c1:'#FF8000', c2:'#1E2328', moteur:90, aero:94, chassis:91, fiabilite:89, budget:135, prestige:88, pilotes:['norrish', 'piastrino'] },
    { id:'fleches', logo:'🏹', nom:'Flèches d\'Argent', court:'FLA', c1:'#00A19C', c2:'#C8CCCE', moteur:93, aero:89, chassis:89, fiabilite:90, budget:138, prestige:92, pilotes:['russelle', 'antonello'] },
    { id:'emeraude', logo:'💎', nom:'Émeraude Martin', court:'EME', c1:'#005A4E', c2:'#CEDC00', moteur:87, aero:86, chassis:86, fiabilite:86, budget:120, prestige:70, pilotes:['alonsso', 'strolle'] },
    { id:'guillaume', logo:'🔷', nom:'Guillaume Racing', court:'GUI', c1:'#00265A', c2:'#2EA8E8', moteur:89, aero:84, chassis:85, fiabilite:85, budget:100, prestige:62, pilotes:['albonne', 'sainze'] },
    { id:'veau', logo:'🐮', nom:'Petits Taureaux', court:'PTA', c1:'#F2F4F8', c2:'#1434CB', moteur:88, aero:85, chassis:85, fiabilite:84, budget:95, prestige:55, pilotes:['lawsonne', 'hadjard'] },
    { id:'alpes', logo:'🏔️', nom:'Équipe des Alpes', court:'ALP', c1:'#0093CC', c2:'#FF87BC', moteur:84, aero:83, chassis:83, fiabilite:80, budget:85, prestige:50, pilotes:['gaslight', 'doohann'] },
    { id:'etoile', logo:'⭐', nom:'Étoile US', court:'ETO', c1:'#EDEDED', c2:'#B6000F', moteur:86, aero:82, chassis:82, fiabilite:82, budget:75, prestige:40, pilotes:['ocone', 'bierman'] },
    { id:'trefle', logo:'🍀', nom:'Trèfle Vert', court:'TRE', c1:'#1DCB3C', c2:'#111111', moteur:85, aero:81, chassis:82, fiabilite:83, budget:70, prestige:38, pilotes:['hulkenbourg', 'bortoletto'] },
  ];
  const PETITES = ['alpes', 'etoile', 'trefle'];       // le joueur commence avec l'une d'elles

  /* ---------- Les pilotes : âge, vitesse, régularité, pneus (gestion), dépassement, pluie, salaire (M€ par saison), potentiel ---------- */
  const PILOTES = [
    ['verstapin', 'Max Verstapin', '🇳🇱', 27, 97, 92, 90, 96, 98, 50, 97],
    ['tsunodo', 'Yuki Tsunodo', '🇯🇵', 25, 87, 80, 82, 87, 84, 5, 88],
    ['leclaire', 'Charles Leclaire', '🇲🇨', 27, 95, 87, 86, 90, 88, 30, 95],
    ['hamiltown', 'Lewis Hamiltown', '🇬🇧', 40, 91, 92, 93, 92, 94, 45, 91],
    ['norrish', 'Lando Norrish', '🇬🇧', 26, 94, 88, 88, 90, 89, 25, 95],
    ['piastrino', 'Oscar Piastrino', '🇦🇺', 24, 94, 92, 90, 88, 86, 15, 96],
    ['russelle', 'George Russelle', '🇬🇧', 27, 93, 90, 89, 89, 90, 20, 93],
    ['antonello', 'Kimi Antonello', '🇮🇹', 19, 88, 80, 82, 86, 85, 4, 95],
    ['alonsso', 'Fernando Alonsso', '🇪🇸', 43, 89, 93, 94, 95, 93, 22, 89],
    ['strolle', 'Lance Strolle', '🇨🇦', 26, 82, 80, 84, 82, 86, 10, 83],
    ['albonne', 'Alex Albonne', '🇹🇭', 29, 88, 89, 88, 86, 86, 8, 88],
    ['sainze', 'Carlos Sainze', '🇪🇸', 30, 91, 91, 90, 89, 88, 12, 91],
    ['lawsonne', 'Liam Lawsonne', '🇳🇿', 23, 84, 80, 80, 85, 82, 2, 88],
    ['hadjard', 'Isack Hadjard', '🇫🇷', 20, 86, 80, 81, 84, 82, 1.5, 92],
    ['gaslight', 'Pierre Gaslight', '🇫🇷', 29, 88, 87, 86, 87, 87, 10, 88],
    ['doohann', 'Jack Doohann', '🇦🇺', 22, 80, 76, 79, 80, 78, 2, 86],
    ['ocone', 'Esteban Ocone', '🇫🇷', 28, 86, 85, 86, 86, 87, 6, 86],
    ['bierman', 'Oliver Bierman', '🇬🇧', 20, 83, 78, 80, 83, 80, 1.5, 91],
    ['hulkenbourg', 'Nico Hulkenbourg', '🇩🇪', 37, 86, 90, 88, 84, 87, 6, 86],
    ['bortoletto', 'Gabriel Bortoletto', '🇧🇷', 20, 83, 80, 81, 82, 80, 1.5, 91],
    // sans volant au départ
    ['bottass', 'Valtteri Bottass', '🇫🇮', 35, 87, 91, 89, 83, 86, 6, 87],
    ['peres', 'Sergio Perès', '🇲🇽', 35, 85, 84, 92, 88, 83, 8, 85],
    ['colapinta', 'Franco Colapinta', '🇦🇷', 22, 81, 75, 79, 83, 79, 1, 87],
    ['drugovitch', 'Felipe Drugovitch', '🇧🇷', 25, 80, 82, 80, 78, 79, 1, 82],
    ['pourchet', 'Théo Pourchet', '🇫🇷', 22, 81, 80, 80, 79, 80, .8, 88],
    ['iwasaki', 'Ayumu Iwasaki', '🇯🇵', 24, 80, 79, 79, 80, 79, .7, 85],
    ['lindbloom', 'Arvid Lindbloom', '🇬🇧', 18, 78, 74, 76, 80, 75, .5, 93],
    ['vestie', 'Frederik Vestie', '🇩🇰', 23, 79, 80, 79, 77, 80, .6, 84],
  ];
  const PRENOMS = ['Lucas', 'Noah', 'Mateo', 'Elias', 'Léo', 'Hugo', 'Arthur', 'Nathan', 'Gabriel', 'Tom', 'Jules', 'Sacha', 'Enzo', 'Ethan', 'Milo', 'Théo', 'Rafael', 'Oscar', 'Liam', 'Adam', 'Kenzo', 'Nils', 'Paolo', 'Kai'];
  const NOMS = ['Marchetti', 'Dubreuil', 'Kowalski', 'Andersen', 'Moreau', 'Fontaine', 'Lindqvist', 'Costa', 'Verbeek', 'Nakamura', 'Schreiber', 'Roussel', 'Delacroix', 'Ivanov', 'Okafor', 'Bianchi', 'Hartmann', 'Lambert', 'Silva', 'Novak', 'Ferreira', 'Mercier', 'Tanaka', 'Olsen'];
  const DRAPEAUX = ['🇫🇷', '🇮🇹', '🇩🇪', '🇬🇧', '🇪🇸', '🇧🇷', '🇳🇱', '🇯🇵', '🇦🇺', '🇨🇭', '🇧🇪', '🇩🇰', '🇺🇸', '🇲🇽', '🇵🇱', '🇳🇴'];
  const nomAuHasard = () => choisir(PRENOMS) + ' ' + choisir(NOMS);

  /* ---------- Le personnel : trois postes, de 1 à 5 étoiles ---------- */
  const POSTES = {
    technique:{ nom:'Directeur technique', ico:'📐', role:'Les améliorations de la voiture rapportent plus et arrivent plus vite.' },
    course:{ nom:'Ingénieur de course', ico:'🎧', role:'Voitures mieux réglées (un peu plus rapides), pneus mieux gérés, météo annoncée plus tôt.' },
    mecanos:{ nom:'Chef mécanicien', ico:'🔧', role:'Arrêts au stand plus rapides, moins de ratés, voiture plus fiable.' },
  };
  const SALAIRE_POSTE = [0, 1, 2, 3.5, 5.5, 8];                     // M€ par saison selon les étoiles
  const employe = (niv, nom = nomAuHasard()) => ({ nom, niv, salaire:SALAIRE_POSTE[niv], drapeau:choisir(DRAPEAUX) });

  /* ---------- Les sponsors (marques inventées) ---------- */
  const MARQUES = [
    ['Carbu Max', '⛽'], ['Pneus Volcan', '🌋'], ['Fusée Cola', '🥤'], ['Banque des Cimes', '🏦'], ['Montres Alpina', '⌚'], ['Fromagerie du Col', '🧀'],
    ['Télécom Azur', '📡'], ['Café Grimpette', '☕'], ['Assurances Sereno', '🛡️'], ['Pâtes Turbo', '🍝'], ['Glaces Polaires', '🍦'], ['Lunettes Horizon', '🕶️'],
    ['Énergie Soleil', '☀️'], ['Chocolat Sommet', '🍫'], ['Vélos Éclair', '🚲'], ['Jeux Pixel', '🎮'], ['Parfums Brise', '🌸'], ['Transports Comète', '🚚'],
  ];
  const OBJECTIFS = [
    { id:'finir', txt:'les deux voitures à l\'arrivée', bonus:.4 },
    { id:'points', txt:'une voiture dans les points (top 10)', bonus:.6 },
    { id:'deuxpoints', txt:'les deux voitures dans les points', bonus:1 },
    { id:'top5', txt:'une voiture dans les 5 premiers', bonus:1.2 },
    { id:'podium', txt:'un podium', bonus:2.2 },
    { id:'devant', txt:'battre l\'écurie rivale', bonus:.7 },
  ];
  const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const PRIMES = [60, 52, 45, 40, 35, 30, 26, 22, 19, 16];          // M€ en fin de saison selon la place des constructeurs

  /* ---------- Les circuits : les 24 du calendrier (circuits.js), avec leur caractère ---------- */
  function circuits(){ return window.PADDOCK_CIRCUITS || []; }
  function circuit(id){ return circuits().find(c => c.id === id); }

  /* ---------- Les réglages de la saison ---------- */
  const REGLAGES_SAISON = {
    nbGP:{ nom:'Nombre de Grands Prix', choix:[6, 8, 10, 12, 16, 20, 24], defaut:12 },
    longueur:{ nom:'Longueur des courses', choix:['courte', 'moyenne', 'longue'], noms:{ courte:'Courte (20 %)', moyenne:'Moyenne (30 %)', longue:'Longue (45 %)' }, defaut:'courte' },
    essais:{ nom:'Essais libres (réglages)', choix:[true, false], noms:{ true:'Oui', false:'Non, réglage automatique' }, defaut:true },
    qualifs:{ nom:'Qualifications', choix:['direct', 'rapide'], noms:{ direct:'Q1, Q2, Q3 en direct', rapide:'Rapides (résultat tout de suite)' }, defaut:'direct' },
    meteo:{ nom:'Météo', choix:['seche', 'normale', 'changeante'], noms:{ seche:'Plutôt sèche', normale:'Normale', changeante:'Très changeante' }, defaut:'normale' },
    pannes:{ nom:'Pannes', choix:['rares', 'normales', 'frequentes'], noms:{ rares:'Rares', normales:'Normales', frequentes:'Fréquentes' }, defaut:'normales' },
    sc:{ nom:'Voiture de sécurité', choix:[true, false], noms:{ true:'Oui', false:'Non' }, defaut:true },
    difficulte:{ nom:'Difficulté', choix:['facile', 'normale', 'difficile'], noms:{ facile:'Facile', normale:'Normale', difficile:'Difficile' }, defaut:'normale' },
    plafond:{ nom:'Plafond budgétaire', choix:[true, false], noms:{ true:'Oui (30 M€ par saison pour les pièces)', false:'Non' }, defaut:true },
  };
  const reglagesDefaut = () => Object.fromEntries(Object.entries(REGLAGES_SAISON).map(([k, r]) => [k, r.defaut]));
  const LONGUEUR = { courte:.2, moyenne:.3, longue:.45 };
  const METEO = { seche:.35, normale:1, changeante:1.8 };
  const PANNES = { rares:.5, normales:1, frequentes:1.8 };
  const DIFF = { facile:{ ia:.6, argent:45, confiance:70 }, normale:{ ia:1, argent:30, confiance:60 }, difficile:{ ia:1.4, argent:20, confiance:50 } };
  const PLAFOND = 30;
  // le nombre de tours d'un Grand Prix
  const nbTours = (C, c) => Math.max(8, Math.round(c.tours * LONGUEUR[(C.reglages || {}).longueur || 'courte']));
  // les sommes « par Grand Prix » sont calculées pour une saison de 12 courses
  const parGP = C => 12 / Math.max(1, C.calendrier ? C.calendrier.length : 12);
  // les circuits retenus : répartis sur le calendrier quand on ne les a pas choisis un par un
  function choisirCircuits(nb){
    const l = circuits(); if(nb >= l.length) return l.map(c => c.id);
    return Array.from({ length:nb }, (_, i) => l[Math.floor((i + .5) * l.length / nb)].id);
  }

  /* ---------- La personnalisation de l'écurie du joueur ---------- */
  const COULEURS = ['#E10600', '#FF8000', '#FFC906', '#1DCB3C', '#00A19C', '#2EA8E8', '#1434CB', '#1B2A5C', '#6A2CD8', '#FF87BC', '#F2F4F8', '#8A8F98', '#111111', '#7A3B12', '#00594F', '#C0A062'];
  const LOGOS = ['⭐', '🦅', '🐺', '⚡', '🔥', '🏔️', '🐉', '🦁', '❄️', '🚀', '🐎', '🦈', '🐝', '🍀', '👑', '🌪️', '🐻', '🦊', '🎯', '💥'];
  const courtDe = nom => (nom.replace(/^(équipe|écurie|team|scuderia|racing)\s+(des?\s+|du\s+|d'|l')?/i, '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'MOI');
  function personnaliser(C, perso){
    const E = C.ecuries[C.joueur];
    if(perso.nom && perso.nom.trim()){ E.nom = perso.nom.trim().slice(0, 28); E.court = courtDe(E.nom); }
    if(perso.c1) E.c1 = perso.c1; if(perso.c2) E.c2 = perso.c2; if(perso.logo) E.logo = perso.logo;
  }

  /* ---------- Les installations de l'usine (niveau 1 à 5) ---------- */
  const INSTALLATIONS = {
    soufflerie:{ nom:'Soufflerie', ico:'🌬️', role:'Les pièces aérodynamiques (ailerons, fond plat) rapportent plus.' },
    banc:{ nom:'Banc moteur', ico:'⚙️', role:'Les nouveaux moteurs rapportent plus, la fiabilisation aussi.' },
    simulateur:{ nom:'Simulateur', ico:'🖥️', role:'On arrive sur chaque circuit avec une meilleure idée du réglage ; les jeunes pilotes progressent plus.' },
    atelier:{ nom:'Atelier de fabrication', ico:'🏭', role:'Les pièces coûtent moins cher à fabriquer, et arrivent plus vite (dès le niveau 3).' },
    stands:{ nom:'Centre d\'entraînement des stands', ico:'🔧', role:'Des arrêts au stand plus rapides, moins de ratés.' },
    qualite:{ nom:'Contrôle qualité', ico:'🧪', role:'Moins de pannes en course.' },
  };
  const coutInstallation = niv => [0, 6, 9, 13, 18][niv] || 0;            // pour passer du niveau niv à niv + 1
  const dureeInstallation = niv => niv;                                     // en Grands Prix
  function ameliorerInstallation(C, k){
    const I = C.installations[k];
    if(I.travaux) return { ok:false, msg:'Des travaux sont déjà en cours.' };
    if(I.niv >= 5) return { ok:false, msg:'Niveau maximal.' };
    const cout = coutInstallation(I.niv);
    if(C.argent < cout) return { ok:false, msg:'Pas assez d\'argent.' };
    C.argent = arrondi(C.argent - cout, 2);
    I.travaux = { fin:C.gp + dureeInstallation(I.niv), saison:C.saison };
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Travaux : ${INSTALLATIONS[k].nom}`, montant:-cout });
    return { ok:true, msg:`Travaux lancés : ${INSTALLATIONS[k].nom} niveau ${I.niv + 1}, prêt dans ${dureeInstallation(I.niv)} Grand${I.niv > 1 ? 's' : ''} Prix.` };
  }
  function terminerTravaux(C, finDeSaison = false){
    for(const [k, I] of Object.entries(C.installations)){
      if(I.travaux && (finDeSaison || C.gp >= I.travaux.fin)){ I.niv++; I.travaux = null; message(C, `${INSTALLATIONS[k].ico} ${INSTALLATIONS[k].nom} : niveau ${I.niv} terminé !`, 'bon'); }
    }
  }
  const entretien = C => arrondi(Object.values(C.installations).reduce((t, I) => t + I.niv, 0) * .06 * parGP(C), 2);

  /* ---------- Les pièces : conception, fabrication, montage ---------- */
  // chaque pièce compte pour une part d'un ou deux domaines de la voiture
  const PIECES = {
    avant:{ nom:'Aileron avant', ico:'🔺', dom:{ aero:.4 }, inst:'soufflerie', base:1.5 },
    arriere:{ nom:'Aileron arrière', ico:'🔻', dom:{ aero:.35 }, inst:'soufflerie', base:1.5 },
    fond:{ nom:'Fond plat', ico:'⬛', dom:{ aero:.25, chassis:.4 }, inst:'soufflerie', base:2 },
    suspension:{ nom:'Suspension', ico:'🌀', dom:{ chassis:.6 }, inst:'atelier', base:1.5 },
    moteur:{ nom:'Unité de puissance', ico:'⚙️', dom:{ moteur:1 }, inst:'banc', base:2.5 },
  };
  const AMBITIONS = {
    prudente:{ nom:'Prudente', cout:1, duree:1, gain:[2, 3.2], risque:0, aide:'Petit gain, prête vite, sans risque.' },
    normale:{ nom:'Normale', cout:1.6, duree:2, gain:[3, 5], risque:.08, aide:'Bon gain, un petit risque de déception.' },
    ambitieuse:{ nom:'Ambitieuse', cout:2.6, duree:3, gain:[4.5, 8], risque:.22, aide:'Gros gain possible, mais longue et risquée.' },
  };
  const DOMAINES = { moteur:{ nom:'Moteur', ico:'⚙️', aide:'Vitesse dans les lignes droites' }, aero:{ nom:'Aérodynamique', ico:'🪽', aide:'Vitesse dans les virages' },
    chassis:{ nom:'Châssis', ico:'🏎️', aide:'Équilibre partout, usure des pneus' }, fiabilite:{ nom:'Fiabilité', ico:'🛠️', aide:'Moins de pannes et d\'abandons' } };
  const rendement = niv => clamp((99 - niv) / 13, .15, 1);
  const multInstallation = (C, k) => .75 + .1 * C.installations[k].niv;
  function piecesVides(){ return Object.fromEntries(Object.keys(PIECES).map(k => [k, { gens:[{ n:0, gain:0 }], stock:{}, conception:null }])); }
  // le gain d'une génération de pièce
  const gainGen = (C, type, n) => (C.pieces[type].gens.find(g => g.n === n) || { gain:0 }).gain;
  // la voiture d'un pilote (place 0 ou 1) : la base de l'écurie plus les pièces montées
  function voitureDe(C, place){
    const E = ecurieJoueur(C), V = { moteur:E.moteur, aero:E.aero, chassis:E.chassis, fiabilite:E.fiabilite };
    const m = C.montage[place] || {};
    for(const [type, P] of Object.entries(PIECES)) for(const [dom, w] of Object.entries(P.dom)) V[dom] = arrondi(V[dom] + gainGen(C, type, m[type] || 0) * w, 1);
    V.fiabilite = arrondi(Math.min(99, V.fiabilite + (C.installations.qualite.niv - 1) * .8), 1);
    for(const k of Object.keys(V)) V[k] = Math.min(99.5, V[k]);
    return V;
  }
  const depensesPieces = C => arrondi(C.plafondDepenses || 0, 2);
  const plafondOk = (C, cout) => !C.reglages.plafond || depensesPieces(C) + cout <= PLAFOND + 1e-6;
  function coutConception(C, type, amb){
    const faits = (C.conceptions || {})[type] || 0;
    return arrondi(PIECES[type].base * AMBITIONS[amb].cout * (1 + faits * .12), 1);
  }
  const coutFabrication = (C, type) => arrondi(PIECES[type].base * .25 * (1.25 - .1 * C.installations.atelier.niv), 2);
  function lancerConception(C, type, amb){
    const pc = C.pieces[type];
    if(pc.conception) return { ok:false, msg:'Une conception est déjà en cours pour cette pièce.' };
    const cout = coutConception(C, type, amb), A = AMBITIONS[amb];
    if(C.argent < cout) return { ok:false, msg:'Pas assez d\'argent.' };
    if(!plafondOk(C, cout)) return { ok:false, msg:`Le plafond budgétaire (${PLAFOND} M€ par saison) serait dépassé.` };
    const t = C.personnel.technique.niv, P = PIECES[type];
    const domPrincipal = Object.entries(P.dom).sort((a, b) => b[1] - a[1])[0][0];
    let gain = hasard(...A.gain) * (.75 + .12 * t) * multInstallation(C, P.inst) * rendement(ecurieJoueur(C)[domPrincipal]);
    const rate = Math.random() < A.risque;
    if(rate) gain *= .35;
    const duree = Math.max(1, A.duree - (t >= 4 ? 1 : 0));
    C.argent = arrondi(C.argent - cout, 2); C.plafondDepenses = arrondi((C.plafondDepenses || 0) + cout, 2);
    pc.conception = { amb, gain:arrondi(gain, 2), rate, fin:C.gp + duree, saison:C.saison, cout };
    C.conceptions = C.conceptions || {}; C.conceptions[type] = (C.conceptions[type] || 0) + 1;
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Conception : ${P.nom}`, montant:-cout });
    return { ok:true, msg:`Conception lancée : ${P.nom} (${A.nom.toLowerCase()}), prête dans ${duree} Grand${duree > 1 ? 's' : ''} Prix.` };
  }
  // fabriquer des exemplaires d'une génération (ils arrivent au Grand Prix suivant, ou tout de suite avec un bon atelier)
  function fabriquer(C, type, n, nb = 1){
    const cout = arrondi(coutFabrication(C, type) * nb, 2), P = PIECES[type];
    if(C.argent < cout) return { ok:false, msg:'Pas assez d\'argent.' };
    if(!plafondOk(C, cout)) return { ok:false, msg:`Le plafond budgétaire (${PLAFOND} M€ par saison) serait dépassé.` };
    C.argent = arrondi(C.argent - cout, 2); C.plafondDepenses = arrondi((C.plafondDepenses || 0) + cout, 2);
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Fabrication : ${P.nom} ×${nb}`, montant:-cout });
    if(C.installations.atelier.niv >= 3){ ranger(C, type, n, nb); return { ok:true, msg:`${nb} ${P.nom.toLowerCase()} fabriqué${nb > 1 ? 's' : ''} et monté${nb > 1 ? 's' : ''}.` }; }
    C.fabrications = C.fabrications || []; C.fabrications.push({ type, n, nb, fin:C.gp + 1 });
    return { ok:true, msg:`${nb} ${P.nom.toLowerCase()} en fabrication, prêt${nb > 1 ? 's' : ''} au prochain Grand Prix.` };
  }
  // une pièce neuve : montée sur la voiture qui a la moins bonne, sinon gardée en réserve
  function ranger(C, type, n, nb){
    const pc = C.pieces[type];
    for(let k = 0; k < nb; k++){
      const places = [0, 1].filter(i => (C.montage[i][type] || 0) < n).sort((a, b) => (C.montage[a][type] || 0) - (C.montage[b][type] || 0));
      if(places.length){ const i = places[0], ancien = C.montage[i][type] || 0; C.montage[i][type] = n; if(ancien) pc.stock[ancien] = (pc.stock[ancien] || 0) + 1; }
      else pc.stock[n] = (pc.stock[n] || 0) + 1;
    }
  }
  // échanger une pièce de la réserve avec celle d'une voiture
  function monterPiece(C, place, type, n){
    const pc = C.pieces[type];
    if(!(pc.stock[n] > 0)) return false;
    const ancien = C.montage[place][type] || 0;
    pc.stock[n]--; if(!pc.stock[n]) delete pc.stock[n];
    if(ancien) pc.stock[ancien] = (pc.stock[ancien] || 0) + 1;
    C.montage[place][type] = n; return true;
  }
  function avancerUsine(C){
    // les conceptions terminées
    for(const [type, pc] of Object.entries(C.pieces)){
      const cc = pc.conception; if(!cc || C.gp < cc.fin) continue;
      const n = pc.gens.length;
      pc.gens.push({ n, gain:cc.gain }); pc.conception = null;
      message(C, `${PIECES[type].ico} ${PIECES[type].nom} v${n} conçue (+${String(cc.gain).replace('.', ',')})${cc.rate ? ' : décevante, la soufflerie s\'est trompée.' : '.'} Il faut maintenant la fabriquer (onglet Voiture).`, cc.rate ? 'mal' : 'bon');
    }
    for(const f of (C.fabrications || []).filter(f => C.gp >= f.fin)){ ranger(C, f.type, f.n, f.nb); message(C, `${PIECES[f.type].ico} ${f.nb} ${PIECES[f.type].nom.toLowerCase()} v${f.n} livré${f.nb > 1 ? 's' : ''}.`, 'bon'); }
    C.fabrications = (C.fabrications || []).filter(f => C.gp < f.fin);
    // la fiabilisation
    if(C.fiabilisation && C.gp >= C.fiabilisation.fin){ const E = ecurieJoueur(C); E.fiabilite = arrondi(Math.min(99, E.fiabilite + C.fiabilisation.gain), 1); message(C, `🛠️ Fiabilisation terminée : fiabilité +${String(C.fiabilisation.gain).replace('.', ',')}.`, 'bon'); C.fiabilisation = null; }
  }
  const coutFiabilisation = C => arrondi(2 + ((C.conceptions || {}).fiab || 0) * .8, 1);
  function lancerFiabilisation(C){
    if(C.fiabilisation) return { ok:false, msg:'Déjà en cours.' };
    const cout = coutFiabilisation(C);
    if(C.argent < cout) return { ok:false, msg:'Pas assez d\'argent.' };
    if(!plafondOk(C, cout)) return { ok:false, msg:`Le plafond budgétaire (${PLAFOND} M€ par saison) serait dépassé.` };
    const gain = arrondi(hasard(2.4, 4.4) * (.75 + .12 * C.personnel.technique.niv) * multInstallation(C, 'banc') * rendement(ecurieJoueur(C).fiabilite), 1);
    C.argent = arrondi(C.argent - cout, 2); C.plafondDepenses = arrondi((C.plafondDepenses || 0) + cout, 2);
    C.fiabilisation = { gain, fin:C.gp + 1 };
    C.conceptions = C.conceptions || {}; C.conceptions.fiab = (C.conceptions.fiab || 0) + 1;
    C.finances.push({ saison:C.saison, gp:C.gp, txt:'Fiabilisation', montant:-cout });
    return { ok:true, msg:'Fiabilisation lancée : prête au prochain Grand Prix.' };
  }
  // un accident casse une pièce : on prend la meilleure de la réserve, sinon l'ancienne
  function casse(C, place){
    const types = ['avant', 'arriere', 'fond', 'suspension'], type = choisir(types), pc = C.pieces[type];
    const n = C.montage[place][type] || 0; if(!n) return null;
    const dispo = Object.keys(pc.stock).map(Number).filter(g => pc.stock[g] > 0).sort((a, b) => b - a)[0];
    if(dispo){ pc.stock[dispo]--; if(!pc.stock[dispo]) delete pc.stock[dispo]; C.montage[place][type] = dispo; }
    else C.montage[place][type] = 0;
    return { type, n, remplace:dispo || 0 };
  }

  /* ---------- Une nouvelle carrière ---------- */
  function nouvelleCarriere(idEcurie, directeur, perso = null, reglages = null){
    const R = { ...reglagesDefaut(), ...(reglages || {}) };
    const C = { v:2, saison:2026, gp:0, directeur:directeur || 'Directeur', joueur:idEcurie, debut:Date.now(), reglages:R,
      ecuries:{}, pilotes:{}, personnel:{}, candidats:{}, sponsors:[null, null, null], offres:[], messages:[],
      finances:[], historique:[], records:{ gp:0, victoires:0, podiums:0, poles:0, points:0, titresP:0, titresC:0, meilleurePlace:10 }, phase:'saison' };
    for(const e of ECURIES) C.ecuries[e.id] = { ...JSON.parse(JSON.stringify(e)), points:0, victoires:0, budgetDev:0 };
    for(const p of PILOTES){
      const [id, nom, drapeau, age, vitesse, regularite, pneus, depassement, pluie, salaire, potentiel] = p;
      const eq = ECURIES.find(e => e.pilotes.includes(id));
      C.pilotes[id] = { id, nom, drapeau, age, vitesse, regularite, pneus, depassement, pluie, salaire, potentiel, moral:70, ecurie:eq ? eq.id : null,
        fin:eq ? 2026 + Math.floor(Math.random() * 3) : null, points:0, carriere:{ gp:0, victoires:0, podiums:0, points:0, titres:0 } };
    }
    for(const id of C.ecuries[idEcurie].pilotes) C.pilotes[id].fin = 2026;
    const E = C.ecuries[idEcurie];
    if(perso) personnaliser(C, perso);
    const D = DIFF[R.difficulte] || DIFF.normale;
    C.argent = D.argent; C.reputation = E.prestige; C.confiance = D.confiance;
    C.personnel = { technique:employe(2), course:employe(2), mecanos:employe(2) };
    completer(C);
    genererCandidats(C);
    nouveauCalendrier(C);
    C.objectif = objectifDirection(C);
    genererOffres(C);
    message(C, `Bienvenue chez ${E.nom}, ${C.directeur} ! La direction attend une ${C.objectif}e place au championnat des constructeurs. Commence par signer un sponsor principal, puis lance la conception de nouvelles pièces (onglet Voiture).`);
    return C;
  }
  // ce qui manque à une carrière (nouvelle, ou d'une version précédente du jeu)
  function completer(C){
    C.reglages = { ...reglagesDefaut(), ...(C.reglages || {}) };
    if(C.confiance == null) C.confiance = 60;
    if(!C.installations) C.installations = Object.fromEntries(Object.keys(INSTALLATIONS).map(k => [k, { niv:1, travaux:null }]));
    if(!C.pieces) C.pieces = piecesVides();
    if(!C.montage) C.montage = [{}, {}];
    if(C.plafondDepenses == null) C.plafondDepenses = 0;
    delete C.projets; delete C.projetsFaits;
  }
  // une carrière de la première version : les circuits de Draw Race sont remplacés par les nouveaux
  function migrer(C){
    if(!C) return null;
    if(C.v === 1){
      completer(C);
      const ids = choisirCircuits(C.calendrier.length);
      C.calendrier.forEach((g, i) => { g.id = ids[i]; const c = circuit(g.id); g.nom = c.n; g.pluie = c.pluie; g.meteo = null; });
      C.reglages.nbGP = C.calendrier.length;
      C.v = 2;
    }
    if(C.v !== 2) return null;
    completer(C);
    return C;
  }
  function message(C, txt, type = 'info'){ C.messages.unshift({ txt, type, saison:C.saison, gp:C.gp }); C.messages = C.messages.slice(0, 40); }
  const ecurieJoueur = C => C.ecuries[C.joueur];
  const pilotesDe = (C, id) => Object.values(C.pilotes).filter(p => p.ecurie === id);

  function nouveauCalendrier(C){
    const R = C.reglages;
    const ids = (R.circuits && R.circuits.length ? R.circuits.filter(id => circuit(id)) : choisirCircuits(R.nbGP));
    const ordre = circuits().map(c => c.id);
    ids.sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b));
    C.calendrier = ids.map(id => { const c = circuit(id); return { id, nom:c.n, pluie:clamp(c.pluie * METEO[R.meteo] + hasard(-.04, .04), 0, .75), resultat:null }; });
  }
  // l'objectif de la saison : la place de la voiture dans le plateau (un peu mieux si l'écurie a du prestige)
  function objectifDirection(C){
    const rang = rangVoiture(C, { wM:.33, wA:.37, wC:.3 });
    return clamp(rang - (C.reputation > 75 ? 1 : 0), 1, 10);
  }

  /* ---------- La voiture ---------- */
  // poids du moteur et de l'aérodynamique selon le circuit (part des grandes lignes droites)
  function caractere(c){
    if(c._car) return c._car;
    let puissance = .45;
    try{ puissance = window.PaddockCourse.circuitCourse(c).puissance; }catch(e){}
    return c._car = { puissance, wM:.22 + puissance * .3, wA:.48 - puissance * .25, wC:.3 - puissance * .05 };
  }
  function perfVoiture(e, car = { wM:.33, wA:.37, wC:.3 }){ return e.moteur * car.wM + e.aero * car.wA + e.chassis * car.wC; }
  // la place attendue de l'écurie du joueur (d'après les voitures)
  function rangVoiture(C, car){
    const moi = [0, 1].map(i => perfVoiture(voitureDe(C, i), car)).reduce((a, b) => a + b) / 2;
    return Object.values(C.ecuries).filter(e => e.id !== C.joueur && perfVoiture(e, car) > moi).length + 1;
  }
  // les autres écuries progressent aussi, selon leur budget (et la difficulté)
  function developpementIA(C){
    const k0 = (DIFF[C.reglages.difficulte] || DIFF.normale).ia * parGP(C);
    for(const e of Object.values(C.ecuries)){
      if(e.id === C.joueur) continue;
      const k = e.budget / 140 * k0;
      for(const dom of ['moteur', 'aero', 'chassis', 'fiabilite']) if(Math.random() < .45) e[dom] = arrondi(Math.min(99, e[dom] + hasard(0, .8) * k * rendement(e[dom])), 1);
    }
  }

  /* ---------- La direction : confiance et objectifs ---------- */
  const OBJ_COURSE = [
    { id:'podium', txt:'un podium', ok:mes => mes.some(r => !r.abandon && r.place <= 3) },
    { id:'top5', txt:'une voiture dans les 5 premiers', ok:mes => mes.some(r => !r.abandon && r.place <= 5) },
    { id:'deuxpoints', txt:'les deux voitures dans les points', ok:mes => mes.every(r => !r.abandon && r.place <= 10) },
    { id:'points', txt:'marquer des points (top 10)', ok:mes => mes.some(r => !r.abandon && r.place <= 10) },
    { id:'top12', txt:'une voiture dans les 12 premiers', ok:mes => mes.some(r => !r.abandon && r.place <= 12) },
    { id:'top15', txt:'une voiture dans les 15 premiers', ok:mes => mes.some(r => !r.abandon && r.place <= 15) },
    { id:'finir', txt:'les deux voitures à l\'arrivée', ok:mes => mes.every(r => !r.abandon) },
  ];
  function objectifCourse(C){
    const c = circuit(C.calendrier[C.gp].id), r = rangVoiture(C, caractere(c));
    return r <= 1 ? 'podium' : r <= 2 ? 'top5' : r <= 3 ? 'deuxpoints' : r <= 5 ? 'points' : r <= 7 ? 'top12' : r <= 9 ? 'top15' : 'finir';
  }
  const humeur = conf => conf >= 80 ? 'ravie' : conf >= 60 ? 'confiante' : conf >= 40 ? 'inquiète' : conf >= 20 ? 'très mécontente' : 'prête à te renvoyer';
  function demanderRallonge(C){
    if(C.rallonge === C.saison) return { ok:false, msg:'Tu as déjà demandé une rallonge cette saison.' };
    C.rallonge = C.saison;
    if(C.confiance < 55){ C.confiance = clamp(C.confiance - 3, 0, 100); return { ok:false, msg:'Refusé : la direction n\'a pas assez confiance en toi (il faut au moins 55).' }; }
    const m = arrondi(6 + C.reputation / 12, 1);
    C.argent = arrondi(C.argent + m, 2); C.confiance = clamp(C.confiance - 15, 0, 100);
    C.finances.push({ saison:C.saison, gp:C.gp, txt:'🤝 Rallonge de la direction', montant:m });
    return { ok:true, msg:`La direction accepte : +${String(m).replace('.', ',')} M€. Elle attend des résultats !` };
  }

  /* ---------- Le personnel ---------- */
  function genererCandidats(C){
    C.candidats = {};
    for(const poste of Object.keys(POSTES)) C.candidats[poste] = [1, 2, 3, 4, 5].map(niv => employe(niv)).filter(() => Math.random() < .8);
    for(const poste of Object.keys(POSTES)) if(!C.candidats[poste].length) C.candidats[poste].push(employe(3));
  }
  function embaucher(C, poste, i){
    const cand = C.candidats[poste][i]; if(!cand) return { ok:false, msg:'' };
    const indem = arrondi(C.personnel[poste].salaire * .25, 1), prime = arrondi(cand.salaire * .2, 1);
    if(C.argent < indem + prime) return { ok:false, msg:'Pas assez d\'argent pour la prime de signature et l\'indemnité.' };
    C.argent = arrondi(C.argent - indem - prime, 2);
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Embauche : ${POSTES[poste].nom}`, montant:-(indem + prime) });
    const ancien = C.personnel[poste];
    C.personnel[poste] = cand; C.candidats[poste].splice(i, 1, ancien);
    return { ok:true, msg:`${cand.nom} devient ${POSTES[poste].nom.toLowerCase()} (${'★'.repeat(cand.niv)}).` };
  }

  /* ---------- Les sponsors ---------- */
  function genererOffres(C){
    const rep = C.reputation, prises = C.sponsors.filter(Boolean).map(s => s.nom);
    const libres = MARQUES.filter(m => !prises.includes(m[0])).sort(() => Math.random() - .5);
    C.offres = [];
    const rivale = rivaleDe(C);
    for(let i = 0; i < 6 && libres.length; i++){
      const [nom, ico] = libres.shift(), principal = i < 2;
      const base = principal ? .7 + rep / 45 : .2 + rep / 140;
      let objectifs = OBJECTIFS.filter(o => rep > 60 || !['podium', 'top5'].includes(o.id) || Math.random() < .3);
      const o = choisir(objectifs);
      C.offres.push({ nom, ico, principal, parGP:arrondi(base * hasard(.85, 1.2) * parGP(C), 2), objectif:o.id, txtObjectif:o.id === 'devant' ? `finir devant ${C.ecuries[rivale].nom}` : o.txt,
        bonus:arrondi(o.bonus * (principal ? 1.6 : 1) * (.6 + rep / 110) * parGP(C), 2), rivale });
    }
  }
  function rivaleDe(C){
    const tri = Object.values(C.ecuries).sort((a, b) => perfVoiture(b) - perfVoiture(a)), i = tri.findIndex(e => e.id === C.joueur);
    return (tri[i - 1] || tri[i + 1]).id;
  }
  function signerSponsor(C, i){
    const o = C.offres[i]; if(!o) return { ok:false };
    const slot = o.principal ? 0 : (C.sponsors[1] ? (C.sponsors[2] ? -1 : 2) : 1);
    if(slot < 0 || (o.principal && C.sponsors[0])) return { ok:false, msg:o.principal ? 'Tu as déjà un sponsor principal.' : 'Les deux places de sponsors secondaires sont prises.' };
    C.sponsors[slot] = { ...o, signe:C.saison }; C.offres.splice(i, 1);
    return { ok:true, msg:`${o.ico} ${o.nom} rejoint l'écurie : ${String(o.parGP).replace('.', ',')} M€ par Grand Prix.` };
  }
  function objectifAtteint(C, s, res){
    const mes = res.classement.filter(r => r.ecurie === C.joueur);
    switch(s.objectif){
      case 'finir': return mes.every(r => !r.abandon);
      case 'points': return mes.some(r => r.place <= 10 && !r.abandon);
      case 'deuxpoints': return mes.every(r => r.place <= 10 && !r.abandon);
      case 'top5': return mes.some(r => r.place <= 5 && !r.abandon);
      case 'podium': return mes.some(r => r.place <= 3 && !r.abandon);
      case 'devant': { const best = id => Math.min(...res.classement.filter(r => r.ecurie === id).map(r => r.abandon ? 99 : r.place)); return best(C.joueur) < best(s.rivale); }
    }
    return false;
  }

  /* ---------- Après un Grand Prix ---------- */
  // res.classement : [{ pilote, ecurie, place, abandon, accident, degats, arrets }], res.pole, res.meilleurTour
  function appliquerResultat(C, res){
    const E = ecurieJoueur(C), bilan = { points:0, argent:0, lignes:[], casse:[] };
    const gpInfo = C.calendrier[C.gp], k = parGP(C);
    for(const r of res.classement){
      const p = C.pilotes[r.pilote], pts = !r.abandon && r.place <= 10 ? POINTS[r.place - 1] : 0;
      p.points += pts; C.ecuries[r.ecurie].points += pts; p.carriere.gp++; p.carriere.points += pts;
      if(r.place === 1 && !r.abandon){ p.carriere.victoires++; C.ecuries[r.ecurie].victoires++; }
      if(r.place <= 3 && !r.abandon) p.carriere.podiums++;
      if(r.ecurie === C.joueur){
        bilan.points += pts;
        p.moral = clamp(p.moral + (r.abandon ? -6 : r.place <= 3 ? 8 : r.place <= 10 ? 3 : -2), 10, 100);
        if(!r.abandon && r.place === 1) C.records.victoires++;
        if(!r.abandon && r.place <= 3) C.records.podiums++;
        if(r.degats){ bilan.argent -= r.degats; bilan.lignes.push([`Réparations (${p.nom})`, -r.degats]); }
        // un accident casse une pièce
        if(r.accident){ const place = E.pilotes.indexOf(r.pilote), c = place >= 0 ? casse(C, place) : null;
          if(c){ bilan.casse.push(`${p.nom} : ${PIECES[c.type].nom.toLowerCase()} v${c.n} détruit${c.type === 'suspension' || c.type === 'avant' || c.type === 'arriere' ? '' : ''}, remplacé par ${c.remplace ? 'la v' + c.remplace + ' de la réserve' : 'la pièce de base'}`); message(C, `💥 ${bilan.casse[bilan.casse.length - 1]}.`, 'mal'); } }
      }
    }
    if(res.pole && C.pilotes[res.pole] && C.pilotes[res.pole].ecurie === C.joueur) C.records.poles++;
    C.records.points += bilan.points; C.records.gp++;
    for(const s of C.sponsors.filter(Boolean)){
      bilan.argent += s.parGP; bilan.lignes.push([`${s.ico} ${s.nom}`, s.parGP]);
      if(objectifAtteint(C, s, res)){ bilan.argent += s.bonus; bilan.lignes.push([`${s.ico} Prime : ${s.txtObjectif}`, s.bonus]); }
    }
    const salaires = arrondi((pilotesDe(C, C.joueur).reduce((t, p) => t + p.salaire, 0) + Object.values(C.personnel).reduce((t, e) => t + e.salaire, 0)) / 12 * k, 2);
    bilan.argent -= salaires; bilan.lignes.push(['👷 Salaires (pilotes et personnel)', -salaires]);
    const usine = arrondi(.6 * k + entretien(C), 2);
    bilan.argent -= usine; bilan.lignes.push(['🏭 Usine, installations et transport', -usine]);
    bilan.argent = arrondi(bilan.argent, 2);
    C.argent = arrondi(C.argent + bilan.argent, 2);
    bilan.lignes.forEach(([txt, m]) => C.finances.push({ saison:C.saison, gp:C.gp, txt, montant:m }));
    C.finances = C.finances.slice(-160);
    // la direction juge le résultat
    const mes = res.classement.filter(r => r.ecurie === C.joueur);
    const obj = OBJ_COURSE.find(o => o.id === (gpInfo.objectif || objectifCourse(C)));
    bilan.objectif = obj.txt; bilan.reussi = obj.ok(mes);
    const avant = C.confiance;
    C.confiance = clamp(C.confiance + (bilan.reussi ? 4 : mes.every(r => r.abandon) ? -4 : -2) * Math.sqrt(k), 0, 100);
    bilan.confiance = arrondi(C.confiance - avant, 1);
    const place = classementConstructeurs(C).findIndex(e => e.id === C.joueur) + 1;
    C.reputation = clamp(C.reputation + ((bilan.points >= 10 ? 2 : bilan.points > 0 ? 1 : 0) + (place <= C.objectif ? .5 : -.5)) * k, 10, 100);
    gpInfo.resultat = { classement:res.classement.map(r => ({ pilote:r.pilote, ecurie:r.ecurie, place:r.place, abandon:r.abandon })), pole:res.pole, meilleurTour:res.meilleurTour, objectif:bilan.reussi };
    C.gp++;
    C.weekend = null;
    terminerTravaux(C);
    avancerUsine(C);
    developpementIA(C);
    if(C.argent < 0) message(C, '⚠️ La caisse est dans le rouge ! Trouve des sponsors ou réduis les dépenses. La direction n\'aime pas ça.', 'mal');
    if(C.argent < 0) C.confiance = clamp(C.confiance - 2, 0, 100);
    if(C.confiance < 30) message(C, `📉 La direction est ${humeur(C.confiance)} (confiance ${Math.round(C.confiance)}). Sous 20 à la fin de la saison, tu seras renvoyé !`, 'mal');
    if(C.gp >= C.calendrier.length) C.phase = 'finSaison';
    return bilan;
  }

  /* ---------- Les classements ---------- */
  const classementPilotes = C => Object.values(C.pilotes).filter(p => p.points > 0 || p.ecurie).sort((a, b) => b.points - a.points || b.carriere.victoires - a.carriere.victoires);
  const classementConstructeurs = C => Object.values(C.ecuries).sort((a, b) => b.points - a.points || b.victoires - a.victoires);

  /* ---------- La fin de saison et le mercato ---------- */
  function finSaison(C){
    const cons = classementConstructeurs(C), pil = classementPilotes(C);
    const place = cons.findIndex(e => e.id === C.joueur) + 1, prime = PRIMES[place - 1];
    C.argent = arrondi(C.argent + prime, 2);
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`🏆 Prime de fin de saison (${place}e)`, montant:prime });
    const champion = pil[0], titreP = champion && champion.ecurie === C.joueur, titreC = cons[0].id === C.joueur;
    if(titreP) C.records.titresP++; if(titreC) C.records.titresC++;
    if(champion) champion.carriere.titres++;
    C.records.meilleurePlace = Math.min(C.records.meilleurePlace, place);
    const reussi = place <= C.objectif;
    C.reputation = clamp(C.reputation + (C.objectif - place) * 4 + (titreC ? 10 : 0), 10, 100);
    // la direction fait le bilan de la saison
    C.confiance = clamp(C.confiance + (reussi ? 12 + (C.objectif - place) * 3 : -(place - C.objectif) * 5) + (C.argent < 0 ? -10 : 0), 0, 100);
    const renvoye = C.confiance < 20;
    const resume = { saison:C.saison, place, points:ecurieJoueur(C).points, prime, objectif:C.objectif, reussi, champion:champion ? champion.id : null, championEcurie:champion ? champion.ecurie : null, constructeur:cons[0].id, titreP, titreC,
      victoires:ecurieJoueur(C).victoires, classementC:cons.map(e => [e.id, e.points]), classementP:pil.slice(0, 10).map(p => [p.id, p.points]), confiance:Math.round(C.confiance), renvoye };
    C.historique.push(resume);
    C.phase = renvoye ? 'renvoi' : 'mercato';
    C.resumeSaison = resume;
    return resume;
  }
  // les pilotes qu'on peut engager : libres, ou dont le contrat finit cette saison (au mercato)
  function marche(C){
    const auMercato = C.phase === 'mercato';
    return Object.values(C.pilotes).filter(p => !p.retraite && p.ecurie !== C.joueur && (!p.ecurie || (auMercato && p.fin <= C.saison)))
      .sort((a, b) => noteGlobale(b) - noteGlobale(a));
  }
  const noteGlobale = p => p.vitesse * .55 + p.regularite * .15 + p.pneus * .1 + p.depassement * .12 + p.pluie * .08;
  // ce que le pilote demande pour venir chez nous (M€ par saison)
  function demande(C, p){
    const ambition = clamp((noteGlobale(p) - 78) * 4.5, 0, 100);
    const ecart = Math.max(0, ambition - C.reputation);
    return arrondi(Math.max(.5, p.salaire * (1 + ecart / 60)), 1);
  }
  function engager(C, idPilote, idRemplace, ans = 2){
    const p = C.pilotes[idPilote], r = C.pilotes[idRemplace];
    if(!p || !r || r.ecurie !== C.joueur) return { ok:false, msg:'' };
    const sal = demande(C, p), auMercato = C.phase === 'mercato';
    // pendant la saison, il faut payer une partie du contrat du pilote remplacé
    const indem = auMercato && r.fin <= C.saison ? 0 : arrondi(r.salaire * .5, 1), prime = arrondi(sal * .1, 1);
    if(C.argent < indem + prime) return { ok:false, msg:`Pas assez d'argent (prime de signature ${prime} M€${indem ? ` et indemnité ${indem} M€` : ''}).` };
    C.argent = arrondi(C.argent - indem - prime, 2);
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Signature : ${p.nom}`, montant:-(indem + prime) });
    const ancienne = p.ecurie;
    if(ancienne){ const e = C.ecuries[ancienne]; e.pilotes = e.pilotes.filter(x => x !== p.id); }
    const E = ecurieJoueur(C); E.pilotes = E.pilotes.map(x => x === r.id ? p.id : x);
    r.ecurie = null; r.fin = null;
    p.ecurie = C.joueur; p.salaire = sal; p.fin = C.saison + ans - (auMercato ? 0 : 1); p.moral = 75;
    if(auMercato) p.fin = C.saison + ans;
    // l'écurie qui perd son pilote prend le remplaçant libéré ou un autre libre
    if(ancienne) remplir(C, ancienne);
    return { ok:true, msg:`${p.nom} signe pour ${ans} an${ans > 1 ? 's' : ''} à ${String(sal).replace('.', ',')} M€ par saison.` };
  }
  function prolonger(C, idPilote, ans = 2){
    const p = C.pilotes[idPilote]; if(!p || p.ecurie !== C.joueur) return { ok:false };
    const sal = demande(C, p);
    p.salaire = sal; p.fin = Math.max(p.fin || C.saison, C.saison) + ans; p.moral = clamp(p.moral + 8, 0, 100);
    return { ok:true, msg:`${p.nom} prolonge jusqu'en ${p.fin} à ${String(sal).replace('.', ',')} M€ par saison.` };
  }
  function remplir(C, idEcurie){
    const e = C.ecuries[idEcurie];
    while(e.pilotes.length < 2){
      const libre = Object.values(C.pilotes).filter(p => !p.ecurie && !p.retraite).sort((a, b) => noteGlobale(b) - noteGlobale(a));
      // les grandes écuries prennent les meilleurs, les petites tirent un peu au hasard
      const p = e.prestige > 80 ? libre[0] : libre[Math.floor(Math.random() * Math.min(4, libre.length))];
      if(!p){ const n = junior(C); n.ecurie = e.id; n.fin = C.saison + 1 + Math.floor(Math.random() * 2); e.pilotes.push(n.id); continue; }
      p.ecurie = e.id; p.fin = C.saison + 1 + Math.floor(Math.random() * 2); p.salaire = arrondi(Math.max(p.salaire, demandeIA(p, e)), 1); e.pilotes.push(p.id);
    }
  }
  const demandeIA = (p, e) => arrondi(Math.max(.5, (noteGlobale(p) - 75) * .9 * e.budget / 120), 1);
  function junior(C){
    const id = 'j' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
    const v = Math.round(hasard(74, 81));
    const p = { id, nom:nomAuHasard(), drapeau:choisir(DRAPEAUX), age:Math.round(hasard(18, 21)), vitesse:v, regularite:Math.round(hasard(70, 80)), pneus:Math.round(hasard(72, 80)),
      depassement:Math.round(hasard(72, 82)), pluie:Math.round(hasard(70, 82)), salaire:.4, potentiel:Math.round(hasard(84, 96)), moral:70, ecurie:null, fin:null, points:0,
      carriere:{ gp:0, victoires:0, podiums:0, points:0, titres:0 }, junior:true };
    C.pilotes[id] = p; return p;
  }
  // passer à la saison suivante : les pilotes vieillissent, les autres écuries complètent leurs équipes, les voitures se rapprochent
  function nouvelleSaison(C){
    const ancienne = C.saison;
    C.saison++;
    for(const p of Object.values(C.pilotes)){
      if(p.retraite) continue;
      p.age++;
      const sim = p.ecurie === C.joueur ? .85 + C.installations.simulateur.niv * .1 : 1;
      const d = p.age < 26 ? hasard(.2, .45) * Math.max(0, p.potentiel - p.vitesse) * sim : p.age < 33 ? hasard(-.8, .8) : -hasard(.4, 1.8);
      p.vitesse = clamp(Math.round(p.vitesse + d), 60, 99);
      for(const k of ['regularite', 'pneus', 'depassement', 'pluie']) p[k] = clamp(Math.round(p[k] + (p.age < 30 ? hasard(0, 1.5) : p.age > 34 ? -hasard(0, 1.5) : hasard(-.5, .5))), 60, 99);
      p.points = 0;
      // retraite des plus âgés
      if(p.age >= 38 && (p.ecurie === null || p.fin < C.saison) && Math.random() < (p.age - 36) * .25 && p.ecurie !== C.joueur){
        p.retraite = true; if(p.ecurie){ const e = C.ecuries[p.ecurie]; e.pilotes = e.pilotes.filter(x => x !== p.id); } p.ecurie = null;
      }
    }
    // les contrats terminés des autres écuries : la plupart prolongent, sinon le pilote est libre
    for(const p of Object.values(C.pilotes)){
      if(!p.ecurie || p.ecurie === C.joueur || p.fin >= C.saison) continue;
      if(Math.random() < .65){ p.fin = C.saison + 1 + Math.floor(Math.random() * 2); }
      else { const e = C.ecuries[p.ecurie]; e.pilotes = e.pilotes.filter(x => x !== p.id); p.ecurie = null; p.fin = null; }
    }
    // nos pilotes dont le contrat est fini et qu'on n'a pas prolongés s'en vont
    for(const p of pilotesDe(C, C.joueur)) if(p.fin < C.saison){ const e = ecurieJoueur(C); e.pilotes = e.pilotes.filter(x => x !== p.id); p.ecurie = null; p.fin = null; message(C, `${p.nom} quitte l'écurie (contrat terminé).`); }
    for(let i = 0; i < 3; i++) junior(C);
    for(const e of Object.values(C.ecuries)) if(e.id !== C.joueur) remplir(C, e.id);
    remplir(C, C.joueur);
    for(const p of pilotesDe(C, C.joueur)) if(!p.fin || p.fin < C.saison) p.fin = C.saison;
    // les meilleures pièces de la saison deviennent la base de la nouvelle voiture
    const E = ecurieJoueur(C), V0 = voitureDe(C, 0), V1 = voitureDe(C, 1), fq = (C.installations.qualite.niv - 1) * .8;
    for(const dom of ['moteur', 'aero', 'chassis']) E[dom] = arrondi(Math.max(V0[dom], V1[dom]), 1);
    C.pieces = piecesVides(); C.montage = [{}, {}]; C.fabrications = []; C.fiabilisation = null; C.conceptions = {}; C.plafondDepenses = 0;
    terminerTravaux(C, true);
    // nouveau règlement : les voitures se rapprochent un peu de la moyenne, les budgets suivent les résultats
    const cons = classementConstructeurs(C);
    for(const e of Object.values(C.ecuries)){
      for(const dom of ['moteur', 'aero', 'chassis', 'fiabilite']) e[dom] = arrondi(e[dom] + (86 - e[dom]) * .2, 1);
      const rang = cons.findIndex(x => x.id === e.id);
      if(e.id !== C.joueur) e.budget = clamp(Math.round(e.budget + (5 - rang) * 2 + hasard(-3, 3)), 60, 145);
      e.prestige = clamp(Math.round(e.prestige + (5 - rang) * 1.5), 20, 100);
      e.points = 0; e.victoires = 0;
    }
    C.gp = 0; C.phase = 'saison'; C.weekend = null;
    // les sponsors finissent avec la saison
    C.sponsors = [null, null, null];
    nouveauCalendrier(C); genererOffres(C); genererCandidats(C);
    C.objectif = objectifDirection(C);
    message(C, `Saison ${C.saison} : la direction vise une ${C.objectif}e place chez les constructeurs. Nouvelle voiture : pense à concevoir de nouvelles pièces, et à signer de nouveaux sponsors !`);
    C.resumeSaison = null;
    return ancienne;
  }

  const NOMS_PILOTES = Object.fromEntries(PILOTES.map(p => [p[0], p[1]]));
  return { COULEURS, LOGOS, personnaliser, NOMS_PILOTES, ECURIES, PETITES, POSTES, DOMAINES, POINTS, PRIMES, nouvelleCarriere, migrer, completer, circuits, circuit, caractere, perfVoiture,
    genererOffres, signerSponsor, embaucher, appliquerResultat, classementPilotes, classementConstructeurs, finSaison, marche, demande, engager, prolonger,
    nouvelleSaison, noteGlobale, pilotesDe, ecurieJoueur, message, rivaleDe, objectifAtteint, arrondi,
    REGLAGES_SAISON, reglagesDefaut, nbTours, parGP, choisirCircuits, nouveauCalendrier, PANNES, PLAFOND, depensesPieces,
    INSTALLATIONS, coutInstallation, dureeInstallation, ameliorerInstallation, entretien,
    PIECES, AMBITIONS, voitureDe, coutConception, coutFabrication, lancerConception, fabriquer, monterPiece, gainGen, coutFiabilisation, lancerFiabilisation,
    rangVoiture, OBJ_COURSE, objectifCourse, humeur, demanderRallonge };
})();
