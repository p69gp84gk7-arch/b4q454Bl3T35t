/* DesDés : plateau de 5 dés, lancés en glissant le doigt sur le tapis.
   Utilisation : <script src="plateau.js" data-jeu="yams"></script> (ou data-jeu="10000").
   - Yam's : 3 lancers au plus, on garde les dés de son choix entre deux lancers.
   - 10 000 : lancers sans limite ; les dés mis de côté restent de côté jusqu'à la fin du tour.
     Quand tous les dés lancés comptent, ou que les 2 derniers dés font un double (sauf 1 et 5),
     la relance des 5 dés est obligatoire.
   Après chaque lancer, le plateau reconnaît les figures et propose de les noter dans le carnet,
   à travers window.plateauJeu défini par la page du jeu.
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
.pl-tray{ position:relative; flex:1; min-height:180px; border-radius:18px; overflow:hidden; touch-action:none;
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
.pl-tray.nudge .pl-die{ transition:transform .2s ease-out; }
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
.pl-props{ display:flex; flex-direction:column; gap:8px; max-height:36vh; overflow:auto; flex:none; }
.pl-props[hidden]{ display:none; }
.pl-props p{ margin:0; font-size:.85rem; color:rgba(247,243,232,.7); }
.pl-props-head{ display:flex; align-items:center; gap:8px; font-size:.85rem; font-weight:600; color:rgba(247,243,232,.75); }
.pl-props select{ font:inherit; font-weight:700; padding:6px 8px; border-radius:8px; border:0; background:#F7F3E8; color:#1A1A1A; max-width:60%; }
.pl-opts{ display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:6px; }
.pl-opt{ display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 6px; border-radius:10px;
  border:1.5px solid rgba(247,243,232,.25); background:rgba(0,0,0,.2); color:#F7F3E8; font:inherit; font-size:.85rem; line-height:1.15; cursor:pointer; }
.pl-opt b{ font-size:1.2rem; }
.pl-opt.fig{ background:#F7F3E8; color:#1A1A1A; border-color:#E9B949; box-shadow:0 0 0 2px #E9B949; }
.pl-props summary{ cursor:pointer; font-size:.85rem; font-weight:600; color:rgba(247,243,232,.75); padding:2px 0; }
.pl-props details .pl-opts{ margin-top:6px; }
.pl-row{ display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px; }
.pl-wide{ font:inherit; font-weight:700; font-size:.95rem; padding:12px 10px; border-radius:12px; cursor:pointer; border:0; }
.pl-bank{ background:#F7F3E8; color:#1A1A1A; }
.pl-bust{ background:#C8372D; color:#fff; }
.pl-auto{ background:transparent; color:#F7F3E8; border:1.5px dashed #E9B949; }
.pl-wide:disabled{ opacity:.4; cursor:not-allowed; }
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
    <div class="pl-props" hidden></div>
    <p class="pl-msg" aria-live="polite"></p>
    <div class="pl-actions"><button class="pl-new">Nouveau tour</button><button class="pl-roll">Lancer</button></div>`;
  document.body.append(fab, ov);

  const q = s => ov.querySelector(s);
  const tray = q('.pl-tray'), slots = q('.pl-slots'), hint = q('.pl-hint');
  const msgEl = q('.pl-msg'), countEl = q('.pl-count'), rollBtn = q('.pl-roll'), props = q('.pl-props');
  const fmt = n => n.toLocaleString('fr-FR');
  const esc = t => String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
    D = Math.round(Math.max(36, Math.min(76, (W - 12) / 5.9, H / 3.2)));
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
  /* Les dés ne se chevauchent jamais : on écarte ceux qui sont trop proches.
     La distance tient compte d'un dé penché (diagonale ≈ 1,41 × le côté). */
  const GAP = 1.42;
  function spread(list){
    const min = D * GAP;
    for(let it = 0; it < 60; it++){
      let moved = false;
      for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
        const a = list[i], b = list[j];
        let dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
        if(dist >= min - 0.5) continue;
        if(dist < 0.01){ const t = rand() * Math.PI * 2; dx = Math.cos(t); dy = Math.sin(t); dist = 1; }
        const push = (min - dist) / 2 + 0.5;
        a.x -= dx / dist * push; a.y -= dy / dist * push;
        b.x += dx / dist * push; b.y += dy / dist * push;
        moved = true;
      }
      list.forEach(clamp);
      if(!moved) break;
    }
  }
  // Écarte les dés du tapis avec un petit glissement
  function settle(){
    const onTray = dice.filter(d => !d.kept);
    spread(onTray);
    tray.classList.add('nudge');
    onTray.forEach(place);
    setTimeout(() => tray.classList.remove('nudge'), 250);
  }

  // Dés « dans la main » : alignés en bas du tapis
  function lineUp(){
    const free = dice.filter(d => !d.kept);
    free.forEach((d, k) => { d.x = W / 2 + (k - (free.length - 1) / 2) * D * 1.15; d.y = H - D * 0.9; d.a = 0; d.s = 1; place(d); });
  }

  /* ---------- État du tour ---------- */
  let rolls = 0, anim = 0;
  let mustRoll5 = false, busted = false, curFirst = false, notice = '', lastRolled = [];
  let yPlayer = null, propsKey = '';
  const free = () => dice.filter(d => !d.kept);
  const newlyKept = () => dice.filter(d => d.kept && !d.locked);
  // Lien avec le carnet de la page ; absent ou inactif (partie pas commencée) : le plateau sert seul
  const jeu = () => { const j = window.plateauJeu; return j && (!j.active || j.active()) ? j : null; };

  /* Points du 10 000 pour une poignée de dés.
     used[f] : nombre de dés de valeur f qui rapportent ; all : tous les dés rapportent. */
  function score10000(vals, first){
    const c = [0,0,0,0,0,0,0];
    vals.forEach(v => c[v]++);
    if(vals.length === 5 && ([1,2,3,4,5].every(f => c[f] === 1) || [2,3,4,5,6].every(f => c[f] === 1)))
      return { pts:1500, used:c, all:true };
    const used = [0,0,0,0,0,0,0];
    let pts = 0;
    for(let f = 1; f <= 6; f++){
      let k = c[f];
      const triple = f === 1 ? 1000 : f * 100;
      if(k >= 5 && first){ pts += f === 1 ? 10000 : f * 1000; used[f] += 5; k -= 5; }
      else if(k >= 4){ pts += triple * 2; used[f] += 4; k -= 4; }
      else if(k >= 3){ pts += triple; used[f] += 3; k -= 3; }
      if(f === 1){ pts += 100 * k; used[f] += k; }
      if(f === 5){ pts += 50 * k; used[f] += k; }
    }
    const n = used.reduce((a, b) => a + b, 0);
    return { pts, used, all: n > 0 && n === vals.length };
  }
  const pending = () => score10000(newlyKept().map(d => d.v), curFirst);

  function canThrow(){
    if(anim) return false;
    if(JEU === 'yams') return rolls < MAX_YAMS && free().length > 0;
    if(busted) return false;
    if(rolls === 0 || mustRoll5) return true;
    // 10 000 : il faut avoir mis de côté au moins un dé, et seulement des dés qui rapportent
    return newlyKept().length > 0 && pending().all;
  }

  function update(){
    const vals = dice.filter(d => d.v).map(d => d.v);
    const sum = vals.reduce((a, b) => a + b, 0);
    const j = jeu();
    const p = JEU === '10000' ? pending() : null;
    if(JEU === 'yams'){
      countEl.textContent = `Lancer ${rolls} / ${MAX_YAMS}` + (rolls && !anim ? ` · total des dés ${sum}` : '');
    } else {
      const total = (j ? j.turnPts() : 0) + (p.all ? p.pts : 0);
      countEl.textContent = (j ? `${j.player()} · ` : '') + `tour : ${fmt(total)} pts` + (rolls ? ` · lancer n° ${rolls}` : '');
    }

    rollBtn.disabled = !canThrow();
    rollBtn.textContent = anim ? 'Les dés roulent…'
      : JEU === 'yams' && rolls >= MAX_YAMS ? 'Plus de lancer'
      : busted ? 'Raté'
      : mustRoll5 ? 'Relancer les 5 dés'
      : rolls === 0 ? `Lancer ${free().length === N ? 'les 5 dés' : free().length + ' dé' + (free().length > 1 ? 's' : '')}`
      : `Relancer ${free().length} dé${free().length > 1 ? 's' : ''}`;

    let m;
    if(anim) m = '';
    else if(rolls === 0) m = free().length < N
      ? `Reprise des points : glissez pour lancer les ${free().length} dé${free().length > 1 ? 's' : ''} restant${free().length > 1 ? 's' : ''}.`
      : 'Glissez le doigt sur le tapis pour lancer les 5 dés (ou touchez le bouton).';
    else if(JEU === 'yams'){
      m = rolls >= MAX_YAMS ? '3 lancers faits : choisissez la case à remplir.'
        : 'Touchez les dés à garder, puis glissez pour relancer les autres. Vous pouvez aussi noter tout de suite.';
    } else {
      const nk = newlyKept().length;
      m = busted ? 'Aucun dé ne rapporte de points : raté !'
        : mustRoll5 ? notice
        : nk && !p.all ? 'Un dé mis de côté ne rapporte rien : touchez-le pour le reprendre.'
        : nk ? `+${fmt(p.pts)} avec les dés mis de côté. Relancez les ${free().length} autres, ou gardez vos points.`
        : 'Touchez les dés qui rapportent des points pour les mettre de côté.';
    }
    msgEl.textContent = m;
    hint.classList.toggle('off', rolls > 0 || !canThrow());   // l'aide ne s'affiche qu'avant le premier lancer
    slots.querySelector('.pl-empty')?.remove();
    if(!dice.some(d => d.kept)) slots.insertAdjacentHTML('beforeend', `<span class="pl-empty">${JEU === 'yams' ? 'Touchez un dé pour le garder' : 'Touchez un dé pour le mettre de côté'}</span>`);
    renderProps();
  }

  /* ---------- Propositions pour le carnet ---------- */
  function renderProps(){
    const j = jeu();
    const pick = JEU === '10000' && j && !anim && rolls === 0 && j.pickupInfo ? j.pickupInfo() : null;
    if(pick){
      propsKey = '';
      props.innerHTML = `<button class="pl-wide pl-auto" data-act="pickup">Reprendre les ${fmt(pick.pts)} points de ${esc(pick.name)}` +
        (pick.dice ? ` (${pick.dice} dé${pick.dice > 1 ? 's' : ''} à lancer)` : '') + '</button>';
      props.hidden = false;
      return;
    }
    if(!j || anim || rolls === 0){ props.hidden = true; propsKey = ''; return; }
    let html;
    if(JEU === 'yams'){
      const names = j.players();
      if(yPlayer === null || yPlayer >= names.length) yPlayer = j.nextPlayer();
      const vals = dice.map(d => d.v);
      const key = vals.join() + '|' + yPlayer;
      if(key === propsKey && !props.hidden) return;   // garder l'état ouvert/fermé de « Rayer »
      propsKey = key;
      const opts = j.options(vals, yPlayer);
      const good = opts.filter(o => o.pts > 0);
      html = `<div class="pl-props-head"><span>Noter pour</span><select class="pl-who" aria-label="Joueur">${names.map((n, i) => `<option value="${i}"${i === yPlayer ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`;
      if(!opts.length) html += '<p>Toutes les cases de ce joueur sont remplies.</p>';
      else {
        html += good.length
          ? `<div class="pl-opts">${good.map(o => `<button class="pl-opt${o.fig ? ' fig' : ''}" data-key="${o.key}" data-v="${o.pts}">${esc(o.label)}<b>${o.pts}</b></button>`).join('')}</div>`
          : '<p>Aucune case libre ne rapporte de points avec ces dés.</p>';
        html += `<details${good.length ? '' : ' open'}><summary>Rayer une case</summary><div class="pl-opts">${opts.map(o => `<button class="pl-opt" data-key="${o.key}" data-v="x">${esc(o.label)}<b>✕</b></button>`).join('')}</div></details>`;
      }
    } else {
      propsKey = '';
      if(busted) html = `<button class="pl-wide pl-bust" data-act="bust">Noter : ${esc(j.bustLabel())}</button>`;
      else if(mustRoll5){ props.hidden = true; return; }
      else {
        const p = pending();
        const best = score10000(lastRolled.map(d => d.v), curFirst);
        const total = j.turnPts() + (p.all ? p.pts : 0);
        const okBank = p.all && p.pts > 0 && (j.opened() || total >= 1000);
        html = '<div class="pl-row">';
        if(best.pts > (p.all ? p.pts : 0)) html += `<button class="pl-wide pl-auto" data-act="auto">Mettre de côté ce qui compte (+${fmt(best.pts)})</button>`;
        html += `<button class="pl-wide pl-bank" data-act="bank"${okBank ? '' : ' disabled'}>` +
          (!j.opened() && total < 1000 && p.pts ? `Il faut 1 000 pour ouvrir`
            : j.score && j.score() + total > 10000 ? `Dépasse 10 000 (${fmt(j.score() + total)}) : noter la croix`
            : total ? `Garder ${fmt(total)} points` : 'Garder les points') + '</button></div>';
      }
    }
    props.innerHTML = html;
    props.hidden = false;
  }

  // 10 000 : mettre de côté tous les dés du dernier lancer qui rapportent
  function autoKeep(){
    const need = score10000(lastRolled.map(d => d.v), curFirst).used.slice();
    lastRolled.forEach(d => { if(d.kept) setKept(d, false); });
    lastRolled.forEach(d => { if(need[d.v] > 0){ need[d.v]--; setKept(d, true); } });
    update();
  }
  function setKept(d, on){
    d.kept = on;
    d.el.classList.toggle('kept', on);
    if(on) slots.append(d.el);
    else { tray.append(d.el); clamp(d); place(d); settle(); }
    showFace(d, d.v);
  }

  props.addEventListener('click', e => {
    const b = e.target.closest('button');
    const j = jeu();
    if(!b || b.disabled || !j) return;
    if(b.dataset.key){
      j.note(yPlayer, b.dataset.key, b.dataset.v === 'x' ? 'x' : Number(b.dataset.v));
      reset(); close();
    } else if(b.dataset.act === 'auto') autoKeep();
    else if(b.dataset.act === 'bank'){
      const p = pending();
      if(p.all && p.pts) j.add(p.pts);
      j.bank(free().length);   // dés restants : le joueur suivant pourra les reprendre
      reset(); close();
    } else if(b.dataset.act === 'bust'){ j.bust(); reset(); close(); }
    else if(b.dataset.act === 'pickup'){ j.pickup(); reset(); }
  });
  props.addEventListener('change', e => { if(e.target.matches('.pl-who')){ yPlayer = Number(e.target.value); renderProps(); } });

  function toggleKeep(d){
    if(anim || rolls === 0 || !d.v) return;
    if(JEU === 'yams' && rolls >= MAX_YAMS) return;
    if(d.locked || busted || mustRoll5) return;
    setKept(d, !d.kept);
    update();
  }

  /* ---------- Lancer ---------- */
  function throwDice(dirX, dirY, speed){
    if(!canThrow()) return;
    if(JEU === '10000'){
      const j = jeu();
      if(rolls > 0 && !mustRoll5){
        // Les points des dés mis de côté passent dans le carnet
        const p = pending();
        if(j && p.pts) j.add(p.pts);
        newlyKept().forEach(d => { d.locked = true; d.el.classList.add('locked'); });
      }
      if(mustRoll5 || free().length === 0){
        // Les 5 dés reviennent sur le tapis
        dice.forEach(d => { d.kept = d.locked = false; d.el.classList.remove('kept', 'locked'); tray.append(d.el); });
        lineUp();
        mustRoll5 = false;
      }
    }
    const rolling = free();
    lastRolled = rolling;
    const len = Math.hypot(dirX, dirY) || 1;
    rolling.forEach(d => {
      const ang = Math.atan2(dirY / len, dirX / len) + (rand() - .5) * 0.7;
      const sp = speed * (0.75 + rand() * 0.5);
      d.vx = Math.cos(ang) * sp; d.vy = Math.sin(ang) * sp;
      d.va = (rand() < .5 ? -1 : 1) * (400 + rand() * 600);
      d.target = face();
    });
    rolls++;
    if(REDUCE){
      // Sans animation : les dés se posent en ligne au milieu du tapis
      rolling.forEach((d, k) => { d.x = W / 2 + (k - (rolling.length - 1) / 2) * D * 1.3; d.y = H / 2 + (rand() - .5) * D; d.a = (rand() - .5) * 30; clamp(d); });
      finish(rolling); return;
    }
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
        const min = D * 1.25;
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
    if(JEU === '10000') judge10000(rolling);
    settle();
    update();
    const res = rolling.map(d => d.v).sort((a, b) => a - b).join(', ');
    msgEl.textContent = `Résultat : ${res}. ` + msgEl.textContent;
  }

  // 10 000 : ce que donne le lancer (raté, relance obligatoire des 5, ou choix des dés)
  function judge10000(rolled){
    const vals = rolled.map(d => d.v);
    const j = jeu();
    curFirst = rolls === 1 && (!j || j.firstRoll());
    const s = score10000(vals, curFirst);
    notice = '';
    if(vals.length === 2 && vals[0] === vals[1] && vals[0] !== 1 && vals[0] !== 5){
      mustRoll5 = true;
      notice = `Double ${vals[0]} avec les 2 derniers dés : relance obligatoire des 5 dés.`;
    } else if(s.all){
      // Tous les dés lancés rapportent : points ajoutés, et relance obligatoire des 5
      if(j) j.add(s.pts);
      rolled.forEach(d => { setKept(d, true); d.locked = true; d.el.classList.add('locked'); });
      mustRoll5 = true;
      notice = `Tous les dés comptent (+${fmt(s.pts)}) : relance obligatoire des 5 dés.`;
    } else if(s.pts === 0) busted = true;
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
    mustRoll5 = busted = curFirst = false; notice = ''; lastRolled = []; yPlayer = null; propsKey = '';
    startHand();
    if(!ov.hidden) lineUp();
    update();
  }
  // Début de tour : 5 dés en main, ou au 10 000 seulement les dés laissés par le joueur dont on reprend les points
  function startHand(){
    const j = JEU === '10000' ? jeu() : null;
    const n = j && j.pickupDice ? j.pickupDice() : 0;
    dice.forEach((d, k) => {
      const out = n > 0 && k < N - n;
      d.kept = d.locked = out;
      d.el.classList.toggle('kept', out);
      d.el.classList.toggle('locked', out);
      (out ? slots : tray).append(d.el);
      showFace(d, 0);
    });
  }
  function open(){
    ov.hidden = false;
    document.body.classList.add('pl-open');
    measure();
    if(rolls === 0){ startHand(); lineUp(); } else dice.forEach(place);
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
  // Le tapis change de taille (rotation, propositions affichées en dessous) : les dés restent dedans
  new ResizeObserver(() => { if(ov.hidden || anim) return; measure(); if(rolls) spread(free()); dice.forEach(place); }).observe(tray);

  dice.forEach(d => showFace(d, 0));
  update();
  window.plateau = { open, close, reset };
})();
