# Hantera Utgångna Erbjudanden (Expire Offer)

_Del av [processöversikten](./DOCS_Overview.md) för poängsatta bilplatser._

Ett schemalagt jobb letar systemvitt upp alla aktiva erbjudanden om poängsatta bilplatser vars svarsfrist har passerat utan att sökanden svarat. Erbjudandet och den tillhörande ansökan sätts till utgången status, och ett nytt erbjudande skapas därefter automatiskt till nästa berättigade sökande i kön för varje påverkad annons (se [Create Offer](./DOCS_Create_Offer_for_Scored_Parking_Space.md)-processen).

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare till nästa steg, och vad som händer vid godkännande, nekande eller fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start: Scheduled Job Runs] --> B[Find All Active Offers<br/>Past Their Response Deadline]
B --> C{Any Expired Offers Found?}
C --> |No| O[End]
C --> |Yes| D[For Each Expired Offer:<br/>Set Offer Status to Expired,<br/>Set Offer Applicant Snapshot to OfferExpired]
D --> E[Initiate Create Offer Process<br/>for each Affected Listing]
E --> O
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Detta är ett schemalagt, systemvitt jobb utan mänsklig initierare — det körs inte via Uthyrningsgränssnittet eller Mina Sidor.

```mermaid
sequenceDiagram
    participant ScheduledJob as Scheduled Job
    participant Core as Core
    participant Leasing as Leasing
    participant OneCoreDB as OneCore Database

    ScheduledJob ->> Core: Handle Expired Offers

    Core ->> Leasing: Handle Expired Offers
    Leasing ->> OneCoreDB: Find Active Offers<br/>Past Response Deadline
    OneCoreDB -->> Leasing: Expired Offers

    loop for each Expired Offer
        Leasing ->> OneCoreDB: Set Offer Status to Expired,<br/>Offer Applicant Snapshot to OfferExpired
    end
    note over Leasing: Known issue: the Applicant's own Status field is<br/>never updated here — it stays "Offered" indefinitely,<br/>unlike Deny Offer, which also sets it to OfferDeclined.<br/>The snapshot update above is also scoped only by<br/>applicantId (not offerId/listingId), so it can overwrite<br/>that applicant's snapshot rows from other, unrelated<br/>offer rounds too. To be fixed in a follow-up.

    break when Leasing fails to fetch or process Expired Offers
        Core-->>ScheduledJob: log error and exit<br/>(no offers are processed this run)
    end

    Leasing -->> Core: Affected Listing IDs
    note over Core: No notification is sent to the applicant<br/>or Leasing Team when an offer simply<br/>expires unanswered — unlike Accept/Deny Offer.

    loop for each Affected Listing
        Core ->> Core: Create Offer for this Listing<br/>(see Create Offer process)
    end
    note over Core: If creating an offer for one listing fails,<br/>it's logged and the loop continues —<br/>one failure doesn't stop the others.

    Core -->> ScheduledJob: Done

```
