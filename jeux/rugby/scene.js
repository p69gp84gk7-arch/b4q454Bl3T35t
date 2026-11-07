/* Le Buteur : la scène 3D (Three.js), en style « dessin animé » comme les autres jeux 3D (ombrage en tons, contours foncés).
   Repère : les poteaux sont en (0, 0, 0), la ligne d'essai est z = 0, le terrain s'étend vers +z (jusqu'à 100 m), x en travers
   (de -35 à 35 m), y vers le haut. Le jeu (rugby/jeu.js) calcule le vol du ballon ; la scène le dessine. */
window.RUGBY_3D = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let T3 = null, R = null, scene = null, cam = null, ok = false, DEGRADE = null, CONTOUR = null, MAT = null, L = 1, H = 1, temps = 0;
  let ballon = null, tee = null, axe = null, joueur = null, drapeaux = [], public_ = null;
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
      { f:'cyl', d:[.07, .07, 5.6, 10], c:0xFFFFFF, p:[0, 3, 0], r:[0, 0, Math.PI / 2] },
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
    // le ballon (ovale, avec ses bandes), le tee, la ligne de l'axe
    ballon = objet([
      { f:'boule', d:[1, 2], c:0xF7F5EE, s:[.1, .1, .15] },
      { f:'cyl', d:[.101, .101, .02, 16], c:0xE23B3B, r:[Math.PI / 2, 0, 0], p:[0, 0, .07], s:[1, 1, 1] }, { f:'cyl', d:[.101, .101, .02, 16], c:0xE23B3B, r:[Math.PI / 2, 0, 0], p:[0, 0, -.07] },
      { f:'boite', d:[.02, .005, .08], c:0x1B2A40, p:[0, .1, 0] },
    ], .008);
    scene.add(ballon);
    tee = objet([{ f:'cone', d:[.09, .12, 10], c:0xFF6A2B, p:[0, .06, 0] }], .01); scene.add(tee);
    const ga = new T3.PlaneGeometry(.12, 1); ga.translate(0, .5, 0); ga.rotateX(-Math.PI / 2);
    axe = new T3.Group();
    for(let k = 0; k < 12; k++){ const s = new T3.Mesh(ga, new T3.MeshBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:.75 - k * .05, depthWrite:false })); s.position.z = -(1.2 + k * 1.6); s.position.y = .02; axe.add(s); }
    scene.add(axe);
    joueur = buteur(); scene.add(joueur.gr);
  }
  // un drapeau en haut d'un poteau, qui flotte dans le sens du vent
  function drapeau(x, y, z, coul){
    const g = new T3.PlaneGeometry(1, .6, 8, 1); g.translate(.5, 0, 0);
    const m = new T3.Mesh(g, new T3.MeshToonMaterial({ color:coul, gradientMap:DEGRADE, side:T3.DoubleSide }));
    m.position.set(x, y - .35, z); scene.add(m); drapeaux.push({ m, base:g.attributes.position.array.slice() });
  }
  // le buteur : maillot, short, chaussettes, tête ; il prend son élan puis frappe
  function buteur(){
    const gr = new T3.Group(), corps = objet([
      { f:'boite', d:[.46, .55, .26], c:0xE23B3B, p:[0, 1.32, 0] }, { f:'boite', d:[.46, .12, .27], c:0xFFFFFF, p:[0, 1.5, 0] },
      { f:'boite', d:[.44, .26, .27], c:0x13233A, p:[0, .95, 0] },
      { f:'boule', d:[.15, 1], c:0xE8B48A, p:[0, 1.78, 0] }, { f:'boule', d:[.155, 1], c:0x4A3222, p:[0, 1.83, -.02], s:[1, .55, 1] },
      { f:'cyl', d:[.06, .05, .6, 6], c:0xE23B3B, p:[-.3, 1.28, 0], r:[0, 0, .25] }, { f:'cyl', d:[.06, .05, .6, 6], c:0xE23B3B, p:[.3, 1.28, 0], r:[0, 0, -.25] },
    ], .02);
    gr.add(corps);
    const jambe = () => { const j = new T3.Group(); j.add(objet([{ f:'cyl', d:[.075, .06, .5, 6], c:0xE8B48A, p:[0, -.25, 0] }, { f:'cyl', d:[.07, .07, .32, 6], c:0x1F5FAE, p:[0, -.6, 0] }, { f:'boite', d:[.11, .08, .26], c:0x1B1B1B, p:[0, -.8, -.06] }], .015)); j.position.y = .84; return j; };
    const jg = jambe(), jd = jambe(); jg.position.x = -.12; jd.position.x = .12; gr.add(jg, jd);
    return { gr, jg, jd };
  }
  // placer le ballon et le buteur (en retrait, de biais) ; l'axe part du ballon dans la direction a (0 = vers les poteaux, en -z)
  function placer(x, z, a){
    ballon.position.set(x, .26, z); ballon.rotation.set(-.25, a, 0, 'YXZ');
    tee.position.set(x, 0, z); tee.visible = true;
    axe.position.set(x, 0, z); axe.rotation.y = -a; axe.visible = true;
    elan(0, x, z, a);
  }
  // l'élan : u de 0 (en retrait) à 1 (au ballon) ; jambe qui frappe
  function elan(u, x, z, a, frappe = 0){
    const dx = Math.sin(a), dz = -Math.cos(a), px = -dz, pz = dx;          // devant, et sur le côté
    const recul = 2.2 * (1 - u), cote = -1.25 * (1 - u) - .35;
    joueur.gr.position.set(x - dx * (recul + .5) + px * cote, 0, z - dz * (recul + .5) + pz * cote);
    joueur.gr.rotation.y = Math.atan2(-dx, -dz) + (1 - u) * -.5;
    const course = Math.sin(u * 14) * .6 * (u < .95 ? 1 : 0);
    joueur.jg.rotation.x = course; joueur.jd.rotation.x = -course - frappe * 1.6;
    joueur.gr.position.y = Math.abs(Math.sin(u * 14)) * .06;
  }
  function majAxe(x, z, a){ axe.position.set(x, 0, z); axe.rotation.y = -a; }
  function montrerAxe(v){ axe.visible = v; }
  function majBallon(p, rot){ ballon.position.set(...p); ballon.rotation.set(rot[0], rot[1], rot[2], 'YXZ'); }
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
  return { init, taille, placer, elan, majAxe, montrerAxe, majBallon, cacherTee, regarder, rendu, ecran, get ok(){ return ok; } };
})();
