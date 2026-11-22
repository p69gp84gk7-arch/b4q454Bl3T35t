/* Altitude Arcade : les touches du clavier, montrées sur ordinateur.
   - On détecte « un ordinateur avec clavier » par le pointeur (souris / pavé tactile) et non par PC ou Mac : un iPad se déclare
     comme un Mac. Dès qu'on touche l'écran on repasse en mode tactile (rien n'est affiché) ; dès qu'on bouge la souris ou
     qu'on appuie sur une touche, le bandeau revient.
   - Chaque jeu appelle AltClavier.init({ touches:[['← →', 'Tourner'], …], aide:['phrase en plus', …], pause:() => … }).
     Dans `touches`, chaque mot est une touche (dessinée comme une vraie touche), « / » veut dire « ou ».
   - Un petit bandeau (réductible avec ✕, le choix est retenu) reste en bas à gauche ; la touche « ? » ouvre l'aide complète
     (et met le jeu en pause si le jeu le propose). Sur téléphone et tablette : rien ne change. */
(function(){
  const H = document.documentElement;
  const fin = matchMedia('(any-pointer: fine)'), survol = matchMedia('(any-hover: hover)');
  const lire = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const ecrire = (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} };
  let tDiscret = 0, cfg = null, racine = null, aide = null, tactile = false, clavierVu = false, reduit = lire('altitude-clavier') === 'reduit';
  const actif = () => (fin.matches && survol.matches || clavierVu) && !tactile;

  const css = `
.kbBandeau{ position:fixed; left:8px; bottom:var(--kb-bas, 8px); z-index:35; max-width:min(620px, calc(100vw - 16px)); display:flex; gap:8px; align-items:flex-start;
  background:rgba(10,18,32,.8); color:#fff; border-radius:12px; padding:6px 8px; font:600 12px/1.25 system-ui, -apple-system, 'Segoe UI', sans-serif; backdrop-filter:blur(6px); box-shadow:0 4px 14px rgba(0,0,0,.3); pointer-events:none; }
.kbBandeau button, .kbBandeau .kbIc{ pointer-events:auto; }
.kbBandeau{ transition:opacity .5s; }
.kbBandeau.discret{ opacity:.3; }
.kbBandeau.discret:hover{ opacity:1; }
.kbBandeau.haut{ bottom:auto; top:var(--kb-haut, 70px); left:50%; transform:translateX(-50%); }
.kbBandeau[hidden], .kbAide[hidden]{ display:none; }
.kbBandeau .kbIc{ font-size:15px; line-height:1.1; }
.kbBandeau .kbL{ display:flex; flex-wrap:wrap; align-items:center; }
.kbBandeau .kbI, .kbAide .kbI{ display:inline-flex; align-items:center; gap:3px; margin:2px 10px 2px 0; white-space:nowrap; }
.kbBandeau .kbI i, .kbAide .kbI i{ font-style:normal; opacity:.8; margin:0 1px; }
.kbBandeau kbd, .kbAide kbd{ display:inline-block; min-width:18px; text-align:center; background:#fff; color:#14233A; border-radius:5px; padding:1px 5px 2px; font:800 11px/1.3 system-ui, sans-serif; box-shadow:0 2px 0 #9AA7B8; }
.kbBandeau button{ border:none; background:rgba(255,255,255,.16); color:#fff; border-radius:8px; padding:2px 7px; font:800 12px system-ui, sans-serif; cursor:pointer; }
.kbBandeau button:hover{ background:rgba(255,255,255,.3); }
.kbBandeau.reduit .kbL{ display:none; }
.kbAide{ position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,.7); padding:16px; }
.kbAide .kbC{ background:#fff; color:#14233A; border-radius:18px; padding:16px 18px 14px; width:min(520px, 100%); max-height:86vh; overflow:auto; font:500 15px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; box-shadow:0 12px 40px rgba(0,0,0,.45); }
.kbAide h2{ margin:0 0 8px; font-size:1.15rem; }
.kbAide .kbLig{ display:flex; justify-content:space-between; align-items:center; gap:14px; padding:6px 0; border-bottom:1px solid #E4E9F0; }
.kbAide .kbLig .kbI{ margin:0; }
.kbAide kbd{ font-size:13px; padding:2px 8px 3px; }
.kbAide p{ margin:8px 0 0; color:#5B6B82; font-size:.88rem; }
.kbAide button{ margin-top:12px; border:none; background:#14233A; color:#fff; border-radius:10px; padding:8px 16px; font:800 14px system-ui, sans-serif; cursor:pointer; }
`;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  // « ← → » : deux touches ; « A / ← » : A ou ←
  const touchesHtml = t => t.split(/\s+/).filter(Boolean).map(m => m === '/' ? '<i>ou</i>' : m === '+' ? '<i>+</i>' : `<kbd>${esc(m)}</kbd>`).join(' ');
  const item = ([t, txt]) => `<span class="kbI">${touchesHtml(t)} <span>${esc(txt)}</span></span>`;

  function maj(){
    if(racine) racine.hidden = !actif();
    H.classList.toggle('kb', actif());
    H.classList.toggle('tactile', !actif());
  }
  function construire(){
    if(racine) return;
    racine = document.createElement('div'); racine.className = 'kbBandeau' + (reduit ? ' reduit' : ''); racine.hidden = true;
    racine.setAttribute('aria-label', 'Touches du clavier');
    racine.innerHTML = `<span class="kbIc" title="Touches du clavier" onmouseenter="this.parentNode.classList.remove('discret')">⌨️</span><div class="kbL">${cfg.touches.map(item).join('')}</div><button type="button" data-a="plus" title="Toutes les touches (touche ?)">?</button><button type="button" data-a="red" title="${reduit ? 'Montrer' : 'Réduire'}">${reduit ? '▸' : '✕'}</button>`;
    document.body.append(racine);
    if(cfg.bas != null) racine.style.setProperty('--kb-bas', cfg.bas + 'px');
    if(cfg.haut != null){ racine.classList.add('haut'); racine.style.setProperty('--kb-haut', cfg.haut + 'px'); }
    racine.onclick = e => {
      const b = e.target.closest('button'); if(!b) return;
      if(b.dataset.a === 'plus') ouvrirAide();
      else { reduit = !reduit; ecrire('altitude-clavier', reduit ? 'reduit' : 'ouvert'); racine.classList.toggle('reduit', reduit); b.textContent = reduit ? '▸' : '✕'; b.title = reduit ? 'Montrer' : 'Réduire'; }
    };
    maj();
  }
  function ouvrirAide(){
    if(!cfg) return;
    if(!aide){
      aide = document.createElement('div'); aide.className = 'kbAide'; aide.hidden = true;
      aide.onclick = e => { if(e.target === aide || e.target.closest('[data-f]')) fermerAide(); };
      document.body.append(aide);
    }
    if(!aide.hidden) return;
    if(cfg.pause){ try{ cfg.pause(); }catch(e){} }
    aide.innerHTML = `<div class="kbC" role="dialog" aria-label="Touches du clavier"><h2>⌨️ ${esc(cfg.titre || 'Touches du clavier')}</h2>
      ${cfg.touches.map(([t, txt]) => `<div class="kbLig"><span>${esc(txt)}</span><span class="kbI">${touchesHtml(t)}</span></div>`).join('')}
      ${(cfg.aide || []).map(p => `<p>${esc(p)}</p>`).join('')}
      <p>Touche <kbd>?</kbd> ou <kbd>Échap</kbd> pour fermer.</p><button type="button" data-f="1">Fermer</button></div>`;
    aide.hidden = false;
  }
  function fermerAide(){ if(aide) aide.hidden = true; }

  // le mode : tactile dès qu'on touche l'écran, clavier dès qu'on se sert de la souris ou d'une touche
  addEventListener('pointerdown', e => { const t = e.pointerType !== 'mouse'; if(t !== tactile){ tactile = t; maj(); } }, true);
  addEventListener('pointermove', e => { if(e.pointerType === 'mouse' && tactile){ tactile = false; maj(); } }, true);
  addEventListener('keydown', e => {
    if(!e.isTrusted) return;
    if(!clavierVu || tactile){ clavierVu = true; tactile = false; maj(); }
    // quand on joue (une touche autre que ?), le bandeau s'efface peu à peu pour ne rien cacher ; il revient quand on le survole ou avec ?
    if(racine && e.key !== '?' && e.key !== 'Escape' && !e.repeat){ clearTimeout(tDiscret); racine.classList.remove('discret'); tDiscret = setTimeout(() => racine && racine.classList.add('discret'), 5000); }
    const champ = e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if(!champ && e.key === '?' && cfg && actif()){ e.preventDefault(); if(aide && !aide.hidden) fermerAide(); else ouvrirAide(); }
    else if(e.key === 'Escape' && aide && !aide.hidden){ e.preventDefault(); e.stopImmediatePropagation(); fermerAide(); }
  }, true);
  fin.addEventListener && fin.addEventListener('change', maj);

  window.AltClavier = {
    init(c){ cfg = c; if(document.body) construire(); else addEventListener('DOMContentLoaded', construire); },
    est:actif, aide:ouvrirAide,
  };
  maj();
})();
