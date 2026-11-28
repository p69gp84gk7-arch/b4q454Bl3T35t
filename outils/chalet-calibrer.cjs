// Calibre les niveaux de Chalet Crush : un petit robot joue chaque niveau, on cherche le plus petit nombre de coups
// avec lequel il gagne environ une partie sur deux (un joueur qui réfléchit fait mieux), et les seuils d'étoiles.
// Usage : node outils/chalet-calibrer.cjs [premier] [dernier]   → écrit les mesures dans calib-<premier>.json (voir outils/chalet-fusionner.cjs)
const fs = require('fs'), path = require('path');
global.window = {}; require(path.join(__dirname, '../jeux/chalet/moteur.js')); require(path.join(__dirname, '../jeux/chalet/niveaux.js'));
const M = window.CHALET_MOTEUR, N = window.CHALET_NIVEAUX;
const CIBLE = +process.env.CIBLE || .5, NB = +process.env.NB || 12;
function valeur(G0, G1, r, niv){
  const co = niv.objectifs, d = (a, b) => b - a;
  let v = (G1.score - G0.score) * (co.score ? .02 : .006);
  v += (G1.prog.glaceDetruite - G0.prog.glaceDetruite) * 45 + (G1.prog.neigeDetruite - G0.prog.neigeDetruite) * 45 + (G1.prog.cerises - G0.prog.cerises) * 90;
  for(const c of Object.keys(co.collecte || {})) v += (G1.prog.collecte[c] - G0.prog.collecte[c]) * 14;
  for(const e of r.etapes) if(e.t === 'eclat') v += e.creations.length * 35 + e.declenches.length * 25;
  // les cerises : on aime vider le dessous
  if(co.cerises){ for(let y = 0; y < G1.H; y++) for(let x = 0; x < G1.W; x++) if(G1.p[y][x] && G1.p[y][x].k === 'cerise') v += y * 6; }
  return v;
}
function jouer(niv, graine, coups){
  const n = Object.assign({}, niv, { coups }); const G = M.creer(n, graine); let k = 0;
  while(!G.fini && k++ < 120){
    const c = M.coupsPossibles(G); if(!c.length) break;
    const NC = +process.env.CAND || 6; const cand = c.length > NC ? Array.from({ length:NC }, () => c[Math.floor(G.rnd() * c.length)]) : c;
    let best = null, bv = -1e9;
    for(const [a, b] of cand){ const C = M.cloner(G), r = M.echanger(C, a, b); if(!r.valide) continue; const v = valeur(G, C, r, niv) + G.rnd() * 6; if(v > bv){ bv = v; best = [a, b]; } }
    if(!best) break; M.echanger(G, best[0], best[1]);
  }
  return G;
}
function taux(niv, coups, nb, graine0){ let w = 0; const sc = []; for(let i = 0; i < nb; i++){ const G = jouer(niv, graine0 + i * 13, coups); if(G.fini === 'gagne'){ w++; sc.push(G.score); } } return { taux:w / nb, scores:sc.sort((a, b) => a - b) }; }
// argv[2] : « premier dernier » ou une liste « 14,15,18 »
const liste = process.argv[2] && process.argv[2].includes(',') ? process.argv[2].split(',').map(Number) : Array.from({ length:(+process.argv[3] || 60) - (+process.argv[2] || 1) + 1 }, (_, i) => (+process.argv[2] || 1) + i);
const premier = liste[0], sortie = {};
const arrondi = (v, p = 100) => Math.max(p, Math.round(v / p) * p);
for(const L of liste){
  const niv0 = N.construire(L), kind = N.PROGRAMME[L - 1].kind, aScore = niv0.objectifs.score != null, composite = aScore && kind !== 's';
  const sansScore = o => { const n = Object.assign({}, niv0, { objectifs:Object.assign({}, niv0.objectifs) }); if(o != null) n.objectifs.score = o; else delete n.objectifs.score; return n; };
  let niv, coups, objScore = null;
  if(kind === 's'){
    // niveau de score : coups fixes, on règle l'objectif d'après ce que le robot sait faire
    coups = Math.max(18, 30 - Math.floor(L / 5));
    const sc = []; for(let i = 0; i < 20; i++){ const G = jouer(sansScore(1e9), L * 100 + i * 7, coups); sc.push(G.score); } sc.sort((a, b) => a - b);
    objScore = arrondi(sc[Math.floor(sc.length * .45)] * .9, 100); niv = sansScore(objScore);
  } else {
    const cherche = n => { let lo = 15, hi = 42, best = hi; while(lo < hi){ const mid = (lo + hi) >> 1; const r = taux(n, mid, NB, L * 1000); if(r.taux >= CIBLE){ best = mid; hi = mid; } else lo = mid + 1; } return best; };
    niv = sansScore(null); coups = cherche(niv);
    if(composite){ const sc = []; for(let i = 0; i < 16; i++){ const G = jouer(sansScore(1e9), L * 100 + i * 7, coups); sc.push(G.score); } sc.sort((a, b) => a - b); objScore = arrondi(sc[Math.floor(sc.length * .4)] * .75, 100); niv = sansScore(objScore); coups = cherche(niv); }
  }
  const fin = taux(niv, coups, 30, L * 1000 + 777), sc = fin.scores;
  const base = objScore || 0, med = sc.length ? sc[Math.floor(sc.length / 2)] : base * 1.2, p85 = sc.length ? sc[Math.floor(sc.length * .85)] : med * 1.3;
  const e2 = Math.max(arrondi(Math.max(med, base * 1.15)), base + 200), e3 = Math.max(arrondi(Math.max(p85 * 1.1, e2 * 1.25)), e2 + 300);
  sortie[L] = [coups, e2, e3, objScore];
  console.log('niveau', L, kind, 'coups', coups, 'objectif', objScore, 'étoiles', e2, e3, 'taux', fin.taux.toFixed(2)); fs.writeFileSync(path.join(__dirname, `calib-${premier}.json`), JSON.stringify(sortie));
}
