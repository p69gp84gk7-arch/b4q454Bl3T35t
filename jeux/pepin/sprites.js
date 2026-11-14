/* Les Aventures de Pépin : tous les dessins, en pixel art, fabriqués au chargement (aucune image à télécharger).
   Un dessin est une liste de lignes de caractères ; chaque caractère est une couleur de la palette ('.' : transparent).
   Tous les personnages et objets sont originaux (dans l'esprit des jeux de plateforme des années 80). */
window.PEPIN_SPRITES = (() => {
  /* Le style « dessin animé lisse » : chaque dessin est d'abord fait en petits pixels (c'est lui qui donne la taille et la forme),
     puis « lissé » : agrandi 4 fois en arrondissant les angles (algorithme EPX deux fois), adouci, entouré d'un fin contour sombre
     et éclairé d'un léger dégradé. Le moteur dessine la version lisse (propriété hi) à la taille du petit dessin.
     Les tuiles, elles, sont dessinées directement au pinceau (courbes et dégradés) en haute résolution. */
  const ECH = 4, PAD = 3;
  // agrandir par deux en arrondissant les diagonales (EPX / Scale2x)
  function epx(src, w, h){
    const W = w * 2, out = new Uint32Array(W * h * 2);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
      const P = src[y * w + x], A = y > 0 ? src[(y - 1) * w + x] : P, D = y < h - 1 ? src[(y + 1) * w + x] : P, C = x > 0 ? src[y * w + x - 1] : P, B = x < w - 1 ? src[y * w + x + 1] : P;
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if(C === A && C !== D && A !== B) p1 = A;
      if(A === B && A !== C && B !== D) p2 = B;
      if(D === C && D !== B && C !== A) p3 = C;
      if(B === D && B !== A && D !== C) p4 = D;
      const o = y * 2 * W + x * 2; out[o] = p1; out[o + 1] = p2; out[o + W] = p3; out[o + W + 1] = p4;
    }
    return out;
  }
  // un flou en boîte (deux passes) sur des couleurs « prémultipliées », puis un bord net : des contours arrondis et doux
  function adoucir(px, w, h){
    let r = new Float32Array(w * h * 4);
    for(let i = 0; i < w * h; i++){ const v = px[i], a = (v >>> 24) / 255; r[i * 4] = (v & 255) * a; r[i * 4 + 1] = ((v >>> 8) & 255) * a; r[i * 4 + 2] = ((v >>> 16) & 255) * a; r[i * 4 + 3] = a; }
    for(let passe = 0; passe < 2; passe++){
      const t = new Float32Array(r.length);
      for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0;
        for(let dy = -1; dy <= 1; dy++){ const yy = y + dy; if(yy < 0 || yy >= h) continue; for(let dx = -1; dx <= 1; dx++){ const xx = x + dx; if(xx < 0 || xx >= w) continue; const k = (yy * w + xx) * 4; s0 += r[k]; s1 += r[k + 1]; s2 += r[k + 2]; s3 += r[k + 3]; } }
        const k = (y * w + x) * 4; t[k] = s0 / 9; t[k + 1] = s1 / 9; t[k + 2] = s2 / 9; t[k + 3] = s3 / 9;
      }
      r = t;
    }
    const img = new ImageData(w, h);
    for(let i = 0; i < w * h; i++){
      const a = r[i * 4 + 3]; if(a < .02) continue;
      const k = 1 / a, e = Math.min(1, Math.max(0, (a - .32) / .36)), s = e * e * (3 - 2 * e);
      img.data[i * 4] = Math.min(255, r[i * 4] * k); img.data[i * 4 + 1] = Math.min(255, r[i * 4 + 1] * k); img.data[i * 4 + 2] = Math.min(255, r[i * 4 + 2] * k); img.data[i * 4 + 3] = Math.round(s * 255);
    }
    return img;
  }
  const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // la version lisse d'un petit dessin (avec contour et relief)
  function lisser(c, contour = true){
    const w = c.width, h = c.height, id = c.getContext('2d').getImageData(0, 0, w, h);
    let px = new Uint32Array(id.data.buffer.slice(0)), W = w, H = h;
    for(let k = 0; k < 2; k++){ px = epx(px, W, H); W *= 2; H *= 2; }
    const base = toile(W, H), bg = base.getContext('2d'); bg.putImageData(adoucir(px, W, H), 0, 0);
    // le relief : du clair en haut, du sombre en bas (seulement sur le dessin)
    bg.globalCompositeOperation = 'source-atop';
    const gr = bg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,.20)'); gr.addColorStop(.42, 'rgba(255,255,255,0)'); gr.addColorStop(.62, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,20,.20)');
    bg.fillStyle = gr; bg.fillRect(0, 0, W, H);
    const out = toile(W + PAD * 2, H + PAD * 2), og = out.getContext('2d');
    if(contour){
      const sil = toile(W, H), sg = sil.getContext('2d'); sg.drawImage(base, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgba(28,18,14,.92)'; sg.fillRect(0, 0, W, H);
      for(let k = 0; k < 12; k++){ const an = k / 12 * Math.PI * 2; og.drawImage(sil, PAD + Math.cos(an) * 2.4, PAD + Math.sin(an) * 2.4); }
    }
    og.drawImage(base, PAD, PAD);
    return out;
  }
  // Une image à partir de lignes et d'une palette
  function art(lignes, pal){
    const h = lignes.length, w = Math.max(...lignes.map(l => l.length)), c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    lignes.forEach((l, y) => { for(let x = 0; x < l.length; x++){ const k = l[x]; if(k !== '.' && pal[k]){ g.fillStyle = pal[k]; g.fillRect(x, y, 1, 1); } } });
    c.hi = lisser(c); c.pad = PAD / ECH;
    return c;
  }
  // La même image, retournée (le personnage regarde à gauche)
  function miroir(img){
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.translate(img.width, 0); g.scale(-1, 1); g.drawImage(img, 0, 0);
    if(img.hi){ const m = toile(img.hi.width, img.hi.height), mg = m.getContext('2d'); mg.translate(m.width, 0); mg.scale(-1, 1); mg.drawImage(img.hi, 0, 0); c.hi = m; c.pad = img.pad; }
    return c;
  }
  // Une petite image au pixel près (pièces, éclats…), lissée comme les personnages
  function peindre(w, h, f){ const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); f(g, (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }); c.hi = lisser(c); c.pad = PAD / ECH; return c; }
  // Une image dessinée au pinceau en haute résolution (tuiles, décors) : f(g) dessine dans un carré de w × h unités
  function vecteur(w, h, f){
    const c = toile(w, h), hi = toile(w * ECH, h * ECH), g = hi.getContext('2d'); g.scale(ECH, ECH); g.lineJoin = 'round'; g.lineCap = 'round'; f(g);
    c.hi = hi; c.pad = 0; return c;
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const degV = (g, y0, y1, ...cs) => { const d = g.createLinearGradient(0, y0, 0, y1); cs.forEach((c, i) => d.addColorStop(i / (cs.length - 1), c)); return d; };
  const degH = (g, x0, x1, ...cs) => { const d = g.createLinearGradient(x0, 0, x1, 0); cs.forEach((c, i) => d.addColorStop(i / (cs.length - 1), c)); return d; };
  // mélanger deux couleurs #RRGGBB
  const mel = (a, b, t) => { const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };

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
  const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), ry, 0, 0, Math.PI * 2); g.fill(); };
  objets.piece = [6.4, 4.4, 1.7, 4.4].map(rx => vecteur(16, 16, g => {
    g.fillStyle = 'rgba(255,225,110,.28)'; ell(g, 8, 8, rx + 1.8, 7.9);
    g.fillStyle = '#9A5408'; ell(g, 8, 8, rx + .7, 6.7);
    g.fillStyle = degH(g, 8 - rx, 8 + rx, '#FFF0A0', '#FFD23A', '#E89A18'); ell(g, 8, 8, rx, 6);
    if(rx > 2.8){ g.strokeStyle = '#E8A21C'; g.lineWidth = .9; g.beginPath(); g.ellipse(8, 8, Math.max(.5, rx - 1.8), 3.8, 0, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.75)'; ell(g, 8 - rx * .35, 5.2, rx * .22, 1.6); }
  }));
  objets.boule = [0, 1, 2, 3].map(k => vecteur(8, 8, g => {
    const r = 3.1 + (k % 2) * .45, d = g.createRadialGradient(4, 4, .3, 4, 4, r + 1); d.addColorStop(0, '#FFFBD0'); d.addColorStop(.45, '#FFC83A'); d.addColorStop(.8, '#FF6A1A'); d.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = d; g.beginPath(); g.arc(4, 4, r + 1, 0, 7); g.fill();
  }));
  const morceaux = {};
  objets.morceau = (c1, c2) => morceaux[c1 + c2] || (morceaux[c1 + c2] = vecteur(8, 8, g => { g.fillStyle = c2; rr(g, .6, .6, 6.8, 6.8, 1.6); g.fill(); g.fillStyle = c1; rr(g, 1.2, 1.2, 5, 4.6, 1.2); g.fill(); }));

  /* ---------- Les tuiles (16 × 16) : une série de couleurs par décor ---------- */
  // (ciel : le haut du ciel ; ciel2 : l'horizon, plus clair)
  const THEMES = {
    plaine:{ ciel:'#4FA3F0', ciel2:'#D2ECFF', sol:['#5BB838', '#3E8C22', '#B5763A', '#8A5426', '#6A3E1A'], brique:['#C8682A', '#7A3A12', '#E89A60'], dur:['#C8682A', '#7A3A12', '#E8B080'], nuages:'#FFFFFF', colline:['#5CC04A', '#3E9A30'], buisson:['#6BD24A', '#3E9A30'], loin:'#8FBDEB' },
    nuit:{ ciel:'#0E1236', ciel2:'#3A3E86', sol:['#4A8C9A', '#2E5E6A', '#6E5A8A', '#4A3E62', '#2E2640'], brique:['#7A5AA8', '#3A2A5A', '#A68AD0'], dur:['#7A5AA8', '#3A2A5A', '#B8A0E0'], nuages:'#3A4280', colline:['#2E4E7A', '#1E3456'], buisson:['#3A6A8A', '#1E3E56'], loin:'#242C66', etoiles:true },
    neige:{ ciel:'#86C8FF', ciel2:'#EAF6FF', sol:['#F4F8FF', '#B8CCE4', '#7A8EAA', '#5A6E8A', '#3E4E66'], brique:['#7AA8D8', '#3A5A86', '#B8D8F8'], dur:['#8AB0D8', '#3A5A86', '#DCEBFA'], nuages:'#FFFFFF', colline:['#E8F2FF', '#B8CCE4'], buisson:['#FFFFFF', '#B8CCE4'], loin:'#B6D6F4' },
    souterrain:{ ciel:'#04060E', ciel2:'#101A38', sol:['#3A7AB8', '#1E4A7A', '#3A7AB8', '#1E4A7A', '#123056'], brique:['#3A7AB8', '#123056', '#7AB4E8'], dur:['#3A7AB8', '#123056', '#8AC4F8'], nuages:'#000000', roche:'#16213F' },
    glace:{ ciel:'#06101E', ciel2:'#103A5C', sol:['#9EE0FF', '#4A9AC8', '#6AB4DC', '#3A7AA8', '#1E4A72'], brique:['#6AB4DC', '#1E4A72', '#C8F0FF'], dur:['#7AC4EC', '#1E4A72', '#E0F8FF'], nuages:'#0A1A2E', roche:'#12385A' },
    lave:{ ciel:'#160404', ciel2:'#6A1A08', sol:['#8A3A1A', '#4A1A0A', '#6A2A12', '#4A1A0A', '#2A0A04'], brique:['#9A4A2A', '#3A1206', '#D07A4A'], dur:['#7A3A2A', '#2A0A04', '#C06A4A'], nuages:'#1A0606', roche:'#3A0F06' },
    chateau:{ ciel:'#07070C', ciel2:'#242436', sol:['#9A9A9A', '#5A5A5A', '#9A9A9A', '#5A5A5A', '#3A3A3A'], brique:['#9A9A9A', '#3A3A3A', '#CACACA'], dur:['#9A9A9A', '#3A3A3A', '#D8D8D8'], nuages:'#000000', roche:'#1A1A28' },
    eau:{ ciel:'#2A6AC8', ciel2:'#6CB4F0', sol:['#E8D8A8', '#B8A070', '#C8B888', '#A08858', '#7A6440'], brique:['#C8B888', '#7A6440', '#F0E0B8'], dur:['#C8B888', '#7A6440', '#F0E0B8'], nuages:'#2A6AC8' },
  };
  const cailloux = (g, pts, c) => { g.fillStyle = c; for(const [x, y, r] of pts) ell(g, x, y, r * 1.25, r); };
  function tuilesTheme(T){
    const [herbe, herbeF, terre, terreF] = T.sol, [bq, bqF, bqC] = T.brique, [du, duF, duC] = T.dur;
    const t = {};
    const terreBase = g => { g.fillStyle = terre; g.fillRect(0, 0, 16, 16); g.fillStyle = degV(g, 0, 16, 'rgba(255,255,255,.06)', 'rgba(0,0,0,.14)'); g.fillRect(0, 0, 16, 16); cailloux(g, [[3.5, 10, 1.1], [11, 12, .9], [7, 14, 1.2], [13.5, 9.5, 1], [2.2, 14, .8]], terreF); cailloux(g, [[4.3, 9.4, .45], [7.6, 13.4, .5]], mel(terre, '#ffffff', .35)); };
    // le sol : de l'herbe (ou de la neige) qui retombe en touffes arrondies sur la terre
    t.solHaut = vecteur(16, 16, g => {
      terreBase(g);
      const bord = () => { g.beginPath(); g.moveTo(0, 0); g.lineTo(16, 0); g.lineTo(16, 4.4); for(let i = 3; i >= 0; i--) g.quadraticCurveTo(i * 4 + 2, 8.2, i * 4, 4.4); g.closePath(); };
      bord(); g.fillStyle = degV(g, 0, 7, mel(herbe, '#ffffff', .25), herbe); g.fill();
      g.strokeStyle = herbeF; g.lineWidth = .9; g.beginPath(); g.moveTo(16, 4.4); for(let i = 3; i >= 0; i--) g.quadraticCurveTo(i * 4 + 2, 8.2, i * 4, 4.4); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 0, 16, 1.2);
    });
    t.sol = vecteur(16, 16, terreBase);
    // un bloc en relief : contour sombre, dégradé, reflet
    const bloc = (g, c0, c1, c2, rayon = 2.6) => { g.fillStyle = c1; rr(g, .2, .2, 15.6, 15.6, rayon); g.fill(); g.fillStyle = degV(g, 0, 16, c0, c2); rr(g, 1, 1, 14, 14, rayon - .6); g.fill(); };
    t.brique = vecteur(16, 16, g => {
      bloc(g, bqC, bqF, bq);
      g.strokeStyle = 'rgba(0,0,0,.24)'; g.lineWidth = .8; g.beginPath(); g.moveTo(1, 5.6); g.lineTo(15, 5.6); g.moveTo(1, 10.4); g.lineTo(15, 10.4); g.moveTo(8, 1); g.lineTo(8, 5.6); g.moveTo(4, 5.6); g.lineTo(4, 10.4); g.moveTo(12, 5.6); g.lineTo(12, 10.4); g.moveTo(8, 10.4); g.lineTo(8, 15); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.32)'; rr(g, 1.6, 1.2, 12.8, 1.3, .65); g.fill();
    });
    t.dur = vecteur(16, 16, g => {
      bloc(g, duC, duF, du, 2.2);
      g.fillStyle = degV(g, 3, 13, mel(du, '#000000', .12), duC); rr(g, 3.2, 3.2, 9.6, 9.6, 1.6); g.fill();
      g.fillStyle = 'rgba(0,0,0,.25)'; for(const [x, y] of [[2.2, 2.2], [13.8, 2.2], [2.2, 13.8], [13.8, 13.8]]) ell(g, x, y, .6, .6);
      g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, 3.6, 3.6, 8.8, 1.1, .5); g.fill();
    });
    t.vide = vecteur(16, 16, g => {
      bloc(g, '#B08A5A', '#4A2A10', '#7A5430', 2.2);
      g.fillStyle = 'rgba(0,0,0,.28)'; for(const [x, y] of [[3, 3], [13, 3], [3, 13], [13, 13]]) ell(g, x, y, .7, .7);
    });
    return t;
  }
  // Le bloc mystère (doré, avec son point d'interrogation qui brille)
  const blocMystere = ['#FFD23A', '#FFE680', '#F2B830'].map(clair => vecteur(16, 16, g => {
    g.fillStyle = '#7A4A08'; rr(g, .2, .2, 15.6, 15.6, 2.6); g.fill();
    g.fillStyle = degV(g, 0, 16, mel(clair, '#ffffff', .45), clair, '#E89A18'); rr(g, 1, 1, 14, 14, 2); g.fill();
    g.fillStyle = 'rgba(122,74,8,.55)'; for(const [x, y] of [[2.8, 2.8], [13.2, 2.8], [2.8, 13.2], [13.2, 13.2]]) ell(g, x, y, .6, .6);
    g.font = '800 11px "Bricolage Grotesque", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#7A4A08'; g.fillText('?', 8.5, 12.4); g.fillStyle = '#FFFBE0'; g.fillText('?', 8, 11.8);
    g.fillStyle = 'rgba(255,255,255,.5)'; rr(g, 1.8, 1.4, 12.4, 1.3, .65); g.fill();
  }));
  // Les tuyaux verts : un chapeau large et un corps un peu plus étroit, coupés en deux moitiés de 16
  const moitie = (droite, f) => vecteur(16, 16, g => { g.translate(droite ? -16 : 0, 0); f(g); });
  const cheminTuyau = ['#B8F89A', '#6FE05A', '#3EB83A', '#1F8A2A', '#176A22'];
  const chapeau = g => {
    g.fillStyle = '#0E4A12'; rr(g, 0, 0, 32, 16, 3.4); g.fill();
    g.fillStyle = degH(g, 0, 32, ...cheminTuyau); rr(g, 1, 1, 30, 14, 2.6); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)'; rr(g, 4, 2.4, 2.4, 11.2, 1.2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(1.5, 13.2, 29, 1.6);
  };
  const corps = g => {
    g.fillStyle = degH(g, 2, 30, ...cheminTuyau); g.fillRect(2, 0, 28, 16);
    g.fillStyle = '#0E4A12'; g.fillRect(2, 0, 1, 16); g.fillRect(29, 0, 1, 16);
    g.fillStyle = 'rgba(255,255,255,.4)'; rr(g, 6, 0, 2.4, 16, 1.2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(3, 0, 26, 2);
  };
  const tuyau = { hautG:moitie(false, chapeau), hautD:moitie(true, chapeau), corpsG:moitie(false, corps), corpsD:moitie(true, corps) };
  const vague = (g, y0, amp, ph, x0 = 0, x1 = 16) => { g.moveTo(x0, y0 + Math.sin(ph) * amp); for(let x = x0; x <= x1; x += 1) g.lineTo(x, y0 + Math.sin(x / 16 * Math.PI * 2 + ph) * amp); };
  const autres = {
    nuage:vecteur(16, 16, g => {
      g.fillStyle = '#BCD6F2'; g.fillRect(0, 9, 16, 7); for(const [x, r] of [[3.5, 3.6], [11, 4]]) { g.beginPath(); g.arc(x, 4.2 + 3, r, 0, 7); g.fill(); }
      g.fillStyle = degV(g, 2, 15, '#FFFFFF', '#E4EEFF'); g.fillRect(0, 6, 16, 8.2); for(const [x, r] of [[4, 3.8], [11.5, 4.2]]){ g.beginPath(); g.arc(x, 6, r, 0, 7); g.fill(); }
    }),
    pont:vecteur(16, 16, g => {
      g.fillStyle = degV(g, 0, 5.4, '#FFD58A', '#F2A648', '#B8742A'); g.fillRect(0, 0, 16, 5.4); g.fillStyle = '#6A3A10'; g.fillRect(0, 5.2, 16, .9);
      g.fillStyle = 'rgba(106,58,16,.55)'; g.fillRect(7.7, 0, .7, 5.2); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, 0, 16, .8);
      g.strokeStyle = '#8A6A44'; g.lineWidth = .9; g.beginPath(); g.moveTo(2, 6); g.quadraticCurveTo(2, 9, 4, 10.5); g.moveTo(14, 6); g.quadraticCurveTo(14, 9, 12, 10.5); g.stroke();
    }),
    chaine:vecteur(16, 16, g => { g.strokeStyle = '#A8AEBA'; g.lineWidth = 1.3; for(let y = 2.2; y < 16; y += 4){ g.beginPath(); g.ellipse(8, y, (y % 8 < 4) ? 1.4 : .7, 1.9, 0, 0, 7); g.stroke(); } }),
    sapinG:vecteur(16, 16, g => { const f = () => { g.save(); g.beginPath(); g.rect(0, 0, 16, 16); g.clip(); rr(g, 2, 0, 30, 16, 7); }; f(); g.fillStyle = degV(g, 0, 16, '#8CEA64', '#3CAA48', '#26803A'); g.fill(); g.restore(); g.fillStyle = 'rgba(255,255,255,.3)'; g.save(); g.beginPath(); g.rect(0, 0, 16, 16); g.clip(); rr(g, 3.5, .6, 30, 2.2, 1.1); g.fill(); g.restore(); cailloux(g, [[7, 7, .9], [12, 11, 1], [10, 4.5, .7]], '#1E6A28'); }),
    sapinM:vecteur(16, 16, g => { g.fillStyle = degV(g, 0, 16, '#8CEA64', '#3CAA48', '#26803A'); g.fillRect(0, 0, 16, 16); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, .6, 16, 2); cailloux(g, [[4, 8, .9], [11, 5.5, .8], [13, 11.5, 1]], '#1E6A28'); }),
    sapinD:vecteur(16, 16, g => { g.save(); g.beginPath(); g.rect(0, 0, 16, 16); g.clip(); rr(g, -16, 0, 30, 16, 7); g.fillStyle = degV(g, 0, 16, '#8CEA64', '#3CAA48', '#26803A'); g.fill(); g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, -17.5, .6, 30, 2.2, 1.1); g.fill(); g.restore(); cailloux(g, [[6, 9, .9], [3, 5, .7]], '#1E6A28'); }),
    tronc:vecteur(16, 16, g => { g.fillStyle = degH(g, 4.5, 11.5, '#5A3418', '#B07842', '#6A3E1A'); g.fillRect(4.5, 0, 7, 16); g.strokeStyle = 'rgba(40,20,8,.35)'; g.lineWidth = .7; g.beginPath(); g.moveTo(7, 1); g.lineTo(7, 7); g.moveTo(9.4, 6); g.lineTo(9.4, 14); g.stroke(); }),
    glace:vecteur(16, 16, g => {
      g.fillStyle = '#2E78A8'; rr(g, .2, .2, 15.6, 15.6, 2.4); g.fill(); g.fillStyle = degV(g, 0, 16, '#D8F8FF', '#8CD6F4', '#58AAD6'); rr(g, 1, 1, 14, 14, 1.8); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(3, 3); g.lineTo(7.5, 3); g.lineTo(3, 9.5); g.closePath(); g.fill(); g.fillRect(9, 4, 1.4, 4);
    }),
    mat:vecteur(16, 16, g => { g.fillStyle = degH(g, 6.5, 9.5, '#B8F89A', '#3EB83A', '#1E6A1E'); g.fillRect(6.6, 0, 2.8, 16); }),
    matHaut:vecteur(16, 16, g => { g.fillStyle = degH(g, 6.5, 9.5, '#B8F89A', '#3EB83A', '#1E6A1E'); g.fillRect(6.6, 6, 2.8, 10); const d = g.createRadialGradient(7, 3.5, .5, 8, 4.5, 5); d.addColorStop(0, '#E8FFC8'); d.addColorStop(.5, '#4CC840'); d.addColorStop(1, '#1E6A1E'); g.fillStyle = d; g.beginPath(); g.arc(8, 4.5, 4.6, 0, 7); g.fill(); }),
    drapeau:vecteur(16, 16, g => {
      g.fillStyle = '#C8CED8'; g.beginPath(); g.moveTo(0, 1); g.lineTo(16, 1.8); g.lineTo(12.5, 6.6); g.lineTo(16, 11.4); g.lineTo(0, 12.5); g.closePath(); g.fill();
      g.fillStyle = degV(g, 1, 12.5, '#FFFFFF', '#E8EEF8'); g.beginPath(); g.moveTo(.4, 1.5); g.lineTo(15.2, 2.2); g.lineTo(11.9, 6.6); g.lineTo(15.2, 11); g.lineTo(.4, 12); g.closePath(); g.fill();
      g.fillStyle = '#D8282B'; g.beginPath(); g.moveTo(3, 10); g.lineTo(7, 3.8); g.lineTo(10, 8.2); g.lineTo(11.4, 10); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(6.1, 5.3); g.lineTo(7, 3.8); g.lineTo(7.9, 5.1); g.lineTo(7, 5.9); g.closePath(); g.fill();
    }),
    lave:[0, 1].map(k => vecteur(16, 16, g => {
      g.fillStyle = degV(g, 2, 16, '#FF8A22', '#E03A0E', '#8A1404'); g.fillRect(0, 2, 16, 14);
      g.beginPath(); vague(g, 2.4, 1, k * Math.PI); g.lineTo(16, 7); g.lineTo(0, 7); g.closePath(); g.fillStyle = '#FFC83A'; g.fill();
      g.fillStyle = 'rgba(255,226,120,.85)'; for(const [x, y, r] of [[3 + k * 5, 9, 1.3], [11 - k * 4, 12, 1.1], [7.5, 5.8, .9]]) ell(g, x, y, r, r);
    })),
    eauHaut:[0, 1].map(k => vecteur(16, 16, g => {
      g.beginPath(); vague(g, 4.2, .9, k * Math.PI); g.lineTo(16, 16); g.lineTo(0, 16); g.closePath(); g.fillStyle = degV(g, 3, 16, 'rgba(90,170,255,.6)', 'rgba(30,90,200,.6)'); g.fill();
      g.strokeStyle = 'rgba(220,245,255,.95)'; g.lineWidth = 1; g.beginPath(); vague(g, 4.2, .9, k * Math.PI); g.stroke();
    })),
    corail:vecteur(16, 16, g => {
      g.fillStyle = '#9A7A48'; rr(g, .2, .2, 15.6, 15.6, 2.8); g.fill(); g.fillStyle = degV(g, 0, 16, '#FFF0C8', '#F0D8A0', '#D8B878'); rr(g, 1, 1, 14, 14, 2.2); g.fill();
      g.strokeStyle = '#E8826E'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(5, 13); g.lineTo(5, 7.5); g.moveTo(5, 10); g.lineTo(3.2, 8); g.moveTo(11, 13); g.lineTo(11, 6); g.moveTo(11, 9.5); g.lineTo(13, 7.5); g.stroke();
    }),
    algue:[0, 1].map(k => vecteur(16, 16, g => {
      g.strokeStyle = '#17803E'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 16); g.bezierCurveTo(8 + (k ? 4 : -4), 12, 8 + (k ? -4 : 4), 6, 8 + (k ? 2 : -2), 0); g.stroke();
      g.strokeStyle = '#3EDC84'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(7.4, 16); g.bezierCurveTo(7.4 + (k ? 4 : -4), 12, 7.4 + (k ? -4 : 4), 6, 7.4 + (k ? 2 : -2), 0); g.stroke();
    })),
    canon:vecteur(16, 16, g => {
      g.fillStyle = '#0E0E18'; rr(g, 0, 0, 16, 16, 3); g.fill(); g.fillStyle = degV(g, 0, 16, '#5A5A74', '#34344A', '#222232'); rr(g, .8, .8, 14.4, 14.4, 2.4); g.fill();
      g.fillStyle = '#0A0A12'; ell(g, 8, 6.4, 3.8, 3.8); g.fillStyle = '#2A2A3C'; ell(g, 8, 6.9, 2.6, 2.6); g.strokeStyle = '#8A8AA4'; g.lineWidth = .8; g.beginPath(); g.arc(8, 6.4, 3.9, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.3)'; rr(g, 1.6, 1.4, 12.8, 1.2, .6); g.fill(); g.fillStyle = '#C8C8D8'; rr(g, 6, 12, 4, 2, 1); g.fill();
    }),
    canonPied:vecteur(16, 16, g => { g.fillStyle = degH(g, 3, 13, '#1E1E2C', '#6A6A88', '#26263A'); g.fillRect(3, 0, 10, 16); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(4.4, 0, 1.4, 16); }),
    pierre:vecteur(16, 16, g => {
      g.fillStyle = degV(g, 0, 16, '#B4B4BC', '#9A9AA4'); g.fillRect(0, 0, 16, 16);
      g.strokeStyle = 'rgba(40,40,56,.55)'; g.lineWidth = .9; g.beginPath(); g.moveTo(0, 7.6); g.lineTo(16, 7.6); g.moveTo(0, 15.5); g.lineTo(16, 15.5); g.moveTo(7.6, 0); g.lineTo(7.6, 7.6); g.moveTo(3.5, 7.6); g.lineTo(3.5, 15.5); g.moveTo(11.5, 7.6); g.lineTo(11.5, 15.5); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, 16, 1); g.fillRect(0, 8.2, 16, .8);
    }),
    levier:[0, 1].map(k => vecteur(16, 16, g => {
      g.fillStyle = '#3E3E4A'; rr(g, 1.5, 11.5, 13, 4.5, 1.6); g.fill(); g.fillStyle = '#8A8A9A'; rr(g, 5.5, 9.5, 5, 3, 1); g.fill();
      g.strokeStyle = '#E4E4EC'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(8, 10.5); g.lineTo(k ? 2.4 : 13.6, 3); g.stroke();
      const d = g.createRadialGradient((k ? 2.4 : 13.6) - .8, 2.2, .3, k ? 2.4 : 13.6, 3, 3); d.addColorStop(0, '#FF9A8A'); d.addColorStop(1, '#C8281E'); g.fillStyle = d; g.beginPath(); g.arc(k ? 2.4 : 13.6, 3, 2.6, 0, 7); g.fill();
    })),
    cabine:vecteur(32, 16, g => {
      g.fillStyle = '#3A1414'; rr(g, .2, 1.2, 31.6, 14.4, 4); g.fill(); g.fillStyle = degV(g, 1, 16, '#FF7A5E', '#D8282B', '#9A1818'); rr(g, 1, 2, 30, 12.6, 3.4); g.fill();
      g.fillStyle = degV(g, 4.5, 10, '#E8F8FF', '#9ED0F2'); for(const x of [3.5, 12, 21.5]){ rr(g, x, 4.6, 7.2, 5.6, 1.6); g.fill(); }
      g.fillStyle = '#5A2020'; g.fillRect(1.5, 12.4, 29, 1.6); g.fillStyle = '#3A3A3A'; g.fillRect(15, 0, 2, 3);
    }),
    plateforme:vecteur(16, 8, g => {
      g.fillStyle = degV(g, 0, 8, '#FFD58A', '#F2A648', '#B8742A'); g.fillRect(0, 0, 16, 7.4); g.fillStyle = '#5A3010'; g.fillRect(0, 7, 16, 1);
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, 0, 16, 1.1); g.fillStyle = 'rgba(90,48,16,.7)'; ell(g, 3.2, 3.8, .8, .8); ell(g, 12.8, 3.8, .8, .8);
    }),
  };
  return { art, miroir, peindre, vecteur, rr, mel, ECH, pepin, ennemis, objets, THEMES, tuilesTheme, blocMystere, tuyau, autres };
})();
