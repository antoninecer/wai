// Function for logging to the popup window with a timestamp
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

// Function to get or generate a userId
async function getUserId() {
  log('Entering getUserId...');
  let { userId } = await chrome.storage.local.get('userId');
  if (!userId) {
    log('No userId found, generating a new one...');
    userId = crypto.randomUUID();
    await chrome.storage.local.set({ userId });
    log(`New userId generated: ${userId}`);
  } else {
    log(`Found existing userId: ${userId}`);
  }
  return userId;
}

// Main logic
async function main() {
  try {
    log('Main function started.');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    log('Querying for active tab...');
    
    if (!tabs || tabs.length === 0) {
        log('Error: Could not find an active tab.');
        return;
    }

    log('Sending "dejMiData" message to content script...');
    const response = await chrome.tabs.sendMessage(tabs[0].id, { greeting: "dejMiData" });

    if (!response || !response.data) {
      log('Error: No data received from content script.');
      return;
    }
    
    log('Successfully received data from content script.', response.data);
    
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

    log(`Ready to send to API endpoint: ${apiEndpoint}`, requestBody);

    log('Sending fetch request...');
    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    log(`API response received with status: ${apiResponse.status}`);

    const responseHeaders = {};
    apiResponse.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    log('Response headers:', responseHeaders);

    log('Reading response body as text...');
    const responseText = await apiResponse.text();

    log('Raw response body:', responseText);

    log('Attempting to parse body as JSON...');
    try {
      const responseJson = JSON.parse(responseText);
      log('Successfully parsed JSON!', responseJson);
    } catch (e) {
      log(`Error parsing JSON: ${e.message}`);
    }

  } catch (error) {
    log('A critical error occurred in main function: ' + error.message);
    console.error("Detailed error:", error);
  }
}

// Clear old log and run
debugOutput.innerHTML = '<p>Popup opened...</p>';
main();
