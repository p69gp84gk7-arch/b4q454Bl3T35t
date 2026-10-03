/* Construit les données du jeu de géographie :
     jeux/geo/monde.js et jeux/geo/drapeaux/ (pays),
     jeux/geo/france.js (régions et départements, outre-mer en encarts),
     jeux/geo/usa.js et jeux/geo/drapeaux-us/ (États des États-Unis).
   Usage (dans un dossier de travail) :
     npm install world-atlas us-atlas topojson-client topojson-server topojson-simplify d3-geo world-countries flag-icons us-state-flags
     curl -O https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/regions-avec-outre-mer.geojson
     curl -O https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-avec-outre-mer.geojson
     cp chemin/vers/le/depot/outils/construire-geo.mjs . && node construire-geo.mjs chemin/vers/le/depot
   Sources : Natural Earth via world-atlas (domaine public), U.S. Census Bureau via us-atlas (domaine public),
   IGN Admin Express via france-geojson (Licence ouverte), mledoze/countries via world-countries (ODbL),
   drapeaux flag-icons (MIT) et us-state-flags (ISC), noms français fournis par Intl (CLDR). */
import fs from 'fs';
import path from 'path';
import { feature, merge } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoNaturalEarth1, geoConicConformal, geoMercator, geoAlbersUsa, geoPath, geoArea, geoContains } from 'd3-geo';

const REPO = process.argv[2] || '.';
const W = 1000;
const r1 = v => Math.round(v * 10) / 10;
const ecrire = (fichier, nom, donnees) => {
  const out = `/* Données générées par outils/construire-geo.mjs — ne pas modifier à la main. */\nwindow.${nom} = ${JSON.stringify(donnees)};\n`;
  fs.writeFileSync(path.join(REPO, fichier), out);
  console.log(fichier, (out.length / 1024).toFixed(0), 'Ko');
};

// Plus grand morceau d'une forme : c'est là qu'on pose le repère des petits territoires
function mainPart(f){
  if(f.geometry.type !== 'MultiPolygon') return f;
  let best = null, area = -1;
  for(const coords of f.geometry.coordinates){
    const g = { type:'Polygon', coordinates:coords };
    const a = geoArea(g);
    if(a > area){ area = a; best = g; }
  }
  return { type:'Feature', geometry:best };
}
// Tracé, repère et surface d'une forme
function forme(gen, f){
  const [cx, cy] = gen.centroid(mainPart(f));
  return { d:gen(f) || '', x:r1(cx), y:r1(cy), a:r1(gen.area(f)) };
}

/* ---------- Monde ---------- */
const wc = JSON.parse(fs.readFileSync('node_modules/world-countries/countries.json'));
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const names = new Intl.DisplayNames(['fr'], { type:'region' });
const RENAME = { VA:'Vatican', PS:'Palestine', CD:'RD Congo', CG:'Congo' };
// Morceaux que world-atlas sépare d'un pays membre de l'ONU : ils lui sont rattachés
// (l'Australie partage son code avec les îles Ashmore-et-Cartier, le Somaliland et Chypre du Nord n'ont pas de code)
const RATTACHE = { 'Ashmore and Cartier Is.':'036', 'Somaliland':'706', 'N. Cyprus':'196' };
const geoms = topo.objects.countries.geometries;
const parCode = new Map();
for(const g of geoms){
  const id = RATTACHE[g.properties.name] || g.id;
  if(!id) continue;
  if(!parCode.has(id)) parCode.set(id, []);
  parCode.get(id).push(g);
}
const feats = new Map([...parCode].map(([id, gs]) => [id, { type:'Feature', id, properties:{}, geometry: gs.length > 1 ? merge(topo, gs) : feature(topo, gs[0]).geometry }]));
const sansCode = geoms.filter(g => !g.id && !RATTACHE[g.properties.name]).map(g => feature(topo, g));

const zoneOf = c => c.region === 'Africa' ? 'afrique'
  : c.region === 'Europe' ? 'europe'
  : c.region === 'Asia' ? 'asie'
  : c.region === 'Oceania' ? 'oceanie'
  : c.subregion === 'South America' ? 'amsud' : 'amnord';

// Projection : l'antiméridien passe à 169° O pour garder les îles du Pacifique du côté de l'Océanie
const proj = geoNaturalEarth1().rotate([-11, 0]);
proj.fitWidth(W, { type:'Sphere' });
const pathGen = geoPath(proj).digits(1);
const H = Math.ceil(geoPath(proj).bounds({ type:'Sphere' })[1][1]);

const membres = wc.filter(c => c.unMember || ['VA','PS'].includes(c.cca2));
const countries = [];
fs.mkdirSync(path.join(REPO, 'jeux/geo/drapeaux'), { recursive:true });
for(const c of membres){
  const f = feats.get(c.ccn3);
  const code = c.cca2.toLowerCase();
  const entry = { c:code, n:RENAME[c.cca2] || names.of(c.cca2), z:zoneOf(c) };
  if(f) Object.assign(entry, forme(pathGen, f));
  else {
    // Absent de la carte (Tuvalu) : un simple repère à sa position
    const [x, y] = proj([c.latlng[1], c.latlng[0]]);
    Object.assign(entry, { d:'', x:r1(x), y:r1(y), a:0 });
  }
  countries.push(entry);
  fs.copyFileSync(`node_modules/flag-icons/flags/4x3/${code}.svg`, path.join(REPO, `jeux/geo/drapeaux/${code}.svg`));
}
countries.sort((a, b) => a.n.localeCompare(b.n, 'fr'));

// Terres hors liste (Groenland, Sahara occidental, Kosovo, Antarctique…) : fond de carte non cliquable
const used = new Set(membres.map(c => c.ccn3));
const others = [...[...feats.values()].filter(f => !used.has(f.id)), ...sansCode].map(f => pathGen(f)).filter(Boolean).join('');

// Cadrages des zones (longitudes, latitudes), projetés sur la carte
function box(lon0, lat0, lon1, lat1){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(let lon = lon0; lon <= lon1; lon += (lon1 - lon0) / 20)
    for(let lat = lat0; lat <= lat1; lat += (lat1 - lat0) / 20){
      const [x, y] = proj([lon, lat]);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  return [x0, y0, x1 - x0, y1 - y0].map(v => Math.round(v));
}
const zones = {
  monde:   { n:'Monde', v:[0, 0, W, H] },
  afrique: { n:'Afrique', v:box(-26, -37, 58, 38) },
  amnord:  { n:'Amérique du Nord', v:box(-168, 5, -52, 72) },
  amsud:   { n:'Amérique du Sud', v:box(-92, -56, -32, 13) },
  asie:    { n:'Asie', v:box(25, -11, 150, 56) },
  europe:  { n:'Europe', v:box(-25, 34, 45, 71) },
  oceanie: { n:'Océanie', v:box(110, -48, 191, 12) },
};
ecrire('jeux/geo/monde.js', 'GEO', { w:W, h:H, zones, countries, others });
console.log('pays', countries.length, '| H', H);

/* ---------- France : métropole à droite, outre-mer en encarts à gauche ---------- */
// Simplification commune (les frontières partagées restent jointives)
function simplifier(geojson, garde){
  const t = presimplify(topology({ f:geojson }, 1e6));
  const s = simplify(t, quantile(t, garde));
  return feature(s, s.objects.f).features;
}
const deps = simplifier(JSON.parse(fs.readFileSync('departements-avec-outre-mer.geojson')), 0.12);
const regs = simplifier(JSON.parse(fs.readFileSync('regions-avec-outre-mer.geojson')), 0.12);
const DOM = ['971', '972', '973', '974', '976'];      // départements d'outre-mer
const FW = 1000, FH = 860, COL = 190;
const metro = { type:'FeatureCollection', features:deps.filter(f => !DOM.includes(f.properties.code)) };
const projMetro = geoConicConformal().parallels([44, 49]).rotate([-3, 0]).fitExtent([[COL + 20, 10], [FW - 10, FH - 10]], metro);
// Un encart par département d'outre-mer, empilés dans la colonne de gauche
const cadres = [], projDom = {};
const hCadre = (FH - 10 * (DOM.length + 1)) / DOM.length;
DOM.forEach((code, i) => {
  const f = deps.find(d => d.properties.code === code);
  const y0 = 10 + i * (hCadre + 10);
  const lat = (f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0])[0][1];
  const p = (lat > 10 ? geoConicConformal().parallels([lat - 1, lat + 1]) : geoMercator());
  p.fitExtent([[18, y0 + 8], [COL - 8, y0 + hCadre - 8]], f);
  projDom[code] = p;
  cadres.push({ x:10, y:r1(y0), w:COL - 10, h:r1(hCadre), n:f.properties.nom });
});
const genFr = code => geoPath(projDom[code] || projMetro).digits(1);
// Région d'outre-mer : même code que son département
const DOM_REGION = { '01':'971', '02':'972', '03':'973', '04':'974', '06':'976' };
const regions = regs.map(f => ({ c:f.properties.code, n:f.properties.nom, ...forme(genFr(DOM_REGION[f.properties.code]), f) }))
  .sort((a, b) => a.n.localeCompare(b.n, 'fr'));
// Région de chaque département : celle qui contient son point central
const departements = deps.map(f => {
  const code = f.properties.code;
  const dom = Object.entries(DOM_REGION).find(([, d]) => d === code);
  let r = dom ? dom[0] : null;
  if(!r){
    const pt = projMetro.invert(genFr(code).centroid(mainPart(f)));
    const reg = regs.find(g => geoContains(g, pt));
    r = reg ? reg.properties.code : null;
  }
  if(!r) throw new Error('région introuvable pour ' + code);
  return { c:code, n:f.properties.nom, r, ...forme(genFr(code), f) };
}).sort((a, b) => a.c.localeCompare(b.c));
ecrire('jeux/geo/france.js', 'GEO_FRANCE', { w:FW, h:FH, cadres, regions, departements });
console.log('régions', regions.length, '| départements', departements.length);

/* ---------- États-Unis (Alaska et Hawaï en encarts, projection Albers) ---------- */
const us = JSON.parse(fs.readFileSync('node_modules/us-atlas/states-10m.json'));
const usFeats = feature(us, us.objects.states).features;
const NOMS_US = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'Californie', CO:'Colorado', CT:'Connecticut', DE:'Delaware',
  FL:'Floride', GA:'Géorgie', HI:'Hawaï', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky',
  LA:'Louisiane', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi',
  MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey', NM:'Nouveau-Mexique',
  NY:'New York', NC:'Caroline du Nord', ND:'Dakota du Nord', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvanie',
  RI:'Rhode Island', SC:'Caroline du Sud', SD:'Dakota du Sud', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
  VA:'Virginie', WA:'Washington', WV:'Virginie-Occidentale', WI:'Wisconsin', WY:'Wyoming',
};
// Codes FIPS des États → codes postaux
const FIPS = { '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL','13':'GA','15':'HI','16':'ID',
  '17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO',
  '30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA',
  '44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY' };
const UW = 1000;
const projUs = geoAlbersUsa().fitExtent([[10, 10], [UW - 10, 600]], { type:'FeatureCollection', features:usFeats.filter(f => FIPS[f.id]) });
const genUs = geoPath(projUs).digits(1);
const UH = Math.ceil(genUs.bounds({ type:'FeatureCollection', features:usFeats.filter(f => FIPS[f.id]) })[1][1] + 10);
const etats = usFeats.filter(f => FIPS[f.id]).map(f => ({ c:FIPS[f.id].toLowerCase(), n:NOMS_US[FIPS[f.id]], ...forme(genUs, f) }))
  .sort((a, b) => a.n.localeCompare(b.n, 'fr'));
const autresUs = usFeats.filter(f => !FIPS[f.id]).map(f => genUs(f)).filter(Boolean).join('');
// Encarts : Alaska et Hawaï (cadres autour de leur forme)
const cadresUs = ['AK', 'HI'].map(k => {
  const [[x0, y0], [x1, y1]] = genUs.bounds(usFeats.find(f => FIPS[f.id] === k));
  return { x:r1(x0 - 8), y:r1(y0 - 8), w:r1(x1 - x0 + 16), h:r1(y1 - y0 + 16), n:NOMS_US[k] };
});
ecrire('jeux/geo/usa.js', 'GEO_USA', { w:UW, h:UH, cadres:cadresUs, etats, autres:autresUs });
// Drapeaux des États : extraits des composants de us-state-flags
fs.mkdirSync(path.join(REPO, 'jeux/geo/drapeaux-us'), { recursive:true });
for(const e of etats){
  const src = fs.readFileSync(`node_modules/us-state-flags/src/components/flags/Flag${e.c.toUpperCase()}.js`, 'utf8');
  const vb = src.match(/viewBox: '([0-9 .]+)'/)[1];
  const inner = src.match(/__html: `([\s\S]*?)`/)[1].trim();
  fs.writeFileSync(path.join(REPO, `jeux/geo/drapeaux-us/${e.c}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>\n`);
}
console.log('États', etats.length);
