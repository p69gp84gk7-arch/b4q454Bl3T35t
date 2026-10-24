/* Les Aventures de Pépin : les 16 niveaux (4 mondes de 4 niveaux).
   Chaque niveau se construit avec quelques ordres (voir construireZone dans moteur.js). La grille fait 15 rangées :
   le sol est sur les rangées 13 et 14, on se tient debout sur la rangée 12 ; les blocs « à portée de tête » sont sur la rangée 9,
   les blocs du haut sur la rangée 5.
   Motifs de blocs : b brique, p brique à pièces, e brique étoile, c brique cèpe, V brique vie, ? bloc mystère (pièce),
   ! bloc mystère (cèpe ou piment), * bloc mystère étoile, v bloc caché vie, h bloc caché pièce, d bloc dur, o pièce,
   n nuage, g glace, P pierre, w corail, l lave. */
window.PEPIN_NIVEAUX = (() => {
  // Une salle bonus pleine de pièces, sous terre ; on en ressort par un tuyau couché, à droite
  const salleBonus = (retour, theme = 'souterrain') => ({ theme, largeur:18, decors:false, construire(B){
    B.sol(0, 17); B.rect(0, 2, 1, 11, 'b'); B.plafond(1, 17, 3);
    B.rect(3, 10, 9, 3, 'b'); B.pieces(3, 8, 9); B.pieces(4, 6, 7); B.pieces(4, 4, 7);
    B.tuyau(15, 2, { cote:retour }); B.rect(17, 3, 1, 10, 'b'); B.depart(2, 3);
  } });
  // La sortie d'un niveau souterrain : on remonte par un tuyau, puis le mât à drapeau
  const sortie = (theme = 'plaine') => ({ theme, largeur:40, construire(B){ B.sol(0, 39); B.tuyau(2, 2); B.depart(2.5, 10); B.escalier(9, 6); B.rect(15, 6, 1, 7, 'd'); B.drapeau(24); } });

  return [
  /* ======================= MONDE 1 : LES ALPAGES ======================= */
  { id:'1-1', nom:'La Prairie', theme:'plaine', temps:400, largeur:212,
    construire(B){
      B.sol(0, 68); B.sol(71, 86); B.sol(90, 152); B.sol(155, 211);
      B.ligne(16, 9, '?'); B.ligne(20, 9, 'b!b?b'); B.ligne(22, 5, '?');
      B.ennemi('marmotton', 22);
      B.tuyau(28, 2); B.tuyau(38, 3); B.ennemi('marmotton', 40); B.tuyau(46, 3, { vers:{ zone:'bonus', x:2, y:3 } }); B.ennemi('marmotton', 51); B.ennemi('marmotton', 53);
      B.tuyau(57, 3); B.ligne(64, 8, 'v');
      B.ligne(77, 9, 'b!b'); B.ligne(80, 5, 'bbbbbbbb'); B.ennemi('marmotton', 81, 4); B.ennemi('marmotton', 83, 4);
      B.ligne(91, 5, 'bbb?'); B.ligne(94, 9, 'p'); B.mi(90);
      B.ligne(100, 9, 'be'); B.ligne(106, 9, '?'); B.ligne(109, 9, '?'); B.ligne(109, 5, '!'); B.ligne(112, 9, '?');
      B.ennemi('herisson', 107); B.ennemi('marmotton', 114); B.ennemi('marmotton', 116);
      B.ligne(118, 9, 'b'); B.ligne(121, 5, 'bbb'); B.ligne(128, 5, 'b??b'); B.ligne(129, 9, 'bb');
      B.ennemi('marmotton', 124); B.ennemi('marmotton', 126); B.ennemi('marmotton', 129); B.ennemi('marmotton', 131);
      B.escalier(134, 4); B.escalier(140, 4, -1); B.escalier(148, 4); B.rect(152, 9, 1, 4, 'd'); B.escalier(155, 4, -1);
      B.tuyau(163, 2); B.ligne(168, 9, 'bb?b'); B.ennemi('marmotton', 174); B.ennemi('marmotton', 176); B.tuyau(179, 2);
      B.escalier(181, 8); B.rect(189, 5, 1, 8, 'd'); B.drapeau(198);
    },
    zones:{ bonus:salleBonus({ zone:'principal', x:163.5, y:10, monte:true }) } },

  { id:'1-2', nom:'La Grotte', theme:'souterrain', temps:400, largeur:170,
    construire(B){
      B.sol(0, 79); B.sol(84, 129); B.sol(140, 169); B.plafond(5, 152, 3); B.rect(0, 2, 1, 11, 'b');
      B.ligne(10, 9, '?!???'); B.ennemi('marmotton', 16); B.ennemi('marmotton', 18);
      B.rect(24, 10, 1, 3, 'b'); B.rect(26, 8, 1, 5, 'b'); B.rect(28, 6, 1, 7, 'b'); B.ligne(29, 6, 'bbbb'); B.pieces(29, 5, 4);
      B.rect(34, 6, 1, 7, 'b'); B.ennemi('scarabee', 38); B.ennemi('scarabee', 41);
      B.rect(44, 9, 4, 1, 'b'); B.ligne(44, 5, 'bbbb'); B.pieces(44, 8, 4); B.ligne(45, 9, 'bpbb'.slice(1));
      B.rect(52, 7, 2, 6, 'b'); B.rect(56, 5, 2, 8, 'b'); B.pieces(56, 4, 2); B.ennemi('herisson', 60); B.ennemi('marmotton', 64);
      B.ligne(62, 9, 'bbbbbb'); B.ligne(62, 6, 'bbVbbb'); B.pieces(63, 8, 4);
      B.tuyau(70, 3, { chardon:true }); B.tuyau(75, 3);
      B.ligne(86, 9, 'b?bb'); B.ennemi('marmotton', 90); B.ennemi('marmotton', 92); B.mi(86);
      B.rect(98, 5, 6, 2, 'b'); B.pieces(98, 4, 6); B.ligne(100, 9, 'h'); B.ennemi('scarabee', 102);
      B.tuyau(108, 3); B.tuyau(113, 2, { chardon:true }); B.ennemi('scarabee', 118); B.ennemi('herisson', 122);
      B.plateforme(131, 8, { type:'monte', w:3 }); B.plateforme(131, 1, { type:'monte', w:3 }); B.plateforme(136, 4, { type:'descend', w:3 }); B.plateforme(136, 11, { type:'descend', w:3 });
      B.escalier(141, 4); B.rect(145, 9, 3, 4, 'd');
      B.rect(153, 2, 17, 11, 'b'); B.tuyau(151, 2, { cote:{ zone:'sortie', x:2.5, y:10, monte:true } });
      B.pieces(148, 7, 2);
    },
    zones:{ sortie:sortie('plaine') } },

  { id:'1-3', nom:'Les Cimes', theme:'ciel', temps:400, largeur:170,
    construire(B){
      B.sol(0, 15);
      B.sapin(18, 11, 4); B.sapin(24, 8, 5); B.pieces(25, 6, 3); B.sapin(31, 5, 4); B.ennemi('herissonRouge', 32, 4);
      B.sapin(37, 9, 6); B.pieces(38, 7, 4); B.ennemi('marmotton', 40, 8);
      B.sapin(46, 11, 3); B.plateforme(50, 9, { type:'h', w:3, amp:2 }); B.sapin(56, 8, 5); B.ligne(57, 4, '!');
      B.sapin(63, 10, 4); B.ennemi('choucas', 68, 6); B.sapin(69, 7, 3); B.pieces(70, 5, 2); B.mi(63);
      B.plateforme(75, 8, { type:'v', w:3, amp:2 }); B.sapin(80, 9, 6); B.ennemi('herissonRouge', 82, 8);
      B.sapin(88, 6, 4); B.pieces(88, 4, 4); B.sapin(94, 10, 3); B.ennemi('choucas', 98, 5);
      B.plateforme(99, 8, { type:'h', w:3, amp:3 }); B.sapin(107, 7, 5); B.ennemi('marmotton', 109, 6);
      B.sapin(114, 11, 3); B.sapin(119, 8, 4); B.ligne(120, 4, '?'); B.ennemi('choucas', 124, 7);
      B.plateforme(124, 7, { type:'chute', w:3 }); B.plateforme(129, 9, { type:'chute', w:3 });
      B.sapin(134, 10, 5); B.pieces(135, 8, 3);
      B.sol(141, 169); B.escalier(145, 5); B.rect(150, 8, 1, 5, 'd'); B.drapeau(158);
    } },

  { id:'1-4', nom:'Le Château du Yéti', theme:'chateau', temps:400, largeur:150, merci:'Merci Pépin ! Mais la marmotte de la vallée est dans un autre château…',
    construire(B){
      B.rect(0, 2, 150, 1, 'P'); B.rect(0, 9, 14, 6, 'P'); B.depart(2, 8); B.rect(0, 3, 4, 3, 'P');
      B.lave(14, 17, 2); B.rect(18, 9, 12, 6, 'P'); B.barreFeu(24, 6, 6, 1);
      B.lave(30, 34, 2); B.lavaSaut(32); B.rect(35, 9, 14, 6, 'P'); B.rect(38, 3, 8, 2, 'P'); B.ligne(41, 6, '!'); B.ennemi('marmotton', 44, 8);
      B.rect(49, 11, 18, 4, 'P'); B.barreFeu(55, 10, 5, -1); B.barreFeu(62, 10, 5, 1); B.rect(49, 3, 18, 4, 'P'); B.mi(49);
      B.rect(67, 9, 8, 6, 'P'); B.lave(75, 79, 2); B.lavaSaut(77); B.rect(80, 9, 10, 6, 'P'); B.barreFeu(85, 5, 6, 1);
      B.boss(90, 103, 5); B.rect(104, 9, 46, 6, 'P'); B.rect(108, 3, 42, 3, 'P');
    } },

  /* ======================= MONDE 2 : LE LAC ======================= */
  { id:'2-1', nom:'Le Bord du Lac', theme:'plaine', temps:400, largeur:220,
    construire(B){
      B.sol(0, 40); B.eau(41, 44, 13); B.eau(41, 44, 14); B.sol(45, 90); B.eau(91, 95, 13); B.eau(91, 95, 14); B.sol(96, 150); B.eau(151, 154, 13); B.eau(151, 154, 14); B.sol(155, 219);
      B.ligne(12, 9, '?b!b'); B.ennemi('herisson', 18); B.ennemi('marmotton', 22); B.ennemi('marmotton', 24);
      B.tuyau(28, 2, { chardon:true }); B.escalier(33, 3); B.ligne(37, 6, '???');
      B.ennemi('herissonRouge', 50); B.ligne(52, 9, 'bbbbbb'); B.ligne(52, 5, 'b*b'); B.ennemi('marmotton', 56, 8); B.ennemi('marmotton', 58, 8);
      B.tuyau(64, 3, { chardon:true, vers:{ zone:'bonus', x:2, y:3 } }); B.ennemi('herisson', 70); B.ennemi('herisson', 72);
      B.canon(78, 2); B.ligne(82, 9, 'bpb'); B.ennemi('marmotton', 86); B.mi(96);
      B.escalier(100, 3); B.ligne(105, 8, 'bbbb'); B.ennemi('herissonRouge', 106, 7); B.ligne(111, 5, '!');
      B.ennemi('marmotton', 114); B.ennemi('marmotton', 116); B.ennemi('marmotton', 118); B.tuyau(124, 3, { chardon:true });
      B.canon(130, 2); B.ligne(134, 9, '?h?'); B.ennemi('herisson', 140); B.ennemi('choucas', 146, 7);
      B.ligne(160, 9, 'bbVbb'); B.ennemi('marmotton', 166); B.ennemi('marmotton', 168); B.tuyau(172, 2);
      B.escalier(178, 8); B.rect(186, 5, 1, 8, 'd'); B.drapeau(195);
    },
    zones:{ bonus:salleBonus({ zone:'principal', x:124.5, y:9, monte:true }) } },

  { id:'2-2', nom:'Sous le Lac', theme:'eau', eau:true, temps:400, largeur:170,
    construire(B){
      B.sol(0, 169); B.depart(2, 4);
      B.rect(10, 9, 3, 4, 'w'); B.pieces(10, 7, 3); B.algue(16, 12); B.algue(17, 11); B.algue(17, 12);
      B.ennemi('truite', 22, 7); B.rect(26, 3, 4, 2, 'w'); B.rect(26, 10, 4, 3, 'w'); B.pieces(26, 7, 4);
      B.ennemi('truite', 34, 9); B.ennemi('truite', 38, 5); B.algue(40, 12); B.rect(44, 6, 2, 7, 'w'); B.pieces(46, 5, 3);
      B.ennemi('truite', 52, 7); B.rect(56, 3, 8, 2, 'w'); B.rect(56, 9, 8, 4, 'w'); B.pieces(56, 6, 8); B.mi(60);
      B.ennemi('truite', 66, 4); B.ennemi('truite', 70, 10); B.algue(72, 12); B.algue(73, 12); B.rect(76, 8, 3, 5, 'w'); B.ligne(77, 5, '!');
      B.ennemi('truite', 84, 6); B.ennemi('truite', 88, 9); B.rect(92, 3, 2, 6, 'w'); B.rect(96, 7, 2, 6, 'w'); B.rect(100, 3, 2, 6, 'w'); B.pieces(94, 10, 2); B.pieces(98, 4, 2);
      B.ennemi('truite', 106, 5); B.ennemi('truite', 110, 8); B.ennemi('truite', 114, 11); B.algue(118, 12); B.rect(120, 10, 6, 3, 'w'); B.pieces(120, 8, 6);
      B.ennemi('truite', 128, 6); B.ennemi('truite', 134, 9); B.rect(138, 3, 3, 4, 'w'); B.rect(138, 9, 3, 4, 'w');
      B.ennemi('truite', 146, 7); B.rect(152, 2, 18, 9, 'w'); B.tuyau(150, 2, { cote:{ fin:true } });
    } },

  { id:'2-3', nom:'Les Pontons', theme:'plaine', temps:400, largeur:190,
    construire(B){
      B.sol(0, 12); B.eau(13, 175, 13); B.eau(13, 175, 14);
      B.pont(13, 22, 9); B.pont(25, 33, 7); B.pont(36, 44, 9); B.pont(47, 52, 6); B.pont(55, 66, 9);
      B.truites(14, 160); B.pieces(27, 5, 5); B.ligne(40, 5, '?!?'); B.ennemi('herissonRouge', 38, 8);
      B.pont(69, 76, 7); B.pont(79, 90, 9); B.mi(79); B.ennemi('marmotton', 84, 8); B.pont(93, 98, 6); B.pieces(93, 4, 6);
      B.pont(101, 112, 8); B.ennemi('choucas', 108, 5); B.plateforme(114, 8, { type:'h', w:3, amp:2 }); B.pont(121, 132, 9);
      B.ennemi('herissonRouge', 126, 8); B.pont(135, 140, 7); B.ligne(137, 3, '?'); B.pont(143, 156, 9); B.ennemi('marmotton', 150, 8);
      B.pont(159, 175, 9); B.sol(176, 189); B.drapeau(181);
    } },

  { id:'2-4', nom:'Le Château du Lac', theme:'chateau', temps:400, largeur:160, merci:'Merci Pépin ! Le Yéti s\'est enfui vers les neiges…',
    construire(B){
      B.rect(0, 2, 160, 1, 'P'); B.rect(0, 9, 10, 6, 'P'); B.depart(2, 8);
      B.lave(10, 14, 2); B.lavaSaut(12); B.rect(15, 9, 6, 6, 'P'); B.lave(21, 25, 2); B.lavaSaut(23); B.rect(26, 9, 10, 6, 'P');
      B.barreFeu(30, 5, 6, 1); B.rect(36, 6, 3, 9, 'P'); B.rect(39, 9, 12, 6, 'P'); B.barreFeu(44, 9, 5, -1); B.ligne(47, 5, '!');
      B.lave(51, 58, 2); B.plateforme(52, 9, { type:'h', w:2, amp:2 }); B.lavaSaut(55); B.rect(59, 9, 10, 6, 'P'); B.mi(59);
      B.rect(59, 3, 10, 3, 'P'); B.ennemi('herisson', 64, 8); B.barreFeu(66, 6, 5, 1);
      B.rect(69, 11, 14, 4, 'P'); B.barreFeu(73, 10, 6, 1); B.barreFeu(79, 10, 6, -1); B.rect(69, 3, 14, 4, 'P');
      B.rect(83, 9, 10, 6, 'P'); B.lave(93, 96, 2); B.lavaSaut(94); B.rect(97, 9, 6, 6, 'P');
      B.boss(103, 117, 6); B.rect(118, 9, 42, 6, 'P'); B.rect(122, 3, 38, 3, 'P');
    } },

  /* ======================= MONDE 3 : LES NEIGES ======================= */
  { id:'3-1', nom:'La Station', theme:'neige', temps:400, largeur:220,
    construire(B){
      B.sol(0, 50); B.sol(54, 104); B.sol(108, 160); B.sol(165, 219);
      B.ligne(10, 9, '?g!g?'); B.ennemi('marmotton', 16); B.ennemi('herisson', 20);
      B.canon(26, 2); B.rect(30, 10, 6, 1, 'g'); B.pieces(30, 8, 6); B.ennemi('marmotton', 34); B.ennemi('marmotton', 36);
      B.canon(42, 3); B.ligne(46, 6, 'ggg'); B.ennemi('herissonRouge', 47, 5);
      B.tuyau(58, 3, { chardon:true }); B.ligne(64, 9, 'bbpbb'); B.ligne(64, 5, 'b*b'); B.ennemi('marmotton', 66); B.ennemi('marmotton', 68);
      B.canon(74, 2); B.canon(80, 3); B.ennemi('herisson', 84); B.mi(84); B.rect(88, 12, 10, 1, 'g'); B.ennemi('marmotton', 92); B.ennemi('marmotton', 94);
      B.escalier(98, 4, 1, 'g'); B.rect(102, 9, 2, 4, 'g');
      B.ligne(112, 9, 'g?g'); B.tuyau(118, 3, { chardon:true, vers:{ zone:'bonus', x:2, y:3 } }); B.canon(124, 2); B.ennemi('herissonRouge', 128); B.ennemi('herissonRouge', 131);
      B.ligne(136, 6, 'gggg'); B.ligne(137, 9, '!'); B.ennemi('choucas', 140, 6); B.ennemi('choucas', 148, 4);
      B.canon(152, 3); B.escalier(156, 4); B.tuyau(167, 2); B.ennemi('marmotton', 172); B.ennemi('herisson', 175); B.ligne(178, 9, 'bVb');
      B.escalier(184, 8, 1, 'g'); B.rect(192, 5, 1, 8, 'g'); B.drapeau(200);
    },
    zones:{ bonus:salleBonus({ zone:'principal', x:167.5, y:10, monte:true }, 'glace') } },

  { id:'3-2', nom:'La Grotte de Glace', theme:'glace', temps:400, largeur:180,
    construire(B){
      B.sol(0, 60); B.sol(64, 120); B.sol(126, 179); B.plafond(5, 165, 3); B.rect(0, 2, 1, 11, 'g');
      B.rect(0, 12, 60, 1, 'g'); B.depart(2, 11); B.ligne(10, 8, '?!?'); B.ennemi('scarabee', 16, 11); B.ennemi('scarabee', 19, 11);
      B.rect(24, 8, 2, 4, 'g'); B.rect(30, 6, 2, 6, 'g'); B.pieces(30, 5, 2); B.ennemi('marmotton', 34, 11); B.ennemi('marmotton', 36, 11);
      B.tuyau(40, 2, { chardon:true, bas:11 }); B.ligne(46, 8, 'gggggg'); B.ligne(46, 5, 'gpggVg'); B.ennemi('herisson', 48, 7);
      B.tuyau(55, 3, { chardon:true, bas:11 });
      B.ligne(66, 9, 'b?b'); B.ennemi('scarabee', 70); B.ennemi('scarabee', 72); B.mi(70);
      B.rect(76, 10, 8, 3, 'g'); B.pieces(76, 8, 8); B.rect(86, 7, 2, 6, 'g'); B.rect(90, 5, 2, 8, 'g'); B.ennemi('herissonRouge', 94);
      B.tuyau(100, 3, { chardon:true }); B.tuyau(106, 4, { chardon:true }); B.tuyau(112, 3, { chardon:true });
      B.plateforme(121, 6, { type:'monte', w:3 }); B.plateforme(121, 13, { type:'monte', w:3 });
      B.ennemi('scarabee', 132); B.ennemi('scarabee', 135); B.ligne(138, 9, '?*?'); B.escalier(146, 4, 1, 'g'); B.rect(150, 9, 3, 4, 'g');
      B.rect(167, 2, 13, 11, 'g'); B.tuyau(165, 2, { cote:{ zone:'sortie', x:2.5, y:10, monte:true } });
    },
    zones:{ sortie:sortie('neige') } },

  { id:'3-3', nom:'Le Téléphérique', theme:'neige', temps:400, largeur:190, ciel:'#BEE4FF',
    construire(B){
      B.sol(0, 16); B.escalier(10, 3, 1, 'g');
      B.plateforme(16, 10, { type:'cable', w:2, amp:7, cabine:true, vit:1.2 }); B.sapin(27, 8, 5); B.pieces(28, 6, 3); B.ennemi('herissonRouge', 28, 7);
      B.plateforme(33, 7, { type:'cable', w:2, amp:8, cabine:true, vit:1 }); B.sapin(46, 10, 4); B.ennemi('choucas', 48, 5);
      B.plateforme(51, 9, { type:'h', w:3, amp:3 }); B.sapin(59, 7, 6); B.ligne(60, 3, '?!?'); B.ennemi('marmotton', 61, 6); B.ennemi('marmotton', 63, 6); B.mi(59);
      B.plateforme(66, 7, { type:'cable', w:2, amp:7, cabine:true, vit:1 }); B.ennemi('choucas', 80, 3); B.sapin(77, 8, 6);
      B.plateforme(85, 8, { type:'chute', w:3 }); B.plateforme(90, 7, { type:'chute', w:3 }); B.sapin(95, 9, 5); B.ennemi('herissonRouge', 96, 8);
      B.plateforme(101, 8, { type:'cable', w:2, amp:10, cabine:true, vit:1.1 }); B.ennemi('choucas', 108, 6); B.sapin(114, 6, 6); B.ligne(117, 2, 'e');
      B.plateforme(121, 8, { type:'v', w:3, amp:3 }); B.sapin(126, 10, 5); B.ennemi('marmotton', 128, 9);
      B.plateforme(132, 9, { type:'cable', w:2, amp:10, cabine:true, vit:1 }); B.sapin(146, 8, 5); B.pieces(147, 6, 4);
      B.sol(153, 189); B.escalier(158, 5, 1, 'g'); B.rect(163, 8, 1, 5, 'g'); B.drapeau(171);
    } },

  { id:'3-4', nom:'Le Château de Glace', theme:'chateau', temps:400, largeur:170, merci:'Merci Pépin ! Le Yéti a fui vers le volcan… courage, c\'est le dernier monde !',
    construire(B){
      B.rect(0, 2, 170, 1, 'P'); B.rect(0, 9, 12, 6, 'P'); B.depart(2, 8);
      B.lave(12, 18, 2); B.plateforme(13, 9, { type:'v', w:2, amp:2 }); B.lavaSaut(16); B.rect(19, 9, 8, 6, 'P'); B.barreFeu(23, 5, 7, 1);
      B.rect(27, 11, 16, 4, 'P'); B.rect(27, 3, 16, 5, 'P'); B.barreFeu(31, 10, 5, 1); B.barreFeu(37, 10, 5, -1); B.ennemi('scarabee', 40, 10);
      B.rect(43, 9, 6, 6, 'P'); B.lave(49, 56, 2); B.lavaSaut(51); B.lavaSaut(54); B.plateforme(50, 8, { type:'h', w:2, amp:2 }); B.rect(57, 9, 10, 6, 'P'); B.ligne(60, 5, '!'); B.mi(57);
      B.ennemi('herissonRouge', 63, 8); B.rect(67, 7, 4, 8, 'P'); B.barreFeu(69, 7, 6, -1); B.rect(71, 9, 12, 6, 'P'); B.barreFeu(77, 5, 7, 1);
      B.lave(83, 89, 2); B.lavaSaut(86); B.plateforme(84, 8, { type:'chute', w:2 }); B.rect(90, 9, 8, 6, 'P');
      B.boss(98, 113, 7); B.rect(114, 9, 56, 6, 'P'); B.rect(118, 3, 52, 3, 'P');
    } },

  /* ======================= MONDE 4 : LE VOLCAN ======================= */
  { id:'4-1', nom:'La Nuit sur les Sommets', theme:'nuit', temps:400, largeur:220,
    construire(B){
      B.sol(0, 30); B.sol(35, 70); B.sol(75, 120); B.sol(126, 170); B.sol(176, 219);
      B.ligne(10, 9, '?!?'); B.ennemi('herissonRouge', 16); B.ennemi('herissonRouge', 19); B.canon(24, 2); B.canon(28, 3);
      B.ligne(37, 9, 'bbbb'); B.ligne(37, 5, 'bp*b'); B.ennemi('marmotton', 40); B.ennemi('marmotton', 42); B.ennemi('marmotton', 44);
      B.tuyau(48, 3, { chardon:true }); B.tuyau(54, 4, { chardon:true }); B.ennemi('choucas', 60, 5); B.ennemi('choucas', 66, 7); B.canon(66, 2);
      B.escalier(76, 3); B.ligne(81, 6, 'bbbbbb'); B.ennemi('herisson', 82, 5); B.ennemi('herisson', 85, 5); B.mi(80);
      B.ennemi('scarabee', 92); B.ennemi('scarabee', 95); B.tuyau(100, 3, { chardon:true }); B.canon(106, 3); B.ligne(110, 9, 'h?h'); B.ennemi('choucas', 116, 6);
      B.plateforme(121, 9, { type:'h', w:3, amp:1 }); B.ligne(130, 9, 'b!b'); B.ennemi('herissonRouge', 134); B.ennemi('herissonRouge', 137); B.canon(142, 2);
      B.ennemi('marmotton', 148); B.ennemi('marmotton', 150); B.ennemi('marmotton', 152); B.tuyau(158, 3, { chardon:true }); B.ligne(163, 8, 'bVb');
      B.plateforme(171, 9, { type:'v', w:3, amp:2 }); B.ennemi('choucas', 180, 5); B.escalier(184, 8); B.rect(192, 5, 1, 8, 'd'); B.drapeau(201);
    } },

  { id:'4-2', nom:'La Grotte de Lave', theme:'lave', temps:400, largeur:180,
    construire(B){
      B.sol(0, 20); B.lave(21, 26, 2); B.lavaSaut(23); B.sol(27, 50); B.lave(51, 58, 2); B.lavaSaut(53); B.lavaSaut(56); B.sol(59, 95); B.lave(96, 104, 2); B.lavaSaut(99); B.sol(105, 140); B.lave(141, 150, 2); B.lavaSaut(144); B.lavaSaut(148); B.sol(151, 179);
      B.plafond(5, 165, 3); B.rect(0, 2, 1, 11, 'b');
      B.ligne(8, 9, '?!?'); B.ennemi('scarabee', 14); B.plateforme(22, 9, { type:'h', w:2, amp:1 }); B.ennemi('marmotton', 32); B.ennemi('marmotton', 34);
      B.barreFeu(38, 9, 5, 1); B.ligne(44, 6, 'bbbbb'); B.pieces(44, 5, 5); B.plateforme(52, 8, { type:'h', w:2, amp:2 }); B.mi(60);
      B.ennemi('scarabee', 64); B.ennemi('scarabee', 66); B.barreFeu(70, 8, 6, -1); B.tuyau(76, 3, { chardon:true }); B.ligne(82, 9, 'b*b'); B.ennemi('herissonRouge', 88);
      B.plateforme(97, 9, { type:'chute', w:2 }); B.plateforme(101, 8, { type:'chute', w:2 }); B.ennemi('scarabee', 110); B.barreFeu(114, 9, 6, 1); B.barreFeu(122, 6, 6, -1);
      B.ligne(118, 9, 'p'); B.ennemi('herisson', 126); B.ennemi('herisson', 129); B.tuyau(134, 3, { chardon:true });
      B.plateforme(142, 8, { type:'v', w:2, amp:2 }); B.plateforme(146, 7, { type:'h', w:2, amp:1 }); B.ennemi('scarabee', 156);
      B.rect(167, 2, 13, 11, 'b'); B.tuyau(165, 2, { cote:{ zone:'sortie', x:2.5, y:10, monte:true } });
    },
    zones:{ sortie:sortie('nuit') } },

  { id:'4-3', nom:'Au-dessus des Nuages', theme:'ciel', temps:400, largeur:180, ciel:'#2A2E6E',
    construire(B){
      B.sol(0, 12); B.nuage(15, 10, 4); B.nuage(21, 8, 3); B.ennemi('choucas', 26, 5); B.nuage(26, 6, 4); B.pieces(26, 4, 4);
      B.plateforme(32, 8, { type:'h', w:2, amp:3 }); B.nuage(40, 9, 5); B.ennemi('herissonRouge', 41, 8); B.ligne(42, 5, '!');
      B.plateforme(47, 7, { type:'chute', w:2 }); B.plateforme(51, 9, { type:'chute', w:2 }); B.nuage(55, 10, 3); B.ennemi('choucas', 58, 6); B.ennemi('choucas', 62, 4);
      B.nuage(60, 7, 4); B.mi(60); B.plateforme(66, 8, { type:'v', w:3, amp:3 }); B.nuage(72, 6, 6); B.pieces(72, 4, 6); B.ennemi('marmotton', 74, 5); B.ennemi('marmotton', 76, 5);
      B.plateforme(80, 9, { type:'h', w:2, amp:2 }); B.nuage(87, 10, 3); B.ennemi('choucas', 90, 5); B.nuage(92, 7, 3); B.ligne(93, 3, '*');
      B.plateforme(96, 7, { type:'v', w:3, amp:2 }); B.nuage(101, 6, 4); B.pieces(101, 4, 4);
      B.plateforme(106, 7, { type:'chute', w:3 }); B.plateforme(110, 8, { type:'chute', w:3 }); B.plateforme(114, 9, { type:'chute', w:3 }); B.ennemi('choucas', 116, 4);
      B.nuage(119, 9, 5); B.pieces(120, 7, 3); B.plateforme(126, 8, { type:'h', w:2, amp:3 }); B.nuage(133, 8, 5); B.ennemi('herissonRouge', 135, 7); B.ennemi('choucas', 140, 4);
      B.nuage(140, 9, 3); B.nuage(145, 10, 4);
      B.sol(151, 179); B.escalier(154, 5); B.rect(159, 8, 1, 5, 'd'); B.drapeau(167);
    } },

  { id:'4-4', nom:'Le Repaire du Yéti', theme:'chateau', temps:400, largeur:200, merci:'Le Yéti est vaincu ! Merci Pépin, toute la vallée est libérée !',
    construire(B){
      B.rect(0, 2, 200, 1, 'P'); B.rect(0, 9, 10, 6, 'P'); B.depart(2, 8);
      B.lave(10, 15, 2); B.lavaSaut(12); B.plateforme(11, 9, { type:'h', w:2, amp:1 }); B.rect(16, 9, 8, 6, 'P'); B.barreFeu(20, 5, 7, 1);
      B.rect(24, 11, 18, 4, 'P'); B.rect(24, 3, 18, 5, 'P'); B.barreFeu(28, 10, 5, 1); B.barreFeu(34, 10, 5, -1); B.barreFeu(40, 10, 5, 1);
      B.rect(42, 9, 8, 6, 'P'); B.ligne(45, 5, '!'); B.lave(50, 58, 2); B.lavaSaut(52); B.lavaSaut(55); B.plateforme(51, 8, { type:'v', w:2, amp:2 }); B.plateforme(55, 9, { type:'h', w:2, amp:1 });
      B.rect(59, 9, 12, 6, 'P'); B.ennemi('scarabee', 63, 8); B.ennemi('herissonRouge', 67, 8); B.barreFeu(65, 5, 8, -1); B.mi(59);
      B.rect(71, 7, 3, 8, 'P'); B.rect(74, 9, 12, 6, 'P'); B.barreFeu(80, 9, 6, 1); B.rect(86, 11, 14, 4, 'P'); B.rect(86, 3, 14, 4, 'P'); B.barreFeu(90, 10, 5, -1); B.barreFeu(96, 10, 5, 1);
      B.rect(100, 9, 6, 6, 'P'); B.lave(106, 114, 2); B.lavaSaut(108); B.lavaSaut(111); B.plateforme(107, 8, { type:'chute', w:2 }); B.plateforme(111, 8, { type:'chute', w:2 });
      B.rect(115, 9, 10, 6, 'P'); B.ligne(118, 5, '!'); B.barreFeu(122, 5, 7, 1);
      B.boss(125, 142, 10); B.rect(143, 9, 57, 6, 'P'); B.rect(147, 3, 53, 3, 'P');
    } },
  ];
})();
