/* Escale : les mini-jeux de contrôle, en 3D, au guichet.
   - Passeports (départs) : comparer le passeport, la photo, la carte d'embarquement et le visa aux consignes du jour.
   - Rayons X (sûreté) : repérer les objets interdits sur l'écran du scanner pendant que les bagages défilent.
   - Douane (arrivées) : lire la déclaration, décider d'ouvrir la valise, saisir ce qui n'est pas en règle.
   On les ouvre en touchant le poste dans le terminal. La partie de l'aéroport est en pause pendant ce temps,
   et le mini-jeu n'a pas d'effet sur elle : juste pour s'amuser, avec ses propres records (escale-controle).
   La 3D utilise le moteur de la scène de l'aéroport (ESCALE_3D.kit) : même rendu « dessin animé », même écran. */
window.ESCALE_CONTROLE = (() => {
'use strict';
const M = window.ESCALE_MONDE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const lisse = u => u * u * (3 - 2 * u);
const hasard = (a, b) => a + Math.random() * (b - a);
const entier = (a, b) => Math.floor(hasard(a, b + 1));
const piocher = l => l[Math.floor(Math.random() * l.length)];
const melanger = l => { for(let i = l.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const POLICE = '"Bricolage Grotesque", system-ui, sans-serif';
const DUREE = 180, VIES = 3;

let K = null, T3 = null, scene = null, cam = null, L = 1, H = 1, actif = false, J = null, ui = null, quitter = null;
const groupes = {}, cliquables = [], docs = [];
const camPos = { p:null, l:null, fov:50 };

/* ---------- Petits outils de dessin ---------- */
function toile(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const tex = new T3.CanvasTexture(c); tex.anisotropy = 8; return { c, g, tex, w, h }; }
function rr(g, x, y, w, h, r){ g.beginPath(); if(g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); }
function ecrit(g, s, x, y, px, coul = '#14233A', poids = 800, align = 'left', max = 0){
  g.font = `${poids} ${px}px ${POLICE}`;
  if(max) while(g.measureText(s).width > max && px > 12){ px -= 2; g.font = `${poids} ${px}px ${POLICE}`; }
  g.fillStyle = coul; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
}
const plan = (w, h, tex, opts = {}) => new T3.Mesh(new T3.PlaneGeometry(w, h), new T3.MeshBasicMaterial(Object.assign({ map:tex, side:T3.DoubleSide }, opts)));
const bloc = (pieces, e = .012) => K.objet(pieces, e);
function jeter(o){ if(!o) return; if(o.parent) o.parent.remove(o); o.traverse(x => { if(x.geometry) x.geometry.dispose(); }); }
const date = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const plusJours = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* ---------- Les voyageurs ---------- */
const PEAUX = [0xFFDBAC, 0xF1C27D, 0xE0AC69, 0xC68642, 0x8D5524, 0x5C3A21];
const CHEVEUX = [[0x1B1B1B, 'noirs'], [0x6B4226, 'bruns'], [0xD9B26F, 'blonds'], [0xB5462A, 'roux'], [0xC9CDD2, 'gris']];
const HAUTS = [0xE5383B, 0x1B6EC2, 0x2BA84A, 0xFB8500, 0x6A4C93, 0x14233A, 0xF2C230, 0x8D99AE, 0x0B6E4F, 0xE07A5F];
const PRENOMS = ['Léa', 'Hugo', 'Chloé', 'Lucas', 'Manon', 'Louis', 'Inès', 'Jules', 'Camille', 'Nathan', 'Sarah', 'Tom', 'Emma', 'Noah', 'Zoé', 'Adam', 'Jade', 'Théo', 'Lina', 'Rayan', 'Anna', 'Paul', 'Nina', 'Malo', 'Elsa', 'Yanis', 'Rose', 'Sacha', 'Mila', 'Victor'];
const NOMS = ['MARTIN', 'BERNARD', 'DURAND', 'MOREAU', 'LEFÈVRE', 'GARNIER', 'ROUX', 'FONTAINE', 'CHEVALIER', 'MOREL', 'GIRARD', 'BLANC', 'GUÉRIN', 'MULLER', 'PERRIN', 'FAURE', 'ANDRIEU', 'MARCHAND', 'DUMAS', 'LEMOINE', 'RENAUD', 'BARON', 'CARRÉ', 'VIDAL', 'RIVIÈRE', 'COLIN', 'BRUNET', 'PICARD', 'AUBERT', 'LEROY'];
const PAYS = [['France', '#6D1A36'], ['Valdorie', '#7A1F3D'], ['Kestrie', '#1F4E79'], ['Ostrane', '#2E6B3A'], ['Bralie', '#5B3A86'], ['Morvanie', '#8A5A12'], ['Sélénie', '#14595E'], ['Tarvosie', '#7D2E1F']];
function traits(){ return { peau:piocher(PEAUX), cheveux:entier(0, CHEVEUX.length - 1), coupe:piocher(['court', 'court', 'long', 'chauve']), lunettes:Math.random() < .3, barbe:Math.random() < .25, haut:piocher(HAUTS) }; }
const hex = n => '#' + n.toString(16).padStart(6, '0');
// un voyageur en 3D, tourné vers +z (vers le guichet)
function personne(t){
  const pc = CHEVEUX[t.cheveux][0], p = [
    { f:'cyl', d:[.13, .16, .8, 10], p:[0, .4, 0], c:0x2F3A4A },                         // les jambes (pantalon)
    { f:'cyl', d:[.2, .17, .62, 12], p:[0, 1.08, 0], c:t.haut },                          // le buste
    { f:'boule', d:[.2, 1], p:[0, 1.36, 0], s:[1.05, .45, .8], c:t.haut },                // les épaules
    { f:'cyl', d:[.055, .05, .6, 8], p:[.25, 1.08, 0], r:[0, 0, .12], c:t.haut }, { f:'cyl', d:[.055, .05, .6, 8], p:[-.25, 1.08, 0], r:[0, 0, -.12], c:t.haut },
    { f:'boule', d:[.05, 1], p:[.28, .76, .02], c:t.peau }, { f:'boule', d:[.05, 1], p:[-.28, .76, .02], c:t.peau },
    { f:'cyl', d:[.06, .06, .12, 8], p:[0, 1.48, 0], c:t.peau },                          // le cou
    { f:'boule', d:[.15, 2], p:[0, 1.64, 0], s:[1, 1.12, 1], c:t.peau },                  // la tête
    { f:'boule', d:[.022, 1], p:[.055, 1.66, .135], c:0x1B1B1B }, { f:'boule', d:[.022, 1], p:[-.055, 1.66, .135], c:0x1B1B1B },
    { f:'boule', d:[.026, 1], p:[0, 1.62, .15], c:t.peau },                               // le nez
    { f:'boite', d:[.07, .016, .02], p:[0, 1.56, .14], c:0x8E3B3B },                      // la bouche
    { f:'boule', d:[.03, 1], p:[.15, 1.64, 0], c:t.peau }, { f:'boule', d:[.03, 1], p:[-.15, 1.64, 0], c:t.peau },
  ];
  if(t.coupe !== 'chauve') p.push({ f:'boule', d:[.158, 2], p:[0, 1.7, -.012], s:[1.02, .78, 1.02], c:pc });
  else p.push({ f:'boule', d:[.15, 1], p:[0, 1.62, -.05], s:[1.04, .5, .9], c:pc });
  if(t.coupe === 'long') p.push({ f:'boite', d:[.32, .34, .12], p:[0, 1.5, -.1], c:pc }, { f:'boite', d:[.06, .26, .1], p:[.14, 1.56, .02], c:pc }, { f:'boite', d:[.06, .26, .1], p:[-.14, 1.56, .02], c:pc });
  if(t.barbe) p.push({ f:'boule', d:[.12, 1], p:[0, 1.55, .07], s:[1.05, .78, .75], c:pc });
  if(t.lunettes) p.push({ f:'cyl', d:[.042, .042, .012, 14], p:[.058, 1.665, .148], r:[Math.PI / 2, 0, 0], c:0x14233A }, { f:'cyl', d:[.042, .042, .012, 14], p:[-.058, 1.665, .148], r:[Math.PI / 2, 0, 0], c:0x14233A },
    { f:'cyl', d:[.032, .032, .014, 14], p:[.058, 1.665, .152], r:[Math.PI / 2, 0, 0], c:0x9FC5E0 }, { f:'cyl', d:[.032, .032, .014, 14], p:[-.058, 1.665, .152], r:[Math.PI / 2, 0, 0], c:0x9FC5E0 },
    { f:'boite', d:[.03, .01, .01], p:[0, 1.67, .15], c:0x14233A });
  return bloc(p);
}
// la photo d'identité, dessinée d'après les traits
function photo(g, t, x, y, w, h){
  g.save(); rr(g, x, y, w, h, 8); g.fillStyle = '#DCE6EE'; g.fill(); g.clip();
  const cx = x + w / 2, cy = y + h * .46, r = w * .26, pc = hex(CHEVEUX[t.cheveux][0]);
  g.fillStyle = '#8D99AE'; g.beginPath(); g.ellipse(cx, y + h * 1.02, w * .46, h * .32, 0, 0, Math.PI * 2); g.fill();
  if(t.coupe === 'long'){ g.fillStyle = pc; rr(g, cx - r * 1.12, cy - r * .5, r * 2.24, r * 2.1, r * .5); g.fill(); }
  g.fillStyle = hex(t.peau); g.beginPath(); g.ellipse(cx, cy, r, r * 1.15, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx - r, cy + 2, r * .2, 0, Math.PI * 2); g.arc(cx + r, cy + 2, r * .2, 0, Math.PI * 2); g.fill();
  g.fillStyle = pc;
  if(t.coupe !== 'chauve'){ g.beginPath(); g.ellipse(cx, cy - r * .45, r * 1.04, r * .78, 0, Math.PI, 0); g.fill(); g.fillRect(cx - r * 1.04, cy - r * .5, r * 2.08, r * .14); }
  else { g.beginPath(); g.ellipse(cx - r * .92, cy, r * .14, r * .4, 0, 0, Math.PI * 2); g.ellipse(cx + r * .92, cy, r * .14, r * .4, 0, 0, Math.PI * 2); g.fill(); }
  if(t.barbe){ g.beginPath(); g.ellipse(cx, cy + r * .62, r * .82, r * .55, 0, 0, Math.PI); g.fill(); }
  g.fillStyle = '#1B1B1B'; g.beginPath(); g.arc(cx - r * .38, cy + r * .02, r * .1, 0, Math.PI * 2); g.arc(cx + r * .38, cy + r * .02, r * .1, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8E3B3B'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - r * .25, cy + r * .58); g.lineTo(cx + r * .25, cy + r * .58); g.stroke();
  if(t.lunettes){ g.strokeStyle = '#14233A'; g.lineWidth = 4; g.beginPath(); g.arc(cx - r * .38, cy + r * .02, r * .27, 0, Math.PI * 2); g.moveTo(cx + r * .65, cy + r * .02); g.arc(cx + r * .38, cy + r * .02, r * .27, 0, Math.PI * 2); g.moveTo(cx - r * .11, cy); g.lineTo(cx + r * .11, cy); g.stroke(); }
  g.restore();
}

// une étiquette qui fait toujours face à la caméra
function etiquette(txt, coul = '#14233A', fond = '#FFFFFF'){
  const t = toile(320, 80); rr(t.g, 3, 3, 314, 74, 18); t.g.fillStyle = fond; t.g.fill(); t.g.strokeStyle = coul; t.g.lineWidth = 5; t.g.stroke(); ecrit(t.g, txt, 160, 42, 40, coul, 900, 'center', 290);
  const s = new T3.Sprite(new T3.SpriteMaterial({ map:t.tex, depthTest:false })); s.scale.set(.2, .05, 1); s.renderOrder = 20; return s;
}

/* ---------- Les documents posés sur le guichet (on les touche pour les lire en grand) ---------- */
function doc(t, w, h, pos, rot, parent){
  const m = plan(w, h, t.tex); m.position.set(...pos); m.rotation.set(...rot); parent.add(m);
  const d = { m, w, h, t, z:0, cible:false, p0:m.position.clone(), q0:m.quaternion.clone(), parent };
  m.userData.clic = () => { const z = !d.cible; for(const o of docs) o.cible = false; d.cible = z; };
  docs.push(d); cliquables.push(m); return d;
}
function majDocs(dt){
  if(!docs.length) return;
  const dir = new T3.Vector3(), up = new T3.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), t = Math.tan(cam.fov * Math.PI / 360);
  cam.getWorldDirection(dir);
  for(const d of docs){
    if(!d.m.visible) continue;
    d.z = clamp(d.z + (d.cible ? 1 : -1) * dt * 5, 0, 1);
    if(!d.z){ d.m.position.copy(d.p0); d.m.quaternion.copy(d.q0); d.m.renderOrder = 0; continue; }
    const dist = Math.max(d.w / (.92 * 2 * t * cam.aspect), d.h / (.56 * 2 * t)), vh = 2 * dist * t;
    const cible = cam.position.clone().addScaledVector(dir, dist).addScaledVector(up, -vh * .16);
    d.parent.worldToLocal(cible);
    const q = d.parent.getWorldQuaternion(new T3.Quaternion()).invert().multiply(cam.quaternion);
    const u = lisse(d.z);
    d.m.position.lerpVectors(d.p0, cible, u); d.m.quaternion.slerpQuaternions(d.q0, q, u); d.m.renderOrder = 10;
  }
}
// une feuille posée sur un pupitre incliné (pour qu'elle ne s'enfonce pas dans le bureau)
const pose = (x, y, z, h, incl) => [x, y + h / 2 * Math.sin(incl) + .004, z];
// la caméra recule assez pour que toute la largeur voulue tienne à l'écran (téléphone en hauteur)
function recul(l, dir, fov, asp, largeur, dmin){
  const n = Math.hypot(...dir), d = Math.max(dmin, largeur / 2 / (Math.tan(fov * Math.PI / 360) * asp));
  return { p:l.map((v, i) => v + dir[i] / n * d), l, fov };
}

/* ---------- L'écran : la barre du haut, les messages, les boutons, les cartes ---------- */
function creerUi(){
  if(ui) return;
  const el = document.createElement('div'); el.className = 'mini'; el.hidden = true;
  el.innerHTML = `<div class="mHaut"><b class="mTitre"></b><span class="mTemps"></span><span class="mScore"></span><span class="mVies"></span><button class="mQuit" aria-label="Quitter">✕</button></div>
    <div class="mConsigne"></div><div class="mMsg"></div><div class="mBas"></div><div class="mCarte" hidden></div>`;
  document.body.append(el);
  ui = { el, titre:el.querySelector('.mTitre'), temps:el.querySelector('.mTemps'), score:el.querySelector('.mScore'), vies:el.querySelector('.mVies'), consigne:el.querySelector('.mConsigne'), msg:el.querySelector('.mMsg'), bas:el.querySelector('.mBas'), carte:el.querySelector('.mCarte') };
  el.querySelector('.mQuit').onclick = () => fermer();
}
let tMsg = 0;
function dire(txt, type = 'info', duree = 2.8){ ui.msg.textContent = txt; ui.msg.className = 'mMsg vu ' + type; tMsg = duree; }
function consigne(txt){ ui.consigne.textContent = txt; ui.consigne.hidden = !txt; }
function boutons(l){
  ui.bas.innerHTML = '';
  for(const b of l){ const e = document.createElement('button'); e.className = 'mBtn ' + (b.cls || ''); e.textContent = b.t; e.onclick = () => { if(J && !J.fini) b.fn(); }; ui.bas.append(e); }
}
function majHaut(){
  ui.temps.textContent = `⏱ ${Math.floor(J.temps / 60)}:${String(Math.floor(J.temps % 60)).padStart(2, '0')}`;
  ui.score.textContent = `⭐ ${J.score}`;
  ui.vies.textContent = '❤️'.repeat(J.vies) + '🖤'.repeat(VIES - J.vies);
}

/* ---------- Le déroulé commun : une carte d'accueil, un service de 3 minutes, 3 erreurs permises ---------- */
const JEUX = {};
function bon(pts, txt){ J.score += pts; J.bons++; J.total++; dire(`✅ ${txt} · +${pts}`, 'ok'); majHaut(); }
function faute(txt){ J.vies--; J.total++; dire(`❌ ${txt}`, 'ko', 4.2); majHaut(); if(J.vies <= 0) finir('Trop d\'erreurs : ton chef te remplace au guichet.'); }
function points(pts, txt, type = 'ok'){ J.score = Math.max(0, J.score + pts); dire(`${pts >= 0 ? '✅' : '⚠️'} ${txt} · ${pts >= 0 ? '+' : ''}${pts}`, type); majHaut(); }
function carte(html, btns){
  ui.carte.innerHTML = html + '<div class="mCarteBtns"></div>'; ui.carte.hidden = false;
  const box = ui.carte.querySelector('.mCarteBtns');
  for(const b of btns){ const e = document.createElement('button'); e.className = 'mBtn ' + (b.cls || ''); e.textContent = b.t; e.onclick = b.fn; box.append(e); }
}
function accueillir(type){
  const G = JEUX[type], R = lire('escale-controle', {})[type];
  J = null; boutons([]); consigne(''); ui.msg.className = 'mMsg';
  carte(`<h2>${G.ico} ${G.titre}</h2>${G.regles}<p class="mRec">${R ? `🏆 Ton record : <b>${R.best}</b> points (${R.parties} service${R.parties > 1 ? 's' : ''})` : 'Un service dure 3 minutes. 3 erreurs, et c\'est fini.'}</p>`,
    [{ t:'▶️ Prendre mon poste', cls:'prim', fn:() => commencer(type) }, ...autrePoste(), { t:'↩️ Retour à l\'aéroport', fn:() => fermer() }]);
}
// aux départs, on choisit son poste de travail : passeports, rayons X ou portique
const POSTES_DEPART = ['passeports', 'securite', 'portique'];
let choix = false;
const autrePoste = () => choix ? [{ t:'🔄 Changer de poste', fn:choisirPoste }] : [];
function changer(type){
  for(const k in JEUX) JEUX[k].cacher();
  enCours = type; JEUX[type].montrer(); for(const d of docs) d.cible = false;
  ui.titre.textContent = `${JEUX[type].ico} ${JEUX[type].titre}`; cadrer(1);
}
function choisirPoste(){
  J = null; boutons([]); consigne(''); ui.msg.className = 'mMsg';
  const tous = lire('escale-controle', {});
  carte(`<h2>👮 Choisis ton poste</h2><p>Où veux-tu travailler pour ce service ?</p>`,
    [...POSTES_DEPART.map(t => ({ t:`${JEUX[t].ico} ${JEUX[t].titre}${tous[t] ? ` · 🏆 ${tous[t].best}` : ''}`, cls:'choix', fn:() => { changer(t); accueillir(t); } })), { t:'↩️ Retour à l\'aéroport', fn:() => fermer() }]);
}
function commencer(type){
  ui.carte.hidden = true;
  J = { type, temps:DUREE, score:0, vies:VIES, bons:0, total:0, n:0, fini:false, t:0 };
  for(const d of docs) d.cible = false;
  JEUX[type].debut(J); majHaut();
}
// le record de chaque poste (aussi quand on quitte en cours de service)
function noter(){
  const tous = lire('escale-controle', {}), R = tous[J.type] || { best:0, parties:0 };
  tous[J.type] = { best:Math.max(R.best, J.score), parties:R.parties + 1, dernier:Date.now() }; ecrire('escale-controle', tous);
  return R;
}
function finir(pourquoi){
  if(!J || J.fini) return;
  J.fini = true; boutons([]); for(const d of docs) d.cible = false;
  const R = noter(), record = J.score > R.best;
  const G = JEUX[J.type];
  setTimeout(() => carte(`<h2>${G.ico} Fin du service</h2><p>${pourquoi}</p><p class="mGros">⭐ ${J.score} points</p><p>${J.bons} contrôle${J.bons > 1 ? 's' : ''} réussi${J.bons > 1 ? 's' : ''} sur ${J.total}.</p><p class="mRec">${record ? '🏆 <b>Nouveau record !</b>' : `🏆 Record : <b>${R.best}</b>`}</p>`,
    [{ t:'🔁 Rejouer', cls:'prim', fn:() => commencer(J.type) }, ...autrePoste(), { t:'↩️ Retour à l\'aéroport', fn:() => fermer() }]), 900);
}

/* ---------- Le décor commun ---------- */
function sol(gr, c1 = 0xDDE3EA, c2 = 0xE9EDF2){
  const p = [];
  for(let x = -6; x < 6; x++) for(let z = -8; z < 4; z++) p.push({ f:'boite', d:[1, .02, 1], p:[x + .5, -.01, z + .5], c:(x + z) & 1 ? c1 : c2 });
  gr.add(new T3.Mesh(K.fusion(p), K.MAT));
}
function mur(gr, z, c, txt, fond){
  gr.add(bloc([{ f:'boite', d:[14, 4, .2], p:[0, 2, z], c }, { f:'boite', d:[14, .3, .22], p:[0, 3.2, z + .02], c:0x5C6672 }], .02));
  if(txt){ const t = toile(1024, 160); rr(t.g, 6, 6, 1012, 148, 24); t.g.fillStyle = fond; t.g.fill(); ecrit(t.g, txt, 512, 84, 84, '#FFFFFF', 900, 'center', 960); const m = plan(3.2, .5, t.tex); m.position.set(0, 2.75, z + .12); gr.add(m); }
}
function figurants(gr, n, z0, z1, x0, x1){
  for(let i = 0; i < n; i++){ const f = personne(traits()); f.position.set(hasard(x0, x1), 0, lerp(z0, z1, i / Math.max(1, n - 1))); f.rotation.y = hasard(-.3, .3); gr.add(f); }
}
function lumieres(gr){ gr.add(new T3.HemisphereLight(0xFFFFFF, 0x667788, .85)); const d = new T3.DirectionalLight(0xFFF4DE, .55); d.position.set(.6, 1.4, 1); gr.add(d); }
// la marche d'un personnage d'un point à un autre (avec un petit balancement)
function marcher(o, x0, z0, x1, z1, duree, fin){ o.userData.marche = { x0, z0, x1, z1, t:0, duree, fin }; }
function majMarche(o, dt){
  const m = o && o.userData.marche; if(!m) return;
  m.t += dt; const u = clamp(m.t / m.duree, 0, 1);
  o.position.x = lerp(m.x0, m.x1, lisse(u)); o.position.z = lerp(m.z0, m.z1, lisse(u)); o.position.y = u < 1 ? Math.abs(Math.sin(m.t * 9)) * .035 : 0;
  if(u >= 1){ o.userData.marche = null; if(m.fin) m.fin(); }
}

/* =====================================================================================================
   1) LE CONTRÔLE DES PASSEPORTS (départs)
   ===================================================================================================== */
JEUX.passeports = (() => {
  let gr = null, pax = null, D = {}, auj = null, visas = [], tDecide = 0, attente = 0;
  const CONSIGNES = [
    [0, 'Le passeport doit être encore valable aujourd\'hui (regarde la date d\'expiration).'],
    [0, 'Le nom doit être le même sur le passeport et sur la carte d\'embarquement.'],
    [4, 'La photo du passeport doit ressembler au voyageur (cheveux, lunettes, barbe).'],
    [8, 'Visa obligatoire pour les voyageurs de certains pays (voir la liste).'],
  ];
  const actives = n => CONSIGNES.filter(c => n >= c[0]);
  function construire(){
    gr = new T3.Group(); lumieres(gr); sol(gr);
    mur(gr, -5.5, 0x98A8BC, 'Contrôle des passeports · Départs', '#3D5A80');
    // la cabine : le guichet, la vitre, le cadre, l'écran, la lampe, le tampon
    gr.add(bloc([
      { f:'boite', d:[2.4, .95, 1.9], p:[0, .475, .8], c:0x3D5A80 }, { f:'boite', d:[2.5, .05, 2], p:[0, .975, .8], c:0xB9C4D0 },
      { f:'boite', d:[2.5, .2, .1], p:[0, 1.08, -.12], c:0x2A3F5F },
      { f:'boite', d:[.08, 1.3, .1], p:[-1.22, 1.75, -.15], c:0x2A3F5F }, { f:'boite', d:[.08, 1.3, .1], p:[1.22, 1.75, -.15], c:0x2A3F5F }, { f:'boite', d:[2.52, .1, .12], p:[0, 2.42, -.15], c:0x2A3F5F },
      { f:'boite', d:[.4, .29, .03], p:[-.5, 1.235, .0], r:[-.15, 0, 0], c:0x1E2A38 }, { f:'boite', d:[.08, .14, .06], p:[-.5, 1.05, .03], c:0x5C6672 },
      { f:'cyl', d:[.06, .07, .05, 12], p:[.66, 1.025, .1], c:0x8C949F }, { f:'cyl', d:[.035, .035, .1, 8], p:[.66, 1.1, .1], c:0x2A3F5F }, { f:'boule', d:[.05, 1], p:[.66, 1.17, .1], c:0xD7263D },
    ], .015));
    const vitre = new T3.Mesh(new T3.PlaneGeometry(2.36, 1.24), new T3.MeshBasicMaterial({ color:0xBFD9EA, transparent:true, opacity:.16, depthWrite:false }));
    vitre.position.set(0, 1.78, -.15); gr.add(vitre);
    // la file des autres voyageurs, derrière, entre les sangles
    const poteaux = [];
    for(let k = 0; k < 4; k++){ const z = -2.3 - k * .9; poteaux.push({ f:'cyl', d:[.04, .04, 1, 6], p:[-1.4, .5, z], c:0xB9BEC6 }, { f:'cyl', d:[.04, .04, 1, 6], p:[1.4, .5, z], c:0xB9BEC6 }, { f:'boite', d:[2.8, .08, .02], p:[0, .88, z], c:0x3D5A80 }); }
    gr.add(bloc(poteaux, .01));
    figurants(gr, 4, -2.8, -5, -.9, .9);
    // les documents : les consignes, le passeport, la carte d'embarquement, le visa, l'écran du jour
    const I = .45, R = [-Math.PI / 2 + I, 0, 0];
    D.regles = doc(toile(512, 720), .27, .38, pose(-.47, 1.0, .78, .38, I), [R[0], 0, .06], gr);
    D.passeport = doc(toile(768, 512), .4, .267, pose(-.05, 1.0, .86, .267, I), R, gr);
    D.carte = doc(toile(768, 330), .3, .129, pose(.38, 1.0, .92, .129, I), [R[0], 0, -.06], gr);
    D.visa = doc(toile(560, 400), .24, .171, pose(.37, 1.0, .66, .171, I), [R[0], 0, .06], gr);
    D.ecran = doc(toile(640, 440), .36, .2475, [-.5, 1.235, .02], [-.15, 0, 0], gr);
    scene.add(gr);
  }
  function dessinerRegles(){
    const t = D.regles.t, g = t.g;
    g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = '#3D5A80'; g.fillRect(0, 0, t.w, 96);
    ecrit(g, '📋 Consignes du jour', 256, 50, 40, '#FFFFFF', 900, 'center', 480);
    ecrit(g, `Aujourd'hui : ${date(auj)}`, 256, 136, 34, '#C1121F', 900, 'center', 480);
    let y = 200;
    for(const [, c] of actives(J ? J.n : 0)){
      const mots = c.split(' '); let ligne = '• ';
      for(const m of mots){ g.font = `700 27px ${POLICE}`; if(g.measureText(ligne + m).width > 460){ ecrit(g, ligne, 26, y, 27, '#14233A', 700); y += 36; ligne = '  '; } ligne += m + ' '; }
      ecrit(g, ligne, 26, y, 27, '#14233A', 700); y += 52;
    }
    if(J && J.n >= 8){ ecrit(g, 'Visa obligatoire :', 26, y, 30, '#C1121F', 900); y += 42; for(const v of visas){ ecrit(g, `🛂 ${v}`, 46, y, 30, '#14233A', 800); y += 40; } }
    t.tex.needsUpdate = true;
  }
  function dessinerPasseport(tampon){
    const t = D.passeport.t, g = t.g, v = pax.v, coul = PAYS.find(p => p[0] === v.pays)[1];
    g.fillStyle = '#F6F1E3'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = coul; g.fillRect(0, 0, t.w, 70);
    ecrit(g, `PASSEPORT · ${v.pays.toUpperCase()}`, 24, 37, 38, '#F6E7B0', 900, 'left', 720);
    photo(g, v.photo, 26, 94, 220, 280);
    const champ = (lib, val, y, rouge) => { ecrit(g, lib, 272, y, 22, '#6B7785', 700); ecrit(g, val, 272, y + 30, 34, rouge ? '#C1121F' : '#14233A', 900, 'left', 480); };
    champ('Nom', v.nom, 100); champ('Prénom', v.prenom, 172); champ('Nationalité', v.pays, 244); champ('Né(e) le', date(v.naissance), 316);
    ecrit(g, 'Expire le', 26, 412, 24, '#6B7785', 700); ecrit(g, date(v.expire), 26, 452, 42, '#14233A', 900);
    ecrit(g, `N° ${v.numero}`, 470, 452, 30, '#6B7785', 800);
    g.fillStyle = 'rgba(20,35,58,.08)'; for(let k = 0; k < 2; k++) g.fillRect(0, 486 + k * 12, t.w, 6);
    if(tampon){ g.save(); g.translate(560, 300); g.rotate(-.25); g.strokeStyle = g.fillStyle = tampon === 'ok' ? '#2BA84A' : '#C1121F'; g.lineWidth = 8; rr(g, -150, -55, 300, 110, 16); g.stroke(); ecrit(g, tampon === 'ok' ? 'ACCEPTÉ' : 'REFUSÉ', 0, 4, 58, g.fillStyle, 900, 'center'); g.restore(); }
    t.tex.needsUpdate = true;
  }
  function dessinerCarte(){
    const t = D.carte.t, g = t.g, v = pax.v, C = M.COMPAGNIES[v.comp];
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = C.c1; g.fillRect(0, 0, t.w, 64);
    ecrit(g, `${C.ico} ${C.nom} · Carte d'embarquement`, 20, 34, 32, '#FFFFFF', 900, 'left', 720);
    ecrit(g, 'Passager', 24, 96, 22, '#6B7785', 700); ecrit(g, `${v.nomCarte} ${v.prenomCarte}`, 24, 130, 38, '#14233A', 900, 'left', 500);
    ecrit(g, 'Vol', 24, 186, 22, '#6B7785', 700); ecrit(g, v.vol, 24, 218, 34, '#14233A', 900);
    ecrit(g, 'Vers', 210, 186, 22, '#6B7785', 700); ecrit(g, v.dest, 210, 218, 34, '#14233A', 900, 'left', 330);
    ecrit(g, 'Date', 24, 266, 22, '#6B7785', 700); ecrit(g, date(auj), 24, 298, 30, '#14233A', 900);
    ecrit(g, 'Porte', 270, 266, 22, '#6B7785', 700); ecrit(g, v.porte, 270, 298, 30, '#14233A', 900);
    g.strokeStyle = '#B9BEC6'; g.setLineDash([10, 8]); g.lineWidth = 3; g.beginPath(); g.moveTo(560, 70); g.lineTo(560, 320); g.stroke(); g.setLineDash([]);
    for(let k = 0; k < 26; k++){ g.fillStyle = '#14233A'; g.fillRect(590 + k * 6.4, 110, k % 3 ? 3 : 5, 160); }
    t.tex.needsUpdate = true;
  }
  function dessinerVisa(){
    const t = D.visa.t, g = t.g, v = pax.v;
    D.visa.m.visible = !!v.visa;
    if(!v.visa) return;
    g.fillStyle = '#E8F4EA'; g.fillRect(0, 0, t.w, t.h); g.strokeStyle = '#2E6B3A'; g.lineWidth = 10; g.strokeRect(5, 5, t.w - 10, t.h - 10);
    for(let k = 0; k < 9; k++){ g.strokeStyle = 'rgba(46,107,58,.12)'; g.lineWidth = 2; g.beginPath(); g.arc(t.w - 90, 110, 30 + k * 12, 0, Math.PI * 2); g.stroke(); }
    ecrit(g, 'VISA · Zone Escale', 30, 54, 40, '#2E6B3A', 900);
    ecrit(g, 'Titulaire', 30, 120, 22, '#6B7785', 700); ecrit(g, `${v.visa.nom} ${v.prenom}`, 30, 156, 36, '#14233A', 900, 'left', 500);
    ecrit(g, 'Nationalité', 30, 214, 22, '#6B7785', 700); ecrit(g, v.pays, 30, 248, 32, '#14233A', 900);
    ecrit(g, 'Valable jusqu\'au', 30, 306, 22, '#6B7785', 700); ecrit(g, date(v.visa.fin), 30, 346, 40, '#14233A', 900);
    t.tex.needsUpdate = true;
  }
  function dessinerEcran(){
    const t = D.ecran.t, g = t.g, v = pax && pax.v;
    g.fillStyle = '#0E1A2B'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = '#1B4E8C'; g.fillRect(0, 0, t.w, 70);
    ecrit(g, 'PAF · Poste 2', 24, 36, 34, '#FFFFFF', 900);
    ecrit(g, 'Aujourd\'hui', 24, 120, 30, '#8ECAE6', 700); ecrit(g, date(auj), 24, 172, 62, '#FFB703', 900);
    if(v){ ecrit(g, 'Vol à l\'embarquement', 24, 250, 28, '#8ECAE6', 700); ecrit(g, `${v.vol} → ${v.dest}`, 24, 296, 40, '#FFFFFF', 900, 'left', 590); ecrit(g, `Porte ${v.porte}`, 24, 350, 34, '#FFFFFF', 800); }
    ecrit(g, `Voyageur n° ${(J ? J.n : 0) + 1}`, 24, 406, 26, '#8ECAE6', 700);
    t.tex.needsUpdate = true;
  }
  const VOYELLES = 'AEIOU';
  function alterer(nom){
    const l = [...nom], idx = l.map((c, i) => VOYELLES.includes(c) ? i : -1).filter(i => i > 0);
    if(idx.length && Math.random() < .7){ const i = piocher(idx); l[i] = piocher([...VOYELLES].filter(c => c !== l[i])); return l.join(''); }
    return piocher(NOMS.filter(n => n !== nom));
  }
  // un nouveau voyageur : ses papiers sont en règle… ou pas (selon les consignes déjà données)
  function nouveau(){
    const n = J.n, tr = traits(), dests = [...M.VILLES.moyen, ...M.VILLES.long].filter(v => !['Pointe-à-Pitre', 'La Réunion'].includes(v[0]));
    const comp = piocher(Object.keys(M.COMPAGNIES)), dest = piocher(dests);
    const v = { pays:piocher(PAYS)[0], nom:piocher(NOMS), prenom:piocher(PRENOMS), naissance:new Date(entier(1945, 2008), entier(0, 11), entier(1, 28)), numero:String(entier(10, 99)) + 'XK' + String(entier(10000, 99999)),
      comp, vol:`${M.COMPAGNIES[comp].code} ${entier(100, 989)}`, dest:dest[0], porte:'A' + String(entier(1, 12)).padStart(2, '0'), photo:{ ...tr } };
    v.expire = plusJours(auj, Math.random() < .25 ? entier(1, 25) : entier(30, 3200));
    v.nomCarte = v.nom; v.prenomCarte = v.prenom;
    if(n >= 8 && visas.includes(v.pays)) v.visa = { nom:v.nom, fin:plusJours(auj, entier(3, 300)) };
    // la fraude (environ un voyageur sur deux, une seule à la fois)
    const fraudes = ['expire', 'nom']; if(n >= 4) fraudes.push('photo'); if(n >= 8) fraudes.push('visa', 'visa');
    let fraude = null;
    if(Math.random() < .48){
      fraude = piocher(fraudes);
      if(fraude === 'expire') v.expire = plusJours(auj, -(Math.random() < .45 ? entier(1, 20) : entier(21, 700)));
      if(fraude === 'nom'){ if(Math.random() < .75) v.nomCarte = alterer(v.nom); else v.prenomCarte = piocher(PRENOMS.filter(p => p !== v.prenom)); }
      if(fraude === 'photo'){
        const k = piocher(['cheveux', 'lunettes', 'barbe', 'coupe']);
        if(k === 'cheveux') v.photo.cheveux = (tr.cheveux + entier(1, CHEVEUX.length - 1)) % CHEVEUX.length;
        else if(k === 'coupe') v.photo.coupe = piocher(['court', 'long', 'chauve'].filter(c => c !== tr.coupe));
        else v.photo[k] = !tr[k];
      }
      if(fraude === 'visa'){
        v.pays = piocher(visas);
        const s = Math.random(); v.visa = s < .45 ? null : s < .8 ? { nom:v.nom, fin:plusJours(auj, -entier(1, 90)) } : { nom:alterer(v.nom), fin:plusJours(auj, entier(3, 200)) };
      }
    }
    v.fraude = fraude;
    jeter(pax && pax.obj);
    const obj = personne(tr); obj.position.set(-2.6, 0, -.85); gr.add(obj);
    pax = { v, obj, decide:false };
    dessinerPasseport(); dessinerCarte(); dessinerVisa(); dessinerEcran();
    D.passeport.m.visible = D.carte.m.visible = D.visa.m.visible = false; for(const d of docs) d.cible = false;
    marcher(obj, -2.6, -.85, 0, -.85, 1.3, () => { D.passeport.m.visible = D.carte.m.visible = true; D.visa.m.visible = !!v.visa; tDecide = 0; boutonsDecision(); });
    boutons([]);
  }
  const RAISONS = {
    expire:v => `le passeport a expiré le ${date(v.expire)}`,
    nom:v => `le nom de la carte (${v.nomCarte} ${v.prenomCarte}) n'est pas celui du passeport`,
    photo:() => 'la photo ne correspond pas au voyageur',
    visa:v => !v.visa ? `les voyageurs de ${v.pays} ont besoin d'un visa` : v.visa.fin < auj ? `le visa a expiré le ${date(v.visa.fin)}` : 'le nom du visa n\'est pas le bon',
  };
  function decider(ok){
    if(!pax || pax.decide || pax.obj.userData.marche) return;
    pax.decide = true; pax.ok = ok; boutons([]); for(const d of docs) d.cible = false;
    dessinerPasseport(ok ? 'ok' : 'ko');
    const v = pax.v, bonne = ok === !v.fraude, rapide = Math.max(0, Math.round(60 - tDecide * 4));
    if(bonne) bon(100 + rapide, ok ? 'Papiers en règle, bon voyage !' : `Bien vu : ${RAISONS[v.fraude](v)}.`);
    else faute(ok ? `Il fallait refuser : ${RAISONS[v.fraude](v)}.` : 'Il fallait accepter : tout était en règle.');
    if(J.fini) return;
    D.passeport.cible = true;
    attente = 1.4;
  }
  function boutonsDecision(){ boutons([{ t:'⛔ Refuser', cls:'rouge', fn:() => decider(false) }, { t:'✅ Tamponner', cls:'vert', fn:() => decider(true) }]); }
  return {
    ico:'🛂', titre:'Contrôle des passeports',
    regles:`<p>Tu es à la police aux frontières. Pour chaque voyageur, vérifie ses papiers avec les <b>consignes du jour</b>, puis <b>tamponne</b> ou <b>refuse</b>.</p><ul><li>👆 Touche un document pour le lire en grand, touche-le encore pour le reposer.</li><li>📅 Regarde la date d'aujourd'hui sur l'écran et les consignes.</li><li>🆕 De nouvelles consignes arrivent pendant le service.</li></ul>`,
    camera:asp => asp < .9 ? recul([0, 1.32, -.3], [0, 1.05, 2.2], 58, asp, 1.95, 2.5) : recul([0, 1.15, 0], [0, .9, 1.8], 50, asp, 1.6, 2.7),
    montrer(){ if(!gr) construire(); gr.visible = true; },
    cacher(){ if(gr) gr.visible = false; },
    debut(){
      auj = new Date(2027, 2, 1 + entier(0, 300)); visas = melanger(PAYS.slice(1).map(p => p[0])).slice(0, 3);
      dessinerRegles(); pax = null; nouveau(); consigne('Vérifie : la date d\'expiration et le nom sur la carte.');
    },
    maj(dt){
      if(!pax) return;
      majMarche(pax.obj, dt);
      if(!pax.decide && !pax.obj.userData.marche) tDecide += dt;
      if(pax.decide && attente > 0){
        attente -= dt;
        if(attente <= 0){
          for(const d of docs) d.cible = false;
          D.passeport.m.visible = D.carte.m.visible = D.visa.m.visible = false;
          const ok = pax.ok;
          marcher(pax.obj, 0, -.85, ok ? 2.8 : -2.8, ok ? -1.3 : -.85, 1.2, () => {
            if(!J || J.fini) return;
            J.n++;
            const neuve = CONSIGNES.find(c => c[0] === J.n);
            if(neuve){ dessinerRegles(); consigne('🆕 ' + neuve[1]); dire('📋 Nouvelle consigne ! Regarde la feuille des consignes.', 'info', 3.5); D.regles.cible = true; }
            nouveau();
          });
        }
      }
    },
    decider,
    _etat:() => pax && pax.v,
  };
})();

/* =====================================================================================================
   2) LES RAYONS X (sûreté)
   ===================================================================================================== */
JEUX.securite = (() => {
  let gr = null, ecran = null, sac = null, consignesT = null, B = null, etat = 'vide', tEtat = 0;
  const ECH = 1.3;                                  // les objets sont dessinés un peu plus gros que nature, pour le doigt
  const ORG = '#F2A65A', PLA = '#7DC383', MET = '#4C7BE0', DEN = '#22408F';
  const OBJ = {
    couteau:{ nom:'un couteau', w:180, h:40, interdit:0 }, ciseaux:{ nom:'des ciseaux', w:140, h:80, interdit:0 }, bouteille:{ nom:'une bouteille de plus de 100 ml', w:70, h:200, interdit:0 },
    marteau:{ nom:'un marteau', w:90, h:190, interdit:5 }, aerosol:{ nom:'une bombe aérosol', w:56, h:160, interdit:5 }, petards:{ nom:'des pétards', w:120, h:90, interdit:10 },
    ordi:{ nom:'un ordinateur', w:310, h:210 }, telephone:{ nom:'un téléphone', w:60, h:110 }, livre:{ nom:'un livre', w:140, h:180 }, chaussure:{ nom:'une chaussure', w:180, h:76 },
    vetements:{ nom:'des vêtements', w:240, h:160 }, brosse:{ nom:'une brosse à dents', w:26, h:160 }, cles:{ nom:'des clés', w:80, h:70 }, cables:{ nom:'un chargeur', w:120, h:100 },
    flacons:{ nom:'des flacons de 100 ml', w:110, h:96 }, parapluie:{ nom:'un parapluie', w:40, h:240 }, lunettes:{ nom:'des lunettes', w:104, h:40 },
  };
  for(const k in OBJ){ OBJ[k].w *= ECH; OBJ[k].h *= ECH; }
  const INTERDITS = Object.keys(OBJ).filter(k => OBJ[k].interdit != null), PERMIS = Object.keys(OBJ).filter(k => OBJ[k].interdit == null);
  const actifs = n => INTERDITS.filter(k => n >= OBJ[k].interdit);
  const EW = 1024, EH = 900, ZX0 = 90, ZX1 = 934, ZY0 = 170, ZY1 = 830;
  function forme(g, k){
    const r = (x, y, w, h, c, rad = 6) => { g.fillStyle = c; rr(g, x, y, w, h, rad); g.fill(); };
    const e = (x, y, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
    switch(k){
      case 'couteau': g.fillStyle = MET; g.beginPath(); g.moveTo(-10, -14); g.lineTo(90, -4); g.lineTo(76, 14); g.lineTo(-10, 14); g.closePath(); g.fill(); r(-90, -15, 80, 30, ORG, 10); e(-70, 0, 5, 5, DEN); e(-30, 0, 5, 5, DEN); break;
      case 'ciseaux': g.strokeStyle = MET; g.lineWidth = 11; g.beginPath(); g.arc(-48, -18, 18, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(-48, 22, 18, 0, Math.PI * 2); g.stroke();
        g.fillStyle = MET; g.beginPath(); g.moveTo(-30, -14); g.lineTo(72, 10); g.lineTo(70, 18); g.lineTo(-30, -2); g.fill(); g.beginPath(); g.moveTo(-30, 18); g.lineTo(72, -10); g.lineTo(70, -18); g.lineTo(-30, 6); g.fill(); e(0, 2, 7, 7, DEN); break;
      case 'bouteille': r(-32, -60, 64, 156, ORG, 18); r(-14, -92, 28, 40, ORG, 6); r(-17, -100, 34, 16, PLA, 4); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-20, -40, 8, 110); break;
      case 'marteau': r(-9, -60, 18, 152, ORG, 6); r(-42, -94, 84, 34, MET, 6); r(26, -90, 18, 26, DEN, 4); break;
      case 'aerosol': r(-26, -58, 52, 136, MET, 10); r(-18, -74, 36, 18, DEN, 4); r(-6, -82, 12, 10, PLA, 2); g.fillStyle = DEN; g.fillRect(-26, 40, 52, 8); break;
      case 'petards': for(let i = 0; i < 5; i++){ r(-56 + i * 22, -32, 18, 70, i % 2 ? ORG : '#E5383B', 5); g.strokeStyle = DEN; g.lineWidth = 3; g.beginPath(); g.moveTo(-47 + i * 22, -32); g.quadraticCurveTo(-40 + i * 22, -48, -34 + i * 22, -42); g.stroke(); } r(-60, -6, 116, 10, PLA, 3); break;
      case 'ordi': r(-155, -105, 310, 210, PLA, 12); r(-140, -90, 280, 120, 'rgba(76,123,224,.45)', 6); r(-120, 50, 110, 40, DEN, 6); for(let i = 0; i < 6; i++) r(0 + i * 22, 50, 14, 38, MET, 3); break;
      case 'telephone': r(-30, -55, 60, 110, DEN, 10); r(-22, -44, 44, 80, MET, 4); break;
      case 'livre': r(-70, -90, 140, 180, ORG, 6); g.fillStyle = 'rgba(160,80,20,.35)'; for(let i = 0; i < 9; i++) g.fillRect(-58, -70 + i * 17, 116, 4); break;
      case 'chaussure': g.fillStyle = ORG; g.beginPath(); g.moveTo(-90, 30); g.lineTo(-90, -20); g.quadraticCurveTo(-60, -40, -30, -20); g.lineTo(60, 0); g.quadraticCurveTo(92, 8, 90, 38); g.closePath(); g.fill(); r(-88, 26, 176, 12, PLA, 4); r(-60, 24, 50, 8, MET, 2); break;
      case 'vetements': g.fillStyle = 'rgba(242,166,90,.55)'; for(const [x, y, a, b] of [[-60, -30, 70, 55], [40, -20, 85, 60], [-20, 40, 100, 42], [70, 50, 50, 30]]){ g.beginPath(); g.ellipse(x, y, a, b, .3, 0, Math.PI * 2); g.fill(); } r(-20, -70, 12, 12, MET, 6); break;
      case 'brosse': r(-8, -80, 16, 150, PLA, 6); r(-11, -80, 22, 34, 'rgba(76,123,224,.4)', 4); break;
      case 'cles': g.strokeStyle = MET; g.lineWidth = 7; g.beginPath(); g.arc(-18, -14, 16, 0, Math.PI * 2); g.stroke(); r(-4, -14, 46, 9, MET, 2); r(30, -14, 6, 18, MET, 1); r(-30, 0, 9, 40, MET, 2); r(-30, 30, 18, 6, MET, 1); break;
      case 'cables': g.strokeStyle = PLA; g.lineWidth = 7; g.beginPath(); g.moveTo(-50, 40); g.bezierCurveTo(-80, -40, 10, -60, 20, 0); g.bezierCurveTo(30, 40, 60, 30, 40, -30); g.stroke(); r(-60, 34, 30, 22, PLA, 4); r(-56, 52, 6, 12, MET, 1); r(-44, 52, 6, 12, MET, 1); r(30, -46, 22, 22, DEN, 3); break;
      case 'flacons': g.strokeStyle = PLA; g.lineWidth = 4; rr(g, -55, -48, 110, 96, 8); g.stroke(); for(let i = 0; i < 3; i++){ r(-44 + i * 32, -26, 24, 60, ORG, 6); r(-38 + i * 32, -36, 12, 12, PLA, 2); } break;
      case 'parapluie': r(-6, -120, 12, 230, MET, 4); g.fillStyle = 'rgba(125,195,131,.7)'; g.beginPath(); g.moveTo(-20, -100); g.lineTo(20, -100); g.lineTo(8, 80); g.lineTo(-8, 80); g.fill(); g.strokeStyle = ORG; g.lineWidth = 8; g.beginPath(); g.arc(-14, 108, 14, 0, Math.PI); g.stroke(); break;
      case 'lunettes': g.strokeStyle = MET; g.lineWidth = 6; g.beginPath(); g.arc(-28, 0, 18, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(28, 0, 18, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(-10, -2); g.lineTo(10, -2); g.stroke(); g.fillStyle = 'rgba(125,195,131,.5)'; e(-28, 0, 14, 14, 'rgba(125,195,131,.5)'); e(28, 0, 14, 14, 'rgba(125,195,131,.5)'); break;
    }
  }
  function construire(){
    gr = new T3.Group(); lumieres(gr); sol(gr, 0xD5DAE2, 0xE2E6EC);
    mur(gr, -4, 0xE6E8EC, 'Contrôle de sûreté', '#7A5C99');
    // le tapis roulant (bas, devant), le tunnel du scanner, le pupitre et son grand écran derrière, les bacs
    const Z = 0;
    const p = [{ f:'boite', d:[6, .5, .7], p:[0, .25, Z], c:0x5C6672 }, { f:'boite', d:[6, .06, .62], p:[0, .53, Z], c:0x2A2D33 }];
    for(let k = 0; k < 24; k++) p.push({ f:'boite', d:[.02, .065, .62], p:[-3 + k * .25, .535, Z], c:0x3A3F47 });
    p.push({ f:'boite', d:[.95, .45, .8], p:[0, .8, Z], c:0xD9DEE4 }, { f:'boite', d:[.97, .08, .82], p:[0, 1.06, Z], c:0x7A5C99 }, { f:'boite', d:[.05, .4, .66], p:[-.485, .76, Z], c:0x2A2D33 }, { f:'boite', d:[.05, .4, .66], p:[.485, .76, Z], c:0x2A2D33 });
    p.push({ f:'boite', d:[.36, .07, .02], p:[.22, .95, Z + .41], c:0xF2C230 }, { f:'boite', d:[.07, .07, .03], p:[.22, .95, Z + .42], c:0x14233A });
    p.push({ f:'boite', d:[1.8, 1.2, .5], p:[0, .6, -.75], c:0x3A3F47 }, { f:'boite', d:[1.66, 1.2, .12], p:[0, 1.92, -.62], c:0x1E2A38 }, { f:'boite', d:[.3, .2, .1], p:[0, 1.26, -.66], c:0x3A3F47 });
    p.push({ f:'boite', d:[.5, .1, .4], p:[-2.2, .6, Z], c:0x8C949F }, { f:'boite', d:[.5, .1, .4], p:[2.3, .6, Z], c:0x8C949F });
    gr.add(bloc(p, .015));
    // le portique où passent les voyageurs, et les agents
    gr.add(bloc([{ f:'boite', d:[.15, 2.2, .3], p:[-2.2, 1.1, -2], c:0x7A5C99 }, { f:'boite', d:[.15, 2.2, .3], p:[-1.3, 1.1, -2], c:0x7A5C99 }, { f:'boite', d:[1.05, .2, .32], p:[-1.75, 2.2, -2], c:0x7A5C99 }], .02));
    figurants(gr, 3, -2.6, -3.4, -2.2, -1.2);
    const ag = personne({ peau:0xC68642, cheveux:0, coupe:'court', lunettes:false, barbe:false, haut:0x2A2D43 }); ag.position.set(2.1, 0, -.6); ag.rotation.y = -.6; gr.add(ag);
    B = toile(EW, EH); ecran = plan(1.5, 1.5 * EH / EW, B.tex); ecran.position.set(0, 1.92, -.555); gr.add(ecran);
    ecran.userData.clic = (hit) => toucherEcran(hit.uv);
    cliquables.push(ecran);
    // la liste des objets interdits, scotchée sur l'avant du tunnel
    consignesT = doc(toile(512, 620), .28, .339, [-.22, .8, Z + .415], [0, 0, .03], gr);
    scene.add(gr);
  }
  function dessinerConsignes(){
    const t = consignesT.t, g = t.g;
    g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = '#7A5C99'; g.fillRect(0, 0, t.w, 92);
    ecrit(g, '🚫 Interdit en cabine', 256, 48, 40, '#FFFFFF', 900, 'center', 480);
    let y = 150;
    for(const k of actifs(J ? J.n : 0)){
      g.save(); g.translate(70, y); const s = Math.min(1, 70 / Math.max(OBJ[k].w, OBJ[k].h)) * 1.2 * ECH; g.scale(s, s); forme(g, k); g.restore();
      ecrit(g, OBJ[k].nom[0].toUpperCase() + OBJ[k].nom.slice(1), 130, y, 28, '#14233A', 800, 'left', 370); y += 78;
    }
    ecrit(g, 'Tout le reste peut passer.', 256, t.h - 40, 26, '#6B7785', 700, 'center');
    t.tex.needsUpdate = true;
  }
  // un nouveau bagage : quelques affaires, parfois un objet interdit caché au milieu
  function nouveau(){
    const n = J.n, nb = Math.min(9, 4 + Math.floor(n / 3)), objets = [], interdits = actifs(n);
    const sale = Math.random() < .55, nI = !sale ? 0 : Math.random() < .8 ? 1 : 2;
    const liste = melanger([...PERMIS]).slice(0, nb - nI); for(let i = 0; i < nI; i++) liste.push(piocher(interdits));
    melanger(liste);
    // les gros objets d'abord (ils se posent au fond), avec un peu de chevauchement permis
    liste.sort((a, b) => OBJ[b].w * OBJ[b].h - OBJ[a].w * OBJ[a].h);
    for(const k of liste){
      const o = OBJ[k], rayon = Math.max(o.w, o.h) / 2;
      let best = null, bd = -1;
      for(let essai = 0; essai < 40; essai++){
        const x = hasard(ZX0 + o.w / 2 * .7, ZX1 - o.w / 2 * .7), y = hasard(ZY0 + o.h / 2 * .7, ZY1 - o.h / 2 * .7);
        const d = Math.min(...objets.map(q => Math.hypot(q.x - x, q.y - y) - (q.rayon + rayon) * .5), 999);
        if(d > bd){ bd = d; best = { x, y }; } if(d > 30) break;
      }
      objets.push({ k, x:best.x, y:best.y, a:hasard(-Math.PI, Math.PI), rayon, interdit:o.interdit != null, trouve:false, faux:false });
    }
    // les objets interdits sont dessinés au milieu des autres (pas toujours au-dessus)
    melanger(objets);
    sac = { objets, n:n + 1, limite:Math.max(7, 13 - n * .35), t:0, scan:0, couleur:piocher([0xD7263D, 0x1B98E0, 0xF2C230, 0x2BA84A, 0x14233A, 0x6A4C93]) };
    jeter(sac3d); sac3d = valise3d(sac.couleur); sac3d.position.set(-3.2, .56, 0); gr.add(sac3d);
    etat = 'entre'; tEtat = 0; boutons([]);
  }
  let sac3d = null;
  function valise3d(c){
    return bloc([{ f:'boite', d:[.7, .28, .45], p:[0, .14, 0], c }, { f:'boite', d:[.72, .04, .47], p:[0, .2, 0], c:0x2A2D33 }, { f:'boite', d:[.22, .05, .05], p:[0, .31, 0], c:0x2A2D33 }, { f:'boite', d:[.04, .06, .04], p:[-.1, .29, 0], c:0x2A2D33 }, { f:'boite', d:[.04, .06, .04], p:[.1, .29, 0], c:0x2A2D33 }], .012);
  }
  function dessinerEcran(){
    const g = B.g;
    g.fillStyle = '#0E1A2B'; g.fillRect(0, 0, EW, EH);
    g.fillStyle = '#7A5C99'; g.fillRect(0, 0, EW, 76); ecrit(g, '🔍 Scanner · Poste 1', 24, 40, 38, '#FFFFFF', 900);
    if(!sac){ ecrit(g, 'En attente d\'un bagage…', EW / 2, EH / 2, 44, '#8ECAE6', 800, 'center'); B.tex.needsUpdate = true; return; }
    ecrit(g, `Bagage n° ${sac.n}`, EW - 24, 40, 34, '#FFFFFF', 800, 'right');
    // la barre du temps pour décider
    const reste = etat === 'decide' ? clamp(1 - sac.t / sac.limite, 0, 1) : 1;
    g.fillStyle = '#2A3F5F'; rr(g, 24, 96, EW - 48, 26, 13); g.fill(); g.fillStyle = reste > .35 ? '#51CF66' : '#E5383B'; rr(g, 24, 96, (EW - 48) * reste, 26, 13); g.fill();
    // l'image aux rayons X (révélée par le balayage)
    g.save(); g.beginPath(); g.rect(40, 140, (EW - 80) * sac.scan, EH - 170); g.clip();
    g.fillStyle = '#EEF3F6'; g.fillRect(40, 140, EW - 80, EH - 170);
    g.strokeStyle = PLA; g.lineWidth = 14; rr(g, ZX0 - 30, ZY0 - 26, ZX1 - ZX0 + 60, ZY1 - ZY0 + 52, 36); g.stroke();
    g.fillStyle = MET; g.fillRect(EW / 2 - 90, ZY0 - 50, 180, 18); g.fillRect(EW / 2 - 90, ZY0 - 50, 14, 30); g.fillRect(EW / 2 + 76, ZY0 - 50, 14, 30);
    g.globalCompositeOperation = 'multiply';
    for(const o of sac.objets){ if(o.trouve) continue; g.save(); g.translate(o.x, o.y); g.rotate(o.a); g.scale(ECH, ECH); forme(g, o.k); g.restore(); }
    g.globalCompositeOperation = 'source-over';
    for(const o of sac.objets){
      if(!o.trouve && !o.faux) continue;
      g.save(); g.translate(o.x, o.y);
      if(o.trouve){ g.save(); g.rotate(o.a); g.scale(ECH, ECH); g.globalAlpha = .9; forme(g, o.k); g.restore(); }
      g.strokeStyle = o.trouve ? '#E5383B' : '#FFB703'; g.lineWidth = 8; g.beginPath(); g.arc(0, 0, o.rayon * .75 + 14, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
    g.restore();
    if(etat === 'entre'){ const x = 40 + (EW - 80) * sac.scan; g.fillStyle = 'rgba(81,207,102,.8)'; g.fillRect(x - 4, 140, 8, EH - 170); }
    B.tex.needsUpdate = true;
  }
  function toucherEcran(uv){
    if(etat !== 'decide' || !uv) return;
    const x = uv.x * EW, y = (1 - uv.y) * EH;
    let best = null, bd = 1e9;
    for(const o of sac.objets){
      if(o.trouve) continue;
      const c = Math.cos(-o.a), s = Math.sin(-o.a), lx = (x - o.x) * c - (y - o.y) * s, ly = (x - o.x) * s + (y - o.y) * c, O = OBJ[o.k];
      if(Math.abs(lx) < O.w / 2 + 18 && Math.abs(ly) < O.h / 2 + 18){ const d = Math.hypot(lx / (O.w + 40), ly / (O.h + 40)); if(d < bd){ bd = d; best = o; } }
    }
    if(!best) return;
    if(best.interdit){
      best.trouve = true; J.score += 40; majHaut(); dire(`🚨 Trouvé : ${OBJ[best.k].nom} ! · +40`, 'ok');
      if(sac.objets.every(o => !o.interdit || o.trouve)) finSac(true);
    } else if(!best.faux){ best.faux = true; points(-20, `Fausse alerte : ce n'est que ${OBJ[best.k].nom}.`, 'ko'); }
    dessinerEcran();
  }
  function finSac(fouille){
    if(etat !== 'decide') return;
    const restants = sac.objets.filter(o => o.interdit && !o.trouve), rapide = Math.max(0, Math.round(50 - sac.t * 5));
    if(fouille) bon(80 + rapide, 'Bagage mis de côté pour la fouille.');
    else if(restants.length) faute(`Il y avait ${restants.map(o => OBJ[o.k].nom).join(' et ')} dans ce sac !`);
    else bon(80 + rapide, 'Sac en règle, il peut passer.');
    if(restants.length) for(const o of restants){ o.trouve = true; }
    etat = 'sort'; tEtat = 0; sac.fouille = fouille; boutons([]); dessinerEcran();
  }
  return {
    ico:'🔍', titre:'Rayons X des bagages',
    regles:`<p>Tu es à l'écran du scanner. Les bagages défilent : regarde l'image aux rayons X.</p><ul><li>👆 Si tu vois un <b>objet interdit</b>, touche-le sur l'écran.</li><li>✅ Si le sac est en règle, laisse-le passer.</li><li>🟧 Orange : matières organiques (eau, nourriture, bois…), 🟩 vert : plastiques, 🟦 bleu : métal.</li><li>⏱ Ne traîne pas : la barre verte montre le temps qu'il te reste pour ce sac.</li></ul>`,
    camera:asp => asp < .9 ? recul([0, 1.42, -.2], [0, .68, 2.75], 60, asp, 1.6, 2.8) : recul([0, 1.45, -.3], [0, .45, 2.5], 48, asp, 1.9, 3.0),
    montrer(){ if(!gr) construire(); gr.visible = true; },
    cacher(){ if(gr) gr.visible = false; },
    debut(){ sac = null; dessinerConsignes(); dessinerEcran(); nouveau(); consigne('Touche les objets interdits sur l\'écran. Sac en règle ? Laisse-le passer.'); },
    maj(dt){
      if(!sac) return;
      tEtat += dt;
      if(etat === 'entre'){
        const u = clamp(tEtat / 1.5, 0, 1); sac3d.position.x = lerp(-3.2, 0, lisse(u)); sac.scan = clamp((tEtat - .5) / 1.1, 0, 1);
        if(tEtat > 1.6){ etat = 'decide'; sac.t = 0; sac.scan = 1; boutons([{ t:'✅ Laisser passer', cls:'vert', fn:() => finSac(false) }]); }
        dessinerEcran();
      } else if(etat === 'decide'){
        sac.t += dt; if(Math.floor(sac.t * 10) !== Math.floor((sac.t - dt) * 10)) dessinerEcran();
        if(sac.t > sac.limite){ dire('⏱ Trop tard : le sac est passé tout seul.', 'ko'); finSac(false); }
      } else if(etat === 'sort'){
        const u = clamp(tEtat / 1.1, 0, 1); sac3d.position.x = lerp(0, sac.fouille ? 2.3 : 3.4, lisse(u));
        if(sac.fouille) sac3d.position.y = .56 + Math.sin(u * Math.PI) * .1;
        if(tEtat > 1.4 && J && !J.fini){ J.n++; if(actifs(J.n).length !== actifs(J.n - 1).length){ dessinerConsignes(); dire('📋 Nouvel objet interdit ! Regarde la liste sur le tunnel.', 'info', 3.5); consignesT.cible = true; } nouveau(); }
      }
    },
    _etat:() => sac,
  };
})();

/* =====================================================================================================
   3) LE PORTIQUE DE CONTRÔLE (sûreté) : le portique sonne ? On passe le détecteur à main sur le voyageur.
   ===================================================================================================== */
JEUX.portique = (() => {
  let gr = null, pax = null, lampe = null, baton = null, led = null, reglesT = null, etat = 'vide', tEtat = 0, tDecide = 0, scan = null;
  const ZONES = {
    tete:{ nom:'la tête', p:[0, 1.66, 0], d:[.34, .34, .32] }, torse:{ nom:'le torse', p:[0, 1.16, 0], d:[.36, .48, .34] },
    brasG:{ nom:'un bras', p:[.27, 1.05, 0], d:[.16, .62, .2] }, brasD:{ nom:'un bras', p:[-.27, 1.05, 0], d:[.16, .62, .2] },
    taille:{ nom:'la ceinture', p:[0, .84, 0], d:[.4, .16, .34] }, jambeG:{ nom:'une jambe', p:[.08, .46, 0], d:[.16, .6, .32] },
    jambeD:{ nom:'une jambe', p:[-.08, .46, 0], d:[.16, .6, .32] }, pieds:{ nom:'les chaussures', p:[0, .07, .04], d:[.4, .16, .36] },
  };
  // les objets en métal : permis (le voyageur les a oubliés sur lui) ou interdits (cachés)
  const METAL = {
    ceinture:{ nom:'Boucle de ceinture', zones:['taille'] }, cles:{ nom:'Clés', zones:['jambeG', 'jambeD'] }, pieces:{ nom:'Pièces de monnaie', zones:['jambeG', 'jambeD'] },
    montre:{ nom:'Montre', zones:['brasG', 'brasD'] }, telephone:{ nom:'Téléphone oublié', zones:['torse', 'jambeG', 'jambeD'] }, barrette:{ nom:'Barrette', zones:['tete'] },
    coques:{ nom:'Chaussures de sécurité', zones:['pieds'] }, collier:{ nom:'Collier', zones:['torse'] },
    couteau:{ nom:'Couteau', interdit:true, zones:['pieds', 'jambeG', 'jambeD', 'torse'] }, ciseaux:{ nom:'Ciseaux', interdit:true, zones:['torse', 'jambeG'] },
    cutter:{ nom:'Cutter', interdit:true, zones:['brasG', 'brasD', 'jambeD'] }, tournevis:{ nom:'Tournevis', interdit:true, zones:['torse', 'jambeD', 'pieds'] },
  };
  const PERMIS = Object.keys(METAL).filter(k => !METAL[k].interdit), INTERDITS = Object.keys(METAL).filter(k => METAL[k].interdit);
  const COUL = { eteint:0x5C6672, vert:0x51CF66, rouge:0xE5383B };
  function construire(){
    gr = new T3.Group(); lumieres(gr); sol(gr, 0xD5DAE2, 0xE2E6EC);
    mur(gr, -5, 0xE6E8EC, 'Contrôle de sûreté · Portique', '#7A5C99');
    // le portique (deux montants, la traverse, le voyant), le tapis de sol, le tapis à bagages sur le côté
    gr.add(bloc([{ f:'boite', d:[.16, 2.2, .5], p:[-.5, 1.1, -1.2], c:0x7A5C99 }, { f:'boite', d:[.16, 2.2, .5], p:[.5, 1.1, -1.2], c:0x7A5C99 }, { f:'boite', d:[1.16, .22, .52], p:[0, 2.3, -1.2], c:0x7A5C99 },
      { f:'boite', d:[.02, 1.9, .3], p:[-.41, 1.05, -1.2], c:0x9C86B8 }, { f:'boite', d:[.02, 1.9, .3], p:[.41, 1.05, -1.2], c:0x9C86B8 },
      { f:'boite', d:[1, .02, 3.4], p:[0, .01, -1.2], c:0x3A3F47 },
      { f:'boite', d:[.7, .7, 5], p:[-1.7, .35, -1.6], c:0x5C6672 }, { f:'boite', d:[.62, .06, 5], p:[-1.7, .72, -1.6], c:0x2A2D33 }, { f:'boite', d:[.8, .5, .9], p:[-1.7, .95, -1.4], c:0xD9DEE4 },
      { f:'boite', d:[.5, .1, .4], p:[-1.7, .8, .2], c:0x8C949F }, { f:'boite', d:[.5, .1, .4], p:[-1.7, .8, -.3], c:0x8C949F }], .015));
    lampe = new T3.Mesh(new T3.BoxGeometry(.5, .1, .06), new T3.MeshBasicMaterial({ color:COUL.eteint })); lampe.position.set(0, 2.3, -.93); gr.add(lampe);
    figurants(gr, 3, -2.6, -4, -.3, .3);
    const ag = personne({ peau:0x8D5524, cheveux:0, coupe:'court', lunettes:false, barbe:false, haut:0x2A2D43 }); ag.position.set(1.3, 0, -1.6); ag.rotation.y = -.9; gr.add(ag);
    // le détecteur à main (dans ta main, en bas de l'écran) et son voyant
    baton = new T3.Group();
    baton.add(bloc([{ f:'cyl', d:[.025, .025, .2, 8], p:[0, -.12, 0], c:0x1B1B1B }, { f:'boite', d:[.08, .26, .025], p:[0, .1, 0], c:0x14233A }, { f:'boite', d:[.06, .22, .03], p:[0, .1, 0], c:0xF2C230 }], .006));
    led = new T3.Mesh(new T3.SphereGeometry(.016, 10, 8), new T3.MeshBasicMaterial({ color:COUL.eteint })); led.position.set(0, -.03, .02); baton.add(led);
    gr.add(baton);
    reglesT = doc(toile(512, 600), .3, .352, [-.52, 1.82, -.94], [0, 0, 0], gr);
    scene.add(gr);
  }
  const REPOS = [.3, .75, .8];
  function dessinerRegles(){
    const t = reglesT.t, g = t.g;
    g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = '#7A5C99'; g.fillRect(0, 0, t.w, 92);
    ecrit(g, '🚶 Le portique', 256, 48, 40, '#FFFFFF', 900, 'center', 480);
    let y = 140;
    for(const l of ['Voyant vert : il passe.', 'Ça sonne (rouge) : passe le', 'détecteur sur lui, trouve', 'tout le métal.']){ ecrit(g, l, 26, y, 28, '#14233A', 700); y += 38; }
    y += 14; ecrit(g, 'Interdit sur soi :', 26, y, 30, '#C1121F', 900); y += 44;
    for(const k of INTERDITS){ ecrit(g, `• ${METAL[k].nom}`, 40, y, 28, '#14233A', 800); y += 38; }
    ecrit(g, 'Le reste (clés, ceinture…) : OK', 26, y + 14, 25, '#2BA84A', 800, 'left', 470);
    t.tex.needsUpdate = true;
  }
  function nouveau(){
    const tr = traits(), objets = [];
    if(Math.random() < .62){
      const nb = Math.random() < .7 ? 1 : 2, pris = new Set();
      for(let i = 0; i < nb; i++){
        const k = Math.random() < (J.n < 3 ? .3 : .42) ? piocher(INTERDITS) : piocher(PERMIS.filter(x => !pris.has(x)));
        const libres = METAL[k].zones.filter(z => !objets.some(o => o.zone === z)); if(!libres.length) continue;
        pris.add(k); objets.push({ k, zone:piocher(libres), trouve:false });
      }
    }
    if(pax){ jeter(pax.obj); for(const z of pax.zones){ const i = cliquables.indexOf(z); if(i >= 0) cliquables.splice(i, 1); } }
    const obj = personne(tr); obj.position.set(0, 0, -3); gr.add(obj);
    // les zones du corps qu'on peut toucher (invisibles)
    const zones = [];
    for(const [id, Z] of Object.entries(ZONES)){
      const m = new T3.Mesh(new T3.BoxGeometry(...Z.d), new T3.MeshBasicMaterial({ visible:false })); m.position.set(...Z.p); obj.add(m);
      m.userData.clic = () => scanner(id); zones.push(m); cliquables.push(m);
    }
    pax = { obj, objets, zones, vus:new Set(), sonne:objets.length > 0 };
    lampe.material.color.setHex(COUL.eteint); led.material.color.setHex(COUL.eteint);
    marcher(obj, 0, -3, 0, -.15, 2.2); etat = 'marche'; tEtat = 0; boutons([]);
  }
  // passer le détecteur sur une zone du corps
  function scanner(id){
    if(etat !== 'decide' || scan) return;
    const w = pax.obj.localToWorld(new T3.Vector3(...ZONES[id].p)); w.z += .26;
    scan = { id, t:0, de:baton.position.clone(), vers:w };
  }
  function finScan(id){
    pax.vus.add(id);
    const o = pax.objets.find(o => o.zone === id);
    if(o){
      led.material.color.setHex(COUL.rouge);
      if(!o.trouve){
        o.trouve = true; const M_ = METAL[o.k], et = etiquette(M_.nom + (M_.interdit ? ' !' : ''), M_.interdit ? '#C1121F' : '#1B6EC2', M_.interdit ? '#FFE3E3' : '#FFFFFF');
        et.position.set(ZONES[id].p[0] + (ZONES[id].p[0] > .1 ? .14 : ZONES[id].p[0] < -.1 ? -.14 : 0), ZONES[id].p[1] + .04, .3); et.scale.set(.42, .105, 1); pax.obj.add(et);
        dire(M_.interdit ? `🔊 Bip bip ! ${M_.nom} caché${/[sx]$/.test(M_.nom) ? 's' : ''} sur ${ZONES[id].nom} !` : `🔊 Bip ! ${M_.nom} : c'est autorisé.`, M_.interdit ? 'ko' : 'info', 2.6);
      }
    } else { led.material.color.setHex(COUL.vert); dire(`Rien sur ${ZONES[id].nom}.`, 'info', 1.4); }
  }
  function decider(passe){
    if(etat !== 'decide') return;
    const reste = pax.objets.filter(o => !o.trouve), danger = pax.objets.filter(o => METAL[o.k].interdit), rapide = Math.max(0, Math.round(50 - tDecide * 3));
    const noms = l => l.map(o => METAL[o.k].nom.toLowerCase()).join(' et ');
    if(passe){
      if(danger.length) faute(danger.every(o => o.trouve) ? `Tu as trouvé : ${noms(danger)}, et tu l'as laissé passer !` : `Il cachait : ${noms(danger)} (sur ${ZONES[danger[0].zone].nom}) !`);
      else if(reste.length){ J.total++; points(-30, `Le portique sonne encore : tu n'as pas trouvé ${noms(reste)}.`, 'ko'); }
      else bon((pax.sonne ? 100 : 60) + rapide, pax.sonne ? 'Tout le métal est trouvé, rien d\'interdit : il peut passer.' : 'Voyant vert, il passe. Au suivant !');
    } else {
      if(!danger.length) faute(pax.sonne ? `Rien d'interdit sur lui (${noms(pax.objets)}) : il fallait le laisser passer.` : 'Le portique n\'a pas sonné : rien à fouiller.');
      else if(danger.every(o => o.trouve)) bon(120 + rapide, `Bien joué, ${noms(danger)} confisqué${danger.length > 1 ? 's' : ''} !`);
      else bon(50, `La fouille a trouvé : ${noms(danger)}. La prochaine fois, trouve-le avec le détecteur.`);
    }
    if(J.fini) return;
    etat = 'part'; tEtat = 0; boutons([]); pax.cote = passe ? 1 : -1;
    marcher(pax.obj, pax.obj.position.x, pax.obj.position.z, passe ? 2.6 : -2.4, passe ? -.6 : .2, 1.3);
  }
  return {
    ico:'🚶', titre:'Portique de contrôle',
    regles:`<p>Les voyageurs passent sous le portique. <b>Voyant vert</b> : ils passent. <b>Ça sonne</b> : à toi de jouer avec le détecteur à main.</p><ul><li>👆 Touche une partie du corps (tête, torse, bras, ceinture, jambes, chaussures) pour y passer le détecteur.</li><li>🔊 Il bipe s'il y a du métal : clés, ceinture, montre… c'est permis. Couteau, ciseaux, cutter, tournevis : <b>interdit</b>.</li><li>✅ Laisse passer quand tout le métal est trouvé, 🚨 mets de côté s'il cache un objet interdit.</li></ul>`,
    camera:asp => asp < .9 ? recul([0, 1.18, -.3], [0, .3, 2.4], 56, asp, 1.35, 3.6) : recul([0, 1.3, -.4], [0, .25, 2.4], 50, asp, 1.6, 3.2),
    montrer(){ if(!gr) construire(); gr.visible = true; },
    cacher(){ if(gr) gr.visible = false; },
    debut(){ dessinerRegles(); if(pax){ jeter(pax.obj); pax = null; } baton.position.set(...REPOS); scan = null; nouveau(); consigne('Ça sonne ? Touche le voyageur pour passer le détecteur, puis décide.'); },
    maj(dt){
      if(!pax) return;
      tEtat += dt; majMarche(pax.obj, dt);
      // le passage sous le portique : le voyant s'allume quand il est dessous
      if(etat === 'marche'){
        if(pax.obj.position.z > -1.4 && lampe.material.color.getHex() === COUL.eteint){ lampe.material.color.setHex(pax.sonne ? COUL.rouge : COUL.vert); if(pax.sonne) dire('🔊 BIIIP ! Le portique sonne.', 'ko', 2); }
        if(!pax.obj.userData.marche){
          etat = 'decide'; tDecide = 0;
          boutons(pax.sonne ? [{ t:'🚨 Mettre de côté', cls:'rouge', fn:() => decider(false) }, { t:'✅ Laisser passer', cls:'vert', fn:() => decider(true) }] : [{ t:'✅ Au suivant', cls:'vert', fn:() => decider(true) }]);
        }
      }
      if(etat === 'decide'){
        tDecide += dt;
        if(pax.sonne) lampe.material.color.setHex(Math.floor(tEtat * 3) % 2 ? COUL.rouge : 0x8E2A2C);
      }
      // le détecteur glisse jusqu'à la zone touchée, bipe, puis revient doucement
      if(scan){
        scan.t += dt; const u = clamp(scan.t / .3, 0, 1);
        baton.position.lerpVectors(scan.de, scan.vers, lisse(u)); baton.rotation.z = Math.sin(scan.t * 30) * .15 * u;
        if(scan.t >= .45){ finScan(scan.id); scan = null; }
      } else if(etat !== 'decide' || tDecide > 0){ baton.rotation.z *= .8; }
      if(etat === 'part'){
        baton.position.lerp(new T3.Vector3(...REPOS), clamp(dt * 4, 0, 1)); led.material.color.setHex(COUL.eteint);
        if(!pax.obj.userData.marche && J && !J.fini){ J.n++; nouveau(); }
      }
    },
    _etat:() => pax && { objets:pax.objets, sonne:pax.sonne, etat, zones:Object.fromEntries(Object.entries(ZONES).map(([id, Z]) => [id, pax.obj.localToWorld(new T3.Vector3(...Z.p)).toArray()])) },
  };
})();

/* =====================================================================================================
   4) LA DOUANE (arrivées)
   ===================================================================================================== */
JEUX.douane = (() => {
  let gr = null, pax = null, valise = null, chien = null, bulle = null, declT = null, reglesT = null, etat = 'vide', tEtat = 0, objets3d = [], fouille = false;
  const ARTICLES = {
    cigarettes:{ nom:'Cigarettes', un:'cartouche', max:1, depuis:0 }, alcool:{ nom:'Alcool', un:'bouteille', max:2, depuis:0 }, viande:{ nom:'Viande', interdit:true, depuis:0 },
    billets:{ nom:'Billets', un:'liasse de 5 000 €', max:2, depuis:4 }, plante:{ nom:'Plante', interdit:true, depuis:4 },
    tortue:{ nom:'Tortue', interdit:true, depuis:8 }, fauxsac:{ nom:'Faux sac de luxe', interdit:true, depuis:8 },
  };
  const AUTRES = { vetements:'Vêtements', livre:'Livre', trousse:'Trousse de toilette', chaussures:'Chaussures', appareil:'Appareil photo', peluche:'Peluche', parfum:'Parfum 100 ml', souvenir:'Souvenir' };
  const actifs = n => Object.keys(ARTICLES).filter(k => n >= ARTICLES[k].depuis);
  const CALME = ['Bonjour !', 'Quel long voyage…', 'Je rentre de vacances.', 'Bonsoir !', 'On m\'attend dehors.', 'Il fait bon ici !'];
  const NERVEUX = ['Euh… je suis un peu pressé…', 'Il fait chaud ici, non ?', 'C\'est juste des souvenirs !', 'Je n\'ai rien, hein…', 'Mon taxi m\'attend, vite !'];
  function modele(k){
    const c = piocher([0xE5383B, 0x1B6EC2, 0x2BA84A, 0xFB8500, 0x6A4C93, 0xF2C230, 0x8D99AE]);
    switch(k){
      case 'cigarettes': return [{ f:'boite', d:[.2, .05, .1], p:[0, .025, 0], c:0xF4F1DE }, { f:'boite', d:[.2, .052, .035], p:[0, .025, -.02], c:0xC1121F }];
      case 'alcool': return [{ f:'cyl', d:[.04, .04, .18, 10], p:[-.02, .04, 0], r:[0, 0, Math.PI / 2], c:0x9C5B1B }, { f:'cyl', d:[.015, .02, .07, 8], p:[.1, .04, 0], r:[0, 0, Math.PI / 2], c:0x9C5B1B }, { f:'cyl', d:[.043, .043, .06, 10], p:[-.02, .04, 0], r:[0, 0, Math.PI / 2], c:0xF4F1DE }];
      case 'billets': return [{ f:'boite', d:[.16, .03, .08], p:[0, .015, 0], c:0x6BAF5B }, { f:'boite', d:[.03, .034, .084], p:[0, .015, 0], c:0xF4F1DE }];
      case 'viande': return [{ f:'cyl', d:[.04, .04, .2, 10], p:[0, .04, 0], r:[0, 0, Math.PI / 2], c:0x8E3B2E }, { f:'boule', d:[.04, 1], p:[.1, .04, 0], c:0xB5653E }, { f:'boule', d:[.04, 1], p:[-.1, .04, 0], c:0xB5653E }];
      case 'plante': return [{ f:'cyl', d:[.05, .04, .07, 10], p:[0, .035, 0], c:0xB07D62 }, { f:'boule', d:[.065, 1], p:[0, .11, 0], c:0x4E8F3E }, { f:'boule', d:[.04, 1], p:[.04, .15, .02], c:0x5FA35A }];
      case 'tortue': return [{ f:'boule', d:[.075, 1], p:[0, .04, 0], s:[1, .55, 1.2], c:0x5E8C31 }, { f:'boule', d:[.028, 1], p:[0, .04, .1], c:0x9BB56A }, { f:'boule', d:[.02, 0], p:[.06, .015, .06], c:0x9BB56A }, { f:'boule', d:[.02, 0], p:[-.06, .015, .06], c:0x9BB56A }, { f:'boule', d:[.02, 0], p:[.06, .015, -.06], c:0x9BB56A }, { f:'boule', d:[.02, 0], p:[-.06, .015, -.06], c:0x9BB56A }];
      case 'fauxsac': return [{ f:'boite', d:[.18, .1, .08], p:[0, .05, 0], c:0xC9A27E }, { f:'boite', d:[.12, .02, .02], p:[0, .12, 0], c:0x6B4A2F }, { f:'boite', d:[.05, .03, .085], p:[0, .06, 0], c:0xD4AF37 }];
      case 'vetements': return [{ f:'boite', d:[.22, .05, .15], p:[0, .025, 0], c }, { f:'boite', d:[.2, .04, .13], p:[0, .07, 0], c:piocher([0xF4F1DE, 0x14233A, 0x8ECAE6]) }];
      case 'livre': return [{ f:'boite', d:[.12, .03, .17], p:[0, .015, 0], c }, { f:'boite', d:[.11, .026, .16], p:[.006, .016, 0], c:0xF4F1DE }];
      case 'trousse': return [{ f:'boite', d:[.17, .07, .08], p:[0, .035, 0], c }, { f:'boite', d:[.17, .01, .01], p:[0, .07, 0], c:0x2A2D33 }];
      case 'chaussures': return [{ f:'boite', d:[.07, .06, .17], p:[-.045, .03, 0], c:0x3A3F47 }, { f:'boite', d:[.07, .06, .17], p:[.045, .03, 0], c:0x3A3F47 }];
      case 'appareil': return [{ f:'boite', d:[.12, .08, .06], p:[0, .04, 0], c:0x1E2A38 }, { f:'cyl', d:[.03, .03, .04, 10], p:[0, .04, .045], r:[Math.PI / 2, 0, 0], c:0x5C6672 }];
      case 'peluche': return [{ f:'boule', d:[.06, 1], p:[0, .05, 0], c:0x9C6B3C }, { f:'boule', d:[.045, 1], p:[0, .12, 0], c:0x9C6B3C }, { f:'boule', d:[.018, 0], p:[.035, .16, 0], c:0x9C6B3C }, { f:'boule', d:[.018, 0], p:[-.035, .16, 0], c:0x9C6B3C }];
      case 'parfum': return [{ f:'boite', d:[.06, .09, .04], p:[0, .045, 0], c:0xBFD9EA }, { f:'cyl', d:[.015, .015, .03, 8], p:[0, .105, 0], c:0xD4AF37 }];
      default: return [{ f:'boite', d:[.1, .1, .1], p:[0, .05, 0], c }, { f:'boule', d:[.04, 1], p:[0, .13, 0], c:0xFFB703 }];
    }
  }
  function chienModele(assis){
    const B = 0x9C6B3C, F = 0x6B4226;
    if(!assis) return bloc([{ f:'boite', d:[.18, .18, .46], p:[0, .34, 0], c:B }, { f:'boite', d:[.15, .15, .17], p:[0, .48, .28], c:B }, { f:'boite', d:[.08, .07, .1], p:[0, .44, .4], c:F }, { f:'boule', d:[.022, 1], p:[0, .46, .455], c:0x1B1B1B },
      { f:'boite', d:[.04, .1, .06], p:[.06, .56, .24], r:[.3, 0, 0], c:F }, { f:'boite', d:[.04, .1, .06], p:[-.06, .56, .24], r:[.3, 0, 0], c:F }, { f:'cyl', d:[.02, .015, .2, 6], p:[0, .44, -.3], r:[-.7, 0, 0], c:B },
      ...[[.06, .17], [-.06, .17], [.06, -.17], [-.06, -.17]].map(([x, z]) => ({ f:'cyl', d:[.03, .03, .26, 6], p:[x, .13, z], c:B })), { f:'boite', d:[.19, .04, .06], p:[0, .43, .19], c:0xD7263D }], .012);
    return bloc([{ f:'boite', d:[.2, .16, .24], p:[0, .1, -.1], c:B }, { f:'boite', d:[.17, .3, .16], p:[0, .32, .03], r:[-.35, 0, 0], c:B }, { f:'boite', d:[.15, .15, .17], p:[0, .55, .12], c:B }, { f:'boite', d:[.08, .07, .1], p:[0, .52, .24], c:F }, { f:'boule', d:[.022, 1], p:[0, .54, .295], c:0x1B1B1B },
      { f:'boite', d:[.04, .1, .06], p:[.06, .63, .08], r:[.3, 0, 0], c:F }, { f:'boite', d:[.04, .1, .06], p:[-.06, .63, .08], r:[.3, 0, 0], c:F }, { f:'cyl', d:[.03, .03, .26, 6], p:[.05, .13, .1], c:B }, { f:'cyl', d:[.03, .03, .26, 6], p:[-.05, .13, .1], c:B },
      { f:'boite', d:[.05, .03, .2], p:[0, .02, -.3], c:B }, { f:'boite', d:[.18, .04, .06], p:[0, .43, .07], c:0xD7263D }], .012);
  }
  function construire(){
    gr = new T3.Group(); lumieres(gr); sol(gr, 0xD9E6E1, 0xE6EFEC);
    mur(gr, -5, 0xDCE8E4, 'Douane · Arrivées', '#2A9D8F');
    // la table de fouille, les couloirs vert et rouge derrière, l'écriteau des règles
    gr.add(bloc([{ f:'boite', d:[1.9, .86, .95], p:[0, .43, -.05], c:0xD9DEE4 }, { f:'boite', d:[1.96, .05, 1], p:[0, .885, -.05], c:0x8C949F },
      { f:'boite', d:[2.4, .02, 3], p:[-2.2, .01, -2.6], c:0xB7E4C7 }, { f:'boite', d:[2.4, .02, 3], p:[2.2, .01, -2.6], c:0xF8C4C4 },
      { f:'boite', d:[1.4, .35, .1], p:[-2.2, 2.6, -3.9], c:0x2BA84A }, { f:'boite', d:[1.4, .35, .1], p:[2.2, 2.6, -3.9], c:0xE5383B },
      { f:'boite', d:[.08, 2.6, .08], p:[-2.85, 1.3, -3.9], c:0x8C949F }, { f:'boite', d:[.08, 2.6, .08], p:[2.85, 1.3, -3.9], c:0x8C949F }], .015));
    figurants(gr, 3, -2.4, -3.6, -2.8, -1.6);
    const ag = personne({ peau:0xE0AC69, cheveux:1, coupe:'court', lunettes:false, barbe:false, haut:0x264653 }); ag.position.set(1.45, 0, -.55); ag.rotation.y = -1.2; gr.add(ag);
    reglesT = doc(toile(512, 680), .3, .4, pose(-.66, .91, .22, .4, .5), [-Math.PI / 2 + .5, 0, .08], gr);
    declT = doc(toile(560, 700), .3, .375, pose(.66, .91, .22, .375, .5), [-Math.PI / 2 + .5, 0, -.08], gr);
    chien = new T3.Group(); chien.userData.debout = chienModele(false); chien.userData.assis = chienModele(true); chien.add(chien.userData.debout, chien.userData.assis); chien.userData.assis.visible = false;
    chien.position.set(-2.2, 0, .75); chien.rotation.y = Math.PI / 2; gr.add(chien);
    scene.add(gr);
  }
  function dessinerRegles(){
    const t = reglesT.t, g = t.g, n = J ? J.n : 0;
    g.fillStyle = '#FFFDF4'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = '#2A9D8F'; g.fillRect(0, 0, t.w, 92);
    ecrit(g, '🛃 Règles de la douane', 256, 48, 38, '#FFFFFF', 900, 'center', 480);
    ecrit(g, 'Sans déclaration, au plus :', 24, 140, 30, '#14233A', 900);
    let y = 192;
    for(const k of actifs(n).filter(k => !ARTICLES[k].interdit)){ const a = ARTICLES[k]; ecrit(g, `• ${a.max} ${a.un}${a.max > 1 && k !== 'billets' ? 's' : ''} ${k === 'billets' ? '' : 'de ' + a.nom.toLowerCase()}`.replace('liasse de 5 000 €', 'liasses de 5 000 € (10 000 €)').replace('1 liasses', '1 liasse'), 34, y, 27, '#14233A', 700, 'left', 460); y += 44; }
    ecrit(g, 'Au-delà : il faut le déclarer.', 24, y + 6, 26, '#2A9D8F', 800, 'left', 470); y += 70;
    ecrit(g, 'Toujours interdit :', 24, y, 30, '#C1121F', 900); y += 50;
    for(const k of actifs(n).filter(k => ARTICLES[k].interdit)){ ecrit(g, `• ${ARTICLES[k].nom}`, 34, y, 28, '#14233A', 800); y += 44; }
    t.tex.needsUpdate = true;
  }
  function dessinerDecl(){
    const t = declT.t, g = t.g, v = pax.v;
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, t.w, t.h); g.fillStyle = '#264653'; g.fillRect(0, 0, t.w, 88);
    ecrit(g, 'DÉCLARATION EN DOUANE', 280, 46, 36, '#FFFFFF', 900, 'center', 520);
    ecrit(g, 'Nom', 28, 124, 22, '#6B7785', 700); ecrit(g, `${v.nom} ${v.prenom}`, 28, 160, 36, '#14233A', 900, 'left', 500);
    ecrit(g, 'En provenance de', 28, 214, 22, '#6B7785', 700); ecrit(g, `${v.vol} · ${v.prov}`, 28, 250, 34, '#14233A', 900, 'left', 500);
    ecrit(g, 'Marchandises à déclarer ?', 28, 314, 30, '#14233A', 900);
    const decl = Object.keys(v.declare).length > 0;
    const caseX = (x, oui, lib) => { g.strokeStyle = '#14233A'; g.lineWidth = 4; g.strokeRect(x, 344, 40, 40); if(oui){ g.strokeStyle = '#1B4E8C'; g.lineWidth = 7; g.beginPath(); g.moveTo(x + 6, 350); g.lineTo(x + 34, 378); g.moveTo(x + 34, 350); g.lineTo(x + 6, 378); g.stroke(); } ecrit(g, lib, x + 54, 365, 32, '#14233A', 800); };
    caseX(28, !decl, 'NON'); caseX(220, decl, 'OUI');
    let y = 440;
    if(decl){ for(const [k, q] of Object.entries(v.declare)){ const a = ARTICLES[k]; ecrit(g, `${a.nom} : ${q} ${a.un}${q > 1 ? 's' : ''}`.replace('liasse de 5 000 €s', 'liasses de 5 000 €'), 40, y, 30, '#1B4E8C', 800, 'left', 490); y += 46; } }
    else ecrit(g, '(rien à déclarer)', 40, y, 28, '#6B7785', 700);
    g.strokeStyle = '#B9BEC6'; g.lineWidth = 2; g.beginPath(); g.moveTo(28, 640); g.lineTo(300, 640); g.stroke(); ecrit(g, 'Signature', 28, 664, 20, '#6B7785', 700);
    g.strokeStyle = '#1B4E8C'; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 630); g.bezierCurveTo(80, 590, 110, 650, 150, 610); g.bezierCurveTo(170, 600, 200, 640, 240, 615); g.stroke();
    t.tex.needsUpdate = true;
  }
  // ce qui est à saisir : les interdits, et ce qui dépasse à la fois la franchise et la déclaration
  const aSaisir = v => Object.keys(v.contenu).filter(k => { const a = ARTICLES[k]; if(!a) return false; return a.interdit || v.contenu[k] > Math.max(a.max, v.declare[k] || 0); });
  function nouveau(){
    const n = J.n, ok = actifs(n), dests = [...M.VILLES.moyen, ...M.VILLES.long].filter(v => !['Pointe-à-Pitre', 'La Réunion'].includes(v[0])), comp = piocher(Object.keys(M.COMPAGNIES));
    const v = { nom:piocher(NOMS), prenom:piocher(PRENOMS), prov:piocher(dests)[0], vol:`${M.COMPAGNIES[comp].code} ${entier(100, 989)}`, contenu:{}, declare:{}, fraudeur:Math.random() < .45 };
    const qte = ok.filter(k => !ARTICLES[k].interdit), interdits = ok.filter(k => ARTICLES[k].interdit);
    // un voyageur honnête : rien, un peu dans la franchise, ou plus mais déclaré
    if(Math.random() < .55){ const k = piocher(qte); v.contenu[k] = entier(1, ARTICLES[k].max); }
    if(!v.fraudeur && Math.random() < .3){ const k = piocher(qte); v.contenu[k] = entier(ARTICLES[k].max + 1, ARTICLES[k].max + 3); v.declare[k] = v.contenu[k]; }
    if(v.fraudeur){
      const nb = Math.random() < .75 ? 1 : 2;
      for(let i = 0; i < nb; i++){
        if(interdits.length && Math.random() < .45){ v.contenu[piocher(interdits)] = 1; continue; }
        const k = piocher(qte), q = entier(ARTICLES[k].max + 1, ARTICLES[k].max + 3); v.contenu[k] = q;
        if(Math.random() < .3) v.declare[k] = entier(1, q - 1); else delete v.declare[k];
      }
      if(!aSaisir(v).length){ const k = piocher(qte); v.contenu[k] = ARTICLES[k].max + 2; delete v.declare[k]; }
    }
    // les indices : le chien flaire la viande, les plantes, les animaux (et parfois l'argent), le voyageur nerveux parle trop
    const flair = Object.keys(v.contenu).some(k => ['viande', 'plante', 'tortue'].includes(k)) ? .85 : v.contenu.billets > 2 && !v.declare.billets ? .45 : .07;
    v.chien = Math.random() < flair;
    v.phrase = (v.fraudeur ? Math.random() < .55 : Math.random() < .12) ? piocher(NERVEUX) : piocher(CALME);
    const tr = traits(); jeter(pax && pax.obj); const obj = personne(tr); obj.position.set(-2.6, 0, -.85); gr.add(obj);
    pax = { v, obj, tr };
    jeter(valise); valise = new T3.Group(); const c = piocher([0xD7263D, 0x1B98E0, 0xF2C230, 0x2BA84A, 0x14233A, 0x6A4C93, 0xE07A5F]);
    valise.add(bloc([{ f:'boite', d:[.9, .2, .58], p:[0, .1, 0], c }, { f:'boite', d:[.82, .02, .5], p:[0, .2, 0], c:0x2A2D33 }], .012));
    const cou = new T3.Group(); cou.position.set(0, .2, -.29); cou.add(bloc([{ f:'boite', d:[.9, .07, .58], p:[0, .035, .29], c }, { f:'boite', d:[.24, .04, .05], p:[0, .09, .5], c:0x2A2D33 }, { f:'boite', d:[.92, .02, .02], p:[0, .005, .58], c:0x8C949F }], .012)); valise.add(cou); valise.userData.couvercle = cou;
    valise.position.set(-2.4, .91, -.05); gr.add(valise);
    // le contenu de la valise, rangé dans une grille (caché tant qu'elle est fermée)
    retirerCliquables(); objets3d = [];
    const liste = [];
    for(const [k, q] of Object.entries(v.contenu)) for(let i = 0; i < Math.min(q, 4); i++) liste.push(k);
    const fill = melanger(Object.keys(AUTRES)).slice(0, Math.max(2, 7 - liste.length)); liste.push(...fill);
    melanger(liste); liste.length = Math.min(liste.length, 12);
    const cols = 4, rangs = Math.ceil(liste.length / cols);
    liste.forEach((k, i) => {
      const o = bloc(modele(k)), x = -.3 + (i % cols) * .2, z = -.17 + Math.floor(i / cols) * (.34 / Math.max(1, rangs - 1 || 1));
      o.position.set(x, .2, rangs === 1 ? 0 : z); o.rotation.y = hasard(-.25, .25); o.visible = false; valise.add(o);
      const nom = ARTICLES[k] ? ARTICLES[k].nom : AUTRES[k], et = etiquette(nom); et.position.set(x, .36, (rangs === 1 ? 0 : z) + .02); et.visible = false; valise.add(et);
      const zone = new T3.Mesh(new T3.BoxGeometry(.19, .2, .15), new T3.MeshBasicMaterial({ visible:false })); zone.position.set(x, .28, rangs === 1 ? 0 : z); zone.visible = false; valise.add(zone);
      const item = { k, o, et, zone, saisi:false }; zone.userData.clic = () => toucherObjet(item); objets3d.push(item); cliquables.push(zone);
    });
    dessinerDecl(); declT.m.visible = false; for(const d of docs) d.cible = false;
    jeter(bulle); bulle = null; fouille = false;
    marcher(obj, -2.6, -.85, 0, -.8, 1.4);
    etat = 'arrive'; tEtat = 0; boutons([]);
  }
  function majBulle(txt){
    jeter(bulle); const t = toile(560, 150); const g = t.g;
    rr(g, 4, 4, 552, 110, 30); g.fillStyle = '#FFFFFF'; g.fill(); g.strokeStyle = '#14233A'; g.lineWidth = 5; g.stroke();
    g.beginPath(); g.moveTo(240, 112); g.lineTo(280, 146); g.lineTo(300, 112); g.fillStyle = '#FFFFFF'; g.fill(); g.stroke(); g.fillRect(244, 104, 52, 10);
    ecrit(g, txt, 280, 60, 40, '#14233A', 800, 'center', 520);
    bulle = new T3.Sprite(new T3.SpriteMaterial({ map:t.tex, depthTest:false })); bulle.scale.set(.75, .2, 1); bulle.position.set(0, 2.05, -.8); bulle.renderOrder = 15; gr.add(bulle);
  }
  function retirerCliquables(){ for(const it of objets3d){ const i = cliquables.indexOf(it.zone); if(i >= 0) cliquables.splice(i, 1); } }
  function toucherObjet(it){
    if(etat !== 'fouille' || it.saisi) return;
    const v = pax.v, mauvais = aSaisir(v);
    if(mauvais.includes(it.k)){
      for(const o of objets3d) if(o.k === it.k && !o.saisi){ o.saisi = true; o.o.visible = false; jeter(o.et); o.et = etiquette('SAISI', '#C1121F', '#FFE3E3'); o.et.position.copy(o.zone.position); o.et.position.y = .3; valise.add(o.et); }
      const a = ARTICLES[it.k];
      J.score += 50; majHaut(); dire(`🚨 Saisi : ${a.nom.toLowerCase()}${a.interdit ? ' (interdit)' : ` (${v.contenu[it.k]} au lieu de ${Math.max(a.max, v.declare[it.k] || 0)} permis)`} · +50`, 'ok', 3.2);
      if(mauvais.every(k => objets3d.filter(o => o.k === k).every(o => o.saisi))) setTimeout(() => { if(etat === 'fouille') refermer(); }, 700);
    } else {
      const a = ARTICLES[it.k];
      points(-20, a ? `${a.nom} : c'est autorisé ici (${v.contenu[it.k]}${v.declare[it.k] ? ', déclaré' : ', dans la franchise'}).` : `${AUTRES[it.k]} : rien d'interdit.`, 'ko');
    }
  }
  function laisser(){
    if(etat !== 'decide') return;
    const v = pax.v, m = aSaisir(v);
    if(m.length) faute(`Il fallait fouiller : ${m.map(k => ARTICLES[k].nom.toLowerCase()).join(' et ')} dans la valise !`);
    else bon(100, Object.keys(v.declare).length ? 'Déclaré en règle, il paie ses taxes et passe.' : 'Rien à signaler, bonne arrivée !');
    partir();
  }
  function ouvrir(){
    if(etat !== 'decide') return;
    etat = 'ouvre'; tEtat = 0; fouille = true; boutons([]); for(const d of docs) d.cible = false;
    for(const it of objets3d){ it.o.visible = it.et.visible = it.zone.visible = true; }
  }
  function refermer(){
    if(etat !== 'fouille') return;
    const v = pax.v, restants = aSaisir(v).filter(k => objets3d.some(o => o.k === k && !o.saisi));
    if(!aSaisir(v).length) points(0, 'Rien d\'illégal : le voyageur a perdu du temps, mais c\'était bien de vérifier.', 'info');
    else if(restants.length) faute(`Tu as oublié : ${restants.map(k => ARTICLES[k].nom.toLowerCase()).join(' et ')}.`);
    else bon(100, 'Fouille réussie, tout ce qui n\'était pas en règle est saisi !');
    partir();
  }
  function partir(){
    etat = 'part'; tEtat = 0; boutons([]); retirerCliquables(); jeter(bulle); bulle = null;
    for(const d of docs) d.cible = false; declT.m.visible = false;
  }
  function boutonsDecision(){ boutons([{ t:'🧳 Ouvrir la valise', cls:'rouge', fn:ouvrir }, { t:'✅ Laisser passer', cls:'vert', fn:laisser }]); }
  let camCible = null;
  return {
    ico:'🛃', titre:'Douane',
    regles:`<p>Tu es douanier. Lis la <b>déclaration</b> du voyageur et les <b>règles</b>, puis décide : le laisser passer, ou <b>ouvrir sa valise</b>.</p><ul><li>👆 Dans la valise, touche ce qui n'est pas en règle pour le saisir.</li><li>🐕 Si le chien s'assoit près de la valise, il a flairé quelque chose…</li><li>💬 Écoute aussi ce que dit le voyageur.</li><li>Ce qui est <b>déclaré</b> peut passer (le voyageur paie des taxes), sauf les produits interdits.</li></ul>`,
    camera:asp => {
      const f = fouille && ['ouvre', 'fouille'].includes(etat);
      if(asp < .9) return f ? recul([0, .98, -.1], [0, 1.3, 1.0], 58, asp, 1.08, 1.5) : recul([0, 1.05, -.35], [0, 1.45, 2.8], 58, asp, 2.15, 2.9);
      return f ? recul([0, .98, -.1], [0, 1.1, .9], 50, asp, 1.1, 1.1) : recul([0, 1.15, -.3], [0, 1.25, 2.3], 50, asp, 2.2, 2.9);
    },
    montrer(){ if(!gr) construire(); gr.visible = true; },
    cacher(){ if(gr) gr.visible = false; },
    debut(){ pax = null; dessinerRegles(); nouveau(); consigne('Lis la déclaration, puis laisse passer ou ouvre la valise.'); },
    maj(dt){
      if(!pax) return;
      tEtat += dt; majMarche(pax.obj, dt);
      if(etat === 'arrive'){
        const u = clamp(tEtat / 1.4, 0, 1); valise.position.x = lerp(-2.4, 0, lisse(u));
        if(tEtat > 1.5){
          etat = 'chien'; tEtat = 0; declT.m.visible = true; majBulle(pax.v.phrase); boutonsDecision(); etat = 'decide';
          chien.userData.assis.visible = false; chien.userData.debout.visible = true; chien.userData.tour = 0;
        }
      }
      // le chien vient renifler la valise, puis s'assoit (il a flairé quelque chose) ou repart
      if(chien && pax && ['decide', 'ouvre', 'fouille'].includes(etat)){
        const c = chien, tc = (c.userData.tour = (c.userData.tour || 0) + dt);
        if(tc < 1.4){ c.position.x = lerp(-2.2, -.2, lisse(tc / 1.4)); c.position.z = .75; c.rotation.y = Math.PI / 2; }
        else if(tc < 2.6){ c.rotation.y = Math.PI / 2 + Math.sin(tc * 9) * .25 + .9; }
        else if(pax.v.chien){ if(!c.userData.assis.visible){ c.userData.assis.visible = true; c.userData.debout.visible = false; c.rotation.y = Math.PI; dire('🐕 Le chien s\'assoit devant la valise et aboie !', 'info', 3); } }
        else if(tc < 4){ c.rotation.y = -Math.PI / 2; c.position.x = lerp(-.2, -2.2, lisse((tc - 2.6) / 1.4)); }
      }
      if(etat === 'ouvre'){
        const u = clamp(tEtat / .8, 0, 1); valise.userData.couvercle.rotation.x = -1.9 * lisse(u);
        if(u >= 1){ etat = 'fouille'; boutons([{ t:'✔️ Refermer la valise', cls:'prim', fn:refermer }]); dire('Touche ce qui n\'est pas en règle pour le saisir.', 'info'); }
      }
      if(etat === 'part'){
        valise.userData.couvercle.rotation.x = lerp(valise.userData.couvercle.rotation.x, 0, clamp(dt * 6, 0, 1));
        if(tEtat > .5 && !pax.obj.userData.marche && pax.obj.position.x < 1){ marcher(pax.obj, pax.obj.position.x, pax.obj.position.z, 2.8, -1.2, 1.3); }
        if(tEtat > .5) valise.position.x = lerp(0, 2.8, lisse(clamp((tEtat - .5) / 1.3, 0, 1)));
        if(chien){ chien.userData.assis.visible = false; chien.userData.debout.visible = true; chien.rotation.y = -Math.PI / 2; chien.position.x = lerp(chien.position.x, -2.2, clamp(dt * 2, 0, 1)); }
        if(tEtat > 2 && J && !J.fini){
          J.n++;
          if(actifs(J.n).length !== actifs(J.n - 1).length){ dessinerRegles(); dire('📋 Nouvelles règles ! Regarde la feuille à gauche.', 'info', 3.5); reglesT.cible = true; }
          fouille = false; nouveau();
        }
      }
    },
    _etat:() => pax && { ...pax.v, aSaisir:aSaisir(pax.v), etat, objets:objets3d.map(o => ({ k:o.k, saisi:o.saisi, p:o.zone.getWorldPosition(new T3.Vector3()).toArray() })) },
  };
})();

/* ---------- Ouvrir, fermer, la boucle, les touches ---------- */
let enCours = null;
function ouvrirJeu(type, fin){
  if(!JEUX[type]) return false;
  K = window.ESCALE_3D.kit(); if(!K) return false;
  T3 = K.T3;
  if(!scene){ scene = new T3.Scene(); scene.background = new T3.Color(0x2A3F5F); cam = new T3.PerspectiveCamera(50, 1, .03, 60); }
  creerUi();
  quitter = fin; actif = true; ui.el.hidden = false; taille(K.L, K.H);
  choix = POSTES_DEPART.includes(type);
  changer(type);
  if(choix) choisirPoste(); else accueillir(type);
  return true;
}
function fermer(){
  if(!actif) return;
  actif = false; ui.el.hidden = true; ui.carte.hidden = true;
  if(J && !J.fini && J.total > 0){ J.fini = true; noter(); }
  J = null;
  for(const k in JEUX) JEUX[k].cacher();
  const f = quitter; quitter = null; if(f) f();
}
function taille(w, h){ L = w; H = h; if(cam){ cam.aspect = w / h; cam.updateProjectionMatrix(); } }
// la caméra glisse doucement vers le cadrage voulu (il change pendant la fouille de la valise)
function cadrer(k){
  const c = JEUX[enCours].camera(L / H);
  if(!camPos.p){ camPos.p = new T3.Vector3(); camPos.l = new T3.Vector3(); k = 1; }
  camPos.p.lerp(new T3.Vector3(...c.p), k); camPos.l.lerp(new T3.Vector3(...c.l), k); camPos.fov = lerp(camPos.fov, c.fov, k);
  cam.position.copy(camPos.p); cam.lookAt(camPos.l); if(Math.abs(cam.fov - camPos.fov) > .01){ cam.fov = camPos.fov; cam.updateProjectionMatrix(); }
}
function maj(dt){
  if(!actif) return;
  cadrer(1 - Math.exp(-dt * 5));
  if(J && !J.fini){
    J.temps = Math.max(0, J.temps - dt); J.t += dt;
    if(Math.floor(J.temps) !== Math.floor(J.temps + dt)) majHaut();
    JEUX[enCours].maj(dt);
    if(J.temps <= 0) finir('Fin du service : c\'est l\'heure de la relève.');
  }
  if(tMsg > 0){ tMsg -= dt; if(tMsg <= 0) ui.msg.className = 'mMsg'; }
  majDocs(dt);
  K.R.render(scene, cam);
}
function toucher(sx, sy){
  if(!actif || !J || J.fini) return;
  const r = new T3.Raycaster(); r.setFromCamera(new T3.Vector2(sx / L * 2 - 1, -(sy / H) * 2 + 1), cam);
  const vis = cliquables.filter(o => { for(let p = o; p; p = p.parent) if(!p.visible) return false; return true; });
  const hit = r.intersectObjects(vis, false)[0];
  if(hit && hit.object.userData.clic){ hit.object.userData.clic(hit); return; }
  for(const d of docs) d.cible = false;
}
return { ouvrir:ouvrirJeu, fermer, maj, toucher, taille, JEUX, _projeter:(x, y, z) => { const v = new T3.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * L, (1 - v.y) / 2 * H]; }, get actif(){ return actif; }, get etat(){ return J; }, _jeu:t => JEUX[t]._etat() };
})();
