/* =========================================================
   Fichier : js/main.js
   Rôle : Initialisation et démarrage de l'application
   ========================================================= */

// ---------------------------------------------------------
// 1. INITIALISATION DE L'INTERFACE APRÈS LE CHARGEMENT DES DONNÉES
// ---------------------------------------------------------
window.initAppUI = function() {
    let ts=new Set(), rs=new Set(), trs=new Set(), ps=new Set();
    
    // Extraction des filtres uniques
    window.snowCannons.features.forEach(f => {
        let p=f.properties;
        let t=window.getV(p,window.keyType); if(t!=="N/A") ts.add(t.toLowerCase());
        let r=window.getV(p,window.keyRep); if(r!=="N/A") rs.add(r);
        let tr=window.getV(p,window.keyTransfo); if(tr!=="N/A") trs.add(tr);
        let pi=window.getV(p,window.keyPiste); if(pi!=="N/A") ps.add(pi);
    });
    
    // Attribution des couleurs
    let tc=['#3498db','#e74c3c','#2ecc71','#f1c40f','#9b59b6']; 
    Array.from(ts).sort().forEach((t,i) => window.technoColors[t] = tc[i%tc.length]);
    
    let rc=['#1abc9c','#16a085','#f39c12','#d35400','#8e44ad']; 
    Array.from(rs).sort().forEach((r,i) => window.repColors[r] = rc[i%rc.length]);
    
    let neonColors = ['#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#00FFFF', '#FF8C00', '#FF1493', '#39FF14']; 
    Array.from(trs).sort().forEach((t,i) => window.transfoColors[t] = neonColors[i%neonColors.length]);
    
    window.snowCannons.features.forEach(f => {
        let t=window.getV(f.properties,window.keyType).toLowerCase();
        f.properties.couleur_defaut = (["demak lenko","demac lenko"].includes(t)) ? "#0000FF" : (["sufag","street","taurus","taurax","peak"].includes(t)) ? "#008000" : window.technoColors[t]||"#FFD700";
    });
    
    // Datalists (Autocomplétion formulaires)
    let dlContainer = document.getElementById('datalists-container');
    if (dlContainer) { 
        let dlHtml = ""; 
        for(let header in window.columnValuesSets) { 
            let safeId = "dl-" + header.replace(/[^a-zA-Z0-9]/g, '-'); 
            dlHtml += `<datalist id="${safeId}">${Array.from(window.columnValuesSets[header]).sort().map(v=>`<option value="${v}">`).join('')}</datalist>`; 
        } 
        dlContainer.innerHTML = dlHtml; 
    }

    // Gestion du slider des Saisons
    let sld = document.getElementById('season-slider');
    if (window.saisonsList.length > 0 && sld) { 
        sld.max = window.saisonsList.length - 1; 
        sld.value = window.histSeasonIdx; 
        let sdisp = document.getElementById('season-display'); 
        if(sdisp) sdisp.innerText = window.saisonsList[window.histSeasonIdx]; 
    }

    // Construction des Checkboxes Pistes et Types
    function buildCbs(id, set, cls) { 
        const c = document.getElementById(id); if(!c) return; 
        c.innerHTML = ''; 
        [...set].sort().forEach(v => { 
            let l=document.createElement('label'); 
            let cb=document.createElement('input'); 
            cb.type='checkbox'; cb.className=cls; cb.value=v; 
            l.appendChild(cb); l.appendChild(document.createTextNode(' '+v)); 
            c.appendChild(l); 
        }); 
    }
    buildCbs('individual-pistes', ps, 'piste-cb'); 
    buildCbs('individual-types', ts, 'type-cb');

    function setupCbs(allId, cls, cbk) { 
        const aBtn = document.getElementById(allId); if(!aBtn) return;
        const cbs = document.querySelectorAll('.'+cls); 
        const getVals = () => aBtn.checked ? ['all'] : Array.from(cbs).filter(c=>c.checked).map(c=>c.value); 
        aBtn.addEventListener('change', e => { if(e.target.checked) cbs.forEach(c=>c.checked=false); cbk(getVals()); }); 
        cbs.forEach(c => c.addEventListener('change', () => { if(c.checked) { if(aBtn) aBtn.checked=false; } else if(Array.from(cbs).every(x=>!x.checked)) { if(aBtn) aBtn.checked=true; } cbk(getVals()); })); 
    }
    setupCbs('check-all-pistes', 'piste-cb', vals => { window.currentPistes = vals; window.updateMap(); window.triggerGlobalFilterChart(); }); 
    setupCbs('check-all-types', 'type-cb', vals => { window.currentTypes = vals; window.updateMap(); window.triggerGlobalFilterChart(); });

    // Initialisation des éléments
    window.generateDynamicFiltersUI(); 
    window.renderCloudLayersList(); 
    window.calculateMaxes();

    // ---------------------------------------------------------
    // 2. CRÉATION DES MARQUEURS LEAFLET (Canons et Webcams)
    // ---------------------------------------------------------
    window.geojsonLayer = L.geoJSON(window.snowCannons, {
        pointToLayer: function (feature, latlng) { return L.marker(latlng, { icon: L.divIcon({ className: 'custom-cannon-icon', html: `<div></div>` }) }); },
        onEachFeature: function (feature, layer) {
            layer.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                if (window.currentlyEditingId) return; 
                const id = feature.properties.id;
                
                if (window.selectedCannonsMap.has(id)) {
                    window.selectedCannonsMap.delete(id); 
                } else {
                    window.selectedCannonsMap.set(id, layer);
                }
                
                if(window.map) window.map.setView(layer.getLatLng(), 17, {animate: true});
                window.updateMap(); window.renderSelectionPanel();
                let sb = document.getElementById('right-sidebar'); if (window.selectedCannonsMap.size > 0 && sb) sb.classList.add('open');
            });
        }
    }).addTo(window.map);

    if (window.snowCannons.features.length > 0) { 
        let bounds = window.geojsonLayer.getBounds(); 
        if(bounds.isValid() && window.map) window.map.fitBounds(bounds, { padding: [30, 30] }); 
    }

    // Webcams
    window.webcamLayerGroup = L.layerGroup();
    window.webcamsData.forEach(wc => {
        let marker = L.marker([wc.lat, wc.lng], { icon: L.divIcon({ className: 'custom-cannon-icon', html: `<div class="camera-icon">${wc.icon}</div>`, iconSize: [24,24], iconAnchor: [12,12] }), draggable: false });
        marker.on('click', function(e) { 
            L.DomEvent.stopPropagation(e); 
            if(marker.dragging && marker.dragging.enabled()) return; 
            if(window.map) window.map.setView([wc.lat, wc.lng], 17, {animate: true});
            window.openSingleWebcam(wc.nom); 
        });
        marker.wcData = wc; window.webcamLayerGroup.addLayer(marker);
    });
    window.webcamLayerGroup.addTo(window.map);
    
    // ---------------------------------------------------------
    // 3. ECOUTEURS D'ÉVÉNEMENTS (Thèmes, sliders, carte)
    // ---------------------------------------------------------
    document.querySelectorAll('input[name="main_theme"]').forEach(r => {
        r.addEventListener('change', e => {
            window.mainTheme = e.target.value;
            document.querySelectorAll('.theme-details, .theme-details-hist').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.radio-card').forEach(el => { el.style.borderBottomLeftRadius = '6px'; el.style.borderBottomRightRadius = '6px'; el.style.marginBottom = '8px'; el.style.borderColor = '#e1e8ed'; el.style.borderTop = '1px solid #e1e8ed'; });
            
            let activeDetails = document.getElementById('details-' + window.mainTheme); 
            let activeLabel = document.getElementById('lbl-' + window.mainTheme);
            
            if (activeDetails && activeLabel) { 
                activeDetails.style.display = 'block'; 
                activeLabel.style.borderBottomLeftRadius = '0'; 
                activeLabel.style.borderBottomRightRadius = '0'; 
                activeLabel.style.marginBottom = '0'; 
                if(window.mainTheme === 'historique') activeLabel.style.borderColor = '#2ecc71'; 
                else if(window.mainTheme === 'suivi_entretien') activeLabel.style.borderColor = '#27ae60'; 
                else activeLabel.style.borderColor = '#3498db'; 
            }
            
            if(window.mainTheme === 'historique') window.calculateMaxes(); 
            window.updateLegend(); window.updateMap(); window.triggerGlobalFilterChart();
            
            if(window.mainTheme === 'suivi_entretien') document.getElementById('right-sidebar').classList.add('open');
        });
    });

    document.querySelectorAll('input[name="hist_metric"]').forEach(r => { 
        r.addEventListener('change', e => { window.histMetric = e.target.value; window.calculateMaxes(); window.updateLegend(); window.updateMap(); window.triggerGlobalFilterChart(); }); 
    });
    
    let ssl = document.getElementById('season-slider'); 
    if(ssl) ssl.addEventListener('input', e => { 
        window.histSeasonIdx = parseInt(e.target.value); 
        let sd = document.getElementById('season-display'); 
        if(sd) sd.innerText = window.saisonsList[window.histSeasonIdx]; 
        window.calculateMaxes(); window.updateLegend(); window.updateMap(); window.triggerGlobalFilterChart(); 
    });
    
    let dfc = document.getElementById('dynamic-filters-container'); 
    if(dfc) dfc.addEventListener('change', e => { 
        if(e.target.classList.contains('filter-select')) window.renderCheckboxesForFilter(e.target.getAttribute('data-idx'), e.target.value); 
    });
    
    if(window.map) {
        window.map.on('click', function(e) {
            let amc = document.getElementById('allow-move-chk');
            if (window.currentlyEditingId && amc && amc.checked) { 
                let elat = document.getElementById('edit-lat'); if(elat) elat.value = e.latlng.lat.toFixed(7); 
                let elng = document.getElementById('edit-lng'); if(elng) elng.value = e.latlng.lng.toFixed(7); 
                let layer = window.selectedCannonsMap.get(window.currentlyEditingId);
                if(layer) { layer.setLatLng(e.latlng); layer.feature.geometry.coordinates = [e.latlng.lng, e.latlng.lat]; }
            } else { 
                window.closeRightSidebar(); 
            }
        });
    }

    // Affichage initial
    setTimeout(window.initSidebarResizer, 1000);
    window.updateLegend(); 
    window.updateMap(); 
    window.triggerGlobalFilterChart();
};

// ---------------------------------------------------------
// 4. DÉMARRAGE DE L'APPLICATION
// ---------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
    if(window.bootAttempt > 0) return;
    window.bootAttempt = 1;
    try {
        window.setStep(0, "Initialisation de la carte...");
        let retries = 0;
        // Attente du chargement des bibliothèques externes
        while ((typeof L === 'undefined' || typeof JSZip === 'undefined' || typeof Chart === 'undefined') && retries < 50) { 
            await new Promise(r => setTimeout(r, 100)); 
            retries++; 
        }
        if (typeof L === 'undefined') throw new Error("Impossible de charger la carte (Leaflet). Vérifiez votre pare-feu.");
        
        // Création de la carte
        window.satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 18 });
        window.map = L.map('map', {zoomControl: false, layers: [window.satLayer]}).setView([42.766, 0.564], 14);
        L.control.zoom({ position: 'bottomright' }).addTo(window.map);
        
        // Initialisations data
        window.initLocalDB();
        await window.fetchGoogleSheetsData(); // Appelle initAppUI() à la fin de son exécution
    } catch (err) { 
        window.showCrash(err.message, "Boot Principal"); 
    }
});

setTimeout(() => { 
    if(window.bootAttempt === 0) { window.document.dispatchEvent(new Event("DOMContentLoaded")); } 
}, 2000);
