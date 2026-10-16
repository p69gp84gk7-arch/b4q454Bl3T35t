/* DesDés : sauvegarde de toutes les parties, records et statistiques dans un fichier.
   Une page web ne peut pas écrire seule dans les Fichiers du téléphone : « Exporter » ouvre le partage
   (sur iPhone : « Enregistrer dans Fichiers ») ou télécharge le fichier ; « Importer » le recharge.
   Utilisation : <script src="sauvegarde.js"></script> puis DesDesSauvegarde.boutons(element). */
(() => {
  // Clés de l'application dans le stockage du navigateur
  const PREFIXES = ['yams-', 'score10000', 'geo-', 'drawrace-', 'nivo-', 'desdes-'];
  const nos = k => PREFIXES.some(p => k.startsWith(p));

  function cles(){
    const out = [];
    try{ for(let i = 0; i < localStorage.length; i++){ const k = localStorage.key(i); if(nos(k)) out.push(k); } }catch(e){}
    return out.sort();
  }

  function contenu(){
    const donnees = {};
    for(const k of cles()) try{ donnees[k] = localStorage.getItem(k); }catch(e){}
    return { app:'DesDés', version:1, date:new Date().toISOString(), donnees };
  }

  async function exporter(){
    const jour = new Date().toISOString().slice(0, 10);
    const nom = `desdes-sauvegarde-${jour}.json`;
    const texte = JSON.stringify(contenu());
    const fichier = new File([texte], nom, { type:'application/json' });
    try{
      if(navigator.canShare && navigator.canShare({ files:[fichier] })){
        await navigator.share({ files:[fichier], title:'Sauvegarde DesDés' });
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
  function noter(){ try{ localStorage.setItem('desdes-export', JSON.stringify(Date.now())); }catch(e){} }

  function lire(fichier){
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => { try{ ok(JSON.parse(r.result)); }catch(e){ ko(new Error('Ce fichier n\'est pas une sauvegarde DesDés.')); } };
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
          if(!s || s.app !== 'DesDés' || !s.donnees) throw new Error('Ce fichier n\'est pas une sauvegarde DesDés.');
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
    const maj = () => {
      const d = dernierExport();
      el.querySelector('p').textContent = (d ? `Dernier export : ${d.toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' })}. ` : 'Jamais exporté. ') +
        'Le fichier contient toutes les parties, records et statistiques de DesDés.';
    };
    el.innerHTML = '<div class="dd-row"><button class="dd-exp">Exporter</button><button class="dd-imp">Importer</button></div><p></p>';
    el.querySelector('.dd-exp').onclick = async () => { await exporter(); maj(); };
    el.querySelector('.dd-imp').onclick = () => importer();
    maj();
  }

  window.DesDesSauvegarde = { exporter, importer, boutons, cles };
})();
