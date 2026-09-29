# ONECore — Felsökning och incidenter

Stöd för att felsöka ONECore vid driftstörningar. Se [ARCHITECTURE.md](./ARCHITECTURE.md) för hur tjänsterna hänger ihop — den här sidan beskriver hur man kontrollerar status och spårar ett specifikt fel.

## Health checks

Varje tjänst exponerar `GET /health` — men de kollar riktig konnektivitet mot sina beroenden (databaser, externa system), inte bara att processen lever. Svaret innehåller ett delsystem per beroende med status `active`/`impaired`/`failure`/`unknown`. Exempel: leasings `/health` verifierar separat sin egen databas, Xpand-databasen, Xpand SOAP och Creditsafe — om t.ex. bara Creditsafe är `failure` medan resten är `active` ser man det direkt i svaret, utan att behöva gissa.

**Genväg:** `GET /health` på **Core** ger en samlad statusbild — men bara för ett urval av tjänsterna, se lucka nedan.

### Täckning idag

| Tjänst              | Har eget `/health` | Ingår i Core:s samlade `/health` |
| ------------------- | ------------------ | -------------------------------- |
| Leasing             | Ja                 | Ja                               |
| Property            | Ja                 | Ja                               |
| Property Management | Ja                 | Ja                               |
| Communication       | Ja                 | Ja                               |
| Work Order          | Ja                 | Ja                               |
| Contacts            | Ja                 | Ja                               |
| Economy             | Ja                 | **Nej**                          |
| Inspection          | Ja                 | **Nej**                          |
| File Storage        | Ja                 | **Nej**                          |
| Keys                | **Nej**            | **Nej**                          |

**Känd lucka:** Core:s samlade hälsostatus täcker bara 6 av 10 tjänster. Går Economy, Inspection eller File Storage ner syns det **inte** i Core:s `/health`, trots att de har egna, fungerande health-checks — de är bara inte inkopplade i Core:s pollningslista (`core/src/services/health-service/index.ts`). Keys saknar `/health` helt.

**Praktiskt:** vid en incident, kolla Core:s `/health` först för en snabb överblick — men om felet kan tänkas ligga i Economy, Inspection, File Storage eller Keys måste den tjänstens egna `/health` kollas separat (samma path, `/health`, på respektive tjänsts egen bas-URL).

## Loggar

Alla tjänster loggar strukturerad JSON via Pino, och skickar loggarna direkt till **Elasticsearch** (index `onecore-logging`), visas via **Kibana**. Lokalt (docker-compose) körs detta mot `localhost:9200`; i drift går det mot en annan Elasticsearch-instans — se wiki-sidan "Instruktion för loggar i Azure" för inloggning/URL dit (inte bekräftat här, länka inte förrän innehållet är verifierat).

**Att spåra ett specifikt fel:** varje inkommande request får ett `correlationId` (från headern `x-correlation-id`, eller genereras om den saknas) som följer med i **varje** loggrad genom hela anropskedjan, även tvärs över tjänster. Sök på `correlationId` i Kibana för att se hela kedjan av vad som hände för ett specifikt anrop, inte bara en enskild tjänsts del av det.

Varje loggrad är dessutom taggad med `application.name` (vilken tjänst) och `application.environment` (vilken miljö) — användbart för att filtrera i Kibana.

## Öppna punkter

- Bekräfta att "Instruktion för loggar i Azure" i wikin faktiskt beskriver samma Elasticsearch/Kibana-instans som produktionstjänsterna skriver till, så vi kan länka hit med rätt information.
- Ta ställning till om Core:s hälso-aggregering bör utökas till att även täcka Economy, Inspection och File Storage, och om Keys bör få ett eget `/health`.
- Kända felbilder ("om X går ner, symptom är Y, kolla Z") och eskalering/ägarskap per extern leverantör saknas ännu — det kräver teamets operativa kunskap, inte något som går att härleda ur koden.
