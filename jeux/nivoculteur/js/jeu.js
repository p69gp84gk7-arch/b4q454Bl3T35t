'use strict';
/* Nivoculteur 2D · le jeu : écrans, outils de construction, nuits, vue des canons, salle des machines, sauvegarde */

const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('fr-FR');
const keur = n => Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(Math.abs(n) % 1e6 ? 2 : 0).replace('.', ',')} M€` : Math.abs(n) >= 10000 ? `${(n / 1000).toFixed(0)} k€` : `${fmt(n)} €`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
const deg = r => Math.round(r * 180 / Math.PI);
const degC = T => (T > 0 ? '+' : T < 0 ? '−' : '') + Math.abs(T).toFixed(1).replace('.', ',') + ' °C';
const heureDe = u => { const h = 18 + 12 * Math.min(1, u); return `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };

let dom = null, res = null, meteo = null, reg = null;
let phase = 'menu', outil = null, depart = null, selection = null, apercu = null, vitesse = 1, historique = [];
let tNuit = 0, aRecalculer = true, depuisRecalcul = 0, dernier = performance.now(), majHud = 0, majVues = 0;

/* ---------- Messages ---------- */
function message(txt, type = 'info', duree = 4500){
  const m = document.createElement('div'); m.className = 'message ' + type; m.textContent = txt;
  const box = $('messages'); box.appendChild(m);
  while(box.children.length > (innerWidth < 700 ? 2 : 3)) box.firstChild.remove();
  setTimeout(() => { m.classList.add('sortie'); setTimeout(() => m.remove(), 450); }, duree);
}

/* ---------- Partie : nouvelle, reprise, sauvegarde ---------- */
function sauver(){ if(res) ecrire('nivo-partie', res); }
function nouvellePartie(taille){
  const graine = (Date.now() ^ Math.floor(Math.random() * 1e9)) & 0x7fffffff;
  dom = creerDomaine(taille, graine); res = creerReseau(dom); res.nom = dom.nom;
  sauver(); entrerJeu();
  message(`${dom.nom} : ${fmt(dom.objectif)} m³ à mettre sur les pistes en ${dom.nuits} nuits. Commencez par tirer « Eau + câble » depuis la salle des machines.`, 'info', 9000);
}
function reprendre(){
  const r = lire('nivo-partie', null);
  if(!r || r.version !== 2){ return menu(); }
  res = r; dom = creerDomaine(res.taille, res.graine);
  entrerJeu();
}
function entrerJeu(){
  ['eMenu', 'eAide', 'eCanons', 'eSalle'].forEach(id => $(id).hidden = true);
  $('haut').hidden = $('bas').hidden = false;
  tailleCarte(); preparerFond(dom); ajusterVue(dom);
  $('tNom').textContent = dom.nom;
  historique = []; outil = null; depart = null; selection = null; fermerPanneau();
  if(res.enCours) delete res.enCours;          // une nuit interrompue (page fermée) recommence
  if(res.fini){ phase = 'fin'; majBarre(); montrerFin(); return; }
  commencerJour();
}
function commencerJour(){
  phase = 'jour'; meteo = meteoNuit(dom, res.nuit + 1); aRecalculer = true;
  majBarre(); prevoir();
}
function prevoir(){
  const v = meteo.sautes[0], fin = meteo.sautes[meteo.sautes.length - 1];
  message(`Prévision de la nuit ${res.nuit + 1} : ${degC(meteo.soir)} à 18 h, ${degC(meteo.min)} vers 4 h${meteo.redoux ? ', redoux possible vers ' + heureDe(meteo.redoux.t) : ''}. Vent ${v.force ? 'du ' + nomVent(v.dir) + ' ' + v.force + ' km/h' : 'calme'}${meteo.sautes.length > 1 ? `, puis ${fin.force ? 'du ' + nomVent(fin.dir) + ' ' + fin.force + ' km/h' : 'calme'}` : ''}.`, 'info', 8000);
}

/* ---------- Barre du bas et compteurs ---------- */
function majBarre(){
  const jour = phase === 'jour';
  $('rangOutils').hidden = !jour;
  document.querySelectorAll('[data-outil]').forEach(b => b.classList.toggle('actif', b.dataset.outil === outil));
  $('bAnnuler').disabled = !historique.length;
  $('bNuit').hidden = !jour; $('bVitesse').hidden = phase !== 'nuit'; $('progression').hidden = phase !== 'nuit';
  $('bVitesse').textContent = '×' + vitesse;
  const c = $('consigne');
  const txt = !jour ? '' : outil === 'eaucable' || outil === 'eau' || outil === 'cable' ?
    (depart ? `Touchez un regard pour le raccorder, ou un endroit libre pour y poser un nouveau regard. (Retoucher ${depart} : changer de départ)` :
      `Touchez le point de départ : la salle des machines${outil !== 'eau' ? ', un départ électrique ⚡' : ''} ou un regard.`) :
    outil === 'regard' ? 'Touchez l\'endroit où poser un regard seul (à raccorder ensuite).' :
    outil === 'demonter' ? 'Touchez un regard ou une tranchée à démonter (une part du prix est rendue).' : '';
  c.textContent = txt; c.hidden = !txt;
}
function majCompteurs(){
  const nuit = phase === 'nuit', N = res.enCours;
  $('cBudget').textContent = keur(res.budget);
  const neige = res.neigePiste + (N ? N.piste : 0);
  $('cNeige').textContent = `${fmt(neige)}/${fmt(dom.objectif)}`;
  $('cNeigeB').style.width = Math.min(100, neige / dom.objectif * 100) + '%';
  $('cNeigeB').style.background = neige >= dom.objectif ? 'var(--or)' : 'var(--ok)';
  $('cHeureN').textContent = nuit ? `Nuit ${res.numero}/${dom.nuits}` : 'Nuit';
  $('cHeure').textContent = nuit ? heureDe(tNuit / CONFIG.nuit.duree) : `${Math.min(res.nuit + 1, dom.nuits)}/${dom.nuits}`;
  $('cTemp').textContent = nuit && reg ? degC(reg.T) : `${Math.round(meteo.soir)}/${Math.round(meteo.min)}°`;
  $('cTemp').style.color = nuit && reg ? (reg.T >= CONFIG.temperature.debut ? '#FF8A96' : reg.T <= CONFIG.temperature.pleine ? '#8FC2FF' : '') : '';
  const v = nuit && reg ? reg.vent : meteo.sautes[0];
  $('cVent').innerHTML = v.force < 1 ? 'calme' : `<span class="fleche" style="transform:rotate(${-v.dir}rad)">↓</span> ${Math.round(v.force)}`;
  $('cRetenue').textContent = Math.round(res.retenue.volume / dom.retenue.max * 100) + ' %';
  $('cRetenue').style.color = res.retenue.volume <= 0 ? '#FF8A96' : '';
  $('tSous').textContent = nuit ? `Nuit ${res.numero} · ${reg ? fmt(reg.production) + ' m³/h' : ''}` : phase === 'fin' ? 'Partie terminée' : `Jour ${res.nuit + 1} · construire, puis lancer la nuit`;
  if(nuit) $('progressionI').style.width = (tNuit / CONFIG.nuit.duree * 100) + '%';
}

/* ---------- Toucher la carte ---------- */
function noeudProche(x, y){
  const rayon = Math.max(7, 18 / cam.z); let best = null, d = rayon;
  for(const n of res.noeuds){ const e = Math.hypot(n.x - x, n.y - y); if(e < d){ d = e; best = n; } }
  return best;
}
function dansSalle(x, y){ const s = dom.salle; return x > s.x - s.w / 2 - 3 && x < s.x + s.w / 2 + 3 && y > s.y - s.h / 2 - 3 && y < s.y + s.h / 2 + 3; }
function trancheeProche(x, y){
  let best = null, d = Math.max(4, 10 / cam.z);
  for(const t of res.tranchees){ const A = noeud(res, t.a), B = noeud(res, t.b), e = distanceSegment(x, y, [A.x, A.y], [B.x, B.y]); if(e < d){ d = e; best = t; } }
  return best;
}
function toucher(x, y){
  let n = noeudProche(x, y);
  if(!n && dansSalle(x, y)) n = noeud(res, 'pompage');
  if(phase !== 'jour' || !outil){
    if(n && n.type === 'regard'){ choisirCanon(n.id); return; }
    if(n && n.type === 'pompage'){ ouvrirSalle(); return; }
    if(n && n.type === 'elec'){ message(`${n.nom} : il donne du courant aux câbles qui en partent.`); return; }
    if(selection){ selection = null; fermerPanneau(); }
    return;
  }
  if(outil === 'eaucable' || outil === 'eau' || outil === 'cable'){
    const quoi = { eau:outil !== 'cable', cable:outil !== 'eau' };
    if(!depart){
      if(!n){ message('Touchez d\'abord la salle des machines, un départ électrique ou un regard.', 'attention'); return; }
      if(n.type === 'elec' && !quoi.cable){ message('Un départ électrique ne donne pas d\'eau : partez de la salle ou d\'un regard.', 'attention'); return; }
      depart = n.id; majBarre(); return;
    }
    if(n && n.id === depart){ depart = null; apercu = null; fermerPanneau(); majBarre(); return; }
    const A = noeud(res, depart);
    if(n && n.type === 'elec' && quoi.eau){ message('L\'eau ne va pas à un départ électrique : prenez l\'outil « Câble ».', 'attention'); return; }
    if(n && n.type === 'pompage' && A.type === 'elec'){ message('Choisissez un regard.', 'attention'); return; }
    proposerTranchee(A, n || { x, y }, quoi);
    return;
  }
  if(outil === 'regard'){
    if(n){ if(n.type === 'regard') choisirCanon(n.id); return; }
    proposerRegard(x, y); return;
  }
  if(outil === 'demonter'){
    if(n && n.type === 'regard'){ proposerDemontage(n.id); return; }
    const t = trancheeProche(x, y); if(t){ proposerRetrait(t); return; }
    message('Rien à démonter ici.', 'attention');
  }
}

/* ---------- Le panneau du bas ---------- */
let panneauMaj = null;
function ouvrirPanneau(html, maj = null){ const p = $('panneau'); p.innerHTML = html; p.hidden = false; panneauMaj = maj; p.scrollTop = 0; }
function fermerPanneau(){ $('panneau').hidden = true; $('panneau').innerHTML = ''; panneauMaj = null; apercu = null; }
$('panneau').addEventListener('click', e => { if(e.target.closest('.fermer')){ fermerPanneau(); selection = null; } });
function retenir(){ historique.push(JSON.stringify(res)); if(historique.length > 40) historique.shift(); }
function annuler(){
  if(!historique.length || phase !== 'jour') return;
  res = JSON.parse(historique.pop()); depart = null; selection = null; fermerPanneau(); aRecalculer = true; sauver(); majBarre();
  message('Dernière action annulée (l\'argent est rendu).', 'ok', 2500);
}
// Choix de l'enneigeur et du support (pour un nouveau regard ou un remplacement)
function choixEnneigeur(modele, support){
  return `<div class="choix" data-groupe="modele">${Object.keys(CATALOGUE).map(k => { const m = CATALOGUE[k], ok = disponible(res, k);
      return `<button data-v="${k}" class="${k === modele ? 'actif' : ''}" ${ok ? '' : 'disabled'}>${m.court} · ${keur(m.prix)}<small>${ok ? `${m.neige} m³/h de neige · ${m.debit} m³/h d'eau` : `dès ${fmt(m.debloque)} m³ sur les pistes`}</small></button>`; }).join('')}</div>
    <div class="choix" data-groupe="support">${Object.keys(SUPPORTS).map(k => { const s = SUPPORTS[k];
      return `<button data-v="${k}" class="${k === support ? 'actif' : ''}">${s.nom}${s.prix ? ' · +' + keur(s.prix) : ''}<small>portée × ${s.portee.toFixed(2).replace('.', ',')}${s.hauteur > 2 ? ', plus de dérive au vent' : ''}</small></button>`; }).join('')}</div>`;
}
function brancherChoix(etat, rafraichir){
  $('panneau').querySelectorAll('[data-groupe] button').forEach(b => b.onclick = () => { etat[b.parentNode.dataset.groupe] = b.dataset.v; rafraichir(); });
}
function proposerTranchee(A, B, quoi, etat = { modele:'v8', support:'trepied' }){
  const nouveau = !B.id;
  const refusR = nouveau ? refusRegard(dom, res, B.x, B.y) : null;
  const dv = devisTranchee(dom, res, A, B, quoi);
  const prixRegard = nouveau ? CONFIG.couts.regard + prixEnneigeur(etat.modele, etat.support) : 0;
  const total = (dv.prix || 0) + prixRegard, refus = refusR || dv.refus || (total > res.budget ? 'Budget insuffisant.' : null);
  apercu = { A, B, ok:!refus };
  const quoiTxt = quoi.eau && quoi.cable ? 'Eau + câble' : quoi.eau ? 'Conduite d\'eau' : 'Câble';
  ouvrirPanneau(`<h3>${quoiTxt} : ${A.id === 'pompage' ? 'salle' : A.id} → ${nouveau ? 'nouveau regard' : B.id === 'pompage' ? 'salle' : B.id}<button class="fermer">✕</button></h3>
    ${dv.refus ? '' : `<p><b>${fmt(dv.longueur)} m</b> · ${esc(dv.detail)} : <b>${keur(dv.prix)}</b></p>`}
    ${nouveau ? `<p>Nouveau regard (${keur(CONFIG.couts.regard)}) et son enneigeur :</p>${choixEnneigeur(etat.modele, etat.support)}` : ''}
    ${refus ? `<p class="refus">${esc(refus)}</p>` : `<p>Total <b>${keur(total)}</b> · budget après : <b>${keur(res.budget - total)}</b></p>`}
    <div class="actions"><button class="btn fermer">Annuler</button><button class="btn ok" id="bValider" ${refus ? 'disabled' : ''}>Valider</button></div>`);
  brancherChoix(etat, () => proposerTranchee(A, B, quoi, etat));
  $('bValider').onclick = () => {
    retenir();
    let cible = B;
    if(nouveau) cible = poserRegard(dom, res, B.x, B.y, etat.modele, etat.support);
    ajouterTranchee(res, A.id, cible.id, quoi); res.budget -= dv.prix;
    depart = cible.id; fermerPanneau(); aRecalculer = true; sauver(); majBarre();
    const e = etatRegard(res, cible.id);
    if(cible.type === 'regard') message(e.pret ? `${cible.id} raccordé : il est prêt à faire de la neige.` : `${cible.id} : il manque encore ${e.manque.join(' et ')}.`, e.pret ? 'ok' : 'attention', 3500);
  };
}
function proposerRegard(x, y, etat = { modele:'v8', support:'trepied' }){
  const refus = refusRegard(dom, res, x, y), prix = CONFIG.couts.regard + prixEnneigeur(etat.modele, etat.support);
  const r2 = refus || (prix > res.budget ? 'Budget insuffisant.' : null);
  apercu = null;
  ouvrirPanneau(`<h3>Nouveau regard<button class="fermer">✕</button></h3><p>Regard ${keur(CONFIG.couts.regard)} + enneigeur. Il faudra le raccorder à l'eau et à l'électricité.</p>
    ${choixEnneigeur(etat.modele, etat.support)}
    ${r2 ? `<p class="refus">${esc(r2)}</p>` : `<p>Total <b>${keur(prix)}</b> · budget après : <b>${keur(res.budget - prix)}</b></p>`}
    <div class="actions"><button class="btn fermer">Annuler</button><button class="btn ok" id="bValider" ${r2 ? 'disabled' : ''}>Poser</button></div>`);
  brancherChoix(etat, () => proposerRegard(x, y, etat));
  $('bValider').onclick = () => { retenir(); const n = poserRegard(dom, res, x, y, etat.modele, etat.support); fermerPanneau(); aRecalculer = true; sauver(); depart = null; message(`${n.id} posé : raccordez-le avec « Eau + câble ».`, 'ok'); };
}
function proposerDemontage(id){
  const d = devisDemontage(res, id);
  ouvrirPanneau(`<h3>Démonter ${id}<button class="fermer">✕</button></h3><p>Le regard, son enneigeur et ${d.tranchees} tranchée${d.tranchees > 1 ? 's' : ''} qui y arrive${d.tranchees > 1 ? 'nt' : ''} sont retirés. On récupère <b>${keur(d.rendu)}</b>.</p>
    <div class="actions"><button class="btn fermer">Annuler</button><button class="btn rouge" id="bValider">Démonter</button></div>`);
  $('bValider').onclick = () => { retenir(); demonter(res, id); if(depart === id) depart = null; selection = null; fermerPanneau(); aRecalculer = true; sauver(); message(`${id} démonté.`, 'ok', 2500); };
}
function proposerRetrait(t){
  const A = noeud(res, t.a), B = noeud(res, t.b);
  ouvrirPanneau(`<h3>Tranchée ${A.id === 'pompage' ? 'salle' : A.id} – ${B.id === 'pompage' ? 'salle' : B.id}<button class="fermer">✕</button></h3><p>${t.eau ? 'Conduite d\'eau' : ''}${t.eau && t.cable ? ' et ' : ''}${t.cable ? 'câble' : ''}, ${fmt(longueur(res, t.a, t.b))} m. On récupère ${Math.round(CONFIG.couts.repriseTranchee * 100)} % de son prix.</p>
    <div class="actions"><button class="btn fermer">Annuler</button><button class="btn rouge" id="bValider">Retirer la tranchée</button></div>`);
  $('bValider').onclick = () => { retenir(); const r = retirerTranchee(res, t); fermerPanneau(); aRecalculer = true; sauver(); message(`Tranchée retirée, ${keur(r)} rendus.`, 'ok', 2500); };
}

/* ---------- La fiche d'un canon ---------- */
const NOMS_ETATS = { marche:'En marche', arret:'À l\'arrêt', defaut:'En défaut', chaud:'Trop chaud' };
function jaugePression(m){
  const max = CONFIG.pression.cadranMax, z = CONFIG.pression.zones, p = v => (v / max * 100).toFixed(1) + '%';
  return `linear-gradient(90deg, #E04A4A 0 ${p(m.pressionMin)}, #E58A1F ${p(m.pressionMin)} ${p(m.pressionPleine)}, #38D07A ${p(m.pressionPleine)} ${p(z.correcte)}, #E58A1F ${p(z.correcte)} ${p(z.surpression)}, #E04A4A ${p(z.surpression)} 100%)`;
}
function choisirCanon(id, etat = null){
  selection = id; aRecalculer = true; reg = calculer();
  const n = noeud(res, id), c = n.canon, m = CATALOGUE[c.modele], jour = phase === 'jour';
  etat = etat || { modele:c.modele, support:c.support };
  const change = etat.modele !== c.modele || etat.support !== c.support, dv = change ? devisChangement(res, id, etat.modele, etat.support) : null;
  ouvrirPanneau(`<h3><span class="etat" id="fEtat"></span>${id} · ${m.nom} · ${SUPPORTS[c.support].nom}<button class="fermer">✕</button></h3>
    <p id="fRaison"></p>
    <div class="grille2">
      <div class="case"><small>Pression ${jour ? 'prévue' : ''}</small><b id="fPression">–</b><div class="jauge" style="background:${jaugePression(m)}"><i id="fJauge"></i></div></div>
      <div class="case"><small>Production</small><b id="fProd">–</b></div>
      <div class="case"><small>Neige sur la piste</small><b id="fPart">–</b></div>
      <div class="case"><small>${jour ? 'Altitude' : 'Température ici'}</small><b id="fTemp">–</b></div>
    </div>
    <p style="margin-top:8px"><b>Mode</b></p>
    <div class="choix" id="fMode">${[['auto', 'Auto', 'démarre seul sous −2 °C'], ['marche', 'Marche', 'tourne même au chaud'], ['arret', 'Arrêt', '']].map(([k, nom, aide]) => `<button data-m="${k}" class="${c.mode === k ? 'actif' : ''}">${nom}${aide ? `<small>${aide}</small>` : ''}</button>`).join('')}</div>
    <p style="margin-top:8px"><b>Orientation</b> : <span id="fDir">${deg(c.dir)}°</span> <button class="btn" id="fVersPiste" style="padding:4px 9px;margin-left:6px">↧ Vers la piste</button></p>
    <input type="range" id="fCurseur" min="-180" max="180" step="5" value="${deg(c.dir)}">
    ${jour ? `<p style="margin-top:8px"><b>Changer d'enneigeur</b> (l'ancien est repris à ${Math.round(CONFIG.couts.reprise * 100)} %)</p>${choixEnneigeur(etat.modele, etat.support)}
      ${change ? `<p>Remplacement : <b>${dv.prix >= 0 ? keur(dv.prix) : 'vous récupérez ' + keur(-dv.prix)}</b>${dv.prix > res.budget ? ' <span class="refus">Budget insuffisant.</span>' : ''}</p>` : ''}
      <div class="actions"><button class="btn rouge" id="fDemonter">Démonter</button>${change ? `<button class="btn ok" id="fChanger" ${dv.prix > res.budget ? 'disabled' : ''}>Remplacer</button>` : ''}</div>` : ''}`,
    majFiche);
  $('fMode').querySelectorAll('button').forEach(b => b.onclick = () => { c.mode = b.dataset.m; $('fMode').querySelectorAll('button').forEach(x => x.classList.toggle('actif', x === b)); aRecalculer = true; sauver(); });
  $('fCurseur').oninput = e => { c.dir = +e.target.value * Math.PI / 180; $('fDir').textContent = e.target.value + '°'; aRecalculer = true; };
  $('fCurseur').onchange = () => sauver();
  $('fVersPiste').onclick = () => { c.dir = directionVersPiste(dom, n.x, n.y); $('fCurseur').value = deg(c.dir); $('fDir').textContent = deg(c.dir) + '°'; aRecalculer = true; sauver(); };
  if(jour){
    brancherChoix(etat, () => choisirCanon(id, etat));
    $('fDemonter').onclick = () => proposerDemontage(id);
    if(change) $('fChanger').onclick = () => { retenir(); changerEnneigeur(res, id, etat.modele, etat.support); aRecalculer = true; sauver(); message(`${id} : ${CATALOGUE[etat.modele].nom} sur ${SUPPORTS[etat.support].nom.toLowerCase()}.`, 'ok', 2500); choisirCanon(id); };
  }
  majFiche();
}
function majFiche(){
  if(!selection || !reg) return;
  const c = reg.canons.find(x => x.id === selection); if(!c) return;
  const m = CATALOGUE[c.modele];
  $('fEtat').className = 'etat ' + c.etat;
  $('fRaison').innerHTML = `<b>${NOMS_ETATS[c.etat]}</b>${c.raison ? ' · ' + esc(c.raison) : ''}`;
  $('fPression').textContent = c.pret ? `${c.pression.toFixed(1).replace('.', ',')} bar` : '–';
  $('fJauge').style.left = Math.min(100, c.pression / CONFIG.pression.cadranMax * 100) + '%';
  $('fProd').textContent = phase === 'jour' ? `${m.neige} m³/h maxi` : `${fmt(c.production)} m³/h`;
  $('fPart').textContent = Math.round(c.part * 100) + ' %';
  $('fPart').style.color = c.part > .6 ? '#7FE0A8' : c.part > .25 ? '#F2C230' : '#FF8A96';
  $('fTemp').textContent = phase === 'jour' ? `${fmt(dom.alt(c.n.x, c.n.y))} m` : degC(c.T);
}

/* ---------- La nuit ---------- */
function calculer(){ return regime(dom, res, meteo, phase === 'nuit' ? Math.min(1, tNuit / CONFIG.nuit.duree) : null); }
function lancerNuit(){
  if(phase !== 'jour') return;
  const prets = res.noeuds.filter(n => n.type === 'regard' && etatRegard(res, n.id).pret).length;
  if(!prets && !confirm('Aucun canon n\'est raccordé (eau + électricité). Lancer la nuit quand même ?')) return;
  outil = null; depart = null; apercu = null; fermerPanneau(); historique = [];
  meteo = debutNuit(dom, res); tNuit = 0; phase = 'nuit'; aRecalculer = true; reg = calculer();
  majBarre();
  message(`Nuit ${res.numero} : ${degC(meteo.soir)} à 18 h. Les canons en auto démarrent sous −2 °C.`, 'info', 5000);
}
let derniereT = null, dernierVent = null;
function avancer(dt){
  const d = dt * vitesse;
  tNuit = Math.min(CONFIG.nuit.duree, tNuit + d);
  depuisRecalcul += d;
  if(aRecalculer || depuisRecalcul > .25){ reg = calculer(); aRecalculer = false; depuisRecalcul = 0; }
  avancerNuit(dom, res, reg, d);
  // annonces : passage sous −2 °C, redoux, saute de vent, retenue vide
  // (avec une petite marge, pour ne pas annoncer dix fois le même passage autour de −2 °C)
  const chaud = derniereT === null ? reg.T >= CONFIG.temperature.debut : derniereT ? reg.T > CONFIG.temperature.debut - .4 : reg.T > CONFIG.temperature.debut + .4;
  if(derniereT !== null && chaud !== derniereT) message(chaud ? `Il fait ${degC(reg.T)} : trop chaud pour la neige, les canons en auto s'arrêtent.` : `${degC(reg.T)} : assez froid, les canons en auto démarrent.`, chaud ? 'attention' : 'ok', 4000);
  derniereT = chaud;
  const s = meteo.sautes.filter(x => x.t <= tNuit / CONFIG.nuit.duree).length;
  if(dernierVent !== null && s !== dernierVent){ const v = meteo.sautes[s - 1]; message(`Le vent tourne : ${v.force ? 'du ' + nomVent(v.dir) + ', ' + v.force + ' km/h' : 'il tombe'}. Vérifiez où tombe la neige (🗺 Canons).`, 'attention', 5500); }
  dernierVent = s;
  if(res.retenue.volume <= 0 && !avancer.sec){ avancer.sec = true; message('La retenue est vide : les pompes s\'arrêtent !', 'alarme', 6000); }
  if(tNuit >= CONFIG.nuit.duree) terminerNuit();
}
function terminerNuit(){
  const b = finNuit(dom, res); avancer.sec = false; derniereT = dernierVent = null;
  phase = 'bilan'; vitesse = 1; sauver(); majBarre(); reg = null;
  const ligne = (n, v, cls = '') => `<tr><td>${n}</td><td class="${cls}">${v}</td></tr>`;
  ouvrirPanneau(`<h3>☀️ Bilan de la nuit ${b.nuit}</h3>
    <table class="bilan">
      ${ligne('Neige produite', fmt(b.neige) + ' m³')}
      ${ligne('Tombée sur les pistes', fmt(b.piste) + ' m³', 'plus')}
      ${Object.entries(b.parPiste).map(([k, v]) => ligne('&nbsp;&nbsp;· ' + esc(k), fmt(v) + ' m³')).join('')}
      ${ligne('Perdue hors piste', fmt(b.hors) + ' m³', b.hors > b.piste * .3 ? 'moins' : '')}
      ${b.chaud ? ligne('Eau gaspillée au chaud', fmt(b.chaud) + ' m³', 'moins') : ''}
      ${ligne('Neige vendue (20 €/m³)', '+' + keur(b.gain), 'plus')}
      ${ligne('Électricité des pompes', '−' + keur(b.elec), 'moins')}
      ${ligne(`Eau remontée dans la retenue (${fmt(b.remplissage)} m³)`, '−' + keur(b.eau), 'moins')}
      ${ligne('<b>Résultat de la nuit</b>', `<b>${b.net >= 0 ? '+' : '−'}${keur(Math.abs(b.net))}</b>`, b.net >= 0 ? 'plus' : 'moins')}
    </table>
    <p>Total sur les pistes : <b>${fmt(res.neigePiste)} / ${fmt(dom.objectif)} m³</b> (${Math.round(res.neigePiste / dom.objectif * 100)} %) · nuit ${res.nuit}/${dom.nuits}</p>
    ${b.debloques.length ? `<p>🔓 Débloqué : <b>${b.debloques.map(k => CATALOGUE[k].nom).join(', ')}</b></p>` : ''}
    <div class="actions"><button class="btn or" id="bSuite">${res.fini ? 'Voir le résultat' : '☀️ Journée suivante'}</button></div>`);
  $('bSuite').onclick = () => { fermerPanneau(); if(res.fini){ phase = 'fin'; montrerFin(); } else commencerJour(); };
}
function montrerFin(){
  majBarre();
  const e = etoiles(dom, res), f = res.neigePiste / dom.objectif;
  const rec = lire('nivo-records', {}), r = rec[res.taille] || { etoiles:0, meilleur:0, parties:0 };
  if(!res.compte){ r.parties++; r.etoiles = Math.max(r.etoiles, e); r.meilleur = Math.max(r.meilleur, Math.round(f * 100)); rec[res.taille] = r; ecrire('nivo-records', rec); res.compte = true; sauver(); }
  ouvrirPanneau(`<h3>${e ? '🏆 Objectif atteint !' : 'Objectif manqué'}</h3>
    <p style="text-align:center;font-size:2rem;color:var(--or);letter-spacing:.15em;margin:6px 0">${'★'.repeat(e)}${'☆'.repeat(3 - e)}</p>
    <p><b>${fmt(res.neigePiste)} m³</b> sur les pistes pour un objectif de ${fmt(dom.objectif)} m³ (${Math.round(f * 100)} %), en ${dom.nuits} nuits.</p>
    <p>Budget restant : <b>${keur(res.budget)}</b> · ${res.noeuds.filter(n => n.type === 'regard').length} canons posés · ${fmt(res.neigeTotale)} m³ produits en tout.</p>
    <p>2 étoiles à 125 %, 3 étoiles à 150 % de l'objectif.</p>
    <div class="actions"><button class="btn" id="bVoirCarte">Voir la carte</button><button class="btn or" id="bNouveau">Nouveau domaine</button></div>`);
  $('bVoirCarte').onclick = fermerPanneau;
  $('bNouveau').onclick = () => { fermerPanneau(); menu(); };
}

/* ---------- La vue d'ensemble des canons ---------- */
let vignettes = new Map(), menuOuvert = null;
function ouvrirCanons(){
  aRecalculer = true; reg = calculer();
  $('eCanons').hidden = false; construirePlan(); majCanons();
}
function construirePlan(){
  const plan = $('plan'), corps = $('corpsCanons'); plan.querySelectorAll('.vignette, .menuVignette').forEach(v => v.remove()); vignettes.clear(); menuOuvert = null;
  const largeur = Math.min(corps.clientWidth - 4, 760), e = largeur / dom.W, hauteur = dom.H * e;
  plan.style.width = largeur + 'px'; plan.style.height = hauteur + 'px';
  const regards = res.noeuds.filter(n => n.type === 'regard');
  // place des vignettes : au-dessus de leur canon, écartées les unes des autres sans trop s'éloigner
  const VW = 78, VH = 46, pos = regards.map(n => ({ n, x:n.x * e - VW / 2, y:n.y * e - VH - 6, ax:n.x * e, ay:n.y * e }));
  for(let it = 0; it < 120; it++){
    for(let i = 0; i < pos.length; i++) for(let j = i + 1; j < pos.length; j++){
      const a = pos[i], b = pos[j], dx = (a.x + VW / 2) - (b.x + VW / 2), dy = (a.y + VH / 2) - (b.y + VH / 2);
      const ox = VW + 4 - Math.abs(dx), oy = VH + 4 - Math.abs(dy);
      if(ox > 0 && oy > 0){ if(ox < oy * 1.4){ const s = (dx >= 0 ? 1 : -1) * ox / 2; a.x += s; b.x -= s; } else { const s = (dy >= 0 ? 1 : -1) * oy / 2; a.y += s; b.y -= s; } }
    }
    for(const p of pos){ p.x += (p.ax - VW / 2 - p.x) * .02; p.y += (p.ay - VH - 6 - p.y) * .02; p.x = borne(p.x, 0, largeur - VW); p.y = borne(p.y, 0, hauteur - VH); }
  }
  // le fond du plan : pistes, salle, retenue, et un trait de chaque vignette à son canon
  const c = $('planFond'), x = c.getContext('2d'), d = Math.min(2, devicePixelRatio || 1);
  c.width = largeur * d; c.height = hauteur * d; c.style.width = largeur + 'px'; c.style.height = hauteur + 'px';
  x.setTransform(d, 0, 0, d, 0, 0); x.fillStyle = '#16233D'; x.fillRect(0, 0, largeur, hauteur);
  x.save(); x.scale(e, e);
  for(const p of dom.pistes){ x.lineJoin = x.lineCap = 'round'; x.strokeStyle = COULEURS_PISTES[p.couleur]; x.globalAlpha = .55; x.lineWidth = p.largeur; trace(x, p.points); x.stroke(); }
  x.globalAlpha = 1;
  x.fillStyle = '#2F6FDE'; x.beginPath(); x.arc(dom.retenue.x, dom.retenue.y, dom.retenue.r, 0, 6.29); x.fill();
  x.fillStyle = '#7A8BA3'; x.fillRect(dom.salle.x - dom.salle.w / 2, dom.salle.y - dom.salle.h / 2, dom.salle.w, dom.salle.h);
  for(const t of res.tranchees){ const A = noeud(res, t.a), B = noeud(res, t.b); x.strokeStyle = t.eau ? 'rgba(61,139,255,.8)' : 'rgba(242,194,48,.8)'; x.lineWidth = 2 / e; x.beginPath(); x.moveTo(A.x, A.y); x.lineTo(B.x, B.y); x.stroke(); }
  x.restore();
  x.strokeStyle = 'rgba(234,242,255,.4)'; x.lineWidth = 1;
  for(const p of pos){ x.beginPath(); x.moveTo(p.ax, p.ay); x.lineTo(p.x + VW / 2, p.y + VH / 2); x.stroke(); x.fillStyle = '#EAF2FF'; x.beginPath(); x.arc(p.ax, p.ay, 3, 0, 6.29); x.fill(); }
  for(const p of pos){
    const v = document.createElement('button'); v.className = 'vignette'; v.style.left = p.x + 'px'; v.style.top = p.y + 'px';
    v.innerHTML = `<b><span class="etat"></span>${p.n.id}<em></em></b><span class="l1"></span><span class="l2"></span>`;
    v.onclick = ev => { ev.stopPropagation(); ouvrirMenuVignette(p.n.id, v); };
    plan.appendChild(v); vignettes.set(p.n.id, v);
  }
  if(!regards.length) plan.insertAdjacentHTML('beforeend', '<p class="vignette" style="position:absolute;left:10px;top:10px;width:auto">Aucun canon posé pour l\'instant.</p>');
}
function ouvrirMenuVignette(id, v){
  const plan = $('plan'); plan.querySelectorAll('.menuVignette').forEach(m => m.remove());
  vignettes.forEach(x => x.classList.toggle('choisie', x === v));
  const n = noeud(res, id), m = document.createElement('div'); m.className = 'menuVignette';
  m.innerHTML = [['auto', 'Auto'], ['marche', 'Marche'], ['arret', 'Arrêt']].map(([k, t]) => `<button data-m="${k}" class="${n.canon.mode === k ? 'actif' : ''}">${t}</button>`).join('') + '<button data-voir="1">Voir ›</button>';
  m.style.left = Math.max(0, Math.min(plan.clientWidth - 230, v.offsetLeft - 70)) + 'px'; m.style.top = (v.offsetTop + v.offsetHeight + 4) + 'px';
  m.onclick = ev => {
    ev.stopPropagation(); const b = ev.target.closest('button'); if(!b) return;
    if(b.dataset.voir){ $('eCanons').hidden = true; cam.x = n.x; cam.y = n.y + 40 / cam.z; cam.z = Math.max(cam.z, 1.6); choisirCanon(id); return; }
    n.canon.mode = b.dataset.m; aRecalculer = true; sauver(); reg = calculer(); majCanons(); m.remove(); v.classList.remove('choisie');
  };
  plan.appendChild(m); menuOuvert = m;
}
$('corpsCanons').addEventListener('click', () => { $('plan').querySelectorAll('.menuVignette').forEach(m => m.remove()); vignettes.forEach(v => v.classList.remove('choisie')); });
function majCanons(){
  if($('eCanons').hidden || !reg) return;
  const nuit = phase === 'nuit', compte = { marche:0, arret:0, defaut:0, chaud:0 };
  for(const c of reg.canons){
    compte[c.etat]++;
    const v = vignettes.get(c.id); if(!v) continue;
    v.className = 'vignette ' + c.etat + (v.classList.contains('choisie') ? ' choisie' : '');
    v.querySelector('.etat').className = 'etat ' + c.etat;
    v.querySelector('em').textContent = { auto:'AUTO', marche:'MARCHE', arret:'ARRÊT' }[c.mode];
    v.querySelector('.l1').textContent = c.pret ? `${c.pression.toFixed(0)} bar · ${Math.round(c.part * 100)} % piste` : 'non raccordé';
    v.querySelector('.l2').textContent = nuit ? (c.production > 0 ? `${fmt(c.production)} m³/h · ${degC(c.T)}` : c.raison ? c.raison.split(' :')[0] : NOMS_ETATS[c.etat]) : `${CATALOGUE[c.modele].court} · ${CATALOGUE[c.modele].neige} m³/h maxi`;
  }
  const cs = (t, v, col = '') => `<div class="cpt"><small>${t}</small><b style="color:${col}">${v}</b></div>`;
  $('resumeCanons').innerHTML = cs('En marche', compte.marche, '#38D07A') + cs('Arrêtés', compte.arret, '#E04A4A') + cs('En défaut', compte.defaut + compte.chaud, '#F2C230') +
    cs(nuit ? 'Production' : 'Production maxi', fmt(nuit ? reg.production : reg.canons.reduce((s, c) => s + (c.ouvert ? CATALOGUE[c.modele].neige * c.fP : 0), 0)) + ' m³/h') +
    cs('Débit d\'eau', fmt(reg.debit) + ' m³/h') + cs('Départ salle', reg.pDepart.toFixed(0) + ' bar') + (nuit ? cs('Temp. en bas', degC(reg.T)) : '');
}
document.querySelectorAll('[data-tous]').forEach(b => b.onclick = () => {
  for(const n of res.noeuds) if(n.type === 'regard') n.canon.mode = b.dataset.tous;
  aRecalculer = true; sauver(); reg = calculer(); majCanons();
  message({ auto:'Tous les canons en auto.', marche:'Tous les canons démarrés.', arret:'Tous les canons arrêtés.' }[b.dataset.tous], 'ok', 2000);
});

/* ---------- La salle des machines ---------- */
function ouvrirSalle(){
  aRecalculer = true; reg = calculer();
  const cp = CONFIG.pompage;
  $('blocsSalle').innerHTML = `
    <div class="bloc"><h4>Pompes (automatique)</h4><div class="pompes">${[0, 1, 2].map(i => `<div class="pompe" id="sP${i}"><div class="rond">P${i + 1}</div><span>arrêt</span></div>`).join('')}</div>
      <p style="font-size:.8rem;color:var(--doux);margin:6px 0 0">${cp.pompes} pompes de ${cp.debitNominal} m³/h, ${cp.puissance} kW chacune : la salle démarre juste ce qu'il faut. (Conduite à la main : étape suivante.)</p></div>
    <div class="bloc"><h4>Départ vers les pistes</h4><div class="grille2"><div class="case"><small>Pression</small><b id="sPression">–</b></div><div class="case"><small>Débit demandé</small><b id="sDebit">–</b></div></div>
      <div class="jauge" style="background:linear-gradient(90deg, #E04A4A 0 ${cp.zoneVerte[0] / 80 * 100}%, #38D07A ${cp.zoneVerte[0] / 80 * 100}% ${cp.zoneVerte[1] / 80 * 100}%, #E58A1F ${cp.zoneVerte[1] / 80 * 100}% 100%)"><i id="sJauge"></i></div>
      <p style="font-size:.8rem;color:var(--doux);margin:4px 0 0">Zone verte : ${cp.zoneVerte[0]} à ${cp.zoneVerte[1]} bar · capacité <span id="sCapa"></span></p></div>
    <div class="bloc"><h4>Retenue</h4><div class="grille2"><div class="case"><small>Volume</small><b id="sVol">–</b></div><div class="case"><small>Plein</small><b>${fmt(dom.retenue.max)} m³</b></div></div>
      <p style="margin:6px 0 2px;font-size:.84rem">Remplissage chaque jour (${CONFIG.retenue.prixM3.toString().replace('.', ',')} €/m³) :</p>
      <div class="choix" id="sRemplir">${CONFIG.retenue.choix.map(v => `<button data-v="${v}" class="${res.retenue.remplissage === v ? 'actif' : ''}">${v ? fmt(v) + ' m³' : 'Arrêt'}</button>`).join('')}</div></div>
    <div class="bloc"><h4>Température humide de la nuit ${phase === 'nuit' ? res.numero : res.nuit + 1}</h4><canvas id="sCourbe" style="width:100%;height:130px"></canvas>
      <p style="font-size:.8rem;color:var(--doux);margin:4px 0 0">En bas du domaine. En haut, il fait ${(CONFIG.temperature.gradient * dom.den / 100).toFixed(1).replace('.', ',')} °C de moins. Lignes : −2 °C (début), −4 °C (moitié), −7 °C (pleine production).</p></div>
    <div class="bloc"><h4>Vent</h4><p id="sVent" style="margin:0;line-height:1.5"></p></div>
    <div class="bloc"><h4>Cette nuit</h4><div class="grille2"><div class="case"><small>Neige produite</small><b id="sNeige">–</b></div><div class="case"><small>Électricité</small><b id="sElec">–</b></div></div></div>`;
  $('sRemplir').querySelectorAll('button').forEach(b => b.onclick = () => { res.retenue.remplissage = +b.dataset.v; $('sRemplir').querySelectorAll('button').forEach(x => x.classList.toggle('actif', x === b)); sauver(); });
  $('eSalle').hidden = false; majSalle(true);
}
function majSalle(courbe = false){
  if($('eSalle').hidden || !reg) return;
  for(let i = 0; i < 3; i++){ const on = i < reg.pompes; $('sP' + i).classList.toggle('on', on); $('sP' + i).querySelector('span').textContent = on ? 'marche' : 'arrêt'; }
  $('sPression').textContent = reg.pDepart.toFixed(1).replace('.', ',') + ' bar';
  $('sJauge').style.left = Math.min(100, reg.pDepart / 80 * 100) + '%';
  $('sDebit').textContent = fmt(reg.debit) + ' m³/h';
  $('sCapa').textContent = `${fmt(reg.capacite)} m³/h avec ${reg.pompes} pompe${reg.pompes > 1 ? 's' : ''}`;
  $('sVol').textContent = fmt(res.retenue.volume) + ' m³';
  const N = res.enCours;
  $('sNeige').textContent = N ? fmt(N.neige) + ' m³' : '–';
  $('sElec').textContent = N ? keur(N.kwh * CONFIG.electricite.prixKwh) : '–';
  const v = phase === 'nuit' ? reg.vent : meteo.sautes[0];
  $('sVent').innerHTML = `${phase === 'nuit' ? 'Maintenant' : 'À 18 h'} : <b>${v.force < 1 ? 'calme' : 'du ' + nomVent(v.dir) + ', ' + Math.round(v.force) + ' km/h'}</b><br>` +
    meteo.sautes.slice(1).map(s => `Vers ${heureDe(s.t)} : ${s.force ? 'du ' + nomVent(s.dir) + ', ' + s.force + ' km/h' : 'calme'}`).join('<br>');
  if(courbe || phase === 'nuit') dessinerCourbe();
}
function dessinerCourbe(){
  const c = $('sCourbe'); if(!c) return;
  const w = c.clientWidth, h = c.clientHeight, d = Math.min(2, devicePixelRatio || 1); if(!w) return;
  c.width = w * d; c.height = h * d; const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0);
  const Tmax = 4, Tmin = -14, Y = T => 6 + (Tmax - T) / (Tmax - Tmin) * (h - 22), X = u => 28 + u * (w - 34);
  x.fillStyle = 'rgba(255,255,255,.03)'; x.fillRect(0, 0, w, h);
  x.font = '600 10px "Saira Condensed", sans-serif'; x.fillStyle = 'rgba(234,242,255,.6)';
  for(const [T, col] of [[-2, '#FF8A96'], [-4, '#F2C230'], [-7, '#8FC2FF']]){ x.strokeStyle = col; x.globalAlpha = .55; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(X(0), Y(T)); x.lineTo(X(1), Y(T)); x.stroke(); x.setLineDash([]); x.globalAlpha = 1; x.fillText(T + '°', 2, Y(T) + 3); }
  for(let k = 0; k <= 12; k += 3){ x.fillText(heureDe(k / 12), X(k / 12) - 12, h - 3); }
  x.strokeStyle = '#EAF2FF'; x.lineWidth = 2; x.beginPath();
  for(let i = 0; i <= 60; i++){ const u = i / 60; i ? x.lineTo(X(u), Y(temperature(meteo, u))) : x.moveTo(X(u), Y(temperature(meteo, u))); }
  x.stroke();
  if(phase === 'nuit'){ const u = tNuit / CONFIG.nuit.duree; x.strokeStyle = '#E9B949'; x.beginPath(); x.moveTo(X(u), 4); x.lineTo(X(u), h - 14); x.stroke(); x.fillStyle = '#E9B949'; x.beginPath(); x.arc(X(u), Y(temperature(meteo, u)), 4, 0, 6.29); x.fill(); }
}

/* ---------- Le menu ---------- */
function menu(){
  phase = 'menu'; fermerPanneau();
  $('haut').hidden = $('bas').hidden = true; ['eCanons', 'eSalle', 'eAide'].forEach(id => $(id).hidden = true);
  const p = lire('nivo-partie', null), rec = lire('nivo-records', {});
  $('menuReprise').innerHTML = p && p.version === 2 && !p.fini ? `<button class="carteMenu reprise" id="bReprendre"><span class="ico">▶</span><span><b>Reprendre : ${esc(p.nom || 'domaine')}</b><small>${CONFIG.domaines[p.taille].nom} · nuit ${p.nuit + 1}/${CONFIG.domaines[p.taille].nuits} · ${fmt(p.neigePiste)} / ${fmt(CONFIG.domaines[p.taille].objectif)} m³ · ${keur(p.budget)}</small></span></button>` : '';
  $('menuDomaines').innerHTML = '<p style="margin:6px 0 0;color:var(--doux);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;font-weight:700">Nouveau domaine au hasard</p>' +
    Object.entries(CONFIG.domaines).map(([k, D]) => { const r = rec[k];
      return `<button class="carteMenu" data-taille="${k}"><span class="ico">${{ petit:'⛷️', moyen:'🏔️', grand:'🗻' }[k]}</span><span><b>${D.nom}</b><small>${D.pistes[0] === D.pistes[1] ? D.pistes[0] : D.pistes.join(' ou ')} pistes · ${fmt(D.objectif)} m³ en ${D.nuits} nuits · ${keur(D.budget)}</small></span><span class="droite">${r ? '★'.repeat(r.etoiles) + '☆'.repeat(3 - r.etoiles) + `<br><small>${r.meilleur} %</small>` : ''}</span></button>`; }).join('');
  $('eMenu').hidden = false;
  $('bRetourJeu').hidden = !(res && dom && !res.fini && p && p.graine === res.graine);
  if($('bReprendre')) $('bReprendre').onclick = reprendre;
  $('menuDomaines').querySelectorAll('[data-taille]').forEach(b => b.onclick = () => {
    if(p && p.version === 2 && !p.fini && !confirm('Une partie est en cours. La remplacer par un nouveau domaine ?')) return;
    nouvellePartie(b.dataset.taille);
  });
}

/* ---------- Commandes de la carte : un doigt = déplacer, deux doigts = zoomer, toucher court = action ---------- */
const doigts = new Map(); let geste = null;
cv.addEventListener('pointerdown', e => {
  if(phase === 'menu') return;
  try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  doigts.set(e.pointerId, { x:e.clientX, y:e.clientY, x0:e.clientX, y0:e.clientY, t0:performance.now() });
  if(doigts.size === 2){ const [a, b] = [...doigts.values()]; geste = { d:Math.hypot(a.x - b.x, a.y - b.y), z:cam.z }; }
});
cv.addEventListener('pointermove', e => {
  const d = doigts.get(e.pointerId); if(!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
  if(doigts.size === 1){ if(Math.hypot(d.x - d.x0, d.y - d.y0) > 8) d.bouge = true; if(d.bouge){ cam.x -= dx / cam.z; cam.y -= dy / cam.z; borneVue(); } }
  else if(doigts.size === 2 && geste){
    const [a, b] = [...doigts.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const [wx, wy] = versMonde(mx, my); cam.z = borne(geste.z * dist / geste.d, .4, 8); const [wx2, wy2] = versMonde(mx, my);
    cam.x += wx - wx2; cam.y += wy - wy2; a.bouge = b.bouge = true; borneVue();
  }
});
const lacher = e => {
  const d = doigts.get(e.pointerId); if(!d) return;
  doigts.delete(e.pointerId); if(doigts.size < 2) geste = null;
  if(!d.bouge && doigts.size === 0 && performance.now() - d.t0 < 500){ const [x, y] = versMonde(e.clientX, e.clientY); toucher(x, y); }
};
cv.addEventListener('pointerup', lacher); cv.addEventListener('pointercancel', e => doigts.delete(e.pointerId));
cv.addEventListener('wheel', e => { e.preventDefault(); const [wx, wy] = versMonde(e.clientX, e.clientY); cam.z = borne(cam.z * Math.exp(-e.deltaY * .0015), .4, 8); const [wx2, wy2] = versMonde(e.clientX, e.clientY); cam.x += wx - wx2; cam.y += wy - wy2; borneVue(); }, { passive:false });
function borneVue(){ if(!dom) return; cam.x = borne(cam.x, 0, dom.W); cam.y = borne(cam.y, 0, dom.H); }
addEventListener('resize', () => { tailleCarte(); if(!$('eCanons').hidden) construirePlan(); });

/* ---------- Boutons ---------- */
document.querySelectorAll('[data-outil]').forEach(b => b.onclick = () => { outil = outil === b.dataset.outil ? null : b.dataset.outil; depart = null; apercu = null; selection = null; fermerPanneau(); majBarre(); });
$('bAnnuler').onclick = annuler;
$('bNuit').onclick = lancerNuit;
$('bVitesse').onclick = () => { const v = CONFIG.nuit.vitesses; vitesse = v[(v.indexOf(vitesse) + 1) % v.length]; majBarre(); };
$('bCanons').onclick = ouvrirCanons; $('bFermerCanons').onclick = () => $('eCanons').hidden = true;
$('bSalle').onclick = ouvrirSalle; $('bFermerSalle').onclick = () => $('eSalle').hidden = true;
$('bMenu').onclick = () => { if(phase === 'nuit'){ message('Attendez la fin de la nuit pour revenir au menu.', 'attention'); return; } menu(); };
$('bRetourJeu').onclick = () => { $('eMenu').hidden = true; $('haut').hidden = $('bas').hidden = false; phase = res.fini ? 'fin' : 'jour'; majBarre(); };
$('bAide').onclick = () => { $('eAide').hidden = false; };
$('bFermerAide').onclick = () => { $('eAide').hidden = true; };
document.addEventListener('visibilitychange', () => { if(document.hidden) sauver(); });

/* ---------- La boucle ---------- */
function boucle(now){
  const dt = Math.min(.1, (now - dernier) / 1000); dernier = now;
  if(dom && res && phase !== 'menu'){
    if(phase === 'nuit') avancer(dt);
    else if(aRecalculer){ reg = calculer(); aRecalculer = false; }
    dessinerCarte({ dom, res, reg, nuit:phase === 'nuit', selection, depart, apercu, zones:phase === 'nuit' });
    majHud -= dt; if(majHud <= 0){ majHud = .15; majCompteurs(); document.documentElement.style.setProperty('--h-haut', $('haut').offsetHeight + 'px'); }
    majVues -= dt; if(majVues <= 0){ majVues = .25; majCanons(); majSalle(); if(panneauMaj) panneauMaj(); }
  }
  requestAnimationFrame(boucle);
}

/* ---------- Démarrage ---------- */
tailleCarte();
if(/[?&]test/.test(location.search)){
  const r = testsSimulation();
  document.body.innerHTML = `<pre style="padding:16px;color:${r.ko.length ? '#FF8A96' : '#7FE0A8'};white-space:pre-wrap">${r.ko.length ? 'ERREUR' : 'OK'} · ${r.ok.length} vérifications réussies${r.ko.length ? '\n\nÉchecs :\n' + r.ko.join('\n') : ''}</pre>`;
  console.log(r);
} else {
  menu();
  requestAnimationFrame(boucle);
}
window.Nivo = { get dom(){ return dom; }, get res(){ return res; }, get reg(){ return reg; }, get phase(){ return phase; }, cam, toucher, nouvellePartie, lancerNuit, set vitesse(v){ vitesse = v; }, get tNuit(){ return tNuit; } };

if('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('../../sw.js').catch(() => {}));
