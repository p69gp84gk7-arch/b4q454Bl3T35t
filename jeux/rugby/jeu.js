/* Le Buteur : des transformations de rugby en 60 secondes.
   Chaque coup : une place au hasard sur le terrain et un vent au hasard. On cale l'axe (glisser en haut de l'écran, ◀ ▶), puis on
   glisse le doigt vers le haut depuis le ballon pour taper : la longueur et la vitesse du geste donnent la force, son biais dévie le coup.
   Le ballon vole (pesanteur, frottement de l'air, vent) ; il doit passer entre les poteaux (5,6 m) et au-dessus de la barre (3 m).
   Repère de la scène (rugby/scene.js) : poteaux en (0, 0, 0), le terrain vers +z ; on tape vers -z. */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const virg = (n, k = 1) => n.toFixed(k).replace('.', ',');
const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const jour = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const S3 = window.RUGBY_3D, G = 9.81, DUREE = 60, ELEV = 34 * Math.PI / 180, AIR = .0045, DEMI = 2.8, BARRE = 3;

/* ---------- Le son ---------- */
let AC = null, son = lire('rugby-son', true);
function audio(){ if(AC || !son) return; try{ try{ if(navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){} AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ AC = null; } }
function bruit(duree, type, f, vol, q = 1, attaque = .01){
  if(!AC || !son) return;
  const t = AC.currentTime, n = Math.ceil(AC.sampleRate * duree), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for(let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = AC.createBufferSource(); s.buffer = b; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attaque); g.gain.exponentialRampToValueAtTime(.0001, t + duree);
  s.connect(fl); fl.connect(g); g.connect(AC.destination); s.start(t);
}
function ton(f, duree, vol, type = 'sine', f2 = 0){
  if(!AC || !son) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + duree);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + duree);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + duree + .02);
}
const sons = {
  frappe:() => { ton(95, .16, .45, 'sine', 55); bruit(.08, 'lowpass', 900, .3); },
  poteau:() => { ton(620, .5, .18, 'triangle', 600); ton(1240, .35, .08, 'sine'); },
  joie:() => bruit(1.8, 'bandpass', 900, .22, .6, .25),
  oh:() => bruit(.9, 'lowpass', 300, .18, .7, .15),
  sifflet:() => { ton(2900, .25, .12, 'square', 2700); setTimeout(() => ton(2900, .5, .12, 'square', 2800), 280); },
};

/* ---------- La partie ---------- */
let P = null, raf = 0, dernierMode = 'chrono', annonceT = 0;
function annoncer(txt, sous = '', duree = 1.3){ $('annonce').innerHTML = esc(txt) + (sous ? `<small>${esc(sous)}</small>` : ''); $('annonce').style.opacity = 1; annonceT = duree; }
function lancer(mode){
  dernierMode = mode;
  ['eMenu', 'eAide', 'eFin', 'ePause'].forEach(id => $(id).hidden = true);
  if(!S3 || !S3.init($('cv3d'))){ alert('La 3D ne marche pas sur cet appareil.'); menu(); return; }
  S3.taille(W, Hh);
  const seed = mode === 'defi' ? (() => { const d = new Date(); return d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); })() : (Date.now() & 0xffffff);
  P = { mode, R:alea(seed * 13 + 7), temps:DUREE, score:0, reussies:0, tentees:0, serie:0, meilleureSerie:0, plusLongue:0, coups:[], phase:'axe', t:0, dernier:performance.now(), pause:false, fin:false, joie:0 };
  $('hud').hidden = $('fins').hidden = false;
  audio(); sons.sifflet();
  nouveauCoup();
  annoncer(mode === 'defi' ? 'Défi du jour' : '60 secondes', 'Cale l\'axe, puis glisse vers le haut pour taper', 2);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
}
// une nouvelle place (de plus en plus loin et de plus en plus sur le côté) et un nouveau vent
function nouveauCoup(){
  const R = P.R, k = P.tentees;
  const cote = (R() < .5 ? -1 : 1) * Math.min(32, 2 + R() * (8 + k * 3.5)), dist = Math.round(15 + R() * (8 + k * 2.5) + Math.min(14, k * 1.3));
  const vf = Math.round(R() * Math.min(9, 2.5 + k * .9) * 10) / 10, va = R() * Math.PI * 2;
  P.x0 = Math.round(cote * 2) / 2; P.z0 = clamp(dist, 12, 48); P.vent = [Math.cos(va) * vf, Math.sin(va) * vf]; P.ventF = vf;
  P.axeVrai = Math.atan2(-P.x0, P.z0);                         // vers le milieu des poteaux
  P.axe = P.axeVrai + (R() - .5) * .35;                         // le ballon est posé un peu de travers : à toi de caler l'axe
  P.phase = 'axe'; P.tElan = 0; P.vol = null; P.res = null;
  S3.placer(P.x0, P.z0, P.axe); S3.montrerAxe(true);
  P.camA = P.axe; P.cam = null;
  majHud();
}
// la valeur d'une transformation : 2 points, plus pour les coups difficiles (loin, sur le côté, avec du vent)
const valeur = () => Math.round(2 * (1 + (P.z0 - 15) / 30 + Math.abs(P.x0) / 30 + P.ventF / 18));

/* ---------- Taper ---------- */
function taper(force, devie){
  if(P.phase !== 'axe') return;
  P.force = force; P.devie = devie; P.phase = 'elan'; P.tElan = 0; S3.montrerAxe(false);
}
function partir(){
  const v0 = 13 + 18 * P.force, a = P.axe + P.devie, dx = Math.sin(a), dz = -Math.cos(a);
  P.vol = { p:[P.x0, .26, P.z0], v:[dx * v0 * Math.cos(ELEV), v0 * Math.sin(ELEV), dz * v0 * Math.cos(ELEV)], t:0, tourne:0, a, passe:false, apres:0 };
  P.phase = 'vol'; P.tentees++; sons.frappe(); S3.cacherTee();
}
function voler(dt){
  const f = P.vol;
  for(let s = dt; s > 1e-6; s -= 1 / 240){
    const h = Math.min(1 / 240, s), a = f.p.slice();
    const rx = f.v[0] - P.vent[0], ry = f.v[1], rz = f.v[2] - P.vent[1], rv = Math.hypot(rx, ry, rz);
    // l'air freine le ballon (par rapport au vent), et le vent le pousse un peu en plus (le ballon ovale prend le vent)
    f.v[0] += (-AIR * rv * rx + .08 * P.vent[0]) * h; f.v[1] -= (G + AIR * rv * ry) * h; f.v[2] += (-AIR * rv * rz + .08 * P.vent[1]) * h;
    f.p[0] += f.v[0] * h; f.p[1] += f.v[1] * h; f.p[2] += f.v[2] * h; f.t += h;
    // le passage de la ligne des poteaux
    if(!P.res && a[2] > 0 && f.p[2] <= 0){
      const u = a[2] / (a[2] - f.p[2]), x = a[0] + (f.p[0] - a[0]) * u, y = a[1] + (f.p[1] - a[1]) * u;
      const poteau = Math.abs(Math.abs(x) - DEMI) < .2 && y < 14, barre = Math.abs(x) < DEMI && Math.abs(y - BARRE) < .16;
      if(poteau){ sons.poteau(); f.v[2] = -f.v[2] * .45; f.v[0] *= -.4; f.p[2] = .05; resultat(false, 'Poteau !'); }
      else if(barre && y < BARRE){ sons.poteau(); f.v[1] = -Math.abs(f.v[1]) * .3; f.v[2] = -f.v[2] * .3; f.p[2] = .05; resultat(false, 'Sur la barre…'); }
      else if(Math.abs(x) < DEMI && y > BARRE) resultat(true, barre ? 'Sur la barre… elle passe !' : '');
      else resultat(false, y <= BARRE && Math.abs(x) < DEMI ? 'Sous la barre' : x < 0 ? 'À côté, à gauche' : 'À côté, à droite');
    }
    if(f.p[1] <= .12){
      f.p[1] = .12;
      if(!P.res){ resultat(false, 'Trop court'); }
      // il rebondit un peu, puis s'arrête
      f.v[1] = Math.abs(f.v[1]) * .35; f.v[0] *= .6; f.v[2] *= .6;
    }
  }
  f.tourne += dt * 9;
  S3.majBallon(f.p, [f.tourne, f.a, 0]);
  if(P.res){ f.apres += dt; if(f.apres > 1.5) apresCoup(); }
}
function resultat(ok, txt){
  P.res = { ok, txt };
  if(ok){
    P.serie++; P.meilleureSerie = Math.max(P.meilleureSerie, P.serie); P.reussies++;
    const pts = valeur() + (P.serie >= 3 ? 1 : 0); P.score += pts; P.plusLongue = Math.max(P.plusLongue, Math.round(Math.hypot(P.x0, P.z0)));
    annoncer(`Réussie ! +${pts}`, txt || (P.serie >= 3 ? `${P.serie} à la suite : +1` : ''), 1.4); sons.joie(); P.joie = 1.6;
    if(navigator.vibrate) navigator.vibrate(30);
  } else { P.serie = 0; annoncer(txt, 'Transformation manquée', 1.4); sons.oh(); }
  P.coups.push({ ok, x:P.x0, z:P.z0, vent:P.ventF });
  majHud();
}
function apresCoup(){
  if(P.temps <= 0){ finir(); return; }
  nouveauCoup();
}

/* ---------- Chaque image ---------- */
function boucle(now){
  if(!P) return;
  const dt = Math.min(.05, (now - P.dernier) / 1000); P.dernier = now;
  if(!P.pause && !P.fin) maj(dt);
  dessiner(dt);
  raf = requestAnimationFrame(boucle);
}
function maj(dt){
  P.t += dt;
  // le chrono tourne tout le temps (le coup en l'air finit quand même)
  if(P.temps > 0){ P.temps = Math.max(0, P.temps - dt); if(P.temps <= 0){ sons.sifflet(); if(P.phase === 'axe'){ finir(); return; } } }
  if(P.phase === 'axe'){
    if(clavier.gauche) P.axe -= dt * .35; if(clavier.droite) P.axe += dt * .35;
    S3.majAxe(P.x0, P.z0, P.axe); S3.placer(P.x0, P.z0, P.axe);
  }
  if(P.phase === 'elan'){
    P.tElan += dt;
    const u = Math.min(1, P.tElan / .55);
    S3.elan(u, P.x0, P.z0, P.axe, u > .85 ? (u - .85) / .15 : 0);
    if(u >= 1) partir();
  }
  if(P.phase === 'vol') voler(dt);
  P.joie = Math.max(0, P.joie - dt);
  if(annonceT > 0){ annonceT -= dt; if(annonceT <= 0) $('annonce').style.opacity = 0; }
  P.hudT = (P.hudT || 0) - dt; if(P.hudT <= 0){ P.hudT = .2; majHud(); }
}
// la caméra : derrière le ballon, dans l'axe ; pendant le vol, elle suit le ballon
function camera(dt){
  if(P.phase === 'vol' && P.vol){
    const f = P.vol, hv = Math.hypot(f.v[0], f.v[2]) || 1, dx = f.v[0] / hv, dz = f.v[2] / hv;
    const cible = [f.p[0] - dx * 7, Math.max(1.6, f.p[1] + 1.6), f.p[2] - dz * 7];
    if(!P.cam) P.cam = cible.slice();
    const k = Math.min(1, dt * (P.res ? 1.2 : 4)); for(let i = 0; i < 3; i++) P.cam[i] += (cible[i] - P.cam[i]) * k;
    S3.regarder(P.cam, [f.p[0], f.p[1], f.p[2]]);
    return;
  }
  const a = P.axe, dx = Math.sin(a), dz = -Math.cos(a);
  S3.regarder([P.x0 - dx * 8, 2.3, P.z0 - dz * 8], [P.x0 + dx * 30, 2.4, P.z0 + dz * 30]);
}

/* ---------- Le dessin par-dessus : le vent, le geste, les flèches de l'axe ---------- */
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, Hh = 0, DPR = 1, hautStatut = 0;
function taille(){ hautStatut = (document.querySelector('.barre-statut') || {}).offsetHeight || 0; DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || innerWidth; Hh = cv.clientHeight || innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); if(S3 && S3.ok) S3.taille(W, Hh); }
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille); taille();
if(!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h){ this.rect(x, y, w, h); };
const zoneTir = () => Hh * .6;
function dessiner(dt){
  camera(dt);
  S3.rendu(dt, P.vent, P.joie);
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, Hh);
  // le vent : une flèche vue d'en haut (le haut = vers les poteaux, dans l'axe)
  const y0 = 70 + hautStatut, cx = W / 2, a = P.axe, fx = Math.sin(a), fz = -Math.cos(a), rx = -fz, rz = fx;
  const av = P.vent[0] * fx + P.vent[1] * fz, cote = P.vent[0] * rx + P.vent[1] * rz, ang = Math.atan2(cote, av);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect(cx - 92, y0, 184, 54, 16); g.fill();
  g.save(); g.translate(cx - 62, y0 + 27);
  g.strokeStyle = 'rgba(29,42,32,.2)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 19, 0, 7); g.stroke();
  if(P.ventF > .2){ g.rotate(ang); const l = 6 + Math.min(1, P.ventF / 9) * 11; g.strokeStyle = '#2A7BD6'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, l); g.lineTo(0, -l); g.lineTo(-6, -l + 7); g.moveTo(0, -l); g.lineTo(6, -l + 7); g.stroke(); }
  g.restore();
  g.fillStyle = '#1D2A20'; g.textAlign = 'left'; g.font = '800 15px "Bricolage Grotesque", sans-serif'; g.fillText(`vent ${virg(P.ventF)} m/s`, cx - 36, y0 + 24);
  g.font = '600 12px "Bricolage Grotesque", sans-serif'; g.fillStyle = '#5C6E60';
  g.fillText(`${Math.round(Math.hypot(P.x0, P.z0))} m · ${P.x0 ? `${Math.abs(P.x0)} m ${P.x0 < 0 ? 'à gauche' : 'à droite'}` : 'en face'}`, cx - 36, y0 + 42);
  if(P.phase === 'axe'){
    // la zone du geste, et l'aide
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, zoneTir(), W, Hh - zoneTir());
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([8, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(0, zoneTir()); g.lineTo(W, zoneTir()); g.stroke(); g.setLineDash([]);
    g.textAlign = 'center'; g.font = '800 14px "Bricolage Grotesque", sans-serif';
    texteFond('◀ glisse ici pour caler l\'axe ▶', cx, zoneTir() - 22);
    texteFond('glisse vers le haut depuis ici pour taper', cx, Hh - 100);
  }
  // le geste en cours : la trace du doigt, et la force
  if(geste && P.phase === 'axe'){
    const dy = geste.y0 - geste.y, f = clamp(dy / (Hh * .38), 0, 1.15);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); geste.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.fillStyle = f > 1 ? '#E23B3B' : f > .75 ? '#FFC93C' : '#3DDC84'; g.beginPath(); g.roundRect(20, Hh - 40, (W - 40) * Math.min(1, f / 1.15), 14, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.roundRect(20, Hh - 40, W - 40, 14, 7); g.stroke();
  }
}
function texteFond(t, x, y){ const w = g.measureText(t).width + 22; g.fillStyle = 'rgba(15,25,18,.55)'; g.beginPath(); g.roundRect(x - w / 2, y - 18, w, 28, 14); g.fill(); g.fillStyle = '#fff'; g.fillText(t, x, y + 1); }
function majHud(){
  if(!P) return;
  $('hScore').textContent = P.score; $('hTemps').textContent = Math.ceil(P.temps) + ' s'; $('hTemps').classList.toggle('urgent', P.temps < 10);
  $('hReussi').textContent = `${P.reussies}/${P.tentees}`; $('hSerie').textContent = P.serie;
}

/* ---------- Les commandes ---------- */
let geste = null, axeDoigt = null;
cv.addEventListener('pointerdown', e => {
  if(!P || P.pause || P.fin || P.phase !== 'axe') return;
  audio();
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  if(e.clientY >= zoneTir()) geste = { id:e.pointerId, x0:e.clientX, y0:e.clientY, x:e.clientX, y:e.clientY, t0:performance.now(), pts:[[e.clientX, e.clientY]] };
  else axeDoigt = { id:e.pointerId, x:e.clientX };
});
cv.addEventListener('pointermove', e => {
  if(geste && e.pointerId === geste.id){ geste.x = e.clientX; geste.y = e.clientY; geste.pts.push([e.clientX, e.clientY]); if(geste.pts.length > 40) geste.pts.shift(); return; }
  if(axeDoigt && e.pointerId === axeDoigt.id && P && P.phase === 'axe'){ P.axe = clamp(P.axe + (e.clientX - axeDoigt.x) * .0025, P.axeVrai - .9, P.axeVrai + .9); axeDoigt.x = e.clientX; }
});
const lacher = e => {
  if(axeDoigt && e.pointerId === axeDoigt.id) axeDoigt = null;
  if(!geste || e.pointerId !== geste.id) return;
  const G0 = geste; geste = null;
  if(!P || P.phase !== 'axe') return;
  const dy = G0.y0 - e.clientY, dx = e.clientX - G0.x0, duree = (performance.now() - G0.t0) / 1000;
  if(dy < 40) return;                                   // pas un coup de pied : on ne fait rien
  // la force : la longueur du geste, un peu plus s'il est vif ; le biais du geste dévie le coup
  const vif = clamp((dy / Math.max(.08, duree)) / (Hh * 2.2), .6, 1.2);
  const force = clamp(dy / (Hh * .38) * (.8 + .2 * vif), .15, 1.15), devie = clamp(dx / dy, -.7, .7) * .16;
  taper(force, devie);
};
cv.addEventListener('pointerup', lacher); cv.addEventListener('pointercancel', e => { geste = null; axeDoigt = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
// les petits boutons pour caler l'axe finement
let repet = null;
for(const [id, s] of [['bAxeG', -1], ['bAxeD', 1]]){
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); if(!P || P.phase !== 'axe') return; let n = 0; P.axe += s * .004; repet = setInterval(() => { n++; if(P && P.phase === 'axe') P.axe += s * (n > 10 ? .012 : .004); }, 70); });
  for(const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, () => { clearInterval(repet); repet = null; });
}
const clavier = { gauche:false, droite:false };
addEventListener('keydown', e => {
  if(!P) return;
  if(e.code === 'ArrowLeft'){ clavier.gauche = true; e.preventDefault(); } if(e.code === 'ArrowRight'){ clavier.droite = true; e.preventDefault(); }
  if(e.code === 'Space' && !e.repeat && P.phase === 'axe'){ e.preventDefault(); P.kbT = performance.now(); }
  if(e.code === 'Escape'){ if(P.pause) reprendre(); else pause(); }
});
addEventListener('keyup', e => {
  if(e.code === 'ArrowLeft') clavier.gauche = false; if(e.code === 'ArrowRight') clavier.droite = false;
  // au clavier : maintenir Espace (plus longtemps = plus fort), relâcher pour taper
  if(e.code === 'Space' && P && P.kbT && P.phase === 'axe'){ const f = clamp((performance.now() - P.kbT) / 900, .15, 1.15); P.kbT = 0; taper(f, 0); }
});

/* ---------- La fin, les records ---------- */
function finir(){
  if(!P || P.fin) return;
  P.fin = true; P.phase = 'fin';
  const rec = lire('rugby-records', {}), r = rec.chrono = rec.chrono || { meilleur:0, parties:0, reussies:0, tentees:0, serie:0, plusLongue:0 };
  let recTxt = '';
  if(P.mode === 'defi'){
    const d = rec.defi && rec.defi.jour === jour() ? rec.defi : { jour:jour(), score:0 }; const nv = P.score > d.score; if(nv) d.score = P.score; rec.defi = d;
    rec.defiMeilleur = Math.max(rec.defiMeilleur || 0, P.score); recTxt = nv ? '🏆 Meilleur score du jour !' : `Meilleur du jour : ${d.score} points`;
  } else { const nv = P.score > r.meilleur; r.parties++; if(nv) r.meilleur = P.score; recTxt = nv && r.parties > 1 ? '🏆 Nouveau record !' : r.parties > 1 ? `Record : ${r.meilleur} points` : ''; }
  r.reussies += P.reussies; r.tentees += P.tentees; r.serie = Math.max(r.serie, P.meilleureSerie); r.plusLongue = Math.max(r.plusLongue || 0, P.plusLongue);
  rec.dernier = { mode:P.mode, score:P.score, reussies:P.reussies, tentees:P.tentees };
  ecrire('rugby-records', rec);
  $('fTitre').textContent = P.mode === 'defi' ? `Défi du jour · ${new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}` : '60 secondes';
  $('fScore').innerHTML = `${P.score}<small>points</small>`;
  $('fRecord').textContent = recTxt;
  $('fDetail').innerHTML = [['Transformations réussies', `${P.reussies} sur ${P.tentees}`], ['Meilleure série', P.meilleureSerie], ['Plus longue réussie', P.plusLongue ? P.plusLongue + ' m' : '—'], ['Réussite (toutes parties)', r.tentees ? Math.round(r.reussies / r.tentees * 100) + ' %' : '—']]
    .map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
  $('hud').hidden = $('fins').hidden = true; $('annonce').style.opacity = 0;
  setTimeout(() => { if(P && P.fin) $('eFin').hidden = false; }, 500);
}
function pause(){ if(!P || P.fin) return; P.pause = true; $('ePause').hidden = false; }
function reprendre(){ if(!P) return; P.pause = false; P.dernier = performance.now(); $('ePause').hidden = true; }
function quitter(){ P = null; cancelAnimationFrame(raf); ['ePause', 'eFin'].forEach(id => $(id).hidden = true); $('hud').hidden = $('fins').hidden = true; menu(); }

/* ---------- Le menu ---------- */
function menu(){
  const rec = lire('rugby-records', {}), r = rec.chrono || {}, d = rec.defi && rec.defi.jour === jour() ? rec.defi : null;
  $('lChrono').innerHTML = `<button class="ligne vedette" data-mode="chrono"><span class="ico">⏱️</span><span><b>60 secondes</b><small>Le plus de points possible : places et vents au hasard</small></span><span class="rec">${r.parties ? `<em>${r.meilleur}</em><small>record</small>` : '<small>jamais joué</small>'}</span></button>`;
  $('lDefi').innerHTML = `<button class="ligne" data-mode="defi"><span class="ico">📅</span><span><b>Défi du jour</b><small>Les mêmes places et les mêmes vents pour tout le monde aujourd'hui</small></span><span class="rec">${d ? `<em>${d.score}</em><small>aujourd'hui</small>` : '<small>à faire</small>'}</span></button>`;
  $('recTxt').textContent = r.tentees ? `${r.reussies} transformations réussies sur ${r.tentees} · meilleure série ${r.serie || 0} · plus longue ${r.plusLongue || 0} m` : '';
  $('bSon').textContent = son ? '🔊' : '🔇';
  $('eMenu').hidden = false;
  if(S3 && S3.init($('cv3d'))){ S3.taille(W, Hh); S3.placer(-8, 30, Math.atan2(8, 30)); S3.regarder([-12, 2.5, 38], [0, 3, 0]); S3.rendu(0, [3, 1]); }
}
$('eMenu').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if(b) lancer(b.dataset.mode); });
$('bSon').onclick = () => { son = !son; ecrire('rugby-son', son); $('bSon').textContent = son ? '🔊' : '🔇'; if(son) audio(); };
$('bAide').onclick = () => { $('eMenu').hidden = true; $('eAide').hidden = false; };
$('bAideRetour').onclick = () => { $('eAide').hidden = true; $('eMenu').hidden = false; };
$('bPause').onclick = pause; $('bReprendre').onclick = reprendre; $('bQuitter').onclick = quitter;
$('bRecommencer').onclick = () => { $('ePause').hidden = true; lancer(dernierMode); };
$('bRejouer').onclick = () => { $('eFin').hidden = true; lancer(dernierMode); };
$('bMenu').onclick = quitter;
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
$('hud').hidden = $('fins').hidden = true;
menu();
window.Buteur = { lancer, get partie(){ return P; }, taper, finir, valeur };
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
