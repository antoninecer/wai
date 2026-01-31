// --- DOM Elementy ---
const debugOutput = document.getElementById('debug-output');
const saveButton = document.getElementById('saveSettings');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const analysisContent = document.getElementById('analysis');

// --- Elementy Nastavení ---
const interestsEl = document.getElementById('interests');
const exclusionsEl = document.getElementById('exclusions');
const auraIntensityEl = document.getElementById('auraIntensity');
const parchmentEffectEl = document.getElementById('parchmentEffect');
const buttonAurasEl = document.getElementById('buttonAuras');
const debugLogEl = document.getElementById('debugLog');

// =================================================================================
// Nouzové Logování (spustí se vždy)
// =================================================================================
function rawLog(message, error = null) {
    if (!debugOutput) return;
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    logEntry.textContent = `[${time}] ${message}`;
    if (error) {
        const errorPre = document.createElement('pre');
        errorPre.textContent = error.stack || JSON.stringify(error, null, 2);
        errorPre.style.color = 'red';
        logEntry.appendChild(errorPre);
    }
    debugOutput.appendChild(logEntry);
}

// =================================================================================
// Inicializace
// =================================================================================
document.addEventListener('DOMContentLoaded', () => {
    rawLog('DOM content loaded. Initializing popup...');
    try {
        // Krok 1: Okamžitě připojíme listenery, aby UI nezamrzlo
        setupUIListeners();
        rawLog('UI listeners attached.');

        // Krok 2: Spustíme zbytek inicializace
        initializeApp();
    } catch (e) {
        rawLog('A critical error occurred during initialization!', e);
    }
});

async function initializeApp() {
    rawLog('Loading settings...');
    await loadSettings();
    rawLog('Settings loaded.');
    
    // Zkontrolujeme, zda máme skrýt debug tab
    if (!settings.debugLog) {
        const debugTabButton = document.querySelector('.tab-button[data-tab="debug"]');
        if(debugTabButton) debugTabButton.style.display = 'none';
        // Pokud je aktivní, přepneme na analýzu
        if(document.getElementById('debug').classList.contains('active')) {
            document.querySelector('.tab-button[data-tab="analysis"]').click();
        }
    }

    rawLog('Starting analysis logic...');
    runAnalysis();
}

// =================================================================================
// Správa UI a Nastavení
// =================================================================================

function setupUIListeners() {
    // ... (zůstává stejné)
}

async function loadSettings() {
    // ... (zůstává stejné)
}

async function saveSettings() {
    // ... (zůstává stejné)
}


// =================================================================================
// Logika Analýzy a Vykreslování
// =================================================================================

async function runAnalysis() {
    // ... (zůstává stejné)
}

async function fetchAndDisplayAnalysis(url) {
    // ... (zůstává stejné)
}

function renderAnalysis(data) {
    // ... (zůstává stejné)
}

async function getUserId() {
    // ... (zůstává stejné)
}

// Přepsaná logovací funkce, která respektuje nastavení
function log(message, data = null) {
    if (!settings.debugLog) return;
    rawLog(message, data);
}

