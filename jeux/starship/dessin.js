/* Starship : les dessins des véhicules, de la tour, des plateformes et des paysages (rien ici ne touche à la physique).
   Chaque véhicule est dessiné depuis sa base (le point de contact avec le sol) : le corps monte vers −y, th tourne autour de la base.
   Les formes suivent les vrais engins : Falcon 9 (étage blanc, interstage noir, ailettes en grille, jambes), la coiffe plus large que l'étage,
   Super Heavy (acier inoxydable en anneaux soudés, anneau de séparation à fentes, 33 moteurs), Starship (ogive, volets, tuiles noires côté ventre),
   Dragon (capsule, bouclier brun, panneaux solaires du coffre). */
window.STARSHIP_DESSIN = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const alea = (i, k = 0) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rondRect = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const LARGEUR = { hop:.5, starship:.19, superheavy:.115, falcon9:.095, falcon2:.095, falconPile:.085, shPile:.085, dragon:.5, dragonSeul:.9 };
  const HAUTEUR_REELLE = { hop:9, starship:52, superheavy:70, falcon9:42, falcon2:26, falconPile:68, shPile:122, dragon:12, dragonSeul:8 };
  /* ---------- Les matières ---------- */
  const ACIER = [[0, '#4A5565'], [.09, '#8794A7'], [.26, '#F7FAFE'], [.42, '#D6DDE7'], [.68, '#9AA7B9'], [.9, '#5B677A'], [1, '#394352']];
  const BLANC = [[0, '#838D9C'], [.12, '#D3D9E1'], [.3, '#FFFFFF'], [.56, '#EFF2F6'], [.82, '#B0B8C5'], [1, '#78828F']];
  const NOIR = [[0, '#06070A'], [.28, '#2C313C'], [.5, '#1C2029'], [1, '#06070A']];
  const GRIS = [[0, '#2E3541'], [.3, '#6B7585'], [.6, '#444D5B'], [1, '#232933']];
  const gr = (g, x, w, stops) => { const d = g.createLinearGradient(x, 0, x + w, 0); for(const [t, c] of stops) d.addColorStop(t, c); return d; };
  const cyl = (g, x, y, w, h, stops, r = 0) => { g.fillStyle = gr(g, x, w, stops); if(r) rondRect(g, x, y, w, h, r); else { g.beginPath(); g.rect(x, y, w, h); } g.fill(); };
  // des anneaux de tôle soudés : chaque virole a sa teinte, ses soudures et un bout de soudure verticale
  function anneaux(g, x, y, w, h, n, k, fort = 1){
    const e = h / n; if(e < 1.2) return;
    for(let i = 0; i < n; i++){
      const a = alea(i, k), yy = y + i * e;
      g.fillStyle = a > .5 ? `rgba(255,255,255,${.05 * fort * (a - .3)})` : `rgba(10,20,40,${.07 * fort * (.7 - a)})`; g.fillRect(x, yy, w, e);
      g.fillStyle = `rgba(25,35,55,${.34 * fort})`; g.fillRect(x, yy + e - Math.max(.5, e * .07), w, Math.max(.5, e * .07));
      if(e > 5){ const sx = x + w * (.12 + alea(i, k + 3) * .76); g.fillStyle = `rgba(25,35,55,${.16 * fort})`; g.fillRect(sx, yy, Math.max(.5, e * .05), e); }
    }
  }
  function cloche(g, x, w, len, chaud){          // une tuyère de moteur
    g.fillStyle = gr(g, x - w / 2, w, [[0, '#0F1217'], [.3, '#5B6472'], [.55, '#2A303A'], [1, '#0B0D11']]);
    g.beginPath(); g.moveTo(x - w * .2, -len * .5); g.lineTo(x + w * .2, -len * .5); g.lineTo(x + w / 2, len * .5); g.lineTo(x - w / 2, len * .5); g.closePath(); g.fill();
    g.fillStyle = chaud ? '#C97B3A' : '#8D97A6'; g.fillRect(x - w / 2, len * .5 - Math.max(.6, len * .08), w, Math.max(.6, len * .08));
  }
  const trait = (g, c, e) => { g.strokeStyle = c; g.lineWidth = Math.max(.6, e); g.lineCap = 'round'; };
  function suie(g, x, y, w, h, a = .4){          // la suie sous un étage qui a déjà brûlé
    const d = g.createLinearGradient(0, y + h, 0, y); d.addColorStop(0, `rgba(38,28,20,${a})`); d.addColorStop(1, 'rgba(38,28,20,0)'); g.fillStyle = d; g.fillRect(x, y, w, h);
    g.fillStyle = `rgba(30,22,16,${a * .55})`; for(let i = 0; i < 6; i++){ const sx = x + w * (.08 + alea(i, 9) * .84); g.fillRect(sx, y + h * (.15 + alea(i, 5) * .4), Math.max(.6, w * .03), h * (.4 + alea(i, 2) * .35)); }
  }
  function grille(g, x, y, w, h, flip){          // une ailette de guidage en grille
    g.fillStyle = '#1B1F27'; g.fillRect(x, y, w, h);
    trait(g, 'rgba(150,160,175,.55)', h * .06); g.beginPath();
    const n = Math.max(3, Math.round(w / Math.max(2, h * .45))); for(let i = 1; i < n; i++){ g.moveTo(x + w * i / n, y); g.lineTo(x + w * i / n, y + h); }
    g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
    g.fillStyle = '#3A4250'; g.fillRect(x, y, w, Math.max(.8, h * .1)); g.fillRect(x, y + h - Math.max(.8, h * .1), w, Math.max(.8, h * .1));
  }
  /* ---------- Falcon 9 ---------- */
  function jambesF9(g, w, h, o){
    trait(g, '#14171E', Math.max(1.4, h * .016));
    if(o.jambes){
      for(const s of [-1, 1]){
        g.beginPath(); g.moveTo(s * w * .5, -h * .2); g.lineTo(s * w * 1.7, h * .004); g.moveTo(s * w * .5, -h * .045); g.lineTo(s * w * 1.05, -h * .085); g.stroke();
        g.fillStyle = '#14171E'; g.fillRect(s * w * 1.7 - w * .17, -h * .003, w * .34, Math.max(1.4, h * .008));
        g.fillStyle = '#2C323E'; g.fillRect(s * w * .5 - (s > 0 ? 0 : w * .1), -h * .22, w * .1, h * .035);
      }
    } else {
      for(const s of [-1, 1]){ g.fillStyle = '#12151B'; g.fillRect(s > 0 ? w * .5 - 1 : -w * .5 - w * .07 + 1, -h * .27, w * .07, h * .26); g.fillStyle = '#2C323E'; g.fillRect(s > 0 ? w * .5 - 1 : -w * .5 - w * .07 + 1, -h * .27, w * .07, h * .012); }
    }
  }
  function falcon9(g, w, h, o){
    const hb = h * .045;
    cyl(g, -w / 2, -h * .93, w, h * .885, BLANC, w * .04);                                   // le réservoir blanc
    anneaux(g, -w / 2, -h * .93, w, h * .885, clamp(Math.round(h / 22), 4, 12), 1, .6);
    g.fillStyle = 'rgba(30,36,50,.18)'; g.fillRect(w * .22, -h * .9, Math.max(1, w * .05), h * .82);   // le chemin de câbles
    g.fillStyle = 'rgba(20,24,34,.55)'; for(let i = 0; i < 8; i++) g.fillRect(-w * .1, -h * (.78 - i * .03), w * .2, Math.max(.7, h * .012));   // le nom, en lettres verticales
    suie(g, -w / 2, -h * .35, w, h * .32, .5);
    cyl(g, -w / 2, -h, w, h * .08, NOIR, w * .03);                                           // l'interstage noir
    g.fillStyle = 'rgba(170,180,195,.25)'; for(let i = 1; i < 4; i++) g.fillRect(-w / 2, -h * (1 - i * .02), w, Math.max(.5, h * .002));
    cyl(g, -w / 2 * 1.02, -hb, w * 1.02, hb, NOIR);                                           // l'octoweb
    if(h > 40){ for(const x of [-.3, 0, .3]) cloche(g, x * w, w * .3, h * .04, true); }
    else g.fillStyle = '#1B1F27';
    const gw = w * .5, gh = h * .035; grille(g, -w / 2 - gw * .92, -h * .955, gw, gh); grille(g, w / 2 - gw * .08, -h * .955, gw, gh);
    jambesF9(g, w, h, o);
  }
  function falcon2(g, w, h, o){                                  // second étage + coiffe (plus large que l'étage)
    const wf = w * 1.34, hs = h * .38, hc = h * .62, nez = h * .3;
    cyl(g, -w / 2, -hs, w, hs, BLANC); anneaux(g, -w / 2, -hs, w, hs, 3, 4, .5);
    g.fillStyle = 'rgba(25,30,42,.5)'; g.fillRect(-w / 2, -hs * .98, w, Math.max(.6, h * .008));
    g.fillStyle = gr(g, -wf / 2, wf, BLANC);
    g.beginPath(); g.moveTo(-w / 2, -hs); g.lineTo(-wf / 2, -hs - h * .05); g.lineTo(-wf / 2, -h + nez); g.bezierCurveTo(-wf / 2, -h + nez * .35, -wf * .18, -h, 0, -h); g.bezierCurveTo(wf * .18, -h, wf / 2, -h + nez * .35, wf / 2, -h + nez); g.lineTo(wf / 2, -hs - h * .05); g.lineTo(w / 2, -hs); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,50,70,.35)'; g.lineWidth = Math.max(.6, h * .004); g.beginPath(); g.moveTo(0, -h); g.lineTo(0, -hs - h * .05); g.stroke();   // la jonction des deux demi-coiffes
    g.fillStyle = 'rgba(20,24,34,.35)'; g.fillRect(-wf / 2, -hs - h * .06, wf, Math.max(.7, h * .007));
    cloche(g, 0, w * .62, h * .11, false); g.fillStyle = '#12151B'; g.fillRect(-w * .3, -h * .01, w * .6, h * .012);
    if(o.jambes === 'x') jambesF9(g, w, h, o);
  }
  /* ---------- Super Heavy ---------- */
  function superheavy(g, w, h, o){
    cyl(g, -w / 2, -h * .93, w, h * .9, ACIER, w * .03);
    anneaux(g, -w / 2, -h * .93, w, h * .9, clamp(Math.round(h / 8), 8, 26), 2, 1);
    g.fillStyle = 'rgba(30,40,60,.2)'; g.fillRect(-w * .36, -h * .9, Math.max(1, w * .03), h * .85); g.fillRect(w * .3, -h * .9, Math.max(1, w * .04), h * .85);   // les chemins de câbles
    suie(g, -w / 2, -h * .3, w, h * .27, .38);
    cyl(g, -w / 2, -h, w, h * .075, NOIR);                                                    // l'anneau de séparation à fentes
    g.fillStyle = 'rgba(210,220,235,.35)'; const nf = Math.max(6, Math.round(w / 2.4)); for(let i = 0; i < nf; i++) g.fillRect(-w / 2 + w * (i + .35) / nf, -h * .995, Math.max(.6, w * .028), h * .055);
    cyl(g, -w * .53, -h * .045, w * 1.06, h * .045, GRIS);                                    // la jupe des moteurs
    if(h > 50){ for(let i = 0; i < 5; i++) cloche(g, (-.4 + i * .2) * w, w * .2, h * .038, true); }
    const gw = w * .72, gh = h * .045; grille(g, -w / 2 - gw * .85, -h * .9, gw, gh); grille(g, w / 2 - gw * .15, -h * .9, gw, gh);
    g.fillStyle = '#FF9A3C'; for(const s of [-1, 1]) g.fillRect(s > 0 ? w / 2 : -w / 2 - w * .1, -h * .78, w * .1, Math.max(1.2, h * .012));  // les ergots pour les bras de la tour
    if(o.jambes) { trait(g, '#8E99A8', Math.max(1.4, h * .014)); for(const s of [-1, 1]){ g.beginPath(); g.moveTo(s * w * .5, -h * .08); g.lineTo(s * w * 1.1, h * .004); g.stroke(); } }
  }
  /* ---------- Starship ---------- */
  function jambesSS(g, w, h){
    trait(g, '#9AA5B5', Math.max(1.6, h * .016));
    for(const s of [-1, 1]){
      g.beginPath(); g.moveTo(s * w * .38, -h * .2); g.lineTo(s * w * 1.25, h * .004); g.stroke();
      g.strokeStyle = '#59636F'; g.lineWidth = Math.max(1, h * .008); g.beginPath(); g.moveTo(s * w * .42, -h * .035); g.lineTo(s * w * .9, -h * .06); g.stroke(); trait(g, '#9AA5B5', Math.max(1.6, h * .016));
      g.fillStyle = '#5B6574'; g.fillRect(s * w * 1.25 - w * .14, -h * .002, w * .28, Math.max(1.4, h * .008));
    }
  }
  function formeSS(g, w, h){
    const n = h * .26; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -h + n); g.bezierCurveTo(-w / 2, -h + n * .4, -w * .2, -h * .995, 0, -h); g.bezierCurveTo(w * .2, -h * .995, w / 2, -h + n * .4, w / 2, -h + n); g.lineTo(w / 2, 0); g.closePath();
  }
  function starship(g, w, h, o){
    const n = h * .26;
    // les volets arrière (grands) et avant (petits), derrière le corps
    g.fillStyle = gr(g, 0, w * 1.5, GRIS);
    for(const s of [-1, 1]){
      g.beginPath(); g.moveTo(s * w / 2, -h * .27); g.lineTo(s * w * 1.45, -h * .06); g.lineTo(s * w * 1.45, h * .008); g.lineTo(s * w / 2, -h * .005); g.closePath(); g.fill();
      g.fillStyle = '#1A1E26'; g.fillRect(s > 0 ? w / 2 : -w / 2 - w * .06, -h * .22, w * .06, h * .05); g.fillStyle = gr(g, 0, w * 1.5, GRIS);
      g.beginPath(); g.moveTo(s * w / 2, -h + n * 1.0); g.lineTo(s * w * 1.0, -h + n * 1.32); g.lineTo(s * w * 1.0, -h + n * 1.78); g.lineTo(s * w / 2, -h + n * 1.62); g.closePath(); g.fill();        // les petits volets avant : balayés vers le bas, comme les grands
    }
    g.fillStyle = gr(g, -w / 2, w, ACIER); formeSS(g, w, h); g.fill();
    g.save(); formeSS(g, w, h); g.clip();
    anneaux(g, -w / 2, -h, w, h, clamp(Math.round(h / 8), 8, 30), 3, 1);
    g.fillStyle = 'rgba(30,40,60,.18)'; g.fillRect(-w * .3, -h * .8, Math.max(1, w * .03), h * .78);
    // le bouclier : des tuiles noires sur le côté du ventre (à droite)
    const t = g.createLinearGradient(w * .0, 0, w / 2, 0); t.addColorStop(0, 'rgba(12,15,22,0)'); t.addColorStop(.3, 'rgba(12,15,22,.88)'); t.addColorStop(1, 'rgba(5,6,10,.98)'); g.fillStyle = t; g.fillRect(0, -h, w / 2, h);
    if(h > 60){ g.strokeStyle = 'rgba(160,170,190,.2)'; g.lineWidth = .6; g.beginPath(); const e = Math.max(3, h * .018); for(let y = -h; y < 0; y += e){ g.moveTo(w * .16, y); g.lineTo(w / 2, y); }
      for(let x = w * .18; x < w / 2; x += w * .075){ g.moveTo(x, -h * .96); g.lineTo(x, 0); } g.stroke();
      g.fillStyle = 'rgba(190,198,210,.5)'; for(let i = 0; i < 9; i++) g.fillRect(w * (.16 + alea(i, 6) * .3), -h * (.1 + alea(i, 7) * .8), Math.max(1.3, w * .045), Math.max(1.3, h * .012)); }
    g.restore();
    if(h > 45){ for(const x of [-.28, 0, .28]) cloche(g, x * w, w * (x === 0 ? .36 : .24), h * .04, x !== 0); }
    cyl(g, -w * .52, -h * .028, w * 1.04, h * .028, GRIS);
    if(o.jambes) jambesSS(g, w, h);
  }
  /* ---------- Dragon ---------- */
  function capsule(g, w, h, o){
    g.save(); g.translate(0, o.y0 || 0);
    const bas = w * .46, haut = w * .17;
    g.fillStyle = gr(g, -bas, bas * 2, BLANC); g.beginPath(); g.moveTo(-bas, 0); g.bezierCurveTo(-bas * .98, -h * .3, -haut * 1.15, -h * .7, -haut, -h * .86); g.lineTo(-haut * .8, -h * .96); g.quadraticCurveTo(0, -h * 1.1, haut * .8, -h * .96); g.lineTo(haut, -h * .86); g.bezierCurveTo(haut * 1.15, -h * .7, bas * .98, -h * .3, bas, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(30,35,48,.82)'; g.beginPath(); g.moveTo(-haut * .85, -h * .9); g.quadraticCurveTo(0, -h * 1.12, haut * .85, -h * .9); g.lineTo(haut * .7, -h * .84); g.lineTo(-haut * .7, -h * .84); g.closePath(); g.fill();   // le cône d'accostage
    if(o.suie) suie(g, -bas, -h * .5, bas * 2, h * .5, o.suie);
    g.fillStyle = '#161A22'; for(const x of [-.17, 0, .17]){ rondRect(g, w * x - w * .04, -h * .56, w * .08, h * .13, w * .02); g.fill(); }  // les hublots
    g.fillStyle = 'rgba(40,46,60,.85)'; for(const s of [-1, 1]) g.fillRect(s * w * .3 - w * .05, -h * .28, w * .1, h * .1);    // les moteurs Draco et SuperDraco
    g.strokeStyle = 'rgba(40,50,70,.3)'; g.lineWidth = Math.max(.5, h * .008); g.beginPath(); g.moveTo(-bas * .97, -h * .08); g.lineTo(bas * .97, -h * .08); g.stroke();
    g.fillStyle = gr(g, -w * .5, w, [[0, '#1A110D'], [.4, '#5B4030'], [1, '#1A110D']]); g.beginPath(); g.moveTo(-w * .5, h * .05); g.quadraticCurveTo(0, h * .14, w * .5, h * .05); g.lineTo(w * .46, -h * .05); g.lineTo(-w * .46, -h * .05); g.closePath(); g.fill();  // le bouclier brun
    g.restore();
  }
  function dragon(g, w, h, o){                                   // la capsule sur son coffre
    const hc = h * .58, ht = h * .42;
    cyl(g, -w * .46, -ht, w * .92, ht, BLANC, w * .02);
    g.fillStyle = '#12151B'; g.fillRect(-w * .46, -ht * .55, w * .92, ht * .5);                  // le radiateur noir
    g.strokeStyle = 'rgba(190,200,215,.3)'; g.lineWidth = Math.max(.5, h * .006); g.beginPath(); for(let i = 1; i < 12; i++){ g.moveTo(-w * .46 + w * .92 * i / 12, -ht * .55); g.lineTo(-w * .46 + w * .92 * i / 12, -ht * .05); } g.stroke();
    for(const s of [-1, 1]){ g.fillStyle = '#16263F'; g.fillRect(s > 0 ? w * .46 : -w * .46 - w * .1, -ht * .95, w * .1, ht * .85); g.strokeStyle = 'rgba(100,140,200,.5)'; g.beginPath(); for(let i = 1; i < 6; i++){ g.moveTo(s > 0 ? w * .46 : -w * .56, -ht * (.95 - i * .14)); g.lineTo(s > 0 ? w * .56 : -w * .46, -ht * (.95 - i * .14)); } g.stroke(); }  // les panneaux solaires repliés
    capsule(g, w, hc, { ...o, y0:-ht, chutes:0 });
  }
  function dragonSeul(g, w, h, o){
    capsule(g, w, h, { suie:o.chaleur > .3 ? .5 : .12 });
    if(o.chaleur > .05){ const c = clamp(o.chaleur, 0, 1), r = g.createRadialGradient(0, h * .05, 2, 0, h * .12, w * (.7 + c * .6)); r.addColorStop(0, `rgba(255,${Math.round(230 - 130 * c)},${Math.round(180 - 140 * c)},${.8 * c + .1})`); r.addColorStop(.5, `rgba(255,120,40,${.5 * c})`); r.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(0, h * .18, w * (.9 + c * .5), h * (.5 + c * .8), 0, 0, 7); g.fill(); }
    if(o.chutes > 0){
      const k = clamp(o.chutes, 0, 1), R = h * (.5 + 1.5 * k), top = -h * (1.7 + 2.3 * k);
      g.strokeStyle = 'rgba(30,30,40,.6)'; g.lineWidth = 1; for(const dx of [-.55, -.2, .2, .55]){ g.beginPath(); g.moveTo(0, -h * .94); g.lineTo(dx * R * 1.6, top + R * .1); g.stroke(); }
      for(const dx of [-R * .66, R * .66]){
        const cx = dx, ry = R * .62 * (.5 + .5 * k), rx = R * .72;
        for(let i = 0; i < 6; i++){ g.fillStyle = i % 2 ? '#F4F4F4' : '#FF7A2B'; g.beginPath(); g.moveTo(cx, top); g.ellipse(cx, top, rx, ry, 0, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); g.closePath(); g.fill(); }
        g.strokeStyle = 'rgba(50,30,20,.45)'; g.lineWidth = .8; g.beginPath(); g.ellipse(cx, top, rx, ry, 0, Math.PI, 0); g.stroke();
      }
    }
  }
  /* ---------- Starhopper ---------- */
  function hop(g, w, h, o){
    trait(g, '#7C8798', Math.max(2, h * .05));
    for(const s of [-1, 0, 1]){ g.beginPath(); g.moveTo(s * w * .32, -h * .2); g.lineTo(s * w * .74, 0); g.stroke(); }
    g.lineWidth = Math.max(1, h * .02); g.strokeStyle = '#586272'; g.beginPath(); g.moveTo(-w * .5, -h * .08); g.lineTo(w * .5, -h * .08); g.moveTo(-w * .4, -h * .17); g.lineTo(w * .12, -h * .02); g.stroke();
    cyl(g, -w / 2, -h * .9, w, h * .74, ACIER, w * .05);
    g.beginPath(); g.moveTo(-w / 2, -h * .88); g.quadraticCurveTo(-w * .3, -h * 1.12, 0, -h * 1.12); g.quadraticCurveTo(w * .3, -h * 1.12, w / 2, -h * .88); g.closePath(); g.fillStyle = gr(g, -w / 2, w, ACIER); g.fill();
    anneaux(g, -w / 2, -h * .9, w, h * .74, 5, 7, 1.4);
    g.fillStyle = 'rgba(160,90,40,.14)'; g.fillRect(-w * .5, -h * .35, w, h * .19);
    cloche(g, 0, w * .26, h * .12, true);
  }
  /* ---------- La flamme ---------- */
  function flamme(g, kind, w, h, f){
    const gros = kind === 'superheavy' || kind === 'shPile', merlin = kind === 'falcon9' || kind === 'falcon2' || kind === 'falconPile' || kind === 'dragon';
    const wm = gros ? w * 1.1 : w, L = h * (.22 + .5 * f) * (.9 + Math.random() * .2) * (kind === 'hop' ? 1.5 : 1), ww = wm * (.5 + .45 * f);
    const c1 = merlin ? '255,246,210' : '215,232,255', c2 = merlin ? '255,176,70' : '255,200,120', c3 = merlin ? '255,98,24' : '255,110,50';
    const d = g.createLinearGradient(0, 0, 0, L); d.addColorStop(0, `rgba(${c1},.96)`); d.addColorStop(.22, `rgba(${c2},.9)`); d.addColorStop(.65, `rgba(${c3},.5)`); d.addColorStop(1, `rgba(${c3},0)`);
    g.fillStyle = d; g.beginPath(); g.moveTo(-ww / 2, -2); g.quadraticCurveTo(-ww * .55, L * .5, 0, L); g.quadraticCurveTo(ww * .55, L * .5, ww / 2, -2); g.closePath(); g.fill();
    g.fillStyle = `rgba(${c1},.55)`; g.beginPath(); g.moveTo(-ww * .22, 0); g.quadraticCurveTo(-ww * .25, L * .3, 0, L * .55); g.quadraticCurveTo(ww * .25, L * .3, ww * .22, 0); g.closePath(); g.fill();      // le cœur
    for(let i = 1; i <= 4; i++){ const y = L * .13 * i, r = ww * (.17 - i * .025) * (1 - i * .08); g.fillStyle = `rgba(255,255,255,${.5 - i * .1})`; g.beginPath(); g.ellipse(0, y, Math.max(.6, r), Math.max(1, L * .035), 0, 0, 7); g.fill(); }  // les diamants de choc
    const r = g.createRadialGradient(0, 4, 2, 0, 4, wm * 1.8); r.addColorStop(0, `rgba(${c2},.5)`); r.addColorStop(1, `rgba(${c3},0)`); g.fillStyle = r; g.fillRect(-wm * 1.8, -wm, wm * 3.6, wm * 3.2);
  }
  function vehicule(g, kind, bx, by, h, th, o = {}){
    g.save(); g.translate(bx, by); g.rotate(th * Math.PI / 180);
    const w = h * (LARGEUR[kind] || .19);
    if((o.gaz || 0) > .02 && kind !== 'dragonSeul') flamme(g, kind, w, h, o.gaz);
    if(kind === 'hop') hop(g, w, h, o);
    else if(kind === 'falconPile'){ falcon9(g, w, h * .68, o); g.save(); g.translate(0, -h * .68); falcon2(g, w, h * .32, {}); g.restore(); }
    else if(kind === 'shPile'){ superheavy(g, w, h * .575, o); g.save(); g.translate(0, -h * .575); starship(g, w, h * .425, {}); g.restore(); }
    else if(kind === 'falcon9') falcon9(g, w, h, o);
    else if(kind === 'falcon2') falcon2(g, w, h, o);
    else if(kind === 'superheavy') superheavy(g, w, h, o);
    else if(kind === 'dragon') dragon(g, w, h, o);
    else if(kind === 'dragonSeul') dragonSeul(g, w, h, o);
    else starship(g, w, h, o);
    if(o.chaleur > .05 && kind !== 'dragonSeul'){            // la rentrée : le plasma sur le ventre (à droite) et sa traînée
      const c = clamp(o.chaleur, 0, 1), r = g.createLinearGradient(w * .3, 0, w * 1.6 + h * .12 * c, 0); r.addColorStop(0, `rgba(255,${Math.round(230 - 120 * c)},${Math.round(150 - 100 * c)},${.6 * c + .15})`); r.addColorStop(.5, `rgba(255,110,60,${.4 * c})`); r.addColorStop(1, 'rgba(255,50,120,0)');
      g.fillStyle = r; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, -h); g.lineTo(w * 1.7 + h * .12 * c, -h * .72); g.lineTo(w * 1.9 + h * .12 * c, -h * .4); g.lineTo(w * 1.7 + h * .12 * c, -h * .08); g.closePath(); g.fill();
      g.strokeStyle = `rgba(255,220,160,${.5 * c})`; g.lineWidth = 1; g.beginPath(); for(let i = 0; i < 7; i++){ const y = -h * (.1 + alea(i, 3) * .8); g.moveTo(w / 2 + 2, y); g.lineTo(w * (1.1 + alea(i, 4)) + h * .1 * c, y + h * .05); } g.stroke();
    }
    g.restore();
  }
  /* ---------- La tour de lancement ---------- */
  function tour(g, x, sol, s, bras, fermes, t = 0){
    const larg = 7 * s, haut = 150 * s, yb = bras ? sol - (bras.y + (bras.pin || 0)) * s : null, ep = Math.max(1, s * .6);
    // la fondation de béton
    g.fillStyle = '#6E7480'; g.fillRect(x - larg * 1.3, sol - 2 * s, larg * 2.6, 2 * s + 2);
    // les deux montants et le treillis (diagonales, entretoises, plateformes)
    const m = g.createLinearGradient(x - larg / 2, 0, x + larg / 2, 0); m.addColorStop(0, '#39414D'); m.addColorStop(.5, '#7A8697'); m.addColorStop(1, '#424B58');
    g.fillStyle = m; g.fillRect(x - larg / 2, sol - haut, larg * .22, haut); g.fillRect(x + larg / 2 - larg * .22, sol - haut, larg * .22, haut);
    g.strokeStyle = '#98A3B3'; g.lineWidth = ep * .7; g.beginPath(); const pas = 8 * s;
    for(let y = sol, i = 0; y > sol - haut; y -= pas, i++){ g.moveTo(x - larg / 2, y); g.lineTo(x + larg / 2, y - pas); g.moveTo(x + larg / 2, y); g.lineTo(x - larg / 2, y - pas); if(i % 2 === 0){ g.moveTo(x - larg / 2, y - pas); g.lineTo(x + larg / 2, y - pas); } } g.stroke();
    g.fillStyle = '#4C5562'; for(let y = sol - 24 * s; y > sol - haut; y -= 24 * s){ g.fillRect(x - larg * .75, y, larg * 1.5, Math.max(1.5, s * .9)); }   // les plateformes
    g.fillStyle = '#C8D0DC'; g.fillRect(x + larg / 2 + s * .5, sol - haut * .9, Math.max(1, s * .8), haut * .88); // l'échelle et l'ascenseur
    g.fillStyle = '#8A93A1'; g.fillRect(x + larg / 2 + s * 1.2, sol - haut * (.25 + .0 * t), larg * .5, 7 * s);
    g.strokeStyle = '#C9D1DD'; g.lineWidth = Math.max(1, s * .5); g.beginPath(); g.moveTo(x, sol - haut); g.lineTo(x, sol - haut - 10 * s); g.stroke();      // le paratonnerre
    g.fillStyle = Math.sin(t * 4) > 0 ? '#FF4A3A' : '#7A2A24'; g.beginPath(); g.arc(x, sol - haut - 10 * s, Math.max(2, s * 1.1), 0, 7); g.fill();
    if(bras){                                                    // les bras (« baguettes ») : ils se referment sur les ergots du propulseur, à la hauteur des ergots
      const f = fermes ? +fermes : 0, ouv = (1 - f) * bras.tol * s, e = 3.2 * s, y0 = yb - e / 2, vx = x - 22 * s, demi = (bras.demi || 4) * s, xp = vx + demi + ouv, xa = x - larg / 2;
      g.fillStyle = '#E8892F'; g.fillRect(xp, y0, xa - xp, e); g.fillStyle = '#B86520'; g.fillRect(xp, y0 + e * .72, xa - xp, e * .28);
      g.strokeStyle = 'rgba(80,40,10,.6)'; g.lineWidth = Math.max(.6, s * .3); g.beginPath(); for(let q = xp; q < xa - 5 * s; q += 6 * s){ g.moveTo(q, y0); g.lineTo(q + 6 * s, y0 + e); } g.stroke();
      g.fillStyle = '#FFB86B'; g.fillRect(xp - 3 * s, y0 - 1.6 * s, 3.4 * s, e + 3.2 * s); g.fillStyle = '#2A2F38'; g.fillRect(xp - 3 * s, y0 - 1.6 * s, 3.4 * s, Math.max(1, s * .45)); g.fillRect(xp - 3 * s, y0 + e + 1.6 * s - Math.max(1, s * .45), 3.4 * s, Math.max(1, s * .45));
      g.fillStyle = '#C9CED8'; g.fillRect(xa - 2 * s, y0 - 2 * s, 2 * s, e + 4 * s);                  // l'attache sur la tour
    }
  }
  /* ---------- Les plateformes ---------- */
  function table(g, px, pw, solY, s, avecTable){                 // la zone de lancement : dalle, table de lancement, éclairage
    g.fillStyle = '#5A606B'; g.fillRect(px - pw * 1.3, solY - 1.2 * s, pw * 2.6, 1.2 * s + 3);
    g.fillStyle = '#7A808C'; g.fillRect(px - pw * 1.3, solY - 1.2 * s, pw * 2.6, Math.max(1, s * .3));
    if(avecTable){ g.fillStyle = '#3A404B'; g.fillRect(px - pw * .8, solY - 5 * s, pw * 1.6, 3.8 * s); g.fillStyle = '#242830'; for(let i = 0; i < 6; i++) g.fillRect(px - pw * .76 + i * pw * .3, solY - 1.2 * s, Math.max(1.5, s * 1.2), -3.8 * s);
      g.fillStyle = '#FF9A3C'; g.fillRect(px - pw * .8, solY - 5 * s, pw * 1.6, Math.max(1, s * .4)); }
    g.fillStyle = '#FFD23A'; g.fillRect(px - pw, solY - 1.2 * s, pw * 2, Math.max(1, s * .35));
  }
  function barge(g, px, pw, solY, s, t){                         // le navire-drone en mer
    const x0 = px - pw * 1.2, x1 = px + pw * 1.2, ph = 2.6 * s, tx = Math.sin(t * .9) * s * .2;
    g.fillStyle = '#14171D'; g.beginPath(); g.moveTo(x0 - 2 * s, solY - ph * .3); g.lineTo(x1 + 2 * s, solY - ph * .3); g.lineTo(x1 - 1.5 * s, solY + 4 * s); g.lineTo(x0 + 1.5 * s, solY + 4 * s); g.closePath(); g.fill();
    g.fillStyle = '#8E2A22'; g.fillRect(x0, solY - ph * .1, x1 - x0, Math.max(2, s * .5));                    // la ligne rouge de la coque
    g.fillStyle = '#2D333D'; g.fillRect(x0 - s, solY - ph, x1 - x0 + 2 * s, ph * .8);                          // le pont
    g.fillStyle = '#3D4552'; g.fillRect(px - pw, solY - ph - 1, pw * 2, Math.max(2, s * .5));
    g.strokeStyle = '#EEF1F5'; g.lineWidth = Math.max(1, s * .4); g.beginPath(); g.moveTo(px - pw * .6, solY - ph + s * .4); g.lineTo(px + pw * .6, solY - ph + s * .4); g.moveTo(px - pw * .45, solY - ph * .3); g.lineTo(px + pw * .45, solY - ph * .3); g.stroke();   // le X d'atterrissage
    g.beginPath(); g.moveTo(px - pw * .5, solY - ph * .3); g.lineTo(px + pw * .5, solY - ph + s * .4); g.moveTo(px + pw * .5, solY - ph * .3); g.lineTo(px - pw * .5, solY - ph + s * .4); g.stroke();
    g.fillStyle = '#C9CED8'; g.fillRect(x1 - 5 * s, solY - ph - 4 * s, 4.5 * s, 4 * s); g.fillStyle = '#9AA1AE'; g.fillRect(x1 - 5 * s, solY - ph - 4 * s, 4.5 * s, Math.max(1, s * .5));       // le poste de commande
    g.fillStyle = '#1B1F27'; for(const x of [x0 + 2 * s, x1 - 8 * s]) g.fillRect(x, solY - ph - 1.5 * s, 2.5 * s, 1.5 * s);    // les propulseurs de positionnement
  }
  function bateau(g, px, bw, solY, s, t){                         // le navire de récupération de la capsule
    g.fillStyle = '#EEF1F5'; g.beginPath(); g.moveTo(px - bw, solY - 3); g.lineTo(px + bw, solY - 3); g.lineTo(px + bw * .8, solY + 9); g.lineTo(px - bw * .8, solY + 9); g.closePath(); g.fill();
    g.fillStyle = '#C0262B'; g.fillRect(px - bw * .98, solY - 3, bw * 1.96, Math.max(2, s * .7));
    g.fillStyle = '#DDE2EA'; g.fillRect(px + bw * .1, solY - 4 * s - 8, bw * .5, 4 * s + 6); g.fillStyle = '#2B3340'; for(let i = 0; i < 4; i++) g.fillRect(px + bw * .14 + i * bw * .11, solY - 3 * s - 8, bw * .06, Math.max(2, s * .8));
    g.strokeStyle = '#C0262B'; g.lineWidth = Math.max(1.5, s * .5); g.beginPath(); g.moveTo(px - bw * .7, solY - 3); g.lineTo(px - bw * .55, solY - 7 * s - 8); g.lineTo(px - bw * .25, solY - 3); g.stroke();   // la grue
    g.strokeStyle = 'rgba(40,40,50,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px - bw * .55, solY - 7 * s - 8); g.lineTo(px - bw * .55, solY - 3 * s - 8); g.stroke();
  }
  /* ---------- Les paysages (derrière le sol et sur le sol) ---------- */
  function crete(g, W, solY, base, amp, f, ph, couleur, camX){       // une ligne de collines lointaines
    g.fillStyle = couleur; g.beginPath(); g.moveTo(0, solY + 1);
    for(let x = 0; x <= W; x += 8){ const u = x + camX * f + ph; g.lineTo(x, solY - base - amp * (Math.sin(u * .011) * .5 + Math.sin(u * .027 + 1.7) * .3 + Math.sin(u * .063 + 4) * .2 + .5)); }
    g.lineTo(W, solY + 1); g.closePath(); g.fill();
  }
  function sol(g, decor, solY, s, W, H, X, camX, t){
    const k = clamp(s * .45, .22, 1.5);
    // l'horizon : des collines (ou la mer) dans la brume
    if(decor === 'lune'){ crete(g, W, solY, 4, 70 * k, .05 * s, 0, '#5C5C66', camX); crete(g, W, solY, 2, 36 * k, .12 * s, 90, '#737380', camX); }
    else if(decor === 'mars'){ crete(g, W, solY, 4, 80 * k, .05 * s, 20, '#8B4A32', camX); crete(g, W, solY, 2, 40 * k, .12 * s, 60, '#A35A38', camX); }
    else if(decor === 'mer'){ const h0 = g.createLinearGradient(0, solY - 8, 0, solY + 6); h0.addColorStop(0, 'rgba(210,235,255,.6)'); h0.addColorStop(1, 'rgba(210,235,255,0)'); g.fillStyle = h0; g.fillRect(0, solY - 8, W, 14); }
    else {
      g.fillStyle = '#3F78B5'; g.fillRect(0, solY - 6 * k - 4, W, 6 * k + 5);                                 // la mer au loin
      crete(g, W, solY, 0, 34 * k, .06 * s, 0, '#8E9F8A', camX); crete(g, W, solY, 0, 18 * k, .14 * s, 40, '#A89A74', camX);
      for(let i = 0; i < 6; i++){ const bx = ((i * 331 - camX * .1 * s) % (W + 300) + W + 300) % (W + 300) - 150, bh = (16 + alea(i, 1) * 24) * k;      // des réservoirs et des bâtiments
        if(i % 3 === 0){ g.fillStyle = '#E6E9EE'; g.fillRect(bx, solY - bh - 6 * k, 14 * k, bh); g.fillStyle = '#B8BEC9'; g.fillRect(bx + 10 * k, solY - bh - 6 * k, 4 * k, bh); }
        else { g.fillStyle = '#C9CED6'; g.beginPath(); g.arc(bx, solY - 6 * k, 9 * k, Math.PI, 0); g.fill(); g.fillStyle = '#9BA2AE'; g.fillRect(bx - 9 * k, solY - 6 * k, 18 * k, 5 * k); } }
    }
    // le sol
    const d = g.createLinearGradient(0, solY, 0, H);
    if(decor === 'mer'){ d.addColorStop(0, '#3C8FD6'); d.addColorStop(.35, '#1F66AD'); d.addColorStop(1, '#0A2A52'); }
    else if(decor === 'lune'){ d.addColorStop(0, '#B4B4BA'); d.addColorStop(1, '#484850'); }
    else if(decor === 'mars'){ d.addColorStop(0, '#D27544'); d.addColorStop(1, '#6E3320'); }
    else { d.addColorStop(0, '#C4AF86'); d.addColorStop(.3, '#A18B64'); d.addColorStop(1, '#5E4D36'); }
    g.fillStyle = d; g.fillRect(0, solY, W, H - solY);
    g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, solY, W, 3);
    if(decor === 'mer'){
      for(let j = 0; j < 7; j++){ const y = solY + 6 + j * 14 * Math.max(.6, s * .5); g.strokeStyle = `rgba(255,255,255,${.34 - j * .03})`; g.lineWidth = 1.4; g.beginPath();
        for(let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin((x + camX * s * .5) / (16 + j * 5) + t * 1.4 + j * 1.7) * (1.6 + j * .5)); g.stroke(); }
      const gl = g.createLinearGradient(W * .55, solY, W * .7, solY + 60); gl.addColorStop(0, 'rgba(255,245,210,.5)'); gl.addColorStop(1, 'rgba(255,245,210,0)'); g.fillStyle = gl; g.fillRect(W * .45, solY, W * .3, 60);
    } else if(decor === 'lune' || decor === 'mars'){
      for(let i = -9; i <= 9; i++){ const cx = X(camX + i * 90 - (camX % 90)) + (alea(i, 2) - .5) * 60, r = (18 + alea(i, 3) * 34) * clamp(s * .8, .6, 2.4), cy = solY + 12 + alea(i, 4) * 28;
        g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(cx, cy, r, r * .24, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.ellipse(cx, cy - r * .03, r * .92, r * .19, 0, Math.PI, 0); g.fill();
        g.fillStyle = decor === 'lune' ? 'rgba(70,70,80,.7)' : 'rgba(80,35,20,.7)'; g.beginPath(); g.ellipse(cx + r * 1.2, cy + 6, r * .12 + 2, r * .08 + 1.5, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,.18)'; for(let i = 0; i < 40; i++){ g.fillRect(((i * 97 + (camX * s) % 4000 * -.5) % W + W) % W, solY + 4 + alea(i, 8) * (H - solY), 1.5, 1.5); }
    } else {
      for(let i = -12; i <= 12; i++){ const gx = X(camX + i * 40 - (camX % 40)); g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(gx, solY + 3, 2, H); }
      g.fillStyle = 'rgba(60,80,40,.5)'; for(let i = -16; i <= 16; i++){ const gx = X(camX + i * 34 - (camX % 34)) + alea(i, 5) * 20, gy = solY + 6 + alea(i, 6) * 34; g.fillRect(gx, gy, 3 + alea(i, 7) * 4, 1.6); g.fillRect(gx + 1, gy - 2, 1.2, 2.4); }  // des touffes d'herbe
    }
  }
  function nuage(g, x, y, r, i = 0){                               // un nuage fait de bulles, clair dessus, gris-bleu dessous
    const n = 6;
    for(let pass = 0; pass < 2; pass++) for(let j = 0; j < n; j++){
      const dx = (j - (n - 1) / 2) * r * .55, rr = r * (.42 + alea(i * 7 + j, 1) * .3) * (1 - Math.abs(j - (n - 1) / 2) / n * .5), dy = -alea(i * 7 + j, 2) * r * .22;
      g.fillStyle = pass === 0 ? 'rgba(150,170,200,.5)' : 'rgba(255,255,255,.72)'; g.beginPath(); g.arc(x + dx, y + dy + (pass === 0 ? r * .1 : 0), rr, 0, 7); g.fill();
    }
  }
  function soleil(g, x, y, r){ const d = g.createRadialGradient(x, y, 1, x, y, r * 5); d.addColorStop(0, 'rgba(255,252,230,.95)'); d.addColorStop(.12, 'rgba(255,240,190,.6)'); d.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = d; g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10); g.fillStyle = '#FFFBE8'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  return { nuage, soleil, vehicule, tour, table, barge, bateau, sol, LARGEUR, HAUTEUR_REELLE, rondRect, alea, ACIER, BLANC };
})();
