// Construit jeux/panne/reseau.js (jeu Dichotomie) à partir du simulateur de dialogue des canons et de la sauvegarde de modifications (v5).
// Usage : node outils/panne-reseau.js simulateur-dialogue-canons.html jeux/panne/reseau.js [outils/panne-modif.json]
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const ligne = html.split('\n').find(l => l.startsWith('const NET = '));
const NET = JSON.parse(ligne.slice('const NET = '.length).replace(/;\s*$/, ''));
const o = JSON.parse(fs.readFileSync(process.argv[4] || __dirname + '/panne-modif.json', 'utf8'));
const lat0 = 42.765, K = Math.cos(lat0 * Math.PI / 180) * 111320;
const P = (lon, lat) => [lon * K, -lat * 111320];
const ek = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const isSrc = id => id.startsWith('src/');
function defaultDirs(keys, sources){
  const adj = {}; keys.forEach(k => { const [a, b] = k.split('|'); (adj[a] = adj[a] || []).push(b); (adj[b] = adj[b] || []).push(a); });
  const d = {}, q = []; sources.forEach(s => { d[s] = 0; q.push(s); });
  while(q.length){ const x = q.shift(); for(const y of adj[x] || []) if(d[y] === undefined){ d[y] = d[x] + 1; q.push(y); } }
  const out = {};
  keys.forEach(k => { const [a, b] = k.split('|'), da = d[a], db = d[b]; out[k] = (da === undefined || db === undefined || da === db) ? 'both' : (da < db ? 'ab' : 'ba'); });
  return out;
}
const byId = Object.fromEntries(NET.nodes.map(n => [n.id, n]));
const BE = NET.edges.map(e => ek(e[0], e[1])), BEE = NET.eedges.map(e => ek(e[0], e[1]));
const heads = o.tetes.filter(i => byId[i]);
const edges = new Set(BE), dir = defaultDirs(BE, heads);
const deps = NET.deps.map(d => ({ id:d.id, name:d.name, color:d.color, lon:d.lon, lat:d.lat, feedsRep:false }));
const eedges = new Set(BEE), edir = defaultDirs(BEE, NET.deps.map(d => 'src/' + d.id));
const put = (set, dm, Pp) => { Pp = Pp || {};
  (Pp.moins || []).forEach(k => { if(!set.has(k)) console.warn('moins absent', k); set.delete(k); delete dm[k]; });
  (Pp.plus || []).forEach(([a, b, d]) => { const k = ek(a, b); set.add(k); dm[k] = d || 'both'; });
  Object.entries(Pp.sens || {}).forEach(([k, d]) => { if(set.has(k)) dm[k] = d; else console.warn('sens absent', k); }); };
put(edges, dir, o.liaisons); put(eedges, edir, o.cables);
const r1 = v => Math.round(v * 10) / 10;
const xy = (lon, lat) => { const [x, y] = P(lon, lat); return [r1(x), r1(y)]; };
// origine : le coin haut-gauche des canons
const pts = NET.nodes.map(n => P(n.lon, n.lat)), X0 = Math.min(...pts.map(p => p[0])) - 50, Y0 = Math.min(...pts.map(p => p[1])) - 50;
const loc = (lon, lat) => { const [x, y] = P(lon, lat); return [r1(x - X0), r1(y - Y0)]; };
const geo = g => Object.fromEntries(Object.entries(g || {}).map(([k, v]) => [k, v.map(p => loc(p[0], p[1]))]));
const geom = geo(NET.geom), egeom = geo(NET.egeom);
const out = {
  canons:NET.nodes.map(n => { const [x, y] = loc(n.lon, n.lat); return { id:n.id, nom:n.label, zone:n.folder, x, y, modele:n.model }; }),
  tetes:heads,
  repeteurs:o.repeteurs || [],
  liaisons:[...edges].map(k => { const [a, b] = k.split('|'); return [a, b, dir[k] || 'both', (NET.ecolor[k] || [null, ''])[1]]; }),
  geomLiaisons:Object.fromEntries([...edges].filter(k => geom[k]).map(k => [k, geom[k]])),
  departs:deps.map(d => { const [x, y] = loc(d.lon, d.lat); return { id:d.id, nom:d.name, couleur:d.color, x, y }; }),
  cables:[...eedges].map(k => { const [a, b] = k.split('|'); return [a, b, edir[k] || 'both']; }),
  geomCables:Object.fromEntries([...eedges].filter(k => egeom[k]).map(k => [k, egeom[k]])),
  traces:NET.dia.map(l => l.map(p => loc(p[0], p[1]))),
  abris:NET.shelters.map(s => { const [x, y] = loc(s.lon, s.lat); return { nom:s.name, x, y }; }),
};
fs.writeFileSync(process.argv[3], `/* Altitude Arcade — Recherche de panne : le réseau de dialogue et d'électricité des canons de Superbagnères
   (tiré du simulateur de dialogue des canons, modifications v5 comprises). Positions en mètres (x vers l'est, y vers le sud). */
window.RESEAU_PANNE = ${JSON.stringify(out)};
`);
console.log('canons', out.canons.length, 'liaisons', out.liaisons.length, 'cables', out.cables.length, 'departs', out.departs.length, 'taille', fs.statSync(process.argv[3]).size);
