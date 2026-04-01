// ==========================================
// 1. CONFIGURATION ET FONDS DE CARTE
// ==========================================
proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs");

const map = L.map('map', { doubleClickZoom: false }).setView([42.7645, 0.5833], 15);

const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri Satellite' });
const planOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenTopoMap' });

satellite.addTo(map);
L.control.layers({ "🌍 Satellite": satellite, "🗺️ Plan": planOSM, "⛰️ Topographie": topoMap }).addTo(map);

// Variables globales
let mntStore = [];
let drawStore = [];
let kmzStore = []; 
let projectStore = []; // <-- Variable ajoutée pour les projets sauvegardés
let currentPoints = [];
let tempLayer = null;
let currentTool = null;
let chartInstance = null;
let cursorMarker = null;
let currentProfileExportData = [];
let currentProfileDrawId = null;

// ==========================================
// 2. IMPORTATION MNT (LOCAL ET SERVEUR)
// ==========================================
window.loadRemoteMNT = async () => {
    const select = document.getElementById('mnt-select');
    const url = select.value;
    const name = select.options[select.selectedIndex].text;

    if (!url) return alert("Veuillez sélectionner un MNT dans la liste déroulante.");

    const btn = document.querySelector('button[onclick="loadRemoteMNT()"]');
    const oldText = btn.innerText;
    btn.innerText = "⏳ Téléchargement..."; btn.style.background = "#f39c12"; btn.disabled = true;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Erreur réseau");
        const buffer = await response.arrayBuffer();

        const tiff = await GeoTIFF.fromArrayBuffer(buffer);
        const image = await tiff.getImage();
        const bbox = image.getBoundingBox();
        const raster = await image.readRasters();
        
        const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]);
        const ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
        
        const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.15 }).addTo(map);

        mntStore.push({ id: Date.now()+Math.random(), name: name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2", weight: 2 });
        
        map.fitBounds(visual.getBounds());
        updateMntUI();
    } catch(err) { 
        console.error(err); alert("Impossible de charger le MNT. Vérifiez le lien GitHub.");
    } finally {
        btn.innerText = oldText; btn.style.background = "#00d1b2"; btn.disabled = false;
    }
};

document.getElementById('mnt-input').onchange = async (e) => {
    for (const file of e.target.files) {
        if (!file.name.match(/\.(tif|tiff)$/i)) continue;
        try {
            const buffer = await file.arrayBuffer();
            const tiff = await GeoTIFF.fromArrayBuffer(buffer);
            const image = await tiff.getImage();
            const bbox = image.getBoundingBox();
            const raster = await image.readRasters();
            
            const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]);
            const ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
            
            const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.15 }).addTo(map);

            mntStore.push({ id: Date.now()+Math.random(), name: file.name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2", weight: 2 });
            map.fitBounds(visual.getBounds());
        } catch(err) { console.error("Erreur MNT :", err); }
    }
    updateMntUI();
};

function updateMntUI() {
    const list = document.getElementById('mnt-list'); if (!list) return; list.innerHTML = '';
    mntStore.forEach(m => {
        list.innerHTML += `<div class="card" style="border-left-color: ${m.color}"><div class="card-header"><div><input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMNT(${m.id})"> <input type="color" class="color-picker" value="${m.color}" onchange="changeMntColor(${m.id}, this.value)"> <span style="cursor:pointer;" onclick="renameMNT(${m.id})" title="Cliquez pour renommer">${m.name.substring(0,18)}</span></div><button class="btn-del" onclick="deleteMNT(${m.id})">✕</button></div><div style="margin-top:5px; font-size: 0.9em;">Épaisseur : <input type="range" min="1" max="10" value="${m.weight}" class="slider-width" onchange="changeMntWeight(${m.id}, this.value)"></div></div>`;
    });
}

window.renameMNT = (id) => { const m = mntStore.find(x => x.id === id); if (!m) return; const newName = prompt("Nouveau nom pour ce secteur :", m.name); if (newName && newName.trim() !== "") { m.name = newName.trim(); updateMntUI(); } };
window.changeMntColor = (id, color) => { const m = mntStore.find(x => x.id === id); if (!m) return; m.color = color; m.visual.setStyle({ color: color }); updateMntUI(); };
window.changeMntWeight = (id, weight) => { const m = mntStore.find(x => x.id === id); if (!m) return; m.weight = parseInt(weight); m.visual.setStyle({ weight: m.weight }); updateMntUI(); };
window.toggleMNT = (id) => { const m = mntStore.find(x => x.id === id); m.visible = !m.visible; if (m.visible) m.visual.addTo(map); else map.removeLayer(m.visual); };
window.deleteMNT = (id) => { const m = mntStore.find(x => x.id === id); map.removeLayer(m.visual); mntStore = mntStore.filter(x => x.id !== id); updateMntUI(); };

function getZ(l93) {
    for (let m of mntStore) {
        if (!m.visible) continue;
        if (l93[0] >= m.bbox[0] && l93[0] <= m.bbox[2] && l93[1] >= m.bbox[1] && l93[1] <= m.bbox[3]) {
            const px = ((l93[0] - m.bbox[0]) / (m.bbox[2] - m.bbox[0])) * m.width;
            const py = ((m.bbox[3] - l93[1]) / (m.bbox[3] - m.bbox[1])) * m.height;
            const x1 = Math.floor(px), x2 = Math.min(x1 + 1, m.width - 1);
            const y1 = Math.floor(py), y2 = Math.min(y1 + 1, m.height - 1);
            const dx = px - x1, dy = py - y1;
            const q11 = m.data[y1 * m.width + x1] || 0; const q21 = m.data[y1 * m.width + x2] || 0;
            const q12 = m.data[y2 * m.width + x1] || 0; const q22 = m.data[y2 * m.width + x2] || 0;
            if (q11 < -500) return null;
            return (1-dx)*(1-dy)*q11 + dx*(1-dy)*q21 + (1-dx)*dy*q12 + dx*dy*q22;
        }
    } return null;
}

// ==========================================
// 3. GESTION DE L'INTERFACE DES CALQUES
// ==========================================
function updateKmzUI() {
    const list = document.getElementById('kmz-list'); if (!list) return; list.innerHTML = '';
    kmzStore.forEach(k => {
        list.innerHTML += `<div class="card" style="border-left-color: ${k.color}"><div class="card-header"><div><input type="checkbox" ${k.visible ? 'checked' : ''} onchange="toggleKMZ(${k.id})"> <input type="color" class="color-picker" value="${k.color}" onchange="changeKmzColor(${k.id}, this.value)"> <span style="cursor:pointer;" onclick="renameKMZ(${k.id})" title="Cliquez pour renommer">${k.name.substring(0,18)}</span></div><button class="btn-del" onclick="deleteKMZ(${k.id})">✕</button></div><div style="margin-top:5px; font-size: 0.9em;">Épaisseur : <input type="range" min="1" max="10" value="${k.weight}" class="slider-width" onchange="changeKmzWeight(${k.id}, this.value)"></div></div>`;
    });
}

window.renameKMZ = (id) => { const k = kmzStore.find(x => x.id === id); if (!k) return; const newName = prompt("Nouveau nom pour ce calque :", k.name); if (newName && newName.trim() !== "") { k.name = newName.trim(); updateKmzUI(); } };
window.toggleKMZ = (id) => { const k = kmzStore.find(x => x.id === id); k.visible = !k.visible; if (k.visible) k.layer.addTo(map); else map.removeLayer(k.layer); };
window.deleteKMZ = (id) => { const k = kmzStore.find(x => x.id === id); map.removeLayer(k.layer); kmzStore = kmzStore.filter(x => x.id !== id); updateKmzUI(); };
window.changeKmzColor = (id, color) => { const k = kmzStore.find(x => x.id === id); k.color = color; applyKmzStyle(id); updateKmzUI(); };
window.changeKmzWeight = (id, weight) => { const k = kmzStore.find(x => x.id === id); k.weight = parseInt(weight); applyKmzStyle(id); updateKmzUI(); };

function applyKmzStyle(id) {
    const k = kmzStore.find(x => x.id === id); if (!k) return;
    k.layer.eachLayer(l => {
        if (l.eachLayer) { l.eachLayer(sub => { if (sub.setStyle) sub.setStyle({ color: k.color, weight: k.weight }); }); }
        else if (l.setStyle) { l.setStyle({ color: k.color, weight: k.weight }); }
    });
}

// ==========================================
// 4. OUTILS DE TRACÉ
// ==========================================
let circleCenter = null;

window.startTool = (tool) => {
    currentTool = tool; currentPoints = []; circleCenter = null;
    if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + tool).classList.add('active');
    
    const finishBtn = document.getElementById('btn-finish'); 
    document.getElementById('btn-' + tool).insertAdjacentElement('afterend', finishBtn);
    // Le cercle se ferme tout seul au 2ème clic
    finishBtn.style.display = tool === 'circle' ? 'none' : 'block';
};

map.on('click', (e) => {
    if (!currentTool) return; 

    // Outil CERCLE : 1er clic = Centre, 2ème clic = Rayon
    if (currentTool === 'circle') {
        if (!circleCenter) {
            circleCenter = e.latlng;
            tempLayer = L.circle(circleCenter, {radius: 0, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map);
        } else {
            const radius = map.distance(circleCenter, e.latlng);
            finalizeCircle(circleCenter, radius);
            circleCenter = null;
        }
        return;
    }

    // Outils Ligne et Surface
    currentPoints.push(e.latlng);
    if (tempLayer) map.removeLayer(tempLayer);
    const color = currentTool === 'area' ? '#e67e22' : '#3498db';
    if (currentTool === 'area') tempLayer = L.polygon(currentPoints, { color, weight: 3, fillOpacity: 0.3 }).addTo(map);
    else tempLayer = L.polyline(currentPoints, { color, weight: 4 }).addTo(map);
});

window.finalizeDraw = () => {
    if (!currentTool || currentPoints.length < 2) { alert("Veuillez placer au moins 2 points."); return; }
    try {
        const type = currentTool; const color = type === 'area' ? '#e67e22' : '#3498db';
        const weight = type === 'area' ? 3 : 4;
        
        const layer = type === 'area' ? L.polygon(currentPoints, { color, weight, fillOpacity: 0.3 }).addTo(map) : L.polyline(currentPoints, { color, weight }).addTo(map);
        if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
        
        const defaultName = type === 'line' ? 'Mon Parcours' : 'Ma Surface';
        const drawObj = { id: Date.now(), type, name: defaultName, layer, ptsGPS: [...currentPoints], visible: true, color, weight, isEditing: false, editGroup: L.layerGroup().addTo(map) };
        drawStore.push(drawObj); recalculateStats(drawObj); 
        
        if (type === 'line') { currentProfileDrawId = drawObj.id; generateProfile(drawObj); } 
        currentTool = null; currentPoints = [];
        document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-finish').style.display = 'none';
        updateDrawUI();
    } catch (e) { console.error(e); }
};

window.finalizeCircle = (center, radius) => {
    const color = '#9b59b6'; const weight = 3;
    const layer = L.circle(center, {radius, color, weight, fillOpacity: 0.3}).addTo(map);
    if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;

    // Le secret : on crée 64 points invisibles sur le contour pour tromper le moteur 3D !
    const ptsGPS = generateCirclePoints(center, radius);

    const drawObj = { 
        id: Date.now(), type: 'circle', name: 'Mon Cercle', layer, 
        ptsGPS, center, radius, // Nouvelles variables pour retenir la géométrie parfaite
        visible: true, color, weight, isEditing: false, editGroup: L.layerGroup().addTo(map) 
    };
    drawStore.push(drawObj); recalculateStats(drawObj);
    currentTool = null; document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    updateDrawUI();
};

window.generateCirclePoints = (center, radius) => {
    const pts = [];
    const centerL93 = proj4("EPSG:4326", "EPSG:2154", [center.lng, center.lat]);
    for (let i=0; i<64; i++) {
        const angle = (i * 2 * Math.PI) / 64;
        const x = centerL93[0] + radius * Math.cos(angle);
        const y = centerL93[1] + radius * Math.sin(angle);
        const gps = proj4("EPSG:2154", "EPSG:4326", [x, y]);
        pts.push({lat: gps[1], lng: gps[0]});
    }
    return pts;
};
// ==========================================
// 5. CALCULS, ÉDITION LIVE ET VOLUMES 3D
// ==========================================
function recalculateStats(d) {
    if (d.type === 'circle') {
        const area = Math.PI * d.radius * d.radius;
        const perimeter = 2 * Math.PI * d.radius;
        const diameter = 2 * d.radius;
        d.statsHtml = `Diam: <b>${diameter.toFixed(1)} m</b> | Périm: <b>${perimeter.toFixed(1)} m</b><br>Surface: <b>${area.toFixed(1)} m²</b>`;
    } else {
        const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
        if (d.type === 'line') {
            let dist = 0; for (let i = 1; i < l93.length; i++) dist += Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
            const z1 = getZ(l93[0]) || 0; const z2 = getZ(l93[l93.length-1]) || 0; const dz = Math.abs(z2 - z1); const pente = dist > 0 ? (dz / dist * 100).toFixed(1) : 0;
            d.totalDist = dist; d.statsHtml = `Dist: <b>${dist.toFixed(1)} m</b> | ΔZ: <b>${dz.toFixed(1)} m</b> | Pente: <b>${pente}%</b>`;
        } else {
            let area = 0; for (let i = 0; i < l93.length; i++) { let j = (i+1) % l93.length; area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; }
            d.statsHtml = `Surface: <b>${(Math.abs(area)/2).toFixed(1)} m²</b>`;
        }
    }
    const statsDiv = document.getElementById(`stats-${d.id}`); if (statsDiv) statsDiv.innerHTML = d.statsHtml;
}

function updateDrawUI() {
    const list = document.getElementById('measure-list'); if (!list) return; list.innerHTML = '';
    drawStore.forEach(d => {
        let actionButtons = '';
        if (d.type === 'line') {
            actionButtons = `<button onclick="generateProfileById(${d.id})" style="width:100%; margin-top:8px; font-size:0.8em; cursor:pointer; background:#333; color:white; border:1px solid #555; padding:5px; border-radius:3px;">📈 Afficher le profil</button>`;
        } else if (d.type === 'area' || d.type === 'circle') {
            // Boutons Volumes et 3D partagés pour Polygones ET Cercles
            actionButtons = `
            <div style="display:flex; gap:5px; margin-top:8px; flex-wrap:wrap;">
                <button id="btn-vol-hollow-${d.id}" onclick="calculateVolume(${d.id}, 'hollow')" style="flex:1; font-size:0.7em; cursor:pointer; background:#2980b9; color:white; border:none; padding:4px; border-radius:3px;">💧 Creux</button>
                <button id="btn-vol-mound-${d.id}" onclick="calculateVolume(${d.id}, 'mound')" style="flex:1; font-size:0.7em; cursor:pointer; background:#e67e22; color:white; border:none; padding:4px; border-radius:3px;">⛰️ Tas</button>
                <button id="btn-vol-slope-${d.id}" onclick="calculateVolume(${d.id}, 'slope')" style="flex:1; font-size:0.75em; cursor:pointer; background:#8e44ad; color:white; border:none; padding:4px; border-radius:3px;">📐 Pente (Auto)</button>
                <button onclick="generate3DView(${d.id})" style="flex:1; min-width:100%; font-size:0.75em; cursor:pointer; background:#34495e; color:white; border:1px solid #555; padding:5px; border-radius:3px; margin-top:2px;">👁️ Contrôle Vue 3D</button>
            </div>`;
        }

        const editBtnText = d.isEditing ? '✅ Fin édition' : '✏️ Éditer';
        const editControls = d.isEditing ? `<div style="margin-top:5px; font-size:0.85em; background:#222; padding:5px; border-radius:3px; display:flex; align-items:center; gap:5px;">Épaisseur: <input type="range" min="1" max="10" value="${d.weight}" onchange="changeFeatureWeight(${d.id}, this.value, false)"></div>` : '';

        list.innerHTML += `<div class="card" style="border-left-color: ${d.color}"><div class="card-header"><div style="display:flex; align-items:center;"><input type="checkbox" ${d.visible ? 'checked' : ''} onchange="toggleDraw(${d.id})"> <input type="color" class="color-picker" value="${d.color}" onchange="changeColor(${d.id}, this.value)"> <strong style="cursor:pointer;" onclick="renameDraw(${d.id})" title="Cliquez pour renommer">${d.name}</strong><button onclick="toggleEditMode(${d.id}, false)" style="background:${d.isEditing?'#27ae60':'#7f8c8d'}; color:white; border:none; border-radius:3px; padding:2px 5px; cursor:pointer; font-size:0.7em; margin-left:5px;">${editBtnText}</button></div><button class="btn-del" onclick="deleteDraw(${d.id})">✕</button></div>${editControls}<div id="stats-${d.id}" style="margin-top:5px; font-size:1.1em;">${d.statsHtml}</div>${actionButtons}</div>`;
    });
}

window.toggleEditMode = (id, isProject = false, projectId = null) => {
    let d = isProject ? projectStore.find(p => p.id === projectId)?.features.find(f => f.id === id) : drawStore.find(x => x.id === id);
    if (!d) return;
    d.isEditing = !d.isEditing;
    if (!d.editGroup) d.editGroup = L.layerGroup().addTo(map);
    if (d.isEditing && d.visible) { makeEditable(d, isProject, projectId); } else { d.editGroup.clearLayers(); }
    if (isProject) updateProjectUI(); else updateDrawUI();
};

window.changeFeatureWeight = (id, weight, isProject = false, projectId = null) => {
    let d = isProject ? projectStore.find(p => p.id === projectId)?.features.find(f => f.id === id) : drawStore.find(x => x.id === id);
    if (!d) return; d.weight = parseInt(weight); d.layer.setStyle({ weight: d.weight });
};

function makeEditable(d, isProject = false, projectId = null) {
    if(d.editGroup) d.editGroup.clearLayers(); 
    if (!d.visible || !d.isEditing) return;
    const icon = L.divIcon({ className: 'edit-handle', iconSize: [12, 12] });
    
    // Si c'est un cercle, on crée 2 points d'édition magiques : un au centre, un sur le bord
    if (d.type === 'circle') {
        const centerMarker = L.marker(d.center, { icon, draggable: true }).addTo(d.editGroup);
        
        const cL93 = proj4("EPSG:4326", "EPSG:2154", [d.center.lng, d.center.lat]);
        const edgeGPS = proj4("EPSG:2154", "EPSG:4326", [cL93[0] + d.radius, cL93[1]]);
        const edgeMarker = L.marker([edgeGPS[1], edgeGPS[0]], { icon, draggable: true }).addTo(d.editGroup);

        centerMarker.on('drag', (e) => {
            d.center = e.latlng; d.layer.setLatLng(d.center); d.ptsGPS = generateCirclePoints(d.center, d.radius);
            const nL93 = proj4("EPSG:4326", "EPSG:2154", [d.center.lng, d.center.lat]);
            const nGPS = proj4("EPSG:2154", "EPSG:4326", [nL93[0] + d.radius, nL93[1]]);
            edgeMarker.setLatLng([nGPS[1], nGPS[0]]);
            recalculateStats(d);
        });
        centerMarker.on('dragend', () => { if (isProject) updateProjectUI(); else updateDrawUI(); });

        edgeMarker.on('drag', (e) => {
            d.radius = map.distance(d.center, e.latlng); d.layer.setRadius(d.radius); d.ptsGPS = generateCirclePoints(d.center, d.radius);
            recalculateStats(d);
        });
        edgeMarker.on('dragend', () => { if (isProject) updateProjectUI(); else updateDrawUI(); });
    } 
    // Si c'est une ligne ou surface normale
    else {
        d.ptsGPS.forEach((pt, idx) => {
            const marker = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
            marker.on('drag', (e) => { d.ptsGPS[idx] = e.latlng; d.layer.setLatLngs(d.ptsGPS); recalculateStats(d); if (d.type === 'line') generateProfile(d); });
            marker.on('dragend', () => { if (isProject) updateProjectUI(); else updateDrawUI(); });
        });
    }
}

window.renameDraw = (id) => { const d = drawStore.find(x => x.id === id); if (!d) return; const newName = prompt("Nouveau nom :", d.name); if (newName && newName.trim() !== "") { d.name = newName.trim(); updateDrawUI(); } };
window.toggleDraw = (id) => { const d = drawStore.find(x => x.id === id); d.visible = !d.visible; if (d.visible) { d.layer.addTo(map); if(d.isEditing) makeEditable(d); } else { map.removeLayer(d.layer); if(d.editGroup) d.editGroup.clearLayers(); } updateDrawUI(); };
window.changeColor = (id, color) => { const d = drawStore.find(x => x.id === id); if (!d) return; d.color = color; d.layer.setStyle({ color: color }); updateDrawUI(); if (chartInstance && currentProfileDrawId === id) { chartInstance.data.datasets[0].borderColor = color; chartInstance.data.datasets[0].backgroundColor = color + '33'; chartInstance.update(); } };
window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); if(d.editGroup) map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); if(currentProfileDrawId === id) { document.getElementById('profile-window').style.display = 'none'; currentProfileDrawId = null; } };

window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id);
    if (!d || (d.type !== 'area' && d.type !== 'circle')) return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");

    const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    l93Pts.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });

    let refZ = 0, borderPtsWithZ = [];
    if (type === 'slope') {
        l93Pts.forEach(p => { let z = getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); });
        if (borderPtsWithZ.length < 3) return alert("Pas assez de données sur les bords.");
    } else {
        let sampleZ = getZ(l93Pts[0]), defaultZ = sampleZ ? Math.round(sampleZ) : 0;
        let refZPrompt = prompt("Altitude de référence (Z) en mètres ?", defaultZ);
        if (!refZPrompt) return; refZ = parseFloat(refZPrompt.replace(',', '.')); if (isNaN(refZ)) return alert("Altitude invalide.");
    }

    const btn = document.getElementById(`btn-vol-${type}-${id}`);
    const oldText = btn.innerText; btn.innerText = "⏳ Scan..."; btn.disabled = true;

    setTimeout(() => {
        let totalVolumeTas = 0, totalVolumeCreux = 0, step = 1, pixelArea = step * step, pointsCount = 0;
        for (let x = minX; x <= maxX; x += step) {
            for (let y = minY; y <= maxY; y += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]);
                    if (zMNT !== null) {
                        pointsCount++;
                        if (type === 'slope') {
                            let sumZ = 0, sumW = 0, exactMatch = false, zBase = 0;
                            for (let pt of borderPtsWithZ) { let d2 = (x - pt.x)**2 + (y - pt.y)**2; if (d2 === 0) { zBase = pt.z; exactMatch = true; break; } let w = 1 / d2; sumZ += pt.z * w; sumW += w; }
                            if (!exactMatch) zBase = sumZ / sumW;
                            if (zMNT > zBase) totalVolumeTas += (zMNT - zBase) * pixelArea; else if (zMNT < zBase) totalVolumeCreux += (zBase - zMNT) * pixelArea;
                        } else {
                            if (type === 'hollow' && zMNT < refZ) totalVolumeCreux += (refZ - zMNT) * pixelArea; else if (type === 'mound' && zMNT > refZ) totalVolumeTas += (zMNT - refZ) * pixelArea;
                        }
                    }
                }
            }
        }
        btn.innerText = oldText; btn.disabled = false;
        if (pointsCount === 0) alert("Aucune donnée MNT dans cette zone.");
        else {
            let msg = "", resultHtml = "";
            if (type === 'slope') {
                const tasStr = totalVolumeTas.toLocaleString('fr-FR', {maximumFractionDigits:1}), creuxStr = totalVolumeCreux.toLocaleString('fr-FR', {maximumFractionDigits:1});
                msg = `📐 Bilan sur pente:\n\n⛰️ Tas : ${tasStr} m³\n💧 Creux : ${creuxStr} m³`;
                resultHtml = `<br><span style="color:#8e44ad; font-size:0.9em; display:block; margin-top:3px;">Tas (Pente): <b>${tasStr} m³</b> | Creux: <b>${creuxStr} m³</b></span>`;
            } else {
                let vol = type === 'hollow' ? totalVolumeCreux : totalVolumeTas, volStr = vol.toLocaleString('fr-FR', {maximumFractionDigits:1});
                msg = type === 'hollow' ? `💧 Creux (sous ${refZ}m) : ${volStr} m³` : `⛰️ Tas (sur ${refZ}m) : ${volStr} m³`;
                resultHtml = `<br><span style="color:${type==='hollow'?'#2980b9':'#e67e22'}; font-size:0.9em; display:block; margin-top:3px;">${type==='hollow'?'Vol. Creux':'Vol. Tas'} (${refZ}m): <b>${volStr} m³</b></span>`;
            }
            alert(msg); d.statsHtml += resultHtml;
            const statsDiv = document.getElementById(`stats-${d.id}`); if (statsDiv) statsDiv.innerHTML = d.statsHtml;
        }
    }, 50);
};

function isPointInPolygon(point, vs) {
    let x = point[0], y = point[1], inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1]; let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); if (intersect) inside = !inside; } return inside;
}

window.generate3DView = (id) => {
    const d = drawStore.find(x => x.id === id);
    if (!d || (d.type !== 'area' && d.type !== 'circle')) return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");

    document.getElementById('window-3d').style.display = 'block';
    document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Calcul de la 3D en cours... ⏳</h3>';

    setTimeout(() => {
        const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        l93Pts.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });

        let borderPtsWithZ = [];
        l93Pts.forEach(p => { let z = getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); });

        const maxPts = 40;
        const step = Math.max(1, (maxX - minX) / maxPts, (maxY - minY) / maxPts);

        let xVals = [], yVals = [], zTerrain = [], zRefPlane = [];
        for (let x = minX; x <= maxX; x += step) xVals.push(x);

        for (let y = minY; y <= maxY; y += step) {
            let rowTerrain = [], rowRef = []; yVals.push(y);
            for (let x = minX; x <= maxX; x += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]); rowTerrain.push(zMNT !== null ? zMNT : null);
                    let sumZ = 0, sumW = 0, exactMatch = false, zBase = 0;
                    for (let pt of borderPtsWithZ) { let d2 = (x - pt.x)**2 + (y - pt.y)**2; if (d2 === 0) { zBase = pt.z; exactMatch = true; break; } let w = 1 / d2; sumZ += pt.z * w; sumW += w; }
                    if (!exactMatch) zBase = sumZ / sumW; rowRef.push(zBase);
                } else { rowTerrain.push(null); rowRef.push(null); }
            }
            zTerrain.push(rowTerrain); zRefPlane.push(rowRef);
        }

        const traceTerrain = { z: zTerrain, x: xVals, y: yVals, type: 'surface', name: 'Terrain Naturel', colorscale: 'Earth', showscale: false };
        const traceRef = { z: zRefPlane, x: xVals, y: yVals, type: 'surface', name: 'Base Calculée', colorscale: 'Blues', showscale: false, opacity: 0.6 };

        const layout = { margin: { l: 0, r: 0, b: 0, t: 0 }, scene: { aspectmode: 'data', camera: { eye: {x: -1.2, y: -1.2, z: 1.2} } }, paper_bgcolor: '#222', font: { color: 'white' }, hovermode: 'closest' };
        
        Plotly.newPlot('plot-3d', [traceTerrain, traceRef], layout).then(() => {
            const plotDiv = document.getElementById('plot-3d');
            plotDiv.on('plotly_hover', (data) => {
                if (data.points.length > 0) {
                    const pt = data.points[0]; const gps = proj4("EPSG:2154", "EPSG:4326", [pt.x, pt.y]);
                    if (!cursorMarker) cursorMarker = L.circleMarker([gps[1], gps[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
                    else cursorMarker.setLatLng([gps[1], gps[0]]);
                }
            });
            plotDiv.addEventListener('mouseleave', () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } });
        });
    }, 100);
};

document.querySelector('#header-3d button').onclick = () => { document.getElementById('window-3d').style.display = 'none'; if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } };
const win3d = document.getElementById('window-3d'), header3d = document.getElementById('header-3d');
let isDragging3D = false, offset3DX = 0, offset3DY = 0;
header3d.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; isDragging3D = true; const rect = win3d.getBoundingClientRect(); offset3DX = e.clientX - rect.left; offset3DY = e.clientY - rect.top; });
document.addEventListener('mousemove', (e) => { if (!isDragging3D) return; win3d.style.left = Math.max(0, e.clientX - offset3DX) + 'px'; win3d.style.top = Math.max(0, e.clientY - offset3DY) + 'px'; });
document.addEventListener('mouseup', () => { isDragging3D = false; });

// ==========================================
// 6. PROFIL ALTIMÉTRIQUE HAUTE PRÉCISION
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; const d = drawStore.find(x => x.id === id); generateProfile(d); };

function generateProfile(d) {
    document.getElementById('profile-window').style.display = 'block';
    const ctx = document.getElementById('profileChart').getContext('2d');
    
    const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let cumulativeDistances = [0]; let totalDist = 0;
    for (let i = 1; i < l93Pts.length; i++) { totalDist += Math.hypot(l93Pts[i][0]-l93Pts[i-1][0], l93Pts[i][1]-l93Pts[i-1][1]); cumulativeDistances.push(totalDist); }

    let chartData = []; let geoRef = []; currentProfileExportData = []; const samplingInterval = 1; 

    let zStart = getZ(l93Pts[0]) || 0;
    addPointToChart(0, zStart, [l93Pts[0][0], l93Pts[0][1]]);
    let nextSampleDist = samplingInterval;

    for (let i = 1; i < l93Pts.length; i++) {
        const segLen = cumulativeDistances[i] - cumulativeDistances[i-1];
        const p1 = l93Pts[i-1]; const p2 = l93Pts[i];

        while (nextSampleDist < cumulativeDistances[i]) {
            const t = segLen === 0 ? 0 : (nextSampleDist - cumulativeDistances[i-1]) / segLen;
            const x = p1[0] + (p2[0] - p1[0]) * t, y = p1[1] + (p2[1] - p1[1]) * t;
            addPointToChart(nextSampleDist, getZ([x, y]) || 0, [x, y]);
            nextSampleDist += samplingInterval;
        }
        if (Math.abs(cumulativeDistances[i] - (nextSampleDist - samplingInterval)) > 0.1) {
             addPointToChart(cumulativeDistances[i], getZ(l93Pts[i]) || 0, [l93Pts[i][0], l93Pts[i][1]]);
        }
    }

    function addPointToChart(dist, z, l93Coords) {
        chartData.push({ x: parseFloat(dist.toFixed(1)), y: parseFloat(z.toFixed(2)) }); 
        geoRef.push(proj4("EPSG:2154", "EPSG:4326", l93Coords));
        currentProfileExportData.push({ dist: dist.toFixed(2), z: z.toFixed(2) });
    }

    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'line', data: { datasets: [{ label: 'Altitude Z (m)', data: chartData, borderColor: d.color, backgroundColor: d.color + '33', fill: true, pointRadius: 0, tension: 0.1 }] },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: { x: { type: 'linear', title: { display: true, text: 'Distance totale (m)' }, ticks: { precision: 0 } }, y: { title: { display: true, text: 'Altitude Z (m)' } } },
            onHover: (event, elements) => {
                if (elements.length > 0) {
                    const pos = geoRef[elements[0].index];
                    if (!cursorMarker) cursorMarker = L.circleMarker([pos[1], pos[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
                    else cursorMarker.setLatLng([pos[1], pos[0]]);
                }
            }
        }
    });

    document.getElementById('profileChart').onmouseleave = () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } };

    const xMinSlider = document.getElementById('x-min'), xMaxSlider = document.getElementById('x-max');
    const yMinSlider = document.getElementById('y-min'), yMaxSlider = document.getElementById('y-max');

    let minZ = Math.min(...chartData.map(pt => pt.y)), maxZ = Math.max(...chartData.map(pt => pt.y));
    const zMargin = (maxZ - minZ) * 0.1 || 10; minZ = Math.floor(minZ - zMargin); maxZ = Math.ceil(maxZ + zMargin);

    if(xMinSlider && xMaxSlider && yMinSlider && yMaxSlider) {
        xMinSlider.min = 0; xMinSlider.max = d.totalDist; xMinSlider.value = 0; xMinSlider.step = d.totalDist / 200 || 1;
        xMaxSlider.min = 0; xMaxSlider.max = d.totalDist; xMaxSlider.value = d.totalDist; xMaxSlider.step = d.totalDist / 200 || 1;
        yMinSlider.min = minZ; yMinSlider.max = maxZ; yMinSlider.value = minZ; yMinSlider.step = 0.5;
        yMaxSlider.min = minZ; yMaxSlider.max = maxZ; yMaxSlider.value = maxZ; yMaxSlider.step = 0.5;
        document.getElementById('x-vals').innerText = `0m - ${d.totalDist.toFixed(0)}m`;
        document.getElementById('y-vals').innerText = `${minZ}m - ${maxZ}m`;
    }
}

window.exportChartPNG = () => { const a = document.createElement('a'); a.href = document.getElementById('profileChart').toDataURL('image/png'); a.download = 'profil.png'; a.click(); };
window.exportChartCSV = () => {
    let csv = "\ufeffDistance (m)\tAltitude Z (m)\n"; currentProfileExportData.forEach(row => { csv += `${row.dist.replace('.', ',')}\t${row.z.replace('.', ',')}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_profil_1m.csv'; a.click();
};

// ==========================================
// 7. GESTION DES CURSEURS LIVE (SCALES)
// ==========================================
window.updateScalesLive = () => {
    if (!chartInstance) return;
    let xMin = parseFloat(document.getElementById('x-min').value), xMax = parseFloat(document.getElementById('x-max').value);
    let yMin = parseFloat(document.getElementById('y-min').value), yMax = parseFloat(document.getElementById('y-max').value);
    if (xMin >= xMax - 1) { xMin = xMax - 1; document.getElementById('x-min').value = xMin; }
    if (yMin >= yMax - 1) { yMin = yMax - 1; document.getElementById('y-min').value = yMin; }
    document.getElementById('x-vals').innerText = `${xMin.toFixed(0)}m - ${xMax.toFixed(0)}m`; document.getElementById('y-vals').innerText = `${yMin.toFixed(0)}m - ${yMax.toFixed(0)}m`;
    chartInstance.options.scales.x.min = xMin; chartInstance.options.scales.x.max = xMax;
    chartInstance.options.scales.y.min = yMin; chartInstance.options.scales.y.max = yMax;
    chartInstance.update('none'); 
};

// ==========================================
// 8. SUIVI SOURIS COORDONNÉES ET PREVIEW
// ==========================================
map.on('mousemove', (e) => {
    try {
        if (!e.latlng) return; 
        const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
        const elX = document.getElementById('cur-x'), elY = document.getElementById('cur-y'), elZ = document.getElementById('cur-z');
        if (elX) elX.innerText = l93[0].toFixed(1); if (elY) elY.innerText = l93[1].toFixed(1);
        if (elZ) { let z = null; try { z = getZ(l93); } catch (err) {} elZ.innerText = (z !== null && !isNaN(z)) ? z.toFixed(2) : "---"; }
        
        // Animation du cercle qui grandit en direct quand on bouge la souris !
        if (typeof currentTool !== 'undefined' && currentTool === 'circle' && typeof circleCenter !== 'undefined' && circleCenter && tempLayer) {
            tempLayer.setRadius(map.distance(circleCenter, e.latlng));
        }
    } catch (error) {}
});
// ==========================================
// 9. FENÊTRE FLOTTANTE (DRAG & DROP)
// ==========================================
const profileWin = document.getElementById('profile-window'), profileHeader = document.getElementById('profile-header');
let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

profileHeader.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return; isDragging = true;
    const rect = profileWin.getBoundingClientRect(); dragOffsetX = e.clientX - rect.left; dragOffsetY = e.clientY - rect.top;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return; let newX = e.clientX - dragOffsetX, newY = e.clientY - dragOffsetY;
    if (newX < 0) newX = 0; if (newY < 0) newY = 0;
    profileWin.style.bottom = 'auto'; profileWin.style.right = 'auto'; profileWin.style.left = newX + 'px'; profileWin.style.top = newY + 'px';
});
document.addEventListener('mouseup', () => { isDragging = false; });

// ==========================================
// 10. CHARGEMENT DU TRACÉ (PISTES ET CANONS)
// ==========================================
window.addEventListener('load', () => {
    try {
        // --- 1. CHARGEMENT DES PISTES ---
        let pistesGeo = null;
        if (typeof pistesData !== 'undefined') pistesGeo = pistesData; 
        else if (typeof pistesGeoJSON !== 'undefined') pistesGeo = pistesGeoJSON;

        if (pistesGeo && pistesGeo.features) {
            const idPistes = Date.now(); 
            const pistesLayer = L.geoJSON(pistesGeo, { 
                style: function (feature) { 
                    return { color: '#ffffff', weight: 1, opacity: 1, fillOpacity: 0.2 }; 
                } 
            }).addTo(map);
            
            kmzStore.push({ id: idPistes, name: "Mes Pistes", layer: pistesLayer, visible: true, color: '#ffffff', weight: 1 });
            map.fitBounds(pistesLayer.getBounds());
        }

        // --- 2. CHARGEMENT DES CANONS ---
        if (typeof canonData !== 'undefined' && canonData.features) {
            const idCanons = Date.now() + 1000; 
            const canonLayer = L.geoJSON(canonData, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, { 
                        radius: 5, 
                        fillColor: '#3498db', 
                        color: '#ffffff', 
                        weight: 1, 
                        opacity: 1, 
                        fillOpacity: 0.8 
                    });
                }
            }).addTo(map);
            
            kmzStore.push({ id: idCanons, name: "Mes Canons", layer: canonLayer, visible: true, color: '#3498db', weight: 1 });
        }
        
        updateKmzUI();
    } catch (e) { 
        console.error("Erreur de chargement des données statiques :", e); 
    }
});
// ==========================================
// 11. SAUVEGARDE ET CHARGEMENT CLOUD (GOOGLE SHEETS)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZ-m9rVPuATkiYjccicrtBSrAieSSA_TTqmYpA61SoK4eTj11qesIEpItyys6Vu2GVXQ/exec"; // <--- REMETTEZ VOTRE LIEN GOOGLE SCRIPT ICI !!!

window.saveProject = async () => {
    const projectName = document.getElementById('project-name').value.trim();
    if (!projectName) return alert("Veuillez taper un nom de projet pour sauvegarder.");
    if (drawStore.length === 0) return alert("Aucune mesure à sauvegarder dans le panneau de droite !");

    // On sauvegarde aussi center et radius pour les cercles
    const exportData = drawStore.map(d => ({ 
        id: d.id, type: d.type, name: d.name, color: d.color, weight: d.weight, 
        ptsGPS: d.ptsGPS, totalDist: d.totalDist, statsHtml: d.statsHtml, center: d.center, radius: d.radius 
    }));

    const btn = document.querySelector('button[onclick="saveProject()"]');
    const oldText = btn.innerText; btn.innerText = "⏳"; btn.disabled = true;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST", redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ projectName: projectName, projectData: JSON.stringify(exportData) })
        });
        const result = await response.json();
        
        if (result.status === "success") {
            const newProject = { id: Date.now(), name: projectName, visible: true, features: [...drawStore] };
            newProject.features.forEach(f => { f.isEditing = false; if (f.editGroup) map.removeLayer(f.editGroup); });
            projectStore.push(newProject);
            
            drawStore = [];
            if (currentProfileDrawId) { document.getElementById('profile-window').style.display = 'none'; currentProfileDrawId = null; }
            updateDrawUI(); updateProjectUI();
            alert("✅ Projet sauvegardé et déplacé dans vos calques à gauche !");
        }
    } catch (e) { alert("Erreur de sauvegarde."); } finally { btn.innerText = oldText; btn.disabled = false; }
};

window.loadProject = async () => {
    const projectName = document.getElementById('project-name').value.trim();
    if (!projectName) return alert("Veuillez taper le nom du projet à charger.");

    const btn = document.querySelector('button[onclick="loadProject()"]');
    const oldText = btn.innerText; btn.innerText = "⏳"; btn.disabled = true;

    try {
        const response = await fetch(`${SCRIPT_URL}?projectName=${encodeURIComponent(projectName)}`);
        const result = await response.json();
        if (result.status === "error") return alert("❌ Projet introuvable !");

        const loadedData = JSON.parse(result.data);
        const newProject = { id: Date.now(), name: projectName, visible: true, features: [] };

        loadedData.forEach(d => {
            const weight = d.weight || (d.type === 'area' ? 3 : (d.type === 'circle' ? 3 : 4));
            let layer;
            if (d.type === 'circle') layer = L.circle(d.center, { radius: d.radius, color: d.color, weight: weight, fillOpacity: 0.3 }).addTo(map);
            else if (d.type === 'area') layer = L.polygon(d.ptsGPS, { color: d.color, weight: weight, fillOpacity: 0.3 }).addTo(map);
            else layer = L.polyline(d.ptsGPS, { color: d.color, weight: weight }).addTo(map);

            newProject.features.push({ 
                id: d.id, type: d.type, name: d.name, layer: layer, ptsGPS: d.ptsGPS, visible: true, color: d.color, 
                weight: weight, isEditing: false, editGroup: L.layerGroup().addTo(map), 
                totalDist: d.totalDist, statsHtml: d.statsHtml, center: d.center, radius: d.radius 
            });
        });

        projectStore.push(newProject); updateProjectUI();
        const group = L.featureGroup(newProject.features.map(f => f.layer)); map.fitBounds(group.getBounds());
        alert("✅ Projet chargé !");
    } catch (e) { alert("Erreur de chargement."); } finally { btn.innerText = oldText; btn.disabled = false; }
};

function updateProjectUI() {
    const list = document.getElementById('project-list'); if (!list) return; list.innerHTML = '';
    projectStore.forEach(p => {
        let featuresHtml = '';
        p.features.forEach(f => {
            let actionButton = '';
            if (f.type === 'line') actionButton = `<button onclick="generateProfileFromProject(${p.id}, ${f.id})" style="width:100%; margin-top:5px; font-size:0.75em; cursor:pointer; background:#333; color:white; border:1px solid #555; padding:3px; border-radius:3px;">📈 Voir profil</button>`;
            else if (f.type === 'area' || f.type === 'circle') actionButton = `<button onclick="generate3DViewFromProject(${p.id}, ${f.id})" style="width:100%; margin-top:5px; font-size:0.75em; cursor:pointer; background:#34495e; color:white; border:1px solid #555; padding:3px; border-radius:3px;">👁️ Contrôle Vue 3D</button>`;

            const editBtnText = f.isEditing ? '✅ Fin édition' : '✏️ Éditer';
            const editControls = f.isEditing ? `<div style="margin-top:5px; font-size:0.85em; background:#333; padding:5px; border-radius:3px; display:flex; align-items:center; gap:5px;">Épaisseur: <input type="range" min="1" max="10" value="${f.weight}" onchange="changeFeatureWeight(${f.id}, this.value, true, ${p.id})"></div>` : '';

            featuresHtml += `
                <div style="margin-left: 10px; border-left: 3px solid ${f.color}; padding-left: 8px; margin-top: 8px; background: #1a1a1a; padding-bottom: 5px;">
                    <div style="display:flex; justify-content: space-between; align-items:center;">
                        <div>
                            <input type="checkbox" ${f.visible ? 'checked' : ''} onchange="toggleProjectFeature(${p.id}, ${f.id})">
                            <input type="color" class="color-picker" value="${f.color}" onchange="changeProjectFeatureColor(${p.id}, ${f.id}, this.value)">
                            <span style="font-size:0.9em; font-weight:bold;">${f.name}</span>
                            <button onclick="toggleEditMode(${f.id}, true, ${p.id})" style="background:${f.isEditing?'#27ae60':'#7f8c8d'}; color:white; border:none; border-radius:3px; padding:2px 5px; cursor:pointer; font-size:0.7em; margin-left:5px;">${editBtnText}</button>
                        </div>
                        <button class="btn-del" onclick="deleteProjectFeature(${p.id}, ${f.id})" style="font-size:0.9em;">✕</button>
                    </div>
                    ${editControls}
                    <div style="font-size:0.85em; color:#ddd; margin: 5px 0;">${f.statsHtml || ''}</div>
                    ${actionButton}
                </div>`;
        });

        list.innerHTML += `<div class="card"><div class="card-header"><div><input type="checkbox" ${p.visible ? 'checked' : ''} onchange="toggleProject(${p.id})"><strong style="color:var(--accent); font-size:1.1em;">📁 ${p.name}</strong></div><button class="btn-del" onclick="deleteProject(${p.id})">✕</button></div><details style="margin-top: 8px; cursor: pointer;"><summary style="font-size: 0.85em; color: #aaa;">Voir le contenu (${p.features.length} calques)</summary>${featuresHtml}</details></div>`;
    });
}

window.toggleProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.visible = !p.visible; p.features.forEach(f => { f.visible = p.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } }); updateProjectUI(); };
window.deleteProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.features.forEach(f => { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); }); projectStore = projectStore.filter(x => x.id !== pid); updateProjectUI(); };
window.toggleProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.visible = !f.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } updateProjectUI(); };
window.changeProjectFeatureColor = (pid, fid, color) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.color = color; f.layer.setStyle({color: color}); updateProjectUI(); };
window.deleteProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); p.features = p.features.filter(x => x.id !== fid); updateProjectUI(); };
window.generateProfileFromProject = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); generateProfile(f); };

window.generate3DViewFromProject = (pid, fid) => {
    const p = projectStore.find(x => x.id === pid); if (!p) return;
    const f = p.features.find(x => x.id === fid); if (!f || (f.type !== 'area' && f.type !== 'circle')) return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");
    
    document.getElementById('window-3d').style.display = 'block';
    document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Calcul de la 3D en cours... ⏳</h3>';
    
    setTimeout(() => {
        const l93Pts = f.ptsGPS.map(pt => proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        l93Pts.forEach(pt => { if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0]; if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1]; });
        
        let borderPtsWithZ = [];
        l93Pts.forEach(pt => { let z = getZ(pt); if (z !== null) borderPtsWithZ.push({ x: pt[0], y: pt[1], z: z }); });
        
        const maxPts = 40; const step = Math.max(1, (maxX - minX) / maxPts, (maxY - minY) / maxPts);
        let xVals = [], yVals = [], zTerrain = [], zRefPlane = [];
        for (let x = minX; x <= maxX; x += step) xVals.push(x);
        
        for (let y = minY; y <= maxY; y += step) {
            let rowTerrain = [], rowRef = []; yVals.push(y);
            for (let x = minX; x <= maxX; x += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]); rowTerrain.push(zMNT !== null ? zMNT : null);
                    let sumZ = 0, sumW = 0, exactMatch = false, zBase = 0;
                    for (let pt of borderPtsWithZ) { let d2 = (x - pt.x)**2 + (y - pt.y)**2; if (d2 === 0) { zBase = pt.z; exactMatch = true; break; } let w = 1 / d2; sumZ += pt.z * w; sumW += w; }
                    if (!exactMatch) zBase = sumZ / sumW; rowRef.push(zBase);
                } else { rowTerrain.push(null); rowRef.push(null); }
            }
            zTerrain.push(rowTerrain); zRefPlane.push(rowRef);
        }
        
        const traceTerrain = { z: zTerrain, x: xVals, y: yVals, type: 'surface', name: 'Terrain Naturel', colorscale: 'Earth', showscale: false };
        const traceRef = { z: zRefPlane, x: xVals, y: yVals, type: 'surface', name: 'Base Calculée', colorscale: 'Blues', showscale: false, opacity: 0.6 };

        const layout = { margin: { l: 0, r: 0, b: 0, t: 0 }, scene: { aspectmode: 'data', camera: { eye: {x: -1.2, y: -1.2, z: 1.2} } }, paper_bgcolor: '#222', font: { color: 'white' }, hovermode: 'closest' };
        
        Plotly.newPlot('plot-3d', [traceTerrain, traceRef], layout).then(() => {
            const plotDiv = document.getElementById('plot-3d');
            plotDiv.on('plotly_hover', (data) => {
                if (data.points.length > 0) {
                    const pt = data.points[0]; const gps = proj4("EPSG:2154", "EPSG:4326", [pt.x, pt.y]);
                    if (!cursorMarker) cursorMarker = L.circleMarker([gps[1], gps[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
                    else cursorMarker.setLatLng([gps[1], gps[0]]);
                }
            });
            plotDiv.addEventListener('mouseleave', () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } });
        });
        
    }, 100);
};
// ==========================================
// MOTEUR DE RENDU 3D ÉPURÉ
// ==========================================

function render3DPlot(l93Pts, borderPtsWithZ) {
    document.getElementById('window-3d').style.display = 'block';
    document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Calcul de la 3D en cours... ⏳</h3>';
    document.getElementById('hover-3d-result').innerText = "Survolez le relief...";

    setTimeout(() => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        l93Pts.forEach(pt => { if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0]; if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1]; });
        
        const maxPts = 40; const step = Math.max(1, (maxX - minX) / maxPts, (maxY - minY) / maxPts);
        let xVals = [], yVals = [], zTerrain = [], zRefPlane = [];
        
        for (let x = minX; x <= maxX; x += step) xVals.push(x);
        
        for (let y = minY; y <= maxY; y += step) {
            let rowTerrain = [], rowRef = []; yVals.push(y);
            for (let x = minX; x <= maxX; x += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]); rowTerrain.push(zMNT !== null ? zMNT : null);
                    let sumZ = 0, sumW = 0, exactMatch = false, zBase = 0;
                    for (let pt of borderPtsWithZ) { let d2 = (x - pt.x)**2 + (y - pt.y)**2; if (d2 === 0) { zBase = pt.z; exactMatch = true; break; } let w = 1 / d2; sumZ += pt.z * w; sumW += w; }
                    if (!exactMatch) zBase = sumZ / sumW; rowRef.push(zBase);
                } else { rowTerrain.push(null); rowRef.push(null); }
            }
            zTerrain.push(rowTerrain); zRefPlane.push(rowRef);
        }
        
        const traceTerrain = { z: zTerrain, x: xVals, y: yVals, type: 'surface', name: '⛰️ Terrain Naturel', colorscale: 'Earth', showscale: false, showlegend: true };
        const traceRef = { z: zRefPlane, x: xVals, y: yVals, type: 'surface', name: '🟦 Base Calculée', colorscale: 'Blues', showscale: false, opacity: 0.6, showlegend: true };

        const layout = { 
            margin: { l: 0, r: 0, b: 40, t: 10 }, 
            scene: { aspectmode: 'data', camera: { eye: {x: -1.2, y: -1.2, z: 1.2} } }, 
            paper_bgcolor: '#222', font: { color: 'white' }, hovermode: 'closest',
            legend: { orientation: 'h', x: 0.5, y: -0.05, xanchor: 'center', yanchor: 'top', bgcolor: 'rgba(0,0,0,0)' }
        };
        
        Plotly.newPlot('plot-3d', [traceTerrain, traceRef], layout, { displayModeBar: true, displaylogo: false }).then(() => {
            const plotDiv = document.getElementById('plot-3d');
            
            // Animation du point sur la carte et affichage Z
            plotDiv.on('plotly_hover', (data) => {
                if (data.points.length > 0) {
                    const pt = data.points[0]; const gps = proj4("EPSG:2154", "EPSG:4326", [pt.x, pt.y]);
                    if (!cursorMarker) cursorMarker = L.circleMarker([gps[1], gps[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
                    else cursorMarker.setLatLng([gps[1], gps[0]]);
                    
                    document.getElementById('hover-3d-result').innerHTML = `📍 Altitude Z : <span style="color:white;">${pt.z.toFixed(2)} m</span>`;
                }
            });
            
            // Nettoyage quand on quitte la zone 3D
            plotDiv.addEventListener('mouseleave', () => { 
                if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } 
                document.getElementById('hover-3d-result').innerText = "Survolez le relief...";
            });
        });
    }, 100);
}

window.close3DWindow = () => {
    document.getElementById('window-3d').style.display = 'none';
    if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; }
};

window.generate3DView = (id) => {
    const d = drawStore.find(x => x.id === id); if (!d || (d.type !== 'area' && d.type !== 'circle')) return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");
    const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let borderPtsWithZ = []; l93Pts.forEach(p => { let z = getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); });
    render3DPlot(l93Pts, borderPtsWithZ);
};

window.generate3DViewFromProject = (pid, fid) => {
    const p = projectStore.find(x => x.id === pid); if (!p) return;
    const f = p.features.find(x => x.id === fid); if (!f || (f.type !== 'area' && f.type !== 'circle')) return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");
    const l93Pts = f.ptsGPS.map(pt => proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]));
    let borderPtsWithZ = []; l93Pts.forEach(pt => { let z = getZ(pt); if (z !== null) borderPtsWithZ.push({ x: pt[0], y: pt[1], z: z }); });
    render3DPlot(l93Pts, borderPtsWithZ);
};
window.toggleProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.visible = !p.visible; p.features.forEach(f => { f.visible = p.visible; if (f.visible) f.layer.addTo(map); else map.removeLayer(f.layer); }); updateProjectUI(); };
window.deleteProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.features.forEach(f => map.removeLayer(f.layer)); projectStore = projectStore.filter(x => x.id !== pid); updateProjectUI(); };
window.toggleProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.visible = !f.visible; if (f.visible) f.layer.addTo(map); else map.removeLayer(f.layer); updateProjectUI(); };
window.changeProjectFeatureColor = (pid, fid, color) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.color = color; f.layer.setStyle({color: color}); updateProjectUI(); };
window.deleteProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); map.removeLayer(f.layer); p.features = p.features.filter(x => x.id !== fid); updateProjectUI(); };
window.generateProfileFromProject = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); generateProfile(f); };
