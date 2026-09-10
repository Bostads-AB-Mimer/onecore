# Säg upp Hemförsäkring

_Del av [processöversikten](./DOCS_Overview.md) för hemförsäkring._

En hemförsäkring avslutas från ett visst datum — antingen av hyresgästen själv via Mina Sidor, eller manuellt av en handläggare via en Admin-skyddad endpoint i Mimer.nu API. Ingen anropare av den handläggarvägen hittades i de undersökta kodbaserna — den används sannolikt manuellt (t.ex. via Swagger) snarare än från ett byggt gränssnitt. Se [Teckna Hemförsäkring](./DOCS_Sign_Home_Insurance.md) för motsatta vägen.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare till nästa steg, och vad som händer vid godkännande, nekande eller fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start] --> C(Get Lease)
C --> Co{Lease Found?}
Co --> |No| O[End]
Co --> |Yes| D{Caller Owns Lease,<br/>or is Admin/Developer?}
D --> |No| O
D --> |Yes| E(Get Home Insurance)
E --> Eo{Home Insurance<br/>Row Found?}
Eo --> |No| O
Eo --> |Yes| F[Replace Rent Row in Tenfast,<br/>with To-date set]
F --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning, och var processen kan avbrytas vid en misslyckad kontroll. Täcker båda ingångarna (hyresgästens självbetjäning och det manuella Admin-anropet). Mimer.nu API behandlas som en extern aktör (se [processöversikten](./DOCS_Overview.md)) — bara dess relevanta affärsregler och anrop mot OneCore ritas ut.

```mermaid
sequenceDiagram
    actor User as User
    actor LeasingTeam as Leasing Team
    participant MimerAPI as Mimer.nu API
    participant Core as Core
    participant Leasing as Leasing
    participant Tenfast as Tenfast

    alt Sägs upp av hyresgästen via Mina Sidor
        User ->> MimerAPI: Cancel Home Insurance<br/>(POST /postinsurance, med resignationDate)
    else Sägs upp manuellt av handläggare
        LeasingTeam ->> MimerAPI: Cancel Home Insurance<br/>(DELETE /terminateinsurance, Admin-skyddad)
    end
    note over MimerAPI: Responses below go back to whichever caller<br/>made this call, shown as User. No protected-identity<br/>check happens here — that only applies when signing.

    MimerAPI ->> Core: Get Lease
    Core ->> Leasing: Get Lease
    Leasing ->> Tenfast: Get Lease
    Tenfast -->> Leasing: Lease
    Leasing -->> Core: Lease
    Core -->> MimerAPI: Lease

    break when Lease not found
        MimerAPI-->User: reject
    end

    note over MimerAPI: Caller must be the lease's tenant,<br/>unless Admin or Developer.

    break when Caller does not own the Lease,<br/>and is not Admin/Developer
        MimerAPI-->User: reject
    end

    MimerAPI ->> Core: Cancel Home Insurance (endDate)

    Core ->> Leasing: Get Home Insurance
    Leasing ->> Tenfast: Get Lease
    Tenfast -->> Leasing: Lease
    Leasing -->> Core: Home Insurance Row

    break when no Home Insurance Row exists
        Core-->MimerAPI: 404
        MimerAPI-->User: reject
    end

    Core ->> Leasing: Cancel Home Insurance (endDate)
    Leasing ->> Tenfast: Get Lease
    Tenfast -->> Leasing: Lease
    note over Leasing: Re-locates the Home Insurance Row —<br/>a second, independent lookup rather than<br/>reusing Core's result above.

    break when Home Insurance Row not found here either
        Leasing-->Core: 404
        Core-->MimerAPI: 500
        MimerAPI-->User: reject
    end

    Leasing ->> Tenfast: Update Lease Invoice Rows<br/>(remove old row, add same row<br/>back with To set to endDate)
    Tenfast -->> Leasing: Updated
    Leasing -->> Core: Result
    Core -->> MimerAPI: 200
    MimerAPI -->> User: Home Insurance cancelled!

```
