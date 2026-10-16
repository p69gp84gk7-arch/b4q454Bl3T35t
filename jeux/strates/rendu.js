/* Strates : rendu 3D (three.js). Le terrain est dessiné couche par couche, comme des courbes de niveau :
   chaque couche est une fine plaque au contour arrondi (placé entre les colonnes d'après un relief adouci),
   avec sa tranche colorée par le matériau (on voit les strates du sous-sol sur les falaises). */
(() => {
const { N, H, LH, SEA, MATS, ID, hash, clamp } = window.Monde;
const T = THREE;
let renderer, scene, camera, canvas, I = null;
const CH = 16, NCH = Math.ceil((N + 1) / CH);
let morceaux = [];
const sales = new Set();
let eauMesh, laveMesh, fluidesSales = true;
const groupeBats = new T.Group(), modeles = new Map();
const arbresMesh = {};
let corps, tetes, fantome, curseur;
const debris = [];
const cam = { x:N / 2, z:N / 2, dist:60, yaw:.6, pitch:.95 };
const FOV = 40;

/* ---------- Couleurs ---------- */
const DESSUS = MATS.map(m => m && new T.Color(m.dessus)), COTE = MATS.map(m => m && new T.Color(m.cote));
const HERBE_BAS = new T.Color('#A9D46F'), HERBE_HAUT = new T.Color('#4F8E4F'), HERBE_SABLE = new T.Color('#C9D98A');
const tmpA = new T.Color(), tmpB = new T.Color(), tmpC = new T.Color();
function herbe(L, out){ return out.copy(HERBE_BAS).lerp(HERBE_HAUT, clamp((L - SEA - 2) / 32, 0, 1)); }
function couleurDessus(mat, c, L, sommet, out){
  if(mat === ID.terre && sommet && L > SEA) herbe(L, out);
  else out.copy(DESSUS[mat] || DESSUS[ID.terre]);
  out.multiplyScalar((L % 2 ? 1 : .965) * (.98 + hash(c, L, 0, 7) * .04));
  return out;
}

/* ---------- Terrain ---------- */
const HAUT = [0, 1, 0];
function tri(P, No, C, a, b, c, n, ca, cb, cc){
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  if(nx * n[0] + ny * n[1] + nz * n[2] < 0){ const t = b; b = c; c = t; const u = cb; cb = cc; cc = u; }
  P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  No.push(n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]);
  C.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
}
const hauteur = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : I.h[j * N + i];
// Relief adouci : sert seulement à placer le contour de chaque couche entre deux colonnes (bords arrondis)
const adouci = (i, j) => (2 * hauteur(i, j) + hauteur(i + 1, j) + hauteur(i - 1, j) + hauteur(i, j + 1) + hauteur(i, j - 1)) / 6;
const K = [[0, 0], [1, 0], [1, 1], [0, 1]];
// Une cellule entre les centres de 4 colonnes voisines : pour chaque couche, la partie de la plaque qui s'y trouve
function cellule(di, dj, P, No, C){
  const hs = [hauteur(di, dj), hauteur(di + 1, dj), hauteur(di + 1, dj + 1), hauteur(di, dj + 1)];
  const lo = Math.min(hs[0], hs[1], hs[2], hs[3]), hi = Math.max(hs[0], hs[1], hs[2], hs[3]);
  if(hi === 0) return;
  const x0 = di + .5, z0 = dj + .5;
  const sm = lo === hi ? null : [adouci(di, dj), adouci(di + 1, dj), adouci(di + 1, dj + 1), adouci(di, dj + 1)];
  for(let L = Math.max(1, lo); L <= hi; L++){
    const poly = [], milieu = [];
    for(let k = 0; k < 4; k++){
      const k2 = (k + 1) % 4, a = hs[k] >= L, b = hs[k2] >= L, pa = K[k], pb = K[k2];
      if(a){ poly.push([x0 + pa[0], z0 + pa[1]]); milieu.push(false); }
      if(a !== b){
        // Point du contour sur l'arête : depuis le coin dans la couche vers le coin dehors
        const ki = a ? k : k2, ko = a ? k2 : k, si = sm[ki], so = sm[ko];
        const t = clamp(si > so ? (si - (L - .5)) / (si - so) : .5, .12, .88);
        poly.push([x0 + K[ki][0] + (K[ko][0] - K[ki][0]) * t, z0 + K[ki][1] + (K[ko][1] - K[ki][1]) * t]);
        milieu.push(true);
      }
    }
    let kc = -1;
    for(let k = 0; k < 4; k++) if(hs[k] === L){ kc = k; break; }
    if(kc < 0) for(let k = 0; k < 4; k++) if(hs[k] >= L){ kc = k; break; }
    const c = (dj + K[kc][1]) * N + di + K[kc][0];
    const mat = I.m[c * H + L - 1] || ID.terre, sommet = hs[kc] === L;
    const top = couleurDessus(mat, c, L, sommet, tmpA);
    const y = L * LH;
    for(let t = 1; t + 1 < poly.length; t++)
      tri(P, No, C, [poly[0][0], y, poly[0][1]], [poly[t][0], y, poly[t][1]], [poly[t + 1][0], y, poly[t + 1][1]], HAUT, top, top, top);
    if(L <= lo) continue;
    // Tranches : le long du contour (entre deux milieux d'arêtes)
    let gx = 0, gz = 0;
    poly.forEach(p => { gx += p[0]; gz += p[1]; });
    gx /= poly.length; gz /= poly.length;
    const cote = COTE[mat] || COTE[ID.terre];
    const f = (L % 2 ? 1 : .94);
    const haut = mat === ID.terre && sommet && L > SEA ? herbe(L, tmpB).multiplyScalar(.9) : tmpB.copy(cote).multiplyScalar(f);
    const bas = tmpC.copy(cote).multiplyScalar(.8 * f);
    const y0 = (L - 1) * LH;
    for(let t = 0; t < poly.length; t++){
      const u = (t + 1) % poly.length;
      if(!(milieu[t] && milieu[u])) continue;
      const p = poly[t], q = poly[u];
      let nx = q[1] - p[1], nz = -(q[0] - p[0]);
      const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      if(nx * ((p[0] + q[0]) / 2 - gx) + nz * ((p[1] + q[1]) / 2 - gz) < 0){ nx = -nx; nz = -nz; }
      const n = [nx, 0, nz];
      const A = [p[0], y0, p[1]], B = [q[0], y0, q[1]], Cc = [q[0], y, q[1]], D = [p[0], y, p[1]];
      tri(P, No, C, A, B, Cc, n, bas, bas, haut);
      tri(P, No, C, A, Cc, D, n, bas, haut, haut);
    }
  }
}
const matTerrain = new T.MeshLambertMaterial({ vertexColors:true });
function construireMorceau(ci, cj){
  const P = [], No = [], C = [];
  const di0 = ci * CH - 1, dj0 = cj * CH - 1;
  for(let dj = dj0; dj < Math.min(dj0 + CH, N); dj++) for(let di = di0; di < Math.min(di0 + CH, N); di++) cellule(di, dj, P, No, C);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(No, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere();
  const k = cj * NCH + ci;
  if(morceaux[k]){ morceaux[k].geometry.dispose(); morceaux[k].geometry = g; }
  else { morceaux[k] = new T.Mesh(g, matTerrain); scene.add(morceaux[k]); }
}
function majCellule(c){
  const i = c % N, j = (c / N) | 0;
  for(let dj = j - 2; dj <= j + 1; dj++) for(let di = i - 2; di <= i + 1; di++){
    const ci = Math.floor((di + 1) / CH), cj = Math.floor((dj + 1) / CH);
    if(ci >= 0 && cj >= 0 && ci < NCH && cj < NCH) sales.add(cj * NCH + ci);
  }
}

/* ---------- Eau et lave ---------- */
const coinH = new Float32Array((N + 1) * (N + 1)), surf = new Float32Array(N * N);
const EAU_CLAIRE = new T.Color('#A6E1F1'), EAU_FONCEE = new T.Color('#7CC4E2'), LAVE_A = new T.Color('#FF7A1F'), LAVE_B = new T.Color('#FFD45C');
function construireFluide(f, mesh, eau){
  for(let c = 0; c < N * N; c++) surf[c] = f[c] > .03 ? (I.h[c] + f[c]) * LH + .02 : -1;
  for(let j = 0; j <= N; j++) for(let i = 0; i <= N; i++){
    let s = 0, n = 0;
    for(let b = j - 1; b <= j; b++) for(let a = i - 1; a <= i; a++){
      if(a < 0 || b < 0 || a >= N || b >= N) continue;
      const v = surf[b * N + a];
      if(v >= 0){ s += v; n++; }
    }
    coinH[j * (N + 1) + i] = n ? s / n : 0;
  }
  const P = [], No = [], C = [];
  for(let j = 0; j < N; j++) for(let i = 0; i < N; i++){
    const c = j * N + i;
    if(surf[c] < 0) continue;
    const y00 = coinH[j * (N + 1) + i], y10 = coinH[j * (N + 1) + i + 1], y11 = coinH[(j + 1) * (N + 1) + i + 1], y01 = coinH[(j + 1) * (N + 1) + i];
    const col = eau ? tmpA.copy(EAU_CLAIRE).lerp(EAU_FONCEE, clamp(f[c] / 6, 0, 1)) : tmpA.copy(LAVE_A).lerp(LAVE_B, hash(i, j, 1, 3) * .7);
    tri(P, No, C, [i, y00, j], [i + 1, y10, j], [i + 1, y11, j + 1], HAUT, col, col, col);
    tri(P, No, C, [i, y00, j], [i + 1, y11, j + 1], [i, y01, j + 1], HAUT, col, col, col);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(No, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere();
  mesh.geometry.dispose();
  mesh.geometry = g;
}

/* ---------- Petits modèles (arbres, bâtiments, habitants) ---------- */
const mats = {};
const matObj = hex => mats[hex] || (mats[hex] = new T.MeshLambertMaterial({ color:hex, flatShading:true }));
const matLum = hex => mats['L' + hex] || (mats['L' + hex] = new T.MeshBasicMaterial({ color:hex }));
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
// Plusieurs formes en une seule géométrie, chacune avec sa couleur
function fusion(parts){
  const P = [], No = [], C = [];
  for(const [geo, hex, m] of parts){
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if(m) g.applyMatrix4(m);
    const p = g.attributes.position.array, n = g.attributes.normal.array, c = new T.Color(hex);
    for(let i = 0; i < p.length; i += 3){ P.push(p[i], p[i + 1], p[i + 2]); No.push(n[i], n[i + 1], n[i + 2]); C.push(c.r, c.g, c.b); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(No, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
  return g;
}
const cyl = (a, b, h, s = 6) => new T.CylinderGeometry(a, b, h, s);
const cone = (r, h, s = 7) => new T.ConeGeometry(r, h, s);
const ico = r => new T.IcosahedronGeometry(r, 0);
const boiteG = (w, h, d) => new T.BoxGeometry(w, h, d);
function geoArbre(k){
  const tronc = '#8A5A35';
  if(k === 1) return fusion([[cyl(.05, .07, .36), tronc, M4(0, .18, 0)], [ico(.3), '#6FAE4E', M4(0, .52, 0)], [ico(.21), '#84C25A', M4(.1, .72, .04)], [ico(.16), '#5E9C45', M4(-.12, .64, -.06)]]);
  if(k === 2) return fusion([[cyl(.05, .06, .26), tronc, M4(0, .13, 0)], [cone(.3, .44), '#3F7F4E', M4(0, .42, 0)], [cone(.23, .38), '#4A8D57', M4(0, .66, 0)], [cone(.14, .3), '#559A5F', M4(0, .88, 0)]]);
  if(k === 3){
    const parts = [[cyl(.035, .055, .75), '#A07A52', M4(.06, .37, 0, 1, 1, 1, 0, 0, -.16)]];
    for(let a = 0; a < 6; a++) parts.push([boiteG(.42, .03, .11), a % 2 ? '#5DAA48' : '#6CBB52', M4(.12 + Math.cos(a * 1.05) * .17, .72, Math.sin(a * 1.05) * .17, 1, 1, 1, 0, -a * 1.05, -.35)]);
    parts.push([ico(.06), '#7A5A3A', M4(.12, .72, 0)]);
    return fusion(parts);
  }
  if(k === 4) return fusion([[cyl(.075, .08, .52, 7), '#5E9E57', M4(0, .26, 0)], [cyl(.045, .045, .2, 6), '#69A961', M4(.13, .34, 0)], [cyl(.04, .04, .1, 6), '#69A961', M4(.08, .24, 0, 1, 1, 1, 0, 0, 1.57)],
    [cyl(.04, .04, .16, 6), '#69A961', M4(-.12, .28, 0)], [cyl(.035, .035, .08, 6), '#69A961', M4(-.08, .2, 0, 1, 1, 1, 0, 0, 1.57)], [ico(.05), '#F28AB0', M4(0, .54, 0)]]);
  return fusion([[cyl(.05, .06, .24), tronc, M4(0, .12, 0)], [cone(.3, .44), '#3E7A55', M4(0, .4, 0)], [cone(.2, .14), '#F5F8FC', M4(0, .56, 0)],
    [cone(.22, .36), '#47865E', M4(0, .64, 0)], [cone(.15, .13), '#F5F8FC', M4(0, .78, 0)], [cone(.13, .26), '#F5F8FC', M4(0, .9, 0)]]);
}
const matArbres = new T.MeshLambertMaterial({ vertexColors:true, flatShading:true });
function majArbres(){
  const parType = { 1:[], 2:[], 3:[], 4:[], 5:[] };
  for(let c = 0; c < N * N; c++) if(I.arbres[c]) parType[I.arbres[c]].push(c);
  const m = new T.Matrix4();
  for(const k of [1, 2, 3, 4, 5]){
    const mesh = arbresMesh[k], liste = parType[k];
    mesh.count = Math.min(liste.length, mesh.instanceMatrix.count);
    for(let n = 0; n < mesh.count; n++){
      const c = liste[n], i = c % N, j = (c / N) | 0, r = hash(i, j, 5, 11), s = .8 + hash(i, j, 6, 11) * .45;
      m.compose(new T.Vector3(i + .5 + (r - .5) * .3, I.h[c] * LH, j + .5 + (hash(i, j, 7, 11) - .5) * .3),
        new T.Quaternion().setFromEuler(new T.Euler(0, r * 6.28, 0)), new T.Vector3(s, s, s));
      mesh.setMatrixAt(n, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// Toit à deux pentes : un prisme triangulaire
function toitG(w, h, d){
  const x = w / 2, z = d / 2;
  const v = [[-x, 0, -z], [x, 0, -z], [0, h, -z], [-x, 0, z], [x, 0, z], [0, h, z]];
  const f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4]];
  const p = [];
  f.forEach(t => t.forEach(k => p.push(...v[k])));
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}
function ajoute(g, geo, hex, x, y, z, ry = 0, lum = false){
  const m = new T.Mesh(geo, lum ? matLum(hex) : matObj(hex));
  m.position.set(x, y, z); m.rotation.y = ry;
  g.add(m);
  return m;
}
const boite = (g, w, h, d, x, y, z, hex, ry = 0, lum = false) => ajoute(g, boiteG(w, h, d), hex, x, y, z, ry, lum);
function modele(b){
  const g = new T.Group();
  const k = b.k;
  if(k === 'cabane'){
    boite(g, .5, .34, .5, 0, .17, 0, '#A8774A');
    const t = ajoute(g, cone(.47, .34, 4), '#E2C26A', 0, .51, 0); t.rotation.y = Math.PI / 4;
    boite(g, .12, .2, .02, 0, .1, .26, '#5A3B22');
  } else if(k === 'maison'){
    boite(g, .66, .42, .56, 0, .21, 0, '#F4EBD6');
    ajoute(g, toitG(.76, .32, .66), '#C9573F', 0, .42, 0);
    boite(g, .08, .22, .08, .2, .62, .1, '#9C5A45');
    boite(g, .14, .24, .02, 0, .12, .29, '#6B4428');
    boite(g, .12, .1, .02, -.21, .27, .29, '#9BD3E6'); boite(g, .12, .1, .02, .21, .27, .29, '#9BD3E6');
  } else if(k === 'villa'){
    boite(g, .86, .48, .7, 0, .24, 0, '#FBF6EA');
    ajoute(g, toitG(.96, .3, .8), '#4F7DBA', 0, .48, 0);
    boite(g, .26, .82, .26, .36, .41, .3, '#FBF6EA');
    const t = ajoute(g, cone(.24, .26, 4), '#4F7DBA', .36, .95, .3); t.rotation.y = Math.PI / 4;
    boite(g, .16, .26, .02, -.1, .13, .36, '#6B4428');
    [-.32, .12].forEach(x => boite(g, .14, .12, .02, x, .32, .36, '#9BD3E6'));
    boite(g, .1, .12, .02, .36, .62, .44, '#9BD3E6');
  } else if(k === 'ferme'){
    for(let r = 0; r < 4; r++) boite(g, 1.2, .06, .34, -.3, .03, -.66 + r * .42, r % 2 ? '#D9B84A' : '#8DBF4F');
    boite(g, .5, .4, .5, .62, .2, -.5, '#B5442F');
    ajoute(g, toitG(.6, .28, .58), '#F2EEE6', .62, .4, -.5, Math.PI / 2);
    boite(g, .16, .22, .02, .62, .11, -.24, '#F2EEE6');
    ajoute(g, cyl(.13, .13, .5, 8), '#C8C2B4', .62, .25, .45);
    ajoute(g, cone(.15, .16, 8), '#B5442F', .62, .58, .45);
  } else if(k === 'atelier'){
    boite(g, .66, .38, .56, 0, .19, 0, '#B98552');
    ajoute(g, toitG(.74, .26, .64), '#6D5A4B', 0, .38, 0);
    boite(g, .18, .1, .08, .1, .26, .38, '#3E3E44'); boite(g, .08, .16, .06, .1, .1, .38, '#3E3E44');
    ajoute(g, cyl(.05, .05, .3, 6), '#8A5A35', -.36, .06, .3).rotation.z = Math.PI / 2;
    ajoute(g, cyl(.05, .05, .3, 6), '#7A4E2E', -.36, .15, .3).rotation.z = Math.PI / 2;
  } else if(k === 'four'){
    ajoute(g, new T.SphereGeometry(.36, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#A3A098', 0, 0, 0);
    ajoute(g, cyl(.07, .08, .32, 6), '#8C8982', .16, .4, -.12);
    boite(g, .16, .14, .04, 0, .1, .34, '#FF8A2A', 0, true);
  } else if(k === 'port'){
    const a = b.dir || 0, gp = new T.Group();
    boite(gp, 1.25, .06, .42, .45, .02, 0, '#B07D4F');
    for(const x of [.1, .55, 1.0]) for(const z of [-.18, .18]) boite(gp, .06, .5, .06, x, -.2, z, '#7A5333');
    const bateau = new T.Group();
    boite(bateau, .58, .14, .24, 0, 0, 0, '#8E5B34'); boite(bateau, .5, .03, .2, 0, .08, 0, '#C9965E');
    ajoute(bateau, cyl(.015, .015, .5, 4), '#5A3B22', 0, .32, 0);
    ajoute(bateau, toitG(.02, .36, .3), '#F7F3EA', .08, .14, 0, Math.PI / 2);
    bateau.position.set(1.35, (SEA - b.y0) * LH + .02, .3);
    gp.add(bateau);
    gp.rotation.y = a;
    g.add(gp);
  } else if(k === 'fontaine'){
    ajoute(g, cyl(.36, .4, .14, 12), '#B8B4A8', 0, .07, 0);
    ajoute(g, cyl(.3, .3, .02, 12), '#8FD3EE', 0, .145, 0);
    ajoute(g, cyl(.05, .07, .32, 8), '#B8B4A8', 0, .26, 0);
    ajoute(g, cyl(.14, .06, .06, 10), '#B8B4A8', 0, .42, 0);
    ajoute(g, ico(.05), '#BDE7F5', 0, .5, 0);
  } else if(k === 'statue'){
    boite(g, .34, .24, .34, 0, .12, 0, '#D9D4C7');
    ajoute(g, cyl(.08, .11, .32, 8), '#F1EFE9', 0, .4, 0);
    ajoute(g, new T.SphereGeometry(.08, 8, 6), '#F1EFE9', 0, .63, 0);
    boite(g, .04, .22, .04, .1, .62, 0, '#F1EFE9').rotation.z = -.4;
  } else if(k === 'temple'){
    boite(g, 1.76, .1, 1.76, 0, .05, 0, '#E7E1D2');
    boite(g, 1.54, .1, 1.54, 0, .15, 0, '#EFEADD');
    for(let a = 0; a < 3; a++) for(let b2 = 0; b2 < 3; b2++) if(a !== 1 || b2 !== 1) ajoute(g, cyl(.06, .07, .6, 8), '#F7F4EC', -.6 + a * .6, .5, -.6 + b2 * .6);
    boite(g, 1.5, .08, 1.5, 0, .84, 0, '#EFEADD');
    ajoute(g, toitG(1.6, .38, 1.6), '#E8C14E', 0, .88, 0);
    boite(g, .3, .3, .3, 0, .35, 0, '#9BE6F2', 0, true);
  } else if(k === 'phare'){
    ajoute(g, cyl(.18, .25, 1.3, 10), '#F7F4EE', 0, .65, 0);
    ajoute(g, cyl(.205, .222, .16, 10), '#D24B3E', 0, .42, 0);
    ajoute(g, cyl(.185, .2, .16, 10), '#D24B3E', 0, .9, 0);
    ajoute(g, cyl(.15, .15, .2, 10), '#FFE58A', 0, 1.4, 0, 0, true);
    ajoute(g, cone(.22, .2, 10), '#D24B3E', 0, 1.6, 0);
  }
  return g;
}
function majBatiments(){
  const vus = new Set();
  for(const b of I.bat){
    vus.add(b.id);
    let e = modeles.get(b.id);
    if(e && e.k !== b.k){ groupeBats.remove(e.g); modeles.delete(b.id); e = null; }
    if(!e){
      const t = b.t || 1;
      b.y0 = I.h[b.j * N + b.i];
      const g = modele(b);
      g.position.set(b.i + t / 2, b.y0 * LH, b.j + t / 2);
      g.userData.nais = performance.now();
      groupeBats.add(g);
      modeles.set(b.id, { k:b.k, g });
    }
  }
  for(const [id, e] of modeles) if(!vus.has(id)){ groupeBats.remove(e.g); modeles.delete(id); }
}

/* ---------- Habitants ---------- */
const COULEURS_HAB = ['#E4572E', '#F3A712', '#4F86C6', '#7BB662', '#A05EB5', '#E86A92', '#2EC4B6', '#F2F2F2'].map(h => new T.Color(h));
const PEAU = [new T.Color('#F1C9A5'), new T.Color('#D9A57B'), new T.Color('#A86F4C'), new T.Color('#F5D7BD')];
const MAXHAB = 500;
function majHabitants(liste, t){
  const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(1, 1, 1), p = new T.Vector3();
  let n = 0;
  for(const h of liste){
    if(h.dedans || n >= MAXHAB) continue;
    const saut = h.marche ? Math.abs(Math.sin(t * 11 + h.id)) * .035 : 0;
    q.setFromEuler(new T.Euler(0, h.ang || 0, 0));
    p.set(h.x, h.y + .11 + saut, h.z); m.compose(p, q, s); corps.setMatrixAt(n, m);
    p.set(h.x, h.y + .27 + saut, h.z); m.compose(p, q, s); tetes.setMatrixAt(n, m);
    corps.setColorAt(n, COULEURS_HAB[h.coul % COULEURS_HAB.length]);
    tetes.setColorAt(n, PEAU[h.id % PEAU.length]);
    n++;
  }
  corps.count = tetes.count = n;
  corps.instanceMatrix.needsUpdate = tetes.instanceMatrix.needsUpdate = true;
  if(corps.instanceColor) corps.instanceColor.needsUpdate = true;
  if(tetes.instanceColor) tetes.instanceColor.needsUpdate = true;
}

/* ---------- Effets : éclats de terre quand on creuse ---------- */
const geoEclat = boiteG(.12, .12, .12);
function eclats(i, j, mat, nb = 6){
  const c = j * N + i, y = I.h[c] * LH + .1;
  for(let k = 0; k < nb; k++){
    let d = debris.find(x => !x.visible);
    if(!d){ if(debris.length > 80) return; d = new T.Mesh(geoEclat, new T.MeshLambertMaterial({ color:'#fff' })); scene.add(d); debris.push(d); }
    d.visible = true;
    d.material.color.copy(DESSUS[mat] || DESSUS[ID.terre]);
    d.position.set(i + .5 + (Math.random() - .5) * .5, y, j + .5 + (Math.random() - .5) * .5);
    d.userData = { vx:(Math.random() - .5) * 2.4, vy:2 + Math.random() * 2, vz:(Math.random() - .5) * 2.4, vie:.7 };
  }
}
function majEclats(dt){
  for(const d of debris){
    if(!d.visible) continue;
    const u = d.userData;
    u.vie -= dt; u.vy -= 9 * dt;
    d.position.x += u.vx * dt; d.position.y += u.vy * dt; d.position.z += u.vz * dt;
    d.rotation.x += dt * 5; d.rotation.y += dt * 4;
    d.scale.setScalar(Math.max(.01, u.vie / .7));
    if(u.vie <= 0) d.visible = false;
  }
}

/* ---------- Fantôme d'un bâtiment à poser, curseur du pinceau ---------- */
function montrerFantome(t, i, j, ok){
  if(i == null){ fantome.visible = false; return; }
  const h = I.h[j * N + i];
  fantome.visible = true;
  fantome.scale.set(t * .96, 1, t * .96);
  fantome.position.set(i + t / 2, h * LH + .3, j + t / 2);
  fantome.material.color.set(ok ? '#5BD17A' : '#E5534B');
}
function montrerCurseur(i, j, r){
  if(i == null){ curseur.visible = false; return; }
  curseur.visible = true;
  curseur.scale.setScalar(r + .5);
  curseur.position.set(i + .5, I.h[j * N + i] * LH + .05, j + .5);
}

/* ---------- Caméra ---------- */
const Y0 = () => SEA * LH + 1;
function placerCamera(){
  inclinaison();
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  camera.position.set(cam.x + Math.sin(cam.yaw) * cp * cam.dist, Y0() + sp * cam.dist, cam.z + Math.cos(cam.yaw) * cp * cam.dist);
  camera.lookAt(cam.x, Y0(), cam.z);
}
function deplacer(dx, dy){
  const k = cam.dist * 2 * Math.tan(FOV / 2 * Math.PI / 180) / Math.max(1, canvas.clientHeight);
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  const v = 1 / Math.max(.4, Math.sin(cam.pitch));
  cam.x = clamp(cam.x - rx * dx * k + fx * dy * k * v, -4, N + 4);
  cam.z = clamp(cam.z - rz * dx * k + fz * dy * k * v, -4, N + 4);
}
// Plus on s'approche, plus la vue s'incline (comme dans Godus)
const inclinaison = () => { cam.pitch = .72 + clamp((cam.dist - 10) / 150, 0, 1) * .55; };
const zoomer = f => { cam.dist = clamp(cam.dist * f, 10, 160); inclinaison(); };
const tourner = da => { cam.yaw += da; };
const centrer = (i, j) => { cam.x = i + .5; cam.z = j + .5; };

// Case de terrain sous un point de l'écran : on avance le long du rayon jusqu'à toucher le dessus d'une colonne
const ray = new T.Raycaster(), ndc = new T.Vector2();
function viser(px, py){
  if(!I) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set((px - r.left) / r.width * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  let t = 0;
  if(o.y > H * LH && d.y < 0) t = (o.y - H * LH) / -d.y;
  for(let k = 0; k < 14000; k++, t += .035){
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    if(y < 0) return null;
    const i = Math.floor(x), j = Math.floor(z);
    if(i < 0 || j < 0 || i >= N || j >= N){ if(y < LH) return null; continue; }
    if(y <= I.h[j * N + i] * LH) return { i, j, c:j * N + i };
  }
  return null;
}

/* ---------- Mise en place ---------- */
function init(cv){
  canvas = cv;
  renderer = new T.WebGLRenderer({ canvas, antialias:true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  scene = new T.Scene();
  scene.background = new T.Color('#CFEAF4');
  scene.fog = new T.Fog('#CFEAF4', 140, 380);
  camera = new T.PerspectiveCamera(FOV, 1, .5, 1200);
  scene.add(new T.HemisphereLight('#FFFFFF', '#8FA37A', .58));
  const sol = new T.DirectionalLight('#FFF1D8', .72);
  sol.position.set(-30, 60, 25);
  scene.add(sol);
  // La mer autour de l'île et son fond de sable
  const fond = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshLambertMaterial({ color:'#F1DDA4' }));
  fond.rotation.x = -Math.PI / 2; fond.position.set(N / 2, LH - .01, N / 2);
  scene.add(fond);
  const mer = new T.MeshLambertMaterial({ color:'#7CC4E2', transparent:true, opacity:.88 });
  for(const [x, z, w, d] of [[-1000, N / 2, 2000, 2000 + N], [N + 1000, N / 2, 2000, 2000 + N], [N / 2, -1000, N, 2000], [N / 2, N + 1000, N, 2000]]){
    const p = new T.Mesh(new T.PlaneGeometry(w, d), mer);
    p.rotation.x = -Math.PI / 2; p.position.set(x, SEA * LH + .025, z);
    scene.add(p);
  }
  eauMesh = new T.Mesh(new T.BufferGeometry(), new T.MeshLambertMaterial({ vertexColors:true, transparent:true, opacity:.88 }));
  laveMesh = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({ vertexColors:true }));
  eauMesh.renderOrder = 2;
  scene.add(eauMesh, laveMesh, groupeBats);
  for(const k of [1, 2, 3, 4, 5]){
    arbresMesh[k] = new T.InstancedMesh(geoArbre(k), matArbres, 7000);
    arbresMesh[k].count = 0;
    scene.add(arbresMesh[k]);
  }
  corps = new T.InstancedMesh(cyl(.06, .085, .2, 7), new T.MeshLambertMaterial({ color:'#fff' }), MAXHAB);
  tetes = new T.InstancedMesh(new T.SphereGeometry(.07, 8, 6), new T.MeshLambertMaterial({ color:'#fff' }), MAXHAB);
  corps.count = tetes.count = 0;
  corps.frustumCulled = tetes.frustumCulled = false;
  scene.add(corps, tetes);
  fantome = new T.Mesh(boiteG(1, .6, 1), new T.MeshBasicMaterial({ color:'#5BD17A', transparent:true, opacity:.45, depthWrite:false }));
  fantome.visible = false;
  curseur = new T.Mesh(new T.RingGeometry(.86, 1, 40), new T.MeshBasicMaterial({ color:'#FFFFFF', transparent:true, opacity:.85, depthWrite:false }));
  curseur.rotation.x = -Math.PI / 2; curseur.visible = false; curseur.renderOrder = 3;
  scene.add(fantome, curseur);
  taille();
  window.addEventListener('resize', taille);
}
function taille(){
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function charger(ile){
  I = ile;
  for(let cj = 0; cj < NCH; cj++) for(let ci = 0; ci < NCH; ci++) construireMorceau(ci, cj);
  sales.clear();
  for(const [, e] of modeles) groupeBats.remove(e.g);
  modeles.clear();
  majBatiments(); majArbres();
  fluidesSales = true;
  scene.fog.color.set(I.type === 'volcan' ? '#E6D9D2' : I.type === 'glaces' ? '#E3F0F7' : I.type === 'sables' ? '#F2E7CF' : '#CFEAF4');
  scene.background.copy(scene.fog.color);
}
let dernierFluide = 0;
function rendre(dt, habitants, t){
  for(const k of sales) construireMorceau(k % NCH, Math.floor(k / NCH));
  sales.clear();
  if(fluidesSales && t - dernierFluide > .2){ construireFluide(I.w, eauMesh, true); construireFluide(I.l, laveMesh, false); fluidesSales = false; dernierFluide = t; }
  laveMesh.material.color.setScalar(.9 + Math.sin(t * 3) * .1);
  const maintenant = performance.now();
  for(const [, e] of modeles){
    const n = e.g.userData.nais;
    if(n){ const a = Math.min(1, (maintenant - n) / 900); e.g.scale.set(1, .05 + .95 * (1 - (1 - a) ** 3), 1); if(a >= 1) e.g.userData.nais = 0; }
  }
  majHabitants(habitants, t);
  majEclats(dt);
  placerCamera();
  renderer.render(scene, camera);
}

// Position à l'écran du dessus d'une case (pour les tests)
function ecran(i, j){
  const v = new T.Vector3(i + .5, I.h[j * N + i] * LH, j + .5).project(camera), r = canvas.getBoundingClientRect();
  return { x:r.left + (v.x + 1) / 2 * r.width, y:r.top + (1 - v.y) / 2 * r.height };
}
window.Rendu = { ecran, init, charger, rendre, majCellule, majArbres, majBatiments, eclats, viser, montrerFantome, montrerCurseur,
  deplacer, zoomer, tourner, centrer, cam, fluides:() => { fluidesSales = true; }, taille };
})();
