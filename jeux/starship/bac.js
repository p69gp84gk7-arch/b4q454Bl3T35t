/* Starship : le bac à sable. Un simulateur de vol libre en deux dimensions, avec de vraies lois : l'équation des fusées (poussée, impulsion
   spécifique, masse qui diminue), la pesanteur qui décroît avec l'altitude, la force centrifuge (on peut se mettre en orbite), l'air qui s'épaissit
   en bas (traînée, échauffement de la rentrée), plusieurs étages, des jambes, des parachutes. La Terre, la Lune et Mars.
   Les chiffres sont proches de la réalité (arrondis) ; la 2D, un seul corps et l'absence de rotation du monde sont des simplifications.
   La logique est ici, sans dessin (ce fichier tourne aussi avec Node : `STARSHIP_BAC.tests()`). */
window.STARSHIP_BAC = (() => {
  const G0 = 9.80665, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), RAD = Math.PI / 180;

  /* ---------- Les mondes ---------- */
  const MONDES = {
    terre:{ nom:'La Terre', orbite:200e3, ico:'🌍', R:6371e3, g:9.81, rho0:1.225, H:8500, atmo:100e3, decor:'terre', C:2 * Math.PI * 6371e3 },
    lune:{ nom:'La Lune', orbite:100e3, ico:'🌕', R:1737e3, g:1.62, rho0:0, H:1, atmo:0, decor:'lune', C:2 * Math.PI * 1737e3 },
    mars:{ nom:'Mars', orbite:200e3, ico:'🔴', R:3390e3, g:3.71, rho0:.020, H:11100, atmo:80e3, decor:'mars', C:2 * Math.PI * 3390e3 },
  };

  /* ---------- Les véhicules (des étages, de bas en haut ; masses en kg, poussées en N) ---------- */
  // sec : masse à vide ; carb : propergols ; pSol, pVide : poussée au sol et dans le vide ; isp : impulsion spécifique (s) au sol et dans le vide
  // cdA : surface × traînée dans l'axe, cdAv : de travers (le « ventre ») ; bouclier : 'ventre', 'base' ou null ; qlim : flux de chaleur supporté (W/m²)
  const VEHICULES = {
    hop:{ nom:'Starhopper', departs:['sol'], ico:'🐸', txt:'Le petit prototype d\'essai : trois jambes, un seul moteur, des sauts.', charge:0, retour:null,
      etages:[{ nom:'Starhopper', kind:'hop', sec:20e3, carb:60e3, pSol:1.9e6, pVide:2.1e6, ispSol:300, ispVide:330, cdA:5, cdAv:40, bouclier:null, qlim:3e5, jambes:true, hauteur:9 }] },
    falcon9:{ nom:'Falcon 9', departs:['sol','orbite'], ico:'🛰️', txt:'Deux étages et un satellite de 6 t : mets-le en orbite.', charge:6e3, retour:null,
      etages:[{ nom:'Premier étage', kind:'falconPile', kindSeul:'falcon9', sec:25e3, carb:410e3, pSol:7.6e6, pVide:8.2e6, ispSol:282, ispVide:311, cdA:6, cdAv:170, bouclier:null, qlim:2e5, jambes:true, ailettes:true, hauteur:70 },
              { nom:'Second étage', kind:'falcon2', sec:4e3, carb:107e3, pSol:.9e6, pVide:.93e6, ispSol:300, ispVide:348, cdA:5, cdAv:60, bouclier:null, qlim:1e5, hauteur:26 }] },
    f9retour:{ departs:['retour'], nom:'Falcon 9 : premier étage seul', ico:'🚢', txt:'Le premier étage qui revient : ailettes de guidage, un moteur pour freiner, des jambes.', charge:0, retour:{ y:70e3, vx:500, vy:-800, th:0, carb:.08 },
      etages:[{ nom:'Premier étage', kind:'falcon9', sec:25e3, carb:410e3, pSol:.85e6, pVide:.93e6, ispSol:282, ispVide:311, cdA:6, cdAv:170, bouclier:null, qlim:2.6e5, jambes:true, ailettes:true, hauteur:42 }] },
    starstack:{ departs:['sol','orbite'], nom:'Super Heavy + Starship', ico:'🚀', txt:'La plus grande fusée jamais construite : 33 moteurs, 120 m, 5 000 t.', charge:100e3, retour:null,
      etages:[{ nom:'Super Heavy', kind:'shPile', kindSeul:'superheavy', sec:200e3, carb:3400e3, pSol:74e6, pVide:80e6, ispSol:327, ispVide:350, cdA:60, cdAv:640, bouclier:null, qlim:3e5, ailettes:true, hauteur:108 },
              { nom:'Starship', kind:'starship', sec:120e3, carb:1200e3, pSol:12e6, pVide:14.7e6, ispSol:330, ispVide:380, cdA:60, cdAv:470, ld:.6, bouclier:'ventre', qlim:1.6e6, jambes:true, hauteur:52 }] },
    superheavy:{ nom:'Super Heavy : le propulseur seul', departs:['retour'], ico:'🦾', txt:'Le propulseur qui revient se faire attraper par la tour.', charge:0, retour:{ y:65e3, vx:400, vy:-700, th:0, carb:.06 },
      etages:[{ nom:'Super Heavy', kind:'superheavy', sec:200e3, carb:3400e3, pSol:12e6, pVide:13e6, ispSol:327, ispVide:350, cdA:60, cdAv:640, bouclier:null, qlim:3e5, ailettes:true, hauteur:70 }] },
    starship:{ nom:'Starship : le vaisseau seul', departs:['sol','orbite','retour'], ico:'⭐', txt:'Le vaisseau : de l\'orbite jusqu\'au retour à plat, ou en route vers la Lune et Mars.', charge:100e3, retour:{ y:110e3, vx:7600, vy:-40, th:30, carb:.08, charge:0 },
      etages:[{ nom:'Starship', kind:'starship', sec:120e3, carb:1200e3, pSol:12e6, pVide:14.7e6, ispSol:330, ispVide:380, cdA:60, cdAv:470, ld:.6, bouclier:'ventre', qlim:1.6e6, jambes:true, hauteur:52 }] },
    dragon:{ nom:'Dragon', departs:['sol','orbite','retour'], ico:'🛟', txt:'La capsule : un coffre avec ses moteurs, puis la capsule seule, son bouclier et ses parachutes.', charge:0, retour:{ y:110e3, vx:7400, vy:-60, th:-90, carb:.5, charge:0 },
      etages:[{ nom:'Coffre et moteurs', kind:'dragon', sec:4e3, carb:1400, pSol:.58e6, pVide:.58e6, ispSol:235, ispVide:235, cdA:10, cdAv:30, bouclier:null, qlim:3e5, hauteur:12 },
              { nom:'Capsule', kind:'dragonSeul', sec:6e3, carb:0, pSol:0, pVide:0, ispSol:235, ispVide:235, cdA:12, cdAv:14, bouclier:'base', qlim:1.4e6, chutes:true, hauteur:8 }] },
  };

  const DEPARTS = { sol:'Au sol, sur la plateforme', orbite:'En orbite (200 km)', retour:'En descente (le retour)' };
  // l'état initial d'un vol libre : { monde, vehicule, depart, vent, illimite, tour }
  function nouveau(opts){
    const M = MONDES[opts.monde] || MONDES.terre, V = VEHICULES[opts.vehicule] || VEHICULES.hop, depart = opts.depart || 'sol';
    const etages = V.etages.map(e => ({ ...e, plein:e.carb, reste:e.carb, jambesSorties:false, chutesOuvertes:0 }));
    const B = { monde:opts.monde, M, V, vehicule:opts.vehicule, etages, i:0, charge:V.charge, t:0, x:0, y:0, vx:0, vy:0, th:0, om:0, gaz:0, sas:'tenir', cap:0, illimite:!!opts.illimite, vent:opts.vent || 0, tour:!!opts.tour,
      chaleur:0, degats:0, etat:'sol', cause:'', msgs:[], phi:Math.random() * 6, warp:1, jambes:false, chutes:0, qMax:0, maxY:0, maxV:0, vTouch:0, spec:null };
    if(depart === 'sol') B.etat = 'pose';
    else if(depart === 'orbite'){
      B.y = M.orbite; B.vx = Math.sqrt(M.g * M.R * M.R / (M.R + B.y)); B.vy = 0; B.th = 90; B.cap = 90; B.etat = 'vol';
      if(V.etages.length > 1 && opts.vehicule !== 'dragon') B.i = V.etages.length - 1;                     // seul le dernier étage est en orbite
      B.etages.forEach((e, k) => { e.reste = k < B.i ? 0 : e.plein * .9; });
      if(opts.vehicule === 'dragon') B.etages[0].reste = B.etages[0].plein * .9;
    } else if(depart === 'retour' && V.retour){
      const r = V.retour; if(r.charge != null) B.charge = r.charge; B.y = r.y; B.vx = r.vx; B.vy = r.vy; B.th = r.th; B.cap = r.th; B.etat = 'vol'; B.sas = 'tenir';
      B.i = opts.vehicule === 'dragon' ? 1 : 0;
      B.etages.forEach((e, k) => { e.reste = k < B.i ? 0 : e.plein * r.carb; });
    }
    B.carbInit = B.etages.map(e => e.reste);
    return B;
  }
  const etage = B => B.etages[B.i];
  const masse = B => { let m = B.charge; for(let k = B.i; k < B.etages.length; k++) m += B.etages[k].sec + B.etages[k].reste; return m; };
  const rho = (B, y) => B.M.rho0 * Math.exp(-Math.max(0, y) / B.M.H);
  const grav = (B, y) => B.M.g * Math.pow(B.M.R / (B.M.R + Math.max(0, y)), 2);
  // la poussée disponible (de l'air à plein) et la consommation
  function poussee(B){
    const E = etage(B); if(!E || E.reste <= 0) return { F:0, mdot:0 };
    const p = clamp(rho(B, B.y) / 1.225, 0, 1), F = (E.pVide - (E.pVide - E.pSol) * p) * B.gaz, isp = E.ispVide - (E.ispVide - E.ispSol) * p;
    return { F, mdot:E.pVide ? F / (isp * G0) : 0 };
  }
  // l'orbite : apogée et périgée (altitude, m) d'après l'énergie et le moment cinétique
  function orbite(B){
    const mu = B.M.g * B.M.R * B.M.R, r = B.M.R + B.y, v2 = B.vx * B.vx + B.vy * B.vy, eps = v2 / 2 - mu / r;
    if(eps >= 0) return { ouverte:true, ap:Infinity, pe:-B.M.R };
    const a = -mu / (2 * eps), h = r * B.vx, e = Math.sqrt(Math.max(0, 1 + 2 * eps * h * h / (mu * mu)));
    return { ouverte:false, a, e, ap:a * (1 + e) - B.M.R, pe:a * (1 - e) - B.M.R, T:2 * Math.PI * Math.sqrt(a * a * a / mu) };
  }
  // le Δv restant (équation de Tsiolkovsky, dans le vide)
  function deltaV(B){
    let dv = 0, m = masse(B);
    for(let k = B.i; k < B.etages.length; k++){ const E = B.etages[k]; if(E.reste > 0 && E.pVide){ const m1 = m - E.reste; dv += E.ispVide * G0 * Math.log(m / m1); } m -= E.reste + E.sec; }
    return dv;
  }
  const message = (B, t, cls) => B.msgs.push({ t, cls:cls || '', at:B.t });
  function detruire(B, cause){ if(B.etat === 'detruit') return; B.etat = 'detruit'; B.cause = cause; B.gaz = 0; message(B, cause, 'mal'); }

  // sépare l'étage actuel (le suivant s'allume quand on pousse)
  function etageSuivant(B){
    if(B.i >= B.etages.length - 1 || B.etat === 'detruit') return false;
    const E = etage(B); B.i++; B.gaz = 0; message(B, `Séparation : ${E.nom} largué`, 'bon'); B.om += 1; return true;
  }
  const jambes = B => { const E = etage(B); if(!E || !E.jambes) return false; B.jambes = !B.jambes; message(B, B.jambes ? 'Jambes sorties' : 'Jambes rentrées', ''); return true; };
  function parachutes(B){ const E = etage(B); if(!E || !E.chutes || B.chutes) return false; const sp = Math.hypot(B.vx, B.vy); if(sp > 250){ detruire(B, `Parachutes déchirés : ouverts à ${sp.toFixed(0)} m/s (au plus 250).`); return true; } B.chutes = 1; message(B, 'Parachutes ouverts', 'bon'); return true; }
  const SAS = ['libre', 'tenir', 'prograde', 'retro', 'vertical'];

  // un pas de simulation (e : { dir, cible, action })
  function pas(B, e, dt){
    if(B.etat === 'detruit') return;
    B.t += dt;
    const E = etage(B), M = B.M;
    // la poussée : le curseur de puissance (0 à 1)
    const cible = e.cible != null ? e.cible : (e.gaz ? 1 : 0);
    B.gaz = E && E.reste > 0 ? clamp(B.gaz + clamp(cible - B.gaz, -3 * dt, 3 * dt), 0, 1) : 0;
    if(B.etat === 'pose' && B.gaz * (E ? E.pSol : 0) / (masse(B) * grav(B, 0)) < 1.02){ B.vx = 0; B.vy = 0; if(B.gaz > .9 && !B.avert){ B.avert = 1; message(B, 'Poussée insuffisante : trop lourd pour décoller', 'mal'); } return; }
    if(B.etat === 'pose' || B.etat === 'sol') B.etat = 'vol';
    // l'attitude
    const dir = e.dir || 0, phiV = Math.atan2(B.vx, B.vy) / RAD, norm = a => ((a + 540) % 360) - 180;
    let couple = 0;
    const sp = Math.hypot(B.vx, B.vy);
    if(B.sas === 'libre'){ couple = dir * 30; B.om -= B.om * .15 * dt; }
    else {
      if(B.sas === 'tenir') B.cap = norm(B.cap + dir * 25 * dt);
      else if(B.sas === 'prograde' && sp > 5) B.cap = phiV; else if(B.sas === 'retro' && sp > 5) B.cap = norm(phiV + 180); else if(B.sas === 'vertical') B.cap = 0;
      const err = norm(B.cap - B.th); couple = clamp(err * 1.4 - B.om * 2.2, -35, 35);
    }
    const rcs = 12, gimb = (E && E.reste > 0 ? B.gaz * 25 : 0);
    B.om += clamp(couple, -(rcs + gimb), rcs + gimb) * dt; B.th = norm(B.th + B.om * dt);
    // les forces
    const m = masse(B), P = poussee(B), th = B.th * RAD, r = M.R + B.y, g = grav(B, B.y), rh = rho(B, B.y);
    let ax = P.F / m * Math.sin(th), ay = P.F / m * Math.cos(th) - g + B.vx * B.vx / r;
    if(sp > .5){
      const alpha = Math.acos(clamp((Math.sin(th) * B.vx + Math.cos(th) * B.vy) / sp, -1, 1)), s2 = Math.sin(alpha) ** 2, cd = E ? E.cdA + (E.cdAv - E.cdA) * s2 : 5;
      const chute = B.chutes ? 1 : 0, cdA = cd + chute * 1200 * Math.min(1, B.chutes), a = .5 * rh * sp * cdA / m;
      ax -= a * B.vx; ay -= a * B.vy;
      if(E && E.ld){                                                          // la portance du ventre (le Starship plane un peu en rentrant)
        const bx = Math.sin(th + Math.PI / 2), by = Math.cos(th + Math.PI / 2), ux = B.vx / sp, uy = B.vy / sp, d = bx * ux + by * uy, lx = -(bx - d * ux), ly = -(by - d * uy), ln = Math.hypot(lx, ly) || 1;
        const al = a * sp * E.ld * Math.sin(2 * alpha) * (d > 0 ? 1 : 0);
        ax += lx / ln * al; ay += ly / ln * al;
      }
      // l'échauffement (flux de chaleur à la paroi), et ce que le bouclier supporte
      const q = 1.7e-4 * Math.sqrt(rh / 1.2) * sp * sp * sp, cosA = (Math.sin(th) * B.vx + Math.cos(th) * B.vy) / sp;
      let expo = 1;
      if(E && E.bouclier === 'ventre') expo = Math.sin(alpha) > .35 && Math.cos((phiV - (B.th + 90)) * RAD) > .5 ? .25 : 3;
      else if(E && E.bouclier === 'base') expo = cosA < -.75 ? .2 : 4;
      else expo = 1.6;
      const lim = E ? E.qlim : 3e5, charge = q * expo / lim;
      B.chaleur = clamp(charge, 0, 2);
      if(charge > 1) B.degats += (charge - 1) * .35 * dt; else B.degats = Math.max(0, B.degats - .02 * dt);
      B.qMax = Math.max(B.qMax, q);
      if(B.degats > 1) return detruire(B, 'Le véhicule a brûlé pendant la rentrée dans l\'atmosphère.');
    } else B.chaleur = 0;
    // le vent
    if(B.vent && B.y < 20e3 && rh > 0) ax += B.vent * 1.2 * Math.sqrt(rh / 1.225) * (Math.sin(B.t * .5 + B.phi) + .5 * Math.sin(B.t * 1.6 + B.phi * 2)) * clamp(B.y / 3000, .3, 1);
    // les moteurs consomment
    if(!B.illimite && E) E.reste = Math.max(0, E.reste - P.mdot * dt); else if(B.illimite && E && E.reste <= 0 && E.plein) E.reste = 1;
    B.vx += ax * dt; B.vy += ay * dt; B.x += B.vx * dt * M.R / (M.R + Math.max(0, B.y)); B.y += B.vy * dt;
    const C = M.C; if(B.x > C / 2) B.x -= C; else if(B.x < -C / 2) B.x += C;
    B.maxY = Math.max(B.maxY, B.y); B.maxV = Math.max(B.maxV, sp);
    // les bras de la tour (le propulseur et le vaisseau peuvent y être rattrapés)
    if(B.tour && E && (E.kind === 'superheavy' || E.kind === 'starship' || E.kind === 'shPile') && B.vy < 0 && B.y <= 75 && B.y > 75 + B.vy * dt - 1){
      const ok = Math.abs(B.x) <= 14 && Math.abs(B.vy) <= 9 && Math.abs(B.th) <= 10 && B.gaz < 1.01;
      if(ok){ B.etat = 'pose'; B.y = 75; B.vx = 0; B.vy = 0; B.th = 0; B.om = 0; B.cause = 'Rattrapé par les bras de la tour !'; message(B, B.cause, 'bon'); return; }
      message(B, 'Bras de la tour : raté', 'mal');
    }
    // le contact avec le sol
    if(B.y <= 0){
      const v = Math.hypot(B.vx, B.vy), ang = Math.abs(B.th), droit = ang < 14 || ang > 346;
      const pose = (B.jambes || B.chutes || (E && E.kind === 'dragonSeul') || (E && E.kind === 'hop')) && Math.abs(B.vy) <= (B.chutes ? 16 : 9) && Math.abs(B.vx) <= (B.chutes ? 16 : 6) && (B.chutes || droit);
      B.vTouch = v;
      if(pose){ B.y = 0; B.vy = 0; B.vx = 0; B.om = 0; B.etat = 'pose'; message(B, B.chutes ? 'Amerri en douceur' : 'Posé en douceur !', 'bon'); }
      else if(v < 4 && droit && (E && (E.kind === 'starship' || E.kind === 'falcon9' || E.kind === 'superheavy' || E.kind === 'falconPile' || E.kind === 'shPile' || E.kind === 'falcon2'))){ B.y = 0; B.vy = 0; B.vx = 0; B.om = 0; B.etat = 'pose'; }
      else detruire(B, `Écrasé à ${v.toFixed(0)} m/s${!B.jambes && !B.chutes ? ' (jambes non sorties ?)' : ''}.`);
    }
  }

  /* ---------- Les essais ---------- */
  function tests(){
    const r = [], ok = (c, t) => r.push((c ? '✅ ' : '❌ ') + t);
    // une orbite circulaire reste circulaire (le simulateur conserve l'énergie)
    const O = nouveau({ monde:'terre', vehicule:'starship', depart:'orbite' }); O.gaz = 0; const pe0 = orbite(O).pe;
    for(let i = 0; i < 60 * 600; i++) pas(O, { dir:0, cible:0 }, 1 / 60);
    const o2 = orbite(O); ok(Math.abs(o2.pe - pe0) < 8e3 && Math.abs(o2.ap - 200e3) < 8e3, `orbite à 200 km : périgée ${(o2.pe / 1e3).toFixed(0)} km, apogée ${(o2.ap / 1e3).toFixed(0)} km après 10 min`);
    ok(Math.abs(O.vx - 7790) < 60, `vitesse orbitale à 200 km : ${O.vx.toFixed(0)} m/s`);
    // Falcon 9 : le Δv total permet l'orbite (≈ 9 à 10 km/s en tout)
    const F = nouveau({ monde:'terre', vehicule:'falcon9' }); const dv = deltaV(F); ok(dv > 8500 && dv < 13000, `Δv de Falcon 9 : ${(dv / 1e3).toFixed(1)} km/s`);
    const S = nouveau({ monde:'terre', vehicule:'starstack' }); const dv2 = deltaV(S); ok(dv2 > 8000 && dv2 < 12000, `Δv de Super Heavy + Starship : ${(dv2 / 1e3).toFixed(1)} km/s`);
    // le rapport poussée / poids au décollage
    const twr = F.etages[0].pSol / (masse(F) * G0); ok(twr > 1.1 && twr < 2, `Falcon 9 : poussée / poids au décollage ${twr.toFixed(2)}`);
    const twr2 = S.etages[0].pSol / (masse(S) * G0); ok(twr2 > 1.2 && twr2 < 2, `Super Heavy + Starship : poussée / poids au décollage ${twr2.toFixed(2)}`);
    // un vol vertical : le Starhopper décolle, monte, retombe sans jambes et s'écrase ; avec les jambes il se pose en douceur
    const H = nouveau({ monde:'terre', vehicule:'hop' }); H.jambes = true; let monte = false;
    for(let i = 0; i < 60 * 12; i++){ pas(H, { cible:i < 60 * 4 ? 1 : (H.vy < -12 ? .95 : .35), dir:0 }, 1 / 60); if(H.y > 100) monte = true; if(H.etat !== 'vol' && H.t > 1) break; }
    ok(monte, 'le Starhopper décolle et monte à plus de 100 m');
    // la Lune : sans air, pas d'échauffement, une chute libre
    const L = nouveau({ monde:'lune', vehicule:'hop' }); L.y = 1000; L.etat = 'vol'; for(let i = 0; i < 60 * 5; i++) pas(L, { cible:0, dir:0 }, 1 / 60); ok(Math.abs(L.vy + 1.62 * 5) < .2 && L.chaleur === 0, 'chute libre sur la Lune : −1,62 m/s²');
    // une montée complète : Falcon 9 se met en orbite avec un virage progressif
    const F2 = nouveau({ monde:'terre', vehicule:'falcon9' }); F2.sas = 'tenir';
    for(let i = 0; i < 60 * 1100 && F2.etat !== 'detruit'; i++){
      F2.cap = F2.t < 12 ? 0 : Math.min(88, (F2.t - 12) * .42); if(F2.etages[F2.i].reste <= 0 && F2.i === 0) etageSuivant(F2);
      const o = orbite(F2); pas(F2, { dir:0, cible:(F2.i === 1 && o.pe > 190e3) ? 0 : 1 }, 1 / 60);
    }
    const oo = orbite(F2); ok(F2.etat !== 'detruit' && oo.pe > 150e3, `Falcon 9 en orbite : périgée ${(oo.pe / 1e3).toFixed(0)} km, apogée ${(oo.ap / 1e3).toFixed(0)} km`);
    // la rentrée : le Starship à plat survit, le dos tourné au flux il brûle
    const R1 = nouveau({ monde:'terre', vehicule:'starship', depart:'retour' }); for(let i = 0; i < 60 * 3000 && R1.etat !== 'detruit' && R1.y > 0; i++) pas(R1, { dir:0, cible:0 }, 1 / 60);
    ok(!/brûlé/.test(R1.cause), 'Starship rentre ventre au vent sans brûler');
    const R2 = nouveau({ monde:'terre', vehicule:'starship', depart:'retour' }); R2.th = 90; R2.cap = 90; for(let i = 0; i < 60 * 3000 && R2.etat !== 'detruit' && R2.y > 0; i++) pas(R2, { dir:0, cible:0 }, 1 / 60);
    ok(/brûlé/.test(R2.cause), 'Starship mal orienté : brûlé');
    // Dragon : parachutes
    const D = nouveau({ monde:'terre', vehicule:'dragon', depart:'retour' }); let chutesOk = false;
    for(let i = 0; i < 60 * 3000 && D.etat !== 'detruit' && D.y > 0; i++){ if(!D.chutes && D.y < 9000 && Math.hypot(D.vx, D.vy) < 230){ parachutes(D); chutesOk = true; } pas(D, { dir:0, cible:0 }, 1 / 60); }
    ok(chutesOk && D.etat === 'pose', 'Dragon : rentrée et parachutes, amerrissage en douceur');
    return r;
  }
  return { MONDES, VEHICULES, DEPARTS, SAS, nouveau, pas, masse, orbite, deltaV, etageSuivant, jambes, parachutes, rho, grav, poussee, etage, tests };
})();
