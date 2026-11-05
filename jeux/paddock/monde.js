/* Paddock : le monde du jeu de gestion d'écurie (saison 2026, nouveau règlement).
   Écuries et pilotes : les vrais (l'application est privée) ; personnel et sponsors sont inventés.
   Tout l'état d'une carrière tient dans un seul objet (C), gardé dans « paddock-carriere ». */
window.PaddockMonde = (() => {
  const hasard = (a, b) => a + Math.random() * (b - a);
  const choisir = t => t[Math.floor(Math.random() * t.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const arrondi = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

  /* ---------- Les motoristes 2026 : puissance (thermique + électrique 50/50), fiabilité, part électrique bien gérée ---------- */
  const MOTORISTES = {
    mercedes:{ nom:'Mercedes', p:95, f:90, elec:93, usine:'fleches' },
    ferrari:{ nom:'Ferrari', p:92, f:86, elec:89, usine:'cavallino' },
    honda:{ nom:'Honda', p:90, f:84, elec:91, usine:'emeraude' },
    redbull:{ nom:'Red Bull Ford', p:88, f:81, elec:88, usine:'taureau' },
    audi:{ nom:'Audi', p:86, f:80, elec:86, usine:'trefle' },
  };

  /* ---------- Les 11 écuries de 2026 (les identifiants restent ceux des versions précédentes du jeu)
     stats de la voiture sur 100, budget en M€ par saison, prestige sur 100, motoriste ---------- */
  const ECURIES = [
    { id:'taureau', logo:'🐂', nom:'Red Bull Racing', court:'RBR', c1:'#1B2A5C', c2:'#E4002B', motoriste:'redbull', moteur:88, aero:92, chassis:90, fiabilite:82, budget:140, prestige:94, pilotes:['verstapin', 'hadjard'] },
    { id:'cavallino', logo:'🐎', nom:'Scuderia Ferrari', court:'FER', c1:'#DC0000', c2:'#FFF200', motoriste:'ferrari', moteur:92, aero:91, chassis:90, fiabilite:86, budget:140, prestige:98, pilotes:['leclaire', 'hamiltown'] },
    { id:'papaye', logo:'🟠', nom:'McLaren', court:'MCL', c1:'#FF8000', c2:'#1E2328', motoriste:'mercedes', moteur:94, aero:93, chassis:92, fiabilite:89, budget:138, prestige:92, pilotes:['norrish', 'piastrino'] },
    { id:'fleches', logo:'⭐', nom:'Mercedes-AMG', court:'MER', c1:'#2B2E33', c2:'#00D2BE', motoriste:'mercedes', moteur:95, aero:92, chassis:91, fiabilite:90, budget:140, prestige:93, pilotes:['russelle', 'antonello'] },
    { id:'emeraude', logo:'🪽', nom:'Aston Martin', court:'AMR', c1:'#00594F', c2:'#CEDC00', motoriste:'honda', moteur:90, aero:89, chassis:87, fiabilite:83, budget:132, prestige:76, pilotes:['alonsso', 'strolle'] },
    { id:'guillaume', logo:'🔷', nom:'Williams', court:'WIL', c1:'#00265A', c2:'#64C4FF', motoriste:'mercedes', moteur:93, aero:86, chassis:86, fiabilite:87, budget:105, prestige:64, pilotes:['albonne', 'sainze'] },
    { id:'veau', logo:'🐃', nom:'Racing Bulls', court:'RB', c1:'#F2F4F8', c2:'#1634CB', motoriste:'redbull', moteur:87, aero:85, chassis:85, fiabilite:81, budget:95, prestige:55, pilotes:['lawsonne', 'lindbloom'] },
    { id:'alpes', logo:'🔺', nom:'Alpine', court:'ALP', c1:'#0093CC', c2:'#FF87BC', motoriste:'mercedes', moteur:93, aero:84, chassis:84, fiabilite:86, budget:90, prestige:52, pilotes:['gaslight', 'colapinta'] },
    { id:'etoile', logo:'🦅', nom:'Haas', court:'HAA', c1:'#E8E8E8', c2:'#DA291C', motoriste:'ferrari', moteur:91, aero:84, chassis:84, fiabilite:84, budget:80, prestige:45, pilotes:['ocone', 'bierman'] },
    { id:'trefle', logo:'⭕', nom:'Audi', court:'AUD', c1:'#B7BBC0', c2:'#F50537', motoriste:'audi', moteur:86, aero:84, chassis:84, fiabilite:80, budget:118, prestige:56, pilotes:['hulkenbourg', 'bortoletto'] },
    { id:'cadillac', logo:'🛡️', nom:'Cadillac', court:'CAD', c1:'#121212', c2:'#E8E8E8', motoriste:'ferrari', moteur:91, aero:81, chassis:81, fiabilite:81, budget:110, prestige:40, pilotes:['peres', 'bottass'] },
  ];
  const PETITES = ['guillaume', 'alpes', 'etoile', 'trefle', 'cadillac'];       // le joueur commence avec l'une d'elles
  // l'écurie d'usine du motoriste peut concevoir son unité de puissance ; les clientes reçoivent celle du motoriste
  const usineMoteur = e => MOTORISTES[e.motoriste] && MOTORISTES[e.motoriste].usine === e.id;

  /* ---------- Les pilotes : âge, vitesse, régularité, pneus (gestion), dépassement, pluie, salaire (M€ par saison), potentiel ---------- */
  const PILOTES = [
    ['verstapin', 'Max Verstappen', '🇳🇱', 28, 97, 92, 90, 96, 98, 50, 97],
    ['hadjard', 'Isack Hadjar', '🇫🇷', 21, 88, 82, 82, 85, 84, 3, 93],
    ['leclaire', 'Charles Leclerc', '🇲🇨', 28, 94, 87, 86, 90, 88, 30, 95],
    ['hamiltown', 'Lewis Hamilton', '🇬🇧', 41, 89, 91, 92, 91, 94, 45, 90],
    ['norrish', 'Lando Norris', '🇬🇧', 26, 95, 89, 88, 90, 89, 30, 96],
    ['piastrino', 'Oscar Piastri', '🇦🇺', 25, 93, 91, 90, 88, 86, 18, 96],
    ['russelle', 'George Russell', '🇬🇧', 28, 93, 91, 89, 89, 90, 22, 93],
    ['antonello', 'Kimi Antonelli', '🇮🇹', 19, 89, 81, 83, 86, 85, 5, 96],
    ['alonsso', 'Fernando Alonso', '🇪🇸', 44, 88, 93, 94, 95, 93, 22, 88],
    ['strolle', 'Lance Stroll', '🇨🇦', 27, 82, 80, 84, 82, 86, 10, 83],
    ['albonne', 'Alexander Albon', '🇹🇭', 30, 88, 89, 88, 86, 86, 9, 88],
    ['sainze', 'Carlos Sainz', '🇪🇸', 31, 90, 91, 90, 89, 88, 12, 90],
    ['lawsonne', 'Liam Lawson', '🇳🇿', 24, 85, 81, 81, 86, 82, 2, 88],
    ['lindbloom', 'Arvid Lindblad', '🇬🇧', 18, 80, 75, 77, 81, 76, .8, 94],
    ['gaslight', 'Pierre Gasly', '🇫🇷', 30, 88, 87, 86, 87, 87, 10, 88],
    ['colapinta', 'Franco Colapinto', '🇦🇷', 22, 82, 76, 79, 83, 79, 1.5, 87],
    ['ocone', 'Esteban Ocon', '🇫🇷', 29, 86, 85, 86, 86, 87, 6, 86],
    ['bierman', 'Oliver Bearman', '🇬🇧', 20, 86, 80, 81, 84, 81, 2, 92],
    ['hulkenbourg', 'Nico Hülkenberg', '🇩🇪', 38, 86, 90, 88, 84, 87, 6, 86],
    ['bortoletto', 'Gabriel Bortoleto', '🇧🇷', 21, 85, 82, 82, 83, 81, 2, 92],
    ['peres', 'Sergio Pérez', '🇲🇽', 36, 85, 84, 92, 88, 83, 8, 85],
    ['bottass', 'Valtteri Bottas', '🇫🇮', 36, 86, 91, 89, 83, 86, 6, 86],
    // sans volant au départ (pilotes de réserve)
    ['tsunodo', 'Yuki Tsunoda', '🇯🇵', 26, 86, 80, 82, 87, 84, 4, 87],
    ['doohann', 'Jack Doohan', '🇦🇺', 23, 80, 76, 79, 80, 78, 1.5, 85],
    ['zhou', 'Zhou Guanyu', '🇨🇳', 27, 82, 85, 84, 80, 81, 1.5, 83],
    ['drugovitch', 'Felipe Drugovich', '🇧🇷', 26, 80, 82, 80, 78, 79, 1, 82],
    ['pourchet', 'Théo Pourchaire', '🇫🇷', 22, 81, 80, 80, 79, 80, .8, 88],
    ['iwasaki', 'Ayumu Iwasa', '🇯🇵', 24, 80, 79, 79, 80, 79, .7, 85],
    ['vestie', 'Frederik Vesti', '🇩🇰', 24, 79, 80, 79, 77, 80, .6, 84],
    ['crawford', 'Jak Crawford', '🇺🇸', 21, 79, 77, 78, 80, 77, .6, 88],
    ['fornaroli', 'Leonardo Fornaroli', '🇮🇹', 21, 79, 80, 79, 78, 78, .5, 88],
    ['dunne', 'Alex Dunne', '🇮🇪', 20, 78, 75, 77, 81, 76, .5, 90],
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

  /* ---------- Les sponsors (marques inventées) : [nom, icône, secteur] ---------- */
  const MARQUES = [
    ['Carbu Max', '⛽', 'energie'], ['Énergie Soleil', '☀️', 'energie'], ['Pétroles Boréal', '🛢️', 'energie'],
    ['Banque des Cimes', '🏦', 'banque'], ['Crédit Lumière', '💳', 'banque'], ['Assurances Sereno', '🛡️', 'banque'],
    ['Fusée Cola', '🥤', 'boisson'], ['Café Grimpette', '☕', 'boisson'], ['Boisson Volt', '⚡', 'boisson'],
    ['Montres Alpina', '⌚', 'luxe'], ['Parfums Brise', '🌸', 'luxe'], ['Lunettes Horizon', '🕶️', 'luxe'],
    ['Télécom Azur', '📡', 'tech'], ['Jeux Pixel', '🎮', 'tech'], ['Nuage Data', '☁️', 'tech'], ['Robots Atlas', '🤖', 'tech'],
    ['Fromagerie du Col', '🧀', 'alimentation'], ['Pâtes Turbo', '🍝', 'alimentation'], ['Chocolat Sommet', '🍫', 'alimentation'], ['Glaces Polaires', '🍦', 'alimentation'],
    ['Pneus Volcan', '🌋', 'auto'], ['Vélos Éclair', '🚲', 'auto'], ['Transports Comète', '🚚', 'auto'], ['Huiles Titan', '🛠️', 'auto'],
    ['Avions Cirrus', '✈️', 'voyage'], ['Hôtels Panorama', '🏨', 'voyage'],
  ];
  const SECTEURS = { energie:'énergie', banque:'banque et assurance', boisson:'boissons', luxe:'luxe', tech:'technologie', alimentation:'alimentation', auto:'automobile', voyage:'voyage' };
  // les emplacements sur la voiture : k = ce qu'ils valent (le sponsor titre vaut le plus)
  const EMPLACEMENTS = {
    titre:{ nom:'Sponsor titre', ico:'👑', k:2.2 }, pontons:{ nom:'Pontons', ico:'🟥', k:1.1 }, arriere:{ nom:'Aileron arrière', ico:'🟦', k:.9 },
    nez:{ nom:'Nez', ico:'🔺', k:.65 }, avant:{ nom:'Aileron avant', ico:'🔻', k:.5 }, halo:{ nom:'Halo', ico:'⭕', k:.35 }, tenues:{ nom:'Casques et combinaisons', ico:'🧥', k:.3 },
  };
  // la clause si l'objectif de la saison est manqué : k = ce que le sponsor accepte de payer en plus
  const PENALITES = { aucune:{ nom:'Aucune', txt:'pas de pénalité', k:-.08 }, baisse:{ nom:'Baisse', txt:'25 % de moins la saison suivante', k:.05 }, rupture:{ nom:'Rupture', txt:'le sponsor peut partir', k:.12 } };
  const OBJECTIFS = [
    { id:'finir', txt:'les deux voitures à l\'arrivée', bonus:.4 },
    { id:'points', txt:'une voiture dans les points (top 10)', bonus:.6 },
    { id:'deuxpoints', txt:'les deux voitures dans les points', bonus:1 },
    { id:'top5', txt:'une voiture dans les 5 premiers', bonus:1.2 },
    { id:'podium', txt:'un podium', bonus:2.2 },
    { id:'devant', txt:'battre l\'écurie rivale', bonus:.7 },
  ];
  const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const PRIMES = [60, 52, 45, 40, 35, 30, 26, 22, 19, 16, 14];          // M€ en fin de saison selon la place des constructeurs

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
    pontons:{ nom:'Pontons et refroidissement', ico:'🌬️', dom:{ aero:.15, moteur:.15 }, inst:'soufflerie', base:1.5 },
  };
  // le curseur de compromis de chaque pièce : à gauche, ce qui aide sur les circuits lents et sinueux ; à droite, sur les circuits rapides
  const COMPROMIS = {
    avant:['Appui', 'Faible traînée'], arriere:['Appui', 'Faible traînée'], fond:['Appui à basse vitesse', 'Appui à haute vitesse'],
    suspension:['Virages lents, vibreurs', 'Virages rapides'], moteur:['Couple, relances', 'Puissance en pointe'], pontons:['Refroidissement (fiable)', 'Pontons fins (aéro)'],
  };
  // la soufflerie et la simulation (CFD) servent aux pièces aérodynamiques ; le règlement en donne plus aux derniers du championnat
  const AERO = ['avant', 'arriere', 'fond', 'pontons', 'suspension'];
  const SPECS = { poly:{ nom:'Polyvalente', aide:'Le même effet sur tous les circuits.' }, appui:{ nom:'Gros appui', aide:'Pour les circuits lents (Monaco, Hongrie, Singapour…) : bien plus efficace là, moins ailleurs.' },
    vitesse:{ nom:'Faible traînée', aide:'Pour les circuits rapides (Monza, Spa, Las Vegas, Bakou…) : bien plus efficace là, moins ailleurs.' } };
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
  const genDe = (C, type, n) => C.pieces[type].gens.find(g => g.n === n) || { gain:0 };
  // l'efficacité d'une version de pièce sur un circuit : son compromis (o, de -1 lent à +1 rapide) et sa spécialité
  function facteurCircuit(g, puissance){
    if(puissance == null || !g.n) return 1;
    const x = clamp((puissance - .45) / .2, -1, 1);                 // -1 circuit lent, +1 circuit rapide
    let f = 1 + .3 * (g.o || 0) * x;
    if(g.spec === 'appui') f *= x < -.3 ? 1.5 : x > .3 ? .6 : .9;
    if(g.spec === 'vitesse') f *= x > .3 ? 1.5 : x < -.3 ? .6 : .9;
    return f;
  }
  const gainGen = (C, type, n, puissance) => { const g = genDe(C, type, n); return g.gain * facteurCircuit(g, puissance); };
  // la voiture d'un pilote (place 0 ou 1) : la base de l'écurie plus les pièces montées
  // circ : le circuit (pour l'effet des compromis et des spécialités) ; sans circuit, l'effet moyen
  function voitureDe(C, place, circ = null){
    const E = ecurieJoueur(C), V = { moteur:E.moteur, aero:E.aero, chassis:E.chassis, fiabilite:E.fiabilite };
    const m = C.montage[place] || {}, pu = circ ? caractere(circ).puissance : null;
    for(const [type, P] of Object.entries(PIECES)){
      const g = genDe(C, type, m[type] || 0);
      for(const [dom, w] of Object.entries(P.dom)) V[dom] = arrondi(V[dom] + gainGen(C, type, m[type] || 0, pu) * w, 1);
      if(g.fiab) V.fiabilite = arrondi(V.fiabilite + g.fiab, 1);
    }
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
  /* ---------- Les heures de soufflerie et de simulation (ATR) : par moitié de saison, selon la place au championnat ---------- */
  const ATR = { souffl:40, cfd:160 };
  function coeffATR(rang, n = ECURIES.length){ return arrondi(.7 + (rang - 1) / Math.max(1, n - 1) * .45, 3); }   // 1er : 70 %, dernier : 115 %
  function nouvelleATR(C){
    const cons = classementConstructeurs(C), joue = cons.some(e => e.points > 0);
    const rang = joue ? cons.findIndex(e => e.id === C.joueur) + 1 : (C.historique && C.historique.length ? C.historique[C.historique.length - 1].place : rangVoiture(C, { wM:.33, wA:.37, wC:.3 }));
    const k = coeffATR(rang);
    C.atr = { periode:C.gp < Math.ceil(((C.calendrier || []).length || 24) / 2) ? 1 : 2, rang, k, souffl:Math.round(ATR.souffl * k), cfd:Math.round(ATR.cfd * k), restS:Math.round(ATR.souffl * k), restC:Math.round(ATR.cfd * k), saison:C.saison };
  }
  // l'effet des heures sur le gain (rendements décroissants)
  const effetHeures = (h, cfd) => .55 + .45 * (1 - Math.exp(-(h / 12 + cfd / 45)));
  // les réglages d'une conception : o (-1..1 compromis), a (0..1 performance plutôt que fiabilité), r (0..1 limite du règlement), spec, h (soufflerie), cfd
  const REGLAGE_DEFAUT = { o:0, a:.5, r:.3, spec:'poly', h:0, cfd:0 };
  function estimerConception(C, type, amb, reg){
    const A = AMBITIONS[amb], P = PIECES[type], t = C.personnel.technique.niv, aero = AERO.includes(type);
    const R = { ...REGLAGE_DEFAUT, ...reg }, heures = aero ? effetHeures(R.h, R.cfd) : .85;
    const domPrincipal = Object.entries(P.dom).sort((a, b) => b[1] - a[1])[0][0];
    const k = (.75 + .12 * t) * multInstallation(C, P.inst) * rendement(ecurieJoueur(C)[domPrincipal]) * (.8 + .4 * R.a) * (1 + .3 * Math.max(0, R.r - .3) / .7) * heures;
    const deception = clamp(A.risque * (1.5 - heures), 0, .5);
    const illegal = R.r > .55 ? Math.min(.75, Math.pow((R.r - .55) / .45, 1.4) * .75) : 0;
    return { min:arrondi(A.gain[0] * k, 2), max:arrondi(A.gain[1] * k, 2), k, deception, illegal, fiab:arrondi((.5 - R.a) * 3, 1), duree:Math.max(1, A.duree - (t >= 4 ? 1 : 0)), cout:coutConception(C, type, amb), reg:R };
  }
  function lancerConception(C, type, amb, reg = {}){
    const pc = C.pieces[type];
    if(pc.conception) return { ok:false, msg:'Une conception est déjà en cours pour cette pièce.' };
    if(type === 'moteur' && !usineMoteur(ecurieJoueur(C))) return { ok:false, msg:`Ton unité de puissance vient de ${MOTORISTES[ecurieJoueur(C).motoriste].nom} : c'est le motoriste qui la fait évoluer.` };
    const est = estimerConception(C, type, amb, reg), cout = est.cout, A = AMBITIONS[amb], R = est.reg;
    if(C.argent < cout) return { ok:false, msg:'Pas assez d\'argent.' };
    if(!plafondOk(C, cout)) return { ok:false, msg:`Le plafond budgétaire (${PLAFOND} M€ par saison) serait dépassé.` };
    if(AERO.includes(type) && (R.h > C.atr.restS || R.cfd > C.atr.restC)) return { ok:false, msg:'Il ne reste pas assez d\'heures de soufflerie ou de simulation pour cette période.' };
    let gain = hasard(est.min, est.max);
    const rate = Math.random() < est.deception;
    if(rate) gain *= .35;
    const illegal = Math.random() < est.illegal;
    if(AERO.includes(type)){ C.atr.restS -= R.h; C.atr.restC -= R.cfd; }
    C.argent = arrondi(C.argent - cout, 2); C.plafondDepenses = arrondi((C.plafondDepenses || 0) + cout, 2);
    pc.conception = { amb, gain:arrondi(gain, 2), rate, fin:C.gp + est.duree, saison:C.saison, cout, o:R.o, a:R.a, r:R.r, spec:R.spec, fiab:est.fiab, illegal };
    C.conceptions = C.conceptions || {}; C.conceptions[type] = (C.conceptions[type] || 0) + 1;
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Conception : ${PIECES[type].nom}`, montant:-cout });
    return { ok:true, msg:`Conception lancée : ${PIECES[type].nom} (${A.nom.toLowerCase()}${R.spec !== 'poly' ? ', ' + SPECS[R.spec].nom.toLowerCase() : ''}), prête dans ${est.duree} Grand${est.duree > 1 ? 's' : ''} Prix.` };
  }
  /* ---------- Le conseil du directeur technique ---------- */
  function conseilIngenieur(C, type, amb = 'normale'){
    const E = ecurieJoueur(C), P = PIECES[type], A = AMBITIONS[amb], t = C.personnel.technique.niv;
    const duree = Math.max(1, A.duree - (t >= 4 ? 1 : 0)), prochains = C.calendrier.slice(C.gp + duree, C.gp + duree + 5).map(g => ({ g, c:circuit(g.id) }));
    const pu = prochains.map(x => caractere(x.c).puissance), moy = pu.length ? pu.reduce((a, b) => a + b, 0) / pu.length : .45;
    const lents = prochains.filter((x, i) => pu[i] < .39), rapides = prochains.filter((x, i) => pu[i] > .51);
    const lignes = [], reg = { ...REGLAGE_DEFAUT };
    reg.o = arrondi(clamp((moy - .45) * 6, -1, 1), 1);
    const nomsC = L => L.slice(0, 3).map(x => x.g.nom).join(', ');
    if(!prochains.length) lignes.push('C\'est la fin de la saison : une pièce polyvalente servira surtout l\'an prochain… elle ne comptera pas, la voiture repart de zéro.');
    else if(reg.o <= -.3) lignes.push(`Les prochains circuits sont plutôt lents et sinueux (${nomsC(lents.length ? lents : prochains)}) : oriente vers « ${COMPROMIS[type][0].toLowerCase()} ».`);
    else if(reg.o >= .3) lignes.push(`Les prochains circuits sont plutôt rapides (${nomsC(rapides.length ? rapides : prochains)}) : oriente vers « ${COMPROMIS[type][1].toLowerCase()} ».`);
    else lignes.push('Les prochains circuits sont variés : reste au milieu, une pièce équilibrée.');
    if(type !== 'moteur' && type !== 'suspension' && type !== 'pontons'){
      if(lents.length >= 3){ reg.spec = 'appui'; lignes.push(`${lents.length} circuits lents arrivent : une version « gros appui » rapporterait gros.`); }
      else if(rapides.length >= 3){ reg.spec = 'vitesse'; lignes.push(`${rapides.length} circuits rapides arrivent : une version « faible traînée » rapporterait gros.`); }
    }
    // le point faible de la voiture, face aux 5 meilleures
    const top = classementConstructeurs(C).filter(e => e.id !== C.joueur).slice(0, 5), V = voitureDe(C, 0);
    const ecarts = ['moteur', 'aero', 'chassis', 'fiabilite'].map(d => [d, top.reduce((s, e) => s + e[d], 0) / top.length - V[d]]).sort((a, b) => b[1] - a[1]);
    const [dF, eF] = ecarts[0];
    if(eF > .5) lignes.push(`Notre point faible : ${DOMAINES[dF].nom.toLowerCase()} (${String(arrondi(eF, 1)).replace('.', ',')} de retard sur le top 5).${P.dom[dF] ? ' Cette pièce tombe bien.' : ''}`);
    const fiabRetard = ecarts.find(x => x[0] === 'fiabilite')[1];
    reg.a = fiabRetard > 2 ? .3 : fiabRetard > 0 ? .45 : .65;
    lignes.push(reg.a < .45 ? 'On casse trop : je pencherais vers la fiabilité.' : reg.a > .55 ? 'La voiture est fiable : on peut pousser la performance.' : 'Garde un bon équilibre entre performance et fiabilité.');
    reg.r = C.confiance < 40 ? .25 : .4;
    lignes.push(`Pour la limite du règlement, je ne dépasserais pas ${Math.round((reg.r + .15) * 100)} % : au-delà de 55 %, la FIA peut trouver la pièce non conforme.`);
    if(AERO.includes(type)){
      const parts = Math.max(1, AERO.filter(k => !C.pieces[k].conception).length - 1);
      reg.h = Math.max(0, Math.min(C.atr.restS, Math.round(C.atr.souffl / Math.min(4, parts + 1)))); reg.cfd = Math.max(0, Math.min(C.atr.restC, Math.round(C.atr.cfd / Math.min(4, parts + 1))));
      lignes.push(`Soufflerie : je mettrais ${reg.h} h sur ${C.atr.restS} h restantes, et ${reg.cfd} unités de simulation sur ${C.atr.restC}.`);
    }
    return { lignes, reg };
  }
  // fabriquer des exemplaires d'une génération (ils arrivent au Grand Prix suivant, ou tout de suite avec un bon atelier)
  function fabriquer(C, type, n, nb = 1){
    if(genDe(C, type, n).interdite) return { ok:false, msg:'Cette version est interdite par la FIA.' };
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
      pc.gens.push({ n, gain:cc.gain, o:cc.o || 0, a:cc.a ?? .5, r:cc.r ?? 0, spec:cc.spec || 'poly', fiab:cc.fiab || 0, illegal:!!cc.illegal }); pc.conception = null;
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
  // une version interdite : enlevée des voitures et de la réserve, remplacée par la meilleure version permise
  function retirerVersion(C, type, n){
    const pc = C.pieces[type]; delete pc.stock[n];
    const permise = () => Object.keys(pc.stock).map(Number).filter(g => pc.stock[g] > 0 && !genDe(C, type, g).interdite).sort((a, b) => b - a)[0];
    for(const i of [0, 1]) if((C.montage[i][type] || 0) === n){ const d = permise(); if(d){ pc.stock[d]--; if(!pc.stock[d]) delete pc.stock[d]; C.montage[i][type] = d; } else C.montage[i][type] = 0; }
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
    const C = { v:3, saison:2026, gp:0, directeur:directeur || 'Directeur', joueur:idEcurie, debut:Date.now(), reglages:R,
      ecuries:{}, pilotes:{}, personnel:{}, candidats:{}, contrats:contratsVides(), offres:[], messages:[],
      finances:[], historique:[], records:{ gp:0, victoires:0, podiums:0, poles:0, points:0, titresP:0, titresC:0, meilleurePlace:11 }, phase:'saison' };
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
    nouvelleATR(C);
    C.objectif = objectifDirection(C);
    genererOffres(C, true);
    message(C, `Bienvenue chez ${E.nom}, ${C.directeur} ! La direction attend une ${C.objectif}e place au championnat des constructeurs. Commence par négocier un sponsor titre (onglet Sponsors), puis lance la conception de nouvelles pièces (onglet Voiture).`);
    return C;
  }
  // ce qui manque à une carrière (nouvelle, ou d'une version précédente du jeu)
  function completer(C){
    C.reglages = { ...reglagesDefaut(), ...(C.reglages || {}) };
    if(C.confiance == null) C.confiance = 60;
    if(!C.installations) C.installations = Object.fromEntries(Object.keys(INSTALLATIONS).map(k => [k, { niv:1, travaux:null }]));
    if(!C.pieces) C.pieces = piecesVides();
    for(const [k, v] of Object.entries(piecesVides())) if(!C.pieces[k]) C.pieces[k] = v;
    if(!C.montage) C.montage = [{}, {}];
    if(C.plafondDepenses == null) C.plafondDepenses = 0;
    delete C.projets; delete C.projetsFaits;
    if(!C.motoristes) C.motoristes = JSON.parse(JSON.stringify(MOTORISTES));
    for(const e of ECURIES) if(C.ecuries[e.id] && !C.ecuries[e.id].motoriste) C.ecuries[e.id].motoriste = e.motoriste;
    if(!C.atr && C.calendrier) nouvelleATR(C);
    // les anciens sponsors (3 places, un an) deviennent des contrats d'un an
    if(!C.contrats){
      C.contrats = contratsVides();
      const anc = Array.isArray(C.sponsors) ? C.sponsors : [];
      ['titre', 'pontons', 'arriere'].forEach((e, i) => { const s = anc[i]; if(!s) return;
        C.contrats[e] = { nom:s.nom, ico:s.ico, secteur:(MARQUES.find(m => m[0] === s.nom) || [0, 0, 'auto'])[2], empl:e, debut:C.saison, fin:C.saison, duree:1, parGP:s.parGP, signature:0,
          objectif:s.objectif, rivale:s.rivale, txtObjectif:s.txtObjectif, prime:s.bonus || 0, exclusif:false, penalite:'aucune', option:false, objSaison:ECURIES.length, satisfaction:60, reneg:null }; });
      delete C.sponsors; C.offres = [];
      if(C.calendrier && C.reputation != null) genererOffres(C, true);
    }
  }
  // les noms des versions précédentes (inventés) : remplacés par les vrais en 2026
  const ANCIENS = { taureau:'Taureau Rouge Racing', cavallino:'Scuderia Cavallino', papaye:'Papaye Racing', fleches:'Flèches d\'Argent', emeraude:'Émeraude Martin', guillaume:'Guillaume Racing',
    veau:'Petits Taureaux', alpes:'Équipe des Alpes', etoile:'Étoile US', trefle:'Trèfle Vert' };
  const ANCIENS_P = { verstapin:'Max Verstapin', tsunodo:'Yuki Tsunodo', leclaire:'Charles Leclaire', hamiltown:'Lewis Hamiltown', norrish:'Lando Norrish', piastrino:'Oscar Piastrino', russelle:'George Russelle',
    antonello:'Kimi Antonello', alonsso:'Fernando Alonsso', strolle:'Lance Strolle', albonne:'Alex Albonne', sainze:'Carlos Sainze', lawsonne:'Liam Lawsonne', hadjard:'Isack Hadjard', gaslight:'Pierre Gaslight',
    doohann:'Jack Doohann', ocone:'Esteban Ocone', bierman:'Oliver Bierman', hulkenbourg:'Nico Hulkenbourg', bortoletto:'Gabriel Bortoletto', bottass:'Valtteri Bottass', peres:'Sergio Perès',
    colapinta:'Franco Colapinta', drugovitch:'Felipe Drugovitch', pourchet:'Théo Pourchet', iwasaki:'Ayumu Iwasaki', lindbloom:'Arvid Lindbloom', vestie:'Frederik Vestie' };
  // une carrière d'avant 2026 : les vrais noms, les motoristes, et la nouvelle écurie Cadillac
  function vers2026(C){
    for(const e of ECURIES){
      const E = C.ecuries[e.id];
      if(!E){ C.ecuries[e.id] = { ...JSON.parse(JSON.stringify(e)), pilotes:[], points:0, victoires:0, budgetDev:0 }; continue; }
      if(e.id !== C.joueur || E.nom === ANCIENS[e.id]){ E.nom = e.nom; E.court = e.court; E.c1 = e.c1; E.c2 = e.c2; E.logo = e.logo; }
      E.motoriste = e.motoriste;
    }
    for(const p of PILOTES){
      const [id, nom, drapeau, age, vitesse, regularite, pneus, depassement, pluie, salaire, potentiel] = p, P = C.pilotes[id];
      if(P){ if(P.nom === ANCIENS_P[id]) P.nom = nom; continue; }
      C.pilotes[id] = { id, nom, drapeau, age, vitesse, regularite, pneus, depassement, pluie, salaire, potentiel, moral:70, ecurie:null, fin:null, points:0, carriere:{ gp:0, victoires:0, podiums:0, points:0, titres:0 } };
    }
    // Cadillac prend deux pilotes libres (Pérez et Bottas s'ils le sont)
    const cad = C.ecuries.cadillac;
    for(const id of ['peres', 'bottass']){ const P = C.pilotes[id]; if(cad.pilotes.length < 2 && P && !P.ecurie && !P.retraite){ P.ecurie = 'cadillac'; P.fin = C.saison + 1; cad.pilotes.push(id); } }
    remplir(C, 'cadillac');
    C.motoristes = JSON.parse(JSON.stringify(MOTORISTES));
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
    if(C.v === 2){ completer(C); vers2026(C); C.v = 3; message(C, '🆕 Nouveau règlement 2026 : 11 écuries (arrivée de Cadillac, Audi), aéro active, mode dépassement, moteurs 50 % électriques. Les vrais noms sont arrivés !'); }
    if(C.v !== 3) return null;
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
    return clamp(rang - (C.reputation > 75 ? 1 : 0), 1, ECURIES.length);
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
  function rangVoiture(C, car, circ = null){
    const moi = [0, 1].map(i => perfVoiture(voitureDe(C, i, circ), car)).reduce((a, b) => a + b) / 2;
    return Object.values(C.ecuries).filter(e => e.id !== C.joueur && perfVoiture(e, car) > moi).length + 1;
  }
  // les autres écuries progressent aussi, selon leur budget (et la difficulté)
  function developpementIA(C){
    const k0 = (DIFF[C.reglages.difficulte] || DIFF.normale).ia * parGP(C);
    for(const e of Object.values(C.ecuries)){
      if(e.id === C.joueur) continue;
      const k = e.budget / 140 * k0;
      for(const dom of ['aero', 'chassis', 'fiabilite']) if(Math.random() < .45) e[dom] = arrondi(Math.min(99, e[dom] + hasard(0, .8) * k * rendement(e[dom])), 1);
    }
    // les motoristes font évoluer leur unité de puissance : toutes leurs écuries en profitent (le joueur aussi)
    for(const [k, Mo] of Object.entries(C.motoristes || {})){
      if(Math.random() > .5) continue;
      const dp = arrondi(hasard(0, .7) * k0 * rendement(Mo.p), 2), df = arrondi(hasard(0, .5) * k0 * rendement(Mo.f), 2);
      Mo.p = arrondi(Math.min(99, Mo.p + dp), 2); Mo.f = arrondi(Math.min(99, Mo.f + df), 2);
      for(const e of Object.values(C.ecuries)) if(e.motoriste === k){ e.moteur = arrondi(Math.min(99, e.moteur + dp), 2); e.fiabilite = arrondi(Math.min(99, e.fiabilite + df * .5), 2); }
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
    const c = circuit(C.calendrier[C.gp].id), r = rangVoiture(C, caractere(c), c);
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

  /* ---------- Les sponsors : contrats, négociation, clauses ---------- */
  const contratsVides = () => Object.fromEntries(Object.keys(EMPLACEMENTS).map(k => [k, null]));
  const contratsActifs = C => Object.values(C.contrats || {}).filter(Boolean);
  const valeurEmpl = (C, empl) => (.2 + C.reputation / 170) * EMPLACEMENTS[empl].k * parGP(C);
  const txtObjectifSponsor = (C, id, rivale) => id === 'devant' ? `finir devant ${C.ecuries[rivale] ? C.ecuries[rivale].nom : 'l\'écurie rivale'}` : (OBJECTIFS.find(o => o.id === id) || OBJECTIFS[0]).txt;
  const primeObjectif = (C, empl, id) => arrondi((OBJECTIFS.find(o => o.id === id) || OBJECTIFS[0]).bonus * EMPLACEMENTS[empl].k * .7 * (.6 + C.reputation / 110) * parGP(C), 2);
  const objectifsPossibles = C => OBJECTIFS.filter(o => C.reputation > 60 || !['podium', 'top5'].includes(o.id) || Math.random() < .3).sort(() => Math.random() - .5).slice(0, 3).map(o => o.id);
  // une offre : ce que le sponsor propose et ce qu'il aime (durée, exclusivité, clause), avec sa patience
  function nouvelleOffre(C, empl, [nom, ico, secteur], plus = {}){
    return { nom, ico, secteur, empl, base:arrondi(valeurEmpl(C, empl) * hasard(.85, 1.2), 2), rivale:rivaleDe(C), objectifs:objectifsPossibles(C),
      pref:{ duree:choisir([1, 2, 2, 3]), exclusif:Math.random() < .45, penalite:choisir(['baisse', 'rupture', 'rupture', 'aucune']) },
      seuil:Math.round(hasard(50, 68)), patience:3, expire:C.gp + 5, objSaison:clamp((C.objectif || 6) + choisir([0, 1, 1, 2]), 1, ECURIES.length), ...plus };
  }
  function genererOffres(C, depart = false){
    if(!C.contrats) return;
    C.offres = (depart ? [] : (C.offres || [])).filter(o => o.expire > C.gp && (o.renouv || o.renego ? C.contrats[o.empl] && C.contrats[o.empl].nom === o.nom : !C.contrats[o.empl]));
    const pris = new Set([...contratsActifs(C).map(c => c.nom), ...C.offres.map(o => o.nom)]);
    const bloques = new Set(contratsActifs(C).filter(c => c.exclusif).map(c => c.secteur));
    const libres = MARQUES.filter(m => !pris.has(m[0]) && !bloques.has(m[2])).sort(() => Math.random() - .5);
    for(const e of Object.keys(EMPLACEMENTS)){
      if(C.contrats[e]) continue;
      const deja = C.offres.filter(o => o.empl === e).length;
      for(let i = deja; i < 2 && libres.length; i++) if(depart || (i === 0 ? Math.random() < .7 : Math.random() < .3)) C.offres.push(nouvelleOffre(C, e, libres.shift()));
    }
  }
  function rivaleDe(C){
    const tri = Object.values(C.ecuries).sort((a, b) => perfVoiture(b) - perfVoiture(a)), i = tri.findIndex(e => e.id === C.joueur);
    return (tri[i - 1] || tri[i + 1]).id;
  }
  // la proposition de départ : ce que le sponsor aime
  const propositionDefaut = (C, o) => ({ duree:o.pref.duree, parGP:o.base, signature:0, objectif:o.objectifs[0], exclusif:o.pref.exclusif, penalite:o.pref.penalite, option:false });
  // ce que le sponsor accepte de payer par Grand Prix avec ces clauses
  const valeurJuste = (o, P) => o.base * (1 + PENALITES[P.penalite].k + (P.exclusif ? (o.pref.exclusif ? .15 : .08) : 0) - (P.option ? .04 : 0));
  // l'intérêt du sponsor pour la proposition, de 0 à 100 ; il signe au-dessus de son seuil (caché, entre 50 et 68)
  function interet(C, o, P){
    const n = C.calendrier.length, r = (P.parGP * n + P.signature / P.duree) / (valeurJuste(o, P) * n);
    let i = 100 - Math.max(0, r - 1) * 260 + Math.max(0, 1 - r) * 60;
    i -= Math.abs(P.duree - o.pref.duree) * 9;
    if(o.pref.exclusif && !P.exclusif) i -= 14;
    if(o.pref.penalite !== 'aucune' && P.penalite === 'aucune') i -= 12;
    if(P.option) i -= 5;
    return clamp(Math.round(i + (o.bonusInteret || 0)), 0, 100);
  }
  function conflitSecteur(C, o, P){
    for(const [e, c] of Object.entries(C.contrats)){
      if(!c || e === o.empl || c.secteur !== o.secteur) continue;
      if(c.exclusif) return `${c.ico} ${c.nom} a l'exclusivité du secteur ${SECTEURS[c.secteur]} : impossible de signer ${o.nom}.`;
      if(P.exclusif) return `Tu as déjà ${c.ico} ${c.nom} dans le secteur ${SECTEURS[c.secteur]} : impossible de promettre l'exclusivité à ${o.nom}.`;
    }
    return null;
  }
  function proposer(C, idx, P){
    const o = C.offres[idx]; if(!o) return { ok:false, msg:'' };
    const conflit = conflitSecteur(C, o, P); if(conflit) return { ok:false, msg:conflit };
    if(!o.renouv && !o.renego && C.contrats[o.empl]) return { ok:false, msg:`L'emplacement ${EMPLACEMENTS[o.empl].nom.toLowerCase()} est déjà pris.` };
    const i = interet(C, o, P);
    if(i >= o.seuil){ const msg = signerContrat(C, o, P); C.offres.splice(idx, 1); return { ok:true, msg }; }
    o.patience--;
    if(o.patience <= 0){
      C.offres.splice(idx, 1);
      if(o.renego && C.contrats[o.empl]) C.contrats[o.empl].satisfaction = clamp(C.contrats[o.empl].satisfaction - 10, 0, 100);
      return { ok:false, fin:true, msg:`${o.ico} ${o.nom} arrête les discussions${o.renego ? ' : le contrat actuel continue, mais le sponsor est déçu' : ''}.` };
    }
    o.contre = contreOffre(C, o, P);
    return { ok:false, msg:`${o.ico} ${o.nom} refuse (${i} % d'intérêt) et fait une contre-proposition. Encore ${o.patience} essai${o.patience > 1 ? 's' : ''}.` };
  }
  // la contre-proposition : le sponsor garde tes clauses et baisse les montants
  function contreOffre(C, o, P){
    const Q = { ...P };
    for(let k = 0; k < 80 && interet(C, o, Q) < o.seuil + 3; k++){
      if(Q.signature > 0) Q.signature = arrondi(Math.max(0, Q.signature - .5), 1);
      else Q.parGP = arrondi(Q.parGP * .97, 2);
    }
    return Q;
  }
  function accepterContre(C, idx){
    const o = C.offres[idx]; if(!o || !o.contre) return { ok:false, msg:'' };
    const conflit = conflitSecteur(C, o, o.contre); if(conflit) return { ok:false, msg:conflit };
    const msg = signerContrat(C, o, o.contre); C.offres.splice(idx, 1); return { ok:true, msg };
  }
  function signerContrat(C, o, P){
    const ancien = C.contrats[o.empl], debut = o.renouv ? C.saison + 1 : C.saison;
    const c = { nom:o.nom, ico:o.ico, secteur:o.secteur, empl:o.empl, debut, fin:debut + P.duree - 1, duree:P.duree, parGP:arrondi(P.parGP, 2), signature:arrondi(P.signature, 1),
      objectif:P.objectif, rivale:o.rivale, txtObjectif:txtObjectifSponsor(C, P.objectif, o.rivale), prime:primeObjectif(C, o.empl, P.objectif),
      exclusif:P.exclusif, penalite:P.penalite, option:P.option, objSaison:o.objSaison, satisfaction:ancien && (o.renouv || o.renego) ? ancien.satisfaction : 60, reneg:ancien ? ancien.reneg : null };
    if(o.renouv && ancien) ancien.suite = c; else C.contrats[o.empl] = c;
    if(c.signature){ C.argent = arrondi(C.argent + c.signature, 2); C.finances.push({ saison:C.saison, gp:C.gp, txt:`${c.ico} Prime de signature ${c.nom}`, montant:c.signature }); }
    const quand = c.duree > 1 ? `de ${c.debut} à ${c.fin}` : `pour la saison ${c.debut}`;
    return `${c.ico} ${c.nom} ${o.renouv ? 'renouvelle' : o.renego ? 'signe un nouveau contrat' : 'signe'} ${quand} (${EMPLACEMENTS[o.empl].nom.toLowerCase()}) : ${String(c.parGP).replace('.', ',')} M€ par Grand Prix${c.signature ? ` et ${String(c.signature).replace('.', ',')} M€ à la signature` : ''}.`;
  }
  // renouveler (dernière saison du contrat) ou renégocier (en cours de contrat, si le sponsor est content)
  function ouvrirNegociation(C, empl){
    const c = C.contrats[empl]; if(!c) return { ok:false, msg:'' };
    const renouv = c.fin === C.saison;
    if(renouv && c.suite) return { ok:false, msg:'Le contrat est déjà renouvelé.' };
    if(!renouv && c.satisfaction < 65) return { ok:false, msg:`${c.nom} n'est pas assez content pour renégocier (satisfaction ${Math.round(c.satisfaction)}, il faut 65).` };
    if(!renouv && c.reneg === C.saison) return { ok:false, msg:'Une seule renégociation par saison.' };
    if(!renouv) c.reneg = C.saison;
    const i = C.offres.findIndex(o => o.nom === c.nom); if(i >= 0) return { ok:true, idx:i };
    const o = nouvelleOffre(C, empl, [c.nom, c.ico, c.secteur], { renouv, renego:!renouv, expire:renouv ? C.calendrier.length + 1 : C.gp + 2,
      bonusInteret:Math.round((c.satisfaction - 50) / 3), objSaison:clamp((C.objectif || 6) + choisir([0, 1]), 1, ECURIES.length) });
    o.base = arrondi(Math.max(o.base, c.parGP * (.9 + c.satisfaction / 400)), 2); o.pref.exclusif = c.exclusif || o.pref.exclusif;
    C.offres.unshift(o);
    return { ok:true, idx:0 };
  }
  function leverOption(C, empl){
    const c = C.contrats[empl]; if(!c || !c.option || c.fin !== C.saison || c.suite) return { ok:false, msg:'' };
    c.fin++; c.option = false;
    return { ok:true, msg:`${c.ico} Option levée : ${c.nom} reste jusqu'en ${c.fin} aux mêmes conditions.` };
  }
  // rompre un contrat : une indemnité de 25 % de l'argent garanti qui reste
  function indemniteSponsor(C, empl){
    const c = C.contrats[empl]; if(!c) return 0;
    const restants = Math.max(0, C.calendrier.length - C.gp) + Math.max(0, c.fin - C.saison) * C.calendrier.length;
    return arrondi(c.parGP * restants * .25, 1);
  }
  function rompreSponsor(C, empl){
    const c = C.contrats[empl]; if(!c) return { ok:false, msg:'' };
    const ind = indemniteSponsor(C, empl);
    C.argent = arrondi(C.argent - ind, 2); C.finances.push({ saison:C.saison, gp:C.gp, txt:`${c.ico} Indemnité de rupture ${c.nom}`, montant:-ind });
    C.contrats[empl] = null; C.reputation = clamp(C.reputation - 2, 10, 100);
    C.offres = C.offres.filter(o => o.nom !== c.nom);
    genererOffres(C);
    return { ok:true, msg:`${c.ico} Contrat rompu avec ${c.nom} : indemnité de ${String(ind).replace('.', ',')} M€.` };
  }
  // en fin de saison : l'objectif de la saison de chaque contrat, avec sa clause
  function bilanSponsors(C, place){
    const lignes = [];
    for(const [e, c] of Object.entries(C.contrats)){
      if(!c) continue;
      if(place <= c.objSaison){
        const p = arrondi(c.parGP * 3, 2); C.argent = arrondi(C.argent + p, 2);
        C.finances.push({ saison:C.saison, gp:C.gp, txt:`${c.ico} Prime de saison ${c.nom}`, montant:p });
        c.satisfaction = clamp(c.satisfaction + 15, 0, 100);
        lignes.push({ ok:true, txt:`${c.ico} ${c.nom} : objectif ${c.objSaison}e atteint, prime de ${String(p).replace('.', ',')} M€` });
        continue;
      }
      c.satisfaction = clamp(c.satisfaction - 15, 0, 100);
      let suite = 'pas de pénalité';
      if(c.fin > C.saison && c.penalite === 'baisse'){ c.parGP = arrondi(c.parGP * .75, 2); suite = `baisse de 25 %, ${String(c.parGP).replace('.', ',')} M€ par GP`; }
      else if(c.fin > C.saison && c.penalite === 'rupture'){
        if(c.satisfaction < 60){ C.contrats[e] = null; suite = 'le sponsor part (clause de rupture)'; message(C, `${c.ico} ${c.nom} quitte l'écurie : l'objectif de la saison est manqué.`, 'mal'); }
        else suite = 'le sponsor reste, mais il est moins content';
      }
      else if(c.fin <= C.saison) suite = 'fin du contrat';
      lignes.push({ ok:false, txt:`${c.ico} ${c.nom} : objectif ${c.objSaison}e manqué, ${suite}` });
    }
    return lignes;
  }
  // au début d'une saison : les contrats finis s'arrêtent, les renouvellements commencent
  function sponsorsNouvelleSaison(C){
    for(const e of Object.keys(EMPLACEMENTS)){
      const c = C.contrats[e]; if(!c || c.fin >= C.saison) continue;
      if(c.suite) C.contrats[e] = c.suite;
      else { C.contrats[e] = null; message(C, `${c.ico} Le contrat avec ${c.nom} (${EMPLACEMENTS[e].nom.toLowerCase()}) est terminé.`); }
    }
    for(const c of contratsActifs(C)) if(c.objectif === 'devant'){ c.rivale = rivaleDe(C); c.txtObjectif = txtObjectifSponsor(C, 'devant', c.rivale); }
    genererOffres(C, true);
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
    const E = ecurieJoueur(C), bilan = { points:0, argent:0, lignes:[], casse:[], fia:[] };
    const gpInfo = C.calendrier[C.gp], k = parGP(C);
    // le contrôle technique de la FIA : une pièce poussée au-delà du règlement peut être déclarée non conforme
    for(const r of res.classement){
      if(r.ecurie !== C.joueur || r.abandon) continue;
      const place = E.pilotes.indexOf(r.pilote); if(place < 0) continue;
      for(const type of Object.keys(PIECES)){
        const n = C.montage[place][type] || 0, g = genDe(C, type, n);
        if(!g.illegal || g.interdite) continue;
        if(Math.random() < (r.place <= 5 ? .3 : .15)){
          r.dsq = true; r.abandon = true; g.interdite = true;
          const amende = arrondi(.5 + .1 * C.reputation / 10, 1);
          bilan.argent -= amende; bilan.lignes.push([`🚨 Amende FIA (${PIECES[type].nom.toLowerCase()} v${n})`, -amende]);
          bilan.fia.push(`${C.pilotes[r.pilote].nom} est disqualifié : ${PIECES[type].nom.toLowerCase()} v${n} non conforme.`);
          retirerVersion(C, type, n);
          message(C, `🚨 Contrôle FIA : ${PIECES[type].nom} v${n} non conforme ! ${C.pilotes[r.pilote].nom} est disqualifié et la pièce est interdite.`, 'mal');
          break;
        }
      }
    }
    for(const r of res.classement){
      const p = C.pilotes[r.pilote], pts = !r.abandon && !r.dsq && r.place <= 10 ? POINTS[r.place - 1] : 0;
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
    for(const s of contratsActifs(C)){
      bilan.argent += s.parGP; bilan.lignes.push([`${s.ico} ${s.nom}`, s.parGP]);
      if(objectifAtteint(C, s, res)){ bilan.argent += s.prime; bilan.lignes.push([`${s.ico} Prime : ${s.txtObjectif}`, s.prime]); s.satisfaction = clamp(s.satisfaction + 5, 0, 100); }
      else s.satisfaction = clamp(s.satisfaction - 3, 0, 100);
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
    gpInfo.resultat = { classement:res.classement.map(r => ({ pilote:r.pilote, ecurie:r.ecurie, place:r.place, abandon:r.abandon, dsq:!!r.dsq })), pole:res.pole, meilleurTour:res.meilleurTour, objectif:bilan.reussi };
    C.gp++;
    C.weekend = null;
    if(C.gp === Math.ceil(C.calendrier.length / 2) && C.gp < C.calendrier.length){ nouvelleATR(C); message(C, `🌀 Nouvelle période d'essais aérodynamiques : ${C.atr.souffl} h de soufflerie et ${C.atr.cfd} unités de simulation (${Math.round(C.atr.k * 100)} % de la base, ${C.atr.rang}e au championnat).`); }
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
      victoires:ecurieJoueur(C).victoires, classementC:cons.map(e => [e.id, e.points]), classementP:pil.map(p => [p.id, p.points, p.ecurie]), confiance:Math.round(C.confiance), renvoye };
    C.historique.push(resume);
    C.phase = renvoye ? 'renvoi' : 'mercato';
    resume.sponsors = bilanSponsors(C, place);
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
      if(!e.motoriste) e.motoriste = 'ferrari';
      const rang = cons.findIndex(x => x.id === e.id);
      if(e.id !== C.joueur) e.budget = clamp(Math.round(e.budget + (5 - rang) * 2 + hasard(-3, 3)), 60, 145);
      e.prestige = clamp(Math.round(e.prestige + (5 - rang) * 1.5), 20, 100);
      e.points = 0; e.victoires = 0;
    }
    for(const Mo of Object.values(C.motoristes || {})){ Mo.p = arrondi(Mo.p + (88 - Mo.p) * .2, 2); Mo.f = arrondi(Mo.f + (86 - Mo.f) * .2, 2); }
    C.gp = 0; C.phase = 'saison'; C.weekend = null;
    nouveauCalendrier(C); genererCandidats(C); nouvelleATR(C);
    C.objectif = objectifDirection(C);
    sponsorsNouvelleSaison(C);
    message(C, `Saison ${C.saison} : la direction vise une ${C.objectif}e place chez les constructeurs. Nouvelle voiture : pense à concevoir de nouvelles pièces, et à renouveler ou trouver des sponsors !`);
    C.resumeSaison = null;
    return ancienne;
  }

  const NOMS_PILOTES = Object.fromEntries(PILOTES.map(p => [p[0], p[1]]));
  return { MOTORISTES, usineMoteur, COULEURS, LOGOS, personnaliser, NOMS_PILOTES, ECURIES, PETITES, POSTES, DOMAINES, POINTS, PRIMES, nouvelleCarriere, migrer, completer, circuits, circuit, caractere, perfVoiture,
    genererOffres, EMPLACEMENTS, SECTEURS, PENALITES, OBJECTIFS, contratsActifs, txtObjectifSponsor, primeObjectif, propositionDefaut, interet, proposer, accepterContre, ouvrirNegociation, leverOption, indemniteSponsor, rompreSponsor, embaucher, appliquerResultat, classementPilotes, classementConstructeurs, finSaison, marche, demande, engager, prolonger,
    nouvelleSaison, noteGlobale, pilotesDe, ecurieJoueur, message, rivaleDe, objectifAtteint, arrondi,
    REGLAGES_SAISON, reglagesDefaut, nbTours, parGP, choisirCircuits, nouveauCalendrier, PANNES, PLAFOND, depensesPieces,
    INSTALLATIONS, coutInstallation, dureeInstallation, ameliorerInstallation, entretien,
    PIECES, AMBITIONS, COMPROMIS, SPECS, AERO, estimerConception, conseilIngenieur, facteurCircuit, genDe, REGLAGE_DEFAUT, nouvelleATR, coeffATR, voitureDe, coutConception, coutFabrication, lancerConception, fabriquer, monterPiece, gainGen, coutFiabilisation, lancerFiabilisation,
    rangVoiture, OBJ_COURSE, objectifCourse, humeur, demanderRallonge };
})();
