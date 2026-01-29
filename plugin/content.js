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
    }
  }
);
