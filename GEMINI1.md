# Web Aura Index (WAI) - Architektonický Návrh v2.0 (Cloud)

Tento dokument popisuje architekturu a technologický stack pro projekt Web Aura Index, navržený pro nasazení na cloudovém serveru (OCI Free Tier: ARM 24GB RAM) s veřejnou IP adresou.

---

## 1. Filozofie a Cíle

Základní myšlenka zůstává stejná jako v původním konceptu: hodnotit webové stránky nejen na základě technických metrik, ale i jejich "charakteru" a "úmyslu" pomocí modelu **Sedmicípé hvězdy** a **Jednobarevného kruhu**.

Cíle této architektury:
- **Škálovatelnost:** Systém musí být schopen zpracovávat stovky až tisíce požadavků na analýzu bez degradace výkonu.
- **Robustnost:** Jednotlivé komponenty musí být oddělené, aby chyba v jedné části neovlivnila celý systém.
- **Bezpečnost:** Služba bude vystavena do internetu, proto je nutné zajistit bezpečný provoz.
- **Snadná správa a nasazení:** Celý systém bude kontejnerizovaný pro jednoduchou replikaci a správu.

---

## 2. Architektura Systému: Cloud-Native a Kontejnerizovaná

Celý systém poběží v **Docker** kontejnerech, spravovaných pomocí **Docker Compose**. To zajistí izolaci, přenositelnost a snadnou správu.

**Tok dat a komunikace:**

1.  Uživatel přistupuje k webové aplikaci přes doménu (např. `aura.mojedomena.cz`).
2.  **Traefik (Reverse Proxy)** přijme požadavek, zajistí SSL (HTTPS) a přesměruje ho buď na Frontend (Next.js) nebo na Backend (API).
3.  Uživatel přes Frontend zadá URL k analýze. Požadavek jde na **API Server**.
4.  **API Server** validuje požadavek a vytvoří nový úkol, který vloží do **Redis (Task Queue)**.
5.  **Worker(s)** neustále sledují Redis. Jakmile se objeví nový úkol, jeden z workerů si ho vezme.
6.  **Worker** pomocí headless prohlížeče **Puppeteer** navštíví cílové URL, provede kompletní analýzu (včetně spuštění JavaScriptu) a extrahuje data.
7.  Výslednou auru (hvězdu a kruh) uloží Worker do databáze **PostgreSQL**.
8.  Frontend se periodicky dotazuje **API**, zda je analýza dokončena, a po dokončení zobrazí výsledek z databáze.

---

## 3. Komponenty Systému a Technologie

| Komponenta                 | Technologie          | Kontejner           | Popis a Důvod                                                                                                   |
| -------------------------- | -------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Reverse Proxy**          | **Traefik**          | `traefik`           | Spravuje příchozí provoz, automaticky generuje SSL certifikáty (Let's Encrypt) a integruje se s Dockerem.          |
| **Frontend (Web UI)**      | **Next.js**          | `frontend`          | Moderní React framework pro rychlé a interaktivní uživatelské rozhraní.                                           |
| **Backend (API Server)**   | **Node.js + Fastify**| `api`               | Vysoce výkonný a odlehčený framework pro tvorbu API. Bude spravovat úkoly, uživatele a komunikaci s databází. |
| **Task Queue / Cache**     | **Redis**            | `redis`             | Rychlé in-memory úložiště používané jako fronta úkolů pro workery a jako cache pro často dotazovaná data.        |
| **Databáze**               | **PostgreSQL**       | `postgres`          | Robustní a škálovatelná relační databáze pro ukládání výsledků analýz, uživatelských dat a konfigurace.            |
| **Analyzer / Worker**      | **Node.js + Puppeteer** | `worker`            | "Dělník", který provádí samotnou analýzu. Použití Puppeteer umožňuje analyzovat i moderní SPA (Single Page Apps). |

---

## 4. Datový Model a Logika Analýzy

### Základní schéma databáze (PostgreSQL)

- **`websites`**: Informace o analyzovaných webech (URL, doména, ...).
- **`analysis_jobs`**: Záznamy o úkolech (URL, stav `[pending, in_progress, completed, failed]`, čas vytvoření).
- **`aura_results`**: Detailní výsledky analýzy (hodnoty pro 7 cípů hvězdy, barva kruhu, slovní hodnocení, čas analýzy).
- **`user_feedback`**: Zpětná vazba od uživatelů k výsledkům.

### Logika Analýzy ve Workeru (s Puppeteer)

Worker bude mnohem schopnější než v původním návrhu:

1.  Spustí plnohodnotný headless prohlížeč.
2.  Načte stránku včetně spuštění veškerého JavaScriptu – získá tak finální podobu, jakou vidí uživatel.
3.  Získá přístup k **Core Web Vitals** pro přesné měření 🔴 **Stability**.
4.  Analyzuje finální DOM a viditelný obsah pro ostatní cípy hvězdy, což je mnohem přesnější.
5.  **Možnost budoucího rozšíření o AI:** Získaný čistý text může poslat na externí API (třeba open-source model hostovaný na Hugging Face) pro hlubší analýzu 🟣 **Smyslu** a ⚪ **Integrity**.

---

## 5. Kroky Implementace (Roadmapa)

1.  **Příprava serveru:** Instalace Dockeru a Docker Compose na OCI server.
2.  **Struktura projektu:** Vytvoření adresářové struktury a základního souboru `docker-compose.yml`.
3.  **Backend a Databáze:** Vývoj API (Fastify) s endpointy pro správu úkolů a definice databázového schématu (např. pomocí Prisma nebo TypeORM).
4.  **Vývoj Workera:** Implementace logiky workeru s Puppeteerem pro analýzu a ukládání výsledků.
5.  **Vývoj Frontendu:** Vytvoření UI v Next.js pro zadávání URL a vizualizaci výsledků.
6.  **Nasazení a Konfigurace Traefiku:** Konfigurace DNS, spuštění všech služeb přes `docker-compose up` a ověření funkčnosti na veřejné doméně s HTTPS.
7.  **Testování a Ladění.**

---

## 6. Ukázka `docker-compose.yml`

Toto je základní kostra, kterou lze uložit a použít ke spuštění celého systému.

```yaml
version: '3.8'

services:
  traefik:
    image: "traefik:v2.10"
    container_name: "traefik"
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=vas-email@domena.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080" # Pro Traefik dashboard
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "./letsencrypt:/letsencrypt"
    networks:
      - web

  api:
    build: ./api # Adresář s Dockerfilem pro API
    container_name: "wai-api"
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://user:password@postgres:5432/wai
      - REDIS_URL=redis://redis:6379
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.vasadomena.cz`)" # Upravte doménu
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=myresolver"
    depends_on:
      - postgres
      - redis
    networks:
      - web
      - internal

  frontend:
    build: ./frontend # Adresář s Dockerfilem pro Frontend
    container_name: "wai-frontend"
    restart: unless-stopped
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`app.vasadomena.cz`)" # Upravte doménu
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=myresolver"
    networks:
      - web

  worker:
    build: ./worker # Adresář s Dockerfilem pro Workera
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
  letsencrypt:

networks:
  web:
    external: true
  internal:
    external: false
```
