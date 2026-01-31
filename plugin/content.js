// --- Globální proměnné a konstanty ---
const API_ENDPOINT = "https://api.wai.ventureout.cz/analyze";
let analysisInterval = null;
const linkAuraMap = new Map(); // Mapa pro uchování aury odkazů

// =================================================================================
// Vytvoření a vložení vlastního kontextového menu
// =================================================================================
const waiContextMenu = document.createElement("div");
waiContextMenu.id = "wai-context-menu";
waiContextMenu.style.display = "none";
waiContextMenu.style.position = "fixed";
waiContextMenu.style.zIndex = "2147483647";
waiContextMenu.style.border = "1px solid #ccc";
waiContextMenu.style.backgroundColor = "#f9f9f9";
waiContextMenu.style.borderRadius = "8px";
waiContextMenu.style.padding = "10px";
waiContextMenu.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
waiContextMenu.style.fontFamily = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif";
waiContextMenu.style.fontSize = "14px";
waiContextMenu.style.color = "#333";
waiContextMenu.style.width = "280px";
waiContextMenu.style.pointerEvents = "none"; // Menu samotné nereaguje na kliknutí

document.body.appendChild(waiContextMenu);

// Skrytí menu při kliknutí kamkoliv jinam
window.addEventListener("click", () => {
    if (waiContextMenu.style.display === "block") {
        waiContextMenu.style.display = "none";
    }
});

// --- Globální proměnné a konstanty ---
const API_ENDPOINT = 'https://api.wai.ventureout.cz/analyze';
let analysisInterval = null;

// =================================================================================
// Inicializace
// =================================================================================

// Po načtení stránky ihned zkontrolujeme, zda neprobíhá analýza
checkForPendingAnalysis();

// =================================================================================
// Posluchači zpráv
// =================================================================================

// Naslouchá na zprávy z popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.greeting === "dejMiData") {
        // Fáze 1: Začínáme analýzu
        chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '?' });
        
        const collectedData = {
            url: window.location.href,
            title: document.title,
            linkCount: document.getElementsByTagName('a').length,
            internalLinks: Array.from(document.getElementsByTagName('a')).filter(link => link.href.includes(window.location.hostname)).length,
            externalLinks: Array.from(document.getElementsByTagName('a')).filter(link => !link.href.includes(window.location.hostname)).length,
            imageCount: document.getElementsByTagName('img').length,
            h1Headings: Array.from(document.getElementsByTagName('h1')).map(h => h.innerText),
            h2Headings: Array.from(document.getElementsByTagName('h2')).map(h => h.innerText),
            paragraphCount: document.getElementsByTagName('p').length
        };
        sendResponse({ data: collectedData });
    }
    // Starší typy zpráv necháváme prozatím pro kompatibilitu, ale budeme je odstraňovat
    else if (request.type === "AURA_DATA_UPDATE") {
      applyAuraToLinks(request.pageAura.links);
      chrome.runtime.sendMessage({ type: 'SET_BADGE', color: request.domainAura.color, text: '✓' });
    }
    return true;
});


// =================================================================================
// Logika pro automatické obnovování a fázování
// =================================================================================

// Zkontroluje, zda pro tuto stránku běží analýza uložená v local storage
async function checkForPendingAnalysis() {
    const { analysisInProgress } = await chrome.storage.local.get('analysisInProgress');
    if (analysisInProgress && analysisInProgress.url === window.location.href) {
        startPolling();
    }
}

// Spustí periodické dotazování na API
function startPolling() {
    if (analysisInterval) return;

    // Okamžitě nastavíme badge na "čekání"
    chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '...' });

    analysisInterval = setInterval(async () => {
        try {
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: window.location.href })
            });
            const data = await response.json();

            if (data.status === 'completed') {
                // Fáze 3: Kompletní obraz
                console.log('[WAI] Auto-update: Analysis complete. Applying aura.');
                applyAuraToLinks(data.pageAura.links);
                // Badge se nastaví na barvu domény a smaže text
                chrome.runtime.sendMessage({ type: 'SET_BADGE', color: data.domainAura.color, text: '' });
                
                stopPolling();
                await chrome.storage.local.remove('analysisInProgress');

            } else if (data.status === 'analyzing_page') { 
                // Fáze 2: Náhled stránky (tento stav musíme přidat do API)
                console.log('[WAI] Auto-update: Page analysis complete.');
                // Zde bychom ideálně měli data jen pro stránku
                // applyPageAura(data.pageAura);
                chrome.runtime.sendMessage({ type: 'SET_BADGE', color: data.pageAura.circle.color, text: '1/2' });

            } else { // analyzing_domain
                console.log('[WAI] Auto-update: Domain analysis in progress...');
                chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '...' });
            }
        } catch (error) {
            console.error('[WAI] Auto-update: Error polling for analysis:', error);
            stopPolling();
        }
    }, 3000); // interval 3 sekundy
}

function stopPolling() {
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
    }
}

// Funkce pro aplikování aury na odkazy
function applyAuraToLinks(linksData) {
    if (!linksData) return;
    const allLinks = document.querySelectorAll('a[href]');

    // 1. Naplníme mapu daty z API
    linksData.forEach(link => {
        try {
            const absoluteUrl = new URL(link.url).href;
            linkAuraMap.set(absoluteUrl, link.aura);
        } catch(e) { /* ignorovat neplatné URL */ }
    });

    // 2. Projdeme odkazy na stránce a aplikujeme styl
    allLinks.forEach(linkElement => {
        let absoluteUrl;
        try {
            absoluteUrl = new URL(linkElement.href).href;
        } catch (e) { return; }

        const aura = linkAuraMap.get(absoluteUrl);
        if (aura && aura.circle) {
            const color = aura.circle.color === 'white' ? '#cccccc' : aura.circle.color;
            linkElement.style.textShadow = `0 0 3px ${color}, 0 0 5px ${color}`;
            linkElement.style.transition = 'text-shadow 0.3s ease-in-out';
            linkElement.dataset.waiAuraApplied = 'true'; // Označíme odkaz
        }
    });
}

// =================================================================================
// Logika pro zobrazení vlastního kontextového menu
// =================================================================================

document.addEventListener('contextmenu', (event) => {
    // Cílíme pouze na odkazy, které jsme označili
    const targetLink = event.target.closest('a[data-wai-aura-applied="true"]');
    if (!targetLink) {
        waiContextMenu.style.display = 'none';
        return;
    }

    event.preventDefault(); // Zabráníme zobrazení výchozího menu

    const url = new URL(targetLink.href).href;
    const aura = linkAuraMap.get(url);

    if (aura) {
        renderWaiContextMenu(aura, event.clientX, event.clientY);
    }
});


function renderWaiContextMenu(aura, x, y) {
    const { circle, star } = aura;

    // Pokud nemáme data o hvězdě (starší verze API), vytvoříme placeholder
    const starData = star || {
        stability: { value: 50, saturation: 50 },
        relation: { value: 50, saturation: 50 },
        meaning: { value: 50, saturation: 50 }
    };
    
    const orderedRays = ['stability', 'flow', 'will', 'relation', 'voice', 'meaning', 'integrity'].map(key => {
        const ray = starData[key];
        return { score: ray ? ray.value : 0, confidence: ray ? ray.saturation / 100 : 0.5 };
    });

    const createStarPath = (rays) => {
        const points = [];
        const centerX = 20, centerY = 20, numPoints = 7;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i * 2 * Math.PI / numPoints) - (Math.PI / 2);
            const length = 2 + (rays[i].score / 100 * 16);
            points.push(`${centerX + length * Math.cos(angle)},${centerY + length * Math.sin(angle)}`);
        }
        return points.join(' ');
    };

    const starPoints = createStarPath(orderedRays);
    const intentText = circle.intent || 'Základní aura odkazu.';
    
    waiContextMenu.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
                <div style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; border-radius: 50%; background-color: ${circle.color}; opacity: 0.8;"></div>
                <svg viewBox="0 0 40 40" style="position: relative; z-index: 1;">
                    <polygon points="${starPoints}" fill="rgba(128, 128, 128, 0.5)" stroke="#FFFFFF" stroke-width="0.5" />
                </svg>
            </div>
            <div>
                <strong style="display: block; margin-bottom: 2px;">Aura Cíle</strong>
                <p style="margin: 0; font-size: 12px;">${intentText}</p>
            </div>
        </div>
    `;

    // Zobrazíme menu na správné pozici
    waiContextMenu.style.left = `${x + 5}px`;
    waiContextMenu.style.top = `${y + 5}px`;
    waiContextMenu.style.display = 'block';
}
