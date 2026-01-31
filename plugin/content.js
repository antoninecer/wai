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
    if(!linksData) return;
    const allLinks = document.querySelectorAll('a[href]');
    const linkMap = new Map(linksData.map(link => [link.url, link.aura.circle.color]));

    allLinks.forEach(linkElement => {
        let absoluteUrl;
        try {
            absoluteUrl = new URL(linkElement.href).href;
        } catch (e) { return; }

        const auraColor = linkMap.get(absoluteUrl);
        if (auraColor) {
            const color = auraColor === 'white' ? '#cccccc' : auraColor;
            linkElement.style.textShadow = `0 0 3px ${color}, 0 0 5px ${color}`;
            linkElement.style.transition = 'text-shadow 0.3s ease-in-out';
        }
    });
}
