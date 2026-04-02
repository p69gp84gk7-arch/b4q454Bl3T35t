// ==========================================
// 1. CONFIGURATION CARTE ET L93
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
    mntStore.forEach(m => { list.innerHTML += `<div class="card"><div class="card-header"><div><input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMNT(${m.id})"> <b>⛰️ ${m.name}</b></div><button class="btn-del" onclick="deleteMNT(${m.id})">✕</button></div></div>`; });
}
window.toggleMNT = (id) => { const m = mntStore.find(x => x.id === id); m.visible = !m.visible; if (m.visible) m.visual.addTo(map); else map.removeLayer(m.visual); };
window.deleteMNT = (id) => { const m = mntStore.find(x => x.id === id); map.removeLayer(m.visual); mntStore = mntStore.filter(x => x.id !== id); updateMntUI(); };

// ==========================================
// 3. CHARGEMENT DES KMZ (STATIC)
// ==========================================
window.addEventListener('load', () => {
    try {
        if (typeof pistesData !== 'undefined' && pistesData.features) {
            const l = L.geoJSON(pistesData, { style: { color: '#ffffff', weight: 2, opacity: 0.8 } }).addTo(map);
            kmzStore.push({ id: "pistes", name: "Pistes (Domaine)", layer: l, visible: true, color: '#ffffff' });
            if (mntStore.length === 0) map.fitBounds(l.getBounds());
        }
        if (typeof canonData !== 'undefined' && canonData.features) {
            const c = L.geoJSON(canonData, { pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, fillColor: '#3498db', color: '#fff', weight: 1, fillOpacity: 0.9 }) }).addTo(map);
            kmzStore.push({ id: "canons", name: "Canons à neige", layer: c, visible: true, color: '#3498db' });
        }
        updateKmzUI();
    } catch (e) {}
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
    currentTool = tool; currentPoints = []; circleCenter = null; if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); document.getElementById('btn-'+tool).classList.add('active');
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
    const type = currentTool; const color = type==='area'?'#e67e22':'#3498db';
    const drawObj = { id: Date.now(), type, name: type==='area'?'Surface':'Tracé Ligne', ptsGPS: [...currentPoints], visible: true, color, weight: 4, isEditing: false, editGroup: L.layerGroup().addTo(map), tas:0, creux:0, dist:0, area:0 };
    drawObj.layer = type === 'area' ? L.polygon(currentPoints, {color, weight: 3, fillOpacity: 0.3}).addTo(map) : L.polyline(currentPoints, {color, weight: 4}).addTo(map);
    drawStore.unshift(drawObj); recalculateStats(drawObj); updateDrawUI();
    if(type === 'line') generateProfile(drawObj);
    currentTool = null; currentPoints = []; if(tempLayer) map.removeLayer(tempLayer);
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); document.getElementById('btn-finish').style.display = 'none';
};

window.finalizeCircle = (center, radius) => {
    const drawObj = { id: Date.now(), type: 'circle', name: 'Cercle/Rayon', center, radius, visible: true, color: '#9b59b6', weight: 3, isEditing: false, editGroup: L.layerGroup().addTo(map), tas:0, creux:0, dist:0, area:0 };
    drawObj.layer = L.circle(center, {radius, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map);
    const pts = []; const cL93 = proj4("EPSG:4326", "EPSG:2154", [center.lng, center.lat]);
    for (let i=0; i<64; i++) { const a = (i*2*Math.PI)/64; const g = proj4("EPSG:2154", "EPSG:4326", [cL93[0]+radius*Math.cos(a), cL93[1]+radius*Math.sin(a)]); pts.push({lat: g[1], lng: g[0]}); }
    drawObj.ptsGPS = pts; drawStore.unshift(drawObj); recalculateStats(drawObj); updateDrawUI(); currentTool = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
};

// ==========================================
// 5. STATS & CUMULS (DROITE ET GAUCHE)
// ==========================================
function recalculateStats(d) {
    if (!d) return; const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let h = "";
    if (d.type === 'circle') {
        d.area = Math.PI * d.radius * d.radius; const perim = 2 * Math.PI * d.radius; d.dist = perim;
        h = `Rayon: <b>${d.radius.toFixed(1)} m</b> | Diam: <b>${(2*d.radius).toFixed(1)} m</b><br>Périmètre: <b>${perim.toFixed(1)} m</b> | Surface: <b>${d.area.toFixed(1)} m²</b>`;
    } else if (d.type === 'line') {
        let dist = 0; for (let i = 1; i < l93.length; i++) dist += Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        d.dist = dist; d.area = 0;
        const z1 = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0])||0); 
        const z2 = d.ptsGPS[l93.length-1].customZ !== undefined ? d.ptsGPS[l93.length-1].customZ : (getZ(l93[l93.length-1])||0); 
        const dz = Math.abs(z2 - z1); const pente = dist > 0 ? (dz / dist * 100) : 0;
        h = `Longueur: <b>${dist.toFixed(1)} m</b> | Dénivelé: <b>${dz.toFixed(2)} m</b><br>Pente moy: <b>${pente.toFixed(1)} %</b>`;
    } else {
        let area = 0; let perim = 0;
        for (let i = 0; i < l93.length; i++) { let j = (i+1) % l93.length; area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; perim += Math.hypot(l93[j][0] - l93[i][0], l93[j][1] - l93[i][1]); }
        d.area = Math.abs(area)/2; d.dist = perim;
        h = `Périmètre: <b>${perim.toFixed(1)} m</b><br>Surface au sol: <b>${d.area.toFixed(1)} m²</b>`;
    }
    if (d.volumeHtml) h += `<hr style="border:0; border-top:1px solid #444; margin:5px 0;">${d.volumeHtml}`;
    d.statsHtml = h; 
    const stD = document.getElementById(`stats-${d.id}`); if (stD) stD.innerHTML = h;
    const stG = document.getElementById(`stats-proj-${d.id}`); if (stG) stG.innerHTML = h;
}

window.clearAllDrawings = () => {
    if(!confirm("Êtes-vous sûr de vouloir effacer tous vos tracés et mesures ?")) return;
    drawStore.forEach(d => { map.removeLayer(d.layer); if(d.editGroup) map.removeLayer(d.editGroup); });
    drawStore = []; updateDrawUI();
    if(chartInstance) document.getElementById('profile-window').style.display='none';
};

function updateDrawUI() {
    const list = document.getElementById('measure-list'); if(!list) return; list.innerHTML = '';
    
    // --- Calcul des Cumuls ---
    let cDist = 0, cArea = 0, cTas = 0, cCreux = 0;
    drawStore.forEach(d => { cDist+=(d.dist||0); cArea+=(d.area||0); cTas+=(d.tas||0); cCreux+=(d.creux||0); });
    if(drawStore.length > 0) {
        list.innerHTML += `<div class="card" style="background:#f39c12; color:black; margin-bottom:10px; border:none; padding:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(0,0,0,0.2); padding-bottom:5px; margin-bottom:5px;">
                <b style="font-size:1.1em;">📊 TOTAL CUMULÉ</b>
                <button onclick="clearAllDrawings()" style="background:#e74c3c; color:white; border:none; border-radius:3px; padding:3px 6px; cursor:pointer;">🗑️ Tout effacer</button>
            </div>
            <div style="font-size:0.9em; display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                <div>Ligne/Périm: <b>${cDist.toFixed(1)}m</b></div>
                <div>Surfaces: <b>${cArea.toFixed(1)}m²</b></div>
                <div>Remblai: <b>${cTas.toFixed(1)}m³</b></div>
                <div>Déblai: <b>${cCreux.toFixed(1)}m³</b></div>
            </div>
        </div>`;
    }

    drawStore.forEach(d => {
        let btns = d.type === 'line' ? 
            `<button onclick="generateProfileById(${d.id})" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #555; padding:5px; cursor:pointer; font-weight:bold;">📈 Afficher Profil Altimétrique</button>` : 
            `<div style="display:flex; gap:3px; margin-top:5px; flex-wrap:wrap;">
                <button onclick="calculateVolume(${d.id}, 'hollow')" style="flex:1; font-size:0.7em; background:#2980b9; color:#fff; border:none; cursor:pointer; padding:4px;">📉 Déblai</button>
                <button onclick="calculateVolume(${d.id}, 'mound')" style="flex:1; font-size:0.7em; background:#e67e22; color:#fff; border:none; cursor:pointer; padding:4px;">📈 Remblai</button>
                <button onclick="calculateVolume(${d.id}, 'slope')" style="flex:1; font-size:0.7em; background:#8e44ad; color:#fff; border:none; cursor:pointer; padding:4px;">📐 Vol. Courbe</button>
                <button onclick="calculateVolume(${d.id}, 'plane')" style="flex:1; font-size:0.7em; background:#9b59b6; color:#fff; border:none; cursor:pointer; padding:4px;">📏 Vol. Plan</button>
                <button onclick="generate3DView(${d.id})" style="flex:1; min-width:100%; font-size:0.8em; font-weight:bold; background:#34495e; color:#fff; border:1px solid #555; cursor:pointer; padding:5px; margin-top:2px;">👁️ Lancer Vue 3D</button>
            </div>`;
        
        let editorHtml = '';
        if(d.isEditing && d.type !== 'circle') {
            editorHtml = `<div style="background:#111; padding:5px; margin-top:5px; border-radius:3px; font-size:11px;">
                <div style="margin-bottom:5px; color:#3498db; text-align:center;"><b>📍 Tableau des Coordonnées (L93)</b></div>
                <table style="width:100%; color:white; text-align:center;"><tr><th>Pt</th><th>X</th><th>Y</th><th>Z Forcé</th></tr>`;
            d.ptsGPS.forEach((pt, i) => {
                const l = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]);
                editorHtml += `<tr>
                    <td style="color:#e74c3c; font-weight:bold;">${i+1}</td>
                    <td><input id="edit-x-${d.id}-${i}" value="${l[0].toFixed(2)}" oninput="applyPointEdits(${d.id})" style="width:65px; background:#222; color:#fff; border:1px solid #555; text-align:center;"></td>
                    <td><input id="edit-y-${d.id}-${i}" value="${l[1].toFixed(2)}" oninput="applyPointEdits(${d.id})" style="width:65px; background:#222; color:#fff; border:1px solid #555; text-align:center;"></td>
                    <td><input id="edit-z-${d.id}-${i}" value="${pt.customZ||''}" placeholder="Auto" onchange="applyPointEdits(${d.id})" style="width:45px; background:#2980b9; color:#fff; border:1px solid #555; text-align:center;"></td>
                </tr>`;
            });
            editorHtml += `</table></div>`;
        }

        list.innerHTML += `<div class="card" style="border-left:4px solid ${d.color}; margin-bottom:8px;">
            <div class="card-header">
                <div style="display:flex; align-items:center;">
                    <input type="checkbox" ${d.visible?'checked':''} onchange="toggleDraw(${d.id})"> 
                    <input type="color" class="color-picker" value="${d.color}" onchange="changeColor(${d.id}, this.value)"> 
                    <strong style="cursor:pointer; font-size:1.1em;" onclick="renameDraw(${d.id})">${d.name}</strong>
                </div>
                <button class="btn-del" onclick="deleteDraw(${d.id})">✕</button>
            </div>
            <div id="stats-${d.id}" style="font-size:12px; margin:5px 0; color:#eee; background:#222; padding:6px; border-radius:3px;">${d.statsHtml || ''}</div>
            <button onclick="toggleEditMode(${d.id})" style="width:100%; background:${d.isEditing?'#27ae60':'#7f8c8d'}; color:#fff; border:none; padding:5px; cursor:pointer; border-radius:3px; font-weight:bold;">
                ${d.isEditing ? '✅ Fin édition' : '✏️ Éditer les points'}
            </button>
            ${editorHtml}${btns}
        </div>`;
    });
}

// Édition Live
window.toggleEditMode = (id, isProj = false, pid = null) => {
    let d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id); if(!d) return; 
    d.isEditing = !d.isEditing; if(!d.editGroup) d.editGroup = L.layerGroup().addTo(map);
    if(d.isEditing) { makeEditable(d, isProj, pid); } else { d.editGroup.clearLayers(); window.currentEditingFeature = null; }
    isProj ? updateProjectUI() : updateDrawUI();
};

function makeEditable(d, isProj, pid) {
    d.editGroup.clearLayers(); if (d.type === 'circle') return; 
    window.currentEditingFeature = { d, isProj, pid };
    d.ptsGPS.forEach((pt, idx) => {
        const icon = L.divIcon({ className: 'numbered-handle', html: `<div style="background:#e74c3c; color:white; border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; font-size:11px; font-weight:bold; border:2px solid white;">${idx + 1}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
        const m = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
        m.on('drag', (e) => {
            d.ptsGPS[idx].lat = e.latlng.lat; d.ptsGPS[idx].lng = e.latlng.lng; d.layer.setLatLngs(d.ptsGPS); 
            let distMsg = "";
            if (idx > 0) distMsg += `← ${map.distance(d.ptsGPS[idx-1], e.latlng).toFixed(1)}m `;
            if (idx < d.ptsGPS.length - 1) distMsg += `→ ${map.distance(e.latlng, d.ptsGPS[idx+1]).toFixed(1)}m`;
            if (d.type === 'area' && (idx === 0 || idx === d.ptsGPS.length - 1)) { distMsg += ` (Fermeture: ${map.distance(d.ptsGPS[0], d.ptsGPS[d.ptsGPS.length-1]).toFixed(1)}m)`; }
            if (distMsg !== "") m.bindTooltip(distMsg, {permanent: true, direction: 'top', offset: [0, -10]}).openTooltip();

            recalculateStats(d); if(d.type==='line') generateProfile(d);
            const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
            const elX = document.getElementById(`edit-x-${d.id}-${idx}`); if(elX) elX.value = l93[0].toFixed(2);
            const elY = document.getElementById(`edit-y-${d.id}-${idx}`); if(elY) elY.value = l93[1].toFixed(2);
        });
        m.on('dragend', () => { m.unbindTooltip(); if(isProj) updateProjectUI(); else updateDrawUI(); });
    });
}

window.applyPointEdits = (id, isProj = false) => {
    let d = isProj ? window.currentEditingFeature.d : drawStore.find(x=>x.id===id); if(!d) return;
    d.ptsGPS.forEach((pt, i) => {
        const x = parseFloat(document.getElementById(`edit-x-${id}-${i}`).value), y = parseFloat(document.getElementById(`edit-y-${id}-${i}`).value), z = document.getElementById(`edit-z-${id}-${i}`).value;
        if(!isNaN(x) && !isNaN(y)) { const g = proj4("EPSG:2154", "EPSG:4326", [x, y]); pt.lat = g[1]; pt.lng = g[0]; }
        if(z.trim() !== '') pt.customZ = parseFloat(z); else delete pt.customZ;
    });
    if(d.type !== 'circle') d.layer.setLatLngs(d.ptsGPS);
    recalculateStats(d); if(d.isEditing) makeEditable(d, isProj); if(d.type==='line') generateProfile(d);
};

window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); if(d.editGroup) map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); };
window.renameDraw = (id) => { const d = drawStore.find(x => x.id === id); const n = prompt("Nom :", d.name); if(n){d.name=n; updateDrawUI();} };
window.toggleDraw = (id) => { const d = drawStore.find(x => x.id === id); d.visible = !d.visible; if(d.visible) { d.layer.addTo(map); if(d.isEditing) makeEditable(d); } else { map.removeLayer(d.layer); if(d.editGroup) d.editGroup.clearLayers(); } };
window.changeColor = (id, color) => { const d = drawStore.find(x => x.id === id); d.color = color; d.layer.setStyle({color}); updateDrawUI(); };

// ==========================================
// 6. CALCULS DE VOLUMES
// ==========================================
window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id); 
    if (mntStore.filter(m=>m.visible).length === 0) return alert("Veuillez activer un MNT.");
    
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    l93.forEach(p => { minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
    let border = []; l93.forEach((p, i) => { let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(p); if(z !== null) border.push({x:p[0], y:p[1], z}); });
    if((type==='slope'||type==='plane') && border.length < 3) return alert("Pas assez de points avec altitude.");

    let refZ = 0;
    if(type==='hollow'||type==='mound') {
        let sZ = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : getZ(l93[0]);
        let pr = prompt("Altitude de référence (m) ?", sZ ? Math.round(sZ) : 0); if(!pr) return; refZ = parseFloat(pr.replace(',', '.')); if (isNaN(refZ)) return;
    }

    setTimeout(() => {
        let tTas = 0, tCreux = 0, step = 1; let aR=0, bR=0, cR=0;
        if (type==='plane') {
            let sX=0, sY=0, sZ=0; border.forEach(p=>{sX+=p.x; sY+=p.y; sZ+=p.z;});
            const n=border.length, cX=sX/n, cY=sY/n, cZ=sZ/n;
            let sXX=0, sYY=0, sXY=0, sXZ=0, sYZ=0;
            border.forEach(p=>{ const dX=p.x-cX, dY=p.y-cY, dZ=p.z-cZ; sXX+=dX*dX; sYY+=dY*dY; sXY+=dX*dY; sXZ+=dX*dZ; sYZ+=dY*dZ; });
            const D = sXX*sYY - sXY*sXY; if(D!==0) { aR=(sXZ*sYY - sYZ*sXY)/D; bR=(sYZ*sXX - sXZ*sXY)/D; } 
            cR = cZ - aR*cX - bR*cY;
        }

        for (let x = minX; x <= maxX; x += step) {
            for (let y = minY; y <= maxY; y += step) {
                if (isPointInPolygon([x, y], l93)) {
                    let zM = getZ([x, y]); if(zM === null) continue;
                    let zB = 0;
                    if (type==='slope') {
                        let sZ=0, sW=0, ex=false;
                        for(let b of border) { let d2=(x-b.x)**2+(y-b.y)**2; if(d2===0) { zB=b.z; ex=true; break; } let w=1/d2; sZ+=b.z*w; sW+=w; }
                        if(!ex) zB = sZ/sW;
                    } else if(type==='plane') { zB = aR*x + bR*y + cR; } else { zB = refZ; }
                    
                    if(zM > zB) tTas += (zM - zB); else if(zM < zB) tCreux += (zB - zM);
                }
            }
        }
        
        d.tas = tTas; d.creux = tCreux;
        const lbl = type==='plane' ? 'Plan' : (type==='slope' ? 'Courbe' : `${refZ}m`);
        d.volumeHtml = `<div style="background:#2c3e50; padding:5px; border-radius:3px; margin-top:5px; border-left:3px solid #f1c40f;"><b>Cubature (${lbl})</b><br>📉 Déblai: <b style="color:#3498db">${tCreux.toFixed(1)} m³</b> | 📈 Remblai: <b style="color:#e67e22">${tTas.toFixed(1)} m³</b></div>`;
        recalculateStats(d); updateDrawUI(); updateProjectUI();
    }, 50);
};

// ==========================================
// 7. VUE 3D PARFAITE (LIGNES + SUIVI)
// ==========================================
window.generate3DView = (id) => {
    const d = drawStore.find(x => x.id === id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id); 
    if(!d || d.type === 'line') return alert("Dessinez une surface pour la 3D.");
    if (mntStore.filter(m=>m.visible).length === 0) return alert("Activez un MNT !");
    
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let border = []; 
    l93.forEach((p, idx) => { let z = d.ptsGPS[idx].customZ !== undefined ? d.ptsGPS[idx].customZ : getZ(p); if (z !== null) border.push({ x: p[0], y: p[1], z: z, i: idx+1 }); });
    if(border.length === 0) return alert("Zone hors MNT.");

    document.getElementById('window-3d').style.display = 'block';
    document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Génération de la 3D... ⏳</h3>';
    
    // Titre Volume dans la 3D
    const volText = d.volumeHtml ? `<span style="font-size:0.8em;">(Tas: ${d.tas.toFixed(1)}m³ / Creux: ${d.creux.toFixed(1)}m³)</span>` : '';
    document.getElementById('hover-3d-result').innerHTML = volText;

    setTimeout(() => {
        try {
            let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
            l93.forEach(p=>{minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]);});
            
            // Élargissement sécuritaire de la grille
            minX -= 5; maxX += 5; minY -= 5; maxY += 5;
            const step = Math.max(0.5, Math.max((maxX - minX)/40, (maxY - minY)/40));

            let sX=0, sY=0, sZ=0; border.forEach(p=>{sX+=p.x;sY+=p.y;sZ+=p.z;}); 
            const n=border.length, cX=sX/n, cY=sY/n, cZ=sZ/n;
            let sXX=0, sYY=0, sXY=0, sXZ=0, sYZ=0; 
            border.forEach(p=>{const dx=p.x-cX, dy=p.y-cY, dz=p.z-cZ; sXX+=dx*dx; sYY+=dy*dy; sXY+=dx*dy; sXZ+=dx*dz; sYZ+=dy*dz;});
            const D = sXX*sYY - sXY*sXY; let aR=0, bR=0; if(D!==0){aR=(sXZ*sYY-sYZ*sXY)/D; bR=(sYZ*sXX-sXZ*sXY)/D;} const cR = cZ - aR*cX - bR*cY;

            let xV = []; for (let x = minX; x <= maxX + step; x += step) xV.push(x);
            let yV = []; for (let y = minY; y <= maxY + step; y += step) yV.push(y);

            let zT=[], zB=[]; 
            for (let j = 0; j < yV.length; j++) {
                let rT=[], rB=[]; let y = yV[j];
                for (let i = 0; i < xV.length; i++) {
                    let x = xV[i];
                    if (isPointInPolygon([x, y], l93)) { rT.push(getZ([x, y])); rB.push(aR*x + bR*y + cR); } 
                    else { rT.push(null); rB.push(null); }
                } zT.push(rT); zB.push(rB);
            }
            window.current3DData = {x: xV, y: yV, zTop: zT};

            // Ligne jaune continue autour du polygone
            const bX = [...border.map(p=>p.x), border[0].x]; const bY = [...border.map(p=>p.y), border[0].y]; const bZ = [...border.map(p=>p.z), border[0].z];

            Plotly.newPlot('plot-3d', [
                {z:zT, x:xV, y:yV, type:'surface', name:'Terrain', colorscale:'Earth', showlegend:true},
                {z:zB, x:xV, y:yV, type:'surface', name:'Plan Base', colorscale:'Purples', opacity:0.7, showlegend:true, visible:'legendonly'},
                {x: bX, y: bY, z: bZ, mode: 'lines+markers+text', type: 'scatter3d', name: 'Contour/Points', text: [...border.map(p=>p.i), ''], textposition: 'top center', line: {color:'#f1c40f', width:5}, marker: { color: '#e74c3c', size: 6 }, showlegend:true}
            ], { margin:{l:0,r:0,b:0,t:0}, scene:{aspectmode:'data'}, paper_bgcolor:'#222', font:{color:'#fff'}, legend:{orientation:'h', x:0.5, y:0.05, xanchor:'center', bgcolor:'rgba(0,0,0,0)'} }, {displayModeBar:false}).then(() => {
                const plotDiv = document.getElementById('plot-3d');
                plotDiv.on('plotly_hover', (data) => {
                    if(data.points.length > 0){
                        const p = data.points[0]; const g = proj4("EPSG:2154","EPSG:4326",[p.x,p.y]);
                        if(!cursorMarker) cursorMarker = L.circleMarker([g[1],g[0]], {radius:6, color:'red', fillOpacity:1}).addTo(map); else cursorMarker.setLatLng([g[1],g[0]]);
                    }
                });
                plotDiv.addEventListener('mouseleave', () => { if(cursorMarker) map.removeLayer(cursorMarker); });
            });
        } catch (err) { document.getElementById('plot-3d').innerHTML = `<h3 style="color:#e74c3c; text-align:center; margin-top:20%;">Erreur mathématique 3D</h3>`; }
    }, 100);
};

window.exportSTL = () => {
    if (!window.current3DData) return alert("Affichez la 3D d'abord.");
    let stl = "solid terrain\n"; const {x, y, zTop} = window.current3DData;
    let minX=Infinity, minY=Infinity, minZ=Infinity;
    for(let i=0; i<y.length; i++) for(let j=0; j<x.length; j++) { let z=zTop[i][j]; if(z!==null){ minX=Math.min(minX,x[j]); minY=Math.min(minY,y[i]); minZ=Math.min(minZ,z); } }
    const addF = (v1, v2, v3) => { stl += `facet normal 0 0 0\n outer loop\n vertex ${(v1[0]-minX).toFixed(3)} ${(v1[1]-minY).toFixed(3)} ${(v1[2]-minZ).toFixed(3)}\n vertex ${(v2[0]-minX).toFixed(3)} ${(v2[1]-minY).toFixed(3)} ${(v2[2]-minZ).toFixed(3)}\n vertex ${(v3[0]-minX).toFixed(3)} ${(v3[1]-minY).toFixed(3)} ${(v3[2]-minZ).toFixed(3)}\n endloop\nendfacet\n`; };
    for (let i=0; i<y.length-1; i++) for (let j=0; j<x.length-1; j++) {
        const z1=zTop[i][j], z2=zTop[i][j+1], z3=zTop[i+1][j], z4=zTop[i+1][j+1];
        if(z1!==null&&z2!==null&&z3!==null&&z4!==null) { addF([x[j],y[i],z1], [x[j+1],y[i],z2], [x[j],y[i+1],z3]); addF([x[j+1],y[i],z2], [x[j+1],y[i+1],z4], [x[j],y[i+1],z3]); }
    } stl += "endsolid terrain\n";
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([stl], {type:'text/plain'})); a.download='terrain.stl'; a.style.display='none'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
};
window.close3DWindow = () => { document.getElementById('window-3d').style.display='none'; if(cursorMarker) map.removeLayer(cursorMarker); };

// ==========================================
// 8. PROFIL ALTIMÉTRIQUE AVEC CURSEURS
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; generateProfile(drawStore.find(x=>x.id===id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id)); };

function generateProfile(d) {
    if(!d) return; document.getElementById('profile-window').style.display='block';
    const ctx = document.getElementById('profileChart').getContext('2d');
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    
    let data=[], geo=[], dist=0;
    let zStart = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0])||0);
    data.push({x: 0, y: parseFloat(zStart.toFixed(2))}); geo.push(d.ptsGPS[0]);
    
    for(let i=1; i<l93.length; i++) {
        const dSeg = Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        for(let j=1; j<dSeg; j+=1) {
            const t = j/dSeg; const x = l93[i-1][0]+(l93[i][0]-l93[i-1][0])*t, y = l93[i-1][1]+(l93[i][1]-l93[i-1][1])*t;
            data.push({x: Math.round(dist+j), y: parseFloat((getZ([x,y])||0).toFixed(2))}); geo.push(proj4("EPSG:2154","EPSG:4326",[x,y]));
        }
        dist += dSeg; let zEnd = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : (getZ(l93[i])||0);
        data.push({x: Math.round(dist), y: parseFloat(zEnd.toFixed(2))}); geo.push(d.ptsGPS[i]);
    }
    
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type:'line', data:{datasets:[{label:'Altitude Z (m)', data, borderColor:d.color, backgroundColor:d.color+'33', fill:true, pointRadius:0, tension:0.1}]},
        options:{ 
            responsive:true, maintainAspectRatio:false, interaction:{mode:'index', intersect:false},
            plugins: { tooltip: { callbacks: { title: (c) => `Dist: ${c[0].parsed.x} m`, label: (c) => `Z: ${c.parsed.y.toFixed(2)} m` } } },
            scales: { x: { type: 'linear', title: {display:true, text:'Distance (m)'} } },
            onHover:(e,el)=>{
                if(el.length>0){ 
                    const p = geo[el[0].index]; 
                    if(!cursorMarker) cursorMarker=L.circleMarker([p.lat,p.lng],{radius:6,color:'red'}).addTo(map); else cursorMarker.setLatLng([p.lat,p.lng]); 
                }
            }
        }
    });
    
    // Initialisation des curseurs HTML (si existants)
    const minZ = Math.min(...data.map(pt=>pt.y)), maxZ = Math.max(...data.map(pt=>pt.y)), maxD = data[data.length-1].x;
    const sXMin=document.getElementById('x-min'), sXMax=document.getElementById('x-max'), sYMin=document.getElementById('y-min'), sYMax=document.getElementById('y-max');
    if(sXMin) { sXMin.max=maxD; sXMax.max=maxD; sXMin.value=0; sXMax.value=maxD; }
    if(sYMin) { sYMin.min=minZ-10; sYMin.max=maxZ+10; sYMax.min=minZ-10; sYMax.max=maxZ+10; sYMin.value=minZ-1; sYMax.value=maxZ+1; }
    window.updateScalesLive();

    document.getElementById('profileChart').onmouseleave = () => { if (cursorMarker) map.removeLayer(cursorMarker); };
}

window.updateScalesLive = () => {
    if (!chartInstance) return;
    const sXMin=document.getElementById('x-min'), sXMax=document.getElementById('x-max'), sYMin=document.getElementById('y-min'), sYMax=document.getElementById('y-max');
    if(!sXMin) return;
    const xMin = parseFloat(sXMin.value), xMax = parseFloat(sXMax.value), yMin = parseFloat(sYMin.value), yMax = parseFloat(sYMax.value);
    document.getElementById('x-vals').innerText = `${xMin}m - ${xMax}m`; document.getElementById('y-vals').innerText = `${yMin}m - ${yMax}m`;
    chartInstance.options.scales.x.min = xMin; chartInstance.options.scales.x.max = xMax;
    chartInstance.options.scales.y.min = yMin; chartInstance.options.scales.y.max = yMax;
    chartInstance.update('none');
};

window.exportChartPNG = () => { const a = document.createElement('a'); a.href = document.getElementById('profileChart').toDataURL('image/png'); a.download = 'profil.png'; a.click(); };
window.exportChartCSV = () => { let csv = "\ufeffDistance (m)\tAltitude Z (m)\n"; chartInstance.data.datasets[0].data.forEach(r => { csv += `${r.x}\t${r.y.toString().replace('.', ',')}\n`; }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = 'profil.csv'; a.click(); };

// ==========================================
// 9. SOURIS LIVE ET DRAG FENÊTRES
// ==========================================
map.on('mousemove', (e)=>{
    if (!e.latlng) return; const l = proj4("EPSG:4326","EPSG:2154",[e.latlng.lng, e.latlng.lat]);
    const elX=document.getElementById('cur-x'), elY=document.getElementById('cur-y'), elZ=document.getElementById('cur-z');
    if(elX) elX.innerText = l[0].toFixed(1); if(elY) elY.innerText = l[1].toFixed(1);
    if(elZ){ const z=getZ(l); elZ.innerText = z!==null?z.toFixed(2):'---'; }
    if(currentTool==='circle' && circleCenter && tempLayer) tempLayer.setRadius(map.distance(circleCenter, e.latlng));
});

function dragElement(winId, headerId) {
    const win = document.getElementById(winId), header = document.getElementById(headerId);
    let isDragging = false, offsetX = 0, offsetY = 0; if(!header) return;
    header.onmousedown = (e) => { if(e.target.tagName==='BUTTON')return; isDragging=true; const rect=win.getBoundingClientRect(); offsetX=e.clientX-rect.left; offsetY=e.clientY-rect.top; };
    document.addEventListener('mousemove', (e) => { if(isDragging) { win.style.left=Math.max(0, e.clientX-offsetX)+'px'; win.style.top=Math.max(0, e.clientY-offsetY)+'px'; }});
    document.addEventListener('mouseup', () => isDragging=false);
}
dragElement('window-3d', 'header-3d'); dragElement('profile-window', 'profile-header');

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

// Editeur HTML partagé
function generateEditorTable(d, isProj, pid) {
    if(!d.isEditing || d.type === 'circle') return '';
    let html = `<div style="background:#111; padding:5px; margin-top:5px; border-radius:3px; font-size:11px;">
        <div style="margin-bottom:5px; color:#3498db; text-align:center;"><b>📍 Coordonnées (L93)</b></div>
        <table style="width:100%; color:white; text-align:center;"><tr><th>Pt</th><th>X</th><th>Y</th><th>Z (m)</th></tr>`;
    d.ptsGPS.forEach((pt, i) => {
        const l = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]);
        let zAct = pt.customZ !== undefined ? pt.customZ : getZ(l);
        let zVal = pt.customZ !== undefined ? pt.customZ.toFixed(2) : '';
        let zPlc = zAct !== null ? zAct.toFixed(2) : 'Auto';
        
        html += `<tr><td style="color:#e74c3c; font-weight:bold;">${i+1}</td>
            <td><input id="edit-x-${d.id}-${i}" value="${l[0].toFixed(2)}" oninput="applyPointEdits(${d.id}, ${isProj})" style="width:65px; background:#222; color:#fff; border:1px solid #555;"></td>
            <td><input id="edit-y-${d.id}-${i}" value="${l[1].toFixed(2)}" oninput="applyPointEdits(${d.id}, ${isProj})" style="width:65px; background:#222; color:#fff; border:1px solid #555;"></td>
            <td><input id="edit-z-${d.id}-${i}" value="${zVal}" placeholder="${zPlc}" onchange="applyPointEdits(${d.id}, ${isProj})" style="width:45px; background:#2980b9; color:#fff; border:1px solid #555;"></td>
        </tr>`;
    });
    return html + `</table></div>`;
}

function updateProjectUI() {
    const list = document.getElementById('project-list'); if(!list) return; list.innerHTML = '';
    projectStore.forEach(p => {
        let fHtml = ''; 
        p.features.forEach(f => {
            const btns = f.type==='line' ? 
                `<button onclick="generateProfileById(${f.id})" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #555; padding:5px; cursor:pointer;">📈 Afficher Profil Altimétrique</button>` : 
                `<div style="display:flex; gap:3px; margin-top:5px; flex-wrap:wrap;">
                    <button onclick="calculateVolume(${f.id}, 'hollow')" style="flex:1; font-size:0.7em; background:#2980b9; color:#fff; border:none; cursor:pointer; padding:4px;">📉 Déblai</button>
                    <button onclick="calculateVolume(${f.id}, 'mound')" style="flex:1; font-size:0.7em; background:#e67e22; color:#fff; border:none; cursor:pointer; padding:4px;">📈 Remblai</button>
                    <button onclick="calculateVolume(${f.id}, 'slope')" style="flex:1; font-size:0.7em; background:#8e44ad; color:#fff; border:none; cursor:pointer; padding:4px;">📐 Vol. Courbe</button>
                    <button onclick="calculateVolume(${f.id}, 'plane')" style="flex:1; font-size:0.7em; background:#9b59b6; color:#fff; border:none; cursor:pointer; padding:4px;">📏 Vol. Plan</button>
                    <button onclick="generate3DView(${f.id})" style="flex:1; min-width:100%; font-size:0.8em; font-weight:bold; background:#34495e; color:#fff; border:1px solid #555; cursor:pointer; padding:5px; margin-top:2px;">👁️ Lancer Vue 3D</button>
                </div>`;
                
            fHtml += `<div style="margin-left:5px; border-left:3px solid ${f.color}; padding:5px; background:#1a1a1a; margin-top:5px;">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div><input type="checkbox" checked onchange="toggleProjectFeature(${p.id}, ${f.id})"> <strong style="margin-left:5px;">${f.name}</strong></div>
                    <button onclick="deleteProjectFeature(${p.id}, ${f.id})" style="background:transparent; color:#e74c3c; border:none; cursor:pointer;">✕</button>
                </div>
                <div id="stats-proj-${f.id}" style="font-size:11px; margin:5px 0; color:#ddd; background:#222; padding:4px;">${f.statsHtml || ''}</div>
                <button onclick="toggleEditMode(${f.id}, true, ${p.id})" style="width:100%; background:${f.isEditing?'#27ae60':'#7f8c8d'}; color:#fff; border:none; padding:4px; cursor:pointer; margin-bottom:5px;">${f.isEditing?'✅ Fin édition':'✏️ Modifier les points'}</button>
                ${generateEditorTable(f, true, p.id)}
                ${btns}
            </div>`;
        });
        list.innerHTML += `<div class="card">
            <div class="card-header">
                <div><input type="checkbox" ${p.visible ? 'checked' : ''} onchange="toggleProject(${p.id})"><strong style="color:#3498db; font-size:1.1em;">📁 ${p.name}</strong></div>
                <button class="btn-del" onclick="deleteProject(${p.id})">✕</button>
            </div>
            <details open style="margin-top: 8px;"><summary style="font-size: 0.85em; color: #aaa; cursor:pointer;">Ouvrir/Fermer les calques</summary>${fHtml}</details>
        </div>`;
    });
}
window.toggleProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.visible = !p.visible; p.features.forEach(f => { f.visible = p.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } }); updateProjectUI(); };
window.deleteProject = (pid) => { const p = projectStore.find(x => x.id === pid); p.features.forEach(f => { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); }); projectStore = projectStore.filter(x => x.id !== pid); updateProjectUI(); };
window.toggleProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); f.visible = !f.visible; if (f.visible) { f.layer.addTo(map); if(f.isEditing) makeEditable(f, true, p.id); } else { map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); } updateProjectUI(); };
window.deleteProjectFeature = (pid, fid) => { const p = projectStore.find(x => x.id === pid); const f = p.features.find(x => x.id === fid); map.removeLayer(f.layer); if(f.editGroup) f.editGroup.clearLayers(); p.features = p.features.filter(x => x.id !== fid); updateProjectUI(); };
