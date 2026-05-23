/* =========================================================
   Fichier : js/map.js
   Rôle : Logique de la carte Leaflet, couleurs et calques KMZ
   ========================================================= */

// ---------------------------------------------------------
// 1. GESTION DES COULEURS ET DE L'AFFICHAGE DES MARQUEURS
// ---------------------------------------------------------

/**
 * Calcule la couleur d'un canon en fonction du filtre actif (Thème)
 */
window.getColorByFilter = function(ratio, p) {
    // Fonction utilitaire pour créer un dégradé de couleur
    const inter = (c1, c2, f) => {
        let r = c1.slice();
        for(let i = 0; i < 3; i++) r[i] = Math.round(r[i] + f * (c2[i] - c1[i]));
        return `rgb(${r[0]},${r[1]},${r[2]})`;
    };
    
    // Thème : Pannes et Tickets
    if (window.mainTheme === 'defauts') {
        let act = window.getActiveTickets(p.id);
        if (act.length === 0) return '#bdc3c7'; // Gris si RAS
        if (act.some(t => t.statut.includes('faire'))) return '#e74c3c'; // Rouge si urgent
        return '#f39c12'; // Orange si en cours
    }
    
    // Thème : Historique (Dégradés)
    if (window.mainTheme === 'historique') {
        if (window.histMetric === 'eau') return inter([173,216,230], [41,128,185], ratio);
        if (window.histMetric === 'air') return inter([250,219,94], [211,84,0], ratio);
        if (window.histMetric === 'temps') return inter([171,235,198], [39,174,96], ratio);
    }
    
    // Autres Thèmes spécifiques
    if (window.mainTheme === 'repeteur') return window.repColors[window.getV(p, window.keyRep)] || '#7f8c8d';
    if (window.mainTheme === 'transfo') return window.transfoColors[window.getV(p, window.keyTransfo)] || '#7f8c8d';
    
    // Thème par défaut (Types de canons)
    let tv = window.getV(p, window.keyType).toLowerCase();
    if (["demak lenko", "demac lenko"].includes(tv)) return "#0000FF";
    if (["sufag", "street", "taurus", "taurax", "peak"].includes(tv)) return "#008000";
    return window.technoColors[tv] || "#FFD700";
};

/**
 * Mise à jour de la carte complète (Boucle sur chaque canon)
 */
window.updateMap = function() {
    if (!window.geojsonLayer) return;
    let s = window.saisonsList[window.histSeasonIdx];
    
    window.geojsonLayer.eachLayer(function(layer) {
        const p = layer.feature.properties; 
        let vis = true;
        
        // Application des filtres rapides de la barre latérale
        if (window.currentPistes && !window.currentPistes.includes('all')) { if (!window.currentPistes.includes(window.getV(p, window.keyPiste))) vis = false; }
        if (window.currentTypes && !window.currentTypes.includes('all')) { if (!window.currentTypes.includes(window.getV(p, window.keyType).toLowerCase())) vis = false; }
        window.activeFilters.forEach(filt => { 
            if(filt.key && filt.vals.length > 0 && !filt.vals.includes('all')) { 
                let val = window.getV(p, filt.key); 
                if(!filt.vals.includes(val)) vis = false; 
            } 
        });
        
        // Application du filtre de curseur (Slider Historique)
        let val = 0;
        if (window.mainTheme === 'historique') {
            val = p.historique[s] ? parseFloat(p.historique[s][window.histMetric]) : 0;
            if (isNaN(val)) val = 0;
            let minT = parseFloat(window.currentMinThreshold[window.histMetric]) || 0;
            let maxT = parseFloat(window.currentMaxThreshold[window.histMetric]) || Infinity;
            if (val < minT || val > maxT) vis = false;
        }

        // Gestion de l'affichage (Masquer ou Afficher)
        if (!vis) {
            p._isVisible = false; 
            if (window.map.hasLayer(layer)) window.map.removeLayer(layer);
        } else {
            p._isVisible = true; 
            if (!window.map.hasLayer(layer)) window.map.addLayer(layer);
            
            // Calcul du design du marqueur
            let rad = 12; let ratio = 0; let bgStr = ""; let iconChar = p.id; let lh = '24px';
            let remarkBadge = ""; 
            
            if (window.mainTheme === 'historique') { 
                let maxVal = window.absoluteMaxes[window.histMetric] || 1; 
                ratio = val / maxVal; 
                rad = 10 + (15 * ratio); 
                bgStr = window.getColorByFilter(ratio, p);
            } else if (window.mainTheme === 'suivi_entretien') {
                let acts = window.getActiveTickets(p.id); let hasFault = acts.length > 0;
                let suivi = window.suiviEntretienData.find(row => row[0] == p.id) || ["", "", "non", "non", "", "", ""];
                let dec = suivi[2] && suivi[2].toString().toLowerCase().trim() === "oui";
                let prev = suivi[3] && suivi[3].toString().toLowerCase().trim() === "oui";
                let rem = suivi[5] || ""; 

                let colors = [];
                if(hasFault) colors.push('#e74c3c'); 
                if(prev) colors.push('#9b59b6');     
                if(dec) colors.push('#27ae60');      

                bgStr = '#f1c40f'; 
                if(colors.length === 3) bgStr = `conic-gradient(${colors[0]} 0 33%, ${colors[1]} 33% 66%, ${colors[2]} 66% 100%)`;
                else if(colors.length === 2) bgStr = `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`;
                else if(colors.length === 1) bgStr = colors[0];

                if (!dec) {
                    iconChar = `⚡<br><span style="font-size:8px;">${p.id}</span>`;
                    lh = '12px';
                }
                
                if (rem.toString().trim() !== "") {
                    remarkBadge = `<div title="${rem.replace(/"/g, '&quot;')}" style="position:absolute; top:-6px; right:-6px; background:#e67e22; color:white; width:16px; height:16px; border-radius:50%; font-size:12px; font-weight:bold; text-align:center; line-height:16px; border:1px solid #fff; box-shadow:0 1px 3px rgba(0,0,0,0.5); z-index:10; pointer-events:auto; cursor:help;">!</div>`;
                }
            } else {
                bgStr = window.getColorByFilter(0, p);
            }

            // Gestion de l'état de sélection (Bordures)
            let bord = window.selectedCannonsMap.has(p.id) ? "#2c3e50" : (window.currentlyEditingId === p.id ? "#e74c3c" : "white");
            let bw = window.selectedCannonsMap.has(p.id) ? "3px" : (window.currentlyEditingId === p.id ? "4px" : "1.5px");
            let fsz = Math.max(9, rad - 4) + "px"; 
            let zIdx = window.currentlyEditingId === p.id ? 2000 : (window.selectedCannonsMap.has(p.id) ? 1000 : 0);
            layer.setZIndexOffset(zIdx);

            let actClass = (window.mainTheme !== 'suivi_entretien' && window.mainTheme === 'defauts' && window.getActiveTickets(p.id).some(t => t.statut.includes('faire'))) ? "alert-urgent" : "";
            
            // Application de l'icône Leaflet HTML
            layer.setIcon(L.divIcon({ 
                className: 'custom-cannon-icon', 
                html: `<div class="cannon-circle ${actClass}" style="background:${bgStr}; width:${rad*2}px; height:${rad*2}px; line-height:${lh}; border:${bw} solid ${bord}; font-size:${fsz}; position:relative;">${iconChar}${remarkBadge}</div>`, 
                iconSize: [rad*2, rad*2], 
                iconAnchor: [rad, rad] 
            }));
            
            layer.setOpacity(1); 
            if(layer._icon) { layer._icon.style.opacity = '1'; layer._icon.style.transform = layer._icon.style.transform.replace(' scale(1.3)', ''); }
        }
    });
};

/**
 * Centre la caméra et sélectionne un canon spécifique
 */
window.focusCannon = function(id) {
    window.geojsonLayer.eachLayer(l => {
        if(l.feature.properties.id === id) {
            if(!window.isMultiSelect && window.mainTheme !== 'suivi_entretien') window.selectedCannonsMap.clear();
            window.selectedCannonsMap.set(id, l);
            window.map.setView(l.getLatLng(), 17);
            window.updateMap(); 
            if(window.renderSelectionPanel) window.renderSelectionPanel();
            document.getElementById('right-sidebar').classList.add('open');
        }
    });
};

// ---------------------------------------------------------
// 2. HIGHLIGHTS & SURVOL DES LÉGENDES
// ---------------------------------------------------------
window.highlightLegend = function(theme, val) {
    if (theme === 'historique' || theme === 'suivi_entretien') return; 
    if(!window.geojsonLayer) return;
    
    window.geojsonLayer.eachLayer(function(layer) {
        if(!layer.feature.properties._isVisible) return;
        let p = layer.feature.properties; let match = false;
        
        if (theme === 'defauts') { 
            let act = window.getActiveTickets(p.id); 
            if (val === 'urgent' && act.some(t => t.statut.includes('faire'))) match = true; 
            else if (val === 'encours' && act.some(t => t.statut.includes('cours'))) match = true; 
            else if (val === 'ras' && act.length === 0) match = true; 
        } else if (theme === 'type') { 
            let tLower = window.getV(p, window.keyType).toLowerCase(); 
            if (val === 'demac' && ["demak lenko", "demac lenko"].includes(tLower)) match = true; 
            else if (val === 'sufag' && ["sufag", "street", "taurus", "taurax", "peak"].includes(tLower)) match = true; 
            else if (val === 'techno' && !["demak lenko", "demac lenko", "sufag", "street", "taurus", "taurax", "peak"].includes(tLower) && tLower !== "n/a") match = true; 
        } else if (theme === 'repeteur') { 
            if (window.getV(p, window.keyRep) === val) match = true; 
        } else if (theme === 'transfo') { 
            if (window.getV(p, window.keyTransfo) === val) match = true; 
        }
        
        if (match) { 
            layer.setOpacity(1); layer.setZIndexOffset(2000); 
            if(layer._icon) { layer._icon.style.opacity = "1"; if(!layer._icon.style.transform.includes('scale(1.3)')) layer._icon.style.transform += ' scale(1.3)'; } 
        } else { 
            layer.setOpacity(0.2); layer.setZIndexOffset(0); 
            if(layer._icon) { layer._icon.style.opacity = "0.2"; layer._icon.style.transform = layer._icon.style.transform.replace(' scale(1.3)', ''); } 
        }
    });
};

window.resetHighlight = function() { 
    if(!window.geojsonLayer) return; 
    window.geojsonLayer.eachLayer(function(layer) { 
        layer.setOpacity(1); 
        if(layer._icon) { layer._icon.style.opacity = "1"; layer._icon.style.transform = layer._icon.style.transform.replace(' scale(1.3)', ''); } 
    }); 
    window.updateMap(); 
};

// ---------------------------------------------------------
// 3. GESTION DES CALQUES KMZ & BASE LOCALE (IndexedDB)
// ---------------------------------------------------------
window.initLocalDB = function() { 
    try { 
        if (!window.indexedDB) return; 
        const request = window.indexedDB.open("GMAONeigeDB", 2); 
        request.onupgradeneeded = function(event) { 
            window.localDB = event.target.result; 
            if (!window.localDB.objectStoreNames.contains("kmz_layers")) window.localDB.createObjectStore("kmz_layers", { keyPath: "id" }); 
        }; 
        request.onsuccess = function(event) { 
            window.localDB = event.target.result; 
            window.loadSavedLayersFromDB(); 
        }; 
    } catch(e) {} 
};

window.saveLayerToDB = function(id, name, geojson, color, weight) { 
    if(!window.localDB) return; 
    const tx = window.localDB.transaction("kmz_layers", "readwrite"); 
    tx.objectStore("kmz_layers").put({ id: id, name: name, geojson: geojson, isVisible: true, color: color, weight: weight }); 
};

window.deleteLayerFromDB = function(id) { 
    if(!window.localDB) return; 
    const tx = window.localDB.transaction("kmz_layers", "readwrite"); 
    tx.objectStore("kmz_layers").delete(id); 
};

window.updateLayerDataInDB = function(id, updates) { 
    if(!window.localDB) return; 
    const tx = window.localDB.transaction("kmz_layers", "readwrite"); 
    const store = tx.objectStore("kmz_layers"); 
    const req = store.get(id); 
    req.onsuccess = function() { 
        let data = req.result; 
        if(data) { Object.assign(data, updates); store.put(data); } 
    }; 
};

window.loadSavedLayersFromDB = function() { 
    if(!window.localDB) return; 
    const tx = window.localDB.transaction("kmz_layers", "readonly"); 
    const req = tx.objectStore("kmz_layers").getAll(); 
    req.onsuccess = function() { 
        req.result.forEach(item => { window.addGeoJsonToMap(item.id, item.name, item.geojson, item.isVisible, item.color || '#e67e22', item.weight || 4); }); 
    }; 
};

window.buildGeoJsonStyle = function(hexColor, weight) { 
    let finalWeight = weight ? parseInt(weight) : 4; 
    return { 
        style: function (feature) { return { color: hexColor, weight: finalWeight, opacity: 0.8, fillColor: hexColor }; }, 
        pointToLayer: function(feature, latlng) { return L.circleMarker(latlng, {radius: 6, color: hexColor, fillColor: hexColor, fillOpacity: 0.8, weight: 1}); }, 
        onEachFeature: function (feature, layer) { 
            if (feature.properties && feature.properties.name) { 
                layer.bindPopup(`<b style='color:${hexColor}'>` + feature.properties.name + "</b><br>" + (feature.properties.description || "")); 
            } 
        } 
    }; 
};

window.fetchGitHubKMZ = async function(url) { 
    const response = await window.fetchWithTimeout(url); 
    if (!response.ok) throw new Error("Accès refusé au fichier distant."); 
    let kmlString = ""; 
    
    // Décompression si c'est un fichier KMZ
    if (url.toLowerCase().endsWith('.kmz')) { 
        const blob = await response.blob(); 
        const arrayBuffer = await blob.arrayBuffer(); 
        const zip = await JSZip.loadAsync(arrayBuffer); 
        const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml')); 
        if (!kmlFile) throw new Error("Aucun fichier KML trouvé dans l'archive."); 
        kmlString = await kmlFile.async("string"); 
    } else { 
        kmlString = await response.text(); 
    } 
    
    // Conversion XML vers GeoJSON
    const parser = new DOMParser(); 
    const xmlDoc = parser.parseFromString(kmlString, "text/xml"); 
    return toGeoJSON.kml(xmlDoc); 
};

// ---------------------------------------------------------
// 4. MANIPULATION DES CALQUES (Affichage/Import)
// ---------------------------------------------------------
window.toggleCloudLayer = async function(idx) { 
    let layerObj = window.cloudKmzLayers[idx]; 
    let cbx = document.getElementById('cloud-cbx-' + idx); 
    let statusSpan = document.getElementById('cloud-status-' + idx); 
    if (!cbx || !statusSpan) return; 
    
    // Masquer le calque
    if (!cbx.checked) { 
        if(layerObj.leafletLayer) window.map.removeLayer(layerObj.leafletLayer); 
        layerObj.isVisible = false; statusSpan.innerText = ""; return; 
    } 
    
    // Afficher un calque déjà chargé
    if (layerObj.leafletLayer) { 
        window.map.addLayer(layerObj.leafletLayer); layerObj.isVisible = true; return; 
    } 
    
    // Chargement initial du calque distant
    statusSpan.innerText = " ⏳"; cbx.disabled = true; 
    try { 
        const geojson = await window.fetchGitHubKMZ(layerObj.url); 
        layerObj.leafletLayer = L.geoJSON(geojson, window.buildGeoJsonStyle(layerObj.color, layerObj.weight)).addTo(window.map); 
        layerObj.isVisible = true; 
        if(layerObj.leafletLayer.getBounds().isValid()) { window.map.fitBounds(layerObj.leafletLayer.getBounds()); } 
        statusSpan.innerText = " ✅"; 
    } catch(err) { 
        statusSpan.innerText = " ❌"; alert("Erreur calque : " + err.message); cbx.checked = false; 
    } 
    cbx.disabled = false; 
};

window.changeCloudLayerStyle = function(idx, newColor, newWeight) { 
    let layerObj = window.cloudKmzLayers[idx]; 
    if (newColor !== null) layerObj.color = newColor; 
    if (newWeight !== null) layerObj.weight = parseInt(newWeight); 
    
    fetch(GOOGLE_API_URL, { method: 'POST', body: JSON.stringify({ action: 'update_kmz', nom: layerObj.nom, color: layerObj.color, weight: layerObj.weight }) }); 
    
    if(layerObj.leafletLayer) { 
        layerObj.leafletLayer.setStyle({ color: layerObj.color, fillColor: layerObj.color, weight: layerObj.weight }); 
        layerObj.leafletLayer.eachLayer(function (layer) { 
            if (layer instanceof L.CircleMarker) { layer.setStyle({ color: layerObj.color, fillColor: layerObj.color }); } 
        }); 
    } 
};

window.handleKMLUpload = async function(event) { 
    const file = event.target.files[0]; if(!file) return; 
    let ov = document.getElementById('loading-overlay'); if(ov) ov.style.display = 'flex'; 
    let ti = document.getElementById('loading-title'); if(ti) ti.innerText = "Importation locale..."; 
    
    setTimeout(async () => { 
        try { 
            const fileName = file.name; const layerId = 'layer_' + Date.now(); 
            let kmlString = ""; let defaultColor = '#e67e22'; let defaultWeight = 4; 
            
            if (fileName.toLowerCase().endsWith('.kmz')) { 
                const arrayBuffer = await file.arrayBuffer(); 
                const zip = await JSZip.loadAsync(arrayBuffer); 
                const kmlFile = Object.values(zip.files).find(f => f.name.toLowerCase().endsWith('.kml')); 
                if (!kmlFile) throw new Error("Aucun fichier KML trouvé."); 
                kmlString = await kmlFile.async("string"); 
            } else if (fileName.toLowerCase().endsWith('.kml')) { 
                kmlString = await file.text(); 
            } else { throw new Error("Format non supporté."); } 
            
            const parser = new DOMParser(); 
            const xmlDoc = parser.parseFromString(kmlString, "text/xml"); 
            const geojson = toGeoJSON.kml(xmlDoc); 
            
            window.saveLayerToDB(layerId, fileName, geojson, defaultColor, defaultWeight); 
            window.addGeoJsonToMap(layerId, fileName, geojson, true, defaultColor, defaultWeight); 
            if(ov) ov.style.display = 'none'; 
        } catch (err) { 
            if(ov) ov.style.display = 'none'; alert("Erreur d'import : " + err.message); 
        } 
        event.target.value = ""; 
    }, 100); 
};

window.addGeoJsonToMap = function(id, name, geojson, isVisible, hexColor, weight) { 
    let finalWeight = weight || 4; 
    const layer = L.geoJSON(geojson, window.buildGeoJsonStyle(hexColor, finalWeight)); 
    if(isVisible) layer.addTo(window.map); 
    window.externalLayers[id] = { name: name, layer: layer, isVisible: isVisible, color: hexColor, weight: finalWeight }; 
    if(window.renderCustomLayersList) window.renderCustomLayersList(); 
    if(isVisible && layer.getBounds && typeof layer.getBounds === 'function') { 
        let b = layer.getBounds(); if(b.isValid()) window.map.fitBounds(b); 
    } 
};

window.toggleExtLayer = function(id) { 
    const ext = window.externalLayers[id]; 
    ext.isVisible = !ext.isVisible; 
    if(ext.isVisible) window.map.addLayer(ext.layer); else window.map.removeLayer(ext.layer); 
    window.updateLayerDataInDB(id, { isVisible: ext.isVisible }); 
    if(window.renderCustomLayersList) window.renderCustomLayersList(); 
};

window.changeExtLayerStyle = function(id, newColor, newWeight) { 
    if(window.externalLayers[id]) { 
        if (newColor !== null) window.externalLayers[id].color = newColor; 
        if (newWeight !== null) window.externalLayers[id].weight = parseInt(newWeight); 
        let col = window.externalLayers[id].color; let w = window.externalLayers[id].weight; 
        if(window.externalLayers[id].layer) { 
            window.externalLayers[id].layer.setStyle({color: col, fillColor: col, weight: w}); 
            window.externalLayers[id].layer.eachLayer(function (layer) { if (layer instanceof L.CircleMarker) layer.setStyle({ color: col, fillColor: col }); }); 
        } 
        window.updateLayerDataInDB(id, { color: col, weight: w }); 
    } 
};

window.deleteExtLayer = function(id) { 
    window.map.removeLayer(window.externalLayers[id].layer); 
    delete window.externalLayers[id]; 
    window.deleteLayerFromDB(id); 
    if(window.renderCustomLayersList) window.renderCustomLayersList(); 
};
