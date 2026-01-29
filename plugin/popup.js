// Tento skript se spustí, když se otevře popup okno.

// Najdeme aktivní kartu v prohlížeči.
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  // Pošleme zprávu skriptu content.js, který běží na této kartě.
  chrome.tabs.sendMessage(tabs[0].id, { greeting: "dejMiData" }, function (response) {
    // Až content.js odpoví, vezmeme jeho odpověď (data) a zobrazíme je.
    if (response) {
      const debugOutput = document.getElementById('debug-output');
      // Převedeme JSON objekt na hezky formátovaný text a vložíme ho do našeho okna.
      debugOutput.textContent = JSON.stringify(response.data, null, 2);
    } else {
      // Pokud se něco pokazilo a nedostali jsme odpověď.
      document.getElementById('debug-output').textContent = 'Nepodařilo se načíst data ze stránky. Zkuste ji obnovit a otevřít popup znovu.';
    }
  });
});
