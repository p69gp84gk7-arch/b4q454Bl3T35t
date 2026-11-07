/* Billard : la physique (vue de dessus, en mètres). Repère de la table : x le long de la grande bande (0 à L), y en travers (0 à l),
   y vers le bas comme sur l'écran. Les boules glissent puis roulent : « w » est la vitesse qu'aurait la boule en roulant avec sa rotation
   (coulé si w va plus loin que v, rétro si w part en arrière) ; le frottement de glissement rapproche v et w, puis la boule roule.
   « s » est l'effet latéral (rotation autour de la verticale) : il dévie la boule en sortie de bande.
   Le pool a 6 poches (bandes coupées, avec leurs mâchoires) ; le billard français (carambole) n'en a pas. */
window.BILLARD_PHYS = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const GLISSE = 2.2, ROULE = .3, ROULE_V = .22, BANDE = .76, CHOC = .95, EFFET_BANDE = .3;
  const TABLES = {
    pool:{ L:2.54, l:1.27, R:.02858, poches:true, tapis:'#1F7A4D', tapis2:'#16603C' },
    carambole:{ L:2.84, l:1.42, R:.03075, poches:false, tapis:'#2A5FA8', tapis2:'#1F4C8C' },
  };
  // les bandes (segments du nez de la bande) et les poches du pool
  function geometrie(type){
    const T = TABLES[type], L = T.L, l = T.l, seg = [], poches = [];
    if(!T.poches){ seg.push([0, 0, L, 0], [L, 0, L, l], [L, l, 0, l], [0, l, 0, 0]); return { seg, poches }; }
    const c = .075, m = .062, j = .045;   // ouverture des poches de coin et du milieu, profondeur des mâchoires
    // bandes du haut et du bas (deux morceaux chacune), et des côtés (un morceau)
    for(const [y, s] of [[0, -1], [l, 1]]){
      seg.push([c, y, L / 2 - m, y], [L / 2 + m, y, L - c, y]);
      seg.push([c, y, c - j * .7, y + s * j], [L / 2 - m, y, L / 2 - m + j * .3, y + s * j], [L / 2 + m, y, L / 2 + m - j * .3, y + s * j], [L - c, y, L - c + j * .7, y + s * j]);
    }
    for(const [x, s] of [[0, -1], [L, 1]]){
      seg.push([x, c, x, l - c]);
      seg.push([x, c, x + s * j, c - j * .7], [x, l - c, x + s * j, l - c + j * .7]);
    }
    for(const [x, y] of [[0, 0], [L, 0], [0, l], [L, l]]) poches.push({ x:x + (x ? .022 : -.022), y:y + (y ? .022 : -.022), r:.068 });
    for(const y of [0, l]) poches.push({ x:L / 2, y:y + (y ? .042 : -.042), r:.062 });
    return { seg, poches };
  }
  // une table et ses boules ; une boule : { id, x, y, vx, vy, wx, wy, s, dedans }
  function table(type, boules){
    const T = TABLES[type], g = geometrie(type);
    return { type, L:T.L, l:T.l, R:T.R, seg:g.seg, poches:g.poches, b:boules.map(b => ({ vx:0, vy:0, wx:0, wy:0, s:0, dedans:false, ...b })) };
  }
  const cloner = T => ({ ...T, b:T.b.map(b => ({ ...b })) });
  // frapper la blanche : angle, vitesse (m/s), effet a (à gauche -1, à droite +1, vu du joueur) et b (rétro -1, coulé +1)
  function frapper(T, id, angle, v0, a = 0, b = 0){
    const q = T.b.find(x => x.id === id), dx = Math.cos(angle), dy = Math.sin(angle);
    q.vx = dx * v0; q.vy = dy * v0;
    // la rotation : centre = la boule glisse sans tourner ; haut = coulé ; bas = rétro
    q.wx = dx * v0 * 1.35 * b; q.wy = dy * v0 * 1.35 * b;
    q.s = -a * v0 * 1.1;
  }
  const bouge = q => !q.dedans && (Math.abs(q.vx) + Math.abs(q.vy) > 1e-4);
  const enMouvement = T => T.b.some(bouge);
  // un pas de temps ; ev (facultatif) note ce qui se passe : premier contact, boules touchées par la blanche, bandes, poches, chocs
  function pas(T, dt, ev, idBlanche){
    const R = T.R;
    for(const q of T.b){
      if(q.dedans) continue;
      let v = Math.hypot(q.vx, q.vy);
      if(v < 1e-4 && Math.hypot(q.wx, q.wy) < 1e-4){ q.vx = q.vy = q.wx = q.wy = q.s = 0; continue; }
      // glissement : v et w se rapprochent (la rotation change 2,5 fois plus vite que la vitesse)
      const gx = q.vx - q.wx, gy = q.vy - q.wy, gl = Math.hypot(gx, gy);
      if(gl > .01){
        const k = Math.min(GLISSE * dt, gl / 3.5);
        q.vx -= gx / gl * k; q.vy -= gy / gl * k; q.wx += gx / gl * k * 2.5; q.wy += gy / gl * k * 2.5;
      } else {
        // roulement : la boule ralentit doucement
        q.wx = q.vx; q.wy = q.vy; v = Math.hypot(q.vx, q.vy);
        const nv = Math.max(0, v - (ROULE + ROULE_V * v) * dt);
        if(v > 0){ q.vx *= nv / v; q.vy *= nv / v; } q.wx = q.vx; q.wy = q.vy;
        if(nv < .004){ q.vx = q.vy = q.wx = q.wy = q.s = 0; }
      }
      q.s *= Math.exp(-dt * .35);
      q.x += q.vx * dt; q.y += q.vy * dt;
      // les bandes et les mâchoires
      for(const [x1, y1, x2, y2] of T.seg){
        const ex = x2 - x1, ey = y2 - y1, l2 = ex * ex + ey * ey, u = clamp(((q.x - x1) * ex + (q.y - y1) * ey) / l2, 0, 1);
        const px = x1 + ex * u, py = y1 + ey * u, dx = q.x - px, dy = q.y - py, d = Math.hypot(dx, dy);
        if(d >= R || d < 1e-9) continue;
        const nx = dx / d, ny = dy / d, vn = q.vx * nx + q.vy * ny;
        q.x = px + nx * R; q.y = py + ny * R;
        if(vn >= 0) continue;
        q.vx -= (1 + BANDE) * vn * nx; q.vy -= (1 + BANDE) * vn * ny;
        q.vx *= .97; q.vy *= .97;
        // l'effet latéral dévie la boule le long de la bande
        const tx = -ny, ty = nx; q.vx += tx * q.s * EFFET_BANDE * Math.min(1, -vn * 1.5); q.vy += ty * q.s * EFFET_BANDE * Math.min(1, -vn * 1.5); q.s *= .5;
        const wn = q.wx * nx + q.wy * ny; q.wx -= 1.5 * wn * nx; q.wy -= 1.5 * wn * ny;
        if(ev){ ev.bandes.push({ id:q.id, v:-vn }); if(q.id === idBlanche && ev.premier) ev.bandesApres++; if(q.id === idBlanche) ev.bandesBlanche++; }
      }
      // les poches
      for(const p of T.poches) if(Math.hypot(q.x - p.x, q.y - p.y) < p.r){ q.dedans = true; q.vx = q.vy = q.wx = q.wy = 0; if(ev) ev.poches.push(q.id); break; }
      if(!q.dedans && (q.x < -.08 || q.y < -.08 || q.x > T.L + .08 || q.y > T.l + .08)){ q.dedans = true; if(ev) ev.poches.push(q.id); }
    }
    // les chocs entre boules (élastiques, sans frottement : la rotation reste, d'où le coulé et le rétro)
    const B = T.b;
    for(let i = 0; i < B.length; i++){
      const p = B[i]; if(p.dedans) continue;
      for(let j = i + 1; j < B.length; j++){
        const q = B[j]; if(q.dedans) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d2 = dx * dx + dy * dy;
        if(d2 >= 4 * R * R) continue;
        const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d, rel = (p.vx - q.vx) * nx + (p.vy - q.vy) * ny;
        const reco = (2 * R - d) / 2; p.x -= nx * reco; p.y -= ny * reco; q.x += nx * reco; q.y += ny * reco;
        if(rel <= 0) continue;
        const J = (1 + CHOC) / 2 * rel;
        p.vx -= J * nx; p.vy -= J * ny; q.vx += J * nx; q.vy += J * ny;
        if(ev){
          ev.chocs.push({ a:p.id, b:q.id, v:rel });
          if(p.id === idBlanche || q.id === idBlanche){ const autre = p.id === idBlanche ? q.id : p.id; if(ev.premier == null) ev.premier = autre; if(!ev.touchees.includes(autre)) ev.touchees.push(autre); }
        }
      }
    }
  }
  const evenements = () => ({ premier:null, touchees:[], bandes:[], poches:[], chocs:[], bandesApres:0, bandesBlanche:0 });
  // simule un coup jusqu'à l'arrêt (pour le robot) ; renvoie les événements
  function simuler(T, idBlanche, max = 25, dt = 1 / 400){
    const ev = evenements();
    for(let t = 0; t < max && enMouvement(T); t += dt) pas(T, dt, ev, idBlanche);
    return ev;
  }
  // la prévision : la blanche part dans cette direction ; où touche-t-elle (une boule, ou une bande puis la suite) ?
  function prevoir(T, id, angle, b = 0){
    const q = T.b.find(x => x.id === id), R = T.R, dx = Math.cos(angle), dy = Math.sin(angle);
    const points = [[q.x, q.y]];
    let x = q.x, y = q.y, ux = dx, uy = dy, res = null;
    for(let rebond = 0; rebond < 3 && !res; rebond++){
      let tMin = 9, cible = null;
      for(const o of T.b){
        if(o.dedans || o === q) continue;
        const fx = x - o.x, fy = y - o.y, B = fx * ux + fy * uy, C = fx * fx + fy * fy - 4 * R * R, D = B * B - C;
        if(D < 0) continue;
        const t = -B - Math.sqrt(D); if(t > 1e-6 && t < tMin){ tMin = t; cible = o; }
      }
      // les bandes (on prend le rectangle où roule le centre de la boule)
      let tb = 9, nx = 0, ny = 0;
      const lim = [[R, -1, 0], [T.L - R, 1, 0], [R, 0, -1], [T.l - R, 0, 1]];
      for(const [v, ax, ay] of lim){
        const c = ax ? (v - x) / ux : (v - y) / uy; if(!(c > 1e-6) || !isFinite(c)) continue;
        if(c < tb){ tb = c; nx = -ax; ny = -ay; }
      }
      if(cible && tMin <= tb){
        const gx = x + ux * tMin, gy = y + uy * tMin; points.push([gx, gy]);
        let ox = cible.x - gx, oy = cible.y - gy; const ol = Math.hypot(ox, oy); ox /= ol; oy /= ol;
        // la blanche part sur la tangente (bille arrêtée), plus ou moins vers l'avant (coulé) ou l'arrière (rétro)
        const dot = ux * ox + uy * oy; let tx = ux - dot * ox, ty = uy - dot * oy; const tl = Math.hypot(tx, ty);
        if(tl > 1e-3){ tx /= tl; ty /= tl; } else { tx = 0; ty = 0; }
        let cx = tx * tl + ox * dot * b * .9, cy = ty * tl + oy * dot * b * .9; const cl = Math.hypot(cx, cy) || 1;
        res = { boule:cible.id, ghost:[gx, gy], cible:[cible.x, cible.y], dirCible:[ox, oy], dirBlanche:[cx / cl, cy / cl], force:dot };
      } else {
        x += ux * tb; y += uy * tb; points.push([x, y]);
        if(nx) ux = -ux; else uy = -uy;
      }
    }
    return { points, res };
  }
  return { TABLES, table, cloner, frapper, pas, simuler, prevoir, enMouvement, evenements };
})();
