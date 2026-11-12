/* Altitude Arcade — Recherche de panne : la simulation (aucun dessin ici).
   Le réseau (reseau.js) : des canons reliés par des liaisons de dialogue (avec un sens : le dialogue part des canons de tête
   et passe de canon en canon), et par des câbles électriques qui partent des transfos.
   - Un canon « vit » s'il n'est pas coupé (interrupteur fermé) et s'il a du courant. Un canon qui ne vit pas bloque le dialogue.
   - Les pannes cachées : canon contaminant (il brouille toute sa ligne, ou ce qui est après lui ; parfois par intermittence),
     court-circuit (le transfo disjoncte, et redisjoncte au réarmement tant que le canon fautif est alimenté),
     câble électrique coupé, câble de dialogue coupé.
   - Le joueur ouvre / ferme des interrupteurs, débranche des liaisons, ouvre des tronçons de câble électrique, coupe ou réarme
     les transfos, mesure sur place et répare. Window.PanneSim expose tout pour le jeu et pour les tests (PanneSim.tests()). */
(() => {
  'use strict';
  const R = window.RESEAU_PANNE;
  const ek = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const CANONS = R.canons, PAR_ID = Object.fromEntries(CANONS.map(c => [c.id, c]));
  const VRAIS = CANONS.filter(c => c.zone !== 'SDM');                 // les canons (sans les salles des machines)
  const LIAISONS = R.liaisons.map(([a, b, d, ligne]) => ({ k:ek(a, b), a, b, d, ligne:ligne || '' }));
  const CABLES = R.cables.map(([a, b, d]) => ({ k:ek(a, b), a, b, d }));
  const L_PAR_K = Object.fromEntries(LIAISONS.map(l => [l.k, l])), C_PAR_K = Object.fromEntries(CABLES.map(c => [c.k, c]));
  const DEPARTS = R.departs, D_PAR_ID = Object.fromEntries(DEPARTS.map(d => [d.id, d]));
  const TETES = R.tetes, REPETEURS = new Set(R.repeteurs || []);
  const CABLES_DE = {}, LIAISONS_DE = {};
  CABLES.forEach(c => { (CABLES_DE[c.a] = CABLES_DE[c.a] || []).push(c); (CABLES_DE[c.b] = CABLES_DE[c.b] || []).push(c); });
  LIAISONS.forEach(l => { (LIAISONS_DE[l.a] = LIAISONS_DE[l.a] || []).push(l); (LIAISONS_DE[l.b] = LIAISONS_DE[l.b] || []).push(l); });
  const CABLES_SANS = new Set(CABLES.flatMap(c => [c.a, c.b]));          // les canons qui ont un câble électrique
  // sens : de qui vers qui passent le dialogue ou le courant
  const versDe = (e, x) => e.a === x ? (e.d !== 'ba' ? e.b : null) : (e.d !== 'ab' ? e.a : null);
  const LIGNES_DE = id => new Set((LIAISONS_DE[id] || []).map(l => l.ligne));

  /* ---------- hasard reproductible ---------- */
  function alea(graine){ let s = graine >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- l'état d'une partie ---------- */
  function nouvelEtat(){
    return { off:new Set(), debr:new Set(), ouv:new Set(), depOuv:new Set(), disj:new Set(), pannes:[], t:0 };
  }
  const enPanne = (E, type, cle) => E.pannes.some(p => !p.repare && p.type === type && (p.k === cle || p.canon === cle));

  // une panne intermittente : un horaire de marche / arrêt tiré au hasard (en secondes depuis le début de la partie)
  function horaire(graine){
    const r = alea(graine), h = []; let t = 0, on = true;
    while(t < 7200){ const d = on ? 20 + Math.floor(r() * 40) : 8 + Math.floor(r() * 18); h.push([t, t + d, on]); t += d; on = !on; }
    return h;
  }
  const actif = (p, t) => { if(!p.intermittent) return true; const s = p.horaire.find(x => t >= x[0] && t < x[1]); return s ? s[2] : true; };

  /* ---------- le courant ---------- */
  function courant(E){
    const adj = {};
    for(const c of CABLES){
      if(E.ouv.has(c.k) || enPanne(E, 'cableElec', c.k)) continue;
      if(c.d !== 'ba') (adj[c.a] = adj[c.a] || []).push(c.b);
      if(c.d !== 'ab') (adj[c.b] = adj[c.b] || []).push(c.a);
    }
    const de = {};
    for(const d of DEPARTS){
      if(E.depOuv.has(d.id) || E.disj.has(d.id)) continue;
      const s = 'src/' + d.id, vu = new Set([s]), pile = [s];
      while(pile.length){ const x = pile.pop(); for(const y of adj[x] || []) if(!vu.has(y)){ vu.add(y); pile.push(y); if(!de[y]) de[y] = d.id; } }
    }
    return de;
  }
  // le transfo d'où vient normalement le courant d'un canon (tout fermé, rien en panne)
  const ORIGINE = courant(nouvelEtat());
  // Les courts-circuits : un canon en court-circuit qui reçoit du courant (interrupteur fermé) fait disjoncter son transfo
  function stabiliser(E){
    const evts = [];
    for(let n = 0; n < 10; n++){
      const de = courant(E); let change = false;
      for(const p of E.pannes) if(p.type === 'court' && !p.repare && de[p.canon] && !E.off.has(p.canon)){ E.disj.add(de[p.canon]); evts.push(de[p.canon]); change = true; }
      if(!change) break;
    }
    return evts;
  }

  /* ---------- le dialogue ---------- */
  function calculer(E){
    const de = courant(E);
    const alim = id => !CABLES_SANS.has(id) || !!de[id];
    const vit = id => !E.off.has(id) && alim(id);
    // une liaison illisible : paire A/B inversée, ou parasitée par le câble de puissance d'un transfo en service
    const transfoEnService = d => !E.depOuv.has(d) && !E.disj.has(d);
    const illisible = l => E.pannes.some(p => !p.repare && p.k === l.k && (p.type === 'paire' || (p.type === 'parasite' && transfoEnService(p.transfo))));
    const usable = l => !E.debr.has(l.k) && !enPanne(E, 'cableDia', l.k) && !illisible(l);
    // un canon passe-plat cassé : il répond, mais ne relaie plus le dialogue
    const muet = id => E.pannes.some(p => !p.repare && p.type === 'passeplat' && p.canon === id);
    // les canons brouillés : par un canon contaminant, ou par deux canons à la même adresse (tous deux sous tension)
    const brouille = new Set();
    const brouillerLigne = c => {
      const lignes = LIGNES_DE(c), vu = new Set([c]), pile = [c];
      while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ if(!usable(l) || !lignes.has(l.ligne)) continue; const y = l.a === x ? l.b : l.a; if(!vu.has(y) && vit(y)){ vu.add(y); pile.push(y); } } }
      vu.forEach(x => brouille.add(x));
    };
    for(const p of E.pannes) if(p.type === 'adresse' && !p.repare && p.canons.every(vit)) p.canons.forEach(brouillerLigne);
    for(const p of E.pannes){
      if(p.type !== 'contaminant' || p.repare || !vit(p.canon) || !actif(p, E.t)) continue;
      if(p.portee === 'ligne') brouillerLigne(p.canon);
      else {
        const vu = new Set([p.canon]), pile = [p.canon];
        while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ if(!usable(l)) continue; const y = versDe(l, x); if(y && !vu.has(y) && vit(y)){ vu.add(y); brouille.add(y); pile.push(y); } } }
      }
    }
    const passe = id => (vit(id) || (!E.off.has(id) && REPETEURS.has(id))) && !brouille.has(id);
    const atteint = new Set(), pile = TETES.filter(passe);
    pile.forEach(h => atteint.add(h));
    while(pile.length){ const x = pile.pop(); if(muet(x)) continue; for(const l of LIAISONS_DE[x] || []){ if(!usable(l)) continue; const y = versDe(l, x); if(y && !atteint.has(y) && passe(y)){ atteint.add(y); pile.push(y); } } }
    const parlent = new Set(VRAIS.filter(c => atteint.has(c.id) && vit(c.id)).map(c => c.id));
    return { de, alim, vit, brouille, atteint, parlent, usable, illisible, muet };
  }

  // Ce qu'on voit sur place, au canon
  function diagnostic(E, id){
    const C = calculer(E), c = PAR_ID[id];
    const tension = !CABLES_SANS.has(id) ? 'sans câble' : C.de[id] ? 'présente' : 'absente';
    let dialogue;
    if(E.off.has(id)) dialogue = 'éteint (interrupteur ouvert)';
    else if(!C.alim(id)) dialogue = 'éteint (pas de courant)';
    else if(C.parlent.has(id) || (c.zone === 'SDM' && C.atteint.has(id))) dialogue = 'communique';
    else if(C.brouille.has(id)) dialogue = 'trames brouillées';
    else {
      // reçoit-il quelque chose de son amont ?
      const amont = (LIAISONS_DE[id] || []).filter(l => versDe(l, l.a === id ? l.b : l.a) === id), emet = l => { const o = l.a === id ? l.b : l.a; return C.atteint.has(o) && !C.muet(o) && !E.debr.has(l.k) && !enPanne(E, 'cableDia', l.k); };
      dialogue = amont.some(l => emet(l) && C.usable(l)) ? 'reçoit, mais ne répond pas' : amont.some(l => emet(l) && C.illisible(l)) ? 'reçoit des trames illisibles' : 'ne reçoit rien';
    }
    // vers les suivants : un canon qui communique relaie-t-il le dialogue ?
    const suivants = (LIAISONS_DE[id] || []).some(l => versDe(l, id));
    const relais = !suivants || !C.atteint.has(id) ? null : C.muet(id) ? 'n’émet rien vers les suivants' : 'émet vers les suivants';
    return { tension, dialogue, relais, interrupteur:E.off.has(id) ? 'ouvert' : 'fermé', transfo:ORIGINE[id] ? D_PAR_ID[ORIGINE[id]].nom : null };
  }

  /* ---------- tirer une panne au hasard ---------- */
  // en aval d'un canon (dans le sens du dialogue)
  function aval(id){ const vu = new Set([id]), pile = [id]; while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ const y = versDe(l, x); if(y && !vu.has(y)){ vu.add(y); pile.push(y); } } } vu.delete(id); return vu; }
  const log2 = n => Math.ceil(Math.log2(Math.max(1, n)));
  const posDe = id => id.startsWith('src/') ? D_PAR_ID[id.slice(4)] : PAR_ID[id];
  // la distance d'un point aux câbles électriques d'un transfo (les câbles longent souvent les liaisons de dialogue)
  function distTransfo(d, m){
    let best = Infinity;
    for(const c of CABLES){
      const x = c.a.startsWith('src/') ? c.b : c.a; if(ORIGINE[x] !== d && c.a !== 'src/' + d && c.b !== 'src/' + d) continue;
      const g = (R.geomCables || {})[c.k] || [[posDe(c.a).x, posDe(c.a).y], [posDe(c.b).x, posDe(c.b).y]];
      for(const p of g) best = Math.min(best, Math.hypot(p[0] - m[0], p[1] - m[1]));
    }
    return best;
  }
  const TYPES = {
    dialogue:{ nom:'Câble de dialogue coupé', ico:'✂️' },
    aval:{ nom:'Canon contaminant (après lui)', ico:'📡' },
    ligne:{ nom:'Canon contaminant (toute sa ligne)', ico:'📡' },
    elec:{ nom:'Câble électrique coupé', ico:'🔌' },
    court:{ nom:'Court-circuit', ico:'⚡' },
    intermittent:{ nom:'Contaminant intermittent', ico:'〰️' },
    adresse:{ nom:'Adresse en double', ico:'🔢' },
    paire:{ nom:'Paire A/B inversée', ico:'⇆' },
    parasite:{ nom:'Câble de puissance voisin', ico:'🛡' },
    passeplat:{ nom:'Canon passe-plat cassé', ico:'🚧' },
    cachee:{ nom:'Panne cachée derrière une autre', ico:'🫥' },
  };
  function tirerPanne(type, r, deja){
    const pris = new Set(deja.flatMap(p => p.canons || [p.canon || p.k]));
    const choisir = l => { l = l.filter(x => !pris.has(x.canon || x.k)); return l.length ? l[Math.floor(r() * l.length)] : null; };
    if(type === 'dialogue'){
      const l = choisir(LIAISONS.filter(l => { const y = l.d === 'ab' ? l.b : l.d === 'ba' ? l.a : null; return y && aval(y).size >= 2 && PAR_ID[y].zone !== 'SDM'; }).map(l => ({ k:l.k })));
      return l && { type:'cableDia', k:l.k };
    }
    if(type === 'aval'){
      const c = choisir(VRAIS.filter(c => aval(c.id).size >= 3).map(c => ({ canon:c.id })));
      return c && { type:'contaminant', portee:'aval', canon:c.canon };
    }
    if(type === 'ligne' || type === 'intermittent'){
      const c = choisir(VRAIS.filter(c => { const E = nouvelEtat(); E.pannes = [{ type:'contaminant', portee:'ligne', canon:c.id }]; return calculer(E).brouille.size >= 6; }).map(c => ({ canon:c.id })));
      if(!c) return null;
      const p = { type:'contaminant', portee:'ligne', canon:c.canon };
      if(type === 'intermittent'){ p.intermittent = true; p.horaire = horaire(Math.floor(r() * 1e9)); }
      return p;
    }
    if(type === 'elec'){
      const c = choisir(CABLES.filter(c => { const E = nouvelEtat(); E.pannes = [{ type:'cableElec', k:c.k }]; const C = calculer(E); return VRAIS.filter(v => CABLES_SANS.has(v.id) && !C.de[v.id]).length >= 4; }).map(c => ({ k:c.k })));
      return c && { type:'cableElec', k:c.k };
    }
    // une liaison qui alimente au moins n canons après elle
    const liaisonsAvec = n => LIAISONS.filter(l => { const y = l.d === 'ab' ? l.b : l.d === 'ba' ? l.a : null; return y && PAR_ID[y].zone !== 'SDM' && aval(y).size >= n; });
    // une panne qui fait vraiment tomber au moins 4 canons (le dialogue n'arrive pas par un autre chemin)
    const visible = p => { const E = nouvelEtat(); E.pannes = [p]; return calculer(E).parlent.size <= VRAIS.length - 4; };
    if(type === 'paire'){ const l = choisir(liaisonsAvec(6).filter(l => visible({ type:'paire', k:l.k })).map(l => ({ k:l.k }))); return l && { type:'paire', k:l.k }; }
    if(type === 'parasite'){
      // un transfo dont le courant ne fait pas vivre les canons d'après la liaison : le couper fait revenir le dialogue
      const essais = liaisonsAvec(6).map(l => ({ k:l.k })).sort(() => r() - .5);
      for(const e of essais){
        if(pris.has(e.k)) continue;
        const l = L_PAR_K[e.k], y = l.d === 'ab' ? l.b : l.a, apres = [y, ...aval(y)];
        const m = [(posDe(l.a).x + posDe(l.b).x) / 2, (posDe(l.a).y + posDe(l.b).y) / 2];
        const proches = DEPARTS.slice().sort((a, b) => distTransfo(a.id, m) - distTransfo(b.id, m));
        for(const d of proches.slice(0, 3)){
          if(apres.some(x => ORIGINE[x] === d.id)) continue;
          const E = nouvelEtat(); E.pannes = [{ type:'parasite', k:e.k, transfo:d.id }];
          const avant = calculer(E).parlent.size; E.depOuv.add(d.id); const C = calculer(E);
          if(apres.filter(x => C.parlent.has(x)).length >= 3 && avant < VRAIS.length) return { type:'parasite', k:e.k, transfo:d.id };
        }
      }
      return null;
    }
    if(type === 'passeplat'){ const c = choisir(VRAIS.filter(c => aval(c.id).size >= 6 && visible({ type:'passeplat', canon:c.id })).map(c => ({ canon:c.id }))); return c && { type:'passeplat', canon:c.canon }; }
    if(type === 'adresse'){
      const taille = id => { const E = nouvelEtat(); E.pannes = [{ type:'contaminant', portee:'ligne', canon:id }]; return calculer(E).brouille.size; };
      const l = VRAIS.filter(c => !pris.has(c.id) && taille(c.id) >= 4);
      for(let n = 0; n < 60; n++){
        const a = l[Math.floor(r() * l.length)], b = l[Math.floor(r() * l.length)];
        if(a && b && a !== b && ![...LIGNES_DE(a.id)].some(x => LIGNES_DE(b.id).has(x))) return { type:'adresse', canons:[a.id, b.id] };
      }
      return null;
    }
    if(type === 'cachee'){
      // une première panne qui coupe beaucoup de canons, et une deuxième plus loin derrière elle
      const sortes = ['dialogue', 'passeplat', 'paire'];
      for(let n = 0; n < 40; n++){
        const p1 = tirerPanne(sortes[Math.floor(r() * 3)], r, deja); if(!p1) continue;
        const ici = p1.canon || (L_PAR_K[p1.k].d === 'ab' ? L_PAR_K[p1.k].b : L_PAR_K[p1.k].a), loin = aval(ici);
        if(loin.size < 8) continue;
        const cand = LIAISONS.filter(l => { const y = l.d === 'ab' ? l.b : l.d === 'ba' ? l.a : null; const x = y === l.b ? l.a : l.b; return y && loin.has(x) && x !== ici && aval(y).size >= 2; });
        if(!cand.length) continue;
        const l2 = cand[Math.floor(r() * cand.length)], s2 = sortes[Math.floor(r() * 3)];
        const x2 = l2.d === 'ab' ? l2.a : l2.b;
        const p2 = s2 === 'passeplat' ? { type:'passeplat', canon:x2 } : { type:s2 === 'paire' ? 'paire' : 'cableDia', k:l2.k };
        if(p2.canon === p1.canon || p2.k === p1.k) continue;
        p1.genre = p1.type === 'cableDia' ? 'dialogue' : p1.type; p2.genre = p2.type === 'cableDia' ? 'dialogue' : p2.type; p2.cachee = true;
        return [p1, p2];
      }
      return null;
    }
    if(type === 'court'){
      const c = choisir(VRAIS.filter(c => ORIGINE[c.id]).map(c => ({ canon:c.id })));
      return c && { type:'court', canon:c.canon };
    }
    return null;
  }
  // Le nombre de gestes d'une bonne dichotomie (pour les étoiles), calculé au départ
  function optimum(p){
    const E = nouvelEtat(); E.pannes = [p]; stabiliser(E); const C = calculer(E);
    if(p.type === 'cableDia') return 2;                                        // une mesure, la réparation
    if(p.type === 'contaminant' && p.portee === 'aval') return 2;
    if(p.type === 'contaminant') return log2(C.brouille.size) + 1 + (p.intermittent ? 1 : 0);
    if(p.type === 'cableElec') return log2(VRAIS.filter(v => CABLES_SANS.has(v.id) && !C.de[v.id]).length + 1) + 1;
    if(p.type === 'court'){ const d = ORIGINE[p.canon]; return 1 + log2(VRAIS.filter(v => ORIGINE[v.id] === d).length) + 1; }
    if(p.type === 'adresse') return log2(C.brouille.size) + 2;
    if(p.type === 'paire') return 3;                                          // la mesure, un essai (couper un transfo), l'inversion
    if(p.type === 'parasite') return 4;                                       // la mesure, couper le transfo, le remettre, blinder
    if(p.type === 'passeplat') return 3;                                      // deux mesures, la carte
    return 2;
  }

  // Les niveaux
  const SOURNOISES = ['adresse', 'paire', 'parasite', 'passeplat', 'cachee', 'ligne'];
  // Le parcours : de la panne la plus simple à la plus sournoise ; chaque niveau se débloque en réussissant le précédent
  const PALIERS = { debutant:'Débutant', confirme:'Confirmé', sournois:'Sournois', expert:'Expert' };
  const NIVEAUX = [
    { id:'dialogue', palier:'debutant', nom:'La liaison arrachée', texte:'Une liaison de dialogue a été coupée (une dameuse, un rongeur…). Trouvez-la et réparez-la.', types:['dialogue'] },
    { id:'aval', palier:'debutant', nom:'Le bavard', texte:'Un canon brouille le dialogue de tous ceux qui sont après lui. Lui semble aller bien…', types:['aval'] },
    { id:'elec', palier:'debutant', nom:'Le câble électrique', texte:'Un câble électrique est coupé : les canons d’après n’ont plus de courant, et bloquent le dialogue. Mesurez la tension pour trouver où.', types:['elec'] },
    { id:'ligne', palier:'confirme', nom:'La ligne brouillée', texte:'Un canon contaminant brouille toute sa ligne, avant et après lui. Coupez au milieu, regardez ce qui revient : la dichotomie.', types:['ligne'] },
    { id:'court', palier:'confirme', nom:'Le transfo qui saute', texte:'Un canon en court-circuit fait disjoncter son transfo, qui redisjoncte au réarmement. Ouvrez des tronçons de câble pour l’isoler.', types:['court'] },
    { id:'passeplat', palier:'confirme', nom:'Le passe-plat', texte:'Un canon répond très bien… mais ne relaie plus le dialogue aux suivants. On dirait une liaison coupée.', types:['passeplat'] },
    { id:'paire', palier:'confirme', nom:'Paire inversée', texte:'Après une intervention, les fils A et B d’une liaison ont été inversés. Il y a du courant, des trames… illisibles.', types:['paire'] },
    { id:'intermittent', palier:'confirme', nom:'La panne fantôme', texte:'Un canon contaminant qui brouille sa ligne… de temps en temps : la supervision bouge toute seule. Observez bien avant de conclure.', types:['intermittent'] },
    { id:'parasite', palier:'sournois', nom:'Le câble voisin', texte:'Une liaison de dialogue longe un câble de puissance : elle est parasitée tant que ce transfo est en service.', types:['parasite'] },
    { id:'cachee', palier:'sournois', nom:'Panne cachée', texte:'Une panne en cache une autre, plus loin sur la même ligne : réparer la première ne fait pas tout revenir.', types:['cachee'] },
    { id:'adresse', palier:'sournois', nom:'Adresse en double', texte:'Deux canons ont la même adresse : sous tension tous les deux, ils brouillent chacun leur ligne. Couper l’un ou l’autre fait tout revenir…', types:['adresse'] },
    { id:'double', palier:'sournois', nom:'Double peine', texte:'Deux pannes en même temps, de deux sortes différentes.', types:['double'] },
    { id:'mystere', palier:'sournois', nom:'Panne mystère', texte:'Une panne au hasard parmi toutes les sortes. À vous de deviner laquelle.', types:['mystere'] },
    { id:'expert2', palier:'expert', nom:'Expert : deux sournoises', texte:'Deux pannes sournoises en même temps, peu de pièces de rechange.', types:['expert2'] },
    { id:'expert3', palier:'expert', nom:'Expert : trois sournoises', texte:'Trois pannes sournoises en même temps. Pour les dépanneurs chevronnés.', types:['expert3'] },
  ];
  function nouvellePartie(niveauId, graine){
    graine = graine || Math.floor(Math.random() * 1e9);
    const r = alea(graine), niv = NIVEAUX.find(n => n.id === niveauId) || NIVEAUX[0], E = nouvelEtat();
    let types = niv.types;
    if(types[0] === 'double'){ const l = ['ligne', 'elec', 'dialogue', 'court', 'aval']; const a = l.splice(Math.floor(r() * l.length), 1)[0]; types = [a, l[Math.floor(r() * l.length)]]; }
    if(types[0] === 'mystere') types = [['dialogue', 'aval', 'ligne', 'elec', 'court', 'intermittent'][Math.floor(r() * 6)]];
    if(types[0] === 'expert2' || types[0] === 'expert3'){ const l = SOURNOISES.slice(), n = types[0] === 'expert3' ? 3 : 2; types = []; while(types.length < n) types.push(l.splice(Math.floor(r() * l.length), 1)[0]); }
    for(const t of types){ const p = tirerPanne(t, r, E.pannes); if(Array.isArray(p)) E.pannes.push(...p); else if(p){ p.genre = t; E.pannes.push(p); } }
    E.optimum = E.pannes.reduce((s, p) => s + optimum(p), 0);
    // le stock de pièces : les cartes qu'il faut plus une de secours, et 3 kits de réparation
    E.stock = { cartes:1 + E.pannes.filter(p => p.type === 'contaminant' || p.type === 'passeplat').length, kits:Math.max(3, E.pannes.filter(p => ['cableDia', 'cableElec', 'court', 'parasite'].includes(p.type)).length) };
    stabiliser(E);
    return { E, niveau:niv, graine, types };
  }

  // Le défi du jour : la même panne pour tout le monde ce jour-là (la sorte et la panne viennent de la date)
  const SORTES_DEFI = ['ligne', 'paire', 'elec', 'passeplat', 'court', 'adresse', 'aval', 'parasite', 'intermittent', 'cachee', 'dialogue', 'double', 'expert2'];
  function defiDuJour(date){
    date = date || new Date();
    const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const jour = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 864e5);
    const P = nouvellePartie(SORTES_DEFI[jour % SORTES_DEFI.length], (Math.imul(jour, 2654435761) >>> 0) % 1e9 + 1);
    P.defi = cle; return P;
  }

  // Tout est réparé et tout communique ?
  const toutVa = E => E.pannes.every(p => p.repare) && calculer(E).parlent.size === VRAIS.length;

  /* ---------- vérifications (index : panne.html?test) ---------- */
  function tests(){
    const res = [], ok = (c, t) => res.push((c ? '✅ ' : '❌ ') + t);
    const E0 = nouvelEtat(), C0 = calculer(E0);
    ok(C0.parlent.size === VRAIS.length, `réseau normal : ${C0.parlent.size} / ${VRAIS.length} canons communiquent`);
    ok(Object.keys(ORIGINE).length >= 190, `courant normal : ${Object.keys(ORIGINE).length} canons alimentés`);
    for(const n of NIVEAUX) for(let s = 1; s <= 12; s++){
      const P = nouvellePartie(n.id, s * 7919), C = calculer(P.E);
      if(!P.E.pannes.length || (C.parlent.size >= VRAIS.length && !P.E.pannes.some(p => p.intermittent))){ ok(false, `${n.id} #${s} : la panne ne se voit pas (${C.parlent.size})`); continue; }
      // réparer et tout remettre doit tout faire revenir
      P.E.pannes.forEach(p => p.repare = true); P.E.disj.clear(); stabiliser(P.E);
      if(calculer(P.E).parlent.size !== VRAIS.length) ok(false, `${n.id} #${s} : réparé mais pas tout revenu`);
    }
    ok(res.filter(r => r.startsWith('❌')).length === 0, `les ${NIVEAUX.length * 12} pannes tirées se voient et se réparent`);
    // dichotomie sur une ligne brouillée : ouvrir le canon contaminant fait revenir ceux d'avant
    const P = nouvellePartie('ligne', 12345), c = P.E.pannes[0].canon, avant = calculer(P.E).parlent.size;
    P.E.off.add(c); const apres = calculer(P.E).parlent.size;
    ok(apres > avant, `ligne brouillée : couper le canon fautif fait revenir des canons (${avant} → ${apres})`);
    // court-circuit : réarmer redisjoncte, sauf si le canon est coupé
    const Q = nouvellePartie('court', 4242), d = ORIGINE[Q.E.pannes[0].canon];
    ok(Q.E.disj.has(d), 'court-circuit : le transfo a disjoncté');
    Q.E.disj.delete(d); stabiliser(Q.E); ok(Q.E.disj.has(d), 'court-circuit : il redisjoncte au réarmement');
    Q.E.off.add(Q.E.pannes[0].canon); Q.E.disj.delete(d); stabiliser(Q.E); ok(!Q.E.disj.has(d), 'court-circuit : canon coupé, le réarmement tient');
    // les pannes sournoises
    const A = nouvellePartie('adresse', 777), [a1, a2] = A.E.pannes[0].canons, nA = calculer(A.E).parlent.size;
    A.E.off.add(a1); const nA1 = calculer(A.E).parlent.size; A.E.off.delete(a1); A.E.off.add(a2);
    ok(nA1 > nA && calculer(A.E).parlent.size > nA, `adresse en double : couper l'un ou l'autre fait revenir des canons (${nA} → ${nA1})`);
    const B = nouvellePartie('paire', 778), lb = L_PAR_K[B.E.pannes[0].k], yb = lb.d === 'ab' ? lb.b : lb.a;
    ok(diagnostic(B.E, yb).dialogue === 'reçoit des trames illisibles', 'paire inversée : le canon d’après reçoit des trames illisibles');
    const Cp = nouvellePartie('parasite', 779), pc = Cp.E.pannes[0], lc = L_PAR_K[pc.k], yc = lc.d === 'ab' ? lc.b : lc.a;
    ok(diagnostic(Cp.E, yc).dialogue === 'reçoit des trames illisibles', 'câble voisin : trames illisibles aussi');
    Cp.E.depOuv.add(pc.transfo); ok(calculer(Cp.E).parlent.has(yc), 'câble voisin : couper le transfo fait revenir la liaison');
    const Dp = nouvellePartie('passeplat', 780), xd = Dp.E.pannes[0].canon, Cd = calculer(Dp.E);
    ok(Cd.parlent.has(xd) && diagnostic(Dp.E, xd).relais === 'n’émet rien vers les suivants', 'passe-plat : il communique mais n’émet rien vers les suivants');
    const Hc = nouvellePartie('cachee', 781); Hc.E.pannes[0].repare = true;
    ok(Hc.E.pannes.length === 2 && calculer(Hc.E).parlent.size < VRAIS.length, 'panne cachée : réparer la première ne fait pas tout revenir');
    return res;
  }

  window.PanneSim = { R, ek, CANONS, PAR_ID, VRAIS, LIAISONS, CABLES, L_PAR_K, C_PAR_K, DEPARTS, D_PAR_ID, TETES, LIAISONS_DE, CABLES_DE, ORIGINE, TYPES, NIVEAUX, PALIERS,
    nouvelEtat, courant, stabiliser, calculer, diagnostic, actif, nouvellePartie, defiDuJour, toutVa, optimum, versDe, tests };
})();
