/* Strates : les îles en couches fines (comme des courbes de niveau), leurs matériaux, l'eau et la lave qui coulent.
   Une île fait N × N colonnes. Chaque colonne est une pile de h blocs ; m donne le matériau de chaque bloc.
   w et l : hauteur d'eau et de lave au-dessus du sol de chaque colonne (en couches). */
(() => {
const N = 192, H = 124, LH = 0.28, SEA = 22;
// Les formes des îles sont décrites dans une échelle « de base » (64 colonnes, couches épaisses, mer à 5) :
// E = colonnes par unité de base, K = couches par couche de base
const E = N / 64, K = 4.5, SEA0 = 5;

// Matériaux : couleur du dessus, couleur des côtés, outil nécessaire pour creuser
// (0 : à la main, 1 : pioche en bois, 2 : en pierre, 3 : en fer, 9 : impossible)
const MATS = [
  null,
  { k:'terre',      n:'Terre',          dessus:'#B98F62', cote:'#C9A27A', outil:0 },
  { k:'sable',      n:'Sable',          dessus:'#F1DDA4', cote:'#EAD49C', outil:0 },
  { k:'argile',     n:'Argile',         dessus:'#D39A78', cote:'#D2A285', outil:0 },
  { k:'pierre',     n:'Pierre',         dessus:'#C4C2B8', cote:'#B9B6AB', outil:1 },
  { k:'charbon',    n:'Charbon',        dessus:'#6B6D72', cote:'#77787C', outil:1 },
  { k:'fer',        n:'Minerai de fer', dessus:'#D8A07A', cote:'#CF9A75', outil:2 },
  { k:'or',         n:'Pépites d\'or',  dessus:'#F6D66A', cote:'#EDC95A', outil:3 },
  { k:'cristal',    n:'Cristal',        dessus:'#9BE6F2', cote:'#86D9E8', outil:3 },
  { k:'obsidienne', n:'Obsidienne',     dessus:'#5A4B6C', cote:'#544563', outil:3 },
  { k:'roche',      n:'Roche-mère',     dessus:'#7A7671', cote:'#77736E', outil:9 },
  { k:'neige',      n:'Neige',          dessus:'#F7F9FC', cote:'#E6ECF3', outil:0 },
  { k:'glace',      n:'Glace',          dessus:'#CDEFFA', cote:'#B8E3F2', outil:1 },
  { k:'basalte',    n:'Basalte',        dessus:'#8A8380', cote:'#837C79', outil:1 },
  { k:'gres',       n:'Grès',           dessus:'#EBC795', cote:'#E5C18F', outil:1 },
  { k:'lave',       n:'Poche de lave',  dessus:'#F27A2E', cote:'#E7733A', outil:0 },
  { k:'source',     n:'Source',         dessus:'#7CC3E8', cote:'#79BDE0', outil:0 },
  { k:'planches',   n:'Planches',       dessus:'#D9A56A', cote:'#CF9C63', outil:0 },
  { k:'briques',    n:'Briques',        dessus:'#C46A52', cote:'#BC654F', outil:1 },
  { k:'verre',      n:'Verre',          dessus:'#E2F5F8', cote:'#D5EEF2', outil:0 },
];
const ID = {};
MATS.forEach((m, i) => { if(m){ m.id = i; ID[m.k] = i; } });
// Blocs « précieux » : quand on étend une couche, ils sont remplacés par de la roche ordinaire
const PRECIEUX = new Set([ID.charbon, ID.fer, ID.or, ID.cristal, ID.obsidienne, ID.lave, ID.source, ID.roche]);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const idx = (i, j) => j * N + i;
const dans = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
const VOISINS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/* ---------- Bruit (aléatoire reproductible à partir d'une graine) ---------- */
function hash(x, y, z, s){
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function bruit(x, y, s){
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, 0, s), b = hash(xi + 1, yi, 0, s), c = hash(xi, yi + 1, 0, s), d = hash(xi + 1, yi + 1, 0, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, oct = 4){
  let t = 0, amp = .5, f = 1, norm = 0;
  for(let o = 0; o < oct; o++){ t += amp * bruit(x * f, y * f, s + o * 17); norm += amp; amp *= .5; f *= 2; }
  return t / norm;
}

/* ---------- Création d'une île ---------- */
// Proportions des poches et filons selon l'île (par paquets de 4 colonnes × 4 couches)
const FILONS = {
  verte:  { lave:.02, source:.05, cristal:.012, or:.03, fer:.08, charbon:.13, base:'pierre' },
  sables: { lave:.01, source:.04, cristal:.012, or:.09, fer:.05, charbon:.09, base:'gres' },
  volcan: { lave:.16, source:.01, cristal:.07, or:.05, fer:.07, charbon:.11, base:'basalte' },
  glaces: { lave:.01, source:.03, cristal:.08, or:.03, fer:.08, charbon:.11, base:'pierre' },
};
// Hauteur (en couches de base) d'un point de l'île, en coordonnées de base (0 à 64)
function relief(type, seed, x, y){
  const c0 = 32;
  const r = Math.hypot(x - c0, y - c0) / (64 * .42) * (.82 + .36 * fbm(x / 9, y / 9, seed + 5, 3));
  const e = fbm(x / 16, y / 16, seed, 4);
  let z;
  if(type === 'verte'){
    const mont = Math.max(0, fbm(x / 11, y / 11, seed + 9, 3) - .52) * 34 * Math.max(0, 1 - r);
    z = SEA0 - 3 + (1 - r * r) * 9 + (e - .45) * 13 + mont;
  } else if(type === 'sables'){
    const d = Math.abs(fbm(x / 7, y / 13, seed + 3, 3) - .5);
    z = SEA0 - 3 + (1 - r * r) * 7 + (.22 - d) * 14 + (e - .5) * 5;
  } else if(type === 'volcan'){
    const c = Math.max(0, 1 - r * 1.1);
    z = SEA0 - 4 + 23 * Math.pow(c, 1.6) + (e - .5) * 6 + (1 - r * r) * 3;
    if(r < .13) z -= (.13 - r) / .13 * 8;        // le cratère
  } else {
    const crete = (1 - Math.abs(fbm(x / 10, y / 10, seed + 4, 3) - .5) * 2);
    z = SEA0 - 3 + (1 - r * r) * 9 + (e - .45) * 12 + Math.max(0, crete - .7) * 30 * Math.max(0, 1 - r);
  }
  // Les bords de la carte sont toujours au fond de la mer
  const bord = Math.min(x, y, 64 - x, 64 - y);
  return Math.min(z, SEA0 - 4 + bord * .7);
}

// L'île telle qu'elle sort de la mer (sans les changements du joueur) : toujours la même pour une graine
function genererTerrain(I){
  const { type, seed } = I;
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){
    const z = relief(type, seed, (i + .5) / E, (j + .5) / E) * K;
    I.h[idx(i, j)] = Math.round(clamp(z, 1, H - 3));
  }
  const F = FILONS[type];
  const filon = (i, j, z, k, t = 4) => hash(Math.floor(i / t), Math.floor(j / t), Math.floor(z / t), seed + k);
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){
    const c = idx(i, j), h = I.h[c];
    for(let z = 0; z < h; z++){
      let k = choisir(I, F, filon, i, j, z, h - 1 - z, h);
      if(z >= h - 4 && (k === 'lave' || k === 'source')) k = F.base;   // jamais de poche juste sous la surface
      I.m[c * H + z] = ID[k];
    }
  }
}

function creerIle(type, seed){
  const I = { type, seed, h:new Uint8Array(N * N), m:new Uint8Array(N * N * H), w:new Float32Array(N * N), l:new Float32Array(N * N),
    arbres:new Uint8Array(N * N), sources:[], bat:[], hab:[], prochainId:1, t:0, cratere:-1, modif:new Set() };
  genererTerrain(I);
  // Arbres
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){
    const c = idx(i, j), h = I.h[c];
    if(h <= SEA) continue;
    const dessus = I.m[c * H + h - 1], foret = fbm(i / E / 6, j / E / 6, seed + 21, 2), r = hash(i, j, 3, seed);
    I.arbres[c] = arbreNaturel(type, dessus, h, foret, r * 3.6);
  }
  remplirMer(I);
  // Volcan : le point le plus bas du cratère
  if(type === 'volcan'){
    let best = -1;
    for(let j = N / 2 - 8; j <= N / 2 + 8; j++) for(let i = N / 2 - 8; i <= N / 2 + 8; i++){ if(Math.hypot(i - N / 2, j - N / 2) > 8) continue; const c = idx(i, j); if(best < 0 || I.h[c] < I.h[best]) best = c; }
    I.cratere = best;
    I.l[best] = 1.4 * K;
  }
  I.depart = terrainDeDepart(I);
  return I;
}

function choisir(I, F, filon, i, j, z, dd, h){
  if(z === 0) return dd === 0 ? 'sable' : 'roche';     // le fond de la mer : du sable
  const t = I.type, zo = z / K, d = dd / K, ho = h / K;
  // Couches du dessus
  if(t === 'verte'){
    if(ho <= SEA0 + 1){ if(d < 2) return 'sable'; if(d < 3) return 'argile'; }
    else if(d < 3) return dd === 0 && ho >= 19 ? 'neige' : 'terre';
  } else if(t === 'sables'){
    if(d < 3) return 'sable';
    if(d < 6) return filon(i, j, z, 31) < .18 ? 'argile' : 'gres';
  } else if(t === 'volcan'){
    if(ho <= SEA0 + 1 && d < 2) return 'sable';
    if(d < 2 && ho < 13 && fbm(i / E / 5, j / E / 5, I.seed + 41, 2) > .5) return 'terre';
    if(d < 2) return 'basalte';
    if(filon(i, j, z, 33, 4) < .05) return 'obsidienne';
  } else {
    if(d < 2) return ho <= SEA0 + 1 ? 'sable' : 'neige';
    if(d < 4 && filon(i, j, z, 35) < .3) return 'glace';
    if(d < 4 && ho > SEA0 + 1) return 'terre';
  }
  // Profondeur : la roche de l'île, ses poches et ses filons
  if(zo <= 3 && filon(i, j, z, 7, 4) < F.lave) return 'lave';
  if(zo >= SEA0 - 2 && zo <= SEA0 + 4 && filon(i, j, z, 8) < F.source) return 'source';
  const r = filon(i, j, z, 1);
  if(zo <= 4 && r < F.cristal) return 'cristal';
  if(zo <= 7 && r < F.cristal + F.or) return 'or';
  if(zo <= 12 && r < F.cristal + F.or + F.fer) return 'fer';
  if(zo <= 18 && r < F.cristal + F.or + F.fer + F.charbon) return 'charbon';
  if(t === 'sables' && zo < 4) return 'pierre';
  return F.base;
}

// Espèces : 1 feuillu, 2 sapin, 3 palmier, 4 cactus, 5 sapin enneigé
function arbreNaturel(type, dessus, h, foret, r){
  const ho = h / K;
  if(type === 'verte' && dessus === ID.terre && ho < 18 && foret > .52 && r < .55) return ho > 12 ? 2 : 1;
  if(type === 'sables' && dessus === ID.sable){ if(ho <= SEA0 + 2 && r < .06) return 3; if(ho > SEA0 + 2 && r < .025) return 4; }
  if(type === 'volcan' && dessus === ID.terre && foret > .5 && r < .3) return 1;
  if(type === 'glaces' && dessus === ID.neige && foret > .5 && r < .35) return 5;
  if(type === 'glaces' && dessus === ID.terre && r < .3) return 2;
  return 0;
}
function especePour(I, c){
  const h = I.h[c], dessus = I.m[c * H + h - 1];
  if(dessus === ID.terre) return I.type === 'glaces' || h > 12 * K ? 2 : 1;
  if(dessus === ID.neige) return 5;
  if(dessus === ID.sable && I.type === 'sables') return h <= SEA + 2 * K ? 3 : 4;
  return 0;
}

function remplirMer(I){
  const vu = new Uint8Array(N * N), file = [];
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++)
    if((i === 0 || j === 0 || i === N - 1 || j === N - 1) && I.h[idx(i, j)] < SEA){ vu[idx(i, j)] = 1; file.push(idx(i, j)); }
  while(file.length){
    const c = file.pop(), i = c % N, j = (c / N) | 0;
    I.w[c] = SEA - I.h[c];
    for(const [di, dj] of VOISINS){
      const a = i + di, b = j + dj;
      if(!dans(a, b)) continue;
      const n = idx(a, b);
      if(!vu[n] && I.h[n] < SEA){ vu[n] = 1; file.push(n); }
    }
  }
}

// Premier terrain du village : un terrain rond et plat de 13 colonnes de large près du rivage
function terrainDeDepart(I){
  const R = 6, ox = N / 2, oy = N * .72;
  const cand = [];
  for(let j = R + 2; j < N - R - 2; j++) for(let i = R + 2; i < N - R - 2; i++) cand.push([Math.hypot(i - ox, j - oy), i, j]);
  cand.sort((a, b) => a[0] - b[0]);
  for(const [, i, j] of cand){
    const hs = [];
    let ok = true;
    for(let b = j - R; b <= j + R && ok; b++) for(let a = i - R; a <= i + R; a++){ const h = I.h[idx(a, b)]; if(h <= SEA || I.w[idx(a, b)] > 0){ ok = false; break; } hs.push(h); }
    if(!ok) continue;
    hs.sort((a, b) => a - b);
    if(hs[hs.length - 1] - hs[0] > 4 * K) continue;
    const cible = Math.max(SEA + 2, hs[hs.length >> 1]);
    const dessusMat = I.type === 'sables' ? ID.sable : I.type === 'glaces' ? ID.neige : ID.terre;
    for(let b = j - R; b <= j + R; b++) for(let a = i - R; a <= i + R; a++){
      if((a - i) ** 2 + (b - j) ** 2 > (R + .5) ** 2) continue;     // un terrain rond
      const c = idx(a, b);
      while(I.h[c] > cible){ I.h[c]--; I.m[c * H + I.h[c]] = 0; }
      while(I.h[c] < cible){ I.m[c * H + I.h[c]] = I.type === 'sables' ? ID.sable : ID.terre; I.h[c]++; }
      I.m[c * H + I.h[c] - 1] = dessusMat;
      I.arbres[c] = 0;
      I.modif.add(c);
    }
    return { i, j };
  }
  return { i:N / 2, j:N / 2 };
}

/* ---------- Modifier le terrain ---------- */
const dessus = (I, c) => I.h[c] ? I.m[c * H + I.h[c] - 1] : 0;
// Enlève le bloc du dessus. Une poche de lave ou une source mise au jour se met à couler.
// Renvoie { mat, ev:[...] }
function retirer(I, c){
  const mat = dessus(I, c);
  if(!mat || I.h[c] <= 1) return null;
  I.h[c]--; I.m[c * H + I.h[c]] = 0;
  I.modif.add(c);
  const ev = [];
  while(I.h[c] > 1){
    const t = dessus(I, c);
    if(t === ID.lave){ I.h[c]--; I.m[c * H + I.h[c]] = 0; I.l[c] += 1.4 * K; ev.push('lave'); }
    else if(t === ID.source){ I.h[c]--; I.m[c * H + I.h[c]] = 0; I.w[c] += .8 * K; I.sources.push({ c, z:I.h[c] + 1 }); ev.push('source'); }
    else break;
  }
  return { mat, ev };
}
function poser(I, c, mat){
  if(I.h[c] >= H - 1) return false;
  I.m[c * H + I.h[c]] = mat; I.h[c]++;
  I.modif.add(c);
  // L'eau (ou la lave) prise sous le bloc va chez le voisin le plus bas
  for(const f of [I.w, I.l]){
    if(f[c] <= 0) continue;
    const i = c % N, j = (c / N) | 0;
    let best = -1, bs = Infinity;
    for(const [di, dj] of VOISINS){ const a = i + di, b = j + dj; if(!dans(a, b)) continue; const n = idx(a, b), s = I.h[n] + f[n]; if(s < bs){ bs = s; best = n; } }
    const part = Math.min(f[c], 1);
    if(best >= 0) f[best] += part;
    f[c] -= part;
  }
  return true;
}
// Étendre une couche (comme dans Godus) : la colonne monte jusqu'à la hauteur L ;
// les blocs ajoutés reprennent ceux de la colonne modèle, sans les minerais
function etendre(I, c, L, modele){
  const base = ID[FILONS[I.type].base];
  let n = 0;
  while(I.h[c] < L && I.h[c] < H - 1){
    const z = I.h[c];
    let mat = z === L - 1 ? dessus(I, modele) : (I.m[modele * H + z] || base);
    if(PRECIEUX.has(mat)) mat = z >= L - 3 ? ID.terre : base;
    if(!mat) mat = ID.terre;
    poser(I, c, mat);
    n++;
  }
  return n;
}

/* ---------- Eau et lave qui coulent ---------- */
const tmp = new Float32Array(N * N);
// Chaque colonne donne une part de son fluide aux voisines dont la surface est plus basse.
// reste : épaisseur qui ne coule plus (la lave est visqueuse : une fine couche reste sur place)
function couler(I, f, k, reste = 0){
  tmp.fill(0);
  const h = I.h;
  let bouge = 0;
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){
    const c = j * N + i, a = f[c] - reste;
    if(a <= 0) continue;
    const s = h[c] + f[c];
    const o0 = i + 1 < N ? Math.max(0, s - h[c + 1] - f[c + 1]) : 0;
    const o1 = i > 0 ? Math.max(0, s - h[c - 1] - f[c - 1]) : 0;
    const o2 = j + 1 < N ? Math.max(0, s - h[c + N] - f[c + N]) : 0;
    const o3 = j > 0 ? Math.max(0, s - h[c - N] - f[c - N]) : 0;
    const tot = (o0 + o1 + o2 + o3) * k;
    if(tot < .004) continue;
    const e = tot > a ? a / tot * k : k;
    if(o0) tmp[c + 1] += o0 * e;
    if(o1) tmp[c - 1] += o1 * e;
    if(o2) tmp[c + N] += o2 * e;
    if(o3) tmp[c - N] += o3 * e;
    const sortie = (o0 + o1 + o2 + o3) * e;
    tmp[c] -= sortie;
    bouge += sortie;
  }
  for(let c = 0; c < N * N; c++) if(tmp[c]){ const v = f[c] + tmp[c]; f[c] = v > 0 ? v : 0; }
  return bouge;
}
// Un pas d'eau : écoulement, sources, mer au bord, évaporation des flaques trop fines
function pasEau(I){
  const w = I.w, h = I.h;
  for(const s of I.sources) if(h[s.c] + w[s.c] < s.z + 1.6 * K) w[s.c] += .028 * K;
  const b = couler(I, w, .24);
  for(let k = 0; k < N; k++){
    for(const c of [k, (N - 1) * N + k, k * N, k * N + N - 1]) w[c] = Math.max(0, SEA - h[c]);
  }
  for(let c = 0; c < N * N; c++) if(w[c] > 0 && w[c] < .01 * K) w[c] = 0;
  return b;
}
// Un pas de lave : écoulement lent et visqueux ; au contact de l'eau, de l'obsidienne ;
// une coulée qui s'arrête refroidit en basalte, une trace trop fine disparaît
function pasLave(I, changees){
  const l = I.l, w = I.w;
  const b = couler(I, l, .16, .06 * K);
  for(let c = 0; c < N * N; c++){
    if(l[c] <= 0) continue;
    if(w[c] > .1 * K && l[c] > .1 * K){
      poser(I, c, ID.obsidienne); l[c] = Math.max(0, l[c] - 1); w[c] = Math.max(0, w[c] - 1);
      changees.push(c);
      continue;
    }
    if(w[c] > .1 * K){ l[c] = 0; continue; }          // une trace de lave dans l'eau : éteinte
    if(c === I.cratere) continue;
    l[c] -= .0025 * K;
    if(l[c] < .03 * K){ l[c] = 0; continue; }
    if(l[c] < .2 * K && Math.random() < .03){ l[c] = Math.max(0, l[c] - 1); poser(I, c, ID.basalte); changees.push(c); }
  }
  return b;
}

/* ---------- Sauvegarde : seules les colonnes modifiées sont gardées (l'île se recalcule avec sa graine) ---------- */
function versB64(u8){
  let s = '';
  for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function deB64(b){ const s = atob(b), u = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function rle(u8){
  const out = [];
  for(let i = 0; i < u8.length;){ const v = u8[i]; let n = 1; while(i + n < u8.length && u8[i + n] === v && n < 255) n++; out.push(v, n); i += n; }
  return Uint8Array.from(out);
}
function unrle(u8, len){ const o = new Uint8Array(len); let k = 0; for(let i = 0; i + 1 < u8.length; i += 2){ o.fill(u8[i], k, k + u8[i + 1]); k += u8[i + 1]; } return o; }
const flottants = f => { const q = new Uint16Array(f.length); for(let i = 0; i < f.length; i++) q[i] = Math.round(clamp(f[i], 0, 250) * 256); return versB64(rle(new Uint8Array(q.buffer))); };
const deFlottants = b => { const q = new Uint16Array(unrle(deB64(b), N * N * 2).buffer), f = new Float32Array(N * N); for(let i = 0; i < f.length; i++) f[i] = q[i] / 256; return f; };

function serialiser(I){
  // Colonnes modifiées : numéro (2 octets), hauteur, puis les matériaux
  const cols = [...I.modif], octets = [];
  for(const c of cols){ octets.push(c & 255, c >> 8, I.h[c]); for(let z = 0; z < I.h[c]; z++) octets.push(I.m[c * H + z]); }
  return { v:2, type:I.type, seed:I.seed, t:I.t, cols:versB64(rle(Uint8Array.from(octets))), nb:octets.length,
    w:flottants(I.w), l:flottants(I.l), a:versB64(rle(I.arbres)),
    sources:I.sources, bat:I.bat, hab:I.hab.map(p => ({ id:p.id, x:+p.x.toFixed(2), z:+p.z.toFixed(2), maison:p.maison, coul:p.coul, sans:p.sans || 0 })),
    prochainId:I.prochainId, cratere:I.cratere, depart:I.depart, eruption:I.eruption || null };
}
function deserialiser(o){
  const I = { type:o.type, seed:o.seed, t:o.t || 0, h:new Uint8Array(N * N), m:new Uint8Array(N * N * H), modif:new Set() };
  genererTerrain(I);
  const oc = unrle(deB64(o.cols), o.nb);
  for(let k = 0; k < oc.length;){
    const c = oc[k] | oc[k + 1] << 8, h = oc[k + 2];
    k += 3;
    I.h[c] = h;
    I.m.fill(0, c * H, c * H + H);
    for(let z = 0; z < h; z++) I.m[c * H + z] = oc[k + z];
    k += h;
    I.modif.add(c);
  }
  Object.assign(I, { w:deFlottants(o.w), l:deFlottants(o.l), arbres:unrle(deB64(o.a), N * N), sources:o.sources || [], bat:o.bat || [],
    hab:(o.hab || []).map(p => ({ ...p, y:0 })), prochainId:o.prochainId || 1, cratere:o.cratere ?? -1,
    depart:o.depart || { i:N / 2, j:N / 2 }, eruption:o.eruption || null });
  return I;
}

window.Monde = { N, H, LH, SEA, K, MATS, ID, idx, dans, VOISINS, clamp, hash, fbm, creerIle, especePour, dessus, retirer, poser, etendre,
  pasEau, pasLave, serialiser, deserialiser };
})();
