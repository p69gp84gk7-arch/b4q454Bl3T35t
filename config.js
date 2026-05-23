/* =========================================================
   Fichier : js/config.js
   Rôle : Stocker les variables globales et les fonctions utiles
   ========================================================= */

// ---------------------------------------------------------
// 1. CONFIGURATION PRINCIPALE
// ---------------------------------------------------------
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbxXWPGusI2o66WGBut-urJXxeB00ltFti2KltPXb-mafmmfleavph8wRGNWPydHw0YY1g/exec";

// ---------------------------------------------------------
// 2. VARIABLES GLOBALES DE LA CARTE (Leaflet)
// ---------------------------------------------------------
window.map = null;                 // L'objet carte principal
window.satLayer = null;            // Le fond de carte satellite
window.geojsonLayer = null;        // Le calque contenant les canons
window.webcamLayerGroup = null;    // Le groupe contenant les webcams

// ---------------------------------------------------------
// 3. BASES DE DONNÉES LOCALES (Issues du Google Sheet)
// ---------------------------------------------------------
window.snowCannons = { "type": "FeatureCollection", "features": [] }; // Canons formatés pour la carte
window.rawGeneral = [];            // Données brutes : Onglet Général
window.rawHistorique = [];         // Données brutes : Historique
window.rawTicketsSheet = [];       // Données brutes : Tickets
window.meteoHistData = [];         // Données brutes : Météo Historique
window.meteoFroidData = [];        // Données brutes : Froid
window.suiviEntretienData = [];    // Données brutes : Suivi
window.rawTickets = [];            // Tickets formatés
window.webcamsData = [];           // Webcams formatées
window.cloudKmzLayers = [];        // Calques distants

// ---------------------------------------------------------
// 4. ÉTAT DE L'APPLICATION (Thèmes, Filtres, Sélection)
// ---------------------------------------------------------
window.mainTheme = 'defauts';      // Thème actif par défaut
window.isMultiSelect = false;      // Mode sélection multiple (ON/OFF)
window.selectedCannonsMap = new Map(); // Liste des canons sélectionnés
window.currentlyEditingId = null;  // ID du canon en cours d'édition

// Variables liées aux historiques et saisons
window.saisonsList = [];           
window.histSeasonIdx = 0;          
window.histMetric = 'eau';         
window.absoluteMaxes = { eau: 0, air: 0, temps: 0 }; 
window.currentMaxThreshold = { eau: 100, air: 100, temps: 100 }; 
window.currentMinThreshold = { eau: 0, air: 0, temps: 0 }; 

// Variables liées aux filtres dynamiques
window.columnValuesSets = {};      // Valeurs uniques par colonne
window.availableColumns = [];      // Colonnes filtrables
window.currentPistes = ['all'];    
window.currentTypes = ['all'];     
window.activeFilters = [{ key: "", vals: [] }]; 

// Variables techniques diverses
window.chartInstances = {};        // Sauvegarde des graphiques ChartJS
window.technoColors = {};          
window.repColors = {};             
window.transfoColors = {};         
window.externalLayers = {};        // Calques KMZ importés manuellement
window.defaultColors = ['#e74c3c','#3498db','#f1c40f','#2ecc71','#9b59b6','#e67e22','#1abc9c','#34495e']; 
window.keyPiste = ""; window.keyType = ""; window.keyRep = ""; window.keyTransfo = ""; 
window.localDB = null; 
window.bootAttempt = 0; 
window.tempTicketPayloads = {}; 

// ---------------------------------------------------------
// 5. UTILITAIRES GLOBAUX (Fonctions d'aide)
// ---------------------------------------------------------

/**
 * Récupère la valeur d'une propriété spécifique pour un canon
 */
window.getV = function(p, k) {
    if (!k || !p || !p.fullData) return "N/A";
    let o = p.fullData.find(x => x.k === k);
    return o ? o.v.toString().trim() : "N/A";
};

/**
 * Récupère tous les tickets associés à un canon
 */
window.getTicketsForCanon = function(id) {
    return window.rawTickets.filter(t => t.idCanon === id);
};

/**
 * Récupère uniquement les tickets "En cours" ou "À faire"
 */
window.getActiveTickets = function(id) {
    return window.getTicketsForCanon(id).filter(t => t.statut.includes('faire') || t.statut.includes('cours'));
};

/**
 * Récupère l'historique des tickets "Fait" (trié par date)
 */
window.getHistoryTickets = function(id) {
    return window.getTicketsForCanon(id)
        .filter(t => t.statut.includes('fait') || t.statut === '')
        .sort((a,b) => new Date(b.date) - new Date(a.date));
};
