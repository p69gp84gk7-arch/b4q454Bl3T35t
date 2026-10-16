/* Strates : le jeu. Vous êtes le dieu d'un archipel : sculptez les couches du terrain, creusez pour trouver
   pierre et minerais, fabriquez des outils et des matériaux, et vos habitants bâtissent leur village sur vos terrains plats. */
(() => {
const M = window.Monde, R = window.Rendu;
const { N, H, LH, SEA, MATS, ID, POSABLES, idx, dans, VOISINS, clamp } = M;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const CLE = 'strates-partie', CLE_RESUME = 'strates-resume';

/* ---------- Contenu du jeu ---------- */
const OBJETS = {
  bois:{ n:'Bois', c:'#8B5A2B' }, lingot_fer:{ n:'Lingots de fer', c:'#CDD2DA' }, lingot_or:{ n:'Lingots d\'or', c:'#F2C94C' },
};
MATS.forEach(m => { if(m && !['roche', 'lave', 'source'].includes(m.k)) OBJETS[m.k] = { n:m.n, c:m.dessus }; });
const ORDRE_SAC = ['bois', 'planches', 'terre', 'sable', 'argile', 'pierre', 'gres', 'basalte', 'neige', 'glace', 'charbon', 'fer', 'or', 'cristal', 'obsidienne',
  'lingot_fer', 'lingot_or', 'verre', 'briques'];
const PIOCHES = ['à la main', 'Pioche en bois', 'Pioche en pierre', 'Pioche en fer'];

const ILES = [
  { k:'verte', n:'Île Verte', d:'Prairies, forêts et collines. Pierre, charbon et fer sous la terre.', palier:0 },
  { k:'sables', n:'Île des Sables', d:'Dunes, palmiers et cactus. Grès, argile et beaucoup d\'or.', palier:3 },
  { k:'volcan', n:'Île du Volcan', d:'Un volcan qui se réveille de temps en temps. Basalte, obsidienne, cristaux… et lave !', palier:5 },
  { k:'glaces', n:'Île des Glaces', d:'Neige, glace et sapins. Beaucoup de cristaux en profondeur.', palier:6 },
];
const PALIERS = [
  { pop:0,  n:'Le premier village', d:['planches', 'cabane', 'atelier', 'ferme'] },
  { pop:6,  n:'Le hameau',          d:['pioche_bois', 'maison', 'four'] },
  { pop:12, n:'Le village',         d:['pioche_pierre', 'lingot_fer', 'verre', 'fontaine'] },
  { pop:20, n:'Le bourg',           d:['port', 'briques', 'statue', 'ile:sables'] },
  { pop:32, n:'La petite ville',    d:['pioche_fer', 'lingot_or', 'villa'] },
  { pop:45, n:'La ville',           d:['temple', 'ile:volcan'] },
  { pop:60, n:'La cité',            d:['phare', 'ile:glaces'] },
];
const RECETTES = {
  planches:      { n:'Planches', donne:{ planches:4 }, cout:{ bois:1 } },
  pioche_bois:   { n:'Pioche en bois', outil:1, cout:{ planches:3 }, lieu:'atelier', d:'Creuse la pierre, le charbon, le grès, le basalte et la glace.' },
  pioche_pierre: { n:'Pioche en pierre', outil:2, cout:{ pierre:3, planches:2 }, lieu:'atelier', d:'Creuse aussi le minerai de fer.' },
  pioche_fer:    { n:'Pioche en fer', outil:3, cout:{ lingot_fer:3, planches:2 }, lieu:'atelier', d:'Creuse tout : or, cristal, obsidienne.' },
  lingot_fer:    { n:'Lingot de fer', donne:{ lingot_fer:1 }, cout:{ fer:1, charbon:1 }, lieu:'four' },
  lingot_or:     { n:'Lingot d\'or', donne:{ lingot_or:1 }, cout:{ or:1, charbon:1 }, lieu:'four' },
  verre:         { n:'Verre', donne:{ verre:2 }, cout:{ sable:2, charbon:1 }, lieu:'four' },
  briques:       { n:'Briques', donne:{ briques:2 }, cout:{ argile:2, charbon:1 }, lieu:'four' },
};
const BATS = {
  cabane:   { n:'Cabane', cap:2, cout:{ planches:3 }, d:'2 habitants. Vos habitants en bâtissent aussi tout seuls sur les terrains plats.' },
  maison:   { n:'Maison', cap:4, cout:{ planches:6, pierre:4 }, depuis:'cabane', d:'Amélioration d\'une cabane : 4 habitants.' },
  villa:    { n:'Villa', cap:8, cout:{ briques:6, verre:4, planches:4 }, depuis:'maison', d:'Amélioration d\'une maison : 8 habitants.' },
  ferme:    { n:'Ferme', t:2, nourrit:6, cout:{ planches:4, terre:4 }, d:'Champs et grange sur 2 × 2 cases plates. Nourrit 6 habitants de plus.' },
  atelier:  { n:'Atelier', cout:{ planches:8 }, d:'Pour fabriquer les pioches.' },
  four:     { n:'Four', cout:{ pierre:10 }, d:'Pour fondre le fer et l\'or, et cuire le verre et les briques.' },
  fontaine: { n:'Fontaine', foi:.05, cout:{ pierre:6, verre:2 }, d:'Les habitants prient 5 % de plus.' },
  port:     { n:'Port', cote:true, cout:{ planches:12, lingot_fer:2 }, d:'Au bord de l\'eau. Le bateau mène aux autres îles de l\'archipel.' },
  statue:   { n:'Statue', foi:.05, cout:{ pierre:8, briques:4 }, d:'5 % de foi en plus.' },
  phare:    { n:'Phare', cote:true, foi:.1, cout:{ pierre:12, verre:4 }, d:'Au bord de l\'eau. 10 % de foi en plus.' },
  temple:   { n:'Temple', t:2, foi:.5, cout:{ pierre:20, lingot_or:4, cristal:2 }, d:'Sur 2 × 2 cases plates. 50 % de foi en plus.' },
};
const A_CONSTRUIRE = ['cabane', 'ferme', 'atelier', 'four', 'fontaine', 'port', 'statue', 'phare', 'temple'];
const BOIS_ARBRE = { 1:3, 2:3, 3:2, 4:1, 5:3 };
const FOI_HAB = .25;           // foi par habitant et par seconde
const NOMS = { ...Object.fromEntries(Object.entries(BATS).map(([k, b]) => [k, b.n])), ...Object.fromEntries(Object.entries(RECETTES).map(([k, r]) => [k, r.n])),
  'ile:sables':'Île des Sables', 'ile:volcan':'Île du Volcan', 'ile:glaces':'Île des Glaces' };

/* ---------- État ---------- */
let S = null, I = null;
let outil = 'main', geste = null, aRotation = 0;
const libre = () => S && S.mode === 'libre';
const debloque = k => libre() || PALIERS.slice(0, S.palier + 1).some(p => p.d.includes(k));
const palierDe = k => PALIERS.findIndex(p => p.d.includes(k));
const qte = k => libre() ? Infinity : (S.inv[k] || 0);
const peutPayer = cout => libre() || Object.entries(cout).every(([k, n]) => (S.inv[k] || 0) >= n);
function payer(cout){ if(libre()) return; for(const [k, n] of Object.entries(cout)) S.inv[k] = (S.inv[k] || 0) - n; }
function gagner(k, n = 1){ if(!libre()) S.inv[k] = (S.inv[k] || 0) + n; }
const fmtCout = cout => Object.entries(cout).map(([k, n]) => `<span class="cout${!libre() && (S.inv[k] || 0) < n ? ' manque' : ''}"><i style="background:${(OBJETS[k] || {}).c || '#999'}"></i>${n} ${esc((OBJETS[k] || {}).n || k)}</span>`).join('') || '<span class="cout">gratuit</span>';

/* ---------- Messages ---------- */
let toastT = 0;
function toast(t, long = false){
  const el = $('toast');
  el.innerHTML = t; el.classList.add('vu');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('vu'), long ? 4200 : 2600);
}
const dejaDit = {};
function conseil(cle, t, delai = 45){
  const now = performance.now() / 1000;
  if(dejaDit[cle] && now - dejaDit[cle] < delai) return;
  dejaDit[cle] = now;
  toast(t, true);
}

/* ---------- Bâtiments ---------- */
function refaireOcc(){
  I.occ = new Int32Array(N * N);
  for(const b of I.bat) for(const c of casesBat(b)) I.occ[c] = b.id;
}
function casesBat(b){ const t = BATS[b.k].t || 1, out = []; for(let j = b.j; j < b.j + t; j++) for(let i = b.i; i < b.i + t; i++) if(dans(i, j)) out.push(idx(i, j)); return out; }
const batSur = c => I.occ[c] ? I.bat.find(b => b.id === I.occ[c]) : null;
function ajouterBat(k, i, j, extra = {}){
  const b = { id:I.prochainId++, k, i, j, ...extra };
  I.bat.push(b);
  for(const c of casesBat(b)) I.arbres[c] = 0;
  refaireOcc();
  R.majBatiments(); R.majArbres();
  return b;
}
function retirerBat(b, raison){
  I.bat = I.bat.filter(x => x !== b);
  for(const h of I.hab) if(h.maison === b.id){ h.maison = null; h.dedans = 0; }
  refaireOcc();
  R.majBatiments();
  if(raison) toast(raison, true);
}
const residents = b => I.hab.filter(h => h.maison === b.id).length;
const capacite = () => I.bat.reduce((s, b) => s + (BATS[b.k].cap || 0), 0);
const nourriture = () => 4 + I.bat.reduce((s, b) => s + (BATS[b.k].nourrit || 0), 0);
const bonusFoi = () => 1 + I.bat.reduce((s, b) => s + (BATS[b.k].foi || 0), 0);
const popTotale = () => Object.entries(S.pops).reduce((s, [k, n]) => s + (k === S.active ? 0 : n), 0) + I.hab.length;
const auBordDeLEau = cases => cases.some(c => { const i = c % N, j = (c / N) | 0; return VOISINS.some(([a, b]) => dans(i + a, j + b) && I.w[idx(i + a, j + b)] > .3); });
function directionEau(cases){
  for(const c of cases){ const i = c % N, j = (c / N) | 0; for(const [a, b] of VOISINS) if(dans(i + a, j + b) && I.w[idx(i + a, j + b)] > .3) return Math.atan2(-b, a); }
  return 0;
}
// Pourquoi on ne peut pas construire ici ('' : c'est possible)
function emplacement(k, i, j){
  const t = BATS[k].t || 1, cases = [];
  for(let b = j; b < j + t; b++) for(let a = i; a < i + t; a++){ if(!dans(a, b)) return 'Hors de l\'île.'; cases.push(idx(a, b)); }
  const h = I.h[cases[0]];
  if(cases.some(c => I.h[c] !== h)) return 'Le terrain doit être plat' + (t > 1 ? ` sur ${t} × ${t} cases.` : '.');
  if(h <= SEA) return 'Trop bas : au niveau de la mer.';
  if(cases.some(c => I.w[c] > .05 || I.l[c] > 0)) return 'Il y a de l\'eau ou de la lave.';
  if(cases.some(c => I.occ[c])) return 'Il y a déjà un bâtiment.';
  if(BATS[k].cote && !auBordDeLEau(cases)) return 'Il faut être au bord de l\'eau.';
  return '';
}

/* ---------- Habitants ---------- */
function nouvelHabitant(b, x, z){
  const t = BATS[b.k].t || 1;
  const h = { id:I.prochainId++, x:x ?? b.i + t / 2, z:z ?? b.j + t / 2, y:0, maison:b.id, coul:Math.floor(Math.random() * 8), pause:Math.random() * 2, sans:0 };
  h.y = I.h[idx(Math.floor(h.x), Math.floor(h.z))] * LH;
  I.hab.push(h);
  return h;
}
function marchable(c, depuis, h){
  if(I.w[c] > .3 || I.l[c] > .02 || I.h[c] <= SEA - 1) return false;
  if(Math.abs(I.h[c] - I.h[depuis]) > 1) return false;
  return !I.occ[c] || I.occ[c] === h.maison;
}
function choisirCible(h){
  const b = h.maison && I.bat.find(x => x.id === h.maison);
  if(b && Math.random() < .3){ h.cible = [b.i, b.j]; return; }
  const ox = b ? b.i : Math.floor(h.x), oz = b ? b.j : Math.floor(h.z);
  for(let k = 0; k < 8; k++){
    const i = clamp(ox + Math.round((Math.random() - .5) * 14), 0, N - 1), j = clamp(oz + Math.round((Math.random() - .5) * 14), 0, N - 1);
    const c = idx(i, j);
    if(I.h[c] > SEA && I.w[c] < .1 && !I.occ[c]){ h.cible = [i, j]; return; }
  }
  h.cible = null;
}
function bougerHabitants(dt){
  for(const h of I.hab){
    const ci = clamp(Math.floor(h.x), 0, N - 1), cj = clamp(Math.floor(h.z), 0, N - 1), c = idx(ci, cj);
    const yc = I.h[c] * LH + (I.w[c] > .05 ? Math.min(I.w[c], .4) * LH : 0);
    h.y = h.y ? h.y + (yc - h.y) * Math.min(1, dt * 10) : yc;
    if(h.dedans > 0){ h.dedans -= dt; continue; }
    if(h.pause > 0){ h.pause -= dt; h.marche = false; continue; }
    if(!h.pas){
      if(!h.cible){ choisirCible(h); if(!h.cible){ h.pause = 1; continue; } h.bloque = 0; }
      const [ti, tj] = h.cible;
      if(ci === ti && cj === tj){
        if(I.occ[c] && I.occ[c] === h.maison) h.dedans = 3 + Math.random() * 6;
        h.cible = null; h.pause = .5 + Math.random() * 2.5; h.marche = false;
        continue;
      }
      const d0 = Math.hypot(ti - ci, tj - cj);
      let best = null, bd = Infinity;
      for(const [a, b] of VOISINS){
        const i = ci + a, j = cj + b;
        if(!dans(i, j) || !marchable(idx(i, j), c, h)) continue;
        const d = Math.hypot(ti - i, tj - j) + Math.random() * .6;
        if(d < bd){ bd = d; best = [i, j]; }
      }
      if(!best || bd > d0 + .6){ if(++h.bloque > 3 || !best){ h.cible = null; h.pause = .4; continue; } }
      h.pas = best;
    }
    const tx = h.pas[0] + .5, tz = h.pas[1] + .5, dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz), v = dt * .95;
    h.marche = true;
    if(d <= v){ h.x = tx; h.z = tz; h.pas = null; }
    else { h.x += dx / d * v; h.z += dz / d * v; h.ang = Math.atan2(dx, dz); }
  }
}

/* ---------- Une seconde de vie de l'île : foi, naissances, constructions, arbres, dangers ---------- */
function placeLibre(){
  // Une case et ses 4 voisines au même niveau, sans bâtiment, au sec, près du village
  const vill = I.bat.filter(b => BATS[b.k].cap);
  const ref = vill.length ? vill : I.bat.length ? I.bat : [{ i:I.depart.i, j:I.depart.j }];
  let best = -1, bd = Infinity;
  for(let j = 1; j < N - 1; j++) for(let i = 1; i < N - 1; i++){
    const c = idx(i, j), h = I.h[c];
    if(h <= SEA || I.w[c] > 0 || I.l[c] > 0 || I.occ[c]) continue;
    let ok = true;
    for(const [a, b] of VOISINS){ const n = idx(i + a, j + b); if(I.h[n] !== h || I.occ[n] || I.w[n] > .05 || I.l[n] > 0){ ok = false; break; } }
    if(!ok) continue;
    let d = Infinity;
    for(const b of ref) d = Math.min(d, Math.hypot(b.i - i, b.j - j));
    if(d > 16) continue;
    d += Math.random() * 1.5;
    if(d < bd){ bd = d; best = c; }
  }
  return best;
}
function seconde(){
  const pop = I.hab.length, cap = capacite(), food = nourriture();
  if(!libre()) S.foi += (pop * bonusFoi() + Object.entries(S.pops).reduce((s, [k, n]) => s + (k === S.active ? 0 : n), 0)) * FOI_HAB;
  // Sans abri : on cherche une place libre dans une maison
  for(const h of I.hab){
    if(h.maison) { h.sans = 0; continue; }
    const b = I.bat.find(b => BATS[b.k].cap && residents(b) < BATS[b.k].cap);
    if(b){ h.maison = b.id; h.sans = 0; continue; }
    h.sans = (h.sans || 0) + 1;
  }
  const partis = I.hab.filter(h => h.sans > 90);
  if(partis.length){ I.hab = I.hab.filter(h => h.sans <= 90); toast('Un habitant sans toit a quitté l\'île.'); }
  // Naissances : il faut de la place et de quoi manger
  I.naissance = (I.naissance || 0) + 1;
  if(I.naissance >= 8 && pop < Math.min(cap, food)){
    const b = I.bat.find(b => BATS[b.k].cap && residents(b) < BATS[b.k].cap);
    if(b){ nouvelHabitant(b); I.naissance = 0; }
  }
  // Cabanes bâties par les habitants
  I.auto = (I.auto || 0) + 1;
  if(pop >= cap && pop < food && I.auto >= 12 && pop > 0){
    const c = placeLibre();
    if(c >= 0){ ajouterBat('cabane', c % N, (c / N) | 0); I.auto = 0; toast('🏠 Vos habitants ont bâti une cabane.'); }
    else conseil('place', 'Vos habitants manquent de place : <b>aplanissez</b> un terrain (une case et ses 4 voisines au même niveau).', 50);
  }
  if(pop >= food && cap >= food) conseil('faim', 'Plus assez de nourriture pour de nouveaux habitants : construisez une <b>Ferme</b>.', 70);
  // Les arbres poussent près des autres arbres
  let arbres = 0;
  for(let k = 0; k < 8; k++){
    const i = 1 + Math.floor(Math.random() * (N - 2)), j = 1 + Math.floor(Math.random() * (N - 2)), c = idx(i, j);
    if(I.arbres[c] || I.occ[c] || I.h[c] <= SEA || I.w[c] > 0 || I.l[c] > 0) continue;
    const e = M.especePour(I, c);
    if(!e) continue;
    const voisin = VOISINS.some(([a, b]) => I.arbres[idx(i + a, j + b)]);
    if(voisin ? Math.random() < .35 : Math.random() < .03){ I.arbres[c] = e; arbres++; }
  }
  // Dangers : la lave brûle, l'eau noie
  for(let c = 0; c < N * N; c++){
    if(I.arbres[c] && (I.l[c] > .05 || I.w[c] > .25)){ I.arbres[c] = 0; arbres++; }
  }
  if(arbres) R.majArbres();
  for(const b of I.bat.slice()){
    const cases = casesBat(b);
    if(cases.some(c => I.l[c] > .05)) retirerBat(b, `🔥 La lave a brûlé : ${BATS[b.k].n}.`);
    else if(!BATS[b.k].cote && cases.some(c => I.w[c] > .5)) retirerBat(b, `🌊 L'eau a emporté : ${BATS[b.k].n}.`);
  }
  const avant = I.hab.length;
  I.hab = I.hab.filter(h => { const c = idx(clamp(Math.floor(h.x), 0, N - 1), clamp(Math.floor(h.z), 0, N - 1)); return !(I.l[c] > .05 || I.w[c] > 1.5); });
  if(I.hab.length < avant) toast(avant - I.hab.length > 1 ? `${avant - I.hab.length} habitants ont péri.` : 'Un habitant a péri.', true);
  // Paliers (sur toute la population de l'archipel)
  const pt = popTotale();
  while(S.palier + 1 < PALIERS.length && pt >= PALIERS[S.palier + 1].pop){ S.palier++; annoncerPalier(S.palier); }
  // Volcan : de temps en temps, une éruption
  if(I.type === 'volcan' && I.cratere >= 0){
    if(!I.eruption){ I.eruption = { prochaine:120 + Math.random() * 120, fin:0 }; }
    const e = I.eruption;
    if(e.fin > 0){ e.fin--; if(e.fin <= 0){ e.prochaine = 150 + Math.random() * 150; toast('Le volcan se calme.'); } }
    else if(--e.prochaine <= 0){ e.fin = 25; toast('🌋 Le volcan entre en éruption ! Détournez la lave avec des murs de terre ou de pierre.', true); }
  }
  I.t++;
}

/* ---------- Sculpter le terrain ---------- */
const niveauPioche = () => libre() ? 3 : S.pioche;
function creuserCase(c, raisons){
  if(I.occ[c]){ raisons.add('bat'); return false; }
  const m = M.dessus(I, c);
  if(!m) return false;
  if(I.h[c] <= 1 || MATS[m].outil === 9){ raisons.add('fond'); return false; }
  if(MATS[m].outil > niveauPioche()){ raisons.add(`outil:${MATS[m].outil}:${m}`); return false; }
  if(!libre() && S.foi < 1){ raisons.add('foi'); return false; }
  if(I.arbres[c]){ gagner('bois', BOIS_ARBRE[I.arbres[c]] || 2); I.arbres[c] = 0; geste && (geste.arbres = true); }
  const r = M.retirer(I, c);
  if(!r) return false;
  if(!libre()) S.foi -= 1;
  gagner(MATS[r.mat].k);
  if(r.ev.includes('lave')) toast('🔥 Une poche de lave ! Elle se met à couler.', true);
  if(r.ev.includes('source')) toast('💧 Une source ! L\'eau jaillit.', true);
  R.majCellule(c); R.fluides();
  R.eclats(c % N, (c / N) | 0, r.mat, 4);
  return true;
}
function remplirCase(c, bloc, raisons){
  if(I.occ[c]){ raisons.add('bat'); return false; }
  if(I.h[c] >= H - 2){ raisons.add('haut'); return false; }
  if(qte(bloc) < 1){ raisons.add('bloc:' + bloc); return false; }
  if(!libre() && S.foi < 1){ raisons.add('foi'); return false; }
  if(I.arbres[c]){ gagner('bois', BOIS_ARBRE[I.arbres[c]] || 2); I.arbres[c] = 0; geste && (geste.arbres = true); }
  M.poser(I, c, ID[bloc]);
  if(!libre()){ S.foi -= 1; S.inv[bloc]--; }
  R.majCellule(c); R.fluides();
  R.eclats(c % N, (c / N) | 0, ID[bloc], 3);
  return true;
}
function expliquer(raisons){
  for(const r of raisons){
    if(r === 'foi') return conseil('foi', '🙏 Plus assez de foi. Vos habitants prient : attendez un peu, ou faites grandir le village.', 6);
    if(r.startsWith('outil:')){ const [, n, m] = r.split(':'); return conseil(r, `Il faut une <b>${PIOCHES[n].toLowerCase()}</b> pour creuser : ${MATS[m].n.toLowerCase()}.`, 6); }
    if(r.startsWith('bloc:')) return conseil(r, `Plus de ${OBJETS[r.slice(5)].n.toLowerCase()} dans le sac. Creusez pour en récolter, ou choisissez un autre bloc.`, 6);
    if(r === 'bat') return conseil(r, 'On ne peut pas changer le terrain sous un bâtiment.', 6);
    if(r === 'fond') return conseil(r, 'Impossible de creuser plus bas : la roche-mère.', 6);
    if(r === 'haut') return conseil(r, 'Hauteur maximale atteinte.', 6);
  }
}
function pinceau(i, j){
  const r = S.pinceau - 1, out = [];
  for(let b = -r; b <= r; b++) for(let a = -r; a <= r; a++) if(a * a + b * b <= r * r + r * .5 && dans(i + a, j + b)) out.push(idx(i + a, j + b));
  return out;
}
function appliquer(){
  const g = geste, cell = g.cell;
  let fait = 0;
  for(const c of pinceau(cell.i, cell.j)){
    const h = I.h[c];
    if(outil === 'creuser'){ if(!g.fait.has(c) && h === g.niveau && creuserCase(c, g.raisons)){ g.fait.add(c); fait++; } }
    else if(outil === 'remblayer'){ if(!g.fait.has(c) && h === g.niveau && remplirCase(c, S.bloc, g.raisons)){ g.fait.add(c); fait++; } }
    else if(outil === 'aplanir'){
      if(h > g.niveau){ if(creuserCase(c, g.raisons)) fait++; }
      else if(h < g.niveau){ if(remplirCase(c, S.bloc, g.raisons)) fait++; }
    }
  }
  if(g.arbres){ R.majArbres(); g.arbres = false; }
  if(!fait) expliquer(g.raisons);
  g.raisons.clear();
  if(fait) majInterface();
  R.montrerCurseur(cell.i, cell.j, S.pinceau - 1);
}
function debutGeste(cell){
  geste = { cell, niveau:I.h[cell.c], fait:new Set(), raisons:new Set() };
  if(outil === 'construire'){ survolConstruire(cell); return; }
  appliquer();
  if(outil === 'aplanir') geste.timer = setInterval(() => geste && appliquer(), 110);
}
function suiteGeste(cell){
  if(!geste) return;
  if(outil === 'construire'){ geste.cell = cell; survolConstruire(cell); return; }
  if(cell.c === geste.cell.c) return;
  geste.cell = cell;
  appliquer();
}
function finGeste(annule){
  if(!geste) return;
  clearInterval(geste.timer);
  if(outil === 'construire' && !annule && geste.cell) poserBatiment(geste.cell);
  geste = null;
}

/* ---------- Toucher avec la main : récolter un arbre, ouvrir un bâtiment ---------- */
function toucher(cell){
  const c = cell.c, b = batSur(c);
  if(b) return ouvrirBat(b);
  if(I.arbres[c]){
    const n = BOIS_ARBRE[I.arbres[c]] || 2;
    gagner('bois', n);
    I.arbres[c] = 0;
    R.majArbres(); R.eclats(cell.i, cell.j, ID.planches, 5);
    toast(`🪵 +${n} bois`);
    majInterface();
    return;
  }
  const m = M.dessus(I, c);
  toast(`${m ? esc(MATS[m].n) : 'Fond'} · couche ${I.h[c]}${I.w[c] > .1 ? ' · sous l\'eau' : ''}${I.l[c] > .05 ? ' · lave !' : ''}`);
}

/* ---------- Construire ---------- */
let aConstruire = null;
function survolConstruire(cell){
  if(!aConstruire){ R.montrerFantome(); return; }
  const t = BATS[aConstruire].t || 1;
  R.montrerFantome(t, cell.i, cell.j, !emplacement(aConstruire, cell.i, cell.j) && peutPayer(BATS[aConstruire].cout));
}
function poserBatiment(cell){
  const k = aConstruire;
  if(!k) return;
  const pb = emplacement(k, cell.i, cell.j);
  if(pb) return toast(pb);
  if(!peutPayer(BATS[k].cout)) return toast(`Il manque des matériaux pour : ${BATS[k].n}.`);
  payer(BATS[k].cout);
  const t = BATS[k].t || 1, cases = [];
  for(let j = cell.j; j < cell.j + t; j++) for(let i = cell.i; i < cell.i + t; i++) cases.push(idx(i, j));
  ajouterBat(k, cell.i, cell.j, BATS[k].cote ? { dir:directionEau(cases) } : {});
  R.montrerFantome();
  toast(`${BATS[k].n} : construit !`);
  if(k === 'port') toast('⛵ Le port est prêt. Ouvrez l\'<b>Archipel</b> pour voyager.', true);
  aConstruire = null;
  choisirOutil('main');
  majInterface();
}

/* ---------- Interface ---------- */
const OUTILS_SCULPTE = ['creuser', 'aplanir', 'remblayer'];
function choisirOutil(k){
  outil = k;
  document.querySelectorAll('#outils [data-outil]').forEach(b => b.classList.toggle('actif', b.dataset.outil === k));
  $('options').hidden = !OUTILS_SCULPTE.includes(k);
  $('choixBloc').hidden = k === 'creuser';
  if(k !== 'construire'){ aConstruire = null; R.montrerFantome(); }
  if(!OUTILS_SCULPTE.includes(k)) R.montrerCurseur();
  $('aideOutil').textContent = {
    main:'Glissez pour bouger la vue · touchez un arbre pour le bois, un bâtiment pour le voir',
    creuser:'Touchez ou glissez : la couche touchée descend d\'un cran · 2 doigts pour bouger la vue',
    aplanir:'Appuyez puis glissez : le terrain se met au niveau de la case touchée',
    remblayer:'Touchez ou glissez : la couche touchée monte d\'un cran avec le bloc choisi',
    construire:aConstruire ? `${BATS[aConstruire].n} : glissez jusqu'à l'endroit voulu et relâchez` : '',
  }[k] || '';
  majOptions();
}
function majOptions(){
  document.querySelectorAll('#pinceaux button').forEach(b => b.classList.toggle('actif', +b.dataset.p === S.pinceau));
  const blocs = POSABLES.filter(k => libre() || (S.inv[k] || 0) > 0 || k === S.bloc);
  $('choixBloc').innerHTML = blocs.map(k => `<button data-bloc="${k}" class="${k === S.bloc ? 'actif' : ''}" title="${esc(OBJETS[k].n)}"><i style="background:${OBJETS[k].c}"></i><span>${esc(OBJETS[k].n)}</span><b>${libre() ? '∞' : S.inv[k] || 0}</b></button>`).join('');
}
function majInterface(){
  if(!S) return;
  $('cFoi').innerHTML = `🙏 <b>${libre() ? '∞' : Math.floor(S.foi)}</b>`;
  const pop = I.hab.length, cap = capacite(), food = nourriture();
  $('cPop').innerHTML = `👥 <b>${pop}</b>/${cap}`;
  $('cFood').innerHTML = `🌾 <b>${food}</b>`;
  $('cFood').classList.toggle('alerte', pop >= food);
  const p = PALIERS[S.palier], suiv = PALIERS[S.palier + 1], pt = popTotale();
  $('cPalier').innerHTML = `<b>${esc(p.n)}</b><i><s style="width:${suiv ? clamp((pt - p.pop) / (suiv.pop - p.pop), 0, 1) * 100 : 100}%"></s></i><small>${suiv ? `${pt} / ${suiv.pop} habitants` : `${pt} habitants`}</small>`;
  $('bIle').textContent = ILES.find(x => x.k === S.active).n;
  $('bRemblai').style.setProperty('--c', OBJETS[S.bloc].c);
  if(!$('pSac').hidden) remplirSac();
  if(!$('pFabriquer').hidden) remplirFabriquer();
  if(!$('pConstruire').hidden) remplirConstruire();
  if(!$('options').hidden) majOptions();
}
function ouvrir(id){
  document.querySelectorAll('.panneau').forEach(p => { p.hidden = p.id !== id; });
  $('voile').hidden = false;
  ({ pConstruire:remplirConstruire, pFabriquer:remplirFabriquer, pSac:remplirSac, pArchipel:remplirArchipel, pPaliers:remplirPaliers }[id] || (() => {}))();
}
function fermer(){ document.querySelectorAll('.panneau').forEach(p => p.hidden = true); $('voile').hidden = true; }
function verrou(k){ const p = palierDe(k); return p >= 0 ? `Palier « ${esc(PALIERS[p].n)} » (${PALIERS[p].pop} habitants)` : ''; }

function remplirConstruire(){
  $('lConstruire').innerHTML = A_CONSTRUIRE.map(k => {
    const b = BATS[k], ok = debloque(k), payable = peutPayer(b.cout);
    return `<div class="fiche${ok ? '' : ' verrou'}"><div class="ft"><b>${esc(b.n)}</b>${b.t ? '<small>2 × 2</small>' : ''}</div><p>${esc(b.d)}</p>
      ${ok ? `<div class="couts">${fmtCout(b.cout)}</div><button data-bat="${k}"${payable ? '' : ' disabled'}>Placer</button>` : `<p class="lock">🔒 ${verrou(k)}</p>`}</div>`;
  }).join('');
}
function lieuOk(r){ return !r.lieu || libre() || I.bat.some(b => b.k === r.lieu); }
function remplirFabriquer(){
  $('lFabriquer').innerHTML = Object.entries(RECETTES).map(([k, r]) => {
    const ok = debloque(k), deja = r.outil && niveauPioche() >= r.outil, lieu = lieuOk(r), payable = peutPayer(r.cout);
    const donne = r.donne ? Object.entries(r.donne).map(([o, n]) => `${n} ${esc(OBJETS[o].n.toLowerCase())}`).join(', ') : esc(r.n);
    return `<div class="fiche${ok ? '' : ' verrou'}"><div class="ft"><b>${esc(r.n)}</b>${r.lieu ? `<small>${esc(BATS[r.lieu].n)}</small>` : ''}</div>
      <p>${r.d ? esc(r.d) : 'Donne : ' + donne + '.'}</p>
      ${!ok ? `<p class="lock">🔒 ${verrou(k)}</p>` : deja ? '<p class="ok">✔ Vous l\'avez déjà.</p>' : !lieu ? `<p class="lock">Il faut un ${esc(BATS[r.lieu].n.toLowerCase())} sur cette île.</p>` :
      `<div class="couts">${fmtCout(r.cout)}</div><div class="btns"><button data-fab="${k}" data-n="1"${payable ? '' : ' disabled'}>Fabriquer</button>${r.outil ? '' : `<button data-fab="${k}" data-n="10" class="sec"${payable ? '' : ' disabled'}>× 10</button>`}</div>`}</div>`;
  }).join('');
}
function fabriquer(k, n){
  const r = RECETTES[k];
  let fait = 0;
  for(let x = 0; x < n && peutPayer(r.cout); x++){
    payer(r.cout);
    if(r.outil) S.pioche = Math.max(S.pioche, r.outil);
    if(r.donne) for(const [o, q] of Object.entries(r.donne)) gagner(o, q);
    fait++;
    if(r.outil) break;
  }
  if(fait) toast(r.outil ? `⛏️ ${r.n} : fabriquée !` : `🔨 ${r.n} × ${fait}`);
  majInterface();
  remplirFabriquer();
}
function remplirSac(){
  const items = ORDRE_SAC.filter(k => libre() || (S.inv[k] || 0) > 0);
  $('lSac').innerHTML = `<p class="outilActuel">Outil : <b>${esc(PIOCHES[niveauPioche()])}</b></p>` + (items.length ? `<div class="grilleSac">${items.map(k => `<div class="obj"><i style="background:${OBJETS[k].c}"></i><span>${esc(OBJETS[k].n)}</span><b>${libre() ? '∞' : S.inv[k]}</b></div>`).join('')}</div>` : '<p>Le sac est vide. Creusez et coupez des arbres !</p>');
}
function remplirArchipel(){
  const port = libre() || I.bat.some(b => b.k === 'port');
  $('lArchipel').innerHTML = (port ? '' : '<p class="info">⛵ Construisez un <b>Port</b> au bord de l\'eau pour prendre le bateau.</p>') + ILES.map(ile => {
    const ici = ile.k === S.active, connue = S.decouvertes.includes(ile.k), ok = libre() || S.palier >= ile.palier;
    const pop = ici ? I.hab.length : S.pops[ile.k] || 0;
    return `<div class="fiche ile ile-${ile.k}${ok ? '' : ' verrou'}"><div class="ft"><b>${esc(ile.n)}</b>${connue ? `<small>👥 ${pop}</small>` : ''}</div><p>${esc(ile.d)}</p>
      ${ici ? '<p class="ok">📍 Vous êtes ici.</p>' : !ok ? `<p class="lock">🔒 Palier « ${esc(PALIERS[ile.palier].n)} » (${PALIERS[ile.palier].pop} habitants)</p>` :
      `<button data-ile="${ile.k}"${port ? '' : ' disabled'}>${connue ? 'Partir' : 'Découvrir (2 colons partent)'}</button>`}</div>`;
  }).join('');
}
function remplirPaliers(){
  const pt = popTotale();
  $('lPaliers').innerHTML = PALIERS.map((p, k) => `<div class="fiche${k <= S.palier ? ' atteint' : ''}${k === S.palier ? ' actuel' : ''}"><div class="ft"><b>${esc(p.n)}</b><small>${p.pop} habitants</small></div>
    <p>${p.d.map(x => esc(NOMS[x] || x)).join(' · ')}</p>${k === S.palier + 1 ? `<p class="lock">Encore ${p.pop - pt} habitant${p.pop - pt > 1 ? 's' : ''}.</p>` : ''}</div>`).join('');
}
function annoncerPalier(k){
  const p = PALIERS[k];
  $('tPalier').innerHTML = `<h2>🎉 ${esc(p.n)}</h2><p>Votre peuple compte ${PALIERS[k].pop} habitants ou plus. Nouveautés :</p><ul>${p.d.map(x => `<li>${esc(NOMS[x] || x)}</li>`).join('')}</ul>`;
  ouvrir('pPalier');
  sauver();
}
let batOuvert = null;
function ouvrirBat(b){
  batOuvert = b;
  const B = BATS[b.k];
  const up = Object.entries(BATS).find(([, x]) => x.depuis === b.k);
  let h = `<h2>${esc(B.n)}</h2><p>${esc(B.d)}</p>`;
  if(B.cap) h += `<p>👥 ${residents(b)} / ${B.cap} habitants</p>`;
  if(up){
    const [k, U] = up;
    h += debloque(k) ? `<div class="fiche"><div class="ft"><b>Améliorer en ${esc(U.n)}</b><small>${U.cap} habitants</small></div><div class="couts">${fmtCout(U.cout)}</div><button data-ameliorer="${k}"${peutPayer(U.cout) ? '' : ' disabled'}>Améliorer</button></div>`
      : `<p class="lock">🔒 ${esc(U.n)} : ${verrou(k)}</p>`;
  }
  if(b.k === 'atelier' || b.k === 'four') h += '<button data-panneau="pFabriquer">🔨 Fabriquer</button>';
  if(b.k === 'port') h += '<button data-panneau="pArchipel">🧭 Archipel</button>';
  h += '<button class="sec danger" data-demolir="1">Démolir (la moitié des matériaux revient)</button>';
  $('tBat').innerHTML = h;
  ouvrir('pBat');
}

/* ---------- Voyages dans l'archipel ---------- */
function installerVillage(ile, colons, port){
  I = ile;
  refaireOcc();
  R.charger(I);
  const { i, j } = I.depart;
  const b = ajouterBat('cabane', i, j);
  if(port){
    let best = null, bd = Infinity;
    for(let y = j - 20; y <= j + 20; y++) for(let x = i - 20; x <= i + 20; x++){
      if(!dans(x, y)) continue;
      if(emplacement('port', x, y)) continue;
      const d = Math.hypot(x - i, y - j);
      if(d < bd){ bd = d; best = [x, y]; }
    }
    if(best) ajouterBat('port', best[0], best[1], { dir:directionEau([idx(best[0], best[1])]) });
  }
  for(let k = 0; k < colons; k++) nouvelHabitant(b, i + .3 + k * .4, j + .5);
}
function voyager(k){
  if(k === S.active) return;
  const ile = ILES.find(x => x.k === k);
  if(!libre() && S.palier < ile.palier) return;
  if(!libre() && !I.bat.some(b => b.k === 'port')) return toast('Construisez d\'abord un Port sur cette île.');
  const nouvelle = !S.iles[k];
  if(nouvelle && !libre() && I.hab.length < 4) return toast('Il faut au moins 4 habitants sur cette île pour envoyer 2 colons.');
  if(nouvelle){
    // Deux colons partent : d'abord ceux qui n'ont pas de maison
    I.hab.sort((a, b) => (a.maison ? 1 : 0) - (b.maison ? 1 : 0));
    I.hab.splice(0, libre() && I.hab.length < 4 ? 0 : 2);
  }
  S.iles[S.active] = M.serialiser(I);
  S.pops[S.active] = I.hab.length;
  S.active = k;
  if(nouvelle){
    installerVillage(M.creerIle(k, Math.floor(Math.random() * 1e9)), 2, true);
    if(!S.decouvertes.includes(k)) S.decouvertes.push(k);
  } else { I = M.deserialiser(S.iles[k]); refaireOcc(); R.charger(I); }
  delete S.iles[k];
  R.centrer(I.depart.i, I.depart.j);
  fermer();
  toast(`⛵ Bienvenue : ${ile.n} !`, true);
  majInterface();
  sauver();
}

/* ---------- Partie : nouvelle, sauvegarde, reprise ---------- */
function nouvellePartie(mode){
  S = { v:1, mode, active:'verte', iles:{}, pops:{}, decouvertes:['verte'], inv:mode === 'libre' ? {} : { bois:6, terre:12 },
    foi:200, pioche:0, palier:mode === 'libre' ? PALIERS.length - 1 : 0, pinceau:2, bloc:'terre' };
  installerVillage(M.creerIle('verte', Math.floor(Math.random() * 1e9)), 2, false);
  R.centrer(I.depart.i, I.depart.j);
  R.cam.dist = 22;
  fermer();
  choisirOutil('main');
  majInterface();
  sauver();
  if(!localStorage.getItem('strates-aide')){ try{ localStorage.setItem('strates-aide', '1'); }catch(e){} ouvrir('pAide'); }
}
function sauver(){
  if(!S || !I) return;
  try{
    const o = { ...S, iles:{ ...S.iles, [S.active]:M.serialiser(I) }, pops:{ ...S.pops, [S.active]:I.hab.length }, cam:{ ...R.cam } };
    localStorage.setItem(CLE, JSON.stringify(o));
    localStorage.setItem(CLE_RESUME, JSON.stringify({ mode:S.mode, ile:S.active, pop:popTotale(), palier:S.palier, nomPalier:PALIERS[S.palier].n, iles:S.decouvertes.length, t:Date.now() }));
  }catch(e){ conseil('sauve', 'Sauvegarde impossible (mémoire du téléphone pleine ?).', 120); }
}
function reprendre(){
  let o = null;
  try{ o = JSON.parse(localStorage.getItem(CLE)); }catch(e){}
  if(!o || !o.iles || !o.iles[o.active]) return false;
  S = o;
  I = M.deserialiser(S.iles[S.active]);
  delete S.iles[S.active];
  S.pinceau = S.pinceau || 2; S.bloc = S.bloc || 'terre';
  if(S.foi == null) S.foi = 0;
  refaireOcc();
  R.charger(I);
  if(o.cam) Object.assign(R.cam, o.cam); else R.centrer(I.depart.i, I.depart.j);
  delete S.cam;
  choisirOutil('main');
  majInterface();
  return true;
}

/* ---------- Gestes : un doigt pour l'outil (ou la vue avec la main), deux doigts pour la vue ---------- */
function gestes(cv){
  const pts = new Map();
  let mode = null, ref = null;
  const deux = () => { const [a, b] = [...pts.values()]; return { mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2, d:Math.hypot(a.x - b.x, a.y - b.y), a:Math.atan2(b.y - a.y, b.x - a.x) }; };
  cv.addEventListener('pointerdown', e => {
    if(!S) return;
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t0:performance.now() });
    if(e.pointerType === 'mouse' && e.button !== 0){ mode = e.button === 2 ? 'tourne' : 'pan'; return; }
    if(pts.size === 1){
      if(outil === 'main'){ mode = 'cam'; return; }
      const cell = R.viser(e.clientX, e.clientY);
      if(cell){ mode = 'outil'; debutGeste(cell); } else mode = 'cam';
    } else if(pts.size === 2){
      if(mode === 'outil') finGeste(true);
      mode = 'deux'; ref = deux();
    }
  });
  cv.addEventListener('pointermove', e => {
    if(!S) return;
    const p = pts.get(e.pointerId);
    if(!p){
      // Souris sans bouton : fantôme du bâtiment ou cercle du pinceau
      if(e.pointerType === 'mouse'){
        const cell = R.viser(e.clientX, e.clientY);
        if(outil === 'construire' && cell) survolConstruire(cell);
        else if(OUTILS_SCULPTE.includes(outil) && cell) R.montrerCurseur(cell.i, cell.j, S.pinceau - 1);
      }
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if(mode === 'cam' || mode === 'pan') R.deplacer(dx, dy);
    else if(mode === 'tourne') R.tourner(-dx * .008, dy * .005);
    else if(mode === 'outil'){ const cell = R.viser(e.clientX, e.clientY); if(cell) suiteGeste(cell); }
    else if(mode === 'deux' && pts.size === 2){
      const n = deux();
      R.deplacer(n.mx - ref.mx, n.my - ref.my);
      if(n.d > 10 && ref.d > 10) R.zoomer(ref.d / n.d);
      let da = n.a - ref.a; if(da > Math.PI) da -= 2 * Math.PI; if(da < -Math.PI) da += 2 * Math.PI;
      R.tourner(-da);
      ref = n;
    }
  });
  const fin = e => {
    const p = pts.get(e.pointerId);
    if(!p) return;
    pts.delete(e.pointerId);
    if(mode === 'outil') finGeste(e.type === 'pointercancel');
    else if(mode === 'cam' && outil === 'main' && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 9 && performance.now() - p.t0 < 450){
      const cell = R.viser(e.clientX, e.clientY);
      if(cell) toucher(cell);
    }
    if(!pts.size) mode = null;
    else if(mode === 'deux') mode = 'fini';
  };
  cv.addEventListener('pointerup', fin);
  cv.addEventListener('pointercancel', fin);
  cv.addEventListener('wheel', e => { e.preventDefault(); R.zoomer(e.deltaY > 0 ? 1.1 : .91); }, { passive:false });
  cv.addEventListener('contextmenu', e => e.preventDefault());
}

/* ---------- Boucle ---------- */
let dernier = performance.now(), accEau = 0, accLave = 0, accSec = 0, accUI = 0, accSauve = 0, temps = 0;
function boucle(now){
  const dt = Math.min(.05, (now - dernier) / 1000);
  dernier = now; temps += dt;
  if(S && I){
    accEau += dt; accLave += dt; accSec += dt; accUI += dt; accSauve += dt;
    if(accEau >= .1){ accEau = 0; if(M.pasEau(I) > .002) R.fluides(); }
    if(accLave >= .3){
      accLave = 0;
      if(I.cratere >= 0 && I.eruption && I.eruption.fin > 0) I.l[I.cratere] += .55;
      const ch = [];
      if(M.pasLave(I, ch) > .002 || ch.length) R.fluides();
      if(ch.length){ ch.forEach(c => { R.majCellule(c); I.arbres[c] = 0; }); R.majArbres(); }
    }
    if(accSec >= 1){ accSec = 0; seconde(); }
    if(accUI >= .25){ accUI = 0; majInterface(); }
    if(accSauve >= 30){ accSauve = 0; sauver(); }
    if(aRotation){ const p = aRotation * Math.min(1, dt * 8); R.tourner(p); aRotation -= p; if(Math.abs(aRotation) < .002) aRotation = 0; }
    bougerHabitants(dt);
    R.rendre(dt, I.hab, temps);
  }
  requestAnimationFrame(boucle);
}

/* ---------- Démarrage ---------- */
function brancher(){
  document.querySelectorAll('#outils [data-outil]').forEach(b => b.onclick = () => choisirOutil(b.dataset.outil));
  document.querySelectorAll('#outils [data-panneau], .barre-haut [data-panneau]').forEach(b => b.onclick = () => ouvrir(b.dataset.panneau));
  $('pinceaux').onclick = e => { const b = e.target.closest('button'); if(b){ S.pinceau = +b.dataset.p; majOptions(); } };
  $('choixBloc').onclick = e => { const b = e.target.closest('button'); if(b){ S.bloc = b.dataset.bloc; majOptions(); majInterface(); } };
  $('voile').onclick = fermer;
  document.querySelectorAll('.panneau .fermer').forEach(b => b.onclick = fermer);
  $('lConstruire').onclick = e => { const b = e.target.closest('[data-bat]'); if(!b) return; aConstruire = b.dataset.bat; fermer(); choisirOutil('construire'); toast(`${BATS[aConstruire].n} : glissez jusqu'à l'endroit voulu et relâchez.`); };
  $('lFabriquer').onclick = e => { const b = e.target.closest('[data-fab]'); if(b) fabriquer(b.dataset.fab, +b.dataset.n); };
  $('lArchipel').onclick = e => { const b = e.target.closest('[data-ile]'); if(b) voyager(b.dataset.ile); };
  $('tBat').onclick = e => {
    const b = batOuvert;
    if(!b) return;
    const a = e.target.closest('[data-ameliorer]'), d = e.target.closest('[data-demolir]'), p = e.target.closest('[data-panneau]');
    if(a){ const k = a.dataset.ameliorer; if(!peutPayer(BATS[k].cout)) return; payer(BATS[k].cout); b.k = k; R.majBatiments(); toast(`${BATS[k].n} : terminée !`); ouvrirBat(b); majInterface(); }
    if(d){ if(!confirm(`Démolir : ${BATS[b.k].n} ?`)) return; for(const [k, n] of Object.entries(BATS[b.k].cout)) gagner(k, Math.floor(n / 2)); retirerBat(b); fermer(); majInterface(); }
    if(p) ouvrir(p.dataset.panneau);
  };
  $('bNouvelle').onclick = () => { if(!S || confirm('Commencer une nouvelle partie ? L\'archipel actuel sera effacé.')) nouvellePartie('partie'); };
  $('bLibre').onclick = () => { if(!S || confirm('Commencer un bac à sable libre ? L\'archipel actuel sera effacé.')) nouvellePartie('libre'); };
  $('aNouvelle').onclick = () => nouvellePartie('partie');
  $('aLibre').onclick = () => nouvellePartie('libre');
  $('bAide').onclick = () => ouvrir('pAide');
  $('camG').onclick = () => { aRotation += Math.PI / 4; };
  $('camD').onclick = () => { aRotation -= Math.PI / 4; };
  $('camP').onclick = () => R.zoomer(.8);
  $('camM').onclick = () => R.zoomer(1.25);
  $('camI').onclick = () => { R.cam.pitch = R.cam.pitch > 1.1 ? .7 : R.cam.pitch > .8 ? 1.3 : .95; };
  $('camC').onclick = () => { const v = I.bat.find(b => BATS[b.k].cap) || I.depart; R.centrer(v.i, v.j); };
  window.addEventListener('pagehide', sauver);
  document.addEventListener('visibilitychange', () => { if(document.hidden) sauver(); });
}

R.init($('vue'));
brancher();
gestes($('vue'));
if(!reprendre()) ouvrir('pAccueil');
requestAnimationFrame(boucle);
window.Strates = { get S(){ return S; }, get I(){ return I; }, nouvellePartie, voyager, sauver, seconde, BATS, PALIERS, choisirOutil, ajouterBat, emplacement, fabriquer };
})();
