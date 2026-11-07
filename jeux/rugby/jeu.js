/* Le Buteur : des transformations de rugby (60 secondes, défi du jour, et quatre mini-jeux).
   Chaque coup : une place sur le terrain et un vent. On glisse le doigt vers le haut, dans la direction où l'on veut taper :
   le ballon part dans l'angle du geste (vu à l'écran), la force vient surtout de la vitesse du doigt à la fin du geste.
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
const S3 = window.RUGBY_3D, ANGLE_MAX = 1.1, POUSSE = .35, G = 9.81, DUREE = 60, ELEV = 34 * Math.PI / 180, AIR = .0045, DEMI = 2.8, BARRE = 3;

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

/* ---------- Les jeux ---------- */
// chrono : partie en secondes ; coups : nombre de coups ; sinon, le premier raté arrête la partie
const MODES = {
  chrono:{ nom:'60 secondes', ico:'⏱️', chrono:60, desc:'Le plus de points possible : places et vents au hasard' },
  defi:{ nom:'Défi du jour', ico:'📅', chrono:60, desc:'Les mêmes places et les mêmes vents pour tout le monde aujourd\'hui' },
  distance:{ nom:'Record de distance', ico:'📏', unite:'m', desc:'Face aux poteaux, on recule de 5 m à chaque réussite. Un raté, c\'est fini' },
  mortsubite:{ nom:'Mort subite', ico:'💀', unite:'réussies', desc:'Des places de plus en plus dures, sans chrono. Le premier raté arrête tout' },
  pleincentre:{ nom:'Plein centre', ico:'🎯', coups:10, desc:'10 coups : plus le ballon passe près du milieu, plus il rapporte (jusqu\'à 10)' },
  tempete:{ nom:'Tempête', ico:'🌪️', chrono:60, desc:'60 secondes dans un vent très fort qui change à chaque coup' },
};
const unite = (m, v) => MODES[m].unite === 'm' ? `${v} m` : MODES[m].unite === 'réussies' ? `${v} réussie${v > 1 ? 's' : ''}` : `${v} point${v > 1 ? 's' : ''}`;

/* ---------- La partie ---------- */
let P = null, raf = 0, dernierMode = 'chrono', annonceT = 0;
function annoncer(txt, sous = '', duree = 1.3){ $('annonce').innerHTML = esc(txt) + (sous ? `<small>${esc(sous)}</small>` : ''); $('annonce').style.opacity = 1; annonceT = duree; }
function lancer(mode){
  dernierMode = mode;
  ['eMenu', 'eAide', 'eFin', 'ePause'].forEach(id => $(id).hidden = true);
  if(!S3 || !S3.init($('cv3d'))){ alert('La 3D ne marche pas sur cet appareil.'); menu(); return; }
  S3.taille(W, Hh);
  const seed = mode === 'defi' ? (() => { const d = new Date(); return d.getFullYear() * 1000 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); })() : (Date.now() & 0xffffff);
  const M = MODES[mode], rec = lire('rugby-records', {});
  P = { mode, M, R:alea(seed * 13 + 7), temps:M.chrono || 0, score:0, reussies:0, tentees:0, serie:0, meilleureSerie:0, plusLongue:0, coups:[], phase:'axe', t:0,
    dernier:performance.now(), pause:false, fin:false, joie:0, clavier:false, record:(mode === 'chrono' || mode === 'defi' ? null : (rec[mode] || {}).meilleur) || 0 };
  $('hud').hidden = false;
  S3.montrerCible(mode === 'pleincentre');
  audio(); sons.sifflet();
  nouveauCoup();
  annoncer(M.nom, 'Glisse le doigt vers le haut, dans la direction du coup', 2);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
}
// une nouvelle place et un nouveau vent, selon le jeu (de plus en plus difficile au fil des coups)
function nouveauCoup(){
  const R = P.R, k = P.tentees, m = P.mode;
  let x, z, vf;
  if(m === 'distance'){ x = 0; z = 22 + 5 * P.reussies; vf = R() * 3; }
  else {
    const kk = m === 'pleincentre' ? 2 + k * .6 : k;
    x = (R() < .5 ? -1 : 1) * Math.min(32, 2 + R() * (8 + kk * 3.5));
    z = clamp(Math.round(15 + R() * (8 + kk * 2.5) + Math.min(14, kk * 1.3)), 12, m === 'tempete' ? 34 : 48);
    vf = m === 'tempete' ? 8 + R() * 6 : R() * Math.min(9, 2.5 + kk * .9);
  }
  const va = R() * Math.PI * 2; vf = Math.round(vf * 10) / 10;
  P.x0 = Math.round(x * 2) / 2; P.z0 = z; P.vent = [Math.cos(va) * vf, Math.sin(va) * vf]; P.ventF = vf;
  P.axeVrai = Math.atan2(-P.x0, P.z0);                         // vers le milieu des poteaux (la caméra regarde dans cet axe)
  P.axe = P.axeVrai;
  P.phase = 'axe'; P.vol = null; P.res = null; P.cam = null;
  S3.placer(P.x0, P.z0, P.axe, P.axeVrai); S3.montrerAxe(P.clavier);
  majHud();
}
// la valeur d'une transformation : 2 points, plus pour les coups difficiles (loin, sur le côté, avec du vent)
const valeur = () => Math.round(2 * (1 + (P.z0 - 15) / 30 + Math.abs(P.x0) / 30 + P.ventF / 18));
// Plein centre : 10 points au milieu, 2 contre le poteau
const precision = x => clamp(Math.round(10 - 8 * Math.abs(x) / DEMI), 2, 10);

/* ---------- Taper ---------- */
// force de 0,1 à 1,2 ; angle : la direction du coup (0 = vers -z) ; par défaut l'axe du clavier
function taper(force, angle){
  if(!P || P.phase !== 'axe') return;
  P.force = clamp(force, .1, 1.2); P.axe = angle ?? P.axe; S3.montrerAxe(false);
  partir();
}
function partir(){
  const v0 = 13 + 18 * P.force, a = P.axe, dx = Math.sin(a), dz = -Math.cos(a);
  P.vol = { p:[P.x0, .26, P.z0], v:[dx * v0 * Math.cos(ELEV), v0 * Math.sin(ELEV), dz * v0 * Math.cos(ELEV)], t:0, tourne:0, a, apres:0 };
  P.phase = 'vol'; P.tentees++; sons.frappe(); S3.cacherTee();
}
function voler(dt){
  const f = P.vol;
  for(let s = dt; s > 1e-6; s -= 1 / 240){
    const h = Math.min(1 / 240, s), a = f.p.slice();
    const rx = f.v[0] - P.vent[0], ry = f.v[1], rz = f.v[2] - P.vent[1], rv = Math.hypot(rx, ry, rz);
    // l'air freine le ballon (par rapport au vent), et le vent le pousse en plus (le ballon ovale prend le vent)
    f.v[0] += (-AIR * rv * rx + POUSSE * P.vent[0]) * h; f.v[1] -= (G + AIR * rv * ry) * h; f.v[2] += (-AIR * rv * rz + POUSSE * P.vent[1]) * h;
    f.p[0] += f.v[0] * h; f.p[1] += f.v[1] * h; f.p[2] += f.v[2] * h; f.t += h;
    // le passage de la ligne des poteaux
    if(!P.res && a[2] > 0 && f.p[2] <= 0){
      const u = a[2] / (a[2] - f.p[2]), x = a[0] + (f.p[0] - a[0]) * u, y = a[1] + (f.p[1] - a[1]) * u;
      const poteau = Math.abs(Math.abs(x) - DEMI) < .2 && y < 14, barre = Math.abs(x) < DEMI && Math.abs(y - BARRE) < .16;
      if(poteau){ sons.poteau(); f.v[2] = -f.v[2] * .45; f.v[0] *= -.4; f.p[2] = .05; resultat(false, 'Poteau !'); }
      else if(barre && y < BARRE){ sons.poteau(); f.v[1] = -Math.abs(f.v[1]) * .3; f.v[2] = -f.v[2] * .3; f.p[2] = .05; resultat(false, 'Sur la barre…'); }
      else if(Math.abs(x) < DEMI && y > BARRE) resultat(true, barre ? 'Sur la barre… elle passe !' : '', x);
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
  S3.majBallon(f.p, f.a, f.tourne);
  if(P.res){ f.apres += dt; if(f.apres > 1.5) apresCoup(); }
}
function resultat(ok, txt, x = 0){
  P.res = { ok, txt };
  const m = P.mode, d = Math.round(Math.hypot(P.x0, P.z0));
  if(ok){
    P.serie++; P.meilleureSerie = Math.max(P.meilleureSerie, P.serie); P.reussies++; P.plusLongue = Math.max(P.plusLongue, d);
    if(m === 'distance'){ P.score = P.z0; annoncer(`Réussie à ${P.z0} m !`, txt || 'On recule de 5 m', 1.4); }
    else if(m === 'mortsubite'){ P.score = P.reussies; annoncer('Réussie !', txt || `${P.reussies} à la suite`, 1.4); }
    else if(m === 'pleincentre'){ const pts = precision(x); P.score += pts; annoncer(`+${pts}`, pts === 10 ? 'Plein centre !' : txt, 1.4); }
    else { const pts = valeur() + (P.serie >= 3 ? 1 : 0); P.score += pts; annoncer(`Réussie ! +${pts}`, txt || (P.serie >= 3 ? `${P.serie} à la suite : +1` : ''), 1.4); }
    sons.joie(); P.joie = 1.6;
    if(navigator.vibrate) navigator.vibrate(30);
  } else {
    P.serie = 0; sons.oh();
    annoncer(txt, m === 'distance' || m === 'mortsubite' ? 'C\'est fini !' : 'Transformation manquée', 1.4);
  }
  P.coups.push({ ok, x:P.x0, z:P.z0, vent:P.ventF });
  majHud();
}
function apresCoup(){
  const M = P.M;
  if(M.chrono){ if(P.temps <= 0){ finir(); return; } }
  else if(M.coups){ if(P.tentees >= M.coups){ finir(); return; } }
  else if(!P.res.ok){ finir(); return; }
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
  if(P.M.chrono && P.temps > 0){ P.temps = Math.max(0, P.temps - dt); if(P.temps <= 0){ sons.sifflet(); if(P.phase === 'axe'){ finir(); return; } } }
  if(P.phase === 'axe' && (clavier.gauche || clavier.droite)){
    // au clavier : les flèches tournent l'axe (montré par les pointillés)
    P.clavier = true; P.axe = clamp(P.axe + (clavier.droite - clavier.gauche) * dt * .35, P.axeVrai - ANGLE_MAX, P.axeVrai + ANGLE_MAX);
    S3.placer(P.x0, P.z0, P.axe, P.axeVrai); S3.montrerAxe(true);
  }
  if(P.phase === 'vol') voler(dt);
  P.joie = Math.max(0, P.joie - dt);
  if(annonceT > 0){ annonceT -= dt; if(annonceT <= 0) $('annonce').style.opacity = 0; }
  P.hudT = (P.hudT || 0) - dt; if(P.hudT <= 0){ P.hudT = .2; majHud(); }
}
// la caméra : derrière le ballon, dans l'axe ; pendant le vol, elle suit le ballon
function camera(dt){
  // dans l'axe des poteaux, juste derrière le ballon ; le regard baisse pour que le ballon soit en bas de l'écran (à 78 %, 82 % en paysage)
  const a = P.axeVrai, dx = Math.sin(a), dz = -Math.cos(a), fov = W < Hh ? 64 : 50;
  const vise = [P.x0 - dx * 2.4, 1.2, P.z0 - dz * 2.4];
  const tangage = Math.atan((1.2 - .27) / 2.4) - Math.atan((W < Hh ? .56 : .64) * Math.tan(fov / 2 * Math.PI / 180));
  if(P.phase === 'vol' && P.vol){
    // pendant le vol : la caméra regarde le ballon, monte un peu et le suit de loin (toujours dans l'axe des poteaux)
    const f = P.vol, d = Math.max(0, (f.p[0] - P.x0) * dx + (f.p[2] - P.z0) * dz), av = Math.max(0, d - 12) * .6;
    const cible = [vise[0] + dx * av, 1.2 + Math.min(1.6, d * .06), vise[2] + dz * av];
    if(!P.cam) P.cam = vise.slice();
    const k = Math.min(1, dt * 3); for(let i = 0; i < 3; i++) P.cam[i] += (cible[i] - P.cam[i]) * k;
    S3.regarder(P.cam, [f.p[0], Math.max(f.p[1], P.cam[1] - 1), f.p[2]]);
    return;
  }
  S3.regarder(vise, [vise[0] + dx * 30, 1.2 - 30 * Math.tan(tangage), vise[2] + dz * 30]);
}

/* ---------- Le dessin par-dessus : le vent, le geste et sa force ---------- */
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, Hh = 0, DPR = 1, hautStatut = 0;
function taille(){ hautStatut = (document.querySelector('.barre-statut') || {}).offsetHeight || 0; DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || innerWidth; Hh = cv.clientHeight || innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); if(S3 && S3.ok) S3.taille(W, Hh); }
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille); taille();
if(!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h){ this.rect(x, y, w, h); };
function dessiner(dt){
  camera(dt);
  S3.rendu(dt, P.vent, P.joie);
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, Hh);
  // le vent : une flèche vue d'en haut (le haut = vers les poteaux)
  const large = W > Hh * 1.2, y0 = (large ? 12 : 70) + hautStatut, cx = large ? W - 160 : W / 2, a = P.axeVrai, fx = Math.sin(a), fz = -Math.cos(a), rx = -fz, rz = fx;
  const av = P.vent[0] * fx + P.vent[1] * fz, cote = P.vent[0] * rx + P.vent[1] * rz, ang = Math.atan2(cote, av);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect(cx - 92, y0, 184, 54, 16); g.fill();
  g.save(); g.translate(cx - 62, y0 + 27);
  g.strokeStyle = 'rgba(29,42,32,.2)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 19, 0, 7); g.stroke();
  if(P.ventF > .2){ g.rotate(ang); const l = 6 + Math.min(1, P.ventF / 12) * 11; g.strokeStyle = P.ventF > 9 ? '#E23B3B' : '#2A7BD6'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, l); g.lineTo(0, -l); g.lineTo(-6, -l + 7); g.moveTo(0, -l); g.lineTo(6, -l + 7); g.stroke(); }
  g.restore();
  g.fillStyle = '#1D2A20'; g.textAlign = 'left'; g.font = '800 15px "Bricolage Grotesque", sans-serif'; g.fillText(`vent ${virg(P.ventF)} m/s`, cx - 36, y0 + 24);
  g.font = '600 12px "Bricolage Grotesque", sans-serif'; g.fillStyle = '#5C6E60';
  g.fillText(`${Math.round(Math.hypot(P.x0, P.z0))} m · ${P.x0 ? `${Math.abs(P.x0)} m ${P.x0 < 0 ? 'à gauche' : 'à droite'}` : 'en face'}`, cx - 36, y0 + 42);
  if(P.phase === 'axe' && !geste && P.tentees < 2){
    g.textAlign = 'center'; g.font = '800 14px "Bricolage Grotesque", sans-serif';
    texteFond('glisse vers le haut, dans la direction du coup', W / 2, Hh * .58);
    texteFond('plus ton doigt va vite, plus le coup est fort', W / 2, Hh * .58 + 34);
  }
  // le geste en cours : la trace du doigt, et la force (la vitesse du doigt)
  if(geste && P.phase === 'axe'){
    const f = forceGeste(geste);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); geste.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.fillStyle = f > 1 ? '#E23B3B' : f > .7 ? '#FFC93C' : '#3DDC84'; g.beginPath(); g.roundRect(20, Hh - 40, (W - 40) * Math.min(1, f / 1.2), 14, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.roundRect(20, Hh - 40, W - 40, 14, 7); g.stroke();
  }
}
function texteFond(t, x, y){ const w = g.measureText(t).width + 22; g.fillStyle = 'rgba(15,25,18,.55)'; g.beginPath(); g.roundRect(x - w / 2, y - 18, w, 28, 14); g.fill(); g.fillStyle = '#fff'; g.fillText(t, x, y + 1); }
// le haut de l'écran : quatre petits blocs, selon le jeu
function majHud(){
  if(!P) return;
  const m = P.mode, d = Math.round(Math.hypot(P.x0, P.z0)), rec = P.record;
  const B = m === 'distance' ? [['Distance', `${P.z0} m`], ['Réussie', P.score ? `${P.score} m` : '—'], ['Record', rec ? `${rec} m` : '—']]
    : m === 'mortsubite' ? [['Réussies', P.reussies], ['Distance', `${d} m`], ['Record', rec || '—']]
    : m === 'pleincentre' ? [['Points', P.score], ['Coup', `${Math.min(P.tentees + (P.phase === 'axe' ? 1 : 0), 10)}/10`], ['Réussies', `${P.reussies}/${P.tentees}`], ['Record', rec || '—']]
    : [['Score', P.score], ['Temps', Math.ceil(P.temps) + ' s', P.temps < 10], ['Réussies', `${P.reussies}/${P.tentees}`], ['Série', P.serie]];
  for(let i = 0; i < 4; i++){
    const b = B[i]; $('h' + i).hidden = !b; if(!b) continue;
    $('l' + i).textContent = b[0]; $('v' + i).textContent = b[1]; $('v' + i).classList.toggle('urgent', !!b[2]);
  }
}

/* ---------- Les commandes : un geste du doigt ---------- */
let geste = null;
// la force : surtout la vitesse du doigt à la fin du geste (sur les 90 dernières ms), un peu la longueur
function forceGeste(G0){
  const p = G0.pts, n = p.length - 1; if(n < 1) return 0;
  const tFin = p[n][2]; let k = n; while(k > 0 && tFin - p[k - 1][2] <= 90) k--; if(k === n) k = n - 1;
  const dt = Math.max(16, tFin - p[k][2]), vit = Math.hypot(p[n][0] - p[k][0], p[n][1] - p[k][1]) / dt * 1000 / Hh;   // écrans par seconde
  const lg = Math.max(0, G0.y0 - p[n][1]) / (Hh * .45);
  return clamp(.82 * (vit - .45) / 3 + .18 * lg, 0, 1.2);
}
// la direction : le ballon part là où montre le geste à l'écran. On cherche l'angle (autour de l'axe des poteaux) dont la ligne
// au sol, vue à l'écran depuis le ballon, a la même pente que le geste.
function angleGeste(dx, dy){
  const ts = Math.atan2(dx, dy), D = Math.max(12, Math.hypot(P.x0, P.z0)), b = S3.ecran(P.x0, 0, P.z0);
  if(!b) return P.axeVrai;
  const th = r => { const a = P.axeVrai + r, q = S3.ecran(P.x0 + Math.sin(a) * D, 0, P.z0 - Math.cos(a) * D); return q ? Math.atan2(q[0] - b[0], b[1] - q[1]) : r * 9; };
  let lo = -ANGLE_MAX, hi = ANGLE_MAX;
  if(ts <= th(lo)) return P.axeVrai + lo; if(ts >= th(hi)) return P.axeVrai + hi;
  for(let i = 0; i < 30; i++){ const m = (lo + hi) / 2; if(th(m) < ts) lo = m; else hi = m; }
  return P.axeVrai + (lo + hi) / 2;
}
cv.addEventListener('pointerdown', e => {
  if(!P || P.pause || P.fin || P.phase !== 'axe') return;
  audio();
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  geste = { id:e.pointerId, x0:e.clientX, y0:e.clientY, pts:[[e.clientX, e.clientY, e.timeStamp || performance.now()]] };
});
cv.addEventListener('pointermove', e => {
  if(!geste || e.pointerId !== geste.id) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for(const c of (evs.length ? evs : [e])) geste.pts.push([c.clientX, c.clientY, c.timeStamp || performance.now()]);
  if(geste.pts.length > 80) geste.pts.splice(0, geste.pts.length - 80);
});
const lacher = e => {
  if(!geste || e.pointerId !== geste.id) return;
  const G0 = geste; geste = null;
  if(!P || P.phase !== 'axe') return;
  // le point du lâcher compte s'il a bougé (sinon, la vitesse reste celle des derniers mouvements)
  const dern = G0.pts[G0.pts.length - 1]; if(Math.hypot(e.clientX - dern[0], e.clientY - dern[1]) > 2) G0.pts.push([e.clientX, e.clientY, e.timeStamp || performance.now()]);
  const dy = G0.y0 - e.clientY, dx = e.clientX - G0.x0;
  if(dy < 30 || dy < Math.abs(dx) * .3) return;          // pas un coup de pied vers l'avant : on ne fait rien
  taper(Math.max(.1, forceGeste(G0)), angleGeste(dx, dy));
};
cv.addEventListener('pointerup', lacher); cv.addEventListener('pointercancel', () => { geste = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
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
  if(e.code === 'Space' && P && P.kbT && P.phase === 'axe'){ const f = clamp((performance.now() - P.kbT) / 900, .15, 1.15); P.kbT = 0; taper(f); }
});

/* ---------- La fin, les records ---------- */
function finir(){
  if(!P || P.fin) return;
  P.fin = true; P.phase = 'fin';
  const m = P.mode, rec = lire('rugby-records', {}), r = rec.chrono = rec.chrono || { meilleur:0, parties:0, reussies:0, tentees:0, serie:0, plusLongue:0 };
  let recTxt = '';
  if(m === 'defi'){
    const d = rec.defi && rec.defi.jour === jour() ? rec.defi : { jour:jour(), score:0 }; const nv = P.score > d.score; if(nv) d.score = P.score; rec.defi = d;
    rec.defiMeilleur = Math.max(rec.defiMeilleur || 0, P.score); recTxt = nv ? '🏆 Meilleur score du jour !' : `Meilleur du jour : ${d.score} points`;
  } else {
    const q = m === 'chrono' ? r : (rec[m] = rec[m] || { meilleur:0, parties:0 }), nv = P.score > q.meilleur;
    q.parties++; if(nv) q.meilleur = P.score;
    recTxt = nv && q.parties > 1 ? '🏆 Nouveau record !' : q.parties > 1 || q.meilleur ? `Record : ${unite(m, q.meilleur)}` : '';
  }
  // les statistiques de toutes les parties
  r.reussies += P.reussies; r.tentees += P.tentees; r.serie = Math.max(r.serie, P.meilleureSerie); r.plusLongue = Math.max(r.plusLongue || 0, P.plusLongue);
  rec.dernier = { mode:m, score:P.score, reussies:P.reussies, tentees:P.tentees };
  ecrire('rugby-records', rec);
  $('fTitre').textContent = m === 'defi' ? `Défi du jour · ${new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}` : P.M.nom;
  const u = unite(m, P.score).replace(/^\S+ /, '');
  $('fScore').innerHTML = `${P.score}<small>${esc(m === 'distance' ? (P.score ? 'mètres, la plus longue réussie' : 'aucune réussie') : u)}</small>`;
  $('fRecord').textContent = recTxt;
  $('fDetail').innerHTML = [['Transformations réussies', `${P.reussies} sur ${P.tentees}`], ['Meilleure série', P.meilleureSerie], ['Plus longue réussie', P.plusLongue ? P.plusLongue + ' m' : '—'], ['Réussite (toutes parties)', r.tentees ? Math.round(r.reussies / r.tentees * 100) + ' %' : '—']]
    .map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
  $('hud').hidden = true; $('annonce').style.opacity = 0;
  setTimeout(() => { if(P && P.fin) $('eFin').hidden = false; }, 500);
}
function pause(){ if(!P || P.fin) return; P.pause = true; $('ePause').hidden = false; }
function reprendre(){ if(!P) return; P.pause = false; P.dernier = performance.now(); $('ePause').hidden = true; }
function quitter(){ P = null; cancelAnimationFrame(raf); ['ePause', 'eFin'].forEach(id => $(id).hidden = true); $('hud').hidden = true; menu(); }

/* ---------- Le menu ---------- */
function ligne(m, vedette, droite){
  const M = MODES[m];
  return `<button class="ligne${vedette ? ' vedette' : ''}" data-mode="${m}"><span class="ico">${M.ico}</span><span><b>${esc(M.nom)}</b><small>${esc(M.desc)}</small></span><span class="rec">${droite}</span></button>`;
}
function menu(){
  const rec = lire('rugby-records', {}), r = rec.chrono || {}, d = rec.defi && rec.defi.jour === jour() ? rec.defi : null;
  const rq = m => { const q = rec[m]; return q && q.parties ? `<em>${q.meilleur}${m === 'distance' ? ' m' : ''}</em><small>record</small>` : '<small>jamais joué</small>'; };
  $('lChrono').innerHTML = ligne('chrono', true, r.parties ? `<em>${r.meilleur}</em><small>record</small>` : '<small>jamais joué</small>');
  $('lDefi').innerHTML = ligne('defi', false, d ? `<em>${d.score}</em><small>aujourd'hui</small>` : '<small>à faire</small>');
  $('lMini').innerHTML = ['distance', 'mortsubite', 'pleincentre', 'tempete'].map(m => ligne(m, false, rq(m))).join('');
  $('recTxt').textContent = r.tentees ? `${r.reussies} transformations réussies sur ${r.tentees} · meilleure série ${r.serie || 0} · plus longue ${r.plusLongue || 0} m` : '';
  $('bSon').textContent = son ? '🔊' : '🔇';
  $('eMenu').hidden = false;
  if(S3 && S3.init($('cv3d'))){ S3.taille(W, Hh); S3.placer(-8, 30, Math.atan2(8, 30)); S3.montrerAxe(false); S3.montrerCible(false); S3.regarder([-12, 2.5, 38], [0, 3, 0]); S3.rendu(0, [3, 1]); }
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
$('hud').hidden = true;
menu();
window.Buteur = { lancer, get partie(){ return P; }, taper, finir, valeur, angleGeste, forceGeste, MODES };
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
