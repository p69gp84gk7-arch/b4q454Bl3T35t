/* Starship : le programme. Les écrans (la base, le vol, les résultats), les dessins et le pilotage au doigt.
   La logique (gestion, physique du vol) est dans sim.js. */
(() => {
'use strict';
const S = window.STARSHIP_SIM, $ = id => document.getElementById(id);
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
const debloque = i => i === 0 || ((R.niveaux[S.JALONS[i - 1].id] || {}).etoiles || 0) > 0;
const totalEtoiles = () => S.JALONS.reduce((a, j) => a + ((R.niveaux[j.id] || {}).etoiles || 0), 0);
const franchis = () => S.JALONS.filter(j => ((R.niveaux[j.id] || {}).etoiles || 0) > 0).length;
const etoilesTxt = (n, max = 3) => '★'.repeat(n) + '☆'.repeat(max - n);
let niveauEnCours = 0;
const ecran = id => { ['eAccueil', 'eNiveaux', 'eVol'].forEach(e => $(e).hidden = e !== id); window.scrollTo(0, 0); if(id === 'eNiveaux') requestAnimationFrame(niveaux); };
const voile = (id, on) => { $(id).hidden = !on; };

/* ---------- Les dessins : l'acier, la flamme, les tours ---------- */
const rondRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
// un véhicule dessiné depuis sa base (le point de contact avec le sol) : le corps monte vers −y ; th tourne autour de la base
function vehicule(g, kind, bx, by, h, th, o = {}){
  g.save(); g.translate(bx, by); g.rotate(th * Math.PI / 180);
  const w = kind === 'booster' ? h * .17 : kind === 'hop' ? h * .5 : h * .19, acier = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  acier.addColorStop(0, '#8C97A6'); acier.addColorStop(.3, '#F2F5F9'); acier.addColorStop(.55, '#D6DCE5'); acier.addColorStop(1, '#7E8997');
  const flam = (o.gaz || 0), bas = 0;
  // la flamme
  if(flam > .02){
    const L = h * (.28 + .5 * flam) * (.88 + Math.random() * .22), ww = w * (.55 + .35 * flam);
    const d = g.createLinearGradient(0, 0, 0, L); d.addColorStop(0, 'rgba(255,255,240,.95)'); d.addColorStop(.25, 'rgba(255,196,90,.9)'); d.addColorStop(.7, 'rgba(255,100,30,.45)'); d.addColorStop(1, 'rgba(255,60,20,0)');
    g.fillStyle = d; g.beginPath(); g.moveTo(-ww / 2, -2); g.quadraticCurveTo(-ww * .5, L * .55, 0, L); g.quadraticCurveTo(ww * .5, L * .55, ww / 2, -2); g.closePath(); g.fill();
    const r = g.createRadialGradient(0, 4, 2, 0, 4, w * 1.6); r.addColorStop(0, 'rgba(255,200,120,.45)'); r.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = r; g.fillRect(-w * 1.6, -w, w * 3.2, w * 3);
  }
  // les jambes d'atterrissage
  if(o.jambes){ g.strokeStyle = '#9AA5B4'; g.lineWidth = Math.max(1.5, h * .02); g.lineCap = 'round'; for(const s of [-1, 1]){ g.beginPath(); g.moveTo(s * w * .35, -h * .1); g.lineTo(s * w * 1.05, h * .03); g.stroke(); } g.fillStyle = '#5C6674'; for(const s of [-1, 1]) g.fillRect(s * w * 1.05 - h * .035, h * .02, h * .07, h * .02); }
  if(kind === 'hop'){
    // le petit prototype : un réservoir trapu avec un dôme, et trois jambes
    g.strokeStyle = '#8C97A6'; g.lineWidth = Math.max(2, h * .04); for(const s of [-1, 0, 1]){ g.beginPath(); g.moveTo(s * w * .3, -h * .1); g.lineTo(s * w * .62, 0); g.stroke(); }
    g.fillStyle = acier; rondRect(g, -w / 2, -h * .88, w, h * .78, w * .1); g.fill();
    g.beginPath(); g.moveTo(-w / 2, -h * .86); g.quadraticCurveTo(0, -h * 1.1, w / 2, -h * .86); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,50,70,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w / 2, -h * .5); g.lineTo(w / 2, -h * .5); g.stroke();
  } else if(kind === 'booster'){
    g.fillStyle = acier; rondRect(g, -w / 2, -h, w, h, w * .12); g.fill();
    g.fillStyle = '#4A5463'; g.fillRect(-w / 2, -h, w, h * .035); g.fillRect(-w / 2, -h * .62, w, h * .018);
    // les ailerons de guidage en haut, les moteurs en bas
    g.fillStyle = '#3C4656'; for(const s of [-1, 1]){ g.beginPath(); g.moveTo(s * w / 2, -h * .97); g.lineTo(s * w * 1.1, -h * .93); g.lineTo(s * w * 1.1, -h * .88); g.lineTo(s * w / 2, -h * .86); g.closePath(); g.fill(); }
    g.fillStyle = '#2E3541'; for(const s of [-.3, 0, .3]){ g.beginPath(); g.moveTo(s * w - w * .12, -2); g.lineTo(s * w + w * .12, -2); g.lineTo(s * w + w * .2, h * .035); g.lineTo(s * w - w * .2, h * .035); g.closePath(); g.fill(); }
  } else {
    // le vaisseau : un cylindre d'acier, un nez en ogive, deux ailerons devant et deux derrière, des tuiles noires sur le ventre
    const n = h * .22;
    g.fillStyle = acier; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + n); g.bezierCurveTo(-w / 2, -h + n * .35, -w * .18, -h, 0, -h); g.bezierCurveTo(w * .18, -h, w / 2, -h + n * .35, w / 2, -h + n); g.lineTo(w / 2, 0); g.closePath(); g.fill();
    g.save(); g.clip(); const tuiles = g.createLinearGradient(w * .05, 0, w / 2, 0); tuiles.addColorStop(0, 'rgba(20,24,36,0)'); tuiles.addColorStop(.35, 'rgba(20,24,36,.82)'); tuiles.addColorStop(1, 'rgba(8,10,18,.95)'); g.fillStyle = tuiles; g.fillRect(w * .05, -h, w, h);
    g.strokeStyle = 'rgba(120,130,150,.28)'; g.lineWidth = .8; for(let y = -h; y < 0; y += h * .045){ g.beginPath(); g.moveTo(w * .1, y); g.lineTo(w / 2, y); g.stroke(); } g.restore();
    g.strokeStyle = 'rgba(40,50,70,.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w / 2, -h * .3); g.lineTo(w / 2, -h * .3); g.moveTo(-w / 2, -h * .62); g.lineTo(w / 2, -h * .62); g.stroke();
    g.fillStyle = '#5E6A7C'; for(const s of [-1, 1]){
      g.beginPath(); g.moveTo(s * w / 2, -h + n * 1.15); g.lineTo(s * w * 1.0, -h + n * 1.0); g.lineTo(s * w * 1.0, -h + n * 1.5); g.lineTo(s * w / 2, -h + n * 1.6); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(s * w / 2, -h * .22); g.lineTo(s * w * 1.35, -h * .02); g.lineTo(s * w * 1.35, h * .02); g.lineTo(s * w / 2, -h * .02); g.closePath(); g.fill();
    }
  }
  // la chaleur de la rentrée : une lueur sur le ventre (le côté droit)
  if(o.chaleur > .05){
    const c = clamp(o.chaleur, 0, 1), r = g.createLinearGradient(w * .3, 0, w * 1.6 + h * .1 * c, 0); r.addColorStop(0, `rgba(255,${Math.round(220 - 120 * c)},${Math.round(120 - 80 * c)},${.55 * c + .15})`); r.addColorStop(1, 'rgba(255,60,120,0)');
    g.fillStyle = r; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, -h); g.lineTo(w * 1.7 + h * .1 * c, -h * .7); g.lineTo(w * 1.7 + h * .1 * c, -h * .1); g.closePath(); g.fill();
  }
  g.restore();
}
// la tour de lancement : un treillis, et deux bras qui attrapent le vaisseau en vol
function tour(g, x, sol, s, bras, fermes){
  const larg = 7 * s, haut = 150 * s, yb = bras ? sol - bras.y * s : null;
  g.fillStyle = '#58626F'; g.strokeStyle = '#8E99A8'; g.lineWidth = Math.max(1, s * .5);
  g.fillRect(x - larg / 2, sol - haut, larg * .25, haut); g.fillRect(x + larg / 2 - larg * .25, sol - haut, larg * .25, haut);
  g.beginPath(); for(let y = sol; y > sol - haut; y -= 9 * s){ g.moveTo(x - larg / 2, y); g.lineTo(x + larg / 2, y - 9 * s); g.moveTo(x + larg / 2, y); g.lineTo(x - larg / 2, y - 9 * s); } g.stroke();
  g.fillStyle = '#FF6A2B'; g.beginPath(); g.arc(x, sol - haut - 3 * s, Math.max(2, s * 1.2), 0, 7); g.fill();
  if(bras){
    const ouverture = (fermes ? 0 : bras.tol) * s, y0 = yb - 3 * s, e = 3 * s;
    g.fillStyle = '#FF9A3C'; g.fillRect(x - 38 * s, y0, 38 * s - larg / 2, e); // le bras (il part de la tour vers la gauche)
    g.fillStyle = '#FFB86B'; g.fillRect(x - 38 * s - ouverture - 12 * s, y0 - 2 * s, 12 * s, e + 4 * s);
    g.fillStyle = '#FF9A3C'; g.fillRect(x - 38 * s - ouverture - 12 * s, y0 + 2.5 * s, 10 * s, e);
  }
}
function etoiles(g, W, H, t, decalage = 0, n = 70){
  g.fillStyle = '#fff';
  for(let k = 0; k < n; k++){ const x = (k * 137.3) % W, y = (((k * 71.7) % H) + decalage * (.15 + (k % 4) * .12) + H * 4) % H, r = .6 + (k % 3) * .45; g.globalAlpha = (.35 + .65 * Math.abs(Math.sin(t * .8 + k))) * t; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

/* ---------- La base : le dessin et les écrans de gestion ---------- */
function dessinerBase(c, p){
  const g = c.getContext('2d'), W = c.width, H = c.height, sol = H * .83, jalon = p ? p.jalon : 0;
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
  tour(g, tx + 14 * s, sol, s * .95, jalon >= 3 ? { y:68, tol:5 } : null, false);
  const bx = tx - 34 * s;
  if(jalon >= 2){ vehicule(g, 'booster', bx, sol - 8 * s, 112 * s, 0, { jambes:false }); vehicule(g, 'ship', bx, sol - 8 * s - 112 * s, 66 * s, 0, {}); }
  else if(jalon === 1) vehicule(g, 'ship', bx, sol - 8 * s, 62 * s, 0, {});
  else vehicule(g, 'hop', bx, sol - 8 * s, 34 * s, 0, { jambes:true });
  // les prototypes prêts, alignés devant
  g.fillStyle = '#fff'; g.font = `800 ${Math.round(H * .055)}px "Bricolage Grotesque", sans-serif`; g.textAlign = 'left'; g.globalAlpha = .8; g.fillText(p && p.legende ? p.legende : '', W * .06, H * .1); g.globalAlpha = 1;
}
function accueil(){
  const a = $('aStats'), n = totalEtoiles(), max = S.JALONS.length * 3;
  a.innerHTML = `<h3>Le programme</h3><div class="stat"><div><b>${franchis()} / ${S.JALONS.length}</b>jalons franchis</div><div><b>${n} / ${max}</b>étoiles ★</div><div><b>${R.explosions}</b>explosions (on apprend !)</div></div>`;
  $('bContinuer').textContent = R.vols ? '▶ Continuer le programme' : '▶ Commencer par le premier saut';
  dessinerBase($('sceneAcc'), { jalon:Math.min(S.JALONS.length - 1, franchis()), legende:`${n} ★ sur ${max}` });
}
function niveaux(){
  const prochain = Math.min(S.JALONS.length - 1, franchis());
  dessinerBase($('scene'), { jalon:prochain, legende:S.JALONS[prochain].nom });
  $('bandeau').innerHTML = `<div><b>${franchis()} / ${S.JALONS.length}</b>jalons</div><div><b>${totalEtoiles()}</b>étoiles ★</div><div><b>${R.vols}</b>vols</div><div><b>${R.explosions}</b>explosions</div>`;
  $('liste').innerHTML = S.JALONS.map((J, i) => {
    const r = R.niveaux[J.id] || {}, ok = debloque(i);
    return `<button class="niv ${ok ? '' : 'verrou'} ${r.etoiles ? 'fait' : ''}" data-i="${i}" ${ok ? '' : 'disabled'}><span class="ico">${ok ? J.ico : '🔒'}</span><div class="t"><small>Jalon ${i + 1}</small><b>${esc(J.nom)}</b>${r.etoiles ? `<small>Meilleur : ${r.temps ? Math.round(r.temps) + ' s' : '–'} · carburant restant ${r.restant != null ? Math.round(r.restant * 100) + ' %' : '–'}</small>` : `<small>${ok ? esc(J.vol.titre) : 'Franchis le jalon précédent'}</small>`}</div><span class="et">${etoilesTxt(r.etoiles || 0)}</span></button>`;
  }).join('');
  $('liste').querySelectorAll('[data-i]').forEach(b => b.onclick = () => brief(+b.dataset.i));
}
function brief(i){
  const J = S.JALONS[i], r = R.niveaux[J.id] || {}, fait = [r.etoiles >= 1, r.meilleurTemps || false, r.meilleurCarb || false];
  niveauEnCours = i;
  $('fBrief').innerHTML = `<div class="grand">${J.ico}</div><h2>${esc(J.nom)}</h2><p>${esc(J.histoire)}</p><p><b>${esc(J.txt)}</b></p>
    <div class="crit"><div class="${fait[0] ? 'ok' : ''}">${fait[0] ? '★' : '☆'} Réussir le vol</div><div class="${fait[1] ? 'ok' : ''}">${fait[1] ? '★' : '☆'} Terminer en moins de ${J.etoiles.temps} s</div><div class="${fait[2] ? 'ok' : ''}">${fait[2] ? '★' : '☆'} Garder au moins ${Math.round(J.etoiles.carb * 100)} % de carburant</div></div>
    <p class="sous" style="font-size:.8rem">Les étoiles sont des bonus : rien n'est perdu si tu les rates, et tu peux rejouer autant que tu veux.</p>
    <button class="btn gros" id="bDecoller">🚀 Décollage</button><button class="btn" id="bBriefFermer">Retour aux niveaux</button>`;
  voile('vBrief', true); $('bDecoller').onclick = () => { voile('vBrief', false); lancer(i); }; $('bBriefFermer').onclick = () => voile('vBrief', false);
}

/* ---------- Le vol ---------- */
const cv = $('cv'), g = cv.getContext('2d');
let V = null, W = 0, H = 0, dpr = 1, boucle = null, dernier = 0, acc = 0, vitesse = 1, enPause = false, msgVus = 0, bandeauMsg = null, fin = null, parts = [], son = lire('starship-son', true) !== false, entrees = { gauche:false, droite:false, gaz:false, action:false };
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
  niveauEnCours = i; const J = S.JALONS[i];
  V = S.nouveauVol(J.vol, J.equipe, {});
  msgVus = 0; bandeauMsg = null; fin = null; parts = []; vitesse = 1; enPause = false; $('bVitesse').textContent = '⏩ Vitesse ×1';
  ecran('eVol'); tailleVol(); dernier = performance.now(); acc = 0; audio();
  bandeauMsg = { t:J.vol.type === 'booster' ? 'Guide-toi avec ◀ ▶ puis allume pour t\'arrêter à la hauteur des bras' : J.vol.type === 'orbite' || J.vol.type === 'vaisseau' || J.vol.type === 'mars' ? 'Tiens POUSSÉE : suis le fantôme jaune avec ◀ ▶' : 'Tiens POUSSÉE pour décoller', at:0, cls:'' };
  cancelAnimationFrame(boucle); boucle = requestAnimationFrame(tick);
}
function tick(now){
  boucle = requestAnimationFrame(tick);
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
  if(V && V.gaz > .15 && !fin && V.phase !== 'programme' && Math.random() < .8){ const a = V.th * Math.PI / 180; parts.push({ x:V.x - Math.sin(a) * 0, y:Math.max(0, V.y), vx:(Math.random() - .5) * 8 - Math.sin(a) * 15, vy:-(5 + Math.random() * 12) * V.gaz, vie:1.2, t:0, r:2 + Math.random() * 3 + V.gaz * 3, c:'rgba(220,226,236,.5)', g:false }); }
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if(p.g) p.vy -= 9.8 * dt * 2.2; if(p.y < 0){ p.y = 0; p.vy *= -.3; p.vx *= .7; } }
  parts = parts.filter(p => p.t < p.vie);
}
function resultat(){
  const J = S.JALONS[niveauEnCours], n = S.notation(V, J), r = rn(J.id);
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
  const titre = V.fini === 'succes' ? (r.reussis === 1 ? `${J.nom} : franchi !` : 'Vol réussi') : V.fini === 'partiel' ? 'Presque !' : 'Démontage rapide non planifié';
  const stats = V.fini === 'succes' ? `<div class="stat"><div><b>${n.temps.toFixed(0)} s</b>chrono</div><div><b>${Math.round(n.restant * 100)} %</b>carburant restant</div><div><b>${n.conso.toFixed(0)} s</b>de poussée pleine</div>${n.ecart != null ? `<div><b>${n.ecart.toFixed(1)} m</b>écart au centre</div><div><b>${n.vImpact.toFixed(1)} m/s</b>vitesse à l'arrivée</div><div><b>${n.angle.toFixed(1)}°</b>angle</div>` : ''}</div>` : '';
  const crit = V.fini === 'succes' ? `<div class="crit">${n.criteres.map(c => `<div class="${c.ok ? 'ok' : ''}">${c.ok ? '★' : '☆'} ${esc(c.txt)}</div>`).join('')}</div>` : '';
  const suite = i => i < S.JALONS.length && debloque(i);
  $('fResultat').innerHTML = `<div class="grand">${grand}</div><h2>${titre}</h2>${V.fini === 'succes' ? `<div class="etoiles">${etoilesTxt(n.etoiles)}</div>` : ''}<p><b>${esc(V.cause)}</b></p>${crit}${stats}
    ${nouveau.length ? `<div class="gain">${nouveau.map(x => `<span>✨ ${x}</span>`).join('')}</div>` : ''}
    <p>${V.fini === 'echec' ? 'En explosant, on apprend : le programme avance par essais. ' + conseilEchec(V.cause) : V.fini === 'partiel' ? 'Le vaisseau est intact : tu peux réessayer tout de suite.' : n.etoiles < 3 ? 'Les deux autres étoiles sont des bonus : rejoue si tu veux les chercher.' : 'Trois étoiles : parfait !'}</p>
    <button class="btn gros" id="bRejouer">↻ ${V.fini === 'succes' ? 'Rejouer' : 'Réessayer'}</button>${V.fini === 'succes' && suite(niveauEnCours + 1) ? '<button class="btn vert" id="bSuivant">▶ Jalon suivant</button>' : ''}<button class="btn" id="bNiveaux">Les jalons</button>`;
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
function dessinerVol(){
  if(!V) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sp = V.spec, mars = !!sp.g && sp.g < 5, prog = V.phase === 'programme', t = V.t;
  // le ciel : du bleu au noir selon l'altitude
  const altC = prog ? V.y : V.y, k = clamp(altC / (prog ? 90000 : 22000), 0, 1);
  const haut = mars ? mix([36, 18, 22], [3, 3, 8], k) : mix([40, 120, 226], [2, 4, 14], k), bas = mars ? mix([210, 130, 90], [20, 10, 14], k) : mix([170, 216, 255], [10, 20, 50], k);
  const ciel = g.createLinearGradient(0, 0, 0, H); ciel.addColorStop(0, `rgb(${haut})`); ciel.addColorStop(1, `rgb(${bas})`); g.fillStyle = ciel; g.fillRect(0, 0, W, H);
  if(k > .15) etoiles(g, W, H, clamp((k - .15) * 2, 0, 1), V.y * .002);
  const s = prog ? 2.2 : echelleDe(V.y), gy0 = H * .84;
  let vyScr = prog ? H * .62 : clamp(gy0 - V.y * s, H * .32, H * .76), solY = prog ? H + 400 : vyScr + V.y * s;
  const X = x => W / 2 + (x - (prog ? 0 : V.x)) * s, camX = prog ? 0 : V.x;
  if(prog){ // la courbure de la Terre qui s'éloigne
    const R = W * 3, cy = H + R * (1.05 - clamp(V.jauge * 1.1, 0, 1) * .12) * 1 - H * (.12 + V.jauge * .22), terre = g.createRadialGradient(W / 2, cy, R * .94, W / 2, cy, R); terre.addColorStop(0, '#2B6FD0'); terre.addColorStop(.97, '#58A8F0'); terre.addColorStop(1, 'rgba(160,220,255,.9)');
    g.fillStyle = terre; g.beginPath(); g.arc(W / 2, cy, R, 0, 7); g.fill();
  }
  // les nuages (en bas, on passe à travers)
  if(!prog && !mars){ g.fillStyle = 'rgba(255,255,255,.55)'; for(let i = 0; i < 9; i++){ const wy = 600 + i * 900, sy = vyScr + (V.y - wy) * s; if(sy < -60 || sy > H + 60) continue; const wx = ((i * 377) % 900) - 450; for(let j = 0; j < 4; j++){ g.beginPath(); g.ellipse(X(wx + j * 70) , sy + (j % 2) * 8, 70 * s + 30, 20 * s + 10, 0, 0, 7); g.fill(); } } }
  // le sol
  if(!prog && solY < H + 40){
    const sol = g.createLinearGradient(0, solY, 0, H); if(mars){ sol.addColorStop(0, '#C26A3A'); sol.addColorStop(1, '#7A3A20'); } else { sol.addColorStop(0, '#B9A47C'); sol.addColorStop(1, '#6B5A3E'); }
    g.fillStyle = sol; g.fillRect(0, solY, W, H - solY);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, solY, W, 3);
    for(let i = -12; i <= 12; i++){ const gx = X(camX + i * 40 - (camX % 40)); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(gx, solY + 3, 2, H); }
    // la plateforme ou la tour
    if(sp.pad && !sp.tour){ const px = X(sp.pad.x), pw = sp.pad.tol * s; g.fillStyle = '#3C4452'; g.fillRect(px - pw, solY - 2 * s, pw * 2, 2 * s + 3); g.fillStyle = '#FFD23A'; g.fillRect(px - pw, solY - 2 * s, pw * 2, 2); g.fillStyle = '#fff'; g.font = `800 ${Math.max(10, 5 * s)}px sans-serif`; g.textAlign = 'center'; g.fillText('H', px, solY + 8 * s); }
    if(sp.tour){ const tx = X(sp.tour.x + 22); tour(g, tx, solY, s, sp.tour, !!(fin && fin.issue === 'succes')); g.fillStyle = '#3C4452'; g.fillRect(X(sp.tour.x - 15), solY - 1.5 * s, 38 * s, 1.5 * s + 2); }
    // les lignes à suivre : l'allumage et le retournement
    g.setLineDash([8, 6]); g.lineWidth = 2; g.textAlign = 'left'; g.font = '800 12px "Bricolage Grotesque", sans-serif';
    if(V.vy < -4 && !V.fini && (V.phase === 'vol')){ const ya = S.hauteurAllumage(V); if(isFinite(ya) && ya > 0){ const ly = vyScr + (V.y - ya) * s; if(ly > 20 && ly < H){ g.strokeStyle = '#38E08A'; g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke(); g.fillStyle = '#38E08A'; g.fillText('ALLUME ICI', 10, ly - 6); } } }
    if(V.phase === 'plat' && !V.fini){ const yr = S.altitudeRetournement(V); const ly = vyScr + (V.y - yr) * s; if(ly > 20 && ly < H){ g.strokeStyle = '#5AB0FF'; g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke(); g.fillStyle = '#9CCBFF'; g.fillText('RETOURNE-TOI ICI', 10, ly - 6); } }
    g.setLineDash([]);
  }
  // le vaisseau (ou son fantôme)
  const kind = sp.type === 'saut' ? 'hop' : sp.type === 'booster' ? 'booster' : 'ship', hv = kind === 'hop' ? clamp(9 * s, 34, 70) : kind === 'booster' ? clamp(70 * s, 70, 190) : clamp(38 * s, 56, 134);
  const bx = prog ? W / 2 : W / 2, by = prog ? vyScr : vyScr;
  if(prog){ g.globalAlpha = .45; vehicule(g, 'ship', bx + 70, by, hv, S.pitchCible(V.jauge), { gaz:0 }); g.globalAlpha = 1; g.strokeStyle = '#FFD23A'; g.setLineDash([4, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(bx + 70, by); g.lineTo(bx + 70 + Math.sin(S.pitchCible(V.jauge) * Math.PI / 180) * hv, by - Math.cos(S.pitchCible(V.jauge) * Math.PI / 180) * hv); g.stroke(); g.setLineDash([]); g.fillStyle = '#FFD23A'; g.font = '800 11px sans-serif'; g.textAlign = 'center'; g.fillText('trajectoire', bx + 70, by + 16); }
  // la fumée et les débris
  for(const p of parts){ const a = 1 - p.t / p.vie, px = prog ? bx + p.x * s : X(p.x), py = prog ? by - p.y * s : vyScr + (V.y - p.y) * s + (solY - (vyScr + V.y * s)) * 0; const sy = solY - p.y * s; g.globalAlpha = clamp(a, 0, 1) * .9; g.fillStyle = p.c; g.beginPath(); g.arc(px, prog ? py : sy, p.r * (p.g ? 1 : 1 + p.t * 1.6), 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if(!(fin && fin.issue === 'echec')){
    let bxx = bx, byy = by, th = V.th;
    if(!prog && sp.tour && fin && fin.issue === 'succes'){ bxx = X(sp.tour.x); byy = solY - sp.tour.y * s; th = 0; }
    const jambes = !prog && V.phase === 'vol' && V.y < 120 && (sp.pad || sp.tour) && V.retourne !== false;
    vehicule(g, kind, bxx, byy, hv, th, { gaz:V.gaz, chaleur:V.chaleur / V.p.resChaleur, jambes:jambes && sp.type !== 'saut' ? true : sp.type === 'saut' });
  }
  dessinerHUD(sp, prog);
}
function jauge(x, y, w, h, v, c, titre, txt){
  g.fillStyle = 'rgba(0,0,0,.45)'; rondRect(g, x, y, w, h, h / 2); g.fill(); g.fillStyle = c; rondRect(g, x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); g.fill();
  g.fillStyle = '#fff'; g.font = '700 10px "Bricolage Grotesque", sans-serif'; g.textAlign = 'left'; g.fillText(titre, x + 6, y + h - 2.5); if(txt){ g.textAlign = 'right'; g.fillText(txt, x + w - 6, y + h - 2.5); }
}
function texteHUD(t, x, y, taille = 12, couleur = '#fff', align = 'left'){ g.font = `800 ${taille}px "Bricolage Grotesque", sans-serif`; g.textAlign = align; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,20,.75)'; g.lineJoin = 'round'; g.strokeText(t, x, y); g.fillStyle = couleur; g.fillText(t, x, y); }
// un texte centré qui passe à la ligne s'il est trop long ; rend la hauteur prise
function texteLong(t, x, y, taille, couleur){
  g.font = `800 ${taille}px "Bricolage Grotesque", sans-serif`; const max = W - 30, mots = String(t).split(' '), lignes = []; let l = '';
  for(const m of mots){ const essai = l ? l + ' ' + m : m; if(g.measureText(essai).width > max && l){ lignes.push(l); l = m; } else l = essai; }
  lignes.push(l); lignes.forEach((ln, i) => texteHUD(ln, x, y + i * (taille + 4), taille, couleur, 'center')); return lignes.length * (taille + 4);
}
function dessinerHUD(sp, prog){
  const p = V.p, mars = !!sp.g && sp.g < 5, top = 10, L = 12;
  // en haut à gauche : les chiffres
  g.fillStyle = 'rgba(8,12,28,.5)'; rondRect(g, 8, top - 2, 196, prog ? 84 : 100, 12); g.fill();
  texteHUD(sp.titre, L, top + 12, 12, '#FFB347');
  if(prog){
    texteHUD(`Altitude ${fmt(V.y / 1000)} km`, L, top + 30, 12); texteHUD(`Temps ${V.t.toFixed(0)} s`, L, top + 46, 11, '#C8D6EE');
    jauge(L, top + 54, 180, 13, V.jauge, '#38E08A', 'Montée', `${Math.round(V.jauge * 100)} %`);
    jauge(L, top + 70, 180, 11, V.carb, '#5AB0FF', 'Carburant');
    // la barre de progression avec la pression maximale et la séparation
    const bx = 214, by = top + 4, bw = Math.min(W - 230, 340);
    g.fillStyle = 'rgba(8,12,28,.5)'; rondRect(g, bx - 6, by - 4, bw + 12, 62, 12); g.fill();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx, by + 22, bw, 10);
    g.fillStyle = 'rgba(255,77,77,.4)'; g.fillRect(bx + bw * .17, by + 22, bw * .14, 10); texteHUD('pression max', bx + bw * .24, by + 18, 9, '#FF9A9A', 'center');
    g.fillStyle = '#5AB0FF'; g.fillRect(bx + bw * sp.programme.etageA - 1.5, by + 18, 3, 18); texteHUD('séparation', bx + bw * sp.programme.etageA, by + 46, 9, '#9CCBFF', 'center');
    g.fillStyle = '#38E08A'; g.fillRect(bx, by + 22, bw * V.jauge, 10);
    jauge(bx, by + 38, bw * .5, 11, V.contrainte / p.resStructure, V.contrainte / p.resStructure > .7 ? '#FF4D4D' : '#FFB347', 'Contrainte');
    jauge(bx + bw * .52, by + 38, bw * .48, 11, V.gaz, '#FF8A3D', 'Poussée');
  } else {
    texteHUD(`Altitude ${fmt(V.y)} m`, L, top + 30, 13); texteHUD(`Vitesse ↓ ${Math.max(0, -V.vy).toFixed(0)} m/s`, L, top + 46, 11, V.vy < -20 ? '#FFB347' : '#C8D6EE'); texteHUD(`Latéral ${V.vx.toFixed(1)} m/s · angle ${V.th.toFixed(0)}°`, L, top + 61, 11, '#C8D6EE');
    jauge(L, top + 68, 180, 12, V.carb, V.carb < .15 ? '#FF4D4D' : '#5AB0FF', 'Carburant', `${Math.round(V.carb * 100)} %`);
    jauge(L, top + 83, 180, 11, V.gaz, '#FF8A3D', V.phase === 'plat' ? 'Cabrage' : 'Poussée');
    if(V.phase === 'plat') { g.fillStyle = 'rgba(255,138,61,.6)'; g.fillRect(L + 180 * V.attaque - 2, top + 83, 4, 11); }
    if(V.phase === 'plat' || V.phase === 'flip' || V.chaleur > 1){ jauge(214, top + 4, Math.min(W - 230, 200), 13, V.chaleur / p.resChaleur, V.chaleur / p.resChaleur > .75 ? '#FF4D4D' : '#FFB347', 'Chaleur'); }
  }
  // la cible hors de l'écran, et les consignes
  if(!prog && (sp.pad || sp.tour)){ const tx = sp.tour ? sp.tour.x : sp.pad.x, dx = tx - V.x, s = echelleDe(V.y); if(Math.abs(dx) * s > W / 2 - 30){ texteHUD(`${dx > 0 ? '' : '◀ '}${sp.tour ? 'tour' : 'plateforme'} ${Math.abs(dx).toFixed(0)} m${dx > 0 ? ' ▶' : ''}`, dx > 0 ? W - 14 : 14, H * .45, 12, '#9CCBFF', dx > 0 ? 'right' : 'left'); } }
  const info = consigne(sp, prog);
  let dy = 0; if(bandeauMsg && (V.t - bandeauMsg.at < 4.5 || bandeauMsg.at === 0)){ const c = bandeauMsg.cls === 'bon' ? '#7CF0B6' : bandeauMsg.cls === 'mal' ? '#FF9A9A' : '#FFE08A'; dy = texteLong(bandeauMsg.t, W / 2, H * .17, 16, c); }
  if(info) texteLong(info, W / 2, H * .17 + dy + 6, 14, '#fff');
  // le bouton d'action
  const b = $('bAction'); let lib = '—', ok = false;
  if(V.phase === 'programme' && V.etage === 1 && V.fenetre){ lib = 'SÉPARER'; ok = true; }
  else if(V.phase === 'vol' && sp.belly && V.atteint && !V.retourne && V.vy < -3 && V.gaz < .05){ lib = 'BASCULER'; ok = true; }
  else if(V.phase === 'plat' && V.th > 80){ lib = 'RETOURNER'; ok = true; }
  b.textContent = lib; b.disabled = !ok || !!fin;
  $('bPoussee').textContent = V.phase === 'plat' ? 'CABRER' : 'POUSSÉE';
}
function consigne(sp, prog){
  if(fin) return '';
  if(prog) return V.maxQ ? '⚠ Pression maximale : relâche la poussée !' : V.fenetre && V.etage === 1 ? 'Appuie sur SÉPARER au repère' : '';
  if(!V.enVol && V.phase === 'vol' && V.t < 60) return 'POUSSÉE : tiens le bouton pour décoller';
  if(sp.type === 'saut' && !V.atteint) return `Monte à ${sp.cible} m (altitude ${fmt(V.y)} m)`;
  if(sp.type === 'saut' && V.atteint && V.y > 30) return 'Penche (◀ ▶) et pose-toi sur la plateforme jaune';
  if(sp.type === 'altitude' && !V.atteint) return `Apogée prévu ${fmt(S.apogeePrevu(V))} m sur ${fmt(sp.cible)} m`;
  if(V.phase === 'plat') return V.th < 80 ? 'Retournement à plat…' : 'Ailerons ◀ ▶ · CABRER pour freiner · RETOURNE-TOI au repère bleu';
  if(V.phase === 'flip') return 'Redressement ! Prépare l\'allumage';
  if(V.phase === 'vol' && V.vy < -4) return V.y < 12 ? '' : `Allume quand tu touches la ligne verte · vitesse max au sol ${V.p.vAtterr.toFixed(0)} m/s`;
  return '';
}

/* ---------- Les commandes ---------- */
const lie = (id, cle) => { const b = $(id), on = v => { entrees[cle] = v; b.classList.toggle('on', v); };
  b.addEventListener('pointerdown', e => { e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch(x){} on(true); if(cle === 'action') entrees.action = true; audio(); });
  const off = e => { e.preventDefault(); if(cle !== 'action') on(false); else b.classList.remove('on'); };
  b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', () => { if(cle !== 'action') on(false); });
  b.addEventListener('contextmenu', e => e.preventDefault()); };
lie('bGauche', 'gauche'); lie('bDroite', 'droite'); lie('bPoussee', 'gaz'); lie('bAction', 'action');
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
$('bAbandon').onclick = () => { if(!confirm('Abandonner le vol ?')) return; voile('vPause', false); enPause = false; V.gaz = 0; V.fini = 'echec'; V.cause = 'Vol abandonné.'; terminaison(); };
$('bAide').onclick = $('bAide2').onclick = () => voile('vAide', true); $('bAideFermer').onclick = () => voile('vAide', false);
$('bSon').textContent = son ? '🔊 Son' : '🔇 Son coupé';

accueil();
window.Starship = { S, get R(){ return R; }, get V(){ return V; }, lancer, entrees, niveaux, brief };
})();
