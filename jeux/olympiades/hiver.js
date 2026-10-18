/* Olympiades : les 7 épreuves d'hiver (même organisation que epreuves.js). */
'use strict';

// une paire de skis (x, y en mètres : le milieu ; ang : la pente, en radians, + = vers le bas à droite)
function skis(x, y, ang, coul = '#D7263D', L = 1.9, ecart = 0){
  for(const k of [1, 0]){ g.save(); g.translate(X(x) + ecart * k * V.s, Y(y) + k * 2); g.rotate(ang);
    g.strokeStyle = k ? teinte(coul, -.35) : coul; g.lineWidth = Math.max(2.5, V.s * .06); g.lineCap = 'round';
    g.beginPath(); g.moveTo(-L * .45 * V.s, 0); g.lineTo(L * .5 * V.s, 0); g.quadraticCurveTo(L * .58 * V.s, 0, L * .6 * V.s, -V.s * .1); g.stroke(); g.restore(); }
}
const tenueHiver = (A, coiffe = 'casque') => ({ ...A, modele:'combi', coiffe, num:null, gants:'#1C2433' });

// Saut à ski : groupé (bouton tenu) sur la piste d'élan, lâcher au bord du tremplin, équilibre en vol (◀ ▶), appuyer pour la réception
const TREMPLIN = { L:90, a:deg(35), H:40 };
const colline = xx => { const H = TREMPLIN.H; return xx < 0 ? 0 : xx < 160 ? H - 3 - (H - 3) * Math.min(1, (xx / 140) ** 1.25) : 0; };
EP.sautski = { n:'Saut à ski', ico:'🎿', saison:'hiver', unite:'pts', sens:1, essais:2, somme:true, qual:200, ref:290, a:'IMPULSION', lg:'ÉQUILIBRE',
  aide:'Gardez le doigt sur IMPULSION sur la piste d\'élan, lâchez dans la zone verte au bord du tremplin, gardez la bille au centre avec ◀ ▶, puis appuyez pour la réception.',
  tuto:['Sur la piste d\'élan, GARDEZ le doigt sur IMPULSION : le sauteur se met en boule et prend de la vitesse.', 'Lâchez dans la zone verte, juste au bord du tremplin : c\'est l\'impulsion. Trop tôt ou trop tard, le saut est court.', 'En vol, gardez la bille jaune au centre avec ◀ ▶. Quand « RÉCEPTION » s\'affiche, appuyez sur le bouton rouge pour le télémark. Deux sauts : les points s\'additionnent.'],
  debut:ctx => ({ s:0, v:0, t:0, phase:'elan', e:0, ve:0, qf:0, n:0, app:ctx.app }),
  maj(E, dt){
    const L = TREMPLIN.L;
    if(E.phase === 'elan'){ E.t += dt; const k = I.a ? .0042 : .0078; E.v += (9.8 * Math.sin(TREMPLIN.a) - k * E.v * E.v) * dt; E.s += E.v * dt;
      if((I.aR && E.s > 8) || E.s >= L){ const avant = L - E.s; E.qt = E.s >= L ? .25 : clamp(1 - Math.abs(avant - 1.2) / 4, 0, 1); E.phase = 'vol'; E.vt = 0; E.e = hasard(-.2, .2); bip(600, .08);
        E.dur = 3.4 + 1.6 * E.qt; annoncer(E.qt > .8 ? 'Belle impulsion !' : E.qt > .4 ? 'Impulsion moyenne' : 'Impulsion ratée', '', .8); } }
    else if(E.phase === 'vol'){ E.vt += dt;
      E.ve += (hasard(-1, 1) * 1.6 + E.e * 1.4) * dt; if(I.g) E.ve -= 2.6 * dt; if(I.d) E.ve += 2.6 * dt; E.ve *= 1 - dt * .8; E.e += E.ve * dt;
      E.qf += (1 - Math.min(1, Math.abs(E.e))) * dt; E.n += dt;
      if(Math.abs(E.e) > 1){ E.d = 70 + 70 * (E.v / 25.5) ** 2 * E.qt * (E.qf / E.n) * (E.vt / E.dur); finSautSki(E, false); return; }
      if(I.aP){ const tot = E.vt >= E.dur - .7; E.d = 70 + 72 * (E.v / 25.5) ** 2 * Math.sqrt(E.qt) * (E.qf / E.n) * (tot ? 1 : E.vt / E.dur); finSautSki(E, tot); return; }
      if(E.vt >= E.dur){ E.d = 70 + 72 * (E.v / 25.5) ** 2 * Math.sqrt(E.qt) * (E.qf / E.n); finSautSki(E, false); } }
    else if(E.phase === 'fin'){ E.vt += dt; }
  },
  dessin(E){
    const { L, a, H } = TREMPLIN, A = tenueHiver(E.app);
    let x, y, P;
    if(E.phase === 'elan'){ x = -(L - E.s) * Math.cos(a); y = H + (L - E.s) * Math.sin(a);
      P = I.a ? { hanche:.5, torse:1.25, tete:-.6, j1:[1.3, -.5], j2:[1.25, -.55], b1:[-.5, -.3], b2:[-.5, -.3] } : { hanche:.82, torse:.4, j1:[.3, -.2], j2:[.25, -.25], b1:[-.3, 0], b2:[-.3, 0] }; }
    else { const dd = E.d || 70 + 72 * (E.v / 25.5) ** 2 * Math.sqrt(E.qt) * ((E.qf / Math.max(.01, E.n)) || .5), k = E.phase === 'vol' ? clamp(E.vt / E.dur, 0, 1) : 1;
      x = dd * k; y = Math.max(colline(x), H + 2 * Math.sin(k * Math.PI) * 3 - (H - colline(dd)) * Math.pow(k, 1.7));
      if(E.phase !== 'vol') y = colline(x);
      // en vol : le corps penché très en avant, les jambes vers l'arrière, les bras le long du corps
      P = E.phase === 'vol' ? { hanche:.9, torse:1.2 + E.e * .35, tete:-.5, j1:[-1 + E.e * .2, -1 + E.e * .2], j2:[-.95 + E.e * .2, -.95 + E.e * .2], b1:[-1.4, -1.4], b2:[-1.35, -1.35] }
        : E.chute ? { hanche:.3, torse:1.9, j1:[2.4, 1.5], j2:[.6, -.6], b1:[2.8, 3], b2:[-1, -1.2], rot:.6 } : { hanche:.75, torse:.3, j1:[.6, -.3], j2:[-.4, -.6], b1:[2, 2.2], b2:[-1.6, -1.8] }; }
    { // sur la piste d'élan : on suit le sauteur ; en vol : on garde à l'écran le sauteur et la neige en dessous
      const s0 = echelle() * .8;
      if(E.phase === 'elan') camera(x + avance(4, s0), y - 2, s0);
      else { const cy = Math.min(y - 1, colline(x + 8) - 1), s = Math.max(10, Math.min(s0, (SOL() - HAUT - 110) / Math.max(1, y - cy))); camera(x + avance(2, s), cy, s); } }
    ciel('#5D9FDB', '#DCEBF7'); montagnes(); sapins(.4);
    // la tour et la piste d'élan
    g.strokeStyle = '#6B7A90'; g.lineWidth = Math.max(2, V.s * .08);
    for(let k = 10; k < L; k += 14){ const px = -k * Math.cos(a), py = H + k * Math.sin(a); g.beginPath(); g.moveTo(X(px), Y(py - 1)); g.lineTo(X(px), Y(-30)); g.stroke(); }
    g.lineWidth = Math.max(1, V.s * .03); g.beginPath(); for(let k = 10; k < L - 14; k += 14){ const p1 = [-k * Math.cos(a), H + k * Math.sin(a)], p2 = [-(k + 14) * Math.cos(a), H + (k + 14) * Math.sin(a)]; g.moveTo(X(p1[0]), Y(p1[1] - 6)); g.lineTo(X(p2[0]), Y(p2[1] - 1)); } g.stroke();
    g.fillStyle = '#F7FAFE'; g.beginPath(); g.moveTo(X(-L * Math.cos(a) - 5), Y(H + L * Math.sin(a))); g.lineTo(X(0), Y(H)); g.lineTo(X(0), Y(H - 1.5)); g.lineTo(X(-L * Math.cos(a) - 5), Y(H + L * Math.sin(a) - 2)); g.fill();
    g.strokeStyle = '#8796AD'; g.lineWidth = 2; g.stroke();
    // la zone où lâcher (au bord du tremplin)
    if(E.phase === 'elan'){ const p1 = [-3.2 * Math.cos(a), H + 3.2 * Math.sin(a)]; g.strokeStyle = 'rgba(46,200,100,.9)'; g.lineWidth = Math.max(4, V.s * .15); g.beginPath(); g.moveTo(X(p1[0]), Y(p1[1]) - 2); g.lineTo(X(0), Y(H) - 2); g.stroke(); }
    // la réception : la colline, les lignes de distance (K 120 en rouge), le public en bas
    g.beginPath(); g.moveTo(X(0), Y(H - 2)); for(let xx = 0; xx <= 230; xx += 4) g.lineTo(X(xx), Y(colline(xx))); g.lineTo(X(230), Hh + 10); g.lineTo(X(0), Hh + 10); g.closePath();
    const gc = g.createLinearGradient(0, Y(H), 0, Y(0)); gc.addColorStop(0, '#FFFFFF'); gc.addColorStop(1, '#DCE8F5'); g.fillStyle = gc; g.fill();
    g.strokeStyle = '#9FB3CC'; g.lineWidth = 3; g.beginPath(); for(let xx = 0; xx <= 230; xx += 4) g.lineTo(X(xx), Y(colline(xx))); g.stroke();
    for(let m = 60; m <= 160; m += 5){ g.strokeStyle = m === 120 ? 'rgba(215,38,61,.8)' : m % 10 ? 'rgba(31,111,224,.2)' : 'rgba(31,111,224,.45)'; g.lineWidth = m === 120 ? 4 : 2; g.beginPath(); g.moveTo(X(m), Y(colline(m))); g.lineTo(X(m), Y(colline(m)) + 16); g.stroke(); }
    for(const m of [80, 100, 120, 140]){ g.fillStyle = m === 120 ? '#D7263D' : '#1F6FE0'; g.font = '800 13px "Bricolage Grotesque", sans-serif'; g.fillText(m === 120 ? 'K 120' : m + ' m', X(m) - 14, Y(colline(m)) + 30); }
    if(E.d && E.phase === 'fin'){ g.fillStyle = '#F2C230'; g.fillRect(X(E.d) - 2, Y(colline(E.d)) - V.s * 1.5, 4, V.s * 1.5); }
    // les skis, puis le sauteur
    const pied = E.phase === 'vol' ? [-.75, .38] : [0, 0];
    const angS = E.phase === 'elan' ? a : E.phase === 'vol' ? -.3 + E.e * .25 : .5;
    if(E.phase === 'vol'){ skis(x + pied[0], y + pied[1], angS - .12, A.c2 && A.c2 !== '#ffffff' ? A.c2 : '#D7263D', 2.4); }
    else skis(x, y, angS, '#D7263D', 2.4);
    if(E.phase === 'vol') ombre(x, colline(x), y - colline(x), 1.2);
    athlete(x, y, P, A);
    if(E.phase === 'vol'){
      const w = Math.min(220, W * .55); g.fillStyle = 'rgba(28,36,51,.7)'; arrondi(W / 2 - w / 2, HAUT + 4, w, 22, 11); g.fill(); g.fillStyle = 'rgba(46,200,100,.8)'; g.fillRect(W / 2 - w * .14, HAUT + 4, w * .28, 22);
      boule(W / 2 + clamp(E.e, -1, 1) * (w / 2 - 10), HAUT + 15, 9, '#F2C230');
      g.fillStyle = '#fff'; g.font = '800 12px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center'; g.fillText('équilibre : bille au centre', W / 2, HAUT + 42);
      if(E.vt > E.dur - .8){ g.font = '400 34px "Bebas Neue", sans-serif'; g.fillStyle = '#F2C230'; g.fillText('RÉCEPTION !', W / 2, HAUT + 78); } g.textAlign = 'left'; }
    info([E.phase === 'elan' ? Math.round(E.v * 3.6) + ' km/h' : E.d ? virg(E.d, 1) + ' m' : Math.round(E.v * 3.6) + ' km/h']);
  },
  conseil(E){
    if(E.phase === 'elan'){ if(E.s > TREMPLIN.L - 3.2) return { t:'LÂCHEZ ! (impulsion)', b:'aL' }; return { t:I.a ? 'Gardez le doigt (position groupée)… lâchez dans la zone verte' : 'Gardez le doigt sur IMPULSION pour aller plus vite', b:'aT' }; }
    if(E.phase === 'vol'){ if(E.vt > E.dur - .8) return { t:'RÉCEPTION ! Appuyez (télémark)', b:'a' }; return { t:E.e > .25 ? 'La bille part à droite : appuyez sur ◀' : E.e < -.25 ? 'La bille part à gauche : appuyez sur ▶' : 'Gardez la bille au centre avec ◀ ▶', b:E.e > .25 ? 'g' : E.e < -.25 ? 'd' : 'gd' }; }
    return null; },
  demo(E){ if(E.phase === 'elan') return { a:E.s < TREMPLIN.L - 1.2 }; if(E.phase === 'vol') return { g:E.e > .08, d:E.e < -.08, a:E.vt > E.dur - .4 }; return {}; }
};
function finSautSki(E, telemark){
  E.chute = !telemark;
  const style = telemark ? 38 + 18 * (E.qf / Math.max(.01, E.n)) : 18;
  E.style = style; E.phase = 'fin'; E.vt = 0;
  E.res = Math.max(0, Math.round((60 + 1.8 * (E.d - 120) + style) * 10) / 10);
  E.fini = true; annoncer(virg(E.d, 1) + ' m', `${telemark ? 'Télémark' : 'Chute'} · ${virg(E.res, 1)} points`, 1.6); bip(telemark ? 900 : 150, .2);
}

// Descente : groupé (bouton tenu) dans les lignes droites, se relever avant les bosses et dans les virages
const DESCENTE = { L:650, bosses:[120, 230, 330, 470, 560], virages:[[175, 205], [290, 315], [400, 440], [520, 545]] };
const danger = x => DESCENTE.bosses.some(b => b - x < 22 && b - x > -1) || DESCENTE.virages.some(([a, b]) => x > a - 22 && x < b);
EP.descente = { n:'Descente', ico:'⛷️', saison:'hiver', unite:'s', sens:-1, essais:1, qual:30.3, ref:28.5, a:'GROUPÉ', lg:'POUSSER',
  aide:'Tapotez ◀ ▶ au départ, puis gardez le doigt sur GROUPÉ pour aller vite ; relâchez avant les BOSSES et dans les VIRAGES.',
  tuto:['Au départ, tapotez ◀ ▶ : le skieur pousse sur ses bâtons.', 'Ensuite, GARDEZ le doigt sur GROUPÉ (position de l\'œuf) : c\'est beaucoup plus rapide.', 'Mais avant une BOSSE (panneau orange) et dans un VIRAGE (zone rouge), lâchez le bouton pour vous relever : sinon vous décollez trop ou vous perdez la moitié de votre vitesse.'],
  debut:ctx => ({ x:0, v:0, t:0, z:0, vz:0, air:false, vus:new Set(), app:ctx.app }),
  maj(E, dt){
    const D = DESCENTE; E.t += dt;
    if(E.x < 18) elan(E, dt, 9, 1.2, .1);
    const k = I.a && !E.air ? .0028 : .0062;
    if(!E.air) E.v += (9.8 * .33 - .25 - k * E.v * E.v) * dt; else E.v -= .012 * E.v * E.v * dt;
    const x0 = E.x; E.x += E.v * dt;
    for(const b of D.bosses) if(x0 < b && E.x >= b && !E.air && I.a){ E.air = true; E.vz = 3 + E.v * .12; E.z = 0; annoncer('Décollage !', '', .6); }
    if(E.air){ E.vz -= 9.8 * dt; E.z += E.vz * dt; if(E.z <= 0){ E.air = false; E.z = 0; if(E.vz < -9){ E.v *= .7; annoncer('Réception lourde', '', .6); } } }
    D.virages.forEach(([a, b], i) => { if(E.x > a && E.x < b && I.a && !E.vus.has(i)){ E.vus.add(i); E.v *= .55; annoncer('Trop vite dans le virage !', '', .9); bip(150, .25, .1, 'sawtooth'); } });
    if(E.x >= D.L){ const r = E.t - (E.x - D.L) / Math.max(1, E.v); finir(E, r, virg(r, 2) + ' s'); }
  },
  dessin(E){ dessinPente(E, 'descente'); },
  conseil(E){ if(E.x < 18) return { t:'Tapotez ◀ ▶ pour pousser sur les bâtons', b:'gd' };
    if(danger(E.x)) return { t:DESCENTE.virages.some(([a, b]) => E.x > a - 22 && E.x < b) ? 'VIRAGE : lâchez GROUPÉ !' : 'BOSSE : lâchez GROUPÉ !', b:I.a ? 'aL' : null };
    return { t:'Gardez le doigt sur GROUPÉ pour aller plus vite', b:'aT' }; },
  demo(E){ if(E.x < 18) return { taps:tapDemo(10) }; return { a:!(DESCENTE.bosses.some(b => b - E.x < 5 && b - E.x > -2) || DESCENTE.virages.some(([a, b]) => E.x > a - 4 && E.x < b)) }; }
};
// Slalom : les portes rouges avec ◀, les bleues avec ▶, au moment de passer la porte
const SLALOM = { L:420, portes:Array.from({ length:30 }, (_, k) => ({ x:40 + k * 12.4, c:k % 2 ? 'd' : 'g' })) };
EP.slalom = { n:'Slalom', ico:'🚩', saison:'hiver', unite:'s', sens:-1, essais:1, qual:36.5, ref:32.9, a:'—', lg:'PORTE',
  aide:'Tapotez ◀ ▶ au départ ; puis ◀ pour chaque porte ROUGE et ▶ pour chaque porte BLEUE, au moment où vous la passez.',
  tuto:['Au départ, tapotez ◀ ▶ pour vous élancer.', 'Ensuite, à chaque porte : ◀ pour une porte ROUGE, ▶ pour une porte BLEUE.', 'Appuyez au moment où vous passez la porte (quand le trait vert s\'allume sous elle). Une porte manquée ou le mauvais bouton : 3 secondes de pénalité.'],
  debut:ctx => ({ x:0, v:0, t:0, i:0, pen:0, ok:[], app:ctx.app }),
  maj(E, dt){
    E.t += dt;
    if(E.x < 30) elan(E, dt, 8, 1.2, .1);
    E.v += (9.8 * .2 - .1 - .0105 * E.v * E.v) * dt;
    E.x += E.v * dt; const P = SLALOM.portes[E.i];
    if(P){
      const press = I.gP ? 'g' : I.dP ? 'd' : null;
      if(press && E.x > P.x - 2.4){ if(press === P.c){ E.ok[E.i] = true; E.v *= 1.02; bip(900, .05, .05); } else { E.ok[E.i] = false; E.pen += 3; E.v *= .85; annoncer('Mauvaise porte', '+3 s', .6); bip(160, .2, .1, 'sawtooth'); } E.i++; E.vire = press === 'g' ? -1 : 1; }
      else if(E.x > P.x + .8){ E.ok[E.i] = false; E.pen += 3; E.v *= .85; annoncer('Porte manquée', '+3 s', .6); bip(160, .2, .1, 'sawtooth'); E.i++; }
    }
    E.vire = (E.vire || 0) * (1 - dt * 3);
    if(E.x >= SLALOM.L){ const r = E.t - (E.x - SLALOM.L) / Math.max(1, E.v) + E.pen; finir(E, r, virg(r, 2) + ' s', E.pen ? `dont ${E.pen} s de pénalités` : 'sans faute'); }
  },
  dessin(E){ dessinPente(E, 'slalom'); },
  conseil(E){ const P = SLALOM.portes[E.i]; if(!P) return { t:'Jusqu\'à l\'arrivée !', b:null };
    if(E.x < 28) return { t:'Tapotez ◀ ▶ pour vous élancer', b:'gd' };
    const rouge = P.c === 'g', ok = E.x > P.x - 2.4;
    return { t:`${ok ? 'MAINTENANT : ' : 'Prochaine porte '}${rouge ? 'ROUGE → ◀' : 'BLEUE → ▶'}`, b:ok ? P.c : null }; },
  demo(E){ if(E.x < 34 && E.i === 0) return { taps:tapDemo(10) }; const P = SLALOM.portes[E.i]; if(!P) return {}; if(P.x - E.x < 1) return P.c === 'g' ? { gP:true, g:true } : { dP:true, d:true }; return {}; }
};
function dessinPente(E, type){
  const pente = type === 'descente' ? .33 : .2, sol = x => -x * pente + (type === 'descente' ? Math.sin(x / 9) * .4 : 0);
  const yS = sol(E.x) + (E.z || 0), A = tenueHiver(E.app);
  { const s = echelle() * .85, a = avance(3, s); camera(E.x + a, sol(E.x + a), s); }
  ciel('#5D9FDB', '#DCEBF7'); montagnes(); sapins();
  neige(sol);
  const panneau = (x, txt, coul) => { const sx = X(x), sy = Y(sol(x)); if(sx < -60 || sx > W + 60) return; g.fillStyle = '#5C6678'; g.fillRect(sx - 2, sy - V.s * 1.8, 4, V.s * 1.8); g.fillStyle = coul; arrondi(sx - 44, sy - V.s * 2.5, 88, V.s * .7, 6); g.fill(); g.fillStyle = '#fff'; g.font = `800 ${clamp(V.s * .3, 10, 15)}px "Bricolage Grotesque", sans-serif`; g.textAlign = 'center'; g.fillText(txt, sx, sy - V.s * 2.05); g.textAlign = 'left'; };
  if(type === 'descente'){
    for(const b of DESCENTE.bosses){ const sx = X(b), sy = Y(sol(b)); g.fillStyle = '#E8F0FA'; g.beginPath(); g.ellipse(sx, sy, V.s * 1.6, V.s * .5, 0, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(120,150,190,.5)'; g.lineWidth = 2; g.stroke(); panneau(b - 22, 'BOSSE ▲', '#F28C30'); }
    for(const [a, b] of DESCENTE.virages){ panneau(a - 20, 'VIRAGE ⚠', '#D7263D'); g.strokeStyle = 'rgba(215,38,61,.45)'; g.lineWidth = Math.max(4, V.s * .15); g.beginPath(); for(let x = a; x <= b; x += 2) g.lineTo(X(x), Y(sol(x)) + 4); g.stroke();
      // les filets de protection
      g.strokeStyle = 'rgba(215,38,61,.6)'; g.lineWidth = 2; for(let x = a; x <= b; x += 3){ g.beginPath(); g.moveTo(X(x), Y(sol(x)) - V.s * .3); g.lineTo(X(x), Y(sol(x)) - V.s * 1.1); g.stroke(); } }
  } else {
    SLALOM.portes.forEach((p, i) => { const sx = X(p.x), sy = Y(sol(p.x)); if(sx < -40 || sx > W + 40) return; const c = p.c === 'g' ? '#D7263D' : '#1F6FE0';
      g.fillStyle = c; g.fillRect(sx - 2, sy - V.s * 1.8, 4, V.s * 1.8); g.beginPath(); g.moveTo(sx + 2, sy - V.s * 1.8); g.lineTo(sx + V.s * .9, sy - V.s * 1.55); g.lineTo(sx + 2, sy - V.s * 1.25); g.fill();
      if(i === E.i){ g.fillStyle = 'rgba(46,200,100,.7)'; g.fillRect(sx - 2.4 * V.s, sy + 4, 3.2 * V.s, 5);
        g.fillStyle = '#fff'; g.font = '400 30px "Bebas Neue", sans-serif'; g.textAlign = 'center'; g.fillText(p.c === 'g' ? '◀' : '▶', sx, sy - V.s * 2.1); g.textAlign = 'left'; }
      if(E.ok[i] !== undefined){ g.fillStyle = E.ok[i] ? '#2E9E5B' : '#D7263D'; g.font = '800 16px sans-serif'; g.fillText(E.ok[i] ? '✓' : '✕', sx - 5, sy + 22); } });
  }
  const L = type === 'descente' ? DESCENTE.L : SLALOM.L;
  g.fillStyle = '#D7263D'; g.fillRect(X(L) - 3, Y(sol(L)) - V.s * 3, 6, V.s * 3); g.fillRect(X(L) + V.s * 3, Y(sol(L)) - V.s * 3, 6, V.s * 3); g.fillRect(X(L) - 3, Y(sol(L)) - V.s * 3, V.s * 3 + 9, V.s * .5);
  const tuck = type === 'descente' && I.a && !E.air && E.x >= 18;
  const vire = E.vire || 0;
  const P = tuck ? { hanche:.55, torse:1.25, tete:-.7, j1:[1.4, -.3], j2:[1.3, -.4], b1:[1.6, 1.9], b2:[1.5, 1.8] }
    : E.x < 18 && type === 'descente' || (type === 'slalom' && E.x < 30) ? { hanche:.75, torse:.7, j1:[.7, -.3], j2:[.5, -.4], b1:[.8 + Math.sin(E.t * 9) * .6, 1.2], b2:[.7 - Math.sin(E.t * 9) * .6, 1.1] }
    : { hanche:.78 - Math.abs(vire) * .1, torse:.55, tete:-.3, j1:[.7 + vire * .2, -.25], j2:[.55 + vire * .2, -.35], b1:[.6, 1.1], b2:[.5, 1] };
  const ang = Math.atan(pente) + (type === 'descente' ? Math.cos(E.x / 9) * .4 / 9 : 0);
  ombre(E.x, sol(E.x), E.z || 0, 1.4);
  skis(E.x, yS, ang, '#1F6FE0', 2);
  const main = athlete(E.x, yS, P, A);
  // les bâtons
  if(main){ const mx = X(E.x) + main[0], my = Y(yS + P.hanche) + main[1]; g.strokeStyle = '#2B2F36'; g.lineWidth = Math.max(1.5, V.s * .03); g.beginPath(); g.moveTo(mx, my); g.lineTo(mx - V.s * (tuck ? 1 : .5), my + V.s * (tuck ? .2 : .9)); g.stroke(); }
  info([virg(E.t + (E.pen || 0), 2) + ' s', Math.round(E.v * 3.6) + ' km/h']);
}

// Bobsleigh et luge : pousser en tapotant, monter (bouton rouge), puis garder la bille au milieu dans les virages (◀ ▶)
function piste_bob(n, seed){ const R = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(seed), v = []; let x = 120; for(let k = 0; k < n; k++){ const l = 50 + R() * 60; v.push({ a:x, b:x + l, k:(R() < .5 ? -1 : 1) * (.5 + R() * .5) }); x += l + 40 + R() * 50; } return v; }
const BOB = { L:1050, virages:piste_bob(9, 7) }, LUGE = { L:900, virages:piste_bob(10, 31) };
function debutGlisse(ctx, luge){ return { x:0, v:0, t:0, phase:'pousse', y:0, vy:0, luge, choc:0, chocs:0, app:ctx.app }; }
const limiteMonter = luge => luge ? 4 : 25;
function majGlisse(E, dt, T){
  E.t += dt;
  if(E.phase === 'pousse'){
    elan(E, dt, E.luge ? 7 : 11.5, E.luge ? 1.3 : 2, .4); E.x += E.v * dt;
    const fin = E.luge ? 12 : 55;
    if((I.aP && E.x > limiteMonter(E.luge)) || E.x > fin){ E.phase = 'glisse'; if(E.x > fin) E.v *= .9; bip(500, .08); annoncer(E.luge ? 'Allongé !' : 'Dans le bob !', '', .6); }
    return;
  }
  // la pente pousse, l'air freine ; dans un virage, le bob part vers l'extérieur
  E.v += (9.8 * .085 - .00062 * E.v * E.v) * dt;
  const vir = T.virages.find(c => E.x > c.a && E.x < c.b), k = vir ? vir.k : 0;
  E.vy += (k * E.v * E.v * (E.luge ? .0034 : .0028) - E.vy * 1.6 + (I.d ? 2.4 : 0) - (I.g ? 2.4 : 0)) * dt * (E.luge ? 1.25 : 1);
  E.y += E.vy * dt;
  if(Math.abs(E.y) > 1){ E.y = Math.sign(E.y); E.vy *= -.3; if(E.choc <= 0){ E.v *= .96; E.choc = .3; E.chocs++; bip(140, .1, .08, 'sawtooth'); } }
  E.choc -= dt;
  E.x += E.v * dt;
  if(E.x >= T.L){ const r = E.t - (E.x - T.L) / Math.max(1, E.v); finir(E, r, virg(r, 2) + ' s', E.chocs ? `${E.chocs} choc${E.chocs > 1 ? 's' : ''} contre le mur` : 'trajectoire parfaite'); }
}
function dessinGlisse(E, T){
  const pente = .085, sol = x => -x * pente, A = tenueHiver(E.app);
  { const s = echelle() * .95, a = avance(3, s); camera(E.x + a, sol(E.x + a), s); }
  ciel('#5D9FDB', '#DCEBF7'); montagnes(); sapins();
  neige(x => sol(x) - 1.2);
  // la piste de glace : le canal, son mur (plus haut et plus sombre dans les virages)
  const vir = T.virages.find(c => E.x > c.a - 30 && E.x < c.b);
  g.beginPath(); for(let px = -10; px <= W + 10; px += 10){ const x = V.cx + (px - W * ANCRE()) / V.s; g.lineTo(px, Y(sol(x)) + V.s * .1); }
  for(let px = W + 10; px >= -10; px -= 10){ const x = V.cx + (px - W * ANCRE()) / V.s, c = T.virages.find(v => x > v.a && x < v.b); g.lineTo(px, Y(sol(x)) - V.s * (c ? 1.6 : 1)); }
  const gl = g.createLinearGradient(0, Y(sol(V.cx)) - V.s * 1.5, 0, Y(sol(V.cx))); gl.addColorStop(0, '#E9F6FF'); gl.addColorStop(1, '#A9D3F0'); g.fillStyle = gl; g.fill();
  g.strokeStyle = '#7FB0D6'; g.lineWidth = 3; g.stroke();
  for(const c of T.virages){ const sx = X(c.a - 25); if(sx > -100 && sx < W + 100){ g.fillStyle = '#D7263D'; arrondi(sx - 4, Y(sol(c.a - 25)) - V.s * 2.2, 96, 24, 8); g.fill(); g.fillStyle = '#fff'; g.font = '800 13px "Bricolage Grotesque", sans-serif'; g.fillText(c.k < 0 ? '◀ VIRAGE' : 'VIRAGE ▶', sx + 6, Y(sol(c.a - 25)) - V.s * 2.2 + 17); } }
  g.fillStyle = '#D7263D'; g.fillRect(X(T.L) - 3, Y(sol(T.L)) - V.s * 3, 6, V.s * 3);
  if(E.phase === 'pousse'){ g.fillStyle = 'rgba(46,200,100,.55)'; const a = limiteMonter(E.luge), b = E.luge ? 12 : 55; g.beginPath(); g.moveTo(X(a), Y(sol(a))); g.lineTo(X(b), Y(sol(b))); g.lineWidth = Math.max(4, V.s * .14); g.strokeStyle = 'rgba(46,200,100,.75)'; g.stroke(); }
  // le bob (ou la luge) et son équipage
  const sx = X(E.x), sy = Y(sol(E.x)), ang = Math.atan(pente);
  if(E.luge){
    g.save(); g.translate(sx, sy); g.rotate(ang); g.fillStyle = '#1C2433'; arrondi(-V.s * .6, -V.s * .22, V.s * 1.3, V.s * .14, 4); g.fill(); g.fillStyle = '#9AA3AF'; g.fillRect(-V.s * .7, -V.s * .06, V.s * 1.5, V.s * .05); g.restore();
    if(E.phase === 'pousse') athlete(E.x + .1, sol(E.x) + .2, { hanche:.3, torse:-.25, j1:[1.5, 1.5], j2:[1.45, 1.45], b1:[1.4 + Math.sin(E.t * 12) * .8, 1.6], b2:[1.2 - Math.sin(E.t * 12) * .8, 1.4] }, A);
    else athlete(E.x - .15, sol(E.x) + .3, { hanche:0, torse:-1.45, tete:.9, j1:[1.5, 1.55], j2:[1.52, 1.56], b1:[0, .1], b2:[.1, .1], rot:-ang }, A);
  } else {
    if(E.phase === 'pousse') for(const d of [-1.7, -2.6]) athlete(E.x + d, sol(E.x + d), course(E.x * 1.2 + d, E.v, { torse:1, tete:-.6, b1:[1.5, 1.6], b2:[1.4, 1.5] }), A);
    else for(const d of [.75, .25, -.25, -.75]) athlete(E.x + d, sol(E.x + d) + .25, { hanche:.25, torse:.35, j1:[1.5, 0], j2:[1.4, 0], b1:[1.2, 1.5], b2:[1.1, 1.4] }, A);
    g.save(); g.translate(sx, sy); g.rotate(ang);
    const gb = g.createLinearGradient(0, -V.s * .8, 0, 0); gb.addColorStop(0, teinte(A.c1, .3)); gb.addColorStop(1, teinte(A.c1, -.25));
    g.fillStyle = gb; g.beginPath(); g.moveTo(-V.s * 1.4, -V.s * .1); g.lineTo(V.s * 1.1, -V.s * .1); g.quadraticCurveTo(V.s * 1.7, -V.s * .2, V.s * 1.35, -V.s * .65); g.lineTo(-V.s * 1.3, -V.s * .62); g.closePath(); g.fill();
    if(A.c2){ g.fillStyle = A.c2; g.fillRect(-V.s * 1.3, -V.s * .42, V.s * 2.5, V.s * .1); }
    g.fillStyle = '#2B2F36'; g.fillRect(-V.s * 1.4, -V.s * .1, V.s * 2.6, V.s * .08); g.restore();
  }
  // en haut : la position dans la largeur de la piste (la bille), à garder au milieu
  if(E.phase === 'glisse'){ const w = Math.min(230, W * .58);
    g.fillStyle = 'rgba(28,36,51,.7)'; arrondi(W / 2 - w / 2, HAUT + 4, w, 26, 13); g.fill(); g.fillStyle = 'rgba(46,200,100,.75)'; g.fillRect(W / 2 - w * .2, HAUT + 4, w * .4, 26);
    g.fillStyle = 'rgba(215,38,61,.8)'; g.fillRect(W / 2 - w / 2 + 6, HAUT + 4, 6, 26); g.fillRect(W / 2 + w / 2 - 12, HAUT + 4, 6, 26);
    boule(W / 2 + E.y * (w / 2 - 14), HAUT + 17, 10, '#F2C230');
    g.fillStyle = '#fff'; g.font = '800 12px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center'; g.fillText('mur gauche · milieu · mur droit', W / 2, HAUT + 46); g.textAlign = 'left'; }
  info([virg(E.t, 2) + ' s', Math.round(E.v * 3.6) + ' km/h']);
}
function conseilGlisse(E, T){
  if(E.phase === 'pousse') return E.x > limiteMonter(E.luge) ? { t:E.luge ? 'ALLONGEZ-VOUS ! (bouton rouge)' : 'MONTEZ ! (bouton rouge)', b:'a' } : { t:'Tapotez ◀ ▶ pour pousser', b:'gd' };
  if(E.y > .2) return { t:'La bille part à droite : tenez ◀', b:'g' };
  if(E.y < -.2) return { t:'La bille part à gauche : tenez ▶', b:'d' };
  const vir = T.virages.find(c => E.x > c.a - 30 && E.x < c.b);
  return { t:vir ? `Virage à ${vir.k > 0 ? 'droite' : 'gauche'} : préparez ${vir.k > 0 ? '◀' : '▶'}` : 'Gardez la bille dans le vert', b:null };
}
const demoGlisse = (E, luge) => { if(E.phase === 'pousse') return E.x > (luge ? 6 : 26) ? { a:true } : { taps:tapDemo(10) }; const yy = E.y + E.vy * .25; return { g:yy > .08, d:yy < -.08 }; };
EP.bob = { n:'Bobsleigh', ico:'🛷', saison:'hiver', unite:'s', sens:-1, essais:1, qual:51, ref:47.8, a:'MONTER', lg:'DIRIGER',
  aide:'Tapotez ◀ ▶ pour pousser, MONTER dans la zone verte, puis tenez ◀ ou ▶ pour garder la bille au milieu dans les virages.',
  tuto:['Tapotez ◀ ▶ : l\'équipage pousse le bob.', 'Dans la zone verte (après 25 m), appuyez sur MONTER : tout le monde saute dans le bob.', 'Dans la descente, la bille en haut montre où est le bob dans la largeur de la piste. Les virages la poussent vers un mur : tenez ◀ si elle part à droite, ▶ si elle part à gauche. Chaque choc contre le mur ralentit.'],
  debut:ctx => debutGlisse(ctx, false), maj:(E, dt) => majGlisse(E, dt, BOB), dessin:E => dessinGlisse(E, BOB), conseil:E => conseilGlisse(E, BOB), demo:E => demoGlisse(E, false) };
EP.luge = { n:'Luge', ico:'🛷', saison:'hiver', unite:'s', sens:-1, essais:1, qual:49.5, ref:45.6, a:'ALLONGÉ', lg:'DIRIGER',
  aide:'Tapotez ◀ ▶ pour vous élancer, ALLONGÉ dans la zone verte, puis tenez ◀ ou ▶ pour garder la bille au milieu.',
  tuto:['Tapotez ◀ ▶ : le lugeur tire sur les poignées et pousse avec les mains.', 'Dans la zone verte, appuyez sur ALLONGÉ : il se couche sur la luge.', 'Comme pour le bob, gardez la bille au milieu avec ◀ ▶ (la luge est plus nerveuse : corrigez plus tôt).'],
  debut:ctx => debutGlisse(ctx, true), maj:(E, dt) => majGlisse(E, dt, LUGE), dessin:E => dessinGlisse(E, LUGE), conseil:E => conseilGlisse(E, LUGE), demo:E => demoGlisse(E, true) };

// Patinage de vitesse 500 m : au signal, tapoter en rythme (une poussée quand la jauge est dans le vert)
EP.patinage = { n:'Patinage 500 m', ico:'⛸️', saison:'hiver', unite:'s', sens:-1, essais:1, qual:37.5, ref:33.6, a:'—', lg:'POUSSER',
  aide:'Au signal, tapotez ◀ ▶ en alternance, en rythme : une poussée chaque fois que la jauge arrive dans le vert.',
  tuto:['Attendez le signal du départ.', 'Puis tapotez ◀ ▶ en alternance, mais EN RYTHME : la jauge du haut se remplit après chaque poussée.', 'Poussez quand elle arrive dans le vert. Trop vite, les patins glissent (rouge) ; trop lentement, vous perdez de la vitesse.'],
  debut:ctx => ({ x:0, v:0, t:0, dep:0, ph:0, dist:500, depuis:1, fant:ctx.fant, app:ctx.app }),
  maj(E, dt){ if(!depart(E, dt)) return; E.t += dt; E.depuis += dt;
    if(I.taps){ const d = E.depuis; E.depuis = 0;
      const q = d < .18 ? -.3 : d < .26 ? .4 : d < .48 ? 1 : d < .7 ? .6 : .35;
      if(q < 0){ E.v *= .96; E.glisse = .4; } else E.v += 3.4 * q * Math.max(0, 1 - E.v / 17.5) * (E.t < 2 ? 1.5 : 1); }
    E.v = Math.max(0, E.v - .1 * E.v * dt); E.glisse = Math.max(0, (E.glisse || 0) - dt);
    E.x += E.v * dt; E.ph += E.v * dt * .35;
    if(E.x >= E.dist){ const r = E.t - (E.x - E.dist) / Math.max(1, E.v); finir(E, r, virg(r, 2) + ' s'); } },
  dessin(E){
    camera(E.x + avance(2, echelle()), 0, echelle());
    ciel('#3E5A80', '#9FB8D6');
    tribunes();
    // la glace : bandes bleues, reflets
    const gg = g.createLinearGradient(0, Y(0) - V.s * .6, 0, Hh); gg.addColorStop(0, '#DDEBF7'); gg.addColorStop(1, '#F7FBFF'); g.fillStyle = gg; g.fillRect(0, Y(0) - V.s * .6, W, Hh);
    g.fillStyle = 'rgba(31,111,224,.35)'; for(const k of [-.45, -.1, .35]) g.fillRect(0, Y(0) + V.s * k, W, Math.max(1, V.s * .03));
    g.fillStyle = 'rgba(255,255,255,.6)'; for(let x = -(V.cx * V.s) % 140 - 140; x < W; x += 140) g.fillRect(x, Y(0) + V.s * .5, 60, 2);
    g.fillStyle = '#D7263D'; g.fillRect(X(E.dist) - 2, Y(0) - V.s * .6, 4, V.s * 1.4);
    reperes(50, E.dist - 50, 50);
    (E.fant || []).forEach((f, i) => { const fx = fantome(f.T, E.t, E.dist); g.save(); g.translate(0, -V.s * (.3 + i * .2)); patineur(fx, fx * .35, f.app, .5, .9); g.restore(); });
    ombre(E.x, 0); patineur(E.x, E.ph, E.app, 1, 1);
    // le rythme : depuis la dernière poussée
    const w = Math.min(230, W * .58), prochain = (I.dernier === 'g' ? '▶' : '◀');
    jauge(W / 2 - w / 2, HAUT + 6, w, 18, clamp(E.depuis / .8, 0, 1), E.glisse ? '#E8434F' : '#F2C230', [.26 / .8, .48 / .8], E.parti ? `poussez dans le vert (${prochain})` : 'attendez le signal');
    info([virg(Math.max(0, E.t), 2) + ' s', Math.round(E.v * 3.6) + ' km/h']);
  },
  conseil(E){ const c = conseilDepart(E); if(c) return c; if(E.glisse) return { t:'Trop vite ! Attendez le vert', b:null };
    return E.depuis >= .26 && E.depuis <= .48 ? { t:'POUSSEZ !', b:'gd' } : { t:'En rythme : poussez quand la jauge est dans le vert', b:null }; },
  demo:E => ({ taps:E.parti && E.depuis > .3 ? 1 : 0 })
};
function patineur(x, ph, A, alpha, taille){
  const p = Math.sin(ph * 6.283);
  athlete(x, 0, { hanche:.68, torse:1.2, tete:-.8, j1:[.3 + p * .7, -.45 + p * .5], j2:[.3 - p * .7, -.45 - p * .5], b1:[-1.4, -1.4], b2:[-1.3 + p * .4, -1.1 + p * .4] }, tenueHiver(A, 'bonnet'), alpha, taille);
}
// Biathlon : ski de fond (tapoter), 5 tirs (le cœur fait trembler le viseur), puis l'arrivée ; +10 s par cible manquée
EP.biathlon = { n:'Biathlon', ico:'🎯', saison:'hiver', unite:'s', sens:-1, essais:1, qual:64, ref:48, a:'TIRER', lg:'SKIER',
  aide:'Tapotez ◀ ▶ pour skier, puis TIRER quand le viseur est sur la cible noire (5 tirs, +10 s par cible manquée), et skiez jusqu\'à l\'arrivée.',
  tuto:['Tapotez ◀ ▶ pour skier jusqu\'au pas de tir (150 m).', 'Au pas de tir, appuyez sur TIRER quand le viseur rouge est sur la cible noire : 5 cibles. Le cœur bat fort si vous êtes arrivé vite : le viseur tremble, il se calme si vous attendez un peu.', 'Chaque cible manquée ajoute 10 secondes. Puis repartez en tapotant jusqu\'à l\'arrivée.'],
  debut:ctx => ({ x:0, v:0, t:0, phase:'ski1', coeur:.2, tirs:[], pen:0, ph:0, app:ctx.app }),
  maj(E, dt){
    E.t += dt;
    if(E.phase === 'ski1' || E.phase === 'ski2'){ elan(E, dt, 9, 1.5, .6); E.x += E.v * dt; E.ph += E.v * dt * .8;
      E.coeur = clamp(E.coeur + (E.v / 7 - E.coeur) * dt * .5, 0, 1.3);
      if(E.phase === 'ski1' && E.x >= 150){ E.phase = 'tir'; E.v = 0; E.cible = 0; E.tt = 0; annoncer('Pas de tir', '5 cibles'); }
      if(E.phase === 'ski2' && E.x >= 300){ finir(E, E.t + E.pen, virg(E.t + E.pen, 2) + ' s', E.pen ? `${E.pen / 10} cible${E.pen > 10 ? 's' : ''} manquée${E.pen > 10 ? 's' : ''}` : 'sans faute !'); } }
    else if(E.phase === 'tir'){ E.tt += dt; E.coeur = Math.max(.15, E.coeur - dt * .18);
      const amp = .3 + E.coeur * .95; E.vx = Math.sin(E.tt * 2.1) * amp * .9 + Math.sin(E.tt * 5.3) * amp * .3; E.vy = Math.sin(E.tt * 1.6 + 1) * amp * .7;
      if(I.aP){ const ok = Math.hypot(E.vx, E.vy) < .45; E.tirs.push(ok); if(!ok){ E.pen += 10; bip(200, .1, .08); } else bip(1100, .06, .08); E.cible++; if(E.cible >= 5){ E.phase = 'ski2'; annoncer(E.tirs.filter(Boolean).length + ' / 5', 'Repartez !', 1); } } }
  },
  dessin(E){
    const A = tenueHiver(E.app, 'bonnet');
    if(E.phase === 'tir'){
      camera(0, 0, echelle()); ciel('#5D9FDB', '#E3EEF8'); montagnes(); sapins(); g.fillStyle = '#F4F8FD'; g.fillRect(0, Hh * .6, W, Hh);
      const r = Math.min(W / 14, 34), cy = Hh * .42;
      g.fillStyle = '#E6E9EE'; arrondi(W / 2 - r * 6.6, cy - r * 1.6, r * 13.2, r * 3.2, 10); g.fill(); g.fillStyle = '#5C6678'; g.fillRect(W / 2 - r * 6, cy + r * 1.6, 8, Hh * .6 - cy - r * 1.6); g.fillRect(W / 2 + r * 6 - 8, cy + r * 1.6, 8, Hh * .6 - cy - r * 1.6);
      for(let k = 0; k < 5; k++){ const cx = W / 2 + (k - 2) * r * 2.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r * 1.15, 0, 6.29); g.fill();
        g.fillStyle = E.tirs[k] ? '#FFFFFF' : '#1C2433'; g.beginPath(); g.arc(cx, cy, r, 0, 6.29); g.fill(); g.strokeStyle = '#1C2433'; g.lineWidth = 2; g.stroke();
        if(E.tirs[k] === false){ g.strokeStyle = '#D7263D'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - r * .5, cy - r * .5); g.lineTo(cx + r * .5, cy + r * .5); g.moveTo(cx + r * .5, cy - r * .5); g.lineTo(cx - r * .5, cy + r * .5); g.stroke(); } }
      const cx = W / 2 + (E.cible - 2) * r * 2.6 + E.vx * r, vy = cy + E.vy * r, bon = Math.hypot(E.vx, E.vy) < .45;
      g.strokeStyle = bon ? '#2EBE64' : '#D7263D'; g.lineWidth = 3; g.beginPath(); g.arc(cx, vy, r * .6, 0, 6.29); g.moveTo(cx - r, vy); g.lineTo(cx + r, vy); g.moveTo(cx, vy - r); g.lineTo(cx, vy + r); g.stroke();
      // le cœur qui bat
      const bpm = Math.round(70 + E.coeur * 110), batt = 1 + .15 * Math.max(0, Math.sin(E.tt * bpm / 60 * 6.283));
      g.fillStyle = '#E8434F'; g.font = `${Math.round(30 * batt)}px sans-serif`; g.textAlign = 'center'; g.fillText('♥', W / 2, HAUT + 34); g.font = '800 13px "Bricolage Grotesque", sans-serif'; g.fillStyle = '#1C2433'; g.fillText(`${bpm} battements / min`, W / 2, HAUT + 52); g.textAlign = 'left';
      info([virg(E.t, 1) + ' s']);
      return;
    }
    camera(E.x + avance(3, echelle()), 0, echelle());
    ciel('#5D9FDB', '#E3EEF8'); montagnes(); sapins();
    neige(() => 0);
    g.strokeStyle = 'rgba(31,111,224,.35)'; g.lineWidth = 2; for(const k of [.15, .25]){ g.beginPath(); g.moveTo(0, Y(0) + V.s * k); g.lineTo(W, Y(0) + V.s * k); g.stroke(); }
    g.fillStyle = '#D7263D'; g.fillRect(X(300) - 3, Y(0) - V.s * 3, 6, V.s * 3); g.fillStyle = '#1C2433'; g.fillRect(X(150) - 3, Y(0) - V.s * 2, 6, V.s * 2);
    reperes(50, 250, 50);
    const p = Math.sin(E.ph * 3);
    ombre(E.x, 0, 0, 1.6);
    skis(E.x - .1 + p * .35, 0, 0, '#1F6FE0', 1.9); skis(E.x - .1 - p * .35, 0, 0, '#1F6FE0', 1.9);
    // la carabine dans le dos
    g.strokeStyle = '#3C2F25'; g.lineWidth = Math.max(2, V.s * .05); g.beginPath(); g.moveTo(X(E.x - .25), Y(.9)); g.lineTo(X(E.x + .2), Y(1.55)); g.stroke();
    const main = athlete(E.x, 0, { hanche:.88, torse:.5, tete:-.3, j1:[p * .5, p * .5 - .3], j2:[-p * .5, -p * .5 - .3], b1:[-p * 1.1, -p * 1.1 + .5], b2:[p * 1.1, p * 1.1 + .5] }, A);
    if(main){ const mx = X(E.x) + main[0], my = Y(.88) + main[1]; g.strokeStyle = '#2B2F36'; g.lineWidth = Math.max(1.5, V.s * .03); g.beginPath(); g.moveTo(mx, my); g.lineTo(mx - V.s * .6, Y(0)); g.stroke(); }
    info([virg(E.t + E.pen, 1) + ' s', `♥ ${Math.round(70 + E.coeur * 110)}`]);
  },
  conseil(E){
    if(E.phase === 'tir') return Math.hypot(E.vx || 1, E.vy || 1) < .45 ? { t:'TIREZ ! (viseur vert sur la cible)', b:'a' } : { t:'Attendez que le viseur passe sur la cible noire', b:null };
    if(E.phase === 'ski1') return { t:E.x > 120 ? 'Ralentissez un peu : le cœur se calme pour le tir' : 'Tapotez ◀ ▶ pour skier', b:'gd' };
    return { t:'Repartez ! Tapotez ◀ ▶ jusqu\'à l\'arrivée', b:'gd' }; },
  demo(E){ if(E.phase === 'tir'){ E._p = !E._p && E.tt > 1.2 && Math.hypot(E.vx, E.vy) < .3; return { a:E._p }; } return { taps:tapDemo(9) }; }
};

const ETE = ['m100', 'haies', 'longueur', 'triple', 'hauteur', 'perche', 'javelot', 'poids', 'marteau', 'nage', 'arc'];
const HIVER = ['sautski', 'descente', 'slalom', 'bob', 'luge', 'patinage', 'biathlon'];
for(const id of [...ETE, ...HIVER]) EP[id].id = id;
