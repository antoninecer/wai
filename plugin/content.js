// Tento skript naslouchá na zprávy odjinud z pluginu (např. z popup.js)
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    // Pokud zpráva obsahuje pozdrav "dejMiData"
    if (request.greeting === "dejMiData") {
      
      // Spustíme sběr dat
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

      // Pošleme odpověď zpět tomu, kdo se ptal (popup.js)
      sendResponse({ data: collectedData });
    } else if (request.type === "AURA_DATA_UPDATE") {
      console.log("Content script received Aura data:", { domainAura: request.domainAura, pageAura: request.pageAura });
      if (request.pageAura && request.pageAura.links) {
        applyAuraToLinks(request.pageAura.links);
      }
      if (request.domainAura && request.domainAura.color) {
        // Nastavíme barvu odznaku na ikoně
        chrome.runtime.sendMessage({ type: 'SET_BADGE', color: request.domainAura.color, text: 'A' });
      }
    } else if (request.type === "ANALYSIS_IN_PROGRESS") {
      console.log("Content script received ANALYSIS_IN_PROGRESS message.");
      chrome.runtime.sendMessage({ type: 'SET_BADGE', color: '#808080', text: '...' }); // Šedá barva pro analýzu
    }
  }
);

// Posluchač pro zprávy od content scriptu v background scriptu (nebo popupu)
// Tento kód se musí spustit v kontextu, kde má přístup k chrome.action API.
// Pro Manifest V3 je to Service Worker. Prozatím to vložíme do popup.js,
// ale ideálně by to mělo být v service workeru.
chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'SET_BADGE') {
        chrome.action.setBadgeText({ text: request.text });
        chrome.action.setBadgeBackgroundColor({ color: request.color });
    }
});


// Funkce pro aplikování aury na odkazy
function applyAuraToLinks(linksData) {
    const allLinks = document.querySelectorAll('a[href]');
    const linkMap = new Map(linksData.map(link => [link.url, link.aura.circle.color]));

    allLinks.forEach(linkElement => {
        let absoluteUrl;
        try {
            absoluteUrl = new URL(linkElement.href).href; // Normalizace URL
        } catch (e) {
            return; // Přeskočit neplatné URL
        }

        const auraColor = linkMap.get(absoluteUrl);

        if (auraColor) {
            const color = auraColor === 'white' ? '#cccccc' : auraColor; // Bílá by nebyla vidět
            // Aplikujeme "záření" přímo na text
            linkElement.style.textShadow = `0 0 3px ${color}, 0 0 5px ${color}`;
            linkElement.style.transition = 'text-shadow 0.3s ease-in-out';
        }
    });
}
