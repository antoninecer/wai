# GEMINI.md — Kanonická specifikace projektu Web Aura Index (WAI)

Tento dokument je jediný řídicí zdroj pro projekt Web Aura Index (WAI).
Je psán tak, aby byl použitelný pro vývoj, ale zároveň nezradil původní smysl:
pojmenovat charakter digitálního prostoru způsobem, který člověku pomůže jednat svobodněji a vědoměji.

---

## 1) Smysl projektu

Web Aura Index (WAI) není hodnoticí systém webů, není to filtr pravdy ani morální arbitr.

WAI je nástroj pro instinktivní orientaci člověka v digitálním prostředí.

Pomáhá uživateli:
- neztrácet čas,
- rozpoznat, zda obsah zraje nebo tlačí,
- poznat, zda se stránka potkává s jeho záměrem a zájmy,
- rozhodnout se rychle: zůstat – donavigovat se – odejít.

WAI neříká, co si máš myslet.
WAI pojmenovává to, co už často cítíš, jen tomu chybí řeč.

---

## 2) Neměnné invarianty (pravidla, která se nesmí rozbít)

1. Instinkt před racionalitou  
   První vrstva vnímání je pocitová: tvar, barva, klid, napětí.

2. Popis, ne verdikt  
   Cílem je charakteristika, ne odsudek. WAI má pomáhat vidět, ne soudit.

3. Vysvětlitelnost  
   Každé tvrzení musí mít vysvětlení: proč to vyšlo právě takto.

4. Neexistuje „SEO pro auru“  
   Auru nelze mechanicky optimalizovat. Lze ji pouze dlouhodobě naplňovat.

5. Jazyková agnostičnost  
   Systém musí fungovat napříč jazyky; jazyk je signál, ne bariéra.

---

## 3) Dva obrazy: hvězda a kruh

WAI stojí na dvou obrazech, které se nesmějí slít do jedné metriky:

1) Sedmicípá hvězda — mapa reality (jak web funguje)  
2) Jednobarevný kruh — čistota úmyslu (proč web existuje)

Hvězda je proměnlivý stav.
Kruh je stabilnější charakter.

---

## 4) Sedmicípá hvězda — stav webu

Hvězda popisuje vnitřní stav webu.
Každý cíp je jedna kvalita, jedna vrstva bytí webu.

Vlastnosti cípů:
- barva: pevně daný archetyp
- délka: síla vrstvy (0–100)
- sytost: kvalita/jistota odhadu (confidence)

Sedm vrstev (fixní barvy):

1. Červená — Stabilita / Existence  
   dostupnost, chyby, výkon  
   otázka: „Může web klidně existovat?“

2. Oranžová — Tok / Pohyb  
   navigace, struktura, tření  
   otázka: „Lze se webem přirozeně pohybovat?“

3. Žlutá — Vůle / Směr  
   CTA, nátlak, rozhodování  
   otázka: „Vede web, nebo tlačí?“

4. Zelená — Vztah / Důvěra  
   transparentnost, kontakt, návratnost  
   otázka: „Lze tomuto webu věřit?“

5. Modrá — Hlas / Jazyk  
   čitelnost, tón, srozumitelnost  
   otázka: „Mluví web smysluplně?“

6. Indigová — Smysl / Kontext  
   tematická soudržnost, hloubka  
   otázka: „Proč tento web existuje?“

7. Bílá — Integrita / Etika  
   soulad forem a důsledků  
   otázka: „Je web v souladu sám se sebou?“

---

## 5) Střed hvězdy — průnik a napětí

Střed hvězdy není průměr.

Vyjadřuje:
- míru souladu mezi vrstvami,
- míru vnitřního napětí,
- stabilitu „osobnosti“ webu.

Silný střed může existovat i u nedokonalé hvězdy.
Slabý střed značí rozpor, nikoli nutně technickou chybu.

---

## 6) Jednobarevný kruh — úmysl webu

Vedle hvězdy existuje kruh jediné barvy.

Kruh:
- není přímý součet metrik,
- vzniká interpretací souladu a dopadů,
- mění se pomalu.

Odpovídá na otázku:
„S jakým úmyslem tento web vstupuje do světa?“

---

## 7) Význam barev kruhu (dominantní aura)

Zelený kruh — úmysl služby  
- web chce být užitečný, otevřený, poctivý  
- důvěra před výkonem, vztah před konverzí

Žlutý kruh — úmysl prosazení  
- silná vůle, jasný cíl  
- může být zdravý, ale bez zelené sklouzává k tlaku

Modrý kruh — úmysl sdílení poznání  
- vzdělávání, informace, racionalita  
- důraz na jazyk a význam

Fialový kruh — úmysl smyslu  
- idea, vize, přesah  
- riziko odtržení od reality

Červený kruh — úmysl přežití  
- ohrožené nebo krizové projekty  
- technika před smyslem, boj o existenci

Zlatý / bílý kruh — čistota úmyslu  
- vzácný stav: soulad toho, co web říká, dělá a způsobuje  
- není to „nejvyšší výkon“, ale nejvyšší integrita

---

## 8) Jak to uživatel zažije (UX)

WAI musí být čitelný bez studia manuálu.
Uživatel má nejprve vidět, teprve potom číst.

Plugin:
- Aura odkazů: nenápadné barevné „záření“ okolo odkazů (barva podle aury cílové URL).
- Ikona domény: stabilní barva odpovídající celkové auře domény.
- Detail (tooltip/panel): hvězda + kruh + klíčová témata + krátké vysvětlení „proč“.

Důležité: vizualizace je signál, ne výkřik.
Má vést k mravní bdělosti, ne k hysterii.

---

## 9) Dvě fáze analýzy (rychlá a hluboká)

Fáze 1: Okamžitá aura stránky  
- cíl: odpověď v řádu sekund  
- pokud existují čerstvá data, vrátit je hned  
- pokud nejsou, vrátit status „analyzing“ a zařadit úkol k výpočtu

Fáze 2: Hloubková aura domény (crawlování)  
- cíl: postupně zmapovat interní strukturu domény  
- worker zpracuje stránku, uloží výsledek, vytáhne interní odkazy a přidává nové úkoly

Čerstvost dat:
- každý záznam má last_analyzed  
- pokud jsou data starší než TTL (např. 30 dní), stará data se mohou vrátit, ale současně se zařadí reanalýza

Historie:
- uchovávat poslední 4 snímky domény (sledování vývoje v čase)
- starší snímky samočistit

---

## 10) Datový model (normalizovaný)

Použijeme normalizovanou strukturu pro rychlost, vyhledávání a budoucí rozšiřování:

- domains  
  - domain_name, last_analyzed, overall_aura_circle, overall_aura_star

- pages  
  - domain_id, url, title, meta_description  
  - page_aura_circle, page_aura_star  
  - content_map (JSONB: sémantická mapa)

- links  
  - source_page_id, target_url, link_text, link_aura_circle

- page_topics  
  - page_id, topic (indexováno pro našeptávač)

---

## 11) Aura Packet (co systém vrací)

Výstup musí být konzistentní a použitelný pro plugin i webové UI:

- identita: url, domain, timestamp, last_analyzed
- aura kruhu: barva + krátké zdůvodnění
- aura hvězdy: 7 cípů (score 0–100, confidence 0–1) + střed
- témata: seznam topiců + váhy (podle potřeby)
- vysvětlení: několik bodů „proč to vyšlo“ (lidsky čitelné)

Poznámka:
WAI má vracet i nejistotu. Nevědět je poctivější než předstírat.

---

## 12) Architektura komponent (bez infra detailů)

Komponenty:
- browser plugin (vizualizace a dotazy)
- frontend UI (vyhledávání, prohlížení mapy)
- API (přijímá dotazy, vrací Aura Packet, řídí cache/TTL)
- worker (asynchronní analýza + crawlování)
- databáze (PostgreSQL)
- fronta (Redis)

Porty:
- API běží na portu: API_PORT
- Frontend běží na portu: FRONTEND_PORT
(Tyto hodnoty a publikaci do internetu si spravuješ ty.)

---

## 13) Roadmapa a aktuální stav

Milníky:
- M0: základní pipeline (plugin → API → worker) a uložení výsledku
- M1: normalizovaný model (domains/pages/links/page_topics)
- M2: rekurzivní crawlování interních odkazů
- M3: čerstvost + reanalýza + 4 snapshoty domény
- M4: vyhledávání s našeptávačem (page_topics)
- M5: „živá mapa webu“ (domény, témata, vývoj)

Aktuální stav (29. ledna 2026):
- Hotovo:
  - základní komunikace plugin → API → worker přes frontu
  - worker stáhne stránku, naparsuje odkazy, uloží výsledek
  - plugin vizualizuje aury odkazů
- Děje se teď:
  - přestavba databáze: přechod na normalizované schéma
- Následuje:
  1) upravit worker na ukládání do nové struktury
  2) přidat rekurzivní crawlování (frontování interních odkazů)
  3) upravit plugin, aby využil detailnější strukturu dat

---

## 14) Poznámka k budoucí vizi (volitelné)

WAI může být jednou chápán i jako veřejná služba:
kolektivní, průběžně aktualizovaný index aury webu,
který lidem pomáhá neztratit se v prostoru, jenž je příliš rychlý,
příliš hlučný a příliš často bez odpovědnosti.

Tato vize však nesmí zničit přítomnost:
nejprve musí existovat pravdivý nástroj; teprve potom infrastruktura.

