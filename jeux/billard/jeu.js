/* Billard : le jeu (pool 8 boules et billard français), vu de dessus.
   La physique est dans billard/physique.js (window.BILLARD_PHYS). Le repère de la table (en mètres) est dessiné tourné d'un quart de tour
   quand l'écran est en hauteur (la grande bande à la verticale).
   Viser : toucher la table (la queue s'oriente vers le doigt), ◀ ▶ et la molette pour un réglage fin ; tirer la queue en arrière sur la
   barre de droite et lâcher pour frapper ; la petite boule en bas règle l'effet (rétro, coulé, à gauche, à droite). */
(function(){
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const Ph = window.BILLARD_PHYS;
const NIVEAUX = { facile:{ n:'Facile', bruit:.025, choix:3 }, moyen:{ n:'Moyen', bruit:.009, choix:1 }, expert:{ n:'Expert', bruit:.0025, choix:1, simule:true } };
const COUL = ['#F7F5EE', '#F2C400', '#1F4FBF', '#D7261E', '#5A2A82', '#F06A1E', '#1E7A3C', '#7A1E24', '#151515'];
const groupe = id => id === 8 ? 'noire' : id >= 1 && id <= 7 ? 'pleines' : id >= 9 ? 'rayees' : null;
const NOM_G = { pleines:'les pleines', rayees:'les rayées' };
const VMAX = 5.6;

/* ---------- Le son ---------- */
let AC = null, son = lire('billard-son', true);
function audio(){ if(AC || !son) return; try{ try{ if(navigator.audioSession) navigator.audioSession.type = 'ambient'; }catch(e){} AC = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ AC = null; } }
function ton(f, duree, vol, type = 'sine', f2 = 0){
  if(!AC || !son || vol < .004) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + duree);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + duree);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + duree + .02);
}
const sons = {
  choc:v => { ton(2200 + Math.random() * 400, .05, clamp(v / 4, 0, .35), 'triangle'); ton(4100, .025, clamp(v / 8, 0, .12)); },
  bande:v => ton(110, .09, clamp(v / 6, 0, .25), 'sine', 70),
  poche:() => { ton(180, .18, .3, 'sine', 90); setTimeout(() => ton(320, .06, .12, 'triangle'), 120); },
  queue:v => { ton(900, .04, clamp(v / 5, .05, .3), 'triangle'); ton(140, .07, .15, 'sine'); },
};

/* ---------- La partie ---------- */
let G = null, raf = 0, dernierLancement = null;
function boulesPool(){
  const T = Ph.TABLES.pool, R = T.R, fx = T.L * .75, cy = T.l / 2, dx = 2 * R * Math.cos(Math.PI / 6) * 1.003, dy = 2 * R * 1.003;
  // le triangle : la 1 devant, la 8 au milieu, une pleine et une rayée dans les coins du fond, les autres au hasard
  const reste = [2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - .5);
  const places = [];
  for(let r = 0; r < 5; r++) for(let j = 0; j <= r; j++) places.push([fx + r * dx, cy + (j - r / 2) * dy]);
  const ids = []; ids[0] = 1; ids[4] = 8; ids[10] = 9; ids[14] = 2;
  const restant = reste.filter(x => x !== 9 && x !== 2); restant.push(...[3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15].filter(x => !restant.includes(x)));
  let k = 0; for(let i = 0; i < 15; i++) if(ids[i] == null) ids[i] = restant[k++];
  const b = places.map(([x, y], i) => ({ id:ids[i], x:x + (Math.random() - .5) * .0006, y:y + (Math.random() - .5) * .0006 }));
  b.unshift({ id:0, x:T.L / 4, y:cy });
  return b;
}
function lancer(cfg){
  dernierLancement = cfg;
  const jeu = cfg.jeu, robot = cfg.mode === 'robot';
  const T = jeu === 'pool' ? Ph.table('pool', boulesPool()) : Ph.table('carambole', [{ id:0, x:Ph.TABLES.carambole.L / 4, y:Ph.TABLES.carambole.l / 2 + .182 }, { id:1, x:Ph.TABLES.carambole.L / 4, y:Ph.TABLES.carambole.l / 2 }, { id:2, x:Ph.TABLES.carambole.L * .75, y:Ph.TABLES.carambole.l / 2 }]);
  const noms = robot ? ['Toi', `Robot ${NIVEAUX[cfg.niveau].n.toLowerCase()}`] : [cfg.nom1 || 'Joueur 1', cfg.nom2 || 'Joueur 2'];
  G = { jeu, mode:cfg.mode, niveau:cfg.niveau, T, joueurs:noms.map((nom, i) => ({ nom, robot:robot && i === 1, groupe:null, points:0, serie:0, meilleure:0 })),
    tour:0, phase:'viser', angle:0, force:0, effet:{ a:0, b:0 }, enMain:jeu === 'pool', zone:'cuisine', casse:true, msg:'', msgT:0, fin:false, pause:false, dernier:performance.now(), coups:0, tirees:[], visees:0 };
  G.angle = jeu === 'pool' ? 0 : Math.atan2(T.b[2].y - T.b[0].y, T.b[2].x - T.b[0].x) - .04;
  ['eMenu', 'eAide', 'eFin', 'ePause'].forEach(id => $(id).hidden = true);
  $('hud').hidden = $('commandes').hidden = false;
  audio();
  majHud(); calculerVue(); debutTour(true);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(boucle);
}
const joueur = () => G.joueurs[G.tour];
const blanche = () => G.jeu === 'pool' ? 0 : G.tour === 0 ? 0 : 1;            // au billard français, chacun sa boule
const boule = id => G.T.b.find(q => q.id === id);
function dire(txt, duree = 2.2){ G.msg = txt; G.msgT = duree; if(txt) $('message').textContent = txt; $('message').classList.toggle('vu', !!txt); }
function debutTour(premier = false){
  G.phase = 'viser'; G.force = 0; G.effet = { a:0, b:0 }; dessinerEffet();
  const J = joueur();
  if(G.jeu === 'carambole' && !premier){ const q = boule(blanche()), r = G.jeu === 'carambole' ? boule(2) : null; G.angle = Math.atan2(r.y - q.y, r.x - q.x); }
  majHud();
  if(J.robot){ G.phase = 'robot'; dire(`${J.nom} réfléchit…`, 9); setTimeout(jouerRobot, 500); return; }
  if(G.enMain) dire(G.casse ? 'Place la blanche derrière la ligne, puis vise et tire' : 'Boule en main : place la blanche où tu veux', 4);
  else dire(G.mode === 'deux' ? `À ${J.nom} de jouer` : 'À toi de jouer', 2);
}

/* ---------- Le coup ---------- */
function tirer(force){
  if(!G || G.phase !== 'viser') return;
  if(G.enMain && !placeValide(boule(0).x, boule(0).y)){ dire('La blanche ne peut pas être placée ici', 2); return; }
  frapper(vitesse(force));
}
// la vitesse de la blanche (m/s) pour une force de 0 à 1
const vitesse = force => G.casse && G.jeu === 'pool' ? .4 + force * (VMAX + 1.4 - .4) : .3 + VMAX * force ** 1.4;
function frapper(v){
  G.enMain = false; G.coups++;
  Ph.frapper(G.T, blanche(), G.angle, v, G.effet.a, G.effet.b);
  G.ev = Ph.evenements(); G.vu = { chocs:0, bandes:0, poches:0 }; G.phase = 'roule'; G.force = 0;
  sons.queue(v); dire('', 0);
}
// pendant que les boules roulent
function rouler(dt){
  const T = G.T, pasT = 1 / 600;
  for(let t = 0; t < dt; t += pasT) Ph.pas(T, pasT, G.ev, blanche());
  // les sons des nouveaux chocs
  const ev = G.ev;
  for(; G.vu.chocs < ev.chocs.length; G.vu.chocs++) sons.choc(ev.chocs[G.vu.chocs].v);
  for(; G.vu.bandes < ev.bandes.length; G.vu.bandes++) sons.bande(ev.bandes[G.vu.bandes].v);
  for(; G.vu.poches < ev.poches.length; G.vu.poches++){ sons.poche(); const id = ev.poches[G.vu.poches]; if(id) G.tirees.push(id); }
  if(!Ph.enMouvement(T)) finCoup();
}
function finCoup(){
  const ev = G.ev, J = joueur(), autre = G.joueurs[1 - G.tour];
  if(G.jeu === 'carambole'){
    const point = ev.touchees.length >= 2;
    if(point){ J.points++; J.serie++; J.meilleure = Math.max(J.meilleure, J.serie); dire(`Point ! ${J.points} (série de ${J.serie})`, 1.6); }
    if(J.points >= OBJ_CARAMBOLE){ finPartie(G.tour); return; }
    if(!point){ J.serie = 0; dire(ev.touchees.length ? 'Raté : il faut toucher les deux autres boules' : 'Aucune boule touchée', 1.8); changerTour(); return; }
    debutTour(); return;
  }
  // le pool 8 boules
  const poches = ev.poches.filter(id => id !== 0), blancheDedans = ev.poches.includes(0), huit = poches.includes(8);
  const mesBoules = g => G.T.b.filter(q => groupe(q.id) === g && !q.dedans).length;
  let faute = '';
  if(blancheDedans) faute = 'La blanche est tombée';
  else if(ev.premier == null) faute = 'Aucune boule touchée';
  else if(J.groupe){
    const restant = mesBoules(J.groupe) + poches.filter(id => groupe(id) === J.groupe).length;   // avant ce coup
    const attendu = restant > 0 ? J.groupe : 'noire';
    if(groupe(ev.premier) !== attendu) faute = `Il fallait toucher ${attendu === 'noire' ? 'la noire' : NOM_G[J.groupe]} en premier`;
  } else if(!G.casse && ev.premier === 8) faute = 'La noire ne peut pas être touchée en premier';
  const casse = G.casse; G.casse = false;
  if(huit){
    if(casse){ const n = boule(8); n.dedans = false; n.x = G.T.L * .75; n.y = G.T.l / 2; n.vx = n.vy = 0; G.tirees = G.tirees.filter(i => i !== 8); dire('La noire à la casse : elle revient sur la table', 2); }
    else {
      const gagne = !faute && J.groupe && mesBoules(J.groupe) === 0;
      finPartie(gagne ? G.tour : 1 - G.tour, gagne ? 'La noire est rentrée !' : faute ? `Noire rentrée sur une faute` : 'Noire rentrée trop tôt'); return;
    }
  }
  if(faute){
    if(blancheDedans){ const q = boule(0); q.dedans = false; q.vx = q.vy = 0; q.x = G.T.L / 4; q.y = G.T.l / 2; libererPlace(q); }
    G.enMain = true; G.zone = 'tout';
    dire(`Faute : ${faute}. ${autre.nom} a la boule en main`, 2.8);
    changerTour(); return;
  }
  // l'attribution des groupes, à la première boule rentrée après la casse
  if(!J.groupe && !casse && poches.length){
    const g = groupe(poches[0]); if(g && g !== 'noire'){ J.groupe = g; autre.groupe = g === 'pleines' ? 'rayees' : 'pleines'; dire(`${J.nom} joue ${NOM_G[g]}`, 2); }
  }
  const rentreBonne = J.groupe ? poches.some(id => groupe(id) === J.groupe) : poches.length > 0;
  if(rentreBonne){ debutTour(); return; }
  changerTour();
}
function changerTour(){ G.tour = 1 - G.tour; setTimeout(() => { if(G && !G.fin) debutTour(); }, 600); G.phase = 'attente'; majHud(); }
function finPartie(gagnant, txt = ''){
  G.fin = true; G.phase = 'fin';
  const J = G.joueurs[gagnant], rec = lire('billard-records', {}), k = G.jeu;
  rec[k] = rec[k] || { v:{}, d:{}, parties:0, serie:0 };
  rec[k].parties++;
  if(G.mode === 'robot'){ const n = G.niveau; if(gagnant === 0) rec[k].v[n] = (rec[k].v[n] || 0) + 1; else rec[k].d[n] = (rec[k].d[n] || 0) + 1; }
  else rec.deux = (rec.deux || 0) + 1;
  if(k === 'carambole') rec[k].serie = Math.max(rec[k].serie || 0, G.mode === 'robot' ? G.joueurs[0].meilleure : Math.max(...G.joueurs.map(j => j.meilleure)));
  rec.dernier = { jeu:k, n:k === 'pool' ? 'Pool 8 boules' : 'Billard français', gagnant:J.nom, robot:G.mode === 'robot' ? G.niveau : null, gagne:G.mode === 'robot' ? gagnant === 0 : null };
  ecrire('billard-records', rec);
  $('fTitre').textContent = `${k === 'pool' ? 'Pool 8 boules' : `Billard français en ${OBJ_CARAMBOLE} points`}${G.mode === 'robot' ? ` · robot ${NIVEAUX[G.niveau].n.toLowerCase()}` : ''}`;
  $('fGagnant').textContent = G.mode === 'robot' ? (gagnant === 0 ? 'Gagné !' : 'Perdu…') : `${J.nom} gagne !`;
  $('fTxt').textContent = txt;
  const lignes = [['Coups joués', G.coups]];
  if(k === 'carambole') G.joueurs.forEach(j => lignes.push([j.nom, `${j.points} point${j.points > 1 ? 's' : ''} · meilleure série ${j.meilleure}`]));
  else G.joueurs.forEach(j => lignes.push([j.nom, j.groupe ? `${NOM_G[j.groupe]} · ${7 - G.T.b.filter(q => groupe(q.id) === j.groupe && !q.dedans).length} rentrées` : '—']));
  if(G.mode === 'robot') lignes.push([`Contre le robot ${NIVEAUX[G.niveau].n.toLowerCase()}`, `${rec[k].v[G.niveau] || 0} victoire(s), ${rec[k].d[G.niveau] || 0} défaite(s)`]);
  $('fDetail').innerHTML = lignes.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');
  setTimeout(() => { if(G && G.fin){ $('eFin').hidden = false; $('commandes').hidden = true; } }, 900);
}
const OBJ_CARAMBOLE = 15;

/* ---------- La boule en main ---------- */
function placeValide(x, y){
  const T = G.T, R = T.R;
  if(x < R || y < R || x > T.L - R || y > T.l - R) return false;
  if(G.casse && G.zone === 'cuisine' && x > T.L / 4) return false;
  return T.b.every(q => q.id === 0 || q.dedans || Math.hypot(q.x - x, q.y - y) > 2 * R + .002);
}
function libererPlace(q){
  const T = G.T;
  for(let k = 0; k < 400 && !placeValide(q.x, q.y); k++){ q.x = clamp(q.x + (Math.random() - .5) * .1, T.R, T.L - T.R); q.y = clamp(q.y + (Math.random() - .5) * .1, T.R, T.l - T.R); }
}

/* ---------- Le robot ---------- */
// le chemin de a à b est-il libre (aucune boule à moins de 2R, sauf celles qu'on ignore) ?
function libre(T, ax, ay, bx, by, ignore){
  const R = T.R, ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  for(const q of T.b){
    if(q.dedans || ignore.includes(q.id)) continue;
    const u = clamp(((q.x - ax) * ex + (q.y - ay) * ey) / l2, 0, 1), d = Math.hypot(ax + ex * u - q.x, ay + ey * u - q.y);
    if(d < 2 * R * .98) return false;
  }
  return true;
}
// les coups directs possibles au pool : (boule, poche), avec leur facilité
function coupsPool(T, J, bx, by){
  const R = T.R, cibles = T.b.filter(q => !q.dedans && q.id !== 0 && (J.groupe ? (T.b.some(o => !o.dedans && groupe(o.id) === J.groupe) ? groupe(q.id) === J.groupe : q.id === 8) : q.id !== 8));
  const l = [];
  for(const c of cibles) for(const p of T.poches){
    // viser un peu à l'intérieur de la poche
    const px = clamp(p.x, R, T.L - R), py = clamp(p.y, R, T.l - R), dx = px - c.x, dy = py - c.y, d2 = Math.hypot(dx, dy);
    const gx = c.x - dx / d2 * 2 * R, gy = c.y - dy / d2 * 2 * R, d1 = Math.hypot(gx - bx, gy - by);
    const cosCoupe = ((gx - bx) * dx + (gy - by) * dy) / (d1 * d2);
    if(cosCoupe < .2) continue;
    if(!libre(T, bx, by, gx, gy, [0, c.id]) || !libre(T, c.x, c.y, px, py, [0, c.id])) continue;
    const facile = cosCoupe ** 2 / (1 + d1 * .8 + d2 * .6);
    l.push({ c, angle:Math.atan2(gy - by, gx - bx), v:clamp(1.1 + (d1 + d2 / Math.max(.3, cosCoupe)) * 1.15, 1.1, 4.6), facile });
  }
  return l.sort((a, b) => b.facile - a.facile);
}
function jouerRobot(){
  if(!G || G.fin || G.phase !== 'robot') return;
  const N = NIVEAUX[G.niveau], T = G.T, J = joueur();
  let choix = null;
  if(G.jeu === 'pool'){
    if(G.casse){ choix = { angle:Math.atan2(T.l / 2 - boule(0).y, T.L * .75 - boule(0).x) + (Math.random() - .5) * .01, v:VMAX + .8 }; }
    else {
      // boule en main : chercher la meilleure place
      if(G.enMain){
        let mieux = null;
        for(let i = 1; i < 14; i++) for(let j = 1; j < 7; j++){
          const x = T.L * i / 14, y = T.l * j / 7; if(!placeValide(x, y)) continue;
          const c = coupsPool(T, J, x, y)[0]; if(c && (!mieux || c.facile > mieux.f)) mieux = { x, y, f:c.facile };
        }
        if(mieux){ const q = boule(0); q.x = mieux.x; q.y = mieux.y; }
      }
      const q = boule(0), l = coupsPool(T, J, q.x, q.y);
      if(l.length){
        if(N.simule){
          // l'expert essaie ses meilleurs coups (sans erreur) et garde celui qui rentre et laisse la blanche sur la table
          let mieux = null;
          for(const c of l.slice(0, 6)) for(const k of [.8, 1, 1.25]){
            const S = Ph.cloner(T); Ph.frapper(S, 0, c.angle, c.v * k); const ev = Ph.simuler(S, 0);
            const ok = !ev.poches.includes(0) && ev.premier === c.c.id && ev.poches.some(id => id === c.c.id);
            const suite = ok ? coupsPool(S, J, S.b[0].x, S.b[0].y).length : 0, note = (ok ? 10 : 0) + Math.min(5, suite) + c.facile;
            if(!mieux || note > mieux.note) mieux = { ...c, v:c.v * k, note };
          }
          choix = mieux;
        } else choix = l[Math.floor(Math.random() * Math.min(N.choix, l.length))];
      } else {
        // pas de coup direct : toucher une de ses boules, sans forcer
        const cibles = T.b.filter(o => !o.dedans && o.id !== 0 && (J.groupe ? groupe(o.id) === J.groupe || (T.b.every(x => x.dedans || groupe(x.id) !== J.groupe) && o.id === 8) : o.id !== 8));
        const c = cibles.sort((a, b) => Math.hypot(a.x - q.x, a.y - q.y) - Math.hypot(b.x - q.x, b.y - q.y))[0] || T.b.find(o => !o.dedans && o.id);
        choix = { angle:Math.atan2(c.y - q.y, c.x - q.x), v:2 };
      }
    }
  } else {
    // billard français : essayer des directions et des forces, garder un coup qui fait le point
    const id = blanche(), q = boule(id), pasA = G.niveau === 'facile' ? 4 : G.niveau === 'moyen' ? 2.5 : 1.5, oks = [];
    for(let a = 0; a < 360; a += pasA) for(const v of [1.6, 2.4, 3.3]){
      const S = Ph.cloner(T), ang = a * Math.PI / 180; Ph.frapper(S, id, ang, v); const ev = Ph.simuler(S, id, 8, 1 / 220);
      if(ev.touchees.length >= 2) oks.push({ angle:ang, v, marge:0 });
    }
    // un coup est sûr si les directions voisines marchent aussi
    for(const o of oks) o.marge = oks.filter(x => x.v === o.v && Math.abs(x.angle - o.angle) < pasA * 2.5 * Math.PI / 180).length;
    oks.sort((a, b) => b.marge - a.marge);
    if(oks.length) choix = oks[G.niveau === 'facile' ? Math.floor(Math.random() * Math.min(6, oks.length)) : 0];
    else { const r = boule(2); choix = { angle:Math.atan2(r.y - q.y, r.x - q.x) + .05, v:2.2 }; }
  }
  // l'erreur du robot, puis il vise (on voit la queue tourner) et frappe
  const cible = choix.angle + (Math.random() - .5) * 2 * N.bruit * (G.casse ? .3 : 1), v = choix.v * (1 + (Math.random() - .5) * N.bruit * 4);
  const depart = G.angle, t0 = performance.now();
  let d = cible - depart; while(d > Math.PI) d -= 2 * Math.PI; while(d < -Math.PI) d += 2 * Math.PI;
  G.robotVise = { t0, depart, d, v };
  dire(`${J.nom} vise…`, 3);
}
function animerRobot(){
  const R = G.robotVise; if(!R) return;
  const u = clamp((performance.now() - R.t0) / 1100, 0, 1), e = u * u * (3 - 2 * u);
  G.angle = R.depart + R.d * e;
  G.force = u > .75 ? (u - .75) / .25 * clamp(R.v / VMAX, .15, 1) : 0;
  if(u >= 1){ G.robotVise = null; G.phase = 'viser'; frapper(R.v); }
}

/* ---------- Chaque image ---------- */
function boucle(now){
  if(!G) return;
  const dt = Math.min(.05, (now - G.dernier) / 1000); G.dernier = now;
  if(!G.pause){
    if(G.phase === 'roule') rouler(dt);
    if(G.phase === 'robot') animerRobot();
    if(G.msgT > 0){ G.msgT -= dt; if(G.msgT <= 0) $('message').classList.remove('vu'); }
  }
  dessiner();
  raf = requestAnimationFrame(boucle);
}

/* ---------- Le dessin ---------- */
const cv = $('cv'), g = cv.getContext('2d');
let W = 0, Hh = 0, DPR = 1, V = null;
const BOIS = .085;          // la largeur du bois autour du tapis (m)
function taille(){ DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || innerWidth; Hh = cv.clientHeight || innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); if(G) calculerVue(); }
addEventListener('resize', taille); if(window.visualViewport) visualViewport.addEventListener('resize', taille); taille();
// où est la table sur l'écran : en hauteur, la grande bande est verticale ; à droite, la barre de force
function calculerVue(){
  const T = G.T, haut = ($('hud').offsetHeight || 60) + 8 + ($('hud').offsetTop || 0), bas = ($('commandes').offsetHeight || 110) + 10, droite = 62, gauche = 10;
  const portrait = Hh > W, Lp = T.L + 2 * BOIS, lp = T.l + 2 * BOIS, aw = W - gauche - droite, ah = Hh - haut - bas;
  const S = portrait ? Math.min(aw / lp, ah / Lp) : Math.min(aw / Lp, ah / lp);
  const lw = (portrait ? lp : Lp) * S, lh = (portrait ? Lp : lp) * S, x0 = gauche + (aw - lw) / 2, y0 = haut + (ah - lh) / 2;
  V = { portrait, S, x0, y0, lw, lh, barre:{ x:W - droite + 12, y:y0 + 10, w:38, h:lh - 20 } };
  // le repère : (x, y) de la table → écran
  if(portrait) V.m = [0, S, -S, 0, x0 + (T.l + BOIS) * S, y0 + BOIS * S];
  else V.m = [S, 0, 0, S, x0 + BOIS * S, y0 + BOIS * S];
}
const versEcran = (x, y) => [V.m[0] * x + V.m[2] * y + V.m[4], V.m[1] * x + V.m[3] * y + V.m[5]];
function versTable(sx, sy){ const [a, b, c, d, e, f] = V.m, det = a * d - b * c, X = sx - e, Y = sy - f; return [(d * X - c * Y) / det, (-b * X + a * Y) / det]; }
function dessiner(){
  const T = G.T, R = T.R, S = V.S;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.fillStyle = '#1B1410'; g.fillRect(0, 0, W, Hh);
  g.setTransform(DPR * V.m[0], DPR * V.m[1], DPR * V.m[2], DPR * V.m[3], DPR * V.m[4], DPR * V.m[5]);
  const tab = Ph.TABLES[G.jeu];
  // le bois, le tapis, les bandes
  const gb = g.createLinearGradient(-BOIS, 0, T.L + BOIS, 0); gb.addColorStop(0, '#6B3A1E'); gb.addColorStop(.5, '#8A4C26'); gb.addColorStop(1, '#6B3A1E');
  g.fillStyle = gb; g.beginPath(); g.roundRect(-BOIS, -BOIS, T.L + 2 * BOIS, T.l + 2 * BOIS, .05); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .006; g.stroke();
  const gt = g.createRadialGradient(T.L / 2, T.l / 2, .1, T.L / 2, T.l / 2, T.L * .7); gt.addColorStop(0, tab.tapis); gt.addColorStop(1, tab.tapis2);
  g.fillStyle = gt; g.fillRect(-.03, -.03, T.L + .06, T.l + .06);
  // les mouches (losanges) sur le bois
  g.fillStyle = '#F2E6C8';
  for(let k = 1; k < 8; k++){ if(k === 4) continue; for(const y of [-BOIS / 2, T.l + BOIS / 2]) losange(T.L * k / 8, y); }
  for(let k = 1; k < 4; k++) for(const x of [-BOIS / 2, T.L + BOIS / 2]) losange(x, T.l * k / 4);
  if(G.jeu === 'pool'){
    g.fillStyle = '#F2E6C8'; for(const y of [-BOIS / 2, T.l + BOIS / 2]) losange(T.L / 2, y);
    // la ligne de casse et le point du triangle
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = .004; g.beginPath(); g.moveTo(T.L / 4, 0); g.lineTo(T.L / 4, T.l); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(T.L * .75, T.l / 2, .006, 0, 7); g.fill();
    // les poches
    for(const p of T.poches){ g.fillStyle = '#0B0B0B'; g.beginPath(); g.arc(p.x, p.y, p.r * .92, 0, 7); g.fill(); g.strokeStyle = '#3A2414'; g.lineWidth = .008; g.stroke(); }
  } else {
    g.fillStyle = 'rgba(255,255,255,.3)'; for(const [x, y] of [[T.L / 4, T.l / 2], [T.L * .75, T.l / 2], [T.L / 2, T.l / 2]]){ g.beginPath(); g.arc(x, y, .005, 0, 7); g.fill(); }
  }
  // les bandes (un peu plus foncées que le tapis)
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = .02; g.lineCap = 'round';
  for(const [x1, y1, x2, y2] of T.seg){ g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  // la zone où placer la blanche
  if(G.enMain && G.phase === 'viser' && !joueur().robot){
    g.fillStyle = 'rgba(255,255,255,.06)'; if(G.casse) g.fillRect(0, 0, T.L / 4, T.l);
  }
  // la prévision du coup
  if((G.phase === 'viser' && !joueur().robot) || G.phase === 'robot') dessinerPrevision();
  // les boules (et leur ombre)
  for(const q of T.b){ if(q.dedans) continue; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(q.x + R * .25, q.y + R * .3, R, 0, 7); g.fill(); }
  for(const q of T.b) if(!q.dedans) dessinerBoule(q);
  // la queue
  if(G.phase === 'viser' || G.phase === 'robot') dessinerQueue();
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  dessinerBarre();
}
function losange(x, y){ const s = .009; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x, y - s * .6); g.lineTo(x + s, y); g.lineTo(x, y + s * .6); g.closePath(); g.fill(); }
function dessinerBoule(q){
  const R = G.T.R, id = q.id;
  let c = G.jeu === 'pool' ? COUL[id > 8 ? id - 8 : id] : ['#F7F5EE', '#F2D14A', '#D7261E'][id];
  const raye = G.jeu === 'pool' && id > 8;
  g.save(); g.beginPath(); g.arc(q.x, q.y, R, 0, 7); g.clip();
  g.fillStyle = raye ? '#F7F5EE' : c; g.fillRect(q.x - R, q.y - R, 2 * R, 2 * R);
  if(raye){ g.fillStyle = c; g.fillRect(q.x - R, q.y - R * .55, 2 * R, R * 1.1); }
  if(G.jeu === 'pool' && id > 0){ g.fillStyle = '#F7F5EE'; g.beginPath(); g.arc(q.x, q.y, R * .45, 0, 7); g.fill(); }
  // le reflet
  const lum = g.createRadialGradient(q.x - R * .35, q.y - R * .4, R * .05, q.x, q.y, R * 1.05);
  lum.addColorStop(0, 'rgba(255,255,255,.75)'); lum.addColorStop(.35, 'rgba(255,255,255,.08)'); lum.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = lum; g.fillRect(q.x - R, q.y - R, 2 * R, 2 * R);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .0025; g.beginPath(); g.arc(q.x, q.y, R, 0, 7); g.stroke();
  if(G.jeu === 'pool' && id > 0){
    // le numéro, toujours à l'endroit sur l'écran
    g.save(); g.translate(q.x, q.y); if(V.portrait) g.rotate(-Math.PI / 2);
    g.fillStyle = '#151515'; g.font = `700 ${R * .62}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(id, 0, R * .04); g.restore();
  }
  if(G.jeu === 'carambole' && id === 0){ g.fillStyle = '#151515'; g.beginPath(); g.arc(q.x + R * .3, q.y - R * .2, R * .14, 0, 7); g.fill(); }
}
function dessinerPrevision(){
  // la ligne suit le vrai trajet de la blanche : avec la force choisie (ou une force moyenne tant qu'on n'a pas tiré la queue) et l'effet
  const T = G.T, R = T.R, id = blanche(), choisie = G.robotVise ? G.robotVise.v : G.force > .03 ? vitesse(G.force) : 0;
  const P = Ph.prevoir(T, id, G.angle, choisie || vitesse(.6), G.effet.a, G.effet.b);
  g.save(); g.lineWidth = .0045; g.strokeStyle = 'rgba(255,255,255,.85)'; g.setLineDash([.018, .012]); g.lineJoin = 'round';
  g.beginPath(); P.points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
  // là où la blanche s'arrête (quand la force est choisie)
  if(P.arret && choisie){ g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = .003; g.beginPath(); g.arc(P.arret[0], P.arret[1], R, 0, 7); g.stroke(); }
  if(P.res){
    const r = P.res, [gx, gy] = r.ghost;
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = .0035; g.beginPath(); g.arc(gx, gy, R, 0, 7); g.stroke();
    // le début de la trajectoire de la boule touchée (plus long si elle est prise pleine)
    const lc = .12 + .3 * r.force, ob = boule(r.boule);
    g.strokeStyle = G.jeu === 'pool' ? (r.boule > 8 ? COUL[r.boule - 8] : COUL[r.boule]) : '#FFE27A'; if(r.boule === 8) g.strokeStyle = '#EDEDED';
    g.lineWidth = .007; g.beginPath(); g.moveTo(ob.x, ob.y); g.lineTo(ob.x + r.dirCible[0] * lc, ob.y + r.dirCible[1] * lc); g.stroke();
    g.fillStyle = g.strokeStyle; const ax = ob.x + r.dirCible[0] * lc, ay = ob.y + r.dirCible[1] * lc, px = -r.dirCible[1], py = r.dirCible[0];
    g.beginPath(); g.moveTo(ax + r.dirCible[0] * .02, ay + r.dirCible[1] * .02); g.lineTo(ax + px * .012, ay + py * .012); g.lineTo(ax - px * .012, ay - py * .012); g.fill();
    // et la direction de la blanche après le choc
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .003; g.setLineDash([.01, .01]); g.beginPath(); r.apres.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.setLineDash([]);
  }
  g.restore();
}
function dessinerQueue(){
  const q = boule(blanche()), R = G.T.R, ux = Math.cos(G.angle), uy = Math.sin(G.angle), recul = R * 1.4 + G.force * .28;
  const a = [q.x - ux * recul, q.y - uy * recul], b = [q.x - ux * (recul + 1.3), q.y - uy * (recul + 1.3)];
  g.save(); g.lineCap = 'round';
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .02; g.beginPath(); g.moveTo(a[0] + .012, a[1] + .015); g.lineTo(b[0] + .012, b[1] + .015); g.stroke();
  const gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
  gr.addColorStop(0, '#EDE6D6'); gr.addColorStop(.015, '#2C6FB8'); gr.addColorStop(.03, '#E9D3A6'); gr.addColorStop(.6, '#C79A5B'); gr.addColorStop(.62, '#2B1A10'); gr.addColorStop(1, '#3A2414');
  g.strokeStyle = gr; g.lineWidth = .016; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke();
  g.restore();
}
// la barre de force : tirer la queue en arrière (vers le bas), lâcher pour frapper
function dessinerBarre(){
  const B = V.barre, f = G.force;
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.roundRect(B.x, B.y, B.w, B.h, 14); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1.5; g.stroke();
  const gr = g.createLinearGradient(0, B.y, 0, B.y + B.h); gr.addColorStop(0, '#3DDC84'); gr.addColorStop(.6, '#FFD23F'); gr.addColorStop(1, '#FF4D4D');
  g.fillStyle = gr; g.beginPath(); g.roundRect(B.x + 4, B.y + 4, B.w - 8, (B.h - 8) * f, 10); g.fill();
  // la queue dessinée dans la barre, qui recule
  const qy = B.y + 8 + f * (B.h - 70);
  g.fillStyle = '#E9D3A6'; g.fillRect(B.x + B.w / 2 - 4, qy, 8, 60); g.fillStyle = '#2C6FB8'; g.fillRect(B.x + B.w / 2 - 4, qy, 8, 5);
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '700 11px "Bricolage Grotesque", sans-serif'; g.textAlign = 'center';
  g.fillText(f > 0 ? Math.round(f * 100) + ' %' : 'force', B.x + B.w / 2, B.y + B.h + 16);
}

/* ---------- La petite boule de l'effet ---------- */
const cvE = $('cvEffet'), gE = cvE.getContext('2d');
function dessinerEffet(){
  const s = cvE.width, r = s * .42, c = s / 2, e = G ? G.effet : { a:0, b:0 };
  gE.clearRect(0, 0, s, s);
  const gr = gE.createRadialGradient(c - r * .3, c - r * .35, r * .1, c, c, r); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#C9C4B6');
  gE.fillStyle = gr; gE.beginPath(); gE.arc(c, c, r, 0, 7); gE.fill();
  gE.strokeStyle = 'rgba(0,0,0,.25)'; gE.lineWidth = 2; gE.beginPath(); gE.moveTo(c - r, c); gE.lineTo(c + r, c); gE.moveTo(c, c - r); gE.lineTo(c, c + r); gE.stroke();
  gE.fillStyle = '#E8322F'; gE.beginPath(); gE.arc(c + e.a * r * .8, c - e.b * r * .8, s * .07, 0, 7); gE.fill(); gE.strokeStyle = '#fff'; gE.lineWidth = 2; gE.stroke();
  $('effetTxt').textContent = !G || (Math.abs(e.a) < .1 && Math.abs(e.b) < .1) ? 'Centre' : `${e.b > .15 ? 'Coulé' : e.b < -.15 ? 'Rétro' : ''}${Math.abs(e.b) > .15 && Math.abs(e.a) > .15 ? ' · ' : ''}${e.a > .15 ? 'droite' : e.a < -.15 ? 'gauche' : ''}`;
}
function toucherEffet(e){
  if(!G || G.phase !== 'viser' || joueur().robot) return;
  const r = cvE.getBoundingClientRect(), c = r.width / 2, R = r.width * .42 * .8;
  let a = (e.clientX - r.left - c) / R, b = -(e.clientY - r.top - c) / R; const l = Math.hypot(a, b); if(l > 1){ a /= l; b /= l; }
  G.effet = { a:Math.round(a * 20) / 20, b:Math.round(b * 20) / 20 }; dessinerEffet();
}
cvE.addEventListener('pointerdown', e => { cvE.setPointerCapture(e.pointerId); toucherEffet(e); });
cvE.addEventListener('pointermove', e => { if(e.buttons || e.pointerType === 'touch') toucherEffet(e); });
cvE.addEventListener('dblclick', () => { if(G){ G.effet = { a:0, b:0 }; dessinerEffet(); } });

/* ---------- Les commandes ---------- */
let doigt = null;
const monTour = () => G && !G.fin && !G.pause && G.phase === 'viser' && !joueur().robot;
cv.addEventListener('pointerdown', e => {
  if(!monTour()) return;
  audio();
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  const B = V.barre;
  if(e.clientX >= B.x - 10 && e.clientY >= B.y - 20 && e.clientY <= B.y + B.h + 30){ doigt = { id:e.pointerId, type:'force', y0:e.clientY }; return; }
  const [x, y] = versTable(e.clientX, e.clientY), q = boule(blanche());
  // boule en main : on déplace la blanche en la prenant
  if(G.enMain && Math.hypot(x - q.x, y - q.y) < G.T.R * 3 + 12 / V.S){ doigt = { id:e.pointerId, type:'blanche', dx:q.x - x, dy:q.y - y }; return; }
  doigt = { id:e.pointerId, type:'viser' }; viserVers(x, y);
});
cv.addEventListener('pointermove', e => {
  if(!doigt || e.pointerId !== doigt.id || !monTour()) return;
  if(doigt.type === 'force'){ G.force = clamp((e.clientY - doigt.y0) / (V.barre.h * .85), 0, 1); return; }
  const [x, y] = versTable(e.clientX, e.clientY);
  if(doigt.type === 'blanche'){
    const q = boule(0), T = G.T, nx = clamp(x + doigt.dx, T.R, (G.casse ? T.L / 4 : T.L) - T.R), ny = clamp(y + doigt.dy, T.R, T.l - T.R);
    if(placeValide(nx, ny)){ q.x = nx; q.y = ny; }
    return;
  }
  viserVers(x, y);
});
const lacher = e => {
  if(!doigt || e.pointerId !== doigt.id) return;
  const d = doigt; doigt = null;
  if(d.type === 'force' && monTour()){ const f = G.force; if(f > .03) tirer(f); else G.force = 0; }
};
cv.addEventListener('pointerup', lacher); cv.addEventListener('pointercancel', e => { if(doigt && doigt.type === 'force' && G) G.force = 0; doigt = null; });
cv.addEventListener('contextmenu', e => e.preventDefault());
function viserVers(x, y){ const q = boule(blanche()); if(Math.hypot(x - q.x, y - q.y) > G.T.R * .5) G.angle = Math.atan2(y - q.y, x - q.x); }
// le réglage fin : ◀ ▶ (on peut rester appuyé) et la molette
let repet = null;
function tourner(da){ if(monTour()) G.angle += da; }
for(const [id, s] of [['bFinG', -1], ['bFinD', 1]]){
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); let n = 0; tourner(s * .0012); repet = setInterval(() => { n++; tourner(s * (n > 12 ? .004 : .0012)); }, 70); });
  for(const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, () => { clearInterval(repet); repet = null; });
}
const molette = $('molette'); let mol = null;
molette.addEventListener('pointerdown', e => { molette.setPointerCapture(e.pointerId); mol = e.clientX; });
molette.addEventListener('pointermove', e => { if(mol == null) return; const dx = e.clientX - mol; mol = e.clientX; tourner(dx * .0009); molette.style.backgroundPositionX = (parseFloat(molette.style.backgroundPositionX) || 0) + dx + 'px'; });
for(const t of ['pointerup', 'pointercancel']) molette.addEventListener(t, () => { mol = null; });
addEventListener('keydown', e => {
  if(!G) return;
  if(e.code === 'ArrowLeft' || e.code === 'ArrowRight'){ e.preventDefault(); tourner((e.code === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? .0008 : .006)); }
  if(e.code === 'Escape'){ if(G.pause) reprendre(); else pause(); }
});

/* ---------- Le haut de l'écran ---------- */
function majHud(){
  if(!G) return;
  $('hud').innerHTML = G.joueurs.map((j, i) => {
    let info;
    if(G.jeu === 'carambole') info = `<b>${j.points}</b><small>/ ${OBJ_CARAMBOLE} · série ${j.serie}</small>`;
    else if(j.groupe){
      const ids = j.groupe === 'pleines' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      info = `<span class="billes">${ids.map(id => `<i class="${boule(id).dedans ? 'rentree' : ''}" style="background:${COUL[id > 8 ? id - 8 : id]}${id > 8 ? ';box-shadow:inset 0 0 0 2.5px #F7F5EE' : ''}"></i>`).join('')}</span>`;
    } else info = `<small>${G.casse ? 'casse' : 'table ouverte'}</small>`;
    return `<div class="joueur ${i === G.tour ? 'actif' : ''}"><span class="nom">${j.robot ? '🤖' : '🎱'} ${esc(j.nom)}</span>${info}</div>`;
  }).join('') + '<button class="pause" id="bPause" aria-label="Pause">⏸</button>';
  $('bPause').onclick = pause;
}
function pause(){ if(!G || G.fin) return; G.pause = true; $('ePause').hidden = false; }
function reprendre(){ if(!G) return; G.pause = false; G.dernier = performance.now(); $('ePause').hidden = true; }
function quitter(){ G = null; cancelAnimationFrame(raf); ['ePause', 'eFin'].forEach(id => $(id).hidden = true); $('hud').hidden = $('commandes').hidden = true; menu(); }

/* ---------- Le menu ---------- */
let choixJeu = lire('billard-jeu', 'pool'), choixMode = lire('billard-mode', 'robot'), choixNiveau = lire('billard-niveau', 'moyen');
function menu(){
  const rec = lire('billard-records', {});
  document.querySelectorAll('[data-jeu]').forEach(b => b.classList.toggle('actif', b.dataset.jeu === choixJeu));
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('actif', b.dataset.mode === choixMode));
  document.querySelectorAll('[data-niveau]').forEach(b => { const r = rec[choixJeu] || { v:{}, d:{} }; b.classList.toggle('actif', b.dataset.niveau === choixNiveau); b.querySelector('small').textContent = `${r.v[b.dataset.niveau] || 0} V · ${r.d[b.dataset.niveau] || 0} D`; });
  $('niveaux').hidden = choixMode !== 'robot'; $('noms').hidden = choixMode !== 'deux';
  const r = rec[choixJeu];
  $('recTxt').textContent = r && r.parties ? `${r.parties} partie${r.parties > 1 ? 's' : ''}${choixJeu === 'carambole' && r.serie ? ` · meilleure série : ${r.serie} points` : ''}` : 'Pas encore joué';
  $('bSon').textContent = son ? '🔊' : '🔇';
  $('eMenu').hidden = false;
}
$('eMenu').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.jeu){ choixJeu = b.dataset.jeu; ecrire('billard-jeu', choixJeu); menu(); }
  if(b.dataset.mode){ choixMode = b.dataset.mode; ecrire('billard-mode', choixMode); menu(); }
  if(b.dataset.niveau){ choixNiveau = b.dataset.niveau; ecrire('billard-niveau', choixNiveau); menu(); }
});
$('bJouer').onclick = () => lancer({ jeu:choixJeu, mode:choixMode, niveau:choixNiveau, nom1:$('nom1').value.trim(), nom2:$('nom2').value.trim() });
$('bSon').onclick = () => { son = !son; ecrire('billard-son', son); $('bSon').textContent = son ? '🔊' : '🔇'; if(son) audio(); };
$('bAide').onclick = () => { $('eMenu').hidden = true; $('eAide').hidden = false; };
$('bAideRetour').onclick = () => { $('eAide').hidden = true; $('eMenu').hidden = false; };
$('bReprendre').onclick = reprendre; $('bQuitter').onclick = quitter;
$('bRecommencer').onclick = () => { $('ePause').hidden = true; if(dernierLancement) lancer(dernierLancement); };
$('bRejouer').onclick = () => { $('eFin').hidden = true; if(dernierLancement) lancer(dernierLancement); };
$('bMenu').onclick = quitter;
document.addEventListener('visibilitychange', () => { if(document.hidden) pause(); });
$('hud').hidden = $('commandes').hidden = true;
menu();
dessinerEffet();
window.Billard = { lancer, get partie(){ return G; }, tirer, jouerRobot, finPartie, versEcran, versTable, Ph };
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
