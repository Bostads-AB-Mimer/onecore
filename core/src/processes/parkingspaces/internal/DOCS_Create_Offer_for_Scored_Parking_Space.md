# Skapa Erbjudande för Poängsatt Bilplats

_Del av [processöversikten](./DOCS_Overview.md) för poängsatta bilplatser._

Ett erbjudande om en poängsatt bilplats skapas till nästa berättigade sökande i kön, för en annons vars visningsperiod gått ut — sökande som anmält intresse via [Create Note of Interest](./DOCS_Create_Note_of_Interest_for_Scored_Parking_Space.md). Processen kan initieras på fyra sätt:

- Manuellt av en handläggare via Uthyrningsgränssnittet
- Automatiskt av det schemalagda jobbet `start-offer-batches`, som hittar annonser vars visningsperiod precis gått ut och som ännu saknar erbjudande
- Automatiskt av [Expire Offer](./DOCS_Expire_Offer.md)-processen (`handle-expired-offers`), efter att ett obesvarat erbjudande gått ut
- Internt av [Deny Offer](./DOCS_Deny_Offer.md)-processen, när ett tidigare erbjudande på samma annons nekas

Oavsett hur den startar går processen igenom kölistan i prioritetsordning och diskvalificerar sökande som inte uppfyller områdes- eller fastighetsspecifika uthyrningsregler, tills en berättigad sökande hittas. Den sökanden får ett erbjudande via e-post, som kan [accepteras](./DOCS_Accept_Offer.md) eller [nekas](./DOCS_Deny_Offer.md). Hittas ingen berättigad sökande stängs annonsen.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare till nästa steg, och vad som händer vid godkännande, nekande eller fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start] --> B(Get Listing)
B --> R(Get Rental Object)
R --> C{Is Listing Expired<br/>and Rental Object Vacant?}
C --> |No| O[End]
C --> |Yes| D[Get Detailed Applicants]
D --> Lp[Find First Eligible Applicant,<br/>Disqualifying Ineligible Ones]
Lp --> F{Eligible Applicant Found?}
F --> |No| Cl[Close Listing]
Cl --> O
F --> |Yes| Gc[Get Contact]
Gc --> Gco{Contact Found?}
Gco --> |No| O
Gco --> |Yes| H[Create Offer and<br/>Update Winning Applicant Status]
H --> Ho{Offer Created?}
Ho --> |No| O
Ho --> |Yes| N[Send Offer Email to Applicant]
N --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning, och var processen kan avbrytas vid en misslyckad kontroll. Täcker alla fyra ingångarna (handläggarinitierat via Uthyrningsgränssnittet, de två schemalagda jobben, och internt anrop från [Deny Offer](./DOCS_Deny_Offer.md)-processen), och visar att mikrotjänsten Leasing samt de externa systemen XPand och Tenfast är inblandade.

```mermaid
sequenceDiagram
    actor LeasingTeam as Leasing Team
    actor Applicant as Applicant
    participant ScheduledJob as Scheduled Job
    participant Core as Core
    participant Leasing as Leasing
    participant Communication as Communication
    participant OneCoreDB as OneCore Database
    participant XPandDB as XPand Database
    participant Tenfast as Tenfast

    alt Skapas manuellt av handläggare via Uthyrningsgränssnittet
        LeasingTeam ->> Core: Create Offer (for one listing)
    else start-offer-batches hittar en annons redo för erbjudande
        ScheduledJob ->> Core: Create Offer (for one listing)
        note over Core: No HTTP response path — the scheduled<br/>job only logs the outcome (see script).
    else Ett obesvarat erbjudande gått ut (Expire Offer)
        note over Core: Called in-process by the Expire Offer<br/>process, once per affected listing —<br/>not a separate HTTP entry point.
    else Ett tidigare erbjudande på samma annons nekas
        note over Core: Called in-process by the Deny Offer<br/>process (reply-to-offer.ts) — not a<br/>separate HTTP entry point.
    end
    note over Core: Same process regardless of caller.<br/>Only the manual route surfaces a response to a<br/>human — the other three only log the outcome.

    Core ->> Leasing: Get Listing
    Leasing ->> OneCoreDB: Get Listing
    OneCoreDB -->> Leasing: Listing
    Leasing -->> Core: Listing

    Core ->> Leasing: Get Rental Object
    Leasing ->> XPandDB: Get Parking Space
    XPandDB -->> Leasing: Parking Space
    Leasing ->> Tenfast: Get Availability
    Tenfast -->> Leasing: Availability
    Leasing -->> Core: Rental Object

    break when Listing is not Expired, or Rental Object has no Vacant-From Date
        Core-->LeasingTeam: show error message
    end

    Core ->> Leasing: Get Detailed Applicants
    Leasing ->> OneCoreDB: Get Listing and Applicants
    OneCoreDB -->> Leasing: Applicants
    Leasing ->> XPandDB: Get Contact, Queue Points,<br/>Residential Area and Estate Codes<br/>per Applicant
    XPandDB -->> Leasing: Applicant Data
    Leasing ->> Tenfast: Get Leases per Applicant
    Tenfast -->> Leasing: Leases
    Leasing -->> Core: Detailed Applicants

    break when fetching Detailed Applicants fails
        Core-->LeasingTeam: show error message
    end

    loop for each Active Applicant with a Priority, in order
        Core ->> Leasing: Validate Residential Area<br/>and Property Rental Rules
        Leasing ->> XPandDB: Get Contact, Residential Area<br/>and Estate Codes
        XPandDB -->> Leasing: Residential Area Data
        Leasing ->> Tenfast: Get Tenant and Leases
        Tenfast -->> Leasing: Tenant and Leases
        Leasing -->> Core: Validation Result

        break when Validation Passed
            note over Core: This applicant is eligible — stop looping.
        end

        Core ->> Leasing: Disqualify Applicant
        Leasing ->> OneCoreDB: Set Applicant Status to Disqualified
    end

    alt No Eligible Applicant Found
        Core ->> Leasing: Close Listing
        Leasing ->> OneCoreDB: Update Listing Status to Closed
        OneCoreDB -->> Leasing: Updated

        break when Closing the Listing fails
            Core-->LeasingTeam: show error message (listing status<br/>could not be updated)
        end

        Core-->LeasingTeam: show error message (no eligible applicant found)
    else Eligible Applicant Found
        Core ->> Leasing: Get Contact
        Leasing ->> XPandDB: Get Contact
        XPandDB -->> Leasing: Contact
        Leasing -->> Core: Contact

        break when Contact not found
            Core-->LeasingTeam: show error message
        end

        Core ->> Leasing: Create Offer
        Leasing ->> OneCoreDB: Create Offer, and set<br/>Winning Applicant Status to Offered
        OneCoreDB -->> Leasing: Offer Created
        Leasing -->> Core: Offer

        break when Offer could not be created
            Core-->LeasingTeam: show error message
        end

        alt Contact has an Email Address
            Core ->> Communication: Send Offer Email
            Communication ->> Applicant: Offer Email
            Communication -->> Core: Result
            note over Core: Best-effort — a failed send is<br/>logged only, not a process failure.
        end

        Core -->> LeasingTeam: Offer Created
    end

```
