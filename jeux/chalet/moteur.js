/* Chalet Crush : la logique du jeu (aucun dessin ici : elle tourne aussi avec Node, pour les essais et pour calibrer les niveaux).
   Un plateau de W × H cases (certaines peuvent être des trous). Chaque case porte une pièce :
     { id, k:'p', c:0..5, s:null | 'rh' | 'rv' | 'bo' }   une gourmandise (rh : rayure horizontale, rv : rayure verticale, bo : bombe)
     { id, k:'su', c:-1 }                                 le super-bonus (flocon arc-en-ciel)
     { id, k:'cerise' }                                   une cerise à faire descendre jusqu'en bas
     { id, k:'neige', pv:1..3 }                           un bloc de neige qui ne bouge pas et qu'on casse à côté
   Sous une case il peut y avoir de la glace (1 ou 2 couches) qu'on casse en jouant sur la case.
   `echanger` joue un coup et rend la liste des étapes (échange, éclatements, chutes…) que le dessin rejoue en animation. */
window.CHALET_MOTEUR = (() => {
  const NB_COUL = 6;
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const mobile = p => !!p && p.k !== 'neige';
  const coloree = p => !!p && p.k === 'p';
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  /* ---------- Créer un plateau à partir d'un niveau ---------- */
  function creer(niv, graine = 1){
    const H = niv.forme.length, W = niv.forme[0].length, rnd = mulberry(graine);
    const G = { W, H, niv, rnd, rngEtat:graine, prochain:1, couleurs:niv.couleurs || 5, vide:[], p:[], glace:[], coups:niv.coups, score:0, fini:null, nbCoups:0,
      prog:{ collecte:{}, cerises:0, glaceDetruite:0, neigeDetruite:0 }, cerisesAPoser:0, cerisesPosees:0, etoilesVues:0, combosMax:0 };
    const nouvelle = (o) => Object.assign({ id:G.prochain++ }, o);
    G.nouvelle = nouvelle;
    for(let y = 0; y < H; y++){
      G.vide.push([]); G.p.push([]); G.glace.push([]);
      for(let x = 0; x < W; x++){
        const ch = niv.forme[y][x]; G.vide[y].push(ch !== '#'); G.glace[y].push(ch === 'g' ? 1 : ch === 'G' ? 2 : 0);
        G.p[y].push(ch === 'n' ? nouvelle({ k:'neige', pv:1 }) : ch === 'N' ? nouvelle({ k:'neige', pv:2 }) : ch === 'M' ? nouvelle({ k:'neige', pv:3 }) : ch === 'c' ? nouvelle({ k:'cerise' }) : null);
      }
    }
    const co = niv.objectifs || {};
    G.cerisesAPoser = Math.max(0, (co.cerises || 0) - compter(G, p => p.k === 'cerise'));
    G.totalGlace = G.glace.flat().reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
    G.totalNeige = compter(G, p => p.k === 'neige');
    for(const [c, n] of Object.entries(co.collecte || {})) G.prog.collecte[c] = 0;
    // le remplissage : des pièces au hasard, sans aucun alignement au départ
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++) if(G.vide[y][x] && !G.p[y][x]) G.p[y][x] = nouvelle({ k:'p', c:Math.floor(rnd() * G.couleurs), s:null });
    for(let essai = 0; essai < 400; essai++){
      const runs = alignements(G); if(!runs.length) break;
      for(const r of runs){ const [x, y] = r.cells[Math.floor(r.cells.length / 2)]; if(coloree(G.p[y][x])) G.p[y][x].c = Math.floor(rnd() * G.couleurs); }
    }
    // un plateau sans aucun coup possible n'a aucun intérêt : on mélange
    for(let essai = 0; essai < 50 && !coupsPossibles(G).length; essai++) melangerSansEtape(G);
    return G;
  }
  function compter(G, f){ let n = 0; for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){ const p = G.p[y][x]; if(p && f(p)) n++; } return n; }
  const dedans = (G, x, y) => x >= 0 && y >= 0 && x < G.W && y < G.H && G.vide[y][x];

  /* ---------- Les alignements ---------- */
  function alignements(G){
    const out = [], ok = p => coloree(p);
    for(let y = 0; y < G.H; y++){ let x = 0; while(x < G.W){ const a = G.p[y][x]; if(!ok(a)){ x++; continue; } let e = x + 1; while(e < G.W && ok(G.p[y][e]) && G.p[y][e].c === a.c) e++; if(e - x >= 3){ const cells = []; for(let i = x; i < e; i++) cells.push([i, y]); out.push({ dir:'h', c:a.c, cells }); } x = e; } }
    for(let x = 0; x < G.W; x++){ let y = 0; while(y < G.H){ const a = G.p[y][x]; if(!ok(a)){ y++; continue; } let e = y + 1; while(e < G.H && ok(G.p[e][x]) && G.p[e][x].c === a.c) e++; if(e - y >= 3){ const cells = []; for(let i = y; i < e; i++) cells.push([x, i]); out.push({ dir:'v', c:a.c, cells }); } y = e; } }
    return out;
  }

  /* ---------- Les coups possibles ---------- */
  function echangeable(G, x, y){ return dedans(G, x, y) && mobile(G.p[y][x]); }
  function permuter(G, a, b){ const t = G.p[a[1]][a[0]]; G.p[a[1]][a[0]] = G.p[b[1]][b[0]]; G.p[b[1]][b[0]] = t; }
  // un échange est permis s'il fait un alignement, ou s'il met en jeu un super-bonus ou deux bonus
  function coupValide(G, a, b){
    if(!echangeable(G, a[0], a[1]) || !echangeable(G, b[0], b[1])) return false;
    const pa = G.p[a[1]][a[0]], pb = G.p[b[1]][b[0]];
    if(pa.k === 'su' || pb.k === 'su') return (pa.k === 'su' || coloree(pa)) && (pb.k === 'su' || coloree(pb));
    if(coloree(pa) && coloree(pb) && pa.s && pb.s) return true;
    permuter(G, a, b); const r = alignements(G).some(run => run.cells.some(([x, y]) => (x === a[0] && y === a[1]) || (x === b[0] && y === b[1]))); permuter(G, a, b);
    return r;
  }
  function coupsPossibles(G){
    const out = [];
    for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){
      if(!echangeable(G, x, y)) continue;
      for(const [dx, dy] of [[1, 0], [0, 1]]){ const a = [x, y], b = [x + dx, y + dy]; if(coupValide(G, a, b)) out.push([a, b]); }
    }
    return out;
  }

  /* ---------- Le mélange (quand plus rien n'est possible) ---------- */
  function melangerSansEtape(G){
    const cases = [], pieces = [];
    for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(dedans(G, x, y) && mobile(G.p[y][x])){ cases.push([x, y]); pieces.push(G.p[y][x]); }
    for(let essai = 0; essai < 200; essai++){
      for(let i = pieces.length - 1; i > 0; i--){ const j = Math.floor(G.rnd() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
      cases.forEach(([x, y], i) => { G.p[y][x] = pieces[i]; });
      if(!alignements(G).length && coupsPossibles(G).length) return true;
    }
    return false;
  }

  /* ---------- Éclatement : tout ce qu'un coup fait disparaître, avec les effets en chaîne des bonus ---------- */
  const cle = (x, y) => y * 64 + x;
  function zoneBonus(G, p, x, y, ctx){
    const out = [];
    if(p.k === 'su'){ // un super-bonus touché par une explosion : il vide une couleur au hasard
      const cs = []; for(let yy = 0; yy < G.H; yy++) for(let xx = 0; xx < G.W; xx++) if(coloree(G.p[yy][xx]) && !cs.includes(G.p[yy][xx].c)) cs.push(G.p[yy][xx].c);
      const c = cs.length ? cs[Math.floor(G.rnd() * cs.length)] : 0;
      for(let yy = 0; yy < G.H; yy++) for(let xx = 0; xx < G.W; xx++) if(coloree(G.p[yy][xx]) && G.p[yy][xx].c === c) out.push([xx, yy]);
      return out;
    }
    if(p.s === 'rh') for(let i = 0; i < G.W; i++) out.push([i, y]);
    if(p.s === 'rv') for(let j = 0; j < G.H; j++) out.push([x, j]);
    if(p.s === 'bo') for(let j = -2; j <= 2; j++) for(let i = -2; i <= 2; i++) if(Math.abs(i) + Math.abs(j) <= 2) out.push([x + i, y + j]);
    return out;
  }
  // `ensemble` : la liste des cases visées ; on y ajoute ce que les bonus touchés déclenchent. Rend les bonus déclenchés.
  function etendre(G, ensemble, ctx){
    const vus = new Set(), declenches = [], file = [...ensemble.values()].map(([x, y]) => [x, y]);
    const dans = new Map(); for(const [x, y] of ensemble.values()) dans.set(cle(x, y), [x, y]);
    let i = 0;
    while(i < file.length){
      const [x, y] = file[i++]; if(!dedans(G, x, y)) continue; const p = G.p[y][x];
      if(!p || vus.has(p.id)) continue;
      if((p.k === 'p' && p.s) || p.k === 'su'){
        if(ctx.protege && ctx.protege.has(p.id)) continue;
        vus.add(p.id); declenches.push({ x, y, s:p.k === 'su' ? 'su' : p.s, c:p.c });
        for(const [zx, zy] of zoneBonus(G, p, x, y, ctx)) if(dedans(G, zx, zy) && !dans.has(cle(zx, zy))){ dans.set(cle(zx, zy), [zx, zy]); file.push([zx, zy]); }
      }
    }
    ensemble.clear(); for(const [k, v] of dans) ensemble.set(k, v);
    return declenches;
  }
  // Fait disparaître l'ensemble de cases. `creations` : [{x, y, piece}] (une pièce qui prend la place d'un alignement). Rend l'étape décrivant tout.
  function eclater(G, ensemble, creations, cascade, ctx = {}){
    const protege = new Set(); for(const cr of creations) { const p = G.p[cr.y][cr.x]; if(p) protege.add(p.id); }
    const ens = new Map(ensemble); ctx.protege = protege;
    const declenches = etendre(G, ens, ctx);
    const touches = [], neige = [], glace = [], chaqueCase = [];
    const dommageNeige = new Map();
    for(const [k, [x, y]] of ens){
      if(!dedans(G, x, y)) continue; const p = G.p[y][x]; if(!p) continue;
      if(p.k === 'neige') dommageNeige.set(p.id, [x, y]);
      else if(p.k === 'p' || p.k === 'su') chaqueCase.push([x, y]);
    }
    for(const [x, y] of chaqueCase){
      const p = G.p[y][x], creee = creations.find(c => c.x === x && c.y === y);
      if(G.glace[y][x] > 0){ G.glace[y][x]--; glace.push({ x, y, reste:G.glace[y][x] }); if(!G.glace[y][x]) G.prog.glaceDetruite++; }
      for(const [dx, dy] of DIRS){ const nx = x + dx, ny = y + dy; if(dedans(G, nx, ny) && G.p[ny][nx] && G.p[ny][nx].k === 'neige') dommageNeige.set(G.p[ny][nx].id, [nx, ny]); }
      touches.push({ x, y, id:p.id, k:p.k, c:p.c, s:p.s || null, fusion:!!creee });
      if(p.k === 'p'){ const c = String(p.c); if(c in G.prog.collecte) G.prog.collecte[c]++; }
    }
    for(const [id, [x, y]] of dommageNeige){ const p = G.p[y][x]; if(!p || p.k !== 'neige') continue; p.pv--; neige.push({ x, y, id, reste:p.pv }); if(p.pv <= 0){ G.prog.neigeDetruite++; touches.push({ x, y, id, k:'neige', c:-1, s:null, neigeFin:true }); } }
    for(const t of touches) G.p[t.y][t.x] = null;
    const crees = [];
    for(const cr of creations){ G.p[cr.y][cr.x] = cr.piece; crees.push({ x:cr.x, y:cr.y, piece:cr.piece }); }
    // les points : 60 par pièce, plus un bonus par bonus déclenché, multiplié par la série
    const nb = touches.filter(t => t.k === 'p' || t.k === 'su').length;
    const gain = Math.round((nb * 30 + declenches.length * 60 + (ctx.bonus || 0)) * (1 + .5 * Math.min(cascade - 1, 6)));
    G.score += gain;
    return { t:'eclat', cascade, touches, declenches, creations:crees, neige, glace, gain, couleurSuper:ctx.couleurSuper };
  }

  /* ---------- Chute et remplissage ---------- */
  function sortie(G, x, y){ return dedans(G, x, y) && (y === G.H - 1 || !G.vide[y + 1][x]); }
  function gravite(G){
    const avant = new Map(); for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(G.p[y][x]) avant.set(G.p[y][x].id, [x, y]);
    const spawns = [];
    let encore = true, garde = 0;
    while(encore && garde++ < 200){
      encore = false;
      for(let y = G.H - 1; y >= 0; y--) for(let x = 0; x < G.W; x++){
        if(!G.vide[y][x] || G.p[y][x]) continue;
        const haut = y > 0 && G.vide[y - 1][x], q = haut ? G.p[y - 1][x] : null;
        if(q && mobile(q)){ G.p[y][x] = q; G.p[y - 1][x] = null; encore = true; continue; }
        if(!haut){ // la case est tout en haut (ou sous un trou) : une pièce neuve arrive
          const np = nouvellePiece(G); G.p[y][x] = np; spawns.push({ id:np.id, x, y:0, hauteur:y, depuis:y - 1 }); encore = true; continue;
        }
        if(!q) continue;                                    // rien au-dessus pour l'instant : la case se remplira au prochain tour
        // sous un bloc de neige : une pièce voisine glisse en biais, seulement si elle ne peut pas tomber tout droit
        for(const dx of (G.rnd() < .5 ? [-1, 1] : [1, -1])){
          const sx = x + dx, sy = y - 1;
          if(!dedans(G, sx, sy)) continue; const s = G.p[sy][sx]; if(!mobile(s)) continue;
          const dessous = dedans(G, sx, y) ? G.p[y][sx] : 'trou';
          if(dessous){ G.p[y][x] = s; G.p[sy][sx] = null; encore = true; break; }
        }
      }
    }
    const nouveaux = new Set(spawns.map(s => s.id)), moves = [];
    for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){ const p = G.p[y][x]; if(!p || nouveaux.has(p.id)) continue; const a = avant.get(p.id); if(a && (a[0] !== x || a[1] !== y)) moves.push({ id:p.id, fx:a[0], fy:a[1], tx:x, ty:y }); }
    // les pièces neuves : leur position finale ; elles partent de au-dessus du plateau
    const sp = []; for(const s of spawns){ let pos = null; for(let y = 0; y < G.H && !pos; y++) for(let x = 0; x < G.W; x++) if(G.p[y][x] && G.p[y][x].id === s.id){ pos = [x, y]; break; } if(pos) sp.push({ id:s.id, c:G.p[pos[1]][pos[0]].c, k:G.p[pos[1]][pos[0]].k, fx:s.x, fy:-1 - (s.hauteur >= 0 ? 0 : 0), tx:pos[0], ty:pos[1], piece:G.p[pos[1]][pos[0]] }); }
    return { t:'chute', moves, spawns:sp };
  }
  function nouvellePiece(G){
    const co = (G.niv.objectifs || {});
    const surPlateau = compter(G, p => p.k === 'cerise');
    if(G.cerisesAPoser > 0 && surPlateau < (G.niv.cerisesMax || 2) && G.rnd() < (G.niv.cerisesProba || .16)){ G.cerisesAPoser--; return G.nouvelle({ k:'cerise' }); }
    return G.nouvelle({ k:'p', c:Math.floor(G.rnd() * G.couleurs), s:null });
  }
  // les cerises arrivées en bas
  function recolter(G){
    const sorties = [];
    for(let x = 0; x < G.W; x++) for(let y = 0; y < G.H; y++) if(sortie(G, x, y) && G.p[y][x] && G.p[y][x].k === 'cerise'){ sorties.push({ x, y, id:G.p[y][x].id }); G.p[y][x] = null; G.prog.cerises++; G.score += 250; }
    return sorties;
  }

  /* ---------- Un coup ---------- */
  function creationsDe(G, runs, pivots){
    // pivots : les cases où l'on vient de jouer (pour y faire naître le bonus)
    const crea = [], pris = new Set(), dejaH = new Set();
    // 1) les croisements d'un alignement horizontal et d'un vertical de même couleur : une bombe
    for(const h of runs.filter(r => r.dir === 'h')) for(const v of runs.filter(r => r.dir === 'v' && r.c === h.c)){
      const inter = h.cells.find(([x, y]) => v.cells.some(([vx, vy]) => vx === x && vy === y));
      if(inter && !pris.has(cle(inter[0], inter[1]))){ pris.add(cle(inter[0], inter[1])); dejaH.add(h); dejaH.add(v); crea.push({ x:inter[0], y:inter[1], piece:G.nouvelle({ k:'p', c:h.c, s:'bo' }) }); }
    }
    // 2) les alignements de 4 et 5
    for(const r of runs){
      if(dejaH.has(r) || r.cells.length < 4) continue;
      const libres = r.cells.filter(([x, y]) => !G.p[y][x].s);
      const choix = libres.length ? libres : r.cells;
      let cell = choix.find(([x, y]) => pivots.some(([px, py]) => px === x && py === y)) || choix[Math.floor((choix.length - 1) / 2)];
      if(pris.has(cle(cell[0], cell[1]))) continue;
      pris.add(cle(cell[0], cell[1]));
      crea.push({ x:cell[0], y:cell[1], piece:r.cells.length >= 5 ? G.nouvelle({ k:'su', c:-1 }) : G.nouvelle({ k:'p', c:r.c, s:r.dir === 'h' ? 'rv' : 'rh' }) });
    }
    return crea;
  }
  // Rejoue en boucle : alignements → éclatement → chute, jusqu'à ce que plus rien ne bouge
  function enchainer(G, etapes, pivots, forces){
    let cascade = 0, premier = true;
    for(let garde = 0; garde < 60; garde++){
      let runs = alignements(G), ens = new Map(), crea = [];
      if(premier && forces && forces.size){ for(const [k, v] of forces) ens.set(k, v); }
      if(!runs.length && !ens.size){ // rien à éclater : on regarde seulement la chute des cerises
        const out = recolter(G); if(out.length){ etapes.push({ t:'cerises', sorties:out }); const ch = gravite(G); if(ch.moves.length || ch.spawns.length){ etapes.push(ch); continue; } }
        break;
      }
      cascade++;
      for(const r of runs) for(const [x, y] of r.cells) ens.set(cle(x, y), [x, y]);
      crea = runs.length ? creationsDe(G, runs, premier ? pivots : []) : [];
      const ctx = {};
      etapes.push(eclater(G, ens, crea, cascade, ctx));
      const ch = gravite(G); etapes.push(ch);
      const out = recolter(G); if(out.length){ etapes.push({ t:'cerises', sorties:out }); const ch2 = gravite(G); if(ch2.moves.length || ch2.spawns.length) etapes.push(ch2); }
      premier = false; if(garde === 59) break;
    }
    G.combosMax = Math.max(G.combosMax, cascade);
    return cascade;
  }
  // Les combinaisons de deux bonus échangés
  function combinaison(G, a, b){
    const pa = G.p[a[1]][a[0]], pb = G.p[b[1]][b[0]], ens = new Map(), sp = [];
    const ajouter = (x, y) => { if(dedans(G, x, y)) ens.set(cle(x, y), [x, y]); };
    const tous = f => { for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(dedans(G, x, y) && G.p[y][x] && f(G.p[y][x])) ajouter(x, y); };
    const superA = pa.k === 'su', superB = pb.k === 'su';
    let nom = null;
    if(superA && superB){ nom = 'supersuper'; tous(p => p.k === 'p' || p.k === 'su'); }
    else if(superA || superB){
      const autre = superA ? pb : pa, ps = superA ? a : b;
      ajouter(ps[0], ps[1]);
      if(autre.k === 'p' && !autre.s){ nom = 'supercouleur'; tous(p => p.k === 'p' && p.c === autre.c); }
      else if(autre.k === 'p' && autre.s){
        // tous les bonus de cette couleur se transforment en bonus du même genre, puis explosent
        nom = 'superbonus';
        tous(p => p.k === 'p' && p.c === autre.c);
        for(const [k, [x, y]] of ens){ const p = G.p[y][x]; if(p && p.k === 'p' && p.c === autre.c && !p.s) p.s = autre.s === 'bo' ? 'bo' : (G.rnd() < .5 ? 'rh' : 'rv'); }
        const op = superA ? b : a; ajouter(op[0], op[1]);
      } else { nom = 'supercouleur'; tous(p => p.k === 'p'); }
    } else if(coloree(pa) && coloree(pb) && pa.s && pb.s){
      const [x, y] = b;
      if(pa.s !== 'bo' && pb.s !== 'bo'){ nom = 'croix'; for(let i = 0; i < G.W; i++) ajouter(i, y); for(let j = 0; j < G.H; j++) ajouter(x, j); }
      else if(pa.s === 'bo' && pb.s === 'bo'){ nom = 'grosse'; for(let j = -3; j <= 3; j++) for(let i = -3; i <= 3; i++) if(Math.abs(i) + Math.abs(j) <= 3) ajouter(x + i, y + j); }
      else { nom = 'large'; for(let j = -1; j <= 1; j++) for(let i = 0; i < G.W; i++) ajouter(i, y + j); for(let i = -1; i <= 1; i++) for(let j = 0; j < G.H; j++) ajouter(x + i, j); }
    }
    return nom ? { nom, ens } : null;
  }
  // Joue un coup : échange les pièces des cases a et b. Rend { valide, etapes, ... }
  function echanger(G, a, b){
    if(G.fini) return { valide:false, raison:'fini' };
    if(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return { valide:false, raison:'pas voisines' };
    if(!echangeable(G, a[0], a[1]) || !echangeable(G, b[0], b[1])) return { valide:false, raison:'case bloquée', etapes:[{ t:'refus', a, b }] };
    if(!coupValide(G, a, b)) return { valide:false, raison:'aucun alignement', etapes:[{ t:'refus', a, b }] };
    const etapes = [{ t:'echange', a, b }], score0 = G.score;
    permuter(G, a, b); G.coups--; G.nbCoups++;
    const comb = combinaison(G, a, b);
    if(comb){ etapes.push({ t:'combo', nom:comb.nom, a, b }); enchainer(G, etapes, [a, b], comb.ens); }
    else enchainer(G, etapes, [a, b], null);
    finDeCoup(G, etapes);
    return { valide:true, etapes, gain:G.score - score0, fini:G.fini };
  }
  function finDeCoup(G, etapes){
    // plus de coup possible : on mélange
    if(objectifsAtteints(G)){ G.fini = 'gagne'; etapes.push({ t:'fin', etat:'gagne' }); return; }
    if(G.coups <= 0){ G.fini = 'perdu'; etapes.push({ t:'fin', etat:'perdu' }); return; }
    let m = 0; while(!coupsPossibles(G).length && m++ < 6){ const av = new Map(); for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(G.p[y][x]) av.set(G.p[y][x].id, [x, y]); melangerSansEtape(G); const moves = []; for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){ const p = G.p[y][x]; if(p && av.has(p.id)){ const o = av.get(p.id); if(o[0] !== x || o[1] !== y) moves.push({ id:p.id, fx:o[0], fy:o[1], tx:x, ty:y }); } } etapes.push({ t:'melange', moves }); }
  }

  /* ---------- Les objectifs ---------- */
  function objectifsAtteints(G){
    const co = G.niv.objectifs || {};
    if(co.score && G.score < co.score) return false;
    for(const [c, n] of Object.entries(co.collecte || {})) if((G.prog.collecte[c] || 0) < n) return false;
    if(co.glace && compter2(G, g => g > 0)) return false;
    if(co.neige && compter(G, p => p.k === 'neige')) return false;
    if(co.cerises && G.prog.cerises < co.cerises) return false;
    return true;
  }
  const compter2 = (G, f) => { for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(f(G.glace[y][x])) return true; return false; };
  function restant(G){
    const co = G.niv.objectifs || {}, out = {};
    if(co.score) out.score = Math.max(0, co.score - G.score);
    for(const [c, n] of Object.entries(co.collecte || {})) (out.collecte = out.collecte || {})[c] = Math.max(0, n - (G.prog.collecte[c] || 0));
    if(co.glace) out.glace = G.glace.flat().filter(g => g > 0).length;
    if(co.neige) out.neige = compter(G, p => p.k === 'neige');
    if(co.cerises) out.cerises = Math.max(0, co.cerises - G.prog.cerises);
    return out;
  }
  function etoiles(G){
    const e = G.niv.etoiles || [0, 0, 0]; if(G.fini !== 'gagne') return 0;
    return G.score >= e[2] ? 3 : G.score >= e[1] ? 2 : 1;
  }

  /* ---------- Les aides : marteau, éclair, mélange ---------- */
  function marteau(G, x, y){
    if(!dedans(G, x, y) || !G.p[y][x] || G.p[y][x].k === 'cerise') return { valide:false };
    const etapes = [], ens = new Map([[cle(x, y), [x, y]]]), p = G.p[y][x];
    if(p.k === 'neige'){ p.pv--; etapes.push({ t:'eclat', cascade:1, touches:p.pv <= 0 ? [{ x, y, id:p.id, k:'neige', c:-1, s:null, neigeFin:true }] : [], declenches:[], creations:[], neige:[{ x, y, id:p.id, reste:p.pv }], glace:[], gain:0 }); if(p.pv <= 0){ G.p[y][x] = null; G.prog.neigeDetruite++; } }
    else etapes.push(eclater(G, ens, [], 1, {}));
    etapes.push(gravite(G)); enchainer(G, etapes, [], null);
    finDeCoup(G, etapes);
    return { valide:true, etapes, fini:G.fini };
  }
  function eclair(G, x, y, ligne){ // une ligne ou une colonne entière
    if(!dedans(G, x, y)) return { valide:false };
    const ens = new Map(); if(ligne) for(let i = 0; i < G.W; i++) ens.set(cle(i, y), [i, y]); else for(let j = 0; j < G.H; j++) ens.set(cle(x, j), [x, j]);
    const etapes = [eclater(G, ens, [], 1, {})]; etapes.push(gravite(G)); enchainer(G, etapes, [], null); finDeCoup(G, etapes);
    return { valide:true, etapes, fini:G.fini };
  }
  function melanger(G){
    const av = new Map(); for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++) if(G.p[y][x]) av.set(G.p[y][x].id, [x, y]);
    melangerSansEtape(G); const moves = [];
    for(let y = 0; y < G.H; y++) for(let x = 0; x < G.W; x++){ const p = G.p[y][x]; if(p && av.has(p.id)){ const o = av.get(p.id); if(o[0] !== x || o[1] !== y) moves.push({ id:p.id, fx:o[0], fy:o[1], tx:x, ty:y }); } }
    return { valide:true, etapes:[{ t:'melange', moves }] };
  }
  function cinqCoups(G){ G.coups += 5; if(G.fini === 'perdu') G.fini = null; return { valide:true, etapes:[] }; }

  function cloner(G){
    const C = Object.assign({}, G, { vide:G.vide, p:G.p.map(l => l.map(p => p ? Object.assign({}, p) : null)), glace:G.glace.map(l => l.slice()), prog:{ collecte:Object.assign({}, G.prog.collecte), cerises:G.prog.cerises, glaceDetruite:G.prog.glaceDetruite, neigeDetruite:G.prog.neigeDetruite } });
    const r = mulberry(Math.floor(G.rnd() * 4294967296)); C.rnd = r; C.nouvelle = o => Object.assign({ id:C.prochain++ }, o); return C;
  }
  return { creer, echanger, coupsPossibles, coupValide, alignements, objectifsAtteints, restant, etoiles, marteau, eclair, melanger, cinqCoups, cloner, compter, mobile, coloree, dedans, mulberry, NB_COUL };
})();
