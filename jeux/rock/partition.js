/* Rock Altitude : les partitions (les notes à jouer sur les bandes).
   - Pour les morceaux composés : la guitare solo devient des notes ; la bande suit la hauteur (plus aigu = plus à droite),
     on garde moins de notes en Facile, des notes longues pour les notes tenues ; en Moyen et en Difficile, des doubles notes
     (deux bandes en même temps) et des notes glissées (une note tenue qui passe sur la bande voisine : le doigt glisse).
   - Pour les musiques du joueur (MP3) : on écoute le morceau (les attaques dans les graves, les médiums et les aigus),
     on trouve le tempo, et on place les notes sur les attaques fortes, calées sur la grille des temps. */
window.ROCK_PARTITION = (() => {
  'use strict';
  const DIFF = {
    // accords : la chance d'une double note sur un temps fort ; glisses : la chance qu'une note tenue soit glissée
    facile:{ nom:'Facile', voies:3, ecart:1, ecartVite:2, long:2, accords:0, glisses:0, vue:2.1, fenetre:.13, perte:.035 },
    moyen:{ nom:'Moyen', voies:4, ecart:.5, ecartVite:1, long:1.5, accords:.3, glisses:.6, pauseGl:6, vue:1.7, fenetre:.11, perte:.055 },
    difficile:{ nom:'Difficile', voies:4, ecart:.25, ecartVite:.5, long:1.5, accords:.7, glisses:.7, pauseGl:4, vue:1.35, fenetre:.095, perte:.07 },
  };
  // le temps (s) d'un battement, avec le balancé (swing) des croches
  function temps(b, bpm, swing = 0){
    const e = Math.floor(b), f = b - e, d = swing * .1667;
    const g = f < .5 ? f * (.5 + d) / .5 : .5 + d + (f - .5) * (.5 - d) / .5;
    return (e + g) * 60 / bpm;
  }
  const graine = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

  // la bande d'une note : sa hauteur par rapport aux notes voisines (sur ±4 temps)
  function voies(notes, L){
    const res = [];
    for(let i = 0; i < notes.length; i++){
      const n = notes[i]; let lo = Infinity, hi = -Infinity;
      for(let j = i; j >= 0 && notes[j].b > n.b - 4; j--){ lo = Math.min(lo, notes[j].m); hi = Math.max(hi, notes[j].m); }
      for(let j = i; j < notes.length && notes[j].b < n.b + 4; j++){ lo = Math.min(lo, notes[j].m); hi = Math.max(hi, notes[j].m); }
      if(hi - lo < 4){ const c = (hi + lo) / 2; lo = c - 2.5; hi = c + 2.5; }
      let v = Math.round((n.m - lo) / (hi - lo) * (L - 1));
      const p = res.length ? notes[i - 1] : null, pv = res.length ? res[res.length - 1] : null;
      if(p && n.m !== p.m && v === pv) v = clamp(v + Math.sign(n.m - p.m), 0, L - 1);
      if(p && n.m === p.m) v = pv;
      if(p && n.m !== p.m && v === pv) v = pv === 0 ? 1 : pv - 1;
      res.push(clamp(v, 0, L - 1));
    }
    return res;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function depuisMorceau(m, arr, cle){
    const D = DIFF[cle], L = D.voies, vite = m.bpm >= 135, ecart = vite ? D.ecartVite : D.ecart;
    // les notes gardées : assez espacées pour la difficulté
    const garde = []; let der = -9;
    arr.solo.forEach((n, i) => {
      if(n.b - der < ecart - 1e-6) return;
      if(cle === 'facile' && n.dur < .5 && Math.abs(n.b - Math.round(n.b)) > 1e-6 && n.b - der < 1) return;
      garde.push(Object.assign({ i }, n)); der = n.b;
    });
    const vs = voies(garde, L), R = graine(m.bpm * 31 + L), out = [];
    garde.forEach((n, k) => {
      const t = temps(n.b, m.bpm, m.swing), suivante = garde[k + 1];
      // une note longue : tenue au moins « long » temps (et pas jusqu'à la note suivante)
      let long = 0;
      if(n.dur >= D.long - 1e-6){ const fin = Math.min(n.b + n.dur, suivante ? suivante.b : 1e9) - .25; if(fin - n.b >= .75) long = temps(fin, m.bpm, m.swing) - t; }
      const note = { t, v:vs[k], long, etoile:n.etoile, sec:n.sec, solo:n.i, b:n.b, durS:temps(n.b + n.dur, m.bpm, m.swing) - t };
      out.push(note);
      // les accords : sur les notes appuyées (début de mesure, tenues), une deuxième bande
      if(n.dur >= 1 && Math.abs(n.b % 4) < 1e-6 && R() < D.accords){
        const v2 = note.v + (note.v >= L - 1 ? -1 : note.v === 0 ? 1 : R() < .5 ? -1 : 1);
        out.push(Object.assign({}, note, { v:v2, double:true }));
      }
    });
    return finir(out, D);
  }
  // les phrases « étoile » : toutes réussies, elles remplissent la jauge étoile
  function finir(notes, D){
    notes.sort((a, b) => a.t - b.t || a.v - b.v);
    // les notes glissées : une note tenue (seule) qui passe, à mi-chemin, sur la bande voisine. De préférence vers la bande
    // de la note suivante ; jamais vers une bande où une autre note arrive pendant ce temps.
    // Une note suivie d'un petit silence (une demi-seconde au moins) peut devenir une note tenue pour être glissée.
    if(D.glisses){
      const R = graine(notes.length * 7 + D.voies); let dernierGl = -99;
      notes.forEach((n, i) => {
        if(n.double || (notes[i - 1] && notes[i - 1].t === n.t) || (notes[i + 1] && notes[i + 1].t === n.t)) return;
        const apres = notes[i + 1] ? notes[i + 1].t - n.t : 2;
        const long = n.long || (apres >= .42 ? Math.min(apres - .12, 1) : 0);
        // (pas plus d'un glissé toutes les 6 secondes en Moyen, toutes les 4 secondes en Difficile)
        if(long < .3 || n.t - dernierGl < D.pauseGl || R() >= D.glisses) return;
        const suiv = notes.find(x => x.t >= n.t + long - 1e-6);
        const v2 = suiv && suiv.v !== n.v ? n.v + Math.sign(suiv.v - n.v) : n.v === 0 ? 1 : n.v === D.voies - 1 ? n.v - 1 : n.v + (R() < .5 ? -1 : 1);
        if(notes.some(x => x !== n && x.v === v2 && x.t > n.t - .25 && x.t < n.t + long + .15)) return;
        n.long = long; n.gl = v2; n.tg = n.t + long * .5; dernierGl = n.t;
      });
    }
    notes.forEach((n, i) => { n.id = i; n.etat = 0; });
    return { notes, D };
  }

  /* ---------- Les musiques du joueur ---------- */
  function analyser(buffer, cle){
    const D = DIFF[cle], L = D.voies, sr = buffer.sampleRate, n = buffer.length, hop = 512, nf = Math.floor(n / hop);
    const c0 = buffer.getChannelData(0), c1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : c0;
    // l'énergie dans trois bandes, image par image (filtres simples)
    const eB = new Float32Array(nf), eM = new Float32Array(nf), eH = new Float32Array(nf);
    const aB = 1 - Math.exp(-2 * Math.PI * 180 / sr), aH = 1 - Math.exp(-2 * Math.PI * 2500 / sr);
    let lb = 0, lh = 0;
    for(let f = 0; f < nf; f++){
      let sb = 0, sm = 0, sh = 0;
      for(let i = f * hop, e = i + hop; i < e; i++){
        const x = (c0[i] + c1[i]) * .5; lb += aB * (x - lb); lh += aH * (x - lh);
        const hb = x - lh, mb = lh - lb; sb += lb * lb; sm += mb * mb; sh += hb * hb;
      }
      eB[f] = Math.log(1e-9 + sb); eM[f] = Math.log(1e-9 + sm); eH[f] = Math.log(1e-9 + sh);
    }
    // la force des attaques : ce qui monte d'une image à l'autre
    const att = new Float32Array(nf), cote = new Float32Array(nf);
    for(let f = 1; f < nf; f++){
      const db = Math.max(0, eB[f] - eB[f - 1]), dm = Math.max(0, eM[f] - eM[f - 1]), dh = Math.max(0, eH[f] - eH[f - 1]);
      att[f] = db + dm + dh * .8; cote[f] = (dm * .5 + dh) / (db + dm + dh + 1e-6);
    }
    const fps = sr / hop;
    // le tempo : l'autocorrélation des attaques, entre 70 et 180 battements par minute
    let best = 0, lagBest = 0;
    for(let bpm = 70; bpm <= 180; bpm += .5){
      const lag = fps * 60 / bpm; let s = 0;
      for(let f = 0; f + lag * 2 < nf; f += 2) s += att[f] * (att[Math.round(f + lag)] + .5 * att[Math.round(f + lag * 2)]);
      s *= 1 + .15 * Math.exp(-Math.pow((bpm - 120) / 40, 2));   // les tempos autour de 120 sont plus probables
      if(s > best){ best = s; lagBest = lag; }
    }
    const bpm = 60 * fps / lagBest, beat = 60 / bpm;
    // la phase : où tombent les temps
    let phase = 0, bp = -1;
    for(let k = 0; k < 32; k++){ const ph = k / 32 * lagBest; let s = 0; for(let f = ph; f < nf; f += lagBest) s += att[Math.round(f)] || 0; if(s > bp){ bp = s; phase = ph; } }
    // les notes : sur la grille (croches, ou doubles croches en Difficile), là où l'attaque est forte
    const pas = cle === 'difficile' ? .25 : .5, ecart = Math.max(D.ecart, pas), notes = [];
    const moy = new Float32Array(nf); { const w = Math.round(fps * 1.5); let s = 0; for(let f = 0; f < nf; f++){ s += att[f]; if(f >= w) s -= att[f - w]; moy[f] = s / Math.min(f + 1, w); } }
    const seuil = { facile:2.1, moyen:1.6, difficile:1.3 }[cle];
    let der = -9, derV = 1, meme = 0;
    const t0 = phase / fps, debut = Math.max(2, t0);
    for(let b = 0; ; b += pas){
      const t = t0 + b * beat; if(t > n / sr - 1.5) break; if(t < debut) continue;
      const f = Math.round(t * fps); let fort = 0, fc = f;
      for(let g = f - 3; g <= f + 3; g++) if(att[g] > fort){ fort = att[g]; fc = g; }
      const surTemps = Math.abs(b - Math.round(b)) < 1e-6;
      if(fort < moy[fc] * seuil * (surTemps ? .85 : 1.1) || fort < .4) continue;
      if(b - der < ecart - 1e-6) continue;
      notes.push({ t, v:0, c:cote[fc] + (eH[fc] - eB[fc]) * .02, long:0, b, etoile:Math.floor(b / 16) % 4 === 2 }); der = b;
    }
    // la bande : selon le timbre (plus d'aigus = plus à droite), réparti pour que chaque bande serve autant
    const tri = notes.map(x => x.c).sort((a, b) => a - b), rang = c => { let lo = 0, hi = tri.length; while(lo < hi){ const m = (lo + hi) >> 1; if(tri[m] < c) lo = m + 1; else hi = m; } return lo / tri.length; };
    for(const x of notes){
      let v = clamp(Math.floor(rang(x.c) * L), 0, L - 1);
      if(v === derV){ meme++; if(meme >= 3){ v = (v + 1 + (x.b * 7 | 0) % (L - 1)) % L; meme = 0; } } else meme = 0;
      x.v = v; derV = v;
    }
    // les notes longues : quand rien ne frappe pendant un moment et que le son reste fort
    for(let i = 0; i < notes.length; i++){
      const a = notes[i], s = notes[i + 1]; if(!s) break;
      const gap = s.b - a.b; if(gap < Math.max(D.long, 1.5)) continue;
      const fa = Math.round(a.t * fps), fb = Math.round((s.t - beat * .3) * fps); let m = 0; for(let f = fa; f < fb; f++) m += eM[f] + eH[f]; m /= Math.max(1, fb - fa);
      if(m > (eM[fa] + eH[fa]) - 2.2) a.long = (gap - .4) * beat;
    }
    // des doubles notes sur les temps forts
    if(D.accords){ const R = graine(notes.length * 13); const plus = []; for(const a of notes) if(Math.abs(a.b % 4) < 1e-6 && R() < D.accords * .6) plus.push(Object.assign({}, a, { v:a.v >= L - 1 ? a.v - 1 : a.v + 1, double:true })); notes.push(...plus); }
    const out = finir(notes, D); out.bpm = bpm; out.duree = n / sr; out.beat = beat; out.t0 = t0;
    return out;
  }
  return { DIFF, temps, depuisMorceau, analyser };
})();
