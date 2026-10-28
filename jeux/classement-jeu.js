/* Altitude Arcade : le classement d'un jeu, consultable directement dans ce jeu.
   Chargé par chaque jeu après compte.js : un bouton « 🏆 Classement » s'ajoute à côté du lien vers l'accueil, et ouvre
   une fenêtre avec les meilleurs scores de tous les joueurs pour ce jeu seulement (épreuve par épreuve) et les statistiques.
   Les scores viennent du tableur (comme la page du classement général) ; ceux du joueur connecté sont recalculés sur l'appareil. */
(() => {
  'use strict';
  const ici = document.currentScript ? document.currentScript.src : '';
  const base = ici.slice(0, ici.lastIndexOf('/') + 1);               // le dossier jeux/
  const PAGES = { '10000':'10000', yams:'yams', geo:'geo', drawrace:'drawrace', fusee:'fusee', dameuse:'dameuse', freeride:'freeride', tour:'tour', panier:'panier',
    tables:'tables', pepin:'pepin', quiz:'quiz', telesiege:'telesiege', blocs:'blocs', paddock:'paddock', nuancier:'nuancier' };
  const chemin = location.pathname, fichier = chemin.split('/').pop().replace(/\.html$/, '');
  const JEU = /nivoculteur\//.test(chemin) ? 'nivo' : PAGES[fichier];
  if(!JEU) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const lire = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
  const MEDAILLES = ['🥇', '🥈', '🥉'];

  const css = document.createElement('style');
  css.textContent = `
.acj-b{ display:inline-flex; align-items:center; gap:5px; margin:0 0 0 8px; padding:6px 12px; border-radius:999px; border:1.5px solid rgba(255,200,60,.85); background:rgba(255,200,60,.16);
  color:inherit; font:700 .88rem system-ui, -apple-system, "Segoe UI", sans-serif; cursor:pointer; vertical-align:middle; white-space:nowrap; text-decoration:none; line-height:1.2; }
.acj-b:hover{ background:rgba(255,200,60,.3); }
@media (max-width:520px){ .acj-b .acj-txt{ display:none; } .acj-b{ padding:6px 10px; font-size:1rem; } }
.tete{ flex-wrap:wrap; row-gap:6px; }
.acj-f{ position:fixed; inset:0; z-index:2147482000; background:rgba(6,10,20,.72); display:flex; align-items:flex-start; justify-content:center; overflow:auto;
  padding:calc(14px + max(env(safe-area-inset-top, 0px), 0px)) 12px calc(20px + env(safe-area-inset-bottom, 0px)); font:15px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color:#F2F4F8; }
@media (pointer:coarse){ .acj-f{ padding-top:calc(14px + max(env(safe-area-inset-top, 0px), 44px)); } }
.acj-f[hidden]{ display:none; }
.acj-p{ width:min(100%, 560px); background:#151A26; border:1px solid rgba(255,255,255,.14); border-radius:18px; box-shadow:0 18px 50px rgba(0,0,0,.5); overflow:hidden; }
.acj-t{ display:flex; align-items:center; gap:8px; padding:12px 14px; background:linear-gradient(90deg, #2A2140, #1B2540); border-bottom:1px solid rgba(255,255,255,.1); }
.acj-t h2{ margin:0; font-size:1.15rem; font-weight:800; line-height:1.15; }
.acj-t h2 small{ display:block; font-weight:600; font-size:.78rem; color:#A9B3C8; }
.acj-t button{ margin-left:auto; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.08); color:#fff; border-radius:10px; padding:6px 10px; font:700 .9rem system-ui; cursor:pointer; }
.acj-t button + button{ margin-left:0; }
.acj-c{ padding:12px 14px 16px; display:flex; flex-direction:column; gap:12px; }
.acj-m{ margin:0; color:#C9D2E3; font-size:.9rem; background:rgba(255,255,255,.05); border-radius:10px; padding:9px 11px; }
.acj-e{ background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:12px; padding:9px 11px; }
.acj-e h3{ margin:0 0 6px; font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; color:#FFD166; font-weight:800; }
.acj-e ol{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; }
.acj-e li{ display:grid; grid-template-columns:30px 1fr auto; gap:8px; align-items:center; padding:4px 6px; border-radius:8px; }
.acj-e li.moi{ background:rgba(255,209,102,.16); font-weight:700; }
.acj-e li .r{ text-align:center; } .acj-e li .v{ font-variant-numeric:tabular-nums; font-weight:700; white-space:nowrap; }
.acj-tab{ overflow-x:auto; } .acj-tab table{ border-collapse:collapse; width:100%; font-size:.86rem; }
.acj-tab th, .acj-tab td{ padding:5px 7px; border-bottom:1px solid rgba(255,255,255,.08); text-align:right; white-space:nowrap; }
.acj-tab th:first-child, .acj-tab td:first-child{ text-align:left; white-space:normal; }
.acj-tab th.moi{ color:#FFD166; } .acj-tab td.mieux{ color:#FFD166; font-weight:800; }
.acj-h{ font-size:.78rem; text-transform:uppercase; letter-spacing:.1em; color:#A9B3C8; font-weight:800; margin:4px 0 -4px; }
.acj-l{ color:#9FD0FF; font-weight:700; text-decoration:none; font-size:.9rem; align-self:flex-start; }`;
  document.head.appendChild(css);

  // la fenêtre
  const f = document.createElement('div'); f.className = 'acj-f'; f.hidden = true;
  f.innerHTML = '<div class="acj-p" role="dialog" aria-label="Classement du jeu"><div class="acj-t"><h2>🏆 Classement<small></small></h2><button class="acj-maj" type="button">↻</button><button class="acj-x" type="button" aria-label="Fermer">✕</button></div><div class="acj-c"></div></div>';
  const corps = f.querySelector('.acj-c'), sous = f.querySelector('h2 small');
  f.addEventListener('click', e => { if(e.target === f) fermer(); });
  f.querySelector('.acj-x').onclick = () => fermer();
  f.querySelector('.acj-maj').onclick = () => charger(true);
  // pendant que la fenêtre est ouverte, le clavier ne commande pas le jeu
  addEventListener('keydown', e => { if(f.hidden) return; e.stopImmediatePropagation(); if(e.key === 'Escape') fermer(); }, true);
  ['pointerdown', 'touchstart'].forEach(t => f.addEventListener(t, e => e.stopPropagation()));

  function chargerScores(){
    if(window.AltitudeScores) return Promise.resolve();
    return new Promise(ok => { const s = document.createElement('script'); s.src = base + 'scores.js'; s.onload = s.onerror = () => ok(); document.head.appendChild(s); });
  }
  const moi = () => { const C = window.AltitudeCompte; return C && C.session() ? C.session().pseudo : ''; };
  const trier = l => l.sort((a, b) => (b.e.v - a.e.v) * (a.e.s || 1));

  function afficher(joueurs, info){
    const pseudo = moi(), J = { ...joueurs };
    try{ if(window.AltitudeScores) J[pseudo || 'Toi'] = AltitudeScores.calculer(pseudo); }catch(e){}
    const noms = Object.keys(J).filter(p => J[p] && J[p][JEU]);
    const titre = noms.length ? J[noms[0]][JEU].titre : '';
    sous.textContent = titre ? `${titre} · ${noms.length} joueur${noms.length > 1 ? 's' : ''}` : '';
    let h = info ? `<p class="acj-m">${esc(info)}</p>` : '';
    if(!noms.length){ corps.innerHTML = h + '<p class="acj-m">Pas encore de score dans ce jeu : joue une partie, et ton score apparaîtra ici !</p>' + lien(); return; }
    // les épreuves
    const ep = {};
    for(const p of noms) for(const [k, e] of Object.entries(J[p][JEU].epreuves || {})) (ep[k] = ep[k] || { n:e.n, l:[] }).l.push({ p, e });
    Object.values(ep).forEach(x => trier(x.l));
    const cles = Object.keys(ep).sort((a, b) => ep[b].l.length - ep[a].l.length || ep[a].n.localeCompare(ep[b].n, 'fr'));
    const nomMoi = pseudo || 'Toi';
    h += '<p class="acj-h">Meilleurs scores</p>' + cles.map(k => `<div class="acj-e"><h3>${esc(ep[k].n)}</h3><ol>` +
      ep[k].l.map((y, r) => `<li class="${y.p === nomMoi ? 'moi' : ''}"><span class="r">${MEDAILLES[r] || r + 1}</span><span>${esc(y.p)}</span><span class="v">${esc(y.e.a)}</span></li>`).join('') + '</ol></div>').join('');
    // les statistiques
    const libelles = [...new Set(noms.flatMap(p => Object.keys(J[p][JEU].stats || {})))];
    if(libelles.length){
      const nombre = v => typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
      h += '<p class="acj-h">Statistiques</p><div class="acj-tab"><table><thead><tr><th></th>' + noms.map(p => `<th class="${p === nomMoi ? 'moi' : ''}">${esc(p)}</th>`).join('') + '</tr></thead><tbody>' +
        libelles.map(l => { const vals = noms.map(p => (J[p][JEU].stats || {})[l]), nums = vals.map(nombre), max = Math.max(...nums.filter(n => isFinite(n)));
          return `<tr><td>${esc(l)}</td>` + vals.map((v, i) => `<td class="${noms.length > 1 && isFinite(nums[i]) && nums[i] === max && max > 0 ? 'mieux' : ''}">${v == null ? '—' : esc(typeof v === 'number' ? v.toLocaleString('fr-FR') : v)}</td>`).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    corps.innerHTML = h + lien();
  }
  const lien = () => `<a class="acj-l" href="${base}classement.html">Le classement de tous les jeux →</a>`;

  async function charger(forcer = false){
    await chargerScores();
    const C = window.AltitudeCompte;
    if(!C || !C.actif()){ afficher({}, 'La sauvegarde en ligne n\'est pas configurée : seuls tes scores sur cet appareil sont affichés.'); return; }
    if(!C.session()){ afficher({}, 'Connecte-toi sur l\'accueil d\'Altitude Arcade (pseudo et code) pour te comparer aux autres joueurs. Voici tes scores sur cet appareil.'); return; }
    // d'abord le dernier classement gardé, tout de suite ; puis le classement à jour
    const garde = lire('compte-classement', null);
    if(garde && !forcer) afficher(garde.joueurs || {}, 'Mise à jour…');
    else corps.innerHTML = '<p class="acj-m">Chargement du classement…</p>';
    try{
      try{ await C.synchroniser({ envoyerSeulement:true, scores:AltitudeScores.calculer(C.session().pseudo) }); }catch(e){}
      const d = await C.classement();
      const quand = new Date(d.heure).toLocaleString('fr-FR', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
      afficher(d.joueurs || {}, d.frais ? `Mis à jour le ${quand}.` : `${d.erreur} Dernier classement reçu le ${quand}.`);
    }catch(e){ afficher(garde ? garde.joueurs || {} : {}, e.message); }
  }
  function ouvrir(){ if(!f.isConnected) document.body.appendChild(f); f.hidden = false; charger(); }
  function fermer(){ f.hidden = true; }

  // le bouton, à côté du lien vers l'accueil (dans le menu du jeu)
  function poser(){
    const liens = [...document.querySelectorAll('a[href$="index.html"]')].filter(a => !a.closest('#haut') && !a.closest('.acj-f') && !/classement/.test(a.href));
    const a = document.querySelector('[data-classement-ici]') || liens[0];
    if(!a || a.nextElementSibling && a.nextElementSibling.classList.contains('acj-b')) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'acj-b'; b.innerHTML = '🏆<span class="acj-txt"> Classement</span>'; b.setAttribute('aria-label', 'Classement'); b.title = 'Le classement de tous les joueurs pour ce jeu';
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); ouvrir(); };
    a.insertAdjacentElement('afterend', b);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser); else poser();
  window.AltitudeClassementJeu = { ouvrir, fermer, jeu:JEU };
})();
