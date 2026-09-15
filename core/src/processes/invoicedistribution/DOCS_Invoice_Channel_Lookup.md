# Hämta Aviseringskanal (Strålfors Channel Lookup)

_Del av [processöversikten](./DOCS_Overview.md) för fakturadistribution._

När en handläggare öppnar en hyresgästs betalningsflik i property-tree hämtas "Alternativ för avisering" — en uppgift om hyresgästen kan nås digitalt (Kivra eller e-faktura) eller om det blir pappersfaktura. Uppgiften kommer från Strålfors, som är Mimers leverantör för fakturadistribution och känner till vilka digitala kanaler en mottagare faktiskt är ansluten till. Autogiro kollas separat och går alltid först i UI:t om det finns, oavsett vad kanalslagningen svarar.

## Flödesdiagram

Vilket värde som visas för "Alternativ för avisering", i property-tree UI:t. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start: Kundkort ->
Betalningsflik öppnas] --> B{Har Autogiro-<br/>medgivande?}
B --> |Yes| C[Visa: Autogiro]
B --> |No| D(Hämta Aviseringskanal<br/>från Strålfors)
D --> E{Första kandidatens<br/>availableInChannels<br/>innehåller Kivra eller<br/>e-faktura?}
E --> |Yes| F[Visa: Kivra eller E-faktura]
E --> |No| G[Visa: Pappersfaktura]
C --> O[End]
F --> O
G --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning.

```mermaid
sequenceDiagram
    actor Handläggare as Handläggare
    participant PropertyTree as property-tree
    participant Core as Core
    participant Economy as Economy
    participant Stralfors as Strålfors

    Handläggare ->> PropertyTree: Öppna kundkortets betalningsflik
    PropertyTree ->> Core: POST /invoice-channels<br/>(recipientId, recipientType)
    Core ->> Economy: POST /invoice-channels
    Economy ->> Stralfors: POST /v1/oidc/authorization<br/>(client_credentials, cachead token)
    Stralfors -->> Economy: access_token

    Economy ->> Stralfors: POST /rest/outputmanagement/<br/>channellookup/v1/extendedlookup<br/>(candidates: kivraRecipient,<br/>einvoiceB2C/B2BRecipient per mottagare)
    note over Economy: referenceId får en suffix (____individual /<br/>____organization) innan anropet, eftersom<br/>Strålfors inte accepterar samma referenceId<br/>två gånger — t.ex. samma personnummer som<br/>både privatperson och enskild firma.
    Stralfors -->> Economy: correlationId

    loop Poll tills svar finns, max config.stralfors.maxRetries (10)
        Economy ->> Stralfors: GET .../extendedlookup/{correlationId}
        Stralfors -->> Economy: 202 (ej klart) eller resultat
    end

    break when inget svar efter max antal försök
        Economy-->Core: 500 (kastar fel)
        Core-->PropertyTree: 500
    end

    note over Economy: Vid 401 hämtas ny access_token en gång<br/>och anropet görs om — misslyckas det igen<br/>kastas felet.

    Economy ->> Economy: Ta bort referenceId-suffix från svaret
    Economy -->> Core: candidates: availableInChannels,<br/>notAvailableInChannels per mottagare
    Core ->> Core: Validera svar mot<br/>ChannelLookupResponseSchema
    Core -->> PropertyTree: 200

    PropertyTree ->> PropertyTree: Första kanalen i<br/>availableInChannels som är<br/>Kivra/eInvoiceB2C/eInvoiceB2B<br/>avgör visad etikett
    PropertyTree -->> Handläggare: Visa "Alternativ för avisering"

```

## Att känna till

- Vilken kanal som visas när flera är tillgängliga styrs av **ordningen Strålfors returnerar dem i**, inte av en prioritering i OneCores kod — `property-tree` väljer bara den första posten i `availableInChannels` som matchar en känd etikett (`eInvoiceB2C`/`eInvoiceB2B` → "E-faktura", `Kivra` → "Kivra").
- Det här är ett rent uppslag — det skickar ingen faktura och påverkar inte vilken kanal Strålfors faktiskt använder när en fil väl skickas (se [Överför Filer till Strålfors](./DOCS_Transfer_Files_to_Stralfors.md)).
- `recipientId` skickas in som personnummer/organisationsnummer från UI:t; Economy strippar bort allt utom siffror innan det skickas vidare till Strålfors.
