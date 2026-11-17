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
    degrade:{ nom:'Dégradé (du nez à la queue)' },
    pointes:{ nom:'Pointes colorées' },
  };

  /* ---------- Les trois aéroports (inventés) ---------- */
  const AEROPORTS = {
    colblanc:{ nom:'Col-Blanc', ico:'🏔️', decor:'montagne', desc:'Un petit altiport au pied des pistes de ski. Piste courte : avions régionaux et moyen-courriers. La neige oblige souvent à dégivrer les avions.',
      piste:760, tailleMax:'M', portesMax:7, neige:.35, commerce:1, argent:250000, deblocage:null, compagnies:['alpair', 'azur', 'soleo', 'boreal', 'capella', 'sirocco'], heures:[5, 22],
      terminal:{ l:7, la:2, cr:0, h:4, v:4, cellule:17, modules:[[0, 0, 'comptoir'], [1, 0, 'comptoir'], [2, 0, 'securite'], [0, 3, 'salle'], [1, 3, 'salle'], [4, 3, 'toilettes'], [5, 0, 'tapis']], petits:[[26, 18, 'plante'], [27, 18, 'poubelle'], [26, 19, 'banc'], [27, 19, 'banc'], [7, 26, 'plante']] },
      portes:[{ taille:'S', passerelle:false }, { taille:'M', passerelle:false }], vehicules:{ carburant:1, repas:1, bagages:1, nettoyage:1, tech:1, bus:1, degivrage:1 } },
    portazur:{ nom:'Port-Azur', ico:'🏖️', decor:'mer', desc:'Un aéroport au bord de la mer, plein de touristes qui dépensent dans les boutiques. Piste plus longue : jusqu\'aux gros porteurs.',
      piste:1050, tailleMax:'L', portesMax:10, neige:0, commerce:1.35, argent:0, deblocage:{ niveau:7, prix:1500000 }, compagnies:['azur', 'soleo', 'sirocco', 'vega', 'boreal', 'capella', 'alpair'], heures:[5, 23],
      terminal:{ l:10, la:3, cr:0, h:4, v:4, cellule:21, modules:[[0, 0, 'comptoir'], [1, 0, 'comptoir'], [2, 0, 'comptoir'], [3, 0, 'securite'], [4, 0, 'securite'], [5, 0, 'passeports'], [0, 3, 'salle'], [1, 3, 'salle'], [2, 3, 'salle'], [3, 3, 'cafe'], [6, 3, 'toilettes'], [7, 0, 'tapis'], [8, 0, 'tapis'], [9, 0, 'douane']], petits:[[42, 18, 'plante'], [43, 18, 'poubelle'], [42, 19, 'ecran'], [43, 19, 'banc'], [15, 26, 'plante']] },
      portes:[{ taille:'M', passerelle:true }, { taille:'M', passerelle:false }, { taille:'L', passerelle:false }], vehicules:{ carburant:2, repas:1, bagages:2, nettoyage:1, tech:1, bus:1, degivrage:0 } },
    grandval:{ nom:'Grand-Val', ico:'🏙️', decor:'ville', desc:'La grande métropole : long-courriers, très gros porteurs et voyageurs d\'affaires qui veulent des salons. Le plus gros trafic.',
      piste:1350, tailleMax:'XL', portesMax:14, neige:.08, commerce:1.6, argent:0, deblocage:{ niveau:13, prix:6000000 }, compagnies:['orion', 'vega', 'boreal', 'azur', 'capella', 'sirocco', 'soleo', 'alpair'], heures:[0, 24],
      terminal:{ l:13, la:4, cr:0, h:4, v:4, cellule:23, modules:[[0, 0, 'comptoir'], [1, 0, 'comptoir'], [2, 0, 'comptoir'], [3, 0, 'comptoir'], [4, 0, 'securite'], [5, 0, 'securite'], [6, 0, 'securite'], [7, 0, 'passeports'], [8, 0, 'passeports'], [0, 3, 'salle'], [1, 3, 'salle'], [2, 3, 'salle'], [3, 3, 'salle'], [4, 3, 'restaurant'], [5, 3, 'boutique'], [8, 3, 'toilettes'], [9, 0, 'tapis'], [10, 0, 'tapis'], [11, 0, 'douane'], [12, 0, 'douane']], petits:[[50, 18, 'plante'], [51, 18, 'poubelle'], [52, 18, 'ecran'], [53, 18, 'banc'], [50, 19, 'banc'], [51, 19, 'banc']] },
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
    if(!payer(P, H.prix, `Hangar : ${H.nom}`)) return 'Pas assez d\'argent.';
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
    comptoir:{ zones:['dep'], famille:'hall', nom:'Enregistrement', ico:'🛄', prix:20000, coul:'#4F7CAC', cap:2, zone:'ville', desc:'2 comptoirs d\'enregistrement et de dépôt des bagages.' },
    securite:{ zones:['dep'], famille:'hall', nom:'Contrôle de sûreté', ico:'🔍', prix:40000, coul:'#7A5C99', cap:1, zone:'ville', desc:'Un poste de contrôle (portique et tapis à rayons X).' },
    passeports:{ zones:['dep'], famille:'hall', nom:'Contrôle des passeports', ico:'🛂', prix:35000, coul:'#3D5A80', cap:2, zone:'ville', niv:2, depart:true, desc:'Départs : la police aux frontières contrôle les passeports des vols internationaux (2 guichets).' },
    douane:{ zones:['arr'], famille:'hall', nom:'Douane', ico:'🛃', prix:30000, coul:'#2A9D8F', cap:2, zone:'ville', niv:2, arrivee:true, desc:'Arrivées : les passagers des vols internationaux passent la douane avant de sortir.' },
    tapis:{ zones:['arr'], famille:'hall', nom:'Tapis à bagages', ico:'🎒', prix:30000, coul:'#5A8F7B', cap:1, zone:'ville', desc:'Les passagers à l\'arrivée y récupèrent leurs bagages.' },
    salle:{ zones:['com'], famille:'attente', nom:'Salle d\'attente', ico:'💺', prix:15000, coul:'#8D99AE', cap:50, zone:'piste', desc:'50 sièges pour attendre l\'embarquement.' },
    boutique:{ zones:['com'], famille:'boutique', nom:'Boutique', ico:'🛍️', prix:30000, coul:'#E07A5F', cap:25, zone:'piste', depense:.55, desc:'Les passagers dépensent en attendant : ça rapporte.' },
    cafe:{ zones:['com'], famille:'cafe', nom:'Café', ico:'☕', prix:25000, coul:'#B07D62', cap:20, zone:'piste', depense:.45, desc:'Un café : ça rapporte et les passagers sont contents.' },
    restaurant:{ zones:['com'], famille:'restaurant', nom:'Restaurant', ico:'🍝', prix:50000, coul:'#D4A373', cap:30, zone:'piste', depense:.65, niv:4, desc:'Ça rapporte beaucoup et rend les passagers heureux.' },
    toilettes:{ zones:['com', 'dep', 'arr'], famille:'attente', nom:'Toilettes', ico:'🚻', prix:10000, coul:'#9DB4C0', cap:1, zone:'piste', desc:'Indispensables ! Sans toilettes, les passagers sont mécontents.' },
    jeux:{ zones:['com'], famille:'attente', nom:'Espace enfants', ico:'🧸', prix:20000, coul:'#F2CC8F', cap:1, zone:'piste', niv:3, desc:'Les familles sont plus contentes.' },
    salon:{ zones:['com'], famille:'attente', nom:'Salon VIP', ico:'🥂', prix:90000, coul:'#2A2D43', cap:20, zone:'piste', depense:.9, niv:9, desc:'Pour les long-courriers : passagers ravis, et ça rapporte.' },
    plantes:{ zones:['com', 'dep', 'arr'], famille:'deco', nom:'Plantes', ico:'🪴', prix:3000, coul:'#81B29A', cap:1, zone:'piste', deco:1, desc:'Décoration : un peu plus de satisfaction.' },
    fontaine:{ zones:['com', 'dep', 'arr'], famille:'deco', nom:'Fontaine', ico:'⛲', prix:12000, coul:'#8ECAE6', cap:1, zone:'piste', deco:2, niv:2, desc:'Décoration : plus de satisfaction.' },
  };

  // les familles de constructions (pour ranger la palette)
  const FAMILLES = { hall:['🛂', 'Hall : départs et arrivées'], restaurant:['🍽️', 'Restaurants'], cafe:['☕', 'Cafés'], bar:['🍸', 'Bars'], boutique:['🛍️', 'Boutiques'], service:['🧳', 'Services'], attente:['💺', 'Attente et confort'], deco:['🌿', 'Décoration'] };
  // un commerce en plus : [id, nom, ico, prix, couleur, clients, dépense par client et par minute, niveau, famille, gen, description]
  for(const [id, nom, ico, prix, coul, cap, dep, niv, famille, gen, desc] of [
    ['fastfood', 'Fast-food', '🍔', 35000, '#E63946', 40, .6, 3, 'restaurant', 'resto', 'Rapide et populaire : beaucoup de clients.'],
    ['pizzeria', 'Pizzeria', '🍕', 40000, '#C0392B', 30, .62, 4, 'restaurant', 'resto', 'Four à bois et nappes à carreaux.'],
    ['brasserie', 'Brasserie', '🥘', 55000, '#8B5A2B', 34, .7, 6, 'restaurant', 'resto', 'Cuisine de brasserie, banquettes en cuir.'],
    ['sushi', 'Bar à sushis', '🍣', 60000, '#264653', 24, .78, 7, 'restaurant', 'resto', 'Un tapis roulant de sushis : les voyageurs adorent.'],
    ['gastro', 'Restaurant gastronomique', '⭐', 110000, '#6D597A', 22, 1.1, 11, 'restaurant', 'resto', 'Une grande table : ça rapporte beaucoup.'],
    ['coffeeshop', 'Coffee shop', '☕', 28000, '#6F4E37', 20, .5, 2, 'cafe', 'cafe', 'Cafés de spécialité et muffins.'],
    ['boulangerie', 'Boulangerie-viennoiserie', '🥐', 30000, '#D4A373', 22, .5, 3, 'cafe', 'cafe', 'Croissants chauds dès le matin.'],
    ['salonthe', 'Salon de thé', '🍵', 32000, '#52796F', 18, .56, 5, 'cafe', 'cafe', 'Thés du monde et pâtisseries.'],
    ['bar_jus', 'Bar à jus', '🥤', 25000, '#F4A261', 18, .45, 2, 'bar', 'bar', 'Jus frais et smoothies.'],
    ['pub', 'Pub', '🍻', 40000, '#6B4226', 30, .66, 4, 'bar', 'bar', 'Pressions et écrans de sport.'],
    ['bar_cocktail', 'Bar à cocktails', '🍸', 45000, '#7B2D8E', 25, .82, 5, 'bar', 'bar', 'Cocktails et lumières tamisées.'],
    ['bar_vin', 'Bar à vin', '🍷', 50000, '#7D1D3F', 20, .88, 8, 'bar', 'bar', 'Cave à vin et planches de fromages.'],
    ['presse', 'Presse et librairie', '📰', 28000, '#3A6EA5', 25, .45, 2, 'boutique', 'shop', 'Journaux, magazines et livres de voyage.'],
    ['souvenirs', 'Souvenirs', '🎁', 25000, '#E76F51', 30, .5, 2, 'boutique', 'shop', 'Cartes postales, magnets, peluches.'],
    ['pharmacie', 'Pharmacie', '💊', 30000, '#2A9D8F', 20, .5, 3, 'boutique', 'shop', 'Les petits maux du voyage.'],
    ['jouets', 'Jouets', '🪀', 35000, '#F2C230', 25, .55, 4, 'boutique', 'shop', 'Pour faire patienter les enfants.'],
    ['mode', 'Mode et accessoires', '👗', 45000, '#D81159', 25, .75, 5, 'boutique', 'shop', 'Vêtements, sacs et écharpes.'],
    ['parfumerie', 'Parfumerie', '💄', 55000, '#B5838D', 25, .85, 6, 'boutique', 'shop', 'Le classique du duty-free.'],
    ['spiritueux', 'Alcools et chocolats', '🥃', 50000, '#5C3D2E', 25, .92, 6, 'boutique', 'shop', 'Spiritueux, vins et grands chocolats.'],
    ['electronique', 'Électronique', '🎧', 60000, '#1D3557', 22, .8, 7, 'boutique', 'shop', 'Casques, chargeurs et appareils photo.'],
    ['bijouterie', 'Bijoux et montres', '💍', 90000, '#B8860B', 15, 1.2, 9, 'boutique', 'shop', 'Peu de clients, de gros tickets.'],
    ['change', 'Bureau de change', '💱', 20000, '#2D6A4F', 10, .6, 2, 'service', 'service', 'Les voyageurs changent leur monnaie.'],
    ['voiture', 'Location de voitures', '🚗', 40000, '#0077B6', 10, .9, 4, 'service', 'service', 'Les comptoirs des loueurs.'],
    ['douches', 'Douches', '🚿', 30000, '#48CAE4', 10, .4, 3, 'service', 'service', 'Se rafraîchir avant le vol : plus de confort.'],
    ['coworking', 'Espace de travail', '💼', 45000, '#495057', 20, .5, 5, 'service', 'service', 'Bureaux et prises pour les voyageurs d\'affaires.'],
    ['repos', 'Cabines de repos', '🛏️', 60000, '#3D405B', 12, .9, 6, 'service', 'service', 'Dormir quelques heures entre deux vols.'],
    ['spa', 'Spa et massages', '💆', 70000, '#84A59D', 12, 1.1, 8, 'service', 'service', 'Détente avant le vol : très haut de gamme.'],
  ]) MODULES[id] = { zones:['com'], famille, gen, nom, ico, prix, coul, cap, depense:dep, niv, desc, ...(['douches', 'repos', 'spa'].includes(id) ? { deco:id === 'douches' ? 1.5 : 2 } : {}) };
  // des décorations (pas de clients : de la satisfaction)
  for(const [id, nom, ico, prix, coul, deco, niv, desc] of [
    ['jardin', 'Jardin intérieur', '🌳', 40000, '#4E8F3E', 4, 3, 'Des arbres sous la verrière.'],
    ['murvegetal', 'Mur végétal', '🌿', 25000, '#52B788', 2.5, 4, 'Un grand mur de plantes.'],
    ['statue', 'Sculpture', '🗿', 35000, '#ADB5BD', 3, 4, 'Une œuvre d\'art monumentale.'],
    ['piano', 'Piano en libre service', '🎹', 20000, '#1B1B1B', 2, 3, 'Un pianiste de passage, de temps en temps.'],
    ['horloge', 'Horloge monumentale', '🕰️', 30000, '#B08968', 2.5, 5, 'Un repère dans le hall.'],
    ['aquarium', 'Aquarium géant', '🐠', 60000, '#0096C7', 5, 6, 'Des poissons tropicaux : les enfants adorent.'],
    ['maquette', 'Maquette géante d\'avion', '✈️', 80000, '#E9ECEF', 5, 8, 'Un avion suspendu au plafond.'],
  ]) MODULES[id] = { zones:['com'], famille:'deco', gen:'deco', nom, ico, prix, coul, cap:1, deco, niv, desc };

  // les petits objets, posés dans les petites cases (4 par case de la grille) entre les constructions
  const PETITS = {
    plante:{ nom:'Plante en pot', ico:'🪴', prix:800, deco:.25, desc:'Un peu de vert : un peu plus de satisfaction.' },
    banc:{ nom:'Banc', ico:'🪑', prix:1200, places:6, desc:'6 places assises de plus.' },
    poubelle:{ nom:'Poubelle', ico:'🗑️', prix:500, proprete:1, desc:'Un terminal propre rend les passagers plus contents.' },
    ecran:{ nom:'Écran des vols', ico:'📺', prix:2500, deco:.35, desc:'Les passagers voient leur porte et l\'heure : moins de stress.' },
    distributeur:{ nom:'Distributeur', ico:'🥤', prix:3500, commerce:{ cap:4, dep:.25 }, desc:'Boissons et friandises : ça rapporte un peu.' },
    borne:{ nom:'Borne de recharge', ico:'🔌', prix:2000, deco:.3, desc:'Pour recharger son téléphone : les passagers adorent.' },
    eau:{ nom:'Fontaine à eau', ico:'🚰', prix:1500, deco:.2, desc:'De l\'eau fraîche gratuite.' },
    palmier:{ nom:'Palmier en pot', ico:'🌴', prix:1200, deco:.3, desc:'Une ambiance de vacances.' },
    canape:{ nom:'Canapé', ico:'🛋️', prix:2200, places:4, desc:'4 places assises, bien plus confortables.' },
    fauteuil:{ nom:'Fauteuil', ico:'💺', prix:700, places:1, desc:'Une place assise de plus.' },
    poubelletri:{ nom:'Poubelle de tri', ico:'♻️', prix:900, proprete:1.5, desc:'Plus propre qu\'une poubelle ordinaire.' },
    cafe_auto:{ nom:'Machine à café', ico:'☕', prix:4000, commerce:{ cap:4, dep:.3 }, desc:'Un café en libre service : ça rapporte.' },
    photomaton:{ nom:'Photomaton', ico:'📸', prix:5000, commerce:{ cap:2, dep:.35 }, desc:'Des photos d\'identité et des souvenirs.' },
    kiosque:{ nom:'Kiosque à journaux', ico:'🗞️', prix:6000, commerce:{ cap:5, dep:.35 }, desc:'Un petit kiosque dans l\'allée.' },
    info:{ nom:'Borne d\'information', ico:'ℹ️', prix:3000, deco:.35, desc:'Un plan et les horaires.' },
    chariots:{ nom:'Chariots à bagages', ico:'🛒', prix:900, deco:.1, desc:'Un rang de chariots.' },
    sculpture:{ nom:'Petite sculpture', ico:'🗽', prix:6000, deco:.5, desc:'Une touche d\'art.' },
    lampadaire:{ nom:'Lampadaire design', ico:'💡', prix:1500, deco:.2, desc:'Une belle lumière dans l\'allée.' },
    horlogep:{ nom:'Horloge', ico:'🕒', prix:1800, deco:.25, desc:'L\'heure, pour ne pas rater son vol.' },
    jeuxenfants:{ nom:'Jeu pour enfants', ico:'🎠', prix:3500, deco:.4, desc:'Un petit manège pour patienter.' },
  };
  const PETIT_DIV = 8;                                                // chaque case est découpée en 8 × 8 petits carrés pour les petits objets

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
  const PALIERS = 20;
  // les récompenses du « passe de confiance » de chaque compagnie
  const RECOMPENSES = [
    { argent:15000 }, { livree:'bande' }, { argent:30000 }, { vehicule:'bagages' }, { bonus:.05 },
    { livree:'ventre' }, { argent:80000 }, { vehicule:'carburant' }, { livree:'speciale', bonus:.05 }, { livree:'or', argent:200000 },
    // les paliers 11 à 20 (v222) : encore plus de cadeaux
    { argent:120000 }, { livree:'degrade' }, { xp:300 }, { vehicule:'repas' }, { bonus:.04, carbu:60000 },
    { argent:250000, xp:200 }, { livree:'pointes' }, { vehicule:'tech' }, { bonus:.05, argent:400000 }, { argent:1000000, xp:1500, bonus:.08 },
  ];
  const texteRecompense = r => [r.argent ? `${euros(r.argent)}` : '', r.livree ? `livrée « ${LIVREES[r.livree].nom} »` : '', r.vehicule ? `${VEHICULES[r.vehicule].nom.toLowerCase()} offert` : '', r.bonus ? `+${Math.round(r.bonus * 100)} % sur ses vols` : '', r.xp ? `${r.xp} points d'expérience` : '', r.carbu ? `${Math.round(r.carbu / 1000)} 000 L de kérosène` : ''].filter(Boolean).join(' + ');
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
    // les objectifs de la v222
    { id:'banque', txt:'Prends un prêt à la banque (💰 Finance)', gain:10000, ok:P => (P.banque && (P.banque.prets.length > 0 || P.banque.rembourses > 0)) },
    { id:'prime', txt:'Gagne une prime de mini-jeu (☰ Menu)', gain:15000, ok:(P, A) => !!A.primes && Object.keys(A.primes).length > 0 },
    { id:'commerces3', txt:'Aie 3 commerces (restaurants, cafés, bars, boutiques)', gain:15000, ok:(P, A) => A.terminal.modules.filter(m => MODULES[m.type].depense).length >= 3 },
    { id:'dutyfree', txt:'Ouvre un commerce aux Arrivées (duty-free)', gain:20000, ok:(P, A) => A.terminal.modules.some(m => m.y >= 1 && MODULES[m.type].depense && zoneCol(A, m.x) === 'arr') },
    { id:'pax1000', txt:'Fais voyager 1 000 passagers', gain:30000, ok:P => P.stats.pax >= 1000 },
    { id:'portes4', txt:'Ouvre 4 portes d\'embarquement', gain:30000, ok:(P, A) => A.portes.length >= 4 },
    { id:'redevances', txt:'Touche 10 000 € de redevances de commerces en une journée', gain:40000, ok:(P, A) => A.historique.some(b => b.commerce >= 10000) },
    { id:'piste', txt:'Allonge la piste (🚚 Sol › Pistes)', gain:50000, ok:(P, A) => (A.pisteExt || 0) > 0 },
    { id:'immo', txt:'Construis un bâtiment d\'immobilier (🏢 Terminal)', gain:60000, ok:(P, A) => (A.immo || []).length > 0 },
    { id:'vols100', txt:'Fais partir 100 vols', gain:60000, ok:P => P.stats.vols >= 100 },
    { id:'palier5', txt:'Atteins le palier 5 de confiance avec une compagnie', gain:80000, ok:P => Object.values(P.compagnies).some(c => paliersAtteints(c.xp) >= 5) },
    { id:'niv10', txt:'Atteins le niveau 10', gain:100000, ok:P => niveauDe(P.xp) >= 10 },
    { id:'pax10000', txt:'Fais voyager 10 000 passagers', gain:150000, ok:P => P.stats.pax >= 10000 },
    { id:'palier10', txt:'Atteins le palier 10 de confiance avec une compagnie', gain:200000, ok:P => Object.values(P.compagnies).some(c => paliersAtteints(c.xp) >= 10) },
    { id:'niv20', txt:'Atteins le niveau 20', gain:300000, ok:P => niveauDe(P.xp) >= 20 },
    { id:'palier20', txt:'Atteins le palier 20 de confiance avec une compagnie', gain:1000000, ok:P => Object.values(P.compagnies).some(c => paliersAtteints(c.xp) >= 20) },
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
    const A = { id, t:5.5 * 60, portes:D.portes.map((g, i) => ({ ...g, nom:nomPorte(i) })), vehicules:{}, unites:[], terminal:{ l:D.terminal.l, la:D.terminal.la, cr:0, h:D.terminal.h, v:4, extra:0, cf:null, zones:true, modules:D.terminal.modules.map(([x, y, type]) => ({ x, y, type, niv:1, rot:0 })), petits:(D.terminal.petits || []).map(([x, y, type]) => ({ x, y, type, rot:0 })) },
      hangars:{}, personnel:{ entretien:1 }, pistes:1, pistesLibres:[0, 0], contrats:[], offres:[], vols:[], journal:[], qCheck:[], qSecu:[], pisteLibre:0, meteo:'beau', reputation:70, jourStats:nouveauJour(), historique:[], dernierJour:0, toasts:[], carbu:nouvelleCuve(id) };
    for(const [k, n] of Object.entries(D.vehicules)){ A.vehicules[k] = { niv:1 }; for(let i = 0; i < n; i++) A.unites.push(nouvelleUnite(A, k)); }
    meteoDuJour(A); genererOffres(P, A, 4);
    return A;
  }
  const nomPorte = i => (i < 8 ? 'A' : 'B') + String((i % 8) + 1).padStart(2, '0');
  const nouveauJour = () => ({ ventes:0, immo:0, vols:0, retards:0, minutesRetard:0, revenus:0, commerce:0, services:0, detail:{}, achats:0, litres:0, penalites:0, depenses:0, credit:0, pax:0, satisf:0, nSatisf:0, manques:0, primes:0 });
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
    const prix = CUVE.prix[C.niv + 1]; if(!payer(P, prix, 'Cuve à carburant')) return 'Pas assez d\'argent.';
    C.niv++; journal(A, `🛢️ La cuve passe au niveau ${C.niv} : ${capCuve(C).toLocaleString('fr-FR')} litres.`, 'bon'); return null;
  }

  /* ---------- Le plan de l'aéroport (en mètres) ---------- */
  // x le long de la piste (les avions atterrissent et décollent vers +x), z vers la ville (+z) ; la piste est en z = -PISTE_Z
  // les postes sont devant l'aérogare (z ≈ -40), l'avion nez vers l'aérogare ; une voie de circulation longe les postes (z = VOIE_P)
  /* La piste décide de la taille des avions (et donc des portes) : on peut l'allonger (A.pisteExt, +300 m chaque fois),
     ce qui permet des portes et des avions plus gros, jusqu'aux très gros porteurs. */
  const ORDRE_TAILLES = ['S', 'M', 'L', 'XL'];
  const tailleMaxDe = A => ORDRE_TAILLES[Math.min(3, TAILLES[AEROPORTS[A.id].tailleMax].ordre + (A.pisteExt || 0))];
  const pisteLongueur = A => AEROPORTS[A.id].piste + 300 * (A.pisteExt || 0);
  const peutAllonger = A => TAILLES[tailleMaxDe(A)].ordre < 3;
  const prochaineTaille = A => ORDRE_TAILLES[TAILLES[tailleMaxDe(A)].ordre + 1];
  const NIV_ALLONGER = { L:5, XL:10 };
  const prixAllonger = A => ({ L:600000, XL:1600000 })[prochaineTaille(A)] || 0;
  function allongerPiste(P, A){
    if(!peutAllonger(A)) return 'La piste accepte déjà les plus gros avions.';
    const t = prochaineTaille(A);
    if(niveauDe(P.xp) < NIV_ALLONGER[t]) return `Il faut le niveau ${NIV_ALLONGER[t]} pour accueillir les avions ${t}.`;
    if(!payer(P, prixAllonger(A), 'Piste allongée')) return 'Pas assez d\'argent.';
    A.pisteExt = (A.pisteExt || 0) + 1;
    journal(A, `🛬 Piste allongée de 300 m (${pisteLongueur(A)} m) : les avions ${t} peuvent maintenant se poser. Agrandis tes portes (🚚 Sol) pour les accueillir.`, 'bon');
    return null;
  }

  const PISTE_Z = -300, TAXI_Z = -236, VOIE_P = -150, FACADE_Z = -26, SERVICE_Z = -126;
  const ECART_PISTES = 120;                                          // la distance entre les deux pistes (m)
  const CACHE_PLAN = new Map();
  function plan(A){
    const D = AEROPORTS[A.id], cle = A.id + ':e' + (A.pisteExt || 0) + ':' + A.terminal.l + 'x' + A.terminal.h + ':' + A.portes.map(g => g.taille + (g.passerelle ? 'p' : '')).join(',');
    if(CACHE_PLAN.has(cle)) return CACHE_PLAN.get(cle);
    // les postes, de gauche à droite
    let x = 0; const postes = A.portes.map(g => { const w = TAILLES[g.taille].largeur + 8, cx = x + w / 2; x += w; return { cx, w, taille:g.taille, passerelle:g.passerelle }; });
    const largeur = x, dx = -largeur / 2 + 40;
    // A01 à droite de l'aérogare vue des pistes (les numéros se lisent de gauche à droite depuis la piste)
    postes.forEach(p => { p.cx = largeur - p.cx + dx; p.nezZ = FACADE_Z - 8; });
    // la jetée (15 m), 5 m de marge, puis les rangées de cases CARRÉES (le côté d'une case, `cel`, est fixé par aéroport) ;
    // quand la grille est plus large que la façade des portes, le terminal s'allonge vers la gauche
    const CEL = D.terminal.cellule, wGrille = A.terminal.l * CEL + 14, x1T = dx + largeur + 10; let x0T = dx - 30; if(x1T - x0T < wGrille) x0T = x1T - wGrille;
    const terminal = { x0:x0T, x1:x1T, z0:FACADE_Z, z1:FACADE_Z + 20 + A.terminal.h * CEL, cel:CEL };
    // la piste principale, et la seconde quand elle est construite (parallèle, plus loin du terminal :
    // ses bretelles traversent la première, comme dans un vrai aéroport à pistes parallèles)
    const LP = pisteLongueur(A);
    const piste = { x0:-LP / 2, x1:LP / 2, z:PISTE_Z, largeur:45 };
    const pistes = [piste, { x0:-LP / 2, x1:LP / 2, z:PISTE_Z - ECART_PISTES, largeur:45 }];
    // les bretelles entre la piste et la voie parallèle, et entre la voie parallèle et la voie des postes
    const bretelles = []; for(let bx = piste.x0 + 60; bx <= piste.x1 - 40; bx += 170) bretelles.push(Math.round(bx));
    const liens = [terminal.x0 - 70, terminal.x1 + 70];             // de la voie parallèle à la voie des postes
    const depot = { x:terminal.x1 + 120, z:-95 };                   // le dépôt des véhicules de piste
    // les hangars s'alignent derrière le dépôt, le long de la route de service
    const hangars = hangarsOuvrables({ id:A.id }).map((k, i) => ({ k, x:depot.x + 60 + i * 56, z:depot.z + 10 }));
    const parcelles = Array.from({ length:6 }, (_, i) => ({ x:terminal.x1 - 30 - i * 62, z:terminal.z1 + 150 }));                // les terrains de l'immobilier de l'aéroport, derrière le parking
    const P = { postes, terminal, piste, pistes, bretelles, liens, depot, hangars, parcelles, tour:{ x:terminal.x0 - 90, z:20 }, carburant:{ x:terminal.x1 + 210, z:-30 } };
    // les trajets des avions : un jeu par piste (le même chemin, mais vers l'autre bande)
    const pisteSortie = x => bretelles.find(b => b >= x) ?? bretelles[bretelles.length - 1];
    P.trajets = pistes.map(pi => postes.map((p, i) => {
      const pz = pi.z;
      const lienArr = liens.reduce((m, l) => Math.abs(l - p.cx) < Math.abs(m - p.cx) ? l : m, liens[0]);
      const toucher = pi.x0 + 90, sortie = pisteSortie(pi.x0 + LP * .55);
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

  /* ---------- Les redevances des commerces : les commerces appartiennent à des concessionnaires, l'aéroport touche un pourcentage de leurs ventes ----------
     Chaque famille a un taux par défaut ; on peut le changer (🏦 Finance › Redevances) : un taux plus haut rapporte plus par client mais fait monter les prix, donc vend moins
     et déplaît un peu aux passagers. */
  const TAUX_BASE = { restaurant:.15, cafe:.15, bar:.18, boutique:.2, service:.2, petit:.25, salon:.2 };
  const NOM_TAUX = { restaurant:['🍽️', 'Restaurants'], cafe:['☕', 'Cafés'], bar:['🍸', 'Bars'], boutique:['🛍️', 'Boutiques'], service:['🧳', 'Services'], petit:['🥤', 'Petits commerces (machines, kiosques…)'], salon:['🥂', 'Salon VIP'] };
  const TAUX_MIN = .05, TAUX_MAX = .4;
  const tauxDe = (A, f) => (A.taux && A.taux[f] != null) ? A.taux[f] : TAUX_BASE[f];
  const volumeVentes = (A, f) => clamp(1 - (tauxDe(A, f) - TAUX_BASE[f]) * 1.6, .35, 1.4);      // un loyer plus cher fait monter les prix : moins de ventes
  const penaliteTaux = A => { const fs = [...new Set(A.terminal.modules.map(m => MODULES[m.type].famille === 'attente' && m.type === 'salon' ? 'salon' : MODULES[m.type].depense ? MODULES[m.type].famille : null).filter(Boolean))]; return fs.length ? Math.min(6, fs.reduce((s2, f) => s2 + Math.max(0, tauxDe(A, f) - TAUX_BASE[f]) * 28, 0) / fs.length) : 0; };
  function reglerTaux(A, f, delta){
    if(!TAUX_BASE[f]) return 'Famille inconnue.';
    const t = Math.round((tauxDe(A, f) + delta) * 100) / 100;
    if(t < TAUX_MIN || t > TAUX_MAX) return `Le taux va de ${Math.round(TAUX_MIN * 100)} % à ${Math.round(TAUX_MAX * 100)} %.`;
    (A.taux = A.taux || {})[f] = t; return null;
  }
  /* ---------- Le terminal : les capacités ---------- */
  function capacites(A){
    const c = { passeports:0, douane:0, comptoirs:0, postes:0, tapis:0, places:0, toilettes:0, jeux:0, salon:0, deco:0, proprete:0, commerce:[], commerceArr:[], restaurant:0, cafe:0 };
    for(const p of A.terminal.petits || []){ const O = PETITS[p.type]; if(O.places) c.places += O.places; if(O.deco) c.deco += O.deco; if(O.proprete) c.proprete += O.proprete; if(O.commerce) c.commerce.push({ ...O.commerce, fam:'petit' }); }
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
      else if(m.type === 'salon'){ c.salon += M.cap * f; c.commerce.push({ cap:M.cap * f, dep:M.depense, salon:true, fam:'salon' }); }
      if(M.deco) c.deco += M.deco * f;
      if(M.famille === 'restaurant') c.restaurant++;
      if(M.famille === 'cafe' || M.famille === 'bar') c.cafe++;
      if(M.depense && m.type !== 'salon') (m.y >= 1 && zoneCol(A, m.x) === 'arr' ? c.commerceArr : c.commerce).push({ cap:M.cap * f, dep:M.depense, fam:M.famille });
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
    if(!payer(P, ENTRETIEN.embauche, 'Embauche d\'un agent d\'entretien')) return 'Pas assez d\'argent.';
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
  const avionsDisponibles = (P, A) => Object.keys(AVIONS).filter(k => AVIONS[k].niv <= niveauDe(P.xp) && TAILLES[AVIONS[k].taille].ordre <= TAILLES[tailleMaxDe(A)].ordre);
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
    apCourant = A; const avant = A.t; A.t += dt;
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
    // les ventes des concessionnaires (au taux de base, la redevance de l'aéroport vaut exactement ce que valait le gain avant) et la redevance (taux × ventes)
    const ventesDe = l => { let vt = 0, rd = 0; for(const c of l){ const base = TAUX_BASE[c.fam] || .2, v = c.cap * c.dep / base * volumeVentes(A, c.fam); vt += v; rd += v * tauxDe(A, c.fam); } return [vt, rd]; };
    const [vtC, rdC] = ventesDe(cap.commerce), kC = capCom ? clients / capCom * dt * D.commerce : 0;
    const gain = rdC * kC, ventes = vtC * kC;
    A.jourStats.ventes = (A.jourStats.ventes || 0) + ventes;
    if(airside > 0) for(const v of A.vols){ if(v.airside <= 0) continue; const part = v.airside / airside; v.inconfort += debout * part * dt; v.depense += gain * part; }
    A.jourStats.commerce += gain; P.argent += gain;
    // l'immobilier de l'aéroport : un revenu régulier
    for(const b of A.immo || []){ const r = IMMO[b.type].revenu / (24 * 60) * dt * D.commerce; A.jourStats.immo = (A.jourStats.immo || 0) + r; P.argent += r; }
    // les commerces de la zone Arrivées (duty-free) : chaque passager qui débarque y dépense un peu
    if(cap.commerceArr.length){
      let nouveaux = 0; for(const v of A.vols){ const d = (v.debarquesPax || 0) - (v._dfPax || 0); if(d > 0) nouveaux += d; v._dfPax = v.debarquesPax || 0; }
      const capA = cap.commerceArr.reduce((s2, c) => s2 + c.cap, 0), [vtA, rdA] = ventesDe(cap.commerceArr), kA = nouveaux / capA * 4 * D.commerce * Math.min(1, capA / 40);
      A.jourStats.ventes += vtA * kA; A.jourStats.commerce += rdA * kA; P.argent += rdA * kA;
    }
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
    sDep += Math.min(5, cap.jeux * 2.5) + Math.min(8, cap.deco * 1.2) + 3 * Math.min(1, cap.proprete / Math.max(2, Math.ceil(A.terminal.l * A.terminal.h / 6))) + (cap.restaurant ? 2 : 0) + (cap.salon && v.rayon === 'long' ? 4 : 0) - penaliteTaux(A);
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
    for(const b of A.immo || []) entretien += IMMO[b.type].prix * .003;
    entretien += personnel(A).entretien * ENTRETIEN.salaire;
    entretien = Math.round(entretien);
    P.argent -= entretien; J.depenses += entretien;
    echeances(P, A);
    const satisf = J.nSatisf ? Math.round(J.satisf / J.nSatisf) : null;
    const bilan = { jour:jourDe(A.t) - 1, ...J, satisf, net:Math.round(J.revenus + J.commerce + J.services + (J.primes || 0) - J.penalites - J.depenses - J.achats) };
    A.historique.unshift(bilan); A.historique.length = Math.min(A.historique.length, 14);
    if(satisf != null && J.nSatisf >= 3) P.stats.meilleureSatisf = Math.max(P.stats.meilleureSatisf, satisf);
    P.stats.meilleureJournee = Math.max(P.stats.meilleureJournee, bilan.net); P.stats.jours++;
    A.bilanJour = bilan;
    { const jb = bilan.jour; for(const [s2, c2, m2] of [['e', 'vols', J.revenus], ['e', 'commerces', J.commerce], ['e', 'immo', J.immo], ['e', 'services', J.services], ['e', 'primes', J.primes], ['d', 'entretien', J.depenses], ['d', 'carburant', J.achats], ['d', 'penalites', J.penalites]]) if(m2 > 0){ const C = P.compta || (P.compta = { lignes:[] }); C.lignes.unshift({ j:jb, ap:A.id, s:s2, c:c2, m:Math.round(m2), t:`Bilan du jour ${jb}` }); } if(P.compta && P.compta.lignes.length > 500) P.compta.lignes.length = 500; }
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

  /* ---------- L'immobilier de l'aéroport : des bâtiments autour du terminal, qui rapportent chaque jour ---------- */
  const PARCELLES = 6;
  const IMMO = {
    station:{ nom:'Station-service', ico:'⛽', prix:300000, revenu:3200, niv:2, desc:'Pour les voitures qui viennent à l\'aéroport.' },
    parking:{ nom:'Parking à étages', ico:'🅿️', prix:500000, revenu:6000, niv:3, desc:'Des centaines de places payantes.' },
    hotel:{ nom:'Hôtel de l\'aéroport', ico:'🏨', prix:800000, revenu:9000, niv:5, desc:'Pour les voyageurs en escale et les équipages.' },
    bureaux:{ nom:'Tour de bureaux', ico:'🏢', prix:700000, revenu:7500, niv:7, desc:'Les compagnies louent des bureaux.' },
    fret:{ nom:'Zone de fret', ico:'📦', prix:900000, revenu:9500, niv:9, desc:'Des entrepôts pour le fret aérien.' },
    tour:{ nom:'Tour panoramique', ico:'🗼', prix:1200000, revenu:12000, niv:12, desc:'Un restaurant panoramique et une terrasse : un site à visiter.' },
  };
  function acheterImmo(P, A, type){
    const D = IMMO[type]; if(!D) return 'Bâtiment inconnu.';
    A.immo = A.immo || [];
    if(niveauDe(P.xp) < D.niv) return `Disponible au niveau ${D.niv}.`;
    if(A.immo.length >= PARCELLES) return 'Toutes les parcelles sont occupées.';
    if(A.immo.some(b => b.type === type)) return 'Tu as déjà ce bâtiment ici.';
    if(!payer(P, D.prix, `Immobilier : ${D.nom}`)) return 'Pas assez d\'argent.';
    const libre = Array.from({ length:PARCELLES }, (_, i) => i).find(i => !A.immo.some(b => b.parcelle === i));
    A.immo.push({ type, parcelle:libre });
    journal(A, `${D.ico} ${D.nom} construit : +${euros(D.revenu)} par jour.`, 'bon');
    return null;
  }
  function vendreImmo(P, A, b){ A.immo = (A.immo || []).filter(x => x !== b); const r = Math.round(IMMO[b.type].prix * .5); P.argent += r; compta(P, 'e', 'reventes', r, `Vente : ${IMMO[b.type].nom}`); }

  /* ---------- Les achats ---------- */
  /* ---------- Le livre de comptes (P.compta) : chaque achat, cadeau et prêt, et le résumé de chaque journée ---------- */
  let apCourant = null;                                       // l'aéroport où l'on joue (pour dater les écritures)
  const CATS = {
    e:{ vols:'Redevances des vols', commerces:'Redevances des commerces', immo:'Loyers de l\'immobilier', services:'Services facturés aux compagnies', primes:'Primes des mini-jeux', cadeaux:'Cadeaux et objectifs', reventes:'Reventes de matériel', emprunt:'Prêts reçus' },
    d:{ entretien:'Entretien et salaires', carburant:'Carburant acheté', penalites:'Pénalités de retard', invest:'Investissements', remb:'Remboursements de prêts' },
  };
  function compta(P, sens, cat, montant, txt){
    if(!(montant > 0)) return;
    const C = P.compta || (P.compta = { lignes:[] });
    C.lignes.unshift({ j:apCourant ? jourDe(apCourant.t) : 0, ap:apCourant ? apCourant.id : '', s:sens, c:cat, m:Math.round(montant), t:txt || '' });
    if(C.lignes.length > 500) C.lignes.length = 500;
  }
  function payer(P, prix, txt){ if(P.argent < prix) return false; P.argent -= prix; compta(P, 'd', 'invest', prix, txt); return true; }
  // entrées et dépenses de l'aéroport sur une période : 'jour', 'semaine' ou 'tout' (les lignes du livre, plus la journée en cours)
  function comptes(P, A, periode){
    const j0 = jourDe(A.t), de = periode === 'jour' ? j0 : periode === 'semaine' ? j0 - 6 : -1e9, e = {}, d = {};
    const ajout = (o, k, v) => { if(v > 0) o[k] = (o[k] || 0) + v; };
    for(const l of (P.compta || { lignes:[] }).lignes){ if(l.ap !== A.id || l.j < de) continue; ajout(l.s === 'e' ? e : d, l.c, l.m); }
    const J = A.jourStats;
    ajout(e, 'vols', J.revenus); ajout(e, 'commerces', J.commerce); ajout(e, 'immo', J.immo); ajout(e, 'services', J.services); ajout(e, 'primes', J.primes);
    ajout(d, 'entretien', J.depenses); ajout(d, 'carburant', J.achats); ajout(d, 'penalites', J.penalites);
    const tot = o => Object.values(o).reduce((a, b) => a + b, 0);
    return { entrees:e, depenses:d, totE:tot(e), totD:tot(d), net:tot(e) - tot(d) };
  }

  /* Les portes tiennent le long de la façade du terminal : pour en ouvrir de nouvelles, il faut
     d'abord l'agrandir. Chaque case de largeur en plus donne deux portes, jusqu'au maximum que
     la place permet ici (D.portesMax). L'agrandissement, lui, coûte de plus en plus cher. */
  /* Le terminal : la rangée 0 (côté ville) est le HALL, avec les Départs (enregistrement, sûreté, passeports), une RÉSERVE
     d'agrandissement et les Arrivées (tapis, douane) ; les rangées 1 à 3 (côté pistes) sont la zone DUTY-FREE ET COMMERCES, sur toute la largeur.
     Chaque porte qu'on ouvre élargit l'aéroport : de nouvelles colonnes de réserve s'ouvrent dans le hall (les Arrivées glissent) et la zone
     commerces s'allonge d'autant. */
  const colsRes = A => A.terminal.cr || 0;
  const colsDep = A => A.terminal.l - A.terminal.la - colsRes(A);        // les colonnes de Départs (les premières), puis la réserve, puis les Arrivées
  const zoneCol = (A, x) => x < colsDep(A) ? 'dep' : x < colsDep(A) + colsRes(A) ? 'res' : 'arr';
  const zoneCase = (A, x, y) => y >= 1 ? 'com' : zoneCol(A, x);
  const zoneDe = zoneCol;
  const NOM_ZONE = { dep:'Départs', arr:'Arrivées', com:'Duty-free et commerces', res:'Réserve d\'agrandissement' };
  const zoneOk = (A, type, x, y) => MODULES[type].zones.includes(zoneCase(A, x, y));
  const msgZone = (type, A, x, y) => {
    if(A && zoneCase(A, x, y) === 'res') return 'Zone réservée : étends d\'abord les Départs ou les Arrivées (🏢 Terminal › Zones).';
    return `${MODULES[type].nom} : seulement dans ${MODULES[type].zones.map(z => z === 'dep' || z === 'arr' ? `les ${NOM_ZONE[z]} (rangée du hall)` : 'la zone Duty-free et commerces (rangées côté pistes)').join(' ou ')}.`;
  };
  // insérer n colonnes à la colonne x0 : tout ce qui est à droite glisse
  function insererColonne(A, x0, n = 1){
    const T = A.terminal;
    for(const m of T.modules) if(m.x >= x0) m.x += n;
    for(const p of T.petits || []) if(p.x >= x0 * PETIT_DIV) p.x += n * PETIT_DIV;
    T.l += n;
  }
  // la façade s'allonge avec les portes : chaque colonne de plus qu'elle permet s'ajoute à la RÉSERVE du hall (les Arrivées glissent) et à la zone commerces ;
  // `T.cf` = les colonnes déjà accordées par la façade
  const colsFacade = A => { let x = 0; for(const g of A.portes) x += TAILLES[g.taille].largeur + 8; return Math.floor((x + 40 - 14) / AEROPORTS[A.id].terminal.cellule); };
  function ajusterFacade(A, silencieux){
    const T = A.terminal; if(T.cf == null) T.cf = colsFacade({ id:A.id, portes:AEROPORTS[A.id].portes });
    const n = colsFacade(A) - T.cf; if(n <= 0) return;
    insererColonne(A, colsDep(A) + colsRes(A), n); T.cr = (T.cr || 0) + n; T.cf += n;
    if(!silencieux) journal(A, `🏗️ L'aéroport s'élargit : ${n} colonne${n > 1 ? 's' : ''} en plus. Le hall gagne ${n} colonne${n > 1 ? 's' : ''} de réserve (🏢 Terminal › Zones : étends les Départs ou les Arrivées) et la zone duty-free s'allonge : de la place pour de nouveaux commerces.`, 'bon');
  }
  // les colonnes du mur du hall (entre la rangée 0 et les commerces) où il y a une porte : au droit des contrôles et des arrivées
  function colonnesPortes(A){
    const T = A.terminal, cols = new Set(), cd = colsDep(A), ca = cd + colsRes(A);
    for(const m of T.modules) if(m.y === 0 && ['securite', 'passeports', 'tapis', 'douane'].includes(m.type)) cols.add(m.x);
    if(![...cols].some(x => x < cd)) cols.add(Math.max(0, cd - 1));
    if(T.la > 0 && ![...cols].some(x => x >= ca)) cols.add(ca);
    return [...cols].sort((a, b) => a - b);
  }
  const portesMax = A => { const D = AEROPORTS[A.id]; return Math.min(D.portesMax, D.portes.length + 2 * (A.terminal.extra || 0)); };       // deux portes de plus par colonne de Départs achetée
  const terminalMax = 14, arriveesMax = 8;
  function acheterPorte(P, A, taille){
    const D = AEROPORTS[A.id];
    if(A.portes.length >= portesMax(A)) return A.portes.length >= D.portesMax
      ? 'Plus de place pour une nouvelle porte ici : l\'aéroport est au complet.'
      : `La façade du terminal est pleine : agrandis-le (🏢 Terminal) pour ouvrir deux portes de plus.`;
    if(TAILLES[taille].ordre > TAILLES[tailleMaxDe(A)].ordre) return 'La piste est trop courte pour ces avions : allonge-la (🚚 Sol › Pistes).';
    const prix = TAILLES[taille].prix; if(!payer(P, prix, `Nouvelle porte ${taille}`)) return 'Pas assez d\'argent.';
    A.portes.push({ taille, passerelle:false, nom:nomPorte(A.portes.length) }); A.jourStats.depenses += 0;
    journal(A, `🏗️ Nouvelle porte ${A.portes[A.portes.length - 1].nom} (${TAILLES[taille].nom.toLowerCase()})`, 'bon');
    ajusterFacade(A);
    return null;
  }
  const prixPasserelle = taille => TAILLES[taille].ordre >= 2 ? 160000 : 80000;
  function acheterPasserelle(P, A, i){
    const g = A.portes[i]; if(!g || g.passerelle) return 'Déjà une passerelle.';
    if(niveauDe(P.xp) < 2) return 'Disponible au niveau 2.';
    if(!payer(P, prixPasserelle(g.taille), `Passerelle porte ${g.nom}`)) return 'Pas assez d\'argent.';
    g.passerelle = true; journal(A, `🌉 Passerelle installée porte ${g.nom} : débarquement et embarquement plus rapides, sans bus.`, 'bon');
    return null;
  }
  function agrandirPorte(P, A, i){
    const g = A.portes[i], D = AEROPORTS[A.id], suivante = Object.keys(TAILLES).find(k => TAILLES[k].ordre === TAILLES[g.taille].ordre + 1);
    if(!suivante) return 'Cette porte est déjà la plus grande.';
    if(TAILLES[suivante].ordre > TAILLES[tailleMaxDe(A)].ordre) return 'La piste est trop courte pour des avions de cette taille : allonge-la (🚚 Sol › Pistes).';
    if(A.vols.some(v => v.porte === i && VOLS_VISIBLES.includes(v.etat) && v.etat !== 'parti' && v.etat !== 'approche')) return 'Un avion utilise cette porte.';
    const prix = Math.round((TAILLES[suivante].prix - TAILLES[g.taille].prix) * 1.1);
    if(!payer(P, prix, `Porte ${g.nom} agrandie`)) return 'Pas assez d\'argent.';
    g.taille = suivante; journal(A, `🏗️ Porte ${g.nom} agrandie : ${TAILLES[suivante].nom.toLowerCase()}`, 'bon');
    ajusterFacade(A);
    return null;
  }
  function acheterVehicule(P, A, type, gratuit = false){
    if(type === 'degivrage' && !AEROPORTS[A.id].neige) return 'Pas besoin de dégivreuse ici.';
    const k = hangarDe(type);
    if(!gratuit && A.unites.filter(u => u.type === type).length >= maxVehicules(A, type))
      return aHangar(A, type) ? `Six ${VEHICULES[type].nom.toLowerCase()}s, c'est le maximum.`
        : `Pas de place dehors pour un troisième : construis ${HANGARS[k].nom.toLowerCase()} (🚚 Sol).`;
    if(!gratuit && !payer(P, VEHICULES[type].prix, VEHICULES[type].nom)) return 'Pas assez d\'argent.';
    A.unites.push(nouvelleUnite(A, type)); if(!A.vehicules[type]) A.vehicules[type] = { niv:1 };
    if(!gratuit) P.stats.achatsVehicules++;
    return null;
  }
  function ameliorerVehicule(P, A, type){
    const V = A.vehicules[type]; if(V.niv >= NIV_MAX) return 'Déjà au niveau maximum.';
    if(V.niv >= nivMaxVehicule(A, type)) return `Sans ${HANGARS[hangarDe(type)].nom.toLowerCase()}, on ne peut pas les améliorer (🚚 Sol).`;
    const nb = Math.max(1, A.unites.filter(u => u.type === type).length), prix = prixAmelioration(VEHICULES[type].prix, V.niv) * nb;
    if(!payer(P, prix, `Amélioration : ${VEHICULES[type].nom}`)) return 'Pas assez d\'argent.';
    V.niv++; return null;
  }
  const prixAmeliorationVehicules = (A, type) => prixAmelioration(VEHICULES[type].prix, A.vehicules[type].niv) * Math.max(1, A.unites.filter(u => u.type === type).length);
  // pourquoi ne peut-on pas poser ce bâtiment ici ? (null si c'est possible)
  function erreurPose(P, A, x, y, type, sans){
    const M = MODULES[type];
    if(M.niv && niveauDe(P.xp) < M.niv) return `Disponible au niveau ${M.niv}.`;
    if(x < 0 || y < 0 || x >= A.terminal.l || y >= A.terminal.h) return 'Hors du terminal.';
    if(A.terminal.modules.some(m => m !== sans && m.x === x && m.y === y)) return 'Case occupée.';
    if(!zoneOk(A, type, x, y)) return msgZone(type, A, x, y);
    if(petitsDansCase(A, x, y).length) return 'Il y a des petits objets sur cette case : enlève-les d\'abord.';
    return null;
  }
  function construire(P, A, x, y, type, rot){
    const e = erreurPose(P, A, x, y, type); if(e) return e;
    if(!payer(P, MODULES[type].prix, MODULES[type].nom)) return 'Pas assez d\'argent.';
    A.terminal.modules.push({ x, y, type, niv:1, rot:((rot || 0) % 4 + 4) % 4 }); return null;
  }
  function ameliorerModule(P, A, m){
    if(m.niv >= NIV_MAX) return 'Déjà au niveau maximum.';
    if(!payer(P, prixAmelioration(MODULES[m.type].prix, m.niv), `Amélioration : ${MODULES[m.type].nom}`)) return 'Pas assez d\'argent.';
    m.niv++; return null;
  }
  function vendreModule(P, A, m){ A.terminal.modules = A.terminal.modules.filter(x => x !== m); const r = Math.round(MODULES[m.type].prix * .5); P.argent += r; compta(P, 'e', 'reventes', r, `Vente : ${MODULES[m.type].nom}`); }
  function deplacerModule(A, m, x, y){ const e = erreurPose({ xp:1e9 }, A, x, y, m.type, m); if(e) return e; m.x = x; m.y = y; return null; }
  // tourner d'un quart de tour (le sens des aiguilles d'une montre vu de dessus)
  const tourner = o => { o.rot = ((o.rot || 0) + 1) % 4; };
  // les petits objets : une petite case = un quart de case (x de 0 à 2l − 1, y de 0 à 2h − 1)
  // les petits objets qui empêchent de construire sur cette case : ceux du centre (ceux de l'allée, sur l'anneau, ne gênent pas)
  const petitsDansCase = (A, x, y) => (A.terminal.petits || []).filter(p => Math.floor(p.x / PETIT_DIV) === x && Math.floor(p.y / PETIT_DIV) === y && p.x % PETIT_DIV > 0 && p.x % PETIT_DIV < PETIT_DIV - 1 && p.y % PETIT_DIV > 0 && p.y % PETIT_DIV < PETIT_DIV - 1);
  // un petit carré est libre s'il est dans l'allée (l'anneau d'un carré autour d'une construction) ou dans une case sans construction
  function libreQuart(A, x, y){
    const T = A.terminal, N = PETIT_DIV;
    if(x < 0 || y < 0 || x >= T.l * N || y >= T.h * N) return 'Hors du terminal.';
    if(zoneCase(A, Math.floor(x / N), Math.floor(y / N)) === 'res') return 'Zone réservée : étends d\'abord le hall.';
    if(T.modules.some(m => m.x === Math.floor(x / N) && m.y === Math.floor(y / N)) && x % N > 0 && x % N < N - 1 && y % N > 0 && y % N < N - 1) return 'Une construction occupe cette case : pose-le le long de l\'allée.';
    if((T.petits || []).some(p => p.x === x && p.y === y)) return 'Emplacement occupé.';
    return null;
  }
  function poserPetit(P, A, x, y, type, rot){
    const e = libreQuart(A, x, y); if(e) return e;
    if(!payer(P, PETITS[type].prix, PETITS[type].nom)) return 'Pas assez d\'argent.';
    (A.terminal.petits = A.terminal.petits || []).push({ x, y, type, rot:((rot || 0) % 4 + 4) % 4 }); return null;
  }
  function retirerPetit(P, A, p){ A.terminal.petits = A.terminal.petits.filter(q => q !== p); const r = Math.round(PETITS[p.type].prix * .5); P.argent += r; compta(P, 'e', 'reventes', r, `Vente : ${PETITS[p.type].nom}`); }
  function deplacerPetit(A, p, x, y){ const e = libreQuart(A, x, y); if(e) return e; p.x = x; p.y = y; return null; }
  // chaque colonne de Départs en plus coûte 35 % de plus que la précédente : on ne s'étend pas indéfiniment
  const prixAgrandir = A => Math.round(40000 * colsDep(A) * Math.pow(1.35, A.terminal.extra || 0) / 1000) * 1000;
  function agrandirTerminal(P, A){
    if(colsDep(A) >= terminalMax) return 'La zone Départs est déjà très grande.';
    if(!payer(P, prixAgrandir(A), 'Colonne de Départs')) return 'Pas assez d\'argent.';
    const avant = portesMax(A), T = A.terminal;
    insererColonne(A, colsDep(A), 1); T.extra = (T.extra || 0) + 1;        // une colonne de plus pour les Départs : la réserve et les Arrivées glissent
    const gagnees = portesMax(A) - avant;
    journal(A, `🏢 Zone Départs agrandie : ${colsDep(A)} colonnes${gagnees > 0 ? `, et ${gagnees} porte${gagnees > 1 ? 's' : ''} d'embarquement de plus à construire (🚚 Sol)` : ''}.`, 'bon');
    return null;
  }
  // étendre (delta = +1) ou réduire (−1) la zone Départs ou Arrivées du hall d'une colonne, aux dépens de la réserve (gratuit)
  function etendreZone(A, zone, delta){
    const T = A.terminal, cd = colsDep(A), cr = colsRes(A), debutArr = cd + cr, N = PETIT_DIV;
    const occupeHall = x => T.modules.find(m => m.x === x && m.y === 0) || (T.petits || []).find(p => Math.floor(p.x / N) === x && Math.floor(p.y / N) === 0);
    if(zone === 'dep'){
      if(delta > 0){ if(cr <= 0) return 'Il n\'y a plus de réserve : ouvre une porte (🚚 Sol) pour élargir l\'aéroport, ou achète une colonne.'; T.cr = cr - 1; }
      else { if(cd <= 2) return 'La zone Départs ne peut pas être plus petite.'; const o = occupeHall(cd - 1); if(o) return 'Libère d\'abord la dernière colonne des Départs (rangée du hall) : ' + (o.nom || (MODULES[o.type] || PETITS[o.type]).nom) + '.'; T.cr = cr + 1; }
    } else {
      if(delta > 0){ if(cr <= 0) return 'Il n\'y a plus de réserve : ouvre une porte (🚚 Sol) pour élargir l\'aéroport, ou achète une colonne.'; T.cr = cr - 1; T.la++; }
      else { if(T.la <= 2) return 'La zone Arrivées ne peut pas être plus petite.'; const o = occupeHall(debutArr); if(o) return 'Libère d\'abord la première colonne des Arrivées (rangée du hall) : ' + (MODULES[o.type] || PETITS[o.type]).nom + '.'; T.la--; T.cr = cr + 1; }
    }
    return null;
  }
  // la zone Arrivées : plus de tapis et de douane (sans portes en plus)
  const prixArrivees = A => Math.round(30000 * Math.pow(1.3, A.terminal.la - AEROPORTS[A.id].terminal.la) / 1000) * 1000;
  function agrandirArrivees(P, A){
    if(A.terminal.la >= arriveesMax) return 'La zone Arrivées est déjà très grande.';
    if(!payer(P, prixArrivees(A), 'Colonne d\'Arrivées')) return 'Pas assez d\'argent.';
    A.terminal.l++; A.terminal.la++;
    journal(A, `🏢 Zone Arrivées agrandie : ${A.terminal.la} colonnes.`, 'bon');
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
    if(!payer(P, prixPiste(A), 'Seconde piste')) return 'Pas assez d\'argent.';
    A.pistes = nbPistes(A) + 1; pistesLibres(A);
    journal(A, `🛬 Seconde piste ouverte : deux avions peuvent décoller ou atterrir en même temps, les attentes en l'air disparaissent.`, 'bon');
    return null;
  }

  /* ---------- Les compagnies : le passe de confiance ---------- */
  function recevoir(P, A, comp, k){
    const C = P.compagnies[comp];
    if(C.pris.includes(k) || paliersAtteints(C.xp) < k) return 'Pas encore atteint.';
    const r = RECOMPENSES[k - 1]; C.pris.push(k);
    if(r.argent){ P.argent += r.argent; compta(P, 'e', 'cadeaux', r.argent, `Palier ${k} · ${COMPAGNIES[comp].nom}`); }
    if(r.livree && !P.livrees[comp].dispo.includes(r.livree)){ P.livrees[comp].dispo.push(r.livree); P.livrees[comp].choisie = r.livree; }
    if(r.vehicule) acheterVehicule(P, A, r.vehicule, true);
    if(r.xp) P.xp += r.xp;
    if(r.carbu){ const cu = A.carbu; cu.stock = Math.min(CUVE.cap[cu.niv], cu.stock + r.carbu); }
    return null;
  }
  const aRecevoir = P => Object.entries(P.compagnies).reduce((s, [k, C]) => s + Math.max(0, paliersAtteints(C.xp) - C.pris.length), 0);

  /* ---------- Les aéroports ---------- */
  function debloquer(P, id){
    const D = AEROPORTS[id]; if(P.aeroports[id]) return null;
    if(niveauDe(P.xp) < D.deblocage.niveau) return `Il faut le niveau ${D.deblocage.niveau}.`;
    if(!payer(P, D.deblocage.prix, `Aéroport ${D.nom}`)) return 'Pas assez d\'argent.';
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
    P.argent += montant; compta(P, 'e', 'emprunt', montant, `Prêt sur ${duree} jours`);
    journal(A, `🏦 Prêt de ${euros(montant)} sur ${duree} jours (intérêts ${euros(interets)}, ${euros(Math.ceil(total / duree))} par jour).`, 'bon');
    return null;
  }
  // rembourser tout de suite : on économise la moitié des intérêts qui restent
  function prixRachat(p){ const frac = p.reste / p.total; return Math.max(0, p.reste - Math.round(p.interets * frac * .5)); }
  function rembourser(P, A, id){
    const B = banque(P), p = B.prets.find(x => x.id === id); if(!p) return 'Prêt introuvable.';
    const prix = prixRachat(p); if(P.argent < prix) return 'Pas assez d\'argent pour tout rembourser.';
    P.argent -= prix; compta(P, 'd', 'remb', prix, 'Prêt remboursé en avance'); A.jourStats.credit = (A.jourStats.credit || 0) + prix; B.interets += Math.max(0, prix - p.montant * p.reste / p.total);
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
        P.argent -= p.du; compta(P, 'd', 'remb', p.du, 'Échéance de prêt'); p.reste -= p.du; J.credit = (J.credit || 0) + p.du; B.interets += p.du * p.interets / p.total; p.du = 0; p.jours = Math.ceil(p.reste / p.ech);
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
    for(const o of OBJECTIFS){ if(P.objectifs.includes(o.id)) continue; if(o.ok(P, A)){ P.objectifs.push(o.id); P.argent += o.gain; compta(P, 'e', 'cadeaux', o.gain, `Objectif : ${o.txt.replace(/ \(.*\)$/, '')}`); faits.push(o); journal(A, `🎯 Objectif réussi : ${o.txt.replace(/ \(.*\)$/, '')} (+${euros(o.gain)})`, 'cadeau'); } }
    return faits;
  }


  /* ---------- Les primes des mini-jeux : bien jouer au guichet rapporte de l'argent à l'aéroport ----------
     Chaque poste verse une prime à la fin du service : points × taux × précision, plafonnée. La prime est pleine si le poste n'a pas rapporté
     depuis DELAI_PRIME minutes de jeu (4 h) ; sinon elle est réduite (un quart) : on peut rejouer pour s'amuser, sans multiplier l'argent. */
  const PRIMES = {
    passeports:{ nom:'Passeports', ico:'🛂', taux:6.5, plafond:24000 }, securite:{ nom:'Rayons X', ico:'🔍', taux:7, plafond:24000 }, portique:{ nom:'Portique', ico:'🚶', taux:7, plafond:24000 },
    douane:{ nom:'Douane', ico:'🛃', taux:7, plafond:27000 }, bagages:{ nom:'Tri des bagages', ico:'🧳', taux:4.2, plafond:27000 }, degivrage:{ nom:'Dégivrage', ico:'🧊', taux:9, plafond:30000 },
  };
  const DELAI_PRIME = 180, REDUIT_PRIME = .3;
  const etatPrime = (A, type) => { const d = A.primes && A.primes[type], reste = d == null ? 0 : Math.max(0, d + DELAI_PRIME - A.t); return { pret:reste <= 0, reste }; };
  function primeControle(P, A, type, score, bons, total){
    const D = PRIMES[type]; if(!D || score <= 0) return { gain:0, pret:etatPrime(A, type).pret };
    A.primes = A.primes || {};
    const { pret } = etatPrime(A, type), precision = total ? bons / total : 0;
    let gain = score * D.taux * (.6 + .8 * precision) * (1 + .03 * Math.min(15, niveauDe(P.xp)));
    gain = Math.min(D.plafond, gain) * (pret ? 1 : REDUIT_PRIME); gain = Math.max(10, Math.round(gain / 10) * 10);
    if(pret) A.primes[type] = A.t;
    P.argent += gain; A.jourStats.primes = (A.jourStats.primes || 0) + gain;
    const xp = Math.round(gain / 500); if(xp) P.xp += xp;
    journal(A, `${D.ico} ${D.nom} : prime de service de ${euros(gain)} pour l'aéroport${pret ? '' : ' (réduite : le poste a déjà rapporté récemment)'}.`, 'bon');
    return { gain, pret, xp, precision, suivante:A.t + DELAI_PRIME };
  }

  /* ---------- Migration : l'ancien terminal (5 rangées, constructions libres) devient Départs + Arrivées sur 2 rangées ---------- */
  function versZones(P, A){
    const T = A.terminal; if(T.zones) return;
    const arrTypes = ['tapis', 'douane'], arr = T.modules.filter(m => arrTypes.includes(m.type)), dep = T.modules.filter(m => !arrTypes.includes(m.type));
    const cd = Math.max(T.l, Math.ceil(dep.length / 2)), ca = Math.max(2, Math.ceil(arr.length / 2));
    // les constructions côté ville (enregistrement, contrôles) sur la rangée 0, les autres sur la rangée 1 ; ce qui déborde prend une place libre
    const occ = new Set(), poser = (m, x0, x1, ordre) => { for(const y of ordre) for(let x = x0; x < x1; x++) if(!occ.has(x + ':' + y)){ occ.add(x + ':' + y); m.x = x; m.y = y; return; } };
    const neufs = []; const nouveau = m => { const o = { ...m, x:0, y:0, niv:m.niv || 1, rot:0 }; neufs.push(o); return o; };
    for(const m of dep.filter(m => MODULES[m.type].zone === 'ville')) poser(nouveau(m), 0, cd, [0, 1]);
    for(const m of dep.filter(m => MODULES[m.type].zone !== 'ville')) poser(nouveau(m), 0, cd, [1, 0]);
    for(const m of arr.filter(m => m.type === 'douane')) poser(nouveau(m), cd, cd + ca, [1, 0]);
    for(const m of arr.filter(m => m.type === 'tapis')) poser(nouveau(m), cd, cd + ca, [0, 1]);
    // les petits objets : sur les petites cases libres (de la zone Départs, côté pistes d'abord)
    const libres = []; for(const y of [3, 2, 1, 0]) for(let x = 0; x < (cd + ca) * 2; x++) if(!occ.has(Math.floor(x / 2) + ':' + Math.floor(y / 2))) libres.push([x, y]);
    const petits = []; let k = 0;
    for(const q of T.petits || []){ if(k < libres.length){ petits.push({ x:libres[k][0], y:libres[k][1], type:q.type, rot:0 }); k++; } else if(PETITS[q.type]) P.argent += PETITS[q.type].prix; }
    T.modules = neufs; T.petits = petits; T.l = cd + ca; T.la = ca; T.h = 2; T.zones = true;
  }

  /* ---------- Migration : le hall (rangée 0) et les commerces (rangées 1 à 3) ---------- */
  function versRangees(P, A){
    const T = A.terminal; if(T.v === 4) return;
    T.cr = T.cr || 0; T.v = 4;
    const mauvais = T.modules.filter(m => !zoneOk(A, m.type, m.x, m.y));
    T.modules = T.modules.filter(m => !mauvais.includes(m));
    for(const m of mauvais){
      let place = null;
      for(let essai = 0; essai < 4 && !place; essai++){
        let meilleur = null, dm = 1e9;
        for(let x = 0; x < T.l; x++) for(let y = 0; y < T.h; y++){
          if(!zoneOk(A, m.type, x, y) || T.modules.some(o => o.x === x && o.y === y) || petitsDansCase(A, x, y).length) continue;
          const d = Math.abs(x - m.x) + Math.abs(y - m.y); if(d < dm){ dm = d; meilleur = [x, y]; }
        }
        if(meilleur) place = meilleur; else if(MODULES[m.type].zones.includes('dep')) insererColonne(A, colsDep(A), 1); else { T.l++; T.la++; }
      }
      if(place){ m.x = place[0]; m.y = place[1]; T.modules.push(m); } else P.argent += Math.round(MODULES[m.type].prix * .5);
    }
  }
  /* ---------- Migration : de 2 à 4 rangées carrées, petits objets sur la grille 8 × 8 ---------- */
  function versGrille(P, A){
    const T = A.terminal; if(T.v >= 3) return;
    const D = AEROPORTS[A.id];
    T.extra = Math.max(0, colsDep(A) - (D.terminal.l - D.terminal.la), Math.ceil((A.portes.length - D.portes.length) / 2));       // les portes déjà permises
    T.h = 4;                                                                  // deux rangées de plus, côté pistes : rien ne bouge
    const vieux = T.petits || []; T.petits = []; T.v = 3;
    for(const q of vieux){
      const px = q.x * 4 + 2, py = q.y * 4 + 2, N = PETIT_DIV; let meilleur = null, dm = 1e9;
      for(let x = Math.max(0, px - 12); x <= Math.min(T.l * N - 1, px + 12); x++) for(let y = Math.max(0, py - 12); y <= Math.min(T.h * N - 1, py + 12); y++){
        const d = (x - px) ** 2 + (y - py) ** 2; if(d < dm && !libreQuart(A, x, y)){ dm = d; meilleur = [x, y]; }
      }
      if(meilleur) T.petits.push({ x:meilleur[0], y:meilleur[1], type:q.type, rot:q.rot || 0 }); else if(PETITS[q.type]) P.argent += PETITS[q.type].prix;
    }
  }
  // la migration d'une sauvegarde (rien pour l'instant) et le résumé pour l'accueil et les classements
  function migrer(P){
    if(!P || P.v !== 1) return null;
    // les parties d'avant la cuve à carburant et les factures de services
    for(const A of Object.values(P.aeroports)){ if(!A.carbu) A.carbu = nouvelleCuve(A.id); const J = A.jourStats; if(J.ventes == null) J.ventes = 0; if(J.immo == null) J.immo = 0; if(J.services == null) Object.assign(J, { services:0, detail:{}, achats:0, litres:0 }); }
    // les terminaux d'avant les zones Départs / Arrivées : chaque construction est rangée dans sa zone, gratuitement
    for(const A of Object.values(P.aeroports)){ if(!A.terminal.petits) A.terminal.petits = []; versZones(P, A); versGrille(P, A); versRangees(P, A); ajusterFacade(A, true); }
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
    tailleMaxDe, pisteLongueur, peutAllonger, prochaineTaille, prixAllonger, allongerPiste, NIV_ALLONGER, TAUX_BASE, NOM_TAUX, TAUX_MIN, TAUX_MAX, tauxDe, volumeVentes, penaliteTaux, reglerTaux, CATS, compta, comptes, portesMax, terminalMax, arriveesMax, PETIT_DIV, colonnesPortes, colsFacade, ajusterFacade, erreurPose, etendreZone, versGrille, versRangees, colsRes, zoneCol, zoneCase, insererColonne, FAMILLES, IMMO, PARCELLES, acheterImmo, vendreImmo, colsDep, zoneDe, zoneOk, msgZone, NOM_ZONE, tourner, agrandirArrivees, prixArrivees, versZones, PISTES_MAX, prixPiste, nbPistes, acheterPiste, trajetDe, ECART_PISTES, HANGARS, SANS_HANGAR, hangarDe, aHangar, maxVehicules, nivMaxVehicule, construireHangar, hangarsOuvrables, ENTRETIEN, personnel, menage, propreteWC, avantSale, nbToilettes, vitesseSalissure, vitesseMenage, salete, embaucher, licencier, nouvellePartie, plan, surTrajet, capacites, avionsDisponibles, genererOffres, accepter, refuser, verifier, placer, placementAuto, deprogrammer, rompre, pas, VOLS_VISIBLES,
    PRIMES, DELAI_PRIME, etatPrime, primeControle, creneaux, tranchesLibres, NEGOS, chanceNego, negocier,
    acheterPorte, acheterPasserelle, agrandirPorte, acheterVehicule, ameliorerVehicule, construire, ameliorerModule, vendreModule, deplacerModule, agrandirTerminal,
    recevoir, aRecevoir, bonusCompagnie, debloquer, verifierObjectifs, migrer, PETITS, poserPetit, retirerPetit, deplacerPetit, libreQuart, petitsDansCase, CUVE, CUVE_MAX, CAMION, LIVRAISON, DELAI_CAMION, TARIFS, commanderCarbu, agrandirCuve, enRoute, capCuve, facture, resume, BANQUE, banque, dette, lettreNote, moyenneNet, plafond, tauxPret, emprunter, prixRachat, rembourser, echeances, intervalle, chevauche, MARGE, PISTE_Z, TAXI_Z, VOIE_P, FACADE_Z, SERVICE_Z, VITESSE_ROULAGE };
})();
