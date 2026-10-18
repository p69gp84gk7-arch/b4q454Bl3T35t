/* Olympiades : les 18 épreuves (règles, dessin, conseils affichés pendant l'épreuve et démonstration).
   Chaque épreuve EP[id] : n, ico, saison, unite ('s', 'm', 'pts'), sens (-1 : moins c'est mieux), essais (1, 2, 3 ou 'echelle'),
   qual (le minimum), ref (une très belle performance), a (le nom du bouton rouge), lg (celui des flèches),
   aide (une phrase), tuto (les étapes du tutoriel), debut(ctx) → E, maj(E, dt), dessin(E),
   conseil(E) → { t:texte, b:bouton à montrer ('gd', 'g', 'd', 'a', 'aT' tenir, 'aL' lâcher) },
   demo(E) → les appuis d'un joueur modèle pour la démonstration ({ taps, g, d, gP, dP, a }).
   E.fini = true et E.res (nombre, ou null pour une faute) à la fin de l'essai. */
'use strict';

/* ---------- Le son : quelques bips (coupables) ---------- */
let son = lire('olymp-son', true), AC = null;
function bip(f, d, vol = .08, type = 'square'){
  if(!son || window.OLYMP_MUET) return;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), gg = AC.createGain(), t = AC.currentTime;
    o.type = type; o.frequency.value = f; gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(gg); gg.connect(AC.destination); o.start(t); o.stop(t + d);
  }catch(e){}
}
const pan = () => { bip(1200, .25, .12); };   // le signal du départ

/* ---------- Les commandes ----------
   I.taps : appuis valables (en alternance) depuis la dernière image ; I.a : bouton d'action tenu ;
   I.aP / I.aR : action appuyée / lâchée pendant l'image ; I.g / I.d : flèches tenues ; I.gP / I.dP : appuyées. */
const I = { taps:0, dernier:null, g:false, d:false, gP:false, dP:false, a:false, aP:false, aR:false, tTap:[] };
function raz(){ I.taps = 0; I.gP = I.dP = I.aP = I.aR = false; }
// la vitesse donnée par les appuis en alternance (comme à l'arcade : plus on tapote vite, plus on va vite)
function elan(E, dt, vmax, gain = 2, frein = .8){
  E.v += I.taps * gain * Math.max(0, 1 - E.v / vmax);
  E.v = Math.max(0, E.v - frein * E.v * dt);
}
// cadence (appuis valables par seconde, sur la dernière seconde)
function cadence(){ const t = performance.now(); I.tTap = I.tTap.filter(x => t - x < 1000); return I.tTap.length; }
// position d'un robot fantôme qui fait la course en un temps T (départ rapide puis vitesse presque constante)
function fantome(T, t, dist){ if(t <= 0) return 0; const tau = .14, f = u => u - tau * (1 - Math.exp(-u / tau)); return dist * clamp(f(t / T) / f(1), 0, 1.3); }
// qualité d'un angle : 1 à l'angle idéal, 0 à « largeur » degrés de là
const qAngle = (a, ideal, larg) => Math.max(0, 1 - ((a - ideal) / larg) ** 2);
const enDeg = a => a * 180 / Math.PI;
// un joueur modèle qui tapote environ 10 fois par seconde (pour les démonstrations)
let demoAcc = 0;
const tapDemo = (n = 10) => { demoAcc += n / 60; const k = Math.floor(demoAcc); demoAcc -= k; return k; };

/* ---------- Le départ au signal (courses, natation, patinage) ---------- */
function depart(E, dt){
  // « À vos marques » (1,2 s), « Prêts… » (1 à 2,4 s au hasard), puis le signal
  E.dep += dt;
  if(E.signal === undefined){ E.signal = 1.2 + hasard(1, 2.4); annoncer('À vos marques'); }
  if(E.dep > 1.2 && !E.prets){ E.prets = true; annoncer('Prêts…'); }
  const avant = E.dep < E.signal;
  if(avant && (I.taps || (E.departAction && I.aP))){
    E.faux = (E.faux || 0) + 1; bip(180, .4, .15, 'sawtooth');
    if(E.faux >= 2){ E.fini = true; E.res = null; E.msg = 'Deuxième faux départ : disqualifié'; annoncer('Disqualifié'); return false; }
    annoncer('Faux départ !', 'Attendez le signal'); E.dep = -1; E.prets = false; E.signal = 1.2 + hasard(1, 2.4); return false;
  }
  if(!avant && !E.parti){ E.parti = true; pan(); annoncer('Partez !', '', .6); E.t = 0; }
  return E.parti;
}
const conseilDepart = E => !E.parti ? { t:E.prets ? 'Prêts… attendez le signal, ne touchez à rien !' : 'À vos marques : attendez le signal du départ', b:null } : null;
const finir = (E, res, txt, sous) => { E.res = res; E.fini = true; annoncer(txt, sous); };
const faute = (E, msg, sous) => { E.fini = true; E.res = null; E.msg = msg; annoncer('Faute !', sous || msg); bip(160, .3, .1, 'sawtooth'); };

const EP = {};

/* ================= ÉTÉ ================= */

// les robots qui courent dans les couloirs du fond (un peu plus petits et transparents)
function fantomes(E, prof, pose){
  (E.fant || []).forEach((f, i) => { const fx = fantome(f.T, E.t, E.dist), dy = .32 + i * .2;
    g.save(); g.translate(0, -V.s * dy); athlete(fx, 0, pose(fx), f.app, .55, .9); g.restore(); });
}
function compteurCadence(){
  const c = cadence(), w = Math.min(220, W * .5);
  jauge(W / 2 - w / 2, HAUT + 4, w, 12, c / 13, c > 9 ? '#2EBE64' : c > 6 ? '#F2C230' : '#E8434F', null, `${c} appuis / s`);
}

// 100 m
EP.m100 = { n:'100 m', ico:'🏃', saison:'ete', unite:'s', sens:-1, essais:1, qual:13.5, ref:10.3, a:'—', lg:'COURIR',
  aide:'Attendez le signal, puis tapotez ◀ ▶ en alternance le plus vite possible jusqu\'à la ligne.',
  tuto:['Attendez le signal (« Partez ! ») sans toucher les boutons : partir avant, c\'est un faux départ.', 'Puis tapotez ◀ et ▶ chacun son tour, le plus vite possible : gauche, droite, gauche, droite…', 'Deux fois le même bouton ne compte pas. Plus vous tapotez vite, plus le coureur va vite.'],
  debut:ctx => ({ x:0, v:0, t:0, dep:0, ph:0, dist:100, fant:ctx.fant, app:ctx.app }),
  maj(E, dt){ if(!depart(E, dt)) return; E.t += dt; elan(E, dt, 15); E.x += E.v * dt; E.ph += E.v * dt * 1.15;
    if(E.x >= E.dist){ const r = E.t - (E.x - E.dist) / Math.max(1, E.v); finir(E, r, virg(r, 2) + ' s'); } },
  dessin(E){ dessinCourse(E, []); },
  conseil:E => conseilDepart(E) || { t:'Tapotez ◀ ▶ en alternance, le plus vite possible !', b:'gd' },
  demo:E => ({ taps:E.parti ? tapDemo(10.5) : 0 })
};
// 110 m haies : sauter les haies avec le bouton rouge, dans la zone verte devant chaque haie
const HAIES = Array.from({ length:10 }, (_, k) => 13.72 + 9.14 * k);
const zoneHaie = (E, h) => { const v = Math.max(6, E.v); return [h - v * .45, h - v * .15]; };
EP.haies = { n:'110 m haies', ico:'🚧', saison:'ete', unite:'s', sens:-1, essais:1, qual:17.6, ref:13.2, a:'SAUTER', lg:'COURIR',
  aide:'Au signal, tapotez ◀ ▶ pour courir et appuyez sur SAUTER dans la zone verte devant chaque haie.',
  tuto:['Attendez le signal, puis tapotez ◀ ▶ en alternance pour courir.', 'Devant chaque haie, une zone verte apparaît sur la piste : appuyez sur SAUTER quand vous y êtes.', 'Trop tôt ou trop tard, vous heurtez la haie et vous perdez beaucoup de vitesse.'],
  debut:ctx => ({ x:0, v:0, t:0, dep:0, ph:0, dist:110, z:0, vz:0, tombees:new Set(), fant:ctx.fant, app:ctx.app }),
  maj(E, dt){ if(!depart(E, dt)) return; E.t += dt;
    // en l'air, on ne peut pas accélérer
    if(E.z <= 0) elan(E, dt, 14.2); else E.v -= .25 * E.v * dt;
    if(I.aP && E.z <= 0){ E.vz = 4.2; E.z = .001; bip(500, .05, .05); }
    if(E.z > 0){ E.vz -= 14 * dt; E.z = Math.max(0, E.z + E.vz * dt); }
    const x0 = E.x; E.x += E.v * dt; E.ph += E.v * dt * (E.z > 0 ? .2 : 1.15);
    HAIES.forEach((h, i) => { if(x0 < h && E.x >= h && E.z < .55 && !E.tombees.has(i)){ E.tombees.add(i); E.v *= .55; bip(150, .15, .1, 'sawtooth'); annoncer('Haie !', '', .5); } });
    if(E.x >= E.dist){ const r = E.t - (E.x - E.dist) / Math.max(1, E.v); finir(E, r, virg(r, 2) + ' s'); } },
  dessin(E){ dessinCourse(E, HAIES); },
  conseil(E){ const c = conseilDepart(E); if(c) return c; const h = HAIES.find(h => h > E.x); if(!h) return { t:'Dernière ligne droite : tapotez !', b:'gd' };
    const [a, b] = zoneHaie(E, h); if(E.x >= a && E.x <= b && E.z <= 0) return { t:'SAUTEZ !', b:'a' };
    return { t:E.z > 0 ? 'Bien ! Reprenez la course' : 'Tapotez ◀ ▶ ; sautez dans la zone verte avant la haie', b:'gd' }; },
  demo(E){ if(!E.parti) return {}; const h = HAIES.find(h => h > E.x); return { taps:tapDemo(10), a:!!h && E.z <= 0 && h - E.x < Math.max(6, E.v) * .3 }; }
};
function dessinCourse(E, haies){
  const s = echelle(); camera(E.x + avance(2, s), 0, s);
  ciel(); tribunes(); piste();
  // la ligne de départ, d'arrivée (en damier), les repères
  g.fillStyle = '#fff'; for(const x of [0, E.dist]) g.fillRect(X(x) - 2, Y(0) - V.s * .6, 4, V.s * 1.5);
  if(X(E.dist) < W + 50){ for(let k = 0; k < 12; k++){ g.fillStyle = k % 2 ? '#1C2433' : '#fff'; g.fillRect(X(E.dist) + 3, Y(0) - V.s * .6 + k * V.s * .125, 6, V.s * .125); }
    g.fillStyle = '#E8434F'; g.fillRect(X(E.dist) - 2, Y(0) - V.s * 2.6, 4, V.s * 2); }
  reperes(10, E.dist - 10, 10);
  fantomes(E, 0, fx => course(fx * 1.15, 9));
  // la zone où sauter, puis les haies
  const hs = haies.find(h => h > E.x);
  if(hs && E.parti){ const [a, b] = zoneHaie(E, hs); g.fillStyle = 'rgba(46,200,100,.45)'; g.fillRect(X(a), Y(0) - V.s * .1, (b - a) * V.s, V.s * .25); }
  haies.forEach((h, i) => { const sx = X(h); if(sx < -40 || sx > W + 40) return;
    if(E.tombees && E.tombees.has(i)){ g.strokeStyle = '#D9DEE5'; g.lineWidth = 3; g.beginPath(); g.moveTo(sx, Y(0)); g.lineTo(sx + V.s * .9, Y(0) - V.s * .12); g.stroke(); g.fillStyle = '#fff'; g.fillRect(sx + V.s * .7, Y(0) - V.s * .28, V.s * .25, V.s * .1); return; }
    g.strokeStyle = '#D9DEE5'; g.lineWidth = Math.max(2, V.s * .05); g.beginPath(); g.moveTo(sx, Y(0)); g.lineTo(sx, Y(.92)); g.moveTo(sx - V.s * .1, Y(0)); g.lineTo(sx + V.s * .18, Y(0)); g.stroke();
    for(let k = 0; k < 4; k++){ g.fillStyle = k % 2 ? '#1C2433' : '#FFFFFF'; g.fillRect(sx - V.s * .06 + k * V.s * .06, Y(.98), V.s * .06, V.s * .13); } });
  let P;
  if(E.z > 0) P = { hanche:.92, torse:.55, tete:-.3, j1:[1.55, 1.5], j2:[-.3, -1.7], b1:[1.3, 1.5], b2:[-.7, -.2] };
  else if(!E.parti) P = { hanche:.55, torse:1.25, tete:-.6, j1:[1.1, -.6], j2:[.1, -1.4], b1:[1.25, 1.25], b2:[1.2, 1.2] };   // dans les starting-blocks
  else P = course(E.ph, E.v);
  ombre(E.x, 0, E.z || 0); athlete(E.x, E.z || 0, P, E.app);
  info([virg(Math.max(0, E.t), 2) + ' s', Math.round(E.v * 3.6) + ' km/h']);
  if(E.parti && !E.fini) compteurCadence();
}

// Les sauts avec élan (longueur, triple saut) : courir, appuyer avant la planche, maintenir pour l'angle
function debutSaut(ctx){ return { x:-34, v:0, t:0, ph:0, phase:'elan', ang:0, app:ctx.app }; }
function majElan(E, dt, vmax){ elan(E, dt, vmax); E.x += E.v * dt; E.ph += E.v * dt * 1.15; E.t += dt; }
function majAngle(E, dt, max = deg(70)){ E.ang = Math.min(max, E.ang + deg(75) * dt); }
EP.longueur = { n:'Saut en longueur', ico:'🏖️', saison:'ete', unite:'m', sens:1, essais:3, qual:6.3, ref:8.3, a:'SAUTER', lg:'COURIR',
  aide:'Tapotez ◀ ▶ pour l\'élan ; dans la zone verte avant la planche, appuyez sur SAUTER et gardez le doigt ; lâchez quand l\'aiguille est dans le vert.',
  tuto:['Tapotez ◀ ▶ en alternance pour prendre de l\'élan : la vitesse fait la longueur du saut.', 'Juste avant la planche blanche (zone verte), appuyez sur SAUTER et GARDEZ le doigt dessus : l\'aiguille de l\'angle monte.', 'Lâchez quand l\'aiguille est dans l\'arc vert (vers 22°). Si vous dépassez la planche, c\'est « mordu » : essai nul.'],
  debut:debutSaut,
  maj(E, dt){
    if(E.phase === 'elan'){ majElan(E, dt, 14.5);
      if(I.aP){ if(E.x > 0) return faute(E, 'Mordu ! (pied au-delà de la planche)', 'Mordu'); E.phase = 'angle'; E.xa = E.x; E.va = E.v; }
      else if(E.x > 1.2) return faute(E, 'Mordu ! (pied au-delà de la planche)', 'Mordu');
    } else if(E.phase === 'angle'){ majAngle(E, dt); E.x += E.v * dt * .3;
      if(I.aR || !I.a || E.ang >= deg(70)){ E.phase = 'vol'; E.vt = 0; const d = (E.va / 10) ** 2 * 9.2 * qAngle(enDeg(E.ang), 22, 26) + .3;
        E.dist = Math.max(.5, d + E.xa); E.duree = .5 + d * .09; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt >= E.duree){ E.phase = 'fin'; const r = Math.max(0, Math.round(E.dist * 100) / 100); finir(E, r, virg(r, 2) + ' m'); bip(700, .1); } }
  },
  dessin(E){ dessinSaut(E, false); },
  conseil(E){
    if(E.phase === 'elan') return E.x > -2.2 && E.x <= 0 ? { t:'SAUTEZ ! Appuyez et gardez le doigt', b:'a' } : { t:'Tapotez ◀ ▶ pour l\'élan — sautez dans la zone verte', b:'gd' };
    if(E.phase === 'angle') return Math.abs(enDeg(E.ang) - 22) < 7 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt… lâchez quand l\'aiguille est dans le vert', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'elan') return E.x > -.5 ? { a:true } : { taps:tapDemo(10.5) }; if(E.phase === 'angle') return { a:E.ang < deg(22) }; return {}; }
};
// Le triple saut : un anneau se resserre autour du pied ; appuyer quand il touche le cercle (le pied touche le sol)
const NOMS_BONDS = ['', '1 · Cloche-pied', '2 · Pas', '3 · Saut'];
EP.triple = { n:'Triple saut', ico:'🦘', saison:'ete', unite:'m', sens:1, essais:3, qual:12.8, ref:16.6, a:'SAUTER', lg:'COURIR',
  aide:'Élan, SAUTER avant la planche, puis SAUTER à chaque fois que le pied touche le sol (l\'anneau devient vert), et gardez le doigt au dernier pour l\'angle.',
  tuto:['Tapotez ◀ ▶ pour l\'élan, puis appuyez sur SAUTER dans la zone verte avant la planche : c\'est le 1er bond (cloche-pied).', 'Un anneau jaune se resserre autour du pied : appuyez sur SAUTER quand il touche le cercle (il devient vert) — c\'est le moment où le pied touche le sol. 2e bond : le pas.', 'Au 3e appui, GARDEZ le doigt : l\'aiguille de l\'angle monte ; lâchez dans le vert (22°) pour le saut final dans le sable.'],
  debut:ctx => ({ ...debutSaut(ctx), bond:0, total:0, q:[] }),
  maj(E, dt){
    if(E.phase === 'elan'){ majElan(E, dt, 14.5);
      if(I.aP){ if(E.x > 0) return faute(E, 'Mordu !', 'Mordu'); E.phase = 'bond'; E.xa = E.x; E.va = E.v; E.bond = 1; E.depX = E.x; E.vt = 0; E.longB = (E.va / 10) ** 2 * 6.7; E.duree = .42 + E.longB * .035; E.q.push(1); bip(500, .05); }
      else if(E.x > 1.2) return faute(E, 'Mordu !', 'Mordu');
    } else if(E.phase === 'bond'){ E.vt += dt;
      if(I.aP && E.bond < 3){ const ecart = Math.abs(E.vt - E.duree), q = clamp(1 - ecart / .3, 0, 1); E.q.push(q); E.depX += E.longB * Math.min(1, E.vt / E.duree); E.bond++; E.vt = 0;
        annoncer(q > .8 ? 'Parfait !' : q > .5 ? 'Bien' : 'Trop ' + (E.vt < E.duree ? 'tôt' : 'tard'), '', .5); bip(q > .8 ? 900 : 500, .06);
        if(E.bond === 2){ E.longB = (E.va / 10) ** 2 * 5.3 * Math.max(.3, q); E.duree = .36 + E.longB * .035; }
        else { E.phase = 'angle'; E.ang = 0; } }
      else if(E.vt >= E.duree + .3){ E.total = E.depX + E.longB; E.phase = 'fin'; const r = Math.max(0, Math.round(E.total * 100) / 100); finir(E, r, virg(r, 2) + ' m', 'appui manqué'); }
    } else if(E.phase === 'angle'){ majAngle(E, dt);
      if(I.aR || !I.a || E.ang >= deg(70)){ const l3 = (E.va / 10) ** 2 * 6.8 * Math.max(.3, E.q[2]) * qAngle(enDeg(E.ang), 22, 26); E.total = E.depX + l3; E.phase = 'vol'; E.vt = 0; E.duree = .5 + l3 * .08; E.dist = E.total; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt >= E.duree){ E.phase = 'fin'; const r = Math.max(0, Math.round(E.total * 100) / 100); finir(E, r, virg(r, 2) + ' m'); bip(700, .1); } }
  },
  dessin(E){ dessinSaut(E, true); },
  conseil(E){
    if(E.phase === 'elan') return E.x > -2.2 && E.x <= 0 ? { t:'SAUTEZ ! (1er bond : cloche-pied)', b:'a' } : { t:'Tapotez ◀ ▶ pour l\'élan — sautez dans la zone verte', b:'gd' };
    if(E.phase === 'bond'){ const ok = Math.abs(E.vt - E.duree) < .1; return ok ? { t:'MAINTENANT ! (le pied touche le sol)', b:E.bond === 2 ? 'a' : 'a' } : { t:`${NOMS_BONDS[E.bond + 1]} : appuyez quand l'anneau devient vert`, b:null }; }
    if(E.phase === 'angle') return Math.abs(enDeg(E.ang) - 22) < 7 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt… lâchez dans le vert', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'elan') return E.x > -.6 ? { a:true } : { taps:tapDemo(10.5) };
    if(E.phase === 'bond'){ E._r = !E._r && E.vt >= E.duree - .02; return { a:E._r || (E.bond === 2 && E.vt >= E.duree - .02) }; }
    if(E.phase === 'angle') return { a:E.ang < deg(22) }; return {}; }
};
function dessinSaut(E, triple){
  const s = echelle();
  let bx = E.x, bz = 0, P;
  if(E.phase === 'vol' || E.phase === 'fin'){
    const k = clamp(E.vt / E.duree, 0, 1), a = triple ? E.depX : (E.xa ?? 0), b = E.dist ?? E.x;
    bx = lerp(a, b, k); bz = E.phase === 'fin' ? 0 : Math.sin(k * Math.PI) * (.6 + (b - a) * .08);
    P = E.phase === 'fin' ? { hanche:.4, torse:.7, tete:-.3, j1:[1.5, 1.4], j2:[1.45, 1.35], b1:[1.6, 1.8], b2:[1.4, 1.6] }
      : k < .5 ? { hanche:.9, torse:.1, j1:[.6, -.6], j2:[-.4, -1.3], b1:[2.8, 3], b2:[2.6, 2.9] } : { hanche:.85, torse:.45, j1:[1.45, 1.2], j2:[1.35, 1.1], b1:[1.9, 1.7], b2:[1.8, 1.6] };
  } else if(E.phase === 'bond'){
    const k = clamp(E.vt / E.duree, 0, 1); bx = E.depX + E.longB * k; bz = Math.sin(k * Math.PI) * (.35 + E.longB * .05);
    P = E.bond === 1 ? { hanche:.92, torse:.2, j1:[.9, .2], j2:[-.4, -1.3], b1:[1.4, 1.6], b2:[-.8, -.2] } : { hanche:.92, torse:.15, j1:[1.2, .5], j2:[-.7, -1.1], b1:[-.8, -.3], b2:[1.3, 1.6] };
  } else if(E.phase === 'angle') P = { hanche:.95, torse:.1, j1:[1.2, .4], j2:[-.3, -.9], b1:[2.4, 2.6], b2:[2.2, 2.5] };
  else P = course(E.ph, E.v);
  camera(Math.max(E.x, bx) + avance(1.5, s), 0, s);
  ciel(); tribunes(); piste();
  // la zone d'appel, la planche, puis le bac à sable
  if(E.phase === 'elan'){ g.fillStyle = 'rgba(46,200,100,.45)'; g.fillRect(X(-2.2), Y(0) - V.s * .1, 2.2 * V.s, V.s * .25); }
  g.fillStyle = '#fff'; g.fillRect(X(-.2), Y(0) - V.s * .12, V.s * .2, V.s * .3);
  const dSable = triple ? 10 : 1;
  const gs = g.createLinearGradient(0, Y(0) - V.s * .2, 0, Y(0) + V.s * .4); gs.addColorStop(0, '#F3DFA8'); gs.addColorStop(1, '#D9BE7C');
  g.fillStyle = gs; g.fillRect(X(dSable), Y(0) - V.s * .18, V.s * 10, V.s * .55);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `800 ${clamp(V.s * .26, 10, 15)}px "Bricolage Grotesque", sans-serif`; g.textAlign = 'center';
  for(let m = dSable; m <= dSable + 10; m++){ g.fillRect(X(m) - 1, Y(0) + V.s * .42, 2, 6); if(m % 2 === 0 || triple) g.fillText(m, X(m), Y(0) + V.s * .72); }
  g.textAlign = 'left';
  if(E.phase === 'fin' || E.phase === 'vol'){ g.fillStyle = '#B88A4F'; g.beginPath(); g.ellipse(X(E.dist), Y(0) + V.s * .05, V.s * .35, V.s * .08, 0, 0, 6.29); g.fill(); }
  // triple saut : là où le pied va retomber, et l'anneau du bon moment
  if(E.phase === 'bond'){ const xl = E.depX + E.longB; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(xl) - 8, Y(0) - 4); g.lineTo(X(xl) + 8, Y(0) + 4); g.moveTo(X(xl) + 8, Y(0) - 4); g.lineTo(X(xl) - 8, Y(0) + 4); g.stroke();
    cible(X(xl), Y(0), (E.duree - E.vt) / .5, Math.abs(E.vt - E.duree) < .1);
    g.fillStyle = '#fff'; g.font = '400 28px "Bebas Neue", sans-serif'; g.textAlign = 'center'; g.fillText(NOMS_BONDS[E.bond + 1] || '', X(xl), Y(0) - V.s * 2.4); g.textAlign = 'left'; }
  ombre(bx, 0, bz); athlete(bx, bz, P, E.app);
  if(E.phase === 'angle') rapporteur(X(E.x) + 40, Y(1.3), E.ang, deg(22));
  info([E.phase === 'elan' ? Math.round(E.v * 3.6) + ' km/h' : E.phase === 'fin' ? virg(E.res || 0, 2) + ' m' : Math.round((E.va || E.v) * 3.6) + ' km/h']);
}

// Saut en hauteur : élan, appel dans la zone verte, angle vers 65° ; passage en rouleau dorsal
EP.hauteur = { n:'Saut en hauteur', ico:'🎚️', saison:'ete', unite:'m', sens:1, essais:'echelle', depart:1.85, pas:.05, max:2.6, qual:1.95, ref:2.35, a:'SAUTER', lg:'COURIR',
  aide:'Tapotez ◀ ▶ pour l\'élan, appuyez sur SAUTER dans la zone verte devant la barre et gardez le doigt ; lâchez dans le vert (65°).',
  tuto:['Tapotez ◀ ▶ pour l\'élan (une course courte).', 'Dans la zone verte devant la barre, appuyez sur SAUTER et GARDEZ le doigt : l\'aiguille de l\'angle monte.', 'Lâchez dans l\'arc vert (vers 65°, presque vers le haut). La barre monte de 5 cm à chaque réussite ; 3 échecs de suite et c\'est fini.'],
  debut:ctx => ({ x:-16, v:0, t:0, ph:0, phase:'elan', ang:0, barre:ctx.barre, app:ctx.app }),
  maj(E, dt){
    if(E.phase === 'elan'){ majElan(E, dt, 12);
      if(I.aP){ E.phase = 'angle'; E.xa = E.x; E.va = E.v; E.qpos = clamp(1 - Math.abs(E.x + 1.4) / 1.3, 0, 1); }
      else if(E.x > -.2){ E.phase = 'fin'; E.h = 0; E.reussi = false; E.vt = 0; E.duree = 1; finir(E, 0, 'Raté', 'Pas d\'appel'); }
    } else if(E.phase === 'angle'){ majAngle(E, dt, deg(85)); E.x += E.v * dt * .2;
      if(I.aR || !I.a || E.ang >= deg(85)){ E.h = 1.05 + 1.45 * Math.min(1.05, E.va / 8.5) ** 2 * E.qpos * qAngle(enDeg(E.ang), 65, 28); E.phase = 'vol'; E.vt = 0; E.duree = 1.1; E.reussi = E.h >= E.barre; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt > E.duree){ E.phase = 'fin'; finir(E, Math.round(E.h * 100) / 100, E.reussi ? 'Réussi !' : 'Barre tombée', virg(E.barre, 2) + ' m'); bip(E.reussi ? 900 : 200, .15); } }
    else if(E.phase === 'fin') E.vt += dt;
  },
  dessin(E){
    const s = echelle() * 1.05;
    camera(E.phase === 'elan' ? Math.max(E.x + avance(2, s), -1) : Math.max(-1, (E.xa ?? E.x) + avance(2, s)), 0, s);
    ciel(); tribunes(); piste('#3F6FB0', false);
    if(E.phase === 'elan'){ g.fillStyle = 'rgba(46,200,100,.5)'; g.fillRect(X(-2.7), Y(0) - V.s * .1, V.s * 2.6, V.s * .25); }
    // le tapis, les poteaux, la barre
    const gt = g.createLinearGradient(0, Y(.9), 0, Y(0)); gt.addColorStop(0, '#F0505C'); gt.addColorStop(1, '#A51D2D');
    g.fillStyle = gt; arrondi(X(.2), Y(.85), V.s * 4, V.s * .85, V.s * .12); g.fill();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(X(.2) + 4, Y(.85) + 3, V.s * 4 - 8, V.s * .1);
    g.fillStyle = '#C9D1DB'; for(const px of [0, .12]) g.fillRect(X(px) - 3, Y(E.barre + .35), 5, V.s * (E.barre + .35));
    const tombe = !E.reussi && (E.phase === 'fin' || (E.phase === 'vol' && E.vt > .55));
    g.strokeStyle = '#F2C230'; g.lineWidth = Math.max(4, V.s * .07); g.lineCap = 'round'; g.beginPath(); if(tombe){ g.moveTo(X(.2), Y(.95)); g.lineTo(X(1.4), Y(.85)); } else { g.moveTo(X(-.12), Y(E.barre)); g.lineTo(X(.24), Y(E.barre)); } g.stroke();
    g.fillStyle = '#fff'; g.font = '400 28px "Bebas Neue", sans-serif'; g.fillText(virg(E.barre, 2) + ' m', X(0) - 86, Y(E.barre) - 8);
    let P, bx = E.x, by = 0;
    if(E.phase === 'vol' || (E.phase === 'fin' && E.h)){
      // le rouleau dorsal : dos à la barre, la tête passe d'abord
      const k = E.phase === 'fin' ? 1 : clamp(E.vt / E.duree, 0, 1), x0 = E.xa, x1 = 1.5, k0 = clamp((0 - x0) / (x1 - x0), .3, .7);
      const top = Math.max(1.1, E.h - .05);
      bx = lerp(x0, x1, k); by = k < k0 ? top - (top - .95) * ((k - k0) / k0) ** 2 : top - (top - .75) * ((k - k0) / (1 - k0)) ** 2;
      const rot = -Math.PI / 2 * clamp(k / k0, 0, 1) * (k < .92 ? 1 : 1);
      P = { hanche:0, torse:-.35, tete:-.2, j1:[.5 + k * .8, -.6], j2:[.4 + k * .8, -.7], b1:[-.3, -.2], b2:[-.4, -.3], rot, miroir:true };
      if(E.phase === 'fin'){ bx = 1.6; by = .95; P = { hanche:0, torse:-.2, j1:[1.4, .4], j2:[1.3, .3], b1:[.3, .5], b2:[.2, .4], rot:-Math.PI / 2, miroir:true }; }
      ombre(bx, 0, by);
    }
    else if(E.phase === 'angle'){ P = { hanche:.95, torse:-.1, j1:[1.4, .6], j2:[-.2, -.6], b1:[2.7, 2.9], b2:[2.5, 2.8] }; ombre(bx, 0); }
    else { P = course(E.ph, E.v); ombre(bx, 0); }
    athlete(bx, by, P, E.app);
    if(E.phase === 'angle') rapporteur(X(E.x) + 40, Y(1.4), E.ang, deg(65));
    info([Math.round((E.va || E.v) * 3.6) + ' km/h']);
  },
  conseil(E){
    if(E.phase === 'elan') return E.x > -2.7 ? { t:'SAUTEZ ! Appuyez et gardez le doigt', b:'a' } : { t:'Tapotez ◀ ▶ pour l\'élan — sautez dans la zone verte', b:'gd' };
    if(E.phase === 'angle') return Math.abs(enDeg(E.ang) - 65) < 9 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt… lâchez dans le vert (65°)', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'elan') return E.x > -1.5 ? { a:true } : { taps:tapDemo(10) }; if(E.phase === 'angle') return { a:E.ang < deg(65) }; return {}; }
};
// Saut à la perche : élan, planter dans la zone verte, garder le doigt pendant que la perche plie, lâcher dans le vert
EP.perche = { n:'Saut à la perche', ico:'🎋', saison:'ete', unite:'m', sens:1, essais:'echelle', depart:4.3, pas:.1, max:6.5, qual:4.6, ref:5.9, a:'PLANTER', lg:'COURIR',
  aide:'Élan, PLANTER dans la zone verte et gardez le doigt pendant que la perche plie ; lâchez quand la jauge est dans le vert.',
  tuto:['Tapotez ◀ ▶ pour courir avec la perche : la vitesse donne la hauteur.', 'Dans la zone verte (avant le butoir), appuyez sur PLANTER et GARDEZ le doigt : la perche plie et vous soulève.', 'Lâchez quand la jauge du haut est dans le vert : la perche se détend et vous propulse au-dessus de la barre.'],
  debut:ctx => ({ x:-32, v:0, t:0, ph:0, phase:'elan', barre:ctx.barre, pl:0, app:ctx.app }),
  maj(E, dt){
    if(E.phase === 'elan'){ majElan(E, dt, 13.5);
      if(I.aP){ E.q1 = clamp(1 - Math.abs(E.x + 4.6) / 1.8, 0, 1); E.va = E.v; E.phase = 'plie'; E.xa = E.x; E.pl = 0; bip(400, .06); }
      else if(E.x > -2.6){ E.phase = 'fin'; E.reussi = false; finir(E, 0, 'Raté', 'Perche pas plantée'); } }
    else if(E.phase === 'plie'){ E.pl += dt; if(I.aR || !I.a || E.pl > 1.6){ const q2 = clamp(1 - Math.abs(E.pl - .95) / .5, 0, 1);
        E.h = 1.8 + 4.6 * Math.min(1.05, E.va / 9.5) ** 2 * E.q1 * (.35 + .65 * q2); E.reussi = E.h >= E.barre; E.phase = 'vol'; E.vt = 0; E.duree = 1.3; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt > E.duree){ E.phase = 'fin'; finir(E, Math.round(E.h * 100) / 100, E.reussi ? 'Réussi !' : 'Barre tombée', virg(E.barre, 2) + ' m'); bip(E.reussi ? 900 : 200, .15); } }
  },
  dessin(E){
    // tout tient à l'écran : le sol en bas, la barre (et un peu plus) en haut
    const s = Math.min(echelle() * .95, (SOL() - HAUT - 50) / (E.barre + 1.3));
    // pendant le saut : on voit le butoir, la barre et le tapis
    const cxSaut = -5 + (W * ANCRE()) / s;
    camera(E.phase === 'elan' ? Math.min(Math.max(E.x + avance(3, s), -30), cxSaut) : cxSaut, 0, s);
    ciel(); tribunes(); piste('#3F6FB0', false);
    const gt = g.createLinearGradient(0, Y(.9), 0, Y(0)); gt.addColorStop(0, '#F0505C'); gt.addColorStop(1, '#A51D2D');
    g.fillStyle = gt; arrondi(X(.3), Y(.9), V.s * 5, V.s * .9, V.s * .12); g.fill();
    g.fillStyle = '#C9D1DB'; g.fillRect(X(.15) - 3, Y(E.barre + .4), 6, V.s * (E.barre + .4));
    const tombe = !E.reussi && (E.phase === 'fin' || (E.phase === 'vol' && E.vt > .8));
    g.strokeStyle = '#F2C230'; g.lineWidth = Math.max(4, V.s * .08); g.lineCap = 'round'; g.beginPath(); if(tombe){ g.moveTo(X(.3), Y(1)); g.lineTo(X(1.7), Y(.9)); } else { g.moveTo(X(-.15), Y(E.barre)); g.lineTo(X(.45), Y(E.barre)); } g.stroke();
    g.fillStyle = '#fff'; g.font = '400 28px "Bebas Neue", sans-serif'; g.fillText(virg(E.barre, 2) + ' m', X(0) - 86, Y(E.barre) - 8);
    g.fillStyle = '#5C6678'; g.fillRect(X(-.35), Y(0) - V.s * .02, V.s * .35, V.s * .2);   // le butoir
    if(E.phase === 'elan'){ g.fillStyle = 'rgba(46,200,100,.5)'; g.fillRect(X(-6.4), Y(0) - V.s * .1, V.s * 3.8, V.s * .25); }
    let bx = E.x, by = 0, P, mains = null, flex = 0;
    if(E.phase === 'elan'){ P = course(E.ph, E.v, { b1:[1.3, 1.9], b2:[1.1, 1.7] }); }
    else if(E.phase === 'plie'){
      const k = Math.sin(clamp(E.pl / 1.1, 0, 1) * Math.PI / 2); bx = lerp(E.xa, -1.6, k); by = k * 1.6;
      P = { hanche:.9, torse:-.15 * k, j1:[.4 + k * 1.6, .2 + k * 1.2], j2:[.2 + k * 1.4, k * 1.1], b1:[3, 3.05], b2:[2.9, 3], rot:-k * 2.2 };
      flex = clamp(1 - Math.abs(E.pl - .95) / .95, 0, 1) * (E.pl < 1.6 ? 1 : 0);
      const pl = 1.6, wz = HAUT + 8; jauge(W / 2 - 100, wz, 200, 16, clamp(E.pl / pl, 0, 1), '#F2C230', [.45 / pl, 1.45 / pl], 'lâchez dans le vert');
    } else {
      const k = clamp(E.vt / E.duree, 0, 1), top = Math.max(1.8, E.h - .4);
      bx = lerp(-1.6, 1.2, k); by = k < .5 ? lerp(1.6, top, Math.sin(k / .5 * Math.PI / 2)) : lerp(top, .95, ((k - .5) / .5) ** 2);
      if(E.phase === 'fin'){ bx = 1.6; by = .95; }
      P = { hanche:0, torse:0, j1:[.3, 0], j2:[.2, -.1], b1:[2.9, 3], b2:[2.8, 2.9], rot:E.phase === 'fin' ? -Math.PI / 2 : -2.2 - k * 1.6 };
    }
    ombre(bx, 0, by);
    const main = athlete(bx, by, P, E.app);
    // la perche : de la main au sol (couchée vers l'avant pendant la course, plantée dans le butoir ensuite)
    if(E.phase !== 'vol' && E.phase !== 'fin' && main){
      const mx = X(bx) + main[0], my = Y(by + P.hanche) + main[1];
      let ex, ey; if(E.phase === 'elan'){ ex = mx + V.s * 4.3; ey = my + V.s * .9; } else { ex = X(-.2); ey = Y(0); }
      const cxp = (mx + ex) / 2 + flex * V.s * .9, cyp = (my + ey) / 2 - flex * V.s * .6;
      g.strokeStyle = '#3C2F25'; g.lineWidth = Math.max(3, V.s * .07); g.lineCap = 'round'; g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(cxp, cyp, ex, ey); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, V.s * .02); g.stroke();
    } else if(E.phase === 'vol' && E.vt < .5){ g.strokeStyle = '#3C2F25'; g.lineWidth = Math.max(3, V.s * .07); g.beginPath(); g.moveTo(X(-.2), Y(0)); g.lineTo(X(lerp(-1.4, -2.8, E.vt * 2)), Y(4)); g.stroke(); }
    info([Math.round((E.va || E.v) * 3.6) + ' km/h']);
  },
  conseil(E){
    if(E.phase === 'elan') return E.x > -6.4 ? { t:'PLANTEZ ! Appuyez et gardez le doigt', b:'a' } : { t:'Tapotez ◀ ▶ pour courir — plantez dans la zone verte', b:'gd' };
    if(E.phase === 'plie') return E.pl >= .45 && E.pl <= 1.45 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt : la perche plie…', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'elan') return E.x > -4.8 ? { a:true } : { taps:tapDemo(10) }; if(E.phase === 'plie') return { a:E.pl < .95 }; return {}; }
};

// Lancers
EP.javelot = { n:'Javelot', ico:'🎯', saison:'ete', unite:'m', sens:1, essais:3, qual:62, ref:86, a:'LANCER', lg:'COURIR',
  aide:'Tapotez ◀ ▶ pour l\'élan, appuyez sur LANCER dans la zone verte (avant la ligne) et gardez le doigt ; lâchez dans le vert (36°).',
  tuto:['Tapotez ◀ ▶ pour l\'élan : la vitesse donne la distance.', 'Dans la zone verte avant la ligne blanche, appuyez sur LANCER et GARDEZ le doigt : l\'aiguille de l\'angle monte.', 'Lâchez dans l\'arc vert (vers 36°). Si vous passez la ligne blanche, le lancer est nul.'],
  debut:ctx => ({ x:-22, v:0, t:0, ph:0, phase:'elan', ang:0, app:ctx.app }),
  maj(E, dt){
    if(E.phase === 'elan'){ majElan(E, dt, 13);
      if(I.aP){ if(E.x > 0) return faute(E, 'Ligne franchie'); E.phase = 'angle'; E.va = E.v; E.xa = E.x; }
      else if(E.x > .5) return faute(E, 'Ligne franchie'); }
    else if(E.phase === 'angle'){ majAngle(E, dt); E.x += E.va * dt * .15; if(E.x > .5) return faute(E, 'Ligne franchie');
      if(I.aR || !I.a || E.ang >= deg(70)){ E.d = Math.max(5, (E.va / 10) ** 2 * 108 * qAngle(enDeg(E.ang), 36, 34)); E.phase = 'vol'; E.vt = 0; E.duree = 1.2 + E.d / 45; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt >= E.duree){ E.phase = 'fin'; const r = Math.round(E.d * 100) / 100; finir(E, r, virg(r, 2) + ' m'); bip(700, .1); } }
  },
  dessin(E){ dessinLancer(E, 'javelot'); },
  conseil(E){
    if(E.phase === 'elan') return E.x > -3 ? { t:'LANCEZ ! Appuyez et gardez le doigt', b:'a' } : { t:'Tapotez ◀ ▶ pour l\'élan — lancez dans la zone verte', b:'gd' };
    if(E.phase === 'angle') return Math.abs(enDeg(E.ang) - 36) < 8 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt… lâchez dans le vert (36°)', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'elan') return E.x > -1.4 ? { a:true } : { taps:tapDemo(10) }; if(E.phase === 'angle') return { a:E.ang < deg(36) }; return {}; }
};
EP.poids = { n:'Lancer du poids', ico:'⚫', saison:'ete', unite:'m', sens:1, essais:3, qual:16, ref:21.5, a:'LANCER', lg:'FORCE',
  aide:'Tapotez ◀ ▶ pour remplir la jauge de force (3 secondes), puis appuyez sur LANCER et gardez le doigt ; lâchez dans le vert (40°).',
  tuto:['Tapotez ◀ ▶ le plus vite possible : la jauge de force se remplit (vous avez un peu plus de 3 secondes).', 'Appuyez sur LANCER et GARDEZ le doigt : l\'athlète pivote et l\'aiguille de l\'angle monte.', 'Lâchez dans l\'arc vert (vers 40°).'],
  debut:ctx => ({ x:0, v:0, t:0, phase:'force', p:0, ang:0, app:ctx.app }),
  maj(E, dt){
    if(E.phase === 'force'){ E.t += dt; E.p = clamp(E.p + I.taps * .1 * (1 - E.p * .6) - .45 * E.p * dt, 0, 1);
      if(I.aP || E.t > 3.2) E.phase = 'angle'; }
    else if(E.phase === 'angle'){ majAngle(E, dt); if(I.aR || !I.a || E.ang >= deg(70)){ E.d = 3 + 19.5 * E.p * qAngle(enDeg(E.ang), 40, 32); E.phase = 'vol'; E.vt = 0; E.duree = 1 + E.d / 30; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt >= E.duree){ E.phase = 'fin'; const r = Math.round(E.d * 100) / 100; finir(E, r, virg(r, 2) + ' m'); bip(700, .1); } }
  },
  dessin(E){ dessinLancer(E, 'poids'); },
  conseil(E){
    if(E.phase === 'force') return E.t > 2.6 ? { t:'LANCEZ ! Appuyez et gardez le doigt', b:'a' } : { t:`Tapotez ◀ ▶ pour la force (encore ${virg(Math.max(0, 3.2 - E.t), 1)} s)`, b:'gd' };
    if(E.phase === 'angle') return Math.abs(enDeg(E.ang) - 40) < 8 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt… lâchez dans le vert (40°)', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'force') return E.t > 2.9 ? { a:true } : { taps:tapDemo(10) }; if(E.phase === 'angle') return { a:E.ang < deg(40) }; return {}; }
};
EP.marteau = { n:'Lancer du marteau', ico:'🔨', saison:'ete', unite:'m', sens:1, essais:3, qual:60, ref:80, a:'LANCER', lg:'TOURNER', bulle:150,
  aide:'Tapotez ◀ ▶ pour faire tourner le marteau ; appuyez sur LANCER quand la boule passe dans le secteur vert et gardez le doigt ; lâchez dans le vert (42°).',
  tuto:['Le cadran du haut montre le cercle vu du dessus : la boule du marteau tourne autour de l\'athlète.', 'Tapotez ◀ ▶ pour tourner de plus en plus vite (la vitesse fait la distance).', 'Quand la boule passe dans le secteur VERT (vers l\'avant), appuyez sur LANCER et GARDEZ le doigt, puis lâchez dans l\'arc vert de l\'angle (42°). Hors du secteur : lancer nul.'],
  debut:ctx => ({ x:0, t:0, phase:'tour', w:0, a:Math.PI, ang:0, trace:[], app:ctx.app }),
  maj(E, dt){
    if(E.phase === 'tour'){ E.t += dt; E.w = clamp(E.w + I.taps * .16 * (1 - E.w / 2.6) - .35 * E.w * dt, 0, 2.6); E.a = (E.a + E.w * dt * 6.283) % 6.283;
      if(I.aP){ const err = Math.atan2(Math.sin(E.a), Math.cos(E.a)); if(Math.abs(err) > .55) return faute(E, 'Hors du secteur');
        E.qd = 1 - Math.abs(err) / .55 * .35; E.wa = E.w; E.phase = 'angle'; }
      if(E.t > 9){ E.fini = true; E.res = null; E.msg = 'Trop long'; annoncer('Temps écoulé'); } }
    else if(E.phase === 'angle'){ majAngle(E, dt); if(I.aR || !I.a || E.ang >= deg(70)){ E.d = Math.max(5, 84 * (E.wa / 1.78) ** 2 * E.qd * qAngle(enDeg(E.ang), 42, 32)); E.phase = 'vol'; E.vt = 0; E.duree = 1.3 + E.d / 45; } }
    else if(E.phase === 'vol'){ E.vt += dt; if(E.vt >= E.duree){ E.phase = 'fin'; const r = Math.round(E.d * 100) / 100; finir(E, r, virg(r, 2) + ' m'); bip(700, .1); } }
  },
  dessin(E){ dessinLancer(E, 'marteau'); },
  conseil(E){
    if(E.phase === 'tour'){ const err = Math.abs(Math.atan2(Math.sin(E.a), Math.cos(E.a)));
      if(E.w < 1.3) return { t:'Tapotez ◀ ▶ pour tourner plus vite', b:'gd' };
      return err < .45 ? { t:'LANCEZ ! (la boule est dans le vert)', b:'a' } : { t:'Encore… appuyez quand la boule passe dans le vert', b:'gd' }; }
    if(E.phase === 'angle') return Math.abs(enDeg(E.ang) - 42) < 8 ? { t:'LÂCHEZ !', b:'aL' } : { t:'Gardez le doigt… lâchez dans le vert (42°)', b:'aT' };
    return null; },
  demo(E){ if(E.phase === 'tour'){ if(E.t > 5 && Math.abs(Math.atan2(Math.sin(E.a), Math.cos(E.a))) < .3) return { a:true }; return { taps:tapDemo(10.5) }; }
    if(E.phase === 'angle') return { a:E.ang < deg(42) }; return {}; }
};
function dessinLancer(E, type){
  const enVol = E.phase === 'vol' || E.phase === 'fin', k = enVol ? clamp(E.vt / E.duree, 0, 1) : 0;
  const x0 = type === 'javelot' ? (E.xa ?? E.x) : 0, px = x0 + (enVol ? E.d * k : 0);
  // la hauteur de l'engin en vol : la caméra le suit vers le haut
  const hEngin = enVol ? Math.sin(k * Math.PI) * Math.max(1.5, E.d * Math.tan(E.ang) * .25) + (1 - k) * 2 : 0;
  const s = echelle() * (type === 'javelot' ? .85 : 1);
  camera(enVol ? Math.max(x0 + 1, px - 2) : (type === 'javelot' ? E.x + avance(2, s) : avance(1.5, s)), enVol ? Math.max(0, hEngin - (SOL() - HAUT) / s * .6) : 0, s);
  ciel(); tribunes(); piste('#5E9E4A', false);
  if(type === 'javelot'){ g.fillStyle = '#C8553D'; g.fillRect(0, Y(0) - V.s * .6, Math.max(0, X(0)), V.s * 1.5); g.fillStyle = '#fff'; g.fillRect(X(0) - 3, Y(0) - V.s * .6, 6, V.s * 1.5);
    if(E.phase === 'elan'){ g.fillStyle = 'rgba(46,200,100,.5)'; g.fillRect(X(-3), Y(0) - V.s * .1, V.s * 3, V.s * .25); } }
  else { g.fillStyle = '#9AA3AF'; g.beginPath(); g.ellipse(X(0), Y(0) + V.s * .1, V.s * 1.1, V.s * .28, 0, 0, 6.29); g.fill(); g.fillStyle = '#B9C0CA'; g.beginPath(); g.ellipse(X(0), Y(0) + V.s * .08, V.s * 1.0, V.s * .23, 0, 0, 6.29); g.fill();
    g.fillStyle = '#fff'; g.fillRect(X(1.07) - 2, Y(0) - V.s * .15, 4, V.s * .45); }
  // les lignes du secteur et les distances
  reperes(type === 'poids' ? 5 : 10, type === 'poids' ? 30 : 100, type === 'poids' ? 5 : 10);
  if(type === 'marteau' && !enVol){ // la cage, avec son filet
    g.strokeStyle = 'rgba(28,36,51,.55)'; g.lineWidth = 2; for(let i = -3; i <= 0; i++){ g.beginPath(); g.moveTo(X(i * .9 - .4), Y(0)); g.lineTo(X(i * .9 - .4), Y(3.6)); g.stroke(); }
    g.strokeStyle = 'rgba(28,36,51,.15)'; g.lineWidth = 1; for(let yy = .3; yy < 3.6; yy += .3){ g.beginPath(); g.moveTo(X(-3.1), Y(yy)); g.lineTo(X(-.4), Y(yy)); g.stroke(); } }
  let P;
  if(E.phase === 'elan') P = course(E.ph, E.v, { b1:[2.6, 2.4] });
  else if(E.phase === 'force') P = { ...DEBOUT, hanche:.82 - E.p * .15, torse:-.3 - E.p * .3, j1:[.6, -.2], j2:[-.3, -.6], b1:[2.9, 3.1], b2:[.6, 1.5], tete:.2 };
  else if(E.phase === 'tour'){ const c = Math.cos(E.a), sn = Math.sin(E.a); P = { ...DEBOUT, hanche:.88, torse:-.15, j1:[.3 + sn * .2, 0], j2:[-.25 - sn * .2, -.1], b1:[1.5 + c * .6, 1.5 + c * .6], b2:[1.45 + c * .6, 1.45 + c * .6], miroir:c < -.2 }; }
  else if(E.phase === 'angle') P = { ...DEBOUT, torse:-.35, j1:[.6, .2], j2:[-.4, -.6], b1:type === 'javelot' ? [-1.6, -2.2] : [2.6, 2.8], b2:[1, 1.6] };
  else P = { ...DEBOUT, torse:.45, j1:[.5, .2], j2:[-.6, -.9], b1:[1.9, 1.7], b2:[-.6, -.2] };
  const corps = enVol ? x0 : (E.phase === 'elan' || E.phase === 'angle' ? E.x : 0);
  // marteau : la boule passe derrière l'athlète la moitié du tour
  const boulePos = () => { const r = V.s * 1.35, sx = X(corps) + Math.cos(E.a) * r, sy = Y(.95) + Math.sin(E.a) * r * .22 - Math.cos(E.a) * r * .35; return [sx, sy]; };
  const dessinBoule = () => { const [hx, hy] = boulePos(); g.strokeStyle = '#8D96A3'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(corps), Y(1.1)); g.lineTo(hx, hy); g.stroke(); boule(hx, hy, V.s * .13, '#2B2F36'); };
  if(type === 'marteau' && E.phase === 'tour' && Math.sin(E.a) < 0) dessinBoule();
  ombre(corps, 0);
  const main = athlete(corps, 0, P, E.app);
  if(type === 'marteau' && E.phase === 'tour' && Math.sin(E.a) >= 0) dessinBoule();
  // l'engin
  if(enVol){
    const ex = X(px), ey = Y(hEngin);
    if(type === 'javelot'){ const pente = Math.cos(k * Math.PI) * E.ang; g.strokeStyle = '#E6E9EE'; g.lineWidth = 3; g.beginPath(); g.moveTo(ex - Math.cos(pente) * V.s * 1.2, ey + Math.sin(pente) * V.s * 1.2); g.lineTo(ex + Math.cos(pente) * V.s * 1.2, ey - Math.sin(pente) * V.s * 1.2); g.stroke();
      g.strokeStyle = '#E8434F'; g.lineWidth = 4; g.beginPath(); g.moveTo(ex - Math.cos(pente) * V.s * .15, ey + Math.sin(pente) * V.s * .15); g.lineTo(ex + Math.cos(pente) * V.s * .15, ey - Math.sin(pente) * V.s * .15); g.stroke(); }
    else boule(ex, ey, V.s * .13, '#2B2F36');
    if(E.phase === 'fin'){ g.fillStyle = '#fff'; g.font = '400 28px "Bebas Neue", sans-serif'; g.fillText(virg(E.d, 2) + ' m', ex - 30, ey - 20); }
  } else if(main && type !== 'marteau'){
    const mx = X(corps) + main[0], my = Y(P.hanche) + main[1];
    if(type === 'javelot'){ g.strokeStyle = '#E6E9EE'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx - V.s * 1.1, my + V.s * .2); g.lineTo(mx + V.s * 1.1, my - V.s * .25); g.stroke(); }
    else boule(mx, my, V.s * .13, '#2B2F36');
  }
  if(E.phase === 'angle') rapporteur(X(corps) + 40, Y(1.5), E.ang, deg(type === 'javelot' ? 36 : type === 'poids' ? 40 : 42));
  if(E.phase === 'force'){ jauge(W / 2 - 100, HAUT + 6, 200, 18, E.p, '#F2C230', null, 'force'); info([`${virg(Math.max(0, 3.2 - E.t), 1)} s`]); }
  if(E.phase === 'tour'){
    // le cercle vu du dessus : l'athlète au centre, la boule qui tourne, le secteur vert vers l'avant (à droite)
    const r = Math.min(58, W * .14), cx = W / 2, cy = HAUT + r + 14;
    g.fillStyle = 'rgba(28,36,51,.72)'; g.beginPath(); g.arc(cx, cy, r + 12, 0, 6.29); g.fill();
    g.fillStyle = 'rgba(46,200,100,.5)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r + 10, -.55, .55); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, 6.29); g.stroke();
    for(let k = 1; k <= 8; k++){ const a = E.a - k * .12 * Math.max(.4, E.w); g.fillStyle = `rgba(242,194,48,${.5 - k * .055})`; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, 0, 6.29); g.fill(); }
    g.strokeStyle = '#D0D5DD'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(E.a) * r, cy + Math.sin(E.a) * r); g.stroke();
    boule(cx + Math.cos(E.a) * r, cy + Math.sin(E.a) * r, 8, '#F2C230'); boule(cx, cy, 7, E.app.c1);
    g.fillStyle = '#fff'; g.font = '800 12px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center'; g.fillText('lancer ▶', cx + r + 4, cy - r * .6); g.textAlign = 'left';
    info([`${virg(E.w, 1)} tour/s`, `${virg(Math.max(0, 9 - E.t), 0)} s`]); }
  if(E.phase === 'elan') info([Math.round(E.v * 3.6) + ' km/h']);
}

// 50 m nage libre : plonger au signal, tapoter pour nager, respirer quand la jauge d'air est rouge
EP.nage = { n:'50 m nage libre', ico:'🏊', saison:'ete', unite:'s', sens:-1, essais:1, qual:28, ref:22.8, a:'PLONGER', lg:'NAGER',
  aide:'PLONGER au signal, tapotez ◀ ▶ pour nager, et appuyez sur le bouton rouge (RESPIRER) quand la jauge d\'air devient rouge.',
  tuto:['Attendez le signal, puis appuyez sur PLONGER (le bouton rouge).', 'Tapotez ◀ ▶ en alternance : chaque appui est un mouvement de bras.', 'La jauge d\'AIR (la bulle bleue) se vide sous l\'eau. Quand elle devient rouge, appuyez sur RESPIRER (le bouton rouge). Trop tôt, vous perdez du temps ; si elle est vide, le nageur ralentit beaucoup.'],
  debut:ctx => ({ x:0, v:0, t:0, dep:0, departAction:true, plonge:false, ph:0, dist:50, air:1, resp:0, fant:ctx.fant, app:ctx.app }),
  maj(E, dt){
    if(!E.plonge){ I.taps = 0;   // avant le plongeon, les mouvements de bras ne comptent pas
      if(!depart(E, dt)) return; E.t += dt; if(I.aP){ E.plonge = true; E.v = 2.6 - Math.min(1, E.t) * .6; E.vol = .5; bip(400, .08); $('cAt') && ($('cAt').textContent = 'RESPIRER'); } return; }
    E.t += dt; E.vol = Math.max(0, (E.vol || 0) - dt);
    elan(E, dt, E.air > 0 ? 2.8 : 1.3, .45, .5); E.x += E.v * dt; E.ph += dt * (2 + cadence() * .5);
    E.air = Math.max(0, E.air - dt / 5.5); E.resp = Math.max(0, E.resp - dt);
    if(I.aP){
      if(E.air < .45){ E.air = 1; E.v *= .96; E.resp = .45; bip(800, .06); }
      else { E.air = Math.min(1, E.air + .25); E.v *= .9; E.resp = .45; annoncer('Trop tôt', 'respirez quand la jauge est rouge', .6); }
    }
    if(E.air <= 0 && !E.manque){ E.manque = true; annoncer('À bout de souffle !', 'respirez (bouton rouge)', .9); bip(160, .2, .1, 'sawtooth'); }
    if(E.air > 0) E.manque = false;
    if(E.x >= E.dist){ const r = E.t - (E.x - E.dist) / Math.max(.5, E.v); finir(E, r, virg(r, 2) + ' s'); }
  },
  dessin(E){
    const s = echelle() * 1.15; camera(E.x + avance(1, s), 0, s);
    // la halle : le mur carrelé, les fanions, la piscine
    const gm = g.createLinearGradient(0, 0, 0, Y(0)); gm.addColorStop(0, '#DCE6EF'); gm.addColorStop(1, '#B9CAD9'); g.fillStyle = gm; g.fillRect(0, 0, W, Y(0));
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; const pc = V.s * .5, dx = -(V.cx * V.s * .6) % pc;
    for(let x = dx; x < W; x += pc){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Y(0)); g.stroke(); } for(let y = Y(0); y > 0; y -= pc){ g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = '#1F6FE0'; g.fillRect(0, Y(0) - V.s * 2.6, W, V.s * .35);
    for(let x = -(V.cx * V.s * .8) % 60 - 60; x < W + 60; x += 30){ g.fillStyle = (Math.round(x / 30) % 2) ? '#F2C230' : '#E8434F'; g.beginPath(); g.moveTo(x, Y(0) - V.s * 2.25); g.lineTo(x + 24, Y(0) - V.s * 2.25); g.lineTo(x + 12, Y(0) - V.s * 1.9); g.fill(); }
    // le plot de départ et le mur d'arrivée
    g.fillStyle = '#E6E9EE'; g.fillRect(X(-1.2), Y(.7), V.s, V.s * .25); g.fillStyle = '#9AA3AF'; g.fillRect(X(-1.1), Y(.45), V.s * .2, V.s * .45);
    g.fillStyle = '#E6E9EE'; g.fillRect(X(E.dist), Y(.4), V.s * .5, V.s * 2);
    (E.fant || []).forEach((f, i) => { const fx = fantome(f.T, E.t - .2, E.dist); g.save(); g.translate(0, -V.s * (.22 + i * .14)); nageur(fx, E.t * 6 + i, f.app, .5, .85); g.restore(); });
    // l'eau
    const ge = g.createLinearGradient(0, Y(0), 0, Hh); ge.addColorStop(0, 'rgba(56,160,226,.72)'); ge.addColorStop(1, 'rgba(18,80,150,.95)');
    if(!E.plonge){ g.fillStyle = ge; g.fillRect(0, Y(0), W, Hh); }
    if(!E.plonge){ ombre(-.7, .7); athlete(-.75, .7, E.parti ? { hanche:.6, torse:1.3, tete:-.4, j1:[.9, -.3], j2:[.6, -.6], b1:[1.9, 2.2], b2:[1.8, 2.1] } : { hanche:.62, torse:1.2, tete:-.5, j1:[.8, -.6], j2:[.6, -.8], b1:[.05, .05], b2:[.05, .05] }, { ...E.app, num:null }); }
    else if(E.vol > 0){ const k = 1 - E.vol / .5; athlete(lerp(-.4, 1.4, k), lerp(.6, -.05, k), { hanche:0, torse:Math.PI / 2 - .3, j1:[Math.PI / 2 + .3, 0], j2:[Math.PI / 2 + .3, 0], b1:[Math.PI / 2, 0], b2:[Math.PI / 2, 0], rot:.4 * (1 - k) }, { ...E.app, num:null, coiffe:'bain' }); }
    else nageur(E.x, E.ph, E.app, 1, 1, E.resp > 0);
    if(E.plonge){ g.fillStyle = ge; g.fillRect(0, Y(0) + V.s * .05, W, Hh); }
    g.fillStyle = 'rgba(255,255,255,.35)';
    for(let x = -(V.cx * V.s) % 50 - 50; x < W + 50; x += 50){ const o = Math.sin(TEMPS * 3 + x * .05) * 3; g.beginPath(); g.ellipse(x + o, Y(0) + 2, 18, 3, 0, 0, 6.29); g.fill(); }
    // la ligne d'eau (bouées) et les repères tous les 10 m
    for(let x = 0; x <= E.dist; x += .5){ const sx = X(x); if(sx > -10 && sx < W + 10) boule(sx, Y(0) + V.s * .5, Math.max(3, V.s * .08), x < 5 || x > E.dist - 5 ? '#E8434F' : (x * 2) % 4 < 2 ? '#1F6FE0' : '#FFFFFF'); }
    reperes(10, E.dist - 10, 10, 0, 1.05);
    // la jauge d'air
    if(E.plonge){ const w = Math.min(200, W * .45), x = W / 2 - w / 2, y = HAUT + 6, rouge = E.air < .45;
      jauge(x, y, w, 16, E.air, rouge ? (Math.sin(TEMPS * 14) > 0 ? '#E8434F' : '#FF8A8A') : '#3BA7E8', null, rouge ? 'RESPIREZ !' : 'air');
      boule(x - 18, y + 8, 10, '#8FD3FF'); }
    info([virg(Math.max(0, E.t), 2) + ' s', virg(E.v, 2) + ' m/s']);
  },
  conseil(E){
    if(!E.plonge) return !E.parti ? conseilDepart(E) : { t:'PLONGEZ !', b:'a' };
    if(E.air < .45) return { t:'RESPIREZ ! (bouton rouge)', b:'a' };
    return { t:'Tapotez ◀ ▶ pour nager ; respirez quand la jauge d\'air est rouge', b:'gd' }; },
  demo(E){ if(!E.plonge) return { a:E.parti && E.t > .15 }; E._r = !E._r && E.air < .35; return { taps:tapDemo(10), a:E._r }; }
};
// un nageur en crawl, à plat sur l'eau, les bras qui moulinent
function nageur(x, ph, A, alpha = 1, taille = 1, respire = false){
  const P = { hanche:0, torse:Math.PI / 2 - .05, tete:respire ? -.9 : 0, j1:[Math.PI / 2 - .05 + Math.sin(ph * 2.3) * .18, 0], j2:[Math.PI / 2 - .05 - Math.sin(ph * 2.3) * .18, 0],
    b1:[Math.PI / 2 + ph % 6.283, Math.PI / 2 + ph % 6.283 + .3], b2:[Math.PI / 2 + (ph + Math.PI) % 6.283, Math.PI / 2 + (ph + Math.PI) % 6.283 + .3] };
  g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(X(x - 1), Y(0) + 2, V.s * .5 * taille, V.s * .08, 0, 0, 6.29); g.fill();
  athlete(x - .45, -.06, P, { ...A, num:null, coiffe:'bain', modele:'debardeur' }, alpha, taille);
}

// Tir à l'arc : 3 flèches ; ◀ ▶ visent, garder le doigt pour tendre l'arc, lâcher pour tirer ; la flèche bleue montre où le vent pousse
EP.arc = { n:'Tir à l\'arc', ico:'🏹', saison:'ete', unite:'pts', sens:1, essais:1, qual:19, ref:27, a:'TENDRE', lg:'VISER', bulle:76,
  aide:'◀ ▶ déplacent le viseur (le vent pousse la flèche : suivez la flèche bleue), gardez le doigt sur TENDRE et lâchez quand le viseur est calme sur le jaune.',
  tuto:['Trois flèches. Le viseur rouge montre où vous visez ; ◀ ▶ le déplacent.', 'Le vent pousse la flèche : le petit rond bleu montre où elle arrivera vraiment. Mettez le rond bleu sur le jaune.', 'GARDEZ le doigt sur TENDRE : l\'arc se tend et le viseur tremble moins. Lâchez quand il est calme. Pas trop longtemps : le bras fatigue et tremble.'],
  debut:ctx => ({ t:0, fl:[], ax:0, ay:0, tension:0, tenu:0, vent:hasard(-1, 1), score:0, phase:'vise', app:ctx.app }),
  maj(E, dt){
    E.t += dt;
    if(E.phase === 'attente'){ E.att -= dt; if(E.att <= 0){ if(E.fl.length >= 3){ finir(E, E.score, E.score + ' points'); } else { E.phase = 'vise'; E.vent = hasard(-1, 1); E.ax = 0; E.tension = 0; E.tenu = 0; } } return; }
    if(I.g) E.ax -= dt * .6; if(I.d) E.ax += dt * .6; E.ax = clamp(E.ax, -1.4, 1.4);
    if(I.a){ E.tension = Math.min(1, E.tension + dt * 1.1); E.tenu += dt; } else if(!I.aR) E.tension = Math.max(0, E.tension - dt * 2);
    const amp = (.6 - .36 * E.tension) + Math.max(0, E.tenu - 3.5) * .35;
    E.sx = Math.sin(E.t * 2.3) * amp * .55 + Math.sin(E.t * 5.1) * amp * .2; E.sy = Math.cos(E.t * 1.7) * amp * .5 + Math.sin(E.t * 4.3) * amp * .2;
    E.ay = Math.sin(E.t * .7) * .12;
    if(I.aR && E.tenu > .15){
      const x = E.ax + E.sx + E.vent * .6, y = E.ay + E.sy + (1 - E.tension) * .5, r = Math.hypot(x, y), pts = r < 1 ? 10 - Math.floor(r * 10) : 0;
      E.fl.push({ x, y, pts }); E.score += pts; E.phase = 'attente'; E.att = 1.4; annoncer(pts ? pts + (pts === 10 ? ' ! En plein cœur' : '') : 'Raté', '', 1); bip(pts >= 9 ? 1000 : 500, .1); E.tenu = 0;
    }
  },
  dessin(E){
    camera(0, 0, echelle());
    ciel('#7DB7E8', '#E3F1FA');
    const gh = g.createLinearGradient(0, Hh * .5, 0, Hh); gh.addColorStop(0, '#79B866'); gh.addColorStop(1, '#4C8A3E'); g.fillStyle = gh; g.fillRect(0, Hh * .52, W, Hh);
    // la cible, vue de face, sur son chevalet
    const R = Math.min(W, Hh) * .27, cx = W / 2, cy = Hh * .4;
    g.strokeStyle = '#8A6A3E'; g.lineWidth = 10; g.beginPath(); g.moveTo(cx - R * .8, cy + R * 1.6); g.lineTo(cx, cy - R * .2); g.lineTo(cx + R * .8, cy + R * 1.6); g.stroke();
    g.fillStyle = '#E9DFC7'; g.beginPath(); g.arc(cx, cy, R * 1.08, 0, 6.29); g.fill();
    const coul = ['#FFFFFF', '#FFFFFF', '#1C2433', '#1C2433', '#3BA7E8', '#3BA7E8', '#E8434F', '#E8434F', '#F2C230', '#F2C230'];
    for(let k = 0; k < 10; k++){ g.fillStyle = coul[k]; g.beginPath(); g.arc(cx, cy, R * (1 - k / 10), 0, 6.29); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.stroke(); }
    for(const f of E.fl){ g.fillStyle = '#1C2433'; g.beginPath(); g.arc(cx + f.x * R, cy + f.y * R, 5, 0, 6.29); g.fill(); g.strokeStyle = '#F2C230'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#E8434F'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + f.x * R, cy + f.y * R); g.lineTo(cx + f.x * R + 10, cy + f.y * R + 10); g.stroke(); }
    if(E.phase === 'vise'){ const vx = cx + (E.ax + E.sx) * R, vy = cy + (E.ay + E.sy + (1 - E.tension) * .5) * R;
      // là où la flèche arrivera (le vent la pousse)
      const ax = vx + E.vent * .6 * R; g.strokeStyle = 'rgba(31,111,224,.9)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(vx, vy); g.lineTo(ax, vy); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(31,111,224,.85)'; g.beginPath(); g.arc(ax, vy, 7, 0, 6.29); g.fill();
      g.strokeStyle = '#E8434F'; g.lineWidth = 3; g.beginPath(); g.arc(vx, vy, 16, 0, 6.29); g.moveTo(vx - 26, vy); g.lineTo(vx + 26, vy); g.moveTo(vx, vy - 26); g.lineTo(vx, vy + 26); g.stroke(); }
    // l'archer, de dos à gauche, qui tend l'arc
    const sAv = V.s; V.s = clamp(Hh * .09, 30, 70); const ax0 = (W * .08 - W * ANCRE()) / V.s + V.cx;
    const solA = (SOL() - Hh * .97) / V.s;
    athlete(ax0, solA, { ...DEBOUT, torse:-.05, b1:[1.57, 1.57 - E.tension * 1.4], b2:[1.6, 1.6] }, { ...E.app, num:null });
    V.s = sAv;
    // le vent et la tension
    g.fillStyle = 'rgba(28,36,51,.75)'; arrondi(cx - 90, HAUT, 180, 34, 12); g.fill(); g.fillStyle = '#fff'; g.font = '800 14px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center';
    g.fillText(`Vent ${E.vent < 0 ? '◀' : '▶'} ${Math.round(Math.abs(E.vent) * 20)} km/h`, cx, HAUT + 22); g.textAlign = 'left';
    jauge(cx - 80, HAUT + 44, 160, 10, E.tension, '#F2C230', null, 'tension');
    info([`${E.score} pts`, `Flèche ${Math.min(3, E.fl.length + 1)}/3`]);
  },
  conseil(E){
    if(E.phase !== 'vise') return null;
    if(Math.abs(E.ax + E.vent * .6) > .25 && E.tension < .3) return { t:E.ax + E.vent * .6 > 0 ? 'Visez à gauche (◀) : le rond bleu sur le jaune' : 'Visez à droite (▶) : le rond bleu sur le jaune', b:E.ax + E.vent * .6 > 0 ? 'g' : 'd' };
    if(E.tension < .95) return { t:'Gardez le doigt sur TENDRE', b:'aT' };
    return { t:'Lâchez quand le viseur est calme sur le jaune', b:'aL' }; },
  demo(E){ if(E.phase !== 'vise') return {}; const c = -E.vent * .6; return { g:E.ax > c + .03, d:E.ax < c - .03, a:Math.abs(E.ax - c) < .06 ? !(E.tension > .95 && E.tenu > 1.2 && Math.hypot(E.sx, E.sy) < .15) : false }; }
};
