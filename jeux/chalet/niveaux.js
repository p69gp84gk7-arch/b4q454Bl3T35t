/* Chalet Crush : les 60 niveaux (6 mondes de 10).
   Chaque niveau se fabrique d'après son numéro : une forme de plateau, des obstacles (glace, neige, cerises), des objectifs et un nombre de coups.
   Les coups et les seuils d'étoiles viennent de CALIB : un petit robot a joué chaque niveau des dizaines de fois (outils/chalet-calibrer.cjs)
   pour que ce soit jouable sans être trop facile. Légende de la forme : # trou · . case · g glace · G double glace · n neige · N double neige · M triple neige · c cerise. */
window.CHALET_NIVEAUX = (() => {
  const MONDES = [
    { nom:'Le Village', ico:'🏘️', ciel:['#8CC8F2', '#DDF0FF'], sol:'#F4FAFF', accent:'#E8553E' },
    { nom:'La Forêt enneigée', ico:'🌲', ciel:['#7FB6E8', '#CFE6F7'], sol:'#E8F3F7', accent:'#2E8B57' },
    { nom:'Le Chalet', ico:'🏠', ciel:['#F2B880', '#FFE8C8'], sol:'#FFF4E6', accent:'#B5651D' },
    { nom:'Les Pistes', ico:'⛷️', ciel:['#6FA8F0', '#E4F0FF'], sol:'#F2F8FF', accent:'#2F6FDB' },
    { nom:'Le Sommet', ico:'🏔️', ciel:['#8E9BE8', '#E6E3FF'], sol:'#F4F1FF', accent:'#7B4FD3' },
    { nom:'La Grotte de cristal', ico:'💎', ciel:['#2B3A67', '#6F86C8'], sol:'#DCE6FF', accent:'#1CA6C9' },
  ];
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // Les formes : dedans(x, y) pour un plateau de 9 × 9
  const FORMES = {
    plein:(x, y) => true,
    coins:(x, y) => !((x < 2 || x > 6) && (y < 2 || y > 6)),
    losange:(x, y) => Math.abs(x - 4) + Math.abs(y - 4) <= 5,
    croix:(x, y) => Math.abs(x - 4) <= 2 || Math.abs(y - 4) <= 2,
    sablier:(x, y) => Math.abs(x - 4) <= Math.abs(y - 4) + 1,
    anneau:(x, y) => !(Math.abs(x - 4) <= 1 && Math.abs(y - 4) <= 1),
    colonnes:(x, y) => !((x === 2 || x === 6) && y >= 3 && y <= 5),
    escalier:(x, y) => x + y >= 2 && x + y <= 14,
    pointes:(x, y) => !((x === 0 || x === 8) && y % 2 === 1) && !((y === 0) && (x % 2 === 1)),
    ruche:(x, y) => !((x + y) % 5 === 0 && x > 0 && x < 8 && y > 0 && y < 8),
  };
  const GLACES = {
    bas:(x, y) => y >= 6, centre:(x, y) => Math.abs(x - 4) + Math.abs(y - 4) <= 2, bords:(x, y) => x === 0 || x === 8 || y === 0 || y === 8,
    damier:(x, y) => (x + y) % 2 === 0, colonnes:(x, y) => x % 2 === 0, tout:() => true, haut:(x, y) => y <= 2, croix:(x, y) => x === 4 || y === 4,
  };
  const NEIGES = {
    coins:[[1, 1], [7, 1], [1, 7], [7, 7]], barres:[[2, 3], [6, 3], [2, 5], [6, 5]], ligne:[[1, 4], [3, 4], [5, 4], [7, 4]], centre:[[4, 3], [3, 4], [5, 4], [4, 5]],
    rang:[[1, 2], [3, 2], [5, 2], [7, 2], [2, 6], [4, 6], [6, 6]], pairs:[[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]],
  };
  // Le programme de chaque niveau : [type, forme, glace, neige, nombre de cerises, couleurs]
  const T = (kind, forme = 'plein', glace = null, neige = null, cerises = 0, coul = 5, extra = {}) => ({ kind, forme, glace, neige, cerises, coul, ...extra });
  const PROGRAMME = [
    // Monde 1 : on apprend
    T('s', 'plein', null, null, 0, 4), T('s', 'plein', null, null, 0, 4), T('s', 'coins', null, null, 0, 4), T('c', 'plein', null, null, 0, 4, { aide:'Récupère des gourmandises : le compteur de chaque objectif te dit combien.' }), T('s', 'losange', null, null, 0, 5),
    T('g', 'plein', 'bas', null, 0, 5, { aide:'La glace se casse en jouant sur sa case. Casse toute la glace pour gagner.' }), T('c', 'coins', null, null, 0, 5), T('g', 'croix', 'centre', null, 0, 5), T('k', 'plein', null, null, 2, 5, { aide:'Fais descendre les cerises tout en bas du plateau en vidant les cases sous elles.' }), T('m', 'losange', 'centre', null, 0, 5),
    // Monde 2 : la neige arrive
    T('n', 'plein', null, 'coins', 0, 5, { aide:'Les blocs de neige ne bougent pas : casse-les en jouant à côté.' }), T('k', 'coins', null, null, 3, 5), T('c', 'croix', null, null, 0, 5), T('t', 'plein', 'bords', 'coins', 0, 5), T('x', 'losange', null, null, 3, 5),
    T('n', 'sablier', null, 'barres', 0, 5), T('g', 'anneau', 'damier', null, 0, 5), T('k', 'colonnes', null, 'ligne', 3, 5), T('c', 'plein', null, null, 0, 6), T('m', 'coins', 'haut', 'barres', 0, 5),
    // Monde 3 : le chalet
    T('g', 'plein', 'damier', null, 0, 5), T('n', 'croix', null, 'centre', 0, 5), T('k', 'sablier', null, null, 4, 5), T('t', 'losange', 'centre', 'rang', 0, 5), T('c', 'anneau', null, null, 0, 6),
    T('x', 'plein', 'bas', 'coins', 3, 5), T('g', 'escalier', 'tout', null, 0, 5), T('n', 'pointes', null, 'barres', 0, 5), T('k', 'ruche', null, 'ligne', 4, 5), T('m', 'croix', 'croix', 'centre', 0, 6),
    // Monde 4 : les pistes
    T('t', 'plein', 'colonnes', 'ligne', 0, 5), T('k', 'anneau', null, 'pairs', 4, 5), T('c', 'sablier', null, null, 0, 6), T('g', 'coins', 'tout', 'coins', 0, 5), T('x', 'colonnes', 'bords', 'barres', 4, 5),
    T('n', 'losange', null, 'rang', 0, 5), T('t', 'escalier', 'damier', 'pairs', 0, 5), T('k', 'plein', null, 'rang', 5, 5), T('g', 'ruche', 'tout', null, 0, 6), T('m', 'anneau', 'centre', 'pairs', 0, 6),
    // Monde 5 : le sommet
    T('x', 'croix', 'croix', 'centre', 4, 5), T('n', 'plein', null, 'rang', 0, 6), T('t', 'sablier', 'bas', 'pairs', 0, 6), T('k', 'pointes', null, 'ligne', 5, 5), T('g', 'plein', 'tout', 'coins', 0, 6),
    T('c', 'ruche', null, 'barres', 0, 6), T('x', 'losange', 'centre', 'rang', 5, 6), T('t', 'colonnes', 'colonnes', 'pairs', 0, 6), T('k', 'escalier', null, 'pairs', 5, 6), T('m', 'sablier', 'damier', 'ligne', 0, 6),
    // Monde 6 : la grotte de cristal
    T('t', 'plein', 'tout', 'rang', 0, 6), T('x', 'anneau', 'bords', 'pairs', 5, 6), T('n', 'ruche', null, 'rang', 0, 6), T('g', 'croix', 'tout', 'centre', 0, 6), T('k', 'plein', null, 'rang', 6, 6),
    T('t', 'losange', 'damier', 'pairs', 0, 6), T('x', 'sablier', 'bas', 'rang', 5, 6), T('m', 'pointes', 'tout', 'barres', 0, 6), T('t', 'colonnes', 'tout', 'rang', 0, 6), T('m', 'plein', 'tout', 'rang', 6, 6),
  ];
  // Adoucissements : cinq couleurs presque partout (six rend les alignements plus rares), des cerises en nombre raisonnable, de la glace à moitié du plateau
  PROGRAMME.forEach((P, i) => { if(i < 50 || P.kind === 'k') P.coul = 5; if(P.glace === 'tout' && i < 52) P.glace = 'damier'; if(P.cerises > (i < 50 ? 3 : 4)) P.cerises = i < 50 ? 3 : 4; });
  // Les niveaux mêlant cerises, glace et neige étaient trop durs pour le robot : on garde un seul obstacle de plus que les cerises
  PROGRAMME.forEach((P, i) => { if(P.kind === 'x') P.glace = null; if(P.kind === 'k' && i >= 40) P.neige = null; if(P.kind === 't' && i >= 40) P.neige = null; if(P.kind === 'g' && i >= 30 && P.glace !== 'centre') P.glace = i % 2 ? 'centre' : 'bas'; if(P.kind === 'n' && i >= 40) P.neige = 'barres'; });
  const DEFAUT = { coups:26, e2:0, e3:0 };
  // Les réglages mesurés par le robot : [coups, seuil 2 étoiles, seuil 3 étoiles, objectif de score] pour chaque niveau (CALIB_ICI)
  const CALIB = [];

  function construire(num){
    const P = PROGRAMME[num - 1], rnd = mulberry(num * 7919 + 17), cal = CALIB[num - 1];
    const dedans = FORMES[P.forme], H = 9, W = 9;
    const g = [];
    for(let y = 0; y < H; y++){ let l = ''; for(let x = 0; x < W; x++) l += dedans(x, y) ? '.' : '#'; g.push(l.split('')); }
    const pose = (x, y, ch) => { if(g[y] && g[y][x] && g[y][x] !== '#' && g[y][x] === '.') g[y][x] = ch; };
    if(P.glace){ const f = GLACES[P.glace]; for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(g[y][x] === '.' && f(x, y)) g[y][x] = (num > 40 && (x + y) % 3 === 0) || (num > 55 && f === GLACES.centre) ? 'G' : 'g'; }
    if(P.neige) for(const [x, y] of NEIGES[P.neige]) if(g[y][x] !== '#'){ g[y][x] = P.kind === 'n' && num > 14 ? 'N' : num > 45 ? 'N' : num > 30 && (x + y) % 2 ? 'N' : 'n'; }
    let cerisesDepart = 0;
    if(P.cerises){ const cols = []; for(let x = 0; x < W; x++) if(g[0][x] === '.') cols.push(x); const n = Math.min(P.kind === 'x' ? 1 : 2, P.cerises, cols.length); for(let i = 0; i < n; i++){ const k = Math.floor(rnd() * cols.length); g[0][cols.splice(k, 1)[0]] = 'c'; cerisesDepart++; } }
    const objectifs = {};
    const forme = g.map(l => l.join(''));
    const nbCases = forme.join('').split('').filter(c => c !== '#').length;
    const k = P.kind, base = 1500 + num * 260;
    if(k === 's' || k === 'm' || k === 't' || k === 'x') objectifs.score = Math.round(base * (k === 's' ? 1 : .6) / 100) * 100;
    if(k === 'c'){ const cs = P.coul >= 5 ? 2 : 1; objectifs.collecte = {}; const couleurs = [0, 1, 2, 3, 4, 5].slice(0, P.coul); for(let i = 0; i < cs; i++){ const c = couleurs.splice(Math.floor(rnd() * couleurs.length), 1)[0]; objectifs.collecte[c] = 10 + Math.floor(num / 8) * 2 + Math.floor(rnd() * 4); } }
    if(P.glace && (k === 'g' || k === 'm' || k === 't')) objectifs.glace = true;
    if(P.neige && (k === 'n' || k === 'm' || k === 't')) objectifs.neige = true;
    if(P.cerises && (k === 'k' || k === 'x' || k === 'm')) objectifs.cerises = P.cerises;
    if(k === 'm' && !objectifs.score && !objectifs.glace && !objectifs.neige && !objectifs.cerises) objectifs.score = Math.round(base * .6 / 100) * 100;
    if(k === 'm' && P.glace && !objectifs.score) objectifs.score = Math.round(base * .5 / 100) * 100;
    if(k === 'k' && P.neige) objectifs.neige = true;
    if(k === 'x' && P.glace) objectifs.glace = true;
    const monde = Math.floor((num - 1) / 10);
    const sc = objectifs.score || Math.round(base / 100) * 100;
    if(cal && cal[3] != null && objectifs.score != null) objectifs.score = cal[3];
    return {
      id:num, monde, pos:(num - 1) % 10, forme, couleurs:P.coul, coups:cal ? cal[0] : DEFAUT.coups + Math.floor(num / 4), objectifs, cerisesMax:P.kind === 'k' ? 2 : 1, aide:P.aide || null,
      etoiles:[objectifs.score || 0, cal ? cal[1] : Math.round(sc * 1.5 / 100) * 100, cal ? cal[2] : Math.round(sc * 2.1 / 100) * 100], nbCases, cerisesDepart,
    };
  }
  const NIVEAUX = PROGRAMME.map((_, i) => construire(i + 1));
  const rafraichir = () => { NIVEAUX.forEach((n, i) => { NIVEAUX[i] = construire(i + 1); }); };
  return { NIVEAUX, MONDES, PROGRAMME, construire, rafraichir, CALIB, FORMES, GLACES, NEIGES };
})();
