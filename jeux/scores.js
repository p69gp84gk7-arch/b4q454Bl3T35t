/* Altitude Arcade : les scores de chaque jeu, pour le classement de tous les joueurs (jeux/classement.html).
   AltitudeScores.calculer(pseudo) lit les records gardés sur l'appareil et renvoie, jeu par jeu :
     { titre, ico, epreuves:{ cle:{ n:nom de l'épreuve, v:valeur, a:affichage, s:1 si plus c'est grand mieux c'est, -1 sinon } },
       stats:{ libellé:valeur affichée } }
   Dans les jeux à plusieurs sur le même téléphone, seuls comptent les résultats du joueur du profil
   (son pseudo, ou le premier joueur resté sans nom : « Joueur 1 », « Vous »…).
   L'accueil envoie ce résumé au tableur avec la sauvegarde ; le tableur renvoie ceux de tous les joueurs. */
window.AltitudeScores = (() => {
  const lire = k => { try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } };
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  const temps = ms => { const s = ms / 1000, m = Math.floor(s / 60); return m ? `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}` : `${s.toFixed(2).replace('.', ',')} s`; };
  const pct = (a, b) => b ? Math.round(a / b * 100) + ' %' : '—';
  const norm = s => String(s || '').trim().toLowerCase();
  const estMoi = (nom, pseudo) => { const n = norm(nom); return !n || n === norm(pseudo) || /^joueur 1$|^vous$/.test(n); };

  const NOMS = {
    tour:{ vallee:'La Vallée', porteavions:'Le Porte-avions', lac:'Le Lac', aeroport:'Le Grand Aéroport', base:'La Base aérienne', ville:'La Ville', altiport:'L’Altiport', ile:'L’Île' },
    tourNiv:{ facile:'Facile', normal:'Normal', difficile:'Difficile', expert:'Expert' },
    slalom:{ geant:'Géant de la Combe', special:'Spécial du Stade', superg:'Super-G des Crêtes' },
    telesiege:{ clarines:'Les Clarines', marmottes:'Les Marmottes', couloir:'Le Grand Couloir', bulles:'Les Bulles', express:'Sommet Express' },
    nivo:{ baby:'Baby', renard:'Le Renard', lac:'Le Lac', marmottes:'Les Marmottes', hountestrete:'Hount Estrete', lafforgue:'Lafforgue', gouron:'Le Gouron', violettes:'Les Violettes', boiscoqs:'Le Bois des Coqs' },
    geoJeu:{ drapeaux:'Drapeaux', carte:'Carte', melange:'Mélange', numeros:'Numéros', placer:'Placer' },
    geoZone:{ monde:'Monde', europe:'Europe', afrique:'Afrique', asie:'Asie', amnord:'Amérique du Nord', amsud:'Amérique du Sud', oceanie:'Océanie', france:'France', tout:'', om:'Outre-mer' },
    geoTerrain:{ monde:'', regions:'Régions', departements:'Départements', usa:'États-Unis' },
    quizNiv:{ junior:'Junior', ado:'Ado', adulte:'Adulte' },
  };

  function calculer(pseudo){
    const J = {};
    const jeu = (id, titre, ico) => J[id] = { titre, ico, epreuves:{}, stats:{} };
    const ep = (j, cle, n, v, a, s = 1) => { if(v != null && isFinite(v)) J[j].epreuves[cle] = { n, v, a, s }; };

    // 10 000 : les parties terminées
    const p10 = (lire('desdes-stats-10000') || []).filter(g => (g.joueurs || []).some(x => !x.robot && estMoi(x.nom, pseudo)));
    if(p10.length){
      jeu('10000', '10 000', '🎲');
      const vict = p10.filter(g => estMoi(g.gagnant, pseudo)).length;
      ep('10000', 'victoires', 'Parties gagnées', vict, fmt(vict));
      J['10000'].stats = { 'Parties jouées':p10.length, 'Victoires':vict, 'Taux de victoire':pct(vict, p10.length) };
    }
    // Yam's : le meilleur total
    const py = (lire('desdes-stats-yams') || []).map(g => ({ g, moi:(g.joueurs || []).find(x => !x.robot && estMoi(x.nom, pseudo)) })).filter(x => x.moi);
    if(py.length){
      jeu('yams', 'Yam’s', '🎲');
      const best = Math.max(...py.map(x => x.moi.score || 0)), vict = py.filter(x => Math.max(...x.g.joueurs.map(j => j.score || 0)) === x.moi.score).length;
      ep('yams', 'meilleur', 'Meilleur total', best, fmt(best));
      ep('yams', 'victoires', 'Parties gagnées', vict, fmt(vict));
      J.yams.stats = { 'Parties jouées':py.length, 'Victoires':vict, 'Total moyen':fmt(py.reduce((s, x) => s + (x.moi.score || 0), 0) / py.length) };
    }
    // Géographie : chaque jeu et chaque zone
    const gr = lire('geo-records') || {}, gs = lire('geo-stats') || {};
    if(Object.keys(gr).length || gs.parties){
      jeu('geo', 'Géographie', '🌍');
      for(const [cle0, liste] of Object.entries(gr)){
        const miens = (liste || []).filter(r => estMoi(r.nom, pseudo)); if(!miens.length) continue;
        // les anciennes clés « jeu-zone » (pays du monde, toutes les questions) prennent la forme des nouvelles
        const p0 = cle0.split('-'), cle = p0.length === 2 ? `${p0[0]}-monde-${p0[1]}-tout` : cle0;
        const b = miens[0], parts = cle.split('-');
        if(J.geo.epreuves[cle] && J.geo.epreuves[cle].v >= (b.unite === 'pts' ? b.score : b.score / b.total * 1e7 - b.temps / 100)) continue;
        // anciennes clés « jeu-zone », nouvelles « jeu-terrain-zone-nombre », placer « placer-terrain-zone »
        let nom;
        if(parts.length === 2) nom = `${NOMS.geoJeu[parts[0]] || parts[0]} · ${NOMS.geoZone[parts[1]] || parts[1]} (tout)`;
        else { const [j, t, z, n] = parts; nom = [NOMS.geoJeu[j] || j, NOMS.geoTerrain[t], NOMS.geoZone[z] ?? z].filter(Boolean).join(' · ') + (n && n !== 'tout' ? ` (${n})` : j === 'placer' ? '' : ' (tout)'); }
        if(b.unite === 'pts') ep('geo', cle, nom, b.score, `${fmt(b.score)} pts`);
        else ep('geo', cle, nom, b.score / b.total * 1e7 - b.temps / 100, `${b.score}/${b.total} en ${temps(b.temps)}`);
      }
      J.geo.stats = { 'Parties jouées':gs.parties || 0, 'Questions':gs.questions || 0, 'Bonnes du 1er coup':pct(gs.bonnes || 0, gs.questions || 0), 'Défis du jour':Object.keys(gs.defis || {}).length + Object.keys(gs.defisLieux || {}).length };
    }
    // Draw Race : le meilleur temps de course et le meilleur tour sur chaque circuit
    const dr = lire('drawrace-records') || {}, pal = lire('drawrace-palmares') || [];
    const circuits = [...(window.CIRCUITS || []), ...(window.CIRCUITS_RALLYE || []), ...(window.CIRCUITS_ENDURANCE || []), ...(window.CIRCUITS_TOURISME || [])];
    const perso = new Set((lire('drawrace-perso') || []).map(c => c.id));
    let courses = 0;
    for(const [cle, r] of Object.entries(dr)){
      const miens = (r.courses || []).filter(c => estMoi(c.nom, pseudo)); if(!miens.length) continue;
      // clé du circuit : la catégorie (« end: » Prototypes, « tou: » Tourisme, « r: » un circuit du joueur en rallye), son identifiant,
      // « ~v2 » pour un circuit redessiné, puis « -3t » si le nombre de tours a changé
      const m = cle.match(/^(?:(end|tou|r):)?(.+?)(?:~v\d+)?(?:-(\d+)t)?$/), c = circuits.find(x => x.id === m[2]);
      courses += miens.length;
      if(perso.has(m[2])) continue;          // les circuits créés par le joueur ne se comparent pas avec les autres
      if(!J.drawrace) jeu('drawrace', 'Draw Race', '🏎️');
      const nom = (c ? c.n : m[2]) + (m[1] === 'end' ? ' · Prototypes' : m[1] === 'tou' ? ' · Tourisme' : '') + (m[3] ? ` (${m[3]} tours)` : '');
      const best = Math.min(...miens.map(c => c.temps));
      ep('drawrace', cle, nom, best, temps(best), -1);
      if(r.tour && estMoi(r.tour.nom, pseudo)) ep('drawrace', cle + ':tour', nom + ' · meilleur tour', r.tour.temps, temps(r.tour.temps), -1);
    }
    const titres = pal.filter(p => p.place === 1).length;
    // le défi du jour (Formule et Rallye) : le meilleur temps du joueur aujourd'hui ; les étoiles des défis
    const dj = lire('drawrace-jour') || {}, d0 = new Date(), auj = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
    const etoiles = Object.values(lire('drawrace-etoiles') || {}).reduce((n, e) => n + (e || []).filter(Boolean).length, 0);
    for(const [cat, D] of Object.entries(dj)){
      if(!D || !D.cle || !D.cle.endsWith(auj)) continue;
      const miens = (D.temps || []).filter(r => estMoi(r.nom, pseudo)); if(!miens.length) continue;
      if(!J.drawrace) jeu('drawrace', 'Draw Race', '🏎️');
      const best = Math.min(...miens.map(r => r.temps));
      ep('drawrace', `jour-${D.cle}`, `📅 Défi du jour ${{ rallye:'Rallye', endurance:'Prototypes', tourisme:'Tourisme' }[cat] || 'Formule'} (${d0.toLocaleDateString('fr-FR', { day:'numeric', month:'long' })})`, best, temps(best), -1);
    }
    if(J.drawrace || pal.length || etoiles){
      if(!J.drawrace) jeu('drawrace', 'Draw Race', '🏎️');
      if(pal.length) ep('drawrace', 'championnats', 'Championnats gagnés', titres, fmt(titres));
      if(etoiles) ep('drawrace', 'etoiles', '⭐ Étoiles des défis', etoiles, `${etoiles} ⭐`);
      J.drawrace.stats = { 'Circuits courus':Object.keys(J.drawrace.epreuves).filter(k => !k.endsWith(':tour') && !['championnats', 'etoiles'].includes(k) && !k.startsWith('jour-')).length, 'Courses (dans les records)':courses, 'Championnats terminés':pal.length, 'Championnats gagnés':titres, 'Étoiles des défis':etoiles };
    }
    // Fusée Rythme : les morceaux fournis (les fichiers de chacun ne se comparent pas)
    const fr = lire('fusee-records') || {};
    for(const [id, r] of Object.entries(fr)){
      if(!r || r.fichier || !r.meilleurs) continue;
      if(!J.fusee) jeu('fusee', 'Fusée Rythme', '🚀');
      for(const [niv, sc] of Object.entries(r.meilleurs)) ep('fusee', id + ':' + niv, `${r.nom}${niv !== 'normal' ? ' · ' + niv : ''}`, sc, fmt(sc));
    }
    if(Object.keys(fr).length){ if(!J.fusee) jeu('fusee', 'Fusée Rythme', '🚀'); const l = Object.values(fr); J.fusee.stats = { 'Parties jouées':l.reduce((s, r) => s + (r.parties || 0), 0), 'Morceaux joués':l.length }; }
    // Dameuse de nuit : chaque piste
    const dm = lire('dameuse-records');
    if(dm && dm.pistes && Object.keys(dm.pistes).length){
      jeu('dameuse', 'Dameuse de nuit', '🚜');
      const l = Object.entries(dm.pistes);
      for(const [id, r] of l) ep('dameuse', id, r.nom || id, r.best, `${fmt(r.best)} pts${r.etoiles ? ' · ' + '★'.repeat(r.etoiles) : ''}`);
      J.dameuse.stats = { 'Pistes damées':l.length, 'Parties jouées':l.reduce((s, [, r]) => s + (r.parties || 0), 0), 'Étoiles':l.reduce((s, [, r]) => s + (r.etoiles || 0), 0) };
    }
    // Freeride : descentes, parks, slaloms (temps) et modes sans fin
    const fd = lire('freeride-records');
    if(fd){
      const l = [];
      if(fd.infini && fd.infini.score) l.push(['infini', 'Avalanche sans fin', fd.infini.score, `${fmt(fd.infini.score)} pts · ${fmt(fd.infini.dist)} m`]);
      if(fd.parkInfini && fd.parkInfini.score) l.push(['parkinfini', 'Snowpark sans fin', fd.parkInfini.score, `${fmt(fd.parkInfini.score)} pts`]);
      for(const [id, r] of Object.entries(fd.descentes || {})) l.push(['d:' + id, r.n || id, r.score, `${fmt(r.score)} pts`]);
      for(const [id, r] of Object.entries(fd.parks || {})) l.push(['p:' + id, r.n || id, r.score, `${fmt(r.score)} pts`]);
      if(l.length || Object.keys(fd.slalom || {}).length){
        jeu('freeride', 'Freeride', '🏂');
        l.forEach(([k, n, v, a]) => ep('freeride', k, n, v, a));
        for(const [id, r] of Object.entries(fd.slalom || {})) if(r.temps) ep('freeride', 's:' + id, `Slalom · ${NOMS.slalom[id] || id}`, r.temps, `${String(r.temps).replace('.', ',')} s`, -1);
        const tout = [fd.infini, fd.parkInfini, ...Object.values(fd.descentes || {}), ...Object.values(fd.parks || {}), ...Object.values(fd.slalom || {})].filter(Boolean);
        J.freeride.stats = { 'Parties jouées':tout.reduce((s, r) => s + (r.parties || 0), 0), 'Étoiles':tout.reduce((s, r) => s + (r.etoiles || 0), 0) };
      }
    }
    // Tour de contrôle : chaque aérodrome et chaque niveau
    const tr = lire('tour-records') || {};
    const cartes = Object.entries(tr).filter(([k]) => k !== 'dernier');
    if(cartes.length){
      jeu('tour', 'Tour de contrôle', '🛬');
      for(const [k, r] of cartes){ const [c, n = 'normal'] = k.split('@'); ep('tour', k, `${NOMS.tour[c] || c} · ${NOMS.tourNiv[n] || n}`, r.best, `${fmt(r.best)} avions`); }
      J.tour.stats = { 'Parties jouées':cartes.reduce((s, [, r]) => s + (r.parties || 0), 0), 'Avions posés':cartes.reduce((s, [, r]) => s + (r.total || 0), 0) };
    }
    // Dichotomie (recherche de panne)
    const dp = lire('panne-records');
    if(dp && dp.parties){
      jeu('panne', 'Dichotomie', '📡');
      const NOMSP = { dialogue:'La liaison arrachée', aval:'Le bavard', ligne:'La ligne brouillée', elec:'Le câble électrique', court:'Le transfo qui saute', intermittent:'La panne fantôme', double:'Double peine', mystere:'Panne mystère' };
      for(const [id, r] of Object.entries(dp.niveaux || {})) if(r.reussies) ep('panne', id, NOMSP[id] || id, (r.etoiles || 0) * 100000 + Math.max(0, 999 - (r.gestes || 0)) * 100 + Math.max(0, 99 - Math.floor((r.temps || 5940) / 60)), `${'★'.repeat(r.etoiles || 0)} · ${r.gestes} geste${r.gestes > 1 ? 's' : ''}${r.temps != null ? ` · ${Math.floor(r.temps / 60)}:${String(r.temps % 60).padStart(2, '0')}` : ''}`);
      J.panne.stats = { 'Parties':dp.parties, 'Pannes réparées':dp.reussies || 0, 'Défis du jour réussis':dp.defisReussis || 0, 'Étoiles':Object.values(dp.niveaux || {}).reduce((s, r) => s + (r.etoiles || 0), 0) };
    }
    // Tir au panier
    const pn = lire('panier-records');
    if(pn && pn.parties){
      jeu('panier', 'Tir au panier', '🏀');
      ep('panier', 'meilleur', 'Meilleur score', pn.best, `${fmt(pn.best)} pts`);
      J.panier.stats = { 'Parties jouées':pn.parties, 'Paniers marqués':fmt(pn.paniers || 0), 'Score moyen':fmt((pn.cumul || 0) / pn.parties) };
    }
    // Tables au sommet
    const tb = lire('tables-progres');
    if(tb && tb.faits && Object.keys(tb.faits).length){
      jeu('tables', 'Tables au sommet', '✖️');
      const f = Object.values(tb.faits), sues = f.filter(x => x.serie >= 3).length, ok = f.reduce((s, x) => s + (x.ok || 0), 0), ko = f.reduce((s, x) => s + (x.ko || 0), 0);
      ep('tables', 'sues', 'Multiplications sues', sues, `${sues} / 55`);
      if(tb.record) ep('tables', 'chrono', 'Défi chrono (1 min)', tb.record, `${tb.record} bonnes réponses`);
      J.tables.stats = { 'Réponses':ok + ko, 'Bonnes réponses':pct(ok, ok + ko), 'Multiplications sues':sues };
    }
    // Les aventures de Pépin
    const pp = lire('pepin-progres');
    if(pp && (pp.meilleur || Object.keys(pp.faits || {}).length)){
      jeu('pepin', 'Les aventures de Pépin', '🍄');
      const n = Object.keys(pp.faits || {}).length;
      ep('pepin', 'meilleur', 'Meilleur score', pp.meilleur || 0, `${fmt(pp.meilleur || 0)} pts`);
      ep('pepin', 'niveaux', 'Niveaux réussis', n, `${n} / 16`);
      J.pepin.stats = { 'Niveaux réussis':n, 'Meilleur score':fmt(pp.meilleur || 0) };
    }
    // Le Grand Quiz
    const qr = lire('quiz-records'), qs = lire('quiz-stats');
    if((qr && (Object.keys(qr.echelle || {}).length || Object.keys(qr.serie || {}).length)) || (qs && qs.repondu)){
      jeu('quiz', 'Le Grand Quiz', '🏆');
      for(const [n, v] of Object.entries((qr && qr.echelle) || {})) ep('quiz', 'e:' + n, `Échelle · ${NOMS.quizNiv[n]}`, v, `${fmt(v)} pts`);
      for(const [n, v] of Object.entries((qr && qr.serie) || {})) ep('quiz', 's:' + n, `Série rapide · ${NOMS.quizNiv[n]}`, v, `${fmt(v)} pts`);
      if(qr && qr.bac && qr.bac.seul) ep('quiz', 'bac', 'Petit bac · meilleure manche en solo', qr.bac.seul, `${qr.bac.seul} pts`);
      const mil = Object.values((qr && qr.millions) || {}).reduce((s, v) => s + v, 0);
      J.quiz.stats = { 'Questions répondues':(qs && qs.repondu) || 0, 'Bonnes réponses':pct((qs && qs.justes) || 0, (qs && qs.repondu) || 0), 'Fois millionnaire':mil };
    }
    // Paddock : la carrière de directeur d'écurie
    const pk = lire('paddock-records');
    if(pk && pk.gp){
      jeu('paddock', 'Paddock', '🏎️');
      ep('paddock', 'victoires', 'Victoires en Grand Prix', pk.victoires || 0, `${pk.victoires || 0} victoire${pk.victoires > 1 ? 's' : ''}`);
      if(pk.saisons) ep('paddock', 'place', 'Meilleure place chez les constructeurs', 11 - (pk.meilleurePlace || 10), `${pk.meilleurePlace || 10}e`);
      ep('paddock', 'podiums', 'Podiums', pk.podiums || 0, `${pk.podiums || 0}`);
      J.paddock.stats = { 'Grands Prix':pk.gp, 'Points':pk.points || 0, 'Titres constructeurs':pk.titresC || 0, 'Titres pilotes':pk.titresP || 0, 'Pole positions':pk.poles || 0 };
    }
    // Blocs : le marathon
    // Escale : le niveau, les passagers, la meilleure journée
    const es = lire('escale-records');
    if(es && es.vols){
      jeu('escale', 'Escale', '✈️');
      ep('escale', 'niveau', 'Niveau atteint', es.niveau, `niveau ${es.niveau}`);
      ep('escale', 'pax', 'Passagers accueillis', es.pax, `${es.pax.toLocaleString('fr-FR')} passagers`);
      if(es.meilleureJournee > 0) ep('escale', 'journee', 'Meilleure journée', Math.round(es.meilleureJournee), `${Math.round(es.meilleureJournee).toLocaleString('fr-FR')} €`);
      J.escale.stats = { 'Vols':es.vols, 'Aéroports':es.aeroports, 'Jours':es.jours };
    }
    // Arpenteur : les points, les kilomètres, la collection
    const ap = lire('arpenteur-records');
    if(ap && ap.dernier && (ap.points || ap.km)){
      jeu('arpenteur', 'Arpenteur', '🧭');
      ep('arpenteur', 'points', 'Points d\'explorateur', ap.points, `${ap.points.toLocaleString('fr-FR')} points`);
      if(ap.km) ep('arpenteur', 'km', 'Kilomètres parcourus', Math.round(ap.km * 10), `${String(ap.km).replace('.', ',')} km`);
      if(ap.objets) ep('arpenteur', 'objets', 'Objets de la collection', ap.objets, `${ap.objets}/30 objets`);
      J.arpenteur.stats = { 'Sorties':ap.sorties, 'Pièces':ap.pieces, 'Lieux visités':ap.lieux, 'Niveau':ap.niveau };
    }
    // Le Buteur : le record en 60 secondes, le meilleur défi du jour, la meilleure série
    const ru = lire('rugby-records');
    if(ru && ru.chrono && ru.chrono.tentees){
      jeu('rugby', 'Le Buteur', '🏉'); const c = ru.chrono;
      if(c.parties) ep('rugby', 'chrono', '60 secondes', c.meilleur, `${c.meilleur} points`);
      if(ru.defiMeilleur) ep('rugby', 'defi', 'Meilleur défi du jour', ru.defiMeilleur, `${ru.defiMeilleur} points`);
      // les mini-jeux
      const mj = (k, n, f) => { const q = ru[k]; if(q && q.parties) ep('rugby', k, n, q.meilleur, f(q.meilleur)); };
      mj('distance', 'Record de distance', v => `${v} m`); mj('mortsubite', 'Mort subite', v => `${v} réussie${v > 1 ? 's' : ''} à la suite`);
      mj('pleincentre', 'Plein centre', v => `${v} points sur 100`); mj('tempete', 'Tempête', v => `${v} points`);
      if(c.serie) ep('rugby', 'serie', 'Meilleure série', c.serie, `${c.serie} à la suite`);
      J.rugby.stats = { 'Parties':c.parties || 0, 'Transformations réussies':c.reussies || 0, 'Réussite':c.tentees ? Math.round(c.reussies / c.tentees * 100) + ' %' : '—', 'Plus longue':(c.plusLongue || 0) + ' m' };
    }
    // Billard : les victoires contre le robot (par jeu et par niveau) et la meilleure série au billard français
    const bi = lire('billard-records');
    if(bi && (bi.pool || bi.carambole)){
      jeu('billard', 'Billard', '🎱');
      const NIV = { facile:'facile', moyen:'moyen', expert:'expert' }, NJ = { pool:'Pool', carambole:'Billard français' };
      for(const k of ['pool', 'carambole']) for(const n of Object.keys(NIV)){ const v = ((bi[k] || {}).v || {})[n]; if(v) ep('billard', `${k}:${n}`, `${NJ[k]} · victoires contre le robot ${n}`, v, `${v} victoire${v > 1 ? 's' : ''}`); }
      if(bi.carambole && bi.carambole.serie) ep('billard', 'serie', 'Billard français · meilleure série', bi.carambole.serie, `${bi.carambole.serie} points`);
      J.billard.stats = { 'Parties de pool':(bi.pool || {}).parties || 0, 'Parties de billard français':(bi.carambole || {}).parties || 0, 'Parties à deux':bi.deux || 0 };
    }
    // Flèche d'or : chaque concours, chaque parcours, les cibles mobiles et le meilleur défi du jour
    const ar = lire('arc-records');
    if(ar && ar.parties){
      jeu('arc', 'Flèche d\'or', '🏹');
      for(const [d, r] of Object.entries(ar.concours || {})) if(r.parties) ep('arc', 'c' + d, `Concours ${d} m`, r.score, `${r.score} / 90`);
      const NP = { marmottes:'Le Bois des Marmottes', chamois:'La Crête des Chamois' };
      for(const [id, r] of Object.entries(ar.parcours || {})) if(r.parties) ep('arc', 'p:' + id, `Parcours · ${NP[id] || id}`, r.score, `${r.score} points`);
      if(ar.mobiles && ar.mobiles.parties) ep('arc', 'mobiles', 'Cibles mobiles', ar.mobiles.score, `${ar.mobiles.score} points`);
      if(ar.defiMeilleur) ep('arc', 'defi', 'Meilleur défi du jour', ar.defiMeilleur, `${ar.defiMeilleur} / 90`);
      J.arc.stats = { 'Parties jouées':ar.parties, 'Flèches tirées':ar.fleches || 0, 'Dans le 10':ar.dix || 0, 'X (plein centre)':ar.x || 0 };
    }
    // Rock Altitude : les étoiles et le meilleur score
    const rk = lire('rock-records');
    if(rk && rk.parties){
      jeu('rock', 'Rock Altitude', '🎸');
      ep('rock', 'score', 'Meilleur score sur un morceau', rk.meilleur || 0, `${rk.meilleur || 0} points`);
      ep('rock', 'etoiles', 'Étoiles gagnées', rk.etoiles || 0, `${rk.etoiles || 0} ★`);
      J.rock.stats = { 'Morceaux joués':rk.parties, 'Notes réussies':rk.notes || 0 };
    }
    const nu = lire('nuancier-records');
    if(nu && nu.parties){
      jeu('nuancier', 'Nuancier', '🎨');
      ep('nuancier', 'score', 'Meilleure partie (10 couleurs)', nu.best || 0, `${String(nu.best || 0).replace('.', ',')} / 100`);
      ep('nuancier', 'parfaits', 'Couleurs parfaites', nu.parfaits || 0, `${nu.parfaits || 0} parfaite${nu.parfaits > 1 ? 's' : ''}`);
      J.nuancier.stats = { 'Parties':nu.parties, 'Couleurs trouvées':nu.couleurs || 0, 'Note moyenne':((nu.total || 0) / Math.max(1, nu.couleurs || 0)).toFixed(1).replace('.', ',') + ' / 10' };
    }
    const bl = lire('blocs-records');
    if(bl && bl.parties){
      jeu('blocs', 'Blocs', '🧱');
      ep('blocs', 'marathon', 'Marathon · meilleur score', bl.best || 0, `${fmt(bl.best || 0)} pts`);
      ep('blocs', 'niveau', 'Marathon · niveau atteint', bl.niveauMax || 0, `niveau ${bl.niveauMax || 0}`);
      J.blocs.stats = { 'Parties':bl.parties, 'Lignes':fmt(bl.lignes || 0), 'Blocs (4 lignes)':bl.blocs || 0, 'Meilleure partie (lignes)':bl.lignesMax || 0 };
    }
    // Chef de quai : chaque télésiège
    const ts = lire('telesiege-records'), tc = lire('telesiege-caisse');
    if(ts && ts.journees){
      jeu('telesiege', 'Chef de quai', '🚡');
      for(const [id, r] of Object.entries(ts.appareils || {})) ep('telesiege', id, NOMS.telesiege[id] || id, r.score || 0, `${fmt(r.score || 0)} pts${r.etoiles ? ' · ' + '★'.repeat(r.etoiles) : ''}`);
      J.telesiege.stats = { 'Journées':ts.journees, 'Skieurs montés':fmt(ts.montes || 0), 'Journées 3 étoiles':ts.etoiles3 || 0, 'Caisse':fmt(tc ? tc.argent : 0) + ' €' };
    }
    // Nivoculteur : chaque domaine
    const nv = lire('nivo-records') || {};
    if(Object.keys(nv).length){
      jeu('nivo', 'Nivoculteur', '❄️');
      for(const [id, r] of Object.entries(nv)) ep('nivo', id, NOMS.nivo[id] || id, r.points || 0, `${fmt(r.points || 0)} pts${r.etoiles ? ' · ' + '★'.repeat(r.etoiles) : ''}`);
      const l = Object.values(nv);
      J.nivo.stats = { 'Saisons jouées':l.reduce((s, r) => s + (r.parties || 0), 0), 'Étoiles':l.reduce((s, r) => s + (r.etoiles || 0), 0), 'Domaines':l.length };
    }
    return J;
  }
  return { calculer };
})();
