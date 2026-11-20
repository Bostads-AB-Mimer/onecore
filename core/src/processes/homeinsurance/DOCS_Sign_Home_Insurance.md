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
F --> |Yes| G{Any Home Insurance Row<br/>open-ended or still to start?}
G --> |Yes| O
G --> |No| H[Add Rent Row in Tenfast,<br/>tagged Home Insurance,<br/>replacing the current Row if any]
H --> V(Read the Lease again)
V --> |Rows not as intended| LOG[logger.error with addedRowIds,<br/>still 201]
V --> |As intended| O
LOG --> O
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
        Leasing-->Core: 404 lease-not-found
        Core-->MimerAPI: 404
        MimerAPI-->User: reject
    end

    break when Tenfast could not be read
        Leasing-->Core: 503 upstream-failed
        Core-->MimerAPI: 500 (the legacy add adapter has no validateStatus)
        MimerAPI-->User: reject
    end

    break when any Home Insurance Row is open-ended<br/>or still to start, even if the Row in force<br/>today has an end date
        Leasing-->Core: 422 home-insurance-already-exists
        Core-->MimerAPI: 422
        MimerAPI-->User: reject
    end

    note over Leasing: The Row to replace is the current Row<br/>(selectCurrentHomeInsuranceRow): in force today,<br/>else next to start, else last ended. Not the first Row.

    Leasing ->> Tenfast: Update Lease Invoice Rows<br/>(remove the current row if any,<br/>add new row tagged Home Insurance)

    break when Tenfast refuses or fails the write
        Leasing-->Core: 404 lease-not-found / 503 upstream-failed
        Core-->MimerAPI: 404 / 500 (503 becomes 500, see above)
        MimerAPI-->User: reject
    end

    Tenfast -->> Leasing: Updated
    Leasing ->> Tenfast: Get Lease again, to check the write
    note over Leasing: Rows not as intended (a write at the same<br/>time): logger.error with addedRowIds, answer<br/>still 201. Read failed: logger.warn, still 201.
    Leasing -->> Core: 201
    Core -->> MimerAPI: 200
    MimerAPI -->> User: Home Insurance signed!

```

## Regler i leasing

- **Redan försäkrad.** Leasing svarar 422 `home-insurance-already-exists` när någon hemförsäkringsrad saknar slutdatum eller ännu inte har börjat (`hasOpenOrUpcomingHomeInsuranceRow`). Tidigare tittade leasing bara på den första raden med artikeln, och sedan bara på den rad som gäller i dag. En rad som slutar med en tillsvidarerad efter sig gav då en ny rad bredvid den, och hyresgästen debiterades två gånger.
- **Vilken rad som ersätts.** Finns en rad som slutar (uppsagd) ersätts raden som gäller nu (`selectCurrentHomeInsuranceRow`), inte den första raden med artikeln.
- **Fel.** Leasing svarar med typade koder: 404 `lease-not-found` och 503 `upstream-failed` när Tenfast inte kunde läsas eller skrivas. Core-adaptern för teckning (`addLeaseHomeInsurance`) har ingen `validateStatus` och mappar inte koderna, så 503 blir ett axios-fel och 500 i core. Att flytta den till de typade felen, som GET och cancel redan använder, är ett separat kort: svaret till Mina sidor ändras då.
- **Kontroll efter skrivningen.** Som vid uppsägning läser leasing om kontraktet efter skrivningen och loggar `addedRowIds` om raderna inte blev som skrivningen skulle lämna. Se [Säg upp Hemförsäkring](./DOCS_Cancel_Home_Insurance.md#regler-i-leasing).
