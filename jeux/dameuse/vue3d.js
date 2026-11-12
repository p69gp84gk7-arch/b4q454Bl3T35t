/* Dameuse de nuit : la vue en 3D (Three.js), en style « dessin animé » (ombrage en tons, contours noirs).
   La piste est la même grille que la vue du dessus (cases de 1 m) : l'altitude vient de la pente de chaque rangée,
   la neige ajoute son épaisseur (bosses, creux, tas), et le hors-piste remonte sur les côtés. La neige est peinte
   avec les mêmes images que la vue du dessus (couleur de la neige, velours de la fraise, radar), mises à jour en jouant.
   Repère : x = la largeur de la piste, z = la descente (comme y sur la vue du dessus), y = l'altitude. */
window.DAMEUSE_3D = (() => {
  'use strict';
  let T3 = null, R = null, scene = null, cam = null, ok = false, cv3 = null;
  let DEGRADE = null, CONTOUR = null;
  let T = null, piste = null, ALT = null, BANC = null, HC = null, geo = null, texCv = null, texCtx = null, tex = null;
  let garageMats = [], dam = null, phareAv = null, phareAr = null, lumGarage = null, cable = null, gyroMat = null, lampes = [];
  const camCtl = { yaw:0, pitch:.42, dist:17, cap:0, x:0, y:0, z:0, init:true };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- Les formes (comme un dessin) ---------- */
  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));
  function geom(f, d, e = 0){
    switch(f){
      case 'boite': return new T3.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 10);
      case 'cone': return new T3.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 8);
      case 'boule': return new T3.IcosahedronGeometry(d[0] + e, d[1] || 0);
      case 'demi': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 12, 1, false, 0, Math.PI);   // un demi-cylindre (capot de fraise)
    }
  }
  function matrice(p){
    const q = new T3.Quaternion().setFromEuler(new T3.Euler(...(p.r || [0, 0, 0]), 'YXZ'));
    return new T3.Matrix4().compose(new T3.Vector3(...(p.p || [0, 0, 0])), q, new T3.Vector3(...(p.s || [1, 1, 1])));
  }
  function fusion(pieces, e = 0){
    const pos = [], nor = [], col = [], c = new T3.Color();
    for(const p of pieces){
      let g = geom(p.f, p.d, e); g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(matrice(p));
      const a = g.attributes.position.array, n = g.attributes.normal.array; c.set(p.c ?? 0xffffff);
      for(let i = 0; i < a.length; i += 3){ pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
      g.dispose();
    }
    const out = new T3.BufferGeometry();
    out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    return out;
  }
  function objet(pieces, e = .06, mat = null){
    const gr = new T3.Group();
    gr.add(new T3.Mesh(fusion(pieces), mat || toon({ vertexColors:true })), new T3.Mesh(fusion(pieces, e), CONTOUR));
    return gr;
  }

  /* ---------- Démarrage ---------- */
  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      cv3 = canvas;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      const d = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
      DEGRADE = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T3.NearestFilter; DEGRADE.needsUpdate = true;
      CONTOUR = new T3.MeshBasicMaterial({ color:0x05070C, side:T3.BackSide });
      cam = new T3.PerspectiveCamera(60, 1, .3, 600);
      ok = true;
    }catch(e){ ok = false; }
    return ok;
  }
  function taille(w, h){ if(!ok) return; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 68 : 55; cam.updateProjectionMatrix(); }

  /* ---------- L'altitude : la pente rangée par rangée, et les côtés hors piste qui remontent ---------- */
  function preparerRelief(){
    const W = T.W, H = T.H, M1 = W + 1;
    ALT = new Float32Array(H + 1);
    for(let j = H - 1; j >= 0; j--) ALT[j] = ALT[j + 1] + T.pente[j];
    // pour chaque rangée, où commence et où finit la neige damable : au-delà, ça remonte
    BANC = new Float32Array(M1 * (H + 1));
    const bords = [];
    for(let j = 0; j < H; j++){ let a = -1, b = -1; for(let i = 0; i < W; i++) if(T.etat[j * W + i]){ if(a < 0) a = i; b = i; } bords.push([a, b]); }
    for(let j = 0; j <= H; j++){
      const [a, b] = bords[Math.min(H - 1, j)], [a2, b2] = bords[Math.max(0, j - 1)];
      const ga = a < 0 ? W / 2 : Math.min(a, a2 < 0 ? a : a2), dr = b < 0 ? W / 2 : Math.max(b, b2 < 0 ? b : b2) + 1;
      for(let i = 0; i <= W; i++){
        const d = i < ga ? ga - i : i > dr ? i - dr : 0;
        BANC[j * M1 + i] = d > 0 ? Math.min(18, d * .32 + d * d * .006) + Math.sin(i * .7 + j * .3) * .25 * Math.min(1, d / 4) : 0;
      }
    }
    HC = new Float32Array(M1 * (H + 1));
  }
  // la hauteur d'un coin de case : le sol, plus la neige des cases qui le touchent
  function hauteurCoin(i, j){
    const W = T.W, H = T.H; let s = 0, n = 0, hors = 0;
    for(const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]){
      if(a < 0 || b < 0 || a >= W || b >= H) continue;
      const k = b * W + a; if(T.etat[k]){ s += T.h[k]; n++; } else hors++;
    }
    return ALT[j] + BANC[j * (W + 1) + i] + (n ? s / n / 100 : 0) + (hors && !n ? .35 : 0) * 1;
  }
  function hauteur(x, y){
    const W = T.W, M1 = W + 1, fx = clamp(x, 0, W - 1e-3), fy = clamp(y, 0, T.H - 1e-3), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const h00 = HC[j * M1 + i], h10 = HC[j * M1 + i + 1], h01 = HC[(j + 1) * M1 + i], h11 = HC[(j + 1) * M1 + i + 1];
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  }

  /* ---------- Une nouvelle piste ---------- */
  function nouvellePiste(terrain, opts){
    if(!ok) return;
    T = terrain;
    if(scene){ scene.traverse(o => { if(o.geometry) o.geometry.dispose(); }); if(tex) tex.dispose(); }
    scene = new T3.Scene();
    scene.background = new T3.Color(0x070D1C);
    scene.fog = new T3.Fog(0x0A1224, 55, 230);
    scene.add(new T3.HemisphereLight(0x6B82B8, 0x141A2A, .42));
    const lune = new T3.DirectionalLight(0x9FB4FF, .28); lune.position.set(-.4, 1, -.6); scene.add(lune);
    preparerRelief();
    terrain3D(opts);
    decor(opts);
    dam = dameuse3D(opts.M);
    scene.add(dam.gr);
    neigeQuiVole();
    camCtl.init = true;
  }
  function terrain3D(opts){
    const W = T.W, H = T.H, M1 = W + 1, N = M1 * (H + 1);
    const pos = new Float32Array(N * 3), uv = new Float32Array(N * 2), idx = new Uint32Array(W * H * 6);
    for(let j = 0; j <= H; j++) for(let i = 0; i <= W; i++){
      const k = j * M1 + i; HC[k] = hauteurCoin(i, j);
      pos[k * 3] = i; pos[k * 3 + 1] = HC[k]; pos[k * 3 + 2] = j; uv[k * 2] = i / W; uv[k * 2 + 1] = 1 - j / H;
    }
    let n = 0;
    for(let j = 0; j < H; j++) for(let i = 0; i < W; i++){ const a = j * M1 + i, b = a + 1, c = a + M1, d = c + 1; idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = c; idx[n++] = d; idx[n++] = b; }
    geo = new T3.BufferGeometry();
    geo.setAttribute('position', new T3.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T3.BufferAttribute(uv, 2));
    geo.setAttribute('normal', new T3.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setIndex(new T3.BufferAttribute(idx, 1));
    normales(0, H);
    geo.computeBoundingSphere();
    // la neige : l'image de la vue du dessus (couleurs + velours), en grand
    texCv = document.createElement('canvas'); texCv.width = W * opts.PX; texCv.height = H * opts.PX; texCtx = texCv.getContext('2d');
    tex = new T3.CanvasTexture(texCv); tex.anisotropy = Math.min(4, R.capabilities.getMaxAnisotropy());
    peindreTexture(opts, null);
    piste = new T3.Mesh(geo, new T3.MeshLambertMaterial({ map:tex }));
    scene.add(piste);
  }
  function normales(j0, j1){
    const W = T.W, M1 = W + 1, n = geo.attributes.normal.array;
    j0 = Math.max(0, j0); j1 = Math.min(T.H, j1);
    for(let j = j0; j <= j1; j++) for(let i = 0; i <= W; i++){
      const k = j * M1 + i, hx = HC[j * M1 + Math.min(W, i + 1)] - HC[j * M1 + Math.max(0, i - 1)], hz = HC[Math.min(T.H, j + 1) * M1 + i] - HC[Math.max(0, j - 1) * M1 + i];
      const l = Math.hypot(hx, 2, hz); n[k * 3] = -hx / l; n[k * 3 + 1] = 2 / l; n[k * 3 + 2] = -hz / l;
    }
  }
  // la neige a bougé (la lame) autour de (x, y) : on remet les hauteurs à jour
  function majRelief(x, y, r){
    if(!geo) return;
    const W = T.W, M1 = W + 1, pos = geo.attributes.position.array;
    const j0 = Math.max(0, Math.floor(y - r)), j1 = Math.min(T.H, Math.ceil(y + r)), i0 = Math.max(0, Math.floor(x - r)), i1 = Math.min(W, Math.ceil(x + r));
    for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){ const k = j * M1 + i; HC[k] = hauteurCoin(i, j); pos[k * 3 + 1] = HC[k]; }
    normales(j0 - 1, j1 + 1);
    const a = Math.max(0, j0 - 1) * M1, b = (Math.min(T.H, j1 + 1) + 1) * M1;
    geo.attributes.position.updateRange = { offset:a * 3, count:(b - a) * 3 }; geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.updateRange = { offset:a * 3, count:(b - a) * 3 }; geo.attributes.normal.needsUpdate = true;
  }
  // l'image de la neige : couleurs, velours, marquages (aire de plein, murs) et radar
  function peindreTexture(o, P){
    const c = texCtx, PX = o.PX, W = T.W, H = T.H;
    c.imageSmoothingEnabled = true; c.drawImage(o.fond, 0, 0, W * PX, H * PX); c.drawImage(o.img, 0, 0);
    c.save(); c.scale(PX, PX);
    const ai = T.aire; c.strokeStyle = '#F2B233'; c.lineWidth = .3; c.setLineDash([1, .7]); c.strokeRect(ai.x, ai.y, ai.w, ai.h); c.setLineDash([]);
    c.fillStyle = 'rgba(242,178,51,.9)'; c.font = '700 2px sans-serif'; c.textAlign = 'center'; c.fillText('⛽ PLEIN', ai.x + ai.w / 2, ai.y + ai.h - 1.5);
    for(const m of T.murs){
      c.strokeStyle = 'rgba(214,58,47,.8)'; c.lineWidth = .3; c.setLineDash([1.2, .9]);
      for(const y of [m.y0, m.y1]){ const x = T.xc(y), d = T.lw(y) / 2; c.beginPath(); c.moveTo(x - d, y); c.lineTo(x + d, y); c.stroke(); }
      c.setLineDash([]); c.fillStyle = 'rgba(214,58,47,.7)'; c.font = '700 2.4px sans-serif';
      for(let y = m.y0 + 7, n = 0; y < m.y1 - 3; y += 16, n++){ const x = T.xc(y), d = T.lw(y) / 2; c.fillText(`MUR ${Math.round(m.s * 100)} %`, n % 2 ? x - d + 5 : x + d - 5, y); }
    }
    if(P && o.radar && o.rad){
      const ux = Math.sin(P.a), uy = -Math.cos(P.a), cx = P.x + ux * 2.4, cy = P.y + uy * 2.4, a0 = P.a - Math.PI / 2 - .6, a1 = P.a - Math.PI / 2 + .6;
      c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, 42, a0, a1); c.closePath();
      c.save(); c.clip(); c.globalAlpha = .62; c.imageSmoothingEnabled = false; c.drawImage(o.rad, 0, 0, W, H); c.restore();
      c.strokeStyle = 'rgba(124,255,178,.7)'; c.lineWidth = .25; c.stroke();
    }
    c.restore();
    tex.needsUpdate = true;
  }

  /* ---------- Le décor ---------- */
  function serie(pieces, liste, regler, e = .06, mat = null){
    if(!liste.length) return null;
    const g = fusion(pieces), gc = fusion(pieces, e);
    const im = new T3.InstancedMesh(g, mat || toon({ vertexColors:true }), liste.length), ic = new T3.InstancedMesh(gc, CONTOUR, liste.length);
    const m = new T3.Matrix4(), q = new T3.Quaternion(), v = new T3.Vector3(), s = new T3.Vector3(), Y = new T3.Vector3(0, 1, 0);
    liste.forEach((it, k) => { regler(it, v, q, s, Y); m.compose(v, q, s); im.setMatrixAt(k, m); ic.setMatrixAt(k, m); });
    scene.add(im, ic); return im;
  }
  function decor(o){
    // les sapins enneigés
    serie([
      { f:'cyl', d:[.22, .3, 1.4, 6], c:0x4A3222, p:[0, .7, 0] },
      { f:'cone', d:[1.9, 2.8, 7], c:0x1F5A44, p:[0, 2.4, 0] }, { f:'cone', d:[1.5, 2.4, 7], c:0x24664D, p:[0, 3.7, 0] }, { f:'cone', d:[1, 2, 7], c:0x2B7558, p:[0, 4.9, 0] },
      { f:'cone', d:[.75, .7, 7], c:0xEAF1FA, p:[0, 5.7, 0] }, { f:'cyl', d:[1.25, 1.5, .25, 7], c:0xEAF1FA, p:[0, 3.05, 0] }, { f:'cyl', d:[.85, 1.15, .22, 7], c:0xEAF1FA, p:[0, 4.35, 0] },
    ], T.arbres, (it, v, q, s, Y) => { v.set(it.x, hauteur(it.x, it.y) - .2, it.y); q.setFromAxisAngle(Y, it.v * 6.3); const t = .75 + it.r * .45; s.set(t, t * (1 + it.v * .35), t); });
    // les jalons de balisage, à la couleur de la piste, avec leur bande qui brille
    const jal = [];
    for(let y = T.def ? 32 : 32; y < T.yBas; y += 12){ const c = T.xc(y), d = T.lw(y) / 2 + .6; jal.push([c - d, y], [c + d, y]); }
    const cj = o.couleurPiste === '#16181D' ? 0x22252C : new T3.Color(o.couleurPiste).getHex();
    serie([{ f:'cyl', d:[.07, .07, 1.7, 6], c:cj, p:[0, .85, 0] }, { f:'cyl', d:[.09, .09, .3, 6], c:0xFFFFFF, p:[0, 1.35, 0] }], jal,
      (it, v, q, s) => { v.set(it[0], hauteur(it[0], it[1]), it[1]); s.set(1, 1, 1); }, .04, toon({ vertexColors:true, emissive:0x2A2A2A }));
    // les enneigeurs (perches) et leur lampe verte
    lampes = [];
    for(const e of T.enneigeurs){
      const dir = -e.cote, h0 = hauteur(e.x, e.y), hx = e.x + dir * 5.7, hy = e.y - 1.25, L = Math.hypot(5.7, 1.25), ang = Math.atan2(5.7, 6.2);
      const gr = objet([
        { f:'cyl', d:[.5, .6, .5, 8], c:0x3A404B, p:[0, .25, 0] },
        { f:'cyl', d:[.12, .16, 8.4, 6], c:0x8A93A3, p:[0, 4, 0] },
      ], .05);
      gr.position.set(e.x, h0, e.y);
      // la perche penche au-dessus de la piste
      gr.rotation.set(0, Math.atan2(hx - e.x, hy - e.y), 0); gr.children.forEach(m => { m.rotation.x = ang; m.position.y = 0; });
      scene.add(gr);
      const tete = objet([{ f:'cyl', d:[.45, .6, 1.1, 10], c:0xC9CFD8, r:[Math.PI / 2, 0, 0] }, { f:'boite', d:[.8, .5, .6], c:0x4A5160, p:[0, .45, 0] }], .05);
      const top = new T3.Vector3(0, 8.2, 0).applyEuler(new T3.Euler(ang, gr.rotation.y, 0, 'YXZ'));
      tete.position.set(e.x + top.x, h0 + top.y, e.y + top.z); tete.rotation.y = gr.rotation.y; scene.add(tete);
      const lm = new T3.MeshBasicMaterial({ color:0x7CFFB2 }), lampe = new T3.Mesh(new T3.SphereGeometry(.22, 10, 8), lm);
      lampe.position.set(tete.position.x, tete.position.y + .85, tete.position.z); scene.add(lampe);
      lampes.push({ m:lm, ph:e.ph });
    }
    // les ancres du treuil
    for(const an of T.ancres){
      const g = objet([{ f:'cyl', d:[.25, .3, 1.6, 8], c:0x2A303B, p:[0, .8, 0] }, { f:'cyl', d:[.45, .45, .18, 12], c:0xF2B233, p:[0, 1.65, 0] }], .05);
      g.position.set(an.x, hauteur(an.x, an.y), an.y); scene.add(g);
    }
    // le garage et sa lumière
    const ga = T.garage, gx = ga.x + ga.w / 2, gz = ga.y + ga.h / 2, gh = hauteur(gx, gz);
    const gar = objet([
      { f:'boite', d:[ga.w, 6, ga.h], c:0x5A6475, p:[0, 3, 0] }, { f:'boite', d:[ga.w + .6, .5, ga.h + .6], c:0x8A2F28, p:[0, 6.2, 0] },
      { f:'boite', d:[5, 4.6, .2], c:0x2A303B, p:[-3.5, 2.3, -ga.h / 2 - .05] }, { f:'boite', d:[5, 4.6, .2], c:0x2A303B, p:[3.5, 2.3, -ga.h / 2 - .05] },
      { f:'boite', d:[1.1, 2, .9], c:0xD84A3A, p:[ga.w / 2 + 1.5, 1, -ga.h / 2 - 3] },
    ], .08);
    gar.position.set(gx, gh, gz); scene.add(gar);
    // le garage a ses propres matières : il devient transparent quand la caméra passe dedans
    garageMats = [gar.children[0].material, gar.children[1].material = CONTOUR.clone()];
    const fen = new T3.Mesh(new T3.BoxGeometry(4.2, 3.6, .1), new T3.MeshBasicMaterial({ color:0xFFD27A }));
    fen.position.set(gx + 3.5, gh + 2.1, gz - ga.h / 2 - .2); scene.add(fen);
    const cvE = document.createElement('canvas'); cvE.width = 256; cvE.height = 48; const c = cvE.getContext('2d');
    c.fillStyle = '#1E232B'; c.fillRect(0, 0, 256, 48); c.fillStyle = '#FFD27A'; c.font = 'bold 36px Arial, sans-serif'; c.textAlign = 'center'; c.fillText('GARAGE', 128, 38);
    const ens = new T3.Mesh(new T3.PlaneGeometry(7, 1.3), new T3.MeshBasicMaterial({ map:new T3.CanvasTexture(cvE) }));
    ens.position.set(gx, gh + 5.3, gz - ga.h / 2 - .12); ens.rotation.y = Math.PI; scene.add(ens);
    lumGarage = new T3.PointLight(0xFFD8A0, 1.3, 36, 1.2); lumGarage.position.set(gx, gh + 7, gz - ga.h / 2 - 5); scene.add(lumGarage);
    // le câble du treuil
    cable = new T3.Line(new T3.BufferGeometry().setFromPoints([new T3.Vector3(), new T3.Vector3()]), new T3.LineBasicMaterial({ color:0xE1E8F2 }));
    cable.visible = false; scene.add(cable);
    // les étoiles
    const n = 500, st = new Float32Array(n * 3);
    for(let k = 0; k < n; k++){ const a = Math.random() * 6.283, b = Math.random() * .9 + .08, r = 420; st[k * 3] = T.W / 2 + Math.cos(a) * Math.cos(b) * r; st[k * 3 + 1] = Math.sin(b) * r; st[k * 3 + 2] = T.H / 2 + Math.sin(a) * Math.cos(b) * r; }
    const sg = new T3.BufferGeometry(); sg.setAttribute('position', new T3.BufferAttribute(st, 3));
    scene.add(new T3.Points(sg, new T3.PointsMaterial({ color:0xDDE6FF, size:1.6, sizeAttenuation:false, fog:false })));
    const lune = new T3.Mesh(new T3.CircleGeometry(14, 24), new T3.MeshBasicMaterial({ color:0xF2F0E0, fog:false }));
    lune.position.set(T.W / 2 - 160, 230, -260); lune.lookAt(T.W / 2, 0, T.H / 2); scene.add(lune);
  }

  /* ---------- La dameuse en 3D ----------
     comme sur la vue du dessus (k : la taille) ; repère de la machine : +z vers l'avant, +x vers la gauche */
  function dameuse3D(M){
    const k = M.k, gr = new T3.Group(), corps = new T3.Group();
    const caisse = toon({ color:M.coul }), cab = toon({ color:M.cab }), toit = toon({ color:M.toit });
    const NOIR = 0x191C22, ACIER = 0x8F98A6, GRIS = 0x3B414C, JAUNE = 0xF2B233;
    // les chenilles : la bande (galets, barbotin, tendeur) ; les crampons défilent à part (plus bas)
    const chen = [];
    for(const s of [-1, 1]){
      const x = s * 1.95;
      chen.push({ f:'boite', d:[1.05, .9, 4.6], c:NOIR, p:[x, .52, 0] });                                                      // la bande
      chen.push({ f:'cyl', d:[.5, .5, 1.08, 14], c:NOIR, p:[x, .52, 2.3], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.5, .5, 1.08, 14], c:NOIR, p:[x, .52, -2.3], r:[0, 0, Math.PI / 2] });
      chen.push({ f:'cyl', d:[.36, .36, 1.14, 12], c:GRIS, p:[x, .52, 2.3], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.36, .36, 1.14, 12], c:GRIS, p:[x, .52, -2.3], r:[0, 0, Math.PI / 2] });
      for(let n = 0; n < 5; n++){ const z = -1.6 + n * .8;                                                                       // les galets, et leur moyeu jaune
        chen.push({ f:'cyl', d:[.27, .27, .12, 12], c:0x2C3139, p:[x + s * .55, .34, z], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.09, .09, .14, 8], c:JAUNE, p:[x + s * .57, .34, z], r:[0, 0, Math.PI / 2] }); }
      chen.push({ f:'cyl', d:[.14, .14, .16, 8], c:JAUNE, p:[x + s * .55, .52, 2.3], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.14, .14, .16, 8], c:JAUNE, p:[x + s * .55, .52, -2.3], r:[0, 0, Math.PI / 2] });
      chen.push({ f:'boite', d:[.08, .12, 4.4], c:GRIS, p:[x + s * .55, .78, 0] });                                             // le longeron
    }
    chen.push({ f:'boite', d:[3, .7, 5.2], c:0x2A2F38, p:[0, .95, 0] });                                                       // le châssis
    corps.add(objet(chen, .05));
    // le capot moteur, sa grille, l'échappement et le marchepied
    corps.add(objet([{ f:'boite', d:[2.8, .95, 2.15], p:[0, 1.75, -1.4] }, { f:'boite', d:[2.6, .2, 1.9], p:[0, 2.28, -1.45] }], .05, caisse));
    corps.add(objet([
      ...[0, 1, 2, 3, 4].map(n => ({ f:'boite', d:[2.2, .07, .06], c:0x14171D, p:[0, 1.45 + n * .14, -2.5] })),            // la grille arrière
      { f:'cyl', d:[.11, .11, 1.9, 8], c:0x30353E, p:[-1.15, 2.9, -.55] }, { f:'cyl', d:[.16, .12, .22, 8], c:0x1A1D23, p:[-1.15, 3.9, -.55] },   // l'échappement
      { f:'boite', d:[.5, .06, .3], c:ACIER, p:[1.62, 1.05, 1.5] }, { f:'boite', d:[.5, .06, .3], c:ACIER, p:[1.62, 1.55, 1.5] },              // les marches
      { f:'boite', d:[.06, 1.7, .06], c:JAUNE, p:[1.6, 2.3, .3] }, { f:'boite', d:[.06, 1.7, .06], c:JAUNE, p:[1.6, 2.3, 2.3] },               // les poignées
    ], .03));
    // la cabine : le bas peint, les montants, le toit ; les vitres un peu transparentes, avec le conducteur dedans
    corps.add(objet([
      { f:'boite', d:[2.9, .75, 2.85], p:[0, 1.68, 1.1] },
      ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => ({ f:'boite', d:[.14, 1.2, .14], p:[sx * 1.38, 2.62, 1.1 + sz * 1.35] })),
      { f:'boite', d:[.1, 1.2, .1], p:[1.45, 2.62, 1.1] }, { f:'boite', d:[.1, 1.2, .1], p:[-1.45, 2.62, 1.1] },
    ], .04, cab));
    corps.add(objet([{ f:'boite', d:[3, .16, 2.95], p:[0, 3.28, 1.1] }, { f:'boite', d:[2.4, .1, .5], c:0xE8EDF3, p:[0, 1.98, -.32] },
      { f:'boite', d:[2.95, .12, .05], c:0xF4F6F9, p:[0, 1.98, 2.55] }], .04, toit));              // le toit, une bande claire
    const vitre = new T3.MeshToonMaterial({ gradientMap:DEGRADE, color:0x2D5A8C, transparent:true, opacity:.55, depthWrite:false });
    for(const v of [{ d:[2.65, 1.12, .05], p:[0, 2.62, 2.5], r:[-.1, 0, 0] }, { d:[.05, 1.1, 2.55], p:[1.44, 2.62, 1.1] }, { d:[.05, 1.1, 2.55], p:[-1.44, 2.62, 1.1] }, { d:[2.65, 1.1, .05], p:[0, 2.62, -.28] }]){
      const m = new T3.Mesh(new T3.BoxGeometry(...v.d), vitre); m.position.set(...v.p); if(v.r) m.rotation.set(...v.r); corps.add(m);
    }
    corps.add(objet([
      { f:'boite', d:[.5, .55, .35], c:0x23314A, p:[.45, 2.35, 1.2] }, { f:'boule', d:[.2, 1], c:0xE8B48A, p:[.45, 2.85, 1.25] },          // le conducteur
      { f:'boule', d:[.22, 1], c:0xC7281F, s:[1, .7, 1], p:[.45, 2.97, 1.22] },                                                            // son bonnet
      { f:'cyl', d:[.2, .2, .06, 10], c:0x14171D, p:[.45, 2.45, 1.75], r:[1.1, 0, 0] },                                                    // le volant
      { f:'boite', d:[.03, .03, .9], c:0x0D1015, p:[-.4, 2.6, 2.55], r:[0, 0, .6] }, { f:'boite', d:[.03, .03, .9], c:0x0D1015, p:[.55, 2.6, 2.55], r:[0, 0, .6] },   // les essuie-glaces
      { f:'boite', d:[.5, .05, .05], c:0x14171D, p:[1.7, 2.7, 2.35] }, { f:'boite', d:[.08, .4, .28], c:0x14171D, p:[1.95, 2.62, 2.35] }, // les rétroviseurs
      { f:'boite', d:[.5, .05, .05], c:0x14171D, p:[-1.7, 2.7, 2.35] }, { f:'boite', d:[.08, .4, .28], c:0x14171D, p:[-1.95, 2.62, 2.35] },
      { f:'boite', d:[2.3, .25, .3], c:0x1E232B, p:[0, 3.47, 2.25] },                                                                      // la rampe de phares
      { f:'cyl', d:[.02, .02, 1.1, 4], c:0x14171D, p:[1.2, 3.9, -.1] },                                                                    // l'antenne
    ], .03));
    // les phares (allumés), les feux arrière, le gyrophare qui tourne
    const blanc = new T3.MeshBasicMaterial({ color:0xFFF3C4 });
    for(let n = 0; n < 5; n++){ const p = new T3.Mesh(new T3.BoxGeometry(.28, .16, .06), blanc); p.position.set(-.9 + n * .45, 3.47, 2.42); corps.add(p); }
    for(const s of [-1, 1]){ const p = new T3.Mesh(new T3.BoxGeometry(.45, .2, .06), blanc); p.position.set(s * .95, 1.75, 2.54); corps.add(p); }
    const rouge = new T3.MeshBasicMaterial({ color:0xE0322A });
    for(const s of [-1, 1]){ const p = new T3.Mesh(new T3.BoxGeometry(.35, .14, .06), rouge); p.position.set(s * 1.1, 2.05, -2.52); corps.add(p); }
    gyroMat = new T3.MeshBasicMaterial({ color:0xFFB020 });
    const gyro = new T3.Group(); gyro.position.set(-.55, 3.5, .1);
    gyro.add(new T3.Mesh(new T3.CylinderGeometry(.2, .22, .32, 12), new T3.MeshBasicMaterial({ color:0x7A4A08, transparent:true, opacity:.75 })));
    const miroir = new T3.Mesh(new T3.BoxGeometry(.34, .2, .06), gyroMat); gyro.add(miroir); corps.add(gyro);
    corps.scale.setScalar(k);
    gr.add(corps);
    // les crampons des chenilles : ils font le tour de la bande, à la vitesse de la chenille (chacune la sienne en virage)
    const NC = 30, crampons = new T3.InstancedMesh(new T3.BoxGeometry(1.14, .1, .17), toon({ color:ACIER }), 2 * NC);
    crampons.frustumCulled = false; corps.add(crampons);
    // le treuil : le tambour et le bras qui pivote vers l'ancrage
    const tambour = objet([{ f:'cyl', d:[.35, .35, 1.4, 12], c:GRIS, r:[0, 0, Math.PI / 2] }], .04);
    tambour.position.set(0, 2.55 * k, -1.6 * k); gr.add(tambour);
    const bras = new T3.Group(); bras.position.set(0, 2.6 * k, -1.6 * k);
    bras.add(objet([{ f:'boite', d:[.3, .25, 2.4 * k], c:0x5A606B, p:[0, .15, 1.2 * k] }, { f:'cyl', d:[.14, .14, .3, 8], c:JAUNE, p:[0, .15, 2.4 * k], r:[0, 0, Math.PI / 2] }], .04));
    gr.add(bras);
    // la lame, devant (largeur réelle) : bombée, avec ses nervures, ses ailes, ses bras et ses vérins
    const lame = new T3.Group();
    const aile = Math.min(.8, M.lame * .14), Lc = M.lame - 2 * aile, bl = M.av - 2.6 * k;
    lame.add(objet([
      { f:'boite', d:[Lc, .5, .18], c:0xB8C0CC, p:[0, .3, .02], r:[.1, 0, 0] }, { f:'boite', d:[Lc, .5, .18], c:0xAEB6C3, p:[0, .75, -.02], r:[-.25, 0, 0] },   // la face, bombée
      { f:'boite', d:[Lc, .12, .26], c:0x9AA3B0, p:[0, 1.04, -.1] },                                                                                           // le rebord du haut
      { f:'boite', d:[aile * 1.05, 1.15, .2], c:0xAEB6C3, p:[Lc / 2 + aile / 2, .58, .2], r:[-.15, -.45, 0] }, { f:'boite', d:[aile * 1.05, 1.15, .2], c:0xAEB6C3, p:[-Lc / 2 - aile / 2, .58, .2], r:[-.15, .45, 0] },
      { f:'boite', d:[Lc, .12, .22], c:JAUNE, p:[0, .06, .05] },                                                                                               // le couteau
      ...[-.35, -.12, .12, .35].map(u => ({ f:'boite', d:[.12, .95, .3], c:0x7E8794, p:[u * Lc, .55, -.2] })),                                                 // les nervures
      { f:'boite', d:[.25, .25, bl], c:GRIS, p:[1 * k, .55, -bl / 2] }, { f:'boite', d:[.25, .25, bl], c:GRIS, p:[-1 * k, .55, -bl / 2] },                       // les bras
      { f:'cyl', d:[.11, .11, bl * .7, 8], c:0x30353E, p:[.55 * k, 1.2, -bl * .55], r:[Math.PI / 2 - .35, 0, 0] }, { f:'cyl', d:[.06, .06, bl * .5, 6], c:0xD9DEE6, p:[.55 * k, 1.05, -bl * .2], r:[Math.PI / 2 - .35, 0, 0] },   // les vérins (corps et tige)
      { f:'cyl', d:[.11, .11, bl * .7, 8], c:0x30353E, p:[-.55 * k, 1.2, -bl * .55], r:[Math.PI / 2 - .35, 0, 0] }, { f:'cyl', d:[.06, .06, bl * .5, 6], c:0xD9DEE6, p:[-.55 * k, 1.05, -bl * .2], r:[Math.PI / 2 - .35, 0, 0] },
    ], .05));
    lame.position.z = M.av; gr.add(lame);
    const neigeMat = toon({ color:0xEEF4FC });
    const bourrelet = new T3.Group(); const bm = new T3.Mesh(new T3.SphereGeometry(1, 14, 10), neigeMat), bc = new T3.Mesh(new T3.SphereGeometry(1.06, 14, 10), CONTOUR);
    bourrelet.add(bm, bc); bourrelet.visible = false; gr.add(bourrelet);
    // la fraise, derrière (largeur réelle) : le capot arrondi, les flasques, le peigne en caoutchouc et ses dents
    const F = M.fraise, yf = 2.9 * k;
    const dents = []; for(let u = -F / 2 + .08; u < F / 2; u += .16) dents.push({ f:'boite', d:[.07, .16, .05], c:0x14171D, p:[u, .06, -1.72] });
    const fraise = objet([
      { f:'demi', d:[.55, .55, F, 14], c:0x4D5563, p:[0, .5, -.75], r:[0, 0, Math.PI / 2] },                                          // le capot
      { f:'boite', d:[.06, .9, 1.4], c:0x363C47, p:[F / 2, .45, -.75] }, { f:'boite', d:[.06, .9, 1.4], c:0x363C47, p:[-F / 2, .45, -.75] },   // les flasques
      { f:'boite', d:[F + .1, .85, .25], c:0x363C47, p:[0, .5, -.1] },
      { f:'boite', d:[F, .04, .7], c:0x23272E, p:[0, .2, -1.45], r:[.32, 0, 0] },                                                      // le peigne (finisseur)
      ...dents,
      { f:'boite', d:[F * .9, .08, .1], c:0xF2B233, p:[0, 1.06, -.75] },                                                               // la bande jaune
      { f:'boite', d:[k, .3, yf - 2.2 * k + .4], c:0x2B313C, p:[0, .9, (yf - 2.2 * k) / 2] },
    ], .05);
    fraise.position.z = -yf; gr.add(fraise);
    // les phares éclairent la piste devant, les projecteurs arrière la fraise
    phareAv = new T3.SpotLight(0xFFE7B5, 2.6, 75, .62, .55, 1); phareAv.position.set(0, 3.4 * k, 2.4 * k); gr.add(phareAv);
    const cibleAv = new T3.Object3D(); cibleAv.position.set(0, 0, 26); gr.add(cibleAv); phareAv.target = cibleAv;
    phareAr = new T3.SpotLight(0xFFF1D6, 1.6, 26, 1, .6, 1); phareAr.position.set(0, 3.4 * k, -1.8 * k); gr.add(phareAr);
    const cibleAr = new T3.Object3D(); cibleAr.position.set(0, 0, -9); gr.add(cibleAr); phareAr.target = cibleAr;
    return { gr, bras, lame, bourrelet, fraise, miroir, crampons, NC, chenilles:[0, 0], M, tilt:{ x:0, z:0 }, hauteur:0 };
  }
  // un crampon à la distance s le long de la chenille (le tour : dessus, l'avant arrondi, dessous, l'arrière arrondi)
  const CH = { L:4.6, R:.5, y:.52 }, TOUR = 2 * CH.L + 2 * Math.PI * CH.R;
  function surChenille(s){
    s = ((s % TOUR) + TOUR) % TOUR; const h = CH.L / 2;
    if(s < CH.L) return [-h + s, CH.y + CH.R, 0];                                               // dessus, vers l'avant
    s -= CH.L; if(s < Math.PI * CH.R){ const a = s / CH.R; return [h + Math.sin(a) * CH.R, CH.y + Math.cos(a) * CH.R, a]; }
    s -= Math.PI * CH.R; if(s < CH.L) return [h - s, CH.y - CH.R, Math.PI];                    // dessous, vers l'arrière
    s -= CH.L; const a = Math.PI + s / CH.R; return [-h + Math.sin(a) * CH.R, CH.y + Math.cos(a) * CH.R, a];
  }
  const _m4 = () => new T3.Matrix4(), _q = () => new T3.Quaternion();
  function majCrampons(d){
    const m = _m4(), q = _q(), e = new T3.Euler(), v = new T3.Vector3(), sc = new T3.Vector3(1, 1, 1);
    let i = 0;
    for(const [c, s] of [[0, -1], [1, 1]]) for(let n = 0; n < d.NC; n++){
      const [z, y, a] = surChenille(d.chenilles[c] + n * TOUR / d.NC);
      e.set(a, 0, 0); q.setFromEuler(e); v.set(s * 1.95, y, z); m.compose(v, q, sc); d.crampons.setMatrixAt(i++, m);
    }
    d.crampons.instanceMatrix.needsUpdate = true;
  }

  /* ---------- La neige qui vole : gerbe de la fraise, projections des chenilles, débord de la lame, flocons ---------- */
  let flocon = null;
  function texFlocon(){
    if(flocon) return flocon;
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.45, 'rgba(240,246,255,.85)'); g.addColorStop(1, 'rgba(240,246,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); flocon = new T3.CanvasTexture(c); return flocon;
  }
  function nuage(n, taille, couleur){
    const g = new T3.BufferGeometry(), pos = new Float32Array(n * 3).fill(-9999);
    g.setAttribute('position', new T3.BufferAttribute(pos, 3));
    const pts = new T3.Points(g, new T3.PointsMaterial({ map:texFlocon(), size:taille, color:couleur, transparent:true, depthWrite:false, sizeAttenuation:true }));
    pts.frustumCulled = false;
    return { pts, pos, v:new Float32Array(n * 3), vie:new Float32Array(n), n, i:0 };
  }
  function emettre(N, x, y, z, vx, vy, vz, vie){ const i = N.i; N.i = (N.i + 1) % N.n; N.pos.set([x, y, z], i * 3); N.v.set([vx, vy, vz], i * 3); N.vie[i] = vie; }
  function bouger(N, dt, g, frein){
    for(let i = 0; i < N.n; i++){
      if(N.vie[i] <= 0) continue;
      N.vie[i] -= dt; const j = i * 3;
      if(N.vie[i] <= 0){ N.pos[j + 1] = -9999; continue; }
      N.v[j + 1] -= g * dt; const f = Math.max(0, 1 - frein * dt); N.v[j] *= f; N.v[j + 2] *= f;
      N.pos[j] += N.v[j] * dt; N.pos[j + 1] += N.v[j + 1] * dt; N.pos[j + 2] += N.v[j + 2] * dt;
    }
    N.pts.geometry.attributes.position.needsUpdate = true;
  }
  let projections = null, chute = null;
  function neigeQuiVole(){
    projections = nuage(1400, .55, 0xF2F7FF); scene.add(projections.pts);
    // les flocons qui tombent autour de la caméra (on les voit surtout dans les phares)
    chute = nuage(700, .16, 0xFFFFFF); chute.pts.material.opacity = .85; scene.add(chute.pts);
    for(let i = 0; i < chute.n; i++){ chute.pos.set([(Math.random() - .5) * 60, Math.random() * 30, (Math.random() - .5) * 60], i * 3); chute.vie[i] = 1; }
  }
  /* ---------- Chaque image ---------- */
  let tTex = 0, tRel = 0;
  const _v = () => new T3.Vector3();
  function rendu(P, dt, o){
    if(!ok || !scene || !T) return;
    const t = performance.now() / 1000, M = P.M, k = M.k;
    // la neige : le relief près de la dameuse, l'image un peu moins souvent
    tRel -= dt; if(tRel <= 0){ tRel = .12; if(P.lame || P.vidage > 0 || o.forceRelief) majRelief(P.x + Math.sin(P.a) * M.av, P.y - Math.cos(P.a) * M.av, M.lame / 2 + 8); }
    tTex -= dt; if(tTex <= 0){ tTex = (P.fraise || P.lame || o.radar) ? .3 : .8; peindreTexture(o, P); }
    // la dameuse posée sur la neige, penchée comme la pente
    const ux = Math.sin(P.a), uy = -Math.cos(P.a), L = 2.6 * k, Lg = 1.9 * k;
    const hf = hauteur(P.x + ux * L, P.y + uy * L), hb = hauteur(P.x - ux * L, P.y - uy * L);
    const hl = hauteur(P.x - Math.cos(P.a) * Lg, P.y - Math.sin(P.a) * Lg), hr = hauteur(P.x + Math.cos(P.a) * Lg, P.y + Math.sin(P.a) * Lg);
    const pitch = Math.atan2(hf - hb, 2 * L), roll = Math.atan2(hl - hr, 2 * Lg), s = Math.min(1, dt * 8);
    dam.tilt.x += (-pitch - dam.tilt.x) * s; dam.tilt.z += (roll - dam.tilt.z) * s;
    dam.hauteur += ((hf + hb + hl + hr) / 4 - dam.hauteur) * (dam.init ? 1 : Math.min(1, dt * 12)); dam.init = false;
    dam.gr.position.set(P.x, dam.hauteur - .05 + (P.secousse > 0 ? (Math.random() - .5) * .3 * P.secousse : 0), P.y);
    dam.gr.rotation.set(dam.tilt.x, Math.PI - P.a, dam.tilt.z, 'YXZ');
    // les outils : la lame baissée ou levée, le bourrelet de neige, la fraise et sa gerbe, le bras du treuil
    const basse = P.lame || P.vidage > 0;
    dam.lame.position.y += ((P.lame ? 0 : P.vidage > 0 ? .4 : .9) - dam.lame.position.y) * Math.min(1, dt * 5);
    const f = Math.min(1, P.charge / M.cap);
    dam.bourrelet.visible = P.charge > 20 && basse;
    if(dam.bourrelet.visible){ const larg = M.lame / 2 * Math.min(1, .5 + f * .8), prof = .5 + 1.6 * f; dam.bourrelet.scale.set(larg, .35 + .9 * f, prof); dam.bourrelet.position.set(0, dam.lame.position.y + .1, M.av + .3 + prof * .7); }
    dam.fraise.position.y += ((P.fraise ? 0 : .55) - dam.fraise.position.y) * Math.min(1, dt * 5);
    // les chenilles : chacune avance à sa vitesse (en virage, l'extérieure va plus vite)
    const da = dam.aPrec == null ? 0 : ((P.a - dam.aPrec + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; dam.aPrec = P.a;
    const w = dt > 0 ? da / dt : 0;
    dam.chenilles[0] += (P.v - w * 1.95 * k) * dt / k; dam.chenilles[1] += (P.v + w * 1.95 * k) * dt / k;
    majCrampons(dam);
    // la neige qui vole : en repère du monde
    const loc = (x, y, z) => new T3.Vector3(x, y, z).applyMatrix4(dam.gr.matrixWorld);
    dam.gr.updateMatrixWorld();
    const fx = Math.sin(P.a), fz = -Math.cos(P.a), vit = Math.abs(P.v);
    if(P.fraise && vit > .25){                                             // la gerbe de la fraise, vers l'arrière et vers le haut
      const n = Math.min(30, Math.ceil(dt * (160 + vit * 50)));
      for(let i = 0; i < n; i++){ const p = loc((Math.random() - .5) * M.fraise, .35 + dam.fraise.position.y, -2.9 * k - 1.2 - Math.random() * .5), up = 2.5 + Math.random() * 3.5, ar = 1.5 + Math.random() * 3;
        emettre(projections, p.x, p.y, p.z, -fx * ar + (Math.random() - .5) * 1.5, up, -fz * ar + (Math.random() - .5) * 1.5, .7 + Math.random() * .6); }
    }
    if(vit > 1.2){                                                         // les chenilles soulèvent la neige derrière elles
      const n = Math.min(6, Math.ceil(dt * vit * 8)), sens = Math.sign(P.v);
      for(let i = 0; i < n; i++) for(const sx of [-1.95, 1.95]){ const p = loc(sx * k + (Math.random() - .5) * k, .15, -sens * 2.7 * k);
        emettre(projections, p.x, p.y, p.z, -fx * sens * vit * .25 + (Math.random() - .5), .8 + Math.random() * 1.5, -fz * sens * vit * .25 + (Math.random() - .5), .4 + Math.random() * .3); }
    }
    if(dam.bourrelet.visible && vit > .5){                                // la neige déborde aux bouts de la lame
      const n = Math.min(6, Math.ceil(dt * 30));
      for(let i = 0; i < n; i++){ const sx = Math.random() < .5 ? -1 : 1, p = loc(sx * M.lame / 2, .6 + Math.random() * .6, M.av + .4), lx = Math.cos(P.a) * sx, lz = Math.sin(P.a) * sx;
        emettre(projections, p.x, p.y, p.z, -lx * (1 + Math.random()) + fx * vit * .5, .6 + Math.random(), -lz * (1 + Math.random()) + fz * vit * .5, .5 + Math.random() * .4); }
    }
    bouger(projections, dt, 7, 1.2);
    // les flocons qui tombent : un cube de neige autour de la caméra, qui se recopie quand on avance
    for(let i = 0; i < chute.n; i++){
      const j = i * 3; chute.pos[j + 1] -= (1.1 + (i % 7) * .08) * dt; chute.pos[j] += Math.sin(t * .8 + i) * .3 * dt;
      const ox = chute.pos[j] - camCtl.x, oz = chute.pos[j + 2] - camCtl.z;
      if(ox > 30) chute.pos[j] -= 60; else if(ox < -30) chute.pos[j] += 60;
      if(oz > 30) chute.pos[j + 2] -= 60; else if(oz < -30) chute.pos[j + 2] += 60;
      if(chute.pos[j + 1] < camCtl.y - 18) chute.pos[j + 1] += 30;
    }
    chute.pts.geometry.attributes.position.needsUpdate = true;
    dam.bras.rotation.y = -o.angleTreuil(P);
    // le câble du treuil
    if(P.treuil){
      const b = o.boutTreuil(P), pts = cable.geometry.attributes.position.array;
      pts[0] = P.treuil.x; pts[1] = hauteur(P.treuil.x, P.treuil.y) + 1.65; pts[2] = P.treuil.y;
      pts[3] = b[0]; pts[4] = dam.hauteur + 2.75 * k; pts[5] = b[1];
      cable.geometry.attributes.position.needsUpdate = true; cable.geometry.computeBoundingSphere(); cable.visible = true;
    } else cable.visible = false;
    // les lumières qui clignotent
    dam.miroir.parent.rotation.y = t * 7;                                  // le gyrophare tourne
    gyroMat.color.setHex(Math.cos(t * 7) > -.3 ? 0xFFB020 : 0xA66A10);
    for(const l of lampes) l.m.color.setHex(Math.sin(t * 3 + l.ph) > 0 ? 0x7CFFB2 : 0x1F5A3E);
    // la caméra : derrière la dameuse, tournée et levée à la demande
    let d = (Math.PI - P.a) - camCtl.cap; while(d > Math.PI) d -= 2 * Math.PI; while(d < -Math.PI) d += 2 * Math.PI;
    camCtl.cap += camCtl.init ? d : d * Math.min(1, dt * 2.2);
    camCtl.yaw += (o.cam.dx || 0) * dt * 1.6; camCtl.pitch = clamp(camCtl.pitch + (o.cam.dy || 0) * dt * .9, .08, 1.35);
    const az = camCtl.cap + Math.PI + camCtl.yaw, dist = camCtl.dist * (.95 + .35 * camCtl.pitch);
    // (le garage juste derrière devient transparent, plus bas)
    const dd = dist;
    const cx = P.x + Math.sin(az) * Math.cos(camCtl.pitch) * dd, cz = P.y + Math.cos(az) * Math.cos(camCtl.pitch) * dd;
    let cy = dam.hauteur + 2 + Math.sin(camCtl.pitch) * dist;
    cy = Math.max(cy, hauteur(cx, cz) + 1.8);
    if(camCtl.init){ camCtl.x = cx; camCtl.y = cy; camCtl.z = cz; camCtl.init = false; }
    const sc = Math.min(1, dt * 6); camCtl.x += (cx - camCtl.x) * sc; camCtl.y += (cy - camCtl.y) * sc; camCtl.z += (cz - camCtl.z) * sc;
    camCtl.y = Math.max(camCtl.y, hauteur(camCtl.x, camCtl.z) + 1.2);
    const dedans = toitGarage(camCtl.x, camCtl.z) > -1e8 ? .22 : 1;
    for(const m of garageMats){ m.opacity += (dedans - m.opacity) * Math.min(1, dt * 8); m.transparent = m.opacity < .99; m.depthWrite = !m.transparent; }
    cam.position.set(camCtl.x, camCtl.y, camCtl.z);
    cam.lookAt(P.x + ux * 3, dam.hauteur + 1.6, P.y + uy * 3);
    R.render(scene, cam);
  }
  // la caméra ne rentre pas dans le garage : au-dessus de lui, elle passe par-dessus le toit
  function toitGarage(x, z){
    const ga = T.garage, m = 2.5;
    if(x < ga.x - m || x > ga.x + ga.w + m || z < ga.y - m || z > ga.y + ga.h + m) return -1e9;
    return hauteur(ga.x + ga.w / 2, ga.y + ga.h / 2) + 8.5;
  }
  // un point du monde (x, y de la vue du dessus, hauteur au-dessus de la neige) sur l'écran
  function ecran(x, y, dh, w, h){
    if(!ok || !T) return null;
    const v = new T3.Vector3(x, hauteur(x, y) + dh, y).project(cam);
    if(v.z > 1) return null;
    return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
  }
  function recentrer(){ camCtl.yaw = 0; camCtl.pitch = .42; }
  function zoom(f){ camCtl.dist = clamp(camCtl.dist * f, 8, 40); }

  return { init, taille, nouvellePiste, rendu, ecran, recentrer, zoom, majRelief, get ok(){ return ok; }, camCtl };
})();
