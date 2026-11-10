/* Escale : le monde, sans aucun dessin. Les aéroports (inventés), les compagnies (inventées), les avions, les contrats,
   le planning des portes, les vols (approche, atterrissage, roulage, escale, repoussage, décollage), les opérations au sol
   (avec les véhicules), les passagers dans le terminal (files d'attente, places assises, commerces), la satisfaction,
   l'argent et la progression. Le temps est compté en minutes de jeu depuis le début (A.t) ; une journée = 1440 minutes.
   Le plan de l'aéroport (piste, voies de circulation, postes, trajets) est calculé ici, la scène 3D le dessine. */
window.ESCALE_MONDE = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hasard = (a, b) => a + Math.random() * (b - a);
  const entier = (a, b) => Math.floor(hasard(a, b + 1));
  const choix = t => t[Math.floor(Math.random() * t.length)];
  const JOUR = 1440;
  const hm = m => { m = ((Math.round(m) % JOUR) + JOUR) % JOUR; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

  /* ---------- Les avions ---------- */
  // taille du poste : S petit (avions régionaux), M moyen-courrier, L gros porteur, XL très gros porteur
  const TAILLES = {
    S:{ nom:'Petit', court:'S', largeur:36, prix:60000, atterr:900, inspection:10, degivrage:6, ordre:0 },
    M:{ nom:'Moyen', court:'M', largeur:46, prix:160000, atterr:2200, inspection:14, degivrage:8, ordre:1 },
    L:{ nom:'Gros porteur', court:'L', largeur:70, prix:420000, atterr:5200, inspection:22, degivrage:12, ordre:2 },
    XL:{ nom:'Très gros porteur', court:'XL', largeur:84, prix:850000, atterr:8000, inspection:28, degivrage:15, ordre:3 },
  };
  const tailleOk = (porte, avion) => TAILLES[porte].ordre >= TAILLES[AVIONS[avion].taille].ordre;
  // longueur, envergure en mètres (pour la 3D) ; rotation : temps d'escale minimal (minutes) ; niv : niveau du joueur pour le débloquer
  const AVIONS = {
    atr72:{ nom:'ATR 72-600', taille:'S', pax:70, longueur:27, envergure:27, moteurs:'helices', aile:'haute', rayon:'court', rotation:40, niv:1, carbu:1800 },
    q400:{ nom:'Dash 8-400', taille:'S', pax:78, longueur:33, envergure:28, moteurs:'helices', aile:'haute', rayon:'court', rotation:40, niv:2, carbu:2200 },
    e190:{ nom:'Embraer 190', taille:'S', pax:100, longueur:36, envergure:29, moteurs:'reacteurs', aile:'basse', rayon:'court', rotation:45, niv:3, carbu:4000 },
    a220:{ nom:'A220-300', taille:'M', pax:140, longueur:39, envergure:35, moteurs:'reacteurs', aile:'basse', rayon:'court', rotation:50, niv:4, carbu:6000 },
    a320:{ nom:'A320neo', taille:'M', pax:180, longueur:38, envergure:36, moteurs:'reacteurs', aile:'basse', rayon:'moyen', rotation:55, niv:5, carbu:9000 },
    b738:{ nom:'737-800', taille:'M', pax:186, longueur:40, envergure:36, moteurs:'reacteurs', aile:'basse', rayon:'moyen', rotation:55, niv:6, carbu:9500 },
    a321:{ nom:'A321neo', taille:'M', pax:220, longueur:45, envergure:36, moteurs:'reacteurs', aile:'basse', rayon:'moyen', rotation:60, niv:8, carbu:12000 },
    b789:{ nom:'787-9', taille:'L', pax:290, longueur:63, envergure:60, moteurs:'reacteurs', aile:'basse', rayon:'long', rotation:90, niv:10, carbu:42000 },
    a359:{ nom:'A350-900', taille:'L', pax:320, longueur:67, envergure:65, moteurs:'reacteurs', aile:'basse', rayon:'long', rotation:95, niv:12, carbu:48000 },
    b77w:{ nom:'777-300ER', taille:'XL', pax:396, longueur:74, envergure:65, moteurs:'reacteurs', aile:'basse', rayon:'long', rotation:110, niv:14, carbu:60000, gros:true },
    a388:{ nom:'A380', taille:'XL', pax:520, longueur:73, envergure:80, moteurs:'quatre', aile:'basse', rayon:'long', rotation:130, niv:17, carbu:70000, gros:true, deuxPonts:true },
  };
  const RAYONS = { court:{ nom:'Court-courrier', mult:1 }, moyen:{ nom:'Moyen-courrier', mult:1.15 }, long:{ nom:'Long-courrier', mult:1.4 } };

  /* ---------- Les destinations (de vraies villes) ---------- */
  const VILLES = {
    court:[['Paris', 'CDG'], ['Lyon', 'LYS'], ['Londres', 'LHR'], ['Bruxelles', 'BRU'], ['Amsterdam', 'AMS'], ['Genève', 'GVA'], ['Milan', 'MXP'], ['Barcelone', 'BCN'], ['Munich', 'MUC'], ['Zurich', 'ZRH'], ['Francfort', 'FRA'], ['Nantes', 'NTE'], ['Bordeaux', 'BOD'], ['Toulouse', 'TLS'], ['Marseille', 'MRS'], ['Nice', 'NCE'], ['Dublin', 'DUB'], ['Copenhague', 'CPH']],
    moyen:[['Lisbonne', 'LIS'], ['Madrid', 'MAD'], ['Rome', 'FCO'], ['Athènes', 'ATH'], ['Marrakech', 'RAK'], ['Tunis', 'TUN'], ['Alger', 'ALG'], ['Istanbul', 'IST'], ['Stockholm', 'ARN'], ['Oslo', 'OSL'], ['Varsovie', 'WAW'], ['Prague', 'PRG'], ['Vienne', 'VIE'], ['Tenerife', 'TFS'], ['Héraklion', 'HER'], ['Le Caire', 'CAI'], ['Dakar', 'DSS'], ['Reykjavik', 'KEF']],
    long:[['New York', 'JFK'], ['Montréal', 'YUL'], ['Dubaï', 'DXB'], ['Doha', 'DOH'], ['Tokyo', 'HND'], ['Singapour', 'SIN'], ['São Paulo', 'GRU'], ['Los Angeles', 'LAX'], ['Johannesburg', 'JNB'], ['Bangkok', 'BKK'], ['Pointe-à-Pitre', 'PTP'], ['La Réunion', 'RUN'], ['Hong Kong', 'HKG'], ['Mexico', 'MEX'], ['Séoul', 'ICN'], ['Sydney', 'SYD']],
  };

  // les vols vers ces villes restent en France : pas de contrôle des passeports ni de douane
  const NATIONAL = ['Paris', 'Lyon', 'Nantes', 'Bordeaux', 'Toulouse', 'Marseille', 'Nice', 'Pointe-à-Pitre', 'La Réunion'];
  const international = ville => !NATIONAL.includes(ville);

  /* ---------- Les compagnies (inventées) ---------- */
  // c1 : la dérive et la bande ; c2 : la deuxième couleur ; c3 : les moteurs ; avions : ceux qu'elle fait voler
  const COMPAGNIES = {
    alpair:{ nom:'AlpAir', code:'AP', c1:'#D7263D', c2:'#FFFFFF', c3:'#D7263D', ico:'🏔️', avions:['atr72', 'q400', 'e190', 'a220', 'a320'], rayons:['court', 'moyen'] },
    azur:{ nom:'Azur Line', code:'ZL', c1:'#1B98E0', c2:'#F4D35E', c3:'#1B98E0', ico:'🌊', avions:['atr72', 'a220', 'a320', 'a321', 'b789'], rayons:['court', 'moyen', 'long'] },
    boreal:{ nom:'Boréal', code:'BO', c1:'#1B998B', c2:'#2E294E', c3:'#2E294E', ico:'🌲', avions:['q400', 'e190', 'b738', 'a359', 'b77w'], rayons:['court', 'moyen', 'long'] },
    soleo:{ nom:'Soléo', code:'SL', c1:'#F18F01', c2:'#FFD166', c3:'#F18F01', ico:'☀️', avions:['e190', 'a320', 'b738', 'a321'], rayons:['court', 'moyen'] },
    vega:{ nom:'Vega Air', code:'VG', c1:'#6A4C93', c2:'#C9ADE9', c3:'#6A4C93', ico:'✨', avions:['a220', 'a321', 'b789', 'a359', 'a388'], rayons:['moyen', 'long'] },
    orion:{ nom:'Orion Pacific', code:'OP', c1:'#14213D', c2:'#FCA311', c3:'#FCA311', ico:'🌏', avions:['b789', 'a359', 'b77w', 'a388'], rayons:['long'] },
    sirocco:{ nom:'Sirocco', code:'SC', c1:'#C1121F', c2:'#FDF0D5', c3:'#669BBC', ico:'🐪', avions:['atr72', 'b738', 'a321', 'b789'], rayons:['court', 'moyen', 'long'] },
    capella:{ nom:'Capella', code:'CP', c1:'#0B6E4F', c2:'#08A045', c3:'#0B6E4F', ico:'🍀', avions:['q400', 'a220', 'a320', 'b77w'], rayons:['court', 'moyen', 'long'] },
  };
  // les livrées (peintures) : base, puis celles gagnées avec la confiance de la compagnie
  const LIVREES = {
    base:{ nom:'Classique' },
    bande:{ nom:'Grande bande' },
    ventre:{ nom:'Ventre coloré' },
    speciale:{ nom:'Spéciale (tout en couleur)' },
    or:{ nom:'Or (prestige)' },
  };

  /* ---------- Les trois aéroports (inventés) ---------- */
  const AEROPORTS = {
    colblanc:{ nom:'Col-Blanc', ico:'🏔️', decor:'montagne', desc:'Un petit altiport au pied des pistes de ski. Piste courte : avions régionaux et moyen-courriers. La neige oblige souvent à dégivrer les avions.',
      piste:760, tailleMax:'M', portesMax:7, neige:.35, commerce:1, argent:250000, deblocage:null, compagnies:['alpair', 'azur', 'soleo', 'boreal', 'capella', 'sirocco'], heures:[5, 22],
      terminal:{ l:5, h:5, modules:[[0, 0, 'comptoir'], [1, 0, 'comptoir'], [2, 0, 'securite'], [3, 0, 'tapis'], [0, 4, 'salle'], [1, 4, 'salle'], [4, 4, 'toilettes']], petits:[[4, 6, 'plante'], [5, 6, 'poubelle'], [4, 7, 'banc'], [5, 7, 'banc']] },
      portes:[{ taille:'S', passerelle:false }, { taille:'M', passerelle:false }], vehicules:{ carburant:1, repas:1, bagages:1, nettoyage:1, tech:1, bus:1, degivrage:1 } },
    portazur:{ nom:'Port-Azur', ico:'🏖️', decor:'mer', desc:'Un aéroport au bord de la mer, plein de touristes qui dépensent dans les boutiques. Piste plus longue : jusqu\'aux gros porteurs.',
      piste:1050, tailleMax:'L', portesMax:10, neige:0, commerce:1.35, argent:0, deblocage:{ niveau:7, prix:1500000 }, compagnies:['azur', 'soleo', 'sirocco', 'vega', 'boreal', 'capella', 'alpair'], heures:[5, 23],
      terminal:{ l:7, h:5, modules:[[0, 0, 'comptoir'], [1, 0, 'comptoir'], [2, 0, 'comptoir'], [3, 0, 'securite'], [4, 0, 'securite'], [5, 0, 'tapis'], [6, 0, 'tapis'], [6, 1, 'douane'], [3, 1, 'passeports'], [0, 4, 'salle'], [1, 4, 'salle'], [2, 4, 'salle'], [3, 4, 'cafe'], [6, 4, 'toilettes']], petits:[[8, 6, 'plante'], [9, 6, 'poubelle'], [8, 7, 'ecran'], [9, 7, 'banc']] },
      portes:[{ taille:'M', passerelle:true }, { taille:'M', passerelle:false }, { taille:'L', passerelle:false }], vehicules:{ carburant:2, repas:1, bagages:2, nettoyage:1, tech:1, bus:1, degivrage:0 } },
    grandval:{ nom:'Grand-Val', ico:'🏙️', decor:'ville', desc:'La grande métropole : long-courriers, très gros porteurs et voyageurs d\'affaires qui veulent des salons. Le plus gros trafic.',
      piste:1350, tailleMax:'XL', portesMax:14, neige:.08, commerce:1.6, argent:0, deblocage:{ niveau:13, prix:6000000 }, compagnies:['orion', 'vega', 'boreal', 'azur', 'capella', 'sirocco', 'soleo', 'alpair'], heures:[0, 24],
      terminal:{ l:9, h:5, modules:[[0, 0, 'comptoir'], [1, 0, 'comptoir'], [2, 0, 'comptoir'], [3, 0, 'comptoir'], [4, 0, 'securite'], [5, 0, 'securite'], [6, 0, 'securite'], [7, 0, 'tapis'], [8, 0, 'tapis'], [8, 1, 'douane'], [7, 1, 'douane'], [4, 1, 'passeports'], [5, 1, 'passeports'], [0, 4, 'salle'], [1, 4, 'salle'], [2, 4, 'salle'], [3, 4, 'salle'], [4, 4, 'restaurant'], [5, 4, 'boutique'], [8, 4, 'toilettes']] },
      portes:[{ taille:'M', passerelle:true }, { taille:'M', passerelle:true }, { taille:'L', passerelle:true }, { taille:'XL', passerelle:false }], vehicules:{ carburant:2, repas:2, bagages:2, nettoyage:2, tech:2, bus:1, degivrage:1 } },
  };
  const ORDRE_AEROPORTS = ['colblanc', 'portazur', 'grandval'];

  /* ---------- Les véhicules et les modules du terminal ---------- */
  const VEHICULES = {
    carburant:{ nom:'Camion de carburant', ico:'⛽', prix:45000, entretien:350 },
    repas:{ nom:'Camion de repas (catering)', ico:'🍱', prix:35000, entretien:280 },
    bagages:{ nom:'Tracteur à bagages', ico:'🧳', prix:25000, entretien:200 },
    nettoyage:{ nom:'Équipe de nettoyage', ico:'🧽', prix:20000, entretien:250 },
    tech:{ nom:'Technicien (inspection)', ico:'🔧', prix:30000, entretien:300 },
    bus:{ nom:'Bus de piste', ico:'🚌', prix:40000, entretien:300 },
    degivrage:{ nom:'Dégivreuse', ico:'❄️', prix:60000, entretien:400 },
  };
  /* ---------- Les hangars ----------
     Chaque famille de véhicules a son bâtiment. Sans lui, les véhicules dorment dehors : on n'en garde
     que deux et on ne peut pas les améliorer. Avec le hangar, on monte jusqu'à six, on les améliore
     jusqu'au niveau 3, et ils coûtent un cinquième de moins à entretenir (ils s'abîment moins).
     Le dépôt de piste et la station de carburant existent depuis toujours : ils ne s'achètent pas. */
  const HANGARS = {
    sol:{ nom:'Dépôt de piste', ico:'🛻', prix:0, veh:['bagages', 'bus'], desc:'Les tracteurs à bagages et les bus de piste. Il est là depuis l\'ouverture.' },
    carburant:{ nom:'Station de carburant', ico:'⛽', prix:0, veh:['carburant'], desc:'Les camions-avitailleurs, à côté des cuves.' },
    catering:{ nom:'Cuisine et hangar catering', ico:'🍱', prix:120000, veh:['repas'], desc:'Les plateaux-repas sont préparés sur place et chargés dans les camions à l\'abri.' },
    technique:{ nom:'Atelier technique', ico:'🔧', prix:90000, veh:['tech', 'nettoyage'], desc:'Les techniciens d\'inspection et les équipes de nettoyage, avec leur outillage.' },
    hiver:{ nom:'Hangar hiver', ico:'❄️', prix:110000, veh:['degivrage'], desc:'Les dégivreuses et leur réserve de liquide, au chaud entre deux chutes de neige.' },
  };
  const SANS_HANGAR = { max:2, niv:1 };
  const hangarDe = type => Object.keys(HANGARS).find(k => HANGARS[k].veh.includes(type));
  const aHangar = (A, type) => { const k = hangarDe(type); return !k || HANGARS[k].prix === 0 || !!(A.hangars || {})[k]; };
  const maxVehicules = (A, type) => aHangar(A, type) ? 6 : SANS_HANGAR.max;
  const nivMaxVehicule = (A, type) => aHangar(A, type) ? NIV_MAX : SANS_HANGAR.niv;
  function construireHangar(P, A, k){
    const H = HANGARS[k]; if(!H) return 'Hangar inconnu.';
    A.hangars = A.hangars || {};
    if(A.hangars[k]) return 'Ce hangar est déjà construit.';
    if(k === 'hiver' && !AEROPORTS[A.id].neige) return 'Il ne neige jamais ici : ce hangar ne servirait à rien.';
    if(!payer(P, H.prix)) return 'Pas assez d\'argent.';
    A.hangars[k] = true;
    journal(A, `🏗️ ${H.nom} construit : jusqu'à 6 véhicules, améliorables, et un entretien allégé.`, 'bon');
    return null;
  }
  const hangarsOuvrables = A => Object.keys(HANGARS).filter(k => HANGARS[k].prix > 0 && (k !== 'hiver' || AEROPORTS[A.id].neige));

  const NIV_MAX = 3;
  const facteurNiv = n => 1 + .35 * (n - 1);
  const prixAmelioration = (prix, niv) => Math.round(prix * (niv === 1 ? .7 : 1.3));
  // zone : 'ville' (avant la sécurité) ou 'piste' (après) ; cap : capacité (comptoirs, postes, places, clients…) par niveau
  const MODULES = {
    comptoir:{ nom:'Enregistrement', ico:'🛄', prix:20000, coul:'#4F7CAC', cap:2, zone:'ville', desc:'2 comptoirs d\'enregistrement et de dépôt des bagages.' },
    securite:{ nom:'Contrôle de sûreté', ico:'🔍', prix:40000, coul:'#7A5C99', cap:1, zone:'ville', desc:'Un poste de contrôle (portique et tapis à rayons X).' },
    passeports:{ nom:'Contrôle des passeports', ico:'🛂', prix:35000, coul:'#3D5A80', cap:2, zone:'ville', niv:2, depart:true, desc:'Départs : la police aux frontières contrôle les passeports des vols internationaux (2 guichets).' },
    douane:{ nom:'Douane', ico:'🛃', prix:30000, coul:'#2A9D8F', cap:2, zone:'ville', niv:2, arrivee:true, desc:'Arrivées : les passagers des vols internationaux passent la douane avant de sortir.' },
    tapis:{ nom:'Tapis à bagages', ico:'🎒', prix:30000, coul:'#5A8F7B', cap:1, zone:'ville', desc:'Les passagers à l\'arrivée y récupèrent leurs bagages.' },
    salle:{ nom:'Salle d\'attente', ico:'💺', prix:15000, coul:'#8D99AE', cap:50, zone:'piste', desc:'50 sièges pour attendre l\'embarquement.' },
    boutique:{ nom:'Boutique', ico:'🛍️', prix:30000, coul:'#E07A5F', cap:25, zone:'piste', depense:.55, desc:'Les passagers dépensent en attendant : ça rapporte.' },
    cafe:{ nom:'Café', ico:'☕', prix:25000, coul:'#B07D62', cap:20, zone:'piste', depense:.45, desc:'Un café : ça rapporte et les passagers sont contents.' },
    restaurant:{ nom:'Restaurant', ico:'🍝', prix:50000, coul:'#D4A373', cap:30, zone:'piste', depense:.65, niv:4, desc:'Ça rapporte beaucoup et rend les passagers heureux.' },
    toilettes:{ nom:'Toilettes', ico:'🚻', prix:10000, coul:'#9DB4C0', cap:1, zone:'piste', desc:'Indispensables ! Sans toilettes, les passagers sont mécontents.' },
    jeux:{ nom:'Espace enfants', ico:'🧸', prix:20000, coul:'#F2CC8F', cap:1, zone:'piste', niv:3, desc:'Les familles sont plus contentes.' },
    salon:{ nom:'Salon VIP', ico:'🥂', prix:90000, coul:'#2A2D43', cap:20, zone:'piste', depense:.9, niv:9, desc:'Pour les long-courriers : passagers ravis, et ça rapporte.' },
    plantes:{ nom:'Plantes', ico:'🪴', prix:3000, coul:'#81B29A', cap:1, zone:'piste', deco:1, desc:'Décoration : un peu plus de satisfaction.' },
    fontaine:{ nom:'Fontaine', ico:'⛲', prix:12000, coul:'#8ECAE6', cap:1, zone:'piste', deco:2, niv:2, desc:'Décoration : plus de satisfaction.' },
  };

  // les petits objets, posés dans les petites cases (4 par case de la grille) entre les constructions
  const PETITS = {
    plante:{ nom:'Plante en pot', ico:'🪴', prix:800, deco:.25, desc:'Un peu de vert : un peu plus de satisfaction.' },
    banc:{ nom:'Banc', ico:'🪑', prix:1200, places:6, desc:'6 places assises de plus.' },
    poubelle:{ nom:'Poubelle', ico:'🗑️', prix:500, proprete:1, desc:'Un terminal propre rend les passagers plus contents.' },
    ecran:{ nom:'Écran des vols', ico:'📺', prix:2500, deco:.35, desc:'Les passagers voient leur porte et l\'heure : moins de stress.' },
    distributeur:{ nom:'Distributeur', ico:'🥤', prix:3500, commerce:{ cap:4, dep:.25 }, desc:'Boissons et friandises : ça rapporte un peu.' },
    borne:{ nom:'Borne de recharge', ico:'🔌', prix:2000, deco:.3, desc:'Pour recharger son téléphone : les passagers adorent.' },
    eau:{ nom:'Fontaine à eau', ico:'🚰', prix:1500, deco:.2, desc:'De l\'eau fraîche gratuite.' },
  };
  const RANG_T = 12.5;                                                // la profondeur d'une rangée du terminal (m)

  /* ---------- Les opérations au sol pendant l'escale ---------- */
  // veh : le véhicule (null : la passerelle suffit) ; apres : ce qui doit être fini avant ; avant : pas plus tôt que N min avant le départ
  // travail : la quantité à faire ; vitesse : par minute avec un véhicule de niveau 1
  const TACHES = {
    debarquement:{ nom:'Débarquement', ico:'🚶', veh:g => g.passerelle ? null : 'bus', apres:[], travail:v => v.paxArr, vitesse:g => g.passerelle ? 9 : 6, unite:'pax' },
    dechargement:{ nom:'Déchargement des bagages', ico:'🧳', veh:() => 'bagages', apres:[], travail:v => Math.round(v.paxArr * .8), vitesse:() => 8, unite:'bagages' },
    inspection:{ nom:'Inspection', ico:'🔧', veh:() => 'tech', apres:[], travail:v => TAILLES[AVIONS[v.avion].taille].inspection, vitesse:() => 1, unite:'min' },
    nettoyage:{ nom:'Nettoyage', ico:'🧽', veh:() => 'nettoyage', apres:['debarquement'], travail:v => Math.round(AVIONS[v.avion].pax / 12), vitesse:() => 1, unite:'min' },
    carburant:{ nom:'Carburant', ico:'⛽', veh:() => 'carburant', apres:['debarquement'], travail:v => AVIONS[v.avion].carbu, vitesse:() => 1100, unite:'L' },
    repas:{ nom:'Repas', ico:'🍱', veh:() => 'repas', apres:['debarquement'], travail:v => Math.round(AVIONS[v.avion].pax * (AVIONS[v.avion].rayon === 'court' ? .5 : 1)), vitesse:() => 14, unite:'plateaux' },
    chargement:{ nom:'Chargement des bagages', ico:'🧳', veh:() => 'bagages', apres:['dechargement'], avant:40, travail:v => Math.round(v.paxDep * .8), vitesse:() => 8, unite:'bagages' },
    embarquement:{ nom:'Embarquement', ico:'🛫', veh:g => g.passerelle ? null : 'bus', apres:['nettoyage', 'repas', 'inspection'], avant:30, travail:v => v.paxDep, vitesse:g => g.passerelle ? 9 : 6, unite:'pax' },
    degivrage:{ nom:'Dégivrage', ico:'❄️', veh:() => 'degivrage', apres:['embarquement', 'carburant', 'chargement'], travail:v => TAILLES[AVIONS[v.avion].taille].degivrage, vitesse:() => 1, unite:'min', neige:true },
  };
  const ORDRE_TACHES = Object.keys(TACHES);

  /* ---------- La progression ---------- */
  const xpNiveau = n => Math.round(150 * Math.pow(n - 1, 1.6));       // l'expérience totale pour atteindre le niveau n
  function niveauDe(xp){ let n = 1; while(xp >= xpNiveau(n + 1)) n++; return n; }
  const xpConfiance = k => Math.round(25 * Math.pow(k, 1.35));         // la confiance d'une compagnie pour son palier k
  const PALIERS = 10;
  // les récompenses du « passe de confiance » de chaque compagnie
  const RECOMPENSES = [
    { argent:15000 }, { livree:'bande' }, { argent:30000 }, { vehicule:'bagages' }, { bonus:.05 },
    { livree:'ventre' }, { argent:80000 }, { vehicule:'carburant' }, { livree:'speciale', bonus:.05 }, { livree:'or', argent:200000 },
  ];
  const texteRecompense = r => [r.argent ? `${euros(r.argent)}` : '', r.livree ? `livrée « ${LIVREES[r.livree].nom} »` : '', r.vehicule ? `${VEHICULES[r.vehicule].nom.toLowerCase()} offert` : '', r.bonus ? `+${Math.round(r.bonus * 100)} % sur ses vols` : ''].filter(Boolean).join(' + ');
  const euros = n => `${Math.round(n).toLocaleString('fr-FR')} €`;

  // les objectifs (pour démarrer)
  const OBJECTIFS = [
    { id:'contrat', txt:'Accepte un contrat de compagnie (🤝 Compagnies)', gain:5000, ok:(P, A) => A.contrats.length > 0 },
    { id:'programme', txt:'Programme ce vol sur une porte (✈️ Planning)', gain:5000, ok:(P, A) => A.contrats.some(c => c.porte != null) },
    { id:'heure', txt:'Fais partir un vol à l\'heure', gain:10000, ok:P => P.stats.aLHeure > 0 },
    { id:'vehicule', txt:'Achète un véhicule (🚚 Sol)', gain:10000, ok:P => P.stats.achatsVehicules > 0 },
    { id:'cafe', txt:'Construis un café dans le terminal (🏢 Terminal)', gain:10000, ok:(P, A) => A.terminal.modules.some(m => m.type === 'cafe') },
    { id:'cinq', txt:'Programme 5 vols par jour', gain:20000, ok:(P, A) => A.contrats.filter(c => c.porte != null).length >= 5 },
    { id:'niv3', txt:'Atteins le niveau 3', gain:25000, ok:P => niveauDe(P.xp) >= 3 },
    { id:'passerelle', txt:'Installe une passerelle sur une porte', gain:25000, ok:(P, A) => A.portes.some(g => g.passerelle) },
    { id:'satisf', txt:'Finis une journée avec 80 % de satisfaction', gain:40000, ok:P => P.stats.meilleureSatisf >= 80 },
    { id:'palier', txt:'Atteins le palier 3 de confiance avec une compagnie', gain:40000, ok:P => Object.values(P.compagnies).some(c => paliersAtteints(c.xp) >= 3) },
    { id:'portazur', txt:'Débloque Port-Azur (🗺️ Aéroports)', gain:100000, ok:P => !!P.aeroports.portazur },
    { id:'grandval', txt:'Débloque Grand-Val', gain:300000, ok:P => !!P.aeroports.grandval },
  ];
  const paliersAtteints = xp => { let k = 0; while(k < PALIERS && xp >= xpConfiance(k + 1)) k++; return k; };

  /* ---------- Une nouvelle partie ---------- */
  function nouvellePartie(){
    const P = { v:1, xp:0, argent:AEROPORTS.colblanc.argent, actuel:'colblanc', aeroports:{}, compagnies:{}, livrees:{}, objectifs:[], banque:{ prets:[], note:60, rembourses:0, reports:0, interets:0 }, stats:{ vols:0, pax:0, aLHeure:0, retards:0, achatsVehicules:0, meilleureSatisf:0, meilleureJournee:0, jours:0 }, idSuivant:1 };
    for(const k of Object.keys(COMPAGNIES)){ P.compagnies[k] = { xp:0, pris:[] }; P.livrees[k] = { choisie:'base', dispo:['base'] }; }
    P.aeroports.colblanc = nouvelAeroport(P, 'colblanc');
    return P;
  }
  function nouvelAeroport(P, id){
    const D = AEROPORTS[id];
    const A = { id, t:5.5 * 60, portes:D.portes.map((g, i) => ({ ...g, nom:nomPorte(i) })), vehicules:{}, unites:[], terminal:{ l:D.terminal.l, h:D.terminal.h, modules:D.terminal.modules.map(([x, y, type]) => ({ x, y, type, niv:1 })), petits:(D.terminal.petits || []).map(([x, y, type]) => ({ x, y, type })) },
      hangars:{}, personnel:{ entretien:1 }, pistes:1, pistesLibres:[0, 0], contrats:[], offres:[], vols:[], journal:[], qCheck:[], qSecu:[], pisteLibre:0, meteo:'beau', reputation:70, jourStats:nouveauJour(), historique:[], dernierJour:0, toasts:[], carbu:nouvelleCuve(id) };
    for(const [k, n] of Object.entries(D.vehicules)){ A.vehicules[k] = { niv:1 }; for(let i = 0; i < n; i++) A.unites.push(nouvelleUnite(A, k)); }
    meteoDuJour(A); genererOffres(P, A, 4);
    return A;
  }
  const nomPorte = i => (i < 8 ? 'A' : 'B') + String((i % 8) + 1).padStart(2, '0');
  const nouveauJour = () => ({ vols:0, retards:0, minutesRetard:0, revenus:0, commerce:0, services:0, detail:{}, achats:0, litres:0, penalites:0, depenses:0, credit:0, pax:0, satisf:0, nSatisf:0, manques:0 });
  function nouvelleUnite(A, type){ const n = A.unites.filter(u => u.type === type).length; return { id:type + n, type, n, etat:'libre', vol:null, tache:null, t0:0, duree:0 }; }
  const jourDe = t => Math.floor(t / JOUR) + 1;
  const minuteDe = t => ((t % JOUR) + JOUR) % JOUR;

  /* ---------- La cuve à carburant et les services facturés aux compagnies ---------- */
  // la cuve : 5 niveaux (capacité en litres, prix pour y monter) ; le kérosène arrive par camions-citernes de 35 000 L
  const CUVE = { cap:[0, 60000, 150000, 400000, 1000000, 2500000], prix:[0, 0, 80000, 220000, 600000, 1500000] };
  const CUVE_MAX = 5, CAMION = 35000, LIVRAISON = 300, DELAI_CAMION = 60, ECART_CAMIONS = 8, PRIX_MOYEN = .7;
  const CUVE_DEPART = { colblanc:1, portazur:3, grandval:4 };
  // les tarifs des services (fixes) : ce que la compagnie paie à l'aéroport en plus du contrat
  const TARIFS = {
    carburant:{ txt:'0,85 € le litre', f:x => x.total * .85 },
    repas:{ txt:'4 € le plateau', f:x => x.total * 4 },
    nettoyage:{ txt:'100 à 600 € selon l\'avion', f:(x, t) => [100, 200, 400, 600][t] },
    inspection:{ txt:'150 à 650 € selon l\'avion', f:(x, t) => [150, 250, 450, 650][t] },
    dechargement:{ txt:'1 € le bagage', f:x => x.total }, chargement:{ txt:'1 € le bagage', f:x => x.total },
    debarquement:{ txt:'1 € le passager (en bus)', f:x => x.veh ? x.total : 0 }, embarquement:{ txt:'1 € le passager (en bus)', f:x => x.veh ? x.total : 0 },
    degivrage:{ txt:'600 à 3 200 € selon l\'avion', f:(x, t) => [600, 1100, 2200, 3200][t] },
  };
  const facture = (A, v, k, x) => TARIFS[k] ? Math.round(TARIFS[k].f(x, TAILLES[AVIONS[v.avion].taille].ordre)) : 0;
  function nouvelleCuve(id){ const niv = CUVE_DEPART[id] || 1; return { niv, stock:Math.round(CUVE.cap[niv] * .7), prix:PRIX_MOYEN, histo:[PRIX_MOYEN], commandes:[], auto:{ on:false, seuil:.3 } }; }
  // le prix d'achat du kérosène change chaque jour (il revient doucement vers la moyenne)
  function prixDuJour(A){
    const C = A.carbu; let p = C.prix * (1 + (Math.random() + Math.random() + Math.random() - 1.5) * .09) + (PRIX_MOYEN - C.prix) * .18;
    C.prix = Math.round(clamp(p, .48, .98) * 1000) / 1000; C.histo.push(C.prix); if(C.histo.length > 14) C.histo.shift();
  }
  const enRoute = C => C.commandes.reduce((t, c) => t + c.l, 0);
  const capCuve = C => CUVE.cap[C.niv];
  // commander des camions-citernes (au prix du jour) ; on ne dépasse pas la place libre dans la cuve
  function commanderCarbu(P, A, camions, auto){
    const C = A.carbu, place = capCuve(C) - C.stock - enRoute(C);
    camions = Math.min(camions, Math.floor(place / CAMION + 1e-9));
    if(camions <= 0) return 'La cuve n\'a plus assez de place (camions déjà en route compris).';
    const cout = l => Math.round(l * C.prix + (l / CAMION) * LIVRAISON);
    while(camions > 0 && P.argent < cout(camions * CAMION)) camions--;
    if(camions <= 0) return 'Pas assez d\'argent pour un camion-citerne.';
    const c = cout(camions * CAMION); P.argent -= c; A.jourStats.achats += c;
    let t = Math.max(A.t + DELAI_CAMION, ...C.commandes.map(x => x.t + ECART_CAMIONS));
    for(let i = 0; i < camions; i++){ C.commandes.push({ l:CAMION, t, prix:C.prix }); t += ECART_CAMIONS; }
    journal(A, `${auto ? '🤖 Commande automatique' : '🛢️ Commande'} : ${camions} camion${camions > 1 ? 's' : ''}-citerne${camions > 1 ? 's' : ''} (${(camions * CAMION).toLocaleString('fr-FR')} L à ${C.prix.toFixed(2).replace('.', ',')} €/L) : ${euros(c)}.`, '');
    return null;
  }
  // chaque instant : les camions arrivés vident leur citerne ; la commande automatique sous le seuil
  function cuve(P, A){
    const C = A.carbu;
    while(C.commandes.length && C.commandes[0].t <= A.t){ const c = C.commandes.shift(); C.stock = Math.min(capCuve(C), C.stock + c.l); }
    if(C.auto.on && C.stock + enRoute(C) < C.auto.seuil * capCuve(C) && A.t - (C.dernierAuto ?? -99) > 5){
      C.dernierAuto = A.t;
      const n = Math.floor((capCuve(C) - C.stock - enRoute(C)) / CAMION);
      if(n > 0){ const e = commanderCarbu(P, A, n, true); if(e && A.t - (C.alerteAuto ?? -999) > 120){ C.alerteAuto = A.t; journal(A, `🤖 Commande automatique impossible : ${e}`, 'mal'); } }
    }
    if(C.stock < capCuve(C) * .12 && !C.commandes.length && A.t - (C.alerteBas ?? -999) > 180){ C.alerteBas = A.t; journal(A, '⛽ La cuve est presque vide : pense à commander du carburant.', 'mal'); }
  }
  function agrandirCuve(P, A){
    const C = A.carbu; if(C.niv >= CUVE_MAX) return 'La cuve est déjà au maximum.';
    const prix = CUVE.prix[C.niv + 1]; if(!payer(P, prix)) return 'Pas assez d\'argent.';
    C.niv++; journal(A, `🛢️ La cuve passe au niveau ${C.niv} : ${capCuve(C).toLocaleString('fr-FR')} litres.`, 'bon'); return null;
  }

  /* ---------- Le plan de l'aéroport (en mètres) ---------- */
  // x le long de la piste (les avions atterrissent et décollent vers +x), z vers la ville (+z) ; la piste est en z = -PISTE_Z
  // les postes sont devant l'aérogare (z ≈ -40), l'avion nez vers l'aérogare ; une voie de circulation longe les postes (z = VOIE_P)
  const PISTE_Z = -300, TAXI_Z = -236, VOIE_P = -150, FACADE_Z = -26, SERVICE_Z = -126;
  const ECART_PISTES = 120;                                          // la distance entre les deux pistes (m)
  const CACHE_PLAN = new Map();
  function plan(A){
    const D = AEROPORTS[A.id], cle = A.id + ':' + A.terminal.h + ':' + A.portes.map(g => g.taille + (g.passerelle ? 'p' : '')).join(',');
    if(CACHE_PLAN.has(cle)) return CACHE_PLAN.get(cle);
    // les postes, de gauche à droite
    let x = 0; const postes = A.portes.map(g => { const w = TAILLES[g.taille].largeur + 8, cx = x + w / 2; x += w; return { cx, w, taille:g.taille, passerelle:g.passerelle }; });
    const largeur = x, dx = -largeur / 2 + 40;
    // A01 à droite de l'aérogare vue des pistes (les numéros se lisent de gauche à droite depuis la piste)
    postes.forEach(p => { p.cx = largeur - p.cx + dx; p.nezZ = FACADE_Z - 8; });
    const terminal = { x0:dx - 30, x1:dx + largeur + 10, z0:FACADE_Z, z1:FACADE_Z + 20 + A.terminal.h * RANG_T };   // la jetée (15 m), 5 m de marge, puis les rangées
    // la piste principale, et la seconde quand elle est construite (parallèle, plus loin du terminal :
    // ses bretelles traversent la première, comme dans un vrai aéroport à pistes parallèles)
    const piste = { x0:-D.piste / 2, x1:D.piste / 2, z:PISTE_Z, largeur:45 };
    const pistes = [piste, { x0:-D.piste / 2, x1:D.piste / 2, z:PISTE_Z - ECART_PISTES, largeur:45 }];
    // les bretelles entre la piste et la voie parallèle, et entre la voie parallèle et la voie des postes
    const bretelles = []; for(let bx = piste.x0 + 60; bx <= piste.x1 - 40; bx += 170) bretelles.push(Math.round(bx));
    const liens = [terminal.x0 - 70, terminal.x1 + 70];             // de la voie parallèle à la voie des postes
    const depot = { x:terminal.x1 + 120, z:-95 };                   // le dépôt des véhicules de piste
    // les hangars s'alignent derrière le dépôt, le long de la route de service
    const hangars = hangarsOuvrables({ id:A.id }).map((k, i) => ({ k, x:depot.x + 60 + i * 56, z:depot.z + 10 }));
    const P = { postes, terminal, piste, pistes, bretelles, liens, depot, hangars, tour:{ x:terminal.x0 - 90, z:20 }, carburant:{ x:terminal.x1 + 210, z:-30 } };
    // les trajets des avions : un jeu par piste (le même chemin, mais vers l'autre bande)
    const pisteSortie = x => bretelles.find(b => b >= x) ?? bretelles[bretelles.length - 1];
    P.trajets = pistes.map(pi => postes.map((p, i) => {
      const pz = pi.z;
      const lienArr = liens.reduce((m, l) => Math.abs(l - p.cx) < Math.abs(m - p.cx) ? l : m, liens[0]);
      const toucher = pi.x0 + 90, sortie = pisteSortie(pi.x0 + D.piste * .55);
      const enPoste = [p.cx, p.nezZ - AVIONS_LONG_MAX(p.taille) / 2];
      // l'arrivée : du toucher des roues jusqu'au poste (le nez vers l'aérogare)
      const arr = lisser([[toucher, pz], [sortie - 60, pz], [sortie, pz + 20], [sortie, TAXI_Z], [lienArr + (lienArr < sortie ? 30 : -30), TAXI_Z], [lienArr, TAXI_Z + 20], [lienArr, VOIE_P], [p.cx + (p.cx > lienArr ? -40 : 40), VOIE_P], [p.cx, VOIE_P + 25], enPoste], 3);
      // le repoussage : en arrière jusqu'à la voie des postes (le nez tourné vers la piste de départ)
      const pousse = lisser([enPoste, [p.cx, VOIE_P + 15], [p.cx + 25, VOIE_P]], 2);
      // le départ : vers le seuil de piste (on décolle vers +x depuis pi.x0)
      const lienDep = liens[0];
      const dep = lisser([[p.cx + 25, VOIE_P], [lienDep + 30, VOIE_P], [lienDep, VOIE_P - 20], [lienDep, TAXI_Z + 20], [lienDep - 30, TAXI_Z], [pi.x0 + 50, TAXI_Z], [pi.x0 + 20, TAXI_Z - 20], [pi.x0 + 20, pz + 25], [pi.x0 + 45, pz]], 3);
      const A2 = avecLongueurs(arr); A2.roule = sortie - 60 - toucher;      // la partie sur la piste (le freinage)
      return { arr:A2, pousse:avecLongueurs(pousse), dep:avecLongueurs(dep), attente:[lienArr, TAXI_Z], toucher, z:pz };
    }));
    // les trajets des véhicules : du dépôt au poste (par la route de service derrière les avions, z = -60)
    P.service = postes.map(p => avecLongueurs(lisser([[depot.x, depot.z], [depot.x - 25, SERVICE_Z], [p.cx + p.w * .42, SERVICE_Z], [p.cx + p.w * .36, -78]], 2)));
    CACHE_PLAN.set(cle, P);
    return P;
  }
  const AVIONS_LONG_MAX = t => ({ S:36, M:45, L:67, XL:74 })[t];
  // adoucir les virages (coins coupés, plusieurs passes)
  function lisser(pts, passes){
    let p = pts.map(q => q.slice());
    for(let k = 0; k < passes; k++){
      const n = [p[0]];
      for(let i = 0; i < p.length - 1; i++){ const a = p[i], b = p[i + 1]; n.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
      n.push(p[p.length - 1]); p = n;
    }
    return p;
  }
  function avecLongueurs(pts){ const l = [0]; for(let i = 1; i < pts.length; i++) l.push(l[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, l, total:l[l.length - 1] }; }
  // la position (x, z) et le cap à la distance s d'un trajet
  function surTrajet(tr, s){
    const { pts, l } = tr; s = clamp(s, 0, tr.total);
    let i = 1; while(i < l.length - 1 && l[i] < s) i++;
    const a = pts[i - 1], b = pts[i], u = l[i] > l[i - 1] ? (s - l[i - 1]) / (l[i] - l[i - 1]) : 0;
    return { x:a[0] + (b[0] - a[0]) * u, z:a[1] + (b[1] - a[1]) * u, cap:Math.atan2(b[1] - a[1], b[0] - a[0]) };
  }
  const VITESSE_ROULAGE = 130;                                       // mètres par minute de jeu (dessin accéléré)

  /* ---------- Le terminal : les capacités ---------- */
  function capacites(A){
    const c = { passeports:0, douane:0, comptoirs:0, postes:0, tapis:0, places:0, toilettes:0, jeux:0, salon:0, deco:0, proprete:0, commerce:[], restaurant:0, cafe:0 };
    for(const p of A.terminal.petits || []){ const O = PETITS[p.type]; if(O.places) c.places += O.places; if(O.deco) c.deco += O.deco; if(O.proprete) c.proprete += O.proprete; if(O.commerce) c.commerce.push({ ...O.commerce }); }
    for(const m of A.terminal.modules){
      const M = MODULES[m.type], f = facteurNiv(m.niv);
      if(m.type === 'comptoir') c.comptoirs += M.cap * f;
      else if(m.type === 'securite') c.postes += M.cap * f;
      else if(m.type === 'tapis') c.tapis += f;
      else if(m.type === 'passeports') c.passeports += M.cap * f;
      else if(m.type === 'douane') c.douane += M.cap * f;
      else if(m.type === 'salle') c.places += M.cap * f;
      else if(m.type === 'toilettes') c.toilettes += f;
      else if(m.type === 'jeux') c.jeux += f;
      else if(m.type === 'salon'){ c.salon += M.cap * f; c.commerce.push({ cap:M.cap * f, dep:M.depense, salon:true }); }
      if(M.deco) c.deco += M.deco * f;
      if(m.type === 'restaurant') c.restaurant++;
      if(m.type === 'cafe') c.cafe++;
      if(M.depense && m.type !== 'salon') c.commerce.push({ cap:M.cap * f, dep:M.depense });
    }
    return c;
  }

  /* ---------- Les toilettes et le personnel d'entretien ----------
     Un bloc de toilettes se salit avec le passage : plus il y a de monde côté pistes et moins il y a
     de toilettes, plus vite. Au-delà de SALE, les passagers le remarquent et la satisfaction baisse.
     Les agents d'entretien nettoient en continu, celui qui est le plus sale d'abord ; chaque agent est
     payé tous les jours. Un bloc de toilettes amélioré (plus grand) se salit moins vite. */
  const ENTRETIEN = { salaire:140, embauche:3000, vitesse:6, sale:60, usure:1 / 40, max:8 };
  const salete = m => clamp(m.sale || 0, 0, 100);
  // dans combien de minutes ce bloc sera-t-il sale ? (null s'il ne se salit pas, 0 s'il l'est déjà)
  function avantSale(A, m){
    const v = vitesseSalissure(A), r = v - vitesseMenage(A) / Math.max(1, nbToilettes(A));
    if(salete(m) >= ENTRETIEN.sale) return 0;
    if(r <= 0) return null;
    return Math.round((ENTRETIEN.sale - salete(m)) / r);
  }
  const nbToilettes = A => A.terminal.modules.filter(x => x.type === 'toilettes').length;
  // ce que chaque bloc prend par minute, d'après le monde qui attend côté pistes
  function vitesseSalissure(A){
    const n = nbToilettes(A); if(!n) return 0;
    const pax = (A.capAffiche && A.capAffiche.airside) || 0;
    return pax / n * ENTRETIEN.usure;
  }
  const vitesseMenage = A => (A.personnel ? A.personnel.entretien : 0) * ENTRETIEN.vitesse;
  function menage(A, dt){
    const wc = A.terminal.modules.filter(x => x.type === 'toilettes');
    if(!wc.length) return;
    const v = vitesseSalissure(A);
    for(const m of wc) m.sale = clamp(salete(m) + v * dt / facteurNiv(m.niv), 0, 100);
    // les agents s'occupent des plus sales d'abord
    let travail = vitesseMenage(A) * dt;
    const parSale = wc.slice().sort((a, b) => salete(b) - salete(a));
    for(const m of parSale){ if(travail <= 0) break; const n = Math.min(salete(m), travail); m.sale = salete(m) - n; travail -= n; }
    // on prévient quand ça devient désagréable, pas plus d'une fois toutes les trois heures
    const sales = wc.filter(m => salete(m) >= ENTRETIEN.sale).length;
    if(sales && A.t - (A.alerteWC ?? -999) > 180){
      A.alerteWC = A.t;
      journal(A, `🚻 ${sales === wc.length ? 'Les toilettes sont sales' : sales + ' bloc de toilettes sale'} : les passagers s'en plaignent. Embauche du personnel d'entretien (🏢 Terminal).`, 'mal');
    }
  }
  // 0 (immonde) à 1 (impeccable) : la moyenne des blocs de toilettes
  function propreteWC(A){
    const wc = A.terminal.modules.filter(x => x.type === 'toilettes');
    if(!wc.length) return 0;
    return clamp(1 - wc.reduce((s, m) => s + salete(m), 0) / wc.length / 100, 0, 1);
  }
  function embaucher(P, A){
    const Pe = personnel(A);
    if(Pe.entretien >= ENTRETIEN.max) return `Pas plus de ${ENTRETIEN.max} agents d'entretien.`;
    if(!payer(P, ENTRETIEN.embauche)) return 'Pas assez d\'argent.';
    Pe.entretien++; journal(A, `🧹 Un agent d'entretien de plus (${Pe.entretien} en tout) : ${euros(ENTRETIEN.salaire)} de salaire par jour.`, 'bon');
    return null;
  }
  function licencier(A){
    const Pe = personnel(A);
    if(Pe.entretien <= 0) return 'Tu n\'as personne à l\'entretien.';
    Pe.entretien--; journal(A, `🧹 Un agent d'entretien en moins (${Pe.entretien} en tout).`, '');
    return null;
  }
  const personnel = A => (A.personnel = A.personnel || { entretien:0 });

  /* ---------- La météo ---------- */
  function meteoDuJour(A){ const D = AEROPORTS[A.id]; A.meteo = Math.random() < D.neige ? 'neige' : Math.random() < .2 ? 'nuages' : 'beau'; }

  /* ---------- Les offres de contrats ---------- */
  const avionsDisponibles = (P, A) => Object.keys(AVIONS).filter(k => AVIONS[k].niv <= niveauDe(P.xp) && TAILLES[AVIONS[k].taille].ordre <= TAILLES[AEROPORTS[A.id].tailleMax].ordre);
  function genererOffres(P, A, n){
    const D = AEROPORTS[A.id], dispo = avionsDisponibles(P, A), tailles = A.portes.map(g => TAILLES[g.taille].ordre), tMax = Math.max(...tailles);
    for(let k = 0; k < n; k++){
      // 75 % des offres tiennent sur une porte qu'on a déjà
      const possibles = Math.random() < .75 ? dispo.filter(a => TAILLES[AVIONS[a].taille].ordre <= tMax) : dispo;
      const comps = D.compagnies.filter(c => COMPAGNIES[c].avions.some(a => possibles.includes(a)));
      if(!comps.length) return;
      // les compagnies avec qui on a déjà travaillé reviennent plus souvent
      const comp = choixPondere(comps, c => 1 + paliersAtteints(P.compagnies[c].xp) * .5);
      const avion = choix(COMPAGNIES[comp].avions.filter(a => possibles.includes(a)));
      const AV = AVIONS[avion], rayon = AV.rayon, ville = choix(VILLES[rayon]);
      const [h0, h1] = D.heures, rot = AV.rotation + 5 * entier(0, 3);
      const debut = Math.round(hasard(h0 * 60, Math.min(h1 * 60, JOUR) - 90) / 5) * 5, largeurF = 5 * entier(12, 36);
      const remplissage = hasard(.68, .96), paxArr = Math.round(AV.pax * hasard(.6, .95)), paxDep = Math.round(AV.pax * remplissage);
      const bonus = bonusCompagnie(P, comp);
      const revenu = Math.round((TAILLES[AV.taille].atterr + paxDep * 9 + paxArr * 5) * RAYONS[rayon].mult * hasard(.92, 1.2) * (1 + bonus) / 50) * 50;
      const jours = choix([7, 7, 14, 14, 28]);
      A.offres.push({ id:'o' + (P.idSuivant++), comp, avion, ville:ville[0], code:ville[1], rayon, fenetre:[debut, debut + largeurF], rot, paxArr, paxDep, revenu: Math.round(revenu * (jours === 28 ? .95 : 1)), jours,
        penalite:Math.round(revenu * .12 / 10) * 10, xp:Math.round(10 + AV.pax / 15), expire:A.t + 2 * JOUR, num:COMPAGNIES[comp].code + entier(100, 9899) });
    }
  }
  function choixPondere(t, poids){ const p = t.map(poids), s = p.reduce((a, b) => a + b, 0); let r = Math.random() * s; for(let i = 0; i < t.length; i++){ r -= p[i]; if(r <= 0) return t[i]; } return t[t.length - 1]; }
  const bonusCompagnie = (P, comp) => { const c = P.compagnies[comp]; return c.pris.reduce((s, k) => s + (RECOMPENSES[k - 1].bonus || 0), 0); };

  function accepter(P, A, id){
    const o = A.offres.find(x => x.id === id); if(!o) return null;
    A.offres = A.offres.filter(x => x !== o);
    const c = { ...o, id:'c' + (P.idSuivant++), porte:null, arr:null, debut:null, joursRestants:o.jours, dernier:-1 };
    A.contrats.push(c);
    // un renouvellement reprend sa place dans le planning si elle est libre
    if(o.ancien && o.ancien.porte != null && !verifier(A, c, o.ancien.porte, o.ancien.arr)){ placer(A, c.id, o.ancien.porte, o.ancien.arr); return c; }
    journal(A, `🤝 Contrat signé avec ${COMPAGNIES[o.comp].nom} : ${o.num} ${o.ville} en ${AVIONS[o.avion].nom}. Programme-le dans le planning !`, 'bon');
    return c;
  }
  function refuser(A, id){ A.offres = A.offres.filter(x => x.id !== id); }

  /* ---------- Avant de signer : est-ce que ça rentre ? ----------
     On essaie toutes les portes assez grandes, à toutes les heures de la fenêtre demandée, exactement
     comme on le ferait après la signature. Une offre n'est pas encore un contrat : elle ne se gêne
     donc pas elle-même. On rend le nombre de créneaux libres, le premier d'entre eux, et pourquoi
     ça ne rentre pas quand il n'y en a aucun. */
  function creneaux(A, o){
    let n = 0, premier = null, assezGrande = false, occupees = new Set();
    for(let i = 0; i < A.portes.length; i++){
      if(!tailleOk(A.portes[i].taille, o.avion)) continue;
      assezGrande = true;
      for(let arr = o.fenetre[0]; arr <= o.fenetre[1]; arr += 5){
        const err = verifier(A, o, i, arr);
        if(!err){ n++; if(!premier) premier = { porte:i, arr }; }
        else if(/Déjà occupée par (\S+)/.test(err)) occupees.add(err.match(/Déjà occupée par (\S+)/)[1]);
      }
    }
    const raison = assezGrande
      ? (n ? null : `Toutes tes portes assez grandes sont déjà prises à ces heures-là${occupees.size ? ' (' + [...occupees].slice(0, 3).join(', ') + ')' : ''}.`)
      : `Aucune porte ${TAILLES[AVIONS[o.avion].taille].court} ou plus grande : il en faut une pour un ${AVIONS[o.avion].nom}.`;
    return { n, premier, assezGrande, raison };
  }

  /* ---------- Négocier une offre ----------
     Quatre demandes possibles, une seule chose à la fois. La compagnie accepte d'autant plus volontiers
     qu'elle te fait confiance (ses paliers), que tes passagers sont contents et que tu lui demandes peu.
     Chaque nouvelle demande sur la même offre passe moins bien ; à la troisième de trop, elle s'en va. */
  const NEGOS = {
    prix:{ nom:'Être mieux payé', ico:'💶', effort:1, txt:'+8 % sur chaque vol' },
    fenetre:{ nom:'Plus de souplesse', ico:'🕒', effort:.75, txt:'une heure de battement de plus de chaque côté' },
    duree:{ nom:'Un contrat plus long', ico:'📅', effort:.85, txt:'7 jours de plus' },
    penalite:{ nom:'Moins de pénalité', ico:'🛡️', effort:.9, txt:'la pénalité de retard divisée par deux' },
  };
  // la part de chances d'obtenir ce qu'on demande (0 à 1)
  function chanceNego(P, A, o, k){
    const conf = paliersAtteints(P.compagnies[o.comp].xp);
    const base = .3 + conf * .05 + (A.reputation - 60) * .006 + (o.renouvele ? .1 : 0);
    return clamp((base - (o.negos || 0) * .18) / NEGOS[k].effort, .05, .92);
  }
  function negocier(P, A, id, k){
    const o = A.offres.find(x => x.id === id); if(!o) return { err:'Offre introuvable.' };
    if(!NEGOS[k]) return { err:'Demande inconnue.' };
    if(o[`nego_${k}`]) return { err:'Tu lui as déjà demandé ça pour ce vol.' };
    const chance = chanceNego(P, A, o, k);
    o.negos = (o.negos || 0) + 1;
    if(Math.random() > chance){
      // un refus de trop et la compagnie retire son offre
      if(o.negos >= 3){ A.offres = A.offres.filter(x => x !== o); journal(A, `😤 ${COMPAGNIES[o.comp].nom} retire son offre ${o.num} : tu as trop négocié.`, 'mal'); return { parti:true }; }
      journal(A, `🙅 ${COMPAGNIES[o.comp].nom} refuse : ${NEGOS[k].txt}, c'est non pour ${o.num}.`, 'mal');
      return { ok:false };
    }
    o[`nego_${k}`] = true;
    if(k === 'prix') o.revenu = Math.round(o.revenu * 1.08 / 50) * 50;
    if(k === 'fenetre') o.fenetre = [Math.max(0, o.fenetre[0] - 60), Math.min(JOUR - 5, o.fenetre[1] + 60)];
    if(k === 'duree') o.jours += 7;
    if(k === 'penalite') o.penalite = Math.round(o.penalite / 2 / 10) * 10;
    journal(A, `🤝 ${COMPAGNIES[o.comp].nom} accepte pour ${o.num} : ${NEGOS[k].txt}.`, 'bon');
    return { ok:true };
  }

  /* ---------- Le planning des portes ---------- */
  // un vol occupe la porte de son arrivée à son départ (plus 10 minutes de marge), chaque jour ; le planning tourne sur 24 h
  const MARGE = 10;
  const intervalle = c => [c.arr - 5, c.arr + c.rot + MARGE];
  function chevauche(a, b){
    for(const d of [-JOUR, 0, JOUR]) if(a[0] < b[1] + d && b[0] + d < a[1]) return true;
    return false;
  }
  // peut-on mettre ce contrat sur cette porte à cette heure ? (raison si non)
  function verifier(A, c, porte, arr){
    const g = A.portes[porte]; if(!g) return 'Porte inconnue';
    if(!tailleOk(g.taille, c.avion)) return `Porte trop petite pour un ${AVIONS[c.avion].nom}`;
    if(arr < c.fenetre[0] || arr > c.fenetre[1]) return `La compagnie veut arriver entre ${hm(c.fenetre[0])} et ${hm(c.fenetre[1])}`;
    const moi = intervalle({ arr, rot:c.rot });
    const gene = A.contrats.find(x => x !== c && x.porte === porte && x.arr != null && chevauche(moi, intervalle(x)));
    if(gene) return `Déjà occupée par ${gene.num} (${hm(gene.arr)}–${hm(gene.arr + gene.rot)})`;
    return null;
  }
  function placer(A, id, porte, arr){
    const c = A.contrats.find(x => x.id === id); if(!c) return 'Contrat introuvable';
    arr = Math.round(arr / 5) * 5;
    const err = verifier(A, c, porte, arr); if(err) return err;
    // le premier vol : aujourd'hui s'il est encore temps, sinon demain
    const jour = jourDe(A.t), debutVol = (jour - 1) * JOUR + arr;
    c.porte = porte; c.arr = arr; c.debut = debutVol - 200 > A.t ? jour : jour + 1;
    if(c.dernier < 0) c.dernier = c.debut - 1;
    journal(A, `✈️ ${c.num} programmé porte ${A.portes[porte].nom} : arrivée ${hm(arr)}, départ ${hm(arr + c.rot)}${c.debut > jour ? ' (premier vol demain)' : ''}`, 'bon');
    return null;
  }
  // la première place libre (porte et heure) dans la fenêtre de la compagnie
  function placementAuto(A, c){
    const portes = A.portes.map((g, i) => i).filter(i => tailleOk(A.portes[i].taille, c.avion)).sort((a, b) => TAILLES[A.portes[a].taille].ordre - TAILLES[A.portes[b].taille].ordre || (A.portes[b].passerelle ? 1 : 0) - (A.portes[a].passerelle ? 1 : 0));
    for(const i of portes) for(let arr = c.fenetre[0]; arr <= c.fenetre[1]; arr += 5) if(!verifier(A, c, i, arr)) return { porte:i, arr };
    return null;
  }
  // les tranches d'heures libres pour ce contrat sur cette porte, dans sa fenêtre : [[debut, fin], …]
  // (une tranche va de la première à la dernière heure d'arrivée possible, de 5 en 5 minutes)
  function tranchesLibres(A, c, porte){
    const out = []; let debut = null;
    for(let arr = c.fenetre[0]; arr <= c.fenetre[1] + 5; arr += 5){
      const ok = arr <= c.fenetre[1] && !verifier(A, c, porte, arr);
      if(ok && debut == null) debut = arr;
      if(!ok && debut != null){ out.push([debut, arr - 5]); debut = null; }
    }
    return out;
  }
  // déprogrammer (le contrat reste à programmer) ou rompre (pénalité)
  function deprogrammer(A, id){ const c = A.contrats.find(x => x.id === id); if(c && !A.vols.some(v => v.contrat === c.id && v.etat !== 'parti')){ c.porte = null; c.arr = null; return true; } return false; }
  function rompre(P, A, id){
    const c = A.contrats.find(x => x.id === id); if(!c) return;
    if(A.vols.some(v => v.contrat === c.id && v.etat !== 'parti')) return 'Un vol de ce contrat est en cours : attends qu\'il soit parti.';
    const pen = c.revenu * 2; P.argent -= pen; A.jourStats.penalites += pen;
    A.contrats = A.contrats.filter(x => x !== c); P.compagnies[c.comp].xp = Math.max(0, P.compagnies[c.comp].xp - 15);
    journal(A, `💔 Contrat ${c.num} rompu : ${euros(pen)} de pénalité, et ${COMPAGNIES[c.comp].nom} te fait moins confiance.`, 'mal');
    return null;
  }

  /* ---------- Les vols ---------- */
  function journal(A, txt, type = ''){ A.journal.unshift({ t:A.t, txt, type }); A.journal.length = Math.min(A.journal.length, 80); A.toasts.push({ txt, type }); }
  // créer les vols du jour (bien avant l'arrivée : les passagers du départ arrivent ~2 h 30 avant)
  function creerVols(P, A){
    const jour = jourDe(A.t);
    for(const c of A.contrats){
      if(c.porte == null || c.joursRestants <= 0) continue;
      for(const j of [jour, jour + 1]){
        if(j < c.debut || j <= c.dernier) continue;
        const tArr = (j - 1) * JOUR + c.arr, tDep = tArr + c.rot;
        if(A.t < tDep - 175) continue;
        c.dernier = j;
        // le retard à l'arrivée (vent, retard au départ de l'autre aéroport…)
        const r = Math.random(), retardArr = r < .72 ? hasard(-4, 3) : r < .94 ? hasard(5, 20) : hasard(25, 55);
        A.vols.push({ id:'v' + (P.idSuivant++), contrat:c.id, num:c.num, comp:c.comp, avion:c.avion, ville:c.ville, code:c.code, rayon:c.rayon, porte:c.porte, tArr, tDep, tArrReel:tArr + retardArr,
          intl:international(c.ville), paxArr:Math.round(c.paxArr * hasard(.9, 1.05)), paxDep:Math.round(c.paxDep * hasard(.92, 1.05)), revenu:c.revenu, penalite:c.penalite, xp:c.xp,
          etat:'prevu', t0:0, duree:0, taches:null, arrivesTerm:0, airside:0, embarques:0, manques:0, attente:0, inconfort:0, depense:0, retard:0, satisf:null, tDebarq:null, tBagages:null });
      }
    }
  }
  function pas(P, A, dt){
    const avant = A.t; A.t += dt;
    if(jourDe(A.t) > jourDe(avant)) finDeJour(P, A);
    creerVols(P, A);
    for(const v of A.vols) avancerVol(P, A, v, dt);
    A.vols = A.vols.filter(v => !(v.etat === 'parti' && A.t - v.t0 > 3) && !(v.etat === 'fini'));
    passagers(P, A, dt);
    repartir(A);
    for(const u of A.unites) avancerUnite(A, u);
    cuve(P, A); menage(A, dt);
    if(A.offres.length) A.offres = A.offres.filter(o => o.expire > A.t);
  }
  const VOLS_VISIBLES = ['approche', 'atterrissage', 'roulageArr', 'attentePoste', 'escale', 'repousse', 'roulageDep', 'attentePiste', 'decollage', 'parti'];
  function phase(v, etat, t0, duree){ v.etat = etat; v.t0 = t0; v.duree = duree; }
  function avancerVol(P, A, v, dt){
    const t = A.t, Pl = plan(A), tr = trajetDe(Pl, v);
    switch(v.etat){
      case 'prevu':
        // l'approche commence 6 minutes avant l'atterrissage ; on réserve la piste
        if(t >= v.tArrReel - 6){
          const l = pistesLibres(A), k = pisteLaPlusTot(A), tPose = Math.max(v.tArrReel, l[k] + .4);
          l[k] = tPose + 1.3; A.pisteLibre = l[k]; v.piste = k;
          phase(v, 'approche', t, tPose - t);
        }
        break;
      case 'approche': if(t >= v.t0 + v.duree) phase(v, 'atterrissage', t, 1.2); break;
      case 'atterrissage':
        if(t >= v.t0 + v.duree){
          if(posteLibre(A, v)){ A.portes[v.porte].occupe = v.id; phase(v, 'roulageArr', t, (tr.arr.total - tr.arr.roule) / VITESSE_ROULAGE); }
          else { phase(v, 'attentePoste', t, 0); journal(A, `⏳ ${v.num} attend que la porte ${A.portes[v.porte].nom} se libère`, 'mal'); }
        }
        break;
      case 'attentePoste':
        if(posteLibre(A, v)){ A.portes[v.porte].occupe = v.id; phase(v, 'roulageArr', t, (tr.arr.total - tr.arr.roule) / VITESSE_ROULAGE); }
        break;
      case 'roulageArr':
        if(t >= v.t0 + v.duree){ phase(v, 'escale', t, 0); debutEscale(A, v); }
        break;
      case 'escale': escale(P, A, v); break;
      case 'repousse':
        if(t >= v.t0 + v.duree){
          // on choisit la piste du départ dès le repoussage : c'est elle qu'on roule rejoindre
          A.portes[v.porte].occupe = null; v.piste = pisteLaPlusTot(A);
          phase(v, 'roulageDep', t, trajetDe(Pl, v).dep.total / VITESSE_ROULAGE);
        }
        break;
      case 'roulageDep':
        if(t >= v.t0 + v.duree){
          const l = pistesLibres(A), k = pisteLaPlusTot(A), tDec = Math.max(t, l[k]);
          l[k] = tDec + 1.3; A.pisteLibre = l[k]; v.piste = k;
          phase(v, 'attentePiste', t, tDec - t);
        }
        break;
      case 'attentePiste': if(t >= v.t0 + v.duree) phase(v, 'decollage', t, 1.8); break;
      case 'decollage': if(t >= v.t0 + v.duree) phase(v, 'parti', t, 0); break;
    }
  }
  // le trajet de ce vol : celui de la piste qu'il utilise
  const trajetDe = (Pl, v) => Pl.trajets[Math.min(v.piste || 0, Pl.trajets.length - 1)][v.porte];
  const posteLibre = (A, v) => !A.portes[v.porte].occupe || A.portes[v.porte].occupe === v.id || !A.vols.some(x => x.id === A.portes[v.porte].occupe);
  function debutEscale(A, v){
    const g = A.portes[v.porte];
    v.taches = {};
    for(const k of ORDRE_TACHES){
      const T = TACHES[k];
      if(T.neige && A.meteo !== 'neige') continue;
      v.taches[k] = { etat:'attente', fait:0, total:Math.max(1, T.travail(v)), veh:T.veh(g), unite:null };
    }
    v.tEscale = A.t;
  }
  // l'escale : les tâches avancent ; quand tout est fini (et pas avant l'heure), l'avion repousse
  function escale(P, A, v){
    const g = A.portes[v.porte], dt = A.t - (v.dernierPas ?? A.t); v.dernierPas = A.t;
    for(const [k, x] of Object.entries(v.taches)){
      if(x.etat !== 'encours') continue;
      const T = TACHES[k], u = x.unite ? A.unites.find(y => y.id === x.unite) : null, f = u ? facteurNiv(A.vehicules[u.type].niv) : 1;
      let vit = T.vitesse(g) * f;
      if(k === 'embarquement'){
        // on n'embarque que les passagers arrivés à la porte
        const n = Math.min(v.airside, vit * dt); v.airside -= n; v.embarques += n;
        const restants = v.paxDep - v.embarques - v.manques, enRoute = restants - v.airside;
        // 15 minutes après l'heure, on part sans les retardataires
        if(A.t >= v.tDep + 15 && enRoute > .5){ v.manques += enRoute; retirerDesFiles(A, v); journal(A, `😡 ${v.num} part sans ${Math.round(enRoute)} passager${enRoute >= 1.5 ? 's' : ''} bloqué${enRoute >= 1.5 ? 's' : ''} aux contrôles !`, 'mal'); }
        x.fait = v.embarques; x.total = Math.max(1, v.paxDep - v.manques);
        if(v.airside < .01 && v.paxDep - v.embarques - v.manques < .5) finTache(A, v, k, x, P);
      } else if(k === 'carburant'){
        // le carburant vient de la cuve de l'aéroport : si elle est vide, le camion attend
        const C = A.carbu, besoin = Math.min(vit * dt, x.total - x.fait), l = Math.min(besoin, C.stock);
        C.stock -= l; x.fait += l; x.vide = l < besoin - 1e-6;
        if(x.vide && A.t - (C.alerteVide ?? -99) > 30){ C.alerteVide = A.t; journal(A, `⛽ La cuve est vide ! ${v.num} attend son carburant : commande un camion-citerne (🚚 Sol › Carburant).`, 'mal'); }
        if(x.fait >= x.total - 1e-6) finTache(A, v, k, x, P);
      } else {
        x.fait = Math.min(x.total, x.fait + vit * dt);
        if(k === 'debarquement') v.debarquesPax = x.fait;
        if(x.fait >= x.total) finTache(A, v, k, x, P);
      }
    }
    if(Object.values(v.taches).every(x => x.etat === 'fini') && A.t >= v.tDep - .01){
      v.retard = Math.max(0, A.t - v.tDep);
      phase(v, 'repousse', A.t, 2);
      depart(P, A, v);
    }
  }
  function finTache(A, v, k, x, P){
    x.etat = 'fini'; x.fin = A.t; x.fait = x.total;
    // la facture du service à la compagnie (prix fixes)
    const m = facture(A, v, k, x);
    if(m > 0 && P){ P.argent += m; const J = A.jourStats; J.services += m; J.detail[k] = (J.detail[k] || 0) + m; if(k === 'carburant') J.litres += x.total; v.factures = (v.factures || 0) + m; x.facture = m; }
    if(x.unite){ const u = A.unites.find(y => y.id === x.unite); if(u){ u.etat = 'retour'; u.t0 = A.t; u.duree = trajetUnite(A, u, v.porte); } x.unite = null; }
    if(k === 'debarquement') v.tDebarq = A.t;
    if(k === 'dechargement') v.tBagages = A.t + 4;
  }
  // donner les véhicules libres aux tâches prêtes, le départ le plus proche d'abord
  function repartir(A){
    const prets = [];
    for(const v of A.vols){
      if(v.etat !== 'escale') continue;
      for(const [k, x] of Object.entries(v.taches)){
        if(x.etat !== 'attente') continue;
        const T = TACHES[k];
        if(!T.apres.every(p => !v.taches[p] || v.taches[p].etat === 'fini')) continue;
        if(T.avant && A.t < v.tDep - T.avant) continue;
        prets.push({ v, k, x });
      }
    }
    prets.sort((a, b) => a.v.tDep - b.v.tDep);
    for(const { v, k, x } of prets){
      if(!x.veh){ x.etat = 'encours'; x.debut = A.t; continue; }
      const u = A.unites.find(y => y.type === x.veh && y.etat === 'libre');
      if(!u){ x.manque = true; if(x.attDebut == null) x.attDebut = A.t; x.attenteVeh = A.t - x.attDebut; continue; }
      x.manque = false; x.etat = 'route'; x.unite = u.id; x.debut = A.t;
      u.etat = 'aller'; u.vol = v.id; u.tache = k; u.t0 = A.t; u.duree = trajetUnite(A, u, v.porte);
    }
  }
  const trajetUnite = (A, u, porte) => plan(A).service[porte].total / (220 * facteurNiv(A.vehicules[u.type].niv));
  function avancerUnite(A, u){
    if(u.etat === 'aller' && A.t >= u.t0 + u.duree){
      const v = A.vols.find(x => x.id === u.vol), x = v && v.taches && v.taches[u.tache];
      if(!x){ u.etat = 'retour'; u.t0 = A.t; return; }
      u.etat = 'travail'; x.etat = 'encours';
    } else if(u.etat === 'retour' && A.t >= u.t0 + u.duree){ u.etat = 'libre'; u.vol = null; u.tache = null; }
  }

  /* ---------- Les passagers dans le terminal ---------- */
  function passagers(P, A, dt){
    const cap = capacites(A), D = AEROPORTS[A.id];
    // ils arrivent à l'aéroport de 2 h 30 à 50 min avant le départ (un peu plus tard pour les vols courts)
    for(const v of A.vols){
      const debut = v.tDep - (v.rayon === 'long' ? 170 : 140), fin = v.tDep - (v.rayon === 'long' ? 60 : 45);
      if(A.t < debut || v.arrivesTerm >= v.paxDep) continue;
      const cible = v.paxDep * clamp((A.t - debut) / (fin - debut), 0, 1), n = cible - v.arrivesTerm;
      if(n <= 0) continue;
      v.arrivesTerm = cible;
      // 40 % ont déjà leur carte d'embarquement et pas de bagage en soute : directement au contrôle
      ajouterFile(A.qSecu, v.id, n * .4); ajouterFile(A.qCheck, v.id, n * .6);
    }
    const vols = new Map(A.vols.map(v => [v.id, v]));
    A.qPass = A.qPass || [];
    // l'attente dans les files
    for(const q of [A.qCheck, A.qSecu, A.qPass]) for(const e of q){ const v = vols.get(e.v); if(v) v.attente += e.n * dt; }
    // l'enregistrement, puis le contrôle de sûreté
    servir(A.qCheck, cap.comptoirs * .55 * dt, (id, n) => ajouterFile(A.qSecu, id, n));
    // après la sûreté, les vols internationaux passent les passeports (sans guichet, un seul policier très lent)
    servir(A.qSecu, cap.postes * 1.4 * dt, (id, n) => { const v = vols.get(id); if(!v) return; if(v.intl) ajouterFile(A.qPass, id, n); else v.airside += n; });
    servir(A.qPass, (cap.passeports ? cap.passeports * 2 : .5) * dt, (id, n) => { const v = vols.get(id); if(v) v.airside += n; });
    // côté pistes : les places assises, et les commerces
    const airside = A.vols.reduce((s, v) => s + v.airside, 0);
    const debout = Math.max(0, airside - cap.places);
    const capCom = cap.commerce.reduce((s, c) => s + c.cap, 0), clients = Math.min(airside, capCom);
    const depParClient = capCom ? cap.commerce.reduce((s, c) => s + c.cap * c.dep, 0) / capCom : 0;
    const gain = clients * depParClient * dt * D.commerce;
    if(airside > 0) for(const v of A.vols){ if(v.airside <= 0) continue; const part = v.airside / airside; v.inconfort += debout * part * dt; v.depense += gain * part; }
    A.jourStats.commerce += gain; P.argent += gain;
    A.capAffiche = { airside, debout, clients, check:fileTotal(A.qCheck), secu:fileTotal(A.qSecu), pass:fileTotal(A.qPass) };
  }
  function ajouterFile(q, id, n){ if(n <= 0) return; const d = q[q.length - 1]; if(d && d.v === id) d.n += n; else q.push({ v:id, n }); }
  function servir(q, capacite, sortie){
    while(capacite > 1e-9 && q.length){
      const e = q[0], n = Math.min(e.n, capacite); e.n -= n; capacite -= n; sortie(e.v, n);
      if(e.n < 1e-6) q.shift();
    }
  }
  const fileTotal = q => q.reduce((s, e) => s + e.n, 0);
  function retirerDesFiles(A, v){ for(const q of [A.qCheck, A.qSecu, A.qPass || []]) for(let i = q.length - 1; i >= 0; i--) if(q[i].v === v.id) q.splice(i, 1); }

  /* ---------- Le départ : argent, satisfaction, confiance ---------- */
  function depart(P, A, v){
    const cap = capacites(A), J = A.jourStats, AV = AVIONS[v.avion];
    retirerDesFiles(A, v);
    // la satisfaction des passagers du départ
    const n = Math.max(1, v.paxDep), attente = v.attente / n, inconfort = v.inconfort / n / 60;
    let sDep = 86 - Math.max(0, attente - 10) * 1.3 - inconfort * 25;
    // sans toilettes, c'est rédhibitoire ; sales, c'est presque aussi mal vu
    if(!cap.toilettes) sDep -= 12; else sDep -= (1 - propreteWC(A)) * 11;
    if(!cap.cafe && !cap.restaurant) sDep -= 7;
    if(v.rayon === 'long' && !cap.salon) sDep -= 8;
    sDep += Math.min(5, cap.jeux * 2.5) + Math.min(8, cap.deco * 1.2) + 3 * Math.min(1, cap.proprete / Math.max(2, Math.ceil(A.terminal.l * A.terminal.h / 6))) + (cap.restaurant ? 2 : 0) + (cap.salon && v.rayon === 'long' ? 4 : 0);
    sDep -= Math.max(0, v.retard - 5) * .7;
    sDep -= v.manques / n * 70;
    // l'arrivée : l'attente des bagages
    const attB = v.tBagages != null && v.tDebarq != null ? Math.max(0, v.tBagages - v.tDebarq) + (cap.tapis ? 0 : 25) : 10;
    // les vols internationaux passent la douane (sans douane, très longue attente)
    const attD = v.intl ? (cap.douane ? v.paxArr / (cap.douane * 3) : 25) : 0;
    const sArr = 92 - Math.max(0, attB - 8) * 1.5 - Math.max(0, attD - 6) * 1.2;
    v.satisf = Math.round(clamp(sDep * .65 + clamp(sArr, 0, 100) * .35, 0, 100));
    // l'argent : le contrat (redevances), moins les pénalités de retard
    const tranches = v.retard > 5 ? Math.ceil((v.retard - 5) / 15) : 0, pen = tranches * v.penalite;
    P.argent += v.revenu - pen;
    J.revenus += v.revenu; J.penalites += pen; J.vols++; J.pax += Math.round(v.paxDep - v.manques + v.paxArr); J.satisf += v.satisf; J.nSatisf++; J.manques += v.manques;
    if(v.retard > 5){ J.retards++; J.minutesRetard += v.retard; P.stats.retards++; } else P.stats.aLHeure++;
    P.stats.vols++; P.stats.pax += Math.round(v.paxDep - v.manques + v.paxArr);
    A.reputation = A.reputation * .93 + v.satisf * .07;
    // l'expérience et la confiance de la compagnie
    const niv0 = niveauDe(P.xp);
    P.xp += v.xp + (v.retard <= 5 ? 5 : 0);
    const C = P.compagnies[v.comp], k0 = paliersAtteints(C.xp);
    C.xp = Math.max(0, C.xp + v.satisf / 12 + (v.retard <= 5 ? 3 : -Math.min(8, v.retard / 5)));
    const k1 = paliersAtteints(C.xp);
    if(k1 > k0) journal(A, `🎁 ${COMPAGNIES[v.comp].nom} : palier de confiance ${k1} atteint ! Récompense à recevoir (🤝 Compagnies).`, 'cadeau');
    const niv1 = niveauDe(P.xp);
    if(niv1 > niv0){ journal(A, `⭐ Niveau ${niv1} ! ${nouveautesNiveau(niv1)}`, 'cadeau'); }
    if(v.retard > 5) journal(A, `🕒 ${v.num} part avec ${Math.round(v.retard)} min de retard${pen ? ` : ${euros(pen)} de pénalité` : ''}. ${causeRetard(A, v)}`, 'mal');
  }
  function nouveautesNiveau(n){
    const av = Object.values(AVIONS).filter(a => a.niv === n).map(a => a.nom), mo = Object.values(MODULES).filter(m => m.niv === n).map(m => m.nom.toLowerCase());
    const l = [...av.map(a => `nouvel avion : ${a}`), ...mo.map(m => `nouveau : ${m}`)];
    return l.length ? l.join(', ') + '.' : 'De plus gros contrats arrivent.';
  }
  // pourquoi ce retard ? la tâche la plus longue à attendre un véhicule
  function causeRetard(A, v){
    if(v.tArrReel - v.tArr > 10) return 'L\'avion est arrivé en retard.';
    const manque = Object.entries(v.taches || {}).filter(([k, x]) => x.attenteVeh > 3).sort((a, b) => b[1].attenteVeh - a[1].attenteVeh)[0];
    if(manque) return `Il manquait un ${VEHICULES[TACHES[manque[0]].veh(A.portes[v.porte])].nom.toLowerCase()}.`;
    if(v.attente / Math.max(1, v.paxDep) > 20) return 'Trop d\'attente à l\'enregistrement et aux contrôles.';
    return 'L\'escale était trop courte.';
  }

  /* ---------- La fin de la journée ---------- */
  function finDeJour(P, A){
    const J = A.jourStats, D = AEROPORTS[A.id];
    // l'entretien : véhicules, portes, terminal
    let entretien = 0;
    for(const u of A.unites) entretien += VEHICULES[u.type].entretien * (1 + .25 * (A.vehicules[u.type].niv - 1)) * (aHangar(A, u.type) ? .8 : 1);
    for(const g of A.portes) entretien += 250 + TAILLES[g.taille].ordre * 200 + (g.passerelle ? 250 : 0);
    for(const m of A.terminal.modules) entretien += MODULES[m.type].prix * .006 * m.niv;
    entretien += personnel(A).entretien * ENTRETIEN.salaire;
    entretien = Math.round(entretien);
    P.argent -= entretien; J.depenses += entretien;
    echeances(P, A);
    const satisf = J.nSatisf ? Math.round(J.satisf / J.nSatisf) : null;
    const bilan = { jour:jourDe(A.t) - 1, ...J, satisf, net:Math.round(J.revenus + J.commerce + J.services - J.penalites - J.depenses - J.achats) };
    A.historique.unshift(bilan); A.historique.length = Math.min(A.historique.length, 14);
    if(satisf != null && J.nSatisf >= 3) P.stats.meilleureSatisf = Math.max(P.stats.meilleureSatisf, satisf);
    P.stats.meilleureJournee = Math.max(P.stats.meilleureJournee, bilan.net); P.stats.jours++;
    A.bilanJour = bilan;
    journal(A, `🌙 Fin du jour ${bilan.jour} : ${bilan.vols} vol${bilan.vols > 1 ? 's' : ''}, ${bilan.net >= 0 ? '+' : ''}${euros(bilan.net)}${satisf != null ? `, satisfaction ${satisf} %` : ''}${bilan.retards ? `, ${bilan.retards} retard${bilan.retards > 1 ? 's' : ''}` : ''}.`, 'jour');
    A.jourStats = nouveauJour();
    // les contrats : un jour de moins ; ceux qui finissent
    for(const c of A.contrats){
      if(c.porte != null && jourDe(A.t) > c.debut) c.joursRestants--;
      if(c.joursRestants <= 0 && !A.vols.some(v => v.contrat === c.id)){ journal(A, `📄 Fin du contrat ${c.num} (${COMPAGNIES[c.comp].nom}). La compagnie te propose de le renouveler.`, ''); renouvellement(P, A, c); }
    }
    A.contrats = A.contrats.filter(c => c.joursRestants > 0 || A.vols.some(v => v.contrat === c.id));
    meteoDuJour(A); prixDuJour(A);
    if(A.meteo === 'neige') journal(A, '❄️ Il neige aujourd\'hui : les avions doivent être dégivrés avant de partir.', 'mal');
    // de nouvelles offres
    const n = clamp(2 + Math.floor(A.portes.length / 2) + (A.reputation > 80 ? 1 : 0) - Math.floor(A.offres.length / 2), 1, 6);
    genererOffres(P, A, n);
  }
  // le même vol, un peu mieux payé si la compagnie est contente
  function renouvellement(P, A, c){
    const k = paliersAtteints(P.compagnies[c.comp].xp);
    A.offres.unshift({ id:'o' + (P.idSuivant++), comp:c.comp, avion:c.avion, ville:c.ville, code:c.code, rayon:c.rayon, fenetre:c.fenetre, rot:c.rot, paxArr:c.paxArr, paxDep:c.paxDep,
      revenu:Math.round(c.revenu * (1.03 + k * .01) / 50) * 50, jours:c.jours, penalite:c.penalite, xp:c.xp, expire:A.t + 2 * JOUR, num:c.num, renouvele:true, ancien:{ porte:c.porte, arr:c.arr } });
  }

  /* ---------- Les achats ---------- */
  function payer(P, prix){ if(P.argent < prix) return false; P.argent -= prix; return true; }
  /* Les portes tiennent le long de la façade du terminal : pour en ouvrir de nouvelles, il faut
     d'abord l'agrandir. Chaque case de largeur en plus donne deux portes, jusqu'au maximum que
     la place permet ici (D.portesMax). L'agrandissement, lui, coûte de plus en plus cher. */
  const portesMax = A => { const D = AEROPORTS[A.id]; return Math.min(D.portesMax, D.portes.length + 2 * (A.terminal.l - D.terminal.l)); };
  const terminalMax = 14;
  function acheterPorte(P, A, taille){
    const D = AEROPORTS[A.id];
    if(A.portes.length >= portesMax(A)) return A.portes.length >= D.portesMax
      ? 'Plus de place pour une nouvelle porte ici : l\'aéroport est au complet.'
      : `La façade du terminal est pleine : agrandis-le (🏢 Terminal) pour ouvrir deux portes de plus.`;
    if(TAILLES[taille].ordre > TAILLES[D.tailleMax].ordre) return 'La piste est trop courte pour ces avions ici.';
    const prix = TAILLES[taille].prix; if(!payer(P, prix)) return 'Pas assez d\'argent.';
    A.portes.push({ taille, passerelle:false, nom:nomPorte(A.portes.length) }); A.jourStats.depenses += 0;
    journal(A, `🏗️ Nouvelle porte ${A.portes[A.portes.length - 1].nom} (${TAILLES[taille].nom.toLowerCase()})`, 'bon');
    return null;
  }
  const prixPasserelle = taille => TAILLES[taille].ordre >= 2 ? 160000 : 80000;
  function acheterPasserelle(P, A, i){
    const g = A.portes[i]; if(!g || g.passerelle) return 'Déjà une passerelle.';
    if(niveauDe(P.xp) < 2) return 'Disponible au niveau 2.';
    if(!payer(P, prixPasserelle(g.taille))) return 'Pas assez d\'argent.';
    g.passerelle = true; journal(A, `🌉 Passerelle installée porte ${g.nom} : débarquement et embarquement plus rapides, sans bus.`, 'bon');
    return null;
  }
  function agrandirPorte(P, A, i){
    const g = A.portes[i], D = AEROPORTS[A.id], suivante = Object.keys(TAILLES).find(k => TAILLES[k].ordre === TAILLES[g.taille].ordre + 1);
    if(!suivante || TAILLES[suivante].ordre > TAILLES[D.tailleMax].ordre) return 'Cette porte ne peut pas être agrandie ici.';
    if(A.vols.some(v => v.porte === i && VOLS_VISIBLES.includes(v.etat) && v.etat !== 'parti' && v.etat !== 'approche')) return 'Un avion utilise cette porte.';
    const prix = Math.round((TAILLES[suivante].prix - TAILLES[g.taille].prix) * 1.1);
    if(!payer(P, prix)) return 'Pas assez d\'argent.';
    g.taille = suivante; journal(A, `🏗️ Porte ${g.nom} agrandie : ${TAILLES[suivante].nom.toLowerCase()}`, 'bon');
    return null;
  }
  function acheterVehicule(P, A, type, gratuit = false){
    if(type === 'degivrage' && !AEROPORTS[A.id].neige) return 'Pas besoin de dégivreuse ici.';
    const k = hangarDe(type);
    if(!gratuit && A.unites.filter(u => u.type === type).length >= maxVehicules(A, type))
      return aHangar(A, type) ? `Six ${VEHICULES[type].nom.toLowerCase()}s, c'est le maximum.`
        : `Pas de place dehors pour un troisième : construis ${HANGARS[k].nom.toLowerCase()} (🚚 Sol).`;
    if(!gratuit && !payer(P, VEHICULES[type].prix)) return 'Pas assez d\'argent.';
    A.unites.push(nouvelleUnite(A, type)); if(!A.vehicules[type]) A.vehicules[type] = { niv:1 };
    if(!gratuit) P.stats.achatsVehicules++;
    return null;
  }
  function ameliorerVehicule(P, A, type){
    const V = A.vehicules[type]; if(V.niv >= NIV_MAX) return 'Déjà au niveau maximum.';
    if(V.niv >= nivMaxVehicule(A, type)) return `Sans ${HANGARS[hangarDe(type)].nom.toLowerCase()}, on ne peut pas les améliorer (🚚 Sol).`;
    const nb = Math.max(1, A.unites.filter(u => u.type === type).length), prix = prixAmelioration(VEHICULES[type].prix, V.niv) * nb;
    if(!payer(P, prix)) return 'Pas assez d\'argent.';
    V.niv++; return null;
  }
  const prixAmeliorationVehicules = (A, type) => prixAmelioration(VEHICULES[type].prix, A.vehicules[type].niv) * Math.max(1, A.unites.filter(u => u.type === type).length);
  function construire(P, A, x, y, type){
    const M = MODULES[type];
    if(M.niv && niveauDe(P.xp) < M.niv) return `Disponible au niveau ${M.niv}.`;
    if(A.terminal.modules.some(m => m.x === x && m.y === y)) return 'Case occupée.';
    if(x < 0 || y < 0 || x >= A.terminal.l || y >= A.terminal.h) return 'Hors du terminal.';
    if(petitsDansCase(A, x, y).length) return 'Il y a des petits objets sur cette case : enlève-les d\'abord.';
    if(!payer(P, M.prix)) return 'Pas assez d\'argent.';
    A.terminal.modules.push({ x, y, type, niv:1 }); return null;
  }
  function ameliorerModule(P, A, m){
    if(m.niv >= NIV_MAX) return 'Déjà au niveau maximum.';
    if(!payer(P, prixAmelioration(MODULES[m.type].prix, m.niv))) return 'Pas assez d\'argent.';
    m.niv++; return null;
  }
  function vendreModule(P, A, m){ A.terminal.modules = A.terminal.modules.filter(x => x !== m); P.argent += Math.round(MODULES[m.type].prix * .5); }
  function deplacerModule(A, m, x, y){ if(A.terminal.modules.some(o => o !== m && o.x === x && o.y === y) || x < 0 || y < 0 || x >= A.terminal.l || y >= A.terminal.h) return 'Case occupée.'; if(petitsDansCase(A, x, y).length) return 'Il y a des petits objets sur cette case.'; m.x = x; m.y = y; return null; }
  // les petits objets : une petite case = un quart de case (x de 0 à 2l − 1, y de 0 à 2h − 1)
  const petitsDansCase = (A, x, y) => (A.terminal.petits || []).filter(p => Math.floor(p.x / 2) === x && Math.floor(p.y / 2) === y);
  function libreQuart(A, x, y){
    const T = A.terminal;
    if(x < 0 || y < 0 || x >= T.l * 2 || y >= T.h * 2) return 'Hors du terminal.';
    if(T.modules.some(m => m.x === Math.floor(x / 2) && m.y === Math.floor(y / 2))) return 'Une construction occupe cette case.';
    if((T.petits || []).some(p => p.x === x && p.y === y)) return 'Petite case occupée.';
    return null;
  }
  function poserPetit(P, A, x, y, type){
    const e = libreQuart(A, x, y); if(e) return e;
    if(!payer(P, PETITS[type].prix)) return 'Pas assez d\'argent.';
    (A.terminal.petits = A.terminal.petits || []).push({ x, y, type }); return null;
  }
  function retirerPetit(P, A, p){ A.terminal.petits = A.terminal.petits.filter(q => q !== p); P.argent += Math.round(PETITS[p.type].prix * .5); }
  function deplacerPetit(A, p, x, y){ const e = libreQuart(A, x, y); if(e) return e; p.x = x; p.y = y; return null; }
  // chaque case de largeur coûte 35 % de plus que la précédente : on ne s'étend pas indéfiniment
  const prixAgrandir = A => Math.round(40000 * A.terminal.l * (A.terminal.h / 5) * Math.pow(1.35, A.terminal.l - AEROPORTS[A.id].terminal.l) / 1000) * 1000;
  function agrandirTerminal(P, A){
    if(A.terminal.l >= terminalMax) return 'Le terminal est déjà très grand.';
    if(!payer(P, prixAgrandir(A))) return 'Pas assez d\'argent.';
    const avant = portesMax(A); A.terminal.l++;
    const gagnees = portesMax(A) - avant;
    journal(A, `🏢 Terminal agrandi : ${A.terminal.l} cases de large${gagnees > 0 ? `, et ${gagnees} porte${gagnees > 1 ? 's' : ''} d'embarquement de plus à construire (🚚 Sol)` : ''}.`, 'bon');
    return null;
  }

  /* ---------- La seconde piste ----------
     Avec une seule bande, tout le monde fait la queue : un avion la garde 1,3 minute, à l'atterrissage
     comme au décollage, et les autres attendent leur tour en l'air ou au point d'attente. Une seconde
     piste double le passage : chaque mouvement prend la bande qui se libère le plus tôt.
     Elle coûte cher et demande de la place : le prix suit la longueur de piste de l'aéroport. */
  const PISTES_MAX = 2;
  const prixPiste = A => Math.round(AEROPORTS[A.id].piste * 2200 / 50000) * 50000;
  const nbPistes = A => A.pistes || 1;
  function pistesLibres(A){ if(!A.pistesLibres) A.pistesLibres = Array.from({ length:PISTES_MAX }, () => A.pisteLibre || 0); return A.pistesLibres; }
  // la piste qui se libère le plus tôt (parmi celles qui existent)
  function pisteLaPlusTot(A){
    const l = pistesLibres(A); let k = 0;
    for(let i = 1; i < nbPistes(A); i++) if(l[i] < l[k]) k = i;
    return k;
  }
  function acheterPiste(P, A){
    if(nbPistes(A) >= PISTES_MAX) return 'Il n\'y a pas la place pour une troisième piste.';
    if(niveauDe(P.xp) < 8) return 'Disponible au niveau 8.';
    if(!payer(P, prixPiste(A))) return 'Pas assez d\'argent.';
    A.pistes = nbPistes(A) + 1; pistesLibres(A);
    journal(A, `🛬 Seconde piste ouverte : deux avions peuvent décoller ou atterrir en même temps, les attentes en l'air disparaissent.`, 'bon');
    return null;
  }

  /* ---------- Les compagnies : le passe de confiance ---------- */
  function recevoir(P, A, comp, k){
    const C = P.compagnies[comp];
    if(C.pris.includes(k) || paliersAtteints(C.xp) < k) return 'Pas encore atteint.';
    const r = RECOMPENSES[k - 1]; C.pris.push(k);
    if(r.argent) P.argent += r.argent;
    if(r.livree && !P.livrees[comp].dispo.includes(r.livree)){ P.livrees[comp].dispo.push(r.livree); P.livrees[comp].choisie = r.livree; }
    if(r.vehicule) acheterVehicule(P, A, r.vehicule, true);
    return null;
  }
  const aRecevoir = P => Object.entries(P.compagnies).reduce((s, [k, C]) => s + Math.max(0, paliersAtteints(C.xp) - C.pris.length), 0);

  /* ---------- Les aéroports ---------- */
  function debloquer(P, id){
    const D = AEROPORTS[id]; if(P.aeroports[id]) return null;
    if(niveauDe(P.xp) < D.deblocage.niveau) return `Il faut le niveau ${D.deblocage.niveau}.`;
    if(!payer(P, D.deblocage.prix)) return 'Pas assez d\'argent.';
    P.aeroports[id] = nouvelAeroport(P, id); P.actuel = id;
    return null;
  }

  /* ---------- La banque : les prêts ----------
     On emprunte un montant sur 7, 14 ou 30 jours. Les intérêts sont fixés au départ (taux selon la durée, la note de la banque
     et la satisfaction de l'aéroport). Chaque fin de journée, une échéance est prélevée ; si l'argent manque, elle est reportée
     au lendemain avec un petit surcoût (3 %) et la note baisse un peu. */
  const BANQUE = { durees:{ 7:.03, 14:.05, 30:.09 }, maxPrets:3, mini:10000, surcout:.03 };
  function banque(P){ if(!P.banque) P.banque = { prets:[], note:60, rembourses:0, reports:0, interets:0 }; return P.banque; }
  const dette = P => banque(P).prets.reduce((s, p) => s + p.reste, 0);
  const lettreNote = n => n >= 85 ? 'A+' : n >= 70 ? 'A' : n >= 55 ? 'B' : n >= 40 ? 'C' : 'D';
  // la moyenne du bénéfice des derniers jours (7 au plus) de l'aéroport
  const moyenneNet = A => { const h = A.historique.slice(0, 7); return h.length ? h.reduce((s, b) => s + b.net, 0) / h.length : 0; };
  function plafond(P, A){
    const B = banque(P), niv = niveauDe(P.xp);
    const brut = (100000 + niv * 50000 + Math.max(0, moyenneNet(A)) * 10) * (.5 + B.note / 100);
    return Math.max(0, Math.floor((brut - dette(P)) / 1000) * 1000);
  }
  function tauxPret(P, A, duree){
    const B = banque(P);
    return clamp(BANQUE.durees[duree] + (60 - B.note) * .0005 - (A.reputation - 60) * .0003, .01, .2);
  }
  function emprunter(P, A, montant, duree){
    const B = banque(P); montant = Math.round(montant / 1000) * 1000;
    if(!BANQUE.durees[duree]) return 'Durée inconnue.';
    if(B.prets.length >= BANQUE.maxPrets) return `Déjà ${BANQUE.maxPrets} prêts en cours : rembourses-en un d'abord.`;
    if(montant < BANQUE.mini) return `Le plus petit prêt est de ${euros(BANQUE.mini)}.`;
    if(montant > plafond(P, A)) return `La banque ne prête pas plus de ${euros(plafond(P, A))} pour l'instant.`;
    const taux = tauxPret(P, A, duree), interets = Math.round(montant * taux), total = montant + interets;
    B.prets.push({ id:'b' + (P.idSuivant++), montant, duree, taux, interets, total, reste:total, ech:Math.ceil(total / duree), du:0, jours:duree, debut:jourDe(A.t), retards:0 });
    P.argent += montant;
    journal(A, `🏦 Prêt de ${euros(montant)} sur ${duree} jours (intérêts ${euros(interets)}, ${euros(Math.ceil(total / duree))} par jour).`, 'bon');
    return null;
  }
  // rembourser tout de suite : on économise la moitié des intérêts qui restent
  function prixRachat(p){ const frac = p.reste / p.total; return Math.max(0, p.reste - Math.round(p.interets * frac * .5)); }
  function rembourser(P, A, id){
    const B = banque(P), p = B.prets.find(x => x.id === id); if(!p) return 'Prêt introuvable.';
    const prix = prixRachat(p); if(P.argent < prix) return 'Pas assez d\'argent pour tout rembourser.';
    P.argent -= prix; A.jourStats.credit = (A.jourStats.credit || 0) + prix; B.interets += Math.max(0, prix - p.montant * p.reste / p.total);
    B.prets = B.prets.filter(x => x !== p); B.rembourses++; B.note = clamp(B.note + 5, 0, 100);
    journal(A, `🏦 Prêt remboursé en avance (${euros(prix)}). La banque te fait plus confiance.`, 'bon');
    return null;
  }
  // chaque fin de journée : les échéances
  function echeances(P, A){
    const B = banque(P), J = A.jourStats;
    for(const p of B.prets.slice()){
      p.du = Math.min(p.reste, p.du + p.ech);
      if(P.argent >= p.du){
        P.argent -= p.du; p.reste -= p.du; J.credit = (J.credit || 0) + p.du; B.interets += p.du * p.interets / p.total; p.du = 0; p.jours = Math.ceil(p.reste / p.ech);
        if(p.reste <= 0){ B.prets = B.prets.filter(x => x !== p); B.rembourses++; B.note = clamp(B.note + (p.retards ? 2 : 6), 0, 100); journal(A, `🏦 Prêt de ${euros(p.montant)} entièrement remboursé${p.retards ? '' : ', sans aucun report'} : la banque te fait plus confiance.`, 'bon'); }
      } else {
        const s = Math.max(50, Math.round(p.du * BANQUE.surcout)); p.du += s; p.reste += s; p.total += s; p.retards++; B.reports++; B.note = clamp(B.note - 3, 0, 100);
        journal(A, `🏦 Pas assez d'argent pour l'échéance du prêt : elle est reportée à demain (+${euros(s)}).`, 'mal');
      }
    }
  }

  /* ---------- Les objectifs ---------- */
  function verifierObjectifs(P, A){
    const faits = [];
    for(const o of OBJECTIFS){ if(P.objectifs.includes(o.id)) continue; if(o.ok(P, A)){ P.objectifs.push(o.id); P.argent += o.gain; faits.push(o); journal(A, `🎯 Objectif réussi : ${o.txt.replace(/ \(.*\)$/, '')} (+${euros(o.gain)})`, 'cadeau'); } }
    return faits;
  }

  // la migration d'une sauvegarde (rien pour l'instant) et le résumé pour l'accueil et les classements
  function migrer(P){
    if(!P || P.v !== 1) return null;
    // les parties d'avant la cuve à carburant et les factures de services
    for(const A of Object.values(P.aeroports)){ if(!A.carbu) A.carbu = nouvelleCuve(A.id); const J = A.jourStats; if(J.services == null) Object.assign(J, { services:0, detail:{}, achats:0, litres:0 }); }
    // les terminaux d'avant les 5 rangées et les petits objets (les nouvelles rangées s'ajoutent côté pistes)
    for(const A of Object.values(P.aeroports)){ if(A.terminal.h < 5) A.terminal.h = 5; if(!A.terminal.petits) A.terminal.petits = []; }
    // les parties d'avant « les portes se débloquent en agrandissant le terminal » : on élargit
    // le terminal juste assez pour les portes déjà construites, sans rien faire payer
    for(const A of Object.values(P.aeroports)){
      const D = AEROPORTS[A.id], besoin = D.terminal.l + Math.ceil((A.portes.length - D.portes.length) / 2);
      if(A.terminal.l < besoin) A.terminal.l = Math.min(terminalMax, besoin);
    }
    // les parties d'avant les hangars : ceux qui servent déjà sont offerts, personne ne perd un véhicule
    for(const A of Object.values(P.aeroports)){
      A.hangars = A.hangars || {};
      for(const k of Object.keys(HANGARS)) if(HANGARS[k].prix > 0 && HANGARS[k].veh.some(t => A.unites.some(u => u.type === t))) A.hangars[k] = true;
    }
    // les parties d'avant les toilettes qui se salissent : un agent offert pour commencer
    for(const A of Object.values(P.aeroports)){ personnel(A); if(!A.personnel.entretien) A.personnel.entretien = 1; }
    // les parties d'avant la seconde piste
    for(const A of Object.values(P.aeroports)){ if(!A.pistes) A.pistes = 1; pistesLibres(A); }
    // les parties d'avant la banque
    banque(P);
    return P;
  }
  function resume(P){ return { niveau:niveauDe(P.xp), xp:P.xp, vols:P.stats.vols, pax:P.stats.pax, meilleureJournee:P.stats.meilleureJournee, aeroports:Object.keys(P.aeroports).length, jours:P.stats.jours, argent:Math.round(P.argent) }; }

  return { JOUR, TAILLES, AVIONS, RAYONS, VILLES, COMPAGNIES, LIVREES, AEROPORTS, ORDRE_AEROPORTS, VEHICULES, MODULES, TACHES, ORDRE_TACHES, RECOMPENSES, PALIERS, OBJECTIFS, NIV_MAX,
    international, NATIONAL, hm, euros, jourDe, minuteDe, xpNiveau, niveauDe, xpConfiance, paliersAtteints, texteRecompense, tailleOk, facteurNiv, prixAmelioration, prixPasserelle, prixAgrandir, prixAmeliorationVehicules,
    portesMax, terminalMax, PISTES_MAX, prixPiste, nbPistes, acheterPiste, trajetDe, ECART_PISTES, HANGARS, SANS_HANGAR, hangarDe, aHangar, maxVehicules, nivMaxVehicule, construireHangar, hangarsOuvrables, ENTRETIEN, personnel, menage, propreteWC, avantSale, nbToilettes, vitesseSalissure, vitesseMenage, salete, embaucher, licencier, nouvellePartie, plan, surTrajet, capacites, avionsDisponibles, genererOffres, accepter, refuser, verifier, placer, placementAuto, deprogrammer, rompre, pas, VOLS_VISIBLES,
    creneaux, tranchesLibres, NEGOS, chanceNego, negocier,
    acheterPorte, acheterPasserelle, agrandirPorte, acheterVehicule, ameliorerVehicule, construire, ameliorerModule, vendreModule, deplacerModule, agrandirTerminal,
    recevoir, aRecevoir, bonusCompagnie, debloquer, verifierObjectifs, migrer, PETITS, RANG_T, poserPetit, retirerPetit, deplacerPetit, libreQuart, petitsDansCase, CUVE, CUVE_MAX, CAMION, LIVRAISON, DELAI_CAMION, TARIFS, commanderCarbu, agrandirCuve, enRoute, capCuve, facture, resume, BANQUE, banque, dette, lettreNote, moyenneNet, plafond, tauxPret, emprunter, prixRachat, rembourser, echeances, intervalle, chevauche, MARGE, PISTE_Z, TAXI_Z, VOIE_P, FACADE_Z, SERVICE_Z, VITESSE_ROULAGE };
})();
