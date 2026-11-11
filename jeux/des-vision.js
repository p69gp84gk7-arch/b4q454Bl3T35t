/* Altitude Arcade : lecture des dés sur une image (caméra ou photo), sans bibliothèque.
   DesVision.analyser(petite, grande, memo) → { plateau, des, hors, message, rPoint }
   - petite : l'image réduite (environ 480 px de large) pour repérer le plateau ;
     grande : la même image plus fine (960 à 1280 px) pour trouver les points ; memo : ce qu'on a appris à l'image d'avant.
   Méthode « les points d'abord » (elle ne dépend ni de la couleur des dés ni de celle du plateau) :
   1. Les points candidats : de petites taches rondes, bien plus foncées (ou plus claires) que leur voisinage,
      entourées d'un anneau de couleur unie (la face du dé). Points foncés sur dé clair, ou points clairs sur dé foncé
      (dé noir à points blancs, dé vert à points jaunes…).
   2. Les points d'un même dé : proches (moins d'un côté de dé), de la même sorte, autour de la même couleur de face,
      et reliés par la face (le trait de l'un à l'autre reste sur la couleur de la face : il ne traverse ni bord ni tapis).
   3. Les faces de côté (photo prise de biais) : un petit groupe collé à un dé, sur une face plus sombre, est oublié.
   4. Le plateau (la grande surface de couleur unie) sert seulement à trier : les dés dessus sont lancés,
      les dés posés à côté sont gardés (Yam's) ou mis de côté (10 000).
   Dans un « worker » (calcul hors de la page), reçoit { petite, grande, memo } et renvoie le résultat. */
(() => {
  'use strict';
  const BLOC = 24;                                   // taille des morceaux pour la couleur locale du plateau

  // Étiquetage des zones d'un masque : renvoie les étiquettes (0 : hors masque) et la taille de chaque zone
  // (les grands tableaux sont gardés d'une image à l'autre : moins de travail pour le ramasse-miettes)
  let tamponLab = null, tamponPile = null;
  function zones(masque, W, H, huit = false, garder = false){
    if(!tamponPile || tamponPile.length < W * H){ tamponPile = new Int32Array(W * H); tamponLab = new Int32Array(W * H); }
    const lab = garder ? new Int32Array(W * H) : (tamponLab.fill(0, 0, W * H), tamponLab.length === W * H ? tamponLab : tamponLab.subarray(0, W * H)), tailles = [0], pile = tamponPile;
    let n = 0;
    for(let i = 0; i < W * H; i++){
      if(!masque[i] || lab[i]) continue;
      n++; let sp = 0, t = 0; pile[sp++] = i; lab[i] = n;
      while(sp){
        const k = pile[--sp], x = k % W, y = (k - x) / W; t++;
        if(x > 0 && masque[k - 1] && !lab[k - 1]){ lab[k - 1] = n; pile[sp++] = k - 1; }
        if(x < W - 1 && masque[k + 1] && !lab[k + 1]){ lab[k + 1] = n; pile[sp++] = k + 1; }
        if(y > 0 && masque[k - W] && !lab[k - W]){ lab[k - W] = n; pile[sp++] = k - W; }
        if(y < H - 1 && masque[k + W] && !lab[k + W]){ lab[k + W] = n; pile[sp++] = k + W; }
        if(huit){
          if(x > 0 && y > 0 && masque[k - W - 1] && !lab[k - W - 1]){ lab[k - W - 1] = n; pile[sp++] = k - W - 1; }
          if(x < W - 1 && y > 0 && masque[k - W + 1] && !lab[k - W + 1]){ lab[k - W + 1] = n; pile[sp++] = k - W + 1; }
          if(x > 0 && y < H - 1 && masque[k + W - 1] && !lab[k + W - 1]){ lab[k + W - 1] = n; pile[sp++] = k + W - 1; }
          if(x < W - 1 && y < H - 1 && masque[k + W + 1] && !lab[k + W + 1]){ lab[k + W + 1] = n; pile[sp++] = k + W + 1; }
        }
      }
      tailles.push(t);
    }
    return { lab, tailles, n };
  }
  // Enveloppe convexe (contour du plateau) et point dedans
  function enveloppe(pts){
    pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const croix = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const bas = [], haut = [];
    for(const p of pts){ while(bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], p) <= 0) bas.pop(); bas.push(p); }
    for(let i = pts.length - 1; i >= 0; i--){ const p = pts[i]; while(haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p) <= 0) haut.pop(); haut.push(p); }
    return bas.slice(0, -1).concat(haut.slice(0, -1));
  }
  function dedansPoly(poly, x, y){
    let ok = false;
    for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const [xi, yi] = poly[i], [xj, yj] = poly[j]; if((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok; }
    return ok;
  }

  /* ---------- Le plateau (image réduite) ---------- */
  function chercherPlateau(img){
    // une image de 240 px suffit pour trier les dés (et c'est quatre fois plus rapide)
    const pas = Math.max(1, Math.floor(img.width / 240)), W = Math.floor(img.width / pas), H = Math.floor(img.height / pas), N = W * H, d = img.data;
    const cr = new Float32Array(N), cg = new Float32Array(N), lum = new Float32Array(N);
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const i = y * W + x, j = (y * pas * img.width + x * pas) * 4, r = d[j], g = d[j + 1], b = d[j + 2], s = r + g + b + 1; lum[i] = .299 * r + .587 * g + .114 * b; cr[i] = r / s; cg[i] = g / s; }
    // la couleur la plus fréquente au centre de l'image
    const Q = 20, histo = new Map();
    for(let y = Math.round(H * .2); y < H * .8; y += 2) for(let x = Math.round(W * .2); x < W * .8; x += 2){
      const i = y * W + x, cle = Math.min(Q - 1, cr[i] * Q * 1.5 | 0) * 4096 + Math.min(Q - 1, cg[i] * Q * 1.5 | 0) * 64 + Math.min(15, lum[i] / 16 | 0);
      histo.set(cle, (histo.get(cle) || 0) + 1);
    }
    let mode = 0, mv = -1; for(const [k, v] of histo) if(v > mv){ mv = v; mode = k; }
    const mr = ((mode / 4096 | 0) + .5) / Q / 1.5, mg = ((mode / 64 | 0) % 64 + .5) / Q / 1.5, ml = (mode % 64 + .5) * 16;
    const dans = (i, r0, g0, l0) => { const a = (cr[i] - r0) / .055, b = (cg[i] - g0) / .055, c = (lum[i] - l0) / (.42 * l0 + 26); return a * a + b * b + c * c < 1; };
    let masque = new Uint8Array(N);
    for(let i = 0; i < N; i++) masque[i] = dans(i, mr, mg, ml) ? 1 : 0;
    // corrigée morceau par morceau, en trois passes (un plateau est rarement éclairé partout pareil)
    const BL = Math.max(8, Math.round(BLOC / pas)), bx = Math.ceil(W / BL), by = Math.ceil(H / BL);
    for(let passe = 0; passe < 3; passe++){
      const ref = [];
      for(let j = 0; j < by; j++) for(let k = 0; k < bx; k++){
        let n = 0, sr = 0, sg = 0, sl = 0;
        for(let y = j * BL; y < Math.min(H, (j + 1) * BL); y++) for(let x = k * BL; x < Math.min(W, (k + 1) * BL); x++){ const i = y * W + x; if(masque[i]){ n++; sr += cr[i]; sg += cg[i]; sl += lum[i]; } }
        ref.push(n > BL * BL * .25 ? [sr / n, sg / n, sl / n] : null);
      }
      // la référence de chaque morceau : la sienne, sinon celle d'un voisin, sinon la couleur générale
      const refs = ref.map((q, idx) => {
        if(q) return q;
        const j = (idx / bx) | 0, k = idx % bx;
        for(const [a, b] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]){ if(j + a < 0 || j + a >= by || k + b < 0 || k + b >= bx) continue; const v = ref[(j + a) * bx + k + b]; if(v) return v; }
        return [mr, mg, ml];
      });
      for(let y = 0; y < H; y++){ const j = Math.min(by - 1, y / BL | 0); for(let x = 0; x < W; x++){ const q = refs[j * bx + Math.min(bx - 1, x / BL | 0)], i = y * W + x; masque[i] = dans(i, q[0], q[1], q[2]) ? 1 : 0; } }
    }
    const net = new Uint8Array(N);
    for(let y = 1; y < H - 1; y++) for(let x = 1; x < W - 1; x++){ const i = y * W + x; let s = 0; for(let a = -1; a <= 1; a++) for(let b = -1; b <= 1; b++) s += masque[i + a * W + b]; net[i] = s >= 5 ? 1 : 0; }
    masque = net;
    const zp = zones(masque, W, H);
    let pl = 0; for(let n = 1; n <= zp.n; n++) if(!pl || zp.tailles[n] > zp.tailles[pl]) pl = n;
    if(!pl || zp.tailles[pl] < N * .12) return null;
    const bord = [];
    for(let y = 0; y < H; y++){ let a = -1, b = -1; for(let x = 0; x < W; x++) if(zp.lab[y * W + x] === pl){ if(a < 0) a = x; b = x; } if(a >= 0) bord.push([a * pas, y * pas], [(b + 1) * pas, y * pas]); }
    return { contour:enveloppe(bord), aire:zp.tailles[pl] * pas * pas };
  }

  // Une tache est-elle un point de dé ? (renvoie { forme:true } si seulement sa forme ne va pas)
  function evaluer(G, st, sorte){
    const { W, H, gris, rgb } = G, { a, bw, bh, cx, cy, gp } = st, r = Math.sqrt(a / Math.PI);
    // rond ou allongé (moments) : un reflet, ou un point vu de biais sur une face de côté, est allongé
    const dd = Math.sqrt((st.vxx - st.vyy) ** 2 + 4 * st.vxy * st.vxy), allonge = Math.sqrt((st.vxx + st.vyy + dd) / Math.max(1e-6, st.vxx + st.vyy - dd));
    if(a / (bw * bh) < .45 || allonge > 1.6) return { forme:true };
    // l'anneau autour : la face du dé, de couleur unie et bien différente du point
    // (près d'un bord, une partie de l'anneau peut déborder : on garde les deux tiers qui se ressemblent)
    const ech = [];
    for(const f of [1.45, 1.9]) for(let t = 0; t < 20; t++){
      const ang = t / 20 * Math.PI * 2, xx = Math.round(cx + Math.cos(ang) * (f * r + 1)), yy = Math.round(cy + Math.sin(ang) * (f * r + 1));
      if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      ech.push(yy * W + xx);
    }
    if(ech.length < 30) return null;
    const vs = ech.map(i => gris[i]).sort((x, y) => x - y), med = vs[vs.length >> 1], contraste = sorte * (med - gp);
    if(contraste < 26) return null;
    const tol = Math.max(14, contraste * .3), bons = ech.filter(i => Math.abs(gris[i] - med) <= tol);
    if(bons.length < ech.length * .66) return null;
    let R = 0, Gc = 0, B = 0, ma = 0; for(const i of bons){ R += rgb[i * 4]; Gc += rgb[i * 4 + 1]; B += rgb[i * 4 + 2]; ma += gris[i]; }
    const n2 = bons.length; ma /= n2;
    // la vraie taille du point : les pixels plus proches du point que de la face (le seuil ne garde que son cœur)
    const mi = (ma + gp) / 2, Rz = r * 2 + 2; let aire = 0;
    for(let yy = Math.max(0, Math.round(cy - Rz)); yy <= Math.min(H - 1, cy + Rz); yy++) for(let xx = Math.max(0, Math.round(cx - Rz)); xx <= Math.min(W - 1, cx + Rz); xx++)
      if((xx - cx) ** 2 + (yy - cy) ** 2 <= Rz * Rz && sorte * (mi - gris[yy * W + xx]) > 0) aire++;
    return { x:cx, y:cy, r:Math.max(r, Math.sqrt(aire / Math.PI)), sorte, face:[R / n2, Gc / n2, B / n2], fg:ma, contraste:sorte * (ma - gp), allonge };
  }

  /* ---------- 1. Les points candidats (image fine) ---------- */
  function chercherPoints(G, demi){
    const { W, H, gris, rgb } = G, N = W * H;
    // la moyenne de chaque voisinage (image intégrale)
    const I = new Float64Array((W + 1) * (H + 1));
    for(let y = 0; y < H; y++){ let s = 0; for(let x = 0; x < W; x++){ s += gris[y * W + x]; I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + s; } }
    const fonce = new Uint8Array(N), clair = new Uint8Array(N);
    for(let y = 0; y < H; y++){
      const y0 = Math.max(0, y - demi), y1 = Math.min(H, y + demi + 1);
      for(let x = 0; x < W; x++){
        const x0 = Math.max(0, x - demi), x1 = Math.min(W, x + demi + 1);
        const m = (I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        const i = y * W + x, g = gris[i], e = Math.max(16, m * .17);
        if(g < m - e) fonce[i] = 1; else if(g > m + e) clair[i] = 1;
      }
    }
    const points = [];
    for(const [masque, sorte] of [[fonce, 1], [clair, -1]]){
      const z = zones(masque, W, H, true), n = z.n;
      const x0 = new Int32Array(n + 1).fill(1e9), x1 = new Int32Array(n + 1).fill(-1), y0 = new Int32Array(n + 1).fill(1e9), y1 = new Int32Array(n + 1).fill(-1);
      const sx = new Float64Array(n + 1), sy = new Float64Array(n + 1), sg = new Float64Array(n + 1), sxx = new Float64Array(n + 1), syy = new Float64Array(n + 1), sxy = new Float64Array(n + 1);
      for(let i = 0; i < N; i++){
        const k = z.lab[i]; if(!k) continue;
        const x = i % W, y = (i / W) | 0;
        if(x < x0[k]) x0[k] = x; if(x > x1[k]) x1[k] = x; if(y < y0[k]) y0[k] = y; if(y > y1[k]) y1[k] = y;
        sx[k] += x; sy[k] += y; sg[k] += gris[i]; sxx[k] += x * x; syy[k] += y * y; sxy[k] += x * y;
      }
      const amax = (demi * 1.15) ** 2, recouper = [];
      for(let k = 1; k <= n; k++){
        const a = z.tailles[k]; if(a < 5 || a > amax) continue;
        const cx = sx[k] / a, cy = sy[k] / a;
        const st = { a, bw:x1[k] - x0[k] + 1, bh:y1[k] - y0[k] + 1, cx, cy, gp:sg[k] / a, vxx:sxx[k] / a - cx * cx + 1 / 12, vyy:syy[k] / a - cy * cy + 1 / 12, vxy:sxy[k] / a - cx * cy };
        const p = evaluer(G, st, sorte);
        if(p && p.forme && a >= 12) recouper.push(k);                    // pas assez rond : un point collé à un reflet ?
        else if(p && !p.forme) points.push(p);
      }
      // un point collé à un reflet (ou à une ombre) : on ne garde que le cœur le plus net de la tache, et on regarde à nouveau
      if(recouper.length){
        const px = new Map(recouper.map(k => [k, []]));
        for(let i = 0; i < N; i++){ const l = px.get(z.lab[i]); if(l) l.push(i); }
        for(const l of px.values()){
          const vs = l.map(i => gris[i]), mn = Math.min(...vs), mx = Math.max(...vs);
          const coeur = new Set(l.filter(i => sorte < 0 ? gris[i] >= mn + (mx - mn) * .6 : gris[i] <= mn + (mx - mn) * .4));
          for(const dep of coeur){
            const pile = [dep], sous = []; coeur.delete(dep);
            while(pile.length){ const q = pile.pop(); sous.push(q); for(const v of [q - 1, q + 1, q - W, q + W, q - W - 1, q - W + 1, q + W - 1, q + W + 1]) if(coeur.has(v)){ coeur.delete(v); pile.push(v); } }
            if(sous.length < 5) continue;
            let a = sous.length, Sx = 0, Sy = 0, Sg = 0, Sxx = 0, Syy = 0, Sxy = 0, X0 = 1e9, X1 = -1, Y0 = 1e9, Y1 = -1;
            for(const q of sous){ const x = q % W, y = (q / W) | 0; Sx += x; Sy += y; Sg += gris[q]; Sxx += x * x; Syy += y * y; Sxy += x * y; X0 = Math.min(X0, x); X1 = Math.max(X1, x); Y0 = Math.min(Y0, y); Y1 = Math.max(Y1, y); }
            const cx = Sx / a, cy = Sy / a, p = evaluer(G, { a, bw:X1 - X0 + 1, bh:Y1 - Y0 + 1, cx, cy, gp:Sg / a, vxx:Sxx / a - cx * cx + 1 / 12, vyy:Syy / a - cy * cy + 1 / 12, vxy:Sxy / a - cx * cy }, sorte);
            if(p && !p.forme) points.push(p);
          }
        }
      }
    }
    return points;
  }

  /* ---------- 2. Les points d'un même dé ---------- */
  const ecartCouleur = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // même couleur de face ? la teinte compte plus que la lumière (une face est souvent plus éclairée d'un côté)
  const memeFace = (c, f) => {
    const sc = c[0] + c[1] + c[2] + 1, sf = f[0] + f[1] + f[2] + 1, lc = .299 * c[0] + .587 * c[1] + .114 * c[2], lf = .299 * f[0] + .587 * f[1] + .114 * f[2];
    return Math.hypot((c[0] / sc - f[0] / sf) / .06, (c[1] / sc - f[1] / sf) / .06, (lc - lf) / (.38 * lf + 22)) < 1;
  };
  // un reflet : la couleur de la face mélangée à du blanc (même dose de blanc sur les trois couleurs)
  const reflet = (c, f) => { const t = [0, 1, 2].map(k => (c[k] - f[k]) / (256 - f[k])); const m = (t[0] + t[1] + t[2]) / 3; return m > .08 && Math.max(...t) - Math.min(...t) < .22; };
  function regrouper(G, points, S, journal){
    const { W, H, rgb } = G, n = points.length;
    // deux points sur la même face : proches, même sorte, même couleur autour, et le trait de l'un à l'autre reste sur la face
    const surFace = (a, b) => {
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if(d > S * .95 || a.sorte !== b.sorte || !memeFace(a.face, b.face)) return false;
      const pas = Math.max(1, d / 24); let vus = 0, bons = 0;
      for(let t = 0; t <= d; t += pas){
        const x = a.x + (b.x - a.x) * t / d, y = a.y + (b.y - a.y) * t / d, u = t / d;
        if(points.some(p => Math.hypot(p.x - x, p.y - y) < p.r * 1.6 + 1.5)) continue;   // sur un point ou son halo flou (la face continue dessous)
        const i = (Math.round(y) * W + Math.round(x)) * 4; vus++;
        // la couleur attendue glisse de celle d'un point à celle de l'autre (dégradé de lumière)
        const face = [a.face[0] * (1 - u) + b.face[0] * u, a.face[1] * (1 - u) + b.face[1] * u, a.face[2] * (1 - u) + b.face[2] * u];
        // un reflet (blanc presque pur) compte comme la face : il est posé dessus
        const c = [rgb[i], rgb[i + 1], rgb[i + 2]];
        if(memeFace(c, face) || reflet(c, face)) bons++;
      }
      if(journal) journal.push([points.indexOf(a), points.indexOf(b), Math.round(d), +(bons / Math.max(1, vus)).toFixed(2)]);
      return vus < 3 || bons / vus > .75;
    };
    const lien = Array.from({ length:n }, () => new Uint8Array(n));
    const paires = [];
    for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++) if(surFace(points[i], points[j])){ lien[i][j] = lien[j][i] = 1; paires.push([Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y), i, j]); }
    paires.sort((a, b) => a[0] - b[0]);
    // regroupement : deux groupes s'unissent seulement si tous leurs points sont deux à deux sur la même face
    const groupe = points.map((_, i) => i), membres = points.map((_, i) => [i]);
    for(const [, i, j] of paires){
      const a = groupe[i], b = groupe[j]; if(a === b) continue;
      if(membres[a].length + membres[b].length > 6) continue;
      if(!membres[a].every(p => membres[b].every(q => lien[p][q]))) continue;
      for(const q of membres[b]){ groupe[q] = a; membres[a].push(q); } membres[b] = [];
    }
    return membres.filter(m => m.length).map(m => m.map(i => points[i]));
  }

  /* ---------- 3. Un groupe de points → un dé ---------- */
  function deDuGroupe(pts, S){
    const n = pts.length, cx = pts.reduce((s, p) => s + p.x, 0) / n, cy = pts.reduce((s, p) => s + p.y, 0) / n;
    let angle = 0, cote = S;
    if(n >= 2){
      // l'écart le plus court entre deux points donne la direction des côtés (sauf 2 et 3 : en diagonale)
      let best = null; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){ const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y); if(!best || d < best.d) best = { d, a:Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x) }; }
      let loin = null; for(let i = 0; i < n; i++) for(let j = i + 1; j < n; j++){ const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y); if(!loin || d > loin.d) loin = { d, a:Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x) }; }
      if(n <= 3){ angle = loin.a - Math.PI / 4; cote = loin.d / .735; }
      else { angle = best.a; cote = n === 6 ? best.d / .26 : best.d / .52; }
      cote = Math.max(S * .6, Math.min(S * 1.5, cote));
    }
    angle = ((angle % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    const fg = pts.reduce((s, p) => s + p.fg, 0) / n, allonge = pts.reduce((s, p) => s + p.allonge, 0) / n, r = pts.reduce((s, p) => s + p.r, 0) / n;
    return { cx, cy, cote, angle, v:n, pts, fg, allonge, r, sorte:pts[0].sorte, face:pts[0].face };
  }
  // Un seul point : est-ce bien un dé (le 1) ? La face doit l'entourer tout autour, assez loin.
  function vraiUn(G, d, S, rMed){
    const { W, H, rgb } = G, p = d.pts[0];
    if(p.r < rMed * .95) return false;                                   // le point du 1 est en général plus gros
    let vus = 0, bons = 0;
    for(let t = 0; t < 20; t++){
      const a = t / 20 * Math.PI * 2, x = Math.round(p.x + Math.cos(a) * S * .3), y = Math.round(p.y + Math.sin(a) * S * .3);
      if(x < 0 || y < 0 || x >= W || y >= H) continue; vus++;
      const i = (y * W + x) * 4, c = [rgb[i], rgb[i + 1], rgb[i + 2]]; if(memeFace(c, p.face) || reflet(c, p.face)) bons++;
    }
    return vus >= 16 && bons / vus > .75;
  }

  /* ---------- L'analyse complète ---------- */
  function analyser(petite, grande, memo = {}){
    const img = grande && grande.width >= petite.width ? grande : petite;
    const W = img.width, H = img.height, N = W * H, gris = new Uint8Array(N), q = img.data;
    for(let i = 0, j = 0; i < N; i++, j += 4) gris[i] = .299 * q[j] + .587 * q[j + 1] + .114 * q[j + 2];
    const G = { W, H, gris, rgb:q }, k = W / petite.width;
    // 1. les points : à l'échelle de la dernière image, sinon à deux échelles
    let points = [];
    const essais = memo.r ? [Math.round(Math.max(5, Math.min(70, memo.r * 3.6)))] : [Math.round(W * .013), Math.round(W * .03)];
    for(const demi of essais){
      for(const p of chercherPoints(G, Math.max(5, demi))) if(!points.some(o => Math.hypot(o.x - p.x, o.y - p.y) < Math.max(o.r, p.r))) points.push(p);
    }
    // les points d'une taille à part (miettes, taches) sont écartés ; le 1 peut être plus gros
    const rs = points.map(p => p.r).sort((a, b) => a - b), rMed = rs.length ? rs[rs.length >> 1] : 0;
    points = points.filter(p => p.r > rMed * .5 && p.r < rMed * 2.8);
    const S = rMed * 12;                                                // le côté d'un dé : un point fait environ 1/6 du côté
    // 2. les groupes, 3. les dés
    const journal = memo.debug ? [] : null;
    let des = regrouper(G, points, S, journal).map(g => deDuGroupe(g, S)).filter(d => d.v <= 6);
    des = des.filter(d => d.v > 1 || vraiUn(G, d, S, rMed));
    // les faces de côté : un groupe collé à un autre dé, sur une face plus sombre ou aux points écrasés, est oublié
    des = des.filter(d => !des.some(o => o !== d && Math.hypot(o.cx - d.cx, o.cy - d.cy) < (o.cote + d.cote) * .5 * .95 &&
      (d.fg < o.fg * .93 || d.allonge > o.allonge + .25 || (d.v < o.v && d.r < o.r * .85))));
    // 4. le plateau : dessus, les dés lancés ; à côté, les dés gardés ou mis de côté
    const plateau = chercherPlateau(petite);
    const res = { plateau, des:[], hors:[], rPoint:rMed || memo.r || 0 };
    for(const d of des){
      const de = { cx:d.cx / k, cy:d.cy / k, cote:d.cote / k, angle:d.angle, v:d.v, points:d.pts.map(p => [p.x / k, p.y / k]) };
      if(!plateau || dedansPoly(plateau.contour, de.cx, de.cy)) res.des.push(de); else res.hors.push(de);
    }
    res.des.sort((a, b) => a.cx - b.cx); res.hors.sort((a, b) => a.cx - b.cx);
    if(memo.debug) res.debug = { journal, faces:points.map(p => p.face.map(Math.round).join(',')), points:points.map(p => ({ x:p.x / k, y:p.y / k, r:p.r / k, sorte:p.sorte, c:Math.round(p.contraste), al:+p.allonge.toFixed(2) })), S:S / k, rMed:rMed / k };
    res.message = !res.des.length ? (plateau ? 'Plateau repéré : je ne vois pas encore de dé dessus.' : 'Je cherche les dés : visez-les d\'en haut, bien éclairés.') : '';
    return res;
  }

  // Mouvement entre deux images : moyenne des écarts sur une petite vignette
  function vignette(img, w = 32){
    const W = img.width, H = img.height, h = Math.max(1, Math.round(w * H / W)), out = new Float32Array(w * h);
    for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){ const i = ((y * H / h | 0) * W + (x * W / w | 0)) * 4; out[y * w + x] = .299 * img.data[i] + .587 * img.data[i + 1] + .114 * img.data[i + 2]; }
    return out;
  }
  const ecart = (a, b) => { if(!a || !b || a.length !== b.length) return 999; let s = 0; for(let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

  const api = { analyser, vignette, ecart };
  if(typeof window !== 'undefined') window.DesVision = api;
  // dans un worker : le calcul se fait à part, l'écran reste fluide
  else if(typeof self !== 'undefined') self.onmessage = e => { const { petite, grande, memo, id } = e.data; let res; try{ res = analyser(petite, grande, memo); }catch(err){ res = { erreur:String(err), des:[], hors:[] }; } self.postMessage({ id, res }); };
})();
