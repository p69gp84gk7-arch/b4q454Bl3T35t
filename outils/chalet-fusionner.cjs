// Range les mesures de outils/chalet-calibrer.cjs (calib-*.json) dans jeux/chalet/niveaux.js (la ligne « const CALIB = [...] »).
const fs = require('fs'), path = require('path');
const mesures = {}; for(const f of fs.readdirSync(__dirname)) if(/^calib-\d+\.json$/.test(f)) Object.assign(mesures, JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8')));
const liste = []; for(let L = 1; L <= 60; L++){ if(!mesures[L]) throw new Error('niveau ' + L + ' non calibré'); liste.push(mesures[L]); }
const p = path.join(__dirname, '../jeux/chalet/niveaux.js'); let s = fs.readFileSync(p, 'utf8');
s = s.replace(/const CALIB = \[[^\n]*\];/, 'const CALIB = ' + JSON.stringify(liste).replace(/\],\[/g, '],\n    [') + ';');
fs.writeFileSync(p, s); console.log('CALIB écrit :', liste.length, 'niveaux');
