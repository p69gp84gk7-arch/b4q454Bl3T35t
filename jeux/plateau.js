/* DesDés : plateau de 5 dés, lancés en glissant le doigt sur le tapis.
   Utilisation : <script src="plateau.js" data-jeu="yams"></script> (ou data-jeu="10000").
   - Yam's : 3 lancers au plus, on garde les dés de son choix entre deux lancers.
   - 10 000 : lancers sans limite ; les dés mis de côté restent de côté jusqu'à la fin du tour,
     et quand les 5 sont sortis on peut relancer les 5.
   Expose window.plateau = { open, close, reset }. */
(() => {
  const JEU = document.currentScript && document.currentScript.dataset.jeu === 'yams' ? 'yams' : '10000';
  const N = 5, MAX_YAMS = 3;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FRICTION = 2.2, WALL = 0.55, STOP = 30, MIN_TIME = 0.6;

  // Hasard : générateur cryptographique du navigateur
  const rand = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; };
  const face = () => 1 + Math.floor(rand() * 6);

  /* ---------- Styles ---------- */
  const css = `
.pl-fab{ position:fixed; right:16px; bottom:calc(16px + env(safe-area-inset-bottom,0px)); z-index:9;
  display:flex; align-items:center; gap:8px; padding:12px 18px 12px 14px; border:0; border-radius:999px;
  background:#C8372D; color:#fff; font:inherit; font-weight:700; font-size:1rem; cursor:pointer;
  box-shadow:0 8px 20px rgba(0,0,0,.3); }
.pl-fab svg{ width:26px; height:26px; }
.pl-fab:focus-visible, .pl-ov button:focus-visible{ outline:3px solid #E9B949; outline-offset:2px; }
.pl-ov{ position:fixed; inset:0; z-index:60; display:flex; flex-direction:column; gap:10px;
  padding:calc(12px + env(safe-area-inset-top,0px)) 16px calc(14px + env(safe-area-inset-bottom,0px));
  background:#123A2C; color:#F7F3E8; font-family:inherit; }
.pl-ov[hidden]{ display:none; }
.pl-head{ display:flex; justify-content:space-between; align-items:center; gap:12px; }
.pl-title{ font-weight:800; font-size:1.25rem; line-height:1.1; }
.pl-count{ font-size:.9rem; color:rgba(247,243,232,.75); margin-top:2px; font-variant-numeric:tabular-nums; }
.pl-close{ border:1.5px solid rgba(247,243,232,.3); background:transparent; color:#F7F3E8; font:inherit;
  font-weight:600; padding:9px 14px; border-radius:10px; cursor:pointer; }
.pl-tray{ position:relative; flex:1; min-height:220px; border-radius:18px; overflow:hidden; touch-action:none;
  background:#1F5C47; box-shadow:inset 0 0 0 6px #0C261D, inset 0 0 40px rgba(0,0,0,.45);
  background-image:radial-gradient(circle at 50% 30%, rgba(255,255,255,.09), transparent 65%);
  -webkit-user-select:none; user-select:none; cursor:grab; }
.pl-hint{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; margin:0; padding:0 24px 30%; text-align:center; color:rgba(247,243,232,.55); font-weight:600;
  pointer-events:none; transition:opacity .2s; }
.pl-hint svg{ width:40px; height:40px; opacity:.8; }
.pl-tray.busy .pl-hint, .pl-hint.off{ opacity:0; }
.pl-die{ position:absolute; left:0; top:0; width:var(--pl-d,60px); height:var(--pl-d,60px); padding:0; border:0;
  background:none; cursor:pointer; will-change:transform; -webkit-tap-highlight-color:transparent; }
.pl-face{ display:grid; grid-template:repeat(3,1fr)/repeat(3,1fr); width:100%; height:100%; padding:15%;
  border-radius:20%; background:#F7F3E8; border:2px solid #1A1A1A;
  box-shadow:0 6px 10px rgba(0,0,0,.35), inset 0 -4px 0 rgba(0,0,0,.08); }
.pl-face i{ align-self:center; justify-self:center; width:72%; height:72%; border-radius:50%; background:#1A1A1A; visibility:hidden; }
.pl-face i.on{ visibility:visible; }
.pl-face.one i.on{ background:#C8372D; width:95%; height:95%; }
.pl-tray.shaking .pl-die:not(.kept) .pl-face{ animation:pl-shake .12s linear infinite; }
@keyframes pl-shake{ 0%,100%{ transform:translate(0,0) } 25%{ transform:translate(2px,-2px) } 75%{ transform:translate(-2px,2px) } }
.pl-keep{ display:flex; align-items:center; gap:10px; min-height:calc(var(--pl-d,60px) * .8 + 16px);
  padding:8px 10px; border-radius:14px; background:rgba(0,0,0,.22); }
.pl-keep-label{ font-size:.8rem; font-weight:600; color:rgba(247,243,232,.7); writing-mode:vertical-rl; transform:rotate(180deg); }
.pl-slots{ flex:1; display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
.pl-slots .pl-die{ position:relative; transform:none !important; width:calc(var(--pl-d,60px) * .8); height:calc(var(--pl-d,60px) * .8); }
.pl-slots .pl-face{ box-shadow:0 0 0 3px #E9B949; }
.pl-slots .pl-die.locked .pl-face{ box-shadow:none; opacity:.55; }
.pl-slots .pl-die.locked{ cursor:default; }
.pl-empty{ font-size:.85rem; color:rgba(247,243,232,.5); align-self:center; }
.pl-msg{ margin:0; min-height:2.6em; font-size:.95rem; line-height:1.35; color:rgba(247,243,232,.85); }
.pl-actions{ display:grid; grid-template-columns:1fr 1.4fr; gap:8px; }
.pl-actions button{ font:inherit; font-weight:700; font-size:1rem; padding:13px 10px; border-radius:12px; cursor:pointer; }
.pl-new{ border:1.5px solid rgba(247,243,232,.3); background:transparent; color:#F7F3E8; }
.pl-roll{ border:0; background:#E9B949; color:#1A1A1A; }
.pl-roll:disabled{ opacity:.4; cursor:not-allowed; }
body.pl-open{ overflow:hidden; }
`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  document.body.style.paddingBottom = '84px';

  /* ---------- Structure ---------- */
  const DIE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" fill="#F7F3E8"/><g fill="#1A1A1A"><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="8" cy="16" r="1.7"/><circle cx="16" cy="16" r="1.7"/></g></svg>';
  const SWIPE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 19 19 5"/><path d="M11 5h8v8"/></svg>';

  const fab = document.createElement('button');
  fab.className = 'pl-fab';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML = `${DIE_ICON}<span>Dés</span>`;

  const ov = document.createElement('div');
  ov.className = 'pl-ov';
  ov.hidden = true;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'Plateau de dés');
  ov.innerHTML = `
    <div class="pl-head">
      <div><div class="pl-title">Plateau de dés</div><div class="pl-count"></div></div>
      <button class="pl-close">Fermer</button>
    </div>
    <div class="pl-tray"><p class="pl-hint">${SWIPE_ICON}<span>Glissez le doigt sur le tapis pour lancer</span></p></div>
    <div class="pl-keep"><span class="pl-keep-label">${JEU === 'yams' ? 'Gardés' : 'De côté'}</span><div class="pl-slots"></div></div>
    <p class="pl-msg" aria-live="polite"></p>
    <div class="pl-actions"><button class="pl-new">Nouveau tour</button><button class="pl-roll">Lancer</button></div>`;
  document.body.append(fab, ov);

  const q = s => ov.querySelector(s);
  const tray = q('.pl-tray'), slots = q('.pl-slots'), hint = q('.pl-hint');
  const msgEl = q('.pl-msg'), countEl = q('.pl-count'), rollBtn = q('.pl-roll');

  /* ---------- Dés ---------- */
  const PIPS = { 0:[], 1:[4], 2:[2,6], 3:[2,4,6], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };
  const dice = Array.from({ length:N }, (_, i) => {
    const el = document.createElement('button');
    el.className = 'pl-die';
    el.dataset.i = i;
    el.innerHTML = '<span class="pl-face">' + '<i></i>'.repeat(9) + '</span>';
    tray.append(el);
    return { i, el, pips:el.querySelectorAll('i'), faceEl:el.firstChild,
             v:0, target:0, x:0, y:0, vx:0, vy:0, a:0, va:0, s:1, phase:rand() * 6, flip:0,
             kept:false, locked:false };
  });

  function showFace(d, v){
    d.v = v;
    d.pips.forEach((p, k) => p.classList.toggle('on', PIPS[v].includes(k)));
    d.faceEl.classList.toggle('one', v === 1);
    d.el.setAttribute('aria-label', (v ? `Dé : ${v}` : 'Dé pas encore lancé') + (d.kept ? ', gardé' : ''));
  }

  let W = 0, H = 0, D = 60;
  function measure(){
    W = tray.clientWidth; H = tray.clientHeight;
    D = Math.round(Math.max(40, Math.min(76, W / 5.4, H / 3.2)));
    ov.style.setProperty('--pl-d', D + 'px');
    dice.forEach(clamp);
  }
  // Rayon d'encombrement : un dé penché dépasse de sa demi-largeur
  const reach = () => D * 0.62 + 6;
  function clamp(d){
    const r = reach();
    d.x = Math.min(Math.max(d.x, r), Math.max(r, W - r));
    d.y = Math.min(Math.max(d.y, r), Math.max(r, H - r));
  }
  function place(d){
    if(d.kept) return;
    d.el.style.transform = `translate(${d.x - D / 2}px, ${d.y - D / 2}px) rotate(${d.a}deg) scale(${d.s})`;
  }
  // Dés « dans la main » : alignés en bas du tapis
  function lineUp(){
    const free = dice.filter(d => !d.kept);
    free.forEach((d, k) => { d.x = W / 2 + (k - (free.length - 1) / 2) * D * 1.15; d.y = H - D * 0.9; d.a = 0; d.s = 1; place(d); });
  }

  /* ---------- État du tour ---------- */
  let rolls = 0, anim = 0;
  const free = () => dice.filter(d => !d.kept);
  const newlyKept = () => dice.filter(d => d.kept && !d.locked);

  function canThrow(){
    if(anim) return false;
    if(JEU === 'yams') return rolls < MAX_YAMS && free().length > 0;
    // 10 000 : après un lancer, il faut avoir mis au moins un dé de côté (ou avoir sorti les 5)
    return rolls === 0 || newlyKept().length > 0;
  }

  function update(){
    const vals = dice.filter(d => d.v).map(d => d.v);
    const sum = vals.reduce((a, b) => a + b, 0);
    if(JEU === 'yams'){
      countEl.textContent = `Lancer ${rolls} / ${MAX_YAMS}` + (rolls && !anim ? ` · total des dés ${sum}` : '');
    } else {
      countEl.textContent = rolls ? `Lancer n° ${rolls}` : 'Nouveau tour';
    }

    const allOut = JEU === '10000' && rolls > 0 && free().length === 0;
    rollBtn.disabled = !canThrow();
    rollBtn.textContent = anim ? 'Les dés roulent…'
      : JEU === 'yams' && rolls >= MAX_YAMS ? 'Plus de lancer'
      : allOut ? 'Relancer les 5'
      : rolls === 0 ? 'Lancer les 5 dés'
      : `Relancer ${free().length} dé${free().length > 1 ? 's' : ''}`;

    let m;
    if(anim) m = '';
    else if(rolls === 0) m = 'Glissez le doigt sur le tapis pour lancer les 5 dés (ou touchez le bouton).';
    else if(JEU === 'yams'){
      m = rolls >= MAX_YAMS ? '3 lancers faits : notez votre score.'
        : 'Touchez les dés à garder, puis glissez pour relancer les autres.';
    } else {
      m = allOut ? 'Les 5 dés sont sortis : vous pouvez relancer les 5, ou garder vos points.'
        : newlyKept().length ? 'Relancez les dés restants, ou notez vos points.'
        : 'Touchez les dés qui rapportent des points pour les mettre de côté.';
    }
    msgEl.textContent = m;
    hint.classList.toggle('off', !canThrow());
    slots.querySelector('.pl-empty')?.remove();
    if(!dice.some(d => d.kept)) slots.insertAdjacentHTML('beforeend', `<span class="pl-empty">${JEU === 'yams' ? 'Touchez un dé pour le garder' : 'Touchez un dé pour le mettre de côté'}</span>`);
  }

  function toggleKeep(d){
    if(anim || rolls === 0 || !d.v) return;
    if(JEU === 'yams' && rolls >= MAX_YAMS) return;
    if(d.locked) return;
    d.kept = !d.kept;
    d.el.classList.toggle('kept', d.kept);
    if(d.kept){ slots.append(d.el); }
    else { tray.append(d.el); clamp(d); place(d); }
    showFace(d, d.v);
    update();
  }

  /* ---------- Lancer ---------- */
  function throwDice(dirX, dirY, speed){
    if(!canThrow()) return;
    if(JEU === '10000'){
      if(rolls > 0 && free().length === 0){
        // Main pleine : les 5 dés reviennent sur le tapis
        dice.forEach(d => { d.kept = d.locked = false; d.el.classList.remove('kept', 'locked'); tray.append(d.el); });
        lineUp();
      } else {
        newlyKept().forEach(d => { d.locked = true; d.el.classList.add('locked'); });
      }
    }
    const rolling = free();
    const len = Math.hypot(dirX, dirY) || 1;
    rolling.forEach(d => {
      const ang = Math.atan2(dirY / len, dirX / len) + (rand() - .5) * 0.7;
      const sp = speed * (0.75 + rand() * 0.5);
      d.vx = Math.cos(ang) * sp; d.vy = Math.sin(ang) * sp;
      d.va = (rand() < .5 ? -1 : 1) * (400 + rand() * 600);
      d.target = face();
    });
    rolls++;
    if(REDUCE){ rolling.forEach(d => { d.x = D + rand() * (W - 2 * D); d.y = D + rand() * (H - 2 * D); d.a = (rand() - .5) * 40; }); finish(rolling); return; }
    run(rolling);
  }

  let lastBuzz = 0;
  function buzz(){ const t = performance.now(); if(t - lastBuzz > 70 && navigator.vibrate){ navigator.vibrate(8); lastBuzz = t; } }

  function run(rolling){
    tray.classList.add('busy');
    let last = performance.now(), elapsed = 0;
    const step = now => {
      const dt = Math.min(0.032, (now - last) / 1000); last = now; elapsed += dt;
      let moving = false;
      const f = Math.exp(-FRICTION * dt), r = reach();
      for(const d of rolling){
        d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt;
        d.vx *= f; d.vy *= f; d.va *= Math.exp(-2.4 * dt);
        if(d.x < r){ d.x = r; d.vx = Math.abs(d.vx) * WALL; d.va *= -1; buzz(); }
        if(d.x > W - r){ d.x = W - r; d.vx = -Math.abs(d.vx) * WALL; d.va *= -1; buzz(); }
        if(d.y < r){ d.y = r; d.vy = Math.abs(d.vy) * WALL; buzz(); }
        if(d.y > H - r){ d.y = H - r; d.vy = -Math.abs(d.vy) * WALL; buzz(); }
      }
      // Chocs entre dés
      for(let i = 0; i < rolling.length; i++) for(let j = i + 1; j < rolling.length; j++){
        const a = rolling[i], b = rolling[j];
        let dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        const min = D * 1.05;
        if(dist >= min) continue;
        if(dist < 0.01){ dx = 1; dy = 0; dist = 1; }
        const nx = dx / dist, ny = dy / dist, push = (min - dist) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if(rel > 0){ const k = rel * 0.9; a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny; }
      }
      for(const d of rolling){
        clamp(d);
        const sp = Math.hypot(d.vx, d.vy);
        if(sp < STOP && elapsed > MIN_TIME){ d.vx = d.vy = 0; d.s = 1; if(d.v !== d.target) showFace(d, d.target); }
        else {
          moving = true;
          // Le dé roule : la face change, plus lentement quand il ralentit
          if(now - d.flip > 55 + 220 * (1 - Math.min(1, sp / 1400))){ d.flip = now; showFace(d, face()); }
          d.s = 1 + Math.min(0.2, sp / 7000) * Math.abs(Math.sin(elapsed * 13 + d.phase));
        }
        place(d);
      }
      anim = moving ? requestAnimationFrame(step) : 0;
      if(!moving) finish(rolling);
    };
    anim = requestAnimationFrame(step);
    update();
  }

  function finish(rolling){
    anim = 0;
    tray.classList.remove('busy');
    rolling.forEach(d => { d.s = 1; showFace(d, d.target); place(d); });
    update();
    const res = rolling.map(d => d.v).sort((a, b) => a - b).join(', ');
    msgEl.textContent = `Résultat : ${res}. ` + msgEl.textContent;
  }

  /* ---------- Glisser pour lancer ---------- */
  let track = null;
  tray.addEventListener('pointerdown', e => {
    if(anim) return;
    track = { x0:e.clientX, y0:e.clientY, target:e.target.closest('.pl-die'), pts:[{ x:e.clientX, y:e.clientY, t:e.timeStamp }] };
    tray.setPointerCapture(e.pointerId);
  });
  tray.addEventListener('pointermove', e => {
    if(!track) return;
    track.pts.push({ x:e.clientX, y:e.clientY, t:e.timeStamp });
    while(track.pts.length > 2 && e.timeStamp - track.pts[0].t > 120) track.pts.shift();
    if(canThrow() && Math.hypot(e.clientX - track.x0, e.clientY - track.y0) > 12) tray.classList.add('shaking');
  });
  function endTrack(e, cancelled){
    if(!track) return;
    tray.classList.remove('shaking');
    const t = track; track = null;
    if(cancelled) return;
    const p0 = t.pts[0], dt = Math.max(1, e.timeStamp - p0.t);
    const vx = (e.clientX - p0.x) / dt * 1000, vy = (e.clientY - p0.y) / dt * 1000;
    const dist = Math.hypot(e.clientX - t.x0, e.clientY - t.y0);
    const speed = Math.hypot(vx, vy);
    if(dist > 25 && speed > 250) throwDice(vx, vy, Math.min(3000, Math.max(900, speed * 1.3)));
    else if(dist < 10 && t.target) toggleKeep(dice[t.target.dataset.i]);
  }
  tray.addEventListener('pointerup', e => endTrack(e, false));
  tray.addEventListener('pointercancel', e => endTrack(e, true));

  // Clavier et dés gardés
  tray.addEventListener('keydown', e => {
    const b = e.target.closest('.pl-die');
    if(b && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); toggleKeep(dice[b.dataset.i]); }
  });
  slots.addEventListener('click', e => { const b = e.target.closest('.pl-die'); if(b) toggleKeep(dice[b.dataset.i]); });

  rollBtn.onclick = () => { const a = -Math.PI / 2 + (rand() - .5) * 1.2; throwDice(Math.cos(a), Math.sin(a), 1800 + rand() * 700); };
  q('.pl-new').onclick = () => reset();

  /* ---------- Ouverture ---------- */
  function reset(){
    if(anim){ cancelAnimationFrame(anim); anim = 0; tray.classList.remove('busy'); }
    rolls = 0;
    dice.forEach(d => { d.kept = d.locked = false; d.el.classList.remove('kept', 'locked'); tray.append(d.el); showFace(d, 0); });
    if(!ov.hidden) lineUp();
    update();
  }
  function open(){
    ov.hidden = false;
    document.body.classList.add('pl-open');
    measure();
    if(rolls === 0) lineUp(); else dice.forEach(place);
    update();
    q('.pl-close').focus();
  }
  function close(){
    ov.hidden = true;
    document.body.classList.remove('pl-open');
    fab.focus();
  }
  fab.onclick = open;
  q('.pl-close').onclick = close;
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !ov.hidden){ e.stopPropagation(); close(); } }, true);
  addEventListener('resize', () => { if(ov.hidden) return; measure(); dice.forEach(place); });

  dice.forEach(d => showFace(d, 0));
  update();
  window.plateau = { open, close, reset };
})();
