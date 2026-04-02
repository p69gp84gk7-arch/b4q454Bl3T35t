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

let mntStore = [], drawStore = [], kmzStore = [], projectStore = [];
let currentPoints = [], tempLayer = null, currentTool = null, circleCenter = null;
let chartInstance = null, cursorMarker = null, currentProfileExportData = [], currentProfileDrawId = null;
window.currentEditingFeature = null;

// ==========================================
// 2. IMPORTATION MNT
// ==========================================
window.loadRemoteMNT = async () => {
    const select = document.getElementById('mnt-select');
    const url = select.value; const name = select.options[select.selectedIndex].text;
    if (!url) return alert("Veuillez sélectionner un MNT.");
    const btn = document.querySelector('button[onclick="loadRemoteMNT()"]'); const oldText = btn.innerText;
    btn.innerText = "⏳..."; btn.style.background = "#f39c12"; btn.disabled = true;
    try {
        const response = await fetch(url); if (!response.ok) throw new Error("Erreur réseau");
        const buffer = await response.arrayBuffer(); const tiff = await GeoTIFF.fromArrayBuffer(buffer);
        const image = await tiff.getImage(); const bbox = image.getBoundingBox(); const raster = await image.readRasters();
        const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]); const ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
        const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.15 }).addTo(map);
        mntStore.push({ id: Date.now(), name: name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2", weight: 2 });
        map.fitBounds(visual.getBounds()); updateMntUI();
    } catch(err) { alert("Erreur MNT."); } finally { btn.innerText = oldText; btn.style.background = "#00d1b2"; btn.disabled = false; }
};

document.getElementById('mnt-input').onchange = async (e) => {
    for (const file of e.target.files) {
        if (!file.name.match(/\.(tif|tiff)$/i)) continue;
        try {
            const buffer = await file.arrayBuffer(); const tiff = await GeoTIFF.fromArrayBuffer(buffer);
            const image = await tiff.getImage(); const bbox = image.getBoundingBox(); const raster = await image.readRasters();
            const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]); const ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
            const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.15 }).addTo(map);
            mntStore.push({ id: Date.now(), name: file.name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2", weight: 2 });
            map.fitBounds(visual.getBounds());
        } catch(err) {}
    } updateMntUI();
};

function updateMntUI() {
    const list = document.getElementById('mnt-list'); if (!list) return; list.innerHTML = '';
    mntStore.forEach(m => { list.innerHTML += `<div class="card" style="border-left-color: ${m.color}"><div class="card-header"><div><input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMNT(${m.id})"> <input type="color" class="color-picker" value="${m.color}" onchange="changeMntColor(${m.id}, this.value)"> <span onclick="renameMNT(${m.id})">${m.name.substring(0,18)}</span></div><button class="btn-del" onclick="deleteMNT(${m.id})">✕</button></div></div>`; });
}
window.renameMNT = (id) => { const m = mntStore.find(x => x.id === id); if (!m) return; const newName = prompt("Nom :", m.name); if (newName) { m.name = newName.trim(); updateMntUI(); } };
window.changeMntColor = (id, color) => { const m = mntStore.find(x => x.id === id); m.color = color; m.visual.setStyle({ color }); updateMntUI(); };
window.toggleMNT = (id) => { const m = mntStore.find(x => x.id === id); m.visible = !m.visible; if (m.visible) m.visual.addTo(map); else map.removeLayer(m.visual); };
window.deleteMNT = (id) => { const m = mntStore.find(x => x.id === id); map.removeLayer(m.visual); mntStore = mntStore.filter(x => x.id !== id); updateMntUI(); };

function getZ(l93) {
    for (let m of mntStore) {
        if (!m.visible) continue;
        if (l93[0] >= m.bbox[0] && l93[0] <= m.bbox[2] && l93[1] >= m.bbox[1] && l93[1] <= m.bbox[3]) {
            const px = ((l93[0] - m.bbox[0]) / (m.bbox[2] - m.bbox[0])) * m.width, py = ((m.bbox[3] - l93[1]) / (m.bbox[3] - m.bbox[1])) * m.height;
            const x1 = Math.floor(px), x2 = Math.min(x1 + 1, m.width - 1), y1 = Math.floor(py), y2 = Math.min(y1 + 1, m.height - 1);
            const dx = px - x1, dy = py - y1;
            const q11 = m.data[y1 * m.width + x1] || 0, q21 = m.data[y1 * m.width + x2] || 0, q12 = m.data[y2 * m.width + x1] || 0, q22 = m.data[y2 * m.width + x2] || 0;
            if (q11 < -500) return null; return (1-dx)*(1-dy)*q11 + dx*(1-dy)*q21 + (1-dx)*dy*q12 + dx*dy*q22;
        }
    } return null;
}

// ==========================================
// 3. CALQUES KMZ
// ==========================================
function updateKmzUI() {
    const list = document.getElementById('kmz-list'); if (!list) return; list.innerHTML = '';
    kmzStore.forEach(k => { list.innerHTML += `<div class="card" style="border-left-color: ${k.color}"><div class="card-header"><div><input type="checkbox" ${k.visible ? 'checked' : ''} onchange="toggleKMZ(${k.id})"> <input type="color" class="color-picker" value="${k.color}" onchange="changeKmzColor(${k.id}, this.value)"> <span>${k.name.substring(0,18)}</span></div></div></div>`; });
}
window.toggleKMZ = (id) => { const k = kmzStore.find(x => x.id === id); k.visible = !k.visible; if (k.visible) k.layer.addTo(map); else map.removeLayer(k.layer); };
window.changeKmzColor = (id, color) => { const k = kmzStore.find(x => x.id === id); k.color = color; k.layer.eachLayer(l => { if (l.setStyle) l.setStyle({ color }); }); updateKmzUI(); };

// ==========================================
// 4. OUTILS DE TRACÉ
// ==========================================
window.startTool = (tool) => {
    currentTool = tool; currentPoints = []; circleCenter = null;
    if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); document.getElementById('btn-' + tool).classList.add('active');
    const finishBtn = document.getElementById('btn-finish'); document.getElementById('btn-' + tool).insertAdjacentElement('afterend', finishBtn);
    finishBtn.style.display = tool === 'circle' ? 'none' : 'block';
};

map.on('click', (e) => {
    if (!currentTool) return; 
    if (currentTool === 'circle') {
        if (!circleCenter) { circleCenter = e.latlng; tempLayer = L.circle(circleCenter, {radius: 0, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map); } 
        else { finalizeCircle(circleCenter, map.distance(circleCenter, e.latlng)); circleCenter = null; }
        return;
    }
    currentPoints.push({lat: e.latlng.lat, lng: e.latlng.lng}); 
    if (tempLayer) map.removeLayer(tempLayer);
    const color = currentTool === 'area' ? '#e67e22' : '#3498db';
    tempLayer = currentTool === 'area' ? L.polygon(currentPoints, { color, weight: 3, fillOpacity: 0.3 }).addTo(map) : L.polyline(currentPoints, { color, weight: 4 }).addTo(map);
});

window.finalizeDraw = () => {
    if (!currentTool || currentPoints.length < 2) return;
    const type = currentTool; const color = type === 'area' ? '#e67e22' : '#3498db'; const weight = type === 'area' ? 3 : 4;
    const layer = type === 'area' ? L.polygon(currentPoints, { color, weight, fillOpacity: 0.3 }).addTo(map) : L.polyline(currentPoints, { color, weight }).addTo(map);
    if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
    const drawObj = { id: Date.now(), type, name: type==='line'?'Tracé':'Surface', layer, ptsGPS: [...currentPoints], visible: true, color, weight, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawStore.push(drawObj); recalculateStats(drawObj); 
    if (type === 'line') { currentProfileDrawId = drawObj.id; generateProfile(drawObj); } 
    currentTool = null; currentPoints = []; document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); document.getElementById('btn-finish').style.display = 'none'; updateDrawUI();
};

window.finalizeCircle = (center, radius) => {
    const ptsGPS = generateCirclePoints(center, radius);
    const layer = L.circle(center, {radius, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map);
    if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
    const drawObj = { id: Date.now(), type: 'circle', name: 'Cercle', layer, ptsGPS, center, radius, visible: true, color: '#9b59b6', weight: 3, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawStore.push(drawObj); recalculateStats(drawObj); currentTool = null; document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); updateDrawUI();
};

window.generateCirclePoints = (center, radius) => {
    const pts = []; const cL93 = proj4("EPSG:4326", "EPSG:2154", [center.lng, center.lat]);
    for (let i=0; i<64; i++) { const a = (i*2*Math.PI)/64; const gps = proj4("EPSG:2154", "EPSG:4326", [cL93[0]+radius*Math.cos(a), cL93[1]+radius*Math.sin(a)]); pts.push({lat: gps[1], lng: gps[0]}); }
    return pts;
};

// ==========================================
// 5. STATISTIQUES ET UI
// ==========================================
function recalculateStats(d) {
    if (d.type === 'circle') {
        const area = Math.PI * d.radius * d.radius, perimeter = 2 * Math.PI * d.radius;
        d.statsHtml = `Diam: <b>${(2*d.radius).toFixed(1)} m</b> | Périm: <b>${perimeter.toFixed(1)} m</b><br>Surface: <b>${area.toFixed(1)} m²</b>`;
    } else {
        const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
        if (d.type === 'line') {
            let dist = 0; for (let i = 1; i < l93.length; i++) dist += Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
            const z1 = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0]) || 0); 
            const z2 = d.ptsGPS[l93.length-1].customZ !== undefined ? d.ptsGPS[l93.length-1].customZ : (getZ(l93[l93.length-1]) || 0); 
            const dz = Math.abs(z2 - z1); const pente = dist > 0 ? (dz / dist * 100).toFixed(1) : 0;
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
        let actionButtons = d.type === 'line' ? `<button onclick="generateProfileById(${d.id})" style="width:100%; margin-top:8px; font-size:0.8em; cursor:pointer; background:#333; color:white; border:1px solid #555; padding:5px;">📈 Afficher profil</button>` : 
        `<div style="display:flex; gap:5px; margin-top:8px; flex-wrap:wrap;">
            <button onclick="calculateVolume(${d.id}, 'hollow')" style="flex:1; font-size:0.7em; background:#2980b9; color:white; border:none; padding:4px;">💧 Creux</button>
            <button onclick="calculateVolume(${d.id}, 'mound')" style="flex:1; font-size:0.7em; background:#e67e22; color:white; border:none; padding:4px;">⛰️ Tas</button>
            <button onclick="calculateVolume(${d.id}, 'slope')" style="flex:1; font-size:0.7em; background:#8e44ad; color:white; border:none; padding:4px;">📐 Courbe</button>
            <button onclick="calculateVolume(${d.id}, 'plane')" style="flex:1; font-size:0.7em; background:#9b59b6; color:white; border:none; padding:4px;">📏 Plan</button>
            <button onclick="generate3DView(${d.id})" style="flex:1; min-width:100%; font-size:0.75em; background:#34495e; color:white; border:1px solid #555; padding:5px; margin-top:2px;">👁️ Vue 3D</button>
        </div>`;
        const editBtnText = d.isEditing ? '✅ Fin édition' : '✏️ Éditer';
        const editControls = d.isEditing ? `<div style="margin-top:5px; font-size:0.8em; background:#222; padding:5px; display:flex; align-items:center;">Épaisseur: <input type="range" min="1" max="10" value="${d.weight}" onchange="changeFeatureWeight(${d.id}, this.value)" style="width:60px; margin:0 5px;"></div>` : '';
        list.innerHTML += `<div class="card" style="border-left-color: ${d.color}"><div class="card-header"><div style="display:flex; align-items:center;"><input type="checkbox" ${d.visible ? 'checked' : ''} onchange="toggleDraw(${d.id})"> <input type="color" class="color-picker" value="${d.color}" onchange="changeColor(${d.id}, this.value)"> <strong onclick="renameDraw(${d.id})">${d.name}</strong><button onclick="toggleEditMode(${d.id})" style="background:${d.isEditing?'#27ae60':'#7f8c8d'}; color:white; border:none; border-radius:3px; padding:2px 5px; font-size:0.7em; margin-left:5px;">${editBtnText}</button></div><button class="btn-del" onclick="deleteDraw(${d.id})">✕</button></div>${editControls}<div id="stats-${d.id}" style="margin-top:5px; font-size:1.1em;">${d.statsHtml}</div>${actionButtons}</div>`;
    });
}

function updateProjectUI() {
    const list = document.getElementById('project-list'); if (!list) return; list.innerHTML = '';
    projectStore.forEach(p => {
        let featuresHtml = '';
        p.features.forEach(f => {
            let actionButton = f.type === 'line' ? `<button onclick="generateProfileFromProject(${p.id}, ${f.id})" style="width:100%; margin-top:5px; font-size:0.75em; cursor:pointer; background:#333; color:white; border:1px solid #555; padding:3px;">📈 Voir profil</button>` : `<button onclick="generate3DViewFromProject(${p.id}, ${f.id})" style="width:100%; margin-top:5px; font-size:0.75em; cursor:pointer; background:#34495e; color:white; border:1px solid #555; padding:3px;">👁️ Vue 3D</button>`;
            const editBtnText = f.isEditing ? '✅ Fin édition' : '✏️ Éditer';
            const editControls = f.isEditing ? `<div style="margin-top:5px; font-size:0.8em; background:#333; padding:5px; display:flex; align-items:center;">Épaisseur: <input type="range" min="1" max="10" value="${f.weight}" onchange="changeFeatureWeight(${f.id}, this.value, true, ${p.id})" style="width:60px; margin:0 5px;"></div>` : '';
            featuresHtml += `<div style="margin-left: 10px; border-left: 3px solid ${f.color}; padding-left: 8px; margin-top: 8px; background: #1a1a1a; padding-bottom: 5px;"><div style="display:flex; justify-content: space-between; align-items:center;"><div><input type="checkbox" ${f.visible ? 'checked' : ''} onchange="toggleProjectFeature(${p.id}, ${f.id})"> <input type="color" class="color-picker" value="${f.color}" onchange="changeProjectFeatureColor(${p.id}, ${f.id}, this.value)"> <span style="font-size:0.9em; font-weight:bold;">${f.name}</span> <button onclick="toggleEditMode(${f.id}, true, ${p.id})" style="background:${f.isEditing?'#27ae60':'#7f8c8d'}; color:white; border:none; padding:2px 5px; font-size:0.7em; margin-left:5px;">${editBtnText}</button></div><button class="btn-del" onclick="deleteProjectFeature(${p.id}, ${f.id})" style="font-size:0.9em;">✕</button></div>${editControls}<div style="font-size:0.85em; color:#ddd; margin: 5px 0;">${f.statsHtml || ''}</div>${actionButton}</div>`;
        });
        list.innerHTML += `<div class="card"><div class="card-header"><div><input type="checkbox" ${p.visible ? 'checked' : ''} onchange="toggleProject(${p.id})"><strong style="color:var(--accent); font-size:1.1em;">📁 ${p.name}</strong></div><button class="btn-del" onclick="deleteProject(${p.id})">✕</button></div><details style="margin-top: 8px; cursor: pointer;"><summary style="font-size: 0.85em; color: #aaa;">Voir le contenu (${p.features.length} calques)</summary>${featuresHtml}</details></div>`;
    });
}

window.renameDraw = (id) => { const d = drawStore.find(x => x.id === id); if (!d) return; const newName = prompt("Nouveau nom :", d.name); if (newName) { d.name = newName.trim(); updateDrawUI(); } };
window.toggleDraw = (id) => { const d = drawStore.find(x => x.id === id); d.visible = !d.visible; if (d.visible) { d.layer.addTo(map); if(d.isEditing) makeEditable(d); } else { map.removeLayer(d.layer); if(d.editGroup) d.editGroup.clearLayers(); } updateDrawUI(); };
window.changeColor = (id, color) => { const d = drawStore.find(x => x.id === id); d.color = color; d.layer.setStyle({ color }); updateDrawUI(); if (chartInstance && currentProfileDrawId === id) { chartInstance.data.datasets[0].borderColor = color; chartInstance.data.datasets[0].backgroundColor = color + '33'; chartInstance.update(); } };
window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); if(d.editGroup) map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); if(currentProfileDrawId === id) document.getElementById('profile-window').style.display = 'none'; };
window.changeFeatureWeight = (id, w, isProj = false, pid = null) => { let d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id); if(!d)return; d.weight = parseInt(w); d.layer.setStyle({ weight: d.weight }); };

window.toggleProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.visible = !p.visible; p.features.forEach(f => { f.visible = p.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } }); updateProjectUI(); };
window.deleteProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.features.forEach(f => { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); }); projectStore = projectStore.filter(x => x.id !== pid); updateProjectUI(); };
window.toggleProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.visible = !f.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } updateProjectUI(); };
window.changeProjectFeatureColor = (pid, fid, color) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.color = color; f.layer.setStyle({color: color}); updateProjectUI(); };
window.deleteProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); p.features = p.features.filter(x => x.id !== fid); updateProjectUI(); };
window.generateProfileFromProject = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); generateProfile(f); };

// ==========================================
// 6. ÉDITION XYZ SYNCHRONISÉE
// ==========================================
window.toggleEditMode = (id, isProj = false, pid = null) => { 
    let d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id); 
    if(!d) return; d.isEditing = !d.isEditing; 
    if(!d.editGroup) d.editGroup = L.layerGroup().addTo(map); 
    if(d.isEditing && d.visible) { makeEditable(d, isProj, pid); if (d.type !== 'circle') openPointEditor(id, isProj, pid); } 
    else { 
        d.editGroup.clearLayers(); 
        if (window.currentEditingFeature && window.currentEditingFeature.id === id) { document.getElementById('point-editor-window').style.display = 'none'; window.currentEditingFeature = null; }
    } 
    if(isProj) updateProjectUI(); else updateDrawUI(); 
};

function makeEditable(d, isProj = false, pid = null) {
    if(d.editGroup) d.editGroup.clearLayers(); if (!d.visible || !d.isEditing) return;
    const icon = L.divIcon({ className: 'edit-handle', iconSize: [12, 12] });
    if (d.type === 'circle') {
        const centerMarker = L.marker(d.center, { icon, draggable: true }).addTo(d.editGroup);
        const cL93 = proj4("EPSG:4326", "EPSG:2154", [d.center.lng, d.center.lat]);
        const edgeMarker = L.marker([proj4("EPSG:2154", "EPSG:4326", [cL93[0]+d.radius, cL93[1]])[1], proj4("EPSG:2154", "EPSG:4326", [cL93[0]+d.radius, cL93[1]])[0]], { icon, draggable: true }).addTo(d.editGroup);
        centerMarker.on('drag', (e) => { d.center = e.latlng; d.layer.setLatLng(d.center); d.ptsGPS = generateCirclePoints(d.center, d.radius); const nL93 = proj4("EPSG:4326", "EPSG:2154", [d.center.lng, d.center.lat]); const nG = proj4("EPSG:2154", "EPSG:4326", [nL93[0]+d.radius, nL93[1]]); edgeMarker.setLatLng([nG[1], nG[0]]); recalculateStats(d); });
        edgeMarker.on('drag', (e) => { d.radius = map.distance(d.center, e.latlng); d.layer.setRadius(d.radius); d.ptsGPS = generateCirclePoints(d.center, d.radius); recalculateStats(d); });
    } else {
        d.ptsGPS.forEach((pt, idx) => {
            const marker = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
            marker.on('drag', (e) => { 
                d.ptsGPS[idx].lat = e.latlng.lat; d.ptsGPS[idx].lng = e.latlng.lng; d.layer.setLatLngs(d.ptsGPS); recalculateStats(d); if(d.type==='line') generateProfile(d); 
                if (window.currentEditingFeature && window.currentEditingFeature.id === d.id) {
                    const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
                    const inX = document.getElementById(`edit-x-${idx}`), inY = document.getElementById(`edit-y-${idx}`);
                    if (inX) inX.value = l93[0].toFixed(2); if (inY) inY.value = l93[1].toFixed(2);
                }
            });
            marker.on('dragend', () => { if(isProj) updateProjectUI(); else updateDrawUI(); });
        });
    }
}

window.openPointEditor = (id, isProject = false, pid = null) => {
    const d = isProject ? projectStore.find(p => p.id === pid)?.features.find(f => f.id === id) : drawStore.find(x => x.id === id);
    if (!d || d.type === 'circle') return; window.currentEditingFeature = { id, isProject, pid, d };
    let html = '<table style="width:100%; color:white; border-collapse:collapse; font-size:0.85em; text-align:center;"><tr style="border-bottom:1px solid #555; background:#111;"><th>Pt</th><th>X (L93)</th><th>Y (L93)</th><th>Z Forcé</th></tr>';
    d.ptsGPS.forEach((pt, i) => {
        const l93 = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]); let zVal = pt.customZ !== undefined ? pt.customZ : '';
        html += `<tr style="border-bottom:1px solid #444;"><td style="padding:4px;">${i+1}</td><td><input type="number" step="0.01" id="edit-x-${i}" value="${l93[0].toFixed(2)}" oninput="applyPointEdits(false)" style="width:100px; background:#222; color:white; border:1px solid #555; padding:2px;"></td><td><input type="number" step="0.01" id="edit-y-${i}" value="${l93[1].toFixed(2)}" oninput="applyPointEdits(false)" style="width:100px; background:#222; color:white; border:1px solid #555; padding:2px;"></td><td><input type="number" step="0.01" id="edit-z-${i}" value="${zVal}" placeholder="Auto" oninput="applyPointEdits(false)" style="width:80px; background:#2980b9; color:white; border:1px solid #555; padding:2px;"></td></tr>`;
    });
    html += '</table>'; document.getElementById('point-editor-content').innerHTML = html; document.getElementById('point-editor-window').style.display = 'flex';
};

window.applyPointEdits = (closeWindow = true) => {
    if (!window.currentEditingFeature) return; const { d, isProject, pid } = window.currentEditingFeature;
    for (let i = 0; i < d.ptsGPS.length; i++) {
        const xVal = parseFloat(document.getElementById(`edit-x-${i}`).value), yVal = parseFloat(document.getElementById(`edit-y-${i}`).value), zVal = document.getElementById(`edit-z-${i}`).value;
        if (!isNaN(xVal) && !isNaN(yVal)) { const gps = proj4("EPSG:2154", "EPSG:4326", [xVal, yVal]); d.ptsGPS[i].lat = gps[1]; d.ptsGPS[i].lng = gps[0]; }
        if (zVal.trim() !== '') d.ptsGPS[i].customZ = parseFloat(zVal); else delete d.ptsGPS[i].customZ;
    }
    if (d.type === 'area' || d.type === 'line') d.layer.setLatLngs(d.ptsGPS); recalculateStats(d);
    if (d.isEditing && !closeWindow) {
        d.editGroup.clearLayers(); const icon = L.divIcon({ className: 'edit-handle', iconSize: [12, 12] });
        d.ptsGPS.forEach((pt, idx) => {
            const marker = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
            marker.on('drag', (e) => { d.ptsGPS[idx].lat = e.latlng.lat; d.ptsGPS[idx].lng = e.latlng.lng; d.layer.setLatLngs(d.ptsGPS); recalculateStats(d); if(d.type==='line') generateProfile(d); if (window.currentEditingFeature && window.currentEditingFeature.id === d.id) { const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]); const inX = document.getElementById(`edit-x-${idx}`); const inY = document.getElementById(`edit-y-${idx}`); if (inX) inX.value = l93[0].toFixed(2); if (inY) inY.value = l93[1].toFixed(2); } });
            marker.on('dragend', () => { if(isProject) updateProjectUI(); else updateDrawUI(); });
        });
    }
    if (d.type === 'line' && currentProfileDrawId === d.id) generateProfile(d); if (closeWindow) document.getElementById('point-editor-window').style.display = 'none';
};

// ==========================================
// 7. CALCUL DES VOLUMES 
// ==========================================
window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id); if (!d || d.type === 'line') return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");
    const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    l93Pts.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });

    let refZ = 0, borderPtsWithZ = [];
    if (type === 'slope' || type === 'plane') {
        l93Pts.forEach((p, idx) => { let z = d.ptsGPS[idx].customZ !== undefined ? d.ptsGPS[idx].customZ : getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); });
    } else {
        let sampleZ = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : getZ(l93Pts[0]);
        let refZPrompt = prompt("Altitude de référence (Z) en mètres ?", sampleZ ? Math.round(sampleZ) : 0);
        if (!refZPrompt) return; refZ = parseFloat(refZPrompt.replace(',', '.')); if (isNaN(refZ)) return;
    }

    setTimeout(() => {
        let totalVolumeTas = 0, totalVolumeCreux = 0, step = 1, pixelArea = 1, pointsCount = 0;
        let aReg = 0, bReg = 0, cReg = 0;
        if (type === 'plane') {
            let sumX = 0, sumY = 0, sumZ = 0; borderPtsWithZ.forEach(p => { sumX += p.x; sumY += p.y; sumZ += p.z; });
            const nPts = borderPtsWithZ.length; const cX = sumX / nPts, cY = sumY / nPts, cZ = sumZ / nPts;
            let Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0; borderPtsWithZ.forEach(p => { const dx = p.x-cX, dy = p.y-cY, dz = p.z-cZ; Sxx+=dx*dx; Syy+=dy*dy; Sxy+=dx*dy; Sxz+=dx*dz; Syz+=dy*dz; });
            const D = Sxx * Syy - Sxy * Sxy; if (D !== 0) { aReg = (Sxz*Syy - Syz*Sxy)/D; bReg = (Syz*Sxx - Sxz*Sxy)/D; }
            cReg = cZ - aReg * cX - bReg * cY;
        }

        for (let x = minX; x <= maxX; x += step) {
            for (let y = minY; y <= maxY; y += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]);
                    if (zMNT !== null) {
                        pointsCount++;
                        if (type === 'slope' || type === 'plane') {
                            let zBase = 0;
                            if (type === 'slope') {
                                let sumZ = 0, sumW = 0, exactMatch = false;
                                for (let pt of borderPtsWithZ) { let d2 = (x-pt.x)**2 + (y-pt.y)**2; if (d2 === 0) { zBase = pt.z; exactMatch = true; break; } let w = 1/d2; sumZ += pt.z*w; sumW += w; }
                                if (!exactMatch) zBase = sumZ / sumW;
                            } else zBase = aReg * x + bReg * y + cReg;
                            if (zMNT > zBase) totalVolumeTas += (zMNT - zBase) * pixelArea; else if (zMNT < zBase) totalVolumeCreux += (zBase - zMNT) * pixelArea;
                        } else {
                            if (type === 'hollow' && zMNT < refZ) totalVolumeCreux += (refZ - zMNT) * pixelArea; else if (type === 'mound' && zMNT > refZ) totalVolumeTas += (zMNT - refZ) * pixelArea;
                        }
                    }
                }
            }
        }
        if (pointsCount === 0) return alert("Aucune donnée MNT.");
        let msg = "", resultHtml = "";
        if (type === 'slope' || type === 'plane') {
            const title = type === 'slope' ? 'Pente (Courbe)' : 'Plan Parfait';
            const tasStr = totalVolumeTas.toLocaleString('fr-FR', {maximumFractionDigits:1}), creuxStr = totalVolumeCreux.toLocaleString('fr-FR', {maximumFractionDigits:1});
            msg = `📐 Bilan sur ${title}:\n⛰️ Tas : ${tasStr} m³\n💧 Creux : ${creuxStr} m³`;
            resultHtml = `<br><span style="color:${type==='slope'?'#8e44ad':'#9b59b6'}; font-size:0.9em; display:block; margin-top:3px;">Tas (${title}): <b>${tasStr} m³</b> | Creux: <b>${creuxStr} m³</b></span>`;
        } else {
            let vol = type === 'hollow' ? totalVolumeCreux : totalVolumeTas, volStr = vol.toLocaleString('fr-FR', {maximumFractionDigits:1});
            msg = type === 'hollow' ? `💧 Creux (sous ${refZ}m) : ${volStr} m³` : `⛰️ Tas (sur ${refZ}m) : ${volStr} m³`;
            resultHtml = `<br><span style="color:${type==='hollow'?'#2980b9':'#e67e22'}; font-size:0.9em; display:block; margin-top:3px;">${type==='hollow'?'Vol. Creux':'Vol. Tas'} (${refZ}m): <b>${volStr} m³</b></span>`;
        }
        alert(msg); d.statsHtml += resultHtml; const statsDiv = document.getElementById(`stats-${d.id}`); if (statsDiv) statsDiv.innerHTML = d.statsHtml;
    }, 50);
};

// ==========================================
// 8. MOTEUR 3D ET EXPORT STL
// ==========================================
window.current3DData = null; 
function render3DPlot(l93Pts, borderPtsWithZ) {
    document.getElementById('window-3d').style.display = 'block'; document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Calcul... ⏳</h3>'; document.getElementById('hover-3d-result').innerText = "Survolez le relief...";
    setTimeout(() => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity; l93Pts.forEach(pt => { if (pt[0] < minX) minX = pt[0]; if (pt[0] > maxX) maxX = pt[0]; if (pt[1] < minY) minY = pt[1]; if (pt[1] > maxY) maxY = pt[1]; });
        const maxPts = 40; const step = Math.max(1, (maxX - minX) / maxPts, (maxY - minY) / maxPts);
        let xVals = [], yVals = [], zTerrain = [], zRefCurve = [], zRefPlane = [];
        
        let sumX = 0, sumY = 0, sumZ = 0; borderPtsWithZ.forEach(p => { sumX += p.x; sumY += p.y; sumZ += p.z; });
        const nPts = borderPtsWithZ.length; const cX = sumX / nPts, cY = sumY / nPts, cZ = sumZ / nPts;
        let Sxx = 0, Syy = 0, Sxy = 0, Sxz = 0, Syz = 0; borderPtsWithZ.forEach(p => { const dx = p.x-cX, dy = p.y-cY, dz = p.z-cZ; Sxx+=dx*dx; Syy+=dy*dy; Sxy+=dx*dy; Sxz+=dx*dz; Syz+=dy*dz; });
        const D = Sxx * Syy - Sxy * Sxy; let aReg = 0, bReg = 0, cReg = cZ; if (D !== 0) { aReg = (Sxz*Syy - Syz*Sxy)/D; bReg = (Syz*Sxx - Sxz*Sxy)/D; cReg = cZ - aReg*cX - bReg*cY; }

        for (let x = minX; x <= maxX; x += step) xVals.push(x);
        for (let y = minY; y <= maxY; y += step) {
            let rowTerrain = [], rowCurve = [], rowPlane = []; yVals.push(y);
            for (let x = minX; x <= maxX; x += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]); rowTerrain.push(zMNT !== null ? zMNT : null);
                    let sumZC = 0, sumW = 0, exactMatch = false, zBaseC = 0;
                    for (let pt of borderPtsWithZ) { let d2 = (x-pt.x)**2 + (y-pt.y)**2; if (d2 === 0) { zBaseC = pt.z; exactMatch = true; break; } let w = 1/d2; sumZC += pt.z*w; sumW += w; }
                    if (!exactMatch) zBaseC = sumZC / sumW; rowCurve.push(zBaseC);
                    rowPlane.push(aReg * x + bReg * y + cReg);
                } else { rowTerrain.push(null); rowCurve.push(null); rowPlane.push(null); }
            } zTerrain.push(rowTerrain); zRefCurve.push(rowCurve); zRefPlane.push(rowPlane);
        }
        window.current3DData = { x: xVals, y: yVals, zTop: zTerrain };
        Plotly.newPlot('plot-3d', [
            { z: zTerrain, x: xVals, y: yVals, type: 'surface', name: '⛰️ Terrain Naturel', colorscale: 'Earth', showscale: false },
            { z: zRefCurve, x: xVals, y: yVals, type: 'surface', name: '🟦 Base Courbe', colorscale: 'Blues', showscale: false, opacity: 0.5, visible: 'legendonly' },
            { z: zRefPlane, x: xVals, y: yVals, type: 'surface', name: '🟪 Plan Parfait', colorscale: 'Purples', showscale: false, opacity: 0.7 }
        ], { margin: { l: 0, r: 0, b: 40, t: 10 }, scene: { aspectmode: 'data', camera: { eye: {x: -1.2, y: -1.2, z: 1.2} } }, paper_bgcolor: '#222', font: { color: 'white' }, hovermode: 'closest', legend: { orientation: 'h', x: 0.5, y: -0.05, xanchor: 'center', yanchor: 'top', bgcolor: 'rgba(0,0,0,0)' } }, { displayModeBar: true, displaylogo: false }).then(() => {
            document.getElementById('plot-3d').on('plotly_hover', (data) => { if (data.points.length > 0) { const pt = data.points[0]; const gps = proj4("EPSG:2154", "EPSG:4326", [pt.x, pt.y]); if (!cursorMarker) cursorMarker = L.circleMarker([gps[1], gps[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map); else cursorMarker.setLatLng([gps[1], gps[0]]); document.getElementById('hover-3d-result').innerHTML = `📍 Altitude Z : <span style="color:white;">${pt.z.toFixed(2)} m</span>`; } });
            document.getElementById('plot-3d').addEventListener('mouseleave', () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } document.getElementById('hover-3d-result').innerText = "Survolez le relief..."; });
        });
    }, 100);
}

window.exportSTL = () => {
    if (!window.current3DData || !window.current3DData.zTop) return alert("Calculez d'abord une vue 3D complète.");
    let stl = "solid terrain\n"; const {x, y, zTop} = window.current3DData; let minX = Infinity, minY = Infinity, minZ = Infinity;
    for (let i=0; i<y.length; i++) for (let j=0; j<x.length; j++) if (zTop[i][j] !== null) { if (x[j]<minX) minX=x[j]; if (y[i]<minY) minY=y[i]; if (zTop[i][j]<minZ) minZ=zTop[i][j]; }
    const addF = (v1, v2, v3) => { stl += `facet normal 0 0 0\n outer loop\n vertex ${(v1[0]-minX).toFixed(3)} ${(v1[1]-minY).toFixed(3)} ${(v1[2]-minZ).toFixed(3)}\n vertex ${(v2[0]-minX).toFixed(3)} ${(v2[1]-minY).toFixed(3)} ${(v2[2]-minZ).toFixed(3)}\n vertex ${(v3[0]-minX).toFixed(3)} ${(v3[1]-minY).toFixed(3)} ${(v3[2]-minZ).toFixed(3)}\n endloop\nendfacet\n`; };
    for (let i=0; i<y.length-1; i++) for (let j=0; j<x.length-1; j++) if (zTop[i][j] !== null && zTop[i][j+1] !== null && zTop[i+1][j] !== null && zTop[i+1][j+1] !== null) { addF([x[j], y[i], zTop[i][j]], [x[j+1], y[i], zTop[i][j+1]], [x[j], y[i+1], zTop[i+1][j]]); addF([x[j+1], y[i], zTop[i][j+1]], [x[j+1], y[i+1], zTop[i+1][j+1]], [x[j], y[i+1], zTop[i+1][j]]); }
    stl += "endsolid terrain\n";
    const a = document.createElement('a'); a.style.display = 'none'; a.href = URL.createObjectURL(new Blob([stl], {type: 'text/plain;charset=utf-8'})); a.download = 'terrain.stl'; document.body.appendChild(a); a.click(); setTimeout(() => document.body.removeChild(a), 100);
};

window.close3DWindow = () => { document.getElementById('window-3d').style.display = 'none'; if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } };
window.generate3DView = (id) => { const d = drawStore.find(x => x.id === id); if (!d || d.type === 'line') return; const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat])); let borderPtsWithZ = []; l93Pts.forEach((p, idx) => { let z = d.ptsGPS[idx].customZ !== undefined ? d.ptsGPS[idx].customZ : getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); }); render3DPlot(l93Pts, borderPtsWithZ); };
window.generate3DViewFromProject = (pid, fid) => { const p = projectStore.find(x => x.id === pid); if(!p)return; const f = p.features.find(x => x.id === fid); if (!f || f.type === 'line') return; const l93Pts = f.ptsGPS.map(pt => proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat])); let borderPtsWithZ = []; l93Pts.forEach((pt, idx) => { let z = f.ptsGPS[idx].customZ !== undefined ? f.ptsGPS[idx].customZ : getZ(pt); if (z !== null) borderPtsWithZ.push({ x: pt[0], y: pt[1], z: z }); }); render3DPlot(l93Pts, borderPtsWithZ); };

const win3d = document.getElementById('window-3d'), header3d = document.getElementById('header-3d'); let isDragging3D = false, offset3DX = 0, offset3DY = 0; header3d.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; isDragging3D = true; const rect = win3d.getBoundingClientRect(); offset3DX = e.clientX - rect.left; offset3DY = e.clientY - rect.top; }); document.addEventListener('mousemove', (e) => { if (!isDragging3D) return; win3d.style.left = Math.max(0, e.clientX - offset3DX) + 'px'; win3d.style.top = Math.max(0, e.clientY - offset3DY) + 'px'; }); document.addEventListener('mouseup', () => { isDragging3D = false; });
const ptWin = document.getElementById('point-editor-window'), ptHeader = document.getElementById('header-point-editor'); let isDraggingPt = false, offsetPtX = 0, offsetPtY = 0; ptHeader.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; isDraggingPt = true; const rect = ptWin.getBoundingClientRect(); offsetPtX = e.clientX - rect.left; offsetPtY = e.clientY - rect.top; }); document.addEventListener('mousemove', (e) => { if (!isDraggingPt) return; ptWin.style.left = Math.max(0, e.clientX - offsetPtX) + 'px'; ptWin.style.top = Math.max(0, e.clientY - offsetPtY) + 'px'; }); document.addEventListener('mouseup', () => { isDraggingPt = false; });

// ==========================================
// 9. PROFIL ALTIMÉTRIQUE
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; const d = drawStore.find(x => x.id === id); generateProfile(d); };
function generateProfile(d) {
    document.getElementById('profile-window').style.display = 'block'; const ctx = document.getElementById('profileChart').getContext('2d');
    const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let cumulativeDistances = [0], totalDist = 0; for (let i = 1; i < l93Pts.length; i++) { totalDist += Math.hypot(l93Pts[i][0]-l93Pts[i-1][0], l93Pts[i][1]-l93Pts[i-1][1]); cumulativeDistances.push(totalDist); }
    let chartData = [], geoRef = []; currentProfileExportData = []; const samplingInterval = 1; 
    let zStart = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93Pts[0]) || 0);
    addPointToChart(0, zStart, l93Pts[0]); let nextSampleDist = samplingInterval;

    for (let i = 1; i < l93Pts.length; i++) {
        const segLen = cumulativeDistances[i] - cumulativeDistances[i-1]; const p1 = l93Pts[i-1], p2 = l93Pts[i];
        while (nextSampleDist < cumulativeDistances[i]) {
            const t = segLen === 0 ? 0 : (nextSampleDist - cumulativeDistances[i-1]) / segLen;
            const x = p1[0] + (p2[0] - p1[0]) * t, y = p1[1] + (p2[1] - p1[1]) * t;
            addPointToChart(nextSampleDist, getZ([x, y]) || 0, [x, y]); nextSampleDist += samplingInterval;
        }
        if (Math.abs(cumulativeDistances[i] - (nextSampleDist - samplingInterval)) > 0.1) {
             let zEnd = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : (getZ(l93Pts[i]) || 0);
             addPointToChart(cumulativeDistances[i], zEnd, l93Pts[i]);
        }
    }
    function addPointToChart(dist, z, l93Coords) { chartData.push({ x: parseFloat(dist.toFixed(1)), y: parseFloat(z.toFixed(2)) }); geoRef.push(proj4("EPSG:2154", "EPSG:4326", l93Coords)); currentProfileExportData.push({ dist: dist.toFixed(2), z: z.toFixed(2) }); }
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, { type: 'line', data: { datasets: [{ label: 'Altitude Z (m)', data: chartData, borderColor: d.color, backgroundColor: d.color + '33', fill: true, pointRadius: 0, tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { type: 'linear' } }, onHover: (event, elements) => { if (elements.length > 0) { const pos = geoRef[elements[0].index]; if (!cursorMarker) cursorMarker = L.circleMarker([pos[1], pos[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map); else cursorMarker.setLatLng([pos[1], pos[0]]); } } } });
    document.getElementById('profileChart').onmouseleave = () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } };
}
window.exportChartPNG = () => { const a = document.createElement('a'); a.href = document.getElementById('profileChart').toDataURL('image/png'); a.download = 'profil.png'; a.click(); };
window.exportChartCSV = () => { let csv = "\ufeffDistance (m)\tAltitude Z (m)\n"; currentProfileExportData.forEach(r => { csv += `${r.dist.replace('.', ',')}\t${r.z.replace('.', ',')}\n`; }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = 'profil.csv'; a.click(); };

// ==========================================
// 10. SOURIS SUR CARTE ET FENÊTRE PROFIL
// ==========================================
map.on('mousemove', (e) => {
    try {
        if (!e.latlng) return; const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
        const elX = document.getElementById('cur-x'), elY = document.getElementById('cur-y'), elZ = document.getElementById('cur-z');
        if (elX) elX.innerText = l93[0].toFixed(1); if (elY) elY.innerText = l93[1].toFixed(1);
        if (elZ) { let z = null; try { z = getZ(l93); } catch (err) {} elZ.innerText = (z !== null && !isNaN(z)) ? z.toFixed(2) : "---"; }
        if (typeof currentTool !== 'undefined' && currentTool === 'circle' && typeof circleCenter !== 'undefined' && circleCenter && tempLayer) tempLayer.setRadius(map.distance(circleCenter, e.latlng));
    } catch (error) {}
});
const profileWin = document.getElementById('profile-window'), profileHeader = document.getElementById('profile-header'); let isDraggingProf = false, dragOffsetXProf = 0, dragOffsetYProf = 0; profileHeader.addEventListener('mousedown', (e) => { if (e.target.tagName === 'BUTTON') return; isDraggingProf = true; const rect = profileWin.getBoundingClientRect(); dragOffsetXProf = e.clientX - rect.left; dragOffsetYProf = e.clientY - rect.top; }); document.addEventListener('mousemove', (e) => { if (!isDraggingProf) return; let newX = e.clientX - dragOffsetXProf, newY = e.clientY - dragOffsetYProf; if (newX < 0) newX = 0; if (newY < 0) newY = 0; profileWin.style.left = newX + 'px'; profileWin.style.top = newY + 'px'; }); document.addEventListener('mouseup', () => { isDraggingProf = false; });

// ==========================================
// 11. CHARGEMENT STATIQUE (KMZ)
// ==========================================
window.addEventListener('load', () => {
    try {
        let pistesGeo = null; if (typeof pistesData !== 'undefined') pistesGeo = pistesData; else if (typeof pistesGeoJSON !== 'undefined') pistesGeo = pistesGeoJSON;
        if (pistesGeo && pistesGeo.features) { const pistesLayer = L.geoJSON(pistesGeo, { style: () => ({ color: '#ffffff', weight: 1, opacity: 1, fillOpacity: 0.2 }) }).addTo(map); kmzStore.push({ id: Date.now(), name: "Mes Pistes", layer: pistesLayer, visible: true, color: '#ffffff', weight: 1 }); map.fitBounds(pistesLayer.getBounds()); }
        if (typeof canonData !== 'undefined' && canonData.features) { const canonLayer = L.geoJSON(canonData, { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: '#3498db', color: '#ffffff', weight: 1, opacity: 1, fillOpacity: 0.8 }) }).addTo(map); kmzStore.push({ id: Date.now() + 1000, name: "Mes Canons", layer: canonLayer, visible: true, color: '#3498db', weight: 1 }); }
        updateKmzUI();
    } catch (e) {}
});

// ==========================================
// 12. GOOGLE SHEETS ET SAUVEGARDE
// ==========================================
const SCRIPT_URL = "VOTRE_URL_WEB_APP_ICI"; // <--- ⚠️ REMETTEZ VOTRE LIEN GOOGLE SCRIPT ICI !!!

window.saveProject = async () => {
    const projectName = document.getElementById('project-name').value.trim(); if (!projectName || drawStore.length === 0) return;
    const exportData = drawStore.map(d => ({ id: d.id, type: d.type, name: d.name, color: d.color, weight: d.weight, ptsGPS: d.ptsGPS, totalDist: d.totalDist, statsHtml: d.statsHtml, center: d.center, radius: d.radius }));
    const btn = document.querySelector('button[onclick="saveProject()"]'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const response = await fetch(SCRIPT_URL, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ projectName: projectName, projectData: JSON.stringify(exportData) }) });
        const result = await response.json();
        if (result.status === "success") {
            const newProject = { id: Date.now(), name: projectName, visible: true, features: [...drawStore] };
            newProject.features.forEach(f => { f.isEditing = false; if (f.editGroup) map.removeLayer(f.editGroup); });
            projectStore.push(newProject); drawStore = []; updateDrawUI(); updateProjectUI(); alert("✅ Projet sauvegardé !");
        }
    } catch (e) {} finally { btn.innerText = "Sauver"; btn.disabled = false; }
};

window.loadProject = async () => {
    const projectName = document.getElementById('project-name').value.trim(); if (!projectName) return;
    const btn = document.querySelector('button[onclick="loadProject()"]'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const response = await fetch(`${SCRIPT_URL}?projectName=${encodeURIComponent(projectName)}`);
        const result = await response.json(); if (result.status === "error") return alert("❌ Projet introuvable !");
        const loadedData = JSON.parse(result.data); const newProject = { id: Date.now(), name: projectName, visible: true, features: [] };
        
        loadedData.forEach(d => {
            const weight = d.weight || 3; let layer;
            const restoredPts = d.ptsGPS.map(p => { let pt = {lat: p.lat, lng: p.lng}; if(p.customZ !== undefined) pt.customZ = p.customZ; return pt; });
            if (d.type === 'circle') layer = L.circle(d.center, { radius: d.radius, color: d.color, weight: weight, fillOpacity: 0.3 }).addTo(map);
            else if (d.type === 'area') layer = L.polygon(restoredPts, { color: d.color, weight: weight, fillOpacity: 0.3 }).addTo(map);
            else layer = L.polyline(restoredPts, { color: d.color, weight: weight }).addTo(map);

            newProject.features.push({ id: d.id, type: d.type, name: d.name, layer: layer, ptsGPS: restoredPts, visible: true, color: d.color, weight: weight, isEditing: false, editGroup: L.layerGroup().addTo(map), totalDist: d.totalDist, statsHtml: d.statsHtml, center: d.center, radius: d.radius });
        });
        projectStore.push(newProject); updateProjectUI();
        const group = L.featureGroup(newProject.features.map(f => f.layer)); map.fitBounds(group.getBounds()); alert("✅ Projet chargé !");
    } catch (e) {} finally { btn.innerText = "Charger"; btn.disabled = false; }
};
