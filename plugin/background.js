// background.js - Service Worker for Web Aura Index Plugin

// Naslouchá na zprávy z jiných částí pluginu (content.js, popup.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // Logika pro změnu odznaku (badge) na ikoně
    if (request.type === 'SET_BADGE') {
        if (request.text) {
            chrome.action.setBadgeText({ 
                text: request.text,
                tabId: sender.tab.id 
            });
        }
        if (request.color) {
            chrome.action.setBadgeBackgroundColor({ 
                color: request.color,
                tabId: sender.tab.id
            });
        }
        sendResponse({ status: "Badge updated" });
        return true; // Udržuje message port otevřený pro asynchronní sendResponse
    }

    // Logika pro změnu ikony (připraveno do budoucna)
    if (request.type === 'SET_ICON') {
        if (request.path) {
            chrome.action.setIcon({
                path: request.path, // např. {"16": "icons/phase1.png", ...}
                tabId: sender.tab.id
            });
            sendResponse({ status: "Icon updated" });
        }
        return true;
    }
});

// Zde můžeme přidat další logiku, která běží na pozadí,
// například kontrolu stavu při změně aktivního tabu.
chrome.tabs.onActivated.addListener(activeInfo => {
    // Zde můžeme v budoucnu zkontrolovat, zda pro nově aktivovaný tab
    // již máme nějaká data a podle toho aktualizovat ikonu.
    // console.log(`Tab ${activeInfo.tabId} was activated.`);
});

console.log("WAI Background Service Worker started.");
