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

let mntStore = [];
let drawStore = [];
let kmzStore = []; 
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

// --- Fonction 1 : Téléchargement depuis GitHub ---
window.loadRemoteMNT = async () => {
    const select = document.getElementById('mnt-select');
    const url = select.value;
    const name = select.options[select.selectedIndex].text;

    if (!url) {
        alert("Veuillez sélectionner un MNT dans la liste déroulante.");
        return;
    }

    const btn = document.querySelector('button[onclick="loadRemoteMNT()"]');
    const oldText = btn.innerText;
    btn.innerText = "⏳ Téléchargement en cours...";
    btn.style.background = "#f39c12"; 
    btn.disabled = true;

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
        
        const defaultColor = "#00d1b2";
        const defaultWeight = 2;
        
        const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { 
            color: defaultColor, weight: defaultWeight, fillOpacity: 0.15 
        }).addTo(map);

        mntStore.push({ 
            id: Date.now()+Math.random(), name: name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: defaultColor, weight: defaultWeight
        });
        
        map.fitBounds(visual.getBounds());
        updateMntUI();
    } catch(err) { 
        console.error(err);
        alert("Impossible de charger le MNT. Vérifiez le lien GitHub.");
    } finally {
        btn.innerText = oldText;
        btn.style.background = "#00d1b2";
        btn.disabled = false;
    }
};

// --- Fonction 2 : Importation d'un fichier local ---
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
            
            const defaultColor = "#00d1b2";
            const defaultWeight = 2;
            
            const visual = L.rectangle([[sw[1], sw[0]], [ne[1], ne[0]]], { color: defaultColor, weight: defaultWeight, fillOpacity: 0.15 }).addTo(map);

            mntStore.push({ id: Date.now()+Math.random(), name: file.name, bbox, width: image.getWidth(), height: image.getHeight(), data: raster[0], visual, visible: true, color: defaultColor, weight: defaultWeight });
            map.fitBounds(visual.getBounds());
        } catch(err) { console.error("Erreur MNT :", err); }
    }
    updateMntUI();
};

// --- Fonction 3 : Mise à jour de l'interface ---
function updateMntUI() {
    const list = document.getElementById('mnt-list');
    if (!list) return;
    list.innerHTML = '';
    mntStore.forEach(m => {
        list.innerHTML += `<div class="card" style="border-left-color: ${m.color}"><div class="card-header"><div><input type="checkbox" ${m.visible ? 'checked' : ''} onchange="toggleMNT(${m.id})"> <input type="color" class="color-picker" value="${m.color}" onchange="changeMntColor(${m.id}, this.value)"> <span style="cursor:pointer;" onclick="renameMNT(${m.id})" title="Cliquez pour renommer">${m.name.substring(0,18)}</span></div><button class="btn-del" onclick="deleteMNT(${m.id})">✕</button></div><div style="margin-top:5px; font-size: 0.9em;">Épaisseur : <input type="range" min="1" max="10" value="${m.weight}" class="slider-width" onchange="changeMntWeight(${m.id}, this.value)"></div></div>`;
    });
}

// Nouvelle fonction pour renommer le MNT
window.renameMNT = (id) => { 
    const m = mntStore.find(x => x.id === id); 
    if (!m) return; 
    const newName = prompt("Nouveau nom pour ce secteur :", m.name); 
    if (newName && newName.trim() !== "") { 
        m.name = newName.trim(); 
        updateMntUI(); 
    } 
};

// --- Fonctions 4 : Contrôles visuels (Couleurs, Épaisseur, Masquage) ---
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
    const list = document.getElementById('kmz-list'); 
    if (!list) return; // Sécurité anti-bug
    list.innerHTML = '';
    
    kmzStore.forEach(k => {
        list.innerHTML += `<div class="card" style="border-left-color: ${k.color}"><div class="card-header"><div><input type="checkbox" ${k.visible ? 'checked' : ''} onchange="toggleKMZ(${k.id})"> <input type="color" class="color-picker" value="${k.color}" onchange="changeKmzColor(${k.id}, this.value)"> <span>${k.name.substring(0,15)}</span></div><button class="btn-del" onclick="deleteKMZ(${k.id})">✕</button></div><div style="margin-top:5px; font-size: 0.9em;">Épaisseur : <input type="range" min="1" max="10" value="${k.weight}" class="slider-width" onchange="changeKmzWeight(${k.id}, this.value)"></div></div>`;
    });
}

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
window.startTool = (tool) => {
    currentTool = tool; currentPoints = [];
    if (tempLayer) map.removeLayer(tempLayer);
    document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-' + tool).classList.add('active');
    const finishBtn = document.getElementById('btn-finish'); 
    const activeBtn = document.getElementById('btn-' + tool);
    activeBtn.insertAdjacentElement('afterend', finishBtn);
    finishBtn.style.display = 'block';
};

map.on('click', (e) => {
    if (!currentTool) return; currentPoints.push(e.latlng);
    if (tempLayer) map.removeLayer(tempLayer);
    const color = currentTool === 'area' ? '#e67e22' : '#3498db';
    if (currentTool === 'area') tempLayer = L.polygon(currentPoints, { color, weight: 3, fillOpacity: 0.3 }).addTo(map);
    else tempLayer = L.polyline(currentPoints, { color, weight: 4 }).addTo(map);
});

window.finalizeDraw = () => {
    if (!currentTool || currentPoints.length < 2) { alert("Veuillez placer au moins 2 points."); return; }
    try {
        const type = currentTool; const color = type === 'area' ? '#e67e22' : '#3498db';
        const layer = type === 'area' ? L.polygon(currentPoints, { color, weight: 3, fillOpacity: 0.3 }).addTo(map) : L.polyline(currentPoints, { color, weight: 4 }).addTo(map);
        if (tempLayer) map.removeLayer(tempLayer); tempLayer = null;
        
        // On donne un nom par défaut selon l'outil utilisé
        const defaultName = type === 'line' ? 'Mon Parcours' : 'Ma Surface';
        
        const drawObj = { id: Date.now(), type, name: defaultName, layer, ptsGPS: [...currentPoints], visible: true, color, editGroup: L.layerGroup().addTo(map) };
        drawStore.push(drawObj); recalculateStats(drawObj); makeEditable(drawObj);
        
        if (type === 'line') { currentProfileDrawId = drawObj.id; generateProfile(drawObj); } 
        currentTool = null; currentPoints = [];
        document.querySelectorAll('.btn-tool').forEach(b => b.classList.remove('active'));
        document.getElementById('btn-finish').style.display = 'none';
    } catch (e) { console.error(e); }
};

// ==========================================
// 5. CALCULS ET ÉDITION LIVE
// ==========================================
function recalculateStats(d) {
    const l93 = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    if (d.type === 'line') {
        let dist = 0;
        for (let i = 1; i < l93.length; i++) dist += Math.hypot(l93[i][0]-l93[i-1][0], l93[i][1]-l93[i-1][1]);
        const z1 = getZ(l93[0]) || 0; const z2 = getZ(l93[l93.length-1]) || 0;
        const dz = Math.abs(z2 - z1); const pente = dist > 0 ? (dz / dist * 100).toFixed(1) : 0;
        d.totalDist = dist; d.statsHtml = `Dist: <b>${dist.toFixed(1)} m</b> | ΔZ: <b>${dz.toFixed(1)} m</b> | Pente Moy: <b>${pente}%</b>`;
    } else {
        let area = 0;
        for (let i = 0; i < l93.length; i++) { let j = (i+1) % l93.length; area += l93[i][0]*l93[j][1] - l93[j][0]*l93[i][1]; }
        d.statsHtml = `Surface: <b>${(Math.abs(area)/2).toFixed(1)} m²</b>`;
    }
    const statsDiv = document.getElementById(`stats-${d.id}`); if (statsDiv) statsDiv.innerHTML = d.statsHtml; else updateDrawUI();
}

function updateDrawUI() {
    const list = document.getElementById('measure-list'); 
    if (!list) return;
    list.innerHTML = '';
    drawStore.forEach(d => {
        // On remplace le titre fixe par le nom cliquable (d.name)
        list.innerHTML += `<div class="card" style="border-left-color: ${d.color}"><div class="card-header"><div><input type="checkbox" ${d.visible ? 'checked' : ''} onchange="toggleDraw(${d.id})"> <input type="color" class="color-picker" value="${d.color}" onchange="changeColor(${d.id}, this.value)"> <strong style="cursor:pointer;" onclick="renameDraw(${d.id})" title="Cliquez pour renommer">${d.name}</strong></div><button class="btn-del" onclick="deleteDraw(${d.id})">✕</button></div><div id="stats-${d.id}" style="margin-top:5px; font-size:1.1em;">${d.statsHtml}</div>${d.type === 'line' ? `<button onclick="generateProfileById(${d.id})" style="width:100%; margin-top:8px; font-size:0.8em; cursor:pointer; background:#333; color:white; border:1px solid #555; padding:5px; border-radius:3px;">Afficher le profil</button>` : ''}</div>`;
    });
}

// Nouvelle fonction pour renommer les tracés et surfaces à droite
window.renameDraw = (id) => { 
    const d = drawStore.find(x => x.id === id); 
    if (!d) return; 
    const newName = prompt("Nouveau nom pour ce tracé :", d.name); 
    if (newName && newName.trim() !== "") { 
        d.name = newName.trim(); 
        updateDrawUI(); 
    } 
};
function makeEditable(d) {
    d.editGroup.clearLayers(); if (!d.visible) return;
    const icon = L.divIcon({ className: 'edit-handle', iconSize: [12, 12] });
    d.ptsGPS.forEach((pt, idx) => {
        const marker = L.marker(pt, { icon, draggable: true }).addTo(d.editGroup);
        marker.on('drag', (e) => {
            d.ptsGPS[idx] = e.latlng; d.layer.setLatLngs(d.ptsGPS); recalculateStats(d);
            if (d.type === 'line') generateProfile(d);
        });
    });
}

window.toggleDraw = (id) => { const d = drawStore.find(x => x.id === id); d.visible = !d.visible; if (d.visible) { d.layer.addTo(map); makeEditable(d); } else { map.removeLayer(d.layer); d.editGroup.clearLayers(); } };

window.changeColor = (id, color) => {
    const d = drawStore.find(x => x.id === id); if (!d) return;
    d.color = color; d.layer.setStyle({ color: color }); updateDrawUI();
    if (chartInstance && currentProfileDrawId === id) {
        chartInstance.data.datasets[0].borderColor = color;
        chartInstance.data.datasets[0].backgroundColor = color + '33';
        chartInstance.update();
    }
};

window.deleteDraw = (id) => { const d = drawStore.find(x => x.id === id); map.removeLayer(d.layer); map.removeLayer(d.editGroup); drawStore = drawStore.filter(x => x.id !== id); updateDrawUI(); document.getElementById('profile-window').style.display = 'none'; if(currentProfileDrawId === id) currentProfileDrawId = null; };

// ==========================================
// 6. PROFIL ALTIMÉTRIQUE HAUTE PRÉCISION
// ==========================================
window.generateProfileById = (id) => { currentProfileDrawId = id; const d = drawStore.find(x => x.id === id); generateProfile(d); };

function generateProfile(d) {
    document.getElementById('profile-window').style.display = 'block';
    const ctx = document.getElementById('profileChart').getContext('2d');
    
    const l93Pts = d.ptsGPS.map(p => proj4("EPSG:4326", "EPSG:2154", [p.lng, p.lat]));
    let cumulativeDistances = [0]; let totalDist = 0;
    for (let i = 1; i < l93Pts.length; i++) {
        totalDist += Math.hypot(l93Pts[i][0]-l93Pts[i-1][0], l93Pts[i][1]-l93Pts[i-1][1]);
        cumulativeDistances.push(totalDist);
    }

    let chartData = []; let geoRef = []; currentProfileExportData = []; 
    const samplingInterval = 1; 

    let zStart = getZ(l93Pts[0]) || 0;
    addPointToChart(0, zStart, [l93Pts[0][0], l93Pts[0][1]]);
    let nextSampleDist = samplingInterval;

    for (let i = 1; i < l93Pts.length; i++) {
        const segLen = cumulativeDistances[i] - cumulativeDistances[i-1];
        const p1 = l93Pts[i-1]; const p2 = l93Pts[i];

        while (nextSampleDist < cumulativeDistances[i]) {
            const distInSeg = nextSampleDist - cumulativeDistances[i-1];
            const t = segLen === 0 ? 0 : distInSeg / segLen;
            const x = p1[0] + (p2[0] - p1[0]) * t;
            const y = p1[1] + (p2[1] - p1[1]) * t;
            const z = getZ([x, y]) || 0;
            addPointToChart(nextSampleDist, z, [x, y]);
            nextSampleDist += samplingInterval;
        }

        let zReal = getZ(l93Pts[i]) || 0;
        if (Math.abs(cumulativeDistances[i] - (nextSampleDist - samplingInterval)) > 0.1) {
             addPointToChart(cumulativeDistances[i], zReal, [l93Pts[i][0], l93Pts[i][1]]);
        }
    }

    function addPointToChart(dist, z, l93Coords) {
        chartData.push({ x: parseFloat(dist.toFixed(1)), y: parseFloat(z.toFixed(2)) }); 
        const gps = proj4("EPSG:2154", "EPSG:4326", l93Coords);
        geoRef.push(gps);
        currentProfileExportData.push({ dist: dist.toFixed(2), z: z.toFixed(2) });
    }

    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets: [{ label: 'Altitude Z (m)', data: chartData, borderColor: d.color, backgroundColor: d.color + '33', fill: true, pointRadius: 0, tension: 0.1 }] },
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

    const xMinSlider = document.getElementById('x-min'); const xMaxSlider = document.getElementById('x-max');
    const yMinSlider = document.getElementById('y-min'); const yMaxSlider = document.getElementById('y-max');

    let minZ = Math.min(...chartData.map(pt => pt.y)); let maxZ = Math.max(...chartData.map(pt => pt.y));
    const zMargin = (maxZ - minZ) * 0.1 || 10;
    minZ = Math.floor(minZ - zMargin); maxZ = Math.ceil(maxZ + zMargin);

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
    let csv = "\ufeffDistance (m)\tAltitude Z (m)\n";
    currentProfileExportData.forEach(row => { csv += `${row.dist.replace('.', ',')}\t${row.z.replace('.', ',')}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'export_profil_1m.csv'; a.click();
};

// ==========================================
// 7. GESTION DES CURSEURS LIVE (SCALES)
// ==========================================
window.updateScalesLive = () => {
    if (!chartInstance) return;

    let xMin = parseFloat(document.getElementById('x-min').value);
    let xMax = parseFloat(document.getElementById('x-max').value);
    let yMin = parseFloat(document.getElementById('y-min').value);
    let yMax = parseFloat(document.getElementById('y-max').value);

    if (xMin >= xMax - 1) { xMin = xMax - 1; document.getElementById('x-min').value = xMin; }
    if (yMin >= yMax - 1) { yMin = yMax - 1; document.getElementById('y-min').value = yMin; }

    document.getElementById('x-vals').innerText = `${xMin.toFixed(0)}m - ${xMax.toFixed(0)}m`;
    document.getElementById('y-vals').innerText = `${yMin.toFixed(0)}m - ${yMax.toFixed(0)}m`;

    chartInstance.options.scales.x.min = xMin;
    chartInstance.options.scales.x.max = xMax;
    chartInstance.options.scales.y.min = yMin;
    chartInstance.options.scales.y.max = yMax;

    chartInstance.update('none'); 
};

// ==========================================
// 8. SUIVI SOURIS COORDONNÉES
// ==========================================
map.on('mousemove', (e) => {
    try {
        if (!e.latlng) return;
        const l93 = proj4("EPSG:4326", "EPSG:2154", [e.latlng.lng, e.latlng.lat]);
        const elX = document.getElementById('cur-x'), elY = document.getElementById('cur-y'), elZ = document.getElementById('cur-z');
        if (elX) elX.innerText = l93[0].toFixed(1); if (elY) elY.innerText = l93[1].toFixed(1);
        if (elZ) { let z = null; try { z = getZ(l93); } catch (err) {} elZ.innerText = (z !== null && !isNaN(z)) ? z.toFixed(2) : "---"; }
    } catch (error) {}
});

// ==========================================
// 9. FENÊTRE FLOTTANTE (DRAG & DROP)
// ==========================================
const profileWin = document.getElementById('profile-window'), profileHeader = document.getElementById('profile-header');
let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;

profileHeader.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    const rect = profileWin.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left; dragOffsetY = e.clientY - rect.top;
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let newX = e.clientX - dragOffsetX, newY = e.clientY - dragOffsetY;
    if (newX < 0) newX = 0; if (newY < 0) newY = 0;
    profileWin.style.bottom = 'auto'; profileWin.style.right = 'auto';  
    profileWin.style.left = newX + 'px'; profileWin.style.top = newY + 'px';
});

document.addEventListener('mouseup', () => { isDragging = false; });

// ==========================================
// 10. CHARGEMENT DU TRACÉ (PISTES ET CANONS)
// ==========================================
window.addEventListener('load', () => {
    try {
        // --- 1. CHARGEMENT DES PISTES ---
        // On cherche vos pistes peu importe le nom de la variable
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

            kmzStore.push({ 
                id: idPistes, 
                name: "Mes Pistes", 
                layer: pistesLayer, 
                visible: true, 
                color: '#ffffff', 
                weight: 1 
            });
            
            map.fitBounds(pistesLayer.getBounds());
        }

        // --- 2. CHARGEMENT DES CANONS ---
        if (typeof canonData !== 'undefined' && canonData.features) {
            const idCanons = Date.now() + 1000; 
            
            const canonLayer = L.geoJSON(canonData, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 5,              // Taille du point
                        fillColor: '#3498db',   // Couleur intérieure
                        color: '#ffffff',       // Couleur de bordure
                        weight: 1,              // Épaisseur bordure
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                }
            }).addTo(map);

            kmzStore.push({ 
                id: idCanons, 
                name: "Mes Canons", 
                layer: canonLayer, 
                visible: true, 
                color: '#3498db', 
                weight: 1 
            });
        }

        // --- 3. AFFICHAGE DU MENU ---
        // C'est cette ligne qui fait apparaître les cartes sur la gauche !
        updateKmzUI();

    } catch (e) {
        console.error("Erreur de chargement des données :", e);
    }
});
