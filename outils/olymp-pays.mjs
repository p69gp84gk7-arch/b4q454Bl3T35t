/* Fabrique jeux/olympiades/pays.js : pour chaque pays (nom français et drapeau du jeu de géographie),
   ses trois couleurs principales, mesurées sur le drapeau dessiné (pour les maillots des Olympiades).
   Usage (à la racine du dépôt) : node outils/olymp-pays.mjs  (il faut Playwright) */
import fs from 'fs';
import path from 'path';
let pw;
try{ pw = await import('playwright'); }catch(e){ pw = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); }
const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(racine, 'jeux/geo/monde.js'), 'utf8');
const GEO = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
const pays = GEO.countries.filter(c => fs.existsSync(path.join(racine, `jeux/geo/drapeaux/${c.c}.svg`)));
const b = await pw.chromium.launch(); const p = await b.newPage();
await p.setContent('<canvas id="c" width="96" height="72"></canvas>');
const res = [];
for(const c of pays){
  const svg = fs.readFileSync(path.join(racine, `jeux/geo/drapeaux/${c.c}.svg`), 'utf8');
  const cols = await p.evaluate(async svg => {
    const im = new Image(); im.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    await im.decode(); const cv = document.getElementById('c'), g = cv.getContext('2d'); g.clearRect(0, 0, 96, 72); g.drawImage(im, 0, 0, 96, 72);
    const d = g.getImageData(0, 0, 96, 72).data, groupes = [];
    for(let i = 0; i < d.length; i += 4){
      const r = d[i], v = d[i + 1], bl = d[i + 2];
      let gr = groupes.find(x => Math.abs(x.r - r) + Math.abs(x.v - v) + Math.abs(x.b - bl) < 70);
      if(!gr){ gr = { r, v, b:bl, n:0, sr:0, sv:0, sb:0 }; groupes.push(gr); }
      gr.n++; gr.sr += r; gr.sv += v; gr.sb += bl;
    }
    const hex = x => Math.round(x).toString(16).padStart(2, '0');
    return groupes.filter(x => x.n > 96 * 72 * .04).sort((a, b) => b.n - a.n).slice(0, 3).map(x => '#' + hex(x.sr / x.n) + hex(x.sv / x.n) + hex(x.sb / x.n));
  }, svg);
  res.push([c.c, c.n, ...cols]);
}
await b.close();
res.sort((a, b) => a[1].localeCompare(b[1], 'fr'));
fs.writeFileSync(path.join(racine, 'jeux/olympiades/pays.js'),
  '/* Données générées par outils/olymp-pays.mjs — ne pas modifier à la main.\n   [code du drapeau, nom, couleurs principales du drapeau (de la plus étendue à la moins étendue)] */\n' +
  'window.OLYMP_PAYS = [\n' + res.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n];\n');
console.log(res.length, 'pays');
