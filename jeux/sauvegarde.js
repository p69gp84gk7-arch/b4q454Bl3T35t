/* Altitude Arcade : sauvegarde de toutes les parties, records et statistiques dans un fichier.
   Le fichier porte toujours le même nom (altitude-sauvegarde.json), pour remplacer l'ancien au lieu d'en créer un nouveau :
   - sur ordinateur (Chrome, Edge) et les navigateurs qui le permettent, on choisit le fichier une fois, puis chaque export
     réécrit directement ce même fichier (l'accès au fichier est gardé dans IndexedDB) ;
   - sur iPhone, une page web ne peut pas écrire seule dans Fichiers : « Exporter » ouvre le partage (« Enregistrer dans
     Fichiers ») ; au même endroit, l'iPhone propose de remplacer le fichier existant ;
   - sinon, le fichier est téléchargé. « Importer » recharge un fichier.
   Utilisation : <script src="sauvegarde.js"></script> puis DesDesSauvegarde.boutons(element). */
(() => {
  // Clés de l'application dans le stockage du navigateur
  const PREFIXES = ['yams-', 'score10000', 'geo-', 'drawrace-', 'nivo-', 'fusee-', 'dameuse-', 'freeride-', 'tour-', 'panier-', 'tables-', 'pepin-', 'quiz-', 'desdes-'];
  const nos = k => PREFIXES.some(p => k.startsWith(p));

  function cles(){
    const out = [];
    try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(nos(k)) out.push(k); } }catch(e){}
    return out.sort();
  }

  function contenu(){
    const donnees = {};
    for(const k of cles()) try{ donnees[k] = localStorage.getItem(k); }catch(e){}
    return { app:'Altitude Arcade', version:1, date:new Date().toISOString(), donnees };
  }

  // L'accès au fichier choisi (navigateurs qui savent réécrire un fichier), gardé d'une visite à l'autre
  const NOM = 'altitude-sauvegarde.json';
  function base(){
    return new Promise((ok, ko) => { const r = indexedDB.open('altitude-sauvegarde', 1); r.onupgradeneeded = () => r.result.createObjectStore('acces'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
  }
  async function acces(valeur){
    try{
      const db = await base();
      return await new Promise((ok, ko) => {
        const t = db.transaction('acces', valeur === undefined ? 'readonly' : 'readwrite'), st = t.objectStore('acces');
        const r = valeur === undefined ? st.get('fichier') : valeur === null ? st.delete('fichier') : st.put(valeur, 'fichier');
        r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
      });
    }catch(e){ return null; }
  }
  async function ecrireDans(h, texte){
    if(h.queryPermission && await h.queryPermission({ mode:'readwrite' }) !== 'granted' && await h.requestPermission({ mode:'readwrite' }) !== 'granted') throw new Error('refusé');
    const w = await h.createWritable(); await w.write(texte); await w.close();
  }
  // nouveau = true : choisir un autre fichier (ou le premier)
  async function exporter(nouveau = false){
    const nom = NOM;
    const texte = JSON.stringify(contenu());
    if(window.showSaveFilePicker && window.indexedDB){
      try{
        let h = nouveau ? null : await acces();
        if(h){ try{ await ecrireDans(h, texte); noter(h.name); return 'remplace'; }catch(e){ if(e && e.name === 'AbortError') return 'annule'; h = null; } }
        h = await window.showSaveFilePicker({ suggestedName:nom, types:[{ description:'Sauvegarde Altitude Arcade', accept:{ 'application/json':['.json'] } }] });
        await ecrireDans(h, texte); await acces(h); noter(h.name);
        return 'fichier';
      }catch(e){ if(e && e.name === 'AbortError') return 'annule'; }
    }
    const fichier = new File([texte], nom, { type:'application/json' });
    try{
      if(navigator.canShare && navigator.canShare({ files:[fichier] })){
        await navigator.share({ files:[fichier], title:'Sauvegarde Altitude Arcade' });
        noter();
        return 'partage';
      }
    }catch(e){
      if(e && e.name === 'AbortError') return 'annule';
    }
    // Pas de partage de fichier : téléchargement classique
    const url = URL.createObjectURL(new Blob([texte], { type:'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = nom;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    noter();
    return 'telechargement';
  }
  function noter(nom){ try{ localStorage.setItem('desdes-export', JSON.stringify(Date.now())); localStorage.setItem('desdes-export-fichier', JSON.stringify(nom || '')); }catch(e){} }

  function lire(fichier){
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => { try{ ok(JSON.parse(r.result)); }catch(e){ ko(new Error('Ce fichier n\'est pas une sauvegarde Altitude Arcade.')); } };
      r.onerror = () => ko(new Error('Lecture du fichier impossible.'));
      r.readAsText(fichier);
    });
  }

  // Remplace les données de l'appareil par celles du fichier (après confirmation)
  function importer(){
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const f = input.files && input.files[0];
        if(!f) return resolve(false);
        try{
          const s = await lire(f);
          if(!s || !['Altitude Arcade', 'Altitude', 'DesDés'].includes(s.app) || !s.donnees) throw new Error('Ce fichier n\'est pas une sauvegarde Altitude Arcade.');
          const n = Object.keys(s.donnees).filter(nos).length;
          const quand = s.date ? new Date(s.date).toLocaleString('fr-FR', { dateStyle:'long', timeStyle:'short' }) : 'date inconnue';
          if(!confirm(`Restaurer la sauvegarde du ${quand} (${n} élément${n > 1 ? 's' : ''}) ?\nLes parties, records et statistiques de cet appareil seront remplacés.`)) return resolve(false);
          cles().forEach(k => { try{ localStorage.removeItem(k); }catch(e){} });
          for(const [k, v] of Object.entries(s.donnees)) if(nos(k)) try{ localStorage.setItem(k, v); }catch(e){}
          alert('Sauvegarde restaurée.');
          location.reload();
          resolve(true);
        }catch(e){ alert(e.message); resolve(false); }
      };
      input.click();
    });
  }

  function dernierExport(){
    try{ const t = JSON.parse(localStorage.getItem('desdes-export')); return t ? new Date(t) : null; }catch(e){ return null; }
  }

  // Deux boutons « Exporter » / « Importer » et la date du dernier export, dans l'élément donné
  function boutons(el){
    el.classList.add('dd-sauve');
    if(!document.getElementById('dd-sauve-css')){
      document.head.insertAdjacentHTML('beforeend', `<style id="dd-sauve-css">
.dd-sauve .dd-row{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.dd-sauve button{ font:inherit; font-weight:700; font-size:.95rem; padding:11px 10px; border-radius:10px; cursor:pointer;
  border:1.5px solid currentColor; background:transparent; color:inherit; }
.dd-sauve button.dd-exp{ background:var(--dd-accent, #E9B949); border-color:var(--dd-accent, #E9B949); color:var(--dd-accent-ink, #1A1A1A); }
.dd-sauve p{ margin:8px 0 0; font-size:.82rem; opacity:.75; line-height:1.35; }
</style>`);
    }
    const direct = !!(window.showSaveFilePicker && window.indexedDB);
    const maj = async (res) => {
      const d = dernierExport(), h = direct ? await acces() : null;
      const fait = res === 'remplace' ? `Sauvegarde réécrite dans ${h ? h.name : NOM} (l'ancienne est remplacée). ` : res === 'fichier' ? `Sauvegarde enregistrée dans ${h ? h.name : NOM} ; les prochains exports réécriront ce même fichier. ` : '';
      const comment = direct ? (h ? `Chaque export remplace ${h.name}. ` : 'Au premier export, choisissez où enregistrer le fichier ; ensuite, il sera remplacé à chaque export. ')
        : `Le fichier s'appelle toujours ${NOM} : enregistrez-le au même endroit et choisissez « Remplacer » pour garder un seul fichier. `;
      el.querySelector('p').textContent = fait + (d ? `Dernier export : ${d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}. ` : 'Jamais exporté. ') + comment +
        'Le fichier contient toutes les parties, records et statistiques d\'Altitude Arcade.';
      const autre = el.querySelector('.dd-autre'); if(autre) autre.hidden = !h;
    };
    el.innerHTML = '<div class="dd-row"><button class="dd-exp">Exporter</button><button class="dd-imp">Importer</button></div><p></p>' +
      (direct ? '<button class="dd-autre" hidden style="margin-top:6px;padding:6px 10px;font-size:.8rem;border-width:1px">Enregistrer dans un autre fichier…</button>' : '');
    el.querySelector('.dd-exp').onclick = async () => { maj(await exporter()); };
    if(direct) el.querySelector('.dd-autre').onclick = async () => { maj(await exporter(true)); };
    el.querySelector('.dd-imp').onclick = () => importer();
    maj();
  }

  window.DesDesSauvegarde = { exporter, importer, boutons, cles, nos };
})();
