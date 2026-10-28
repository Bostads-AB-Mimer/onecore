# Synka Kontakter från Xpand

_Del av [processöversikten](../DOCS_Sync_Overview.md) för Xpand-synk. Där beskrivs det gemensamma — sparad position, felkö, återförsök, notifieringar, schemaläggning och vad som händer om något ligger nere — som inte upprepas här._

Ett fristående script (`core/src/scripts/sync-contacts/index.ts`) hämtar de kontakter som ändrats i Xpand sedan förra körningen och skriver dem vidare till de tre system som håller egna kopior av kontaktuppgifter: **Tenfast** (hyresgäster), **Xledger** (kunder) och **Odoo** (hyresgäster i ärendehanteringen). Xpand är källan; de tre målen uppdateras, aldrig tvärtom.

Scriptet körs som CronJobbet `sync-contacts` varje minut. Vid första körningen, utan sparad position, synkas samtliga kontakter som någonsin loggats i Xpand.

## Vilka ändringar som plockas upp

Contacts-tjänsten (`GET /contacts/sync`) läser `cmlog`-rader som börjar med `Kontakt ` och plockar ut kontaktkoden ur första ordet efter. Har samma kontakt ändrats flera gånger sedan förra körningen blir det en enda synk, med den senaste tidsstämpeln — hela kontakten hämtas färskt ändå. Kontaktuppgifterna läses därefter ur Xpand, i en enda fråga för alla ändrade koder. En kontaktkod som inte längre finns i Xpand faller bort tyst. Det kan även en befintlig kontakt göra: frågan begränsas till lika många kontaktrader som koder, så om en kod har två rader i Xpands kontakttabell trängs en annan ändrad kontakt ut — utan logg och utan mejl. Om sådana dubbletter finns i Xpand i dag är inte kontrollerat.

## Vad som synkas

Core plattar ut kontakten till en synkpayload (`payload.ts`) och skickar olika delar till olika mål:

| Fält                        | Tenfast | Xledger | Odoo |
| --------------------------- | :-----: | :-----: | :--: |
| Namn                        |    –    |    ✓    |  ✓   |
| E-post                      |    –    |    ✓    |  ✓   |
| Telefon                     |    –    |    –    |  ✓   |
| Gatuadress, postnummer, ort |    –    |    ✓    |  –   |

- **Namn** är personens fullständiga namn för privatpersoner och organisationens namn för företag.
- **E-post och telefon** är den post som är markerad som primär, annars den första i listan.
- **Adress** är kontaktens första adress.

Två undantag ändrar vad som skickas:

- **Skyddad identitet.** För en kontakt med skyddade personuppgifter (lagsökt) visar Contacts de riktiga uppgifterna om kontakten är hyresgäst på ett avtal som gäller, ska börja gälla eller slutade för högst 60 dagar sedan, eller är annan fakturamottagare på en aktiv relation. Uppgifterna i Xpand är redan fingerade för dem, och synken skickar dem vidare som för alla andra. Övriga kontakter med skyddad identitet får namnet `redacted` och ingen adress, e-post eller telefon, i alla miljöer. Synken skriver det vidare: kunden i Xledger får namnet `redacted` och tom adress och e-post, och hyresgästen i Odoo får namnet `redacted` (e-post och telefon lämnas som de var). Det rör i praktiken bara tidigare hyresgäster som flyttade för mer än 60 dagar sedan, och har bedömts inte vara värt att åtgärda ([AVTAL-361](https://linear.app/mimer-onecore/issue/AVTAL-361)).
- **Testmiljöer.** Utanför produktion (`NODE_ENV` är inte `production`) ersätter Contacts all e-post och alla telefonnummer med `redacted`. I `epic-avtal-49`, där jobbet körs, skriver synken därför `redacted` som e-post i Xledger och Odoo och som telefon i Odoo. Det är inget fel i synken.

Tenfast-kolumnen är tom med flit: dit skickas **bara kontaktkoden**. Tenfast hämtar själv färska kontaktuppgifter från ONECore och uppdaterar hyresgästen, och alla relationer som pekar på samma kontakt.

## Vad varje målsystem gör

Ingen av de tre skapar något nytt i det här flödet — de uppdaterar bara det som redan finns.

- **Tenfast** — en kontakt som inte finns som hyresgäst ger 404, vilket räknas som lyckat (hoppas över).
- **Xledger** — kunden slås upp på kontaktkod. Finns den uppdateras namn, gatuadress, postnummer, ort och e-post. Saknas den händer ingenting: scriptet skapar medvetet inga kunder. En helt ny kontakt når Xledger först när den behövs, som annan fakturamottagare på ett nytt avtal i [sync-leases](../sync-leases/DOCS_Sync_Leases.md#annan-fakturamottagare) eller när en relation läggs till på kundkortet. En tom adress eller e-post skrivs som tom i Xledger — även när den bara saknas för att Contacts döljer en skyddad identitet (se ovan). Uppdateringen görs varje gång, även om inget har ändrats.
- **Odoo** — `maintenance.tenant` söks upp på `contact_code`. Hittas ingen räknas raden som lyckad. Hittas flera uppdateras alla. Namnet skrivs alltid; e-post och telefon bara om kontakten har en sådan.

## Relationer

**Scriptet läser och skickar inga relationer** — god man, förvaltare och annan fakturamottagare. Synk-endpointen tar inte med dem, och synkpayloaden har inga fält för dem.

En god man eller fakturamottagare synkas ändå som sig själv: hen är en egen kontakt med egen kontaktkod, och när hens uppgifter ändras i Xpand skrivs en egen `Kontakt`-rad i `cmlog`. Det som _inte_ händer är någon spridning: scriptet tittar inte på vems god man hen är. För Tenfast behövs det inte, eftersom Tenfast själv uppdaterar alla relationer som pekar på samma kontakt. Xledger och Odoo har ingen relationsmodell att uppdatera.

Relationerna själva hanteras utanför den här synken:

- **Relationer läses från Contacts-tjänstens egen databas**, inte från Xpand. En relation som ändras i Xpand når därför inte Tenfast via ONECore.
- **Relationer som ändras på kundkortet i ONECore** förs vidare direkt av Core när handläggaren sparar (`core/src/processes/contacts/relation-changes.ts`): en ny annan fakturamottagare skapas som kund i Xledger, och huvudmannens hyresgäst i Tenfast synkas om. Det sker inom samma anrop, utan kö — misslyckas Tenfast rullas ändringen tillbaka.

## Felhantering

De tre anropen görs parallellt och **alla tre måste lyckas** för att raden ska räknas som synkad. Misslyckas något hamnar hela raden i felkön, med status per mål i felmeddelandet (`tenfast=… xledger=… odoo=…`).

Det gäller även när Economy avvisar kunden med ett 4xx-svar, t.ex. för att kontakten saknar namn i Xpand. Ett återförsök lyckas först när uppgiften rättats i Xpand; rättelsen skriver en ny `cmlog`-rad som ersätter den köade.

Ett återförsök kör om alla tre, även de som redan lyckats. Det är ofarligt eftersom alla tre bara uppdaterar befintlig data.

Kommer en nyare ändring för samma kontakt medan en äldre ligger i kön stryks den äldre — se [processöversikten](../DOCS_Sync_Overview.md#felkö-och-återförsök). Ger synken upp efter 30 dagar är rådet i mejlet att göra ändringen i Xpand på nytt.

## Flödesdiagram

Processens beslutslogik för en kontakt. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det. Kö och sparad position finns i [processöversiktens flödesdiagram](../DOCS_Sync_Overview.md#gemensamt-flödesdiagram).

```mermaid
flowchart LR
A[Start: Changed Contact<br/>from cmlog] --> B[Build Sync Payload]
B --> C(Sync to Tenfast, Xledger<br/>and Odoo in Parallel)
C --> T{Tenfast:<br/>Tenant Exists?}
T --> |No| Ts[Skipped]
T --> |Yes| Tu[Tenfast Pulls Fresh Data<br/>from ONECore]
C --> X{Xledger:<br/>Customer Exists?}
X --> |No| Xs[Skipped,<br/>Nothing Created]
X --> |Yes| Xu[Update Customer]
C --> O{Odoo:<br/>Tenants Found?}
O --> |No| Os[Skipped]
O --> |Yes| Ou[Update Every Match]
Ts --> G{All Three OK?}
Tu --> G
Xs --> G
Xu --> G
Os --> G
Ou --> G
G --> |No| H[Queue for Retry,<br/>Send Failure Mail]
G --> |Yes| I[Count as Synced]
H --> Z[End]
I --> Z
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Det här är ett fristående, schemalagt script — inte en HTTP-endpoint initierad av en människa. Kön gås igenom med samma anropskedja och är utelämnad här.

```mermaid
sequenceDiagram
    participant CronJob as CronJob sync-contacts<br/>(mimer-onecore-operations)
    participant Core as Core (script)
    participant PVC as PVC /data
    participant Contacts as Contacts
    participant Xpand as Xpand
    participant Leasing as Leasing
    participant Tenfast as Tenfast
    participant Economy as Economy
    participant Xledger as Xledger
    participant WorkOrder as Work Order
    participant Odoo as Odoo
    participant Communication as Communication

    CronJob ->> Core: Run (npm run script:sync-contacts)
    Core ->> PVC: Read last-timestamp.txt
    PVC -->> Core: Saved position (or none — sync everything)

    Core ->> Contacts: GET /contacts/sync?since={position}
    Contacts ->> Xpand: cmlog rows starting "Kontakt "
    Xpand -->> Contacts: Rows
    note over Contacts: One entry per contact code —<br/>latest logtime wins
    Contacts ->> Xpand: Contacts by code
    Xpand -->> Contacts: Contacts (no relations)
    Contacts -->> Core: Contacts with timestamps

    break when the fetch fails
        Core-->CronJob: throw, run fails, position unchanged
    end

    loop For each changed contact
        Core ->> Core: Build sync payload

        par Tenfast
            Core ->> Leasing: POST /contacts/{code}/sync
            Leasing ->> Tenfast: POST /v1/hyresvard/extras/contacts/{code}
            note over Tenfast: Tenfast pulls the contact from ONECore<br/>and updates the hyresgäst and every<br/>relation pointing to it. 404 = skipped.
            Tenfast -->> Leasing: Updated count (or 404)
            Leasing -->> Core: OK / skipped
        and Xledger
            Core ->> Economy: POST /customers/{code}/sync (no create)
            Economy ->> Xledger: Find customer by code
            Xledger -->> Economy: Customer (or none)
            opt Customer exists
                Economy ->> Xledger: Update name, address, email
            end
            Economy -->> Core: OK / skipped
        and Odoo
            Core ->> WorkOrder: POST /contacts/{code}/sync
            WorkOrder ->> Odoo: Search maintenance.tenant by contact_code
            Odoo -->> WorkOrder: Tenant ids (possibly none)
            loop For each match
                WorkOrder ->> Odoo: Write name, email, phone
            end
            WorkOrder -->> Core: OK / skipped
        end

        opt Any of the three failed
            Core ->> PVC: Append to failed-rows.jsonl
            Core ->> Communication: Failure mail
        end

        Core ->> PVC: Save position once the second is done
    end

    Core -->> CronJob: Done
```

## Att känna till

- **Bara befintliga poster uppdateras.** En kontakt som är ny i Xpand dyker inte upp i Tenfast, Xledger eller Odoo genom den här synken. Den kommer in den väg där den först behövs — t.ex. när ett avtal skapas.
- **Telefon går bara till Odoo**, och adressen bara till Xledger.
- **Högst cirka 2 000 ändrade kontakter per körning.** Contacts hämtar alla ändrade kontakter i en enda SQL-fråga med en parameter per kontaktkod, och SQL Server tillåter högst 2 100 parametrar. Har fler kontakter ändrats sedan sparad position svarar Contacts med fel, körningen avbryts utan att flytta positionen, och nästa körning försöker med samma — och fler — kontakter. Synken kommer då aldrig ifatt, utan mejl. Det gäller första körningen (hela historiken i testmiljön omfattar långt fler) och varje avbrott som är långt nog.
- **Inga relationer, ingen ny kund.** Se [Relationer](#relationer) och [Vad varje målsystem gör](#vad-varje-målsystem-gör).
