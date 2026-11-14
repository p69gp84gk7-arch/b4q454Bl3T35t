// Analyse d'un niveau : cases où l'on peut se tenir, sauts possibles, et pièges (endroits d'où l'on ne peut plus avancer)
window.analyserNiveau = function(i, opts = {}){
  const P = window.Pepin, TL = P.TL; P.lancerNiveau(i);
  const out = [];
  const zones = Object.entries(P.ZONES || {});
  const Z0 = P.Z;
  const MAXUP = opts.monte || 3, MAXDX = opts.dx || 5;
  const SOL = new Set(['SOLH','SOL','BRIQUE','MYST','USE','DUR','TG','TD','CG','CD','NUAGE','PONT','SAPG','SAPM','SAPD','GLACE','CORAIL','CANON','CANONP','PIERRE'].map(k => TL[k]));
  function analyserZone(Z, nom){
    const W = Z.W, R = 15, pl = Z.plateformes || [];
    const platCells = new Set(); for(const p of pl){ const T=16; const amp = p.amp || 0; const x0 = Math.floor((p.x - (p.type==='h'?amp:0))/T), x1 = Math.floor((p.x + p.w + (p.type==='h'?amp:0))/T); const y0 = Math.floor((p.y - (p.type==='v'||p.type==='monte'||p.type==='descend'?amp:0))/T), y1 = Math.floor((p.y + ((p.type==='v'||p.type==='monte'||p.type==='descend')?amp:0))/T); for(let x=x0;x<x1;x++) for(let y=y0;y<=y1;y++) platCells.add(y*W+x); }
    const solide = (x, y) => x < 0 || x >= W ? true : y < 0 ? true : y >= R ? false : SOL.has(Z.tiles[y * W + x]) || platCells.has(y * W + x);
    const stand = (x, y) => x >= 0 && x < W && y >= 1 && y < R && !solide(x, y) && solide(x, y + 1);
    const nodes = []; const id = new Map();
    for(let y = 0; y < R; y++) for(let x = 0; x < W; x++) if(stand(x, y)){ id.set(y * W + x, nodes.length); nodes.push([x, y]); }
    const adj = nodes.map(() => new Set());
    const lab = (x, y) => id.get(y * W + x);
    nodes.forEach(([x, y], n) => {
      // marcher : case voisine au même niveau, ou chute le long d'un bord
      for(const dx of [-1, 1]){
        const nx = x + dx; if(nx < 0 || nx >= W) continue;
        if(solide(nx, y)) continue;                                   // un mur : il faut sauter
        let ty = y; while(ty < R && !solide(nx, ty + 1)) ty++;       // tombe tout droit
        if(ty < R - 0 && stand(nx, ty)) adj[n].add(lab(nx, ty));
      }
      // sauter : vers une case plus haute (jusqu'à MAXUP), à la même hauteur ou plus bas, à moins de MAXDX cases
      for(let dx = -MAXDX; dx <= MAXDX; dx++){
        if(!dx) continue;
        for(let dy = -MAXUP; dy <= 6; dy++){
          const nx = x + dx, ny = y + dy; if(!stand(nx, ny)) continue;
          const portee = dy <= 0 ? MAXDX - (dy === -3 ? 1 : 0) : MAXDX + 1; if(Math.abs(dx) > portee) continue;
          // le saut passe au-dessus : les colonnes entre les deux ne dépassent pas la hauteur atteinte, et la tête est libre
          const haut = Math.min(y, ny) - (dy < 0 ? 0 : 0); let ok = !solide(x, y - 1) && !solide(nx, ny - 1);
          const sgn = Math.sign(dx);
          for(let k = 1; k < Math.abs(dx) && ok; k++){ const cx = x + sgn * k; for(let cy = Math.min(y, ny) - 1; cy >= Math.min(y, ny) - 1 && ok; cy--) if(solide(cx, cy)) ok = false; }
          // un mur plus haut que la montée plafonne le saut : colonne d'arrivée libre au-dessus de la case de départ
          if(dy < 0){ for(let k = 1; k <= -dy && ok; k++) if(solide(x, y - k) || solide(nx - sgn, y - k) && Math.abs(dx) > 1 && false) ok = false; }
          if(ok) adj[n].add(lab(nx, ny));
        }
      }
    });
    // départ et arrivée
    const dep = Z.depart || { x:2, y:12 };
    let sx = Math.floor(dep.x), sy = Math.floor(dep.y); let start = null;
    for(let yy = sy; yy < R && start == null; yy++) if(stand(sx, yy)) start = lab(sx, yy);
    const buts = [];
    if(Z.drapeau != null){ for(let y = 3; y < R; y++) for(let dx = -4; dx <= 0; dx++) if(stand(Z.drapeau + dx, y)) buts.push(lab(Z.drapeau + dx, y)); }
    if(Z.boss) { /* château : le pont, jusqu'au levier */ for(let y = 0; y < R; y++) for(let x = Z.boss.levier - 3; x <= Z.boss.levier + 2; x++) if(stand(x, y)) buts.push(lab(x, y)); }
    if(Z.fin) { for(let y = 0; y < R; y++) for(let x = Math.floor(Z.fin.x) - 2; x <= Math.floor(Z.fin.x) + 2; x++) if(stand(x, y)) buts.push(lab(x, y)); }
    return { nodes, adj, start, buts, W, id };
  }
  const principal = analyserZone(Z0, 'principal');
  const { nodes, adj, start, buts } = principal;
  const depuis = new Set(); if(start != null){ const q = [start]; depuis.add(start); while(q.length){ const n = q.pop(); for(const m of adj[n]) if(!depuis.has(m)){ depuis.add(m); q.push(m); } } }
  // les cases d'où l'on peut atteindre un but (parcours à l'envers)
  let maxX = 0; depuis.forEach(n => { if(nodes[n][0] > maxX) maxX = nodes[n][0]; }); const buts2 = [...depuis].filter(n => nodes[n][0] >= maxX - 3);
  const rev = nodes.map(() => []); adj.forEach((s, a) => s.forEach(b => rev[b].push(a)));
  const versBut = new Set(); { const q = [...buts2]; buts2.forEach(b => versBut.add(b)); while(q.length){ const n = q.pop(); for(const m of rev[n]) if(!versBut.has(m)){ versBut.add(m); q.push(m); } } }
  const atteint = maxX;
  const pieges = [...depuis].filter(n => !versBut.has(n)).map(n => nodes[n]);
  // regrouper les pièges par colonnes voisines
  pieges.sort((a, b) => a[0] - b[0]); const groupes = [];
  for(const [x, y] of pieges){ const g = groupes[groupes.length - 1]; if(g && x - g.x1 <= 2){ g.x1 = x; g.n++; g.ymin = Math.min(g.ymin, y); g.ymax = Math.max(g.ymax, y); } else groupes.push({ x0:x, x1:x, n:1, ymin:y, ymax:y }); }
  // la frontière : jusqu'où on arrive, et ce qu'il faudrait pour continuer
  let front = null; { let f = null; depuis.forEach(n => { if(!f || nodes[n][0] > nodes[f][0] || (nodes[n][0] === nodes[f][0] && nodes[n][1] < nodes[f][1])) f = n; }); if(f != null && nodes[f][0] < principal.W - 6){ const [fx, fy] = nodes[f]; const suivants = nodes.filter(([x, y], k) => !depuis.has(k) && x > fx && x <= fx + 9).sort((a, b) => a[0] - b[0]).slice(0, 5).map(([x, y]) => [x - fx, y - fy]); front = { x:fx, y:fy, suivants }; } }
  const platInacc = []; for(const p of (Z0.plateformes || [])){ const T = 16, amp = p.amp || 0, hz = p.type === 'h', vt = ['v', 'monte', 'descend', 'cable'].includes(p.type); const x0 = Math.floor((p.x - (hz ? amp : 0)) / T), x1 = Math.floor((p.x + p.w + (hz ? amp : 0)) / T) - 1, y0 = Math.floor((p.y - (vt ? amp : 0)) / T), y1 = Math.floor((p.y + (vt ? amp : 0)) / T); let ok = false; for(let k = 0; k < nodes.length && !ok; k++){ const [nx, ny] = nodes[k]; if(nx >= x0 && nx <= x1 && ny >= y0 - 1 && ny <= y1 - 1 && depuis.has(k)) ok = true; } if(!ok) platInacc.push({ x:Math.round(p.x / T), y:Math.round(p.y / T), type:p.type }); }
  return { platInacc, front, id:P.NIVEAUX[i].id, noeuds:nodes.length, maxX:atteint, eau:!!Z0.eau, largeur:principal.W, nbButs:buts.length, depart:start != null, pieges:groupes };
};
