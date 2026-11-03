/* Baroudeur : la scène 3D, en style « dessin animé » : couleurs en aplats (ombrage en 3 tons) et contours noirs.
   Les objets sont faits de formes simples (boîtes, cylindres, cônes) ; chaque objet a son contour : la même forme,
   un peu plus grande, retournée et noire (on n'en voit que le bord). */
window.BAROUDEUR_SCENE = (() => {
  'use strict';
  const M = window.BAROUDEUR_MONDE;
  let T = null, DEGRADE = null, MAT_CONTOUR = null;
  const NOIR = 0x1E1E1E;

  function init(THREE){
    T = THREE;
    const d = new Uint8Array([95, 95, 95, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
    DEGRADE = new T.DataTexture(d, 3, 1, T.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T.NearestFilter; DEGRADE.needsUpdate = true;
    MAT_CONTOUR = new T.MeshBasicMaterial({ color:NOIR, side:T.BackSide });
  }
  const toon = (o = {}) => new T.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));

  /* ---------- Les formes ----------
     une pièce : { f:'boite'|'cyl'|'cone'|'boule'|'toit', d:[dimensions], c:couleur, p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz] }
     on fusionne toutes les pièces d'un objet en une seule géométrie (couleurs par sommet), et pareil pour son contour */
  function geo(f, d, e = 0){
    switch(f){
      case 'boite': return new T.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 10);
      case 'cone': return new T.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 8);
      case 'boule': return new T.IcosahedronGeometry(d[0] + e, d[1] || 0);
      case 'toit': { const g = new T.CylinderGeometry(d[0] + e, d[0] + e, d[1] + 2 * e, 3, 1, false, Math.PI / 2); g.rotateZ(Math.PI / 2); return g; }   // un prisme le long de x, la pointe en haut
    }
  }
  const _m = () => new T.Matrix4();
  function matrice(p){
    const q = new T.Quaternion().setFromEuler(new T.Euler(...(p.r || [0, 0, 0]), 'YXZ'));
    return _m().compose(new T.Vector3(...(p.p || [0, 0, 0])), q, new T.Vector3(...(p.s || [1, 1, 1])));
  }
  function fusion(pieces, epaisseur = 0){
    const pos = [], nor = [], col = [], c = new T.Color();
    for(const p of pieces){
      let g = geo(p.f, p.d, epaisseur); g = g.index ? g.toNonIndexed() : g;
      g.applyMatrix4(matrice(p));
      const a = g.attributes.position.array, n = g.attributes.normal.array;
      c.set(p.c || 0xffffff);
      for(let i = 0; i < a.length; i += 3){ pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
      g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  }
  // un objet (avec son contour) à partir de ses pièces
  function objet(pieces, e = .07, mat = null){
    const gr = new T.Group();
    gr.add(new T.Mesh(fusion(pieces), mat || toon({ vertexColors:true })));
    const ct = new T.Mesh(fusion(pieces, e), MAT_CONTOUR); gr.add(ct);
    return gr;
  }

  /* ---------- Le terrain : des morceaux de 50 × 50 cases ---------- */
  function terrain(scene){
    const { N, PAS, DEMI, H } = M, M1 = N + 1, MOR = 50;
    const mat = toon({ vertexColors:true });
    // les normales calculées sur toute la grille (pas de couture entre les morceaux)
    const nrm = new Float32Array(M1 * M1 * 3);
    for(let j = 0; j <= N; j++) for(let i = 0; i <= N; i++){
      const hx = H[j * M1 + Math.min(N, i + 1)] - H[j * M1 + Math.max(0, i - 1)], hz = H[Math.min(N, j + 1) * M1 + i] - H[Math.max(0, j - 1) * M1 + i];
      const l = Math.hypot(hx, 2 * PAS, hz), k = (j * M1 + i) * 3; nrm[k] = -hx / l; nrm[k + 1] = 2 * PAS / l; nrm[k + 2] = -hz / l;
    }
    const cols = new Float32Array(M1 * M1 * 3);
    for(let j = 0; j <= N; j++) for(let i = 0; i <= N; i++){ const c = M.couleurSol(i, j), k = (j * M1 + i) * 3; cols[k] = c[0]; cols[k + 1] = c[1]; cols[k + 2] = c[2]; }
    for(let bj = 0; bj < N; bj += MOR) for(let bi = 0; bi < N; bi += MOR){
      const n = MOR + 1, pos = new Float32Array(n * n * 3), no = new Float32Array(n * n * 3), co = new Float32Array(n * n * 3), idx = [];
      for(let j = 0; j < n; j++) for(let i = 0; i < n; i++){
        const gi = bi + i, gj = bj + j, k = gj * M1 + gi, o = (j * n + i) * 3;
        pos[o] = -DEMI + gi * PAS; pos[o + 1] = H[k]; pos[o + 2] = -DEMI + gj * PAS;
        no[o] = nrm[k * 3]; no[o + 1] = nrm[k * 3 + 1]; no[o + 2] = nrm[k * 3 + 2];
        co[o] = cols[k * 3]; co[o + 1] = cols[k * 3 + 1]; co[o + 2] = cols[k * 3 + 2];
      }
      for(let j = 0; j < MOR; j++) for(let i = 0; i < MOR; i++){
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;     // a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1)
        idx.push(a, c, b, c, d, b);                                // les mêmes triangles que M.hauteur : (00,01,10) et (01,11,10)
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(no, 3)); g.setAttribute('color', new T.BufferAttribute(co, 3));
      g.setIndex(idx); g.computeBoundingSphere();
      scene.add(new T.Mesh(g, mat));
    }
    // l'eau
    const eau = new T.Mesh(new T.PlaneGeometry(M.TAILLE, M.TAILLE), toon({ color:0x4FB0E6, transparent:true, opacity:.8 }));
    eau.rotation.x = -Math.PI / 2; eau.position.y = M.W; eau.renderOrder = 2; scene.add(eau);
  }

  /* ---------- Le décor en séries (un seul dessin pour tous les sapins, etc.) ---------- */
  function serie(scene, pieces, liste, regler, e = .06){
    if(!liste.length) return;
    const g = fusion(pieces), gc = fusion(pieces, e);
    const im = new T.InstancedMesh(g, toon({ vertexColors:true }), liste.length), ic = new T.InstancedMesh(gc, MAT_CONTOUR, liste.length);
    const m = _m(), q = new T.Quaternion(), v = new T.Vector3(), s = new T.Vector3(), c = new T.Color();
    liste.forEach((it, k) => {
      const [x, y, z, t, r] = it; q.setFromAxisAngle(new T.Vector3(0, 1, 0), r); v.set(x, y - .15, z); s.set(t, t, t);
      if(regler) regler(it, s, c);
      m.compose(v, q, s); im.setMatrixAt(k, m); ic.setMatrixAt(k, m);
      if(regler) im.setColorAt(k, c);
    });
    scene.add(im, ic);
  }
  function decor(scene){
    const D = M.DECOR;
    serie(scene, [
      { f:'cyl', d:[.25, .32, 1.6, 6], c:0x7A4E2D, p:[0, .8, 0] },
      { f:'cone', d:[2.1, 3, 7], c:0x2F7D4A, p:[0, 2.6, 0] }, { f:'cone', d:[1.65, 2.6, 7], c:0x3A9157, p:[0, 4, 0] }, { f:'cone', d:[1.1, 2.1, 7], c:0x47A563, p:[0, 5.3, 0] },
    ], D.sapins, (it, s, c) => { c.setRGB(1, 1, 1); if(it[1] > 70){ c.setRGB(.85, .95, .95); } s.set(it[3], it[3] * (1 + (it[4] % 1) * .4), it[3]); });
    serie(scene, [
      { f:'cyl', d:[.28, .38, 2.2, 6], c:0x7A4E2D, p:[0, 1.1, 0] },
      { f:'boule', d:[2, 0], c:0x5DB84A, p:[0, 3.4, 0] }, { f:'boule', d:[1.3, 0], c:0x6CC657, p:[.9, 4.2, .4] }, { f:'boule', d:[1.2, 0], c:0x55AD43, p:[-.8, 3.9, -.6] },
    ], D.arbres, (it, s, c) => { const k = (it[4] * 7) % 1; c.setRGB(1 - k * .15, 1, 1 - k * .3); });
    serie(scene, [{ f:'boule', d:[1, 0], c:0xFFFFFF, p:[0, .35, 0] }], D.rochers, (it, s, c) => {
      const R = M.regions(it[0], it[2]); if(R.d > .5) c.setHex(0xC07A50); else if(it[1] > 70) c.setHex(0xB7B8BE); else c.setHex(0x9C9894);
      s.set(it[3] * 1.2, it[3] * .8, it[3]); }, .05);
    serie(scene, [
      { f:'cyl', d:[.32, .36, 3.2, 8], c:0x4E9A3F, p:[0, 1.6, 0] }, { f:'boule', d:[.33, 1], c:0x4E9A3F, p:[0, 3.2, 0] },
      { f:'cyl', d:[.2, .2, 1, 6], c:0x4E9A3F, p:[.55, 1.6, 0], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.2, .2, 1.1, 6], c:0x4E9A3F, p:[.95, 2.1, 0] },
      { f:'cyl', d:[.18, .18, .8, 6], c:0x4E9A3F, p:[-.5, 1.2, 0], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.18, .18, .9, 6], c:0x4E9A3F, p:[-.85, 1.6, 0] },
    ], D.cactus, null);
  }

  /* ---------- Les maisons abandonnées ---------- */
  const COUL_N = [0, 0x2FB04F, 0x1F6FD6, 0xE0322B, 0x202020];
  function planches(x, y, z, l, h, rot, c = 0x6B4A2E){ return [{ f:'boite', d:[l, .25, .1], c, p:[x, y + h * .2, z], r:[0, rot, .25] }, { f:'boite', d:[l, .25, .1], c, p:[x, y - h * .2, z], r:[0, rot, -.2] }]; }
  function modeleMaison(m){
    const P = [], neige = m.y > 70;
    if(m.style === 'ferme'){
      P.push({ f:'boite', d:[9, 5, 7], c:0xD9CBB0, p:[0, 2.5, 0] });
      P.push({ f:'boite', d:[9.2, .5, 7.2], c:0xA8987C, p:[0, .25, 0] });
      P.push({ f:'toit', d:[4.6, 9.6], c:0xB5523B, p:[-1.2, 6.2, 0], s:[1, .55, 1], r:[0, 0, -.05] });
      P.push({ f:'boite', d:[3, .25, 3.4], c:0x3B2A20, p:[2.2, 6.7, .4], r:[0, 0, -.45] });           // le trou dans le toit
      P.push({ f:'boite', d:[1, 2.5, 1], c:0xA8987C, p:[-3, 7.2, -2] });
      P.push({ f:'boite', d:[1.5, 2.6, .2], c:0x3B2A20, p:[0, 1.3, 3.55] });                         // la porte
      for(const x of [-2.8, 2.8]){ P.push({ f:'boite', d:[1.4, 1.3, .2], c:0x26303A, p:[x, 3, 3.55] }); P.push(...planches(x, 3, 3.7, 1.7, 1.3, 0)); }
      P.push({ f:'boite', d:[3.2, .3, .3], c:0x6B4A2E, p:[2, .4, 5], r:[0, .6, .3] });                 // une poutre tombée
    } else if(m.style === 'cabane'){
      P.push({ f:'boite', d:[7, 3.6, 6], c:0x8A5A35, p:[0, 1.8, 0] });
      for(let y = .5; y < 3.6; y += .8) P.push({ f:'boite', d:[7.1, .1, 6.1], c:0x5E3B22, p:[0, y, 0] });
      P.push({ f:'toit', d:[3.9, 7.8], c:0x5D6B5A, p:[0, 4.6, 0], s:[1, .5, 1], r:[0, 0, .12] });
      P.push({ f:'boite', d:[1.3, 2.4, .2], c:0x2A1D14, p:[1.5, 1.2, 3.05], r:[0, 0, .08] });
      P.push({ f:'boite', d:[1.2, 1, .2], c:0x26303A, p:[-1.6, 2.2, 3.05] }); P.push(...planches(-1.6, 2.2, 3.2, 1.5, 1, 0));
      P.push({ f:'cyl', d:[.15, .15, 3, 6], c:0x5E3B22, p:[3, 1.5, 4.2] }, { f:'cyl', d:[.15, .15, 3, 6], c:0x5E3B22, p:[-3, 1.2, 4.2], r:[0, 0, .3] });
      P.push({ f:'boite', d:[7, .2, 1.6], c:0x6E4A2C, p:[0, 3, 3.6], r:[.5, 0, 0] });                 // l'auvent effondré
      P.push({ f:'cyl', d:[.5, .5, 1, 8], c:0x7A5A3A, p:[-3.4, .5, 2.2] });                          // un tonneau
    } else if(m.style === 'chalet'){
      P.push({ f:'boite', d:[8, 2.6, 8], c:0x9C9890, p:[0, 1.3, 0] });
      P.push({ f:'boite', d:[8, 3.4, 8], c:0xA0643A, p:[0, 4.3, 0] });
      for(let y = 3; y < 6; y += .7) P.push({ f:'boite', d:[8.1, .1, 8.1], c:0x74462A, p:[0, y, 0] });
      P.push({ f:'toit', d:[5.6, 9.6], c:0x4A3A30, p:[0, 7.4, 0], s:[1, .62, 1], r:[0, Math.PI / 2, 0] });
      if(neige) P.push({ f:'toit', d:[5.3, 9.8], c:0xF4F7FA, p:[0, 7.75, 0], s:[1, .55, 1], r:[0, Math.PI / 2, 0] });
      P.push({ f:'boite', d:[8.4, .25, 1.4], c:0x74462A, p:[0, 3, 4.6] }, { f:'boite', d:[8.4, .9, .12], c:0x74462A, p:[0, 3.5, 5.25], r:[.2, 0, .1] });
      P.push({ f:'boite', d:[1.4, 2.2, .2], c:0x2A1D14, p:[0, 1.1, 4.05] });
      for(const x of [-2.4, 2.4]){ P.push({ f:'boite', d:[1.2, 1.2, .2], c:0x26303A, p:[x, 4.3, 4.05] }); P.push(...planches(x, 4.3, 4.2, 1.5, 1.2, 0)); }
    } else {   // ranch
      P.push({ f:'boite', d:[9, 3.6, 7], c:0xE0A872, p:[0, 1.8, 0] });
      P.push({ f:'boite', d:[9.4, .5, 7.4], c:0xC98E5A, p:[0, 3.8, 0] });
      for(let x = -3.6; x <= 3.6; x += 1.8) P.push({ f:'cyl', d:[.16, .16, 8.6, 6], c:0x6B4A2E, p:[x, 3.4, .4], r:[Math.PI / 2, 0, 0] });
      P.push({ f:'boite', d:[1.5, 2.5, .2], c:0x2A1D14, p:[-1.5, 1.25, 3.55] });
      P.push({ f:'boite', d:[1.3, 1.1, .2], c:0x26303A, p:[2.4, 2.1, 3.55] }); P.push(...planches(2.4, 2.1, 3.7, 1.6, 1.1, 0));
      P.push({ f:'boite', d:[2.2, 1.2, .15], c:0x8A6440, p:[-4, 2.6, 4.8], r:[0, .3, -.25] }, { f:'cyl', d:[.1, .1, 2.6, 6], c:0x6B4A2E, p:[-4.9, 1.3, 4.6] });  // la pancarte
      P.push({ f:'cyl', d:[.9, 1.1, 1.4, 8], c:0x9C9890, p:[4.8, .7, 3.5] });                        // le puits
    }
    return P;
  }
  // l'orientation : la porte (vers +z) regarde vers le garage
  const orientation = m => Math.atan2(M.GARAGE.x - m.x, M.GARAGE.z - m.z);
  function maisons(scene){
    const L = [];
    for(const m of M.MAISONS){
      const g = objet(modeleMaison(m), .08);
      g.position.set(m.x, m.y - .1, m.z); g.rotation.y = orientation(m);
      scene.add(g);
      // le repère au-dessus : un losange de la couleur de la difficulté (il disparaît quand la maison est fouillée)
      const rep = objet([{ f:'boule', d:[1.2, 0], c:COUL_N[m.n], s:[.8, 1.4, .8] }], .12, toon({ vertexColors:true, emissive:COUL_N[m.n], emissiveIntensity:.35 }));
      rep.position.set(m.x, m.y + 11, m.z); scene.add(rep);
      L.push({ m, g, rep });
    }
    return L;
  }
  function garage(scene){
    const G = M.GARAGE, P = [
      { f:'boite', d:[30, .3, 26], c:0xA9A9A9, p:[0, .15, 0] },
      { f:'boite', d:[14, 7, 10], c:0x6F8FAF, p:[0, 3.5, -8] },
      { f:'boite', d:[14.6, .6, 10.6], c:0xC0392B, p:[0, 7.2, -8] },
      { f:'boite', d:[8, 5.4, .3], c:0x2B2F36, p:[0, 2.7, -2.9] },
      { f:'boite', d:[8.4, 1.6, .3], c:0xFFD23F, p:[0, 8.5, -2.95] },
      { f:'cyl', d:[.7, .7, 1.2, 10], c:0x222222, p:[9, .6, -9] }, { f:'cyl', d:[.7, .7, 1.2, 10], c:0x222222, p:[9, 1.8, -9] }, { f:'cyl', d:[.7, .7, 1.2, 10], c:0x222222, p:[10.6, .6, -8] },
      { f:'boite', d:[1.2, 2.4, .9], c:0xE0322B, p:[-10, 1.2, -4] }, { f:'boite', d:[.8, .5, .2], c:0xFFFFFF, p:[-10, 1.8, -3.5] },
    ];
    const g = objet(P, .08); g.position.set(G.x, G.y, G.z); scene.add(g);
    // l'enseigne
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 52; const c = cv.getContext('2d');
    c.fillStyle = '#FFD23F'; c.fillRect(0, 0, 256, 52); c.fillStyle = '#1E1E1E'; c.font = 'bold 40px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.fillText('GARAGE', 128, 42);
    const tx = new T.CanvasTexture(cv), pl = new T.Mesh(new T.PlaneGeometry(8, 1.6), new T.MeshBasicMaterial({ map:tx }));
    pl.position.set(G.x, G.y + 8.5, G.z - 2.78); scene.add(pl);
  }

  /* ---------- Les vieilles stations-service ---------- */
  function stations(scene){
    for(const st of M.STATIONS){
      const P = [
        { f:'boite', d:[16, .25, 12], c:0x8E8A84, p:[0, .12, 0] },
        { f:'boite', d:[12, .5, 7], c:0xE8E2D2, p:[0, 7.4, 0] }, { f:'boite', d:[12.2, .35, 7.2], c:0xC0392B, p:[0, 7.05, 0] },
        { f:'cyl', d:[.22, .22, 7.2, 8], c:0xD8D2C2, p:[-5, 3.6, -2.8] }, { f:'cyl', d:[.22, .22, 7.2, 8], c:0xD8D2C2, p:[5, 3.6, -2.8] },
        { f:'cyl', d:[.22, .22, 7.2, 8], c:0xD8D2C2, p:[-5, 3.6, 2.8] }, { f:'cyl', d:[.22, .22, 7.2, 8], c:0xD8D2C2, p:[4.7, 3.5, 2.8], r:[0, 0, .05] },
        { f:'boite', d:[1, 2, .8], c:0xD84A3A, p:[-1.6, 1, 0] }, { f:'boite', d:[.7, .5, .1], c:0xF4F1EA, p:[-1.6, 1.5, .42] },
        { f:'boite', d:[1, 2, .8], c:0xD84A3A, p:[1.6, 1, 0], r:[0, 0, .15] },
        { f:'boite', d:[6, 3.4, 4], c:0xC9B89A, p:[0, 1.7, -5.5] }, { f:'boite', d:[1.4, 1, .1], c:0x26303A, p:[-1.5, 2, -3.45] }, { f:'boite', d:[1.1, 2.2, .1], c:0x2A1D14, p:[1.4, 1.1, -3.45] },
        { f:'cyl', d:[.1, .1, 6, 6], c:0x6A6E76, p:[7, 3, 4] }, { f:'boite', d:[2.4, 1.6, .2], c:0xFFD23F, p:[7, 6.4, 4] },
      ];
      const g = objet(P, .07); g.position.set(st.x, st.y, st.z); g.rotation.y = orientation(st); scene.add(g);
      const rep = objet([{ f:'boule', d:[.9, 0], c:0xFF9F1C, s:[.8, 1.4, .8] }], .1, toon({ vertexColors:true, emissive:0xFF9F1C, emissiveIntensity:.35 }));
      rep.position.set(st.x, st.y + 11, st.z); scene.add(rep); st.rep = rep;
    }
  }

  /* ---------- Les pièces d'or ---------- */
  function pieces(scene){
    const n = M.OR.length, g = new T.CylinderGeometry(.6, .6, .14, 16), gc = new T.CylinderGeometry(.68, .68, .22, 16);
    g.rotateX(Math.PI / 2); gc.rotateX(Math.PI / 2);
    const im = new T.InstancedMesh(g, toon({ color:0xFFC93C, emissive:0x8A5A00, emissiveIntensity:.35 }), n), ic = new T.InstancedMesh(gc, MAT_CONTOUR, n);
    const ys = M.OR.map(([x, z]) => Math.max(M.W, M.hauteur(x, z)) + 1.3);
    const mat = _m(), q = new T.Quaternion(), v = new T.Vector3(), un = new T.Vector3(1, 1, 1), zero = new T.Vector3(0, 0, 0), axe = new T.Vector3(0, 1, 0);
    scene.add(im, ic);
    return {
      maj(t, prises){
        for(let k = 0; k < n; k++){
          const [x, z] = M.OR[k]; q.setFromAxisAngle(axe, t * 2.2 + k); v.set(x, ys[k] + Math.sin(t * 2 + k) * .2, z);
          mat.compose(v, q, prises[k] ? zero : un); im.setMatrixAt(k, mat); ic.setMatrixAt(k, mat);
        }
        im.instanceMatrix.needsUpdate = ic.instanceMatrix.needsUpdate = true;
      }, ys,
    };
  }
  function nuages(scene){
    const L = [], rnd = M.graine(5);
    for(let k = 0; k < 14; k++){
      const P = []; for(let b = 0; b < 4; b++) P.push({ f:'boule', d:[6 + rnd() * 5, 1], c:0xFFFFFF, p:[b * 7 - 10, rnd() * 3, rnd() * 6 - 3] });
      const g = new T.Mesh(fusion(P), new T.MeshBasicMaterial({ vertexColors:true, fog:false }));
      g.position.set((rnd() * 2 - 1) * 600, 150 + rnd() * 40, (rnd() * 2 - 1) * 600); scene.add(g); L.push(g);
    }
    return L;
  }

  function construire(THREE, scene){
    init(THREE);
    scene.background = new T.Color(0x9FD8F7);
    scene.fog = new T.Fog(0xCFEAF8, 170, 470);
    scene.add(new T.HemisphereLight(0xFFFFFF, 0x8C9A7A, .5));
    const soleil = new T.DirectionalLight(0xFFFFFF, .62); soleil.position.set(.5, 1, .35); scene.add(soleil);
    terrain(scene); decor(scene); garage(scene); stations(scene);
    return { maisons:maisons(scene), pieces:pieces(scene), nuages:nuages(scene) };
  }
  return { construire, objet, fusion, toon:o => toon(o), get MAT_CONTOUR(){ return MAT_CONTOUR; }, COUL_N, orientation };
})();
