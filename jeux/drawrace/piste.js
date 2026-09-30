/* Draw Race : géométrie des circuits et des trajectoires (lignes lissées, courbure, adhérence). */
window.Piste = (() => {
  const W = 1000, H = 600;          // cadre des circuits
  const LARGEUR = 80;              // largeur de la piste
  const STEP = 4;                  // un point tous les 4 unités le long des lignes
  const VMAX = 340;                // vitesse maximale (unités par seconde)
  const GRIP = 230;                // adhérence : vitesse limite en virage = √(GRIP / courbure)

  // Courbe de Catmull-Rom (centripète) passant par les points de passage, boucle fermée
  function spline(p){
    const out = [], n = p.length;
    for(let i = 0; i < n; i++){
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      const seg = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
      for(let k = 0; k < seg; k++){
        const t = t1 + (t2 - t1) * k / seg;
        const L = (a, b, ta, tb) => [0, 1].map(j => ((tb - t) * a[j] + (t - ta) * b[j]) / (tb - ta));
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
        const B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    return out;
  }

  // Points régulièrement espacés le long d'une ligne (fermée : on revient au départ)
  function resample(poly, step, closed){
    const pts = closed ? poly.concat([poly[0]]) : poly;
    const out = [[pts[0][0], pts[0][1]]];
    let carry = 0;
    for(let i = 1; i < pts.length; i++){
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const seg = Math.hypot(bx - ax, by - ay);
      let t = step - carry;
      while(t <= seg){
        out.push([ax + (bx - ax) * t / seg, ay + (by - ay) * t / seg]);
        t += step;
      }
      carry = seg - (t - step);
    }
    if(closed && out.length > 1 && Math.hypot(out[out.length - 1][0] - out[0][0], out[out.length - 1][1] - out[0][1]) < step / 2) out.pop();
    return out;
  }

  // Courbure en chaque point (boucle fermée), lissée
  function courbure(pts, k = 4){
    const n = pts.length, raw = new Array(n);
    for(let i = 0; i < n; i++){
      const a = pts[(i - k + n) % n], b = pts[i], c = pts[(i + k) % n];
      const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]), t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let d = t2 - t1;
      while(d > Math.PI) d -= 2 * Math.PI;
      while(d < -Math.PI) d += 2 * Math.PI;
      raw[i] = Math.abs(d) / (2 * k * STEP);
    }
    return lisser(raw, 3);
  }
  function lisser(v, r){
    const n = v.length, out = new Array(n);
    for(let i = 0; i < n; i++){
      let s = 0;
      for(let j = -r; j <= r; j++) s += v[(i + j + n) % n];
      out[i] = s / (2 * r + 1);
    }
    return out;
  }
  const vitesseVirage = kappa => Math.min(VMAX, Math.sqrt(GRIP / Math.max(kappa, 1e-5)));

  // Circuit prêt à l'emploi : ligne centrale régulière, courbure, cap
  function construire(c){
    const pts = resample(spline(c.p), STEP, true);
    const kappa = courbure(pts);
    const cap = pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.atan2(q[1] - p[1], q[0] - p[0]); });
    return { ...c, pts, kappa, cap, len:pts.length * STEP };
  }

  // Point de la ligne centrale le plus proche, cherché autour d'un indice (évite de sauter au croisement du Huit)
  function plusProche(piste, x, y, autour, avant = 70, arriere = 12){
    const n = piste.pts.length;
    let best = -1, bd = Infinity;
    const from = autour == null ? 0 : autour - arriere, to = autour == null ? n - 1 : autour + avant;
    for(let j = from; j <= to; j++){
      const i = ((j % n) + n) % n, p = piste.pts[i];
      const d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if(d < bd){ bd = d; best = j; }
    }
    return { i:((best % n) + n) % n, j:best, d:Math.sqrt(bd) };
  }

  return { W, H, LARGEUR, STEP, VMAX, GRIP, spline, resample, courbure, lisser, vitesseVirage, construire, plusProche };
})();
