/* Arpenteur : les quêtes, la chasse au trésor et la carte à découvrir (la logique, sans page : ce fichier tourne aussi avec Node).
   - Les missions du jour (3, tirées d'après la date) et la grande quête de la semaine (une des 6, d'après la semaine) ;
   - la chasse au trésor : un coffre caché, qu'on trouve à la température (froid / chaud) et à la distance ;
   - la carte à découvrir : des cases de 0,0009° × 0,0013° (environ 100 m), le brouillard se lève où l'on passe,
     et le pourcentage découvert d'une commune (d'après son contour OpenStreetMap). */
window.ARPENTEUR_QUETES = (() => {
  const O = window.ARPENTEUR_OBJETS;
  const km = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits:1 })} km`;

  /* ---------- Les missions du jour ---------- */
  // niv : [cible, points] du plus facile au plus dur ; ev : l'événement qui les fait avancer
  const MISSIONS = [
    { id:'marche', ico:'🥾', ev:'metres', niv:[[800, 40], [1500, 70], [3000, 130]], txt:n => `Marche ${km(n)} pendant une sortie` },
    { id:'pieces', ico:'🪙', ev:'piece', niv:[[10, 40], [20, 70], [35, 120]], txt:n => `Ramasse ${n} pièces` },
    { id:'objets', ico:'💎', ev:'objet', niv:[[1, 40], [2, 70], [3, 110]], txt:n => n === 1 ? 'Trouve 1 objet' : `Trouve ${n} objets` },
    { id:'rare', ico:'✨', ev:'objetRare', niv:[[1, 110]], txt:() => 'Trouve un objet rare, épique ou légendaire' },
    { id:'nature', ico:'🌿', ev:'album:nature', niv:[[1, 50], [2, 90]], txt:n => `Trouve ${n === 1 ? 'un objet' : n + ' objets'} de l'album Nature et montagne` },
    { id:'patrimoine', ico:'🏺', ev:'album:patrimoine', niv:[[1, 50], [2, 90]], txt:n => `Trouve ${n === 1 ? 'un objet' : n + ' objets'} de l'album Trésors et patrimoine` },
    { id:'lieu', ico:'🏛️', ev:'lieu', niv:[[1, 90], [2, 160]], txt:n => n === 1 ? 'Visite un lieu Wikipédia' : `Visite ${n} lieux Wikipédia` },
    { id:'tresor', ico:'🧭', ev:'tresor', niv:[[1, 90], [2, 160]], txt:n => n === 1 ? 'Trouve un coffre caché' : `Trouve ${n} coffres cachés` },
    { id:'cases', ico:'🌫️', ev:'case', niv:[[15, 40], [40, 80], [80, 140]], txt:n => `Fais reculer le brouillard de ${n} cases` },
    { id:'sortie', ico:'🏁', ev:'sortie', niv:[[1, 50]], txt:() => 'Termine une sortie de 500 m ou plus' },
  ];
  const PAR_ID = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
  const BONUS_JOUR = 100;

  /* ---------- La grande quête de la semaine ---------- */
  // buts : [événement, cible, libellé]
  const HEBDOS = [
    { id:'balade', ico:'🥾', nom:'La grande balade', txt:'Une belle semaine de marche, avec une visite au bout du chemin.', buts:[['metres', 10000, 'Marcher 10 km'], ['lieu', 1, 'Visiter un lieu Wikipédia']], pts:400, medaille:'Grand marcheur' },
    { id:'collection', ico:'💎', nom:'Le collectionneur', txt:'Remplis ton album, et déniche quelques pièces rares.', buts:[['objet', 10, 'Trouver 10 objets'], ['objetRare', 2, 'Dont 2 rares ou mieux']], pts:450, medaille:'Collectionneur' },
    { id:'coffres', ico:'🧭', nom:'Le chasseur de coffres', txt:'Suis la boussole chaud / froid jusqu\'à plusieurs coffres.', buts:[['tresor', 4, 'Trouver 4 coffres'], ['metres', 4000, 'Marcher 4 km']], pts:500, medaille:'Chasseur de coffres' },
    { id:'cartographe', ico:'🗺️', nom:'Le cartographe', txt:'Fais reculer le brouillard autour de chez toi et plus loin.', buts:[['case', 120, 'Découvrir 120 cases'], ['lieu', 1, 'Visiter un lieu Wikipédia']], pts:450, medaille:'Cartographe' },
    { id:'conservateur', ico:'🏛️', nom:'Le conservateur', txt:'Le patrimoine : des lieux à visiter et des trésors à rapporter.', buts:[['lieu', 3, 'Visiter 3 lieux'], ['album:patrimoine', 3, 'Trouver 3 objets du patrimoine']], pts:500, medaille:'Conservateur' },
    { id:'infatigable', ico:'🔥', nom:'L\'infatigable', txt:'Sortir souvent : trois sorties, et de la distance.', buts:[['sortie', 3, 'Faire 3 sorties de 500 m ou plus'], ['metres', 8000, 'Marcher 8 km']], pts:450, medaille:'Infatigable' },
  ];
  const HEBDO_PAR_ID = Object.fromEntries(HEBDOS.map(h => [h.id, h]));

  const jourDe = d => O.jourDe(d);
  function hier(jour){ const [a, m, j] = jour.split('-').map(Number); return jourDe(new Date(a, m - 1, j - 1)); }
  function semaineDe(d = new Date()){
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), j = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - j);
    const a = t.getUTCFullYear(), s = Math.ceil(((t - Date.UTC(a, 0, 1)) / 86400000 + 1) / 7);
    return `${a}-S${String(s).padStart(2, '0')}`;
  }
  const faire = (m, k) => ({ id:m.id, cible:m.niv[k][0], pts:m.niv[k][1], prog:0, fait:false });
  function missionsDuJour(jour){
    const r = O.alea(O.hache('missions:' + jour)), pool = MISSIONS.slice(), choix = [], rang = [0, 1, r() < .5 ? 1 : 2];
    while(choix.length < 3) choix.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return choix.map((m, i) => faire(m, Math.min(rang[i], m.niv.length - 1)));
  }
  function hebdoDeLaSemaine(sem, avant){
    const r = O.alea(O.hache('hebdo:' + sem)), pool = HEBDOS.filter(h => h.id !== avant), h = pool[Math.floor(r() * pool.length)];
    return { id:h.id, buts:h.buts.map(b => ({ ev:b[0], cible:b[1], prog:0 })), fait:false };
  }
  const nouvelle = () => ({ v:1, jour:'', missions:[], remplace:false, serie:0, derniere:'', semaine:'', hebdo:null, medailles:[], faites:0, hebdos:0,
    tresor:null, coffres:0, cases:[], communes:{} });

  // met la journée et la semaine à jour (à appeler avant de lire ou de compter)
  function actualiser(Q, date = new Date()){
    const j = jourDe(date), s = semaineDe(date);
    if(Q.jour !== j){ Q.jour = j; Q.missions = missionsDuJour(j); Q.remplace = false; }
    if(Q.semaine !== s){ Q.hebdo = hebdoDeLaSemaine(s, Q.hebdo && Q.hebdo.id); Q.semaine = s; }
    return Q;
  }
  const serieActuelle = Q => Q.derniere === Q.jour || Q.derniere === hier(Q.jour) ? Q.serie : 0;

  // les événements qu'un fait du jeu déclenche : type 'objet' (info : rar, album), 'piece', 'metres' (n = mètres), 'lieu', 'tresor', 'case' (n), 'sortie'
  function nomsEv(type, info){
    if(type !== 'objet') return [type];
    const l = ['objet']; if(info && info.rar && info.rar !== 'commun') l.push('objetRare'); if(info && info.album) l.push('album:' + info.album); return l;
  }
  // fait avancer les missions et la quête de la semaine ; rend ce qui vient d'être réussi (le jeu donne les points)
  function evenement(Q, type, n = 1, info = null){
    actualiser(Q);
    const evs = nomsEv(type, info), fini = [];
    for(const m of Q.missions){
      if(m.fait || !evs.includes(PAR_ID[m.id].ev)) continue;
      m.prog = Math.min(m.cible, m.prog + n);
      if(m.prog >= m.cible){ m.fait = true; Q.faites++; fini.push({ genre:'mission', ico:PAR_ID[m.id].ico, titre:PAR_ID[m.id].txt(m.cible), pts:m.pts }); }
    }
    if(Q.missions.length && Q.missions.every(m => m.fait) && Q.derniere !== Q.jour){
      Q.serie = Q.derniere === hier(Q.jour) ? Q.serie + 1 : 1; Q.derniere = Q.jour;
      fini.push({ genre:'jour', ico:'🌟', titre:`Les 3 missions du jour${Q.serie > 1 ? ` · série de ${Q.serie} jours` : ''}`, pts:BONUS_JOUR + 20 * Math.min(Q.serie - 1, 5) });
    }
    const H = Q.hebdo;
    if(H && !H.fait){
      for(const b of H.buts) if(evs.includes(b.ev)) b.prog = Math.min(b.cible, b.prog + n);
      if(H.buts.every(b => b.prog >= b.cible)){
        H.fait = true; Q.hebdos++; const d = HEBDO_PAR_ID[H.id];
        Q.medailles.push({ id:H.id, semaine:Q.semaine, nom:d.medaille, ico:d.ico });
        fini.push({ genre:'semaine', ico:d.ico, titre:`Quête de la semaine : ${d.nom} (médaille « ${d.medaille} »)`, pts:d.pts });
      }
    }
    return fini;
  }
  // remplacer une mission pas encore réussie par une autre (une fois par jour)
  function remplacer(Q, i){
    actualiser(Q); const m = Q.missions[i];
    if(!m || m.fait || Q.remplace) return false;
    const pris = Q.missions.map(x => x.id), pool = MISSIONS.filter(x => !pris.includes(x.id)), r = O.alea(O.hache(`remplace:${Q.jour}:${i}:${m.id}`));
    const nouv = pool[Math.floor(r() * pool.length)], k = Math.min(Math.max(0, PAR_ID[m.id].niv.findIndex(x => x[0] === m.cible)), nouv.niv.length - 1);
    Q.missions[i] = faire(nouv, k); Q.remplace = true; return true;
  }

  /* ---------- La chasse au trésor ---------- */
  const PORTEE_COFFRE = 25;
  // un coffre à 200–300 m, puis de plus en plus loin (jusqu'à un peu plus d'un kilomètre), dans une direction au hasard
  function placerCoffre(lat, lon, n, graine){
    const r = O.alea(O.hache(`coffre:${graine}:${n}`)), dist = (250 + Math.min(n, 6) * 130) * (.8 + r() * .4), p = O.deplacer(lat, lon, r() * 360, dist);
    return { lat:p.lat, lon:p.lon };
  }
  // la température : plus on est près, plus ça chauffe
  const CHALEURS = [[60, 5, 'Brûlant', '🌋'], [120, 4, 'Chaud', '🔥'], [250, 3, 'Tiède', '🌤️'], [500, 2, 'Froid', '🥶'], [Infinity, 1, 'Glacial', '🧊']];
  function chaleur(d){ const c = CHALEURS.find(x => d <= x[0]); return { n:c[1], nom:c[2], ico:c[3], pc:Math.max(0, Math.min(1, 1 - Math.log(Math.max(d, PORTEE_COFFRE) / PORTEE_COFFRE) / Math.log(1000 / PORTEE_COFFRE))) }; }
  // plus chaud ou plus froid qu'à la mesure d'avant (on ne réagit qu'à 4 m ou plus)
  const tendance = (avant, d) => avant == null ? 0 : d < avant - 4 ? 1 : d > avant + 4 ? -1 : 0;
  // le butin : des points, des pièces, et un objet rare (toujours au moins rare)
  function butin(n, graine){
    const r = O.alea(O.hache(`butin:${graine}:${n}`)), u = r(), rar = u < .55 ? 'rare' : u < .92 ? 'epique' : 'legendaire', l = Object.values(O.TOUS).filter(o => o.rar === rar);
    return { pts:60 + 15 * Math.min(n, 8), pieces:5 + 2 * Math.min(n, 5), objet:l[Math.floor(r() * l.length)].id };
  }

  /* ---------- La carte à découvrir ---------- */
  const PAS_Y = .0009, PAS_X = .0013, RAYON_DECOUVERTE = 60, PTS_CASE = 1;
  const cleDe = (gy, gx) => gy * 40000 + (gx + 10000);
  const deCle = k => { const gy = Math.floor(k / 40000); return { gy, gx:k - gy * 40000 - 10000 }; };
  const centreDe = (gy, gx) => ({ lat:(gy + .5) * PAS_Y, lon:(gx + .5) * PAS_X });
  // les cases dont le centre est à moins de 60 m d'un point
  function casesProches(lat, lon, rayon = RAYON_DECOUVERTE){
    const gy0 = Math.floor(lat / PAS_Y), gx0 = Math.floor(lon / PAS_X), l = [];
    for(let gy = gy0 - 1; gy <= gy0 + 1; gy++) for(let gx = gx0 - 1; gx <= gx0 + 1; gx++){
      const c = centreDe(gy, gx); if(O.distance(lat, lon, c.lat, c.lon) <= rayon) l.push(cleDe(gy, gx));
    }
    return l;
  }
  // lève le brouillard autour d'un point (et le long du trajet depuis le point d'avant) ; rend les cases nouvelles
  function decouvrir(cases, lat, lon, depuis){
    const neuves = [], vu = k => { if(!cases.has(k)){ cases.add(k); neuves.push(k); } };
    const d = depuis ? O.distance(depuis.lat, depuis.lon, lat, lon) : 0, pas = d > 30 && d <= 250 ? Math.ceil(d / 30) : 1;
    for(let i = 1; i <= pas; i++){ const t = i / pas; casesProches(depuis && pas > 1 ? depuis.lat + (lat - depuis.lat) * t : lat, depuis && pas > 1 ? depuis.lon + (lon - depuis.lon) * t : lon).forEach(vu); }
    return neuves;
  }
  // le contour d'une commune (GeoJSON Polygon ou MultiPolygon d'OpenStreetMap) : on garde les anneaux, allégés
  function communeDe(nom, geo){
    const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates, anneaux = [];
    let total = 0; polys.forEach(p => p.forEach(a => { total += a.length; }));
    const pas = Math.max(1, Math.ceil(total / 2500));
    polys.forEach(p => p.forEach(a => { const r = []; for(let i = 0; i < a.length; i += pas) r.push([+a[i][0].toFixed(5), +a[i][1].toFixed(5)]); r.push([+a[a.length - 1][0].toFixed(5), +a[a.length - 1][1].toFixed(5)]); anneaux.push(r); }));
    let s = 90, o = 180, n = -90, e = -180;
    anneaux.forEach(a => a.forEach(([x, y]) => { if(y < s) s = y; if(y > n) n = y; if(x < o) o = x; if(x > e) e = x; }));
    return { nom, bbox:[s, o, n, e], anneaux, total:0, vues:0 };
  }
  // le point est-il dans les anneaux ? (règle pair/impair : les trous et les îles marchent)
  function dedans(lat, lon, anneaux){
    let d = false;
    for(const a of anneaux) for(let i = 0, j = a.length - 1; i < a.length; j = i++){
      const xi = a[i][0], yi = a[i][1], xj = a[j][0], yj = a[j][1];
      if((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) d = !d;
    }
    return d;
  }
  const dansBbox = (lat, lon, b) => lat >= b[0] && lat <= b[2] && lon >= b[1] && lon <= b[3];
  // compte les cases de la commune (le total, et celles déjà découvertes)
  function compter(c, cases){
    const [s, o, n, e] = c.bbox; let total = 0, vues = 0;
    for(let gy = Math.floor(s / PAS_Y); gy <= Math.floor(n / PAS_Y); gy++) for(let gx = Math.floor(o / PAS_X); gx <= Math.floor(e / PAS_X); gx++){
      const q = centreDe(gy, gx); if(!dansBbox(q.lat, q.lon, c.bbox) || !dedans(q.lat, q.lon, c.anneaux)) continue;
      total++; if(cases.has(cleDe(gy, gx))) vues++;
    }
    c.total = total; c.vues = vues; return c;
  }
  // une case vient d'être découverte : elle compte pour les communes qui la contiennent
  function ajouterCase(communes, k){
    const { gy, gx } = deCle(k), q = centreDe(gy, gx);
    for(const c of Object.values(communes)) if(dansBbox(q.lat, q.lon, c.bbox) && dedans(q.lat, q.lon, c.anneaux)) c.vues = Math.min(c.total, c.vues + 1);
  }
  const pourcent = c => c && c.total ? 100 * c.vues / c.total : 0;
  // 1 case = environ 1 hectare
  const hectares = cases => Math.round(cases.size * PAS_Y * 110540 * PAS_X * 111320 * Math.cos(46 * Math.PI / 180) / 10000);

  /* ---------- Les essais (avec Node : `node jeux/arpenteur/quetes.js` après avoir défini window et chargé objets.js) ---------- */
  function tests(){
    const r = [], ok = (c, t) => r.push((c ? '✅ ' : '❌ ') + t);
    const d1 = new Date(2026, 10, 14), d2 = new Date(2026, 10, 15);
    const a = missionsDuJour(jourDe(d1)), b = missionsDuJour(jourDe(d1)), c = missionsDuJour(jourDe(d2));
    ok(a.length === 3 && new Set(a.map(m => m.id)).size === 3, `3 missions différentes (${a.map(m => m.id).join(', ')})`);
    ok(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), 'les missions dépendent du jour, pas du moment');
    const Q = actualiser(nouvelle(), d1);
    ok(Q.missions.length === 3 && Q.hebdo && Q.semaine === '2026-S46', `semaine ${Q.semaine} : ${Q.hebdo.id}`);
    ok(semaineDe(new Date(2026, 0, 1)) === '2026-S01' && semaineDe(new Date(2025, 11, 29)) === '2026-S01' && semaineDe(new Date(2027, 0, 3)) === '2026-S53', 'numéros de semaine (ISO)');
    // les événements font avancer les missions
    const Q2 = actualiser(nouvelle(), new Date()); Q2.missions = [faire(PAR_ID.pieces, 0), faire(PAR_ID.objets, 0), faire(PAR_ID.marche, 0)];
    let f = []; for(let i = 0; i < 10; i++) f = f.concat(evenement(Q2, 'piece'));
    ok(f.length === 1 && f[0].genre === 'mission' && Q2.missions[0].fait, 'dix pièces : la mission des pièces est réussie');
    f = evenement(Q2, 'objet', 1, { rar:'commun', album:'nature' }); ok(f.some(x => x.genre === 'mission') && Q2.missions[1].fait, 'un objet : mission réussie');
    f = evenement(Q2, 'metres', 900); ok(f.some(x => x.genre === 'jour') && Q2.serie === 1 && Q2.derniere === Q2.jour, 'les 3 missions : bonus du jour et série de 1');
    ok(evenement(Q2, 'metres', 900).length === 0, 'pas de bonus en double');
    // série
    const Q3 = actualiser(nouvelle(), d1); Q3.missions.forEach(m => { m.fait = true; }); Q3.serie = 4; Q3.derniere = jourDe(new Date(2026, 10, 13)); Q3.jour = jourDe(d1);
    ok(serieActuelle(Q3) === 4, 'la série continue si hier était réussi'); Q3.derniere = jourDe(new Date(2026, 10, 10)); ok(serieActuelle(Q3) === 0, 'la série retombe à 0 après un jour manqué');
    // la semaine
    const Q4 = actualiser(nouvelle(), new Date()); Q4.hebdo = { id:'coffres', fait:false, buts:[{ ev:'tresor', cible:2, prog:0 }, { ev:'metres', cible:100, prog:0 }] }; Q4.missions = [];
    evenement(Q4, 'tresor'); evenement(Q4, 'metres', 150); f = evenement(Q4, 'tresor');
    ok(f.length === 1 && f[0].genre === 'semaine' && Q4.medailles.length === 1 && Q4.hebdo.fait, 'quête de la semaine réussie : médaille et points');
    ok(HEBDOS.every(h => HEBDO_PAR_ID[hebdoDeLaSemaine('2026-S10', h.id).id].id !== h.id), 'la quête change d\'une semaine à l\'autre');
    // remplacer une mission
    const Q5 = actualiser(nouvelle(), new Date()), avant = Q5.missions[2].id; ok(remplacer(Q5, 2) && Q5.missions[2].id !== avant && !remplacer(Q5, 1), 'une mission remplacée par jour');
    // chasse
    const p0 = { lat:45.92, lon:6.87 }; let bon = true;
    for(let n = 0; n < 8; n++){ const q = placerCoffre(p0.lat, p0.lon, n, 'x' + n), dd = O.distance(p0.lat, p0.lon, q.lat, q.lon), att = 250 + Math.min(n, 6) * 130; if(dd < att * .79 || dd > att * 1.21) bon = false; }
    ok(bon, 'les coffres sont de plus en plus loin (200 m à 1,2 km)');
    ok(chaleur(30).nom === 'Brûlant' && chaleur(100).nom === 'Chaud' && chaleur(200).nom === 'Tiède' && chaleur(400).nom === 'Froid' && chaleur(900).nom === 'Glacial', 'température selon la distance');
    ok(tendance(100, 90) === 1 && tendance(100, 110) === -1 && tendance(100, 101) === 0 && tendance(null, 50) === 0, 'plus chaud / plus froid');
    ok(['rare', 'epique', 'legendaire'].includes(O.TOUS[butin(2, 'g').objet].rar), 'le butin est au moins rare');
    // carte
    const cases = new Set(); let n1 = decouvrir(cases, 45.92, 6.87, null); ok(n1.length >= 1 && n1.length <= 9, `${n1.length} cases levées au premier point`);
    ok(decouvrir(cases, 45.92, 6.87, null).length === 0, 'rien de nouveau au même point');
    const m1 = decouvrir(cases, 45.9209, 6.87, { lat:45.92, lon:6.87 }); ok(m1.length >= 0 && cases.size > n1.length, 'on avance : de nouvelles cases');
    const long = new Set(); decouvrir(long, 45.92, 6.87, null); const nl = decouvrir(long, 45.922, 6.87, { lat:45.92, lon:6.87 }).length; ok(nl >= 2, `un trajet de 220 m lève ${nl} cases sans trous`);
    const k = cleDe(51000, -3000), dk = deCle(k); ok(dk.gy === 51000 && dk.gx === -3000, 'la clé d\'une case se décode (même à l\'ouest de Greenwich)');
    const carre = communeDe('Test', { type:'Polygon', coordinates:[[[6.86, 45.91], [6.88, 45.91], [6.88, 45.93], [6.86, 45.93], [6.86, 45.91]]] });
    ok(dedans(45.92, 6.87, carre.anneaux) && !dedans(45.95, 6.87, carre.anneaux) && !dedans(45.92, 6.9, carre.anneaux), 'point dans le contour');
    const trou = communeDe('Trou', { type:'Polygon', coordinates:[[[6.8, 45.9], [6.9, 45.9], [6.9, 46], [6.8, 46], [6.8, 45.9]], [[6.84, 45.94], [6.86, 45.94], [6.86, 45.96], [6.84, 45.96], [6.84, 45.94]]] });
    ok(!dedans(45.95, 6.85, trou.anneaux) && dedans(45.92, 6.82, trou.anneaux), 'un trou dans la commune n\'en fait pas partie');
    compter(carre, cases); ok(carre.total > 250 && carre.total < 450 && carre.vues >= 1, `commune de test : ${carre.total} cases, ${carre.vues} vues (${pourcent(carre).toFixed(2)} %)`);
    const co = { Test:carre }, avantV = carre.vues; ajouterCase(co, cleDe(Math.floor(45.915 / PAS_Y), Math.floor(6.865 / PAS_X))); ok(carre.vues === avantV + 1, 'une case nouvelle compte pour sa commune');
    ok(hectares(new Set(Array.from({ length:100 }, (_, i) => i))) > 50, 'une case = environ un hectare');
    return r;
  }

  return { MISSIONS, PAR_ID, HEBDOS, HEBDO_PAR_ID, BONUS_JOUR, PORTEE_COFFRE, PTS_CASE, PAS_Y, PAS_X, nouvelle, actualiser, serieActuelle, evenement, remplacer, semaineDe, hier,
    placerCoffre, chaleur, tendance, butin, cleDe, deCle, centreDe, decouvrir, communeDe, dedans, dansBbox, compter, ajouterCase, pourcent, hectares, tests };
})();
