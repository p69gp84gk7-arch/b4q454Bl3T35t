'use strict';
/* Nivoculteur · interface — messages, panneaux, boutons
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   6. INTERFACE — messages, barre du bas, panneaux
   ===================================================================================== */
const $ = id => document.getElementById(id);
const nombreFr = (n, dec = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const euros = n => `${nombreFr(n)} €`;
const echapper = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// type : 'info' (bleu), 'ok' (vert), 'attention' (orange), 'alarme' (rouge)
function message(texte, type = 'info', duree = 4500){
  const zone = $('messages');
  const el = document.createElement('div');
  el.className = `message ${type}`;
  el.textContent = texte;
  zone.appendChild(el);
  while(zone.children.length > 3) zone.firstChild.remove();
  setTimeout(() => { el.classList.add('sortie'); setTimeout(() => el.remove(), 450); }, duree);
}

function majHud({ budget = null, nuit = null, neige = null, objectif = null, vent = null, retenue = null } = {}){
  // Sur un petit écran, le budget est arrondi en milliers d'euros (k€) pour tenir dans sa case
  const etroit = window.innerWidth < 480;
  $('hudBudget').textContent = budget === null ? '—' : etroit && Math.abs(budget) >= 10000 ? `${nombreFr(Math.round(budget / 1000))} k€` : euros(budget);
  $('hudNuit').textContent = nuit === null ? '—' : nuit;
  $('hudNeige').innerHTML = neige === null ? '—' : `${nombreFr(neige)}<span class="obj">${objectif ? ' / ' + nombreFr(objectif) : ''}</span> m³`;
  if(vent) $('hudVentForce').textContent = vent.force ? `${vent.force} km/h` : 'calme';
  $('hudRetenue').textContent = retenue === null ? '—' : `${Math.round(retenue * 100)} %`;
}
// Flèche du vent : angle à l'écran (degrés, 0 = vers le haut de l'écran)
function orienterFlecheVent(angle){ $('flecheVent').style.transform = `rotate(${angle}deg)`; }

// Panneau du bas (fiche d'un canon, bilan de nuit) : html libre, puis on branche les boutons
function afficherPanneau(html){
  const d = $('devis');
  d.innerHTML = html;
  d.hidden = false;
  return d;
}

// Choix de l'enneigeur posé avec un nouveau regard (les modèles pas encore disponibles sont grisés)
function remplirChoixEnneigeur(niveau, res, choix, changer){
  const sel = $('choixModele'), sup = $('choixSupport');
  sel.innerHTML = Object.entries(CATALOGUE).map(([k, m]) => {
    const d = disponible(niveau, res, k);
    return `<option value="${k}"${d.ok ? '' : ' disabled'}${k === choix.modele ? ' selected' : ''}>${echapper(m.nom)}${d.ok ? ` · ${euros(m.prix)}` : ` · disponible ${echapper(d.raison)}`}</option>`;
  }).join('');
  const ventilo = CATALOGUE[choix.modele].type === 'ventilateur';
  sup.innerHTML = Object.entries(SUPPORTS).map(([k, s]) => `<option value="${k}"${k === choix.support ? ' selected' : ''}>${echapper(s.nom)}${s.prix ? ` · +${euros(s.prix)}` : ''}</option>`).join('');
  sup.parentElement.hidden = !ventilo;
  $('choixPrix').textContent = `Regard + enneigeur : ${euros(CONFIG.couts.regard + prixEnneigeur(choix.modele, choix.support))}`;
  sel.onchange = () => changer({ modele: sel.value, support: choix.support || 'trepied' });
  sup.onchange = () => changer({ modele: choix.modele, support: sup.value });
}

// Consigne de l'outil choisi (null = la cacher)
function afficherConsigne(texte){
  $('consigne').hidden = !texte;
  $('consigne').textContent = texte || '';
}
// Devis d'une construction : titre, lignes de détail, total, et boutons Valider / Annuler
function afficherDevis({ titre, lignes, total, budgetApres, possible }, valider, annuler){
  const d = $('devis');
  d.innerHTML = `<div class="tete"><span>${echapper(titre)}</span><span>${euros(total)}</span></div>
    <ul>${lignes.map(l => `<li>${echapper(l)}</li>`).join('')}<li>Budget après : ${euros(budgetApres)}</li></ul>
    ${possible ? '' : '<p class="refus">Budget insuffisant.</p>'}
    <div class="actions"><button class="bouton" type="button" id="devisOk"${possible ? '' : ' disabled'}>Valider</button>
    <button class="bouton" type="button" id="devisNon">Annuler</button></div>`;
  d.hidden = false;
  $('devisOk').onclick = valider;
  $('devisNon').onclick = annuler;
}
function fermerPanneauDevis(){ $('devis').hidden = true; $('devis').innerHTML = ''; }

function afficherTests(resultats){
  const ok = resultats.filter(r => r.ok).length, p = $('panneauTests');
  p.innerHTML = `<h2>Mode test · simulation</h2>
    <p class="resume" style="color:${ok === resultats.length ? '#6BD68F' : '#FF6B7A'}">${ok} / ${resultats.length} vérifications OK</p>
    <ul>${resultats.map(r => `<li><span class="etat ${r.ok ? 'ok' : 'ko'}">${r.ok ? 'OK' : 'ERREUR'}</span>
      <span>${echapper(r.nom)}${r.detail ? `<small>${echapper(r.detail)}</small>` : ''}</span></li>`).join('')}</ul>
    <button class="bouton" type="button" id="fermerTests">Fermer</button>`;
  p.hidden = false;
  $('fermerTests').onclick = () => { p.hidden = true; };
  console.table(resultats);
}

function afficherErreur(html){
  const p = $('panneauErreur');
  p.innerHTML = `<h2>Le jeu ne peut pas démarrer</h2><p>${html}</p>`;
  p.hidden = false;
}

// Boutons de la vitrine : un par modèle, et les options du modèle affiché
function afficherVitrine(modeles, actuel, choisir, options){
  $('vitrineModeles').innerHTML = '';
  modeles.forEach((m, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bouton' + (i === actuel ? ' actif' : ''); b.textContent = m.nom;
    b.onclick = () => choisir(i);
    $('vitrineModeles').appendChild(b);
  });
  $('vitrineOptions').innerHTML = '';
  for(const o of options){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bouton'; b.textContent = o.libelle();
    b.onclick = () => { o.action(); b.textContent = o.libelle(); };
    $('vitrineOptions').appendChild(b);
  }
}
