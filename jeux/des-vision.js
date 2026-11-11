/* Altitude Arcade : lecture des dés sur une image (caméra ou photo), sans bibliothèque.
   DesVision.analyser(image) → { plateau, des, message }
   - image : { width, height, data } (ImageData, RVBA), de préférence petite (environ 480 px de large).
   - Le plateau (piste de dés) : la grande surface de couleur unie au centre de l'image. Sa couleur est celle qui revient
     le plus au centre ; elle est ensuite corrigée par morceaux (un plateau est souvent plus éclairé d'un côté).
   - Les dés : les « trous » du plateau (ce qui n'a pas sa couleur et qu'il entoure). Deux dés collés font un seul trou
     deux fois plus grand : il est coupé en deux (regroupement des points en k paquets).
   - Les points d'un dé : à l'intérieur du dé (sans les bords), on sépare clair et foncé (seuil d'Otsu) ;
     les points sont la couleur la moins présente (points foncés sur dé clair, ou points clairs sur dé foncé).
   Les dés posés hors du plateau ne sont pas lus : au Yam's ce sont les dés gardés, au 10 000 ceux mis de côté. */
(() => {
  'use strict';
  const BLOC = 24;                                   // taille des morceaux pour la couleur locale du plateau

  // Étiquetage des zones d'un masque (4 voisins) : renvoie les étiquettes (0 : hors masque) et la taille de chaque zone
  function zones(masque, W, H, huit = false){
    const lab = new Int32Array(W * H), tailles = [0], pile = new Int32Array(W * H);
    let n = 0;
    for(let i = 0; i < W * H; i++){
      if(!masque[i] || lab[i]) continue;
      n++; let sp = 0, t = 0; pile[sp++] = i; lab[i] = n;
      while(sp){
        const k = pile[--sp], x = k % W, y = (k - x) / W; t++;
        const voisin = j => { if(masque[j] && !lab[j]){ lab[j] = n; pile[sp++] = j; } };
        if(x > 0) voisin(k - 1); if(x < W - 1) voisin(k + 1); if(y > 0) voisin(k - W); if(y < H - 1) voisin(k + W);
        if(huit){ if(x > 0 && y > 0) voisin(k - W - 1); if(x < W - 1 && y > 0) voisin(k - W + 1); if(x > 0 && y < H - 1) voisin(k + W - 1); if(x < W - 1 && y < H - 1) voisin(k + W + 1); }
      }
      tailles.push(t);
    }
    return { lab, tailles, n };
  }
  // Seuil d'Otsu sur des valeurs de 0 à 255 : celui qui sépare le mieux deux groupes
  function otsu(vals){
    const h = new Float64Array(256); for(const v of vals) h[v | 0]++;
    const tot = vals.length; let somme = 0; for(let i = 0; i < 256; i++) somme += i * h[i];
    let sB = 0, wB = 0, best = 0, seuil = 128;
    for(let t = 0; t < 256; t++){
      wB += h[t]; if(!wB) continue; const wF = tot - wB; if(!wF) break;
      sB += t * h[t]; const mB = sB / wB, mF = (somme - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if(v > best){ best = v; seuil = t; }
    }
    return seuil;
  }
  // Enveloppe convexe (pour dessiner le contour du plateau)
  function enveloppe(pts){
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const croix = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const bas = [], haut = [];
    for(const p of pts){ while(bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop(); bas.push(p); }
    for(let i = pts.length - 1; i >= 0; i--){ const p = pts[i]; while(haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop(); haut.push(p); }
    return bas.slice(0, -1).concat(haut.slice(0, -1));
  }
  // Position, taille et angle d'un groupe de pixels (moments)
  function forme(px, W){
    let sx = 0, sy = 0; for(const k of px){ sx += k % W; sy += (k / W) | 0; }
    const cx = sx / px.length, cy = sy / px.length;
    let a = 0, b = 0, c = 0; for(const k of px){ const dx = k % W - cx, dy = ((k / W) | 0) - cy; a += dx * dx; b += dx * dy; c += dy * dy; }
    a /= px.length; b /= px.length; c /= px.length;
    const d = Math.sqrt((a - c) * (a - c) + 4 * b * b), l1 = (a + c + d) / 2, l2 = (a + c - d) / 2;
    return { cx, cy, angle:.5 * Math.atan2(2 * b, a - c), allonge:Math.sqrt(l1 / Math.max(l2, 1e-6)), cote:Math.sqrt(px.length) };
  }
  // Couper un groupe de pixels en k paquets (dés collés)
  function couper(px, k, W){
    const pts = px.map(i => [i % W, (i / W) | 0]);
    let c = [];
    // départ : les points les plus éloignés les uns des autres
    c.push(pts[0]);
    while(c.length < k){ let best = null, bd = -1; for(const p of pts){ const d = Math.min(...c.map(q => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2)); if(d > bd){ bd = d; best = p; } } c.push(best); }
    let groupe = new Int32Array(pts.length);
    for(let it = 0; it < 12; it++){
      pts.forEach((p, i) => { let b = 0, bd = Infinity; c.forEach((q, j) => { const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if(d < bd){ bd = d; b = j; } }); groupe[i] = b; });
      c = c.map((_, j) => { let x = 0, y = 0, n = 0; pts.forEach((p, i) => { if(groupe[i] === j){ x += p[0]; y += p[1]; n++; } }); return n ? [x / n, y / n] : c[j]; });
    }
    return c.map((_, j) => px.filter((_, i) => groupe[i] === j)).filter(g => g.length);
  }

  // Orientation d'un dé : l'angle (modulo 90°) du plus petit rectangle qui contient son contour
  function carre(px, W){
    const ici = new Set(px), bord = [];
    for(const k of px) if(!ici.has(k - 1) || !ici.has(k + 1) || !ici.has(k - W) || !ici.has(k + W)) bord.push([k % W, (k / W) | 0]);
    const env = enveloppe(bord);
    let best = null;
    for(let deg = 0; deg < 90; deg += 2){
      const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for(const [x, y] of env){ const u = x * c + y * s, v = -x * s + y * c; if(u < u0) u0 = u; if(u > u1) u1 = u; if(v < v0) v0 = v; if(v > v1) v1 = v; }
      const aire = (u1 - u0 + 1) * (v1 - v0 + 1);
      if(!best || aire < best.aire){ const um = (u0 + u1) / 2, vm = (v0 + v1) / 2; best = { aire, angle:a, cote:Math.sqrt(aire), cx:um * c - vm * s, cy:um * s + vm * c }; }
    }
    return best;
  }
  /* Lecture par emplacements (sûre même si l'image est floue) : sur la face, les points ne peuvent être qu'à 9 places
     (centre, 4 coins, 4 milieux des côtés). On regarde lesquelles sont de la couleur des points. */
  function parPlaces(src, k, c, seuil, foncesSontPoints){
    const { gris, W, H } = src, q = c.cote * k * .27, rr = Math.max(1, c.cote * k * .055), ca = Math.cos(c.angle), sa = Math.sin(c.angle);
    const place = (i, j) => {
      const x0 = c.cx * k + (i * ca - j * sa) * q, y0 = c.cy * k + (i * sa + j * ca) * q;
      let n = 0, oui = 0;
      for(let y = Math.round(y0 - rr); y <= y0 + rr; y++) for(let x = Math.round(x0 - rr); x <= x0 + rr; x++){
        if(x < 0 || y < 0 || x >= W || y >= H || (x - x0) ** 2 + (y - y0) ** 2 > rr * rr) continue;
        n++; const v = gris[y * W + x]; if(foncesSontPoints ? v <= seuil : v > seuil) oui++;
      }
      return n && oui / n > .5;
    };
    const centre = place(0, 0), coins = [place(-1, -1), place(1, -1), place(1, 1), place(-1, 1)], milieux = [place(-1, 0), place(1, 0), place(0, -1), place(0, 1)];
    const nc = coins.filter(Boolean).length, nmh = milieux[0] + milieux[1], nmv = milieux[2] + milieux[3];
    const diag = (coins[0] && coins[2]) || (coins[1] && coins[3]);
    if(nc === 0 && centre && !nmh && !nmv) return 1;
    if(nc === 2 && diag && !nmh && !nmv) return centre ? 3 : 2;
    if(nc === 4 && !centre && ((nmh === 2 && !nmv) || (nmv === 2 && !nmh))) return 6;
    if(nc === 4 && !nmh && !nmv) return centre ? 5 : 4;
    return null;
  }

  // Les points d'un dé : on compte les taches de la couleur minoritaire à l'intérieur
  function lireDe(px, W, H, gris, haute){
    const c = carre(px, W);
    // avec l'image en haute définition : on lit l'intérieur du carré du dé (sans ses bords arrondis)
    if(haute){
      const k = haute.W / W, cote = c.cote * k * .84, ca = Math.cos(c.angle), sa = Math.sin(c.angle), x0 = c.cx * k, y0 = c.cy * k, R = c.cote * k * .53;
      const dedans = [];
      for(let y = Math.max(0, Math.floor(y0 - R)); y <= Math.min(haute.H - 1, y0 + R); y++) for(let x = Math.max(0, Math.floor(x0 - R)); x <= Math.min(haute.W - 1, x0 + R); x++){
        const u = (x - x0) * ca + (y - y0) * sa, v = -(x - x0) * sa + (y - y0) * ca;
        // la face sans ses coins arrondis (le flou les assombrit)
        if(Math.abs(u) <= cote / 2 && Math.abs(v) <= cote / 2 && u * u + v * v <= R * R) dedans.push(y * haute.W + x);
      }
      return lirePoints(dedans, haute.W, haute.H, haute.gris, cote * cote / .7056, { ...c }, k, haute);
    }
    const ici = new Uint8Array(W * H); for(const k of px) ici[k] = 1;
    // distance au bord du dé (en pixels), pour laisser de côté le bord arrondi et l'ombre
    const dist = new Int16Array(W * H).fill(-1), file = [];
    for(const k of px){ const x = k % W; if(x === 0 || x === W - 1 || !ici[k - 1] || !ici[k + 1] || !ici[k - W] || !ici[k + W]){ dist[k] = 0; file.push(k); } }
    for(let q = 0; q < file.length; q++){ const k = file[q]; for(const j of [k - 1, k + 1, k - W, k + W]) if(j >= 0 && j < W * H && ici[j] && dist[j] < 0){ dist[j] = dist[k] + 1; file.push(j); } }
    const f = forme(px, W), marge = Math.max(1, Math.round(f.cote * .07));
    const dedans = px.filter(k => dist[k] >= marge);
    return lirePoints(dedans, W, H, gris, px.length, c, 1, { gris, W, H });
  }
  // dedans : les pixels de la face (sans le bord) ; aire : celle du dé entier ; c : son carré (dans l'image réduite) ; k : l'agrandissement
  function lirePoints(dedans, W, H, gris, aire, c, k, src){
    if(dedans.length < 12) return { v:null };
    const vals = dedans.map(i => gris[i]), s = otsu(vals);
    let nb = 0, sb = 0, sh = 0; for(const v of vals){ if(v <= s){ nb++; sb += v; } else sh += v; }
    const nh = vals.length - nb, mb = nb ? sb / nb : 0, mh = nh ? sh / nh : 0;
    if(mh - mb < 30) return { v:null };   // pas assez de contraste : pas de points visibles
    const foncesSontPoints = nb <= nh;
    // les taches, dans une petite image autour du dé
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for(const i of dedans){ const x = i % W, y = (i / W) | 0; if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, masque = new Uint8Array(w * h), face = new Uint8Array(w * h);
    for(const i of dedans) face[(((i / W) | 0) - y0) * w + (i % W - x0)] = 1;
    for(const i of dedans){ const v = gris[i]; if(foncesSontPoints ? v <= s : v > s) masque[(((i / W) | 0) - y0) * w + (i % W - x0)] = 1; }
    const z = zones(masque, w, h, true);
    // une tache qui touche le bord de la face est une ombre ou un reflet, pas un point
    const auBord = new Uint8Array(z.n + 1);
    for(let i = 0; i < w * h; i++){ const n = z.lab[i]; if(!n) continue; const x = i % w; if(x === 0 || x === w - 1 || i < w || i >= w * (h - 1) || !face[i - 1] || !face[i + 1] || !face[i - w] || !face[i + w]) auBord[n] = 1; }
    const taches = [];
    for(let n = 1; n <= z.n; n++){
      const t = z.tailles[n];
      if(auBord[n] || t < Math.max(2, aire * .004) || t > aire * .16) continue;
      taches.push({ n, t });
    }
    const somme = new Map(taches.map(x => [x.n, [0, 0, 0]]));
    for(let i = 0; i < w * h; i++){ const q = somme.get(z.lab[i]); if(q){ q[0] += i % w + x0; q[1] += ((i / w) | 0) + y0; q[2]++; } }
    const pts = taches.map(x => { const q = somme.get(x.n); return [q[0] / q[2] / k, q[1] / q[2] / k]; });
    // deux lectures : les taches comptées, et les emplacements des points ; si les taches sont d'une taille anormale
    // (points collés par le flou), ce sont les emplacements qui décident
    const places = parPlaces(src, k, c, s, foncesSontPoints);
    const normal = aire * .045, sures = taches.length >= 1 && taches.length <= 6 && taches.every(x => x.t < normal * 1.9);
    const v = sures ? (places && places !== taches.length && taches.some(x => x.t > normal * 1.3) ? places : taches.length) : places;
    return { v, points:pts, clair:!foncesSontPoints, angle:c.angle, fond:foncesSontPoints ? mh : mb };
  }

  function analyser(img, grande){
    const W = img.width, H = img.height, N = W * H, d = img.data;
    // l'image en haute définition (facultative) : pour lire les points de près
    let haute = null;
    if(grande && grande.width > W){ const g2 = new Uint8Array(grande.width * grande.height), q = grande.data; for(let i = 0, j = 0; i < g2.length; i++, j += 4) g2[i] = .299 * q[j] + .587 * q[j + 1] + .114 * q[j + 2]; haute = { gris:g2, W:grande.width, H:grande.height }; }
    const gris = new Uint8Array(N), cr = new Float32Array(N), cg = new Float32Array(N), lum = new Float32Array(N);
    for(let i = 0, j = 0; i < N; i++, j += 4){
      const r = d[j], g = d[j + 1], b = d[j + 2], s = r + g + b + 1;
      lum[i] = .299 * r + .587 * g + .114 * b; gris[i] = lum[i]; cr[i] = r / s; cg[i] = g / s;
    }
    // 1. La couleur du plateau : la plus fréquente au centre de l'image
    const Q = 20, histo = new Map();
    for(let y = Math.round(H * .2); y < H * .8; y += 2) for(let x = Math.round(W * .2); x < W * .8; x += 2){
      const i = y * W + x, cle = Math.min(Q - 1, cr[i] * Q * 1.5 | 0) * 4096 + Math.min(Q - 1, cg[i] * Q * 1.5 | 0) * 64 + Math.min(15, lum[i] / 16 | 0);
      histo.set(cle, (histo.get(cle) || 0) + 1);
    }
    let mode = 0, mv = -1; for(const [k, v] of histo) if(v > mv){ mv = v; mode = k; }
    const mr = ((mode / 4096 | 0) + .5) / Q / 1.5, mg = ((mode / 64 | 0) % 64 + .5) / Q / 1.5, ml = (mode % 64 + .5) * 16;
    // 2. Le plateau : couleur proche (la teinte compte plus que la lumière : ombres et reflets restent du plateau)
    const dans = (i, r0, g0, l0) => Math.hypot((cr[i] - r0) / .055, (cg[i] - g0) / .055, (lum[i] - l0) / (.42 * l0 + 26)) < 1;
    let masque = new Uint8Array(N);
    for(let i = 0; i < N; i++) masque[i] = dans(i, mr, mg, ml) ? 1 : 0;
    // la couleur corrigée morceau par morceau (le plateau est rarement éclairé partout pareil)
    // (en trois passes : à chaque passe, le plateau gagne les coins plus sombres ou plus clairs voisins)
    const bx = Math.ceil(W / BLOC), by = Math.ceil(H / BLOC);
    for(let passe = 0; passe < 3; passe++){
    const ref = [];
    for(let j = 0; j < by; j++) for(let k = 0; k < bx; k++){
      let n = 0, sr = 0, sg = 0, sl = 0;
      for(let y = j * BLOC; y < Math.min(H, (j + 1) * BLOC); y++) for(let x = k * BLOC; x < Math.min(W, (k + 1) * BLOC); x++){ const i = y * W + x; if(masque[i]){ n++; sr += cr[i]; sg += cg[i]; sl += lum[i]; } }
      ref.push(n > BLOC * BLOC * .25 ? [sr / n, sg / n, sl / n] : null);
    }
    for(let i = 0; i < N; i++){
      const x = i % W, y = (i / W) | 0, k = Math.min(bx - 1, x / BLOC | 0), j = Math.min(by - 1, y / BLOC | 0);
      // la référence du morceau, sinon celle d'un voisin, sinon la couleur générale
      let r = ref[j * bx + k];
      if(!r) for(const [a, b] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]){ const q = ref[(j + a) * bx + k + b]; if(j + a >= 0 && j + a < by && k + b >= 0 && k + b < bx && q){ r = q; break; } }
      masque[i] = dans(i, ...(r || [mr, mg, ml])) ? 1 : 0;
    }
    }
    // nettoyage : un pixel suit la majorité de ses 8 voisins
    const net = new Uint8Array(N);
    for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){ const i = y * W + x; let s = 0; for(let a = -1; a <= 1; a++) for(let b = -1; b <= 1; b++) s += masque[i + a * W + b]; net[i] = s >= 5 ? 1 : 0; }
    masque = net;
    // 3. Le plateau est la plus grande zone de cette couleur
    const zp = zones(masque, W, H);
    let pl = 0; for(let n = 1; n <= zp.n; n++) if(!pl || zp.tailles[n] > zp.tailles[pl]) pl = n;
    if(!pl || zp.tailles[pl] < N * .12) return { plateau:null, des:[], message:'Je ne trouve pas le plateau : visez une piste de dés de couleur unie, bien éclairée.' };
    const bord = [];
    for(let y = 0; y < H; y += 2){ let a = -1, b = -1; for(let x = 0; x < W; x++) if(zp.lab[y * W + x] === pl){ if(a < 0) a = x; b = x; } if(a >= 0){ bord.push([a, y], [b, y]); } }
    const plateau = { contour:enveloppe(bord), aire:zp.tailles[pl] };
    // 4. Les trous du plateau : tout ce qui n'est pas plateau, ne touche pas le bord de l'image et est entouré par le plateau
    const autre = new Uint8Array(N); for(let i = 0; i < N; i++) autre[i] = zp.lab[i] === pl ? 0 : 1;
    const zt = zones(autre, W, H);
    const px = Array.from({ length:zt.n + 1 }, () => []), touche = new Uint8Array(zt.n + 1), voisPl = new Int32Array(zt.n + 1), voisAutre = new Int32Array(zt.n + 1);
    for(let i = 0; i < N; i++){
      const n = zt.lab[i]; if(!n) continue;
      px[n].push(i);
      const x = i % W, y = (i / W) | 0;
      if(x === 0 || y === 0 || x === W - 1 || y === H - 1){ touche[n] = 1; continue; }
      for(const j of [i - 1, i + 1, i - W, i + W]){ const m = zt.lab[j]; if(m === n) continue; if(zp.lab[j] === pl) voisPl[n]++; else voisAutre[n]++; }
    }
    const minA = Math.max(40, plateau.aire * .0018), maxA = plateau.aire * .12;
    let cand = []; const trous = new Uint8Array(zt.n + 1);
    for(let n = 1; n <= zt.n; n++){
      if(touche[n] || px[n].length < minA || px[n].length > maxA * 2.6) continue;
      if(voisPl[n] < (voisPl[n] + voisAutre[n]) * .7) continue;
      cand.push(px[n]); trous[n] = 1;
    }
    // 5. Les dés collés : un trou bien plus grand que les autres est coupé en plusieurs dés
    const aires = cand.map(c => c.length).filter(a => a <= maxA).sort((a, b) => a - b);
    const med = aires.length ? aires[aires.length >> 1] : 0;
    const des = [];
    for(const c of cand){
      const k = med ? Math.round(c.length / med) : 1, f = forme(c, W);
      const groupes = med && k >= 2 && (c.length > med * 1.6 || f.allonge > 1.7) ? couper(c, Math.min(5, Math.max(2, k)), W) : [c];
      for(const g of groupes){
        if(g.length > maxA) continue;
        const fg = forme(g, W);
        if(fg.allonge > 2.2) continue;                                       // trop allongé : pas un dé
        const l = lireDe(g, W, H, gris, haute);
        des.push({ cx:fg.cx, cy:fg.cy, cote:fg.cote, angle:l.angle ?? fg.angle, v:l.v, points:l.points || [], clair:!!l.clair, fond:l.fond });
      }
    }
    des.sort((a, b) => a.cx - b.cx);
    const lus = des.filter(x => x.v).length;
    // 6. Les dés posés hors du plateau (gardés ou mis de côté) : même couleur et même taille que les dés lus sur le plateau
    const hors = [];
    const lusOk = des.filter(x => x.v && x.fond != null);
    if(lusOk.length){
      const fond = lusOk.reduce((a, x) => a + x.fond, 0) / lusOk.length, taille = lusOk.reduce((a, x) => a + x.cote * x.cote, 0) / lusOk.length;
      // la teinte des dés : celle des pixels clairs (ou foncés) de leur face
      let sr = 0, sg = 0, n = 0;
      for(const x of lusOk){ const R = x.cote * .3; for(let y = Math.round(x.cy - R); y <= x.cy + R; y++) for(let xx = Math.round(x.cx - R); xx <= x.cx + R; xx++){ const i = y * W + xx; if(i >= 0 && i < N && Math.abs(gris[i] - fond) < 22){ sr += cr[i]; sg += cg[i]; n++; } } }
      if(n){
        const r0 = sr / n, g0 = sg / n, m = new Uint8Array(N);
        for(let i = 0; i < N; i++) if(zp.lab[i] !== pl && !trous[zt.lab[i]] && Math.hypot((cr[i] - r0) / .045, (cg[i] - g0) / .045, (gris[i] - fond) / 38) < 1) m[i] = 1;
        const zh = zones(m, W, H);
        const pxh = Array.from({ length:zh.n + 1 }, () => []); for(let i = 0; i < N; i++) if(zh.lab[i]) pxh[zh.lab[i]].push(i);
        for(let k = 1; k <= zh.n; k++){
          const g = pxh[k]; if(g.length < taille * .45 || g.length > taille * 1.9) continue;
          const fg = forme(g, W), cc = carre(g, W);
          if(fg.allonge > 1.6 || g.length < cc.aire * .62) continue;               // pas assez carré
          const l = lireDe(g, W, H, gris, haute);
          if(l.v) hors.push({ cx:fg.cx, cy:fg.cy, cote:fg.cote, angle:l.angle ?? fg.angle, v:l.v });
        }
        hors.sort((a, b) => a.cx - b.cx);
      }
    }
    return { plateau, des, hors, message:des.length ? (lus < des.length ? `${lus} dé${lus > 1 ? 's' : ''} lu${lus > 1 ? 's' : ''} sur ${des.length} : touchez un dé pour corriger.` : '') : 'Plateau repéré, mais pas de dé dessus.' };
  }

  // Mouvement entre deux images : moyenne des écarts sur une petite vignette
  function vignette(img, w = 32){
    const W = img.width, H = img.height, h = Math.max(1, Math.round(w * H / W)), out = new Float32Array(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = ((y * H / h | 0) * W + (x * W / w | 0)) * 4; out[y * w + x] = .299 * img.data[i] + .587 * img.data[i + 1] + .114 * img.data[i + 2]; }
    return out;
  }
  const ecart = (a, b) => { if(!a || !b || a.length !== b.length) return 999; let s = 0; for(let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

  window.DesVision = { analyser, vignette, ecart };
})();
