# ONECore

[![CI](https://github.com/Bostads-AB-Mimer/onecore/actions/workflows/ci.yaml/badge.svg)](https://github.com/Bostads-AB-Mimer/onecore/actions/workflows/lint.yaml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--only-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E=20.x-brightgreen)](https://nodejs.org/en/)

Monorepo containing all base services and applications of the ONECore platform.

## Snabbstart för nya utvecklare

### Förutsättningar

Se till att du har följande installerat på din maskin:

- [Docker](https://docs.docker.com/get-docker/) (version 20.10 eller senare)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 eller senare)
- [Node.js](https://nodejs.org/) (version 20 eller senare)
- [npm](https://www.npmjs.com/) (kommer med Node.js)

### Komma igång

1. **Klona repositoryt:**
   ```bash
   git clone <repository-url>
   cd onecore
   ```

2. **Installera dependencies:**
   ```bash
   npm install
   ```

3. **Starta alla tjänster med Docker Compose:**
   ```bash
   docker-compose up --build
   ```

   Detta kommer att:
   - Bygga alla Docker-images
   - Starta alla tjänster på sina respektive portar
   - Sätta upp nätverket mellan tjänsterna

### Tillgängliga tjänster

När alla tjänster är igång kan du komma åt dem på följande portar:

| Tjänst | Port | URL |
|--------|------|-----|
| Core API | 5010 | http://localhost:5010 |
| Property Service | 5050 | http://localhost:5050 |
| Leasing Service | 5020 | http://localhost:5020 |
| Property Management | 5030 | http://localhost:5030 |
| Work Order Service | 5070 | http://localhost:5070 |
| Communication Service | 5040 | http://localhost:5040 |
| Internal Portal Backend | 5060 | http://localhost:5060 |
| Internal Portal Frontend | 3000 | http://localhost:3000 |
| Property Tree App | 3001 | http://localhost:3001 |

### Utveckling

#### Arbeta med enskilda tjänster

För att starta endast specifika tjänster:

```bash
# Starta endast core och dess dependencies
docker-compose up core

# Starta endast property-tree appen
docker-compose up property-tree

# Starta flera specifika tjänster
docker-compose up core property leasing
```

#### Bygga om tjänster

När du gör ändringar i koden:

```bash
# Bygga om alla tjänster
docker-compose build

# Bygga om en specifik tjänst
docker-compose build core

# Bygga om och starta
docker-compose up --build
```

#### Visa loggar

```bash
# Visa loggar för alla tjänster
docker-compose logs

# Visa loggar för en specifik tjänst
docker-compose logs core

# Följa loggar i realtid
docker-compose logs -f core
```

#### Stoppa tjänster

```bash
# Stoppa alla tjänster
docker-compose down

# Stoppa och ta bort volymer
docker-compose down -v

# Stoppa och ta bort images
docker-compose down --rmi all
```

### Vanliga kommandon

```bash
# Installera dependencies för alla paket
npm install

# Bygga alla paket
npm run build

# Köra linting för alla paket
npm run lint

# Köra linting och fixa problem
npm run lint:fix

# Köra prettier för alla paket
npm run prettier

# Köra typechecking för alla paket
npm run typecheck
```

### Felsökning

#### Portkonflikt
Om du får felmeddelanden om att portar redan används, kontrollera vilka processer som använder portarna:

```bash
# macOS/Linux
lsof -i :5010

# Stoppa en specifik process
kill -9 <PID>
```

#### Docker-problem
Om du får Docker-relaterade fel:

```bash
# Rensa Docker-cache
docker system prune -a

# Starta om Docker Desktop
# (på macOS/Windows)
```

#### Minnesanvändning
Om Docker använder för mycket minne, justera inställningarna i Docker Desktop eller lägg till resource limits i docker-compose.yml.
>>>>>>> 39cc86ff (feat: lägg till docker-compose och uppdatera README för enkel onboarding)

### Förutsättningar

Se till att du har följande installerat på din maskin:

- [Docker](https://docs.docker.com/get-docker/) (version 20.10 eller senare)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 eller senare)
- [Node.js](https://nodejs.org/) (version 20 eller senare)
- [npm](https://www.npmjs.com/) (kommer med Node.js)

### Komma igång

1. **Klona repositoryt:**
   ```bash
   git clone <repository-url>
   cd onecore
   ```

2. **Installera dependencies:**
   ```bash
   npm install
   ```

3. **Starta alla tjänster med Docker Compose:**
   ```bash
   docker-compose up --build
   ```

   Detta kommer att:
   - Bygga alla Docker-images
   - Starta alla tjänster på sina respektive portar
   - Sätta upp nätverket mellan tjänsterna

### Tillgängliga tjänster

När alla tjänster är igång kan du komma åt dem på följande portar:

| Tjänst | Port | URL |
|--------|------|-----|
| Core API | 5010 | http://localhost:5010 |
| Property Service | 5050 | http://localhost:5050 |
| Leasing Service | 5020 | http://localhost:5020 |
| Property Management | 5030 | http://localhost:5030 |
| Work Order Service | 5070 | http://localhost:5070 |
| Communication Service | 5040 | http://localhost:5040 |
| Internal Portal Backend | 5060 | http://localhost:5060 |
| Internal Portal Frontend | 3000 | http://localhost:3000 |
| Property Tree App | 3001 | http://localhost:3001 |

### Utveckling

#### Arbeta med enskilda tjänster

För att starta endast specifika tjänster:

```bash
# Starta endast core och dess dependencies
docker-compose up core

# Starta endast property-tree appen
docker-compose up property-tree

# Starta flera specifika tjänster
docker-compose up core property leasing
```

#### Bygga om tjänster

När du gör ändringar i koden:

```bash
# Bygga om alla tjänster
docker-compose build

# Bygga om en specifik tjänst
docker-compose build core

# Bygga om och starta
docker-compose up --build
```

#### Visa loggar

```bash
# Visa loggar för alla tjänster
docker-compose logs

# Visa loggar för en specifik tjänst
docker-compose logs core

# Följa loggar i realtid
docker-compose logs -f core
```

#### Stoppa tjänster

```bash
# Stoppa alla tjänster
docker-compose down

# Stoppa och ta bort volymer
docker-compose down -v

# Stoppa och ta bort images
docker-compose down --rmi all
```

### Vanliga kommandon

```bash
# Installera dependencies för alla paket
npm install

# Bygga alla paket
npm run build

# Köra linting för alla paket
npm run lint

# Köra linting och fixa problem
npm run lint:fix

# Köra prettier för alla paket
npm run prettier

# Köra typechecking för alla paket
npm run typecheck
```

### Felsökning

#### Portkonflikt
Om du får felmeddelanden om att portar redan används, kontrollera vilka processer som använder portarna:

```bash
# macOS/Linux
lsof -i :5010

# Stoppa en specifik process
kill -9 <PID>
```

#### Docker-problem
Om du får Docker-relaterade fel:

```bash
# Rensa Docker-cache
docker system prune -a

# Starta om Docker Desktop
# (på macOS/Windows)
```

#### Minnesanvändning
Om Docker använder för mycket minne, justera inställningarna i Docker Desktop eller lägg till resource limits i docker-compose.yml.

## Overview

### Repository structure

Apart from the core orchestration service, packages belong to one of three categories:

- **`apps`** - User-facing frontend applications
- **`libs`** - Libraries containing common functionality
- **`services`** - Microservices that provide ONECore features

```
.
├── core/
├── apps/
│   ├── internal-portal/
│   └── property-tree/
├── libs/
│   ├── types/
│   └── utilities/
└── services/
    ├── communication/
    ├── leasing/
    ├── property/
    ├── property-management/
    └── work-order/
```

### Getting started

### Bidra till projektet

1. Skapa en ny branch för din feature/bugfix
2. Gör dina ändringar
3. Kör tester och linting
4. Skapa en pull request

För mer detaljerad information om specifika tjänster, se README-filerna i respektive katalog.

## License

© 2025 Bostads AB Mimer. [AGPL-3.0-only Licensed](./LICENSE)
