'use strict';
/* Nivoculteur · effets — ciel, lumières, neige
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   5. EFFETS — ciel, étoiles, lune, lumières (plus tard : particules de neige, brouillard, tas de neige)
   ===================================================================================== */
const COULEUR_HORIZON = '#22396A';

function creerCiel(){
  const R = 3500, geo = new THREE.SphereGeometry(R, 24, 16);
  const haut = new THREE.Color('#030817'), milieu = new THREE.Color('#0D1A36'), horizon = new THREE.Color(COULEUR_HORIZON);
  const P = geo.attributes.position, col = [], c = new THREE.Color();
  for(let i = 0; i < P.count; i++){
    const y = P.getY(i) / R;
    if(y < 0.02) c.copy(horizon);
    else if(y < 0.25) c.copy(horizon).lerp(milieu, (y - 0.02) / 0.23);
    else c.copy(milieu).lerp(haut, (y - 0.25) / 0.75);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -2;
  return mesh;
}

function creerEtoiles(nombre){
  const groupe = new THREE.Group(), r = alea(2024);
  for(const [part, taille, opacite] of [[0.75, 1.6, 0.75], [0.25, 2.6, 0.95]]){
    const pos = [];
    for(let i = 0; i < nombre * part; i++){
      const az = r() * Math.PI * 2, el = Math.asin(0.1 + r() * 0.9);
      pos.push(Math.cos(el) * Math.sin(az) * 3000, Math.sin(el) * 3000, Math.cos(el) * Math.cos(az) * 3000);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#F4F7FF', size: taille, sizeAttenuation: false, transparent: true, opacity: opacite, fog: false, depthWrite: false }));
    pts.renderOrder = -1;
    groupe.add(pts);
  }
  return groupe;
}

// Halo doux dessiné par le code (pas d'image externe)
function textureHalo(){
  return canvasTexture(128, 128, g => {
    const d = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.2, 'rgba(220,230,255,.45)'); d.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 128, 128);
  });
}
const DIRECTION_LUNE = [-0.5, 0.72, -0.48];             // d'où vient la lumière de la lune

function creerLune(){
  const groupe = new THREE.Group(), dir = new THREE.Vector3(...DIRECTION_LUNE).normalize();
  const disque = new THREE.Mesh(new THREE.SphereGeometry(70, 20, 14), new THREE.MeshBasicMaterial({ color: '#F4F1E2', fog: false }));
  disque.position.copy(dir).multiplyScalar(2800);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textureHalo(), color: '#C9D8FF', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.setScalar(780);
  halo.position.copy(disque.position);
  groupe.add(disque, halo);
  return groupe;
}

// demi : moitié de la zone couverte par les ombres (m), centre : point visé par la lune
function creerLumieres(demi, centre){
  const groupe = new THREE.Group();
  groupe.add(new THREE.HemisphereLight('#5876B4', '#0A1020', 0.5));
  groupe.add(new THREE.AmbientLight('#22345A', 0.2));
  const lune = new THREE.DirectionalLight('#C6D5FF', 0.72);
  const dir = new THREE.Vector3(...DIRECTION_LUNE).normalize();
  lune.position.copy(centre).addScaledVector(dir, demi * 2.2);
  lune.target.position.copy(centre);
  if(CONFIG.graphismes.ombres){
    lune.castShadow = true;
    lune.shadow.mapSize.set(CONFIG.graphismes.tailleOmbres, CONFIG.graphismes.tailleOmbres);
    const cam = lune.shadow.camera;
    cam.left = -demi; cam.right = demi; cam.top = demi; cam.bottom = -demi; cam.near = demi * 0.3; cam.far = demi * 4.5;
    lune.shadow.bias = -0.0005;
    lune.shadow.normalBias = demi / 500;
  }
  groupe.add(lune, lune.target);
  return groupe;
}

// ---------------------------------------------------------------------------------------
// Jets de neige : les flocons partent de la tête de buses et retombent sur la zone enneigée
// (le point de chute, déporté par le vent, vient de la simulation), avec un nuage de brouillard autour.
// sources : [{ depart: Vector3, arrivee: Vector3, rayon, hauteur, force (0 à 1) }]
// ---------------------------------------------------------------------------------------
let _texFlocon = null;
function textureFlocon(){
  return _texFlocon || (_texFlocon = canvasTexture(32, 32, g => {
    const d = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    d.addColorStop(0, 'rgba(255,255,255,1)'); d.addColorStop(0.45, 'rgba(240,246,255,.8)'); d.addColorStop(1, 'rgba(230,240,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 32, 32);
  }));
}
function creerJets(max){
  const pos = new Float32Array(max * 3).fill(-9999);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.8, map: textureFlocon(), color: '#F4F8FF', transparent: true, opacity: 0.9, depthWrite: false }));
  points.frustumCulled = false;
  const groupe = new THREE.Group(), brumes = [], parts = Array.from({ length: max }, () => ({ s: 2 }));
  const matBrume = new THREE.SpriteMaterial({ map: textureHalo(), color: '#DCE6F5', transparent: true, opacity: 0.35, depthWrite: false });
  groupe.add(points);
  let vide = true;
  function vider(){
    pos.fill(-9999); geo.attributes.position.needsUpdate = true;
    for(const p of parts) p.s = 2;
    for(const b of brumes) b.visible = false;
    vide = true;
  }
  function maj(dt, sources, temps){
    if(!sources.length){ if(!vide) vider(); return; }
    vide = false;
    for(let i = 0; i < max; i++){
      const p = parts[i];
      if(p.s >= 1){
        // Un flocon arrivé au sol repart d'une buse (chaque canon a sa part de flocons)
        const src = sources[i % sources.length];
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * src.rayon * 0.8;
        p.src = src; p.s = 0; p.T = 1.6 + Math.random() * 1.6;
        p.ox = Math.cos(a) * r; p.oz = Math.sin(a) * r; p.arc = src.hauteur * (0.6 + Math.random() * 0.7);
      }
      p.s += dt / p.T;
      const s = Math.min(1, p.s), A = p.src.depart, B = p.src.arrivee;
      pos[i * 3] = A.x + (B.x - A.x) * s + p.ox * s;
      pos[i * 3 + 1] = A.y + (B.y - A.y) * s + p.arc * 4 * s * (1 - s);
      pos[i * 3 + 2] = A.z + (B.z - A.z) * s + p.oz * s;
    }
    geo.attributes.position.needsUpdate = true;
    // Brouillard autour de chaque canon qui produit
    sources.forEach((src, k) => {
      if(!brumes[k]){ brumes[k] = new THREE.Sprite(matBrume); groupe.add(brumes[k]); }
      const b = brumes[k];
      b.visible = true;
      b.position.copy(src.depart).lerp(src.arrivee, 0.15);
      b.scale.setScalar((5 + src.rayon * 0.6) * (0.85 + 0.15 * Math.sin(temps * 1.3 + k)) * (0.5 + 0.5 * src.force));
    });
    for(let k = sources.length; k < brumes.length; k++) brumes[k].visible = false;
  }
  return { groupe, maj, vider };
}

// Repère posé là où l'on touche le terrain
function creerRepere(){
  const groupe = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: '#FF9A2E', fog: false });
  const anneau = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 24), mat);
  anneau.rotation.x = -Math.PI / 2;
  const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 8), mat);
  fleche.rotation.x = Math.PI;
  fleche.position.y = 3.2;
  groupe.add(anneau, fleche);
  groupe.userData.fleche = fleche;
  groupe.visible = false;
  return groupe;
}
