// Tento skript se spustí, když se otevře popup okno.

// Funkce pro získání nebo vygenerování userId
async function getUserId() {
  let { userId } = await chrome.storage.local.get('userId');
  if (!userId) {
    userId = crypto.randomUUID(); // Generujeme unikátní ID
    await chrome.storage.local.set({ userId });
  }
  return userId;
}

// Najdeme aktivní kartu v prohlížeči.
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  // Pošleme zprávu skriptu content.js, který běží na této kartě.
  chrome.tabs.sendMessage(tabs[0].id, { greeting: "dejMiData" }, async function (response) {
    const debugOutput = document.getElementById('debug-output');
    
    if (response && response.data) {
      debugOutput.textContent = 'Odesílám data na API...';

      try {
        const userId = await getUserId();

        // Zde budeme posílat data na naše API
        const apiEndpoint = 'https://api.wai.ventureout.cz/analyze'; // Používáme https, Nginx to očekává

        const requestBody = {
          ...response.data, // Data z content.js
          userId: userId,
          preferences: { // Prozatím statická data, v budoucnu z options.js
            interests: ["web development", "AI", "data science"],
            exclusions: ["gossip", "clickbait"],
            auraIntensity: 0.8
          }
        };

        const apiResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        const responseJson = await apiResponse.json();
        debugOutput.textContent = 'Odpověď z API:\n' + JSON.stringify(responseJson, null, 2);

      } catch (error) {
        console.error('Chyba při komunikaci s API:', error);
        debugOutput.textContent = 'Chyba při komunikaci s API: ' + error.message;
      }

    } else {
      // Pokud se něco pokazilo a nedostali jsme odpověď z content.js.
      debugOutput.textContent = 'Nepodařilo se načíst data ze stránky. Zkuste ji obnovit a otevřít popup znovu.';
    }
  });
});
