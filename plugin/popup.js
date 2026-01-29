// Globální reference na debugovací okno
const debugOutput = document.getElementById('debug-output');

// Funkce pro logování do popup okna s časovým razítkem
function log(message, data = null) {
  const time = new Date().toLocaleTimeString();
  const logEntry = document.createElement('p');
  logEntry.style.margin = '2px 0';
  logEntry.style.borderBottom = '1px solid #eee';

  let content = `[${time}] ${message}`;
  if (data) {
    const dataPre = document.createElement('pre');
    dataPre.textContent = JSON.stringify(data, null, 2);
    dataPre.style.backgroundColor = '#f5f5f5';
    dataPre.style.padding = '5px';
    dataPre.style.margin = '0';
    dataPre.style.whiteSpace = 'pre-wrap';
    dataPre.style.wordBreak = 'break-all';
    logEntry.innerHTML = `[${time}] ${message}`;
    logEntry.appendChild(dataPre);
  } else {
    logEntry.textContent = content;
  }
  
  debugOutput.appendChild(logEntry);
  debugOutput.scrollTop = debugOutput.scrollHeight;
}

// Funkce pro získání nebo vygenerování userId
async function getUserId() {
  log('Vstupuji do getUserId...');
  let { userId } = await chrome.storage.local.get('userId');
  if (!userId) {
    log('UserId nenalezeno, generuji nové...');
    userId = crypto.randomUUID();
    await chrome.storage.local.set({ userId });
    log(`Nové userId vygenerováno: ${userId}`);
  } else {
    log(`Nalezeno existující userId: ${userId}`);
  }
  return userId;
}

// Hlavní logika
async function main() {
  try {
    log('Hlavní funkce spuštěna.');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    log('Dotazuji se na aktivní kartu...');
    
    if (!tabs || tabs.length === 0) {
        log('Chyba: Nepodařilo se najít aktivní kartu.');
        return;
    }

    log('Posílám zprávu "dejMiData" na content script...');
    const response = await chrome.tabs.sendMessage(tabs[0].id, { greeting: "dejMiData" });

    if (!response || !response.data) {
      log('Chyba: Odpověď z content scriptu neobsahuje data.');
      return;
    }
    
    log('Data z content scriptu úspěšně přijata.', response.data);
    
    const userId = await getUserId();
    const apiEndpoint = 'https://api.wai.ventureout.cz/analyze';
    
    const requestBody = {
      ...response.data,
      userId: userId,
      preferences: {
        interests: ["web development", "AI", "data science"],
        exclusions: ["gossip", "clickbait"],
        auraIntensity: 0.8
      }
    };

    log(`Připraveno k odeslání na API endpoint: ${apiEndpoint}`, requestBody);

    log('Odesílám fetch požadavek...');
    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    log(`Odpověď z API přijata se statusem: ${apiResponse.status}`);

    const responseHeaders = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    log('Hlavičky (headers) odpovědi:', responseHeaders);

    log('Čtu tělo odpovědi jako text...');
    const responseText = await apiResponse.text();

    log('Surové tělo odpovědi (raw text):', responseText);

    log('Pokouším se parsovat tělo jako JSON...');
    try {
      const responseJson = JSON.parse(responseText);
      log('Parsování na JSON úspěšné!', responseJson);
    } catch (e) {
      log(`Chyba při parsování JSON: ${e.message}`);
    }

  } catch (error) {
    log('Došlo k závažné chybě v hlavní funkci: ' + error.message);
    console.error("Detailní chyba:", error);
  }
}

// Vyčistíme starý log a spustíme
debugOutput.innerHTML = '';
main();
