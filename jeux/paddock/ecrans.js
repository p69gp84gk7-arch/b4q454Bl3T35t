/* Paddock : les écrans (accueil, QG, week-end, piste en direct, résultats, fin de saison). */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hasard = (a, b) => a + Math.random() * (b - a);
const M = window.PaddockMonde, Co = window.PaddockCourse;
const virg = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { minimumFractionDigits:0, maximumFractionDigits:d });
const virgF = (n, d = 1) => n.toFixed(d).replace('.', ',');
const meur = n => `${n < 0 ? '−' : ''}${virg(Math.abs(n), 1)} M€`;
const court = p => p.nom.split(' ').slice(1).join(' ').replace(/[^A-Za-zÀ-ÿ]/g, '').normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
const etoiles = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const coul = e => `<span class="coul" style="background:${e.c1};box-shadow:inset -2px 0 0 ${e.c2}"></span>${e.logo ? `<span class="logo">${e.logo}</span>` : ''}`;
const pneuHtml = (k, txt = '') => `<span class="pneu" style="border-color:${Co.PNEUS[k].col}">${Co.PNEUS[k].court}</span>${txt}`;
const ECRANS = ['eAccueil', 'eQG', 'eWeekend', 'eCourse', 'eResultat', 'eSaison', 'eAide'];
function montrer(id){ ECRANS.forEach(e => $(e).hidden = e !== id); window.scrollTo(0, 0); }
const gpNom = g => { const c = M.circuit(g.id); return c ? `${c.drapeau} GP ${c.gp}` : 'GP'; };

let C = M.migrer(lire('paddock-carriere', null));
function sauver(){
  if(!C) return;
  ecrire('paddock-carriere', C);
  const E = C.ecuries[C.joueur];
  ecrire('paddock-records', { ...C.records, saisons:C.historique.length, ecurie:E.nom, saison:C.saison, gpJoues:C.records.gp, argent:C.argent });
}
if(C) sauver();

/* ---------- L'accueil ---------- */
let choixEquipe = 'etoile', perso = null, reglNouv = M.reglagesDefaut();
function editeurEcurie(box, etat, change){
  box.innerHTML = `<div class="perso"><div class="apercuE"><canvas></canvas><span class="roundel"></span><b></b></div>
    <div><label>Nom de l'écurie</label><input type="text" maxlength="28" class="pNom"></div>
    <div><label>Couleur principale</label><div class="palette" data-k="c1"></div></div>
    <div><label>Couleur secondaire</label><div class="palette" data-k="c2"></div></div>
    <div><label>Logo</label><div class="logos"></div></div></div>`;
  const maj = () => {
    dessinerVoiture(box.querySelector('canvas'), etat, 120, 56);
    const r = box.querySelector('.roundel'); r.textContent = etat.logo; r.style.background = etat.c1; r.style.borderColor = etat.c2;
    box.querySelector('.apercuE b').textContent = etat.nom || '—';
    box.querySelectorAll('.palette').forEach(p => [...p.children].forEach(b => b.classList.toggle('actif', b.dataset.c === etat[p.dataset.k])));
    [...box.querySelector('.logos').children].forEach(b => b.classList.toggle('actif', b.textContent === etat.logo));
  };
  box.querySelectorAll('.palette').forEach(p => { p.innerHTML = M.COULEURS.map(c => `<button data-c="${c}" style="background:${c}" aria-label="Couleur"></button>`).join('');
    p.onclick = e => { const b = e.target.closest('button'); if(!b) return; etat[p.dataset.k] = b.dataset.c; maj(); change(etat); }; });
  const lg = box.querySelector('.logos'); lg.innerHTML = M.LOGOS.map(l => `<button>${l}</button>`).join('');
  lg.onclick = e => { const b = e.target.closest('button'); if(!b) return; etat.logo = b.textContent; maj(); change(etat); };
  const nom = box.querySelector('.pNom'); nom.value = etat.nom;
  nom.oninput = () => { etat.nom = nom.value; box.querySelector('.apercuE b').textContent = etat.nom || '—'; };
  nom.onchange = () => change(etat);
  maj();
}
// l'éditeur des réglages de la saison : nombre de GP (ou circuits un par un) et les options
function editeurReglages(box, R, change = () => {}){
  const choisis = () => R.circuits && R.circuits.length ? R.circuits : M.choisirCircuits(R.nbGP);
  const lignes = Object.entries(M.REGLAGES_SAISON).map(([k, d]) => `<div><label>${d.nom}</label><div class="chips" data-k="${k}">${d.choix.map(v => `<button data-v="${v}">${d.noms ? d.noms[v] : v}</button>`).join('')}</div></div>`).join('');
  box.innerHTML = `<div class="reglS">${lignes}<div><label>Calendrier : touche un circuit pour l'ajouter ou l'enlever</label><div class="calend"></div><p class="legende" id="calInfo" style="margin:6px 0 0"></p></div></div>`;
  const cal = box.querySelector('.calend');
  cal.innerHTML = M.circuits().map(c => `<button data-id="${c.id}"><canvas></canvas><span>${c.drapeau} ${esc(c.gp)}<br><small style="font-weight:500">${esc(c.n)}</small></span></button>`).join('');
  [...cal.children].forEach(b => Co.apercu(b.querySelector('canvas'), M.circuit(b.dataset.id), 44, 27, '#0B0C10'));
  const maj = () => {
    box.querySelectorAll('.chips').forEach(g => [...g.children].forEach(b => b.classList.toggle('actif', String(R[g.dataset.k]) === b.dataset.v)));
    const l = choisis(); [...cal.children].forEach(b => b.classList.toggle('actif', l.includes(b.dataset.id)));
    box.querySelector('#calInfo').textContent = `${l.length} Grands Prix${R.circuits && R.circuits.length ? ' (choisis un par un)' : ' (répartis sur l\'année)'}.`;
  };
  box.querySelectorAll('.chips').forEach(g => g.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    const d = M.REGLAGES_SAISON[g.dataset.k], v = d.choix.find(x => String(x) === b.dataset.v);
    R[g.dataset.k] = v; if(g.dataset.k === 'nbGP') R.circuits = null;
    maj(); change(R);
  });
  cal.onclick = e => {
    const b = e.target.closest('button'); if(!b) return;
    let l = choisis().slice(); const id = b.dataset.id;
    if(l.includes(id)){ if(l.length <= 3) return alert('Il faut au moins 3 Grands Prix.'); l = l.filter(x => x !== id); } else l.push(id);
    R.circuits = l; R.nbGP = l.length; maj(); change(R);
  };
  maj();
}
function accueil(){
  montrer('eAccueil');
  $('bContinuer').hidden = !C;
  if(C){ const E = C.ecuries[C.joueur]; $('bContinuer').textContent = `▶ Continuer : ${E.nom}, saison ${C.saison} (GP ${Math.min(C.gp + 1, C.calendrier.length)}/${C.calendrier.length})`; }
  const box = $('lEquipes'); box.innerHTML = '';
  for(const id of M.PETITES){
    const e = M.ECURIES.find(x => x.id === id);
    const b = document.createElement('button'); b.className = 'equipe' + (id === choixEquipe ? ' actif' : '');
    const cv = document.createElement('canvas'); dessinerVoiture(cv, e);
    const d = document.createElement('div');
    d.innerHTML = `<b>${esc(e.nom)}</b><small>Voiture ${Math.round(M.perfVoiture(e))}/100 · budget ${e.budget} M€ · prestige ${e.prestige}</small><small>Pilotes : ${e.pilotes.map(nomPilote).join(' et ')}</small>`;
    b.append(cv, d); b.onclick = () => { choixEquipe = id; perso = null; accueil(); };
    box.append(b);
  }
  const base = M.ECURIES.find(x => x.id === choixEquipe);
  if(!perso) perso = { nom:base.nom, c1:base.c1, c2:base.c2, logo:base.logo };
  editeurEcurie($('persoNouvelle'), perso, () => {});
  editeurReglages($('reglNouvelle'), reglNouv);
  const pseudo = (lire('compte-session', null) || {}).pseudo;
  if(!$('iNom').value) $('iNom').value = pseudo || '';
  const r = lire('paddock-records', null);
  $('aRecords').textContent = r && r.gp ? `Carrière : ${r.gp} Grands Prix, ${r.victoires} victoire${r.victoires > 1 ? 's' : ''}, ${r.podiums} podium${r.podiums > 1 ? 's' : ''}, ${r.titresC} titre${r.titresC > 1 ? 's' : ''} constructeurs.` : '';
}
function nomPilote(id){ return M.NOMS_PILOTES[id] || id; }
function dessinerVoiture(cv, e, w = 86, h = 44){
  const d = Math.min(2, devicePixelRatio || 1); cv.width = w * d; cv.height = h * d;
  const g = cv.getContext('2d'); g.scale(d, d);
  g.fillStyle = '#2A2E38'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.12)'; for(let x = 0; x < w; x += 12) g.fillRect(x, h / 2 - 1, 6, 2);
  Co.voiture(g, w / 2, h / 2, 0, e.c1, e.c2, 2.6);
}
$('bNouvelle').onclick = () => {
  if(C && !confirm('Commencer une nouvelle carrière ? La carrière en cours sera remplacée.')) return;
  C = M.nouvelleCarriere(choixEquipe, $('iNom').value.trim() || 'Directeur', perso, { ...reglNouv });
  sauver(); qg('gp');
};
$('bContinuer').onclick = () => C.phase === 'renvoi' ? finDeSaison() : qg('gp');
$('bAide').onclick = () => montrer('eAide');
$('bAideRetour').onclick = accueil;

/* ---------- Le QG ---------- */
let onglet = 'gp';
const nbGP = () => C.calendrier.length;
function qg(o = onglet){
  if(C.phase === 'renvoi') return finDeSaison();
  onglet = o; montrer('eQG');
  qgBandeau();
  [...$('qOnglets').children].forEach(b => b.classList.toggle('actif', b.dataset.o === o));
  ({ gp:ongletGP, classements:ongletClassements, voiture:ongletVoiture, usine:ongletUsine, direction:ongletDirection, pilotes:ongletPilotes, personnel:ongletPersonnel, sponsors:ongletSponsors, finances:ongletFinances, ecurie:ongletEcurie })[o]();
}
function qgBandeau(){
  const E = C.ecuries[C.joueur];
  $('qRayure').style.background = `linear-gradient(${E.c1} 60%, ${E.c2} 60%)`;
  const place = M.classementConstructeurs(C).findIndex(e => e.id === C.joueur) + 1;
  $('qNom').innerHTML = `${E.logo ? E.logo + ' ' : ''}${esc(E.nom)}${C.contrats && C.contrats.titre ? ` <span class="titreS">${C.contrats.titre.ico} ${esc(C.contrats.titre.nom)}</span>` : ''}<small>Saison ${C.saison} · ${C.gp < nbGP() ? `GP ${C.gp + 1}/${nbGP()}` : 'saison finie'} · ${place}e (objectif ${C.objectif}e) · confiance ${Math.round(C.confiance)}</small>`;
  $('qArgent').innerHTML = `${meur(C.argent)}<small>en caisse</small>`; $('qArgent').classList.toggle('neg', C.argent < 0);
}
$('qOnglets').onclick = e => { const b = e.target.closest('button'); if(b) qg(b.dataset.o); };
$('bQuitterQG').onclick = e => { e.preventDefault(); accueil(); };
const typeCircuit = circ => { const p = M.caractere(circ).puissance; return p > .6 ? 'circuit rapide : le moteur compte beaucoup' : p < .3 ? 'circuit sinueux : l\'aérodynamique compte beaucoup' : 'circuit équilibré'; };
const txtObjectif = id => (M.OBJ_COURSE.find(o => o.id === id) || {}).txt || '';
function ongletGP(){
  const box = $('qContenu'); box.innerHTML = '';
  if(C.phase === 'finSaison' || C.phase === 'mercato'){
    box.innerHTML = `<div class="carte"><h3>Fin de la saison ${C.saison}</h3><p class="sous">Les ${nbGP()} Grands Prix sont terminés.</p><button class="btn gros rouge" id="bBilan" style="margin-top:10px">${C.phase === 'mercato' ? '📝 Mercato et saison suivante' : '🏆 Bilan de la saison'}</button></div>`;
    $('bBilan').onclick = finDeSaison;
  } else {
    const gp = C.calendrier[C.gp], circ = M.circuit(gp.id);
    const d = document.createElement('div'); d.className = 'carte';
    const enCours = C.weekend && C.weekend.gp === C.gp;
    d.innerHTML = `<h3>Prochain Grand Prix · ${C.gp + 1}/${nbGP()}</h3><div class="prochain"><div><b>${esc(gpNom(gp))}</b><span class="sous">${esc(circ.n)} · ${esc(circ.inspi)}</span>
      <div class="infos"><span>${M.nbTours(C, circ)} tours</span><span>${typeCircuit(circ)}</span><span>${prevision(gp)}</span><span>🤝 objectif : ${txtObjectif(M.objectifCourse(C))}</span></div></div><canvas id="qApercu"></canvas></div>
      <button class="btn gros rouge" id="bWeekend" style="margin-top:12px">${enCours ? '▶ Reprendre le week-end' : '🏎️ Aller au circuit'}</button>`;
    box.append(d); Co.apercu($('qApercu'), circ, 150, 90, '#2A2E38');
    $('bWeekend').onclick = weekend;
    const alertes = [];
    if(!C.contrats.titre) alertes.push('💼 Pas encore de sponsor titre : va dans l\'onglet Sponsors pour en négocier un.');
    { const fin = M.contratsActifs(C).filter(c => c.fin === C.saison && !c.suite).length; if(fin && C.gp >= nbGP() - 4) alertes.push(`✍️ ${fin} contrat${fin > 1 ? 's' : ''} de sponsor fini${fin > 1 ? 'ssent' : 't'} cette saison : pense à renouveler (onglet Sponsors).`); }
    if(C.argent < 0) alertes.push('⚠️ La caisse est vide : il faut des sponsors, ou moins de dépenses.');
    if(!Object.values(C.pieces).some(p => p.conception) && !C.fabrications?.length && C.gp < nbGP() - 1) alertes.push('🔧 Aucune pièce en conception : lance-en une dans l\'onglet Voiture.');
    const afab = Object.entries(C.pieces).filter(([t, p]) => p.gens.length > 1 && ![0, 1].some(i => (C.montage[i][t] || 0) === p.gens.length - 1) && !(p.stock[p.gens.length - 1] > 0) && !(C.fabrications || []).some(f => f.type === t && f.n === p.gens.length - 1));
    if(afab.length) alertes.push(`🏭 Pièce conçue à fabriquer : ${afab.map(([t]) => M.PIECES[t].nom.toLowerCase()).join(', ')} (onglet Voiture).`);
    if(C.confiance < 35) alertes.push(`📉 La direction est ${M.humeur(C.confiance)} : il faut des résultats !`);
    if(alertes.length){ const a = document.createElement('div'); a.className = 'carte'; a.innerHTML = `<h3>À faire</h3>${alertes.map(t => `<p class="sous" style="margin:4px 0">${t}</p>`).join('')}`; box.append(a); }
  }
  const dernier = C.calendrier.slice(0, C.gp).reverse().find(g => g.resultat);
  if(dernier){
    const r = dernier.resultat, mes = r.classement.filter(x => x.ecurie === C.joueur);
    const d2 = document.createElement('div'); d2.className = 'carte';
    d2.innerHTML = `<h3>Dernier Grand Prix : ${esc(gpNom(dernier))}</h3><p class="sous">Vainqueur : <b>${esc(C.pilotes[r.classement[0].pilote].nom)}</b> (${esc(C.ecuries[r.classement[0].ecurie].nom)}). Tes pilotes : ${mes.map(x => `${esc(C.pilotes[x.pilote].nom)} ${x.abandon ? 'abandon' : x.place + 'e'}`).join(', ')}.</p>`;
    box.append(d2);
  }
  const m = document.createElement('div'); m.className = 'carte';
  m.innerHTML = `<h3>Messages</h3><div class="messages">${C.messages.slice(0, 15).map(x => `<p class="${x.type}">${esc(x.txt)}</p>`).join('')}</div>`;
  box.append(m);
}
const ciel = w => w > .6 ? '🌧️ pluie' : w > .25 ? '🌦️ humide' : '☀️ sec';
function prevision(gp){
  const ing = C.personnel.course.niv, pct = Math.round(gp.pluie * 100);
  if(gp.meteo && ing >= 4) return gp.meteo.pluie ? (gp.meteo.debut < 1 ? '🌧️ pluie dès le départ' : '🌦️ pluie en cours de course') : '☀️ course sèche (prévision sûre)';
  return pct >= 25 ? `🌦️ risque de pluie ${pct} %` : pct >= 10 ? `⛅ risque de pluie ${pct} %` : '☀️ temps sec';
}
function ongletClassements(){
  const box = $('qContenu');
  const cons = M.classementConstructeurs(C), pil = M.classementPilotes(C).slice(0, 20);
  box.innerHTML = `<div class="carte"><h3>Constructeurs</h3><table class="tab"><tr><th>#</th><th>Écurie</th><th class="n">V.</th><th class="n">Pts</th></tr>
    ${cons.map((e, i) => `<tr class="${e.id === C.joueur ? 'moi' : ''}"><td>${i + 1}</td><td>${coul(e)}${esc(e.nom)}</td><td class="n">${e.victoires}</td><td class="n">${e.points}</td></tr>`).join('')}</table></div>
    <div class="carte"><h3>Pilotes</h3><table class="tab"><tr><th>#</th><th>Pilote</th><th class="n">Pts</th></tr>
    ${pil.map((p, i) => { const e = C.ecuries[p.ecurie] || { c1:'#555', c2:'#555', nom:'—' }; return `<tr class="${p.ecurie === C.joueur ? 'moi' : ''}"><td>${i + 1}</td><td>${coul(e)}${p.drapeau} ${esc(p.nom)} <small class="legende">${esc(e.nom)}</small></td><td class="n">${p.points}</td></tr>`; }).join('')}</table></div>
    <div class="carte"><h3>Calendrier ${C.saison}</h3><table class="tab">${C.calendrier.map((g, i) => { const r = g.resultat;
      const mes = r ? r.classement.filter(x => x.ecurie === C.joueur).map(x => x.abandon ? 'ab.' : x.place + 'e').join(' · ') : '';
      return `<tr class="${i === C.gp ? 'moi' : ''}"><td>${i + 1}</td><td>${esc(gpNom(g))}</td><td>${r ? `🏆 ${esc(court(C.pilotes[r.classement[0].pilote]))}` : i === C.gp ? 'prochain' : ''}</td><td class="n">${mes}${r ? (r.objectif ? ' ✅' : ' ❌') : ''}</td></tr>`; }).join('')}</table></div>
    ${C.historique.length ? `<div class="carte"><h3>Saisons précédentes</h3><table class="tab">${C.historique.map(h => `<tr><td>${h.saison}</td><td>${h.place}e (objectif ${h.objectif}e) ${h.reussi ? '✅' : '❌'}</td><td class="n">${h.points} pts</td><td class="n">${h.victoires} V.</td></tr>`).join('')}</table></div>` : ''}`;
}
/* la voiture : les pièces */
function ongletVoiture(){
  const box = $('qContenu'), E = C.ecuries[C.joueur], tous = Object.values(C.ecuries), pil = E.pilotes.map(id => C.pilotes[id]);
  const V = [M.voitureDe(C, 0), M.voitureDe(C, 1)];
  const lignes = Object.entries(M.DOMAINES).map(([dom, D]) => {
    const autres = tous.filter(e => e.id !== C.joueur), best = Math.max(...autres.map(e => e[dom]), V[0][dom], V[1][dom]), moy = autres.reduce((s, e) => s + e[dom], 0) / autres.length;
    const x = v => clamp((v - 70) / 30 * 100, 0, 100), v = Math.max(V[0][dom], V[1][dom]);
    return `<div class="stat"><span>${D.ico} ${D.nom}</span><div class="barre"><i style="width:${x(v)}%"></i><u style="left:${x(moy)}%"></u><em style="left:${x(best)}%"></em></div><b>${virg(v)}</b></div>`;
  }).join('');
  const car = { wM:.33, wA:.37, wC:.3 }, moi = M.perfVoiture(V[0], car);
  const rang = tous.filter(e => e.id !== C.joueur && M.perfVoiture(e, car) > moi).length + 1;
  const pl = M.depensesPieces(C);
  box.innerHTML = `<div class="carte"><h3>Ta voiture · ${rang}e du plateau</h3><div class="stats4">${lignes}</div><p class="legende" style="margin:8px 0 0">Trait jaune : la meilleure écurie · trait blanc : la moyenne. Les autres écuries progressent aussi, selon leur budget.</p></div>
    ${C.reglages.plafond ? `<div class="carte"><h3>Plafond budgétaire ${C.saison}</h3><div class="jauge ${pl > M.PLAFOND * .85 ? 'rouge' : ''}"><i style="width:${clamp(pl / M.PLAFOND * 100, 0, 100)}%"></i></div><p class="sous" style="margin-top:6px">${meur(pl)} dépensés sur ${M.PLAFOND} M€ (conception et fabrication des pièces).</p></div>` : ''}
    <div class="carte"><h3>Essais aérodynamiques · période ${C.atr.periode}</h3><p class="sous">Le règlement limite la soufflerie et la simulation (CFD) : ${Math.round(C.atr.k * 100)} % de la base pour la ${C.atr.rang}e place (le 1er a 70 %, le dernier 115 %). Recalculé à mi-saison.</p>
      <div class="atr"><span>🌀 Soufflerie</span><div class="jauge"><i style="width:${C.atr.souffl ? C.atr.restS / C.atr.souffl * 100 : 0}%"></i></div><b>${C.atr.restS} / ${C.atr.souffl} h</b></div>
      <div class="atr"><span>💻 Simulation</span><div class="jauge"><i style="width:${C.atr.cfd ? C.atr.restC / C.atr.cfd * 100 : 0}%"></i></div><b>${C.atr.restC} / ${C.atr.cfd}</b></div></div>
    <div class="carte"><h3>Les pièces : touche une partie de la voiture</h3><p class="sous" style="margin-bottom:8px">Directeur technique ${etoiles(C.personnel.technique.niv)}. 1) Lance la conception d'une nouvelle version. 2) Une fois conçue, fabrique-la : une par voiture (et une de réserve en cas d'accident).</p>
      <div class="atelierV"><div class="schemaV">${schemaVoiture(E)}<p class="legende" style="margin:4px 0 0;text-align:center">✏️ en conception · 🏭 en fabrication · ⚠️ conçue, à fabriquer</p></div><div id="lPieces"></div></div></div>`;
  $('qContenu').querySelector('.schemaV').onclick = e => { const z = e.target.closest('[data-p]'); if(!z) return; selPiece = z.dataset.p; qg('voiture'); };
  const l = $('lPieces');
  if(selPiece === 'fiab'){
    const el = document.createElement('div'); el.className = 'piece';
    el.innerHTML = `<div class="t"><span style="font-size:1.3rem">🛠️</span><b>Fiabilisation</b><small>moteur, boîte, électronique</small></div><p class="sous" id="tFiab"></p><div class="act"><button class="btn petit rouge" id="bFiab"></button></div>`;
    l.append(el);
  }
  for(const [type, P] of Object.entries(M.PIECES)){
    if(type !== selPiece) continue;
    const pc = C.pieces[type], derniere = pc.gens[pc.gens.length - 1], el = document.createElement('div'); el.className = 'piece';
    const enFab = (C.fabrications || []).filter(f => f.type === type);
    const stock = Object.entries(pc.stock).filter(([, n]) => n > 0).map(([g, n]) => `v${g} ×${n}`).join(', ');
    const doms = Object.entries(P.dom).map(([d, w]) => `${M.DOMAINES[d].nom.toLowerCase()} ${Math.round(w * 100)} %`).join(', ');
    el.innerHTML = `<div class="t"><span style="font-size:1.3rem">${P.ico}</span><b>${P.nom}</b><small>compte pour : ${doms}</small></div>
      <div class="mont">${[0, 1].map(i => { const g = C.montage[i][type] || 0; return `<div>${esc(pil[i] ? court(pil[i]) : '—')} : <b>${g ? 'v' + g : 'base'}</b> ${g ? `(+${virg(M.gainGen(C, type, g), 2)})` : ''}</div>`; }).join('')}</div>
      ${pc.gens.length > 1 ? `<div class="versions">${pc.gens.slice(1).map(g => `<span class="${g.interdite ? 'interdite' : ''}">v${g.n} +${virg(g.gain, 1)}${g.spec && g.spec !== 'poly' ? ' · ' + M.SPECS[g.spec].nom.toLowerCase() : ''}${g.o ? ` · ${g.o < 0 ? '◀' : '▶'} ${esc(M.COMPROMIS[type][g.o < 0 ? 0 : 1].toLowerCase())}` : ''}${g.fiab ? ` · fiab. ${g.fiab > 0 ? '+' : ''}${virg(g.fiab, 1)}` : ''}${g.r > .55 ? ' · ⚠️ limite' : ''}${g.interdite ? ' · 🚫 interdite' : ''}</span>`).join('')}</div>` : ''}
      <small class="legende">${stock ? `Réserve : ${stock}` : 'Pas de pièce de réserve'}${enFab.length ? ` · en fabrication : ${enFab.map(f => `v${f.n} ×${f.nb}`).join(', ')}` : ''}${pc.conception ? ` · <b style="color:var(--or)">conception en cours</b> : prête au GP ${pc.conception.fin + 1}` : ''}</small>
      <div class="act"></div>`;
    const act = el.querySelector('.act');
    if(type === 'moteur' && !M.usineMoteur(E)){
      el.insertAdjacentHTML('beforeend', `<p class="sous" style="margin-top:6px">⚙️ Moteur client <b>${esc(M.MOTORISTES[E.motoriste].nom)}</b> : c'est le motoriste qui fait évoluer l'unité de puissance, pour toutes ses écuries (la tienne aussi).</p>`);
    } else if(!pc.conception && C.phase === 'saison'){
      const b = document.createElement('button'); b.className = 'btn petit rouge'; b.textContent = concep && concep.type === type ? '✖ Fermer la conception' : '✏️ Concevoir une nouvelle version';
      b.onclick = () => { concep = concep && concep.type === type ? null : nouvelleConcep(type); qg('voiture'); };
      act.append(b);
    }
    if(concep && concep.type === type && !pc.conception) el.append(panneauConception(type));
    if(derniere.n > 0 && C.phase === 'saison' && !derniere.interdite){
      const cf = M.coutFabrication(C, type);
      for(const nb of [1, 2, 3]){ const b = document.createElement('button'); b.className = 'btn petit vert'; b.textContent = `🏭 v${derniere.n} ×${nb} · ${meur(cf * nb)}`; b.disabled = C.argent < cf * nb;
        b.onclick = () => { const r = M.fabriquer(C, type, derniere.n, nb); if(r.msg) M.message(C, '🏭 ' + r.msg, r.ok ? 'bon' : 'mal'); if(!r.ok) alert(r.msg); sauver(); qg('voiture'); }; act.append(b); }
    }
    // échanger avec la réserve
    for(const g of Object.keys(pc.stock).filter(g => pc.stock[g] > 0)) for(const i of [0, 1]){
      if((C.montage[i][type] || 0) == g || !pil[i]) continue;
      const b = document.createElement('button'); b.className = 'btn petit'; b.textContent = `🔁 v${g} sur ${court(pil[i])}`;
      b.onclick = () => { M.monterPiece(C, i, type, +g); sauver(); qg('voiture'); }; act.append(b);
    }
    l.append(el);
  }
  if(selPiece !== 'fiab') return;
  const cf = M.coutFiabilisation(C);
  $('tFiab').textContent = C.fiabilisation ? `En cours : +${virg(C.fiabilisation.gain)} de fiabilité au prochain Grand Prix.` : `Moins de pannes en course. Fiabilité actuelle : ${virg(V[0].fiabilite)}.`;
  $('bFiab').textContent = C.fiabilisation ? 'En cours' : `Lancer · ${meur(cf)}`; $('bFiab').disabled = !!C.fiabilisation || C.argent < cf || C.phase !== 'saison';
  $('bFiab').onclick = () => { const r = M.lancerFiabilisation(C); if(r.msg) M.message(C, '🛠️ ' + r.msg); if(!r.ok) alert(r.msg); sauver(); qg('voiture'); };
}
// la voiture vue de dessus (le nez en haut) : chaque partie se touche pour voir sa pièce
let selPiece = 'avant', concep = null;
/* ---------- La conception d'une pièce : les réglages, l'estimation, le conseil du directeur technique ---------- */
function nouvelleConcep(type){ return { type, amb:'normale', reg:{ ...M.REGLAGE_DEFAUT, h:M.AERO.includes(type) ? Math.min(C.atr.restS, 10) : 0, cfd:M.AERO.includes(type) ? Math.min(C.atr.restC, 40) : 0 } }; }
function panneauConception(type){
  const P = M.PIECES[type], R = concep.reg, aero = M.AERO.includes(type), specOk = ['avant', 'arriere', 'fond'].includes(type);
  const est = M.estimerConception(C, type, concep.amb, R), cons = M.conseilIngenieur(C, type, concep.amb), [g, d] = M.COMPROMIS[type];
  const pct = v => Math.round(v * 100) + ' %';
  // les prochains circuits où la pièce sera bonne
  const prochains = C.calendrier.slice(C.gp + est.duree, C.gp + est.duree + 6).map(gp => { const c = M.circuit(gp.id), f = M.facteurCircuit({ n:1, o:R.o, spec:R.spec }, M.caractere(c).puissance); return `<span class="${f > 1.05 ? 'plus' : f < .95 ? 'moins' : ''}">${esc(gp.nom)} ×${virgF(f, 2)}</span>`; }).join(' · ');
  const el = document.createElement('div'); el.className = 'concep';
  el.innerHTML = `<h4>✏️ Conception : ${esc(P.nom)}</h4>
    <div class="ligneC"><span>Ambition</span><div class="choix">${Object.entries(M.AMBITIONS).map(([k, A]) => `<button data-amb="${k}" class="${concep.amb === k ? 'actif' : ''}" title="${esc(A.aide)}">${A.nom}</button>`).join('')}</div></div>
    <div class="ligneC"><span>Compromis</span><div class="curseur"><small>${esc(g)}</small><input type="range" min="-100" max="100" step="10" data-r="o" value="${Math.round(R.o * 100)}"><small>${esc(d)}</small></div></div>
    <div class="ligneC"><span>Priorité</span><div class="curseur"><small>Fiabilité</small><input type="range" min="0" max="100" step="5" data-r="a" value="${Math.round(R.a * 100)}"><small>Performance</small></div></div>
    <div class="ligneC"><span>Règlement</span><div class="curseur"><small>Prudent</small><input type="range" min="0" max="100" step="5" data-r="r" value="${Math.round(R.r * 100)}" class="${R.r > .55 ? 'danger' : ''}"><small>À la limite</small></div></div>
    ${specOk ? `<div class="ligneC"><span>Spécialité</span><div class="choix">${Object.entries(M.SPECS).map(([k, S]) => `<button data-spec="${k}" class="${R.spec === k ? 'actif' : ''}" title="${esc(S.aide)}">${S.nom}</button>`).join('')}</div></div>` : ''}
    ${aero ? `<div class="ligneC"><span>🌀 Soufflerie</span><div class="curseur"><input type="range" min="0" max="${C.atr.restS}" step="1" data-r="h" value="${R.h}"><b>${R.h} h</b><small>/ ${C.atr.restS} h</small></div></div>
      <div class="ligneC"><span>💻 Simulation</span><div class="curseur"><input type="range" min="0" max="${C.atr.restC}" step="5" data-r="cfd" value="${R.cfd}"><b>${R.cfd}</b><small>/ ${C.atr.restC}</small></div></div>` : ''}
    <div class="estim"><div><b>+${virg(est.min, 1)} à +${virg(est.max, 1)}</b><small>gain</small></div><div><b>${est.duree} GP</b><small>délai</small></div><div><b>${meur(est.cout)}</b><small>coût</small></div>
      <div><b class="${est.deception > .1 ? 'moins' : ''}">${pct(est.deception)}</b><small>risque de déception</small></div><div><b class="${est.illegal > 0 ? 'moins' : ''}">${pct(est.illegal)}</b><small>risque non conforme</small></div><div><b class="${est.fiab < 0 ? 'moins' : est.fiab > 0 ? 'plus' : ''}">${est.fiab > 0 ? '+' : ''}${virg(est.fiab, 1)}</b><small>fiabilité</small></div></div>
    ${prochains ? `<p class="legende" style="margin:6px 0">Efficacité sur les prochains circuits : ${prochains}</p>` : ''}
    <div class="conseil"><b>💡 ${esc(C.personnel.technique.nom)}, directeur technique ${etoiles(C.personnel.technique.niv)}</b>${cons.lignes.map(l => `<p>${esc(l)}</p>`).join('')}<button class="btn petit" data-conseil="1">Suivre ses conseils</button></div>
    <button class="btn rouge" data-lancer="1" ${C.argent < est.cout ? 'disabled' : ''}>🚀 Lancer la conception · ${meur(est.cout)}</button>`;
  const maj = () => qg('voiture');
  el.querySelectorAll('[data-amb]').forEach(b => b.onclick = () => { concep.amb = b.dataset.amb; maj(); });
  el.querySelectorAll('[data-spec]').forEach(b => b.onclick = () => { R.spec = b.dataset.spec; maj(); });
  el.querySelectorAll('input[data-r]').forEach(i => i.onchange = () => { const k = i.dataset.r, v = +i.value; R[k] = k === 'h' || k === 'cfd' ? v : v / 100; maj(); });
  el.querySelector('[data-conseil]').onclick = () => { Object.assign(R, cons.reg); if(!specOk) R.spec = 'poly'; maj(); };
  el.querySelector('[data-lancer]').onclick = () => {
    if(est.illegal > 0 && !confirm(`Attention : ${pct(est.illegal)} de risque que la FIA trouve la pièce non conforme (disqualification, amende, pièce interdite). On y va quand même ?`)) return;
    const r = M.lancerConception(C, type, concep.amb, R); if(r.msg) M.message(C, '✏️ ' + r.msg, r.ok ? 'info' : 'mal'); if(!r.ok) alert(r.msg); else concep = null; sauver(); maj();
  };
  return el;
}
function schemaVoiture(E){
  const etat = type => {
    if(type === 'fiab') return C.fiabilisation ? '✏️' : '';
    const pc = C.pieces[type]; if(!pc) return '';
    const n = pc.gens.length - 1;
    if(pc.conception) return '✏️';
    if((C.fabrications || []).some(f => f.type === type)) return '🏭';
    if(n > 0 && ![0, 1].some(i => (C.montage[i][type] || 0) === n) && !(pc.stock[n] > 0)) return '⚠️';
    return '';
  };
  const ver = type => { if(type === 'fiab') return virg(M.voitureDe(C, 0).fiabilite, 0); const g = Math.max(C.montage[0][type] || 0, C.montage[1][type] || 0); return g ? 'v' + g : 'base'; };
  const zone = (type, forme) => `<g data-p="${type}" class="zp ${selPiece === type ? 'sel' : ''}">${forme}</g>`;
  // étiquette dans une colonne à gauche ou à droite, reliée à la pièce par un trait
  const etiquette = (type, px, py, ly, nom, cote) => { const e = etat(type), L = 110, bx = cote === 'g' ? -226 : 116, cx = bx + L / 2, lx = cote === 'g' ? bx + L : bx;
    return `<g data-p="${type}" class="et ${selPiece === type ? 'sel' : ''}"><line x1="${px}" y1="${py}" x2="${lx}" y2="${ly}"/><circle cx="${px}" cy="${py}" r="3"/><rect x="${bx}" y="${ly - 21}" width="${L}" height="42" rx="10"/><text x="${cx}" y="${ly - 3}">${nom}</text><text class="v" x="${cx}" y="${ly + 15}">${ver(type)} ${e}</text></g>`; };
  const c1 = E.c1, c2 = E.c2;
  // la moitié gauche, recopiée en miroir pour la droite
  const deux = m => `${m}<g transform="scale(-1 1)">${m}</g>`;
  // une forme aux couleurs de l'écurie, avec son reflet (relief)
  const carrosserie = (d, fill, reflet = 'reflet') => `<path class="c" d="${d}" fill="${fill}" stroke="rgba(0,0,0,.6)" stroke-width="1"/><path d="${d}" fill="url(#${reflet})"/>`;
  // un pneu vu de dessus : la bande de roulement et le liseré jaune du flanc
  const pneu = (x, y, w, h) => `<rect class="c" x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="url(#pneu)" stroke="#000" stroke-width="1"/>
    <line x1="${x + 2.5}" y1="${y + 14}" x2="${x + 2.5}" y2="${y + h - 14}" stroke="#E8C200" stroke-width="1.4" opacity=".8"/><line x1="${x + w - 2.5}" y1="${y + 14}" x2="${x + w - 2.5}" y2="${y + h - 14}" stroke="#E8C200" stroke-width="1.4" opacity=".8"/>`;
  const nez = 'M-7 6 C-9 30 -12 62 -17 100 L17 100 C12 62 9 30 7 6 Q0 1 -7 6 Z';
  const coque = 'M-17 99 C-20 140 -26 168 -30 196 L-30 252 L30 252 L30 196 C26 168 20 140 17 99 Z';
  const ponton = 'M-29 204 L-50 209 C-68 213 -76 225 -76 246 C-75 292 -60 342 -33 396 L-22 398 C-25 330 -28 270 -29 204 Z';
  const capot = 'M-30 248 C-30 282 -26 332 -17 400 C-13 422 -10 440 -8 456 L8 456 C10 440 13 422 17 400 C26 332 30 282 30 248 Z';
  return `<svg viewBox="-228 -10 456 548" role="img" aria-label="La voiture 2026 vue de dessus">
    <defs>
      <linearGradient id="pneu" x1="0" x2="1"><stop offset="0" stop-color="#060606"/><stop offset=".35" stop-color="#242424"/><stop offset=".5" stop-color="#2E2E2E"/><stop offset=".65" stop-color="#242424"/><stop offset="1" stop-color="#060606"/></linearGradient>
      <linearGradient id="reflet" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/><stop offset=".5" stop-color="#fff" stop-opacity=".26"/><stop offset=".7" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>
      <linearGradient id="refletP" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity=".12"/><stop offset=".85" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".15"/></linearGradient>
      <linearGradient id="refletA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
      <radialGradient id="casque" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></radialGradient>
      <filter id="flou" x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect x="-90" y="14" width="180" height="500" rx="70" fill="#000" opacity=".45" filter="url(#flou)"/>
    ${zone('fond', `<path class="c" d="M-30 150 C-55 158 -78 176 -82 202 L-84 360 C-84 380 -70 392 -52 398 L-50 456 L50 456 L52 398 C70 392 84 380 84 360 L82 202 C78 176 55 158 30 150 Z" fill="#15171C" stroke="#3E434F" stroke-width="1.5"/>
      ${deux('<path d="M-79 212 C-81 260 -82 320 -81 356" fill="none" stroke="#2F333D" stroke-width="3"/><path d="M-74 222 L-77 232 M-74 262 L-77 272 M-74 302 L-77 312" stroke="#3E434F" stroke-width="1.5"/>')}
      <path d="M-50 404 L50 404 L50 456 L-50 456 Z" fill="#0D0E12"/>
      <g stroke="#3E434F" stroke-width="1.6">${[-38, -19, 0, 19, 38].map(x => `<line x1="${x * .9}" y1="406" x2="${x}" y2="456"/>`).join('')}</g>`)}
    ${zone('suspension', `${deux(`<g class="bras"><line x1="-63" y1="90" x2="-17" y2="80"/><line x1="-63" y1="93" x2="-17" y2="114"/><line x1="-63" y1="104" x2="-19" y2="96"/><line x1="-63" y1="108" x2="-19" y2="124"/><line x1="-62" y1="98" x2="-21" y2="140" class="fin"/>
        <line x1="-56" y1="430" x2="-14" y2="418"/><line x1="-56" y1="434" x2="-14" y2="452"/><line x1="-56" y1="444" x2="-12" y2="466"/></g>
        <line x1="-58" y1="437" x2="-10" y2="439" stroke="#3A3C42" stroke-width="5" stroke-linecap="round"/>
        <rect x="-66" y="80" width="5" height="30" rx="2" fill="#1B1D22"/>
        ${pneu(-95, 59, 30, 72)}${pneu(-95, 399, 37, 72)}`)}`)}
    ${zone('avant', `${deux(`<path class="c" d="M0 14 C-30 14 -60 10 -86 4 L-86 16 C-60 22 -30 26 0 26 Z" fill="#1A1C22" stroke="#000" stroke-width=".8"/>
        ${carrosserie('M0 28 C-30 28 -60 22 -86 18 L-86 26 C-60 31 -30 35 0 35 Z', c1, 'refletA')}
        ${carrosserie('M-12 37 C-36 37 -60 31 -86 28 L-86 34 C-60 39 -36 43 -12 43 Z', c2, 'refletA')}
        <path class="c" d="M-86 -1 L-81 -1 C-79 14 -79 30 -81 47 L-88 47 C-90 30 -89 12 -86 -1 Z" fill="${c1}" stroke="#000" stroke-width=".8"/>`)}
      ${carrosserie(nez, c1)}<path d="M-3 10 C-4 40 -6 70 -8 99 L8 99 C6 70 4 40 3 10 Z" fill="${c2}" opacity=".9"/>`)}
    ${carrosserie(coque, c1)}
    ${zone('pontons', `${deux(`${carrosserie(ponton, c1, 'refletP')}
        <path d="M-36 206 L-53 211 C-63 214 -68 220 -69 227 L-38 223 Z" fill="#050608"/>
        <path d="M-36 238 C-56 240 -68 258 -67 280 C-66 300 -60 322 -50 345 L-44 344 C-52 320 -58 298 -58 280 C-58 262 -50 250 -36 248 Z" fill="${c2}" opacity=".92"/>
        <g stroke="#08090B" stroke-width="1.6" stroke-linecap="round"><line x1="-46" y1="352" x2="-40" y2="352"/><line x1="-44" y1="360" x2="-38" y2="360"/><line x1="-42" y1="368" x2="-36" y2="368"/></g>
        <line x1="-29" y1="204" x2="-49" y2="200" stroke="#1E2026" stroke-width="2.4"/><ellipse class="c" cx="-57" cy="200" rx="10" ry="4.5" fill="${c1}" stroke="#000" stroke-width=".8"/>`)}`)}
    ${zone('moteur', `${carrosserie(capot, c1)}
      <path d="M0 272 L0 446" stroke="${c2}" stroke-width="3"/>
      <path d="M-12 256 C-12 250 12 250 12 256 L10 270 L-10 270 Z" fill="${c1}" stroke="#000" stroke-width=".8"/><ellipse cx="0" cy="260" rx="8.5" ry="5.5" fill="#050608"/>
      <rect x="-6" y="250" width="12" height="3.5" rx="1" fill="#FFD400"/><ellipse cx="0" cy="458" rx="4" ry="3" fill="#4A4D55"/>`)}
    <path d="M-20 188 C-23 206 -23 236 -18 256 L18 256 C23 236 23 206 20 188 Q0 178 -20 188 Z" fill="#06070A"/>
    <rect x="-9" y="196" width="18" height="5" rx="2" fill="#2C2E33"/>
    <circle cx="0" cy="229" r="11.5" fill="${c2}" stroke="#000" stroke-width=".8"/><path d="M-9 222 Q0 216 9 222 L8 226 Q0 221 -8 226 Z" fill="#111"/><circle cx="0" cy="229" r="11.5" fill="url(#casque)"/>
    <path d="M-19 252 C-25 222 -21 191 0 186 C21 191 25 222 19 252" fill="none" stroke="#1C1E23" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M-17 250 C-22 222 -19 194 0 189 C19 194 22 222 17 250" fill="none" stroke="#3A3D45" stroke-width="1.2"/>
    <line x1="0" y1="186" x2="0" y2="166" stroke="#1C1E23" stroke-width="5" stroke-linecap="round"/>
    ${zone('fiab', `<path class="c" d="M-9 456 L9 456 L7 482 L-7 482 Z" fill="#4A4F5C" stroke="#111" stroke-width="1"/><rect x="-4.5" y="482" width="9" height="4.5" rx="1" fill="#E10600"/>`)}
    ${zone('arriere', `<line x1="0" y1="476" x2="0" y2="488" stroke="#1C1E23" stroke-width="4"/>
      ${carrosserie('M-49 498 C-20 495 20 495 49 498 L49 511 C20 508 -20 508 -49 511 Z', c1, 'refletA')}
      ${carrosserie('M-49 485 C-20 483 20 483 49 485 L49 495 C20 493 -20 493 -49 495 Z', c2, 'refletA')}
      ${deux(`<path class="c" d="M-55 478 L-49 478 L-49 520 C-51 525 -54 525 -56 520 Z" fill="${c1}" stroke="#000" stroke-width=".8"/>`)}`)}
    ${etiquette('avant', -78, 24, 28, 'Aileron av.', 'g')}${etiquette('pontons', -70, 262, 210, 'Pontons', 'g')}${etiquette('fond', -82, 330, 330, 'Fond plat', 'g')}${etiquette('fiab', -8, 470, 505, 'Fiabilité', 'g')}
    ${etiquette('suspension', 80, 95, 95, 'Suspension', 'd')}${etiquette('moteur', 14, 330, 290, 'Moteur', 'd')}${etiquette('arriere', 52, 505, 505, 'Aileron arr.', 'd')}
  </svg>`;
}
const niveaux = (n, tr) => `<span class="niv">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= n ? 'on' : tr && k === n + 1 ? 'tr' : ''}"></i>`).join('')}</span>`;
function ongletUsine(){
  const box = $('qContenu');
  box.innerHTML = `<div class="carte"><h3>L'usine</h3><p class="sous">Chaque installation va du niveau 1 au niveau 5. Les travaux prennent quelques Grands Prix. Entretien : ${meur(M.entretien(C))} par Grand Prix. Caisse : <b>${meur(C.argent)}</b>.</p></div><div class="projets" id="lInst"></div>`;
  for(const [k, I] of Object.entries(M.INSTALLATIONS)){
    const st = C.installations[k], el = document.createElement('div'); el.className = 'inst';
    const cout = M.coutInstallation(st.niv), duree = M.dureeInstallation(st.niv);
    el.innerHTML = `<span class="ico">${I.ico}</span><div><b>${I.nom}</b>${niveaux(st.niv, !!st.travaux)}<small>${I.role}</small>${st.travaux ? `<small style="color:var(--or)">Travaux : niveau ${st.niv + 1} prêt au GP ${Math.min(nbGP(), st.travaux.fin + 1)}</small>` : ''}</div>`;
    const b = document.createElement('button'); b.className = 'btn petit rouge';
    b.textContent = st.niv >= 5 ? 'Maximum' : st.travaux ? 'Travaux…' : `Niveau ${st.niv + 1} · ${meur(cout)} · ${duree} GP`;
    b.disabled = st.niv >= 5 || !!st.travaux || C.argent < cout || C.phase !== 'saison';
    b.onclick = () => { if(!confirm(`Agrandir : ${I.nom} niveau ${st.niv + 1} pour ${meur(cout)} ?`)) return; const r = M.ameliorerInstallation(C, k); if(r.msg) M.message(C, '🏗️ ' + r.msg, r.ok ? 'info' : 'mal'); if(!r.ok) alert(r.msg); sauver(); qg('usine'); };
    el.append(b); $('lInst').append(el);
  }
}
function ongletDirection(){
  const box = $('qContenu'), place = M.classementConstructeurs(C).findIndex(e => e.id === C.joueur) + 1;
  const R = C.reglages, defs = M.REGLAGES_SAISON;
  const faits = C.calendrier.filter(g => g.resultat), ok = faits.filter(g => g.resultat.objectif).length;
  box.innerHTML = `<div class="carte"><h3>La confiance de la direction</h3><div class="confi"><div class="jauge ${C.confiance < 35 ? 'rouge' : ''}"><i style="width:${C.confiance}%"></i></div><span>${Math.round(C.confiance)} / 100</span></div>
      <p class="sous" style="margin-top:8px">La direction est <b>${M.humeur(C.confiance)}</b>. Sous 20 à la fin de la saison, tu seras renvoyé.</p></div>
    <div class="carte"><h3>Les objectifs</h3><p class="sous">🏆 Saison : finir <b>${C.objectif}e</b> ou mieux chez les constructeurs (tu es ${place}e).</p>
      ${C.gp < nbGP() ? `<p class="sous" style="margin-top:6px">🏁 Prochaine course : <b>${txtObjectif(M.objectifCourse(C))}</b>.</p>` : ''}
      <p class="sous" style="margin-top:6px">Objectifs de course réussis cette saison : ${ok} sur ${faits.length}.</p></div>
    <div class="carte"><h3>Demander une rallonge</h3><p class="sous" style="margin-bottom:8px">Une fois par saison, tu peux demander de l'argent à la direction. Il faut au moins 55 de confiance, et elle en perd 15.</p><button class="btn petit rouge" id="bRallonge" ${C.rallonge === C.saison ? 'disabled' : ''}>🤝 Demander une rallonge</button></div>
    <div class="carte"><h3>Les réglages de la saison</h3><table class="tab bilan">${Object.entries(defs).map(([k, d]) => `<tr><td>${d.nom}</td><td>${esc(d.noms ? d.noms[R[k]] : (k === 'nbGP' ? nbGP() : R[k]))}</td></tr>`).join('')}</table>
      <p class="legende" style="margin:8px 0 0">On peut les changer à la fin de la saison, avant le mercato.</p></div>`;
  $('bRallonge').onclick = () => { const r = M.demanderRallonge(C); M.message(C, '🤝 ' + r.msg, r.ok ? 'bon' : 'mal'); alert(r.msg); sauver(); qg('direction'); };
}
function carteNotes(p){
  const n = [['VIT', p.vitesse], ['RÉG', p.regularite], ['PNEU', p.pneus], ['DÉP', p.depassement], ['PLUIE', p.pluie], ['MORAL', Math.round(p.moral)]];
  return `<div class="notes">${n.map(([a, b]) => `<span>${a}<b>${b}</b></span>`).join('')}</div>`;
}
function ongletPilotes(){
  const box = $('qContenu'), E = C.ecuries[C.joueur], mes = E.pilotes.map(id => C.pilotes[id]);
  box.innerHTML = `<div class="carte"><h3>Tes pilotes</h3><div class="marche" id="lMes"></div></div>
    <div class="carte"><h3>Pilotes libres</h3><p class="sous" style="margin-bottom:8px">Pendant la saison, on peut engager un pilote sans volant (il faut payer la moitié du salaire du pilote remplacé). Au mercato de fin de saison, les pilotes des autres écuries en fin de contrat sont aussi disponibles.</p><div class="marche" id="lMarche"></div></div>`;
  for(const p of mes){
    const el = document.createElement('div'); el.className = 'pilote';
    el.innerHTML = `<div><b>${p.drapeau} ${esc(p.nom)}</b><br><small>${p.age} ans · ${virg(p.salaire)} M€ par saison · contrat jusqu'en ${p.fin} · ${p.points} pts cette saison</small></div><div class="etoiles">${'★'.repeat(Math.round((M.noteGlobale(p) - 70) / 6))}</div>${carteNotes(p)}`;
    const act = document.createElement('div'); act.className = 'actions';
    const dem = M.demande(C, p);
    const b = document.createElement('button'); b.className = 'btn petit'; b.textContent = `Prolonger de 2 ans (${virg(dem)} M€/saison)`;
    b.onclick = () => { const r = M.prolonger(C, p.id, 2); if(r.msg) M.message(C, '✍️ ' + r.msg, 'bon'); sauver(); qg('pilotes'); };
    act.append(b); el.append(act); $('lMes').append(el);
  }
  const libres = M.marche(C).slice(0, 12);
  if(!libres.length) $('lMarche').innerHTML = '<p class="sous">Aucun pilote libre pour le moment.</p>';
  for(const p of libres) $('lMarche').append(cartePiloteMarche(p, () => qg('pilotes')));
}
function cartePiloteMarche(p, apres){
  const E = C.ecuries[C.joueur], dem = M.demande(C, p);
  const el = document.createElement('div'); el.className = 'pilote';
  const eq = p.ecurie ? C.ecuries[p.ecurie].nom : 'sans volant';
  el.innerHTML = `<div><b>${p.drapeau} ${esc(p.nom)}</b><br><small>${p.age} ans · ${esc(eq)} · demande ${virg(dem)} M€ par saison${p.junior ? ' · jeune espoir' : ''}</small></div><div class="etoiles">${'★'.repeat(Math.max(1, Math.round((M.noteGlobale(p) - 70) / 6)))}</div>${carteNotes(p)}`;
  const act = document.createElement('div'); act.className = 'actions';
  for(const id of E.pilotes){
    const r = C.pilotes[id], b = document.createElement('button'); b.className = 'btn petit rouge'; b.textContent = `Remplacer ${court(r)}`;
    b.onclick = () => { if(!confirm(`Engager ${p.nom} à la place de ${r.nom} ?`)) return; const res = M.engager(C, p.id, r.id, 2); alert(res.msg); if(res.ok) M.message(C, '✍️ ' + res.msg, 'bon'); sauver(); apres(); };
    act.append(b);
  }
  el.append(act); return el;
}
function ongletPersonnel(){
  const box = $('qContenu'); box.innerHTML = '';
  for(const [poste, Pd] of Object.entries(M.POSTES)){
    const e = C.personnel[poste], d = document.createElement('div'); d.className = 'carte';
    d.innerHTML = `<h3>${Pd.ico} ${Pd.nom}</h3><p style="margin:0"><b>${e.drapeau} ${esc(e.nom)}</b> <span class="etoiles">${etoiles(e.niv)}</span> · ${virg(e.salaire)} M€ par saison</p><p class="sous" style="margin:4px 0 8px">${Pd.role}</p><div class="marche"></div>`;
    const l = d.querySelector('.marche');
    C.candidats[poste].forEach((c, i) => {
      const el = document.createElement('div'); el.className = 'offre';
      const prime = Math.round(c.salaire * .2 * 10) / 10 + Math.round(e.salaire * .25 * 10) / 10;
      el.innerHTML = `<span class="ico">${c.drapeau}</span><div><b>${esc(c.nom)}</b> <span class="etoiles">${etoiles(c.niv)}</span><small>${virg(c.salaire)} M€ par saison · à payer tout de suite : ${virg(prime)} M€</small></div>`;
      const b = document.createElement('button'); b.className = 'btn petit'; b.textContent = 'Embaucher'; b.disabled = C.argent < prime;
      b.onclick = () => { const r = M.embaucher(C, poste, i); if(r.msg) M.message(C, '👷 ' + r.msg, r.ok ? 'bon' : 'mal'); if(!r.ok) alert(r.msg); sauver(); qg('personnel'); };
      el.append(b); l.append(el);
    });
    box.append(d);
  }
}
let nego = null;   // la négociation ouverte : { nom, P }
const humeurSponsor = i => i >= 75 ? 'ravi' : i >= 62 ? 'intéressé' : i >= 50 ? 'hésitant' : i >= 30 ? 'réticent' : 'refuse';
const patience = n => `<span class="patience" title="Patience">${[1, 2, 3].map(k => k <= n ? '●' : '○').join('')}</span>`;
function ongletSponsors(){
  const box = $('qContenu'), n = nbGP(), E = M.EMPLACEMENTS;
  const total = M.contratsActifs(C).reduce((t, c) => t + c.parGP, 0);
  box.innerHTML = `<div class="carte"><h3>Tes contrats (saison ${C.saison})</h3><p class="sous" style="margin-bottom:8px">${meur(total)} garantis par Grand Prix. Réputation ${Math.round(C.reputation)} : plus elle est haute, plus les sponsors paient.</p><div class="marche" id="lContrats"></div></div>
    <div class="carte"><h3>Offres</h3><p class="sous" style="margin-bottom:8px">Négocie la durée, l'argent et les clauses. Un sponsor perd patience après 3 propositions refusées, et une offre ne reste pas éternellement.</p><div class="marche" id="lOffres"></div></div>`;
  for(const [e, S] of Object.entries(E)){
    const c = C.contrats[e], el = document.createElement('div');
    if(!c){ const nb = C.offres.filter(o => o.empl === e && !o.renouv && !o.renego).length; el.className = 'slot'; el.textContent = `${S.ico} ${S.nom} : place libre${nb ? ` · ${nb} offre${nb > 1 ? 's' : ''}` : ''}`; $('lContrats').append(el); continue; }
    const derniere = c.fin === C.saison, rest = c.fin - C.saison + 1;
    el.className = 'contrat';
    el.innerHTML = `<div class="tete"><span class="ico">${c.ico}</span><div><b>${esc(c.nom)}</b><small>${S.ico} ${S.nom} · ${M.SECTEURS[c.secteur]} · ${derniere ? '<span class="moins">dernière saison</span>' : `jusqu'en ${c.fin} (${rest} saisons)`}</small></div></div>
      <small>💶 ${virg(c.parGP, 2)} M€ par Grand Prix · prime de ${virg(c.prime, 2)} M€ si ${esc(c.txtObjectif)}</small>
      <small>🎯 Objectif de saison : ${c.objSaison}e ou mieux chez les constructeurs (prime de ${meur(c.parGP * 3)}) · si manqué : ${M.PENALITES[c.penalite].txt}</small>
      ${c.exclusif || c.option ? `<small>${c.exclusif ? `🔒 Exclusivité ${M.SECTEURS[c.secteur]}` : ''}${c.exclusif && c.option ? ' · ' : ''}${c.option ? '🔁 Option de prolongation d\'un an' : ''}</small>` : ''}
      ${c.suite ? `<small class="plus">✅ Renouvelé : ${virg(c.suite.parGP, 2)} M€ par GP jusqu'en ${c.suite.fin}</small>` : ''}
      <div class="confi"><small>Satisfaction</small><div class="jauge ${c.satisfaction < 40 ? 'rouge' : ''}"><i style="width:${c.satisfaction}%"></i></div><span>${Math.round(c.satisfaction)}</span></div>
      <div class="actions"></div>`;
    const act = el.querySelector('.actions'), bouton = (txt, cls, f, off) => { const b = document.createElement('button'); b.className = 'btn petit ' + cls; b.textContent = txt; b.disabled = !!off; b.onclick = f; act.append(b); };
    const ouvrir = () => { const r = M.ouvrirNegociation(C, e); if(!r.ok){ if(r.msg) alert(r.msg); return; } const o = C.offres[r.idx]; nego = { nom:o.nom, P:M.propositionDefaut(C, o) }; sauver(); qg('sponsors'); };
    if(derniere && !c.suite){
      if(c.option) bouton('🔁 Lever l\'option (+1 an)', 'vert', () => { const r = M.leverOption(C, e); if(r.msg) M.message(C, r.msg, 'bon'); sauver(); qg('sponsors'); });
      bouton('✍️ Renouveler', 'vert', ouvrir);
    } else if(!derniere) bouton('💬 Renégocier', '', ouvrir, c.satisfaction < 65 || c.reneg === C.saison);
    const ind = M.indemniteSponsor(C, e);
    bouton(`✂️ Rompre (${meur(ind)})`, 'rouge', () => { if(!confirm(`Rompre le contrat avec ${c.nom} ? Il faut payer une indemnité de ${meur(ind)}, et la réputation baisse un peu.`)) return; const r = M.rompreSponsor(C, e); if(r.msg) M.message(C, r.msg, 'mal'); sauver(); qg('sponsors'); });
    $('lContrats').append(el);
  }
  C.offres.forEach((o, i) => {
    const el = document.createElement('div'); el.className = 'offre';
    const S = E[o.empl], pris = !o.renouv && !o.renego && C.contrats[o.empl], reste = o.expire - C.gp;
    el.innerHTML = `<span class="ico">${o.ico}</span><div><b>${esc(o.nom)}</b> ${patience(o.patience)}<small>${o.renouv ? '✍️ Renouvellement · ' : o.renego ? '💬 Renégociation · ' : ''}${S.ico} ${S.nom} · ${M.SECTEURS[o.secteur]} · environ ${virg(o.base, 2)} M€ par GP</small>
      <small>Souhaite : ${o.pref.duree} saison${o.pref.duree > 1 ? 's' : ''}${o.pref.exclusif ? ', l\'exclusivité' : ''}${o.pref.penalite !== 'aucune' ? `, une clause « ${M.PENALITES[o.pref.penalite].nom.toLowerCase()} »` : ''} · ${o.renouv ? 'jusqu\'à la fin de la saison' : `encore ${reste} GP`}</small></div>`;
    const b = document.createElement('button'); b.className = 'btn petit vert'; b.textContent = nego && nego.nom === o.nom ? 'Fermer' : 'Négocier'; b.disabled = !!pris;
    b.onclick = () => { nego = nego && nego.nom === o.nom ? null : { nom:o.nom, P:M.propositionDefaut(C, o) }; qg('sponsors'); };
    el.append(b); $('lOffres').append(el);
    if(nego && nego.nom === o.nom) $('lOffres').append(panneauNego(o, i));
  });
  if(!C.offres.length) $('lOffres').innerHTML = '<p class="sous">Pas d\'offre pour le moment. De nouvelles arrivent après les Grands Prix, quand une place est libre.</p>';
}
function panneauNego(o, idx){
  const P = nego.P, n = nbGP(), base = o.base, maxSig = Math.max(1, Math.round(base * n * .6));
  const el = document.createElement('div'); el.className = 'concep nego';
  const pref = v => v ? ' ⭐' : '';
  el.innerHTML = `<h4>🤝 Négociation avec ${esc(o.nom)} ${patience(o.patience)}</h4>
    <div class="ligneC"><span>Durée</span><div class="choix">${[1, 2, 3].map(d => `<button data-duree="${d}" class="${P.duree === d ? 'actif' : ''}">${d} saison${d > 1 ? 's' : ''}${pref(o.pref.duree === d)}</button>`).join('')}</div></div>
    <div class="ligneC"><span>Par GP</span><div class="curseur"><input type="range" min="${Math.round(base * 50)}" max="${Math.round(base * 160)}" step="1" data-n="parGP" value="${Math.round(P.parGP * 100)}"><b data-v="parGP"></b></div></div>
    <div class="ligneC"><span>Signature</span><div class="curseur"><input type="range" min="0" max="${maxSig * 10}" step="5" data-n="signature" value="${Math.round(P.signature * 10)}"><b data-v="signature"></b></div></div>
    <div class="ligneC"><span>Prime de course</span><div class="choix">${o.objectifs.map(id => `<button data-obj="${id}" class="${P.objectif === id ? 'actif' : ''}">${esc(M.txtObjectifSponsor(C, id, o.rivale))} · ${virg(M.primeObjectif(C, o.empl, id), 2)} M€</button>`).join('')}</div></div>
    <div class="ligneC"><span>Exclusivité</span><div class="choix"><button data-excl="1" class="${P.exclusif ? 'actif' : ''}">Oui, seul en ${M.SECTEURS[o.secteur]}${pref(o.pref.exclusif)}</button><button data-excl="0" class="${!P.exclusif ? 'actif' : ''}">Non${pref(!o.pref.exclusif)}</button></div></div>
    <div class="ligneC"><span>Si objectif ${o.objSaison}e manqué</span><div class="choix">${Object.entries(M.PENALITES).map(([k, Pe]) => `<button data-pen="${k}" class="${P.penalite === k ? 'actif' : ''}" title="${esc(Pe.txt)}">${Pe.nom}${pref(o.pref.penalite === k)}</button>`).join('')}</div></div>
    <div class="ligneC"><span>Option +1 an</span><div class="choix"><button data-opt="1" class="${P.option ? 'actif' : ''}">Oui, pour l'écurie</button><button data-opt="0" class="${!P.option ? 'actif' : ''}">Non</button></div></div>
    <p class="legende" style="margin:0">⭐ ce que le sponsor préfère · Baisse : ${M.PENALITES.baisse.txt} · Rupture : ${M.PENALITES.rupture.txt} (il paie plus).</p>
    <div class="estim"><div><b data-v="saison"></b><small>par saison</small></div><div><b data-v="total"></b><small>sur tout le contrat</small></div><div><b data-v="humeur"></b><small>le sponsor</small></div></div>
    <div class="confi"><small>Intérêt</small><div class="jauge"><i data-v="jauge"></i></div><span data-v="pct"></span></div>
    ${o.contre ? `<div class="conseil"><b>📩 Contre-proposition de ${esc(o.nom)}</b><p>${virg(o.contre.parGP, 2)} M€ par GP${o.contre.signature ? ` et ${virg(o.contre.signature, 1)} M€ à la signature` : ''}, ${o.contre.duree} saison${o.contre.duree > 1 ? 's' : ''}, mêmes clauses que ta proposition.</p><button class="btn petit vert" data-contre="1">✅ Accepter</button> <button class="btn petit" data-reprendre="1">Reprendre ses chiffres</button></div>` : ''}
    <button class="btn rouge" data-proposer="1">📨 Proposer</button>`;
  const maj = () => {
    const i = M.interet(C, o, P), parSaison = P.parGP * n + P.signature / P.duree;
    el.querySelector('[data-v="parGP"]').textContent = `${virg(P.parGP, 2)} M€`;
    el.querySelector('[data-v="signature"]').textContent = `${virg(P.signature, 1)} M€`;
    el.querySelector('[data-v="saison"]').textContent = meur(parSaison);
    el.querySelector('[data-v="total"]').textContent = meur(P.parGP * n * P.duree + P.signature);
    el.querySelector('[data-v="humeur"]').textContent = humeurSponsor(i);
    el.querySelector('[data-v="jauge"]').style.width = i + '%';
    el.querySelector('.nego .confi .jauge').classList.toggle('rouge', i < 50);
    el.querySelector('[data-v="pct"]').textContent = i + ' %';
  };
  const refaire = () => qg('sponsors');
  el.querySelectorAll('[data-duree]').forEach(b => b.onclick = () => { P.duree = +b.dataset.duree; refaire(); });
  el.querySelectorAll('[data-obj]').forEach(b => b.onclick = () => { P.objectif = b.dataset.obj; refaire(); });
  el.querySelectorAll('[data-excl]').forEach(b => b.onclick = () => { P.exclusif = b.dataset.excl === '1'; refaire(); });
  el.querySelectorAll('[data-pen]').forEach(b => b.onclick = () => { P.penalite = b.dataset.pen; refaire(); });
  el.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { P.option = b.dataset.opt === '1'; refaire(); });
  el.querySelectorAll('input[data-n]').forEach(inp => inp.oninput = () => { P[inp.dataset.n] = inp.dataset.n === 'parGP' ? +inp.value / 100 : +inp.value / 10; maj(); });
  const fini = r => { if(r.msg) M.message(C, '💼 ' + r.msg, r.ok ? 'bon' : 'mal'); if(r.ok || r.fin) nego = null; if(!r.ok) alert(r.msg); sauver(); refaire(); };
  el.querySelector('[data-proposer]').onclick = () => fini(M.proposer(C, idx, { ...P }));
  if(o.contre){
    el.querySelector('[data-contre]').onclick = () => fini(M.accepterContre(C, idx));
    el.querySelector('[data-reprendre]').onclick = () => { Object.assign(P, o.contre); refaire(); };
  }
  setTimeout(maj);
  return el;
}
function ongletEcurie(){
  const E = C.ecuries[C.joueur], box = $('qContenu');
  box.innerHTML = '<div class="carte"><h3>Ton écurie</h3><p class="sous" style="margin-bottom:10px">Change quand tu veux le nom, les couleurs de la voiture et le logo. C\'est gratuit !</p><div id="persoQG"></div></div>';
  editeurEcurie($('persoQG'), { nom:E.nom, c1:E.c1, c2:E.c2, logo:E.logo || '⭐' }, etat => { M.personnaliser(C, etat); sauver(); qgBandeau(); });
}
function ongletFinances(){
  const E = C.ecuries[C.joueur], k = M.parGP(C);
  const salP = E.pilotes.reduce((s, id) => s + C.pilotes[id].salaire, 0), salE = Object.values(C.personnel).reduce((s, e) => s + e.salaire, 0);
  const spons = M.contratsActifs(C).reduce((s, x) => s + x.parGP, 0);
  const lignes = C.finances.slice().reverse().slice(0, 40);
  $('qContenu').innerHTML = `<div class="carte"><h3>Par Grand Prix (${nbGP()} dans la saison)</h3><table class="tab bilan">
    <tr><td>💼 Sponsors (hors primes)</td><td class="plus">+${meur(spons)}</td></tr>
    <tr><td>👤 Salaires des pilotes (${meur(salP)} par saison)</td><td class="moins">−${meur(salP / 12 * k)}</td></tr>
    <tr><td>👷 Salaires du personnel (${meur(salE)} par saison)</td><td class="moins">−${meur(salE / 12 * k)}</td></tr>
    <tr><td>🏭 Usine, entretien des installations et transport</td><td class="moins">−${meur(.6 * k + M.entretien(C))}</td></tr></table>
    <p class="sous" style="margin-top:8px">En fin de saison, une prime selon la place chez les constructeurs : de ${M.PRIMES[0]} M€ (1er) à ${M.PRIMES[M.PRIMES.length - 1]} M€ (${M.PRIMES.length}e). Les pièces, les travaux et les embauches se paient tout de suite.</p></div>
    <div class="carte"><h3>Dernières opérations</h3><table class="tab bilan">${lignes.map(f => `<tr><td>${esc(f.txt)} <small class="legende">${f.saison} · GP ${f.gp + (f.txt.startsWith('🏆') ? 0 : 1)}</small></td><td class="${f.montant >= 0 ? 'plus' : 'moins'}">${f.montant >= 0 ? '+' : ''}${meur(f.montant)}</td></tr>`).join('') || '<tr><td>Rien pour le moment.</td></tr>'}</table></div>`;
}

/* ---------- Le week-end ---------- */
let W = null, R = null, modeC = 'course';
const DUREES = { EL:60, Q1:18, Q2:15, Q3:12 };
const NOMS_SEANCE = { EL:'Essais libres', Q1:'Qualifications · Q1', Q2:'Qualifications · Q2', Q3:'Qualifications · Q3', course:'Course' };
const mesPilotes = () => C.ecuries[C.joueur].pilotes.map(id => C.pilotes[id]);
const qualiteRetour = p => clamp((p.regularite - 70) / 30 * .5 + (C.personnel.course.niv - 1) / 4 * .5, 0, 1);
const milieu = connu => Object.fromEntries(Object.entries(connu).map(([k, [a, b]]) => [k, Math.round((a + b) / 2)]));
function weekend(){
  const gp = C.calendrier[C.gp], circ = M.circuit(gp.id), tours = M.nbTours(C, circ);
  if(!gp.meteo){
    const pluie = Math.random() < gp.pluie;
    gp.meteo = { pluie, debut:hasard(-1.5, tours - 3), duree:hasard(2, 9), force:hasard(.35, 1),
      el:Math.random() < gp.pluie * .7 ? hasard(.3, .9) : 0, q:Math.random() < gp.pluie * .7 ? hasard(.3, .9) : 0 };
  }
  if(!C.weekend || C.weekend.gp !== C.gp){
    const largeur = 100 - 14 * C.installations.simulateur.niv;
    W = C.weekend = { gp:C.gp, etape:C.reglages.essais ? 'EL' : 'Q', reg:{}, connu:{}, conf:{}, retours:{}, jeux:{}, toursEL:{}, grille:null, q:{}, pneusDepart:{}, objectif:M.objectifCourse(C), usureMes:{}, strat:{} };
    gp.objectif = W.objectif;
    for(const p of mesPilotes()){
      W.connu[p.id] = Co.connaissanceDepart(circ, p.id, largeur);
      W.reg[p.id] = { av:50, ar:50, susp:50, haut:50, carr:50 };
      W.jeux[p.id] = Object.entries(Co.JEUX).flatMap(([t, nb]) => Array.from({ length:nb }, () => ({ t, u:0 })));
      W.pneusDepart[p.id] = 'M';
      W.usureMes[p.id] = Object.fromEntries(Object.keys(Co.PNEUS).map(k => [k, { tours:0, z:zUsure() }]));
      if(!C.reglages.essais){
        // pas d'essais libres : l'ingénieur règle la voiture d'après le simulateur
        Co.retourPilote(circ, p.id, W.reg[p.id], W.connu[p.id], 4, qualiteRetour(p));
        W.reg[p.id] = milieu(W.connu[p.id]);
      }
      W.conf[p.id] = null;
    }
  }
  W = C.weekend;
  sauver();
  pageWeekend();
}
const confReelle = (circ, pid) => Co.confiance(W.reg[pid], Co.reglageIdeal(circ, pid));
function pageWeekend(){
  montrer('eWeekend');
  const gp = C.calendrier[C.gp], circ = M.circuit(gp.id), box = $('wContenu'), m = gp.meteo, mes = mesPilotes();
  const et = W.etape, ordreE = ['EL', 'Q', 'course'], idx = ordreE.indexOf(et);
  const etape = (k, ico, titre, txt, bouton) => `<div class="etape ${k === et ? 'ici' : ordreE.indexOf(k) < idx ? 'fait' : ''}"><span class="ico">${ico}</span><div><b>${titre}</b><small>${txt}</small></div>${bouton || ''}</div>`;
  const confTxt = mes.map(p => `${esc(court(p))} ${W.conf[p.id] != null ? Math.round(W.conf[p.id] * 100) + ' %' : '?'}`).join(' · ');
  const grille = W.grille ? W.grille.map((id, i) => ({ id, place:i + 1 })).filter(x => mes.some(p => p.id === x.id)).map(x => `${esc(court(C.pilotes[x.id]))} ${x.place}e`).join(' · ') : '';
  box.innerHTML = `<div class="tete"><button class="btn" id="wRetour">‹ QG</button></div>
    <div class="wkTete"><div><h2>${esc(gpNom(gp))}</h2><p class="sous">${esc(circ.n)} · ${esc(circ.inspi)} · ${(circ.metres / 1000).toFixed(3).replace('.', ',')} km · ${M.nbTours(C, circ)} tours</p>
      <div class="infos"><span>${typeCircuit(circ)}</span><span>🤝 objectif : ${esc(txtObjectif(W.objectif))}</span></div>
      <div class="meteoS" style="margin-top:8px">${C.reglages.essais ? `<span>Essais : ${ciel(m.el)}</span>` : ''}<span>Qualifs : ${ciel(m.q)}</span><span>Course : ${(pm => `${pm >= .6 ? '🌧️' : pm >= .25 ? '🌦️' : '☀️'} risque de pluie ${Math.round(pm * 100)} %`)(Math.max(0, ...prevCourse().map(x => x.p)))}</span></div></div><canvas id="wApercu"></canvas></div>
    <div class="etapes">
      ${C.reglages.essais ? etape('EL', '🔧', 'Essais libres · 1 h', et === 'EL' ? 'Règle la voiture : fais rouler tes pilotes, écoute leurs avis.' : `Confiance des pilotes : ${confTxt}`,
        et === 'EL' ? '<span style="display:flex;flex-direction:column;gap:4px"><button class="btn petit rouge" id="wEL">▶ En piste</button><button class="btn petit" id="wELpasse">⏩ Passer</button></span>' : '') : ''}
      ${etape('Q', '⏱️', C.reglages.qualifs === 'direct' ? 'Qualifications · Q1, Q2, Q3' : 'Qualifications rapides', et === 'Q' ? 'Les 6 derniers sont éliminés en Q1, puis en Q2. Le Q3 donne les 10 premières places.' : grille ? `Sur la grille : ${grille}` : '',
        et === 'Q' ? `<button class="btn petit rouge" id="wQ">▶ ${C.reglages.qualifs === 'direct' ? 'Q1' : 'Lancer'}</button>` : '')}
      ${etape('course', '🏁', 'La course', et === 'course' ? 'Vérifie la stratégie de pneus de chaque pilote, plus bas.' : '', et === 'course' ? '<button class="btn petit rouge" id="wCourse">🚦 Départ</button>' : '')}
    </div>
    <div class="carte"><h3>Réglages de la voiture</h3><div id="wRegl" class="marche"></div>${et !== 'EL' && C.reglages.essais ? '<p class="legende" style="margin:6px 0 0">Après les essais libres, les réglages ne bougent plus (parc fermé).</p>' : ''}</div>
    <div class="carte"><h3>Météo de la course, tour par tour</h3><div id="wMeteo"></div></div>
    ${et === 'course' ? `<div class="carte"><h3>📋 Stratégie de course</h3><div id="wStrat"></div></div>` : ''}
    ${W.grille ? `<div class="carte"><h3>La grille de départ</h3><div class="grille">${W.grille.map((id, i) => { const p = C.pilotes[id], e = C.ecuries[p.ecurie];
      return `<div class="${p.ecurie === C.joueur ? 'moi' : ''}"><b>${i + 1}</b><span class="coul" style="background:${e.c1}"></span><span>${esc(p.nom)}</span><span class="legende">${W.tempsQ && W.tempsQ[id] ? W.tempsQ[id] : ''}</span></div>`; }).join('')}</div></div>` : ''}`;
  Co.apercu($('wApercu'), circ, 280, 168, '#1A1E25');
  $('wRetour').onclick = () => qg('gp');
  for(const p of mes){
    const d = document.createElement('div'); d.className = 'offre';
    const c = W.conf[p.id];
    d.innerHTML = `<span class="ico">${p.drapeau}</span><div><b>${esc(p.nom)}</b><small>${c != null ? `Confiance mesurée : ${Math.round(c * 100)} %` : 'Pas encore essayée en piste'} · ${Object.keys(Co.REGLAGES).map(k => W.reg[p.id][k]).join(' / ')}</small></div>`;
    const b = document.createElement('button'); b.className = 'btn petit'; b.textContent = et === 'EL' ? '🔧 Régler' : '👁️ Voir';
    b.onclick = () => ouvrirReglages(p.id, et === 'EL', pageWeekend);
    d.append(b); $('wRegl').append(d);
  }
  $('wMeteo').innerHTML = htmlMeteo(prevCourse()) + `<p class="legende" style="margin:6px 0 0">${legendeMeteo()}</p>`;
  if(et === 'course'){
    assurerStrat();
    $('wStrat').innerHTML = mes.map(p => { const st = stratDe(p.id); return `<div class="stratP"><div class="h"><b>${p.drapeau} ${esc(p.nom)}</b><button class="btn petit" data-p="${p.id}">✏️ Modifier</button></div>${st ? barreStrat(st.relais, M.nbTours(C, circ)) + `<small class="legende">${esc(texteStrat(st.relais))}</small>` : '<small class="legende">Pas de stratégie possible (plus de pneus ?)</small>'}</div>`; }).join('')
      + '<p class="legende" style="margin:6px 0 0">L\'ingénieur applique la stratégie pendant la course. Il ne la change que si c\'est nécessaire (pluie, piste qui sèche, pneus qui s\'usent trop vite, voiture de sécurité juste avant l\'arrêt prévu).</p>';
    $('wStrat').querySelectorAll('[data-p]').forEach(b => b.onclick = () => ouvrirStrategie(b.dataset.p));
    $('wCourse').onclick = lancerCourse;
  }
  if($('wEL')) $('wEL').onclick = () => lancerSeance('EL');
  if($('wELpasse')) $('wELpasse').onclick = () => {
    if(!confirm('Passer les essais libres ? L\'ingénieur règle la voiture avec ce qu\'il sait déjà (moins bien qu\'avec des essais).')) return;
    for(const p of mes){ Co.retourPilote(circ, p.id, W.reg[p.id], W.connu[p.id], 2, qualiteRetour(p)); W.reg[p.id] = milieu(W.connu[p.id]); }
    W.etape = 'Q'; sauver(); pageWeekend();
  };
  if($('wQ')) $('wQ').onclick = () => C.reglages.qualifs === 'direct' ? lancerSeance('Q1') : qualifsRapides();
}
// le panneau des réglages : 5 curseurs, la zone conseillée, l'avis du pilote
function ouvrirReglages(pid, modifiable, apres = () => {}){
  const p = C.pilotes[pid], gp = C.calendrier[C.gp], circ = M.circuit(gp.id), reg = W.reg[pid], connu = W.connu[pid], avis = W.retours[pid] || [];
  const v = R && R.seance && R.voitures.find(x => x.id === pid), enPiste = v && v.etat !== 'garage';
  const peut = modifiable && !enPiste;
  const f = $('fRegl');
  const dessiner = () => {
    const c = W.conf[pid];
    f.innerHTML = `<div class="tete"><h2 style="font-size:1.25rem">🔧 ${esc(p.nom)}</h2><button class="btn petit droite" id="rgFermer">✕ Fermer</button></div>
      <div class="confi"><span>Confiance</span><div class="jauge"><i style="width:${c != null ? c * 100 : 0}%"></i></div><span>${c != null ? Math.round(c * 100) + ' %' : '?'}</span></div>
      <p class="legende" style="margin:0">${peut ? 'En vert : la zone conseillée, qui se resserre à chaque sortie en piste. La confiance est mesurée quand le pilote revient au garage.' : enPiste ? 'Le pilote est en piste : on règle quand il revient au garage.' : 'Parc fermé : les réglages ne bougent plus.'}</p>
      ${Object.entries(Co.REGLAGES).map(([k, D]) => { const [a, b] = connu[k], av = avis.find(x => x.k === k);
        return `<div class="rg" data-k="${k}"><div class="h"><span>${D.ico}</span><b>${D.nom}</b>${av ? `<small>${['🙁', '😐', '🙂', '😀'][av.note]}</small>` : ''}<span>${reg[k]}</span></div>
          <div style="display:flex;gap:6px;align-items:center">${peut ? '<div class="pm"><button data-d="-1">−</button></div>' : ''}<div class="piste" style="flex:1"><div class="zc" style="left:${a}%;width:${b - a}%"></div><input type="range" min="0" max="100" value="${reg[k]}" ${peut ? '' : 'disabled'}></div>${peut ? '<div class="pm"><button data-d="1">+</button></div>' : ''}</div>
          <div class="bornes"><span>${D.bas}</span><span>${D.haut}</span></div>${av ? `<div class="avis">🎧 « ${esc(av.txt)} »</div>` : ''}</div>`; }).join('')}
      ${peut ? '<button class="btn" id="rgIng">🎧 Laisser l\'ingénieur régler (milieu des zones)</button>' : ''}`;
    f.querySelector('#rgFermer').onclick = () => { $('vRegl').hidden = true; apres(); };
    if(!peut) return;
    f.querySelectorAll('.rg').forEach(el => {
      const k = el.dataset.k, inp = el.querySelector('input');
      const fixer = val => { reg[k] = clamp(Math.round(val), 0, 100); inp.value = reg[k]; el.querySelector('.h span:last-child').textContent = reg[k]; appliquerReglage(pid); };
      inp.oninput = () => fixer(+inp.value);
      el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => fixer(reg[k] + +b.dataset.d * 2));
    });
    f.querySelector('#rgIng').onclick = () => { Object.assign(reg, milieu(connu)); appliquerReglage(pid); dessiner(); };
  };
  dessiner();
  $('vRegl').hidden = false;
}
// les réglages comptent pour la voiture en séance (sa prochaine sortie)
function appliquerReglage(pid){
  sauver();
  if(!R) return;
  const v = R.voitures.find(x => x.id === pid), circ = R.T.c; if(!v) return;
  const ideal = Co.reglageIdeal(circ, pid);
  v.reglage = Co.confiance(W.reg[pid], ideal); v.carrossage = (W.reg[pid].carr - ideal.carr) / 50;
}
$('vRegl').onclick = e => { if(e.target === $('vRegl')){ $('vRegl').hidden = true; if(!$('eWeekend').hidden) pageWeekend(); } };

/* ---------- La stratégie de pneus ---------- */
const zUsure = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
function assurerStrat(){
  if(!W) return;
  W.usureMes = W.usureMes || {}; W.strat = W.strat || {};
  for(const p of mesPilotes()) if(!W.usureMes[p.id]) W.usureMes[p.id] = Object.fromEntries(Object.keys(Co.PNEUS).map(k => [k, { tours:0, z:zUsure() }]));
}
const circGP = () => M.circuit(C.calendrier[C.gp].id);
// la prévision de l'ingénieur, tour par tour (vue depuis le tour « depuis »)
function prevCourse(depuis = 0){
  const gp = C.calendrier[C.gp], tours = M.nbTours(C, circGP());
  if(!W.bruitMeteo){ W.bruitMeteo = Co.bruitPrevision(gp.meteo, tours, gp.pluie, C.personnel.course.niv); sauver(); }
  return Co.previsionMeteo(gp.meteo, tours, W.bruitMeteo, C.personnel.course.niv, depuis);
}
function htmlMeteo(prev){
  return `<div class="meteoT">${prev.map(x => `<span style="background:${x.p < .08 ? '#2A2E38' : `rgba(63,169,245,${(.18 + x.p * .82).toFixed(2)})`}" title="Tour ${x.tour} : ${Math.round(x.p * 100)} % de risque de pluie"></span>`).join('')}</div>
    <div class="meteoN">${prev.map(x => `<span>${x.tour === 1 || x.tour % 5 === 0 ? x.tour : ''}</span>`).join('')}</div><p class="sous" style="margin:6px 0 0">${resumeMeteo(prev)}</p>`;
}
function resumeMeteo(prev){
  const pm = Math.max(0, ...prev.map(x => x.p));
  if(pm < .15) return '☀️ Pas de pluie prévue pendant la course.';
  const l = prev.filter(x => x.p >= pm * .6), a = l[0].tour, b = l[l.length - 1].tour, fort = Math.max(...l.map(x => x.w)) > .65;
  return `${pm >= .6 ? '🌧️' : '🌦️'} ${a === 1 ? 'Pluie au départ' : 'Pluie possible'}${a === 1 ? (b < prev.length ? `, jusqu'au tour ${b} environ` : ' et toute la course') : ` du tour ${a} au tour ${b} environ`} : risque ${Math.round(pm * 100)} %${fort ? ', grosse pluie' : ''}.`;
}
const legendeMeteo = () => `En bleu, le risque de pluie à chaque tour. Prévision de ton ingénieur de course (${etoiles(C.personnel.course.niv)}) : plus il est bon, plus elle est juste. Elle s'affine pendant la course, quand la pluie approche.`;
// l'usure par tour de chaque type de pneus pour ce pilote : ce qu'en sait l'ingénieur (mesurée en essais libres, sinon estimée au simulateur)
function usuresPilote(pid){
  const circ = circGP(), tours = M.nbTours(C, circ), T = Co.circuitCourse(circ), v = voituresCourse(circ).find(x => x.id === pid);
  const s0 = .3 - .04 * C.installations.simulateur.niv, res = {};
  for(const k of Object.keys(Co.PNEUS)){
    const m = W.usureMes[pid][k], vraie = Co.usureParTour({ tours, T }, { pneus:v.pneus, mode:'normal', carrossage:v.carrossage }, k), sig = s0 / (1 + .45 * m.tours);
    res[k] = { parTour:vraie * (1 + clamp(m.z, -2.5, 2.5) * sig), marge:1.6 * sig, tours:m.tours };
  }
  return res;
}
function propositions(pid){
  const circ = circGP(), tours = M.nbTours(C, circ), u = usuresPilote(pid), us = Object.fromEntries(Object.entries(u).map(([k, x]) => [k, x.parTour])), prev = prevCourse();
  return { props:Co.proposerStrategies(circ, tours, W.jeux[pid], us, prev), u, us, tours, circ, prev };
}
function stratDe(pid){
  if(W.strat[pid]) return W.strat[pid];
  const { props } = propositions(pid); if(!props.length) return null;
  W.strat[pid] = { relais:props[0].relais.map(r => ({ pneu:r.pneu, fin:r.fin })) }; sauver();
  return W.strat[pid];
}
// l'usure de départ de chaque relais : le train le moins usé qui reste (null s'il n'y en a plus)
function trainsU(pid, relais){ const pris = new Set(); return relais.map(r => { const j = W.jeux[pid].filter(x => x.t === r.pneu && !pris.has(x)).sort((a, b) => a.u - b.u)[0]; if(!j) return null; pris.add(j); return j.u; }); }
const COUL_TXT = { S:'#fff', M:'#1A1A1A', H:'#1A1A1A', I:'#fff', P:'#fff' };
const barreStrat = (relais, tours) => `<div class="sbarre">${relais.map((r, i) => { const d = i ? relais[i - 1].fin : 0, P = Co.PNEUS[r.pneu];
  return `<span style="width:${(r.fin - d) / tours * 100}%;background:${P.col};color:${COUL_TXT[r.pneu]}" title="${P.nom} : tours ${d + 1} à ${r.fin}">${P.court}${r.fin - d >= 4 ? `<small>${r.fin - d} t.</small>` : ''}</span>`; }).join('')}</div>`;
const nbArrets = relais => relais.length === 1 ? 'Sans arrêt' : `${relais.length - 1} arrêt${relais.length > 2 ? 's' : ''}`;
const texteStrat = relais => `${nbArrets(relais)} · ${relais.map((r, i) => `${Co.PNEUS[r.pneu].nom}${i < relais.length - 1 ? ` jusqu'au tour ${r.fin}` : ''}`).join(' → ')}`;
const duree = t => `${Math.floor(t / 60)} min ${String(Math.round(t % 60)).padStart(2, '0')} s`;
// l'éditeur de la stratégie d'un pilote : la météo, l'usure des pneus, les propositions de l'ingénieur, et les relais
function ouvrirStrategie(pid){
  const p = C.pilotes[pid], f = $('fRegl'), { props, u, us, tours, circ, prev } = propositions(pid);
  const st = { relais:(stratDe(pid) || props[0] || { relais:[{ pneu:'M', fin:tours }] }).relais.map(r => ({ pneu:r.pneu, fin:r.fin })) };
  const secs = props.filter(x => !x.pluie), meilleurSec = secs.length ? Math.min(...secs.map(x => x.temps)) : null;
  const pmax = Math.max(0, ...prev.map(x => x.p)), pluieDe = relais => relais.some(r => !Co.PNEUS[r.pneu].sec) ? prev.map(x => x.p >= Math.max(.2, pmax * .7) ? x.w : 0) : null;
  const dessiner = () => {
    const rel = st.relais, n = rel.length, u0 = trainsU(pid, rel), mouilles = pluieDe(rel);
    const est = Co.estimerStrategie(circ, tours, rel.map((r, i) => ({ ...r, u0:u0[i] ?? 0 })), us, mouilles);
    const alertes = [];
    est.relais.forEach((r, i) => {
      if(u0[i] == null) alertes.push(`❌ Relais ${i + 1} : plus de train de ${Co.PNEUS[r.pneu].nom.toLowerCase()} !`);
      if(r.usureFin > 1) alertes.push(`⚠️ Relais ${i + 1} : pneus usés à ${Math.round(r.usureFin * 100)} % à la fin, risque de crevaison !`);
      else if(r.usureFin > Co.LIM_USURE) alertes.push(`⚠️ Relais ${i + 1} : pneus très usés à la fin (${Math.round(r.usureFin * 100)} %), on perd du temps.`);
    });
    if(!mouilles && new Set(rel.map(r => r.pneu)).size < 2) alertes.push('⚠️ Règle : sur piste sèche, il faut utiliser deux types de pneus secs (sinon 30 s de pénalité).');
    const choisie = props.findIndex(x => x.relais.length === n && x.relais.every((r, i) => r.pneu === rel[i].pneu && r.fin === rel[i].fin));
    f.innerHTML = `<div class="tete"><h2 style="font-size:1.2rem">📋 ${esc(p.nom)}</h2><button class="btn petit droite" id="stFermer">✕ Fermer</button></div>
      <h4 class="stT">🌦️ La météo prévue</h4>${htmlMeteo(prev)}<p class="legende" style="margin:0">${legendeMeteo()}</p>
      <h4 class="stT">🛞 L'usure des pneus</h4>
      <table class="tab usS">${['S', 'M', 'H', 'I', 'P'].map(k => { const x = u[k], neufs = W.jeux[pid].filter(j => j.t === k && !j.u).length, tous = W.jeux[pid].filter(j => j.t === k).length, vie = Math.max(1, Math.floor(Co.LIM_USURE / (x.parTour * Co.USURE_COURSE)));
        return `<tr><td>${pneuHtml(k)} ${Co.PNEUS[k].nom}</td><td class="n"><b>${virgF(x.parTour * Co.USURE_COURSE * 100)} %</b>/tour<br><small class="legende">± ${virgF(x.marge * x.parTour * Co.USURE_COURSE * 100)} %</small></td><td><small class="legende">${x.tours ? `mesurée en essais (${Math.round(x.tours)} tour${x.tours >= 2 ? 's' : ''})` : 'estimée au simulateur'}<br>≈ ${vie} tours · ${neufs} neuf${neufs > 1 ? 's' : ''} / ${tous}</small></td></tr>`; }).join('')}</table>
      <p class="legende" style="margin:0">Fais rouler chaque type de pneus en essais libres : l'usure est mesurée, et la marge d'erreur se réduit à chaque tour.</p>
      <h4 class="stT">🎧 Les propositions de l'ingénieur</h4>
      <div class="propS">${props.map((x, i) => `<button data-prop="${i}" class="${i === choisie ? 'actif' : ''}"><b>${i === 0 ? '⭐ ' : ''}${nbArrets(x.relais)}${x.pluie ? ' · 🌧️ avec la pluie prévue' : ''}</b>${barreStrat(x.relais, tours)}<small class="legende">${esc(texteStrat(x.relais))}</small><small>${x.pluie ? `si la pluie vient : ≈ ${duree(x.temps)}` : `≈ ${duree(x.temps)}${meilleurSec != null && x.temps - meilleurSec > .05 ? ` · +${virgF(x.temps - meilleurSec)} s` : ' · la plus rapide sur le sec'}`}</small></button>`).join('') || '<p class="sous">Pas de proposition : il manque des pneus.</p>'}</div>
      <h4 class="stT">✏️ Ta stratégie</h4>
      ${barreStrat(rel, tours)}${htmlMeteo(prev).split('<p')[0]}
      ${est.relais.map((r, i) => `<div class="relS" data-i="${i}"><div class="h"><b>Relais ${i + 1}</b><small class="legende">tours ${r.debut} à ${r.fin} · ${r.fin - r.debut + 1} tours · usure à la fin <b class="${r.usureFin > 1 ? 'moins' : r.usureFin > Co.LIM_USURE ? 'orange' : 'plus'}">${Math.round(r.usureFin * 100)} %</b>${u0[i] ? ` (train déjà usé à ${Math.round(u0[i] * 100)} %)` : ''}</small>${n > 1 ? '<button class="x" data-x="1" title="Enlever ce relais">✕</button>' : ''}</div>
        <div class="choixp">${['S', 'M', 'H', 'I', 'P'].map(k => `<button data-p="${k}" class="${r.pneu === k ? 'actif' : ''}">${pneuHtml(k)} <small>${Co.PNEUS[k].court === 'T' ? 'Tendres' : Co.PNEUS[k].nom}</small></button>`).join('')}</div>
        ${i < n - 1 ? `<div class="arretS">🔧 Arrêt à la fin du tour <button data-d="-1">−</button><b>${r.fin}</b><button data-d="1">+</button></div>` : ''}</div>`).join('')}
      <button class="btn" id="stAjout">➕ Ajouter un arrêt</button>
      <div class="totS"><b>Temps estimé : ≈ ${duree(est.temps)}</b>${mouilles ? ' <small class="legende">(avec la pluie prévue)</small>' : meilleurSec != null && est.temps - meilleurSec > .05 ? ` <small class="legende">(+${virgF(est.temps - meilleurSec)} s sur la meilleure proposition)</small>` : ''}</div>
      ${alertes.map(a => `<p class="sous moins" style="margin:0">${a}</p>`).join('')}
      <button class="btn gros rouge" id="stOk">✅ Valider cette stratégie</button>`;
    f.querySelector('#stFermer').onclick = () => { $('vRegl').hidden = true; pageWeekend(); };
    f.querySelector('#stOk').onclick = () => { W.strat[pid] = { relais:st.relais.map(r => ({ pneu:r.pneu, fin:r.fin })) }; sauver(); $('vRegl').hidden = true; pageWeekend(); };
    f.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => { st.relais = props[+b.dataset.prop].relais.map(r => ({ pneu:r.pneu, fin:r.fin })); dessiner(); });
    f.querySelectorAll('.relS').forEach(el => {
      const i = +el.dataset.i;
      el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { rel[i].pneu = b.dataset.p; dessiner(); });
      el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { rel[i].fin = clamp(rel[i].fin + +b.dataset.d, (i ? rel[i - 1].fin : 0) + 1, rel[i + 1].fin - 1); dessiner(); });
      const x = el.querySelector('[data-x]'); if(x) x.onclick = () => { if(i === n - 1) rel[i - 1].fin = tours; rel.splice(i, 1); dessiner(); };
    });
    f.querySelector('#stAjout').onclick = () => {
      // on coupe le plus long relais en deux
      let k = 0, lg = 0; rel.forEach((r, i) => { const l = r.fin - (i ? rel[i - 1].fin : 0); if(l > lg){ lg = l; k = i; } });
      if(lg < 2) return;
      const debut = k ? rel[k - 1].fin : 0, autre = { S:'M', M:'H', H:'M', I:'I', P:'P' }[rel[k].pneu];
      rel.splice(k, 0, { pneu:rel[k].pneu, fin:debut + Math.floor(lg / 2) }); rel[k + 1].pneu = autre; dessiner();
    };
  };
  dessiner();
  $('vRegl').hidden = false; f.scrollTop = 0;
}

// les voitures du plateau pour une séance ou la course
function voituresCourse(circ){
  const car = M.caractere(circ), liste = [];
  for(const e of Object.values(C.ecuries)){
    const moi = e.id === C.joueur, ing = moi ? C.personnel.course.niv : clamp(Math.round(1 + e.budget / 35), 1, 5), mec = moi ? C.personnel.mecanos.niv : clamp(Math.round(1 + e.budget / 40), 1, 5);
    e.pilotes.forEach((pid, place) => {
      const p = C.pilotes[pid], V = moi ? M.voitureDe(C, place, circ) : e;
      let reglage = clamp(.6 + e.budget / 140 * .25 + (((pid.charCodeAt(0) + C.gp * 7) % 10) - 5) * .012, .5, .95), carrossage = 0;
      if(moi && W && W.reg[pid]){ const ideal = Co.reglageIdeal(circ, pid); reglage = Co.confiance(W.reg[pid], ideal); carrossage = (W.reg[pid].carr - ideal.carr) / 50; }
      liste.push({ id:pid, nom:p.nom, court:court(p), ecurie:e.id, c1:e.c1, c2:e.c2, logo:moi ? e.logo : null, joueur:moi,
        base:1 + (M.perfVoiture(V, car) - 86) * .0011 + (p.vitesse - 86) * .0008 + (ing - 3) * .0012 + (p.moral - 70) * .00008,
        regularite:p.regularite, pneus:p.pneus + (moi ? (ing - 3) * 2 : 0), depassement:p.depassement, pluie:p.pluie, fiabilite:Math.min(99, V.fiabilite + (mec - 3) * 1.5), mecanos:mec, ingenieur:ing,
        reglage, carrossage, standsNiv:moi ? C.installations.stands.niv - 1 : clamp(Math.round(e.budget / 45), 0, 3), jeux:moi && W ? W.jeux[pid] : undefined });
    });
  }
  return liste;
}
const optionsCourse = () => ({ pannes:M.PANNES[C.reglages.pannes] || 1, sc:C.reglages.sc !== false });
function lancerSeance(type){
  const gp = C.calendrier[C.gp], circ = M.circuit(gp.id);
  const participants = type === 'Q2' ? W.q.Q1.slice(0, 16).map(x => x[0]) : type === 'Q3' ? W.q.Q2.slice(0, 10).map(x => x[0]) : null;
  R = Co.preparer({ circuit:circ, voitures:voituresCourse(circ), tours:M.nbTours(C, circ), meteo:gp.meteo, options:optionsCourse(),
    seance:{ type, minutes:DUREES[type], participants, w:type === 'EL' ? gp.meteo.el : gp.meteo.q } });
  R.onGarage = (v, run) => {
    if(!v.joueur || type !== 'EL' || !run || !run.tours) return;
    const p = C.pilotes[v.id], res = Co.retourPilote(circ, v.id, W.reg[v.id], W.connu[v.id], run.tours, qualiteRetour(p));
    W.retours[v.id] = res.lignes; W.conf[v.id] = res.confiance; W.toursEL[v.id] = (W.toursEL[v.id] || 0) + run.tours;
    // l'usure des pneus, mesurée pendant ces tours (moins sûre sur piste humide avec des pneus secs)
    assurerStrat(); const mes = W.usureMes[v.id][v.pneu]; mes.tours += run.tours * (Co.PNEUS[v.pneu].sec && R.seance.w > .25 ? .5 : 1); delete W.strat[v.id];
    const pire = res.lignes.slice().sort((a, b) => a.note - b.note)[0];
    R.evenements.unshift({ txt:`🎧 ${v.court} (confiance ${Math.round(res.confiance * 100)} %) : « ${pire.txt} »`, type:'conseil', t:R.t });
    sauver();
  };
  selS = {};
  for(const p of mesPilotes()) selS[p.id] = { pneu:Co.pneuPluie(R.seance.w) || (type === 'EL' ? 'M' : 'S'), tours:type === 'EL' ? 5 : 1, risque:false };
  modeC = type; ouvrirPiste();
}
function qualifsRapides(){
  const gp = C.calendrier[C.gp], circ = M.circuit(gp.id);
  R = Co.preparer({ circuit:circ, voitures:voituresCourse(circ), tours:M.nbTours(C, circ), meteo:gp.meteo, options:optionsCourse(), seance:{ type:'Q3', minutes:1, w:gp.meteo.q } });
  const res = Co.qualifRapide(R);
  W.grille = res.map(r => r.id); W.tempsQ = Object.fromEntries(res.map((r, i) => [r.id, i ? '+' + virgF((r.temps - res[0].temps) * R.K, 3) : Co.chrono(r.temps * R.K)]));
  W.pole = res[0].id; W.etape = 'course'; R = null; sauver(); pageWeekend();
}
function lancerCourse(){
  const gp = C.calendrier[C.gp], circ = M.circuit(gp.id);
  R = Co.preparer({ circuit:circ, voitures:voituresCourse(circ), tours:M.nbTours(C, circ), meteo:gp.meteo, options:optionsCourse() });
  Co.placerGrille(R, W.grille);
  assurerStrat();
  for(const v of R.voitures) if(v.joueur){ const st = stratDe(v.id); if(st) Co.donnerPlan(v, st.relais); else v.pneuDepart = W.pneusDepart[v.id]; }
  modeC = 'course'; ouvrirPiste();
}

/* ---------- La piste en direct ---------- */
let vitesseC = 1, avantC = 0, dernierMaj = 0, boucleC = null, standOuvert = {}, selS = {}, pageT = clamp(+lire('paddock-pageT', 0) || 0, 0, 9);
const cam = { zoom:clamp(+lire('paddock-zoom', 1) || 1, 1, 4), suivi:null, lisse:true };
function ouvrirPiste(){
  montrer('eCourse'); vitesseC = 1; standOuvert = {};
  [...$('cVit').children].forEach(b => b.classList.toggle('actif', b.dataset.v === '1'));
  $('cFini').hidden = true; $('vRegl').hidden = true;
  cam.suivi = R.voitures.find(v => v.joueur && v.etat !== 'elimine')?.id || null; cam.lx = cam.ly = null;
  construirePilotesC(); construireTableau();
  $('cQuitter').hidden = modeC === 'course';
  avantC = performance.now();
  cancelAnimationFrame(boucleC); boucleC = requestAnimationFrame(boucle);
}
function boucle(now){
  if($('eCourse').hidden) return;
  const dt = Math.min(.05, (now - avantC) / 1000); avantC = now;
  if(R.phase !== 'fin' && vitesseC > 0){ let r = dt * vitesseC; while(r > 1e-6){ const h = Math.min(r, 1 / 30); Co.pas(R, h); r -= h; } }
  dessinerPiste();
  if(now - dernierMaj > 180){ dernierMaj = now; majPiste(); }
  if(R.phase === 'fin' && $('cFini').hidden){ if(R.seance) finSeance(); else arrivee(); }
  boucleC = requestAnimationFrame(boucle);
}
function dessinerPiste(){
  const zone = $('cZone'), cv = $('cvC'), w = zone.clientWidth, h = zone.clientHeight, d = Math.min(2, devicePixelRatio || 1);
  if(w < 10 || h < 10) return;
  if(cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)){ cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
  Co.dessiner(R, cv.getContext('2d'), w, h, d, null, { cam });
}
$('camPlus').onclick = () => { cam.zoom = clamp(cam.zoom + .75, 1, 4); ecrire('paddock-zoom', cam.zoom); if(!cam.suivi) cam.suivi = R.voitures.find(v => v.joueur)?.id; };
$('camMoins').onclick = () => { cam.zoom = clamp(cam.zoom - .75, 1, 4); ecrire('paddock-zoom', cam.zoom); };
$('camSuivi').onclick = () => {
  // suivre : pilote 1, pilote 2, le premier, puis personne
  const liste = [...R.voitures.filter(v => v.joueur && v.etat !== 'elimine').map(v => v.id), Co.ordre(R)[0].v.id, null];
  const i = liste.indexOf(cam.suivi); cam.suivi = liste[(i + 1) % liste.length];
  if(cam.suivi && cam.zoom < 1.5) cam.zoom = 2.5;
  majPiste();
};
$('cvC').onclick = e => {
  const r = $('cvC').getBoundingClientRect(), v = Co.voitureEn(R, e.clientX - r.left, e.clientY - r.top);
  if(v){ cam.suivi = v.id; if(cam.zoom < 1.5) cam.zoom = 2.5; majPiste(); }
};
const etatSeance = v => {
  if(v.etat === 'elimine') return 'Éliminé';
  if(v.etat === 'garage') return '🅿️ Au garage';
  if(v.etat === 'sortie') return '🚦 Sortie des stands';
  if(v.etat === 'stand') return '↩️ Voie des stands';
  const pl = v.plan; if(!pl) return '';
  return pl.type === 'lancement' ? '🔄 Tour de lancement' : pl.type === 'rapide' ? `⏱️ Tour rapide${pl.restants > 1 ? ` (encore ${pl.restants})` : ''}` : '↩️ Retour au stand';
};
function construirePilotesC(){
  const box = $('cPilotes'); box.innerHTML = '';
  for(const v of R.voitures.filter(x => x.joueur)){
    const e = C.ecuries[v.ecurie], el = document.createElement('div'); el.className = 'pc'; el.dataset.id = v.id; el.style.setProperty('--c', e.c2);
    if(modeC === 'course'){
      el.innerHTML = `<div class="l1"><b class="pos">P–</b><span>${esc(v.nom)}</span><em class="ec"></em></div>
        <div class="l2"><span class="pneu"></span><div class="us"><i></i></div><small class="u"></small><span title="Batterie">🔋</span><div class="batt" style="width:34px"><i></i></div></div>
        <div class="cmd">${Object.entries(Co.MODES).map(([k, m]) => `<button data-m="${k}" title="Rythme : ${m.nom}">${m.ico}</button>`).join('')}${Object.entries(Co.ERS).map(([k, m]) => `<button data-e="${k}" title="Batterie : ${m.nom}" class="e">${m.ico}</button>`).join('')}</div>
        <div class="ligne3"><button class="bstand">🔧 Stand</button><button class="planB" title="L'ingénieur suit ta stratégie">📋</button><button class="auto" title="Tout automatique (batterie comprise)">🤖</button></div>
        <div class="stand" hidden>${Object.entries(Co.PNEUS).map(([k, p]) => `<button data-p="${k}" title="${p.nom}"><span class="pneu" style="border-color:${p.col}">${p.court}</span></button>`).join('')}</div>
        <div class="plan"></div><div class="prev"></div><div class="cons"></div>`;
    } else {
      const choixTours = modeC === 'EL' ? [3, 5, 8] : [1, 2, 3];
      el.innerHTML = `<div class="l1"><b class="pos">P–</b><span>${esc(v.nom)}</span><em class="ec"></em></div>
        <div class="l2"><span class="pneu"></span><div class="us"><i></i></div><small class="etat"></small></div>
        <div class="sess pneus">${Object.keys(Co.PNEUS).map(k => `<button data-p="${k}">${pneuHtml(k)}<span class="n"></span></button>`).join('')}</div>
        <div class="sess">${choixTours.map(n => `<button data-t="${n}" title="${n} tour${n > 1 ? 's' : ''} rapide${n > 1 ? 's' : ''}">${n} t.</button>`).join('')}${modeC !== 'EL' ? '<button data-r="1" title="À l\'attaque : plus rapide, plus d\'erreurs">⚡</button>' : '<button data-regl="1" title="Réglages">🔧</button>'}<button class="go">▶ Sortir</button></div>
        <div class="cons"></div>`;
    }
    el.onclick = ev => {
      const b = ev.target.closest('button'); if(!b) return;
      const s = selS[v.id];
      if(modeC === 'course'){
        if(b.dataset.m) v.mode = b.dataset.m;
        else if(b.dataset.e){ v.ers = b.dataset.e; }
        else if(b.classList.contains('bstand')){ if(v.demande){ if(v.demandePlan) Co.reporterArret(R, v); v.demande = null; standOuvert[v.id] = false; } else standOuvert[v.id] = !standOuvert[v.id]; }
        else if(b.classList.contains('planB')){ if(v.strat) v.suitPlan = !v.suitPlan; }
        else if(b.classList.contains('auto')) v.auto = !v.auto;
        else if(b.dataset.p){ v.demande = b.dataset.p; standOuvert[v.id] = false; }
      } else {
        if(b.dataset.p) s.pneu = b.dataset.p;
        else if(b.dataset.t) s.tours = +b.dataset.t;
        else if(b.dataset.r) s.risque = !s.risque;
        else if(b.dataset.regl) ouvrirReglages(v.id, true);
        else if(b.classList.contains('go')){
          if(v.etat === 'garage'){ if(!Co.sortir(R, v, s)) alert(R.drapeau ? 'La séance est finie.' : 'Plus de train de ce type de pneus.'); else cam.suivi = v.id; }
          else Co.rentrer(R, v);
        }
      }
      majPiste();
    };
    box.append(el);
  }
}
/* le tableau des temps : plusieurs pages, on glisse de l'une à l'autre */
const PAGES_COURSE = ['Écarts', 'Pneus', 'Tours', 'Secteurs', 'Positions'], PAGES_SEANCE = ['Temps', 'Piste', 'Secteurs'];
const pagesT = () => modeC === 'course' ? PAGES_COURSE : PAGES_SEANCE;
function construireTableau(){
  const noms = pagesT(); pageT = Math.min(pageT, noms.length - 1);
  $('cOngT').innerHTML = noms.map((n, i) => `<button data-i="${i}">${n}</button>`).join('');
  $('cPages').innerHTML = noms.map(() => '<div class="pageT"></div>').join('');
  requestAnimationFrame(() => { $('cPages').scrollLeft = pageT * $('cPages').clientWidth; });
  majOngletsT();
}
function majOngletsT(){ [...$('cOngT').children].forEach((b, i) => b.classList.toggle('actif', i === pageT)); }
$('cOngT').onclick = e => { const b = e.target.closest('button'); if(!b) return; pageT = +b.dataset.i; $('cPages').scrollTo({ left:pageT * $('cPages').clientWidth, behavior:'smooth' }); majOngletsT(); ecrire('paddock-pageT', pageT); majTableau(); };
$('cPages').addEventListener('scroll', () => {
  const w = $('cPages').clientWidth; if(!w) return;
  const i = Math.round($('cPages').scrollLeft / w);
  if(i !== pageT){ pageT = i; majOngletsT(); ecrire('paddock-pageT', pageT); majTableau(); }
}, { passive:true });
$('cPages').onclick = e => { const tr = e.target.closest('tr[data-id]'); if(!tr) return; cam.suivi = tr.dataset.id; if(cam.zoom < 1.5) cam.zoom = 2.5; majTableau(); };
const tps = s => s == null ? '—' : Co.chrono(s * R.K);
const tpsS = s => s == null ? '—' : virgF(s * R.K, 3);
const coulTemps = (t, perso, tous) => t == null ? '' : tous != null && t <= tous + 1e-9 ? 'violet' : perso != null && t <= perso + 1e-9 ? 'vert' : 'jaune';
function ligneT(o, cellules, extra = ''){
  const v = o.v, e = C.ecuries[v.ecurie];
  return `<tr data-id="${v.id}" class="${v.joueur ? 'moi' : ''} ${v.etat === 'abandon' || v.etat === 'elimine' ? 'out' : ''} ${cam.suivi === v.id ? 'suivi' : ''} ${extra}"><td>${o.place}</td><td><span class="coul" style="background:${e.c1};height:12px"></span>${esc(v.court)}</td>${cellules}</tr>`;
}
function majTableau(){
  const page = $('cPages').children[pageT]; if(!page) return;
  const ord = Co.ordre(R), nom = pagesT()[pageT];
  let tete = '', corps = '';
  if(modeC === 'course'){
    if(nom === 'Écarts'){ tete = '<th class="e">Interv.</th><th class="e">Leader</th>'; corps = ord.map(o => ligneT(o, `<td class="e">${o.inter}${o.v.etat === 'stand' ? ' 🔧' : ''}</td><td class="e">${o.ecart}</td>`)).join(''); }
    else if(nom === 'Pneus'){ tete = '<th>Pneu</th><th class="e">Usure</th><th class="e">Arrêts</th>'; corps = ord.map(o => { const v = o.v;
      return ligneT(o, `<td><span class="pt" style="border-color:${Co.PNEUS[v.pneu].col}"></span>${v.agePneu || 0} t.</td><td class="e">${Math.round(clamp(v.usure, 0, 1) * 100)} %</td><td class="e">${v.arrets}${v.etat === 'stand' ? ' 🔧' : ''}</td>`); }).join(''); }
    else if(nom === 'Tours'){ const mt = R.meilleurTour; tete = '<th class="e">Dernier</th><th class="e">Meilleur</th>'; corps = ord.map(o => { const v = o.v, d = v.tempsTours.length > 1 ? v.tempsTours[v.tempsTours.length - 1] : null;
      return ligneT(o, `<td class="e ${coulTemps(d, v.meilleurTour, mt && mt.temps)}">${tps(d)}</td><td class="e ${mt && mt.id === v.id ? 'violet' : ''}">${tps(v.meilleurTour)}</td>`); }).join(''); }
    else if(nom === 'Secteurs'){ tete = '<th class="e">S1</th><th class="e">S2</th><th class="e">S3</th>'; corps = ord.map(o => { const v = o.v;
      return ligneT(o, [0, 1, 2].map(j => `<td class="e ${coulTemps(v.dernSect[j], v.bestSect[j], R.meilleursSect[j])}">${tpsS(v.dernSect[j])}</td>`).join('')); }).join(''); }
    else { tete = '<th class="e">Grille</th><th class="e">+/−</th>'; corps = ord.map(o => { const g = o.v.grille - o.place;
      return ligneT(o, `<td class="e">${o.v.grille}</td><td class="e ${g > 0 ? 'gain' : g < 0 ? 'perte' : ''}">${g > 0 ? '▲ ' + g : g < 0 ? '▼ ' + -g : '='}</td>`); }).join(''); }
  } else {
    const coupe = modeC === 'Q1' ? 16 : modeC === 'Q2' ? 10 : 0;
    if(nom === 'Temps'){ tete = '<th class="e">Meilleur</th><th class="e">Écart</th>'; corps = ord.map(o => ligneT(o, `<td class="e ${R.meilleurTour && R.meilleurTour.id === o.v.id ? 'violet' : ''}">${tps(o.temps)}</td><td class="e">${o.place === 1 || o.temps == null ? '' : '+' + virgF(o.ecart * R.K, 3)}</td>`, coupe && o.place === coupe + 1 ? 'coupe' : '')).join(''); }
    else if(nom === 'Piste'){ tete = '<th>Où</th><th>Pneu</th><th class="e">Tours</th>'; corps = ord.map(o => { const v = o.v;
      return ligneT(o, `<td style="font-size:.74rem">${etatSeance(v)}</td><td>${v.etat === 'garage' || v.etat === 'elimine' ? '' : `<span class="pt" style="border-color:${Co.PNEUS[v.pneu].col}"></span>`}</td><td class="e">${v.toursFaits || 0}</td>`, coupe && o.place === coupe + 1 ? 'coupe' : ''); }).join(''); }
    else { tete = '<th class="e">S1</th><th class="e">S2</th><th class="e">S3</th>'; corps = ord.map(o => { const v = o.v;
      return ligneT(o, [0, 1, 2].map(j => `<td class="e ${coulTemps(v.bestSect[j], v.bestSect[j], R.meilleursSect[j])}">${tpsS(v.bestSect[j])}</td>`).join(''), coupe && o.place === coupe + 1 ? 'coupe' : ''); }).join(''); }
  }
  page.innerHTML = `<table><tr><th>#</th><th>Pilote</th>${tete}</tr>${corps}</table>`;
}
function majPiste(){
  const gp = C.calendrier[C.gp], ord = Co.ordre(R), w = Co.mouille(R);
  if(modeC === 'course'){
    const tete = ord[0].v, tourAff = Math.min(R.tours, Math.max(1, tete.tour + (tete.etat === 'fini' ? 0 : 1)));
    $('cTitre').innerHTML = `${esc(gpNom(gp))}<small>${R.phase === 'grille' ? 'Les feux…' : `Tour ${tourAff}/${R.tours}`} · ${w > .6 ? '🌧️ grosse pluie' : w > .25 ? '🌦️ piste humide' : w > .05 ? '🌦️ quelques gouttes' : '☀️ sec'}${R.sc ? ' · 🚨 voiture de sécurité' : ''}${R.phase === 'course' && W ? prochainePluie(tete.tour, w) : ''}</small>`;
    $('cHorl').hidden = true;
  } else {
    const s = R.seance, m = Math.floor(s.reste / 60), sec = Math.floor(s.reste % 60);
    $('cTitre').innerHTML = `${NOMS_SEANCE[modeC]}<small>${esc(gpNom(gp))} · ${ciel(w)}${modeC !== 'EL' ? ` · ${modeC === 'Q3' ? 'pour la pole' : 'les 6 derniers éliminés'}` : ''}</small>`;
    $('cHorl').hidden = false; $('cHorl').textContent = R.drapeau ? '🏁' : `${m}:${String(sec).padStart(2, '0')}`; $('cHorl').classList.toggle('fin', s.reste < 120);
  }
  const recents = R.evenements.filter(e => R.t - e.t < 6 || R.phase === 'grille').slice(0, 3);
  $('cInfos').innerHTML = (R.sc ? '<div class="sc">🚨 VOITURE DE SÉCURITÉ</div>' : '') + (R.phase === 'grille' ? `<div>🚦 ${'🔴'.repeat(Math.min(5, Math.floor(R.feux / .6)))}</div>` : '') + recents.map(e => `<div class="${e.type}">${esc(e.txt)}</div>`).join('');
  majTableau();
  $('camSuivi').classList.toggle('actif', !!cam.suivi);
  for(const el of $('cPilotes').children){
    const v = R.voitures.find(x => x.id === el.dataset.id), o = ord.find(x => x.v === v);
    const pn = el.querySelector('.l2 .pneu'); pn.textContent = Co.PNEUS[v.pneu].court; pn.style.borderColor = Co.PNEUS[v.pneu].col;
    const u = clamp(v.usure, 0, 1); el.querySelector('.us i').style.width = (100 - u * 100) + '%'; el.querySelector('.us i').style.background = u > .75 ? '#FF4D4D' : u > .55 ? '#FFC93C' : '#2BD47D';
    if(modeC === 'course'){
      el.classList.toggle('out', v.etat === 'abandon');
      el.querySelector('.pos').textContent = v.etat === 'abandon' ? 'AB' : 'P' + o.place;
      const dv = ord[o.place - 2];
      el.querySelector('.ec').textContent = v.etat === 'abandon' ? v.abandon : o.place === 1 ? o.ecart : `${o.inter} s sur ${dv.v.court}`;
      el.querySelector('.u').textContent = `${Math.round((1 - u) * 100)} % · ${v.agePneu || 0} t.` + (v.arrets ? ` · ${v.arrets} arrêt${v.arrets > 1 ? 's' : ''}` : '');
      el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('actif', b.dataset.m === v.mode));
      el.querySelectorAll('[data-e]').forEach(b => { b.classList.toggle('actif', b.dataset.e === v.ers); b.classList.toggle('pret', b.dataset.e === 'boost' && !!v.uneSeconde); });
      el.querySelector('.batt i').style.width = Math.round(v.batt * 100) + '%';
      const bs = el.querySelector('.bstand');
      bs.textContent = v.etat === 'stand' ? '🔧 Au stand…' : v.demande ? `🔧 Rentre : ${Co.PNEUS[v.demande].nom} (annuler)` : '🔧 Stand';
      bs.classList.toggle('actif', !!v.demande);
      el.querySelector('.auto').classList.toggle('actif', v.auto);
      el.querySelector('.stand').hidden = !standOuvert[v.id] || !!v.demande || v.etat !== 'course';
      const pr = Co.prevoirArret(R, v);
      el.querySelector('.prev').textContent = pr ? `🔮 S'il s'arrête : P${pr.place}${pr.devant ? `, à ${virgF(pr.ecartDevant)} s de ${pr.devant}` : ''}${pr.derriere ? ` (${pr.derriere} à ${virgF(pr.ecartDerriere)} s)` : ''}` : '';
      const ep = Co.etatPlan(R, v), bp = el.querySelector('.planB');
      bp.disabled = !ep; bp.classList.toggle('actif', !!ep && ep.suit);
      el.querySelector('.plan').textContent = !ep || v.etat === 'abandon' ? '' : !ep.suit ? '📋 Stratégie en pause : touche 📋 pour que l\'ingénieur la reprenne' : ep.prochain ? `📋 Arrêt prévu au tour ${ep.prochain.tour} → ${Co.PNEUS[ep.prochain.pneu].nom.toLowerCase()}${ep.prochain.dans > 0 ? ` (dans ${ep.prochain.dans} tour${ep.prochain.dans > 1 ? 's' : ''})` : ''}` : '📋 Plus d\'arrêt prévu : jusqu\'à l\'arrivée';
      el.querySelector('.cons').textContent = R.alertes[v.id] && v.etat === 'course' && !v.demande ? '🎧 ' + R.alertes[v.id] : v.auto ? (ep && ep.suit ? '🤖 L\'ingénieur suit ta stratégie et gère la batterie' : '🤖 L\'ingénieur gère la stratégie et la batterie') : '';
    } else {
      const s = selS[v.id], coupe = modeC === 'Q1' ? 16 : modeC === 'Q2' ? 10 : 99;
      el.classList.toggle('out', v.etat === 'elimine');
      el.querySelector('.pos').textContent = v.etat === 'elimine' ? '—' : 'P' + o.place;
      el.querySelector('.ec').innerHTML = v.meilleur ? `${tps(v.meilleur)}${o.place > coupe ? ' <span class="danger">éliminé ?</span>' : ''}` : (v.etat === 'elimine' ? '' : 'pas de temps');
      el.querySelector('.etat').textContent = `${etatSeance(v)}${v.etat !== 'garage' && v.etat !== 'elimine' ? ` · ${Math.round((1 - u) * 100)} %` : ''}${modeC === 'EL' && W.conf[v.id] != null ? ` · confiance ${Math.round(W.conf[v.id] * 100)} %` : ''}`;
      const auGarage = v.etat === 'garage';
      el.querySelectorAll('[data-p]').forEach(b => { const k = b.dataset.p, neufs = v.jeux.filter(j => j.t === k && !j.u).length, tous = v.jeux.filter(j => j.t === k).length;
        b.classList.toggle('actif', s.pneu === k); b.disabled = !auGarage || !tous; b.querySelector('.n').textContent = `${neufs}/${tous}`; b.title = `${Co.PNEUS[k].nom} : ${neufs} neufs sur ${tous}`; });
      el.querySelectorAll('[data-t]').forEach(b => { b.classList.toggle('actif', s.tours === +b.dataset.t); b.disabled = !auGarage; });
      const br = el.querySelector('[data-r]'); if(br){ br.classList.toggle('actif', s.risque); br.disabled = !auGarage; }
      const go = el.querySelector('.go');
      go.textContent = auGarage ? '▶ Sortir' : '⏹ Rentrer'; go.classList.toggle('stop', !auGarage); go.disabled = v.etat === 'elimine' || (auGarage && R.drapeau) || v.etat === 'stand' || v.etat === 'sortie';
      const ret = modeC === 'EL' && W.retours[v.id] ? W.retours[v.id].slice().sort((a, b) => a.note - b.note)[0] : null;
      el.querySelector('.cons').textContent = v.etat === 'elimine' ? 'Éliminé : il regarde la suite depuis le garage.' : ret && auGarage ? `🎧 « ${ret.txt} »` : '';
    }
  }
}
$('cQuitter').onclick = () => {
  if(!R || !R.seance || !confirm('Quitter la séance ? Elle sera à refaire depuis le début.')) return;
  for(const v of R.voitures) if(v.joueur && v.jeu) v.jeu.u = Math.max(v.jeu.u, v.usure);
  cancelAnimationFrame(boucleC); R = null; sauver(); pageWeekend();
};
$('cVit').onclick = e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.dataset.v === 'fin'){
    if(R.seance){ if(!confirm('Aller directement à la fin de la séance ? Tes pilotes sans temps feront un tour rapide automatiquement.')) return; Co.simulerSeance(R); majPiste(); return; }
    if(!confirm('Aller directement à l\'arrivée ?')) return; for(const v of R.voitures) if(v.joueur) v.auto = true; Co.simulerFin(R); majPiste(); return;
  }
  vitesseC = +b.dataset.v; [...$('cVit').children].forEach(x => x.classList.toggle('actif', x === b));
};
// la prévision pendant la course : la prochaine pluie, ou la fin de la pluie
function prochainePluie(tour, w){
  const prev = prevCourse(tour).filter(x => x.tour > tour);
  if(w > .25){ const f = prev.find(x => x.p < .3); return f ? ` · ☀️ fin de pluie prévue tour ${f.tour}` : ''; }
  const x = prev.slice(0, 12).find(x => x.p >= .4); return x ? ` · 🌦️ pluie prévue tour ${x.tour} (${Math.round(x.p * 100)} %)` : '';
}
// la fin d'une séance
function finSeance(){
  const ord = Co.classementSeance(R), type = modeC, carte = $('cFiniCarte');
  for(const v of R.voitures) if(v.joueur && v.jeu) v.jeu.u = Math.max(v.jeu.u, v.usure);
  const nomP = o => `${o.v.joueur ? '<b>' : ''}${esc(o.v.nom)}${o.v.joueur ? '</b>' : ''}`;
  if(type === 'EL'){
    W.etape = 'Q';
    assurerStrat();
    const mesU = pid => { const u = usuresPilote(pid), l = Object.keys(Co.PNEUS).filter(k => u[k].tours > 0); return l.length ? `usure mesurée : ${l.map(k => `${Co.PNEUS[k].nom.toLowerCase()} ${virgF(u[k].parTour * Co.USURE_COURSE * 100)} %/tour`).join(', ')}` : 'aucune usure de pneus mesurée'; };
    carte.innerHTML = `<h2>🔧 Fin des essais libres</h2><p class="sous" style="margin:8px 0">${mesPilotes().map(p => `${esc(p.nom)} : ${W.conf[p.id] != null ? `confiance ${Math.round(W.conf[p.id] * 100)} %` : 'pas de réglage essayé'}, ${(ord.find(o => o.v.id === p.id) || {}).place || '–'}e temps ; ${mesU(p.id)}`).join('<br>')}</p><button class="btn gros rouge" id="bFiniOk">Retour au week-end</button>`;
    $('bFiniOk').onclick = () => { $('cFini').hidden = true; cancelAnimationFrame(boucleC); pageWeekend(); };
  } else {
    W.q[type] = ord.map(o => [o.v.id, o.temps]);
    const coupe = type === 'Q1' ? 16 : type === 'Q2' ? 10 : 0;
    if(type !== 'Q3'){
      const elim = ord.slice(coupe);
      const mesElim = elim.filter(o => o.v.joueur), mesPasses = ord.slice(0, coupe).filter(o => o.v.joueur);
      carte.innerHTML = `<h2>⏱️ Fin du ${type}</h2><p class="sous" style="margin:8px 0">${mesPasses.length ? `✅ Qualifié${mesPasses.length > 1 ? 's' : ''} : ${mesPasses.map(nomP).join(', ')}<br>` : ''}${mesElim.length ? `❌ Éliminé${mesElim.length > 1 ? 's' : ''} : ${mesElim.map(o => `${nomP(o)} (${o.place}e)`).join(', ')}<br>` : ''}Éliminés : ${elim.map(o => esc(o.v.court)).join(', ')}</p>
        <button class="btn gros rouge" id="bFiniOk">▶ ${type === 'Q1' ? 'Q2' : 'Q3'}</button>`;
      $('bFiniOk').onclick = () => { $('cFini').hidden = true; lancerSeance(type === 'Q1' ? 'Q2' : 'Q3'); };
    } else {
      // la grille : Q3 pour les 10 premiers, puis Q2 et Q1
      const q1 = W.q.Q1.map(x => x[0]), q2 = W.q.Q2.map(x => x[0]), q3 = W.q.Q3.map(x => x[0]);
      W.grille = [...q3, ...q2.filter(id => !q3.includes(id)), ...q1.filter(id => !q2.includes(id))];
      const temps = {}; for(const [k, l] of [['Q1', W.q.Q1], ['Q2', W.q.Q2], ['Q3', W.q.Q3]]) for(const [id, t] of l) if(t) temps[id] = `${k} ${Co.chrono(t * R.K)}`;
      W.tempsQ = temps; W.pole = q3[0]; W.etape = 'course';
      const pole = C.pilotes[q3[0]];
      carte.innerHTML = `<h2>🏁 Pole position</h2><p class="sous" style="margin:8px 0"><b>${esc(pole.nom)}</b> (${esc(C.ecuries[pole.ecurie].nom)}) en ${Co.chrono(ord[0].temps * R.K)}.<br>${mesPilotes().map(p => `${esc(p.nom)} : ${W.grille.indexOf(p.id) + 1}e sur la grille`).join('<br>')}</p><button class="btn gros rouge" id="bFiniOk">Retour au week-end</button>`;
      $('bFiniOk').onclick = () => { $('cFini').hidden = true; cancelAnimationFrame(boucleC); pageWeekend(); };
    }
  }
  sauver();
  $('cFini').hidden = false;
}
function arrivee(){
  const res = Co.resultat(R), mes = res.filter(r => R.voitures.find(v => v.id === r.pilote).joueur);
  $('cFiniCarte').innerHTML = `<h2>🏁 Arrivée</h2><p class="sous" style="margin:8px 0 12px">Vainqueur : <b>${esc(res[0].nom)}</b>.<br>${mes.map(r => `${esc(r.nom)} : ${r.abandon ? 'abandon' : r.place + 'e'}`).join(' · ')}</p><button class="btn gros rouge" id="bFiniOk">Voir les résultats</button>`;
  $('bFiniOk').onclick = () => { cancelAnimationFrame(boucleC); $('cFini').hidden = true; resultats(); };
  $('cFini').hidden = false;
}

/* ---------- Les résultats ---------- */
function resultats(){
  const gp = C.calendrier[C.gp];
  const res = Co.resultat(R), pole = W && W.pole ? W.pole : null, mt = R.meilleurTour;
  const bilan = M.appliquerResultat(C, { classement:res, pole, meilleurTour:mt ? mt.id : null });
  M.genererOffres(C);
  sauver();
  const pts = i => i < 10 ? M.POINTS[i] : 0, top3 = res.slice(0, 3);
  $('rContenu').innerHTML = `<h2>${esc(gpNom(gp))} : résultats</h2>
    <div class="podium">${[1, 0, 2].map(i => { const r = top3[i]; if(!r) return '<div></div>'; const e = C.ecuries[r.ecurie]; return `<div style="height:${[120, 96, 80][i]}px;border-top:4px solid ${e.c1}"><b>${i + 1}</b>${esc(r.nom)}<br><small class="legende">${esc(e.nom)}</small></div>`; }).join('')}</div>
    <div class="carte"><h3>La direction</h3><p class="sous">Objectif : ${esc(bilan.objectif)} ${bilan.reussi ? '✅ réussi' : '❌ manqué'} · confiance ${bilan.confiance >= 0 ? '+' : ''}${virg(bilan.confiance)} (${Math.round(C.confiance)}/100)</p>${bilan.casse.length ? `<p class="sous moins" style="margin-top:6px">💥 ${bilan.casse.map(esc).join('<br>💥 ')}</p>` : ''}</div>
    <div class="carte"><h3>Ton Grand Prix</h3><table class="tab bilan">${bilan.lignes.map(([t, m]) => `<tr><td>${esc(t)}</td><td class="${m >= 0 ? 'plus' : 'moins'}">${m >= 0 ? '+' : ''}${meur(m)}</td></tr>`).join('')}
      <tr><td><b>Total</b> · ${bilan.points} point${bilan.points > 1 ? 's' : ''} pour l'écurie</td><td class="${bilan.argent >= 0 ? 'plus' : 'moins'}"><b>${bilan.argent >= 0 ? '+' : ''}${meur(bilan.argent)}</b></td></tr></table></div>
    <div class="carte"><h3>Classement de la course</h3><table class="tab">${res.map((r, i) => { const e = C.ecuries[r.ecurie]; const moi = r.ecurie === C.joueur;
      return `<tr class="${moi ? 'moi' : ''}"><td>${r.abandon ? 'AB' : r.place}</td><td>${coul(e)}${esc(r.nom)}${r.penalite ? ` <small class="moins">${esc(r.penalite)}</small>` : ''}${mt && mt.id === r.pilote ? ' <small title="Meilleur tour">⏱️</small>' : ''} <small class="legende" style="white-space:nowrap">${r.arrets} arr. · ${r.grille}e</small></td><td class="n legende">${esc(r.ecart)}</td><td class="n">${r.abandon ? '' : pts(i) ? '+' + pts(i) : ''}</td></tr>`; }).join('')}</table>
      <p class="legende" style="margin:8px 0 0">${mt ? `⏱️ Meilleur tour : ${esc(R.voitures.find(v => v.id === mt.id).nom)} en ${Co.chrono(mt.temps * R.K)}` : ''}</p></div>
    <button class="btn gros rouge" id="rSuite">${C.phase === 'finSaison' ? '🏆 Bilan de la saison' : '‹ Retour au QG'}</button>`;
  $('rSuite').onclick = () => C.phase === 'finSaison' ? finDeSaison() : qg('gp');
  R = null; W = null;
  montrer('eResultat');
}

/* ---------- La fin de saison et le mercato ---------- */
let reglSuivante = null;
function finDeSaison(){
  if(C.phase === 'finSaison'){ M.finSaison(C); sauver(); }
  const s = C.resumeSaison || C.historique[C.historique.length - 1], E = C.ecuries[C.joueur];
  const champ = s.champion ? C.pilotes[s.champion] : null;
  const box = $('sContenu');
  const bilan = `<h2>Saison ${s.saison} : le bilan</h2>
    <div class="carte"><p class="sous" style="color:var(--encre);font-size:1.1rem"><b>${esc(E.nom)}</b> finit <b>${s.place}e</b> du championnat des constructeurs avec ${s.points} points (objectif : ${s.objectif}e) ${s.reussi ? '✅ objectif atteint !' : '❌ objectif manqué.'}</p>
      <p class="sous" style="margin-top:6px">🤝 Confiance de la direction : <b>${s.confiance ?? Math.round(C.confiance)}</b>/100 (${M.humeur(C.confiance)})</p>
      <p class="sous" style="margin-top:6px">🏆 Champion du monde : <b>${champ ? esc(champ.nom) : '—'}</b> (${champ ? esc(C.ecuries[s.championEcurie].nom) : ''}) · constructeurs : <b>${esc(C.ecuries[s.constructeur].nom)}</b>${s.titreP || s.titreC ? ' · 🎉 c\'est toi !' : ''}</p>
      <p class="sous" style="margin-top:6px">💰 Prime de fin de saison : <b class="plus">+${meur(s.prime)}</b> · caisse : ${meur(C.argent)}</p></div>
    ${s.sponsors && s.sponsors.length ? `<div class="carte"><h3>Les objectifs des sponsors</h3>${s.sponsors.map(l => `<p class="sous ${l.ok ? 'plus' : 'moins'}" style="margin:3px 0">${l.ok ? '✅' : '❌'} ${esc(l.txt)}</p>`).join('')}</div>` : ''}
    <div class="carte"><h3>Constructeurs ${s.saison}</h3><table class="tab">${s.classementC.map(([id, p], i) => `<tr class="${id === C.joueur ? 'moi' : ''}"><td>${i + 1}</td><td>${coul(C.ecuries[id])}${esc(C.ecuries[id].nom)}</td><td class="n">${p}</td></tr>`).join('')}</table></div>
    <div class="carte"><h3>Pilotes ${s.saison}</h3><table class="tab">${(s.classementP || []).map(([id, p, eq], i) => { const pi = C.pilotes[id], e = C.ecuries[eq || (pi && pi.ecurie)] || { c1:'#555', c2:'#555', nom:'—' };
      return `<tr class="${e.id === C.joueur ? 'moi' : ''}"><td>${i + 1}</td><td>${coul(e)}${pi ? pi.drapeau + ' ' + esc(pi.nom) : esc(id)} <small class="legende">${esc(e.nom)}</small></td><td class="n">${p}</td></tr>`; }).join('')}</table></div>`;
  if(C.phase === 'renvoi'){
    box.innerHTML = `${bilan}<div class="carte" style="border-color:var(--rouge)"><h2>Tu es renvoyé !</h2><p class="sous" style="margin-top:8px">La direction n'a plus confiance en toi. Ta carrière chez ${esc(E.nom)} s'arrête après ${C.records.gp} Grands Prix, ${C.records.victoires} victoire${C.records.victoires > 1 ? 's' : ''} et ${C.records.podiums} podium${C.records.podiums > 1 ? 's' : ''}. Une autre écurie te donnera ta chance !</p>
      <button class="btn gros rouge" id="sNouvelle" style="margin-top:10px">🏁 Nouvelle carrière</button></div>`;
    $('sNouvelle').onclick = () => { C = null; try{ localStorage.removeItem('paddock-carriere'); }catch(e){} accueil(); };
    montrer('eSaison'); return;
  }
  reglSuivante = reglSuivante || { ...C.reglages };
  box.innerHTML = `${bilan}
    <h2 style="margin-top:6px">Mercato</h2>
    <div class="carte"><h3>Tes pilotes</h3><p class="sous" style="margin-bottom:8px">Un pilote en fin de contrat qui n'est pas prolongé quittera l'écurie, et sera remplacé par un pilote libre.</p><div class="marche" id="sMes"></div></div>
    <div class="carte"><h3>Pilotes disponibles</h3><p class="sous" style="margin-bottom:8px">Pilotes libres et pilotes des autres écuries en fin de contrat. Les meilleurs demandent plus quand la réputation de l'écurie est faible (réputation : ${Math.round(C.reputation)}).</p><div class="marche" id="sMarche"></div></div>
    <div class="carte"><h3>Réglages de la saison ${C.saison + 1}</h3><div id="sRegl"></div></div>
    <button class="btn gros rouge" id="sSuivante">🏁 Commencer la saison ${C.saison + 1}</button>`;
  for(const id of E.pilotes){
    const p = C.pilotes[id], el = document.createElement('div'); el.className = 'pilote';
    const fini = p.fin <= C.saison, dem = M.demande(C, p);
    el.innerHTML = `<div><b>${p.drapeau} ${esc(p.nom)}</b><br><small>${p.age} ans · ${p.points} pts · ${fini ? `<span class="moins">contrat terminé</span>` : `contrat jusqu'en ${p.fin}`}</small></div><div class="etoiles">${'★'.repeat(Math.max(1, Math.round((M.noteGlobale(p) - 70) / 6)))}</div>${carteNotes(p)}`;
    const act = document.createElement('div'); act.className = 'actions';
    for(const ans of [1, 2, 3]){ const b = document.createElement('button'); b.className = 'btn petit' + (fini ? ' vert' : ''); b.textContent = `Prolonger ${ans} an${ans > 1 ? 's' : ''} (${virg(dem)} M€/saison)`;
      b.onclick = () => { const r = M.prolonger(C, p.id, ans); if(r.msg) M.message(C, '✍️ ' + r.msg, 'bon'); sauver(); finDeSaison(); }; act.append(b); }
    el.append(act); $('sMes').append(el);
  }
  for(const p of M.marche(C).slice(0, 14)) $('sMarche').append(cartePiloteMarche(p, finDeSaison));
  editeurReglages($('sRegl'), reglSuivante);
  $('sSuivante').onclick = () => {
    const partent = E.pilotes.map(id => C.pilotes[id]).filter(p => p.fin <= C.saison);
    if(partent.length && !confirm(`${partent.map(p => p.nom).join(' et ')} ${partent.length > 1 ? 'vont' : 'va'} partir (contrat terminé). Continuer ?`)) return;
    C.reglages = { ...reglSuivante }; reglSuivante = null;
    M.nouvelleSaison(C); sauver(); qg('gp');
  };
  montrer('eSaison');
}

window.Paddock = { get C(){ return C; }, get R(){ return R; }, get W(){ return W; }, qg, weekend, lancerSeance, lancerCourse, qualifsRapides, resultats, finDeSaison, accueil, M, Co, voituresCourse, cam,
  nouvelle:(id = 'etoile', reglages = {}) => { C = M.nouvelleCarriere(id, 'Test', null, reglages); sauver(); qg('gp'); } };
accueil();
if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
