# Fakturadistribution — Processöversikt

De processer i den här mappen beskriver hur OneCore distribuerar fakturor och aviseringar till hyresgäster — antingen digitalt (Kivra, e-faktura) eller som fysiskt brev. Leverantören som utför själva distributionen är idag Strålfors. Det här dokumentet visar hur systemen hänger ihop — se respektive dokuments egna diagram för detaljer.

## Två fristående integrationer

Strålfors-integrationen består av två delar som **inte** anropar varandra och som bara delar leverantör och konfigurationsnamnrymd (`config.stralfors` / `config.stralforsExport` i `services/economy`):

1. **Kanalslagning** — ett realtids-API-anrop som avgör _var_ en mottagare kan nås (Kivra, e-faktura eller pappersbrev). Går via Core, precis som övriga processer i den här mappen.
2. **Filöverföring** — ett schemalagt script som faktiskt skickar tryckfärdiga fakturafiler till Strålfors via SFTP, så att de kan produceras och postas/distribueras. Det här scriptet ligger **inte** i Core utan i `services/economy` (`services/economy/src/scripts/transfer-stralfors-files.ts`) och Core är aldrig inblandat i det flödet — det dokumenteras ändå här, för att hålla all Strålfors-dokumentation samlad (samma resonemang som redan gäller för [Länsförsäkringar-exporten](../homeinsurance/DOCS_Export_Home_Insurance_to_Lansforsakringar.md), vars schemaläggning också ligger utanför Core-repot).

## Processer i ordning

| Process                                                               | Vad den gör                                                                                            | Triggas av                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Hämta Aviseringskanal](./DOCS_Invoice_Channel_Lookup.md)             | Slår upp om en hyresgäst/organisation kan nås digitalt (Kivra, e-faktura) eller får pappersfaktura     | Handläggare öppnar kundkortets betalningsflik i property-tree                                                                       |
| [Överför Filer till Strålfors](./DOCS_Transfer_Files_to_Stralfors.md) | Hämtar nya fakturafiler från Tenfast och laddar upp dem till Strålfors via SFTP för tryck/distribution | CronJob `transfer-stralfors-files` (`mimer-onecore-operations`), vardagar 06:00 UTC — **pausad (`suspend: true`) tills aktivering** |

## Att känna till

- **Tenfast är källan för vad som ska skickas.** Filöverförings-scriptet litar helt på Tenfasts `outbound-exports`-kö (`GET /v1/hyresvard/outbound-exports?status=NEW`) — det filtrerar inte på fältet `provider`, utan laddar upp och markerar som skickat allt som Tenfast har kö:at, oavsett vad `provider`/`type` säger. Namnet på scriptet ("transfer-**stralfors**-files") speglar alltså ett antagande om att allt i den kön i praktiken är Strålfors-bundet, inte en explicit filtrering i koden. Bekräftat medvetet antagande: kön innehåller idag bara Strålfors-filer, men det är en potentiell lucka om Tenfast i framtiden lägger till fler distributörer i samma kö.
- **CronJobbet är pausat, men inte avsiktligt av något särskilt skäl.** `mimer-onecore-operations/apps/onecore/economy/transferstralforsfilescronjob.yaml` har `suspend: true` — inställningen kopierades från andra CronJob-definitioner i repot med samma mönster, inte en medveten paus av det här specifika jobbet.
- **Kanalslagningen påverkar inte filöverföringen.** Att en hyresgäst kan nås via Kivra/e-faktura enligt slagningen styr inte om eller hur filen skickas till Strålfors i steg 2 — Strålfors själva avgör, utifrån samma slagning internt, hur den mottagna filen ska distribueras. OneCore skickar samma fil till Strålfors oavsett kanal; kanalslagningen i OneCore används bara för att visa "Alternativ för avisering" i UI:t.
