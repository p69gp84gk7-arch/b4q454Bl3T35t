/* Olympiades : les menus, les athlètes (pays, tenue), le tutoriel, les compétitions en manches et la boucle du jeu. */
'use strict';

/* ---------- Les pays et l'apparence des athlètes ---------- */
const PAYS = window.OLYMP_PAYS || [['fr', 'France', '#000091', '#ffffff', '#e1000f']];
const PAYS_CODE = new Map(PAYS.map(p => [p[0], p]));
const drapeau = c => `geo/drapeaux/${c}.svg`;
const nomPays = c => (PAYS_CODE.get(c) || [c, c])[1];
const PEAUX = ['#F3D2B5', '#E2B48F', '#C98F63', '#A56B42', '#7A4A2C', '#4E2F1C'];
const CHEVEUX = ['#1E1712', '#3A2A1E', '#6B4428', '#B8863B', '#E4C770', '#A63A1F', '#9AA0A6'];
const COUPES = [['court', 'Court'], ['queue', 'Queue de cheval'], ['chignon', 'Chignon'], ['boucles', 'Boucles'], ['rase', 'Rasé']];
const MODELES = [['debardeur', 'Débardeur et short'], ['maillot', 'Maillot et cuissard'], ['combi', 'Combinaison']];
const CHAUSSURES = ['#F2F2F2', '#1C2433', '#E8434F', '#F2C230', '#2EBE64', '#1F6FE0', '#FF7A1A'];
const PAYS_DEFAUT = ['fr', 'be', 'ch', 'ca'];
const profilDefaut = k => ({ nom:`Joueur ${k + 1}`, pays:PAYS_DEFAUT[k] || 'fr', peau:PEAUX[[1, 3, 0, 2][k] || 1], cheveux:CHEVEUX[[1, 0, 4, 2][k] || 1], coupe:['court', 'queue', 'court', 'chignon'][k] || 'court',
  modele:'debardeur', couleurs:'drapeau', chaussures:CHAUSSURES[[0, 2, 3, 5][k] || 0], num:[7, 23, 11, 42][k] || k + 1 });
// les couleurs du maillot viennent du drapeau : la couleur la plus étendue (pas le blanc), puis les autres
function apparence(p){
  const cols = (PAYS_CODE.get(p.pays) || PAYS[0]).slice(2);
  let c1 = cols.find(c => clarte(c) < .88) || cols[0], autres = cols.filter(c => c !== c1);
  let c2 = autres[0] || '#FFFFFF', c3 = autres[1] || (clarte(c2) > .85 ? (clarte(c1) > .55 ? '#1C2433' : c1) : c2);
  if(p.couleurs === 'inverse' && clarte(c2) < .88){ [c1, c2] = [c2, c1]; }
  if(clarte(c3) > .85 && p.modele !== 'combi') c3 = '#1C2433';
  return { peau:p.peau, cheveux:p.cheveux, coupe:p.coupe, c1, c2, c3, chaussures:p.chaussures, modele:p.modele, num:p.num || 1 };
}

/* ---------- Les réglages et les joueurs (gardés dans le téléphone) ---------- */
const REG = Object.assign({ op:.85, aides:true, tuto:{} }, lire('olymp-reglages', {}));
const ecrireReg = () => ecrire('olymp-reglages', REG);
const cfg = lire('olymp-config', { nb:1, niv:'moyen', qualif:true });
if(!cfg.joueurs) cfg.joueurs = [0, 1, 2, 3].map(k => ({ ...profilDefaut(k), nom:(cfg.noms && cfg.noms[k]) || profilDefaut(k).nom }));
for(let k = 0; k < 4; k++) cfg.joueurs[k] = { ...profilDefaut(k), ...(cfg.joueurs[k] || {}) };
const ecrireCfg = () => ecrire('olymp-config', cfg);
function appliquerOpacite(){ document.documentElement.style.setProperty('--op', REG.op); }

/* ---------- Les commandes (doigts et clavier) ---------- */
function appui(c){
  if(jeu && jeu.demo) return;
  if(c === 'a'){ if(!I.a){ I.a = true; I.aP = true; } $('cA').classList.add('enfonce'); return; }
  I[c] = true; I[c + 'P'] = true; $(c === 'g' ? 'cG' : 'cD').classList.add('enfonce');
  if(I.dernier !== c){ I.taps++; I.dernier = c; I.tTap.push(performance.now()); }
  if(AC && AC.state === 'suspended') AC.resume();
}
function relache(c){
  if(jeu && jeu.demo) return;
  if(c === 'a'){ if(I.a){ I.a = false; I.aR = true; } $('cA').classList.remove('enfonce'); return; }
  I[c] = false; $(c === 'g' ? 'cG' : 'cD').classList.remove('enfonce');
}
for(const [id, c] of [['cG', 'g'], ['cD', 'd'], ['cA', 'a']]){
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(err){} appui(c); });
  for(const t of ['pointerup', 'pointercancel']) b.addEventListener(t, () => relache(c));
  b.addEventListener('contextmenu', e => e.preventDefault());
}
const TOUCHES = { ArrowLeft:'g', KeyA:'g', KeyQ:'g', ArrowRight:'d', KeyD:'d', Space:'a', ArrowUp:'a', Enter:'a' };
addEventListener('keydown', e => { const c = TOUCHES[e.code]; if(c && jeu && !jeu.demo){ e.preventDefault(); if(!e.repeat) appui(c); } if(e.code === 'Escape' || e.code === 'KeyP') pause(); });
addEventListener('keyup', e => { const c = TOUCHES[e.code]; if(c) relache(c); });
// pendant la démonstration, c'est le joueur modèle qui « appuie » (et les boutons s'enfoncent pour le montrer)
let demoAvant = { a:false }, demoFlash = 0, demoCote = 'g';
function appuisDemo(ev, E){
  const b = ev.demo(E) || {}; raz();
  if(b.taps){ I.taps = b.taps; for(let k = 0; k < b.taps; k++){ demoCote = demoCote === 'g' ? 'd' : 'g'; I.dernier = demoCote; I.tTap.push(performance.now()); } demoFlash = .07; }
  I.g = !!b.g || !!b.gP; I.d = !!b.d || !!b.dP; I.gP = !!b.gP; I.dP = !!b.dP;
  const a = !!b.a; I.aP = a && !demoAvant.a; I.aR = !a && demoAvant.a; I.a = a; demoAvant.a = a;
  const flash = demoFlash > 0; demoFlash -= 1 / 60;
  $('cG').classList.toggle('enfonce', I.g || (flash && demoCote === 'g'));
  $('cD').classList.toggle('enfonce', I.d || (flash && demoCote === 'd'));
  $('cA').classList.toggle('enfonce', I.a);
}

/* ---------- Résultats, robots ---------- */
const fmt = (ev, v) => v == null ? 'Faute' : ev.unite === 's' ? virg(v, 2) + ' s' : ev.unite === 'm' ? virg(v, 2) + ' m' : virg(v, 1) + ' pts';
const court = (ev, v) => v === undefined ? '–' : v === null ? 'X' : ev.unite === 'pts' ? virg(v, 1) : virg(v, 2);
const mieux = (ev, a, b) => a != null && (b == null || (ev.sens < 0 ? a < b : a > b));
const qualifie = (ev, v) => v != null && (ev.sens < 0 ? v <= ev.qual : v >= ev.qual);
const NIVEAUX = { facile:{ n:'Facile', k:.3 }, moyen:{ n:'Moyen', k:.62 }, fort:{ n:'Fort', k:.92 } };
// la performance d'un robot : entre le minimum et la très belle performance, selon son niveau, avec un peu de hasard
function perfRobot(ev, niv, bruit = .12){
  const k = clamp(NIVEAUX[niv].k + gauss() * bruit, -.2, 1.12);
  let v = ev.qual + (ev.ref - ev.qual) * k;
  if(ev.essais === 'echelle'){ const n = Math.floor((v - ev.depart) / ev.pas + 1e-6); v = n < 0 ? null : Math.round((ev.depart + n * ev.pas) * 100) / 100; }
  else if(ev.id === 'arc') v = Math.round(clamp(v, 0, 30));
  else v = Math.round(v * 100) / 100;
  return v;
}
// les essais d'un robot : un par manche (parfois une faute aux sauts et aux lancers) ; pour le saut à ski, la moitié du total par saut
function essaisRobot(ev, niv){
  if(ev.essais === 'echelle' || ev.essais === 1) return [perfRobot(ev, niv)];
  return Array.from({ length:ev.essais }, () => {
    if(ev.unite === 'm' && Math.random() < .1) return null;
    const v = perfRobot(ev, niv, .16); return ev.somme ? Math.round(v / ev.essais * 10) / 10 : v;
  });
}
const total = (ev, essais) => ev.somme ? (essais.length ? Math.round(essais.reduce((s, v) => s + (v || 0), 0) * 10) / 10 : null) : essais.reduce((b, v) => mieux(ev, v, b) ? v : b, null);
const NOMS_ROBOTS = ['Robot Éclair', 'Robot Fusée', 'Robot Titan', 'Robot Comète'];
const POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
function robot(k, pris){
  const libres = PAYS.filter(p => !pris.includes(p[0])), p = libres[Math.floor(Math.random() * libres.length)];
  pris.push(p[0]);
  return { nom:NOMS_ROBOTS[k], pays:p[0], peau:PEAUX[Math.floor(Math.random() * PEAUX.length)], cheveux:CHEVEUX[Math.floor(Math.random() * 5)], coupe:COUPES[Math.floor(Math.random() * COUPES.length)][0],
    modele:Math.random() < .5 ? 'debardeur' : 'maillot', couleurs:'drapeau', chaussures:CHAUSSURES[Math.floor(Math.random() * CHAUSSURES.length)], num:10 + Math.floor(Math.random() * 90) };
}

/* ---------- La compétition ----------
   C = { mode:'comp'|'libre', saison, eps:[ids], i, joueurs:[{ nom, profil, app, humain, elim, pts, med:[or, argent, bronze] }], qualif, niv }
   T (une épreuve) = { ev, perf:[par joueur : { essais:[], best, lad }], manche, nManches, humains:[indices], k, barre, vuTuto }
   Manches : chaque joueur fait son essai, puis le suivant ; classement après chaque manche.
   Hauteur et perche : tout le monde à la même barre ; elle monte quand chacun a réussi ou a fait 3 échecs. */
let C = null, T = null, jeu = null;
function commencer(mode, saison, eps){
  const humains = mode === 'libre' ? 1 : cfg.nb, joueurs = [], pris = [];
  for(let k = 0; k < humains; k++){ const p = cfg.joueurs[k]; pris.push(p.pays); joueurs.push({ nom:(p.nom || '').trim() || `Joueur ${k + 1}`, profil:p, app:apparence(p), humain:true, elim:false, pts:0, med:[0, 0, 0] }); }
  for(let k = 0; k < Math.max(mode === 'libre' ? 3 : 0, 4 - humains); k++){ const p = robot(k, pris); joueurs.push({ nom:p.nom, profil:p, app:apparence(p), humain:false, pts:0, med:[0, 0, 0] }); }
  C = { mode, saison, eps, i:0, joueurs, qualif:mode === 'comp' && cfg.qualif, niv:cfg.niv };
  commencerEpreuve();
}
const humainsEnLice = () => C.joueurs.map((j, i) => i).filter(i => C.joueurs[i].humain && !C.joueurs[i].elim);
function commencerEpreuve(){
  const ev = EP[C.eps[C.i]], echelle = ev.essais === 'echelle';
  T = { ev, perf:C.joueurs.map(() => ({ essais:[], best:null, lad:echelle ? { echecs:0, meilleur:null, fini:false, passe:false, hist:[] } : null })),
    manche:1, nManches:echelle ? 0 : ev.essais, humains:humainsEnLice(), k:0, barre:echelle ? ev.depart : 0, vuTuto:new Set() };
  C.joueurs.forEach((j, i) => { if(!j.humain){ const p = T.perf[i]; p.robot = essaisRobot(ev, C.niv); if(echelle) p.best = p.robot[0]; } });
  preparer();
}
// le prochain à jouer (ou null si la manche, ou la hauteur, est finie)
function prochain(){
  if(T.ev.essais === 'echelle'){
    const n = T.humains.length;
    for(let d = 0; d < n; d++){ const i = T.humains[(T.k + d) % n], L = T.perf[i].lad; if(!L.fini && !L.passe){ T.k = (T.k + d) % n; return i; } }
    return null;
  }
  return T.k < T.humains.length ? T.humains[T.k] : null;
}
function preparer(){
  const ji = prochain();
  if(ji === null){ finManche(); return; }
  const ev = T.ev, j = C.joueurs[ji], p = T.perf[ji];
  // le tutoriel est proposé avant la première fois que chaque joueur fait cette épreuve
  if(!T.vuTuto.has(ji) && REG.tuto[ev.id] !== false){ T.vuTuto.add(ji); lancerTuto(ji); return; }
  T.vuTuto.add(ji);
  const plusieurs = C.joueurs.filter(x => x.humain).length > 1;
  $('avEp').textContent = `${C.mode === 'libre' ? 'Épreuve libre' : `Épreuve ${C.i + 1} / ${C.eps.length}`} · ${ev.ico} ${ev.n}`;
  $('avJ').innerHTML = `<img class="drapeau" src="${drapeau(j.profil.pays)}" alt="">${plusieurs ? `À vous, ${esc(j.nom)} !` : esc(j.nom)}`;
  let info = '';
  if(ev.essais === 'echelle') info = `Barre à ${virg(T.barre, 2)} m · essai ${p.lad.echecs + 1} / 3${p.lad.meilleur ? ` · réussi : ${virg(p.lad.meilleur, 2)} m` : ''}`;
  else if(ev.essais > 1) info = `${ev.somme ? 'Saut' : 'Manche'} ${T.manche} / ${ev.essais}${p.best != null ? ` · ${ev.somme ? 'total' : 'meilleur'} : ${fmt(ev, p.best)}` : ''}`;
  else info = 'Un seul essai';
  if(C.qualif) info += ` · minimum : ${fmt(ev, ev.qual)}`;
  $('avInfo').textContent = (T.msg ? T.msg + ' — ' : '') + info; T.msg = '';
  $('avAide').textContent = ev.aide;
  $('bAbandon').textContent = C.mode === 'libre' ? 'Menu' : 'Quitter la compétition';
  $('bPasser').hidden = ev.essais !== 'echelle' || p.lad.echecs > 0;
  cacherTout(); $('eAvant').hidden = false;
}
// lancer l'épreuve : mode 'jeu' (compte), 'demo' (le joueur modèle), 'entrainement' (ne compte pas)
function jouer(mode = 'jeu', ji = prochain()){
  const ev = T.ev, j = C.joueurs[ji], p = T.perf[ji];
  const fant = C.joueurs.map((x, i) => [x, i]).filter(([x]) => !x.humain).slice(0, 3).map(([x, i]) => ({ T:total(ev, T.perf[i].robot) || ev.qual * 1.05, app:x.app }));
  const E = ev.debut({ app:j.app, barre:ev.essais === 'echelle' ? T.barre : 0, fant:ev.sens < 0 ? fant : [] });
  jeu = { ev, E, ji, finT:0, pause:false, dernier:performance.now(), demo:mode === 'demo', entrainement:mode === 'entrainement', conseil:'' };
  raz(); I.dernier = null; I.a = I.g = I.d = false; demoAvant = { a:false }; demoAcc = 0;
  cacherTout(); $('hud').hidden = false; $('commandes').hidden = false; $('commandes').classList.toggle('demo', mode === 'demo');
  for(const id of ['cG', 'cD', 'cA']) $(id).classList.remove('enfonce', 'montre');
  $('hEp').textContent = `${ev.ico} ${ev.n}${mode === 'demo' ? ' · démonstration' : mode === 'entrainement' ? ' · entraînement' : ''}`;
  $('hJ').textContent = mode === 'demo' ? 'Démonstration' : j.nom; $('hDrapeau').src = drapeau(j.profil.pays);
  $('hInfo').textContent = ev.essais === 'echelle' ? virg(T.barre, 2) + ' m' : ev.essais > 1 ? `${T.manche}/${ev.essais}` : '—';
  $('hInfoN').textContent = ev.essais === 'echelle' ? 'Barre' : ev.somme ? 'Saut' : ev.essais > 1 ? 'Manche' : 'Essai';
  $('cAt').textContent = ev.a; $('cA').classList.toggle('cache', ev.a === '—');
  $('cGt').textContent = $('cDt').textContent = ev.lg || 'COURIR';
  if(ev.id === 'slalom'){ $('cGt').textContent = 'ROUGE'; $('cDt').textContent = 'BLEUE'; }
  $('tuto').hidden = mode !== 'demo';
  mesurer(); $('conseil').style.top = '';
  if(AC && AC.state === 'suspended') AC.resume();
}
function finEssai(){
  const ev = T.ev, ji = jeu.ji, E = jeu.E, r = E.res, mode = jeu.demo ? 'demo' : jeu.entrainement ? 'entrainement' : 'jeu';
  jeu = null; $('hud').hidden = true; $('commandes').hidden = true; $('conseil').hidden = true; $('tuto').hidden = true;
  if(mode === 'demo'){ apresTuto(ji, 'demo'); return; }
  if(mode === 'entrainement'){ apresTuto(ji, 'entrainement', r, E); return; }
  const p = T.perf[ji];
  if(ev.essais === 'echelle'){
    const L = p.lad, ok = r != null && r >= T.barre;
    noter(L, ok ? 'O' : 'X');
    if(ok){ L.meilleur = T.barre; L.passe = true; L.echecs = 0; T.msg = `${C.joueurs[ji].nom} : réussi à ${virg(T.barre, 2)} m !`; }
    else { L.echecs++; T.msg = `${C.joueurs[ji].nom} : échec à ${virg(T.barre, 2)} m (${L.echecs} / 3)`; if(L.echecs >= 3) L.fini = true; }
    p.best = L.meilleur; T.k = (T.k + 1) % T.humains.length;
  } else {
    p.essais.push(r); p.best = total(ev, p.essais);
    T.msg = `${C.joueurs[ji].nom} : ${E.msg ? E.msg + ' · ' : ''}${fmt(ev, r)}`;
    T.k++;
  }
  preparer();
}
// les essais à chaque hauteur : O réussi, X échec, – passée
function noter(L, c){ const d = L.hist[L.hist.length - 1]; if(d && d.h === T.barre) d.s += c; else L.hist.push({ h:T.barre, s:c }); }
// hauteur et perche : passer cette hauteur (on garde sa meilleure, on attend la suivante)
function passerHauteur(){ const ji = prochain(); if(ji === null) return; const L = T.perf[ji].lad; if(L.echecs) return;
  noter(L, '–'); L.passe = true; T.msg = `${C.joueurs[ji].nom} passe ${virg(T.barre, 2)} m`; T.k = (T.k + 1) % T.humains.length; preparer(); }
function finManche(){
  const ev = T.ev;
  if(ev.essais === 'echelle'){
    const restent = T.humains.filter(i => !T.perf[i].lad.fini);
    if(!restent.length || T.barre + ev.pas > ev.max + 1e-6){ resultats(); return; }
    afficherInter(`Après ${virg(T.barre, 2)} m`, `La barre monte à ${virg(T.barre + ev.pas, 2)} m`, () => {
      T.barre = Math.round((T.barre + ev.pas) * 100) / 100; for(const i of T.humains) T.perf[i].lad.passe = false; T.k = 0; preparer(); });
    return;
  }
  if(T.manche < T.nManches){
    afficherInter(`Après la ${T.manche === 1 ? '1re' : T.manche + 'e'} manche`, `Manche ${T.manche + 1} / ${T.nManches}`, () => { T.manche++; T.k = 0; preparer(); });
    return;
  }
  resultats();
}
// le classement : les robots ont fait autant de manches que les joueurs ; à la hauteur, ils sont encore en lice tant que la barre est sous leur record
function classement(final){
  const ev = T.ev;
  const lignes = C.joueurs.map((j, i) => {
    const p = T.perf[i]; if(j.humain && !T.humains.includes(i)) return null;
    let v, essais;
    if(ev.essais === 'echelle'){
      if(j.humain){ v = p.lad.meilleur; essais = p.lad.hist.slice(-3).map(x => `${virg(x.h, 2)} ${x.s}`).join(' · ') + (p.lad.fini ? '' : ' · en lice'); }
      else { const b = p.best; v = final ? b : b == null || b < T.barre ? b : Math.round(Math.min(b, T.barre) * 100) / 100; essais = final || (b != null && b < T.barre) || b == null ? '' : 'en lice'; }
    } else {
      const ess = j.humain ? p.essais : p.robot.slice(0, final ? p.robot.length : T.manche);
      v = total(ev, ess); essais = ev.essais > 1 ? ess.map(x => court(ev, x)).join(' · ') : '';
    }
    return { j, i, v, essais };
  }).filter(Boolean);
  return lignes.sort((a, b) => mieux(ev, a.v, b.v) ? -1 : mieux(ev, b.v, a.v) ? 1 : 0);
}
const ligneJoueur = (l, r, extra = '') => `<tr class="${l.j.humain ? 'humain' : ''}"><td>${r < 3 && l.v != null ? `<span class="medaille m${r + 1}">${r + 1}</span>` : `<span class="medaille">${r + 1}</span>`}</td>`
  + `<td><img class="drapeau" src="${drapeau(l.j.profil.pays)}" alt="">${esc(l.j.nom)}${extra}${l.essais ? `<span class="essais">${esc(l.essais)}</span>` : ''}</td><td>${l.v == null ? '—' : fmt(T.ev, l.v)}</td></tr>`;
let interSuite = null;
function afficherInter(titre, bouton, suite){
  const ev = T.ev;
  $('interSous').textContent = `${ev.ico} ${ev.n}${C.mode === 'libre' ? '' : ` · épreuve ${C.i + 1} / ${C.eps.length}`}`;
  $('interTitre').textContent = `Classement ${titre.toLowerCase()}`;
  $('interTable').innerHTML = classement(false).map((l, r) => ligneJoueur(l, r)).join('');
  $('bInterSuite').textContent = bouton + ' ›'; interSuite = suite;
  cacherTout(); $('eInter').hidden = false;
}
function resultats(){
  const ev = T.ev, rec = lire('olymp-records', {}), classes = classement(true);
  let note = '';
  classes.forEach((l, r) => { if(l.v != null){ l.j.pts += POINTS[r] || 0; if(r < 3) l.j.med[r]++; } l.rang = r; });
  for(const l of classes) if(l.j.humain){
    if(l.v != null && (rec[ev.id] == null || mieux(ev, l.v, rec[ev.id].v))){ rec[ev.id] = { v:l.v, nom:l.j.nom, pays:l.j.profil.pays }; note += `🏆 Nouveau record : ${fmt(ev, l.v)} (${l.j.nom}). `; }
    if(C.qualif){ l.q = qualifie(ev, l.v); if(!l.q) l.j.elim = true; }
  }
  ecrire('olymp-records', rec);
  const h = classes.find(l => l.j.humain);
  ecrire('olymp-dernier', { ev:ev.n, saison:ev.saison, ...(h ? { nom:h.j.nom, perf:fmt(ev, h.v), rang:h.rang + 1 } : {}) });
  $('resSous').textContent = C.mode === 'libre' ? 'Épreuve libre' : `Épreuve ${C.i + 1} / ${C.eps.length}`;
  $('resTitre').textContent = `${ev.ico} ${ev.n}`;
  $('resTable').innerHTML = classes.map((l, r) => ligneJoueur(l, r, l.q === true ? ' <span class="qual ok">qualifié</span>' : l.q === false ? ' <span class="qual ko">éliminé</span>' : '')).join('')
    + (rec[ev.id] ? `<tr><td></td><td style="color:var(--doux)">Record : ${esc(rec[ev.id].nom)}</td><td style="color:var(--doux)">${fmt(ev, rec[ev.id].v)}</td></tr>` : '');
  $('resNote').textContent = note + (C.qualif ? `Minimum : ${fmt(ev, ev.qual)}.` : '');
  const resteHumains = C.joueurs.some(j => j.humain && !j.elim), dernier = C.i >= C.eps.length - 1;
  $('bSuite').textContent = C.mode === 'libre' ? '↻ Rejouer' : (!resteHumains || dernier) ? 'Classement final' : 'Épreuve suivante';
  $('bResMenu').textContent = C.mode === 'libre' ? 'Autre épreuve' : 'Menu';
  cacherTout(); $('eRes').hidden = false;
}
function suite(){
  if(C.mode === 'libre'){ commencer('libre', C.saison, C.eps); return; }
  const resteHumains = C.joueurs.some(j => j.humain && !j.elim);
  if(!resteHumains || C.i >= C.eps.length - 1){ classementFinal(); return; }
  C.i++; commencerEpreuve();
}
function classementFinal(){
  const cl = [...C.joueurs].sort((a, b) => b.pts - a.pts || b.med[0] - a.med[0] || b.med[1] - a.med[1]);
  // ex æquo : même rang si mêmes points et mêmes médailles
  const rangs = cl.map((j, r) => r);
  cl.forEach((j, r) => { if(r && j.pts === cl[r - 1].pts && j.med.join() === cl[r - 1].med.join()) rangs[r] = rangs[r - 1]; });
  $('finSous').textContent = `${C.saison === 'ete' ? 'Jeux d\'été' : 'Jeux d\'hiver'} · ${C.i + 1} épreuve${C.i ? 's' : ''}`;
  $('finTable').innerHTML = cl.map((j, i) => { const r = rangs[i]; return `<tr class="${j.humain ? 'humain' : ''}"><td>${r < 3 ? `<span class="medaille m${r + 1}">${r + 1}</span>` : `<span class="medaille">${r + 1}</span>`}</td>`
    + `<td><img class="drapeau" src="${drapeau(j.profil.pays)}" alt="">${esc(j.nom)}${j.elim ? ' <span class="qual ko">éliminé</span>' : ''}<span class="essais">🥇 ${j.med[0]} · 🥈 ${j.med[1]} · 🥉 ${j.med[2]} · ${esc(nomPays(j.profil.pays))}</span></td><td>${j.pts} pts</td></tr>`; }).join('');
  const prem = cl[0]; ecrire('olymp-dernier', { comp:true, saison:C.saison, nom:prem.nom, humain:prem.humain, pts:prem.pts });
  cacherTout(); $('eFin').hidden = false;
}

/* ---------- Le tutoriel : démonstration commentée, puis essai d'entraînement ---------- */
let tutoJ = 0;
function lancerTuto(ji){
  tutoJ = ji; const ev = T.ev;
  $('tutoTitre').textContent = `Comment jouer : ${ev.ico} ${ev.n}`; $('tutoSous').textContent = 'Démonstration — le bouton à utiliser s\'allume en jaune';
  $('tutoEtapes').innerHTML = ev.tuto.map(t => `<li>${esc(t)}</li>`).join('');
  $('tuto').classList.remove('replie');
  jouer('demo', ji);
}
function apresTuto(ji, depuis, r, E){
  const ev = T.ev;
  $('atTitre').textContent = depuis === 'demo' ? `À vous : ${ev.n}` : `Entraînement : ${r == null ? (E && E.msg) || 'faute' : fmt(ev, r)}`;
  $('atTexte').textContent = depuis === 'demo' ? 'Ce qu\'il faut retenir :' : 'Cet essai ne compte pas. Vous pouvez recommencer ou jouer pour de vrai.';
  $('atEtapes').innerHTML = ev.tuto.map(t => `<li>${esc(t)}</li>`).join('');
  $('atPlus').checked = REG.tuto[ev.id] === false;
  $('bAtEssai').textContent = depuis === 'entrainement' ? '↻ Recommencer l\'entraînement' : '🏃 Essai d\'entraînement';
  tutoJ = ji; cacherTout(); $('eApresTuto').hidden = false;
}
$('bTutoPasser').onclick = () => { if(jeu && jeu.demo){ jeu = null; $('hud').hidden = true; $('commandes').hidden = true; $('conseil').hidden = true; $('tuto').hidden = true; preparer(); } };
$('bAtJouer').onclick = () => preparer();
$('bAtEssai').onclick = () => jouer('entrainement', tutoJ);
$('bAtRevoir').onclick = () => lancerTuto(tutoJ);
$('atPlus').onchange = () => { if($('atPlus').checked) REG.tuto[T.ev.id] = false; else delete REG.tuto[T.ev.id]; ecrireReg(); };
$('bDemo').onclick = () => lancerTuto(prochain());
$('bEntrainement').onclick = () => jouer('entrainement', prochain());

// le conseil du moment et le bouton à montrer
function majConseil(){
  const montrer = jeu.demo || jeu.entrainement || REG.aides, c = montrer && !jeu.E.fini && jeu.ev.conseil ? jeu.ev.conseil(jeu.E) : null;
  const el = $('conseil'), t = c ? c.t : '';
  if(t !== jeu.conseil){ jeu.conseil = t; el.textContent = t; el.hidden = !t; el.classList.toggle('fort', !!c && /!$/.test(t) && (c.b === 'a' || c.b === 'aL')); }
  const b = c ? c.b : null;
  $('cG').classList.toggle('montre', b === 'gd' || b === 'g'); $('cD').classList.toggle('montre', b === 'gd' || b === 'd');
  $('cA').classList.toggle('montre', b === 'a' || b === 'aT' || b === 'aL');
  $('cGg').textContent = $('cDg').textContent = b === 'gd' ? 'TAPOTEZ' : 'TENEZ';
  $('cAg').textContent = b === 'aT' ? 'GARDEZ LE DOIGT' : b === 'aL' ? 'LÂCHEZ' : 'APPUYEZ';
  // dans la démonstration : l'étape du tutoriel en cours (en gras)
  if(jeu.demo){ const n = jeu.ev.tuto.length, k = Math.min(n - 1, Math.floor(clamp(jeu.etape || 0, 0, n - 1)));
    if(k !== jeu.etapeVue){ jeu.etapeVue = k; $('tutoEtapes').innerHTML = `<li value="${k + 1}">${esc(jeu.ev.tuto[k])}</li>`; $('tutoSous').textContent = `Démonstration · étape ${k + 1} / ${n} — le bouton à utiliser s'allume en jaune`; } }
  // la bulle se place sous le bandeau du tutoriel (ou sous le haut de l'écran)
  // pendant la démonstration, le haut de la scène est sous le bandeau du tutoriel
  if(jeu.demo) HAUT = $('tuto').getBoundingClientRect().bottom + 8;
  const haut = portrait() ? HAUT + (jeu.ev.bulle || 74) : 0;   // en paysage, la bulle est en bas (au-dessus du bouton rouge)
  if(Math.abs((jeu.hautConseil || 0) - haut) > 1){ jeu.hautConseil = haut; el.style.top = haut + 'px'; }
}

/* ---------- La boucle ---------- */
function boucle(now){
  requestAnimationFrame(boucle);
  TEMPS = now / 1000;
  if(!jeu){ if(!$('eMenu').hidden || !$('eConfig').hidden) decorMenu(TEMPS); if(!$('eAthlete').hidden) dessinApercu(); return; }
  const dt = Math.min(.05, (now - jeu.dernier) / 1000); jeu.dernier = now;
  if(!jeu.pause){
    if(!jeu.E.fini){ if(jeu.demo){ appuisDemo(jeu.ev, jeu.E); jeu.etape = etapeDemo(jeu.ev, jeu.E); } jeu.ev.maj(jeu.E, dt); }
    else { jeu.finT += dt; if(jeu.finT > 1.7){ finEssai(); return; } }
    if(annonceT > 0){ annonceT -= dt; if(annonceT <= 0) $('annonce').style.opacity = 0; }
  }
  raz();
  majConseil();
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  jeu.ev.dessin(jeu.E);
}
// l'étape du tutoriel qui correspond à ce que fait le joueur modèle
function etapeDemo(ev, E){
  const ph = E.phase;
  if(ph === undefined) return E.parti ? (E.plonge === false ? 0 : 1 + (E.x > 20 ? 1 : 0)) : 0;
  const ordre = { elan:0, pousse:0, force:0, tour:0, ski1:0, vise:0, bond:1, plie:1, glisse:2, tir:1, ski2:2, angle:2, vol:2, fin:2, attente:2 };
  return ordre[ph] ?? 0;
}
// le fond du menu : un coureur (votre athlète) qui passe devant les tribunes
function decorMenu(t){
  g.setTransform(DPR, 0, 0, DPR, 0, 0); const s = echelle(); camera(t * 7 + avance(1, s), 0, s); ciel(); tribunes(); piste();
  ombre(t * 7, 0); athlete(t * 7, 0, course(t * 7 * 1.15, 8), apparence(cfg.joueurs[0]));
}
function taille(){ DPR = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth || innerWidth; Hh = cv.clientHeight || innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); FOULE = null; mesurer(); }
// sous le bandeau du haut (mesuré quand il est affiché)
function mesurer(){ const h = $('hud'); if(!h.hidden) HAUT = h.getBoundingClientRect().bottom + 10; else HAUT = (parseFloat(getComputedStyle($('eMenu')).paddingTop) || 16) + 50; }
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille);

/* ---------- L'athlète : pays, tenue, coiffure (avec un aperçu qui court) ---------- */
let athK = 0, athSaison = 'ete', athRetour = 'menu';
const apCv = $('apercu');
function ouvrirAthlete(k, retour){
  athK = k; athRetour = retour; const p = cfg.joueurs[k];
  $('athQui').textContent = cfg.nb > 1 || k ? `Joueur ${k + 1}` : '';
  $('athNom').value = p.nom;
  $('athPays').innerHTML = PAYS.map(c => `<option value="${c[0]}"${c[0] === p.pays ? ' selected' : ''}>${esc(c[1])}</option>`).join('');
  majAthlete(); cacherTout(); $('eAthlete').hidden = false;
}
function majAthlete(){
  const p = cfg.joueurs[athK];
  $('athDrapeau').src = drapeau(p.pays);
  const puces = (id, liste, cle) => { $(id).innerHTML = liste.map(c => `<button data-${cle}="${c}" class="${p[cle] === c ? 'actif' : ''}" style="background:${c}" aria-label="${c}"></button>`).join(''); };
  puces('athPeau', PEAUX, 'peau'); puces('athCheveux', CHEVEUX, 'cheveux'); puces('athChaussures', CHAUSSURES, 'chaussures');
  $('athModele').innerHTML = MODELES.map(([k, n]) => `<button data-modele="${k}" class="${p.modele === k ? 'actif' : ''}">${n}</button>`).join('');
  $('athCoupe').innerHTML = COUPES.map(([k, n]) => `<button data-coupe="${k}" class="${p.coupe === k ? 'actif' : ''}">${n}</button>`).join('');
  $('athCouleurs').innerHTML = [['drapeau', 'Du drapeau'], ['inverse', 'Inversées']].map(([k, n]) => `<button data-couleurs="${k}" class="${p.couleurs === k ? 'actif' : ''}">${n}</button>`).join('');
  $('athSaison').innerHTML = [['ete', '☀️ Été'], ['hiver', '❄️ Hiver']].map(([k, n]) => `<button data-saison="${k}" class="${athSaison === k ? 'actif' : ''}">${n}</button>`).join('');
  $('athNum').value = p.num;
}
$('eAthlete').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return; const p = cfg.joueurs[athK];
  for(const cle of ['peau', 'cheveux', 'chaussures', 'modele', 'coupe', 'couleurs']) if(b.dataset[cle]){ p[cle] = b.dataset[cle]; ecrireCfg(); majAthlete(); return; }
  if(b.dataset.saison){ athSaison = b.dataset.saison; majAthlete(); }
});
$('athPays').onchange = () => { cfg.joueurs[athK].pays = $('athPays').value; ecrireCfg(); majAthlete(); };
$('athNom').oninput = () => { cfg.joueurs[athK].nom = $('athNom').value; ecrireCfg(); };
$('athNum').oninput = () => { cfg.joueurs[athK].num = clamp(parseInt($('athNum').value, 10) || 1, 1, 999); ecrireCfg(); };
const fermerAthlete = () => { if(athRetour === 'config') ouvrirConfig(configSaison, true); else menu(); };
$('bAthRetour').onclick = fermerAthlete; $('bAthOk').onclick = fermerAthlete;
// l'aperçu : on dessine dans le petit canevas, avec les mêmes fonctions que le jeu
function dessinApercu(){
  const w = apCv.clientWidth, h = apCv.clientHeight; if(!w) return;
  if(apCv.width !== Math.round(w * DPR)){ apCv.width = Math.round(w * DPR); apCv.height = Math.round(h * DPR); }
  const sauve = { g, W, Hh, HAUT, V:{ ...V } };
  g = apCv.getContext("2d"); W = w; Hh = h * .85 / .74; HAUT = 0;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, w, h);
  const A = apparence(cfg.joueurs[athK]), s = h / 2.6, t = TEMPS;
  camera(t * 6 + (w * .5 - w * ANCRE()) / s, 0, s);
  if(athSaison === 'ete'){ ciel(); tribunes(); piste(); ombre(t * 6, 0); athlete(t * 6, 0, course(t * 6 * 1.15, 8), A); }
  else { ciel('#5D9FDB', '#DCEBF7'); montagnes(); neige(() => 0); const p = Math.sin(t * 6); skis(t * 6 + p * .3, 0, 0, '#1F6FE0', 1.9); skis(t * 6 - p * .3, 0, 0, '#1F6FE0', 1.9);
    athlete(t * 6, 0, { hanche:.88, torse:.5, tete:-.3, j1:[p * .5, p * .5 - .3], j2:[-p * .5, -p * .5 - .3], b1:[-p * 1.1, -p * 1.1 + .5], b2:[p * 1.1, p * 1.1 + .5] }, tenueHiver(A, 'bonnet')); }
  ({ g, W, Hh, HAUT } = sauve); V = sauve.V;
}

/* ---------- Menus ---------- */
function cacherTout(){ ['eMenu', 'eConfig', 'eAthlete', 'eAvant', 'eApresTuto', 'eInter', 'eRes', 'eFin', 'ePause', 'eAide'].forEach(id => $(id).hidden = true); }
const carteJoueur = (k, avecModif) => { const p = cfg.joueurs[k]; return `<img src="${drapeau(p.pays)}" alt=""><span><b>${esc(p.nom || `Joueur ${k + 1}`)}</b><small>${esc(nomPays(p.pays))} · dossard ${p.num}</small></span>${avecModif ? '<span class="modif">Athlète ›</span>' : ''}`; };
function menu(){
  jeu = null; C = null; $('hud').hidden = true; $('commandes').hidden = true; $('conseil').hidden = true; $('tuto').hidden = true; $('annonce').style.opacity = 0;
  const rec = lire('olymp-records', {});
  const ligne = id => { const ev = EP[id], r = rec[id]; return `<button class="ligne" data-libre="${id}"><span class="ico" style="background:${ev.saison === 'ete' ? '#FFE7C2' : '#DDEBFA'}">${ev.ico}</span><span><b>${esc(ev.n)}</b>${r ? `<small>record ${fmt(ev, r.v)}</small>` : '<small>à faire</small>'}</span></button>`; };
  $('lEte').innerHTML = ETE.map(ligne).join(''); $('lHiver').innerHTML = HIVER.map(ligne).join('');
  $('bMonAthlete').innerHTML = carteJoueur(0, true);
  $('bSon').textContent = son ? '🔊' : '🔇';
  majReglages();
  cacherTout(); $('eMenu').hidden = false;
}
const choixOpacite = () => [[.25, '25 %'], [.5, '50 %'], [.75, '75 %'], [1, '100 %']].map(([v, n]) => `<button data-op="${v}" class="${Math.abs(REG.op - v) < .13 ? 'actif' : ''}">${n}</button>`).join('');
function majReglages(){
  const nbOff = Object.values(REG.tuto).filter(v => v === false).length;
  $('reglages').innerHTML = `<h3 style="margin-top:4px">Opacité des boutons</h3><div class="choix">${choixOpacite()}</div>`
    + `<h3 style="margin-top:12px">Aides pendant l'épreuve (la bulle « que faire »)</h3><div class="choix"><button data-aides="1" class="${REG.aides ? 'actif' : ''}">Oui</button><button data-aides="0" class="${!REG.aides ? 'actif' : ''}">Non</button></div>`
    + `<h3 style="margin-top:12px">Tutoriels</h3><p class="sous" style="font-size:.88rem;margin:0">Proposés avant chaque épreuve${nbOff ? ` (sauf pour ${nbOff} épreuve${nbOff > 1 ? 's' : ''})` : ''}.</p>${nbOff ? '<div class="choix"><button data-tuto="1">Les proposer à nouveau partout</button></div>' : ''}`;
  $('pauseOp').innerHTML = choixOpacite();
}
function reglage(e){
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.op){ REG.op = +b.dataset.op; appliquerOpacite(); }
  else if(b.dataset.aides){ REG.aides = b.dataset.aides === '1'; }
  else if(b.dataset.tuto){ REG.tuto = {}; }
  else return;
  ecrireReg(); majReglages();
}
$('reglages').addEventListener('click', reglage); $('pauseOp').addEventListener('click', reglage);
let configSaison = 'ete', configEps = [];
function ouvrirConfig(saison, garder){
  if(!garder || configSaison !== saison){ configSaison = saison; configEps = [...(saison === 'ete' ? ETE : HIVER)]; }
  $('cfgTitre').textContent = saison === 'ete' ? 'Jeux d\'été' : 'Jeux d\'hiver';
  majConfig(); cacherTout(); $('eConfig').hidden = false;
}
function majConfig(){
  $('cfgNb').innerHTML = [1, 2, 3, 4].map(n => `<button data-nb="${n}" class="${cfg.nb === n ? 'actif' : ''}">${n} joueur${n > 1 ? 's' : ''}</button>`).join('');
  $('cfgJoueurs').innerHTML = Array.from({ length:cfg.nb }, (_, k) => `<button class="joueur" data-ath="${k}">${carteJoueur(k, true)}</button>`).join('');
  $('cfgNiv').innerHTML = Object.entries(NIVEAUX).map(([k, n]) => `<button data-niv="${k}" class="${cfg.niv === k ? 'actif' : ''}">${n.n}</button>`).join('');
  $('cfgQual').innerHTML = `<button data-q="1" class="${cfg.qualif ? 'actif' : ''}">Avec qualifications</button><button data-q="0" class="${!cfg.qualif ? 'actif' : ''}">Sans</button>`;
  $('cfgEp').innerHTML = (configSaison === 'ete' ? ETE : HIVER).map(id => `<button data-ep="${id}" class="${configEps.includes(id) ? 'actif' : ''}">${EP[id].ico} ${esc(EP[id].n)}</button>`).join('');
}
$('eConfig').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.nb) cfg.nb = +b.dataset.nb;
  else if(b.dataset.ath){ ouvrirAthlete(+b.dataset.ath, 'config'); return; }
  else if(b.dataset.niv) cfg.niv = b.dataset.niv;
  else if(b.dataset.q) cfg.qualif = b.dataset.q === '1';
  else if(b.dataset.ep){ const id = b.dataset.ep; configEps = configEps.includes(id) ? configEps.filter(x => x !== id) : (configSaison === 'ete' ? ETE : HIVER).filter(x => configEps.includes(x) || x === id); }
  else return;
  ecrireCfg(); majConfig();
});
$('bCommencer').onclick = () => { if(!configEps.length) return; commencer('comp', configSaison, configEps); };
$('bConfigRetour').onclick = menu;
$('bMonAthlete').onclick = () => ouvrirAthlete(0, 'menu');
$('eMenu').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.comp) ouvrirConfig(b.dataset.comp);
  else if(b.dataset.libre) commencer('libre', EP[b.dataset.libre].saison, [b.dataset.libre]); });
$('bJouer').onclick = () => jouer('jeu');
$('bPasser').onclick = passerHauteur;
$('bAbandon').onclick = () => { if(C && C.mode === 'comp' && !confirm('Quitter la compétition ?')) return; menu(); };
$('bInterSuite').onclick = () => { const f = interSuite; interSuite = null; if(f) f(); };
$('bSuite').onclick = suite;
$('bResMenu').onclick = menu; $('bFinMenu').onclick = menu;
function pause(){ if(!jeu || jeu.E.fini) return; if(jeu.demo){ $('bTutoPasser').click(); return; } jeu.pause = true; majReglages(); $('ePause').hidden = false; }
$('bPause').onclick = pause;
$('bReprendre').onclick = () => { if(!jeu) return; jeu.pause = false; jeu.dernier = performance.now(); $('ePause').hidden = true; };
$('bRecommencerEssai').onclick = () => { if(!jeu) return; const mode = jeu.entrainement ? 'entrainement' : 'jeu', ji = jeu.ji; $('ePause').hidden = true; jouer(mode, ji); };
$('bQuitter').onclick = () => { jeu = null; menu(); };
$('bAide').onclick = () => { cacherTout(); $('eAide').hidden = false; };
$('bAideRetour').onclick = menu;
$('bSon').onclick = () => { son = !son; ecrire('olymp-son', son); $('bSon').textContent = son ? '🔊' : '🔇'; };
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });

appliquerOpacite(); taille(); menu(); requestAnimationFrame(boucle);

/* ---------- Pour les essais automatiques : jouer une épreuve sans dessin ----------
   bot(E, t) renvoie { taps, g, d, a } pour chaque image (1/60 s) ; renvoie le résultat. bot = 'demo' : le joueur modèle de la démonstration. */
window.Olymp = { EP, ETE, HIVER, PAYS, perfRobot, apparence, get C(){ return C; }, get T(){ return T; }, get jeu(){ return jeu; }, cfg, REG,
  simuler(id, bot, ctx = {}){
    const ev = EP[id], E = ev.debut({ app:APP_DEFAUT, barre:ctx.barre || ev.depart || 0, fant:[] }); let t = 0, aAvant = false;
    if(bot === 'demo') bot = E2 => ev.demo(E2);
    window.OLYMP_MUET = true;
    for(let n = 0; n < 60 * 240 && !E.fini; n++){
      const b = bot(E, t) || {}; raz(); I.taps = b.taps || 0; I.g = !!b.g || !!b.gP; I.d = !!b.d || !!b.dP; I.gP = !!b.gP; I.dP = !!b.dP;
      if(I.taps){ I.dernier = I.dernier === 'g' ? 'd' : 'g'; }
      const a = !!b.a; I.aP = a && !aAvant; I.aR = !a && aAvant; I.a = a; aAvant = a;
      ev.maj(E, 1 / 60); t += 1 / 60;
    }
    window.OLYMP_MUET = false; raz(); I.a = false; return { res:E.res, E };
  } };
