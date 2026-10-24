/* Altitude Arcade : le chargeur du serveur de sauvegarde.
   C'est lui qu'on colle dans Apps Script, une seule fois, à la place de tout le contenu de Code.gs. Puis :
   Déployer › Gérer les déploiements › crayon › Version : nouvelle version › Déployer, et accepter les autorisations
   (le chargeur demande en plus de « se connecter à un service externe » : GitHub).

   Le vrai programme du serveur (outils/sauvegarde-google.gs) est lu sur GitHub, dans la branche main.
   Une modification du serveur arrive donc toute seule, au plus tard 10 minutes après la fusion dans main :
   plus besoin de recoller ni de republier. Pour la prendre tout de suite, ouvrir l'adresse de l'application Web
   suivie de ?maj=1.
   Une copie du dernier programme lu est gardée dans les propriétés du script : si GitHub ne répond pas,
   le serveur continue avec elle. Un programme qui contient une erreur n'est jamais pris : on garde l'ancien. */

const SOURCE = 'https://raw.githubusercontent.com/p69gp84gk7-arch/b4q454Bl3T35t/main/outils/sauvegarde-google.gs';
const GARDE = 600;            // secondes avant de relire GitHub
const PART = 4000;            // une propriété contient au plus 9 ko : la copie de secours est coupée en morceaux

function doGet(e){
  if(e && e.parameter && e.parameter.maj){
    const r = telecharger_();
    return ContentService.createTextOutput(r.ok ? 'Programme mis à jour depuis GitHub (' + r.code.length + ' caractères).' : 'Mise à jour impossible : ' + r.erreur);
  }
  return serveur_().doGet(e);
}

function doPost(e){
  let s;
  try{ s = serveur_(); }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ ok:false, erreur:'Serveur indisponible : ' + err.message })).setMimeType(ContentService.MimeType.JSON);
  }
  return s.doPost(e);
}

// Le programme est compilé une fois par appel, depuis le cache (10 minutes), sinon GitHub, sinon la copie de secours
let serveurCharge_ = null;
function serveur_(){
  if(serveurCharge_) return serveurCharge_;
  let code = CacheService.getScriptCache().get('programme');
  if(!code){ const r = telecharger_(); code = r.ok ? r.code : secours_(); }
  if(!code) throw new Error('programme introuvable (GitHub ne répond pas et aucune copie n\'est gardée).');
  serveurCharge_ = compiler_(code);
  return serveurCharge_;
}

function compiler_(code){ return new Function(code + '\n;return { doGet, doPost };')(); }

function telecharger_(){
  try{
    const r = UrlFetchApp.fetch(SOURCE + '?t=' + Date.now(), { muteHttpExceptions:true });
    if(r.getResponseCode() !== 200) return { ok:false, erreur:'GitHub répond ' + r.getResponseCode() + '.' };
    const code = r.getContentText();
    const essai = compiler_(code);            // un programme qui ne se compile pas n'est pas pris
    if(typeof essai.doPost !== 'function') return { ok:false, erreur:'le programme lu ne contient pas doPost.' };
    CacheService.getScriptCache().put('programme', code, GARDE);
    if(code !== secours_()) garder_(code);
    return { ok:true, code };
  }catch(err){ return { ok:false, erreur:err.message }; }
}

function garder_(code){
  const p = PropertiesService.getScriptProperties(), morceaux = {}, n = Math.ceil(code.length / PART);
  for(let i = 0; i < n; i++) morceaux['programme-' + i] = code.slice(i * PART, (i + 1) * PART);
  morceaux['programme-n'] = String(n);
  p.setProperties(morceaux);
}
function secours_(){
  const p = PropertiesService.getScriptProperties(), n = Number(p.getProperty('programme-n') || 0);
  let code = '';
  for(let i = 0; i < n; i++) code += p.getProperty('programme-' + i) || '';
  return code;
}

// Jamais appelée : elle montre à Google de quelles autorisations le programme lu sur GitHub a besoin (le tableur)
function autorisations_(){ SpreadsheetApp.openById(''); SpreadsheetApp.getActiveSpreadsheet(); }
