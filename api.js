/* =========================================================
   Fichier : js/api.js
   Rôle : Gérer les communications avec Google Apps Script
   ========================================================= */

// ---------------------------------------------------------
// 1. OUTILS DE COMMUNICATION
// ---------------------------------------------------------

/**
 * Met à jour le texte de l'écran de chargement
 */
window.setStep = function(step, desc) { 
    let elStep = document.getElementById('loading-step'); 
    let elDesc = document.getElementById('loading-desc'); 
    if (elStep) elStep.innerText = "Étape " + step + "/5"; 
    if (elDesc) elDesc.innerText = desc; 
};

/**
 * Exécute une requête réseau avec un délai d'expiration de 15s
 */
window.fetchWithTimeout = async function(resource, options = {}) { 
    let finalUrl = resource; 
    
    // Anti-cache si ce n'est pas un fichier Github brut
    if(!resource.includes('raw.githubusercontent')) { 
        finalUrl += (resource.includes('?') ? '&' : '?') + 't=' + new Date().getTime(); 
    } 
    
    const controller = window.AbortController ? new AbortController() : null; 
    if (controller) options.signal = controller.signal; 
    
    const timeoutPromise = new Promise((_, reject) => { 
        setTimeout(() => { 
            if (controller) controller.abort(); 
            reject(new Error("Délai d'attente dépassé (15s).")); 
        }, 15000); 
    }); 
    
    return Promise.race([fetch(finalUrl, options), timeoutPromise]); 
};

// ---------------------------------------------------------
// 2. PARSING DES DONNÉES GOOGLE SHEETS
// ---------------------------------------------------------

window.fetchGoogleSheetsData = async function() {
    window.setStep(1, "Connexion au serveur Google...");
    
    // 1. Appel à l'API
    const response = await window.fetchWithTimeout(GOOGLE_API_URL);
    if (!response.ok) throw new Error("Accès refusé. Vérifiez l'URL.");
    
    let textData = await response.text(); 
    let data;
    try { data = JSON.parse(textData); } 
    catch(e) { throw new Error("Format invalide renvoyé par le serveur."); }
    
    // 2. Sauvegarde des données brutes
    window.rawGeneral = data.general || []; 
    window.rawHistorique = data.historique || []; 
    window.rawTicketsSheet = data.tickets || [];
    window.meteoHistData = data.meteo_hist || []; 
    window.meteoFroidData = data.meteo_froid || []; 
    window.suiviEntretienData = data.suivi || [];

    // -----------------------------------------------------
    // PARSING : Tableau Général
    // -----------------------------------------------------
    window.setStep(2, "Analyse du Tableau Général...");
    if (!data.general || data.general.length < 2) throw new Error(`L'onglet principal est introuvable ou vide.`);
    
    const genHeaders = data.general[0].map(h => (h||"").toString().toLowerCase().trim());
    const originalHeaders = data.general[0].map(h => (h||"").toString().trim()); 
    const findCol = (keywords) => { let idx = genHeaders.findIndex(h => keywords.some(k => h.includes(k))); return idx !== -1 ? originalHeaders[idx] : null; };

    const idxId = 2; 
    const idxXY = genHeaders.findIndex(h => h.includes('xy') || h.includes('gps'));
    if (idxXY === -1) throw new Error("La colonne 'xy' est introuvable.");

    // Repérage des colonnes clés
    window.keyPiste = findCol(['pistes', 'piste']); 
    window.keyType = findCol(['type canon', 'type']);
    window.keyRep = findCol(['répéteur', 'repeteur', 'épéteur', 'epeteur', 'peteur']); 
    window.keyTransfo = findCol(['transfo']);

    // Création des sets pour les filtres
    originalHeaders.forEach(h => { 
        let hl = h.toLowerCase(); 
        if(!hl.includes('xy') && !hl.includes('gps') && !hl.includes('photo')) { 
            window.availableColumns.push(h); 
            window.columnValuesSets[h] = new Set(); 
        } 
    });

    let dictGeneral = {}; 
    let validPointsCount = 0;
    
    // Extraction ligne par ligne
    data.general.slice(1).forEach(row => {
        let idRaw = row[idxId]; 
        if (idRaw == null || idRaw === "") return;
        
        let id = idRaw.toString().replace(/^YA\s*/i, '').trim(); 
        if (!id) return;
        
        let lat = 0, lng = 0;
        if (row[idxXY]) {
            let txt = String(row[idxXY]).replace(/,/g, '.'); 
            let matches = txt.match(/-?\d+(?:\.\d+)?/g);
            if (matches && matches.length >= 2) { 
                lat = parseFloat(matches[0]); lng = parseFloat(matches[1]); 
                // Inversion si nécessaire
                if (lat < 20 && lng > 30) { let temp = lat; lat = lng; lng = temp; } 
            }
        }
        
        let fullData = [];
        originalHeaders.forEach((head, i) => { 
            if(head.trim() !== "") { 
                let val = (i < row.length && row[i] != null) ? row[i].toString() : ""; 
                fullData.push({k: head, v: val}); 
                if(val !== "" && window.columnValuesSets[head]) window.columnValuesSets[head].add(val.trim()); 
            } 
        });
        
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0) validPointsCount++;
        dictGeneral[id] = { id: id, lat: lat, lng: lng, fullData: fullData, historique: {} };
    });
    if (validPointsCount === 0) throw new Error("Aucun point GPS valide détecté.");

    // -----------------------------------------------------
    // PARSING : Historique Volumes
    // -----------------------------------------------------
    window.setStep(3, "Analyse de l'Historique...");
    if (data.historique && data.historique.length > 1) {
        const histHeaders = data.historique[0].map(h => (h||"").toString().toLowerCase().trim()); 
        const idxCanons = 1; 
        let colsEau = {}, colsAir = {}, colsTemps = {}; 
        let saisonsSet = new Set();
        
        histHeaders.forEach((h, i) => { 
            let match = h.match(/(eau|air|marche).*?(\d{2}\/\d{2})/i); 
            if (match) { 
                let t = match[1].toLowerCase(); let s = match[2]; 
                saisonsSet.add(s); 
                if (t.includes('eau')) colsEau[s] = i; 
                if (t.includes('air')) colsAir[s] = i; 
                if (t.includes('marche')) colsTemps[s] = i; 
            } 
        });
        
        window.saisonsList = Array.from(saisonsSet).sort((a,b) => parseInt(a.split('/')[0]) - parseInt(b.split('/')[0])); 
        window.histSeasonIdx = window.saisonsList.length > 0 ? window.saisonsList.length - 1 : 0;
        
        data.historique.slice(1).forEach(row => {
            let rawId = row[idxCanons];
            if (rawId != null && rawId !== "") { 
                let id = rawId.toString().replace(/^YA\s*/i, '').trim(); 
                if (id && dictGeneral[id]) { 
                    window.saisonsList.forEach(s => { 
                        dictGeneral[id].historique[s] = { 
                            eau: colsEau[s] ? parseFloat(row[colsEau[s]])||0 : 0, 
                            air: colsAir[s] ? parseFloat(row[colsAir[s]])||0 : 0, 
                            temps: colsTemps[s] ? parseFloat(row[colsTemps[s]])||0 : 0 
                        }; 
                    }); 
                } 
            }
        });
    }

    // -----------------------------------------------------
    // PARSING : Tickets / Défauts
    // -----------------------------------------------------
    window.setStep(4, "Préparation des Pannes...");
    if (data.tickets && data.tickets.length > 1) {
        const tHeaders = data.tickets[0].map(h => (h||"").toString().toLowerCase().trim()); 
        const originalTHeaders = data.tickets[0].map(h => (h||"").toString().trim());
        
        const idxTEtat = tHeaders.findIndex(h => h.includes('état') || h.includes('etat')); 
        const idxTDate = tHeaders.findIndex(h => h.includes('date')); 
        const idxTRegard = tHeaders.findIndex(h => h.includes('n°regard') || h.includes('regard') || h.includes('canon')); 
        const idxTDefaut = tHeaders.findIndex(h => h.includes('defaut') || h.includes('défaut') || h.includes('panne'));
        
        if(idxTRegard > -1) {
            window.rawTickets = data.tickets.slice(1).map(row => {
                let fullTData = []; 
                originalTHeaders.forEach((h, i) => { 
                    if(h.trim() !== "") { 
                        let val = (i < row.length && row[i] != null) ? row[i].toString() : ""; 
                        fullTData.push({k: h, v: val}); 
                    } 
                });
                
                return { 
                    statut: (idxTEtat > -1 && row[idxTEtat] != null ? row[idxTEtat].toString().toLowerCase().trim() : ""), 
                    date: (idxTDate > -1 && row[idxTDate] != null ? row[idxTDate] : ""), 
                    idCanon: (row[idxTRegard] != null ? row[idxTRegard].toString().replace(/^YA\s*/i, '').trim() : ""), 
                    defaut: (idxTDefaut > -1 && row[idxTDefaut] ? row[idxTDefaut].toString() : "Défaut non spécifié"), 
                    fullData: fullTData 
                };
            });
        }
    }

    // -----------------------------------------------------
    // PARSING : KMZ & Webcams
    // -----------------------------------------------------
    if (data.kmz && data.kmz.length > 1) {
        const kHead = data.kmz[0].map(h => (h||"").toString().toLowerCase().trim());
        const iNom = kHead.findIndex(h => h.includes("nom") || h.includes("calque"));
        const iUrl = kHead.findIndex(h => h.includes("url") || h.includes("lien"));
        const iCol = kHead.findIndex(h => h.includes("couleur"));
        const iWei = kHead.findIndex(h => h.includes("epaisseur") || h.includes("taille"));
        
        if(iNom > -1 && iUrl > -1) {
            window.cloudKmzLayers = [];
            data.kmz.slice(1).forEach((row, index) => {
                let nom = row[iNom]; let url = row[iUrl];
                if(nom && url) {
                    let col = (iCol > -1 && row[iCol]) ? row[iCol].toString().trim() : window.defaultColors[index % window.defaultColors.length];
                    let wei = (iWei > -1 && row[iWei]) ? parseInt(row[iWei]) : 4;
                    window.cloudKmzLayers.push({ nom: nom, url: url, isVisible: false, leafletLayer: null, color: col, weight: wei, commentaire: "" });
                }
            });
        }
    }

    window.setStep(5, "Analyse des Webcams...");
    if (data.webcams && data.webcams.length > 1) {
        const wHead = data.webcams[0].map(h => (h||"").toString().toLowerCase().trim());
        const iNom = wHead.findIndex(h => h.includes("nom")); 
        const iLL = wHead.findIndex(h => h.match(/(gps|xy|lat)/)); 
        const iUrl = wHead.findIndex(h => h.match(/(url|lien)/)); 
        const iIcon = wHead.findIndex(h => h.match(/(icone|logo)/));
        
        if(iNom > -1 && iLL > -1 && iUrl > -1) {
            data.webcams.slice(1).forEach(row => {
                let nom = row[iNom]; 
                let llStr = row[iLL] ? row[iLL].toString() : ""; 
                let url = row[iUrl]; 
                let icon = (iIcon > -1 && row[iIcon]) ? row[iIcon].toString().trim() : "📷"; 
                if(!icon) icon = "📷";
                
                if(nom && llStr && url) {
                    let matches = llStr.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g);
                    if(matches && matches.length >= 2) { 
                        let lat = parseFloat(matches[0]); 
                        let lng = parseFloat(matches[1]); 
                        if (lat < 20 && lng > 30) { let t = lat; lat = lng; lng = t; } 
                        window.webcamsData.push({ nom: nom, lat: lat, lng: lng, url: url, icon: icon }); 
                    }
                }
            });
        }
    }

    // -----------------------------------------------------
    // FINALISATION
    // -----------------------------------------------------
    // Transformation en GeoJSON pour Leaflet
    Object.values(dictGeneral).forEach(canon => { 
        if (canon.lat !== 0 && !isNaN(canon.lat)) { 
            window.snowCannons.features.push({ 
                "type": "Feature", 
                "geometry": { "type": "Point", "coordinates": [canon.lng, canon.lat] }, 
                "properties": canon 
            }); 
        } 
    });

    let ls = document.getElementById('loading-spinner'); if(ls) ls.style.display = 'none';
    let lt = document.getElementById('loading-title'); if(lt) { lt.innerText = "✅ Chargement Réussi !"; lt.style.color = "#27ae60"; }
    let lst = document.getElementById('loading-step'); if(lst) lst.style.display = 'none';
    
    // Lancement de l'interface (sera défini dans ui.js)
    setTimeout(() => { 
        if (typeof window.initAppUI === "function") window.initAppUI(); 
        let ov = document.getElementById('loading-overlay'); 
        if(ov) ov.style.display = 'none'; 
    }, 800);
};
// ---------------------------------------------------------
// 3. SAUVEGARDES VERS GOOGLE SHEETS (Requêtes POST)
// ---------------------------------------------------------

/**
 * Sauvegarde l'édition des coordonnées ou de l'icône d'une webcam
 */
window.saveWebcamEdit = async function(nom, btn) {
    btn.innerText = "⏳..."; 
    btn.disabled = true; 
    
    let mSave = null;
    // Recherche de la webcam ciblée sur la carte
    window.webcamLayerGroup.eachLayer(m => { if(m.wcData.nom === nom) mSave = m; });
    if(!mSave) return;
    
    let nLat = mSave.getLatLng().lat.toFixed(7);
    let nLng = mSave.getLatLng().lng.toFixed(7);
    let inp = document.getElementById('edit-wc-icon');
    let nIco = inp ? inp.value : mSave.wcData.icon;
    
    try {
        let res = await fetch(GOOGLE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "update_webcam", nom: nom, lat: parseFloat(nLat), lng: parseFloat(nLng), icon: nIco })
        });
        let r = await res.json();
        
        if (r.status === "success") {
            // Mise à jour locale si succès
            mSave.dragging.disable();
            mSave.wcData.lat = parseFloat(nLat); mSave.wcData.lng = parseFloat(nLng); mSave.wcData.icon = nIco;
            mSave.setIcon(L.divIcon({ className: 'custom-cannon-icon', html: `<div class="camera-icon">${nIco}</div>`, iconSize: [24,24], iconAnchor: [12,12] }));
            window.openSingleWebcam(nom);
        } else {
            alert("Erreur"); btn.innerText = "✅ Sauver"; btn.disabled = false;
        }
    } catch(e) {
        alert("Échec de la connexion réseau"); btn.disabled = false;
    }
};

/**
 * Sauvegarde les données techniques d'un canon édité
 */
window.saveEditData = async function() {
    if (!window.currentlyEditingId) return;
    let btn = document.getElementById('btn-save-edit');
    btn.innerText = "⏳ Envoi..."; btn.disabled = true;
    
    let fields = {};
    // Récupération de toutes les valeurs des champs dynamiques
    document.querySelectorAll('.dyn-field').forEach(i => fields[i.getAttribute('data-key')] = i.value);
    
    let pl = {
        id: document.getElementById('edit-id').value,
        lat: parseFloat(document.getElementById('edit-lat').value),
        lng: parseFloat(document.getElementById('edit-lng').value),
        fields: fields
    };
    
    try {
        let res = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(pl) });
        let r = await res.json();
        
        if (r.status === "success") {
            // Mise à jour locale en direct
            let l = window.selectedCannonsMap.get(window.currentlyEditingId);
            let p = l.feature.properties;
            p.fullData.forEach(item => { if (fields[item.k] !== undefined) item.v = fields[item.k]; });
            
            // Mise à jour de la couleur si le type a changé
            let tLower = window.getV(p, window.keyType).toLowerCase().trim();
            if (["demak lenko", "demac lenko"].includes(tLower)) p.couleur_defaut = "#0000FF";
            else if (["sufag", "street", "taurus", "taurax", "peak"].includes(tLower)) p.couleur_defaut = "#008000";
            else p.couleur_defaut = window.technoColors[tLower] || "#FFD700";
            
            l.feature.geometry.coordinates = [pl.lng, pl.lat];
            l.setLatLng([pl.lat, pl.lng]);
            window.cancelEdit();
        } else { alert("Erreur Google"); }
    } catch(err) { alert("Échec réseau"); }
    
    btn.innerText = "✅ Sauvegarder"; btn.disabled = false;
};

/**
 * Sauvegarde en masse le statut de suivi d'entretien (toute la piste ou sélection)
 */
window.saveMultiSuivi = async function(btn, explicitPiste) {
    let payloads = [];
    let containers = document.querySelectorAll('[id^="chk-dec-"]');
    
    // Construction du tableau de données à envoyer
    containers.forEach(chk => {
        let id = chk.id.replace('chk-dec-single-', '').replace('chk-dec-', '');
        let chkPrev = document.getElementById(`chk-prev-single-${id}`) || document.getElementById(`chk-prev-${id}`);
        let txtRem = document.getElementById(`rem-single-${id}`) || document.getElementById(`rem-${id}`);
        if (!chkPrev) return;

        let piste = explicitPiste;
        if (!piste) {
            let pLayer = window.selectedCannonsMap.get(id);
            if (pLayer) piste = window.getV(pLayer.feature.properties, window.keyPiste);
            else piste = "Inconnue";
        }

        payloads.push({
            idCanon: id, piste: piste, deconnexion: chk.checked, preventif: chkPrev.checked,
            vanneCorrectif: window.getActiveTickets(id).map(t => t.defaut).join(" | "), remarque: txtRem ? txtRem.value : ""
        });
    });

    if (payloads.length === 0) return;

    let oldText = btn.innerText; btn.innerText = "⏳ Sauvegarde en cours..."; btn.disabled = true;
    try {
        const response = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify({ action: "update_suivi_multi", payloads: payloads }) });
        const result = await response.json();
        if (result.status === "success") {
            // Application des modifications en local
            payloads.forEach(payload => {
                let existingRow = window.suiviEntretienData.find(row => row[0] == payload.idCanon);
                if (existingRow) { 
                    existingRow[2] = payload.deconnexion ? "oui" : "non"; 
                    existingRow[3] = payload.preventif ? "oui" : "non"; 
                    existingRow[5] = payload.remarque; 
                } else { 
                    window.suiviEntretienData.push([payload.idCanon, payload.piste, payload.deconnexion ? "oui" : "non", payload.preventif ? "oui" : "non", payload.vanneCorrectif, payload.remarque, ""]); 
                }
            });
            btn.innerText = "✅ Succès !"; 
            window.updateMap();
            if (!explicitPiste && window.triggerGlobalFilterChart) window.triggerGlobalFilterChart(); 
            setTimeout(() => { btn.innerText = oldText; btn.disabled = false; }, 2000);
        } else { alert("Erreur Google"); btn.innerText = oldText; btn.disabled = false; }
    } catch(e) { alert("Échec réseau."); btn.innerText = oldText; btn.disabled = false; }
};

/**
 * Confirme et envoie la modification d'un ticket de panne
 */
window.confirmSaveTicket = async function(canonId, defaut, idDiv) {
    let temp = window.tempTicketPayloads[idDiv]; 
    if(!temp) return; 
    
    let el = document.getElementById(idDiv); 
    if(el) el.innerHTML = `<div style="text-align:center; padding:20px; font-weight:bold; color:#3498db; font-size:14px;">Enregistrement Google... ⏳</div>`;
    
    try {
        const response = await fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify(temp.payload) }); 
        const result = await response.json();
        
        if(result.status === "success") {
            let ticket = window.rawTickets.find(t => t.idCanon == canonId && t.defaut == defaut);
            if(ticket) { 
                ticket.fullData.forEach(d => { if(temp.payload.fields[d.k] !== undefined) d.v = temp.payload.fields[d.k]; }); 
                if(temp.newStatut) ticket.statut = temp.newStatut.toLowerCase(); 
                let defField = ticket.fullData.find(x => x.k.toLowerCase().includes('defaut') || x.k.toLowerCase().includes('défaut') || x.k.toLowerCase().includes('panne')); 
                if (defField && temp.payload.fields[defField.k]) ticket.defaut = temp.payload.fields[defField.k].toString().trim(); 
            }
            if(window.renderSelectionPanel) window.renderSelectionPanel(); 
            window.updateMap(); 
            if(window.triggerGlobalFilterChart) window.triggerGlobalFilterChart(); 
            delete window.tempTicketPayloads[idDiv];
        } else { alert("Erreur Google"); if(window.renderSelectionPanel) window.renderSelectionPanel(); }
    } catch(e) { alert("Échec réseau."); if(window.renderSelectionPanel) window.renderSelectionPanel(); }
};
