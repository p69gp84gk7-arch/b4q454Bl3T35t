/* Rock Altitude : le manche en 3D (Three.js), style dessin animé (ombrage en tons, contours noirs).
   Le manche file vers le joueur : les notes partent du fond (z négatif) et arrivent sur la ligne des boutons (z = 0)
   au moment où il faut les jouer. Derrière, la scène : les montagnes, les projecteurs, le ciel. */
window.ROCK_MANCHE = (() => {
  'use strict';
  let T3 = null, R = null, scene = null, cam = null, ok = false;
  let DEG = null, CONT = null, L = 4, LONG = 30, VIT = 15, voies = [], frettes = [], pool = [], queues = [], etincelles = [], rails = [], spots = [];
  const COUL3 = [0x2ECC40, 0xFF4136, 0xFFDC00], COUL4 = [0x2ECC40, 0xFF4136, 0xFFDC00, 0x2F86E8];
  let COUL = COUL4, LARG = 1.05;
  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEG }, o));
  const xVoie = v => (v - (L - 1) / 2) * LARG;

  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      const d = new Uint8Array([80, 80, 80, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
      DEG = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEG.minFilter = DEG.magFilter = T3.NearestFilter; DEG.needsUpdate = true;
      CONT = new T3.MeshBasicMaterial({ color:0x05060A, side:T3.BackSide });
      cam = new T3.PerspectiveCamera(55, 1, .1, 400);
      ok = true;
    }catch(e){ ok = false; }
    return ok;
  }
  // reserve : la hauteur (px) des boutons en bas ; l'image du manche remonte d'autant
  function taille(w, h, reserve = 0){
    if(!ok) return; R.setSize(w, h, false); cam.aspect = w / h;
    // en portrait, la caméra recule pour voir tout le manche ; en paysage, elle se rapproche
    // la caméra recule juste assez pour que toute la largeur du manche tienne dans l'écran
    const portrait = w < h; cam.fov = portrait ? 60 : 50;
    const demi = (L * LARG) / 2 + .55, hf = 2 * Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect);
    const d = Math.max(portrait ? 5.5 : 4.6, demi / Math.tan(hf / 2) * 1.05);
    cam.position.set(0, d * (portrait ? .62 : .55), d * (portrait ? .78 : .82)); cam.lookAt(0, 0, -d * (portrait ? 1.25 : 1.5));
    if(reserve > 0) cam.setViewOffset(w, h, 0, reserve, w, h); else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }
  // où est la ligne des boutons sur l'écran (pour placer les boutons tactiles juste dessous)
  function ecranVoies(w, h){
    if(!ok) return null;
    return voies.map((_, v) => { const p = new T3.Vector3(xVoie(v), 0, 0).project(cam); return [(p.x + 1) / 2 * w, (1 - p.y) / 2 * h]; });
  }

  /* ---------- La scène ---------- */
  function preparer(nbVoies, vue){
    if(scene) scene.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material && o.material !== CONT) o.material.dispose(); });
    L = nbVoies; COUL = L === 3 ? COUL3 : COUL4; LARG = L === 3 ? 1.25 : 1.05; VIT = LONG / vue;
    scene = new T3.Scene();
    scene.background = new T3.Color(0x120B24);
    scene.fog = new T3.Fog(0x120B24, 22, 70);
    scene.add(new T3.HemisphereLight(0xB9A8FF, 0x2A1A3A, .75));
    const soleil = new T3.DirectionalLight(0xFFFFFF, .55); soleil.position.set(.3, 1, .6); scene.add(soleil);
    const W = L * LARG + .5;
    // le manche : bois sombre, bords, séparations des bandes
    const manche = new T3.Mesh(new T3.BoxGeometry(W, .2, LONG + 6), toon({ color:0x2A1E1A })); manche.position.set(0, -.12, -LONG / 2 + 2); scene.add(manche);
    const mc = new T3.Mesh(new T3.BoxGeometry(W + .08, .26, LONG + 6.08), CONT); mc.position.copy(manche.position); scene.add(mc);
    rails = [];
    for(const s of [-1, 1]){ const r = new T3.Mesh(new T3.BoxGeometry(.12, .12, LONG + 6), new T3.MeshBasicMaterial({ color:0xBFC6D6 })); r.position.set(s * W / 2, .02, -LONG / 2 + 2); scene.add(r); rails.push(r); }
    for(let v = 1; v < L; v++){ const s = new T3.Mesh(new T3.BoxGeometry(.03, .02, LONG + 6), new T3.MeshBasicMaterial({ color:0x6B5A50 })); s.position.set(xVoie(v) - LARG / 2, .0, -LONG / 2 + 2); scene.add(s); }
    // les frettes (une par temps), qui défilent
    frettes = [];
    for(let k = 0; k < 40; k++){ const f = new T3.Mesh(new T3.BoxGeometry(W, .03, .08), new T3.MeshBasicMaterial({ color:0x8C7B70 })); f.visible = false; scene.add(f); frettes.push(f); }
    // la ligne des boutons
    voies = [];
    for(let v = 0; v < L; v++){
      const gr = new T3.Group(); gr.position.set(xVoie(v), .02, 0);
      const anneau = new T3.Mesh(new T3.CylinderGeometry(.44, .44, .12, 24), toon({ color:COUL[v] }));
      const c = new T3.Mesh(new T3.CylinderGeometry(.5, .5, .16, 24), CONT); c.position.y = -.01;
      const fond = new T3.Mesh(new T3.CylinderGeometry(.32, .32, .14, 24), toon({ color:0x1A1A1A }));
      const lum = new T3.Mesh(new T3.CylinderGeometry(.3, .3, .15, 24), new T3.MeshBasicMaterial({ color:COUL[v], transparent:true, opacity:0 }));
      gr.add(c, anneau, fond, lum); scene.add(gr);
      // la flamme d'une note réussie
      const fl = new T3.Mesh(new T3.ConeGeometry(.35, 1.3, 10, 1, true), new T3.MeshBasicMaterial({ color:0xFFB347, transparent:true, opacity:0, depthWrite:false, side:T3.DoubleSide }));
      fl.position.set(xVoie(v), .7, 0); scene.add(fl);
      voies.push({ gr, lum, anneau, fl, appui:0, feu:0 });
    }
    // les notes (réservoir de pierres de couleur, avec leur contour) et les queues des notes longues
    pool = []; queues = [];
    const gPierre = new T3.CylinderGeometry(.38, .4, .2, 20), gCont = new T3.CylinderGeometry(.45, .47, .26, 20), gHaut = new T3.CylinderGeometry(.22, .26, .05, 20);
    for(let k = 0; k < 90; k++){
      const gr = new T3.Group(), mat = toon({ color:0xffffff }), pierre = new T3.Mesh(gPierre, mat), cont = new T3.Mesh(gCont, CONT), haut = new T3.Mesh(gHaut, new T3.MeshBasicMaterial({ color:0xFFFFFF }));
      haut.position.y = .12; gr.add(cont, pierre, haut); gr.visible = false; scene.add(gr); pool.push({ gr, mat, haut, libre:true });
      const q = new T3.Mesh(new T3.BoxGeometry(.2, .06, 1), new T3.MeshBasicMaterial({ color:0xffffff })); q.visible = false; scene.add(q); queues.push(q);
    }
    // des étincelles
    etincelles = [];
    for(let k = 0; k < 40; k++){ const e = new T3.Mesh(new T3.BoxGeometry(.08, .08, .08), new T3.MeshBasicMaterial({ color:0xFFE38A })); e.visible = false; scene.add(e); etincelles.push({ m:e, vie:0, vx:0, vy:0, vz:0 }); }
    // le décor : montagnes, enceintes, projecteurs
    const mont = (x, z, r, h, c) => { const m = new T3.Mesh(new T3.ConeGeometry(r, h, 6), toon({ color:c })); m.position.set(x, h / 2 - 2, z); scene.add(m); const n = new T3.Mesh(new T3.ConeGeometry(r * .32, h * .32, 6), toon({ color:0xE8ECF5 })); n.position.set(x, h - 2 - h * .16 + .01, z); scene.add(n); };
    mont(-22, -60, 18, 26, 0x3A2F5E); mont(4, -70, 22, 34, 0x332A55); mont(26, -58, 16, 22, 0x3D3263); mont(-40, -48, 14, 18, 0x40356A); mont(42, -46, 13, 16, 0x40356A);
    for(const s of [-1, 1]){
      const enc = new T3.Group(); enc.position.set(s * (W / 2 + 2.4), 0, -3);
      enc.add(new T3.Mesh(new T3.BoxGeometry(1.6, 2.4, 1), toon({ color:0x1D1D22 })));
      const hp = new T3.Mesh(new T3.CylinderGeometry(.5, .5, .06, 16), toon({ color:0x3A3A44 })); hp.rotation.x = Math.PI / 2; hp.position.set(0, .4, .52); enc.add(hp);
      const hp2 = hp.clone(); hp2.scale.setScalar(.5); hp2.position.y = -.6; enc.add(hp2);
      const ec = new T3.Mesh(new T3.BoxGeometry(1.7, 2.5, 1.1), CONT); enc.add(ec); scene.add(enc);
    }
    spots = [];
    const couls = [0xFF4FD8, 0x4FC3FF, 0xFFD24F, 0x7CFF6B];
    for(let k = 0; k < 4; k++){
      const m = new T3.Mesh(new T3.ConeGeometry(3, 30, 16, 1, true), new T3.MeshBasicMaterial({ color:couls[k], transparent:true, opacity:.08, depthWrite:false, side:T3.DoubleSide }));
      m.position.set(-12 + k * 8, 12, -30); scene.add(m); spots.push({ m, ph:k * 1.7 });
    }
    const n = 300, st = new Float32Array(n * 3); for(let k = 0; k < n; k++){ st[k * 3] = (Math.random() - .5) * 300; st[k * 3 + 1] = 20 + Math.random() * 80; st[k * 3 + 2] = -90 - Math.random() * 20; }
    const sg = new T3.BufferGeometry(); sg.setAttribute('position', new T3.BufferAttribute(st, 3));
    scene.add(new T3.Points(sg, new T3.PointsMaterial({ color:0xFFFFFF, size:1.5, sizeAttenuation:false, fog:false })));
  }

  /* ---------- Chaque image ----------
     t : le temps du morceau (s) ; notes : la partition ; etat : { appuis, mult, star, beat, t0beat, vie } */
  function rendu(t, notes, e, dt){
    if(!ok || !scene) return;
    // les frettes : une par temps
    let fi = 0; const ph = e.phase || 0, b0 = Math.ceil((t - .3 - ph) / e.beat), b1 = Math.floor((t + LONG / VIT - ph) / e.beat);
    for(let b = b0; b <= b1 && fi < frettes.length; b++){ const f = frettes[fi++]; f.visible = true; f.position.set(0, .0, -(b * e.beat + ph - t) * VIT); f.scale.y = ((b % 4) + 4) % 4 === 0 ? 2.5 : 1; }
    for(; fi < frettes.length; fi++) frettes[fi].visible = false;
    // les notes visibles
    pool.forEach(p => { p.libre = true; p.gr.visible = false; }); queues.forEach(q => q.visible = false);
    let pi = 0, qi = 0;
    const tMax = t + LONG / VIT;
    for(let i = e.debut || 0; i < notes.length; i++){
      const n = notes[i]; if(n.t > tMax) break;
      const fin = n.t + n.long;
      if(fin < t - .4) continue;
      if(n.etat === 1 && !n.long) continue;            // réussie : elle a disparu
      const z = -(n.t - t) * VIT, x = xVoie(n.v), c = n.etoile ? 0xCDEBFF : COUL[n.v];
      // la queue d'une note longue
      if(n.long > 0 && n.etat !== 3){
        // une note glissée : la queue passe en biais sur la bande voisine au milieu de la note
        const D_GL = .1, x2 = n.gl != null ? xVoie(n.gl) : x;
        const bouts = n.gl != null ? [[n.t, n.tg - D_GL, x, x], [n.tg - D_GL, n.tg + D_GL, x, x2], [n.tg + D_GL, fin, x2, x2]] : [[n.t, fin, x, x]];
        for(const [ta, tb, xa, xb] of bouts){
          const t0 = n.etat === 1 ? Math.max(ta, Math.min(t, tb)) : ta; if(tb - t0 < 1e-3 || qi >= queues.length) continue;
          const q = queues[qi++], xd = xa + (xb - xa) * (t0 - ta) / (tb - ta), z0 = -(t0 - t) * VIT, z1 = -(tb - t) * VIT, dx = xb - xd, dz = z1 - z0;
          q.visible = true; q.scale.z = Math.hypot(dx, dz); q.rotation.y = Math.atan2(dx, dz); q.position.set((xd + xb) / 2, .06, (z0 + z1) / 2);
          q.material.color.setHex(n.etat === 2 || n.casse ? 0x555555 : n.tenue ? 0xFFFFFF : c); q.scale.x = n.tenue ? 1.6 + Math.sin(t * 40) * .3 : n.gl != null ? 1.5 : 1;
        }
      }
      if(n.etat === 1 || pi >= pool.length) continue;
      if(z > 1.5) continue;
      const p = pool[pi++]; p.libre = false; p.gr.visible = true; p.gr.position.set(x, .1, z);
      p.mat.color.setHex(n.etat === 2 ? 0x555555 : c); p.mat.emissive && p.mat.emissive.setHex(n.etoile ? 0x3A6A9A : 0x000000);
      p.haut.material.color.setHex(n.etoile ? 0xFFFFFF : 0xF4F4F4);
    }
    // les boutons : allumés quand on appuie, une flamme quand la note est réussie
    voies.forEach((v, k) => {
      const ap = e.appuis[k]; v.appui += ((ap ? 1 : 0) - v.appui) * Math.min(1, dt * 20);
      v.lum.material.opacity = v.appui * .9; v.gr.position.y = .02 - v.appui * .06;
      v.feu = Math.max(0, v.feu - dt * 3); v.fl.material.opacity = v.feu * .85; v.fl.scale.set(1, .6 + v.feu, 1); v.fl.position.y = .35 + v.feu * .45;
      v.fl.material.color.setHex(e.star ? 0x8FD8FF : 0xFFB347);
    });
    // les étincelles
    for(const s of etincelles){ if(s.vie <= 0){ s.m.visible = false; continue; } s.vie -= dt; s.m.visible = true; s.vy -= 9 * dt; s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt; s.m.scale.setScalar(Math.max(.1, s.vie * 2)); }
    // les rails changent de couleur avec le multiplicateur ; le mode étoile met tout en bleu
    const cr = e.star ? 0x6FD0FF : [0xBFC6D6, 0xFFB347, 0x7CFF6B, 0xD07CFF][Math.min(3, e.mult - 1)];
    rails.forEach(r => r.material.color.setHex(cr));
    for(const s of spots){ s.m.rotation.z = Math.sin(t * .9 + s.ph) * .5; s.m.material.opacity = .06 + .06 * (e.public || .5) + (e.star ? .08 : 0); }
    scene.background.setHex(e.star ? 0x0B1A3A : 0x120B24);
    R.render(scene, cam);
  }
  function feu(v, fort = 1){
    const V = voies[v]; if(!V) return; V.feu = fort;
    let n = 0; for(const s of etincelles){ if(s.vie > 0) continue; s.vie = .35 + Math.random() * .25; s.m.position.set(xVoie(v), .3, 0); s.vx = (Math.random() - .5) * 3; s.vy = 2 + Math.random() * 3; s.vz = (Math.random() - .2) * 2; s.m.material.color.setHex(Math.random() < .5 ? 0xFFE38A : COUL[v]); if(++n >= 6) break; }
  }
  return { init, taille, preparer, rendu, feu, ecranVoies, get ok(){ return ok; }, couleurs:() => COUL };
})();
