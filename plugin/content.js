let settings = {};
let linkAuraMap = new Map();
let pollingInterval = null;
let lastMousePosition = { x: 0, y: 0 };

async function initialize() {
    const data = await chrome.storage.sync.get('waiSettings');
    settings = { previewMethod: 'hover', auraIntensity: 75, ...data.waiSettings };
    updateEventListeners();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "REQUEST_AURA_ANALYSIS") {
        initiateAnalysis();
    } else if (request.type === "AURA_DATA_UPDATE") {
        applyAuraToLinks(request.links, request.isPreliminary);
    } else if (request.type === "SHOW_AURA_PREVIEW" && settings.previewMethod === 'context') {
        const aura = linkAuraMap.get(request.url);
        if (aura) showAuraPreview(aura, lastMousePosition.x, lastMousePosition.y, true);
    } else if (request.type === "SETTINGS_UPDATED") {
        settings = request.settings;
        updateEventListeners();
        applyAuraToLinks([], false); // Re-apply styles with new intensity
    }
    return true;
});

function collectInitialData() {
    return {
        url: window.location.href,
        title: document.title,
        h1Count: document.getElementsByTagName('h1').length,
        text: document.body.innerText.substring(0, 2000) // Sample of text
    };
}

async function initiateAnalysis() {
    stopPolling();
    const localData = collectInitialData();
    
    try {
        const response = await fetch("https://api.wai.ventureout.cz/analyze", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: window.location.href,
                interests: settings.interests,
                exclusions: settings.exclusions,
                localData: localData
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();

        if (data.status === 'preliminary' && data.pageAura) {
            applyAuraToLinks(data.pageAura.links, true);
            chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '...' });
            startPolling();
        } else if (data.status === 'completed' && data.pageAura) {
            applyAuraToLinks(data.pageAura.links, false);
            if(data.domainAura) chrome.runtime.sendMessage({ type: 'SET_BADGE', color: data.domainAura.color, text: '✓' });
        }
    } catch (error) {
        console.error('[WAI] Initial analysis request failed:', error);
    }
}

function startPolling() {
    if (pollingInterval) return;
    pollingInterval = setInterval(async () => {
        try {
            const response = await fetch("https://api.wai.ventureout.cz/analyze", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: window.location.href })
            });
            const data = await response.json();
            
            if (data.status === 'completed') {
                stopPolling();
                applyAuraToLinks(data.pageAura.links, false);
                if(data.domainAura) chrome.runtime.sendMessage({ type: 'SET_BADGE', color: data.domainAura.color, text: '✓' });
            }
        } catch (e) {
            console.error('[WAI] Polling failed:', e);
            stopPolling();
        }
    }, 5000);
}

function stopPolling() {
    clearInterval(pollingInterval);
    pollingInterval = null;
}

function applyAuraToLinks(linksData, isPreliminary) {
    if (linksData && linksData.length > 0) {
        linksData.forEach(link => {
            try {
                const normalizedUrl = new URL(link.url).href.split('#')[0];
                linkAuraMap.set(normalizedUrl, link.aura);
            } catch(e) {}
        });
    }

    const allLinks = document.querySelectorAll('a[href]');
    const intensity = (settings.auraIntensity || 75) / 25;
    const opacity = isPreliminary ? 0.5 : 1.0;

    allLinks.forEach(linkElement => {
        try {
            const normalizedHref = new URL(linkElement.href).href.split('#')[0];
            const aura = linkAuraMap.get(normalizedHref);
            if (aura && aura.circle) {
                const color = aura.circle.color === 'white' ? '#cccccc' : aura.circle.color;
                linkElement.style.textShadow = `0 0 ${intensity}px ${color}`;
                linkElement.style.opacity = opacity;
                linkElement.style.transition = 'text-shadow 0.3s, opacity 0.3s';
                linkElement.dataset.waiAuraApplied = 'true';
            }
        } catch (e) {}
    });
}

// ... (UI listener logic and showAuraPreview remain similar) ...

initialize();
