// ==========================================
// 1. CONFIGURATION CARTE ET SYSTÈME L93
// ==========================================
proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs");

const map = L.map('map', { doubleClickZoom: false }).setView([42.7645, 0.5833], 15);
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
const planOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
L.control.layers({ "🌍 Satellite": satellite, "🗺️ Plan": planOSM }).addTo(map);

let mntStore = [], drawStore = [], kmzStore = [], projectStore = [];
let currentPoints = [], tempLayer = null, currentTool = null, circleCenter = null;
let chartInstance = null, cursorMarker = null, currentProfileDrawId = null;
window.currentEditingFeature = null; window.current3DData = null;

// ==========================================
// 2. MOTEUR ALTIMÉTRIQUE (MNT)
// ==========================================
window.loadRemoteMNT = async () => {
    const select = document.getElementById('mnt-select');
    const url = select.value; if (!url) return alert("Sélectionnez un MNT.");
    try {
        const response = await fetch(url); const buffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(buffer); const image = await tiff.getImage();
        const bbox = image.getBoundingBox(); const raster = await image.readRasters();
        const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]), ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
        const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.1 }).addTo(map);
        mntStore.push({ id: Date.now(), name: select.options[select.selectedIndex].text, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2" });
        map.fitBounds(visual.getBounds()); updateMntUI();
    } catch(e) { alert("Erreur MNT"); }
};

function getZ(l93) {
    for (let m of mntStore) {
        if (!m.visible) continue;
        if (l93[0] >= m.bbox[0] && l93[0] <= m.bbox[2] && l93[1] >= m.bbox[1] && l93[1] <= m.bbox[3]) {
            const px = ((l93[0] - m.bbox[0]) / (m.bbox[2] - m.bbox[0])) * m.width, py = ((m.bbox[3] - l93[1]) / (m.bbox[3] - m.bbox[1])) * m.height;
            const x1 = Math.floor(px), y1 = Math.floor(py); const q11 = m.data[y1 * m.width + x1];
            return q11 < -500 ? null : q11;
        }
    } return null;
}

function updateMntUI() {
    const list = document.getElementById('mnt-list'); if (!list) return; list.innerHTML = '';
    mntStore.forEach(m => { list.innerHTML += `<div class="card"><b>⛰️ ${m.name}</b> <button onclick="deleteMNT(${m.id})">✕</button></div>`; });
}
window.deleteMNT = (id) => { const m = mntStore.find(x => x.id === id); map.removeLayer(m.visual); mntStore = mntStore.filter(x => x.id !== id); updateMntUI(); };

// ==========================================
// 3. OUTILS DE DESSIN ET KMZ
// ==========================================
window.startTool = (tool) => { 
    currentTool = tool; currentPoints = []; if (tempLayer) map.removeLayer(tempLayer); 
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-'+tool).classList.add('active');
    document.getElementById('btn-finish').style.display = tool === 'circle' ? 'none' : 'block';
};

map.on('click', (e) => {
    if (!currentTool) return;
    if (currentTool === 'circle') {
        if (!circleCenter) { circleCenter = e.latlng; tempLayer = L.circle(circleCenter, {radius: 0, color: '#9b59b6'}).addTo(map); }
        else { finalizeCircle(circleCenter, map.distance(circleCenter, e.latlng)); circleCenter = null; }
        return;
    }
    currentPoints.push(e.latlng); if (tempLayer) map.removeLayer(tempLayer);
    tempLayer = currentTool === 'area' ? L.polygon(currentPoints, { color: '#e67e22' }).addTo(map) : L.polyline(currentPoints, { color: '#3498db' }).addTo(map);
});

window.finalizeDraw = () => {
    const drawObj = { id: Date.now(), type: currentTool, name: "Nouveau", ptsGPS: [...currentPoints], visible: true, color: currentTool==='area'?'#e67e22':'#3498db', weight: 4, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = currentTool === 'area' ? L.polygon(currentPoints, {color: drawObj.color}).addTo(map) : L.polyline(currentPoints, {color: drawObj.color}).addTo(map);
    drawStore.push(drawObj); recalculateStats(drawObj); updateDrawUI();
    currentTool = null; currentPoints = []; if(tempLayer) map.removeLayer(tempLayer);
};

window.finalizeCircle = (center, radius) => {
    const drawObj = { id: Date.now(), type: 'circle', name: 'Cercle', center, radius, visible: true, color: '#9b59b6', weight: 3, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = L.circle(center, {radius, color: drawObj.color}).addTo(map);
    drawObj.ptsGPS = generateCirclePoints(center, radius);
    drawStore.push(drawObj); recalculateStats(drawObj); updateDrawUI(); currentTool = null;
};

function generateCirclePoints(center, radius) {
    const pts = []; const cL93 = proj4("EPSG:4326", "EPSG:2154", [center.lng, center.lat]);
    for (let i=0; i<64; i++) { 
        const a = (i*2*Math.PI)/64; const g = proj4("EPSG:2154", "EPSG:4326", [cL93[0]+radius*Math.cos(a), cL93[1]+radius*Math.sin(a)]); 
        pts.push({lat: g[1], lng: g[0]}); 
    } return pts;
}

// ==========================================
// 4. ÉDITION XYZ ET UI
// ==========================================
window.toggleEditMode = (id, isProj = false, pid = null) => {
    let d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id);
    if(!d) return; d.isEditing = !d.isEditing;
    if(!d.editGroup) d.editGroup = L.layerGroup().addTo(map);
    if(d.isEditing) { makeEditable(d, isProj, pid); if(d.type!=='circle') openPointEditor(id, isProj, pid); }
    else { d.editGroup.clearLayers(); document.getElementById('point-editor-window').style.display='none'; }
    isProj ? updateProjectUI() : updateDrawUI();
};

function makeEditable(d, isProj, pid) {
    d.editGroup.clearLayers(); const icon = L.divIcon({ className: 'edit-handle', iconSize: [12, 12] });
    d.ptsGPS.forEach((pt, idx) => {
        const m = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
        m.on('drag', (e) => {
            d.ptsGPS[idx] = e.latlng; d.layer.setLatLngs(d.ptsGPS); recalculateStats(d);
            if (window.currentEditingFeature) {
                const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
                document.getElementById(`edit-x-${idx}`).value = l93[0].toFixed(2);
                document.getElementById(`edit-y-${idx}`).value = l93[1].toFixed(2);
            }
        });
    });
}

window.openPointEditor = (id, isProj, pid) => {
    const d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id);
    window.currentEditingFeature = { d, id };
    let h = '<table style="width:100%; color:white; font-size:11px;"><tr><th>X</th><th>Y</th><th>Z Forcé</th></tr>';
    d.ptsGPS.forEach((pt, i) => {
        const l = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]);
        h += `<tr><td><input id="edit-x-${i}" value="${l[0].toFixed(2)}" oninput="applyPointEdits(false)"></td><td><input id="edit-y-${i}" value="${l[1].toFixed(2)}" oninput="applyPointEdits(false)"></td><td><input id="edit-z-${i}" value="${pt.customZ||''}" placeholder="Auto" oninput="applyPointEdits(false)"></td></tr>`;
    });
    document.getElementById('point-editor-content').innerHTML = h + '</table>';
    document.getElementById('point-editor-window').style.display = 'flex';
};

window.applyPointEdits = (close = true) => {
    const { d } = window.currentEditingFeature;
    d.ptsGPS.forEach((pt, i) => {
        const x = parseFloat(document.getElementById(`edit-x-${i}`).value), y = parseFloat(document.getElementById(`edit-y-${i}`).value), z = document.getElementById(`edit-z-${i}`).value;
        const g = proj4("EPSG:2154", "EPSG:4326", [x, y]); pt.lat = g[1]; pt.lng = g[0];
        if(z) pt.customZ = parseFloat(z); else delete pt.customZ;
    });
    d.layer.setLatLngs(d.ptsGPS); recalculateStats(d); if(close) document.getElementById('point-editor-window').style.display='none';
};

// ==========================================
// 5. VOLUMES ET VUE 3D
// ==========================================
window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id); if (mntStore.length===0) return alert("Activez un MNT");
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    l93.forEach(p => { minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
    
    let border = []; l93.forEach((p, i) => { let z = d.ptsGPS[i].customZ || getZ(p); if(z) border.push({x:p[0], y:p[1], z}); });
    
    let totalV = 0, step = 1;
    for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
            if (isPointInPolygon([x, y], l93)) {
                let zM = getZ([x, y]); if(!zM) continue;
                let zB = 0, sumW = 0; border.forEach(b => { let w = 1/((x-b.x)**2 + (y-b.y)**2); zB += b.z*w; sumW += w; });
                zB = zB/sumW; totalV += Math.abs(zM - zB);
            }
        }
    }
    alert("Volume : " + totalV.toFixed(1) + " m³");
};

function isPointInPolygon(p, vs) {
    let x=p[0], y=p[1], inside=false;
    for(let i=0, j=vs.length-1; i<vs.length; j=i++) {
        let xi=vs[i][0], yi=vs[i][1], xj=vs[j][0], yj=vs[j][1];
        if(((yi>y) != (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
    } return inside;
}

window.generate3DView = (id) => {
    const d = drawStore.find(x => x.id === id); if(!d) return;
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let border = []; l93.forEach((p, i) => { let z = d.ptsGPS[i].customZ || getZ(p); if(z) border.push({x:p[0], y:p[1], z}); });
    if(border.length === 0) return alert("Zone hors MNT.");

    document.getElementById('window-3d').style.display = 'block';
    let xV=[], yV=[], zV=[]; // Simplifié pour la performance
    for(let i=0; i<l93.length; i++) { xV.push(l93[i][0]); yV.push(l93[i][1]); zV.push(d.ptsGPS[i].customZ || getZ(l93[i])); }

    Plotly.newPlot('plot-3d', [{ x: xV, y: yV, z: zV, type: 'mesh3d', intensity: zV, colorscale: 'Viridis' }], 
    { margin: {l:0, r:0, b:0, t:0}, scene: {aspectmode:'data'} }, {displayModeBar: false});
};

// ==========================================
// 6. UI ET CHARGEMENT KMZ
// ==========================================
function updateDrawUI() {
    const list = document.getElementById('measure-list'); list.innerHTML = '';
    drawStore.forEach(d => {
        list.innerHTML += `<div class="card" style="border-left:4px solid ${d.color}">
            <b>${d.name}</b> 
            <button onclick="toggleEditMode(${d.id})">✏️ Éditer</button>
            <button onclick="generate3DView(${d.id})">👁️ 3D</button>
            <button onclick="calculateVolume(${d.id})">📊 Vol</button>
            <button onclick="deleteDraw(${d.id})">✕</button>
            <div style="font-size:10px">${d.statsHtml||''}</div>
        </div>`;
    });
}
window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); };

function recalculateStats(d) {
    const l = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    if(d.type==='line') { let dist=0; for(let i=1; i<l.length; i++) dist+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]); d.statsHtml = `L: ${dist.toFixed(1)}m`; }
    else d.statsHtml = `Surface dessinée`;
}

window.addEventListener('load', () => {
    if (typeof pistesData !== 'undefined') {
        const l = L.geoJSON(pistesData, { style: { color: '#ffffff', weight: 1, opacity: 0.5 } }).addTo(map);
        kmzStore.push({ id: 1, name: "Pistes", layer: l, visible: true, color: '#ffffff' });
        map.fitBounds(l.getBounds());
    }
    if (typeof canonData !== 'undefined') {
        const l = L.geoJSON(canonData, { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 3, color: '#3498db' }) }).addTo(map);
        kmzStore.push({ id: 2, name: "Canons", layer: l, visible: true, color: '#3498db' });
    }
    updateKmzUI();
});

// ==========================================
// 7. SAUVEGARDE GOOGLE (DÉFINITIF)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZ-m9rVPuATkiYjccicrtBSrAieSSA_TTqmYpA61SoK4eTj11qesIEpItyys6Vu2GVXQ/exec";

window.saveProject = async () => {
    const name = document.getElementById('project-name').value;
    const data = drawStore.map(d => ({ type: d.type, name: d.name, ptsGPS: d.ptsGPS, color: d.color }));
    try {
        await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ projectName: name, projectData: JSON.stringify(data) }) });
        alert("Sauvegardé !");
    } catch(e) { alert("Erreur de lien Google"); }
};

window.close3DWindow = () => { document.getElementById('window-3d').style.display = 'none'; };
