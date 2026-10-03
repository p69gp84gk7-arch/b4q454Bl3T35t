/* DesDés : calculs des robots et des conseils, pour le Yam's et le 10 000. Aucun affichage ici.
   - YamsIA.conseil : dés à garder et chances de faire chaque figure (calcul exact sur les lancers restants).
   - YamsIA.garder / YamsIA.choisir : décisions du robot (facile, moyen, fort).
   - DixMilleIA : dés à mettre de côté, garder les points ou relancer, reprendre les points du précédent. */
(() => {
  const FACT = [1, 1, 2, 6, 24, 120];
  const tri = d => d.slice().sort((a, b) => a - b);
  const cle = d => tri(d).join('');
  const compte = d => { const c = [0, 0, 0, 0, 0, 0, 0]; d.forEach(v => c[v]++); return c; };

  // Tirages possibles de n dés (sans ordre) et leur probabilité
  const tiragesCache = [];
  function tirages(n){
    if(tiragesCache[n]) return tiragesCache[n];
    const out = [], cur = [];
    const rec = debut => {
      if(cur.length === n){
        const c = compte(cur);
        let p = FACT[n];
        for(let f = 1; f <= 6; f++) p /= FACT[c[f]];
        out.push({ d:cur.slice(), p:p / Math.pow(6, n) });
        return;
      }
      for(let f = debut; f <= 6; f++){ cur.push(f); rec(f); cur.pop(); }
    };
    rec(1);
    return tiragesCache[n] = out;
  }
  // Façons différentes de garder des dés (sans doublon : garder « un des deux 3 » ne compte qu'une fois)
  function gardes(d){
    const s = tri(d), vus = new Map();
    for(let m = 0; m < 1 << s.length; m++){
      const k = s.filter((_, i) => m >> i & 1);
      const kk = k.join('');
      if(!vus.has(kk)) vus.set(kk, k);
    }
    return [...vus.values()];
  }

  /* ---------- Yam's ---------- */
  const HAUT = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
  const NOMS = { n1:'Total de 1', n2:'Total de 2', n3:'Total de 3', n4:'Total de 4', n5:'Total de 5', n6:'Total de 6',
    brelan:'Brelan', carre:'Carré', full:'Full', ps:'Petite suite', gs:'Grande suite', yam:"Yam's", chance:'Chance' };
  // Points d'une case (mêmes règles que la feuille : petite suite 1 à 5, grande suite 2 à 6)
  function points(cat, d){
    const n = compte(d);
    const somme = d.reduce((a, b) => a + b, 0);
    if(cat[0] === 'n' && cat.length === 2){ const f = +cat[1]; return n[f] * f; }
    switch(cat){
      case 'brelan': for(let f = 6; f >= 1; f--) if(n[f] >= 3) return 3 * f; return 0;
      case 'carre': for(let f = 6; f >= 1; f--) if(n[f] >= 4) return 4 * f; return 0;
      case 'full': return n.includes(3) && n.includes(2) ? 25 : 0;
      case 'ps': return [1, 2, 3, 4, 5].every(f => n[f]) ? 30 : 0;
      case 'gs': return [2, 3, 4, 5, 6].every(f => n[f]) ? 40 : 0;
      case 'yam': return n.includes(5) ? 50 : 0;
      case 'chance': return somme;
    }
    return 0;
  }
  // Points habituels d'une case : remplir une case en dessous de sa moyenne est un mauvais choix
  const MOYENNE = { n1:2.1, n2:5.3, n3:8.6, n4:12.2, n5:15.7, n6:19.2, brelan:22, carre:13, full:23, ps:27, gs:24, yam:16, chance:22 };
  // Valeur d'une case pour la décision : points, plus l'effet sur le bonus (63 en haut), moins sa moyenne
  function valeur(cat, d, haut, poids){
    let v = points(cat, d);
    const i = HAUT.indexOf(cat);
    if(i >= 0 && haut < 63){
      if(haut + v >= 63) v += 35;
      else v += (v - 3 * (i + 1)) * 0.9;    // au-dessus de 3 dés : on se rapproche du bonus
    }
    return v - MOYENNE[cat] * poids;
  }

  // Programmation dynamique sur les lancers restants : f0(dés) = valeur finale
  function solveur(f0){
    const fin = new Map(), parGarde = new Map(), parDes = new Map();
    const F0 = d => { const k = cle(d); if(!fin.has(k)) fin.set(k, f0(d)); return fin.get(k); };
    function K(garde, r){
      const k = r + '|' + cle(garde);
      if(parGarde.has(k)) return parGarde.get(k);
      let e = 0;
      for(const t of tirages(5 - garde.length)) e += t.p * E(garde.concat(t.d), r - 1);
      parGarde.set(k, e);
      return e;
    }
    // r : lancers encore possibles après ces dés
    function E(d, r){
      if(r <= 0) return F0(d);
      const k = r + '|' + cle(d);
      if(parDes.has(k)) return parDes.get(k);
      let best = -Infinity;
      for(const g of gardes(d)) best = Math.max(best, g.length === 5 ? E(d, r - 1) : K(g, r));
      parDes.set(k, best);
      return best;
    }
    return { E, K, F0 };
  }
  const solveurs = new Map();
  function solveurCases(ouvertes, haut, poids){
    const k = ouvertes.slice().sort().join() + '|' + haut + '|' + poids;
    if(!solveurs.has(k)){
      if(solveurs.size > 30) solveurs.clear();
      solveurs.set(k, solveur(d => Math.max(...ouvertes.map(c => valeur(c, d, haut, poids)))));
    }
    return solveurs.get(k);
  }
  // Meilleure façon de garder des dés pour r lancers restants
  function meilleureGarde(sol, d, r){
    let best = null, bv = -Infinity;
    for(const g of gardes(d)){
      const v = g.length === 5 ? sol.E(d, r - 1) : sol.K(g, r);
      if(v > bv + 1e-9 || (Math.abs(v - bv) <= 1e-9 && best && g.length > best.length)){ bv = v; best = g; }
    }
    return best;
  }

  const FIGURES = {
    brelan: d => compte(d).some(x => x >= 3),
    carre: d => compte(d).some(x => x >= 4),
    full: d => { const n = compte(d); return n.includes(3) && n.includes(2); },
    ps: d => points('ps', d) > 0,
    gs: d => points('gs', d) > 0,
    yam: d => compte(d).includes(5),
  };
  const solveursFig = {};
  const chance = (fig, garde, r) => {
    const s = solveursFig[fig] = solveursFig[fig] || solveur(d => FIGURES[fig](d) ? 1 : 0);
    return garde.length === 5 ? s.E(garde, r - 1) : s.K(garde, r);
  };

  /* Conseil pour le joueur : dés à garder, chances de chaque figure encore libre, meilleure case maintenant.
     des : valeurs des 5 dés ; restants : lancers encore possibles (0 à 2) ; ouvertes : cases libres ; haut : total du haut. */
  function conseil(des, restants, ouvertes, haut){
    if(!ouvertes.length) return null;
    const sol = solveurCases(ouvertes, haut, 0.45);
    const garde = restants > 0 ? meilleureGarde(sol, des, restants) : des.slice();
    const probas = restants > 0
      ? Object.keys(FIGURES).filter(f => ouvertes.includes(f)).map(f => ({ key:f, label:NOMS[f], p:chance(f, garde, restants) }))
        .filter(x => x.p > 0.005).sort((a, b) => b.p - a.p)
      : [];
    return { garde, probas, case:choisir(des, ouvertes, haut, 'fort') };
  }

  /* Robot */
  function garder(des, restants, ouvertes, haut, niveau){
    if(niveau === 'facile'){
      const n = compte(des);
      // Une suite en vue : garder les dés différents qui se suivent
      for(const suite of [[2, 3, 4, 5, 6], [1, 2, 3, 4, 5]]){
        const ok = suite.filter(f => n[f]);
        if(ok.length >= 4 && (ouvertes.includes('ps') || ouvertes.includes('gs'))) return ok;
      }
      let f = 6;
      for(let v = 6; v >= 1; v--) if(n[v] > n[f]) f = v;
      return des.filter(v => v === f);
    }
    const sol = solveurCases(ouvertes, haut, niveau === 'fort' ? 0.45 : 0);
    return meilleureGarde(sol, des, niveau === 'fort' ? restants : Math.min(restants, 1));
  }
  function choisir(des, ouvertes, haut, niveau){
    if(niveau === 'facile'){
      const pts = ouvertes.map(c => [c, points(c, des)]).sort((a, b) => b[1] - a[1]);
      if(pts[0][1] > 0) return pts[0][0];
      return ouvertes.slice().sort((a, b) => MOYENNE[a] - MOYENNE[b])[0];
    }
    const poids = niveau === 'fort' ? 0.45 : 0;
    let best = ouvertes[0], bv = -Infinity;
    for(const c of ouvertes){ const v = valeur(c, des, haut, poids); if(v > bv){ bv = v; best = c; } }
    return best;
  }

  window.YamsIA = { conseil, garder, choisir, points, NOMS };

  /* ---------- 10 000 ---------- */
  // Mêmes règles que le plateau : 1 = 100, 5 = 50, brelans, carrés, cinq dés au 1er lancer, suites
  function score(vals, premier){
    const c = compte(vals);
    if(vals.length === 5 && ([1, 2, 3, 4, 5].every(f => c[f] === 1) || [2, 3, 4, 5, 6].every(f => c[f] === 1))) return { pts:1500, tous:true };
    let pts = 0, n = 0;
    for(let f = 1; f <= 6; f++){
      let k = c[f];
      const triple = f === 1 ? 1000 : f * 100;
      if(k >= 5 && premier){ pts += f === 1 ? 10000 : f * 1000; n += 5; k -= 5; }
      else if(k >= 4){ pts += triple * 2; n += 4; k -= 4; }
      else if(k >= 3){ pts += triple; n += 3; k -= 3; }
      if(f === 1){ pts += 100 * k; n += k; }
      if(f === 5){ pts += 50 * k; n += k; }
    }
    return { pts, tous: n > 0 && n === vals.length };
  }
  // Ce que vaut encore la suite du tour selon le nombre de dés à relancer (0 : les 5 dés reviennent)
  const SUITE = { fort:[400, 25, 50, 120, 220, 400], moyen:[300, 40, 70, 120, 180, 300] };
  // Indices des dés lancés à mettre de côté ; besoin : points qu'il manque pour faire 10 000 pile
  function deCote(vals, premier, niveau, besoin = Infinity){
    const options = [];
    for(let m = 1; m < 1 << vals.length; m++){
      const idx = vals.map((_, i) => i).filter(i => m >> i & 1);
      const s = score(idx.map(i => vals[i]), premier);
      if(s.tous && s.pts > 0) options.push({ idx, pts:s.pts, reste:vals.length - idx.length });
    }
    if(!options.length) return [];
    if(niveau === 'facile') return options.sort((a, b) => b.idx.length - a.idx.length || b.pts - a.pts)[0].idx;
    // Fin de partie : tomber pile sur 10 000, sinon éviter de dépasser
    const pile = niveau === 'fort' && options.find(o => o.pts === besoin);
    if(pile) return pile.idx;
    const sous = niveau === 'fort' ? options.filter(o => o.pts < besoin) : [];
    const suite = SUITE[niveau] || SUITE.fort;
    return (sous.length ? sous : options).sort((a, b) => (b.pts + suite[b.reste]) - (a.pts + suite[a.reste]))[0].idx;
  }
  // Seuils pour garder ses points, selon les dés qui resteraient à lancer
  const SEUILS = { facile:[350, 350, 350, 350, 350, 350], moyen:[1500, 300, 350, 500, 800, 1500], fort:[2000, 300, 300, 400, 700, 2000] };
  function garderPoints({ tour, des, score:total, ouvert, niveau }){
    if(!ouvert && tour < 1000) return false;      // il faut 1 000 pour ouvrir
    const reste = 10000 - total;
    if(tour >= reste) return true;                 // pile 10 000 (ou dépassé : la croix est inévitable)
    // Fin de partie : ne pas risquer de dépasser pour peu de chose
    if(niveau === 'fort' && reste - tour <= 300 && tour >= 50) return true;
    return tour >= (SEUILS[niveau] || SEUILS.fort)[des % 6];
  }
  // Chances qu'au moins un dé rapporte, selon le nombre de dés lancés
  const REUSSITE = [0, 1 / 3, 5 / 9, 0.722, 0.842, 0.923];
  function reprendre({ pts, des, niveau }){
    const p = REUSSITE[des || 5];
    if(niveau === 'facile') return pts >= 300;
    return p * pts >= (niveau === 'fort' ? 350 : 250);
  }

  window.DixMilleIA = { score, deCote, garderPoints, reprendre };
})();
