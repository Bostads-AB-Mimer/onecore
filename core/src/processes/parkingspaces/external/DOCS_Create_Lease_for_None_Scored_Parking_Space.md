# Skapa Kontrakt för Icke-poängsatt Bilplats

En sökande ansöker om en icke-poängsatt bilplats (först till kvarn), antingen direkt via Mina Sidor eller å sökandens vägnar av en handläggare via Uthyrningsgränssnittet. Processen validerar annons och sökande, gör en automatisk kreditkontroll (extern via Creditsafe, eller intern via betalningshistorik om sökanden redan har ett kontrakt) och skapar kontraktet i Tenfast vid godkännande. Sökanden och uthyrningsteamet notifieras om utfallet oavsett utgång.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare till nästa steg, och vad som händer vid godkännande, nekande eller fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start] --> B(Get Listing)
B --> P[Get Rental Object]
P --> C{Is the Listing Non Scored?}
C --> |No| O[End]
C --> |Yes| D[Get Applicant]
D --> Q{Does Applicant have an Address?}
Q --> |No| O
Q --> |Yes| E[Get Applicant's Leases]
E --> F{Does Applicant Have an<br/>Existing or Upcoming Lease?}
F --> |No| L[Perform External Credit Check]
F --> |Yes| H[Perform Internal Credit Check<br/>Debt Collection Invoices]
L --> I{Is Applicant Eligible for Lease?}
H --> I
I --> |No| M[Send Notification to Applicant]
I --> |Yes| T[Determine VAT Rate]
T --> J[Create Lease]
J --> K{Was Lease Created?}
K --> |No| O
K --> |Yes| R[Update Listing Status]
R --> M
M --> N[Send Notification to Leasing Team]
N --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning, och var processen kan avbrytas vid en misslyckad kontroll. Täcker båda ingångarna (sökandens självbetjäning och handläggarinitierat via Uthyrningsgränssnittet), och visar att backend-tjänsterna Leasing och Economy samt de externa systemen XPand, Tenfast, Creditsafe och Xledger alla är inblandade beroende på vilken väg som tas.

```mermaid
sequenceDiagram
    actor LeasingTeam as Leasing Team
    actor User as User
    participant Core as Core
    participant Leasing as Leasing
    participant Economy as Economy
    participant Communication as Communication
    participant OneCoreDB as OneCore Database
    participant XPandDB as XPand Database
    participant Tenfast as Tenfast
    participant Creditsafe as Creditsafe
    participant Xledger as Xledger

    alt Ansökan via Mina Sidor
        User ->> Core: Create Lease
    else Skapas manuellt av handläggare via Uthyrningsgränssnittet
        LeasingTeam ->> Core: Create Lease
    end
    note over Core: Same endpoint regardless of caller.<br/>Responses below go back to whichever<br/>actor made this call, shown as User.

    Core ->> Leasing: Get Active Listing
    Leasing ->> OneCoreDB: Get Listing
    OneCoreDB -->> Leasing: Listing
    Leasing -->> Core: Active Listing

    break when Listing is not found
        Core-->User: show error message
    end

    Core ->> Leasing: Get Rental Object
    Leasing ->> XPandDB: Get Parking Space
    XPandDB -->> Leasing: Parking Space
    Leasing ->> Tenfast: Get Availability
    Tenfast -->> Leasing: Availability
    Leasing -->> Core: Rental Object

    break when Rental Object not found, or Listing is not Non Scored
        Core-->User: show error message
    end

    Core ->> Leasing: Get Applicant
    Leasing ->> XPandDB: Get Contact
    XPandDB -->> Leasing: Contact
    Leasing -->> Core: Applicant

    break when Applicant is not found or address is missing
        Core-->User: show error message
    end

    Core ->> Leasing: Get Applicant's Leases
    Leasing ->> Tenfast: Get Leases
    Tenfast -->> Leasing: Leases
    Leasing -->> Core: Leases

    alt Applicant has no Existing or Upcoming Lease
        Core ->> Leasing: Perform External Credit Check
        Leasing ->> Creditsafe: Get Consumer Report
        Creditsafe -->> Leasing: Credit Report
        Leasing -->> Core: Credit Check Result
    else
        Core ->> Economy: Perform Internal Credit Check
        Economy ->> Xledger: Get Invoices
        Xledger -->> Economy: Invoices
        Economy ->> Tenfast: Get Invoices
        Tenfast -->> Economy: Invoices
        Economy -->> Core: Credit Check Result
    end

    break when fetching Invoices for Internal Credit Check fails
        Core-->User: show error message
    end

    alt Is Applicant Eligible for Lease
        Core ->> Leasing: Get Tenant
        Leasing ->> XPandDB: Get Contact and Estate Codes
        XPandDB -->> Leasing: Tenant
        Leasing -->> Core: Tenant
        note over Core: Determine VAT rate from tenant<br/>and residential area rules.

        Core ->> Leasing: Create Lease
        Leasing ->> Tenfast: Create Lease
        Tenfast -->> Leasing: Create Lease Result
        Leasing -->> Core: Create Lease Result

        break when Lease was not created
            Core-->User: show error message
        end

        Core ->> Leasing: Update Listing Status
        Leasing ->> OneCoreDB: Update Listing Status
        Core ->> Communication: Notify Applicant of Success
        Communication -->> User: Success Notification
        Core ->> Communication: Notify Leasing Team of Success
        Communication -->> LeasingTeam: Success Notification
        Core -->> User: Lease Created
    else
        Core ->> Communication: Notify Applicant of Failure
        Communication -->> User: Failure Notification
        Core ->> Communication: Notify Leasing Team of Failure
        Communication -->> LeasingTeam: Failure Notification
        Core --> User: No Lease Created
    end

```
