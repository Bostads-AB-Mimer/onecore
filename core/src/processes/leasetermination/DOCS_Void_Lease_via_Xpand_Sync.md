# Synka Makulering från Xpand

_Del av [processöversikten](./DOCS_Overview.md) för uppsägning av avtal._

Samma schemalagda script som synkar uppsägningar (`core/src/scripts/sync-leases`) pollar också Xpands `cmlog`-tabell efter avtal där fältet "Makulerat datum" precis satts — det vill säga att kontraktet annullerats, inte bara sagts upp. Makulering byter kontraktsnummer i Xpand (t.ex. `.../10` → `.../10M`), så synken måste läsa ut det ursprungliga kontraktsnumret ur samma logg-post för att hitta rätt avtal i Tenfast.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om en rad synkas, hoppas över eller köas för återförsök. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start: cmlog-rad,<br/>'Makulerat datum' satt] --> B{Relevant Kontraktstyp?<br/>Bostads-/Lokal-/Garagekontrakt}
B --> |No| O[End: Ignoreras]
B --> |Yes| C{Rad Innehåller<br/>Kontraktsnummer-bytesrad?}
C --> |No| D[Loggas som Varning,<br/>Hoppas Över Helt]
C --> |Yes, Original-LeaseId Extraheras| E{Hyresobjektstyp i Scope?<br/>Lägenhet eller Lokal+Förråd}
E --> |No — t.ex. Bilplats| P[Hoppas Över Tyst,<br/>Loggas Endast]
E --> |Yes| F{Avtal Hittat<br/>i Tenfast?}
F --> |No| G[Räknas som Lyckat —<br/>Inget att Makulera]
F --> |Yes| H{Makulering<br/>Lyckades?}
H --> |Ja| I[Avtal Makulerat i Tenfast]
H --> |Nej, Oväntat Fel| J[Fel: Köas för<br/>Återförsök + Mejl]
D --> O
P --> O
G --> O
I --> O
J --> O
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Det här är ett fristående, schemalagt script — inte en HTTP-endpoint initierad av en människa.

```mermaid
sequenceDiagram
    participant CronJob as Schemaläggning
    participant SyncScript as sync-leases (Core)
    participant Leasing as Leasing
    participant Xpand as Xpand
    participant Tenfast as Tenfast

    CronJob ->> SyncScript: Run sync-leases
    SyncScript ->> Leasing: GET /leases/sync?since={senaste checkpoint}
    Leasing ->> Xpand: Läs cmlog WHERE logmemo LIKE 'Hyreskontrakt %'
    Xpand -->> Leasing: Rader
    Leasing ->> Leasing: Klassificera: 'Makulerat datum'<br/>tomt → datum ger action "void"

    note over Leasing: Kontraktsnumret i loggraden har redan bytts<br/>till M-suffix-varianten. Original-leaseId läses ut<br/>ur en separat "Kontraktsnummer ändrat"-rad i samma post.

    break when Kontraktsnummer-bytesraden saknas i posten
        Leasing ->> Leasing: Loggas som varning,<br/>raden hoppas över helt (ingen LeaseChange skapas)
    end

    Leasing -->> SyncScript: Lista av LeaseChange (action: "void")

    loop För varje makulerings-rad
        SyncScript ->> Xpand: Hämta Hyresobjektsinfo (typ)

        break when Typ inte är Lägenhet eller Lokal+Förråd (t.ex. Bilplats)
            SyncScript ->> SyncScript: Loggas "not in scope",<br/>hoppas över — inget fel, ingen synk
        end

        SyncScript ->> Leasing: POST /leases/sync<br/>{leaseId (original, utan M-suffix), action: "void"}
        Leasing ->> Tenfast: Slå upp Avtal (by externalId)

        alt Avtal ej Hittat i Tenfast
            Leasing-->>SyncScript: 200 { action: "skipped" }
        else Avtal Hittat
            Leasing ->> Tenfast: PATCH /avtal/{id}/void<br/>(reason: "Synced from xpand")
            alt Lyckades
                Tenfast-->>Leasing: 200
                Leasing-->>SyncScript: 200 { action: "voided" }
            else Valfritt Oväntat Fel<br/>(t.ex. redan makulerat)
                Tenfast-->>Leasing: 4xx/5xx
                Leasing-->>SyncScript: 500
                SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
            end
        end

        SyncScript ->> SyncScript: Spara checkpoint-tidsstämpel<br/>(oavsett utfall för raden — se not i systerdokumentet<br/>om uppsägning för detaljer)
    end

```

## Att känna till

- **Ingen idempotens-guard, till skillnad från uppsägning.** `voidLease` har ingen specialhantering av något "redan makulerat"-felmeddelande motsvarande terminate-flödets `'Avtalet kan inte sägas upp'` — varje oväntat 4xx-svar räknas som ett hårt fel. En rad som redan är makulerad i Tenfast (t.ex. efter en tidigare delvis lyckad körning) kan därför fastna i återförsökskön permanent, eftersom varje ny körning ger samma fel tills någon manuellt tar bort den ur kön.
- **Kontraktsnummer-bytesraden är ett hårt krav.** Saknas "Kontraktsnummer ändrat"-raden i samma cmlog-post kan original-leaseId inte extraheras, och hela raden hoppas över med bara en varningslogg — ingen synk sker alls, trots att "Makulerat datum" faktiskt sattes i Xpand.
- **Samma bilplats-filtrering som uppsägningsflödet.** Se [processöversiktens](./DOCS_Overview.md) not — `isResidenceOrStorage` filtrerar bort Garagekontrakt precis som för terminate.
