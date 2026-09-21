# Överför Filer till Strålfors

_Del av [processöversikten](./DOCS_Overview.md) för fakturadistribution._

Ett fristående script (`services/economy/src/scripts/transfer-stralfors-files.ts`) hämtar samtliga nya fakturafiler som Tenfast har kö:at för export (`status: NEW` i Tenfasts `outbound-exports`), laddar upp dem till Strålfors via SFTP för tryck och distribution, och markerar dem som skickade i Tenfast. Till skillnad från övriga processer i den här mappen körs det här scriptet helt inom **Economy** — Core är inte inblandat (se [processöversiktens](./DOCS_Overview.md) not om det).

Schemaläggningen ligger inte i onecore-repot utan i `mimer-onecore-operations` (`apps/onecore/economy/transferstralforsfilescronjob.yaml`) — ett Kubernetes CronJob vid namn `transfer-stralfors-files` som kör `pnpm script:transfer-stralfors-files` i economy-imagen, vardagar kl 06:00 UTC (`0 6 * * 1-5`, "måste bli klar innan Strålfors 09:00-deadline" enligt kommentar i manifestet). **CronJobbet är för närvarande satt till `suspend: true`** — bekräfta med teamet om det är avsiktligt innan detta tas som sanning om produktionsbeteende.

## Flödesdiagram

Processens beslutslogik: vilka steg som körs, och hur fel per fil hanteras. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start: CronJob<br/>transfer-stralfors-files<br/>Vardagar 06:00 UTC] --> B(Lista Nya Export-filer<br/>från Tenfast)
B --> C{Fler filer<br/>i listan?}
C --> |No| N[Skicka Sammanfattnings-<br/>mejl]
C --> |Yes| D(Ladda ner Fil från Tenfast)
D --> Do{Nedladdning OK?}
Do --> |No| E[Logga + Mejla Fel<br/>för denna fil]
Do --> |Yes| F(Ladda upp till<br/>Strålfors via SFTP)
F --> Fo{Uppladdning OK?}
Fo --> |No| E
Fo --> |Yes| G(Markera Skickad i Tenfast)
G --> Go{Lyckades?}
Go --> |No| E
Go --> |Yes| H[Nästa Fil]
E --> H
H --> C
N --> O[End]
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Det här är ett fristående script, inte en HTTP-endpoint — det körs som ett eget engångs-Kubernetes-Job skapat av CronJobbet, utan mänsklig initierare.

```mermaid
sequenceDiagram
    participant CronJob as CronJob transfer-stralfors-files<br/>(mimer-onecore-operations)
    participant Economy as Economy (script)
    participant Tenfast as Tenfast
    participant SFTP as SFTP (Strålfors)
    participant Infobip as Infobip (mejl)

    CronJob ->> Economy: Run transfer-stralfors-files<br/>(pnpm script:transfer-stralfors-files)

    Economy ->> Tenfast: GET /v1/hyresvard/outbound-exports<br/>?status=NEW (paginerat)
    Tenfast -->> Economy: Filer (obs: alla providers,<br/>ingen filtrering på fältet provider)

    break when listningen misslyckas
        Economy ->> Infobip: Mejla felsammanfattning
        Economy-->CronJob: throw, scriptet avslutas med felkod
    end

    alt Inga nya filer
        Economy ->> Infobip: Mejla "0 överförda"
        Economy-->CronJob: Done
    end

    Economy ->> SFTP: Anslut (lösenord + värdnyckel-<br/>verifiering mot SHA256-fingerprint)

    break when anslutning misslyckas
        Economy ->> Infobip: Mejla felsammanfattning
        Economy-->CronJob: throw, scriptet avslutas med felkod
    end

    loop För varje fil
        Economy ->> Tenfast: POST /outbound-exports/{id}/download
        Tenfast -->> Economy: Filinnehåll (binärt)

        break when nedladdning misslyckas
            Economy ->> Economy: Logga fel, räkna som misslyckad,<br/>fortsätt med nästa fil
        end

        Economy ->> SFTP: Ladda upp fil till konfigurerad katalog

        break when uppladdning misslyckas
            Economy ->> Economy: Logga fel, räkna som misslyckad,<br/>fortsätt med nästa fil
        end

        Economy ->> Tenfast: POST /outbound-exports/{id}/mark-sent
        note over Economy,Tenfast: Markeras skickad EFTER lyckad<br/>uppladdning — kraschar scriptet innan<br/>dess laddas filen upp igen nästa körning,<br/>eftersom Tenfast bara märker filen skickad<br/>när detta anrop lyckas.
        Tenfast -->> Economy: Uppdaterad status (sentAt)

        break when markering misslyckas
            Economy ->> Economy: Logga fel, räkna som misslyckad<br/>(filen laddas dock redan upp — nästa<br/>körning laddar upp den igen)
        end
    end

    Economy ->> SFTP: Koppla ner (alltid, även vid fel)
    Economy ->> Infobip: Mejla sammanfattning<br/>(antal överförda/misslyckade, varaktighet)
    Economy -->> CronJob: Done

```

## Att känna till

- **Ingen filtrering på `provider`.** Scriptet litar på att Tenfasts `NEW`-kö bara innehåller filer avsedda för Strålfors — det läser inte fältet `provider`/`type` på exportposten. Om Tenfast någon gång börjar kö:a andra exporttyper i samma kö skulle de tystas laddas upp till Strålfors SFTP utan att scriptet upptäcker det.
- **Per-fil-isolering.** Ett fel på en fil (nedladdning, uppladdning eller markering) stoppar inte resten av batchen — det loggas, mejlas och scriptet fortsätter med nästa fil.
- **SFTP-värdverifiering är valfri men rekommenderad.** Om `STRALFORS_EXPORT__SFTP__HOST_FINGERPRINT` inte är satt loggas en varning och all värdverifiering hoppas över (`hostVerifier` returnerar alltid `true`).
- **Filformat:** enligt testfabriken (`TenfastOutboundExportFactory`) är exempeldata `type: 'stralfors_invoice'`, `format: 'xml'` — dvs XML-filer med fakturadata från Tenfast.
