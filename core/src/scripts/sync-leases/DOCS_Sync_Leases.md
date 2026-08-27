# Synka Avtal från XPand

_Del av [processöversikten](../DOCS_Sync_Overview.md) för XPand-synk. Där beskrivs den gemensamma mekaniken — checkpoint, felkö, notifieringar och schemaläggning — som inte upprepas här._

Ett fristående script (`core/src/scripts/sync-leases/index.ts`) speglar hyreskontrakt från XPand till **Tenfast**. Så länge handläggare fortfarande tecknar, säger upp och makulerar avtal i XPand är det XPand som är sanningskällan; scriptet ser till att Tenfast konvergerar mot samma tillstånd.

Till skillnad från [kontaktsynken](../sync-contacts/DOCS_Sync_Contacts.md), som bara uppdaterar befintlig data, **skapar** den här synken avtal i Tenfast — inklusive hyresgäst och hyresrader — och avslutar dem.

Scriptet körs som Kubernetes CronJobbet `sync-leases` varje minut. Se [processöversikten](../DOCS_Sync_Overview.md#schemaläggning) för schemaläggning och miljöer.

## Vilka händelser som plockas upp

Leasing-tjänsten läser `cmlog`-rader som börjar med `Hyreskontrakt ` och klassificerar varje rad utifrån vilket fält som ändrats från tomt till ett datum:

| `logmemo`-fält som satts | Action      | Vad som händer i Tenfast                     |
| ------------------------ | ----------- | -------------------------------------------- |
| `Undertecknat`           | `create`    | Avtalet importeras (med hyresgäst och hyror) |
| `Uppsagt datum`          | `terminate` | Avtalet sägs upp per XPands `lastDebitDate`  |
| `Makulerat datum`        | `void`      | Avtalet makuleras                            |

Rader som inte matchar något av mönstren ignoreras, liksom rader som inte gäller `Bostadskontrakt`, `Lokalkontrakt` eller `Garagekontrakt`. `leaseId` och kontaktkod plockas ur radens första rad, och `rentalObjectId` härleds genom att klippa bort `/XX`-suffixet från `leaseId`.

**Makulerade avtal byter namn i XPand.** Kontraktsnumret får ett M-suffix i samma ändring, så numret i memots första rad är det nya — medan Tenfast känner avtalet under det gamla. Därför läses det ursprungliga numret ut ur rename-raden (`Värdet i fältet 'Kontraktsnummer' ändrat från … till …`) och används i stället. En Makulerat-rad utan rename-rad går inte att koppla till rätt avtal och hoppas över med en varning.

Händelser slås **inte** ihop per avtal. Alla spelas upp i kronologisk ordning, så att ett avtal som både tecknats och sagts upp inom samma synkfönster hamnar rätt i Tenfast.

## Vilka objekt som är i scope

Innan något skickas till Tenfast hämtar core objektinformation från XPand via Property Management och filtrerar:

- **Lägenhet** — synkas.
- **Lokal** vars underliggande objekt är av typen **Förråd** — synkas.
- Allt annat — hoppas över. Raden loggas och räknas som lyckad, checkpointen flyttas fram.

Filtret är alltså snävare än vad `cmlog`-parsningen släpper igenom: garage- och lokalkontrakt plockas upp ur loggen men faller bort här.

Går objektinformationen inte att hämta räknas raden däremot som ett **fel** och hamnar i felkön — skillnaden mot "utanför scope" är avsiktlig.

## Relaterade kontakter

Vid `create` hämtas hyresgästen via `GET /contacts/{contactCode}`, som till skillnad från synk-endpointen [alltid tar med `relatedContacts`](../DOCS_Sync_Overview.md#relaterade-kontakter). Scriptet har alltså god man, förvaltare och annan fakturamottagare tillgängliga här — men agerar bara på en av dem.

| Roll                              | Vad synken gör med den                                    |
| --------------------------------- | --------------------------------------------------------- |
| `otherInvoiceRecipient`           | Skapas/uppdateras som kund i Xledger innan avtalet skapas |
| `trustee` (god man)               | Läses men används inte                                    |
| `administrator` (förvaltare)      | Läses men används inte                                    |
| `*For`-rollerna (omvänd riktning) | Läses men används inte                                    |

God man och förvaltare hamnar ändå i Tenfast, men via en annan väg: när avtalet skapas importeras hyresgästen med `import-contact`, och Tenfast hämtar då kontaktuppgifterna inklusive relationer från OneCore på egen hand. Synken skickar dem aldrig explicit.

### Annan fakturamottagare

Finns en `otherInvoiceRecipient` hämtas hela den kontakten separat — den slimmade relationsposten saknar adressuppgifterna Xledger behöver — och synkas dit med `create=true`. Mottagaren ska finnas som kund i Xledger innan avtalet börjar aviseras, även om hen aldrig varit hyresgäst. Misslyckas det avbryts hela avtalssynken och raden köas.

Det här är den enda platsen i XPand-synken där en kund faktiskt _skapas_ i Xledger; [sync-contacts](../sync-contacts/DOCS_Sync_Contacts.md) kör medvetet med `create=false`.

## Vad Tenfast gör per action

### create

1. Hyresgästen slås upp i Tenfast på kontaktkod. Saknas den importeras den från OneCore (`import-contact`).
2. Hyresobjektet slås upp på objektkod — hittas det inte avbryts importen.
3. Avtalet skapas med `method: "import"` och `signed: true`, med XPands `leaseId` som `externalId` (det är den nyckel `terminate` och `void` senare slår upp på), startdatum från XPands `leaseStartDate`, och hyresrader kopierade från hyresobjektet.
4. Det signerade kontraktet hämtas som PDF ur XPands dokumenttabeller och bifogas avtalet. **Detta steg är best-effort** — saknad eller misslyckad PDF loggas som varning men fäller inte synken, eftersom avtalet redan finns i Tenfast.

Saknar avtalet `leaseStartDate` i XPand, eller finns det inte alls där, returnerar Leasing 400 respektive 404 och raden hamnar i felkön.

### terminate

Slutdatumet hämtas från XPands `lastDebitDate` (saknas det blir det 400). Avtalet slås upp i Tenfast på `externalId` och sägs upp med `reason: "Synced from xpand"`, utan avisering till hyresgästen och markerat som redan hanterat.

### void

Avtalet slås upp på `externalId` och makuleras med `reason: "Synced from xpand"`.

För både `terminate` och `void` gäller att ett avtal som inte finns i Tenfast ger `skipped`, inte fel — typiskt ett avtal som aldrig kom in i Tenfast för att det låg utanför scope. Tenfast kan också svara att avtalet inte _kan_ sägas upp, vilket likaså behandlas som `skipped`.

## Flödesdiagram

Processens beslutslogik. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det. Den gemensamma kö- och checkpointhanteringen finns i [processöversiktens flödesdiagram](../DOCS_Sync_Overview.md#gemensamt-flödesdiagram).

```mermaid
flowchart LR
A[Start: CronJob sync-leases<br/>every minute] --> B(Drain Failure Queue —<br/>retry each queued lease change)
B --> C(Read Checkpoint<br/>/data/last-timestamp-leases.txt)
C --> D(Get Lease Changes<br/>since Checkpoint)
D --> Dq{Fetch OK?}
Dq --> |No| Z[Throw, exit non-zero]
Dq --> |Yes| E[For Each Change:<br/>Get Rental Object Info]
E --> Eq{Info Found?}
Eq --> |No| Q[Queue for Retry,<br/>Send Failure Mail]
Eq --> |Yes| F{Residence or<br/>Storage?}
F --> |No| S[Skip — out of scope,<br/>counted as succeeded]
F --> |Yes| G{Action}
G --> |create| H(Get Tenant from Contacts,<br/>including Related Contacts)
H --> Hq{Related Contact with role<br/>otherInvoiceRecipient?}
Hq --> |Yes| I(Get Full Recipient Contact,<br/>Create/Update it in Xledger)
Hq --> |No| J
I --> J(Import Lease into Tenfast<br/>+ attach signed PDF, best-effort)
G --> |terminate| K(Terminate Lease in Tenfast<br/>per XPand lastDebitDate)
G --> |void| L(Void Lease in Tenfast)
J --> M{Synced?}
K --> M
L --> M
M --> |No| Q
M --> |Yes| N[Count as Succeeded]
Q --> O[Advance Checkpoint]
S --> O
N --> O
O --> P[End]
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Detta är ett fristående script i core-paketet, inte en HTTP-endpoint — det körs utanför Koa-servern, som ett eget engångs-Kubernetes-Job skapat av CronJobbet, utan mänsklig initierare. Kö-tömningen i början av körningen är utelämnad; den kör exakt samma anropskedja som visas här.

```mermaid
sequenceDiagram
    participant CronJob as CronJob sync-leases<br/>(mimer-onecore-operations)
    participant Core as Core (script)
    participant PVC as PVC /data
    participant Leasing as Leasing
    participant XPandDB as XPand Database
    participant PropMgmt as Property Management
    participant Contacts as Contacts
    participant Economy as Economy
    participant Xledger as Xledger
    participant Tenfast as Tenfast
    participant Communication as Communication

    CronJob ->> Core: Run Sync Leases<br/>(npm run script:sync-leases)

    Core ->> PVC: Read last-timestamp-leases.txt
    PVC -->> Core: Checkpoint (or none — sync everything)

    Core ->> Leasing: Get Lease Changes since Checkpoint
    Leasing ->> XPandDB: Query cmlog for "Hyreskontrakt %" rows
    XPandDB -->> Leasing: Changed rows
    note over Leasing: Each row classified as create / terminate / void.<br/>Void rows use the pre-makulering contract number<br/>parsed from the Kontraktsnummer rename line.<br/>Events are NOT collapsed per lease — they replay<br/>in order so Tenfast converges on XPand's state.
    Leasing -->> Core: Lease changes with timestamps

    break when fetching from Leasing fails
        Core-->CronJob: throw, script exits non-zero
    end

    loop For each lease change
        Core ->> PropMgmt: Get Rental Property Info
        PropMgmt ->> XPandDB: Get Rental Property Info
        XPandDB -->> PropMgmt: Rental Property Info
        PropMgmt -->> Core: Rental Property Info

        alt Not a Residence or Storage
            note over Core: Out of scope — skipped,<br/>checkpoint still advances
        else In scope
            opt Action is create
                Core ->> Contacts: Get Contact by Contact Code
                Contacts -->> Core: Contact with related contacts
                note over Core: This endpoint always includes relatedContacts —<br/>trustee (god man), administrator (förvaltare) and<br/>otherInvoiceRecipient. Only the last one is acted<br/>on. The guardian roles reach Tenfast via import-contact.

                opt Contact has an Other Invoice Recipient
                    Core ->> Contacts: Get Full Recipient Contact<br/>(relation row lacks addresses)
                    Contacts -->> Core: Contact
                    Core ->> Economy: Sync Customer (create=true)
                    Economy ->> Xledger: Create or Update Customer
                    Xledger -->> Economy: Customer
                    Economy -->> Core: OK
                end
            end

            Core ->> Leasing: Sync Lease (leaseId, action,<br/>contactCode only on create)

            alt Action is create
                Leasing ->> XPandDB: Get Lease (for leaseStartDate)
                XPandDB -->> Leasing: Lease
                Leasing ->> Tenfast: Get Tenant by Contact Code
                Tenfast -->> Leasing: Tenant (or none)
                opt Tenant not in Tenfast
                    Leasing ->> Tenfast: Import Contact from ONECore
                    note over Tenfast: Tenfast pulls the contact itself, relations<br/>(god man / förvaltare) included — the sync<br/>never sends them explicitly.
                    Tenfast -->> Leasing: Tenant
                end
                Leasing ->> Tenfast: Get Rental Object by Code
                Tenfast -->> Leasing: Rental Object with rent rows
                Leasing ->> Tenfast: Create Lease<br/>(externalId = XPand leaseId,<br/>method import, signed)
                Tenfast -->> Leasing: Lease
                Leasing ->> XPandDB: Get Signed Contract PDF
                XPandDB -->> Leasing: PDF (or none)
                opt PDF found
                    Leasing ->> Tenfast: Upload Lease File
                    Tenfast -->> Leasing: Uploaded
                end
                note over Leasing: PDF attachment is best-effort —<br/>a missing or failed upload is logged<br/>but does not fail the create.
            else Action is terminate
                Leasing ->> XPandDB: Get Lease (for lastDebitDate)
                XPandDB -->> Leasing: Lease
                Leasing ->> Tenfast: Get Lease by externalId
                Tenfast -->> Leasing: Lease (or not found → skipped)
                Leasing ->> Tenfast: Terminate Lease<br/>(reason "Synced from xpand")
                Tenfast -->> Leasing: Terminated (or cannot terminate → skipped)
            else Action is void
                Leasing ->> Tenfast: Get Lease by externalId
                Tenfast -->> Leasing: Lease (or not found → skipped)
                Leasing ->> Tenfast: Void Lease<br/>(reason "Synced from xpand")
                Tenfast -->> Leasing: Voided
            end

            Leasing -->> Core: created / terminated / voided / skipped
        end

        alt Any step failed
            Core ->> PVC: Append lease change to failed-rows.jsonl
            Core ->> Communication: Send Failure Mail<br/>(only if not already queued)
            Communication -->> Core: Sent
        end

        Core ->> PVC: Write Checkpoint (change's logtime)
    end

    Core -->> CronJob: Done
```
