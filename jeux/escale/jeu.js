/* Escale : la boucle de jeu, les commandes (toucher, pincer, tourner) et les panneaux : planning, compagnies, sol,
   terminal, hangar, aéroports. La simulation est dans escale/monde.js, la 3D dans escale/scene.js. */
(() => {
'use strict';
const M = window.ESCALE_MONDE, S3 = window.ESCALE_3D, C = window.ESCALE_CONTROLE;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const euros = n => `${n < 0 ? '−' : ''}${Math.round(Math.abs(n)).toLocaleString('fr-FR')} €`;
const court = n => Math.abs(n) >= 1e6 ? `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits:2 })} M€` : euros(n);
const hm = M.hm;
const SEC_PAR_MIN = 1.5;                      // à vitesse normale, une minute de jeu dure 1,5 seconde
const COULEUR = c => M.COMPAGNIES[c].c1;

let P = M.migrer(lire('escale-partie', null)), A = null, vitesse = 1, panneau = null, sousOnglet = {}, selVol = null, enJeu = false;
const A_ = () => P.aeroports[P.actuel];

/* ---------- Sauvegarde ---------- */
function sauver(){
  if(!P) return;
  ecrire('escale-partie', P);
  ecrire('escale-records', { ...M.resume(P), dernier:Date.now() });
}
setInterval(() => { if(enJeu) sauver(); }, 10000);
addEventListener('visibilitychange', () => { if(document.hidden) sauver(); });
addEventListener('pagehide', sauver);

/* ---------- L'accueil ---------- */
function accueil(){
  enJeu = false; montrerJeu(false);
  $('eAccueil').hidden = false; $('eAide').hidden = true;
  if(P){
    const r = M.resume(P), Aa = A_();
    $('aReprise').innerHTML = `<h2>Ta partie</h2><p class="sous">${M.AEROPORTS[P.actuel].ico} <b>${M.AEROPORTS[P.actuel].nom}</b> · jour ${M.jourDe(Aa.t)} · niveau ${r.niveau}<br>${r.vols} vols, ${r.pax.toLocaleString('fr-FR')} passagers · ${court(P.argent)}</p>`;
    $('aReprise').hidden = false; $('bJouer').textContent = '✈️ Continuer'; $('bNouvelle').hidden = false;
  } else { $('aReprise').hidden = true; $('bJouer').textContent = '✈️ Commencer à Col-Blanc'; $('bNouvelle').hidden = true; }
}
$('bJouer').onclick = () => { if(!P){ P = M.nouvellePartie(); sauver(); } jouer(); };
$('bNouvelle').onclick = () => { if(!confirm('Recommencer une nouvelle partie ? La partie en cours sera perdue.')) return; P = M.nouvellePartie(); sauver(); jouer(); };
$('bAide').onclick = () => { $('eAide').hidden = false; $('eAccueil').hidden = true; };
$('bAideRetour').onclick = () => { $('eAide').hidden = true; if(enJeu) return; $('eAccueil').hidden = false; };
function montrerJeu(v){ for(const id of ['hud', 'onglets', 'cam', 'xp']) $(id).hidden = !v; if(!v){ $('panneau').hidden = true; $('carteVol').hidden = true; $('objectif').hidden = true; } }

/* ---------- Jouer ---------- */
function jouer(){
  A = A_();
  $('eAccueil').hidden = true; $('eAide').hidden = true;
  enJeu = true; montrerJeu(true);
  if(!S3.init($('cv3d'))){ $('chargement').textContent = 'La 3D n\'est pas disponible sur cet appareil.'; }
  else { $('chargement').hidden = true; taille(); S3.centrer(A); }
  vitesse = 1; majVitesse(); selVol = null; $('carteVol').hidden = true;
  fermerPanneau(); majHud(true);
}
function changerAeroport(id){ sauver(); P.actuel = id; A = A_(); S3.centrer(A); selVol = null; $('carteVol').hidden = true; majHud(true); ouvrir('aeroports'); }
function taille(){ const w = innerWidth, h = innerHeight; S3.taille(w, h); C.taille(w, h); }
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille);

/* ---------- La boucle ---------- */
let avant = performance.now(), cumul = 0, tHud = 0, tPanneau = 0, tObj = 0;
function boucle(now){
  requestAnimationFrame(boucle);
  const dt = Math.min(.1, (now - avant) / 1000); avant = now;
  if(!enJeu || !A) return;
  if(C.actif){ C.maj(dt); return; }                 // un mini-jeu de contrôle est ouvert : l'aéroport est en pause
  // la simulation, par petits pas
  let mins = dt * vitesse / SEC_PAR_MIN;
  while(mins > 1e-6){ const d = Math.min(.25, mins); M.pas(P, A, d); mins -= d; }
  S3.maj(A, P, dt); S3.rendu();
  tHud += dt; tPanneau += dt; tObj += dt;
  if(tHud > .2){ tHud = 0; majHud(); toasts(); if(selVol) majCarteVol(); }
  if(tObj > 1){ tObj = 0; M.verifierObjectifs(P, A); majObjectif(); }
  if(tPanneau > 1 && panneau && PANNEAUX_VIVANTS.includes(panneau)){ tPanneau = 0; rafraichirPanneau(); }
}
requestAnimationFrame(boucle);

/* ---------- La barre du haut ---------- */
const METEO = { beau:'☀️', nuages:'⛅', neige:'❄️' };
function majHud(){
  const D = M.AEROPORTS[A.id], t = A.t, mn = M.minuteDe(t), nuit = mn < 360 || mn > 1230;
  $('hNom').textContent = `${D.ico} ${D.nom}`;
  $('hHeure').textContent = `J${M.jourDe(t)} ${hm(t)} ${nuit ? '🌙' : METEO[A.meteo]} 😊${Math.round(A.reputation)}%`;
  const b = $('hArgent'); b.textContent = court(P.argent); b.classList.toggle('neg', P.argent < 0);
  const niv = M.niveauDe(P.xp), x0 = M.xpNiveau(niv), x1 = M.xpNiveau(niv + 1);
  $('hNiv').textContent = `⭐ Niveau ${niv}`;
  $('xpBarre').style.width = `${clamp((P.xp - x0) / (x1 - x0), 0, 1) * 100}%`;
  // les pastilles : récompenses à recevoir, contrats à programmer, offres
  const pastille = (p, n) => { const b = document.querySelector(`.onglets [data-p="${p}"]`); let s = b.querySelector('.pastille'); if(n > 0){ if(!s){ s = document.createElement('span'); s.className = 'pastille'; b.append(s); } s.textContent = n; } else if(s) s.remove(); };
  pastille('planning', A.contrats.filter(c => c.porte == null).length);
  pastille('compagnies', M.aRecevoir(P) + A.offres.length);
}
function majVitesse(){ [...$('hVit').children].forEach(b => b.classList.toggle('actif', +b.dataset.v === vitesse)); }
$('hVit').onclick = e => { const b = e.target.closest('button'); if(!b) return; vitesse = +b.dataset.v; majVitesse(); };
$('bMenu').onclick = () => ouvrir('menu');
let toastsVus = [];
function toasts(){
  if(!A.toasts.length) return;
  const box = $('toasts');
  // à grande vitesse, on ne montre que les messages importants
  const l = A.toasts.splice(0).filter(x => vitesse < 12 || x.type === 'cadeau' || x.type === 'jour');
  for(const x of l.slice(-2)){
    const d = document.createElement('div'); d.className = 'toast ' + (x.type || ''); d.textContent = x.txt; box.prepend(d);
    setTimeout(() => d.remove(), x.type === 'jour' || x.type === 'cadeau' ? 6000 : 3500);
  }
  while(box.children.length > 3) box.lastChild.remove();
}
function majObjectif(){
  const o = M.OBJECTIFS.find(x => !P.objectifs.includes(x.id)), el = $('objectif');
  if(!o || selVol || (panneau && innerWidth < innerHeight)){ el.hidden = true; return; }
  el.hidden = false; el.innerHTML = `🎯 <b>Objectif</b> : ${esc(o.txt)} · +${court(o.gain)}`;
}
$('objectif').onclick = () => ouvrir('menu');

/* ---------- Toucher, glisser, pincer, tourner ---------- */
const doigts = new Map(); let geste = null;
const cv = $('cv3d');
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); doigts.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t0:performance.now() }); if(doigts.size === 2) geste = etat2(); });
cv.addEventListener('pointermove', e => {
  const d = doigts.get(e.pointerId); if(!d || C.actif) return;
  const px = d.x, py = d.y; d.x = e.clientX; d.y = e.clientY;
  if(doigts.size === 1) S3.deplacer(d.x - px, d.y - py);
  else if(doigts.size === 2 && geste){ const g = etat2(); S3.zoomer(geste.dist / Math.max(20, g.dist)); S3.tourner(g.ang - geste.ang); geste = g; }
});
const lacher = e => {
  const d = doigts.get(e.pointerId); doigts.delete(e.pointerId);
  if(doigts.size < 2) geste = null;
  if(d && doigts.size === 0 && Math.hypot(d.x - d.x0, d.y - d.y0) < 8 && performance.now() - d.t0 < 400) toucher(d.x, d.y);
};
cv.addEventListener('pointerup', lacher); cv.addEventListener('pointercancel', e => { doigts.delete(e.pointerId); geste = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); if(C.actif) return; S3.zoomer(e.deltaY > 0 ? 1.12 : 1 / 1.12); }, { passive:false });
function etat2(){ const [a, b] = [...doigts.values()]; return { dist:Math.hypot(a.x - b.x, a.y - b.y), ang:Math.atan2(b.y - a.y, b.x - a.x) }; }
function toucher(x, y){
  if(C.actif){ C.toucher(x, y); return; }
  const id = S3.choisir(x, y); if(id){ selVol = id; S3.suivre(id); majCarteVol(); majObjectif(); return; }
  const m = S3.choisirModule(x, y, A);
  if(m && CONTROLES.includes(m.type)){ lancerControle(m.type); return; }
  if(selVol) fermerCarteVol();
}
/* ---------- Les mini-jeux de contrôle (passeports, rayons X, douane) : l'aéroport se met en pause ---------- */
const CONTROLES = ['passeports', 'securite', 'douane'];
function lancerControle(type){
  fermerPanneau(); if(selVol) fermerCarteVol(); sauver();
  montrerJeu(false);
  if(!C.ouvrir(type, () => { montrerJeu(true); majHud(); majObjectif(); avant = performance.now(); })) montrerJeu(true);
}
$('cPlus').onclick = () => S3.zoomer(1 / 1.35); $('cMoins').onclick = () => S3.zoomer(1.35); $('cTourne').onclick = () => S3.tourner(Math.PI / 4); $('cCentre').onclick = () => { S3.centrer(A); };
addEventListener('keydown', e => { if(!enJeu || C.actif) return; if(e.key === ' '){ vitesse = vitesse ? 0 : 1; majVitesse(); e.preventDefault(); } });

/* ---------- La carte de l'avion choisi ---------- */
const ETATS = { prevu:'Pas encore là', approche:'🛬 En approche', atterrissage:'🛬 Atterrissage', roulageArr:'🛞 Roule vers sa porte', attentePoste:'⏳ Attend que sa porte se libère', escale:'🔧 Escale à la porte',
  repousse:'↩️ Repoussage', roulageDep:'🛞 Roule vers la piste', attentePiste:'⏳ Attend la piste', decollage:'🛫 Décollage', parti:'✈️ Parti' };
function fermerCarteVol(){ selVol = null; S3.suivre(null); $('carteVol').hidden = true; $('toasts').hidden = false; majObjectif(); }
function majCarteVol(){
  const v = A.vols.find(x => x.id === selVol), el = $('carteVol');
  if(!v || v.etat === 'parti'){ fermerCarteVol(); return; }
  const C = M.COMPAGNIES[v.comp], AV = M.AVIONS[v.avion], g = A.portes[v.porte];
  const retardArr = Math.round(v.tArrReel - v.tArr);
  let corps = `<div class="etat">${ETATS[v.etat]} · porte ${g.nom}${g.passerelle ? ' 🌉' : ''}</div>
    <div>Arrivée ${hm(v.tArr)}${retardArr > 4 ? ` <b style="color:var(--rouge)">(+${retardArr} min)</b>` : ''} · départ ${hm(v.tDep)} vers ${esc(v.ville)}</div>
    <div>${Math.round(v.paxArr)} passagers à l'arrivée · ${Math.round(v.paxDep)} au départ</div>`;
  if(v.etat === 'escale' && v.taches){
    corps += Object.entries(v.taches).map(([k, x]) => {
      const T = M.TACHES[k], pc = clamp(x.fait / x.total, 0, 1);
      let st = '';
      if(x.etat === 'fini') st = 'Terminé';
      else if(x.etat === 'encours') st = k === 'embarquement' && v.airside < 1 ? 'Attend les passagers' : `${Math.round(x.fait)}/${Math.round(x.total)}`;
      else if(x.etat === 'route') st = 'Véhicule en route';
      else if(x.manque) st = `<span class="mal">Pas de ${M.VEHICULES[x.veh].nom.split(' ')[0].toLowerCase()} libre</span>`;
      else if(T.avant && A.t < v.tDep - T.avant) st = `À ${hm(v.tDep - T.avant)}`;
      else st = 'En attente';
      return `<div class="tache"><span>${T.ico}</span><div class="barre"><i class="${x.etat === 'fini' ? 'fini' : ''}" style="width:${pc * 100}%"></i><span>${T.nom}</span></div><small class="${x.manque ? 'mal' : ''}">${st}</small></div>`;
    }).join('');
    const reste = v.tDep - A.t;
    corps += `<div class="leg">${reste > 0 ? `Départ dans ${Math.round(reste)} min` : `<b style="color:var(--rouge)">En retard de ${Math.round(-reste)} min</b>`} · ${Math.round(v.airside)} passagers à la porte</div>`;
  }
  if(v.satisf != null) corps += `<div>Satisfaction : <b>${v.satisf} %</b>${v.retard > 5 ? ` · retard ${Math.round(v.retard)} min` : ' · à l\'heure'}</div>`;
  el.innerHTML = `<div class="t" style="background:${C.c1}"><div><b>${esc(v.num)}</b><small>${esc(C.nom)} · ${esc(AV.nom)}</small></div><button id="cvSuivre">🎯</button><button id="cvFermer">✕</button></div><div class="c">${corps}</div>`;
  el.hidden = false; $('toasts').hidden = true;
  $('cvFermer').onclick = fermerCarteVol; $('cvSuivre').onclick = () => S3.suivre(v.id);
}

/* ---------- Les panneaux ---------- */
const TITRES = { planning:'Planning des portes', compagnies:'Compagnies', sol:'Opérations au sol', terminal:'Terminal', hangar:'Hangar', aeroports:'Aéroports', menu:'Menu' };
const PANNEAUX_VIVANTS = ['planning', 'sol', 'terminal'];
document.querySelector('.onglets').onclick = e => { const b = e.target.closest('button'); if(!b) return; if(panneau === b.dataset.p) fermerPanneau(); else ouvrir(b.dataset.p); };
$('pFermer').onclick = () => fermerPanneau();
function ouvrir(p){
  panneau = p; $('panneau').hidden = false; $('pTitre').textContent = TITRES[p];
  [...document.querySelectorAll('.onglets button')].forEach(b => b.classList.toggle('actif', b.dataset.p === p));
  placement = null; selModule = null; outil = null;
  rafraichirPanneau(true); majObjectif();
}
function fermerPanneau(){ panneau = null; $('panneau').hidden = true; [...document.querySelectorAll('.onglets button')].forEach(b => b.classList.remove('actif')); placement = null; majObjectif(); }
function rafraichirPanneau(complet = false){
  if(!panneau) return;
  const f = { planning:pPlanning, compagnies:pCompagnies, sol:pSol, terminal:pTerminal, hangar:pHangar, aeroports:pAeroports, menu:pMenu }[panneau];
  const box = $('pCorps'), haut = box.scrollTop;
  // garder la position du planning (défilement horizontal)
  const pl = box.querySelector('.planning'), gauche = pl ? pl.scrollLeft : null;
  f(box, complet);
  box.scrollTop = haut;
  const pl2 = box.querySelector('.planning'); if(pl2 && gauche != null && !complet) pl2.scrollLeft = gauche;
}
const ongletsHtml = (cle, l) => `<div class="sousOng">${l.map(([k, n]) => `<button data-so="${k}" class="${(sousOnglet[cle] || l[0][0]) === k ? 'actif' : ''}">${n}</button>`).join('')}</div>`;
function brancherOnglets(box, cle){ box.querySelectorAll('[data-so]').forEach(b => b.onclick = () => { sousOnglet[cle] = b.dataset.so; rafraichirPanneau(true); }); }
function alerte(err){ if(err){ A.toasts.push({ txt:'⚠️ ' + err, type:'mal' }); toasts(); return true; } return false; }
const action = (err, apres = () => {}) => { if(!alerte(err)){ apres(); majHud(); rafraichirPanneau(); sauver(); } };

/* ----- Le planning ----- */
let placement = null, selContrat = null;
const PX_MIN = 2;                       // largeur d'une minute dans la grille
function pPlanning(box, complet){
  const aProg = A.contrats.filter(c => c.porte == null);
  const J = A.jourStats, b = A.bilanJour;
  let h = '';
  if(aProg.length) h += `<div class="bloc"><h3>À programmer (${aProg.length})</h3>${aProg.map(c => carteContrat(c, true)).join('')}</div>`;
  else if(!A.contrats.length) h += `<p class="leg">Pas encore de vol. Va dans 🤝 Compagnies pour accepter un contrat.</p>`;
  if(placement){ const c = A.contrats.find(x => x.id === placement); h += `<p class="leg"><b>Touche une porte</b> (ligne verte) dans la zone orange pour programmer ${esc(c.num)} : arrivée entre ${hm(c.fenetre[0])} et ${hm(c.fenetre[1])}, escale de ${c.rot} min. <button class="btn" id="plAnnuler">Annuler</button></p>`; }
  h += `<div class="planning" id="planning"><div class="grille" style="width:${46 + 1440 * PX_MIN}px">${grille()}</div></div>`;
  if(selContrat){ const c = A.contrats.find(x => x.id === selContrat); if(c) h += `<div class="bloc">${carteContrat(c, false)}</div>`; else selContrat = null; }
  h += `<div class="bloc"><h3>Aujourd'hui</h3><div class="stats"><div><b>${J.vols}</b>vols partis</div><div><b>${J.retards}</b>retards</div><div><b>${court(J.revenus + J.commerce - J.penalites)}</b>gagnés</div><div><b>${J.nSatisf ? Math.round(J.satisf / J.nSatisf) + ' %' : '—'}</b>satisfaction</div></div>
    ${b ? `<h3 style="margin-top:6px">Hier (jour ${b.jour})</h3><p class="leg">${b.vols} vols · ${b.retards} retards · redevances ${court(b.revenus)} · commerces ${court(b.commerce)} · pénalités ${court(b.penalites)} · entretien ${court(b.depenses)} · <b>${b.net >= 0 ? '+' : ''}${court(b.net)}</b>${b.satisf != null ? ` · satisfaction ${b.satisf} %` : ''}</p>` : ''}</div>`;
  box.innerHTML = h;
  const pl = $('planning');
  if(complet){ const m = M.minuteDe(A.t); pl.scrollLeft = Math.max(0, m * PX_MIN - 60); if(placement){ const c = A.contrats.find(x => x.id === placement); pl.scrollLeft = Math.max(0, c.fenetre[0] * PX_MIN - 40); } }
  box.querySelectorAll('[data-auto]').forEach(b => b.onclick = () => { const c = A.contrats.find(x => x.id === b.dataset.auto), pos = M.placementAuto(A, c); if(!pos){ alerte('Pas de place libre pour ce vol : agrandis une porte ou achètes-en une (🚚 Sol).'); return; } action(M.placer(A, c.id, pos.porte, pos.arr)); });
  box.querySelectorAll('[data-choisir]').forEach(b => b.onclick = () => { placement = b.dataset.choisir; rafraichirPanneau(true); });
  box.querySelectorAll('[data-deprog]').forEach(b => b.onclick = () => { if(!M.deprogrammer(A, b.dataset.deprog)) alerte('Un vol de ce contrat est déjà en route : attends qu\'il soit reparti.'); else { selContrat = null; rafraichirPanneau(); } });
  box.querySelectorAll('[data-rompre]').forEach(b => b.onclick = () => { const c = A.contrats.find(x => x.id === b.dataset.rompre); if(confirm(`Rompre le contrat ${c.num} ? Pénalité : ${court(c.revenu * 2)}, et la compagnie te fera moins confiance.`)) action(M.rompre(P, A, c.id), () => { selContrat = null; }); });
  if($('plAnnuler')) $('plAnnuler').onclick = () => { placement = null; rafraichirPanneau(); };
  pl.querySelectorAll('.vol').forEach(el => el.onclick = e => { e.stopPropagation(); selContrat = el.dataset.c; placement = null; rafraichirPanneau(); });
  pl.querySelectorAll('.rang').forEach(el => el.onclick = e => {
    if(!placement) return;
    const r = el.getBoundingClientRect(), x = e.clientX - r.left - 46, arr = Math.round(x / PX_MIN / 5) * 5, c = A.contrats.find(y => y.id === placement);
    // si on touche hors de la fenêtre, on prend le bord le plus proche
    const a = clamp(arr - Math.round(c.rot / 2 / 5) * 5, c.fenetre[0], c.fenetre[1]);
    const err = M.placer(A, placement, +el.dataset.porte, a);
    if(!alerte(err)){ placement = null; sauver(); rafraichirPanneau(); }
  });
}
function grille(){
  let h = `<div class="heures">${Array.from({ length:24 }, (_, k) => `<span style="left:${46 + k * 60 * PX_MIN}px">${String(k).padStart(2, '0')}h</span>`).join('')}</div>`;
  const cPl = placement ? A.contrats.find(x => x.id === placement) : null;
  A.portes.forEach((g, i) => {
    const ok = cPl && M.tailleOk(g.taille, cPl.avion);
    h += `<div class="rang ${ok ? 'ok' : ''}" data-porte="${i}"><span class="nomP">${g.nom}<small>${g.taille}${g.passerelle ? ' 🌉' : ''}</small></span>`;
    if(ok) h += `<div class="fen" style="left:${46 + cPl.fenetre[0] * PX_MIN}px;width:${(cPl.fenetre[1] - cPl.fenetre[0] + cPl.rot) * PX_MIN}px"></div>`;
    for(const c of A.contrats.filter(x => x.porte === i)){
      const vol = A.vols.find(v => v.contrat === c.id && v.etat !== 'parti'), retard = vol && vol.tDep < A.t && vol.etat === 'escale';
      for(const d of [0, -1440, 1440]){
        const x0 = c.arr + d, x1 = c.arr + c.rot + d; if(x1 < 0 || x0 > 1440) continue;
        h += `<div class="vol ${retard ? 'retard' : ''} ${selContrat === c.id ? 'sel' : ''}" data-c="${c.id}" style="left:${46 + Math.max(0, x0) * PX_MIN}px;width:${(Math.min(1440, x1) - Math.max(0, x0)) * PX_MIN}px;background:${COULEUR(c.comp)}"><b>${esc(c.num)}</b>${hm(c.arr)}–${hm(c.arr + c.rot)} · ${esc(c.code)}</div>`;
      }
    }
    h += '</div>';
  });
  h += `<div class="maint" style="left:${46 + M.minuteDe(A.t) * PX_MIN}px"></div>`;
  return h;
}
function carteContrat(c, aProg){
  const C = M.COMPAGNIES[c.comp], AV = M.AVIONS[c.avion], peut = A.portes.some(g => M.tailleOk(g.taille, c.avion));
  return `<div class="offre"><div class="h" style="background:${C.c1}">${C.ico} <b>${esc(c.num)}</b> ${esc(C.nom)}<span>${court(c.revenu)}/vol</span></div>
    <div class="c"><div><small>Avion</small><b>${esc(AV.nom)} (${AV.taille})</b></div><div><small>${c.porte != null ? 'Porte' : 'Arrivée voulue'}</small><b>${c.porte != null ? `${A.portes[c.porte].nom} · ${hm(c.arr)}–${hm(c.arr + c.rot)}` : `${hm(c.fenetre[0])}–${hm(c.fenetre[1])}`}</b></div>
    <div><small>Ligne</small><b>${esc(c.ville)} (${esc(c.code)})</b></div><div><small>Escale</small><b>${c.rot} min · ${c.paxDep} pax</b></div>
    <div><small>Contrat</small><b>${c.joursRestants} jour${c.joursRestants > 1 ? 's' : ''} restant${c.joursRestants > 1 ? 's' : ''}</b></div><div><small>Retard</small><b>−${court(c.penalite)} / 15 min</b></div></div>
    <div class="p">${aProg ? `<button class="btn prim" data-auto="${c.id}">Placer tout seul</button><button class="btn" data-choisir="${c.id}">Choisir porte et heure</button>${peut ? '' : '<p class="leg mal">Aucune porte assez grande : agrandis-en une (🚚 Sol).</p>'}` : `<button class="btn" data-deprog="${c.id}">Déprogrammer</button><button class="btn rouge" data-rompre="${c.id}">Rompre le contrat</button>`}</div></div>`;
}

/* ----- Les compagnies : offres, contrats, confiance ----- */
function pCompagnies(box){
  const so = sousOnglet.comp || 'offres';
  let h = ongletsHtml('comp', [['offres', `Offres (${A.offres.length})`], ['contrats', `Mes contrats (${A.contrats.length})`], ['confiance', `Confiance${M.aRecevoir(P) ? ` 🎁${M.aRecevoir(P)}` : ''}`]]);
  if(so === 'offres'){
    if(!A.offres.length) h += '<p class="leg">Pas d\'offre pour l\'instant : de nouvelles arrivent chaque matin.</p>';
    for(const o of A.offres){
      const C = M.COMPAGNIES[o.comp], AV = M.AVIONS[o.avion], peut = A.portes.some(g => M.tailleOk(g.taille, o.avion)), reste = Math.max(0, Math.ceil((o.expire - A.t) / 60));
      h += `<div class="offre"><div class="h" style="background:${C.c1}">${C.ico} <b>${esc(C.nom)}</b>${o.renouvele ? ' · renouvellement' : ''}<span>${court(o.revenu)}/vol</span></div>
        <div class="c"><div><small>Vol</small><b>${esc(o.num)} · ${esc(o.ville)} (${esc(o.code)})</b></div><div><small>Avion</small><b>${esc(AV.nom)} · porte ${AV.taille}</b></div>
        <div><small>Arrivée voulue</small><b>${hm(o.fenetre[0])}–${hm(o.fenetre[1])}</b></div><div><small>Escale</small><b>${o.rot} min · ${M.RAYONS[o.rayon].nom.toLowerCase()}</b></div>
        <div><small>Passagers</small><b>${o.paxArr} à l'arrivée · ${o.paxDep} au départ</b></div><div><small>Durée</small><b>${o.jours} jours · ${court(o.revenu * o.jours)} en tout</b></div>
        <div><small>Pénalité de retard</small><b>${court(o.penalite)} / 15 min</b></div><div><small>Offre valable</small><b>${reste} h</b></div></div>
        <div class="p"><button class="btn prim" data-acc="${o.id}">✅ Accepter</button><button class="btn" data-ref="${o.id}">Refuser</button>${peut ? '' : '<p class="leg mal">Aucune de tes portes n\'est assez grande pour cet avion.</p>'}</div></div>`;
    }
  } else if(so === 'contrats'){
    if(!A.contrats.length) h += '<p class="leg">Aucun contrat : accepte une offre.</p>';
    for(const c of A.contrats) h += carteContrat(c, c.porte == null);
  } else {
    h += '<p class="leg">Chaque vol à l\'heure, avec des passagers contents, augmente la confiance de la compagnie. À chaque palier, une récompense.</p>';
    const comps = Object.keys(M.COMPAGNIES).sort((a, b) => P.compagnies[b].xp - P.compagnies[a].xp);
    for(const k of comps){
      const C = M.COMPAGNIES[k], Cp = P.compagnies[k], n = M.paliersAtteints(Cp.xp), x0 = n ? M.xpConfiance(n) : 0, x1 = M.xpConfiance(Math.min(M.PALIERS, n + 1));
      h += `<div class="bloc"><div class="ligneB"><span style="font-size:1.3rem">${C.ico}</span><b style="color:${C.c1}">${esc(C.nom)}</b><span class="leg" style="margin-left:auto">palier ${n}/${M.PALIERS}${M.bonusCompagnie(P, k) ? ` · +${Math.round(M.bonusCompagnie(P, k) * 100)} % sur ses vols` : ''}</span></div>
        <div class="jauge"><i style="width:${n >= M.PALIERS ? 100 : clamp((Cp.xp - x0) / (x1 - x0), 0, 1) * 100}%;background:${C.c1}"></i></div>
        <div class="passe">${M.RECOMPENSES.map((r, i) => { const k1 = i + 1, pris = Cp.pris.includes(k1), pret = !pris && n >= k1;
          return `<div class="r ${pris ? 'pris' : pret ? 'pret' : ''}"><b>${k1}</b>${esc(M.texteRecompense(r))}${pris ? '<span>✅ Reçu</span>' : pret ? `<button class="btn prim" data-rec="${k}:${k1}">Recevoir</button>` : `<span>${Math.round(M.xpConfiance(k1) - Cp.xp)} pts</span>`}</div>`; }).join('')}</div></div>`;
    }
  }
  box.innerHTML = h; brancherOnglets(box, 'comp');
  box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { const c = M.accepter(P, A, b.dataset.acc); sauver(); if(c && c.porte == null){ ouvrir('planning'); } else rafraichirPanneau(); majHud(); });
  box.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => { M.refuser(A, b.dataset.ref); rafraichirPanneau(); majHud(); });
  box.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { const [k, n] = b.dataset.rec.split(':'); action(M.recevoir(P, A, k, +n), () => A.toasts.push({ txt:`🎁 ${M.COMPAGNIES[k].nom} : ${M.texteRecompense(M.RECOMPENSES[n - 1])}`, type:'cadeau' })); });
  box.querySelectorAll('[data-auto]').forEach(b => b.onclick = () => { const c = A.contrats.find(x => x.id === b.dataset.auto), pos = M.placementAuto(A, c); if(!pos) return alerte('Pas de place libre pour ce vol.'); action(M.placer(A, c.id, pos.porte, pos.arr)); });
  box.querySelectorAll('[data-choisir]').forEach(b => b.onclick = () => { ouvrir('planning'); placement = b.dataset.choisir; rafraichirPanneau(true); });
  box.querySelectorAll('[data-deprog]').forEach(b => b.onclick = () => { if(!M.deprogrammer(A, b.dataset.deprog)) alerte('Un vol de ce contrat est déjà en route.'); else rafraichirPanneau(); });
  box.querySelectorAll('[data-rompre]').forEach(b => b.onclick = () => { const c = A.contrats.find(x => x.id === b.dataset.rompre); if(confirm(`Rompre le contrat ${c.num} ? Pénalité : ${court(c.revenu * 2)}.`)) action(M.rompre(P, A, c.id)); });
}

/* ----- Le sol : portes et véhicules ----- */
function pSol(box){
  const D = M.AEROPORTS[A.id];
  // ce qui attend un véhicule en ce moment
  const manques = {};
  for(const v of A.vols) if(v.taches) for(const x of Object.values(v.taches)) if(x.manque && x.etat === 'attente') manques[x.veh] = (manques[x.veh] || 0) + 1;
  let h = `<div class="bloc"><h3>Véhicules de piste</h3>${Object.keys(manques).length ? `<p class="leg mal">⚠️ En attente d'un véhicule : ${Object.entries(manques).map(([k, n]) => `${n} × ${M.VEHICULES[k].nom.toLowerCase()}`).join(', ')}.</p>` : '<p class="leg">Les véhicules vont de leur dépôt aux avions. Plus il y en a, moins les escales attendent ; leur niveau les rend plus rapides.</p>'}`;
  for(const [k, V] of Object.entries(M.VEHICULES)){
    if(k === 'degivrage' && !D.neige) continue;
    const us = A.unites.filter(u => u.type === k), occ = us.filter(u => u.etat !== 'libre').length, niv = (A.vehicules[k] || { niv:1 }).niv;
    const pa = A.vehicules[k] && niv < M.NIV_MAX ? M.prixAmeliorationVehicules(A, k) : null;
    h += `<div class="item"><span class="ico">${V.ico}</span><div><b>${V.nom}</b><small>${us.length} au total · ${occ} occupé${occ > 1 ? 's' : ''} · niveau ${niv}${manques[k] ? ` · <b style="color:var(--rouge)">${manques[k]} en attente</b>` : ''}</small></div>
      <div class="act"><button class="btn prim" data-veh="${k}" ${P.argent < V.prix ? 'disabled' : ''}>+1 · ${court(V.prix)}</button>${pa ? `<button class="btn" data-amv="${k}" ${P.argent < pa ? 'disabled' : ''}>Niv ${niv + 1} · ${court(pa)}</button>` : ''}</div></div>`;
  }
  h += '</div><div class="bloc"><h3>Portes d\'embarquement</h3><p class="leg">S : avions régionaux · M : moyen-courriers · L : gros porteurs · XL : très gros porteurs. Sans passerelle, un bus emmène les passagers (plus lent).</p>';
  A.portes.forEach((g, i) => {
    const suiv = Object.keys(M.TAILLES).find(k => M.TAILLES[k].ordre === M.TAILLES[g.taille].ordre + 1), peutAgr = suiv && M.TAILLES[suiv].ordre <= M.TAILLES[D.tailleMax].ordre;
    const nb = A.contrats.filter(c => c.porte === i).length;
    h += `<div class="item"><span class="ico">${g.passerelle ? '🌉' : '🚌'}</span><div><b>Porte ${g.nom} · ${g.taille}</b><small>${M.TAILLES[g.taille].nom}${g.passerelle ? ', passerelle' : ', bus et escalier'} · ${nb} vol${nb > 1 ? 's' : ''} par jour</small></div>
      <div class="act">${g.passerelle ? '' : `<button class="btn" data-pas="${i}" ${P.argent < M.prixPasserelle(g.taille) ? 'disabled' : ''}>🌉 Passerelle · ${court(M.prixPasserelle(g.taille))}</button>`}${peutAgr ? `<button class="btn" data-agr="${i}">Agrandir en ${suiv} · ${court(Math.round((M.TAILLES[suiv].prix - M.TAILLES[g.taille].prix) * 1.1))}</button>` : ''}</div></div>`;
  });
  if(A.portes.length < D.portesMax){
    h += `<div class="ligneB">${Object.keys(M.TAILLES).filter(k => M.TAILLES[k].ordre <= M.TAILLES[D.tailleMax].ordre).map(k => `<button class="btn prim" data-porte="${k}" ${P.argent < M.TAILLES[k].prix ? 'disabled' : ''}>+ Porte ${k} · ${court(M.TAILLES[k].prix)}</button>`).join('')}</div>`;
  } else h += '<p class="leg">Toutes les portes possibles ici sont construites.</p>';
  h += `<p class="leg">Ici, la piste accepte jusqu'aux avions ${D.tailleMax} · ${A.portes.length}/${D.portesMax} portes.</p></div>`;
  box.innerHTML = h;
  box.querySelectorAll('[data-veh]').forEach(b => b.onclick = () => action(M.acheterVehicule(P, A, b.dataset.veh)));
  box.querySelectorAll('[data-amv]').forEach(b => b.onclick = () => action(M.ameliorerVehicule(P, A, b.dataset.amv)));
  box.querySelectorAll('[data-pas]').forEach(b => b.onclick = () => action(M.acheterPasserelle(P, A, +b.dataset.pas)));
  box.querySelectorAll('[data-agr]').forEach(b => b.onclick = () => action(M.agrandirPorte(P, A, +b.dataset.agr)));
  box.querySelectorAll('[data-porte]').forEach(b => b.onclick = () => action(M.acheterPorte(P, A, b.dataset.porte)));
}

/* ----- Le terminal : le plan, les constructions, les passagers ----- */
let selModule = null, outil = null, deplace = null;
function pTerminal(box, complet){
  const cap = M.capacites(A), ca = A.capAffiche || { airside:0, check:0, secu:0 }, J = A.jourStats;
  const manque = [];
  if(!cap.toilettes) manque.push('des toilettes'); if(!cap.cafe && !cap.restaurant) manque.push('un café ou un restaurant'); if(!cap.tapis) manque.push('un tapis à bagages');
  if(ca.airside > cap.places) manque.push(`des sièges (${Math.round(ca.airside - cap.places)} passagers debout)`);
  if(!cap.salon && A.contrats.some(c => c.rayon === 'long')) manque.push('un salon VIP pour les long-courriers');
  const intl = A.contrats.some(c => M.international(c.ville));
  if(intl && !cap.passeports) manque.push('un contrôle des passeports pour les vols internationaux (sinon de très longues files)');
  if(intl && !cap.douane) manque.push('une douane pour les arrivées internationales');
  if(!complet && box.querySelector('#plan2d')){
    // mise à jour légère : les chiffres et le dessin
    const st = box.querySelector('#tStats'); if(st) st.innerHTML = statsTerminal(cap, ca, J);
    dessinerPlan(); return;
  }
  let h = `<div class="stats" id="tStats">${statsTerminal(cap, ca, J)}</div>
    ${manque.length ? `<p class="leg mal">⚠️ Il manque ${manque.join(', ')}.</p>` : ''}
    <canvas class="plan2d" id="plan2d"></canvas>
    <p class="leg" id="tAide">${deplace ? 'Touche la case où déplacer la construction.' : outil ? `Touche une case vide pour construire : ${M.MODULES[outil].nom.toLowerCase()}.` : 'Touche une case vide pour construire, ou une construction pour l\'améliorer.'} En bas : côté ville (enregistrement, contrôles, bagages) ; en haut : côté pistes.</p>
    <div id="tSel"></div>
    <div class="bloc"><h3>Construire</h3><div class="palette">${Object.entries(M.MODULES).map(([k, Mo]) => { const verrou = Mo.niv && M.niveauDe(P.xp) < Mo.niv;
      return `<button data-outil="${k}" class="${outil === k ? 'actif' : ''}" ${verrou || P.argent < Mo.prix ? 'disabled' : ''}><span>${Mo.ico}</span>${esc(Mo.nom)}<small>${verrou ? `niveau ${Mo.niv}` : court(Mo.prix)}</small></button>`; }).join('')}</div>
      <button class="btn" id="tAgr" ${P.argent < M.prixAgrandir(A) ? 'disabled' : ''}>↔️ Agrandir le terminal · ${court(M.prixAgrandir(A))}</button></div>`;
  box.innerHTML = h;
  dessinerPlan(); afficherSel();
  const cvp = $('plan2d');
  cvp.onclick = e => {
    const r = cvp.getBoundingClientRect(), T = A.terminal, cw = r.width / T.l, ch = r.height / T.h, x = Math.floor((e.clientX - r.left) / cw), y = T.h - 1 - Math.floor((e.clientY - r.top) / ch);
    const m = A.terminal.modules.find(o => o.x === x && o.y === y);
    if(deplace){ if(!alerte(M.deplacerModule(A, deplace, x, y))){ deplace = null; sauver(); } rafraichirPanneau(true); return; }
    if(m){ selModule = m; outil = null; rafraichirPanneau(true); return; }
    if(outil){ action(M.construire(P, A, x, y, outil), () => { selModule = A.terminal.modules.find(o => o.x === x && o.y === y); outil = null; }); rafraichirPanneau(true); return; }
    selModule = null; rafraichirPanneau(true);
  };
  box.querySelectorAll('[data-outil]').forEach(b => b.onclick = () => { outil = outil === b.dataset.outil ? null : b.dataset.outil; selModule = null; rafraichirPanneau(true); });
  $('tAgr').onclick = () => action(M.agrandirTerminal(P, A), () => rafraichirPanneau(true));
}
function statsTerminal(cap, ca, J){
  return `<div><b>${Math.round(ca.check)}</b>à l'enregistrement (${Math.round(cap.comptoirs)} comptoirs)</div><div><b>${Math.round(ca.secu)}</b>à la sûreté (${Math.round(cap.postes * 10) / 10} postes)</div><div><b>${Math.round(ca.pass || 0)}</b>aux passeports (${Math.round(cap.passeports)} guichets)</div>
    <div><b>${Math.round(ca.airside)}/${Math.round(cap.places)}</b>en salle / sièges</div><div><b>${court(J.commerce)}</b>de commerces aujourd'hui</div>`;
}
function afficherSel(){
  const el = $('tSel'); if(!el) return;
  if(!selModule || !A.terminal.modules.includes(selModule)){ el.innerHTML = ''; return; }
  const m = selModule, Mo = M.MODULES[m.type], pa = m.niv < M.NIV_MAX ? M.prixAmelioration(Mo.prix, m.niv) : null;
  el.innerHTML = `<div class="item"><span class="ico">${Mo.ico}</span><div><b>${esc(Mo.nom)} · niveau ${m.niv}</b><small>${esc(Mo.desc)}</small></div><div class="act">${pa ? `<button class="btn prim" id="tAm" ${P.argent < pa ? 'disabled' : ''}>Niveau ${m.niv + 1} · ${court(pa)}</button>` : ''}${CONTROLES.includes(m.type) ? '<button class="btn prim" id="tJouer">🎮 Jouer au contrôle</button>' : ''}<button class="btn" id="tDep">Déplacer</button><button class="btn rouge" id="tVend">Vendre (+${court(Mo.prix * .5)})</button></div></div>`;
  if($('tAm')) $('tAm').onclick = () => action(M.ameliorerModule(P, A, m), () => rafraichirPanneau(true));
  $('tDep').onclick = () => { deplace = m; rafraichirPanneau(true); };
  if($('tJouer')) $('tJouer').onclick = () => lancerControle(m.type);
  $('tVend').onclick = () => { if(confirm(`Vendre ${Mo.nom.toLowerCase()} ?`)){ M.vendreModule(P, A, m); selModule = null; sauver(); majHud(); rafraichirPanneau(true); } };
}
// le plan du terminal, vu de dessus, avec des passagers qui se promènent
let animPlan = 0;
function dessinerPlan(){
  const cvp = $('plan2d'); if(!cvp) return;
  const T = A.terminal, w = cvp.clientWidth || 320, cell = w / T.l, h = cell * T.h * .8, dpr = Math.min(2, devicePixelRatio || 1);
  if(cvp.width !== Math.round(w * dpr)){ cvp.width = Math.round(w * dpr); cvp.height = Math.round(h * dpr); cvp.style.height = h + 'px'; }
  const g = cvp.getContext('2d'), ch = h / T.h; g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#E8ECF1'; g.fillRect(0, 0, w, h);
  // le sol en carrelage, la ligne de sûreté entre côté ville et côté pistes
  for(let x = 0; x < T.l; x++) for(let y = 0; y < T.h; y++){ g.fillStyle = (x + y) % 2 ? '#DFE5EC' : '#E9EEF3'; g.fillRect(x * cell, h - (y + 1) * ch, cell, ch); }
  g.fillStyle = 'rgba(255,183,3,.18)'; g.fillRect(0, h - ch, w, ch);
  g.strokeStyle = '#FFB703'; g.setLineDash([6, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(0, h - ch); g.lineTo(w, h - ch); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(20,35,58,.45)'; g.font = '700 10px sans-serif'; g.textAlign = 'right'; g.fillText('côté ville ⬇', w - 4, h - 4); g.fillText('côté pistes ⬆', w - 4, 12);
  // les constructions
  for(const m of T.modules){
    const Mo = M.MODULES[m.type], x = m.x * cell, y = h - (m.y + 1) * ch;
    g.fillStyle = Mo.coul; arrondi(g, x + 3, y + 3, cell - 6, ch - 6, 8); g.fill();
    if(selModule === m || deplace === m){ g.strokeStyle = '#FFB703'; g.lineWidth = 3; arrondi(g, x + 2, y + 2, cell - 4, ch - 4, 9); g.stroke(); }
    g.font = `${Math.min(cell, ch) * .38}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Mo.ico, x + cell / 2, y + ch / 2 - ch * .08);
    g.fillStyle = '#fff'; g.font = `800 ${Math.max(8, cell * .11)}px sans-serif`; g.fillText('★'.repeat(m.niv), x + cell / 2, y + ch * .8);
  }
  if(outil){ g.fillStyle = 'rgba(255,183,3,.12)'; for(let x = 0; x < T.l; x++) for(let y = 0; y < T.h; y++) if(!T.modules.some(m => m.x === x && m.y === y)){ g.fillRect(x * cell + 4, h - (y + 1) * ch + 4, cell - 8, ch - 8); } }
  // les passagers : des points en file devant l'enregistrement et les contrôles, et dans la zone d'attente
  animPlan += .016;
  const ca = A.capAffiche || { check:0, secu:0, airside:0 }, coul = ['#E5383B', '#1B6EC2', '#2BA84A', '#FB8500', '#6A4C93', '#14233A'];
  const file = (type, n) => { const ms = T.modules.filter(m => m.type === type); if(!ms.length) return; const k = Math.min(60, Math.round(n)); for(let i = 0; i < k; i++){ const m = ms[i % ms.length], j = Math.floor(i / ms.length); point(g, m.x * cell + cell * .5 + Math.sin(i * 7.3) * cell * .12, h - m.y * ch - 4 - j * 4.5, coul[i % 6]); } };
  file('comptoir', ca.check); file('securite', ca.secu); file('passeports', ca.pass || 0);
  const zones = T.modules.filter(m => M.MODULES[m.type].zone === 'piste'), k = Math.min(90, Math.round(ca.airside / 2));
  for(let i = 0; i < k && zones.length; i++){ const m = zones[(i * 7) % zones.length], a = animPlan * (.3 + (i % 5) * .1) + i; point(g, m.x * cell + cell / 2 + Math.cos(a) * cell * .3, h - (m.y + .5) * ch + Math.sin(a * 1.3) * ch * .3, coul[i % 6]); }
}
function point(g, x, y, c){ g.fillStyle = c; g.beginPath(); g.arc(x, y, 2.3, 0, 7); g.fill(); }
function arrondi(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ----- Le hangar : les avions, leurs livrées ----- */
let hangarSel = { avion:'atr72', comp:'alpair' }, angleA = 0, rafA = 0;
function pHangar(box){
  const niv = M.niveauDe(P.xp), comp = hangarSel.comp, L = P.livrees[comp];
  let h = `<canvas class="apercu" id="apercu"></canvas>
    <div class="ligneB">${Object.entries(M.COMPAGNIES).map(([k, C]) => `<button class="btn ${k === comp ? 'prim' : ''}" data-comp="${k}" style="${k === comp ? '' : `border-color:${C.c1}`}">${C.ico} ${esc(C.nom)}</button>`).join('')}</div>
    <div class="bloc"><h3>Livrée des avions ${esc(M.COMPAGNIES[comp].nom)}</h3><div class="ligneB">${Object.entries(M.LIVREES).map(([k, Lv]) => { const ok = L.dispo.includes(k); return `<button class="btn ${L.choisie === k ? 'prim' : ''}" data-liv="${k}" ${ok ? '' : 'disabled'}>${ok ? '' : '🔒 '}${esc(Lv.nom)}</button>`; }).join('')}</div>
      <p class="leg">Les livrées se gagnent avec la confiance de la compagnie (🤝 Compagnies). La livrée choisie est celle de ses avions dans ton aéroport.</p></div>
    <div class="bloc"><h3>Les avions</h3>`;
  for(const [k, AV] of Object.entries(M.AVIONS)){
    const ok = AV.niv <= niv;
    h += `<div class="item ${ok ? '' : 'verrou'}" data-av="${k}"><span class="ico">${ok ? '✈️' : '🔒'}</span><div><b>${esc(AV.nom)}${hangarSel.avion === k ? ' 👀' : ''}</b><small>Porte ${AV.taille} · ${AV.pax} places · ${M.RAYONS[AV.rayon].nom.toLowerCase()} · escale ${AV.rotation} min${ok ? '' : ` · <b>niveau ${AV.niv}</b>`}</small></div><div class="act"><button class="btn" data-voir="${k}">Voir</button></div></div>`;
  }
  h += '</div>';
  box.innerHTML = h;
  box.querySelectorAll('[data-comp]').forEach(b => b.onclick = () => { hangarSel.comp = b.dataset.comp; const av = M.COMPAGNIES[b.dataset.comp].avions; if(!av.includes(hangarSel.avion)) hangarSel.avion = av[0]; rafraichirPanneau(); });
  box.querySelectorAll('[data-liv]').forEach(b => b.onclick = () => { P.livrees[comp].choisie = b.dataset.liv; sauver(); rafraichirPanneau(); });
  box.querySelectorAll('[data-voir]').forEach(b => b.onclick = () => { hangarSel.avion = b.dataset.voir; rafraichirPanneau(); $('pCorps').scrollTop = 0; });
  cancelAnimationFrame(rafA);
  const tourne = () => { if(panneau !== 'hangar' || !$('apercu')) return; angleA += .01; S3.apercu($('apercu'), hangarSel.avion, hangarSel.comp, P.livrees[hangarSel.comp].choisie, angleA); rafA = requestAnimationFrame(tourne); };
  tourne();
}

/* ----- Les aéroports ----- */
function pAeroports(box){
  const niv = M.niveauDe(P.xp);
  let h = '';
  for(const id of M.ORDRE_AEROPORTS){
    const D = M.AEROPORTS[id], a = P.aeroports[id], ici = id === P.actuel;
    h += `<div class="item ${a ? '' : 'verrou'}"><span class="ico">${D.ico}</span><div><b>${esc(D.nom)}${ici ? ' · tu y es' : ''}</b><small>${esc(D.desc)}</small>
      <small>${a ? `Jour ${M.jourDe(a.t)} · ${a.portes.length} portes · ${a.contrats.length} contrats · satisfaction ${Math.round(a.reputation)} %` : `Pour le débloquer : niveau ${D.deblocage.niveau} et ${court(D.deblocage.prix)}`}</small></div>
      <div class="act">${a ? (ici ? '' : `<button class="btn prim" data-aller="${id}">Y aller</button>`) : `<button class="btn prim" data-deb="${id}" ${niv < D.deblocage.niveau || P.argent < D.deblocage.prix ? 'disabled' : ''}>Débloquer</button>`}</div></div>`;
  }
  const r = M.resume(P);
  h += `<div class="bloc"><h3>Ta carrière</h3><div class="stats"><div><b>${r.niveau}</b>niveau</div><div><b>${r.vols.toLocaleString('fr-FR')}</b>vols</div><div><b>${r.pax.toLocaleString('fr-FR')}</b>passagers</div><div><b>${court(r.meilleureJournee)}</b>meilleure journée</div></div>
    <p class="leg">Le temps ne passe que dans l'aéroport où tu es. Ton argent sert partout.</p></div>`;
  box.innerHTML = h;
  box.querySelectorAll('[data-aller]').forEach(b => b.onclick = () => changerAeroport(b.dataset.aller));
  box.querySelectorAll('[data-deb]').forEach(b => b.onclick = () => { const D = M.AEROPORTS[b.dataset.deb]; if(!confirm(`Débloquer ${D.nom} pour ${court(D.deblocage.prix)} ?`)) return; const err = M.debloquer(P, b.dataset.deb); if(!alerte(err)){ sauver(); changerAeroport(b.dataset.deb); } });
}

/* ----- Le menu : objectifs, aide, quitter ----- */
function pMenu(box){
  box.innerHTML = `<div class="bloc"><h3>Objectifs</h3><div class="objList">${M.OBJECTIFS.map(o => `<div class="${P.objectifs.includes(o.id) ? 'fait' : ''}">${P.objectifs.includes(o.id) ? '✅' : '🎯'} ${esc(o.txt)}<span>+${court(o.gain)}</span></div>`).join('')}</div></div>
    <div class="bloc"><h3>Le journal</h3>${A.journal.slice(0, 25).map(j => `<p class="leg">${hm(j.t)} · ${esc(j.txt)}</p>`).join('') || '<p class="leg">Rien pour l\'instant.</p>'}</div>
    <div class="ligneB"><button class="btn" id="mAide">❔ Aide</button><button class="btn" id="mQuitter">‹ Quitter (sauvegardé)</button></div>`;
  $('mAide').onclick = () => { $('eAide').hidden = false; vitesse = 0; majVitesse(); };
  $('mQuitter').onclick = () => { sauver(); accueil(); };
}

/* ---------- Pour les essais ---------- */
window.Escale = { get P(){ return P; }, get A(){ return A; }, M, S3, C, lancerControle, jouer, ouvrir, fermerPanneau, accueil, sauver, voir:id => { selVol = id; S3.suivre(id); majCarteVol(); }, changerAeroport, set vitesse(v){ vitesse = v; majVitesse(); }, nouvelle:() => { P = M.nouvellePartie(); sauver(); jouer(); } };
accueil();
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
