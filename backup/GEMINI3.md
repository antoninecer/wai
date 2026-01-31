# GEMINI3.md: Finální Specifikace Projektu Web Aura Index (WAI)

Tento dokument je kanonickým a sjednoceným zdrojem pro projekt Web Aura Index (WAI). Slouží jako kompletní a vyčerpávající specifikace, 
která kombinuje všechny relevantní myšlenky, principy, technické návrhy a plány z původních souborů (`GEMINI.md`, `GEMINI1.md`, `GEMINI2.md`) 
 naší následné diskuze. Cílem tohoto souboru je poskytnout jakékoliv budoucí instanci AI veškeré potřebné informace k plynulému navázání a pokračování v práci na projektu.
---

## ČÁST 1: FILOZOFIE, PRINCIPY A ZÁKLADNÍ KONCEPTY

### 1.1 Smysl projektu (Zjednodušeně, ale přesně)

Web Aura Index (WAI) není hodnoticí systém webů, není to filtr pravdy ani morální arbitr.

**WAI je nástroj pro instinktivní orientaci člověka v digitálním prostředí.**

Pomáhá uživateli:
*   neztrácet čas,
*   poznat, zda obsah *zraje* nebo *tlačí*,
*   zda se stránka **potkává s jeho záměrem a zájmy**,
*   a rozhodnout se rychle: *zůstat – donavigovat se – odejít*.

WAI **neříká, co si máš myslet**.
WAI **pojmenovává to, co už cítíš**, ale neumíš si to hned uvědomit.

### 1.2 Základní Principy (Neměnné Invarianty)

1.  **Instinkt před racionalitou:** První vrstva vnímání je vždy vizuální a pocitová (barva, tvar, klid).
2.  **Popis, ne verdikt:** WAI nepoužívá kategorie typu „dobrý / špatný web“.
3.  **Vztahovost:** Stránka se neposuzuje absolutně, ale **ve vztahu k uživateli a jeho záměru**.
4.  **Confidence (jistota) je stejně důležitá jako skóre:** Šedá hvězda je poctivější než barevná lež.
5.  **AI nikdy není autorita:** AI může komentovat a vysvětlovat, nikdy rozhodovat.
6.  **Uživatel zůstává suverénem:** Profily, zájmy i historie jsou pod jeho kontrolou.

### 1.3 Dva Obrazy WAI: Hvězda a Kruh

WAI pracuje se dvěma obrazy současně:
1.  **Sedmicípá hvězda** – mapa reality (jak web funguje).
2.  **Jednobarevný kruh** – čistota úmyslu (proč web existuje).

Tyto dva obrazy spolu souvisejí, ale **nelze je sloučit do jedné metriky**.

### 1.4 Sedmicípá Hvězda – Vnitřní Stav Webu

Hvězda popisuje **vnitřní stav webu**. Každý cíp je jedna kvalita, jedna vrstva bytí webu.

**Vlastnosti cípů:**
*   **barva** = pevně daný archetyp
*   **délka** = síla vrstvy (0–100)
*   **sytost** = kvalita / jistota hodnocení (`confidence` 0–1, vizuálně sytost / šedivost)

**Sedm vrstev (fixní barvy):**

1.  🔴 **Červená – Stabilita / Existence**
    *   dostupnost, chyby, výkon, technická a strukturální stabilita.
    *   otázka: *„Může web klidně existovat?“*

2.  🟠 **Oranžová – Tok / Pohyb / Chaos**
    *   navigace, struktura, tření, plynulost vs. roztříštěnost.
    *   otázka: *„Lze se webem přirozeně pohybovat?“*

3.  🟡 **Žlutá – Vůle / Směr / Tlak**
    *   CTA, nátlak, manipulace, urgency, rozhodování.
    *   otázka: *„Vede web, nebo tlačí?“*

4.  🟢 **Zelená – Vztah / Důvěra**
    *   transparentnost, kontakt, kontinuita, návratnost.
    *   otázka: *„Lze tomuto webu věřit?“*

5.  🔵 **Modrá – Hlas / Jazyk**
    *   čitelnost, tón, srozumitelnost.
    *   otázka: *„Mluví web smysluplně?“*

6.  🟣 **Indigová – Smysl / Kontext**
    *   tematická soudržnost, hloubka, uzavřenost sdělení.
    *   otázka: *„Proč tento web existuje?“*

7.  ⚪ **Bílá – Integrita / Etika**
    *   soulad forem a důsledků, čistota úmyslu, absence skrytého nátlaku.
    *   otázka: *„Je web v souladu sám se sebou?“*

**Střed hvězdy – průnik:**
Střed nevyjadřuje průměr, ale míru souladu mezi vrstvami, vnitřní napětí a celkový dojem stability osobnosti webu.

### 1.5 Jednobarevný Kruh – Úmysl Webu

Vedle hvězdy existuje kruh jediné barvy, který odpovídá na otázku: **„S jakým úmyslem tento web vstupuje do světa?“** Vzniká interpretací souladu, nikoli výkonu.

**Význam barev kruhu (dominantní aura):**

*   🟢 **ZELENÝ KRUH – Úmysl služby:** Web chce být užitečný, je otevřený, důvěra je před výkonem.
*   🟡 **ŽLUTÝ KRUH – Úmysl prosazení:** Web chce přesvědčit, silná vůle, jasný cíl. Riziko tlaku.
*   🔵 **MODRÝ KRUH – Úmysl sdílení poznání:** Informační nebo vzdělávací web, racionální.
*   🟣 **FIALOVÝ KRUH – Úmysl smyslu:** Filozofický, vizionářský web, silná idea.
*   🔴 **ČERVENÝ KRUH – Úmysl přežití:** Krizové, zastaralé nebo ohrožené projekty.
*   ⚪ / 🟡 **ZLATÝ KRUH – Čistota úmyslu:** Vzácný stav nejvyšší integrity, kdy je web v souladu (co říká, dělá a způsobuje).

---

## ČÁST 2: UŽIVATELSKÉ FUNKCE A POKROČILÉ KONCEPTY

### 2.1 Uživatelská Identita a Kontinuita („ty jsi ty“)

Uživatel má pseudonymní ID, možnost mít více profilů (Práce, Volný čas, Dítě) a plnou kontrolu nad historií. Cílem je, aby systém chápal, že *jsi to pořád ty*, i když jsi na jiném zařízení, aniž by tě invazivně sledoval.

### 2.2 Interest Vault – Vektor Tvých Zájmů

Každý uživatel má svou malou vektorovou databázi zájmů (rybaření, AI novinky, psi...). Zájmy obsahují klíčová slova, váhu a negativní signály a lze je přepínat podle profilu.

### 2.3 Intent–Match (Potkává se to?)

WAI hodnotí vztah mezi **záměrem uživatele** (co chci udělat) a **typem stránky** (produkt, článek, fórum...). Výstupem je doporučení, zda se stránka potkává s cílem, nebo je to riziko ztráty času.

### 2.4 Varovátor (Ochrana i Kompas)

Jemné signály (ne alarmy), které upozorňují na vysoký tlak, chaotickou strukturu nebo nízkou shodu se zájmy. Každé varování má krátké vysvětlení a nabízí akci (zůstat, najít podstatné, odejít).

---

## ČÁST 3: TECHNICKÁ ARCHITEKTURA A IMPLEMENTACE

### 3.1 Finální Technologický Stack

*   **Kontejnerizace:** Docker, Docker Compose
*   **Frontend:** Next.js
*   **Backend (API):** Node.js s Fastify
*   **Asynchronní analýza (Worker):** Node.js s Puppeteer
*   **Databáze:** PostgreSQL
*   **Fronta úloh a cache:** Redis
*   **Interní routing:** Traefik

### 3.2 Scénář Nasazení: Integrace s Nginx (server `setonuk`)

*   **Server:** `setonuk` (IP `150.230.127.175`)
*   **Hlavní brána:** Stávající Nginx server přijímá veškerý provoz.
*   **Domény:**
    *   `app.wai.ventureout.cz` (Frontend)
    *   `api.wai.ventureout.cz` (Backend)
*   **Směrování:** Nginx přesměruje (`proxy_pass`) provoz pro výše uvedené domény na Traefik.
*   **Komunikace:** Traefik běží v Dockeru a naslouchá na interním portu `127.0.0.1:8005`.
*   **Interní routing:** Traefik dále směruje provoz na příslušné kontejnery (`frontend` nebo `api`) na základě domény.
*   **SSL:** Spravuje stávající Nginx pomocí Certbota.

### 3.3 Konfigurace Nginx

Do `/etc/nginx/sites-available/` je třeba přidat následující dva soubory a povolit je.

**Soubor `app.wai.ventureout.cz`:**
```nginx
server {
    server_name app.wai.ventureout.cz;

    location / {
        proxy_pass http://127.0.0.1:8005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 443 ssl http2;
    # Následující řádky přidá Certbot po spuštění
    # ssl_certificate /etc/letsencrypt/live/app.wai.ventureout.cz/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/app.wai.ventureout.cz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = app.wai.ventureout.cz) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name app.wai.ventureout.cz;
    return 404; # Managed by Certbot
}
```

**Soubor `api.wai.ventureout.cz`:**
```nginx
server {
    server_name api.wai.ventureout.cz;

    location / {
        proxy_pass http://127.0.0.1:8005;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 443 ssl http2;
    # Následující řádky přidá Certbot po spuštění
    # ssl_certificate /etc/letsencrypt/live/api.wai.ventureout.cz/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.wai.ventureout.cz/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = api.wai.ventureout.cz) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name api.wai.ventureout.cz;
    return 404; # Managed by Certbot
}
```

### 3.4 Základní `docker-compose.yml`

Tento soubor bude umístěn v `/opt/wai/docker-compose.yml`.

```yaml
version: '3.8'

services:
  traefik:
    image: "traefik:v2.10"
    container_name: "wai-traefik"
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    ports:
      - "127.0.0.1:8005:80"      # Externí port pro Nginx
      - "127.0.0.1:8080:8080"    # Dashboard Traefiku pro správu
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
    networks:
      - webnet

  api:
    build: ./api
    container_name: "wai-api"
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/wai
      - REDIS_URL=redis://redis:6379
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.wai.ventureout.cz`)"
      - "traefik.http.routers.api.entrypoints=web"
    depends_on:
      - postgres
      - redis
    networks:
      - webnet
      - internal

  frontend:
    build: ./frontend
    container_name: "wai-frontend"
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.wai.ventureout.cz`)"
      - "traefik.http.routers.frontend.entrypoints=web"
    networks:
      - webnet

  worker:
    build: ./worker
    container_name: "wai-worker"
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/wai
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - internal

  postgres:
    image: postgres:15
    container_name: "wai-postgres"
    restart: unless-stopped
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=wai
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal

  redis:
    image: redis:7
    container_name: "wai-redis"
    restart: unless-stopped
    networks:
      - internal

volumes:
  postgres_data:

networks:
  webnet:
    driver: bridge
  internal:
    driver: bridge
```

---

## ČÁST 4: PRIORITIZOVANÁ ROADMAPA

Vývoj bude postupovat podle následujících milníků z `GEMINI2.md`:

-   **M0 – Základ (Právě probíhá):** Příprava serveru, Dockeru, `docker-compose.yml`, Nginx konfigurací a založení adresářové struktury.
-   **M1 – Light verze:** Vývoj prohlížečového pluginu pro základní, rychlou analýzu.
-   **M2 – Deep dozrávání:** Zprovoznění serverového workera pro hloubkovou asynchronní analýzu.
-   **M3 – Profily a ochrana:** Implementace uživatelských profilů a "Varovátoru".
-   **M4 – Orientační navigace:** Vývoj logiky "Intent-Match".
-   **M5 – AI jako komentátor:** Volitelné rozšíření o generativní shrnutí a vysvětlení.

---

## ČÁST 5: ZÁZNAM PRACÍ A STAV PROJEKTU (ŽIVÝ LOG)

Tato sekce slouží jako živý deník, záznam všech provedených prací a kontrolní mechanismus postupu projektu. Po dokončení každého významného kroku bude tato sekce aktualizována.

### M0 – Základ (Infrastruktura)
*   **Stav:** HOTOVO ✅
*   **Provedené práce:**
    *   `[2026-01-27]` Sjednocena projektová dokumentace do finální specifikace `GEMINI3.md`.
    *   `[2026-01-27]` Založena základní adresářová struktura (`api/`, `frontend/`, `worker/`).
    *   `[2026-01-27]` Vytvořen základní `docker-compose.yml` pro všechny služby.
    *   `[2026-01-27]` Vytvořeny placeholder `Dockerfile` pro každou službu.
    *   `[2026-01-27]` Připraveny a zdokumentovány Nginx konfigurace pro `app.wai.ventureout.cz` a `api.wai.ventureout.cz`.
    *   `[2026-01-27]` Poskytnuty instrukce pro nasazení kostry projektu na server `setonuk`.

### M1 – Light verze (Frontend a plugin)
*   **Stav:** Čeká se ⏳
*   **Provedené práce:**
    *   (Zatím žádné)

### M2 – Deep dozrávání (Backend a worker)
*   **Stav:** Čeká se ⏳
*   **Provedené práce:**
    *   (Zatím žádné)

### M3 – Profily a ochrana
*   **Stav:** Čeká se ⏳
*   **Provedené práce:**
    *   (Zatím žádné)

### M4 – Orientační navigace
*   **Stav:** Čeká se ⏳
*   **Provedené práce:**
    *   (Zatím žádné)

### M5 – AI jako komentátor
*   **Stav:** Čeká se ⏳
*   **Provedené práce:**
    *   (Zatím žádné)

---

## ČÁST 6: ZÁVĚREČNÝ PRINCIP

> WAI není mapa světa.
> WAI je kompas.
>
> Neříká, kam máš jít.
> Pomáhá ti poznat, **kdy jsi sešel z cesty**.

---

## ČÁST 7: DODATKY A PŮVODNÍ POZNÁMKY

*Tato sekce obsahuje původní, automaticky přepsané poznámky z GEMINI.md pro zachování plného kontextu a historických myšlenek.*

Mít různé vstupní vektory kdo se dívá a podle toho povolit či přesměrovat ?
“Takže kdybych si to nastavil jako nějaký vinkovní proxy, třeba, já nevím, na AVS-ku, tak, že by se to učilo podle všech magných uživatelů.”
“Možná bude to širokostatý grant, co ty na to?”
“Já jsem překázal již na tvůj názor, jak to udělat, protože teď už z toho základního Aura webu vzniká nějakej reálnej projekt, který bude jako veřejná proxy. Je to tak, že jo?”
“Víš co, tohle by se hodilo asi Googlu odněmit, nebo nějakým takovýmhle velkým vyhledávačem. Myslíš, že bys prohlídnul něco Google, nebo jestli Google nechce nabírat někoho.”
“Já bych mohl prezentovat tuto myšlenku, já hledám ještě furt práci. Takže jestli najdeš třeba, že Google hledá nějakýho projekt, mážerá na něco, co by odpovídalo tomuto, tak to by mohl být vstupný projekt. Co ti na to?”
“napadá měm, teda zkusíš prohledat, jestli něco takového už existuje. A pokud ano, tak je to slepová cesta, že jo. Ale zkus mi najít, jestli tudlenstvo věc...”
“Nie chcę, abyś mnie braział po oczach. Chcę, abyś mnie zakispytował. Chcę, abyś podniecił grze w ogóle. Nie to by to celu miało.”
“Dobře, tak znovu, pojď, pojď, bude to myšlenko. Máme sedmitý pouh vězdu a palivní kulečko.”
“Můžeme v základě toho říct, že je to unikátní nápad.”
“s tím, jak kvalifikovat weby, jestli to jde udělat relativně rychle. A když si nastavíš takovou proxy, že by si automaticky dostalo něco jako rychlého overview toho webu v ten danej okamžik, aby to bylo platné všeobecně pro víc lidí, že když už někdo na to koukne, tak to nemusí analyzovat třeba pár vteřin, ale že už rovnou vidí výsledek a buď na ten web pustí, nebo ho nějakým způsobem identifikuje a řekne, že je to hodný nebo nehodný, proto se díva.”
“Chci ti přerušit. Já se ptám, jestli ten, ten, ten, Aura, nebo tak, nebo něco, jak to chceš nazvat, může být zatím jenom indexováním obřehu.”
“Jak byste potom řešil takovejhle index třeba nějakým pluginem do Google Chromeu nebo do čeho dalšího, kdyby ti to ukazovalo, jak moc ten web je. Natomiast ten poweraindexům od 9 nic by to neomezovalo. Mohl by seš tam zapadl do vlastních, kdyby si zbyták Prahy sám osobně. Ale žeby jsi měl takovou auravopindex proxino uvnitř.”
No tak to zahrn do nového Gemini,md jako veřjnou službu kde by se aura index webu aktualizoval a a ty měl jasno jaky obsah sleduješ a sám bys ladil tyto metriky a tím pomáhal ostatnim.
