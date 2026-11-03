/* Baroudeur : le monde (relief, régions, rivière, maisons abandonnées, pièces d'or, décor).
   La carte fait 1000 × 1000 m (de -500 à 500 en x et en z ; le nord est vers les z négatifs).
   Le relief est calculé une fois sur une grille de 4 m ; la voiture lit la même grille (mêmes triangles que l'affichage),
   pour que les roues touchent exactement le sol dessiné. Tout est tiré d'une graine fixe : le monde est toujours le même. */
window.BAROUDEUR_MONDE = (() => {
  'use strict';
  const TAILLE = 1000, DEMI = TAILLE / 2, N = 250, PAS = TAILLE / N, W = 4;   // W : le niveau de l'eau (m)
  const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  /* ---------- Le bruit (déterministe) ---------- */
  const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7 + 17.3) * 43758.5453; return s - Math.floor(s); };
  function bruit(x, z){
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return mix(mix(hash(i, j), hash(i + 1, j), u), mix(hash(i, j + 1), hash(i + 1, j + 1), u), v);
  }
  function fbm(x, z, oct = 4){ let s = 0, a = .5, t = 0; for(let o = 0; o < oct; o++){ s += a * bruit(x, z); t += a; x *= 2.03; z *= 2.03; a *= .5; } return s / t; }
  function crete(x, z){ let s = 0, a = .5, t = 0; for(let o = 0; o < 4; o++){ const n = 1 - Math.abs(2 * bruit(x, z) - 1); s += a * n * n; t += a; x *= 2.1; z *= 2.1; a *= .5; } return s / t; }
  // un tirage au hasard reproductible
  function graine(s){ return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- Les lignes : rivière, canyon, pistes ---------- */
  // distance d'un point à une ligne brisée, et l'abscisse le long de la ligne
  function distLigne(pts, x, z){
    let best = 1e9, s = 0, sBest = 0;
    for(let k = 0; k < pts.length - 1; k++){
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz, L = Math.sqrt(L2);
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t;
      const d = Math.hypot(x - px, z - pz);
      if(d < best){ best = d; sBest = s + t * L; }
      s += L;
    }
    return [best, sBest, s];
  }
  const RIVIERE = [[-40, -175], [-62, -110], [-95, -40], [-112, 10], [-125, 90], [-122, 170], [-150, 250], [-165, 310], [-195, 400], [-225, 520]];
  const GUES = [[-112, 10], [-165, 310]];                                  // les deux passages à gué (peu profonds)
  const LAC = { x:-40, z:-205, r:58 }, ILE = { x:-46, z:-212, r:13 };
  const CANYON = [[235, -30], [290, 60], [330, 130], [380, 200], [450, 240], [520, 250]];
  const MESA = { x:380, z:-40, r:44, h:38, rampe:Math.PI };                // la rampe monte depuis l'ouest
  const MESA2 = { x:440, z:-200, r:34, h:30, rampe:Math.PI / 2 };   // la rampe monte depuis le sud
  const BUTTES = [[160, 150, 30, 75], [-20, 115, 24, 62], [-380, -60, 34, 72], [60, -70, 10, 60], [-300, 160, 14, 60], [230, 400, 12, 60]];   // x, z, hauteur, rayon
  const CRATERE = { x:-415, z:380, r:46, p:16 };
  const SOMMETS = [[-220, -400, 70, 150], [100, -420, 95, 170], [300, -360, 60, 140], [-420, -300, 45, 120]];
  const GARAGE = { x:30, z:270 };
  const PISTES = [
    [[30, 270], [80, 320], [150, 420]],
    [[30, 270], [-20, 330], [-40, 380]],
    [[30, 270], [20, 180], [60, 60], [60, -40], [30, -120]],
    [[30, 270], [-40, 230], [-100, 120], [-112, 10], [-170, 40], [-240, 60], [-300, 0], [-340, -90]],
    [[-40, 230], [-120, 280], [-165, 310], [-220, 330], [-300, 250]],
    [[-165, 310], [-220, 420]],
    [[60, 60], [150, 60], [235, 120], [260, 260]],
    [[150, 60], [200, -40], [235, -30]],
    [[60, -40], [150, -150], [200, -260], [300, -260]],
    [[30, -120], [-80, -260], [-120, -300]],
  ];

  /* ---------- Les maisons abandonnées ----------
     n : difficulté (1 vert, 2 bleu, 3 rouge, 4 noir) ; style : ferme, cabane, chalet, ranch ; or : pièces d'or trouvées ;
     piece : une pièce rare du 4x4 (une seule fois) */
  const MAISONS = [
    { id:'m1', nom:'La ferme des Peupliers', x:95, z:330, n:1, style:'ferme', or:15 },
    { id:'m2', nom:'La grange du Pré-Haut', x:-45, z:390, n:1, style:'ferme', or:15 },
    { id:'m3', nom:'La maison du Belvédère', x:160, z:150, n:3, style:'ferme', or:45 },
    { id:'m4', nom:'Le moulin de la Butte', x:-20, z:115, n:2, style:'ferme', or:25, piece:'snorkel' },
    { id:'m5', nom:'La ferme du Carrefour', x:75, z:55, n:1, style:'ferme', or:15 },
    { id:'m6', nom:'La maison du Pêcheur', x:35, z:-135, n:1, style:'cabane', or:20 },
    { id:'m7', nom:'La cabane du Bûcheron', x:-240, z:75, n:2, style:'cabane', or:25 },
    { id:'m8', nom:'La scierie abandonnée', x:-300, z:250, n:2, style:'cabane', or:25, piece:'sable' },
    { id:'m9', nom:'La cabane du Guetteur', x:-380, z:-60, n:3, style:'cabane', or:45 },
    { id:'m10', nom:'La maison du Passeur', x:-215, z:425, n:1, style:'cabane', or:15 },
    { id:'m11', nom:'La cabane du Cratère', x:-415, z:380, n:3, style:'cabane', or:50 },
    { id:'m12', nom:'Le chalet du Vallon', x:-120, z:-300, n:2, style:'chalet', or:30 },
    { id:'m13', nom:'Le refuge des Neiges', x:95, z:-335, n:3, style:'chalet', or:40, piece:'v8' },
    { id:'m14', nom:'Le refuge du Sommet', x:100, z:-420, n:4, style:'chalet', or:150, tresor:true },
    { id:'m15', nom:'Le chalet des Crêtes', x:-250, z:-385, n:3, style:'chalet', or:50 },
    { id:'m16', nom:'Le chalet du Col', x:300, z:-262, n:2, style:'chalet', or:30 },
    { id:'m17', nom:"La maison de l'Île", x:ILE.x, z:ILE.z, n:3, style:'cabane', or:120, tresor:true },
    { id:'m18', nom:'Le ranch du Puits', x:255, z:262, n:1, style:'ranch', or:20 },
    { id:'m19', nom:'La mine du Canyon', x:330, z:130, n:3, style:'ranch', or:40, piece:'chaines' },
    { id:'m20', nom:'Le fort de la Mesa', x:MESA.x, z:MESA.z, n:4, style:'ranch', or:150, tresor:true },
    { id:'m21', nom:'Le ranch des Dunes', x:430, z:330, n:2, style:'ranch', or:35 },
    { id:'m22', nom:'La station des Cactus', x:440, z:-200, n:3, style:'ranch', or:45 },
    { id:'m23', nom:'La ferme du Bout du Monde', x:150, z:425, n:1, style:'ferme', or:15 },
    { id:'m24', nom:'La maison de la Rive', x:-75, z:220, n:2, style:'ferme', or:25 },
  ];
  // les pièces rares du 4x4 : ce qu'elles ouvrent
  const PIECES = {
    snorkel:{ nom:'Snorkel', ico:'🤿', desc:"Le moteur respire par le toit : tu peux traverser l'eau profonde (la rivière, le lac)." },
    sable:{ nom:'Pneus sable', ico:'🛞', desc:"De gros pneus larges : tu ne t'enfonces plus dans les dunes du désert." },
    chaines:{ nom:'Chaînes à neige', ico:'⛓️', desc:'Tu ne glisses plus sur la neige de la montagne.' },
    v8:{ nom:'Moteur V8', ico:'🔥', desc:'Beaucoup plus de puissance : les pentes les plus raides deviennent possibles.' },
  };

  /* ---------- Les objets qu'on trouve dans les maisons ----------
     u : ce qu'il répare (on l'utilise depuis le coffre) ; prix : ce qu'il rapporte au garage */
  const OBJETS = {
    jerrican:{ nom:"Jerrican d'essence", ico:'⛽', u:'essence', prix:6, desc:'20 litres d\'essence pour le réservoir.' },
    huile:{ nom:"Bidon d'huile", ico:'🛢️', u:'huile', prix:4, desc:'Remet de l\'huile dans le moteur.' },
    eau:{ nom:"Bidon d'eau", ico:'💧', u:'eau', prix:2, desc:'Remplit le radiateur.' },
    roue:{ nom:'Roue de secours', ico:'🛞', u:'roue', prix:8, desc:'Remplace une roue crevée.' },
    outils:{ nom:'Caisse à outils', ico:'🧰', u:'outils', prix:8, desc:'Répare la carrosserie et le moteur (+40 %).' },
    lampe:{ nom:'Lampe à pétrole', ico:'🏮', prix:6 }, radio:{ nom:'Vieille radio', ico:'📻', prix:9 }, plaque:{ nom:'Plaque émaillée', ico:'🪧', prix:10 },
    telephone:{ nom:'Téléphone à cadran', ico:'☎️', prix:12 }, montre:{ nom:'Montre à gousset', ico:'⌚', prix:16 }, photo:{ nom:'Appareil photo ancien', ico:'📷', prix:18 },
    musique:{ nom:'Boîte à musique', ico:'🎶', prix:22 }, tableau:{ nom:'Tableau ancien', ico:'🖼️', prix:28 }, statuette:{ nom:'Statuette en bronze', ico:'🗿', prix:34 },
    bijoux:{ nom:'Coffret à bijoux', ico:'💍', prix:48 },
  };
  const UTILES = ['jerrican', 'jerrican', 'huile', 'eau', 'eau', 'roue', 'outils'];
  const VALEURS = ['lampe', 'radio', 'plaque', 'telephone', 'montre', 'photo', 'musique', 'tableau', 'statuette', 'bijoux'];
  // les vieilles stations-service : un fond de cuve qui revient avec le temps
  const STATIONS = [
    { id:'s1', nom:'La station du Carrefour', x:118, z:72 }, { id:'s2', nom:'La station des Bois', x:-205, z:345 },
    { id:'s3', nom:'La station de la Route 66', x:228, z:98 }, { id:'s4', nom:'La station du Col', x:178, z:-226 },
  ];

  /* ---------- La hauteur du terrain ---------- */
  function regions(x, z){
    const m = lisse(-150, -300, z + 150 * (fbm(x * .012 + 40, 3.1, 3) - .5));              // la montagne au nord
    const f = lisse(-160, -250, x + 170 * (fbm(9.7, z * .012 + 20, 3) - .5)) * (1 - m);   // la forêt à l'ouest
    const d = lisse(185, 255, x + 150 * (fbm(1.3, z * .011 + 60, 3) - .5)) * (1 - m);     // le désert à l'est
    return { m, f, d, c:Math.max(0, 1 - m - f - d) };
  }
  function hauteurBrute(x, z){
    const R = regions(x, z);
    let h = 7 + 16 * fbm(x * .006 + 3, z * .006 + 7);
    h += 3 * (fbm(x * .03, z * .03, 2) - .5);
    // la montagne : des crêtes et des sommets
    if(R.m > 0){
      let hm = 6 + 62 * crete(x * .0055 + 11, z * .0055 + 5) * lisse(-150, -320, z);
      for(const [sx, sz, sh, sr] of SOMMETS){ const r = Math.hypot(x - sx, z - sz) / sr; if(r < 1) hm += sh * Math.pow(1 - r * r, 1.6); }
      h += R.m * hm;
    }
    if(R.f > 0) h += R.f * 9 * fbm(x * .012 + 2, z * .012 + 9, 3);
    if(R.d > 0){
      // le désert : un sol plat, des dunes vers l'est
      const dune = (Math.sin(x * .07 + Math.sin(z * .025) * 2.5) * .5 + .5) * 4 * lisse(270, 340, x) * fbm(x * .01, z * .01, 2) * 2;
      h = mix(h, 22 + dune + 3 * fbm(x * .008, z * .008, 2), R.d);
    }
    // les buttes
    for(const [bx, bz, bh, br] of BUTTES){ const r = Math.hypot(x - bx, z - bz) / br; if(r < 1) h += bh * (1 - lisse(0, 1, r)); }
    // les mesas (plateaux aux bords raides)
    for(const M of [MESA, MESA2]){
      const r = Math.hypot(x - M.x, z - M.z);
      let hm = M.h * (1 - lisse(M.r, M.r + 6, r));
      if(M.rampe !== undefined){
        const ang = Math.atan2(z - M.z, x - M.x); let da = Math.abs(ang - M.rampe); if(da > Math.PI) da = 2 * Math.PI - da;
        const lat = Math.abs(r * Math.sin(da));
        if(Math.cos(da) > 0 && lat < 8) hm = Math.max(hm, M.h * Math.max(0, Math.min(1, 1 - (r - M.r) / 52)) * (1 - lisse(6, 8, lat)));
      }
      if(r < M.r + 60) h = Math.max(h, 22 + hm);
    }
    // le canyon
    { const [d, s, L] = distLigne(CANYON, x, z); if(d < 22){ const prof = 18 * lisse(0, 60, s) * lisse(0, 50, L - s); h = Math.max(Math.min(h, W + 3.5), h - prof * (1 - lisse(6, 16, d))); } }
    // le cratère
    { const r = Math.hypot(x - CRATERE.x, z - CRATERE.z); if(r < CRATERE.r + 12) h = Math.max(Math.min(h, W + 3), h - CRATERE.p * (1 - lisse(CRATERE.r - 14, CRATERE.r + 4, r)) + 5 * Math.exp(-Math.pow((r - CRATERE.r - 2) / 6, 2))); }
    // le lac et son île
    { const r = Math.hypot(x - LAC.x, z - LAC.z); if(r < LAC.r + 25){ const fond = W - 1.5 - .4 * fbm(x * .05, z * .05, 2); h = mix(h, fond, 1 - lisse(LAC.r - 12, LAC.r + 10, r)); }
      const ri = Math.hypot(x - ILE.x, z - ILE.z); if(ri < ILE.r + 8) h = Math.max(h, mix(W + 2.5, h, lisse(ILE.r - 4, ILE.r + 6, ri))); }
    // la rivière : profonde, sauf aux deux gués
    { const [d] = distLigne(RIVIERE, x, z);
      if(d < 22){ let gue = 0; for(const [gx, gz] of GUES) gue = Math.max(gue, 1 - lisse(10, 22, Math.hypot(x - gx, z - gz)));
        const fond = W - mix(2.1, .45, gue); h = mix(h, Math.min(h, fond), 1 - lisse(6, 17, d)); } }
    // les bords de la carte remontent (on ne sort pas)
    const bord = Math.max(Math.abs(x), Math.abs(z)); h += lisse(440, 500, bord) * 45;
    return h;
  }

  /* ---------- La grille ---------- */
  const M1 = N + 1, H = new Float32Array(M1 * M1), SURF = new Uint8Array(M1 * M1);
  const X = i => -DEMI + i * PAS;
  for(let j = 0; j <= N; j++) for(let i = 0; i <= N; i++) H[j * M1 + i] = hauteurBrute(X(i), X(j));
  // les plateformes plates : les maisons et le garage
  function aplanir(x, z, r, r2){
    const h0 = (() => { let s = 0, n = 0; for(let a = 0; a < 8; a++){ s += hauteurGrille(x + Math.cos(a) * r * .5, z + Math.sin(a) * r * .5); n++; } return Math.max(W + 1.2, s / n); })();
    const i0 = Math.max(0, Math.floor((x - r2 + DEMI) / PAS)), i1 = Math.min(N, Math.ceil((x + r2 + DEMI) / PAS));
    const j0 = Math.max(0, Math.floor((z - r2 + DEMI) / PAS)), j1 = Math.min(N, Math.ceil((z + r2 + DEMI) / PAS));
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const d = Math.hypot(X(i) - x, X(j) - z); if(d < r2){ const k = j * M1 + i; H[k] = mix(h0, H[k], lisse(r, r2, d)); } }
    return h0;
  }
  function hauteurGrille(x, z){
    const fx = Math.max(0, Math.min(N - 1e-6, (x + DEMI) / PAS)), fz = Math.max(0, Math.min(N - 1e-6, (z + DEMI) / PAS));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const h00 = H[j * M1 + i], h10 = H[j * M1 + i + 1], h01 = H[(j + 1) * M1 + i], h11 = H[(j + 1) * M1 + i + 1];
    // les mêmes deux triangles que le dessin : (00, 01, 10) et (01, 11, 10)
    return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  for(const st of STATIONS) st.y = aplanir(st.x, st.z, 12, 20);
  for(const m of MAISONS) m.y = aplanir(m.x, m.z, m.style === 'chalet' ? 10 : 11, m.n >= 3 ? 15 : 19);
  GARAGE.y = aplanir(GARAGE.x, GARAGE.z, 20, 32);
  // la normale du sol
  function normale(x, z){
    const e = .6, hx = hauteurGrille(x + e, z) - hauteurGrille(x - e, z), hz = hauteurGrille(x, z + e) - hauteurGrille(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
  }
  /* ---------- Le type de sol : 0 herbe, 1 piste, 2 roche, 3 neige, 4 sable, 5 boue/galets, 6 terre de forêt, 7 roche rouge ---------- */
  const SOLS = ['herbe', 'piste', 'roche', 'neige', 'sable', 'galets', 'forêt', 'roche rouge'];
  const distPiste = (x, z) => { let d = 1e9; for(const p of PISTES) d = Math.min(d, distLigne(p, x, z)[0]); return d; };
  for(let j = 0; j <= N; j++) for(let i = 0; i <= N; i++){
    const x = X(i), z = X(j), k = j * M1 + i, h = H[k], R = regions(x, z);
    const hx = (H[j * M1 + Math.min(N, i + 1)] - H[j * M1 + Math.max(0, i - 1)]) / (2 * PAS), hz = (H[Math.min(N, j + 1) * M1 + i] - H[Math.max(0, j - 1) * M1 + i]) / (2 * PAS);
    const pente = Math.hypot(hx, hz);
    let s = 0;
    if(h < W + .8) s = 5;
    else if(R.d > .5){ const sable = lisse(255, 300, x + 50 * (bruit(x * .02, z * .02) - .5)) * (1 - lisse(.5, .9, pente)); s = pente > .7 ? 7 : sable > .5 ? 4 : 7; if(h > 30 && pente < .3) s = 7; }
    else if(R.m > .4 && h > 78 + 10 * bruit(x * .05, z * .05)) s = pente > 1.1 ? 2 : 3;
    else if(pente > .85) s = 2;
    else if(R.f > .5) s = 6;
    if(s !== 5 && s !== 3 && distPiste(x, z) < 3.2 && pente < .6) s = 1;
    SURF[k] = s;
  }
  function surface(x, z){
    const i = Math.max(0, Math.min(N, Math.round((x + DEMI) / PAS))), j = Math.max(0, Math.min(N, Math.round((z + DEMI) / PAS)));
    return SURF[j * M1 + i];
  }
  const profondeurEau = (x, z) => Math.max(0, W - hauteurGrille(x, z));

  // le butin de chaque maison (toujours le même) : des objets utiles et des objets à revendre, plus beaux dans les maisons difficiles
  MAISONS.forEach((m, i) => {
    const rnd = graine(500 + i * 31), n = 2 + m.n + (m.tresor ? 2 : 0), L = [];
    if(m.n === 1) L.push('jerrican');
    while(L.length < n){
      if(rnd() < .55) L.push(UTILES[Math.floor(rnd() * UTILES.length)]);
      else { const max = Math.min(VALEURS.length, 3 + m.n * 2 + (m.tresor ? 3 : 0)), min = Math.max(0, m.n * 2 - 3); L.push(VALEURS[min + Math.floor(rnd() * (max - min))]); }
    }
    m.butin = L;
  });

  /* ---------- Les pièces d'or ---------- */
  const OR = [];
  {
    const rnd = graine(77);
    // le long des pistes
    for(const p of PISTES){ for(let k = 0; k < p.length - 1; k++){ const [ax, az] = p[k], [bx, bz] = p[k + 1], L = Math.hypot(bx - ax, bz - az);
      for(let s = 12; s < L - 6; s += 22) OR.push([ax + (bx - ax) * s / L, az + (bz - az) * s / L]); } }
    // un peu partout, plus dans les coins difficiles
    let essais = 0;
    while(OR.length < 260 && essais++ < 20000){
      const x = (rnd() * 2 - 1) * 440, z = (rnd() * 2 - 1) * 440;
      if(profondeurEau(x, z) > 0) continue;
      if(OR.some(([a, b]) => Math.hypot(a - x, b - z) < 14)) continue;
      OR.push([x, z]);
    }
  }

  /* ---------- Le décor : arbres, sapins, rochers, cactus (positions fixes) ---------- */
  const DECOR = { sapins:[], arbres:[], rochers:[], cactus:[] };
  {
    const rnd = graine(1234), loin = (x, z, r) => !MAISONS.some(m => Math.hypot(m.x - x, m.z - z) < r) && !STATIONS.some(m => Math.hypot(m.x - x, m.z - z) < r) && Math.hypot(GARAGE.x - x, GARAGE.z - z) > 36;
    for(let k = 0; k < 9000; k++){
      const x = (rnd() * 2 - 1) * 480, z = (rnd() * 2 - 1) * 480, h = hauteurGrille(x, z), s = surface(x, z), R = regions(x, z), t = rnd();
      if(h < W + .6 || s === 1 || !loin(x, z, 16) || distPiste(x, z) < 5) continue;
      const taille = .7 + rnd() * .7;
      if(s === 6){ if(t < .55) DECOR.sapins.push([x, h, z, taille * 1.1, rnd() * 6.3]); else if(t < .7) DECOR.arbres.push([x, h, z, taille, rnd() * 6.3]); else if(t < .74) DECOR.rochers.push([x, h, z, taille, rnd() * 6.3]); }
      else if(s === 0){ if(t < .045) DECOR.arbres.push([x, h, z, taille, rnd() * 6.3]); else if(t < .06) DECOR.sapins.push([x, h, z, taille, rnd() * 6.3]); else if(t < .075) DECOR.rochers.push([x, h, z, taille * .8, rnd() * 6.3]); }
      else if(s === 2){ if(t < .12) DECOR.rochers.push([x, h, z, taille * 1.5, rnd() * 6.3]); else if(t < .2 && R.m > .3 && h < 75) DECOR.sapins.push([x, h, z, taille, rnd() * 6.3]); }
      else if(s === 3){ if(t < .04) DECOR.rochers.push([x, h, z, taille * 1.3, rnd() * 6.3]); else if(t < .1 && h < 80) DECOR.sapins.push([x, h, z, taille, rnd() * 6.3]); }
      else if(s === 4 || s === 7){ if(t < .035) DECOR.cactus.push([x, h, z, taille, rnd() * 6.3]); else if(t < .06) DECOR.rochers.push([x, h, z, taille * 1.2, rnd() * 6.3]); }
    }
  }
  // les obstacles pour la voiture : une grille de cases de 16 m
  const OBST = new Map(), CASE = 16;
  const cle = (cx, cz) => cx * 1000 + cz;
  function ajouterObstacle(x, z, r, type){ const cx = Math.floor(x / CASE), cz = Math.floor(z / CASE), k = cle(cx, cz); if(!OBST.has(k)) OBST.set(k, []); OBST.get(k).push({ x, z, r, type }); }
  for(const [x, , z, t] of DECOR.sapins) ajouterObstacle(x, z, .55 * t, 'arbre');
  for(const [x, , z, t] of DECOR.arbres) ajouterObstacle(x, z, .6 * t, 'arbre');
  for(const [x, , z, t] of DECOR.rochers) ajouterObstacle(x, z, 1.1 * t, 'rocher');
  for(const [x, , z, t] of DECOR.cactus) ajouterObstacle(x, z, .45 * t, 'cactus');
  function obstaclesPres(x, z){
    const cx = Math.floor(x / CASE), cz = Math.floor(z / CASE), r = [];
    for(let a = -1; a <= 1; a++) for(let b = -1; b <= 1; b++){ const l = OBST.get(cle(cx + a, cz + b)); if(l) r.push(...l); }
    return r;
  }

  /* ---------- Les couleurs du sol ---------- */
  const COUL_SOL = [[124, 195, 91], [176, 138, 90], [154, 149, 144], [244, 247, 250], [233, 199, 123], [140, 122, 92], [78, 143, 58], [201, 119, 74]];
  function couleurSol(i, j){
    const k = j * M1 + i, s = SURF[k], x = X(i), z = X(j), h = H[k], n = bruit(x * .08, z * .08);
    let c = COUL_SOL[s].slice();
    if(s === 0){ c = [mix(108, 150, n), mix(184, 214, n), mix(80, 104, n)]; }
    if(s === 6){ c = [mix(66, 92, n), mix(128, 156, n), mix(48, 66, n)]; }
    if(s === 4){ c = [mix(226, 240, n), mix(186, 206, n), mix(112, 132, n)]; }
    if(s === 7){ const b = Math.floor(h / 4) % 2; c = b ? [205, 128, 82] : [186, 104, 66]; }
    if(s === 3){ const v = mix(236, 252, n); c = [v, v + 2, v + 4]; }
    if(s === 2 && regions(x, z).d > .5) c = [176, 98, 62];
    if(s === 5){ const p = W - h; c = p > 1 ? [92, 112, 104] : [176, 160, 120]; }
    return c.map(v => Math.max(0, Math.min(255, v)) / 255);
  }

  /* ---------- La carte vue du dessus (pour l'écran de la carte et la mini-carte) ---------- */
  function dessinerCarte(cv){
    const n = 500; cv.width = n; cv.height = n;
    const g = cv.getContext('2d'), img = g.createImageData(n, n), d = img.data;
    for(let py = 0; py < n; py++) for(let px = 0; px < n; px++){
      const x = -DEMI + (px + .5) * TAILLE / n, z = -DEMI + (py + .5) * TAILLE / n;
      const i = Math.round((x + DEMI) / PAS), j = Math.round((z + DEMI) / PAS), h = hauteurGrille(x, z);
      let c = couleurSol(Math.min(N, i), Math.min(N, j));
      if(h < W){ const p = Math.min(1, (W - h) / 2.2); c = [mix(.55, .2, p), mix(.78, .5, p), mix(.86, .78, p)]; }
      // un ombrage pour voir le relief
      const ombre = Math.max(-.25, Math.min(.25, (hauteurGrille(x - 2, z - 2) - hauteurGrille(x + 2, z + 2)) * .05));
      const o = (py * n + px) * 4;
      d[o] = Math.min(255, (c[0] + ombre) * 255); d[o + 1] = Math.min(255, (c[1] + ombre) * 255); d[o + 2] = Math.min(255, (c[2] + ombre) * 255); d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // les pistes en pointillés
    g.strokeStyle = 'rgba(120,84,48,.55)'; g.lineWidth = 2; g.setLineDash([4, 3]);
    const P = v => (v + DEMI) * n / TAILLE;
    for(const p of PISTES){ g.beginPath(); p.forEach(([x, z], k) => k ? g.lineTo(P(x), P(z)) : g.moveTo(P(x), P(z))); g.stroke(); }
    g.setLineDash([]);
    return cv;
  }

  return { OBJETS, STATIONS, TAILLE, DEMI, N, PAS, W, H, SURF, SOLS, hauteur:hauteurGrille, normale, surface, regions, profondeurEau, MAISONS, PIECES, GARAGE, OR, DECOR,
    obstaclesPres, couleurSol, dessinerCarte, RIVIERE, LAC, CANYON, MESA, graine, bruit };
})();
