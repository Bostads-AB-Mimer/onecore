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
H --> |Ingen Uppsägning<br/>Krävs| I[Avtal Avslutat i Tenfast]
H --> |Redan Avslutat<br/>eller Lyckades| J{Uppsägnings-PDF<br/>Redan Bifogad?}
J --> |Kontroll Misslyckas| E
J --> |Ja| I
J --> |Nej| K{PDF Hittas<br/>i Xpand?}
K --> |Uppslag Misslyckas| E
K --> |Nej| N[Avtal Avslutat,<br/>Mejl: Bifoga PDF<br/>för Hand]
K --> |Ja| L(Ladda Upp PDF<br/>till Tenfast)
L --> Lo{Lyckades?}
Lo --> |Nej| E
Lo --> |Ja| M[Avtal Avslutat,<br/>PDF Bifogad]
P --> O
E --> O
G --> O
I --> O
M --> O
N --> O
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
            opt Uppsägningen Inte Redan Hanterad i Tenfast
                Leasing ->> Tenfast: POST /avtal/{id}/terminate<br/>(endDate, reason: "Synced from xpand",<br/>notifyHg: false, handled: true)
            end
            alt Oväntat Fel
                Tenfast-->>Leasing: 4xx/5xx
                Leasing-->>SyncScript: 500
                SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
            else Ingen Uppsägning Krävs ("Avtalet kommer löpa ut<br/>inom uppsägningstiden"), Samma Slutdatum
                Leasing-->>SyncScript: 200 { action: "skipped" } (utan PDF-steg)
            else Ingen Uppsägning Krävs, Annat Slutdatum i Tenfast
                Leasing-->>SyncScript: 500 { error: "end-date-mismatch" }
                SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
            else Redan Avslutat eller Lyckades
                note over Leasing: Bifoga uppsägnings-PDF från Xpand. Körs<br/>även när avtalet redan var avslutat, så<br/>ett återförsök laddar upp en PDF som<br/>misslyckades förra gången.

                Leasing ->> Tenfast: Har Avtalet Redan en<br/>Uppsägnings-PDF? (hasTerminationFile)
                Leasing ->> Xpand: Hämta Uppsägnings-PDF (dokop)
                Leasing ->> Tenfast: POST /avtal/{id}/upload-termination-file

                alt Kontroll, Uppslag eller Uppladdning Misslyckas
                    Leasing-->>SyncScript: 500 { error: "termination-pdf-…-failed" }
                    SyncScript ->> SyncScript: Köas för återförsök,<br/>felmejl skickas
                else Ingen PDF i Xpand
                    Leasing-->>SyncScript: 200 { document: "missing" }
                    SyncScript ->> SyncScript: Mejl: bifoga PDF för hand
                else PDF Redan Bifogad eller Uppladdad
                    Leasing-->>SyncScript: 200 { document: "already-attached" | "attached" }
                end
            end
        end

        SyncScript ->> SyncScript: Spara checkpoint-tidsstämpel<br/>(oavsett utfall för raden)
    end

```

## Att känna till

- **Bilplatser (Garagekontrakt) synkas aldrig här.** `cmlog`-adaptern klassificerar Garagekontrakt-rader precis som Bostads-/Lokalkontrakt, men filtret `isResidenceOrStorage` i `sync-leases` släpper bara igenom lägenhet eller lokal+förråd. En bilplats som sägs upp direkt i Xpand loggas som "not in scope" och synkas aldrig till Tenfast via det här flödet.
- **Idempotent.** Om avtalet redan är avslutat i Tenfast (Tenfast svarar med felmeddelandet "Avtalet kan inte sägas upp") räknas raden ändå som lyckad — bra för omkörningar, men jämför med [Synka Makulering](./DOCS_Void_Lease_via_Xpand_Sync.md), som saknar motsvarande skydd.
- **Positionen sparas per rad, oavsett utfall — inte bara vid lyckad synk.** `saveSyncPosition` körs utanför try/catch:en, så en misslyckad rad räknas som hanterad precis som en lyckad. Återförsök sker istället via en separat JSONL-kö som dräneras i början av nästa körning, innan nya cmlog-rader hämtas. Varje körning läser om de senaste fem minuterna av cmlog (rader kan bli synliga en stund efter sin logtime) och hoppar över de rader som redan hanterats, så en krasch mitt i en körning gör inte om rader som redan är klara.
- En preliminär xpand-uppsägning (fältet "Preliminärt uppsagt") triggar **inte** det här flödet — bara när "Uppsagt datum" faktiskt sätts.
- **Uppsägnings-PDF:en återförsöks.** Efter en lyckad (eller redan-avslutad) uppsägning bifogar Leasing uppsägningshandlingen från Xpand via `upload-termination-file`. Misslyckas kontrollen, uppslaget i Xpand eller uppladdningen svarar Leasing 500, så raden köas och försöks igen. Vid återförsöket hoppar Leasing över `POST /terminate` när Tenfast redan har en hanterad uppsägning (`cancellation.handledAt` satt) och kör bara PDF-steget. Saknar Xpand PDF:en räknas raden som lyckad och teamet får ett mejl om att bifoga den för hand. Ger kön upp efter 30 dagar säger mejlet att avtalet redan är uppsagt och att bara PDF:en saknas.
- **Ingen uppsägning krävs räknas bara som lyckad när slutdatumen stämmer.** Svarar Tenfast "Avtalet kommer löpa ut inom uppsägningstiden. Ingen uppsägning krävs." jämför Leasing avtalets slutdatum i Tenfast med sista debiteringsdag i Xpand. Är de samma räknas raden som lyckad utan PDF-steg och utan mejl. Skiljer de sig, eller saknar avtalet slutdatum i Tenfast, svarar Leasing 500 `end-date-mismatch`: raden köas och teamet får ett felmejl, eftersom Tenfast annars fortsätter debitera till sitt eget slutdatum. Tenfasts API kan inte flytta slutdatumet på ett signerat avtal, så det rättas för hand i Tenfast. Stämmer datumen vid nästa återförsök räknas raden som lyckad. Ger kön upp efter 30 dagar säger mejlet att slutdatumet ska rättas i Tenfast.
- **En senare makulering ersätter en köad uppsägning.** Ligger uppsägningen kvar i kön när en makulering av samma avtal kommer, tas uppsägningen bort ur kön (mejl: "ersatt av en senare ändring") i stället för att försökas mot ett makulerat avtal. En köad skapanderad ersätts aldrig.
