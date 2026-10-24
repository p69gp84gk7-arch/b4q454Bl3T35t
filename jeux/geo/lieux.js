/* Jeu de géographie, mode « Placer » : les villes, monuments et sites à placer sur la carte,
   et le calcul qui passe d'un point de la carte à sa latitude et sa longitude (pour mesurer la distance en km).
   Les deux cartes sont dessinées par outils/construire-geo.mjs avec d3-geo :
   - monde : projection Natural Earth (centrée sur 11° E), échelle et décalage ci-dessous ;
   - France métropolitaine : projection conique conforme de Lambert (parallèles 44° et 49°, centrée sur 3° E).
   Les nombres viennent de proj.scale() et proj.translate() dans ce script (ils y sont affichés à chaque construction).
   Lieux : [nom, latitude, longitude, type, pays ou indice, continent]. Types : v ville, m monument, n nature, s station de ski. */
window.GEO_LIEUX = (() => {
  const RAD = Math.PI / 180, DEMI = Math.PI / 2;

  /* ---------- Monde : Natural Earth 1 ---------- */
  const NE = { k:182.78964407016804, tx:500, ty:259.9982544540716, l0:11 };
  function neBrut(l, p){
    const p2 = p * p, p4 = p2 * p2;
    return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
      p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
  }
  function neInverse(x, y){
    // Newton : on cherche la latitude qui donne ce y, puis la longitude
    let p = y, d, i = 25;
    do{
      const p2 = p * p, p4 = p2 * p2;
      d = (p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))) - y) /
        (1.007226 + p2 * (0.015085 * 3 + p4 * (-0.044475 * 7 + 0.028874 * 9 * p2 - 0.005916 * 11 * p4)));
      p -= d;
    } while(Math.abs(d) > 1e-9 && --i > 0);
    const p2 = p * p;
    return [x / (0.8707 + p2 * (-0.131979 + p2 * (-0.013791 + p2 * p2 * p2 * (0.003971 - 0.001529 * p2)))), p];
  }
  const normLon = l => ((l + 540) % 360) - 180;
  const monde = {
    versCarte(lat, lon){ const [x, y] = neBrut(normLon(lon - NE.l0) * RAD, lat * RAD); return [NE.tx + NE.k * x, NE.ty - NE.k * y]; },
    versGeo(x, y){ const [l, p] = neInverse((x - NE.tx) / NE.k, (NE.ty - y) / NE.k); return [Math.max(-90, Math.min(90, p / RAD)), normLon(l / RAD + NE.l0)]; },
  };

  /* ---------- France : conique conforme de Lambert ---------- */
  const LC = { k:4358.663114644742, tx:619.868351403486, ty:4331.0609284791935, l0:3, p0:44, p1:49 };
  const tg = p => Math.tan((DEMI + p) / 2);
  const cy0 = Math.cos(LC.p0 * RAD), nC = Math.log(cy0 / Math.cos(LC.p1 * RAD)) / Math.log(tg(LC.p1 * RAD) / tg(LC.p0 * RAD)), fC = cy0 * Math.pow(tg(LC.p0 * RAD), nC) / nC;
  const france = {
    versCarte(lat, lon){ const l = (lon - LC.l0) * RAD, r = fC / Math.pow(tg(lat * RAD), nC); return [LC.tx + LC.k * r * Math.sin(nC * l), LC.ty - LC.k * (fC - r * Math.cos(nC * l))]; },
    versGeo(x, y){
      const X = (x - LC.tx) / LC.k, fy = fC - (LC.ty - y) / LC.k, r = Math.sign(nC) * Math.sqrt(X * X + fy * fy);
      let l = Math.atan2(X, Math.abs(fy)) * Math.sign(fy);
      if(fy * nC < 0) l -= Math.PI * Math.sign(X) * Math.sign(fy);
      return [(2 * Math.atan(Math.pow(fC / r, 1 / nC)) - DEMI) / RAD, l / nC / RAD + LC.l0];
    },
  };

  // Distance à vol d'oiseau entre deux points de la Terre, en km (formule de haversine)
  function distanceKm(lat1, lon1, lat2, lon2){
    const a = Math.sin((lat2 - lat1) * RAD / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin((lon2 - lon1) * RAD / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  // Les points : 5000 tout près, la moitié tous les « demi » km, 0 au-delà de « max »
  const BAREMES = { monde:{ pile:25, demi:300, max:4000 }, france:{ pile:3, demi:50, max:600 } };
  function points(carte, km){
    const b = BAREMES[carte];
    if(km <= b.pile) return 5000;
    if(km >= b.max) return 0;
    return Math.round(5000 * Math.pow(.5, (km - b.pile) / b.demi));
  }

  /* ---------- Les lieux du monde ---------- */
  const MONDE = [
    // Europe
    ['Paris', 48.8566, 2.3522, 'v', 'France', 'europe'], ['Londres', 51.5074, -0.1278, 'v', 'Royaume-Uni', 'europe'],
    ['Berlin', 52.52, 13.405, 'v', 'Allemagne', 'europe'], ['Madrid', 40.4168, -3.7038, 'v', 'Espagne', 'europe'],
    ['Rome', 41.9028, 12.4964, 'v', 'Italie', 'europe'], ['Lisbonne', 38.7223, -9.1393, 'v', 'Portugal', 'europe'],
    ['Amsterdam', 52.3676, 4.9041, 'v', 'Pays-Bas', 'europe'], ['Bruxelles', 50.8503, 4.3517, 'v', 'Belgique', 'europe'],
    ['Vienne', 48.2082, 16.3738, 'v', 'Autriche', 'europe'], ['Prague', 50.0755, 14.4378, 'v', 'Tchéquie', 'europe'],
    ['Varsovie', 52.2297, 21.0122, 'v', 'Pologne', 'europe'], ['Budapest', 47.4979, 19.0402, 'v', 'Hongrie', 'europe'],
    ['Athènes', 37.9838, 23.7275, 'v', 'Grèce', 'europe'], ['Stockholm', 59.3293, 18.0686, 'v', 'Suède', 'europe'],
    ['Oslo', 59.9139, 10.7522, 'v', 'Norvège', 'europe'], ['Copenhague', 55.6761, 12.5683, 'v', 'Danemark', 'europe'],
    ['Helsinki', 60.1699, 24.9384, 'v', 'Finlande', 'europe'], ['Dublin', 53.3498, -6.2603, 'v', 'Irlande', 'europe'],
    ['Édimbourg', 55.9533, -3.1883, 'v', 'Royaume-Uni', 'europe'], ['Barcelone', 41.3874, 2.1686, 'v', 'Espagne', 'europe'],
    ['Venise', 45.4408, 12.3155, 'v', 'Italie', 'europe'], ['Moscou', 55.7558, 37.6173, 'v', 'Russie', 'europe'],
    ['Saint-Pétersbourg', 59.9311, 30.3609, 'v', 'Russie', 'europe'], ['Istanbul', 41.0082, 28.9784, 'v', 'Turquie', 'europe'],
    ['Genève', 46.2044, 6.1432, 'v', 'Suisse', 'europe'], ['Munich', 48.1351, 11.582, 'v', 'Allemagne', 'europe'],
    ['Reykjavik', 64.1466, -21.9426, 'v', 'Islande', 'europe'], ['Kiev', 50.4501, 30.5234, 'v', 'Ukraine', 'europe'],
    ['Bucarest', 44.4268, 26.1025, 'v', 'Roumanie', 'europe'], ['Naples', 40.8518, 14.2681, 'v', 'Italie', 'europe'],
    ['Séville', 37.3891, -5.9845, 'v', 'Espagne', 'europe'], ['Milan', 45.4642, 9.19, 'v', 'Italie', 'europe'],
    ['La tour Eiffel', 48.8584, 2.2945, 'm', 'Paris, France', 'europe'], ['Le Colisée', 41.8902, 12.4922, 'm', 'Rome, Italie', 'europe'],
    ['Big Ben', 51.5007, -0.1246, 'm', 'Londres, Royaume-Uni', 'europe'], ['La Sagrada Família', 41.4036, 2.1744, 'm', 'Barcelone, Espagne', 'europe'],
    ['La tour de Pise', 43.723, 10.3966, 'm', 'Italie', 'europe'], ['L\'Acropole', 37.9715, 23.7257, 'm', 'Athènes, Grèce', 'europe'],
    ['Stonehenge', 51.1789, -1.8262, 'm', 'Royaume-Uni', 'europe'], ['La porte de Brandebourg', 52.5163, 13.3777, 'm', 'Berlin, Allemagne', 'europe'],
    ['La place Rouge', 55.7539, 37.6208, 'm', 'Moscou, Russie', 'europe'], ['Le Mont-Saint-Michel', 48.6361, -1.5115, 'm', 'France', 'europe'],
    ['Le château de Neuschwanstein', 47.5576, 10.7498, 'm', 'Allemagne', 'europe'], ['L\'Alhambra', 37.1761, -3.5881, 'm', 'Grenade, Espagne', 'europe'],
    ['La basilique Saint-Pierre', 41.9022, 12.4539, 'm', 'Vatican', 'europe'],
    ['Le mont Blanc', 45.8326, 6.8652, 'n', 'France et Italie', 'europe'], ['Le Cervin', 45.9763, 7.6586, 'n', 'Suisse et Italie', 'europe'],
    ['Le fjord de Geiranger', 62.1049, 7.0947, 'n', 'Norvège', 'europe'], ['L\'Etna', 37.751, 14.9934, 'n', 'Sicile, Italie', 'europe'],
    ['Les falaises de Moher', 52.9715, -9.4309, 'n', 'Irlande', 'europe'], ['Le cap Nord', 71.1709, 25.7838, 'n', 'Norvège', 'europe'],
    // Afrique
    ['Le Caire', 30.0444, 31.2357, 'v', 'Égypte', 'afrique'], ['Marrakech', 31.6295, -7.9811, 'v', 'Maroc', 'afrique'],
    ['Casablanca', 33.5731, -7.5898, 'v', 'Maroc', 'afrique'], ['Dakar', 14.7167, -17.4677, 'v', 'Sénégal', 'afrique'],
    ['Lagos', 6.5244, 3.3792, 'v', 'Nigeria', 'afrique'], ['Nairobi', -1.2921, 36.8219, 'v', 'Kenya', 'afrique'],
    ['Le Cap', -33.9249, 18.4241, 'v', 'Afrique du Sud', 'afrique'], ['Johannesburg', -26.2041, 28.0473, 'v', 'Afrique du Sud', 'afrique'],
    ['Kinshasa', -4.4419, 15.2663, 'v', 'RD Congo', 'afrique'], ['Addis-Abeba', 9.03, 38.74, 'v', 'Éthiopie', 'afrique'],
    ['Alger', 36.7538, 3.0588, 'v', 'Algérie', 'afrique'], ['Tunis', 36.8065, 10.1815, 'v', 'Tunisie', 'afrique'],
    ['Abidjan', 5.36, -4.0083, 'v', 'Côte d\'Ivoire', 'afrique'], ['Tombouctou', 16.7666, -3.0026, 'v', 'Mali', 'afrique'],
    ['Antananarivo', -18.8792, 47.5079, 'v', 'Madagascar', 'afrique'], ['Zanzibar', -6.1659, 39.2026, 'v', 'Tanzanie', 'afrique'],
    ['Les pyramides de Gizeh', 29.9792, 31.1342, 'm', 'Égypte', 'afrique'], ['Le temple d\'Abou Simbel', 22.3372, 31.6258, 'm', 'Égypte', 'afrique'],
    ['La grande mosquée de Djenné', 13.9056, -4.5554, 'm', 'Mali', 'afrique'],
    ['Le Kilimandjaro', -3.0674, 37.3556, 'n', 'Tanzanie', 'afrique'], ['Les chutes Victoria', -17.9243, 25.8572, 'n', 'Zambie et Zimbabwe', 'afrique'],
    ['Les dunes de Sossusvlei', -24.7275, 15.3426, 'n', 'désert du Namib, Namibie', 'afrique'], ['Le parc du Serengeti', -2.3333, 34.8333, 'n', 'Tanzanie', 'afrique'],
    // Asie
    ['Tokyo', 35.6762, 139.6503, 'v', 'Japon', 'asie'], ['Pékin', 39.9042, 116.4074, 'v', 'Chine', 'asie'],
    ['Shanghai', 31.2304, 121.4737, 'v', 'Chine', 'asie'], ['Hong Kong', 22.3193, 114.1694, 'v', 'Chine', 'asie'],
    ['Séoul', 37.5665, 126.978, 'v', 'Corée du Sud', 'asie'], ['Bangkok', 13.7563, 100.5018, 'v', 'Thaïlande', 'asie'],
    ['Singapour', 1.3521, 103.8198, 'v', 'Singapour', 'asie'], ['New Delhi', 28.6139, 77.209, 'v', 'Inde', 'asie'],
    ['Bombay', 19.076, 72.8777, 'v', 'Inde', 'asie'], ['Dubaï', 25.2048, 55.2708, 'v', 'Émirats arabes unis', 'asie'],
    ['Téhéran', 35.6892, 51.389, 'v', 'Iran', 'asie'], ['Jérusalem', 31.7683, 35.2137, 'v', 'Israël et Palestine', 'asie'],
    ['Hanoï', 21.0278, 105.8342, 'v', 'Viêt Nam', 'asie'], ['Manille', 14.5995, 120.9842, 'v', 'Philippines', 'asie'],
    ['Jakarta', -6.2088, 106.8456, 'v', 'Indonésie', 'asie'], ['Kyoto', 35.0116, 135.7681, 'v', 'Japon', 'asie'],
    ['Katmandou', 27.7172, 85.324, 'v', 'Népal', 'asie'], ['Oulan-Bator', 47.8864, 106.9057, 'v', 'Mongolie', 'asie'],
    ['Riyad', 24.7136, 46.6753, 'v', 'Arabie saoudite', 'asie'],
    ['La Grande Muraille', 40.3588, 116.0197, 'm', 'près de Pékin, Chine', 'asie'], ['Le Taj Mahal', 27.1751, 78.0421, 'm', 'Agra, Inde', 'asie'],
    ['Angkor Vat', 13.4125, 103.867, 'm', 'Cambodge', 'asie'], ['Pétra', 30.3285, 35.4444, 'm', 'Jordanie', 'asie'],
    ['L\'armée de terre cuite', 34.3853, 109.2785, 'm', 'Xi\'an, Chine', 'asie'], ['Le temple de Borobudur', -7.6079, 110.2038, 'm', 'Java, Indonésie', 'asie'],
    ['Le mont Fuji', 35.3606, 138.7274, 'n', 'Japon', 'asie'], ['L\'Everest', 27.9881, 86.925, 'n', 'Népal et Chine', 'asie'],
    ['La baie d\'Ha Long', 20.9101, 107.1839, 'n', 'Viêt Nam', 'asie'], ['La mer Morte', 31.559, 35.4732, 'n', 'Israël et Jordanie', 'asie'],
    ['Le lac Baïkal', 53.5587, 108.165, 'n', 'Sibérie, Russie', 'asie'],
    // Amérique du Nord
    ['New York', 40.7128, -74.006, 'v', 'États-Unis', 'amnord'], ['Los Angeles', 34.0522, -118.2437, 'v', 'États-Unis', 'amnord'],
    ['Chicago', 41.8781, -87.6298, 'v', 'États-Unis', 'amnord'], ['San Francisco', 37.7749, -122.4194, 'v', 'États-Unis', 'amnord'],
    ['Washington', 38.9072, -77.0369, 'v', 'États-Unis', 'amnord'], ['Miami', 25.7617, -80.1918, 'v', 'États-Unis', 'amnord'],
    ['Las Vegas', 36.1699, -115.1398, 'v', 'États-Unis', 'amnord'], ['Montréal', 45.5017, -73.5673, 'v', 'Canada', 'amnord'],
    ['Québec', 46.8139, -71.208, 'v', 'Canada', 'amnord'], ['Toronto', 43.6532, -79.3832, 'v', 'Canada', 'amnord'],
    ['Vancouver', 49.2827, -123.1207, 'v', 'Canada', 'amnord'], ['Mexico', 19.4326, -99.1332, 'v', 'Mexique', 'amnord'],
    ['La Havane', 23.1136, -82.3666, 'v', 'Cuba', 'amnord'], ['Anchorage', 61.2181, -149.9003, 'v', 'Alaska, États-Unis', 'amnord'],
    ['Honolulu', 21.3069, -157.8583, 'v', 'Hawaï, États-Unis', 'amnord'], ['Panama', 8.9824, -79.5199, 'v', 'Panama', 'amnord'],
    ['La statue de la Liberté', 40.6892, -74.0445, 'm', 'New York, États-Unis', 'amnord'], ['Le mont Rushmore', 43.8791, -103.4591, 'm', 'États-Unis', 'amnord'],
    ['Chichén Itzá', 20.6843, -88.5678, 'm', 'Mexique', 'amnord'], ['Teotihuacan', 19.6925, -98.8438, 'm', 'Mexique', 'amnord'],
    ['Le Grand Canyon', 36.1069, -112.1129, 'n', 'États-Unis', 'amnord'], ['Les chutes du Niagara', 43.0962, -79.0377, 'n', 'Canada et États-Unis', 'amnord'],
    ['Le parc de Yellowstone', 44.428, -110.5885, 'n', 'États-Unis', 'amnord'], ['Banff et les Rocheuses', 51.1784, -115.5708, 'n', 'Canada', 'amnord'],
    ['Le Denali', 63.0692, -151.007, 'n', 'Alaska, États-Unis', 'amnord'],
    // Amérique du Sud
    ['Rio de Janeiro', -22.9068, -43.1729, 'v', 'Brésil', 'amsud'], ['São Paulo', -23.5505, -46.6333, 'v', 'Brésil', 'amsud'],
    ['Buenos Aires', -34.6037, -58.3816, 'v', 'Argentine', 'amsud'], ['Santiago', -33.4489, -70.6693, 'v', 'Chili', 'amsud'],
    ['Lima', -12.0464, -77.0428, 'v', 'Pérou', 'amsud'], ['Bogota', 4.711, -74.0721, 'v', 'Colombie', 'amsud'],
    ['Caracas', 10.4806, -66.9036, 'v', 'Venezuela', 'amsud'], ['Quito', -0.1807, -78.4678, 'v', 'Équateur', 'amsud'],
    ['La Paz', -16.4897, -68.1193, 'v', 'Bolivie', 'amsud'], ['Brasilia', -15.8267, -47.9218, 'v', 'Brésil', 'amsud'],
    ['Montevideo', -34.9011, -56.1645, 'v', 'Uruguay', 'amsud'], ['Manaus', -3.119, -60.0217, 'v', 'Amazonie, Brésil', 'amsud'],
    ['Cayenne', 4.9224, -52.3135, 'v', 'Guyane, France', 'amsud'],
    ['Le Machu Picchu', -13.1631, -72.545, 'm', 'Pérou', 'amsud'], ['Le Christ rédempteur', -22.9519, -43.2105, 'm', 'Rio de Janeiro, Brésil', 'amsud'],
    ['Les chutes d\'Iguazú', -25.6953, -54.4367, 'n', 'Argentine et Brésil', 'amsud'], ['Le salar d\'Uyuni', -20.1338, -67.4891, 'n', 'Bolivie', 'amsud'],
    ['Les îles Galápagos', -0.9538, -90.9656, 'n', 'Équateur', 'amsud'], ['L\'Aconcagua', -32.6532, -70.0109, 'n', 'Argentine', 'amsud'],
    ['Le Salto Ángel', 5.9701, -62.5362, 'n', 'Venezuela', 'amsud'], ['Le glacier Perito Moreno', -50.4967, -73.1377, 'n', 'Patagonie, Argentine', 'amsud'],
    // Océanie
    ['Sydney', -33.8688, 151.2093, 'v', 'Australie', 'oceanie'], ['Melbourne', -37.8136, 144.9631, 'v', 'Australie', 'oceanie'],
    ['Perth', -31.9505, 115.8605, 'v', 'Australie', 'oceanie'], ['Brisbane', -27.4698, 153.0251, 'v', 'Australie', 'oceanie'],
    ['Darwin', -12.4634, 130.8456, 'v', 'Australie', 'oceanie'], ['Auckland', -36.8485, 174.7633, 'v', 'Nouvelle-Zélande', 'oceanie'],
    ['Wellington', -41.2865, 174.7762, 'v', 'Nouvelle-Zélande', 'oceanie'], ['Nouméa', -22.2758, 166.458, 'v', 'Nouvelle-Calédonie, France', 'oceanie'],
    ['Port Moresby', -9.4438, 147.1803, 'v', 'Papouasie-Nouvelle-Guinée', 'oceanie'], ['Suva', -18.1248, 178.4501, 'v', 'Fidji', 'oceanie'],
    ['L\'opéra de Sydney', -33.8568, 151.2153, 'm', 'Australie', 'oceanie'],
    ['Uluru', -25.3444, 131.0369, 'n', 'Australie', 'oceanie'], ['La Grande Barrière de corail', -18.2871, 147.6992, 'n', 'Australie', 'oceanie'],
    ['Milford Sound', -44.6414, 167.8974, 'n', 'Nouvelle-Zélande', 'oceanie'], ['Le mont Cook', -43.595, 170.1418, 'n', 'Nouvelle-Zélande', 'oceanie'],
  ];

  /* ---------- Les lieux de France métropolitaine ---------- */
  const FRANCE = [
    ['Paris', 48.8566, 2.3522, 'v', 'Île-de-France'], ['Marseille', 43.2965, 5.3698, 'v', 'Bouches-du-Rhône'], ['Lyon', 45.764, 4.8357, 'v', 'Rhône'],
    ['Toulouse', 43.6047, 1.4442, 'v', 'Haute-Garonne'], ['Nice', 43.7102, 7.262, 'v', 'Alpes-Maritimes'], ['Nantes', 47.2184, -1.5536, 'v', 'Loire-Atlantique'],
    ['Strasbourg', 48.5734, 7.7521, 'v', 'Bas-Rhin'], ['Montpellier', 43.6108, 3.8767, 'v', 'Hérault'], ['Bordeaux', 44.8378, -0.5792, 'v', 'Gironde'],
    ['Lille', 50.6292, 3.0573, 'v', 'Nord'], ['Rennes', 48.1173, -1.6778, 'v', 'Ille-et-Vilaine'], ['Reims', 49.2583, 4.0317, 'v', 'Marne'],
    ['Le Havre', 49.4944, 0.1079, 'v', 'Seine-Maritime'], ['Saint-Étienne', 45.4397, 4.3872, 'v', 'Loire'], ['Toulon', 43.1242, 5.928, 'v', 'Var'],
    ['Grenoble', 45.1885, 5.7245, 'v', 'Isère'], ['Dijon', 47.322, 5.0415, 'v', 'Côte-d\'Or'], ['Angers', 47.4784, -0.5632, 'v', 'Maine-et-Loire'],
    ['Brest', 48.3904, -4.4861, 'v', 'Finistère'], ['Le Mans', 48.0061, 0.1996, 'v', 'Sarthe'], ['Clermont-Ferrand', 45.7772, 3.087, 'v', 'Puy-de-Dôme'],
    ['Tours', 47.3941, 0.6848, 'v', 'Indre-et-Loire'], ['Limoges', 45.8336, 1.2611, 'v', 'Haute-Vienne'], ['Amiens', 49.8941, 2.2958, 'v', 'Somme'],
    ['Perpignan', 42.6887, 2.8948, 'v', 'Pyrénées-Orientales'], ['Metz', 49.1193, 6.1757, 'v', 'Moselle'], ['Besançon', 47.2378, 6.0241, 'v', 'Doubs'],
    ['Orléans', 47.9029, 1.9093, 'v', 'Loiret'], ['Rouen', 49.4432, 1.0999, 'v', 'Seine-Maritime'], ['Caen', 49.1829, -0.3707, 'v', 'Calvados'],
    ['Nancy', 48.6921, 6.1844, 'v', 'Meurthe-et-Moselle'], ['Avignon', 43.9493, 4.8055, 'v', 'Vaucluse'], ['Pau', 43.2951, -0.3708, 'v', 'Pyrénées-Atlantiques'],
    ['La Rochelle', 46.1603, -1.1511, 'v', 'Charente-Maritime'], ['Ajaccio', 41.9192, 8.7386, 'v', 'Corse'], ['Bastia', 42.697, 9.4503, 'v', 'Corse'],
    ['Calais', 50.9513, 1.8587, 'v', 'Pas-de-Calais'], ['Biarritz', 43.4832, -1.5586, 'v', 'Pyrénées-Atlantiques'], ['Annecy', 45.8992, 6.1294, 'v', 'Haute-Savoie'],
    ['Chambéry', 45.5646, 5.9178, 'v', 'Savoie'], ['Poitiers', 46.5802, 0.3404, 'v', 'Vienne'], ['Quimper', 47.996, -4.1028, 'v', 'Finistère'],
    ['Cherbourg', 49.6337, -1.6222, 'v', 'Manche'], ['Saint-Malo', 48.6493, -2.0257, 'v', 'Ille-et-Vilaine'], ['Troyes', 48.2973, 4.0744, 'v', 'Aube'],
    ['Bourges', 47.081, 2.3988, 'v', 'Cher'], ['Nîmes', 43.8367, 4.3601, 'v', 'Gard'], ['Lourdes', 43.0947, -0.0459, 'v', 'Hautes-Pyrénées'],
    ['Chamonix', 45.9237, 6.8694, 'v', 'Haute-Savoie'], ['Mulhouse', 47.7508, 7.3359, 'v', 'Haut-Rhin'], ['Colmar', 48.0794, 7.3585, 'v', 'Haut-Rhin'],
    ['Vichy', 46.1278, 3.4258, 'v', 'Allier'], ['Arcachon', 44.6586, -1.1689, 'v', 'Gironde'], ['Saint-Tropez', 43.2692, 6.6389, 'v', 'Var'],
    ['La tour Eiffel', 48.8584, 2.2945, 'm', 'Paris'], ['Le Mont-Saint-Michel', 48.6361, -1.5115, 'm', 'Manche'], ['Le château de Versailles', 48.8049, 2.1204, 'm', 'Yvelines'],
    ['Le château de Chambord', 47.6161, 1.517, 'm', 'Loir-et-Cher'], ['Le pont du Gard', 43.9475, 4.5353, 'm', 'Gard'], ['Le château de Chenonceau', 47.3249, 1.0703, 'm', 'Indre-et-Loire'],
    ['La cathédrale de Chartres', 48.4477, 1.4879, 'm', 'Eure-et-Loir'], ['La cité de Carcassonne', 43.2063, 2.3637, 'm', 'Aude'], ['Le viaduc de Millau', 44.0777, 3.0225, 'm', 'Aveyron'],
    ['La grotte de Lascaux', 45.0537, 1.1675, 'm', 'Dordogne'], ['Fort Boyard', 45.9997, -1.2139, 'm', 'Charente-Maritime'], ['Le Futuroscope', 46.6697, 0.3685, 'm', 'Vienne'],
    ['Le château du Haut-Kœnigsbourg', 48.2494, 7.3444, 'm', 'Bas-Rhin'], ['Les plages du Débarquement', 49.3694, -0.8731, 'm', 'Calvados'], ['Le Puy du Fou', 46.8901, -0.9318, 'm', 'Vendée'],
    ['Disneyland Paris', 48.8722, 2.7758, 'm', 'Seine-et-Marne'], ['Rocamadour', 44.7997, 1.6178, 'm', 'Lot'], ['Le palais des Papes', 43.9508, 4.8075, 'm', 'Avignon, Vaucluse'],
    ['Le mont Blanc', 45.8326, 6.8652, 'n', 'Haute-Savoie'], ['Le puy de Dôme', 45.7725, 2.9644, 'n', 'Puy-de-Dôme'], ['Le mont Ventoux', 44.1739, 5.2785, 'n', 'Vaucluse'],
    ['Les gorges du Verdon', 43.7496, 6.3285, 'n', 'Alpes-de-Haute-Provence et Var'], ['Le cirque de Gavarnie', 42.695, -0.0094, 'n', 'Hautes-Pyrénées'],
    ['Le pic du Midi de Bigorre', 42.9369, 0.1411, 'n', 'Hautes-Pyrénées'], ['Le Canigou', 42.5191, 2.4568, 'n', 'Pyrénées-Orientales'],
    ['La dune du Pilat', 44.5893, -1.2125, 'n', 'Gironde'], ['Les falaises d\'Étretat', 49.7071, 0.2033, 'n', 'Seine-Maritime'], ['La pointe du Raz', 48.0397, -4.7406, 'n', 'Finistère'],
    ['Les calanques', 43.2111, 5.4511, 'n', 'près de Marseille, Bouches-du-Rhône'], ['La Camargue', 43.452, 4.4287, 'n', 'Bouches-du-Rhône'], ['Les gorges du Tarn', 44.3653, 3.4118, 'n', 'Lozère'],
    ['Le lac Léman', 46.4011, 6.5897, 'n', 'Évian, Haute-Savoie'], ['Le ballon d\'Alsace', 47.8222, 6.8395, 'n', 'Vosges et Territoire de Belfort'], ['Le lac d\'Annecy', 45.8475, 6.1717, 'n', 'Haute-Savoie'],
    ['Val-d\'Isère', 45.4485, 6.9806, 's', 'Savoie'], ['Courchevel', 45.4154, 6.6346, 's', 'Savoie'], ['Les Deux Alpes', 45.0058, 6.1222, 's', 'Isère'],
    ['L\'Alpe d\'Huez', 45.0919, 6.0687, 's', 'Isère'], ['Tignes', 45.4683, 6.9061, 's', 'Savoie'], ['Megève', 45.8567, 6.6175, 's', 'Haute-Savoie'],
    ['La Plagne', 45.507, 6.6773, 's', 'Savoie'], ['Serre Chevalier', 44.9446, 6.5574, 's', 'Hautes-Alpes'], ['Les Arcs', 45.5726, 6.8278, 's', 'Savoie'],
    ['Avoriaz', 46.1906, 6.7735, 's', 'Haute-Savoie'], ['Font-Romeu', 42.5047, 2.0386, 's', 'Pyrénées-Orientales'], ['Saint-Lary', 42.817, 0.322, 's', 'Hautes-Pyrénées'],
    ['Super-Besse', 45.5105, 2.8581, 's', 'Puy-de-Dôme'], ['Le Lioran', 45.087, 2.748, 's', 'Cantal'], ['La Bresse', 48.005, 6.8768, 's', 'Vosges'],
    ['Les Rousses', 46.4844, 6.0628, 's', 'Jura'], ['Isola 2000', 44.1869, 7.1572, 's', 'Alpes-Maritimes'], ['Les Menuires', 45.3236, 6.5378, 's', 'Savoie'],
  ];

  const faire = (liste, carte) => liste.map(([n, lat, lon, t, p, z], i) => { const [x, y] = (carte === 'france' ? france : monde).versCarte(lat, lon); return { c:carte[0] + i, n, lat, lon, t, p, z, x, y }; });
  return { monde:faire(MONDE, 'monde'), france:faire(FRANCE, 'france'), cartes:{ monde, france }, distanceKm, points, BAREMES,
    TYPES:{ v:['🏙️', 'Ville'], m:['🏛️', 'Monument'], n:['⛰️', 'Nature'], s:['🎿', 'Station de ski'] } };
})();
