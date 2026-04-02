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
    const select = document.getElementById('mnt-select');
    const url = select.value; if (!url) return alert("Sélectionnez un MNT.");
    const btn = document.querySelector('button[onclick="loadRemoteMNT()"]');
    const oldText = btn.innerText; btn.innerText = "⏳..."; btn.disabled = true;
    try {
        const response = await fetch(url); const buffer = await response.arrayBuffer();
        const tiff = await GeoTIFF.fromArrayBuffer(buffer); const image = await tiff.getImage();
        const bbox = image.getBoundingBox(); const raster = await image.readRasters();
        const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]), ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
        const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.15 }).addTo(map);
        mntStore.push({ id: Date.now(), name: select.options[select.selectedIndex].text, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2" });
        map.fitBounds(visual.getBounds()); updateMntUI();
    } catch(e) { alert("Erreur MNT"); } finally { btn.innerText = oldText; btn.disabled = false; }
};

document.getElementById('mnt-input').onchange = async (e) => {
    for (const file of e.target.files) {
        if (!file.name.match(/\.(tif|tiff)$/i)) continue;
        try {
            const buffer = await file.arrayBuffer(); const tiff = await GeoTIFF.fromArrayBuffer(buffer);
            const image = await tiff.getImage(); const bbox = image.getBoundingBox(); const raster = await image.readRasters();
            const sw = proj4("EPSG:2154", "EPSG:4326", [bbox[0], bbox[1]]), ne = proj4("EPSG:2154", "EPSG:4326", [bbox[2], bbox[3]]);
            const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: "#00d1b2", weight: 2, fillOpacity: 0.15 }).addTo(map);
            mntStore.push({ id: Date.now(), name: file.name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: "#00d1b2" });
            map.fitBounds(visual.getBounds());
        } catch(err) {}
    } updateMntUI();
};

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

function updateMntUI() {
    const list = document.getElementById('mnt-list'); if (!list) return; list.innerHTML = '';
    mntStore.forEach(m => { list.innerHTML += `<div class="card"><div class="card-header"><div><input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMNT(${m.id})"> <b>⛰️ ${m.name}</b></div><button class="btn-del" onclick="deleteMNT(${m.id})">✕</button></div></div>`; });
}
window.toggleMNT = (id) => { const m = mntStore.find(x => x.id === id); m.visible = !m.visible; if (m.visible) m.visual.addTo(map); else map.removeLayer(m.visual); };
window.deleteMNT = (id) => { const m = mntStore.find(x => x.id === id); map.removeLayer(m.visual); mntStore = mntStore.filter(x => x.id !== id); updateMntUI(); };

// ==========================================
// 3. CHARGEMENT DES KMZ/GEOJSON (STATIC)
// ==========================================
window.addEventListener('load', () => {
    try {
        if (typeof pistesData !== 'undefined' && pistesData.features) {
            const pistesLayer = L.geoJSON(pistesData, { style: { color: '#ffffff', weight: 2, opacity: 0.8 } }).addTo(map);
            kmzStore.push({ id: "pistes", name: "Pistes (Domaine)", layer: pistesLayer, visible: true, color: '#ffffff' });
            if (mntStore.length === 0) map.fitBounds(pistesLayer.getBounds());
        }
        if (typeof canonData !== 'undefined' && canonData.features) {
            const canonLayer = L.geoJSON(canonData, { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 5, fillColor: '#3498db', color: '#fff', weight: 1, fillOpacity: 0.9 }) }).addTo(map);
            kmzStore.push({ id: "canons", name: "Canons à neige", layer: canonLayer, visible: true, color: '#3498db' });
        }
        updateKmzUI();
    } catch (e) { console.error("Erreur chargement KMZ:", e); }
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
    const drawObj = { id: Date.now(), type, name: type==='area'?'Surface':'Tracé', ptsGPS: [...currentPoints], visible: true, color, weight: 4, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = type === 'area' ? L.polygon(currentPoints, {color, weight: 3, fillOpacity: 0.3}).addTo(map) : L.polyline(currentPoints, {color, weight: 4}).addTo(map);
    drawStore.push(drawObj); recalculateStats(drawObj); updateDrawUI();
    if(type === 'line') generateProfile(drawObj);
    currentTool = null; currentPoints = []; if(tempLayer) map.removeLayer(tempLayer);
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active')); document.getElementById('btn-finish').style.display = 'none';
};

window.finalizeCircle = (center, radius) => {
    const drawObj = { id: Date.now(), type: 'circle', name: 'Cercle', center, radius, visible: true, color: '#9b59b6', weight: 3, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = L.circle(center, {radius, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map);
    drawObj.ptsGPS = generateCirclePoints(center, radius);
    drawStore.push(drawObj); recalculateStats(drawObj); updateDrawUI(); 
    currentTool = null; document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
};

function generateCirclePoints(center, radius) {
    const pts = []; const cL93 = proj4("EPSG:4326", "EPSG:2154", [center.lng, center.lat]);
    for (let i=0; i<64; i++) { const a = (i*2*Math.PI)/64; const g = proj4("EPSG:2154", "EPSG:4326", [cL93[0]+radius*Math.cos(a), cL93[1]+radius*Math.sin(a)]); pts.push({lat: g[1], lng: g[0]}); }
    return pts;
}

// ==========================================
// 5. ÉDITION XYZ ET UI DU MENU
// ==========================================
window.toggleEditMode = (id, isProj = false, pid = null) => {
    let d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id);
    if(!d) return; d.isEditing = !d.isEditing;
    if(!d.editGroup) d.editGroup = L.layerGroup().addTo(map);
    if(d.isEditing) { makeEditable(d, isProj, pid); if(d.type!=='circle') openPointEditor(id, isProj, pid); } 
    else { d.editGroup.clearLayers(); document.getElementById('point-editor-window').style.display='none'; window.currentEditingFeature = null; }
    isProj ? updateProjectUI() : updateDrawUI();
};

function makeEditable(d, isProj, pid) {
    d.editGroup.clearLayers(); const icon = L.divIcon({ className: 'edit-handle', iconSize: [12, 12] });
    d.ptsGPS.forEach((pt, idx) => {
        const m = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
        m.on('drag', (e) => {
            d.ptsGPS[idx].lat = e.latlng.lat; d.ptsGPS[idx].lng = e.latlng.lng; 
            d.layer.setLatLngs(d.ptsGPS); recalculateStats(d);
            if(d.type==='line') generateProfile(d);
            if (window.currentEditingFeature && window.currentEditingFeature.id === d.id) {
                const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
                const elX = document.getElementById(`edit-x-${idx}`); if(elX) elX.value = l93[0].toFixed(2);
                const elY = document.getElementById(`edit-y-${idx}`); if(elY) elY.value = l93[1].toFixed(2);
            }
        });
    });
}

window.openPointEditor = (id, isProj, pid) => {
    const d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id);
    window.currentEditingFeature = { d, id, isProj, pid };
    let h = '<table style="width:100%; color:white; font-size:11px; text-align:center;"><tr><th>Pt</th><th>X (L93)</th><th>Y (L93)</th><th>Z Forcé</th></tr>';
    d.ptsGPS.forEach((pt, i) => {
        const l = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]);
        h += `<tr><td>${i+1}</td><td><input id="edit-x-${i}" value="${l[0].toFixed(2)}" oninput="applyPointEdits(false)" style="width:90px; background:#222; color:#fff; border:1px solid #555;"></td><td><input id="edit-y-${i}" value="${l[1].toFixed(2)}" oninput="applyPointEdits(false)" style="width:90px; background:#222; color:#fff; border:1px solid #555;"></td><td><input id="edit-z-${i}" value="${pt.customZ||''}" placeholder="Auto" oninput="applyPointEdits(false)" style="width:70px; background:#2980b9; color:#fff; border:1px solid #555;"></td></tr>`;
    });
    document.getElementById('point-editor-content').innerHTML = h + '</table>';
    document.getElementById('point-editor-window').style.display = 'flex';
};

window.applyPointEdits = (close = true) => {
    if(!window.currentEditingFeature) return; const { d, isProj, pid } = window.currentEditingFeature;
    d.ptsGPS.forEach((pt, i) => {
        const x = parseFloat(document.getElementById(`edit-x-${i}`).value), y = parseFloat(document.getElementById(`edit-y-${i}`).value), z = document.getElementById(`edit-z-${i}`).value;
        if(!isNaN(x) && !isNaN(y)) { const g = proj4("EPSG:2154", "EPSG:4326", [x, y]); pt.lat = g[1]; pt.lng = g[0]; }
        if(z.trim() !== '') pt.customZ = parseFloat(z); else delete pt.customZ;
    });
    if(d.type !== 'circle') d.layer.setLatLngs(d.ptsGPS);
    recalculateStats(d); if(d.isEditing && !close) makeEditable(d, isProj, pid);
    if(d.type==='line') generateProfile(d);
    if(close) { document.getElementById('point-editor-window').style.display='none'; window.currentEditingFeature=null; }
};

function recalculateStats(d) {
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    if(d.type==='circle') {
        const a = Math.PI * d.radius**2; d.statsHtml = `Diam: <b>${(2*d.radius).toFixed(1)} m</b> | Aire: <b>${a.toFixed(1)} m²</b>`;
    } else if(d.type==='line') {
        let dist=0; for(let i=1; i<l93.length; i++) dist+=Math.hypot(l93[i][0]-l93[i-1][0],l93[i][1]-l93[i-1][1]);
        const z1 = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0]) || 0); 
        const z2 = d.ptsGPS[l93.length-1].customZ !== undefined ? d.ptsGPS[l93.length-1].customZ : (getZ(l93[l93.length-1]) || 0); 
        d.totalDist = dist; d.statsHtml = `L: <b>${dist.toFixed(1)} m</b> | ΔZ: <b>${Math.abs(z2-z1).toFixed(1)} m</b>`;
    } else {
        let area = 0; for (let i = 0; i < l93.length; i++) { let j = (i+1) % l93.length; area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; }
        d.statsHtml = `Aire: <b>${(Math.abs(area)/2).toFixed(1)} m²</b>`;
    }
    const st = document.getElementById(`stats-${d.id}`); if(st) st.innerHTML = d.statsHtml;
}

function updateDrawUI() {
    const list = document.getElementById('measure-list'); if(!list) return; list.innerHTML = '';
    drawStore.forEach(d => {
        let btns = d.type==='line' ? `<button onclick="generateProfileById(${d.id})" style="width:100%; margin-top:5px; background:#333; color:#fff; border:1px solid #555; padding:4px; cursor:pointer;">📈 Afficher profil</button>` : 
        `<div style="display:flex; gap:3px; margin-top:5px; flex-wrap:wrap;">
            <button onclick="calculateVolume(${d.id}, 'hollow')" style="flex:1; font-size:0.7em; background:#2980b9; color:#fff; border:none; cursor:pointer; padding:3px;">💧 Creux</button>
            <button onclick="calculateVolume(${d.id}, 'mound')" style="flex:1; font-size:0.7em; background:#e67e22; color:#fff; border:none; cursor:pointer; padding:3px;">⛰️ Tas</button>
            <button onclick="calculateVolume(${d.id}, 'slope')" style="flex:1; font-size:0.7em; background:#8e44ad; color:#fff; border:none; cursor:pointer; padding:3px;">📐 Courbe</button>
            <button onclick="calculateVolume(${d.id}, 'plane')" style="flex:1; font-size:0.7em; background:#9b59b6; color:#fff; border:none; cursor:pointer; padding:3px;">📏 Plan</button>
            <button onclick="generate3DView(${d.id})" style="flex:1; min-width:100%; font-size:0.75em; background:#34495e; color:#fff; border:none; cursor:pointer; padding:4px; margin-top:2px;">👁️ Vue 3D</button>
        </div>`;
        list.innerHTML += `<div class="card" style="border-left:4px solid ${d.color}">
            <div class="card-header"><div style="display:flex; align-items:center;"><input type="checkbox" checked onchange="toggleDraw(${d.id})"> <input type="color" class="color-picker" value="${d.color}" onchange="changeColor(${d.id}, this.value)"> <strong style="cursor:pointer;" onclick="renameDraw(${d.id})">${d.name}</strong></div><button class="btn-del" onclick="deleteDraw(${d.id})">✕</button></div>
            <div id="stats-${d.id}" style="font-size:11px; margin:5px 0; color:#ddd;">${d.statsHtml||''}</div>
            <button onclick="toggleEditMode(${d.id})" style="width:100%; background:${d.isEditing?'#27ae60':'#7f8c8d'}; color:#fff; border:none; padding:3px; cursor:pointer; border-radius:2px;">${d.isEditing?'✅ Fin édition':'✏️ Éditer'}</button>${btns}</div>`;
    });
}

window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); if(d.editGroup) map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); };
window.renameDraw = (id) => { const d = drawStore.find(x => x.id === id); const n = prompt("Nom :", d.name); if(n){d.name=n; updateDrawUI();} };
window.toggleDraw = (id) => { const d = drawStore.find(x => x.id === id); d.visible = !d.visible; if(d.visible) d.layer.addTo(map); else map.removeLayer(d.layer); };
window.changeColor = (id, color) => { const d = drawStore.find(x => x.id === id); d.color = color; d.layer.setStyle({color}); updateDrawUI(); };

// ==========================================
// 6. CALCULS DE VOLUMES
// ==========================================
window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id); if (mntStore.filter(m=>m.visible).length===0) return alert("Activez un MNT");
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    l93.forEach(p => { minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
    
    let border = []; l93.forEach((p, i) => { let z = d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : getZ(p); if(z !== null) border.push({x:p[0], y:p[1], z}); });
    if((type==='slope'||type==='plane') && border.length < 3) return alert("Pas assez de points avec altitude.");

    let refZ = 0;
    if(type==='hollow'||type==='mound') {
        let sZ = d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : getZ(l93[0]);
        let pr = prompt("Altitude de référence (m) ?", sZ?Math.round(sZ):0); if(!pr) return; refZ = parseFloat(pr);
    }

    let tTas = 0, tCreux = 0, step = 1;
    let aR=0, bR=0, cR=0;
    if(type==='plane'){
        let sX=0, sY=0, sZ=0; border.forEach(p=>{sX+=p.x; sY+=p.y; sZ+=p.z;});
        const n=border.length, cX=sX/n, cY=sY/n, cZ=sZ/n;
        let sXX=0, sYY=0, sXY=0, sXZ=0, sYZ=0;
        border.forEach(p=>{ const dX=p.x-cX, dY=p.y-cY, dZ=p.z-cZ; sXX+=dX*dX; sYY+=dY*dY; sXY+=dX*dY; sXZ+=dX*dZ; sYZ+=dY*dZ; });
        const D = sXX*sYY - sXY*sXY; if(D!==0){ aR=(sXZ*sYY - sYZ*sXY)/D; bR=(sYZ*sXX - sXZ*sXY)/D; } cR = cZ - aR*cX - bR*cY;
    }

    for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
            if (isPointInPolygon([x, y], l93)) {
                let zM = getZ([x, y]); if(zM === null) continue;
                let zB = 0;
                if(type==='slope'){
                    let sZ=0, sW=0, ex=false;
                    for(let b of border){ let d2=(x-b.x)**2+(y-b.y)**2; if(d2===0){zB=b.z; ex=true; break;} let w=1/d2; sZ+=b.z*w; sW+=w; }
                    if(!ex) zB = sZ/sW;
                } else if(type==='plane'){ zB = aR*x + bR*y + cR; } else { zB = refZ; }
                
                if(zM > zB) tTas += (zM - zB); else if(zM < zB) tCreux += (zB - zM);
            }
        }
    }
    alert(`Bilan des volumes :\n\n⛰️ Tas : ${tTas.toFixed(1)} m³\n💧 Creux : ${tCreux.toFixed(1)} m³`);
};

function isPointInPolygon(p, vs) {
    let x=p[0], y=p[1], inside=false;
    for(let i=0, j=vs.length-1; i<vs.length; j=i++) {
        let xi=vs[i][0], yi=vs[i][1], xj=vs[j][0], yj=vs[j][1];
        if(((yi>y) != (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
    } return inside;
}

// ==========================================
// 7. VUE 3D ET EXPORT STL
// ==========================================
window.generate3DView = (id) => {
    const d = drawStore.find(x => x.id === id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id); if(!d || d.type === 'line') return;
    if (mntStore.filter(m=>m.visible).length === 0) return alert("Activez un MNT");
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let border = []; l93.forEach((p, idx) => { let z = d.ptsGPS[idx].customZ !== undefined ? d.ptsGPS[idx].customZ : getZ(p); if (z !== null) border.push({ x: p[0], y: p[1], z: z }); });
    if(border.length===0) return alert("Zone hors MNT.");

    document.getElementById('window-3d').style.display = 'block';
    document.getElementById('plot-3d').innerHTML = '<h3 style="color:white; text-align:center; margin-top:20%;">Calcul en cours... ⏳</h3>';
    
    setTimeout(() => {
        let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
        l93.forEach(p=>{minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]);});
        const step = Math.max(1, (maxX-minX)/40);
        let xV=[], yV=[], zT=[], zB=[]; 
        
        let sX=0, sY=0, sZ=0; border.forEach(p=>{sX+=p.x;sY+=p.y;sZ+=p.z;}); const n=border.length, cX=sX/n, cY=sY/n, cZ=sZ/n;
        let sXX=0, sYY=0, sXY=0, sXZ=0, sYZ=0; border.forEach(p=>{const dx=p.x-cX, dy=p.y-cY, dz=p.z-cZ; sXX+=dx*dx; sYY+=dy*dy; sXY+=dx*dy; sXZ+=dx*dz; sYZ+=dy*dz;});
        const D = sXX*sYY - sXY*sXY; let aR=0, bR=0; if(D!==0){aR=(sXZ*sYY-sYZ*sXY)/D; bR=(sYZ*sXX-sXZ*sXY)/D;} const cR = cZ - aR*cX - bR*cY;

        for(let x=minX; x<=maxX; x+=step) xV.push(x);
        for(let y=minY; y<=maxY; y+=step){
            let rT=[], rB=[]; yV.push(y);
            for(let x=minX; x<=maxX; x+=step){
                if(isPointInPolygon([x,y], l93)){ rT.push(getZ([x,y])); rB.push(aR*x + bR*y + cR); } 
                else { rT.push(null); rB.push(null); }
            } zT.push(rT); zB.push(rB);
        }
        window.current3DData = {x:xV, y:yV, zTop:zT};
        
        Plotly.newPlot('plot-3d', [
            {z:zT, x:xV, y:yV, type:'surface', name:'Terrain', colorscale:'Earth', showscale:false},
            {z:zB, x:xV, y:yV, type:'surface', name:'Plan Base', colorscale:'Purples', opacity:0.7, showscale:false}
        ], {margin:{l:0,r:0,b:30,t:0}, scene:{aspectmode:'data'}, paper_bgcolor:'#222', font:{color:'#fff'}, legend:{orientation:'h', y:-0.1}}, {displayModeBar:false}).then(()=>{
            document.getElementById('plot-3d').on('plotly_hover', (data)=>{
                if(data.points.length>0){
                    const p=data.points[0]; const g=proj4("EPSG:2154","EPSG:4326",[p.x,p.y]);
                    if(!cursorMarker) cursorMarker=L.circleMarker([g[1],g[0]],{radius:6,color:'red',fillOpacity:1}).addTo(map); else cursorMarker.setLatLng([g[1],g[0]]);
                    document.getElementById('hover-3d-result').innerHTML = `📍 Z: <span style="color:#fff">${p.z.toFixed(2)}m</span>`;
                }
            });
            document.getElementById('plot-3d').addEventListener('mouseleave', () => { if(cursorMarker) map.removeLayer(cursorMarker); });
        });
    }, 50);
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
// 8. PROFIL ALTIMÉTRIQUE
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; generateProfile(drawStore.find(x=>x.id===id) || projectStore.flatMap(p=>p.features).find(f=>f.id===id)); };
function generateProfile(d) {
    if(!d) return; document.getElementById('profile-window').style.display='block';
    const ctx = document.getElementById('profileChart').getContext('2d');
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let data=[], geo=[], dist=0;
    data.push({x:0, y:d.ptsGPS[0].customZ !== undefined ? d.ptsGPS[0].customZ : (getZ(l93[0])||0)}); geo.push(d.ptsGPS[0]);
    for(let i=1; i<l93.length; i++){
        const dSeg = Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        for(let j=1; j<dSeg; j++){
            const t=j/dSeg; const x=l93[i-1][0]+(l93[i][0]-l93[i-1][0])*t, y=l93[i-1][1]+(l93[i][1]-l93[i-1][1])*t;
            data.push({x:dist+j, y:getZ([x,y])||0}); geo.push(proj4("EPSG:2154","EPSG:4326",[x,y]));
        }
        dist+=dSeg; data.push({x:dist, y:d.ptsGPS[i].customZ !== undefined ? d.ptsGPS[i].customZ : (getZ(l93[i])||0)}); geo.push(d.ptsGPS[i]);
    }
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type:'line', data:{datasets:[{label:'Altitude Z (m)', data, borderColor:d.color, backgroundColor:d.color+'33', fill:true, pointRadius:0}]},
        options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index', intersect:false}, onHover:(e,el)=>{
            if(el.length>0){ const p=geo[el[0].index]; if(!cursorMarker) cursorMarker=L.circleMarker([p.lat,p.lng],{radius:6,color:'red'}).addTo(map); else cursorMarker.setLatLng([p.lat,p.lng]); }
        }}
    });
    document.getElementById('profileChart').onmouseleave = () => { if (cursorMarker) map.removeLayer(cursorMarker); };
}

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
    let isDragging = false, offsetX = 0, offsetY = 0;
    if(!header) return;
    header.onmousedown = (e) => { if(e.target.tagName==='BUTTON')return; isDragging=true; const rect=win.getBoundingClientRect(); offsetX=e.clientX-rect.left; offsetY=e.clientY-rect.top; };
    document.addEventListener('mousemove', (e) => { if(isDragging) { win.style.left=Math.max(0, e.clientX-offsetX)+'px'; win.style.top=Math.max(0, e.clientY-offsetY)+'px'; }});
    document.addEventListener('mouseup', () => isDragging=false);
}
dragElement('window-3d', 'header-3d'); dragElement('profile-window', 'profile-header'); dragElement('point-editor-window', 'header-point-editor');

// ==========================================
// 10. SAUVEGARDE ET PROJETS (GOOGLE SHEETS)
// ==========================================
const SCRIPT_URL = "VOTRE_URL_GOOGLE_SCRIPT_ICI"; // <--- ⚠️ À REMPLIR

window.saveProject = async () => {
    const name = document.getElementById('project-name').value.trim(); if (!name || drawStore.length===0) return alert("Nom de projet et tracés requis.");
    const data = drawStore.map(d => ({ type:d.type, name:d.name, ptsGPS:d.ptsGPS, color:d.color, center:d.center, radius:d.radius }));
    const btn = document.querySelector('button[onclick="saveProject()"]'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ projectName: name, projectData: JSON.stringify(data) }) });
        const json = await res.json();
        if(json.status === "success") {
            projectStore.push({ id: Date.now(), name, visible: true, features: [...drawStore] });
            drawStore.forEach(d => { if(d.editGroup) map.removeLayer(d.editGroup); d.isEditing=false; });
            drawStore = []; updateDrawUI(); updateProjectUI(); alert("✅ Projet sauvegardé !");
        }
    } catch(e) { alert("Erreur Google Sheets"); } finally { btn.innerText = "Sauver"; btn.disabled = false; }
};

window.loadProject = async () => {
    const name = document.getElementById('project-name').value.trim(); if (!name) return;
    const btn = document.querySelector('button[onclick="loadProject()"]'); btn.innerText = "⏳"; btn.disabled = true;
    try {
        const res = await fetch(`${SCRIPT_URL}?projectName=${encodeURIComponent(name)}`);
        const json = await res.json(); if(json.status === "error") return alert("Introuvable !");
        const data = JSON.parse(json.data); const newProj = { id: Date.now(), name, visible: true, features: [] };
        data.forEach(d => {
            let layer;
            if(d.type==='circle') layer=L.circle(d.center, {radius:d.radius, color:d.color, weight:3}).addTo(map);
            else if(d.type==='area') layer=L.polygon(d.ptsGPS, {color:d.color, weight:3, fillOpacity:0.3}).addTo(map);
            else layer=L.polyline(d.ptsGPS, {color:d.color, weight:4}).addTo(map);
            newProj.features.push({ id: Date.now()+Math.random(), type:d.type, name:d.name, layer, ptsGPS:d.ptsGPS, center:d.center, radius:d.radius, color:d.color, visible:true, isEditing:false, editGroup:L.layerGroup().addTo(map) });
        });
        projectStore.push(newProj); updateProjectUI(); alert("✅ Projet chargé !");
    } catch(e) { alert("Erreur chargement"); } finally { btn.innerText = "Charger"; btn.disabled = false; }
};

function updateProjectUI() {
    const list = document.getElementById('project-list'); if(!list) return; list.innerHTML = '';
    projectStore.forEach(p => {
        let fHtml = ''; p.features.forEach(f => {
            const btn = f.type==='line'?`<button onclick="generateProfileById(${f.id})" style="font-size:0.7em; padding:2px;">📈 Profil</button>`:`<button onclick="generate3DView(${f.id})" style="font-size:0.7em; padding:2px;">👁️ 3D</button>`;
            fHtml += `<div style="margin-left:10px; border-left:3px solid ${f.color}; padding:3px;"><input type="checkbox" checked onchange="toggleProjectFeature(${p.id}, ${f.id})"> <span style="font-size:0.9em">${f.name}</span> <button onclick="toggleEditMode(${f.id}, true, ${p.id})" style="font-size:0.7em; padding:2px;">✏️</button> ${btn}</div>`;
        });
        list.innerHTML += `<div class="card"><b>📁 ${p.name}</b> <button onclick="deleteProject(${p.id})">✕</button><details><summary>Contenu</summary>${fHtml}</details></div>`;
    });
}
window.toggleProjectFeature = (pid, fid) => { const f=projectStore.find(p=>p.id===pid).features.find(x=>x.id===fid); f.visible=!f.visible; if(f.visible) f.layer.addTo(map); else map.removeLayer(f.layer); };
window.deleteProject = (pid) => { const p=projectStore.find(x=>x.id===pid); p.features.forEach(f=>map.removeLayer(f.layer)); projectStore=projectStore.filter(x=>x.id!==pid); updateProjectUI(); };
