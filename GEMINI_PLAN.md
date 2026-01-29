# WAI - Gemini Development Plan

Tento dokument slouží jako hlavní referenční bod pro vývoj Web Aura Indexu (WAI). Zachycuje naši finální vizi, architekturu a aktuální stav projektu.

## 1. Velká Vize

Web Aura Index (WAI) není jen nástroj pro hodnocení jedné stránky. Je to systém pro pochopení **charakteru, integrity a sémantické mapy celého webu jako živého organismu**. Cílem je poskytnout uživatelům okamžitý vhled do kvality a úmyslu digitálního prostoru, ve kterém se pohybují, a to na základě dat, nikoliv jen dojmů. Systém musí být od základu **jazykově agnostický**.

## 2. Architektura

Systém je postaven na dvoufázové, asynchronní analýze, aby byla zajištěna okamžitá odezva pro uživatele a zároveň umožněna komplexní hloubková analýza na pozadí.

### Fáze 1: Okamžitá Aura Stránky
- **Cíl:** Poskytnout uživateli odpověď do pár sekund.
- **Proces:** API přijme požadavek na analýzu konkrétní URL. Pokud pro ni existují čerstvá data, okamžitě je vrátí. Pokud ne, zařadí úkol do Redis fronty a odpoví statusem `analyzing_domain`.

### Fáze 2: Hloubková Aura Celého Webu (Crawlování)
- **Cíl:** Postupně a autonomně zmapovat a zanalyzovat celý web.
- **Proces:** Worker na pozadí zpracovává úkoly z Redis fronty. Pro každou URL stáhne její obsah, analyzuje její auru a sémantickou mapu, a uloží výsledek do databáze. Poté identifikuje všechny nové, dosud neanalyzované **interní odkazy** a přidá je jako nové úkoly zpět do fronty. Tímto způsobem se postupně "prokouše" celým webem.

### Udržování Čerstvosti Dat
- Záznamy v databázi budou mít časové razítko (`last_analyzed`).
- Pokud API obdrží požadavek na data starší než **30 dní** (konfigurovatelné), vrátí stará data, ale zároveň zařadí úkol na přeanalyzování do fronty.
- Databáze bude uchovávat **poslední 4 snímky** každé domény, aby bylo možné sledovat její vývoj v čase. Starší záznamy se budou mazat (samočistící mechanismus).

## 3. Databázové Schéma (PostgreSQL)

Pro zajištění rychlosti a budoucího vyhledávání použijeme normalizovanou strukturu se 4 hlavními tabulkami.

- **`domains`**: Uchovává celkovou auru pro celou doménu.
  - `id`, `domain_name`, `last_analyzed`, `overall_aura_circle`, `overall_aura_star`
- **`pages`**: Uchovává data o každé jednotlivé stránce.
  - `id`, `domain_id`, `url`, `title`, `meta_description`, `page_aura_circle`, `page_aura_star`, `content_map` (JSONB pro sémantickou mapu)
- **`links`**: Uchovává informace o každém jednotlivém odkazu.
  - `id`, `source_page_id`, `target_url`, `link_text`, `link_aura_circle`
- **`page_topics`**: Indexovaná tabulka pro rychlé vyhledávání a našeptávač.
  - `id`, `page_id`, `topic`

## 4. Funkcionalita Pluginu

- **Aura Odkazů:** Zobrazí "nenápadné barevné záření" okolo odkazů přímo na stránce pomocí `text-shadow`. Barva odpovídá auře cílové URL.
- **Ikona Pluginu:** Barva ikony v liště prohlížeče bude odpovídat stabilní, celkové auře **domény**.
- **Kontextové Menu (Budoucí):** Pravé tlačítko na odkazu zobrazí detailní auru cílové stránky (hvězdu, kruh, klíčová témata).

## 5. Funkcionalita Vyhledávání (Budoucí)

- Webové rozhraní bude obsahovat vyhledávací pole s **našeptávačem**.
- Při psaní bude v reálném čase prohledávat indexovanou tabulku `page_topics` a nabízet relevantní témata a stránky napříč všemi analyzovanými doménami.

---
## **AKTUÁLNÍ STAV (29. ledna 2026)**

- **Co je hotové:**
    - Základní komunikace `Plugin -> API -> Worker` přes Redis frontu.
    - Worker umí stáhnout a naparsovat jednu stránku, extrahovat odkazy a uložit výsledek.
    - Plugin umí vizualizovat aury odkazů na stránce.
- **Co se děje teď:**
    - **FÁZE: Přestavba databáze.**
    - **ÚKOL:** Zahazujeme starý model s jedním JSONB a implementujeme nové, normalizované schéma se 4 tabulkami (`domains`, `pages`, `links`, `page_topics`).
- **Co bude následovat:**
    1.  Upravit `worker.js`, aby ukládal data do nové struktury.
    2.  Implementovat v `worker.js` logiku pro rekurzivní crawlování (přidávání nových interních odkazů do fronty).
    3.  Upravit `plugin`, aby správně pracoval s novou, detailnější strukturou dat z API.
