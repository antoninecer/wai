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
        localizeHtmlElements(); // Nově: lokalizace HTML elementů
        setupUIListeners();
        rawLog('UI listeners attached.');
        initializeApp();
    } catch (e) {
        rawLog('A critical error occurred during initialization!', e);
    }
});

function localizeHtmlElements() {
    document.title = chrome.i18n.getMessage("appName");
    document.getElementById('tabAnalysisBtn').textContent = chrome.i18n.getMessage("tabAnalysis");
    document.getElementById('tabSettingsBtn').textContent = chrome.i18n.getMessage("tabSettings");
    document.getElementById('tabDebugBtn').textContent = chrome.i18n.getMessage("tabDebug");

    document.getElementById('analysisPlaceholderText').textContent = chrome.i18n.getMessage("analysisPlaceholder");
    document.getElementById('reanalyze-button').textContent = chrome.i18n.getMessage("reanalyzeButton");

    document.getElementById('settingsInterestsLabel').textContent = chrome.i18n.getMessage("settingsInterestsLabel");
    document.getElementById('settingsExclusionsLabel').textContent = chrome.i18n.getMessage("settingsExclusionsLabel");
    document.getElementById('settingsAuraIntensityLabel').textContent = chrome.i18n.getMessage("settingsAuraIntensityLabel");
    document.getElementById('settingsPreviewMethodLabel').textContent = chrome.i18n.getMessage("settingsPreviewMethodLabel");
    document.getElementById('labelPreviewOnHover').textContent = chrome.i18n.getMessage("settingsPreviewOnHover");
    document.getElementById('labelPreviewOnContext').textContent = chrome.i18n.getMessage("settingsPreviewOnContext");
    document.getElementById('labelPreviewOff').textContent = chrome.i18n.getMessage("settingsPreviewOff");
    document.getElementById('settingsDebugLabel').textContent = chrome.i18n.getMessage("settingsDebugLabel");
    document.getElementById('saveSettings').textContent = chrome.i18n.getMessage("settingsSaveButton");
    document.getElementById('toggle-legend').textContent = chrome.i18n.getMessage("settingsShowLegend");

    // Inicializace textu pro reanalyze button (aby nebyl prázdný před analýzou)
    const reanalyzeBtn = document.getElementById('reanalyze-button');
    if (reanalyzeBtn) reanalyzeBtn.textContent = chrome.i18n.getMessage("reanalyzeButton");

    rawLog('HTML elements localized.');
}

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
    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            if (document.getElementById(targetTab)) {
                document.getElementById(targetTab).classList.add('active');
            }
        });
    });

    // Save settings button listener
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
        saveButton.addEventListener('click', saveSettings);
    }
    
    // Color legend toggle
    const toggleLegend = document.getElementById('toggle-legend');
    if(toggleLegend) {
        toggleLegend.addEventListener('click', (e) => {
            e.preventDefault();
            const legendContainer = document.getElementById('color-legend-container');
            if(legendContainer) {
                legendContainer.style.display = legendContainer.style.display === 'none' ? 'block' : 'none';
            }
        });
    }
}

async function loadSettings() {
    try {
        const data = await chrome.storage.sync.get('waiSettings');
        const defaultSettings = {
            interests: 'AI, programování, startupy',
            exclusions: 'rychlé půjčky, hazard',
            auraIntensity: 75,
            previewMethod: 'hover', // 'hover', 'context', or 'off'
            debugLog: true,
        };
        
        window.settings = { ...defaultSettings, ...data.waiSettings };

        // Populate UI
        document.getElementById('interests').value = window.settings.interests;
        document.getElementById('exclusions').value = window.settings.exclusions;
        document.getElementById('auraIntensity').value = window.settings.auraIntensity;
        document.getElementById('debugLog').checked = window.settings.debugLog;
        
        const previewMethodEl = document.querySelector(`input[name="previewMethod"][value="${window.settings.previewMethod}"]`);
        if (previewMethodEl) {
            previewMethodEl.checked = true;
        }

        generateColorLegend();
        log('Settings loaded and UI populated.', window.settings);

    } catch (error) {
        log('Error loading settings.', error);
        window.settings = { debugLog: true }; // Fallback
    }
}

async function saveSettings() {
    log('Attempting to save settings...');
    try {
        const previewMethodEl = document.querySelector('input[name="previewMethod"]:checked');
        const newSettings = {
            interests: document.getElementById('interests').value,
            exclusions: document.getElementById('exclusions').value,
            auraIntensity: document.getElementById('auraIntensity').value,
            previewMethod: previewMethodEl ? previewMethodEl.value : 'hover',
            debugLog: document.getElementById('debugLog').checked,
        };

        await chrome.storage.sync.set({ waiSettings: newSettings });
        window.settings = newSettings;
        log('Settings successfully saved.', newSettings);
        
        const saveButton = document.getElementById('saveSettings');
        if (saveButton) {
            saveButton.textContent = chrome.i18n.getMessage("settingsSaveButtonSuccess") || 'Uloženo!';
            setTimeout(() => { saveButton.textContent = chrome.i18n.getMessage("settingsSaveButton"); }, 2000);
        }
        
        // Inform content script about the changes
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { type: "SETTINGS_UPDATED", settings: newSettings });
        }

    } catch (error) {
        log('Error saving settings.', error);
    }
}

function generateColorLegend() {
    const legendKeys = {
        'Zelený': 'legendGreen', 'Žlutý': 'legendYellow', 'Modrý': 'legendBlue',
        'Fialový': 'legendPurple', 'Červený': 'legendRed', 'Zlatý': 'legendGold'
    };

    let html = '<div id="color-legend-container" style="display:none; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">';
    for (const [color, key] of Object.entries(legendKeys)) {
        html += `<p style="font-size: 12px; margin: 2px 0;"><strong>${color}:</strong> ${chrome.i18n.getMessage(key)}</p>`;
    }
    html += '</div>';
    
document.getElementById('color-legend').insertAdjacentHTML('beforeend', html);
}


// =================================================================================
// Logika Analýzy a Vykreslování
// =================================================================================

async function runAnalysis(force = false) {
    log('Querying for active tab...');
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            analysisContent.innerHTML = `<p>${chrome.i18n.getMessage("noActiveTab")}</p>`;
            return;
        }
        const tab = tabs[0];
        const url = tab.url;

        if (!url || (!url.startsWith('http:') && !url.startsWith('https:'))) {
            analysisContent.innerHTML = `<p>${chrome.i18n.getMessage("analysisNotSupported")}</p>`;
            return;
        }

        const userId = await getUserId();
        await fetchAndDisplayAnalysis(url, userId, force);

    } catch (error) {
        log('Error in runAnalysis.', error);
        analysisContent.innerHTML = `<p>${chrome.i18n.getMessage("analysisFailedGeneric")}</p>`;
    }
}

async function fetchAndDisplayAnalysis(url, userId, force = false) {
    analysisContent.innerHTML = `<p>${chrome.i18n.getMessage("analyzingPage")}</p>`;
    log(`Fetching analysis for ${url}, force: ${force}`);

    try {
        const response = await fetch('https://api.wai.ventureout.cz/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                userId,
                interests: window.settings.interests,
                exclusions: window.settings.exclusions,
                force_recrawl: force // Přidáme parametr pro vynucení
            }),
        });

        if (!response.ok) throw new Error(`API returned status ${response.status}`);
        const data = await response.json();
        log('Analysis data received from API.', data);
        
        renderAnalysis(data);
        
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: "AURA_DATA_UPDATE",
                pageAura: data.pageAura,
                domainAura: data.domainAura
            });
        }
    } catch (error) {
        log('Error fetching analysis.', error);
        analysisContent.innerHTML = `<p>${chrome.i18n.getMessage("analysisFailedApiError")}</p>`;
    }
}

function renderAnalysis(data) {
    // ... (kód pro status 'pending' zůstává stejný) ...

    // Destrukturace s přejmenováním, abychom se vyvarovali kolizí
    const { domainAura, pageAura } = data;
    const { star: starData, circle: pageCircle, content_map } = pageAura;
    
    // ... (kód pro přípravu dat hvězdy a popisků zůstává stejný) ...
    const orderedRays = ['stability', 'flow', 'will', 'relation', 'voice', 'meaning', 'integrity'].map(key => {
        const ray = starData[key];
        return { score: ray ? ray.value : 0, confidence: ray ? ray.saturation / 100 : 0.5 };
    });
    const topics = content_map.key_topics || [];
    // Nyní by měl být v pageCircle.intent správný text
    const explanationText = pageCircle.intent || chrome.i18n.getMessage("analysisGenericDesc");

    // ... (kód pro vykreslení hvězdy - createStarPath, starRays - zůstává stejný) ...

    analysisContent.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <div style="position: relative; width: 100px; height: 100px;">
                <!-- Vnější kruh - Aura Domény -->
                <div style="position: absolute; top: 0; left: 0; width: 100px; height: 100px; border-radius: 50%; background-color: ${domainAura.color}; opacity: 0.7;"></div>
                <!-- Vnitřní kruh - Aura Stránky -->
                <div style="position: absolute; top: 10px; left: 10px; width: 80px; height: 80px; border-radius: 50%; background-color: ${pageCircle.color}; opacity: 1; border: 2px solid white;"></div>
                <!-- Hvězda -->
                <svg viewBox="0 0 100 100" style="position: relative; z-index: 1;">
                    ${starRays}
                </svg>
            </div>
            <div>
                <h3 style="margin: 0 0 5px 0;">${pageCircle.color} Aura</h3>
                <p style="margin: 0; font-size: 13px;">${explanationText}</p>
                <a href="#" id="toggle-star-details" style="font-size: 11px; color: #007bff;">[Zobrazit detaily hvězdy]</a>
            </div>
        </div>
        <div id="star-details-container" style="display:none; margin-top: 15px; border-top: 1px solid #ddd; padding-top: 10px;"></div>
        <div style="margin-top: 15px;">
            <strong>Klíčová témata:</strong>
            <p style="font-size: 12px; color: #555;">${topics.join(', ')}</p>
        </div>
        <div style="margin-top: 10px;">
             <a href="#" id="toggle-structure" style="font-size: 12px;">Zobrazit strukturu obsahu</a>
        </div>
        <div id="structure-container" style="display:none; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 5px;"></div>
    `;

    // Přidání interaktivity pro zobrazení detailů hvězdy
    document.getElementById('toggle-star-details').addEventListener('click', (e) => {
        e.preventDefault();
        const detailsContainer = document.getElementById('star-details-container');
        if (detailsContainer.style.display === 'none') {
            const aspectNames = ['Stabilita', 'Tok', 'Vůle', 'Vztah', 'Hlas', 'Smysl', 'Integrita'];
            let detailsHtml = '<h4>Detailní rozpis aury:</h4>';
            orderedRays.forEach((ray, i) => {
                detailsHtml += `<p style="font-size: 12px; margin: 4px 0;"><strong>${aspectNames[i]}:</strong> ${ray.score}/100</p>`;
            });
            detailsContainer.innerHTML = detailsHtml;
            detailsContainer.style.display = 'block';
            e.target.textContent = '[Skrýt detaily]';
        } else {
            detailsContainer.style.display = 'none';
            e.target.textContent = '[Zobrazit detaily hvězdy]';
        }
    });

    // ... (zbytek kódu pro strukturu obsahu a re-analýzu zůstává stejný) ...
}async function getUserId() {
    try {
        const data = await chrome.storage.sync.get('userId');
        if (data.userId) {
            log(`Retrieved existing userId: ${data.userId}`);
            return data.userId;
        } else {
            const newUserId = `wai-user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await chrome.storage.sync.set({ userId: newUserId });
            log(`Generated and stored new userId: ${newUserId}`);
            return newUserId;
        }
    } catch (error) {
        log('Error getting or setting userId in chrome.storage.sync.', error);
        // Fallback to a temporary ID if storage fails
        return `wai-user-temporary-${Date.now()}`;
    }
}

// Přepsaná logovací funkce, která respektuje nastavení
function log(message, data = null) {
    if (!settings.debugLog) return;
    rawLog(message, data);
}

