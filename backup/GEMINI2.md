# GEMINI.md

## Web Aura Index (WAI)

### Instinktivní orientace v digitálním prostoru

---

## 1. Smysl projektu (zjednodušeně, ale přesně)

Web Aura Index (WAI) není hodnoticí systém webů, není to filtr pravdy ani morální arbitr.

**WAI je nástroj pro instinktivní orientaci člověka v digitálním prostředí.**

Pomáhá uživateli:

* neztrácet čas,
* poznat, zda obsah *zraje* nebo *tlačí*,
* zda se stránka **potkává s jeho záměrem a zájmy**,
* a rozhodnout se rychle: *zůstat – donavigovat se – odejít*.

WAI **neříká, co si máš myslet**.
WAI **pojmenovává to, co už cítíš**, ale neumíš si to hned uvědomit.

---

## 2. Základní principy (neměnné invarianty)

1. **Instinkt před racionalitou**
   První vrstva vnímání je vždy vizuální a pocitová (barva, tvar, klid).

2. **Popis, ne verdikt**
   WAI nepoužívá kategorie typu „dobrý / špatný web“.

3. **Vztahovost**
   Stránka se neposuzuje absolutně, ale **ve vztahu k uživateli a jeho záměru**.

4. **Confidence (jistota) je stejně důležitá jako skóre**
   Šedá hvězda je poctivější než barevná lež.

5. **AI nikdy není autorita**
   AI může komentovat a vysvětlovat, nikdy rozhodovat.

6. **Uživatel zůstává suverénem**
   Profily, zájmy i historie jsou pod jeho kontrolou.

---

## 3. Vizuální jazyk WAI (instinktivní vrstva)

### 3.1 Sedmicípá hvězda – vnitřní stav obsahu

Každý cíp reprezentuje jednu kvalitu působení:

1. 🔴 Stabilita (technická a strukturální)
2. 🟠 Tok / chaos (plynulost vs. roztříštěnost)
3. 🟡 Tlak (manipulace, urgency, CTA)
4. 🟢 Důvěra (transparentnost, kontakt, kontinuita)
5. 🔵 Jazyk (srozumitelnost, čitelnost)
6. 🟣 Smysl (hloubka, kontext, uzavřenost sdělení)
7. ⚪ Integrita (čistota úmyslu, absence skrytého nátlaku)

Každý cíp má:

* `score` (0–100)
* `confidence` (0–1) → vizuálně sytost / šedivost

### 3.2 Kruh – dominantní charakter stránky

Kruh nevyjadřuje kvalitu, ale **celkový úmysl působení**:

* klidný
* informační
* prodejní
* tlačící
* chaotický

Barva kruhu vzniká **průnikem hvězdy**, nikoli samostatným výpočtem.

---

## 4. Uživatelská identita a kontinuita („ty jsi ty“)

Uživatel má:

* **pseudonymní ID** (nezávislé na zařízení),
* možnost mít **více profilů** (např. Práce, Volný čas, Dítě),
* kontrolu nad historií, resetem i exportem.

Cílem je:

> aby systém chápal, že *jsi to pořád ty*, i když jsi na jiném PC,
> aniž by tě sledoval invazivním způsobem.

Technicky:

* identita je oddělena od konkrétního zařízení,
* preference jsou uloženy jako **uživatelský vektor zájmů**,
* vše je auditovatelné a mazatelné.

---

## 5. Interest Vault – vektor tvých zájmů

Každý uživatel má svou **malou vektorovou databázi zájmů**:

* rybaření
* střelba (sportovní / hobby kontext)
* AI novinky
* psi
* …

Každý zájem obsahuje:

* klíčová slova / fráze
* váhu (prioritu)
* negativní signály (co nechci)

Zájmy lze:

* přepínat podle profilu
* dočasně vypnout
* kompletně pročistit

---

## 6. Intent–Match (potkává se to?)

WAI vždy hodnotí **vztah**:

### 6.1 Tvůj záměr (Intent)

Např.:

* najít náhradní díl
* získat odpověď
* koupit produkt
* porozumět tématu

### 6.2 Typ stránky (Page Type)

* produkt
* katalog / listing
* vyhledávání
* dokumentace
* článek / news
* fórum
* landing

### 6.3 Výsledek

* **Shoda se záměrem** (InterestMatch)
* **Riziko ztráty času** (TimeWaste likelihood)

Výstupem není soud, ale doporučení:

* „Tahle stránka ti může pomoct“
* „Možná ztrácíš čas“
* „Tato stránka se míjí s tvým cílem“

---

## 7. Varovátor (ochrana i kompas)

Varování nejsou alarmy, ale **jemné signály**:

* vysoký tlak
* chaotická struktura
* nízká shoda s tvými zájmy

Každé varování:

* má krátké vysvětlení (1 věta)
* vždy nabízí akci:

  * zůstat
  * najít podstatné
  * odejít

---

## 8. Architektura (light → deep)

### Light vrstva (okamžitá)

* běží v pluginu
* DOM heuristiky
* rychlý obrys hvězdy
* nízká confidence

### Deep vrstva (asynchronní)

* serverová analýza
* headless render
* přesnější signály
* vyšší confidence

Aura **dozrává v čase**.

---

## 9. Milníky projektu

### M0 – Základ (běží infrastruktura)

* server
* API skeleton
* DB

### M1 – Light verze (okamžitě použitelná)

* plugin
* šedá hvězda + kruh
* lookup + submit

### M2 – Deep dozrávání

* worker
* fronta
* sytější hvězda

### M3 – Profily a ochrana

* dítě / práce / volný čas
* varovátor

### M4 – Orientační navigace

* rychlé cesty
* záměr vs stránka

### M5 – AI jako komentátor (volitelně)

* shrnutí
* jazykové vysvětlení

---

## 10. Závěrečný princip

> WAI není mapa světa.
> WAI je kompas.
>
> Neříká, kam máš jít.
> Pomáhá ti poznat, **kdy jsi sešel z cesty**.

