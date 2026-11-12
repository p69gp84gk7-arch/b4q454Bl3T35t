/* Quelle taille ? : les silhouettes (dessinées pour le jeu, en aplats) et leur vraie taille.
   Un objet : id ; n (le nom, avec son article) ; de (« de la tour Eiffel », pour la question) ; cat ;
   t : la taille en mètres ; dim : ce qu'on mesure ('h' la hauteur, 'l' la longueur ou la largeur) ;
   w, h : la boîte du dessin (le dessin la remplit : la dimension mesurée fait exactement w ou h) ; c : la couleur ;
   ref : un bon objet de comparaison (taille connue de tous) ; svg : le dessin ;
   q, u (facultatifs) : les mots de la question et de la mesure quand ce n'est ni « hauteur » ni « longueur » (diamètre, largeur).
   Dans le dessin : @d = un aplat plus foncé, @l = un aplat plus clair, @c = la couleur de l'objet (pour un trait). */
window.TOISE_OBJETS = (() => {
  'use strict';
  const rep = (n, f) => Array.from({ length:n }, (_, i) => f(i)).join('');
  const P = pts => `<polygon points="${pts}"/>`;
  const Pd = pts => `<polygon points="${pts}" @d/>`;
  const Pl = pts => `<polygon points="${pts}" @l/>`;
  const R = (x, y, w, h, rx = 0, x2 = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} ${x2}/>`;
  const C = (cx, cy, r, x2 = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" ${x2}/>`;
  const E = (cx, cy, rx, ry, x2 = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" ${x2}/>`;
  const trait = (d, sw, x2 = '') => `<path d="${d}" fill="none" stroke="@c" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${x2}/>`;

  const L = [
    /* ---------- Les humains et les êtres vivants ---------- */
    { id:'adulte', n:'Un adulte', de:"d'un adulte", cat:'vivant', t:1.75, dim:'h', w:40, h:100, c:'#E4572E', ref:1,
      svg:C(20, 9, 8.6) + R(11, 19.5, 18, 38, 5) + R(4.5, 20.5, 6, 34, 3) + R(29.5, 20.5, 6, 34, 3) + R(11.5, 52, 8.2, 48, 3.5) + R(20.3, 52, 8.2, 48, 3.5) },
    { id:'enfant', n:'Un enfant de 6 ans', de:"d'un enfant de 6 ans", cat:'vivant', t:1.15, dim:'h', w:40, h:100, c:'#F2A541', ref:1,
      svg:C(20, 13.5, 13) + R(11, 28.5, 18, 36, 5) + R(4.5, 30, 6, 28, 3) + R(29.5, 30, 6, 28, 3) + R(11.5, 60, 8.2, 40, 3.5) + R(20.3, 60, 8.2, 40, 3.5) },
    { id:'girafe', n:'Une girafe', de:"d'une girafe", cat:'vivant', t:5.5, dim:'h', w:35, h:55, c:'#D9952B', ref:1,
      svg:E(14, 30, 10.5, 6) + P('18,27 24.5,31 31,9 26.5,6.5') + P('26,7 30.5,9.5 35,8.2 34,5 28.5,2.8') + R(27.4, 0, .9, 3.6) + R(29.6, .5, .9, 3.2)
        + R(5.5, 33, 2.2, 22) + R(9.4, 33, 2.2, 22) + R(16.6, 33, 2.2, 22) + R(20.4, 33, 2.2, 22) + P('4.2,27 2,40 3.2,40.4 5.6,29')
        + C(10, 28, 1.7, '@d') + C(15, 31.5, 1.9, '@d') + C(19, 27.5, 1.5, '@d') + C(24, 24, 1.3, '@d') + C(26.5, 16, 1.2, '@d') + C(12, 33.5, 1.2, '@d') + C(7, 31, 1.3, '@d') },
    { id:'elephant', n:"Un éléphant d'Afrique", de:"d'un éléphant d'Afrique (au garrot)", cat:'vivant', t:3.3, dim:'h', w:50, h:33, c:'#8A929C',
      svg:E(23, 11.5, 16.5, 11.5) + C(39.5, 12, 8.6) + '<path d="M45.5 13 Q50.5 20 48 31.5 L45.6 31.5 Q46.8 23 41 18.5 Z"/>'
        + R(9.5, 16, 6.2, 17, 1.5) + R(16.6, 18, 5.6, 15, 1.5) + R(28, 18, 6, 15, 1.5) + R(34.6, 16, 5.6, 17, 1.5)
        + E(35.5, 12.5, 5, 7.4, '@d') + Pl('43,18.5 47.5,22.6 46.4,23.4') + P('6.8,8 4.4,20 5.4,20.4 8.2,10') + C(42.5, 9, .8, '@d') },
    { id:'trex', n:'Un tyrannosaure', de:"d'un tyrannosaure (du museau à la queue)", cat:'vivant', t:12, dim:'l', w:120, h:45, c:'#6E8B3D',
      svg:'<path d="M0 22 Q30 18 55 15 Q70 7 85 9 L96 4 Q108 0 119 6 L120 11 L104 15 L97 14 Q92 23 80 28 Q60 31 45 25 Q25 23 0 22 Z"/>'
        + P('60,25 73,27 71,36 75,42.5 81,42.5 81,45 66,45 64.5,37 57,30') + Pd('50,25 60,27 59,36 62,42.5 67,42.5 67,45 54,45 53,37 47,30')
        + P('88,20 92.5,24.5 95.5,23.5 95,26 90,26.6') + C(106, 6.5, 1.3, '@l') + '<path d="M104 12.5 L119 9.5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".8"/>' },
    { id:'baleine', n:'Une baleine bleue', de:"d'une baleine bleue", cat:'vivant', t:25, dim:'l', w:250, h:50, c:'#3F6C9B',
      svg:'<path d="M0 24 Q40 4 110 6 Q190 8 232 24 L250 10 L246 27 L250 42 L230 30 Q180 46 110 46 Q40 46 0 24 Z"/>'
        + '<path d="M2 26 Q45 46 110 46 Q150 46 180 40 Q120 38 60 34 Q25 31 2 26 Z" @l/>' + Pd('72,39 98,50 86,37') + P('186,11.5 196,5 199,12.5') + C(24, 21, 1.8, '@l') },
    { id:'autruche', n:'Une autruche', de:"d'une autruche", cat:'vivant', t:2.5, dim:'h', w:18, h:25, c:'#4A4038',
      svg:E(8, 11, 7.6, 5) + '<path d="M11.5 9 Q15 6 14.1 1.6 L15.7 1.6 Q17.2 7 14 12.5 Z" fill="#E7B9A6"/>' + C(15, 1.4, 1.4, 'fill="#E7B9A6"') + '<polygon points="16,1 18,1.7 16,2.1" fill="#D98A3D"/>'
        + '<polygon points="7,15 8.3,15 9.3,25 8.2,25" fill="#E7B9A6"/><polygon points="9.6,15 10.7,15 12.6,24 13.2,25 11.5,25" fill="#E7B9A6"/>' + E(1.6, 9.5, 2.6, 3.4, '@l') },
    { id:'manchot', n:'Un manchot empereur', de:"d'un manchot empereur", cat:'vivant', t:1.15, dim:'h', w:5.4, h:11.5, c:'#2B3440',
      svg:E(2.6, 6.6, 2.3, 4.7) + C(2.6, 1.6, 1.6) + E(2.9, 7.2, 1.5, 3.7, 'fill="#F4F1EA"') + C(3.4, 3.1, .6, 'fill="#F5C542"') + '<polygon points="3.9,1.3 5.4,1.9 3.9,2.2" fill="#3A2E28"/>'
        + E(.75, 6.4, .6, 2.7, '@d') + '<ellipse cx="1.9" cy="11.2" rx="1" ry=".3" fill="#3A2E28"/><ellipse cx="3.6" cy="11.2" rx="1" ry=".3" fill="#3A2E28"/>' },
    { id:'sequoia', n:'Le séquoia « Général Sherman »', de:'du séquoia géant « Général Sherman »', cat:'vivant', t:84, dim:'h', w:30, h:84, c:'#3C7A47',
      svg:'<polygon points="10.5,84 19.5,84 16.5,24 13.5,24" fill="#9A5B3C"/>' + P('15,0 26,30 21,28 27,47 19.5,43.5 22,57 8,57 10.5,43.5 3,47 9,28 4,30') + Pd('15,0 26,30 21,28 27,47 19.5,43.5 22,57 15,57') },

    /* ---------- Les monuments ---------- */
    { id:'eiffel', n:'La tour Eiffel', de:'de la tour Eiffel', cat:'monument', t:330, dim:'h', w:125, h:330, c:'#8C6A4A', ref:1,
      svg:'<path d="M0 330 Q30 300 44 215 Q54 120 59 54 L61 54 L62 0 L63 0 L64 54 L66 54 Q71 120 81 215 Q95 300 125 330 L100 330 Q85 285 62.5 285 Q40 285 25 330 Z"/>'
        + R(30, 268, 65, 8) + R(40, 211, 45, 7) + R(56, 50, 13, 6) },
    { id:'liberte', n:'La statue de la Liberté', de:'de la statue de la Liberté (avec son socle)', cat:'monument', t:93, dim:'h', w:30, h:93, c:'#5FA89A', ref:1,
      svg:'<rect x="1" y="80" width="28" height="13" fill="#B9B2A3"/><polygon points="7,80 23,80 20.5,47 9.5,47" fill="#CFC8B8"/>'
        + P('9.5,47 20.5,47 19.5,24 17.5,15 13,15 11,24') + C(15, 11.8, 3) + P('11.6,10.5 10,6.5 12.6,9 13.4,5 14.6,8.6 16,5.2 16.6,9 19.2,6.6 18.4,10.8')
        + P('16.5,17.5 19.5,15 21.6,5 19.8,4.6') + R(19.6, 2.6, 3, 2.4) + C(21.1, 1.7, 1.7, 'fill="#F2C230"') + R(8.6, 21, 3.2, 6.5, .5, '@d') },
    { id:'bigben', n:'Big Ben', de:'de Big Ben', cat:'monument', t:96, dim:'h', w:16, h:96, c:'#B08D57',
      svg:R(2.5, 31, 11, 65) + R(1, 18, 14, 13.5) + P('1,18 15,18 11,8.5 5,8.5') + P('5,8.5 11,8.5 8.5,0 7.5,0') + C(8, 24.7, 4.6, 'fill="#F4F1EA"') + C(8, 24.7, .7, '@d')
        + '<path d="M8 24.7 V21.4 M8 24.7 L10.2 25.8" stroke="#000" stroke-opacity=".6" stroke-width=".6" fill="none"/>' + rep(5, i => R(4 + i * 1.9, 36, .7, 56, 0, '@d')) },
    { id:'arc', n:"L'Arc de Triomphe", de:"de l'Arc de Triomphe", cat:'monument', t:50, dim:'h', w:45, h:50, c:'#CDBB95',
      svg:'<path d="M0 50 V0 H45 V50 H31.5 V28 Q31.5 15 22.5 15 Q13.5 15 13.5 28 V50 Z"/>' + R(0, 8.5, 45, 2, 0, '@d') + R(0, 0, 45, 2, 0, '@d') + R(3, 26, 7.5, 13, 0, '@d') + R(34.5, 26, 7.5, 13, 0, '@d') },
    { id:'kheops', n:'La pyramide de Khéops', de:'de la pyramide de Khéops', cat:'monument', t:139, dim:'h', w:230, h:139, c:'#D8B36A',
      svg:P('0,139 115,0 230,139') + Pd('115,0 230,139 150,139') },
    { id:'burj', n:'Le Burj Khalifa', de:'du Burj Khalifa, à Dubaï', cat:'monument', t:828, dim:'h', w:60, h:828, c:'#7FA0B8',
      svg:P('0,828 60,828 60,640 52,640 52,470 44,470 44,330 37,330 37,210 33,210 33,110 31,60 30.5,0 29.5,0 29,60 27,110 27,250 21,250 21,400 13,400 13,560 5,560 5,700 0,700')
        + Pd('30,60 31,60 33,110 33,210 37,210 37,330 44,330 44,470 52,470 52,640 60,640 60,828 30,828') },
    { id:'pise', n:'La tour de Pise', de:'de la tour de Pise', cat:'monument', t:56, dim:'h', w:26, h:56, c:'#E8E1D0',
      svg:P('3,56 19.5,56 23.5,8 8.5,8') + P('11,8 21.5,8 22,0 11.4,0') + rep(6, i => `<polygon points="${3.5 + (i + 1) * .75},${48.5 - i * 7} ${19.9 + (i + 1) * .58},${48.5 - i * 7} ${19.95 + (i + 1) * .58},${47.3 - i * 7} ${3.6 + (i + 1) * .75},${47.3 - i * 7}" @d/>`) },
    { id:'christ', n:'Le Christ Rédempteur de Rio', de:'du Christ Rédempteur de Rio (avec son socle)', cat:'monument', t:38, dim:'h', w:30, h:38, c:'#D9D4C7',
      svg:'<rect x="11.5" y="30" width="7" height="8" fill="#8E8A80"/>' + P('12.3,30 17.7,30 17,6 13,6') + R(1, 6.6, 28, 3) + P('1,6.6 6.5,6.6 5.6,12.4 1,9.6') + P('29,6.6 23.5,6.6 24.4,12.4 29,9.6') + C(15, 2.4, 2.4) },
    { id:'empire', n:"L'Empire State Building", de:"de l'Empire State Building (avec l'antenne)", cat:'monument', t:443, dim:'h', w:57, h:443, c:'#A9A294',
      svg:P('0,443 57,443 57,400 50,400 50,330 44,330 44,120 40,120 40,90 35,90 35,70 31.5,62 30,45 29,0 28,0 27,45 25.5,62 22,70 22,90 17,90 17,120 13,120 13,330 7,330 7,400 0,400')
        + rep(4, i => R(17 + i * 6.4, 130, 3, 265, 0, '@d')) },
    { id:'taj', n:'Le Taj Mahal', de:'du Taj Mahal', cat:'monument', t:73, dim:'h', w:95, h:73, c:'#EFE9DD',
      svg:R(0, 66, 95, 7) + R(27, 38, 41, 28) + '<path d="M36 38 Q32 22 47.5 12 Q63 22 59 38 Z"/>' + P('47.5,0 48.5,13 46.5,13') + C(31.5, 35.5, 4.2) + C(63.5, 35.5, 4.2)
        + R(3, 27, 4, 39) + R(88, 27, 4, 39) + C(5, 25.6, 2.7) + C(90, 25.6, 2.7) + '<path d="M41.5 66 V50 Q47.5 39.5 53.5 50 V66 Z" @d/>'
        + '<path d="M30 66 V56 Q33 51.5 36 56 V66 Z" @d/><path d="M59 66 V56 Q62 51.5 65 56 V66 Z" @d/>' },
    { id:'colisee', n:'Le Colisée de Rome', de:'du Colisée de Rome', cat:'monument', t:48, dim:'h', w:189, h:48, c:'#D2B48C',
      svg:'<path d="M0 48 V17 Q0 11 6 11 H98 V0 H183 Q189 0 189 6 V48 Z"/>' + rep(14, i => `<path d="M${7 + i * 13} 46 V40 Q${10.5 + i * 13} 35 ${14 + i * 13} 40 V46 Z" @d/><path d="M${7 + i * 13} 33 V27 Q${10.5 + i * 13} 22 ${14 + i * 13} 27 V33 Z" @d/>`)
        + rep(14, i => `<path d="M${7 + i * 13} 20.5 V15.5 Q${10.5 + i * 13} 11.5 ${14 + i * 13} 15.5 V20.5 Z" @d/>`) + rep(6, i => R(104 + i * 13, 3.5, 4, 4, 0, '@d')) },
    { id:'notredame', n:'Les tours de Notre-Dame de Paris', de:'des tours de Notre-Dame de Paris', cat:'monument', t:69, dim:'h', w:48, h:69, c:'#C9C1AE',
      svg:R(0, 28, 48, 41) + R(0, 0, 17, 29) + R(31, 0, 17, 29) + C(24, 39, 5.6, 'fill="#5B7FA6"') + R(0, 27, 48, 2.2, 0, '@d') + R(0, 46, 48, 1.6, 0, '@d')
        + rep(2, i => R(3.5 + i * 6, 5, 3.6, 19, 1.8, '@d') + R(34.5 + i * 6, 5, 3.6, 19, 1.8, '@d')) + rep(3, i => `<path d="M${3.5 + i * 16} 69 V58 Q${8.5 + i * 16} 49 ${13.5 + i * 16} 58 V69 Z" @d/>`) },
    { id:'moai', n:"Un moaï de l'île de Pâques", de:"d'un moaï de l'île de Pâques (en moyenne)", cat:'monument', t:4, dim:'h', w:16, h:40, c:'#8B8478',
      svg:'<path d="M3 40 V23 Q1 21 2 12 Q2 2 8 0 Q14 2 14 12 Q15 21 13 23 V40 Z"/>' + R(3.4, 9, 9.2, 2.2, 0, '@d') + Pd('7,11.2 9,11.2 10.4,19.5 5.6,19.5') + R(5, 22.6, 6, 1.4, 0, '@d') + Pd('1.6,11 3,10 3,19 1.8,18') + Pd('14.4,11 13,10 13,19 14.2,18') },
    { id:'sphinx', n:'Le Sphinx de Gizeh', de:'du Sphinx de Gizeh', cat:'monument', t:20, dim:'h', w:73, h:20, c:'#D8B36A',
      svg:'<path d="M0 20 V15.5 Q10 14.5 22 14.5 Q24 9 36 8.5 Q46 8 53 9.5 Q54 2 60 0 Q67.5 0 68.5 6 L67.5 12.5 Q73 14.5 73 20 Z"/>' + Pd('55,3.5 53.5,13 58,13 58,5') + Pd('66,5 67,11.5 64.5,12') + R(58, 14.2, 15, 1.6, 0, '@d') },
    { id:'millau', n:'Le viaduc de Millau', de:'du viaduc de Millau (au sommet du plus haut pylône)', cat:'monument', t:343, dim:'h', w:420, h:343, c:'#B9C2CC',
      svg:R(0, 98, 420, 5) + rep(3, i => { const x = 70 + i * 140; return P(`${x - 9},343 ${x + 9},343 ${x + 4},103 ${x - 4},103`) + P(`${x - 3},98 ${x + 3},98 ${x + 1},0 ${x - 1},0`)
        + rep(5, k => trait(`M${x} ${6 + k * 12} L${x - 62 + k * 10} 98 M${x} ${6 + k * 12} L${x + 62 - k * 10} 98`, 1)); }) },
    { id:'atomium', n:"L'Atomium de Bruxelles", de:"de l'Atomium de Bruxelles", cat:'monument', t:102, dim:'h', w:100, h:102, c:'#AEB8C4',
      svg:trait('M50 9 V93 M50 51 L13 31 M50 51 L87 31 M50 51 L13 71 M50 51 L87 71 M50 9 L13 31 L13 71 L50 93 L87 71 L87 31 Z M13 71 L8 102 M87 71 L92 102 M50 93 V102', 3)
        + C(50, 9, 9) + C(50, 93, 9) + C(50, 51, 9) + C(13, 31, 9) + C(87, 31, 9) + C(13, 71, 9) + C(87, 71, 9) + rep(7, i => { const p = [[50, 9], [50, 93], [50, 51], [13, 31], [87, 31], [13, 71], [87, 71]][i]; return C(p[0] - 2.8, p[1] - 2.8, 3, '@l'); }) },
    { id:'skytree', n:'La Tokyo Skytree', de:'de la Tokyo Skytree', cat:'monument', t:634, dim:'h', w:68, h:634, c:'#9FB4C7',
      svg:P('0,634 68,634 44,300 24,300') + R(29, 140, 10, 160) + R(16, 270, 36, 28, 4) + R(22, 176, 24, 18, 4) + P('32.5,140 35.5,140 34.6,0 33.4,0') + Pd('34,634 68,634 44,300 34,300') },
    { id:'eolienne', n:'Une grande éolienne', de:"d'une grande éolienne (en bout de pale)", cat:'monument', t:150, dim:'h', w:100, h:150, c:'#E3E8EE',
      svg:P('47.4,150 52.6,150 51.3,50 48.7,50') + R(46.5, 47, 8.5, 5.4, 1.5) + rep(3, i => `<polygon points="50,0 52.6,40 50,50 48.6,40" transform="rotate(${i * 120} 50 50)"/>`) + C(50, 50, 2.6, '@d') },
    { id:'londoneye', n:'La grande roue de Londres (London Eye)', de:'de la grande roue de Londres', cat:'monument', t:135, dim:'h', w:124, h:135, c:'#C9D3DE',
      svg:trait('M62 61 L22 135 M62 61 L102 135', 5) + `<circle cx="62" cy="61" r="57" fill="none" stroke="@c" stroke-width="3.5"/>` + rep(8, i => trait(`M62 61 L${(62 + 57 * Math.cos(i * Math.PI / 8 * 2)).toFixed(1)} ${(61 + 57 * Math.sin(i * Math.PI / 8 * 2)).toFixed(1)}`, 1))
        + rep(16, i => C((62 + 59.5 * Math.cos(i * Math.PI / 8 + .2)).toFixed(1), (61 + 59.5 * Math.sin(i * Math.PI / 8 + .2)).toFixed(1), 2.6, 'fill="#5B7FA6"')) + C(62, 61, 5) },

    /* ---------- Les machines ---------- */
    { id:'a380', n:'Un Airbus A380', de:"d'un Airbus A380", cat:'machine', t:73, dim:'l', w:73, h:24, c:'#E8ECF1', ref:1,
      svg:'<path d="M0 17.5 Q1 13 8 11.5 H55 L71 9 Q73 9.5 71.5 12 L60 19 Q55 20.5 50 20.5 H8 Q1 20.5 0 17.5 Z"/>' + '<polygon points="56,11.5 66,0 71,0 68,10" fill="#2E5FA8"/>'
        + Pd('26,17 40,17 47,21.3 36,20.8') + E(30, 21.2, 3.6, 1.6, '@d') + E(38.5, 21.7, 3.4, 1.5, '@d') + R(12, 20.3, .8, 3) + C(12.4, 23.3, .7, '@d') + R(36, 20.5, .9, 2.8) + C(35.6, 23.2, .8, '@d') + C(37.4, 23.2, .8, '@d')
        + '<path d="M9 13.8 H54 M9 16 H52" stroke="#5B7FA6" stroke-width=".7" stroke-dasharray="1 .8" fill="none"/><polygon points="2.2,14.6 5.5,13 6.2,14.4 3,15.6" fill="#33485E"/>' },
    { id:'saturn5', n:'La fusée Saturn V', de:'de la fusée Saturn V (missions Apollo)', cat:'machine', t:111, dim:'h', w:18, h:111, c:'#EEF1F4',
      svg:R(4, 67, 10, 37) + P('4,96 0,110 4,107') + P('14,96 18,110 14,107') + rep(3, i => `<polygon points="${5 + i * 3},104 ${7 + i * 3},104 ${7.6 + i * 3},111 ${4.4 + i * 3},111" fill="#4A4F57"/>`) + R(4, 43, 10, 24) + P('4,43 14,43 12.3,37 5.7,37')
        + R(5.7, 20, 6.6, 17) + P('5.7,20 12.3,20 11,14 7,14') + R(7, 9, 4, 5) + P('7,9 11,9 9.7,6 8.3,6') + P('8.6,6 9.4,6 9.2,0 8.8,0')
        + '<rect x="4" y="66" width="10" height="2.5" fill="#1E232B"/><rect x="4" y="88" width="10" height="3" fill="#1E232B"/><rect x="5.7" y="36" width="6.6" height="1.8" fill="#1E232B"/><rect x="4" y="74" width="5" height="9" fill="#1E232B"/>' },
    { id:'ariane5', n:'La fusée Ariane 5', de:'de la fusée Ariane 5', cat:'machine', t:52, dim:'h', w:14, h:52, c:'#F0F2F5',
      svg:R(4.3, 12, 5.4, 37.5) + '<path d="M4.3 12 Q4.3 3 7 0 Q9.7 3 9.7 12 Z"/>' + R(1, 19, 3.1, 30) + R(9.9, 19, 3.1, 30) + P('1,19 4.1,19 2.55,14.5') + P('9.9,19 13,19 11.45,14.5')
        + '<polygon points="1.4,49 3.7,49 4.3,52 .8,52" fill="#4A4F57"/><polygon points="10.3,49 12.6,49 13.2,52 9.7,52" fill="#4A4F57"/><polygon points="6,49.5 8,49.5 8.6,52 5.4,52" fill="#4A4F57"/><rect x="4.3" y="26" width="5.4" height="3" fill="#F2C230"/>' },
    { id:'starship', n:'La fusée Starship', de:'de la fusée Starship (avec son lanceur)', cat:'machine', t:121, dim:'h', w:18, h:121, c:'#C9CED4',
      svg:R(4.5, 50, 9, 69) + R(4.5, 12, 9, 38) + '<path d="M4.5 12 Q4.5 3 9 0 Q13.5 3 13.5 12 Z"/>' + P('4.5,37 1.6,48 4.5,50') + P('13.5,37 16.4,48 13.5,50') + P('4.5,9 2.6,17 4.5,18.5') + P('13.5,9 15.4,17 13.5,18.5')
        + R(2.8, 52, 1.7, 4.5, 0, '@d') + R(13.5, 52, 1.7, 4.5, 0, '@d') + R(4.5, 49, 9, 1.6, 0, '@d') + '<rect x="5" y="119" width="8" height="2" fill="#3A3F47"/>' + Pd('9,0 13.5,12 13.5,50 9,50') },
    { id:'navette', n:'La navette spatiale', de:'de la navette spatiale (l\'orbiteur seul)', cat:'machine', t:37, dim:'l', w:37, h:14.6, c:'#EEF1F4',
      svg:'<path d="M0 12 Q2 8 8 7.5 H27 L31 0 H34 L33.5 7.5 L37 8 V13 H30 Q20 14.6 6 14 Q1 13.5 0 12 Z"/>' + '<path d="M0 12 Q1 13.5 6 14 Q20 14.6 30 13 H37 V12 Q20 12.8 4 12.2 Z" fill="#1E232B"/>'
        + '<polygon points="14,12.2 30,12.2 30,10.8 20,10.6" fill="#1E232B" fill-opacity=".5"/><polygon points="3.4,9.4 6.4,8.3 7,9.6 4.4,10.4" fill="#33485E"/><rect x="34.6" y="8.6" width="2.4" height="3.6" fill="#4A4F57"/>' },
    { id:'titanic', n:'Le Titanic', de:'du Titanic', cat:'machine', t:269, dim:'l', w:269, h:53, c:'#2B3440', ref:1,
      svg:P('0,31 9,53 258,53 269,30 262,30 256,36 20,36 6,31') + '<polygon points="6.6,47 259.5,47 258,53 9,53" fill="#A63A2B"/>' + '<rect x="50" y="27" width="160" height="9" fill="#F0EDE4"/><rect x="66" y="22" width="126" height="5" fill="#F0EDE4"/>'
        + rep(4, i => `<polygon points="${84 + i * 30},22 ${93 + i * 30},22 ${91 + i * 30},3 ${82 + i * 30},3" fill="#E0A63A"/><polygon points="${82.6 + i * 30},8 ${91.6 + i * 30},8 ${91 + i * 30},3 ${82 + i * 30},3" fill="#1E232B"/>`)
        + P('39.4,36 40.6,36 40.3,2 39.7,2') + P('226.4,36 227.6,36 227.3,6 226.7,6') },
    { id:'conteneurs', n:'Un porte-conteneurs géant', de:"d'un porte-conteneurs géant", cat:'machine', t:400, dim:'l', w:400, h:73, c:'#2F5D8A',
      svg:P('0,45 12,73 386,73 400,45') + '<polygon points="8.5,65 389.6,65 386,73 12,73" fill="#A63A2B"/>' + rep(13, i => `<rect x="${28 + i * 20}" y="${[20, 16, 22, 16, 18, 16, 20, 16, 22, 18, 16, 20, 18][i]}" width="18" height="${45 - [20, 16, 22, 16, 18, 16, 20, 16, 22, 18, 16, 20, 18][i]}" fill="${['#D9534F', '#F2A541', '#5FA89A', '#E8ECF1', '#D9534F', '#4A86CF', '#F2A541', '#5FA89A', '#D9534F', '#E8ECF1', '#4A86CF', '#F2A541', '#D9534F'][i]}"/>`)
        + '<rect x="294" y="4" width="18" height="41" fill="#F0EDE4"/><rect x="290" y="4" width="26" height="5" fill="#F0EDE4"/>' + rep(3, i => `<rect x="${320 + i * 20}" y="${[22, 18, 26][i]}" width="18" height="${45 - [22, 18, 26][i]}" fill="${['#4A86CF', '#D9534F', '#F2A541'][i]}"/>`) + '<rect x="348" y="0" width="8" height="18" fill="#E0A63A"/>' },
    { id:'tgv', n:"La motrice d'un TGV", de:"de la motrice d'un TGV", cat:'machine', t:22, dim:'l', w:22, h:4.3, c:'#D8DDE4',
      svg:'<path d="M0 3.85 Q.4 2.6 3 1.6 Q6 .3 9 .2 H22 V3.85 Z"/>' + '<polygon points="3.4,1.55 6.4,.6 7.4,1.5 4.2,2.1" fill="#33485E"/><rect x="9" y="2.6" width="13" height=".5" fill="#2E5FA8"/><path d="M.2 3.3 Q4 2.7 9 2.6 V3.1 Q4 3.2 .2 3.6 Z" fill="#2E5FA8"/>'
        + rep(2, i => C(4.4 + i * 2, 3.85, .45, 'fill="#1E232B"') + C(16.2 + i * 2, 3.85, .45, 'fill="#1E232B"')) + '<polygon points="12,.2 13,-.0 16,0 15,.2" fill="#4A4F57"/>' },
    { id:'bus', n:'Un bus de ville', de:"d'un bus de ville", cat:'machine', t:12, dim:'l', w:12, h:3.2, c:'#2E9E6B', ref:1,
      svg:R(0, 0, 12, 2.75, .35) + '<rect x=".5" y=".45" width="11" height="1.1" rx=".15" fill="#BFD9EA"/>' + rep(5, i => R(1.3 + i * 2.1, .45, .12, 1.1)) + R(.9, 1.55, 1.3, 1.2, 0, '@d') + R(6.2, 1.55, 1.5, 1.2, 0, '@d')
        + C(2.9, 2.72, .48, 'fill="#1E232B"') + C(9.4, 2.72, .48, 'fill="#1E232B"') + C(2.9, 2.72, .2, 'fill="#9AA3AF"') + C(9.4, 2.72, .2, 'fill="#9AA3AF"') },
    { id:'routemaster', n:'Un bus londonien à étage', de:"d'un bus londonien à étage", cat:'machine', t:4.4, dim:'h', w:11.2, h:4.4, c:'#D7261E',
      svg:R(0, 0, 11.2, 3.98, .5) + '<rect x=".5" y=".45" width="10.2" height="1" rx=".15" fill="#BFD9EA"/><rect x=".5" y="2.05" width="10.2" height=".95" rx=".15" fill="#BFD9EA"/>' + rep(5, i => R(1.6 + i * 1.9, .45, .12, 1) + R(1.6 + i * 1.9, 2.05, .12, .95))
        + C(2.4, 3.98, .42, 'fill="#1E232B"') + C(8.9, 3.98, .42, 'fill="#1E232B"') + R(0, 1.62, 11.2, .2, 0, '@d') },
    { id:'voiture', n:'Une petite voiture', de:"d'une petite voiture (une citadine)", cat:'machine', t:4.05, dim:'l', w:4.05, h:1.45, c:'#3B82C4', ref:1,
      svg:'<path d="M0 1.15 Q0 .75 .5 .7 L1.1 .15 Q1.2 0 1.5 0 H2.9 Q3.2 0 3.4 .3 L3.7 .7 Q4.05 .75 4.05 1 V1.2 H0 Z"/>' + '<polygon points="1.22,.18 2.02,.14 2.02,.66 .84,.66" fill="#BFD9EA"/><polygon points="2.16,.14 2.88,.14 3.3,.66 2.16,.66" fill="#BFD9EA"/>'
        + C(.86, 1.15, .3, 'fill="#1E232B"') + C(3.2, 1.15, .3, 'fill="#1E232B"') + C(.86, 1.15, .13, 'fill="#9AA3AF"') + C(3.2, 1.15, .13, 'fill="#9AA3AF"') },
    { id:'f1', n:'Une Formule 1', de:"d'une Formule 1", cat:'machine', t:5.5, dim:'l', w:5.5, h:1, c:'#D7261E',
      svg:'<path d="M.1 .82 L.9 .6 L2.2 .55 L2.5 .22 Q2.9 .08 3.3 .22 L3.5 .32 L4.4 .45 L4.8 .5 L5.3 .62 L5.5 .85 H.1 Z"/>' + R(4.7, .02, .8, .14) + R(5.36, .02, .1, .6) + P('0,.78 .75,.72 .75,.9 0,.9')
        + C(1, .67, .33, 'fill="#1E232B"') + C(4.35, .66, .34, 'fill="#1E232B"') + C(1, .67, .13, 'fill="#F2C230"') + C(4.35, .66, .13, 'fill="#F2C230"') + '<path d="M2.45 .42 Q2.9 .16 3.35 .42" fill="none" stroke="#1E232B" stroke-width=".07"/>' },
    { id:'semi', n:'Un camion semi-remorque', de:"d'un camion semi-remorque", cat:'machine', t:16.5, dim:'l', w:16.5, h:4, c:'#E8ECF1', ref:1,
      svg:R(4, 0, 12.5, 3.1, .1) + '<path d="M0 3.3 V1.5 Q0 .7 .8 .7 H3.5 V3.3 Z" fill="#D7261E"/><polygon points=".3,1.6 .5,1 2,1 2,1.9 .3,1.9" fill="#BFD9EA"/><rect x="0" y="3.05" width="16.5" height=".4" fill="#33485E"/>'
        + rep(6, i => C([1.2, 4.9, 6.1, 12.4, 13.6, 14.8][i], 3.5, .5, 'fill="#1E232B"') + C([1.2, 4.9, 6.1, 12.4, 13.6, 14.8][i], 3.5, .2, 'fill="#9AA3AF"')) + '<rect x="6" y=".8" width="8.5" height="1.2" fill="#2E5FA8" fill-opacity=".85"/>' },
    { id:'velo', n:'Un vélo', de:"d'un vélo", cat:'machine', t:1.75, dim:'l', w:1.75, h:1.05, c:'#2E9E6B',
      svg:'<circle cx=".35" cy=".7" r=".32" fill="none" stroke="#33485E" stroke-width=".06"/><circle cx="1.4" cy=".7" r=".32" fill="none" stroke="#33485E" stroke-width=".06"/>'
        + trait('M.35 .7 L.72 .3 L1.24 .3 L.84 .72 Z M.72 .3 L.84 .72 M1.24 .3 L1.4 .7 M1.24 .3 L1.2 .1 M.72 .3 L.67 .17', .05) + '<rect x=".55" y=".12" width=".26" height=".06" rx=".03" fill="#33485E"/><path d="M1.12 .06 Q1.26 .02 1.3 .12" fill="none" stroke="#33485E" stroke-width=".05" stroke-linecap="round"/>' + C(.84, .72, .06, 'fill="#33485E"') },
    { id:'dameuse', n:'Une dameuse', de:"d'une dameuse (au toit de la cabine)", cat:'machine', t:2.9, dim:'h', w:9, h:2.9, c:'#D7261E',
      svg:'<rect x="1.8" y="1.85" width="5.1" height="1.05" rx=".5" fill="#1E232B"/>' + rep(5, i => C(2.45 + i * .95, 2.38, .3, 'fill="#4A4F57"')) + R(2.2, 1.1, 4.3, .85, .1) + P('2.4,1.1 2.7,0 4.7,0 5,1.1')
        + '<polygon points="2.75,.95 2.95,.15 4.45,.15 4.65,.95" fill="#BFD9EA"/>' + '<polygon points=".25,1.25 .9,1.15 1.1,2.8 .15,2.9" fill="#9AA3AF"/><rect x="1" y="1.75" width="1.3" height=".16" fill="#4A4F57"/>'
        + '<rect x="7.05" y="2.2" width="1.9" height=".62" rx=".25" fill="#F2C230"/><rect x="6.4" y="1.8" width="1" height=".16" fill="#4A4F57" transform="rotate(25 6.4 1.8)"/>' },
    { id:'belaz', n:'Le plus gros camion minier du monde', de:'du plus gros camion minier du monde (BelAZ 75710)', cat:'machine', t:8.2, dim:'h', w:20.6, h:8.2, c:'#F2B233',
      svg:P('3,0 20,1.5 20.6,4.2 8,4.4 6,2 3,1.2') + R(2.2, 2.2, 2.6, 1.9, .2) + '<rect x="2.5" y="2.5" width="1.6" height=".9" fill="#BFD9EA"/><rect x="2" y="4.1" width="16.4" height="1.7" fill="#4A4F57"/>'
        + C(5.2, 6.2, 2, 'fill="#1E232B"') + C(15.3, 6.2, 2, 'fill="#1E232B"') + C(5.2, 6.2, .8, 'fill="#F2B233"') + C(15.3, 6.2, .8, 'fill="#F2B233"') + R(1.4, 4.4, .25, 2.2, 0, '@d') },
    { id:'sousmarin', n:'Un sous-marin nucléaire', de:"d'un sous-marin nucléaire (Le Triomphant)", cat:'machine', t:138, dim:'l', w:138, h:21, c:'#2B3440',
      svg:'<path d="M0 15 Q3 9 20 9 H120 Q134 9.5 138 14 Q134 19.5 120 20.5 H20 Q4 21 0 15 Z"/>' + P('48,9.4 50,0 64,0 67,9.4') + R(44, 3, 26, 1.2) + P('126,9.6 130,3 134,3 133,10.4') + '<rect x="134" y="11" width="4" height="6" fill="#B08D57"/>' },
    { id:'cdg', n:'Le porte-avions Charles de Gaulle', de:'du porte-avions Charles de Gaulle', cat:'machine', t:261.5, dim:'l', w:261.5, h:75, c:'#7F8C99',
      svg:P('5,75 0,48 40,40 255,40 261.5,48 246,75') + P('0,36 261.5,36 261.5,40.5 0,40.5') + R(165, 15, 40, 21.5) + P('180,15 184,0 186,0 190,15') + C(198, 11, 5.4) + '<polygon points="3,64 250.6,64 246,75 5,75" fill="#33485E"/>'
        + rep(5, i => `<polygon points="${30 + i * 26},36 ${38 + i * 26},32.5 ${46 + i * 26},36" fill="#33485E"/>`) + rep(4, i => R(170 + i * 8, 19, 4, 3, 0, '@d')) },
    { id:'iss', n:'La Station spatiale internationale', de:'de la Station spatiale internationale', q:'Quelle est la largeur', u:'de large', cat:'machine', t:109, dim:'l', w:109, h:73, c:'#C9CED4',
      svg:R(0, 35, 109, 3.4) + rep(4, i => { const x = [1, 15.5, 80.5, 95][i]; return `<rect x="${x}" y="2" width="12.5" height="31" fill="#2E5FA8"/><rect x="${x}" y="40.4" width="12.5" height="31" fill="#2E5FA8"/>` + rep(5, k => `<rect x="${x}" y="${7 + k * 6}" width="12.5" height=".8" fill="#fff" fill-opacity=".35"/><rect x="${x}" y="${45.4 + k * 6}" width="12.5" height=".8" fill="#fff" fill-opacity=".35"/>`); })
        + R(50, 12, 9, 52, 3.5) + R(40, 20, 29, 6, 2.5) + R(36, 41, 7, 19, 0, '@l') + R(66, 41, 7, 19, 0, '@l') + R(44, 52, 21, 5, 2) },
    { id:'moto', n:'Une moto', de:"d'une moto", cat:'machine', t:2.1, dim:'l', w:2.1, h:1.15, c:'#D7261E',
      svg:C(.33, .84, .31, 'fill="#1E232B"') + C(1.77, .84, .31, 'fill="#1E232B"') + C(.33, .84, .12, 'fill="#9AA3AF"') + C(1.77, .84, .12, 'fill="#9AA3AF"')
        + '<path d="M.42 .56 L.9 .36 H1.25 L1.45 .2 L1.62 .26 L1.5 .52 L1.77 .84 L1.66 .87 L1.36 .56 L1.2 .82 H.75 L.6 .62 Z"/>' + '<polygon points=".5,.5 .92,.33 1.22,.36 .98,.48" fill="#1E232B"/><polygon points="1.4,.2 1.5,0 1.6,.03 1.62,.26" fill="#BFD9EA"/><rect x=".66" y=".66" width=".5" height=".2" fill="#4A4F57"/>' },

    /* ---------- Les appareils et les objets ---------- */
    { id:'smartphone', n:'Un smartphone', de:"d'un smartphone", cat:'objet', t:.15, dim:'h', w:7.2, h:15, c:'#2B3440', ref:1,
      svg:R(0, 0, 7.2, 15, 1) + '<rect x=".45" y=".45" width="6.3" height="14.1" rx=".7" fill="#5FB0E8"/><rect x="2.6" y=".8" width="2" height=".55" rx=".27" fill="#1E232B"/>'
        + rep(8, i => `<rect x="${1 + (i % 4) * 1.4}" y="${3 + Math.floor(i / 4) * 1.6}" width="1" height="1" rx=".25" fill="${['#F2C230', '#E4572E', '#3DDC84', '#fff', '#C04DFF', '#fff', '#F2A541', '#2E9E6B'][i]}"/>`) },
    { id:'frigo', n:'Un réfrigérateur', de:"d'un réfrigérateur", cat:'objet', t:1.8, dim:'h', w:70, h:180, c:'#D8DDE4',
      svg:R(0, 0, 70, 178, 3) + R(0, 58, 70, 1.6, 0, '@d') + R(6, 20, 3, 26, 1.5, '@d') + R(6, 70, 3, 40, 1.5, '@d') + R(4, 176, 8, 4, 0, '@d') + R(58, 176, 8, 4, 0, '@d') },
    { id:'lavelinge', n:'Un lave-linge', de:"d'un lave-linge", cat:'objet', t:.85, dim:'h', w:60, h:85, c:'#EEF1F4',
      svg:R(0, 0, 60, 83, 2) + R(0, 0, 60, 14, 2, '@d') + C(30, 49, 20, 'fill="#9AA3AF"') + C(30, 49, 14.5, 'fill="#5FB0E8"') + C(12, 7, 3.4, '@l') + R(36, 4.5, 18, 5, 1, 'fill="#1E232B"') + R(4, 83, 6, 2, 0, '@d') + R(50, 83, 6, 2, 0, '@d') },
    { id:'tele', n:'Une télévision de 55 pouces', de:"d'une télévision de 55 pouces", q:'Quelle est la largeur', u:'de large', cat:'objet', t:1.23, dim:'l', w:123, h:78, c:'#1E232B',
      svg:R(0, 0, 123, 71, 2) + '<rect x="1.6" y="1.6" width="119.8" height="67.8" fill="#3B82C4"/><polygon points="1.6,69.4 1.6,45 40,28 62,42 86,20 121.4,48 121.4,69.4" fill="#2E9E6B"/><circle cx="98" cy="16" r="7" fill="#F2C230"/>' + P('50,71 73,71 82,78 41,78') },
    { id:'portable', n:'Un ordinateur portable', de:"d'un ordinateur portable (15 pouces)", q:'Quelle est la largeur', u:'de large', cat:'objet', t:.36, dim:'l', w:36, h:24, c:'#9AA3AF',
      svg:R(4, 0, 28, 21.4, 1.2) + '<rect x="5.2" y="1.2" width="25.6" height="18.6" fill="#5FB0E8"/>' + P('0,21.2 36,21.2 34.4,24 1.6,24') + R(14, 21.9, 8, .8, .4, '@d') },
    { id:'guitare', n:'Une guitare classique', de:"d'une guitare classique", cat:'objet', t:1, dim:'h', w:37, h:100, c:'#C98A3C',
      svg:E(18.5, 81, 18.4, 19) + E(18.5, 56.5, 14, 14) + C(18.5, 63, 5.6, 'fill="#3A2416"') + R(11, 83, 15, 3, 0, 'fill="#3A2416"') + '<rect x="15.6" y="12" width="5.8" height="35" fill="#5B3A22"/><rect x="14" y="0" width="9" height="13.4" rx="1.6" fill="#5B3A22"/>'
        + '<path d="M17 13 V85 M18.5 13 V85 M20 13 V85" stroke="#fff" stroke-opacity=".55" stroke-width=".35" fill="none"/>' },
    { id:'ballon', n:'Un ballon de basket', de:"d'un ballon de basket", q:'Quel est le diamètre', u:'de diamètre', cat:'objet', t:.24, dim:'h', w:24, h:24, c:'#E8762B', ref:1,
      svg:C(12, 12, 12) + '<path d="M12 0 V24 M0 12 H24 M3.5 3.5 Q11 12 3.5 20.5 M20.5 3.5 Q13 12 20.5 20.5" fill="none" stroke="#1E232B" stroke-width=".8"/>' },
    { id:'but', n:'Un but de football', de:"d'un but de football", q:'Quelle est la largeur', u:'de large', cat:'objet', t:7.32, dim:'l', w:7.32, h:2.5, c:'#F4F6F9',
      svg:rep(14, i => `<path d="M${.26 + i * .5} .1 V2.5" stroke="#7F8C99" stroke-opacity=".7" stroke-width=".03" fill="none"/>`) + rep(4, i => `<path d="M.1 ${.5 + i * .5} H7.2" stroke="#7F8C99" stroke-opacity=".7" stroke-width=".03" fill="none"/>`)
        + R(0, 0, .13, 2.5) + R(7.19, 0, .13, 2.5) + R(0, 0, 7.32, .13) },
    { id:'raquette', n:'Une raquette de tennis', de:"d'une raquette de tennis", cat:'objet', t:.685, dim:'h', w:26, h:68.5, c:'#2E5FA8',
      svg:'<ellipse cx="13" cy="17.4" rx="10.6" ry="15.2" fill="#fff" fill-opacity=".3"/>' + rep(6, i => `<path d="M${5.5 + i * 3} 5 V30" stroke="#fff" stroke-opacity=".6" stroke-width=".3" fill="none"/>`) + rep(8, i => `<path d="M3 ${6.5 + i * 3.1} H23" stroke="#fff" stroke-opacity=".6" stroke-width=".3" fill="none"/>`)
        + '<ellipse cx="13" cy="17.4" rx="11.8" ry="16.2" fill="none" stroke="@c" stroke-width="2.4"/>' + P('8.6,32 10.6,32.6 12.4,43 11.4,43') + P('17.4,32 15.4,32.6 13.6,43 14.6,43') + R(11.4, 43, 3.2, 25.5, 1, 'fill="#1E232B"') },
    { id:'canette', n:'Une canette de soda', de:"d'une canette de soda (33 cl)", cat:'objet', t:.115, dim:'h', w:6.6, h:11.5, c:'#D7261E', ref:1,
      svg:R(0, 0, 6.6, 11.5, .7) + R(.4, 0, 5.8, .7, .3, 'fill="#C9CED4"') + R(.4, 10.8, 5.8, .7, .3, 'fill="#C9CED4"') + '<path d="M0 6.4 Q2 4.2 3.5 5.6 Q5 7 6.6 4.8 V6.4 Q5 8.6 3.5 7.2 Q2 5.8 0 8 Z" @l/>' },
    { id:'bouteille', n:"Une bouteille d'eau d'un litre et demi", de:"d'une bouteille d'eau d'un litre et demi", cat:'objet', t:.32, dim:'h', w:8.8, h:32, c:'#8FD0F0',
      svg:'<rect x="3" y="0" width="2.8" height="1.7" rx=".3" fill="#2E5FA8"/>' + '<path d="M3.2 1.7 H5.6 V4 Q8.8 6 8.8 10 V30 Q8.8 32 6.8 32 H2 Q0 32 0 30 V10 Q0 6 3.2 4 Z"/>' + '<rect x="0" y="13" width="8.8" height="8" fill="#2E5FA8"/>' + R(1, 24, 1, 5.5, .5, '@l') },
    { id:'minifig', n:'Une figurine LEGO', de:"d'une figurine LEGO", cat:'objet', t:.04, dim:'h', w:2.5, h:4, c:'#F2C230',
      svg:R(.75, .25, 1, .88, .25) + R(1, 0, .5, .32) + '<polygon points=".5,1.15 2,1.15 2.2,2.4 .3,2.4" fill="#D7261E"/><polygon points=".5,1.2 .1,2.1 .45,2.25 .62,1.7" fill="#D7261E"/><polygon points="2,1.2 2.4,2.1 2.05,2.25 1.88,1.7" fill="#D7261E"/>'
        + C(.27, 2.3, .2) + C(2.23, 2.3, .2) + '<rect x=".3" y="2.4" width="1.9" height=".28" fill="#2E5FA8"/><rect x=".35" y="2.68" width=".86" height="1.32" fill="#2E5FA8"/><rect x="1.29" y="2.68" width=".86" height="1.32" fill="#2E5FA8"/>'
        + C(1.05, .62, .07, 'fill="#1E232B"') + C(1.45, .62, .07, 'fill="#1E232B"') + '<path d="M1 .82 Q1.25 1 1.5 .82" fill="none" stroke="#1E232B" stroke-width=".05"/>' },
    { id:'ampoule', n:'Une ampoule', de:"d'une ampoule", cat:'objet', t:.11, dim:'h', w:6, h:11, c:'#FBE38A',
      svg:'<path d="M3 0 Q6 0 6 3.2 Q6 5.2 4.6 6.6 Q4.3 7.2 4.3 7.8 H1.7 Q1.7 7.2 1.4 6.6 Q0 5.2 0 3.2 Q0 0 3 0 Z"/>' + '<rect x="1.7" y="7.8" width="2.6" height="2.4" fill="#9AA3AF"/><rect x="2.4" y="10.2" width="1.2" height=".8" fill="#4A4F57"/>'
        + '<path d="M1.7 8.6 H4.3 M1.7 9.4 H4.3" stroke="#4A4F57" stroke-width=".2" fill="none"/><path d="M2.3 7.6 L2 4.6 L3 5.4 L4 4.6 L3.7 7.6" fill="none" stroke="#D98A3D" stroke-width=".25"/>' },
    { id:'pingpong', n:'Une table de ping-pong', de:"d'une table de ping-pong", cat:'objet', t:2.74, dim:'l', w:274, h:91.25, c:'#2E6FA8',
      svg:R(0, 15.25, 274, 4) + '<rect x="136" y="0" width="2" height="15.25" fill="#F4F6F9"/><rect x="134" y="0" width="6" height="1.6" fill="#F4F6F9"/>' + '<path d="M40 19 L26 91 M40 19 L70 91 M234 19 L248 91 M234 19 L204 91 M48 60 H226" fill="none" stroke="#4A4F57" stroke-width="3.2"/>' },
    { id:'skate', n:'Un skateboard', de:"d'un skateboard", cat:'objet', t:.8, dim:'l', w:80, h:12, c:'#C98A3C',
      svg:'<path d="M0 1.5 Q3 4 10 4.5 H70 Q77 4 80 1.5 L79.6 3.4 Q76 6.4 70 6.4 H10 Q4 6.4 .4 3.4 Z"/>' + '<rect x="13" y="6.4" width="6" height="2" fill="#9AA3AF"/><rect x="61" y="6.4" width="6" height="2" fill="#9AA3AF"/>' + C(16, 9.3, 2.7, 'fill="#F4F6F9"') + C(64, 9.3, 2.7, 'fill="#F4F6F9"') },
    { id:'carte', n:'Une carte bancaire', de:"d'une carte bancaire", cat:'objet', t:.0856, dim:'l', w:8.56, h:5.4, c:'#2E5FA8',
      svg:R(0, 0, 8.56, 5.4, .35) + '<rect x=".9" y="1.5" width="1.3" height="1" rx=".15" fill="#F2C230"/>' + R(.9, 3.5, 4.6, .32, 0, '@l') + R(.9, 4.2, 2.4, .26, 0, '@l') + '<circle cx="6.6" cy="4.1" r=".62" fill="#E4572E"/><circle cx="7.3" cy="4.1" r=".62" fill="#F2A541" fill-opacity=".9"/>' },
    { id:'porte', n:'Une porte de maison', de:"d'une porte de maison", cat:'objet', t:2.04, dim:'h', w:83, h:204, c:'#9A5B3C', ref:1,
      svg:R(0, 0, 83, 204) + R(8, 10, 67, 80, 2, '@d') + R(8, 100, 67, 94, 2, '@d') + '<circle cx="71" cy="106" r="3.4" fill="#F2C230"/>' },
    { id:'vin', n:'Une bouteille de vin', de:"d'une bouteille de vin", cat:'objet', t:.3, dim:'h', w:7.5, h:30, c:'#2F5D3A',
      svg:'<path d="M2.6 0 H4.9 V8 Q7.5 11 7.5 14.5 V29 Q7.5 30 6.5 30 H1 Q0 30 0 29 V14.5 Q0 11 2.6 8 Z"/>' + '<rect x="2.6" y="0" width="2.3" height="2.6" fill="#7A1F2B"/><rect x="0" y="16.5" width="7.5" height="8" fill="#F0EDE4"/>' + R(1.4, 19, 4.7, .5, 0, 'fill="#7A1F2B"') + R(2, 20.6, 3.5, .4, 0, 'fill="#9AA3AF"') },
  ];
  // les raccourcis de dessin
  for(const o of L) o.svg = o.svg.replace(/@d/g, 'fill="#000" fill-opacity=".26"').replace(/@l/g, 'fill="#fff" fill-opacity=".38"').replace(/@c/g, o.c);
  return L;
})();
