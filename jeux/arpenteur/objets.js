/* Arpenteur : les objets à collectionner (deux albums), les raretés, les points, et la façon dont les pièces et les objets
   sont semés autour du joueur. Rien ici ne dépend de la page : ce fichier tourne aussi avec Node pour les essais.
   Le monde est découpé en cases d'environ 170 m de côté ; chaque case reçoit, chaque jour, ses pièces et parfois un objet,
   toujours aux mêmes endroits pour tout le monde ce jour-là (le tirage dépend de la case et de la date). */
window.ARPENTEUR_OBJETS = (() => {
  'use strict';
  const RARETES = {
    commun:{ nom:'Commun', coul:'#7C8A9E', pts:25, p:.6 },
    rare:{ nom:'Rare', coul:'#1B8FD6', pts:75, p:.28 },
    epique:{ nom:'Épique', coul:'#8E4FD8', pts:200, p:.1 },
    legendaire:{ nom:'Légendaire', coul:'#E09A00', pts:500, p:.02 },
  };
  const ORDRE_RARETES = ['commun', 'rare', 'epique', 'legendaire'];
  const ALBUMS = {
    nature:{ nom:'Nature et montagne', ico:'🏔️', objets:[
      { id:'quartz', nom:'Caillou de quartz', ico:'🪨', rar:'commun', desc:'Le quartz est l\'un des minéraux les plus répandus de l\'écorce terrestre : on le trouve dans le granite et le sable.' },
      { id:'pomme', nom:'Pomme de pin', ico:'🌰', rar:'commun', desc:'Ses écailles s\'ouvrent par temps sec pour libérer les graines, et se referment quand il pleut.' },
      { id:'plume', nom:'Plume de geai', ico:'🪶', rar:'commun', desc:'Le geai des chênes cache des milliers de glands chaque automne : ceux qu\'il oublie deviennent des arbres.' },
      { id:'trace', nom:'Empreinte de chevreuil', ico:'🐾', rar:'commun', desc:'Deux sabots pointus en forme de cœur : la trace du plus petit cervidé de nos forêts.' },
      { id:'champi', nom:'Cèpe', ico:'🍄', rar:'commun', desc:'Champignon des forêts, recherché par les cueilleurs. Ne jamais en manger sans l\'avoir fait vérifier !' },
      { id:'gentiane', nom:'Gentiane bleue', ico:'🌸', rar:'rare', desc:'Petite fleur d\'un bleu intense des prairies d\'altitude, protégée dans beaucoup de régions.' },
      { id:'cristal', nom:'Cristal de roche', ico:'💎', rar:'rare', desc:'Du quartz si pur qu\'il en est transparent. Les cristalliers des Alpes les cherchent dans les fentes des rochers.' },
      { id:'ammonite', nom:'Ammonite fossile', ico:'🐚', rar:'rare', desc:'Un mollusque marin disparu il y a 66 millions d\'années, en même temps que les dinosaures.' },
      { id:'flocon', nom:'Flocon parfait', ico:'❄️', rar:'rare', desc:'Chaque flocon a six branches : sa forme dépend de la température et de l\'humidité de l\'air où il a grandi.' },
      { id:'edelweiss', nom:'Edelweiss', ico:'⭐', rar:'epique', desc:'L\'« étoile des glaciers », couverte de poils blancs qui la protègent du froid et du soleil. Protégée : on ne la cueille pas.' },
      { id:'amethyste', nom:'Améthyste', ico:'🔮', rar:'epique', desc:'Un quartz violet, coloré par un peu de fer et par la radioactivité naturelle des roches.' },
      { id:'aigle', nom:'Plume d\'aigle royal', ico:'🦅', rar:'epique', desc:'L\'aigle royal a plus de deux mètres d\'envergure et repère un lièvre à deux kilomètres.' },
      { id:'apollon', nom:'Papillon Apollon', ico:'🦋', rar:'epique', desc:'Un papillon des montagnes aux taches rouges, devenu rare et protégé.' },
      { id:'mammouth', nom:'Dent de mammouth', ico:'🦣', rar:'legendaire', desc:'Les mammouths laineux vivaient en Europe pendant les glaciations ; leurs molaires pesaient plusieurs kilos.' },
      { id:'meteorite', nom:'Météorite', ico:'☄️', rar:'legendaire', desc:'Un morceau d\'astéroïde tombé du ciel, souvent riche en fer et en nickel, plus vieux que la Terre elle-même.' },
    ] },
    patrimoine:{ nom:'Trésors et patrimoine', ico:'🏛️', objets:[
      { id:'sou', nom:'Vieux sou', ico:'🪙', rar:'commun', desc:'Une pièce de cuivre usée par des milliers de mains, d\'avant l\'euro et même d\'avant le franc nouveau.' },
      { id:'cle', nom:'Clé ancienne', ico:'🗝️', rar:'commun', desc:'Une grosse clé de fer forgé, faite pour une serrure de porte de grange ou de coffre.' },
      { id:'postale', nom:'Carte postale ancienne', ico:'✉️', rar:'commun', desc:'Au début du XXe siècle, on s\'envoyait des millions de cartes postales : le courrier passait plusieurs fois par jour.' },
      { id:'bouton', nom:'Bouton d\'uniforme', ico:'🔘', rar:'commun', desc:'Un bouton de laiton frappé d\'un insigne : il raconte le métier ou le régiment de celui qui le portait.' },
      { id:'boussole', nom:'Boussole d\'explorateur', ico:'🧭', rar:'rare', desc:'Son aiguille aimantée montre le nord magnétique, un peu différent du nord géographique.' },
      { id:'carte', nom:'Carte au trésor', ico:'🗺️', rar:'rare', desc:'Une vieille carte annotée à la main. La croix rouge ne mène peut-être nulle part…' },
      { id:'blason', nom:'Blason', ico:'🛡️', rar:'rare', desc:'Les armoiries racontent une famille ou une ville avec des couleurs et des figures aux règles précises : l\'héraldique.' },
      { id:'piolet', nom:'Piolet en bois', ico:'⛏️', rar:'rare', desc:'Les premiers alpinistes grimpaient avec un piolet au long manche de frêne et des chaussures cloutées.' },
      { id:'lanterne', nom:'Lampe de mineur', ico:'🏮', rar:'rare', desc:'Avant l\'électricité, les mineurs s\'éclairaient à la flamme, au risque de faire exploser le grisou.' },
      { id:'amphore', nom:'Amphore romaine', ico:'🏺', rar:'epique', desc:'Les Romains y transportaient le vin, l\'huile et la sauce de poisson à travers toute la Méditerranée.' },
      { id:'longuevue', nom:'Longue-vue', ico:'🔭', rar:'epique', desc:'Une lunette de marin en laiton, qui se replie pour tenir dans la poche.' },
      { id:'gousset', nom:'Montre à gousset', ico:'⌚', rar:'epique', desc:'Avant la montre-bracelet, on la portait au bout d\'une chaîne, dans une petite poche du gilet.' },
      { id:'sceau', nom:'Sceau de cire', ico:'📜', rar:'epique', desc:'Un parchemin fermé par un sceau : on y appuyait une matrice gravée pour prouver qui l\'avait écrit.' },
      { id:'ducat', nom:'Ducat d\'or', ico:'💰', rar:'legendaire', desc:'Une pièce d\'or très pure, frappée à Venise pendant plus de cinq siècles.' },
      { id:'couronne', nom:'Couronne', ico:'👑', rar:'legendaire', desc:'Une couronne d\'orfèvre sertie de pierres : un trésor digne d\'un musée.' },
    ] },
  };
  const TOUS = {}; for(const [a, A] of Object.entries(ALBUMS)) for(const o of A.objets) TOUS[o.id] = { ...o, album:a };
  const NB_OBJETS = Object.keys(TOUS).length;

  /* ---------- Les points ---------- */
  const PTS = { metres:10, piece:10, nouveau:50, visite:50, tresorLieu:1 };   // 1 point tous les 10 m ; un objet jamais vu : +50
  const seuilNiveau = n => Math.round(300 * Math.pow(n - 1, 1.55));
  function niveauDe(pts){ let n = 1; while(pts >= seuilNiveau(n + 1)) n++; return n; }
  const TITRES = ['Promeneur', 'Randonneur', 'Éclaireur', 'Pisteur', 'Arpenteur', 'Cartographe', 'Explorateur', 'Grand explorateur', 'Légende des sentiers'];
  const titre = n => TITRES[Math.min(TITRES.length - 1, Math.floor((n - 1) / 3))];

  /* ---------- Le hasard qui dépend d'un nom (toujours le même tirage pour une case et un jour) ---------- */
  function hache(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function alea(seed){ let s = seed | 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function tirerRarete(r){ let u = r(); for(const k of ORDRE_RARETES){ if(u < RARETES[k].p) return k; u -= RARETES[k].p; } return 'commun'; }
  function tirerObjet(r, album){
    const rar = tirerRarete(r), l = (album ? ALBUMS[album].objets : Object.values(TOUS)).filter(o => o.rar === rar);
    return l[Math.floor(r() * l.length)].id;
  }

  /* ---------- Les cases et ce qu'elles contiennent ---------- */
  const PAS_LAT = .0015;                                              // environ 167 m
  const pasLon = iy => PAS_LAT / Math.max(.2, Math.cos((iy + .5) * PAS_LAT * Math.PI / 180));
  function caseDe(lat, lon){ const iy = Math.floor(lat / PAS_LAT); return { iy, ix:Math.floor(lon / pasLon(iy)) }; }
  // le contenu d'une case un jour donné : 2 à 4 pièces, et un objet une fois sur cinq environ
  function contenuCase(ix, iy, jour){
    const r = alea(hache(`${jour}:${ix}:${iy}`)), lat0 = iy * PAS_LAT, pl = pasLon(iy), lon0 = ix * pl, l = [];
    const point = () => ({ lat:lat0 + (.08 + r() * .84) * PAS_LAT, lon:lon0 + (.08 + r() * .84) * pl });
    const n = 2 + Math.floor(r() * 3);
    for(let k = 0; k < n; k++) l.push({ id:`${jour}:${ix}:${iy}:p${k}`, type:'piece', ...point() });
    if(r() < .22){ const o = tirerObjet(r); l.push({ id:`${jour}:${ix}:${iy}:o`, type:'objet', objet:o, ...point() }); }
    return l;
  }
  // tout ce qui est semé autour d'une position (rayon en mètres)
  function autour(lat, lon, rayon, jour){
    const c = caseDe(lat, lon), ny = Math.ceil(rayon / 167) + 1, l = [];
    for(let dy = -ny; dy <= ny; dy++){
      const iy = c.iy + dy, nx = Math.ceil(rayon / (167 * Math.max(.2, Math.cos(lat * Math.PI / 180)) * pasLon(iy) / PAS_LAT)) + 1;
      const ixc = Math.floor(lon / pasLon(iy));
      for(let dx = -nx; dx <= nx; dx++) for(const it of contenuCase(ixc + dx, iy, jour)) if(distance(lat, lon, it.lat, it.lon) <= rayon) l.push(it);
    }
    return l;
  }
  // le trésor d'un lieu Wikipédia (un objet du patrimoine, tous les jours, posé sur le lieu)
  function tresorLieu(lieu, jour){
    const r = alea(hache(`${jour}:lieu:${lieu.pageid}`));
    return { id:`${jour}:lieu:${lieu.pageid}`, type:'objet', objet:tirerObjet(r, 'patrimoine'), lat:lieu.lat + .00018, lon:lieu.lon + .00018, lieu:lieu.pageid };   // à 25 m du lieu (pour ne pas cacher son épingle)
  }

  /* ---------- La géographie ---------- */
  const R_TERRE = 6371000, rad = d => d * Math.PI / 180;
  function distance(a, b, c, d){ const dLat = rad(c - a), dLon = rad(d - b), h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2; return 2 * R_TERRE * Math.asin(Math.min(1, Math.sqrt(h))); }
  function cap(a, b, c, d){ const y = Math.sin(rad(d - b)) * Math.cos(rad(c)), x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b)); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
  // avancer de m mètres dans la direction cap (pour le mode essai)
  function deplacer(lat, lon, capDeg, m){ const dl = m / R_TERRE; return { lat:lat + Math.cos(rad(capDeg)) * dl * 180 / Math.PI, lon:lon + Math.sin(rad(capDeg)) * dl * 180 / Math.PI / Math.cos(rad(lat)) }; }
  const jourDe = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return { RARETES, ORDRE_RARETES, ALBUMS, TOUS, NB_OBJETS, PTS, seuilNiveau, niveauDe, titre, caseDe, contenuCase, autour, tresorLieu, distance, cap, deplacer, jourDe, hache, alea };
})();
