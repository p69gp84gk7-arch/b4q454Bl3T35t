/* Altitude Arcade : le compte du joueur et la sauvegarde en ligne (dans le Google Sheet, voir outils/sauvegarde-google.gs).
   Une fois connecté (pseudo + code à 4 chiffres), les parties, records et statistiques partent tout seuls vers le tableur,
   et reviennent sur n'importe quel appareil où l'on se connecte avec le même compte.
   - À l'ouverture d'une page : on récupère ce qui a changé ailleurs (si c'est arrivé juste à l'ouverture, la page se recharge une fois).
   - Ensuite : toutes les 20 secondes, et quand on quitte la page, on envoie ce qui a changé ici.
   - Chaque élément (clé du stockage du navigateur) garde l'empreinte de sa dernière version envoyée ou reçue :
     c'est ainsi qu'on sait ce qui a changé de chaque côté. Si un élément a changé des deux côtés, celui de l'appareil gagne.
   Utilisation : <script src="sauvegarde.js"></script><script src="compte.js"></script> (sauvegarde.js donne la liste des clés). */
(() => {
  // L'adresse de l'application Web du Google Sheet (Déployer › Application Web, elle finit par /exec)
  const SERVEUR_DEFAUT = '';
  const lireLS = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
  const ecrireLS = (k, v) => { try{ if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); }catch(e){} };
  const serveur = () => lireLS('compte-serveur', '') || SERVEUR_DEFAUT;   // « compte-serveur » : pour les essais
  const session = () => lireLS('compte-session', null);                   // { pseudo, jeton }
  const cles = () => window.DesDesSauvegarde ? window.DesDesSauvegarde.cles() : [];
  const valeur = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
  // empreinte courte d'un texte (pour savoir s'il a changé)
  const empreinte = s => { let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '.' + s.length; };
  const appareil = () => { const u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'PC Windows' : 'Navigateur'; };

  let etat = { statut:'', message:'' }, ecouteurs = [], enCours = null, interaction = false;
  const t0 = Date.now();
  const signaler = (statut, message = '') => { etat = { statut, message }; ecouteurs.forEach(f => { try{ f(etat); }catch(e){} }); };
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { interaction = true; }, { once:true, capture:true }));

  async function appel(corps){
    const url = serveur();
    if(!url) throw new Error('La sauvegarde en ligne n\'est pas encore configurée.');
    const r = await fetch(url, { method:'POST', body:JSON.stringify(corps), headers:{ 'Content-Type':'text/plain;charset=utf-8' }, redirect:'follow' });
    if(!r.ok) throw new Error('Serveur injoignable (' + r.status + ').');
    const j = await r.json();
    if(!j.ok){
      if(j.deconnecter){ ecrireLS('compte-session', null); signaler('deconnecte', j.erreur); }
      throw new Error(j.erreur || 'Erreur du serveur.');
    }
    return j;
  }

  // Ce qui a changé ici depuis la dernière synchronisation
  function changementsLocaux(){
    const sync = lireLS('compte-sync', {}), donnees = {}, suppr = [];
    for(const k of cles()){ const v = valeur(k); if(v !== null && (!sync[k] || sync[k].h !== empreinte(v))) donnees[k] = { v, t:Date.now() }; }
    for(const k of Object.keys(sync)) if(valeur(k) === null) suppr.push(k);
    return { donnees, suppr };
  }

  // Récupérer : on prend chaque élément du serveur qui n'a pas changé ici ; renvoie le nombre d'éléments remplacés
  async function recuperer(){
    const s = session(); if(!s) return 0;
    const j = await appel({ action:'lire', pseudo:s.pseudo, jeton:s.jeton });
    const sync = lireLS('compte-sync', {});
    let n = 0;
    for(const [k, d] of Object.entries(j.donnees || {})){
      if(!window.DesDesSauvegarde || !window.DesDesSauvegarde.nos(k)) continue;   // seulement les clés d'Altitude Arcade
      const ici = valeur(k), base = sync[k];
      const changeIci = ici !== null && (!base || base.h !== empreinte(ici));
      const effaceIci = ici === null && base;
      if(changeIci || effaceIci) continue;
      if(ici !== d.v){ try{ localStorage.setItem(k, d.v); n++; }catch(e){ continue; } }
      sync[k] = { h:empreinte(d.v), t:d.t };
    }
    ecrireLS('compte-sync', sync);
    return n;
  }

  // Envoyer ce qui a changé ici (et, depuis l'accueil, le résumé lisible pour l'onglet Suivi)
  async function envoyer(resume = null){
    const s = session(); if(!s) return 0;
    const { donnees, suppr } = changementsLocaux();
    if(!Object.keys(donnees).length && !suppr.length && !resume) return 0;
    const j = await appel({ action:'ecrire', pseudo:s.pseudo, jeton:s.jeton, donnees, suppr, resume });
    const sync = lireLS('compte-sync', {});
    for(const [k, d] of Object.entries(donnees)) if(valeur(k) === d.v) sync[k] = { h:empreinte(d.v), t:d.t };
    for(const k of suppr) delete sync[k];
    ecrireLS('compte-sync', sync);
    ecrireLS('compte-derniere', j.heure || Date.now());
    return Object.keys(donnees).length + suppr.length;
  }

  // Une synchronisation complète : récupérer puis envoyer (une seule à la fois)
  function synchroniser(opts = {}){
    if(!session() || !serveur()) return Promise.resolve({ recus:0, envoyes:0 });
    if(enCours) return enCours;
    signaler('envoi');
    enCours = (async () => {
      try{
        const recus = opts.envoyerSeulement ? 0 : await recuperer();
        const envoyes = await envoyer(opts.resume || null);
        signaler('ok');
        return { recus, envoyes };
      }catch(e){
        signaler(session() ? 'erreur' : 'deconnecte', navigator.onLine === false ? 'Pas de réseau : les parties seront envoyées plus tard.' : e.message);
        return { recus:0, envoyes:0, erreur:e.message };
      }finally{ enCours = null; }
    })();
    return enCours;
  }

  // Se connecter (ou créer le compte la première fois)
  async function connecter(pseudo, code){
    const j = await appel({ action:'connexion', pseudo, code, appareil:appareil() });
    // Un autre joueur était connecté sur cet appareil : on repart de zéro
    const avant = session();
    ecrireLS('compte-session', { pseudo:j.pseudo, jeton:j.jeton });
    if(avant && avant.pseudo.toLowerCase() !== j.pseudo.toLowerCase()) viderLocal();
    ecrireLS('compte-sync', {});
    // Les parties du compte remplacent celles de l'appareil ; ce qui n'existe pas en ligne est envoyé
    const lu = await appel({ action:'lire', pseudo:j.pseudo, jeton:j.jeton });
    const sync = {};
    for(const [k, d] of Object.entries(lu.donnees || {})){ try{ localStorage.setItem(k, d.v); sync[k] = { h:empreinte(d.v), t:d.t }; }catch(e){} }
    ecrireLS('compte-sync', sync);
    if(!lireLS('geo-nom', '')) ecrireLS('geo-nom', j.pseudo);
    await envoyer();
    signaler('ok');
    return { pseudo:j.pseudo, nouveau:j.nouveau, recus:Object.keys(lu.donnees || {}).length };
  }
  function viderLocal(){ for(const k of cles()) try{ localStorage.removeItem(k); }catch(e){} ecrireLS('compte-sync', {}); }
  // Se déconnecter : on envoie d'abord tout, puis on efface les parties de l'appareil (elles sont en ligne)
  async function deconnecter(){
    try{ await envoyer(); }catch(e){ if(!confirm('Les dernières parties n\'ont pas pu être envoyées (' + e.message + ').\nSe déconnecter quand même ? Elles seront perdues.')) return false; }
    viderLocal(); ecrireLS('compte-session', null); ecrireLS('compte-derniere', null);
    signaler('deconnecte');
    return true;
  }

  // Quand on quitte la page : un dernier envoi, même si la page se ferme
  function envoiFinal(){
    const s = session(); if(!s || !serveur()) return;
    const { donnees, suppr } = changementsLocaux();
    if(!Object.keys(donnees).length && !suppr.length) return;
    const corps = JSON.stringify({ action:'ecrire', pseudo:s.pseudo, jeton:s.jeton, donnees, suppr });
    let parti = false;
    try{ parti = navigator.sendBeacon && navigator.sendBeacon(serveur(), new Blob([corps], { type:'text/plain;charset=utf-8' })); }catch(e){}
    if(!parti) try{ fetch(serveur(), { method:'POST', body:corps, keepalive:true, headers:{ 'Content-Type':'text/plain;charset=utf-8' } }); }catch(e){}
    // (on ne sait pas si cet envoi est arrivé : ces éléments seront renvoyés à la prochaine ouverture, sans dommage)
  }

  // Démarrage sur chaque page : on récupère, puis on envoie régulièrement
  function demarrer(){
    if(!session() || !serveur()) return;
    const accueil = !!window.AltitudeAccueil;   // l'accueil gère lui-même sa première synchronisation (avec le résumé)
    if(!accueil) synchroniser().then(r => {
      // des parties sont arrivées d'un autre appareil juste à l'ouverture : on recharge une fois pour les afficher
      if(r.recus && !interaction && Date.now() - t0 < 8000 && !sessionStorage.getItem('compte-recharge')){ sessionStorage.setItem('compte-recharge', '1'); location.reload(); }
    });
    setInterval(() => { if(document.visibilityState === 'visible') synchroniser({ envoyerSeulement:true }); }, 20000);
    addEventListener('pagehide', envoiFinal);
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') envoiFinal(); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else setTimeout(demarrer, 0);

  window.AltitudeCompte = {
    session, serveur, actif:() => !!serveur(), connecter, deconnecter, synchroniser,
    derniere:() => lireLS('compte-derniere', null), etat:() => etat, surChangement:f => ecouteurs.push(f),
  };
})();
