/* Altitude Arcade — Dichotomie (recherche de panne) : écrans, carte, gestes du technicien, bilan et records.
   La simulation est dans simulation.js (window.PanneSim), le réseau dans reseau.js. */
(() => {
  'use strict';
  const S = window.PanneSim, $ = id => document.getElementById(id);
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
  const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  const pl = (n, m, p) => `${fmt(n)} ${n > 1 ? (p || m + 's') : m}`;
  const DEBUT = 21 * 60;                                  // la panne arrive à 21 h
  const heure = t => { const m = DEBUT + Math.round(t); return `${Math.floor(m / 60) % 24} h ${String(m % 60).padStart(2, '0')}`; };
  const VITESSE = 300;                                    // m par minute (motoneige, avec les détours)
  const DUREE = { mesure:3, inter:1, liaison:2, troncon:2, voir:2, transfo:2, carte:15, court:20, cable:30, attendre:5 };
  const DEBIT = 20;                                       // m³/h de neige par canon arrêté
  const NB = S.VRAIS.length;
  const nomC = id => { const c = S.PAR_ID[id]; return c ? (c.zone === 'SDM' ? c.nom : c.nom) : id; };
  const zoneC = id => { const c = S.PAR_ID[id]; return c ? c.zone.charAt(0).toUpperCase() + c.zone.slice(1) : ''; };
  const nomCanon = id => S.PAR_ID[id] && S.PAR_ID[id].zone === 'SDM' ? S.PAR_ID[id].nom : `canon ${nomC(id)} (${zoneC(id)})`;
  const MODELES = { revo:'Revo', borax:'Borax', borax_01:'Borax', v3:'V3', t40:'T40', t60:'T60', tf10:'TF10', tr8:'TR8', safyr:'Safyr', rubis:'Rubis' };
  const posDe = id => { if(id.startsWith('src/')){ const d = S.D_PAR_ID[id.slice(4)]; return { x:d.x, y:d.y }; } return S.PAR_ID[id]; };

  /* ---------- les records ---------- */
  let REC = Object.assign({ parties:0, reussies:0, niveaux:{} }, lire('panne-records', {}));
  const etoilesTotal = () => Object.values(REC.niveaux).reduce((s, n) => s + (n.etoiles || 0), 0);

  /* ---------- écrans ---------- */
  const ecran = id => { ['eAccueil', 'eJeu', 'eFin', 'eAide'].forEach(e => $(e).hidden = e !== id); if(id === 'eJeu') requestAnimationFrame(() => { taille(); dessiner(); }); window.scrollTo(0, 0); };
  function accueil(){
    ecran('eAccueil');
    const n = REC.niveaux;
    $('cRecords').innerHTML = `<h3>Tes records</h3><div class="stats"><div><b>${etoilesTotal()}</b><small>étoiles / ${S.NIVEAUX.length * 3}</small></div><div><b>${REC.reussies}</b><small>pannes réparées</small></div><div><b>${REC.parties}</b><small>nuits</small></div><div><b>${REC.parties ? Math.round(100 * REC.reussies / REC.parties) + ' %' : '—'}</b><small>de réussite</small></div></div>`;
    $('cNiveaux').innerHTML = S.NIVEAUX.map((v, i) => {
      const r = n[v.id] || {}, ico = { dialogue:'✂️', aval:'📡', ligne:'📡', elec:'🔌', court:'⚡', intermittent:'〰️', double:'✌️', mystere:'❓' }[v.id];
      return `<button class="niv" data-n="${v.id}"><b>${ico} ${i + 1}. ${esc(v.nom)}</b><small>${esc(v.texte)}</small>
        <span class="et">${'★'.repeat(r.etoiles || 0)}${'☆'.repeat(3 - (r.etoiles || 0))}</span>
        <span class="rec">${r.reussies ? `Meilleur : ${pl(r.gestes, 'geste')} · ${r.minutes} min · ${fmt(r.neige)} m³ perdus` : `Nuit de ${Math.floor(v.minutes / 60)} h${v.minutes % 60 ? ' ' + (v.minutes % 60) : ''}`}</span></button>`;
    }).join('');
  }
  $('cNiveaux').onclick = e => { const b = e.target.closest('[data-n]'); if(b) demarrer(b.dataset.n); };
  $('bAide').onclick = () => ecran('eAide');
  $('bAideRetour').onclick = () => accueil();

  /* ---------- la partie ---------- */
  let P = null;
  function demarrer(nivId){
    const p = S.nouvellePartie(nivId), sdm = S.PAR_ID['SDM/SDM1'];
    P = Object.assign(p, { tech:{ x:sdm.x, y:sdm.y }, gestes:0, faux:0, mesures:0, neige:0, vus:{}, diag:{}, journal:[], fini:false, sel:null, vue:'dia', revele:false });
    const C = S.calculer(P.E);
    journal(`🚨 <b>Alarme supervision</b> : ${pl(NB - C.parlent.size, 'canon')} ne communiquent plus. Le technicien part de la salle des machines 1.`);
    cadre = false; ecran('eJeu'); majVues(); panneau(); etat(); requestAnimationFrame(ajuster);
  }
  function journal(t, cls){ P.journal.unshift({ t:P.E.t, h:`<b>${heure(P.E.t)}</b> · ${t}`, cls }); if(P.journal.length > 80) P.journal.pop(); }
  let tToast = 0;
  function toast(t){ const e = $('toast'); e.innerHTML = t; e.hidden = false; clearTimeout(tToast); tToast = setTimeout(() => e.hidden = true, 2600); }
  const parlent = () => S.calculer(P.E).parlent;
  // le temps passe : la neige perdue par les canons arrêtés
  function avancer(min){
    for(let i = 0; i < min; i++){ P.neige += (NB - parlent().size) * DEBIT / 60; P.E.t++; if(P.E.t >= P.niveau.minutes) return false; }
    return true;
  }
  // Un geste : le trajet jusqu'au lieu, puis le geste lui-même
  function agir(ou, min, compte, faire){
    if(!P || P.fini || P.revele) return;
    const d = Math.hypot(ou.x - P.tech.x, ou.y - P.tech.y) * 1.25, trajet = d < 8 ? 0 : Math.max(1, Math.round(d / VITESSE));
    const avant = parlent().size;
    if(!avancer(trajet + min)) return finir(false);
    P.tech = { x:ou.x, y:ou.y };
    const r = faire() || {};
    const disj = S.stabiliser(P.E);
    if(compte) P.gestes++;
    const apres = parlent().size, diff = apres - avant;
    const suite = r.sansSupervision ? '' : ` → <b>${apres}</b> / ${NB}${diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}`;
    journal(`${r.texte}${trajet ? ` <span>(trajet ${trajet} min)</span>` : ''}${suite}`, r.cls);
    disj.forEach(dp => { P.vus[dp] = { t:P.E.t, etat:'disjoncté' }; journal(`💥 <b>${esc(S.D_PAR_ID[dp].nom)} a disjoncté !</b>`, 'mal'); });
    toast((disj.length ? `💥 ${esc(S.D_PAR_ID[disj[0]].nom)} a disjoncté ! ` : '') + (r.toast || r.texte) + (r.sansSupervision ? '' : ` · ${apres} / ${NB}`));
    if(S.toutVa(P.E)) return finir(true);
    etat(); panneau(); dessiner();
  }
  const panne = (type, cle) => P.E.pannes.find(p => !p.repare && p.type === type && (p.canon === cle || p.k === cle));

  /* ---------- les gestes ---------- */
  const G = {
    mesurer:id => agir(S.PAR_ID[id], DUREE.mesure, true, () => {
      P.mesures++; const d = S.diagnostic(P.E, id); P.diag[id] = Object.assign({ t:P.E.t }, d);
      return { texte:`🔍 Mesure au ${nomCanon(id)} : tension <b>${d.tension}</b>, ${d.dialogue}`, sansSupervision:true, toast:`Tension ${d.tension} · ${d.dialogue}` };
    }),
    inter:id => { const ouvrir = !P.E.off.has(id); agir(S.PAR_ID[id], DUREE.inter, ouvrir, () => { if(ouvrir) P.E.off.add(id); else P.E.off.delete(id); delete P.diag[id]; return { texte:`${ouvrir ? '⭘ Interrupteur ouvert' : '⏺ Interrupteur refermé'} au ${nomCanon(id)}` }; }); },
    liaison:(k, ou) => { const deb = !P.E.debr.has(k), l = S.L_PAR_K[k]; agir(ou ? posDe(ou) : proche(l.a, l.b), DUREE.liaison, deb, () => { if(deb) P.E.debr.add(k); else P.E.debr.delete(k); return { texte:`${deb ? '✂ Liaison débranchée' : '🔗 Liaison rebranchée'} ${nomC(l.a)} – ${nomC(l.b)}` }; }); },
    troncon:(k, ou) => { const ouv = !P.E.ouv.has(k), c = S.C_PAR_K[k]; agir(ou ? posDe(ou) : proche(c.a, c.b), DUREE.troncon, ouv, () => { if(ouv) P.E.ouv.add(k); else P.E.ouv.delete(k); return { texte:`${ouv ? '⭘ Tronçon électrique ouvert' : '⏺ Tronçon électrique refermé'} ${nomLien(c)}` }; }); },
    voir:d => agir(S.D_PAR_ID[d], DUREE.voir, true, () => { const e = etatTransfo(d); P.vus[d] = { t:P.E.t, etat:e }; return { texte:`👀 ${esc(S.D_PAR_ID[d].nom)} : <b>${e}</b>`, sansSupervision:true, toast:`${esc(S.D_PAR_ID[d].nom)} : ${e}` }; }),
    rearmer:d => agir(S.D_PAR_ID[d], DUREE.transfo, true, () => {
      const avant = P.E.disj.has(d); P.E.disj.delete(d); P.E.depOuv.delete(d);
      const de = S.stabiliser(P.E); const saute = P.E.disj.has(d);
      P.vus[d] = { t:P.E.t, etat:saute ? 'disjoncté' : 'en service' };
      if(saute) return { texte:`💥 ${esc(S.D_PAR_ID[d].nom)} réarmé… <b>il redisjoncte aussitôt !</b>`, cls:'mal' };
      return { texte:avant ? `⚡ ${esc(S.D_PAR_ID[d].nom)} réarmé : <b>il tient</b>` : `⚡ ${esc(S.D_PAR_ID[d].nom)} remis en service`, cls:avant ? 'bon' : '' };
    }),
    couper:d => agir(S.D_PAR_ID[d], DUREE.transfo, true, () => { P.E.depOuv.add(d); P.vus[d] = { t:P.E.t, etat:'coupé' }; return { texte:`⭘ ${esc(S.D_PAR_ID[d].nom)} coupé` }; }),
    carte:id => agir(S.PAR_ID[id], DUREE.carte, true, () => {
      const p = panne('contaminant', id); if(p){ p.repare = true; p.trouve = P.E.t; return { texte:`✅ Carte de dialogue changée au ${nomCanon(id)} : <b>c'était bien elle !</b>`, cls:'bon' }; }
      P.faux++; return { texte:`❌ Carte changée au ${nomCanon(id)}… ce n'était pas elle.`, cls:'mal' };
    }),
    court:id => agir(S.PAR_ID[id], DUREE.court, true, () => {
      const p = panne('court', id); if(p){ p.repare = true; p.trouve = P.E.t; return { texte:`✅ Court-circuit réparé au ${nomCanon(id)} (réarmez le transfo)`, cls:'bon' }; }
      P.faux++; return { texte:`❌ Pas de court-circuit au ${nomCanon(id)}.`, cls:'mal' };
    }),
    repLiaison:(k, ou) => { const l = S.L_PAR_K[k]; agir(ou ? posDe(ou) : proche(l.a, l.b), DUREE.cable, true, () => {
      const p = panne('cableDia', k); if(p){ p.repare = true; p.trouve = P.E.t; return { texte:`✅ Liaison ${nomC(l.a)} – ${nomC(l.b)} réparée : <b>elle était coupée !</b>`, cls:'bon' }; }
      P.faux++; return { texte:`❌ Liaison ${nomC(l.a)} – ${nomC(l.b)} refaite… elle n'était pas coupée.`, cls:'mal' }; }); },
    repCable:(k, ou) => { const c = S.C_PAR_K[k]; agir(ou ? posDe(ou) : proche(c.a, c.b), DUREE.cable, true, () => {
      const p = panne('cableElec', k); if(p){ p.repare = true; p.trouve = P.E.t; return { texte:`✅ Câble électrique ${nomLien(c)} réparé : <b>il était coupé !</b>`, cls:'bon' }; }
      P.faux++; return { texte:`❌ Câble ${nomLien(c)} refait… il n'était pas coupé.`, cls:'mal' }; }); },
    attendre:() => agir(P.tech, DUREE.attendre, false, () => ({ texte:'⏳ 5 minutes à observer la supervision' })),
    remettre:() => {
      const n = P.E.off.size + P.E.debr.size + P.E.ouv.size + P.E.depOuv.size + P.E.disj.size;
      if(!n) return;
      agir(P.tech, Math.min(30, 2 * n), false, () => {
        P.E.off.clear(); P.E.debr.clear(); P.E.ouv.clear(); P.E.depOuv.clear(); [...P.E.disj].forEach(d => P.E.disj.delete(d));
        Object.keys(P.vus).forEach(d => P.vus[d] = { t:P.E.t, etat:'réarmé' }); P.diag = {};
        return { texte:`↺ Tout remis en service (${pl(n, 'élément')} refermé${n > 1 ? 's' : ''}, transfos réarmés)` };
      });
    },
  };
  const proche = (...ids) => ids.filter(i => !i.startsWith('src/')).map(posDe).sort((p, q) => Math.hypot(p.x - P.tech.x, p.y - P.tech.y) - Math.hypot(q.x - P.tech.x, q.y - P.tech.y))[0];
  const etatTransfo = d => P.E.depOuv.has(d) ? 'coupé' : P.E.disj.has(d) ? 'disjoncté' : 'en service';
  const nomLien = c => `${c.a.startsWith('src/') ? S.D_PAR_ID[c.a.slice(4)].nom : nomC(c.a)} – ${c.b.startsWith('src/') ? S.D_PAR_ID[c.b.slice(4)].nom : nomC(c.b)}`;

  /* ---------- la fin ---------- */
  function finir(ok){
    P.fini = true; P.reussi = ok;
    const score = P.gestes + 3 * P.faux, opt = P.E.optimum;
    P.etoiles = !ok ? 0 : score <= opt + 2 ? 3 : score <= 2 * opt + 3 ? 2 : 1;
    REC.parties++; if(ok) REC.reussies++;
    const r = REC.niveaux[P.niveau.id] = REC.niveaux[P.niveau.id] || { etoiles:0, fois:0, reussies:0 };
    r.fois++;
    if(ok){
      r.reussies++; r.etoiles = Math.max(r.etoiles || 0, P.etoiles);
      if(r.gestes == null || P.gestes < r.gestes) r.gestes = P.gestes;
      if(r.minutes == null || P.E.t < r.minutes) r.minutes = P.E.t;
      if(r.neige == null || P.neige < r.neige) r.neige = Math.round(P.neige);
    }
    REC.dernier = { nom:P.niveau.nom, etoiles:P.etoiles, reussi:ok, gestes:P.gestes };
    ecrire('panne-records', REC);
    bilan();
  }
  function decrire(p){
    const C0 = (() => { const E = S.nouvelEtat(); E.pannes = [Object.assign({}, p, { repare:false, intermittent:false })]; S.stabiliser(E); return S.calculer(E); })();
    const ok = p.repare ? ` <b class="ok">· réparée à ${heure(p.trouve)}</b>` : ' <b class="ko">· pas trouvée</b>';
    if(p.type === 'contaminant'){
      if(p.portee === 'ligne'){ const lignes = [...new Set((S.LIAISONS_DE[p.canon] || []).map(l => l.ligne).filter(Boolean))].join(', ');
        return `📡 <b>${nomCanon(p.canon)}</b> : carte de dialogue défectueuse. Elle brouillait toute sa ligne${lignes ? ` (${esc(lignes)})` : ''}, ${pl(C0.brouille.size, 'canon')}${p.intermittent ? ', <b>par intermittence</b>' : ''}.${ok}`; }
      return `📡 <b>${nomCanon(p.canon)}</b> : carte de dialogue défectueuse. Il communiquait, mais brouillait les ${pl(C0.brouille.size, 'canon')} d'après lui.${ok}`;
    }
    if(p.type === 'cableDia'){ const l = S.L_PAR_K[p.k]; return `✂️ <b>Liaison de dialogue ${nomC(l.a)} – ${nomC(l.b)}</b> (${zoneC(l.a)}) coupée.${ok}`; }
    if(p.type === 'cableElec'){ const c = S.C_PAR_K[p.k], n = S.VRAIS.filter(v => !C0.alim(v.id)).length; return `🔌 <b>Câble électrique ${nomLien(c)}</b> coupé : ${pl(n, 'canon')} sans courant.${ok}`; }
    if(p.type === 'court') return `⚡ <b>${nomCanon(p.canon)}</b> en court-circuit : ${esc(S.D_PAR_ID[S.ORIGINE[p.canon]].nom)} disjonctait.${ok}`;
    return '';
  }
  function bilan(){
    ecran('eFin');
    $('fTitre').textContent = P.reussi ? '✅ Panne réparée, tout communique !' : '🌅 La nuit est finie…';
    $('fEtoiles').textContent = '★'.repeat(P.etoiles) + '☆'.repeat(3 - P.etoiles);
    $('fTexte').innerHTML = (P.reussi ? '' : 'Le jour se lève avant la fin du dépannage. ') +
      `Une bonne dichotomie : environ <b>${pl(P.E.optimum, 'geste')}</b>. Vous : <b>${pl(P.gestes, 'geste')}</b>${P.faux ? `, dont ${pl(P.faux, 'mauvaise réparation', 'mauvaises réparations')} (comptée${P.faux > 1 ? 's' : ''} triple${P.faux > 1 ? 's' : ''})` : ''}.`;
    $('fStats').innerHTML = `<div><b>${heure(P.E.t)}</b><small>fin (${P.E.t} min)</small></div><div><b>${P.gestes}</b><small>gestes</small></div><div><b>${P.mesures}</b><small>mesures</small></div><div><b>${fmt(P.neige)}</b><small>m³ de neige perdus</small></div>`;
    $('fPanne').innerHTML = P.E.pannes.map(p => `<div>${decrire(p)}</div>`).join('');
  }
  $('bVoir').onclick = () => { P.revele = true; P.vue = P.E.pannes.some(p => p.type === 'cableElec' || p.type === 'court') ? 'elec' : 'dia'; majVues(); ecran('eJeu'); panneau(); etat(); };
  $('bRejouer').onclick = () => demarrer(P.niveau.id);
  $('bMenu').onclick = () => accueil();
  $('bQuitter').onclick = () => {
    if(P.revele || P.fini){ if(P.fini) bilan(); else accueil(); return; }
    if(confirm('Arrêter le dépannage ? La nuit comptera comme perdue.')) finir(false);
  };

  /* ---------- l'état et le panneau ---------- */
  function etat(){
    const n = parlent().size;
    $('jHeure').textContent = `🕘 ${heure(P.E.t)}`;
    $('jGestes').textContent = pl(P.gestes, 'geste');
    $('jNeige').textContent = `❄ ${fmt(P.neige)} m³ perdus`;
    $('jLampe').classList.toggle('ko', n < NB);
    $('jCompte').textContent = `${n} / ${NB} canons communiquent`;
    $('jSous').textContent = P.revele ? 'Les pannes sont entourées en jaune.' : n < NB ? `${pl(NB - n, 'canon')} hors communication · jour à ${heure(P.niveau.minutes)}` : 'Tout communique : vérifiez que tout est réparé.';
  }
  function bouton(txt, min, fn, cls){ return `<button class="btn ${cls || ''}" data-f="${fn}">${txt}${min ? `<span class="min">${min} min</span>` : ''}</button>`; }
  function panneau(){
    const el = $('panneau'), s = P.sel;
    let h = '';
    if(P.revele){
      h = `<p class="aideJ">Les pannes de cette nuit sont entourées en <b style="color:var(--volt)">jaune</b>.</p><div class="ligneA"><button class="btn gros" data-f="bilan">Bilan ›</button></div>`;
      el.innerHTML = h; brancher(); return;
    }
    if(!s){
      const ouverts = P.E.off.size + P.E.debr.size + P.E.ouv.size + P.E.depOuv.size + P.E.disj.size;
      h = `<p class="aideJ">Touchez un <b>canon</b>, une <b>liaison</b>${P.vue === 'elec' ? ', un <b>câble électrique</b>' : ''} ou un <b>transfo ⚡</b> : le technicien 🛷 y va et vous choisissez le geste. Passez en vue <b>⚡ Électricité</b> pour les câbles et les transfos.</p>`;
      h += `<div class="ligneA">${bouton('⏳ Attendre', DUREE.attendre, 'attendre')}${ouverts ? bouton(`↺ Tout remettre (${ouverts})`, Math.min(30, 2 * ouverts), 'remettre', 'act') : ''}</div>`;
      h += `<div class="sect">Journal</div><div class="journal">${P.journal.map(j => `<div class="${j.cls || ''}">${j.h}</div>`).join('')}</div>`;
      el.innerHTML = h; brancher(); return;
    }
    const C = S.calculer(P.E);
    if(s.type === 'canon'){
      const id = s.id, c = S.PAR_ID[id], sdm = c.zone === 'SDM', d = P.diag[id], dep = S.ORIGINE[id];
      h += `<h2>${sdm ? '🏠 ' + esc(c.nom) : `Canon ${esc(c.nom)}`} <small>${sdm ? 'salle des machines' : `${esc(zoneC(id))} · ${MODELES[c.modele] || ''}${dep ? ' · ' + esc(S.D_PAR_ID[dep].nom) : ''}`}${S.TETES.includes(id) ? ' · tête du dialogue' : ''}</small></h2>`;
      h += `<div class="mesure">Supervision : ${C.parlent.has(id) || (sdm && C.atteint.has(id)) ? '<b class="ok">communique</b>' : '<b class="ko">ne communique plus</b>'}${P.E.off.has(id) ? ' · interrupteur <b class="vo">ouvert</b>' : ''}` +
        (d ? `<br>Mesuré à ${heure(d.t)} : tension <b class="${d.tension === 'absente' ? 'vo' : 'ok'}">${d.tension}</b> · ${d.dialogue}` : '') + '</div>';
      if(!sdm){
        h += `<div class="ligneA">${bouton('🔍 Mesurer', DUREE.mesure, `mesurer|${id}`)}${bouton(P.E.off.has(id) ? '⏺ Fermer l’interrupteur' : '⭘ Ouvrir l’interrupteur', DUREE.inter, `inter|${id}`, 'act')}</div>`;
      }
      const ls = S.LIAISONS_DE[id] || [];
      if(ls.length){
        h += '<div class="sect">Liaisons de dialogue</div>';
        h += ls.map(l => { const o = l.a === id ? l.b : l.a, sens = S.versDe(l, o) === id ? '← de' : S.versDe(l, id) === o ? '→ vers' : '⇄';
          return `<div class="lien"><span>${sens} ${esc(nomC(o))} <small style="color:var(--doux)">${esc(l.ligne)}</small>${P.E.debr.has(l.k) ? ' · <b style="color:var(--volt)">débranchée</b>' : ''}</span>${bouton(P.E.debr.has(l.k) ? '🔗 Rebrancher' : '✂ Débrancher', DUREE.liaison, `liaison|${l.k}|${id}`, 'act')}${bouton('🔧 Refaire', DUREE.cable, `repLiaison|${l.k}|${id}`, 'rep')}</div>`; }).join('');
      }
      const cs = S.CABLES_DE[id] || [];
      if(cs.length){
        h += '<div class="sect">Câbles électriques</div>';
        h += cs.map(cb => { const o = cb.a === id ? cb.b : cb.a, nomO = o.startsWith('src/') ? S.D_PAR_ID[o.slice(4)].nom : nomC(o), sens = S.versDe(cb, o) === id ? '⚡ de' : '⚡ vers';
          return `<div class="lien"><span>${sens} ${esc(nomO)}${P.E.ouv.has(cb.k) ? ' · <b style="color:var(--volt)">ouvert</b>' : ''}</span>${bouton(P.E.ouv.has(cb.k) ? '⏺ Fermer' : '⭘ Ouvrir', DUREE.troncon, `troncon|${cb.k}|${id}`, 'act')}${bouton('🔧 Refaire', DUREE.cable, `repCable|${cb.k}|${id}`, 'rep')}</div>`; }).join('');
      }
      if(!sdm) h += `<div class="sect">Réparer le canon</div><div class="ligneA">${bouton('🔧 Changer la carte de dialogue', DUREE.carte, `carte|${id}`, 'rep')}${bouton('🔧 Réparer un court-circuit', DUREE.court, `court|${id}`, 'rep')}</div>`;
    } else if(s.type === 'liaison'){
      const l = S.L_PAR_K[s.k];
      h += `<h2>Liaison de dialogue <small>${esc(nomC(l.a))} ${l.d === 'ab' ? '→' : l.d === 'ba' ? '←' : '⇄'} ${esc(nomC(l.b))} · ${esc(l.ligne)}</small></h2>`;
      h += `<div class="ligneA">${bouton(P.E.debr.has(l.k) ? '🔗 Rebrancher' : '✂ Débrancher', DUREE.liaison, `liaison|${l.k}`, 'act')}${bouton('🔧 Refaire la liaison', DUREE.cable, `repLiaison|${l.k}`, 'rep')}</div>`;
      h += `<div class="ligneA">${bouton(`Canon ${esc(nomC(l.a))}`, 0, `voirC|${l.a}`)}${bouton(`Canon ${esc(nomC(l.b))}`, 0, `voirC|${l.b}`)}</div>`;
    } else if(s.type === 'cable'){
      const c = S.C_PAR_K[s.k];
      h += `<h2>Câble électrique <small>${esc(nomLien(c))}</small></h2>`;
      h += `<div class="ligneA">${bouton(P.E.ouv.has(c.k) ? '⏺ Fermer le tronçon' : '⭘ Ouvrir le tronçon', DUREE.troncon, `troncon|${c.k}`, 'act')}${bouton('🔧 Refaire le câble', DUREE.cable, `repCable|${c.k}`, 'rep')}</div>`;
      h += `<div class="ligneA">${[c.a, c.b].filter(x => !x.startsWith('src/')).map(x => bouton(`Canon ${esc(nomC(x))}`, 0, `voirC|${x}`)).join('')}</div>`;
    } else if(s.type === 'transfo'){
      const d = s.id, v = P.vus[d], nb = S.VRAIS.filter(c => S.ORIGINE[c.id] === d).length;
      h += `<h2>⚡ ${esc(S.D_PAR_ID[d].nom)} <small>${pl(nb, 'canon')} alimentés en temps normal</small></h2>`;
      h += `<div class="mesure">${v ? `Vu à ${heure(v.t)} : <b class="${v.etat === 'en service' || v.etat === 'réarmé' ? 'ok' : 'ko'}">${v.etat}</b>` : 'État : pas encore vu (allez voir sur place).'}</div>`;
      h += `<div class="ligneA">${bouton('👀 Aller voir', DUREE.voir, `voir|${d}`)}${bouton('⚡ Réarmer', DUREE.transfo, `rearmer|${d}`, 'act')}${bouton(P.E.depOuv.has(d) ? '⚡ Remettre en service' : '⭘ Couper', DUREE.transfo, P.E.depOuv.has(d) ? `rearmer|${d}` : `couper|${d}`, 'act')}</div>`;
    }
    h += `<div class="ligneA"><button class="btn" data-f="fermer">✕ Fermer</button></div>`;
    el.innerHTML = h; brancher();
  }
  function brancher(){
    $('panneau').querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      const [f, a, c] = b.dataset.f.split('|');
      if(f === 'fermer'){ P.sel = null; panneau(); dessiner(); return; }
      if(f === 'bilan'){ P.revele = false; bilan(); return; }
      if(f === 'voirC'){ P.sel = { type:'canon', id:a }; panneau(); dessiner(); return; }
      G[f](a, c);
    });
  }

  /* ---------- la carte ---------- */
  const cv = $('cv'), g = cv.getContext('2d');
  let V = { s:1, tx:0, ty:0 }, W = 0, H = 0, dpr = 1;
  const X = x => x * V.s + V.tx, Y = y => y * V.s + V.ty;
  function taille(){ const r = $('carteBox').getBoundingClientRect(); dpr = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  function ajuster(){
    taille();
    const pts = [...S.CANONS, ...S.DEPARTS], x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    // (de la place en haut pour les boutons, en bas pour la légende)
    const mx = 20, mh = 50, mb = 40, s = Math.min((W - 2 * mx) / (x1 - x0), (H - mh - mb) / (y1 - y0));
    V = { s, tx:(W - (x1 - x0) * s) / 2 - x0 * s, ty:mh + (H - mh - mb - (y1 - y0) * s) / 2 - y0 * s };
    cadre = true;
    dessiner();
  }
  const geomL = l => S.R.geomLiaisons[l.k] || [[posDe(l.a).x, posDe(l.a).y], [posDe(l.b).x, posDe(l.b).y]];
  const geomC = c => (!c.a.startsWith('src/') && !c.b.startsWith('src/') && S.R.geomCables[c.k]) || [[posDe(c.a).x, posDe(c.a).y], [posDe(c.b).x, posDe(c.b).y]];
  function trait(pts){ g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke(); }
  function fleche(pts, sens, coul){
    if(sens === 'both') return;
    const q = pts.map(p => [X(p[0]), Y(p[1])]); let tot = 0; for(let i = 1; i < q.length; i++) tot += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
    if(tot < 22) return;
    let acc = 0;
    for(let i = 1; i < q.length; i++){
      const l = Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
      if(acc + l >= tot / 2){ const t = l ? (tot / 2 - acc) / l : 0, mx = q[i - 1][0] + t * (q[i][0] - q[i - 1][0]), my = q[i - 1][1] + t * (q[i][1] - q[i - 1][1]);
        let a = Math.atan2(q[i][1] - q[i - 1][1], q[i][0] - q[i - 1][0]); if(sens === 'ba') a += Math.PI;
        g.save(); g.translate(mx, my); g.rotate(a); g.fillStyle = coul; g.beginPath(); g.moveTo(5, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.closePath(); g.fill(); g.restore(); return; }
      acc += l;
    }
  }
  let anim = 0;
  function dessiner(){
    if($('eJeu').hidden || !P) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const C = S.calculer(P.E), elec = P.vue === 'elec', r = Math.max(3.2, Math.min(9, V.s * 9)), lbl = V.s > .55;
    g.lineCap = 'round'; g.lineJoin = 'round';
    // les tracés des câbles (fond)
    g.strokeStyle = 'rgba(160,190,230,.10)'; g.lineWidth = 1.2; S.R.traces.forEach(trait);
    // les liaisons de dialogue
    S.LIAISONS.forEach(l => {
      const pts = geomL(l), debr = P.E.debr.has(l.k), envoi = (l.d !== 'ba' && C.atteint.has(l.a)) || (l.d !== 'ab' && C.atteint.has(l.b));
      const coul = elec ? 'rgba(160,190,230,.18)' : debr ? '#7D8796' : envoi ? '#2FD47A' : '#FF4D4D';
      g.strokeStyle = coul; g.lineWidth = elec ? 1.2 : 2.4; g.setLineDash(debr ? [5, 5] : []); trait(pts); g.setLineDash([]);
      if(!elec) fleche(pts, l.d, coul);
      if(debr && !elec){ const m = pts[Math.floor(pts.length / 2)]; g.fillStyle = '#FFD23F'; g.font = '13px system-ui'; g.textAlign = 'center'; g.fillText('✂', X(m[0]), Y(m[1]) - 4); }
    });
    // les câbles électriques
    if(elec) S.CABLES.forEach(c => {
      const pts = geomC(c), ouv = P.E.ouv.has(c.k), d = S.ORIGINE[c.a.startsWith('src/') ? c.b : c.a] || (c.a.startsWith('src/') ? c.a.slice(4) : null);
      g.strokeStyle = ouv ? '#EAF1FB' : (d ? S.D_PAR_ID[d].couleur : '#8899AA'); g.globalAlpha = ouv ? 1 : .85; g.lineWidth = 2.6; g.setLineDash(ouv ? [4, 5] : []); trait(pts); g.setLineDash([]); g.globalAlpha = 1;
      fleche(pts, c.d, ouv ? '#EAF1FB' : (d ? S.D_PAR_ID[d].couleur : '#8899AA'));
    });
    // les abris
    S.R.abris.forEach(a => { g.fillStyle = 'rgba(160,190,230,.35)'; g.fillRect(X(a.x) - 4, Y(a.y) - 4, 8, 8); });
    // les canons
    S.CANONS.forEach(c => {
      const x = X(c.x), y = Y(c.y), off = P.E.off.has(c.id), d = P.diag[c.id];
      let f;
      if(elec) f = off ? '#3A4352' : d ? (d.tension === 'absente' ? '#1A2233' : '#2FD47A') : '#55657C';
      else f = off ? '#3A4352' : (C.parlent.has(c.id) || (c.zone === 'SDM' && C.atteint.has(c.id))) ? '#2FD47A' : '#FF4D4D';
      if(c.zone === 'SDM'){ const q = r * 1.5; g.fillStyle = '#EAF1FB'; g.beginPath(); g.moveTo(x - q, y + q * .8); g.lineTo(x - q, y - q * .2); g.lineTo(x, y - q); g.lineTo(x + q, y - q * .2); g.lineTo(x + q, y + q * .8); g.closePath(); g.fill(); }
      else { g.fillStyle = f; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#0A101B'; g.lineWidth = 1.2; g.stroke(); }
      if(elec && d && d.tension === 'absente'){ g.strokeStyle = '#FFD23F'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
      if(off){ const k = r * .6; g.strokeStyle = '#EAF1FB'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); g.stroke(); }
      if(S.TETES.includes(c.id) && !elec){ g.strokeStyle = '#EAF1FB'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 3.5, 0, 7); g.stroke(); }
      if(d && !elec && d.dialogue === 'trames brouillées'){ g.fillStyle = '#FFD23F'; g.font = `bold ${Math.round(r * 1.6)}px system-ui`; g.textAlign = 'center'; g.fillText('≈', x, y - r - 2); }
      if(lbl || (P.sel && P.sel.id === c.id)){ g.fillStyle = 'rgba(234,241,251,.85)'; g.font = `${c.zone === 'SDM' ? 'bold ' : ''}11px system-ui`; g.textAlign = 'left'; g.fillText(c.nom, x + r + 3, y + 4); }
    });
    // les transfos
    S.DEPARTS.forEach(d => {
      const x = X(d.x), y = Y(d.y), q = 9, v = P.vus[d.id];
      g.fillStyle = P.E.depOuv.has(d.id) ? '#3A4352' : d.couleur; g.strokeStyle = v && v.etat === 'disjoncté' ? '#FF4D4D' : '#0A101B'; g.lineWidth = v && v.etat === 'disjoncté' ? 3 : 1.5;
      g.beginPath(); g.roundRect ? g.roundRect(x - q, y - q, 2 * q, 2 * q, 3) : g.rect(x - q, y - q, 2 * q, 2 * q); g.fill(); g.stroke();
      g.fillStyle = '#0A101B'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.fillText('⚡', x, y + 4);
      if(elec || lbl){ g.fillStyle = 'rgba(234,241,251,.9)'; g.font = '11px system-ui'; g.textAlign = 'left'; g.fillText(d.nom + (v ? ` (${v.etat})` : ''), x + q + 4, y + 4); }
    });
    // la sélection
    if(P.sel){
      g.strokeStyle = '#5AA9FF'; g.lineWidth = 3;
      if(P.sel.type === 'canon'){ const c = S.PAR_ID[P.sel.id]; g.beginPath(); g.arc(X(c.x), Y(c.y), r + 8, 0, 7); g.stroke(); }
      else if(P.sel.type === 'transfo'){ const d = S.D_PAR_ID[P.sel.id]; g.strokeRect(X(d.x) - 14, Y(d.y) - 14, 28, 28); }
      else { g.globalAlpha = .55; g.lineWidth = 8; trait(P.sel.type === 'liaison' ? geomL(S.L_PAR_K[P.sel.k]) : geomC(S.C_PAR_K[P.sel.k])); g.globalAlpha = 1; }
    }
    // les pannes, à la fin
    if(P.revele){
      const pulse = 10 + 4 * Math.sin(performance.now() / 250);
      g.strokeStyle = '#FFD23F'; g.lineWidth = 3;
      P.E.pannes.forEach(p => {
        let pt;
        if(p.canon) pt = S.PAR_ID[p.canon];
        else { const e = p.type === 'cableDia' ? S.L_PAR_K[p.k] : S.C_PAR_K[p.k], gg = p.type === 'cableDia' ? geomL(e) : geomC(e), m = gg[Math.floor(gg.length / 2)]; pt = { x:m[0], y:m[1] }; g.lineWidth = 6; trait(gg); g.lineWidth = 3; }
        g.beginPath(); g.arc(X(pt.x), Y(pt.y), r + pulse, 0, 7); g.stroke();
      });
      cancelAnimationFrame(anim); anim = requestAnimationFrame(dessiner);
    }
    // le technicien
    g.font = '18px system-ui'; g.textAlign = 'center'; g.fillText('🛷', X(P.tech.x), Y(P.tech.y) - 10);
  }
  function majVues(){ $('vDia').setAttribute('aria-pressed', P.vue === 'dia'); $('vElec').setAttribute('aria-pressed', P.vue === 'elec');
    $('legende').innerHTML = P.vue === 'dia' ? '<span><i style="background:#2FD47A"></i>communique</span><span><i style="background:#FF4D4D"></i>ne communique plus</span><span><i style="background:#3A4352"></i>coupé</span><span>≈ brouillé (mesuré)</span>'
      : '<span><i style="background:#2FD47A"></i>tension mesurée</span><span><i style="background:#1A2233;border:2px solid #FFD23F"></i>pas de tension</span><span><i style="background:#55657C"></i>pas mesuré</span><span>tirets : tronçon ouvert</span>'; }
  $('vDia').onclick = () => { P.vue = 'dia'; majVues(); dessiner(); if(!P.sel || P.sel.type === 'cable'){ P.sel = null; panneau(); } };
  $('vElec').onclick = () => { P.vue = 'elec'; majVues(); dessiner(); if(!P.sel) panneau(); };
  const zoomA = (f, cx, cy) => { const s = Math.min(40, Math.max(.05, V.s * f)); f = s / V.s; V.tx = cx - (cx - V.tx) * f; V.ty = cy - (cy - V.ty) * f; V.s = s; dessiner(); };
  $('zPlus').onclick = () => zoomA(1.5, W / 2, H / 2); $('zMoins').onclick = () => zoomA(1 / 1.5, W / 2, H / 2); $('zTout').onclick = ajuster;
  // distance d'un point à un tracé (en pixels)
  function distTrait(px, py, pts){
    let m = Infinity;
    for(let i = 1; i < pts.length; i++){
      const ax = X(pts[i - 1][0]), ay = Y(pts[i - 1][1]), bx = X(pts[i][0]), by = Y(pts[i][1]), dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
      m = Math.min(m, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    return m;
  }
  function toucher(px, py){
    if(!P || P.revele) return;
    let best = null, bd = 18;
    S.DEPARTS.forEach(d => { const e = Math.hypot(X(d.x) - px, Y(d.y) - py); if(e < bd){ bd = e; best = { type:'transfo', id:d.id }; } });
    S.CANONS.forEach(c => { const e = Math.hypot(X(c.x) - px, Y(c.y) - py); if(e < bd){ bd = e; best = { type:'canon', id:c.id }; } });
    if(!best){
      let ld = 11;
      if(P.vue === 'elec') S.CABLES.forEach(c => { const e = distTrait(px, py, geomC(c)); if(e < ld){ ld = e; best = { type:'cable', k:c.k }; } });
      else S.LIAISONS.forEach(l => { const e = distTrait(px, py, geomL(l)); if(e < ld){ ld = e; best = { type:'liaison', k:l.k }; } });
    }
    P.sel = best; panneau(); dessiner();
    if(best && window.matchMedia('(orientation:portrait)').matches) $('panneau').scrollTop = 0;
  }
  // un doigt : déplacer ; deux doigts : zoomer ; toucher court : choisir
  const pts = new Map(); let geste = null;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    const r = cv.getBoundingClientRect();
    if(pts.size === 1) geste = { pan:true, x:e.clientX, y:e.clientY, tx:V.tx, ty:V.ty, bouge:false, t:Date.now(), r };
    else if(pts.size === 2){ const [a, b] = [...pts.values()]; geste = { pinch:true, d:Math.hypot(a.x - b.x, a.y - b.y) || 1, s:V.s, mx:(a.x + b.x) / 2 - r.left, my:(a.y + b.y) / 2 - r.top, tx:V.tx, ty:V.ty, bouge:true }; } });
  cv.addEventListener('pointermove', e => { if(!pts.has(e.pointerId) || !geste) return; pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(geste.pinch && pts.size >= 2){ const [a, b] = [...pts.values()], s = Math.min(40, Math.max(.05, geste.s * Math.hypot(a.x - b.x, a.y - b.y) / geste.d)), wx = (geste.mx - geste.tx) / geste.s, wy = (geste.my - geste.ty) / geste.s;
      V.s = s; V.tx = geste.mx - wx * s; V.ty = geste.my - wy * s; dessiner(); }
    else if(geste.pan){ const dx = e.clientX - geste.x, dy = e.clientY - geste.y; if(Math.hypot(dx, dy) > 8) geste.bouge = true; if(geste.bouge){ V.tx = geste.tx + dx; V.ty = geste.ty + dy; dessiner(); } } });
  const fin = e => { if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(geste && geste.pan && !geste.bouge && e.type === 'pointerup' && Date.now() - geste.t < 600){ const r = cv.getBoundingClientRect(); toucher(e.clientX - r.left, e.clientY - r.top); }
    if(pts.size === 1){ const [a] = [...pts.values()]; geste = { pan:true, x:a.x, y:a.y, tx:V.tx, ty:V.ty, bouge:true }; } else if(!pts.size) geste = null; };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomA(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); }, { passive:false });
  // la carte change de taille (panneau, rotation) : on garde le même centre
  let cadre = false;
  new ResizeObserver(() => {
    if($('eJeu').hidden || !P) return;
    const w0 = W, h0 = H; taille();
    if(!cadre || !w0) return ajuster();
    V.tx += (W - w0) / 2; V.ty += (H - h0) / 2; dessiner();
  }).observe($('carteBox'));

  /* ---------- démarrage ---------- */
  window.Panne = { get P(){ return P; }, demarrer, G, accueil, toucher, S };
  if(/[?&]test\b/.test(location.search)){ document.body.innerHTML = `<pre style="padding:16px;color:#EAF1FB;white-space:pre-wrap">${S.tests().join('\n')}</pre>`; return; }
  accueil();
  if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
  if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
