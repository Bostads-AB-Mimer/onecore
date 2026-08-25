# Acceptera Erbjudande för Poängsatt Bilplats

_Del av [processöversikten](./DOCS_Overview.md) för poängsatta bilplatser._

En sökande accepterar ett erbjudande om en poängsatt bilplats, skapat av [Create Offer](./DOCS_Create_Offer_for_Scored_Parking_Space.md)-processen — antingen själv via Mina Sidor eller å sökandens vägnar av en handläggare via Uthyrningsgränssnittet. Processen kontrollerar att erbjudandet är aktivt, att sökanden fortfarande är hyresgäst och uppfyller områdes- och fastighetsspecifika uthyrningsregler, och skapar därefter kontraktet. Eventuella andra aktiva erbjudanden till samma sökande [nekas](./DOCS_Deny_Offer.md) automatiskt — vilket i sin tur skapar ett nytt erbjudande till nästa sökande på de annonserna.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare till nästa steg, och vad som händer vid godkännande, nekande eller fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start] --> Off{Is Offer Active?}
Off --> |No| O[End]
Off --> |Yes| B(Get Listing)
B --> Lo{Listing and Rental Object Found?}
Lo --> |No| O
Lo --> |Yes| X{Is Applicant a Tenant?}
X --> |No| O
X --> |Yes| Br{Is Applicant Eligible <br/>to Rent Parking Space <br/>with Specific Rental Rule?}
Br --> |No| O
Br --> |Yes| E[Create Lease<br/>VAT checked manually afterward]
E --> Ec{Lease Created?}
Ec --> |No| O
Ec --> |Yes| F(Close Offer By Accept)
F --> H(Reset Waiting List)
H --> G{Does the Applicant Have<br/>Other Active Offers?}
G --> |Yes| I(Deny All Other Active Offers)
G --> |No| K(Notify Contact)
I --> K
K --> J(Notify Leasing Team)
J --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning, och var processen kan avbrytas vid en misslyckad kontroll. Täcker båda ingångarna (sökandens självbetjäning och handläggarinitierat via Uthyrningsgränssnittet), och visar att mikrotjänsten Leasing samt de externa systemen XPand och Tenfast är inblandade.

```mermaid
sequenceDiagram
    actor LeasingTeam as Leasing Team
    actor User as User
    participant Core as Core
    participant Leasing as Leasing
    participant Communication as Communication
    participant OneCoreDB as OneCore Database
    participant XPandDB as XPand Database
    participant XPandSOAP as XPand SOAP Service
    participant Tenfast as Tenfast

    alt Accepteras av sökanden via Mina Sidor
        User ->> Core: Accept Offer
    else Accepteras manuellt av handläggare via Uthyrningsgränssnittet
        LeasingTeam ->> Core: Accept Offer
    end
    note over Core: Mina Sidor-vägen är arkitekturellt stödd (samma<br/>endpoint, Keycloak-autentisering) men den delen är<br/>inte implementerad i denna kodbas. Responses below<br/>go back to whichever caller made this call, shown as User.

    Core ->> Leasing: Get Offer
    Leasing ->> OneCoreDB: Get Offer
    OneCoreDB -->> Leasing: Offer
    Leasing -->> Core: Offer

    break when Offer is not found, or not Active
        Core-->User: show error message
    end

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

    break when Listing or Rental Object not found,<br/>or missing Residential Area Code
        Core-->User: show error message
    end

    Core ->> Leasing: Get Leases (current/about-to-end/upcoming)
    Leasing ->> Tenfast: Get Leases
    Tenfast -->> Leasing: Leases
    Leasing -->> Core: Leases

    break when Applicant is not a tenant
        Core-->User: show error message
    end

    par Validate Residential Area Rental Rules
        Core ->> Leasing: Validate Residential Area Rental Rules
        Leasing ->> XPandDB: Get Contact, Residential Area<br/>and Estate Code
        XPandDB -->> Leasing: Residential Area Data
        Leasing ->> Tenfast: Get Tenant and Leases
        Tenfast -->> Leasing: Tenant and Leases
        Leasing -->> Core: Residential Area Validation Result
    and Validate Property Rental Rules
        Core ->> Leasing: Validate Property Rental Rules
        Leasing ->> XPandDB: Get Estate Codes for Property<br/>and each Parking Space Lease
        XPandDB -->> Leasing: Estate Codes
        Leasing ->> Tenfast: Get Tenant and Leases
        Tenfast -->> Leasing: Tenant and Leases
        Leasing -->> Core: Property Validation Result
    end

    break when Applicant is not Eligible to Rent in Parking Space with Specific Rental Rule
        Core-->User: show error message
    end

    Core ->> Leasing: Create Lease
    Leasing ->> Tenfast: Create Lease
    Tenfast -->> Leasing: Lease
    Leasing -->> Core: Lease
    note over Core: VAT is hardcoded to false here —<br/>must be checked manually before signing.

    break when Lease could not be created
        Core-->User: show error message
    end

    note over Core: Everything from here on is best-effort:<br/>a failure in any of the following steps is<br/>logged only and does not fail the process<br/>(the lease has already been created).

    Core ->> Leasing: Close Offer By Accept
    Leasing ->> OneCoreDB: Update Listing, Applicant,<br/>Offer and Offer-Applicant Status
    OneCoreDB -->> Leasing: Updated
    Leasing -->> Core: Result

    Core ->> Leasing: Reset Waiting List
    Leasing ->> XPandSOAP: Reset Waiting List
    XPandSOAP -->> Leasing: Reset
    Leasing -->> Core: Result

    Core ->> Leasing: Get Other Active Offers for Contact
    Leasing ->> OneCoreDB: Get Offers for Contact
    OneCoreDB -->> Leasing: Offers
    Leasing -->> Core: Other Active Offers

    loop for each Other Active Offer
        Core ->> Core: Deny Offer<br/>(see Deny Offer process — also creates<br/>a new offer for the next applicant)
    end

    Core ->> Leasing: Get Contact
    Leasing ->> XPandDB: Get Contact
    XPandDB -->> Leasing: Contact
    Leasing -->> Core: Contact

    alt Contact has an Email Address
        Core ->> Communication: Send Accept Confirmation
        Communication ->> User: Accept Confirmation Email
        Communication -->> Core: Result
    end

    Core ->> Communication: Notify Leasing Team
    Communication -->> LeasingTeam: Notification

    Core -->> User: Accept Offer success!

```
