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
F --> |Yes| H{Uppsägning i Tenfast?}
H --> |Oväntat Fel| E
H --> |Redan Avslutat<br/>eller Lyckades| J{Uppsägnings-PDF Redan<br/>Bifogad, eller Kontroll<br/>Misslyckas?}
J --> |Ja| I[Avtal Avslutat i Tenfast]
J --> |Nej| K{PDF Hittas<br/>i Xpand?}
K --> |Nej| I
K --> |Ja| L(Ladda Upp PDF<br/>till Tenfast)
L --> Lo{Lyckades?}
Lo --> |Nej| I
Lo --> |Ja| M[Avtal Avslutat,<br/>PDF Bifogad]
P --> O
E --> O
G --> O
I --> O
M --> O
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
            alt Oväntat Fel
                Tenfast-->>Leasing: 4xx/5xx
                Leasing-->>SyncScript: 500
                SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
            else Redan Avslutat ("Avtalet kan inte<br/>sägas upp") eller Lyckades
                Tenfast-->>Leasing: 400 eller 200

                note over Leasing: Bästa-försök: bifoga uppsägnings-PDF från<br/>Xpand. Körs även när avtalet redan var<br/>avslutat, så en tidigare misslyckad<br/>uppladdning kan repareras vid omkörning.<br/>Varje steg nedan misslyckas tyst (loggas,<br/>men avslutar inte hela raden).

                Leasing ->> Tenfast: Slå upp Avtal Igen (by externalId)

                break when Uppslag Misslyckas
                    Leasing-->>SyncScript: 200 (utan PDF-bifogning)
                end

                Leasing ->> Tenfast: Har Avtalet Redan en<br/>Uppsägnings-PDF? (hasTerminationFile)

                break when Kontrollen Misslyckas,<br/>eller PDF Redan Finns
                    Leasing-->>SyncScript: 200 (utan PDF-bifogning)
                end

                Leasing ->> Xpand: Hämta Uppsägnings-PDF (dokop)

                break when Ingen PDF Hittas i Xpand
                    Leasing-->>SyncScript: 200 (utan PDF-bifogning)
                end

                Leasing ->> Tenfast: POST /avtal/{id}/upload-termination-file

                alt Uppladdning Misslyckas
                    Leasing-->>SyncScript: 200 (utan PDF-bifogning)
                else Uppladdning Lyckas
                    Leasing-->>SyncScript: 200 { action: "terminated" eller "skipped" }
                end
            end
        end

        SyncScript ->> SyncScript: Spara checkpoint-tidsstämpel<br/>(oavsett utfall för raden)
    end

```

## Att känna till

- **Bilplatser (Garagekontrakt) synkas aldrig här.** `cmlog`-adaptern klassificerar Garagekontrakt-rader precis som Bostads-/Lokalkontrakt, men filtret `isResidenceOrStorage` i `sync-leases` släpper bara igenom lägenhet eller lokal+förråd. En bilplats som sägs upp direkt i Xpand loggas som "not in scope" och synkas aldrig till Tenfast via det här flödet.
- **Idempotent.** Om avtalet redan är avslutat i Tenfast (Tenfast svarar med felmeddelandet "Avtalet kan inte sägas upp") räknas raden ändå som lyckad — bra för omkörningar, men jämför med [Synka Makulering](./DOCS_Void_Lease_via_Xpand_Sync.md), som saknar motsvarande skydd.
- **Checkpoint sparas per rad, oavsett utfall — inte bara vid lyckad synk.** `saveLastTimestamp` körs utanför try/catch:en, så en misslyckad rad flyttar checkpointen förbi sig precis som en lyckad. Återförsök sker istället via en separat JSONL-kö som dräneras i början av nästa körning, innan nya cmlog-rader hämtas — inte genom att flytta tillbaka checkpointen. Kraschar scriptet mitt i en körning börjar nästa körning alltså om från checkpointen, inte om från den senast lyckade raden.
- En preliminär xpand-uppsägning (fältet "Preliminärt uppsagt") triggar **inte** det här flödet — bara när "Uppsagt datum" faktiskt sätts.
- **Bästa-försök-bifogning av uppsägnings-PDF.** Efter en lyckad (eller redan-avslutad) uppsägning i Tenfast försöker Leasing separat bifoga den operativa uppsägningshandlingen från Xpand via `upload-termination-file`. Det här är ett eget, tyst best-effort-steg: hittas ingen PDF, finns redan en, eller misslyckas uppladdningen, påverkar det inte huruvida raden räknas som lyckad — bara att PDF:en saknas i Tenfast tills en senare körning lyckas bifoga den.
