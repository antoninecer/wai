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
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate the clicked tab
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

async function loadSettings() {
    // Placeholder: In a real scenario, this would load from chrome.storage
    console.log('loadSettings called');
    window.settings = {
        debugLog: true // Default to true to keep the debug tab visible
    };
}

async function saveSettings() {
    // Placeholder: In a real scenario, this would save to chrome.storage
    console.log('saveSettings called');
}


// =================================================================================
// Logika Analýzy a Vykreslování
// =================================================================================

async function runAnalysis() {
    console.log('runAnalysis called');
    analysisContent.innerHTML = '<p>Analýza je dočasně nedostupná.</p>';
}

async function fetchAndDisplayAnalysis(url) {
    // Placeholder
    console.log('fetchAndDisplayAnalysis called with url:', url);
}

function renderAnalysis(data) {
    // Placeholder
    console.log('renderAnalysis called with data:', data);
}

async function getUserId() {
    // Placeholder
    console.log('getUserId called');
    return 'test-user';
}

// Přepsaná logovací funkce, která respektuje nastavení
function log(message, data = null) {
    if (!settings.debugLog) return;
    rawLog(message, data);
}

