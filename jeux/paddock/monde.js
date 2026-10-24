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

  /* ---------- Les circuits : ceux de Draw Race, avec leur caractère ---------- */
  const PLUIE = { montagne:.32, foret:.3, sapins:.3, campagne:.28, fleuve:.26, lac:.24, japon:.3, parc:.2, collines:.15, ville:.18, mer:.14, prairie:.12, dunes:.2, nuit:.06, desert:.03, savane:.08, neige:.35 };
  function circuits(){ return (window.CIRCUITS || []).filter(c => !c.rallye); }
  function circuit(id){ return circuits().find(c => c.id === id); }

  /* ---------- Une nouvelle carrière ---------- */
  /* ---------- La personnalisation de l'écurie du joueur ---------- */
  const COULEURS = ['#E10600', '#FF8000', '#FFC906', '#1DCB3C', '#00A19C', '#2EA8E8', '#1434CB', '#1B2A5C', '#6A2CD8', '#FF87BC', '#F2F4F8', '#8A8F98', '#111111', '#7A3B12', '#00594F', '#C0A062'];
  const LOGOS = ['⭐', '🦅', '🐺', '⚡', '🔥', '🏔️', '🐉', '🦁', '❄️', '🚀', '🐎', '🦈', '🐝', '🍀', '👑', '🌪️', '🐻', '🦊', '🎯', '💥'];
  const courtDe = nom => (nom.replace(/^(équipe|écurie|team|scuderia|racing)\s+(des?\s+|du\s+|d'|l')?/i, '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'MOI');
  function personnaliser(C, perso){
    const E = C.ecuries[C.joueur];
    if(perso.nom && perso.nom.trim()){ E.nom = perso.nom.trim().slice(0, 28); E.court = courtDe(E.nom); }
    if(perso.c1) E.c1 = perso.c1; if(perso.c2) E.c2 = perso.c2; if(perso.logo) E.logo = perso.logo;
  }
  function nouvelleCarriere(idEcurie, directeur, perso = null){
    const C = { v:1, saison:2026, gp:0, directeur:directeur || 'Directeur', joueur:idEcurie, debut:Date.now(),
      ecuries:{}, pilotes:{}, personnel:{}, candidats:{}, projets:[], sponsors:[null, null, null], offres:[], messages:[],
      finances:[], historique:[], records:{ gp:0, victoires:0, podiums:0, poles:0, points:0, titresP:0, titresC:0, meilleurePlace:10 }, phase:'saison' };
    for(const e of ECURIES) C.ecuries[e.id] = { ...JSON.parse(JSON.stringify(e)), points:0, victoires:0, budgetDev:0 };
    for(const p of PILOTES){
      const [id, nom, drapeau, age, vitesse, regularite, pneus, depassement, pluie, salaire, potentiel] = p;
      const eq = ECURIES.find(e => e.pilotes.includes(id));
      C.pilotes[id] = { id, nom, drapeau, age, vitesse, regularite, pneus, depassement, pluie, salaire, potentiel, moral:70, ecurie:eq ? eq.id : null,
        fin:eq ? 2026 + Math.floor(Math.random() * 3) : null, points:0, carriere:{ gp:0, victoires:0, podiums:0, points:0, titres:0 } };
    }
    // les contrats des pilotes du joueur finissent tous à la fin de la première saison
    for(const id of C.ecuries[idEcurie].pilotes) C.pilotes[id].fin = 2026;
    const E = C.ecuries[idEcurie];
    if(perso) personnaliser(C, perso);
    C.argent = 30; C.reputation = E.prestige;
    C.personnel = { technique:employe(2), course:employe(2), mecanos:employe(2) };
    genererCandidats(C);
    C.objectif = objectifDirection(C);
    nouveauCalendrier(C);
    genererOffres(C);
    message(C, `Bienvenue chez ${E.nom}, ${C.directeur} ! La direction attend une ${C.objectif}e place au championnat des constructeurs. Commence par signer un sponsor principal.`);
    return C;
  }
  function message(C, txt, type = 'info'){ C.messages.unshift({ txt, type, saison:C.saison, gp:C.gp }); C.messages = C.messages.slice(0, 40); }
  const ecurieJoueur = C => C.ecuries[C.joueur];
  const pilotesDe = (C, id) => Object.values(C.pilotes).filter(p => p.ecurie === id);

  function nouveauCalendrier(C){
    const liste = circuits().slice().sort(() => Math.random() - .5).slice(0, 12);
    C.calendrier = liste.map(c => ({ id:c.id, nom:c.n, pluie:clamp((PLUIE[c.decor] ?? .15) + hasard(-.06, .06), 0, .6), resultat:null }));
  }
  function objectifDirection(C){
    // la place visée chez les constructeurs : un peu mieux que la place du budget
    const rang = Object.values(C.ecuries).sort((a, b) => b.budget - a.budget).findIndex(e => e.id === C.joueur) + 1;
    return clamp(rang - 1 - Math.floor(C.historique.length / 2), 1, 10);
  }

  /* ---------- La voiture ---------- */
  // poids du moteur et de l'aérodynamique selon le circuit (part des grandes lignes droites)
  function caractere(c){
    if(c._car) return c._car;
    let puissance = .35;
    try{
      const P = window.Piste, piste = P.construire(c), id = P.trajectoireIdeale(piste);
      const pts = P.resample(id, P.STEP, true), v = P.vitesses(pts, new Array(pts.length).fill(P.VMAX)).v;
      puissance = v.filter(x => x > P.VMAX * .93).length / v.length;
    }catch(e){}
    return c._car = { puissance, wM:.2 + puissance * .45, wA:.5 - puissance * .35, wC:.3 - puissance * .1 };
  }
  function perfVoiture(e, car = { wM:.33, wA:.37, wC:.3 }){ return e.moteur * car.wM + e.aero * car.wA + e.chassis * car.wC; }

  /* ---------- Les projets d'amélioration ---------- */
  const DOMAINES = { moteur:{ nom:'Moteur', ico:'⚙️', aide:'Vitesse dans les lignes droites' }, aero:{ nom:'Aérodynamique', ico:'🪽', aide:'Vitesse dans les virages' },
    chassis:{ nom:'Châssis', ico:'🏎️', aide:'Équilibre partout, usure des pneus' }, fiabilite:{ nom:'Fiabilité', ico:'🛠️', aide:'Moins de pannes et d\'abandons' } };
  function coutProjet(C, dom){
    const faits = C.projetsFaits ? (C.projetsFaits[dom] || 0) : 0;
    const e = ecurieJoueur(C), niv = e[dom];
    return arrondi(2.5 + faits * 1 + Math.max(0, niv - 80) * .18, 1);
  }
  const rendement = niv => clamp((99 - niv) / 13, .15, 1);
  function lancerProjet(C, dom){
    if(C.projets.some(p => p.dom === dom)) return { ok:false, msg:'Un projet est déjà en cours sur cette partie.' };
    const cout = coutProjet(C, dom);
    if(C.argent < cout) return { ok:false, msg:'Pas assez d\'argent.' };
    const t = C.personnel.technique.niv;
    const duree = t >= 4 ? 1 : 2;
    // plus la pièce est déjà bonne, plus il est dur de gagner encore
    const gain = arrondi(hasard(1.5, 3.2) * (.75 + .12 * t) * (dom === 'fiabilite' ? 1.6 : 1) * rendement(ecurieJoueur(C)[dom]), 1);
    C.argent = arrondi(C.argent - cout, 2);
    C.projets.push({ dom, gain, cout, fin:C.gp + duree, saison:C.saison });
    C.projetsFaits = C.projetsFaits || {}; C.projetsFaits[dom] = (C.projetsFaits[dom] || 0) + 1;
    C.finances.push({ saison:C.saison, gp:C.gp, txt:`Projet ${DOMAINES[dom].nom}`, montant:-cout });
    return { ok:true, msg:`Projet lancé : ${DOMAINES[dom].nom}, prêt dans ${duree} Grand Prix.` };
  }
  function terminerProjets(C){
    const e = ecurieJoueur(C);
    for(const p of C.projets.filter(p => C.gp >= p.fin)){
      e[p.dom] = arrondi(Math.min(99, e[p.dom] + p.gain), 1);
      message(C, `${DOMAINES[p.dom].ico} Nouvelle pièce prête : ${DOMAINES[p.dom].nom} +${String(p.gain).replace('.', ',')}.`, 'bon');
    }
    C.projets = C.projets.filter(p => C.gp < p.fin);
  }
  // les autres écuries progressent aussi, selon leur budget
  function developpementIA(C){
    for(const e of Object.values(C.ecuries)){
      if(e.id === C.joueur) continue;
      const k = e.budget / 140;
      for(const dom of ['moteur', 'aero', 'chassis', 'fiabilite']) if(Math.random() < .45) e[dom] = arrondi(Math.min(99, e[dom] + hasard(0, .8) * k * rendement(e[dom])), 1);
    }
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
      C.offres.push({ nom, ico, principal, parGP:arrondi(base * hasard(.85, 1.2), 2), objectif:o.id, txtObjectif:o.id === 'devant' ? `finir devant ${C.ecuries[rivale].nom}` : o.txt,
        bonus:arrondi(o.bonus * (principal ? 1.6 : 1) * (.6 + rep / 110), 2), rivale });
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
  // res.classement : [{ pilote, ecurie, place, abandon, raison, meilleurTour, arrets }], res.pole, res.meilleurTour
  function appliquerResultat(C, res){
    const E = ecurieJoueur(C), bilan = { points:0, argent:0, lignes:[] };
    const gpInfo = C.calendrier[C.gp];
    for(const r of res.classement){
      const p = C.pilotes[r.pilote], pts = !r.abandon && r.place <= 10 ? POINTS[r.place - 1] : 0;
      p.points += pts; C.ecuries[r.ecurie].points += pts; p.carriere.gp++; p.carriere.points += pts;
      if(r.place === 1 && !r.abandon){ p.carriere.victoires++; C.ecuries[r.ecurie].victoires++; }
      if(r.place <= 3 && !r.abandon) p.carriere.podiums++;
      if(r.ecurie === C.joueur){
        bilan.points += pts;
        // le moral : bon résultat, il monte ; abandon ou loin derrière, il baisse
        p.moral = clamp(p.moral + (r.abandon ? -6 : r.place <= 3 ? 8 : r.place <= 10 ? 3 : -2), 10, 100);
        if(!r.abandon && r.place === 1) C.records.victoires++;
        if(!r.abandon && r.place <= 3) C.records.podiums++;
        if(r.degats) { bilan.argent -= r.degats; bilan.lignes.push([`Réparations (${p.nom})`, -r.degats]); }
      }
    }
    if(res.pole && C.pilotes[res.pole] && C.pilotes[res.pole].ecurie === C.joueur) C.records.poles++;
    C.records.points += bilan.points; C.records.gp++;
    // les sponsors
    for(const s of C.sponsors.filter(Boolean)){
      bilan.argent += s.parGP; bilan.lignes.push([`${s.ico} ${s.nom}`, s.parGP]);
      if(objectifAtteint(C, s, res)){ bilan.argent += s.bonus; bilan.lignes.push([`${s.ico} Prime : ${s.txtObjectif}`, s.bonus]); }
    }
    // les salaires (un douzième de la saison)
    const salaires = arrondi((pilotesDe(C, C.joueur).reduce((t, p) => t + p.salaire, 0) + Object.values(C.personnel).reduce((t, e) => t + e.salaire, 0)) / 12, 2);
    bilan.argent -= salaires; bilan.lignes.push(['👷 Salaires (pilotes et personnel)', -salaires]);
    // le fonctionnement de l'usine
    bilan.argent -= .6; bilan.lignes.push(['🏭 Usine et transport', -.6]);
    bilan.argent = arrondi(bilan.argent, 2);
    C.argent = arrondi(C.argent + bilan.argent, 2);
    bilan.lignes.forEach(([txt, m]) => C.finances.push({ saison:C.saison, gp:C.gp, txt, montant:m }));
    C.finances = C.finances.slice(-160);
    // la réputation suit les résultats par rapport à l'objectif
    const place = classementConstructeurs(C).findIndex(e => e.id === C.joueur) + 1;
    C.reputation = clamp(C.reputation + (bilan.points >= 10 ? 2 : bilan.points > 0 ? 1 : 0) + (place <= C.objectif ? .5 : -.5), 10, 100);
    gpInfo.resultat = { classement:res.classement.map(r => ({ pilote:r.pilote, ecurie:r.ecurie, place:r.place, abandon:r.abandon })), pole:res.pole, meilleurTour:res.meilleurTour };
    C.gp++;
    terminerProjets(C);
    developpementIA(C);
    if(C.argent < 0) message(C, '⚠️ La caisse est dans le rouge ! Trouve des sponsors ou réduis les dépenses.', 'mal');
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
    const resume = { saison:C.saison, place, points:ecurieJoueur(C).points, prime, objectif:C.objectif, reussi, champion:champion ? champion.id : null, championEcurie:champion ? champion.ecurie : null, constructeur:cons[0].id, titreP, titreC,
      victoires:ecurieJoueur(C).victoires, classementC:cons.map(e => [e.id, e.points]), classementP:pil.slice(0, 10).map(p => [p.id, p.points]) };
    C.historique.push(resume);
    C.phase = 'mercato';
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
      const d = p.age < 26 ? hasard(.2, .45) * Math.max(0, p.potentiel - p.vitesse) : p.age < 33 ? hasard(-.8, .8) : -hasard(.4, 1.8);
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
    // nouveau règlement : les voitures se rapprochent un peu de la moyenne, les budgets suivent les résultats
    const cons = classementConstructeurs(C);
    for(const e of Object.values(C.ecuries)){
      for(const dom of ['moteur', 'aero', 'chassis', 'fiabilite']) e[dom] = arrondi(e[dom] + (86 - e[dom]) * .2, 1);
      const rang = cons.findIndex(x => x.id === e.id);
      if(e.id !== C.joueur) e.budget = clamp(Math.round(e.budget + (5 - rang) * 2 + hasard(-3, 3)), 60, 145);
      e.prestige = clamp(Math.round(e.prestige + (5 - rang) * 1.5), 20, 100);
      e.points = 0; e.victoires = 0;
    }
    C.gp = 0; C.projets = []; C.projetsFaits = {}; C.phase = 'saison';
    // les sponsors finissent avec la saison
    C.sponsors = [null, null, null];
    nouveauCalendrier(C); genererOffres(C); genererCandidats(C);
    C.objectif = objectifDirection(C);
    message(C, `Saison ${C.saison} : la direction vise une ${C.objectif}e place chez les constructeurs. Pense à signer de nouveaux sponsors !`);
    C.resumeSaison = null;
    return ancienne;
  }

  const NOMS_PILOTES = Object.fromEntries(PILOTES.map(p => [p[0], p[1]]));
  return { COULEURS, LOGOS, personnaliser, NOMS_PILOTES, ECURIES, PETITES, POSTES, DOMAINES, POINTS, PRIMES, nouvelleCarriere, circuits, circuit, caractere, perfVoiture, coutProjet, lancerProjet,
    genererOffres, signerSponsor, embaucher, appliquerResultat, classementPilotes, classementConstructeurs, finSaison, marche, demande, engager, prolonger,
    nouvelleSaison, noteGlobale, pilotesDe, ecurieJoueur, message, rivaleDe, objectifAtteint, arrondi };
})();
