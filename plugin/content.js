// --- Globální proměnné ---
let settings = {};
const linkAuraMap = new Map();
let lastMousePosition = { x: 0, y: 0 };
let auraPreviewEl = null; // Reference na tooltip, abychom ho mohli snadno ovládat

// =================================================================================
// Inicializace a načtení nastavení
// =================================================================================
async function initialize() {
    const data = await chrome.storage.sync.get('waiSettings');
    const defaultSettings = { previewMethod: 'hover', auraIntensity: 75 };
    settings = { ...defaultSettings, ...data.waiSettings };
    
    // Na základě nastavení připojíme správné listenery
    updateEventListeners();
}

function updateEventListeners() {
    // Odstraníme staré listenery, abychom předešli duplikaci
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseout', handleMouseOut);

    if (settings.previewMethod === 'hover') {
        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mouseout', handleMouseOut);
    }
}

// =================================================================================
// Sledování pozice myši (pro kontextové menu)
// =================================================================================
document.addEventListener('mousedown', (event) => {
    lastMousePosition = { x: event.clientX, y: event.clientY };
}, true);

// =================================================================================
// Posluchači zpráv a událostí
// =================================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "REQUEST_AURA_ANALYSIS") {
        initiateAnalysis();
    } else if (request.type === "AURA_DATA_UPDATE") {
        applyAuraToLinks(request.pageAura.links);
        if (request.domainAura) chrome.runtime.sendMessage({ type: 'SET_BADGE', color: request.domainAura.color, text: '✓' });
    } else if (request.type === "SHOW_AURA_PREVIEW" && settings.previewMethod === 'context') {
        const aura = linkAuraMap.get(request.url);
        if (aura) showAuraPreview(aura, lastMousePosition.x, lastMousePosition.y, true);
    } else if (request.type === "SETTINGS_UPDATED") {
        settings = request.settings;
        updateEventListeners(); // Aktualizujeme listenery podle nových nastavení
        applyAuraToLinks([]); // Znovu aplikujeme auru pro případ změny intenzity
    }
    return true;
});

function handleMouseOver(event) {
    const targetLink = event.target.closest('a[data-wai-aura-applied="true"]');
    if (!targetLink) return;

    const normalizedHref = new URL(targetLink.href).href.split('#')[0];
    const aura = linkAuraMap.get(normalizedHref);
    if (aura) {
        // Zobrazíme tooltip s mírným zpožděním
        setTimeout(() => {
            // Zkontrolujeme, zda je myš stále na odkazu
            if (targetLink.matches(':hover')) {
                 showAuraPreview(aura, event.clientX, event.clientY, false);
            }
        }, 300);
    }
}

function handleMouseOut() {
    if (auraPreviewEl) {
        auraPreviewEl.remove();
        auraPreviewEl = null;
    }
}

// ... (zbytek funkcí jako initiateAnalysis, applyAuraToLinks, showAuraPreview) ...
// Musíme upravit applyAuraToLinks a showAuraPreview, aby respektovaly intenzitu

function applyAuraToLinks(linksData) {
    // Při prázdném volání jen znovu aplikujeme styly
    if (linksData && linksData.length > 0) {
        linksData.forEach(link => {
            try {
                const normalizedUrl = new URL(link.url).href.split('#')[0];
                linkAuraMap.set(normalizedUrl, link.aura);
            } catch(e) {}
        });
    }

    const allLinks = document.querySelectorAll('a[href]');
    const intensity = (settings.auraIntensity || 75) / 25; // převedeme 10-100 na cca 0.4-4

    allLinks.forEach(linkElement => {
        try {
            const normalizedHref = new URL(linkElement.href).href.split('#')[0];
            const aura = linkAuraMap.get(normalizedHref);
            if (aura && aura.circle) {
                const color = aura.circle.color === 'white' ? '#cccccc' : aura.circle.color;
                linkElement.style.textShadow = `0 0 ${intensity}px ${color}, 0 0 ${intensity*2}px ${color}`;
                linkElement.style.transition = 'text-shadow 0.3s ease-in-out';
                linkElement.dataset.waiAuraApplied = 'true';
            } else {
                 linkElement.style.textShadow = '';
                 delete linkElement.dataset.waiAuraApplied;
            }
        } catch (e) { /* ignorovat neplatné URL */ }
    });
}


function showAuraPreview(aura, x, y, isContext) {
    if (auraPreviewEl) auraPreviewEl.remove();

    auraPreviewEl = document.createElement("div");
    Object.assign(auraPreviewEl.style, {
        display: "block", position: "fixed", zIndex: "2147483647",
        border: "1px solid #ccc", backgroundColor: "#f9f9f9", borderRadius: "8px",
        padding: "10px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
        fontSize: "14px", color: "#333", width: "280px",
        left: `${x + 10}px`, top: `${y + 10}px`,
        pointerEvents: isContext ? 'auto' : 'none' // Tooltip nereaguje na myš
    });
    
    // Vykreslení obsahu
    const { circle, star } = aura;
    const starData = star || {};
    const orderedRays = ['stability', 'flow', 'will', 'relation', 'voice', 'meaning', 'integrity'].map(k => { const r=starData[k]; return { score:r?r.value:0, c:r?r.saturation/100:0.5}; });
    const createStarPath = (r) => { let p=[],cX=20,cY=20,n=7; for(let i=0;i<n;i++){ const a=(i*2*Math.PI/n)-(Math.PI/2),l=2+(r[i].score/100*16); p.push(`${cX+l*Math.cos(a)},${cY+l*Math.sin(a)}`); } return p.join(' '); };
    const starPoints = createStarPath(orderedRays);
    const intentText = circle.intent || 'Základní aura odkazu.';
    
    auraPreviewEl.innerHTML = `<div style="display: flex; align-items: center; gap: 10px;"><div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;"><div style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; border-radius: 50%; background-color: ${circle.color}; opacity: 0.8;"></div><svg viewBox="0 0 40 40" style="position: relative; z-index: 1;"><polygon points="${starPoints}" fill="rgba(128, 128, 128, 0.5)" stroke="#FFFFFF" stroke-width="0.5" /></svg></div><div><strong style="display: block; margin-bottom: 2px;">Aura Cíle</strong><p style="margin: 0; font-size: 12px;">${intentText}</p></div></div>`;
    
    document.body.appendChild(auraPreviewEl);

    if(isContext) {
         setTimeout(() => { document.addEventListener('click', () => auraPreviewEl.remove(), { once: true }); }, 10);
    }
}

// Spustíme inicializaci po načtení skriptu
initialize();

// ... zbytek souboru (initiateAnalysis) ...
async function initiateAnalysis() {
    console.log('[WAI] Initiating analysis...');
    chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '?' });
    try {
        const response = await fetch("https://api.wai.ventureout.cz/analyze", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: window.location.href, interests: settings.interests, exclusions: settings.exclusions })
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        if (data.status === 'completed' && data.pageAura) {
            applyAuraToLinks(data.pageAura.links);
            if (data.domainAura) chrome.runtime.sendMessage({ type: 'SET_BADGE', color: data.domainAura.color, text: '✓' });
        } else {
             chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '...' });
        }
    } catch (error) {
        console.error('[WAI] Analysis request failed:', error);
        chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#FF0000', text: 'X' });
    }
}
