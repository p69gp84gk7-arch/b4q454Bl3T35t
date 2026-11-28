/* Chalet Crush : tous les dessins, faits au pinceau (aucune image à télécharger) : six gourmandises brillantes, leurs rayures et leurs bombes,
   le super-bonus, la cerise, la neige et la glace. Chaque dessin est fait dans un carré de 100 × 100 puis rangé dans un petit canevas. */
window.CHALET_DESSIN = (() => {
  const TAU = Math.PI * 2;
  const NOMS = ['Fromage', 'Myrtille', 'Fraise', 'Menthe', 'Orange', 'Chocolat'];
  const COUL = [
    { c:'#FFC93C', h:'#FFE98A', b:'#D9901A', ink:'#8A5A08' },     // fromage
    { c:'#6B7FF5', h:'#A9B6FF', b:'#3B49C4', ink:'#232B7A' },     // myrtille
    { c:'#F2455F', h:'#FF9AA8', b:'#B8203A', ink:'#6E0F22' },     // fraise
    { c:'#3FCB82', h:'#9AF0C0', b:'#1D9658', ink:'#0E5E36' },     // menthe
    { c:'#FF9433', h:'#FFC98A', b:'#D4640C', ink:'#7E3A06' },     // orange
    { c:'#A9683C', h:'#D9A070', b:'#6E3E1C', ink:'#3E2010' },     // chocolat
  ];
  const mel = (a, b, t) => { const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const toile = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };

  /* ---------- Les six formes (dans un carré de 100) ---------- */
  const FORMES = [
    // 0 : une part de fromage (un coin arrondi avec des trous)
    g => { g.moveTo(14, 74); g.quadraticCurveTo(8, 74, 12, 66); g.lineTo(44, 18); g.quadraticCurveTo(50, 10, 56, 18); g.lineTo(88, 66); g.quadraticCurveTo(92, 74, 86, 74); g.closePath(); },
    // 1 : une tarte à la myrtille (cercle festonné)
    g => { const n = 10; for(let i = 0; i <= n * 2; i++){ const a = i / (n * 2) * TAU, r = i % 2 ? 36 : 41; const x = 50 + Math.cos(a) * r, y = 50 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); },
    // 2 : une fraise (cœur arrondi, pointe en bas)
    g => { g.moveTo(50, 86); g.bezierCurveTo(14, 62, 8, 36, 24, 26); g.bezierCurveTo(36, 18, 46, 24, 50, 32); g.bezierCurveTo(54, 24, 64, 18, 76, 26); g.bezierCurveTo(92, 36, 86, 62, 50, 86); g.closePath(); },
    // 3 : un bonbon à la menthe (ovale avec des papillotes)
    g => { g.moveTo(8, 34); g.lineTo(26, 46); g.bezierCurveTo(30, 28, 70, 28, 74, 46); g.lineTo(92, 34); g.lineTo(88, 66); g.lineTo(74, 54); g.bezierCurveTo(70, 72, 30, 72, 26, 54); g.lineTo(12, 66); g.closePath(); },
    // 4 : une tranche d'orange (disque)
    g => { g.arc(50, 50, 40, 0, TAU); },
    // 5 : une tablette de chocolat (carré arrondi)
    g => { rr(g, 14, 14, 72, 72, 14); },
  ];
  const brille = (g, c, hauteur = 100) => {          // dégradé, reflet : appliqué dans la forme courante (déjà clippée)
    const d = g.createLinearGradient(0, 8, 0, 92); d.addColorStop(0, c.h); d.addColorStop(.45, c.c); d.addColorStop(1, c.b); g.fillStyle = d; g.fillRect(0, 0, 100, 100);
  };
  function dessinGourmandise(g, k, c){
    // l'ombre au sol
    g.fillStyle = 'rgba(40,20,10,.18)'; g.beginPath(); g.ellipse(50, 90, 30, 5, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); FORMES[k](g); g.clip(); brille(g, c); g.restore();
    // les détails propres à chaque gourmandise
    g.save(); g.beginPath(); FORMES[k](g); g.clip();
    if(k === 0){ g.fillStyle = mel(c.b, '#000000', .1); for(const [x, y, r] of [[40, 52, 7], [60, 60, 5.5], [48, 36, 4.5], [66, 48, 3.5]]){ g.globalAlpha = .75; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = .5; g.fillStyle = c.h; g.beginPath(); g.arc(x - r * .3, y - r * .3, r * .45, 0, TAU); g.fill(); g.fillStyle = mel(c.b, '#000000', .1); } g.globalAlpha = 1; }
    if(k === 1){ g.fillStyle = mel(c.b, '#10163A', .3); g.beginPath(); g.arc(50, 50, 24, 0, TAU); g.fill(); g.fillStyle = c.h; for(const [x, y] of [[42, 44], [56, 42], [50, 54], [60, 56], [40, 56]]){ g.beginPath(); g.arc(x, y, 3.6, 0, TAU); g.fill(); } g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(50, 50, 29, 0, TAU); g.stroke(); }
    if(k === 2){ g.fillStyle = '#FFE9A8'; for(const [x, y] of [[38, 44], [50, 40], [62, 44], [44, 56], [56, 56], [50, 68], [34, 56], [66, 56]]){ g.beginPath(); g.ellipse(x, y, 2.2, 3, 0, 0, TAU); g.fill(); } }
    if(k === 3){ g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 6; for(const dx of [-14, 2, 18]){ g.beginPath(); g.moveTo(34 + dx, 30); g.lineTo(46 + dx, 72); g.stroke(); } }
    if(k === 4){ g.strokeStyle = 'rgba(255,245,220,.8)'; g.lineWidth = 3; for(let i = 0; i < 8; i++){ const a = i / 8 * TAU; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 + Math.cos(a) * 36, 50 + Math.sin(a) * 36); g.stroke(); } g.lineWidth = 6; g.beginPath(); g.arc(50, 50, 38, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(50, 50, 33, 0, TAU); g.stroke(); }
    if(k === 5){ g.strokeStyle = mel(c.b, '#000000', .25); g.lineWidth = 3; g.beginPath(); g.moveTo(50, 20); g.lineTo(50, 80); g.moveTo(20, 50); g.lineTo(80, 50); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(52, 20); g.lineTo(52, 48); g.moveTo(20, 52); g.lineTo(48, 52); g.stroke(); }
    g.restore();
    if(k === 2){ g.fillStyle = '#2FBF5A'; g.strokeStyle = '#146A30'; g.lineWidth = 2.6; for(const [dx, rot] of [[-12, -.7], [0, 0], [12, .7]]){ g.save(); g.translate(50 + dx, 26); g.rotate(rot); g.beginPath(); g.ellipse(0, -2, 6, 11, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); } }
    // le contour et le reflet
    g.strokeStyle = c.ink; g.lineWidth = 3.4; g.lineJoin = 'round'; g.beginPath(); FORMES[k](g); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.58)'; g.beginPath(); g.ellipse(34, 34, 11, 6, -.7, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(25, 44, 2.4, 0, TAU); g.fill();
  }
  // les rayures d'un bonus rayé : des bandes claires dans la forme, et deux petites flèches
  function rayures(g, k, c, vertical){
    g.save(); g.beginPath(); FORMES[k](g); g.clip();
    g.fillStyle = 'rgba(255,255,255,.62)';
    for(let i = 0; i < 3; i++){ const o = 20 + i * 24; if(vertical) g.fillRect(o, 0, 10, 100); else g.fillRect(0, o, 100, 10); }
    g.restore();
    g.strokeStyle = c.ink; g.lineWidth = 3; g.beginPath(); FORMES[k](g); g.stroke();
  }
  // une bombe : une papillote dorée autour et une étincelle
  function enveloppe(g, c){
    g.strokeStyle = '#FFE066'; g.lineWidth = 7; g.beginPath(); g.arc(50, 50, 45, 0, TAU); g.stroke();
    g.strokeStyle = '#C98A10'; g.lineWidth = 2; g.beginPath(); g.arc(50, 50, 48.6, 0, TAU); g.stroke(); g.beginPath(); g.arc(50, 50, 41.2, 0, TAU); g.stroke();
    for(const sd of [-1, 1]){ g.fillStyle = '#FFE066'; g.strokeStyle = '#C98A10'; g.lineWidth = 2; g.beginPath(); g.moveTo(50 + sd * 44, 50); g.lineTo(50 + sd * 56, 40); g.lineTo(50 + sd * 56, 60); g.closePath(); g.fill(); g.stroke(); }
    étincelle(g, 70, 28, 9);
  }
  function étincelle(g, x, y, r){ g.fillStyle = '#FFFFFF'; g.strokeStyle = 'rgba(255,230,120,.9)'; g.lineWidth = 1.5; g.beginPath(); for(let i = 0; i < 8; i++){ const a = i / 8 * TAU, rad = i % 2 ? r * .35 : r; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill(); g.stroke(); }
  // le super-bonus : un flocon dans une bille arc-en-ciel
  function dessinSuper(g, t = 0){
    g.fillStyle = 'rgba(40,20,10,.18)'; g.beginPath(); g.ellipse(50, 90, 30, 5, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(50, 50, 41, 0, TAU); g.clip();
    if(g.createConicGradient){ const d = g.createConicGradient(t, 50, 50); ['#FF5E7E', '#FFB347', '#FFE45E', '#6EE7A0', '#5EC8FF', '#9B7BFF', '#FF5E7E'].forEach((col, i) => d.addColorStop(i / 6, col)); g.fillStyle = d; } else g.fillStyle = '#B58CFF';
    g.fillRect(0, 0, 100, 100);
    const r = g.createRadialGradient(40, 36, 4, 50, 50, 44); r.addColorStop(0, 'rgba(255,255,255,.75)'); r.addColorStop(.5, 'rgba(255,255,255,.08)'); r.addColorStop(1, 'rgba(20,10,50,.3)'); g.fillStyle = r; g.fillRect(0, 0, 100, 100);
    g.restore();
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 4.5; g.lineCap = 'round'; for(let i = 0; i < 6; i++){ const a = i / 6 * TAU + t * .2; g.beginPath(); g.moveTo(50, 50); g.lineTo(50 + Math.cos(a) * 27, 50 + Math.sin(a) * 27); g.stroke(); for(const s of [-.5, .5]){ const mx = 50 + Math.cos(a) * 18, my = 50 + Math.sin(a) * 18; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(a + s) * 9, my + Math.sin(a + s) * 9); g.stroke(); } }
    g.strokeStyle = '#4A2F8A'; g.lineWidth = 3.4; g.beginPath(); g.arc(50, 50, 41, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(33, 30, 10, 5.5, -.7, 0, TAU); g.fill();
  }
  function dessinCerise(g){
    g.fillStyle = 'rgba(40,20,10,.18)'; g.beginPath(); g.ellipse(50, 90, 30, 5, 0, 0, TAU); g.fill();
    g.strokeStyle = '#2E7A32'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(34, 62); g.quadraticCurveTo(40, 30, 58, 14); g.moveTo(66, 60); g.quadraticCurveTo(62, 30, 58, 14); g.stroke();
    g.fillStyle = '#3FBF4A'; g.strokeStyle = '#1E6A24'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(70, 17, 14, 7, -.35, 0, TAU); g.fill(); g.stroke();
    for(const [x, y] of [[32, 68], [68, 66]]){ const d = g.createRadialGradient(x - 7, y - 8, 2, x, y, 20); d.addColorStop(0, '#FF8A98'); d.addColorStop(.55, '#E8203F'); d.addColorStop(1, '#9E1028'); g.fillStyle = d; g.strokeStyle = '#6E0A1C'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 19, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(x - 7, y - 8, 5, 3, -.7, 0, TAU); g.fill(); }
  }
  // un bloc de neige : pv = nombre de couches restantes (1 à 3)
  function dessinNeige(g, pv){
    g.fillStyle = 'rgba(40,60,100,.2)'; g.beginPath(); g.ellipse(50, 92, 36, 5, 0, 0, TAU); g.fill();
    for(let i = 0; i < pv; i++){ const o = (pv - 1 - i) * 4; g.save(); g.translate(0, -o); const d = g.createLinearGradient(0, 8, 0, 92); d.addColorStop(0, '#FFFFFF'); d.addColorStop(.6, '#E4F1FF'); d.addColorStop(1, '#B6D2F0'); g.fillStyle = d; g.strokeStyle = '#7FA2CC'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(14, 78); g.quadraticCurveTo(6, 56, 16, 44); g.quadraticCurveTo(14, 26, 30, 24); g.quadraticCurveTo(42, 10, 58, 22); g.quadraticCurveTo(78, 16, 84, 38); g.quadraticCurveTo(96, 54, 86, 78); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.ellipse(36, 34 - (pv - 1) * 4, 11, 5.5, -.5, 0, TAU); g.fill();
    if(pv === 1){ g.strokeStyle = 'rgba(80,120,170,.55)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(56, 40); g.lineTo(50, 54); g.lineTo(60, 62); g.lineTo(54, 76); g.stroke(); }
    g.fillStyle = '#7FA2CC'; for(const [x, y] of [[34, 58], [64, 54], [48, 70]]){ g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
  }
  // la glace sous une case : un voile bleuté (n = 1 ou 2 couches)
  function dessinGlace(g, n){
    g.save(); rr(g, 3, 3, 94, 94, 14); g.clip();
    const d = g.createLinearGradient(0, 0, 100, 100); d.addColorStop(0, n > 1 ? 'rgba(150,215,255,.78)' : 'rgba(170,225,255,.5)'); d.addColorStop(.5, n > 1 ? 'rgba(210,240,255,.7)' : 'rgba(210,240,255,.34)'); d.addColorStop(1, n > 1 ? 'rgba(120,190,245,.82)' : 'rgba(150,210,250,.5)'); g.fillStyle = d; g.fillRect(0, 0, 100, 100);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; for(const [a, b, c2, d2] of [[10, 70, 40, 40], [48, 94, 90, 50], [60, 14, 88, 28]]){ g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d2); g.stroke(); }
    g.restore(); g.strokeStyle = n > 1 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.75)'; g.lineWidth = n > 1 ? 5 : 3; rr(g, 3, 3, 94, 94, 14); g.stroke();
    g.strokeStyle = 'rgba(70,140,200,.6)'; g.lineWidth = 1.6; rr(g, 6, 6, 88, 88, 12); g.stroke();
  }
  const dessinFond = (g, clair) => { g.fillStyle = clair ? 'rgba(255,255,255,.34)' : 'rgba(255,255,255,.18)'; rr(g, 3, 3, 94, 94, 14); g.fill(); };

  /* ---------- La réserve de dessins, à la taille de la case ---------- */
  function creerSprites(px){
    const S = {}, fab = (f, grand = 1) => { const c = toile(Math.round(px * grand), Math.round(px * grand)), g = c.getContext('2d'); g.scale(px * grand / 100, px * grand / 100); g.lineJoin = 'round'; g.lineCap = 'round'; f(g); return c; };
    S.piece = []; S.rh = []; S.rv = []; S.bo = [];
    for(let k = 0; k < 6; k++){
      const c = COUL[k];
      S.piece.push(fab(g => dessinGourmandise(g, k, c)));
      S.rh.push(fab(g => { dessinGourmandise(g, k, c); rayures(g, k, c, false); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(34, 34, 11, 6, -.7, 0, TAU); g.fill(); }));
      S.rv.push(fab(g => { dessinGourmandise(g, k, c); rayures(g, k, c, true); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(34, 34, 11, 6, -.7, 0, TAU); g.fill(); }));
      S.bo.push(fab(g => { dessinGourmandise(g, k, c); enveloppe(g, c); }));
    }
    S.su = [0, 1, 2, 3, 4, 5, 6, 7].map(i => fab(g => dessinSuper(g, i / 8 * TAU)));
    S.cerise = fab(dessinCerise);
    S.neige = [null, fab(g => dessinNeige(g, 1)), fab(g => dessinNeige(g, 2)), fab(g => dessinNeige(g, 3))];
    S.glace = [null, fab(g => dessinGlace(g, 1)), fab(g => dessinGlace(g, 2))];
    S.fond = [fab(g => dessinFond(g, false)), fab(g => dessinFond(g, true))];
    return S;
  }
  // de petites icônes pour les objectifs (carré de 100)
  const icone = (kind, k) => { const c = toile(64, 64), g = c.getContext('2d'); g.scale(.64, .64); g.lineJoin = 'round'; g.lineCap = 'round';
    if(kind === 'p') dessinGourmandise(g, k, COUL[k]); else if(kind === 'cerise') dessinCerise(g); else if(kind === 'neige') dessinNeige(g, 1); else if(kind === 'glace'){ g.fillStyle = '#EAF6FF'; rr(g, 6, 6, 88, 88, 16); g.fill(); dessinGlace(g, 1); } else if(kind === 'score'){ g.fillStyle = '#FFD23F'; g.strokeStyle = '#B8860B'; g.lineWidth = 4; g.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 20 : 44; const x = 50 + Math.cos(a) * r, y = 52 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); g.stroke(); }
    return c; };
  return { creerSprites, icone, COUL, NOMS, mel };
})();
