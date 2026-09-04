# Exportera Hemförsäkring till Länsförsäkringar

_Del av [processöversikten](./DOCS_Overview.md) för hemförsäkring._

Ett fristående script (`core/src/scripts/home-insurance-export.ts`) hämtar samtliga hyreskontrakt med en hemförsäkringsrad i Tenfast — i statusarna `active`, `upcoming`, `preTermination` och `terminationScheduled` — och skickar en daglig Excel-fil med dem till Länsförsäkringar via SFTP. Det här är ett annat exportflöde än mimer.nu:s eget (se [processöversiktens](./DOCS_Overview.md) avsnitt "Utanför denna dokumentation") — den här exporten läser från Tenfast, inte från mimer.nu:s lokala databas.

Schemaläggningen ligger inte i onecore-repot utan i `mimer-onecore-operations` (`apps/onecore/core/lfinsuranceexportcronjob.yaml`) — ett Kubernetes CronJob vid namn `lf-insurance-export` som kör `npm run script:home-insurance-export` i core-imagen, dagligen kl 23:59 (`59 23 * * *`).

## Flödesdiagram

Processens beslutslogik: vilka steg som körs, och vilka rader som filtreras bort vid mappning. System- och integrationsdetaljer är medvetet utelämnade här — se sekvensdiagrammet nedan för det.

```mermaid
flowchart LR
A[Start: CronJob lf-insurance-export<br/>Daily 23:59] --> B(Fetch Leases with Home<br/>Insurance Row from Tenfast)
B --> C[For Each Lease: Map to Export Row —<br/>skipped if Tenant is a Company,<br/>missing Personnummer or Rental Object,<br/>missing Insurance From-date,<br/>or Amount is Negative]
C --> D[Build Excel File]
D --> E{LOCAL_OUTPUT<br/>env set?}
E --> |Yes| F[Write File Locally]
E --> |No| G[Upload File via SFTP<br/>to Länsförsäkringar]
F --> O[End]
G --> O
```

## Sekvensdiagram

Vilka tjänster som anropas i varje steg, i vilken ordning. Detta är ett fristående script i core-paketet, inte en HTTP-endpoint — det körs utanför Koa-servern, som ett eget engångs-Kubernetes-Job skapat av CronJobbet, utan mänsklig initierare.

```mermaid
sequenceDiagram
    participant CronJob as CronJob lf-insurance-export<br/>(mimer-onecore-operations)
    participant Core as Core (script)
    participant Leasing as Leasing
    participant Tenfast as Tenfast
    participant SFTP as SFTP (Länsförsäkringar)

    CronJob ->> Core: Run Home Insurance Export<br/>(npm run script:home-insurance-export)

    Core ->> Leasing: Get LF Export
    Leasing ->> Tenfast: Get Leases with Home Insurance Row<br/>(states: active, upcoming,<br/>preTermination, terminationScheduled)
    Tenfast -->> Leasing: Leases (paginated)
    note over Leasing: annualRent in the export row is populated<br/>directly from the insurance row's amount —<br/>the same value the sign/cancel endpoints call<br/>monthlyAmount. Worth confirming with the<br/>business whether that's a deliberate relabel.
    Leasing -->> Core: Export Rows

    break when fetching from Leasing fails
        Core-->CronJob: throw, script exits non-zero
    end

    Core ->> Core: Build Excel File<br/>("Hemförsäkring" sheet, 16 columns)

    alt LOCAL_OUTPUT is set
        Core ->> Core: Write File to Local Disk
    else
        Core ->> SFTP: Upload "Hemforsakring_LF_YYYY-MM-DD.xlsx"
        SFTP -->> Core: Uploaded
    end

    Core -->> CronJob: Done

```
