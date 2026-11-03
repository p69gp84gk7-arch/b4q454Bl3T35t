/* Rock Altitude : le groupe (Web Audio). Batterie, basse, guitare rythmique, guitare solo (ou violon), claviers.
   Les morceaux sont joués en direct par l'application : chaque note est programmée à l'avance sur l'horloge audio,
   et les notes de la guitare solo ont chacune leur volume, pour se couper quand le joueur rate (comme dans les jeux de guitare). */
window.ROCK_SON = (() => {
  'use strict';
  let AC = null, maitre = null, bruit = null, B = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function courbe(k){ const n = 2048, c = new Float32Array(n); for(let i = 0; i < n; i++){ const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
  function init(){
    if(AC) return AC;
    AC = new (window.AudioContext || window.webkitAudioContext)({ latencyHint:'interactive' });
    const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .2;
    maitre = AC.createGain(); maitre.gain.value = .85; maitre.connect(comp).connect(AC.destination);
    bruit = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = bruit.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const filtre = (type, f, q = .7) => { const b = AC.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = v => { const g = AC.createGain(); g.gain.value = v; return g; };
    const chaine = (...n) => { for(let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[0]; };
    // un petit écho pour la guitare solo
    const echo = AC.createDelay(1); echo.delayTime.value = .28; const retour = gain(.28), echoSortie = gain(.22);
    echo.connect(retour).connect(echo); echo.connect(echoSortie).connect(maitre);
    const sat = k => { const s = AC.createWaveShaper(); s.curve = courbe(k); s.oversample = '2x'; return s; };
    B.batt = chaine(gain(.9), maitre);
    B.basse = chaine(gain(1), filtre('lowpass', 1100), gain(.75), maitre);
    B.rythSat = chaine(gain(1), sat(7), filtre('lowpass', 3400), filtre('peaking', 900, 1), gain(.2), maitre);
    B.rythClair = chaine(gain(1), filtre('lowpass', 5200), gain(.32), maitre);
    const leadSat = gain(.24); B.leadSat = chaine(gain(1), sat(16), filtre('lowpass', 4600), filtre('highpass', 160), leadSat); leadSat.connect(maitre); leadSat.connect(echo);
    const leadClair = gain(.4); B.leadClair = chaine(gain(1), filtre('lowpass', 4200), leadClair); leadClair.connect(maitre); leadClair.connect(echo);
    const violon = gain(.34); B.violon = chaine(gain(1), filtre('bandpass', 1500, .6), filtre('lowpass', 5000), violon); violon.connect(maitre); violon.connect(echo);
    B.piano = chaine(gain(1), filtre('lowpass', 4000), gain(.3), maitre);
    B.orgue = chaine(gain(1), filtre('lowpass', 2600), gain(.18), maitre);
    B.sfx = chaine(gain(1), maitre);
    B.mp3 = chaine(gain(1), maitre);
    return AC;
  }
  const env = (g, t, a, v, d, s, fin, r = .06) => {
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setTargetAtTime(v * s, t + a, d); g.gain.setValueAtTime(v * s, Math.max(t + a, fin)); g.gain.setTargetAtTime(0, Math.max(t + a, fin), r);
  };
  function osc(type, f, t, fin, dest, det = 0){ const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det; o.connect(dest); o.start(t); o.stop(fin + .5); return o; }
  function bruitSrc(t, dur, dest){ const s = AC.createBufferSource(); s.buffer = bruit; s.connect(dest); s.start(t, Math.random() * .5, dur + .05); return s; }

  /* ---------- La batterie ---------- */
  function grosse(t, v = 1){
    const g = AC.createGain(); g.connect(B.batt); env(g, t, .002, 1.1 * v, .09, 0, t + .3, .05);
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); o.connect(g); o.start(t); o.stop(t + .45);
    const c = AC.createGain(); c.connect(B.batt); env(c, t, .001, .25 * v, .01, 0, t + .02, .01); bruitSrc(t, .03, c);
  }
  function caisse(t, v = 1){
    const g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200; f.connect(g); g.connect(B.batt);
    env(g, t, .001, .7 * v, .06, 0, t + .2, .06); bruitSrc(t, .3, f);
    const c = AC.createGain(); c.connect(B.batt); env(c, t, .001, .5 * v, .04, 0, t + .1, .04);
    const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + .08); o.connect(c); o.start(t); o.stop(t + .3);
  }
  function charley(t, ouvert = false, v = 1){
    const g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; f.connect(g); g.connect(B.batt);
    env(g, t, .001, .28 * v, ouvert ? .12 : .025, 0, t + (ouvert ? .35 : .06), .03); bruitSrc(t, ouvert ? .5 : .1, f);
  }
  function cymbale(t, v = 1){
    const g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000; f.connect(g); g.connect(B.batt);
    env(g, t, .002, .35 * v, .5, 0, t + 1.4, .4); bruitSrc(t, 1.8, f);
  }
  function tambourin(t, v = 1){
    const g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 9000; f.Q.value = 2; f.connect(g); g.connect(B.batt);
    env(g, t, .002, .35 * v, .05, 0, t + .12, .04); bruitSrc(t, .2, f);
  }
  function tom(t, m, v = 1){
    const g = AC.createGain(); g.connect(B.batt); env(g, t, .002, .7 * v, .12, 0, t + .3, .08);
    const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(mtof(m) * 1.6, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + .1); o.connect(g); o.start(t); o.stop(t + .5);
  }

  /* ---------- La basse ---------- */
  function basse(t, m, dur, v = 1){
    const g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(1400, t); f.frequency.setTargetAtTime(380, t, .08); f.connect(g); g.connect(B.basse);
    const fin = t + dur * .92; env(g, t, .004, .55 * v, .25, .7, fin, .04);
    osc('sawtooth', mtof(m), t, fin, f); osc('square', mtof(m) / 2, t, fin, f).detune.value = 3;
  }

  /* ---------- Les guitares et les claviers ---------- */
  // son : 'sature', 'crunch', 'clair' ; etouffe : jeu étouffé de la paume (court et sourd)
  function accord(t, notes, dur, son = 'sature', etouffe = false, v = 1){
    const bus = son === 'clair' ? B.rythClair : B.rythSat, g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.value = etouffe ? (son === 'clair' ? 1100 : 700) : son === 'crunch' ? 2600 : 4200; f.connect(g); g.connect(bus);
    const fin = t + (etouffe ? Math.min(dur, .12) : dur * .95);
    if(son === 'clair') env(g, t, .003, .55 * v, etouffe ? .03 : .35, etouffe ? 0 : .25, fin, .08);
    else env(g, t, .004, (son === 'crunch' ? .4 : .5) * v, etouffe ? .05 : .6, etouffe ? .2 : .8, fin, .05);
    notes.forEach((m, i) => { const tt = t + i * (son === 'clair' ? .012 : .004); osc(son === 'clair' ? 'triangle' : 'sawtooth', mtof(m), tt, fin, f, (i % 2 ? 7 : -7)); if(son !== 'clair') osc('sawtooth', mtof(m), tt, fin, f, i % 2 ? -12 : 12); else osc('sawtooth', mtof(m), tt, fin, f, 4).frequency.value = mtof(m); });
  }
  function piano(t, notes, dur, v = 1){
    notes.forEach((m, i) => {
      const g = AC.createGain(); g.connect(B.piano); const fin = t + dur;
      env(g, t + i * .006, .003, .32 * v, .5, .15, fin, .25);
      osc('triangle', mtof(m), t, fin, g); const h = AC.createGain(); h.gain.value = .3; h.connect(g); osc('sine', mtof(m) * 2, t, fin, h);
    });
  }
  function orgue(t, notes, dur, v = 1){
    const g = AC.createGain(); g.connect(B.orgue); const fin = t + dur * .95; env(g, t, .01, .3 * v, .5, 1, fin, .06);
    notes.forEach(m => { osc('sine', mtof(m), t, fin, g); osc('sine', mtof(m) * 2, t, fin, g); osc('sine', mtof(m) * 3, t, fin, g, 4); });
  }
  // la guitare solo (ou le violon) : la note a son propre volume (rendu), pour pouvoir la couper si elle est ratée
  function solo(t, m, dur, son = 'sature', v = 1){
    const bus = son === 'clair' ? B.leadClair : son === 'violon' ? B.violon : B.leadSat;
    const coupe = AC.createGain(); coupe.connect(bus);
    const g = AC.createGain(); g.connect(coupe);
    const fin = t + Math.max(.08, dur * .96);
    if(son === 'violon') env(g, t, .05, .5 * v, .3, .9, fin, .08);
    else if(son === 'clair') env(g, t, .003, .6 * v, .35, .35, fin, .07);
    else env(g, t, .004, .55 * v, .4, .85, fin, .06);
    const oscs = [osc('sawtooth', mtof(m), t, fin, g, son === 'violon' ? 0 : -6), osc(son === 'clair' ? 'triangle' : 'sawtooth', mtof(m), t, fin, g, son === 'violon' ? 5 : 7)];
    // vibrato sur les notes longues
    if(dur > .35){
      const lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = son === 'violon' ? 5.5 : 5.8; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(son === 'violon' ? 14 : 22, t + Math.min(.5, dur * .6));
      lfo.connect(lg); oscs.forEach(o => lg.connect(o.detune)); lfo.start(t); lfo.stop(fin + .5);
    }
    return coupe;
  }
  // couper une note de la guitare solo (ratée, ou lâchée trop tôt)
  function couper(g, quand){ if(!g) return; const t = Math.max(AC.currentTime, quand ?? AC.currentTime); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.setTargetAtTime(0, t, .012); }
  // la fausse note : un « clonk » de cordes
  function fausse(){
    if(!AC) return; const t = AC.currentTime, g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.5; f.connect(g); g.connect(B.sfx);
    env(g, t, .002, .22, .05, 0, t + .12, .05); osc('sawtooth', 98, t, t + .15, f); osc('sawtooth', 104, t, t + .15, f); bruitSrc(t, .1, f);
  }
  function bip(notes, vol = .1){ if(!AC) return; const t0 = AC.currentTime; notes.forEach(([f, d], i) => { const g = AC.createGain(); g.connect(B.sfx); const t = t0 + d; env(g, t, .005, vol, .1, 0, t + .15, .05); osc('triangle', f, t, t + .2, g); }); }
  function huees(){
    if(!AC) return; const t = AC.currentTime, g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = .8; f.connect(g); g.connect(B.sfx);
    env(g, t, .3, .35, .8, .6, t + 2, .6); bruitSrc(t, 2.5, f);
    for(let k = 0; k < 6; k++){ const o = AC.createOscillator(), og = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140 + Math.random() * 60, t); o.frequency.linearRampToValueAtTime(90 + Math.random() * 30, t + 2); og.gain.value = .02; o.connect(og).connect(f); o.start(t); o.stop(t + 2.4); }
  }
  function applaudir(){
    if(!AC) return; const t = AC.currentTime;
    for(let k = 0; k < 40; k++){ const tt = t + Math.random() * 2.2, g = AC.createGain(), f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500 + Math.random() * 1500; f.Q.value = 1.2; f.connect(g); g.connect(B.sfx); env(g, tt, .002, .12, .02, 0, tt + .04, .02); bruitSrc(tt, .06, f); }
  }
  function volume(v){ if(maitre) maitre.gain.value = v; }

  return { init, get AC(){ return AC; }, get bus(){ return B; }, mtof, grosse, caisse, charley, cymbale, tambourin, tom, basse, accord, piano, orgue, solo, couper, fausse, bip, huees, applaudir, volume };
})();
