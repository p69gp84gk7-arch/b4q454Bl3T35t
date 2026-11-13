/* Altitude Arcade — Recherche de panne : la simulation (aucun dessin ici).
   Le réseau (reseau.js) : des canons reliés par des liaisons de dialogue (avec un sens : le dialogue part des têtes),
   et par des câbles électriques qui partent des transfos.
   Les règles du dialogue (version 186, d'après le terrain) :
   - Le câble de dialogue TRAVERSE les canons : un canon exclu (interrupteur ouvert) ou sans courant ne répond plus,
     mais il ne coupe pas la ligne, les suivants continuent de dialoguer.
   - Le SIGNAL part à 100 % d'une tête et s'affaiblit le long du câble. Un RÉPÉTITEUR (canons 162, 115, 140, 98, 1, 201,
     220 et 318) le relit et le renvoie à 100 % : il découpe le réseau en TRONÇONS. Sans courant, en panne, ou s'il reçoit
     un signal trop faible, brouillé ou illisible, il ne renvoie rien : tout ce qui est après lui se tait.
   - Un canon répond s'il est branché, alimenté, et s'il reçoit un signal assez fort, lisible et pas brouillé.
   - Les pannes cachées : liaison coupée, liaison abîmée (elle affaiblit le signal), module qui brouille tout son tronçon
     (parfois par intermittence), répétiteur en panne, câble électrique coupé, court-circuit (le transfo disjoncte),
     adresse en double (deux canons qui ne répondent plus), paire A/B inversée, câble de puissance voisin.
   Window.PanneSim expose tout pour le jeu et pour les tests (PanneSim.tests()). */
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
  // la longueur d'une liaison de dialogue, en mètres (le long de son tracé)
  const LON = {};
  LIAISONS.forEach(l => { const g = (R.geomLiaisons || {})[l.k] || [[PAR_ID[l.a].x, PAR_ID[l.a].y], [PAR_ID[l.b].x, PAR_ID[l.b].y]]; let s = 0; for(let i = 1; i < g.length; i++) s += Math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]); LON[l.k] = s; });
  // Le signal : il perd 63 % de sa force tous les PORTEE mètres ; sous SEUIL %, un canon (ou un répétiteur) ne le lit plus.
  // (réglé sur le réseau : le canon le plus loin d'un répétiteur, à 1 960 m, reçoit encore 45 %)
  const PORTEE = 2450, SEUIL = 25, ABIME = .4, PORTEE_BRUIT = 900;

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
    const vit = id => !E.off.has(id) && alim(id);                    // le module du canon est branché sur le réseau et alimenté
    const transfoEnService = d => !E.depOuv.has(d) && !E.disj.has(d);
    const coupee = l => E.debr.has(l.k) || enPanne(E, 'cableDia', l.k);
    // une liaison illisible : paire A/B inversée, ou parasitée par le câble de puissance d'un transfo en service
    const illisible = l => E.pannes.some(p => !p.repare && p.k === l.k && (p.type === 'paire' || (p.type === 'parasite' && transfoEnService(p.transfo))));
    const perte = l => Math.exp(-LON[l.k] / PORTEE) * (enPanne(E, 'cableFaible', l.k) ? ABIME : 1);
    // un répétiteur marche s'il a du courant et s'il n'est pas en panne (l'interrupteur du canon ne le concerne pas)
    const repActif = id => REPETEURS.has(id) && alim(id) && !enPanne(E, 'repeteur', id);

    // 1. Le bruit : un module défectueux brouille tout son tronçon, dans les deux sens, jusqu'aux répétiteurs.
    //    (le canon d'un répétiteur est du côté de sa sortie ; les liaisons qui arrivent sur lui sont son entrée.
    //    Une tête de dialogue sépare de la même façon : ce qui arrive sur la salle des machines ne repart pas sur ses départs.)
    const bruit = {}, entreeBrouillee = new Set(), separe = id => REPETEURS.has(id) || TETES.includes(id);
    for(const p of E.pannes){
      if(p.type !== 'contaminant' || p.repare || !vit(p.canon) || !actif(p, E.t)) continue;
      const d = { [p.canon]:0 }, file = [p.canon];
      while(file.length){
        const x = file.shift();
        for(const l of LIAISONS_DE[x] || []){
          if(coupee(l)) continue;
          const y = l.a === x ? l.b : l.a;
          if(separe(x) && !versDe(l, x)) continue;                                       // l'entrée du répétiteur x : un autre tronçon
          if(separe(y) && !versDe(l, y)){ if(REPETEURS.has(y)) entreeBrouillee.add(y); continue; }   // l'entrée du répétiteur y : il ne relit plus rien
          if(d[y] == null){ d[y] = d[x] + LON[l.k]; file.push(y); }
        }
      }
      for(const x in d) bruit[x] = Math.max(bruit[x] || 0, Math.exp(-d[x] / PORTEE_BRUIT));
    }

    // 2. Le signal : 100 % aux têtes, il s'affaiblit le long du câble ; un répétiteur qui le lit bien le renvoie à 100 %
    const niv = {}, lis = {}, entree = {}, file = [];
    for(const h of TETES){ niv[h] = 100; lis[h] = true; file.push(h); }
    while(file.length){
      const x = file.shift();
      for(const l of LIAISONS_DE[x] || []){
        if(coupee(l)) continue;
        const y = versDe(l, x); if(!y) continue;
        const n = niv[x] * perte(l), ok = lis[x] && !illisible(l);
        if(REPETEURS.has(y)){
          if(entree[y] && entree[y].niv >= n) continue;
          entree[y] = { niv:n, lis:ok };
          const sort = repActif(y) && n >= SEUIL && ok && !entreeBrouillee.has(y);
          niv[y] = sort ? 100 : 0; lis[y] = sort; file.push(y);
        } else if(niv[y] == null || n > niv[y] + .01){ niv[y] = n; lis[y] = ok; file.push(y); }
      }
    }
    // 3. Qui reçoit, qui répond
    const recoit = id => (niv[id] || 0) >= SEUIL && !!lis[id] && !bruit[id];
    const conflit = new Set();                                        // deux canons à la même adresse, branchés tous les deux : aucun ne répond
    for(const p of E.pannes) if(p.type === 'adresse' && !p.repare && p.canons.every(vit)) p.canons.forEach(c => conflit.add(c));
    const atteint = new Set(CANONS.filter(c => recoit(c.id)).map(c => c.id));
    const parlent = new Set(VRAIS.filter(c => vit(c.id) && recoit(c.id) && !conflit.has(c.id)).map(c => c.id));
    const brouille = new Set(Object.keys(bruit));
    return { de, alim, vit, niv, lis, bruit, brouille, entree, entreeBrouillee, repActif, conflit, atteint, parlent, coupee, illisible };
  }

  // la force normale du signal à chaque canon (réseau sain) : la mesure la rappelle, pour repérer une chute
  const NORMAL = calculer(nouvelEtat()).niv;
  // Ce qu'on mesure sur place, au canon : la tension, le signal de dialogue (sa force, sa qualité), et ce que fait le canon
  const qualiteDe = (n, brouille, lisible) => n < 1 ? 'absent' : brouille ? 'brouillé' : !lisible ? 'illisible' : n < SEUIL ? 'faible' : 'net';
  function diagnostic(E, id){
    const C = calculer(E);
    const tension = !CABLES_SANS.has(id) ? 'sans câble' : C.de[id] ? 'présente' : 'absente';
    const n = C.niv[id] || 0, b = C.bruit[id] || 0;
    const reponse = E.off.has(id) ? 'exclu' : !C.alim(id) ? 'éteint' : C.conflit.has(id) ? 'conflit' : C.parlent.has(id) || (PAR_ID[id].zone === 'SDM' && C.atteint.has(id)) ? 'communique' : 'muet';
    // le répétiteur du canon : ce qui arrive à son entrée, ce qu'il renvoie à sa sortie
    let rep = null;
    if(REPETEURS.has(id)){
      const e = C.entree[id] || { niv:0, lis:false };
      rep = { courant:C.alim(id), entree:Math.round(e.niv), qEntree:qualiteDe(e.niv, C.entreeBrouillee.has(id), e.lis), sortie:n >= 1 };
    }
    return { tension, signal:Math.round(n), normal:Math.round(NORMAL[id] || 0), bruit:Math.round(100 * b), qualite:qualiteDe(n, b > 0, C.lis[id]), reponse, rep,
      interrupteur:E.off.has(id) ? 'ouvert' : 'fermé', transfo:ORIGINE[id] ? D_PAR_ID[ORIGINE[id]].nom : null };
  }

  /* ---------- tirer une panne au hasard ---------- */
  // en aval d'un canon (dans le sens du dialogue)
  function aval(id){ const vu = new Set([id]), pile = [id]; while(pile.length){ const x = pile.pop(); for(const l of LIAISONS_DE[x] || []){ const y = versDe(l, x); if(y && !vu.has(y)){ vu.add(y); pile.push(y); } } } vu.delete(id); return vu; }
  const log2 = n => Math.ceil(Math.log2(Math.max(1, n)));
  const posDe = id => id.startsWith('src/') ? D_PAR_ID[id.slice(4)] : PAR_ID[id];
  // le tronçon d'un canon : les canons entre les mêmes répétiteurs que lui (ceux qu'il brouillerait)
  function troncon(id){ const E = nouvelEtat(); E.pannes = [{ type:'contaminant', canon:id }]; return calculer(E).brouille; }
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
    dialogue:{ nom:'Liaison de dialogue coupée', ico:'✂️' },
    faible:{ nom:'Liaison abîmée (signal faible)', ico:'📉' },
    ligne:{ nom:'Module qui brouille son tronçon', ico:'📡' },
    repeteur:{ nom:'Répétiteur en panne', ico:'📶' },
    elec:{ nom:'Câble électrique coupé', ico:'🔌' },
    court:{ nom:'Court-circuit', ico:'⚡' },
    intermittent:{ nom:'Brouillage intermittent', ico:'〰️' },
    adresse:{ nom:'Adresse en double', ico:'🔢' },
    paire:{ nom:'Paire A/B inversée', ico:'⇆' },
    parasite:{ nom:'Câble de puissance voisin', ico:'🛡' },
    cachee:{ nom:'Panne cachée derrière une autre', ico:'🫥' },
  };
  // combien de canons une panne fait taire, seule sur le réseau
  const perdus = p => { const E = nouvelEtat(); E.pannes = [p]; stabiliser(E); return VRAIS.length - calculer(E).parlent.size; };
  // le canon au bout d'une liaison, dans le sens du dialogue
  const boutDe = l => l.d === 'ab' ? l.b : l.d === 'ba' ? l.a : null;
  function tirerPanne(type, r, deja){
    const pris = new Set(deja.flatMap(p => p.canons || [p.canon || p.k]));
    const choisir = l => { l = l.filter(x => !pris.has(x.canon || x.k)); return l.length ? l[Math.floor(r() * l.length)] : null; };
    // une liaison qui a au moins n canons après elle
    const liaisonsAvec = n => LIAISONS.filter(l => { const y = boutDe(l); return y && PAR_ID[y].zone !== 'SDM' && aval(y).size >= n; });
    if(type === 'dialogue'){
      const l = choisir(liaisonsAvec(2).filter(l => perdus({ type:'cableDia', k:l.k }) >= 3).map(l => ({ k:l.k })));
      return l && { type:'cableDia', k:l.k };
    }
    if(type === 'faible'){
      // une liaison abîmée qui fait vraiment taire des canons plus loin (là où le signal devient trop faible)
      const l = choisir(liaisonsAvec(4).filter(l => perdus({ type:'cableFaible', k:l.k }) >= 4).map(l => ({ k:l.k })));
      return l && { type:'cableFaible', k:l.k };
    }
    if(type === 'ligne' || type === 'intermittent'){
      const c = choisir(VRAIS.filter(c => troncon(c.id).size >= 6).map(c => ({ canon:c.id })));
      if(!c) return null;
      const p = { type:'contaminant', canon:c.canon };
      if(type === 'intermittent'){ p.intermittent = true; p.horaire = horaire(Math.floor(r() * 1e9)); }
      return p;
    }
    if(type === 'repeteur'){
      const c = choisir([...REPETEURS].filter(id => aval(id).size >= 4).map(id => ({ canon:id })));
      return c && { type:'repeteur', canon:c.canon };
    }
    if(type === 'elec'){
      const c = choisir(CABLES.filter(c => { const E = nouvelEtat(); E.pannes = [{ type:'cableElec', k:c.k }]; const C = calculer(E); return VRAIS.filter(v => CABLES_SANS.has(v.id) && !C.de[v.id]).length >= 4; }).map(c => ({ k:c.k })));
      return c && { type:'cableElec', k:c.k };
    }
    if(type === 'paire'){ const l = choisir(liaisonsAvec(4).filter(l => perdus({ type:'paire', k:l.k }) >= 4).map(l => ({ k:l.k }))); return l && { type:'paire', k:l.k }; }
    if(type === 'parasite'){
      // un transfo dont le courant ne fait pas vivre les canons d'après la liaison : le couper fait revenir le dialogue
      const essais = liaisonsAvec(6).map(l => ({ k:l.k })).sort(() => r() - .5);
      for(const e of essais){
        if(pris.has(e.k)) continue;
        const l = L_PAR_K[e.k], y = boutDe(l), apres = [y, ...aval(y)];
        const m = [(posDe(l.a).x + posDe(l.b).x) / 2, (posDe(l.a).y + posDe(l.b).y) / 2];
        const proches = DEPARTS.slice().sort((a, b) => distTransfo(a.id, m) - distTransfo(b.id, m));
        for(const d of proches.slice(0, 3)){
          if(apres.some(x => ORIGINE[x] === d.id)) continue;
          const E = nouvelEtat(); E.pannes = [{ type:'parasite', k:e.k, transfo:d.id }];
          const avant = calculer(E).parlent.size; E.depOuv.add(d.id); const C = calculer(E);
          if(apres.filter(x => C.parlent.has(x)).length >= 3 && avant <= VRAIS.length - 4) return { type:'parasite', k:e.k, transfo:d.id };
        }
      }
      return null;
    }
    if(type === 'adresse'){
      // deux canons qui ont du courant, pas trop près l'un de l'autre
      const l = VRAIS.filter(c => !pris.has(c.id) && ORIGINE[c.id]);
      for(let n = 0; n < 60; n++){
        const a = l[Math.floor(r() * l.length)], b = l[Math.floor(r() * l.length)];
        if(a && b && a !== b && Math.hypot(a.x - b.x, a.y - b.y) > 300) return { type:'adresse', canons:[a.id, b.id] };
      }
      return null;
    }
    if(type === 'cachee'){
      // une première panne qui fait taire beaucoup de canons, et une deuxième plus loin derrière elle
      const sortes = ['dialogue', 'paire'];
      for(let n = 0; n < 60; n++){
        const p1 = tirerPanne(sortes[Math.floor(r() * 2)], r, deja); if(!p1) continue;
        const ici = boutDe(L_PAR_K[p1.k]), loin = aval(ici);
        if(loin.size < 8) continue;
        const cand = LIAISONS.filter(l => { const y = boutDe(l), x = y === l.b ? l.a : l.b; return y && loin.has(x) && x !== ici && aval(y).size >= 2; });
        if(!cand.length) continue;
        const l2 = cand[Math.floor(r() * cand.length)], s2 = sortes[Math.floor(r() * 2)];
        const p2 = { type:s2 === 'paire' ? 'paire' : 'cableDia', k:l2.k };
        if(p2.k === p1.k) continue;
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
  // Le nombre de gestes d'une bonne recherche (pour les étoiles) : deux mesures aux répétiteurs pour trouver le tronçon,
  // puis une dichotomie dans le tronçon, puis la réparation
  function optimum(p){
    const E = nouvelEtat(); E.pannes = [p]; stabiliser(E); const C = calculer(E);
    const dansTroncon = id => log2(troncon(id).size);
    if(p.type === 'cableDia' || p.type === 'cableFaible' || p.type === 'paire') return 2 + dansTroncon(boutDe(L_PAR_K[p.k]) || L_PAR_K[p.k].a) + 1;
    if(p.type === 'parasite') return 2 + dansTroncon(boutDe(L_PAR_K[p.k]) || L_PAR_K[p.k].a) + 3;       // et couper puis remettre le transfo
    if(p.type === 'contaminant') return 2 + dansTroncon(p.canon) + 1 + (p.intermittent ? 2 : 0);
    if(p.type === 'repeteur') return 4;                                        // deux ou trois mesures, le changement
    if(p.type === 'adresse') return 3;                                         // deux mesures, le module
    if(p.type === 'cableElec') return log2(VRAIS.filter(v => CABLES_SANS.has(v.id) && !C.de[v.id]).length + 1) + 2;
    if(p.type === 'court'){ const d = ORIGINE[p.canon]; return 1 + log2(VRAIS.filter(v => ORIGINE[v.id] === d).length) + 2; }
    return 3;
  }

  // Les niveaux
  const SOURNOISES = ['adresse', 'paire', 'parasite', 'repeteur', 'cachee', 'ligne', 'faible'];
  // Le parcours : de la panne la plus simple à la plus sournoise ; chaque niveau se débloque en réussissant le précédent
  const PALIERS = { debutant:'Débutant', confirme:'Confirmé', sournois:'Sournois', expert:'Expert' };
  const NIVEAUX = [
    { id:'dialogue', palier:'debutant', nom:'La liaison arrachée', texte:'Une liaison de dialogue a été coupée (une dameuse, un rongeur…) : après elle, plus aucun signal. Mesurez le signal pour trouver où il s’arrête.', types:['dialogue'],
      methode:'Mesurez le signal aux répétiteurs 📶 pour trouver le tronçon muet, puis au milieu du tronçon : là où le signal passe de « net » à « absent », la liaison est coupée.' },
    { id:'elec', palier:'debutant', nom:'Le câble électrique', texte:'Un câble électrique est coupé : les canons d’après n’ont plus de courant et ne répondent plus (mais la ligne de dialogue, elle, continue de passer).', types:['elec'],
      methode:'Passez en vue ⚡ Électricité. Mesurez la tension au milieu des canons muets : présente d’un côté, absente de l’autre, le câble coupé est entre les deux.' },
    { id:'adresse', palier:'debutant', nom:'Adresse en double', texte:'Après un changement de module, deux canons ont la même adresse : ils répondent en même temps et la supervision ne comprend ni l’un ni l’autre.', types:['adresse'],
      methode:'Deux canons muets, loin l’un de l’autre, avec du courant et un bon signal : mesurez-en un, il dira « adresse en double ». Changez le module de l’un des deux.' },
    { id:'ligne', palier:'confirme', nom:'Le tronçon brouillé', texte:'Le module d’un canon envoie n’importe quoi sur le câble : tout son tronçon (entre deux répétiteurs) est brouillé, et tout ce qui est après aussi.', types:['ligne'],
      methode:'Mesurez le bruit : plus il est fort, plus le fautif est près. Ou coupez le tronçon en deux en débranchant une liaison : la moitié qui revient est saine. Excluez le suspect (ouvrez son interrupteur) : si tout revient, c’est lui.' },
    { id:'repeteur', palier:'confirme', nom:'Le répétiteur en panne', texte:'Un répétiteur ne renvoie plus le signal : tout ce qui est après lui se tait, alors qu’avant lui tout va bien.', types:['repeteur'],
      methode:'Mesurez au répétiteur 📶 juste avant les canons muets : s’il a du courant, un bon signal à l’entrée et rien à la sortie, c’est lui.' },
    { id:'faible', palier:'confirme', nom:'Le signal faible', texte:'Une liaison abîmée (humidité, épissure oxydée) affaiblit le signal : les canons proches répondent encore, ceux du bout de la ligne se taisent.', types:['faible'],
      methode:'Mesurez le signal le long du tronçon : il baisse doucement, puis chute d’un coup. La liaison abîmée est à l’endroit de la chute.' },
    { id:'court', palier:'confirme', nom:'Le transfo qui saute', texte:'Un canon en court-circuit fait disjoncter son transfo, qui redisjoncte au réarmement. Excluez des canons ou ouvrez des tronçons de câble pour l’isoler.', types:['court'],
      methode:'En vue ⚡ Électricité : ouvrez un tronçon de câble au milieu, réarmez le transfo. S’il tient, le court-circuit est après l’ouverture ; sinon, avant.' },
    { id:'paire', palier:'confirme', nom:'Paire inversée', texte:'Après une intervention, les fils A et B d’une liaison ont été inversés. Le signal est fort… mais illisible pour tous ceux d’après.', types:['paire'],
      methode:'Mesurez le signal : il passe de « net » à « illisible » à la liaison inversée. Inversez la paire A/B de cette liaison.' },
    { id:'intermittent', palier:'confirme', nom:'La panne fantôme', texte:'Un module qui brouille son tronçon… de temps en temps : la supervision bouge toute seule. Observez bien avant de conclure.', types:['intermittent'],
      methode:'Attendez que ça brouille pour mesurer le bruit, ou excluez un suspect et regardez si le brouillage revient au cycle suivant.' },
    { id:'parasite', palier:'sournois', nom:'Le câble voisin', texte:'Une liaison de dialogue longe un câble de puissance : elle est illisible tant que ce transfo est en service.', types:['parasite'],
      methode:'La mesure dit « illisible », comme une paire inversée. Coupez le transfo dont le câble passe près de la liaison : si le dialogue revient, c’est un parasite, blindez la liaison.' },
    { id:'cachee', palier:'sournois', nom:'Panne cachée', texte:'Une panne en cache une autre, plus loin sur la même ligne : réparer la première ne fait pas tout revenir.', types:['cachee'],
      methode:'Réparez la première, puis recommencez la recherche sur ce qui reste muet.' },
    { id:'double', palier:'sournois', nom:'Double peine', texte:'Deux pannes en même temps, de deux sortes différentes.', types:['double'],
      methode:'Deux zones muettes : traitez-les l’une après l’autre, comme deux pannes simples.' },
    { id:'mystere', palier:'sournois', nom:'Panne mystère', texte:'Une panne au hasard parmi toutes les sortes. À vous de deviner laquelle.', types:['mystere'],
      methode:'Commencez par les mesures aux répétiteurs 📶 et la tension : elles disent de quelle famille est la panne.' },
    { id:'expert2', palier:'expert', nom:'Expert : deux sournoises', texte:'Deux pannes sournoises en même temps.', types:['expert2'], methode:'' },
    { id:'expert3', palier:'expert', nom:'Expert : trois sournoises', texte:'Trois pannes sournoises en même temps. Pour les dépanneurs chevronnés.', types:['expert3'], methode:'' },
  ];
  function nouvellePartie(niveauId, graine){
    graine = graine || Math.floor(Math.random() * 1e9);
    const r = alea(graine), niv = NIVEAUX.find(n => n.id === niveauId) || NIVEAUX[0], E = nouvelEtat();
    let types = niv.types;
    if(types[0] === 'double'){ const l = ['ligne', 'elec', 'dialogue', 'court', 'faible', 'repeteur']; const a = l.splice(Math.floor(r() * l.length), 1)[0]; types = [a, l[Math.floor(r() * l.length)]]; }
    if(types[0] === 'mystere') types = [['dialogue', 'ligne', 'elec', 'court', 'intermittent', 'faible', 'repeteur', 'paire', 'adresse'][Math.floor(r() * 9)]];
    if(types[0] === 'expert2' || types[0] === 'expert3'){ const l = SOURNOISES.slice(), n = types[0] === 'expert3' ? 3 : 2; types = []; while(types.length < n) types.push(l.splice(Math.floor(r() * l.length), 1)[0]); }
    for(const t of types){ const p = tirerPanne(t, r, E.pannes); if(Array.isArray(p)) E.pannes.push(...p); else if(p){ p.genre = t; E.pannes.push(p); } }
    E.optimum = E.pannes.reduce((s, p) => s + optimum(p), 0);
    // le stock de pièces : ce qu'il faut, plus une marge (une mauvaise réparation ne consomme pas de pièce)
    E.stock = { modules:1 + E.pannes.filter(p => p.type === 'contaminant' || p.type === 'adresse').length,
      kits:Math.max(3, 2 + E.pannes.filter(p => ['cableDia', 'cableFaible', 'cableElec', 'court', 'parasite', 'repeteur'].includes(p.type)).length) };
    stabiliser(E);
    return { E, niveau:niv, graine, types };
  }

  // Le défi du jour : la même panne pour tout le monde ce jour-là (la sorte et la panne viennent de la date)
  const SORTES_DEFI = ['ligne', 'paire', 'elec', 'repeteur', 'court', 'adresse', 'faible', 'parasite', 'intermittent', 'cachee', 'dialogue', 'double', 'expert2'];
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
    const N = VRAIS.length, E0 = nouvelEtat(), C0 = calculer(E0);
    ok(C0.parlent.size === N, `réseau normal : ${C0.parlent.size} / ${N} canons communiquent`);
    const mini = Math.min(...VRAIS.map(c => C0.niv[c.id] || 0));
    ok(mini >= SEUIL + 10, `signal normal : le canon le plus faible reçoit ${Math.round(mini)} % (seuil ${SEUIL} %)`);
    ok(REPETEURS.size === 8 && [...REPETEURS].every(id => PAR_ID[id]), `les ${REPETEURS.size} répétiteurs sont sur le réseau`);
    ok(Object.keys(ORIGINE).length >= 190, `courant normal : ${Object.keys(ORIGINE).length} canons alimentés`);
    for(const n of NIVEAUX) for(let s = 1; s <= 12; s++){
      const P = nouvellePartie(n.id, s * 7919), C = calculer(P.E);
      if(!P.E.pannes.length || (C.parlent.size >= N && !P.E.pannes.some(p => p.intermittent))){ ok(false, `${n.id} #${s} : la panne ne se voit pas (${C.parlent.size})`); continue; }
      // réparer et tout remettre doit tout faire revenir
      P.E.pannes.forEach(p => p.repare = true); P.E.disj.clear(); stabiliser(P.E);
      if(calculer(P.E).parlent.size !== N) ok(false, `${n.id} #${s} : réparé mais pas tout revenu`);
    }
    ok(res.filter(r => r.startsWith('❌')).length === 0, `les ${NIVEAUX.length * 12} pannes tirées se voient et se réparent`);
    // un canon exclu ou sans courant ne coupe pas la ligne
    const milieu = VRAIS.find(c => !REPETEURS.has(c.id) && aval(c.id).size >= 10), Ex = nouvelEtat(); Ex.off.add(milieu.id);
    ok(calculer(Ex).parlent.size === N - 1, `canon ${milieu.nom} exclu (interrupteur ouvert) : lui seul se tait, la ligne passe`);
    const Pe = nouvellePartie('elec', 4242), Ce = calculer(Pe.E), sansCourant = VRAIS.filter(c => !Ce.alim(c.id));
    const muetsAvecCourant = VRAIS.filter(c => Ce.alim(c.id) && !Ce.parlent.has(c.id)), repEteints = [...REPETEURS].filter(id => !Ce.alim(id));
    ok(sansCourant.length >= 4 && (repEteints.length > 0 || muetsAvecCourant.length === 0), `câble électrique coupé : ${sansCourant.length} canons sans courant se taisent, ${muetsAvecCourant.length} autres (${repEteints.length} répétiteur éteint)`);
    // un module qui brouille : tout son tronçon, et l'exclure fait tout revenir
    const P = nouvellePartie('ligne', 12345), c = P.E.pannes[0].canon, C1 = calculer(P.E), tr = troncon(c);
    ok([...tr].filter(x => PAR_ID[x].zone !== 'SDM').every(x => !C1.parlent.has(x)), `module qui brouille au ${PAR_ID[c].nom} : les ${tr.size} canons de son tronçon se taisent (${C1.parlent.size} / ${N})`);
    const loin = [...tr].sort((a, b) => C1.bruit[a] - C1.bruit[b])[0];
    ok(C1.bruit[c] === 1 && C1.bruit[loin] < C1.bruit[c], `le bruit est le plus fort au fautif (100 %) et baisse en s'éloignant (${Math.round(100 * C1.bruit[loin])} % au ${PAR_ID[loin].nom})`);
    P.E.off.add(c); ok(calculer(P.E).parlent.size === N - 1, 'exclure le canon fautif fait revenir tous les autres');
    // un répétiteur en panne : rien après lui
    const Pr = nouvellePartie('repeteur', 99), rp = Pr.E.pannes[0].canon, Cr = calculer(Pr.E), dr = diagnostic(Pr.E, rp);
    ok([...aval(rp)].every(x => !Cr.parlent.has(x)) && dr.rep.entree >= SEUIL && !dr.rep.sortie, `répétiteur ${PAR_ID[rp].nom} en panne : entrée ${dr.rep.entree} %, rien à la sortie, ${aval(rp).size} canons muets après lui`);
    // une liaison abîmée : le signal chute, les canons les plus loin se taisent
    const Pf = nouvellePartie('faible', 31), lf = L_PAR_K[Pf.E.pannes[0].k], Cf = calculer(Pf.E), yf = boutDe(lf), xf = yf === lf.a ? lf.b : lf.a;
    ok(Cf.niv[yf] < Cf.niv[xf] * .5 && Cf.parlent.size < N, `liaison abîmée ${PAR_ID[xf].nom} – ${PAR_ID[yf].nom} : le signal chute de ${Math.round(Cf.niv[xf])} % à ${Math.round(Cf.niv[yf])} %, ${N - Cf.parlent.size} canons muets`);
    // court-circuit : réarmer redisjoncte, sauf si le canon est exclu
    const Q = nouvellePartie('court', 4242), d = ORIGINE[Q.E.pannes[0].canon];
    ok(Q.E.disj.has(d), 'court-circuit : le transfo a disjoncté');
    Q.E.disj.delete(d); stabiliser(Q.E); ok(Q.E.disj.has(d), 'court-circuit : il redisjoncte au réarmement');
    Q.E.off.add(Q.E.pannes[0].canon); Q.E.disj.delete(d); stabiliser(Q.E); ok(!Q.E.disj.has(d), 'court-circuit : canon exclu, le réarmement tient');
    // les autres pannes
    const A = nouvellePartie('adresse', 777), [a1, a2] = A.E.pannes[0].canons, CA = calculer(A.E);
    ok(CA.parlent.size === N - 2 && diagnostic(A.E, a1).reponse === 'conflit', 'adresse en double : seuls les deux canons se taisent, la mesure dit « conflit »');
    A.E.off.add(a1); ok(calculer(A.E).parlent.has(a2), 'adresse en double : exclure l’un fait répondre l’autre');
    const B = nouvellePartie('paire', 778), yb = boutDe(L_PAR_K[B.E.pannes[0].k]);
    ok(diagnostic(B.E, yb).qualite === 'illisible', 'paire inversée : après la liaison, le signal est illisible');
    const Cp = nouvellePartie('parasite', 779), pc = Cp.E.pannes[0], yc = boutDe(L_PAR_K[pc.k]);
    ok(diagnostic(Cp.E, yc).qualite === 'illisible', 'câble voisin : signal illisible aussi');
    Cp.E.depOuv.add(pc.transfo); ok(calculer(Cp.E).parlent.has(yc), 'câble voisin : couper le transfo fait revenir la liaison');
    const Hc = nouvellePartie('cachee', 781); Hc.E.pannes[0].repare = true;
    ok(Hc.E.pannes.length === 2 && calculer(Hc.E).parlent.size < N, 'panne cachée : réparer la première ne fait pas tout revenir');
    return res;
  }

  window.PanneSim = { R, ek, CANONS, PAR_ID, VRAIS, LIAISONS, CABLES, L_PAR_K, C_PAR_K, DEPARTS, D_PAR_ID, TETES, REPETEURS, LIAISONS_DE, CABLES_DE, ORIGINE, TYPES, NIVEAUX, PALIERS, SEUIL, LON,
    nouvelEtat, courant, stabiliser, calculer, diagnostic, actif, nouvellePartie, defiDuJour, toutVa, optimum, versDe, aval, troncon, boutDe, tests };
})();
