/* Altitude Arcade : le serveur de sauvegarde en ligne, dans un Google Sheet.
   En service, ce fichier n'est plus collé dans Apps Script : c'est outils/chargeur-google.gs qui y est collé,
   et qui lit ce fichier sur GitHub (branche main). Une modification d'ici arrive donc toute seule dans les 10 minutes
   après la fusion dans main. Les explications ci-dessous restent valables pour le coller directement.
   Ce programme est un projet Apps Script à part (« Altitude Arcade – serveur de sauvegarde » dans le Google Drive),
   qui écrit dans le tableur indiqué par ID_TABLEUR. On peut aussi le coller dans le tableur lui-même (Extensions › Apps Script,
   avec ID_TABLEUR vide). Pour le publier : Déployer › Nouveau déploiement › type « Application Web » :
     - Exécuter en tant que : moi ;
     - Qui peut accéder : tout le monde.
   Copier l'adresse de l'application Web (elle finit par /exec) : c'est elle que l'application utilise.
   Après une modification de ce fichier : Déployer › Gérer les déploiements › crayon › Version : nouvelle version.

   Le tableur contient quatre onglets, créés tout seuls au premier appel :
     - Comptes : un joueur par ligne. On peut changer son code (4 chiffres), le bloquer (Actif : non), effacer son jeton
       pour le déconnecter de tous ses appareils, ou supprimer la ligne pour supprimer le compte.
     - Suivi : où en est chaque joueur dans chaque jeu (le même texte que sur l'accueil de l'application).
     - Données : les sauvegardes elles-mêmes (une ligne par joueur et par élément) ; à ne pas modifier à la main.
     - Journal : les connexions et créations de comptes.
     - Classement : les meilleurs scores de chaque joueur, jeu par jeu, pour le classement de tous les joueurs (à ne pas modifier). */

// L'identifiant du Google Sheet (dans son adresse, entre /d/ et /edit). Vide : le tableur auquel ce programme est attaché.
const ID_TABLEUR = '1srSXeOBSVfuUba5E1aXXga-64ZCXfufxMQh9gp67dGw';
const classeur = () => ID_TABLEUR ? SpreadsheetApp.openById(ID_TABLEUR) : SpreadsheetApp.getActiveSpreadsheet();

const ONGLETS = { comptes:'Comptes', suivi:'Suivi', donnees:'Données', journal:'Journal', classement:'Classement' };
const ENTETES = {
  Comptes:['Pseudo', 'Code', 'Actif', 'Créé le', 'Dernière visite', 'Appareil', 'Jeton'],
  Suivi:['Pseudo', 'Mis à jour'],
  'Données':['Pseudo', 'Clé', 'Modifié (ms)', 'Modifié le', 'Valeur…'],
  Journal:['Date', 'Pseudo', 'Évènement'],
  Classement:['Pseudo', 'Jeu', 'Mis à jour', 'Scores'],
};
const MORCEAU = 40000;          // une cellule contient au plus 50 000 caractères : les longues sauvegardes sont coupées
const ESSAIS_MAX = 6;           // essais de code ratés avant d'attendre 10 minutes

function doGet(){
  return ContentService.createTextOutput('Altitude Arcade : le serveur de sauvegarde fonctionne.');
}

function doPost(e){
  let req;
  try{ req = JSON.parse(e.postData.contents); }catch(err){ return reponse({ ok:false, erreur:'Requête illisible.' }); }
  const verrou = LockService.getScriptLock();
  try{ verrou.waitLock(25000); }catch(err){ return reponse({ ok:false, erreur:'Serveur occupé, réessaie dans un instant.' }); }
  try{
    if(req.action === 'connexion') return reponse(connexion(req));
    const compte = verifier(req);
    if(!compte.ok) return reponse(compte);
    if(req.action === 'lire') return reponse(lire(compte.pseudo));
    if(req.action === 'ecrire') return reponse(ecrire(compte.pseudo, req));
    if(req.action === 'classement') return reponse(classement());
    return reponse({ ok:false, erreur:'Action inconnue.' });
  }catch(err){
    return reponse({ ok:false, erreur:'Erreur du serveur : ' + err.message });
  }finally{ verrou.releaseLock(); }
}

function reponse(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function onglet(nom){
  const ss = classeur();
  let f = ss.getSheetByName(nom);
  if(!f){
    f = ss.insertSheet(nom);
    f.getRange(1, 1, 1, ENTETES[nom].length).setValues([ENTETES[nom]]).setFontWeight('bold');
    f.setFrozenRows(1);
    if(nom === ONGLETS.comptes) f.getRange('B:B').setNumberFormat('@');     // le code reste du texte (0042 garde ses zéros)
  }
  return f;
}
const norm = s => String(s || '').trim().toLowerCase();
const codeDe = v => String(v === null || v === undefined ? '' : v).trim().padStart(4, '0');
function noter(pseudo, quoi){ try{ onglet(ONGLETS.journal).appendRow([new Date(), pseudo, quoi]); }catch(err){} }

/* ---------- Comptes ---------- */
function trouverCompte(pseudo){
  const f = onglet(ONGLETS.comptes), v = f.getDataRange().getValues();
  for(let i = 1; i < v.length; i++) if(norm(v[i][0]) === norm(pseudo) && norm(pseudo)) return { f, ligne:i + 1, v:v[i] };
  return { f, ligne:0, v:null };
}
function connexion(req){
  const pseudo = String(req.pseudo || '').trim().replace(/\s+/g, ' '), code = String(req.code || '').trim();
  if(!/^[\p{L}\p{N} _.-]{2,20}$/u.test(pseudo)) return { ok:false, erreur:'Le pseudo doit faire de 2 à 20 lettres ou chiffres.' };
  if(!/^\d{4}$/.test(code)) return { ok:false, erreur:'Le code doit faire 4 chiffres.' };
  const cache = CacheService.getScriptCache(), cleEssais = 'essais-' + norm(pseudo);
  const essais = Number(cache.get(cleEssais) || 0);
  if(essais >= ESSAIS_MAX) return { ok:false, erreur:'Trop d\'essais ratés : attends 10 minutes avant de réessayer.' };
  const c = trouverCompte(pseudo), maintenant = new Date();
  if(!c.ligne){
    // Première connexion : le compte est créé
    const jeton = Utilities.getUuid();
    c.f.appendRow([pseudo, code, 'oui', maintenant, maintenant, String(req.appareil || '').slice(0, 60), jeton]);
    c.f.getRange(c.f.getLastRow(), 2).setNumberFormat('@').setValue(code);
    noter(pseudo, 'compte créé');
    return { ok:true, pseudo, jeton, nouveau:true };
  }
  if(codeDe(c.v[1]) !== code){
    cache.put(cleEssais, String(essais + 1), 600);
    noter(c.v[0], 'code incorrect');
    return { ok:false, erreur:'Ce pseudo existe déjà et le code ne correspond pas.' };
  }
  if(norm(c.v[2]) === 'non') return { ok:false, erreur:'Ce compte est bloqué.' };
  cache.remove(cleEssais);
  let jeton = String(c.v[6] || '');
  if(!jeton){ jeton = Utilities.getUuid(); c.f.getRange(c.ligne, 7).setValue(jeton); }
  c.f.getRange(c.ligne, 5, 1, 2).setValues([[maintenant, String(req.appareil || c.v[5] || '').slice(0, 60)]]);
  noter(c.v[0], 'connexion');
  return { ok:true, pseudo:String(c.v[0]), jeton, nouveau:false };
}
function verifier(req){
  const c = trouverCompte(req.pseudo);
  if(!c.ligne) return { ok:false, erreur:'Compte inconnu.', deconnecter:true };
  if(norm(c.v[2]) === 'non') return { ok:false, erreur:'Ce compte est bloqué.', deconnecter:true };
  if(!req.jeton || String(c.v[6] || '') !== String(req.jeton)) return { ok:false, erreur:'Reconnecte-toi.', deconnecter:true };
  c.f.getRange(c.ligne, 5).setValue(new Date());
  return { ok:true, pseudo:String(c.v[0]) };
}

/* ---------- Sauvegardes ---------- */
// Chaque morceau commence par « ~ » : le tableur ne prend jamais une sauvegarde pour un nombre ou une formule
function lire(pseudo){
  const v = onglet(ONGLETS.donnees).getDataRange().getValues(), donnees = {};
  for(let i = 1; i < v.length; i++){
    if(norm(v[i][0]) !== norm(pseudo)) continue;
    let val = '';
    for(let j = 4; j < v[i].length; j++){ const m = String(v[i][j] === null ? '' : v[i][j]); if(!m) break; val += m.charAt(0) === '~' ? m.slice(1) : m; }
    donnees[String(v[i][1])] = { v:val, t:Number(v[i][2]) || 0 };
  }
  return { ok:true, donnees, heure:Date.now() };
}
function ecrire(pseudo, req){
  const f = onglet(ONGLETS.donnees), v = f.getDataRange().getValues(), lignes = {};
  for(let i = 1; i < v.length; i++) if(norm(v[i][0]) === norm(pseudo)) lignes[String(v[i][1])] = i + 1;
  const changes = req.donnees || {}, maintenant = Date.now();
  let n = 0;
  for(const cle of Object.keys(changes)){
    const val = String(changes[cle].v), t = Number(changes[cle].t) || maintenant, morceaux = [];
    for(let k = 0; k < val.length || k === 0; k += MORCEAU) morceaux.push('~' + val.slice(k, k + MORCEAU));
    let ligne = lignes[cle];
    if(!ligne){ ligne = f.getLastRow() + 1; lignes[cle] = ligne; }
    const largeur = f.getLastColumn(), rangee = [pseudo, cle, t, new Date(t), ...morceaux];
    if(largeur > rangee.length) f.getRange(ligne, rangee.length + 1, 1, largeur - rangee.length).clearContent();
    f.getRange(ligne, 5, 1, morceaux.length).setNumberFormat('@');
    f.getRange(ligne, 1, 1, rangee.length).setValues([rangee]);
    n++;
  }
  // éléments effacés dans l'application : on retire leurs lignes (de la plus basse à la plus haute)
  const suppr = (req.suppr || []).map(String).filter(c => lignes[c]).map(c => lignes[c]).sort((a, b) => b - a);
  for(const l of suppr) f.deleteRow(l);
  if(req.resume) suivi(pseudo, req.resume);
  if(req.scores) scores(pseudo, req.scores);
  return { ok:true, ecrits:n, effaces:suppr.length, heure:maintenant };
}

/* ---------- Suivi : une ligne par joueur, une colonne par jeu ---------- */
function suivi(pseudo, resume){
  const f = onglet(ONGLETS.suivi);
  const entetes = f.getRange(1, 1, 1, Math.max(2, f.getLastColumn())).getValues()[0].map(String);
  for(const jeu of Object.keys(resume)) if(!entetes.includes(jeu)){ entetes.push(jeu); f.getRange(1, entetes.length).setValue(jeu).setFontWeight('bold'); }
  const v = f.getDataRange().getValues();
  let ligne = 0;
  for(let i = 1; i < v.length; i++) if(norm(v[i][0]) === norm(pseudo)){ ligne = i + 1; break; }
  if(!ligne) ligne = f.getLastRow() + 1;
  const rangee = entetes.map((h, j) => j === 0 ? pseudo : j === 1 ? new Date() : (h in resume ? String(resume[h]).slice(0, 500) : (v[ligne - 1] ? v[ligne - 1][j] : '')));
  f.getRange(ligne, 1, 1, rangee.length).setValues([rangee]);
}

/* ---------- Classement : les scores de chaque joueur, une ligne par joueur et par jeu ---------- */
function scores(pseudo, parJeu){
  const f = onglet(ONGLETS.classement), v = f.getDataRange().getValues(), lignes = {};
  for(let i = 1; i < v.length; i++) if(norm(v[i][0]) === norm(pseudo)) lignes[String(v[i][1])] = i + 1;
  for(const jeu of Object.keys(parJeu)){
    const texte = '~' + JSON.stringify(parJeu[jeu]).slice(0, 45000);
    const ligne = lignes[jeu] || f.getLastRow() + 1; lignes[jeu] = ligne;
    f.getRange(ligne, 4).setNumberFormat('@');
    f.getRange(ligne, 1, 1, 4).setValues([[pseudo, jeu, new Date(), texte]]);
  }
}
// Les scores de tous les joueurs dont le compte est actif
function classement(){
  const comptes = onglet(ONGLETS.comptes).getDataRange().getValues().slice(1).filter(l => l[0] && norm(l[2]) !== 'non');
  const actifs = {}; comptes.forEach(l => { actifs[norm(l[0])] = String(l[0]); });
  const v = onglet(ONGLETS.classement).getDataRange().getValues(), joueurs = {};
  for(let i = 1; i < v.length; i++){
    const p = actifs[norm(v[i][0])]; if(!p) continue;
    const t = String(v[i][3] || ''); if(!t) continue;
    try{ (joueurs[p] = joueurs[p] || {})[String(v[i][1])] = JSON.parse(t.charAt(0) === '~' ? t.slice(1) : t); }catch(err){}
  }
  return { ok:true, joueurs, heure:Date.now() };
}
