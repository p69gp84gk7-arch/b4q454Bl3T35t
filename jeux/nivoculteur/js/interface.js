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

// Met à jour le contenu d'un élément sans recréer ce qui n'a pas changé : les boutons restent les mêmes,
// un appui en cours n'est donc jamais perdu quand les chiffres se rafraîchissent (nuit en cours).
function mettreAJour(el, html){
  const modele = document.createElement('div');
  modele.innerHTML = html;
  const accorder = (a, n) => {
    if(a.nodeType !== n.nodeType || a.nodeName !== n.nodeName){ a.replaceWith(n.cloneNode(true)); return; }
    if(a.nodeType === 3){ if(a.nodeValue !== n.nodeValue) a.nodeValue = n.nodeValue; return; }
    if(a.nodeType !== 1) return;
    for(const at of [...a.attributes]) if(!n.hasAttribute(at.name)) a.removeAttribute(at.name);
    for(const at of [...n.attributes]) if(a.getAttribute(at.name) !== at.value) a.setAttribute(at.name, at.value);
    enfants(a, n);
  };
  const enfants = (a, n) => {
    const ea = [...a.childNodes], en = [...n.childNodes];
    en.forEach((x, i) => i < ea.length ? accorder(ea[i], x) : a.appendChild(x.cloneNode(true)));
    for(let i = en.length; i < ea.length; i++) ea[i].remove();
  };
  enfants(el, modele);
}

// Panneau du bas (fiche d'un canon, bilan de nuit) : html libre, puis on branche les boutons
function afficherPanneau(html){
  const d = $('devis');
  mettreAJour(d, html);
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

// ---------------------------------------------------------------------------------------
// Poste de travail : écran de supervision (salle de pompage, nuit, alarmes, canons)
// d : données préparées par le jeu ; quand on touche un bouton, agir(action, valeur) est appelé
// ---------------------------------------------------------------------------------------
// Voyants : vert en marche, rouge à l'arrêt, jaune en défaut (comme les points au-dessus des canons)
const LED = { production: '#38D66B', faible: '#38D66B', defaut: '#FFD23A', arret: '#FF3B4A', pret: '#9FB0CF', manque: '#4E586B' };

// Jauge de pression de 0 à 80 bar : rouge = pas de neige ou surpression, orange = production réduite ou haute,
// vert = bonne pression ; le trait blanc marque la pression actuelle. modele = clé du catalogue, ou 'depart'.
function zonesPression(modele){
  const z = CONFIG.pression.zones, max = CONFIG.pression.cadranMax;
  if(modele === 'depart'){
    const [a, b] = CONFIG.pompage.zoneVerte;
    return [[0, a, 'moyen'], [a, b, 'bon'], [b, z.surpression, 'moyen'], [z.surpression, max, 'mauvais']];
  }
  const m = CATALOGUE[modele];
  return [[0, m.pressionMin, 'mauvais'], [m.pressionMin, m.pressionPleine, 'moyen'], [m.pressionPleine, z.correcte, 'bon'], [z.correcte, z.surpression, 'moyen'], [z.surpression, max, 'mauvais']];
}
function jaugePression(bar, modele){
  const max = CONFIG.pression.cadranMax, pc = v => borne(v, 0, max) / max * 100;
  const zones = zonesPression(modele).map(([a, b, c]) => `<span class="${c}" style="left:${pc(a).toFixed(1)}%;width:${(pc(b) - pc(a)).toFixed(1)}%"></span>`).join('');
  return `<span class="jauge" role="img" aria-label="${bar === null ? 'pas de pression' : Math.round(bar) + ' bar'}">${zones}${bar === null ? '' : `<i style="left:${pc(bar).toFixed(1)}%"></i>`}</span>`;
}
function afficherPoste(d, agir){
  const el = $('poste'), haut = el.scrollTop, p = d.pompage;
  const pastille = (texte, cls = '') => `<span class="pastille ${cls}">${echapper(texte)}</span>`;
  const pompes = p.marche.map((m, i) => p.defaut[i] ? `
    <div class="pompe"><span class="led" style="background:${LED.defaut}"></span><b>Pompe ${i + 1}</b>${pastille('DÉFAUT', 'orange')}</div>` : `
    <div class="pompe"><span class="led" style="background:${m ? LED.production : LED.arret}"></span>
      <b>Pompe ${i + 1}</b>${pastille(m ? 'MARCHE' : 'ARRÊT', m ? 'vert' : '')}
      ${p.mode === 'manuel' ? `<button class="bouton petit" type="button" data-action="pompe" data-valeur="${i}">${m ? 'Arrêter' : 'Démarrer'}</button>` : ''}</div>`).join('');
  // Pannes (niveau 4) : ce qui est cassé, et l'équipe à envoyer
  const pannes = d.pannes === null ? '' : `
      <section class="bloc"><h3>Pannes${d.pannes.length ? ` (${d.pannes.length})` : ''}</h3>
        ${d.pannes.length ? d.pannes.map(q => `<div class="panne">
          <span class="led" style="background:${q.reparation ? '#2F6FDE' : LED.defaut}"></span>
          <span class="nom"><b>${echapper(q.nom)}</b><small>${echapper(q.ou)}</small></span>
          ${q.reparation ? pastille(q.reste !== null ? `Équipe sur place · ${q.reste} s` : 'Équipe sur place') : ''}
          <span class="actions">
            ${q.reparation ? '' : `<button class="bouton petit" type="button" data-action="reparer" data-valeur="${q.id}">${q.rearmer ? 'Réarmer' : `Réparer · ${euros(q.cout)}`}</button>`}
            <button class="bouton petit" type="button" data-action="voirPanne" data-valeur="${q.id}">Voir</button>
          </span></div>`).join('') : '<p class="vide">Aucune panne. Elles peuvent arriver à tout moment la nuit.</p>'}
        <p class="aide">La nuit, l'équipe met un peu de temps (une fuite est isolée pendant les travaux : plus d'eau en aval). Le jour, la réparation est immédiate.</p>
      </section>`;
  const canons = d.canons.length ? d.canons.map(c => `
    <div class="canon">
      <div class="entete"><span class="led" style="background:${LED[c.led]}"></span>
        <span class="nom"><b>${echapper(c.nom)}</b><small>${echapper(c.modele)}</small></span>${pastille(c.etat)}</div>
      <div class="mesure">${jaugePression(c.pression, c.cle)}<b>${c.pression === null ? '—' : Math.round(c.pression) + ' bar'}</b></div>
      <div class="pied">
        ${c.pressionAir !== null ? pastille(`air ${nombreFr(c.pressionAir, 1)} bar`, c.pressionAir < CONFIG.air.pressionMin ? 'orange' : '') : ''}
        ${c.production !== null ? pastille(`${nombreFr(c.production)} m³/h`) : ''}
        ${c.part !== null ? pastille(`${Math.round(c.part * 100)} % piste`) : ''}
        <span class="actions">
          ${c.pilotable ? `<button class="bouton petit" type="button" data-action="canon" data-valeur="${c.id}">${c.arrete ? 'Mettre en marche' : 'Arrêter'}</button>` : ''}
          <button class="bouton petit" type="button" data-action="voir" data-valeur="${c.id}">Voir</button>
        </span></div></div>`).join('') : '<p class="vide">Aucun regard posé pour l\'instant.</p>';
  // Résumé de la pression sur le réseau : combien de canons dans chaque zone
  const compte = { bon: 0, moyen: 0, mauvais: 0 };
  for(const c of d.canons) if(c.pression !== null){
    const z = zonesPression(c.cle).find(([a, b]) => c.pression >= a && c.pression < b) || [0, 0, 'mauvais'];
    compte[z[2]]++;
  }
  const resume = d.canons.length ? `<div class="ligne resume">${pastille(`${compte.bon} bonne pression`, 'vert')}${pastille(`${compte.moyen} réduite ou haute`, 'orange')}${pastille(`${compte.mauvais} hors limites`, 'rouge')}</div>` : '';
  const a = d.air, ca = CONFIG.air;
  const air = a ? `
      <section class="bloc"><h3>Air comprimé</h3>
        <div class="pompe"><span class="led" style="background:${a.marche ? LED.production : LED.arret}"></span>
          <b>Compresseur</b>${pastille(a.marche ? 'MARCHE' : 'ARRÊT', a.marche ? 'vert' : '')}
          ${a.pilotable ? `<button class="bouton petit" type="button" data-action="compresseur">${a.commande ? 'Arrêter' : 'Démarrer'}</button>` : ''}</div>
        <div class="ligne">${pastille(`Réservoir : ${nombreFr(a.pression, 1)} bar`, a.pression >= ca.pressionPleine ? 'vert' : a.pression >= ca.pressionMin ? 'orange' : '')}${pastille(`${nombreFr(a.demande)} / ${nombreFr(a.capacite)} Nm³/h`, a.demande > a.capacite ? 'orange' : '')}</div>
        <p class="aide">${a.pilotable ? `En manuel, démarrez le compresseur avant d'ouvrir les perches : le réservoir met un peu de temps à monter à ${ca.pressionNominale} bar.`
          : `En automatique, le compresseur démarre dès qu'une perche attend de l'air.`} Les perches produisent bien au-dessus de ${ca.pressionPleine} bar, plus du tout en dessous de ${ca.pressionMin} bar.</p>
      </section>` : '';
  mettreAJour(el, `
    <div class="tete"><h2>Poste de travail · supervision neige</h2><button class="fermer" type="button" data-action="fermer" aria-label="Fermer">×</button></div>
    <div class="disposition">
    <div class="grille">
      <section class="bloc"><h3>Salle de pompage</h3>
        <div class="ligne">Mode
          ${p.modeImpose ? pastille('Manuel (imposé dans ce niveau)') : `<span class="seg"><button type="button" data-action="mode" data-valeur="auto" class="${p.mode === 'auto' ? 'actif' : ''}">Auto</button><button type="button" data-action="mode" data-valeur="manuel" class="${p.mode === 'manuel' ? 'actif' : ''}">Manuel</button></span>`}</div>
        ${pompes}
        <div class="ligne">Vanne principale
          <span class="reglage"><button class="bouton petit" type="button" data-action="vanne" data-valeur="-0.1">−10 %</button><b class="val">${Math.round(p.ouverture * 100)} %</b><button class="bouton petit" type="button" data-action="vanne" data-valeur="0.1">+10 %</button></span></div>
        <input class="curseur" type="range" min="0" max="100" step="1" value="${Math.round(p.ouverture * 100)}" data-curseur="vanne" aria-label="Ouverture de la vanne principale">
        <div class="ligne">${pastille(`Départ : ${Math.round(p.pression)} bar`, p.pression <= 0 ? '' : p.dansLeVert ? 'vert' : 'orange')}${pastille(`${nombreFr(p.debit)} / ${nombreFr(p.capacite)} m³/h`)}</div>
        <div class="mesure">${jaugePression(p.pression > 0 ? p.pression : null, 'depart')}</div>
        <div class="graduations"><span>0</span><span>20</span><span>40</span><span>60</span><span>80 bar</span></div>
        <p class="aide">${p.mode === 'auto' ? 'En automatique, le bon nombre de pompes démarre selon le débit demandé et la vanne se règle seule.'
          : `En manuel, c'est vous qui démarrez les pompes (${nombreFr(CONFIG.pompage.debitNominal)} m³/h chacune) et qui manœuvrez la vanne : gardez le départ entre ${CONFIG.pompage.zoneVerte[0]} et ${CONFIG.pompage.zoneVerte[1]} bar. Démarrez vanne fermée, ouvrez doucement.`}</p>
      </section>${air}
      <section class="bloc"><h3>${d.nuit ? `Nuit ${d.nuit.numero} en cours` : `Prochaine nuit : n° ${d.numero}`}</h3>
        <div class="ligne">${d.nuit ? pastille(`${d.nuit.restant} s restantes`) : pastille('Jour : construction')}${pastille(`Vent ${d.vent.force} km/h`)}</div>
        ${d.nuit ? `<div class="ligne">${pastille(`${nombreFr(d.nuit.neige)} m³ sur la piste`)}${pastille(`+${euros(d.nuit.argent)}`, 'vert')}</div>` : ''}
        ${d.electricite ? `<div class="ligne">${pastille(`Électricité ${nombreFr(d.electricite.kwh)} kWh`)}${pastille(`−${euros(d.electricite.euros)}`, 'orange')}</div>` : ''}
        <div class="ligne">${pastille(`Retenue ${d.retenue === null ? '—' : Math.round(d.retenue * 100) + ' %'}`)}${pastille(`Objectif ${nombreFr(d.total)} / ${nombreFr(d.objectif)} m³`)}</div>
        <div class="ligne">${d.nuit ? `<button class="bouton petit" type="button" data-action="accelerer">${d.accelere ? 'Vitesse normale' : `Accélérer ×${CONFIG.nuit.accelere}`}</button>`
          : '<button class="bouton vert" type="button" data-action="lancerNuit">Lancer la nuit</button>'}</div>
      </section>
      ${pannes}
      <section class="bloc"><h3>Alarmes${d.coupsMax !== null ? ` · coups de bélier ${d.coups} / ${d.coupsMax}` : ''}</h3>
        ${d.alarmes.length ? d.alarmes.map(a => `<p class="alarme ${a.niveau}">${echapper(a.texte)}</p>`).join('') : '<p class="vide">Aucune alarme.</p>'}
      </section>
    </div>
      <section class="bloc colonne"><h3>Canons (${d.canons.length})</h3>${resume}<div class="canons">${canons}</div></section>
    </div>`);
  el.hidden = false;
  el.scrollTop = haut;
  el.onclick = e => {
    const b = e.target.closest('[data-action]');
    if(b) agir(b.dataset.action, b.dataset.valeur);
  };
  el.oninput = e => { if(e.target.dataset.curseur) agir('vanne-curseur', e.target.value / 100); };
}

// ---------------------------------------------------------------------------------------
// Sauvegarde dans le navigateur (toujours protégée : navigation privée, stockage plein…)
// ---------------------------------------------------------------------------------------
function lireSauvegarde(cle){ try{ return JSON.parse(localStorage.getItem(cle)); }catch(e){ return null; } }
function ecrireSauvegarde(cle, valeur){ try{ localStorage.setItem(cle, JSON.stringify(valeur)); }catch(e){} }
function effacerSauvegarde(cle){ try{ localStorage.removeItem(cle); }catch(e){} }

// ---------------------------------------------------------------------------------------
// Menu : choix du niveau
// cartes : [{ id, numero, nom, resume, etat, ouvert, partie, enCours }] ; agir(action, id)
// ---------------------------------------------------------------------------------------
function afficherMenu(cartes, aVenir, agir, peutRevenir){
  const el = $('menu');
  el.innerHTML = `<div class="tete"><h2>Nivoculteur</h2>${peutRevenir ? '<button class="fermer" type="button" data-action="fermer" aria-label="Revenir au jeu">×</button>' : ''}</div>
    <p class="intro">Construisez et faites tourner le réseau de neige de culture de la station. Choisissez un niveau :</p>
    <div class="niveaux">${cartes.map(c => `
      <article class="niveau${c.ouvert ? '' : ' ferme'}">
        <div class="num">${c.numero}</div>
        <div class="corps"><h3>${echapper(c.nom)}</h3><p>${echapper(c.resume)}</p><p class="etat">${echapper(c.etat)}</p>
          <div class="actions">${c.ouvert ? `<button class="bouton vert" type="button" data-action="jouer" data-valeur="${c.id}">${c.partie ? 'Reprendre' : 'Jouer'}</button>
            ${c.partie ? `<button class="bouton" type="button" data-action="recommencer" data-valeur="${c.id}">Recommencer</button>` : ''}` : ''}</div></div>
      </article>`).join('')}
      ${aVenir.map(a => `<article class="niveau ferme"><div class="num">${a.numero}</div><div class="corps"><h3>${echapper(a.nom)}</h3><p class="etat">Bientôt</p></div></article>`).join('')}
    </div>
    <div class="actions bas-menu"><a class="bouton" href="index.html?modeles">Modèles 3D</a><a class="bouton" href="index.html?test">Vérifications</a></div>`;
  el.hidden = false;
  el.onclick = e => {
    const b = e.target.closest('[data-action]');
    if(b) agir(b.dataset.action, b.dataset.valeur);
  };
}
function fermerMenu(){ $('menu').hidden = true; }
function fermerPoste(){ $('poste').hidden = true; }

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
