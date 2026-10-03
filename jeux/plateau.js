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
.pl-ov{ --pl-bg:#123A2C; --pl-felt:#1F5C47; --pl-rim:#0C261D; --pl-felt-img:none;
  --pl-die:#F7F3E8; --pl-die-edge:#1A1A1A; --pl-pip:#1A1A1A; --pl-one:#C8372D;
  position:fixed; inset:0; z-index:60; display:flex; flex-direction:column; gap:10px;
  padding:calc(12px + env(safe-area-inset-top,0px)) 16px calc(14px + env(safe-area-inset-bottom,0px));
  background:var(--pl-bg); color:#F7F3E8; font-family:inherit; }
.pl-ov[data-tapis="casino"]{ --pl-bg:#4A1016; --pl-felt:#7A1C24; --pl-rim:#3B0C10; --pl-die:#FFFFFF; }
.pl-ov[data-tapis="bleu"]{ --pl-bg:#10294A; --pl-felt:#1D4E89; --pl-rim:#0C2340; }
.pl-ov[data-tapis="bois"]{ --pl-bg:#3A2410; --pl-felt:#8B5A2B; --pl-rim:#4A2C12; --pl-die:#FFF8E7;
  --pl-felt-img:repeating-linear-gradient(97deg, rgba(0,0,0,.08) 0 3px, transparent 3px 11px, rgba(255,255,255,.05) 11px 13px, transparent 13px 23px); }
.pl-ov[data-tapis="ardoise"]{ --pl-bg:#1E2124; --pl-felt:#2F3338; --pl-rim:#15171A; --pl-die:#C8372D; --pl-die-edge:#7E1C15; --pl-pip:#FFFFFF; --pl-one:#FFFFFF; }
.pl-ov[data-tapis="nuit"]{ --pl-bg:#0B1020; --pl-felt:#1B2340; --pl-rim:#070A16; --pl-die:#1A1A1A; --pl-die-edge:#E9B949; --pl-pip:#F7F3E8; --pl-one:#E9B949; }
.pl-tools{ display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.pl-tool{ border:1.5px solid rgba(247,243,232,.3); background:transparent; color:#F7F3E8; font:inherit; font-weight:600;
  font-size:.85rem; padding:7px 10px; border-radius:10px; cursor:pointer; }
.pl-tool[aria-pressed="true"]{ background:#E9B949; color:#1A1A1A; border-color:#E9B949; }
.pl-deco{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:-2px; }
.pl-deco .pl-theme{ padding:6px 10px; font-size:.82rem; }
.pl-themes{ display:flex; gap:6px; flex-wrap:wrap; }
.pl-themes[hidden]{ display:none; }
.pl-themes button{ width:34px; height:34px; border-radius:50%; border:2px solid rgba(247,243,232,.4); cursor:pointer; padding:0; }
.pl-themes button[aria-pressed="true"]{ border-color:#E9B949; box-shadow:0 0 0 2px #E9B949; }
.pl-die.conseil .pl-face{ box-shadow:0 0 0 4px #FFE066, 0 0 18px 4px rgba(255,224,102,.75); }
.pl-die.conseil::after{ content:"garder"; position:absolute; left:50%; bottom:-14px; transform:translateX(-50%); font-size:.68rem; font-weight:800;
  color:#1A1A1A; background:#FFE066; padding:1px 6px; border-radius:6px; white-space:nowrap; }
.pl-tray .pl-die.conseil::after{ display:block; }
.pl-conseil{ margin:0; padding:9px 12px; border-radius:12px; background:rgba(255,224,102,.14); border:1.5px solid rgba(255,224,102,.55); font-size:.9rem; line-height:1.35; }
.pl-conseil b{ color:#FFE066; }
.pl-pct{ display:inline-block; margin:3px 6px 0 0; padding:1px 8px; border-radius:999px; background:rgba(0,0,0,.3); font-size:.82rem; white-space:nowrap; }
.pl-opt.best{ outline:3px solid #FFE066; outline-offset:1px; }
.pl-opt.best::before{ content:"★ conseillé"; font-size:.68rem; font-weight:800; color:#FFE066; }
.pl-fig{ position:absolute; left:50%; top:16px; transform:translateX(-50%); z-index:3; pointer-events:none; text-align:center;
  padding:10px 18px; border-radius:14px; background:#E9B949; color:#1A1A1A; font-weight:800; font-size:1.4rem; line-height:1.1;
  box-shadow:0 8px 24px rgba(0,0,0,.4); white-space:nowrap; }
.pl-fig small{ display:block; font-size:.85rem; font-weight:700; }
.pl-fig[hidden]{ display:none; }
@media (prefers-reduced-motion:no-preference){ .pl-fig:not([hidden]){ animation:pl-pop .35s ease-out; } }
@keyframes pl-pop{ from{ transform:translateX(-50%) scale(.6); opacity:0 } to{ transform:translateX(-50%) scale(1); opacity:1 } }
.pl-ov.pl-robot .pl-tray, .pl-ov.pl-robot .pl-props, .pl-ov.pl-robot .pl-actions, .pl-ov.pl-robot .pl-slots{ pointer-events:none; }
.pl-ov.pl-robot .pl-title::before{ content:"🤖 "; }
.pl-auto.pick{ border:0; background:#E9B949; color:#1A1A1A; font-size:1.05rem; padding:15px 12px; box-shadow:0 0 0 3px rgba(233,185,73,.35); }
@media (prefers-reduced-motion:no-preference){ .pl-auto.pick:not(:disabled){ animation:pl-pulse 1.6s ease-in-out infinite; } }
@keyframes pl-pulse{ 50%{ box-shadow:0 0 0 8px rgba(233,185,73,.15); } }
.pl-ov[hidden]{ display:none; }
.pl-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.pl-title{ font-weight:800; font-size:1.25rem; line-height:1.1; }
.pl-count{ font-size:.9rem; color:rgba(247,243,232,.75); margin-top:2px; font-variant-numeric:tabular-nums; }
.pl-title.pl-big{ font-size:1.8rem; letter-spacing:-.01em; }
.pl-count.chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.pl-chip{ padding:3px 10px; border-radius:999px; background:rgba(0,0,0,.28); color:#F7F3E8; font-size:.85rem; font-weight:600; white-space:nowrap; }
.pl-chip.goal{ background:#E9B949; color:#1A1A1A; }
.pl-chip.cross{ background:#C8372D; color:#fff; letter-spacing:.02em; }
.pl-close{ border:1.5px solid rgba(247,243,232,.3); background:transparent; color:#F7F3E8; font:inherit;
  font-weight:600; padding:9px 14px; border-radius:10px; cursor:pointer; }
.pl-tray{ position:relative; flex:1; min-height:180px; border-radius:18px; overflow:hidden; touch-action:none;
  background-color:var(--pl-felt); box-shadow:inset 0 0 0 6px var(--pl-rim), inset 0 0 40px rgba(0,0,0,.45);
  background-image:radial-gradient(circle at 50% 30%, rgba(255,255,255,.09), transparent 65%), var(--pl-felt-img);
  -webkit-user-select:none; user-select:none; cursor:grab; }
.pl-hint{ position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; margin:0; padding:0 24px 30%; text-align:center; color:rgba(247,243,232,.55); font-weight:600;
  pointer-events:none; transition:opacity .2s; }
.pl-hint svg{ width:40px; height:40px; opacity:.8; }
.pl-tray.busy .pl-hint, .pl-hint.off{ opacity:0; }
.pl-die{ position:absolute; left:0; top:0; width:var(--pl-d,60px); height:var(--pl-d,60px); padding:0; border:0;
  background:none; cursor:pointer; will-change:transform; -webkit-tap-highlight-color:transparent; }
.pl-face{ display:grid; grid-template:repeat(3,1fr)/repeat(3,1fr); width:100%; height:100%; padding:15%;
  border-radius:20%; background:var(--pl-die); border:2px solid var(--pl-die-edge);
  box-shadow:0 6px 10px rgba(0,0,0,.35), inset 0 -4px 0 rgba(0,0,0,.08); }
.pl-face i{ align-self:center; justify-self:center; width:72%; height:72%; border-radius:50%; background:var(--pl-pip); visibility:hidden; }
.pl-face i.on{ visibility:visible; }
.pl-face.one i.on{ background:var(--pl-one); width:95%; height:95%; }
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
      <div class="pl-tools">
        ${JEU === 'yams' ? '<button class="pl-tool pl-tip" aria-pressed="false" title="Dés à garder et chances de chaque figure">💡 Conseils</button>' : ''}
        <button class="pl-close">Fermer</button>
      </div>
    </div>
    <div class="pl-tray"><p class="pl-hint">${SWIPE_ICON}<span>Glissez le doigt sur le tapis pour lancer</span></p><div class="pl-fig" hidden></div></div>
    <div class="pl-deco"><button class="pl-tool pl-theme" aria-expanded="false">🎨 Couleur du tapis</button><div class="pl-themes" hidden></div></div>
    <div class="pl-keep"><span class="pl-keep-label">${JEU === 'yams' ? 'Gardés' : 'De côté'}</span><div class="pl-slots"></div></div>
    <div class="pl-props" hidden></div>
    <p class="pl-msg" aria-live="polite"></p>
    <div class="pl-actions"><button class="pl-new">Nouveau tour</button><button class="pl-roll">Lancer</button></div>`;
  document.body.append(fab, ov);

  const q = s => ov.querySelector(s);
  const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
  const ecrire = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };

  /* ---------- Thèmes du tapis (communs aux deux jeux) ---------- */
  const TAPIS = { vert:['Feutre vert', '#1F5C47', '#F7F3E8'], casino:['Casino', '#7A1C24', '#FFFFFF'], bleu:['Bleu', '#1D4E89', '#F7F3E8'],
    bois:['Bois', '#8B5A2B', '#FFF8E7'], ardoise:['Ardoise, dés rouges', '#2F3338', '#C8372D'], nuit:['Nuit, dés noirs', '#1B2340', '#1A1A1A'] };
  const themesEl = q('.pl-themes');
  function appliquerTapis(t){
    if(!TAPIS[t]) t = 'vert';
    ov.dataset.tapis = t;
    themesEl.innerHTML = Object.entries(TAPIS).map(([k, [n, felt, de]]) =>
      `<button data-tapis="${k}" aria-pressed="${k === t}" aria-label="${n}" title="${n}" style="background:linear-gradient(135deg, ${felt} 55%, ${de} 55%)"></button>`).join('');
  }
  appliquerTapis(lire('desdes-tapis', 'vert'));
  q('.pl-theme').onclick = () => { themesEl.hidden = !themesEl.hidden; q('.pl-theme').setAttribute('aria-expanded', String(!themesEl.hidden)); };
  themesEl.addEventListener('click', e => { const b = e.target.closest('button'); if(b){ ecrire('desdes-tapis', b.dataset.tapis); appliquerTapis(b.dataset.tapis); } });
  const tray = q('.pl-tray'), slots = q('.pl-slots'), hint = q('.pl-hint');
  const msgEl = q('.pl-msg'), countEl = q('.pl-count'), titleEl = q('.pl-title'), rollBtn = q('.pl-roll'), props = q('.pl-props');
  const fmt = n => n.toLocaleString('fr-FR');
  const figEl = q('.pl-fig');
  let conseils = JEU === 'yams' && lire('yams-conseils', false);
  const tipBtn = q('.pl-tip');
  if(tipBtn){
    tipBtn.setAttribute('aria-pressed', String(conseils));
    tipBtn.onclick = () => { conseils = !conseils; ecrire('yams-conseils', conseils); tipBtn.setAttribute('aria-pressed', String(conseils)); propsKey = ''; update(); };
  }
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
  let rolls = 0, anim = 0, pausing = false, pauseTok = 0;
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
    if(anim || pausing) return false;
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
      // Bandeau : nom du joueur en grand, reste à faire pour 10 000 (en comptant le tour) et croix
      titleEl.textContent = j ? j.player() : 'Plateau de dés';
      titleEl.classList.toggle('pl-big', !!j);
      let chips = '';
      if(j){
        const left = 10000 - j.score() - total;
        const n = j.crosses();
        chips += left >= 0
          ? `<span class="pl-chip goal">Reste ${fmt(left)}</span>`
          : `<span class="pl-chip cross">Dépasse de ${fmt(-left)}</span>`;
        chips += n ? `<span class="pl-chip cross" aria-label="${n} croix">${'✕'.repeat(n)} ${n} croix</span>` : '<span class="pl-chip">Aucune croix</span>';
      }
      chips += `<span class="pl-chip">Tour : ${fmt(total)}</span>`;
      if(rolls) chips += `<span class="pl-chip">Lancer n° ${rolls}</span>`;
      countEl.innerHTML = chips;
      countEl.classList.add('chips');
    }

    rollBtn.disabled = !canThrow();
    rollBtn.textContent = anim ? 'Les dés roulent…' : pausing ? '…'
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
      props.innerHTML = pick.blocked
        ? `<button class="pl-wide pl-auto" disabled>Impossible de reprendre les ${fmt(pick.pts)} points de ${esc(pick.name)} : dépasserait 10 000</button>`
        : `<button class="pl-wide pl-auto pick" data-act="pickup">⤵ Reprendre les ${fmt(pick.pts)} points de ${esc(pick.name)}` +
          (pick.dice ? ` (${pick.dice} dé${pick.dice > 1 ? 's' : ''} à lancer)` : '') + '</button>';
      props.hidden = false;
      return;
    }
    if(!j || anim || rolls === 0){ props.hidden = true; propsKey = ''; marquerConseil(null); return; }
    let html;
    if(JEU === 'yams'){
      const names = j.players();
      if(yPlayer === null || yPlayer >= names.length) yPlayer = j.nextPlayer();
      const vals = dice.map(d => d.v);
      const key = vals.join() + '|' + yPlayer + '|' + conseils + '|' + rolls + '|' + dice.map(d => d.kept ? 1 : 0).join('');
      if(key === propsKey && !props.hidden) return;   // garder l'état ouvert/fermé de « Rayer »
      propsKey = key;
      const opts = j.options(vals, yPlayer);
      const good = opts.filter(o => o.pts > 0);
      const c = conseils && !robotTok && window.YamsIA && j.etat && opts.length ? YamsIA.conseil(vals, MAX_YAMS - rolls, opts.map(o => o.key), j.etat(yPlayer).haut) : null;
      marquerConseil(c);
      html = `<div class="pl-props-head"><span>Noter pour</span><select class="pl-who" aria-label="Joueur">${names.map((n, i) => `<option value="${i}"${i === yPlayer ? ' selected' : ''}>${esc(n)}${j.robot && j.robot(i) ? ' 🤖' : ''}</option>`).join('')}</select></div>`;
      if(c) html += conseilHTML(c, opts);
      const best = c && (c.garde.length === 5 || rolls >= MAX_YAMS) ? c.case : null;
      if(!opts.length) html += '<p>Toutes les cases de ce joueur sont remplies.</p>';
      else {
        html += good.length
          ? `<div class="pl-opts">${good.map(o => `<button class="pl-opt${o.fig ? ' fig' : ''}${o.key === best ? ' best' : ''}" data-key="${o.key}" data-v="${o.pts}">${esc(o.label)}<b>${o.pts}</b></button>`).join('')}</div>`
          : '<p>Aucune case libre ne rapporte de points avec ces dés.</p>';
        const rayerBest = best && !good.some(o => o.key === best);
        html += `<details${good.length && !rayerBest ? '' : ' open'}><summary>Rayer une case</summary><div class="pl-opts">${opts.map(o => `<button class="pl-opt${rayerBest && o.key === best ? ' best' : ''}" data-key="${o.key}" data-v="x" aria-label="Rayer ${esc(o.label)}">${esc(o.label)}<b>/</b></button>`).join('')}</div></details>`;
      }
    } else {
      propsKey = '';
      if(busted) html = `<button class="pl-wide pl-bust" data-act="bust">Noter : ${esc(j.bustLabel())}</button>`;
      else if(pausing){ props.hidden = true; return; }
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

  /* Yam's : conseil (dés à garder en surbrillance, chances de chaque figure) */
  const FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  function marquerConseil(c){
    dice.forEach(d => d.el.classList.remove('conseil'));
    if(!c || rolls >= MAX_YAMS || c.garde.length === 5) return;
    // Les dés à garder : ceux déjà gardés d'abord, puis ceux du tapis
    const reste = c.garde.slice();
    [...dice].sort((a, b) => b.kept - a.kept).forEach(d => {
      const k = reste.indexOf(d.v);
      if(k >= 0){ reste.splice(k, 1); d.el.classList.add('conseil'); }
    });
  }
  function conseilHTML(c, opts){
    const nom = k => (opts.find(o => o.key === k) || {}).label || k;
    const pct = p => p >= 0.995 ? '100 %' : p < 0.01 ? '< 1 %' : Math.round(p * 100) + ' %';
    if(rolls >= MAX_YAMS || c.garde.length === 5){
      const o = opts.find(x => x.key === c.case);
      return `<p class="pl-conseil">💡 <b>Conseil : ${o && o.pts > 0 ? `noter ${esc(nom(c.case))} (${o.pts})` : `rayer ${esc(nom(c.case))}`}</b>${rolls < MAX_YAMS ? ' sans relancer.' : '.'}</p>`;
    }
    const n = 5 - c.garde.length, r = MAX_YAMS - rolls;
    return `<p class="pl-conseil">💡 <b>Garder ${c.garde.length ? c.garde.map(v => FACES[v]).join(' ') : 'aucun dé'}</b> (en jaune) et relancer ${n} dé${n > 1 ? 's' : ''}` +
      ` (${r} lancer${r > 1 ? 's' : ''} restant${r > 1 ? 's' : ''}).` +
      (c.probas.length ? `<br>Chances à la fin du tour : ${c.probas.slice(0, 5).map(x => `<span class="pl-pct">${esc(x.label)} ${pct(x.p)}</span>`).join('')}` : '') + '</p>';
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
      reset(); close(); robotSuivant();
    } else if(b.dataset.act === 'auto') autoKeep();
    else if(b.dataset.act === 'bank'){
      const p = pending();
      if(p.all && p.pts) j.add(p.pts);
      j.bank(free().length);   // dés restants : le joueur suivant pourra les reprendre
      reset(); close(); robotSuivant();
    } else if(b.dataset.act === 'bust'){ j.bust(); reset(); close(); robotSuivant(); }
    else if(b.dataset.act === 'pickup'){ j.pickup(); reset(); }
  });
  props.addEventListener('change', e => { if(e.target.matches('.pl-who')){ yPlayer = Number(e.target.value); renderProps(); } });

  function toggleKeep(d){
    if(anim || pausing || rolls === 0 || !d.v) return;
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
    const res = rolling.map(d => d.v).sort((a, b) => a - b).join(', ');
    if(JEU === '10000'){
      // Tous les dés lancés rapportent : on laisse le temps de voir la figure avant de les mettre de côté
      const vals = rolling.map(d => d.v), j = jeu();
      const first = rolls === 1 && (!j || j.firstRoll());
      const s = score10000(vals, first);
      if(s.all && !(vals.length === 2 && vals[0] === vals[1] && vals[0] !== 1 && vals[0] !== 5)){
        pausing = true;
        const tok = ++pauseTok;
        settle();
        figEl.innerHTML = `${figure(vals, s)}<small>+${fmt(s.pts)}</small>`;
        figEl.hidden = false;
        update();
        msgEl.textContent = `Résultat : ${res}.`;
        setTimeout(() => {
          if(tok !== pauseTok) return;     // tour remis à zéro entre-temps
          pausing = false;
          figEl.hidden = true;
          judge10000(rolling);
          update();
          msgEl.textContent = `Résultat : ${res}. ` + msgEl.textContent;
        }, vals.length === 5 ? 2200 : 1300);
        return;
      }
      judge10000(rolling);
    }
    settle();
    update();
    msgEl.textContent = `Résultat : ${res}. ` + msgEl.textContent;
  }
  // Nom de la figure quand tous les dés lancés rapportent
  function figure(vals, s){
    const c = [0,0,0,0,0,0,0]; vals.forEach(v => c[v]++);
    if(vals.length === 5 && s.pts === 1500 && c.every(x => x <= 1)) return 'Suite !';
    const f = c.findIndex(x => x === vals.length && x >= 3);
    if(f > 0) return `${['', '', '', 'Trois', 'Quatre', 'Cinq'][vals.length]} ${f} !`;
    return vals.length === 5 ? 'Les 5 dés comptent !' : 'Tous les dés comptent !';
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
    pauseTok++; pausing = false; figEl.hidden = true;
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
  /* ---------- Robot : il joue son tour sur le tapis, puis note dans le carnet ---------- */
  let robotTok = 0;            // tour de robot en cours (0 : aucun)
  const attendre = ms => new Promise(r => setTimeout(r, REDUCE ? Math.min(ms, 250) : ms));
  async function finLancer(tok){
    while(anim || pausing){ await attendre(80); if(tok !== robotTok) throw new Error('arrêt'); }
  }
  function lancerRobot(){ const a = -Math.PI / 2 + (rand() - .5) * 1.2; throwDice(Math.cos(a), Math.sin(a), 1800 + rand() * 700); }
  const NIVEAUX = { facile:'facile', moyen:'moyen', fort:'fort' };
  function robotDuTour(){
    const j = jeu();
    if(!j || !j.robot) return null;
    if(JEU === 'yams'){
      const p = j.nextPlayer();
      return j.etat(p).ouvertes.length ? NIVEAUX[j.robot(p)] || null : null;   // partie finie : personne ne joue
    }
    return NIVEAUX[j.robot()] || null;
  }
  async function jouerRobot(){
    const niveau = robotDuTour();
    if(!niveau || robotTok) return;
    const tok = robotTok = Date.now();
    const verifier = () => { if(tok !== robotTok) throw new Error('arrêt'); };
    if(ov.hidden) open();
    reset();
    ov.classList.add('pl-robot');
    q('.pl-close').textContent = 'Arrêter le robot';
    try{
      if(JEU === 'yams') await robotYams(niveau, verifier, tok);
      else await robot10000(niveau, verifier, tok);
    }catch(e){
      if(e.message !== 'arrêt') console.error(e);
      return;
    }finally{
      if(tok === robotTok){ robotTok = 0; ov.classList.remove('pl-robot'); q('.pl-close').textContent = 'Fermer'; if(JEU === 'yams') titleEl.textContent = 'Plateau de dés'; }
    }
    setTimeout(robotSuivant, 600);
  }
  async function robotYams(niveau, verifier, tok){
    const j = jeu();
    yPlayer = j.nextPlayer();
    const p = yPlayer, et = j.etat(p);
    titleEl.textContent = j.players()[p];
    msgEl.textContent = `${j.players()[p]} lance les dés…`;
    await attendre(700); verifier();
    for(;;){
      lancerRobot();
      await finLancer(tok); verifier();
      await attendre(700); verifier();
      const vals = dice.map(d => d.v);
      if(rolls >= MAX_YAMS) break;
      const garde = YamsIA.garder(vals, MAX_YAMS - rolls, et.ouvertes, et.haut, niveau);
      if(garde.length === 5) break;
      // Garder les dés choisis, reprendre les autres
      const reste = garde.slice();
      dice.forEach(d => { const k = reste.indexOf(d.v); const garder = k >= 0; if(garder) reste.splice(k, 1); if(d.kept !== garder) setKept(d, garder); });
      update();
      msgEl.textContent = garde.length ? `${j.players()[p]} garde ${garde.map(v => FACES[v]).join(' ')}.` : `${j.players()[p]} relance tout.`;
      await attendre(1100); verifier();
    }
    const vals = dice.map(d => d.v);
    const cas = YamsIA.choisir(vals, et.ouvertes, et.haut, niveau);
    const pts = YamsIA.points(cas, vals);
    msgEl.textContent = `${j.players()[p]} ${pts > 0 ? `note ${YamsIA.NOMS[cas]} : ${pts} points` : `raye ${YamsIA.NOMS[cas]}`}.`;
    await attendre(1600); verifier();
    j.note(p, cas, pts > 0 ? pts : 'x');
    reset(); close();
  }
  async function robot10000(niveau, verifier, tok){
    const j = jeu();
    const nom = j.player();
    await attendre(600); verifier();
    const pick = j.pickupInfo && j.pickupInfo();
    if(pick && !pick.blocked && DixMilleIA.reprendre({ pts:pick.pts, des:pick.dice, niveau })){
      msgEl.textContent = `${nom} reprend les ${fmt(pick.pts)} points de ${pick.name}.`;
      await attendre(1200); verifier();
      j.pickup(); reset();
      await attendre(500); verifier();
    }
    for(let k = 0; k < 60; k++){
      lancerRobot();
      await finLancer(tok); verifier();
      await attendre(800); verifier();
      if(busted){
        msgEl.textContent = `${nom} : raté !`;
        await attendre(1400); verifier();
        j.bust(); reset(); close();
        return;
      }
      if(mustRoll5){ await attendre(700); verifier(); continue; }
      const vals = lastRolled.map(d => d.v);
      const idx = DixMilleIA.deCote(vals, curFirst, niveau, 10000 - j.score() - j.turnPts());
      idx.forEach(i => setKept(lastRolled[i], true));
      update();
      await attendre(1000); verifier();
      const p = pending();
      const tour = j.turnPts() + (p.all ? p.pts : 0);
      if(DixMilleIA.garderPoints({ tour, des:free().length, score:j.score(), ouvert:j.opened(), niveau })){
        msgEl.textContent = `${nom} garde ${fmt(tour)} points.`;
        await attendre(1200); verifier();
        if(p.all && p.pts) j.add(p.pts);
        j.bank(free().length);
        reset(); close();
        return;
      }
      msgEl.textContent = `${nom} relance ${free().length} dé${free().length > 1 ? 's' : ''}.`;
      await attendre(600); verifier();
    }
  }
  // Après chaque tour noté : si c'est à un robot de jouer, il joue
  function robotSuivant(){
    if(robotTok) return;
    setTimeout(() => { if(!robotTok && robotDuTour()) jouerRobot(); }, 700);
  }
  function arreterRobot(){
    if(!robotTok) return;
    robotTok = 0;
    ov.classList.remove('pl-robot');
    q('.pl-close').textContent = 'Fermer';
    if(JEU === 'yams') titleEl.textContent = 'Plateau de dés';
    reset();
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
    if(robotTok && !ov.classList.contains('pl-robot')) robotTok = 0;
    ov.hidden = true;
    document.body.classList.remove('pl-open');
    fab.focus();
  }
  fab.onclick = () => { open(); robotSuivant(); };
  q('.pl-close').onclick = () => { if(robotTok){ arreterRobot(); close(); } else close(); };
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !ov.hidden){ e.stopPropagation(); close(); } }, true);
  // Le tapis change de taille (rotation, propositions affichées en dessous) : les dés restent dedans
  new ResizeObserver(() => { if(ov.hidden || anim) return; measure(); if(rolls) spread(free()); dice.forEach(place); }).observe(tray);

  dice.forEach(d => showFace(d, 0));
  update();
  window.plateau = { open, close, reset, robotSuivant };
})();
