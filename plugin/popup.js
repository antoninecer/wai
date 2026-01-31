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
    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate the clicked tab
            button.classList.add('active');
            if (document.getElementById(targetTab)) {
                document.getElementById(targetTab).classList.add('active');
            }
        });
    });

    // Save settings button listener
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            saveSettings();
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
            parchmentEffect: true,
            buttonAuras: true,
            debugLog: true,
        };
        
        // Merge stored settings with defaults
        window.settings = { ...defaultSettings, ...data.waiSettings };

        // Populate UI - null check elements first
        if (interestsEl) interestsEl.value = window.settings.interests;
        if (exclusionsEl) exclusionsEl.value = window.settings.exclusions;
        if (auraIntensityEl) auraIntensityEl.value = window.settings.auraIntensity;
        if (parchmentEffectEl) parchmentEffectEl.checked = window.settings.parchmentEffect;
        if (buttonAurasEl) buttonAurasEl.checked = window.settings.buttonAuras;
        if (debugLogEl) debugLogEl.checked = window.settings.debugLog;

        log('Settings loaded and UI populated.', window.settings);

    } catch (error) {
        log('Error loading settings from chrome.storage.sync.', error);
        // In case of error, use defaults
        window.settings = {
            debugLog: true,
        };
    }
}

async function saveSettings() {
    log('Attempting to save settings...');
    try {
        const newSettings = {
            interests: interestsEl ? interestsEl.value : '',
            exclusions: exclusionsEl ? exclusionsEl.value : '',
            auraIntensity: auraIntensityEl ? auraIntensityEl.value : 75,
            parchmentEffect: parchmentEffectEl ? parchmentEffectEl.checked : true,
            buttonAuras: buttonAurasEl ? buttonAurasEl.checked : true,
            debugLog: debugLogEl ? debugLogEl.checked : true,
        };

        await chrome.storage.sync.set({ waiSettings: newSettings });
        window.settings = newSettings;

        log('Settings successfully saved.', newSettings);
        
        // Visual feedback
        if (saveButton) {
            saveButton.textContent = 'Uloženo!';
            setTimeout(() => { saveButton.textContent = 'Uložit nastavení'; }, 2000);
        }

    } catch (error) {
        log('Error saving settings to chrome.storage.sync.', error);
        if (saveButton) {
            saveButton.textContent = 'Chyba!';
            saveButton.style.backgroundColor = 'red';
            setTimeout(() => { 
                saveButton.textContent = 'Uložit nastavení'; 
                saveButton.style.backgroundColor = '';
            }, 3000);
        }
    }
}


// =================================================================================
// Logika Analýzy a Vykreslování
// =================================================================================

async function runAnalysis() {
    log('Querying for active tab...');
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) {
            analysisContent.innerHTML = '<p>Nelze najít aktivní kartu. Zkuste to prosím znovu.</p>';
            log('No active tab found.');
            return;
        }
        const tab = tabs[0];
        const url = tab.url;

        // Validace URL
        if (!url || (!url.startsWith('http:') && !url.startsWith('https:'))) {
            analysisContent.innerHTML = `<p>Analýza pro tuto URL není podporována:<br><em>${url}</em></p>`;
            log(`Invalid URL for analysis: ${url}`);
            return;
        }

        log(`Active tab found: ${url}`);
        const userId = await getUserId();
        await fetchAndDisplayAnalysis(url, userId);

    } catch (error) {
        log('Error querying for active tab.', error);
        analysisContent.innerHTML = '<p>Došlo k chybě při získávání informací o kartě.</p>';
    }
}

async function fetchAndDisplayAnalysis(url, userId) {
    analysisContent.innerHTML = '<p>Analyzuji auru stránky...</p>';
    log(`Fetching analysis for ${url} with userId: ${userId}`);

    try {
        const response = await fetch('https://api.wai.ventureout.cz/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Přidáme zájmy a exkluze do těla požadavku
            body: JSON.stringify({ 
                url, 
                userId,
                interests: window.settings.interests,
                exclusions: window.settings.exclusions
            }),
        });

        if (!response.ok) {
            throw new Error(`API returned status ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        log('Analysis data received from API.', data);
        
        // 1. Render the popup visuals
        renderAnalysis(data);

        // 2. Send data to content script to highlight links
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                type: "AURA_DATA_UPDATE",
                pageAura: data.pageAura,
                domainAura: data.domainAura
            });
            log('Sent AURA_DATA_UPDATE to content script.');
        }

    } catch (error) {
        log('Error fetching or processing analysis.', error);
        analysisContent.innerHTML = `<p>Analýza selhala. Server vrátil chybu.</p><pre style="font-size: 10px; color: red;">${error.message}</pre>`;
    }
}

function renderAnalysis(data) {
    // If analysis is still pending on the server
    if (data.status === 'pending' || data.status === 'in_progress' || !data.pageAura) {
        analysisContent.innerHTML = `
            <p>Analýza této stránky stále probíhá...</p>
            <p>Stav: <strong>${data.status || 'čeká se'}</strong></p>
            <p>Zkuste to prosím znovu za chvíli.</p>
        `;
        log('Rendered pending status.');
        return;
    }

    // If analysis is complete, destructure from the correct object: pageAura
    const { star: starData, circle: aura_circle, content_map } = data.pageAura;

    // --- Data Transformation ---
    // The API returns star data as an object, but the rendering logic needs an array of rays in a specific order.
    // Order from spec: 1.Stabilita, 2.Tok, 3.Vůle, 4.Vztah, 5.Hlas, 6.Smysl, 7.Integrita
    const starApiMap = {
        stability: starData.stability, // 1.
        flow: starData.flow,           // 2.
        will: starData.will,           // 3.
        relation: starData.relation,   // 4.
        voice: starData.voice,         // 5.
        meaning: starData.meaning,     // 6.
        integrity: starData.integrity  // 7.
    };
    
    const orderedRays = ['stability', 'flow', 'will', 'relation', 'voice', 'meaning', 'integrity'];
    const aura_star_rays = orderedRays.map(key => {
        const rayData = starApiMap[key];
        return {
            score: rayData ? rayData.value : 0,
            confidence: rayData ? rayData.saturation / 100 : 0.5 // Convert 0-100 scale to 0-1
        };
    });
    // --- End Transformation ---

    const topics = content_map.key_topics || [];
    // API doesn't provide an explanation, so we'll use the circle's intent as a placeholder.
    const explanation = { summary: aura_circle.intent || "Analýza dokončena." };


    // Helper function to create the SVG path for the star
    const createStarPath = (rays) => {
        const points = [];
        const centerX = 50;
        const centerY = 50;
        const numPoints = 7;

        for (let i = 0; i < numPoints; i++) {
            const score = rays[i].score / 100;
            const angle = (i * 2 * Math.PI / numPoints) - (Math.PI / 2); 
            const length = 5 + (score * 40); 
            
            const x = centerX + length * Math.cos(angle);
            const y = centerY + length * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    };
    
    const starPoints = createStarPath(aura_star_rays);
    
    const rayColors = ["#FF4136", "#FF851B", "#FFDC00", "#2ECC40", "#0074D9", "#B10DC9", "#FFFFFF"];

    const starRays = aura_star_rays.map((ray, i) => {
        const angle = (i * 2 * Math.PI / 7) - (Math.PI / 2);
        const L = 5 + ((ray.score / 100) * 40);
        const x2 = 50 + L * Math.cos(angle);
        const y2 = 50 + L * Math.sin(angle);
        
        return `<line x1="50" y1="50" x2="${x2}" y2="${y2}" stroke="${rayColors[i]}" stroke-width="2" opacity="${ray.confidence}" />`;
    }).join('');

    analysisContent.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <div style="position: relative; width: 100px; height: 100px;">
                <div style="
                    position: absolute;
                    top: 0; left: 0;
                    width: 100px; height: 100px;
                    border-radius: 50%;
                    background-color: ${aura_circle.color};
                    opacity: 0.8;">
                </div>
                <svg viewBox="0 0 100 100" style="position: relative; z-index: 1;">
                    <polygon points="${starPoints}" fill="rgba(128, 128, 128, 0.5)" stroke="#FFFFFF" stroke-width="1" />
                    ${starRays}
                </svg>
            </div>
            <div>
                <h3 style="margin: 0 0 5px 0;">Aura: ${aura_circle.intent || 'Neznámá'}</h3>
                <p style="margin: 0; font-size: 13px;">${explanation.summary}</p>
            </div>
        </div>
        <div style="margin-top: 15px;">
            <strong>Klíčová témata:</strong>
            <p style="font-size: 12px; color: #555;">${topics.join(', ')}</p>
        </div>
    `;
    log('Analysis render complete.');
}

async function getUserId() {
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

