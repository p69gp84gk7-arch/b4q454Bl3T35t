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
  // le chrono (en secondes) : 1:05, ou 1 h 02:05
  const chrono = t => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = String(t % 60).padStart(2, '0'); return h ? `${h} h ${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`; };
  const NB = S.VRAIS.length;
  const nomC = id => { const c = S.PAR_ID[id]; return c ? (c.zone === 'SDM' ? c.nom : c.nom) : id; };
  const zoneC = id => { const c = S.PAR_ID[id]; return c ? c.zone.charAt(0).toUpperCase() + c.zone.slice(1) : ''; };
  const nomCanon = id => S.PAR_ID[id] && S.PAR_ID[id].zone === 'SDM' ? S.PAR_ID[id].nom : `canon ${nomC(id)} (${zoneC(id)})`;
  const MODELES = { revo:'Revo', borax:'Borax', borax_01:'Borax', v3:'V3', t40:'T40', t60:'T60', tf10:'TF10', tr8:'TR8', safyr:'Safyr', rubis:'Rubis' };
  const posDe = id => { if(id.startsWith('src/')){ const d = S.D_PAR_ID[id.slice(4)]; return { x:d.x, y:d.y }; } return S.PAR_ID[id]; };

  /* ---------- les records ---------- */
  let REC = Object.assign({ parties:0, reussies:0, niveaux:{} }, lire('panne-records', {}));
  // les règles ont changé (version 186 : le signal, les répétiteurs, un canon exclu ne coupe plus la ligne) : les étoiles et les
  // records repartent de zéro ; les niveaux déjà joués restent ouverts
  const REGLES = 2;
  if(REC.regles !== REGLES){
    const avant = REC.parties;
    for(const k in REC.niveaux) REC.niveaux[k] = { etoiles:0, fois:REC.niveaux[k].fois || 0, reussies:0 };
    REC.defis = {}; REC.regles = REGLES; REC.reprise = !!avant;
    if(avant) ecrire('panne-records', REC);
  }
  const etoilesTotal = () => Object.values(REC.niveaux).reduce((s, n) => s + (n.etoiles || 0), 0);

  /* ---------- écrans ---------- */
  const ecran = id => { ['eAccueil', 'eJeu', 'eFin', 'eAide'].forEach(e => $(e).hidden = e !== id); if(id === 'eJeu') requestAnimationFrame(() => { taille(); dessiner(); }); window.scrollTo(0, 0); };
  function accueil(){
    ecran('eAccueil');
    const n = REC.niveaux;
    $('cRecords').innerHTML = `<h3>Tes records</h3><div class="stats"><div><b>${etoilesTotal()}</b><small>étoiles / ${S.NIVEAUX.length * 3}</small></div><div><b>${REC.reussies}</b><small>pannes réparées</small></div><div><b>${REC.parties}</b><small>parties</small></div><div><b>${REC.parties ? Math.round(100 * REC.reussies / REC.parties) + ' %' : '—'}</b><small>de réussite</small></div></div>`;
    if(REC.reprise) $('cRecords').innerHTML += `<p class="sous" style="font-size:.8rem;margin-top:8px">Les règles ont changé (mesure du signal, répétiteurs, un canon exclu ne coupe plus la ligne) : les étoiles repartent de zéro. Les pannes déjà ouvertes le restent.</p>`;
    const D = S.defiDuJour(), fait = (REC.defis || {})[D.defi];
    $('cDefi').innerHTML = `<h3>🗓 Défi du jour</h3><p class="sous">La même panne pour tout le monde aujourd'hui (une panne mystère, qui change chaque jour).</p>
      ${fait ? `<p class="sous" style="margin-top:6px">✅ Réussi : <b style="color:var(--or)">${'★'.repeat(fait.etoiles)}${'☆'.repeat(3 - fait.etoiles)}</b> · ${pl(fait.gestes, 'geste')} · ⏱ ${chrono(fait.temps)}</p>` : ''}
      <button class="btn gros" id="bDefi" style="margin-top:10px">${fait ? '↻ Rejouer le défi du jour' : '▶ Jouer le défi du jour'}</button>`;
    $('bDefi').onclick = () => demarrer(null, true);
    const carteNiv = (v, i) => {
      if(!ouvert(i)) return `<button class="niv verrou" data-n="${v.id}" data-verrou="1"><b>🔒 ${i + 1}. ${esc(v.nom)}</b><small>Réussis « ${esc(S.NIVEAUX[i - 1].nom)} » pour débloquer cette panne.</small></button>`;
      const r = n[v.id] || {}, ico = { dialogue:'✂️', ligne:'📡', elec:'🔌', court:'⚡', intermittent:'〰️', double:'✌️', mystere:'❓', adresse:'🔢', paire:'⇆', parasite:'🛡', repeteur:'📶', faible:'📉', cachee:'🫥', expert2:'🎓', expert3:'🏆' }[v.id];
      return `<button class="niv" data-n="${v.id}"><b>${ico} ${i + 1}. ${esc(v.nom)}</b><small>${esc(v.texte)}</small>
        <span class="et">${'★'.repeat(r.etoiles || 0)}${'☆'.repeat(3 - (r.etoiles || 0))}</span>
        <span class="rec">${r.reussies ? `Meilleur : ${pl(r.gestes, 'geste')}${r.temps != null ? ` · ⏱ ${chrono(r.temps)}` : ''}` : 'Pas encore réussi'}</span></button>`;
    };
    const reussis = S.NIVEAUX.filter(v => (n[v.id] || {}).reussies).length;
    $('cNiveaux').innerHTML = `<p class="sous" style="margin-bottom:6px">Le parcours, de la panne la plus simple à la plus sournoise : chaque panne réussie débloque la suivante. <b>${reussis} / ${S.NIVEAUX.length}</b> réussies.</p>` +
      Object.entries(S.PALIERS).map(([p, titre]) => `<h3 style="margin-top:8px">${titre}</h3><div class="niveaux">${S.NIVEAUX.map((v, i) => v.palier === p ? carteNiv(v, i) : '').join('')}</div>`).join('');
  }
  // un niveau est ouvert si c'est le premier, s'il a déjà été joué, ou si le précédent est réussi
  const ouvert = i => i === 0 || !!(REC.niveaux[S.NIVEAUX[i].id] || {}).fois || !!(REC.niveaux[S.NIVEAUX[i - 1].id] || {}).reussies;
  $('cNiveaux').onclick = e => { const b = e.target.closest('[data-n]'); if(!b) return; if(b.dataset.verrou){ b.classList.add('secoue'); setTimeout(() => b.classList.remove('secoue'), 400); return; } demarrer(b.dataset.n); };
  $('bAide').onclick = () => ecran('eAide');
  $('bAideRetour').onclick = () => accueil();

  /* ---------- la partie ---------- */
  let P = null;
  function demarrer(nivId, defi){
    const p = defi ? S.defiDuJour() : S.nouvellePartie(nivId);
    if(defi) p.niveau = { id:'defi', nom:'Défi du jour' };
    P = Object.assign(p, { gestes:0, faux:0, mesures:0, vus:{}, diag:{}, journal:[], fini:false, sel:null, vue:'dia', revele:false, t0:Date.now(), achats:0 });
    const C = S.calculer(P.E); P.dernierN = C.parlent.size;
    journal(`🚨 <b>Alarme supervision</b> : ${pl(NB - C.parlent.size, 'canon')} ne communiquent plus. Le chrono est lancé !`);
    if(!defi && p.niveau.methode) journal(`💡 <b>${esc(p.niveau.nom)}</b> : ${esc(p.niveau.methode)}`, 'bon');
    cadre = false; ecran('eJeu'); majVues(); panneau(); etat(); requestAnimationFrame(ajuster);
  }
  function journal(t, cls){ P.journal.unshift({ t:P.E.t, h:`<b>${chrono(P.E.t)}</b> · ${t}`, cls }); if(P.journal.length > 80) P.journal.pop(); }
  let tToast = 0;
  function toast(t){ const e = $('toast'); e.innerHTML = t; e.hidden = false; clearTimeout(tToast); tToast = setTimeout(() => e.hidden = true, 2600); }
  const parlent = () => S.calculer(P.E).parlent;
  // le chrono tourne : il s'affiche, et la supervision suit les pannes intermittentes en direct
  const temps = () => (Date.now() - P.t0) / 1000;
  setInterval(() => {
    if(!P || P.fini || P.revele || $('eJeu').hidden) return;
    P.E.t = temps(); $('jChrono').textContent = `⏱ ${chrono(P.E.t)}`;
    const n = parlent().size;
    if(n !== P.dernierN){ journal(`📡 La supervision change : <b>${n}</b> / ${NB} (${n > P.dernierN ? '+' : ''}${n - P.dernierN})`); P.dernierN = n; etat(); if(!P.sel) panneau(); dessiner(); }
  }, 500);
  // Un geste : il se fait tout de suite
  function agir(compte, faire){
    if(!P || P.fini || P.revele) return;
    P.E.t = temps();
    const avant = parlent().size;
    const r = faire() || {};
    const disj = S.stabiliser(P.E);
    // le réseau a changé : les mesures déjà faites ne sont plus sûres (elles restent écrites, en gris)
    if(!r.sansSupervision) Object.values(P.diag).forEach(d => d.perime = true);
    if(compte) P.gestes++;
    const apres = parlent().size, diff = apres - avant;
    const suite = r.sansSupervision ? '' : ` → <b>${apres}</b> / ${NB}${diff ? ` (${diff > 0 ? '+' : ''}${diff})` : ''}`;
    journal(`${r.texte}${suite}`, r.cls); P.dernierN = apres;
    disj.forEach(dp => { P.vus[dp] = { t:P.E.t, etat:'disjoncté' }; journal(`💥 <b>${esc(S.D_PAR_ID[dp].nom)} a disjoncté !</b>`, 'mal'); });
    toast((disj.length ? `💥 ${esc(S.D_PAR_ID[disj[0]].nom)} a disjoncté ! ` : '') + (r.toast || r.texte) + (r.sansSupervision ? '' : ` · ${apres} / ${NB}`));
    if(S.toutVa(P.E)) return finir(true);
    etat(); panneau(); dessiner();
  }
  // les pièces de rechange : 💳 modules (un canon qui brouille, une adresse en double), 🧰 kits (câble, liaison, court-circuit, blindage, répétiteur)
  const PIECES = { modules:'module', kits:'kit de réparation' };
  // il faut une pièce en main pour tenter une réparation (stock vide : on propose d'en acheter, c'est gratuit) ;
  // elle n'est consommée que si la réparation était la bonne
  function piece(t){
    if(P.E.stock[t] <= 0){ if(!confirm(`Plus de ${PIECES[t]} en stock. En acheter un ?`)) return false; acheter(t, true); }
    return true;
  }
  function acheter(t, silence){
    if(!P || P.fini) return;
    P.E.stock[t]++; P.achats++;
    journal(`🛒 ${t === 'modules' ? '💳 Un module' : '🧰 Un kit de réparation'} acheté`);
    if(!silence){ toast(`🛒 +1 ${PIECES[t]}`); etat(); panneau(); }
  }
  // une réparation : la bonne (la pièce est posée, la panne est réparée) ou une erreur (comptée triple, la pièce est gardée)
  function reparer(p, stock, bon, mauvais){
    if(p){ p.repare = true; p.trouve = P.E.t; if(stock) P.E.stock[stock]--; return { texte:'✅ ' + bon, cls:'bon' }; }
    P.faux++; return { texte:'❌ ' + mauvais + (stock ? ' La pièce retourne au stock.' : ''), cls:'mal' };
  }
  const panne = (type, cle) => P.E.pannes.find(p => !p.repare && p.type === type && (p.canon === cle || p.k === cle));

  /* ---------- les mesures, en clair ---------- */
  // le signal mesuré : « 62 % net », « 48 %, brouillé (bruit 73 %) », « absent »…
  const lireSignal = (n, q, bruit) => q === 'absent' ? '<b class="ko">absent</b>' : q === 'net' ? `<b class="ok">${n} % net</b>` : q === 'brouillé' ? `${n} %, <b class="ko">brouillé</b>${bruit != null ? ` (bruit <b class="vo">${bruit} %</b>)` : ''}` : q === 'illisible' ? `${n} %, <b class="ko">illisible</b>` : `<b class="vo">${n} %, trop faible</b>`;
  const lireReponse = r => ({ communique:'<b class="ok">le canon répond</b>', exclu:'canon <b class="vo">exclu du réseau</b>', 'éteint':'canon <b class="vo">sans courant</b>', conflit:'<b class="ko">adresse en double</b>', muet:'<b class="ko">le canon ne répond pas</b>' })[r];
  // (le signal est-il bien plus bas que d'habitude à cet endroit ?)
  const tropBas = d => d.qualite !== 'absent' && d.signal < d.normal * .75;
  const lireMesure = d => `tension <b class="${d.tension === 'absente' ? 'vo' : 'ok'}">${d.tension}</b> · signal ${lireSignal(d.signal, d.qualite, d.bruit)}${tropBas(d) ? ` <small>(d'habitude ${d.normal} %)</small>` : ''} · ${lireReponse(d.reponse)}`
    + (d.rep ? `<br>📶 Répétiteur : ${d.rep.courant ? 'alimenté' : '<b class="vo">sans courant</b>'} · entrée ${lireSignal(d.rep.entree, d.rep.qEntree)} · sortie ${d.rep.sortie ? '<b class="ok">100 %</b>' : '<b class="ko">rien</b>'}` : '');
  // ce que la mesure veut dire, et où chercher ensuite
  function conseil(d){
    if(d.rep){
      if(!d.rep.courant) return 'Ce répétiteur n’a pas de courant : il ne renvoie rien, et tout ce qui est après lui se tait. Cherchez côté électricité (vue ⚡).';
      if(!d.rep.sortie && d.rep.qEntree === 'net') return 'Bon signal à l’entrée, rien à la sortie, et il a du courant : le répétiteur est en panne. Changez-le.';
      if(!d.rep.sortie) return `Le signal qui arrive au répétiteur est ${d.rep.qEntree} : il ne peut rien renvoyer. Le défaut est avant lui, dans le tronçon d’où il reçoit.`;
    }
    if(d.tension === 'absente') return 'Pas de tension ici : c’est une panne de courant. Passez en vue ⚡ Électricité : allez voir le transfo (a-t-il disjoncté ?), ou cherchez où la tension s’arrête le long du câble.';
    if(d.reponse === 'conflit') return 'Il a du courant et un bon signal, mais il répond en même temps qu’un autre canon : adresse en double. Changez son module (ou celui de l’autre).';
    if(d.qualite === 'absent') return 'Aucun signal : la ligne est coupée avant ce canon (ou le répétiteur d’avant ne renvoie rien). Remontez vers la tête jusqu’à retrouver du signal.';
    if(d.qualite === 'brouillé') return d.bruit >= 90 ? 'Bruit au maximum : le module fautif est ici, ou juste à côté. Excluez ce canon : si tout revient, c’est lui.' : d.bruit >= 50 ? 'Bruit fort : le fautif est proche. Mesurez de chaque côté, le bruit monte en s’approchant de lui.' : 'Bruit faible : le fautif est loin dans ce tronçon. Allez du côté où le bruit monte.';
    if(d.qualite === 'illisible') return 'Du signal, mais illisible : une paire A/B inversée (ou un parasite) avant ce canon. Cherchez le dernier canon où le signal est encore net.';
    if(d.qualite === 'faible') return `Signal trop faible pour être lu (d’habitude ${d.normal} % ici) : une liaison abîmée l’a affaibli avant ce canon. Cherchez où il chute d’un coup.`;
    if(tropBas(d)) return `Le canon lit encore le signal, mais il est bien plus bas que d’habitude (${d.normal} % ici) : il a chuté avant ce canon. Remontez pour trouver où, c’est une liaison abîmée.`;
    if(d.reponse === 'éteint') return 'Le signal passe très bien, mais ce canon n’a pas de courant : cherchez côté électricité (vue ⚡).';
    if(d.reponse === 'exclu') return 'Canon exclu : il ne répond pas, mais la ligne continue de passer vers les suivants.';
    return 'Tout va bien ici : le défaut est plus loin, ou sur une autre branche.';
  }

  /* ---------- les gestes ---------- */
  const G = {
    mesurer:id => agir(true, () => {
      P.mesures++; const d = S.diagnostic(P.E, id); P.diag[id] = Object.assign({ t:P.E.t }, d);
      return { texte:`🔍 Mesure au ${nomCanon(id)} : ${lireMesure(d)}<br><i>💡 ${conseil(d)}</i>`, sansSupervision:true, toast:`Signal ${d.qualite === 'absent' ? 'absent' : d.signal + ' % ' + (d.qualite === 'faible' ? 'trop faible' : d.qualite)}${d.qualite === 'brouillé' ? ' · bruit ' + d.bruit + ' %' : ''}` };
    }),
    inter:id => { const ouvrir = !P.E.off.has(id); agir(ouvrir, () => { if(ouvrir) P.E.off.add(id); else P.E.off.delete(id); delete P.diag[id];
      return { texte:ouvrir ? `⭘ ${nomCanon(id)} <b>exclu du réseau</b> (interrupteur ouvert) : il ne répond plus, la ligne continue de passer` : `⏺ ${nomCanon(id)} remis sur le réseau (interrupteur refermé)` }; }); },
    liaison:(k, ou) => { const deb = !P.E.debr.has(k), l = S.L_PAR_K[k]; agir(deb, () => { if(deb) P.E.debr.add(k); else P.E.debr.delete(k); P.diag = {};
      return { texte:deb ? `✂ Liaison ${nomC(l.a)} – ${nomC(l.b)} <b>débranchée</b> : plus rien ne passe après elle` : `🔗 Liaison ${nomC(l.a)} – ${nomC(l.b)} rebranchée` }; }); },
    troncon:(k, ou) => { const ouv = !P.E.ouv.has(k), c = S.C_PAR_K[k]; agir(ouv, () => { if(ouv) P.E.ouv.add(k); else P.E.ouv.delete(k); return { texte:`${ouv ? '⭘ Tronçon électrique ouvert' : '⏺ Tronçon électrique refermé'} ${nomLien(c)}` }; }); },
    voir:d => agir(true, () => { const e = etatTransfo(d); P.vus[d] = { t:P.E.t, etat:e }; return { texte:`👀 ${esc(S.D_PAR_ID[d].nom)} : <b>${e}</b>`, sansSupervision:true, toast:`${esc(S.D_PAR_ID[d].nom)} : ${e}` }; }),
    rearmer:d => agir(true, () => {
      const avant = P.E.disj.has(d); P.E.disj.delete(d); P.E.depOuv.delete(d);
      const de = S.stabiliser(P.E); const saute = P.E.disj.has(d);
      P.vus[d] = { t:P.E.t, etat:saute ? 'disjoncté' : 'en service' };
      if(saute) return { texte:`💥 ${esc(S.D_PAR_ID[d].nom)} réarmé… <b>il redisjoncte aussitôt !</b> Un court-circuit est toujours alimenté.`, cls:'mal' };
      return { texte:avant ? `⚡ ${esc(S.D_PAR_ID[d].nom)} réarmé : <b>il tient</b>` : `⚡ ${esc(S.D_PAR_ID[d].nom)} remis en service`, cls:avant ? 'bon' : '' };
    }),
    couper:d => agir(true, () => { P.E.depOuv.add(d); P.vus[d] = { t:P.E.t, etat:'coupé' }; return { texte:`⭘ ${esc(S.D_PAR_ID[d].nom)} coupé : ses canons n'ont plus de courant` }; }),
    // changer le module d'un canon : il répare un module qui brouille son tronçon, ou une adresse en double
    module:id => { if(!P.fini && piece('modules')) agir(true, () => {
      const p = panne('contaminant', id), a = P.E.pannes.find(x => !x.repare && x.type === 'adresse' && x.canons.includes(id));
      if(p) return reparer(p, 'modules', `Module changé au ${nomCanon(id)} : <b>c'était bien lui qui brouillait le tronçon !</b>`);
      return reparer(a, 'modules', `Module changé au ${nomCanon(id)} : <b>il avait la même adresse qu'un autre canon !</b>`, `Module changé au ${nomCanon(id)}… l'ancien marchait très bien.`);
    }); },
    repeteur:id => { if(!P.fini && piece('kits')) agir(true, () => reparer(panne('repeteur', id), 'kits', `Répétiteur du ${nomCanon(id)} changé : <b>il ne renvoyait plus le signal !</b>`, `Répétiteur du ${nomCanon(id)} changé… l'ancien marchait très bien.`)); },
    inverser:(k, ou) => { const l = S.L_PAR_K[k]; agir(true, () => reparer(panne('paire', k), null, `Paire A/B inversée sur la liaison ${nomC(l.a)} – ${nomC(l.b)} : <b>elle était à l'envers !</b>`, `Paire inversée sur ${nomC(l.a)} – ${nomC(l.b)}… elle était bien branchée (remise comme avant).`)); },
    blinder:(k, ou) => { const l = S.L_PAR_K[k]; if(!P.fini && piece('kits')) agir(true, () => reparer(panne('parasite', k), 'kits', `Liaison ${nomC(l.a)} – ${nomC(l.b)} blindée et écartée du câble de puissance : <b>plus de parasites !</b>`, `Liaison ${nomC(l.a)} – ${nomC(l.b)} blindée… elle n'était pas parasitée.`)); },
    court:id => { if(!P.fini && piece('kits')) agir(true, () => reparer(panne('court', id), 'kits', `Court-circuit réparé au ${nomCanon(id)} (réarmez le transfo)`, `Pas de court-circuit au ${nomCanon(id)}.`)); },
    repLiaison:(k, ou) => { const l = S.L_PAR_K[k]; if(!P.fini && piece('kits')) agir(true, () => {
      const f = panne('cableFaible', k);
      if(f) return reparer(f, 'kits', `Liaison ${nomC(l.a)} – ${nomC(l.b)} refaite : <b>elle était abîmée et affaiblissait le signal !</b>`);
      return reparer(panne('cableDia', k), 'kits', `Liaison ${nomC(l.a)} – ${nomC(l.b)} refaite : <b>elle était coupée !</b>`, `Liaison ${nomC(l.a)} – ${nomC(l.b)} refaite… elle était en bon état.`); }); },
    repCable:(k, ou) => { const c = S.C_PAR_K[k]; if(!P.fini && piece('kits')) agir(true, () => reparer(panne('cableElec', k), 'kits', `Câble électrique ${nomLien(c)} réparé : <b>il était coupé !</b>`, `Câble ${nomLien(c)} refait… il n'était pas coupé.`)); },
    remettre:() => {
      const n = P.E.off.size + P.E.debr.size + P.E.ouv.size + P.E.depOuv.size + P.E.disj.size;
      if(!n) return;
      agir(false, () => {
        P.E.off.clear(); P.E.debr.clear(); P.E.ouv.clear(); P.E.depOuv.clear(); [...P.E.disj].forEach(d => P.E.disj.delete(d));
        Object.keys(P.vus).forEach(d => P.vus[d] = { t:P.E.t, etat:'réarmé' }); P.diag = {};
        return { texte:`↺ Tout remis en service (${pl(n, 'élément')} refermé${n > 1 ? 's' : ''}, transfos réarmés)` };
      });
    },
  };
  const etatTransfo = d => P.E.depOuv.has(d) ? 'coupé' : P.E.disj.has(d) ? 'disjoncté' : 'en service';
  const nomLien = c => `${c.a.startsWith('src/') ? S.D_PAR_ID[c.a.slice(4)].nom : nomC(c.a)} – ${c.b.startsWith('src/') ? S.D_PAR_ID[c.b.slice(4)].nom : nomC(c.b)}`;

  /* ---------- la fin ---------- */
  function finir(ok){
    P.fini = true; P.reussi = ok; P.E.t = temps();
    const score = P.gestes + 3 * P.faux, opt = P.E.optimum;
    P.etoiles = !ok ? 0 : score <= opt + 2 ? 3 : score <= 2 * opt + 3 ? 2 : 1;
    REC.parties++; if(ok) REC.reussies++;
    const t = Math.round(P.E.t);
    if(P.defi){
      // le défi du jour : le meilleur résultat de la journée (les 30 derniers jours sont gardés)
      REC.defis = REC.defis || {};
      const d = REC.defis[P.defi];
      if(ok){
        if(!d) REC.defisReussis = (REC.defisReussis || 0) + 1;
        if(!d || P.etoiles > d.etoiles || (P.etoiles === d.etoiles && (P.gestes < d.gestes || (P.gestes === d.gestes && t < d.temps)))) REC.defis[P.defi] = { etoiles:P.etoiles, gestes:P.gestes, temps:t, sorte:P.types.join('+') };
      }
      Object.keys(REC.defis).sort().slice(0, -30).forEach(k => delete REC.defis[k]);
    } else {
      const r = REC.niveaux[P.niveau.id] = REC.niveaux[P.niveau.id] || { etoiles:0, fois:0, reussies:0 };
      r.fois++;
      if(ok){
        r.reussies++; r.etoiles = Math.max(r.etoiles || 0, P.etoiles);
        if(r.gestes == null || P.gestes < r.gestes) r.gestes = P.gestes;
        if(r.temps == null || t < r.temps) r.temps = t;
      }
    }
    { const i = S.NIVEAUX.findIndex(v => v.id === P.niveau.id); P.debloque = ok && !P.defi && i >= 0 && S.NIVEAUX[i + 1] && (REC.niveaux[P.niveau.id] || {}).reussies === 1; }
    REC.dernier = { nom:P.niveau.nom, etoiles:P.etoiles, reussi:ok, gestes:P.gestes };
    ecrire('panne-records', REC);
    bilan();
  }
  function decrire(p){
    const C0 = (() => { const E = S.nouvelEtat(); E.pannes = [Object.assign({}, p, { repare:false, intermittent:false })]; S.stabiliser(E); return S.calculer(E); })();
    const ok = p.repare ? ` <b class="ok">· réparée à ${chrono(p.trouve)}</b>` : ' <b class="ko">· pas trouvée</b>';
    const cache = p.cachee ? ' <i>(cachée derrière l’autre panne)</i>' : '', muets = pl(NB - C0.parlent.size, 'canon');
    if(p.type === 'contaminant') return `📡 <b>${nomCanon(p.canon)}</b> : son module envoyait n'importe quoi sur le câble. Il brouillait les ${pl(C0.brouille.size, 'canon')} de son tronçon${p.intermittent ? ', <b>par intermittence</b>' : ''} ; ${muets} muets en tout (changer le module).${ok}`;
    if(p.type === 'repeteur') return `📶 <b>Répétiteur du ${nomCanon(p.canon)}</b> en panne : il ne renvoyait plus le signal, ${muets} muets après lui (changer le répétiteur).${ok}`;
    if(p.type === 'cableDia'){ const l = S.L_PAR_K[p.k]; return `✂️ <b>Liaison de dialogue ${nomC(l.a)} – ${nomC(l.b)}</b> (${zoneC(l.a)}) coupée : plus aucun signal après elle, ${muets} muets.${cache}${ok}`; }
    if(p.type === 'cableFaible'){ const l = S.L_PAR_K[p.k]; return `📉 <b>Liaison de dialogue ${nomC(l.a)} – ${nomC(l.b)}</b> (${zoneC(l.a)}) abîmée : le signal y perdait plus de la moitié de sa force, ${muets} trop loin pour le lire.${ok}`; }
    if(p.type === 'cableElec'){ const c = S.C_PAR_K[p.k], n = S.VRAIS.filter(v => !C0.alim(v.id)).length; return `🔌 <b>Câble électrique ${nomLien(c)}</b> coupé : ${pl(n, 'canon')} sans courant${NB - C0.parlent.size > n ? `, dont un répétiteur : ${muets} muets en tout` : ''}.${ok}`; }
    if(p.type === 'court') return `⚡ <b>${nomCanon(p.canon)}</b> en court-circuit : ${esc(S.D_PAR_ID[S.ORIGINE[p.canon]].nom)} disjonctait.${ok}`;
    if(p.type === 'adresse') return `🔢 <b>${nomCanon(p.canons[0])}</b> et <b>${nomCanon(p.canons[1])}</b> avaient la même adresse : ils répondaient en même temps et la supervision ne comprenait ni l'un ni l'autre (changer le module de l'un des deux).${ok}`;
    if(p.type === 'paire'){ const l = S.L_PAR_K[p.k]; return `⇆ <b>Liaison ${nomC(l.a)} – ${nomC(l.b)}</b> (${zoneC(l.a)}) : paire A/B inversée, le signal était illisible après elle (${muets}).${cache}${ok}`; }
    if(p.type === 'parasite'){ const l = S.L_PAR_K[p.k]; return `🛡 <b>Liaison ${nomC(l.a)} – ${nomC(l.b)}</b> (${zoneC(l.a)}) parasitée par le câble de puissance de ${esc(S.D_PAR_ID[p.transfo].nom)} : couper ce transfo la faisait revenir.${ok}`; }
    return '';
  }
  function bilan(){
    ecran('eFin');
    // le niveau suivant du parcours, s'il est ouvert
    const i = S.NIVEAUX.findIndex(v => v.id === P.niveau.id), suiv = !P.defi && i >= 0 && S.NIVEAUX[i + 1] && ouvert(i + 1) ? S.NIVEAUX[i + 1] : null;
    $('bSuivant').hidden = !suiv;
    if(suiv){ $('bSuivant').textContent = `${P.debloque ? '🔓 Débloqué : ' : 'Niveau suivant : '}${suiv.nom} ▶`; $('bSuivant').onclick = () => demarrer(suiv.id); }
    $('fTitre').textContent = (P.defi ? '🗓 Défi du jour · ' : '') + (P.reussi ? '✅ Panne réparée, tout communique !' : '🏳 Dépannage abandonné');
    $('fEtoiles').textContent = '★'.repeat(P.etoiles) + '☆'.repeat(3 - P.etoiles);
    $('fTexte').innerHTML = (P.reussi ? `En <b>⏱ ${chrono(P.E.t)}</b>. ` : '') +
      `Une bonne dichotomie : environ <b>${pl(P.E.optimum, 'geste')}</b>. Vous : <b>${pl(P.gestes, 'geste')}</b>${P.faux ? `, dont ${pl(P.faux, 'mauvaise réparation', 'mauvaises réparations')} (comptée${P.faux > 1 ? 's' : ''} triple${P.faux > 1 ? 's' : ''})` : ''}.`;
    $('fStats').innerHTML = `<div><b>${chrono(P.E.t)}</b><small>chrono</small></div><div><b>${P.gestes}</b><small>gestes</small></div><div><b>${P.mesures}</b><small>mesures${P.achats ? ` · ${P.achats} pièce${P.achats > 1 ? 's' : ''} achetée${P.achats > 1 ? 's' : ''}` : ''}</small></div><div><b>${P.faux}</b><small>mauvaise${P.faux > 1 ? 's' : ''} réparation${P.faux > 1 ? 's' : ''}</small></div>`;
    $('fPanne').innerHTML = P.E.pannes.map(p => `<div>${decrire(p)}</div>`).join('');
  }
  $('bVoir').onclick = () => { P.revele = true; P.vue = P.E.pannes.every(p => p.type === 'cableElec' || p.type === 'court') ? 'elec' : 'dia'; majVues(); ecran('eJeu'); panneau(); etat(); };
  $('bRejouer').onclick = () => P.defi ? demarrer(null, true) : demarrer(P.niveau.id);
  $('bMenu').onclick = () => accueil();
  $('bQuitter').onclick = () => {
    if(P.revele || P.fini){ if(P.fini) bilan(); else accueil(); return; }
    if(confirm('Arrêter le dépannage ? La partie comptera comme perdue.')) finir(false);
  };

  /* ---------- l'état et le panneau ---------- */
  function etat(){
    const n = parlent().size;
    $('jChrono').textContent = `⏱ ${chrono(P.E.t)}`;
    $('jGestes').textContent = pl(P.gestes, 'geste');
    $('jMesures').textContent = `💳 ${P.E.stock.modules} · 🧰 ${P.E.stock.kits} 🛒`;
    $('jLampe').classList.toggle('ko', n < NB);
    $('jCompte').textContent = `${n} / ${NB} canons communiquent`;
    $('jSous').textContent = P.revele ? 'Les pannes sont entourées en jaune.' : n < NB ? `${pl(NB - n, 'canon')} hors communication${P.defi ? ' · défi du jour' : ''}` : 'Tout communique : vérifiez que tout est réparé.';
  }
  function bouton(txt, min, fn, cls){ return `<button class="btn ${cls || ''}" data-f="${fn}">${txt}${min ? `<span class="min">${min} min</span>` : ''}</button>`; }
  // une petite explication sous un geste : ce qu'il fait, à quoi il sert
  const exp = t => `<p class="exp">${t}</p>`;
  // les gestes sur une liaison de dialogue (dans la fiche d'un canon ou de la liaison)
  const gestesLiaison = (l, depuis) => {
    const a = depuis ? `~${depuis}` : '';
    return bouton(P.E.debr.has(l.k) ? '🔗 Rebrancher' : '✂ Débrancher', 0, `liaison~${l.k}${a}`, 'act') + bouton('🧰 Refaire', 0, `repLiaison~${l.k}${a}`, 'rep') + bouton('⇆ Inverser A/B', 0, `inverser~${l.k}${a}`, 'rep') + bouton('🛡 Blinder', 0, `blinder~${l.k}${a}`, 'rep');
  };
  const EXP_LIAISON = exp('<b>✂ Débrancher</b> coupe la ligne ici : plus rien ne passe après. Ça sert à couper un tronçon en deux, pour voir de quel côté est le défaut (pensez à rebrancher). <b>🧰 Refaire</b> répare une liaison coupée ou abîmée. <b>⇆ Inverser A/B</b> remet les deux fils dans le bon sens. <b>🛡 Blinder</b> protège une liaison parasitée par un câble de puissance.');
  function panneau(){
    const el = $('panneau'), s = P.sel;
    let h = '';
    if(P.revele){
      h = `<p class="aideJ">Les pannes de cette nuit sont entourées en <b style="color:var(--volt)">jaune</b>.</p><div class="ligneA"><button class="btn gros" data-f="bilan">Bilan ›</button></div>`;
      el.innerHTML = h; brancher(); return;
    }
    if(!s){
      const ouverts = P.E.off.size + P.E.debr.size + P.E.ouv.size + P.E.depOuv.size + P.E.disj.size;
      h = `<p class="aideJ">Touchez un <b>canon</b>, un <b>répétiteur 📶</b>, une <b>liaison</b>${P.vue === 'elec' ? ', un <b>câble électrique</b>' : ''} ou un <b>transfo ⚡</b>, puis choisissez le geste : il se fait tout de suite.</p>`;
      h += `<details class="comment"><summary>💡 Comment chercher ?</summary><ol>
        <li><b>Regardez la carte</b> : les canons rouges ne répondent plus. Le signal part des têtes (cercle blanc) et suit les flèches.</li>
        <li><b>Mesurez aux répétiteurs 📶</b> autour de la zone rouge : entrée et sortie vous disent dans quel <b>tronçon</b> (entre deux répétiteurs) est le défaut.</li>
        <li><b>Mesurez dans le tronçon</b> : là où le signal change (net → absent, faible, illisible, ou le bruit le plus fort), vous y êtes.</li>
        <li>En cas de doute, <b>coupez en deux</b> : débranchez une liaison au milieu, ou excluez un canon, et regardez ce qui revient.</li>
        <li><b>Réparez</b>, puis remettez tout en service.</li></ol></details>`;
      if(ouverts) h += `<div class="ligneA">${bouton(`↺ Tout remettre (${ouverts})`, 0, 'remettre', 'act')}</div>${exp('Referme les interrupteurs, rebranche les liaisons, referme les tronçons et réarme les transfos. Ça ne compte pas comme un geste.')}`;
      h += `<div class="sect">Journal</div><div class="journal">${P.journal.map(j => `<div class="${j.cls || ''}">${j.h}</div>`).join('')}</div>`;
      el.innerHTML = h; brancher(); return;
    }
    const C = S.calculer(P.E);
    if(s.type === 'canon'){
      const id = s.id, c = S.PAR_ID[id], sdm = c.zone === 'SDM', d = P.diag[id], dep = S.ORIGINE[id], repet = S.REPETEURS.has(id);
      h += `<h2>${sdm ? '🏠 ' + esc(c.nom) : `Canon ${esc(c.nom)}`}${repet ? ' 📶' : ''} <small>${sdm ? 'salle des machines' : `${esc(zoneC(id))} · ${MODELES[c.modele] || ''}${dep ? ' · ' + esc(S.D_PAR_ID[dep].nom) : ''}`}${S.TETES.includes(id) ? ' · tête du dialogue' : ''}${repet ? ' · <b style="color:var(--bleu)">répétiteur de signal</b>' : ''}</small></h2>`;
      h += `<div class="mesure">Supervision : ${C.parlent.has(id) || (sdm && C.atteint.has(id)) ? '<b class="ok">communique</b>' : '<b class="ko">ne communique plus</b>'}${P.E.off.has(id) ? ' · <b class="vo">exclu du réseau</b> (interrupteur ouvert)' : ''}` +
        (d ? `<br>Mesuré à ${chrono(d.t)}${d.perime ? ' <b class="vo">(avant vos derniers gestes : à refaire)</b>' : ''} : ${lireMesure(d)}${d.perime ? '' : `<br><i>💡 ${conseil(d)}</i>`}` : '') + '</div>';
      if(repet) h += exp('📶 Ce canon porte un <b>répétiteur</b> : il relit le signal qui arrive (l’entrée) et le renvoie à 100 % (la sortie). Sans courant, en panne, ou si l’entrée est mauvaise, il ne renvoie rien et tout ce qui est après lui se tait.');
      if(!sdm){
        h += `<div class="ligneA">${bouton('🔍 Mesurer le signal', 0, `mesurer~${id}`)}${bouton(P.E.off.has(id) ? '⏺ Remettre sur le réseau' : '⭘ Exclure du réseau', 0, `inter~${id}`, 'act')}</div>`;
        h += exp(`<b>🔍 Mesurer</b> ne change rien : on lit la tension, la force du signal de dialogue (100 % au départ, il s’affaiblit le long du câble), sa qualité${repet ? ', et l’entrée et la sortie du répétiteur' : ''}. <b>⭘ Exclure</b> ouvre l’interrupteur : le canon sort du réseau et ne répond plus, mais <b>la ligne continue de passer</b>. S’il brouillait ou faisait disjoncter, tout revient.`);
      }
      const ls = S.LIAISONS_DE[id] || [];
      if(ls.length){
        h += '<div class="sect">Liaisons de dialogue</div>';
        h += ls.map(l => { const o = l.a === id ? l.b : l.a, sens = S.versDe(l, o) === id ? '← de' : S.versDe(l, id) === o ? '→ vers' : '⇄';
          return `<div class="lien"><span>${sens} ${esc(nomC(o))} <small style="color:var(--doux)">${esc(l.ligne)} · ${Math.round(S.LON[l.k])} m</small>${P.E.debr.has(l.k) ? ' · <b style="color:var(--volt)">débranchée</b>' : ''}</span>${gestesLiaison(l, id)}</div>`; }).join('');
        h += EXP_LIAISON;
      }
      const cs = S.CABLES_DE[id] || [];
      if(cs.length){
        h += '<div class="sect">Câbles électriques</div>';
        h += cs.map(cb => { const o = cb.a === id ? cb.b : cb.a, nomO = o.startsWith('src/') ? S.D_PAR_ID[o.slice(4)].nom : nomC(o), sens = S.versDe(cb, o) === id ? '⚡ de' : '⚡ vers';
          return `<div class="lien"><span>${sens} ${esc(nomO)}${P.E.ouv.has(cb.k) ? ' · <b style="color:var(--volt)">ouvert</b>' : ''}</span>${bouton(P.E.ouv.has(cb.k) ? '⏺ Fermer' : '⭘ Ouvrir', 0, `troncon~${cb.k}~${id}`, 'act')}${bouton('🧰 Refaire', 0, `repCable~${cb.k}~${id}`, 'rep')}</div>`; }).join('');
        h += exp('<b>⭘ Ouvrir</b> un tronçon coupe le courant de tous les canons d’après (pour isoler un court-circuit). <b>🧰 Refaire</b> répare un câble électrique coupé.');
      }
      if(!sdm){
        h += `<div class="sect">Réparer le canon</div><div class="ligneA">${bouton('💳 Changer le module', 0, `module~${id}`, 'rep')}${bouton('🧰 Réparer un court-circuit', 0, `court~${id}`, 'rep')}${repet ? bouton('📶 Changer le répétiteur', 0, `repeteur~${id}`, 'rep') : ''}</div>`;
        h += exp(`<b>💳 Changer le module</b> : pour un canon qui brouille son tronçon, ou une adresse en double. <b>🧰 Court-circuit</b> : pour le canon qui fait disjoncter son transfo.${repet ? ' <b>📶 Changer le répétiteur</b> : s’il a du courant, un bon signal à l’entrée et rien à la sortie.' : ''} Une réparation au mauvais endroit compte pour trois gestes (la pièce, elle, retourne au stock).`);
      }
    } else if(s.type === 'liaison'){
      const l = S.L_PAR_K[s.k];
      h += `<h2>Liaison de dialogue <small>${esc(nomC(l.a))} ${l.d === 'ab' ? '→' : l.d === 'ba' ? '←' : '⇄'} ${esc(nomC(l.b))} · ${esc(l.ligne)} · ${Math.round(S.LON[l.k])} m</small></h2>`;
      h += `<div class="ligneA">${gestesLiaison(l)}</div>${EXP_LIAISON}`;
      h += `<div class="ligneA">${bouton(`Canon ${esc(nomC(l.a))}`, 0, `voirC~${l.a}`)}${bouton(`Canon ${esc(nomC(l.b))}`, 0, `voirC~${l.b}`)}</div>${exp('Pour savoir si le signal passe par cette liaison, mesurez aux deux canons qu’elle relie.')}`;
    } else if(s.type === 'cable'){
      const c = S.C_PAR_K[s.k];
      h += `<h2>Câble électrique <small>${esc(nomLien(c))}</small></h2>`;
      h += `<div class="ligneA">${bouton(P.E.ouv.has(c.k) ? '⏺ Fermer le tronçon' : '⭘ Ouvrir le tronçon', 0, `troncon~${c.k}`, 'act')}${bouton('🧰 Refaire le câble', 0, `repCable~${c.k}`, 'rep')}</div>`;
      h += exp('<b>⭘ Ouvrir</b> coupe le courant de tous les canons d’après ce tronçon : si le transfo tient ensuite au réarmement, le court-circuit est après l’ouverture. <b>🧰 Refaire</b> répare un câble coupé (tension présente d’un côté, absente de l’autre).');
      h += `<div class="ligneA">${[c.a, c.b].filter(x => !x.startsWith('src/')).map(x => bouton(`Canon ${esc(nomC(x))}`, 0, `voirC~${x}`)).join('')}</div>`;
    } else if(s.type === 'achat'){
      h += `<h2>🛒 Acheter des pièces <small>gratuit, livré tout de suite</small></h2>`;
      h += `<div class="mesure">En stock : <b>💳 ${P.E.stock.modules}</b> module${P.E.stock.modules > 1 ? 's' : ''} · <b>🧰 ${P.E.stock.kits}</b> kit${P.E.stock.kits > 1 ? 's' : ''} de réparation${P.achats ? ` · ${pl(P.achats, 'pièce')} achetée${P.achats > 1 ? 's' : ''}` : ''}</div>`;
      h += `<div class="ligneA">${bouton('+1 💳 module', 0, 'acheter~modules', 'act')}${bouton('+1 🧰 kit de réparation', 0, 'acheter~kits', 'act')}</div>`;
      h += `<p class="aideJ">💳 modules : changer le module d'un canon (il brouille, ou son adresse est en double). 🧰 kits : refaire un câble ou une liaison, blinder, réparer un court-circuit, changer un répétiteur. Une pièce n'est utilisée que si la réparation était la bonne.</p>`;
    } else if(s.type === 'transfo'){
      const d = s.id, v = P.vus[d], nb = S.VRAIS.filter(c => S.ORIGINE[c.id] === d).length, reps = [...S.REPETEURS].filter(r => S.ORIGINE[r] === d).map(nomC);
      h += `<h2>⚡ ${esc(S.D_PAR_ID[d].nom)} <small>${pl(nb, 'canon')} alimentés en temps normal${reps.length ? ` · répétiteur${reps.length > 1 ? 's' : ''} ${reps.join(', ')}` : ''}</small></h2>`;
      h += `<div class="mesure">${v ? `Vu à ${chrono(v.t)} : <b class="${v.etat === 'en service' || v.etat === 'réarmé' ? 'ok' : 'ko'}">${v.etat}</b>` : 'État : pas encore vu (allez voir sur place).'}</div>`;
      h += `<div class="ligneA">${bouton('👀 Aller voir', 0, `voir~${d}`)}${bouton('⚡ Réarmer', 0, `rearmer~${d}`, 'act')}${bouton(P.E.depOuv.has(d) ? '⚡ Remettre en service' : '⭘ Couper', 0, P.E.depOuv.has(d) ? `rearmer~${d}` : `couper~${d}`, 'act')}</div>`;
      h += exp(`<b>👀 Aller voir</b> dit s’il est en service ou disjoncté. <b>⚡ Réarmer</b> le remet en route : s’il redisjoncte aussitôt, un court-circuit est encore alimenté. <b>⭘ Couper</b> éteint tous ses canons${reps.length ? ' (et ses répétiteurs : ce qui est après eux se tait aussi)' : ''} : utile pour démasquer un parasite.`);
    }
    h += `<div class="ligneA"><button class="btn" data-f="fermer">✕ Fermer</button></div>`;
    el.innerHTML = h; brancher();
  }
  function brancher(){
    $('panneau').querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      const [f, a, c] = b.dataset.f.split('~');
      if(f === 'fermer'){ P.sel = null; panneau(); dessiner(); return; }
      if(f === 'acheter'){ acheter(a); return; }
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
    const cle = [P.E.t, P.gestes, P.E.off.size, P.E.debr.size, P.E.ouv.size, P.E.depOuv.size, P.E.disj.size, P.E.pannes.filter(p => p.repare).length, P.revele].join();
    if(!P.cacheC || P.cacheC.cle !== cle) P.cacheC = { cle, C:S.calculer(P.E) };
    const C = P.cacheC.C, elec = P.vue === 'elec', r = Math.max(3.2, Math.min(9, V.s * 9)), lbl = V.s > .55;
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
      // un répétiteur : un losange bleu autour du canon
      if(S.REPETEURS.has(c.id)){ const q = r + 5; g.strokeStyle = '#5AA9FF'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - q); g.lineTo(x + q, y); g.lineTo(x, y + q); g.lineTo(x - q, y); g.closePath(); g.stroke(); }
      // le signal mesuré, écrit au-dessus du canon
      if(d && !elec && d.signal != null){
        const txt = d.qualite === 'absent' ? '0 %' : d.qualite === 'brouillé' ? `≈ ${d.bruit} %` : `${d.signal} %`;
        g.font = 'bold 10px system-ui'; g.textAlign = 'center';
        g.fillStyle = d.perime ? '#7D8796' : d.qualite === 'net' ? '#8FF0B8' : d.qualite === 'brouillé' ? '#FFD23F' : '#FF9C9C'; g.fillText(txt, x, y - r - 4);
      }
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
      else if(P.sel.type === 'liaison' || P.sel.type === 'cable'){ g.globalAlpha = .55; g.lineWidth = 8; trait(P.sel.type === 'liaison' ? geomL(S.L_PAR_K[P.sel.k]) : geomC(S.C_PAR_K[P.sel.k])); g.globalAlpha = 1; }
    }
    // les pannes, à la fin
    if(P.revele){
      const pulse = 10 + 4 * Math.sin(performance.now() / 250);
      g.strokeStyle = '#FFD23F'; g.lineWidth = 3;
      P.E.pannes.forEach(p => {
        let pt;
        if(p.canons) return p.canons.forEach(id => { const c = S.PAR_ID[id]; g.beginPath(); g.arc(X(c.x), Y(c.y), r + pulse, 0, 7); g.stroke(); });
        if(p.canon) pt = S.PAR_ID[p.canon];
        else { const elecP = p.type === 'cableElec', e = elecP ? S.C_PAR_K[p.k] : S.L_PAR_K[p.k], gg = elecP ? geomC(e) : geomL(e), m = gg[Math.floor(gg.length / 2)]; pt = { x:m[0], y:m[1] }; g.lineWidth = 6; trait(gg); g.lineWidth = 3; }
        g.beginPath(); g.arc(X(pt.x), Y(pt.y), r + pulse, 0, 7); g.stroke();
      });
      cancelAnimationFrame(anim); anim = requestAnimationFrame(dessiner);
    }
  }
  function majVues(){ $('vDia').setAttribute('aria-pressed', P.vue === 'dia'); $('vElec').setAttribute('aria-pressed', P.vue === 'elec');
    $('legende').innerHTML = P.vue === 'dia' ? '<span><i style="background:#2FD47A"></i>communique</span><span><i style="background:#FF4D4D"></i>ne communique plus</span><span><i style="background:#3A4352"></i>exclu</span><span><i style="background:none;border:2px solid #5AA9FF;border-radius:0;transform:rotate(45deg) scale(.8)"></i>répétiteur</span><span>62 % : signal mesuré · ≈ bruit · gris : à refaire</span>'
      : '<span><i style="background:#2FD47A"></i>tension mesurée</span><span><i style="background:#1A2233;border:2px solid #FFD23F"></i>pas de tension</span><span><i style="background:#55657C"></i>pas mesuré</span><span>tirets : tronçon ouvert</span>'; }
  $('vDia').onclick = () => { P.vue = 'dia'; majVues(); dessiner(); if(!P.sel || P.sel.type === 'cable'){ P.sel = null; panneau(); } };
  $('vElec').onclick = () => { P.vue = 'elec'; majVues(); dessiner(); if(!P.sel) panneau(); };
  const zoomA = (f, cx, cy) => { const s = Math.min(40, Math.max(.05, V.s * f)); f = s / V.s; V.tx = cx - (cx - V.tx) * f; V.ty = cy - (cy - V.ty) * f; V.s = s; redessiner(); };
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
  // un doigt : déplacer ; deux doigts : zoomer (et déplacer en même temps) ; toucher court : choisir
  const pts = new Map(); let geste = null;
  const local = p => { const r = cv.getBoundingClientRect(); return { x:p.x - r.left, y:p.y - r.top }; };
  // (re)commence un geste avec les doigts posés : la carte suit les doigts depuis cet instant
  function nouveauGeste(tap){
    const l = [...pts.values()];
    if(l.length >= 2){
      const a = local(l[0]), b = local(l[1]), m = { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 };
      geste = { pinch:true, d:Math.hypot(a.x - b.x, a.y - b.y) || 1, s:V.s, wx:(m.x - V.tx) / V.s, wy:(m.y - V.ty) / V.s, bouge:true };
    } else if(l.length === 1){ const a = local(l[0]); geste = { pan:true, x:a.x, y:a.y, tx:V.tx, ty:V.ty, bouge:!tap, t:Date.now() }; }
    else geste = null;
  }
  cv.addEventListener('pointerdown', e => { e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(err){} pts.set(e.pointerId, { x:e.clientX, y:e.clientY }); nouveauGeste(pts.size === 1); });
  cv.addEventListener('pointermove', e => {
    if(!pts.has(e.pointerId) || !geste) return; pts.set(e.pointerId, { x:e.clientX, y:e.clientY });
    const l = [...pts.values()];
    if(geste.pinch && l.length >= 2){
      const a = local(l[0]), b = local(l[1]), m = { x:(a.x + b.x) / 2, y:(a.y + b.y) / 2 };
      const s = Math.min(40, Math.max(.05, geste.s * Math.hypot(a.x - b.x, a.y - b.y) / geste.d));
      V.s = s; V.tx = m.x - geste.wx * s; V.ty = m.y - geste.wy * s; redessiner();
    } else if(geste.pan){
      const a = local(l[0]), dx = a.x - geste.x, dy = a.y - geste.y;
      if(Math.hypot(dx, dy) > 8) geste.bouge = true;
      if(geste.bouge){ V.tx = geste.tx + dx; V.ty = geste.ty + dy; redessiner(); }
    }
  });
  const fin = e => {
    if(!pts.has(e.pointerId)) return;
    const tap = geste && geste.pan && !geste.bouge && e.type === 'pointerup' && Date.now() - geste.t < 600;
    pts.delete(e.pointerId);
    if(tap){ const p = local({ x:e.clientX, y:e.clientY }); toucher(p.x, p.y); }
    nouveauGeste(false);                          // le doigt qui reste continue de déplacer la carte, sans sauter
  };
  cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin); cv.addEventListener('lostpointercapture', fin);
  // pendant un geste, on redessine au plus une fois par image
  let aDessiner = false;
  function redessiner(){ if(aDessiner) return; aDessiner = true; requestAnimationFrame(() => { aDessiner = false; dessiner(); }); }
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomA(Math.exp(-e.deltaY * .0015), e.clientX - r.left, e.clientY - r.top); }, { passive:false });
  // la carte change de taille (panneau, rotation) : on garde le même centre
  let cadre = false;
  new ResizeObserver(() => {
    if(!P || !$('eJeu') || $('eJeu').hidden) return;
    const w0 = W, h0 = H; taille();
    if(!cadre || !w0) return ajuster();
    V.tx += (W - w0) / 2; V.ty += (H - h0) / 2; dessiner();
  }).observe($('carteBox'));

  $('jMesures').onclick = () => { if(!P || P.fini || P.revele) return; P.sel = { type:'achat' }; panneau(); dessiner(); $('panneau').scrollTop = 0; };

  /* ---------- démarrage ---------- */
  window.Panne = { get P(){ return P; }, vue:() => ({ ...V }), demarrer, G, accueil, toucher, S, chrono, choisir:o => { P.sel = o; panneau(); dessiner(); } };
  if(/[?&]test\b/.test(location.search)){ document.body.innerHTML = `<pre style="padding:16px;color:#EAF1FB;white-space:pre-wrap">${S.tests().join('\n')}</pre>`; return; }
  accueil();
  if('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('../sw.js').catch(() => {}));
  if('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if(!window.ddRecharge){ window.ddRecharge = true; location.reload(); } });
})();
