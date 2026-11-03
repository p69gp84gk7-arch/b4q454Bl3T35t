/* Rock Altitude : les 8 morceaux composés pour le jeu, et l'arrangement (batterie, basse, guitare rythmique, claviers).
   Un morceau : bpm, cle (la note de base, en MIDI), oct (la hauteur de la guitare solo au-dessus de la base), son (les sons),
   motifs (les phrases de la guitare solo), sections (les accords, une mesure chacun, et les phrases jouées dessus).
   Une phrase : « degré:durée » séparés par des espaces ; degré = demi-tons au-dessus de la base (- = silence),
   durée en doubles croches (4 = un temps). Une phrase dure une ou plusieurs mesures entières (16 doubles croches). */
window.ROCK_MORCEAUX = (() => {
  'use strict';
  const M = [
    { id:'ciel', n:'Ciel de neige', style:'Pop rock', niveau:1, bpm:108, cle:48, oct:24, son:{ solo:'crunch', ryt:'crunch', clav:'piano' }, batt:'pop', ryt:'pop', basse:'pop',
      motifs:{
        A:'4:4 4:2 2:2 0:4 2:4  4:4 7:4 4:8', B:'9:4 7:2 4:2 7:4 4:4  2:4 0:2 2:2 -:8',
        C:'12:6 11:2 9:4 7:4  9:4 7:4 5:4 4:4', D:'4:4 5:4 7:4 9:4  7:16', F:'12:8 11:8  12:16' },
      sections:[
        { acc:'C G Am F', solo:null, clav:true }, { acc:'C G Am F C G Am F', solo:'A B A B' }, { acc:'F G C Am F G C C', solo:'C D C D', etoile:true },
        { acc:'C G Am F C G Am F', solo:'A B A B' }, { acc:'F G C Am F G C C', solo:'C D C F', etoile:true }, { acc:'C C', solo:null, fin:true } ] },

    { id:'blues', n:'Blues du refuge', style:'Blues', niveau:2, bpm:82, cle:45, oct:24, swing:1, son:{ solo:'crunch', ryt:'crunch', clav:'orgue' }, batt:'shuffle', ryt:'shuffle', basse:'marche',
      motifs:{
        A:'12:4 10:2 12:2 -:4 10:2 7:2  10:2 7:2 5:2 3:2 0:8', B:'15:2 12:2 10:4 12:4 -:4  10:2 12:2 10:2 7:2 6:2 5:2 3:4', C:'12:12 10:4  7:16',
        D:'12:2 15:2 12:2 10:2 12:2 10:2 7:2 10:2  7:2 5:2 3:2 5:2 3:2 0:2 3:4', E:'0:2 3:2 5:2 6:2 7:4 10:4  12:2 10:2 12:2 15:2 17:8' },
      sections:[
        { acc:'A7 A7', solo:null }, { acc:'A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7', solo:'A B C A B C', clav:true },
        { acc:'A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7', solo:'D E D C E A', etoile:true }, { acc:'A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7', solo:'A B C A E C', clav:true, etoile:true },
        { acc:'A7 A7', solo:null, fin:true } ] },

    { id:'bourree', n:'La bourrée du berger', style:'Folk de montagne', niveau:2, bpm:126, cle:50, oct:12, son:{ solo:'violon', ryt:'clair', clav:'orgue' }, batt:'folk', ryt:'folk', basse:'folk',
      motifs:{
        A:'0:2 2:2 4:2 5:2 7:4 4:4  5:2 4:2 2:2 0:2 2:8', B:'7:2 9:2 7:2 5:2 4:4 7:4  9:4 11:2 12:2 7:8',
        C:'12:4 11:2 9:2 7:4 9:4  7:2 5:2 4:2 2:2 0:8', D:'0:1 2:1 4:1 5:1 7:2 5:2 4:2 2:2 0:4  7:1 9:1 11:1 12:1 11:2 9:2 7:4 4:4', F:'0:16 -:16' },
      sections:[
        { acc:'D D', solo:null }, { acc:'D G A D D G A D', solo:'A B A B' }, { acc:'G D A D G D A D', solo:'C D C D', etoile:true, clav:true },
        { acc:'D G A D D G A D', solo:'A B A B' }, { acc:'G D A D G D A D', solo:'C D C D', etoile:true, clav:true }, { acc:'D D', solo:'F', fin:true } ] },

    { id:'funk', n:'Funk des marmottes', style:'Funk', niveau:3, bpm:102, cle:40, oct:24, son:{ solo:'clair', ryt:'clair', clav:'orgue' }, batt:'funk', ryt:'funk', basse:'funk',
      motifs:{
        A:'12:1 -:1 12:1 10:1 12:2 -:2 7:1 -:1 10:2 12:2 -:2  15:1 -:1 15:2 12:1 10:1 12:2 -:4 7:2 10:2', B:'7:2 -:2 7:2 10:2 -:2 12:2 10:2 7:2  5:4 7:2 -:2 3:2 5:2 0:4',
        C:'19:4 17:2 15:2 17:4 15:2 12:2  15:8 12:8', F:'12:2 -:2 10:2 12:2 -:8  0:16' },
      sections:[
        { acc:'E9 E9', solo:null }, { acc:'E9 E9 E9 E9', solo:'A A' }, { acc:'A9 A9 E9 E9', solo:'B C', etoile:true, clav:true },
        { acc:'E9 E9 E9 E9', solo:'A A' }, { acc:'A9 A9 E9 E9 A9 A9 E9 E9', solo:'B C B C', etoile:true, clav:true },
        { acc:'E9 E9 E9 E9 E9 E9 E9 E9', solo:'A A A A' }, { acc:'A9 A9 E9 E9 A9 A9 E9 E9', solo:'B C B C', etoile:true, clav:true }, { acc:'E9 E9', solo:'F', fin:true } ] },

    { id:'premier', n:'Premier riff', style:'Rock', niveau:3, bpm:112, cle:40, oct:24, son:{ solo:'sature', ryt:'sature' }, batt:'rock', ryt:'croches', basse:'croches',
      motifs:{
        A:'0:4 0:2 3:2 5:4 3:4  0:4 0:2 3:2 5:2 7:2 5:4', B:'7:4 7:4 10:4 7:4  5:6 3:2 5:4 -:4',
        C:'12:2 10:2 7:2 10:2 12:4 15:4  12:2 10:2 7:2 5:2 7:8', F:'12:8 10:8  7:16' },
      sections:[
        { acc:'E5 E5', solo:null, ryt:'tenu' }, { acc:'E5 E5 D5 A5 E5 E5 D5 A5', solo:'A A A A' }, { acc:'G5 A5 G5 A5 G5 A5 B5 B5', solo:'B B B C', etoile:true },
        { acc:'E5 E5 D5 A5 E5 E5 D5 A5', solo:'A A A A' }, { acc:'G5 A5 G5 A5 G5 A5 B5 B5', solo:'B C B C', etoile:true }, { acc:'E5 E5', solo:'F', fin:true, ryt:'tenu' } ] },

    { id:'tourmalet', n:'Col du Tourmalet', style:'Hard rock', niveau:4, bpm:122, cle:45, oct:24, son:{ solo:'sature', ryt:'sature' }, batt:'rock', ryt:'croches', basse:'croches',
      motifs:{
        A:'0:2 0:2 12:2 0:2 10:2 0:2 7:2 5:2  0:2 0:2 3:2 5:2 7:4 5:4', B:'12:4 12:4 15:4 12:4  10:6 7:2 10:8', C:'7:4 8:4 10:4 12:4  15:4 12:4 10:8',
        D:'12:1 15:1 17:1 15:1 12:1 15:1 17:1 15:1 12:2 10:2 12:4  17:2 15:2 12:2 10:2 12:8', F:'0:16  0:16' },
      sections:[
        { acc:'A5 A5', solo:'A', ryt:'tenu' }, { acc:'A5 A5 C5 D5 A5 A5 C5 D5', solo:'A A A A' }, { acc:'F5 G5 A5 A5 F5 G5 A5 A5', solo:'B C B C', etoile:true },
        { acc:'A5 G5 F5 G5 A5 G5 F5 G5', solo:'D D D D', etoile:true }, { acc:'A5 A5 C5 D5 A5 A5 C5 D5', solo:'A A A A' }, { acc:'F5 G5 A5 A5 F5 G5 A5 A5', solo:'B C B C', etoile:true },
        { acc:'A5 A5', solo:'F', fin:true, ryt:'tenu' } ] },

    { id:'telesiege', n:'Télésiège express', style:'Punk', niveau:4, bpm:168, cle:38, oct:24, son:{ solo:'sature', ryt:'sature' }, batt:'punk', ryt:'punk', basse:'croches',
      motifs:{
        A:'12:4 12:2 14:2 16:4 14:4  12:4 9:4 7:8', B:'16:4 16:4 19:4 16:4  14:4 12:4 14:8', C:'0:2 0:2 7:2 0:2 5:2 0:2 7:2 9:2  7:2 5:2 7:2 9:2 12:8', F:'12:8 7:8  0:16' },
      sections:[
        { acc:'D5 D5', solo:'C' }, { acc:'D5 G5 A5 D5 D5 G5 A5 D5', solo:'A A A A' }, { acc:'B5 G5 D5 A5 B5 G5 D5 A5', solo:'B B B B', etoile:true },
        { acc:'D5 D5 G5 G5 D5 D5 G5 G5', solo:'C C C C' }, { acc:'D5 G5 A5 D5 D5 G5 A5 D5', solo:'A A A A' }, { acc:'B5 G5 D5 A5 B5 G5 D5 A5 B5 G5 D5 A5', solo:'B B B B B B', etoile:true },
        { acc:'D5 D5', solo:'F', fin:true } ] },

    { id:'avalanche', n:'Avalanche', style:'Métal', niveau:5, bpm:150, cle:40, oct:12, son:{ solo:'sature', ryt:'sature' }, batt:'metal', ryt:'galop', basse:'galop',
      motifs:{
        A:'0:1 0:1 0:2 0:1 0:1 0:2 1:2 0:2 3:2 2:2  0:1 0:1 0:2 0:1 0:1 0:2 5:2 3:2 1:4', B:'12:4 15:4 17:4 15:4  19:4 17:4 15:8',
        C:'12:1 15:1 17:1 19:1 17:1 15:1 12:1 15:1 17:1 19:1 22:1 19:1 17:1 15:1 17:2  24:4 22:2 19:2 17:4 15:4', D:'0:8 1:8  0:16' },
      sections:[
        { acc:'E5 E5', solo:'D', ryt:'tenu' }, { acc:'E5 E5 F5 E5 E5 E5 F5 E5', solo:'A A A A' }, { acc:'C5 D5 E5 E5 C5 D5 E5 E5', solo:'B B B B', etoile:true },
        { acc:'E5 D5 C5 D5 E5 D5 C5 D5', solo:'C C C C', etoile:true }, { acc:'E5 E5 F5 E5 E5 E5 F5 E5', solo:'A A A A' }, { acc:'C5 D5 E5 E5 C5 D5 E5 E5', solo:'B B C C', etoile:true },
        { acc:'E5 E5', solo:'D', fin:true, ryt:'tenu' } ] },
  ];

  /* ---------- Les accords ---------- */
  const PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  function accordDe(nom){
    const m = nom.match(/^([A-G])(#|b)?(.*)$/), pc = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, q = m[3];
    const r = 40 + (pc - 4 + 12) % 12;                                  // la fondamentale, entre mi 2 et ré# 3
    const notes = q === '5' ? [r, r + 7, r + 12] : q === 'm' ? [r, r + 7, r + 12, r + 15] : q === '7' ? [r, r + 7, r + 10, r + 16] : q === '9' ? [r + 4, r + 10, r + 14, r + 19] : q === 'm7' ? [r, r + 7, r + 10, r + 15] : [r, r + 7, r + 12, r + 16];
    return { r, basse:r - 12, notes, tierce:q === 'm' || q === 'm7' ? 3 : 4, sept:q === '7' || q === '9' || q === 'm7' };
  }
  function phrase(txt){ const L = []; let b = 0; for(const tk of txt.trim().split(/\s+/)){ const [d, l] = tk.split(':'); const dur = +l / 4; if(d !== '-') L.push({ b, d:+d, dur }); b += dur; } return { notes:L, long:b }; }

  /* ---------- La batterie : 16 pas par mesure (x frappe, o charley ouvert, g note fantôme) ---------- */
  const BATT = {
    rock:{ K:'x.......x.x.....', S:'....x.......x...', H:'x.x.x.x.x.x.x.x.' },
    pop:{ K:'x.......x.......', S:'....x.......x...', H:'x.x.x.x.x.x.x.xo' },
    shuffle:{ K:'x.......x.......', S:'....x.......x...', H:'x.xxx.xxx.xxx.xx' },
    folk:{ K:'x...x...x...x...', S:'....x.......x...', T:'x.x.x.x.x.x.x.x.' },
    funk:{ K:'x..x..x...x..x..', S:'....x..g.g..x..g', H:'xxxxxxxxxxxxxxxx' },
    punk:{ K:'x.x.x.x.x.x.x.x.', S:'..x...x...x...x.', H:'x.x.x.x.x.x.x.x.' },
    metal:{ K:'xxxxxxxxxxxxxxxx', S:'....x.......x...', H:'x...x...x...x...' },
  };
  const ROULEMENT = '....x...x.x.xxxx';

  /* ---------- L'arrangement : toutes les notes du morceau, en temps (battements) ---------- */
  function arranger(m){
    const ev = [], solo = []; let mes = 0;
    const ajout = (b, type, p) => ev.push(Object.assign({ b, type }, p));
    const sections = [];
    m.sections.forEach((s, si) => {
      const accs = s.acc.split(/\s+/), n = accs.length, b0 = mes * 4, batt = BATT[m.batt], ryt = s.ryt || m.ryt;
      sections.push({ b0, b1:b0 + n * 4, etoile:!!s.etoile, solo:!!s.solo });
      accs.forEach((nom, k) => {
        const A = accordDe(nom), bm = (mes + k) * 4, derniere = k === n - 1 && n >= 2 && !s.fin;
        // batterie
        if(k === 0 && si > 0) ajout(bm, 'cymbale');
        for(let p = 0; p < 16; p++){
          const b = bm + p / 4;
          if(s.fin && k === n - 1){ if(p === 0){ ajout(b, 'grosse'); ajout(b, 'cymbale'); } continue; }
          if(batt.K[p] === 'x') ajout(b, 'grosse');
          const sn = derniere && p >= 4 ? ROULEMENT[p] : batt.S[p];
          if(sn === 'x') ajout(b, 'caisse'); else if(sn === 'g') ajout(b, 'caisse', { v:.35 });
          if(batt.H && batt.H[p] !== '.' && !(derniere && p >= 12)) ajout(b, 'charley', { ouvert:batt.H[p] === 'o', v:p % 4 ? .7 : 1 });
          if(batt.T && batt.T[p] === 'x') ajout(b, 'tambourin', { v:p % 4 ? .6 : 1 });
        }
        if(m.batt === 'metal' && derniere){ for(let p = 12; p < 16; p++) ajout(bm + p / 4, 'tom', { m:50 - (p - 12) * 4 }); }
        // guitare rythmique
        const son = m.son.ryt, N = A.notes, tenir = d => ajout(bm, 'accord', { notes:N, dur:d, son });
        if(s.fin && k === n - 1){ tenir(4); }
        else if(ryt === 'tenu') tenir(4);
        else if(ryt === 'croches') for(let p = 0; p < 16; p += 2) ajout(bm + p / 4, 'accord', { notes:N, dur:.5, son, etouffe:p % 8 !== 0 });
        else if(ryt === 'galop') for(const [p, l] of [[0, 2], [2, 1], [3, 1], [4, 2], [6, 1], [7, 1], [8, 2], [10, 1], [11, 1], [12, 2], [14, 1], [15, 1]]) ajout(bm + p / 4, 'accord', { notes:N.slice(0, 2), dur:l / 4, son, etouffe:true });
        else if(ryt === 'punk') for(let p = 0; p < 16; p += 2) ajout(bm + p / 4, 'accord', { notes:N, dur:.5, son });
        else if(ryt === 'pop') for(const [p, l] of [[0, 3], [3, 3], [6, 2], [8, 2], [10, 3], [13, 3]]) ajout(bm + p / 4, 'accord', { notes:N, dur:l / 4, son, etouffe:p === 13 });
        else if(ryt === 'shuffle') for(let p = 0; p < 16; p += 2){ const six = (p / 2) % 2 ? 9 : 7; ajout(bm + p / 4, 'accord', { notes:[A.r, A.r + six], dur:.5, son, etouffe:true }); }
        else if(ryt === 'funk') for(let p = 0; p < 16; p++){ const stab = p === 0 || p === 6 || p === 10; ajout(bm + p / 4, 'accord', { notes:N, dur:stab ? .4 : .2, son, etouffe:!stab, v:stab ? 1 : .55 }); }
        else if(ryt === 'folk') for(const [p, l] of [[0, 2], [4, 2], [6, 2], [8, 2], [12, 2], [14, 2]]) ajout(bm + p / 4, 'accord', { notes:p === 0 || p === 8 ? [A.r, A.r + 7] : N.slice(1), dur:l / 4, son });
        // claviers
        if(s.clav && m.son.clav) ajout(bm, m.son.clav, { notes:N.map(x => x + 12), dur:4 });
        // basse
        const R = A.basse, bas = (p, nt, l, v) => ajout(bm + p / 4, 'basse', { m:nt, dur:l / 4, v });
        if(s.fin && k === n - 1) bas(0, R, 16);
        else if(m.basse === 'croches') for(let p = 0; p < 16; p += 2) bas(p, R, 2);
        else if(m.basse === 'galop') for(const p of [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]) bas(p, R, p % 2 ? 1 : 2);
        else if(m.basse === 'pop'){ bas(0, R, 6); bas(6, R, 2); bas(8, R, 4); bas(12, R + 7, 4); }
        else if(m.basse === 'marche'){ const t = A.tierce; [0, t, 7, 9, 10, 9, 7, t].forEach((d, i) => bas(i * 2, R + d, 2)); }
        else if(m.basse === 'funk'){ bas(0, R, 2); bas(3, R + 12, 1, .7); bas(6, R, 2); bas(8, R + 10, 1, .7); bas(10, R, 2); bas(11, R + 12, 1, .6); bas(14, R + 7, 2); }
        else if(m.basse === 'folk'){ bas(0, R, 4); bas(8, R + 7, 4); }
      });
      // la guitare solo : les phrases jouées sur la section
      if(s.solo){
        let b = b0;
        for(const nom of s.solo.split(/\s+/)){
          const ph = phrase(m.motifs[nom]);
          for(const nt of ph.notes) solo.push({ b:b + nt.b, m:m.cle + m.oct + nt.d, dur:nt.dur, etoile:!!s.etoile, sec:si });
          b += ph.long;
        }
      }
      mes += n;
    });
    // le décompte avant le début : 4 coups de baguettes
    return { ev, solo, sections, beats:mes * 4 };
  }
  // vérifie que chaque phrase dure un nombre entier de mesures
  function verifier(){
    const pb = [];
    for(const m of M){ for(const [k, t] of Object.entries(m.motifs)){ const l = phrase(t).long; if(Math.abs(l / 4 - Math.round(l / 4)) > 1e-6) pb.push(`${m.id} ${k} : ${l} temps`); }
      m.sections.forEach((s, i) => { if(!s.solo) return; const l = s.solo.split(/\s+/).reduce((a, n) => a + phrase(m.motifs[n]).long, 0), n = s.acc.split(/\s+/).length * 4; if(Math.abs(l - n) > 1e-6) pb.push(`${m.id} section ${i} : ${l} temps de solo pour ${n}`); }); }
    return pb;
  }
  return { LISTE:M, arranger, accordDe, verifier, phrase };
})();
