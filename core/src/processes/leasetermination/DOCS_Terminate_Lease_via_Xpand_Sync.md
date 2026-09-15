# Synka Uppsägning från Xpand

_Del av [processöversikten](./DOCS_Overview.md) för uppsägning av avtal._

Ett schemalagt script i Core (`core/src/scripts/sync-leases`) pollar Xpands `cmlog`-tabell efter avtal där fältet "Uppsagt datum" precis satts — det vill säga en slutgiltig, bekräftad uppsägning i Xpand (till skillnad från en preliminär uppsägning, som ignoreras helt av den här synken). För varje sådan rad kontrolleras att hyresobjektet är av en typ som ska synkas, varpå avtalet avslutas i Tenfast via Leasing.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om en rad synkas, hoppas över eller köas för återförsök. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start: cmlog-rad,<br/>'Uppsagt datum' satt] --> B{Relevant Kontraktstyp?<br/>Bostads-/Lokal-/Garagekontrakt}
B --> |No| O[End: Ignoreras]
B --> |Yes| C{Hyresobjektstyp i Scope?<br/>Lägenhet eller Lokal+Förråd}
C --> |No — t.ex. Bilplats| P[Hoppas Över Tyst,<br/>Loggas Endast]
C --> |Yes| D{LastDebitDate<br/>Finns i Xpand?}
D --> |No| E[Fel: Köas för<br/>Återförsök + Mejl]
D --> |Yes| F{Avtal Hittat<br/>i Tenfast?}
F --> |No| G[Räknas som Lyckat —<br/>Inget att Avsluta]
F --> |Yes| H{Redan Avslutat<br/>i Tenfast?}
H --> |Yes| G
H --> |Nej, Lyckades| I[Avtal Avslutat i Tenfast]
H --> |Nej, Annat Fel| E
P --> O
E --> O
G --> O
I --> O
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
    Leasing ->> Leasing: Klassificera: 'Uppsagt datum'<br/>tomt → datum ger action "terminate"
    Leasing -->> SyncScript: Lista av LeaseChange

    loop För varje uppsägningsrad
        SyncScript ->> Xpand: Hämta Hyresobjektsinfo (typ)

        break when Typ inte är Lägenhet eller Lokal+Förråd (t.ex. Bilplats)
            SyncScript ->> SyncScript: Loggas "not in scope",<br/>hoppas över — inget fel, ingen synk
        end

        SyncScript ->> Leasing: POST /leases/sync<br/>{leaseId, action: "terminate"}
        Leasing ->> Xpand: Hämta Avtal (LastDebitDate)

        break when LastDebitDate Saknas
            Leasing-->SyncScript: 400
            SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
        end

        Leasing ->> Tenfast: Slå upp Avtal (by externalId)

        alt Avtal ej Hittat i Tenfast
            Leasing-->>SyncScript: 200 { action: "skipped" }
        else Avtal Hittat
            Leasing ->> Tenfast: POST /avtal/{id}/terminate<br/>(endDate, reason: "Synced from xpand",<br/>notifyHg: false, handled: true)
            alt Redan Avslutat ("Avtalet kan inte sägas upp")
                Tenfast-->>Leasing: 400
                Leasing-->>SyncScript: 200 { action: "skipped" }
            else Lyckades
                Tenfast-->>Leasing: 200
                Leasing-->>SyncScript: 200 { action: "terminated" }
            else Oväntat Fel
                Tenfast-->>Leasing: 4xx/5xx
                Leasing-->>SyncScript: 500
                SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
            end
        end

        SyncScript ->> SyncScript: Spara checkpoint-tidsstämpel<br/>(endast efter lyckad rad)
    end

```

## Att känna till

- **Bilplatser (Garagekontrakt) synkas aldrig här.** `cmlog`-adaptern klassificerar Garagekontrakt-rader precis som Bostads-/Lokalkontrakt, men filtret `isResidenceOrStorage` i `sync-leases` släpper bara igenom lägenhet eller lokal+förråd. En bilplats som sägs upp direkt i Xpand loggas som "not in scope" och synkas aldrig till Tenfast via det här flödet.
- **Idempotent.** Om avtalet redan är avslutat i Tenfast (Tenfast svarar med felmeddelandet "Avtalet kan inte sägas upp") räknas raden ändå som lyckad — bra för omkörningar, men jämför med [Synka Makulering](./DOCS_Void_Lease_via_Xpand_Sync.md), som saknar motsvarande skydd.
- **Checkpoint sparas per rad, efter lyckad synk.** Kraschar scriptet mitt i en körning synkas redan behandlade rader inte om, medan resterande rader (och den trasiga) fångas upp nästa körning eller ligger kvar i återförsökskön.
- En preliminär xpand-uppsägning (fältet "Preliminärt uppsagt") triggar **inte** det här flödet — bara när "Uppsagt datum" faktiskt sätts.
