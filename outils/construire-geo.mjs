/* Construit les données du jeu de géographie : jeux/geo/monde.js et jeux/geo/drapeaux/.
   Usage (dans un dossier de travail) :
     npm install world-atlas topojson-client d3-geo world-countries flag-icons
     cp chemin/vers/le/depot/outils/construire-geo.mjs . && node construire-geo.mjs chemin/vers/le/depot
   Sources : Natural Earth via world-atlas (domaine public), mledoze/countries via world-countries (ODbL),
   drapeaux flag-icons (MIT), noms français fournis par Intl (CLDR). */
import fs from 'fs';
import path from 'path';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoArea } from 'd3-geo';

const REPO = process.argv[2] || '.';
const W = 1000;
const wc = JSON.parse(fs.readFileSync('node_modules/world-countries/countries.json'));
const topo = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json'));
const feats = new Map(feature(topo, topo.objects.countries).features.map(f => [f.id, f]));
const names = new Intl.DisplayNames(['fr'], { type:'region' });
const RENAME = { VA:'Vatican', PS:'Palestine', CD:'RD Congo', CG:'Congo' };

const zoneOf = c => c.region === 'Africa' ? 'afrique'
  : c.region === 'Europe' ? 'europe'
  : c.region === 'Asia' ? 'asie'
  : c.region === 'Oceania' ? 'oceanie'
  : c.subregion === 'South America' ? 'amsud' : 'amnord';

// Projection : l'antiméridien passe à 169° O pour garder les îles du Pacifique du côté de l'Océanie
const proj = geoNaturalEarth1().rotate([-11, 0]);
proj.fitWidth(W, { type:'Sphere' });
const pathGen = geoPath(proj).digits(1);
const sphereBounds = geoPath(proj).bounds({ type:'Sphere' });
const H = Math.ceil(sphereBounds[1][1]);

// Plus grand morceau d'un pays : c'est là qu'on pose le repère des petits pays
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

const countries = [];
for(const c of wc.filter(c => c.unMember || ['VA','PS'].includes(c.cca2))){
  const f = feats.get(c.ccn3);
  const code = c.cca2.toLowerCase();
  const entry = { c:code, n:RENAME[c.cca2] || names.of(c.cca2), z:zoneOf(c) };
  if(f){
    entry.d = pathGen(f);
    const [cx, cy] = pathGen.centroid(mainPart(f));
    entry.x = Math.round(cx * 10) / 10; entry.y = Math.round(cy * 10) / 10;
    entry.a = Math.round(pathGen.area(f) * 10) / 10;
  } else {
    // Absent de la carte (Tuvalu) : un simple repère à sa position
    const [x, y] = proj([c.latlng[1], c.latlng[0]]);
    Object.assign(entry, { d:'', x:Math.round(x * 10) / 10, y:Math.round(y * 10) / 10, a:0 });
  }
  countries.push(entry);
  fs.copyFileSync(`node_modules/flag-icons/flags/4x3/${code}.svg`, path.join(REPO, `jeux/geo/drapeaux/${code}.svg`));
}
countries.sort((a, b) => a.n.localeCompare(b.n, 'fr'));

// Terres hors liste (Groenland, Sahara occidental, Antarctique…) : fond de carte non cliquable
const used = new Set(wc.filter(c => c.unMember || ['VA','PS'].includes(c.cca2)).map(c => c.ccn3));
const others = [...feats.values()].filter(f => !used.has(f.id)).map(f => pathGen(f)).filter(Boolean).join('');

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

const out = `/* Données générées par outils/construire-geo.mjs — ne pas modifier à la main. */\nwindow.GEO = ${JSON.stringify({ w:W, h:H, zones, countries, others })};\n`;
fs.writeFileSync(path.join(REPO, 'jeux/geo/monde.js'), out);
console.log('pays', countries.length, '| monde.js', (out.length / 1024).toFixed(0), 'Ko | H', H);
