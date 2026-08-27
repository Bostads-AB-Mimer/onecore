# Synka Kontakter från XPand

_Del av [processöversikten](../DOCS_Sync_Overview.md) för XPand-synk. Där beskrivs den gemensamma mekaniken — checkpoint, felkö, notifieringar och schemaläggning — som inte upprepas här._

Ett fristående script (`core/src/scripts/sync-contacts/index.ts`) hämtar de kontakter som ändrats i XPand sedan förra körningen och skriver dem vidare till de tre system som håller egna kopior av kontaktdata: **Tenfast** (hyresgäster), **Xledger** (kunder) och **Odoo** (hyresgäster i ärendehanteringen). XPand är källan; de tre målen uppdateras, aldrig tvärtom.

Scriptet körs som Kubernetes CronJobbet `sync-contacts` varje minut. Se [processöversikten](../DOCS_Sync_Overview.md#schemaläggning) för schemaläggning och miljöer.

## Vad som synkas

Contacts-tjänsten returnerar hela `Contact`-objektet. Core plattar ut det till en synkpayload (`payload.ts`) och skickar sedan olika delmängder till olika mål:

| Fält                      | Tenfast | Xledger | Odoo |
| ------------------------- | :-----: | :-----: | :--: |
| `fullName`                |    –    |    ✓    |  ✓   |
| `emailAddress` (primär)   |    –    |    ✓    |  ✓   |
| `phoneNumber` (primär)    |    –    |    –    |  ✓   |
| `street`/`zipCode`/`city` |    –    |    ✓    |  –   |

Tenfast-kolumnen är tom med flit: dit skickas **bara kontaktkoden**. Tenfast hämtar sedan själv färska kontaktuppgifter från OneCore och uppdaterar hyresgästen samt alla relationer som pekar på samma `externalId`. Övriga två får payloaden skickad till sig.

`fullName` är personens `fullName` för privatpersoner och organisationens `name` för företag. E-post och telefon väljs som den post som är markerad `isPrimary`, annars den första i listan. Adressen tas från `addresses[0]`.

## Målsystemens beteende när kontakten är okänd

De tre målen svarar olika på en kontakt de inte känner igen, men gemensamt är att ingen av dem skapar något nytt i det här flödet:

- **Tenfast** — svarar 404, vilket tolkas som `skipped` och räknas som lyckat.
- **Xledger** — anropas medvetet med `create=false`. Saknas kunden returneras `null` (`skipped`). En kontakt som är helt ny i XPand når alltså aldrig Xledger via det här scriptet; den skapas först när den behövs, t.ex. som annan fakturamottagare i [sync-leases](../sync-leases/DOCS_Sync_Leases.md).
- **Odoo** — söker upp `maintenance.tenant` på `contact_code`. Hittas ingen loggas det och raden räknas som lyckad. Hittas flera uppdateras samtliga.

## Felhantering

De tre anropen görs parallellt (`Promise.all`) och **alla tre måste lyckas** för att raden ska räknas som synkad. Misslyckas något av dem hamnar hela raden i felkön med ett felmeddelande som anger status per mål (`tenfast=… xledger=… odoo=…`).

Det innebär att ett återförsök kör om alla tre, även de som redan lyckats. Det är ofarligt eftersom samtliga tre operationer är rena uppdateringar av befintlig data och därmed idempotenta.

## Flödesdiagram

Processens beslutslogik. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det. Den gemensamma kö- och checkpointhanteringen finns i [processöversiktens flödesdiagram](../DOCS_Sync_Overview.md#gemensamt-flödesdiagram).

```mermaid
flowchart LR
A[Start: CronJob sync-contacts<br/>every minute] --> B(Drain Failure Queue —<br/>retry each queued contact)
B --> C(Read Checkpoint<br/>/data/last-timestamp.txt)
C --> D(Get Contacts Changed<br/>since Checkpoint)
D --> Dq{Fetch OK?}
Dq --> |No| Z[Throw, exit non-zero]
Dq --> |Yes| E[For Each Contact:<br/>Build Sync Payload]
E --> F(Sync to Tenfast, Xledger<br/>and Odoo in Parallel)
F --> G{All three OK?}
G --> |No| H[Queue for Retry,<br/>Send Failure Mail]
G --> |Yes| I[Count as Succeeded]
H --> J[Advance Checkpoint]
I --> J
J --> K[End]
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Detta är ett fristående script i core-paketet, inte en HTTP-endpoint — det körs utanför Koa-servern, som ett eget engångs-Kubernetes-Job skapat av CronJobbet, utan mänsklig initierare. Kö-tömningen i början av körningen är utelämnad; den kör exakt samma anropskedja som visas här.

```mermaid
sequenceDiagram
    participant CronJob as CronJob sync-contacts<br/>(mimer-onecore-operations)
    participant Core as Core (script)
    participant PVC as PVC /data
    participant Contacts as Contacts
    participant XPandDB as XPand Database
    participant Leasing as Leasing
    participant Tenfast as Tenfast
    participant Economy as Economy
    participant Xledger as Xledger
    participant WorkOrder as Work Order
    participant Odoo as Odoo
    participant Communication as Communication

    CronJob ->> Core: Run Sync Contacts<br/>(npm run script:sync-contacts)

    Core ->> PVC: Read last-timestamp.txt
    PVC -->> Core: Checkpoint (or none — sync everything)

    Core ->> Contacts: Get Updated Contacts since Checkpoint
    Contacts ->> XPandDB: Query cmlog for "Kontakt %" rows
    XPandDB -->> Contacts: Changed rows
    note over Contacts: Contact codes deduplicated —<br/>latest logtime per code wins
    Contacts ->> XPandDB: Get Contacts by Contact Codes
    XPandDB -->> Contacts: Contacts
    Contacts -->> Core: Contacts with timestamps

    break when fetching from Contacts fails
        Core-->CronJob: throw, script exits non-zero
    end

    loop For each changed contact
        Core ->> Core: Build Sync Payload<br/>(primary email/phone, first address)

        par Sync to Tenfast
            Core ->> Leasing: Sync Contact (contact code only)
            Leasing ->> Tenfast: Sync Tenant by Contact Code
            note over Tenfast: Tenfast pulls fresh contact data<br/>from ONECore itself and updates the<br/>hyresgäst plus every relation<br/>referencing the same externalId.<br/>404 = tenant unknown, treated as skipped.
            Tenfast -->> Leasing: Updated count (or 404)
            Leasing -->> Core: OK / skipped
        and Sync to Xledger
            Core ->> Economy: Sync Customer (create=false)
            Economy ->> Xledger: Get Customer by Contact Code
            Xledger -->> Economy: Customer (or none)
            alt Customer exists
                Economy ->> Xledger: Update Customer
                Xledger -->> Economy: Updated Customer
            else Customer not found
                note over Economy: create=false — returns skipped,<br/>no customer is created here
            end
            Economy -->> Core: OK / skipped
        and Sync to Odoo
            Core ->> WorkOrder: Sync Contact
            WorkOrder ->> Odoo: Search maintenance.tenant<br/>by contact_code
            Odoo -->> WorkOrder: Tenant ids (possibly none)
            loop For each matching tenant
                WorkOrder ->> Odoo: Update name, email, phone
            end
            WorkOrder -->> Core: OK / skipped
        end

        alt Any of the three failed
            Core ->> PVC: Append contact to failed-rows.jsonl
            Core ->> Communication: Send Failure Mail<br/>(only if not already queued)
            Communication -->> Core: Sent
        end

        Core ->> PVC: Write Checkpoint (contact's logtime)
    end

    Core -->> CronJob: Done
```
