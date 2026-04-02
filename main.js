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
// 3. OUTILS DE DESSIN ET CERCLES
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
        if (!circleCenter) { circleCenter = e.latlng; tempLayer = L.circle(circleCenter, {radius: 0, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map); }
        else { finalizeCircle(circleCenter, map.distance(circleCenter, e.latlng)); circleCenter = null; }
        return;
    }
    currentPoints.push({lat: e.latlng.lat, lng: e.latlng.lng}); if (tempLayer) map.removeLayer(tempLayer);
    const color = currentTool === 'area' ? '#e67e22' : '#3498db';
    tempLayer = currentTool === 'area' ? L.polygon(currentPoints, { color, weight: 3, fillOpacity: 0.3 }).addTo(map) : L.polyline(currentPoints, { color, weight: 4 }).addTo(map);
});

window.finalizeDraw = () => {
    if (currentPoints.length < 2) return;
    const type = currentTool; const color = type==='area'?'#e67e22':'#3498db';
    const drawObj = { id: Date.now(), type, name: type==='area'?'Surface':'Tracé', ptsGPS: [...currentPoints], visible: true, color, weight: 4, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = type === 'area' ? L.polygon(currentPoints, {color, weight: 3, fillOpacity: 0.3}).addTo(map) : L.polyline(currentPoints, {color, weight: 4}).addTo(map);
    drawStore.push(drawObj); recalculateStats(drawObj); updateDrawUI();
    currentTool = null; currentPoints = []; if(tempLayer) map.removeLayer(tempLayer);
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-finish').style.display = 'none';
};

window.finalizeCircle = (center, radius) => {
    const drawObj = { id: Date.now(), type: 'circle', name: 'Cercle', center, radius, visible: true, color: '#9b59b6', weight: 3, isEditing: false, editGroup: L.layerGroup().addTo(map) };
    drawObj.layer = L.circle(center, {radius, color: '#9b59b6', weight: 3, fillOpacity: 0.3}).addTo(map);
    drawObj.ptsGPS = generateCirclePoints(center, radius);
    drawStore.push(drawObj); recalculateStats(drawObj); updateDrawUI(); currentTool = null;
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
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
    if(d.isEditing) { 
        makeEditable(d, isProj, pid); 
        if(d.type!=='circle') openPointEditor(id, isProj, pid); 
    } else { 
        d.editGroup.clearLayers(); 
        if(window.currentEditingFeature && window.currentEditingFeature.id === id) {
            document.getElementById('point-editor-window').style.display='none';
            window.currentEditingFeature = null;
        }
    }
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
                document.getElementById(`edit-x-${idx}`).value = l93[0].toFixed(2);
                document.getElementById(`edit-y-${idx}`).value = l93[1].toFixed(2);
            }
        });
    });
}

window.openPointEditor = (id, isProj, pid) => {
    const d = isProj ? projectStore.find(p=>p.id===pid)?.features.find(f=>f.id===id) : drawStore.find(x=>x.id===id);
    window.currentEditingFeature = { d, id, isProj, pid };
    let h = '<table style="width:100%; color:white; border-collapse:collapse; font-size:11px;"><tr><th>Pt</th><th>X (L93)</th><th>Y (L93)</th><th>Z Forcé</th></tr>';
    d.ptsGPS.forEach((pt, i) => {
        const l = proj4("EPSG:4326", "EPSG:2154", [pt.lng, pt.lat]);
        h += `<tr style="border-bottom:1px solid #444;"><td>${i+1}</td><td><input id="edit-x-${i}" value="${l[0].toFixed(2)}" oninput="applyPointEdits(false)"></td><td><input id="edit-y-${i}" value="${l[1].toFixed(2)}" oninput="applyPointEdits(false)"></td><td><input id="edit-z-${i}" value="${pt.customZ||''}" placeholder="Auto" oninput="applyPointEdits(false)" style="background:#2980b9;"></td></tr>`;
    });
    document.getElementById('point-editor-content').innerHTML = h + '</table>';
    document.getElementById('point-editor-window').style.display = 'flex';
};

window.applyPointEdits = (close = true) => {
    if(!window.currentEditingFeature) return; const { d, isProj, pid } = window.currentEditingFeature;
    d.ptsGPS.forEach((pt, i) => {
        const x = parseFloat(document.getElementById(`edit-x-${i}`).value), y = parseFloat(document.getElementById(`edit-y-${i}`).value), z = document.getElementById(`edit-z-${i}`).value;
        const g = proj4("EPSG:2154", "EPSG:4326", [x, y]); pt.lat = g[1]; pt.lng = g[0];
        if(z.trim() !== '') pt.customZ = parseFloat(z); else delete pt.customZ;
    });
    if(d.type !== 'circle') d.layer.setLatLngs(d.ptsGPS);
    recalculateStats(d); if(d.isEditing && !close) makeEditable(d, isProj, pid);
    if(d.type==='line' && currentProfileDrawId === d.id) generateProfile(d);
    if(close) document.getElementById('point-editor-window').style.display='none';
};

function recalculateStats(d) {
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    if(d.type==='circle') {
        const a = Math.PI * d.radius**2; d.statsHtml = `Diam: ${(2*d.radius).toFixed(1)}m | Aire: ${a.toFixed(1)}m²`;
    } else if(d.type==='line') {
        let dist=0; for(let i=1; i<l93.length; i++) dist+=Math.hypot(l93[i][0]-l93[i-1][0],l93[i][1]-l93[i-1][1]);
        const z1 = d.ptsGPS[0].customZ || getZ(l93[0]) || 0, z2 = d.ptsGPS[l93.length-1].customZ || getZ(l93[l93.length-1]) || 0;
        d.totalDist = dist; d.statsHtml = `L: ${dist.toFixed(1)}m | ΔZ: ${Math.abs(z2-z1).toFixed(1)}m`;
    } else {
        let area = 0; for (let i = 0; i < l93.length; i++) { let j = (i+1) % l93.length; area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; }
        d.statsHtml = `Aire: ${(Math.abs(area)/2).toFixed(1)}m²`;
    }
}

function updateDrawUI() {
    const list = document.getElementById('measure-list'); if(!list) return; list.innerHTML = '';
    drawStore.forEach(d => {
        let btns = d.type==='line' ? `<button onclick="generateProfileById(${d.id})">📈 Profil</button>` : 
        `<div class="btn-group-vol">
            <button id="btn-vol-hollow-${d.id}" onclick="calculateVolume(${d.id}, 'hollow')">💧 Creux</button>
            <button id="btn-vol-mound-${d.id}" onclick="calculateVolume(${d.id}, 'mound')">⛰️ Tas</button>
            <button id="btn-vol-slope-${d.id}" onclick="calculateVolume(${d.id}, 'slope')">📐 Courbe</button>
            <button id="btn-vol-plane-${d.id}" onclick="calculateVolume(${d.id}, 'plane')">📏 Plan</button>
            <button onclick="generate3DView(${d.id})">👁️ 3D</button>
        </div>`;
        list.innerHTML += `<div class="card" style="border-left:4px solid ${d.color}">
            <div class="card-header"><div><input type="checkbox" ${d.visible?'checked':''} onchange="toggleDraw(${d.id})"> <strong onclick="renameDraw(${d.id})">${d.name}</strong></div><button class="btn-del" onclick="deleteDraw(${d.id})">✕</button></div>
            <div style="font-size:10px; margin:5px 0;">${d.statsHtml||''}</div>
            <button onclick="toggleEditMode(${d.id})">${d.isEditing?'✅ Fin':'✏️ Éditer'}</button>${btns}</div>`;
    });
}
window.renameDraw = (id) => { const d = drawStore.find(x => x.id === id); const n = prompt("Nom :", d.name); if(n){d.name=n; updateDrawUI();} };
window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); };

// ==========================================
// 5. CALCULS DE VOLUMES ET 3D
// ==========================================
window.calculateVolume = (id, type) => {
    const d = drawStore.find(x => x.id === id); if (mntStore.filter(m=>m.visible).length===0) return alert("Activez un MNT");
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    l93.forEach(p => { minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
    
    let border = []; l93.forEach((p, i) => { let z = d.ptsGPS[i].customZ || getZ(p); if(z) border.push({x:p[0], y:p[1], z}); });
    
    let totalV = 0, step = 1;
    let aR=0, bR=0, cR=0;
    if(type==='plane'){
        let sX=0, sY=0, sZ=0; border.forEach(p=>{sX+=p.x; sY+=p.y; sZ+=p.z;});
        const n=border.length, cX=sX/n, cY=sY/n, cZ=sZ/n;
        let sXX=0, sYY=0, sXY=0, sXZ=0, sYZ=0;
        border.forEach(p=>{ const dX=p.x-cX, dY=p.y-cY, dZ=p.z-cZ; sXX+=dX*dX; sYY+=dY*dY; sXY+=dX*dY; sXZ+=dX*dZ; sYZ+=dY*dZ; });
        const D = sXX*sYY - sXY*sXY; if(D!==0){ aR=(sXZ*sYY - sYZ*sXY)/D; bR=(sYZ*sXX - sXZ*sXY)/D; }
        cR = cZ - aR*cX - bR*cY;
    }

    for (let x = minX; x <= maxX; x += step) {
        for (let y = minY; y <= maxY; y += step) {
            if (isPointInPolygon([x, y], l93)) {
                let zM = getZ([x, y]); if(!zM) continue;
                let zB = 0;
                if(type==='slope'){
                    let sumW=0; border.forEach(b=>{ let w=1/((x-b.x)**2+(y-b.y)**2); zB+=b.z*w; sumW+=w; }); zB=zB/sumW;
                } else if(type==='plane'){ zB = aR*x + bR*y + cR; }
                else {
                    let ref = parseFloat(prompt("Altitude de base ?", Math.round(zM))); zB = ref;
                }
                totalV += Math.abs(zM - zB);
            }
        }
    }
    alert("Volume estimé : " + totalV.toFixed(1) + " m³");
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
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    l93.forEach(p=>{minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]);});
    
    let xV=[], yV=[], zT=[], zB=[]; 
    const step = (maxX-minX)/40;
    for(let x=minX; x<=maxX; x+=step) xV.push(x);
    for(let y=minY; y<=maxY; y+=step){
        let rowT=[], rowB=[]; yV.push(y);
        for(let x=minX; x<=maxX; x+=step){
            if(isPointInPolygon([x,y], l93)){
                rowT.push(getZ([x,y])); rowB.push(getZ(l93[0])); // Simple base plate pour l'exemple 3D
            } else { rowT.push(null); rowB.push(null); }
        } zT.push(rowT); zB.push(rowB);
    }
    window.current3DData = {x:xV, y:yV, zTop:zT};
    document.getElementById('window-3d').style.display = 'block';
    Plotly.newPlot('plot-3d', [
        {z:zT, x:xV, y:yV, type:'surface', name:'Terrain', colorscale:'Earth', showscale:false},
        {z:zB, x:xV, y:yV, type:'surface', name:'Base', opacity:0.6, showscale:false}
    ], {margin:{l:0,r:0,b:40,t:10}, scene:{aspectmode:'data'}}, {displayModeBar:false}).then(()=>{
        document.getElementById('plot-3d').on('plotly_hover', (data)=>{
            if(data.points.length>0){
                const p=data.points[0]; const g=proj4("EPSG:2154","EPSG:4326",[p.x,p.y]);
                if(!cursorMarker) cursorMarker=L.circleMarker([g[1],g[0]],{radius:6,color:'red',fillOpacity:1}).addTo(map);
                else cursorMarker.setLatLng([g[1],g[0]]);
                document.getElementById('hover-3d-result').innerHTML = `Z: ${p.z.toFixed(2)}m`;
            }
        });
    });
};

// ==========================================
// 6. PROFIL ALTIMÉTRIQUE
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; generateProfile(drawStore.find(x=>x.id===id)); };
function generateProfile(d) {
    document.getElementById('profile-window').style.display='block';
    const ctx = document.getElementById('profileChart').getContext('2d');
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let data=[], geo=[], dist=0;
    data.push({x:0, y:d.ptsGPS[0].customZ || getZ(l93[0]) || 0}); geo.push(d.ptsGPS[0]);
    for(let i=1; i<l93.length; i++){
        const dSeg = Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        for(let j=1; j<dSeg; j++){
            const t=j/dSeg; const x=l93[i-1][0]+(l93[i][0]-l93[i-1][0])*t, y=l93[i-1][1]+(l93[i][1]-l93[i-1][1])*t;
            data.push({x:dist+j, y:getZ([x,y])||0}); geo.push(proj4("EPSG:2154","EPSG:4326",[x,y]));
        }
        dist+=dSeg; data.push({x:dist, y:d.ptsGPS[i].customZ || getZ(l93[i])||0}); geo.push(d.ptsGPS[i]);
    }
    if(chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type:'line', data:{datasets:[{label:'Altitude', data, borderColor:d.color, fill:true, pointRadius:0}]},
        options:{ responsive:true, maintainAspectRatio:false, onHover:(e,el)=>{
            if(el.length>0){
                const p=geo[el[0].index];
                if(!cursorMarker) cursorMarker=L.circleMarker([p.lat,p.lng],{radius:6,color:'red'}).addTo(map);
                else cursorMarker.setLatLng([p.lat,p.lng]);
            }
        }}
    });
}

// ==========================================
// 7. SUIVI SOURIS ET KMZ
// ==========================================
map.on('mousemove', (e)=>{
    const l=proj4("EPSG:4326","EPSG:2154",[e.latlng.lng, e.latlng.lat]);
    document.getElementById('cur-x').innerText = l[0].toFixed(1);
    document.getElementById('cur-y').innerText = l[1].toFixed(1);
    const z = getZ(l); document.getElementById('cur-z').innerText = z?z.toFixed(2):'---';
});

window.addEventListener('load', () => {
    if (typeof pistesData !== 'undefined') {
        const l = L.geoJSON(pistesData, { style: { color: '#ffffff', weight: 1, opacity: 0.5 } }).addTo(map);
        kmzStore.push({ id: 1, name: "Pistes", layer: l, visible: true }); map.fitBounds(l.getBounds());
    }
    if (typeof canonData !== 'undefined') {
        const l = L.geoJSON(canonData, { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 3, color: '#3498db' }) }).addTo(map);
        kmzStore.push({ id: 2, name: "Canons", layer: l, visible: true });
    }
    updateKmzUI();
});

// ==========================================
// 8. SAUVEGARDE ET EXPORTS
// ==========================================
const SCRIPT_URL = "VOTRE_URL_ICI"; 

window.saveProject = async () => {
    const name = document.getElementById('project-name').value;
    const data = drawStore.map(d => ({ type: d.type, name: d.name, ptsGPS: d.ptsGPS, color: d.color, radius: d.radius, center: d.center }));
    try { await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ projectName: name, projectData: JSON.stringify(data) }) }); alert("OK !"); } catch(e) { alert("Erreur Google"); }
};

window.exportSTL = () => {
    if (!window.current3DData) return;
    let stl = "solid terrain\n"; const {x, y, zTop} = window.current3DData;
    const minX=x[0], minY=y[0];
    for (let i=0; i<y.length-1; i++) for (let j=0; j<x.length-1; j++) {
        const z1=zTop[i][j], z2=zTop[i][j+1], z3=zTop[i+1][j];
        if(z1&&z2&&z3) stl += `facet normal 0 0 0\n outer loop\n vertex ${x[j]-minX} ${y[i]-minY} ${z1}\n vertex ${x[j+1]-minX} ${y[i]-minY} ${z2}\n vertex ${x[j]-minX} ${y[i+1]-minY} ${z3}\n endloop\nendfacet\n`;
    }
    stl += "endsolid terrain\n";
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([stl], {type:'text/plain'})); a.download='terrain.stl'; a.click();
};

window.close3DWindow = () => { document.getElementById('window-3d').style.display='none'; if(cursorMarker) map.removeLayer(cursorMarker); };
window.updateScalesLive = () => chartInstance.update();
// ==========================================
// 11. CHARGEMENT DES DONNÉES MÉTIER (KMZ/GEOJSON)
// ==========================================
window.addEventListener('load', () => {
    try {
        // --- 1. CHARGEMENT DES PISTES ---
        // On vérifie si la variable existe (chargée via un <script> dans l'index.html)
        if (typeof pistesData !== 'undefined' && pistesData.features) {
            const pistesLayer = L.geoJSON(pistesData, { 
                style: { 
                    color: '#ffffff', 
                    weight: 2, 
                    opacity: 0.8, 
                    dashArray: '5, 5' // Optionnel : ligne pointillée pour les pistes
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup("Piste : " + feature.properties.name);
                    }
                }
            }).addTo(map);
            
            kmzStore.push({ id: "pistes", name: "Domaine Skiable", layer: pistesLayer, visible: true, color: '#ffffff' });
            
            // Ajuster la vue si c'est le premier élément chargé
            if (mntStore.length === 0) map.fitBounds(pistesLayer.getBounds());
        }

        // --- 2. CHARGEMENT DES CANONS ---
        if (typeof canonData !== 'undefined' && canonData.features) {
            const canonLayer = L.geoJSON(canonData, { 
                pointToLayer: (feature, latlng) => {
                    return L.circleMarker(latlng, { 
                        radius: 5, 
                        fillColor: '#3498db', 
                        color: '#fff', 
                        weight: 1, 
                        fillOpacity: 0.9 
                    });
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.name) {
                        layer.bindPopup("Enneigeur : " + feature.properties.name);
                    }
                }
            }).addTo(map);
            
            kmzStore.push({ id: "canons", name: "Réseau Neige", layer: canonLayer, visible: true, color: '#3498db' });
        }

        updateKmzUI();
    } catch (e) {
        console.error("Erreur lors du chargement des calques métier :", e);
    }
});

// --- Interface de gestion des KMZ ---
function updateKmzUI() {
    const list = document.getElementById('kmz-list');
    if (!list) return;
    list.innerHTML = '';
    
    kmzStore.forEach(k => {
        list.innerHTML += `
        <div class="card" style="border-left: 4px solid ${k.color}; margin-bottom: 5px; padding: 8px; background: #2c3e50;">
            <div style="display:flex; justify-content: space-between; align-items: center;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" ${k.visible ? 'checked' : ''} onchange="toggleKMZ('${k.id}')">
                    <span style="color:white; font-size:0.9em;">${k.name}</span>
                </label>
                <div style="font-size: 0.7em; color: #bdc3c7;">KMZ</div>
            </div>
        </div>`;
    });
}

window.toggleKMZ = (id) => {
    const k = kmzStore.find(x => x.id === id);
    if (!k) return;
    k.visible = !k.visible;
    if (k.visible) k.layer.addTo(map);
    else map.removeLayer(k.layer);
    updateKmzUI();
};

// ==========================================
// 12. SAUVEGARDE GOOGLE (Remettez votre URL)
// ==========================================
const SCRIPT_URL = "VOTRE_URL_GOOGLE_SCRIPT_ICI"; // <--- ⚠️ À REMPLIR

window.saveProject = async () => {
    const name = document.getElementById('project-name').value;
    if(!name) return alert("Nom de projet requis");
    const data = drawStore.map(d => ({ type: d.type, name: d.name, ptsGPS: d.ptsGPS, color: d.color, radius: d.radius, center: d.center }));
    try { 
        const res = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ projectName: name, projectData: JSON.stringify(data) }) });
        const json = await res.json();
        if(json.status === "success") alert("Projet sauvegardé dans le Cloud !");
    } catch(e) { alert("Erreur de connexion Google Sheets"); }
};

window.close3DWindow = () => { 
    document.getElementById('window-3d').style.display = 'none'; 
    if(cursorMarker) map.removeLayer(cursorMarker); 
};
