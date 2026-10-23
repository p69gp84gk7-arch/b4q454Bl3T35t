/* Les Aventures de Pépin : tous les dessins, en pixel art, fabriqués au chargement (aucune image à télécharger).
   Un dessin est une liste de lignes de caractères ; chaque caractère est une couleur de la palette ('.' : transparent).
   Tous les personnages et objets sont originaux (dans l'esprit des jeux de plateforme des années 80). */
window.PEPIN_SPRITES = (() => {
  // Une image à partir de lignes et d'une palette
  function art(lignes, pal){
    const h = lignes.length, w = Math.max(...lignes.map(l => l.length)), c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    lignes.forEach((l, y) => { for(let x = 0; x < l.length; x++){ const k = l[x]; if(k !== '.' && pal[k]){ g.fillStyle = pal[k]; g.fillRect(x, y, 1, 1); } } });
    return c;
  }
  // La même image, retournée (le personnage regarde à gauche)
  function miroir(img){
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0); return c;
  }
  // Une image à dessiner au pinceau (rectangles), pour les tuiles
  function peindre(w, h, f){ const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g, (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }); return c; }

  /* ---------- Pépin, le plombier-montagnard : bonnet rouge à pompon, moustache, chemise jaune, salopette bleue ---------- */
  const PAL_PEPIN = {
    normal:{ R:'#D8282B', W:'#F4F1E8', S:'#F7B582', n:'#6B3A1E', K:'#20140E', Y:'#F2C230', B:'#2B57C9', U:'#F6E27A', N:'#7A4416' },
    feu:{ R:'#F4F1E8', W:'#E8392E', S:'#F7B582', n:'#6B3A1E', K:'#20140E', Y:'#E8392E', B:'#F4F1E8', U:'#F2C230', N:'#7A4416' },
    etoile1:{ R:'#1E8C3A', W:'#F2C230', S:'#F7B582', n:'#20140E', K:'#20140E', Y:'#F28C28', B:'#1E8C3A', U:'#F6E27A', N:'#20140E' },
    etoile2:{ R:'#F2C230', W:'#D8282B', S:'#FFD9B8', n:'#7A4416', K:'#20140E', Y:'#D8282B', B:'#20140E', U:'#F4F1E8', N:'#7A4416' },
  };
  const P_TETE = [
    '......WW........',
    '.....RRRRR......',
    '....RRRRRRR.....',
    '...RRRRRRRRR....',
    '...WWWWWWWWWW...',
    '...nnnSSKS......',
    '..nSnSSSKSSS....',
    '..nSnnSSSSKSSS..',
    '..nnSSSSKKKKK...',
    '....SSSSSSSS....',
  ];
  const P_CORPS = {
    debout:['....YYBYYBY.....', '..SYYYBBBBYYS...', '..SSYBBUBBUBSS..', '....BBBBBBBB....', '...BBBB..BBBB...', '..NNNN....NNNN..'],
    marche1:['....YYBYYBY.....', '...YYYBBBBYYS...', '..SSYBBUBBUBSS..', '...BBBBBBBBBNN..', '..NBBB....BBNN..', '..NNN...........'],
    marche2:['....YYBYYBY.....', '...SYYBBBBYYS...', '...SSBBUBBUBSS..', '.....BBBBBBB....', '.....BBBBBB.....', '....NNNNNNN.....'],
    marche3:['....YYBYYBY.....', '..SYYYBBBBYY....', '..SSBBBUBBUBS...', '..NNBBBBBBBB....', '..NNBB....BBBN..', '...........NNN..'],
    saut:['....YYBYYBYYSS..', '...YYYBBBBYYSS..', '..SSYBBUBBUB....', '..SSBBBBBBBBNN..', '....BBB...BBNN..', '...NNN..........'],
    derape:['...SYYBYYBY.....', '...SSYBBBBYY....', '....YBBUBBUB....', '...BBBBBBBBB....', '..NNBB...BBB....', '..NN.....NNN....'],
  };
  const P_MORT = [
    '.......WW.......', '......RRRR......', '....RRRRRRRR....', '...WWWWWWWWWW...', '..S.nSKSSKSn.S..', '..SSnSKSSKSnSS..', '..SS.SSSSSS.SS..',
    '..SS.KKKKKK.SS..', '..YY..SSSS..YY..', '..YYYYBYYBYYYY..', '...YYYBBBBYYY...', '....BBUBBUBB....', '....BBBBBBBB....', '...BBBB..BBBB...', '..NNNN....NNNN..', '................',
  ];
  // Grand Pépin (16 × 32)
  const G_TETE = [
    '.......WW.......', '......WWWW......', '.....RRRRRR.....', '....RRRRRRRR....', '...RRRRRRRRRR...', '...RRRRRRRRRR...', '..WWWWWWWWWWWW..',
    '...nnnnSSSKS....', '..nnSnSSSSKSS...', '..nSnnSSSSKSSSS.', '..nSnnSSSSSSKSS.', '..nnnSSSSKKKKKK.', '...nnSSSSSKKKK..', '....SSSSSSSS....',
  ];
  const G_CORPS = {
    debout:['....YYYBYYBY....', '...YYYYBYYBYY...', '..YYYYYBBBBYYY..', '.YYYYYBBBBBBYYY.', '.YYYYBBUBBUBBYY.', '.SSYYBBBBBBBBSS.', '.SSSBBBBBBBBBSS.', '.SS.BBBBBBBBB.S.', '....BBBBBBBBB...', '....BBBB.BBBB...'],
    marche:['....YYYBYYBY....', '...YYYYBYYBYY...', '..YYYYYBBBBYYY..', '..YYYYBBBBBBYY..', '..YYYBBUBBUBBS..', '..SSYBBBBBBBSS..', '..SSSBBBBBBBSS..', '....BBBBBBBBB...', '....BBBBBBBBB...', '....BBBB.BBBB...'],
    saut:['....YYYBYYBYSS..', '...YYYYBYYBYSS..', '..YYYYYBBBBYYS..', '.YYYYYBBBBBBY...', '.YYYYBBUBBUBB...', '.SSYYBBBBBBBB...', '.SSSBBBBBBBBB...', '.SS.BBBBBBBBB...', '....BBBBBBBBB...', '....BBBB.BBBB...'],
    derape:['...SYYYBYYBY....', '..SSYYYBYYBYY...', '..SSYYYBBBBYYY..', '...YYYBBBBBBYY..', '...YYBBUBBUBBY..', '....BBBBBBBBB...', '....BBBBBBBBB...', '....BBBBBBBBB...', '....BBBBBBBBB...', '....BBBB.BBBB...'],
  };
  const G_JAMBES = {
    debout:['....BBB...BBB...', '....BBB...BBB...', '....BBB...BBB...', '....BBB...BBB...', '...NNNN...NNNN..', '..NNNNN...NNNNN.', '..NNNNN...NNNNN.', '................'],
    marche1:['...BBB.....BBB..', '..BBB......BBB..', '..BBB.......BBB.', '.NNBB.......BBB.', '.NNN.......NNNN.', '...........NNNNN', '................', '................'],
    marche2:['.....BBBBBB.....', '.....BBBBB......', '.....BBBBB......', '......BBBB......', '.....NNNNN......', '....NNNNNN......', '....NNNNNN......', '................'],
    marche3:['....BBB..BBB....', '...BBB....BBB...', '..NBBB.....BBB..', '..NNB......BBB..', '..NN......NNNN..', '..........NNNNN.', '................', '................'],
    saut:['....BBB..BBBBB..', '...BBB.....BBNN.', '..BBB......BNNN.', '.NNBB.......NN..', '.NNN............', '................', '................', '................'],
    accroupi:['................', '................', '................', '................', '................', '................', '................', '................'],
  };
  const G_ACCROUPI = [
    '................', '................', '................', '................', '................', '................', '................', '................',
    '................', '................', '................', '................',
    '.......WW.......', '......RRRR......', '.....RRRRRR.....', '....RRRRRRRR....', '...WWWWWWWWWW...', '...nnnSSKS......', '..nSnSSSKSSS....', '..nSnnSSSSKSSS..', '..nnSSSSKKKKK...',
    '...YYYSSSSYYY...', '..YYYYBBBBYYYY..', '.SSYYBBUBBUBYSS.', '.SSBBBBBBBBBBSS.', '..BBBBBBBBBBBB..', '..BBBBB..BBBBB..', '.NNNNN....NNNNN.', '.NNNNN....NNNNN.', '................', '................', '................',
  ];
  function framesPepin(pal){
    const petit = {}, grand = {};
    for(const [k, c] of Object.entries(P_CORPS)) petit[k] = art([...P_TETE, ...c], pal);
    petit.mort = art(P_MORT, pal);
    const gc = (corps, jambes) => art([...G_TETE, ...G_CORPS[corps], ...G_JAMBES[jambes]], pal);
    grand.debout = gc('debout', 'debout'); grand.marche1 = gc('marche', 'marche1'); grand.marche2 = gc('marche', 'marche2'); grand.marche3 = gc('marche', 'marche3');
    grand.saut = gc('saut', 'saut'); grand.derape = gc('derape', 'marche2'); grand.accroupi = art(G_ACCROUPI, pal);
    const out = { petit:{}, grand:{} };
    for(const t of ['petit', 'grand']){ const src = t === 'petit' ? petit : grand; for(const [k, img] of Object.entries(src)) out[t][k] = { d:img, g:miroir(img) }; }
    return out;
  }
  const pepin = Object.fromEntries(Object.entries(PAL_PEPIN).map(([k, pal]) => [k, framesPepin(pal)]));

  /* ---------- Les ennemis ---------- */
  const PAL_ENN = { n:'#5A3418', N:'#9A6234', L:'#E8C89A', K:'#1A1010', W:'#FFFFFF', p:'#F2A0A8', G:'#7A7F86', g:'#4A4F56', V:'#2E8B3A', v:'#1C5E25', M:'#9B3FB0', m:'#5E1F6E', Y:'#F2C230', O:'#E8731E', B:'#2B3F9C', b:'#18245E', C:'#B8D4F0', c:'#6F93B8', R:'#D8282B', r:'#8E1418', S:'#D8E2EC' };
  const MARMOTTON = [
    ['................', '.....nnnnnn.....', '...nnNNNNNNnn...', '..nNNNNNNNNNNn..', '.nNKKNNNNNNKKNn.', '.nNWKNNNNNNKWNn.', 'nNNNNNNNNNNNNNNn', 'nNNNNNnKKnNNNNNn',
     'nNNNNNNWWNNNNNNn', '.nNNLLLLLLLLNNn.', '.nNLLLLLLLLLLNn.', '..nLLLLLLLLLLn..', '...nLLLLLLLLn...', '...nnnnnnnnnn...', '..KKKK....KKKK..', '..KKK......KKK..'],
    ['................', '.....nnnnnn.....', '...nnNNNNNNnn...', '..nNNNNNNNNNNn..', '.nNKKNNNNNNKKNn.', '.nNWKNNNNNNKWNn.', 'nNNNNNNNNNNNNNNn', 'nNNNNNnKKnNNNNNn',
     'nNNNNNNWWNNNNNNn', '.nNNLLLLLLLLNNn.', '.nNLLLLLLLLLLNn.', '..nLLLLLLLLLLn..', '...nLLLLLLLLn...', '...nnnnnnnnnn...', '...KKKK..KKKK...', '....KKK..KKK....'],
  ];
  const MARMOTTON_PLAT = ['................', '................', '................', '................', '................', '................', '................', '................',
    '................', '................', '..nnnnnnnnnnnn..', '.nNKKNNNNNNKKNn.', 'nNNNNNnKKnNNNNNn', 'nNLLLLLLLLLLLLNn', '.nnnnnnnnnnnnnn.', '.KKKK......KKKK.'];
  const HERISSON = [
    ['................', '....g.g.g.g.....', '...gGgGgGgGg....', '..gGGGGGGGGGg...', '.gGGGGGGGGGGGg..', 'gGGGGGGGGGGGGLL.', 'gGGGGGGGGGGGLLLL', 'gGGGGGGGGGGLKLLp', 'gGGGGGGGGGGLLLLL',
     '.gGGGGGGGGLLLLL.', '..gGGGGGGLLLLL..', '...LLLLLLLLLL...', '...LLLLLLLLL....', '....nn....nn....', '...nnn...nnn....', '................'],
    ['................', '....g.g.g.g.....', '...gGgGgGgGg....', '..gGGGGGGGGGg...', '.gGGGGGGGGGGGg..', 'gGGGGGGGGGGGGLL.', 'gGGGGGGGGGGGLLLL', 'gGGGGGGGGGGLKLLp', 'gGGGGGGGGGGLLLLL',
     '.gGGGGGGGGLLLLL.', '..gGGGGGGLLLLL..', '...LLLLLLLLLL...', '...LLLLLLLLL....', '.....nn..nn.....', '....nnn.nnn.....', '................'],
  ];
  const BOULE_PIQUANTE = ['......g.g.......', '...g.gGgGg.g....', '....gGGGGGGg....', '.g.gGGGGGGGGg.g.', '..gGGGGGGGGGGg..', '.gGGGGGGGGGGGGg.', 'gGGGGGGGGGGGGGGg', '.gGGGGGGGGGGGGg.',
    'gGGGGGGGGGGGGGGg', '.gGGGGGGGGGGGGg.', '..gGGGGGGGGGGg..', '.g.gGGGGGGGGg.g.', '....gGGGGGGg....', '...g.gGgGg.g....', '......g.g.......', '................'];
  const CHARDON = [
    ['....M.M.M.M.....', '...MmMmMmMmM....', '..MMMMMMMMMMMM..', '..MMKKMMMMKKMM..', '..mWWWWWWWWWWm..', '..m..........m..', '..mWWWWWWWWWWm..', '...mmmmmmmmmm...', '.......vV.......', '..VVV..vV..VVV..', '...VVVvVVvVVV...', '.....VVvVVV.....', '.......vV.......', '.......vV.......', '.......vV.......', '.......vV.......'],
    ['....M.M.M.M.....', '...MmMmMmMmM....', '..MMMMMMMMMMMM..', '..MMKKMMMMKKMM..', '..MMMMMMMMMMMM..', '..mWmWmWmWmWmm..', '...mmmmmmmmmm...', '.......vV.......', '.......vV.......', '..VVV..vV..VVV..', '...VVVvVVvVVV...', '.....VVvVVV.....', '.......vV.......', '.......vV.......', '.......vV.......', '.......vV.......'],
  ];
  const CHOUCAS = [
    ['................', '................', '...KK...........', '..KKKKK.........', '.KKKKKKK........', 'KKKKKKKKKK......', '...KKKKKKKKKKK..', '...KKKKKKKKKWKK.', '....KKKKKKKKKKYY', '.....KKKKKKKKYY.', '......KKKKKKK...', '.......R..R.....', '.......R..R.....', '................', '................', '................'],
    ['................', '................', '................', '................', '................', '................', '...KKKKKKKKKKK..', '...KKKKKKKKKWKK.', '..KKKKKKKKKKKKYY', '.KKKKKKKKKKKKYY.', 'KKKKKKKKKKKK....', '.KKKKK.R..R.....', '..KK...R..R.....', '................', '................', '................'],
  ];
  const SCARABEE = [
    ['................', '................', '.....bbbbbb.....', '...bbBBBBBBbb...', '..bBBCBBBBBBBb..', '.bBBCCBBBBBBBBb.', '.bBBBBBBBBBBBBb.', 'bBBBBBBbBBBBBBBb', 'bBBBBBBbBBBBBBBb', 'bBBBBBBbBBBBBKKb', '.bBBBBBbBBBBKWKb', '.bbbbbbbbbbbbKKK', '..K.K....K.K....', '..K.K....K.K....', '................', '................'],
    ['................', '................', '.....bbbbbb.....', '...bbBBBBBBbb...', '..bBBCBBBBBBBb..', '.bBBCCBBBBBBBBb.', '.bBBBBBBBBBBBBb.', 'bBBBBBBbBBBBBBBb', 'bBBBBBBbBBBBBBBb', 'bBBBBBBbBBBBBKKb', '.bBBBBBbBBBBKWKb', '.bbbbbbbbbbbbKKK', '...K.K..K.K.....', '...K.K..K.K.....', '................', '................'],
  ];
  const CARAPACE = ['................', '................', '................', '................', '.....bbbbbb.....', '...bbBBBBBBbb...', '..bBBCBBBBBBBb..', '.bBBCCBBBBBBBBb.', '.bBBBBBBBBBBBBb.', 'bBBBBBBbBBBBBBBb', 'bBBBBBBbBBBBBBBb', 'bBBBBBBbBBBBBBBb', '.bbbbbbbbbbbbbb.', '................', '................', '................'];
  const TRUITE = [
    ['................', '................', '................', '.........ppp....', '.......pCCCCpp..', '.c...pCCCCCCCKp.', '.cc.pCpCpCCCCCCp', '.cccCCCCCCCCCCCC', '.ccCpCpCpCCCCCCp', '.c...ppppppppp..', '........cc......', '................', '................', '................', '................', '................'],
    ['................', '................', '................', '.........ppp....', '.......pCCCCpp..', '.....pCCCCCCCKp.', 'cc..pCpCpCCCCCCp', '.cccCCCCCCCCCCCC', 'cc..CpCpCpCCCCCp', '.....ppppppppp..', '.......cc.......', '................', '................', '................', '................', '................'],
  ];
  const BOULE_NEIGE = ['................', '................', '.....cccccc.....', '...ccSSSSSScc...', '..cSSSSSSSSSSc..', '.cSSKKSSSSKKSSc.', '.cSSSKKSSKKSSSc.', 'cSSSKWKSSKWKSSSc', 'cSSSKKKSSKKKSSSc', 'cSSSSSSSSSSSSSSc', 'cSSSSKKKKKKSSSSc', '.cSSSSSSSSSSSSc.', '.cSSSSSSSSSSSSc.', '..ccSSSSSSSScc..', '....cccccccc....', '................'];
  const ennemis = {
    marmotton:MARMOTTON.map(l => art(l, PAL_ENN)), marmottonPlat:art(MARMOTTON_PLAT, PAL_ENN),
    herisson:HERISSON.map(l => art(l, PAL_ENN)), boule:art(BOULE_PIQUANTE, PAL_ENN),
    herissonRouge:HERISSON.map(l => art(l, { ...PAL_ENN, G:'#B8452E', g:'#7A2A18' })), bouleRouge:art(BOULE_PIQUANTE, { ...PAL_ENN, G:'#B8452E', g:'#7A2A18' }),
    chardon:CHARDON.map(l => art(l, PAL_ENN)), choucas:CHOUCAS.map(l => art(l, PAL_ENN)),
    scarabee:SCARABEE.map(l => art(l, PAL_ENN)), carapace:art(CARAPACE, PAL_ENN),
    truite:TRUITE.map(l => art(l, PAL_ENN)), bouleNeige:art(BOULE_NEIGE, PAL_ENN),
  };
  for(const k of ['marmotton', 'herisson', 'herissonRouge', 'choucas', 'scarabee', 'truite']) ennemis[k + 'G'] = ennemis[k].map(miroir);

  // Le Yéti, gardien des châteaux (32 × 32)
  const YETI = (bras) => [
    '..........SSSSSSSSSS............', '........SSSSSSSSSSSSSS..........', '.......SSSSSSSSSSSSSSSS.........', '......SSSSccccccccccSSSS........', '......SSSccCCCCCCCCccSSS........',
    '.....SSSccCKKCCCCKKCccSSS.......', '.....SSSccCWKCCCCWKCccSSS.......', '.....SSSccCCCCCCCCCCccSSS.......', '.....SSSScCCKKKKKKCCcSSSS.......', '.....SSSSScCKWWWWKCcSSSSS.......',
    '....SSSSSSSccccccccSSSSSSS......', '...SSSSSSSSSSSSSSSSSSSSSSSS.....', (bras ? '.SSSSSSSSSSSSSSSSSSSSSSSSSSSS...' : '..SSSSSSSSSSSSSSSSSSSSSSSSSS....'),
    (bras ? 'SSS.SSSSSSSSSSSSSSSSSSSSSS.SSS..' : '.SSSSSSSSSSSSSSSSSSSSSSSSSSSS...'), (bras ? 'SS..SSSSSSSSSSSSSSSSSSSSSS..SS..' : 'SSS.SSSSSSSSSSSSSSSSSSSSSS.SSS..'),
    'SS..SSSSSSSSSSSSSSSSSSSSSS..SS..', 'SS..SSSSSSSSSSSSSSSSSSSSSS..SS..', 'cc..SSSSSSSSSSSSSSSSSSSSSS..cc..', 'cc..SSSSSSSSSSSSSSSSSSSSSS..cc..', 'cc..SSSSSSSSSSSSSSSSSSSSSS..cc..',
    '....SSSSSSSSSSSSSSSSSSSSSS......', '....SSSSSSSSSSSSSSSSSSSSSS......', '....SSSSSSSSSSSSSSSSSSSSSS......', '.....SSSSSSSSSSSSSSSSSSSS.......', '.....SSSSSSSS....SSSSSSSS.......',
    '.....SSSSSSS......SSSSSSS.......', '.....SSSSSSS......SSSSSSS.......', '.....SSSSSSS......SSSSSSS.......', '....ccccccccc....ccccccccc......', '...cccccccccc....cccccccccc.....', '...cccccccccc....cccccccccc.....', '................................'];
  const yeti = [art(YETI(false), PAL_ENN), art(YETI(true), PAL_ENN)];
  ennemis.yeti = yeti; ennemis.yetiG = yeti.map(miroir);

  /* ---------- Les objets ---------- */
  const PAL_OBJ = { N:'#9A5A2A', n:'#5E3418', L:'#F0DDB0', l:'#C8A878', K:'#1A1010', W:'#FFFFFF', R:'#E0302A', r:'#901A14', V:'#3A9A3A', v:'#1E6A22', Y:'#FFD23A', y:'#E89A18', O:'#FF8A1E', C:'#BFE6FF', G:'#2EBE64', g:'#178A40' };
  const CEPE = ['................', '.....nnnnnn.....', '...nnNNNNNNnn...', '..nNNNNNNNNNNn..', '.nNNNNNNNNNNNNn.', '.nNNNNNNNNNNNNn.', 'nNNNNNNNNNNNNNNn', 'nnnnnnnnnnnnnnnn',
    '...lLLLLLLLLl...', '...lLLKLLKLLl...', '...lLLKLLKLLl...', '...lLLLLLLLLl...', '...lLLLLLLLLl...', '....lLLLLLLl....', '....llllllll....', '................'];
  const PIMENT = [['.......vv.......', '......vVVv......', '.....VVVVVV.....', '....rRRRRRRr....', '...rRRWRRRRRr...', '...rRWRRRRRRr...', '...rRRRRRRRRr...', '....rRRRRRRRr...',
    '....rRRRRRRr....', '.....rRRRRRr....', '.....rRRRRr.....', '......rRRRr.....', '......rRRr......', '.......rRr......', '........r.......', '................'],
  ['.......vv.......', '......vVVv......', '.....VVVVVV.....', '....yOOOOOOy....', '...yOOWOOOOOy...', '...yOOOOOOOOy...', '...yOOOOOOOOy...', '....yOOOOOOOy...',
    '....yOOOOOOy....', '.....yOOOOOy....', '.....yOOOOy.....', '......yOOOy.....', '......yOOy......', '.......yOy......', '........y.......', '................']];
  const ETOILE = ['.......Y........', '.......Y........', '......YYY.......', '......YYY.......', 'YYYYYYYYYYYYYY..', '.YYYYYYYYYYYYY..', '..YYYKYYKYYYY...', '...YYKYYKYYY....', '...YYYYYYYYY....',
    '..YYYYYYYYYYY...', '..YYYYY.YYYYY...', '.YYYY.....YYYY..', '.YYY.......YYY..', 'YY...........YY.', '................', '................'];
  const COEUR = ['................', '..GGGG....GGGG..', '.GGWWGG..GGGGGG.', 'GGWWGGGGGGGGGGGG', 'GGWGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGg', '.GGGGGGGGGGGGGg.',
    '..GGGGGGGGGGGg..', '...GGGGGGGGGg...', '....GGGGGGGg....', '.....GGGGGg.....', '......GGGg......', '.......Gg.......', '................', '................'];
  const objets = {
    cepe:art(CEPE, PAL_OBJ), piment:PIMENT.map(l => art(l, PAL_OBJ)),
    etoile:[art(ETOILE, PAL_OBJ), art(ETOILE, { ...PAL_OBJ, Y:'#FFF3B0' }), art(ETOILE, { ...PAL_OBJ, Y:'#9BE0FF' })],
    coeur:art(COEUR, PAL_OBJ),
  };
  // Les pièces qui tournent (4 images) ; la pièce posée dans le niveau brille doucement
  objets.piece = [6, 4, 2, 4].map(l => peindre(16, 16, (g, r) => { r(8 - l, 2, l * 2, 12, '#E89A18'); r(8 - l + 1, 3, Math.max(1, l * 2 - 2), 10, '#FFD23A'); if(l > 2) r(8 - 1, 5, 2, 6, '#FFF3B0'); }));
  objets.boule = [0, 1, 2, 3].map(k => peindre(8, 8, (g, r) => { r(2, 1, 4, 6, '#FF8A1E'); r(1, 2, 6, 4, '#FF8A1E'); r(3, 2, 2, 4, '#FFE14A'); r(k % 2 ? 2 : 3, k < 2 ? 2 : 4, 2, 2, '#FFFFFF'); }));
  objets.morceau = (c1, c2) => peindre(8, 8, (g, r) => { r(1, 1, 6, 6, c2); r(1, 1, 5, 5, c1); });

  /* ---------- Les tuiles (16 × 16) : une série de couleurs par décor ---------- */
  const THEMES = {
    plaine:{ ciel:'#6CB4FF', sol:['#5BB838', '#3E8C22', '#B5763A', '#8A5426', '#6A3E1A'], brique:['#C8682A', '#7A3A12', '#E89A60'], dur:['#C8682A', '#7A3A12', '#E8B080'], nuages:'#FFFFFF', colline:['#5CC04A', '#3E9A30'], buisson:['#6BD24A', '#3E9A30'], loin:'#9BCBFF' },
    nuit:{ ciel:'#14183A', sol:['#4A8C9A', '#2E5E6A', '#6E5A8A', '#4A3E62', '#2E2640'], brique:['#7A5AA8', '#3A2A5A', '#A68AD0'], dur:['#7A5AA8', '#3A2A5A', '#B8A0E0'], nuages:'#3A4280', colline:['#2E4E7A', '#1E3456'], buisson:['#3A6A8A', '#1E3E56'], loin:'#22285A', etoiles:true },
    neige:{ ciel:'#9ED4FF', sol:['#F4F8FF', '#B8CCE4', '#7A8EAA', '#5A6E8A', '#3E4E66'], brique:['#7AA8D8', '#3A5A86', '#B8D8F8'], dur:['#8AB0D8', '#3A5A86', '#DCEBFA'], nuages:'#FFFFFF', colline:['#E8F2FF', '#B8CCE4'], buisson:['#FFFFFF', '#B8CCE4'], loin:'#C4E2FF' },
    souterrain:{ ciel:'#000000', sol:['#3A7AB8', '#1E4A7A', '#3A7AB8', '#1E4A7A', '#123056'], brique:['#3A7AB8', '#123056', '#7AB4E8'], dur:['#3A7AB8', '#123056', '#8AC4F8'], nuages:'#000000' },
    glace:{ ciel:'#0A1A2E', sol:['#9EE0FF', '#4A9AC8', '#6AB4DC', '#3A7AA8', '#1E4A72'], brique:['#6AB4DC', '#1E4A72', '#C8F0FF'], dur:['#7AC4EC', '#1E4A72', '#E0F8FF'], nuages:'#0A1A2E' },
    lave:{ ciel:'#1A0606', sol:['#8A3A1A', '#4A1A0A', '#6A2A12', '#4A1A0A', '#2A0A04'], brique:['#9A4A2A', '#3A1206', '#D07A4A'], dur:['#7A3A2A', '#2A0A04', '#C06A4A'], nuages:'#1A0606' },
    chateau:{ ciel:'#000000', sol:['#9A9A9A', '#5A5A5A', '#9A9A9A', '#5A5A5A', '#3A3A3A'], brique:['#9A9A9A', '#3A3A3A', '#CACACA'], dur:['#9A9A9A', '#3A3A3A', '#D8D8D8'], nuages:'#000000' },
    eau:{ ciel:'#2A6AC8', sol:['#E8D8A8', '#B8A070', '#C8B888', '#A08858', '#7A6440'], brique:['#C8B888', '#7A6440', '#F0E0B8'], dur:['#C8B888', '#7A6440', '#F0E0B8'], nuages:'#2A6AC8' },
  };
  function tuilesTheme(T){
    const [herbe, herbeF, terre, terreF, terreN] = T.sol, [bq, bqF, bqC] = T.brique, [du, duF, duC] = T.dur;
    const t = {};
    // le sol : herbe (ou neige) sur le dessus, terre et cailloux dessous
    t.solHaut = peindre(16, 16, (g, r) => { r(0, 0, 16, 16, terre); r(0, 0, 16, 4, herbe); r(0, 4, 16, 1, herbeF); for(const [x, y] of [[2, 7], [9, 9], [5, 12], [12, 13], [13, 6]]) r(x, y, 2, 2, terreF); r(3, 4, 2, 2, herbe); r(10, 4, 3, 2, herbe); r(0, 15, 16, 1, terreN); });
    t.sol = peindre(16, 16, (g, r) => { r(0, 0, 16, 16, terre); for(const [x, y] of [[2, 2], [9, 4], [5, 9], [12, 11], [1, 13], [13, 1]]) r(x, y, 2, 2, terreF); r(7, 14, 3, 2, terreN); });
    t.brique = peindre(16, 16, (g, r) => { r(0, 0, 16, 16, bq); r(0, 0, 16, 1, bqC); for(const y of [3, 7, 11, 15]) r(0, y, 16, 1, bqF); for(const [x, y] of [[7, 0], [15, 0], [3, 4], [11, 4], [7, 8], [15, 8], [3, 12], [11, 12]]) r(x, y, 1, 3, bqF); });
    t.dur = peindre(16, 16, (g, r) => { r(0, 0, 16, 16, du); r(0, 0, 15, 1, duC); r(0, 0, 1, 15, duC); r(15, 0, 1, 16, duF); r(0, 15, 16, 1, duF); r(3, 3, 10, 10, du); r(3, 3, 10, 1, duF); r(3, 3, 1, 10, duF); r(12, 4, 1, 9, duC); r(4, 12, 9, 1, duC); });
    t.vide = peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#8A5A2A'); r(0, 0, 16, 1, '#C08850'); r(0, 0, 1, 16, '#C08850'); r(15, 0, 1, 16, '#4A2A10'); r(0, 15, 16, 1, '#4A2A10'); for(const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) r(x, y, 1, 1, '#4A2A10'); });
    return t;
  }
  // Le bloc mystère (doré, avec son point d'interrogation qui brille)
  const blocMystere = ['#FFD23A', '#FFE680', '#F2B830'].map(clair => peindre(16, 16, (g, r) => {
    r(0, 0, 16, 16, '#E89A18'); r(1, 1, 14, 14, clair); r(0, 15, 16, 1, '#7A4A08'); r(15, 0, 1, 16, '#7A4A08');
    for(const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) r(x, y, 1, 1, '#7A4A08');
    r(5, 3, 6, 2, '#9A5A0A'); r(10, 4, 2, 4, '#9A5A0A'); r(7, 7, 4, 2, '#9A5A0A'); r(7, 9, 2, 2, '#9A5A0A'); r(7, 12, 2, 2, '#9A5A0A');
    r(5, 3, 5, 1, '#FFF3B0');
  }));
  // Les tuyaux verts
  const tuyau = {
    hautG:peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#3EB83A'); r(0, 0, 16, 1, '#0E4A12'); r(0, 15, 16, 1, '#0E4A12'); r(0, 0, 1, 16, '#0E4A12'); r(3, 1, 3, 14, '#9AF07A'); r(8, 1, 2, 14, '#2E8A2A'); }),
    hautD:peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#3EB83A'); r(0, 0, 16, 1, '#0E4A12'); r(0, 15, 16, 1, '#0E4A12'); r(15, 0, 1, 16, '#0E4A12'); r(4, 1, 2, 14, '#2E8A2A'); r(9, 1, 5, 14, '#1E6A1E'); }),
    corpsG:peindre(16, 16, (g, r) => { r(2, 0, 14, 16, '#3EB83A'); r(2, 0, 1, 16, '#0E4A12'); r(5, 0, 3, 16, '#9AF07A'); r(10, 0, 2, 16, '#2E8A2A'); }),
    corpsD:peindre(16, 16, (g, r) => { r(0, 0, 14, 16, '#3EB83A'); r(13, 0, 1, 16, '#0E4A12'); r(2, 0, 2, 16, '#2E8A2A'); r(6, 0, 6, 16, '#1E6A1E'); }),
  };
  const autres = {
    nuage:peindre(16, 16, (g, r) => { r(0, 3, 16, 10, '#FFFFFF'); r(2, 1, 12, 14, '#FFFFFF'); r(1, 12, 14, 2, '#C8E0FF'); r(3, 3, 3, 2, '#FFFFFF'); }),
    pont:peindre(16, 16, (g, r) => { r(0, 0, 16, 5, '#E8A040'); r(0, 0, 16, 1, '#FFD080'); r(0, 4, 16, 1, '#8A4A10'); for(let x = 0; x < 16; x += 4) r(x, 5, 1, 4, '#C8C8C8'); }),
    chaine:peindre(16, 16, (g, r) => { for(let y = 0; y < 16; y += 4){ r(6 + (y % 8 ? 1 : 0), y, 3, 3, '#B8B8B8'); } }),
    sapinG:peindre(16, 16, (g, r) => { r(4, 0, 12, 16, '#2E9A3A'); r(2, 3, 2, 10, '#2E9A3A'); r(4, 0, 12, 2, '#6BD24A'); r(2, 3, 2, 2, '#6BD24A'); r(6, 6, 2, 2, '#1E6A28'); r(11, 10, 2, 2, '#1E6A28'); }),
    sapinM:peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#2E9A3A'); r(0, 0, 16, 2, '#6BD24A'); r(3, 7, 2, 2, '#1E6A28'); r(10, 4, 2, 2, '#1E6A28'); r(12, 11, 2, 2, '#1E6A28'); }),
    sapinD:peindre(16, 16, (g, r) => { r(0, 0, 12, 16, '#2E9A3A'); r(12, 3, 2, 10, '#2E9A3A'); r(0, 0, 12, 2, '#6BD24A'); r(12, 3, 2, 2, '#6BD24A'); r(5, 8, 2, 2, '#1E6A28'); }),
    tronc:peindre(16, 16, (g, r) => { r(5, 0, 6, 16, '#8A5A2A'); r(6, 0, 1, 16, '#B88050'); r(9, 0, 1, 16, '#5A3418'); }),
    glace:peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#9EE0FF'); r(0, 0, 16, 2, '#E8FAFF'); r(0, 14, 16, 2, '#4A9AC8'); r(3, 4, 2, 6, '#E8FAFF'); r(6, 3, 1, 3, '#E8FAFF'); }),
    mat:peindre(16, 16, (g, r) => { r(7, 0, 2, 16, '#3EB83A'); r(7, 0, 1, 16, '#9AF07A'); }),
    matHaut:peindre(16, 16, (g, r) => { r(7, 6, 2, 10, '#3EB83A'); r(4, 0, 8, 8, '#1E6A1E'); r(5, 1, 6, 6, '#3EB83A'); r(6, 2, 2, 2, '#9AF07A'); }),
    drapeau:peindre(16, 16, (g, r) => { r(0, 1, 16, 12, '#FFFFFF'); r(0, 1, 16, 1, '#C8C8C8'); r(3, 4, 10, 6, '#D8282B'); r(6, 3, 4, 8, '#D8282B'); r(7, 5, 2, 4, '#FFFFFF'); r(5, 6, 6, 2, '#FFFFFF'); }),
    lave:[0, 1].map(k => peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#C8280A'); r(0, 0, 16, 3, '#FF6A1A'); for(let x = 0; x < 16; x += 4) r((x + k * 2) % 16, 1, 2, 2, '#FFC83A'); r(3 + k * 5, 8, 3, 2, '#FF6A1A'); })),
    eauHaut:[0, 1].map(k => peindre(16, 16, (g, r) => { r(0, 4, 16, 12, 'rgba(40,110,220,.55)'); for(let x = 0; x < 16; x += 8) r((x + k * 4) % 16, 2, 4, 3, 'rgba(200,235,255,.8)'); })),
    corail:peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#E8D8A8'); r(1, 1, 14, 14, '#F0E2B8'); r(3, 3, 3, 3, '#C8A870'); r(10, 8, 3, 3, '#C8A870'); r(5, 11, 2, 2, '#C8A870'); }),
    algue:[0, 1].map(k => peindre(16, 16, (g, r) => { for(let y = 0; y < 16; y += 4) r(6 + ((y / 4 + k) % 2 ? 2 : -1), y, 3, 4, '#2EBE64'); })),
    canon:peindre(16, 16, (g, r) => { r(1, 2, 14, 14, '#2A2A3A'); r(0, 0, 16, 6, '#3A3A4E'); r(4, 1, 8, 4, '#0A0A14'); r(2, 8, 12, 2, '#5A5A72'); r(6, 11, 4, 3, '#C8C8D8'); }),
    canonPied:peindre(16, 16, (g, r) => { r(3, 0, 10, 16, '#2A2A3A'); r(4, 0, 2, 16, '#4A4A62'); }),
    pierre:peindre(16, 16, (g, r) => { r(0, 0, 16, 16, '#9A9A9A'); r(0, 0, 16, 1, '#CACACA'); r(0, 7, 16, 1, '#5A5A5A'); r(0, 15, 16, 1, '#5A5A5A'); r(7, 0, 1, 7, '#5A5A5A'); r(3, 8, 1, 7, '#5A5A5A'); r(11, 8, 1, 7, '#5A5A5A'); }),
    levier:[0, 1].map(k => peindre(16, 16, (g, r) => { r(2, 12, 12, 4, '#5A5A5A'); r(6, 10, 4, 2, '#8A8A8A'); g.strokeStyle = '#C8C8C8'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 11); g.lineTo(k ? 2 : 14, 2); g.stroke(); r(k ? 0 : 12, 0, 4, 4, '#E8392E'); })),
    cabine:peindre(32, 16, (g, r) => { r(0, 2, 32, 12, '#D8282B'); r(0, 2, 32, 2, '#F06A50'); r(3, 5, 7, 5, '#BFE6FF'); r(12, 5, 8, 5, '#BFE6FF'); r(22, 5, 7, 5, '#BFE6FF'); r(0, 13, 32, 3, '#5A2020'); r(15, 0, 2, 3, '#3A3A3A'); }),
    plateforme:peindre(16, 8, (g, r) => { r(0, 0, 16, 8, '#E8A040'); r(0, 0, 16, 2, '#FFD080'); r(0, 7, 16, 1, '#8A4A10'); r(3, 3, 2, 2, '#8A4A10'); r(11, 3, 2, 2, '#8A4A10'); }),
  };
  return { art, miroir, peindre, pepin, ennemis, objets, THEMES, tuilesTheme, blocMystere, tuyau, autres };
})();
