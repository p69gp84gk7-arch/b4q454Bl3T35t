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
    const usable = l => !E.debr.has(l.k) && !enPanne(E, 'cableDia', l.k);
    // les canons brouillés par un canon contaminant
    const brouille = new Set();
    for(const p of E.pannes){
      if(p.type !== 'contaminant' || p.repare || !vit(p.canon) || !actif(p, E.t)) continue;
      if(p.portee === 'ligne'){
        const lignes = LIGNES_DE(p.canon), vu = new Set([p.canon]), pile = [p.canon];
        while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ if(!usable(l) || !lignes.has(l.ligne)) continue; const y = l.a === x ? l.b : l.a; if(!vu.has(y) && vit(y)){ vu.add(y); pile.push(y); } } }
        vu.forEach(x => brouille.add(x));
      } else {
        const vu = new Set([p.canon]), pile = [p.canon];
        while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ if(!usable(l)) continue; const y = versDe(l, x); if(y && !vu.has(y) && vit(y)){ vu.add(y); brouille.add(y); pile.push(y); } } }
      }
    }
    const passe = id => (vit(id) || (!E.off.has(id) && REPETEURS.has(id))) && !brouille.has(id);
    const atteint = new Set(), pile = TETES.filter(passe);
    pile.forEach(h => atteint.add(h));
    while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ if(!usable(l)) continue; const y = versDe(l, x); if(y && !atteint.has(y) && passe(y)){ atteint.add(y); pile.push(y); } } }
    const parlent = new Set(VRAIS.filter(c => atteint.has(c.id) && vit(c.id)).map(c => c.id));
    return { de, alim, vit, brouille, atteint, parlent, usable };
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
      const amont = (LIAISONS_DE[id] || []).filter(l => versDe(l, l.a === id ? l.b : l.a) === id);
      const recoit = amont.some(l => C.usable(l) && C.atteint.has(l.a === id ? l.b : l.a));
      dialogue = recoit ? 'reçoit, mais ne répond pas' : 'ne reçoit rien';
    }
    return { tension, dialogue, interrupteur:E.off.has(id) ? 'ouvert' : 'fermé', transfo:ORIGINE[id] ? D_PAR_ID[ORIGINE[id]].nom : null };
  }

  /* ---------- tirer une panne au hasard ---------- */
  // en aval d'un canon (dans le sens du dialogue)
  function aval(id){ const vu = new Set([id]), pile = [id]; while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ const y = versDe(l, x); if(y && !vu.has(y)){ vu.add(y); pile.push(y); } } } vu.delete(id); return vu; }
  const log2 = n => Math.ceil(Math.log2(Math.max(1, n)));
  const TYPES = {
    dialogue:{ nom:'Câble de dialogue coupé', ico:'✂️' },
    aval:{ nom:'Canon contaminant (après lui)', ico:'📡' },
    ligne:{ nom:'Canon contaminant (toute sa ligne)', ico:'📡' },
    elec:{ nom:'Câble électrique coupé', ico:'🔌' },
    court:{ nom:'Court-circuit', ico:'⚡' },
    intermittent:{ nom:'Contaminant intermittent', ico:'〰️' },
  };
  function tirerPanne(type, r, deja){
    const pris = new Set(deja.map(p => p.canon || p.k));
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
    return 2;
  }

  // Les niveaux
  const NIVEAUX = [
    { id:'dialogue', nom:'La liaison arrachée', texte:'Une liaison de dialogue a été coupée (une dameuse, un rongeur…). Trouvez-la et réparez-la.', types:['dialogue'] },
    { id:'aval', nom:'Le bavard', texte:'Un canon brouille le dialogue de tous ceux qui sont après lui. Lui semble aller bien…', types:['aval'] },
    { id:'ligne', nom:'La ligne brouillée', texte:'Un canon contaminant brouille toute sa ligne, avant et après lui. Coupez au milieu, regardez ce qui revient : la dichotomie.', types:['ligne'] },
    { id:'elec', nom:'Le câble électrique', texte:'Un câble électrique est coupé : les canons d’après n’ont plus de courant, et bloquent le dialogue. Mesurez la tension pour trouver où.', types:['elec'] },
    { id:'court', nom:'Le transfo qui saute', texte:'Un canon en court-circuit fait disjoncter son transfo, qui redisjoncte au réarmement. Ouvrez des tronçons de câble pour l’isoler.', types:['court'] },
    { id:'intermittent', nom:'La panne fantôme', texte:'Un canon contaminant qui brouille sa ligne… de temps en temps : la supervision bouge toute seule. Observez bien avant de conclure.', types:['intermittent'] },
    { id:'double', nom:'Double peine', texte:'Deux pannes en même temps, de deux sortes différentes.', types:['double'] },
    { id:'mystere', nom:'Panne mystère', texte:'Une panne au hasard parmi toutes les sortes. À vous de deviner laquelle.', types:['mystere'] },
  ];
  function nouvellePartie(niveauId, graine){
    graine = graine || Math.floor(Math.random() * 1e9);
    const r = alea(graine), niv = NIVEAUX.find(n => n.id === niveauId) || NIVEAUX[0], E = nouvelEtat();
    let types = niv.types;
    if(types[0] === 'double'){ const l = ['ligne', 'elec', 'dialogue', 'court', 'aval']; const a = l.splice(Math.floor(r() * l.length), 1)[0]; types = [a, l[Math.floor(r() * l.length)]]; }
    if(types[0] === 'mystere') types = [['dialogue', 'aval', 'ligne', 'elec', 'court', 'intermittent'][Math.floor(r() * 6)]];
    for(const t of types){ const p = tirerPanne(t, r, E.pannes); if(p){ p.genre = t; E.pannes.push(p); } }
    E.optimum = E.pannes.reduce((s, p) => s + optimum(p), 0);
    stabiliser(E);
    return { E, niveau:niv, graine, types };
  }

  // Le défi du jour : la même panne pour tout le monde ce jour-là (la sorte et la panne viennent de la date)
  const SORTES_DEFI = ['ligne', 'elec', 'court', 'aval', 'intermittent', 'dialogue', 'double'];
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
    ok(res.filter(r => r.startsWith('❌')).length === 0, 'les 96 pannes tirées se voient et se réparent');
    // dichotomie sur une ligne brouillée : ouvrir le canon contaminant fait revenir ceux d'avant
    const P = nouvellePartie('ligne', 12345), c = P.E.pannes[0].canon, avant = calculer(P.E).parlent.size;
    P.E.off.add(c); const apres = calculer(P.E).parlent.size;
    ok(apres > avant, `ligne brouillée : couper le canon fautif fait revenir des canons (${avant} → ${apres})`);
    // court-circuit : réarmer redisjoncte, sauf si le canon est coupé
    const Q = nouvellePartie('court', 4242), d = ORIGINE[Q.E.pannes[0].canon];
    ok(Q.E.disj.has(d), 'court-circuit : le transfo a disjoncté');
    Q.E.disj.delete(d); stabiliser(Q.E); ok(Q.E.disj.has(d), 'court-circuit : il redisjoncte au réarmement');
    Q.E.off.add(Q.E.pannes[0].canon); Q.E.disj.delete(d); stabiliser(Q.E); ok(!Q.E.disj.has(d), 'court-circuit : canon coupé, le réarmement tient');
    return res;
  }

  window.PanneSim = { R, ek, CANONS, PAR_ID, VRAIS, LIAISONS, CABLES, L_PAR_K, C_PAR_K, DEPARTS, D_PAR_ID, TETES, LIAISONS_DE, CABLES_DE, ORIGINE, TYPES, NIVEAUX,
    nouvelEtat, courant, stabiliser, calculer, diagnostic, actif, nouvellePartie, defiDuJour, toutVa, optimum, versDe, tests };
})();
