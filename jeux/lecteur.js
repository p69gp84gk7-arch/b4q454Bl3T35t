/* Altitude Arcade : lecteur de dés à la caméra, pour jouer au Yam's et au 10 000 avec de vrais dés.
   Utilisation : <script src="des-vision.js"></script><script src="lecteur.js" data-jeu="yams"></script> (ou data-jeu="10000"),
   après ia.js (conseils) et la page du jeu (window.plateauJeu : la feuille de score).
   - La caméra filme le plateau en continu : le plateau est repéré (contour vert), chaque dé est encadré avec sa valeur.
     Quand les dés ne bougent plus pendant un instant, la lecture compte comme un lancer.
   - Les dés posés hors du plateau ne sont pas lus : au Yam's ce sont les dés gardés, au 10 000 ceux mis de côté.
   - Yam's : le numéro du lancer se compte tout seul (corrigeable), les dés à garder sont encadrés en jaune, avec les chances
     de chaque figure et la case conseillée ; un toucher note le score dans la feuille.
   - 10 000 : les points du lancer, les dés à mettre de côté (en jaune), les chances de marquer encore en relançant,
     le conseil relancer ou garder ; un toucher ajoute les points au tour ou note le tour.
   - Toucher un dé (l'image se fige) permet de corriger sa valeur ; toucher ailleurs sur l'image figée ajoute un dé oublié.
   Expose window.lecteurDes = { ouvrir, fermer, lirePhoto }. */
(() => {
  'use strict';
  const JEU = document.currentScript && document.currentScript.dataset.jeu === 'yams' ? 'yams' : '10000';
  const V = window.DesVision;
  if(!V) return;
  const FACES = ['?', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  const pct = p => p >= .995 ? '100 %' : p < .01 ? '< 1 %' : Math.round(p * 100) + ' %';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const jeu = () => window.plateauJeu || null;
  const PETITE = 480, GRANDE = 1280;                 // largeur des images analysées (repérage, puis lecture des points)

  /* ---------- Styles ---------- */
  const css = `
.lc-fab{ position:fixed; left:16px; bottom:calc(16px + env(safe-area-inset-bottom,0px)); z-index:9; display:flex; align-items:center; gap:8px;
  padding:12px 16px; border:0; border-radius:999px; background:#1F3A5F; color:#fff; font:inherit; font-weight:700; font-size:1rem; cursor:pointer; box-shadow:0 8px 20px rgba(0,0,0,.3); }
.lc-ov{ position:fixed; inset:0; z-index:70; display:flex; flex-direction:column; background:#0E1116; color:#F2F4F8; font-family:inherit;
  padding:calc(8px + var(--barre-statut, env(safe-area-inset-top,0px))) 10px calc(8px + env(safe-area-inset-bottom,0px)); gap:8px; }
.lc-ov[hidden]{ display:none; }
.lc-haut{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.lc-haut h2{ margin:0; font-size:1.05rem; flex:1 1 auto; }
.lc-haut button, .lc-haut label{ border:1.5px solid rgba(242,244,248,.3); background:transparent; color:inherit; font:inherit; font-weight:700; font-size:.85rem;
  padding:7px 11px; border-radius:999px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; }
.lc-haut button[aria-pressed="true"]{ background:#E9B949; color:#1A1A1A; border-color:#E9B949; }
.lc-haut input, .lc-haut [hidden]{ display:none; }
.lc-corps{ flex:1 1 auto; min-height:0; display:flex; flex-direction:column; gap:8px; }
.lc-vue{ position:relative; flex:1 1 auto; min-height:140px; background:#000; border-radius:14px; overflow:hidden; }
.lc-vue video, .lc-vue canvas{ position:absolute; inset:0; width:100%; height:100%; }
.lc-vue video{ object-fit:contain; }
.lc-vue canvas{ touch-action:none; }
.lc-etat{ position:absolute; left:8px; right:8px; top:8px; margin:0; padding:6px 10px; border-radius:10px; background:rgba(0,0,0,.55); font-size:.85rem; font-weight:700; pointer-events:none; }
.lc-etat:empty{ display:none; }
.lc-panneau{ flex:0 1 auto; max-height:48%; overflow:auto; display:flex; flex-direction:column; gap:8px; background:#171C24; border-radius:14px; padding:10px 12px; font-size:.92rem; }
@media (orientation:landscape) and (min-width:640px){
  .lc-corps{ flex-direction:row; }
  .lc-panneau{ max-height:none; width:min(420px, 44%); flex:0 0 auto; }
}
.lc-ligne{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.lc-ligne select{ font:inherit; font-weight:700; padding:6px 8px; border-radius:10px; border:0; }
.lc-cpt{ display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,.08); border-radius:999px; padding:2px; }
.lc-cpt button{ width:30px; height:30px; border-radius:50%; border:0; background:rgba(255,255,255,.12); color:inherit; font:inherit; font-weight:800; cursor:pointer; }
.lc-cpt b{ padding:0 6px; }
.lc-main{ display:flex; gap:6px; flex-wrap:wrap; padding-bottom:14px; }
.lc-de{ position:relative; width:46px; height:46px; border-radius:10px; border:2px solid rgba(255,255,255,.25); background:#F7F3E8; color:#1A1A1A;
  font-size:2.1rem; line-height:40px; text-align:center; cursor:pointer; padding:0; }
.lc-de.garde{ background:#C9CED6; }
.lc-de.choisi{ box-shadow:0 0 0 3px #FFE066, 0 0 12px 2px rgba(255,224,102,.7); border-color:#FFE066; }
.lc-de small{ position:absolute; left:50%; top:100%; margin-top:1px; line-height:1.2; transform:translateX(-50%); font-size:.6rem; font-weight:800; color:#C9D2E3; white-space:nowrap; }
.lc-de.inconnu{ background:#F4C7C3; font-size:1.3rem; font-weight:800; }
.lc-conseil{ margin:6px 0 0; padding:8px 10px; border-radius:10px; background:rgba(255,224,102,.12); border:1.5px solid rgba(255,224,102,.5); line-height:1.4; }
.lc-conseil b{ color:#FFE066; }
.lc-pct{ display:inline-block; margin:2px 4px 0 0; padding:2px 7px; border-radius:999px; background:rgba(255,255,255,.1); font-size:.82rem; }
.lc-opts{ display:grid; grid-template-columns:repeat(auto-fill, minmax(118px, 1fr)); gap:6px; }
.lc-opt{ display:flex; justify-content:space-between; align-items:center; gap:6px; padding:8px 10px; border-radius:10px; border:1.5px solid rgba(255,255,255,.2);
  background:rgba(255,255,255,.06); color:inherit; font:inherit; font-weight:700; font-size:.85rem; cursor:pointer; text-align:left; }
.lc-opt.best{ border-color:#FFE066; background:rgba(255,224,102,.16); }
.lc-opt.best::before{ content:"★"; color:#FFE066; }
.lc-opt b{ font-size:1rem; }
.lc-btn{ padding:10px 12px; border-radius:12px; border:0; font:inherit; font-weight:800; cursor:pointer; background:#2E6FD8; color:#fff; text-align:center; }
.lc-btn.vert{ background:#1E9E5B; } .lc-btn.rouge{ background:#C8372D; } .lc-btn.gris{ background:rgba(255,255,255,.12); }
.lc-btn:disabled{ opacity:.45; cursor:default; }
.lc-ov details summary{ cursor:pointer; font-weight:700; color:#C9D2E3; margin:4px 0; }
.lc-aide{ color:#AEB8C9; font-size:.84rem; line-height:1.4; margin:0; }
.lc-choix{ position:absolute; z-index:3; background:#F7F3E8; color:#1A1A1A; border-radius:14px; padding:8px; box-shadow:0 10px 30px rgba(0,0,0,.5); display:flex; flex-direction:column; gap:6px; }
.lc-choix[hidden]{ display:none; }
.lc-choix .lc-faces{ display:flex; gap:4px; }
.lc-choix button{ border:0; border-radius:8px; background:#E4DED0; font:inherit; font-size:1.9rem; width:44px; height:44px; cursor:pointer; padding:0; }
.lc-choix .lc-suppr{ font-size:.85rem; font-weight:700; width:auto; height:auto; padding:7px; background:#F4C7C3; }
.lc-toast{ position:absolute; left:50%; bottom:12px; transform:translateX(-50%); background:#1E9E5B; color:#fff; font-weight:800; padding:8px 14px; border-radius:999px; pointer-events:none; white-space:nowrap; }
.lc-toast[hidden]{ display:none; }`;
  const st = document.createElement('style'); st.textContent = css; document.head.append(st);

  /* ---------- Les éléments ---------- */
  const fab = document.createElement('button');
  fab.className = 'lc-fab'; fab.innerHTML = '📷 Lire les dés'; fab.setAttribute('aria-label', 'Lire de vrais dés avec la caméra');
  const ov = document.createElement('div');
  ov.className = 'lc-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Lecteur de dés');
  ov.innerHTML = `<div class="lc-haut"><h2>📷 Lecteur de dés</h2>
      <button class="lc-figer" aria-pressed="false">⏸ Figer</button><button class="lc-camera" hidden>📐 Caméra</button><button class="lc-lampe" hidden aria-pressed="false">🔦</button>
      <button class="lc-partager" aria-label="Partager l'image" title="Partager l'image (pour signaler une mauvaise lecture)">📤</button>
      <label>🖼 Photo<input type="file" accept="image/*" class="lc-fichier"></label><button class="lc-fermer" aria-label="Fermer">✕</button></div>
    <div class="lc-corps"><div class="lc-vue"><video playsinline muted></video><canvas></canvas><p class="lc-etat"></p>
      <div class="lc-choix" hidden></div><div class="lc-toast" hidden></div></div>
      <div class="lc-panneau"></div></div>`;
  document.addEventListener('DOMContentLoaded', () => document.body.append(fab, ov));
  if(document.readyState !== 'loading') document.body.append(fab, ov);
  const q = s => ov.querySelector(s);
  const video = q('video'), dessin = q('canvas'), dg = dessin.getContext('2d'), etat = q('.lc-etat'), panneau = q('.lc-panneau'), choix = q('.lc-choix'), toast = q('.lc-toast');
  const petite = document.createElement('canvas'), pg = petite.getContext('2d', { willReadFrequently:true });
  const grande = document.createElement('canvas'), gg = grande.getContext('2d', { willReadFrequently:true });

  /* ---------- État ---------- */
  let flux = null, piste = null, ouvert = false, fige = false, photo = null, boucle = 0, dernierCalcul = 0;
  let brut = null;              // la dernière analyse (positions en direct)
  let lecture = null;           // le dernier lancer retenu : { des:[{cx,cy,cote,angle,v}], sig, source }
  let pile = [], vignette = null, bouge = false;
  // Yam's : le tour en cours
  const Y = { lancer:0, gardes:[], joueur:null, choix:[], fini:true, conseil:null, main:[] };
  // 10 000 : la sélection des dés à mettre de côté, et si le lancer a déjà été noté
  const D = { choix:[], fait:false };

  /* ---------- La caméra ---------- */
  // Les caméras arrière : on préfère la grand angle (le plateau entre plus facilement dans l'image) ;
  // le bouton 📐 passe à la suivante, et le choix est gardé
  let cameras = [], camera = null;
  const lireChoix = () => { try{ return localStorage.getItem('lecteur-camera') || ''; }catch(e){ return ''; } };
  const nomCamera = c => /ultra|grand.?angle|0[.,]5/i.test(c.label) ? 'Grand angle' : /t[ée]l[ée]|tele/i.test(c.label) ? 'Téléobjectif' : /wide|grand/i.test(c.label) ? 'Grand angle' : 'Caméra ' + (cameras.indexOf(c) + 1);
  async function listerCameras(){
    try{
      const l = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const arriere = l.filter(d => !/front|avant|user|facetime/i.test(d.label));
      cameras = arriere.length ? arriere : l;
    }catch(e){ cameras = []; }
    q('.lc-camera').hidden = cameras.length < 2;
  }
  async function demarrerCamera(id){
    if(flux && !id) return true;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ etat.textContent = 'Pas de caméra ici : utilisez 🖼 Photo.'; return false; }
    if(flux) arreterCamera();
    try{
      const v = { width:{ ideal:1920 }, height:{ ideal:1080 } };
      if(id) v.deviceId = { exact:id }; else v.facingMode = { ideal:'environment' };
      flux = await navigator.mediaDevices.getUserMedia({ audio:false, video:v });
    }catch(e){ if(id){ try{ localStorage.removeItem('lecteur-camera'); }catch(err){} return demarrerCamera(); } etat.textContent = 'La caméra n\'est pas autorisée : autorisez-la dans les réglages du navigateur, ou utilisez 🖼 Photo.'; return false; }
    video.srcObject = flux; await video.play().catch(() => {});
    piste = flux.getVideoTracks()[0];
    const cap = piste && piste.getCapabilities ? piste.getCapabilities() : {};
    q('.lc-lampe').hidden = !cap.torch;
    // certains téléphones donnent le grand angle par le zoom (0,5×)
    if(cap.zoom && cap.zoom.min < 1){ try{ await piste.applyConstraints({ advanced:[{ zoom:cap.zoom.min }] }); }catch(e){} }
    camera = (piste.getSettings && piste.getSettings().deviceId) || null;
    // la première fois : les noms des caméras ne sont connus qu'une fois la caméra autorisée ; on passe à la grand angle
    if(!cameras.length){
      await listerCameras();
      const garde = lireChoix(), gr = cameras.find(c => nomCamera(c) === 'Grand angle');
      const voulue = cameras.find(c => c.deviceId === garde) || gr;
      if(!id && voulue && voulue.deviceId !== camera) return demarrerCamera(voulue.deviceId);
    }
    const c = cameras.find(x => x.deviceId === camera); q('.lc-camera').textContent = '📐 ' + (c ? nomCamera(c) : 'Caméra');
    memo = {};
    return true;
  }
  q('.lc-camera').onclick = async () => {
    if(cameras.length < 2) return;
    const i = cameras.findIndex(c => c.deviceId === camera), suiv = cameras[(i + 1) % cameras.length];
    try{ localStorage.setItem('lecteur-camera', suiv.deviceId); }catch(e){}
    etat.textContent = 'Changement de caméra…'; await demarrerCamera(suiv.deviceId);
  };
  function arreterCamera(){ if(flux) flux.getTracks().forEach(t => t.stop()); flux = null; piste = null; video.srcObject = null; }
  q('.lc-lampe').onclick = async e => { const b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true'; try{ await piste.applyConstraints({ advanced:[{ torch:on }] }); b.setAttribute('aria-pressed', String(on)); }catch(err){} };

  async function ouvrir(){
    ouvert = true; ov.hidden = false; photo = null; fige = false; majFiger();
    etat.textContent = 'Démarrage de la caméra…';
    if(JEU === 'yams' && Y.joueur == null && jeu()) Y.joueur = jeu().nextPlayer();
    afficherPanneau();
    if(await demarrerCamera()){ etat.textContent = 'Visez le plateau d\'en haut, les dés bien éclairés.'; }
    cancelAnimationFrame(boucle); boucle = requestAnimationFrame(tour);
  }
  function fermer(){ ouvert = false; ov.hidden = true; arreterCamera(); cancelAnimationFrame(boucle); choix.hidden = true; }
  fab.onclick = ouvrir;
  q('.lc-fermer').onclick = fermer;
  function majFiger(){ const b = q('.lc-figer'); b.setAttribute('aria-pressed', String(fige)); b.textContent = fige ? '▶ Reprendre' : '⏸ Figer'; }
  q('.lc-figer').onclick = () => { fige = !fige; if(!fige){ photo = null; choix.hidden = true; if(flux) video.play().catch(() => {}); pile = []; } else video.pause(); majFiger(); dessiner(); };

  /* ---------- Partager l'image (pour signaler une mauvaise lecture) ---------- */
  q('.lc-partager').onclick = () => {
    const src = photo || video, w = photo ? photo.naturalWidth : video.videoWidth, h = photo ? photo.naturalHeight : video.videoHeight;
    if(!w) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h);
    c.toBlob(async b => {
      const f = new File([b], `des-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`, { type:'image/jpeg' });
      if(navigator.canShare && navigator.canShare({ files:[f] })){ try{ await navigator.share({ files:[f], title:'Dés mal lus' }); return; }catch(e){ if(e.name === 'AbortError') return; } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = f.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/jpeg', .92);
  };

  /* ---------- L'analyse, à part (worker) : l'image reste fluide ---------- */
  let travail = null, enCours = false, memo = {}, idCalcul = 0, attente = null;
  try{
    const base = (document.currentScript && document.currentScript.src) || location.href;
    travail = new Worker(new URL('des-vision.js' + (base.split('?')[1] ? '?' + base.split('?')[1] : ''), base));
    travail.onmessage = e => { if(e.data.id !== idCalcul || !attente) return; const a = attente; attente = null; enCours = false; finir(e.data.res, a); };
    travail.onerror = () => { travail = null; enCours = false; };
  }catch(e){ travail = null; }
  function tour(t){
    if(!ouvert) return;
    boucle = requestAnimationFrame(tour);
    if(fige || !flux || video.readyState < 2 || enCours || t - dernierCalcul < 90){ return; }
    dernierCalcul = t;
    analyserSource(video, video.videoWidth, video.videoHeight, false);
  }
  // la finesse de l'image fine : juste assez pour que les points fassent environ 5 pixels de rayon
  function largeurFine(w){
    if(!memo.rSource) return Math.min(GRANDE, w);
    return Math.round(Math.max(640, Math.min(GRANDE, w, w * 5.5 / memo.rSource)));
  }
  function analyserSource(src, w, h, estPhoto){
    if(!w || !h) return;
    petite.width = PETITE; petite.height = Math.round(PETITE * h / w);
    pg.drawImage(src, 0, 0, petite.width, petite.height);
    const img = pg.getImageData(0, 0, petite.width, petite.height);
    // les dés bougent encore ?
    const vg = V.vignette(img), mvt = V.ecart(vg, vignette); vignette = vg;
    bouge = !estPhoto && mvt > 12;          // un téléphone tenu à la main bouge un peu : seuls les dés qui roulent comptent
    if(bouge){ pile = []; etat.textContent = 'Les dés roulent…'; dessiner(); return; }
    const L = estPhoto ? Math.min(GRANDE, w) : largeurFine(w);
    grande.width = L; grande.height = Math.round(L * h / w);
    gg.drawImage(src, 0, 0, grande.width, grande.height);
    const gr = gg.getImageData(0, 0, grande.width, grande.height);
    const m = memo.rSource && !estPhoto ? { r:memo.rSource * L / w } : {};
    const a = { w, L, estPhoto, pw:petite.width, ph:petite.height };
    if(travail && !estPhoto){
      enCours = true; attente = a; idCalcul++;
      travail.postMessage({ id:idCalcul, petite:img, grande:gr, memo:m }, [img.data.buffer, gr.data.buffer]);
    } else finir(V.analyser(img, gr, m), a);
  }
  function finir(r, a){
    if(!ouvert || (fige && !a.estPhoto)) return;
    r.w = a.pw; r.h = a.ph; brut = r;
    if(r.rPoint) memo.rSource = r.rPoint * a.w / a.L;          // le rayon des points, en pixels de la caméra
    else if(!r.des.length) memo = {};
    const sig = r.des.length + ':' + r.des.map(d => d.v || 0).sort().join('');
    etat.textContent = r.message || `${r.des.length} dé${r.des.length > 1 ? 's' : ''}${r.plateau ? ' sur le plateau' : ''}${r.hors && r.hors.length ? ` · ${r.hors.length} à côté` : ''}.`;
    if(a.estPhoto){ retenir(r, sig); return; }
    // une lecture est retenue quand elle reste la même pendant 3 analyses de suite
    pile.push(sig); if(pile.length > 3) pile.shift();
    if(r.des.length && pile.length === 3 && pile.every(s => s === sig) && (!lecture || lecture.sig !== sig)) retenir(r, sig);
    else if(lecture && lecture.sig === sig) lecture.des.forEach((d, i) => { const b = r.des[i]; if(b){ d.cx = b.cx; d.cy = b.cy; d.angle = b.angle; d.cote = b.cote; } });
    dessiner();
  }
  // Un nouveau lancer
  function retenir(r, sig){
    lecture = { des:r.des.map(d => ({ cx:d.cx, cy:d.cy, cote:d.cote, angle:d.angle, v:d.v })), hors:(r.hors || []).map(d => ({ ...d })), sig, w:r.w, h:r.h };
    if(navigator.vibrate) navigator.vibrate(15);
    if(JEU === 'yams') nouveauLancerYams(); else { D.fait = false; D.choix = []; }
    calculer(); afficherPanneau(); dessiner();
  }

  /* ---------- Photo prise ou choisie ---------- */
  function lirePhoto(fichier){
    const url = URL.createObjectURL(fichier), im = new Image();
    im.onload = () => {
      photo = im; fige = true; majFiger(); video.pause(); vignette = null;
      analyserSource(im, im.naturalWidth, im.naturalHeight, true);
      URL.revokeObjectURL(url);
    };
    im.src = url;
  }
  q('.lc-fichier').onchange = e => { const f = e.target.files && e.target.files[0]; if(f){ if(!ouvert){ ouvert = true; ov.hidden = false; afficherPanneau(); } lirePhoto(f); } e.target.value = ''; };

  /* ---------- Le dessin : contour du plateau, cadres des dés ---------- */
  // le rectangle où l'image est montrée (comme object-fit: contain)
  function cadreImage(){
    const W = dessin.clientWidth, H = dessin.clientHeight, iw = photo ? photo.naturalWidth : video.videoWidth || 16, ih = photo ? photo.naturalHeight : video.videoHeight || 9;
    const k = Math.min(W / iw, H / ih); return { x:(W - iw * k) / 2, y:(H - ih * k) / 2, w:iw * k, h:ih * k, W, H };
  }
  function dessiner(){
    const dpr = window.devicePixelRatio || 1, W = dessin.clientWidth, H = dessin.clientHeight;
    if(dessin.width !== Math.round(W * dpr) || dessin.height !== Math.round(H * dpr)){ dessin.width = Math.round(W * dpr); dessin.height = Math.round(H * dpr); }
    dg.setTransform(dpr, 0, 0, dpr, 0, 0); dg.clearRect(0, 0, W, H);
    const c = cadreImage();
    if(photo) dg.drawImage(photo, c.x, c.y, c.w, c.h);
    const r = brut; if(!r) return;
    const k = c.w / r.w, X = x => c.x + x * k, Yy = y => c.y + y * k;
    if(r.plateau){
      dg.save(); dg.setLineDash([10, 7]); dg.lineWidth = 2.5; dg.strokeStyle = 'rgba(80,230,140,.9)'; dg.beginPath();
      r.plateau.contour.forEach((p, i) => i ? dg.lineTo(X(p[0]), Yy(p[1])) : dg.moveTo(X(p[0]), Yy(p[1]))); dg.closePath(); dg.stroke(); dg.restore();
    }
    const des = lecture && (fige || lecture.sig === sigDe(r)) ? lecture.des : r.des.map(d => ({ ...d }));
    // les dés posés hors du plateau (gardés, ou mis de côté) : cadre pointillé bleu
    const hors = lecture && (fige || lecture.sig === sigDe(r)) ? lecture.hors : r.hors || [];
    hors.forEach(d => {
      const s = d.cote * k * 1.08;
      dg.save(); dg.translate(X(d.cx), Yy(d.cy)); dg.rotate(d.angle || 0); dg.setLineDash([6, 5]); dg.lineWidth = 2.5; dg.strokeStyle = '#7FB2FF';
      dg.beginPath(); dg.roundRect ? dg.roundRect(-s / 2, -s / 2, s, s, s * .18) : dg.rect(-s / 2, -s / 2, s, s); dg.stroke(); dg.restore();
      const tx = X(d.cx), ty = Yy(d.cy) - s / 2 - 11;
      dg.fillStyle = '#7FB2FF'; dg.beginPath(); dg.arc(tx, ty, 9, 0, Math.PI * 2); dg.fill();
      dg.fillStyle = '#0E1116'; dg.font = 'bold 12px system-ui, sans-serif'; dg.textAlign = 'center'; dg.textBaseline = 'middle'; dg.fillText(d.v, tx, ty + 1);
    });
    const jaunes = desJaunes(des);
    des.forEach((d, i) => {
      const s = d.cote * k * 1.08;
      dg.save(); dg.translate(X(d.cx), Yy(d.cy)); dg.rotate(d.angle || 0);
      dg.lineWidth = jaunes.has(i) ? 4.5 : 2.5;
      dg.strokeStyle = !d.v ? '#FF5A4E' : jaunes.has(i) ? '#FFE066' : 'rgba(255,255,255,.9)';
      if(jaunes.has(i)){ dg.shadowColor = 'rgba(255,224,102,.9)'; dg.shadowBlur = 12; }
      dg.beginPath(); dg.roundRect ? dg.roundRect(-s / 2, -s / 2, s, s, s * .18) : dg.rect(-s / 2, -s / 2, s, s); dg.stroke();
      dg.restore();
      // l'étiquette : la valeur lue
      const tx = X(d.cx), ty = Yy(d.cy) - s / 2 - 13;
      dg.fillStyle = !d.v ? '#FF5A4E' : jaunes.has(i) ? '#FFE066' : 'rgba(20,24,32,.85)';
      dg.beginPath(); dg.arc(tx, ty, 11, 0, Math.PI * 2); dg.fill();
      dg.fillStyle = !d.v || jaunes.has(i) ? '#1A1A1A' : '#fff'; dg.font = 'bold 14px system-ui, sans-serif'; dg.textAlign = 'center'; dg.textBaseline = 'middle';
      dg.fillText(d.v || '?', tx, ty + 1);
    });
  }
  const sigDe = r => r.des.length + ':' + r.des.map(d => d.v || 0).sort().join('');
  // les dés du plateau à encadrer en jaune : à garder (Yam's) ou à mettre de côté (10 000)
  function desJaunes(des){
    const out = new Set();
    if(!lecture || des !== lecture.des) return out;
    if(JEU === 'yams'){
      const n = Y.gardes.length;
      Y.choix.forEach((on, i) => { if(on && i >= n) out.add(i - n); });
    } else D.choix.forEach((on, i) => { if(on) out.add(i); });
    return out;
  }
  addEventListener('resize', () => { if(ouvert) dessiner(); });

  /* ---------- Corriger au doigt ---------- */
  dessin.addEventListener('pointerdown', e => {
    if(!brut || !lecture) return;
    const rect = dessin.getBoundingClientRect(), c = cadreImage(), k = c.w / lecture.w;
    const x = (e.clientX - rect.left - c.x) / k, y = (e.clientY - rect.top - c.y) / k;
    let i = lecture.des.findIndex(d => Math.hypot(d.cx - x, d.cy - y) < d.cote * .75);
    if(i < 0 && !fige) return;
    if(!fige){ fige = true; video.pause(); majFiger(); }
    ouvrirChoix(e.clientX - rect.left, e.clientY - rect.top, i, x, y);
  });
  function ouvrirChoix(px, py, i, x, y){
    const d = lecture.des[i];
    choix.innerHTML = `<div class="lc-faces">${[1, 2, 3, 4, 5, 6].map(v => `<button data-v="${v}" aria-label="${v}">${FACES[v]}</button>`).join('')}</div>` +
      (d ? '<button class="lc-suppr" data-v="0">Ce n\'est pas un dé</button>' : '<button class="lc-suppr" data-v="-1">Annuler</button>');
    choix.hidden = false;
    const W = dessin.clientWidth, H = dessin.clientHeight;
    choix.style.left = Math.max(4, Math.min(W - choix.offsetWidth - 4, px - choix.offsetWidth / 2)) + 'px';
    choix.style.top = Math.max(4, Math.min(H - choix.offsetHeight - 4, py + 24)) + 'px';
    choix.onclick = e => {
      const b = e.target.closest('button'); if(!b) return;
      const v = +b.dataset.v; choix.hidden = true;
      if(v < 0) return;
      if(d){ if(v === 0) lecture.des.splice(i, 1); else d.v = v; }
      else { const cote = lecture.des.length ? lecture.des.reduce((s, x) => s + x.cote, 0) / lecture.des.length : lecture.w / 12; lecture.des.push({ cx:x, cy:y, cote, angle:0, v }); }
      if(JEU === 'yams') majMainYams(); else { D.choix = []; D.fait = false; }
      calculer(); afficherPanneau(); dessiner();
    };
  }

  /* ---------- Yam's ---------- */
  function nouveauLancerYams(){
    const k = lecture.des.length;
    if(Y.fini || Y.lancer === 0 || Y.lancer >= 3){
      // un nouveau tour : le joueur suivant
      Y.lancer = 1; Y.gardes = []; Y.fini = false;
      if(jeu()) Y.joueur = jeu().nextPlayer();
    } else {
      Y.lancer++;
      // les dés gardés : ceux qu'on voit posés hors du plateau, s'il y en a juste assez ;
      // sinon ceux qu'on avait choisis (en jaune) au lancer d'avant, autant qu'il en manque sur le plateau
      const manque = Math.max(0, 5 - k), vus = lecture.hors.map(d => d.v);
      if(manque && vus.length === manque) Y.gardes = vus;
      else {
        const avant = Y.main.slice(), choisis = avant.filter((_, i) => Y.choix[i]), autres = avant.filter((_, i) => !Y.choix[i]);
        Y.gardes = [...choisis, ...autres].slice(0, manque);
      }
    }
    majMainYams();
  }
  function majMainYams(){ Y.main = [...Y.gardes, ...lecture.des.map(d => d.v)].slice(0, 5); Y.choix = []; }
  function changerLancer(d){ Y.lancer = Math.max(1, Math.min(3, Y.lancer + d)); calculer(); afficherPanneau(); dessiner(); }

  /* ---------- 10 000 : les chances de marquer en relançant n dés (calcul exact) ---------- */
  const REUSSITE = [0];
  for(let n = 1; n <= 5; n++){
    let ok = 0, tot = 0;
    const rec = (d) => { if(d.length === n){ tot++; if(window.DixMilleIA && DixMilleIA.score(d, false).pts > 0) ok++; return; } for(let f = 1; f <= 6; f++) rec([...d, f]); };
    rec([]); REUSSITE.push(tot ? ok / tot : 0);
  }

  /* ---------- Les conseils ---------- */
  function calculer(){
    if(!lecture) return;
    if(JEU === 'yams'){
      Y.conseil = null;
      const j = jeu(), complet = Y.main.length === 5 && Y.main.every(Boolean);
      if(complet && j && window.YamsIA && Y.joueur != null){
        const e = j.etat(Y.joueur);
        if(e.ouvertes.length) Y.conseil = YamsIA.conseil(Y.main, 3 - Y.lancer, e.ouvertes, e.haut);
      }
      // les dés à garder conseillés, en jaune : d'abord ceux déjà gardés, puis ceux du plateau
      if(!Y.choix.length && Y.conseil && Y.lancer < 3 && Y.conseil.garde.length < 5){
        const reste = Y.conseil.garde.slice(); Y.choix = Y.main.map(() => false);
        Y.main.forEach((v, i) => { if(i < Y.gardes.length){ const k = reste.indexOf(v); if(k >= 0){ reste.splice(k, 1); Y.choix[i] = true; } } });
        Y.main.forEach((v, i) => { if(i >= Y.gardes.length && !Y.choix[i]){ const k = reste.indexOf(v); if(k >= 0){ reste.splice(k, 1); Y.choix[i] = true; } } });
      }
    } else {
      const vals = lecture.des.map(d => d.v);
      if(!D.choix.length && vals.every(Boolean) && window.DixMilleIA){
        const j = jeu(), premier = j ? j.firstRoll() : true, besoin = j && j.score ? 10000 - j.score() - j.turnPts() : Infinity;
        const idx = DixMilleIA.deCote(vals, premier, 'fort', besoin);
        D.choix = vals.map((_, i) => idx.includes(i));
      }
    }
  }

  /* ---------- Le panneau ---------- */
  function afficherPanneau(){
    const j = jeu();
    if(!lecture){
      panneau.innerHTML = `<p class="lc-aide">Posez les dés sur le plateau et tenez le téléphone au-dessus : le plateau est entouré en vert, chaque dé encadré avec sa valeur.
        ${JEU === 'yams' ? 'Les dés que vous gardez se posent <b>hors du plateau</b> : le lecteur sait alors qu\'ils sont gardés.' : 'Les dés mis de côté se posent <b>hors du plateau</b>.'}
        Un dé mal lu ? Touchez-le pour corriger sa valeur.</p>`;
      return;
    }
    const inconnus = lecture.des.filter(d => !d.v).length;
    if(JEU === 'yams') panneauYams(j, inconnus); else panneau10000(j, inconnus);
    panneau.querySelectorAll('[data-act]').forEach(b => b.onclick = () => action(b.dataset.act, b));
  }
  function puce(v, cls, legende, i){ return `<button class="lc-de ${v ? '' : 'inconnu'} ${cls}" data-i="${i}" aria-label="${v || 'inconnu'}">${v ? FACES[v] : '?'}${legende ? `<small>${legende}</small>` : ''}</button>`; }

  function panneauYams(j, inconnus){
    let h = '';
    const noms = j ? j.players() : [];
    h += `<div class="lc-ligne">${noms.length ? `<select class="lc-joueur" aria-label="Joueur">${noms.map((n, i) => `<option value="${i}"${i === Y.joueur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
      <span class="lc-cpt"><button data-act="moins" aria-label="Lancer précédent">−</button><b>Lancer ${Y.lancer} / 3</b><button data-act="plus" aria-label="Lancer suivant">+</button></span>
      <button class="lc-btn gris" data-act="tour">Nouveau tour</button></div>`;
    h += `<div class="lc-main">${Y.main.map((v, i) => puce(v, (i < Y.gardes.length ? 'garde ' : '') + (Y.choix[i] ? 'choisi' : ''), i < Y.gardes.length ? 'gardé' : Y.choix[i] ? 'garder' : '', i)).join('')}</div>`;
    if(lecture.des.length + Y.gardes.length !== 5) h += `<p class="lc-aide">⚠️ Je vois ${lecture.des.length} dé${lecture.des.length > 1 ? 's' : ''} sur le plateau${Y.gardes.length ? ` et ${Y.gardes.length} gardé${Y.gardes.length > 1 ? 's' : ''}` : ''} : il en faut 5. Écartez les dés qui se touchent, ou touchez l'image pour ajouter un dé.</p>`;
    if(inconnus) h += `<p class="lc-aide">⚠️ ${inconnus} dé${inconnus > 1 ? 's' : ''} mal lu${inconnus > 1 ? 's' : ''} (en rouge) : touchez-le pour donner sa valeur.</p>`;
    const c = Y.conseil, complet = Y.main.length === 5 && Y.main.every(Boolean);
    if(complet){
      const somme = Y.main.reduce((a, b) => a + b, 0);
      if(c && Y.lancer < 3 && c.garde.length < 5){
        const n = 5 - c.garde.length, r = 3 - Y.lancer;
        h += `<p class="lc-conseil">💡 <b>Garder ${c.garde.length ? c.garde.map(v => FACES[v]).join(' ') : 'aucun dé'}</b> (encadrés en jaune) et relancer ${n} dé${n > 1 ? 's' : ''} (${r} lancer${r > 1 ? 's' : ''} restant${r > 1 ? 's' : ''}).` +
          (c.probas.length ? `<br>Chances à la fin du tour : ${c.probas.slice(0, 6).map(x => `<span class="lc-pct">${esc(x.label)} ${pct(x.p)}</span>`).join('')}` : '') +
          `<br><small>Touchez un dé ci-dessus pour choisir vous-même ceux que vous gardez ; posez-les hors du plateau avant de relancer.</small></p>`;
      } else if(c) h += `<p class="lc-conseil">💡 <b>${Y.lancer < 3 ? 'Ne plus relancer : ' : ''}noter ${esc(nomCase(c.case))}</b> (★). Total des dés : ${somme}.</p>`;
      if(j && Y.joueur != null){
        const opts = j.options(Y.main, Y.joueur), bons = opts.filter(o => o.pts > 0), best = c && (Y.lancer >= 3 || c.garde.length === 5) ? c.case : null;
        if(!opts.length) h += '<p class="lc-aide">Toutes les cases de ce joueur sont remplies.</p>';
        else {
          h += `<div class="lc-opts">${bons.map(o => `<button class="lc-opt${o.key === best ? ' best' : ''}" data-act="noter" data-key="${o.key}" data-v="${o.pts}">${esc(o.label)}<b>${o.pts}</b></button>`).join('') || '<p class="lc-aide">Aucune case libre ne rapporte de points.</p>'}</div>`;
          h += `<details${bons.length ? '' : ' open'}><summary>Rayer une case</summary><div class="lc-opts">${opts.map(o => `<button class="lc-opt${o.key === best && !bons.some(b => b.key === best) ? ' best' : ''}" data-act="noter" data-key="${o.key}" data-v="x">${esc(o.label)}<b>✕</b></button>`).join('')}</div></details>`;
        }
      }
    }
    panneau.innerHTML = h;
    const sel = panneau.querySelector('.lc-joueur'); if(sel) sel.onchange = () => { Y.joueur = +sel.value; Y.choix = []; calculer(); afficherPanneau(); dessiner(); };
    panneau.querySelectorAll('.lc-de').forEach(b => b.onclick = () => { const i = +b.dataset.i; if(!Y.choix.length) Y.choix = Y.main.map(() => false); Y.choix[i] = !Y.choix[i]; afficherPanneau(); dessiner(); });
  }
  const nomCase = k => (window.YamsIA && YamsIA.NOMS[k]) || k;

  function panneau10000(j, inconnus){
    const vals = lecture.des.map(d => d.v), n = vals.length;
    let h = '';
    if(j && j.active()) h += `<div class="lc-ligne"><b>${esc(j.player())}</b><span>${fmt(j.score())} pts${j.opened() ? '' : ' · pas encore ouvert (1 000)'}</span><span>· tour en cours : <b>${fmt(j.turnPts())}</b></span></div>`;
    else h += '<p class="lc-aide">Commencez la partie sur la feuille pour que les points s\'y ajoutent.</p>';
    h += `<div class="lc-main">${vals.map((v, i) => puce(v, D.choix[i] ? 'choisi' : '', D.choix[i] ? 'de côté' : '', i)).join('')}</div>`;
    if(inconnus){ h += `<p class="lc-aide">⚠️ ${inconnus} dé${inconnus > 1 ? 's' : ''} mal lu${inconnus > 1 ? 's' : ''} (en rouge) : touchez-le pour donner sa valeur.</p>`; panneau.innerHTML = h; return; }
    if(!n){ panneau.innerHTML = h; return; }
    const premier = j ? j.firstRoll() : true, tout = DixMilleIA.score(vals, premier);
    const sel = vals.filter((_, i) => D.choix[i]), s = DixMilleIA.score(sel, premier && sel.length === 5);
    const reste = n - sel.length, relance = reste === 0 ? 5 : reste, tour = (j && j.active() ? j.turnPts() : 0) + (s.tous ? s.pts : 0);
    if(D.fait) h += '<p class="lc-aide">✅ Noté. Relancez les dés : la prochaine lecture sera un nouveau lancer.</p>';
    else if(n === 2 && vals[0] === vals[1] && vals[0] !== 1 && vals[0] !== 5) h += `<p class="lc-conseil">🎲 <b>Double ${vals[0]} avec les 2 derniers dés : relance obligatoire des 5 dés.</b></p>`;
    else if(tout.pts === 0){
      h += `<p class="lc-conseil">💥 <b>Raté : aucun dé ne rapporte.</b></p>`;
      if(j && j.active()) h += `<button class="lc-btn rouge" data-act="rate">Noter : ${esc(j.bustLabel())}</button>`;
    } else {
      h += `<p class="lc-conseil">Ce lancer peut rapporter <b>${fmt(tout.pts)}</b>${tout.tous ? ' (tous les dés comptent : relance des 5 dés)' : ''}.` +
        (sel.length ? `<br>💡 <b>Mettre de côté ${sel.map(v => FACES[v]).join(' ')}</b> (en jaune)${s.tous ? ` : +${fmt(s.pts)}` : ' : ces dés ne comptent pas tous'}.` : '');
      if(s.tous && sel.length){
        const p = REUSSITE[relance], ouvert = j && j.active() ? j.opened() : true, total = j && j.active() ? j.score() : 0;
        const garder = window.DixMilleIA ? DixMilleIA.garderPoints({ tour, des:reste, score:total, ouvert, niveau:'fort' }) : false;
        h += `<br>En relançant ${relance} dé${relance > 1 ? 's' : ''} : <span class="lc-pct">${pct(p)} de marquer encore</span><span class="lc-pct">${pct(1 - p)} de tout perdre (${fmt(tour)} pts)</span>` +
          `<br>💡 <b>${!ouvert && tour < 1000 ? `Relancer : il faut 1 000 pour ouvrir (encore ${fmt(1000 - tour)})` : garder ? `Garder vos ${fmt(tour)} points` : `Relancer ${relance} dé${relance > 1 ? 's' : ''}`}</b>`;
      }
      h += '</p>';
      if(s.tous && sel.length && j && j.active()){
        const okGarder = j.opened() || tour >= 1000;
        h += `<div class="lc-ligne"><button class="lc-btn vert" data-act="cote">+${fmt(s.pts)} et relancer ${relance} dé${relance > 1 ? 's' : ''}</button>` +
          `<button class="lc-btn" data-act="garder"${okGarder ? '' : ' disabled'}>${okGarder ? `+${fmt(s.pts)} et garder ${fmt(tour)} pts` : 'Il faut 1 000 pour ouvrir'}</button></div>`;
      }
      h += '<p class="lc-aide">Touchez un dé ci-dessus pour choisir ceux que vous mettez de côté.</p>';
    }
    panneau.innerHTML = h;
    panneau.querySelectorAll('.lc-de').forEach(b => b.onclick = () => { const i = +b.dataset.i; if(!D.choix.length) D.choix = vals.map(() => false); D.choix[i] = !D.choix[i]; D.fait = false; afficherPanneau(); dessiner(); });
  }

  /* ---------- Les actions ---------- */
  function annoncer(t){ toast.textContent = t; toast.hidden = false; clearTimeout(annoncer.t); annoncer.t = setTimeout(() => { toast.hidden = true; }, 1800); }
  function action(a, b){
    const j = jeu();
    if(a === 'moins') return changerLancer(-1);
    if(a === 'plus') return changerLancer(1);
    if(a === 'tour'){ Y.fini = true; Y.lancer = 0; Y.gardes = []; Y.main = []; Y.choix = []; lecture = null; pile = []; if(j) Y.joueur = j.nextPlayer(); afficherPanneau(); dessiner(); return; }
    if(a === 'noter' && j){
      const v = b.dataset.v === 'x' ? 'x' : +b.dataset.v;
      j.note(Y.joueur, b.dataset.key, v);
      annoncer(`Noté : ${nomCase(b.dataset.key)} ${v === 'x' ? 'rayé' : v} pour ${j.players()[Y.joueur]}`);
      Y.fini = true; Y.main = []; Y.gardes = []; Y.choix = []; Y.lancer = 0; Y.joueur = j.nextPlayer(); lecture = null;
      afficherPanneau(); dessiner(); return;
    }
    if(!j) return;
    const vals = lecture ? lecture.des.map(d => d.v) : [], sel = vals.filter((_, i) => D.choix[i]), premier = j.firstRoll(), s = DixMilleIA.score(sel, premier && sel.length === 5);
    const reste = vals.length - sel.length;
    if(a === 'rate'){ j.bust(); annoncer('Raté noté'); D.fait = true; }
    if(a === 'cote' && s.tous){ j.add(s.pts); annoncer(`+${fmt(s.pts)} au tour`); D.fait = true; }
    if(a === 'garder' && s.tous){ j.add(s.pts); j.bank(reste); annoncer('Points gardés'); D.fait = true; }
    afficherPanneau(); dessiner();
  }

  window.lecteurDes = { ouvrir, fermer, lirePhoto, get lecture(){ return lecture; }, get yams(){ return Y; } };
})();
