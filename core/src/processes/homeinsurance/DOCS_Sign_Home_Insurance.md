# Teckna Hemförsäkring

_Del av [processöversikten](./DOCS_Overview.md) för hemförsäkring._

En hyresgäst tecknar hemförsäkring för sin lägenhet via Mina Sidor. Mimer.nu API kontrollerar att hyresgästen äger kontraktet och inte har skyddade personuppgifter, varpå OneCore beräknar priset utifrån lägenhetens rumsantal och lägger till en hyresrad i Tenfast, taggad som hemförsäkring. Se [Säg upp Hemförsäkring](./DOCS_Cancel_Home_Insurance.md) för motsatta vägen.

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare till nästa steg, och vad som händer vid godkännande, nekande eller fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start] --> B{Has Contact<br/>Protected Identity?}
B --> |Yes| O[End]
B --> |No| C(Get Lease)
C --> Co{Lease Found?}
Co --> |No| O
Co --> |Yes| D{Caller Owns Lease,<br/>or is Admin/Developer?}
D --> |No| O
D --> |Yes| E(Get Residence)
E --> Eo{Residence Found?}
Eo --> |No| O
Eo --> |Yes| F{Price Tier Exists<br/>for Room Count?}
F --> |No| O
F --> |Yes| G{Existing Active Home<br/>Insurance on Lease?}
G --> |Yes| O
G --> |No| H[Add Rent Row in Tenfast,<br/>tagged Home Insurance]
H --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning, och var processen kan avbrytas vid en misslyckad kontroll. Mimer.nu API behandlas som en extern aktör (se [processöversikten](./DOCS_Overview.md)) — bara dess relevanta affärsregler och anrop mot OneCore ritas ut.

```mermaid
sequenceDiagram
    actor User as User
    participant MimerAPI as Mimer.nu API
    participant Core as Core
    participant Leasing as Leasing
    participant PropertyBase as Property Base
    participant Tenfast as Tenfast

    User ->> MimerAPI: Sign Home Insurance (POST /postinsurance)
    note over MimerAPI: Only checked when signing, not when cancelling:<br/>tenants with protected identity ("skyddade<br/>personuppgifter") are blocked here.

    break when Contact has Protected Identity
        MimerAPI-->User: reject
    end

    MimerAPI ->> Core: Get Lease
    Core ->> Leasing: Get Lease
    Leasing ->> Tenfast: Get Lease
    Tenfast -->> Leasing: Lease
    Leasing -->> Core: Lease
    Core -->> MimerAPI: Lease

    break when Lease not found
        MimerAPI-->User: reject
    end

    note over MimerAPI: Caller must be the lease's tenant, unless Admin<br/>or Developer — the same endpoint architecturally<br/>supports a handläggare acting on a tenant's<br/>behalf, though no such UI was found in this codebase.

    break when Caller does not own the Lease,<br/>and is not Admin/Developer
        MimerAPI-->User: reject
    end

    MimerAPI ->> Core: Create Home Insurance (from: SignDate)

    Core ->> PropertyBase: Get Residence by Rental Id
    PropertyBase -->> Core: Residence

    break when Residence not found
        Core-->MimerAPI: 404
    end

    note over Core: monthlyAmount is derived from the residence's<br/>room count (69/80/93/114/125 kr) — never trusted<br/>from the client.

    break when Room Count has no Price Tier
        Core-->MimerAPI: 500
    end

    Core ->> Leasing: Add Home Insurance (from, monthlyAmount)
    Leasing ->> Tenfast: Get Lease
    Tenfast -->> Leasing: Lease

    break when Lease not found in Tenfast
        Leasing-->Core: 404
        Core-->MimerAPI: 404
        MimerAPI-->User: reject
    end

    break when an Active (uncancelled) Home<br/>Insurance Row already exists on the Lease
        Leasing-->Core: 422 insurance-already-exists
        Core-->MimerAPI: 422
        MimerAPI-->User: reject
    end

    Leasing ->> Tenfast: Update Lease Invoice Rows<br/>(remove old cancelled row if any,<br/>add new row tagged Home Insurance)
    Tenfast -->> Leasing: Updated
    Leasing -->> Core: Result
    Core -->> MimerAPI: 200
    MimerAPI -->> User: Home Insurance signed!

```
