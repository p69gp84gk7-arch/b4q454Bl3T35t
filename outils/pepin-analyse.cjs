// Analyse des niveaux de Pépin : cases où l'on peut se tenir, sauts possibles (montée de 4 cases au plus, 6 cases de large),
// pièges (creux d'où l'on ne peut plus avancer) et plateformes mobiles hors de portée.
// Usage : lancer un serveur à la racine (npx http-server -p 8765 -s .), puis  node outils/pepin-analyse.cjs [numéro de niveau]
// (Playwright doit être installé : require('playwright'))
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport:{ width:900, height:500 } });
  await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await p.goto('http://localhost:8765/jeux/pepin.html'); await p.waitForTimeout(800);
  await p.addScriptTag({ content:fs.readFileSync(path.join(__dirname, 'pepin-analyse.js'), 'utf8') });
  const n = await p.evaluate(() => Pepin.NIVEAUX.length), liste = process.argv[2] ? [+process.argv[2]] : [...Array(n).keys()];
  for(const i of liste){
    const d = await p.evaluate(i => window.analyserNiveau(i, { monte:4, dx:6 }), i);
    console.log(d.id, d.eau ? '(eau : non analysé) ' : '', 'atteint jusqu\'à', d.maxX, '/', d.largeur, d.pieges.length ? 'PIÈGES ' + JSON.stringify(d.pieges.map(g => [g.x0, g.x1])) : 'aucun piège', d.platInacc.length ? 'plateformes hors de portée ' + JSON.stringify(d.platInacc) : '');
  }
  await b.close();
})();
