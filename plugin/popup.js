// Globální reference na debugovací okno
const debugOutput = document.getElementById('debug-output');

// Funkce pro logování do popup okna
function logToPopup(message, isJson = false) {
  const logEntry = document.createElement('p');
  if (isJson) {
    logEntry.textContent = JSON.stringify(message, null, 2);
    logEntry.style.whiteSpace = 'pre-wrap';
  } else {
    logEntry.textContent = message;
  }
  debugOutput.appendChild(logEntry);
  // Automaticky scrolluje dolů
  debugOutput.scrollTop = debugOutput.scrollHeight;
}

// Funkce pro získání nebo vygenerování userId
async function getUserId() {
  let { userId } = await chrome.storage.local.get('userId');
  if (!userId) {
    logToPopup('Generuji nové userId...');
    userId = crypto.randomUUID();
    await chrome.storage.local.set({ userId });
  }
  return userId;
}

// Hlavní logika
async function main() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    logToPopup('Žádám data z content scriptu...');
    
    const response = await chrome.tabs.sendMessage(tabs[0].id, { greeting: "dejMiData" });

    if (!response || !response.data) {
      logToPopup('Chyba: Nedostala se odpověď z content scriptu.');
      return;
    }
    
    logToPopup('Data z content scriptu přijata.');
    const lightAnalysisData = response.data;
    
    const userId = await getUserId();
    logToPopup(`Používám userId: ${userId}`);

    const apiEndpoint = 'https://api.wai.ventureout.cz/analyze';
    
    const requestBody = {
      ...lightAnalysisData,
      userId: userId,
      preferences: {
        interests: ["web development", "AI", "data science"],
        exclusions: ["gossip", "clickbait"],
        auraIntensity: 0.8
      }
    };

    logToPopup('Odesílám následující data na API:');
    logToPopup(requestBody, true);

    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    logToPopup(`Odpověď z API (status: ${apiResponse.status})`);
    
    const responseText = await apiResponse.text();
    
    try {
      // Zkusíme parsovat jako JSON
      const responseJson = JSON.parse(responseText);
      logToPopup('Odpověď z API (JSON):');
      logToPopup(responseJson, true);
    } catch (e) {
      // Pokud to není JSON, zobrazíme jako text
      logToPopup('Chyba: Odpověď z API není validní JSON. Zobrazuji jako text:');
      logToPopup(responseText);
    }

  } catch (error) {
    logToPopup('Došlo k závažné chybě: ' + error.message);
    console.error(error);
  }
}

main();
