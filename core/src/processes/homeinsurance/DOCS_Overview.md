# Hemförsäkring — Processöversikt

De processer i den här mappen beskriver hur en hyresgästs hemförsäkring hanteras — från att den tecknas via Mina Sidor till att den avslutas och rapporteras till försäkringsbolaget. Sanningskällan för vem som faktiskt har hemförsäkring är Tenfast. Det här dokumentet visar hur systemen hänger ihop — se respektive dokuments egna diagram för detaljer.

## Hur hemförsäkring modelleras

Tenfast har ingen egen "försäkring"-entitet. Hemförsäkring är en vanlig hyresrad (`hyror`) på kontraktet, taggad med ett specifikt artikel-ID (konfigurerat i leasing-tjänsten som `config.tenfast.leaseRentRows.homeInsurance.articleId`). Ett kontrakt kan ha flera sådana rader, till exempel en avslutad och en ny. Leasing läser alltid den rad som gäller i dag, annars nästa kommande, annars den senast avslutade, och har den raden ett slutdatum men en tillsvidarerad tar över efter den läses den raden i stället (`selectCurrentHomeInsuranceRow`). Den raden styr visning och LF-exporten. Att teckna en ny försäkring avvisas när någon hemförsäkringsrad saknar slutdatum eller ännu inte har börjat. Uppsägning från Mina Sidor sätter ett slutdatum (`to`) på raden som gäller på slutdatumet, aldrig före radens startdatum, och tar bort rader som skulle börja efter det. En rad behålls alltid. Personal kan via `PATCH /leases/{leaseId}/home-insurance/rows/{rowId}` (core, rollen `home-insurance:write`) också ta bort raden, när försäkringen sägs upp på eller före sin startdag — se [Säg upp Hemförsäkring](./DOCS_Cancel_Home_Insurance.md).

Priset (`monthlyAmount`) beräknas alltid av OneCore utifrån lägenhetens rumsantal (`core/src/services/lease-service/helpers/lease.ts`) — klienten skickar aldrig med ett eget pris:

| Rum | Kr/månad |
| --- | -------- |
| 1   | 69       |
| 2   | 80       |
| 3   | 93       |
| 4   | 114      |
| 5–8 | 125      |

## Processer i ordning

| Process                                                                                              | Vad den gör                                                                               | Triggas av                                                                  |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [Teckna Hemförsäkring](./DOCS_Sign_Home_Insurance.md)                                                | Hyresgäst tecknar hemförsäkring för sin lägenhet                                          | Hyresgäst (Mina Sidor)                                                      |
| [Säg upp Hemförsäkring](./DOCS_Cancel_Home_Insurance.md)                                             | Hemförsäkringen avslutas från ett visst datum                                             | Hyresgäst (Mina Sidor) eller handläggare (manuellt, Admin-skyddad endpoint) |
| [Exportera Hemförsäkring till Länsförsäkringar](./DOCS_Export_Home_Insurance_to_Lansforsakringar.md) | Skickar en lista över aktiva, kommande och uppsagda hemförsäkringar till Länsförsäkringar | CronJob `lf-insurance-export` (`mimer-onecore-operations`), dagligen 23:59  |
| [Personalens hemförsäkringsverktyg](./DOCS_Staff_Home_Insurance.md)                                  | Lista, Excel-export och avslut eller ändrat T.o.m. på enskilda rader                      | Personal med rollerna `home-insurance:read` / `home-insurance:write`        |

## Utanför denna dokumentation

Mimer.nu API har ytterligare två hemförsäkringsflöden som medvetet inte täcks här, eftersom de aldrig når OneCore eller Tenfast — de läser och skriver uteslutande mot mimer.nu:s egen databas:

- **Automatisk registrering för kommande kontrakt** (`POST /createforcomingcontracts`) — en schemalagd Azure Function skapar rader i mimer.nu:s lokala `HomeInsurance`-tabell för nytecknade lägenhetskontrakt.
- **Export från mimer.nu:s egen tabell** (`POST /uploadexcel`, `GET /export`) — Excel/SFTP-export av samma lokala tabell.

**Mimer.nu API behandlas som en extern aktör** i sekvensdiagrammen nedan — på samma sätt som Tenfast och XPand-databasen behandlas i bilplats-dokumentationen. Dess interna uppdelning (controller, MediatR-handlers, kontakttjänst) ritas inte ut i detalj — bara vilka anrop som går mot OneCore, och vilka affärsregler (skyddade personuppgifter, ägarskapskontroll) som avgör om anropet ens når fram.
