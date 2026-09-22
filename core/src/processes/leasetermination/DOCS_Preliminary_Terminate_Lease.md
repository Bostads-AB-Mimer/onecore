# Hyresgäst Begär Uppsägning av Bilplats (Preliminär Uppsägning)

_Del av [processöversikten](./DOCS_Overview.md) för uppsägning av avtal._

En hyresgäst säger upp sin bilplats via Mina Sidor. Mimer.nu API slår upp hyresgästens kontrakt hos OneCore, avgör att objektstypen är `parkering` och skickar begäran vidare till OneCore, som via Leasing ber Tenfast skicka en signeringsbegäran (BankID) till hyresgästen. Uppsägningen är först slutgiltig när hyresgästen signerar — det här flödet dokumenterar bara själva begäran. Se [processöversikten](./DOCS_Overview.md) för hur bostad/förråd hanteras istället (går direkt till Xpand, aldrig via onecore).

## Flödesdiagram

Processens beslutslogik: vilka kontroller som styr om flödet går vidare, och vad som händer vid fel. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start] --> B(Hämta Hyresgästens<br/>Kontrakt från OneCore)
B --> Bo{Kontraktet Hittat<br/>Bland Hyresgästens Avtal?}
Bo --> |No| O[End]
Bo --> |Yes| C{Objektstyp?}
C --> |Lokaler/Okänd| O
C --> |Bostad/Förråd| X[Skickas till Xpand istället<br/>— se processöversikten]
C --> |Parkering| D(Slå upp Avtal i Tenfast)
D --> Do{Avtal Hittat?}
Do --> |No| O
Do --> |Yes| E(Skicka Signeringsbegäran<br/>via Simplesign)
E --> Eo{Resultat?}
Eo --> |Hyresgäst Saknar<br/>Giltig E-post| O
Eo --> |Avtalet Löper Redan Ut<br/>Inom Uppsägningstiden| O
Eo --> |Annat Fel| O
Eo --> |Lyckades| F[Signeringsbegäran Skickad —<br/>Hyresgäst Måste Signera med BankID]
F --> O
X --> O
```

## Sekvensdiagram

Vilka tjänster och externa system som anropas i varje steg, i vilken ordning, och var processen kan avbrytas vid en misslyckad kontroll. Mimer.nu API behandlas som en extern aktör (se [processöversikten](./DOCS_Overview.md)) — bara dess relevanta affärsregler och anrop mot OneCore ritas ut.

```mermaid
sequenceDiagram
    actor Tenant as Hyresgäst
    participant MinaSidor as Mina Sidor
    participant MimerAPI as Mimer.nu API
    participant Core as Core
    participant Leasing as Leasing
    participant Tenfast as Tenfast

    Tenant ->> MinaSidor: Klicka "Säg upp kontrakt",<br/>bekräfta i dialog
    MinaSidor ->> MimerAPI: POST /applicants/me/rentContracts/terminationRequest<br/>(contractNumber, desiredMoveDate)

    MimerAPI ->> Core: Get Leases by ContactCode
    Core -->> MimerAPI: Leases

    break when Contract Number not found bland Hyresgästens Leases
        MimerAPI-->MinaSidor: reject
    end

    note over MimerAPI: lastDebitDate = kontraktets LastDebitDate/LeaseEndDate,<br/>höjs till desiredMoveDate om det önskade datumet är senare.
    note over MimerAPI: Routning avgörs av objektstyp — se processöversikten.<br/>Endast "parkering" fortsätter till OneCore, nedan.

    MimerAPI ->> Core: POST /leases/by-lease-id/{leaseId}/preliminary-termination<br/>(contactCode, lastDebitDate, desiredMoveDate)
    Core ->> Leasing: POST /leases/{leaseId}/preliminary-termination<br/>(samma body)

    Leasing ->> Tenfast: Get Lease (by externalId)

    break when Lease not found in Tenfast
        Tenfast-->Leasing: 404
        Leasing-->Core: 404
        Core-->MimerAPI: 404
        MimerAPI-->MinaSidor: reject
    end

    Leasing ->> Tenfast: PATCH /avtal/{id}/send-simplesign-termination<br/>(endDate, cancelledByType: "hyresgast",<br/>reason: "Tenant requested termination",<br/>preferredMoveOutDate)

    break when Tenant Saknar Giltig E-postadress
        Tenfast-->Leasing: 400 "En eller flera hyresgäster<br/>saknar en giltig e-postadress"
        Leasing-->Core: 400 tenant-email-missing
        Core-->MimerAPI: 400
        MimerAPI-->MinaSidor: reject
    end

    break when Avtalet Löper Ut Inom Uppsägningstiden
        Tenfast-->Leasing: 400 "Avtalet kommer löpa ut inom<br/>uppsägningstiden. Ingen uppsägning krävs."
        Leasing-->Core: 400 termination-not-required
        Core-->MimerAPI: 400
        MimerAPI-->MinaSidor: reject
    end

    Tenfast-->>Leasing: 200 "Signerings begäran skickad"
    Leasing-->>Core: 200
    Core-->>MimerAPI: 200
    MimerAPI-->>MinaSidor: 204
    MinaSidor-->>Tenant: Visa "väntar på signering" —<br/>kolla mejlen, signera med BankID

```

## Att känna till

- Det här är den **enda** platsen i onecore där en bilplats-uppsägning är hyresgäst-initierad — motsatsen till [Synka Uppsägning från Xpand](./DOCS_Terminate_Lease_via_Xpand_Sync.md), där bilplatser tvärtom filtreras bort (se processöversiktens not om det).
- `cancelledByType: 'hyresgast'` är hårdkodat av onecore i anropet till Tenfast — det är så Tenfast (och därmed statistik/revisionsspår) vet att uppsägningen kom från hyresgästen själv.
- Det här steget skickar bara en **signeringsbegäran** — avtalet är inte uppsagt förrän hyresgästen faktiskt signerar med BankID. Själva stegövergången i Tenfast (från `preTermination` till `terminationScheduled`) styrs av Tenfast internt och är inte synlig i den här kodbasen.
- **Tenfast bekräftar uppsägningen tillbaka till OneCore (AVTAL-232).** När Tenfast internt slutfört uppsägningen anropar Tenfast `POST /v1/tenant-notifications/lease-termination-confirmation` på Core (med en `Idempotency-Key`-header för säkra omförsök), och Core skickar då ett bekräftelsemejl till hyresgästen via Communication/Infobip. Bara `rentalType: "Bilplats"` stöds idag. Det här är den enda platsen i hela uppsägningsflödet där Tenfast anropar **in** i onecore istället för tvärtom.
- Mina Sidor sätter ett standardvärde för `desiredMoveDate` om hyresgästen inte anger ett eget: sista dagen i månaden, 3 månader fram — en UI-standard, inte en regel som verifieras på serversidan.
