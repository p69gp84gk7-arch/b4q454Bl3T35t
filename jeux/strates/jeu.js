/* Strates : le jeu, comme Godus. Vous êtes le dieu d'un archipel : du doigt, vous tirez et poussez les couches
   du terrain (en les faisant reculer, vous récoltez ce qu'elles contiennent : terre, pierre, minerais) ;
   vos habitants bâtissent leur village sur vos terrains plats et vous donnent des bulles de foi.
   En plus de Godus : lisser le terrain et tracer des rampes (plans inclinés). */
(() => {
const M = window.Monde, R = window.Rendu;
const { N, H, LH, SEA, K, MATS, ID, idx, dans, VOISINS, clamp } = M;
const qi = v => Math.floor(v + 1e-4);
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
  pioche_bois:   { n:'Pioche en bois', outil:1, cout:{ planches:3 }, lieu:'atelier', d:'Pour garder la pierre, le charbon, le grès, le basalte et la glace des couches que vous poussez.' },
  pioche_pierre: { n:'Pioche en pierre', outil:2, cout:{ pierre:3, planches:2 }, lieu:'atelier', d:'Pour garder aussi le minerai de fer.' },
  pioche_fer:    { n:'Pioche en fer', outil:3, cout:{ lingot_fer:3, planches:2 }, lieu:'atelier', d:'Pour tout garder : or, cristal, obsidienne.' },
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
const FOI_HAB = .9;            // foi par habitant et par seconde (dans les bulles des maisons)
const BULLE_MAX = 30;          // foi au plus dans la bulle d'une maison, par place d'habitant
const Q = K / 2.47;            // les épaisseurs d'eau sont comptées en couches : seuils proportionnels à leur finesse
const NOMS = { ...Object.fromEntries(Object.entries(BATS).map(([k, b]) => [k, b.n])), ...Object.fromEntries(Object.entries(RECETTES).map(([k, r]) => [k, r.n])),
  'ile:sables':'Île des Sables', 'ile:volcan':'Île du Volcan', 'ile:glaces':'Île des Glaces' };

/* ---------- État ---------- */
let S = null, I = null;
let geste = null, pente = 0, construction = false;        // pente : 0 sculpter, 1 lisser, 2 rampe
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
const auBordDeLEau = cases => cases.some(c => { const i = c % N, j = (c / N) | 0; return VOISINS.some(([a, b]) => dans(i + a, j + b) && I.w[idx(i + a, j + b)] > .5); });
function directionEau(cases){
  for(const c of cases){ const i = c % N, j = (c / N) | 0; for(const [a, b] of VOISINS) if(dans(i + a, j + b) && I.w[idx(i + a, j + b)] > .5) return Math.atan2(-b, a); }
  return 0;
}
// Pourquoi on ne peut pas construire ici ('' : c'est possible)
function emplacement(k, i, j){
  const t = BATS[k].t || 1, cases = [];
  for(let b = j; b < j + t; b++) for(let a = i; a < i + t; a++){ if(!dans(a, b)) return 'Hors de l\'île.'; cases.push(idx(a, b)); }
  const h = qi(I.h[cases[0]]);
  if(cases.some(c => qi(I.h[c]) !== h || (I.s[c] && Math.abs(I.h[c] - h - .5) > .5))) return 'Le terrain doit être plat' + (t > 1 ? ` sur ${t} × ${t} cases.` : '.');
  if(h <= SEA) return 'Trop bas : au niveau de la mer.';
  if(cases.some(c => I.w[c] > .1 * Q || I.l[c] > 0)) return 'Il y a de l\'eau ou de la lave.';
  if(cases.some(c => I.occ[c])) return 'Il y a déjà un bâtiment.';
  if(BATS[k].cote && !auBordDeLEau(cases)) return 'Il faut être au bord de l\'eau.';
  return '';
}

/* ---------- Habitants ---------- */
function nouvelHabitant(b, x, z){
  const t = BATS[b.k].t || 1;
  const h = { id:I.prochainId++, x:x ?? b.i + t / 2, z:z ?? b.j + t / 2, y:0, maison:b.id, coul:Math.floor(Math.random() * 8), pause:Math.random() * 2, sans:0 };
  h.y = R.sol(h.x, h.z) * LH;
  I.hab.push(h);
  return h;
}
function marchable(c, depuis, h){
  if(I.w[c] > .7 * Q || I.l[c] > .05 || I.h[c] <= SEA - 1) return false;
  // Une falaise de plus de 2 couches arrête les habitants ; une pente ou une rampe se monte
  if(Math.abs(solCase(c) - solCase(depuis)) > 2.2) return false;
  return !I.occ[c] || I.occ[c] === h.maison;
}
function choisirCible(h){
  const b = h.maison && I.bat.find(x => x.id === h.maison);
  if(b && Math.random() < .3){ h.cible = [b.i, b.j]; return; }
  const ox = b ? b.i : Math.floor(h.x), oz = b ? b.j : Math.floor(h.z);
  for(let k = 0; k < 8; k++){
    const i = clamp(ox + Math.round((Math.random() - .5) * 36), 0, N - 1), j = clamp(oz + Math.round((Math.random() - .5) * 36), 0, N - 1);
    const c = idx(i, j);
    if(I.h[c] > SEA && I.w[c] < .25 * Q && !I.occ[c]){ h.cible = [i, j]; return; }
  }
  h.cible = null;
}
function bougerHabitants(dt){
  for(const h of I.hab){
    const ci = clamp(Math.floor(h.x), 0, N - 1), cj = clamp(Math.floor(h.z), 0, N - 1), c = idx(ci, cj);
    const yc = R.sol(h.x, h.z) * LH + (I.w[c] > .1 * Q ? Math.min(I.w[c], Q) * LH : 0);
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
    const tx = h.pas[0] + .5, tz = h.pas[1] + .5, dx = tx - h.x, dz = tz - h.z, d = Math.hypot(dx, dz), v = dt * 2;
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
    const c = idx(i, j), h = qi(I.h[c]);
    if(h <= SEA || I.w[c] > 0 || I.l[c] > 0 || I.occ[c] || I.s[c]) continue;
    let ok = true;
    for(const [a, b] of VOISINS){ const n = idx(i + a, j + b); if(qi(I.h[n]) !== h || I.s[n] || I.occ[n] || I.w[n] > .05 || I.l[n] > 0){ ok = false; break; } }
    if(!ok) continue;
    let d = Infinity;
    for(const b of ref) d = Math.min(d, Math.hypot(b.i - i, b.j - j));
    if(d > 45) continue;
    d += Math.random() * 1.5;
    if(d < bd){ bd = d; best = c; }
  }
  return best;
}
function seconde(){
  const pop = I.hab.length, cap = capacite(), food = nourriture();
  // Foi : chaque maison remplit sa bulle (à toucher) ; les autres îles prient un peu, sans bulle
  if(!libre()){
    const bf = bonusFoi();
    for(const b of I.bat) if(BATS[b.k].cap) b.foi = Math.min(BATS[b.k].cap * BULLE_MAX, (b.foi || 0) + residents(b) * FOI_HAB * bf);
    S.foi += Object.entries(S.pops).reduce((s, [k, n]) => s + (k === S.active ? 0 : n), 0) * FOI_HAB * .3;
  }
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
    else conseil('place', 'Vos habitants manquent de place : étendez une couche pour faire un grand <b>terrain plat</b>.', 50);
  }
  if(pop >= food && cap >= food) conseil('faim', 'Plus assez de nourriture pour de nouveaux habitants : construisez une <b>Ferme</b>.', 70);
  // Les arbres poussent près des autres arbres
  let arbres = 0;
  for(let k = 0; k < 8; k++){
    const i = 1 + Math.floor(Math.random() * (N - 2)), j = 1 + Math.floor(Math.random() * (N - 2)), c = idx(i, j);
    if(I.arbres[c] || I.occ[c] || I.h[c] <= SEA + 1 || I.w[c] > 0 || I.l[c] > 0) continue;
    const e = M.especePour(I, c);
    if(!e) continue;
    const voisin = VOISINS.some(([a, b]) => I.arbres[idx(i + a, j + b)]);
    if(voisin ? Math.random() < .35 : Math.random() < .03){ I.arbres[c] = e; arbres++; }
  }
  // Dangers : la lave brûle, l'eau noie
  for(let c = 0; c < N * N; c++){
    if(I.arbres[c] && (I.l[c] > .05 || I.w[c] > .6 * Q)){ I.arbres[c] = 0; arbres++; }
  }
  if(arbres) R.majArbres();
  for(const b of I.bat.slice()){
    const cases = casesBat(b);
    if(cases.some(c => I.l[c] > .05)) retirerBat(b, `🔥 La lave a brûlé : ${BATS[b.k].n}.`);
    else if(!BATS[b.k].cote && cases.some(c => I.w[c] > 1.2 * Q)) retirerBat(b, `🌊 L'eau a emporté : ${BATS[b.k].n}.`);
  }
  const avant = I.hab.length;
  I.hab = I.hab.filter(h => { const c = idx(clamp(Math.floor(h.x), 0, N - 1), clamp(Math.floor(h.z), 0, N - 1)); return !(I.l[c] > .05 || I.w[c] > 3.5 * Q); });
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

/* ---------- Modeler le terrain ---------- */
const niveauPioche = () => libre() ? 3 : S.pioche;
const solCase = c => I.s[c] ? I.h[c] : qi(I.h[c]);
function annoncer(ev){
  if(ev.includes('lave')) toast('🔥 Une poche de lave ! Elle se met à couler.', true);
  if(ev.includes('source')) toast('💧 Une source ! L\'eau jaillit.', true);
}
// Change la hauteur d'un point : coûte 1 foi par couche ajoutée ou enlevée ; les couches enlevées vont dans le sac
// (les blocs durs seulement avec la bonne pioche). Renvoie false si ce n'est pas possible.
function changer(c, nv, modele, g){
  if(I.occ[c]){ g.raisons.add('bat'); return false; }
  const dq = Math.abs(qi(nv) - qi(I.h[c]));
  if(dq && !libre() && S.foi < dq){ g.raisons.add('foi'); return false; }
  const r = M.regler(I, c, nv, modele);
  const n = r.retires.length + r.ajoutes;
  if(n){
    if(!libre()) S.foi -= n;
    if(I.arbres[c]){ gagner('bois', BOIS_ARBRE[I.arbres[c]] || 2); I.arbres[c] = 0; g.arbres = true; }
    for(const m of r.retires){
      if(!m || m === ID.lave || m === ID.source) continue;
      if(MATS[m].outil > niveauPioche()){ g.perdus[m] = (g.perdus[m] || 0) + 1; continue; }
      gagner(MATS[m].k); g.recolte[m] = (g.recolte[m] || 0) + 1;
    }
    annoncer(r.ev);
    if(r.ev.length) R.fluides();
  }
  R.majCellule(c);
  g.change = true;
  return true;
}
// Les points autour de (x, z), avec leur distance
function autour(x, z, r){
  const out = [], n = Math.ceil(r) + 2, i0 = Math.floor(x), j0 = Math.floor(z);
  for(let b = -n; b <= n; b++) for(let a = -n; a <= n; a++){
    const i = i0 + a, j = j0 + b;
    if(!dans(i, j)) continue;
    out.push([idx(i, j), Math.hypot(i + .5 - x, j + .5 - z)]);
  }
  return out;
}
// Sculpter, comme dans Godus. La couche saisie (L, et les n - 1 couches dessous) s'étend ou recule jusqu'au doigt :
// la hauteur suit un petit cône autour du doigt, si bien que le bord de la couche passe exactement à la distance r.
function sculpterEn(x, z){
  const g = geste, r = g.r, L = g.L, n = g.n;
  for(const [c, d] of autour(x, z, r)){
    if(d > r + 2) continue;
    const h = I.h[c];
    if(g.mode === 'tirer'){
      if(h >= L || h < L - n) continue;                    // seulement le terrain des n couches juste en dessous
      const v = L + Math.min(.5, (r - d) * .5);
      if(v <= h) continue;
      if(qi(v) > qi(h) || I.s[c]){ I.s[c] = 0; changer(c, v, g.depart, g); }
      else { I.h[c] = v; I.modif.add(c); R.majCellule(c); g.change = true; }
    } else {
      const bas = L - n + 1;                                // la couche qui restera au-dessus est bas - 1
      if(h >= L + 1 || h < bas - .001) continue;
      const v = bas - Math.min(.5, (r - d) * .5);
      if(v >= h) continue;
      if(qi(v) < qi(h) || I.s[c]){ I.s[c] = 0; changer(c, v, c, g); }
      else { I.h[c] = v; I.modif.add(c); R.majCellule(c); g.change = true; }
    }
  }
}
// Lisser : chaque point se rapproche de la moyenne de ses voisins, et devient une pente douce
function lisserEn(x, z){
  const g = geste, r = g.r;
  const prevu = [];
  for(const [c, d] of autour(x, z, r)){
    if(d > r || I.occ[c]) continue;
    const i = c % N, j = (c / N) | 0;
    let s = 0, k = 0;
    for(let b = -1; b <= 1; b++) for(let a = -1; a <= 1; a++) if(dans(i + a, j + b)){ s += I.h[idx(i + a, j + b)]; k++; }
    prevu.push([c, I.h[c] + (s / k - I.h[c]) * .45 * (1 - d / (r + .5))]);
  }
  for(const [c, v] of prevu){ I.s[c] = 1; changer(c, v, c, g); }
}
// Rampe : un plan incliné régulier du point de départ (A) au point d'arrivée (B)
function poserRampe(A, B){
  const g = geste, w = Math.max(1, g.r * .8), dx = B.x - A.x, dz = B.z - A.z, l2 = dx * dx + dz * dz;
  if(l2 < 1) return;
  const i0 = Math.floor(Math.min(A.x, B.x) - w - 2), i1 = Math.ceil(Math.max(A.x, B.x) + w + 2);
  const j0 = Math.floor(Math.min(A.z, B.z) - w - 2), j1 = Math.ceil(Math.max(A.z, B.z) + w + 2);
  const ca = idx(clamp(Math.floor(A.x), 0, N - 1), clamp(Math.floor(A.z), 0, N - 1)), cb = idx(clamp(Math.floor(B.x), 0, N - 1), clamp(Math.floor(B.z), 0, N - 1));
  for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++){
    if(!dans(i, j)) continue;
    const c = idx(i, j), px = i + .5 - A.x, pz = j + .5 - A.z;
    const t = clamp((px * dx + pz * dz) / l2, 0, 1), ex = px - dx * t, ez = pz - dz * t, d = Math.hypot(ex, ez);
    if(d > w + 1.2) continue;
    const v = A.h + (B.h - A.h) * t;
    // sur les bords de la rampe, on rejoint doucement le terrain d'à côté
    const k = d <= w ? 1 : 1 - (d - w) / 1.2;
    I.s[c] = 1;
    changer(c, I.h[c] + (v - I.h[c]) * k, t < .5 ? ca : cb, g);
  }
}
function expliquer(g){
  const r = g.raisons;
  if(r.has('foi')) conseil('foi', '🙏 Plus assez de foi : touchez les bulles au-dessus des maisons.', 6);
  else if(r.has('bat')) conseil('bat', 'On ne peut pas changer le terrain sous un bâtiment.', 6);
  r.clear();
}
// Ce qui a été récolté pendant le geste
function bilanRecolte(g){
  const t = Object.entries(g.recolte).filter(([m]) => +m !== ID.terre && +m !== ID.sable && +m !== ID.neige).map(([m, n]) => `+${n} ${MATS[m].n.toLowerCase()}`);
  if(t.length) toast('⛏️ ' + t.join(' · '));
  const p = Object.keys(g.perdus);
  if(p.length){
    const m = +p[0];
    conseil('perdu' + m, `${MATS[m].n} perdu : il faut une <b>${PIOCHES[MATS[m].outil].toLowerCase()}</b> pour le garder (🔨 Fabriquer).`, 20);
  }
}

/* ---------- Gestes d'un doigt sur le terrain ---------- */
function debutGeste(cell, px, py){
  geste = { cell, x0:cell.x, z0:cell.z, px:cell.x, pz:cell.z, sx:px, sy:py, t0:performance.now(), L:cell.L, n:1, r:R.rayon(),
    depart:cell.c, raisons:new Set(), recolte:{}, perdus:{}, etat:'attente', A:{ x:cell.x, z:cell.z, h:cell.sol } };
  if(construction){ survolConstruire(cell); geste.etat = 'construire'; return; }
  if(pente === 0) R.montrerContour(geste.L, cell.x, cell.z, 9, 1);
  // Doigt immobile : comme dans Godus, on saisit une couche de plus toutes les 0,4 s
  geste.timer = setInterval(() => {
    const g = geste;
    if(!g || g.etat !== 'attente' || pente !== 0) return;
    const t = performance.now() - g.t0;
    const n = Math.min(10, 1 + Math.floor(Math.max(0, t - 450) / 400));
    if(n !== g.n){ g.n = n; R.montrerContour(g.L, g.x0, g.z0, 9, n); if(navigator.vibrate) navigator.vibrate(8); $('aideOutil').textContent = `${n} couches saisies : glissez pour les déplacer`; }
  }, 60);
}
function suiteGeste(cell, px, py){
  const g = geste;
  if(!g) return;
  if(g.etat === 'construire'){ g.cell = cell; survolConstruire(cell); return; }
  if(g.etat === 'attente'){
    if(Math.hypot(px - g.sx, py - g.sy) < 10) return;
    g.etat = 'actif';
    if(pente === 0){
      // Le sens : vers le bas de la pente (ou vers une couche plus basse), on tire ; vers l'intérieur, on pousse
      const d = descente(g.x0, g.z0, g.L - g.n + 1);
      const mx = cell.x - g.x0, mz = cell.z - g.z0;
      g.mode = d ? (mx * d[0] + mz * d[1] > 0 ? 'tirer' : 'pousser') : (qi(I.h[cell.c]) < g.L ? 'tirer' : 'pousser');
    }
  }
  if(pente === 2){ g.B = { x:cell.x, z:cell.z, h:cell.sol }; R.montrerRampe(g.A, g.B, Math.max(1, g.r * .8)); return; }
  // Le long du trajet du doigt, par petits pas
  const d = Math.hypot(cell.x - g.px, cell.z - g.pz), n = Math.max(1, Math.ceil(d / .3));
  for(let k = 1; k <= n; k++){
    const x = g.px + (cell.x - g.px) * k / n, z = g.pz + (cell.z - g.pz) * k / n;
    if(pente === 0) sculpterEn(x, z); else lisserEn(x, z);
  }
  g.px = cell.x; g.pz = cell.z; g.cell = cell;
  if(g.arbres){ R.majArbres(); g.arbres = false; }
  if(pente === 0) R.montrerContour(g.L, cell.x, cell.z, 9, g.n);
  else R.montrerCurseur(cell.x, cell.z, g.r);
  if(g.change){ R.fluides(); majInterface(); g.change = false; }
  expliquer(g);
}
function finGeste(annule){
  const g = geste;
  if(!g) return null;
  clearInterval(g.timer);
  R.montrerContour(); R.montrerRampe(); R.montrerCurseur();
  if(!annule && g.etat === 'actif' && pente === 2 && g.B){
    poserRampe(g.A, g.B);
    if(g.arbres) R.majArbres();
    R.fluides(); majInterface(); expliquer(g);
  }
  if(g.etat === 'actif') bilanRecolte(g);
  geste = null;
  majAideOutil();
  return g;
}
// Direction où le terrain descend sous la couche L, autour du point touché (null au milieu d'un plateau)
function descente(x, z, L){
  let dx = 0, dz = 0;
  const i0 = Math.floor(x), j0 = Math.floor(z);
  for(let b = -2; b <= 2; b++) for(let a = -2; a <= 2; a++){
    const i = i0 + a, j = j0 + b;
    if(!dans(i, j) || I.h[idx(i, j)] >= L) continue;
    const vx = i + .5 - x, vz = j + .5 - z, d = Math.hypot(vx, vz) || 1;
    dx += vx / d / d; dz += vz / d / d;
  }
  const l = Math.hypot(dx, dz);
  return l > .05 ? [dx / l, dz / l] : null;
}

/* ---------- Toucher : une bulle de foi, un bâtiment, un arbre ---------- */
function bullesVisibles(){
  if(libre()) return [];
  return I.bat.filter(b => BATS[b.k].cap && (b.foi || 0) >= 3).map(b => {
    const t = BATS[b.k].t || 1, x = b.i + t / 2, z = b.j + t / 2;
    return { b, x, y:qi(I.h[idx(b.i, b.j)]) * LH, z, n:b.foi };
  });
}
function cueillir(b){
  const n = Math.floor(b.foi || 0);
  if(!n) return;
  S.foi += n; b.foi -= n;
  toast(`🙏 +${n} foi`);
  majInterface();
}
function toucher(px, py){
  // D'abord les bulles (la plus proche du doigt, à l'écran)
  let best = null, bd = 46;
  for(const u of bullesVisibles()){
    const e = R.ecranPoint(u.x, u.y + 1.15 * 1.2, u.z);
    const d = Math.hypot(e.x - px, e.y - py);
    if(e.devant && d < bd){ bd = d; best = u.b; }
  }
  if(best){
    // une bulle touchée : on cueille aussi celles des maisons voisines
    for(const b of I.bat) if(BATS[b.k].cap && b.foi >= 3 && Math.hypot(b.i - best.i, b.j - best.j) < 6 && b !== best) cueillir(b);
    return cueillir(best);
  }
  const cell = R.viser(px, py);
  if(!cell) return;
  const c = cell.c, b = batSur(c);
  if(b) return ouvrirBat(b);
  if(I.arbres[c]){
    const n = BOIS_ARBRE[I.arbres[c]] || 2;
    gagner('bois', n);
    I.arbres[c] = 0;
    R.majArbres(); R.eclats(cell.i, cell.j, ID.planches, 5);
    toast(`🪵 +${n} bois`);
    majInterface();
  }
}

/* ---------- Construire ---------- */
let aConstruire = null, pose = null;
// On choisit le bâtiment, il apparaît au milieu de l'écran ; on le déplace du doigt, puis on confirme
function commencerConstruction(k){
  aConstruire = k;
  fermer();
  construction = true;
  majAideOutil();
  const r = $('vue').getBoundingClientRect();
  const cell = R.viser(r.left + r.width / 2, r.top + r.height * .45) || { i:I.depart.i, j:I.depart.j, c:idx(I.depart.i, I.depart.j) };
  survolConstruire(cell);
}
function survolConstruire(cell){
  if(!aConstruire){ R.montrerFantome(); $('poser').hidden = true; return; }
  const B = BATS[aConstruire], t = B.t || 1;
  pose = { i:clamp(cell.i, 0, N - t), j:clamp(cell.j, 0, N - t) };
  const pb = emplacement(aConstruire, pose.i, pose.j), manque = Object.entries(B.cout).filter(([k, n]) => !libre() && (S.inv[k] || 0) < n);
  R.montrerFantome(t, pose.i, pose.j, !pb && !manque.length);
  $('poser').hidden = false;
  $('poserTxt').innerHTML = `<b>${esc(B.n)}</b>` + (manque.length ? `<small>Il manque ${manque.map(([k, n]) => `${n - (S.inv[k] || 0)} ${esc(OBJETS[k].n.toLowerCase())}`).join(', ')}${manque.some(([k]) => k === 'planches') ? ' (🔨 Fabriquer : du bois en planches)' : ''}</small>`
    : pb ? `<small>${esc(pb)}</small>` : 'Déplacez-le du doigt, puis validez');
  $('poserOk').disabled = !!pb || !!manque.length;
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
  toast(`${BATS[k].n} : construit !`);
  if(k === 'port') toast('⛵ Le port est prêt. Ouvrez l\'<b>Archipel</b> pour voyager.', true);
  annulerConstruction();
  majInterface();
}
function annulerConstruction(){
  construction = false; aConstruire = null; pose = null;
  R.montrerFantome(); $('poser').hidden = true;
  majAideOutil();
}

/* ---------- Interface ---------- */
// Le bouton « Pente » : sculpter (comme Godus) → lisser → rampe → sculpter…
function majBoutonPente(){
  const b = $('bPente');
  b.classList.toggle('actif', pente > 0);
  b.innerHTML = ['<span>⛰️</span>Pente', '<span>〰️</span>Lisser', '<span>📐</span>Rampe'][pente];
  majAideOutil();
}
function majAideOutil(){
  $('aideOutil').textContent = construction ? 'Glissez un doigt pour placer le bâtiment · deux doigts pour bouger la vue'
    : ['Tirez une couche pour l\'étendre, poussez-la pour la réduire · doigt immobile : plusieurs couches',
       'Lisser : frottez du doigt pour adoucir le terrain',
       'Rampe : posez le doigt au départ, glissez jusqu\'à l\'arrivée, relâchez'][pente];
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
  if(!$('pFabriquer').hidden) remplirFabriquer();
  if(!$('pConstruire').hidden) remplirConstruire();
}
// Ne redessine un panneau que si son contenu change (sinon le bouton touché disparaît sous le doigt)
function remplir(id, html){ const el = $(id); if(el.dataset.html !== html){ el.innerHTML = html; el.dataset.html = html; } }
function ouvrir(id){
  document.querySelectorAll('.panneau').forEach(p => { p.hidden = p.id !== id; });
  $('voile').hidden = false;
  ({ pConstruire:remplirConstruire, pFabriquer:remplirFabriquer, pArchipel:remplirArchipel, pPaliers:remplirPaliers }[id] || (() => {}))();
}
function fermer(){ document.querySelectorAll('.panneau').forEach(p => p.hidden = true); $('voile').hidden = true; }
function verrou(k){ const p = palierDe(k); return p >= 0 ? `Palier « ${esc(PALIERS[p].n)} » (${PALIERS[p].pop} habitants)` : ''; }

function remplirConstruire(){
  remplir('lConstruire', A_CONSTRUIRE.map(k => {
    const b = BATS[k], ok = debloque(k), payable = peutPayer(b.cout);
    return `<div class="fiche${ok ? '' : ' verrou'}"><div class="ft"><b>${esc(b.n)}</b>${b.t ? '<small>2 × 2</small>' : ''}</div><p>${esc(b.d)}</p>
      ${ok ? `<div class="couts">${fmtCout(b.cout)}</div><button data-bat="${k}">Placer</button>${payable ? '' : '<p class="lock">Il manque des matériaux (en rouge) : vous pouvez déjà choisir l\'endroit.</p>'}` : `<p class="lock">🔒 ${verrou(k)}</p>`}</div>`;
  }).join(''));
}
function lieuOk(r){ return !r.lieu || libre() || I.bat.some(b => b.k === r.lieu); }
function remplirFabriquer(){
  remplir('lFabriquer', contenuSac() + Object.entries(RECETTES).map(([k, r]) => {
    const ok = debloque(k), deja = r.outil && niveauPioche() >= r.outil, lieu = lieuOk(r), payable = peutPayer(r.cout);
    const donne = r.donne ? Object.entries(r.donne).map(([o, n]) => `${n} ${esc(OBJETS[o].n.toLowerCase())}`).join(', ') : esc(r.n);
    return `<div class="fiche${ok ? '' : ' verrou'}"><div class="ft"><b>${esc(r.n)}</b>${r.lieu ? `<small>${esc(BATS[r.lieu].n)}</small>` : ''}</div>
      <p>${r.d ? esc(r.d) : 'Donne : ' + donne + '.'}</p>
      ${!ok ? `<p class="lock">🔒 ${verrou(k)}</p>` : deja ? '<p class="ok">✔ Vous l\'avez déjà.</p>' : !lieu ? `<p class="lock">Il faut un ${esc(BATS[r.lieu].n.toLowerCase())} sur cette île.</p>` :
      `<div class="couts">${fmtCout(r.cout)}</div><div class="btns"><button data-fab="${k}" data-n="1"${payable ? '' : ' disabled'}>Fabriquer</button>${r.outil ? '' : `<button data-fab="${k}" data-n="10" class="sec"${payable ? '' : ' disabled'}>× 10</button>`}</div>`}</div>`;
  }).join(''));
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
// Le sac, en haut du panneau Fabriquer
function contenuSac(){
  const items = ORDRE_SAC.filter(k => libre() || (S.inv[k] || 0) > 0);
  return `<div class="sac"><p class="outilActuel">🎒 Sac · outil : <b>${esc(PIOCHES[niveauPioche()])}</b></p>` + (items.length ? `<div class="grilleSac">${items.map(k => `<div class="obj"><i style="background:${OBJETS[k].c}"></i><span>${esc(OBJETS[k].n)}</span><b>${libre() ? '∞' : S.inv[k]}</b></div>`).join('')}</div>` : '<p>Le sac est vide : poussez des couches pour récolter terre, pierre et minerais, touchez les arbres pour le bois.</p>') + '</div>';
}
function remplirArchipel(){
  const port = libre() || I.bat.some(b => b.k === 'port');
  remplir('lArchipel', (port ? '' : '<p class="info">⛵ Construisez un <b>Port</b> au bord de l\'eau pour prendre le bateau.</p>') + ILES.map(ile => {
    const ici = ile.k === S.active, connue = S.decouvertes.includes(ile.k), ok = libre() || S.palier >= ile.palier;
    const pop = ici ? I.hab.length : S.pops[ile.k] || 0;
    return `<div class="fiche ile ile-${ile.k}${ok ? '' : ' verrou'}"><div class="ft"><b>${esc(ile.n)}</b>${connue ? `<small>👥 ${pop}</small>` : ''}</div><p>${esc(ile.d)}</p>
      ${ici ? '<p class="ok">📍 Vous êtes ici.</p>' : !ok ? `<p class="lock">🔒 Palier « ${esc(PALIERS[ile.palier].n)} » (${PALIERS[ile.palier].pop} habitants)</p>` :
      `<button data-ile="${ile.k}"${port ? '' : ' disabled'}>${connue ? 'Partir' : 'Découvrir (2 colons partent)'}</button>`}</div>`;
  }).join(''));
}
function remplirPaliers(){
  const pt = popTotale();
  remplir('lPaliers', PALIERS.map((p, k) => `<div class="fiche${k <= S.palier ? ' atteint' : ''}${k === S.palier ? ' actuel' : ''}"><div class="ft"><b>${esc(p.n)}</b><small>${p.pop} habitants</small></div>
    <p>${p.d.map(x => esc(NOMS[x] || x)).join(' · ')}</p>${k === S.palier + 1 ? `<p class="lock">Encore ${p.pop - pt} habitant${p.pop - pt > 1 ? 's' : ''}.</p>` : ''}</div>`).join(''));
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
  if(B.cap) h += `<p>👥 ${residents(b)} / ${B.cap} habitants</p>` + (!libre() && b.foi >= 1 ? `<button data-cueillir="1">🙏 Récolter ${Math.floor(b.foi)} foi</button>` : '');
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
    for(let y = j - 54; y <= j + 54; y++) for(let x = i - 54; x <= i + 54; x++){
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
    foi:900, pioche:0, palier:mode === 'libre' ? PALIERS.length - 1 : 0 };
  installerVillage(M.creerIle('verte', Math.floor(Math.random() * 1e9)), 2, false);
  R.centrer(I.depart.i, I.depart.j);
  R.cam.dist = 60;
  fermer();
  pente = 0; majBoutonPente();
  majInterface();
  sauver();
  if(!localStorage.getItem('strates-aide')){ try{ localStorage.setItem('strates-aide', '1'); }catch(e){} ouvrir('pAide'); }
}
function sauver(){
  if(!S || !I) return;
  try{
    const o = { ...S, v:4, iles:{ ...S.iles, [S.active]:M.serialiser(I) }, pops:{ ...S.pops, [S.active]:I.hab.length }, cam:{ ...R.cam } };
    localStorage.setItem(CLE, JSON.stringify(o));
    localStorage.setItem(CLE_RESUME, JSON.stringify({ mode:S.mode, ile:S.active, pop:popTotale(), palier:S.palier, nomPalier:PALIERS[S.palier].n, iles:S.decouvertes.length, t:Date.now() }));
  }catch(e){ conseil('sauve', 'Sauvegarde impossible (mémoire du téléphone pleine ?).', 120); }
}
function reprendre(){
  let o = null;
  try{ o = JSON.parse(localStorage.getItem(CLE)); }catch(e){}
  if(!o || !o.iles || !o.iles[o.active]) return false;
  if(o.v !== 4){ toast('Strates a changé (terrain continu, comme Godus) : une nouvelle partie commence.', true); return false; }
  S = o;
  I = M.deserialiser(S.iles[S.active]);
  delete S.iles[S.active];
  if(S.foi == null) S.foi = 0;
  refaireOcc();
  R.charger(I);
  if(o.cam) Object.assign(R.cam, o.cam); else R.centrer(I.depart.i, I.depart.j);
  delete S.cam;
  majBoutonPente();
  majInterface();
  return true;
}

/* ---------- Gestes : un doigt pour modeler (ou toucher), deux doigts (et seulement deux) pour la vue ---------- */
function gestes(cv){
  const pts = new Map();
  let mode = null, ref = null;
  const deux = () => { const [a, b] = [...pts.values()]; return { mx:(a.x + b.x) / 2, my:(a.y + b.y) / 2, d:Math.hypot(a.x - b.x, a.y - b.y), a:Math.atan2(b.y - a.y, b.x - a.x) }; };
  cv.addEventListener('pointerdown', e => {
    if(!S) return;
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
    pts.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t0:performance.now() });
    // Souris (sur ordinateur) : clic droit pour tourner, clic du milieu pour se déplacer
    if(e.pointerType === 'mouse' && e.button !== 0){ mode = e.button === 2 ? 'tourne' : 'pan'; return; }
    if(pts.size === 1){
      const cell = R.viser(e.clientX, e.clientY);
      mode = 'doigt';
      if(cell) debutGeste(cell, e.clientX, e.clientY);
    } else if(pts.size === 2){
      if(mode === 'doigt') finGeste(true);
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
        if(construction && cell) survolConstruire(cell);
        else if(cell && pente === 1) R.montrerCurseur(cell.x, cell.z, R.rayon());
      }
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if(mode === 'pan') R.deplacer(dx, dy);
    else if(mode === 'tourne') R.tourner(dx * .008);
    else if(mode === 'doigt' && geste){ const cell = R.viser(e.clientX, e.clientY); if(cell) suiteGeste(cell, e.clientX, e.clientY); }
    else if(mode === 'deux' && pts.size === 2){
      const n = deux();
      R.deplacer(n.mx - ref.mx, n.my - ref.my);
      if(n.d > 10 && ref.d > 10) R.zoomer(ref.d / n.d);
      let da = n.a - ref.a; if(da > Math.PI) da -= 2 * Math.PI; if(da < -Math.PI) da += 2 * Math.PI;
      R.tourner(da);
      ref = n;
    }
  });
  const fin = e => {
    const p = pts.get(e.pointerId);
    if(!p) return;
    pts.delete(e.pointerId);
    if(mode === 'doigt'){
      const g = finGeste(e.type === 'pointercancel');
      // Un toucher bref, sans glisser : une bulle, un bâtiment ou un arbre
      const bref = Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 10 && performance.now() - p.t0 < 400;
      if(bref && (!g || g.etat === 'attente') && !construction) toucher(e.clientX, e.clientY);
    }
    if(!pts.size) mode = null;
    else if(mode === 'deux') mode = 'fini';      // le doigt qui reste ne fait plus rien
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
      if(I.cratere >= 0 && I.eruption && I.eruption.fin > 0) I.l[I.cratere] += 4.4;
      const ch = [];
      if(M.pasLave(I, ch) > .002 || ch.length) R.fluides();
      if(ch.length){ ch.forEach(c => { R.majCellule(c); I.arbres[c] = 0; }); R.majArbres(); }
    }
    if(accSec >= 1){ accSec = 0; seconde(); }
    if(accUI >= .25){ accUI = 0; majInterface(); }
    if(accSauve >= 30){ accSauve = 0; sauver(); }
    bougerHabitants(dt);
    R.rendre(dt, I.hab, temps, bullesVisibles());
  }
  requestAnimationFrame(boucle);
}

/* ---------- Démarrage ---------- */
function brancher(){
  $('bPente').onclick = () => { pente = (pente + 1) % 3; majBoutonPente(); toast(['Sculpter, comme dans Godus', 'Lisser : frottez du doigt pour adoucir le terrain', 'Rampe : glissez du point de départ au point d\'arrivée'][pente]); };
  document.querySelectorAll('#outils [data-panneau], .barre-haut [data-panneau]').forEach(b => b.onclick = () => ouvrir(b.dataset.panneau));
  $('voile').onclick = fermer;
  document.querySelectorAll('.panneau .fermer').forEach(b => b.onclick = fermer);
  $('lConstruire').onclick = e => { const b = e.target.closest('[data-bat]'); if(b) commencerConstruction(b.dataset.bat); };
  $('poserOk').onclick = () => { if(pose) poserBatiment(pose); };
  $('poserNon').onclick = annulerConstruction;
  $('lFabriquer').onclick = e => { const b = e.target.closest('[data-fab]'); if(b) fabriquer(b.dataset.fab, +b.dataset.n); };
  $('lArchipel').onclick = e => { const b = e.target.closest('[data-ile]'); if(b) voyager(b.dataset.ile); };
  $('tBat').onclick = e => {
    const b = batOuvert;
    if(!b) return;
    const a = e.target.closest('[data-ameliorer]'), d = e.target.closest('[data-demolir]'), p = e.target.closest('[data-panneau]');
    if(e.target.closest('[data-cueillir]')){ cueillir(b); ouvrirBat(b); return; }
    if(a){ const k = a.dataset.ameliorer; if(!peutPayer(BATS[k].cout)) return; payer(BATS[k].cout); b.k = k; R.majBatiments(); toast(`${BATS[k].n} : terminée !`); ouvrirBat(b); majInterface(); }
    if(d){ if(!confirm(`Démolir : ${BATS[b.k].n} ?`)) return; for(const [k, n] of Object.entries(BATS[b.k].cout)) gagner(k, Math.floor(n / 2)); retirerBat(b); fermer(); majInterface(); }
    if(p) ouvrir(p.dataset.panneau);
  };
  $('bNouvelle').onclick = () => { if(!S || confirm('Commencer une nouvelle partie ? L\'archipel actuel sera effacé.')) nouvellePartie('partie'); };
  $('bLibre').onclick = () => { if(!S || confirm('Commencer un bac à sable libre ? L\'archipel actuel sera effacé.')) nouvellePartie('libre'); };
  $('aNouvelle').onclick = () => nouvellePartie('partie');
  $('aLibre').onclick = () => nouvellePartie('libre');
  $('bAide').onclick = () => ouvrir('pAide');
  $('camC').onclick = () => { const v = I.bat.find(b => BATS[b.k].cap) || I.depart; R.centrer(v.i, v.j); };
  window.addEventListener('pagehide', sauver);
  document.addEventListener('visibilitychange', () => { if(document.hidden) sauver(); });
}

R.init($('vue'));
brancher();
gestes($('vue'));
if(!reprendre()) ouvrir('pAccueil');
requestAnimationFrame(boucle);
window.Strates = { get S(){ return S; }, get I(){ return I; }, nouvellePartie, voyager, sauver, seconde, BATS, PALIERS, ajouterBat, emplacement, fabriquer, bullesVisibles,
  set pente(v){ pente = v; majBoutonPente(); } };
})();
