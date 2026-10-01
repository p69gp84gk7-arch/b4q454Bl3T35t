'use strict';
/* Nivoculteur · modèles 3D — toutes les formes du jeu
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   4. MODELES 3D — terrain, décor, canon, regard, salle de pompage, armoire électrique, télésiège
   Formes simples assemblées par le code. Les pièces fixes d'un objet sont fusionnées en une seule
   forme (rapide à afficher) ; les pièces qui bougent (hélice, couvercle, aiguilles…) restent à part.
   ===================================================================================== */

const COULEURS = {
  neige: '#9FB0CF', neigeBord: '#C9D5EA', piste: '#F2F6FD', rocher: '#4F586A', bache: '#363E4C',
  sapin: '#1E4A3A', sapinNeige: '#E6EEF8', tronc: '#4A3426',
  beton: '#8E949B', betonClair: '#A7ADB3', galva: '#9AA3AD', acier: '#5D6B7A', acierFonce: '#3B4250', noir: '#1C1F25',
  canon: '#F2C230', canonBande: '#2B3240', buse: '#E6E9ED',
  moteur: '#2F5FB3', pompe: '#A3322B', volant: '#D7263D', jaune: '#F2C230', orange: '#E58A1F',
  conduiteEau: '#4A6C8E', armoire: '#C5CBD2', mur: '#B7AE9F', toit: '#4A5363', neigeToit: '#EEF3FA',
  bois: '#7A5638', siege: '#2F6FDE', fenetre: '#FFD58A', eau: '#173A63',
  reseauEau: '#3D9BFF', reseauElec: '#FFD23A', reseauAir: '#E8EDF5',
  jalons: { verte: '#2E9E5B', bleue: '#2F6FDE', rouge: '#D7263D', noire: '#1A1A1A' },
  voyants: { arret: '#FF3B4A', production: '#38D66B', faible: '#38D66B', defaut: '#FFD23A' }   // rouge : arrêt, vert : en marche, jaune : défaut
};

// Matériaux partagés
const _materiaux = {};
function materiau(type){
  if(!_materiaux[type]){
    if(type === 'sommets') _materiaux[type] = new THREE.MeshLambertMaterial({ vertexColors: true });
    else if(type === 'sommets2') _materiaux[type] = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    else if(type === 'lumineux') _materiaux[type] = new THREE.MeshBasicMaterial({ vertexColors: true });
  }
  return _materiaux[type];
}

// Assemble plusieurs formes en une seule, avec une couleur par sommet et un ombrage plat (low-poly)
function fusionner(parts){
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for(const p of parts){
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    if(p.matrice) g.applyMatrix4(p.matrice);
    else if(p.pos) g.translate(p.pos[0], p.pos[1], p.pos[2]);
    g.computeVertexNormals();                      // une normale par facette : ombrage plat
    const P = g.attributes.position, N = g.attributes.normal;
    for(let i = 0; i < P.count; i++){
      pos.push(P.getX(i), P.getY(i), P.getZ(i));
      nor.push(N.getX(i), N.getY(i), N.getZ(i));
      c.set(typeof p.couleur === 'function' ? p.couleur(P.getX(i), P.getY(i), P.getZ(i)) : p.couleur);
      col.push(c.r, c.g, c.b);
    }
    g.dispose(); p.geo.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

// Position + rotation (radians) + échelle → matrice
function matrice(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1){
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s));
}

// Atelier : on y pose des pièces (boîtes, cylindres, tubes…) puis on les fusionne en une seule forme
class Atelier {
  constructor(){ this.parts = []; this.pile = [new THREE.Matrix4()]; }
  // Toutes les pièces posées dans fn() sont placées dans le repère m (déplacé, tourné)
  repere(m, fn){ this.pile.push(this.pile[this.pile.length - 1].clone().multiply(m)); fn(); this.pile.pop(); return this; }
  ajouter(geo, couleur, m = null){
    const base = this.pile[this.pile.length - 1];
    this.parts.push({ geo, couleur, matrice: m ? base.clone().multiply(m) : base.clone() });
    return this;
  }
  boite(w, h, d, couleur, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0){
    return this.ajouter(new THREE.BoxGeometry(w, h, d), couleur, matrice(x, y, z, rx, ry, rz));
  }
  // Cylindre vertical (axe y) ; on le couche avec rx (axe z) ou rz (axe x)
  cylindre(r, h, couleur, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12, rHaut = r, ouvert = false){
    return this.ajouter(new THREE.CylinderGeometry(rHaut, r, h, seg, 1, ouvert), couleur, matrice(x, y, z, rx, ry, rz));
  }
  // Cylindre tendu entre deux points a et b ([x, y, z]) : tuyaux, barres, bras
  tube(a, b, r, couleur, seg = 10){
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), l = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const m = new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.ajouter(new THREE.CylinderGeometry(r, r, l, seg), couleur, m);
  }
  // Anneau (tore) dans le plan xy ; rx = π/2 pour le coucher à plat
  tore(R, r, couleur, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segR = 6, segT = 20){
    return this.ajouter(new THREE.TorusGeometry(R, r, segR, segT), couleur, matrice(x, y, z, rx, ry, rz));
  }
  sphere(r, couleur, x = 0, y = 0, z = 0, seg = 8){
    return this.ajouter(new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.75))), couleur, matrice(x, y, z));
  }
  geometrie(){ return fusionner(this.parts); }
  mesh(type = 'sommets', ombres = true){
    const m = new THREE.Mesh(this.geometrie(), materiau(type));
    m.castShadow = ombres; m.receiveShadow = true;
    return m;
  }
}

// Bride boulonnée autour d'un tuyau : dans le repère m (axe du tuyau = y local)
function bride(a, m, r, couleur = COULEURS.acier, boulons = 8){
  a.repere(m, () => {
    a.cylindre(r + 0.07, 0.05, couleur, 0, 0, 0, 0, 0, 0, 14);
    for(let k = 0; k < boulons; k++){
      const ang = k / boulons * Math.PI * 2;
      a.cylindre(0.014, 0.1, COULEURS.acierFonce, Math.cos(ang) * (r + 0.04), 0, Math.sin(ang) * (r + 0.04), 0, 0, 0, 6);
    }
  });
}
// Volant de vanne (rouge) dans le plan xy du repère courant
function volant(a, R, couleur = COULEURS.volant){
  a.tore(R, R * 0.12, couleur, 0, 0, 0, 0, 0, 0, 5, 16);
  for(let k = 0; k < 3; k++){
    const ang = k / 3 * Math.PI * 2 + Math.PI / 2;
    a.tube([0, 0, 0], [Math.cos(ang) * R, Math.sin(ang) * R, 0], R * 0.07, couleur, 5);
  }
  a.cylindre(R * 0.2, R * 0.25, couleur, 0, 0, 0, Math.PI / 2, 0, 0, 8);
}

// --- Textures dessinées par le code ---
function canvasTexture(w, h, dessin){
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  dessin(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.userData = { cv, g };
  return tex;
}
// Angle (sur le cadran dessiné) correspondant à une pression : de 0 bar en bas à gauche à cadranMax en bas à droite
function angleCadran(bar){ return (135 + borne(bar, 0, CONFIG.pression.cadranMax) / CONFIG.pression.cadranMax * 270) * Math.PI / 180; }
let _texCadran = null;
function textureCadran(){
  if(_texCadran) return _texCadran;
  const max = CONFIG.pression.cadranMax, z = CONFIG.pression.zones;
  return _texCadran = canvasTexture(256, 256, g => {
    g.fillStyle = '#F4F2EA'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#2B3240'; g.stroke();
    const arc = (a, b, c) => { g.beginPath(); g.arc(128, 128, 96, angleCadran(a), angleCadran(b)); g.strokeStyle = c; g.lineWidth = 16; g.stroke(); };
    const v = CATALOGUE.v8;      // zones d'un ventilateur : pas de neige, production réduite, bonne pression
    arc(0, v.pressionMin, '#D7263D'); arc(v.pressionMin, v.pressionPleine, '#F29B30'); arc(v.pressionPleine, z.correcte, '#2E9E5B');
    arc(z.correcte, z.surpression, '#F29B30'); arc(z.surpression, max, '#D7263D');
    g.strokeStyle = '#1C1F25'; g.fillStyle = '#1C1F25'; g.font = 'bold 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for(let b = 0; b <= max; b += 2){
      const a = angleCadran(b), long = b % 10 === 0;
      g.lineWidth = long ? 4 : 2;
      g.beginPath(); g.moveTo(128 + Math.cos(a) * (long ? 76 : 84), 128 + Math.sin(a) * (long ? 76 : 84)); g.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.stroke();
      if(long) g.fillText(String(b), 128 + Math.cos(a) * 58, 128 + Math.sin(a) * 58);
    }
    g.font = 'bold 20px system-ui, sans-serif'; g.fillText('bar', 128, 190);
  });
}
// Panneau « danger électrique » : triangle jaune et éclair noir
let _texDanger = null;
function textureDanger(){
  return _texDanger || (_texDanger = canvasTexture(128, 112, g => {
    g.fillStyle = '#F2C230'; g.strokeStyle = '#1C1F25'; g.lineWidth = 8; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(64, 6); g.lineTo(122, 106); g.lineTo(6, 106); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1C1F25';
    g.beginPath(); g.moveTo(70, 30); g.lineTo(46, 72); g.lineTo(62, 72); g.lineTo(54, 98); g.lineTo(82, 58); g.lineTo(66, 58); g.lineTo(76, 30); g.closePath(); g.fill();
  }));
}
// Étiquette flottante au-dessus d'un objet (taille fixe à l'écran). Avec « carre » (une couleur), l'étiquette n'apparaît
// que de près ; de loin, elle est remplacée par un petit carré de cette couleur (voir majEtiquettes).
const ETIQUETTES = [];
let _texCarre = null;
function creerEtiquette(texte, couleur = '#E9B949', carre = null){
  const groupe = new THREE.Group(), sp = spriteEtiquette(texte, couleur);
  groupe.add(sp);
  if(carre){
    _texCarre = _texCarre || canvasTexture(32, 32, g => {
      g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(11,20,38,.9)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(9, 3); g.arcTo(29, 3, 29, 29, 6); g.arcTo(29, 29, 3, 29, 6); g.arcTo(3, 29, 3, 3, 6); g.arcTo(3, 3, 29, 3, 6); g.closePath();
      g.fill(); g.stroke();
    });
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: _texCarre, color: carre, sizeAttenuation: false, depthTest: false, transparent: true, fog: false }));
    c.scale.set(0.022, 0.022, 1);
    c.center.set(0.5, 0);
    c.renderOrder = 10;
    c.visible = false;
    groupe.add(c);
    groupe.userData = { etiquette: sp, carre: c };
    ETIQUETTES.push(groupe);
  }
  return groupe;
}
// Étiquettes en entier près de la caméra, petits carrés de couleur au loin
const _posEtiquette = { v: null };
function majEtiquettes(camera, seuil){
  const v = _posEtiquette.v || (_posEtiquette.v = new THREE.Vector3());
  for(const e of ETIQUETTES){
    if(!e.parent) continue;
    const proche = e.getWorldPosition(v).distanceTo(camera.position) < seuil;
    e.userData.etiquette.visible = proche;
    e.userData.carre.visible = !proche;
  }
}
function spriteEtiquette(texte, couleur){
  const police = 'bold 40px "Bricolage Grotesque", system-ui, sans-serif';
  const mesure = document.createElement('canvas').getContext('2d');
  mesure.font = police;
  const w = Math.ceil(mesure.measureText(texte).width) + 56, h = 72;
  const tex = canvasTexture(w, h, g => {
    g.fillStyle = 'rgba(11,20,38,.88)'; g.strokeStyle = couleur; g.lineWidth = 4;
    g.beginPath(); g.moveTo(18, 2); g.arcTo(w - 2, 2, w - 2, h - 2, 16); g.arcTo(w - 2, h - 2, 2, h - 2, 16); g.arcTo(2, h - 2, 2, 2, 16); g.arcTo(2, 2, w - 2, 2, 16); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#EAF2FF'; g.font = police; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(texte, w / 2, h / 2 + 2);
  });
  tex.minFilter = THREE.LinearFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true, fog: false }));
  const hauteur = 0.042;
  sp.scale.set(hauteur * w / h, hauteur, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 10;
  return sp;
}
// Petite lampe dont on change la couleur (voyants, gyrophares)
function lampe(r, couleur, demi = false){
  const geo = demi ? new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2) : new THREE.SphereGeometry(r, 10, 8);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: couleur }));
}

// ---------------------------------------------------------------------------------------
// Terrain : petites facettes sur la zone de jeu et ses abords, grandes facettes pour les montagnes
// ---------------------------------------------------------------------------------------
function chercher(arr, v){
  let lo = 0, hi = arr.length - 2;
  if(v <= arr[0]) return 0;
  if(v >= arr[hi + 1]) return hi;
  while(lo < hi){ const mid = (lo + hi + 1) >> 1; if(arr[mid] <= v) lo = mid; else hi = mid - 1; }
  return lo;
}
// Hauteur exacte de la surface affichée sur une grille sans décalage (les montagnes, où les facettes sont grandes)
function hauteurGrille(g, x, z){
  const i = chercher(g.xs, x), j = chercher(g.zs, z);
  const fx = borne((x - g.xs[i]) / (g.xs[i + 1] - g.xs[i]), 0, 1), fz = borne((z - g.zs[j]) / (g.zs[j + 1] - g.zs[j]), 0, 1);
  const Y = (ii, jj) => g.ys[jj * g.xs.length + ii];
  const a = Y(i, j), b = Y(i + 1, j), c = Y(i, j + 1), d = Y(i + 1, j + 1);
  if((i + j) % 2) return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  return fz >= fx ? a + (d - c) * fx + (c - a) * fz : a + (b - a) * fx + (d - b) * fz;
}
// Graduations des grandes facettes : régulières sur la partie fine, puis de plus en plus espacées
function axeGros(demi, pas, etendue){
  const v = [];
  for(let x = -demi; x <= demi + 1e-6; x += pas) v.push(x);
  let x = demi, s = pas;
  const ext = [];
  while(x < etendue){ s = Math.min(90, s * 1.15); x += s; ext.push(x); }
  return [...ext.slice().reverse().map(e => -e), ...v, ...ext];
}

function creerTerrain(niveau){
  const t = niveau.terrain, h = (x, z) => altitude(t, x, z, niveau.pistes) - t.altBas, r = alea(t.graine * 31 + 5);
  const gros = t.maille * 7;                                   // une grande facette = 7 petites
  const arrondi = v => Math.ceil(v / (gros / 2)) * (gros / 2);
  const demiX = arrondi(t.largeur / 2 + t.marge), demiZ = arrondi(t.longueur / 2 + t.marge);
  const pos = [], col = [];
  const cNeige = new THREE.Color(COULEURS.neige), cBord = new THREE.Color(COULEURS.neigeBord), cPiste = new THREE.Color(COULEURS.piste);
  const cRocher = new THREE.Color(COULEURS.rocher), cBache = new THREE.Color(COULEURS.bache), c = new THREE.Color();
  const retenue = niveau.retenue;

  // Une facette : couleur selon l'endroit (piste damée, bord de piste, neige, bâche de la retenue, rocher si c'est raide)
  const tri = (A, B, D) => {
    const cx = (A[0] + B[0] + D[0]) / 3, cz = (A[2] + B[2] + D[2]) / 3;
    const pp = pistePlusProche(niveau.pistes, cx, cz);
    if(pp && pp.dessus) c.copy(cPiste);
    else if(pp && pp.auBord < 3) c.copy(cBord);
    else c.copy(cNeige);
    if(retenue && Math.hypot(cx - retenue.x, cz - retenue.z) < retenue.cuvette.rayon + 1) c.copy(cBache).lerp(cNeige, r() * 0.35);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    const ny = Math.abs(uz * vx - ux * vz) / Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const talus = (t.replats || []).some(q => Math.hypot(cx - q.x, cz - q.z) < q.rayon + q.talus);   // talus de terrassement : enneigés
    if(ny < 0.78 && !talus) c.lerp(cRocher, Math.min(1, (0.78 - ny) * 3.5));
    c.multiplyScalar(0.95 + r() * 0.07);
    for(const S of [A, B, D]){ pos.push(S[0], S[1], S[2]); col.push(c.r, c.g, c.b); }
  };
  // 1. Partie fine (zone de jeu + marge), sommets légèrement décalés pour casser la régularité (sauf au bord)
  const nx = Math.round(2 * demiX / t.maille), nz = Math.round(2 * demiZ / t.maille);
  const fx = [], fz = [], fy = [];
  for(let j = 0; j <= nz; j++) for(let i = 0; i <= nx; i++){
    const bord = i === 0 || j === 0 || i === nx || j === nz;
    const x = -demiX + i * t.maille + (bord ? 0 : (r() - 0.5) * t.maille * 0.35);
    const z = -demiZ + j * t.maille + (bord ? 0 : (r() - 0.5) * t.maille * 0.35);
    fx.push(x); fz.push(z); fy.push(h(x, z));
  }
  for(let j = 0; j < nz; j++) for(let i = 0; i < nx; i++){
    const P = (ii, jj) => { const k = jj * (nx + 1) + ii; return [fx[k], fy[k], fz[k]]; };
    const a = P(i, j), b = P(i + 1, j), cc = P(i, j + 1), d = P(i + 1, j + 1);
    if((i + j) % 2){ tri(a, cc, b); tri(b, cc, d); } else { tri(a, cc, d); tri(a, d, b); }
  }
  // Jupe : une bande qui descend sous le bord de la partie fine, pour qu'aucun jour n'apparaisse au raccord
  const tour = [];
  for(let i = 0; i < nx; i++) tour.push([i, 0]);
  for(let j = 0; j < nz; j++) tour.push([nx, j]);
  for(let i = nx; i > 0; i--) tour.push([i, nz]);
  for(let j = nz; j > 0; j--) tour.push([0, j]);
  tour.push([0, 0]);
  for(let k = 0; k < tour.length - 1; k++){
    const p = tour[k][1] * (nx + 1) + tour[k][0], q = tour[k + 1][1] * (nx + 1) + tour[k + 1][0];
    const A = [fx[p], fy[p], fz[p]], B = [fx[q], fy[q], fz[q]], A2 = [fx[p], fy[p] - 6, fz[p]], B2 = [fx[q], fy[q] - 6, fz[q]];
    tri(A, B, B2); tri(A, B2, A2); tri(A, B2, B); tri(A, A2, B2);
  }

  // 2. Partie grossière : les montagnes tout autour (grandes facettes régulières)
  const gx = axeGros(demiX, gros, t.etendue), gz = axeGros(demiZ, gros, t.etendue), gy = [];
  for(const z of gz) for(const x of gx) gy.push(h(x, z));
  for(let j = 0; j < gz.length - 1; j++) for(let i = 0; i < gx.length - 1; i++){
    if(gx[i] >= -demiX - 1e-6 && gx[i + 1] <= demiX + 1e-6 && gz[j] >= -demiZ - 1e-6 && gz[j + 1] <= demiZ + 1e-6) continue;   // déjà couvert par la partie fine
    const P = (ii, jj) => [gx[ii], gy[jj * gx.length + ii], gz[jj]];
    const a = P(i, j), b = P(i + 1, j), cc = P(i, j + 1), d = P(i + 1, j + 1);
    if((i + j) % 2){ tri(a, cc, b); tri(b, cc, d); } else { tri(a, cc, d); tri(a, d, b); }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));   // à part : il devient transparent en vue sous-sol
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  // Pour poser les objets exactement sur la surface affichée
  const g = { xs: gx, zs: gz, ys: gy };
  mesh.userData.poser = (x, z) => (Math.abs(x) <= demiX && Math.abs(z) <= demiZ) ? h(x, z) : hauteurGrille(g, x, z);
  return mesh;
}

// Les endroits où l'on ne met ni sapins ni rochers
function placeLibre(niveau, x, z, marge){
  const pp = pistePlusProche(niveau.pistes, x, z);
  if(pp && pp.auBord < marge) return false;
  for(const r of niveau.terrain.replats || []) if(Math.hypot(x - r.x, z - r.z) < r.rayon + r.talus * 0.5 + marge) return false;
  for(const d of niveau.departsElec) if(Math.hypot(x - d.x, z - d.z) < 16) return false;
  for(const ts of niveau.remontees || []) if(distanceTelesiege(ts, x, z) < 9) return false;
  return true;
}
function pente(t, x, z){
  const e = 3;
  return Math.hypot(altitudeNaturelle(t, x + e, z) - altitudeNaturelle(t, x - e, z), altitudeNaturelle(t, x, z + e) - altitudeNaturelle(t, x, z - e)) / (2 * e);
}

// --- Sapin low-poly : tronc et trois étages d'aiguilles poudrés de neige ---
function geometrieSapin(){
  const vert = new THREE.Color(COULEURS.sapin), neige = new THREE.Color(COULEURS.sapinNeige);
  const etage = (rayon, hauteur, y) => ({
    geo: new THREE.ConeGeometry(rayon, hauteur, 7),
    pos: [0, y, 0],
    couleur: (x, yy) => vert.clone().lerp(neige, borne((yy - (y - hauteur / 2)) / hauteur, 0, 1) * 0.55)
  });
  return fusionner([
    { geo: new THREE.CylinderGeometry(0.28, 0.4, 2.2, 6), pos: [0, 1.1, 0], couleur: COULEURS.tronc },
    etage(2.7, 3.6, 3.1),
    etage(2.1, 3.2, 5.0),
    etage(1.4, 2.8, 6.8),
    { geo: new THREE.ConeGeometry(0.55, 1.0, 7), pos: [0, 8.0, 0], couleur: COULEURS.sapinNeige }
  ]);
}

function creerSapins(niveau, nombre, poser){
  const t = niveau.terrain, r = alea(t.graine * 101 + 3);
  const mesh = new THREE.InstancedMesh(geometrieSapin(), materiau('sommets'), nombre);
  mesh.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), axe = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  let n = 0, essais = 0;
  while(n < nombre && essais++ < nombre * 40){
    const x = (r() - 0.5) * (t.largeur + 520), z = -t.longueur / 2 - 240 + r() * (t.longueur + 540);
    // Bosquets : plus de sapins là où le bruit est fort, un peu moins vers le haut, aucun au-dessus de la limite des arbres
    const densite = bruit(x / 55, z / 55, t.graine + 9) + (z / t.longueur) * 0.6;
    if(densite < -0.1 || r() > 0.35 + densite) continue;
    if(altitudeNaturelle(t, x, z) - t.altBas > 230 || pente(t, x, z) > 0.8) continue;
    if(!placeLibre(niveau, x, z, 6)) continue;
    const e = 0.75 + r() * 0.75;
    p.set(x, poser(x, z) - 0.3, z);
    q.setFromAxisAngle(axe, r() * Math.PI * 2);
    s.set(e * (0.9 + r() * 0.2), e, e * (0.9 + r() * 0.2));
    mesh.setMatrixAt(n, m.compose(p, q, s));
    mesh.setColorAt(n, c.setScalar(0.82 + r() * 0.22));
    n++;
  }
  mesh.count = n;
  return mesh;
}

function creerRochers(niveau, nombre, poser){
  const t = niveau.terrain, r = alea(t.graine * 57 + 11);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: COULEURS.rocher }), nombre);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  let n = 0, essais = 0;
  while(n < nombre && essais++ < nombre * 40){
    const x = (r() - 0.5) * (t.largeur + 600), z = (r() - 0.5) * (t.longueur + 600);
    if(pente(t, x, z) < 0.45 && r() > 0.3) continue;   // plutôt dans les endroits raides
    if(!placeLibre(niveau, x, z, 10)) continue;
    const taille = (0.8 + r() * r() * 3.5) * (dansZoneJeu(t, x, z) ? 1 : 1.8);
    p.set(x, poser(x, z) - taille * 0.3, z);
    q.setFromEuler(e.set(r() * 3, r() * 3, r() * 3));
    s.set(taille * (1 + r() * 0.6), taille * (0.5 + r() * 0.4), taille * (1 + r() * 0.6));
    mesh.setMatrixAt(n++, m.compose(p, q, s));
  }
  mesh.count = n;
  return mesh;
}

// --- Jalons de bord de piste, de la couleur de la piste, avec un bandeau réfléchissant ---
function creerJalons(niveau, poser){
  const groupe = new THREE.Group();
  for(const piste of niveau.pistes){
    const a = new Atelier(), coul = COULEURS.jalons[piste.couleur] || COULEURS.jalons.bleue;
    a.cylindre(0.09, 2.2, coul, 0, 1.1, 0, 0, 0, 0, 5);
    a.cylindre(0.11, 0.35, '#FFFFFF', 0, 1.9, 0, 0, 0, 0, 5);
    const c = courbePiste(piste), pas = 7;                  // un point de courbe tous les 4 m environ : un jalon tous les 28 m
    const places = [];
    for(let i = pas; i < c.length - 1; i += pas){
      const p0 = c[i - 1], p1 = c[i + 1], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
      const nx = -(p1[1] - p0[1]) / l, nz = (p1[0] - p0[0]) / l;
      for(const cote of [-1, 1]){
        const x = c[i][0] + nx * cote * (piste.largeur / 2 + 1.5), z = c[i][1] + nz * cote * (piste.largeur / 2 + 1.5);
        places.push([x, poser(x, z) - 0.2, z]);
      }
    }
    const mesh = new THREE.InstancedMesh(a.geometrie(), materiau('sommets'), places.length);
    const m = new THREE.Matrix4();
    places.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p[0], p[1], p[2])));
    groupe.add(mesh);
  }
  return groupe;
}

// ---------------------------------------------------------------------------------------
// Retenue d'eau : lac (dont le niveau peut baisser), bord gelé et clôture
// ---------------------------------------------------------------------------------------
function creerRetenue(niveau, poser){
  const t = niveau.terrain, R = niveau.retenue, groupe = new THREE.Group();
  const eau = new THREE.Mesh(new THREE.CircleGeometry(1, 48),
    new THREE.MeshPhongMaterial({ color: COULEURS.eau, specular: '#2E4A78', shininess: 30, transparent: true, opacity: 0.95 }));
  eau.rotation.x = -Math.PI / 2;
  const glace = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.02, 48), new THREE.MeshLambertMaterial({ color: '#CFE0F2', transparent: true, opacity: 0.85 }));
  glace.rotation.x = -Math.PI / 2;
  glace.position.y = 0.03;
  const lac = new THREE.Group();
  lac.add(eau, glace);
  lac.position.set(R.x, 0, R.z);
  groupe.add(lac);

  // Clôture de sécurité autour du lac
  const rc = R.cuvette.rayon + 4.5, n = Math.round(2 * Math.PI * rc / 4);
  const piquets = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), new THREE.MeshLambertMaterial({ color: '#6B5A48' }), n);
  const fils = [[], []], m = new THREE.Matrix4();
  for(let i = 0; i <= n; i++){
    const a = i / n * Math.PI * 2, x = R.x + Math.cos(a) * rc, z = R.z + Math.sin(a) * rc, y = poser(x, z);
    if(i < n) piquets.setMatrixAt(i, m.makeTranslation(x, y + 0.6, z));
    fils[0].push(new THREE.Vector3(x, y + 0.6, z)); fils[1].push(new THREE.Vector3(x, y + 1.15, z));
  }
  groupe.add(piquets);
  for(const f of fils) groupe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(f), new THREE.LineBasicMaterial({ color: '#8C96A6' })));

  // Niveau d'eau : 0 = vide, 1 = pleine
  groupe.userData.remplir = f => {
    const e = eauRetenue(t, R, f);
    lac.visible = e.rayon > 0.5;
    lac.position.y = e.cote - t.altBas + 0.05;
    lac.scale.set(e.rayon + 0.6, 1, e.rayon + 0.6);
  };
  groupe.userData.remplir(R.niveau);
  return groupe;
}

// ---------------------------------------------------------------------------------------
// Canon à neige (ventilateur) sur son support (trépied, tour ou tour haute)
// Repère : le support est vertical (axe y), le canon souffle vers +z quand direction = 0.
// options : taille (1 = V9), support ('trepied', 'tour', 'tourHaute'), bande (couleur de la bande du tube)
// ---------------------------------------------------------------------------------------
function creerCanon(options = {}){
  const canon = new THREE.Group(), C = COULEURS;
  const taille = options.taille || 1, support = options.support || 'tour', bande = options.bande || C.canonBande;
  const H = SUPPORTS[support].pivot - 0.14;             // haut du support, sous la couronne d'orientation

  // Support (fixe)
  const p = new Atelier();
  if(support === 'trepied'){
    // Trépied posé au sol : trois jambes écartées, une colonne courte
    p.cylindre(0.09, H, C.galva, 0, H / 2, 0, 0, 0, 0, 10);
    for(let k = 0; k < 3; k++){
      const a = k * Math.PI * 2 / 3 + Math.PI / 6;
      p.tube([Math.cos(a) * 0.95, 0.04, Math.sin(a) * 0.95], [Math.cos(a) * 0.08, H * 0.8, Math.sin(a) * 0.08], 0.04, C.galva, 6);
      p.cylindre(0.11, 0.05, C.acierFonce, Math.cos(a) * 0.95, 0.025, Math.sin(a) * 0.95, 0, 0, 0, 8);
    }
    p.boite(0.3, 0.34, 0.16, '#D9DEE4', 0, H * 0.45, -0.2);
    p.tube([0, H * 0.3, -0.24], [0, 0.05, -0.6], 0.022, C.noir, 6);
    p.cylindre(0.12, 0.2, C.conduiteEau, 0, 0.1, 0, 0, 0, 0, 10);
  } else {
    // Tour : tube galvanisé sur platine ; la tour haute est plus épaisse, haubanée, avec échelle et garde-corps
    const haute = support === 'tourHaute', r = haute ? 0.16 : 0.11;
    p.cylindre(haute ? 0.45 : 0.32, 0.06, C.galva, 0, 0.03, 0, 0, 0, 0, 12);
    for(let k = 0; k < 4; k++){ const a = k * Math.PI / 2 + Math.PI / 4; p.cylindre(0.025, 0.08, C.acierFonce, Math.cos(a) * 0.24, 0.07, Math.sin(a) * 0.24, 0, 0, 0, 6); }
    p.cylindre(r, H, C.galva, 0, H / 2, 0, 0, 0, 0, 10, r * 0.8);
    if(haute){
      for(let k = 0; k < 3; k++){
        const a = k * Math.PI * 2 / 3;
        p.tube([Math.cos(a) * 1.1, 0.03, Math.sin(a) * 1.1], [Math.cos(a) * 0.12, 2.4, Math.sin(a) * 0.12], 0.035, C.galva, 6);
      }
      for(let y = 0.5; y < H - 0.6; y += 0.4) p.boite(0.32, 0.03, 0.03, C.acierFonce, 0, y, 0.24);
      p.tore(0.55, 0.025, C.jaune, 0, H - 0.7, 0, Math.PI / 2, 0, 0, 4, 18);
      p.cylindre(0.55, 0.04, C.acierFonce, 0, H - 1.25, 0, 0, 0, 0, 14);
    }
    p.boite(0.34, 0.46, 0.2, '#D9DEE4', 0, 1.35, -0.2 - r + 0.11);
    p.boite(0.36, 0.04, 0.22, C.acierFonce, 0, 1.6, -0.2 - r + 0.11);
    p.tube([0, 1.12, -0.24 - r + 0.11], [0, 0.1, -0.24 - r + 0.11], 0.025, C.noir, 6);
    p.cylindre(0.13, 0.25, C.conduiteEau, 0, 0.25, 0, 0, 0, 0, 10);
  }
  p.cylindre(0.2, 0.14, C.acierFonce, 0, H + 0.07, 0, 0, 0, 0, 14);   // couronne d'orientation
  canon.add(p.mesh());

  // Partie qui pivote (direction) ; sa taille dépend du modèle
  const pivot = new THREE.Group();
  pivot.position.y = H + 0.14;
  pivot.scale.setScalar(taille);
  canon.add(pivot);
  const f = new Atelier();
  f.cylindre(0.17, 0.1, C.acierFonce, 0, 0.05, 0, 0, 0, 0, 12);
  f.boite(1.36, 0.12, 0.16, C.acierFonce, 0, 0.16, 0);
  f.boite(0.1, 0.84, 0.16, C.acierFonce, -0.63, 0.55, 0);
  f.boite(0.1, 0.84, 0.16, C.acierFonce, 0.63, 0.55, 0);
  pivot.add(f.mesh());

  // Partie qui s'incline : le tube creux et tout ce qu'il porte
  const incl = new THREE.Group();
  incl.position.y = 0.95;
  pivot.add(incl);
  const t = new Atelier();
  t.cylindre(0.55, 1.5, C.canon, 0, 0, 0, Math.PI / 2, 0, 0, 18, 0.55, true);          // tube ouvert aux deux bouts
  t.cylindre(0.56, 0.16, bande, 0, 0, 0.3, Math.PI / 2, 0, 0, 18, 0.56, true);         // bande de couleur (selon le modèle)
  t.tore(0.55, 0.035, C.canon, 0, 0, 0.75, 0, 0, 0, 5, 24);
  t.tore(0.55, 0.035, C.canon, 0, 0, -0.75, 0, 0, 0, 5, 24);
  t.cylindre(0.07, 0.16, C.acierFonce, -0.61, 0, 0, 0, 0, Math.PI / 2, 8);               // tourillons
  t.cylindre(0.07, 0.16, C.acierFonce, 0.61, 0, 0, 0, 0, Math.PI / 2, 8);
  // Moteur de l'hélice au centre, tenu par trois bras
  t.cylindre(0.17, 0.45, '#5A6270', 0, 0, -0.2, Math.PI / 2, 0, 0, 12);
  t.cylindre(0.12, 0.1, '#5A6270', 0, 0, 0.07, Math.PI / 2, 0, 0, 10, 0.05);
  for(let k = 0; k < 3; k++){
    const a = Math.PI / 2 + k * Math.PI * 2 / 3;
    t.tube([Math.cos(a) * 0.15, Math.sin(a) * 0.15, -0.2], [Math.cos(a) * 0.54, Math.sin(a) * 0.54, -0.2], 0.022, C.acierFonce, 6);
  }
  // Grille de protection à l'arrière
  for(const R of [0.16, 0.32, 0.48]) t.tore(R, 0.012, C.canonBande, 0, 0, -0.78, 0, 0, 0, 4, 22);
  for(let k = 0; k < 8; k++){
    const a = k / 8 * Math.PI * 2;
    t.tube([Math.cos(a) * 0.04, Math.sin(a) * 0.04, -0.78], [Math.cos(a) * 0.56, Math.sin(a) * 0.56, -0.78], 0.01, C.canonBande, 4);
  }
  // Couronne de buses à l'avant
  t.tore(0.6, 0.035, '#C9CED6', 0, 0, 0.8, 0, 0, 0, 6, 28);
  for(let k = 0; k < 12; k++){
    const a = k / 12 * Math.PI * 2;
    t.cylindre(0.026, 0.11, C.buse, Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.86, Math.PI / 2, 0, 0, 6);
  }
  // Nucléateurs (petites buses d'eau et d'air en bas de la couronne)
  for(const a of [-0.35, 0, 0.35]) t.cylindre(0.02, 0.09, '#8C96A6', Math.sin(a) * 0.45, -0.45, 0.82, Math.PI / 2, 0, 0, 6);
  // Tuyau qui alimente la couronne, sous le tube
  t.tube([0, -0.57, -0.2], [0, -0.6, 0.78], 0.03, C.noir, 6);
  t.tube([0.6, -0.08, 0], [0.12, -0.56, -0.2], 0.03, C.noir, 6);
  // Socle du voyant sur le dessus
  t.cylindre(0.05, 0.08, C.acierFonce, 0, 0.6, -0.3, 0, 0, 0, 8);
  incl.add(t.mesh('sommets2'));

  // Hélice (elle tourne quand le canon produit)
  const h = new Atelier();
  h.cylindre(0.1, 0.12, C.canonBande, 0, 0, 0, Math.PI / 2, 0, 0, 10);
  for(let k = 0; k < 6; k++){
    const a = k / 6 * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationZ(a).multiply(new THREE.Matrix4().makeTranslation(0.29, 0, 0)).multiply(new THREE.Matrix4().makeRotationX(0.5));
    h.ajouter(new THREE.BoxGeometry(0.38, 0.022, 0.15), '#C9CED6', m);
  }
  const helice = h.mesh('sommets', false);
  helice.position.z = -0.52;
  incl.add(helice);

  // Voyant d'état
  const voyant = lampe(0.07, C.voyants.arret);
  voyant.position.set(0, 0.68, -0.3);
  incl.add(voyant);

  canon.userData = { pivot, incl, helice, voyant, vitesse: 0, etat: 'arret',
    buse: { objet: incl, local: new THREE.Vector3(0, 0, 0.9) } };     // d'où part la neige
  orienterCanon(canon, 0, 20);
  return canon;
}

// ---------------------------------------------------------------------------------------
// Perche à neige : petit support vertical de 1,50 m, longue perche inclinée, tête de buses en haut
// qui projette vers l'avant dans un éventail de 30° au plus (pas tout autour), tuyaux d'eau et d'air le long.
// options : longueur (6 ou 10 m), ng (nouvelle génération : tête orange, moins d'air)
// ---------------------------------------------------------------------------------------
function creerPerche(options = {}){
  const perche = new THREE.Group(), C = COULEURS, L = options.longueur || 6, ng = !!options.ng;
  const H = PERCHE.support, penche = PERCHE.penche * Math.PI / 180;
  // Support vertical (fixe) : platine, poteau de 1,50 m, coffret électrique
  const s = new Atelier();
  s.cylindre(0.28, 0.06, C.galva, 0, 0.03, 0, 0, 0, 0, 10);
  for(let k = 0; k < 4; k++){ const a = k * Math.PI / 2 + Math.PI / 4; s.cylindre(0.022, 0.08, C.acierFonce, Math.cos(a) * 0.2, 0.07, Math.sin(a) * 0.2, 0, 0, 0, 6); }
  s.cylindre(0.09, H, C.galva, 0, H / 2, 0, 0, 0, 0, 10);
  s.cylindre(0.16, 0.1, C.acierFonce, 0, H - 0.05, 0, 0, 0, 0, 12);    // couronne d'orientation
  s.boite(0.3, 0.4, 0.16, '#D9DEE4', 0, 0.85, -0.17);                // coffret de la perche
  s.tube([0, 0.65, -0.2], [0, 0.05, -0.5], 0.022, C.noir, 6);
  s.cylindre(0.11, 0.22, C.conduiteEau, 0, 0.2, 0, 0, 0, 0, 10);       // raccord d'eau et d'air
  perche.add(s.mesh());
  // Partie orientable : chape et perche inclinée vers l'avant (+z)
  const pivot = new THREE.Group();
  pivot.position.y = H;
  perche.add(pivot);
  const chape = new Atelier();
  chape.boite(0.26, 0.08, 0.26, C.acierFonce, 0, 0.04, 0);
  for(const x of [-0.1, 0.1]) chape.boite(0.03, 0.24, 0.16, C.acierFonce, x, 0.18, 0);
  pivot.add(chape.mesh());
  const mat = new THREE.Group();
  mat.position.y = 0.2;
  mat.rotation.x = penche;
  pivot.add(mat);
  const a = new Atelier();
  a.cylindre(0.07, L, C.galva, 0, L / 2, 0, 0, 0, 0, 8, 0.045);
  a.tube([0.085, 0.3, 0], [0.065, L - 0.35, 0], 0.02, C.conduiteEau, 5);   // eau
  a.tube([-0.085, 0.3, 0], [-0.065, L - 0.35, 0], 0.017, '#8C96A6', 5);   // air comprimé
  for(let y = 1; y < L - 0.5; y += 1.5) a.cylindre(0.095, 0.05, C.acierFonce, 0, y, 0, 0, 0, 0, 8);
  // Tête : corps, puis buses toutes tournées vers l'avant, en éventail de ±15° autour de l'horizontale avant
  const tete = ng ? C.orange : C.canon, top = new THREE.Vector3(0, L + 0.12, 0);
  a.cylindre(0.11, 0.36, tete, 0, L + 0.1, 0, 0, 0, 0, 10);
  const avant = new THREE.Vector3(0, Math.sin(penche), Math.cos(penche));      // horizontale avant, vue depuis la perche
  const demi = PERCHE.eventail / 2 * Math.PI / 180;
  for(let k = 0; k < 4; k++){
    const phi = -demi + k / 3 * 2 * demi;
    const dir = new THREE.Vector3(Math.sin(phi), avant.y * Math.cos(phi), avant.z * Math.cos(phi)).normalize();
    const base = top.clone().addScaledVector(dir, 0.08), bout = top.clone().addScaledVector(dir, 0.26);
    a.tube(base.toArray(), bout.toArray(), 0.022, C.buse, 5);
  }
  a.boite(0.24, 0.03, 0.1, C.acierFonce, 0, L + 0.3, 0.04);                     // plaque au-dessus des buses
  if(ng) a.tore(0.13, 0.025, '#FFFFFF', 0, L - 0.12, 0, Math.PI / 2, 0, 0, 4, 14);
  mat.add(a.mesh());
  const voyant = lampe(0.055, C.voyants.arret);
  voyant.position.set(0, 1.1, -0.17);
  perche.add(voyant);
  perche.userData = { pivot, incl: null, helice: null, voyant, vitesse: 0, etat: 'arret', perche: true,
    buse: { objet: mat, local: new THREE.Vector3(0, L + 0.12, 0.25) } };
  return perche;
}
function orienterCanon(c, direction, inclinaison){
  c.userData.direction = direction; c.userData.inclinaison = borne(inclinaison, 0, 35);
  c.userData.pivot.rotation.y = direction * Math.PI / 180;
  if(c.userData.incl) c.userData.incl.rotation.x = -c.userData.inclinaison * Math.PI / 180;
}
// Position de la tête de buses dans le monde (d'où part la neige)
function positionBuse(c, cible){
  c.updateMatrixWorld(true);
  return c.userData.buse.objet.localToWorld(cible.copy(c.userData.buse.local));
}
// État : 'arret' (gris), 'production' (vert), 'faible' (orange), 'defaut' (rouge)
function etatCanon(c, etat){
  c.userData.etat = etat;
  c.userData.voyant.material.color.set(COULEURS.voyants[etat]);
}
function animerCanon(c, dt){
  const u = c.userData, cible = u.etat === 'production' ? 1 : u.etat === 'faible' ? 0.6 : 0;
  u.vitesse += (cible - u.vitesse) * Math.min(1, dt * 0.8);       // l'hélice démarre et ralentit doucement
  if(u.helice) u.helice.rotation.z += u.vitesse * dt * 28;
}

// ---------------------------------------------------------------------------------------
// Regard : chambre rectangulaire en béton, enterrée, avec trappe et vanne
// Repère : y = 0 au niveau du sol ; 2,0 m (x) × 1,5 m (z) ; le pied du canon se pose en PIED_REGARD, la trappe est à droite.
// ---------------------------------------------------------------------------------------
const PIED_REGARD = [-0.5, 0.26, 0];
function prisme(forme, profondeur){
  return new THREE.ExtrudeGeometry(forme, { depth: profondeur, bevelEnabled: false });
}
function rectangle(x0, z0, x1, z1){
  return [new THREE.Vector2(x0, z0), new THREE.Vector2(x1, z0), new THREE.Vector2(x1, z1), new THREE.Vector2(x0, z1)];
}
function creerRegard(){
  const regard = new THREE.Group(), C = COULEURS;
  const L = 2.0, l = 1.5, ep = 0.15, prof = 1.9, haut = 0.12;          // haut : les murs dépassent un peu du sol
  const a = new Atelier(), yMur = haut - prof / 2;
  // Murs, radier (fond) et dalle percée d'une trappe
  a.boite(L, prof, ep, C.beton, 0, yMur, -l / 2 + ep / 2);
  a.boite(L, prof, ep, C.beton, 0, yMur, l / 2 - ep / 2);
  a.boite(ep, prof, l - 2 * ep, C.beton, -L / 2 + ep / 2, yMur, 0);
  a.boite(ep, prof, l - 2 * ep, C.beton, L / 2 - ep / 2, yMur, 0);
  a.boite(L, 0.15, l, C.betonClair, 0, haut - prof - 0.075, 0);
  const dalle = new THREE.Shape(rectangle(-L / 2 - 0.05, -l / 2 - 0.05, L / 2 + 0.05, l / 2 + 0.05));
  dalle.holes.push(new THREE.Path(rectangle(0.05, -0.4, 0.85, 0.4)));
  a.ajouter(prisme(dalle, 0.14), C.betonClair, matrice(0, 0.26, 0, Math.PI / 2, 0, 0));
  // Cornière autour de la trappe
  a.boite(0.86, 0.03, 0.05, C.galva, 0.45, 0.27, -0.4); a.boite(0.86, 0.03, 0.05, C.galva, 0.45, 0.27, 0.4);
  a.boite(0.05, 0.03, 0.86, C.galva, 0.05, 0.27, 0); a.boite(0.05, 0.03, 0.86, C.galva, 0.85, 0.27, 0);
  // Conduite principale qui traverse la chambre
  a.tube([-1.15, -1.45, 0.3], [1.15, -1.45, 0.3], 0.1, C.conduiteEau, 12);
  bride(a, matrice(-0.3, -1.45, 0.3, 0, 0, Math.PI / 2), 0.1);
  // Té, montée, vanne (sous la trappe) et départ vers le pied du canon
  a.tube([0.45, -1.45, 0.3], [0.45, -0.8, 0.3], 0.075, C.conduiteEau, 10);
  a.sphere(0.09, C.conduiteEau, 0.45, -0.8, 0.3);
  a.tube([0.45, -0.8, 0.3], [-0.5, -0.8, 0.3], 0.075, C.conduiteEau, 10);
  a.cylindre(0.13, 0.3, C.acier, 0.15, -0.8, 0.3, 0, 0, Math.PI / 2, 10);             // corps de vanne
  bride(a, matrice(0.31, -0.8, 0.3, 0, 0, Math.PI / 2), 0.075);
  bride(a, matrice(-0.01, -0.8, 0.3, 0, 0, Math.PI / 2), 0.075);
  a.cylindre(0.07, 0.24, C.acier, 0.15, -0.58, 0.3, 0, 0, 0, 8);                      // chapeau
  a.cylindre(0.018, 0.2, C.galva, 0.15, -0.38, 0.3, 0, 0, 0, 6);                      // tige
  a.repere(matrice(0.15, -0.3, 0.3, Math.PI / 2, 0, 0), () => volant(a, 0.17));
  a.sphere(0.09, C.conduiteEau, -0.5, -0.8, 0.3);
  a.tube([-0.5, -0.8, 0.3], [-0.5, -0.8, 0], 0.075, C.conduiteEau, 10);
  a.sphere(0.09, C.conduiteEau, -0.5, -0.8, 0);
  a.tube([-0.5, -0.8, 0], [-0.5, 0.27, 0], 0.075, C.conduiteEau, 10);
  // Coffret électrique, gaine du câble et câble vers le canon
  a.boite(0.32, 0.38, 0.14, '#D9DEE4', 0.5, -0.6, -0.58);
  a.tube([0.5, -0.8, -0.58], [0.9, -1.5, -0.58], 0.03, C.noir, 6);
  a.tube([0.5, -0.42, -0.58], [-0.45, 0.2, -0.06], 0.025, C.noir, 6);
  // Échelons sous la trappe
  for(let k = 0; k < 3; k++) a.boite(0.03, 0.03, 0.36, C.galva, 0.82, -0.35 - k * 0.38, 0);
  regard.add(a.mesh());

  // Couvercle de la trappe, articulé côté arrière
  const charniere = new THREE.Group();
  charniere.position.set(0.45, 0.28, -0.4);
  const c = new Atelier();
  c.boite(0.78, 0.035, 0.78, '#7D8794', 0, 0.018, 0.39);
  for(let k = 0; k < 6; k++) c.boite(0.7, 0.008, 0.035, '#97A1AE', 0, 0.04, 0.08 + k * 0.125, 0, 0.5, 0);
  c.tore(0.06, 0.012, C.acierFonce, 0, 0.045, 0.7, Math.PI / 2, 0, 0, 4, 10);
  charniere.add(c.mesh());
  regard.add(charniere);

  regard.userData = { charniere, ouvert: false, angle: 0 };
  return regard;
}
function ouvrirRegard(regard, ouvert){ regard.userData.ouvert = ouvert; }
function animerRegard(regard, dt){
  const u = regard.userData, cible = u.ouvert ? 1.9 : 0;
  u.angle += (cible - u.angle) * Math.min(1, dt * 4);
  u.charniere.rotation.x = -u.angle;
}
// Regard équipé de son enneigeur (choix = { modele, support }, voir CATALOGUE et SUPPORTS)
const BANDES = { v8: '#2B3240', v9: '#2F6FDE', v10: '#D7263D' };
function creerEnneigeur(choix = {}){
  const modele = choix.modele || 'v8', m = CATALOGUE[modele], g = new THREE.Group(), regard = creerRegard();
  let canon;
  if(m.type === 'perche'){
    canon = creerPerche({ longueur: m.longueur, ng: !!m.peuDAir });
    canon.position.set(...PIED_REGARD);
  } else {
    const support = choix.support || 'trepied';
    canon = creerCanon({ taille: m.taille, support, bande: BANDES[modele] });
    if(support === 'trepied'){
      // Le trépied est posé au sol à côté du regard, relié à la bouche d'eau par un flexible
      canon.position.set(-2.4, 0, 0);
      const fl = new Atelier();
      fl.ajouter(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.5, 0.3, 0), new THREE.Vector3(-1.1, 0.35, 0.25),
        new THREE.Vector3(-1.8, 0.08, 0.2), new THREE.Vector3(-2.4, 0.15, 0)]), 16, 0.05, 6), COULEURS.noir);
      fl.cylindre(0.09, 0.18, COULEURS.conduiteEau, -0.5, 0.35, 0, 0, 0, 0, 8);
      g.add(fl.mesh());
    } else canon.position.set(...PIED_REGARD);
  }
  g.add(regard, canon);
  g.userData = { regard, canon, modele, support: m.type === 'ventilateur' ? (choix.support || 'trepied') : null };
  return g;
}

// ---------------------------------------------------------------------------------------
// Tas de neige (forme de bosse irrégulière, grossit avec le volume) et manche à air
// ---------------------------------------------------------------------------------------
let _geoTas = null, _matTas = null;
function creerTas(){
  if(!_geoTas){
    const g = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), P = g.attributes.position;
    for(let i = 0; i < P.count; i++){
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      if(y < 0.05) continue;
      const k = 1 + 0.16 * bruit(x * 3 + 10, z * 3 + 10, 5);           // même décalage pour les sommets confondus
      P.setXYZ(i, x * k, y * (1 + 0.1 * bruit(z * 3, x * 3, 6)), z * k);
    }
    _geoTas = g.toNonIndexed();
    _geoTas.computeVertexNormals();
    _matTas = new THREE.MeshLambertMaterial({ color: '#F4F8FF' });
  }
  const m = new THREE.Mesh(_geoTas, _matTas);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// Volume (m³) → taille : bosse 3 fois plus large que haute
function majTas(mesh, volume){
  const r = Math.cbrt(Math.max(volume, 0.5) / (Math.PI * 2 / 3 * 0.33));
  mesh.scale.set(r, r * 0.33, r);
}
function creerMancheAir(){
  const g = new THREE.Group(), a = new Atelier(), C = COULEURS;
  a.cylindre(0.07, 6, C.galva, 0, 3, 0, 0, 0, 0, 8);
  a.cylindre(0.3, 0.3, C.beton, 0, 0.1, 0, 0, 0, 0, 8);
  g.add(a.mesh());
  const pivot = new THREE.Group();
  pivot.position.y = 6;
  g.add(pivot);
  const m = new Atelier();
  m.tore(0.38, 0.03, C.galva, 0, 0, 0.05, 0, 0, 0, 4, 14);
  for(let k = 0; k < 5; k++){
    const r1 = 0.38 - k * 0.05, r2 = r1 - 0.05;
    m.cylindre(r1, 0.45, k % 2 ? '#F4F8FF' : C.orange, 0, 0, 0.27 + k * 0.45, Math.PI / 2, 0, 0, 10, r2, true);
  }
  const manche = m.mesh('sommets2');
  pivot.add(manche);
  g.userData.orienter = vent => {
    pivot.rotation.y = vent.direction * Math.PI / 180;                       // la manche part dans le sens du vent
    manche.rotation.x = (1 - borne(vent.force / 25, 0, 1)) * 1.25;          // sans vent, elle pend
  };
  return g;
}

// ---------------------------------------------------------------------------------------
// Armoire électrique « Départ élec »
// ---------------------------------------------------------------------------------------
function creerArmoire(nom){
  const g = new THREE.Group(), C = COULEURS, a = new Atelier();
  a.boite(1.7, 0.4, 0.9, C.beton, 0, 0.1, 0);                                   // socle béton
  a.boite(1.4, 1.9, 0.55, C.armoire, 0, 1.25, 0);                                // caisson
  a.boite(1.56, 0.06, 0.72, C.armoire, 0, 2.23, 0.04);                           // casquette
  a.boite(1.5, 0.12, 0.66, C.neigeToit, 0, 2.32, 0.04);                          // neige dessus
  for(const s of [-1, 1]){
    a.boite(0.66, 1.78, 0.03, '#BCC3CB', s * 0.345, 1.25, 0.29);                 // portes
    a.boite(0.04, 0.18, 0.05, C.noir, s * 0.08, 1.3, 0.32);                      // poignées
    for(let k = 0; k < 5; k++) a.boite(0.42, 0.02, 0.02, '#5A6270', s * 0.345, 0.45 + k * 0.05, 0.31);   // aérations
  }
  a.boite(0.015, 1.78, 0.035, '#5A6270', 0, 1.25, 0.292);
  for(const s of [-1, 1]) a.cylindre(0.05, 0.7, C.noir, s * 0.35, -0.05, -0.1, 0, 0, 0, 8);   // gaines des câbles
  g.add(a.mesh());
  const l = new Atelier();
  l.sphere(0.035, C.voyants.production, 0.5, 1.95, 0.31);                       // voyant « sous tension »
  g.add(l.mesh('lumineux', false));
  const panneau = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.26), new THREE.MeshBasicMaterial({ map: textureDanger(), transparent: true }));
  panneau.position.set(-0.345, 1.75, 0.307);
  g.add(panneau);
  if(nom){
    const e = creerEtiquette(nom, undefined, COULEURS.reseauElec);
    e.position.y = 3.2;
    g.add(e);
  }
  return g;
}

// ---------------------------------------------------------------------------------------
// Compresseur d'air (niveau 3) : groupe compresseur sous abri, réservoir d'air vertical, manomètre, départ enterré
// Repère : dalle à y = 0 ; sortie = position du départ de la conduite d'air, relative au centre (m)
// ---------------------------------------------------------------------------------------
let _texCadranAir = null;
function textureCadranAir(){
  const max = 12, ca = CONFIG.air;
  const ang = bar => (135 + borne(bar, 0, max) / max * 270) * Math.PI / 180;
  return _texCadranAir || (_texCadranAir = canvasTexture(256, 256, g => {
    g.fillStyle = '#F4F2EA'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#2B3240'; g.stroke();
    const arc = (a, b, c) => { g.beginPath(); g.arc(128, 128, 96, ang(a), ang(b)); g.strokeStyle = c; g.lineWidth = 16; g.stroke(); };
    arc(0, ca.pressionMin, '#D7263D'); arc(ca.pressionMin, ca.pressionPleine, '#F29B30'); arc(ca.pressionPleine, ca.pressionNominale + 1, '#2E9E5B'); arc(ca.pressionNominale + 1, max, '#D7263D');
    g.strokeStyle = '#1C1F25'; g.fillStyle = '#1C1F25'; g.font = 'bold 24px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for(let b = 0; b <= max; b++){
      const a = ang(b), long = b % 2 === 0;
      g.lineWidth = long ? 4 : 2;
      g.beginPath(); g.moveTo(128 + Math.cos(a) * (long ? 76 : 84), 128 + Math.sin(a) * (long ? 76 : 84)); g.lineTo(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.stroke();
      if(long) g.fillText(String(b), 128 + Math.cos(a) * 58, 128 + Math.sin(a) * 58);
    }
    g.font = 'bold 20px system-ui, sans-serif'; g.fillText('bar air', 128, 190);
  }));
}
function creerCompresseur(nom, sortie = { dx: 2, dz: 5 }){
  const g = new THREE.Group(), C = COULEURS, a = new Atelier();
  // Dalle et abri (4 poteaux, toit enneigé)
  a.boite(7.2, 0.6, 6, C.beton, 0, -0.3, 0);
  for(const [x, z] of [[-3.3, -2.7], [3.3, -2.7], [-3.3, 2.7], [3.3, 2.7]]) a.boite(0.18, 3.6, 0.18, C.galva, x, 1.8, z);
  a.boite(7.4, 0.18, 6.2, C.toit, 0, 3.7, 0, 0.06, 0, 0);
  a.boite(7.2, 0.22, 6, C.neigeToit, 0, 3.88, 0, 0.06, 0, 0);
  // Groupe compresseur (caisson insonorisé) avec grilles d'aération
  const cx = -1.2, cz = -0.9;
  a.boite(3.6, 0.2, 2.0, C.acierFonce, cx, 0.1, cz);
  a.boite(3.4, 1.9, 1.8, '#2F5FB3', cx, 1.15, cz);
  a.boite(3.5, 0.08, 1.9, '#24498A', cx, 2.14, cz);
  for(let k = 0; k < 7; k++) a.boite(1.4, 0.05, 0.03, '#1B3566', cx - 0.8, 0.55 + k * 0.18, cz + 0.91);   // aérations
  a.boite(0.9, 0.6, 0.04, '#1C2B44', cx + 0.9, 1.45, cz + 0.91);                                         // écran du compresseur
  a.cylindre(0.62, 0.12, C.acierFonce, cx + 0.6, 2.2, cz, 0, 0, 0, 16);                                  // grille du ventilateur
  // Réservoir d'air vertical (fonds bombés), sur pieds
  const rx = 2.1, rz = 1.0;
  for(let k = 0; k < 3; k++){ const an = k / 3 * Math.PI * 2; a.tube([rx + Math.cos(an) * 0.45, 0, rz + Math.sin(an) * 0.45], [rx + Math.cos(an) * 0.35, 0.6, rz + Math.sin(an) * 0.35], 0.05, C.acierFonce, 6); }
  a.cylindre(0.62, 2.4, '#D9DEE5', rx, 1.85, rz, 0, 0, 0, 16);
  a.ajouter(new THREE.SphereGeometry(0.62, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#D9DEE5', matrice(rx, 3.05, rz));
  a.ajouter(new THREE.SphereGeometry(0.62, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#D9DEE5', matrice(rx, 0.65, rz));
  a.cylindre(0.64, 0.12, C.jaune, rx, 2.4, rz, 0, 0, 0, 16);                                             // bande d'identification
  a.cylindre(0.05, 0.25, C.acier, rx, 3.75, rz, 0, 0, 0, 8);                                             // soupape de sécurité
  // Tuyauterie : compresseur → réservoir → départ enterré
  a.tube([cx + 1.7, 1.6, cz], [rx, 1.6, cz], 0.07, C.acier, 8);
  a.tube([rx, 1.6, cz], [rx, 1.6, rz - 0.6], 0.07, C.acier, 8);
  a.tube([rx + 0.6, 0.9, rz], [sortie.dx, 0.9, rz], 0.08, C.acier, 8);
  a.tube([sortie.dx, 0.9, rz], [sortie.dx, 0.9, sortie.dz], 0.08, C.acier, 8);
  a.tube([sortie.dx, 0.9, sortie.dz], [sortie.dx, -0.6, sortie.dz], 0.08, C.acier, 8);
  for(let z = rz + 1.2; z < sortie.dz - 0.2; z += 1.4) a.boite(0.08, 0.9, 0.08, C.galva, sortie.dx, 0.45, z);   // supports
  a.boite(0.6, 0.12, 0.6, C.beton, sortie.dx, 0.05, sortie.dz);                                           // massif du départ
  g.add(a.mesh());
  // Vanne de départ (volant rouge)
  const v = new Atelier();
  v.repere(matrice(sortie.dx, 0.9, sortie.dz - 0.8, 0, Math.PI / 2, 0), () => { v.cylindre(0.12, 0.3, C.acier, 0, 0, 0, Math.PI / 2, 0, 0, 10); v.repere(matrice(0, 0.32, 0, Math.PI / 2, 0, 0), () => volant(v, 0.22)); });
  g.add(v.mesh());
  // Hélice du ventilateur (tourne quand le compresseur marche)
  const fa = new Atelier();
  for(let k = 0; k < 5; k++) fa.boite(0.5, 0.03, 0.14, C.noir, Math.cos(k / 5 * Math.PI * 2) * 0.27, 0, Math.sin(k / 5 * Math.PI * 2) * 0.27, 0, -k / 5 * Math.PI * 2, 0.25);
  const helice = fa.mesh();
  helice.position.set(cx + 0.6, 2.3, cz);
  g.add(helice);
  // Manomètre du réservoir (0 à 12 bar) et voyant
  const cadran = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ map: textureCadranAir() }));
  cadran.position.set(rx, 1.85, rz + 0.65);
  g.add(cadran);
  const aiguille = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.025), new THREE.MeshBasicMaterial({ color: '#D7263D' }));
  aiguille.geometry.translate(0.1, 0, 0);
  aiguille.position.set(rx, 1.85, rz + 0.66);
  g.add(aiguille);
  const voyant = lampe(0.07, C.voyants.arret);
  voyant.position.set(cx + 0.9, 1.9, cz + 0.93);
  g.add(voyant);
  if(nom){ const e = creerEtiquette(nom, undefined, COULEURS.reseauAir); e.position.y = 5.2; g.add(e); }
  g.userData = { ventilo: helice, aiguille, voyant, vitesse: 0, bar: 0, etat: { marche: false, pression: 0 }, compresseur: true };
  return g;
}
function etatCompresseur(g, etat){ Object.assign(g.userData.etat, etat); }
function animerCompresseur(g, dt, temps){
  const u = g.userData, e = u.etat;
  u.vitesse += ((e.marche ? 1 : 0) - u.vitesse) * Math.min(1, dt * 1.5);
  u.ventilo.rotation.y += u.vitesse * dt * 30;
  u.bar += (e.pression - u.bar) * Math.min(1, dt * 3);
  u.aiguille.rotation.z = -(135 + borne(u.bar + (e.marche ? Math.sin(temps * 9) * 0.05 : 0), 0, 12) / 12 * 270) * Math.PI / 180;
  u.voyant.material.color.set(e.marche ? COULEURS.voyants.production : COULEURS.voyants.arret);
}

// ---------------------------------------------------------------------------------------
// Salle de pompage : 3 pompes, collecteurs, manomètres, vanne principale, pupitre, gyrophares
// Repère : sol intérieur à y = 0 ; 14 m (x) × 9 m (z) ; la retenue est derrière (−z), le départ vers les pistes à droite (+x).
// ---------------------------------------------------------------------------------------
function creerSallePompage(nom){
  const salle = new THREE.Group(), C = COULEURS;
  const W = 14, D = 9, H = 4.2, ep = 0.3, yA = 0.95;           // yA : hauteur de l'axe des pompes
  const POMPES_X = [-3.4, 0, 3.4];
  const a = new Atelier(), lum = new Atelier();

  // Dalle, sol peint, lignes de sécurité jaunes
  a.boite(W + 0.8, 0.5, D + 0.8, C.beton, 0, -0.25, 0);
  a.boite(W - 2 * ep, 0.02, D - 2 * ep, '#7E8B8A', 0, 0.01, 0);
  const ligneRect = (cx, cz, w, d) => {
    a.boite(w, 0.012, 0.1, C.jaune, cx, 0.026, cz - d / 2); a.boite(w, 0.012, 0.1, C.jaune, cx, 0.026, cz + d / 2);
    a.boite(0.1, 0.012, d, C.jaune, cx - w / 2, 0.026, cz); a.boite(0.1, 0.012, d, C.jaune, cx + w / 2, 0.026, cz);
  };
  for(const px of POMPES_X) ligneRect(px, -1.0, 2.1, 4.9);
  a.boite(12.8, 0.012, 0.1, C.jaune, 0, 0.026, 1.9);                              // allée de circulation

  // Murs avec soubassement, porte et fenêtres éclairées : un groupe par mur,
  // pour qu'un mur devienne transparent quand la caméra est devant (voirAtravers)
  const murs = {
    arriere: { n: [0, 0, -1], c: [0, H / 2, -D / 2], a: new Atelier(), l: new Atelier() },
    avant: { n: [0, 0, 1], c: [0, H / 2, D / 2], a: new Atelier(), l: new Atelier() },
    gauche: { n: [-1, 0, 0], c: [-W / 2, H / 2, 0], a: new Atelier(), l: new Atelier() },
    droit: { n: [1, 0, 0], c: [W / 2, H / 2, 0], a: new Atelier(), l: new Atelier() }
  };
  const murX = (m, x0, x1, y0, y1, z) => m.a.boite(x1 - x0, y1 - y0, ep, C.mur, (x0 + x1) / 2, (y0 + y1) / 2, z);
  const fenetresArriere = [-3.4, 0, 3.4], fenetresAvant = [-4.6, -1.4];
  // Mur arrière (côté retenue) : bandes autour des fenêtres
  const ar = murs.arriere, zAr = -D / 2 + ep / 2;
  murX(ar, -W / 2, W / 2, 0, 2.8, zAr); murX(ar, -W / 2, W / 2, 3.55, H, zAr);
  let x0 = -W / 2;
  for(const fx of fenetresArriere){ murX(ar, x0, fx - 0.7, 2.8, 3.55, zAr); x0 = fx + 0.7; ar.l.boite(1.4, 0.75, ep + 0.04, C.fenetre, fx, 3.175, zAr); }
  murX(ar, x0, W / 2, 2.8, 3.55, zAr);
  ar.a.boite(W + 0.06, 0.7, 0.04, C.betonClair, 0, 0.35, -D / 2 - 0.02);
  // Mur avant : porte en x = 3.6 et deux fenêtres
  const av = murs.avant, zAv = D / 2 - ep / 2;
  murX(av, -W / 2, 2.3, 0, 1.6, zAv); murX(av, -W / 2, 2.3, 2.6, H, zAv);
  x0 = -W / 2;
  for(const fx of fenetresAvant){ murX(av, x0, fx - 0.8, 1.6, 2.6, zAv); x0 = fx + 0.8; av.l.boite(1.6, 1.0, ep + 0.04, C.fenetre, fx, 2.1, zAv); }
  murX(av, x0, 2.3, 1.6, 2.6, zAv);
  murX(av, 4.9, W / 2, 0, H, zAv); murX(av, 2.3, 4.9, 3.0, H, zAv);
  av.a.boite(2.5, 2.95, 0.08, '#3F5A78', 3.6, 1.5, D / 2 - 0.02);                 // porte
  av.a.boite(0.06, 0.06, 0.4, C.galva, 4.5, 1.15, D / 2 + 0.05);
  av.l.boite(0.5, 0.35, 0.1, C.fenetre, 3.6, 2.3, D / 2 + 0.01);
  av.a.boite(W + 0.06, 0.7, 0.04, C.betonClair, 0, 0.35, D / 2 + 0.02);
  av.a.boite(0.3, 0.08, 0.3, C.acierFonce, 3.6, 3.28, D / 2 + 0.12);              // support du gyrophare
  // Murs de côté, une fenêtre chacun
  for(const [m, s] of [[murs.gauche, -1], [murs.droit, 1]]){
    const x = s * (W / 2 - ep / 2);
    m.a.boite(ep, 2.6, D - 2 * ep, C.mur, x, 1.3, 0); m.a.boite(ep, H - 3.5, D - 2 * ep, C.mur, x, (3.5 + H) / 2, 0);
    m.a.boite(ep, 0.9, 2.95, C.mur, x, 3.05, -2.3); m.a.boite(ep, 0.9, 2.95, C.mur, x, 3.05, 2.3);
    m.l.boite(ep + 0.04, 0.9, 2.3, C.fenetre, x, 3.05, 0);
    m.a.boite(0.04, 0.7, D + 0.06, C.betonClair, s * (W / 2 + 0.02), 0.35, 0);
  }
  const transparents = [];
  for(const m of Object.values(murs)){
    const mur = new THREE.Mesh(m.a.geometrie(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide }));
    mur.castShadow = mur.receiveShadow = true;
    const vitres = new THREE.Mesh(m.l.geometrie(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }));
    salle.add(mur, vitres);
    transparents.push({ n: m.n, c: m.c, meshes: [mur, vitres], opacite: 1 });
  }

  // --- Pompes ---
  const pompes = [];
  const geoVentilateur = (() => {
    const v = new Atelier();
    v.cylindre(0.07, 0.08, C.acierFonce, 0, 0, 0, Math.PI / 2, 0, 0, 8);
    for(let k = 0; k < 5; k++){
      const ang = k / 5 * Math.PI * 2;
      v.ajouter(new THREE.BoxGeometry(0.3, 0.02, 0.1), '#C9CED6',
        new THREE.Matrix4().makeRotationZ(ang).multiply(new THREE.Matrix4().makeTranslation(0.2, 0, 0)).multiply(new THREE.Matrix4().makeRotationX(0.5)));
    }
    return v.geometrie();
  })();
  const geoAiguille = new THREE.BoxGeometry(0.1, 0.008, 0.004).translate(0.04, 0, 0);
  const matAiguille = new THREE.MeshBasicMaterial({ color: '#C8102E' });
  const matCadran = new THREE.MeshBasicMaterial({ map: textureCadran() });
  const manometre = (x, y, z, rot = 0) => {
    // Boîtier + cadran + aiguille, face vers +z (tourné de rot autour de y)
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = rot;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), matCadran);
    face.position.z = 0.032;
    const aiguille = new THREE.Mesh(geoAiguille, matAiguille);
    aiguille.position.z = 0.036;
    aiguille.rotation.z = -angleCadran(0);
    g.add(face, aiguille);
    salle.add(g);
    a.repere(matrice(x, y, z, 0, rot, 0), () => { a.cylindre(0.135, 0.06, '#2B3240', 0, 0, 0, Math.PI / 2, 0, 0, 16); a.tube([0, -0.1, -0.05], [0, -0.13, -0.05], 0.02, C.galva, 6); });
    return aiguille;
  };
  for(const px of POMPES_X){
    a.repere(matrice(px, 0, 0), () => {
      a.boite(1.3, 0.35, 4.6, C.beton, 0, 0.175, -1.05);                         // socle
      // Corps de pompe multicellulaire (4 étages), brides et tirants
      for(let s = 0; s < 4; s++) a.cylindre(0.36, 0.36, C.pompe, 0, yA, -2.75 + s * 0.4, Math.PI / 2, 0, 0, 14);
      for(let s = 0; s < 5; s++) a.cylindre(0.41, 0.05, C.pompe, 0, yA, -2.95 + s * 0.4, Math.PI / 2, 0, 0, 14);
      for(const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) a.tube([dx * 0.3, yA + dy * 0.3, -3.0], [dx * 0.3, yA + dy * 0.3, -1.3], 0.022, C.galva, 6);
      a.boite(0.9, 0.3, 0.14, C.pompe, 0, 0.5, -2.7); a.boite(0.9, 0.3, 0.14, C.pompe, 0, 0.5, -1.55);
      // Palier, accouplement (carter orange)
      a.cylindre(0.15, 0.3, C.acier, 0, yA, -1.2, Math.PI / 2, 0, 0, 10);
      a.cylindre(0.22, 0.45, C.orange, 0, yA, -0.85, Math.PI / 2, 0, 0, 10);
      // Moteur électrique bleu à ailettes
      a.cylindre(0.45, 1.4, C.moteur, 0, yA + 0.05, 0, Math.PI / 2, 0, 0, 14);
      for(const z of [-0.72, 0.72]) a.cylindre(0.41, 0.08, C.moteur, 0, yA + 0.05, z, Math.PI / 2, 0, 0, 14);
      for(let k = 0; k < 12; k++){
        const ang = k / 12 * Math.PI * 2;
        if(ang > 1.1 * Math.PI && ang < 1.9 * Math.PI) continue;                  // pas d'ailettes sous le moteur
        a.boite(0.1, 0.035, 1.3, C.moteur, Math.cos(ang) * 0.48, yA + 0.05 + Math.sin(ang) * 0.48, 0, 0, 0, ang);
      }
      for(const z of [-0.45, 0.45]) a.boite(1.0, 0.27, 0.2, C.moteur, 0, 0.48, z);
      a.boite(0.36, 0.24, 0.42, C.moteur, 0, yA + 0.6, 0.1);                      // boîte à bornes
      // Capot du ventilateur arrière (ouvert, avec grille)
      a.cylindre(0.42, 0.32, '#2A4F96', 0, yA + 0.05, 0.9, Math.PI / 2, 0, 0, 14, 0.42, true);
      for(const r of [0.14, 0.28, 0.4]) a.tore(r, 0.01, C.acierFonce, 0, yA + 0.05, 1.07, 0, 0, 0, 4, 18);
      a.boite(0.82, 0.02, 0.02, C.acierFonce, 0, yA + 0.05, 1.07); a.boite(0.02, 0.82, 0.02, C.acierFonce, 0, yA + 0.05, 1.07);
      // Aspiration : vers le collecteur, contre le mur arrière
      a.tube([0, yA, -2.97], [0, yA, -3.5], 0.15, C.acier, 12);
      bride(a, matrice(0, yA, -3.05, Math.PI / 2, 0, 0), 0.15);
      // Refoulement : colonne montante, clapet, vanne d'isolement, manomètre, jusqu'au collecteur du haut
      a.tube([0, yA + 0.35, -1.55], [0, 2.7, -1.55], 0.12, C.acier, 12);
      bride(a, matrice(0, yA + 0.42, -1.55), 0.12);
      a.cylindre(0.17, 0.26, C.acier, 0, 1.55, -1.55, 0, 0, 0, 12);             // clapet anti-retour
      a.cylindre(0.19, 0.36, C.acier, 0, 2.0, -1.55, 0, 0, 0, 12);              // corps de la vanne
      bride(a, matrice(0, 1.8, -1.55), 0.12); bride(a, matrice(0, 2.2, -1.55), 0.12);
      a.tube([0, 2.0, -1.55], [0, 2.0, -1.0], 0.04, C.galva, 6);                 // tige de la vanne
      a.repere(matrice(0, 2.0, -0.98), () => volant(a, 0.22));
    });
    const voyant = lampe(0.06, C.voyants.arret);
    voyant.position.set(px, yA + 0.77, 0.1);
    salle.add(voyant);
    const ventilateur = new THREE.Mesh(geoVentilateur, materiau('sommets'));
    ventilateur.position.set(px, yA + 0.05, 0.98);
    salle.add(ventilateur);
    const aiguille = manometre(px + 0.32, 2.42, -1.5);
    a.tube([px, 2.42, -1.55], [px + 0.32, 2.42, -1.55], 0.02, C.galva, 6);
    pompes.push({ voyant, ventilateur, aiguille, vitesse: 0, bar: 0 });
  }
  // Collecteur d'aspiration (le long du mur arrière, il vient de la retenue)
  a.tube([-6.2, yA, -3.75], [4.6, yA, -3.75], 0.28, C.conduiteEau, 14);
  for(const px of POMPES_X) a.sphere(0.2, C.conduiteEau, px, yA, -3.75);
  a.tube([-5.6, yA, -3.75], [-5.6, yA, -5.3], 0.28, C.conduiteEau, 14);
  a.tube([-5.6, yA, -5.3], [-5.6, -1.5, -5.3], 0.28, C.conduiteEau, 14);
  bride(a, matrice(-5.6, yA, -4.6, Math.PI / 2, 0, 0), 0.28);
  for(const x of [-4.8, 1.7]) a.boite(0.3, yA - 0.28, 0.3, C.galva, x, (yA - 0.28) / 2, -3.75);
  // Collecteur de refoulement (en hauteur), vanne principale et départ vers les pistes
  a.tube([-3.6, 2.7, -1.55], [7.6, 2.7, -1.55], 0.2, C.acier, 14);
  for(const px of POMPES_X) a.sphere(0.16, C.acier, px, 2.7, -1.55);
  a.tube([7.6, 2.7, -1.55], [7.6, -1.5, -1.55], 0.2, C.acier, 14);
  a.cylindre(0.3, 0.5, C.acier, 5.3, 2.7, -1.55, 0, 0, Math.PI / 2, 14);        // vanne principale
  bride(a, matrice(5.02, 2.7, -1.55, 0, 0, Math.PI / 2), 0.2); bride(a, matrice(5.58, 2.7, -1.55, 0, 0, Math.PI / 2), 0.2);
  a.cylindre(0.12, 0.35, C.acier, 5.3, 3.12, -1.55, 0, 0, 0, 10);
  a.tube([5.3, 3.2, -1.55], [5.3, 3.5, -1.55], 0.03, C.galva, 6);
  bride(a, matrice(6.4, 2.7, -1.55, 0, 0, Math.PI / 2), 0.2);
  for(const x of [-1.7, 1.7, 6.2]) a.tube([x, 0, -1.55], [x, 2.5, -1.55], 0.06, C.galva, 6);  // poteaux de support, entre les pompes
  // Armoires électriques le long du mur de gauche
  for(const z of [-2.6, -1.7, -0.8]){
    a.boite(0.5, 2.0, 0.85, C.armoire, -6.4, 1.0, z);
    a.boite(0.02, 1.85, 0.03, '#5A6270', -6.14, 1.0, z);
    lum.sphere(0.03, C.voyants.production, -6.13, 1.75, z + 0.25);
  }
  // Pupitre de commande face aux pompes
  a.boite(1.8, 0.9, 0.7, '#5C6778', -4.2, 0.45, 2.6);
  a.boite(1.8, 0.06, 0.75, '#3B4250', -4.2, 0.93, 2.6);
  a.boite(1.0, 0.62, 0.06, '#2B3240', -4.2, 1.28, 2.32);
  a.tube([-4.2, 0.96, 2.32], [-4.2, 0.98, 2.32], 0.05, '#2B3240', 6);
  for(let k = 0; k < 6; k++) lum.cylindre(0.03, 0.02, k % 2 ? '#38D66B' : '#FF3B4A', -4.85 + k * 0.12, 0.97, 2.85, 0, 0, 0, 8);
  a.tube([-5.0, 0.96, 2.4], [-5.0, 1.5, 2.4], 0.025, C.galva, 6);
  const tex = canvasTexture(320, 200, () => {});
  const ecran = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ map: tex }));
  ecran.position.set(-4.2, 1.28, 2.355);
  salle.add(ecran);
  // Vanne principale (volant à part, pour le faire tourner)
  const vp = new Atelier();
  volant(vp, 0.38);
  const volantPrincipal = vp.mesh();
  volantPrincipal.position.set(5.3, 3.52, -1.55);
  volantPrincipal.rotation.x = Math.PI / 2;
  salle.add(volantPrincipal);
  const aiguilleDepart = manometre(6.4, 3.05, -1.4);
  a.tube([6.4, 2.85, -1.55], [6.4, 2.95, -1.55], 0.02, C.galva, 6);
  // Gyrophares : sur le pupitre et au-dessus de la porte
  const gyrophares = [];
  for(const [x, y, z] of [[-5.0, 1.52, 2.4], [3.6, 3.32, D / 2 + 0.22]]){
    const g = lampe(0.13, '#5A3A12', true);
    g.position.set(x, y, z);
    salle.add(g);
    gyrophares.push(g);
  }
  const fixe = a.mesh('sommets2');
  salle.add(fixe, lum.mesh('lumineux', false));

  // Toit à deux pans enneigé (à part, pour pouvoir le cacher et voir l'intérieur)
  const tt = new Atelier(), hf = 1.5, demi = D / 2 + 0.45, pan = Math.atan(hf / demi), lPan = Math.hypot(demi, hf);
  for(const s of [-1, 1]){
    const ang = s < 0 ? -pan : pan, ny = Math.cos(pan), nz = s < 0 ? -Math.sin(pan) : Math.sin(pan);
    tt.boite(W + 0.9, 0.2, lPan, C.toit, 0, H + hf / 2, s * demi / 2, ang, 0, 0);
    tt.boite(W + 0.7, 0.14, lPan - 0.2, C.neigeToit, 0, H + hf / 2 + ny * 0.16, s * demi / 2 + nz * 0.16, ang, 0, 0);
  }
  const pignon = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, hf)]);
  tt.ajouter(prisme(pignon, ep), C.mur, matrice(-W / 2, H, 0, 0, Math.PI / 2, 0));
  tt.ajouter(prisme(pignon, ep), C.mur, matrice(W / 2 - ep, H, 0, 0, Math.PI / 2, 0));
  const toit = new THREE.Mesh(tt.geometrie(), new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }));
  toit.castShadow = toit.receiveShadow = true;
  salle.add(toit);
  transparents.push({ toit: true, meshes: [toit], opacite: 1 });

  if(nom){
    const e = creerEtiquette(nom, undefined, COULEURS.reseauEau);
    e.position.y = H + hf + 2.5;
    salle.add(e);
  }
  salle.userData = { pompes, aiguilleDepart, volantPrincipal, gyrophares, toit, transparents, hauteur: H, ecran: tex, ecranMesh: ecran, barDepart: 0,
    etat: { marche: [false, false, false], pressions: [0, 0, 0], pressionDepart: 0, ouverture: 0, alarme: false } };
  dessinerEcran(salle);
  return salle;
}
// Écran du pupitre : état des pompes et pression de départ
function dessinerEcran(salle){
  const u = salle.userData, e = u.etat, { cv, g } = u.ecran.userData;
  g.fillStyle = '#0B1A2E'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#7FB2FF'; g.font = 'bold 22px system-ui, sans-serif'; g.textBaseline = 'top';
  g.fillText('POMPAGE', 14, 10);
  e.marche.forEach((m, i) => {
    g.fillStyle = m ? '#38D66B' : '#3A4558'; g.fillRect(18 + i * 100, 50, 80, 56);
    g.fillStyle = m ? '#0B1A2E' : '#C9D3E3'; g.font = 'bold 20px system-ui, sans-serif'; g.fillText(`P${i + 1}`, 42 + i * 100, 58);
    g.font = '15px system-ui, sans-serif'; g.fillText(m ? 'MARCHE' : 'ARRÊT', 28 + i * 100, 84);
  });
  g.fillStyle = e.alarme ? '#FF3B4A' : '#EAF2FF'; g.font = 'bold 26px system-ui, sans-serif';
  g.fillText(`Départ : ${Math.round(e.pressionDepart)} bar`, 14, 124);
  g.fillStyle = '#7FB2FF'; g.font = '18px system-ui, sans-serif';
  g.fillText(e.alarme ? 'ALARME' : `Vanne principale : ${Math.round(e.ouverture * 100)} %`, 14, 164);
  u.ecran.needsUpdate = true;
}
// Les murs (et le toit) qui sont entre la caméra et l'intérieur deviennent presque transparents
let _camLocale = null;
function voirAtravers(salle, camera, dt, portee = Infinity){
  _camLocale = _camLocale || new THREE.Vector3();
  const u = salle.userData, p = salle.worldToLocal(_camLocale.copy(camera.position));
  const proche = p.length() < portee, k = Math.min(1, dt * 6);
  for(const m of u.transparents){
    const devant = proche && (m.toit ? p.y > u.hauteur
      : (p.x - m.c[0]) * m.n[0] + (p.y - m.c[1]) * m.n[1] + (p.z - m.c[2]) * m.n[2] > 0);
    m.opacite += ((devant ? 0.12 : 1) - m.opacite) * k;
    for(const me of m.meshes){
      me.material.opacity = m.opacite;
      me.material.depthWrite = m.opacite > 0.95;
      me.castShadow = m.opacite > 0.5 && !me.material.isMeshBasicMaterial;
    }
  }
}
function etatSallePompage(salle, etat){
  Object.assign(salle.userData.etat, etat);
  dessinerEcran(salle);
}
function animerSallePompage(salle, dt, temps){
  const u = salle.userData, e = u.etat, k = Math.min(1, dt * 2);
  u.pompes.forEach((p, i) => {
    const marche = e.marche[i];
    p.vitesse += ((marche ? 1 : 0) - p.vitesse) * Math.min(1, dt * 1.2);
    p.ventilateur.rotation.z += p.vitesse * dt * 40;
    p.voyant.material.color.set(marche ? COULEURS.voyants.production : COULEURS.voyants.arret);
    p.bar += ((marche ? e.pressions[i] : 0) - p.bar) * k;
    p.aiguille.rotation.z = -angleCadran(p.bar + (marche ? Math.sin(temps * 7 + i) * 0.3 : 0));
  });
  u.barDepart += (e.pressionDepart - u.barDepart) * k;
  u.aiguilleDepart.rotation.z = -angleCadran(u.barDepart);
  u.volantPrincipal.rotation.z = -e.ouverture * Math.PI * 6;
  const allume = e.alarme && (temps * 2.5) % 1 < 0.5;
  for(const g of u.gyrophares) g.material.color.set(allume ? '#FFA53A' : '#5A3A12');
}

// ---------------------------------------------------------------------------------------
// Télésiège (fixe la nuit) : gares, pylônes, câbles et sièges
// ---------------------------------------------------------------------------------------
function geometrieSiege(){
  const a = new Atelier(), C = COULEURS;
  a.boite(0.25, 0.22, 0.4, C.acierFonce, 0, -0.06, 0);                            // pince sur le câble
  a.tube([0, -0.15, 0], [0, -1.6, -0.25], 0.04, C.galva, 6);                      // suspente
  a.tube([-1.0, -1.6, -0.25], [1.0, -1.6, -0.25], 0.035, C.galva, 6);
  for(const s of [-1, 1]){
    a.tube([s, -1.6, -0.25], [s, -2.35, -0.25], 0.035, C.galva, 6);
    a.tube([s, -2.35, -0.25], [s, -2.35, 0.35], 0.035, C.galva, 6);
    a.tube([s, -1.62, -0.2], [s, -1.38, 0.38], 0.03, C.galva, 6);                // garde-corps relevé
  }
  a.tube([-1.0, -1.38, 0.38], [1.0, -1.38, 0.38], 0.03, C.galva, 6);
  a.boite(2.0, 0.1, 0.56, C.siege, 0, -2.38, 0.06);                                // assise
  a.boite(2.0, 0.58, 0.08, C.siege, 0, -2.0, -0.24, -0.12, 0, 0);                  // dossier
  a.boite(1.9, 0.04, 0.5, C.neigeToit, 0, -2.31, 0.06);                            // neige sur l'assise
  return a.geometrie();
}
function creerGare(a, amont){
  const C = COULEURS;
  a.boite(8, 0.6, 11, C.beton, 0, 0.3, 0);                                         // dalle
  for(const [x, z] of [[-2.8, -3.8], [2.8, -3.8], [-2.8, 3.8], [2.8, 3.8]]) a.boite(0.4, 5.6, 0.4, C.acierFonce, x, 3.1, z);
  a.boite(6.6, 0.8, 9.2, C.siege, 0, 6.3, 0);                                      // carter de la gare
  a.boite(6.4, 0.25, 9.0, C.neigeToit, 0, 6.82, 0);
  a.tore(2.5, 0.14, C.acierFonce, 0, 5.0, 0, Math.PI / 2, 0, 0, 6, 28);          // grande roue (poulie) où tournent les câbles
  a.cylindre(0.3, 1.2, C.acier, 0, 5.4, 0, 0, 0, 0, 10);
  for(let k = 0; k < 6; k++){
    const ang = k / 6 * Math.PI * 2;
    a.tube([0, 5.0, 0], [Math.cos(ang) * 2.5, 5.0, Math.sin(ang) * 2.5], 0.05, C.acier, 5);
  }
  // Cabane du conducteur
  a.boite(2.4, 2.6, 2.4, C.bois, 4.6, 1.6, amont ? 3 : -3);
  a.boite(2.8, 0.2, 2.8, C.toit, 4.6, 3.0, amont ? 3 : -3);
  a.boite(2.6, 0.18, 2.6, C.neigeToit, 4.6, 3.18, amont ? 3 : -3);
}
function creerTelesiege(ts, poser){
  const groupe = new THREE.Group(), C = COULEURS;
  const dx = ts.amont.x - ts.aval.x, dz = ts.amont.z - ts.aval.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L, px = -uz, pz = ux, e = ts.ecart / 2;
  const rotY = Math.atan2(ux, uz);                     // le repère local +z pointe vers la gare d'arrivée
  const a = new Atelier(), lum = new Atelier();
  // Gares
  for(const [P, amont] of [[ts.aval, false], [ts.amont, true]]){
    const y = poser(P.x, P.z);
    a.repere(matrice(P.x, y, P.z, 0, rotY, 0), () => creerGare(a, amont));
    lum.repere(matrice(P.x, y, P.z, 0, rotY, 0), () => lum.boite(1.4, 0.8, 2.5, C.fenetre, 4.6, 1.9, amont ? 3 : -3));
  }
  // Pylônes et points d'appui des câbles
  const appuis = [{ x: ts.aval.x, z: ts.aval.z, y: poser(ts.aval.x, ts.aval.z) + 5.0 }];
  for(const p of pylonesTelesiege(ts)){
    const y0 = poser(p.x, p.z), H = ts.hauteur;
    a.repere(matrice(p.x, y0, p.z, 0, rotY, 0), () => {
      a.boite(1.8, 0.8, 1.8, C.beton, 0, 0.1, 0);
      a.cylindre(0.38, H, C.galva, 0, H / 2, 0, 0, 0, 0, 10, 0.28);
      a.boite(2 * e + 1.2, 0.4, 0.45, C.galva, 0, H, 0);
      for(const s of [-1, 1]){
        a.boite(0.3, 0.32, 2.4, C.acierFonce, s * e, H + 0.1, 0);                 // balancier
        for(const z of [-0.9, -0.3, 0.3, 0.9]) a.cylindre(0.14, 0.12, C.acier, s * e, H + 0.3, z, 0, 0, Math.PI / 2, 8);
      }
      for(let k = 1; k < H / 0.6; k++) a.boite(0.4, 0.03, 0.03, C.acierFonce, 0, k * 0.6, 0.36);   // échelle
    });
    appuis.push({ x: p.x, z: p.z, y: y0 + H + 0.42 });
  }
  appuis.push({ x: ts.amont.x, z: ts.amont.z, y: poser(ts.amont.x, ts.amont.z) + 5.0 });

  // Câbles (légèrement pendants entre deux appuis) et sièges immobiles
  const sieges = [];
  for(const s of [-1, 1]){
    const pts = [];
    for(let i = 0; i < appuis.length - 1; i++){
      const A = appuis[i], B = appuis[i + 1], portee = Math.hypot(B.x - A.x, B.z - A.z);
      for(let k = 0; k < 10; k++){
        const f = k / 10;
        pts.push(new THREE.Vector3(A.x + (B.x - A.x) * f + px * s * e, A.y + (B.y - A.y) * f - portee * 0.018 * Math.sin(Math.PI * f), A.z + (B.z - A.z) * f + pz * s * e));
      }
    }
    const fin = appuis[appuis.length - 1];
    pts.push(new THREE.Vector3(fin.x + px * s * e, fin.y, fin.z + pz * s * e));
    a.ajouter(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.06, 5), C.noir);
    // Un siège tous les « espacementSieges » mètres
    let parcouru = 0, prochain = 10;
    for(let i = 1; i < pts.length; i++){
      const l = pts[i].distanceTo(pts[i - 1]);
      while(parcouru + l >= prochain && prochain < L - 8){
        const f = (prochain - parcouru) / l;
        sieges.push({ p: pts[i - 1].clone().lerp(pts[i], f), rot: s > 0 ? rotY : rotY + Math.PI });
        prochain += ts.espacementSieges;
      }
      parcouru += l;
    }
  }
  groupe.add(a.mesh(), lum.mesh('lumineux', false));
  const inst = new THREE.InstancedMesh(geometrieSiege(), materiau('sommets'), sieges.length);
  inst.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), un = new THREE.Vector3(1, 1, 1), axe = new THREE.Vector3(0, 1, 0);
  sieges.forEach((s, i) => inst.setMatrixAt(i, m.compose(s.p, q.setFromAxisAngle(axe, s.rot), un)));
  groupe.add(inst);
  return groupe;
}

// ---------------------------------------------------------------------------------------
// Dameuse : elle passe sur la piste quand l'objectif de neige est atteint
// Repère : avant vers +z, sol à y = 0. Chenilles, caisse rouge, cabine, lame à l'avant, fraise et peigne à l'arrière.
// ---------------------------------------------------------------------------------------
let _texFaisceau = null;
function creerDameuse(){
  const g = new THREE.Group(), C = COULEURS, a = new Atelier(), rouge = '#C8202F';
  // Chenilles (large bande à crampons) et barbotins
  for(const s of [-1, 1]){
    a.boite(1.0, 0.75, 4.2, '#23272F', s * 1.65, 0.45, 0);
    for(const z of [-2.1, 2.1]) a.cylindre(0.38, 1.0, '#23272F', s * 1.65, 0.45, z, 0, 0, Math.PI / 2, 10);
    for(let k = 0; k < 14; k++) a.boite(1.04, 0.06, 0.12, '#3A404B', s * 1.65, 0.84, -1.95 + k * 0.3);   // crampons
    a.boite(0.08, 0.3, 3.6, rouge, s * 2.17, 0.75, 0);                                                  // carter
  }
  // Caisse et capot moteur
  a.boite(2.3, 0.8, 4.0, rouge, 0, 1.15, -0.1);
  a.boite(2.1, 0.5, 1.6, rouge, 0, 1.7, -1.1);
  for(let k = 0; k < 5; k++) a.boite(1.6, 0.04, 0.06, '#7A1520', 0, 1.96, -1.7 + k * 0.28);               // grille du capot
  // Cabine vitrée
  a.boite(2.1, 1.25, 1.7, rouge, 0, 2.15, 0.85);
  a.boite(2.0, 0.85, 1.72, '#18304F', 0, 2.25, 0.85);                                                   // vitres latérales
  a.boite(1.9, 0.85, 0.06, '#1E3A60', 0, 2.25, 1.72, -0.12, 0, 0);                                      // pare-brise
  a.boite(2.2, 0.12, 1.9, '#E8ECF2', 0, 2.83, 0.85);                                                    // toit blanc
  a.boite(1.4, 0.1, 0.18, C.noir, 0, 2.95, 1.55);                                                       // rampe de phares
  // Lame à l'avant (bras, lame bombée, ailes)
  for(const s of [-1, 1]) a.tube([s * 0.9, 0.9, 1.6], [s * 1.1, 0.75, 2.75], 0.09, C.acierFonce, 6);
  a.boite(4.6, 1.0, 0.14, rouge, 0, 0.62, 2.95, -0.25, 0, 0);
  for(const s of [-1, 1]) a.boite(0.14, 0.9, 0.7, rouge, s * 2.3, 0.6, 2.7, 0, s * 0.35, 0);
  a.boite(4.6, 0.08, 0.2, '#B9C0CA', 0, 0.12, 3.06);                                                     // couteau
  // Fraise et peigne à l'arrière
  a.tube([0, 0.9, -2.0], [0, 0.6, -2.9], 0.1, C.acierFonce, 6);
  a.cylindre(0.38, 4.4, '#5D6B7A', 0, 0.42, -3.1, 0, 0, Math.PI / 2, 10);
  a.boite(4.5, 0.35, 0.7, rouge, 0, 0.75, -3.1);
  a.boite(4.4, 0.04, 1.3, '#1C1F25', 0, 0.06, -4.0);                                                     // peigne (finisseur)
  g.add(a.mesh());
  // Phares (toujours allumés) et faisceau sur la neige
  const l = new Atelier();
  for(const x of [-0.55, -0.2, 0.2, 0.55]) l.sphere(0.07, '#FFF6D8', x, 2.95, 1.66, 6);
  for(const x of [-0.8, 0.8]) l.sphere(0.09, '#FFF6D8', x, 1.35, 1.92, 6);
  g.add(l.mesh('lumineux', false));
  _texFaisceau = _texFaisceau || canvasTexture(128, 128, c => {
    const gr = c.createRadialGradient(64, 128, 4, 64, 128, 128);
    gr.addColorStop(0, 'rgba(255,244,214,.55)'); gr.addColorStop(1, 'rgba(255,244,214,0)');
    c.fillStyle = gr; c.beginPath(); c.moveTo(64, 128); c.lineTo(0, 0); c.lineTo(128, 0); c.closePath(); c.fill();
  });
  const faisceau = new THREE.Mesh(new THREE.PlaneGeometry(9, 14), new THREE.MeshBasicMaterial({ map: _texFaisceau, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  faisceau.rotation.x = -Math.PI / 2;
  faisceau.position.set(0, 0.15, 3.1 + 7);
  g.add(faisceau);
  // Gyrophare orange
  const gyro = lampe(0.13, '#FFA53A', true);
  gyro.position.set(0, 2.9, 0.3);
  g.add(gyro);
  g.userData = { gyro, dameuse: true };
  return g;
}
function animerDameuse(g, temps){
  g.userData.gyro.material.color.set((temps * 2.2) % 1 < 0.5 ? '#FFA53A' : '#5A3A12');
}

// ---------------------------------------------------------------------------------------
// Réseau construit : trace des tranchées en surface, conduites et câbles enterrés (vue sous-sol)
// ---------------------------------------------------------------------------------------
let _matTrace = null;
const _matReseau = {};
function materiauReseau(couleur){ return _matReseau[couleur] || (_matReseau[couleur] = new THREE.MeshBasicMaterial({ color: couleur })); }
// Points le long d'une ligne droite A → B, posés sur le terrain (+ dy), décalés de « decal » m sur le côté
function pointsLigne(A, B, poser, dy, decal = 0, pas = 3){
  const L = Math.hypot(B.x - A.x, B.z - A.z) || 1, n = Math.max(2, Math.ceil(L / pas));
  const px = -(B.z - A.z) / L, pz = (B.x - A.x) / L, pts = [];
  for(let i = 0; i <= n; i++){
    const x = A.x + (B.x - A.x) * i / n + px * decal, z = A.z + (B.z - A.z) * i / n + pz * decal;
    pts.push(new THREE.Vector3(x, poser(x, z) + dy, z));
  }
  return pts;
}
function creerTranchee3D(A, B, tr, poser){
  // Surface : bande de neige remuée (tranchée rebouchée)
  const gauche = pointsLigne(A, B, poser, 0.12, -0.8), droite = pointsLigne(A, B, poser, 0.12, 0.8), pos = [], idx = [];
  gauche.forEach((g, i) => {
    pos.push(g.x, g.y, g.z, droite[i].x, droite[i].y, droite[i].z);
    if(i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  _matTrace = _matTrace || new THREE.MeshLambertMaterial({ color: '#9AA7C2', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const surface = new THREE.Mesh(geo, _matTrace);
  surface.receiveShadow = true;
  // Sous terre : conduite d'eau (bleu), câble (jaune) et conduite d'air (blanc), côte à côte dans une tranchée commune
  const dessous = new THREE.Group(), prof = -CONFIG.construction.profondeur;
  const tuyau = (decal, r, couleur) => {
    const pts = pointsLigne(A, B, poser, prof, decal);
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 6), materiauReseau(couleur));
  };
  const presents = [['eau', 0.3, COULEURS.reseauEau], ['air', 0.22, COULEURS.reseauAir], ['cable', 0.18, COULEURS.reseauElec]].filter(([q]) => tr[q]);
  presents.forEach(([, r, couleur], i) => dessous.add(tuyau((i - (presents.length - 1) / 2) * 0.9, r, couleur)));
  return { surface, dessous };
}
// Aperçu d'une tranchée proposée (tube clair au-dessus du sol, épaisseur selon le zoom)
function creerApercu(A, B, poser, couleur, epaisseur){
  const pts = pointsLigne(A, B, poser, 0.6 + epaisseur);
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, epaisseur, 6),
    new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.75, depthTest: false }));
}
// Anneau qui marque le point de départ choisi
function creerSurbrillance(){
  const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 40), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  m.visible = false;
  return m;
}
// Petite étiquette au-dessus d'un regard : goutte (eau), éclair (électricité) et, pour une perche, nuage d'air,
// en couleur s'ils sont raccordés. air = null : pas d'icône d'air (ventilateur).
const _texIcones = {};
function textureIcone(eau, elec, air = null){
  const k = `${eau}${elec}${air}`, w = air === null ? 128 : 192;
  return _texIcones[k] || (_texIcones[k] = canvasTexture(w, 64, g => {
    g.fillStyle = 'rgba(11,20,38,.85)';
    g.beginPath(); g.moveTo(14, 2); g.arcTo(w - 2, 2, w - 2, 62, 12); g.arcTo(w - 2, 62, 2, 62, 12); g.arcTo(2, 62, 2, 2, 12); g.arcTo(2, 2, w - 2, 2, 12); g.fill();
    if(air !== null){
      // « Air » : trois traits de souffle
      g.strokeStyle = air ? COULEURS.reseauAir : '#4E586B'; g.lineWidth = 7; g.lineCap = 'round';
      for(const [y, l] of [[18, 40], [32, 30], [46, 40]]){ g.beginPath(); g.moveTo(140, y); g.lineTo(140 + l * 0.8, y); g.stroke(); }
      g.beginPath(); g.arc(172, 22, 8, Math.PI, Math.PI * 2.6); g.stroke();
    }
    g.fillStyle = eau ? COULEURS.reseauEau : '#4E586B';
    g.beginPath(); g.moveTo(36, 8); g.quadraticCurveTo(54, 32, 52, 40); g.arc(36, 40, 16, 0, Math.PI); g.quadraticCurveTo(18, 32, 36, 8); g.fill();
    g.fillStyle = elec ? COULEURS.reseauElec : '#4E586B';
    g.beginPath(); g.moveTo(98, 6); g.lineTo(74, 36); g.lineTo(90, 36); g.lineTo(82, 58); g.lineTo(110, 26); g.lineTo(94, 26); g.lineTo(106, 6); g.closePath(); g.fill();
  }));
}
// Petit point de couleur au-dessus d'un enneigeur : vert en marche, rouge à l'arrêt, jaune en défaut
let _texPoint = null;
function creerPointEtat(){
  _texPoint = _texPoint || canvasTexture(32, 32, g => {
    g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(11,20,38,.9)'; g.lineWidth = 5;
    g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.fill(); g.stroke();
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _texPoint, color: COULEURS.voyants.arret, sizeAttenuation: false, depthTest: false, transparent: true, fog: false }));
  sp.scale.set(0.016, 0.016, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 9;
  return sp;
}
function creerIconeEtat(avecAir = false){
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureIcone(false, false, avecAir ? false : null), sizeAttenuation: false, depthTest: false, transparent: true, fog: false }));
  sp.scale.set(avecAir ? 0.096 : 0.064, 0.032, 1);
  sp.center.set(0.5, 0);
  sp.renderOrder = 9;
  return sp;
}
