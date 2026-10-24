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
    const circuits = [...(window.CIRCUITS || []), ...(window.CIRCUITS_RALLYE || [])];
    let courses = 0;
    for(const [cle, r] of Object.entries(dr)){
      const miens = (r.courses || []).filter(c => estMoi(c.nom, pseudo)); if(!miens.length) continue;
      if(!J.drawrace) jeu('drawrace', 'Draw Race', '🏎️');
      // clé du circuit : son identifiant, puis « -3t » si le nombre de tours a changé, puis « ~v2 » pour un circuit redessiné
      const m = cle.match(/^(.*?)(?:-(\d+)t)?(?:~v\d+)?$/), c = circuits.find(x => x.id === m[1]);
      const nom = (c ? c.n : m[1]) + (m[2] ? ` (${m[2]} tours)` : '');
      const best = Math.min(...miens.map(c => c.temps));
      ep('drawrace', cle, nom, best, temps(best), -1);
      if(r.tour && estMoi(r.tour.nom, pseudo)) ep('drawrace', cle + ':tour', nom + ' · meilleur tour', r.tour.temps, temps(r.tour.temps), -1);
      courses += miens.length;
    }
    const titres = pal.filter(p => p.place === 1).length;
    if(J.drawrace || pal.length){
      if(!J.drawrace) jeu('drawrace', 'Draw Race', '🏎️');
      if(pal.length) ep('drawrace', 'championnats', 'Championnats gagnés', titres, fmt(titres));
      J.drawrace.stats = { 'Circuits courus':Object.keys(J.drawrace.epreuves).filter(k => !k.includes(':') && k !== 'championnats').length, 'Courses (dans les records)':courses, 'Championnats terminés':pal.length, 'Championnats gagnés':titres };
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
    // Blocs : le marathon
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
