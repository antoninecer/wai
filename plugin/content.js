// --- Globální proměnné ---
const linkAuraMap = new Map();
let lastMousePosition = { x: 0, y: 0 };

// =================================================================================
// Sledování pozice myši pro správné zobrazení menu
// =================================================================================
document.addEventListener('mousedown', (event) => {
    lastMousePosition = { x: event.clientX, y: event.clientY };
}, true); // Použijeme capturing, abychom získali pozici před dalšími eventy

// =================================================================================
// Posluchač zpráv (z popup.js a background.js)
// =================================================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "AURA_DATA_UPDATE") {
        applyAuraToLinks(request.pageAura.links);
        if (request.domainAura) {
             chrome.runtime.sendMessage({ type: 'SET_BADGE', color: request.domainAura.color, text: '✓' });
        }
        sendResponse({status: "Aura applied"});
    } else if (request.type === "SHOW_AURA_PREVIEW") {
        const aura = linkAuraMap.get(request.url);
        if (aura) {
            showAuraPreview(aura, lastMousePosition.x, lastMousePosition.y);
        }
        sendResponse({status: "Preview triggered"});
    }
    return true;
});

// =================================================================================
// Logika pro vizualizaci
// =================================================================================

function applyAuraToLinks(linksData) {
    if (!linksData) return;
    const allLinks = document.querySelectorAll('a[href]');
    
    // 1. Naplníme mapu daty z API
    linksData.forEach(link => {
        try {
            // Použijeme URL bez hashe pro spolehlivější mapování
            const normalizedUrl = new URL(link.url).href.split('#')[0];
            linkAuraMap.set(normalizedUrl, link.aura);
        } catch(e) { /* ignorovat neplatné URL */ }
    });

    // 2. Projdeme odkazy na stránce a aplikujeme styl
    allLinks.forEach(linkElement => {
        try {
            const normalizedHref = new URL(linkElement.href).href.split('#')[0];
            const aura = linkAuraMap.get(normalizedHref);
            if (aura && aura.circle) {
                const color = aura.circle.color === 'white' ? '#cccccc' : aura.circle.color;
                linkElement.style.textShadow = `0 0 3px ${color}, 0 0 5px ${color}`;
                linkElement.style.transition = 'text-shadow 0.3s ease-in-out';
            }
        } catch (e) { /* ignorovat neplatné URL */ }
    });
}

function showAuraPreview(aura, x, y) {
    // Odstraníme případné staré menu
    const oldMenu = document.getElementById('wai-context-menu');
    if (oldMenu) oldMenu.remove();

    const waiContextMenu = document.createElement("div");
    waiContextMenu.id = "wai-context-menu";
    // Základní styly
    Object.assign(waiContextMenu.style, {
        display: "block",
        position: "fixed",
        zIndex: "2147483647",
        border: "1px solid #ccc",
        backgroundColor: "#f9f9f9",
        borderRadius: "8px",
        padding: "10px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
        fontSize: "14px",
        color: "#333",
        width: "280px",
        left: `${x + 5}px`,
        top: `${y + 5}px`
    });

    // Vykreslení obsahu menu
    const { circle, star } = aura;
    const starData = star || {};
    const orderedRays = ['stability', 'flow', 'will', 'relation', 'voice', 'meaning', 'integrity'].map(key => {
        const ray = starData[key];
        return { score: ray ? ray.value : 0, confidence: ray ? ray.saturation / 100 : 0.5 };
    });
    const createStarPath = (rays) => {
        const p = []; const cX = 20, cY = 20, n = 7;
        for (let i=0; i<n; i++) { const a=(i*2*Math.PI/n)-(Math.PI/2); const l=2+(rays[i].score/100*16); p.push(`${cX+l*Math.cos(a)},${cY+l*Math.sin(a)}`); }
        return p.join(' ');
    };
    const starPoints = createStarPath(orderedRays);
    const intentText = circle.intent || 'Základní aura odkazu.';
    
    waiContextMenu.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="position: relative; width: 40px; height: 40px; flex-shrink: 0;">
                <div style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; border-radius: 50%; background-color: ${circle.color}; opacity: 0.8;"></div>
                <svg viewBox="0 0 40 40" style="position: relative; z-index: 1;"><polygon points="${starPoints}" fill="rgba(128, 128, 128, 0.5)" stroke="#FFFFFF" stroke-width="0.5" /></svg>
            </div>
            <div><strong style="display: block; margin-bottom: 2px;">Aura Cíle</strong><p style="margin: 0; font-size: 12px;">${intentText}</p></div>
        </div>
    `;
    
    document.body.appendChild(waiContextMenu);

    // Přidáme event listener pro odstranění menu po kliknutí
    setTimeout(() => {
        document.addEventListener('click', () => waiContextMenu.remove(), { once: true });
    }, 10);
}
