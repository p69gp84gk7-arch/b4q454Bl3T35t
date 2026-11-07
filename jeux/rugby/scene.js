/* Le Buteur : la scène 3D (Three.js), en style « dessin animé » comme les autres jeux 3D (ombrage en tons, contours foncés).
   Repère : les poteaux sont en (0, 0, 0), la ligne d'essai est z = 0, le terrain s'étend vers +z (jusqu'à 100 m), x en travers
   (de -35 à 35 m), y vers le haut. Le jeu (rugby/jeu.js) calcule le vol du ballon ; la scène le dessine. */
window.RUGBY_3D = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let T3 = null, R = null, scene = null, cam = null, ok = false, DEGRADE = null, CONTOUR = null, MAT = null, L = 1, H = 1, temps = 0;
  let ballon = null, tee = null, axe = null, axeRef = null, cible = null, drapeaux = [], public_ = null;
  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));
  function geom(f, d, e = 0){
    switch(f){
      case 'boite': return new T3.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 10);
      case 'cone': return new T3.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 8);
      case 'boule': return new T3.IcosahedronGeometry(d[0] + e, d[1] ?? 1);
    }
  }
  function fusion(pieces, e = 0){
    const pos = [], nor = [], col = [], c = new T3.Color();
    for(const p of pieces){
      let g = geom(p.f, p.d, e); g = g.index ? g.toNonIndexed() : g;
      const q = new T3.Quaternion().setFromEuler(new T3.Euler(...(p.r || [0, 0, 0]), 'YXZ'));
      g.applyMatrix4(new T3.Matrix4().compose(new T3.Vector3(...(p.p || [0, 0, 0])), q, new T3.Vector3(...(p.s || [1, 1, 1]))));
      const a = g.attributes.position.array, n = g.attributes.normal.array; c.set(p.c ?? 0xffffff);
      for(let i = 0; i < a.length; i += 3){ pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
      g.dispose();
    }
    const out = new T3.BufferGeometry();
    out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    return out;
  }
  function objet(pieces, e = .04, contour = true){
    const gr = new T3.Group(); gr.add(new T3.Mesh(fusion(pieces), MAT));
    if(contour) gr.add(new T3.Mesh(fusion(pieces, e), CONTOUR));
    return gr;
  }

  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      const d = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
      DEGRADE = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T3.NearestFilter; DEGRADE.needsUpdate = true;
      CONTOUR = new T3.MeshBasicMaterial({ color:0x1B2A40, side:T3.BackSide });
      MAT = toon({ vertexColors:true });
      cam = new T3.PerspectiveCamera(55, 1, .1, 2500);
      construire();
      ok = true;
    }catch(e){ console.error(e); ok = false; }
    return ok;
  }
  function taille(w, h){ if(!ok) return; L = w; H = h; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 64 : 50; cam.updateProjectionMatrix(); }

  /* ---------- Le stade ---------- */
  function construire(){
    scene = new T3.Scene();
    scene.background = new T3.Color(0x8FCBF3);
    scene.fog = new T3.Fog(0xCFE6F7, 160, 1100);
    scene.add(new T3.HemisphereLight(0xF2F8FF, 0x5E7A4A, .75));
    const soleil = new T3.DirectionalLight(0xFFF4DE, .72); soleil.position.set(-.5, 1, .4); scene.add(soleil);
    // la pelouse : des bandes tondues, l'en-but plus clair
    const c = document.createElement('canvas'); c.width = 512; c.height = 1024; const x = c.getContext('2d'), S = 512 / 90, Z = (z => (z + 20) * 1024 / 140);
    for(let z = -20; z < 120; z += 5){ x.fillStyle = (Math.floor(z / 5) % 2) ? '#5DAA45' : '#54A03E'; x.fillRect(0, Z(z), 512, Z(z + 5) - Z(z) + 1); }
    x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, Z(-10), 512, Z(0) - Z(-10));
    // les lignes
    const X = xx => (xx + 45) * S;
    x.strokeStyle = '#FFFFFF'; x.lineWidth = 3;
    const ligne = (x1, z1, x2, z2, pointille) => { x.setLineDash(pointille ? [10, 10] : []); x.beginPath(); x.moveTo(X(x1), Z(z1)); x.lineTo(X(x2), Z(z2)); x.stroke(); };
    ligne(-35, -10, 35, -10); ligne(-35, 0, 35, 0); ligne(-35, 22, 35, 22); ligne(-35, 50, 35, 50);
    ligne(-35, 5, 35, 5, true); ligne(-35, 40, 35, 40, true); ligne(-35, 60, 35, 60, true);
    ligne(-35, -10, -35, 115); ligne(35, -10, 35, 115); ligne(-30, 0, -30, 100, true); ligne(30, 0, 30, 100, true); ligne(-20, 0, -20, 100, true); ligne(20, 0, 20, 100, true);
    x.setLineDash([]);
    const tex = new T3.CanvasTexture(c); tex.anisotropy = 8;
    const sol = new T3.Mesh(new T3.PlaneGeometry(90, 140), new T3.MeshToonMaterial({ map:tex, gradientMap:DEGRADE }));
    sol.rotation.x = -Math.PI / 2; sol.position.set(0, 0, 50); scene.add(sol);
    const autour = new T3.Mesh(new T3.PlaneGeometry(1600, 1600), new T3.MeshToonMaterial({ color:0x4F8F3C, gradientMap:DEGRADE })); autour.rotation.x = -Math.PI / 2; autour.position.y = -.05; scene.add(autour);
    // les poteaux en H, avec leurs protections
    scene.add(objet([
      { f:'cyl', d:[.09, .09, 14, 10], c:0xFFFFFF, p:[-2.8, 7, 0] }, { f:'cyl', d:[.09, .09, 14, 10], c:0xFFFFFF, p:[2.8, 7, 0] },
      { f:'cyl', d:[.11, .11, 5.6, 10], c:0xFFFFFF, p:[0, 3, 0], r:[0, 0, Math.PI / 2] },
      { f:'cyl', d:[.36, .36, 2.1, 12], c:0x1F5FAE, p:[-2.8, 1.05, 0] }, { f:'cyl', d:[.36, .36, 2.1, 12], c:0x1F5FAE, p:[2.8, 1.05, 0] },
      { f:'cyl', d:[.37, .37, .35, 12], c:0xE23B3B, p:[-2.8, 1.5, 0] }, { f:'cyl', d:[.37, .37, .35, 12], c:0xE23B3B, p:[2.8, 1.5, 0] },
    ], .03));
    for(const s of [-1, 1]) drapeau(s * 2.8, 14, 0, s < 0 ? 0xFFC93C : 0xE23B3B);
    // les tribunes (derrière l'en-but et sur les côtés), le public
    const tribunes = [], places = [], R0 = alea(5);
    const tribune = (cx, cz, lg, ry) => {
      for(let k = 0; k < 6; k++) tribunes.push({ f:'boite', d:[lg, .8, 1.6], c:k % 2 ? 0x5A6475 : 0x667183, p:[cx + Math.sin(ry) * k * 1.6, .4 + k * .8, cz + Math.cos(ry) * k * 1.6], r:[0, ry, 0] });
      tribunes.push({ f:'boite', d:[lg + 1, 1.2, 1], c:0xD8DDE5, p:[cx + Math.sin(ry) * 9.5, 5.6, cz + Math.cos(ry) * 9.5], r:[0, ry, 0] });
      for(let k = 0; k < 6; k++) for(let i = 0; i < lg / .8; i++) if(R0() < .82){
        const u = -lg / 2 + .4 + i * .8, px = cx + Math.cos(ry) * u + Math.sin(ry) * k * 1.6, pz = cz - Math.sin(ry) * u + Math.cos(ry) * k * 1.6;
        places.push([px, 1.15 + k * .8, pz]);
      }
    };
    tribune(0, -24, 70, Math.PI); tribune(-48, 50, 80, -Math.PI / 2); tribune(48, 50, 80, Math.PI / 2);
    scene.add(objet(tribunes, .05));
    // le public : des têtes et des maillots de toutes les couleurs (qui bougent un peu)
    const gp = new T3.IcosahedronGeometry(.32, 0), mp = toon({ color:0xFFFFFF });
    public_ = new T3.InstancedMesh(gp, mp, places.length);
    const m = new T3.Matrix4(), cc = new T3.Color(), COUL = [0xE23B3B, 0x1F5FAE, 0xFFC93C, 0xFFFFFF, 0x2E9E5B, 0x13233A, 0xFF6A2B];
    places.forEach((p, i) => { m.makeTranslation(...p); public_.setMatrixAt(i, m); public_.setColorAt(i, cc.set(COUL[Math.floor(R0() * COUL.length)])); });
    public_.userData.places = places; scene.add(public_);
    // les montagnes au loin
    for(let k = 0; k < 18; k++){
      const a = k / 18 * Math.PI * 2 + R0() * .2, D = 750 + R0() * 250, Hm = 200 + R0() * 260, Rr = 170 + R0() * 120;
      const mo = new T3.Mesh(new T3.ConeGeometry(Rr, Hm, 7), new T3.MeshBasicMaterial({ color:k % 2 ? 0x9DB9DD : 0xAEC6E6, fog:false }));
      mo.position.set(Math.sin(a) * D, Hm / 2 - 40, 50 + Math.cos(a) * D); scene.add(mo);
      const ca = new T3.Mesh(new T3.ConeGeometry(Rr * .36, Hm * .36, 7), new T3.MeshBasicMaterial({ color:0xF5F8FC, fog:false }));
      ca.position.set(mo.position.x, Hm * .82 - 40 + 1, mo.position.z); scene.add(ca);
    }
    // le ballon ovale (30 cm de long, 19 de large), debout sur son tee ; son grand axe est l'axe y du ballon
    ballon = new T3.Group();
    ballon.add(new T3.Mesh(ovale(0), MAT), new T3.Mesh(ovale(.009), CONTOUR));
    scene.add(ballon);
    tee = objet([{ f:'cone', d:[.09, .12, 10], c:0xFF6A2B, p:[0, .06, 0] }], .01); scene.add(tee);
    // l'axe de frappe (pointillés blancs, tournés par le joueur) et l'axe des poteaux (trait jaune fin, fixe)
    const ga = new T3.PlaneGeometry(.12, 1); ga.translate(0, .5, 0); ga.rotateX(-Math.PI / 2);
    axe = new T3.Group();
    for(let k = 0; k < 14; k++){ const s = new T3.Mesh(ga, new T3.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.85 - k * .05, depthWrite:false })); s.position.z = -(.45 + k * 1.4); s.position.y = .025; axe.add(s); }
    scene.add(axe);
    const gr = new T3.PlaneGeometry(.05, 1); gr.translate(0, .5, 0); gr.rotateX(-Math.PI / 2);
    axeRef = new T3.Mesh(gr, new T3.MeshBasicMaterial({ color:0xFFD94A, transparent:true, opacity:.7, depthWrite:false })); axeRef.position.y = .02;
    scene.add(axeRef);
    // la cible de « Plein centre » : trois bandes entre les poteaux, au-dessus de la barre (10 points au milieu)
    cible = new T3.Group();
    for(const [x1, x2, coul, op] of [[-.6, .6, 0xFFC93C, .5], [.6, 1.6, 0xFF8A3C, .32], [-1.6, -.6, 0xFF8A3C, .32], [1.6, 2.7, 0xFFFFFF, .2], [-2.7, -1.6, 0xFFFFFF, .2]]){
      const m = new T3.Mesh(new T3.PlaneGeometry(x2 - x1, 7), new T3.MeshBasicMaterial({ color:coul, transparent:true, opacity:op, depthWrite:false, side:T3.DoubleSide }));
      m.position.set((x1 + x2) / 2, 3.15 + 3.5, 0); cible.add(m);
    }
    cible.visible = false; scene.add(cible);
  }
  // le ballon : un tour au profil ovale un peu pointu (r = R·(1 − u²)^0,72), quatre panneaux avec leurs coutures, deux bandes rouges, un logo
  function ovale(e){
    const pts = [], N = 26, Lo = .15 + e, Ra = .095 + e;
    for(let i = 0; i <= N; i++){ const u = -1 + 2 * i / N; pts.push(new T3.Vector2(Math.max(.002, Ra * Math.pow(Math.max(0, 1 - u * u), .72)), u * Lo)); }
    const g = new T3.LatheGeometry(pts, 48).toNonIndexed(); g.computeVertexNormals();
    const a = g.attributes.position.array, col = [], c = new T3.Color(), DEC = Math.PI / 48;   // coutures au milieu d'une colonne
    for(let i = 0; i < a.length; i += 9){
      // le milieu de la case (anneau et colonne), pour que les bandes et les coutures soient bien droites
      const ys = [a[i + 1], a[i + 4], a[i + 7]], an = [0, 3, 6].map(k => Math.atan2(a[i + k + 2], a[i + k]));
      const dif = an.map(v => { let d = v - an[0]; while(d > Math.PI) d -= 2 * Math.PI; while(d < -Math.PI) d += 2 * Math.PI; return d; });
      const y = (Math.min(...ys) + Math.max(...ys)) / 2, ang = an[0] + (Math.min(...dif) + Math.max(...dif)) / 2, u = Math.abs(y) / Lo;
      const couture = Math.abs(Math.sin(2 * (ang - DEC))) < .06 && u < .93, logo = Math.abs(y) < .04 && Math.abs(Math.sin((ang - 1.2) / 2)) < .16;
      c.set(couture ? 0xA9A28F : (u > .5 && u < .64) || u > .88 ? 0xE23B3B : logo ? 0x1F5FAE : 0xF7F5EE);
      for(let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    return g;
  }
  // un drapeau en haut d'un poteau, qui flotte dans le sens du vent
  function drapeau(x, y, z, coul){
    const g = new T3.PlaneGeometry(1, .6, 8, 1); g.translate(.5, 0, 0);
    const m = new T3.Mesh(g, new T3.MeshToonMaterial({ color:coul, gradientMap:DEGRADE, side:T3.DoubleSide }));
    m.position.set(x, y - .35, z); scene.add(m); drapeaux.push({ m, base:g.attributes.position.array.slice() });
  }
  // placer le ballon sur son tee, penché vers l'avant dans l'axe de frappe a (0 = vers les poteaux, en -z) ;
  // aRef : l'axe des poteaux (le trait jaune va du ballon jusqu'à la ligne des poteaux)
  const PENCHE = -.42;
  function placer(x, z, a, aRef = a){
    ballon.position.set(x, .27, z); ballon.rotation.set(PENCHE, -a, 0, 'YXZ');
    tee.position.set(x, 0, z); tee.visible = true;
    majAxe(x, z, a, aRef);
  }
  function majAxe(x, z, a, aRef = a){
    axe.position.set(x, 0, z); axe.rotation.y = -a;
    axeRef.position.set(x, .02, z); axeRef.rotation.y = -aRef; axeRef.scale.z = Math.hypot(x, z);
  }
  function montrerAxe(v){ axe.visible = axeRef.visible = v; }
  function montrerCible(v){ cible.visible = v; }
  // le ballon en vol : il tourne par-dessus lui-même (tourne) dans l'axe a
  function majBallon(p, a, tourne){ ballon.position.set(...p); ballon.rotation.set(PENCHE - tourne, -a, 0, 'YXZ'); }
  function cacherTee(){ tee.visible = false; }
  function regarder(p, cible, fov){ cam.position.set(...p); if(fov) cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(...cible); }
  function rendu(dt, vent, joie = 0){
    if(!ok) return;
    temps += dt;
    // les drapeaux flottent dans le sens du vent (vx, vz)
    const f = clamp(Math.hypot(vent[0], vent[1]) / 9, .08, 1), ang = Math.atan2(-vent[1], vent[0]);
    for(const d of drapeaux){
      const a = d.m.geometry.attributes.position.array; d.m.rotation.y = ang;
      for(let i = 0; i < a.length; i += 3){ const u = d.base[i]; a[i] = d.base[i] * (.35 + .65 * f); a[i + 1] = d.base[i + 1] - (1 - f) * u * .45; a[i + 2] = Math.sin(temps * (4 + 7 * f) - u * 6) * .08 * u * (.4 + f); }
      d.m.geometry.attributes.position.needsUpdate = true;
    }
    // le public saute quand le coup est réussi
    if(public_ && (joie > 0 || public_.userData.saute)){
      const m = new T3.Matrix4(), P = public_.userData.places;
      for(let i = 0; i < P.length; i++){ const s = joie > 0 ? Math.abs(Math.sin(temps * 9 + i * 1.7)) * .35 * joie : 0; m.makeTranslation(P[i][0], P[i][1] + s, P[i][2]); public_.setMatrixAt(i, m); }
      public_.instanceMatrix.needsUpdate = true; public_.userData.saute = joie > 0;
    }
    R.render(scene, cam);
  }
  function ecran(x, y, z){
    const v = new T3.Vector3(x, y, z).project(cam); if(v.z > 1) return null;
    return [(v.x + 1) / 2 * L, (1 - v.y) / 2 * H];
  }
  return { init, taille, placer, majAxe, montrerAxe, montrerCible, majBallon, cacherTee, regarder, rendu, ecran, get ok(){ return ok; } };
})();
