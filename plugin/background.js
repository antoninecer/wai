// background.js - Service Worker for Web Aura Index Plugin

// Vytvoření položky v kontextovém menu při instalaci pluginu
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "show-wai-aura",
        title: chrome.i18n.getMessage("contextMenuTitle"),
        contexts: ["link"] // Zobrazí se pouze při kliknutí pravým na odkaz
    });
});

// Naslouchání na kliknutí v kontextovém menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Pokud bylo kliknuto na naši položku
    if (info.menuItemId === "show-wai-aura" && tab) {
        // Pošleme zprávu do content scriptu v aktivním tabu
        chrome.tabs.sendMessage(tab.id, {
            type: 'SHOW_AURA_PREVIEW',
            url: info.linkUrl // URL odkazu, na který bylo kliknuto
        });
    }
});

// Naslouchá na zprávy z jiných částí pluginu (content.js, popup.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // Logika pro změnu odznaku (badge) na ikoně
    if (request.type === 'SET_BADGE') {
        // Pro MV3 musíme cílit na aktivní tab, pokud sender není dostupný
        const tabId = sender.tab ? sender.tab.id : undefined;
        if (tabId) {
            if (request.text) {
                chrome.action.setBadgeText({ text: request.text, tabId: tabId });
            }
            if (request.color) {
                chrome.action.setBadgeBackgroundColor({ color: request.color, tabId: tabId });
            }
        }
        sendResponse({ status: "Badge updated" });
        return true; 
    }

    // Logika pro změnu ikony
    if (request.type === 'SET_ICON') {
        const tabId = sender.tab ? sender.tab.id : undefined;
        if (request.path && tabId) {
            chrome.action.setIcon({ path: request.path, tabId: tabId });
            sendResponse({ status: "Icon updated" });
        }
        return true;
    }
});

// Zde můžeme přidat další logiku, která běží na pozadí,
// například kontrolu stavu při změně aktivního tabu.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Počkáme, až se stránka kompletně načte
    if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
        // Pošleme zprávu do content scriptu, aby si zažádal o analýzu
        chrome.tabs.sendMessage(tabId, { type: 'REQUEST_AURA_ANALYSIS' });
    }
});

console.log("WAI Background Service Worker started and context menu prepared.");

