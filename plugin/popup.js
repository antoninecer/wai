// --- DOM Elementy ---
const debugOutput = document.getElementById('debug-output');
const saveButton = document.getElementById('saveSettings');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// --- Elementy Nastavení ---
const interestsEl = document.getElementById('interests');
const exclusionsEl = document.getElementById('exclusions');
const auraIntensityEl = document.getElementById('auraIntensity');
const parchmentEffectEl = document.getElementById('parchmentEffect');
const buttonAurasEl = document.getElementById('buttonAuras');
const debugLogEl = document.getElementById('debugLog');

// --- Globální Proměnné ---
let settings = {};

// =================================================================================
// Inicializace
// =================================================================================

// Hlavní funkce, která se spustí po načtení DOM
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Nastaví listenery pro UI (záložky, tlačítka)
    setupUIListeners();
    
    // 2. Načte uložená nastavení a zobrazí je ve formuláři
    await loadSettings();
    
    // 3. Spustí logiku pro zobrazení debug logu (pokud je zapnutý)
    initializeDebugLog();
    
    // 4. Spustí hlavní logiku analýzy
    runAnalysis();
});

// =================================================================================
// Správa UI (Záložky, Logy)
// =================================================================================

// Nastaví listenery pro přepínání záložek a ukládání nastavení
function setupUIListeners() {
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
        });
    });

    saveButton.addEventListener('click', saveSettings);
}

// Připraví debugovací okno
function initializeDebugLog() {
    if (settings.debugLog) {
        document.getElementById('debug').style.display = 'block';
    } else {
        // Skryjeme záložku "Debug", pokud je logování vypnuté
        const debugTabButton = document.querySelector('.tab-button[data-tab="debug"]');
        if(debugTabButton) debugTabButton.style.display = 'none';
    }
    log('Popup opened...');
}

// Funkce pro logování do popup okna
function log(message, data = null) {
    if (!settings.debugLog || !debugOutput) return;

    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('p');
    // ... (zbytek logovací funkce zůstává stejný)

    if (data) {
        const dataPre = document.createElement('pre');
        dataPre.textContent = JSON.stringify(data, null, 2);
        // ... (stylování pre)
        logEntry.innerHTML = `[${time}] ${message}`;
        logEntry.appendChild(dataPre);
    } else {
        logEntry.textContent = `[${time}] ${message}`;
    }
  
    debugOutput.appendChild(logEntry);
    debugOutput.scrollTop = debugOutput.scrollHeight;
}

// =================================================================================
// Správa Nastavení
// =================================================================================

// Načte nastavení z chrome.storage a vyplní formulář
async function loadSettings() {
    const data = await chrome.storage.local.get('wai_settings');
    settings = data.wai_settings || {
        interests: 'web development, AI',
        exclusions: 'gossip, clickbait',
        auraIntensity: 80,
        parchmentEffect: false,
        buttonAuras: true,
        debugLog: true,
    };

    interestsEl.value = settings.interests;
    exclusionsEl.value = settings.exclusions;
    auraIntensityEl.value = settings.auraIntensity;
    parchmentEffectEl.checked = settings.parchmentEffect;
    buttonAurasEl.checked = settings.buttonAuras;
    debugLogEl.checked = settings.debugLog;
}

// Uloží nastavení z formuláře do chrome.storage
async function saveSettings() {
    settings = {
        interests: interestsEl.value,
        exclusions: exclusionsEl.value,
        auraIntensity: auraIntensityEl.value,
        parchmentEffect: parchmentEffectEl.checked,
        buttonAuras: buttonAurasEl.checked,
        debugLog: debugLogEl.checked,
    };
    await chrome.storage.local.set({ wai_settings: settings });
    log('Settings saved!', settings);
    // Zobrazíme/skryjeme debug tab podle nového nastavení
    const debugTabButton = document.querySelector('.tab-button[data-tab="debug"]');
    if(debugTabButton) debugTabButton.style.display = settings.debugLog ? 'block' : 'none';
    if(!settings.debugLog) document.getElementById('debug').classList.remove('active');
}


// --- DOM Elementy ---
const debugOutput = document.getElementById('debug-output');
const saveButton = document.getElementById('saveSettings');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const analysisContent = document.getElementById('analysis');

// --- Elementy Nastavení ---
const interestsEl = document.getElementById('interests');
// ... (ostatní elementy nastavení)

// --- Globální Proměnné ---
let settings = {};

// =================================================================================
// Inicializace
// =================================================================================
document.addEventListener('DOMContentLoaded', async () => {
    setupUIListeners();
    await loadSettings();
    initializeDebugLog();
    runAnalysis();
});


// =================================================================================
// Logika Analýzy a Vykreslování
// =================================================================================

async function runAnalysis() {
  try {
    log('Main analysis logic started.');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]) return;

    // Ihned se pokusíme zobrazit data, která už možná máme
    fetchAndDisplayAnalysis(tabs[0].url);

    // Zároveň pošleme zprávu content scriptu, aby se spustil proces na pozadí
    const response = await chrome.tabs.sendMessage(tabs[0].id, { greeting: "dejMiData" });
    if (!response || !response.data) {
      log('No initial data from content script.');
      return;
    }
    
    const userId = await getUserId();
    const apiEndpoint = 'https://api.wai.ventureout.cz/analyze';
    
    const requestBody = {
      ...response.data,
      userId: userId,
      preferences: {
        interests: settings.interests.split(',').map(s => s.trim()),
        exclusions: settings.exclusions.split(',').map(s => s.trim()),
        auraIntensity: settings.auraIntensity / 100
      }
    };

    log('Setting up analysis for background polling...');
    await chrome.storage.local.set({
      analysisInProgress: { url: tabs[0].url, tabId: tabs[0].id }
    });
    
    // Odpálíme požadavek, ale nečekáme na něj. O aktualizaci se postará content.js
    fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }).then(apiResponse => {
        log(`API responded with status: ${apiResponse.status}`);
    }).catch(error => {
        log('Fetch request failed:', error);
    });

  } catch (error) {
    log('A critical error in runAnalysis: ' + error.message, error);
  }
}

// Zeptá se API na aktuální stav a vykreslí ho
async function fetchAndDisplayAnalysis(url) {
    const apiEndpoint = 'https://api.wai.ventureout.cz/analyze';
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });
        const data = await response.json();
        log('Fetched data for display', data);

        if (data.status === 'completed') {
            renderAnalysis(data);
        } else {
            analysisContent.innerHTML = '<p>Analýza probíhá, za chvíli zde uvidíte výsledky...</p>';
        }
    } catch (error) {
        analysisContent.innerHTML = '<p>Nepodařilo se načíst data analýzy. Zkuste to prosím znovu.</p>';
        log('Error fetching display data:', error);
    }
}

// Vykreslí data do záložky Analýza
function renderAnalysis(data) {
    const { pageAura, domainAura } = data;
    // Zde bude komplexnější kód pro vykreslení hvězdy (např. pomocí SVG)
    // Prozatím zobrazíme textová data
    analysisContent.innerHTML = `
        <div class="aura-section">
            <h3>Aura Této Stránky</h3>
            <div class="circle" style="background-color: ${pageAura.circle.color};"></div>
            <p><strong>Úmysl:</strong> ${pageAura.circle.intent}</p>
            <h4>Stav (Hvězda):</h4>
            <ul>
                ${Object.entries(pageAura.star).map(([key, value]) => 
                    `<li><strong>${key}:</strong> ${value.value}% (jistota: ${value.saturation}%)</li>`
                ).join('')}
            </ul>
        </div>
        <div class="aura-section">
            <h3>Aura Celé Domény</h3>
            <div class="circle" style="background-color: ${domainAura.color};"></div>
            <p><strong>Dominantní úmysl:</strong> ${domainAura.intent}</p>
        </div>
    `;
}

// ... (zbytek souboru: getUserId, setupUIListeners, load/save settings, log) ...


async function getUserId() {
  log('Entering getUserId...');
  let { userId } = await chrome.storage.local.get('userId');
  if (!userId) {
    log('No userId found, generating a new one...');
    userId = crypto.randomUUID();
    await chrome.storage.local.set({ userId });
  } else {
    log(`Found existing userId: ${userId}`);
  }
  return userId;
}

