# WAI - Gemini Development Plan

Tento dokument slouží jako hlavní referenční bod pro vývoj Web Aura Indexu (WAI). Zachycuje naši finální vizi, architekturu a dohodnuté funkce.

## 1. Finální Vize: Intuitivní Kompas

Cílem je vytvořit **intuitivní kompas**, nikoli technický dashboard. Plugin má uživateli poskytnout okamžitý, pocitový vhled do charakteru webové stránky a celé domény, a to prostřednictvím elegantního a živého vizuálního jazyka.

### 1.1. Fázová Ikona: Živá Zpětná Vazba

Ikona pluginu je **dvojitý kruh**, který komunikuje stav analýzy ve třech fázích:

*   **Vnitřní kruh:** Reprezentuje auru **aktuální stránky**.
*   **Vnější kruh:** Reprezentuje celkovou auru celé **domény**.

**Fáze 1: Zjišťování (Nová stránka)**
*   **Vizuál:** Šedivý dvojkruh s **otazníkem `?`** uprostřed.
*   **Význam:** "Právě provádím rychlou lokální analýzu této stránky."
*   **Tooltip:** "Zjišťuji auru stránky..."

**Fáze 2: Náhled Stránky (Lokální analýza hotova)**
*   **Vizuál:** Otazník zmizí. **Vnitřní kruh** se obarví. Vnější zůstává šedý.
*   **Význam:** "Mám první dojem z této konkrétní stránky."
*   **Tooltip:** "Aura stránky: [Barva - Úmysl]"

**Fáze 3: Kompletní Obraz (Data ze serveru dorazila)**
*   **Vizuál:** **Vnější kruh** se také obarví. Ikona je kompletní.
*   **Význam:** "Mám kompletní obrázek o stránce i celé doméně."
*   **Tooltip:** "Aura stránky: [Barva], Aura domény: [Barva]"

### 1.2. Chytré Zobrazování Aur

*   **Podkreslení Aury Stránky ("Pergamenový Efekt"):**
    *   **Funkce:** Po dokončení Fáze 2 se na pozadí stránky aplikuje velmi jemné, volitelné podbarvení nebo textura v barvě dominantní aury stránky.
    *   **Cíl:** Uživatel instinktivně "cítí" atmosféru stránky.

*   **Aura Interaktivních Prvků (Tlačítka, CTA):**
    *   **Funkce:** Systém se pokusí rozpoznat účel tlačítek a odkazů (např. "Koupit", "Kontakt") a přiřadit jim specifickou barvu aury (např. 🟡 pro nákup, 🟢 pro kontakt).
    *   **Cíl:** Vizuální nápověda o tom, co daný prvek po uživateli chce.

*   **Načasování Obarvení Odkazů:**
    *   Aury jednotlivých odkazů na stránce se zobrazí až po dokončení **Fáze 3**, kdy jsou k dispozici data ze serveru.

### 1.3. Přehledný Popup

Popup bude rozdělen do záložek pro maximální přehlednost:

*   **Analýza:** Zobrazí velký dvojkruh, sedmicípou hvězdu pro stránku a slovní hodnocení.
*   **Nastavení:** Umožní uživateli personalizovat si zážitek.
*   **Hledat:** Umožní prohledávat již zaindexovaný obsah.

## 2. Plán Implementace

1.  **Založení `GEMINI_PLAN.md`:** Vytvoření tohoto souboru. (HOTOVO)
2.  **Implementace Uživatelského Nastavení (Settings):**
    *   Vytvoření UI v `popup.html` pro nastavení.
    *   Přidání přepínačů: Debug Log, Pergamenový Efekt, Aura Tlačítek.
    *   Přidání posuvníku: Intenzita Aury Odkazů.
    *   Přidání textových polí: Moje Zájmy, Vyloučená Témata.
    *   Propojení s `chrome.storage.local`.
3.  **Implementace Fázové Ikony:**
    *   Vytvoření sady ikon a logiky v `background` skriptu pro jejich dynamickou změnu.
4.  **Implementace "Pergamenového Efektu":**
    *   Vytvoření logiky v `content.js` pro vložení a obarvení overlaye na pozadí stránky.
5.  **Implementace Aury Tlačítek (Pokročilé):**
    *   Vytvoření heuristické funkce v `content.js` pro rozpoznávání a barvení tlačítek.
6.  **Implementace Vyhledávání (Budoucí):**
    *   Vytvoření UI a propojení s novým API endpointem `/search`.