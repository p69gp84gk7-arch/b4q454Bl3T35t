/* Starship : le programme. Les écrans (la base, le vol, les résultats), les dessins et le pilotage au doigt.
   La logique (gestion, physique du vol) est dans sim.js. */
(() => {
'use strict';
const S = window.STARSHIP_SIM, BAC = window.STARSHIP_BAC, $ = id => document.getElementById(id);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const CLE_REC = 'starship-records';
const rec0 = () => ({ v:2, niveaux:{}, vols:0, reussis:0, explosions:0 });
let R = lire(CLE_REC, null); if(!R || R.v !== 2) R = rec0();
try{ localStorage.removeItem('starship-partie'); }catch(e){}     // (l'ancienne version avec gestion et achats)
const sauver = () => ecrire(CLE_REC, R);
const rn = id => R.niveaux[id] || (R.niveaux[id] = { etoiles:0, essais:0, reussis:0, temps:null, restant:null });
const etoilesDe = i => ((R.niveaux[S.NIVEAUX[i].id] || {}).etoiles || 0);
const debloque = i => i === 0 || etoilesDe(i - 1) > 0 || S.NIVEAUX.some((_, j) => j > i && etoilesDe(j) > 0);
const totalEtoiles = () => S.NIVEAUX.reduce((a, j) => a + ((R.niveaux[j.id] || {}).etoiles || 0), 0);
const franchis = () => S.NIVEAUX.filter(j => ((R.niveaux[j.id] || {}).etoiles || 0) > 0).length;
const etoilesTxt = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);
let niveauEnCours = 0;
const ecran = id => { ['eAccueil', 'eNiveaux', 'eVol', 'eBacReg'].forEach(e => $(e).hidden = e !== id); window.scrollTo(0, 0); if(id === 'eNiveaux') requestAnimationFrame(niveaux); };
const voile = (id, on) => { $(id).hidden = !on; };

/* ---------- Les dessins : l'acier, la flamme, les tours ---------- */
const rondRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
// Les véhicules, la tour, les plateformes et les paysages sont dans dessin.js
const D = window.STARSHIP_DESSIN, { vehicule, tour, table, barge, bateau, LARGEUR, HAUTEUR_REELLE } = D;
function etoiles(g, W, H, t, decalage = 0, n = 70){
  g.fillStyle = '#fff';
  for(let k = 0; k < n; k++){ const x = (k * 137.3) % W, y = (((k * 71.7) % H) + decalage * (.15 + (k % 4) * .12) + H * 4) % H, r = .6 + (k % 3) * .45; g.globalAlpha = (.35 + .65 * Math.abs(Math.sin(t * .8 + k))) * t; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

/* ---------- La base : le dessin et les écrans de gestion ---------- */
function dessinerBase(c, p){
  const g = c.getContext('2d'), W = c.width, H = c.height, sol = H * .83, niveau = p ? p.niveau : 0;
  const ciel = g.createLinearGradient(0, 0, 0, sol); ciel.addColorStop(0, '#050A1C'); ciel.addColorStop(.6, '#142550'); ciel.addColorStop(1, '#3B4F8A'); g.fillStyle = ciel; g.fillRect(0, 0, W, H);
  etoiles(g, W, sol, 1, 0, 90);
  const lune = g.createRadialGradient(W * .84, H * .2, 4, W * .84, H * .2, 46); lune.addColorStop(0, 'rgba(255,245,220,.5)'); lune.addColorStop(1, 'rgba(255,245,220,0)'); g.fillStyle = lune; g.fillRect(W * .7, 0, W * .3, H * .5);
  g.fillStyle = '#FFF3D8'; g.beginPath(); g.arc(W * .84, H * .2, 14, 0, 7); g.fill();
  // la mer au loin et le sable
  g.fillStyle = '#1B3A66'; g.fillRect(0, sol - 10, W, 10); const sable = g.createLinearGradient(0, sol, 0, H); sable.addColorStop(0, '#9A8566'); sable.addColorStop(1, '#5B4C38'); g.fillStyle = sable; g.fillRect(0, sol, W, H - sol);
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, sol, W, 2);
  // la tour, la table de lancement, la pile (booster + vaisseau)
  const s = H / 210, tx = W * .64;
  g.fillStyle = '#3A4350'; g.fillRect(tx - 80 * s, sol - 8 * s, 90 * s, 8 * s);
  const Lv = S.NIVEAUX[p ? p.niveau : 0].vol, kind = Lv.kind || 'starship', hb = { hop:34, starship:70, superheavy:118, falcon9:100, falconPile:130, shPile:150, dragon:70, dragonSeul:60, falcon2:60 }[kind] || 80;
  tour(g, tx + 14 * s, sol, s * .95, Lv.tour ? { y:68, tol:5 } : null, false);
  vehicule(g, kind, tx - 34 * s, sol - 8 * s, hb * s, 0, { jambes:kind === 'hop' || kind === 'falcon9' || kind === 'starship' });
  // les prototypes prêts, alignés devant
  g.fillStyle = '#fff'; g.font = `800 ${Math.round(H * .055)}px "Bricolage Grotesque", sans-serif`; g.textAlign = 'left'; g.globalAlpha = .8; g.fillText(p && p.legende ? p.legende : '', W * .06, H * .1); g.globalAlpha = 1;
}
function accueil(){
  const a = $('aStats'), n = totalEtoiles(), max = S.NIVEAUX.length * 3;
  a.innerHTML = `<h3>Le programme</h3><div class="stat"><div><b>${franchis()} / ${S.NIVEAUX.length}</b>niveaux franchis</div><div><b>${n} / ${max}</b>étoiles ★</div><div><b>${R.explosions}</b>explosions (on apprend !)</div></div>`;
  $('bContinuer').textContent = R.vols ? '▶ Continuer le programme' : '▶ Commencer par le premier saut';
  dessinerBase($('sceneAcc'), { niveau:Math.min(S.NIVEAUX.length - 1, franchis()), legende:`${n} ★ sur ${max}` });
}
function niveaux(){
  const prochain = Math.min(S.NIVEAUX.length - 1, franchis());
  dessinerBase($('scene'), { niveau:prochain, legende:S.NIVEAUX[prochain].nom });
  $('bandeau').innerHTML = `<div><b>${franchis()} / ${S.NIVEAUX.length}</b>niveaux</div><div><b>${totalEtoiles()}</b>étoiles ★</div><div><b>${R.vols}</b>vols</div><div><b>${R.explosions}</b>explosions</div>`;
  let chap = '';
  $('liste').innerHTML = S.NIVEAUX.map((J, i) => {
    const r = R.niveaux[J.id] || {}, ok = debloque(i), titre = J.chapitre !== chap ? `<h3 style="margin:${i ? 14 : 0}px 0 8px">${esc(J.chapitre)}</h3>` : ''; chap = J.chapitre;
    return `${titre}<button class="niv ${ok ? '' : 'verrou'} ${r.etoiles ? 'fait' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}><span class="ico">${ok ? J.ico : '🔒'}</span><div class="t"><small>Niveau ${i + 1}</small><b>${esc(J.nom)}</b>${r.etoiles ? `<small>Meilleur : ${r.temps ? Math.round(r.temps) + ' s' : '–'}${J.etoiles.vimp ? '' : ` · carburant restant ${r.restant != null ? Math.round(r.restant * 100) + ' %' : '–'}`}</small>` : `<small>${ok ? esc(J.vol.titre) : 'Franchis le niveau précédent'}</small>`}</div><span class="et">${etoilesTxt(r.etoiles || 0)}</span></button>`;
  }).join('');
  $('liste').querySelectorAll('[data-i]').forEach(b => b.onclick = () => brief(+b.dataset.i));
}
function brief(i){
  const J = S.NIVEAUX[i], r = R.niveaux[J.id] || {}, fait = [r.etoiles >= 1, r.meilleurTemps || false, r.meilleurCarb || false];
  niveauEnCours = i;
  $('fBrief').innerHTML = `<div class="grand">${J.ico}</div><h2>${esc(J.nom)}</h2><p>${esc(J.histoire)}</p><p><b>${esc(J.txt)}</b></p>
    <div class="crit"><div class="${fait[0] ? 'ok' : ''}">${fait[0] ? '★' : '☆'} Réussir le vol</div><div class="${fait[1] ? 'ok' : ''}">${fait[1] ? '★' : '☆'} Terminer en moins de ${J.etoiles.temps} s</div><div class="${fait[2] ? 'ok' : ''}">${fait[2] ? '★' : '☆'} ${J.etoiles.vimp ? `Arriver à moins de ${J.etoiles.vimp} m/s` : `Garder au moins ${Math.round(J.etoiles.carb * 100)} % de carburant`}</div></div>
    <p class="sous" style="font-size:.8rem">Les étoiles sont des bonus : rien n'est perdu si tu les rates, et tu peux rejouer autant que tu veux.</p>
    <button class="btn gros" id="bDecoller">🚀 Décollage</button><button class="btn" id="bBriefFermer">Retour aux niveaux</button>`;
  voile('vBrief', true); $('bDecoller').onclick = () => { voile('vBrief', false); lancer(i); }; $('bBriefFermer').onclick = () => voile('vBrief', false);
}

/* ---------- Le vol ---------- */
const cv = $('cv'), g = cv.getContext('2d');
let V = null, B = null, W = 0, H = 0, dpr = 1, boucle = null, dernier = 0, acc = 0, vitesse = 1, enPause = false, msgVus = 0, bandeauMsg = null, fin = null, parts = [], son = lire('starship-son', true) !== false, entrees = { gauche:false, droite:false, gaz:false, action:false };
function tailleVol(){ dpr = Math.min(2.5, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
addEventListener('resize', () => { if(!$('eVol').hidden) tailleVol(); });

// le son : un grondement de moteur, quelques bips, l'explosion
let AC = null, moteur = null;
function audio(){ if(!son) return null; try{ if(!AC){ AC = new (window.AudioContext || window.webkitAudioContext)(); } if(AC.state === 'suspended') AC.resume(); return AC; }catch(e){ return null; } }
function bruit(ac, dur){ const b = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function demarrerMoteur(){ const ac = audio(); if(!ac || moteur) return; const src = ac.createBufferSource(); src.buffer = bruit(ac, 2); src.loop = true; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; const gn = ac.createGain(); gn.gain.value = 0; src.connect(f); f.connect(gn); gn.connect(ac.destination); src.start(); moteur = { src, f, gn }; }
function arreterMoteur(){ if(moteur){ try{ moteur.gn.gain.value = 0; moteur.src.stop(); }catch(e){} moteur = null; } }
function bip(freq, dur = .12, vol = .08){ const ac = audio(); if(!ac) return; const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.value = freq; gn.gain.setValueAtTime(vol, ac.currentTime); gn.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur); o.connect(gn); gn.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur); }
function boum(){ const ac = audio(); if(!ac) return; const src = ac.createBufferSource(); src.buffer = bruit(ac, 1.6); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1800, ac.currentTime); f.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 1.4); const gn = ac.createGain(); gn.gain.setValueAtTime(.5, ac.currentTime); gn.gain.exponentialRampToValueAtTime(.001, ac.currentTime + 1.5); src.connect(f); f.connect(gn); gn.connect(ac.destination); src.start(); }

function lancer(i){
  B = null; $('bacBts').hidden = true; niveauEnCours = i; const J = S.NIVEAUX[i];
  V = S.nouveauVol(J.vol, J.equipe, {});
  msgVus = 0; bandeauMsg = null; fin = null; parts = []; vitesse = 1; enPause = false; $('bVitesse').textContent = '⏩ Vitesse ×1';
  alerteDern = {}; vj = 0; jDern = null; EV = {}; phasePrec = null; ecran('eVol'); appliquerMode(); tailleVol(); dernier = performance.now(); acc = 0; audio();
  bandeauMsg = { t:J.vol.type === 'booster' || J.vol.type === 'barge' ? 'Guide-toi avec ◀ ▶ puis allume pour t\'arrêter au bon endroit' : J.vol.type === 'dragon' ? 'Garde le bouclier au frais ; ouvre les PARACHUTES quand la capsule est assez lente' : J.vol.type === 'lune' ? 'Pas d\'air : penche (◀ ▶) et freine au moteur' : J.vol.type === 'orbite' || J.vol.type === 'vaisseau' || J.vol.type === 'mars' || J.vol.type === 'falcon' ? 'Tiens POUSSÉE : suis le losange bleu de la mire avec ◀ ▶' : 'Tiens POUSSÉE pour décoller', at:0, cls:'' };
  cancelAnimationFrame(boucle); boucle = requestAnimationFrame(tick);
}
function tick(now){
  boucle = requestAnimationFrame(tick);
  if(B) return tickBac(now);
  if(!V) return;
  let dt = Math.min(.05, (now - dernier) / 1000); dernier = now;
  if(!enPause){
    acc += dt * vitesse; let n = 0;
    while(acc >= 1 / 60 && n++ < 8){
      if(!fin){ S.pas(V, entrees, 1 / 60); entrees.action = false; }
      acc -= 1 / 60;
      if(V.fini && !fin) terminaison();
    }
    particules(dt * vitesse);
    for(; msgVus < V.msgs.length; msgVus++){ bandeauMsg = { t:V.msgs[msgVus].t, at:V.t, cls:V.msgs[msgVus].cls }; if(V.msgs[msgVus].cls === 'bon') bip(740, .14); else if(V.msgs[msgVus].cls === 'mal') bip(180, .3, .1); else bip(520, .08, .05); }
    if(moteur){ moteur.gn.gain.value = V.gaz * .22 * (fin ? 0 : 1); moteur.f.frequency.value = 160 + V.gaz * 480; }
    if(V.gaz > .02 && !moteur) demarrerMoteur();
    if(fin && now - fin.t0 > 1900 && !fin.montre){ fin.montre = true; resultat(); }
  }
  dessinerVol();
}
function terminaison(){
  fin = { t0:performance.now(), issue:V.fini }; arreterMoteur();
  const w = (V.phase === 'programme' ? { x:0, y:0 } : { x:V.x, y:V.y });
  if(V.fini === 'echec'){ boum(); for(let i = 0; i < 90; i++){ const a = Math.random() * 6.28, v = 10 + Math.random() * 60; parts.push({ x:w.x, y:Math.max(2, w.y + 4), vx:Math.cos(a) * v, vy:Math.sin(a) * v * .8 + 10, vie:1 + Math.random() * 1.6, t:0, r:2 + Math.random() * 5, c:Math.random() < .3 ? '#FFF1B8' : Math.random() < .6 ? '#FF9A3C' : '#C8CFDA', g:true }); } }
  else { bip(660, .2, .08); setTimeout(() => bip(880, .3, .08), 160); }
}
function particules(dt){
  if(V && V.gaz > .15 && !fin && (V.phase !== 'programme' || V.y < 3000) && V.phase !== 'capsule' && Math.random() < .8){ const a = V.th * Math.PI / 180; parts.push({ x:V.x - Math.sin(a) * 0, y:Math.max(0, V.y), vx:(Math.random() - .5) * 8 - Math.sin(a) * 15, vy:-(5 + Math.random() * 12) * V.gaz, vie:1.2, t:0, r:2 + Math.random() * 3 + V.gaz * 3, c:'rgba(220,226,236,.5)', g:false }); }
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if(p.g) p.vy -= 9.8 * dt * 2.2; if(p.y < 0){ p.y = 0; p.vy *= -.3; p.vx *= .7; } }
  parts = parts.filter(p => p.t < p.vie);
}
function resultat(){
  const J = S.NIVEAUX[niveauEnCours], n = S.notation(V, J), r = rn(J.id);
  R.vols++; r.essais++;
  let nouveau = [];
  if(V.fini === 'succes'){
    R.reussis++; r.reussis++;
    if(n.etoiles > r.etoiles){ nouveau.push('Nouveau record d\'étoiles'); r.etoiles = n.etoiles; }
    if(r.temps == null || n.temps < r.temps){ if(r.temps != null) nouveau.push('Meilleur temps'); r.temps = n.temps; }
    if(r.restant == null || n.restant > r.restant){ if(r.restant != null) nouveau.push('Moins de carburant consommé'); r.restant = n.restant; }
    if(n.criteres[1].ok) r.meilleurTemps = true; if(n.criteres[2].ok) r.meilleurCarb = true;
  } else if(V.fini === 'echec') R.explosions++;
  sauver();
  const grand = V.fini === 'succes' ? '🎉' : V.fini === 'partiel' ? '🟡' : '💥';
  const titre = V.fini === 'succes' ? (r.reussis === 1 ? `${J.court || J.nom} : franchi !` : 'Vol réussi') : V.fini === 'partiel' ? 'Presque !' : 'Démontage rapide non planifié';
  const stats = V.fini === 'succes' ? `<div class="stat"><div><b>${n.temps.toFixed(0)} s</b>chrono</div><div><b>${Math.round(n.restant * 100)} %</b>carburant restant</div><div><b>${n.conso.toFixed(0)} s</b>de poussée pleine</div>${n.ecart != null ? `<div><b>${n.ecart.toFixed(1)} m</b>écart au centre</div><div><b>${n.vImpact.toFixed(1)} m/s</b>vitesse à l'arrivée</div><div><b>${n.angle.toFixed(1)}°</b>angle</div>` : ''}</div>` : '';
  const crit = V.fini === 'succes' ? `<div class="crit">${n.criteres.map(c => `<div class="${c.ok ? 'ok' : ''}">${c.ok ? '★' : '☆'} ${esc(c.txt)}</div>`).join('')}</div>` : '';
  const suite = i => i < S.NIVEAUX.length && debloque(i);
  $('fResultat').innerHTML = `<div class="grand">${grand}</div><h2>${titre}</h2>${V.fini === 'succes' ? `<div class="etoiles">${etoilesTxt(n.etoiles)}</div>` : ''}<p><b>${esc(V.cause)}</b></p>${crit}${stats}
    ${nouveau.length ? `<div class="gain">${nouveau.map(x => `<span>✨ ${x}</span>`).join('')}</div>` : ''}
    <p>${V.fini === 'echec' ? 'En explosant, on apprend : le programme avance par essais. ' + conseilEchec(V.cause) : V.fini === 'partiel' ? 'Le vaisseau est intact : tu peux réessayer tout de suite.' : n.etoiles < 3 ? 'Les deux autres étoiles sont des bonus : rejoue si tu veux les chercher.' : 'Trois étoiles : parfait !'}</p>
    <button class="btn gros" id="bRejouer">↻ ${V.fini === 'succes' ? 'Rejouer' : 'Réessayer'}</button>${V.fini === 'succes' && suite(niveauEnCours + 1) ? '<button class="btn vert" id="bSuivant">▶ Niveau suivant</button>' : ''}<button class="btn" id="bNiveaux">Les niveaux</button>`;
  voile('vResultat', true);
  const quitter = () => { voile('vResultat', false); V = null; cancelAnimationFrame(boucle); arreterMoteur(); };
  $('bRejouer').onclick = () => { quitter(); lancer(niveauEnCours); };
  if($('bSuivant')) $('bSuivant').onclick = () => { quitter(); ecran('eNiveaux'); brief(niveauEnCours + 1); };
  $('bNiveaux').onclick = () => { quitter(); ecran('eNiveaux'); };
}
// un petit conseil selon la cause
function conseilEchec(c){
  c = c || '';
  if(/bouclier/i.test(c)) return 'Améliore le 🛡️ bouclier thermique, ou cabre plus tôt (POUSSÉE tenue) pour freiner plus haut.';
  if(/structure|pression/i.test(c)) return 'Relâche la poussée au passage de la pression maximale, ou améliore la 🧱 structure.';
  if(/brutal/i.test(c)) return 'Allume les moteurs plus tôt, ou améliore 🦾 l\'atterrissage et les 🔥 moteurs.';
  if(/plateforme|écart|tour/i.test(c)) return 'Corrige la position plus tôt (◀ ▶), ou améliore 💻 le logiciel de vol.';
  if(/sèche|carburant/i.test(c)) return 'Ménage la poussée, ou améliore les 🔥 moteurs.';
  if(/retourner|plat/i.test(c)) return 'Retourne-toi plus haut : la barre te montre la ligne de retournement.';
  return 'Essaie encore avec des équipes plus solides.';
}

/* ---------- Le dessin du vol ---------- */
const echelleDe = y => 3.3 / Math.pow(1 + Math.max(0, y) / 90, .72);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const TAILLE_VEH = { hop:[34, 70], starship:[56, 134], superheavy:[70, 190], falcon9:[66, 170], falcon2:[44, 100], falconPile:[100, 200], shPile:[110, 220], dragon:[50, 110], dragonSeul:[44, 90] };
// le véhicule à dessiner selon le moment du vol (la pile avant la séparation, le vaisseau seul ensuite, la capsule qui rentre)
function kindVisuel(sp, V){
  if(V.phase === 'capsule') return 'dragonSeul';
  if(sp.kindHaut) return V.phase === 'programme' && V.etage === 1 ? sp.kind : sp.kindHaut;
  return sp.kind || 'starship';
}
const sol = (decor, solY, s, X, camX) => D.sol(g, decor, solY, s, W, H, X, camX, V ? V.t : B ? B.t : 0);
function dessinerVol(){
  if(!V) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sp = V.spec, mars = !!sp.g && sp.g < 5 && sp.rho !== 0, vide = sp.rho === 0, decor = sp.decor || (sp.g && sp.g < 5 ? (vide ? 'lune' : 'mars') : 'terre');
  const prog = V.phase === 'programme', haute = prog && V.y >= 4000;
  EV = fin ? {} : evenements();
  // le ciel : du bleu au noir selon l'altitude (noir tout de suite sur la Lune)
  const k = vide ? 1 : clamp(V.y / (prog ? 90000 : 22000), 0, 1);
  const haut = mars ? mix([36, 18, 22], [3, 3, 8], k) : mix([40, 120, 226], [2, 4, 14], k), bas = mars ? mix([210, 130, 90], [20, 10, 14], k) : mix([170, 216, 255], [10, 20, 50], k);
  const ciel = g.createLinearGradient(0, 0, 0, H); ciel.addColorStop(0, `rgb(${haut})`); ciel.addColorStop(1, `rgb(${bas})`); g.fillStyle = ciel; g.fillRect(0, 0, W, H);
  if(k > .15) etoiles(g, W, H, clamp((k - .15) * 2, 0, 1), V.y * .002);
  if(!vide && !mars && k < .85){ g.globalAlpha = 1 - k; D.soleil(g, W * .8, H * .16, 16); g.globalAlpha = 1; }
  if(vide){ const tx = W * .82, ty = H * .2, t = g.createRadialGradient(tx - 4, ty - 4, 2, tx, ty, 22); t.addColorStop(0, '#9CD0FF'); t.addColorStop(.6, '#2B6FD0'); t.addColorStop(1, '#173A7A'); g.fillStyle = t; g.beginPath(); g.arc(tx, ty, 22, 0, 7); g.fill(); }
  const s = haute ? 2.2 : echelleDe(V.y), gy0 = H * .84;
  const kind = kindVisuel(sp, V), tv = TAILLE_VEH[kind] || [56, 134], hv = clamp(HAUTEUR_REELLE[kind] * (haute ? 2.2 : s), Math.max(tv[0], tv[1] * .55), tv[1]);
  const vyScr = haute ? H * .62 : clamp(gy0 - V.y * s, V.chute ? H * .68 : Math.min(H * .6, Math.max(H * .32, hv + 36)), H * .76), solY = haute ? H + 400 : vyScr + V.y * s;
  const camX = haute ? 0 : V.x, X = x => W / 2 + (x - camX) * s;
  if(haute){ // la courbure de la Terre qui s'éloigne
    const R = W * 3, cy = H + R * (1.05 - clamp(V.jauge * 1.1, 0, 1) * .12) - H * (.12 + V.jauge * .22), terre = g.createRadialGradient(W / 2, cy, R * .94, W / 2, cy, R); terre.addColorStop(0, '#2B6FD0'); terre.addColorStop(.97, '#58A8F0'); terre.addColorStop(1, 'rgba(160,220,255,.9)');
    g.fillStyle = terre; g.beginPath(); g.arc(W / 2, cy, R, 0, 7); g.fill();
  }
  // les nuages (en bas, on passe à travers)
  if(!haute && !mars && !vide){ g.fillStyle = 'rgba(255,255,255,.55)'; for(let i = 0; i < 9; i++){ const wy = 600 + i * 900, sy = vyScr + (V.y - wy) * s; if(sy < -60 || sy > H + 60) continue; const wx = ((i * 377) % 900) - 450; D.nuage(g, X(wx), sy, 70 * s + 40, i); } }
  // le sol, la plateforme ou la barge, la tour
  if(!haute && solY < H + 40){
    sol(decor, solY, s, X, camX);
    if(sp.type === 'barge') barge(g, X(sp.pad.x), sp.pad.tol * s, solY, s, V.t);
    else if(sp.type === 'dragon') bateau(g, X(sp.pad.x), 26 * s + 18, solY, s, V.t);
    else if(sp.pad && !sp.tour){ const px = X(sp.pad.x), pw = sp.pad.tol * s; table(g, px, pw, solY, s, false); g.fillStyle = '#fff'; g.font = `800 ${Math.max(10, 5 * s)}px sans-serif`; g.textAlign = 'center'; g.fillText('H', px, solY + 8 * s); }
    if(sp.tour){ const tx = X(sp.tour.x + 22); table(g, X(sp.tour.x), 26 * s, solY, s, true); tour(g, tx, solY, s, { ...sp.tour, pin:(HAUTEUR_REELLE[kind] || 70) * .72, demi:(HAUTEUR_REELLE[kind] || 70) * (LARGEUR[kind] || .1) / 2 }, fin && fin.issue === 'succes' ? clamp((performance.now() - fin.t0) / 500, 0, 1) : 0, V.t); }
    if(prog && !sp.tour){ table(g, X(0), 24 * s, solY, s, true); tour(g, X(34), solY, s * .9, null, false, V.t); }                                   // la tour de lancement, au décollage
    // les lignes à suivre : l'allumage et le retournement
    g.setLineDash([8, 6]); g.lineWidth = 2; g.textAlign = 'left'; g.font = '800 12px "Bricolage Grotesque", sans-serif';
    const ev = EV;
    const ligne = (y, c, txt, fort) => { const ly = vyScr + (V.y - y) * s; if(ly > 20 && ly < H){ g.strokeStyle = c; g.lineWidth = fort ? 3 : 2; g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke(); g.fillStyle = c; g.textAlign = 'right'; g.fillText(txt, W - 62, ly - 6); g.textAlign = 'left'; } else if(ly >= H && fort){ g.fillStyle = c; g.textAlign = 'right'; g.fillText(`▼ ${txt} : ${fmt(V.y - y)} m plus bas`, W - 12, H - 8); g.textAlign = 'left'; } };
    if(ev.allume){ ligne(ev.allume.y, '#38E08A', 'ALLUME ICI', true); ligne(ev.allume.tard, '#FF5A4D', 'trop tard', false); }
    if(ev.retourne){ ligne(ev.retourne.y, '#5AB0FF', 'RETOURNE-TOI ICI', true); ligne(ev.retourne.tard, '#FF5A4D', 'trop tard', false); }
    g.setLineDash([]);
  }
  // le véhicule (ou son fantôme de trajectoire)
  const bx = W / 2, by = vyScr;
  // la fumée et les débris
  for(const p of parts){ const a = 1 - p.t / p.vie, px = haute ? bx + p.x * s : X(p.x), py = haute ? by - p.y * s : solY - p.y * s; g.globalAlpha = clamp(a, 0, 1) * .9; g.fillStyle = p.c; g.beginPath(); g.arc(px, py, p.r * (p.g ? 1 : 1 + p.t * 1.6), 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if(!(fin && fin.issue === 'echec')){
    let bxx = bx, byy = by, th = V.th;
    if(!haute && sp.tour && fin && fin.issue === 'succes'){ bxx = X(sp.tour.x); byy = solY - sp.tour.y * s; th = 0; }
    const jambes = !haute && V.phase === 'vol' && V.y < 150 && (sp.pad || sp.tour) && V.retourne !== false;
    vehicule(g, kind, bxx, byy, hv, th, { gaz:V.gaz, chaleur:V.plasma || 0, jambes:jambes || sp.type === 'saut', chutes:V.chute ? (V.chuteK || 0) : 0 });
    const ac = mireOn && !fin ? S.angleCible(V) : null;
    if(ac){ const a = th * RAD, rm = clamp(hv * .5 + 36, 62, Math.min(120, H * .3)); mire(bxx + Math.sin(a) * hv * .5, byy - Math.cos(a) * hv * .5, rm, th, ac.th, ac.tol, { vx:V.vx, vy:V.vy, vmin:12 }); }
  }
  dessinerHUD(sp, prog);
}
/* ---------- La mire : l'angle à suivre (comme le guidage de Space Agency) ---------- */
let mireOn = lire('starship-mire', true) !== false;
const RAD = Math.PI / 180, norm180 = a => ((a + 540) % 360) - 180;
// cx, cy : le centre du vaisseau ; th : son angle (0 = vertical, + = vers la droite) ; cible : l'angle à suivre ; tol : la marge ; o.guide : un 2e angle conseillé ; o.vx, o.vy : la vitesse (repères prograde et rétrograde)
function mire(cx, cy, r, th, cible, tol, o = {}){
  const P = (a, rr) => [cx + Math.sin(a * RAD) * rr, cy - Math.cos(a * RAD) * rr];
  const err = cible == null ? null : norm180(cible - th), ok = err != null && Math.abs(err) <= tol;
  g.save(); g.lineCap = 'round';
  g.lineWidth = 2; g.setLineDash([3, 7]); g.strokeStyle = ok ? 'rgba(124,240,182,.85)' : 'rgba(255,255,255,.42)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.setLineDash([]);
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); for(let a = 0; a < 360; a += 30){ const [x1, y1] = P(a, r - (a % 90 ? 3 : 6)), [x2, y2] = P(a, r + (a % 90 ? 3 : 6)); g.moveTo(x1, y1); g.lineTo(x2, y2); } g.stroke();
  if(cible != null){ g.lineWidth = 8; g.strokeStyle = ok ? 'rgba(80,240,150,.65)' : 'rgba(90,200,255,.5)'; g.beginPath(); g.arc(cx, cy, r, (cible - tol - 90) * RAD, (cible + tol - 90) * RAD); g.stroke(); }
  // les repères de la trajectoire : prograde (cercle et ailes), rétrograde (cercle et croix)
  const vit = Math.hypot(o.vx || 0, o.vy || 0);
  if(vit > (o.vmin || 8)){ const a = Math.atan2(o.vx, o.vy) / RAD;
    { const [x1, y1] = P(a, r), [x2, y2] = P(a + 180, r); g.strokeStyle = 'rgba(124,240,182,.55)'; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);      // l'axe de la trajectoire, projeté à travers le vaisseau
      const [px, py] = P(a, r + 20), [qx, qy] = P(a, r + 46); g.strokeStyle = 'rgba(124,240,182,.4)'; g.beginPath(); g.moveTo(px, py); g.lineTo(qx, qy); g.stroke(); }
    for(const [aa, retro] of [[a, false], [a + 180, true]]){ const [x, y] = P(aa, r); g.strokeStyle = '#7CF0B6'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.stroke(); g.beginPath();
    if(!retro){ g.moveTo(x - 11, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 11, y); g.moveTo(x, y - 6); g.lineTo(x, y - 10); } else { g.moveTo(x - 4, y - 4); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y - 4); g.lineTo(x - 4, y + 4); } g.stroke(); } }
  if(o.guide != null){ const [x, y] = P(o.guide, r), c = Math.abs(norm180(o.guide - th)) <= 6; g.fillStyle = c ? '#7CF0B6' : '#FFD23A'; g.strokeStyle = 'rgba(0,0,20,.7)'; g.lineWidth = 2; g.save(); g.translate(x, y); g.rotate(o.guide * RAD); g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 5); g.lineTo(0, 1); g.lineTo(-7, 5); g.closePath(); g.stroke(); g.fill(); g.restore(); }
  // l'axe du vaisseau (repère blanc) et le losange de la cible
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; g.setLineDash([2, 5]); const [ax, ay] = P(th, r - 8); g.beginPath(); g.moveTo(cx, cy); g.lineTo(ax, ay); g.stroke(); g.setLineDash([]);
  { const [x, y] = P(th, r); g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,20,.7)'; g.lineWidth = 2; g.save(); g.translate(x, y); g.rotate(th * RAD); g.beginPath(); g.moveTo(0, 2); g.lineTo(7, -9); g.lineTo(-7, -9); g.closePath(); g.stroke(); g.fill(); g.restore(); }
  if(cible != null){ const [x, y] = P(cible, r); g.fillStyle = ok ? '#5BF09A' : '#4FC3FF'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x + 8, y); g.lineTo(x, y + 10); g.lineTo(x - 8, y); g.closePath(); g.fill(); g.stroke(); }
  g.restore();
  if(err != null){ const t = ok ? '✔ angle bon' : err < 0 ? `◀ ${Math.abs(err).toFixed(0)}°` : `${err.toFixed(0)}° ▶`; texteHUD(t, cx, cy + r + 18, 13, ok ? '#7CF0B6' : '#8FD8FF', 'center'); }
}
/* ---------- Les alertes : on prévient bien avant (compte à rebours), pas au dernier moment ---------- */
let alerteDern = {}, vj = 0, jDern = null, EV = {}, pilCx = 0, pilOn = false, yHud = 0, yMsg = 134, yPilule = 8;
// le temps pour parcourir d mètres en chute, avec la vitesse vv (m/s) et la pesanteur gg
const chrono = (d, vv, gg) => d <= 0 ? 0 : (gg > 0 ? (-vv + Math.sqrt(vv * vv + 2 * gg * d)) / gg : d / Math.max(1, vv));
// une pilule en haut au milieu (avec une barre qui se remplit à mesure qu'on s'approche)
function pilule(txt, c, y, frac, urgent){
  pilOn = true; const wd = Math.min(W - 24, 340), cx = pilCx || W / 2, x = clamp(cx - wd / 2, 8, W - wd - 8), pulse = urgent ? .5 + .5 * Math.sin(performance.now() / 90) : 0;
  g.fillStyle = 'rgba(8,12,28,.8)'; rondRect(g, x, y, wd, 40, 20); g.fill(); g.lineWidth = 3; g.strokeStyle = c; g.globalAlpha = urgent ? .55 + .45 * pulse : 1; rondRect(g, x, y, wd, 40, 20); g.stroke(); g.globalAlpha = 1;
  if(frac != null){ g.fillStyle = c; rondRect(g, x + 10, y + 33, Math.max(6, (wd - 20) * clamp(frac, 0, 1)), 4, 2); g.fill(); }
  texteHUD(txt, x + wd / 2, y + 22, 15, '#fff', 'center');
}
// titres : [avant, maintenant] ; t = secondes avant l'événement (≤ 0 : c'est maintenant) ; tmax : à partir de quand on prévient ; cn : la couleur de « maintenant »
function alerte(cle, titres, t, tmax, y0, cn){
  if(t > tmax) return;
  const now = t <= 0.05, urgent = t <= 3, c = now ? (cn || '#38E08A') : urgent ? '#FF8A3D' : '#FFD23A';
  pilule(now ? titres[1] : `${titres[0]} dans ${Math.max(0, t).toFixed(t < 10 ? 1 : 0).replace('.', ',')} s`, c, y0 ?? 70, 1 - t / tmax, urgent || now);
  const k = Math.ceil(t); if(t > 0 && t <= 3.2 && alerteDern[cle] !== k){ alerteDern[cle] = k; bip(520 + (4 - k) * 140, .1, .09); } else if(t <= 0 && alerteDern[cle] !== 0){ alerteDern[cle] = 0; bip(990, .25, .1); }
}
// les moments à venir dans un niveau : l'allumage (ligne verte, bien avant le dernier moment), le retournement, la pression max, la séparation
function evenements(){
  const ev = {}, gg = S.gDe(V);
  if(V.phase === 'vol' && V.vy < -4 && !V.fini && !V.manque && V.y > 12){ const ya = S.hauteurAllumage(V); if(isFinite(ya) && ya > 0) ev.allume = { y:ya * 1.5, tard:ya * 1.1, t:chrono(V.y - ya * 1.5, -V.vy, gg) }; }
  if(V.phase === 'plat' && !V.fini && V.th > 80){ const yr = S.altitudeRetournement(V); ev.retourne = { y:yr * 1.4, tard:yr * 1.05, t:chrono(V.y - yr * 1.4, -V.vy, gg) }; }
  if(V.phase === 'programme' && !V.fini){
    if(jDern && V.t > jDern.t + .25){ const r = (V.jauge - jDern.j) / (V.t - jDern.t); vj = vj ? vj * .7 + r * .3 : r; jDern = { t:V.t, j:V.jauge }; } else if(!jDern) jDern = { t:V.t, j:V.jauge };
    const P = V.spec.programme, vv = Math.max(.002, vj);
    if(V.jauge < .17) ev.maxq = { t:(.17 - V.jauge) / vv };
    if(V.etage === 1 && V.jauge < P.etageA) ev.sep = { t:(P.etageA - V.jauge) / vv };
  }
  return ev;
}
/* ---------- Les widgets : le style des retransmissions de lancement (plaques sombres, majuscules, chronomètre T+, télémétrie) ---------- */
const WF = '"Bricolage Grotesque", system-ui, sans-serif', hms = t => { t = Math.max(0, Math.floor(t)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
function wPlaque(x, y, w, h){ g.fillStyle = 'rgba(5,8,14,.7)'; g.fillRect(x, y, w, h); g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(x, y, w, 1.5); }
function wTexte(t, x, y, px, coul = '#fff', align = 'left', poids = 600, esp = 0){
  g.font = `${poids} ${px}px ${WF}`; g.textAlign = align; g.fillStyle = coul; try{ g.letterSpacing = esp ? esp + 'px' : '0px'; }catch(e){} g.fillText(t, x, y); try{ g.letterSpacing = '0px'; }catch(e){}
}
// un champ de télémétrie : une étiquette en petites capitales et sa valeur en grand
function wChamp(x, y, label, val, unite, coul){
  wTexte(label.toUpperCase(), x, y, 9, 'rgba(255,255,255,.55)', 'left', 600, 1);
  wTexte(val, x, y + 20, 21, coul || '#fff', 'left', 700); g.font = `700 21px ${WF}`; const m = g.measureText(val).width; if(unite) wTexte(unite, x + m + 4, y + 20, 10, 'rgba(255,255,255,.6)', 'left', 600, .5);
}
// une barre fine avec son étiquette et sa valeur
function wBarre(x, y, w, label, v, coul, txt){
  wTexte(label.toUpperCase(), x, y + 8, 9, 'rgba(255,255,255,.55)', 'left', 600, 1); if(txt) wTexte(txt, x + w, y + 8, 10, 'rgba(255,255,255,.85)', 'right', 700);
  g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x, y + 11, w, 4); g.fillStyle = coul; g.fillRect(x, y + 11, Math.max(0, w * clamp(v, 0, 1)), 4);
}
const kmh = ms => fmt(ms * 3.6), altTxt = m => m >= 10000 ? [(m / 1000).toFixed(1).replace('.', ','), 'km'] : [fmt(m), 'm'];
// les deux plaques : le titre et le chronomètre ; les chiffres et les barres. Rend le bas de ce qui est dessiné (pour caler le texte dessous).
function wTelemetrie(titre, t, champs, barres, extra, lignes = []){
  const col = W > H * 1.1, w1 = col ? 222 : 172, x2 = col ? 8 : 188, y2 = col ? 66 : 8, w2 = col ? 222 : Math.min(150, W - 188 - 52);
  wPlaque(8, 8, w1, 52); wTexte(titre.toUpperCase(), 16, 25, 10, '#9FB4D8', 'left', 600, 1); wTexte(`T+ ${hms(t)}`, 16, 50, 25, '#fff', 'left', 700, 1);
  if(extra) wTexte(extra, 8 + w1 - 8, 50, 10, '#FFD45C', 'right', 700, .5);
  const nl = Math.ceil(champs.length / 2), h2 = 10 + nl * 33 + barres.length * 18 + 4 + lignes.length * 13;
  wPlaque(x2, y2, w2, h2);
  champs.forEach((c, i) => wChamp(x2 + 8 + (i % 2) * (w2 / 2), y2 + 12 + (i / 2 | 0) * 33, c[0], c[1], c[2], c[3]));
  barres.forEach((b, i) => wBarre(x2 + 8, y2 + 10 + nl * 33 + i * 18, w2 - 16, b[0], b[1], b[2], b[3]));
  lignes.forEach((l, i) => wTexte(l[0], x2 + 8, y2 + 10 + nl * 33 + barres.length * 18 + 11 + i * 13, 9.5, l[1] || 'rgba(255,255,255,.7)', 'left', 600, .4));
  return { bas:Math.max(60, y2 + h2), col };
}
function jauge(x, y, w, h, v, c, titre, txt){
  g.fillStyle = 'rgba(0,0,0,.45)'; rondRect(g, x, y, w, h, h / 2); g.fill(); g.fillStyle = c; rondRect(g, x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); g.fill();
  g.fillStyle = '#fff'; g.font = '700 10px "Bricolage Grotesque", sans-serif'; g.textAlign = 'left'; g.fillText(titre, x + 6, y + h - 2.5); if(txt){ g.textAlign = 'right'; g.fillText(txt, x + w - 6, y + h - 2.5); }
}
function texteHUD(t, x, y, taille = 12, couleur = '#fff', align = 'left'){ g.font = `800 ${taille}px "Bricolage Grotesque", sans-serif`; g.textAlign = align; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,20,.75)'; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = couleur; g.fillText(t, x, y); }
// un texte centré qui passe à la ligne s'il est trop long ; rend la hauteur prise
function texteLong(t, x, y, taille, couleur, gauche, maxL){
  g.font = `800 ${taille}px "Bricolage Grotesque", sans-serif`; const max = maxL || W - 30, mots = String(t).split(' '), lignes = []; let l = '';
  for(const m of mots){ const essai = l ? l + ' ' + m : m; if(g.measureText(essai).width > max && l){ lignes.push(l); l = m; } else l = essai; }
  lignes.push(l); lignes.forEach((ln, i) => texteHUD(ln, x, y + i * (taille + 4), taille, couleur, gauche ? 'left' : 'center')); return lignes.length * (taille + 4);
}
function dessinerHUD(sp, prog){
  const p = V.p, vit = prog ? V.jauge * 7800 : Math.hypot(V.vx, V.vy);
  let hud;
  if(prog){
    const [av, au] = altTxt(V.y), cs = V.contrainte / p.resStructure;
    hud = wTelemetrie(sp.titre, V.t, [['Vitesse', kmh(vit), 'km/h'], ['Altitude', av, au]], [['Orbite', V.jauge, '#38E08A', `${Math.round(V.jauge * 100)} %`], ['Carburant', V.carb, '#5AB0FF', `${Math.round(V.carb * 100)} %`], ['Poussée', V.gaz, '#FF8A3D', `${Math.round(V.gaz * 100)} %`], ['Contrainte', cs, cs > .7 ? '#FF4D4D' : '#FFB347', `${Math.round(cs * 100)} %`]], V.etage === 1 ? 'ÉTAGE 1' : 'ÉTAGE 2');
    // la chronologie du vol : pression maximale, séparation, orbite
    const col = hud.col, bx = col ? 244 : 14, bw = col ? Math.max(120, W - 244 - 62) : W - 28, by = col ? 12 : hud.bas + 8;
    wPlaque(bx - 6, by - 4, bw + 12, 40);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx, by + 16, bw, 3); g.fillStyle = '#38E08A'; g.fillRect(bx, by + 16, bw * V.jauge, 3);
    const jalon = (u, txt, c, fait) => { const x = bx + bw * u; g.fillStyle = fait ? c : '#0B0F18'; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(x, by + 17.5, 5, 0, 7); g.fill(); g.stroke(); wTexte(txt, x, by + 6, 9, fait ? '#fff' : 'rgba(255,255,255,.6)', u > .9 ? 'right' : 'center', 600, 1); };
    jalon(.17, 'MAX-Q', '#FF8A8A', V.jauge > .31); jalon(sp.programme.etageA, 'SÉPARATION', '#5AB0FF', V.etage === 2); jalon(1, 'ORBITE', '#38E08A', V.jauge >= 1);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(bx + bw * V.jauge, by + 30); g.lineTo(bx + bw * V.jauge - 4, by + 36); g.lineTo(bx + bw * V.jauge + 4, by + 36); g.closePath(); g.fill();
    yHud = hud.col ? 52 : hud.bas + 52;
  } else {
    const [av, au] = altTxt(V.y), ch = V.chaleur / p.resChaleur, chaud = V.phase === 'plat' || V.phase === 'flip' || V.phase === 'capsule' || ch > .02;
    const barres = [['Carburant', V.carb, V.carb < .15 ? '#FF4D4D' : '#5AB0FF', `${Math.round(V.carb * 100)} %`], [V.phase === 'plat' ? 'Cabrage' : 'Poussée', V.gaz, '#FF8A3D', `${Math.round((V.phase === 'plat' ? V.attaque : V.gaz) * 100)} %`]];
    if(chaud) barres.push(['Chaleur', ch, ch > .75 ? '#FF4D4D' : '#FFB347', `${Math.round(ch * 100)} %`]);
    hud = wTelemetrie(sp.titre, V.t, [['Vitesse', kmh(vit), 'km/h'], ['Altitude', av, au], ['Vit. vert.', Math.abs(V.vy).toFixed(0), V.vy < 0 ? 'm/s ▼' : 'm/s ▲', V.vy < -20 ? '#FFB347' : '#fff'], ['Latéral', Math.abs(V.vx).toFixed(1).replace('.', ','), 'm/s']], barres, `${Math.abs(V.th) < .5 ? '' : V.th > 0 ? '+' : '−'}${Math.abs(V.th).toFixed(0)}°`);
    yHud = 0;
  }
  yMsg = hud.col ? hud.bas + 8 : Math.max(H * .17, hud.bas + 60); yPilule = hud.col ? (prog ? 58 : 8) : hud.bas + (prog ? 56 : 6);
  // la cible hors de l'écran, et les consignes
  if(!prog && (sp.pad || sp.tour)){ const tx = sp.tour ? sp.tour.x : sp.pad.x, dx = tx - V.x, s = echelleDe(V.y); if(Math.abs(dx) * s > W / 2 - 30){ texteHUD(`${dx > 0 ? '' : '◀ '}${sp.tour ? 'tour' : 'plateforme'} ${Math.abs(dx).toFixed(0)} m${dx > 0 ? ' ▶' : ''}`, dx > 0 ? W - 14 : 14, H * .58, 12, '#9CCBFF', dx > 0 ? 'right' : 'left'); } }
  const col0 = W > H * 1.1, ya0 = yPilule; pilCx = col0 && !prog ? Math.max(W / 2, 600) : W / 2; pilOn = false;
  if(!fin){
    if(V.phase === 'capsule' && !V.chute){ const vit = Math.hypot(V.vx, V.vy); if(vit <= 230) alerte('para', ['', 'OUVRE LES PARACHUTES !'], 0, 1, ya0); else pilule(`Parachutes : attends (${vit.toFixed(0)} m/s, sous 230)`, '#FFD23A', ya0, clamp(1 - (vit - 230) / 400, 0, 1), false); }
    else if(EV.allume && V.gaz < .5){ if(V.y < EV.allume.tard) pilule('TROP TARD : POUSSÉE À FOND !', '#FF4D4D', ya0, null, true); else alerte('allume', ['ALLUME', 'ALLUME MAINTENANT !'], EV.allume.t, 10, ya0); }
    else if(EV.retourne){ if(V.y < EV.retourne.tard) pilule('RETOURNE-TOI VITE !', '#FF4D4D', ya0, null, true); else alerte('retourne', ['RETOURNE-TOI', 'RETOURNE-TOI MAINTENANT !'], EV.retourne.t, 10, ya0); }
    else if(prog && V.maxQ) pilule('PRESSION MAX : RELÂCHE LA POUSSÉE !', '#FF4D4D', ya0, null, true);
    else if(prog && V.fenetre && V.etage === 1) alerte('sep', ['', 'SÉPARE MAINTENANT !'], 0, 1, ya0);
    else if(EV.maxq && EV.maxq.t < 9) alerte('maxq', ['PRESSION MAX', 'PRESSION MAX'], EV.maxq.t, 9, ya0, '#FF8A3D');
    else if(EV.sep && EV.sep.t < 12) alerte('sep0', ['SÉPARATION', 'SÉPARATION'], EV.sep.t, 12, ya0);
  }
  const info = pilOn && !col0 ? '' : consigne(sp, prog);
  let dy = 0; if(bandeauMsg && (V.t - bandeauMsg.at < 4.5 || bandeauMsg.at === 0)){ const c = bandeauMsg.cls === 'bon' ? '#7CF0B6' : bandeauMsg.cls === 'mal' ? '#FF9A9A' : '#FFE08A'; const col = W > H * 1.1;   // en paysage : les messages dans une colonne à gauche, sous les chiffres, loin du véhicule
    dy = col ? texteLong(bandeauMsg.t, 14, yMsg + 8, 14, c, true, Math.min(W * .34, 300)) : texteLong(bandeauMsg.t, W / 2, yMsg, 16, c); }
  if(info){ const col = W > H * 1.1; if(col) texteLong(info, 14, yMsg + 8 + dy + 6, 13, '#fff', true, Math.min(W * .34, 300)); else texteLong(info, W / 2, yMsg + dy + 6, 14, '#fff'); }
  // le bouton d'action
  const b = $('bAction'); let lib = '—', ok = false;
  if(V.phase === 'programme' && V.etage === 1 && V.fenetre){ lib = 'SÉPARER'; ok = true; }
  else if(V.phase === 'vol' && sp.belly && V.atteint && !V.retourne && V.vy < -3 && V.gaz < .05){ lib = 'BASCULER'; ok = true; }
  else if(V.phase === 'plat' && V.th > 80){ lib = 'RETOURNER'; ok = true; }
  else if(V.phase === 'capsule' && !V.chute){ lib = 'PARACHUTES'; ok = true; }
  b.textContent = lib; b.disabled = !ok || !!fin;
  if(V.phase !== phasePrec){
    if(V.phase === 'plat') reglerPuissance(.4, 'CABRER'); else if(phasePrec === 'plat' || phasePrec === 'flip') reglerPuissance(0, 'POUSSÉE');
    phasePrec = V.phase;
  }
  $('bPoussee').textContent = V.phase === 'plat' ? 'CABRER' : 'POUSSÉE';
}
function consigne(sp, prog){
  if(fin) return '';
  if(V.phase === 'capsule') return V.chute ? 'Parachutes ouverts : descente en douceur (◀ ▶ pour te rapprocher du bateau)' : `Vitesse ${Math.hypot(V.vx, V.vy).toFixed(0)} m/s : ouvre les PARACHUTES sous 230 m/s, pas trop haut`;
  if(prog) return V.maxQ ? '⚠ Pression maximale : relâche la poussée !' : V.fenetre && V.etage === 1 ? 'Appuie sur SÉPARER au repère' : '';
  if(!V.enVol && V.phase === 'vol' && V.t < 60) return 'POUSSÉE : tiens le bouton pour décoller';
  if(sp.type === 'saut' && !V.atteint) return `Monte à ${sp.cible} m (altitude ${fmt(V.y)} m)`;
  if(sp.type === 'saut' && V.atteint && V.y > 30) return 'Penche (◀ ▶) et pose-toi sur la plateforme jaune';
  if(sp.type === 'altitude' && !V.atteint) return `Apogée prévu ${fmt(S.apogeePrevu(V))} m sur ${fmt(sp.cible)} m`;
  if(V.phase === 'plat') return V.th < 80 ? 'Retournement à plat…' : 'Ailerons ◀ ▶ · CABRER pour freiner · RETOURNE-TOI dès le repère bleu';
  if(V.phase === 'flip') return 'Redressement ! Prépare l\'allumage';
  if(V.phase === 'vol' && V.vy < -4) return V.y < 12 ? '' : `Allume dès la ligne verte (le rouge, c'est trop tard) · vitesse max au sol ${V.p.vAtterr.toFixed(0)} m/s`;
  return '';
}

/* ---------- Les commandes ---------- */
const lie = (id, cle) => { const b = $(id), on = v => { entrees[cle] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} on(true); if(cle === 'action') entrees.action = true; audio(); });
  const off = e => { e.preventDefault(); if(cle !== 'action') on(false); else b.classList.remove('on'); };
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', () => { if(cle !== 'action') on(false); });
  b.addEventListener('contextmenu', e => e.preventDefault()); };
lie('bGauche', 'gauche'); lie('bDroite', 'droite'); lie('bPoussee', 'gaz'); lie('bAction', 'action');
// les curseurs : la direction (revient au milieu) et la puissance (reste en place)
let mode = lire('starship-commandes', window.matchMedia && matchMedia('(pointer:coarse)').matches ? 'curseurs' : 'boutons'), phasePrec = null;
const cH = $('cH'), pH = $('pH'), cV = $('cV'), pV = $('pV'), rempl = $('remplissage'), POUCE = 88;
const posH = v => { pH.style.transform = `translate(${v * (cH.clientWidth / 2 - POUCE / 2 - 6)}px, -50%)`; };
const posV = v => { pV.style.top = `${(1 - v) * (cV.clientHeight - POUCE)}px`; rempl.style.height = `${v * 100}%`; };
function reglerPuissance(v, etiquette){ if(mode === 'curseurs') entrees.cible = v; posV(v); if(etiquette) pV.textContent = etiquette; }
function appliquerMode(){
  document.body.classList.toggle('mode-boutons', mode === 'boutons'); $('bCommandes').textContent = `🎚 Commandes : ${mode}`;
  if(mode === 'boutons'){ delete entrees.dir; delete entrees.cible; } else { entrees.dir = 0; entrees.cible = 0; }
  requestAnimationFrame(() => { posH(0); posV(0); pV.textContent = 'POUSSÉE'; });
}
{ let idH = null;
  const majH = x => { const r = cH.getBoundingClientRect(), m = r.width / 2 - POUCE / 2 - 6, v = clamp((x - (r.left + r.width / 2)) / m, -1, 1); entrees.dir = Math.abs(v) < .06 ? 0 : v; posH(v); };
  cH.addEventListener('pointerdown', e => { e.preventDefault(); try{ cH.setPointerCapture(e.pointerId); }catch(x){} idH = e.pointerId; majH(e.clientX); audio(); });
  cH.addEventListener('pointermove', e => { if(idH === e.pointerId) majH(e.clientX); });
  const finH = e => { if(idH !== e.pointerId) return; idH = null; entrees.dir = 0; pH.style.transition = 'transform .15s'; posH(0); setTimeout(() => { pH.style.transition = ''; }, 170); };
  cH.addEventListener('pointerup', finH); cH.addEventListener('pointercancel', finH);
  let idV = null;
  const majV = y => { const r = cV.getBoundingClientRect(), v = 1 - clamp((y - r.top - POUCE / 2) / (r.height - POUCE), 0, 1); reglerPuissance(v < .05 ? 0 : v); };
  cV.addEventListener('pointerdown', e => { e.preventDefault(); try{ cV.setPointerCapture(e.pointerId); }catch(x){} idV = e.pointerId; majV(e.clientY); audio(); });
  cV.addEventListener('pointermove', e => { if(idV === e.pointerId) majV(e.clientY); });
  const finV = e => { if(idV === e.pointerId) idV = null; };
  cV.addEventListener('pointerup', finV); cV.addEventListener('pointercancel', finV);
}
addEventListener('resize', () => { if(!$('eVol').hidden && mode === 'curseurs'){ posH(entrees.dir || 0); posV(entrees.cible || 0); } });
$('bMire').onclick = () => { mireOn = !mireOn; ecrire('starship-mire', mireOn); $('bMire').textContent = `🎯 Mire : ${mireOn ? 'oui' : 'non'}`; };
$('bMire').textContent = `🎯 Mire : ${mireOn ? 'oui' : 'non'}`;
$('bCommandes').onclick = () => { mode = mode === 'curseurs' ? 'boutons' : 'curseurs'; ecrire('starship-commandes', mode); appliquerMode(); };
const touches = { ArrowLeft:'gauche', ArrowRight:'droite', ArrowUp:'gaz', ' ':'gaz', Enter:'action', ArrowDown:'action', Shift:'action' };
addEventListener('keydown', e => { const k = touches[e.key]; if(!k || $('eVol').hidden) return; e.preventDefault(); if(k === 'action'){ if(!e.repeat) entrees.action = true; } else entrees[k] = true; });
addEventListener('keyup', e => { const k = touches[e.key]; if(!k || k === 'action') return; entrees[k] = false; });
$('bPause').onclick = () => { enPause = true; voile('vPause', true); arreterMoteur(); };
$('bReprendre').onclick = () => { enPause = false; voile('vPause', false); dernier = performance.now(); };
$('bVitesse').onclick = () => { vitesse = vitesse === 1 ? 2 : 1; $('bVitesse').textContent = `⏩ Vitesse ×${vitesse}`; };
$('bSon').onclick = () => { son = !son; ecrire('starship-son', son); $('bSon').textContent = son ? '🔊 Son' : '🔇 Son coupé'; if(!son) arreterMoteur(); };
$('bMenu').onclick = () => { accueil(); ecran('eAccueil'); };
$('bContinuer').onclick = () => ecran('eNiveaux');
$('bReset').onclick = () => { if(confirm('Effacer toute la progression (étoiles, records) ?')){ R = rec0(); sauver(); accueil(); } };
$('bAbandon').onclick = () => { if(B){ quitterBac(); ecran('eBacReg'); reglages(); return; } if(!confirm('Abandonner le vol ?')) return; voile('vPause', false); enPause = false; V.gaz = 0; V.fini = 'echec'; V.cause = 'Vol abandonné.'; terminaison(); };
$('bAide').onclick = $('bAide2').onclick = () => voile('vAide', true); $('bAideFermer').onclick = () => voile('vAide', false);
$('bSon').textContent = son ? '🔊 Son' : '🔇 Son coupé';

/* ---------- Le bac à sable ---------- */
const CLE_BAC = 'starship-bac';
let cfg = Object.assign({ monde:'terre', vehicule:'falcon9', depart:'sol', vent:false, illimite:false, tour:false }, lire(CLE_BAC, {}));
let warp = 1, debris = [], bacFin = null, bacMsgVus = 0, bacMsg = null, chK = 0, bacParts = [];
const WARPS = [1, 4, 16, 64], SAS_LIB = { libre:'libre', tenir:'tenir le cap', prograde:'avant (trajectoire)', retro:'arrière (frein)', vertical:'vertical' };
function reglages(){
  if(!BAC.MONDES[cfg.monde]) cfg.monde = 'terre'; if(!BAC.VEHICULES[cfg.vehicule]) cfg.vehicule = 'falcon9';
  const Vh = BAC.VEHICULES[cfg.vehicule];
  const departs = Vh.departs.filter(d => cfg.monde === 'terre' || d !== 'retour'); if(!departs.includes(cfg.depart)) cfg.depart = departs[0];
  const btn = (id, cle, lst, lib) => lst.map(k => `<button data-${id}="${k}" class="${cfg[cle] === k ? 'sel' : ''}">${lib(k)}</button>`).join('');
  $('chMonde').innerHTML = btn('m', 'monde', Object.keys(BAC.MONDES), k => `${BAC.MONDES[k].ico} ${BAC.MONDES[k].nom}<br><small>${BAC.MONDES[k].g} m/s²${BAC.MONDES[k].rho0 ? '' : ' · sans air'}</small>`);
  $('chVeh').innerHTML = btn('v', 'vehicule', Object.keys(BAC.VEHICULES), k => `${BAC.VEHICULES[k].ico} ${BAC.VEHICULES[k].nom}`);
  $('txtVeh').textContent = Vh.txt + ' (' + Vh.etages.length + ' étage' + (Vh.etages.length > 1 ? 's' : '') + ')';
  const dn = { sol:'🏗️ Au sol', orbite:'🛰️ En orbite', retour:'☄️ En descente (le retour)' };
  $('chDep').innerHTML = btn('d', 'depart', departs, k => dn[k]);
  $('chOpt').innerHTML = [['vent', '💨 Vent'], ['illimite', '♾️ Carburant illimité'], ['tour', '🗼 Tour à bras (rattraper)']].map(([k, l]) => `<button data-o="${k}" class="${cfg[k] ? 'sel' : ''}">${l}</button>`).join('');
  document.querySelectorAll('#chMonde button').forEach(b => b.onclick = () => { cfg.monde = b.dataset.m; reglages(); });
  document.querySelectorAll('#chVeh button').forEach(b => b.onclick = () => { cfg.vehicule = b.dataset.v; reglages(); });
  document.querySelectorAll('#chDep button').forEach(b => b.onclick = () => { cfg.depart = b.dataset.d; reglages(); });
  document.querySelectorAll('#chOpt button').forEach(b => b.onclick = () => { cfg[b.dataset.o] = !cfg[b.dataset.o]; reglages(); });
  ecrire(CLE_BAC, cfg);
}
function lancerBac(){
  V = null; B = BAC.nouveau({ monde:cfg.monde, vehicule:cfg.vehicule, depart:cfg.depart, vent:cfg.vent ? 6 : 0, illimite:cfg.illimite, tour:cfg.tour && cfg.monde === 'terre' });
  alerteDern = {}; warp = 1; debris = []; bacFin = null; bacMsgVus = 0; bacMsg = { t:cfg.depart === 'sol' ? 'Pousse le curseur de droite (POUSSÉE) pour décoller · ⏏ Étage pour larguer · 🧭 règle le cap' : cfg.depart === 'orbite' ? 'En orbite : ◀ ▶ pour tourner, POUSSÉE pour changer d\'orbite · ⏩ accélère le temps (moteur coupé)' : BAC.VEHICULES[cfg.vehicule].etages[0].bouclier === 'base' ? 'Rentrée : le FOND de la capsule (le bouclier) doit faire face au vent. Ouvre les 🪂 sous 250 m/s' : BAC.VEHICULES[cfg.vehicule].etages[0].bouclier === 'ventre' ? 'Rentrée : présente le VENTRE au vent (cap ≈ 30°), puis redresse et rallume pour te poser' : 'Retour : freine avec les moteurs (POUSSÉE) et pose-toi, jambes sorties', at:0 }; chK = 0; bacParts = []; enPause = false;
  $('bacBts').hidden = false; $('bbWarp').textContent = '⏩ ×1'; $('bVitesse').style.display = 'none'; $('bAbandon').textContent = 'Quitter le bac à sable';
  ecran('eVol'); appliquerMode(); tailleVol(); dernier = performance.now(); acc = 0; audio(); reglerPuissance(0);
  cancelAnimationFrame(boucle); boucle = requestAnimationFrame(tick);
}
function quitterBac(){ B = null; arreterMoteur(); cancelAnimationFrame(boucle); $('bacBts').hidden = true; $('bVitesse').style.display = ''; $('bAbandon').textContent = 'Abandonner le vol'; voile('vResultat', false); voile('vPause', false); enPause = false; }
function entreeBac(){
  const e = { cible:entrees.cible, gaz:entrees.gaz, dir:entrees.dir };
  if(e.dir == null) e.dir = (entrees.droite ? 1 : 0) - (entrees.gauche ? 1 : 0);
  return e;
}
function tickBac(now){
  let dt = Math.min(.05, (now - dernier) / 1000); dernier = now;
  if(!enPause){
    const E = BAC.etage(B), atmo = B.M.atmo, ok = B.y > Math.max(2000, atmo * .8) && B.gaz < .01 && B.etat === 'vol';
    if(warp > 1 && !ok){ warp = 1; $('bbWarp').textContent = '⏩ ×1'; }
    const tot = dt * (bacFin ? 1 : warp), n = Math.max(1, Math.ceil(tot / .05)), d1 = tot / n;
    for(let i = 0; i < n && B.etat !== 'detruit'; i++) BAC.pas(B, entreeBac(), d1);
    for(const x of debris){ x.t += tot; const a = BAC.grav(B, x.y), r = BAC.rho(B, x.y); x.vy -= a * tot; x.vx -= x.vx * Math.abs(x.vx) * r * .0008 * tot; x.vy -= x.vy * Math.abs(x.vy) * r * .0008 * tot; x.x += x.vx * tot; x.y += x.vy * tot; x.th += x.om * tot; if(x.y <= 0){ x.mort = true; for(let k = 0; k < 40; k++){ const a2 = Math.random() * 6.28, v = 6 + Math.random() * 30; bacParts.push({ x:x.x, y:2, vx:Math.cos(a2) * v, vy:Math.abs(Math.sin(a2)) * v + 4, vie:1 + Math.random(), t:0, r:2 + Math.random() * 4, c:Math.random() < .5 ? '#FFB347' : '#7A7F8A' }); } } }
    debris = debris.filter(x => !x.mort && x.t < 400);
    if(B.gaz > .12 && B.y < 20000 && Math.random() < .6){ const a = B.th * Math.PI / 180; bacParts.push({ x:B.x + Math.sin(a) * -2, y:Math.max(0, B.y), vx:(Math.random() - .5) * 10, vy:-5 - Math.random() * 6, vie:.8 + Math.random(), t:0, r:3 + Math.random() * 3, c:'rgba(230,230,235,.6)' }); }
    for(const p of bacParts){ p.t += tot; p.x += p.vx * tot; p.y += p.vy * tot; if(p.y < 0){ p.y = 0; p.vy *= -.3; p.vx *= .7; } } bacParts = bacParts.filter(p => p.t < p.vie);
    if(BAC.etage(B) && B.chutes && chK < 1) chK = Math.min(1, chK + dt / 2.5);
    for(; bacMsgVus < B.msgs.length; bacMsgVus++){ bacMsg = { t:B.msgs[bacMsgVus].t, at:B.t, cls:B.msgs[bacMsgVus].cls }; if(B.msgs[bacMsgVus].cls === 'bon') bip(740, .14); else if(B.msgs[bacMsgVus].cls === 'mal') bip(180, .3, .1); else bip(520, .08, .05); }
    if(moteur){ moteur.gn.gain.value = B.gaz * .22; moteur.f.frequency.value = 160 + B.gaz * 480; }
    if(B.gaz > .02 && !moteur) demarrerMoteur(); if(B.gaz <= .02 && moteur) arreterMoteur();
    if(B.etat === 'detruit' && !bacFin){ bacFin = { t0:now }; arreterMoteur(); boum(); for(let k = 0; k < 90; k++){ const a = Math.random() * 6.28, v = 8 + Math.random() * 50; bacParts.push({ x:B.x, y:Math.max(2, B.y + 4), vx:Math.cos(a) * v, vy:Math.sin(a) * v * .8 + 8, vie:1 + Math.random() * 1.6, t:0, r:2 + Math.random() * 5, c:['#FF6A2B', '#FFB347', '#7A7F8A', '#2B2F38'][k % 4], g:k % 3 === 0 }); } }
    if(bacFin && now - bacFin.t0 > 1800 && !bacFin.montre){ bacFin.montre = true; finBac(); }
  }
  dessinerBac();
}
function finBac(){
  const o = BAC.orbite(B);
  $('fResultat').innerHTML = `<div class="grand">💥</div><h2>Vol terminé</h2><p><b>${esc(B.cause)}</b></p>
    <div class="stat"><div><b>${B.t.toFixed(0)} s</b>de vol</div><div><b>${fmt(B.maxY / 1000)} km</b>altitude max</div><div><b>${fmt(B.maxV)} m/s</b>vitesse max</div></div>
    <p>Dans le bac à sable, on essaie, on rate, on recommence : c'est comme ça que les ingénieurs apprennent.</p>
    <button class="btn gros" id="bRejouer">↻ Recommencer</button><button class="btn" id="bNiveaux">🧪 Changer les réglages</button>`;
  voile('vResultat', true);
  $('bRejouer').onclick = () => { quitterBac(); lancerBac(); };
  $('bNiveaux').onclick = () => { quitterBac(); ecran('eBacReg'); reglages(); };
}
// les boutons du bac
$('bBac').onclick = () => { ecran('eBacReg'); reglages(); };
$('bBacRetour').onclick = () => { accueil(); ecran('eAccueil'); };
$('bBacGo').onclick = lancerBac;
$('bbEtage').onclick = () => { if(!B) return; const E = BAC.etage(B), old = { ...E }; if(BAC.etageSuivant(B)) debris.push({ kind:E.kindSeul || E.kind, x:B.x, y:B.y, vx:B.vx, vy:B.vy, th:B.th, om:B.om * 6 + (Math.random() - .5) * 8, t:0, h:E.hauteur }); };
$('bbJambes').onclick = () => { if(B) BAC.jambes(B); };
$('bbChutes').onclick = () => { if(B) BAC.parachutes(B); };
$('bbSas').onclick = () => { if(!B) return; const i = BAC.SAS.indexOf(B.sas); B.sas = BAC.SAS[(i + 1) % BAC.SAS.length]; if(B.sas === 'tenir') B.cap = B.th; };
$('bbWarp').onclick = () => { if(!B) return; const E = B.y > Math.max(2000, B.M.atmo * .8) && B.gaz < .01; if(!E){ bacMsg = { t:'Accélération du temps : seulement dans le vide, moteur coupé', at:B.t, cls:'mal' }; return; } warp = WARPS[(WARPS.indexOf(warp) + 1) % WARPS.length]; $('bbWarp').textContent = `⏩ ×${warp}`; };
addEventListener('keydown', e => { if(!B || $('eVol').hidden) return; const k = e.key.toLowerCase(); if(k === 'e') $('bbEtage').click(); else if(k === 'g') $('bbJambes').click(); else if(k === 'p') $('bbChutes').click(); else if(k === 'c') $('bbSas').click(); else if(k === 't') $('bbWarp').click(); });

// le dessin du bac : le sol de près, la courbure du monde de loin, la carte d'orbite
function carteOrbite(cx, cy, r0){
  const M = B.M, mu = M.g * M.R * M.R, phi = B.x / M.R, rr = M.R + B.y;
  const px = rr * Math.sin(phi), py = rr * Math.cos(phi);
  const vxx = B.vx * Math.cos(phi) + B.vy * Math.sin(phi), vyy = -B.vx * Math.sin(phi) + B.vy * Math.cos(phi);
  const h = px * vyy - py * vxx, v2 = vxx * vxx + vyy * vyy, ex = ((v2 - mu / rr) * px - (px * vxx + py * vyy) * vxx) / mu, ey = ((v2 - mu / rr) * py - (px * vxx + py * vyy) * vyy) / mu, e = Math.hypot(ex, ey), p = h * h / mu;
  const o = BAC.orbite(B), rmax = Math.max(rr, o.ouverte ? rr * 1.5 : M.R + o.ap), k = (r0 - 4) / Math.min(rmax * 1.08, M.R * 6);
  g.fillStyle = 'rgba(8,12,28,.55)'; g.beginPath(); g.arc(cx, cy, r0, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = M.decor === 'lune' ? '#9A9AA2' : M.decor === 'mars' ? '#C26A3A' : '#2B6FD0'; g.beginPath(); g.arc(cx, cy, Math.max(3, M.R * k), 0, 7); g.fill();
  if(e < 1.2 && e > 1e-4){ const w = Math.atan2(ey, ex); g.strokeStyle = o.pe < 0 ? '#FF6A6A' : '#7CF0B6'; g.lineWidth = 2; g.beginPath(); let debut = false;
    for(let a = 0; a <= 360; a += 3){ const nu = a * Math.PI / 180, den = 1 + e * Math.cos(nu); if(den <= .02) continue; const r = p / den, ang = w + (h >= 0 ? -nu : nu), x = cx + r * Math.cos(ang) * k, y = cy - r * Math.sin(ang) * k; if(Math.hypot(x - cx, y - cy) > r0 - 1) { debut = false; continue; } if(!debut){ g.moveTo(x, y); debut = true; } else g.lineTo(x, y); } g.stroke(); }
  const vx = cx + px * k, vy = cy - py * k; g.fillStyle = '#FFD23A'; g.beginPath(); g.arc(clamp(vx, cx - r0 + 4, cx + r0 - 4), clamp(vy, cy - r0 + 4, cy + r0 - 4), 3.5, 0, 7); g.fill();
}
function dessinerBac(){
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const M = B.M, E = BAC.etage(B), decor = M.decor, vide = M.rho0 === 0, mars = decor === 'mars', haut = B.y >= 2500;
  const k = vide ? 1 : clamp(B.y / (M.atmo * .6), 0, 1);
  const c1 = mars ? mix([36, 18, 22], [3, 3, 8], k) : mix([40, 120, 226], [2, 4, 14], k), c2 = mars ? mix([210, 130, 90], [20, 10, 14], k) : mix([170, 216, 255], [10, 20, 50], k);
  const ciel = g.createLinearGradient(0, 0, 0, H); ciel.addColorStop(0, `rgb(${c1})`); ciel.addColorStop(1, `rgb(${c2})`); g.fillStyle = ciel; g.fillRect(0, 0, W, H);
  if(k > .15) etoiles(g, W, H, clamp((k - .15) * 2, 0, 1), B.x * .00002 + B.y * .00001);
  if(!vide && !mars && k < .85){ g.globalAlpha = 1 - k; D.soleil(g, W * .8, H * .16, 16); g.globalAlpha = 1; }
  const kind = E ? E.kind : 'starship', tv = TAILLE_VEH[kind] || [56, 134], real = (E && E.hauteur) || HAUTEUR_REELLE[kind] || 40;
  const s = haut ? 1 : echelleDe(B.y), hv = haut ? tv[1] * .8 : clamp(real * s, Math.max(tv[0], tv[1] * .55), tv[1]);
  const gy0 = H * .84, vyScr = haut ? H * .5 : clamp(gy0 - B.y * s, chK > 0 ? H * .66 : Math.min(H * .6, Math.max(H * .32, hv + 36)), H * .76), solY = haut ? H + 400 : vyScr + B.y * s, camX = B.x, X = x => W / 2 + (x - camX) * s;
  if(haut){
    const Rp = W * 4, mpp = M.R / Rp, drop = H * .12 + H * .5 / (1 + B.y / 40e3), cy = vyScr + drop + Rp, phi0 = B.x / mpp;
    if(M.rho0 > 0){ const gl = g.createRadialGradient(W / 2, cy, Rp, W / 2, cy, Rp + 26 * (1 - k * .6)); gl.addColorStop(0, mars ? 'rgba(255,170,110,.75)' : 'rgba(130,190,255,.8)'); gl.addColorStop(1, 'rgba(100,160,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(W / 2, cy, Rp + 26, 0, 7); g.fill(); }
    g.fillStyle = decor === 'lune' ? '#8A8A92' : mars ? '#B5603A' : '#2A68C8'; g.beginPath(); g.arc(W / 2, cy, Rp, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(W / 2, cy, Rp, 0, 7); g.clip();
    for(let i = -40; i <= 40; i++){ const arc = (i * 140 - (phi0 % 140)) , ang = arc / Rp, px = W / 2 + Math.sin(ang) * (Rp - 4), py = cy - Math.cos(ang) * (Rp - 4); if(px < -80 || px > W + 80) continue; const j = (Math.round((phi0 - (phi0 % 140)) / 140) + i); const hsh = Math.abs(Math.sin(j * 12.9898) * 43758.5453) % 1; g.fillStyle = decor === 'terre' ? (hsh < .55 ? 'rgba(255,255,255,.55)' : 'rgba(80,150,70,.55)') : 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(px, py + 6 + hsh * 20, 30 + hsh * 50, 5 + hsh * 6, 0, 0, 7); g.fill(); }
    g.restore();
    if(B.y < 60e3 && !vide){ g.fillStyle = 'rgba(255,255,255,.25)'; }
  } else {
    if(!vide && !mars){ g.fillStyle = 'rgba(255,255,255,.55)'; for(let i = 0; i < 9; i++){ const wy = 600 + i * 900, sy = vyScr + (B.y - wy) * s; if(sy < -60 || sy > H + 60) continue; const wx = ((i * 377) % 900) - 450; D.nuage(g, X(wx), sy, 60 * s * .8 + 40, i); } }
    if(solY < H + 40){
      sol(decor, solY, s, X, camX);
      table(g, X(0), 26 * s, solY, s, true);
      if(B.tour){ tour(g, X(22), solY, s, { y:75, tol:12, pin:(E && E.hauteur ? E.hauteur : 60) * .72, demi:4 }, B.etat === 'pose' && B.y > 10 ? 1 : 0, B.t); }
      else tour(g, X(34), solY, s * .9, null, false, B.t);
    }
    for(const x of debris){ const dh = clamp((x.h || 40) * s, 20, 150); vehicule(g, x.kind, X(x.x), solY - x.y * s, dh, x.th, { gaz:0 }); }
  }
  // les débris et la fumée
  for(const p of bacParts){ const a = 1 - p.t / p.vie; g.globalAlpha = clamp(a, 0, 1) * .9; g.fillStyle = p.c; g.beginPath(); g.arc(haut ? W / 2 + (p.x - B.x) * .05 : X(p.x), haut ? vyScr + (B.y - p.y) * .05 : solY - p.y * s, p.r * (p.g ? 1 : 1 + p.t * 1.6), 0, 7); g.fill(); } g.globalAlpha = 1;
  if(!(bacFin)){
    const chaleur = B.chaleur, kd = kind;
    vehicule(g, kd, W / 2, vyScr, hv, B.th, { gaz:B.gaz, chaleur:Math.min(1, chaleur), jambes:B.jambes, chutes:chK });
    if(mireOn){ const a = B.th * RAD, rm = clamp(hv * .5 + 36, 62, Math.min(120, H * .3)), gd = BAC.guide(B); mire(W / 2 + Math.sin(a) * hv * .5, vyScr - Math.cos(a) * hv * .5, rm, B.th, B.sas === 'libre' ? null : B.cap, 4, { vx:B.vx, vy:B.vy, guide:gd ? gd.th : null, vmin:15 }); if(gd) texteHUD(`🟡 cap conseillé : ${gd.nom}`, W / 2, Math.min(H - 20, vyScr - hv * .5 + rm + 36), 11, '#FFE08A', 'center'); }
  }
  hudBac(E);
}
function hudBac(E){
  const M = B.M, o = BAC.orbite(B), top = 10, sp = Math.hypot(B.vx, B.vy), m = BAC.masse(B), tw = E && E.pSol ? (B.M.rho0 > 0 && B.y < 20e3 ? E.pSol : E.pVide) / (m * BAC.grav(B, B.y)) : 0;
  const [av, au] = altTxt(B.y), E0 = E || { reste:0, plein:1, nom:'—' }, plein = E0.plein ? E0.reste / E0.plein : 0;
  const barres = [[E0.nom || 'Carburant', plein, E0.plein && plein < .12 ? '#FF4D4D' : '#5AB0FF', !E0.plein ? '' : B.illimite ? '∞' : `${Math.round(plein * 100)} %`], ['Poussée', B.gaz, '#FF8A3D', `${Math.round(B.gaz * 100)} %`], ['Chaleur', Math.min(1, B.chaleur), B.chaleur > .75 ? '#FF4D4D' : '#FFB347', B.degats > .05 ? `⚠ ${Math.round(B.degats * 100)} %` : `${Math.round(Math.min(1, B.chaleur) * 100)} %`]];
  const lignes = [];
  if(!o.ouverte && o.pe > -M.R) lignes.push([`ORBITE ${o.pe > M.atmo ? '✔' : '✖'}  PÉRIGÉE ${fmt(o.pe / 1000)} KM · APOGÉE ${fmt(o.ap / 1000)} KM`, o.pe > M.atmo ? '#7CF0B6' : '#FFB3B3']); else if(o.ouverte) lignes.push(['TRAJECTOIRE DE LIBÉRATION', '#7CF0B6']);
  lignes.push([`CAP : ${SAS_LIB[B.sas].toUpperCase()}`, '#FFE08A']);
  lignes.push([`MASSE ${fmt(m / 1000)} T · Δv ${fmt(BAC.deltaV(B))} M/S · P/P ${tw.toFixed(2)}`]);
  const hud = wTelemetrie(`${M.nom} · ${BAC.VEHICULES[B.vehicule].nom}`, B.t, [['Vitesse', kmh(sp), 'km/h'], ['Altitude', av, au], ['Vit. vert.', fmt(Math.abs(B.vy)), B.vy < 0 ? 'm/s ▼' : 'm/s ▲', B.vy < -20 ? '#FFB347' : '#fff'], ['Horizontale', fmt(Math.abs(B.vx)), 'm/s']], barres, `${Math.abs(B.th) < .5 ? '' : B.th > 0 ? '+' : '−'}${Math.abs(B.th).toFixed(0)}°`, lignes);
  const col = hud.col; let dy = 0;
  if(bacMsg && (B.t - bacMsg.at < (bacMsg.at === 0 ? 14 : 5))){ const c = bacMsg.cls === 'bon' ? '#7CF0B6' : bacMsg.cls === 'mal' ? '#FF9A9A' : '#FFE08A'; dy = col ? texteLong(bacMsg.t, 14, hud.bas + 16, 14, c, true, Math.min(W * .34, 300)) : texteLong(bacMsg.t, W / 2, Math.max(H * .22, hud.bas + 60), 15, c); }
  if(col) carteOrbite(W - 112, top + 64, 52); else carteOrbite(W - 62, top + 124, 48);
  yPilule = col ? 8 : hud.bas + 6;
  // les alertes du bac : allumage de la descente, chaleur, parachutes
  pilCx = W / 2;
  if(!bacFin){
    const col2 = W > H * 1.1, y0 = yPilule, vit = sp, gg = BAC.grav(B, B.y), Fm = E ? (B.M.rho0 > 0 && B.y < 20e3 ? E.pSol : E.pVide) : 0, aNet = Fm / m - gg;
    if(E && E.chutes && !B.chutes && B.y < 25e3 && B.vy < 0){ if(vit <= 250) alerte('bpara', ['', 'OUVRE LES PARACHUTES !'], 0, 1, y0); else pilule(`Parachutes : attends (${vit.toFixed(0)} m/s, sous 250)`, '#FFD23A', y0, clamp(1 - (vit - 250) / 600, 0, 1), false); }
    else if(B.chaleur > .75) pilule('TROP CHAUD : change d\'angle !', '#FF4D4D', y0, null, true);
    else if(E && E.reste > 0 && Fm > 0 && aNet > .5 && B.vy < -5 && B.y > 15 && B.y < 40e3 && B.gaz < .5 && vit < 1500){
      const ya = B.vy * B.vy / (2 * aNet);
      if(B.y < ya * 1.1) pilule('TROP TARD : POUSSÉE À FOND !', '#FF4D4D', y0, null, true); else alerte('ballume', ['ALLUME', 'ALLUME MAINTENANT !'], chrono(B.y - ya * 1.5, -B.vy, gg), 10, y0);
    }
  }
  const R = BAC.etage(B); $('bbEtage').disabled = B.i >= B.etages.length - 1 || !!bacFin; $('bbJambes').disabled = !(R && R.jambes) || !!bacFin; $('bbJambes').classList.toggle('on', B.jambes);
  $('bbChutes').disabled = !(R && R.chutes) || !!B.chutes || !!bacFin; $('bbChutes').classList.toggle('on', !!B.chutes); $('bbSas').textContent = `🧭 ${SAS_LIB[B.sas].split(' ')[0]}`;
  const b = $('bAction'); b.textContent = '—'; b.disabled = true;
  $('bPoussee').textContent = 'POUSSÉE';
}

accueil();
window.Starship = { D, vehicule, tour, S, BAC, get B(){ return B; }, lancerBac, cfg, S0:S, get R(){ return R; }, get V(){ return V; }, lancer, entrees, niveaux, brief };
})();
