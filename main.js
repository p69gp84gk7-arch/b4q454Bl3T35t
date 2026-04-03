// ==========================================
// 1. CONFIGURATION CARTE ET L93
// ==========================================
proj4.defs("EPSG:2154","+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs");

const map = L.map('map', { doubleClickZoom: false }).setView([42.7645, 0.5833], 15);
preferCanvas: true
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
const planOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
L.control.layers({ "🌍 Satellite": satellite, "🗺️ Plan": planOSM }).addTo(map);

let mntStore = [], drawStore = [], kmzStore = [], projectStore = [];
let currentPoints = [], tempLayer = null, currentTool = null, circleCenter = null;
let chartInstance = null, cursorMarker = null, currentProfileDrawId = null;
window.currentEditingFeature = null; window.current3DData = null;

// Le point rouge qui suit votre souris
function updateCursor(lat, lng) {
    if (!cursorMarker) {
        cursorMarker = L.circleMarker([lat, lng], { radius: 7, color: '#e74c3c', fillColor: '#fff', fillOpacity: 1, weight: 3, zIndexOffset: 1000 }).addTo(map);
    } else {
        cursorMarker.setLatLng([lat, lng]);
    }
}

// ==========================================
// 2. MOTEUR ALTIMÉTRIQUE (MNT)
// ==========================================
window.loadRemoteMNT = async () => {
    const sel = document.getElementById('mnt-select'); const url = sel.value; if (!url) return alert("Sélectionnez un MNT.");
    const btn = document.querySelector('button[onclick="loadRemoteMNT()"]'); const oldText = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true;
    try {
        const res = await fetch(url); const buf = await res.arrayBuffer(); const tiff = await GeoTIFF.fromArrayBuffer(buf);
        const img = await tiff.getImage(); const bbox = img.getBoundingBox(); const raster = await img.readRasters();
        const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]), ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
        const vis = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.1 }).addTo(map);
        mntStore.push({ id: Date.now(), name: sel.options[sel.selectedIndex].text, bbox, width: img.getWidth(), height: img.getHeight(), data: raster[0], visual: vis, visible: true, color: "#00d1b2" });
        map.fitBounds(vis.getBounds()); updateMntUI();
    } catch(e) { alert("Erreur MNT"); } finally { btn.innerText = oldText; btn.disabled = false; }
};

function getZ(l93) {
    for (let m of mntStore) {
        if (!m.visible) continue;
        if (l93[0] >= m.bbox[0] && l93[0] <= m.bbox[2] && l93[1] >= m.bbox[1] && l93[1] <= m.bbox[3]) {
            const px = ((l93[0] - m.bbox[0]) / (m.bbox[2] - m.bbox[0])) * m.width, py = ((m.bbox[3] - l93[1]) / (m.bbox[3] - m.bbox[1])) * m.height;
            const x1 = Math.floor(px), y1 = Math.floor(py); const q = m.data[y1 * m.width + x1]; return q < -500 ? null : q;
        }
    } return null;
}

function updateMntUI() {
    const list = document.getElementById('mnt-list'); if (!list) return; list.innerHTML = '';
    mntStore.forEach(m => { list.innerHTML += `<div class="card"><div class="card-header"><div><input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMNT(${m.id})"> <b>⛰️ ${m.name}</b></div><button type="button" class="btn-del" onclick="deleteMNT(${m.id})">✕</button></div></div>`; });
}
window.toggleMNT = (id) => { const m = mntStore.find(x => x.id === id); m.visible = !m.visible; if (m.visible) m.visual.addTo(map); else map.removeLayer(m.visual); };
window.deleteMNT = (id) => { const m = mntStore.find(x => x.id === id); map.removeLayer(m.visual); mntStore = mntStore.filter(x => x.id !== id); updateMntUI(); };

// ==========================================
// 3. CHARGEMENT DES KMZ (STATIC)
// ==========================================
window.addEventListener('load', () => {
    try {
        if (typeof pistesData !== 'undefined' && pistesData.features) {
            const l = L.geoJSON(pistesData, { style: { color: '#ffffff', weight: 2, opacity: 0.8, dashArray: '5, 5' } }).addTo(map);
            kmzStore.push({ id: "pistes", name: "Pistes de ski", layer: l, visible: true, color: '#ffffff' });
            if (mntStore.length === 0) map.fitBounds(l.getBounds());
        }
        if (typeof canonData !== 'undefined' && canonData.features) {
            const c = L.geoJSON(canonData, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, fillColor: '#3498db', color: '#fff', weight: 1, fillOpacity: 0.9 }) }).addTo(map);
            kmzStore.push({ id: "canons", name: "Canons à neige", layer: c, visible: true, color: '#3498db' });
        }
        updateKmzUI();
    } catch (e) { console.error(e); }
});

function updateKmzUI() {
    const list = document.getElementById('kmz-list'); if (!list) return; list.innerHTML = '';
    kmzStore.forEach(k => { list.innerHTML += `<div class="card" style="border-left: 4px solid ${k.color};"><div class="card-header"><div><input type="checkbox" ${k.visible ? 'checked' : ''} onchange="toggleKMZ('${k.id}')"> <b>${k.name}</b></div></div></div>`; });
}
window.toggleKMZ = (id) => { const k = kmzStore.find(x => x.id === id); if (!k) return; k.visible = !k.visible; if (k.visible) k.layer.addTo(map); else map.removeLayer(k.layer); updateKmzUI(); };

// ==========================================
// 4. OUTILS DE DESSIN
// ==========================================
window.startTool = (tool) => { 
    currentTool = tool; currentPoints = []; circleCenter = null;
    if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); 
    document.getElementById('btn-'+tool).classList.add('active');
    document.getElementById('btn-finish').style.display = tool === 'circle' ? 'none' : 'block';
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
    if (currentPoints.length < 2) return;
    const type = currentTool; const color = type==='area' ? '#e67e22' : '#3498db';
    const drawObj = { id: Date.now(), type, name: type==='area' ? 'Surface' : 'Tracé', ptsGPS: [...currentPoints], visible: true, color, weight: 4, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = type === 'area' ? L.polygon(currentPoints, {color, weight: 3, fillOpacity: 0.3}).addTo(map) : L.polyline(currentPoints, {color, weight: 4}).addTo(map);
    drawStore.unshift(drawObj); recalculateStats(drawObj); updateDrawUI();
    if(type === 'line') generateProfile(drawObj);
    currentTool = null; currentPoints = []; if(tempLayer) map.removeLayer(tempLayer);
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); document.getElementById('btn-finish').style.display = 'none';
};

window.finalizeCircle = (center, radius) => {
    const drawObj = { id: Date.now(), type: 'circle', name: 'Cercle', center, radius, visible: true, color: '#9b59b6', weight: 3, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = L.circle(center, {radius, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map);
    const pts = []; const cL93 = proj4("EPSG:4326", "EPSG:2154", [center.lng, center.lat]);
    for (let i=0; i<64; i++) { const a = (i*2*Math.PI)/64; const g = proj4("EPSG:2154", "EPSG:4326", [cL93[0]+radius*Math.cos(a), cL93[1]+radius*Math.sin(a)]); pts.push({lat: g[1], lng: g[0]}); }
    drawObj.ptsGPS = pts; drawStore.unshift(drawObj); recalculateStats(drawObj); updateDrawUI(); currentTool = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
};

// ==========================================
// 5. STATS, ÉDITION INTÉGRÉE & CUMULS DANS L'ÉTIQUETTE
// ==========================================
function recalculateStats(d) {
    if (!d) return;
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let h = "";
    
    // NOUVEAU : Calcul Zmin et Zmax pour TOUS les tracés
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < l93.length; i++) {
        let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(l93[i]);
        if (z !== null) {
            if (z < zMin) zMin = z;
            if (z > zMax) zMax = z;
        }
    }
    
    let extraStats = "";
    if (zMin !== Infinity && zMax !== -Infinity) {
        // Z au cm près (.toFixed(2))
        extraStats = `<br>Zmin: <b>${zMin.toFixed(2)} m</b> | Zmax: <b>${zMax.toFixed(2)} m</b> | ΔZ: <b>${(zMax-zMin).toFixed(2)} m</b>`;
    }

    if (d.type === 'circle') {
        const area = Math.PI * d.radius * d.radius; const perim = 2 * Math.PI * d.radius;
        h = `Rayon: <b>${d.radius.toFixed(2)} m</b> | Diam: <b>${(2*d.radius).toFixed(2)} m</b><br>Périmètre: <b>${perim.toFixed(2)} m</b> | Surface: <b>${area.toFixed(2)} m²</b>${extraStats}`;
    } else if (d.type === 'line') {
        let dist = 0; for (let i = 1; i < l93.length; i++) dist += Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        const z1 = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0])||0); 
        const z2 = d.ptsGPS[l93.length-1].customZ !== undefined ? d.ptsGPS[l93.length-1].customZ : (getZ(l93[l93.length-1])||0); 
        const dz = Math.abs(z2 - z1); const pente = dist > 0 ? (dz / dist * 100) : 0;
        h = `Longueur: <b>${dist.toFixed(2)} m</b> | Dénivelé: <b>${dz.toFixed(2)} m</b><br>Pente moy: <b>${pente.toFixed(2)} %</b>${extraStats}`;
    } else {
        let area = 0; let perim = 0;
        for (let i = 0; i < l93.length; i++) { 
            let j = (i+1) % l93.length; 
            area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; 
            perim += Math.hypot(l93[j][0] - l93[i][0], l93[j][1] - l93[i][1]);
        }
        h = `Périmètre: <b>${perim.toFixed(2)} m</b><br>Surface au sol: <b>${(Math.abs(area)/2).toFixed(2)} m²</b>${extraStats}`;
    }

    if (d.volumeHtml && d.volumeHtml !== "") {
        h += `<div style="margin-top:5px; padding-top:5px; border-top:1px dashed #555;">
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;">
                    <b style="color:#f1c40f;">Mesures Volumes :</b>
                    <button type="button" onclick="clearVolumes(${d.id})" style="background:none; border:none; color:#e74c3c; cursor:pointer;" title="Effacer l'historique">🗑️</button>
                </div>
                ${d.volumeHtml}
              </div>`;
    }
    
    d.statsHtml = h; 
    const stD = document.getElementById(`stats-${d.id}`); if (stD) stD.innerHTML = h;
    const stG = document.getElementById(`stats-proj-${d.id}`); if (stG) stG.innerHTML = h;
}

window.clearVolumes = (id) => { let d = drawStore.find(x=>x.id===id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id); if(d) { d.volumeHtml = ""; recalculateStats(d); } };

window.toggleEditMode = (id, isProj = false, pid = null) => {
    let d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id); if(!d) return; 
    d.isEditing = !d.isEditing; if(!d.editGroup) d.editGroup = L.layerGroup().addTo(map);
    if(d.isEditing) { makeEditable(d, isProj, pid); } else { d.editGroup.clearLayers(); window.currentEditingFeature = null; }
    isProj ? updateProjectUI() : updateDrawUI();
};

function makeEditable(d, isProj, pid) {
    d.editGroup.clearLayers(); if (d.type === 'circle') return; // On n'édite pas les 64 points d'un cercle à la main
    window.currentEditingFeature = { d, isProj, pid };
    d.ptsGPS.forEach((pt, idx) => {
        const icon = L.divIcon({ className: 'numbered-handle', html: `<div style="background:#e74c3c; color:white; border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; font-size:11px; font-weight:bold; border:2px solid white; box-shadow:0 0 3px rgba(0,0,0,0.5);">${idx + 1}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
        const m = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
        
        m.on('drag', (e) => {
            d.ptsGPS[idx].lat = e.latlng.lat; d.ptsGPS[idx].lng = e.latlng.lng; d.layer.setLatLngs(d.ptsGPS); 
            let distMsg = "";
            if (idx > 0) distMsg += `← ${map.distance(d.ptsGPS[idx-1], e.latlng).toFixed(2)}m `;
            if (idx < d.ptsGPS.length - 1) distMsg += `→ ${map.distance(e.latlng, d.ptsGPS[idx+1]).toFixed(2)}m`;
            if (d.type === 'area' && (idx === 0 || idx === d.ptsGPS.length - 1)) { distMsg += ` (Ferm.: ${map.distance(d.ptsGPS[0], d.ptsGPS[d.ptsGPS.length-1]).toFixed(2)}m)`; }
            if (distMsg !== "") m.bindTooltip(distMsg, {permanent: true, direction: 'top', offset: [0, -10]}).openTooltip();

            recalculateStats(d); if(d.type==='line') generateProfile(d);
            
            const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
            const elX = document.getElementById(`edit-x-${d.id}-${idx}`); if(elX) elX.value = l93[0].toFixed(2);
            const elY = document.getElementById(`edit-y-${d.id}-${idx}`); if(elY) elY.value = l93[1].toFixed(2);
            const elZ = document.getElementById(`edit-z-${d.id}-${idx}`);
            if(elZ && d.ptsGPS[idx].customZ === undefined) { const z = getZ(l93); if(z!==null) elZ.placeholder = z.toFixed(2); }
        });
        m.on('dragend', () => { m.unbindTooltip(); });
    });
}

window.applyPointEdits = (id, isProj = false, pid = null) => {
    let d = isProj ? window.currentEditingFeature.d : drawStore.find(x=>x.id===id); if(!d) return;
    d.ptsGPS.forEach((pt, i) => {
        const x = parseFloat(document.getElementById(`edit-x-${id}-${i}`).value), y = parseFloat(document.getElementById(`edit-y-${id}-${i}`).value), z = document.getElementById(`edit-z-${id}-${i}`).value;
        if(!isNaN(x) && !isNaN(y)) { const g = proj4("EPSG:2154", "EPSG:4326", [x, y]); pt.lat = g[1]; pt.lng = g[0]; }
        if(z.trim() !== '') pt.customZ = parseFloat(z); else delete pt.customZ;
    });
    if(d.type !== 'circle') d.layer.setLatLngs(d.ptsGPS);
    recalculateStats(d); if(d.isEditing) makeEditable(d, isProj, pid); if(d.type==='line') generateProfile(d);
};

function generateEditorTable(d, isProj, pid=null) {
    if(!d.isEditing || d.type === 'circle') return '';
    let html = `<div style="background:#111; padding:5px; margin-top:5px; border-radius:3px; font-size:11px;">
        <table style="width:100%; color:white; text-align:center;"><tr><th>Pt</th><th>X</th><th>Y</th><th>Z Forcé</th></tr>`;
    d.ptsGPS.forEach((pt, i) => {
        const l = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]);
        let zAct = pt.customZ !== undefined ? pt.customZ : getZ(l);
        let zVal = pt.customZ !== undefined ? pt.customZ.toFixed(2) : '';
        let zPlc = zAct !== null ? zAct.toFixed(2) : 'Auto';
        html += `<tr>
            <td style="color:#e74c3c; font-weight:bold;">${i+1}</td>
            <td><input id="edit-x-${d.id}-${i}" value="${l[0].toFixed(2)}" oninput="applyPointEdits(${d.id}, ${isProj}, ${pid})" style="width:65px; background:#222; color:#fff; border:1px solid #555; text-align:center;"></td>
            <td><input id="edit-y-${d.id}-${i}" value="${l[1].toFixed(2)}" oninput="applyPointEdits(${d.id}, ${isProj}, ${pid})" style="width:65px; background:#222; color:#fff; border:1px solid #555; text-align:center;"></td>
            <td><input id="edit-z-${d.id}-${i}" value="${zVal}" placeholder="${zPlc}" onchange="applyPointEdits(${d.id}, ${isProj}, ${pid})" style="width:45px; background:#222; color:#fff; border:1px solid #555; text-align:center;"></td>
        </tr>`;
    });
    return html + `</table></div>`;
}

function updateDrawUI() {
    const list = document.getElementById('measure-list'); if(!list) return; list.innerHTML = '';
    
    list.innerHTML = `<button type="button" onclick="showMulti3DSelector()" style="width:100%; margin-bottom:10px; background:#8e44ad; color:#fff; border:none; padding:8px; cursor:pointer; font-weight:bold; border-radius:3px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">👁️ Comparer surfaces en 3D</button>`;
    
    drawStore.forEach(d => {
        let btns = d.type === 'line' ? 
            `<button type="button" onclick="generateProfileById(${d.id})" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #555; padding:5px; cursor:pointer; font-weight:bold; border-radius:3px;">📈 Afficher le profil altimétrique</button>` : 
            `<div style="display:flex; gap:3px; margin-top:5px; flex-wrap:wrap;">
                <button type="button" onclick="calculateVolume(${d.id}, 'hollow')" style="flex:1; font-size:0.75em; background:#3498db; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📉 Déblai</button>
                <button type="button" onclick="calculateVolume(${d.id}, 'mound')" style="flex:1; font-size:0.75em; background:#e67e22; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📈 Remblai</button>
                <button type="button" onclick="calculateVolume(${d.id}, 'slope')" style="flex:1; font-size:0.75em; background:#9b59b6; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📐 Courbe</button>
                <button type="button" onclick="calculateVolume(${d.id}, 'plane')" style="flex:1; font-size:0.75em; background:#1abc9c; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📏 Plan</button>
                <button type="button" onclick="generate3DView(${d.id})" style="flex:1; min-width:100%; font-size:0.8em; font-weight:bold; background:#34495e; color:#fff; border:1px solid #555; cursor:pointer; padding:5px; margin-top:2px; border-radius:3px;">👁️ Lancer Vue 3D</button>
            </div>`;
        
        list.innerHTML += `<div class="card" style="border-left:4px solid ${d.color}; margin-bottom:8px;">
            <div class="card-header">
                <div style="display:flex; align-items:center;">
                    <input type="checkbox" ${d.visible?'checked':''} onchange="toggleDraw(${d.id})"> 
                    <input type="color" class="color-picker" value="${d.color}" onchange="changeColor(${d.id}, this.value)"> 
                    <strong style="cursor:pointer; font-size:1.1em;" onclick="renameDraw(${d.id})">${d.name}</strong>
                </div>
                <button type="button" class="btn-del" onclick="deleteDraw(${d.id})">✕</button>
            </div>
            <div id="stats-${d.id}" style="font-size:12px; margin:5px 0; color:#eee; background:#222; padding:6px; border-radius:3px;">${d.statsHtml || ''}</div>
            <button type="button" onclick="toggleEditMode(${d.id})" style="width:100%; background:${d.isEditing?'#27ae60':'#7f8c8d'}; color:#fff; border:none; padding:5px; cursor:pointer; border-radius:3px; font-weight:bold; display:${d.type==='circle'?'none':'block'}">
                ${d.isEditing ? '✅ Fin édition' : '✏️ Éditer les points'}
            </button>
            ${generateEditorTable(d, false)}
            ${btns}
        </div>`;
    });
}

window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); if(d.editGroup) map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); };
window.renameDraw = (id) => { const d = drawStore.find(x => x.id === id); const n = prompt("Nom :", d.name); if(n){d.name=n; updateDrawUI();} };
window.toggleDraw = (id) => { const d = drawStore.find(x => x.id === id); d.visible = !d.visible; if(d.visible) { d.layer.addTo(map); if(d.isEditing) makeEditable(d); } else { map.removeLayer(d.layer); if(d.editGroup) d.editGroup.clearLayers(); } };
window.changeColor = (id, color) => { const d = drawStore.find(x => x.id === id); d.color = color; d.layer.setStyle({color}); updateDrawUI(); };

// ==========================================
// 6. GÉOMÉTRIE AVANCÉE ET CALCULS DE VOLUMES
// ==========================================

function isPointInPolygon(point, vs) {
    let x = point[0], y = point[1], inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1], xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- MOTEUR ABSOLU : TRIANGULATION DE DELAUNAY (TIN) ---
window.TriangulateDelaunay = (pts, polygonL93) => {
    let n = pts.length; if(n < 3) return [];
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    pts.forEach(p=>{ minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y); });
    
    let dx = maxX - minX, dy = maxY - minY, dmax = Math.max(dx, dy);
    let midx = (minX + maxX)/2, midy = (minY + maxY)/2;
    
    // Super-triangle englobant
    let p1 = {x: midx - 20*dmax, y: midy - dmax, z:0, id:-1};
    let p2 = {x: midx, y: midy + 20*dmax, z:0, id:-2};
    let p3 = {x: midx + 20*dmax, y: midy - dmax, z:0, id:-3};
    let tris = [ [p1, p2, p3] ];

    // Algorithme Bowyer-Watson
    for(let i=0; i<n; i++) {
        let pt = pts[i]; pt.id = i;
        let badTris = [];
        for(let tri of tris) {
            let A=tri[0], B=tri[1], C=tri[2];
            let D = 2 * (A.x*(B.y - C.y) + B.x*(C.y - A.y) + C.x*(A.y - B.y));
            let ux = ((A.x*A.x + A.y*A.y)*(B.y - C.y) + (B.x*B.x + B.y*B.y)*(C.y - A.y) + (C.x*C.x + C.y*C.y)*(A.y - B.y)) / D;
            let uy = ((A.x*A.x + A.y*A.y)*(C.x - B.x) + (B.x*B.x + B.y*B.y)*(A.x - C.x) + (C.x*C.x + C.y*C.y)*(B.x - A.x)) / D;
            let r2 = (A.x - ux)*(A.x - ux) + (A.y - uy)*(A.y - uy);
            let dist2 = (pt.x - ux)*(pt.x - ux) + (pt.y - uy)*(pt.y - uy);
            if (dist2 <= r2 + 1e-5) badTris.push(tri);
        }
        let polygonEdges = [];
        for(let tri of badTris) {
            let edges = [ [tri[0], tri[1]], [tri[1], tri[2]], [tri[2], tri[0]] ];
            for(let edge of edges) {
                let shared = false;
                for(let otherTri of badTris) {
                    if (tri === otherTri) continue;
                    let oEdges = [ [otherTri[0], otherTri[1]], [otherTri[1], otherTri[2]], [otherTri[2], otherTri[0]] ];
                    for(let oEdge of oEdges) {
                        if ((edge[0].id===oEdge[0].id && edge[1].id===oEdge[1].id) || (edge[0].id===oEdge[1].id && edge[1].id===oEdge[0].id)) { shared = true; break; }
                    }
                    if (shared) break;
                }
                if (!shared) polygonEdges.push(edge);
            }
        }
        tris = tris.filter(t => !badTris.includes(t));
        for(let edge of polygonEdges) tris.push([edge[0], edge[1], pt]);
    }

    // Nettoyage et filtrage strict à l'intérieur du polygone
    let finalTris = [];
    for(let tri of tris) {
        if (tri[0].id < 0 || tri[1].id < 0 || tri[2].id < 0) continue;
        let cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
        let cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
        if (isPointInPolygon([cx, cy], polygonL93)) finalTris.push(tri);
    }
    return finalTris;
};

window.IsPointInTri = (px, py, ax, ay, bx, by, cx, cy) => {
    let v0x = cx - ax, v0y = cy - ay, v1x = bx - ax, v1y = by - ay, v2x = px - ax, v2y = py - ay;
    let d00 = v0x * v0x + v0y * v0y, d01 = v0x * v1x + v0y * v1y, d02 = v0x * v2x + v0y * v2y;
    let d11 = v1x * v1x + v1y * v1y, d12 = v1x * v2x + v1y * v2y;
    let inv = 1 / (d00 * d11 - d01 * d01);
    let u = (d11 * d02 - d01 * d12) * inv, v = (d00 * d12 - d01 * d02) * inv;
    return (u >= -0.05) && (v >= -0.05) && (u + v <= 1.05); // Tolérance pour les bords
};

window.GetZOnTriangle = (x, y, A, B, C) => {
    let Nx = (B.y - A.y) * (C.z - A.z) - (B.z - A.z) * (C.y - A.y);
    let Ny = (B.z - A.z) * (C.x - A.x) - (B.x - A.x) * (C.z - A.z);
    let Nz = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
    if (Math.abs(Nz) < 1e-9) return Math.max(A.z, B.z, C.z);
    return A.z - (Nx * (x - A.x) + Ny * (y - A.y)) / Nz;
};

// Courbe lissée IDW classique
window.GetSmoothZ = (x, y, borderPts) => {
    let sumZ = 0, sumW = 0;
    for (let pt of borderPts) {
        let d2 = (x - pt.x)**2 + (y - pt.y)**2;
        if (d2 < 0.01) return pt.z;
        let w = 1 / (d2 + 1.0); 
        sumZ += pt.z * w; sumW += w;
    }
    return sumW === 0 ? (borderPts[0]?.z || 0) : sumZ / sumW;
};

window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id); 
    if (!d) return;
    if (mntStore.filter(m=>m.visible).length === 0) return alert("Veuillez activer un MNT dans la liste à gauche.");
    
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    l93.forEach(p => { minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
    
    let border = []; 
    l93.forEach((p, i) => { let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(p); if(z !== null) border.push({x:p[0], y:p[1], z}); });
    
    if((type==='slope'||type==='plane') && border.length < 3) return alert("Pas assez de points pour calculer ce type de plan.");

    let refZ = 0;
    if(type==='hollow'||type==='mound') {
        let sZ = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : getZ(l93[0]);
        let pr = prompt("Altitude de référence (m) ?", sZ ? Math.round(sZ) : 0); 
        if(!pr) return; refZ = parseFloat(pr.replace(',', '.')); if (isNaN(refZ)) return;
    }

    setTimeout(() => {
        let tTas = 0, tCreux = 0, step = 1;
        let triangles = [];
        if (type === 'plane') triangles = window.TriangulateDelaunay(border, l93);

        minX -= step; maxX += step; minY -= step; maxY += step;

        for (let x = minX; x <= maxX; x += step) {
            for (let y = minY; y <= maxY; y += step) {
                if (isPointInPolygon([x, y], l93)) {
                    let zM = getZ([x, y]); if(zM === null) continue;
                    let zB = null;
                    
                    if (type==='plane') {
                        let bestDist = Infinity; let bestTri = null;
                        for(let tri of triangles) {
                            if (window.IsPointInTri(x, y, tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y)) {
                                zB = window.GetZOnTriangle(x, y, tri[0], tri[1], tri[2]); break;
                            }
                            let cx=(tri[0].x+tri[1].x+tri[2].x)/3, cy=(tri[0].y+tri[1].y+tri[2].y)/3;
                            let d2=(x-cx)**2+(y-cy)**2;
                            if(d2 < bestDist) { bestDist = d2; bestTri = tri; }
                        }
                        if (zB === null && bestTri) zB = window.GetZOnTriangle(x, y, bestTri[0], bestTri[1], bestTri[2]);
                    } 
                    else if (type==='slope') zB = window.GetSmoothZ(x, y, border);
                    else zB = refZ;
                    
                    if(zB !== null) {
                        if(zM > zB) tTas += (zM - zB); else if(zM < zB) tCreux += (zB - zM);
                    }
                }
            }
        }
        
        let color = '#fff', lbl = ''; let resTxt = '';
        if(type === 'hollow') { color = '#3498db'; lbl = `Déblai (${refZ.toFixed(2)}m)`; resTxt = `${tCreux.toFixed(2)} m³`; }
        if(type === 'mound') { color = '#e67e22'; lbl = `Remblai (${refZ.toFixed(2)}m)`; resTxt = `${tTas.toFixed(2)} m³`; }
        if(type === 'slope') { color = '#9b59b6'; lbl = `Vol. Courbe (Lissé)`; resTxt = `📉 ${tCreux.toFixed(2)}m³ | 📈 ${tTas.toFixed(2)}m³`; }
        if(type === 'plane') { color = '#1abc9c'; lbl = `Vol. Plan (Delaunay)`; resTxt = `📉 ${tCreux.toFixed(2)}m³ | 📈 ${tTas.toFixed(2)}m³`; }

        if (!d.volumeHtml) d.volumeHtml = "";
        d.volumeHtml += `<div style="font-size:12px; margin-top:4px; background:#1a1a1a; padding:4px; border-radius:3px; border-left:3px solid ${color};"><b style="color:${color};">${lbl} :</b> ${resTxt}</div>`;
        recalculateStats(d);
    }, 50);
};
// ==========================================
// 7. VUE 3D PARFAITE (DELAUNAY SANS FAILLES)
// ==========================================

window.close3DWindow = () => {
    document.getElementById('window-3d').style.display = 'none';
    if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; }
};

window.open3DInNewTab = () => {
    const plotDiv = document.getElementById('plot-3d');
    const controlsDiv = document.getElementById('custom-3d-controls');
    if (!plotDiv || !plotDiv.data) return alert("Veuillez d'abord générer une vue 3D.");
    
    const newTab = window.open('', '_blank');
    
    // On copie le HTML du panneau de contrôle, mais on redirige les clics vers 'plot-fullscreen' au lieu de 'plot-3d'
    let controlsHtml = controlsDiv ? controlsDiv.innerHTML.replace(/'plot-3d'/g, "'plot-fullscreen'") : '';
    
    newTab.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <title>Vue 3D - Plein Écran</title>
            <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
            <style>
                body { margin: 0; padding: 0; background-color: #222; overflow: hidden; color: white; font-family: sans-serif; } 
                #plot-fullscreen { width: 100vw; height: 100vh; } 
                #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5em; }
                #custom-3d-controls { position:absolute; top:20px; left:20px; z-index:1000; background:rgba(20,20,20,0.85); padding:12px; border:1px solid #555; border-radius:5px; font-size:13px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); backdrop-filter: blur(3px); max-height:80%; overflow-y:auto; }
            </style>
        </head>
        <body>
            <div id="loading">Transfert de la 3D en cours... ⏳</div>
            <div id="custom-3d-controls">${controlsHtml}</div>
            <div id="plot-fullscreen"></div>
            <script>
                window.onload = () => { 
                    const parentPlot = window.opener.document.getElementById('plot-3d'); 
                    if (parentPlot && parentPlot.data) { 
                        const data = JSON.parse(JSON.stringify(parentPlot.data)); 
                        const layout = JSON.parse(JSON.stringify(parentPlot.layout)); 
                        layout.margin = { l: 0, r: 0, b: 0, t: 0 }; 
                        if (layout.updatemenus) delete layout.updatemenus; 
                        document.getElementById('loading').style.display = 'none'; 
                        Plotly.newPlot('plot-fullscreen', data, layout); 
                    } else { 
                        document.getElementById('loading').innerText = "Erreur."; 
                    } 
                };
            </script>
        </body>
        </html>
    `);
    newTab.document.close();
    window.close3DWindow();
};

function setup3DControlPanel(htmlContent) {
    let panel = document.getElementById('custom-3d-controls');
    if (!panel) {
        panel = document.createElement('div'); panel.id = 'custom-3d-controls';
        panel.style.cssText = 'position:absolute; top:55px; left:15px; z-index:1000; background:rgba(20,20,20,0.85); padding:12px; border:1px solid #555; border-radius:5px; color:white; font-size:13px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); backdrop-filter: blur(3px); max-height:80%; overflow-y:auto;';
        document.getElementById('window-3d').appendChild(panel);
    }
    panel.innerHTML = htmlContent;
}

const colorScalesPool = [ {p: 'Blues', c: 'Greens'}, {p: 'Reds', c: 'Oranges'}, {p: 'Purples', c: 'YlOrRd'}, {p: 'Cividis', c: 'Magenta'}, {p: 'Electric', c: 'Mint'}, {p: 'Hot', c: 'YlGnBu'} ];

window.generate3DView = (id) => {
    const d = drawStore.find(x => x.id === id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id);
    if (!d || (d.type !== 'area' && d.type !== 'circle')) return;
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");

    document.getElementById('window-3d').style.display = 'block';
    document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Génération 3D (TIN Exact)... ⏳</h3>';

    setTimeout(() => {
        const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        l93Pts.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });

        let borderPtsWithZ = [];
        l93Pts.forEach((p, i) => { let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); });

        // La magie Delaunay opère !
        let triangles = window.TriangulateDelaunay(borderPtsWithZ, l93Pts);

        let step = 0.25; 
        if ((maxX - minX) / step > 600) step = (maxX - minX) / 600;
        if ((maxY - minY) / step > 600) step = (maxY - minY) / 600;
        
        minX -= step * 2; maxX += step * 2; minY -= step * 2; maxY += step * 2;

        let xVals = [], yVals = [], zTerrain = [], zRefPlan = [], zRefCourbe = [];
        for (let x = minX; x <= maxX; x += step) xVals.push(x - minX);

        for (let y = minY; y <= maxY; y += step) {
            yVals.push(y - minY);
            let rowTerrain = [], rowPlan = [], rowCourbe = [];
            for (let x = minX; x <= maxX; x += step) {
                if (isPointInPolygon([x, y], l93Pts)) {
                    let zMNT = getZ([x, y]); rowTerrain.push(zMNT !== null ? zMNT : null);
                    
                    let zP = null; let bestDist = Infinity; let bestTri = null;
                    for(let tri of triangles) {
                        if (window.IsPointInTri(x, y, tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y)) {
                            zP = window.GetZOnTriangle(x, y, tri[0], tri[1], tri[2]); break;
                        }
                        let cx=(tri[0].x+tri[1].x+tri[2].x)/3, cy=(tri[0].y+tri[1].y+tri[2].y)/3;
                        let d2=(x-cx)**2+(y-cy)**2;
                        if(d2 < bestDist) { bestDist = d2; bestTri = tri; }
                    }
                    // Si on touche exactement le bord, le pixel attrape la facette adjacente la plus proche
                    if (zP === null && bestTri) zP = window.GetZOnTriangle(x, y, bestTri[0], bestTri[1], bestTri[2]);
                    
                    rowPlan.push(zP);
                    rowCourbe.push(window.GetSmoothZ(x, y, borderPtsWithZ));
                } else { rowTerrain.push(null); rowPlan.push(null); rowCourbe.push(null); }
            }
            zTerrain.push(rowTerrain); zRefPlan.push(rowPlan); zRefCourbe.push(rowCourbe);
        }

        let xBound = [], yBound = [], zBound = [];
        borderPtsWithZ.forEach(pt => { xBound.push(pt.x - minX); yBound.push(pt.y - minY); zBound.push(pt.z); });
        if (borderPtsWithZ.length > 0) { xBound.push(borderPtsWithZ[0].x - minX); yBound.push(borderPtsWithZ[0].y - minY); zBound.push(borderPtsWithZ[0].z); }

        let hoverTemp = 'X: %{x:.2f} m<br>Y: %{y:.2f} m<br>Z: %{z:.2f} m<extra></extra>';

        const traceTerrain = { z: zTerrain, x: xVals, y: yVals, type: 'surface', name: 'Terrain', colorscale: 'Earth', showscale: false, hovertemplate: hoverTemp };
        const tracePlan = { z: zRefPlan, x: xVals, y: yVals, type: 'surface', name: 'Base Plan (TIN)', colorscale: 'Blues', showscale: false, opacity: 0.6, hovertemplate: hoverTemp, visible: false };
        const traceCourbe = { z: zRefCourbe, x: xVals, y: yVals, type: 'surface', name: 'Base Courbe', colorscale: 'Greens', showscale: false, opacity: 0.6, hovertemplate: hoverTemp, visible: false };
        const traceContour = { x: xBound, y: yBound, z: zBound, mode: 'lines', line: { color: 'red', width: 6 }, type: 'scatter3d', name: 'Contour', hovertemplate: hoverTemp };

        const layout = { margin: { l: 0, r: 0, b: 0, t: 0 }, scene: { aspectmode: 'data', xaxis: { title: 'X (m)', backgroundcolor: '#222' }, yaxis: { title: 'Y (m)', backgroundcolor: '#222' }, zaxis: { title: 'Z (m)', backgroundcolor: '#222' } }, paper_bgcolor: '#222', font: { color: 'white' }, hovermode: 'closest' };
        
        Plotly.newPlot('plot-3d', [traceTerrain, tracePlan, traceCourbe, traceContour], layout).then(() => {
            const plotDiv = document.getElementById('plot-3d');
            setup3DControlPanel(`
                <b style="color:#f1c40f; display:block; margin-bottom:8px; font-size:14px;">🎛️ Affichage des Calques</b>
                <label style="display:block; margin-bottom:5px; cursor:pointer;"><input type="checkbox" checked onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [0])"> 🌍 Terrain Naturel</label>
                <label style="display:block; margin-bottom:5px; cursor:pointer;"><input type="checkbox" onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [1])"> 🟦 Base Plan (TIN)</label>
                <label style="display:block; margin-bottom:5px; cursor:pointer;"><input type="checkbox" onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [2])"> 🟩 Base Courbe</label>
                <label style="display:block; margin-bottom:5px; cursor:pointer;"><input type="checkbox" checked onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [3])"> 🟥 Contour Strict</label>
            `);

            plotDiv.on('plotly_hover', (data) => {
                if (data.points.length > 0) {
                    const pt = data.points[0]; const gps = proj4("EPSG:2154", "EPSG:4326", [pt.x + minX, pt.y + minY]);
                    if (!cursorMarker) cursorMarker = L.circleMarker([gps[1], gps[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
                    else cursorMarker.setLatLng([gps[1], gps[0]]);
                }
            });
            plotDiv.addEventListener('mouseleave', () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } });
        });
    }, 100);
};

window.multi3DAreas = [];

window.showMulti3DSelector = () => {
    window.multi3DAreas = [];
    drawStore.forEach(d => { if(d.type==='area' || d.type==='circle') window.multi3DAreas.push({ name: d.name, ref: d }); });
    projectStore.forEach(p => p.features.forEach(f => { if(f.type==='area' || f.type==='circle') window.multi3DAreas.push({ name: `${p.name} - ${f.name}`, ref: f }); }));

    if (window.multi3DAreas.length < 2) return alert("Il vous faut au moins 2 surfaces tracées/chargées pour faire une comparaison.");

    let html = `<div id="multi-3d-modal" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:#222; padding:20px; border:1px solid #555; z-index:10000; border-radius:5px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); color:white; min-width:300px; max-width:90%;">
        <h3 style="margin-top:0;">Superposition de surfaces</h3>
        <p style="font-size:0.9em; color:#aaa;">Cochez les surfaces à superposer en 3D :</p>
        <div style="max-height:300px; overflow-y:auto; margin-bottom:15px; background:#111; padding:10px; border-radius:3px;">`;

    window.multi3DAreas.forEach((a, idx) => { html += `<div style="margin-bottom:5px;"><input type="checkbox" class="multi-3d-checkbox" value="${idx}" id="cb-idx-${idx}"> <label for="cb-idx-${idx}" style="cursor:pointer;">${a.name}</label></div>`; });

    html += `</div><div style="display:flex; justify-content:space-between;"><button onclick="document.body.removeChild(document.getElementById('multi-3d-modal'))" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:3px; cursor:pointer;">Annuler</button><button onclick="launchSelectedMulti3D()" style="background:#27ae60; color:white; border:none; padding:6px 12px; border-radius:3px; font-weight:bold; cursor:pointer;">🚀 Lancer la 3D</button></div></div>`;
    const div = document.createElement('div'); div.innerHTML = html; document.body.appendChild(div.firstElementChild);
};

window.launchSelectedMulti3D = () => {
    const checkboxes = document.querySelectorAll('.multi-3d-checkbox:checked');
    if (checkboxes.length < 2) return alert("Veuillez cocher au moins 2 surfaces.");
    let chosenFeatures = []; checkboxes.forEach(cb => {chosenFeatures.push(window.multi3DAreas[parseInt(cb.value)].ref);});
    document.body.removeChild(document.getElementById('multi-3d-modal')); generateMulti3DViewAdaptive(chosenFeatures); 
};

window.generateMulti3DViewAdaptive = (featuresToPlot) => {
    if (mntStore.filter(m => m.visible).length === 0) return alert("Activez un MNT !");
    const numFeatures = featuresToPlot.length;
    document.getElementById('window-3d').style.display = 'block'; document.getElementById('plot-3d').innerHTML = `<h3 style="color:white; text-align:center; margin-top:20%;">Calcul Adaptive de ${numFeatures} surfaces en cours... ⏳</h3>`;

    setTimeout(() => {
        let globalMinX = Infinity, globalMinY = Infinity;
        featuresToPlot.forEach(d => { d.ptsGPS.forEach(p => { const l93 = proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]); if (l93[0] < globalMinX) globalMinX = l93[0]; if (l93[1] < globalMinY) globalMinY = l93[1]; }); });

        let allTraces = [];
        featuresToPlot.forEach((d, index) => {
            const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            l93Pts.forEach(p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; });

            let borderPtsWithZ = []; l93Pts.forEach((p, i) => { let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(p); if (z !== null) borderPtsWithZ.push({ x: p[0], y: p[1], z: z }); });

            let triangles = window.TriangulateDelaunay(borderPtsWithZ, l93Pts);

            let baseStep = 0.25; let step = baseStep * Math.sqrt(numFeatures); 
            if ((maxX - minX) / step > 600) step = (maxX - minX) / 600; if ((maxY - minY) / step > 600) step = (maxY - minY) / 600;
            
            minX -= step * 2; maxX += step * 2; minY -= step * 2; maxY += step * 2;

            let xVals = [], yVals = [];
            for (let x = minX; x <= maxX; x += step) xVals.push(x - globalMinX);
            for (let y = minY; y <= maxY; y += step) yVals.push(y - globalMinY);

            let zTerrain = [], zPlan = [], zCourbe = [];
            for (let y = minY; y <= maxY; y += step) {
                let rT = [], rP = [], rC = [];
                for (let x = minX; x <= maxX; x += step) {
                    if (isPointInPolygon([x, y], l93Pts)) {
                        let zMNT = getZ([x, y]); rT.push(zMNT !== null ? zMNT : null); 
                        
                        let zP = null; let bestDist = Infinity; let bestTri = null;
                        for(let tri of triangles) {
                            if (window.IsPointInTri(x, y, tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y)) { zP = window.GetZOnTriangle(x, y, tri[0], tri[1], tri[2]); break; }
                            let cx=(tri[0].x+tri[1].x+tri[2].x)/3, cy=(tri[0].y+tri[1].y+tri[2].y)/3;
                            let d2=(x-cx)**2+(y-cy)**2;
                            if(d2 < bestDist) { bestDist = d2; bestTri = tri; }
                        }
                        if (zP === null && bestTri) zP = window.GetZOnTriangle(x, y, bestTri[0], bestTri[1], bestTri[2]);
                        rP.push(zP);
                        
                        rC.push(window.GetSmoothZ(x, y, borderPtsWithZ));
                    } else { rT.push(null); rP.push(null); rC.push(null); }
                }
                zTerrain.push(rT); zPlan.push(rP); zCourbe.push(rC);
            }

            let xBound = [], yBound = [], zBound = [];
            borderPtsWithZ.forEach(pt => { xBound.push(pt.x - globalMinX); yBound.push(pt.y - globalMinY); zBound.push(pt.z); });
            if (borderPtsWithZ.length > 0) { xBound.push(borderPtsWithZ[0].x - globalMinX); yBound.push(borderPtsWithZ[0].y - globalMinY); zBound.push(borderPtsWithZ[0].z); }

            let hoverTemp = 'X: %{x:.2f} m<br>Y: %{y:.2f} m<br>Z: %{z:.2f} m<extra></extra>';
            let colors = colorScalesPool[index % colorScalesPool.length];

            allTraces.push({ z: zTerrain, x: xVals, y: yVals, type: 'surface', name: `Terrain (${d.name})`, colorscale: 'Earth', showscale: false, hovertemplate: hoverTemp });
            allTraces.push({ z: zPlan, x: xVals, y: yVals, type: 'surface', name: `Plan (${d.name})`, colorscale: colors.p, showscale: false, opacity: 0.6, hovertemplate: hoverTemp, visible: false });
            allTraces.push({ z: zCourbe, x: xVals, y: yVals, type: 'surface', name: `Courbe (${d.name})`, colorscale: colors.c, showscale: false, opacity: 0.6, hovertemplate: hoverTemp, visible: false });
            allTraces.push({ x: xBound, y: yBound, z: zBound, mode: 'lines', line: { color: d.color, width: 6 }, type: 'scatter3d', name: `Contour (${d.name})`, hovertemplate: hoverTemp });
        });

        const layout = { margin: { l: 0, r: 0, b: 0, t: 0 }, scene: { aspectmode: 'data', xaxis: { title: 'X (m)', backgroundcolor: '#222' }, yaxis: { title: 'Y (m)', backgroundcolor: '#222' }, zaxis: { title: 'Z (m)', backgroundcolor: '#222' } }, paper_bgcolor: '#222', font: { color: 'white' }, hovermode: 'closest' };
        
        Plotly.newPlot('plot-3d', allTraces, layout).then(() => {
            const plotDiv = document.getElementById('plot-3d');
            let htmlControls = `<b style="color:#f1c40f; display:block; margin-bottom:8px; font-size:14px;">🎛️ Multivue (${numFeatures} surf.)</b>`;
            featuresToPlot.forEach((pf, i) => {
                let baseIdx = i * 4; let colors = colorScalesPool[i % colorScalesPool.length];
                htmlControls += `<div style="margin-bottom:10px; background:rgba(0,0,0,0.3); padding:8px; border-radius:3px; border-left:4px solid ${pf.color || '#fff'};">
                    <b style="color:${pf.color || '#fff'}; display:block; margin-bottom:5px; font-size:1.1em;">${pf.name}</b>
                    <label style="display:block; margin-bottom:2px; cursor:pointer;"><input type="checkbox" checked onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [${baseIdx}])"> 🌍 Terrain</label>
                    <label style="display:block; margin-bottom:2px; cursor:pointer; color:#3498db;"><input type="checkbox" onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [${baseIdx+1}])"> 🟦 Plan (TIN)</label>
                    <label style="display:block; margin-bottom:2px; cursor:pointer; color:#27ae60;"><input type="checkbox" onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [${baseIdx+2}])"> 🟩 Courbe</label>
                    <label style="display:block; margin-bottom:2px; cursor:pointer;"><input type="checkbox" checked onchange="Plotly.restyle('plot-3d', {visible: this.checked}, [${baseIdx+3}])"> 🟥 Contour</label>
                </div>`;
            });
            setup3DControlPanel(htmlControls);

            plotDiv.on('plotly_hover', (data) => {
                if (data.points.length > 0) {
                    const pt = data.points[0]; const gps = proj4("EPSG:2154", "EPSG:4326", [pt.x + globalMinX, pt.y + globalMinY]);
                    if (!cursorMarker) cursorMarker = L.circleMarker([gps[1], gps[0]], { radius: 6, color: 'red', fillColor: '#fff', fillOpacity: 1 }).addTo(map);
                    else cursorMarker.setLatLng([gps[1], gps[0]]);
                }
            });
            plotDiv.addEventListener('mouseleave', () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } });
        });
    }, 100);
};
// ==========================================
// 8. PROFIL ALTIMÉTRIQUE AVEC SUIVI
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; generateProfile(drawStore.find(x=>x.id===id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id)); };

function generateProfile(d) {
    if(!d) return; document.getElementById('profile-window').style.display='block';
    const ctx = document.getElementById('profileChart').getContext('2d');
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    
    let data=[], geo=[], dist=0;
    
    let zStart = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0])||0);
    data.push({x: 0, y: parseFloat(zStart.toFixed(2))}); 
    geo.push({lat: d.ptsGPS[0].lat, lng: d.ptsGPS[0].lng}); // Coordonnées parfaites
    
    for(let i=1; i<l93.length; i++) {
        const dSeg = Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        for(let j=1; j<dSeg; j+=1) {
            const t = j/dSeg; 
            const x = l93[i-1][0]+(l93[i][0]-l93[i-1][0])*t;
            const y = l93[i-1][1]+(l93[i][1]-l93[i-1][1])*t;
            data.push({x: Math.round(dist+j), y: parseFloat((getZ([x,y])||0).toFixed(2))}); 
            const g = proj4("EPSG:2154","EPSG:4326",[x,y]);
            geo.push({lat: g[1], lng: g[0]});
        }
        dist += dSeg; 
        let zEnd = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : (getZ(l93[i])||0);
        data.push({x: Math.round(dist), y: parseFloat(zEnd.toFixed(2))}); 
        geo.push({lat: d.ptsGPS[i].lat, lng: d.ptsGPS[i].lng});
    }
    
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type:'line', 
        data:{datasets:[{label:'Altitude Z (m)', data, borderColor:d.color, backgroundColor:d.color+'33', fill:true, pointRadius:0, tension:0.1}]},
        options:{ 
            responsive:true, maintainAspectRatio:false, interaction:{mode:'index', intersect:false},
            plugins: { tooltip: { callbacks: { title: (c) => `Dist: ${c[0].parsed.x} m`, label: (c) => `Z: ${c.parsed.y.toFixed(2)} m` } } },
            scales: { x: { type: 'linear', title: {display:true, text:'Distance (m)'} } },
            onHover:(e,el)=>{
                if(el && el.length > 0){ 
                    const p = geo[el[0].index]; 
                    updateCursor(p.lat, p.lng);
                }
            }
        }
    });
    
    // Auto-réglage des curseurs
    const minZ = Math.min(...data.map(pt=>pt.y)), maxZ = Math.max(...data.map(pt=>pt.y)), maxD = data[data.length-1].x;
    const sXMin=document.getElementById('x-min'), sXMax=document.getElementById('x-max'), sYMin=document.getElementById('y-min'), sYMax=document.getElementById('y-max');
    if(sXMin) { sXMin.max=maxD; sXMax.max=maxD; sXMin.value=0; sXMax.value=maxD; }
    if(sYMin) { sYMin.min=minZ-10; sYMin.max=maxZ+10; sYMax.min=minZ-10; sYMax.max=maxZ+10; sYMin.value=minZ-1; sYMax.value=maxZ+1; }
    window.updateScalesLive();

    document.getElementById('profileChart').onmouseleave = () => { if (cursorMarker) { map.removeLayer(cursorMarker); cursorMarker = null; } };
}

window.updateScalesLive = () => {
    if (!chartInstance) return;
    const sXMin=document.getElementById('x-min'), sXMax=document.getElementById('x-max'), sYMin=document.getElementById('y-min'), sYMax=document.getElementById('y-max');
    if(!sXMin) return;
    const xMin = parseFloat(sXMin.value), xMax = parseFloat(sXMax.value), yMin = parseFloat(sYMin.value), yMax = parseFloat(sYMax.value);
    const vx = document.getElementById('x-vals'); if (vx) vx.innerText = `${xMin}m - ${xMax}m`; 
    const vy = document.getElementById('y-vals'); if (vy) vy.innerText = `${yMin}m - ${yMax}m`;
    chartInstance.options.scales.x.min = xMin; chartInstance.options.scales.x.max = xMax;
    chartInstance.options.scales.y.min = yMin; chartInstance.options.scales.y.max = yMax;
    chartInstance.update('none');
};

window.exportChartPNG = () => { const a = document.createElement('a'); a.href = document.getElementById('profileChart').toDataURL('image/png'); a.download = 'profil.png'; a.click(); };
window.exportChartCSV = () => { 
    let csv = "\ufeffDistance (m)\tAltitude Z (m)\n"; 
    chartInstance.data.datasets[0].data.forEach(r => { 
        csv += `${r.x}\t${r.y.toFixed(2).replace('.', ',')}\n`; 
    }); 
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = 'profil.csv'; a.click(); 
};

function updateProjectUI() {
    const list = document.getElementById('project-list'); if(!list) return; list.innerHTML = '';
    projectStore.forEach(p => {
        let fHtml = ''; 
        p.features.forEach(f => {
            const btns = f.type==='line' ? 
                `<button type="button" onclick="generateProfileById(${f.id})" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #555; padding:5px; cursor:pointer; font-weight:bold; border-radius:3px;">📈 Afficher le profil altimétrique</button>` : 
                `<div style="display:flex; gap:3px; margin-top:5px; flex-wrap:wrap;">
                    <button type="button" onclick="calculateVolume(${f.id}, 'hollow')" style="flex:1; font-size:0.75em; background:#3498db; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📉 Déblai</button>
                    <button type="button" onclick="calculateVolume(${f.id}, 'mound')" style="flex:1; font-size:0.75em; background:#e67e22; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📈 Remblai</button>
                    <button type="button" onclick="calculateVolume(${f.id}, 'slope')" style="flex:1; font-size:0.75em; background:#9b59b6; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📐 Courbe</button>
                    <button type="button" onclick="calculateVolume(${f.id}, 'plane')" style="flex:1; font-size:0.75em; background:#1abc9c; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📏 Plan</button>
                    <button type="button" onclick="generate3DView(${f.id})" style="flex:1; min-width:100%; font-size:0.8em; font-weight:bold; background:#34495e; color:#fff; border:1px solid #555; cursor:pointer; padding:5px; margin-top:2px; border-radius:3px;">👁️ Lancer Vue 3D</button>
                </div>`;
                
            fHtml += `<div style="margin-left:5px; border-left:3px solid ${f.color}; padding:5px; background:#1a1a1a; margin-top:5px; border-radius:3px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div><input type="checkbox" checked onchange="toggleProjectFeature(${p.id}, ${f.id})"> <strong style="margin-left:5px; font-size:1.1em;">${f.name}</strong></div>
                    <button type="button" onclick="deleteProjectFeature(${p.id}, ${f.id})" style="background:transparent; color:#e74c3c; border:none; cursor:pointer;">✕</button>
                </div>
                <div id="stats-proj-${f.id}" style="font-size:12px; margin:5px 0; color:#ddd; background:#222; padding:6px; border-radius:3px;">${f.statsHtml || ''}</div>
                <button type="button" onclick="toggleEditMode(${f.id}, true, ${p.id})" style="width:100%; background:${f.isEditing?'#27ae60':'#7f8c8d'}; color:#fff; border:none; padding:5px; cursor:pointer; margin-bottom:5px; font-weight:bold; border-radius:3px;">${f.isEditing?'✅ Fin édition':'✏️ Éditer les points'}</button>
                ${generateEditorTable(f, true, p.id)}
                ${btns}
            </div>`;
        });
        list.innerHTML += `<div class="card">
            <div class="card-header">
                <div><input type="checkbox" ${p.visible ? 'checked' : ''} onchange="toggleProject(${p.id})"><strong style="color:#3498db; font-size:1.1em;">📁 ${p.name}</strong></div>
                <button type="button" class="btn-del" onclick="deleteProject(${p.id})">✕</button>
            </div>
            <details open style="margin-top: 8px;"><summary style="font-size: 0.85em; color: #aaa; cursor:pointer;">Ouvrir/Fermer les calques</summary>${fHtml}</details>
        </div>`;
    });
}
// ==========================================
// 9. SOURIS LIVE, DRAG ET REDIMENSIONNEMENT FENÊTRES
// ==========================================

map.on('mousemove', (e)=>{
    if (!e.latlng) return; const l = proj4("EPSG:4326","EPSG:2154",[e.latlng.lng, e.latlng.lat]);
    const elX=document.getElementById('cur-x'), elY=document.getElementById('cur-y'), elZ=document.getElementById('cur-z');
    if(elX) elX.innerText = l[0].toFixed(1); if(elY) elY.innerText = l[1].toFixed(1);
    if(elZ){ const z=getZ(l); elZ.innerText = z!==null?z.toFixed(2):'---'; }
    if(currentTool==='circle' && circleCenter && tempLayer) tempLayer.setRadius(map.distance(circleCenter, e.latlng));
});

// --- GESTION DU DÉPLACEMENT (DRAG & DROP) ---
function dragElement(winId, headerId) {
    const win = document.getElementById(winId), header = document.getElementById(headerId);
    let isDragging = false, offsetX = 0, offsetY = 0; if(!header) return;
    
    header.onmousedown = (e) => { 
        if(e.target.tagName==='BUTTON') return; 
        isDragging=true; 
        const rect=win.getBoundingClientRect(); 
        offsetX=e.clientX-rect.left; 
        offsetY=e.clientY-rect.top; 
    };
    
    document.addEventListener('mousemove', (e) => { 
        if(isDragging) { 
            win.style.left = Math.max(0, e.clientX-offsetX) + 'px'; 
            win.style.top = Math.max(0, e.clientY-offsetY) + 'px'; 
        }
    });
    
    document.addEventListener('mouseup', () => isDragging = false);
}

dragElement('window-3d', 'header-3d'); 
dragElement('profile-window', 'profile-header');

// --- NOUVEAU : REDIMENSIONNEMENT DE LA VUE 3D ---
window.addEventListener('load', () => {
    const win3d = document.getElementById('window-3d');
    const plot3d = document.getElementById('plot-3d');

    if (win3d && plot3d) {
        // 1. On injecte les styles CSS pour permettre de redimensionner la fenêtre
        win3d.style.resize = 'both';
        win3d.style.overflow = 'hidden';
        win3d.style.minWidth = '400px';
        win3d.style.minHeight = '300px';
        
        // 2. On s'assure que le canvas 3D prend toute la place disponible (moins la barre de titre)
        plot3d.style.width = '100%';
        plot3d.style.height = 'calc(100% - 40px)'; 

        // 3. On observe les changements de taille de la fenêtre en temps réel
        const resizeObserver = new ResizeObserver(() => {
            // Si le graphique Plotly est bien chargé, on le force à s'adapter à la nouvelle taille
            if (plot3d.data) {
                Plotly.Plots.resize('plot-3d');
            }
        });
        
        resizeObserver.observe(win3d);
    }
});

// ==========================================
// 10. SAUVEGARDE ET PROJETS (GAUCHE)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzZ-m9rVPuATkiYjccicrtBSrAieSSA_TTqmYpA61SoK4eTj11qesIEpItyys6Vu2GVXQ/exec"; // <--- ⚠️ À REMPLIR

window.saveProject = async () => {
    const name = document.getElementById('project-name').value.trim(); 
    if (!name || drawStore.length===0) return alert("Nom de projet et tracés requis dans la colonne de droite.");
    const data = drawStore.map(d => ({ type:d.type, name:d.name, ptsGPS:d.ptsGPS, color:d.color, center:d.center, radius:d.radius, volumeHtml:d.volumeHtml }));
    const btn = document.querySelector('button[onclick="saveProject()"]'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ projectName: name, projectData: JSON.stringify(data) }) });
        const json = await res.json();
        if(json.status === "success") { 
            const newProj = { id: Date.now(), name: name, visible: true, features: [...drawStore] };
            newProj.features.forEach(f => { if(f.editGroup) map.removeLayer(f.editGroup); f.isEditing=false; });
            projectStore.push(newProj); drawStore = []; updateDrawUI(); updateProjectUI(); alert("✅ Projet sauvegardé à gauche !"); 
        }
    } catch(e) { alert("Erreur Google Sheets"); } finally { btn.innerText = "Sauver"; btn.disabled = false; }
};

window.loadProject = async () => {
    const name = document.getElementById('project-name').value.trim(); if (!name) return;
    const btn = document.querySelector('button[onclick="loadProject()"]'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(`${SCRIPT_URL}?projectName=${encodeURIComponent(name)}`);
        const json = await res.json(); if(json.status === "error") return alert("Introuvable !");
        
        const data = JSON.parse(json.data); 
        const newProj = { id: Date.now(), name: name, visible: true, features: [] };
        
        data.forEach(d => {
            let layer;
            if(d.type==='circle') layer=L.circle(d.center, {radius:d.radius, color:d.color, weight:3}).addTo(map);
            else if(d.type==='area') layer=L.polygon(d.ptsGPS, {color:d.color, weight:3, fillOpacity:0.3}).addTo(map);
            else layer=L.polyline(d.ptsGPS, {color:d.color, weight:4}).addTo(map);
            
            const newObj = { 
                id: Date.now()+Math.random(), type:d.type, name:d.name, layer, 
                ptsGPS:d.ptsGPS, center:d.center, radius:d.radius, color:d.color, 
                visible:true, isEditing:false, editGroup:L.layerGroup().addTo(map), volumeHtml: d.volumeHtml 
            };
            newProj.features.push(newObj); recalculateStats(newObj);
        });
        projectStore.push(newProj); updateProjectUI();
        const group = L.featureGroup(newProj.features.map(f => f.layer)); map.fitBounds(group.getBounds());
        alert("✅ Projet chargé dans le menu de gauche !");
    } catch(e) { alert("Erreur chargement"); } finally { btn.innerText = "Charger"; btn.disabled = false; }
};

// --- GESTION DE L'INTERFACE DES PROJETS (GAUCHE) ---
function updateProjectUI() {
    const list = document.getElementById('project-list'); if(!list) return; list.innerHTML = '';
    projectStore.forEach(p => {
        let fHtml = ''; 
        p.features.forEach(f => {
            const btns = f.type==='line' ? 
                `<button type="button" onclick="generateProfileById(${f.id})" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #555; padding:5px; cursor:pointer; font-weight:bold; border-radius:3px;">📈 Afficher le profil altimétrique</button>` : 
                `<div style="display:flex; gap:3px; margin-top:5px; flex-wrap:wrap;">
                    <button type="button" onclick="calculateVolume(${f.id}, 'hollow')" style="flex:1; font-size:0.75em; background:#3498db; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📉 Déblai</button>
                    <button type="button" onclick="calculateVolume(${f.id}, 'mound')" style="flex:1; font-size:0.75em; background:#e67e22; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📈 Remblai</button>
                    <button type="button" onclick="calculateVolume(${f.id}, 'slope')" style="flex:1; font-size:0.75em; background:#9b59b6; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📐 Courbe</button>
                    <button type="button" onclick="calculateVolume(${f.id}, 'plane')" style="flex:1; font-size:0.75em; background:#1abc9c; color:#fff; border:none; cursor:pointer; padding:5px; border-radius:3px;">📏 Plan</button>
                    <button type="button" onclick="generate3DView(${f.id})" style="flex:1; min-width:100%; font-size:0.8em; font-weight:bold; background:#34495e; color:#fff; border:1px solid #555; cursor:pointer; padding:5px; margin-top:2px; border-radius:3px;">👁️ Lancer Vue 3D</button>
                </div>`;
                
            fHtml += `<div style="margin-left:5px; border-left:3px solid ${f.color}; padding:5px; background:#1a1a1a; margin-top:5px; border-radius:3px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div><input type="checkbox" checked onchange="toggleProjectFeature(${p.id}, ${f.id})"> <strong style="margin-left:5px; font-size:1.1em;">${f.name}</strong></div>
                    <button type="button" onclick="deleteProjectFeature(${p.id}, ${f.id})" style="background:transparent; color:#e74c3c; border:none; cursor:pointer;">✕</button>
                </div>
                <div id="stats-proj-${f.id}" style="font-size:12px; margin:5px 0; color:#ddd; background:#222; padding:6px; border-radius:3px;">${f.statsHtml || ''}</div>
                <button type="button" onclick="toggleEditMode(${f.id}, true, ${p.id})" style="width:100%; background:${f.isEditing?'#27ae60':'#7f8c8d'}; color:#fff; border:none; padding:5px; cursor:pointer; margin-bottom:5px; font-weight:bold; border-radius:3px;">${f.isEditing?'✅ Fin édition':'✏️ Éditer les points'}</button>
                ${generateEditorTable(f, true, p.id)}
                ${btns}
            </div>`;
        });
        
        list.innerHTML += `<div class="card">
            <div class="card-header">
                <div><input type="checkbox" ${p.visible ? 'checked' : ''} onchange="toggleProject(${p.id})"><strong style="color:#3498db; font-size:1.1em;">📁 ${p.name}</strong></div>
                <button type="button" class="btn-del" onclick="deleteProject(${p.id})">✕</button>
            </div>
            
            <button type="button" onclick="copyProjectToWorkspace(${p.id})" style="width:100%; margin-top:5px; background:#f39c12; color:#fff; border:none; padding:6px; border-radius:3px; cursor:pointer; font-weight:bold;">📥 Copier vers l'espace de travail</button>
            
            <details open style="margin-top: 8px;"><summary style="font-size: 0.85em; color: #aaa; cursor:pointer;">Ouvrir/Fermer les calques</summary>${fHtml}</details>
        </div>`;
    });
}

// --- FONCTION POUR COPIER UN PROJET VERS LA DROITE ---
window.copyProjectToWorkspace = (pid) => {
    const p = projectStore.find(x => x.id === pid);
    if (!p) return;
    
    p.features.forEach(f => {
        const newPts = f.ptsGPS.map(pt => ({ lat: pt.lat, lng: pt.lng, customZ: pt.customZ }));
        const newId = Date.now() + Math.random();
        
        let layer;
        if (f.type === 'circle') layer = L.circle(f.center, {radius: f.radius, color: f.color, weight: 3}).addTo(map);
        else if (f.type === 'area') layer = L.polygon(newPts, {color: f.color, weight: 3, fillOpacity: 0.3}).addTo(map);
        else layer = L.polyline(newPts, {color: f.color, weight: 4}).addTo(map);

        const newObj = {
            id: newId, type: f.type, name: f.name + " (Copie)", layer: layer,
            ptsGPS: newPts, center: f.center ? {...f.center} : null, radius: f.radius,
            color: f.color, weight: f.weight || 3, visible: true, isEditing: false,
            editGroup: L.layerGroup().addTo(map), volumeHtml: f.volumeHtml
        };
        
        drawStore.unshift(newObj);
        recalculateStats(newObj);
    });
    
    updateDrawUI();
    alert(`✅ Projet "${p.name}" copié avec succès dans l'espace de travail à droite !`);
};
// ==========================================
// 11. AIDE, CAPTURES 3D ET EXPORT RAPPORT PDF COMPLET
// ==========================================

setTimeout(() => { if(typeof dragElement === 'function') dragElement('help-window', 'help-header'); }, 1000);

// --- SYSTÈME DE CAPTURE 3D MANUELLE ---
window.pdf3DCaptures = []; 

window.capture3DForPDF = async () => {
    if (window.pdf3DCaptures.length >= 3) return alert("Vous avez déjà atteint le maximum de 3 captures 3D pour ce rapport.");
    const plot3D = document.getElementById('plot-3d');
    if (!plot3D || !plot3D.data) return alert("Aucune vue 3D à capturer.");
    const btn = document.getElementById('btn-capture-3d');
    btn.innerText = "📸..."; 
    try {
        let imgUrl = await Plotly.toImage(plot3D, {format: 'png', width: 800, height: 600});
        window.pdf3DCaptures.push(imgUrl);
        btn.innerText = `📸 Capturer (${window.pdf3DCaptures.length}/3)`;
    } catch(e) { 
        console.error("Erreur capture 3D :", e); 
        btn.innerText = `📸 Erreur`;
    }
};

const originalClose3D = window.close3DWindow;
window.close3DWindow = () => {
    window.pdf3DCaptures = [];
    const btn = document.getElementById('btn-capture-3d');
    if(btn) btn.innerText = "📸 Capturer (0/3)";
    if(originalClose3D) originalClose3D();
};

// --- MOTEUR DE GÉNÉRATION DU RAPPORT PDF ---
window.generatePDFReport = async () => {
    let allFeatures = [...drawStore, ...projectStore.flatMap(p => p.features.filter(f => f.visible))];
    if (allFeatures.length === 0) return alert("Veuillez tracer ou charger au moins un élément avant de générer un rapport.");
    
    const btn = document.querySelector('button[onclick="generatePDFReport()"]');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Génération PDF en cours..."; btn.disabled = true;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        let yPos = 20;

        // --- EN-TÊTE ---
        doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(41, 128, 185);
        doc.text("RAPPORT TOPOGRAPHIQUE", pageWidth / 2, yPos, { align: "center" });
        yPos += 10;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 100, 100);
        doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, yPos, { align: "center" });
        yPos += 15;

        // --- 1. CARTE CENTRÉE (Maintenant avec les tracés visibles grâce à preferCanvas) ---
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
        doc.text("1. Vue Planimétrique (Carte)", 15, yPos);
        yPos += 8;

        let allLayers = allFeatures.map(d => d.layer);
        if (allLayers.length > 0) {
            const group = L.featureGroup(allLayers);
            await new Promise(resolve => {
                map.once('moveend', () => setTimeout(resolve, 800)); 
                map.fitBounds(group.getBounds(), { padding: [30, 30] });
            });
        }

        const mapDiv = document.getElementById('map');
        const canvasMap = await html2canvas(mapDiv, { 
            useCORS: true, 
            logging: false,
            ignoreElements: (el) => el.classList.contains('leaflet-control-container') 
        });
        const mapHeight = (canvasMap.height * (pageWidth - 30)) / canvasMap.width;
        let finalMapHeight = mapHeight > 100 ? 100 : mapHeight; 
        doc.addImage(canvasMap.toDataURL("image/jpeg", 0.8), 'JPEG', 15, yPos, pageWidth - 30, finalMapHeight);
        yPos += finalMapHeight + 15;

        // --- 2. TABLEAU RÉCAPITULATIF ---
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("2. Récapitulatif des tracés", 15, yPos);
        yPos += 8;

        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'width:800px; padding:20px; background:white; color:black; position:absolute; left:-9999px; font-family:sans-serif;';
        
        let tableHtml = `
            <table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px; margin-bottom:20px;">
                <thead>
                    <tr style="background-color:#2980b9; color:white;">
                        <th style="padding:8px; border:1px solid #ccc;">Nom</th>
                        <th style="padding:8px; border:1px solid #ccc;">Type</th>
                        <th style="padding:8px; border:1px solid #ccc;">Périm. / Long.</th>
                        <th style="padding:8px; border:1px solid #ccc;">Surface</th>
                        <th style="padding:8px; border:1px solid #ccc;">Z Min</th>
                        <th style="padding:8px; border:1px solid #ccc;">Z Max</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        allFeatures.forEach(d => {
            const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
            let zMin = Infinity, zMax = -Infinity, perim = 0, area = 0;
            
            l93.forEach((p, i) => {
                let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(p);
                if(z !== null) { if(z < zMin) zMin = z; if(z > zMax) zMax = z; }
            });
            
            if (d.type === 'circle') {
                perim = 2 * Math.PI * d.radius; area = Math.PI * d.radius * d.radius;
            } else if (d.type === 'line') {
                for (let i = 1; i < l93.length; i++) perim += Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
                area = 0;
            } else {
                for (let i = 0; i < l93.length; i++) { 
                    let j = (i+1) % l93.length; 
                    area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; 
                    perim += Math.hypot(l93[j][0] - l93[i][0], l93[j][1] - l93[i][1]);
                }
                area = Math.abs(area)/2;
            }
            
            let typeTrad = d.type === 'area' ? 'Surface' : (d.type === 'circle' ? 'Cercle' : 'Ligne');
            tableHtml += `<tr>
                <td style="padding:6px; border:1px solid #ccc; font-weight:bold; color:${d.color};">${d.name}</td>
                <td style="padding:6px; border:1px solid #ccc;">${typeTrad}</td>
                <td style="padding:6px; border:1px solid #ccc;">${perim.toFixed(2)} m</td>
                <td style="padding:6px; border:1px solid #ccc;">${area > 0 ? area.toFixed(2)+' m²' : '-'}</td>
                <td style="padding:6px; border:1px solid #ccc;">${zMin !== Infinity ? zMin.toFixed(2)+' m' : '-'}</td>
                <td style="padding:6px; border:1px solid #ccc;">${zMax !== -Infinity ? zMax.toFixed(2)+' m' : '-'}</td>
            </tr>`;
        });
        tableHtml += `</tbody></table>`;
        tempDiv.innerHTML += tableHtml;

        // --- 3. ÉTIQUETTES DE MESURES ---
        tempDiv.innerHTML += `<h3 style="color:#2c3e50; border-bottom:2px solid #ccc; padding-bottom:5px;">Détail des Volumes et Mesures</h3>`;
        allFeatures.forEach(d => {
            let cleanStats = (d.statsHtml || "Aucune donnée")
                .replace(/color:#f1c40f/g, 'color:#d35400').replace(/color:#eee/g, 'color:#333')
                .replace(/color:#ddd/g, 'color:#333').replace(/color:#fff/g, 'color:#111')
                .replace(/color:white/g, 'color:#111').replace(/background:#222/g, 'background:#f9f9f9; border:1px solid #ccc')
                .replace(/background:#1a1a1a/g, 'background:#f0f0f0; border:1px solid #ccc');
                
            tempDiv.innerHTML += `<div style="border-left: 6px solid ${d.color}; padding-left: 15px; margin-bottom: 20px;"><b style="color:#2c3e50; font-size:18px;">${d.name}</b><div style="font-size: 15px; color:#333; line-height:1.5; margin-top:5px;">${cleanStats}</div></div>`;
        });

        document.body.appendChild(tempDiv);
        const canvasTableStats = await html2canvas(tempDiv, { scale: 2 });
        const imgTableStats = canvasTableStats.toDataURL("image/png");
        document.body.removeChild(tempDiv);

        const tableStatsHeight = (canvasTableStats.height * (pageWidth - 30)) / canvasTableStats.width;
        if(yPos + tableStatsHeight > 280) { doc.addPage(); yPos = 20; }
        doc.addImage(imgTableStats, 'PNG', 15, yPos, pageWidth - 30, tableStatsHeight);
        yPos += tableStatsHeight + 20;

        // --- 4. PROFILS ALTIMÉTRIQUES SCANNÉS À HAUTE RÉSOLUTION ---
        let lines = allFeatures.filter(d => d.type === 'line');
        if (lines.length > 0) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("3. Profils Altimétriques (Coupes)", 15, yPos);
            yPos += 10;

            for (let line of lines) {
                let dists = [], zVals = [], totalDist = 0;
                const l93 = line.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
                
                // Le scan magique tous les 1 mètre
                for (let i = 1; i < l93.length; i++) {
                    let p1 = l93[i-1], p2 = l93[i];
                    let segmentDist = Math.hypot(p2[0]-p1[0], p2[1]-p1[1]);
                    let steps = Math.max(2, Math.floor(segmentDist)); // Au moins 1 point par mètre
                    
                    let z1 = line.ptsGPS[i-1].customZ !== undefined ? line.ptsGPS[i-1].customZ : getZ(p1);
                    let z2 = line.ptsGPS[i].customZ !== undefined ? line.ptsGPS[i].customZ : getZ(p2);

                    for (let j = 0; j <= steps; j++) {
                        if (i > 1 && j === 0) continue; // Évite le doublon aux angles
                        let t = j / steps;
                        let curX = p1[0] + t * (p2[0]-p1[0]), curY = p1[1] + t * (p2[1]-p1[1]);
                        
                        let curZ;
                        if (line.ptsGPS[i-1].customZ !== undefined && line.ptsGPS[i].customZ !== undefined) {
                            curZ = z1 + t * (z2 - z1); // Pente droite parfaite si on force le Z
                        } else {
                            curZ = getZ([curX, curY]); // On lit le terrain naturel !
                            if (curZ === null) curZ = (z1 !== null && z2 !== null) ? z1 + t * (z2 - z1) : 0;
                        }
                        dists.push(totalDist + (t * segmentDist)); zVals.push(curZ);
                    }
                    totalDist += segmentDist;
                }
                
                let trace = { x: dists, y: zVals, mode: 'lines', fill: 'tozeroy', type: 'scatter', line: {color: line.color, width: 2}, name: line.name };
                let layout = { title: { text: `Profil : ${line.name}`, font: {size: 14, color:'black'} }, xaxis: {title: 'Distance (m)', color:'black'}, yaxis: {title: 'Altitude (m)', color:'black'}, margin: {t:40, b:40, l:40, r:20}, plot_bgcolor: '#fff', paper_bgcolor: '#fff' };
                
                let imgUrl = await Plotly.toImage({data: [trace], layout: layout}, {format: 'png', width: 800, height: 350});
                
                if (yPos + 80 > 280) { doc.addPage(); yPos = 20; }
                doc.addImage(imgUrl, 'PNG', 15, yPos, pageWidth - 30, 75);
                yPos += 85;
            }
        }

        // --- 5. INTÉGRATION DES CAPTURES 3D MANUELLES ---
        if (window.pdf3DCaptures && window.pdf3DCaptures.length > 0) {
            if (yPos > 180) { doc.addPage(); yPos = 20; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("4. Vues 3D (Captures Manuelles)", 15, yPos);
            yPos += 10;

            for (let i = 0; i < window.pdf3DCaptures.length; i++) {
                if (yPos + 110 > 280) { doc.addPage(); yPos = 20; }
                doc.addImage(window.pdf3DCaptures[i], 'PNG', 15, yPos, pageWidth - 30, 105);
                yPos += 115;
            }
        }

        doc.save(`TopoProfiler_Rapport_${Date.now()}.pdf`);
        
    } catch (error) {
        console.error(error);
        alert("Erreur lors de la génération du PDF.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};
// ==========================================
// 12. LANCEMENT DE LA VUE 3D GLOBALE (SCÈNE COMPLÈTE)
// ==========================================

window.generateGlobal3DView = () => {
    // 1. On récupère TOUS les tracés (ceux en cours + ceux des projets chargés qui sont visibles)
    let allFeatures = [
        ...drawStore, 
        ...projectStore.flatMap(p => p.features.filter(f => f.visible))
    ];

    // 2. La 3D ne fonctionne que sur les surfaces et les cercles, on filtre donc les lignes
    let areasToPlot = allFeatures.filter(d => d.type === 'area' || d.type === 'circle');

    // 3. Sécurités
    if (mntStore.filter(m => m.visible).length === 0) {
        return alert("Veuillez d'abord activer un MNT dans la liste à gauche !");
    }
    if (areasToPlot.length === 0) {
        return alert("Veuillez tracer ou afficher au moins une surface pour générer la 3D Globale.");
    }

    // 4. Si on n'a qu'une seule surface, on lance la vue 3D classique plus rapide
    if (areasToPlot.length === 1) {
        window.generate3DView(areasToPlot[0].id);
    } 
    // 5. Si on a plusieurs surfaces, on lance notre moteur Multivue de la Section 7 !
    else {
        window.generateMulti3DViewAdaptive(areasToPlot);
    }
};
// --- ACTIONS SUR LES PROJETS (AFFICHAGE / SUPPRESSION) ---
window.toggleProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.visible = !p.visible; p.features.forEach(f => { f.visible = p.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } }); updateProjectUI(); };
window.deleteProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.features.forEach(f => { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); }); projectStore = projectStore.filter(x => x.id !== pid); updateProjectUI(); };
window.toggleProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.visible = !f.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } updateProjectUI(); };
window.deleteProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); p.features = p.features.filter(x => x.id !== fid); updateProjectUI(); };
   
window.toggleProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.visible = !p.visible; p.features.forEach(f => { f.visible = p.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } }); updateProjectUI(); };
window.deleteProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.features.forEach(f => { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); }); projectStore = projectStore.filter(x => x.id !== pid); updateProjectUI(); };
window.toggleProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.visible = !f.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } updateProjectUI(); };
window.deleteProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); p.features = p.features.filter(x => x.id !== fid); updateProjectUI(); };
