/* Baroudeur : le 4x4 (le dessin et la physique).
   La caisse est un solide (position, vitesse, orientation, rotation). Chaque roue est un ressort amorti qui touche le sol :
   elle pousse la caisse, et ses pneus accrochent plus ou moins selon le sol (herbe, piste, neige, sable, eau…).
   Le 4x4 a quatre roues motrices. Repère de la voiture : +z vers l'avant, +y vers le haut, +x vers la gauche. */
window.BAROUDEUR_VEHICULE = (() => {
  'use strict';
  const M = window.BAROUDEUR_MONDE, S = window.BAROUDEUR_SCENE;
  const G = 9.81, MASSE = 1500, INERTIE = [2700, 2900, 1500];        // tangage (x), lacet (y), roulis (z)
  const ROUES = [[.84, -.22, 1.34], [-.84, -.22, 1.34], [.84, -.22, -1.3], [-.84, -.22, -1.3]];   // avant gauche, avant droite, arrière gauche, arrière droite
  const RAYON = .47, REPOS = .52;
  const COINS = [];
  for(const x of [-.95, .95]) for(const y of [-.5, .95]) for(const z of [-2.15, 2.15]) COINS.push([x, y, z]);
  // l'adhérence et la résistance au roulement de chaque sol (0 herbe, 1 piste, 2 roche, 3 neige, 4 sable, 5 galets/eau, 6 forêt, 7 roche rouge)
  const SOL = [[.92, .035], [1.02, .02], [.96, .025], [.3, .03], [.62, .5], [.75, .07], [.86, .05], [.96, .025]];

  let T = null;
  /* ---------- Le dessin ---------- */
  function creer(THREE, scene, couleur){
    T = THREE;
    const peint = S.toon({ color:couleur });
    const caisse = S.objet([
      { f:'boite', d:[1.9, .72, 4.3], p:[0, .02, 0] },
      { f:'boite', d:[1.78, .82, 2.3], p:[0, .78, -.35] },
      { f:'boite', d:[2.12, .28, 1.2], p:[0, .2, 1.34] }, { f:'boite', d:[2.12, .28, 1.2], p:[0, .2, -1.3] },     // les ailes
    ], .06, peint);
    const details = S.objet([
      { f:'boite', d:[1.64, .62, .1], c:0x2E3B4A, p:[0, .8, .82], r:[-.25, 0, 0] },                 // le pare-brise
      { f:'boite', d:[.1, .55, 1.9], c:0x2E3B4A, p:[.9, .82, -.35] }, { f:'boite', d:[.1, .55, 1.9], c:0x2E3B4A, p:[-.9, .82, -.35] },
      { f:'boite', d:[1.5, .5, .1], c:0x2E3B4A, p:[0, .82, -1.51] },
      { f:'boite', d:[2, .3, .3], c:0x2A2A2A, p:[0, -.25, 2.2] }, { f:'boite', d:[2, .3, .3], c:0x2A2A2A, p:[0, -.25, -2.2] },   // les pare-chocs
      { f:'cyl', d:[.06, .06, 1.6, 6], c:0x3A3A3A, p:[0, .3, 2.32], r:[0, 0, Math.PI / 2] }, { f:'cyl', d:[.06, .06, .6, 6], c:0x3A3A3A, p:[.6, .05, 2.32] }, { f:'cyl', d:[.06, .06, .6, 6], c:0x3A3A3A, p:[-.6, .05, 2.32] },
      { f:'cyl', d:[.14, .14, .08, 10], c:0xFFF6C2, p:[.62, .18, 2.17], r:[Math.PI / 2, 0, 0] }, { f:'cyl', d:[.14, .14, .08, 10], c:0xFFF6C2, p:[-.62, .18, 2.17], r:[Math.PI / 2, 0, 0] },
      { f:'cyl', d:[.4, .4, .26, 12], c:0x222222, p:[0, .35, -2.25], r:[Math.PI / 2, 0, 0] },          // la roue de secours
      { f:'boite', d:[1.6, .08, 1.9], c:0x555555, p:[0, 1.25, -.35] }, { f:'boite', d:[.08, .14, 1.9], c:0x555555, p:[.75, 1.3, -.35] }, { f:'boite', d:[.08, .14, 1.9], c:0x555555, p:[-.75, 1.3, -.35] },
      { f:'boite', d:[.7, .3, .6], c:0x8A6A3A, p:[.3, 1.45, -.6] },                                     // une caisse sur le toit
    ], .05);
    const snorkel = S.objet([{ f:'cyl', d:[.08, .08, 1.5, 8], c:0x1E1E1E, p:[-1.02, .7, 1.05] }, { f:'boite', d:[.24, .2, .3], c:0x1E1E1E, p:[-1.02, 1.5, 1.12] }], .04);
    const gr = new T.Group(); gr.add(caisse, details, snorkel);
    const roues = ROUES.map(([x, y, z]) => {
      const r = S.objet([
        { f:'cyl', d:[RAYON, RAYON, .38, 14], c:0x232323, r:[0, 0, Math.PI / 2] },
        { f:'cyl', d:[.25, .25, .4, 10], c:0xB8BCC4, r:[0, 0, Math.PI / 2] },
        { f:'boite', d:[.42, .1, .12], c:0x6A6E76 },                                                   // un rayon : on voit la roue tourner
      ], .05);
      const pivot = new T.Group(); pivot.add(r); pivot.position.set(x, y - REPOS, z); gr.add(pivot);
      return { pivot, r };
    });
    // l'ombre sous la voiture
    const ombre = new T.Mesh(new T.CircleGeometry(2.4, 20), new T.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.25, depthWrite:false }));
    ombre.rotation.x = -Math.PI / 2; ombre.scale.set(.85, 1.25, 1); scene.add(ombre);
    scene.add(gr);
    return {
      gr, roues, snorkel, peint, ombre,
      p:new T.Vector3(), v:new T.Vector3(), q:new T.Quaternion(), w:new T.Vector3(),
      etat:ROUES.map(() => ({ comp:0, tour:0, sol:false, glisse:0 })), braq:0, choc:0, regime:0, patine:0,
    };
  }
  function placer(V, x, z, cap){
    V.p.set(x, Math.max(M.hauteur(x, z), M.hauteur(x + 1.5, z), M.hauteur(x - 1.5, z), M.hauteur(x, z + 2), M.hauteur(x, z - 2)) + 1.3, z); V.v.set(0, 0, 0); V.w.set(0, 0, 0);
    // posé à plat sur la pente
    const n = M.normale(x, z), up = new T.Vector3(n[0], n[1], n[2]);
    const q1 = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), cap), q2 = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), up);
    V.q.copy(q2.multiply(q1));
  }

  /* ---------- La physique ---------- */
  const _R = () => new T.Matrix4();
  let R = null, U, F, Lt, A, P, r, vp, N, Fw, Sw, tmp, tmp2, Ftot, Tq, axeY;
  function vecteurs(){
    R = _R(); U = new T.Vector3(); F = new T.Vector3(); Lt = new T.Vector3(); A = new T.Vector3(); P = new T.Vector3(); r = new T.Vector3(); vp = new T.Vector3();
    N = new T.Vector3(); Fw = new T.Vector3(); Sw = new T.Vector3(); tmp = new T.Vector3(); tmp2 = new T.Vector3(); Ftot = new T.Vector3(); Tq = new T.Vector3(); axeY = new T.Vector3(0, 1, 0);
  }
  // une force appliquée en un point
  function force(fx, fy, fz, px, py, pz, V){
    Ftot.x += fx; Ftot.y += fy; Ftot.z += fz;
    const rx = px - V.p.x, ry = py - V.p.y, rz = pz - V.p.z;
    Tq.x += ry * fz - rz * fy; Tq.y += rz * fx - rx * fz; Tq.z += rx * fy - ry * fx;
  }
  const vitessePoint = (V, x, y, z, out) => { const rx = x - V.p.x, ry = y - V.p.y, rz = z - V.p.z, w = V.w;
    return out.set(V.v.x + w.y * rz - w.z * ry, V.v.y + w.z * rx - w.x * rz, V.v.z + w.x * ry - w.y * rx); };

  /* cmd : { gaz:-1..1, dir:-1..1 } ; o : les réglages (force, vmax, grip, k, c, course, snorkel, sable, chaines) */
  function pas(V, dt, cmd, o, obstacles){
    if(!R) vecteurs();
    R.makeRotationFromQuaternion(V.q);
    U.set(0, 1, 0).applyMatrix4(R); F.set(0, 0, 1).applyMatrix4(R); Lt.set(1, 0, 0).applyMatrix4(R);
    Ftot.set(0, -MASSE * G, 0); Tq.set(0, 0, 0);
    const vf = V.v.dot(F), m4 = MASSE / 4;
    // la direction : moins braquée à grande vitesse
    const dmax = .6 / (1 + Math.abs(vf) / 13);
    V.braq += (cmd.dir * dmax - V.braq) * Math.min(1, dt * 7);
    // le moteur, le frein, la marche arrière
    let moteur = 0, frein = 0;
    if(cmd.gaz > .05){ if(vf < -1) frein = cmd.gaz; else moteur = o.force * cmd.gaz * Math.max(0, 1 - vf / o.vmax); }
    else if(cmd.gaz < -.05){ if(vf > 1) frein = -cmd.gaz; else moteur = -o.force * .65 * -cmd.gaz * Math.max(0, 1 - -vf / 7); }
    const arret = Math.abs(cmd.gaz) <= .05;
    V.regime += ((Math.abs(cmd.gaz) * .6 + Math.abs(vf) / o.vmax * .6) - V.regime) * Math.min(1, dt * 3);
    let patine = 0, solsTouches = 0;
    for(let k = 0; k < 4; k++){
      const e = V.etat[k], [lx, ly, lz] = ROUES[k];
      A.set(lx, ly, lz).applyMatrix4(R).add(V.p);
      e.sol = false;
      if(U.y < .25){ e.comp = 0; continue; }
      const rad = k === o.crevee ? RAYON - .13 : RAYON, h = M.hauteur(A.x, A.z), d = (A.y - h) / Math.max(.4, U.y), comp = REPOS + rad - d;
      if(comp <= 0){ e.comp = Math.max(0, e.comp - dt * 3); continue; }
      e.sol = true; solsTouches++;
      e.comp = Math.min(comp, o.course);
      const n = M.normale(A.x, A.z); N.set(n[0], n[1], n[2]);
      P.copy(A).addScaledVector(U, -d);
      vitessePoint(V, P.x, P.y, P.z, vp);
      const cv = -vp.dot(N);
      let Fn = o.k * Math.min(comp, o.course) + o.c * cv;
      if(comp > o.course) Fn += o.k * 10 * (comp - o.course) + o.c * 2 * cv;   // la butée
      Fn = Math.max(0, Fn);
      // les axes du pneu
      Fw.copy(F); if(k < 2) Fw.applyAxisAngle(U, V.braq);
      Fw.addScaledVector(N, -Fw.dot(N)).normalize();
      Sw.crossVectors(N, Fw);
      const vl = vp.dot(Fw), vs = vp.dot(Sw);
      // le sol
      const s = M.surface(A.x, A.z);
      let [mu, rr] = SOL[s];
      if(s === 3 && o.chaines) mu = .86;
      if(s === 4 && o.sable){ mu = .9; rr = .06; }
      mu *= o.grip;
      if(k === o.crevee){ mu *= .55; rr += .18; }                                   // la roue crevée
      // les forces du pneu
      let Flat = -vs * m4 / dt * .45;
      let Flong = moteur / 4;
      if(frein) Flong += -Math.sign(vl) * Math.min(o.force * .45, Math.abs(vl) * m4 / dt * .5) * frein;
      const resist = rr * Fn + (arret ? Fn * .22 : 0);
      Flong += -Math.sign(vl) * Math.min(resist, Math.abs(vl) * m4 / dt * .5);
      if(arret && Math.abs(vl) < 1.2) Flong += -vl * m4 / dt * .4;                      // le frein de parking
      const tot = Math.hypot(Flong, Flat), max = mu * Fn;
      if(tot > max){ const f = max / tot; Flong *= f; Flat *= f; e.glisse = Math.min(1, Math.max(Math.abs(vs) - 1, 0) / 4 + (Math.abs(moteur / 4) > max * .95 ? .5 : 0)); } else e.glisse *= .9;
      patine = Math.max(patine, e.glisse);
      // le ressort au point de contact, les pneus un peu plus haut (la voiture se couche moins dans les virages)
      force(N.x * Fn, N.y * Fn, N.z * Fn, P.x, P.y, P.z, V);
      tmp.copy(P).addScaledVector(U, .6);
      force(Fw.x * Flong + Sw.x * Flat, Fw.y * Flong + Sw.y * Flat, Fw.z * Flong + Sw.z * Flat, tmp.x, tmp.y, tmp.z, V);
      e.tour += (vl + (moteur ? Math.sign(moteur) * e.glisse * 6 : 0)) / RAYON * dt;
    }
    V.patine = patine; V.auSol = solsTouches;
    // la stabilité : roues au sol, la caisse cherche à rester parallèle au sol (comme un centre de gravité très bas)
    if(solsTouches >= 2){
      const n = M.normale(V.p.x, V.p.z); N.set(n[0], n[1], n[2]);
      tmp.crossVectors(U, N);                                    // l'axe pour se redresser
      const roulis = tmp.dot(F), tangage = tmp.dot(Lt);
      Tq.addScaledVector(F, roulis * 26000 * solsTouches / 4).addScaledVector(Lt, tangage * 9000 * solsTouches / 4);
      const wr = V.w.dot(F); Tq.addScaledVector(F, -wr * 2600);  // et le roulis est amorti
    }
    // la caisse qui touche le sol (tonneau, gros rocher)
    for(const [cx, cy, cz] of COINS){
      A.set(cx, cy, cz).applyMatrix4(R).add(V.p);
      const h = M.hauteur(A.x, A.z);
      if(A.y >= h) continue;
      const n = M.normale(A.x, A.z); N.set(n[0], n[1], n[2]);
      vitessePoint(V, A.x, A.y, A.z, vp);
      const vn = vp.dot(N), pen = h - A.y, Fn = Math.max(0, 90000 * pen - 6000 * vn);
      tmp2.copy(vp).addScaledVector(N, -vn); const vt = tmp2.length();
      const Ff = vt > .01 ? Math.min(.6 * Fn, vt * MASSE / 8 / dt * .3) / vt : 0;
      force(N.x * Fn - tmp2.x * Ff, N.y * Fn - tmp2.y * Ff, N.z * Fn - tmp2.z * Ff, A.x, A.y, A.z, V);
    }
    // l'eau freine
    const prof = M.profondeurEau(V.p.x, V.p.z);
    V.prof = prof;
    if(prof > .1){ const k = Math.min(1, prof / 1.2) * 1400; Ftot.addScaledVector(V.v, -k); }
    // l'air
    const sp = V.v.length(); Ftot.addScaledVector(V.v, -.9 * sp);
    // on avance
    V.v.addScaledVector(Ftot, dt / MASSE);
    V.p.addScaledVector(V.v, dt);
    // la rotation : le couple dans le repère de la voiture, divisé par l'inertie
    tmp.copy(Tq).applyMatrix4(R.clone().transpose());
    tmp.set(tmp.x / INERTIE[0], tmp.y / INERTIE[1], tmp.z / INERTIE[2]).applyMatrix4(R);
    V.w.addScaledVector(tmp, dt).multiplyScalar(1 - .5 * dt);
    const wq = new T.Quaternion(V.w.x * dt * .5, V.w.y * dt * .5, V.w.z * dt * .5, 0).multiply(V.q);
    V.q.set(V.q.x + wq.x, V.q.y + wq.y, V.q.z + wq.z, V.q.w + wq.w).normalize();
    // les obstacles (arbres, rochers, maisons) : on est repoussé
    V.choc = Math.max(0, V.choc - dt * 3);
    for(const ob of obstacles(V.p.x, V.p.z)){
      const dx = V.p.x - ob.x, dz = V.p.z - ob.z, d = Math.hypot(dx, dz), min = ob.r + 1.7;
      if(d >= min || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d, vn = V.v.x * nx + V.v.z * nz;
      V.p.x += nx * (min - d); V.p.z += nz * (min - d);
      if(vn < 0){ V.v.x -= nx * vn * 1.35; V.v.z -= nz * vn * 1.35; V.w.y *= .7; V.choc = Math.max(V.choc, Math.min(1, -vn / 10)); }
    }
    // les bords du monde
    const lim = M.DEMI - 12;
    if(Math.abs(V.p.x) > lim){ V.p.x = Math.sign(V.p.x) * lim; V.v.x *= -.3; }
    if(Math.abs(V.p.z) > lim){ V.p.z = Math.sign(V.p.z) * lim; V.v.z *= -.3; }
    // passé sous le sol (ne devrait pas arriver) : on remonte
    const hs = M.hauteur(V.p.x, V.p.z);
    if(V.p.y < hs - 1.5){ V.p.y = hs + 1.2; V.v.y = Math.max(0, V.v.y); }
  }

  /* ---------- Le dessin suit la physique ---------- */
  function dessiner(V){
    V.gr.position.copy(V.p); V.gr.quaternion.copy(V.q);
    V.roues.forEach((rd, k) => {
      const e = V.etat[k];
      const crev = k === V.crevee;
      rd.pivot.position.y = ROUES[k][1] - (REPOS - e.comp) + .02;
      rd.pivot.scale.set(1, crev ? .72 : 1, crev ? 1.06 : 1);
      rd.pivot.rotation.y = k < 2 ? V.braq : 0;
      rd.r.rotation.x = e.tour;
    });
    const h = M.hauteur(V.p.x, V.p.z), n = M.normale(V.p.x, V.p.z);
    V.ombre.position.set(V.p.x, Math.max(h, M.W) + .08, V.p.z);
    V.ombre.material.opacity = Math.max(0, .28 - (V.p.y - h - 1) * .05);
    const cap = Math.atan2(V.gr.matrixWorld.elements[8], V.gr.matrixWorld.elements[10]);
    V.ombre.rotation.set(-Math.PI / 2, 0, cap);
  }
  // le cap (direction de l'avant, vu du dessus) : 0 = vers +z
  function cap(V){ if(!R) vecteurs(); tmp.set(0, 0, 1).applyQuaternion(V.q); return Math.atan2(tmp.x, tmp.z); }
  function haut(V){ if(!R) vecteurs(); tmp.set(0, 1, 0).applyQuaternion(V.q); return tmp.y; }
  function vitesse(V){ if(!R) vecteurs(); tmp.set(0, 0, 1).applyQuaternion(V.q); return V.v.dot(tmp); }

  return { creer, placer, pas, dessiner, cap, haut, vitesse, MASSE };
})();
